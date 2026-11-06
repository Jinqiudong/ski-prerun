// The page's one AudioContext and its mixer. Buses: sfx (the board, landings, the lift's clacks),
// ambience (wind, the mountain, the lift's hum), music, and voice (kept for voice chat between friends).
// sfx, ambience and music each pass through a duck gain, so voice can push them down: duck(amount, s).
// Phones only let sound start from a tap, so the context is resumed on the first touch, click or key.
// On / off and the volumes are kept on this phone (localStorage "prerunSound").

import { impulse } from "./buffers.js?v=1";

const KEY = "prerunSound";
const DEFAULTS = { on: true, music: 0.55, sfx: 0.9 };
const load = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { ...DEFAULTS }; } };
export const settings = load();

let A = null, mix = null;
const listeners = new Set();

// The bus graph on any context (an OfflineAudioContext too, for rendering tests to WAV files).
export function makeMixer(ctx) {
  const master = ctx.createGain(), limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -6; limit.knee.value = 6; limit.ratio.value = 8; limit.attack.value = 0.002; limit.release.value = 0.2;
  master.connect(limit); limit.connect(ctx.destination);
  const bus = (vol) => { const input = ctx.createGain(), duck = ctx.createGain(), level = ctx.createGain(); level.gain.value = vol; input.connect(duck); duck.connect(level); level.connect(master); return { input, duck, level }; };
  const m = { ctx, master, sfx: bus(1), ambience: bus(1), music: bus(1), voice: bus(1) };
  // One shared reverb (a valley's worth), fed by sends from music and ambience.
  m.reverb = ctx.createConvolver(); m.reverb.normalize = true;
  const ir = impulse(ctx.sampleRate), b = ctx.createBuffer(2, ir[0].length, ctx.sampleRate); b.copyToChannel(ir[0], 0); b.copyToChannel(ir[1], 1); m.reverb.buffer = b;
  m.reverbOut = ctx.createGain(); m.reverbOut.gain.value = 0.9; m.reverb.connect(m.reverbOut); m.reverbOut.connect(m.music.duck);
  return m;
}

export function context() { return A; }
export function mixer() { return mix; }

// Create the context (suspended until a tap on phones) and wire the buses. Safe to call more than once.
export function start() {
  if (A) return mix;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch { /* older Safari */ } // mix with the phone's own music; the silent switch mutes it
  A = new AC({ latencyHint: "interactive" });
  mix = makeMixer(A);
  apply(0);
  // Every tap tries until it is running (a tap that only scrolled may not count on iOS); then it costs nothing.
  const unlock = () => {
    if (!settings.on || A.state === "running" || document.hidden) return;
    A.resume().catch(() => {});
    // Old iOS: a silent buffer played inside the tap opens the output.
    const s = A.createBufferSource(); s.buffer = A.createBuffer(1, 1, A.sampleRate); s.connect(A.destination); s.start();
  };
  for (const ev of ["pointerdown", "touchend", "click", "keydown"]) addEventListener(ev, unlock, true);
  if (settings.on) A.resume().catch(() => {}); // desktops let it start by itself
  A.onstatechange = () => { for (const f of listeners) f(A.state); };
  // Quiet when the page is hidden (another app, the lock screen); back when it shows.
  document.addEventListener("visibilitychange", () => { if (document.hidden) A.suspend().catch(() => {}); else if (settings.on) A.resume().catch(() => {}); });
  return mix;
}

export const onState = (f) => { listeners.add(f); return () => listeners.delete(f); };

function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ } }
// Push the settings to the bus levels (a short glide, no clicks).
function apply(glide = 0.15) {
  if (!mix) return;
  const t = A.currentTime, on = settings.on ? 1 : 0;
  mix.master.gain.setTargetAtTime(on, t, glide || 0.001);
  mix.music.level.gain.setTargetAtTime(settings.music, t, glide || 0.001);
  mix.sfx.level.gain.setTargetAtTime(settings.sfx, t, glide || 0.001);
  mix.ambience.level.gain.setTargetAtTime(settings.sfx * 0.85, t, glide || 0.001);
}
export function set(patch) {
  Object.assign(settings, patch); save(); apply();
  if (A && "on" in patch) (settings.on ? A.resume() : A.suspend()).catch(() => {});
}

// Voice chat (later): duck(0.8) while someone talks pulls music down by 80 % and effects by a bit less;
// duck(0) brings them back. seconds: how long the move takes.
export function duck(amount = 0.7, seconds = 0.25) { duckMix(mix, amount, seconds); }
export function duckMix(m, amount, seconds = 0.25, at) {
  if (!m) return;
  const t = at ?? m.ctx.currentTime, a = Math.min(1, Math.max(0, amount)), tc = Math.max(0.01, seconds / 3);
  m.music.duck.gain.setTargetAtTime(1 - a, t, tc);
  m.sfx.duck.gain.setTargetAtTime(1 - a * 0.6, t, tc);
  m.ambience.duck.gain.setTargetAtTime(1 - a * 0.7, t, tc);
}
