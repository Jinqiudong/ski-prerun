// The lift's rope over the ground (src/ride/lift-core.js): no carrier through the snow on a knoll or the
// brow before a top station, the stations' level stretch untouched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ropeY, marginAt, worstClearance, clearRope, ROPE_SAG, NEAR_MARGIN, LINE_MARGIN, NO_TOWER } from "../src/ride/lift-core.js";

const DROP = 3.33; // a gondola cabin's floor under the rope
// A line as ride.js liftLine makes one: stations at both ends (rope 4.25 m over the deck, level for 20 m),
// towers every 85 m, 11.5 m rope.
function line(total, ground) {
  const towers = [{ s: 0, y: ground(0), h: 4.25 }, { s: 20, y: ground(0), h: 4.25, station: true }];
  for (let s = 85; s < total - 40; s += 85) towers.push({ s, y: ground(s) });
  towers.push({ s: total - 20, y: ground(total), h: 4.25, station: true }, { s: total, y: ground(total), h: 4.25 });
  return towers;
}
// The ground with the stations' graded pads (facilities.js gradePad): level 30 m out from each end at the
// deck's mean height (the deck and its margin), blending into the slope over 32 m.
const padded = (f, total) => (s) => {
  const blend = (a, b, u) => a + (b - a) * Math.min(1, Math.max(0, u));
  if (s < total / 2) return blend(f(15), f(s), (s - 30) / 32);
  return blend(f(total - 15), f(s), (total - 30 - s) / 32);
};
const slope = (s) => s * 0.15; // a steady 8.5° (steeper, the rope coming up the slope into a top station wants a short tower too)

test("the rope: straight from tower head to tower head, sagging between towers, level through a station", () => {
  const t = [{ s: 0, y: 0, h: 4 }, { s: 20, y: 0, h: 4, station: true }, { s: 120, y: 30, h: 11.5 }, { s: 220, y: 60 }];
  assert.equal(ropeY(t, 10), 4);
  assert.equal(ropeY(t, 70), 15 + 4 + 7.5 * 0.5); // station span: no sag
  assert.equal(ropeY(t, 170), 45 + 11.5 - 100 * ROPE_SAG); // mid-span sag
});

test("the margin: small at a station's mouth, the full margin out on the line", () => {
  assert.equal(marginAt(20, 1000), NEAR_MARGIN);
  assert.equal(marginAt(500, 1000), LINE_MARGIN);
  assert.ok(marginAt(40, 1000) > NEAR_MARGIN && marginAt(40, 1000) < LINE_MARGIN);
});

test("a steady slope needs no new tower", () => {
  const g = padded(slope, 1000), t = line(1000, g), r = clearRope(t, 1000, g, DROP);
  assert.equal(r.short, 0);
  assert.equal(r.towers.length, t.length);
  assert.ok(!r.towers.some((x) => x.added || x.raised));
});

test("a brow before the top station: the cabin went under the snow; a short tower on it keeps it clear", () => {
  // The slope flattens into a hump 45 m before the top (Wild Blue Gondola I at Steamboat).
  const total = 1355, brow = (s) => slope(s) + 9 * Math.exp(-(((s - (total - 45)) / 18) ** 2));
  const ground = padded(brow, total);
  const t = line(total, ground);
  assert.ok(worstClearance(t, total, ground, DROP).short > 2, "the straight rope drags the cabin through the brow");
  const r = clearRope(t, total, ground, DROP);
  assert.equal(r.short, 0);
  assert.ok(worstClearance(r.towers, total, ground, DROP).short <= 0);
  const added = r.towers.filter((x) => x.added);
  assert.equal(added.length, 1);
  assert.ok(added[0].s >= NO_TOWER && added[0].s <= total - NO_TOWER, "never inside a station");
  assert.ok(added[0].h <= 11.5 && added[0].h > DROP, "a short tower, no taller than the line's");
  // The stations' level stretch is untouched: the cabin comes in at the deck's height.
  assert.equal(ropeY(r.towers, total - 10), ropeY(t, total - 10));
  assert.equal(ropeY(r.towers, 10), ropeY(t, 10));
});

test("a knoll mid-line gets a tower; the towers stay in order", () => {
  const total = 2600, knoll = (s) => slope(s) + 12 * Math.exp(-(((s - 1250) / 25) ** 2));
  const ground = padded(knoll, total), r = clearRope(line(total, ground), total, ground, DROP);
  assert.equal(r.short, 0);
  assert.ok(r.towers.some((x) => x.added && Math.abs(x.s - 1250) < 30));
  for (let i = 1; i < r.towers.length; i++) assert.ok(r.towers[i].s > r.towers[i - 1].s);
});

test("a bump just inside a station's mouth, where no tower may stand: a tower at the station's edge", () => {
  const total = 800, bump = (s) => slope(s) + 4 * Math.exp(-(((s - (total - 32)) / 6) ** 2));
  const ground = padded(bump, total);
  const t = line(total, ground);
  assert.ok(worstClearance(t, total, ground, DROP).short > 0);
  const r = clearRope(t, total, ground, DROP);
  assert.equal(r.short, 0);
  assert.ok(r.towers.some((x) => x.added && x.s === total - NO_TOWER));
  assert.ok(!r.towers.some((x) => x.added && x.s > total - NO_TOWER));
  assert.ok(r.towers.every((x) => (x.h ?? 11.5) <= 11.5), "no giant tower");
});

test("with a tower already at the station's edge, that tower is raised instead", () => {
  const total = 800, bump = (s) => slope(s) + 4 * Math.exp(-(((s - (total - 32)) / 6) ** 2));
  const ground = padded(bump, total), t = line(total, ground);
  t.splice(t.length - 2, 0, { s: total - 50, y: ground(total - 50), h: 6 });
  const r = clearRope(t, total, ground, DROP);
  assert.equal(r.short, 0);
  assert.ok(r.towers.some((x) => x.raised && x.s === total - 50));
  assert.ok(!r.towers.some((x) => x.added));
});
