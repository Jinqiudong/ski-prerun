// The board in the snow, driven every frame by the physics (board.js Rider):
// - glide: the base running flat, a soft low "whsss" that grows and brightens with speed;
// - carve: the edge cutting a clean line, a hiss rising in loudness and pitch with speed and edge angle;
// - scrape: a skid (braking, pace −1), the edge scraping sideways, a gritty "shhhk" that dies as you stop;
// - rumble: the board's body and chatter, low, with speed (more in a skid and on ice);
// - crunches when pushing or walking, a thump on landing; in the air the snow goes quiet.
// The snow under you (groomed, powder, ice) changes how bright, loud and gritty each layer is.
// Nodes are made once; each update only moves a dozen params (and only when they change).
import { snowTexture, scrapeTexture, brown, crunch, thump } from "./buffers.js?v=1";

export const SURFACES = {
  //        loudness of each layer                          brightness  chatter
  groomed: { glide: 1, carve: 1, scrape: 1, rumble: 1, bright: 1, chatter: 0.15, crunch: 1 },
  powder: { glide: 1.25, carve: 0.45, scrape: 0.55, rumble: 1.5, bright: 0.55, chatter: 0, crunch: 0.6 },
  ice: { glide: 0.8, carve: 1.25, scrape: 1.15, rumble: 1.2, bright: 1.45, chatter: 0.6, crunch: 1.3 },
};
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// What each layer should do for one moment of riding. Pure (tested): state from the Rider plus
// { air, surface }. Gains are linear, frequencies in Hz.
export function boardMix({ speed = 0, lean = 0, skid = 0, tuck = 0, air = false, surface = "groomed" }) {
  const S = SURFACES[surface] || SURFACES.groomed, v = Math.max(0, speed);
  const s = clamp(v / 15, 0, 1.7), moving = clamp((v - 0.3) / 1.2);
  const edge = clamp(Math.abs(lean) / 0.75), k = clamp(skid), on = air ? 0 : moving;
  return {
    glide: { g: on * 0.2 * s ** 1.1 * (1 - 0.55 * edge) * (1 - 0.5 * k) * (1 - 0.25 * tuck) * S.glide, f: (450 + 110 * v) * S.bright },
    carve: { g: on * 1.25 * (0.12 + edge) ** 1.3 * s ** 1.5 * (1 - 0.75 * k) * S.carve, f: (850 + 75 * v + 1150 * edge) * S.bright },
    scrape: { g: on * 0.45 * k ** 0.85 * clamp(v / 2.5) ** 0.5 * S.scrape, f: (520 + 85 * v) * S.bright, rate: 0.72 + 0.035 * Math.min(v, 15) * Math.sqrt(S.bright) },
    rumble: { g: on * 0.11 * Math.min(1.2, s) * (0.35 + 0.8 * k + 0.35 * edge) * S.rumble, f: 110 + 14 * v },
    rate: 0.78 + 0.032 * Math.min(v, 16), // the snow texture plays faster with speed
    chatter: on * S.chatter * k * clamp(v / 6),
  };
}

export class BoardSound {
  constructor(ctx, out) {
    this.ctx = ctx; this.sr = ctx.sampleRate; this.surface = "groomed";
    const buf = (x) => { const b = ctx.createBuffer(1, x.length, this.sr); b.copyToChannel(x, 0); return b; };
    const loop = (b, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.playbackRate.value = rate; return s; };
    const filt = (type, f, q) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
    const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    // Everything through one gentle lowpass: snow is soft, it never fizzes like a radio.
    this.out = gain(1); const soft = filt("lowpass", 6500, 0.5); this.out.connect(soft); soft.connect(out);
    // One textured noise feeds glide and carve (the same snow, heard two ways).
    this.tex = loop(buf(snowTexture(this.sr)));
    this.glideF = filt("lowpass", 800, 0.6); this.glideG = gain();
    this.carveF = filt("bandpass", 2500, 0.6); this.carveG = gain();
    this.tex.connect(this.glideF); this.glideF.connect(this.glideG); this.glideG.connect(this.out);
    this.tex.connect(this.carveF); this.carveF.connect(this.carveG); this.carveG.connect(this.out);
    this.scr = loop(buf(scrapeTexture(this.sr)));
    this.scrapeF = filt("bandpass", 1000, 0.55); this.scrapeG = gain();
    this.scr.connect(this.scrapeF); this.scrapeF.connect(this.scrapeG); this.scrapeG.connect(this.out);
    // Chatter: the edge skipping on hard snow, a fast wobble on the scrape's loudness.
    this.lfo = ctx.createOscillator(); this.lfo.frequency.value = 23; this.lfoG = gain();
    this.lfo.connect(this.lfoG); this.lfoG.connect(this.scrapeG.gain);
    this.rum = loop(buf(brown(this.sr, 2.5)));
    this.rumbleF = filt("lowpass", 160, 0.9); this.rumbleG = gain();
    this.rum.connect(this.rumbleF); this.rumbleF.connect(this.rumbleG); this.rumbleG.connect(this.out);
    for (const s of [this.tex, this.scr, this.rum, this.lfo]) s.start();
    this.crunches = [0, 1, 2, 3].map((i) => buf(crunch(this.sr, i)));
    this.thumpB = buf(thump(this.sr));
    this.last = {}; this.wasAir = false; this.airPeak = 0; this.stepT = 0; this.stepK = 0;
  }

  setSurface(name) { if (SURFACES[name]) this.surface = name; }

  // A param to a target, only if it moved enough to hear (keeps the work per frame small).
  _to(key, param, v, t, tc) {
    const was = this.last[key];
    if (was !== undefined && Math.abs(v - was) <= Math.max(1e-4, Math.abs(was) * 0.02)) return;
    this.last[key] = v; param.setTargetAtTime(v, t, tc);
  }

  // r: the Rider (speed, lean, skid, tuck, pushing, walking); air: off the snow (a trick's hop), with its
  // height in metres; dt: seconds since the last update; t: when (default now; given for offline renders).
  update(r, { air = 0, dt = 1 / 60, t = this.ctx.currentTime } = {}) {
    const m = boardMix({ ...r, air: air > 0.08, surface: this.surface });
    const fast = air > 0.08 ? 0.03 : 0.06; // into the air the snow cuts off quickly
    this._to("gg", this.glideG.gain, m.glide.g, t, fast); this._to("gf", this.glideF.frequency, m.glide.f, t, 0.12);
    this._to("cg", this.carveG.gain, m.carve.g, t, fast); this._to("cf", this.carveF.frequency, m.carve.f, t, 0.1);
    this._to("sg", this.scrapeG.gain, m.scrape.g, t, m.scrape.g > (this.last.sg || 0) ? 0.035 : 0.09); // a skid bites fast, lets go a little slower
    this._to("sf", this.scrapeF.frequency, m.scrape.f, t, 0.08); this._to("sr", this.scr.playbackRate, m.scrape.rate, t, 0.1);
    this._to("rg", this.rumbleG.gain, m.rumble.g, t, fast); this._to("rf", this.rumbleF.frequency, m.rumble.f, t, 0.2);
    this._to("tr", this.tex.playbackRate, m.rate, t, 0.2);
    this._to("ch", this.lfoG.gain, m.scrape.g * m.chatter, t, 0.08);
    // Landing: a thump as loud as the drop was high.
    if (air > 0.08) { this.airPeak = Math.max(this.airPeak, air); this.wasAir = true; }
    else if (this.wasAir) { this.wasAir = false; this.hit(this.thumpB, 0.35 + 0.65 * clamp(this.airPeak / 1.4), t, 0.9 + Math.random() * 0.15); this.airPeak = 0; }
    // Pushing (skating on a flat) or walking: a crunch each step.
    const stepping = !air && (r.pushing || r.walking);
    if (stepping) {
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = r.walking ? 0.52 + Math.random() * 0.06 : 0.78 + Math.random() * 0.12;
        const S = SURFACES[this.surface];
        this.hit(this.crunches[this.stepK++ % 4], (r.walking ? 0.5 : 0.35) * S.crunch, t, (0.9 + Math.random() * 0.2) * Math.sqrt(S.bright));
      }
    } else this.stepT = 0.1;
  }

  // A one-shot (a crunch or a thump): one source and one gain, made when it happens (a few a second at most).
  hit(buffer, vol, t = this.ctx.currentTime, rate = 1) {
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
    s.buffer = buffer; s.playbackRate.value = rate; g.gain.value = vol;
    s.connect(g); g.connect(this.out); s.start(t);
    s.onended = () => g.disconnect();
  }

  // Silence (leaving the snow for the lift or a menu), gently.
  hush(t = this.ctx.currentTime) {
    for (const [k, p] of [["gg", this.glideG.gain], ["cg", this.carveG.gain], ["sg", this.scrapeG.gain], ["rg", this.rumbleG.gain], ["ch", this.lfoG.gain]]) this._to(k, p, 0, t, 0.15);
    this.wasAir = false; this.airPeak = 0;
  }
}
