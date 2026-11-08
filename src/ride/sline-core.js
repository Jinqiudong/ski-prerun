// The S on the snow, with no three.js (tested): the line to ride down a plan (ride.js makePlan / guide-core.js
// splicePlan), linked turns weaving left and right across the route's line. ride.js both draws it (a gold
// ribbon on the snow ahead) and steers by it, from the same numbers, so riding untouched follows the S and
// tilting into each arc is riding it.
//
// A turn is half a wave: `turn` metres along the route from one crossing of the line to the next, swinging
// `amp` metres to either side. By the run's level, wider and longer on steep snow (each turn finishes further
// across the fall line), as linked medium turns look on a piste at the ride's pace (11–15 m/s):
//   easy 3.5 m / 24 m, intermediate 4.5 m / 28 m, advanced 5.5 m / 31 m, expert 6 m / 34 m; steep +1.5 m / +6 m.
// Straight, no weave: on flats and rises, gentle stretches, cat-tracks and other narrow ways (by name), a line
// through the trees (a detour), the first and last metres, either side of a junction and through bends too
// tight to weave in. Where the weave starts or stops it grows or dies away over ~25 m, never a step.
export const S_SHAPE = { easy: { amp: 3.5, turn: 24 }, intermediate: { amp: 4.5, turn: 28 }, advanced: { amp: 5.5, turn: 31 }, expert: { amp: 6, turn: 34 } };
export const S_STEEP = { amp: 1.5, turn: 6 }; // added in full from a 30% grade (17°) up, none under 12%
export const S_MAX = 9; // never wider than this either side (the ride's LAT is 11 m)
const RAMP = 0.2; // metres of half-width gained or lost per metre along
const JUNCTION = 18, END = 40, START = 12, FLAT_GRADE = 0.1;
// Cat-tracks, roads and other narrow ways: no room to swing across.
export const NARROW = /\b(road|rd|lane|track|traverse|catwalk|cat ?track|path|trail ?#|runout|run-out|run out|connector|bridge|tunnel|access|ski ?way)\b/i;
export const isNarrow = (run) => !!run && NARROW.test(run.name || "");

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// The index i with dist[i] <= s < dist[i + 1], walked from a hint (cheap when s moves a little).
export function indexNear(dist, s, i = 0) {
  const last = dist.length - 2;
  i = clamp(i | 0, 0, Math.max(0, last));
  while (i < last && dist[i + 1] <= s) i++;
  while (i > 0 && dist[i] > s) i--;
  return i;
}

// The S for a plan P ({ path, dist, hs, segs: [{ at, run }], flats: [{ a, b }], detour?: { a, b } }).
// junctions: distances along P of turn-offs (skinav.js junctions). → { P, amp, turn, ph } per point of P.path.
export function sPlan(P, { junctions = [] } = {}) {
  const { path, dist } = P, n = path.length, end = dist[n - 1];
  const hs = P.hs || path.map(() => 0);
  const amp = new Float32Array(n), turn = new Float32Array(n), ph = new Float32Array(n), want = new Float32Array(n);
  const dirAt = (i) => { const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)]; return Math.atan2(b[0] - a[0], b[1] - a[1]); };
  const sharp = [];
  let k = 0, a = 0, b = 0, h0 = 0, h1 = 0;
  for (let i = 0; i < n; i++) {
    while (k + 1 < P.segs.length && P.segs[k + 1].at <= i) k++;
    const run = P.segs[k]?.run, shape = S_SHAPE[run?.level] || S_SHAPE.intermediate;
    // the grade over ±20 m
    while (a < i && dist[i] - dist[a] > 20) a++;
    while (b < n - 1 && dist[b] - dist[i] < 20) b++;
    const grade = (hs[a] - hs[b]) / Math.max(1, dist[b] - dist[a]);
    const steep = clamp((grade - 0.12) / 0.18, 0, 1);
    turn[i] = shape.turn + S_STEEP.turn * steep;
    let w = Math.min(S_MAX, shape.amp + S_STEEP.amp * steep);
    if (grade < FLAT_GRADE || isNarrow(run) || dist[i] < START || end - dist[i] < END) w = 0;
    // a bend: the way turning by the heading change over ±15 m; room to weave inside it is a share of its radius
    while (h0 < i && dist[i] - dist[h0] > 15) h0++;
    while (h1 < n - 1 && dist[h1] - dist[i] < 15) h1++;
    const bend = Math.abs(wrap(dirAt(h1) - dirAt(h0))), span = Math.max(1, dist[h1] - dist[h0]);
    if (bend > 0.05) w = Math.min(w, Math.max(0, 0.35 * (span / bend) - 3)); // e.g. 45° over 30 m: radius 38 m, up to 10 m
    if (bend > 1.0) sharp.push(dist[i]); // a sharp turn (about 60° within 30 m): straight through it
    want[i] = w;
  }
  for (const f of P.flats || []) for (let i = Math.max(0, f.a); i <= Math.min(n - 1, f.b); i++) want[i] = 0;
  if (P.detour) for (let i = Math.max(0, P.detour.a); i <= Math.min(n - 1, P.detour.b); i++) want[i] = 0;
  const clear = (s, r) => { for (let i = indexNear(dist, s - r); i < n && dist[i] <= s + r; i++) if (Math.abs(dist[i] - s) <= r) want[i] = 0; };
  for (const s of junctions) clear(s, JUNCTION);
  for (const s of sharp) clear(s, 15);
  // never a step: grow and die away at RAMP per metre, both ways
  for (let i = 0; i < n; i++) amp[i] = i ? Math.min(want[i], amp[i - 1] + RAMP * (dist[i] - dist[i - 1])) : 0;
  for (let i = n - 2; i >= 0; i--) amp[i] = Math.min(amp[i], amp[i + 1] + RAMP * (dist[i + 1] - dist[i]));
  amp[n - 1] = 0;
  // the phase: half a wave per turn; back to 0 wherever the line is straight, so the first arc after a
  // straight bit leaves from the line itself
  for (let i = 1; i < n; i++) ph[i] = amp[i - 1] === 0 && amp[i] === 0 ? 0 : ph[i - 1] + (Math.PI * (dist[i] - dist[i - 1])) / turn[i];
  return { P, amp, turn, ph };
}

// A point on the route at distance s: on the polyline, and its index.
function onPath(path, dist, s, i, o) {
  i = indexNear(dist, s, i);
  const L = dist[i + 1] - dist[i] || 1, t = clamp((s - dist[i]) / L, 0, 1), p = path[i], q = path[i + 1] || p;
  o.x = p[0] + (q[0] - p[0]) * t; o.z = p[1] + (q[1] - p[1]) * t; o.i = i;
  return o;
}
const _a = { x: 0, z: 0, i: 0 }, _b = { x: 0, z: 0, i: 0 }, _c = { x: 0, z: 0, i: 0 };

// The S at distance s along the plan, into `out` (no allocation): the route's line there, smoothed over a few
// metres so its corners don't kink the S (cx, cz), the rider's right across it (rx, rz: unit), the S's offset
// to the right of the line (off, metres), its half-width there (amp), which way it is swinging (dir: +1 toward
// the right) and the index (i, a hint for the next call). The point to ride: (cx + rx·off, cz + rz·off).
export function sAt(plan, s, out = {}, hint = out.i || 0) {
  const { P, amp, ph } = plan, { path, dist } = P, end = dist[dist.length - 1];
  s = clamp(s, 0, end);
  const m = onPath(path, dist, s, hint, _a);
  const i = m.i, mx = m.x, mz = m.z;
  const p0 = onPath(path, dist, Math.max(0, s - 6), i, _b), p1 = onPath(path, dist, Math.min(end, s + 6), i, _c);
  out.cx = (p0.x + 2 * mx + p1.x) / 4; out.cz = (p0.z + 2 * mz + p1.z) / 4;
  let dx = p1.x - p0.x, dz = p1.z - p0.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
  out.hx = dx; out.hz = dz; out.rx = -dz; out.rz = dx; // the rider's right: (−cos h, sin h) for h = atan2(dx, dz)
  const L2 = dist[i + 1] - dist[i] || 1, t = clamp((s - dist[i]) / L2, 0, 1), j = Math.min(i + 1, amp.length - 1);
  const A = amp[i] + (amp[j] - amp[i]) * t, f = ph[i] + (ph[j] - ph[i]) * t;
  out.amp = A; out.off = A * Math.sin(f); out.dir = Math.cos(f) >= 0 ? 1 : -1; out.i = i; out.s = s;
  return out;
}

// How far along the plan (x, z) is, near index i: projected onto the segments either side of it.
export function alongPath(P, x, z, i) {
  const { path, dist } = P, n = path.length;
  let best = Infinity, s = dist[clamp(i, 0, n - 1)];
  for (let k = Math.max(0, i - 1); k <= Math.min(n - 2, i); k++) {
    const [ax, az] = path[k], [bx, bz] = path[k + 1], ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1;
    const t = clamp(((x - ax) * ex + (z - az) * ez) / L2, 0, 1), px = ax + ex * t - x, pz = az + ez * t - z, d = px * px + pz * pz;
    if (d < best) { best = d; s = dist[k] + t * Math.sqrt(L2); }
  }
  return s;
}
