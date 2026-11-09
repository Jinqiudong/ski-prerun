// Snow that changes how a run rides, as rules with no three.js and no DOM (tested): where powder lies after
// heavy snow, which runs have moguls (蘑菇) and the bumps themselves, and the board riding over them.
// The ride (ride.js, snowfx.js) draws all this; the resort page and the roadbook use the mogul judgement.

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const DEG = 180 / Math.PI;

// ---------- Powder ----------
// How much fell: Open-Meteo's snowfall over the last three days (cm), as the ride already reads it. A
// powder day starts at `minCm` and is at its deepest from `fullCm`. ?powder=1 (or 0..1) forces it, 0 turns
// it off. Where it lies is the field below, its depth this amount times the field.
// Where wind-blown snow collects: off the prevailing wind (Colorado's is west to north-west), in the lee of
// ridges, on gentle to moderate pitches, in bowls and gullies, in the trees and at the edges of the groomed
// runs (pushed off by the cats and riders); not on ridges the wind scours, steep faces that sluff, or the
// packed middle of a groomed run.
export const POWDER = {
  minCm: 12, fullCm: 35,
  windFrom: 292.5, // bearing the prevailing wind comes from (degrees, 0 = north): WNW
  slope: { flat: 4, gentle: 12, steep: 30, face: 40, flatK: 0.55 }, // degrees: holds best between gentle and steep, none past face
  windward: 0.2, // what a slope facing straight into the wind keeps (a lee slope keeps 1)
  curveM: 6, // metres of concavity (a hollow's depth under its rim, ~40 m round) for the full bowl bonus
  curveR: 3, // ... measured this many terrain cells around
  trees: 0.35, // the shelter the woods give (added, and the wind matters less there)
  groomed: { centre: 8, edge: 20, packed: 0.12, bank: 0.35 }, // metres from a groomed run's line: packed inside centre, a bank of snow out to edge
};
export function powderAmount(cm, force = null, rules = POWDER) {
  if (force != null && force !== "") { const f = force === "map" ? 1 : Number(force); return Number.isFinite(f) ? clamp(f) : 0; }
  if (cm == null || !Number.isFinite(cm)) return 0;
  return clamp((cm - rules.minCm) / (rules.fullCm - rules.minCm) + (cm >= rules.minCm ? 0.25 : 0));
}
// What a run's name says (an inference, not a tag): through the trees (Trees, Glade, Woods), and any wild name
// (those, a Bowl, a Chute, a Cirque): wild runs are left as nature made them, so no zipper of moguls on them.
export const TREE_NAME = /\b(trees?|glades?|woods)\b/i;
export const WILD_NAME = /\b(trees?|glades?|woods|bowls?|chutes?|cirque)\b/i;
export const treeName = (name) => TREE_NAME.test(name || "");
export const wildName = (name) => WILD_NAME.test(name || "");
// The OSM piste:grooming value's parts ("classic+mogul" → ["classic", "mogul"]).
export const groomParts = (run) => String(run?.grooming || "").split(/[+;,]/).filter(Boolean);
// A groomed run: tagged classic or skating (OSM piste:grooming), or untagged, green or blue (resorts groom
// those) and not through the trees. A Bowl or a Chute that is green or blue is groomed too (Bunnyfair Bowl,
// Log Chute: gentle, wide or a narrow trail); only the trees keep their snow as it fell.
export const groomedRun = (run) => {
  const g = groomParts(run);
  if (g.length) return g.includes("classic") || g.includes("skating");
  return !treeName(run.name) && (run.level === "easy" || run.level === "intermediate");
};

// The terrain's part (0..1) at each terrain grid point: slope, which way it faces against the wind, and
// whether it is a hollow or a crest. heights: Float32Array gw × gh (row-major, z rows), cell: metres.
// Directions: x east, z south (the bake's flat projection).
export function powderTerrain(heights, gw, gh, cell, rules = POWDER) {
  const out = new Float32Array(gw * gh), S = rules.slope, R = rules.curveR;
  const b = (rules.windFrom + 180) * Math.PI / 180, wx = Math.sin(b), wz = -Math.cos(b); // where the wind blows to
  const H = (r, c) => heights[clamp(r, 0, gh - 1) * gw + clamp(c, 0, gw - 1)];
  for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) {
    const gx = (H(r, c + 1) - H(r, c - 1)) / (2 * cell), gz = (H(r + 1, c) - H(r - 1, c)) / (2 * cell);
    const g = Math.hypot(gx, gz), deg = Math.atan(g) * DEG;
    // flats hold some (the wind packs them), gentle to steep the most, faces past `face` none
    const sf = deg < S.gentle ? S.flatK + (1 - S.flatK) * smooth(S.flat, S.gentle, deg) : deg < S.steep ? 1 : 1 - smooth(S.steep, S.face, deg);
    // lee: the way downhill (−gradient) points where the wind blows to; it matters once there is a slope
    const lee = g > 1e-6 ? (-(gx * wx + gz * wz) / g) : 0, aw = smooth(2, 10, deg);
    const af = 1 - aw * (1 - rules.windward) * (1 - (lee + 1) / 2);
    // concave (a bowl, a gully) gains, convex (a ridge, a knoll) is scoured: the ring around against here
    let ring = 0;
    for (const [dr, dc] of [[-R, 0], [R, 0], [0, -R], [0, R], [-R, -R], [-R, R], [R, -R], [R, R]]) ring += H(r + dr, c + dc);
    const conc = ring / 8 - H(r, c);
    const k = Math.tanh(conc / rules.curveM), cf = clamp(0.85 + 0.4 * k, 0.05, 1.2);
    // in a hollow the wind drops its snow whichever way the slope faces, and fills its floor
    const fill = clamp(k), sf2 = deg < S.gentle ? sf + (1 - sf) * fill : sf;
    out[r * gw + c] = clamp(sf2 * (af + (1 - af) * fill) * cf, 0, 1.2);
  }
  return out;
}

// The whole field on a finer grid (w × h over the terrain's bounds, the trees mask's grid): the terrain part
// sampled, the woods' shelter, the groomed runs packed in the middle and banked at the edges.
// terrain: { h, gw, gh, x0, z0, x1, z1 }, trees(x, z) → bool, runs: the resort's runs.
export function powderField(terrain, trees, runs, w, h, rules = POWDER) {
  const { gw, gh, x0, z0, x1, z1 } = terrain, cell = (x1 - x0) / (gw - 1);
  const tp = powderTerrain(terrain.h, gw, gh, cell, rules);
  const dx = (x1 - x0) / (w - 1), dz = (z1 - z0) / (h - 1);
  // Distance to the nearest groomed run's line, stamped around each run (only as far as the bank reaches).
  const G = rules.groomed, far = G.edge + 4, dist = new Float32Array(w * h).fill(1e9), reach = Math.ceil(far / Math.min(dx, dz));
  for (const run of runs) {
    if (run.area || !groomedRun(run) || !run.pts || run.pts.length < 2) continue;
    for (let i = 1; i < run.pts.length; i++) {
      const [ax, az] = run.pts[i - 1], [bx, bz] = run.pts[i], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / (Math.min(dx, dz) * 2)));
      for (let k = 0; k <= n; k++) {
        const px = ax + ((bx - ax) * k) / n, pz = az + ((bz - az) * k) / n, cc = Math.round((px - x0) / dx), rr = Math.round((pz - z0) / dz);
        for (let a = -reach; a <= reach; a++) for (let q = -reach; q <= reach; q++) {
          const r2 = rr + a, c2 = cc + q; if (r2 < 0 || c2 < 0 || r2 >= h || c2 >= w) continue;
          const d = Math.hypot(x0 + c2 * dx - px, z0 + r2 * dz - pz), j = r2 * w + c2;
          if (d < dist[j]) dist[j] = d;
        }
      }
    }
  }
  const out = new Uint8Array(w * h);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const x = x0 + c * dx, z = z0 + r * dz;
    // bilinear in the terrain part
    const fc = clamp((x - x0) / cell, 0, gw - 1.001), fr = clamp((z - z0) / ((z1 - z0) / (gh - 1)), 0, gh - 1.001), i = Math.floor(fr), j = Math.floor(fc), u = fc - j, v = fr - i;
    let p = (tp[i * gw + j] * (1 - u) + tp[i * gw + j + 1] * u) * (1 - v) + (tp[(i + 1) * gw + j] * (1 - u) + tp[(i + 1) * gw + j + 1] * u) * v;
    if (trees(x, z)) p = p * (1 - rules.trees * 0.5) + rules.trees; // sheltered: the wind can't take it
    const d = dist[r * w + c];
    if (d < G.edge + 4) {
      if (d < G.centre) p *= G.packed + (1 - G.packed) * smooth(G.centre - 3, G.centre, d) * 0.3; // the packed middle
      else p += G.bank * Math.sin(Math.PI * clamp((d - G.centre) / (G.edge - G.centre))); // the bank at its edge
    }
    out[r * w + c] = Math.round(clamp(p) * 255);
  }
  return { w, h, x0, z0, x1, z1, data: out };
}
// The field at (x, z), 0..1, bilinear.
export function powderAt(f, x, z) {
  if (!f) return 0;
  const fc = (x - f.x0) / (f.x1 - f.x0) * (f.w - 1), fr = (z - f.z0) / (f.z1 - f.z0) * (f.h - 1);
  if (fc < 0 || fr < 0 || fc >= f.w - 1 || fr >= f.h - 1) return 0;
  const j = Math.floor(fc), i = Math.floor(fr), u = fc - j, v = fr - i, d = f.data, k = i * f.w + j;
  return ((d[k] * (1 - u) + d[k + 1] * u) * (1 - v) + (d[k + f.w] * (1 - u) + d[k + f.w + 1] * u) * v) / 255;
}

// ---------- Moguls (蘑菇) ----------
// Which runs have them, explicitly: tagged moguls in OSM (piste:grooming=mogul, alone or with classic), or a
// black or double black that isn't groomed and is steep enough that riders turning in the same places push
// the snow into bumps. Backcountry (hike-to, off-piste) isn't skied enough to bump up, and a run named for the
// trees, a bowl, a chute or a cirque isn't a mogul run (wildName): the bumps there aren't a zipper line.
// The bumps: a staggered zipper, rows `rowGap` apart down the fall line, bumps `spacing` apart across it,
// every other row offset half a bump, the rows drifting sideways (`skew`) so the troughs make diagonal lines.
export const MOGULS = {
  tags: ["mogul"],
  natural: { advanced: 32, expert: 30 }, // steepest sustained pitch (degrees, over `pitchWin` m) that bumps up an ungroomed run
  ungroomed: ["", "no"], // grooming values that count as ungroomed for the natural rule
  pitchWin: 60,
  rowGap: 3.4, spacing: 3.6, skew: 1.1, jitter: 0.35,
  height: [0.5, 0.8], radius: 1.75, // a bump's height (m) and footprint radius
  halfWidth: 12, edgeFade: 4, endFade: 12, // bumps across the run's middle 24 m, fading out at the edges and ends
};
// The steepest pitch along a run's line held over `win` metres (degrees). heightAt(x, z) → m.
export function runPitch(pts, heightAt, win = MOGULS.pitchWin) {
  if (!pts || pts.length < 2) return 0;
  const d = [0], hs = pts.map(([x, z]) => heightAt(x, z));
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  let best = 0;
  for (let i = 0, j = 0; i < pts.length; i++) {
    while (j < i && d[i] - d[j + 1] >= win) j++;
    if (d[i] - d[j] >= win * 0.6) best = Math.max(best, Math.atan2(Math.abs(hs[j] - hs[i]), d[i] - d[j]) * DEG);
  }
  return best;
}
// Why a run has moguls: "tag", "natural", or null.
export function mogulRun(run, pitchDeg, rules = MOGULS) {
  if (!run || run.area) return null;
  const g = String(run.grooming || "");
  if (rules.tags.some((t) => g.split(/[+;,]/).includes(t))) return "tag";
  const min = rules.natural[run.level];
  if (min != null && rules.ungroomed.includes(g) && !wildName(run.name) && pitchDeg >= min) return "natural";
  return null;
}
// Mark every run's moguls (run.moguls = "tag" | "natural" | null). heightAt(x, z) → m.
export function markMoguls(runs, heightAt, rules = MOGULS) {
  for (const r of runs) r.moguls = r.area ? null : mogulRun(r, runPitch(r.pts, heightAt, rules.pitchWin), rules);
  return runs.filter((r) => r.moguls);
}

const hash = (a, b, s) => { let t = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1); t = Math.imul(t ^ (t >>> 15), 0x85ebca6b); t ^= t >>> 13; return ((t >>> 0) % 10007) / 10007; };
// A bump's cap: a soft dome with a rounded, slightly flattened top (a mushroom cap), 1 at the middle, 0 at r = 1.
export const cap = (r) => (r >= 1 ? 0 : Math.pow(1 - Math.pow(r, 2.4), 1.35));
// The mogul surface's height (m, ≥ 0) at s metres along the run and d across it (left −, right +). seed: the
// run's own; the bumps fade in from lo and out by len (its ends, or the stretch that is drawn); k: how big
// (tagged runs 1, natural ones a little less).
export function mogulHeight(s, d, seed = 1, len = Infinity, rules = MOGULS, k = 1, lo = 0) {
  const { rowGap, spacing, skew, jitter, radius, halfWidth, edgeFade, endFade } = rules;
  const fade = smooth(0, edgeFade, halfWidth - Math.abs(d)) * smooth(0, endFade, s - lo) * smooth(0, endFade, len - s);
  if (fade <= 0) return 0;
  const row = Math.round(s / rowGap);
  let best = 0;
  for (let j = row - 1; j <= row + 1; j++) {
    const off = (j & 1 ? spacing / 2 : 0) + ((j * skew) % spacing);
    const col = Math.round((d - off) / spacing);
    for (let c = col - 1; c <= col + 1; c++) {
      const hs = hash(j, c, seed), hd = hash(c, j, seed + 7);
      const cs = j * rowGap + (hs - 0.5) * 2 * jitter, cd = off + c * spacing + (hd - 0.5) * 2 * jitter;
      const r = Math.hypot((s - cs) / (radius * 0.92), (d - cd) / radius); // a little longer across than down
      if (r >= 1) continue;
      const a = (rules.height[0] + (rules.height[1] - rules.height[0]) * hash(j + 3, c - 5, seed)) * k;
      best = Math.max(best, a * cap(r));
    }
  }
  return best * fade;
}

// Mogul runs as resampled centre lines, found by (x, z) through a coarse grid: height(x, z) is the surface
// over the terrain anywhere (0 off them), for the physics, the board's track and the guide on the snow.
export class MogulField {
  constructor(rules = MOGULS) { this.rules = rules; this.lines = []; this.grid = new Map(); this.G = 12; }
  get size() { return this.lines.length; }
  has(run) { return this.lines.some((l) => l.run === run); }
  // A run in: its line every 2 m with the distance along it, and a size from how it got its moguls.
  add(run) {
    if (this.has(run) || !run.pts || run.pts.length < 2) return null;
    const xs = [], zs = [], ss = [];
    let s = 0;
    for (let i = 0; i < run.pts.length; i++) {
      const [x, z] = run.pts[i];
      if (i) {
        const [ax, az] = run.pts[i - 1], L = Math.hypot(x - ax, z - az), n = Math.max(1, Math.ceil(L / 2));
        for (let k = 1; k <= n; k++) { xs.push(ax + ((x - ax) * k) / n); zs.push(az + ((z - az) * k) / n); s += L / n; ss.push(s); }
      } else { xs.push(x); zs.push(z); ss.push(0); }
    }
    // smoothed tangents, so the bumps don't kink where the OSM line bends
    const n = xs.length, tx = new Float32Array(n), tz = new Float32Array(n);
    for (let i = 0; i < n; i++) { const a = Math.max(0, i - 3), b = Math.min(n - 1, i + 3), L = Math.hypot(xs[b] - xs[a], zs[b] - zs[a]) || 1; tx[i] = (xs[b] - xs[a]) / L; tz[i] = (zs[b] - zs[a]) / L; }
    // lo..hi: the stretch with bumps (all of it unless the ride only draws part, see clip)
    const line = { run, xs, zs, ss, tx, tz, len: s, lo: 0, hi: s, seed: (run.id ?? xs.length) * 7 + 13, k: run.moguls === "natural" ? 0.85 : 1 };
    const li = this.lines.push(line) - 1, G = this.G;
    for (let i = 0; i < n; i++) {
      const key = `${Math.floor(xs[i] / G)},${Math.floor(zs[i] / G)}`;
      let cell = this.grid.get(key); if (!cell) this.grid.set(key, (cell = []));
      cell.push(li, i);
    }
    return line;
  }
  // Where (x, z) is on the nearest mogul run: { line, s, d } or null (more than the bumps' half width off).
  locate(x, z, out = {}) {
    const G = this.G, cx = Math.floor(x / G), cz = Math.floor(z / G), lim = this.rules.halfWidth + 1;
    let best = lim * lim, bl = -1, bi = -1;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const cell = this.grid.get(`${cx + a},${cz + b}`); if (!cell) continue;
      for (let k = 0; k < cell.length; k += 2) { const l = this.lines[cell[k]], i = cell[k + 1], d = (l.xs[i] - x) ** 2 + (l.zs[i] - z) ** 2; if (d < best) { best = d; bl = cell[k]; bi = i; } }
    }
    if (bl < 0) return null;
    const l = this.lines[bl], dx = x - l.xs[bi], dz = z - l.zs[bi];
    out.line = l; out.s = l.ss[bi] + dx * l.tx[bi] + dz * l.tz[bi];
    out.d = dx * l.tz[bi] - dz * l.tx[bi]; // + to the right of the way down
    return out;
  }
  // Only part of a line bumped (lo..hi metres along it).
  clip(line, lo, hi) { line.lo = Math.max(0, lo); line.hi = Math.min(line.len, hi); }
  height(x, z) {
    const p = this.locate(x, z, this._p || (this._p = {}));
    return p ? lineHeight(p.line, p.s, p.d, this.rules) : 0;
  }
}

export const lineHeight = (l, s, d, rules = MOGULS) => (s < l.lo || s > l.hi ? 0 : mogulHeight(s, d, l.seed, l.hi, rules, l.k, l.lo));

// The board over the bumps, a step at a time. On the snow it follows the surface: up a bump's face the knees
// fold (absorb), over the crest the legs push the board down after the snow. They can only pull it down so
// fast (`grip`, more when slow), so a fast rider whose crest drops away quicker than that leaves the snow,
// with part of the rise (the legs soak up the rest), flies a little and lands, knees bending again.
// st: { y, vy, air } (y: the board's height over the terrain), hs: the bumps' surface here now, speed: m/s.
// Returns st, with absorb 0..1 (how deep the knees are bent) for the pose.
export const BUMP = { minAirSpeed: 10, keep: 0.3, grip: (v) => 9.8 + clamp(16 - v, 4, 12) * 2.4 };
export function bumpStep(st, hs, speed, dt, rules = BUMP) {
  if (dt <= 0) return st;
  st.y ??= hs; st.vy ??= 0; st.absorb ??= 0; st.land ??= 0;
  const prev = st.h ?? hs, vs = (hs - prev) / dt; // the surface's own rate under the board
  st.h = hs;
  if (!st.air) {
    if (speed > rules.minAirSpeed && st.vy > 0.4 && st.vy - rules.grip(speed) * dt > vs) { st.air = true; st.vy *= rules.keep; st.t = 0; }
    else { st.vy = vs; st.y = hs; }
  }
  if (st.air) {
    st.vy -= 9.8 * dt; st.y += st.vy * dt; st.t += dt;
    if (st.y <= hs) { st.land = clamp(-st.vy / 3); st.y = hs; st.vy = vs; st.air = false; }
  }
  st.land = Math.max(0, st.land - dt * 2.5);
  const want = st.air ? 0.3 : clamp(Math.max(0, vs) / 3.5 + st.land);
  st.absorb += (want - st.absorb) * Math.min(1, dt * 12);
  return st;
}

// ---------- A tree in the way ----------
// The trunk you touch (r: metres from its centre to the board), and how a hit plays out. Straight on (within
// ~37°) and fast: a crash. Anything else glances off: the part of the speed into the trunk goes, the rest
// carries on round it, so a brush never stops you and you can't be pinned against a trunk. Moving away from
// it already, it only keeps you out of the bark. Nearly straight on but slow: you slide round on the side you
// were going (`prefer`, a unit { x, z }: the route ahead), never below `slide` m/s if you had that much.
// r: { x, z, heading, speed }; tree: { x, z }. Returns { x, z, heading, speed, crash, hard, into, up }:
// up, after a crash, the heading to get up facing (clear of the trunk, toward `prefer`).
export const TREE = { r: 1.2, crashV: 5.5, crashCos: 0.8, keep: 0.85, slide: 1.6 };
export function treeHit(r, tree, prefer = null, rules = TREE) {
  let nx = r.x - tree.x, nz = r.z - tree.z;
  const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
  const out = { x: tree.x + nx * (rules.r + 0.05), z: tree.z + nz * (rules.r + 0.05), heading: r.heading, speed: r.speed, crash: false, hard: 0, into: 0, up: r.heading };
  const vx = Math.sin(r.heading), vz = Math.cos(r.heading), vn = vx * nx + vz * nz;
  if (vn >= 0) return out; // already going away
  const into = (out.into = -vn);
  // Round the trunk on one side: perpendicular to the way out, the one closer to (px, pz).
  const side = (px, pz) => { const s = -nz * px + nx * pz >= 0 ? 1 : -1; return [-nz * s, nx * s]; };
  // The way round: the travel without its part into the trunk; straight on, the side toward `prefer`.
  let tx = vx - vn * nx, tz = vz - vn * nz;
  if (Math.hypot(tx, tz) < 0.25) [tx, tz] = prefer ? side(prefer.x, prefer.z) : side(tx, tz + 1e-3);
  const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
  const p = prefer || { x: tx, z: tz }, [ux, uz] = p.x * nx + p.z * nz >= 0 ? [p.x, p.z] : side(p.x, p.z);
  out.up = Math.atan2(ux, uz);
  if (r.speed * into > rules.crashV && into > rules.crashCos) {
    out.crash = true; out.hard = clamp(r.speed / 10, 0.3, 1); out.speed = 0;
    return out;
  }
  out.heading = Math.atan2(tx, tz);
  out.speed = Math.max(r.speed * Math.sqrt(1 - into * into) * rules.keep, Math.min(r.speed, rules.slide));
  return out;
}

// ---------- What a run is like: the roadbook, the lift top's choices, the HUD ----------
// The snow's surface on a run, with where it comes from: "tag" (OpenStreetMap's piste:grooming), "inferred"
// (our rules: the name, the level, how steep). mog: why it has moguls (markMoguls' run.moguls), if known.
//   moguls  tagged mogul (alone or with classic: half the run groomed, `groomed: true`), or natural moguls
//   groomed tagged classic / skating, or untagged, green or blue and not in the trees (groomedRun)
//   offpiste tagged backcountry (hike-to, never groomed)
//   ungroomed tagged no, or the rest (blacks and double blacks, tree runs): `wild` when the name says so
export function runSurface(run, mog = run.moguls) {
  const parts = groomParts(run);
  if (mog === "tag" || parts.includes("mogul")) return { k: "moguls", src: "tag", ...(parts.includes("classic") ? { groomed: true } : {}) };
  if (parts.includes("classic") || parts.includes("skating")) return { k: "groomed", src: "tag" };
  if (parts.includes("backcountry")) return { k: "offpiste", src: "tag" };
  if (parts.includes("no")) return { k: "ungroomed", src: "tag", wild: wildName(run.name) };
  if (mog === "natural") return { k: "moguls", src: "inferred" };
  if (groomedRun(run)) return { k: "groomed", src: "inferred" };
  return { k: "ungroomed", src: "inferred", wild: wildName(run.name) };
}
// Powder on a run's stretch (pts) on a powder day: { k: "edges" } on a groomed run (its middle is packed, the
// cats push the snow to the sides), { k: "whole" } on the rest, or null. powder: { f: powderField, amt: 0..1 }.
export function runPowder(pts, powder, groomed, rules = POWDER) {
  if (!powder?.f || !(powder.amt > 0) || !pts || pts.length < 2) return null;
  // down the middle, and halfway into the bank either side (where the cats push the snow)
  const off = (rules.groomed.centre + rules.groomed.edge) / 2, step = Math.max(1, Math.floor(pts.length / 60));
  let mid = 0, edge = 0, n = 0;
  for (let i = step; i < pts.length; i += step) {
    const [ax, az] = pts[i - step], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L, nz = (bx - ax) / L;
    mid += powderAt(powder.f, ax, az);
    edge += Math.max(powderAt(powder.f, ax + nx * off, az + nz * off), powderAt(powder.f, ax - nx * off, az - nz * off));
    n++;
  }
  if (!n) return null;
  mid = (mid / n) * powder.amt; edge = (edge / n) * powder.amt;
  const deep = 0.25;
  if (groomed) return edge > deep ? { k: "edges", src: "inferred" } : null;
  return Math.max(mid, edge) > deep ? { k: "whole", src: "inferred" } : null;
}
// A run's conditions as the small icons beside its name (the lift top, the HUD strip), in this order, each
// with its source: 压雪 groomed, 蘑菇 moguls, 树林 trees (by name, always inferred), 未压雪 ungroomed or
// off-piste (not shown for a tree run: the trees say it), 粉雪 powder (pw: runPowder's, or null).
export const CONDS = ["groomed", "moguls", "trees", "ungroomed", "powder"];
export const COND_ICON = { groomed: "groomed", moguls: "moguls", trees: "trees", ungroomed: "ungroomed", powder: "powder" };
export const COND_ZH = { groomed: "压雪", moguls: "蘑菇", trees: "树林", ungroomed: "未压雪", powder: "粉雪" };
export function runConds(run, pw = null, mog = run.moguls) {
  const s = runSurface(run, mog), tr = treeName(run.name), out = [];
  if (s.k === "groomed" || s.groomed) out.push({ k: "groomed", src: s.src });
  if (s.k === "moguls") out.push({ k: "moguls", src: s.src });
  if (tr) out.push({ k: "trees", src: "inferred" });
  if ((s.k === "ungroomed" || s.k === "offpiste") && !tr) out.push({ k: "ungroomed", src: s.src, ...(s.k === "offpiste" ? { offpiste: true } : {}) });
  if (pw) out.push({ k: "powder", src: "inferred", how: pw.k });
  return out;
}
// A way's conditions (several runs' runConds lists): each kind once, in CONDS order, "tag" if any run's is.
export function wayConds(lists) {
  const by = new Map();
  for (const l of lists) for (const c of l) { const was = by.get(c.k); if (!was || (was.src !== "tag" && c.src === "tag")) by.set(c.k, c); }
  return CONDS.filter((k) => by.has(k)).map((k) => by.get(k));
}
// A condition in words, for the tap detail and the roadbook: [text, inferred?]. Translated by the caller.
export function condWords(c) {
  const w = {
    groomed: "压雪道",
    moguls: "蘑菇道",
    trees: "树林道，不压雪",
    ungroomed: c.offpiste ? "野雪区，不压雪" : "不压雪，自然雪面",
    powder: c.how === "edges" ? "两边有粉雪，中间压实了" : "整条都可能有粉雪",
  }[c.k];
  return [w, c.src !== "tag"];
}

// The facts about the stretch of a run you rode (pts: its points, default the whole run), each with where it
// comes from: "tag" (OpenStreetMap says so), "terrain" (measured from the heights), "inferred" (our rules).
// powder: { f: powderField, amt: 0..1 } or null. Returns
//   { len, drop, pitch, mean, surface: { k: "moguls" | "groomed" | "offpiste" | "ungroomed", src, wild },
//     powder: { k: "edges" | "whole", src: "inferred" } | null }
export function runFacts(run, pts = run.pts, heightAt, powder = null, rules = POWDER) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const hs = pts.map(([x, z]) => heightAt(x, z)), drop = Math.max(0, Math.round(hs[0] - Math.min(...hs)));
  const pitch = Math.round(runPitch(pts, heightAt)), mean = len ? Math.round(Math.atan2(drop, len) * DEG) : 0;
  const mog = run.moguls !== undefined ? run.moguls : mogulRun(run, runPitch(run.pts, heightAt));
  const surface = runSurface(run, mog);
  const pw = runPowder(pts, powder, surface.k === "groomed", rules);
  return { len: Math.round(len), drop, pitch, mean, surface, powder: pw };
}
