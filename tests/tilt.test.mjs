import test from "node:test";
import assert from "node:assert/strict";
import { tiltRead } from "../src/ride/tilt-core.js";

const D = Math.PI / 180;
const run = (zero, side, fwd, secs, settle) => { let o; for (let t = 0; t < secs; t += 1 / 30) o = tiltRead(zero, side, fwd, 1 / 30, settle); return o; };

test("a lean back brakes, a lean forward speeds up, a side tip steers", () => {
  assert.equal(tiltRead({ side: 0, fwd: 50 * D }, 0, 20 * D, 1 / 30).pace, 1);
  assert.equal(tiltRead({ side: 0, fwd: 50 * D }, 0, 80 * D, 1 / 30).pace, -1);
  assert.equal(tiltRead({ side: 0, fwd: 50 * D }, 20 * D, 50 * D, 1 / 30).steer, 1);
  assert.equal(tiltRead({ side: 0, fwd: 50 * D }, 1 * D, 53 * D, 1 / 30).pace, 0);
});

test("zeroed flat on a table, then picked up: no lasting brake, and steering still works", () => {
  const zero = { side: 0, fwd: 0 };
  const first = tiltRead(zero, 0, 70 * D, 1 / 30, 0.05);
  assert.equal(first.pace, 0, "a new grip never reads as braking");
  const after = run(zero, 0, 70 * D, 1.5, 0.05);
  assert.equal(after.pace, 0);
  assert.ok(Math.abs(zero.fwd - 70 * D) < 4 * D && !zero.regrip, "the zero caught up within 1.5 s");
  assert.equal(tiltRead(zero, 0, 94 * D, 1 / 30, 0.05).pace, -1, "after that a lean back brakes again");
  assert.equal(tiltRead(zero, -20 * D, 70 * D, 1 / 30, 0.05).steer, -1);
});

test("a hard brake held for a while keeps braking", () => {
  const zero = { side: 0, fwd: 50 * D };
  assert.equal(run(zero, 0, 80 * D, 3, 0.05).pace, -1);
});
