// node --test tests/resorts.test.mjs — every resort's map holds together, on the planner itself (route.js) and the
// resort's own height grid: lifts go up, every lift top has a way down, every base reaches the lifts.
// The checks are tools/audit_resorts.mjs's (run it for the full report). A resort's known gaps are listed below
// with the reason; anything else failing is new.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadResort, structure } from "../tools/audit_resorts.mjs";

const IDS = JSON.parse(readFileSync(new URL("../data/resorts.json", import.meta.url))).filter((r) => r.ready).map((r) => r.id);

// Known exceptions, by resort and lift name: real gaps in the OpenStreetMap data, reported, not invented.
const NO_WAY_DOWN = {
  // A people mover from the parking lots to the village: its top end has no runs mapped (not a ski lift).
  winterpark: ["Village Cabriolet"],
};
const ORPHAN = {
  // Storm King's bottom is in Copper Bowl; OSM has no traverse from the top of Excelerator / Super Bee to it
  // (the nearest mapped snow, Ptarmigan, passes 140 m away and 36 m lower).
  copper: ["Storm King"],
};

for (const id of IDS) {
  const S = structure(loadResort(id));
  test(`${id}: every lift goes up (first point lower than the last)`, () => {
    assert.deepEqual(S.reversed.map((r) => r.name), []);
  });
  test(`${id}: every lift top has a way down (ski only, to a lift's bottom or a base)`, () => {
    assert.deepEqual(S.stranded.map((r) => r.name).filter((n) => !(NO_WAY_DOWN[id] || []).includes(n)), []);
  });
  test(`${id}: every base reaches a lift, and every lift people ride is reached from a base`, () => {
    assert.ok(S.bases.length > 0, "the resort has a base");
    for (const b of S.bases) assert.ok(b.reachesAny, `${b.name} reaches no lift`);
    const orphan = S.orphan.filter((r) => r.rideable).map((r) => r.name);
    assert.deepEqual(orphan.filter((n) => !(ORPHAN[id] || []).includes(n)), []);
  });
  test(`${id}: no run is drawn uphill`, () => {
    assert.deepEqual(S.uphillRuns.map((r) => `${r.name} (${r.id})`), []);
  });
}

test("the known exceptions are still real (drop them once the data is fixed)", () => {
  for (const [id, names] of Object.entries(NO_WAY_DOWN)) {
    const S = structure(loadResort(id));
    for (const n of names) assert.ok(S.stranded.some((r) => r.name === n), `${id} ${n} has a way down now`);
  }
  for (const [id, names] of Object.entries(ORPHAN)) {
    const S = structure(loadResort(id));
    for (const n of names) assert.ok(S.orphan.some((r) => r.name === n), `${id} ${n} is reached now`);
  }
});
