// node --test tests/shared-trip.test.mjs — the pure parts of shared trips (no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { toLocal, toData, ownerOf, canEdit, pendingDays, pendingSections, isMember, ago, UUID } from "../src/start/shared-trip.js";

const server = {
  id: "a81d4b06-4289-4beb-a457-597bdf4a1ea7", created_by: "mA", owners: { plan: "mB" }, version: 3,
  data: { name: "测试", from: "2026-11-06", to: "2026-11-08", passes: ["ikon"], maybe: ["copper", "steamboat"], days: { "2026-11-06": "copper", "2026-11-07": "copper" } },
  members: [{ id: "mA", name: "阿北", from: "SEA", look: { avatar: "av_fox" } }, { id: "mB", name: "小雪", from: "jfk" }],
  proposals: [{ id: "p1", by: "mA", section: "plan", patch: { days: { "2026-11-06": "copper", "2026-11-07": "winterpark" } }, summary: "周六 Copper → Winter Park" }],
  events: [],
};

test("a server trip becomes the page's trip", () => {
  const tr = toLocal(server, "mB");
  assert.equal(tr.shared, true);
  assert.deepEqual(tr.maybe, ["copper", "steamboat"]);
  assert.equal(tr.people[1].me, true);
  assert.equal(tr.people[1].from, "", "an airport code must be three capitals");
  assert.ok(isMember(tr, "mA") && !isMember(tr, "mC"));
  assert.deepEqual(Object.keys(toData(tr)).sort(), ["days", "from", "gear", "maybe", "name", "passes", "stay", "to"]);
});

test("owners: a section's owner, else the maker; gear is everyone's", () => {
  const tr = toLocal(server, "mA");
  assert.equal(ownerOf(tr.srv, "plan"), "mB");
  assert.equal(ownerOf(tr.srv, "stay"), "mA");
  assert.ok(canEdit(tr.srv, "gear", "mZ"));
  assert.ok(!canEdit(tr.srv, "plan", "mA"));
});

test("an open proposal stamps only the days it changes", () => {
  const tr = toLocal(server, "mA"), p = pendingDays(tr);
  assert.deepEqual(Object.keys(p), ["2026-11-07"]);
  assert.ok(pendingSections(tr).has("plan"));
});

test("ago and ids", () => {
  const now = Date.parse("2026-11-05T12:00:00Z");
  assert.deepEqual(ago("2026-11-05T11:59:50Z", now), ["刚刚", "just now"]);
  assert.deepEqual(ago("2026-11-05T11:50:00Z", now), ["10 分钟前", "10 min ago"]);
  assert.ok(UUID.test(server.id) && !UUID.test("eyJuYW1lIjoi"));
});
