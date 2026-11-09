import test from "node:test";
import assert from "node:assert/strict";
import { DEG, qmul, qaxis, qrot, qnorm, vnorm, vdot, jointFrame, decompose, compose, limitJoint, hingeOf, limitHinge, limitsOf, sideOf, rangesFor, LIMITS, HINGES } from "../src/rider/joint-core.js";

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const qnear = (a, b, e = 1e-6) => assert.ok(Math.abs(Math.abs(vdot(a, b) + a[3] * b[3]) - 1) < e, `${a} vs ${b}`);
const FRONT = [0, 0, 1];
// A bone pointing down its parent's −y (a thigh, a shin) and one pointing up (a spine), from an identity rest.
const down = jointFrame([0, 0, 0, 1], [0, -1, 0], FRONT), up = jointFrame([0, 0, 0, 1], [0, 1, 0], FRONT);

test("decompose / compose round-trip, from any rest", () => {
  const rest = qnorm([0.2, -0.1, 0.3, 0.9]), f = jointFrame(rest, [0, 1, 0], FRONT);
  for (const c of [{ fwd: 0.3, side: -0.2, twist: 0.4 }, { fwd: -0.5, side: 0.1, twist: -0.3 }, { fwd: 0, side: 0, twist: 0 }]) {
    const q = compose(c, f), d = decompose(q, f);
    near(d.fwd, c.fwd, 1e-6); near(d.side, c.side, 1e-6); near(d.twist, c.twist, 1e-6);
  }
  const d0 = decompose(rest, f); near(d0.fwd, 0); near(d0.side, 0); near(d0.twist, 0);
});

test("fwd is toward the body's front for a bone pointing up or down", () => {
  // the tip of a down bone turned +fwd moves to +z (front), so does an up bone's
  const tipDown = qrot(compose({ fwd: 0.5, side: 0, twist: 0 }, down), [0, -1, 0]), tipUp = qrot(compose({ fwd: 0.5, side: 0, twist: 0 }, up), [0, 1, 0]);
  assert.ok(tipDown[2] > 0.4 && tipUp[2] > 0.4);
});

test("a joint within its range is left exactly as it was; out of range it is brought to the edge", () => {
  const rng = { fwd: [-0.5, 1], side: [-0.3, 0.3], twist: [-0.2, 0.2] };
  const q = compose({ fwd: 0.4, side: 0.1, twist: 0 }, up), r = limitJoint(q, up, rng);
  assert.equal(r.hit, ""); assert.equal(r.q, q);
  const far = limitJoint(compose({ fwd: 1.6, side: -0.6, twist: 0.5 }, up), up, rng);
  assert.equal(far.hit, "fwd,side,twist");
  const d = decompose(far.q, up); near(d.fwd, 1, 1e-6); near(d.side, -0.3, 1e-6); near(d.twist, 0.2, 1e-6);
});

test("a hinge: bends one way only, never past its range, never sideways", () => {
  const p = [0, 1, 0], f = jointFrame([0, 0, 0, 1], [0, 1, 0], FRONT, p); // a knee straight at rest
  const { lo, hi, off } = HINGES.Shin;
  // knee flexion takes the shin back (−z)
  const bent = qaxis(f.hinge.h, 1.2), hb = hingeOf(bent, f); near(hb.flex, 1.2, 1e-6); near(hb.off, 0, 1e-6);
  assert.ok(qrot(bent, [0, 1, 0])[2] < 0, "a knee bends backward");
  assert.equal(limitHinge(bent, f, lo, hi, off).hit, "");
  const hyper = limitHinge(qaxis(f.hinge.h, -0.4), f, lo, hi, off); assert.equal(hyper.hit, "hyperextend"); near(hingeOf(hyper.q, f).flex, lo, 1e-6);
  const over = limitHinge(qaxis(f.hinge.h, 3), f, lo, hi, off); assert.equal(over.hit, "flex"); near(hingeOf(over.q, f).flex, hi, 1e-6);
  const sideways = limitHinge(qmul(qaxis([0, 0, 1], 0.4), bent), f, lo, hi, off);
  assert.ok(/sideways/.test(sideways.hit)); assert.ok(Math.abs(hingeOf(sideways.q, f).off) <= off + 1e-6);
  // an elbow bent 35° at rest: its hinge is the rest bend's
  const e = jointFrame(qaxis([1, 0, 0], 35 * DEG), [0, 1, 0], FRONT, [0, 1, 0]);
  near(hingeOf(e.rest, e).flex, 35 * DEG, 1e-6);
  assert.equal(limitHinge(qaxis([1, 0, 0], -10 * DEG), e, HINGES.Forearm.lo, HINGES.Forearm.hi, HINGES.Forearm.off).hit, "hyperextend");
});

test("the ranges are anatomical", () => {
  assert.ok(HINGES.Forearm.lo === 0 && Math.abs(HINGES.Forearm.hi - 145 * DEG) < 1e-9, "elbow 0..145°");
  assert.ok(HINGES.Shin.hi <= 150 * DEG + 1e-9 && HINGES.Shin.off <= 6 * DEG + 1e-9, "knee to 150°, a few degrees sideways");
  assert.ok(LIMITS.UpperArm.fwd[0] >= -40 * DEG && LIMITS.UpperArm.fwd[0] <= -30 * DEG, "an arm no more than 30-40° behind the back");
  assert.ok(LIMITS.Shoulder.twist[1] <= 15 * DEG && LIMITS.Shoulder.fwd[1] <= 20 * DEG, "the clavicle: small");
  assert.ok(LIMITS.Hand.fwd[1] <= 60 * DEG && LIMITS.Hand.side[1] <= 35 * DEG, "a wrist");
  for (const k of ["Spine", "Chest", "Neck", "Head"]) for (const r of ["fwd", "side", "twist"]) assert.ok(LIMITS[k][r][1] - LIMITS[k][r][0] <= 100 * DEG, `${k} ${r}`);
  assert.ok(LIMITS.Foot.logOnly, "the boot stays on the binding: counted, not clamped");
});

test("names and sides: the right side mirrored", () => {
  assert.equal(limitsOf("UpperArmL"), LIMITS.UpperArm); assert.equal(limitsOf("Thigh.R"), LIMITS.Thigh); assert.equal(limitsOf("Hips"), null); assert.equal(limitsOf("Hand_L_Socket"), null);
  assert.equal(sideOf("ShinL"), "L"); assert.equal(sideOf("Foot.R"), "R"); assert.equal(sideOf("Spine"), "M");
  const l = rangesFor(LIMITS.Thigh, "L"), r = rangesFor(LIMITS.Thigh, "R");
  assert.deepEqual(r.fwd, l.fwd); near(r.side[0], -l.side[1]); near(r.side[1], -l.side[0]); near(r.twist[0], -l.twist[1]);
});

test("a mirrored pose decomposes to the mirrored numbers", () => {
  // the same pose on the left and right legs (mirror x): fwd equal, side and twist opposite
  const fl = jointFrame([0, 0, 0, 1], vnorm([0.17, -0.99, 0]), FRONT), fr = jointFrame([0, 0, 0, 1], vnorm([-0.17, -0.99, 0]), FRONT);
  const c = { fwd: 0.6, side: 0.3, twist: 0.2 }, ql = compose(c, fl), qr = [ql[0], -ql[1], -ql[2], ql[3]]; // a reflection across x
  const dl = decompose(ql, fl), dr = decompose(qr, fr);
  near(dr.fwd, dl.fwd, 1e-6); near(dr.side, -dl.side, 1e-6); near(dr.twist, -dl.twist, 1e-6);
});
