// Voice end to end: two headless Chrome browsers ride the same lift on a random trip id (never created in
// the database: Realtime broadcast needs no row), with a fake mic. Proves the peers connect, audio flows
// (getStats), gain by distance, the same chair, the walkie-talkie's filter and pose on the other screen, mute,
// the page hidden and back, and teardown when one leaves. Screenshots (390x844 at DPR 2) go to the folder given.
// usage: serve the repo on 127.0.0.1:8834, then  node tools/voice_duo.mjs docs/art/voice
//   (needs puppeteer-core where node can find it, and Chrome in /Applications)
import puppeteer from "puppeteer-core";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
const BASE = "http://127.0.0.1:8834", SHOTS = process.argv[2] || "shots";
mkdirSync(SHOTS, { recursive: true });
const trip = randomUUID();
const launch = () => puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", protocolTimeout: 600000,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const browsers = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
const log = (...a) => console.log(...a);
async function open(name, avatar) {
  const br = await launch(); browsers.push(br);
  const p = (await br.pages())[0] || await br.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: false });
  p.on("pageerror", (e) => { errs.push(`${name}: ${e.message}`); log(`  [${name} pageerror] ${e.message}`); });
  p.on("console", (m) => { const t = m.text(); if (m.type() === "error" && !/404|favicon|Failed to load resource/.test(t)) { errs.push(`${name}: ${t.slice(0, 160)}`); log(`  [${name} console] ${t.slice(0, 200)}`); } if (/voice|mic/.test(t) && m.type() === "warning") log(`  [${name} warn] ${t.slice(0, 160)}`); });
  await p.evaluateOnNewDocument((n, a) => { localStorage.setItem("prerunLang", "zh"); localStorage.setItem("prerunName", n); localStorage.setItem("prerunAvatar", a); }, name, avatar);
  await p.goto(`${BASE}/look.html?resort=copper&lift=American%20Flyer&trip=${trip}&at=0.3&still=1`);
  await p.waitForFunction(() => window.__tg && window.__look && !document.getElementById("status"), { timeout: 240000, polling: 500 }).catch(async (e) => { console.log(name, "not loaded", await p.evaluate(() => document.getElementById("status")?.textContent)); throw e; });
  return p;
}
const A = await open("阿北", "av_fox");
log("A loaded");
const B = await open("小雪", "av_hare");
log("B loaded, trip", trip);
const ids = { A: await A.evaluate(() => window.__tg.me), B: await B.evaluate(() => window.__tg.me) };
log("ids", ids, "offerer", ids.A < ids.B ? "A" : "B");
const stats = (p) => p.evaluate(() => window.__voice.stats());
const one = async (p, id) => (await stats(p))[id];
// 1. connect
await Promise.all([A.waitForFunction((id) => window.__voice.peers.get(id)?.live, { timeout: 60000, polling: 250 }, ids.B), B.waitForFunction((id) => window.__voice.peers.get(id)?.live, { timeout: 60000, polling: 250 }, ids.A)]);
log("1 connected:", JSON.stringify(await one(A, ids.B)), "|", JSON.stringify(await one(B, ids.A)));
// near each other: B 20 m up the line from A
const dA = await A.evaluate(() => window.__look.d);
await B.evaluate((d) => { window.__look.d = d; }, dA - 33); // one chair behind A: A's tag ahead on B's screen
await wait(1500);
await A.screenshot({ path: `${SHOTS}/1-mic-off.png` });
const before = await one(B, ids.A);
await wait(1500);
const before2 = await one(B, ids.A);
log("2 mic off: B gets from A", before.bytesIn, "→", before2.bytesIn, "A sending", (await one(A, ids.B)).sending);
// 2. mic on (a real click: the gesture)
await A.click("#vcMic");
await A.waitForFunction(() => window.__voice.micOn, { timeout: 10000 });
await wait(2500);
const s1 = await one(B, ids.A); await wait(2000); const s2 = await one(B, ids.A);
log("3 mic on: B inbound bytes", s1.bytesIn, "→", s2.bytesIn, "rising", s2.bytesIn > s1.bytesIn, "level", s2.level, "speaking", s2.speaking, "gain", s2.gain, "A out", (await one(A, ids.B)).bytesOut);
await A.screenshot({ path: `${SHOTS}/2-mic-on.png` });
await B.waitForFunction((id) => window.__voice.stateOf(id).speaking, { timeout: 10000, polling: 100 }, ids.A).catch(() => log("  (B never saw A speaking)"));
log("  ducked on B", await B.evaluate(() => window.__voice.ducked), "tag", await B.evaluate(() => document.querySelector(".tgTag")?.className));
await B.screenshot({ path: `${SHOTS}/3-friend-speaking.png` });
// 3. proximity: move B along the line away from A
const rows = [];
for (const off of [0, 10, 33, 66, 100, 140, 200]) {
  await B.evaluate((d) => { window.__look.d = d; }, dA + off);
  await wait(900);
  const dist = await B.evaluate((id) => { const f = window.__tg.friends.get(id); const v = new (f.pos.constructor)(); window.__look.rider.getWorldPosition(v); return +f.pos.distanceTo(v).toFixed(1); }, ids.A);
  const s = await one(B, ids.A), a = await one(A, ids.B);
  rows.push({ off, dist, gainB: s.gain, nearGainB: s.nearGain, Asending: a.sending });
}
log("4 proximity:"); console.table(rows);
// same chair: B flies to A ("去找他") and sits in A's chair
await B.evaluate((id) => window.__tg.goFind(id), ids.A); await wait(4500);
const sc = await one(B, ids.A);
log("  same chair: B in A's chair", await B.evaluate((id) => window.__tg.chairId.startsWith(id), ids.A), "inMine", await B.evaluate((id) => window.__tg.friends.get(id).inMine, ids.A), "gain", sc.gain, "nearGain", sc.nearGain);
await B.screenshot({ path: `${SHOTS}/3b-same-chair.png` });
// 4. walkie-talkie: far away (200 m) first, then near for the pose
await B.evaluate((d) => { window.__look.d = d; }, dA + 200); await wait(3000);
const box = await A.$eval("#vcTalk", (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
log('  under the finger on A:', await A.evaluate((b) => document.elementFromPoint(b.x, b.y)?.id, box));
await A.mouse.move(box.x, box.y); await A.mouse.down();
await wait(1500);
const r1 = await one(B, ids.A);
log("5 walkie held, 200 m: B radio", r1.radio, "gain", r1.gain, "farGain", r1.farGain, "nearGain", r1.nearGain, "A sending", (await one(A, ids.B)).sending, "A talking", await A.evaluate(() => window.__look.rider.userData.talking));
await B.evaluate((d) => { window.__look.d = d; }, dA - 33); await wait(2500);
const pose = await B.evaluate((id) => { const f = window.__tg.friends.get(id), u = f.model?.userData; return u ? { talking: u.talking, radio: +u.s.radio.toFixed(2), prop: u.C?.prop?.userData?.kind || null, visible: f.model.visible } : null; }, ids.A);
const r2 = await one(B, ids.A);
log("  near (one chair behind): B radio", r2.radio, "farGain", r2.farGain, "nearGain", r2.nearGain, "A's rider on B's screen", JSON.stringify(pose), "tag", await B.evaluate(() => document.querySelector(".tgTag")?.textContent));
await A.screenshot({ path: `${SHOTS}/4-walkie-pressed.png` });
await B.screenshot({ path: `${SHOTS}/5-friend-on-walkie.png` });
await A.mouse.up(); await wait(1500);
const r3 = await one(B, ids.A);
const pose2 = await B.evaluate((id) => { const u = window.__tg.friends.get(id).model?.userData; return u ? { talking: u.talking, radio: +u.s.radio.toFixed(2), prop: u.C?.prop?.userData?.kind || null } : null; }, ids.A);
log("  released: B radio", r3.radio, "farGain", r3.farGain, "nearGain", r3.nearGain, "pose", JSON.stringify(pose2));
// 5. mute from the card
await B.evaluate(() => document.querySelector(".tgTag").click()); await wait(300);
await B.evaluate(() => document.querySelector("#tgPop [data-k=mute]").click()); await wait(800);
log("6 muted: B gain", (await one(B, ids.A)).gain, "tag", await B.evaluate(() => document.querySelector(".tgTag").className));
await B.evaluate(() => document.querySelector(".tgTag").click()); await wait(300);
await B.evaluate(() => document.querySelector("#tgPop [data-k=mute]").click()); await wait(800);
log("  unmuted: B gain", (await one(B, ids.A)).gain);
// 6. page hidden on A (iOS backgrounding): hung up, then back
await A.evaluate(() => window.__voice.hide()); await wait(2500);
log("7 A hidden: A peers", await A.evaluate(() => window.__voice.peers.size), "note", await A.evaluate(() => document.getElementById("vcNote").textContent), "| B peer", JSON.stringify(await one(B, ids.A)));
await A.screenshot({ path: `${SHOTS}/6-away.png` });
await A.evaluate(() => window.__voice.show());
await Promise.all([A.waitForFunction((id) => window.__voice.peers.get(id)?.live, { timeout: 60000, polling: 250 }, ids.B), B.waitForFunction((id) => window.__voice.peers.get(id)?.live, { timeout: 60000, polling: 250 }, ids.A)]).then(() => log("  back: reconnected"), () => log("  back: NOT reconnected"));
// 7. A leaves the ride
await A.close();  // A leaves the page (pagehide)
const t0 = Date.now();
await B.waitForFunction((id) => !window.__voice.peers.has(id), { timeout: 30000, polling: 200 }, ids.A).then(() => log(`8 A left: B tore down in ${Date.now() - t0} ms; B buttons hidden`, ""), () => log("8 A left: B did NOT tear down"));
await wait(3000);
log("  B mic button hidden", await B.evaluate(() => document.getElementById("vcMic").hidden), "peers", await B.evaluate(() => window.__voice.peers.size));
log("errors:", errs.length ? errs : "none");
for (const br of browsers) await br.close();
