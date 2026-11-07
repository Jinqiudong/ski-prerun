// The bunny hill (宝宝坡) practice, drawn and run in the ride (look.html?practice=1): the resort's real bunny hill
// (practice-core.js bunnySpot), the board steered freely (no route pulling it), a lesson in steps (hold the phone,
// speed, edges, linking turns, braking, a caught edge, free practice), each with a paper card, a small live gauge
// and a pass measured from the physics. The resort's animal on its own feet is the coach: it says the step, shows
// the S of linked turns, waits, hops when you pass. Reaching the bottom puts you back at the top. ride.js builds the
// world round the nearest chairlift and hands over here (topOfLift st.practice); progress is localStorage
// prerunPractice.
import * as THREE from "three";
import { Rider, Tracks, Spray } from "./board.js?v=13";
import { poseBoarder, myRider } from "../rider/boarder.js?v=11";
import { Runner } from "./runner.js?v=1";
import { guideAnimal } from "./guide-core.js?v=3";
import { TREE, treeHit } from "./snow-core.js?v=2";
import { ANIMAL_ZH } from "../rider/animal-core.js?v=1";
import { ANIMALS } from "../start/resort-tiles.js?v=4";
import { t } from "../core/i18n.js?v=41";
import { fallLine } from "./edge-core.js?v=1";
import { tiltRead, tiltZero } from "./tilt-core.js?v=2";
import { sight } from "./snowfx.js?v=2";
import { STEPS, stepOf, goalText, newCheck, checkStep, edgeOf, alongLap, slipZone, loadProgress, saveProgress, nextStep, SPEED_GOAL, LINKS, STOP_IN, STOP_FROM } from "./practice-core.js?v=1";

const CSS = `
#prCard, #prGauge, #prPass, #prSheet .box, #prBubble { background: #fdfbf6; color: #22344d; border: 1px solid #d8ccb6; box-shadow: 0 6px 16px rgba(40,30,20,.22); font-family: "Noto Serif SC", serif; }
#prCard { position: fixed; z-index: 14; left: 14px; right: 14px; top: calc(86px + env(safe-area-inset-top)); border-radius: 10px; padding: 9px 12px 10px; }
#prCard .hd { display: flex; align-items: center; gap: 8px; }
#prCard .hd img { width: 30px; height: 30px; }
#prCard .hd small { font: 600 11px Oswald, sans-serif; letter-spacing: .12em; color: #8a6d3b; }
#prCard .hd b { font: 600 18px "Noto Serif SC", serif; flex: 1; }
#prCard .hd button, #prPass button, #prSheet button, #prGauge button { font: 600 13px "Noto Serif SC", serif; color: #22344d; background: #fdfbf6; border: 1px solid #cbbfa9; border-radius: 999px; padding: 5px 11px; box-shadow: 0 2px 6px rgba(40,30,20,.12); display: inline-flex; align-items: center; gap: 4px; }
#prCard .hd button img, #prGauge button img, #prSheet button img, #prPass button img { width: 20px; height: 20px; }
#prCard .goal { margin: 6px 0 0; font: 14px/1.45 "Noto Serif SC", serif; }
#prCard .ticks { display: flex; gap: 10px; margin-top: 6px; font: 600 13px "Noto Serif SC", serif; color: #8a8278; }
#prCard .ticks span { display: inline-flex; align-items: center; gap: 3px; } #prCard .ticks span.on { color: #2f5446; }
#prCard .ticks img { width: 20px; height: 20px; opacity: .25; } #prCard .ticks span.on img { opacity: 1; }
#prCard .note { margin: 6px 0 0; font: 600 13px/1.4 "Noto Serif SC", serif; color: #b6463b; }
#prCard .note:empty { display: none; }
#prCard .go { display: block; width: 100%; margin-top: 9px; padding: 10px; font: 600 16px "Noto Serif SC", serif; color: #fdfbf6; background: #22344d; border: 0; border-radius: 8px; }
#prCard .level { position: relative; width: 74px; height: 74px; margin: 8px auto 0; border-radius: 50%; border: 2px solid #cbbfa9; background: radial-gradient(circle, #fdfbf6 0 22%, #eef1ea 23% 100%); }
#prCard .level i { position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px; border-radius: 50%; background: #6f879c; transition: transform .08s linear; }
#prGauge { position: fixed; z-index: 13; left: 86px; right: 14px; bottom: calc(14px + env(safe-area-inset-bottom)); border-radius: 10px; padding: 7px 8px; display: flex; align-items: center; gap: 8px; min-height: 46px; }
#prGauge .g { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; }
#prGauge .spd b { font: 600 26px Oswald, sans-serif; } #prGauge .spd small { font: 12px "Noto Serif SC", serif; color: #8a8278; }
#prGauge .bar { position: relative; width: 100%; height: 10px; border-radius: 6px; background: #ece5d6; overflow: hidden; }
#prGauge .bar i { position: absolute; left: 0; top: 0; bottom: 0; background: #2f5446; border-radius: 6px; }
#prGauge .edge { flex-direction: column; gap: 2px; }
#prGauge .edge .lbl { display: flex; justify-content: space-between; width: 100%; font: 600 11px "Noto Serif SC", serif; color: #8a8278; }
#prGauge .edge .lbl span.on { color: #22344d; }
#prGauge .edge .track { position: relative; width: 100%; height: 10px; border-radius: 6px; background: #ece5d6; }
#prGauge .edge .track::before { content: ""; position: absolute; left: 50%; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: #cbbfa9; }
#prGauge .edge .track i { position: absolute; top: 0; bottom: 0; border-radius: 6px; background: #6f879c; }
#prGauge .ang svg { width: 92px; height: 50px; display: block; }
#prGauge .ang .txt { display: flex; flex-direction: column; font: 600 12px/1.25 "Noto Serif SC", serif; }
#prGauge .ang .txt b { font: 600 20px Oswald, sans-serif; }
#prGauge .dots { display: flex; gap: 5px; } #prGauge .dots i { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #cbbfa9; } #prGauge .dots i.on { background: #2f5446; border-color: #2f5446; }
#prGauge .ret { flex: none; padding: 6px 9px; }
#prPass { position: fixed; z-index: 20; left: 50%; top: 42%; transform: translate(-50%, -50%); width: min(300px, 84vw); border-radius: 12px; padding: 14px 16px 14px; text-align: center; animation: pr-pop .45s cubic-bezier(.3,1.5,.5,1); }
#prPass img.stamp { width: 70px; height: 70px; }
#prPass b { display: block; font: 600 20px "Noto Serif SC", serif; margin-top: 2px; }
#prPass p { margin: 6px 0 12px; font: 14px/1.5 "Noto Serif SC", serif; color: #6f5a46; }
#prPass .row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
#prPass button.next, #prSheet button.next { background: #22344d; border-color: #22344d; color: #fdfbf6; }
#prSheet { position: fixed; inset: 0; z-index: 70; background: rgba(34,52,77,.28); display: flex; align-items: flex-end; }
#prSheet .box { width: 100%; max-height: 82vh; overflow: auto; border-radius: 14px 14px 0 0; padding: 12px 14px calc(14px + env(safe-area-inset-bottom)); }
#prSheet h3 { margin: 2px 0 2px; font: 600 18px "Noto Serif SC", serif; display: flex; align-items: center; gap: 8px; } #prSheet h3 img { width: 32px; height: 32px; }
#prSheet .where { margin: 0 0 8px; font: 12px/1.5 "Noto Serif SC", serif; color: #8a8278; }
#prSheet .st { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-top: 1px solid #ece5d6; }
#prSheet .st img.ic { width: 30px; height: 30px; } #prSheet .st img.tick { width: 26px; height: 26px; } #prSheet .st img.tick.no { opacity: .18; }
#prSheet .st div { flex: 1; } #prSheet .st b { font: 600 15px "Noto Serif SC", serif; } #prSheet .st small { display: block; font: 12px/1.35 "Noto Serif SC", serif; color: #8a8278; }
#prSheet .st.on b { color: #b6463b; }
#prSheet .foot { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; flex-wrap: wrap; }
#prBubble { position: fixed; left: 0; top: 0; z-index: 15; width: max-content; max-width: 220px; padding: 6px 11px 7px; border-radius: 12px; font: 600 14px/1.3 "Noto Serif SC", serif; text-align: center; pointer-events: none; transform: translate(-50%, -100%); transition: opacity .25s; }
#prBubble::after { content: ""; position: absolute; left: 50%; bottom: -7px; width: 12px; height: 12px; margin-left: -6px; background: #fdfbf6; border-right: 1px solid #d8ccb6; border-bottom: 1px solid #d8ccb6; transform: rotate(45deg); }
#prBubble.fade { opacity: 0; }
#prFlash { position: fixed; inset: 0; z-index: 19; background: #fdfbf6; opacity: 0; pointer-events: none; transition: opacity .35s; }
#prFlash.on { opacity: 1; transition: none; }
body.practice #skiHud, body.practice #turnCue, body.practice #trickBtn { display: none !important; }
@keyframes pr-pop { from { transform: translate(-50%, -50%) scale(.7); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
`;
const ICON = (n) => `assets/icons/${n}.png?v=1`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const D = Math.PI / 180;
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const Y = new THREE.Vector3(0, 1, 0);
const el = (tag, id, html = "") => { const e = document.createElement(tag); if (id) e.id = id; e.innerHTML = html; return e; };
// Which way a heel-side skid turns the board's nose, as boarder.js / animal.js draw it (ride.js stepSki's heelSide).
const heelSide = (o) => (o.userData.kind === "animal" ? -1 : -(o.userData.toeX || 1)) * (o.userData.goofy ? -1 : 1);

// The spot's name as the card says it: the beginner lift's, a run's, or the base's.
export function spotTitle(spot) {
  const name = spot.name && spot.name !== "Lift" ? spot.name.replace(/\s+Lift$/, "") : ""; // "Molly Hogan Lift": Molly Hogan
  return spot.kind === "lift" ? (name ? t("{name} 宝宝坡", { name }) : t("宝宝坡")) : spot.kind === "run" ? t("{name} 宝宝坡", { name: name || t("绿道") }) : t("{name} 旁的缓坡", { name });
}

// scene, camera, canvas; T terrain; rider: my rider's root; snd: the ride's sound; spot: bunnySpot(); tilt: ride.js's
// phone tilt ({ side, fwd, ok }); treeAt(x, z, r); resort; exits: { mountain, lift? } hrefs.
export function startPractice({ scene, camera, canvas, T, rider, snd, spot, tilt, treeAt, resort, exits, storage = localStorage }) {
  if (!document.getElementById("prCss")) document.head.append(Object.assign(document.createElement("style"), { id: "prCss", textContent: CSS }));
  document.body.classList.add("practice");
  const r = new Rider(T), tracks = new Tracks(scene, T), spray = new Spray(scene);
  scene.attach(rider);
  const prog = loadProgress(storage);
  const heel = () => heelSide(rider);
  let key = prog.done.hold ? prog.at && prog.at !== "hold" ? prog.at : nextStep(prog) : "hold";
  let check = null, frozen = true, pass = null, endT = 0, stillT = 0, zero = null, lapN = 0;
  const [tx, tz] = spot.pts[Math.min(6, spot.pts.length - 1)], top = { x: tx, z: tz }; // ~24 m down from the lift's top: clear of its station
  const fallAt = (x, z) => fallLine(T.normalAt(x, z)).yaw;

  // ---- The coach: the resort's animal on foot (runner.js), with a paper bubble.
  const animal = guideAnimal(ANIMALS[resort], myRider().ch.animal || null), coachName = t(ANIMAL_ZH[animal] || "狐狸");
  const coach = { runner: new Runner(animal, 1.3), holder: new THREE.Group(), pos: new THREE.Vector3(), heading: 0, demo: 0, said: 0, until: 0, clock: 0 };
  coach.runner.ready.then(() => coach.holder.add(coach.runner.root)).catch(() => {});
  scene.add(coach.holder);
  const bubble = el("div", "prBubble"); bubble.hidden = true; document.body.append(bubble);
  const say = (text, hop = false, sec = 3.6) => { bubble.textContent = text; bubble.hidden = false; bubble.classList.remove("fade"); coach.until = coach.clock + sec; if (hop) coach.runner.hop(1); };

  // ---- The page: the step card (top), the gauge strip (bottom), the pass card, the steps sheet.
  const card = el("div", "prCard"), gauge = el("div", "prGauge"), flash = el("div", "prFlash");
  document.body.append(card, gauge, flash);
  let passEl = null, sheet = null;
  const n = (k) => STEPS.findIndex((s) => s.key === k) + 1;
  function drawCard() {
    const s = stepOf(key);
    const ticks = key === "edge" ? [["heel", "脚跟刃"], ["toe", "脚尖刃"]] : key === "catch" ? [["caught", "感受吃刃"], ["clean", "干净停住"]] : [];
    card.innerHTML = `<div class="hd"><img src="${ICON(s.icon)}" alt=""><b>${t(s.title)}</b><small>${n(key)} / ${STEPS.length}</small><button class="list"><img src="${ICON("packing")}" alt="">${t("步骤")}</button></div>
      <p class="goal">${goalText(s, t)}</p>
      ${ticks.length ? `<div class="ticks">${ticks.map(([k, label]) => `<span data-k="${k}"><img src="${ICON("st_done")}" alt="">${t(label)}</span>`).join("")}</div>` : ""}
      ${key === "hold" ? `<div class="level"><i></i></div><p class="note"></p><button class="go">${t("开始")}</button>` : `<p class="note"></p>`}`;
    card.querySelector(".list").onclick = openSheet;
    card.querySelector(".go")?.addEventListener("click", calibrate);
    drawGauge();
  }
  function drawGauge() {
    const parts = { hold: [], speed: ["spd", "bar"], edge: ["spd", "edge"], link: ["edge", "dots"], brake: ["spd", "ang"], catch: ["edge", "ang"], free: ["spd", "edge", "ang"] }[key];
    gauge.hidden = !parts.length;
    const lbl = (k) => t(edgeOf(k, heel()) > 0 ? "脚跟" : "脚尖");
    gauge.innerHTML = parts.map((p) => ({
      spd: `<div class="g spd"><b>0</b><small>km/h</small></div>`,
      bar: `<div class="g"><div class="bar"><i></i></div></div>`,
      edge: `<div class="g edge"><div class="lbl"><span data-s="-1">${lbl(-1)}</span><span>${t("平")}</span><span data-s="1">${lbl(1)}</span></div><div class="track"><i></i></div></div>`,
      // board vs travel: a quarter dial, 0° along the way you go to 90° straight across; 45–90° brakes
      ang: `<div class="g ang"><svg viewBox="0 0 92 50"><path d="M6 46 A40 40 0 0 1 17.7 17.7" fill="none" stroke="#cdd6c3" stroke-width="9"/><path d="M17.7 17.7 A40 40 0 0 1 46 6" fill="none" stroke="#e6b4bb" stroke-width="9"/><path d="M38 6.8 A40 40 0 0 1 46 6" fill="none" stroke="#c0675c" stroke-width="9"/><line class="nd" x1="46" y1="46" x2="6" y2="46" stroke="#22344d" stroke-width="3" stroke-linecap="round"/><circle cx="46" cy="46" r="4" fill="#22344d"/><text x="2" y="38" font-size="8" fill="#6f747e">0</text><text x="12" y="13" font-size="8" fill="#6f747e">45</text><text x="50" y="10" font-size="8" fill="#6f747e">90</text></svg><span class="txt"><b>0°</b><span class="zl">${t("滑行")}</span></span></div>`,
      dots: `<div class="g"><span class="dots">${Array.from({ length: LINKS }, () => "<i></i>").join("")}</span></div>`,
    })[p]).join("") + (key === "hold" ? "" : `<button class="ret"><img src="${ICON("reset")}" alt="">${t("回坡顶")}</button>`);
    gauge.querySelector(".ret")?.addEventListener("click", () => toTop());
  }
  // The live numbers, a few times a second is plenty for the eye.
  let gaugeAt = 0;
  function liveGauge(force = false) {
    if (!force && coach.clock - gaugeAt < 0.1) return; gaugeAt = coach.clock;
    const q = (s) => gauge.querySelector(s), kmh = Math.round(r.speed * 3.6);
    if (q(".spd b")) q(".spd b").textContent = kmh;
    if (q(".bar i")) q(".bar i").style.width = `${clamp(check.best / SPEED_GOAL, 0, 1) * 100}%`;
    if (q(".edge .track i")) {
      const s = clamp(r.steer, -1, 1), w = Math.abs(s) * 50;
      Object.assign(q(".edge .track i").style, { left: `${s < 0 ? 50 - w : 50}%`, width: `${w}%` });
      for (const e of gauge.querySelectorAll(".edge .lbl [data-s]")) e.classList.toggle("on", Math.abs(s) >= 0.25 && Math.sign(s) === +e.dataset.s);
    }
    if (q(".ang")) {
      const z = slipZone(r.slip || 0), a = z.deg * D;
      const nd = q(".ang .nd"); nd.setAttribute("x2", (46 - 40 * Math.cos(a)).toFixed(1)); nd.setAttribute("y2", (46 - 40 * Math.sin(a)).toFixed(1));
      q(".ang .txt b").textContent = `${z.deg}°`;
      q(".ang .zl").textContent = z.zone === "glide" ? t("滑行") : z.zone === "brake" ? t("刹车 {k}%", { k: Math.round(z.k * 100) }) : t("急停");
    }
    if (q(".dots")) gauge.querySelectorAll(".dots i").forEach((d, i) => d.classList.toggle("on", i < (check.turns.chain || 0)));
    // the card: ticks, and what the last try came to
    for (const s of card.querySelectorAll(".ticks [data-k]")) s.classList.toggle("on", !!check.parts[s.dataset.k]);
    const note = card.querySelector(".note");
    if (note && key !== "hold") note.textContent = noteOf();
  }
  function noteOf() {
    const L = check.last;
    if ((key === "brake" || key === "catch") && check.stop.at) return t("刹车中 · {m} 米", { m: check.stop.dist.toFixed(1) });
    if ((key === "brake" || key === "catch") && L && !L.ok) return L.caught ? t("吃刃了！刹车时重心留在脚跟（上坡那条刃）") : L.maxSlip < 60 ? t("板子再横一点：这次最多 {d}°", { d: L.maxSlip }) : t("停住用了 {m} 米，要 {lim} 米内：早一点、狠一点", { m: L.dist, lim: STOP_IN });
    if ((key === "brake" || key === "catch") && !check.stop.armed) return t("先滑到 {v} km/h", { v: STOP_FROM });
    if (key === "link" && check.turns.chain) return t("连续换刃 {k} / {n}", { k: check.turns.chain, n: LINKS });
    return "";
  }
  function calibrate() {
    zero = tilt.ok ? tiltZero(tilt.up) : null;
    done({ text: tilt.ok ? t("现在这样就是「平」。左右倾立刃，前倾加速，往回倒刹车") : t("没感应到手机倾斜：用手指拖，左右拖转弯，往下拖加速，往上拖刹车") });
  }

  // ---- Going: put the board at the top of the hill for the step, and the coach just below it.
  // fresh: a new try at the step (再练一次, the list); else another lap of the same one, keeping its ticks.
  function place(fresh = true) {
    const was = !fresh && check?.key === key ? check : null;
    const s = stepOf(key), f = fallAt(top.x, top.z), h = f - Math.sign(heel()) * s.aim * D;
    r.place(top.x, top.z, h, s.v);
    if (key === "hold") r.place(top.x, top.z, f + 90 * D, 0);
    tracks.clear();
    check = newCheck(key);
    if (was) Object.assign(check, { parts: was.parts, caughtSeen: was.caughtSeen, saidCaught: was.saidCaught, last: was.last });
    frozen = key === "hold";
    endT = 0; stillT = 0;
    coach.pos.set(top.x + Math.sin(f) * 9 + Math.cos(f) * 3, 0, top.z + Math.cos(f) * 9 - Math.sin(f) * 3);
    coach.demo = fresh && (key === "edge" || key === "link") ? 3.2 : 0;
    camera.position.set(r.x - Math.sin(h) * 7, r.y + 3.4, r.z - Math.cos(h) * 7);
    if (fresh) say(t(s.coach), true);
  }
  function toTop() {
    flash.classList.add("on"); requestAnimationFrame(() => requestAnimationFrame(() => flash.classList.remove("on")));
    lapN++;
    place(false);
  }
  function go(k) {
    key = k; prog.at = k; saveProgress(storage, prog);
    closePass(); closeSheet(); drawCard(); place();
  }
  function done({ text } = {}) {
    check.done = true; prog.done[key] = true; saveProgress(storage, prog);
    navigator.vibrate?.([30, 50, 30]);
    say(t(["漂亮！", "就是这样！", "学会啦～"][lapN % 3]), true);
    const s = stepOf(key), i = n(key), next = STEPS[i];
    passEl?.remove();
    passEl = el("div", "prPass", `<img class="stamp" src="${ICON("st_done")}" alt=""><b>${t("{step} · 过关", { step: t(s.title) })}</b><p>${text || passText()}</p>
      <div class="row"><button class="again"><img src="${ICON("reset")}" alt="">${t("再练一次")}</button>${next ? `<button class="next">${t("下一步：{step} ›", { step: t(next.title) })}</button>` : `<button class="next exit">${t("去滑雪道 ›")}</button>`}</div>`);
    document.body.append(passEl);
    passEl.querySelector(".again").onclick = () => go(key);
    passEl.querySelector(".next").onclick = () => (next ? go(next.key) : (location.href = exits.mountain));
  }
  function passText() {
    const L = check.last;
    if (key === "speed") return t("{v} km/h！板头朝下、板放平，速度就上来了", { v: Math.round(check.best) });
    if (key === "edge") return t("脚跟、脚尖都转过了滚落线。立刃越多，弯越急");
    if (key === "link") return t("连续换刃 {n} 次：每个弯都压住，过了坡下再换", { n: LINKS });
    if (key === "brake") return t("从 {v} km/h 停住只用了 {m} 米，板子横到 {d}°", { v: L.from, m: L.dist, d: L.maxSlip });
    if (key === "catch") return t("吃刃是下坡那条刃插进雪里。横着滑时，重心留在上坡那条刃上");
    return "";
  }
  function closePass() { passEl?.remove(); passEl = null; }
  function openSheet() {
    closeSheet();
    sheet = el("div", "prSheet", `<div class="box"><h3><img src="${ICON("practice")}" alt="">${spotTitle(spot)}</h3>
      <p class="where">${t("真实的初学者坡：{len} 米，平均 {deg}°", { len: Math.round(spot.L), deg: spot.mean })}${spot.kind === "base" ? ` · ${t("这个雪场没有宝宝坡，找了雪场底下最缓的一段")}` : ""}</p>
      ${STEPS.map((s) => `<div class="st${s.key === key ? " on" : ""}" data-k="${s.key}"><img class="ic" src="${ICON(s.icon)}" alt=""><div><b>${t(s.title)}</b><small>${goalText(s, t)}</small></div>
        ${s.key === "free" ? "" : `<img class="tick${prog.done[s.key] ? "" : " no"}" src="${ICON("st_done")}" alt="">`}<button>${prog.done[s.key] ? t("再练一次") : s.key === "free" ? t("去练") : t("练这个")}</button></div>`).join("")}
      <div class="foot"><button class="close">${t("接着练")}</button>${exits.lift ? `<button class="lift"><img src="${ICON("lift")}" alt="">${t("坐 {lift} 上山 ›", { lift: exits.liftName })}</button>` : ""}<button class="next exit"><img src="${ICON("resorts")}" alt="">${t("去滑雪道 ›")}</button></div></div>`);
    document.body.append(sheet);
    sheet.onclick = (e) => { if (e.target === sheet) closeSheet(); };
    sheet.querySelector(".close").onclick = closeSheet;
    sheet.querySelector(".exit").onclick = () => (location.href = exits.mountain);
    sheet.querySelector(".lift")?.addEventListener("click", () => (location.href = exits.lift));
    for (const row of sheet.querySelectorAll(".st")) row.querySelector("button").onclick = () => go(row.dataset.k);
  }
  function closeSheet() { sheet?.remove(); sheet = null; }

  // ---- Input: the phone's tilt (from the zero set at 开始), or a finger: across steers, down runs, up brakes.
  let sdrag = null, tSteer = 0, tPace = 0;
  canvas.addEventListener("pointerdown", (e) => { sdrag = { id: e.pointerId, x: e.clientX, y: e.clientY }; tSteer = tPace = 0; });
  addEventListener("pointermove", (e) => {
    if (!sdrag || e.pointerId !== sdrag.id) return;
    const dx = e.clientX - sdrag.x, dy = e.clientY - sdrag.y;
    tSteer = clamp(dx / (innerWidth * 0.3), -1, 1);
    tPace = Math.abs(dy) > Math.abs(dx) * 0.8 && Math.abs(dy) > 28 ? clamp((dy - Math.sign(dy) * 28) / 90, -1, 1) : 0;
  });
  const up = (e) => { if (sdrag && e.pointerId === sdrag.id) { sdrag = null; tSteer = tPace = 0; } };
  addEventListener("pointerup", up); addEventListener("pointercancel", up);
  function input(dt) {
    if (sdrag) return { steer: tSteer, pace: tPace };
    if (!tilt.ok) return { steer: 0, pace: 0 };
    zero ||= {};
    return tiltRead(zero, tilt.up, dt, 0.05); // a new posture is caught up with, never read as braking
  }

  // ---- One frame.
  const _back = new THREE.Vector3(), _want = new THREE.Vector3(), _look = new THREE.Vector3();
  function step(dt) {
    coach.clock += dt;
    if (frozen) {
      r.speed = 0; r.dt = dt; r.steer = 0; r.lean = 0; r.skid = 0; r.slip = 0;
      if (key === "hold") { // the bubble level: where the phone is now
        const i = card.querySelector(".level i"), note = card.querySelector(".note");
        if (i) i.style.transform = tilt.ok ? `translate(${clamp((tilt.side / D) * 1.4, -28, 28)}px, ${clamp(((tilt.fwd / D) - 45) * 0.6, -28, 28)}px)` : "none";
        if (note) note.textContent = tilt.ok ? "" : t("还没感应到手机倾斜，也可以用手指拖");
      }
    } else {
      const inp = check.done && key !== "hold" ? { steer: 0, pace: -1 } : input(dt); // passed: brought to a stop while the card is up
      r.step(dt, { steer: inp.steer, pace: inp.pace, push: false, offPiste: false, guided: false, heel: heel(), catchable: Math.abs(inp.steer) > 0.02 });
      // a trunk: glanced off round it (snow-core.js treeHit); straight on and fast, stopped, turned clear of it
      const tree = treeAt(r.x, r.z, TREE.r);
      if (tree) {
        const h = treeHit(r, tree, { x: Math.sin(r.fall ?? r.heading), z: Math.cos(r.fall ?? r.heading) });
        r.x = h.x; r.z = h.z; r.y = T.heightAt(r.x, r.z);
        if (h.into > 0) { r.heading = r.cyaw = r.yaw = h.crash ? h.up : h.heading; r.pivot = 0; r.speed = h.crash ? 0 : h.speed; }
      }
      r.surf = 0;
      if (!check.done) {
        checkStep(check, { speed: r.speed, heading: r.heading, fall: r.fall, slip: r.slip, caught: r.caught, steer: r.steer, heel: heel(), x: r.x, z: r.z, dt });
        if (check.done) done();
        else if (key === "catch" && check.parts.caught && !check.saidCaught) { check.saidCaught = true; say(t("绊了一下吧？这就是吃刃。再用脚跟刃停一次"), true, 4.5); }
      }
      // the end of the hill, or off it: back to the top (the lift up, in a blink)
      const a = alongLap(spot.pts, r.x, r.z);
      stillT = r.speed < 0.3 ? stillT + dt : 0;
      if ((a.s >= spot.L - 4 || a.d > 90 || stillT > 4) && !passEl && !sheet) { if ((endT += dt) > 0.6) { say(t(stillT > 4 ? "再来一次～" : "到底啦，回坡顶"), false, 2.5); toTop(); } }
      else endT = 0;
      tracks.add(r);
      const carve = Math.abs(r.lean) * r.speed;
      spray.emit(r, (r.skid || 0) * r.speed * 55 + (carve > 2 ? carve * 9 : 0), dt);
    }
    spray.update(dt);
    poseBoarder(rider, r);
    if (snd) { snd.setSurface("groomed"); snd.ski(r, { dt }); }
    stepCoach(dt);
    // the chase camera (as ride.js's), a little closer: a gentle hill, slow speeds
    const ch = frozen ? fallAt(r.x, r.z) : r.heading; // standing across the hill at the top: looking down it
    const back = _back.set(-Math.sin(ch), 0, -Math.cos(ch));
    const want = _want.set(r.x, r.y, r.z).addScaledVector(back, 6.8 + r.speed * 0.1);
    want.y = Math.max(T.heightAt(want.x, want.z) + 1.6, r.y + 3.2);
    camera.position.lerp(want, Math.min(1, dt * 4));
    camera.lookAt(_look.set(r.x + Math.sin(ch) * 8, r.y + 0.6, r.z + Math.cos(ch) * 8));
    sight.occA.value.copy(camera.position); sight.occB.value.set(r.x, r.y + 0.9, r.z); sight.occOn.value = 1; sight.occK.value.set(3.2, 1.3, 2, 5); sight.occT.value = 1; // trees between see-through
    if (check) liveGauge();
  }
  // The coach: just below you on the hill, turned to you, while you stand; ahead and to one side as you ride; for a
  // turning step, first a little S down the hill to show it.
  function stepCoach(dt) {
    const c = coach, f = fallAt(c.pos.x, c.pos.z), want = new THREE.Vector3();
    if (c.demo > 0) {
      c.demo -= dt; const u = 3.2 - c.demo;
      if (u < 0.05) say(t("看我：{line}", { line: t(key === "link" ? "左一下，右一下" : "压住，转过去") }), true, 3);
      const sx = top.x + Math.sin(f) * (9 + u * 5), sz = top.z + Math.cos(f) * (9 + u * 5), w = Math.sin(u * 2.4) * 4;
      want.set(sx + Math.cos(f) * w, 0, sz - Math.sin(f) * w);
    } else if (r.speed < 1) {
      const rf = fallAt(r.x, r.z);
      want.set(r.x + Math.sin(rf) * 7 + Math.cos(rf) * 2.5, 0, r.z + Math.cos(rf) * 7 - Math.sin(rf) * 2.5);
    } else want.set(r.x + Math.sin(r.heading) * 11 + Math.cos(r.heading) * 3, 0, r.z + Math.cos(r.heading) * 11 - Math.sin(r.heading) * 3);
    const was = c.pos.clone(), stepL = (Math.max(r.speed, 5) + 6) * dt, d = Math.hypot(want.x - c.pos.x, want.z - c.pos.z);
    if (d > 60) c.pos.copy(want); else if (d > stepL) { c.pos.x += ((want.x - c.pos.x) / d) * stepL; c.pos.z += ((want.z - c.pos.z) / d) * stepL; } else { c.pos.x = want.x; c.pos.z = want.z; }
    c.pos.y = T.heightAt(c.pos.x, c.pos.z);
    const v = Math.hypot(c.pos.x - was.x, c.pos.z - was.z) / Math.max(dt, 1e-3), h0 = c.heading;
    const face = v > 0.8 ? Math.atan2(c.pos.x - was.x, c.pos.z - was.z) : Math.atan2(r.x - c.pos.x, r.z - c.pos.z);
    c.heading += angleDiff(face, c.heading) * Math.min(1, dt * (v > 0.8 ? 7 : 3));
    c.holder.position.copy(c.pos); c.holder.rotation.set(0, c.heading, 0);
    c.runner.update(dt, { v, yawRate: angleDiff(c.heading, h0) / Math.max(dt, 1e-3), pitch: 0 });
    // the bubble over its head
    if (bubble.hidden) return;
    if (c.clock > c.until) { bubble.classList.add("fade"); if (c.clock > c.until + 0.3) bubble.hidden = true; return; }
    const p = c.pos.clone().addScaledVector(Y, 1.85).project(camera), w = bubble.offsetWidth || 120;
    const x = p.z > 1 ? innerWidth / 2 : (p.x * 0.5 + 0.5) * innerWidth, y = p.z > 1 ? innerHeight * 0.45 : (-p.y * 0.5 + 0.5) * innerHeight;
    bubble.style.left = `${clamp(x, w / 2 + 8, innerWidth - w / 2 - 8)}px`; bubble.style.top = `${clamp(y - 4, 250, innerHeight - 130)}px`;
  }

  drawCard(); place();
  say(t("{name}：欢迎来宝宝坡！我来教你", { name: coachName }), true, 4);
  // Testing: the physics without drawing, at 30 fps; fn(t, state) → { steer, pace } (a finger) or { beta, gamma } (the
  // phone's tilt, sent in as deviceorientation events).
  const api = {
    get key() { return key; }, go, calibrate, toTop, phys: r, prog, spot, check: () => check,
    state: () => ({ key, heel: heel(), kmh: +(r.speed * 3.6).toFixed(1), slip: slipZone(r.slip || 0).deg, edge: check?.edge, off: Math.round((check?.off || 0) / D), chain: check?.turns.chain, parts: { ...check?.parts }, done: check?.done, stop: check?.last, along: Math.round(alongLap(spot.pts, r.x, r.z).s), laps: lapN }),
    sim(secs, fn) {
      const out = [];
      for (let f = 0; f < secs * 30; f++) {
        const tt = f / 30, inp = fn ? fn(tt, api.state()) : null;
        if (inp?.beta != null) { sdrag = null; dispatchEvent(Object.assign(new Event("deviceorientation"), { beta: inp.beta, gamma: inp.gamma })); } // the phone, tilted
        else if (inp) { sdrag = { id: -1, x: 0, y: 0 }; tSteer = inp.steer ?? 0; tPace = inp.pace ?? 0; } else sdrag = null;
        step(1 / 30);
        if (f % 15 === 0) out.push(api.state());
        if (check.done || passEl) break;
      }
      sdrag = null; tSteer = tPace = 0;
      return out;
    },
  };
  return { step, api, focus: () => rider.position };
}
