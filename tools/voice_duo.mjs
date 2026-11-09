// The 对讲机 end to end, in the shell: two headless Chrome browsers in the same party on a random trip id (never
// created in the database: Realtime broadcast needs no row), with a fake mic. A turns the 对讲机 on and walks
// the app: the welcome page (with its opening) → the resort page → the ride (lift ticket, chair) → the lift's
// top → back → back → back; at each step it logs both sides' connection, the call's try id (one call from start
// to end), A's mic track and the bytes B receives. Screenshots (390x844 at DPR 2) go to the folder given.
// usage: serve the repo (BASE, default http://127.0.0.1:8857), then  node tools/voice_duo.mjs <folder>
//   (needs puppeteer-core where node can find it, and Chrome in /Applications)
import puppeteer from "puppeteer-core";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE || "http://127.0.0.1:8857", SHOTS = process.argv[2] || "shots";
mkdirSync(SHOTS, { recursive: true });
const trip = randomUUID(), today = new Date().toISOString().slice(0, 10);
const ID = { A: "mA00000000000000000000001", B: "mB00000000000000000000002" };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [], log = (...a) => console.log(...a), browsers = [];
async function open(name, who, avatar) {
  const br = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", protocolTimeout: 600000,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
  browsers.push(br);
  const p = (await br.pages())[0] || await br.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: false });
  p.on("pageerror", (e) => { errs.push(`${name}: ${e.message}`); log(`  [${name} pageerror] ${e.message}`); });
  p.on("console", (m) => { const t = m.text(); if (m.type() === "error" && !/404|favicon|Failed to load resource|ERR_/.test(t)) { errs.push(`${name}: ${t.slice(0, 160)}`); log(`  [${name} console] ${t.slice(0, 200)}`); } });
  await p.evaluateOnNewDocument((n, a, me, other, trip, today) => {
    if (localStorage.getItem("prerunMember") === me) return;
    localStorage.setItem("prerunLang", "zh"); localStorage.setItem("prerunName", n); localStorage.setItem("prerunAvatar", a); localStorage.setItem("prerunMember", me);
    localStorage.setItem("prerun", JSON.stringify({ rider: "A" }));
    localStorage.setItem("prerunTrips", JSON.stringify([{ id: trip, shared: true, name: "语音测试", from: today, to: today, passes: ["ikon"], days: {}, people: [{ id: me, name: n, me: true }, { id: other, name: "朋友" }] }]));
    localStorage.setItem("prerunParty", JSON.stringify({ trip, in: true, since: Date.now() }));
  }, name, avatar, ID[who], ID[who === "A" ? "B" : "A"], trip, today);
  return p;
}
const frameUrl = (p) => p.evaluate(() => { try { return document.getElementById("app").contentWindow.location.href.replace(location.origin, ""); } catch { return "?"; } });
// The state on one side: its peer (the other), its mic track.
const side = (p, other) => p.evaluate(async (other) => {
  const V = window.__voice, P = V.peers.get(other), st = (await V.stats())[other] || {};
  const tr = V.stream?.getAudioTracks()[0];
  return { pc: P?.pc?.connectionState || null, ice: P?.pc?.iceConnectionState || null, call: P?.n || null, pcId: P?.pc ? (P.pc.__id ||= Math.random().toString(36).slice(2, 7)) : null,
    track: tr ? { readyState: tr.readyState, enabled: tr.enabled, muted: tr.muted } : null, micOn: V.micOn, sending: st.sending, bytesIn: st.bytesIn, bytesOut: st.bytesOut, level: st.level, ctx: V.context?.state || null };
}, other);
const rows = [];
async function step(label) {
  const a1 = await side(A, ID.B), b1 = await side(B, ID.A);
  await wait(1200);
  const a2 = await side(A, ID.B), b2 = await side(B, ID.A);
  const r = { step: label, A_page: await frameUrl(A), A_pc: a2.pc, A_call: a2.call, A_pcId: a2.pcId, A_track: a2.track ? `${a2.track.readyState}${a2.track.enabled ? "" : " disabled"}${a2.track.muted ? " muted" : ""}` : "none", A_sending: a2.sending, A_out_Bps: a2.bytesOut - a1.bytesOut, B_pc: b2.pc, B_in_Bps: b2.bytesIn - b1.bytesIn, B_level: b2.level, A_ctx: a2.ctx, B_ctx: b2.ctx, shell_hash: await A.evaluate(() => location.hash.slice(0, 50)) };
  rows.push(r); log(JSON.stringify(r));
  return r;
}
const frameReady = (p, test, timeout = 240000) => p.waitForFunction((test) => { try { const w = document.getElementById("app").contentWindow; return w.document.readyState === "complete" && w.eval(test); } catch { return false; } }, { timeout, polling: 500 }, test);
const go = async (p, url, test) => { await p.evaluate((u) => { document.getElementById("app").contentWindow.location.href = u; }, url); await wait(800); await frameReady(p, test); };
const back = async (p, test) => { await p.evaluate(() => document.getElementById("app").contentWindow.history.back()); await wait(800); await frameReady(p, test); };

const A = await open("阿北", "A", "av_fox"), B = await open("小雪", "B", "av_hare");
await A.goto(`${BASE}/#start.html?tab=rider&intro=force`); await B.goto(`${BASE}/#start.html?tab=rider`);
await frameReady(A, "!!window.__party"); await frameReady(B, "!!window.__party");
log("both on the welcome page; trip", trip);
await Promise.all([A.waitForFunction((id) => window.__voice.peers.get(id)?.live, { timeout: 60000, polling: 250 }, ID.B), B.waitForFunction((id) => window.__voice.peers.get(id)?.live, { timeout: 60000, polling: 250 }, ID.A)]);
log("connected");
await wait(1500);
await A.screenshot({ path: `${SHOTS}/1-welcome-toggle-off.png` });
await step("welcome, 对讲机 off");
await A.click("#vcMic"); // a real click in the shell: the gesture
await A.waitForFunction(() => window.__voice.micLive, { timeout: 10000 });
await wait(2500);
await A.screenshot({ path: `${SHOTS}/2-welcome-toggle-on.png` });
await step("welcome, 对讲机 on");
// the start page's own navigation: to the resort page (the flight transition plays only on a real tap; forced here)
await go(A, "mountain/?resort=copper&transition=force", "!!window.__party");
await step("resort page (mountain/)");
await wait(4000); await step("resort page +4 s");
await A.screenshot({ path: `${SHOTS}/3-resort-toggle-on.png` });
await go(A, "look.html?resort=copper&lift=American%20Flyer&transition=force", "!!window.__look && !!window.__party");
await step("ride: lift ticket + chair (transition)");
await wait(5000); await step("ride: on the lift");
await A.screenshot({ path: `${SHOTS}/4-ride-toggle-on.png` });
await B.screenshot({ path: `${SHOTS}/4b-friend-B-hears-A.png` });
// the lift's top (the ride reloads itself at ?at=1 when you get there)
await go(A, "look.html?resort=copper&lift=American%20Flyer&at=1&transition=force", "!!window.__look && !!window.__party");
await wait(3000); await step("ride: at the top");
await back(A, "!!window.__look"); await step("back: the lift");
await back(A, "!!window.__party"); await step("back: resort page");
await back(A, "!!window.__party"); await step("back: welcome page");
// off again
await A.click("#vcMic"); await wait(1500);
const off = await step("welcome, 对讲机 off again");
await A.screenshot({ path: `${SHOTS}/5-welcome-toggle-off-again.png` });
console.table(rows.map((r) => ({ step: r.step, A_pc: r.A_pc, call: r.A_call, pcId: r.A_pcId, track: r.A_track, A_out: r.A_out_Bps, B_pc: r.B_pc, B_in: r.B_in_Bps, B_level: r.B_level, A_ctx: r.A_ctx })));
const on = rows.filter((r) => r.step !== "welcome, 对讲机 off" && r.step !== "welcome, 对讲机 off again");
log("same call throughout:", new Set(rows.map((r) => r.A_call)).size === 1, "same RTCPeerConnection:", new Set(rows.map((r) => r.A_pcId)).size === 1);
log("connected at every step:", rows.every((r) => r.A_pc === "connected" && r.B_pc === "connected"));
log("track live at every step with the 对讲机 on:", on.every((r) => r.A_track.startsWith("live")), "| B receiving at every step:", on.every((r) => r.B_in_Bps > 1000));
log("off again: track", off.A_track, "A sending", off.A_sending);
log("errors:", errs.length ? errs : "none");
for (const br of browsers) await br.close();
