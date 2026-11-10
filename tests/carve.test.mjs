import test from "node:test";
import assert from "node:assert/strict";
import { armTargets, ARM_SPEED, hipSlew, HIP_SPEED as HS, HIP_RISE, carveDepth, depthStep, slew, carveLayer, alignOf, leanScale, twoBone, SHAPES, EDGE_FLAT, ALIGN_AT, HIP_BEND, HEEL_TRUNK_AT, HEEL_LET_GO, NEUTRAL_RISE, RISE_S, LEAVE_S, HIP_SPEED, TRUNK_SPEED } from "../src/rider/carve-core.js";

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const KMH = (v) => v / 3.6;

test("depth: the turn's load, from edge angle and speed; deep only on a hard fast carve", () => {
  near(carveDepth(0, 10), 0);
  near(carveDepth(EDGE_FLAT * 0.9, 10), 0);
  near(carveDepth(0.87, KMH(54)), 1); // a hard carve at speed: all of it
  near(carveDepth(-0.87, KMH(54)), 1); // either edge
  const moderate = carveDepth(0.62, KMH(30)); // a medium turn at 30 km/h (about 36° of edge)
  assert.ok(moderate > 0.25 && moderate < 0.5, `moderate ${moderate}`);
  assert.ok(carveDepth(0.87, KMH(30)) < 0.75, "full lean but slow: not the deepest");
  assert.ok(carveDepth(0.22, KMH(30)) < 0.1, "a gentle turn: barely");
  assert.ok(carveDepth(0.45, 14) > carveDepth(0.45, 3));
  for (let e = 0; e <= 1; e += 0.05) assert.ok(carveDepth(e + 0.01, 10) >= carveDepth(e, 10)); // never less with more edge
});

test("depth over time: builds a new edge in about RISE_S, leaves in LEAVE_S, never jumps", () => {
  const dt = 1 / 60;
  let d = 0, t = 0;
  while (d < 0.9 && t < 5) { d = depthStep(d, 1, dt); t += dt; }
  assert.ok(t >= 0.9 * RISE_S - 1e-9 && t <= RISE_S + 0.2, `90% built in ${t}`);
  while (d < 0.999) d = depthStep(d, 1, dt);
  let steps = 0; while (d > 0) { const n = depthStep(d, 0, dt); assert.ok(d - n <= dt / LEAVE_S + 1e-9); d = n; steps++; }
  near(steps * dt, LEAVE_S, 2 * dt);
  assert.ok(LEAVE_S < RISE_S, "leaving a little quicker than building");
  near(depthStep(0.3, 0.2, dt), Math.max(0.2, 0.3 - dt / LEAVE_S)); // leaving follows the edge down
});

test("slew: no further than the step either way", () => {
  near(slew(0, 1, 0.1), 0.1); near(slew(0, -1, 0.1), -0.1); near(slew(0.5, 0.52, 0.1), 0.52);
  assert.ok(HIP_SPEED <= 0.6 && TRUNK_SPEED <= 2);
});

test("layer: toe side drives the hips in over the toes, in line with the thighs; heel side sits low and back", () => {
  const toe = carveLayer(1, 0), heel = carveLayer(0, 1), flat = carveLayer(0, 0);
  assert.ok(toe.hipIn > 0.15 && toe.hipDown <= 0, "toe: hips forward, legs extended, not dropped");
  assert.ok(toe.align === 1 && toe.alignToe === 1 && toe.bend <= 10 * Math.PI / 180, "toe: pelvis and trunk in line with the thighs, no butt out");
  assert.ok(heel.hipIn < 0 && heel.hipDown > 0.05, "heel: hips back and low");
  assert.ok(heel.trunk > 0.2 && heel.trunkK === 1, "heel: chest up, forward over the knees");
  for (const k of ["hipIn", "hipDown", "twist", "trunkK", "upright"]) near(flat[k], 0);
});

test("toe side: in line with the thighs from the first bit of edge", () => {
  near(carveLayer(ALIGN_AT, 0).align, 1);
  near(alignOf(0), 0); near(alignOf(ALIGN_AT), 1); near(alignOf(ALIGN_AT / 2), 0.5);
  near(carveLayer(0.2, 0, 0.3).align, 0.3); // eased by the caller
  assert.ok(HIP_BEND > 0 && HIP_BEND <= 10 * Math.PI / 180);
  near(carveLayer(0.3, HEEL_LET_GO, 1).alignToe, 0); // gone once on the heel edge
});

test("between the edges: a tall, centred stance", () => {
  const mid = carveLayer(0, 0, 0, 1);
  near(mid.hipDown, NEUTRAL_RISE); assert.ok(mid.hipDown < 0, "legs a little extended");
  near(mid.align, 0); near(mid.upright, 1); // pelvis and trunk stacked tall in the world, not held to the thighs
  const heel = carveLayer(0, 0.5, 0, 1);
  near(heel.upright, 0); near(heel.trunkK, 1); // on the heel edge its own trunk
  // through the switch nothing jumps: each value moves little from a small toe to a small heel depth (the
  // toe line's align, eased over time by boarder.js, is still about 0 there)
  const a = carveLayer(0.01, 0, 0.02, 1), b = carveLayer(0, 0.01, 0, 1);
  for (const k of ["hipIn", "hipDown", "twist"]) assert.ok(Math.abs(a[k] - b[k]) < 0.02, k);
});

test("into and out of the heel edge the trunk and the pelvis hand over smoothly, not in a frame or two", () => {
  // the weights of the tall moment and of the heel side's trunk change no faster than ~1.6/HEEL_TRUNK_AT per unit of
  // depth (smoothstep), over at least a quarter of the depth (the depth builds at most 1/RISE_S per second)
  assert.ok(HEEL_TRUNK_AT >= 0.3 && HEEL_LET_GO >= 0.2);
  let worst = 0;
  for (let h = 0; h < 0.6; h += 0.005) {
    const a = carveLayer(0, h, 0, 1), b = carveLayer(0, h + 0.005, 0, 1);
    for (const k of ["trunkK", "upright", "align"]) worst = Math.max(worst, Math.abs(b[k] - a[k]) / 0.005);
  }
  assert.ok(worst < 1.6 / HEEL_TRUNK_AT, `steepest ${worst}`);
  const t = carveLayer(0.3, 0, 1, 1), t2 = carveLayer(0.3, 0.02, 1, 1); // the toe line lets go gently too
  assert.ok(Math.abs(t.align - t2.align) < 0.05);
});

test("arms carried, not hanging dead along the trunk", () => {
  for (const [toe, heel] of [[0, 0], [1, 0], [0, 1], [0.15, 0], [0, 0.15]]) {
    const a = armTargets(toe, heel);
    for (const k of ["lead", "rear"]) {
      assert.ok(a[k].upper[0] > 0.45, `${k} held in front of the body (${toe},${heel}): ${a[k].upper}`);
      assert.ok(a[k].upper[1] > -0.85, `${k} not straight down`);
      assert.ok(a[k].elbow >= 0.6, "elbows bent, an athletic carriage");
    }
  }
});

test("heel sit: moderate on a medium turn, deep only at the top end", () => {
  const moderate = carveLayer(0, carveDepth(0.62, KMH(30))), hard = carveLayer(0, 1);
  assert.ok(moderate.hipDown > 0 && moderate.hipDown <= hard.hipDown);
  near(carveLayer(0, 0.5).hipIn, SHAPES.heel.hipIn * 0.5);
});

test("lean: the body shows less of the inclination deep on the toe side only", () => {
  near(leanScale(0, 0), 1); near(leanScale(0, 1), 1);
  const deep = leanScale(1, 0);
  assert.ok(deep > 0.7 && deep < 0.95, `${deep}`);
  assert.ok(leanScale(0.3, 0) > deep && leanScale(0.3, 0) < 1);
});

test("two-bone leg: law of cosines, held within reach", () => {
  const s = twoBone(0.45, 0.45, 0.45 * Math.sqrt(2));
  near(s.hip, Math.PI / 4); near(s.knee, Math.PI / 2);
  near(twoBone(0.4, 0.4, 2).knee, 0, 0.05); // out of reach: straight
  const f = twoBone(0.4, 0.4, 0.01);
  near(f.d, 0.3 * 0.8); // folded no further than 30% of the leg
});

test("arms: relaxed and quiet, never out sideways at shoulder height or pointing back", () => {
  for (const [toe, heel] of [[0, 0], [1, 0], [0, 1], [0.5, 0], [0, 0.5], [0.2, 0]]) for (const pet of [false, true]) {
    const a = armTargets(toe, heel, pet);
    for (const k of ["lead", "rear"]) {
      const [toes, up, nose] = a[k].upper;
      assert.ok(up < -0.3, `${k} below the shoulder (${toe},${heel})`);
      assert.ok(nose > -0.3, `${k} not pointing back`);
      assert.ok(a[k].elbow > 0.2 && a[k].elbow < 1.2, "a soft elbow");
    }
    assert.ok(a.lead.upper[2] > a.rear.upper[2], "the lead arm toward the nose, the rear one by the back hip");
  }
  const heel = armTargets(0, 1), toe = armTargets(1, 0);
  assert.ok(heel.lead.upper[0] > 0.5 && heel.rear.upper[0] > 0.5, "heel side: both arms forward");
  assert.ok(toe.lead.upper[1] < -0.6 && toe.rear.upper[1] < -0.6 && toe.lead.upper[0] > 0.3, "toe side: hands low and forward");
  assert.ok(ARM_SPEED <= 3);
});

test("hips: sink no faster than HIP_SPEED, rise a little quicker", () => {
  near(hipSlew(0.8, 0.2, 0.1), 0.8 - HS * 0.1); near(hipSlew(0.3, 0.9, 0.1), 0.3 + HIP_RISE * 0.1);
  assert.ok(HIP_RISE >= HS);
});
