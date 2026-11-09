import test from "node:test";
import assert from "node:assert/strict";
import { TRACK, SKI_TRACK, trackShape } from "../src/ride/track-core.js";

const DEG = Math.PI / 180;

test("a carved board leaves one line a few cm wide, not a band", () => {
  const c = trackShape({ slip: 3 * DEG });
  assert.ok(c.half * 2 <= 0.12, `carve ${c.half * 2} m wide`);
  near(c.ink, TRACK.ink, 0.02);
});

test("a skid smears it wide; side-on it is the board's length", () => {
  const c = trackShape({ slip: 0 }), s = trackShape({ slip: 60 * DEG }), side = trackShape({ slip: 90 * DEG });
  assert.ok(s.half > 3 * c.half);
  near(side.ink, TRACK.smear, 1e-9);
  near(side.half, TRACK.board, 1e-9);
  assert.equal(trackShape({ slip: -60 * DEG }).half, s.half); // either way across
});

test("powder digs a wider, darker trench", () => {
  const g = trackShape({}), p = trackShape({ soft: 1 });
  assert.ok(p.half > g.half + 0.15);
  assert.ok(p.ink > g.ink);
});

test("skis: two thin lines, each thinner than a board's", () => {
  const k = trackShape({ ski: true });
  assert.equal(k.half, SKI_TRACK.width);
  assert.ok(k.half < trackShape({}).half);
  assert.ok(SKI_TRACK.gap > 2 * k.half); // apart, not one strip
  assert.equal(trackShape({ ski: true, slip: 50 * DEG }).half, k.half); // a skidded turn: still two thin lines
  assert.ok(trackShape({ ski: true, slip: 88 * DEG, hockey: 1 }).half > 0.4); // a hockey stop scrapes them wide
});

function near(a, b, e) { assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`); }
