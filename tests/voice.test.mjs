import { test } from "node:test";
import assert from "node:assert/strict";
import { VOICE, wantPeers, offerer, retryAfter, cleanSignal, cleanVoicePresence, speaking, talking, duckFor, micProblem, MIC_SPOTS, micSpot } from "../src/core/voice-core.js";
import { SPOTS, spotFor } from "../src/core/party-core.js";
import "../src/core/frame.js";

const { appSrc, appHash, toShell } = globalThis.prerunShell;

test("wantPeers: members heard from lately, not gone, by id, at most PEERS", () => {
  const now = 100000;
  const list = [
    { id: "mC00000000", at: now - 1000 },
    { id: "mB00000000", at: now - 1000 },
    { id: "mD00000000", at: now - 20000 }, // stale
    { id: "mE00000000", at: now - 100, gone: now - 50 }, // said bye
    { id: "bad id", at: now },
  ];
  assert.deepEqual(wantPeers(list, now), ["mB00000000", "mC00000000"]);
  const many = Array.from({ length: 12 }, (_, i) => ({ id: `m${String(11 - i).padStart(9, "0")}`, at: now }));
  const w = wantPeers(many, now);
  assert.equal(w.length, VOICE.PEERS);
  assert.equal(w[0], "m000000000", "the same order on every phone");
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

test("cleanVoicePresence: an id, a short name, a known avatar, booleans", () => {
  assert.deepEqual(cleanVoicePresence({ id: "mFr0000000", name: "小雪", av: "av_fox", mic: true, ask: "yes", x: 1 }), { id: "mFr0000000", name: "小雪", av: "av_fox", mic: true, ask: false });
  assert.deepEqual(cleanVoicePresence({ id: "mFr0000000", name: "x".repeat(40), av: "../evil" }), { id: "mFr0000000", name: "x".repeat(20), av: "av_rider", mic: false, ask: false });
  assert.equal(cleanVoicePresence({ id: "!" }), null);
  assert.equal(cleanVoicePresence(undefined), null);
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

test("talking: the radio goes up at once and stays up through a pause", () => {
  let s = talking(null, false, 0);
  assert.equal(s.on, false);
  s = talking(s, true, 100); assert.equal(s.on, true);
  s = talking(s, false, 100 + VOICE.TALK_HOLD - 10); assert.equal(s.on, true, "a breath between sentences");
  s = talking(s, true, 2000); s = talking(s, false, 2000 + VOICE.TALK_HOLD + 10); assert.equal(s.on, false, "down after the hold");
});

test("duckFor: a friend speaking ducks the music; a muted one, or nobody, doesn't", () => {
  assert.equal(duckFor([]), 0);
  assert.equal(duckFor(null), 0);
  assert.equal(duckFor([{ on: false }]), 0);
  assert.equal(duckFor([{ on: true, muted: true }]), 0);
  assert.ok(duckFor([{ on: false }, { on: true }]) > 0.3);
});

test("micProblem: getUserMedia's errors as hints", () => {
  assert.equal(micProblem({ name: "NotAllowedError" }), "denied");
  assert.equal(micProblem({ name: "NotFoundError" }), "none");
  assert.equal(micProblem({ name: "NotReadableError" }), "busy");
  assert.equal(micProblem({ name: "insecure" }), "insecure");
  assert.equal(micProblem(null), "other");
});

test("micSpot: every page the pet knows has a spot for the 对讲机, clear of the pet", () => {
  for (const key of Object.keys(SPOTS)) {
    const [page, sub = ""] = key.split(":"), m = micSpot(page, sub), p = spotFor(page, sub);
    assert.ok(m.edge === "left" || m.edge === "right", key);
    assert.ok(m.y > 0.05 && m.y < 0.95, key);
    if (p.edge === m.edge) assert.ok(Math.abs(p.y - m.y) > 0.15, `${key}: clear of the pet`);
  }
  assert.deepEqual(micSpot("ride", "nowhere"), MIC_SPOTS["ride:ski"]);
  assert.deepEqual(micSpot("resort", "base"), MIC_SPOTS.resort);
});

test("shell addresses: a page's address after #, only the app's own pages", () => {
  const root = "https://x.github.io/ski-prerun/";
  assert.equal(appHash(`${root}look.html?resort=copper&lift=American%20Flyer`, root), "#look.html?resort=copper&lift=American%20Flyer");
  assert.equal(appHash(`${root}mountain/?resort=copper`, root), "#mountain/?resort=copper");
  assert.equal(appHash(`${root}start.html`, root), "#start.html");
  assert.equal(appHash(`${root}index.html`, root), null, "not the shell itself");
  assert.equal(appHash("https://evil.example/start.html", root), null);
  assert.equal(appSrc("#look.html?resort=copper&lift=X", ""), "look.html?resort=copper&lift=X");
  assert.equal(appSrc("#mountain/?resort=copper", ""), "mountain/?resort=copper");
  assert.equal(appSrc("#sound.html", ""), "sound.html");
  assert.equal(appSrc("", "?trip=abc"), "start.html?trip=abc", "the old index.html?trip=… link");
  assert.equal(appSrc("", ""), "start.html");
  for (const bad of ["#javascript:alert(1)", "#//evil.example/x", "#https://evil.example/", "#../start.html", "#start.html.evil", "#tools/check.mjs"]) assert.equal(appSrc(bad, ""), "start.html", bad);
  for (const p of ["start.html?tab=trip", "look.html?resort=copper&lift=A&at=1", "mountain/?resort=copper", "sound.html"]) assert.equal(appSrc(appHash(root + p, root), ""), p, "a round trip");
});

test("toShell: a page on its own moves into the shell; not inside it, not in tests, not with ?shell=0", () => {
  // toShell reads the window it was loaded in (g); here a copy of it runs against a fake one.
  const page = (href, { top = true, webdriver = false } = {}) => {
    const g = { location: { href, search: new URL(href).search, replace(u) { g.went = u; } }, navigator: { webdriver }, went: null };
    g.top = top ? g : {};
    return g;
  };
  const make = (g) => new Function("g", "appHash", `return (${toShell.toString()});`)(g, appHash);
  const script = { src: "https://x.github.io/ski-prerun/src/core/frame.js?v=1" };
  let g = page("https://x.github.io/ski-prerun/look.html?resort=copper&lift=A");
  assert.equal(make(g)(script), true); assert.equal(g.went, "https://x.github.io/ski-prerun/#look.html?resort=copper&lift=A");
  g = page("https://x.github.io/ski-prerun/mountain/?resort=copper");
  make(g)(script); assert.equal(g.went, "https://x.github.io/ski-prerun/#mountain/?resort=copper");
  g = page("https://x.github.io/ski-prerun/start.html", { top: false });
  assert.equal(make(g)(script), false, "in the shell already"); assert.equal(g.went, null);
  g = page("https://x.github.io/ski-prerun/start.html?shell=0");
  assert.equal(make(g)(script), false);
  g = page("https://x.github.io/ski-prerun/start.html", { webdriver: true });
  assert.equal(make(g)(script), false, "not in the headless tests");
  g = page("https://x.github.io/ski-prerun/start.html?shell=force", { webdriver: true });
  assert.equal(make(g)(script), true);
});
