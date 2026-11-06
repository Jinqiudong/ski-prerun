// node --test tests/trip-intro.test.mjs — which trip the opening is about, and where its planes are.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickTrip, progress, resortsOf, resortOn, crewOf, spread, bearing } from "../src/start/trip-intro.js";

const T = (id, from, to, more = {}) => ({ id, name: id, from, to, people: [], ...more });

test("an ongoing trip comes first, then the soonest coming up, then one just ended", () => {
  const list = [T("past", "2026-10-20", "2026-11-02"), T("later", "2026-12-20", "2026-12-24"), T("soon", "2026-11-25", "2026-11-28")];
  assert.deepEqual(pickTrip(list, "2026-11-05"), { trip: list[2], phase: "soon", left: 20 });
  assert.equal(pickTrip([...list, T("now", "2026-11-04", "2026-11-07")], "2026-11-05").phase, "during");
  assert.equal(pickTrip([...list, T("now", "2026-11-04", "2026-11-07")], "2026-11-05").day, 2);
  assert.equal(pickTrip([...list, T("go", "2026-11-05", "2026-11-07")], "2026-11-05").phase, "travel");
  assert.deepEqual(pickTrip([list[0]], "2026-11-05"), { trip: list[0], phase: "after", ago: 3 });
  assert.equal(pickTrip([T("old", "2026-10-01", "2026-10-20")], "2026-11-05"), null, "over a week ago: the general opening");
  assert.equal(pickTrip([], "2026-11-05"), null);
  assert.equal(pickTrip([{ name: "broken", from: "soon" }], "2026-11-05"), null);
});

test("a plane sits at home a month out and on the tarmac the day before", () => {
  assert.equal(progress(60), 0);
  assert.equal(progress(30), 0);
  assert.equal(progress(1), 1);
  assert.ok(progress(20) > 0.3 && progress(20) < 0.4);
  assert.ok(progress(10) > progress(20));
});

test("the planned mountains: each day's in order, else the maybes", () => {
  const tr = T("x", "2026-11-05", "2026-11-07", { days: { "2026-11-06": "winterpark", "2026-11-05": "copper", "2026-11-07": "copper" }, maybe: ["steamboat"] });
  assert.deepEqual(resortsOf(tr), ["copper", "winterpark"]);
  assert.deepEqual(resortsOf({ ...tr, days: {} }), ["steamboat"]);
  assert.equal(resortOn(tr, "2026-11-06"), "winterpark");
  assert.equal(resortOn({ ...tr, days: [] }, "2026-11-06"), null);
});

test("faces follow trips.js: mine, then each member's pick, else round the animals", () => {
  const shared = { shared: true, people: [{ name: "阿北", from: "SEA", avatar: "av_fox" }, { name: "我", from: "JFK", me: true }, { name: "小雪", from: "dca" }],
    srv: { members: [{ travel: { note: "UA 123 早班" } }, {}, {}] } };
  const c = crewOf(shared, { mine: "av_girl" });
  assert.deepEqual(c.map((p) => p.face), ["av_fox", "av_girl", "av_hare"]);
  assert.equal(c[0].note, "UA 123 早班");
  assert.equal(c[2].from, "", "an airport code must be three capitals");
  const local = { people: ["我", { name: "Ann", from: "SFO" }, { name: "Bo", from: "" }] };
  assert.deepEqual(crewOf(local, { mine: "av_rider" }).map((p) => p.face), ["av_rider", "av_fox", "av_hare"]);
});

test("routes are pushed apart and Asia lies west", () => {
  const DEN = [39.86, -104.67], a = spread([bearing([40.64, -73.78], DEN), bearing([38.85, -77.04], DEN), bearing([47.45, -122.31], DEN)]);
  assert.ok(Math.abs(a[0] - a[1]) >= 0.5, "New York and Washington get their own lines");
  assert.ok(a[2] > Math.PI / 2, "Seattle is up and to the left");
  assert.ok(Math.cos(bearing([31.14, 121.81], DEN)) < 0, "Shanghai comes in from the west");
});
