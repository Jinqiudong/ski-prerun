import test from "node:test";
import assert from "node:assert/strict";
import { tiltRead, tipOf, upInPhone } from "../src/ride/tilt-core.js";

const D = Math.PI / 180;
// "Up" in the phone's frame turned as the phone turns: the top tipped away by f (about the phone's side axis),
// then the right edge down by s (about whichever axis keeps the screen's facing: the screen normal for an upright
// phone, the long axis for a flat or overhead one; both are tried).
const rotX = (u, a) => ({ x: u.x, y: u.y * Math.cos(a) - u.z * Math.sin(a), z: u.y * Math.sin(a) + u.z * Math.cos(a) });
const rotZ = (u, a) => ({ x: u.x * Math.cos(a) - u.y * Math.sin(a), y: u.x * Math.sin(a) + u.y * Math.cos(a), z: u.z });
const rotY = (u, a) => ({ x: u.x * Math.cos(a) - u.z * Math.sin(a), y: u.y, z: u.x * Math.sin(a) + u.z * Math.cos(a) });
const UPRIGHT = { x: 0, y: 1, z: 0 }, HELD = rotX(UPRIGHT, -40 * D), FLAT = { x: 0, y: 0, z: 1 }, OVERHEAD = { x: 0, y: 0, z: -1 };
const run = (zero, up, secs, settle) => { let o; for (let t = 0; t < secs; t += 1 / 30) o = tiltRead(zero, up, 1 / 30, settle); return o; };
const near = (a, b, e = 0.5 * D) => assert.ok(Math.abs(a - b) < e, `${a / D}° vs ${b / D}°`);

test("tips are measured from the reference in any posture: standing, flat, lying down with the phone overhead", () => {
  for (const [name, ref] of [["held", HELD], ["upright", UPRIGHT], ["flat", FLAT], ["overhead", OVERHEAD]]) {
    const fwd = tipOf(ref, rotX(ref, 20 * D)), back = tipOf(ref, rotX(ref, -20 * D));
    near(fwd.fwd, 20 * D); near(back.fwd, -20 * D); near(fwd.side, 0);
    const wheel = tipOf(ref, rotZ(ref, 15 * D)), roll = tipOf(ref, rotY(ref, ref.z < 0 ? -15 * D : 15 * D));
    if (name !== "flat" && name !== "overhead") { assert.ok(wheel.side > 10 * D, `${name} wheel ${wheel.side / D}`); near(wheel.fwd, 0, 5 * D); }
    if (name !== "upright") { assert.ok(roll.side > 8 * D, `${name} roll ${roll.side / D}`); near(roll.fwd, 0, 2 * D); }
  }
});

test("upInPhone matches deviceorientation's beta/gamma", () => {
  near(upInPhone(90, 0).y, 1, 1e-9); near(upInPhone(0, 0).z, 1, 1e-9); near(upInPhone(-180, 0).z, -1, 1e-9);
});

test("a lean back brakes, a lean forward speeds up, a side tip steers", () => {
  assert.equal(tiltRead({}, HELD, 1 / 30).pace, 0);
  const z = {}; tiltRead(z, HELD, 1 / 30);
  assert.equal(tiltRead(z, rotX(HELD, 30 * D), 1 / 30).pace, 1);
  assert.equal(tiltRead(z, rotX(HELD, -30 * D), 1 / 30).pace, -1);
  assert.equal(tiltRead(z, rotZ(HELD, 25 * D), 1 / 30).steer, 1);
  assert.equal(tiltRead(z, rotX(HELD, 3 * D), 1 / 30).pace, 0);
});

test("zeroed flat on a table, then picked up, or lying back with it overhead: no lasting brake, and it steers", () => {
  for (const to of [HELD, OVERHEAD]) {
    const zero = {}; tiltRead(zero, FLAT, 1 / 30, 0.05);
    assert.equal(tiltRead(zero, to, 1 / 30, 0.05).pace, 0, "a new posture never reads as braking");
    assert.equal(run(zero, to, 1.5, 0.05).pace, 0);
    assert.ok(!zero.regrip, "caught up within 1.5 s");
    assert.equal(tiltRead(zero, rotX(to, -30 * D), 1 / 30, 0.05).pace, -1, "after that a lean back brakes again");
    run(zero, to, 1, 0.05); // back level
    assert.equal(tiltRead(zero, to.z < 0 ? rotY(to, -25 * D) : rotZ(to, 25 * D), 1 / 30, 0.05).steer > 0.8, true, "the right edge down steers right");
  }
});

test("a hard brake held for a few seconds keeps braking", () => {
  const zero = {}; tiltRead(zero, HELD, 1 / 30);
  assert.equal(run(zero, rotX(HELD, -30 * D), 3, 0.05).pace, -1);
});

test("left/right recentres itself: an off level is pulled back by linked turns, a held turn barely moves it", () => {
  const zero = {}; tiltRead(zero, rotZ(HELD, -8 * D), 1 / 30); // started with the phone tipped 8° left
  for (let t = 0; t < 30; t += 1 / 30) tiltRead(zero, rotZ(HELD, Math.sin(t * 2) * 15 * D), 1 / 30); // linked turns round true level
  const off = tipOf(zero.ref, HELD).side;
  assert.ok(Math.abs(off) < 2.5 * D, `level now off by ${(off / D).toFixed(1)}°`);
  const held = {}; tiltRead(held, HELD, 1 / 30);
  const first = tiltRead(held, rotZ(HELD, 15 * D), 1 / 30), o = run(held, rotZ(HELD, 15 * D), 3);
  assert.ok(o.steer > first.steer * 0.85, `after 3 s held: steer ${first.steer.toFixed(2)} → ${o.steer.toFixed(2)}`);
});
