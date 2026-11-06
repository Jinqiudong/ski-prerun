import { test } from "node:test";
import assert from "node:assert/strict";
import { rideTrip, cleanState, cleanHi, changed, seatOrder, seatsOf, chairToJoin, whereOf, alongPts } from "../src/ride/together-core.js";

const trip = (o) => ({ id: "t-" + Math.random().toString(36).slice(2, 8), shared: true, from: "2026-11-05", to: "2026-11-08", srv: { members: [{ id: "mA" + "0".repeat(8) }] }, ...o });

test("rideTrip: a shared trip on today that I'm in, this resort's day first", () => {
  const me = "mA00000000";
  const a = trip({ id: "aaaaaa", days: { "2026-11-06": "winterpark" } }), b = trip({ id: "bbbbbb", days: { "2026-11-06": "copper" } });
  assert.equal(rideTrip([a, b], "2026-11-06", "copper", me), "bbbbbb");
  assert.equal(rideTrip([a], "2026-11-06", "copper", me), "aaaaaa");
  assert.equal(rideTrip([a], "2026-11-10", "copper", me), null, "not on today");
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
  assert.deepEqual([h.avatar, h.colors], ["av_rider", { jacket: "#112233" }]);
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

test("chairToJoin: the friend who boarded first, within 6 s, owns the chair", () => {
  const me = { id: "mB", lift: "American Flyer", b: 10000 };
  const A = { id: "mA", ph: "lift", l: "American Flyer", d: 30, b: 6000, c: "mA@6000" };
  assert.equal(chairToJoin(me, [A])?.id, "mA");
  assert.equal(chairToJoin(me, [{ ...A, b: 3000, c: "mA@3000" }]), null, "too long ago");
  assert.equal(chairToJoin(me, [{ ...A, b: 3000, c: "mA@3000" }], { want: "mA" })?.id, "mA", "asked to ride with them");
  assert.equal(chairToJoin(me, [{ ...A, b: 12000 }]), null, "they boarded after me: they join mine");
  assert.equal(chairToJoin(me, [{ ...A, l: "Super Bee" }]), null);
  assert.equal(chairToJoin({ ...me, b: 6000 }, [A])?.id, "mA", "same moment: the smaller id owns it");
  assert.equal(chairToJoin({ id: "m0", lift: "American Flyer", b: 6000 }, [A]), null, "same moment, and mine is the smaller id");
  assert.equal(chairToJoin({ id: "mZ", lift: "American Flyer", b: 6000 }, [A])?.id, "mA");
  assert.equal(chairToJoin(me, [{ ...A, c: "mB@10000" }]), null, "already in mine");
});

test("whereOf and alongPts", () => {
  assert.deepEqual(whereOf({ ph: "lift", l: "Union Creek" }), ["{lift} 缆车上", { lift: "Union Creek" }]);
  assert.deepEqual(whereOf({ ph: "ski", run: "Soliloquy" }), ["在 {run}", { run: "Soliloquy" }]);
  const p = alongPts([[0, 0], [0, 10], [10, 10]], 15);
  assert.deepEqual([p.x, p.z], [5, 10]);
});
