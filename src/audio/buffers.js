// Sound material made from numbers (no files): textured noise for the snow, grit for a skid, crunches for
// a step, a landing thump, the clack of a chair over a tower's sheaves, a station clunk and a reverb tail.
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

// The board running on snow: pink noise whose loudness breathes unevenly, many times a second (snow is
// never one surface: crystals, ridges of corduroy, patches packed harder), and with tiny ticks of
// crystals breaking. Played faster with speed, the texture speeds up and brightens.
export function snowTexture(sr, secs = 3, seed = 11) {
  const r = rng(seed), fade = Math.floor(sr * 0.08), n = Math.floor(sr * secs) + fade;
  const x = pink(sr, n / sr, seed), slow = wobble(r, n, sr, 3, 0.65, 1.15), fast = wobble(r, n, sr, 22, 0.55, 1.25);
  for (let i = 0; i < n; i++) x[i] *= slow[i] * fast[i];
  for (let k = 0; k < secs * 160; k++) { // crystal ticks
    const at = Math.floor(r() * (n - 200)), len = 20 + Math.floor(r() * 90), amp = 0.4 + r() * 1.2;
    for (let i = 0; i < len; i++) x[at + i] += (r() * 2 - 1) * amp * 0.12 * (1 - i / len) ** 2;
  }
  return toRms(seamless(x, fade), 0.22);
}

// A skid: the board's edge scraping sideways through the snow. Dense grains of filtered noise, each its own
// pitch and loudness, a few loud ones (the grit), over a rough bed; it chatters a little, as an edge does.
export function scrapeTexture(sr, secs = 3, seed = 23) {
  const r = rng(seed), fade = Math.floor(sr * 0.08), n = Math.floor(sr * secs) + fade, x = new Float32Array(n);
  const bed = pink(sr, n / sr, seed + 1), chat = wobble(r, n, sr, 34, 0.35, 1.2);
  for (let i = 0; i < n; i++) x[i] = bed[i] * 0.5 * chat[i];
  const grain = new Float32Array(Math.floor(sr * 0.02));
  for (let k = 0; k < secs * 700; k++) {
    const len = Math.floor(sr * (0.002 + r() * 0.012)), at = Math.floor(r() * (n - len - 1));
    const g = grain.subarray(0, len); for (let i = 0; i < len; i++) g[i] = r() * 2 - 1;
    biquad(g, sr, "bandpass", 500 + r() * 3200, 1.2 + r() * 2);
    const amp = (r() < 0.06 ? 1.7 : 0.6) * (0.3 + r()) * 3;
    for (let i = 0; i < len; i++) x[at + i] += g[i] * amp * Math.sin((Math.PI * i) / len);
  }
  return toRms(seamless(x, fade), 0.22);
}

// One crunch of a boot or the free foot pushing: a short packed squeak-crunch, its grains bunched at
// the start and thinning out. variant picks one of a few.
export function crunch(sr, variant = 0) {
  const r = rng(101 + variant * 7), n = Math.floor(sr * (0.16 + r() * 0.08)), x = new Float32Array(n);
  for (let k = 0; k < 140; k++) {
    const at = Math.floor(n * r() ** 2.2), len = Math.floor(sr * (0.001 + r() * 0.006));
    const f = 700 + r() * 2600, amp = (1 - at / n) * (0.4 + r());
    for (let i = 0; i < len && at + i < n; i++) x[at + i] += Math.sin((2 * Math.PI * f * i) / sr + r() * 0.3) * amp * (1 - i / len);
  }
  const body = pink(sr, n / sr, 300 + variant);
  biquad(body, sr, "lowpass", 900);
  for (let i = 0; i < n; i++) x[i] += body[i] * 2.2 * Math.exp((-i / sr) * 22);
  for (let i = 0; i < 40; i++) x[i] *= i / 40;
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

// The chair's grip rolling over a tower's sheave train: a quick run of metal clacks (each a few ringing
// partials and a knock), louder in the middle, and the chair's sway after. gap: seconds between wheels.
export function clack(sr, wheels = 8, gap = 0.1, seed = 5) {
  const r = rng(seed), n = Math.floor(sr * (wheels * gap + 1.4)), x = new Float32Array(n);
  const partials = [[620, 9], [1420, 14], [2730, 22], [4110, 30]];
  for (let w = 0; w < wheels; w++) {
    const at = Math.floor(sr * (w * gap + (r() - 0.5) * 0.008)), amp = 0.55 + 0.45 * Math.sin((Math.PI * (w + 0.5)) / wheels);
    for (const [f0, d] of partials) {
      const f = f0 * (0.97 + r() * 0.06), a = amp * (0.3 + r() * 0.4);
      for (let i = 0; i < sr * 0.25 && at + i < n; i++) x[at + i] += Math.sin((2 * Math.PI * f * i) / sr) * a * Math.exp((-i / sr) * d) * 0.35;
    }
    for (let i = 0; i < sr * 0.03 && at + i < n; i++) { const t = i / sr; x[at + i] += Math.sin(2 * Math.PI * 95 * t) * amp * Math.exp(-t * 80) * 0.9; } // the knock
  }
  const creak = pink(sr, n / sr, seed + 9); biquad(creak, sr, "bandpass", 340, 6); // the hanger swaying after
  const end = wheels * gap;
  for (let i = 0; i < n; i++) { const t = i / sr - end; if (t > 0) x[i] += creak[i] * 1.6 * Math.sin(Math.PI * Math.min(1, t / 1.2)) * (0.5 + 0.5 * Math.sin(t * 9)); }
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
