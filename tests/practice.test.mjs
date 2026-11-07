import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEG } from "../src/ride/edge-core.js";
import { lapLine, bunnySpot, worldLift, alongLap, edgeOf, newTurns, turnStep, slipZone, newStop, stopStep, newCheck, checkStep, loadProgress, saveProgress, nextStep, STEPS, LINKS, STOP_IN } from "../src/ride/practice-core.js";

// A plane falling `deg` toward +z, flat (a runout) past z = flatAt.
const plane = (deg, flatAt = Infinity) => (x, z) => -Math.tan(deg * DEG) * Math.min(z, flatAt);
// A baked resort's heights, as world.js Terrain reads them (no three.js here).
function heights(R) {
  const [gw, gh] = R.grid, [x0, z0, x1, z1] = R.bounds, raw = Buffer.from(R.heights, "base64"), q = new Uint16Array(raw.buffer, raw.byteOffset, raw.length / 2);
  return (x, z) => {
    let c = ((x - x0) / (x1 - x0)) * (gw - 1), r = ((z - z0) / (z1 - z0)) * (gh - 1);
    c = Math.min(Math.max(c, 0), gw - 1.001); r = Math.min(Math.max(r, 0), gh - 1.001);
    const i = Math.floor(r), j = Math.floor(c), fr = r - i, fc = c - j, k = i * gw + j, h = (n) => q[n] / 10;
    if (fr + fc <= 1) return h(k) + (h(k + 1) - h(k)) * fc + (h(k + gw) - h(k)) * fr;
    return h(k + gw + 1) + (h(k + gw) - h(k + gw + 1)) * (1 - fc) + (h(k + 1) - h(k + gw + 1)) * (1 - fr);
  };
}

test("a lap runs down the fall line and stops at the runout", () => {
  const lap = lapLine(plane(9, 120), 0, 0);
  assert.ok(Math.abs(lap.mean - 9) < 0.5, `mean ${lap.mean}`);
  assert.ok(lap.L >= 116 && lap.L <= 150, `L ${lap.L}`);
  const [x, z] = lap.pts[lap.pts.length - 1];
  assert.ok(Math.abs(x) < 1e-6 && z > 100);
  assert.equal(lapLine(plane(9), 0, 0, 220).L, 220);
});

test("the bunny hill: a beginner lift's top on a gentle slope, else a green run, else by the base", () => {
  const R = { lifts: [{ name: "Steep T", kind: "t-bar", pts: [[0, 300], [0, 0]] }, { name: "Carpet", kind: "magic_carpet", pts: [[50, 40], [50, 0]] }],
    runs: [], places: [{ kind: "village", name: "Base", x: 0, z: 300 }] };
  const s = bunnySpot(R, plane(9, 260));
  assert.equal(s.kind, "lift"); assert.equal(s.name, "Carpet");
  assert.ok(Math.abs(s.heading) < 0.05, `down the fall line (+z): ${s.heading}`);
  assert.equal(bunnySpot(R, plane(25)).kind, "base"); // too steep for any lift's top or green: the base's gentlest
  const R2 = { lifts: [], runs: [{ name: "Easy Street", level: "easy", pts: [[0, 0], [0, 200]] }], places: [{ kind: "village", name: "Base", x: 0, z: 200 }] };
  assert.deepEqual([bunnySpot(R2, plane(8, 200)).kind, bunnySpot(R2, plane(8, 200)).name], ["run", "Easy Street"]);
});

test("each resort's real bunny hill", () => {
  const want = { copper: "Pitchfork", abasin: "Molly Hogan Lift", eldora: "Caribou", buttermilk: "Panda Peak", winterpark: "Galloping Goose" };
  for (const [id, name] of Object.entries(want)) {
    const R = JSON.parse(readFileSync(new URL(`../data/${id}.json`, import.meta.url))), s = bunnySpot(R, heights(R));
    assert.equal(s.name, name, id);
    assert.ok(s.L >= 90 && s.mean >= 5 && s.mean <= 13 && s.max <= 17, `${id}: ${s.L} m, ${s.mean}°, max ${s.max}°`);
    assert.ok(worldLift(R, s), `${id}: a chairlift to build the world round`);
  }
});

test("where you are on the lap", () => {
  const pts = [[0, 0], [0, 50], [0, 100]];
  assert.deepEqual(alongLap(pts, 3, 70), { s: 70, d: 3 });
});

test("edges: heel or toe from the steer and the stance", () => {
  assert.equal(edgeOf(0.1, 1), 0);
  assert.equal(edgeOf(-0.5, 1), 1); // −sign(steer) is the heel side: heel
  assert.equal(edgeOf(0.5, 1), -1);
  assert.equal(edgeOf(0.5, -1), 1); // goofy: mirrored
});

// Sweep the travel from one side of the fall line (0) to the other on one edge.
function sweep(s, edge, from, to, speed = 5, secs = 1.5) {
  let got = 0;
  for (let k = 0; k <= secs * 30; k++) { const off = (from + ((to - from) * k) / (secs * 30)) * DEG; got ||= turnStep(s, { edge, off, speed, dt: 1 / 30 }); }
  return got;
}
test("a turn counts once the board crosses the fall line on that edge", () => {
  const s = newTurns();
  assert.equal(sweep(s, 1, -40, 40), 1);
  assert.equal(s.heel, 1);
  assert.equal(sweep(newTurns(), 1, 0, 50), 0, "from straight down onto the edge: no crossing");
  assert.equal(sweep(newTurns(), 1, -40, -15), 0, "not yet across");
  assert.equal(sweep(newTurns(), -1, 40, -40, 0.5), 0, "standing still: no turn");
});

test("a flicker off the edge doesn't break the turn", () => {
  const s = newTurns();
  sweep(s, 1, -40, -5, 5, 0.6);
  for (let k = 0; k < 6; k++) turnStep(s, { edge: 0, off: -4 * DEG, speed: 5, dt: 1 / 30 }); // 0.2 s flat
  assert.equal(sweep(s, 1, -4, 30, 5, 0.6), 1);
});

test("edge changes in a row: alternate edges count, the same edge twice or a stop starts again", () => {
  const s = newTurns();
  sweep(s, 1, -40, 40); sweep(s, -1, 40, -40); sweep(s, 1, -40, 40);
  assert.equal(s.chain, 2);
  sweep(s, 1, -40, 40); // heel again (a skidded J back)
  assert.equal(s.chain, 0);
  sweep(s, -1, 40, -40); sweep(s, 1, -40, 40);
  assert.equal(s.chain, 2);
  for (let k = 0; k < 40; k++) turnStep(s, { edge: 0, off: 0, speed: 0.2, dt: 1 / 30 });
  assert.equal(s.chain, 0);
});

test("the brake's zones: glide under 45°, brake 45–90°, a full stop past 80°", () => {
  assert.deepEqual([slipZone(30 * DEG).zone, slipZone(30 * DEG).k], ["glide", 0]);
  assert.equal(slipZone(45 * DEG).zone, "brake");
  assert.ok(Math.abs(slipZone(60 * DEG).k - 1 / 3) < 1e-9);
  assert.equal(slipZone(85 * DEG).zone, "stop");
  assert.equal(slipZone(-120 * DEG).deg, 60); // tail first or the other way round: the same 60°
});

// Brake from v0 with the board slip degrees across, decelerating at a m/s².
function brake(s, { v0 = 4, slip = 80, a = 3, caught = 0, run = 1 } = {}) {
  let x = 0, v = v0, out = null;
  for (let k = 0; k < 30 * run && !out; k++) out = stopStep(s, { speed: v, slip: 20 * DEG, caught: 0, x, z: 0, dt: 1 / 30 }), (x += v / 30); // running in
  for (let k = 0; k < 30 * 20 && !out; k++) {
    out = stopStep(s, { speed: v, slip: slip * DEG, caught: k === 5 ? caught : 0, x, z: 0, dt: 1 / 30 });
    x += v / 30; v = Math.max(0, v - a / 30);
  }
  return out;
}
test("a stop: armed at speed, timed from the brake biting to standing still", () => {
  const ok = brake(newStop());
  assert.equal(ok.ok, true); assert.ok(ok.dist < 4, `${ok.dist} m`); assert.equal(ok.maxSlip, 80); assert.equal(ok.from, 14);
  const long = brake(newStop(), { a: 0.5 });
  assert.equal(long.ok, false); assert.ok(long.dist > STOP_IN);
  assert.equal(brake(newStop(), { slip: 50 }).ok, false, "only 50° across: not a real brake");
  assert.equal(brake(newStop(), { caught: 1 }).caught, true);
  assert.equal(brake(newStop(), { v0: 2 }), null, "never fast enough: not armed");
});

test("checks: speed, the two edges, linking, braking", () => {
  const base = { heading: 0, fall: 0, slip: 0, caught: 0, steer: 0, heel: 1, x: 0, z: 0, dt: 1 / 30 };
  const sp = newCheck("speed");
  checkStep(sp, { ...base, speed: 4 }); assert.equal(sp.done, false);
  checkStep(sp, { ...base, speed: 5.1 }); assert.equal(sp.done, true);
  const ed = newCheck("edge");
  const turn = (c, steer, from, to) => { for (let k = 0; k <= 45; k++) checkStep(c, { ...base, speed: 5, steer, heading: (from + ((to - from) * k) / 45) * DEG }); };
  turn(ed, -0.6, -40, 40); assert.deepEqual([ed.parts.heel, ed.done], [true, false]);
  turn(ed, 0.6, 40, -40); assert.equal(ed.done, true);
  const ln = newCheck("link");
  for (let i = 0; i <= LINKS; i++) turn(ln, i % 2 ? 0.6 : -0.6, i % 2 ? 40 : -40, i % 2 ? -40 : 40);
  assert.equal(ln.done, true);
});

test("progress on this phone: ticks kept, the next step to do", () => {
  const box = {}, storage = { getItem: (k) => box[k] ?? null, setItem: (k, v) => (box[k] = v) };
  const p = loadProgress(storage);
  assert.deepEqual(p, { done: {}, at: null });
  assert.equal(nextStep(p), "hold");
  p.done.hold = p.done.speed = true; p.at = "edge"; saveProgress(storage, p);
  assert.deepEqual(loadProgress(storage), { done: { hold: true, speed: true }, at: "edge" });
  assert.equal(nextStep(loadProgress(storage)), "edge");
  for (const s of STEPS) p.done[s.key] = true;
  assert.equal(nextStep(p), "free");
  assert.deepEqual(loadProgress({ getItem: () => "{bad" }), { done: {}, at: null });
});
