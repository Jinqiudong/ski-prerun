// The guide animal (src/ride/guide-core.js): who guides, the signs it shows, where it rides, the arrows under it,
// the line through the trees, the detour spliced into a plan, and the spots found.
import { test } from "node:test";
import assert from "node:assert/strict";
import { guideAnimal, SIGNS, MOMENT, TURN_SHOW, heldSign, GAP, gapFor, newGuide, guideStep, arrowAlpha, DETOURS, wantDetour, pointAt, indexAt, findTreeLine, splicePlan, spotKey, loadSpots, addSpot, knownSpot } from "../src/ride/guide-core.js";

test("the guide is the resort's animal unless it would vanish on the snow, never the one you ride as", () => {
  assert.equal(guideAnimal("marmot", null), "marmot");
  assert.equal(guideAnimal("moose", "pika"), "moose");
  assert.equal(guideAnimal("pika", null), "fox"); // pale on snow
  assert.equal(guideAnimal("sheep", null), "fox");
  assert.equal(guideAnimal("marmot", "marmot"), "fox");
  assert.equal(guideAnimal("fox", "fox"), "marmot");
  assert.equal(guideAnimal("pika", "fox"), "marmot");
  assert.equal(guideAnimal(undefined, null), "fox");
});

test("signs, not sentences: every sign is a painted icon; direction only, held from 150 m to the turn-off", async () => {
  const { existsSync } = await import("node:fs");
  for (const [k, ic] of Object.entries(SIGNS)) assert.ok(existsSync(new URL(`../assets/icons/${ic}.png`, import.meta.url)), k);
  for (const [k, [sign, secs]] of Object.entries(MOMENT)) assert.ok(SIGNS[sign] && secs > 0, k);
  const g = newGuide(0), turns = [{ s: 300, bearing: 0.8, many: true }, { s: 600, bearing: -0.9, many: true }, { s: 900, bearing: 0.05, many: true }, { s: 1200, bearing: 0.05, many: false }];
  assert.equal(heldSign(g, turns, 300 - TURN_SHOW - 1), null); // too far yet
  assert.equal(heldSign(g, turns, 200), "left");
  assert.equal(heldSign(g, turns, 302), "left"); // still up just through it
  assert.equal(heldSign(g, turns, 500), "right");
  assert.equal(heldSign(g, turns, 800), "straight"); // straight on past other ways
  assert.equal(heldSign(g, turns, 1100), null); // straight on, nothing else there
  assert.equal(heldSign({ ...g, mode: "wait" }, turns, 200), "wait");
  assert.equal(heldSign({ ...g, mode: "back" }, turns, 200), "uturn");
});

const run = (g, frames, inp) => { const said = []; for (let f = 0; f < frames; f++) said.push(...guideStep(g, { dt: 1 / 30, ...inp(f) })); return said; };

test("it keeps 10–16 m ahead of you", () => {
  const g = newGuide(0);
  let sR = 0;
  run(g, 30 * 20, () => ({ sR: (sR += 10 / 30), speed: 10, end: 5000 }));
  const gap = g.s - sR;
  assert.ok(gap >= GAP.min - 1 && gap <= GAP.max + 1, `gap ${gap}`);
  assert.equal(g.mode, "lead");
  assert.ok(gapFor(0) >= 10 && gapFor(30) <= 16 && gapFor(10, true) < gapFor(10)); // closer in the trees, to be seen among them
});

test("fall behind and it stops, waits with a word, then goes on when you come", () => {
  const g = newGuide(0);
  let sR = 0;
  run(g, 30 * 5, () => ({ sR: (sR += 8 / 30), speed: 8, end: 5000 }));
  // you stop
  const said = run(g, 30 * 5, () => ({ sR, speed: 0, end: 5000 }));
  assert.equal(g.mode, "wait");
  assert.ok(said.includes("wait"));
  const held = g.s;
  run(g, 30 * 2, () => ({ sR, speed: 0, end: 5000 }));
  assert.equal(g.s, held); // standing still
  // a crash: it asks if you're all right
  const g2 = newGuide(0); g2.s = 50; g2.mode = "wait"; g2.t = GAP.waitAgain;
  assert.deepEqual(guideStep(g2, { sR: 0, speed: 0, down: true, end: 5000, dt: 0.1 }), ["crash"]);
  const g3 = newGuide(0); g3.s = 14;
  assert.deepEqual(guideStep(g3, { sR: 0, speed: 0, down: true, end: 5000, dt: 0.1 }), ["crash"]);
  assert.equal(g3.mode, "wait");
  // and you ride up to it
  run(g, 30 * 6, () => ({ sR: (sR += 8 / 30), speed: 8, end: 5000 }));
  assert.equal(g.mode, "lead");
  assert.ok(g.s > held);
});

test("a turn-off: said once from ~90 m, then it holds at the mouth till you're there", () => {
  const g = newGuide(0), turns = [{ s: 200, bearing: 0.8, key: "j1" }];
  let sR = 0; const said = [];
  for (let f = 0; f < 30 * 40 && sR < 230; f++) { sR += 7 / 30; said.push(...guideStep(g, { sR, speed: 7, end: 5000, turns, dt: 1 / 30 })); if (g.mode === "turn") assert.ok(g.s >= 200 && sR < 200); }
  assert.equal(said.filter((k) => k === "turnL").length, 1);
  const g2 = newGuide(0), said2 = [];
  for (let f = 0, sR = 0; f < 30 * 30 && sR < 230; f++) { sR += 7 / 30; said2.push(...guideStep(g2, { sR, speed: 7, end: 5000, turns: [{ s: 200, bearing: 0, many: true, key: "j2" }], dt: 1 / 30 })); }
  assert.equal(said2.filter((k) => k === "straight").length, 1);
  assert.ok(said.includes("atTurn"));
  assert.equal(g.mode, "lead");
  assert.ok(g.s > 200);
});

test("the wrong way: it comes back for you, and is glad when you're on the route again", () => {
  const g = newGuide(0);
  let said = run(g, 30 * 2, () => ({ sR: 40, speed: 8, off: 50, end: 5000 }));
  assert.equal(g.mode, "back");
  assert.deepEqual(said.filter((k) => k === "wrong"), ["wrong"]);
  said = run(g, 5, () => ({ sR: 60, speed: 8, off: 5, end: 5000 }));
  assert.equal(g.mode, "lead");
  assert.ok(said.includes("back"));
  assert.ok(g.s >= 66);
});

test("it never rides past the end of the way", () => {
  const g = newGuide(0);
  let sR = 0;
  run(g, 30 * 30, () => ({ sR: Math.min(300, (sR += 12 / 30)), speed: 12, end: 300 }));
  assert.ok(g.s <= 298);
});

test("the arrows: none while the guide leads in sight, back off the route, out of sight or when it has gone back", () => {
  assert.equal(arrowAlpha({ mode: "lead" }), 0);
  assert.equal(arrowAlpha({ mode: "turn" }), 0);
  assert.equal(arrowAlpha({ mode: "wait" }), 0);
  assert.equal(arrowAlpha({ mode: "back" }), 1);
  assert.equal(arrowAlpha({ mode: "lead", off: 40 }), 1);
  assert.equal(arrowAlpha({ mode: "lead", seen: false }), 1);
});

test("detours: the trees built, moguls and powder as hooks; how often", () => {
  assert.deepEqual(DETOURS.map((d) => d.key), ["trees", "moguls", "powder"]);
  assert.deepEqual(DETOURS.filter((d) => d.ready).map((d) => d.key), ["trees"]);
  assert.equal(DETOURS[0].spot("Kaboom"), "Kaboom 旁的松林");
  for (const d of DETOURS.filter((d) => !d.ready)) assert.equal(d.find({}), null);
  assert.equal(wantDetour({ known: false, force: "0" }), false);
  assert.equal(wantDetour({ known: true, force: "trees", sinceLast: 0 }), true);
  assert.equal(wantDetour({ known: false, sinceLast: 30, rand: () => 0 }), false);
  assert.equal(wantDetour({ known: false, rand: () => 0.6 }), true);
  assert.equal(wantDetour({ known: true, rand: () => 0.6 }), false);
});

// A straight route down +z on a plane falling 0.3 m per metre, woods on the left (x > 14) in an 8 m grid with a
// lane where the row at x 32 is missing, and none on the right.
function woodsWorld() {
  const path = [], dist = [];
  for (let z = 0; z <= 600; z += 12) { path.push([0, z]); dist.push(z); }
  const trees = [];
  for (let x = 16; x < 70; x += 8) for (let z = 0; z < 600; z += 8) if (x !== 32) trees.push({ x: x + ((z / 8) % 3) * 0.4, z });
  const treesNear = (x, z, r) => trees.filter((t) => Math.abs(t.x - x) < r && Math.abs(t.z - z) < r);
  return { path, dist, trees, treesNear, height: (x, z) => -0.3 * z };
}

test("a line through the trees: into the woods on the wooded side, clear of every trunk, back onto the route", () => {
  const W = woodsWorld();
  const line = findTreeLine({ path: W.path, dist: W.dist, from: 120, to: 200, treesNear: W.treesNear, height: W.height, outs: [32], lengths: [160] });
  assert.ok(line, "found one");
  assert.ok(line.b > line.a);
  const xs = line.pts.map((p) => p[0]);
  assert.ok(Math.max(...xs) > 26, "out in the woods");
  for (const [x, z] of line.pts) for (const t of W.trees) assert.ok(Math.hypot(t.x - x, t.z - z) >= 1.8, `trunk at ${t.x},${t.z}`);
  assert.ok(line.woods >= 10);
  // the ends join the route
  assert.ok(Math.abs(line.pts[0][0]) < 3 && Math.abs(line.pts[line.pts.length - 1][0]) < 3);
  // kept out of a turn-off's stretch; none at all on an open slope
  assert.equal(findTreeLine({ path: W.path, dist: W.dist, from: 120, to: 200, treesNear: W.treesNear, height: W.height, avoid: [[0, 600]] }), null);
  assert.equal(findTreeLine({ path: W.path, dist: W.dist, from: 120, to: 200, treesNear: () => [], height: W.height }), null);
  // never uphill
  assert.equal(findTreeLine({ path: W.path, dist: W.dist, from: 120, to: 200, treesNear: W.treesNear, height: (x, z) => 0.3 * z, outs: [32], lengths: [160] }), null);
});

test("a detour spliced into a plan: indices past it move, the run carries on, and it comes back out", () => {
  const W = woodsWorld();
  const P = { path: W.path, dist: W.dist, hs: W.path.map(([x, z]) => W.height(x, z)), segs: [{ at: 0, run: { name: "A" } }, { at: 40, run: { name: "B" } }],
    flats: [{ a: 3, b: 5, kind: "flat" }, { a: 12, b: 14, kind: "flat" }, { a: 44, b: 46, kind: "flat" }], title: "t", key: "run:A" };
  const pts = [[2, 125], [6, 130], [10, 140], [8, 150], [4, 160], [1, 170]];
  const Q = splicePlan(P, 10, 15, pts, W.height);
  assert.equal(Q.path.length, P.path.length - (15 - 10 - 1) + pts.length);
  assert.deepEqual(Q.path.slice(11, 17), pts);
  assert.deepEqual(Q.path[17], P.path[15]);
  assert.equal(Q.segs[1].at, Q.shift(40));
  assert.deepEqual(Q.path[Q.segs[1].at], P.path[40]);
  assert.deepEqual(Q.flats.map((f) => [f.a, f.b]), [[3, 5], [Q.shift(44), Q.shift(46)]]); // the flat inside went
  assert.equal(Q.unshift(Q.shift(30)), 30);
  assert.equal(Q.shift(5), 5);
  assert.equal(Q.title, "t"); assert.equal(Q.orig, P);
  assert.ok(Q.length > P.dist[P.dist.length - 1]);
  for (let i = 1; i < Q.dist.length; i++) assert.ok(Q.dist[i] >= Q.dist[i - 1]);
  assert.deepEqual(Q.detour, { a: 10, b: 17, m: 6 });
  // where along: pointAt / indexAt
  const p = pointAt(W.path, W.dist, 30);
  assert.ok(Math.abs(p.z - 30) < 1e-9 && Math.abs(p.h) < 1e-9);
  assert.equal(indexAt(W.dist, 30), 2);
});

test("spots found: saved per resort, once each, a bad store survives", () => {
  const mem = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
  const key = spotKey("trees", 120, -300);
  assert.equal(key, spotKey("trees", 130, -290)); // the same place, a few metres off
  assert.equal(addSpot(mem, "copper", { key, kind: "trees", name: "Kaboom 旁的松林", x: 120, z: -300, at: 1 }), true);
  assert.equal(addSpot(mem, "copper", { key, kind: "trees", name: "Kaboom 旁的松林", x: 121, z: -301 }), false);
  assert.equal(loadSpots(mem, "copper").length, 1);
  assert.equal(loadSpots(mem, "vail").length, 0);
  assert.ok(knownSpot(mem, "copper", key));
  mem.d.prerunSpots = "{nope";
  assert.deepEqual(loadSpots(mem, "copper"), []);
  assert.equal(addSpot(mem, "copper", { key, kind: "trees", name: "x", x: 0, z: 0 }), true);
});
