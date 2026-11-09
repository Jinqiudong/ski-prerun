// Skis (双板): the speed control (edge-core.js), the skier's pose blend, pole plants and stand-in numbers
// (ski-core.js), the skier's bunny-hill lesson (practice-core.js) and the sport over the wire (together-core.js).
import test from "node:test";
import assert from "node:assert/strict";
import { DEG, G, brakeOf, brakeDecel, boardGravity, governor, SKI, skiMode, skiSide, skiPivot, ploughOf, ploughDecel, skiGovernor } from "../src/ride/edge-core.js";
import { SKI_CLIPS, SKI_PLAYED, skiWeights, newPlant, plantStep, PLANT, STANDIN, standinParams, SKI_TRICKS, sportOf } from "../src/rider/ski-core.js";
import { SKI_STEPS, STEPS, stepsFor, stepOf, newPloughStop, ploughStep, newCheck, checkStep, loadProgress, saveProgress, nextStep, PLOUGH_FROM, PLOUGH_IN, STORE, STORE_SKI, goalText } from "../src/ride/practice-core.js";
import { cleanRider } from "../src/ride/together-core.js";

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const sum = (o) => Object.values(o).reduce((a, v) => a + v, 0);

test("ski brake modes: glide, plough when slow or braking straight, skid in a turn, hockey for a hard brake", () => {
  assert.equal(skiMode(0, 10, 0.5), "glide");
  assert.equal(skiMode(0.3, 2, 0.5), "plough"); // slow: always the wedge
  assert.equal(skiMode(1, 2, 0), "plough"); // too slow to throw the skis across
  assert.equal(skiMode(0.3, 10, 0), "plough"); // straight at speed, a light brake
  assert.equal(skiMode(0.3, 10, 0.6), "skid"); // in a turn: the turn finished round
  assert.equal(skiMode(0.3, 10, -0.6), "skid");
  assert.equal(skiMode(0.3, 10, 0.05, "skid"), "skid"); // through the edge change it stays a skid
  assert.equal(skiMode(SKI.HARD, 6, 0), "hockey");
  assert.equal(skiMode(1, 1, 0, "hockey"), "hockey"); // held across all the way to the stop
  assert.equal(skiMode(0.5, 10, 0.05, "hockey"), "skid"); // easing off a hockey stop at speed
});

test("ski speed control is the same to either side", () => {
  for (const mode of ["skid", "hockey", "plough", "glide"]) for (const bk of [0.1, 0.4, 0.8, 1]) near(skiPivot(mode, bk, 1), -skiPivot(mode, bk, -1));
  assert.equal(skiSide(0.6), -1); assert.equal(skiSide(-0.6), 1); // into the turn, either way
  assert.equal(skiSide(0.05, -1), -1); // between turns: the last one's way
  assert.equal(skiSide(0, 0, 0.3), 1); assert.equal(skiSide(0, 0, -0.3), -1); // straight: the short way round, uphill
  // the guided ride's governor doesn't care which way the turn goes (a board's does)
  for (const v of [10, 12, 13, 14, 16]) assert.equal(skiGovernor(v, 13), governor(v, 13, true));
  assert.ok(governor(12.5, 13, true) > governor(12.5, 13, false)); // (the board: only its heel-side turns skid early)
});

test("a hockey stop throws the skis right across: a full brake that stops you on any slope", () => {
  const a = skiPivot("hockey", 1, 1);
  near(a, 88 * DEG);
  assert.ok(brakeOf(a) > 0.95);
  for (const deg of [10, 25, 38]) assert.ok(brakeDecel(brakeOf(a), boardGravity(deg * DEG, 0)) > boardGravity(deg * DEG, 0));
  // a skid stays under 70°: it slows the turn, it doesn't stop it
  assert.ok(skiPivot("skid", 1, 1) <= 70 * DEG + 1e-9 && brakeOf(skiPivot("skid", 1, 1)) < 0.6);
  assert.equal(skiPivot("plough", 1, 1), 0); // a plough keeps the skis along the way you go
});

test("the plough stops you on a bunny hill, only slows you on steep snow", () => {
  assert.equal(ploughOf(0), 0); assert.equal(ploughOf(0.4), 1); assert.equal(ploughOf(1), 1); near(ploughOf(0.2), 0.5);
  const along = (deg) => boardGravity(deg * DEG, 0), mu = 0.045 * G; // the snow's own friction (board.js)
  assert.ok(ploughDecel(1, along(9)) + mu > along(9) + 1); // ~9°: a firm stop
  assert.ok(ploughDecel(1, along(30)) + mu < along(30)); // 30°: it can't hold you
  assert.ok(ploughDecel(0.5, along(9)) < ploughDecel(1, along(9))); // a bigger wedge, more brake
  assert.equal(ploughDecel(0, along(20)), 0);
});

test("skate on the flat is quicker on skis than a board's one-foot push", () => {
  assert.ok(SKI.PUSH_V > 3.4 && SKI.PUSH_A > 1.2);
});

test("the pose blend sums to one: hockey over plough over skate over the turn, the rest a glide or a tuck", () => {
  const cases = [{}, { edge: 0.6 }, { edge: -0.3, tuck: 1 }, { plough: 1, edge: 0.4 }, { hockey: 1, plough: 1 }, { skate: 1 }, { tuck: 0.5 }, { edge: 2, tuck: 3, plough: -1 }];
  for (const c of cases) { const w = skiWeights(c); near(sum(w), 1, 1e-9); for (const v of Object.values(w)) assert.ok(v >= 0); }
  assert.equal(skiWeights({ edge: 0.6 }).turnR, 1); assert.equal(skiWeights({ edge: -0.6 }).turnL, 1); // edge > 0: a right turn
  assert.equal(skiWeights({ edge: 0.25 }).turnR, 0.5);
  assert.equal(skiWeights({ hockey: 1, plough: 1, edge: 1 }).hockey, 1);
  assert.equal(skiWeights({ plough: 1, edge: 1 }).plough, 1);
  assert.equal(skiWeights({ tuck: 1 }).tuck, 1); assert.equal(skiWeights({}).glide, 1);
  // every blend key is a clip the character AI makes (docs/SKI_RIDERS.md) and a stand-in pose
  for (const k of Object.keys(skiWeights({}))) { assert.ok(SKI_CLIPS[k], k); assert.ok(STANDIN[k], k); }
  for (const k of SKI_PLAYED) assert.ok(SKI_CLIPS[k], k);
  assert.ok(Object.values(SKI_CLIPS).every((n) => /^Ski_[A-Z]/.test(n)));
});

test("pole plants: the new turn's pole, once per edge change, only at speed", () => {
  const ride = (edges, speed = 8, dt = 0.05) => { const p = newPlant(), out = []; for (const e of edges) { const s = plantStep(p, e, speed, dt); if (s.side && s.k === 0) out.push(s.side); } return out; };
  const linked = [...Array(20).fill(0.4), ...Array(4).fill(0.1), ...Array(20).fill(-0.4), ...Array(4).fill(-0.1), ...Array(20).fill(0.4)];
  // 0.4 (right) → left: the left pole; → right again: the right pole
  assert.deepEqual(ride([...linked.slice(0, 24), -0.05, ...linked.slice(24)]), ["L", "R"]);
  assert.deepEqual(ride(linked, 1.5), []); // a crawl: no plants
  assert.deepEqual(ride(Array(60).fill(0.4)), []); // one long turn
  assert.deepEqual(ride([0.04, -0.04, 0.1, -0.1, 0.04]), []); // wobbling about flat: nothing until a real turn
  // a plant runs its course and ends
  const p = newPlant(); plantStep(p, 0.4, 8, 0.05); let s = plantStep(p, -0.2, 8, 0.05); assert.equal(s.side, "L");
  for (let t = 0; t < PLANT.dur + 0.1; t += 0.05) s = plantStep(p, -0.4, 8, 0.05);
  assert.equal(s.side, null);
});

test("the stand-in's numbers: one pose is itself, a blend is between, nothing is a glide", () => {
  assert.deepEqual(standinParams({ tuck: 1 }).hand, STANDIN.tuck.hand);
  near(standinParams({ tuck: 1 }).fwd, STANDIN.tuck.fwd);
  near(standinParams({ glide: 1, tuck: 1 }).drop, (STANDIN.glide.drop + STANDIN.tuck.drop) / 2);
  near(standinParams({ glide: 0.25, tuck: 0.25 }).drop, (STANDIN.glide.drop + STANDIN.tuck.drop) / 2); // normalised
  near(standinParams({}).fwd, STANDIN.glide.fwd);
  near(standinParams({ nope: 1 }).width, STANDIN.glide.width);
  assert.ok(standinParams({ plough: 1 }).toe > 0 && standinParams({ skate: 1 }).toe < 0); // the wedge's tips in, the skate's out
  near(standinParams({ turnL: 1 }).lead, -standinParams({ turnR: 1 }).lead); // mirror images
  near(standinParams({ turnL: 1 }).counter, -standinParams({ turnR: 1 }).counter);
  // the plough's tips stay apart (the skis' tips, about 0.76 m ahead of the boot, don't cross)
  assert.ok(STANDIN.plough.width - 0.76 * Math.sin(STANDIN.plough.toe) > 0.07);
  for (const t of SKI_TRICKS) { assert.ok(STANDIN[t.key], t.key); assert.ok(t.air > 0 && t.dur > 0 && t.name); }
});

test("only people ski: the animals ride boards", () => {
  assert.equal(sportOf({ sport: "ski" }), "ski");
  assert.equal(sportOf({ sport: "ski", animal: "capybara" }), "board");
  assert.equal(sportOf({}), "board"); assert.equal(sportOf(null), "board"); assert.equal(sportOf({ sport: "mono" }), "board");
});

test("friends see your skis: the sport goes over the wire, nothing else does", () => {
  const ch = { tpl: "F", parts: {}, colors: {}, height: 165 };
  assert.equal(cleanRider({ ch: { ...ch, sport: "ski" } }).ch.sport, "ski");
  assert.equal(cleanRider({ ch: { ...ch, sport: "board" } }).ch.sport, undefined);
  assert.equal(cleanRider({ ch: { ...ch, sport: "<b>" } }).ch.sport, undefined);
  assert.equal(cleanRider({ ch }).ch.sport, undefined);
});

test("the skier's lesson: its own steps, the plough first, a hockey stop for the brake, no caught edge", () => {
  assert.deepEqual(SKI_STEPS.map((s) => s.key), ["hold", "speed", "plough", "edge", "link", "brake", "free"]);
  assert.equal(stepsFor("ski"), SKI_STEPS); assert.equal(stepsFor("board"), STEPS); assert.equal(stepsFor(), STEPS);
  assert.equal(stepOf("plough", "ski").title, "犁式刹车"); assert.equal(stepOf("plough").key, "hold"); // not a board step
  assert.ok(!SKI_STEPS.some((s) => s.key === "catch"));
  assert.ok(goalText(stepOf("plough", "ski")).includes(`${PLOUGH_FROM} km/h`));
  for (const s of SKI_STEPS) assert.ok(!/脚跟|脚尖|吃刃/.test(s.goal + s.coach), s.key);
});

test("a plough stop: armed at speed, timed from the wedge, clean when short and never swung across", () => {
  const run = (frames) => { const s = newPloughStop(); let out = null; for (const f of frames) out = ploughStep(s, { dt: 0.05, slip: 0, ...f }) || out; return out; };
  const go = (n, speed, plough, x0, dx, slip = 0) => Array.from({ length: n }, (_, i) => ({ speed, plough, x: x0 + i * dx, z: 0, slip }));
  // 3 m/s (~11 km/h), wedge on, 10 m to a stop
  let r = run([...go(10, 3, 0, 0, 0.15), ...go(40, 1.5, 1, 1.5, 0.25), ...go(12, 0, 1, 11.5, 0)]);
  assert.ok(r && r.ok && r.dist < PLOUGH_IN, JSON.stringify(r));
  // the skis swung across on the way: that's a hockey stop, not a plough
  r = run([...go(10, 3, 0, 0, 0.15), ...go(20, 1.5, 1, 1.5, 0.2, 70 * DEG), ...go(12, 0, 1, 5.5, 0)]);
  assert.ok(r && !r.ok && r.across >= 45);
  // too long a slide
  r = run([...go(10, 3, 0, 0, 0.15), ...go(80, 2, 1, 1.5, 0.5), ...go(12, 0, 1, 41.5, 0)]);
  assert.ok(r && !r.ok && r.dist > PLOUGH_IN);
  // never fast enough: not armed, nothing
  assert.equal(run([...go(20, 1, 1, 0, 0.05), ...go(12, 0, 1, 1, 0)]), null);
  // through the step check
  const c = newCheck("plough");
  for (const f of [...go(10, 3, 0, 0, 0.15), ...go(40, 1.5, 1, 1.5, 0.25), ...go(12, 0, 1, 11.5, 0)]) checkStep(c, { heading: 0, fall: 0, caught: 0, steer: 0, heel: 1, dt: 0.05, ...f });
  assert.ok(c.done);
});

test("the skier's progress is kept apart from the board's", () => {
  const mem = new Map(), storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  saveProgress(storage, { done: { hold: true, speed: true, plough: true }, at: "plough" }, "ski");
  saveProgress(storage, { done: { hold: true }, at: "speed" });
  assert.ok(mem.has(STORE) && mem.has(STORE_SKI));
  const ski = loadProgress(storage, "ski"), board = loadProgress(storage);
  assert.equal(ski.at, "plough"); assert.equal(board.at, "speed");
  assert.equal(nextStep(ski, "ski"), "edge"); assert.equal(nextStep(board), "speed");
  // a board step's name is not a skier's place to be
  saveProgress(storage, { done: {}, at: "catch" }, "ski");
  assert.equal(loadProgress(storage, "ski").at, null);
});
