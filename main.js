// 雪场预滑 · Ski Pre-Run. Explore a real resort, plan a route through lifts and runs, then ride it:
// on the chair with the runs below named, and down each run with turn-by-turn signs.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Terrain, sky, lights, treeMaskFn, forest, runLayers, highlight, signs, Lifts, LEVEL, at, chairMesh } from "./world.js";
import { Rider, riderModel, Tracks, Spray } from "./rider.js";
import { buildGraph, planRoute, nodesNear, lengthAlong, LEVELS } from "./route.js";
import { applyStyle } from "./styles.js";

const $ = (id) => document.getElementById(id);
const icon = (level) => `<i class="lv ${level}"></i>`;
const fmtLen = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} 公里` : `${Math.round(m)} 米`);
const fmtMin = (s) => (s < 60 ? "1 分钟内" : `${Math.round(s / 60)} 分钟`);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const settings = Object.assign({ kind: "ski", level: "intermediate" }, JSON.parse(localStorage.getItem("prerun") || "{}"));
const saveSettings = () => localStorage.setItem("prerun", JSON.stringify(settings));

// ---------- Renderer ----------
const canvas = $("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd8ebe8, 4000, 22000);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 60000);
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, { enableDamping: true, maxPolarAngle: 1.38, minDistance: 150, maxDistance: 11000, screenSpacePanning: false });
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let T, R, graph, sun, liftsView, runView, signGroup, routeGroup = null;
let draw = (s, c) => renderer.render(s, c);

// ---------- Labels ----------
const labels = [];
function label(html, cls, pos, when = () => true) {
  const el = document.createElement("div");
  el.className = `label ${cls}`;
  el.innerHTML = html;
  $("labels").appendChild(el);
  const item = { el, pos, when };
  labels.push(item);
  return item;
}
function dropLabel(item) {
  if (!item) return;
  item.el.remove();
  labels.splice(labels.indexOf(item), 1);
}
const v3 = new THREE.Vector3();
function updateLabels() {
  for (const l of labels) {
    let show = l.when(l.pos);
    if (show) {
      v3.copy(l.pos).project(camera);
      show = v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05;
    }
    l.el.style.display = show ? "block" : "none";
    if (show) l.el.style.transform = `translate(${(v3.x * 0.5 + 0.5) * innerWidth}px, ${(-v3.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
  }
}
const camDist = (p) => camera.position.distanceTo(p);

// ---------- Resort helpers ----------
const ptV = ([x, z], lift = 0) => new THREE.Vector3(x, T.heightAt(x, z) + lift, z);
const lastPt = (pts) => pts[pts.length - 1];
function nameOfPlaceNear(x, z, radius = 250) {
  let best = null;
  for (const p of R.places) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < radius && (!best || d < best.d)) best = { name: p.name, d };
  }
  for (const l of R.lifts) {
    const d = Math.hypot(l.pts[0][0] - x, l.pts[0][1] - z);
    if (d < 150 && (!best || d < best.d)) best = { name: `${l.name} 缆车站`, d };
  }
  return best?.name;
}
function runsFrom(x, z, radius = 140) {
  const seen = new Set();
  return R.runs.filter((r) => r.name && Math.hypot(r.pts[0][0] - x, r.pts[0][1] - z) < radius && !seen.has(r.name) && seen.add(r.name))
    .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
}
function liftToRun(run) {
  const [x, z] = run.pts[0];
  return R.lifts.map((l) => ({ l, d: Math.hypot(lastPt(l.pts)[0] - x, lastPt(l.pts)[1] - z) })).filter((o) => o.d < 450).sort((a, b) => a.d - b.d)[0]?.l;
}
function nearestOnRun(run, x, z, from = 0, to = run.pts.length - 1) {
  let best = Infinity, bi = from;
  for (let i = from; i <= to; i++) {
    const d = (run.pts[i][0] - x) ** 2 + (run.pts[i][1] - z) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  return { i: bi, d: Math.sqrt(best) };
}
function nearestRun(x, z, max = 30) {
  let best = null;
  for (const run of R.runs) {
    if (!run.name) continue;
    const n = nearestOnRun(run, x, z);
    if (n.d < max && (!best || n.d < best.d)) best = { run, ...n };
  }
  return best;
}
const runDir = (run, i) => {
  const a = run.pts[Math.max(0, i - 1)], b = run.pts[Math.min(run.pts.length - 1, i + 2)];
  return Math.atan2(b[0] - a[0], b[1] - a[1]);
};
const angleDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const legPiece = (l, from = l.from) => (l.type === "lift" ? { pts: l.lift.pts, color: 0xd9534f } : { pts: l.run.pts.slice(from, l.to + 1), level: l.run.level });

// ---------- Screens ----------
let mode = "intro";
function show(...ids) {
  for (const id of ["mapbar", "info", "plan", "list", "hud", "ride", "card", "overviewBar"]) $(id).classList.toggle("hidden", !ids.includes(id));
}
function mapLook() {
  if (mode === "map") scene.userData.onMap?.();
  rider.model.visible = false;
  sun.castShadow = false;
  runView.mapLayer.visible = true;
  runView.skiLayer.visible = false;
  signGroup.visible = false;
  if (!scene.userData.noFog) { scene.fog.near = 5000 * (scene.userData.fogScale || 1); scene.fog.far = 24000 * (scene.userData.fogScale || 1); }
  camera.near = 2; camera.fov = 50; camera.updateProjectionMatrix();
}
function slopeLook() {
  scene.userData.onSlope?.();
  rider.model.visible = true;
  sun.castShadow = true;
  runView.mapLayer.visible = false;
  runView.skiLayer.visible = true;
  signGroup.visible = true;
  scene.fog.near = 700 * (scene.userData.fogScale || 1); scene.fog.far = 7000 * (scene.userData.fogScale || 1);
  camera.near = 0.5; camera.updateProjectionMatrix();
}

// ---------- Map mode ----------
function enterMap() {
  mode = "map";
  journey = null;
  clearAbove();
  show("mapbar");
  mapLook();
  clearTimeout(arrivalTimer);
  Object.assign(controls, { minDistance: 150, maxDistance: 11000, autoRotate: false });
  controls.enabled = true;
  setRoute(null);
}

function flyTo(x, z, distance = 1600) {
  const y = T.heightAt(x, z);
  const off = camera.position.clone().sub(controls.target);
  off.y = Math.max(off.y, 0.1);
  off.setLength(distance);
  if (off.y < distance * 0.45) { off.y = distance * 0.55; off.setLength(distance); }
  controls.target.set(x, y, z);
  camera.position.copy(controls.target).add(off);
}

function select(sel) {
  const box = $("info");
  show("mapbar", "info");
  const actions = [];
  let title = "", meta = "", extra = "";
  if (sel.run) {
    const run = sel.run;
    setRoute([{ pts: run.outline || run.pts, level: run.level }]);
    title = `${icon(run.level)}${esc(run.name || "无名雪道")}`;
    meta = `${LEVEL[run.level].zh}${run.area ? " · 林间/开阔区" : ""} · ${fmtLen(run.length)} · 落差 ${run.drop} 米`;
    const lift = liftToRun(run);
    const end = nameOfPlaceNear(...lastPt(run.pts));
    extra = `${lift ? `坐 <b>${esc(lift.name)}</b> 上来` : "从别的雪道接过来"}${end ? `，滑完到 <b>${esc(end)}</b>` : ""}`;
    actions.push(["▶ 从山顶滑", () => startJourney([{ type: "run", run, from: 0, to: run.pts.length - 1, length: run.length }]), "go"]);
    actions.push(["规划到这里的路线", () => openPlan(null, { run })]);
  } else if (sel.lift) {
    const lift = sel.lift;
    setRoute([{ pts: lift.pts, color: 0xd9534f }]);
    title = `${icon("lift")}${esc(lift.name)}`;
    meta = `缆车 · ${fmtLen(lift.length)} · 爬升 ${lift.rise} 米 · 山顶海拔 ${T.altitude(T.heightAt(...lastPt(lift.pts)))} 米`;
    const runs = runsFrom(...lastPt(lift.pts), 200);
    extra = runs.length ? `山顶能滑：${runs.slice(0, 5).map((r) => `${icon(r.level)}${esc(r.name)}`).join("　")}` : "";
    actions.push(["🚡 坐上去", () => startJourney([{ type: "lift", lift, length: lift.length }]), "go"]);
    actions.push(["规划到这里的路线", () => openPlan(null, { lift })]);
  } else if (sel.place) {
    const p = sel.place;
    setRoute(null);
    title = `${p.kind === "village" ? "🏠" : "🍴"} ${esc(p.name)}`;
    meta = p.kind === "village" ? "山脚村落 · 缆车和雪具大厅" : "餐厅";
    actions.push(["从这里出发", () => openPlan({ place: p }, null), "go"]);
    actions.push(["规划到这里", () => openPlan(null, { place: p })]);
  }
  box.querySelector(".title").innerHTML = title;
  box.querySelector(".meta").textContent = meta;
  box.querySelector(".extra").innerHTML = extra;
  const row = box.querySelector(".actions");
  row.innerHTML = "";
  for (const [text, fn, cls] of actions) row.append(button(text, fn, cls));
}

function button(html, fn, cls = "") {
  const b = document.createElement("button");
  b.innerHTML = html;
  b.className = `btn ${cls}`;
  b.addEventListener("click", fn);
  return b;
}

// Tap on the map: the nearest run, lift or place to the tapped point.
const raycaster = new THREE.Raycaster();
let terrainMesh, downAt = null;
canvas.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener("pointerup", (e) => {
  if (mode !== "map" || !downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 8) return;
  raycaster.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  const hit = raycaster.intersectObject(terrainMesh)[0];
  if (!hit) return;
  const reach = Math.max(35, camDist(hit.point) / 35);
  const { x, z } = hit.point;
  let best = null;
  const consider = (d, sel) => { if (d < reach && (!best || d < best.d)) best = { d, sel }; };
  for (const p of R.places) consider(Math.hypot(p.x - x, p.z - z) * 0.7, { place: p });
  for (const l of R.lifts) for (const pt of l.pts) consider(Math.hypot(pt[0] - x, pt[1] - z) * 0.9, { lift: l });
  for (const r of R.runs) for (const pt of r.outline || r.pts) consider(Math.hypot(pt[0] - x, pt[1] - z), { run: r });
  if (best) select(best.sel);
  else { setRoute(null); show("mapbar"); }
});

function setRoute(pieces, fit = false) {
  if (routeGroup) { scene.remove(routeGroup); routeGroup.traverse((o) => o.geometry?.dispose()); }
  routeGroup = pieces ? highlight(T, pieces) : null;
  if (routeGroup) scene.add(routeGroup);
  if (fit && pieces) {
    const all = pieces.flatMap((p) => p.pts);
    const xs = all.map((p) => p[0]), zs = all.map((p) => p[1]);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
    flyTo((Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...zs) + Math.min(...zs)) / 2, Math.max(1200, span * 1.5));
  }
}

// ---------- List ----------
function renderList() {
  const q = $("search").value.trim().toLowerCase();
  const ul = $("items");
  ul.innerHTML = "";
  const rows = [
    ...R.places.map((p) => ({ sel: { place: p }, name: p.name, sym: p.kind === "village" ? "🏠" : "🍴", meta: p.kind === "village" ? "山脚" : "餐厅" })),
    ...R.lifts.map((l) => ({ sel: { lift: l }, name: l.name, sym: icon("lift"), meta: `爬升 ${l.rise} 米` })),
  ];
  const seen = new Set();
  for (const r of R.runs) if (r.name && !seen.has(r.name) && seen.add(r.name)) rows.push({ sel: { run: r }, name: r.name, sym: icon(r.level), meta: `${fmtLen(r.length)} · 落差 ${r.drop} 米` });
  for (const row of rows.filter((r) => !q || r.name.toLowerCase().includes(q))) {
    const li = document.createElement("li");
    li.innerHTML = `${row.sym}<span>${esc(row.name)}</span><small>${row.meta}</small>`;
    li.addEventListener("click", () => {
      const s = row.sel, pts = s.run ? s.run.pts : s.lift ? s.lift.pts : [[s.place.x, s.place.z]];
      const mid = pts[Math.floor(pts.length / 2)];
      flyTo(mid[0], mid[1], 1500);
      select(s);
    });
    ul.append(li);
  }
}

// ---------- Route planner ----------
let planFrom = null, planTo = null, planned = null;
function endpointOptions() {
  const sym = { easy: "●", intermediate: "■", advanced: "◆", expert: "◆◆" };
  return [
    ...R.places.filter((p) => p.kind === "village").map((p) => ({ key: `p:${p.name}`, label: `🏠 ${p.name}`, place: p })),
    ...R.places.filter((p) => p.kind === "food").map((p) => ({ key: `p:${p.name}`, label: `🍴 ${p.name}`, place: p })),
    ...R.lifts.map((l) => ({ key: `l:${l.name}`, label: `🚡 ${l.name}`, lift: l })),
    ...[...new Map(R.runs.filter((r) => r.name).map((r) => [r.name, r])).values()].sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({ key: `r:${r.name}`, label: `${sym[r.level]} ${r.name}`, run: r })),
  ];
}
const optionKey = (o) => (o?.place ? `p:${o.place.name}` : o?.lift ? `l:${o.lift.name}` : o?.run ? `r:${o.run.name}` : "");
function openPlan(from, to) {
  if (from) planFrom = from;
  if (to) planTo = to;
  if (!planFrom) planFrom = { place: R.places.find((p) => p.name === "Center Village") || R.places[0] };
  show("mapbar", "plan");
  const opts = endpointOptions();
  for (const [id, cur] of [["planFrom", planFrom], ["planTo", planTo]]) {
    const sel = $(id);
    sel.innerHTML = (id === "planTo" ? `<option value="">选一个目的地…</option>` : "") + opts.map((o) => `<option value="${esc(o.key)}">${esc(o.label)}</option>`).join("");
    sel.value = optionKey(cur);
  }
  $("planLevel").value = settings.level;
  runPlan();
}
function fromNodes(o) {
  if (o.place) return nodesNear(graph, o.place.x, o.place.z, 250);
  if (o.lift) return [graph.liftNodes.get(o.lift).top];
  return [graph.runNodes.get(o.run)[0]];
}
function toNodes(o) {
  if (o.place) return nodesNear(graph, o.place.x, o.place.z, 220);
  if (o.lift) return [graph.liftNodes.get(o.lift).bottom];
  return [graph.runNodes.get(o.run).at(-1)];
}
function runPlan() {
  const opts = endpointOptions();
  planFrom = opts.find((o) => o.key === $("planFrom").value) || planFrom;
  planTo = opts.find((o) => o.key === $("planTo").value) || null;
  settings.level = $("planLevel").value;
  saveSettings();
  const out = $("planResult");
  planned = null;
  $("planGo").disabled = $("planWatch").disabled = true;
  if (!planTo) { out.innerHTML = `<p class="hint">选好目的地，就能看到怎么坐缆车、滑哪几条雪道过去。</p>`; setRoute(null); return; }
  let route = planRoute(graph, fromNodes(planFrom), toNodes(planTo), settings.level), harder = null;
  if (!route) {
    for (const lvl of LEVELS.slice(LEVELS.indexOf(settings.level) + 1)) {
      route = planRoute(graph, fromNodes(planFrom), toNodes(planTo), lvl);
      if (route) { harder = lvl; break; }
    }
  }
  if (!route) { out.innerHTML = `<p class="hint">没找到路线，可能是地图数据里缺了一段连接。</p>`; setRoute(null); return; }
  planned = route;
  $("planGo").disabled = $("planWatch").disabled = false;
  const steps = route.legs.filter((l) => l.type !== "skate");
  out.innerHTML = `${harder ? `<p class="warnline">按你的水平到不了，至少要走${LEVEL[harder].zh}雪道。</p>` : ""}
    <p class="total">约 ${fmtMin(route.seconds)} · ${steps.filter((l) => l.type === "lift").length} 段缆车 · ${steps.filter((l) => l.type === "run").length} 段雪道</p>
    <ol class="steps">${steps.map((l) => (l.type === "lift"
      ? `<li>${icon("lift")}<span>坐 <b>${esc(l.lift.name)}</b></span><small>${fmtLen(l.length)}</small></li>`
      : `<li>${icon(l.run.level)}<span>滑 <b>${esc(l.run.name || "无名雪道")}</b></span><small>${fmtLen(l.length)}</small></li>`)).join("")}</ol>`;
  setRoute(steps.map((l) => legPiece(l)), true);
}

// ---------- Journey: a chain of lift rides and runs ----------
const rider = { model: null, physics: null, tracks: null, spray: null };
let journey = null; // { legs, i, auto, started, top, dist }
let ride = null;
const keys = new Set();
addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

function buildRider() {
  if (rider.model) scene.remove(rider.model);
  rider.tracks?.dispose(scene);
  rider.model = riderModel(settings.kind);
  rider.model.visible = false;
  scene.add(rider.model);
  rider.physics = new Rider(T, settings.kind);
  rider.tracks = new Tracks(scene, T, settings.kind);
  $("push").textContent = settings.kind === "board" ? "单脚蹬" : "蹬";
}

function startJourney(legs, auto = false) {
  clearAbove();
  journey = { legs: legs.filter((l) => l.type !== "skate"), i: -1, auto, started: performance.now(), top: 0, dist: 0 };
  setRoute(null);
  rider.tracks.clear();
  rider.model.visible = false;
  nextLeg();
}

function nextLeg() {
  journey.i++;
  const leg = journey.legs[journey.i];
  if (!leg) return finishJourney();
  if (leg.type === "lift") startRide(leg.lift);
  else startRun(leg);
}

function startRun(leg) {
  mode = "ski";
  show("hud");
  const r = rider.physics;
  const here = nearestOnRun(leg.run, r.x, r.z, leg.from, Math.min(leg.to, leg.from + 30));
  const continuing = rider.model.visible && here.d < 90;
  const start = continuing ? here.i : leg.from;
  if (!continuing) {
    const [x, z] = leg.run.pts[start];
    r.place(x, z, runDir(leg.run, start), 2);
    rider.tracks.clear();
  }
  leg.progress = start;
  controls.enabled = false;
  slopeLook();
  $("hudRun").innerHTML = `${icon(leg.run.level)}${esc(leg.run.name || "无名雪道")}`;
  $("autoTag").classList.toggle("hidden", !journey.auto);
  if (!continuing) placeChase(true);
}

function stepRun(dt) {
  const leg = journey.legs[journey.i], run = leg.run, r = rider.physics;
  let steer = 0;
  if (keys.has("arrowleft") || keys.has("a")) steer -= 1;
  if (keys.has("arrowright") || keys.has("d")) steer += 1;
  if (stick.active) {
    steer = stick.x;
    if (journey.auto) { journey.auto = false; $("autoTag").classList.add("hidden"); } // touching the stick takes over
  }
  const near = nearestOnRun(run, r.x, r.z, Math.max(leg.from, leg.progress - 6), leg.to);
  if (near.d < 70) leg.progress = Math.max(leg.progress, near.i);
  let brake = holdBrake || stick.y > 0.45 || keys.has("s") || keys.has(" ") || keys.has("arrowdown");
  if (journey.auto && steer === 0) {
    const [tx, tz] = run.pts[Math.min(near.i + 4, leg.to)];
    steer = Math.max(-1, Math.min(1, -angleDiff(r.heading, Math.atan2(tx - r.x, tz - r.z)) * 2.5));
    brake = brake || r.speed > { easy: 11, intermediate: 14, advanced: 15, expert: 15 }[run.level];
  }
  const offPiste = near.d > 45 && !nearestRun(r.x, r.z, 30);
  r.step(dt, { steer, brake, push: holdPush || stick.y < -0.45 || keys.has("w") || keys.has("arrowup") || (journey.auto && r.speed < 4), offPiste });
  r.pose(rider.model);
  rider.tracks.add(r);
  const carve = Math.abs(r.steer) * r.speed;
  rider.spray.emit(r, brake && r.speed > 3 ? 160 : carve > 8 ? carve * 8 : 0, dt);
  journey.top = Math.max(journey.top, r.speed);
  journey.dist += r.speed * dt;
  hud(leg, near);
  if (leg.progress >= leg.to - 1 && near.d < 60) nextLeg();
}

function hud(leg, near) {
  const r = rider.physics;
  $("hudSpeed").textContent = Math.round(r.speed * 3.6);
  $("hudAlt").textContent = T.altitude(r.y);
  const secs = (performance.now() - journey.started) / 1000;
  $("hudTime").textContent = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
  const now = near.d < 35 ? leg.run : nearestRun(r.x, r.z, 30)?.run;
  $("hudNow").innerHTML = now ? (now === leg.run ? "在路线上" : `你在：${icon(now.level)}${esc(now.name)}`) : "雪道外 · 林间深雪";
  // Turn-by-turn: what to do at the end of this run.
  const left = lengthAlong(leg.run.pts, leg.progress, leg.to);
  const next = journey.legs[journey.i + 1];
  const here = `${icon(leg.run.level)}${esc(leg.run.name || "雪道")}`;
  let say;
  if (near.d > 60) {
    const [tx, tz] = leg.run.pts[Math.min(near.i + 3, leg.to)];
    say = `<b>偏离路线 ${Math.round(near.d)} 米</b> · 往${angleDiff(r.heading, Math.atan2(tx - r.x, tz - r.z)) > 0 ? "左" : "右"}回到 ${here}`;
  } else if (!next) say = left > 220 ? `沿 ${here} 再滑 ${fmtLen(left)} 到终点` : `<b>快到了</b> · 还有 ${fmtLen(left)}`;
  else if (left > 220) say = `沿 ${here} 滑 ${fmtLen(left)}，然后${next.type === "lift" ? `坐 <b>${esc(next.lift.name)}</b>` : `进 ${icon(next.run.level)}<b>${esc(next.run.name)}</b>`}`;
  else if (next.type === "lift") say = `<b>前方 ${Math.round(left)} 米</b> · 到 ${esc(next.lift.name)} 缆车站`;
  else {
    const turn = angleDiff(runDir(leg.run, leg.to), runDir(next.run, next.from));
    const way = Math.abs(turn) < 0.35 ? "直行" : turn > 0 ? "向左" : "向右";
    say = `<b>前方 ${Math.round(left)} 米 ${way}</b> · 进 ${icon(next.run.level)}${esc(next.run.name)}`;
  }
  $("cue").innerHTML = say;
  drawMinimap(leg);
}

// 360° thumbstick: left/right steers, push up to skate on the flat, pull down to brake.
let holdBrake = false, holdPush = false, holdFast = false;
const stick = { active: false, x: 0, y: 0, id: null };
{
  const base = $("stick"), knob = $("knob"), R = 48;
  const move = (e) => {
    const b = base.getBoundingClientRect();
    let dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    stick.x = dx / R; stick.y = dy / R;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  base.addEventListener("pointerdown", (e) => { e.preventDefault(); stick.active = true; stick.id = e.pointerId; base.setPointerCapture(e.pointerId); move(e); });
  base.addEventListener("pointermove", (e) => { if (stick.active && e.pointerId === stick.id) move(e); });
  const end = (e) => { if (e.pointerId !== stick.id) return; stick.active = false; stick.x = stick.y = 0; knob.style.transform = ""; };
  base.addEventListener("pointerup", end);
  base.addEventListener("pointercancel", end);
}
function holdButton(id, set) {
  const el = $(id);
  const on = (v) => (e) => { e.preventDefault(); set(v); el.classList.toggle("on", v); };
  el.addEventListener("pointerdown", on(true));
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) el.addEventListener(ev, on(false));
}
holdButton("brake", (v) => (holdBrake = v));
holdButton("push", (v) => (holdPush = v));
holdButton("faster", (v) => (holdFast = v));

function placeChase(snap, dt = 0.016) {
  const r = rider.physics;
  const back = new THREE.Vector3(-Math.sin(r.heading), 0, -Math.cos(r.heading));
  const want = new THREE.Vector3(r.x, r.y, r.z).addScaledVector(back, 6.5 + r.speed * 0.08);
  want.y = Math.max(T.heightAt(want.x, want.z) + 1.2, r.y + 2.6);
  if (snap) camera.position.copy(want);
  else camera.position.lerp(want, Math.min(1, dt * 4));
  camera.lookAt(r.x + Math.sin(r.heading) * 5, r.y + 1.1, r.z + Math.cos(r.heading) * 5);
  camera.fov = 55 + Math.min(r.speed, 25) * 0.5;
  camera.updateProjectionMatrix();
  followSun(r.x, r.y, r.z);
}
function followSun(x, y, z) {
  sun.position.set(x, y, z).addScaledVector(sun.userData.dir, 400);
  sun.target.position.set(x, y, z);
}

// ---------- Lift ride ----------
let rideSpeed = 6, chair;
function startRide(lift) {
  mode = "ride";
  show("ride");
  controls.enabled = false;
  slopeLook(); // the runs below are named by labels while riding
  scene.fog.near = 1500; scene.fog.far = 12000;
  rider.model.visible = true;
  chair.visible = true;
  ride = { lift, d: 0, length: pathLen(lift.path), below: [], snap: true };
  $("rideName").innerHTML = `${icon("lift")}${esc(lift.name)}`;
  // Name the runs passing under this lift.
  const names = new Set();
  for (const run of R.runs) {
    if (!run.name || names.has(run.name)) continue;
    const close = run.pts.find(([x, z]) => lift.pts.some((p, i) => i && segDist(x, z, lift.pts[i - 1], p) < 120));
    if (close) { names.add(run.name); ride.below.push(label(`${icon(run.level)}${esc(run.name)}`, "run", ptV(close, 8))); }
  }
}
const pathLen = (path) => path.reduce((s, p, i) => (i ? s + p.distanceTo(path[i - 1]) : 0), 0);
function segDist(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
}

function stepRide(dt) {
  const mult = holdFast ? 30 : rideSpeed;
  ride.d = Math.min(ride.length, ride.d + 4.5 * mult * dt);
  const [a, b, t] = at(ride.lift.path, ride.d);
  const p = a.clone().lerp(b, t);
  const dir = b.clone().sub(a).setY(0).normalize();
  rider.model.position.copy(p).add(new THREE.Vector3(0, -2.95, 0.05));
  rider.model.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
  sit(rider.model);
  chair.position.copy(p);
  chair.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
  const want = p.clone().addScaledVector(dir, -9).add(new THREE.Vector3(0, 1.5, 0));
  if (ride.snap) { camera.position.copy(want); ride.snap = false; } else camera.position.lerp(want, Math.min(1, dt * 3));
  camera.lookAt(p.clone().addScaledVector(dir, 30).add(new THREE.Vector3(0, -4, 0)));
  camera.fov = 60; camera.near = 0.5; camera.updateProjectionMatrix();
  followSun(p.x, p.y, p.z);
  const secs = (ride.length - ride.d) / (4.5 * mult);
  $("rideMeta").textContent = `还有 ${fmtLen(ride.length - ride.d)} · 约 ${Math.ceil(secs)} 秒 · ${mult} 倍速`;
  if (ride.d >= ride.length) endRide();
}
$("skipRide").addEventListener("click", () => { if (ride) ride.d = ride.length; });

// Sitting on the chair: thighs level, shins hanging.
function sit(model) {
  const u = model.userData;
  u.yaw.rotation.set(0, 0, 0); u.pivot.rotation.set(0, 0, 0); u.hips.rotation.set(-0.1, model.userData.kind === "board" ? -Math.PI / 2 : 0, 0);
  for (const leg of u.legs) { leg.hip.rotation.x = -1.45; leg.knee.rotation.x = 1.45; leg.ankle.rotation.x = 0; leg.hip.position.y = 0.55; leg.hip.position.z = 0; }
  u.hips.position.y = 0.55;
  for (const arm of u.arms) { arm.shoulder.rotation.x = -0.6; arm.shoulder.rotation.z = arm.side * 0.2; }
}

function endRide() {
  const lift = ride.lift;
  ride.below.forEach(dropLabel);
  ride = null;
  chair.visible = false;
  const [x, z] = lastPt(lift.pts);
  const r = rider.physics;
  const next = journey.legs[journey.i + 1];
  rider.model.visible = false;
  const runs = runsFrom(x, z, 160);
  r.place(x, z, next?.type === "run" ? runDir(next.run, next.from) : runs[0] ? runDir(runs[0], 0) : 0, 1);
  arrive(x, z, lift, runs, next);
}

// Getting off the lift: look around 360°, see which runs start here (lit on the snow) and which lifts
// you can reach from here at your level, then choose. On a planned route the next run is lit first.
function arrive(x, z, lift, runs, next) {
  mode = "arrive";
  show("card");
  $("card").classList.add("low"); // keep the top half of the screen for the 360° view
  clearAbove();
  mapLook();
  scene.fog.near = 2500; scene.fog.far = 16000;
  const y = T.heightAt(x, z);
  const pieces = runs.map((r) => ({ run: r, pts: r.pts, level: r.level }));
  if (next?.type === "run" && !runs.includes(next.run)) pieces.unshift({ run: next.run, pts: next.run.pts.slice(next.from, next.to + 1), level: next.run.level });
  setRoute(pieces);
  const seen = new Set();
  for (const p of pieces) {
    if (!p.run.name || seen.has(p.run.name)) continue;
    seen.add(p.run.name);
    aboveLabels.push(label(`${icon(p.run.level)}${esc(p.run.name)}`, `run sel${next?.run === p.run ? " next" : ""}`, ptV(p.pts[Math.min(p.pts.length - 1, 10)], 8)));
  }
  aboveLabels.push(label(`📍 ${esc(lift.name)} 山顶`, "you", new THREE.Vector3(x, y + 20, z)));
  if (scene.userData.onArrive) {
    // Miniature: the area around the top on a little plinth, turning slowly.
    scene.userData.onArrive(x, z, `${lift.name} · 山顶`);
    controls.target.set(x, y - 200, z);
    camera.position.set(x - 1700, y + 1500, z - 1700);
    controls.enabled = true;
    Object.assign(controls, { minDistance: 800, maxDistance: 6000, autoRotate: true, autoRotateSpeed: 1.6 });
    camera.fov = 30; camera.near = 10; camera.updateProjectionMatrix();
  } else {
    // Orbit slowly around the top station with a wide lens; drag to look yourself.
    controls.enabled = true;
    Object.assign(controls, { minDistance: 60, maxDistance: 1200, autoRotate: true, autoRotateSpeed: 1.6 });
    controls.target.set(x, y + 6, z);
    const n = T.normalAt(x, z);
    const down = new THREE.Vector3(n.x, 0, n.z).normalize();
    camera.position.set(x - down.x * 160, y + 110, z - down.z * 160);
    camera.fov = 72; camera.near = 1; camera.updateProjectionMatrix();
  }

  $("cardTitle").innerHTML = `${icon("lift")}到了 ${esc(lift.name)} 山顶`;
  $("cardMeta").textContent = `海拔 ${T.altitude(y)} 米 · 拖动可以自己转着看，亮起来的是从这里出发的雪道`;
  const box = $("cardActions");
  box.innerHTML = "";
  if (next) {
    const what = next.type === "run" ? `${icon(next.run.level)}滑 <b>${esc(next.run.name)}</b>` : `${icon("lift")}去坐 <b>${esc(next.lift.name)}</b>`;
    box.append(button(`▶ 继续路线：${what}`, () => { leaveArrival(); nextLeg(); }, "go"));
    if (journey.auto) arrivalTimer = setTimeout(() => { if (mode === "arrive") { leaveArrival(); nextLeg(); } }, 6000);
  }
  const h3 = (t) => { const e = document.createElement("h3"); e.textContent = t; box.append(e); };
  h3("从这里能滑的雪道");
  for (const run of runs.slice(0, 6)) {
    const end = nameOfPlaceNear(...lastPt(run.pts));
    const ok = LEVELS.indexOf(run.level) <= LEVELS.indexOf(settings.level);
    box.append(button(`${icon(run.level)}<span><b>${esc(run.name)}</b><small>${fmtLen(run.length)} · 落差 ${run.drop} 米${end ? ` → ${esc(end)}` : ""}${ok ? "" : " · 超出你的水平"}</small></span>`,
      () => { leaveArrival(); startJourney([{ type: "run", run, from: 0, to: run.pts.length - 1, length: run.length }]); }));
  }
  if (!runs.length) box.append(button("这里没有直接出发的雪道", () => { leaveArrival(); enterMap(); flyTo(x, z); }));
  const lifts = reachableLifts(lift, settings.level);
  if (lifts.length) {
    h3("从这里能滑过去接着坐的缆车");
    for (const { other, route } of lifts) {
      const via = route.legs.filter((l) => l.type === "run").map((l) => esc(l.run.name || "雪道"));
      box.append(button(`${icon("lift")}<span><b>${esc(other.name)}</b><small>滑 ${via.join(" → ")} 过去 · 约 ${fmtMin(route.seconds)}</small></span>`,
        () => { leaveArrival(); startJourney([...route.legs, { type: "lift", lift: other, length: other.length }]); }));
    }
  }
  box.append(button("🗺 回地图规划", () => { leaveArrival(); enterMap(); openPlan({ lift }, null); }));
}
let arrivalTimer = null;
function leaveArrival() {
  clearTimeout(arrivalTimer);
  clearAbove();
  setRoute(null);
  $("card").classList.remove("low");
  Object.assign(controls, { minDistance: 150, maxDistance: 11000, autoRotate: false });
  controls.enabled = false;
}
// Lifts whose bottom you can ski to from the top of `lift` without going over your level.
function reachableLifts(lift, level) {
  const top = graph.liftNodes.get(lift).top, out = [];
  for (const other of R.lifts) {
    if (other === lift) continue;
    const route = planRoute(graph, [top], [graph.liftNodes.get(other).bottom], level);
    if (route && route.legs.every((l) => l.type !== "lift") && route.seconds < 15 * 60) out.push({ other, route });
  }
  return out.sort((a, b) => a.route.seconds - b.route.seconds).slice(0, 4);
}

// A still, high view over a spot with some runs highlighted and named: where am I, where does it go.
let aboveLabels = [];
function clearAbove() { aboveLabels.forEach(dropLabel); aboveLabels = []; }
function lookFromAbove(x, z, pieces) {
  clearAbove();
  mapLook();
  if (pieces) {
    setRoute(pieces);
    const seen = new Set();
    for (const p of pieces) {
      if (!p.run?.name || seen.has(p.run.name)) continue;
      seen.add(p.run.name);
      aboveLabels.push(label(`${icon(p.run.level)}${esc(p.run.name)}`, "run sel", ptV(p.pts[Math.min(p.pts.length - 1, 14)], 10)));
    }
  }
  const y = T.heightAt(x, z);
  const n = T.normalAt(x, z);
  const down = new THREE.Vector3(n.x, 0, n.z);
  if (down.lengthSq() < 1e-4) down.set(0, 0, 1);
  down.normalize();
  camera.position.set(x - down.x * 450, y + 480, z - down.z * 450);
  camera.lookAt(x + down.x * 600, y - 250, z + down.z * 600);
  camera.fov = 50; camera.near = 2; camera.updateProjectionMatrix();
}

// Pause while skiing and look at the rest of the route from above.
function openOverview() {
  if (mode !== "ski") return;
  mode = "overview";
  show("overviewBar");
  const r = rider.physics, leg = journey.legs[journey.i];
  lookFromAbove(r.x, r.z, journey.legs.slice(journey.i).filter((l) => l.type === "run")
    .map((l) => ({ run: l.run, pts: l.run.pts.slice(l === leg ? leg.progress : l.from, l.to + 1), level: l.run.level })));
  aboveLabels.push(label("📍 你在这", "you", new THREE.Vector3(r.x, r.y + 14, r.z)));
}
$("overviewBtn").addEventListener("click", openOverview);
$("minimap").addEventListener("click", openOverview);
$("resume").addEventListener("click", () => {
  clearAbove();
  mode = "ski";
  show("hud");
  slopeLook();
  setRoute(null);
  placeChase(true);
});

function finishJourney() {
  mode = "card";
  show("card");
  const r = rider.physics;
  const secs = (performance.now() - journey.started) / 1000;
  const lifts = R.lifts.filter((l) => Math.hypot(l.pts[0][0] - r.x, l.pts[0][1] - r.z) < 260);
  lookFromAbove(r.x, r.z, null);
  $("cardTitle").innerHTML = "🎉 到了！";
  const where = nameOfPlaceNear(r.x, r.z, 300);
  $("cardMeta").textContent = `${where ? `现在在 ${where} · ` : ""}用时 ${Math.floor(secs / 60)} 分 ${Math.round(secs % 60)} 秒 · 最快 ${Math.round(journey.top * 3.6)} km/h · 滑行 ${fmtLen(journey.dist)}`;
  const box = $("cardActions");
  box.innerHTML = "";
  for (const l of lifts.slice(0, 3)) box.append(button(`${icon("lift")}<span>坐 <b>${esc(l.name)}</b> 上山<small>爬升 ${l.rise} 米</small></span>`, () => startJourney([{ type: "lift", lift: l, length: l.length }])));
  for (const run of runsFrom(r.x, r.z, 120).slice(0, 3)) box.append(button(`${icon(run.level)}<span>接着滑 <b>${esc(run.name)}</b></span>`, () => startJourney([{ type: "run", run, from: 0, to: run.pts.length - 1, length: run.length }])));
  box.append(button("🗺 回地图", () => { enterMap(); flyTo(r.x, r.z, 1500); }));
}

// ---------- Minimap: heading-up, 500 m around you ----------
const mini = $("minimap"), mctx = mini.getContext("2d");
function drawMinimap(leg) {
  const r = rider.physics, W = mini.width, S = W / 2 / 500;
  const cos = Math.cos(r.heading), sin = Math.sin(r.heading);
  // World to map, rotated so the heading points up.
  const tx = (x, z) => { const dx = x - r.x, dz = z - r.z; return [W / 2 - (dx * cos - dz * sin) * S, W / 2 - (dx * sin + dz * cos) * S]; };
  mctx.clearRect(0, 0, W, W);
  mctx.save();
  mctx.beginPath(); mctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); mctx.fillStyle = "#f7f5ef"; mctx.fill(); mctx.clip();
  const line = (pts, color, width) => {
    mctx.strokeStyle = color; mctx.lineWidth = width; mctx.beginPath();
    let on = false;
    for (const [x, z] of pts) {
      if (Math.abs(x - r.x) > 900 || Math.abs(z - r.z) > 900) { on = false; continue; }
      const [u, v] = tx(x, z);
      on ? mctx.lineTo(u, v) : mctx.moveTo(u, v);
      on = true;
    }
    mctx.stroke();
  };
  for (const run of R.runs) line(run.outline || run.pts, { easy: "#7fcf98", intermediate: "#7eaef2", advanced: "#8a8c99", expert: "#8a8c99" }[run.level], 2);
  for (const l of R.lifts) line(l.pts, "#d9534f", 1.5);
  for (const lg of journey.legs.slice(journey.i)) if (lg.type === "run") line(lg.run.pts.slice(lg === leg ? leg.progress : lg.from, lg.to + 1), "#f0a020", 5);
  mctx.font = "bold 22px -apple-system, sans-serif";
  mctx.fillStyle = "#23252f";
  const named = new Set();
  for (const run of R.runs) {
    if (!run.name || named.has(run.name)) continue;
    const mid = run.pts[Math.floor(run.pts.length / 3)];
    if (Math.hypot(mid[0] - r.x, mid[1] - r.z) > 380) continue;
    named.add(run.name);
    const [u, v] = tx(...mid);
    mctx.fillText(run.name.length > 14 ? run.name.slice(0, 13) + "…" : run.name, u + 6, v);
  }
  mctx.restore();
  mctx.fillStyle = "#e2463d";
  mctx.beginPath(); mctx.moveTo(W / 2, W / 2 - 18); mctx.lineTo(W / 2 + 12, W / 2 + 12); mctx.lineTo(W / 2 - 12, W / 2 + 12); mctx.fill();
  mctx.strokeStyle = "#23252f"; mctx.lineWidth = 4; mctx.beginPath(); mctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); mctx.stroke();
  const [nu, nv] = tx(r.x, r.z - 460);
  mctx.fillStyle = "#23252f"; mctx.font = "bold 24px sans-serif"; mctx.fillText("N", nu - 8, nv + 8);
}

// ---------- Settings ----------
function renderSettings(box) {
  box.innerHTML = `
    <div class="seg"><span>我是</span>${[["ski", "⛷ 双板"], ["board", "🏂 单板"]].map(([k, t]) => `<button data-kind="${k}" class="${settings.kind === k ? "on" : ""}">${t}</button>`).join("")}</div>
    <div class="seg"><span>水平</span>${LEVELS.map((l) => `<button data-level="${l}" class="${settings.level === l ? "on" : ""}">${icon(l)}${LEVEL[l].zh}</button>`).join("")}</div>`;
  box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.kind) { settings.kind = b.dataset.kind; buildRider(); }
    if (b.dataset.level) settings.level = b.dataset.level;
    saveSettings();
    renderSettings(box);
  }));
}

// ---------- Loop ----------
let last = performance.now(), clock = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  liftsView?.update(clock);
  if (mode === "ski") { stepRun(dt); placeChase(false, dt); }
  else if (mode === "ride" && ride) stepRide(dt);
  else if (mode === "map" || mode === "intro" || mode === "arrive") controls.update();
  rider.spray?.update(dt);
  updateLabels();
  draw(scene, camera);
  requestAnimationFrame(frame);
}

const pause = () => new Promise((r) => setTimeout(r, 30));
async function main() {
  const resort = new URLSearchParams(location.search).get("resort") || "copper";
  $("loading").textContent = "下载雪场数据…";
  R = await (await fetch(`data/${resort}.json`)).json();
  $("loading").textContent = "生成山体和阳光阴影…";
  await pause();
  T = new Terrain(R);
  const mask = treeMaskFn(R, T);
  terrainMesh = T.mesh(mask);
  const skyMesh = sky();
  scene.add(skyMesh, terrainMesh);
  sun = lights(scene);
  sun.userData.dir = sun.position.clone().normalize();
  $("loading").textContent = "种树、架缆车…";
  await pause();
  const trees = forest(T, mask);
  trees.name = "forest";
  scene.add(trees);
  runView = runLayers(T, R.runs);
  scene.add(runView.mapLayer, runView.skiLayer);
  signGroup = signs(T, R.runs);
  scene.add(signGroup);
  liftsView = new Lifts(T, R.lifts);
  scene.add(liftsView.group);
  graph = buildGraph(R, (x, z) => T.heightAt(x, z));
  rider.spray = new Spray(scene);
  const style = new URLSearchParams(location.search).get("style") || "lowpoly";
  draw = await applyStyle(style, { renderer, scene, skyMesh, terrainMesh, terrain: T, sun, hemi: scene.children.find((o) => o.isHemisphereLight) });
  chair = chairMesh();
  chair.visible = false;
  scene.add(chair);
  buildRider();
  mapLook();

  for (const l of R.lifts) label(`${icon("lift")}${esc(l.name)}`, "lift", ptV(lastPt(l.pts), 16), (p) => mode === "map" && camDist(p) < 6500);
  for (const p of R.places) label(`${p.kind === "village" ? "🏠" : "🍴"} ${esc(p.name)}`, "place", ptV([p.x, p.z], 12), (q) => mode === "map" && camDist(q) < (p.kind === "village" ? 9000 : 2500));
  const named = new Set();
  for (const run of R.runs) {
    if (!run.name || named.has(run.name)) continue;
    named.add(run.name);
    label(`${icon(run.level)}${esc(run.name)}`, "run", ptV(run.pts[Math.floor(run.pts.length / 2)], 6), (p) => mode === "map" && camDist(p) < 1300);
  }

  const all = R.runs.flatMap((r) => r.pts);
  const cx = all.reduce((s, p) => s + p[0], 0) / all.length, cz = all.reduce((s, p) => s + p[1], 0) / all.length;
  controls.target.set(cx, T.heightAt(cx, cz), cz);
  const k = scene.userData.mapScale || 1; // the miniature is seen from further away, as a whole block
  camera.position.set(cx + 1500 * k, T.heightAt(cx, cz) + 2600 * k, cz - 4200 * k); // from the villages in the north, looking up the mountain
  controls.maxDistance = 11000 * k;
  renderSettings($("introSettings"));
  $("loading").textContent = `${R.runs.length} 条雪道 · ${R.lifts.length} 条缆车`;
  const start = $("start");
  start.disabled = false;
  start.textContent = "进入雪场";
  start.addEventListener("click", () => { $("intro").classList.add("hidden"); enterMap(); });
  requestAnimationFrame(frame);
}

// ---------- Wiring ----------
$("openList").addEventListener("click", () => { $("search").classList.remove("hidden"); show("mapbar", "list"); renderList(); });
$("openPlan").addEventListener("click", () => openPlan(null, null));
$("openSettings").addEventListener("click", () => {
  show("mapbar", "list");
  $("search").classList.add("hidden");
  const ul = $("items");
  ul.innerHTML = "";
  const li = document.createElement("li");
  li.className = "settingsRow";
  ul.append(li);
  renderSettings(li);
});
$("search").addEventListener("input", renderList);
for (const id of ["listClose", "planClose", "infoClose"]) $(id).addEventListener("click", () => { setRoute(null); show("mapbar"); });
for (const id of ["planFrom", "planTo", "planLevel"]) $(id).addEventListener("change", runPlan);
$("planGo").addEventListener("click", () => planned && startJourney(planned.legs, false));
$("planWatch").addEventListener("click", () => planned && startJourney(planned.legs, true));
$("exitSki").addEventListener("click", () => { enterMap(); flyTo(rider.physics.x, rider.physics.z, 1500); });
$("exitRide").addEventListener("click", () => { ride?.below.forEach(dropLabel); ride = null; chair.visible = false; enterMap(); });

// Test hook for headless checks.
window.__prerun = {
  get R() { return R; }, get graph() { return graph; }, get mode() { return mode; }, get journey() { return journey; },
  rider, settings, startJourney, planRoute, nodesNear, stepRun, stepRide, openPlan, select,
  continueRoute: () => { leaveArrival(); nextLeg(); }, get T() { return T; }, reachableLifts, scene, renderer,
};

main().catch((e) => { $("loading").textContent = `加载失败：${e.message}`; console.error(e); });
