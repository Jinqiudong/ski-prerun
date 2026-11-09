import test from "node:test";
import assert from "node:assert/strict";
import { carveDepth, carveLayer, leanScale, twoBone, SHAPES, EDGE_FLAT } from "../src/rider/carve-core.js";

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test("depth: none on a flat board, more with edge and speed, all of it on a hard fast carve", () => {
  near(carveDepth(0, 10), 0);
  near(carveDepth(EDGE_FLAT * 0.5, 10), 0);
  near(carveDepth(0.8, 14), 1);
  near(carveDepth(-0.8, 14), 1); // either edge
  const gentle = carveDepth(0.22, 7), mid = carveDepth(0.45, 7);
  assert.ok(gentle > 0.1 && gentle < 0.5, `gentle ${gentle}`);
  assert.ok(mid > gentle && mid < 1);
  assert.ok(carveDepth(0.45, 14) > carveDepth(0.45, 3));
  for (let e = 0; e <= 1; e += 0.05) assert.ok(carveDepth(e + 0.01, 10) >= carveDepth(e, 10)); // never less with more edge
});

test("layer: toe side drives the hips in over the toes and stands tall; heel side sits low and back", () => {
  const toe = carveLayer(1, 0), heel = carveLayer(0, 1), flat = carveLayer(0, 0);
  assert.ok(toe.hipIn > 0.15 && toe.hipDown <= 0, "toe: hips forward, legs extended, not dropped");
  assert.ok(toe.trunk < 0, "toe: chest stacked back over the hips, not folded forward");
  assert.ok(heel.hipIn < 0 && heel.hipDown > 0.03, "heel: hips back and low");
  assert.ok(heel.trunk > 0.2, "heel: chest up, forward over the knees");
  assert.ok(heel.armIn > 0.5, "heel: arms forward");
  assert.ok(toe.armDown > 0.4, "toe: hands low");
  for (const k of ["hipIn", "hipDown", "twist", "armIn", "armDown", "trunkK"]) near(flat[k], 0);
});

test("layer scales with depth and blends through flat without a jump", () => {
  const half = carveLayer(0.5, 0);
  near(half.hipIn, SHAPES.toe.hipIn * 0.5); near(half.trunkK, 0.5); near(half.trunk, SHAPES.toe.trunk);
  const a = carveLayer(0.01, 0), b = carveLayer(0, 0.01);
  for (const k of ["hipIn", "hipDown", "twist", "armIn", "armDown"]) assert.ok(Math.abs(a[k] - b[k]) < 0.02, k);
});

test("two-bone leg: law of cosines, held within reach", () => {
  const s = twoBone(0.45, 0.45, 0.45 * Math.sqrt(2));
  near(s.hip, Math.PI / 4); near(s.knee, Math.PI / 2);
  near(twoBone(0.4, 0.4, 2).knee, 0, 0.05); // out of reach: straight
  const f = twoBone(0.4, 0.4, 0.01);
  near(f.d, 0.3 * 0.8); // folded no further than 30% of the leg
});

test("lean: the body shows less of the inclination deep on the toe side only", () => {
  near(leanScale(0, 0), 1); near(leanScale(0, 1), 1);
  const deep = leanScale(1, 0);
  assert.ok(deep > 0.7 && deep < 0.95, `${deep}`);
  assert.ok(leanScale(0.3, 0) > deep && leanScale(0.3, 0) < 1);
});
