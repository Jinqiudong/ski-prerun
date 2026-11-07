// The roadbook's rules (src/ride/roadbook-core.js): steps → legs (old days too), real runs vs connectors,
// areas and transfers, the track kept, estimated times.
import { test } from "node:test";
import assert from "node:assert/strict";
import { segsOf, thinTrack, trackPieces, kindOfTitle, isReal, legsOf, blocksOf, areaName, lapTimes, mapItems, REAL } from "../src/ride/roadbook-core.js";
import { PACE } from "../src/core/route.js";

test("an old day: lifts only opened are peeks, the lift topped is the leg, the choice says what kind", () => {
  // the owner's screenshot: four lifts opened in a row, only Timberline ridden to the top
  const day = { steps: [
    { k: "base", name: "Center Village" },
    { k: "lift", name: "American Flyer" }, { k: "lift", name: "Mountain Chief" }, { k: "lift", name: "Sierra" }, { k: "lift", name: "Timberline Express" },
    { k: "top", at: "Timberline Express", options: ["接 Lumberjack 缆车", "再坐一趟 Timberline Express", "回 Union Creek"], chose: "接 Lumberjack 缆车" },
    { k: "route", title: "接 Lumberjack 缆车", segs: [{ n: "Windsong", l: "intermediate" }, { n: "Timber Road", l: "easy" }], path: [[0, 0], [10, 10]], next: "Lumberjack" },
    { k: "arrive", title: "到 Lumberjack 底站了" },
  ] };
  const { start, legs, peeks } = legsOf(day);
  assert.equal(start, "Center Village");
  assert.deepEqual(peeks, ["American Flyer", "Mountain Chief", "Sierra"]);
  assert.equal(legs.length, 1);
  assert.equal(legs[0].lift, "Timberline Express");
  assert.equal(legs[0].no, 1);
  assert.deepEqual(legs[0].go, { kind: "lift", to: "Lumberjack", title: "接 Lumberjack 缆车" });
  assert.deepEqual(legs[0].end, { k: "lift", name: "Lumberjack" });
  assert.ok(legs[0].segs.every((s) => !s.real)); // going to a lift, no lengths known: connectors
  assert.ok(legs[0].old);
});

test("an old day: a run picked at the top is the real run, the rest connectors", () => {
  const day = { steps: [
    { k: "lift", name: "A" }, { k: "top", at: "A", options: [], chose: "Windsong" },
    { k: "route", title: "Windsong", segs: [{ n: "Windsong", l: "intermediate" }, { n: "Fairway", l: "easy" }], next: "B" },
    { k: "lift", name: "B" }, { k: "top", at: "B", options: [], chose: "回 Union Creek" }, { k: "route", title: "回 Union Creek", segs: [{ n: "Roundabout", l: "easy" }] },
  ] };
  const { legs, peeks } = legsOf(day);
  assert.deepEqual(peeks, []);
  assert.deepEqual(legs[0].segs.map((s) => s.real), [true, false]);
  assert.deepEqual(legs[0].end, { k: "lift", name: "B" });
  assert.deepEqual(legs[1].end, { k: "base", name: "Union Creek" });
});

test("a way to a base that goes on by lift ends, for this leg, at that lift", () => {
  const { legs } = legsOf({ steps: [{ k: "up", lift: "Lumberjack", id: 9 }, { k: "go", kind: "base", title: "回 Union Creek", to: "Union Creek", next: "Lumberjack", segs: [{ id: "1", n: "I-Way", l: "easy", len: 130, drop: 18 }] }] });
  assert.deepEqual(legs[0].end, { k: "lift", name: "Lumberjack" });
});

test("replanned on the way: the runs so far and the new ones, the kind picked at the top, the new end", () => {
  const { legs } = legsOf({ steps: [
    { k: "up", lift: "Timberline", id: 4 },
    { k: "go", kind: "run", title: "Windsong", first: "1", segs: [{ id: "1", n: "Windsong", l: "intermediate", a: 0, b: 50, len: 1490, drop: 340 }] },
    { k: "go", changed: 1, kind: "run", title: "Windsong", first: "1", next: "Lumberjack", segs: [{ id: "1", n: "Windsong", l: "intermediate", a: 30, b: 50, len: 600, drop: 120 }, { id: "2", n: "Timber Road", l: "easy", a: 0, b: 9, len: 650, drop: 50 }] },
  ] });
  assert.equal(legs[0].changed, true);
  assert.deepEqual(legs[0].segs.map((s) => [s.n, s.real, s.len]), [["Windsong", true, 1490], ["Timber Road", false, 650]]);
  assert.deepEqual(legs[0].end, { k: "lift", name: "Lumberjack" });
});

test("kinds from old titles", () => {
  assert.deepEqual(kindOfTitle("接 Lumberjack 缆车"), { kind: "lift", to: "Lumberjack" });
  assert.deepEqual(kindOfTitle("再坐一趟 Super Gauge Express"), { kind: "lift", to: "Super Gauge Express" });
  assert.deepEqual(kindOfTitle("回 Winter Park Base"), { kind: "base", to: "Winter Park Base" });
  assert.deepEqual(kindOfTitle("Cranmer"), { kind: "run", to: null });
});

test("real runs: the run picked; on the way somewhere, only a long stretch with real vertical", () => {
  assert.ok(isReal({ kind: "run", first: "7" }, { id: "7", len: 300, drop: 50 }));
  assert.ok(!isReal({ kind: "run", first: "7" }, { id: "8", len: 3000, drop: 800 }));
  assert.ok(isReal({ kind: "lift", to: "X" }, { id: "9", len: REAL.len, drop: REAL.drop }));
  assert.ok(!isReal({ kind: "lift", to: "X" }, { id: "9", len: 900, drop: 400 }));
  assert.ok(!isReal({ kind: "base", to: "X" }, { id: "9", len: 2000, drop: 100 }));
  assert.ok(!isReal(null, { id: "9" }));
});

// A small resort: two bases 3 km apart, a lift from each, runs between.
const BASES = [{ name: "Winter Park Base", x: 0, z: 0 }, { name: "Mary Jane Base", x: 3000, z: 0 }];
const LIFTS = [
  { id: 1, name: "Gondola", pts: [[0, 0], [0, -2000]] },
  { id: 2, name: "Olympia", pts: [[500, -300], [1500, -2000]] },
  { id: 3, name: "Super Gauge", pts: [[3000, 0], [3000, -2000]] },
];
const newDay = { steps: [
  { k: "base", name: "Winter Park Base" },
  { k: "up", lift: "Gondola", id: 1 },
  { k: "go", kind: "run", title: "Cranmer", first: "11", segs: [{ id: "11", n: "Cranmer", l: "intermediate", a: 0, b: 40, len: 1800, drop: 370 }, { id: "12", n: "Cat Track", l: "easy", a: 0, b: 5, len: 200, drop: 10 }], path: [[0, -2000], [500, -300]] },
  { k: "down", track: [[0, -1990], [200, -1500], [500, -310]] },
  { k: "up", lift: "Olympia", id: 2 },
  { k: "go", kind: "lift", title: "接 Super Gauge 缆车", to: "Super Gauge", segs: [{ id: "13", n: "Mary Jane", l: "intermediate", a: 0, b: 60, len: 1630, drop: 396 }, { id: "14", n: "Link", l: "easy", a: 0, b: 3, len: 120, drop: 5 }] },
  { k: "down", track: [[1500, -1990], [3000, -10]] },
  { k: "up", lift: "Super Gauge", id: 3 },
  { k: "go", kind: "run", title: "Trail", first: "15", segs: [{ id: "15", n: "Trail", l: "advanced", a: 0, b: 50, len: 1700, drop: 480 }] },
  { k: "jump", to: "Trail" },
  { k: "down", track: [[3000, -1990], [3000, -1000], [3010, -20]] },
] };

test("a new day: legs from reaching the top, the way picked, the line ridden", () => {
  const { start, legs, peeks } = legsOf(newDay);
  assert.equal(start, "Winter Park Base");
  assert.deepEqual(peeks, []);
  assert.deepEqual(legs.map((l) => [l.no, l.lift, l.id]), [[1, "Gondola", "1"], [2, "Olympia", "2"], [3, "Super Gauge", "3"]]);
  assert.deepEqual(legs[0].segs.map((s) => s.real), [true, false]);
  assert.deepEqual(legs[1].segs.map((s) => s.real), [true, false]); // Mary Jane: long with real vertical
  assert.deepEqual(legs[0].end, { k: "lift", name: "Olympia" });
  assert.deepEqual(legs[1].end, { k: "lift", name: "Super Gauge" });
  assert.equal(legs[2].end, null);
  assert.ok(legs[2].partial && !legs[0].partial);
  assert.equal(legs[0].track.length, 3);
});

test("areas: the base each lift leaves from; skiing from one to the other is a transfer", () => {
  const { legs } = legsOf(newDay);
  const blocks = blocksOf(legs, { lifts: LIFTS, bases: BASES });
  assert.deepEqual(blocks.map((b) => (b.xfer ? `xfer ${b.xfer.lift}: ${b.from}→${b.to}` : `${b.area}: ${b.legs.map((l) => l.lift).join(",")}`)),
    ["Winter Park: Gondola", "xfer Olympia: Winter Park→Mary Jane", "Mary Jane: Super Gauge"]);
  // one base: no headings, no transfers
  const one = blocksOf(legsOf(newDay).legs, { lifts: LIFTS, bases: BASES.slice(0, 1) });
  assert.equal(one.length, 1);
  assert.equal(one[0].area, null);
  assert.equal(one[0].legs.length, 3);
  // a run that ends mid-mountain with nothing after it is not a move to another area
  const mid = legsOf({ steps: [{ k: "up", lift: "Gondola", id: 1 }, { k: "go", kind: "run", title: "X", first: "1", segs: [{ id: "1", n: "X", l: "easy", len: 900, drop: 100 }], path: [[0, -2000], [2900, -100]] }] });
  assert.deepEqual(blocksOf(mid.legs, { lifts: LIFTS, bases: BASES }).map((b) => (b.xfer ? "xfer" : b.area)), [null]);
  assert.equal(areaName("Mary Jane Base"), "Mary Jane");
  assert.equal(areaName("Center Village"), "Center Village");
});

test("the planner's legs as segments: one per run, its stretch, length and drop", () => {
  const run = { id: 5, name: "Cranmer", level: "intermediate", pts: Array.from({ length: 11 }, (_, i) => [0, i * 100]) };
  const run2 = { id: 6, name: "", level: "easy", pts: [[0, 1000], [0, 1100]] };
  const heightAt = (x, z) => 1000 - z * 0.2;
  const segs = segsOf([{ type: "run", run, from: 0, to: 4 }, { type: "run", run, from: 4, to: 10 }, { type: "skate" }, { type: "run", run: run2, from: 0, to: 1 }, { type: "lift" }, { type: "run", run, from: 0, to: 1 }], heightAt);
  assert.deepEqual(segs, [
    { id: "5", n: "Cranmer", l: "intermediate", a: 0, b: 10, len: 1000, drop: 200 },
    { id: "6", n: "无名雪道", l: "easy", a: 0, b: 1, len: 100, drop: 20 },
  ]);
});

test("the track kept: a point every 20 m, and pieces split where a jump left a gap", () => {
  const line = Array.from({ length: 101 }, (_, i) => [i * 2.5, 0]); // 250 m in 2.5 m steps
  const thin = thinTrack(line);
  assert.equal(thin.length, 14); // 0, 20 … 240, and the end
  assert.deepEqual(thin[thin.length - 1], [250, 0]);
  assert.deepEqual(trackPieces([[0, 0], [10, 0], [20, 0], [900, 0], [910, 0]]).map((p) => p.length), [3, 2]);
  assert.deepEqual(trackPieces([[0, 0]]), []);
});

test("estimated times: the planner's pace, the line at the lift", () => {
  const leg = { segs: [{ l: "intermediate", len: 960 }, { l: "easy", len: 360 }] };
  const t = lapTimes(leg, 1800);
  assert.equal(t.up, Math.round((PACE.wait + 1800 / PACE.lift) / 60));
  assert.equal(t.down, Math.round((960 / PACE.run.intermediate + 360 / PACE.run.easy) / 60));
  assert.equal(t.lap, Math.round((PACE.wait + 1800 / PACE.lift + 960 / PACE.run.intermediate + 360 / PACE.run.easy) / 60));
  assert.deepEqual(lapTimes({ segs: [{ n: "x" }] }, null), { up: null, down: null, lap: null });
});

test("the map draws only what was ridden: the lifts once with their numbers, the track coloured by segment", () => {
  const runs = [
    { id: 11, name: "Cranmer", level: "intermediate", pts: [[0, -2000], [0, -1000], [0, -300]] },
    { id: 12, name: "Cat Track", level: "easy", pts: [[0, -300], [500, -300]] },
    { id: 99, name: "Elsewhere", level: "expert", pts: [[9000, 0], [9100, 0]] },
  ];
  const day = legsOf({ steps: [
    { k: "base", name: "Winter Park Base" },
    { k: "up", lift: "Gondola", id: 1 },
    { k: "go", kind: "run", title: "Cranmer", first: "11", segs: [{ id: "11", n: "Cranmer", l: "intermediate", a: 0, b: 2, len: 1700, drop: 300 }, { id: "12", n: "Cat Track", l: "easy", a: 0, b: 1, len: 500, drop: 5 }] },
    { k: "down", track: [...Array.from({ length: 85 }, (_, i) => [0, -1990 + i * 20]), ...Array.from({ length: 25 }, (_, i) => [i * 20 + 10, -300])] },
    { k: "up", lift: "Gondola", id: 1 },
    { k: "go", kind: "base", title: "回 Winter Park Base", to: "Winter Park Base", segs: [{ id: "11", n: "Cranmer", l: "intermediate", a: 0, b: 2, len: 1700, drop: 300 }] },
  ] });
  const m = mapItems(day, { runsById: new Map(runs.map((r) => [String(r.id), r])), lifts: LIFTS, bases: BASES });
  assert.deepEqual(m.lifts, [{ a: [0, 0], b: [0, -2000], nos: [1, 2] }]);
  // leg 1: the ridden track, Cranmer in ink then the cat track as a connector; leg 2: no track, Cranmer from
  // its run (on the way back to the base, but long with real vertical: a real run)
  assert.deepEqual(m.lines.map((x) => [x.real, x.level, x.pts.length]), [[true, "intermediate", 85], [false, "easy", 26], [true, "intermediate", 3]]);
  assert.deepEqual(m.labels, [{ text: "Cranmer", at: [0, -1000] }]);
  assert.deepEqual(m.lodges, [[0, 0]]);
});
