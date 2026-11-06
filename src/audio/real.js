// Real recordings in the ride (the owner's picks in the sound lab; assets/audio/game/manifest.json):
// - board: a snowboard run (Nox_Sound) under the synth board, cut into short stretches of carving or
//   slowing, crossfaded one into the next, as loud as the carve or the skid is hard;
// - passby: another rider passing close (cribbler), now and then, from one side to the other;
// - station: a lift station (SoundsLikeYukon) at the bottom and at the top;
// - slope: a quiet ski slope (xkeril), the mountain's bed at the top and under the ride down.
// Buffers are decoded once (about 2.5 MB of PCM in all); a stretch or a pass-by is one source and one
// gain, made when it starts (every couple of seconds at most).

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export async function loadReal(ctx, base = "assets/audio/game/") {
  const { items } = await (await fetch(`${base}manifest.json`)).json();
  const out = { items };
  await Promise.all(items.map(async (it) => {
    const data = await (await fetch(base + it.file)).arrayBuffer();
    out[it.id] = { ...it, buffer: await new Promise((res, rej) => ctx.decodeAudioData(data, res, rej)) };
  }));
  return out;
}

// What the real board layer should do for this moment of riding: which kind of stretch, how loud, how
// fast. Pure (tested). r: the Rider; air: off the snow.
export function realBoardMix({ speed = 0, lean = 0, skid = 0 }, air = false) {
  const v = Math.max(0, speed), s = clamp(v / 15, 0, 1.3), edge = clamp(Math.abs(lean) / 0.75);
  const turn = s ** 1.1 * (0.35 + 0.65 * edge), slow = clamp(skid) * clamp(v / 4) ** 0.8;
  const on = air || v < 0.5 ? 0 : 1;
  return { kind: slow > 0.25 && slow >= turn * 0.6 ? "slow" : "turn", g: on * 1.0 * Math.max(turn, slow * 1.1), rate: 0.9 + 0.15 * Math.min(s, 1) };
}

export class RealSounds {
  constructor(ctx, { sfx, ambience }, R) {
    this.ctx = ctx; this.R = R;
    const gain = (to, v = 0) => { const g = ctx.createGain(); g.gain.value = v; g.connect(to); return g; };
    this.boardG = gain(sfx); this.passG = gain(sfx, 1); this.stationG = gain(ambience); this.slopeG = gain(ambience);
    const loop = (it, to) => { if (!it) return; const s = ctx.createBufferSource(); s.buffer = it.buffer; s.loop = true; s.loopStart = 0; s.connect(to); s.start(ctx.currentTime, Math.random() * it.buffer.duration * 0.9); };
    loop(R.station, this.stationG); loop(R.slope, this.slopeG);
    this.next = 0; this.kind = null; this.cur = null; this.passAt = 8 + Math.random() * 12; this.last = {};
  }
  _to(key, param, v, t, tc) {
    const was = this.last[key];
    if (was !== undefined && Math.abs(v - was) <= Math.max(1e-4, Math.abs(was) * 0.02)) return;
    this.last[key] = v; param.setTargetAtTime(v, t, tc);
  }
  // Every frame on the snow (or with r = null off it).
  board(r, air, t) {
    const B = this.R["board-run"]; if (!B) return;
    const m = r ? realBoardMix(r, air) : { g: 0, kind: "turn", rate: 1 };
    this._to("bg", this.boardG.gain, m.g, t, air ? 0.04 : 0.12);
    if (m.g < 0.01) return;
    // The next stretch: when this one is about to end, or right away when turning becomes slowing.
    if (t >= this.next - 0.3 || (m.kind !== this.kind && m.kind === "slow")) this._stretch(B, m, t);
  }
  _stretch(B, m, t) {
    const segs = B.segments.filter((q) => q.kind === m.kind), seg = segs[Math.floor(Math.random() * segs.length)] || B.segments[0];
    const len = Math.min(seg.to - seg.from, 1.6 + Math.random() * 1.6), at = seg.from + Math.random() * (seg.to - seg.from - len);
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), x = 0.3, dur = len / m.rate;
    s.buffer = B.buffer; s.playbackRate.value = m.rate;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + x); g.gain.setValueAtTime(1, t + Math.max(x, dur - x)); g.gain.linearRampToValueAtTime(0, t + dur);
    if (this.cur && t < this.next) { this.cur.g.gain.cancelScheduledValues(t); this.cur.g.gain.setValueAtTime(this.cur.g.gain.value, t); this.cur.g.gain.linearRampToValueAtTime(0, t + x); }
    s.connect(g); g.connect(this.boardG); s.start(t, at, len + 0.05); s.onended = () => g.disconnect();
    this.cur = { g }; this.kind = m.kind; this.next = t + dur;
  }
  // Someone else passing close, now and then: from one side across to the other.
  // often: how likely (0 none .. 1 the ride down), vol: how close.
  passby(dt, t, often, vol) {
    const P = this.R.passby; if (!P || often <= 0) return;
    this.passAt -= dt * often;
    if (this.passAt > 0) return;
    this.passAt = 25 + Math.random() * 35;
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), pan = this.ctx.createStereoPanner(), side = Math.random() < 0.5 ? -1 : 1, d = P.buffer.duration;
    s.buffer = P.buffer; s.playbackRate.value = 0.94 + Math.random() * 0.12; g.gain.value = vol * (0.7 + Math.random() * 0.3);
    pan.pan.setValueAtTime(side * 0.85, t); pan.pan.linearRampToValueAtTime(-side * 0.6, t + d * 0.8);
    s.connect(g); g.connect(pan); pan.connect(this.passG); s.start(t);
    s.onended = () => { g.disconnect(); pan.disconnect(); };
  }
  beds(station, slope, t) { this._to("st", this.stationG.gain, 0.8 * station, t, 0.6); this._to("sl", this.slopeG.gain, 0.6 * slope, t, 0.8); }
}
