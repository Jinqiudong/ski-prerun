// The ride's sound, as the ride (src/ride/ride.js) uses it: one RideSound with a call per frame for the
// phase you're in. Also the music's "listen together" hooks (play, current) and duck() for voice chat.
import { start, settings, set, duck, onState, context } from "./engine.js?v=5";
import { BoardSound } from "./snow.js?v=4";
import { Ambience } from "./ambience.js?v=4";
import { Music } from "./music.js?v=2";
import { loadReal, RealSounds } from "./real.js?v=1";

export { settings, set, duck, onState, context };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const MOOD = { lift: "lift", top: "calm", hike: "calm", ski: "ski" };

// The tower the chair is about to pass, if this frame is when its sound should start: `lead` seconds before
// the chair reaches it (so the middle sheave lands on the tower). prev, d: metres along the line last frame
// and now; towers: ride.js liftLine towers (stations and terminals, which have h, don't count). Nothing
// when the line jumped (dragging, skipping) or runs faster than a fast-forward (over 70 m/s).
export function towerDue(prev, d, dt, towers, lead) {
  if (prev == null || !(d > prev) || dt <= 0) return null;
  const v = (d - prev) / dt;
  if (d - prev > 40 || v > 70) return null;
  const ahead = v * lead;
  return towers.find((tw) => !tw.station && tw.h == null && tw.s - ahead > prev && tw.s - ahead <= d) || null;
}

export class RideSound {
  // mix: engine.js makeMixer(ctx). timer: false for offline renders (then call music.pump yourself).
  // Nothing is built or played until the context runs (the first tap on a phone): before that each call
  // only keeps track of where you are.
  constructor(ctx, mix, { timer = true } = {}) {
    this.ctx = ctx; this.mix = mix; this.offline = typeof ctx.startRendering === "function";
    this.music = new Music(ctx, mix, { timer });
    this.board = this.amb = this.real = null; this.surface = "groomed";
    this.phase = null; this.prevD = null; this.towerAt = -1;
  }
  get live() {
    if (this.board) return true;
    if (!this.offline && this.ctx.state !== "running") return false;
    this.board = new BoardSound(this.ctx, this.mix.sfx.input); this.board.setSurface(this.surface);
    this.amb = new Ambience(this.ctx, this.mix.ambience.input, this.mix.reverb, this.mix.sfx.input);
    if (!this.offline) this.loadReal().catch(() => {}); // the real recordings join when they have loaded
    if (this.phase && this.music.list.length) this.music.setMood(MOOD[this.phase] || "calm");
    return true;
  }
  // The real recordings (real.js): the board's layer, riders passing, the stations, the slope's bed.
  async loadReal(base) { this.realP ||= loadReal(this.ctx, base).then((R) => (this.real = new RealSounds(this.ctx, { sfx: this.mix.sfx.input, ambience: this.mix.ambience.input }, R))); return this.realP; }
  // Real beds and pass-bys, every frame: station 0..1 (how near a station), slope 0..1 (the mountain's
  // bed), pass: how often riders pass (0 none), passVol: how close.
  _real(dt, t, { station = 0, slope = 0, pass = 0, passVol = 0.5 }) { if (!this.real) return; this.real.beds(station, slope, t); this.real.passby(dt, t, pass, passVol); }
  async loadMusic(url) { await this.music.load(url); if (this.phase && this.board) this.music.setMood(MOOD[this.phase] || "calm"); }
  setPhase(p) {
    if (p === this.phase) return;
    this.phase = p;
    if (!this.board) return;
    if (p !== "ski") this.board.hush();
    if (this.music.list.length) this.music.setMood(MOOD[p] || "calm");
  }
  setSurface(s) { this.surface = s; this.board?.setSurface(s); }

  // On the chair. d: metres along the line; towers: [{ s, station }] (ride.js liftLine); rate: how fast
  // the ride is played (×1 is the time-lapse); shelter: 0..1, the bubble pulled down.
  lift({ d, total, towers, rate = 1, shelter = 0, dt = 1 / 60, t = this.ctx.currentTime }) {
    this.setPhase("lift");
    const p = this.prevD; this.prevD = d;
    if (!this.live) return;
    // A tower coming: start its sheave train a moment early (never more than one every 1.2 s).
    if (t - this.towerAt > 1.2 && towerDue(p, d, dt, towers, this.amb.towerLead(rate))) { this.amb.tower(1, rate, t); this.towerAt = t; }
    const end = Math.min(d, total - d);
    const station = clamp(1 - (end - 10) / 70); // loading at the bottom, the first seconds of the ride; arriving at the top
    this.amb.update({ wind: 0.32 + 0.06 * Math.min(rate, 4), bed: 0, hum: 1, station, shelter }, dt, t);
    this._real(dt, t, { station, slope: 0.2 });
  }
  // At the top, choosing (and getting off): the station behind you, the mountain's quiet.
  top({ station = 0.3, dt = 1 / 60, t = this.ctx.currentTime } = {}) {
    this.setPhase("top"); this.prevD = null;
    if (!this.live) return;
    this.amb.update({ wind: 0.12, bed: 0, hum: 0.3 * station, station }, dt, t);
    this.real?.board(null, false, t);
    this._real(dt, t, { station, slope: 1, pass: 0.6, passVol: 0.3 });
  }
  hike({ dt = 1 / 60, t = this.ctx.currentTime } = {}) {
    this.setPhase("hike");
    if (!this.live) return;
    this.amb.update({ wind: 0.3, bed: 0 }, dt, t);
    this._real(dt, t, { slope: 0.8 });
  }
  // Skiing, every frame: r is the board.js Rider; air: metres off the snow (a trick's hop); station:
  // 0..1 how close the top station still is; paused: the map is open, nothing moves.
  ski(r, { air = 0, station = 0, paused = false, dt = 1 / 60, t = this.ctx.currentTime } = {}) {
    this.setPhase("ski"); this.prevD = null;
    if (!this.live) return;
    if (paused || !r) { this.board.hush(t); this.real?.board(null, false, t); this.amb.update({ wind: 0.1, bed: 0, station }, dt, t); this._real(dt, t, { station, slope: 0.8 }); return; }
    this.board.update(r, { air, dt, t });
    this.real?.board(r, air > 0.08, t); // the real snow under the synth
    const v = r.speed || 0;
    this.amb.update({ wind: (v / 15) * (1 + 0.15 * (r.tuck || 0)), bed: 0, hum: 0.3 * station, station }, dt, t);
    this._real(dt, t, { station, slope: 0.35, pass: v > 2 ? 1 : 0, passVol: 0.55 }); // riders passing now and then
  }
  bump(vol = 0.8) { if (this.live) this.board.hit(this.board.thumpB, vol, this.ctx.currentTime, 0.8); } // into a tree
  // A crash into a tree: the body's thump, then the snow coming off its branches, a big flump and a smaller
  // one after it.
  crash(vol = 0.8, t = this.ctx.currentTime) {
    if (!this.live) return;
    const b = this.board;
    b.hit(b.thumpB, vol, t, 0.72);
    b.hit(b.flumpB, 0.55 + 0.35 * vol, t + 0.22, 0.95 + Math.random() * 0.1);
    b.hit(b.flumpB, 0.3 + 0.2 * vol, t + 0.62, 1.15 + Math.random() * 0.1);
  }
}

// The page's ride sound (one per page), made on first use. Null where there is no WebAudio.
let R = null;
export function rideSound() {
  if (R) return R;
  const mix = start(); if (!mix) return null;
  R = new RideSound(mix.ctx, mix);
  R.ready = R.loadMusic();
  return R;
}

// "Listen together": every friend's phone can be told to play track X from second Y, and asked what it
// is playing. play() keeps that track until follow() hands the choice back to the phase's mood.
export const play = (trackId, atSeconds = 0) => !!R?.music.play(trackId, atSeconds);
export const current = () => R?.music.current() ?? null;
export const follow = () => R?.music.follow();
