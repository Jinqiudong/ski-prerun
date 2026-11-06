// node --test tests/season.test.mjs — ski days by season, for the memory tab's photos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seasonOf, seasonName, seasonShort, buildSeasons, riderOf, dressGroup, lineUp, photoKey, canon } from "../src/start/season.js";

const me = { id: "mMe", name: "我", avatar: "av_rider", rider: { preset: "B" } };
const valid = (id) => ["copper", "steamboat"].includes(id);
const shared = {
  id: "t1", name: "感恩节", from: "2026-11-19", to: "2026-11-21", days: { "2026-11-19": "steamboat", "2026-11-20": "copper" },
  people: [], srv: { members: [{ id: "mA", name: "阿北", look: { avatar: "av_fox", rider: "C" } }, { id: "mMe", name: "Q", look: {} }, { id: "mB", name: "小雪", look: { avatar: "nope" } }] },
};

test("seasons run November to April, named by their first year", () => {
  assert.equal(seasonOf("2026-11-19"), 2026);
  assert.equal(seasonOf("2027-03-02"), 2026);
  assert.equal(seasonOf("2027-08-01"), 2027);
  assert.equal(seasonName(2026), "2026/27");
  assert.equal(seasonShort(2025), "25/26");
});

test("a shared trip's past days become photos with its members", () => {
  const [S] = buildSeasons({ trips: [shared], valid, me, today: "2026-12-01" });
  assert.equal(S.season, 2026);
  assert.deepEqual(S.days.map((d) => d.date), ["2026-11-21", "2026-11-20", "2026-11-19"], "newest first");
  const [d3, d2, d1] = S.days;
  assert.equal(d1.held, null); assert.equal(d1.holder, -1);
  assert.deepEqual(d2.held, { resort: "steamboat" }); assert.ok(d2.holder >= 0);
  assert.equal(d3.resort, null, "no mountain picked that day"); assert.deepEqual(d3.held, { resort: "copper" });
  assert.equal(d1.people.length, 3);
  assert.equal(d1.people.filter((p) => p.me).length, 1);
  assert.deepEqual(d1.people.find((p) => p.me).rider, { preset: "B" }, "my rider is mine, not the server's");
  assert.deepEqual(d1.people.find((p) => p.key === "mA").rider, { preset: "C" });
  assert.equal(d1.people.find((p) => p.key === "mB").avatar, "av_marmot", "an unknown avatar goes round the animals, as on the trip page");
  assert.deepEqual(S.stats, { trips: 1, days: 3, mountains: 2, runs: 0 });
  assert.deepEqual(S.friends.map((p) => p.name), ["阿北", "小雪"]);
});

test("future days aren't memories yet", () => {
  const [S] = buildSeasons({ trips: [shared], valid, me, today: "2026-11-19" });
  assert.equal(S.days.length, 1);
});

test("pre-runs join the trip's day at that mountain, or stand on their own", () => {
  const at = (d, h) => new Date(`${d}T${h}:00`).getTime();
  const book = {
    copper: [{ t0: at("2026-11-20", "20:00"), steps: [{ k: "route", segs: [{ n: "Andy's Encore" }, { n: "Bouncer" }] }] }],
    steamboat: [{ t0: at("2026-03-01", "10:00"), steps: [{ k: "route", segs: [{ n: "Heavenly Daze" }] }] }, { t0: 1, steps: [] }],
    nowhere: [{ t0: at("2026-11-20", "10:00"), steps: [{ k: "lift" }] }],
  };
  const out = buildSeasons({ trips: [shared], book, valid, me, today: "2026-12-01" });
  assert.deepEqual(out.map((s) => s.season), [2026, 2025]);
  const d2 = out[0].days.find((d) => d.date === "2026-11-20");
  assert.deepEqual(d2.runs, ["Andy's Encore", "Bouncer"]); assert.ok(d2.prerun);
  assert.equal(out[0].stats.runs, 2);
  const [solo] = out[1].days;
  assert.equal(solo.trip, null); assert.equal(solo.people.length, 1); assert.ok(solo.people[0].me);
  assert.deepEqual(out[1].stats, { trips: 0, days: 1, mountains: 1, runs: 1 });
});

test("a local trip's people are names; I'm there even if not listed", () => {
  const [S] = buildSeasons({ trips: [{ id: "l", name: "x", from: "2026-12-05", to: "2026-12-05", days: {}, people: ["阿北", { name: "小雪" }] }], valid, me, today: "2026-12-10" });
  assert.equal(S.days[0].people.length, 3);
  assert.ok(S.days[0].people.some((p) => p.me));
});

test("riders: from a look, else a preset per person, no two the same in one photo", () => {
  assert.deepEqual(riderOf({ rider: "D" }), { preset: "D" });
  assert.equal(riderOf({ rider: "Z" }), null);
  assert.deepEqual(riderOf({ rider: { ch: { tpl: "F", height: 160 } } }), { ch: { tpl: "F", height: 160 } });
  assert.equal(riderOf({ avatar: "av_fox" }), null);
  const g = dressGroup([{ key: "a", rider: { preset: "A" } }, { key: "b" }, { key: "c" }, { key: "d" }]);
  assert.deepEqual(new Set(g.map((p) => p.rider.preset)).size, 4);
  assert.deepEqual(dressGroup([{ key: "b" }])[0].rider, dressGroup([{ key: "b" }])[0].rider, "the same person, the same rider");
});

test("line-up: me in the middle, the holder next to the middle", () => {
  const ppl = ["a", "b", "c"].map((key) => ({ key })).concat([{ key: "me", me: true }]);
  const { row, holder } = lineUp(ppl);
  assert.deepEqual(row.map((p) => p.key), ["a", "b", "me", "c"]);
  assert.equal(holder, 1);
  assert.equal(lineUp([{ key: "me", me: true }]).holder, 0);
});

test("a photo's key changes with its people's looks, not with key order", () => {
  const d = { date: "2026-11-20", resort: "copper", held: { resort: "steamboat" }, holder: 1, people: [{ key: "me", rider: { preset: "A", colors: { jacket: "#000000", pants: "#111111" } } }] };
  const same = { ...d, people: [{ key: "me", rider: { colors: { pants: "#111111", jacket: "#000000" }, preset: "A" } }] };
  assert.equal(photoKey(d), photoKey(same));
  assert.notEqual(photoKey(d), photoKey({ ...d, people: [{ key: "me", rider: { preset: "B" } }] }));
  assert.equal(canon({ b: 1, a: [2, { d: 1, c: 0 }] }), '{"a":[2,{"c":0,"d":1}],"b":1}');
});
