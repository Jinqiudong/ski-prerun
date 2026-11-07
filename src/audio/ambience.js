// The air around you: wind (rising with speed, gusting on its own), the mountain's quiet bed, and the lift
// (the rope's hum, the ka-thunk of the grip rolling over each tower's sheaves, the station's machinery).
// Everything is built once; update() moves a few params a frame.
import { pink, brown, sheavePass, sheaveLead, clunk, rng } from "./buffers.js?v=4";

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export class Ambience {
  constructor(ctx, out, send, sfx) { // out: the ambience bus; send: the reverb; sfx: where tower passes and clunks go
    this.ctx = ctx; const sr = ctx.sampleRate;
    const buf = (x) => { const b = ctx.createBuffer(1, x.length, sr); b.copyToChannel(x, 0); return b; };
    const loop = (b, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.playbackRate.value = rate; s.start(); return s; };
    const filt = (type, f, q) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
    const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const chain = (...ns) => { for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]); return ns[ns.length - 1]; };
    this.out = gain(1); this.out.connect(out); this.fx = gain(1); this.fx.connect(sfx || out);
    if (send) { this.send = gain(0.25); this.out.connect(this.send); this.send.connect(send); }
    const air = buf(pink(sr, 4, 41)), low = buf(brown(sr, 4, 43));
    // Wind: a low buffeting at the ears and a thin whistle over it.
    this.windLoF = filt("lowpass", 380, 0.7); this.windLoG = gain();
    chain(loop(air, 0.9), this.windLoF, this.windLoG, this.out);
    this.windHiF = filt("bandpass", 1200, 3.5); this.windHiG = gain();
    chain(loop(air, 1.07), this.windHiF, this.windHiG, this.out);
    // The mountain's bed: far-off air in the valley, very low and very quiet.
    this.bedG = gain(); chain(loop(air, 0.75), filt("bandpass", 700, 0.5), this.bedG, this.out);
    // The lift's rope hum: a low drone (the rope singing over the sheaves) and a soft whirr.
    this.humG = gain(); const humF = filt("lowpass", 420, 0.8);
    for (const [f, v] of [[98, 0.5], [147, 0.25], [196, 0.12]]) { const o = ctx.createOscillator(), g = gain(v); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = (f % 7) * 3; chain(o, g, humF); o.start(); }
    const whirrF = filt("bandpass", 520, 4), whirrG = gain(0.5); chain(loop(low, 1.3), whirrF, whirrG, humF);
    chain(humF, this.humG, this.out);
    // The station: the bullwheel's rumble and the gearbox's faint whine.
    this.stationG = gain(); const stF = filt("bandpass", 260, 0.8);
    chain(loop(low, 0.6), stF, this.stationG, this.out);
    const whine = ctx.createOscillator(), wg = gain(0.012); whine.type = "triangle"; whine.frequency.value = 415; chain(whine, wg, this.stationG); whine.start();
    const drone = ctx.createOscillator(), dg = gain(0.05); drone.type = "triangle"; drone.frequency.value = 110; chain(drone, dg, this.stationG); drone.start();
    // Tower passes at three tempos (the ride's ×1, ×2, ×4), 8 wheels each: [buffer, seconds to the tower].
    this.passes = [0.15, 0.115, 0.09].map((gap, k) => [buf(sheavePass(sr, 8, gap, 5 + k)), sheaveLead(8, gap)]);
    this.clunkB = buf(clunk(sr));
    this.r = rng(77); this.gust = 0.5; this.gustTo = 0.5; this.gustT = 0; this.clunkT = 3; this.k = 0; this.last = {};
  }

  _to(key, param, v, t, tc) {
    const was = this.last[key];
    if (was !== undefined && Math.abs(v - was) <= Math.max(1e-4, Math.abs(was) * 0.02)) return;
    this.last[key] = v; param.setTargetAtTime(v, t, tc);
  }

  // s: { wind 0..1+ (how hard the air moves past you), bed 0..1, hum 0..1, station 0..1 }.
  update({ wind = 0, bed = 0, hum = 0, station = 0, shelter = 0 }, dt = 1 / 60, t = this.ctx.currentTime) {
    // Gusts: a slow random walk the wind follows.
    this.gustT -= dt;
    if (this.gustT <= 0) { this.gustT = 1.5 + this.r() * 3.5; this.gustTo = 0.25 + this.r() * 0.9; }
    this.gust += (this.gustTo - this.gust) * Math.min(1, dt * 0.8);
    const w = clamp(wind, 0, 1.4), open = 1 - 0.6 * shelter; // a bubble pulled down keeps most of the wind off
    this._to("wl", this.windLoG.gain, (0.03 + 0.2 * w * w) * (0.6 + 0.6 * this.gust) * open, t, 0.25);
    this._to("wlf", this.windLoF.frequency, (420 + 700 * w + 200 * this.gust) * (1 - 0.4 * shelter), t, 0.3);
    this._to("wh", this.windHiG.gain, (0.004 + 0.05 * w * w) * this.gust ** 1.5 * open, t, 0.35);
    this._to("whf", this.windHiF.frequency, 900 + 900 * w + 500 * this.gust, t, 0.5);
    this._to("bed", this.bedG.gain, 0.035 * bed * (0.7 + 0.4 * this.gust), t, 0.6);
    this._to("hum", this.humG.gain, 0.05 * hum, t, 0.5);
    this._to("st", this.stationG.gain, 0.3 * station, t, 0.5);
    // A chair clunking through the station now and then, when you're close to it.
    if (station > 0.25) { this.clunkT -= dt; if (this.clunkT <= 0) { this.clunkT = 5 + this.r() * 3; this.hit(this.clunkB, 0.35 * station, t, 0.9 + this.r() * 0.2); } }
  }

  // The chair over a tower. rate: how fast the ride plays (×1, ×2, ×4 roll over the wheels faster).
  // Start it towerLead(rate) seconds before the chair reaches the tower, so the middle wheel lands on it.
  passFor(rate = 1) { return this.passes[rate >= 3 ? 2 : rate >= 1.5 ? 1 : 0]; }
  towerLead(rate = 1) { return this.passFor(rate)[1]; }
  tower(vol = 1, rate = 1, t = this.ctx.currentTime) { this.hit(this.passFor(rate)[0], 0.6 * vol, t, 0.97 + this.r() * 0.06); }

  hit(buffer, vol, t = this.ctx.currentTime, rate = 1) {
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
    s.buffer = buffer; s.playbackRate.value = rate; g.gain.value = vol;
    s.connect(g); g.connect(this.fx); s.start(t);
    s.onended = () => g.disconnect();
  }
}
