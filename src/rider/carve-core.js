// The riding body as numbers (no three.js; tested): a few whole-body key poses, each a correct snowboarder's
// stance on its own, and how they are blended from the ride. boarder.js builds each key pose once per rider on
// its own skeleton (buildKeys) and plays the blend; nothing else moves the body while riding, so the whole body
// moves as one and every frame is a mix of poses that each look right.
//
// A key pose is written in the board's frame as directions [toward the toes, up off the base, toward the nose]
// and angles in degrees:
//   hip    [in, h]: the hips' centre over the bindings' midpoint, toward the toes (− : the heels) and up, in leg
//          lengths (thigh + shin), so a short-legged rider (the capybara) bends as much by its own size. The legs
//          are bent by a two-bone IK to keep the boots in the bindings.
//   pelvis { tilt, open }: the pelvis's tilt toward the toes off the base's normal (hips to lower back), and how
//          far its front is turned from the toes toward the nose.
//   trunk  { tilt, open }: the same for the trunk (the spine and the chest as one: a firm core, no S-bend).
//   head   { tilt, look, pitch }: the head's up tilted toward the toes (a deep carve's head stays near level in the
//          world: tilted against the board's lean), its face turned `look` from the toes toward the nose (down the
//          hill) and pitched down by `pitch`.
//   arms   { lead, rear }: the upper arm's and the forearm's directions (the lead arm is the nose's side); the elbow
//          bends on its hinge. Hands below the chest, never out at shoulder height, never behind.
// Reference: coaching photos of toe- and heel-side carves (knees forward and hips over the toe edge, the body one
// line from the knees up; on the heels sitting down as into a chair, chest up and forward, arms forward).

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); }; // eased at both ends: no kink in the motion

const RIDE_ARMS = { lead: { upper: [0.45, -0.75, 0.5], fore: [0.6, -0.25, 0.75] }, rear: { upper: [0.42, -0.82, -0.3], fore: [0.75, -0.4, 0.15] } };
export const KEYS = {
  // Straight running: an athletic stance, knees softly bent, hips over the board's centre, trunk a little forward.
  neutral: { hip: [0, 0.95], pelvis: { tilt: 12, open: 15 }, trunk: { tilt: 10, open: 25 }, head: { tilt: 0, look: 70, pitch: 12 }, arms: RIDE_ARMS },
  // Toe side (前刃): knees forward, the hips pushed forward over the toes in one line with the thighs (顶胯), the
  // trunk upright in the world once the board leans (a little back of the base's normal on the board).
  toe: { hip: [0.12, 0.92], pelvis: { tilt: -6, open: 10 }, trunk: { tilt: -8, open: 15 }, head: { tilt: -12, look: 65, pitch: 10 },
    arms: { lead: { upper: [0.45, -0.82, 0.35], fore: [0.65, -0.35, 0.65] }, rear: { upper: [0.4, -0.9, -0.1], fore: [0.75, -0.45, 0.2] } } },
  toeDeep: { hip: [0.2, 0.88], pelvis: { tilt: -12, open: 10 }, trunk: { tilt: -12, open: 15 }, head: { tilt: -24, look: 60, pitch: 8 },
    arms: { lead: { upper: [0.5, -0.8, 0.3], fore: [0.7, -0.3, 0.6] }, rear: { upper: [0.45, -0.88, -0.05], fore: [0.8, -0.4, 0.2] } } },
  // Heel side (后刃): sitting into the heels, hips low and back, the chest up and forward over the knees.
  heel: { hip: [-0.12, 0.72], pelvis: { tilt: 26, open: 20 }, trunk: { tilt: 34, open: 30 }, head: { tilt: 12, look: 70, pitch: 10 },
    arms: { lead: { upper: [0.6, -0.65, 0.45], fore: [0.75, -0.1, 0.6] }, rear: { upper: [0.65, -0.72, 0], fore: [0.85, -0.2, 0.35] } } },
  heelDeep: { hip: [-0.17, 0.62], pelvis: { tilt: 34, open: 22 }, trunk: { tilt: 48, open: 30 }, head: { tilt: 26, look: 65, pitch: 8 },
    arms: { lead: { upper: [0.7, -0.55, 0.45], fore: [0.8, 0, 0.6] }, rear: { upper: [0.75, -0.62, 0.05], fore: [0.9, -0.1, 0.35] } } },
  // Braking: the board across, sitting back onto the heel edge, arms forward and low (never the skid clip's T-pose).
  skid: { hip: [-0.12, 0.76], pelvis: { tilt: 22, open: 20 }, trunk: { tilt: 26, open: 30 }, head: { tilt: 8, look: 35, pitch: 12 },
    arms: { lead: { upper: [0.6, -0.68, 0.4], fore: [0.8, -0.15, 0.55] }, rear: { upper: [0.65, -0.74, -0.05], fore: [0.85, -0.25, 0.35] } } },
  // A tuck (or the knees soaking up a bump): low, the chest down over the knees, hands in front of them.
  tuck: { hip: [-0.04, 0.7], pelvis: { tilt: 32, open: 15 }, trunk: { tilt: 40, open: 25 }, head: { tilt: -5, look: 70, pitch: -5 },
    arms: { lead: { upper: [0.55, -0.78, 0.25], fore: [0.45, -0.55, 0.65] }, rear: { upper: [0.55, -0.8, -0.1], fore: [0.6, -0.6, 0.4] } } },
};
export const KEY_NAMES = Object.keys(KEYS);
// The knees point over the toes and a little out toward each end of the board (toward the nose for the lead leg).
export const KNEES_OUT = 0.35;

// The edge angles (rad): below EDGE_FLAT the base is flat (neutral); the carve pose is full by EDGE_CARVE and the
// deep one by EDGE_FULL. The physics' lean already carries the speed (tan lean = speed × turn rate / g): a deep
// edge only comes with a fast, hard turn.
export const EDGE_FLAT = 0.08, EDGE_CARVE = 0.5, EDGE_FULL = 0.85;

// The edge, smoothed: a critically damped spring (no overshoot), about EDGE_T seconds to most of a step. The
// one scalar the whole body follows; the board's lean uses it too, so the body and the board move together.
export const EDGE_T = 0.25, EDGE_W = 2.15 / EDGE_T;
export function spring(x, v, target, dt, w = EDGE_W) {
  // exact step of x'' = w²(target − x) − 2w x'
  const e = Math.exp(-w * dt), d = x - target, c = v + w * d;
  return { x: target + (d + c * dt) * e, v: (v - w * c * dt) * e };
}

// The key poses' weights for a moment of the ride: { neutral, toe, toeDeep, heel, heelDeep, skid, tuck } summing
// to 1. edge: the smoothed edge angle (rad, either sign); toe: on the toe edge (else the heel); skid, tuck: 0..1.
// The carve pose grows out of neutral with the edge (full by EDGE_CARVE), the deep one after it (by EDGE_FULL),
// each a smoothstep, so the body's angulation keeps pace with the board's lean (the trunk upright in the world,
// never laid back into the turn) and nothing moves with a kink. Between the edges the blend passes through the
// neutral stance (the tall moment), so changing edge never sits down suddenly.
export function keyWeights(edge, toe, skid = 0, tuck = 0) {
  const w = Object.fromEntries(KEY_NAMES.map((k) => [k, 0])), e = Math.abs(edge);
  const c = smooth((e - EDGE_FLAT) / (EDGE_CARVE - EDGE_FLAT)), deep = smooth((e - EDGE_CARVE) / (EDGE_FULL - EDGE_CARVE));
  const s = clamp(skid, 0, 1), t = clamp(tuck, 0, 1) * (1 - s), r = 1 - s - t;
  w.neutral = (1 - c) * r; w[toe ? "toe" : "heel"] = (c - deep) * r; w[toe ? "toeDeep" : "heelDeep"] = deep * r;
  w.skid = s; w.tuck = t;
  return w;
}

// How much of the physics' inclination the board and the body show: a deep toe-side carve a little less (at
// full lean the shins would lie near the snow and it reads as kneeling).
export const TOE_LEAN = 0.85;
export const leanScale = (w) => 1 - (1 - TOE_LEAN) * ((w.toeDeep || 0) + 0.5 * (w.toe || 0));

export const DEG = Math.PI / 180;

// A two-bone leg reaching from the hip to the foot: thigh l1, shin l2, the foot at d. The thigh's angle off
// the hip-to-foot line (rad) and the knee's bend (0 = straight). d is held within reach: no shorter than
// `fold` of the leg (the knee can only fold so far) and no longer than the leg itself.
export function twoBone(l1, l2, d, fold = 0.3) {
  const L = l1 + l2, dd = clamp(d, Math.max(Math.abs(l1 - l2) + 1e-6, fold * L), L * 0.9999);
  const hip = Math.acos(clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1));
  const knee = Math.PI - Math.acos(clamp((l1 * l1 + l2 * l2 - dd * dd) / (2 * l1 * l2), -1, 1));
  return { d: dd, hip, knee };
}
