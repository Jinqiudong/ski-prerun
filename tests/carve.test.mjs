import test from "node:test";
import assert from "node:assert/strict";
import { KEYS, KEY_NAMES, keyWeights, spring, leanScale, twoBone, EDGE_FLAT, EDGE_CARVE, EDGE_FULL, EDGE_T, EDGE_W, TOE_LEAN, KNEES_OUT } from "../src/rider/carve-core.js";

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const DEG = 180 / Math.PI;
const sum = (w) => Object.values(w).reduce((a, v) => a + v, 0);

test("the edge spring: critically damped, no overshoot, most of a step in about EDGE_T", () => {
  const dt = 1 / 60;
  let s = { x: 0, v: 0 }, t = 0, max = 0, at63 = null;
  while (t < 2) { s = spring(s.x, s.v, 0.6, dt); t += dt; max = Math.max(max, s.x); if (at63 === null && s.x >= 0.6 * 0.632) at63 = t; }
  assert.ok(max <= 0.6 + 1e-9, `overshoot ${max}`);
  near(s.x, 0.6, 1e-4);
  assert.ok(at63 > 0.6 * EDGE_T && at63 < 1.5 * EDGE_T, `63% in ${at63}s`);
  // a hard reversal: the velocity changes continuously (bounded acceleration, no jumps)
  let a = { x: 0.6, v: 0 }, prev = 0, worst = 0;
  for (let i = 0; i < 60; i++) { a = spring(a.x, a.v, -0.6, dt); worst = Math.max(worst, Math.abs(a.v - prev)); prev = a.v; }
  assert.ok(worst <= EDGE_W * EDGE_W * 1.2 * dt * 1.01, `velocity step ${worst}`);
  const b = spring(0.2, 0.5, 0.2, 0); near(b.x, 0.2); near(b.v, 0.5); // no time, no change
});

test("weights: the key poses blend to 1; straight running is the neutral stance", () => {
  for (const e of [0, 0.05, 0.2, 0.4, 0.6, 0.9]) for (const toe of [true, false]) for (const [sk, tu] of [[0, 0], [0.5, 0], [0, 0.6], [1, 1]]) {
    const w = keyWeights(e, toe, sk, tu);
    near(sum(w), 1);
    for (const k of KEY_NAMES) assert.ok(w[k] >= 0 && w[k] <= 1 + 1e-9, k);
    assert.ok(toe ? w.heel + w.heelDeep === 0 : w.toe + w.toeDeep === 0, "one edge at a time");
  }
  near(keyWeights(0, true).neutral, 1);
  near(keyWeights(EDGE_FLAT * 0.9, false).neutral, 1); // a phone held nearly level: still neutral
  near(keyWeights(EDGE_CARVE, true).neutral, 0); near(keyWeights(EDGE_CARVE, true).toe, 1);
  near(keyWeights(EDGE_FULL, false).heelDeep, 1); // a hard carve: the deep pose
  assert.ok(keyWeights(0.35, false).heelDeep === 0, "a medium turn: not deep");
  near(keyWeights(0.3, true, 1).skid, 1);
});

test("weights move smoothly with the edge and pass through neutral from edge to edge", () => {
  let worst = 0;
  for (let e = -0.9; e < 0.9; e += 0.002) {
    const a = keyWeights(e, e < 0), b = keyWeights(e + 0.002, e + 0.002 < 0);
    for (const k of KEY_NAMES) worst = Math.max(worst, Math.abs(a[k] - b[k]) / 0.002);
  }
  assert.ok(worst < 1.6 / Math.min(EDGE_CARVE - EDGE_FLAT, EDGE_FULL - EDGE_CARVE), `steepest ${worst}`); // smoothsteps over the carve's and the deep carve's ranges
  near(keyWeights(0.02, true).neutral, 1); near(keyWeights(-0.02, false).neutral, 1); // the tall moment
});

// The trunk's tilt toward the toes in the world (deg), roughly: the blended poses' tilt on the board plus the
// board's own lean (toward the toes on the toe edge, the heels on the heel edge).
function trunkWorld(e, toe) {
  const w = keyWeights(e, toe), onBoard = KEY_NAMES.reduce((a, k) => a + w[k] * KEYS[k].trunk.tilt, 0);
  return onBoard + (toe ? 1 : -1) * Math.abs(e) * leanScale(w) * DEG;
}

// (Into a toe-side turn the whole body leans into the hill with the board: up to ~40° there is a laid-out carve.)
test("the trunk: a little forward running straight, never laid back into a turn", () => {
  assert.ok(KEYS.neutral.trunk.tilt >= 5 && KEYS.neutral.trunk.tilt <= 15, "athletic: 5-15° forward");
  for (const toe of [true, false]) for (let e = 0; e <= 0.9; e += 0.01) {
    const t = trunkWorld(e, toe);
    assert.ok(t > -5 && t < 40, `${toe ? "toe" : "heel"} edge ${e.toFixed(2)}: trunk ${t.toFixed(1)}°`);
  }
});

test("key poses: toe side hips over the toes in line with the thighs; heel side sitting low, chest forward", () => {
  const { neutral: N, toe: T, toeDeep: TD, heel: H, heelDeep: HD, skid: S } = KEYS;
  assert.ok(T.hip[0] > 0.05 && TD.hip[0] > T.hip[0], "toe: hips pushed in over the toes");
  assert.ok(Math.abs(T.pelvis.tilt - T.trunk.tilt) <= 5 && Math.abs(TD.pelvis.tilt - TD.trunk.tilt) <= 5, "toe: pelvis and trunk one line, no butt out");
  assert.ok(H.hip[0] < 0 && H.hip[1] < N.hip[1] - 0.15 && HD.hip[1] < H.hip[1], "heel: hips back and low, lower when deep");
  assert.ok(H.trunk.tilt >= 25 && HD.trunk.tilt > H.trunk.tilt, "heel: chest up and forward over the knees");
  assert.ok(N.hip[1] > 0.9 && Math.abs(N.hip[0]) < 0.03, "neutral: tall, hips over the board's centre");
  assert.ok(S.hip[0] < 0 && S.trunk.tilt > 15, "skid: sitting back onto the heels, chest forward");
  for (const k of KEY_NAMES) assert.ok(KEYS[k].head.tilt * (k.startsWith("toe") ? -1 : 1) >= -5, `${k}: the head held up against the lean`);
  assert.ok(KNEES_OUT > 0 && KNEES_OUT < 0.6, "knees over the toes, a little out");
});

test("key poses: arms carried low and in front, never out at shoulder height or pointing back", () => {
  for (const k of KEY_NAMES) for (const side of ["lead", "rear"]) {
    const { upper, fore } = KEYS[k].arms[side], n = Math.hypot(...upper), [toes, up, nose] = upper.map((x) => x / n);
    assert.ok(up < -0.45, `${k} ${side}: upper arm down, the hand below the chest (${up.toFixed(2)})`);
    assert.ok(toes > 0.25, `${k} ${side}: held in front of the body`);
    assert.ok(Math.abs(nose) < 0.7, `${k} ${side}: not out along the board`);
    const f = Math.hypot(...fore), fu = fore[1] / f;
    assert.ok(fu < 0.3, `${k} ${side}: forearm not raised`);
  }
  for (const k of KEY_NAMES) assert.ok(KEYS[k].arms.lead.upper[2] > KEYS[k].arms.rear.upper[2], `${k}: the lead arm toward the nose`);
});

test("lean: the board and body show a little less of the inclination deep on the toe side only", () => {
  near(leanScale(keyWeights(0, true)), 1);
  near(leanScale(keyWeights(0.9, false)), 1);
  const deep = leanScale(keyWeights(0.9, true));
  near(deep, TOE_LEAN, 0.02);
  assert.ok(deep > 0.7 && deep < 0.95);
});

test("two-bone leg: law of cosines, held within reach", () => {
  const s = twoBone(0.45, 0.45, 0.45 * Math.sqrt(2));
  near(s.hip, Math.PI / 4); near(s.knee, Math.PI / 2);
  near(twoBone(0.4, 0.4, 2).knee, 0, 0.05);
  near(twoBone(0.4, 0.4, 0.01).d, 0.3 * 0.8);
});
