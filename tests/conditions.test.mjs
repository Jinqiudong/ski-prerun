// The conditions record (src/core/conditions.js): live or a chosen hour and sky, per resort, shared by the
// resort page's weather bar and the ride's 雪况 pill.
import { test } from "node:test";
import assert from "node:assert/strict";
import { KEY, LIVE, SNOW_RECENT_CM, normalize, load, save, hourIn, dateAt, fmtHour, choose, effective, label } from "../src/core/conditions.js";
import { powderAmount } from "../src/ride/snow-core.js";

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
// 2026-11-07 12:00 in Denver (MST, UTC-7).
const NOON = new Date("2026-11-07T19:00:00Z");

test("anything odd is live", () => {
  for (const r of [null, undefined, 3, "x", {}, { live: true }, { live: false }, { live: false, hour: 12 }, { live: false, hour: "a", sky: "snow" }, { live: false, hour: 12, sky: "hail" }]) assert.equal(normalize(r), LIVE);
  assert.deepEqual(normalize({ live: false, hour: 17.1, sky: "snow", extra: 1 }), { live: false, hour: 17, sky: "snow" });
  assert.equal(normalize({ live: false, hour: 30, sky: "clear" }).hour, 23.75);
  assert.equal(normalize({ live: false, hour: -2, sky: "clear" }).hour, 0);
});

test("stored per resort; live removes the entry; bad JSON reads as live", () => {
  const s = mem();
  assert.equal(load(s, "copper"), LIVE);
  save(s, "copper", { live: false, hour: 17, sky: "snow" });
  save(s, "eldora", { live: false, hour: 9, sky: "clear" });
  assert.deepEqual(load(s, "copper"), { live: false, hour: 17, sky: "snow" });
  assert.equal(load(s, "abasin"), LIVE);
  save(s, "copper", LIVE);
  assert.equal(load(s, "copper"), LIVE);
  assert.deepEqual(Object.keys(JSON.parse(s.getItem(KEY))), ["eldora"]);
  s.setItem(KEY, "{nope"); assert.equal(load(s, "eldora"), LIVE);
  s.setItem(KEY, "[1]"); assert.equal(load(s, "eldora"), LIVE);
  assert.equal(load(null, "copper"), LIVE); // storage off
});

test("hours in Denver", () => {
  assert.equal(hourIn(NOON), 12);
  assert.equal(hourIn(new Date("2026-11-08T00:30:00Z")), 17.5);
  assert.equal(hourIn(dateAt(17, undefined, NOON)), 17);
  assert.equal(hourIn(dateAt(6.25, undefined, NOON)), 6.25);
  assert.equal(fmtHour(17), "17:00"); assert.equal(fmtHour(6.25), "06:15");
});

test("a change from live starts at now and the live sky; otherwise keeps the other half", () => {
  assert.deepEqual(choose(LIVE, { sky: "snow" }, { now: NOON, liveSky: "cloudy" }), { live: false, hour: 12, sky: "snow" });
  assert.deepEqual(choose(LIVE, { hour: 17 }, { now: NOON, liveSky: "cloudy" }), { live: false, hour: 17, sky: "cloudy" });
  assert.deepEqual(choose({ live: false, hour: 17, sky: "snow" }, { hour: 8 }), { live: false, hour: 8, sky: "snow" });
  assert.deepEqual(choose({ live: false, hour: 17, sky: "snow" }, { sky: "clear" }), { live: false, hour: 17, sky: "clear" });
});

test("what the ride uses: live passes the forecast through", () => {
  const e = effective(LIVE, { kind: "overcast", falling: false, recentCm: 4 }, { now: NOON });
  assert.equal(e.live, true); assert.equal(e.date, NOON); assert.equal(e.kind, "overcast"); assert.equal(e.falling, false); assert.equal(e.recentCm, 4);
  assert.deepEqual({ ...effective(LIVE, {}, { now: NOON }), date: 0 }, { live: true, date: 0, kind: "clear", falling: false, recentCm: null }); // offline
});

test("chosen snow: falling, and enough recent snow for powder", () => {
  const e = effective({ live: false, hour: 17, sky: "snow" }, { kind: "clear", falling: false, recentCm: 2 }, { now: NOON });
  assert.equal(hourIn(e.date), 17); assert.equal(e.kind, "snow"); assert.equal(e.falling, true);
  assert.equal(e.recentCm, SNOW_RECENT_CM);
  assert.ok(powderAmount(e.recentCm) > 0.7, "a chosen snow day is a powder day");
  assert.equal(effective({ live: false, hour: 9, sky: "snow" }, { recentCm: 40 }).recentCm, 40); // a bigger real storm stays
  assert.equal(effective({ live: false, hour: 9, sky: "snow" }, {}).recentCm, SNOW_RECENT_CM); // offline
});

test("chosen clear sky: no falling snow, the real snowpack kept", () => {
  const e = effective({ live: false, hour: 10, sky: "clear" }, { kind: "snow", falling: true, recentCm: 30 }, { now: NOON });
  assert.equal(e.kind, "clear"); assert.equal(e.falling, false); assert.equal(e.recentCm, 30);
});

test("the pill's words", () => {
  assert.equal(label(LIVE), "");
  assert.equal(label({ live: false, hour: 17, sky: "snow" }), "17:00 · 雪");
  assert.equal(label({ live: false, hour: 6.5, sky: "cloudy" }), "06:30 · 多云");
});
