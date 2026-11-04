// The first screen: pick a rider (a default one, or one you dressed and named before), recolour its
// jacket, pants, helmet and goggles, then pick a resort. Riders are saved on this phone only.
import * as THREE from "three";
import { RIDERS, PART_ZH, OUTFITS, loadBoarder, boarderModel, idleBoarder, dressRider } from "./boarder.js?v=14";
import { daysOf, openBookPage, paintWith, locateIn } from "./roadbook.js?v=4";
import { t, EN_ON, translatePage, openSettings } from "./i18n.js?v=10";

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
const template = (k) => ({ id: k, base: "rider_a", name: EN_ON ? OUTFITS[k].en : OUTFITS[k].zh, colors: { ...OUTFITS[k].colors }, isDefault: true });
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
scene.add(disc);
const turntable = new THREE.Group();
scene.add(turntable);
let rider = null, spin = 0.6, drag = null;
function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight * 0.56;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  camera.position.set(0, 1.3, 5.4); camera.lookAt(0, 0.62, 0);
}
addEventListener("resize", resize); resize();
canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, a: turntable.rotation.y }; });
addEventListener("pointermove", (e) => { if (drag) turntable.rotation.y = drag.a + (e.clientX - drag.x) / 120; });
addEventListener("pointerup", () => { drag = null; });
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!drag) turntable.rotation.y += spin * dt;
  if (rider) idleBoarder(rider);
  renderer.render(scene, camera);
});

// Regular (left foot forward) or goofy, per rider; the model is rebuilt to face the other way.
const stanceOf = (r) => ((st.stances || {})[r.id] === "goofy" ? "goofy" : "regular");
let shownStance = null;
async function show(r) {
  await loadBoarder(RIDERS[r.base].file);
  if (rider && shownStance !== stanceOf(r)) { turntable.remove(rider); rider = null; }
  if (!rider) {
    if (r.id) { st.rider = r.id; save(); } // boarderModel reads the stance of the saved rider
    shownStance = stanceOf(r);
    rider = boarderModel();
    rider.rotation.y = Math.PI / 2; // the board across the view, the rider facing the camera
    turntable.add(rider);
    $("status").hidden = true;
  }
  dressRider(rider.userData.model, r.base, r.colors);
  $("who").textContent = r.name;
}

// ---- Picking
// Little watercolour pictures of each part, painted in its current colour, in place of the words.
const PART_ICON = {
  jacket: `<path d="M14 7 L20 10 L26 7 L33 12 L36 24 L31 25 L30 18 L30 34 L10 34 L10 18 L9 25 L4 24 L7 12Z" fill="var(--c)" stroke="#22344d" stroke-width="1.1" stroke-linejoin="round"/><path d="M20 10 V34" stroke="#fdfbf6" stroke-width="1.2" opacity=".7"/><path d="M14 7 L20 14 L26 7" fill="none" stroke="#22344d" stroke-width="1"/>`,
  pants: `<path d="M11 6 H29 L32 34 H23 L20 16 L17 34 H8Z" fill="var(--c)" stroke="#22344d" stroke-width="1.1" stroke-linejoin="round"/><path d="M11 9.5 H29" stroke="#22344d" stroke-width="1" opacity=".6"/><rect x="24" y="18" width="5" height="6" rx="1" fill="none" stroke="#22344d" stroke-width=".9" opacity=".6"/>`,
  helmet: `<path d="M6 26 C6 13 13 7 20 7 C28 7 34 13 34 26 Z" fill="var(--c)" stroke="#22344d" stroke-width="1.1" stroke-linejoin="round"/><path d="M5 26 H35 V29 H5Z" fill="#22344d" opacity=".75"/><path d="M12 13 C15 10 19 9.5 22 10" stroke="#fdfbf6" stroke-width="1.6" stroke-linecap="round" opacity=".7" fill="none"/>`,
  gloves: `<path d="M12 34 L11 20 C10 14 11 9 15 8 C17 7.5 18 9 18 12 L18 9 C18 6 23 6 23 9 L23 12 C24 10 28 10 28 13 L29 22 L31 18 C33 15 36 17 34 20 L29 28 L28 34Z" fill="var(--c)" stroke="#22344d" stroke-width="1.1" stroke-linejoin="round"/><path d="M11 30 H29" stroke="#22344d" stroke-width="2.2" opacity=".6"/>`,
  boots: `<path d="M11 6 H24 L25 22 C30 23 35 25 35 29 V33 H7 L8 20Z" fill="var(--c)" stroke="#22344d" stroke-width="1.1" stroke-linejoin="round"/><path d="M7 30 H35" stroke="#22344d" stroke-width="2.6"/><path d="M12 12 L22 14 M12 17 L22 19" stroke="#22344d" stroke-width="1" opacity=".55"/>`,
  lens: `<path d="M5 20 H35" stroke="#22344d" stroke-width="3" stroke-linecap="round"/><path d="M8 14 H32 C35 14 35 27 32 27 H24 L20 23 L16 27 H8 C5 27 5 14 8 14Z" fill="var(--c)" stroke="#22344d" stroke-width="1.3" stroke-linejoin="round"/><path d="M10 17 L15 17" stroke="#fdfbf6" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`,
};
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
  $("editBtn").innerHTML = `<span>🎨</span>${t("改颜色")}${cur.isDefault ? `<br>${t("存成我的")}` : ""}`;
  // The characters: the base bodies outfits go on. Rider A for now; the man's is still being made.
  $("chars").innerHTML = `<button class="card on"><b>${t("女")}</b></button><button class="card" disabled><b>${t("男")}</b><small>${t("制作中")}</small></button>`;
}
const escape = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---- Dressing: a draft copy, previewed live; saving a default's draft makes a new rider of yours.
let draft = null;
function openEdit() {
  const cur = chosen();
  draft = { id: cur.isDefault ? null : cur.id, base: cur.base, name: cur.isDefault ? "" : cur.name, colors: { ...cur.colors } };
  const parts = RIDERS[draft.base].parts;
  $("parts").innerHTML = "";
  for (const [part, p] of Object.entries(parts)) {
    const wrap = document.createElement("div");
    wrap.className = "part";
    wrap.innerHTML = `<svg class="ico" viewBox="0 0 40 40" role="img" aria-label="${t(PART_ZH[part])}"><g filter="url(#wct)">${PART_ICON[part]}</g></svg><div class="row"></div>`;
    const row = wrap.querySelector(".row");
    const list = [...new Set([p.color, ...(SWATCHES[part] || [])])];
    const mark = () => { for (const s of row.children) s.classList.toggle("on", s.dataset.c === (draft.colors[part] || p.color)); };
    for (const c of list) {
      const s = document.createElement("button");
      s.className = "sw"; s.style.background = c; s.dataset.c = c;
      s.onclick = () => { draft.colors[part] = c; mark(); tint(); show(draft); };
      row.append(s);
    }
    mark();
    const tint = () => wrap.querySelector(".ico").style.setProperty("--c", draft.colors[part] || p.color);
    tint(); $("parts").append(wrap);
  }
  $("name").value = draft.name;
  view("edit");
}
$("editBtn").onclick = openEdit;
for (const b of $("stance").children) b.onclick = () => {
  const cur = chosen();
  st.stances = { ...(st.stances || {}), [cur.id]: b.dataset.s }; save();
  renderPick(); show(chosen());
};
$("cancelBtn").onclick = () => { view("pick"); show(chosen()); };
$("saveBtn").onclick = () => {
  const name = $("name").value.trim();
  if (!name) { $("name").focus(); $("name").placeholder = t("先取个名字"); return; }
  draft.name = name;
  if (draft.id) Object.assign(st.riders.find((r) => r.id === draft.id), draft);
  else { draft.id = "r" + Date.now().toString(36); st.riders.push(draft); }
  st.rider = draft.id; save();
  view("pick"); renderPick(); show(chosen());
};

// ---- Tabs: the rider, the resorts (a map of them to conquer), the journal.
let collection = null, tab = "rider";
const logOf = () => { try { return JSON.parse(localStorage.getItem("prerunLog") || "{}"); } catch { return {}; } };
async function setTab(t) {
  tab = t;
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
for (const b of $("tabs").children) b.onclick = () => setTab(b.dataset.tab);
$("useBtn").onclick = () => { st.rider = chosen().id; save(); setTab("resort"); };
const resortList = async () => (await (await fetch("data/resorts.json")).json()).filter((r) => r.ready);
async function openWorld() {
  const cv = $("world").querySelector("canvas");
  if (!collection) {
    const { Collection } = await import("./collection.js?v=21");
    collection = new Collection(cv, $("ctags")); window.__world = collection; // testing
    const stats = Object.fromEntries(Object.entries(logOf()).map(([id, l]) => [id, l.stats || {}]));
    collection.resize();
    addEventListener("resize", () => collection.resize());
    await collection.build(await resortList(), stats, logOf());
    $("worldHome").onclick = () => { collection.overview(); $("worldCard").hidden = true; };
    collection.onPick = (r) => {
      const s = logOf()[r.id]?.stats, card = $("worldCard");
      card.innerHTML = `<b>${r.name}</b><small>${EN_ON ? "" : `${r.zh} · `}${s?.touched ? t("滑过 {a}/{b} 条雪道 · {km} 公里", { a: s.touched, b: s.runs, km: s.km.toFixed(1) }) : t("还没去过")}</small>
        <div class="bar"><i style="width:${Math.round((s?.share || 0) * 100)}%"></i></div><button>${t(s?.touched ? "继续征服 ›" : "去这里 ›")}</button>`;
      card.querySelector("button").onclick = () => { st.resort = r.id; save(); location.href = `mountain/?resort=${encodeURIComponent(r.id)}`; };
      card.hidden = false;
    };
    const loop = (now) => { if (tab === "resort") collection.frame(now / 1000); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  collection.resize();
}
// Trips: plan where and when, with whom; share as a link.
let trips = null;
async function openTrips() {
  if (!trips) {
    const { Trips } = await import("./trips.js?v=14");
    const sprite = (() => { try { return localStorage.getItem("prerunSprite"); } catch { return null; } })();
    trips = new Trips($("trips"), await resortList(), { me: "我", sprite, go: (id) => { st.resort = id; save(); location.href = `mountain/?resort=${encodeURIComponent(id)}`; } });
    const code = new URLSearchParams(location.search).get("trip");
    if (code) trips.incoming(code);
  }
  trips.render();
}
async function openRecords() {
  const list = await resortList(), log = logOf(), box = $("recList");
  const { renderMemory } = await import("./memory.js?v=5");
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
  $("headTitle").textContent = t({ pick: "选你的穿搭", edit: "改颜色", resort: "去哪个雪场" }[v]);
  $("headSub").textContent = { pick: t("先选一套穿搭，再选雪场"), edit: t("改颜色，取个名字，保存到这台手机"), resort: `${chosen().name} · ${t("单板")} · ${stanceOf(chosen()) === "goofy" ? "Goofy" : "Regular"}` }[v];
}

renderPick();
show(chosen()).then(() => (rider_ready = true)).catch((e) => { $("status").textContent = t("人物没加载出来，刷新试试"); console.warn(e); });
// ?tab=resort or ?tab=log (from the game's menu); a rider already chosen starts on the map.
const askTab = new URLSearchParams(location.search).get("tab");
setTab(new URLSearchParams(location.search).has("trip") ? "trip" : ({ log: "log", resort: "resort", trip: "trip" })[askTab] || "rider");
// Settings (the language) from the gear on the rider page.
$("setBtn").onclick = openSettings;
translatePage();
