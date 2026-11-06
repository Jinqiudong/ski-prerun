// Background music. The tracks are listed in assets/audio/music/manifest.json, each with a mood (lift, ski,
// calm) and its licence. A track is a file in that folder, or "gen": music written here, in the browser,
// from a seed (soft pads, plucked arpeggios, a bell tune and, for skiing, a light beat), so there is music
// with no licence to worry about. A generated track is the same on every phone for the same second, so
// "listen together" can tell each friend's player play(trackId, atSeconds) and they line up.
// The phase picks the mood (setMood); moods crossfade. Ducking under voice happens on the music bus.

const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const CHORDS = { maj7: [0, 4, 7, 11], maj9: [0, 4, 7, 11, 14], m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14], sus2: [0, 2, 7, 12], add9: [0, 4, 7, 14], six9: [0, 4, 9, 14] };
const PENTA = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };
// Each mood: tempo, beats per chord, the progression (semitones from the key, chord), the scale for the
// tune, and how loud each part is (0: not played).
export const STYLES = {
  calm: { bpm: 64, per: 8, prog: [[0, "maj9"], [-3, "m9"], [-7, "maj7"], [-5, "sus2"]], scale: "major", parts: { pad: 1, bell: 0.75, arp: 0, bass: 0.35, kick: 0, hat: 0 } },
  lift: { bpm: 80, per: 4, prog: [[0, "maj7"], [-5, "add9"], [-3, "m7"], [-7, "six9"]], scale: "major", parts: { pad: 0.75, bell: 0.45, arp: 0.7, bass: 0.6, kick: 0, hat: 0.35 } },
  ski: { bpm: 100, per: 4, prog: [[0, "m9"], [-4, "maj7"], [-2, "add9"], [-7, "m7"]], scale: "minor", parts: { pad: 0.5, bell: 0.55, arp: 1, bass: 1, kick: 1, hat: 1 } },
};

function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// A generated track: schedules a bar at a time, a little ahead of the clock.
class GenTrack {
  constructor(ctx, out, send, spec) {
    this.ctx = ctx; this.spec = spec; this.st = STYLES[spec.gen.style || spec.mood] || STYLES.calm;
    this.key = spec.gen.key ?? 50; this.seed = spec.gen.seed ?? 1;
    this.beat = 60 / (spec.gen.bpm || this.st.bpm); this.bar = this.beat * 4; this.bars = spec.gen.bars || 32;
    this.length = this.bars * this.bar;
    this.gain = ctx.createGain(); this.gain.gain.value = 0; this.gain.connect(out);
    this.wet = ctx.createGain(); this.wet.gain.value = 0.55; this.gain.connect(this.wet); if (send) this.wet.connect(send);
    // Shared by every hat: one noise buffer and a highpass.
    const n = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate), d = n.getChannelData(0), r = rng(9);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    this.noise = n; this.hatF = ctx.createBiquadFilter(); this.hatF.type = "highpass"; this.hatF.frequency.value = 6000; this.hatF.connect(this.gain);
    this.timer = null;
  }
  // Start at `at` seconds into the track, now (or at `when`).
  start(at = 0, when = this.ctx.currentTime, timer = true) {
    at = ((at % this.length) + this.length) % this.length;
    this.t0 = when - at; // when the track's second 0 was
    this.next = Math.floor(at / this.bar); this.playing = true;
    if (timer) { this.pump(when + 1.5); this.timer = setInterval(() => this.pump(this.ctx.currentTime + 1.5), 400); }
  }
  position(now = this.ctx.currentTime) { return (((now - this.t0) % this.length) + this.length) % this.length; }
  stop(when = this.ctx.currentTime) { this.playing = false; clearInterval(this.timer); this.timer = null; setTimeout?.(() => this.gain.disconnect(), Math.max(0, (when - this.ctx.currentTime) * 1000) + 200); }
  pump(until) {
    while (this.playing && this.t0 + this.next * this.bar < until) { this.playBar(this.next, this.t0 + this.next * this.bar); this.next++; }
  }

  // One bar. Everything in it comes from the seed and the bar's number, so it is the same everywhere.
  playBar(n, t) {
    const S = this.st, P = S.parts, b = n % this.bars, beat = this.beat, now = this.ctx.currentTime - 0.02;
    const chordAt = (bb) => S.prog[Math.floor((bb * 4) / S.per) % S.prog.length];
    const [root, kind] = chordAt(b), tones = CHORDS[kind].map((i) => this.key + root + i);
    const section = Math.floor(b / 8) % 4; // A A' B A'': the beat drops out in B, the tune changes
    const phrase = rng(this.seed * 977 + (section === 2 ? 2 : 1) * 131 + (b % 4) * 17);
    const vary = rng(this.seed * 31 + b * 7);
    const firstOfChord = (b * 4) % S.per === 0;
    // Pads: a new chord, held for its length.
    if (P.pad && firstOfChord) this.pad(tones.map((m) => m + 12), t, S.per * beat + 0.4, P.pad, now);
    // Bass: the root, on 1 (and pushing into 3 when there's a beat).
    if (P.bass) {
      const f = hz(this.key + root + (root < -4 ? 12 : 0)); // A2–E3: low, but still there on a phone
      if (firstOfChord || S.per <= 4) this.bassNote(f, t, beat * (S.per <= 4 ? 1.6 : 6), 0.9 * P.bass, now);
      if (P.kick) { this.bassNote(f, t + beat * 1.5, beat * 0.4, 0.55 * P.bass, now); this.bassNote(f * (vary() < 0.5 ? 1 : 1.5), t + beat * 2.5, beat * 1.2, 0.7 * P.bass, now); }
    }
    // Beat: a soft kick on 1 and 3, hats on the offbeats (lighter on the lift), resting in section B.
    const drums = section !== 2 || b % 8 >= 6;
    if (P.kick && drums) for (const k of [0, 2, ...(vary() < 0.3 ? [2.75] : [])]) this.kick(t + k * beat, 0.9 * P.kick, now);
    if (P.hat && (drums || !P.kick)) for (let i = 0; i < 8; i++) {
      const off = i % 2 === 1, vel = off ? 1 : 0.35;
      if (!P.kick && !off) continue;
      this.hat(t + i * beat / 2 + (off ? beat * 0.03 : 0), vel * 0.5 * P.hat, now);
    }
    // Arpeggio: the chord climbing and falling in eighths (sixteenths when skiing).
    if (P.arp) {
      const steps = P.kick ? 16 : 8, pat = [0, 1, 2, 3, 2, 1, 3, 2], up = tones.map((m) => m + 24);
      for (let i = 0; i < steps; i++) {
        if (P.kick && i % 4 === 3 && vary() < 0.5) continue;
        const m = up[pat[(i + (b % 2) * 3) % pat.length] % up.length];
        this.pluck(hz(m), t + i * (4 * beat / steps), 0.13 * P.arp * (i % 4 === 0 ? 1 : 0.7), now);
      }
    }
    // The tune: a few bell notes from the scale, phrases repeating every four bars.
    if (P.bell) {
      const sc = PENTA[S.scale], slots = S.bpm < 70 ? 4 : 8;
      for (let i = 0; i < slots; i++) {
        if (phrase() < (S.bpm < 70 ? 0.45 : 0.55)) continue;
        const deg = Math.floor(phrase() * 7), m = this.key + 24 + sc[deg % 5] + 12 * Math.floor(deg / 5);
        this.bell(hz(m), t + i * (4 * beat / slots), 0.07 * P.bell, S.bpm < 70 ? 3.2 : 1.6, now);
      }
    }
  }

  // ---- the instruments (a few nodes per note, made as notes are scheduled, about a bar ahead) ----
  env(g, t, a, peak, dur) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(0, t + Math.max(a, dur - a), dur * 0.18); }
  pad(ms, t, dur, vol, now) {
    if (t + dur < now) return;
    const s = Math.max(t, now), d = dur - (s - t), c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = "lowpass"; f.Q.value = 0.5; f.frequency.setValueAtTime(700, s); f.frequency.linearRampToValueAtTime(2000, s + d * 0.5); f.frequency.linearRampToValueAtTime(900, s + d);
    const a = Math.min(1.8, d * 0.3); g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.045 * vol, s + a); g.gain.setValueAtTime(0.045 * vol, s + Math.max(a, d - 1)); g.gain.linearRampToValueAtTime(0, s + d + 0.6);
    f.connect(g); g.connect(this.gain);
    for (const m of ms) for (const det of [-7, 6]) { const o = c.createOscillator(); o.type = det < 0 ? "sawtooth" : "triangle"; o.frequency.value = hz(m); o.detune.value = det; o.connect(f); o.start(s); o.stop(s + d + 0.8); }
  }
  pluck(fr, t, vol, now) {
    if (t < now) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = "triangle"; o.frequency.value = fr;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.setTargetAtTime(0, t + 0.01, 0.09);
    o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + 0.7);
  }
  bell(fr, t, vol, len, now) { // a soft FM bell, like a felt-hammer piano
    if (t < now) return;
    const c = this.ctx, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = fr; mod.frequency.value = fr * 3; mg.gain.setValueAtTime(fr * 1.6, t); mg.gain.setTargetAtTime(fr * 0.15, t, 0.2);
    mod.connect(mg); mg.connect(car.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.setTargetAtTime(0, t + 0.02, len / 4);
    car.connect(g); g.connect(this.gain); car.start(t); mod.start(t); car.stop(t + len + 0.3); mod.stop(t + len + 0.3);
  }
  bassNote(fr, t, len, vol, now) {
    if (t < now) return;
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g2 = c.createGain(), g = c.createGain();
    o.frequency.value = fr; o2.type = "triangle"; o2.frequency.value = fr * 2; g2.gain.value = 0.45; // the octave up carries it on a phone's speaker
    this.env(g, t, 0.02, 0.085 * vol, len);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.gain); o.start(t); o2.start(t); o.stop(t + len + 0.6); o2.stop(t + len + 0.6);
  }
  kick(t, vol, now) {
    if (t < now) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.17 * vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + 0.35);
  }
  hat(t, vol, now) {
    if (t < now) return;
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain();
    s.buffer = this.noise; s.playbackRate.value = 1 + (t * 13.7 % 1) * 0.1;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    s.connect(g); g.connect(this.hatF); s.start(t); s.stop(t + 0.08);
  }
}

// A track from a file: an <audio> element routed into the music bus (streamed, not decoded whole: phones).
class FileTrack {
  constructor(ctx, out, send, spec, base) {
    this.ctx = ctx; this.spec = spec;
    this.el = new Audio(); this.el.crossOrigin = "anonymous"; this.el.loop = true; this.el.preload = "auto"; this.el.src = base + spec.file;
    this.gain = ctx.createGain(); this.gain.gain.value = 0; this.gain.connect(out);
    ctx.createMediaElementSource(this.el).connect(this.gain);
  }
  start(at = 0) { const go = () => { try { this.el.currentTime = at; } catch { /* not seekable yet */ } this.el.play().catch(() => {}); }; if (this.el.readyState >= 1) go(); else this.el.addEventListener("loadedmetadata", go, { once: true }); this.playing = true; }
  position() { return this.el.currentTime || 0; }
  stop(when = this.ctx.currentTime) { this.playing = false; setTimeout(() => { this.el.pause(); this.gain.disconnect(); this.el.removeAttribute("src"); this.el.load(); }, Math.max(0, (when - this.ctx.currentTime) * 1000) + 200); }
}

export class Music {
  // mix: the mixer (engine.js makeMixer): plays into mix.music.input, sends to mix.reverb.
  constructor(ctx, mix, { base = "assets/audio/music/", timer = true } = {}) {
    this.ctx = ctx; this.mix = mix; this.base = base; this.timer = timer;
    this.list = []; this.now = null; this.mood = null; this.pinned = false; this.onchange = null;
  }
  async load(url = "assets/audio/music/manifest.json") {
    try { this.list = (await (await fetch(url)).json()).tracks || []; } catch { this.list = []; }
    return this.list;
  }
  tracks() { return this.list; }
  // The phase's mood: calm (lift top, hiking), lift, ski. Crossfades to a track of that mood, unless a
  // track was asked for by name (play), which keeps playing until follow().
  setMood(mood, fade = 4) {
    if (mood === this.mood) return;
    this.mood = mood;
    if (this.pinned) return;
    const pick = this.pickFor(mood);
    if (pick && pick.id !== this.now?.spec.id) this._switch(pick, 0, fade);
  }
  // Another track of the same mood (the sound panel's "next").
  next() {
    const mood = this.now?.spec.mood || this.mood, ok = this.list.filter((x) => x.mood === mood);
    const i = ok.findIndex((x) => x.id === this.now?.spec.id), pick = ok[(i + 1) % ok.length];
    if (pick && pick.id !== this.now?.spec.id) this._switch(pick, 0, 2);
  }
  pickFor(mood) { const ok = this.list.filter((x) => x.mood === mood); return ok[Math.floor(Math.random() * ok.length)] || this.list[0]; }
  // Play a track by its id from a second into it (for "listen together": the same on every phone).
  play(trackId, atSeconds = 0, fade = 2) {
    const spec = this.list.find((x) => x.id === trackId);
    if (!spec) return false;
    this.pinned = true; this._switch(spec, atSeconds, fade); return true;
  }
  follow() { this.pinned = false; const m = this.mood; this.mood = null; if (m) this.setMood(m); }
  current() {
    const n = this.now; if (!n) return null;
    const { id, title, artist, licence, source, mood } = n.spec;
    return { id, title, artist, licence, source, mood, at: +n.position().toFixed(2), pinned: this.pinned };
  }
  stop(fade = 1.5) { if (this.now) this._fadeOut(this.now, fade); this.now = null; }
  pump(until) { this.now?.pump?.(until); this.old?.pump?.(until); } // offline renders: schedule up to `until`

  _switch(spec, at, fade, when = this.ctx.currentTime) {
    const T = spec.file ? FileTrack : GenTrack;
    let tr;
    try { tr = new T(this.ctx, this.mix.music.input, this.mix.reverb, spec, this.base); } catch { return; }
    if (this.now) this._fadeOut(this.now, fade, when);
    tr.start(at, when, this.timer);
    tr.gain.gain.setValueAtTime(0, when); tr.gain.gain.linearRampToValueAtTime(spec.gain ?? 1, when + fade);
    this.now = tr; this.onchange?.(this.current());
  }
  _fadeOut(tr, fade, when = this.ctx.currentTime) {
    this.old = tr;
    tr.gain.gain.cancelScheduledValues(when); tr.gain.gain.setValueAtTime(tr.gain.gain.value, when); tr.gain.gain.linearRampToValueAtTime(0, when + fade);
    if (this.timer) setTimeout(() => tr.stop(when + fade), fade * 1000 + 100); else tr.playing = true; // offline: keep scheduling through the fade
  }
}
