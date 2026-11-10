// Human joint limits, as numbers (no three.js; tested: tests/joint.test.mjs). boarder.js clamps every bone of a
// rider's skeleton to these last (a safety net: the riding key poses, the clips, a trick
// blending in), so a big movement never bends a joint past what a person's can.
//
// Quaternions are [x, y, z, w]; vectors [x, y, z]. A joint is measured in its parent's space, from the rig's own
// rest pose (measured per template, never assumed):
//   d0   the bone's direction at rest (to its child), in the parent's space;
//   a1   the "forward" swing axis: turning d0 about a1 by a positive angle moves the bone's tip toward the
//        body's front (flexion for a thigh, a spine or an arm; for a shin, knee flexion is negative);
//   a2   the "side" swing axis, d0 × a1: turning about it moves the tip across the body (sign depends on the
//        bone's direction; the right side's ranges are the left's mirrored);
//   twist about d0 itself.
// A bone's local rotation q = swing · twist · rest, the swing's rotation vector split into its a1 and a2 parts
// (fwd, side), and each of fwd, side and twist kept within its range.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const DEG = Math.PI / 180;

// --- small quaternion and vector helpers ---
export const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
export const qnorm = (q) => { const n = Math.hypot(...q) || 1; return q.map((v) => v / n); };
export const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const vnorm = (a) => { const n = Math.hypot(...a) || 1; return a.map((v) => v / n); };
export const qrot = (q, v) => { const p = qmul(qmul(q, [v[0], v[1], v[2], 0]), qconj(q)); return [p[0], p[1], p[2]]; };
export const qaxis = (axis, ang) => { const s = Math.sin(ang / 2), a = vnorm(axis); return [a[0] * s, a[1] * s, a[2] * s, Math.cos(ang / 2)]; };
// The rotation vector (axis × angle) of a unit quaternion, the short way round.
export function qlog(q) {
  const w = q[3] < 0 ? -1 : 1, v = [q[0] * w, q[1] * w, q[2] * w], s = Math.hypot(...v);
  if (s < 1e-9) return [0, 0, 0];
  const ang = 2 * Math.atan2(s, q[3] * w);
  return v.map((x) => (x / s) * ang);
}
export const qexp = (r) => { const a = Math.hypot(...r); return a < 1e-12 ? [0, 0, 0, 1] : qaxis(r, a); };

// The shortest turn taking unit vector a to unit vector b.
export function qfromTo(a, b) {
  const d = vdot(a, b);
  if (d < -0.999999) { let p = vcross([1, 0, 0], a); if (Math.hypot(...p) < 1e-6) p = vcross([0, 1, 0], a); return qaxis(p, Math.PI); }
  const c = vcross(a, b); return qnorm([c[0], c[1], c[2], 1 + d]);
}
const rotAbout = (v, axis, ang) => qrot(qaxis(axis, ang), v);

// A joint's frame, from the rig at rest: rest (the bone's local rest rotation), axis (the bone's direction to its
// child in its own space) and the body's front, all in the parent's space.
// For a hinge (the elbow, the knee) also pAxis, the parent bone's own direction in its space: the hinge's axis h
// is the one its rest bend turns about (pAxis × d0), or, for a joint straight at rest (the knee), the one that
// bends it backward.
export function jointFrame(rest, axis, front, pAxis = null) {
  const d0 = vnorm(qrot(rest, axis));
  let hinge = null;
  if (pAxis) {
    const p = vnorm(pAxis), bent = vcross(p, d0);
    const h = Math.hypot(...bent) > Math.sin(10 * DEG) ? vnorm(bent) : vnorm(vcross(p, front.map((v) => -v)));
    hinge = { p, h };
  }
  let a1 = vcross(d0, front);
  if (Math.hypot(...a1) < 0.2) a1 = vcross(d0, [front[1], front[2], front[0]]); // pointing straight forward (a foot): any perpendicular
  a1 = vnorm(a1); // turning d0 about d0 × front moves its tip by (d0 × front) × d0: toward the front
  const a2 = vnorm(vcross(d0, a1));
  return { rest, d0, a1, a2, axis: vnorm(axis), hinge };
}

// A hinge's bend: { flex (rad, 0 = straight, + = bent the way it bends), off (out of its plane, rad) }.
export function hingeOf(q, f) {
  const { p, h } = f.hinge, d = vnorm(qrot(q, f.axis));
  const off = Math.asin(clamp(vdot(d, h), -1, 1));
  const dp = vnorm(d.map((v, i) => v - h[i] * vdot(d, h)));
  return { flex: Math.atan2(vdot(vcross(p, dp), h), vdot(p, dp)), off, d };
}
// Keep a hinge within [lo, hi] of bend and ±offMax out of its plane: { q, hit }.
export function limitHinge(q, f, lo, hi, offMax) {
  const { flex, off, d } = hingeOf(q, f);
  const fl = clamp(flex, lo, hi), of = clamp(off, -offMax, offMax);
  if (fl === flex && of === off) return { q, hit: "" };
  const inPlane = rotAbout(f.hinge.p, f.hinge.h, fl), want = vnorm(inPlane.map((v, i) => v * Math.cos(of) + f.hinge.h[i] * Math.sin(of)));
  return { q: qnorm(qmul(qfromTo(d, want), q)), hit: [fl !== flex ? (flex > hi ? "flex" : "hyperextend") : "", of !== off ? "sideways" : ""].filter(Boolean).join(",") };
}

// A local rotation as { fwd, side, twist } (radians) about the joint's frame.
export function decompose(q, f) {
  const delta = qmul(q, qconj(f.rest));
  // twist about d0: the part of delta's vector along d0
  const p = vdot([delta[0], delta[1], delta[2]], f.d0);
  let tw = [f.d0[0] * p, f.d0[1] * p, f.d0[2] * p, delta[3]];
  const n = Math.hypot(...tw); tw = n < 1e-9 ? [0, 0, 0, 1] : tw.map((v) => v / n);
  const swing = qmul(delta, qconj(tw));
  const r = qlog(swing);
  const tr = qlog(tw);
  return { fwd: vdot(r, f.a1), side: vdot(r, f.a2), twist: vdot(tr, f.d0) };
}
export function compose({ fwd, side, twist }, f) {
  const r = [0, 1, 2].map((i) => f.a1[i] * fwd + f.a2[i] * side);
  return qnorm(qmul(qmul(qexp(r), qaxis(f.d0, twist)), f.rest));
}

// Ranges (radians) for each joint, as the LEFT side's (or a midline bone's): fwd, side and twist [min, max]; the
// right side's are mirrored (rangesFor). Anatomical, and wide enough that every pose of every ride clip (F, M,
// the capybara) falls inside, as measured on the rigs: they catch what the procedural layers do, not the clips.
const R = (a, b) => [a * DEG, b * DEG];
export const LIMITS = {
  Spine: { fwd: R(-25, 50), side: R(-30, 30), twist: R(-30, 30) },
  Chest: { fwd: R(-20, 35), side: R(-25, 25), twist: R(-30, 30) },
  Neck: { fwd: R(-35, 45), side: R(-35, 35), twist: R(-50, 50) },
  Head: { fwd: R(-35, 35), side: R(-30, 30), twist: R(-50, 50) },
  Shoulder: { fwd: R(-15, 15), side: R(-28, 15), twist: R(-12, 12) }, // the clavicle: a small range
  // The upper arm: no more than ~38° behind the body's plane; raised (side −, for the left arm) up to 130° and
  // across the body to 80°. Its twist about its own length is not limited: the swing-twist split of an arm
  // swung far from the rig's rest (arms out) is not a reliable measure of a shoulder's roll (the clips' own
  // poses read up to ±178°); the elbow's hinge and the arms layer keep it honest instead.
  UpperArm: { fwd: R(-38, 160), side: R(-130, 80), twist: R(-180, 180) },
  Forearm: { fwd: R(-180, 180), side: R(-180, 180), twist: R(-80, 80) }, // a hinge (HINGES); here its twist only
  Hand: { fwd: R(-60, 60), side: R(-35, 35), twist: R(-105, 25) },
  Thigh: { fwd: R(-25, 135), side: R(-115, 50), twist: R(-90, 50) },
  Shin: { fwd: R(-180, 180), side: R(-180, 180), twist: R(-10, 10) }, // a hinge (HINGES)
  // In a boot strapped to the board: counted, not clamped (clamping would pull the boot off the binding).
  Foot: { fwd: R(-30, 55), side: R(-50, 50), twist: R(-40, 40), logOnly: true },
};
// The hinges: bend from lo to hi (0 = straight), no more than off out of their plane.
export const HINGES = {
  Forearm: { lo: 0, hi: 145 * DEG, off: 20 * DEG }, // the elbow: never hyperextended, never sideways
  Shin: { lo: -2 * DEG, hi: 150 * DEG, off: 6 * DEG }, // the knee
};
// Which part of a bone's name picks its limits (Hips, the board and the sockets have none).
export function limitsOf(name) {
  const base = name.replace(/[._]?[LR]$/, "").replace(/\./g, "");
  return LIMITS[base] || null;
}
export const sideOf = (name) => (/[._]?L$/.test(name) ? "L" : /[._]?R$/.test(name) ? "R" : "M");
// The ranges for a bone on a given side: the right side mirrored (side and twist flip).
export function rangesFor(lim, side, flipFwd = false) {
  const m = side === "R", f = (r) => [-r[1], -r[0]];
  return { fwd: flipFwd ? f(lim.fwd) : lim.fwd, side: m ? f(lim.side) : lim.side, twist: m ? f(lim.twist) : lim.twist, logOnly: !!lim.logOnly };
}

// Keep a local rotation within its ranges: { q, hit } where hit names what was clamped ("" if nothing) and q is
// the input itself when nothing was.
export function limitJoint(q, f, rng) {
  const c = decompose(q, f);
  let hit = "";
  const k = { fwd: clamp(c.fwd, rng.fwd[0], rng.fwd[1]), side: clamp(c.side, rng.side[0], rng.side[1]), twist: clamp(c.twist, rng.twist[0], rng.twist[1]) };
  for (const key of ["fwd", "side", "twist"]) if (k[key] !== c[key]) hit += (hit ? "," : "") + key;
  return { q: hit ? compose(k, f) : q, hit, c };
}
