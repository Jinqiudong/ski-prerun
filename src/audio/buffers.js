// Sound material made from numbers (no files): textured noise for the snow, grit for a skid, crunches for
// a step, a landing thump, the chair rolling over a tower's sheaves, a station clunk and a reverb tail.
// Pure functions: Float32Arrays at a sample rate, seeded so every phone (and the tests) makes the same ones.

export function rng(seed = 1) { // mulberry32
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// A two-pole filter (RBJ cookbook), run over samples in place. type: lowpass, highpass, bandpass.
export function biquad(x, sr, type, f, q = 0.707) {
  const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === "lowpass") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
  else if (type === "highpass") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; } // bandpass, 0 dB peak
  const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}

const normalize = (x, peak = 0.9) => { let m = 1e-9; for (const v of x) m = Math.max(m, Math.abs(v)); for (let i = 0; i < x.length; i++) x[i] *= peak / m; return x; };
const rms = (x) => { let s = 0; for (const v of x) s += v * v; return Math.sqrt(s / x.length); };
const toRms = (x, r = 0.25) => { const k = r / (rms(x) || 1); for (let i = 0; i < x.length; i++) x[i] *= k; return x; };

// Make a buffer loop without a click: the extra tail is faded onto the head.
function seamless(x, fade) {
  const n = x.length - fade, out = new Float32Array(n);
  out.set(x.subarray(0, n));
  for (let i = 0; i < fade; i++) { const u = i / fade; out[i] = x[i] * Math.sqrt(u) + x[n + i] * Math.sqrt(1 - u); }
  return out;
}

// Pink-ish noise (Paul Kellet's filter): the base of most of the snow.
export function pink(sr, secs, seed = 1) {
  const r = rng(seed), n = Math.floor(sr * secs), x = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return x;
}

export function brown(sr, secs, seed = 2) {
  const r = rng(seed), n = Math.floor(sr * secs), x = new Float32Array(n);
  let b = 0; for (let i = 0; i < n; i++) { b = (b + (r() * 2 - 1) * 0.02) * 0.998; x[i] = b; }
  return normalize(biquad(x, sr, "highpass", 20), 0.8);
}

// A smooth random curve: values at `rate` points a second, eased between (for slow swells and textures).
function wobble(r, n, sr, rate, lo, hi) {
  const out = new Float32Array(n), step = Math.max(1, Math.floor(sr / rate));
  let a = lo + (hi - lo) * r(), b = lo + (hi - lo) * r();
  for (let i = 0; i < n; i++) {
    const k = (i % step) / step;
    if (i > 0 && i % step === 0) { a = b; b = lo + (hi - lo) * r(); }
    out[i] = a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * k));
  }
  return out;
}

// The board pressing through snow: pink noise, its fizz taken off, whose loudness breathes smoothly
// (snow is never one surface: softer and firmer patches, the board's flex). No clicks, no ticks: on a
// phone's speaker any sharp grain reads as crackle. Played faster with speed, it breathes faster.
export function snowTexture(sr, secs = 3, seed = 11) {
  const r = rng(seed), fade = Math.floor(sr * 0.25), n = Math.floor(sr * secs) + fade;
  const x = biquad(pink(sr, n / sr, seed), sr, "lowpass", 5000, 0.5), slow = wobble(r, n, sr, 1.5, 0.75, 1.15), mid = wobble(r, n, sr, 6, 0.86, 1.12);
  for (let i = 0; i < n; i++) x[i] *= slow[i] * mid[i];
  return toRms(seamless(x, fade), 0.22);
}

// A skid or a slash: the board's edge pushed sideways through soft snow, shedding it in a spray. Deep and
// smooth: darker pink noise with a heavy, slow-swelling body under it and soft surges as snow is thrown
// off (a few a second); nothing gritty.
export function sprayTexture(sr, secs = 3, seed = 23) {
  const r = rng(seed), fade = Math.floor(sr * 0.25), n = Math.floor(sr * secs) + fade;
  const x = biquad(pink(sr, n / sr, seed + 1), sr, "lowpass", 3200, 0.5), body = biquad(brown(sr, n / sr, seed + 2), sr, "lowpass", 600, 0.6);
  const surge = wobble(r, n, sr, 4.5, 0.6, 1.25), slow = wobble(r, n, sr, 1.2, 0.8, 1.15);
  for (let i = 0; i < n; i++) x[i] = (x[i] + body[i] * 0.5) * surge[i] * slow[i];
  return toRms(seamless(x, fade), 0.22);
}

// One crunch of a boot or the free foot pushing: a short packed squeak-crunch, its grains bunched at
// the start and thinning out. variant picks one of a few.
export function crunch(sr, variant = 0) {
  const r = rng(101 + variant * 7), n = Math.floor(sr * (0.2 + r() * 0.08)), x = new Float32Array(n);
  for (let k = 0; k < 50; k++) { // soft packed grains, low and rounded
    const at = Math.floor(n * 0.7 * r() ** 1.6), len = Math.floor(sr * (0.004 + r() * 0.01));
    const f = 350 + r() * 1100, amp = (1 - at / n) * (0.3 + r() * 0.5);
    for (let i = 0; i < len && at + i < n; i++) x[at + i] += Math.sin((2 * Math.PI * f * i) / sr) * amp * Math.sin((Math.PI * i) / len);
  }
  const body = pink(sr, n / sr, 300 + variant);
  biquad(body, sr, "lowpass", 700);
  for (let i = 0; i < n; i++) { const t = i / sr; x[i] += body[i] * 3 * Math.min(1, t / 0.015) * Math.exp(-t * 14); }
  biquad(x, sr, "lowpass", 2400, 0.5);
  return normalize(x, 0.8);
}

// A landing: the board slapping down (a low thump that falls in pitch) and a puff of snow.
export function thump(sr) {
  const r = rng(7), n = Math.floor(sr * 0.45), x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / sr, f = 70 + 110 * Math.exp(-t * 22); ph += (2 * Math.PI * f) / sr; x[i] = Math.sin(ph) * Math.exp(-t * 14) * 0.9; }
  const puff = new Float32Array(n); for (let i = 0; i < n; i++) puff[i] = r() * 2 - 1;
  biquad(puff, sr, "lowpass", 1600); biquad(puff, sr, "highpass", 180);
  for (let i = 0; i < n; i++) { const t = i / sr; x[i] += puff[i] * 1.6 * Math.min(1, t / 0.004) * Math.exp(-t * 9); }
  return normalize(x, 0.85);
}

// The chair's grip rolling over a tower's sheave train: the rope's rumble swelling as the tower comes, then
// a rhythmic "ka-thunk… ka-thunk-ka-thunk" as the grip rolls across each rubber-lined wheel (a soft knock
// as it meets the wheel, a round low thunk as it rides over; metal, but muffled), louder up to the tower
// and quieter on its far side; then the chair swaying on its hanger with a slight creak.
// The tower itself (the middle wheel) is at `sheaveLead(wheels, gap)` seconds into the buffer.
export const sheaveLead = (wheels, gap) => 0.45 + ((wheels - 1) / 2) * gap;
export function sheavePass(sr, wheels = 8, gap = 0.15, seed = 5) {
  const r = rng(seed), pre = 0.45, end = pre + wheels * gap, n = Math.floor(sr * (end + 2.2)), x = new Float32Array(n);
  const rumble = biquad(biquad(brown(sr, n / sr, seed + 3), sr, "lowpass", 420, 0.7), sr, "highpass", 120, 0.7);
  for (let i = 0; i < n; i++) { // the rope roaring through the wheels: swells in, holds, lets go
    const t = i / sr, e = t < pre ? (t / pre) ** 2 : t < end ? 1 : Math.exp(-(t - end) * 3.5);
    x[i] = rumble[i] * 0.55 * e;
  }
  const noise = new Float32Array(Math.floor(sr * 0.05));
  for (let w = 0; w < wheels; w++) {
    const u = (w + 0.5) / wheels, amp = Math.sin(Math.PI * Math.min(1, u * 1.15)) * (u > 0.5 ? 0.65 : 1) * (0.85 + r() * 0.3); // softer past the tower
    const at = pre + w * gap * (0.97 + r() * 0.06);
    // "ka": the grip meeting the wheel, a short muffled knock
    for (let i = 0; i < noise.length; i++) noise[i] = r() * 2 - 1;
    biquad(noise, sr, "bandpass", 700 + r() * 300, 1.5);
    const k0 = Math.floor(at * sr);
    for (let i = 0; i < sr * 0.03 && k0 + i < n; i++) { const t = i / sr; x[k0 + i] += noise[i] * amp * 0.5 * Math.min(1, t / 0.003) * Math.exp(-t * 90); }
    // "thunk": riding over it, a round low knock with a dull metal ring
    const k1 = Math.floor((at + Math.min(0.045, gap * 0.33)) * sr);
    for (let i = 0; i < sr * 0.25 && k1 + i < n; i++) {
      const t = i / sr, env = Math.min(1, t / 0.004);
      const ph = 2 * Math.PI * (150 + 60 * Math.exp(-t * 40)) * t; // pitched up enough to carry on a phone speaker
      let v = (Math.sin(ph) + 0.35 * Math.sin(2 * ph)) * Math.exp(-t * 26);
      for (const [f, d, a2] of [[330, 20, 0.45], [540, 28, 0.32], [880, 40, 0.14]]) v += Math.sin(2 * Math.PI * f * (1 + (r() - 0.5) * 0.002) * t) * a2 * Math.exp(-t * d);
      x[k1 + i] += v * amp * 0.9 * env;
    }
  }
  // the chair swaying after, the hanger creaking a little
  const creak = biquad(pink(sr, n / sr, seed + 9), sr, "bandpass", 380, 5);
  for (let i = 0; i < n; i++) { const t = i / sr - end + 0.1; if (t > 0) x[i] += creak[i] * 1.3 * Math.sin(Math.PI * Math.min(1, t / 1.8)) * (0.55 + 0.45 * Math.sin(t * 5.5)); }
  biquad(x, sr, "lowpass", 2200, 0.6); // nothing sharp
  return normalize(x, 0.8);
}

// A chair clunking through a station (the grip coming off or onto the rope): one heavy knock and a rattle.
export function clunk(sr, seed = 9) {
  const r = rng(seed), n = Math.floor(sr * 0.7), x = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / sr; x[i] = Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t * 18) + Math.sin(2 * Math.PI * 210 * t) * 0.4 * Math.exp(-t * 30); }
  for (let k = 0; k < 6; k++) { const at = Math.floor(sr * (0.05 + k * 0.045 + r() * 0.02)), f = 900 + r() * 1800;
    for (let i = 0; i < sr * 0.08 && at + i < n; i++) x[at + i] += Math.sin((2 * Math.PI * f * i) / sr) * 0.25 * Math.exp((-i / sr) * 40) * (1 - k / 6); }
  return normalize(x, 0.7);
}

// A reverb tail (two channels): decaying noise, darker as it fades, like a wide open valley.
export function impulse(sr, secs = 2.6, seed = 31) {
  const r = rng(seed), n = Math.floor(sr * secs);
  return [0, 1].map((ch) => {
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = (r() * 2 - 1) * Math.exp((-i / sr) * (3.2 / secs) * 2.3);
    biquad(x, sr, "lowpass", 5200); for (let i = 0; i < 300; i++) x[i] *= i / 300;
    return normalize(x, 0.5 + ch * 0.01);
  });
}

export const measure = { rms };
