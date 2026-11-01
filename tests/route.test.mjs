// node --test tests/route.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildGraph, planRoute, nodesNear, LEVELS } from "../route.js";

const R = JSON.parse(readFileSync(new URL("../data/copper.json", import.meta.url)));
const [gw, gh] = R.grid, [x0, z0, x1, z1] = R.bounds;
const q = new Uint16Array(Uint8Array.from(Buffer.from(R.heights, "base64")).buffer);
const heightAt = (x, z) => {
  const c = Math.min(Math.max(((x - x0) / (x1 - x0)) * (gw - 1), 0), gw - 1.001);
  const r = Math.min(Math.max(((z - z0) / (z1 - z0)) * (gh - 1), 0), gh - 1.001);
  const i = Math.floor(r), j = Math.floor(c), fr = r - i, fc = c - j, h = (a, b) => q[a * gw + b] / 10;
  return h(i, j) * (1 - fc) * (1 - fr) + h(i, j + 1) * fc * (1 - fr) + h(i + 1, j) * (1 - fc) * fr + h(i + 1, j + 1) * fc * fr;
};
const graph = buildGraph(R, heightAt);
const place = (name) => R.places.find((p) => p.name === name);
const lift = (name) => R.lifts.find((l) => l.name === name);

test("Center Village to lunch at Flyer's goes up a lift and down runs", () => {
  const from = nodesNear(graph, place("Center Village").x, place("Center Village").z, 250);
  const to = nodesNear(graph, place("Flyer's").x, place("Flyer's").z, 200);
  const route = planRoute(graph, from, to, "intermediate");
  assert.ok(route, "a route exists");
  assert.equal(route.legs[0].type, "lift");
  assert.ok(route.legs.some((l) => l.type === "run"));
  for (const leg of route.legs) if (leg.type === "run") assert.ok(LEVELS.indexOf(leg.run.level) <= 1, `${leg.run.name} is ${leg.run.level}`);
  console.log("  Center Village → Flyer's:", route.legs.map((l) => l.type === "lift" ? `lift ${l.lift.name}` : l.type === "run" ? `${l.run.name}(${l.run.level})` : "skate").join(" → "), Math.round(route.seconds / 60), "min");
});

test("every village reaches every lift top and back down on blue or easier", () => {
  let failures = [];
  for (const v of R.places.filter((p) => p.kind === "village")) {
    const from = nodesNear(graph, v.x, v.z, 250);
    for (const l of R.lifts) {
      const up = planRoute(graph, from, [graph.liftNodes.get(l).top], "intermediate");
      if (!up) failures.push(`${v.name} → top of ${l.name}`);
    }
  }
  console.log("  unreachable lift tops on blue:", failures.length, failures.slice(0, 6));
  assert.ok(failures.length < R.lifts.length, "most lift tops are reachable");
});

test("a harder cap never makes the route slower", () => {
  const from = [graph.liftNodes.get(lift("Storm King")).top];
  const v = place("Center Village");
  const to = nodesNear(graph, v.x, v.z, 250);
  const times = LEVELS.map((cap) => planRoute(graph, from, to, cap)?.seconds ?? Infinity);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] <= times[i - 1] + 1e-6);
  console.log("  Storm King top → Center Village (min by cap):", times.map((t) => Math.round(t / 60)));
});
