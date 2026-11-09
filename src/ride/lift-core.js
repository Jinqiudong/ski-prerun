// The lift's rope over the ground, with no three.js (tested). ride.js liftLine places towers every 85 m and a
// level stretch through each station; the rope runs straight from tower head to tower head (sagging a little
// between towers, not on a station's stretch). A carrier hangs a fixed drop under the rope (a cabin 3.3 m,
// a chair's footrest 3.4 m), so where the ground bulges between two towers (a knoll, the brow before a top
// station) the straight rope came in low and the carrier went into the snow: Wild Blue Gondola I at
// Steamboat arrived at its top station 2 m under the ground. Real lines put a tower on the knoll.
//
// `clearRope` does that: wherever the carrier would pass closer than `margin` to the ground, it adds a tower
// at the worst point, as tall as the rope needs there (up to the lift's own `ropeH`); never inside a station
// (`NO_TOWER` metres from either end, as liftLine keeps its own towers out), so a low point there gets its
// tower at the station's edge. Where that would stand right beside another tower, it raises the nearest
// regular tower instead, as much as the rope needs there. The margin is small near the stations (the
// carrier comes down to its deck) and the full `margin` out on the line.
//
// Towers: [{ s, y, h, station }] in order along the line: s metres along it, y the ground under the tower,
// h the rope's height above it (default `ropeH`), station for the level stretch's ends. groundAt(s): the
// highest ground under the carrier at s (the caller samples both ropes).

export const ROPE_SAG = 0.014; // the sag at mid-span, per metre of span
export const NEAR_MARGIN = 0.3, LINE_MARGIN = 1.5, MARGIN_RAMP = 40; // metres of air under the carrier: at a station's mouth, out on the line, and how far the one grows into the other
export const STATION_IN = 20, NO_TOWER = 40, TOWER_GAP = 15; // the level stretch, no tower inside this, nor closer than this to another

// The rope's height at s (no side offset).
export function ropeY(towers, s, ropeH = 11.5) {
  let k = 1;
  while (k < towers.length - 1 && towers[k].s < s) k++;
  const a = towers[k - 1], b = towers[k], span = b.s - a.s, t = (s - a.s) / (span || 1);
  const ha = a.h ?? ropeH, hb = b.h ?? ropeH;
  return a.y + (b.y - a.y) * t + ha + (hb - ha) * t - (a.station || b.station ? 0 : span * ROPE_SAG * 4 * t * (1 - t));
}

// The air wanted under the carrier at s on a line `total` long.
export function marginAt(s, total, margin = LINE_MARGIN) {
  const e = Math.max(0, Math.min(s, total - s) - STATION_IN);
  return NEAR_MARGIN + (margin - NEAR_MARGIN) * Math.min(1, e / MARGIN_RAMP);
}

// The worst shortfall of air under the carrier over the line's open part (outside the stations' level
// stretches): { short, s } (short <= 0: clear everywhere).
export function worstClearance(towers, total, groundAt, drop, { ropeH = 11.5, margin = LINE_MARGIN, step = 2 } = {}) {
  let w = { short: -Infinity, s: 0 };
  for (let s = STATION_IN; s <= total - STATION_IN; s += step) {
    const short = groundAt(s) + drop + marginAt(s, total, margin) - ropeY(towers, s, ropeH);
    if (short > w.short) w = { short, s };
  }
  return w;
}

// Adds towers (or raises them) until the carrier clears the ground everywhere. Returns the towers (sorted,
// the new ones marked `added`, the raised ones with their new h) and what is left short (0 when clear).
export function clearRope(towers, total, groundAt, drop, { ropeH = 11.5, margin = LINE_MARGIN, maxH = 3 * ropeH, step = 2 } = {}) {
  towers = towers.map((t) => ({ ...t }));
  for (let it = 0; it < 64; it++) {
    const w = worstClearance(towers, total, groundAt, drop, { ropeH, margin, step });
    if (w.short <= 0) return { towers, short: 0 };
    // On the low point, or as near it as a tower may stand (not inside a station).
    const at = Math.min(total - NO_TOWER, Math.max(NO_TOWER, w.s)), near = towers.reduce((m, t) => Math.min(m, Math.abs(t.s - at)), Infinity);
    if (near >= TOWER_GAP) {
      // As tall as the rope needs there and a metre more (a short tower by a station, as real lines have
      // one), never taller than the lift's own towers.
      const y = groundAt(at), need = ropeY(towers, at, ropeH) - y + w.short + 1;
      towers.push({ s: at, y, h: Math.min(ropeH, Math.max(drop + marginAt(at, total, margin) + 2, need)), added: true });
      towers.sort((a, b) => a.s - b.s);
      continue;
    }
    // Raise the regular tower nearest the low point by what the rope needs there (the rope at w.s moves by
    // the tower's share of it, 1 - |w.s - tower| / span).
    let k = 1;
    while (k < towers.length - 1 && towers[k].s < w.s) k++;
    const cand = [towers[k - 1], towers[k]].filter((t) => !t.station && t !== towers[0] && t !== towers[towers.length - 1]);
    if (!cand.length) return { towers, short: w.short };
    const t = cand.sort((a, b) => Math.abs(a.s - w.s) - Math.abs(b.s - w.s))[0];
    const span = towers[k].s - towers[k - 1].s, share = Math.max(0.1, 1 - Math.abs(t.s - w.s) / (span || 1));
    const h = Math.min(maxH, (t.h ?? ropeH) + w.short / share + 0.05);
    if (h <= (t.h ?? ropeH) + 1e-6) return { towers, short: w.short };
    t.h = h; t.raised = true;
  }
  return { towers, short: Math.max(0, worstClearance(towers, total, groundAt, drop, { ropeH, margin, step }).short) };
}

// ---------- A tram (aerialway=cable_car): two cabins to and fro, no loop ----------
// A jig-back tram has one cabin on each track rope, tied to the same haul rope: one goes up while the other
// comes down, they pass mid-way, and each stops in its dock. Ridden, the pace eases out of the dock and
// into the next (`tramPace`: a share of the line's speed, full after `TRAM_EASE` metres, never under
// `TRAM_CRAWL`). Seen from elsewhere, `jigBack` says where the up-going cabin is at a time: a dwell in the
// bottom dock, up, a dwell at the top, down; the other cabin is its mirror (total - s).
export const TRAM_EASE = 80, TRAM_CRAWL = 0.12, TRAM_DWELL = 25;
export function tramPace(d, total, ease = TRAM_EASE) {
  const e = Math.max(0, Math.min(d, total - d));
  return Math.max(TRAM_CRAWL, Math.min(1, Math.sqrt(e / ease)));
}
// The tram's towers: its real ones, the line's inner nodes in OpenStreetMap (a tram's line is straight, so its
// nodes are its towers), none inside a dock (`NO_TOWER`). pts [[x, z]…]; returns s along the line of each.
export function tramTowers(pts, noTower = NO_TOWER) {
  const seg = (i) => Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += seg(i);
  const out = [];
  for (let i = 1, s = 0; i < pts.length - 1; i++) {
    s += seg(i);
    if (s > noTower && s < total - noTower) out.push(s);
  }
  return out;
}
// Where the up-going cabin is (metres from the bottom dock) at time t (s), on a line `total` long run at v m/s
// with `dwell` s in each dock: { s, up } (up: on its way up; false: docked or on its way down).
export function jigBack(t, total, v, dwell = TRAM_DWELL) {
  const run = total / Math.max(0.1, v), cycle = 2 * (run + dwell), p = ((t % cycle) + cycle) % cycle;
  if (p < dwell) return { s: 0, up: false };
  if (p < dwell + run) return { s: (p - dwell) * v, up: true };
  if (p < 2 * dwell + run) return { s: total, up: false };
  return { s: total - (p - 2 * dwell - run) * v, up: false };
}
