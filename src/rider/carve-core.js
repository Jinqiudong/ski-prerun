// The carving body on each edge, as numbers (no three.js; tested). boarder.js lays it over the ride clips,
// whose toe-side and heel-side carves are posed on a flat board and hardly differ from the stance.
//   Toe side (前刃): the hips driven forward and in over the toe edge (顶胯), knees into the hill, the
//   pelvis and the trunk in one straight line with the thighs (no bend at the hip, no butt out), the chest
//   over the hips, the hands low and forward.
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
//   trunk: (heel side) the trunk's tilt toward the toes (rad), measured on the board (hips to neck), that
//   the trunk is brought to; on the toe side the trunk follows the thighs instead (align); twist: the chest turned to face the toes more (− : opened toward the nose), rad.
//   armIn / armDown: added to each upper arm's direction, toward the toes and down (unit-ish), then aimed.
//   lean: how much of the physics' inclination the rider's body shows. On the toe side at full lean (about
//   46°) the shins would lie near the snow and it reads as kneeling; leaned 20% less (about 37°), with the
//   legs extended (hipDown < 0) and the hips driven in, it reads as a laid-out carve, knees off the snow.
export const SHAPES = {
  toe: { hipIn: 0.27, hipDown: -0.09, lean: 0.8, twist: 0.14, armIn: 0.55, armDown: 0.7 },
  heel: { hipIn: -0.16, hipDown: 0.07, trunk: 0.45, lean: 1, twist: -0.16, armIn: 0.9, armDown: 0.1 },
};

// The layer for a moment of the ride: toe and heel depths (0..1, at most one of them non-zero, but a blend
// is fine) to { hipIn, hipDown, twist, armIn, armDown } scaled by depth, plus trunk (its target tilt) and
// trunkK (how far the trunk is brought to it, 0..1).
// On the toe side the hips are driven forward from the first bit of edge, not only on a deep carve (the
// owner: 顶出去, hips and butt pushed out in one straight line with the thighs): `align` (0..1, full by
// ALIGN_AT of depth) is how far the pelvis and the trunk are brought into line with the thighs, bent at
// the hip by no more than HIP_BEND; the hips' drive forward ramps in with it. The lean into the turn then
// comes from the ankles, the knees and the whole body's inclination, never from folding at the waist.
export const ALIGN_AT = 0.4, HIP_BEND = 0.06;
// How far into line, from the toe depth alone (boarder.js eases it in and out over time: leaving the toe
// edge, the pelvis swings back to the clip's stance over a few frames, not in one).
export const alignOf = (toe) => clamp(toe / ALIGN_AT, 0, 1);
export function carveLayer(toe, heel, alignTo = null) {
  const T = SHAPES.toe, H = SHAPES.heel, k = toe + heel;
  const align = alignTo ?? alignOf(toe), drive = 0.55 * align + 0.45 * clamp(toe, 0, 1);
  const out = { hipIn: 0, hipDown: 0, twist: 0, armIn: 0, armDown: 0, trunk: 0, trunkK: clamp(heel, 0, 1), align, bend: HIP_BEND };
  for (const key of ["hipDown", "twist", "armIn", "armDown"]) out[key] = T[key] * toe + H[key] * heel;
  out.hipIn = T.hipIn * drive + H.hipIn * heel;
  out.trunk = H.trunk; // the heel side's trunk tilt (the toe side's follows the thighs: align)
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
