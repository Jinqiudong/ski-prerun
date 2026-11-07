// Powder and moguls (src/ride/snow-core.js): where powder lies after heavy snow, which runs have moguls, the
// bumps' zipper, and the board over them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { POWDER, powderAmount, groomedRun, wildName, runFacts, powderTerrain, powderField, powderAt, MOGULS, runPitch, mogulRun, markMoguls, mogulHeight, cap, MogulField, bumpStep, TREE, treeHit } from "../src/ride/snow-core.js";

// A synthetic mountain on a 10 m grid, x east, z south: heights from f(x, z).
function terrain(f, n = 81, cell = 10) {
  const h = new Float32Array(n * n), half = ((n - 1) * cell) / 2;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) h[r * n + c] = f(c * cell - half, r * cell - half);
  return { h, gw: n, gh: n, x0: -half, z0: -half, x1: half, z1: half, cell };
}
const at = (T, tp, x, z) => tp[Math.round((z - T.z0) / T.cell) * T.gw + Math.round((x - T.x0) / T.cell)];
const tan = (deg) => Math.tan((deg * Math.PI) / 180);

test("how much fell: a powder day from minCm, forced by ?powder", () => {
  assert.equal(powderAmount(3), 0);
  assert.equal(powderAmount(null), 0);
  assert.ok(powderAmount(POWDER.minCm) > 0.2);
  assert.ok(powderAmount(20) < powderAmount(30));
  assert.equal(powderAmount(80), 1);
  assert.equal(powderAmount(0, "1"), 1);
  assert.equal(powderAmount(50, "0"), 0);
  assert.equal(powderAmount(0, "0.5"), 0.5);
  assert.equal(powderAmount(0, "map"), 1);
  assert.equal(powderAmount(0, "nonsense"), 0);
});

test("groomed runs: classic, or untagged greens and blues", () => {
  assert.ok(groomedRun({ grooming: "classic", level: "advanced" }));
  assert.ok(groomedRun({ grooming: "classic+mogul", level: "advanced" }));
  assert.ok(groomedRun({ level: "intermediate" }));
  assert.ok(!groomedRun({ level: "expert" }));
  assert.ok(!groomedRun({ grooming: "mogul", level: "intermediate" }));
  assert.ok(!groomedRun({ grooming: "backcountry", level: "easy" }));
});

test("a run named for trees, glades, a bowl, a chute or a cirque is taken as not groomed (inferred); a tag still wins", () => {
  for (const n of ["Jackstraw Trees", "Log Chute", "Bellmar Bowl", "Aspen Glade", "Vasquez Cirque", "Chutes"]) assert.ok(wildName(n), n);
  for (const n of ["Treeline", "Bowling Alley", "Cranmer", "", null]) assert.ok(!wildName(n), String(n));
  assert.ok(!groomedRun({ name: "Jackstraw Trees", level: "intermediate" }));
  assert.ok(!groomedRun({ name: "Bellmar Bowl", level: "easy" }));
  assert.ok(groomedRun({ name: "Spirit Chute", grooming: "classic", level: "intermediate" }));
  assert.ok(groomedRun({ name: "Windsong", level: "intermediate" }));
});

test("run facts: measured length, drop and pitch; the surface from the tag or inferred; powder only as a maybe", () => {
  // a straight run down a 20 degree slope, 400 m
  const pts = Array.from({ length: 41 }, (_, i) => [0, i * 10]), heightAt = (x, z) => 1000 - z * tan(20);
  const f = runFacts({ name: "Test", level: "intermediate", pts }, pts, heightAt);
  assert.equal(f.len, 400);
  assert.ok(Math.abs(f.drop - 400 * tan(20)) < 1);
  assert.ok(Math.abs(f.pitch - 20) <= 1 && Math.abs(f.mean - 20) <= 1);
  assert.deepEqual(f.surface, { k: "groomed", src: "inferred" });
  assert.equal(f.powder, null);
  assert.deepEqual(runFacts({ level: "advanced", grooming: "classic", pts }, pts, heightAt).surface, { k: "groomed", src: "tag" });
  assert.deepEqual(runFacts({ level: "advanced", grooming: "mogul", pts }, pts, heightAt).surface, { k: "moguls", src: "tag" });
  assert.deepEqual(runFacts({ level: "expert", grooming: "backcountry", pts }, pts, heightAt).surface, { k: "offpiste", src: "tag" });
  assert.deepEqual(runFacts({ name: "Some Trees", level: "intermediate", pts }, pts, heightAt).surface, { k: "ungroomed", src: "inferred", wild: true });
  // powder: a field that is deep everywhere; on a groomed run only its edges are said to have any, off it the whole run
  const field = { w: 3, h: 3, x0: -1000, z0: -1000, x1: 1000, z1: 1000, data: new Uint8Array(9).fill(255) };
  const fakeAt = field;
  assert.deepEqual(runFacts({ level: "intermediate", pts }, pts, heightAt, { f: fakeAt, amt: 1 }).powder, { k: "edges", src: "inferred" });
  assert.deepEqual(runFacts({ level: "advanced", pts }, pts, heightAt, { f: fakeAt, amt: 1 }).powder, { k: "whole", src: "inferred" });
  assert.equal(runFacts({ level: "advanced", pts }, pts, heightAt, { f: fakeAt, amt: 0 }).powder, null);
});

test("powder: the lee side of a ridge, not the windward side or its crest", () => {
  // a ridge running north-south at x = 0, 20° either side: the west face meets the WNW wind, the east is its lee
  const T = terrain((x) => 400 - Math.abs(x) * tan(20));
  const tp = powderTerrain(T.h, T.gw, T.gh, T.cell);
  const lee = at(T, tp, 150, 0), wind = at(T, tp, -150, 0), crest = at(T, tp, 0, 0);
  assert.ok(lee > 0.75, `lee ${lee}`);
  assert.ok(wind < 0.4, `windward ${wind}`);
  assert.ok(crest < lee * 0.6, `crest ${crest}`);
});

test("powder: bowls and gullies gain, steep faces hold none, gentle pitches hold most", () => {
  const bowl = terrain((x, z) => 0.004 * (x * x + z * z)), dome = terrain((x, z) => -0.004 * (x * x + z * z)); // a hollow, a knoll
  const tb = powderTerrain(bowl.h, bowl.gw, bowl.gh, bowl.cell), td = powderTerrain(dome.h, dome.gw, dome.gh, dome.cell);
  const plane = (deg) => { const T = terrain((x) => x * tan(deg)); return at(T, powderTerrain(T.h, T.gw, T.gh, T.cell), 0, 0); }; // rising east: faces west, into the wind
  const lee = (deg) => { const T = terrain((x) => -x * tan(deg)); return at(T, powderTerrain(T.h, T.gw, T.gh, T.cell), 0, 0); };
  assert.ok(at(bowl, tb, 0, 0) > 0.75, `the bowl's floor ${at(bowl, tb, 0, 0)}`);
  assert.ok(at(bowl, tb, 0, 40) > at(dome, td, 0, 40) * 1.5, "a bowl's side against a knoll's");
  assert.ok(at(bowl, tb, -40, 0) > at(dome, td, 40, 0), "even its windward side, against the knoll's same-facing side");
  assert.ok(lee(48) < 0.05, `a 48° face ${lee(48)}`);
  assert.ok(lee(20) > lee(36), "a moderate pitch holds more than a steep one");
  assert.ok(lee(20) > lee(1), "a moderate pitch holds more than a flat");
  assert.ok(plane(20) < lee(20) * 0.5, "windward against lee at the same pitch");
});

test("powder field: the woods shelter it, a groomed run is packed in the middle and banked at its edges", () => {
  const T = terrain((x) => -x * tan(18), 61, 10); // lee slope everywhere
  const run = { level: "intermediate", pts: [[0, -250], [0, 250]] };
  const trees = (x, z) => z > 150; // a wood in the south
  const f = powderField(T, trees, [run], 121, 121);
  const mid = powderAt(f, 0, 0), bank = powderAt(f, 14, 0), off = powderAt(f, 120, 0), wood = powderAt(f, 120, 220);
  assert.ok(mid < 0.2, `packed middle ${mid}`);
  assert.ok(bank > off, `bank ${bank} vs open slope ${off}`);
  assert.ok(wood >= off, `woods ${wood} vs open slope ${off}`);
  assert.equal(powderAt(f, 9999, 0), 0);
  // an ungroomed run (a black) isn't packed
  const g = powderField(T, () => false, [{ level: "expert", pts: [[0, -250], [0, 250]] }], 121, 121);
  assert.ok(powderAt(g, 0, 0) > 0.6);
});

test("moguls: tagged runs, and steep ungroomed blacks; never groomed or backcountry ones", () => {
  const steep = MOGULS.natural.advanced + 2, gentle = MOGULS.natural.advanced - 8;
  assert.equal(mogulRun({ grooming: "mogul", level: "intermediate" }, 10), "tag");
  assert.equal(mogulRun({ grooming: "classic+mogul", level: "advanced" }, 10), "tag");
  assert.equal(mogulRun({ level: "advanced" }, steep), "natural");
  assert.equal(mogulRun({ level: "expert", grooming: "no" }, MOGULS.natural.expert), "natural");
  assert.equal(mogulRun({ level: "advanced" }, gentle), null);
  assert.equal(mogulRun({ level: "advanced", grooming: "classic" }, 40), null);
  assert.equal(mogulRun({ level: "expert", grooming: "backcountry" }, 40), null);
  assert.equal(mogulRun({ level: "intermediate" }, 40), null);
  assert.equal(mogulRun({ level: "advanced", area: true }, 40), null);
  // the rule is the table: loosen it and a gentler black bumps up
  assert.equal(mogulRun({ level: "advanced" }, gentle, { ...MOGULS, natural: { advanced: gentle } }), "natural");
});

test("a run's steepest held pitch, and marking a resort's runs", () => {
  const heightAt = (x, z) => -z * tan(30); // falling 30° to the south
  const pts = []; for (let z = 0; z <= 200; z += 10) pts.push([0, z]);
  assert.ok(Math.abs(runPitch(pts, heightAt) - 30) < 0.5);
  const runs = [{ level: "advanced", pts }, { level: "advanced", grooming: "classic", pts }, { level: "easy", grooming: "mogul", pts }];
  const out = markMoguls(runs, heightAt, { ...MOGULS, natural: { advanced: 28 } });
  assert.deepEqual(runs.map((r) => r.moguls), ["natural", null, "tag"]);
  assert.equal(out.length, 2);
});

test("the bumps: 0.5–0.8 m mushroom caps in a staggered zipper about 3.5 m apart, fading at the edges", () => {
  let max = 0, min = Infinity;
  for (let s = 20; s < 60; s += 0.2) for (let d = -8; d < 8; d += 0.2) { const h = mogulHeight(s, d, 3); max = Math.max(max, h); min = Math.min(min, h); }
  assert.ok(max >= 0.5 && max <= MOGULS.height[1] + 1e-6, `tallest ${max}`);
  assert.equal(min, 0, "troughs between them");
  assert.equal(mogulHeight(30, MOGULS.halfWidth + 0.5, 3), 0, "none past the edge");
  assert.equal(mogulHeight(0, 0, 3, 200), 0, "none right at the start");
  assert.ok(mogulHeight(3, 0.3, 3, 200) < 0.3, "low as they start");
  // peaks along the fall line come about one row gap apart
  const peaks = []; let prev = 0, rising = false;
  for (let s = 20; s < 120; s += 0.05) { const h = mogulHeight(s, 0, 3); if (h < prev && rising && prev > 0.3) peaks.push(s); rising = h > prev; prev = h; }
  const gaps = peaks.slice(1).map((p, i) => p - peaks[i]).filter((g) => g < 9);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  assert.ok(mean > 2.6 && mean < 8, `mean gap ${mean}`);
  // a cap: round at the top, 0 at its rim
  assert.equal(cap(0), 1); assert.equal(cap(1), 0); assert.ok(cap(0.3) > 0.9 && cap(0.8) < 0.5);
});

test("MogulField: the surface over a run found by (x, z), nothing off it", () => {
  const run = { id: 5, moguls: "tag", pts: [[0, 0], [0, 100], [0, 200]] };
  const F = new MogulField();
  F.add(run); F.add(run);
  assert.equal(F.size, 1);
  const p = F.locate(3, 50);
  assert.ok(Math.abs(p.s - 50) < 0.01 && Math.abs(p.d) - 3 < 0.01);
  assert.ok(Math.abs(F.height(3, 50) - mogulHeight(p.s, p.d, p.line.seed, p.line.len, MOGULS, p.line.k)) < 1e-9);
  F.clip(p.line, 60, 140); // only part of it bumped
  assert.equal(F.height(3, 50), 0);
  let some = 0; for (let z = 60; z < 140; z += 0.5) some = Math.max(some, F.height(0, z));
  assert.ok(some > 0.4);
  F.clip(p.line, 0, Infinity);
  assert.equal(F.height(40, 50), 0);
  assert.equal(F.locate(500, 500), null);
  let any = 0; for (let z = 20; z < 180; z += 0.5) any = Math.max(any, F.height(0, z));
  assert.ok(any > 0.4);
});

test("over the bumps: slow riders stay on the snow and soak them up; fast ones get a little air", () => {
  const ride = (v) => {
    const st = {}; let air = 0, top = 0, absorb = 0;
    for (let i = 0; i < 600; i++) { const hs = mogulHeight((i * v) / 60, 0.4, 3); bumpStep(st, hs, v, 1 / 60); if (st.air) { air += 1 / 60; top = Math.max(top, st.y - hs); } absorb = Math.max(absorb, st.absorb); assert.ok(st.y >= hs - 1e-9); }
    return { air, top, absorb };
  };
  const slow = ride(5), fast = ride(14);
  assert.equal(slow.air, 0);
  assert.ok(slow.absorb > 0.3, `knees bend ${slow.absorb}`);
  assert.ok(fast.air > 0.5, `fast air ${fast.air}`);
  assert.ok(fast.top < 1.2, `hops stay small ${fast.top}`);
});

test("a tree: straight on and fast is a crash; a glance deflects you round it; slow, you slide round; never pinned", () => {
  const tree = { x: 0, z: 0 }, D = Math.PI / 180;
  const at = (deg, speed, back = TREE.r - 0.1) => ({ x: -Math.sin(deg * D) * back, z: -Math.cos(deg * D) * back, heading: 0, speed });
  // straight on at 29 km/h: down, and up facing clear of the trunk (never into it)
  const c = treeHit(at(0, 8), tree, { x: 0, z: 1 });
  assert.ok(c.crash && c.speed === 0 && c.hard > 0.5);
  assert.ok(Math.sin(c.up) * (c.x - tree.x) + Math.cos(c.up) * (c.z - tree.z) >= -1e-9, "gets up facing away from the trunk or round it");
  assert.ok(Math.abs(Math.hypot(c.x, c.z) - TREE.r - 0.05) < 1e-9, "put just outside the trunk");
  // a glancing hit (contact 45° off the trunk's centre) at 36 km/h: no crash, turned off it, most of the speed kept
  const g = treeHit(at(45, 10), tree, { x: 0, z: 1 });
  assert.ok(!g.crash);
  assert.ok(g.speed > 5.5, `kept ${g.speed}`);
  assert.ok(Math.abs(g.heading) > 30 * D && Math.abs(g.heading) < 60 * D, `round it ${g.heading / D}`);
  // straight on but slow: no crash, slides round toward the way on at a walking pace at least
  const s = treeHit(at(0, 3), tree, { x: 0.3, z: 0.95 });
  assert.ok(!s.crash && s.speed >= TREE.slide - 1e-9);
  assert.ok(Math.sin(s.heading) > 0.9, "round on the side of the way on");
  // already going away: only kept out of the bark
  const a = treeHit({ x: 0, z: 1, heading: 0, speed: 5 }, tree);
  assert.equal(a.speed, 5); assert.equal(a.heading, 0); assert.equal(a.into, 0);
  // steering into the same trunk frame after frame never stops you
  let r = { ...at(10, 4), heading: 10 * D };
  for (let k = 0; k < 90; k++) { const h = treeHit(r, tree, { x: 0, z: 1 }); r = { x: h.x, z: h.z, heading: h.heading + 0.2, speed: h.speed }; }
  assert.ok(r.speed >= TREE.slide - 1e-9, `still moving ${r.speed}`);
});
