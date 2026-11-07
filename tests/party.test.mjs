import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPresence, cleanInvite, cleanPing, cleanCall, cleanOk, liveMembers, resolveFollow, teamLead, followMove, findWay, callAt, callLeft, callChair, callSeats, spotFor, SPOTS, statusOf, petOf, GREY, STALE, COUNTDOWN } from "../src/core/party-core.js";
import { seatsOf } from "../src/ride/together-core.js";

const A = "mA00000000", B = "mB00000000", C = "mC00000000", D = "mD00000000";
const P = (id, o = {}) => ({ id, name: id.slice(0, 2), av: "av_fox", in: true, page: "home", tab: "rider", since: 1, fol: null, ...o });
const heardOf = (list, now) => new Map(list.map((m) => [m.id, { ...cleanPresence(m), at: m.at ?? now, gone: m.gone || 0 }]));

test("cleanPresence: only what a presence may hold, nothing about where for someone not in the party", () => {
  assert.equal(cleanPresence({ id: "x" }), null);
  assert.equal(cleanPresence(null), null);
  assert.deepEqual(cleanPresence({ id: A, name: "阿北", av: "<img>", in: false, page: "ride", resort: "copper", lift: "Super Bee" }), { id: A, name: "阿北", av: "av_rider", in: false });
  const r = cleanPresence({ id: A, in: true, page: "ride", resort: "copper", rn: "Copper", ph: "lift", lift: "Super Bee", b: 1000, c: `${A}@1000`, fol: A, mic: "yes", e: [1, "x"], extra: 1 });
  assert.deepEqual(r, { id: A, name: "", av: "av_rider", in: true, page: "ride", resort: "copper", rn: "Copper", ph: "lift", lift: "Super Bee", run: null, c: `${A}@1000`, b: 1000, fol: null, mic: false, since: 0 });
  assert.equal(cleanPresence({ id: A, in: true, page: "ride", resort: "../etc" }).page, "home", "a bad resort: not at a resort");
  assert.equal(cleanPresence({ id: A, in: true, page: "moon" }).page, "home");
  assert.equal(cleanPresence({ id: A, in: true, page: "home", tab: "x" }).tab, "rider");
  assert.equal(cleanPresence({ id: A, in: true, name: "x".repeat(99) }).name.length, 20);
  assert.deepEqual(cleanPresence({ id: A, in: true, page: "ride", resort: "copper", ph: "ski", e: [10, 20], en: "Super Bee" }).e, [10, 20]);
});

test("cleaning invites, pings, calls", () => {
  assert.deepEqual(cleanInvite({ id: A, to: [B, "bad id!", C] }, B), { id: A, to: [B, C] });
  assert.equal(cleanInvite({ id: A, to: [C] }, B), null, "not for me");
  assert.equal(cleanInvite({ id: A, to: B }, B), null);
  assert.equal(cleanInvite({ id: B, to: [B] }, B), null, "from myself");
  assert.deepEqual(cleanPing({ id: A, to: B }, B), { id: A, to: B });
  assert.equal(cleanPing({ id: A, to: C }, B), null);
  assert.equal(cleanCall({ id: A, k: "abcd1234", lift: "Super Bee", resort: "copper", at: 5 }).rn, "copper");
  assert.equal(cleanCall({ id: A, k: "a", lift: "Super Bee", resort: "copper", at: 5 }), null);
  assert.equal(cleanCall({ id: A, k: "abcd1234", lift: "", resort: "copper", at: 5 }), null);
  assert.equal(cleanCall({ id: A, k: "abcd1234", lift: "X", resort: "Copper!", at: 5 }), null);
  assert.equal(cleanCall({ id: A, k: "abcd1234", lift: "X", resort: "copper", at: "soon" }), null);
  assert.deepEqual(cleanOk({ id: A, k: "abcd1234", extra: 1 }), { id: A, k: "abcd1234" });
});

test("liveMembers: live, then grey, then gone; a bye is gone at once; only the party unless all", () => {
  const now = 100000;
  const h = heardOf([P(A, { at: now - 1000 }), P(B, { at: now - GREY - 1 }), P(C, { at: now - STALE - 1 }), P(D, { gone: now })], now);
  h.set("mE00000000", { ...cleanPresence({ id: "mE00000000", in: false }), at: now, gone: 0 });
  assert.deepEqual(liveMembers(h, now).map((m) => [m.id, m.state]), [[A, "live"], [B, "grey"]]);
  assert.equal(liveMembers(h, now, { all: true }).length, 3);
});

test("resolveFollow: whom I really follow, through someone who left, never round in a circle", () => {
  const now = 100000;
  let h = heardOf([P(B, { fol: C }), P(C)], now);
  assert.equal(resolveFollow(h, A, B, now), B);
  h = heardOf([P(B, { fol: C, at: now - STALE - 1 }), P(C)], now);
  assert.equal(resolveFollow(h, A, B, now), C, "B closed the app: I keep going with whom B followed");
  h = heardOf([P(B, { fol: A })], now);
  assert.equal(resolveFollow(h, A, B, now), null, "two following each other stay put");
  h = heardOf([P(B, { fol: C }), P(C, { fol: A })], now);
  assert.equal(resolveFollow(h, A, B, now), null, "a longer circle too");
  assert.equal(resolveFollow(h, A, null, now), null);
  assert.equal(resolveFollow(heardOf([P(B, { in: false })], now), A, B, now), null, "left the party");
});

test("teamLead: the one most follow, else the first to join; never one following me", () => {
  const now = 100000;
  let h = heardOf([P(B, { since: 5 }), P(C, { since: 9, fol: D }), P(D, { since: 7 })], now);
  assert.equal(teamLead(h, A, now), D);
  h = heardOf([P(B, { since: 5 }), P(C, { since: 3 })], now);
  assert.equal(teamLead(h, A, now), C);
  h = heardOf([P(B, { since: 1, fol: A })], now);
  assert.equal(teamLead(h, A, now), null);
  assert.equal(teamLead(new Map(), A, now), null);
});

test("followMove: their lift, their route, their resort page carry me along, once each", () => {
  const home = { page: "home", in: true };
  const t = cleanPresence({ id: B, in: true, page: "ride", resort: "copper", ph: "lift", lift: "Super Bee", b: 5000, c: `${B}@5000` });
  const m = followMove(t, home);
  assert.deepEqual([m.act, m.lift, m.resort], ["lift", "Super Bee", "copper"]);
  assert.equal(followMove(t, home, m.key), null, "already went along");
  assert.equal(followMove(t, { page: "ride", resort: "copper", ph: "lift", lift: "Super Bee", c: `${B}@5000` }), null, "in their chair");
  assert.equal(followMove(t, { page: "ride", resort: "copper", ph: "lift", lift: "Super Bee", b: 9000, c: `${A}@9000` }), null, "a chair or two behind");
  assert.equal(followMove(t, { page: "ride", resort: "copper", ph: "ski" }).act, "lift", "skiing: onto their lift");
  const r = cleanPresence({ id: B, in: true, page: "ride", resort: "copper", ph: "ski", lift: "Super Bee", e: [100, 200], en: "Rendezvous" });
  assert.equal(followMove(r, { page: "ride", resort: "copper", ph: "pick" }).act, "route", "at the top: land beside them");
  assert.equal(followMove(r, { page: "ride", resort: "copper", ph: "ski" }), null, "skiing: the ride follows them itself");
  assert.equal(followMove(r, { page: "ride", resort: "copper", ph: "lift" }), null, "on a lift: not yanked off it");
  assert.equal(followMove(r, home).act, "route");
  const rs = cleanPresence({ id: B, in: true, page: "resort", resort: "copper" });
  assert.equal(followMove(rs, home).act, "resort");
  assert.equal(followMove(rs, { page: "ride", resort: "winterpark", ph: "ski" }), null, "riding: not pulled out to a resort page");
  assert.equal(followMove(rs, { page: "resort", resort: "copper" }), null);
  assert.equal(followMove(cleanPresence({ id: B, in: true, page: "home" }), home), null);
  assert.equal(followMove(null, home), null);
});

test("findWay: where 去找他 takes me", () => {
  assert.equal(findWay(cleanPresence({ id: B, in: true, page: "home" })), null);
  assert.deepEqual(findWay(cleanPresence({ id: B, in: true, page: "resort", resort: "copper" })), { go: "resort", resort: "copper" });
  assert.deepEqual(findWay(cleanPresence({ id: B, in: true, page: "ride", resort: "copper", ph: "lift", lift: "Super Bee" })), { go: "ride", resort: "copper", lift: "Super Bee", chair: true });
  assert.equal(findWay(cleanPresence({ id: B, in: true, page: "ride", resort: "copper", ph: "ski", lift: "Super Bee" })).chair, false);
});

test("一起坐: the countdown, the shared chair, seats the same on every phone", () => {
  const now = 1_000_000, call = { id: B, k: "k1234567", at: callAt(now) };
  assert.equal(call.at - now, COUNTDOWN + 500);
  assert.equal(callLeft(call, now, now).frac, 1);
  assert.equal(callLeft(call, now, now + 2000).left, COUNTDOWN + 500 - 2000);
  assert.equal(callLeft(call, now, call.at + 10).left, 0);
  const skew = callLeft({ ...call, at: now + 60000 }, now, now); // their clock a minute ahead: run on mine
  assert.equal(skew.end, now + COUNTDOWN);
  assert.equal(callChair(call), `${B}@${call.at}`);
  const s1 = callSeats([C, B, A], 4), s2 = callSeats([A, C, B, A], 4);
  assert.deepEqual([...s1], [...s2], "every phone the same, whatever order it heard the yeses in");
  assert.deepEqual([s1.get(A), s1.get(B), s1.get(C)], [1, 2, 0]);
  assert.equal(new Set(s1.values()).size, 3, "no two in one seat");
  const s3 = callSeats([A, B, C, D], 2);
  assert.deepEqual([s3.get(C), s3.get(D)], [-1, -1], "who doesn't fit rides the chair behind");
  // the ride seats them the same way (together-core's seatsOf, everyone boarding at `at`)
  const viaRide = seatsOf([C, B, A].map((id) => ({ id, b: call.at })), 4);
  assert.deepEqual([...viaRide].sort(), [...s1].sort());
});

test("spotFor: a spot on every page, on an edge, on the screen", () => {
  for (const [k, s] of Object.entries(SPOTS)) {
    assert.ok(["left", "right", "top"].includes(s.edge), k);
    if (s.edge === "top") assert.ok(s.x > 0.1 && s.x < 0.9, k); else assert.ok(s.y > 0.1 && s.y < 0.95, k);
  }
  assert.equal(spotFor("home", "rider").edge, "left");
  assert.equal(spotFor("resort", "base"), SPOTS.resort);
  assert.equal(spotFor("ride", "lift").edge, "top");
  assert.equal(spotFor("ride", "nonsense"), SPOTS["ride:ski"]);
  assert.equal(spotFor("moon", "x"), SPOTS["home:rider"]);
});

test("statusOf and petOf", () => {
  assert.deepEqual(statusOf(cleanPresence({ id: B, in: true, page: "home", tab: "rider" })), ["还在主页 · {what}", { what: "选衣服" }]);
  assert.deepEqual(statusOf(cleanPresence({ id: B, in: true, page: "ride", resort: "copper", rn: "Copper", ph: "lift", lift: "Super Bee" })), ["{rn} · 坐 {lift} 上山中", { rn: "Copper", lift: "Super Bee" }]);
  assert.equal(statusOf(cleanPresence({ id: B, in: true, page: "resort", resort: "copper", ph: "base" }))[0], "{rn} · 在山脚选缆车");
  assert.equal(petOf("av_fox"), "", "the capybara for everyone for now");
});
