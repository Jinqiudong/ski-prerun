// The board on its edge, as numbers (no three.js; tested): the fall line under the rider, how much of
// gravity the board's angle to it lets through, and the brake when the board is turned across the way
// you move. Angles in radians; yaw 0 = +z, the way board.js measures heading.
export const G = 9.8, DEG = Math.PI / 180;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// The fall line from the snow's normal n ({x, y, z}, up, unit): yaw = the way straight down, slope = how
// steep (0 = flat).
export function fallLine(n) {
  return { yaw: Math.atan2(n.x, n.z), slope: Math.acos(clamp(n.y, -1, 1)) };
}

// Meters of drop per horizontal meter along yaw (negative = uphill).
export const dropAlong = (n, yaw) => (n.x * Math.sin(yaw) + n.z * Math.cos(yaw)) / n.y;

// Gravity along a line with that drop: g·sin(its pitch). Straight down the fall line it is g·sin(slope);
// across it, nothing.
export const gravityAlong = (drop) => (G * drop) / Math.sqrt(1 + drop * drop);

// The same from the board's angle off the fall line (0 = pointing straight down).
export const boardGravity = (slope, off) => gravityAlong(Math.tan(slope) * Math.cos(off));

// How far the board is turned across the way you move, 0..90° (a board runs either way: nose or tail).
export function slipAngle(boardYaw, heading) {
  const b = Math.abs(wrap(boardYaw - heading));
  return b > Math.PI / 2 ? Math.PI - b : b;
}

// The brake from the board across the way you move, on its uphill edge: none up to 45°, all of it at 90°,
// linear in between.
export const brakeOf = (slip) => clamp((slip - 45 * DEG) / (45 * DEG), 0, 1);

// How cleanly the edge holds, 0..1, from its angle off the snow: a flat base slides (0), past ~30° it
// carves (1), smoothstep in between.
export function edgeGrip(edge) {
  const t = clamp((Math.abs(edge) - 4 * DEG) / (26 * DEG), 0, 1);
  return t * t * (3 - 2 * t);
}

// How far to swing the board across for a brake input 0..1: a touch sets it a little past 45° (just
// starting to bite), all the way is 90° (a full stop).
export const pivotFor = (k) => (k <= 0 ? 0 : (45 + 45 * clamp(k, 0, 1)) * DEG * Math.min(1, k / 0.15));

// The deceleration of the brake (m/s², >= 0): it cancels the pull down the slope along the way you move
// and takes 3.5 m/s² more, so a full brake stops you on any slope.
export const brakeDecel = (brake, along) => brake * (Math.max(0, along) + 3.5);

// Which edge bites as the board slides: slip = board yaw − travel heading (signed); side = the edge set,
// as the way it turns the nose (+1/−1). With the board turned toward the edge that is set, that edge trails
// (it is the uphill edge, and it brakes); turned the other way the set edge leads into the slide: caught.
export const edgeTrails = (slip, side) => Math.sign(wrap(slip)) === Math.sign(side);

// Skid friction (a coefficient) from a board turned up to 45° off the way it moves: more on a low edge
// that slides than on a high one that carves.
export const scrubOf = (slip, grip) => 0.3 * Math.sin(Math.min(slip, 45 * DEG)) ** 2 * (1 - 0.8 * grip);

// The guided ride's speed control, as a brake input 0..1. Under 85% of the pace nothing; past it the
// heel-side turns finish skidded (the board swung on round, across the way you go), harder the faster you
// are (all the way at the pace), while the toe-side ones still carve; past the pace every turn skids, all
// the way at 112%.
export function governor(speed, cap, heelTurn = true) {
  return Math.max(heelTurn ? clamp((speed - 0.85 * cap) / (0.15 * cap), 0, 1) : 0, clamp((speed - cap) / (0.12 * cap), 0, 1));
}
