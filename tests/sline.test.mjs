// The S on the snow (src/ride/sline-core.js): the line to ride, drawn and steered by from the same numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { S_SHAPE, S_STEEP, S_MAX, sPlan, sAt, alongPath, isNarrow, indexNear } from "../src/ride/sline-core.js";

// A plan as ride.js makePlan makes one: a path, distances along it, heights, runs, flats.
function plan({ len = 800, step = 5, grade = 0.25, level = "intermediate", name = "Main Vein", flats = [], bend = null, detour = null } = {}) {
  const path = [], hs = [], dist = [];
  let x = 0, z = 0, h = 0;
  for (let s = 0; s <= len; s += step) {
    if (bend && s > bend.at && s <= bend.at + bend.len) h += (bend.angle * step) / bend.len;
    path.push([x, z]); hs.push(-s * grade); dist.push(s);
    x += Math.sin(h) * step; z += Math.cos(h) * step;
  }
  const idx = (m) => Math.round(m / step);
  return { path, dist, hs, segs: [{ at: 0, run: { name, level } }], flats: flats.map(([a, b, kind = "flat"]) => ({ a: idx(a), b: idx(b), kind })), ...(detour ? { detour: { a: idx(detour[0]), b: idx(detour[1]) } } : {}) };
}
const offs = (P, q, from, to, every = 1) => { const o = {}, out = []; for (let s = from; s <= to; s += every) out.push(sAt(q, s, o).off); return out; };
const peak = (a) => Math.max(...a.map(Math.abs));

test("shapes: real linked turns, 20–40 m a turn, never wider than the ride allows", () => {
  for (const [lv, s] of Object.entries(S_SHAPE)) {
    assert.ok(s.turn >= 20 && s.turn + S_STEEP.turn <= 40, lv);
    assert.ok(s.amp > 2 && s.amp + S_STEEP.amp <= S_MAX && S_MAX < 11, lv);
  }
  assert.ok(S_SHAPE.easy.amp < S_SHAPE.intermediate.amp && S_SHAPE.intermediate.amp < S_SHAPE.expert.amp);
});

test("on an open pitch it weaves left and right of the line, one crossing per turn, as wide as the shape", () => {
  const P = plan({ grade: 0.2 }), q = sPlan(P), o = offs(P, q, 150, 600);
  assert.ok(o.some((v) => v > 3.5) && o.some((v) => v < -3.5), "both sides");
  let cross = 0; for (let i = 1; i < o.length; i++) if (Math.sign(o[i]) !== Math.sign(o[i - 1]) && o[i] !== 0) cross++;
  const turn = (450 / cross);
  assert.ok(turn > S_SHAPE.intermediate.turn - 2 && turn < S_SHAPE.intermediate.turn + S_STEEP.turn + 2, `a turn every ${turn} m`);
  assert.ok(peak(o) <= S_SHAPE.intermediate.amp + S_STEEP.amp + 1e-6);
});

test("narrower and shorter on a green, wider and longer on steep snow", () => {
  const easy = peak(offs(null, sPlan(plan({ grade: 0.2, level: "easy" })), 150, 600));
  const blue = peak(offs(null, sPlan(plan({ grade: 0.2 })), 150, 600));
  const steep = peak(offs(null, sPlan(plan({ grade: 0.4 })), 150, 600));
  assert.ok(easy < blue && blue < steep, `${easy} ${blue} ${steep}`);
});

test("straight where there's no room to turn: flats and rises, gentle snow, cat-tracks, the trees, the ends", () => {
  const P = plan({ flats: [[300, 420], [600, 640, "up"]], detour: [460, 540] }), q = sPlan(P);
  assert.equal(peak(offs(P, q, 300, 420)), 0, "flat");
  assert.equal(peak(offs(P, q, 600, 640)), 0, "rise");
  assert.equal(peak(offs(P, q, 460, 540)), 0, "a line through the trees");
  assert.equal(peak(offs(P, q, 0, 10)), 0, "the start");
  assert.equal(peak(offs(P, q, 765, 800)), 0, "the end");
  assert.ok(peak(offs(P, q, 150, 280)) > 3, "and weaving between");
  assert.equal(peak(offs(null, sPlan(plan({ grade: 0.05 })), 0, 800)), 0, "gentle");
  for (const n of ["Skid Road", "West Village Traverse", "Loverly Lane", "Slot Car Track", "CDL's Trail #20"]) {
    assert.ok(isNarrow({ name: n }), n);
    assert.equal(peak(offs(null, sPlan(plan({ name: n })), 0, 800)), 0, n);
  }
  for (const n of ["Main Vein", "Bittersweet", "Sail Away Glade", "Broadway", ""]) assert.ok(!isNarrow({ name: n }), n);
});

test("straight through a junction turn and a sharp bend; it follows a gentle one", () => {
  const P = plan(), q = sPlan(P, { junctions: [400] });
  assert.equal(peak(offs(P, q, 385, 415)), 0);
  const sharp = plan({ bend: { at: 400, len: 30, angle: Math.PI / 2 } }), qs = sPlan(sharp);
  assert.equal(peak(offs(sharp, qs, 400, 430)), 0, "a 90° turn in 30 m");
  const soft = plan({ bend: { at: 300, len: 200, angle: Math.PI / 4 } }), qg = sPlan(soft), o = {};
  assert.ok(peak(offs(soft, qg, 320, 480)) > 3, "weaves round a long gentle bend");
  // the S's line through the bend: always within its width of the route's line
  for (let s = 300; s < 500; s += 3) { sAt(qg, s, o); const x = o.cx + o.rx * o.off, z = o.cz + o.rz * o.off, i = indexNear(soft.dist, s); assert.ok(Math.hypot(x - soft.path[i][0], z - soft.path[i][1]) < S_MAX + 6); }
});

test("never a step: the width grows and dies away gently, the line is smooth", () => {
  const P = plan({ flats: [[300, 420]] }), q = sPlan(P);
  for (let i = 1; i < q.amp.length; i++) assert.ok(Math.abs(q.amp[i] - q.amp[i - 1]) <= 0.2 * (P.dist[i] - P.dist[i - 1]) + 1e-6);
  const o = offs(P, q, 0, 800, 0.5);
  for (let i = 1; i < o.length; i++) assert.ok(Math.abs(o[i] - o[i - 1]) < 0.6, `jump at ${i / 2} m`);
});

test("sAt: the rider's right across the line, a unit vector; alongPath finds where you are", () => {
  const P = plan({ bend: { at: 200, len: 100, angle: 0.6 } }), q = sPlan(P), o = {};
  for (let s = 0; s < 800; s += 7) { sAt(q, s, o); assert.ok(Math.abs(Math.hypot(o.rx, o.rz) - 1) < 1e-9); assert.ok(Math.abs(o.rx * o.hx + o.rz * o.hz) < 1e-9); }
  sAt(q, 100, o); assert.ok(o.rx < -0.99, "heading +z, the right is −x"); // the ride's convention: (−cos h, sin h)
  const i = indexNear(P.dist, 333), s = alongPath(P, P.path[i][0] + 1, P.path[i][1] + 2, i);
  assert.ok(Math.abs(s - P.dist[i] - 2) < 1.5, `${s}`);
  assert.equal(sAt(q, 1e9, o).s, 800); // past the end: the end
});
