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

// ---------- Skis (a look's ch.sport "ski": 双板) ----------
// Two skis pointing the way you go, turned by rolling both onto their edges: the same edge, turn and travel as
// the board (tilt, steer and the S line unchanged). What differs is the speed control, and it is the same to
// either side (no heel and toe):
//   glide   nothing asked;
//   plough  a light brake, or any brake when slow (under PLOUGH_V): the tips together, the tails pushed out, a
//           wedge that scrubs speed with no turn of the skis across the way you go;
//   skid    a brake at speed in a turn: the skis swing on round into the turn, across the way you go (the
//           turn's shape), braking as the board does past 45° (brakeOf); it holds through the edge change;
//   hockey  a hard brake (HARD) at speed: both skis thrown 90° across, into the turn you were in (or toward
//           the uphill side going straight), a full stop.
export const SKI = { PLOUGH_V: 4.5, HARD: 0.75, PUSH_V: 4.5, PUSH_A: 1.5 };
export function skiMode(bk, speed, steer, prev = "glide") {
  if (bk < 0.05) return "glide";
  if (bk >= SKI.HARD && (speed > 2.5 || prev === "hockey")) return "hockey"; // and held across to the stop
  if (speed < SKI.PLOUGH_V) return "plough";
  if (Math.abs(steer) >= 0.2 || prev === "skid" || prev === "hockey") return "skid";
  return "plough";
}
// Which way the skis swing across (+1 / −1, as yaw turns): into the turn being made (steer > 0 turns right,
// yaw going down), else the last turn's way, else toward the uphill side of the way you go (off: travel −
// fall line, signed), so a straight run stops the short way round.
export const skiSide = (steer, last = 0, off = 0) => (Math.abs(steer) > 0.15 ? -Math.sign(steer) : last || (off >= 0 ? 1 : -1));
// The skis' angle across the way you go for a mode (signed by side): a skid from 45° up to 70°, a hockey stop 88°.
export const skiPivot = (mode, bk, side) => side * (mode === "hockey" ? 88 * DEG : mode === "skid" ? Math.min(70 * DEG, pivotFor(bk)) : 0);
// The wedge for a brake input (0..1, full from 0.4), and its deceleration (m/s², >= 0): it takes most of the pull
// down the slope and 1.6 m/s² more, so it stops you on the gentle snow a plough is for, and only slows you on a
// steep pitch.
export const ploughOf = (bk) => clamp(bk / 0.4, 0, 1);
export const ploughDecel = (wedge, along) => wedge * (0.55 * Math.max(0, along) + 1.6);
// The guided ride's speed control on skis: the same governor, but every turn finishes the same, round and a
// little skidded, to either side (the owner disliked one side braking).
export const skiGovernor = (speed, cap) => governor(speed, cap, true);
