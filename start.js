// The first screen: pick a rider (a default one, or one you dressed and named before), recolour its
// jacket, pants, helmet and goggles, then pick a resort. Riders are saved on this phone only.
import * as THREE from "three";
import { RIDERS, PART_ZH, OUTFITS } from "./boarder.js?v=15";
import { CFG, PART_LABEL, POSES, TRICKS, BOARDS, SIGNATURE, makeCharacter, presetChar, partColors, setPartColor } from "./character.js?v=6";
import { makeEntrance } from "./entrance.js?v=11";
import { daysOf, openBookPage, paintWith, locateIn } from "./roadbook.js?v=12";
import { t, EN_ON, translatePage, openSettings, myAvatar } from "./i18n.js?v=22";
import { playIntro } from "./intro.js?v=14";
playIntro();

const $ = (id) => document.getElementById(id);
// A muted outdoor palette (stone, sage, slate, clay...): nothing loud, and any mix of them goes together.
const SWATCHES = {
  jacket: ["#464e3f", "#6f7a62", "#8e9681", "#4a5a6e", "#2f3a4c", "#7b8a96", "#a39d8f", "#c2b49a", "#a8674f", "#8e4a36", "#a88584", "#6e5f6e", "#3b3d40", "#dcd7cc"],
  pants: ["#c5c4b6", "#dcd7cc", "#a39d8f", "#8f8670", "#4f5645", "#4a5a6e", "#2f3a4c", "#9c6a55", "#3b3d40", "#222326"],
  helmet: ["#161819", "#3b3d40", "#d9d6ce", "#8f8b82", "#4a5a6e", "#55604b", "#b8a98c", "#9a5f4a"],
  gloves: ["#3b3d40", "#222326", "#a8674f", "#4a5a6e", "#55604b", "#dcd7cc", "#b6463b"],
  boots: ["#3b3d40", "#222326", "#8f8670", "#a39d8f", "#4a5a6e", "#9c6a55"],
  lens: ["#ad5599", "#3a3c42", "#b8873e", "#b78473", "#7f9fb8", "#6f8f7a", "#9aa1a8"],
};

// ---- Saved state: { rider (one of your outfits' ids or a template's key), riders: [{ id, base, name, colors }] (your
// outfits), stances, resort }
const load = () => { try { return JSON.parse(localStorage.getItem("prerun") || "{}"); } catch { return {}; } };
const st = load();
st.riders = (st.riders || []).filter((r) => r.base in RIDERS); // riders on a base model since removed are dropped
delete st.kind; // everyone snowboards now
const save = () => localStorage.setItem("prerun", JSON.stringify(st));
const template = (k) => ({ id: k, base: "rider_a", name: EN_ON ? OUTFITS[k].en : OUTFITS[k].zh, colors: { ...OUTFITS[k].colors }, ch: presetChar(OUTFITS[k].ch), isDefault: true });
// Every rider is a character (template, body, fit, parts, colours); outfits saved before that get one from A, in their colours.
const charOf = (r) => { if (r.ch) return r.ch; const ch = presetChar("A"); for (const [p, c] of Object.entries(r.colors || {})) setPartColor(ch, p, c); return ch; };
const chosen = () => st.riders.find((r) => r.id === st.rider) || template(OUTFITS[st.rider] ? st.rider : "o_pine");

// ---- The 3D preview: the rider on a little snow disc, turning slowly; drag to turn it yourself.
const canvas = $("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
scene.add(new THREE.HemisphereLight(0xdfeaff, 0x8a96a8, 1.6));
const sun = new THREE.DirectionalLight(0xfff3e2, 2.4);
sun.position.set(2, 4, 3); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2 });
scene.add(sun);
const disc = new THREE.Mesh(new THREE.CircleGeometry(1.3, 48), new THREE.MeshStandardMaterial({ color: 0xf6f8fb, roughness: 0.9 }));
disc.rotation.x = -Math.PI / 2; disc.receiveShadow = true;
disc.visible = false; // the slope below is the ground now
scene.add(disc);
const entrance = makeEntrance(scene);
const turntable = new THREE.Group();
scene.add(turntable);
let rider = null, spin = 0, drag = null;
function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight * 0.56;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  camera.position.set(0, 1.45, 6.4); camera.lookAt(0, 0.82, 0);
}
addEventListener("resize", resize); resize();
// Drag to turn the rider round; on the pick page a quick swipe goes to the next friend and a tap runs their
// entrance again.
canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, a: turntable.rotation.y, t: performance.now() }; });
addEventListener("pointermove", (e) => { if (drag && !entrance.running) turntable.rotation.y = drag.a + (e.clientX - drag.x) / 120; });
addEventListener("pointerup", (e) => {
  if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y, quick = performance.now() - drag.t < 400; drag = null;
  if (editing || $("pickView").hidden) return;
  if (quick && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { nextRider(dx < 0 ? 1 : -1); return; }
  if (quick && Math.hypot(dx, dy) < 8) enter();
});
// Swipe: the next (or previous) of the suggestions and your own.
function nextRider(d) {
  const ids = [...Object.keys(OUTFITS), ...st.riders.map((r) => r.id)], i = ids.indexOf(chosen().id);
  st.rider = ids[(i + d + ids.length) % ids.length]; save(); renderPick(); show(chosen());
}
const ROUTE_OF = Object.fromEntries(Object.entries(SIGNATURE).map(([k, c]) => [c, k]));
// The shown rider's entrance: their favourite move's route (a carve's, a spin's, an S, a kicker), else the carve.
function enter() {
  if (!rider || editing) return;
  entrance.start(ROUTE_OF[shownChar?.fav] || "A", rider, turntable);
}
window.__stage = { scene, camera, turntable, entrance };
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (rider) { rider.step(dt); entrance.step(dt); }
  renderer.render(scene, camera);
});

// Regular (left foot forward) or goofy, per rider: the character is mirrored.
const stanceOf = (r) => ((st.stances || {})[r.id] === "goofy" ? "goofy" : "regular");
const chars = {}; let shownChar = null, editing = false;
const holder = new THREE.Group(); turntable.add(holder);
async function show(r, pose) {
  const ch = r.ch || charOf(r);
  const c = await (chars[ch.tpl] ||= makeCharacter(ch.tpl));
  const changed = rider !== c || shownChar?.board !== ch.board || shownChar?.fav !== ch.fav || shownChar !== ch && !editing;
  if (rider !== c) { if (rider) holder.remove(rider.root); rider = c; holder.add(c.root); }
  c.set(ch); shownChar = ch;
  if (editing) { entrance.stop(); turntable.position.set(0, 0, 0); turntable.rotation.y = 0; if (pose || !rider.current || rider.current === "Anim_Idle") rider.play(pose || "Board_Hold"); }
  else if (pose === "enter" || changed) enter();
  holder.scale.x = stanceOf(r) === "goofy" ? -1 : 1;
  holder.position.y = 0.062 * ch.height / CFG.templates[ch.tpl].height; // the template's snow is a little below its origin
  $("status").hidden = true;
  $("who").textContent = r.name;
}

// ---- Picking
// The owner's painted icons (assets/icons), one per part, in place of the words.
const ICON = (n) => `assets/icons/${n}.png?v=1`;
const dots = (r) => `<span class="dots">${Object.keys(RIDERS[r.base].parts).map((p) => `<i style="background:${r.colors?.[p] || RIDERS[r.base].parts[p].color}"></i>`).join("")}</span>`;
function renderPick() {
  const cur = chosen();
  $("defaults").innerHTML = "";
  for (const key of Object.keys(OUTFITS)) {
    const o = template(key), b = document.createElement("button");
    b.className = "card" + (cur.id === key ? " on" : "");
    b.innerHTML = `<b>${o.name}</b>${dots(o)}<small>${t("单板")} · ${stanceOf(o) === "goofy" ? "Goofy" : "Regular"}</small>`;
    b.onclick = () => { st.rider = key; save(); renderPick(); show(chosen()); };
    $("defaults").append(b);
  }
  $("mine").innerHTML = st.riders.length ? "" : `<div class="card" style="flex-basis:100%;height:auto;cursor:default"><small>${t("还没有。选一套模版，点「改颜色」换几样、取个名字，就存到这里。")}</small></div>`;
  for (const r of st.riders) {
    const b = document.createElement("div");
    b.className = "card" + (r.id === cur.id ? " on" : "");
    b.innerHTML = `<b>${escape(r.name)}</b>${dots(r)}<small>${t("单板")} · ${stanceOf(r) === "goofy" ? "Goofy" : "Regular"}</small><button class="del" aria-label="删除">🗑</button>`;
    b.onclick = (e) => {
      if (e.target.closest(".del")) {
        if (!confirm(`${t("删除")}「${r.name}」？`)) return;
        st.riders = st.riders.filter((x) => x !== r);
        if (st.rider === r.id) st.rider = "o_pine";
        save(); renderPick(); show(chosen()); return;
      }
      st.rider = r.id; save(); renderPick(); show(r);
    };
    $("mine").append(b);
  }
  for (const b of $("stance").children) b.classList.toggle("on", b.dataset.s === stanceOf(cur));
  $("editBtn").innerHTML = `<img src="${ICON("palette")}" alt="">${t("捏人")}${cur.isDefault ? `<br>${t("存成我的")}` : ""}`;
  // The characters: the base bodies outfits go on. Rider A for now; the man's is still being made.
  const tplNow = charOf(cur).tpl;
  $("chars").innerHTML = ["F", "M"].map((k) => `<button class="card${k === tplNow ? " on" : ""}" data-t="${k}"><b>${t(k === "F" ? "女" : "男")}</b></button>`).join("");
  for (const b of $("chars").children) b.onclick = () => { const k = Object.keys(OUTFITS).find((o) => OUTFITS[o].ch && CFG.presets[OUTFITS[o].ch].tpl === b.dataset.t); st.rider = k; save(); renderPick(); show(chosen()); };
}
const escape = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---- Dressing: a draft copy, previewed live; saving a default's draft makes a new rider of yours.
let draft = null, marks = [];
function openEdit() {
  const cur = chosen();
  draft = { id: cur.isDefault ? null : cur.id, base: cur.base, name: cur.isDefault ? "" : cur.name, colors: { ...cur.colors }, ch: JSON.parse(JSON.stringify(charOf(cur))) };
  const fromCh = JSON.parse(JSON.stringify(draft.ch));
  const parts = RIDERS[draft.base].parts, from = { ...cur.colors }; marks = [];
  // shuffle: a colour from each part's list; reset: back to what you started from
  $("shuffleBtn").onclick = () => { for (const [part, p] of Object.entries(parts)) { const l = [p.color, ...(SWATCHES[part] || [])]; draft.colors[part] = l[Math.floor(Math.random() * l.length)]; setPartColor(draft.ch, part, draft.colors[part]); } marks.forEach((m) => m()); show(draft); };
  $("resetBtn").onclick = () => { draft.colors = { ...from }; draft.ch = JSON.parse(JSON.stringify(fromCh)); paneTab(curTab); marks.forEach((m) => m()); show(draft); };
  $("parts").innerHTML = "";
  for (const [part, p] of Object.entries(parts)) {
    const wrap = document.createElement("div");
    wrap.className = "part";
    wrap.innerHTML = `<img class="ico" src="${ICON(part)}" alt="${t(PART_ZH[part])}"><div class="row"></div>`;
    const row = wrap.querySelector(".row");
    const list = [...new Set([p.color, ...(SWATCHES[part] || [])])];
    const mark = () => { for (const s of row.children) s.classList.toggle("on", s.dataset.c === (draft.colors[part] || p.color)); };
    for (const c of list) {
      const s = document.createElement("button");
      s.className = "sw"; s.style.background = c; s.dataset.c = c;
      s.onclick = () => { draft.colors[part] = c; setPartColor(draft.ch, part, c); mark(); show(draft); };
      row.append(s);
    }
    mark(); marks.push(mark);
    $("parts").append(wrap);
  }
  $("name").value = draft.name;
  editing = true; paneTab("身材"); show(draft, "Board_Hold");
  view("edit");
}
// The edit page's four tabs: body, clothes, colours (the swatches above), and moves.
let curTab = "身材";
const TABS_E = ["身材", "衣服", "颜色", "动作"];
const fmts = {};
const slider = (key, label, lo, hi, step, fmt) => (fmts[key] = fmt, `<label class="sl"><span>${t(label)}<b data-v="${key}">${fmt(draft.ch[key])}</b></span><input type="range" data-k="${key}" min="${lo}" max="${hi}" step="${step}" value="${draft.ch[key]}"></label>`);
const word = (lo, hi, a, b, c) => (v) => t(v < lo + (hi - lo) / 3 ? a : v > hi - (hi - lo) / 3 ? c : b);
function paneTab(name) {
  curTab = name;
  $("etabs").innerHTML = TABS_E.map((k) => `<button class="${k === name ? "on" : ""}">${t(k)}</button>`).join("");
  for (const b of $("etabs").children) b.onclick = () => paneTab(TABS_E[[...$("etabs").children].indexOf(b)]);
  const colours = name === "颜色"; $("parts").hidden = $("etools").hidden = !colours; $("epane").hidden = colours;
  const ch = draft.ch, T = CFG.templates[ch.tpl], S = Object.fromEntries(CFG.sliders.map((x) => [x.key, x]));
  const pane = $("epane");
  if (name === "身材") pane.innerHTML = `<div class="chips">${["F", "M"].map((k) => `<button class="chip${ch.tpl === k ? " on" : ""}" data-tpl="${k}">${t(k === "F" ? "女" : "男")}</button>`).join("")}</div>
    ${slider("height", "身高", T.hmin, T.hmax, 1, (v) => `${v} cm`)}
    ${slider("weight", "体重", S.weight.lo, S.weight.hi, 1, word(S.weight.lo, S.weight.hi, "偏瘦", "适中", "偏壮"))}
    ${slider("muscle", "肌肉", S.muscle.lo, S.muscle.hi, 1, word(S.muscle.lo, S.muscle.hi, "柔和", "普通", "结实"))}`;
  if (name === "衣服") pane.innerHTML = `${slider("jease", "外套宽松", S.jease.lo, S.jease.hi, 1, word(S.jease.lo, S.jease.hi, "合身", "适中", "宽松"))}
    ${slider("jlen", "外套长度", S.jlen.lo, S.jlen.hi, 0.5, word(S.jlen.lo, S.jlen.hi, "短", "适中", "长"))}
    ${slider("pease", "裤子宽松", S.pease.lo, S.pease.hi, 1, word(S.pease.lo, S.pease.hi, "合身", "适中", "宽松"))}
    <div class="chips">${Object.entries(PART_LABEL).map(([k, l]) => `<button class="chip${ch.parts[k] ? " on" : ""}" data-part="${k}">${t(l)}</button>`).join("")}</div>
    <h4>${t("雪板")}</h4><div class="boards">${BOARDS.map((k) => `<button class="${ch.board === k ? "on" : ""}" data-board="${k}"><img src="assets/riders/boards/${k}_top.jpg?v=1" alt=""></button>`).join("")}</div>`;
  if (name === "动作") pane.innerHTML = `<div class="chips">${POSES.map(([k, l]) => `<button class="chip${rider?.current === k ? " on" : ""}" data-play="${k}">${t(l)}</button>`).join("")}</div>
    <div class="tricks">${TRICKS.map(([k, l]) => `<button class="trick${rider?.current === k ? " on" : ""}" data-play="${k}">${ch.fav === k ? "<i>★</i>" : ""}${t(l)}</button>`).join("")}</div>
    <p class="hint">${t("点一个看动作；再点一次正在播的 trick，设成你最爱的（选人页会时不时做一下）")}</p>`;
  for (const i of pane.querySelectorAll("input[type=range]")) i.oninput = () => { const k = i.dataset.k; ch[k] = +i.value; pane.querySelector(`[data-v="${k}"]`).textContent = fmts[k](ch[k]); show(draft); };
  for (const b of pane.querySelectorAll("[data-tpl]")) b.onclick = () => { if (ch.tpl === b.dataset.tpl) return; const k = Object.keys(OUTFITS).find((o) => CFG.presets[OUTFITS[o].ch].tpl === b.dataset.tpl), pre = presetChar(OUTFITS[k].ch);
    Object.assign(ch, { tpl: pre.tpl, height: pre.height }); ch.parts.hair = pre.parts.hair; paneTab(name); show(draft); };
  for (const b of pane.querySelectorAll("[data-board]")) b.onclick = () => { ch.board = b.dataset.board; paneTab(name); show(draft); };
  for (const b of pane.querySelectorAll("[data-part]")) b.onclick = () => { ch.parts[b.dataset.part] = !ch.parts[b.dataset.part]; paneTab(name); show(draft); };
  for (const b of pane.querySelectorAll("[data-play]")) b.onclick = () => { const k = b.dataset.play;
    if (rider?.current === k && TRICKS.some(([n]) => n === k)) ch.fav = ch.fav === k ? null : k; else rider?.play(k); paneTab(name); };
}
$("editBtn").onclick = openEdit;
for (const b of $("stance").children) b.onclick = () => {
  const cur = chosen();
  st.stances = { ...(st.stances || {}), [cur.id]: b.dataset.s }; save();
  renderPick(); show(chosen());
};
$("cancelBtn").onclick = () => { editing = false; view("pick"); show(chosen(), "enter"); };
$("saveBtn").onclick = () => {
  const name = $("name").value.trim();
  if (!name) { $("name").focus(); $("name").placeholder = t("先取个名字"); return; }
  draft.name = name;
  if (draft.id) Object.assign(st.riders.find((r) => r.id === draft.id), draft);
  else { draft.id = "r" + Date.now().toString(36); st.riders.push(draft); }
  st.rider = draft.id; save(); editing = false;
  view("pick"); renderPick(); show(chosen(), "enter");
};

// ---- Tabs: the rider, the resorts (a map of them to conquer), the journal.
let collection = null, tab = "rider";
const logOf = () => { try { return JSON.parse(localStorage.getItem("prerunLog") || "{}"); } catch { return {}; } };
async function setTab(t) {
  tab = t; $("tabs").classList.remove("shut");
  for (const b of $("tabs").children) b.classList.toggle("on", b.dataset.tab === t);
  const rider = t === "rider";
  for (const id of ["stage", "sheet"]) $(id).hidden = !rider;
  $("status").hidden = !rider || !!rider_ready;
  $("world").hidden = t !== "resort"; $("records").hidden = t !== "log"; $("jMap").hidden = true; $("trips").hidden = t !== "trip";
  if (t === "trip") await openTrips();
  if (t === "resort") await openWorld();
  if (t === "log") await openRecords();
}
let rider_ready = false;
// The tabs fold into one round button while you look around — scrolling a page down, turning the rider,
// exploring the map — and a tap on it opens them again; scrolling back to the top opens them too.
const fold = () => $("tabs").classList.add("shut");
for (const id of ["sheet", "trips", "records"]) {
  let last = 0; const el = $(id);
  el.addEventListener("scroll", () => { const y = el.scrollTop; if (y > last + 6 && y > 40) fold(); else if (y < 8) $("tabs").classList.remove("shut"); last = y; }, { passive: true });
}
canvas.addEventListener("pointerdown", fold);
for (const b of $("tabs").children) b.onclick = () => { if ($("tabs").classList.contains("shut")) { $("tabs").classList.remove("shut"); return; } setTab(b.dataset.tab); }; // folded: a tap opens it
$("useBtn").onclick = () => { st.rider = chosen().id; save(); setTab("resort"); };
const resortList = async () => (await (await fetch("data/resorts.json")).json()).filter((r) => r.ready);
async function openWorld() {
  const cv = $("world").querySelector("canvas");
  if (!collection) {
    const { Collection } = await import("./collection.js?v=38");
    collection = new Collection(cv, $("ctags")); window.__world = collection; // testing
    const stats = Object.fromEntries(Object.entries(logOf()).map(([id, l]) => [id, l.stats || {}]));
    collection.resize();
    addEventListener("resize", () => collection.resize());
    await collection.build(await resortList(), stats, logOf());
    $("worldHome").onclick = () => { collection.overview(); $("worldCard").hidden = true; };
    $("allBtn").onclick = $("worldHome").onclick;
    collection.onPick = (r) => { $("tabs").classList.add("shut");
      const s = logOf()[r.id]?.stats, card = $("worldCard");
      card.innerHTML = `<img class="st" src="assets/icons/${s?.touched ? "st_prerun" : "st_notyet"}.png?v=1" alt=""><b>${r.name}</b><small>${EN_ON ? "" : `${r.zh} · `}${s?.touched ? t("滑过 {a}/{b} 条雪道 · {km} 公里", { a: s.touched, b: s.runs, km: s.km.toFixed(1) }) : t("还没去过")}</small>
        <div class="bar"><i style="width:${Math.round((s?.share || 0) * 100)}%"></i></div><button>${t(s?.touched ? "继续征服 ›" : "去这里 ›")}</button>`;
      card.querySelector("button").onclick = () => { st.resort = r.id; save(); location.href = `mountain/?resort=${encodeURIComponent(r.id)}`; };
      card.hidden = false;
    };
    collection.onExplore = () => $("tabs").classList.add("shut"); // turning or zooming the map folds the tabs away
    const loop = (now) => { if (tab === "resort") { collection.frame(now / 1000); $("world").classList.toggle("focus", !!collection.picked); $("compass").style.transform = `rotate(${(collection.controls.getAzimuthalAngle() * 180 / Math.PI).toFixed(1)}deg)`; } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  collection.resize();
}
// Trips: plan where and when, with whom; share as a link.
let trips = null;
async function openTrips() {
  if (!trips) {
    const { Trips } = await import("./trips.js?v=26");
    const sprite = (() => { try { return localStorage.getItem("prerunSprite"); } catch { return null; } })();
    trips = new Trips($("trips"), await resortList(), { me: "我", sprite, go: (id) => { st.resort = id; save(); location.href = `mountain/?resort=${encodeURIComponent(id)}`; } });
    const code = new URLSearchParams(location.search).get("trip");
    if (code) trips.incoming(code);
  }
  trips.render();
}
async function openRecords() {
  const list = await resortList(), log = logOf(), box = $("recList");
  const { renderMemory } = await import("./memory.js?v=12");
  renderMemory($("memory"), { resorts: list, openBook: (id) => openBook(list.find((r) => r.id === id)) });
  box.innerHTML = "";
  const sorted = [...list].sort((a, b) => (log[b.id]?.stats?.share || 0) - (log[a.id]?.stats?.share || 0));
  for (const r of sorted) {
    const s = log[r.id]?.stats, el = document.createElement("div");
    el.className = "rec";
    el.innerHTML = `<div class="thumb" style="background-image:url(assets/wc/${r.id}.jpg?v=1)"></div><div class="row1"><b>${(s?.share || 0) >= 0.999 ? "🌸 " : ""}${r.name}</b><small>${s?.touched ? `${Math.max(1, Math.round(s.share * 100))}%` : t("还没去过")}</small></div>
      <div class="bar"><i style="width:${Math.round((s?.share || 0) * 100)}%"></i></div>
      <small>${s?.touched ? t("滑过 {a}/{b} 条雪道 · {km} 公里 · {n} 趟", { a: s.touched, b: s.runs, km: s.km.toFixed(1), n: s.rides }) : t("去滑一趟，这里就会记下来")}</small>
      <div class="recBtns">${s?.touched ? `<button class="map">${t("🗺 看地图")}</button>` : ""}${daysOf(r.id).length ? `<button class="bk">${t("📜 预滑路书")}</button>` : ""}</div>`;
    el.querySelector(".map")?.addEventListener("click", () => openJournal(r));
    el.querySelector(".bk")?.addEventListener("click", () => openBook(r));
    box.append(el);
  }
}
// The roadbook for one resort: the steps of each pre-run, its way on the map, and where you are now.
async function openBook(r) {
  const [{ Terrain, treeMaskFn }, { TrailMap }] = await Promise.all([import("./world.js?v=5"), import("./mapview.js?v=7")]);
  const R = await (await fetch(`data/${r.id}.json`)).json(), T = new Terrain(R);
  const tm = new TrailMap(T, R, treeMaskFn(R, T), R.places.filter((p) => p.kind === "village"));
  openBookPage(r.id, { name: r.name, drawMap: paintWith(tm), locate: locateIn(R.origin) });
}
// The journal map for one resort: everything skied there in ink.
async function openJournal(r) {
  const [{ Terrain, treeMaskFn }, { TrailMap }, { SkiLog }] = await Promise.all([import("./world.js?v=5"), import("./mapview.js?v=7"), import("./skilog.js?v=2")]);
  const R = await (await fetch(`data/${r.id}.json`)).json(), T = new Terrain(R);
  const tm = new TrailMap(T, R, treeMaskFn(R, T), R.places.filter((p) => p.kind === "village")), log = new SkiLog(r.id, R);
  const skied = log.stretches(), track = logOf()[r.id]?.lastTrack || [], s = log.stats();
  // Frame what you skied; else your last track; else the whole resort.
  const [bx0, bz0, bx1, bz1] = R.bounds, pts = skied.length ? skied.flat() : track.length ? track : [[bx0, bz0], [bx1, bz1]];
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const box = $("jMap"), cv = box.querySelector("canvas");
  box.hidden = false;
  const v = { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cz: (Math.min(...zs) + Math.max(...zs)) / 2, zoom: 0.2 };
  v.zoom = Math.min(0.5, Math.max(0.06, Math.min(innerWidth / (Math.max(...xs) - Math.min(...xs) + 600), innerHeight / (Math.max(...zs) - Math.min(...zs) + 900))));
  box.querySelector(".bar b").innerHTML = `📖 ${r.name}<br><small style="font-weight:500;color:#7a5a3a">${t("滑过 {a}/{b} 条雪道 · {km} 公里", { a: s.touched, b: s.runs, km: s.km.toFixed(1) })} · ${Math.round(s.share * 100)}%</small>`;
  const draw = () => {
    const dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr);
    tm.view(cv, { cx: v.cx, cz: v.cz, zoom: v.zoom, skied, track, dpr });
  };
  draw();
  let d = null;
  cv.onpointerdown = (e) => (d = { x: e.clientX, y: e.clientY });
  cv.onpointermove = (e) => { if (!d) return; v.cx -= (e.clientX - d.x) / v.zoom; v.cz -= (e.clientY - d.y) / v.zoom; d = { x: e.clientX, y: e.clientY }; draw(); };
  cv.onpointerup = () => (d = null);
  $("jZoom").onclick = () => { v.zoom = Math.min(1.2, v.zoom * 1.4); draw(); };
  $("jZoomOut").onclick = () => { v.zoom = Math.max(0.05, v.zoom / 1.4); draw(); };
  $("jClose").onclick = () => (box.hidden = true);
}
function view(v) {
  $("pickView").hidden = v !== "pick"; $("editView").hidden = v !== "edit";
  document.body.classList.toggle("editing", v === "edit");
  $("headTitle").textContent = t({ pick: "选你的穿搭", edit: "捏人", resort: "去哪个雪场" }[v]);
  $("headSub").textContent = { pick: t("先选一套穿搭，再选雪场"), edit: t("身材、衣服、颜色、动作，取个名字存在这台手机"), resort: `${chosen().name} · ${t("单板")} · ${stanceOf(chosen()) === "goofy" ? "Goofy" : "Regular"}` }[v];
}

renderPick();
show(chosen()).then(() => (rider_ready = true)).catch((e) => { $("status").textContent = t("人物没加载出来，刷新试试"); console.warn(e); });
// ?tab=resort or ?tab=log (from the game's menu); a rider already chosen starts on the map.
const askTab = new URLSearchParams(location.search).get("tab");
setTab(new URLSearchParams(location.search).has("trip") ? "trip" : ({ log: "log", resort: "resort", trip: "trip" })[askTab] || "rider");
// Settings (the language) from the gear on the rider page.
$("setBtn").onclick = openSettings;
const face = () => ($("setBtn").querySelector("img").src = `assets/icons/${myAvatar()}.png?v=1`);
face(); addEventListener("prerun:avatar", () => { face(); trips?.render?.(); });
// A pre-run left half way (kept by the ride page): offer to go back to it.
(() => {
  let ses = null; try { ses = JSON.parse(localStorage.getItem("prerunSession") || "null"); } catch {}
  if (!ses || Date.now() - ses.t > 36 * 3600e3) return;
  const el = $("resume"), name = ses.resort.replace(/(^|-)\w/g, (m) => m.toUpperCase()).replace(/-/g, " ");
  el.href = `look.html?resort=${encodeURIComponent(ses.resort)}&lift=${encodeURIComponent(ses.lift)}&at=${ses.at}`;
  el.querySelector("b").textContent = `${t("继续")} · ${name}`;
  el.querySelector("small").textContent = ses.where;
  el.querySelector("i").style.width = `${Math.round((ses.phase === "ride" ? ses.at : 1) * 100)}%`;
  el.hidden = false; document.body.classList.add("resuming");
  // Closed it's a small button; the first tap opens it, ▶ (or a second tap) goes; a tap elsewhere closes it.
  el.addEventListener("click", (e) => { if (!el.classList.contains("open")) { e.preventDefault(); el.classList.add("open"); } });
  addEventListener("pointerdown", (e) => { if (!el.contains(e.target)) el.classList.remove("open"); });
})();
translatePage();
