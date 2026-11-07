import test from "node:test";
import assert from "node:assert/strict";
import { G, DEG, wrap, fallLine, dropAlong, gravityAlong, boardGravity, slipAngle, brakeOf, edgeGrip, pivotFor, brakeDecel, edgeTrails, scrubOf, governor } from "../src/ride/edge-core.js";

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
// A plane tilted `slope` down toward yaw `dir`: its up normal.
const normal = (slope, dir) => ({ x: Math.sin(slope) * Math.sin(dir), y: Math.cos(slope), z: Math.sin(slope) * Math.cos(dir) });

test("fall line and slope from the normal", () => {
  const f = fallLine(normal(25 * DEG, 1.1));
  near(f.yaw, 1.1); near(f.slope, 25 * DEG);
  near(fallLine({ x: 0, y: 1, z: 0 }).slope, 0);
});

test("drop along a heading: down the fall line tan(slope), across 0, up negative", () => {
  const n = normal(20 * DEG, 0.4);
  near(dropAlong(n, 0.4), Math.tan(20 * DEG));
  near(dropAlong(n, 0.4 + Math.PI / 2), 0);
  near(dropAlong(n, 0.4 + Math.PI), -Math.tan(20 * DEG));
});

test("gravity along the board falls off with its angle to the fall line", () => {
  near(boardGravity(30 * DEG, 0), G * Math.sin(30 * DEG));
  near(boardGravity(30 * DEG, 90 * DEG), 0);
  assert.ok(boardGravity(30 * DEG, 45 * DEG) < boardGravity(30 * DEG, 20 * DEG));
  assert.ok(boardGravity(30 * DEG, 135 * DEG) < 0); // pointing uphill: slows you
  near(gravityAlong(Math.tan(10 * DEG)), G * Math.sin(10 * DEG));
});

test("slip angle folds to 0..90 (a board runs nose or tail first)", () => {
  near(slipAngle(0.3, 0.3), 0);
  near(slipAngle(Math.PI / 2, 0), Math.PI / 2);
  near(slipAngle(Math.PI - 0.2, 0), 0.2);
  near(slipAngle(-0.5, 2 * Math.PI), 0.5);
  near(wrap(3 * Math.PI), Math.PI);
});

test("brake: none up to 45°, full at 90°, linear between", () => {
  assert.equal(brakeOf(0), 0);
  assert.equal(brakeOf(45 * DEG), 0);
  near(brakeOf(60 * DEG), 1 / 3);
  near(brakeOf(67.5 * DEG), 0.5);
  assert.equal(brakeOf(90 * DEG), 1);
  // a full brake out-pulls any slope: it takes gravity's pull and 3.5 m/s² more
  near(brakeDecel(1, 6), 9.5); assert.equal(brakeDecel(0, 6), 0); near(brakeDecel(1, -2), 3.5);
});

test("pivot for a brake input: past 45° for a touch, 90° at full", () => {
  assert.equal(pivotFor(0), 0);
  assert.ok(pivotFor(0.05) < 45 * DEG);
  assert.ok(pivotFor(0.2) > 45 * DEG && pivotFor(0.2) < 60 * DEG);
  near(pivotFor(1), 90 * DEG);
  for (let k = 0.01; k < 1; k += 0.01) assert.ok(pivotFor(k + 0.01) >= pivotFor(k)); // never backs off as you press harder
});

test("edge grip: a flat base slides, a high edge carves", () => {
  assert.equal(edgeGrip(0), 0);
  assert.equal(edgeGrip(40 * DEG), 1);
  assert.ok(edgeGrip(15 * DEG) > 0.2 && edgeGrip(15 * DEG) < 0.8);
  assert.ok(scrubOf(30 * DEG, 0) > scrubOf(30 * DEG, 1)); // a low edge scrubs more
  assert.equal(scrubOf(0, 0), 0);
  near(scrubOf(80 * DEG, 0), scrubOf(45 * DEG, 0)); // past 45° it's the brake's job
});

test("which edge bites: turned toward the set edge it trails, the other way it is caught", () => {
  assert.ok(edgeTrails(0.8, 1)); assert.ok(edgeTrails(-0.8, -1));
  assert.ok(!edgeTrails(0.8, -1)); assert.ok(!edgeTrails(-1.2, 1));
});

test("governor: easy pace, then heel-side turns skid, then every turn", () => {
  assert.equal(governor(9, 11), 0);
  assert.equal(governor(0.85 * 11, 11), 0);
  near(governor(11, 11), 1);
  assert.equal(governor(11, 11, false), 0); // a toe-side turn still carves
  assert.ok(governor(1.08 * 11, 11, false) > 0.6);
  assert.equal(governor(30, 11, false), 1);
});
