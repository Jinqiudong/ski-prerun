import { test } from "node:test";
import assert from "node:assert/strict";
import { rideTrip, cleanState, cleanHi, cleanRider, changed, seatOrder, seatsOf, chairToJoin, chairSeats, freeSeat, seatToward, holdLeft, comingTo, HOLD, HOLD_MAX, whereOf, alongPts } from "../src/ride/together-core.js";

const trip = (o) => ({ id: "t-" + Math.random().toString(36).slice(2, 8), shared: true, from: "2026-11-05", to: "2026-11-08", srv: { members: [{ id: "mA" + "0".repeat(8) }] }, ...o });

test("rideTrip: a shared trip on today that I'm in, this resort's day first", () => {
  const me = "mA00000000";
  const a = trip({ id: "aaaaaa", days: { "2026-11-06": "winterpark" } }), b = trip({ id: "bbbbbb", days: { "2026-11-06": "copper" } });
  assert.equal(rideTrip([a, b], "2026-11-06", "copper", me), "bbbbbb");
  assert.equal(rideTrip([a], "2026-11-06", "copper", me), "aaaaaa");
  assert.equal(rideTrip([a], "2026-11-10", "copper", me), "aaaaaa", "not on today: still the trip, to practise together");
  const c = trip({ id: "cccccd", from: "2026-12-06", to: "2026-12-19" }), d = trip({ id: "dddddd", from: "2027-01-02", to: "2027-01-04" });
  assert.equal(rideTrip([d, a, c], "2026-11-10", "copper", me), "cccccd", "the next trip coming up");
  assert.equal(rideTrip([{ ...a, shared: false }], "2026-11-06", "copper", me), null, "kept on this phone only");
  assert.equal(rideTrip([a], "2026-11-06", "copper", "mZ00000000"), null, "not a member");
  assert.equal(rideTrip([], "2026-11-06", "copper", me, "cccccc"), "cccccc", "opened from that trip");
  assert.equal(rideTrip([], "2026-11-06", "copper", me, "bad id!"), null);
});

test("cleanState keeps only what a state may hold", () => {
  assert.equal(cleanState({ id: "mB12345678", ph: "fly" }), null);
  assert.equal(cleanState({ id: "x", ph: "ski", x: 1, z: 2 }), null);
  assert.deepEqual(cleanState({ id: "mB12345678", ph: "lift", l: "American Flyer", d: 12.5, v: 15, b: 1000, c: "mB12345678@1000", extra: 1 }),
    { id: "mB12345678", ph: "lift", l: "American Flyer", d: 12.5, v: 15, b: 1000, c: "mB12345678@1000" });
  const s = cleanState({ id: "mB12345678", ph: "ski", x: 10, z: "no", h: 1 });
  assert.equal(s, null);
  assert.equal(cleanState({ id: "mB12345678", ph: "ski", x: 10, z: 5, h: 1, sp: 99 }).sp, 60);
  const h = cleanHi({ id: "mB12345678", name: "阿北", avatar: "<script>", colors: { jacket: "#112233", pants: "red" } });
  assert.deepEqual([h.avatar, h.colors, h.rider], ["av_rider", { jacket: "#112233" }, null]);
});

test("cleanRider keeps a look's rider: a character, or a preset and colours", () => {
  const ch = { tpl: "M", height: 180, weight: 60, parts: { hood: 1, "<b>": true }, colors: { MAT_jacket: "#334455", MAT_pants: "url(x)", jacket: "#000000" }, board: "C", fav: "Anim_Ollie", evil: { a: 1 }, glossyHelmet: "yes" };
  assert.deepEqual(cleanRider({ ch }), { ch: { tpl: "M", height: 180, weight: 60, parts: { hood: true }, colors: { MAT_jacket: "#334455" }, board: "C" } });
  assert.equal(cleanRider({ ch: { tpl: "X" } }), null, "no such template");
  assert.deepEqual(cleanRider({ preset: "B" }), { preset: "B" });
  assert.deepEqual(cleanRider({ preset: "Z", colors: { jacket: "#aabbcc", boots: 3 } }), { colors: { jacket: "#aabbcc" } });
  assert.equal(cleanRider("A"), null);
  assert.deepEqual(cleanHi({ id: "mB12345678", rider: { preset: "D" } }).rider, { preset: "D" });
});

test("changed: moves and turns on the snow; a lift only once a second or on a jump", () => {
  const a = { ph: "ski", x: 0, z: 0, h: 0 };
  assert.equal(changed(a, { ...a }, 250), false);
  assert.equal(changed(a, { ...a, x: 1 }, 250), true);
  assert.equal(changed(a, { ...a }, 5000), true, "keep-alive");
  const l = { ph: "lift", l: "X", d: 100, v: 15, c: "c" };
  assert.equal(changed(l, { ...l, d: 103.75 }, 250), false, "where it was going anyway");
  assert.equal(changed(l, { ...l, d: 200 }, 250), true);
  assert.equal(changed(l, { ...l, d: 115 }, 1000), true);
});

test("seats: the first in the ride's seat, then beside them, then the other side", () => {
  assert.deepEqual(seatOrder(6), [1, 2, 0, 3, 4, 5]);
  assert.deepEqual(seatOrder(2), [1, 0]);
  const s = seatsOf([{ id: "b", b: 2 }, { id: "a", b: 1 }, { id: "c", b: 3 }], 2);
  assert.deepEqual([s.get("a"), s.get("b"), s.get("c")], [1, 0, -1]);
});

test("chairToJoin: the friend who boarded first, within 20 s or still holding the chair, owns it", () => {
  const me = { id: "mB", lift: "American Flyer", b: 30000 };
  const A = { id: "mA", ph: "lift", l: "American Flyer", d: 30, b: 26000, c: "mA@26000" };
  assert.equal(chairToJoin(me, [A])?.id, "mA");
  assert.equal(chairToJoin(me, [{ ...A, b: 3000, c: "mA@3000" }]), null, "too long ago");
  assert.equal(chairToJoin(me, [{ ...A, b: 3000, c: "mA@3000", hd: 1 }])?.id, "mA", "long ago, but their chair waits for me");
  assert.equal(chairToJoin(me, [{ ...A, b: 3000, c: "mA@3000" }], { want: "mA" })?.id, "mA", "asked to ride with them");
  assert.equal(chairToJoin(me, [{ ...A, b: 33000, hd: 1 }]), null, "holding, but they got on after me: they join mine");
  assert.equal(chairToJoin(me, [{ ...A, b: 32000 }]), null, "they boarded after me: they join mine");
  assert.equal(chairToJoin(me, [{ ...A, l: "Super Bee" }]), null);
  assert.equal(chairToJoin({ ...me, b: 26000 }, [A])?.id, "mA", "same moment: the smaller id owns it");
  assert.equal(chairToJoin({ id: "m0", lift: "American Flyer", b: 26000 }, [A]), null, "same moment, and mine is the smaller id");
  assert.equal(chairToJoin({ id: "mZ", lift: "American Flyer", b: 26000 }, [A])?.id, "mA");
  assert.equal(chairToJoin(me, [{ ...A, c: "mB@30000" }]), null, "already in mine");
});

test("cleanState and changed carry the seat and the hold", () => {
  const s = cleanState({ id: "mB12345678", ph: "lift", l: "X", d: 14, b: 1, c: "mB12345678@1", k: 2, kt: 5, hd: 1 });
  assert.deepEqual([s.k, s.kt, s.hd], [2, 5, 1]);
  const bad = cleanState({ id: "mB12345678", ph: "lift", l: "X", d: 14, k: 1.5, hd: true });
  assert.deepEqual([bad.k, bad.hd], [undefined, undefined]);
  const l = { ph: "lift", l: "X", d: 100, v: 15, c: "c", k: 1 };
  assert.equal(changed(l, { ...l, d: 103.75, k: 2 }, 250), true, "a seat switch goes out at once");
  assert.equal(changed(l, { ...l, d: 103.75, hd: 1 }, 250), true);
});

test("chairSeats: one rider a seat; the earlier claim keeps it, the later moves to the nearest free one", () => {
  const s = chairSeats([{ id: "a", k: 1, kt: 10 }, { id: "b", k: 2, kt: 20 }], 4);
  assert.deepEqual([s.get("a"), s.get("b")], [1, 2]);
  // the bug the owner saw: both said the same seat. Never both in it.
  const c = chairSeats([{ id: "b", k: 1, kt: 20 }, { id: "a", k: 1, kt: 10 }], 4);
  assert.deepEqual([c.get("a"), c.get("b")], [1, 0], "b to the nearest free seat (0 and 2 tie: the lower)");
  assert.deepEqual([...chairSeats([{ id: "b", k: 1, kt: 10 }, { id: "a", k: 1, kt: 10 }], 2)], [["a", 1], ["b", 0]], "same moment: the smaller id");
  // no claim (an older phone): the free seats in seatOrder
  const d = chairSeats([{ id: "a", k: 1, kt: 10 }, { id: "x" }, { id: "y" }], 4);
  assert.deepEqual([d.get("x"), d.get("y")], [2, 0]);
  // full: the last claim rides the chair behind
  const e = chairSeats([{ id: "a", k: 0, kt: 1 }, { id: "b", k: 1, kt: 2 }, { id: "c", k: 1, kt: 3 }], 2);
  assert.equal(e.get("c"), -1);
  assert.equal(chairSeats([{ id: "a", k: 7, kt: 1 }], 4).get("a"), 1, "a seat the chair doesn't have: as if they never said");
  // same inputs in any order, the same answer on every phone
  const m = [{ id: "a", k: 2, kt: 5 }, { id: "b", k: 2, kt: 6 }, { id: "c", k: 3, kt: 1 }, { id: "d" }];
  assert.deepEqual([...chairSeats(m, 6)].sort(), [...chairSeats([...m].reverse(), 6)].sort());
  assert.equal(new Set(chairSeats(m, 6).values()).size, 4);
});

test("seat switching: the next free seat each way, and the first free seat to get on", () => {
  const seats = new Map([["a", 1], ["b", 2]]);
  assert.equal(seatToward(seats, 4, 1, 1), 3, "past b");
  assert.equal(seatToward(seats, 4, 1, -1), 0);
  assert.equal(seatToward(seats, 4, 2, 1), 3);
  assert.equal(seatToward(new Map([["a", 0], ["b", 1]]), 2, 1, 1), -1, "a full two-seater: nowhere to go");
  assert.equal(freeSeat(seats, 4), 0);
  assert.equal(freeSeat(new Map([["a", 1]]), 6), 2, "next to the first");
  assert.equal(freeSeat(new Map([["a", 0], ["b", 1]]), 2), -1);
});

test("holdLeft and comingTo: the first at the lift waits for friends on their way, not for ever", () => {
  assert.equal(holdLeft(1000, 2000, []), 0, "nobody coming: go");
  assert.equal(holdLeft(1000, 2000, [{ loading: false }]), HOLD - 1000);
  assert.equal(holdLeft(1000, 2000, [{ loading: true }]), HOLD_MAX - 1000, "their page is still opening: longer");
  assert.equal(holdLeft(1000, 1000 + HOLD_MAX + 1, [{ loading: true }]), 0);
  const me = { id: "mA", lift: "American Flyer", resort: "copper", b: 5000, c: "mA@5000", d0: 14 };
  const P = (o) => ({ id: "mB", in: true, page: "ride", resort: "copper", lift: "American Flyer", ph: "lift", ...o });
  assert.deepEqual(comingTo(me, [P({})], []), [{ id: "mB", loading: true }], "opening this lift's ride");
  assert.deepEqual(comingTo(me, [P({ b: 7000, c: "mB@7000" })], []), [{ id: "mB", loading: true }], "on it after me, not in my chair yet");
  assert.deepEqual(comingTo(me, [P({ b: 3000, c: "mB@3000" })], []), [], "got on before me: I join them");
  assert.deepEqual(comingTo(me, [P({ b: 7000, c: "mA@5000" })], []), [], "in my chair");
  assert.deepEqual(comingTo(me, [P({ lift: "Super Bee" })], []), [], "another lift");
  assert.deepEqual(comingTo(me, [P({ lift: "Super Bee", ph: "ski", fol: "mA" })], []), [{ id: "mB", loading: true }], "following me: the party brings them");
  assert.deepEqual(comingTo(me, [P({ in: false })], []), [], "not in the party");
  const ski = { id: "mC", ph: "ski", x: 0, z: 0, w: "American Flyer" };
  assert.deepEqual(comingTo(me, [], [ski]), [{ id: "mC", loading: false }], "waiting at the bottom of this lift");
  assert.deepEqual(comingTo(me, [], [{ ...ski, w: "Super Bee" }]), []);
  const inMine = { id: "mB", ph: "lift", l: "American Flyer", d: 14, c: "mA@5000" };
  assert.deepEqual(comingTo(me, [P({})], [inMine]), [], "their ride says they sat down in my chair");
  assert.deepEqual(comingTo(me, [P({})], [{ ...inMine, c: "mB@9000", d: 60 }]), [], "already riding up in another chair");
});

test("whereOf and alongPts", () => {
  assert.deepEqual(whereOf({ ph: "lift", l: "Union Creek" }), ["{lift} 缆车上", { lift: "Union Creek" }]);
  assert.deepEqual(whereOf({ ph: "ski", run: "Soliloquy" }), ["在 {run}", { run: "Soliloquy" }]);
  const p = alongPts([[0, 0], [0, 10], [10, 10]], 15);
  assert.deepEqual([p.x, p.z], [5, 10]);
});
