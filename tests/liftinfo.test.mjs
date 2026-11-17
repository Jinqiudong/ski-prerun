// node --test tests/liftinfo.test.mjs — the resort page's lift labels and tip (src/mountain/liftinfo-core.js), on real resort data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildGraph } from "../src/core/route.js";
import { topRuns, countByLevel, changeLifts, liftInfo, recommend, tipText, seatsLabel } from "../src/mountain/liftinfo-core.js";

function load(id) {
  const R = JSON.parse(readFileSync(new URL(`../data/${id}.json`, import.meta.url)));
  const [gw, gh] = R.grid, [x0, z0, x1, z1] = R.bounds;
  const q = new Uint16Array(Uint8Array.from(Buffer.from(R.heights, "base64")).buffer);
  const heightAt = (x, z) => {
    const c = Math.min(Math.max(((x - x0) / (x1 - x0)) * (gw - 1), 0), gw - 1.001);
    const r = Math.min(Math.max(((z - z0) / (z1 - z0)) * (gh - 1), 0), gh - 1.001);
    const i = Math.floor(r), j = Math.floor(c), fr = r - i, fc = c - j, h = (a, b) => q[a * gw + b] / 10;
    return h(i, j) * (1 - fc) * (1 - fr) + h(i, j + 1) * fc * (1 - fr) + h(i + 1, j) * (1 - fc) * fr + h(i + 1, j + 1) * fc * fr;
  };
  return { R, graph: buildGraph(R, heightAt) };
}
const copper = load("copper");
const lift = (R, n) => R.lifts.find((l) => l.name === n);
const flyer = lift(copper.R, "American Flyer"), eagle = lift(copper.R, "American Eagle");

test("the runs leaving American Flyer's top: 2 green, 1 black", () => {
  const runs = topRuns(copper.graph, flyer);
  assert.deepEqual(runs.map((r) => r.name).sort(), ["Coppertone", "Indian Ridge", "Soliloquy"]);
  assert.deepEqual(countByLevel(runs), { easy: 2, advanced: 1 });
  assert.deepEqual(Object.keys(countByLevel(runs)), ["easy", "advanced"], "level order");
});

test("the runs leaving American Eagle's top: 2 blue", () => {
  const runs = topRuns(copper.graph, eagle);
  assert.deepEqual(runs.map((r) => r.name).sort(), ["Main Vein", "Ptarmigan"]);
  assert.deepEqual(countByLevel(runs), { intermediate: 2 });
});

test("every run counted is a real named run of the resort, once", () => {
  const names = new Set(copper.R.runs.map((r) => r.name));
  for (const l of copper.R.lifts) {
    const runs = topRuns(copper.graph, l);
    assert.equal(new Set(runs.map((r) => r.name)).size, runs.length, l.name);
    for (const r of runs) assert.ok(r.name && names.has(r.name), `${l.name}: ${r.name}`);
  }
});

test("seats: the number when OpenStreetMap has it, else the kind; never a made-up number", () => {
  assert.equal(seatsLabel(flyer), "6 人");
  assert.equal(eagle.seats, undefined);
  assert.equal(seatsLabel(eagle), "吊箱"); // a mixed lift: chairs and cabins
  assert.equal(seatsLabel({ kind: "gondola" }), "吊箱");
  assert.equal(seatsLabel({ kind: "chair_lift" }), "吊椅");
});

test("可换: the hub's lifts within 20 min plus the villages' lifts, not itself, no carpets", () => {
  const f = changeLifts(copper.R, copper.graph, flyer).map((c) => c.name);
  for (const n of ["Sierra", "Rendezvous", "Timberline Express", "Lumberjack"]) assert.ok(f.includes(n), n); // 换缆车
  for (const n of ["American Eagle", "Super Bee", "Kokomo Express", "Woodward Express"]) assert.ok(f.includes(n), n); // in the villages
  assert.equal(f.length, 8);
  assert.ok(!f.includes("American Flyer"));
  const e = changeLifts(copper.R, copper.graph, eagle);
  assert.equal(e[0].name, "Excelerator", "the quickest first");
  assert.ok(!e.some((c) => c.name === "American Eagle"));
  for (const l of copper.R.lifts) {
    const c = changeLifts(copper.R, copper.graph, l);
    for (const x of c) {
      const o = lift(copper.R, x.name);
      assert.ok(o && o.kind !== "magic_carpet" && o !== l && x.seconds <= 20 * 60, `${l.name} → ${x.name}`);
    }
  }
});

test("liftInfo puts it together", () => {
  const i = liftInfo(copper.R, copper.graph, flyer);
  assert.equal(i.seats, "6 人");
  assert.deepEqual(i.counts, { easy: 2, advanced: 1 });
  assert.equal(i.change.length, 8);
});

const centre = [{ lift: eagle, minutes: 7 }, { lift: flyer, minutes: 11 }];
test("the tip at Center Village: blue riders to American Eagle (a tie on runs, the shorter ride)", () => {
  const r = recommend(copper.R, copper.graph, centre, "intermediate");
  assert.equal(r.lift, eagle);
  assert.equal(r.next, "Excelerator");
  assert.equal(tipText(r, "intermediate"), "第一次来？中级可以先坐 American Eagle，上去有 2 条蓝道，滑下来还能换 Excelerator。");
});

test("a beginner goes up American Flyer for its greens, never to a blue or black", () => {
  const r = recommend(copper.R, copper.graph, centre, "easy");
  assert.equal(r.lift, flyer);
  assert.ok(r.ok.every((x) => x.level === "easy"));
  assert.match(tipText(r, "easy"), /^第一次来？初级可以先坐 American Flyer，上去有 2 条绿道/);
  assert.doesNotMatch(tipText(r, "easy"), /黑|蓝/);
});

test("no lift with a run at your level: the tip says so", () => {
  const r = recommend(copper.R, copper.graph, [{ lift: eagle, minutes: 7 }], "easy");
  assert.equal(r, null);
  assert.match(tipText(r, "easy"), /没有初级能滑的道/);
  assert.match(tipText(r, "easy", { bunny: true }), /宝宝坡/);
});

test("an advanced rider counts every run at or under black", () => {
  const r = recommend(copper.R, copper.graph, centre, "advanced");
  assert.equal(r.lift, flyer); // 3 runs (2 green, 1 black) against 2 blue
  assert.match(tipText(r, "advanced"), /2 条绿道、1 条黑道/);
});
