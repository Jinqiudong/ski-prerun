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

// How deep into the edge, 0..1, from the board's edge angle (radians, either sign) and the speed (m/s): the
// load of the turn. Nothing near a flat base; a medium turn at a medium speed (about 36° at 30 km/h) is a
// moderate version (about 0.4); all of it only on a hard carve (about 49°) fast (54 km/h and up). Eased in,
// so the posture builds as the turn loads up rather than jumping with the first bit of edge.
export const EDGE_FLAT = 0.08, EDGE_FULL = 0.85, SPEED_FULL = 15;
export function carveDepth(edge, speed = 10) {
  const t = clamp((Math.abs(edge) - EDGE_FLAT) / (EDGE_FULL - EDGE_FLAT), 0, 1);
  const load = t * (0.35 + 0.65 * clamp((speed || 0) / SPEED_FULL, 0, 1));
  return load ** 1.4;
}

// The depth over time: no faster than building a new edge in about RISE_S seconds or leaving one in LEAVE_S
// (a little quicker), so the posture never jumps however quick the roll.
export const RISE_S = 0.6, LEAVE_S = 0.35;
// Leaving follows the edge straight down (capped), so by the time the board is flat the old edge's posture
// has gone; building eases in.
export function depthStep(cur, target, dt) {
  if (target <= cur) return Math.max(target, cur - dt / LEAVE_S);
  return Math.min(cur + (target - cur) * Math.min(1, dt * 8), cur + dt / RISE_S);
}

// A slew limit: from prev toward want by at most maxStep.
export const slew = (prev, want, maxStep) => prev + clamp(want - prev, -maxStep, maxStep);
// The body's speed limits, whatever the clips and the layer ask: the hips up or down (m/s), the pelvis and
// the trunk tipping toward the toes or the heels (rad/s), in the world (so the board can roll under a body
// that stays centred, crossing under, rather than the body flipping with it).
export const HIP_SPEED = 0.6, TRUNK_SPEED = 2, PELVIS_SPEED = 2.5;
// Rising out of a deep sit may be quicker than sinking into one: held low while the board rolls to the toe
// edge at speed, the shins would fold over the boots past what an ankle in a boot can (joint-core.js Foot).
export const HIP_RISE = 1.1;
// The hips' allowed move this frame: down by HIP_SPEED, up by HIP_RISE (m/s).
export const hipSlew = (prev, want, dt) => prev + clamp(want - prev, -HIP_SPEED * dt, HIP_RISE * dt);

// The shape at full depth on each side.
//   hipIn: hips toward the toes (− : toward the heels), leg lengths; hipDown: hips toward the board.
//   trunk: (heel side) the trunk's tilt toward the toes (rad), measured on the board (hips to neck), that
//   the trunk is brought to; on the toe side the trunk follows the thighs instead (align); twist: the chest turned to face the toes more (− : opened toward the nose), rad.
//   sit: (heel side) how far the hips sink as into a chair, full by SIT_AT of depth: a moderate turn is
//   already a clear sit; the deepest sit comes from the heel carve clip and the inclination on a hard one.
//   lean: how much of the physics' inclination the rider's body shows. On the toe side at full lean (about
//   46°) the shins would lie near the snow and it reads as kneeling; leaned 20% less (about 37°), with the
//   legs extended (hipDown < 0) and the hips driven in, it reads as a laid-out carve, knees off the snow.
export const SHAPES = {
  toe: { hipIn: 0.27, hipDown: -0.09, lean: 0.8, twist: 0.14 },
  heel: { hipIn: -0.16, hipDown: 0, sit: 0.09, trunk: 0.45, lean: 1, twist: -0.16 },
};

// The layer for a moment of the ride: toe and heel depths (0..1, at most one of them non-zero, but a blend
// is fine) to { hipIn, hipDown, twist } scaled by depth; the trunk's tilt `trunk` and how
// far it is brought to it (`trunkK`, the heel side's); and `align` with `bend`: how far the pelvis and the
// trunk are brought into line with the thighs and the bend left at the hip.
// On the toe side the hips are driven forward from the first bit of edge, not only on a deep carve (the
// owner: 顶出去, hips and butt pushed out in one straight line with the thighs): full by ALIGN_AT of depth,
// bent at the hip by no more than HIP_BEND; the hips' drive forward ramps in with it. The lean into the
// turn then comes from the ankles, the knees and the whole body's inclination, never from folding at the
// waist.
// Between the edges (`neutral`, 0..1: riding, not skidding, pushing or in a trick) the body passes through
// a tall, centred stance: the legs a little extended (NEUTRAL_RISE) and the trunk stacked over the hips,
// bent at the hip by NEUTRAL_BEND, not the clips' crouch with the butt out. On the heel side the trunk
// is brought to its own tilt instead, by HEEL_TRUNK_AT of depth.
export const NEUTRAL_TRUNK = 0.1;
export const ALIGN_AT = 0.05, HIP_BEND = 0.06, NEUTRAL_BEND = 0.3, NEUTRAL_RISE = -0.05, HEEL_TRUNK_AT = 0.15, SIT_AT = 0.35;
// How far into line, from the toe depth alone (boarder.js eases it over time).
export const alignOf = (toe) => clamp(toe / ALIGN_AT, 0, 1);
export function carveLayer(toe, heel, alignTo = null, neutral = 0) {
  const T = SHAPES.toe, H = SHAPES.heel;
  const align = (alignTo ?? alignOf(toe)) * (1 - clamp(heel / 0.08, 0, 1)), drive = 0.55 * align + 0.45 * clamp(toe, 0, 1);
  const hw = clamp(heel / HEEL_TRUNK_AT, 0, 1), flat = clamp(1 - (toe + heel) / 0.3, 0, 1);
  const out = { hipIn: 0, hipDown: 0, twist: 0, trunk: H.trunk, trunkK: hw, align: 0, bend: 0, alignToe: 0, upright: 0 };
  for (const key of ["hipDown", "twist"]) out[key] = T[key] * toe + H[key] * heel;
  out.hipDown += NEUTRAL_RISE * clamp(neutral, 0, 1) * flat + H.sit * clamp(heel / SIT_AT, 0, 1);
  out.hipIn = T.hipIn * drive + H.hipIn * heel;
  out.align = (align + (1 - align) * clamp(neutral, 0, 1)) * (1 - hw);
  out.bend = NEUTRAL_BEND + (HIP_BEND - NEUTRAL_BEND) * align;
  out.alignToe = align * (1 - hw); // the toe side's part of it (boarder.js drops the angulation by it)
  // Between the edges the trunk is stacked tall over the board in the world (NEUTRAL_TRUNK from vertical,
  // toward the toes), not tipped with it as the board rolls: the board rolls under a centred body.
  out.upright = (1 - align) * clamp(neutral, 0, 1) * (1 - hw);
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

// The arms while riding, relaxed and quiet (boarder.js armsBody). Directions in the board's frame as [toward the
// toes, up, toward the nose]: each upper arm's (from the shoulder), the side its forearm bends toward and the
// elbow's soft bend (rad). Riding along: the lead arm forward over the nose, the rear arm low by the back hip;
// on the heel side both forward (out in front of the chest, the toes' side) for balance; on the toe side the
// hands low and forward. Never out sideways at shoulder height, never pointing back. A rigged animal's short
// arms stay nearer its sides.
const ARMS = {
  ride: { lead: [0.3, -0.75, 0.6], rear: [0.15, -0.95, -0.2] },
  toe: { lead: [0.5, -0.75, 0.45], rear: [0.35, -0.9, -0.05] },
  heel: { lead: [0.7, -0.4, 0.5], rear: [0.75, -0.5, 0.1] },
};
export const ARM_SPEED = 3; // rad/s, each upper arm and forearm
const unit = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
export function armTargets(toe = 0, heel = 0, pet = false) {
  const t = clamp(toe / 0.3, 0, 1), h = clamp(heel / 0.3, 0, 1), r = Math.max(0, 1 - t - h);
  const mix = (k) => unit([0, 1, 2].map((i) => ARMS.ride[k][i] * r + ARMS.toe[k][i] * t + ARMS.heel[k][i] * h));
  const side = (v) => (pet ? unit([v[0] * 0.6, v[1] - 0.3, v[2] * 0.6]) : v);
  return {
    lead: { upper: side(mix("lead")), bendTo: [0.6, 0.2, 0.8], elbow: 0.5 },
    rear: { upper: side(mix("rear")), bendTo: [0.8, 0.3, 0.2], elbow: 0.45 },
  };
}
