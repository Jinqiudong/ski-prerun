// node --test tests/hub.test.mjs — the lift top's page: grouping, folding, one way per level (real resort data).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildGraph, planRoute, planTree, LEVELS } from "../src/core/route.js";
import { liftHub, foldLabel, goLabel, findPlanned, crumbOf, viaNext, bigLift, VILLAGE_R } from "../src/ride/hub-core.js";

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
const hubOf = ({ R, graph }, n, level = "advanced") => liftHub(R, graph, lift(R, n), { level });

test("planTree answers what planRoute answers", () => {
  const { R, graph } = copper, top = graph.liftNodes.get(lift(R, "Super Bee")).top;
  const tree = planTree(graph, [top], { maxLevel: "intermediate" });
  for (const name of ["Excelerator", "American Eagle", "Resolution"]) {
    const to = [graph.liftNodes.get(lift(R, name)).bottom];
    const a = planRoute(graph, [top], to, "intermediate"), b = tree.routeTo(to);
    assert.equal(!!a, !!b, name);
    if (a) assert.ok(Math.abs(a.seconds - b.seconds) < 1e-6, `${name}: ${a.seconds} vs ${b.seconds}`);
  }
  // Ski only: no lift legs at all.
  const ski = planTree(graph, [top], { lifts: false });
  const rt = ski.routeTo([graph.liftNodes.get(lift(R, "American Eagle")).bottom]);
  assert.ok(rt && !rt.legs.some((l) => l.type === "lift"));
});

test("Super Bee's top at Copper: the three groups", () => {
  const H = hubOf(copper, "Super Bee");
  assert.equal(H.same.kind, "same");
  assert.equal(H.same.name, "Super Bee");
  assert.ok(H.shown.length <= 4 && H.shown.length >= 2, "a few lifts to change to");
  assert.deepEqual(H.shown, H.change.slice(0, 4));
  assert.equal(H.more, Math.max(0, H.change.length - 4));
  for (let i = 1; i < H.change.length; i++) assert.ok(H.change[i - 1].seconds <= H.change[i].seconds, "quickest first");
  assert.ok(H.change.some((d) => d.name === "Resolution"));
  const names = H.bases.map((b) => b.name);
  for (const v of ["Center Village", "East Village", "Union Creek"]) assert.ok(names.includes(v), v);
});

test("a lift leaving from a village is folded into it, never listed under 换缆车", () => {
  const { R } = copper, H = hubOf(copper, "Super Bee");
  const cv = H.bases.find((b) => b.name === "Center Village");
  assert.ok(cv.lifts.includes("American Eagle") && cv.lifts.includes("American Flyer"));
  assert.match(foldLabel(cv), /^Center Village · 有 American Eagle、American Flyer/);
  const villages = R.places.filter((p) => p.kind === "village");
  for (const d of H.change) {
    assert.ok(!["American Eagle", "American Flyer"].includes(d.name));
    assert.ok(villages.every((v) => Math.hypot(v.x - d.at[0], v.z - d.at[1]) >= VILLAGE_R), `${d.name} is not at a village`);
  }
  // This lift itself is 再坐一次, not one of its village's lifts.
  const R2 = hubOf(copper, "Resolution");
  const ev = R2.bases.find((b) => b.name === "East Village");
  assert.ok(ev.lifts.includes("Super Bee"));
  assert.ok(!ev.lifts.includes("Resolution"));
});

test("each place: at most one way per level, the quickest, ski only", () => {
  const { R, graph } = copper;
  for (const n of ["Super Bee", "Resolution", "American Eagle"]) {
    const H = hubOf(copper, n);
    for (const d of H.all) {
      const lvls = d.variants.map((v) => v.level);
      assert.equal(new Set(lvls).size, lvls.length, `${n} → ${d.name}: one per level`);
      assert.deepEqual(lvls, [...lvls].sort((a, b) => LEVELS.indexOf(a) - LEVELS.indexOf(b)), "green first");
      for (const v of d.variants) {
        assert.ok(v.legs.every((l) => l.type !== "lift"), "no lift on the way");
        assert.ok(v.runs.length && v.seconds > 0);
        assert.equal(v.level, LEVELS[Math.max(...v.runs.map((r) => LEVELS.indexOf(r.level)))], "level is the hardest run");
        // No quicker way at that level or under it ends there (the planner's own answer).
        const rt = planTree(graph, [graph.liftNodes.get(lift(R, n)).top], { maxLevel: v.level, lifts: false }).routeTo(v.to);
        if (rt && LEVELS.indexOf(v.level) === Math.max(...rt.legs.filter((l) => l.type === "run").map((l) => LEVELS.indexOf(l.run.level)))) assert.ok(v.seconds <= rt.seconds + 1e-6);
      }
    }
  }
});

test("the way picked for you stays within your level", () => {
  const blue = hubOf(copper, "Super Bee", "intermediate");
  for (const d of blue.all) if (d.variants.some((v) => !v.harder)) assert.ok(LEVELS.indexOf(d.best.level) <= 1, `${d.name}: ${d.best.level}`);
  const green = hubOf(copper, "American Eagle", "easy");
  for (const d of green.all) for (const v of d.variants) assert.equal(v.harder, LEVELS.indexOf(v.level) > 0);
});

test("go labels and the planned leg from the address", () => {
  const H = hubOf(copper, "Super Bee");
  assert.equal(goLabel(H.same), "就滑这条");
  assert.equal(goLabel(H.change.find((d) => d.name === "Resolution")), "滑去坐 Resolution");
  assert.equal(goLabel(H.bases[0]), `滑回 ${H.bases[0].name}`);
  const R2 = hubOf(copper, "Resolution");
  const p = findPlanned(R2, "base:East Village", "intermediate");
  assert.equal(p.dest.name, "East Village");
  assert.equal(p.variant.level, "intermediate");
  assert.equal(findPlanned(R2, "base:East Village", "nope").variant, p.dest.best);
  assert.equal(findPlanned(R2, "lift:Resolution").dest.kind, "same");
  assert.equal(findPlanned(R2, "base:Nowhere"), null);
  const r = findPlanned(R2, "run:Andy's Encore");
  assert.equal(r.variant.runs[0].name, "Andy's Encore");
});

test("the breadcrumb", () => {
  assert.deepEqual(crumbOf("", "Super Bee", null), ["Super Bee", "？"]);
  assert.deepEqual(crumbOf("Super Bee", "Resolution", "East Village"), ["Super Bee", "Resolution", "East Village"]);
  assert.equal(viaNext("", "Super Bee"), "Super Bee");
  assert.equal(viaNext("A,B,C", "D"), "B,C,D");
});

test("other resorts: every big lift's top has somewhere to go; villages fold their lifts", () => {
  for (const id of ["eldora", "abasin", "highlands"]) {
    const res = load(id);
    for (const l of res.R.lifts.filter(bigLift)) {
      const H = liftHub(res.R, res.graph, l, { level: "expert" });
      if (!H) continue;
      const seen = new Set();
      for (const d of [...H.change, ...H.bases]) { assert.ok(!seen.has(d.key), `${id} ${l.name}: ${d.key} twice`); seen.add(d.key); }
      const folded = new Set(H.bases.flatMap((b) => b.lifts));
      for (const d of H.change) assert.ok(!folded.has(d.name), `${id} ${l.name}: ${d.name} listed twice`);
    }
  }
  const e = load("eldora"), H = liftHub(e.R, e.graph, lift(e.R, "Corona"), { level: "advanced" });
  assert.ok(H.all.length >= 3);
  assert.ok(H.bases.some((b) => b.lifts.length));
});
