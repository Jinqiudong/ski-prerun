// Ski Pre-Run: a chibi, playable version of a real resort. Map mode to explore and pick a run or lift,
// ski mode to ride it down. All terrain, runs and lifts come from data/<resort>.json (tools/bake.py).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const LEVEL = {
  easy: { zh: "初级", color: 0x3fbf6a },
  intermediate: { zh: "中级", color: 0x3d8bfd },
  advanced: { zh: "高级", color: 0x2b2d42 },
  expert: { zh: "专家", color: 0x2b2d42 },
};
const $ = (id) => document.getElementById(id);
const icon = (level) => `<i class="lv ${level}"></i>`;
const fmt = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} 公里` : `${m} 米`);

// ---------- Terrain ----------
let R; // resort data
let heights, gw, gh, bx0, bz0, bx1, bz1;

function decodeResort(data) {
  R = data;
  [gw, gh] = data.grid;
  [bx0, bz0, bx1, bz1] = data.bounds;
  const raw = Uint8Array.from(atob(data.heights), (c) => c.charCodeAt(0));
  const q = new Uint16Array(raw.buffer);
  heights = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) heights[i] = q[i] / 10; // meters above the lowest point
}

// Height in scene units (meters above the resort's lowest point), bilinear like the baked surface.
function heightAt(x, z) {
  let c = ((x - bx0) / (bx1 - bx0)) * (gw - 1);
  let r = ((z - bz0) / (bz1 - bz0)) * (gh - 1);
  c = Math.min(Math.max(c, 0), gw - 1.001);
  r = Math.min(Math.max(r, 0), gh - 1.001);
  const i = Math.floor(r), j = Math.floor(c), fr = r - i, fc = c - j;
  const a = heights[i * gw + j], b = heights[i * gw + j + 1], d = heights[(i + 1) * gw + j], e = heights[(i + 1) * gw + j + 1];
  return a * (1 - fc) * (1 - fr) + b * fc * (1 - fr) + d * (1 - fc) * fr + e * fc * fr;
}

function normalAt(x, z, out = new THREE.Vector3()) {
  const s = 6;
  const hx = heightAt(x + s, z) - heightAt(x - s, z);
  const hz = heightAt(x, z + s) - heightAt(x, z - s);
  return out.set(-hx, 2 * s, -hz).normalize();
}

const altitude = (y) => Math.round(R.hmin + y);

// ---------- Scene ----------
const canvas = $("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe6ecff, 3000, 14000);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 2, 30000);
scene.add(new THREE.HemisphereLight(0xdfeaff, 0xb7b9e6, 1.6));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
sun.position.set(-3000, 4000, 2000);
scene.add(sun);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = 1.35;
controls.minDistance = 300;
controls.maxDistance = 12000;
controls.screenSpacePanning = false;

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function buildTerrain() {
  const geo = new THREE.BufferGeometry();
  const pos = [], col = [];
  const snow = new THREE.Color(0xf6f8ff), shade = new THREE.Color(0xd9def5), rock = new THREE.Color(0xb9b3c9), meadow = new THREE.Color(0xe9f2f0);
  const vx = (c) => bx0 + ((bx1 - bx0) * c) / (gw - 1);
  const vz = (r) => bz0 + ((bz1 - bz0) * r) / (gh - 1);
  const tmp = new THREE.Color();
  const n = new THREE.Vector3();
  const push = (r, c) => {
    const x = vx(c), z = vz(r), y = heights[r * gw + c];
    pos.push(x, y, z);
    normalAt(x, z, n);
    const steep = 1 - n.y; // 0 flat .. ~0.5 cliff
    tmp.copy(snow).lerp(shade, Math.min(steep * 3, 1));
    if (steep > 0.33) tmp.lerp(rock, Math.min((steep - 0.33) * 4, 0.8));
    if (y < 60) tmp.lerp(meadow, 0.4);
    col.push(tmp.r, tmp.g, tmp.b);
  };
  for (let r = 0; r < gh - 1; r++) {
    for (let c = 0; c < gw - 1; c++) {
      push(r, c); push(r + 1, c); push(r, c + 1);
      push(r, c + 1); push(r + 1, c); push(r + 1, c + 1);
    }
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  scene.add(mesh);
  return mesh;
}

function buildTrees() {
  const [mw, mh] = R.trees.grid;
  const bits = Uint8Array.from(atob(R.trees.bits), (c) => c.charCodeAt(0));
  const spots = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let r = 0; r < mh; r++) {
    for (let c = 0; c < mw; c++) {
      const k = r * mw + c;
      if (!(bits[k >> 3] & (0x80 >> (k & 7)))) continue;
      if (rand() > 0.16) continue;
      const x = bx0 + ((bx1 - bx0) * (c + rand() - 0.5)) / (mw - 1);
      const z = bz0 + ((bz1 - bz0) * (r + rand() - 0.5)) / (mh - 1);
      spots.push([x, z, rand()]);
    }
  }
  // Chibi trees: about twice real size so the forest reads as shapes, not noise.
  const cone = new THREE.ConeGeometry(9, 26, 6);
  cone.translate(0, 13, 0);
  const mesh = new THREE.InstancedMesh(cone, new THREE.MeshLambertMaterial({ flatShading: true }), spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const c1 = new THREE.Color(0x2f8a6f), c2 = new THREE.Color(0x67b86f), c = new THREE.Color();
  spots.forEach(([x, z, v], i) => {
    const k = 0.75 + v * 0.6;
    m.compose(p.set(x, heightAt(x, z) - 0.5, z), q, s.set(k, k * (0.9 + v * 0.3), k));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.copy(c1).lerp(c2, v));
  });
  scene.add(mesh);
}

// A ribbon draped on the terrain along a polyline.
function ribbon(pts, width, lift = 0.5) {
  const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    const [ax, az] = pts[Math.max(i - 1, 0)], [bx, bz] = pts[Math.min(i + 1, pts.length - 1)];
    let dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const lx = x - dz * width / 2, lz = z + dx * width / 2, rx = x + dz * width / 2, rz = z - dx * width / 2;
    pos.push(lx, heightAt(lx, lz) + lift, lz, rx, heightAt(rx, rz) + lift, rz);
    if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const runMeshes = new Map();
function buildRuns() {
  for (const run of R.runs) {
    const mat = new THREE.MeshBasicMaterial({
      color: LEVEL[run.level].color, transparent: true, opacity: run.area ? 0.35 : 0.6,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(ribbon(run.outline || run.pts, run.area ? 9 : 30), mat);
    mesh.userData.run = run;
    scene.add(mesh);
    runMeshes.set(run.id, mesh);
  }
}

function buildLifts() {
  const cable = new THREE.LineBasicMaterial({ color: 0x55586e });
  const towerGeo = new THREE.CylinderGeometry(0.8, 1.2, 12, 5); towerGeo.translate(0, 6, 0);
  const towerMat = new THREE.MeshLambertMaterial({ color: 0x8a8fa8 });
  const stationGeo = new THREE.BoxGeometry(10, 6, 8); stationGeo.translate(0, 3, 0);
  const stationMat = new THREE.MeshLambertMaterial({ color: 0xff6b6b, flatShading: true });
  for (const lift of R.lifts) {
    const path = sampleLine(lift.pts, 30).map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 12, z));
    lift.path = path;
    lift.length = Math.round(path.reduce((s, p, i) => (i ? s + p.distanceTo(path[i - 1]) : 0), 0));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(path), cable));
    path.forEach((p, i) => {
      if (i % 4 || i === 0 || i === path.length - 1) return;
      const t = new THREE.Mesh(towerGeo, towerMat);
      t.position.set(p.x, p.y - 12, p.z);
      scene.add(t);
    });
    for (const end of [path[0], path[path.length - 1]]) {
      const s = new THREE.Mesh(stationGeo, stationMat);
      s.position.set(end.x, end.y - 12, end.z);
      scene.add(s);
    }
    // A thick, pickable highlight for selection.
    const hl = new THREE.Mesh(ribbon(lift.pts, 14, 3), new THREE.MeshBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: 0.0, depthWrite: false }));
    lift.highlight = hl;
    scene.add(hl);
  }
}

function sampleLine(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return out;
}

// ---------- Skier (chibi) ----------
function buildSkier() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xff8c42, flatShading: true });
  const pants = new THREE.MeshLambertMaterial({ color: 0x3d5a80, flatShading: true });
  const skin = new THREE.MeshLambertMaterial({ color: 0xffd7b5 });
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2d42 });
  const body = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.5, 4, 8), pants); legs.position.y = 0.75;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.45, 4, 10), jacket); torso.position.y = 1.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), skin); head.position.y = 2.55;
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.64, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xe63946 })); hat.position.y = 2.62;
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), white); pom.position.y = 3.3;
  const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.2), dark); goggles.position.set(0, 2.62, 0.55);
  body.add(legs, torso, head, hat, pom, goggles);
  for (const side of [-1, 1]) {
    const ski = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 2.6), new THREE.MeshLambertMaterial({ color: 0x3d8bfd }));
    ski.position.set(side * 0.28, 0.06, 0.2);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6), dark);
    pole.position.set(side * 0.75, 1.0, -0.2); pole.rotation.x = -0.35;
    g.add(ski); body.add(pole);
  }
  g.add(body);
  g.userData.body = body;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.4, 20), new THREE.MeshBasicMaterial({ color: 0x5a5f8a, transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  g.userData.shadow = shadow;
  g.scale.setScalar(1.6); // chibi: big enough to read on a phone
  return g;
}

// ---------- Geometry helpers ----------
function nearestOnRun(run, x, z, from = 0) {
  let best = Infinity, bi = 0;
  for (let i = from; i < run.pts.length; i++) {
    const d = (run.pts[i][0] - x) ** 2 + (run.pts[i][1] - z) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  return { i: bi, d: Math.sqrt(best) };
}

function nearestRun(x, z, maxDist = 40, exclude) {
  let best = null;
  for (const run of R.runs) {
    if (run === exclude) continue;
    const n = nearestOnRun(run, x, z);
    if (n.d < maxDist && (!best || n.d < best.d)) best = { run, ...n };
  }
  return best;
}

function nearestLift(x, z, maxDist) {
  let best = null;
  for (const lift of R.lifts) {
    for (const [px, pz] of lift.pts) {
      const d = Math.hypot(px - x, pz - z);
      if (d < maxDist && (!best || d < best.d)) best = { lift, d };
    }
  }
  return best;
}

// Where to go from a point: lifts whose bottom is close, and runs that start close.
function nextOptions(x, z) {
  const lifts = R.lifts.filter((l) => Math.hypot(l.pts[0][0] - x, l.pts[0][1] - z) < 260)
    .sort((a, b) => Math.hypot(a.pts[0][0] - x, a.pts[0][1] - z) - Math.hypot(b.pts[0][0] - x, b.pts[0][1] - z));
  const runs = R.runs.filter((r) => r.name && Math.hypot(r.pts[0][0] - x, r.pts[0][1] - z) < 160);
  return { lifts: lifts.slice(0, 3), runs: dedupeByName(runs).slice(0, 5) };
}

function dedupeByName(runs) {
  const seen = new Set();
  return runs.filter((r) => (seen.has(r.name) ? false : seen.add(r.name)));
}

// ---------- Labels ----------
const labelBox = $("labels");
const labels = [];
function addLabel(text, cls, getPos) {
  const el = document.createElement("div");
  el.className = `label ${cls}`;
  el.textContent = text;
  labelBox.appendChild(el);
  const item = { el, getPos, cls };
  labels.push(item);
  return item;
}
const v3 = new THREE.Vector3();
function updateLabels() {
  for (const l of labels) {
    const p = l.getPos();
    if (!p || l.hidden) { l.el.style.display = "none"; continue; }
    v3.copy(p).project(camera);
    const dist = camera.position.distanceTo(p);
    const show = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1 && (l.cls.includes("sel") || dist < 7000);
    l.el.style.display = show ? "block" : "none";
    if (show) l.el.style.transform = `translate(${(v3.x * 0.5 + 0.5) * innerWidth}px, ${(-v3.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
  }
}

// ---------- Map mode ----------
let mode = "intro";
let selected = null;
const selLabel = { item: null };

function topOf(lift) { return lift.path[lift.path.length - 1]; }

function select(target) {
  clearSelection();
  selected = target;
  const info = $("info");
  info.classList.remove("hidden");
  const actions = $("infoActions");
  actions.innerHTML = "";
  if (target.run) {
    const run = target.run;
    const mesh = runMeshes.get(run.id);
    mesh.material.opacity = 1;
    mesh.material.color.set(run.level === "easy" ? 0x22a24f : run.level === "intermediate" ? 0x1f6fe5 : 0x111111);
    $("infoIcon").innerHTML = icon(run.level);
    $("infoName").textContent = run.name || "（无名雪道）";
    $("infoMeta").textContent = `${LEVEL[run.level].zh}${run.area ? " · 林间/开阔区" : ""} · 长 ${fmt(run.length)} · 落差 ${run.drop} 米 · 起点海拔 ${altitude(heightAt(...run.pts[0]))} 米`;
    const go = button("⛷ 滑这条", () => startSki(run), "go");
    actions.append(go);
    const [x, z] = run.pts[0];
    const lift = R.lifts.map((l) => ({ l, d: Math.hypot(l.pts.at(-1)[0] - x, l.pts.at(-1)[1] - z) }))
      .filter((o) => o.d < 450).sort((a, b) => a.d - b.d)[0];
    if (lift) actions.append(button(`怎么上去：坐 ${lift.l.name}`, () => select({ lift: lift.l })));
    const mid = run.pts[Math.floor(run.pts.length / 2)];
    selLabel.item = addLabel(run.name || "雪道", "sel", () => new THREE.Vector3(mid[0], heightAt(mid[0], mid[1]) + 25, mid[1]));
  } else {
    const lift = target.lift;
    lift.highlight.material.opacity = 0.75;
    $("infoIcon").innerHTML = icon("lift");
    $("infoName").textContent = lift.name;
    $("infoMeta").textContent = `缆车 · 长 ${fmt(lift.length)} · 爬升 ${lift.rise} 米 · 山顶海拔 ${altitude(topOf(lift).y - 12)} 米`;
    actions.append(button("🚡 坐上去", () => rideLift(lift), "go"));
  }
}

function clearSelection() {
  if (selected?.run) {
    const m = runMeshes.get(selected.run.id);
    m.material.opacity = selected.run.area ? 0.35 : 0.6;
    m.material.color.set(LEVEL[selected.run.level].color);
  }
  if (selected?.lift) selected.lift.highlight.material.opacity = 0;
  if (selLabel.item) { selLabel.item.el.remove(); labels.splice(labels.indexOf(selLabel.item), 1); selLabel.item = null; }
  selected = null;
  $("info").classList.add("hidden");
}

function button(text, onClick, cls = "") {
  const b = document.createElement("button");
  b.textContent = text;
  if (cls) b.className = cls;
  b.addEventListener("click", onClick);
  return b;
}

function flyTo(x, z, distance = 1800) {
  const y = heightAt(x, z);
  const offset = camera.position.clone().sub(controls.target).setLength(distance);
  if (offset.y < distance * 0.4) offset.y = distance * 0.6;
  controls.target.set(x, y, z);
  camera.position.copy(controls.target).add(offset);
}

const raycaster = new THREE.Raycaster();
let terrainMesh;
let downAt = null;
canvas.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener("pointerup", (e) => {
  if (mode !== "map" || !downAt) return;
  if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 8) return;
  raycaster.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  const hit = raycaster.intersectObject(terrainMesh)[0];
  if (!hit) return clearSelection();
  const reach = Math.max(40, camera.position.distanceTo(hit.point) / 40);
  const lift = nearestLift(hit.point.x, hit.point.z, reach * 0.8);
  const run = nearestRun(hit.point.x, hit.point.z, reach);
  if (lift && (!run || lift.d < run.d)) select({ lift: lift.lift });
  else if (run) select({ run: run.run });
  else clearSelection();
});

function enterMap() {
  mode = "map";
  $("hud").classList.add("hidden");
  $("done").classList.add("hidden");
  $("ride").classList.add("hidden");
  $("mapbar").classList.remove("hidden");
  skier.visible = false;
  skier.userData.shadow.visible = false;
  controls.enabled = true;
  scene.fog.near = 5000; scene.fog.far = 22000;
  liftLabels.forEach((l) => (l.hidden = false));
}

// List of runs and lifts
const filters = { easy: true, intermediate: true, advanced: true, expert: true, lift: true };
function renderFilters() {
  const box = $("filters");
  box.innerHTML = "";
  for (const [k, name] of [["easy", "初级"], ["intermediate", "中级"], ["advanced", "高级"], ["expert", "专家"], ["lift", "缆车"]]) {
    const b = button("", () => { filters[k] = !filters[k]; renderFilters(); renderList(); });
    b.innerHTML = `${icon(k)}${name}`;
    if (filters[k]) b.classList.add("on");
    box.append(b);
  }
}
function renderList() {
  const q = $("search").value.trim().toLowerCase();
  const ul = $("items");
  ul.innerHTML = "";
  const rows = [];
  if (filters.lift) for (const l of R.lifts) rows.push({ lift: l, name: l.name, level: "lift", meta: `爬升 ${l.rise} 米` });
  for (const r of dedupeByName(R.runs.filter((r) => r.name && filters[r.level]))) rows.push({ run: r, name: r.name, level: r.level, meta: `${fmt(r.length)} · 落差 ${r.drop} 米` });
  for (const row of rows.filter((r) => !q || r.name.toLowerCase().includes(q))) {
    const li = document.createElement("li");
    li.innerHTML = `${icon(row.level)}<span></span><small>${row.meta}</small>`;
    li.querySelector("span").textContent = row.name;
    li.addEventListener("click", () => {
      $("list").classList.add("hidden");
      const [x, z] = row.run ? row.run.pts[Math.floor(row.run.pts.length / 2)] : row.lift.pts[Math.floor(row.lift.pts.length / 2)];
      flyTo(x, z, 1600);
      select(row.run ? { run: row.run } : { lift: row.lift });
    });
    ul.append(li);
  }
}
$("openList").addEventListener("click", () => { $("list").classList.remove("hidden"); renderList(); });
$("listClose").addEventListener("click", () => $("list").classList.add("hidden"));
$("search").addEventListener("input", renderList);
$("infoClose").addEventListener("click", clearSelection);

// ---------- Ski mode ----------
const skier = buildSkier();
scene.add(skier, skier.userData.shadow);
skier.visible = false;

const ski = {
  x: 0, z: 0, y: 0, heading: 0, speed: 0, steer: 0, brake: false, push: false,
  run: null, auto: false, progress: 0, startedAt: 0, maxSpeed: 0, distance: 0, lean: 0, nowCheck: 0, now: null, offRunFor: 0,
};
let liftLabels = [];
const keys = new Set();
addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

// Touch steering: drag left/right anywhere on the scene, like a joystick that starts where you touch.
let steerTouch = null;
canvas.addEventListener("pointerdown", (e) => { if (mode === "ski") steerTouch = { id: e.pointerId, x: e.clientX, dx: 0 }; });
canvas.addEventListener("pointermove", (e) => { if (steerTouch && e.pointerId === steerTouch.id) steerTouch.dx = e.clientX - steerTouch.x; });
const endSteer = (e) => { if (steerTouch && e.pointerId === steerTouch.id) steerTouch = null; };
canvas.addEventListener("pointerup", endSteer);
canvas.addEventListener("pointercancel", endSteer);
$("auto").addEventListener("click", () => { ski.auto = !ski.auto; $("auto").classList.toggle("on", ski.auto); });
for (const [id, key] of [["brake", "brake"], ["push", "push"]]) {
  const el = $(id);
  const on = (v) => (e) => { e.preventDefault(); ski[key] = v; el.classList.toggle("on", v); };
  el.addEventListener("pointerdown", on(true));
  el.addEventListener("pointerup", on(false));
  el.addEventListener("pointerleave", on(false));
  el.addEventListener("pointercancel", on(false));
}

function startSki(run, from) {
  clearSelection();
  $("list").classList.add("hidden");
  const start = from ? nearestOnRun(run, from[0], from[1]).i : 0;
  const [x, z] = run.pts[start];
  const [nx, nz] = run.pts[Math.min(start + 3, run.pts.length - 1)];
  Object.assign(ski, {
    x, z, y: heightAt(x, z), heading: Math.atan2(nx - x, nz - z), speed: 2, steer: 0, run,
    progress: start, startedAt: performance.now(), maxSpeed: 0, distance: 0, offRunFor: 0, now: null,
  });
  mode = "ski";
  controls.enabled = false;
  $("mapbar").classList.add("hidden");
  $("done").classList.add("hidden");
  $("ride").classList.add("hidden");
  $("hud").classList.remove("hidden");
  $("hudRun").innerHTML = `${icon(run.level)}<span></span>`;
  $("hudRun").querySelector("span").textContent = run.name || "无名雪道";
  skier.visible = true;
  skier.userData.shadow.visible = true;
  liftLabels.forEach((l) => (l.hidden = true));
  highlightRun(run);
  scene.fog.near = 900; scene.fog.far = 6000;
  placeChaseCamera(true);
}

let highlighted = null;
function highlightRun(run) {
  if (highlighted) { const m = runMeshes.get(highlighted.id); m.material.opacity = highlighted.area ? 0.35 : 0.6; }
  highlighted = run;
  if (run) runMeshes.get(run.id).material.opacity = 0.4;
}

const up = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3(), fwd = new THREE.Vector3(), tmpV = new THREE.Vector3();
function stepSki(dt) {
  // Input
  let steer = 0;
  if (keys.has("arrowleft") || keys.has("a")) steer -= 1;
  if (keys.has("arrowright") || keys.has("d")) steer += 1;
  if (steerTouch) steer = Math.max(-1, Math.min(1, steerTouch.dx / 70));
  if (ski.auto && !steerTouch && steer === 0) {
    // Follow the run a few points ahead, like watching the route.
    const ahead = nearestOnRun(ski.run, ski.x, ski.z, Math.max(0, ski.progress - 4));
    const [tx, tz] = ski.run.pts[Math.min(ahead.i + 4, ski.run.pts.length - 1)];
    const diff = Math.atan2(Math.sin(Math.atan2(tx - ski.x, tz - ski.z) - ski.heading), Math.cos(Math.atan2(tx - ski.x, tz - ski.z) - ski.heading));
    steer = Math.max(-1, Math.min(1, -diff * 2.5));
  }
  ski.steer += (steer - ski.steer) * Math.min(1, dt * 8);
  const braking = ski.brake || keys.has("s") || keys.has(" ") || keys.has("arrowdown") || (ski.auto && ski.speed > 16);
  const pushing = ski.push || keys.has("w") || keys.has("arrowup");

  // Physics: gravity along the slope in the heading direction, snow friction, air drag.
  normalAt(ski.x, ski.z, n);
  fwd.set(Math.sin(ski.heading), 0, Math.cos(ski.heading));
  const slopeDown = (n.x * fwd.x + n.z * fwd.z) / n.y; // meters of drop per meter along the heading
  const along = (9.8 * slopeDown) / Math.sqrt(1 + slopeDown * slopeDown);
  const offPiste = ski.offRunFor > 0.5 && !ski.now;
  let mu = 0.04 + (braking ? 0.75 : 0) + (offPiste ? 0.12 : 0);
  let a = along - mu * 9.8 * Math.sign(ski.speed || 1) - 0.0035 * ski.speed * ski.speed;
  a -= Math.abs(ski.steer) * ski.speed * 0.08; // carving bleeds speed
  if ((pushing || ski.auto) && ski.speed < 7 && along < 1) a += 2.5; // skating across flats
  ski.speed = Math.max(0, Math.min(28, ski.speed + a * dt));
  if (ski.speed < 0.3 && along < 0.2 && !pushing) {
    // Stalled on a flat or facing uphill: turn toward the fall line slowly so nobody gets stuck.
    const fall = Math.atan2(n.x, n.z);
    let diff = Math.atan2(Math.sin(fall - ski.heading), Math.cos(fall - ski.heading));
    if (Math.abs(steer) < 0.1) ski.heading += Math.sign(diff) * Math.min(Math.abs(diff), dt * 0.8);
  }
  ski.heading -= ski.steer * dt * (2.0 / (1 + ski.speed / 18));
  const horiz = ski.speed / Math.sqrt(1 + slopeDown * slopeDown);
  ski.x += Math.sin(ski.heading) * horiz * dt;
  ski.z += Math.cos(ski.heading) * horiz * dt;
  ski.x = Math.min(Math.max(ski.x, bx0 + 20), bx1 - 20);
  ski.z = Math.min(Math.max(ski.z, bz0 + 20), bz1 - 20);
  ski.y = heightAt(ski.x, ski.z);
  ski.distance += ski.speed * dt;
  ski.maxSpeed = Math.max(ski.maxSpeed, ski.speed);

  // Pose
  skier.position.set(ski.x, ski.y + 0.6, ski.z);
  skier.quaternion.setFromUnitVectors(up, n);
  skier.rotateY(ski.heading);
  ski.lean += (ski.steer * Math.min(ski.speed / 10, 1) * 0.45 - ski.lean) * Math.min(1, dt * 6);
  skier.userData.body.rotation.z = ski.lean;
  skier.userData.body.rotation.x = braking ? 0.25 : 0.12;
  skier.userData.shadow.position.set(ski.x, ski.y + 0.15, ski.z);

  // Where am I: progress on the chosen run, and which named run I am on right now.
  const near = nearestOnRun(ski.run, ski.x, ski.z, Math.max(0, ski.progress - 8));
  if (near.d < 60) ski.progress = Math.max(ski.progress, near.i);
  ski.nowCheck -= dt;
  if (ski.nowCheck <= 0) {
    ski.nowCheck = 0.25;
    const onChosen = near.d < 35;
    ski.now = onChosen ? { run: ski.run, d: near.d } : nearestRun(ski.x, ski.z, 30);
  }
  ski.offRunFor = near.d > 45 ? ski.offRunFor + dt : 0;
  updateHud(near);

  const last = ski.run.pts.length - 1;
  if (ski.progress >= last - 2 && near.d < 50) finishRun();
}

function updateHud(near) {
  $("hudSpeed").textContent = Math.round(ski.speed * 3.6);
  $("hudAlt").textContent = altitude(ski.y);
  $("hudProg").textContent = `${Math.round((ski.progress / (ski.run.pts.length - 1)) * 100)}%`;
  const now = ski.now;
  $("hudNow").textContent = now ? (now.run === ski.run ? "在雪道上 👍" : `你现在在：${now.run.name || "无名雪道"}`) : "雪道外 · 深雪和树林";
  const warn = $("warn");
  if (ski.offRunFor > 1.2) {
    const [tx, tz] = ski.run.pts[Math.min(near.i + 4, ski.run.pts.length - 1)];
    const want = Math.atan2(tx - ski.x, tz - ski.z);
    const diff = Math.atan2(Math.sin(want - ski.heading), Math.cos(want - ski.heading));
    warn.textContent = `偏离雪道 ${Math.round(near.d)} 米 · 往${diff > 0 ? "左" : "右"}回去`;
    warn.classList.remove("hidden");
  } else warn.classList.add("hidden");
  drawMinimap();
}

// Minimap: the whole resort from above with the chosen run and you.
const mini = $("minimap"), mctx = mini.getContext("2d");
let miniBase = null;
function miniXY(x, z) {
  const w = mini.width, h = mini.height;
  const s = Math.min(w / (bx1 - bx0), h / (bz1 - bz0));
  return [(x - bx0) * s + (w - (bx1 - bx0) * s) / 2, (z - bz0) * s + (h - (bz1 - bz0) * s) / 2];
}
function drawMinimap() {
  if (!miniBase) {
    miniBase = document.createElement("canvas");
    miniBase.width = mini.width; miniBase.height = mini.height;
    const c = miniBase.getContext("2d");
    c.lineWidth = 1;
    for (const run of R.runs) {
      c.strokeStyle = { easy: "#8bd6a3", intermediate: "#8fb9fb", advanced: "#9a9cb0", expert: "#9a9cb0" }[run.level];
      c.beginPath();
      (run.outline || run.pts).forEach(([x, z], i) => { const [u, v] = miniXY(x, z); i ? c.lineTo(u, v) : c.moveTo(u, v); });
      c.stroke();
    }
    c.strokeStyle = "#ff9b9b";
    for (const lift of R.lifts) {
      c.beginPath();
      lift.pts.forEach(([x, z], i) => { const [u, v] = miniXY(x, z); i ? c.lineTo(u, v) : c.moveTo(u, v); });
      c.stroke();
    }
  }
  mctx.clearRect(0, 0, mini.width, mini.height);
  mctx.drawImage(miniBase, 0, 0);
  if (ski.run) {
    mctx.strokeStyle = "#ff8c42"; mctx.lineWidth = 2.5;
    mctx.beginPath();
    ski.run.pts.forEach(([x, z], i) => { const [u, v] = miniXY(x, z); i ? mctx.lineTo(u, v) : mctx.moveTo(u, v); });
    mctx.stroke();
  }
  const [u, v] = miniXY(ski.x, ski.z);
  mctx.fillStyle = "#e63946";
  mctx.beginPath(); mctx.arc(u, v, 3.5, 0, Math.PI * 2); mctx.fill();
}

function placeChaseCamera(snap, dt = 0.016) {
  const back = new THREE.Vector3(-Math.sin(ski.heading), 0, -Math.cos(ski.heading));
  const want = new THREE.Vector3(ski.x, ski.y, ski.z).addScaledVector(back, 16);
  want.y = Math.max(heightAt(want.x, want.z), ski.y) + 8;
  if (snap) camera.position.copy(want);
  else camera.position.lerp(want, Math.min(1, dt * 3));
  camera.lookAt(ski.x + Math.sin(ski.heading) * 8, ski.y + 2.5, ski.z + Math.cos(ski.heading) * 8);
}

function finishRun() {
  mode = "done";
  const secs = (performance.now() - ski.startedAt) / 1000;
  $("hud").classList.add("hidden");
  $("done").classList.remove("hidden");
  $("doneTitle").textContent = `🎉 滑完 ${ski.run.name || "这条雪道"}！`;
  $("doneMeta").textContent = `用时 ${Math.floor(secs / 60)} 分 ${Math.round(secs % 60)} 秒 · 最快 ${Math.round(ski.maxSpeed * 3.6)} km/h · 滑行 ${fmt(Math.round(ski.distance))} · 现在海拔 ${altitude(ski.y)} 米`;
  showNext($("doneActions"), ski.x, ski.z, ski.run);
}

function showNext(box, x, z, exclude) {
  box.innerHTML = "";
  const { lifts, runs } = nextOptions(x, z);
  for (const lift of lifts) box.append(button(`🚡 坐 ${lift.name} 上山（爬升 ${lift.rise} 米）`, () => rideLift(lift)));
  for (const run of runs.filter((r) => r !== exclude)) {
    const b = button("", () => startSki(run, [x, z]));
    b.innerHTML = `${icon(run.level)} 接着滑 <span></span>`;
    b.querySelector("span").textContent = run.name;
    box.append(b);
  }
  if (!lifts.length && !runs.length) box.append(button("附近没有缆车或雪道起点，回地图看看", () => enterMap()));
  box.append(button("🗺 回地图", () => { enterMap(); flyTo(x, z, 1500); }));
}

// ---------- Lift ride ----------
let rideState = null;
function rideLift(lift) {
  clearSelection();
  mode = "ride";
  controls.enabled = false;
  $("mapbar").classList.add("hidden");
  $("done").classList.add("hidden");
  $("hud").classList.add("hidden");
  $("ride").classList.remove("hidden");
  $("rideName").textContent = `🚡 ${lift.name}`;
  skier.visible = true;
  skier.userData.shadow.visible = false;
  rideState = { lift, t: 0, total: lift.length };
}
$("rideSkip").addEventListener("click", () => rideState && (rideState.t = rideState.total));

function stepRide(dt) {
  const { lift } = rideState;
  rideState.t = Math.min(rideState.total, rideState.t + dt * 100); // 5 m/s chair × 20
  let left = rideState.t, i = 1;
  while (i < lift.path.length - 1 && left > lift.path[i].distanceTo(lift.path[i - 1])) { left -= lift.path[i].distanceTo(lift.path[i - 1]); i++; }
  const a = lift.path[i - 1], b = lift.path[i];
  const p = a.clone().lerp(b, Math.min(1, left / a.distanceTo(b)));
  skier.position.set(p.x, p.y - 3.5, p.z);
  skier.rotation.set(0, Math.atan2(b.x - a.x, b.z - a.z), 0);
  skier.userData.body.rotation.set(0, 0, 0);
  const side = new THREE.Vector3(b.z - a.z, 0, -(b.x - a.x)).normalize();
  const want = p.clone().addScaledVector(side, 40).add(new THREE.Vector3(0, 18, 0)).addScaledVector(b.clone().sub(a).normalize(), -30);
  camera.position.lerp(want, Math.min(1, dt * 2.5));
  camera.lookAt(p);
  if (rideState.t >= rideState.total) {
    const top = lift.pts[lift.pts.length - 1];
    rideState = null;
    mode = "done";
    $("ride").classList.add("hidden");
    $("done").classList.remove("hidden");
    $("doneTitle").textContent = `到了 ${lift.name} 山顶`;
    $("doneMeta").textContent = `海拔 ${altitude(heightAt(top[0], top[1]))} 米 · 从这里能滑的雪道：`;
    ski.x = top[0]; ski.z = top[1];
    showNext($("doneActions"), top[0], top[1]);
  }
}

$("exitSki").addEventListener("click", () => { enterMap(); flyTo(ski.x, ski.z, 1500); });

// ---------- Loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === "ski") { stepSki(dt); placeChaseCamera(false, dt); }
  else if (mode === "ride" && rideState) stepRide(dt);
  else if (mode === "map" || mode === "intro") controls.update();
  updateLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

async function main() {
  const resort = new URLSearchParams(location.search).get("resort") || "copper";
  const data = await (await fetch(`data/${resort}.json`)).json();
  decodeResort(data);
  terrainMesh = buildTerrain();
  buildTrees();
  buildRuns();
  buildLifts();
  liftLabels = R.lifts.map((l) => addLabel(l.name, "lift", () => topOf(l)));
  // Open on the whole resort, looking from the valley up to the peaks.
  const all = R.runs.flatMap((r) => r.pts);
  const cx = all.reduce((s, p) => s + p[0], 0) / all.length, cz = all.reduce((s, p) => s + p[1], 0) / all.length;
  controls.target.set(cx, heightAt(cx, cz), cz);
  camera.position.set(cx + 1800, heightAt(cx, cz) + 3200, cz + 4200); // from the north-east valley, looking up at the peaks
  renderFilters();
  const start = $("start");
  start.disabled = false;
  start.textContent = "开始";
  start.addEventListener("click", () => { $("intro").classList.add("hidden"); enterMap(); });
  requestAnimationFrame(frame);
}
main().catch((e) => { $("start").textContent = `加载失败：${e.message}`; console.error(e); });

// Test hook: lets a headless test drive the simulation without rendering.
window.__ski = { ski, stepSki, startSki, get R() { return R; }, get mode() { return mode; } };
