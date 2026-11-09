// The carving body on each edge, as numbers (no three.js; tested). boarder.js lays it over the ride clips,
// whose toe-side and heel-side carves are posed on a flat board and hardly differ from the stance.
//   Toe side (前刃): the hips driven forward and in over the toe edge (顶胯), knees into the hill, the chest
//   tall and upright over the hips (not folded at the waist, butt out), the hands low and forward.
//   Heel side (后刃): sitting down as into a chair, the hips low and back over the heel edge, the knees bent,
//   the chest up and leaning a little forward over the knees, the arms reaching forward for balance.
// Lengths are in leg lengths (thigh + shin), so a short-legged rider (the capybara) bends as much, by its
// own size. "Toward the toes" is the side the toes point to, across the board; "down" is into the board.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// How deep into the edge, 0..1, from its angle (radians, either sign) and the speed (m/s): nothing on a
// flat board, a mild version on a gentle turn, all of it on a hard carve (about 43° of edge) at speed.
export const EDGE_FLAT = 0.06, EDGE_FULL = 0.75;
export function carveDepth(edge, speed = 10) {
  const t = clamp((Math.abs(edge) - EDGE_FLAT) / (EDGE_FULL - EDGE_FLAT), 0, 1);
  const fast = 0.75 + 0.25 * clamp((speed || 0) / 12, 0, 1);
  return t * (2 - t) * fast; // eased out: a little edge already shows
}

// The shape at full depth on each side.
//   hipIn: hips toward the toes (− : toward the heels), leg lengths; hipDown: hips toward the board.
//   trunk: the trunk's tilt toward the toes (rad), measured on the board (hips to neck), that the trunk is
//   brought to; twist: the chest turned to face the toes more (− : opened toward the nose), rad.
//   armIn / armDown: added to each upper arm's direction, toward the toes and down (unit-ish), then aimed.
//   lean: how much of the physics' inclination the rider's body shows. On the toe side at full lean (about
//   46°) the shins would lie near the snow and it reads as kneeling; leaned 20% less (about 37°), with the
//   legs extended (hipDown < 0) and the hips driven in, it reads as a laid-out carve, knees off the snow.
export const SHAPES = {
  toe: { hipIn: 0.27, hipDown: -0.09, trunk: -0.12, lean: 0.8, twist: 0.14, armIn: 0.55, armDown: 0.7 },
  heel: { hipIn: -0.16, hipDown: 0.07, trunk: 0.45, lean: 1, twist: -0.16, armIn: 0.9, armDown: 0.1 },
};

// The layer for a moment of the ride: toe and heel depths (0..1, at most one of them non-zero, but a blend
// is fine) to { hipIn, hipDown, twist, armIn, armDown } scaled by depth, plus trunk (its target tilt) and
// trunkK (how far the trunk is brought to it, 0..1).
export function carveLayer(toe, heel) {
  const T = SHAPES.toe, H = SHAPES.heel, k = toe + heel;
  const out = { hipIn: 0, hipDown: 0, twist: 0, armIn: 0, armDown: 0, trunk: 0, trunkK: clamp(k, 0, 1) };
  for (const key of ["hipIn", "hipDown", "twist", "armIn", "armDown"]) out[key] = T[key] * toe + H[key] * heel;
  out.trunk = k > 1e-6 ? (T.trunk * toe + H.trunk * heel) / k : 0;
  return out;
}

// How much of the inclination the body shows (1 = all of it), by the toe and heel depths.
export function leanScale(toe, heel) {
  return 1 - (1 - SHAPES.toe.lean) * clamp(toe, 0, 1) - (1 - SHAPES.heel.lean) * clamp(heel, 0, 1);
}

// A two-bone leg reaching from the hip to the foot: thigh l1, shin l2, the foot at d. The thigh's angle off
// the hip-to-foot line (rad) and the knee's bend (0 = straight). d is held within reach: no shorter than
// `fold` of the leg (the knee can only fold so far) and no longer than the leg itself.
export function twoBone(l1, l2, d, fold = 0.3) {
  const L = l1 + l2, dd = clamp(d, Math.max(Math.abs(l1 - l2) + 1e-6, fold * L), L * 0.9999);
  const hip = Math.acos(clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1));
  const knee = Math.PI - Math.acos(clamp((l1 * l1 + l2 * l2 - dd * dd) / (2 * l1 * l2), -1, 1));
  return { d: dd, hip, knee };
}
