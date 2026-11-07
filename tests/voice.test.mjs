import { test } from "node:test";
import assert from "node:assert/strict";
import { VOICE, gainAt, sendTo, wantPeers, offerer, retryAfter, cleanSignal, cleanVoiceState, speaking, duckFor, micProblem } from "../src/ride/voice-core.js";

test("gainAt: clear up close and in the same chair, fading with distance, silent from 150 m", () => {
  assert.equal(gainAt(0), 1);
  assert.equal(gainAt(VOICE.FULL), 1);
  assert.equal(gainAt(VOICE.SILENT), 0);
  assert.equal(gainAt(400), 0);
  assert.equal(gainAt(140, { sameChair: true }), 1, "the same chair is always clear");
  let prev = 1;
  for (let d = 10; d < VOICE.SILENT; d += 10) { const g = gainAt(d); assert.ok(g < prev && g > 0, `falls off at ${d} m`); prev = g; }
  assert.ok(gainAt(33) > 0.25 && gainAt(33) < 0.5, "the next chair is still clear");
  assert.ok(gainAt(100) < 0.08, "100 m is a murmur");
  assert.equal(gainAt(null), 0, "not known where they are");
  assert.equal(gainAt(NaN), 0);
});

test("gainAt: the walkie-talkie reaches any distance; muting wins", () => {
  assert.equal(gainAt(5000, { radio: true }), VOICE.RADIO);
  assert.equal(gainAt(null, { radio: true }), VOICE.RADIO);
  assert.equal(gainAt(2, { muted: true }), 0);
  assert.equal(gainAt(2, { radio: true, muted: true }), 0);
});

test("sendTo: nothing with the mic off; near with it on; everyone on the walkie-talkie", () => {
  assert.equal(sendTo(5), false);
  assert.equal(sendTo(5, { mic: true }), true);
  assert.equal(sendTo(VOICE.SILENT + 5, { mic: true }), true, "a margin past silent");
  assert.equal(sendTo(VOICE.SILENT + VOICE.SEND_MARGIN, { mic: true }), false);
  assert.equal(sendTo(-1, { mic: true }), false, "unknown distance");
  assert.equal(sendTo(-1, { mic: true, sameChair: true }), true);
  assert.equal(sendTo(9000, { radio: true }), true);
});

test("wantPeers: friends live on the channel now, nearest first, at most 7", () => {
  const now = 100000;
  const list = [
    { id: "mB00000000", d: 50, at: now - 1000 },
    { id: "mC00000000", d: 10, at: now - 1000 },
    { id: "mD00000000", d: 5, at: now - 20000 }, // stale
    { id: "mE00000000", d: 1, at: now - 100, gone: now - 50 }, // said bye
    { id: "bad id", d: 1, at: now },
    { id: "mF00000000", d: null, at: now - 10 }, // where unknown: last
  ];
  assert.deepEqual(wantPeers(list, now), ["mC00000000", "mB00000000", "mF00000000"]);
  const many = Array.from({ length: 12 }, (_, i) => ({ id: `m${String(i).padStart(9, "0")}`, d: 100 - i, at: now }));
  const w = wantPeers(many, now);
  assert.equal(w.length, VOICE.PEERS);
  assert.equal(w[0], "m000000011");
  assert.deepEqual(wantPeers(null, now), []);
});

test("offerer: exactly one side offers; retries back off", () => {
  assert.equal(offerer("mA", "mB"), true);
  assert.equal(offerer("mB", "mA"), false);
  assert.ok(retryAfter(1) < retryAfter(2) && retryAfter(2) < retryAfter(5));
  assert.equal(retryAfter(50), retryAfter(5));
});

const SDP = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";
test("cleanSignal: only messages for me, with a real-looking description", () => {
  const me = "mMe0000000";
  const ok = cleanSignal({ id: "mFr0000000", to: me, k: "offer", n: "abc123", sdp: SDP, extra: "x" }, me);
  assert.deepEqual(ok, { id: "mFr0000000", to: me, k: "offer", n: "abc123", sdp: SDP });
  assert.equal(cleanSignal({ id: "mFr0000000", to: "mOther0000", k: "offer", n: "a", sdp: SDP }, me), null, "for someone else");
  assert.equal(cleanSignal({ id: me, to: me, k: "offer", n: "a", sdp: SDP }, me), null, "from myself");
  assert.equal(cleanSignal({ id: "mFr0000000", to: me, k: "hack", n: "a", sdp: SDP }, me), null);
  assert.equal(cleanSignal({ id: "mFr0000000", to: me, k: "answer", n: "a", sdp: "<script>" }, me), null);
  assert.equal(cleanSignal({ id: "mFr0000000", to: me, k: "answer", n: "a", sdp: "v=0\r\nm=video 9 x\r\n" }, me), null, "no audio line");
  assert.equal(cleanSignal({ id: "mFr0000000", to: me, k: "answer", n: "a", sdp: SDP + "a".repeat(20000) }, me), null, "too long");
  assert.equal(cleanSignal({ id: "mFr0000000", to: me, k: "offer", n: "a b", sdp: SDP }, me), null, "bad try id");
  assert.deepEqual(cleanSignal({ id: "mFr0000000", to: me, k: "bye", n: "x", sdp: 5 }, me), { id: "mFr0000000", to: me, k: "bye", n: "x" });
  assert.equal(cleanSignal(null, me), null);
  assert.equal(cleanSignal("offer", me), null);
});

test("cleanVoiceState: booleans only", () => {
  assert.deepEqual(cleanVoiceState({ id: "mFr0000000", mic: true, r: "yes", x: 1 }), { id: "mFr0000000", mic: true, r: false });
  assert.deepEqual(cleanVoiceState({ id: "mFr0000000", r: true }), { id: "mFr0000000", mic: false, r: true });
  assert.equal(cleanVoiceState({ id: "!" }), null);
  assert.equal(cleanVoiceState(undefined), null);
});

test("speaking: on at once, off only after a quiet moment", () => {
  let s = speaking(null, 0, 0);
  assert.equal(s.on, false);
  s = speaking(s, 0.05, 100); assert.equal(s.on, true);
  s = speaking(s, 0.0, 300); assert.equal(s.on, true, "a gap between words");
  s = speaking(s, 0.015, 500); assert.equal(s.on, true, "still some voice");
  s = speaking(s, 0.0, 800); assert.equal(s.on, true);
  s = speaking(s, 0.0, 1000); assert.equal(s.on, false);
});

test("duckFor: friends heard speaking duck the music; a far murmur doesn't", () => {
  assert.equal(duckFor([]), 0);
  assert.equal(duckFor([{ on: false, gain: 1 }]), 0);
  assert.equal(duckFor([{ on: true, gain: 0.05 }]), 0);
  const near = duckFor([{ on: true, gain: 1 }]), mid = duckFor([{ on: true, gain: 0.3 }]);
  assert.ok(near > mid && mid > 0 && near <= 0.75);
  assert.equal(duckFor([], true), near, "me on the walkie-talkie");
});

test("micProblem: getUserMedia's errors as hints", () => {
  assert.equal(micProblem({ name: "NotAllowedError" }), "denied");
  assert.equal(micProblem({ name: "NotFoundError" }), "none");
  assert.equal(micProblem({ name: "NotReadableError" }), "busy");
  assert.equal(micProblem({ name: "insecure" }), "insecure");
  assert.equal(micProblem(null), "other");
});
