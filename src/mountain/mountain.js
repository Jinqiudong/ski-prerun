// The resort page: the whole mountain from the air, in the start map's style (src/mountain/aerial.js):
// real terrain, the runs in ink, the lifts as thin cables, fading into the paper. Pick a base and the camera
// flies down to it, steeply over the same terrain, to choose a lift.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Terrain } from "../ride/world.js?v=5";
import { markMoguls } from "../ride/snow-core.js?v=1";
import { buildGraph, planRoute, nodesNear, LEVELS } from "../core/route.js?v=5";
import { Aerial, PAPER } from "./aerial.js?v=1";
import { solar, sunVector, weatherKind, WEATHER_ZH, palette } from "../ride/sky.js?v=1";
import { addStep } from "../ride/roadbook.js?v=18";
import { translatePage, myAvatar, t as tr, EN_ON as EN } from "../core/i18n.js?v=37";
import { openNav } from "../core/nav.js?v=15";
import { liftTicket } from "../core/transition.js?v=8";
import { startParty } from "../core/party.js?v=7";

const EXAG = 1.3; // relief exaggerated, as painted resort maps do, so the ridges read
// Which resort: ?resort=, else the one picked on the start screen. Its place comes with its data.
const RESORT_ID = (() => { try { return new URLSearchParams(location.search).get("resort") || JSON.parse(localStorage.getItem("prerun") || "{}").resort || "copper"; } catch { return "copper"; } })().replace(/[^a-z0-9-]/g, "");
const RESORT = { lat: 39.4775, lon: -106.1605, tz: "America/Denver", name: "Copper Mountain" };
// The party (src/core/party.js): its pet on the right edge; in a party, a lift card's button calls everyone
// to ride it together (一起坐) instead of going alone.
const party = startParty({ page: "resort", root: "../", resort: RESORT_ID });
const FLY = 1.8; // seconds: down to a base; back up is a little quicker
const $ = (id) => document.getElementById(id);
const status = (t) => { $("status").textContent = t; return new Promise((r) => setTimeout(r, 20)); };

const renderer = new THREE.WebGLRenderer({ canvas: $("c"), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia("(pointer: coarse)").matches ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 20, 120000);
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, { enableDamping: true, maxPolarAngle: 1.42, minDistance: 400, maxDistance: 26000, autoRotate: true, autoRotateSpeed: 0.35 });
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });


// ---------- Bases: where a day starts. Pick one, see the lifts that leave from it. ----------
const BASE_RADIUS = 350; // lift bottoms within this distance belong to the base
const pins = [];
function pin(html, cls, pos, onClick) {
  const el = document.createElement("div");
  el.className = cls;
  el.innerHTML = html;
  if (onClick) el.addEventListener("click", onClick);
  $("pins").appendChild(el);
  const item = { el, pos };
  pins.push(item);
  return item;
}
const v3 = new THREE.Vector3();
function placePins() {
  for (const p of pins) {
    v3.copy(p.pos).project(camera);
    const show = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
    p.el.style.display = show ? "" : "none";
    if (show) p.el.style.transform = `translate(${(v3.x * 0.5 + 0.5) * innerWidth}px, ${(-v3.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
  }
}
// Offsets in metres for Copper, seen from its villages to the north; c.k scales them to the resort's size
// and c.rot turns them so every resort is seen from the side its bases are on, looking up the slopes.
const at = (c, dx, dz) => [c.x + (dx * c.rot.c - dz * c.rot.s) * c.k, c.z + (dx * c.rot.s + dz * c.rot.c) * c.k];
const VIEWS = {
  hero: (c) => { const [tx, tz] = at(c, 0, 500), [px, pz] = at(c, 3200, -7800); return { target: [tx, c.y * EXAG + 500 * c.k, tz], pos: [px, c.y * EXAG + 2200 * c.k, pz] }; },
  close: (c) => { const [tx, tz] = at(c, -300, 300), [px, pz] = at(c, 900, -2400); return { target: [tx, c.y * EXAG + 600 * c.k, tz], pos: [px, c.y * EXAG + 1700 * c.k, pz] }; },
  top: (c) => { const [px, pz] = at(c, 200, -1200); return { target: [c.x, c.y * EXAG, c.z], pos: [px, c.y * EXAG + 10000 * c.k, pz] }; },
};
let center;
function setView(name) {
  const v = VIEWS[name](center);
  controls.target.set(...v.target);
  camera.position.set(...v.pos);
  document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("on", b.dataset.view === name));
  // Spinning only makes sense for the whole mountain: the other views stop it and hide its switch.
  const sp = document.getElementById("spin");
  if (sp) { sp.hidden = name !== "hero"; if (name !== "hero") { controls.autoRotate = false; sp.classList.remove("on"); } }
}

const RIDEABLE = ["chair_lift", "mixed_lift", "gondola", "cable_car"];
async function main() {
  await status("下载地形…");
  const R = await fetch(`../data/${RESORT_ID}.json`).then((r) => r.json());
  Object.assign(RESORT, { lat: R.origin.lat, lon: R.origin.lon, name: R.name }); // all Colorado so far: Denver time
  party.setRn(R.name);
  document.title = `${R.name} · 雪场预滑`;
  document.querySelector("#title b").textContent = R.name;
  // The heights and the run counts, from the resort list (tools/resort_stats.py).
  fetch("../data/resorts.json").then((r) => r.json()).then((list) => {
    const st = list.find((x) => x.id === RESORT_ID)?.stats; if (!st) return;
    $("heights").textContent = `BASE ${st.base.toLocaleString("en-US")} m · SUMMIT ${st.top.toLocaleString("en-US")} m`;
    if (!$("counts")) return;
    const n = st.runs, rows = [["初级", n.easy, "background:#22b35a;border-radius:50%"], ["中级", n.intermediate, "background:#1f6fe5"], ["高级", n.advanced, "background:#15171c;transform:rotate(45deg) scale(.8)"], ["专家", n.expert, "background:#15171c;transform:rotate(45deg) scale(.8);box-shadow:5px -5px 0 #15171c;margin-right:9px"]];
    $("counts").innerHTML = rows.map(([k, v, css]) => `<span><i class="d" style="${css}"></i>${tr(k)} ${v}</span>`).join("");
  }).catch(() => {});

  await status("生成山体、画雪道…");
  const T = new Terrain(R);
  markMoguls(R.runs, (x, z) => T.heightAt(x, z)); // run.moguls (snow-core.js): the runs with bumps get the mogul icon
  // The whole resort from the air: whole around its runs, lifts and bases, fading into the paper past them.
  const villages = R.places.filter((p) => p.kind === "village");
  const reach = [...R.runs.flatMap((r) => r.pts), ...R.lifts.flatMap((l) => l.pts), ...villages.map((p) => [p.x, p.z])];
  const ext = (k, f) => f(...reach.map((p) => p[k]));
  const air = new Aerial(renderer, { scene, camera, exag: EXAG, root: "../" }).layers({
    T, R, id: RESORT_ID, lifts: R.lifts, lodges: villages, keep: [ext(0, Math.min) - 200, ext(0, Math.max) + 200, ext(1, Math.min) - 200, ext(1, Math.max) + 200],
  });
  // The picture holds its own light; these light the stations and the lodges, and follow the hour.
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd9d0c2, 1.4);
  const sun = new THREE.DirectionalLight(0xfff4e6, 1.8);
  scene.add(hemi, sun);

  // Light the scene for a moment in time and a kind of weather: the picture is tinted (warm low sun, blue
  // night, greyer under cloud); the lights follow the sun.
  const tint = new THREE.Color();
  const look = { live: true, date: new Date(), kind: "clear", temp: null };
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${RESORT.lat}&longitude=${RESORT.lon}&current=temperature_2m,weather_code,cloud_cover&timezone=${encodeURIComponent(RESORT.tz)}`;
  const fetchWeather = async () => {
    try {
      const w = await (await fetch(weatherUrl)).json();
      look.kind = weatherKind(w.current.weather_code, w.current.cloud_cover);
      look.temp = w.current.temperature_2m;
    } catch { /* offline: keep the last weather */ }
  };
  const applyLook = () => {
    const s0 = solar(look.date, RESORT.lat, RESORT.lon), elDeg = (s0.el * 180) / Math.PI;
    const dir = sunVector(s0), p = palette(elDeg, look.kind), day = dir.y > 0.02;
    const lightDir = day ? dir : new THREE.Vector3(0.3, 0.5, -0.4).normalize(); // moonlight at night
    sun.position.copy(lightDir).multiplyScalar(1000);
    sun.color.copy(day ? p.sun : new THREE.Color(0x8fa6e0));
    sun.intensity = day ? Math.min(2, p.si * 0.6) : 0.4;
    hemi.intensity = day ? 1.4 : 0.6;
    tint.set(day ? 0xffffff : 0x8391ad);
    if (day && elDeg < 10) tint.lerp(new THREE.Color(0xf3d6b8), 1 - Math.max(0, elDeg) / 10);
    if (look.kind === "overcast" || look.kind === "snow") tint.multiplyScalar(0.93);
    air.groundU.uTint.value.copy(tint);
    const local = look.date.toLocaleTimeString("zh-CN", { timeZone: RESORT.tz, hour: "2-digit", minute: "2-digit" });
    // the weather bar: the owner's icon for the sky, now or the hour you're previewing
    $("nowIcon").src = `../assets/icons/${{ clear: day ? "sunny" : "partly", cloudy: "partly", overcast: "cloudy", snow: "snow_now" }[look.kind] || "cloudy"}.png?v=1`;
    $("nowText").textContent = `${tr(look.live ? "现在" : "预览")} · ${tr(WEATHER_ZH[look.kind])}${look.temp !== null && look.live ? `  ${Math.round(look.temp)}°C` : ""}`;
    $("nowTime").textContent = local;
  };
  await fetchWeather();
  applyLook();
  setInterval(() => { if (look.live) { look.date = new Date(); applyLook(); } }, 60000);
  // Preview: drag the hour, pick the weather; 回到实时 goes back to now.
  const hourOf = (d) => +d.toLocaleString("en-US", { timeZone: RESORT.tz, hour: "numeric", hour12: false }) % 24;
  // The panel: slide to any hour (local), tap a weather; each changes on its own. 实时 brings back now and the
  // real weather together. Sunrise and sunset sit on the slider where they fall today.
  const fmtH = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
  const hourNow = () => { const d = new Date(), [h, m] = d.toLocaleTimeString("en-GB", { timeZone: RESORT.tz, hour: "2-digit", minute: "2-digit" }).split(":"); return +h + m / 60; };
  const sync = () => {
    const h = look.live ? hourNow() : +$("hour").value;
    if (look.live) $("hour").value = h;
    $("tpTime").textContent = fmtH(h);
    $("tpLive").classList.toggle("on", look.live);
    document.querySelectorAll("[data-wx]").forEach((b) => b.classList.toggle("on", b.dataset.wx === look.kind));
  };
  { // sunrise and sunset today: where the sun crosses the horizon
    const day0 = new Date(); let rise = 7, set = 17, prev = null;
    for (let q = 0; q < 96; q++) { const h = q / 4, d = new Date(day0.getTime() + (h - hourNow()) * 3600000), up = solar(d, RESORT.lat, RESORT.lon).el > 0;
      if (prev !== null && up !== prev) up ? (rise = h) : (set = h); prev = up; }
    const at = (id, h) => ($(id).style.left = `${(h / 23.75) * 100}%`);
    at("tpRise", rise); at("tpNoon", 12); at("tpSet", set);
  }
  $("hour").addEventListener("input", () => {
    look.live = false;
    look.date = new Date(Date.now() + (+$("hour").value - hourNow()) * 3600000);
    applyLook(); sync();
  });
  document.querySelectorAll("[data-wx]").forEach((b) => b.addEventListener("click", () => {
    if (look.live) { look.live = false; $("hour").value = hourNow(); } // keep the time where it is
    look.kind = b.dataset.wx; applyLook(); sync();
  }));
  $("tpLive").addEventListener("click", async () => { look.live = true; look.date = new Date(); await fetchWeather(); applyLook(); sync(); });
  sync();
  $("now").addEventListener("click", () => $("timePanel").classList.toggle("show"));

  const all = R.runs.flatMap((r) => r.pts);
  const cx = all.reduce((a, p) => a + p[0], 0) / all.length, cz = all.reduce((a, p) => a + p[1], 0) / all.length;
  const span = Math.max(Math.max(...all.map((p) => p[0])) - Math.min(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1])) - Math.min(...all.map((p) => p[1])));
  // Which way the resort faces: from the middle of its runs toward its bases. Copper keeps its view.
  const vil = R.places.filter((p) => p.kind === "village");
  let rot = { c: 1, s: 0 };
  if (RESORT_ID !== "copper" && vil.length) {
    const bx = vil.reduce((a, p) => a + p.x, 0) / vil.length - cx, bz = vil.reduce((a, p) => a + p.z, 0) / vil.length - cz;
    const want = Math.atan2(bz, bx), copper = Math.atan2(-7800, 3200); // the hero camera's bearing at Copper
    if (Math.hypot(bx, bz) > 200) rot = { c: Math.cos(want - copper), s: Math.sin(want - copper) };
  }
  center = { x: cx, z: cz, y: T.heightAt(cx, cz), k: Math.min(1.6, Math.max(0.4, span / 4850)), rot };
  setView("hero");
  $("status").remove();

  const basePins = R.places.filter((p) => p.kind === "village").map((base) => {
    const item = pin(`<b><img class="pi" src="../assets/icons/lodge.png?v=1" alt="">${base.name}</b><i></i>`, "pin", new THREE.Vector3(base.x, T.heightAt(base.x, base.z) * EXAG + 60, base.z), () => openBase(base));
    item.base = base;
    return item;
  });
  $("baseClose").addEventListener("click", () => {
    $("base").classList.remove("show");
    basePins.forEach((p) => p.el.classList.remove("on"));
    setView("hero");
  });

  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  const toggle = (id, fn) => $(id).addEventListener("click", () => { $(id).classList.toggle("on"); fn($(id).classList.contains("on")); });
  toggle("spin", (on) => (controls.autoRotate = on));
  toggle("runs", (on) => (air.runLayer.visible = on));
  toggle("lifts", (on) => (air.liftLayer.visible = on));
  renderer.domElement.addEventListener("pointerdown", () => { controls.autoRotate = false; $("spin").classList.remove("on"); fold(); $("timePanel").classList.remove("show"); });
  // The two round buttons: tap one to open its pop-up (the other folds); choosing a view or tapping the map
  // folds them; they fold themselves after a while.
  let foldT = 0;
  const fold = () => { $("bar").classList.remove("open"); $("layerBar").classList.remove("open"); clearTimeout(foldT); };
  const keep = () => { clearTimeout(foldT); foldT = setTimeout(fold, 5000); };
  for (const [fab, box, other] of [["viewFab", "bar", "layerBar"], ["layerFab", "layerBar", "bar"]])
    $(fab).addEventListener("click", () => { $(other).classList.remove("open"); $(box).classList.toggle("open"); keep(); });
  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => setTimeout(fold, 250)));
  for (const id of ["spin", "runs", "lifts"]) $(id).addEventListener("click", keep);
  $("compassBtn").addEventListener("click", () => setView("hero"));

  // ---------- A base, flown down to: 10 s around it, then pick a lift ----------
  const graph = buildGraph(R, (x, z) => T.heightAt(x, z));
  air.graph = graph;
  let mini = null; // { base, lifts, t0, intro }
  let leaving = null; // flying back up: the whole mountain's camera place
  const liftsAt = (base) => R.lifts.filter((l) => Math.hypot(l.pts[0][0] - base.x, l.pts[0][1] - base.z) < BASE_RADIUS)
    .sort((a, b) => b.rise - a.rise);
  const runsFromTop = (l) => {
    const top = l.pts[l.pts.length - 1], seen = new Map();
    for (const r of R.runs) if (r.name && Math.hypot(r.pts[0][0] - top[0], r.pts[0][1] - top[1]) < 160 && !seen.has(r.name)) seen.set(r.name, r);
    return [...seen.values()];
  };
  const SYMBOL = { easy: '<span class="lv easy"></span>', intermediate: '<span class="lv intermediate"></span>', advanced: '<span class="lv advanced"></span>', expert: '<span class="lv expert"></span>' };
  const LEVEL_ZH = { easy: "绿", intermediate: "蓝", advanced: "黑", expert: "双黑" };
  // Lift facts used by the tags, the cards and the detail sheet.
  function liftInfo(l) {
    const top = l.pts[l.pts.length - 1], runs = runsFromTop(l);
    const count = {};
    runs.forEach((r) => (count[r.level] = (count[r.level] || 0) + 1));
    const len = l.length || 0, mins = Math.max(1, Math.round(len / 4.5 / 60));
    const next = [];
    for (const o of R.lifts) {
      if (o === l || o.rise < 40) continue;
      const rt = planRoute(graph, [graph.liftNodes.get(l).top], [graph.liftNodes.get(o).bottom], "intermediate");
      if (rt && rt.legs.every((g) => g.type !== "lift") && rt.seconds < 15 * 60) {
        const via = rt.legs.filter((g) => g.type === "run").map((g) => g.run.name).filter((n, i, all) => n && n !== all[i - 1]);
        next.push({ o, rt, via });
      }
    }
    next.sort((a, b) => a.rt.seconds - b.rt.seconds);
    return {
      l, runs, next, mins, beginner: l.rise < 40,
      what: l.rise < 40 ? "初学者短缆车" : `${(len / 1000).toFixed(1)} 公里 · 约 ${mins} 分钟`,
      km: (len / 1000).toFixed(1),
      alt: Math.round(T.data.hmin + T.heightAt(top[0], top[1])),
      can: LEVELS.filter((k) => count[k]).map((k) => `<span class="cnt">${SYMBOL[k]}${count[k]}</span>`).join("") || "<span class=cnt>没有直接出发的雪道</span>",
    };
  }
  const tagBox = $("liftTags"), cards = $("liftCards");
  // In a party with someone else in it, "坐这条上山" becomes "约大家一起坐".
  const together = () => party.in && party.members().length > 0;
  setInterval(() => { const k = together() ? "约大家一起坐 ›" : "坐这条上山 ›"; for (const b of cards.querySelectorAll(".liftCard .go")) if (b.dataset.k !== k) { b.dataset.k = k; b.textContent = tr(k); } }, 1000);
  function openBase(base) {
    const ls = liftsAt(base).filter((l) => RIDEABLE.includes(l.kind)); // carpets and drag lifts aren't ridden in the game
    // Seen from the base looking up its main lift: the camera flies down from the whole mountain to there,
    // then the turn starts and ends there.
    const main = [...ls].sort((a, b) => b.rise - a.rise)[0];
    const u0 = main ? air.facing(main) : 0;
    air.frame({ base, lifts: ls });
    air.flyFrom(leaving ? air.last : air.poseOf(camera.position, controls.target), FLY);
    leaving = null;
    controls.enabled = false;
    spin = u0;
    mini = { base, lifts: ls, info: new Map(ls.map((l) => [l, liftInfo(l)])), t0: performance.now() + FLY * 1000, intro: true, pick: null, spinTo: null, raise: 0, spin0: u0 };
    document.body.classList.add("mini"); party.setSub("base");
    document.body.classList.remove("picking", "detail");
    $("introSkip").hidden = false;
    $("miniTitle").textContent = base.name;
    $("miniKick").textContent = RESORT.name;
    $("miniSub").textContent = EN ? `${Math.round(T.heightAt(base.x, base.z) + (R.hmin || 0)).toLocaleString("en-US")} m · ${ls.length} lifts` : `海拔 ${Math.round(T.heightAt(base.x, base.z) + (R.hmin || 0)).toLocaleString("en-US")} m · 缆车 ${ls.length} 条`;
    $("planOut").hidden = true;
    document.querySelectorAll("[data-plan]").forEach((x) => x.classList.remove("on"));
    air.highlightFrom(null);
    air.focusLift(null);
    // Floating tags in the world, one per lift; tap one to pick it.
    tagBox.innerHTML = "";
    cards.innerHTML = "";
    for (const l of ls) {
      const info = mini.info.get(l);
      const tag = document.createElement("button");
      tag.className = "ltag" + (info.beginner ? " small" : "");
      tag.innerHTML = `<b><img class="pi" src="../assets/icons/lift.png?v=1" alt="">${l.name}</b><small>${info.beginner ? "初学者" : `${info.mins} 分钟 · ${info.alt} 米`}</small><i></i>`;
      tag.addEventListener("click", () => pickLift(l, { scroll: true }));
      tagBox.append(tag);
      info.tag = tag;
      const card = document.createElement("div");
      card.className = "liftCard";
      card.innerHTML = `<div class="row1"><b><img class="pi" src="../assets/icons/lift.png?v=1" alt="">${l.name}</b><span class="lvls">${info.can}</span></div>
        ${chips(info, info.next.length ? `<span><img src="${IC("lift")}" alt="">能接 ${info.next.length} 条缆车</span>` : "")}
        <div class="acts"><button class="more">详情</button><button class="go">坐这条上山 ›</button></div>`;
      card.addEventListener("click", (e) => { if (!e.target.closest("button")) pickLift(l, { scroll: true }); });
      card.querySelector(".more").addEventListener("click", () => { pickLift(l, { scroll: true }); openDetail(true); });
      card.querySelector(".go").addEventListener("click", () => { if (together()) party.callLift(l.name, RESORT_ID, R.name); else go(l); });
      cards.append(card);
      info.card = card;
    }
  }
  function endIntro() {
    if (!mini) return;
    mini.intro = false;
    $("introSkip").hidden = true;
    document.body.classList.add("picking");
    cards.scrollLeft = 0;
    pickLift(mini.lifts[0], { scroll: false });
  }
  // One selection, three views of it: the tag in the world, the card at the bottom, the lit runs.
  function pickLift(l, { scroll = false, route = null } = {}) {
    if (!mini || !l) return;
    const changed = mini.pick !== l;
    mini.pick = l;
    air.focusLift(l);
    for (const [x, info] of mini.info) {
      info.tag.classList.toggle("on", x === l);
      info.card.classList.toggle("on", x === l);
    }
    if (route) { air.highlightRoute(route); air.aim(l, route); }
    else if (changed) { air.aim(l, [...air.highlightFrom(l).fromTop]); $("planOut").hidden = true; $("legend").hidden = false; document.querySelectorAll("[data-plan]").forEach((x) => x.classList.remove("on")); }
    if (changed) {
      // Turn the model so the lift is seen from below, the short way round.
      let u = air.facing(l);
      u += Math.round(spin - u);
      mini.spinTo = u;
      navigator.vibrate?.(8);
    }
    if (scroll) { mini.scrolling = performance.now(); mini.info.get(l).card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); }
    if (document.body.classList.contains("detail")) fillDetail();
  }
  // Swiping the cards picks the one that comes to rest in the middle.
  let settle = 0;
  cards.addEventListener("scroll", () => {
    clearTimeout(settle);
    settle = setTimeout(() => {
      if (!mini || mini.intro || performance.now() - (mini.scrolling || 0) < 700) return;
      const mid = cards.getBoundingClientRect().left + cards.clientWidth / 2;
      let best = null, bd = Infinity;
      for (const [l, info] of mini.info) {
        const r = info.card.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid);
        if (d < bd) { bd = d; best = l; }
      }
      if (best && best !== mini.pick) pickLift(best);
    }, 90);
  }, { passive: true });

  // Small paper chips, each with the owner's icon: how long, how far up, and so on.
  const IC = (n) => `../assets/icons/${n}.png?v=1`;
  const chips = (info, more) => info.beginner ? `<div class="chips"><span><img src="${IC("ski")}" alt="">初学者短缆车</span></div>` : `<div class="chips"><span><img src="${IC("trailmap")}" alt="">${info.km} 公里</span><span><img src="${IC("season")}" alt="">约 ${info.mins} 分钟</span><span><img src="${IC("alpine")}" alt="">到 ${info.alt} 米</span>${more || ""}</div>`;
  // Detail: the card grows into a sheet; the model dims and moves up a little but keeps its size.
  function fillDetail() {
    const info = mini.info.get(mini.pick), l = info.l;
    const byLevel = LEVELS.map((k) => info.runs.filter((r) => r.level === k)).filter((g) => g.length);
    $("detailBody").innerHTML = `<h2><img class="pi" src="../assets/icons/lift.png?v=1" alt="">${l.name}</h2>${chips(info)}
      <h3><img src="${IC("layer_runs")}" alt="">山顶直接出发的雪道</h3>${byLevel.length ? byLevel.map((g) => `<p class="runs">${g.map((r) => `<span>${SYMBOL[r.level]}${r.name}${r.moguls ? `<img class="mog" src="${IC("moguls")}" alt="蘑菇道" title="蘑菇道">` : ""}</span>`).join("")}</p>`).join("") : "<p class=meta>没有直接出发的雪道</p>"}
      ${info.runs.some((r) => r.moguls) ? `<p class="hint"><img class="mog" src="${IC("moguls")}" alt="">蘑菇道：有雪包（猫跳）的雪道</p>` : ""}
      ${info.next.length ? `<h3><img src="${IC("lift")}" alt="">上去后能接 ${info.next.length} 条缆车（蓝道以内）</h3>${info.next.map((n) => `<div class="nx"><img class="pi" src="../assets/icons/lift.png?v=1" alt=""><b>${n.o.name}</b><small>滑 ${n.via.slice(0, 3).join(" → ")}${n.via.length > 3 ? " …" : ""}</small><span class="mins">滑 ${Math.max(1, Math.round(n.rt.seconds / 60))} 分钟</span></div>`).join("")}` : ""}
      <p class="hint">山上最亮的是从山顶直接出发的雪道，半亮的是滑下去还能接上的。</p>`;
    $("detailGo").textContent = `坐 ${l.name} 上山 ›`;
  }
  function openDetail(on) {
    if (on) fillDetail();
    document.body.classList.toggle("detail", on);
  }
  $("detailClose").addEventListener("click", () => openDetail(false));
  $("dim").addEventListener("click", () => openDetail(false));
  $("detailGo").addEventListener("click", () => go(mini.pick));
  function go(l) {
    // Ask for motion access on this tap (iOS), so turning the phone looks around on the chair.
    if (typeof DeviceOrientationEvent?.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().catch(() => "denied").finally(() => go2(l));
      return;
    }
    go2(l);
  }
  function go2(l) {
    if (mini?.base) addStep(RESORT_ID, { k: "base", name: mini.base.name });
    const info = mini?.info?.get(l); // the lift ticket the ride page punches while it loads
    liftTicket({ resort: RESORT_ID, name: l.name, kind: l.kind, seats: l.seats || 4, bubble: !!l.bubble, km: l.length ? (l.length / 1000).toFixed(1) : 0, mins: info?.mins || Math.max(1, Math.round((l.length || 0) / 270)) });
    location.href = `../look.html?lift=${encodeURIComponent(l.name)}&resort=${RESORT_ID}`; }

  // Quick plans along the top: a loop from this base at a level, lit run by run.
  document.querySelectorAll("[data-plan]").forEach((b) => b.addEventListener("click", () => {
    if (!mini || mini.intro) return;
    const level = b.dataset.plan, out = $("planOut");
    const was = b.classList.contains("on");
    document.querySelectorAll("[data-plan]").forEach((x) => x.classList.toggle("on", !was && x === b));
    if (was) { out.hidden = true; $("legend").hidden = false; air.highlightFrom(mini.pick); return; }
    let best = null;
    for (const l of mini.lifts) {
      const back = mini.lifts.map((x) => graph.liftNodes.get(x).bottom);
      const route = planRoute(graph, [graph.liftNodes.get(l).top], back, level);
      if (route && route.legs.some((g) => g.type === "run" && g.run.level === level) && (!best || route.seconds < best.route.seconds)) best = { l, route };
      if (!best && route) best = { l, route };
    }
    out.hidden = false;
    $("legend").hidden = true;
    if (!best) { out.textContent = "这个 base 没有合适的一圈，换个水平试试"; return; }
    const legs = best.route.legs.filter((g) => g.type === "run");
    const names = legs.map((g) => g.run.name || "雪道").filter((n, i, all) => n !== all[i - 1]);
    out.innerHTML = `推荐一圈：坐 <b>${best.l.name}</b> → 滑 ${names.join(" → ")} · 下山约 ${Math.max(1, Math.round(best.route.seconds / 60))} 分钟`;
    mini.pick = null; // so the lift's own highlight does not replace the route's
    pickLift(best.l, { scroll: true, route: legs.map((g) => g.run) });
  }));
  $("introSkip").addEventListener("click", endIntro);
  $("replay").addEventListener("click", () => {
    if (!mini) return;
    openDetail(false);
    mini.intro = true; mini.t0 = performance.now(); mini.spinTo = null;
    air.aim(null);
    air.focusLift(null);
    spin = spin % 1;
    mini.spin0 = spin;
    document.body.classList.remove("picking");
    $("introSkip").hidden = false;
  });
  // Back to the whole mountain: every run and lift as it was, and the camera flies back up.
  $("miniBack").addEventListener("click", () => {
    mini = null; document.body.classList.remove("mini", "picking", "detail"); party.setSub("");
    air.focusLift(null); air.showAll();
    const v = VIEWS.hero(center);
    leaving = air.poseOf(new THREE.Vector3(...v.pos), new THREE.Vector3(...v.target));
    air.flyFrom(air.last, FLY * 0.8);
  });
  addEventListener("resize", () => air.resize());
  window.__mtn = { scene, renderer, camera, controls, air, T, R, look, applyLook, THREE }; // test hook
  window.__mini = { air, get mini() { return mini; }, endIntro, openDetail, pickLift: (name) => pickLift(mini.lifts.find((l) => l.name === name), { scroll: true }) }; // test hook
  // Drag to turn the miniature after the intro.
  let drag = null, spin = 0;
  renderer.domElement.addEventListener("pointerdown", (e) => { if (mini && !mini.intro) { drag = { x: e.clientX, s: spin }; mini.spinTo = null; } });
  addEventListener("pointermove", (e) => { if (drag) spin = drag.s - (e.clientX - drag.x) / 600; });
  addEventListener("pointerup", () => { drag = null; });
  // Tags in the world; the chosen lift's first, then longer lifts; a tag that would cover one already
  // placed is hidden until the model turns.
  const placeTags = () => {
    const placed = [];
    const order = [...mini.info.values()].sort((a, b) => (b.l === mini.pick) - (a.l === mini.pick));
    for (const info of order) {
      const p = air.screenOf(info.l), tag = info.tag;
      if (p) {
        tag.w ||= tag.offsetWidth; tag.h ||= tag.offsetHeight;
        const r = { x0: p.x - tag.w / 2, x1: p.x + tag.w / 2, y0: p.y - tag.h, y1: p.y };
        if (placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) { tag.style.visibility = "hidden"; continue; }
        placed.push(r);
        tag.style.visibility = "";
        tag.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      } else tag.style.visibility = "hidden";
    }
  };

  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  let t = 0, last = performance.now();
  renderer.setAnimationLoop((now) => {
    t += (now - last) / 1000; last = now;
    if (mini) {
      const dt = Math.min(0.05, (now - (mini.last || now)) / 1000);
      mini.last = now;
      if (mini.intro) {
        const u = Math.min(1, Math.max(0, now - mini.t0) / 10000); // one turn in ten seconds, once down
        spin = (mini.spin0 || 0) + ease(u);
        if (u >= 1) endIntro();
      } else if (mini.spinTo != null) {
        spin += (mini.spinTo - spin) * (1 - Math.exp(-dt * 3.5));
        if (Math.abs(mini.spinTo - spin) < 1e-4) mini.spinTo = null;
      }
      const glide = 1 - Math.exp(-dt * 3.5); // glide and zoom to the chosen lift
      air.focus.lerp(air.focusTo, glide);
      air.size += (air.sizeTo - air.size) * glide;
      // A fixed frame between the top bar and the cards, so the model never shrinks; the detail
      // sheet only raises it.
      const topPx = 100, botPx = 150, want = document.body.classList.contains("detail") ? 0.2 : 0;
      mini.raise += (want - mini.raise) * (1 - Math.exp(-dt * 6));
      air.orbit(spin, Math.max(0.4, 1 - (topPx + botPx) / innerHeight), topPx / innerHeight, mini.raise);
      placeTags();
      air.render();
      return;
    }
    if (leaving) { // flying back up; at the top the controls take over from the same place
      if (!air.glide(leaving)) { setView("hero"); leaving = null; controls.enabled = true; }
      air.render();
      placePins();
      return;
    }
    controls.update();
    // the painted compass turns with the view (its needle leans 38° east in the picture)
    { const ci = document.querySelector("#compassBtn img"); if (ci) ci.style.transform = `rotate(${(controls.getAzimuthalAngle() * 180 / Math.PI - 38).toFixed(1)}deg)`; }
    air.render();
    placePins();
  });
}
main().catch((e) => { $("status").textContent = `加载失败：${e.message}`; console.error(e); });
translatePage(); // English, if chosen on the start page
document.getElementById("navBtn").onclick = () => openNav("../");
document.querySelector("#navBtn img").src = `../assets/icons/${myAvatar()}.png?v=1`;
document.getElementById("backBtn").onclick = () => { location.href = "../start.html?tab=resort"; };
