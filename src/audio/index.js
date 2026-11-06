// The ride's sound, as the ride (src/ride/ride.js) uses it: one RideSound with a call per frame for the
// phase you're in. Also the music's "listen together" hooks (play, current) and duck() for voice chat.
import { start, settings, set, duck, onState, context } from "./engine.js?v=1";
import { BoardSound } from "./snow.js?v=1";
import { Ambience } from "./ambience.js?v=1";
import { Music } from "./music.js?v=1";

export { settings, set, duck, onState, context };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const MOOD = { lift: "lift", top: "calm", hike: "calm", ski: "ski" };

export class RideSound {
  // mix: engine.js makeMixer(ctx). timer: false for offline renders (then call music.pump yourself).
  // Nothing is built or played until the context runs (the first tap on a phone): before that each call
  // only keeps track of where you are.
  constructor(ctx, mix, { timer = true } = {}) {
    this.ctx = ctx; this.mix = mix; this.offline = typeof ctx.startRendering === "function";
    this.music = new Music(ctx, mix, { timer });
    this.board = this.amb = null; this.surface = "groomed";
    this.phase = null; this.prevD = null; this.towerAt = -1;
  }
  get live() {
    if (this.board) return true;
    if (!this.offline && this.ctx.state !== "running") return false;
    this.board = new BoardSound(this.ctx, this.mix.sfx.input); this.board.setSurface(this.surface);
    this.amb = new Ambience(this.ctx, this.mix.ambience.input, this.mix.reverb, this.mix.sfx.input);
    if (this.phase && this.music.list.length) this.music.setMood(MOOD[this.phase] || "calm");
    return true;
  }
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
    if (p != null && d > p && d - p < 40 && t - this.towerAt > 0.35) // rolled over a tower (not a jump along the line)
      for (const tw of towers) if (!tw.station && tw.s > p && tw.s <= d) { this.amb.tower(1, rate, t); this.towerAt = t; break; }
    const end = Math.min(d, total - d);
    this.amb.update({ wind: 0.32 + 0.06 * Math.min(rate, 4), bed: 0.45, hum: 1, station: clamp(1 - (end - 10) / 70), shelter }, dt, t);
  }
  // At the top, choosing (and getting off): the station behind you, the mountain's quiet.
  top({ station = 0.3, dt = 1 / 60, t = this.ctx.currentTime } = {}) {
    this.setPhase("top"); this.prevD = null;
    if (this.live) this.amb.update({ wind: 0.12, bed: 1, hum: 0.3 * station, station }, dt, t);
  }
  hike({ dt = 1 / 60, t = this.ctx.currentTime } = {}) {
    this.setPhase("hike");
    if (this.live) this.amb.update({ wind: 0.3, bed: 1 }, dt, t);
  }
  // Skiing, every frame: r is the board.js Rider; air: metres off the snow (a trick's hop); station:
  // 0..1 how close the top station still is; paused: the map is open, nothing moves.
  ski(r, { air = 0, station = 0, paused = false, dt = 1 / 60, t = this.ctx.currentTime } = {}) {
    this.setPhase("ski"); this.prevD = null;
    if (!this.live) return;
    if (paused || !r) { this.board.hush(t); this.amb.update({ wind: 0.1, bed: 0.8, station }, dt, t); return; }
    this.board.update(r, { air, dt, t });
    const v = r.speed || 0;
    this.amb.update({ wind: (v / 15) * (1 + 0.15 * (r.tuck || 0)), bed: 0.35, hum: 0.3 * station, station }, dt, t);
  }
  bump(vol = 0.8) { if (this.live) this.board.hit(this.board.thumpB, vol, this.ctx.currentTime, 0.8); } // into a tree
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
