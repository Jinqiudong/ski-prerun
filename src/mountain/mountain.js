// Style frame for step 1 of the art direction: the mountain alone, semi-realistic.
// Real terrain, runs and lifts; a bright winter day; resort-map run colors on white snow.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Sky } from "three/addons/objects/Sky.js";
import { Terrain, farTerrain, treeMaskFn, ribbon, Lifts } from "../ride/world.js?v=5";
import { buildGraph, planRoute, nodesNear, LEVELS } from "../core/route.js?v=5";
import { Diorama } from "./diorama.js?v=20";
import { solar, sunVector, weatherKind, WEATHER_ZH, palette } from "../ride/sky.js?v=1";
import { addStep } from "../ride/roadbook.js?v=12";
import { translatePage, myAvatar, t as tr, EN_ON as EN } from "../core/i18n.js?v=22";
import { openNav } from "../core/nav.js?v=9";

const SUN = new THREE.Vector3(-0.62, 0.46, 0.62).normalize(); // replaced by the real sun on load
const EXAG = 1.3; // relief exaggerated, as painted resort maps do, so the ridges read
// Which resort: ?resort=, else the one picked on the start screen. Its place comes with its data.
const RESORT_ID = (() => { try { return new URLSearchParams(location.search).get("resort") || JSON.parse(localStorage.getItem("prerun") || "{}").resort || "copper"; } catch { return "copper"; } })().replace(/[^a-z0-9-]/g, "");
const RESORT = { lat: 39.4775, lon: -106.1605, tz: "America/Denver", name: "Copper Mountain" };
const RUN_COLOR = { easy: 0x22b35a, intermediate: 0x1f6fe5, advanced: 0x15171c, expert: 0x15171c };
const $ = (id) => document.getElementById(id);
const status = (t) => { $("status").textContent = t; return new Promise((r) => setTimeout(r, 20)); };

const renderer = new THREE.WebGLRenderer({ canvas: $("c"), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia("(pointer: coarse)").matches ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb4cfee, 20000, 95000);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 5, 120000);
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, { enableDamping: true, maxPolarAngle: 1.42, minDistance: 400, maxDistance: 26000, autoRotate: true, autoRotateSpeed: 0.35 });
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });


function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sun: { value: SUN.clone() }, top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, glow: { value: new THREE.Color() } },
    vertexShader: "varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `varying vec3 v; uniform vec3 sun, top, mid, hor, glow;
      void main(){
        float h = clamp(v.y, -0.05, 1.0);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, h));
        c = mix(c, top, smoothstep(0.22, 0.9, h));
        float s = max(dot(normalize(v), sun), 0.0);
        c += glow * (pow(s, 8.0) * 0.25 + pow(s, 600.0) * 1.2);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(100000, 32, 16), mat);
  m.renderOrder = -1;
  return m;
}

// Soft cumulus made of many overlapping puffs, drawn once to a canvas.
function cloudTexture(seed) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) {
    const x = 90 + rand() * 330, y = 150 - Math.sin(((x - 90) / 330) * Math.PI) * (40 + rand() * 60) + rand() * 30, r = 28 + rand() * 46;
    const grad = g.createRadialGradient(x, y - r * 0.3, 0, x, y, r);
    const shade = 235 + rand() * 20;
    grad.addColorStop(0, `rgba(255,255,255,0.9)`);
    grad.addColorStop(0.6, `rgba(${shade},${shade},${shade + 5},0.55)`);
    grad.addColorStop(1, "rgba(220,230,245,0)");
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function clouds(base) {
  const group = new THREE.Group();
  const textures = [1, 7, 13, 21, 34].map(cloudTexture);
  let s = 5;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2, d = 14000 + rand() * 26000, w = 3500 + rand() * 6000;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures[i % textures.length], transparent: true, opacity: 0.92, depthWrite: false, fog: false }));
    sp.scale.set(w, w * 0.5, 1);
    sp.position.set(Math.cos(a) * d, base + 2200 + rand() * 2600, Math.sin(a) * d);
    group.add(sp);
  }
  return group;
}

// Falling snow around the camera.
function snowParticles() {
  const n = 4000, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 3000, Math.random() * 1500, (Math.random() - 0.5) * 3000], i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dot = document.createElement("canvas");
  dot.width = dot.height = 32;
  const g = dot.getContext("2d"), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 5, map: new THREE.CanvasTexture(dot), transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
  pts.visible = false;
  pts.frustumCulled = false;
  pts.onBeforeRender = (r, sc, cam) => {
    const t = performance.now() / 1000;
    pts.position.set(cam.position.x, cam.position.y - 150 - ((t * 60) % 1500), cam.position.z);
  };
  return pts;
}

const load = (f, srgb) => new Promise((res) => new THREE.TextureLoader().load(`../assets/tex/${f}`, (t) => {
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  res(t);
}));

// Snow with sculpted detail; exposed rock on steep faces; a soft blue in shadow.
function snowMaterial(snowD, snowN, rockD) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { snowD: { value: snowD }, snowN: { value: snowN }, rockD: { value: rockD } });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP; varying vec3 vWN;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D snowD, snowN, rockD; varying vec3 vWP; varying vec3 vWN;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        float d = length(vWP - cameraPosition);
        float fade = smoothstep(500.0, 4000.0, d);
        vec3 sn = mix(texture2D(snowD, vWP.xz / 9.0).rgb * 1.12, vec3(0.97), fade);
        sn = mix(sn, texture2D(snowD, vWP.xz / 140.0).rgb * 1.1, 0.35 * (1.0 - fade * 0.5));
        float steep = 1.0 - vWN.y;
        float rockW = smoothstep(0.34, 0.52, steep + (texture2D(rockD, vWP.xz / 300.0).r - 0.5) * 0.12);
        vec3 rk = texture2D(rockD, vWP.xz / 60.0).rgb * vec3(0.95, 0.92, 0.9);
        diffuseColor.rgb *= mix(sn, rk * 1.25, rockW);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        vec3 nt = texture2D(snowN, vWP.xz / 9.0).xyz * 2.0 - 1.0;
        vec3 nt2 = texture2D(snowN, vWP.xz / 120.0).xyz * 2.0 - 1.0;
        vec3 wp = vec3(nt.x, 0.0, -nt.y) * 0.5 * (1.0 - fade) + vec3(nt2.x, 0.0, -nt2.y) * 0.35;
        normal = normalize(normal + (viewMatrix * vec4(wp, 0.0)).xyz);`);
  };
  return mat;
}

// Baked colors: forest floor, and the shadows the mountains cast for the current sun.
function shadeTerrain(geo, T, mask, sunDir, strength) {
  const { gw, gh } = T, col = geo.attributes.color;
  const shadow = new THREE.Color(0x8ea6d6), forestFloor = new THREE.Color(0xb7c2cf), c = new THREE.Color();
  for (let r = 0; r < gh; r++) {
    for (let j = 0; j < gw; j++) {
      const k = r * gw + j, x = T.x0 + j * T.cell, z = T.z0 + ((T.z1 - T.z0) * r) / (gh - 1);
      c.set(0xffffff);
      if (mask(x, z)) c.lerp(forestFloor, 0.5);
      if (strength > 0.05) c.lerp(shadow, T.sunShadow(x, z, T.h[k], sunDir) * 0.7 * strength);
      col.setXYZ(k, c.r, c.g, c.b);
    }
  }
  col.needsUpdate = true;
}

function terrainMesh(T, mask) {
  const { gw, gh } = T;
  const pos = new Float32Array(gw * gh * 3), col = new Float32Array(gw * gh * 3).fill(1);
  for (let r = 0; r < gh; r++) {
    for (let j = 0; j < gw; j++) {
      const k = r * gw + j;
      pos.set([T.x0 + j * T.cell, T.h[k], T.z0 + ((T.z1 - T.z0) * r) / (gh - 1)], k * 3);
    }
  }
  const idx = new Uint32Array((gw - 1) * (gh - 1) * 6);
  let p = 0;
  for (let r = 0; r < gh - 1; r++) for (let j = 0; j < gw - 1; j++) { const a = r * gw + j; idx.set([a, a + gw, a + 1, a + 1, a + gw, a + gw + 1], p); p += 6; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return geo;
}

// Spruce with snow lying on every tier.
function spruce() {
  // Four tiers, seven sides: ~50 triangles, so a dense forest stays light enough for a phone.
  const tiers = [[0.6, 6.5, 4.4], [4.2, 6.0, 3.5], [7.8, 5.2, 2.5], [11.0, 4.6, 1.4]];
  const pos = [], col = [];
  const needles = new THREE.Color(0x14301f), snow = new THREE.Color(0xe9f0f8), c = new THREE.Color();
  for (const [y, h, r] of tiers) {
    const g = new THREE.ConeGeometry(r, h, 7, 1, true).toNonIndexed();
    g.translate(0, y + h / 2, 0);
    g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      const up = Math.max(0, n.getY(i)), top = (p.getY(i) - y) / h;
      const lump = 0.5 + 0.5 * Math.sin(p.getX(i) * 7.1 + p.getZ(i) * 5.3);
      c.copy(needles).lerp(snow, Math.min(0.85, up * (0.5 + 0.5 * top) * (0.6 + 0.7 * lump)));
      col.push(c.r, c.g, c.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

function forest(T, mask) {
  const [mw, mh] = mask.grid, spots = [];
  let s = 11;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let r = 0; r < mh; r++) for (let c = 0; c < mw; c++) {
    if (!mask.at(c, r) || rand() > 0.085) continue;
    const x = T.x0 + ((T.x1 - T.x0) * (c + rand() - 0.5)) / (mw - 1), z = T.z0 + ((T.z1 - T.z0) * (r + rand() - 0.5)) / (mh - 1);
    spots.push([x, z, rand()]);
  }
  const CH = 10, buckets = Array.from({ length: CH * CH }, () => []);
  for (const sp of spots) {
    const c = Math.min(CH - 1, Math.max(0, Math.floor(((sp[0] - T.x0) / (T.x1 - T.x0)) * CH)));
    const r = Math.min(CH - 1, Math.max(0, Math.floor(((sp[1] - T.z0) / (T.z1 - T.z0)) * CH)));
    buckets[r * CH + c].push(sp);
  }
  const geo = spruce(), mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  const group = new THREE.Group(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  for (const b of buckets) {
    if (!b.length) continue;
    const mesh = new THREE.InstancedMesh(geo, mat, b.length);
    b.forEach(([x, z, v], i) => {
      const k = 1.5 + v * 1.1; // drawn larger than life so the forest reads at map scale
      m.compose(p.set(x, T.heightAt(x, z) - 0.5, z), q.setFromAxisAngle(Y, v * 6.28), sc.set(k, (k * (0.9 + v * 0.4)) / EXAG, k));
      mesh.setMatrixAt(i, m);
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}

// Runs as on a resort map: a coloured core in a casing, with a soft glow to read from far away. The style is
// one set of numbers (widths in m, opacities, colours) so the look can be tuned in one place.
// The owner's pick (2026-11-05): a thin coloured core in a thin white casing, no glow; lifts as red lines with dots at both ends.
const RUN_STYLE = { glow: 0, glowOp: [0, 0], casing: 24, casingOp: 0.85, casingColor: 0xffffff, core: 12, coreOp: 1, colors: { easy: 0x4fae6a, intermediate: 0x3f78c8, advanced: 0x2a2e36, expert: 0x2a2e36 } };
const LIFT_STYLE = { color: 0xb6463b, w: 14, dash: 0, gap: 0, ends: 32 };
function runs(T, list, o = RUN_STYLE) {
  const group = new THREE.Group();
  const mat = (color, opacity, order) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: order, polygonOffsetUnits: order, fog: false });
  const casing = mat(o.casingColor, o.casingOp, -4), glows = {}, cores = {};
  for (const run of list) {
    const pts = run.outline || run.pts, color = o.colors[run.level];
    glows[run.level] ??= mat(color, run.level === "advanced" || run.level === "expert" ? o.glowOp[1] : o.glowOp[0], -3);
    cores[run.level] ??= mat(color, o.coreOp, -6);
    if (!run.area) {
      if (o.glow && o.glowOp[0]) group.add(new THREE.Mesh(ribbon(T, pts, o.glow, 0.4), glows[run.level]));
      if (o.casing && o.casingOp) group.add(new THREE.Mesh(ribbon(T, pts, o.casing, 0.6), casing));
    }
    group.add(new THREE.Mesh(ribbon(T, pts, run.area ? Math.min(9, o.core) : o.core, 0.8), cores[run.level]));
  }
  return group;
}
// Lifts drawn on the snow as on a paper map: a dashed line from bottom to top (the 3D towers and cables stay).
function liftMarks(T, list, o) {
  const group = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: o.color, transparent: true, opacity: o.op ?? 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8, fog: false });
  for (const l of list) {
    const p = l.pts, dense = [];
    for (let i = 1; i < p.length; i++) { const n = Math.max(1, Math.ceil(Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]) / 10)); for (let k = 0; k < n; k++) dense.push([p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k / n, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k / n]); }
    dense.push(p[p.length - 1]);
    let run = [], along = 0;
    for (let i = 0; i < dense.length; i++) {
      if (i) along += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
      const on = !o.gap || along % (o.dash + o.gap) < o.dash;
      if (on) run.push(dense[i]); else if (run.length > 1) { group.add(new THREE.Mesh(ribbon(T, run, o.w, 1), m)); run = []; } else run = [];
    }
    if (run.length > 1) group.add(new THREE.Mesh(ribbon(T, run, o.w, 1), m));
    if (o.ends) for (const e of [p[0], p[p.length - 1]]) { const d = new THREE.Mesh(new THREE.CircleGeometry(o.ends, 16), m); d.rotation.x = -Math.PI / 2; d.position.set(e[0], T.heightAt(e[0], e[1]) + 1.2, e[1]); group.add(d); }
  }
  return group;
}

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
  const [R, far] = await Promise.all([fetch(`../data/${RESORT_ID}.json`).then((r) => r.json()), fetch(`../data/${RESORT_ID}-far.json`).then((r) => r.json())]);
  Object.assign(RESORT, { lat: R.origin.lat, lon: R.origin.lon, name: R.name }); // all Colorado so far: Denver time
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

  const [snowD, snowN, rockD] = await Promise.all([load("snow_02_diff_1k.jpg", true), load("snow_02_nor_gl_1k.jpg"), load("aerial_rocks_02_diff_1k.jpg", true)]);
  await status("生成山体和阴影…");
  const T = new Terrain(R);
  const mask = treeMaskFn(R, T);
  const geo = terrainMesh(T, mask);
  const ground = new THREE.Mesh(geo, snowMaterial(snowD, snowN, rockD));
  const ranges = farTerrain(far, T);
  ranges.material = snowMaterial(snowD, snowN, rockD);
  // Everything on the mountain lives in one group, stretched vertically for relief.
  const world = new THREE.Group();
  world.scale.y = EXAG;
  const dome = skyDome(), cloudLayer = clouds(900);
  scene.add(dome, cloudLayer, world);
  world.add(ground, ranges);
  await status("种树、画雪道…");
  world.add(forest(T, mask));
  let runLayer = runs(T, R.runs);
  world.add(runLayer);
  let liftLayer = liftMarks(T, R.lifts, LIFT_STYLE);
  world.add(liftLayer);
  const lifts = new Lifts(T, R.lifts);
  world.add(lifts.group);
  lifts.group.visible = false; // on the whole mountain, lifts are drawn as lines on the snow (liftMarks)
  const hemi = new THREE.HemisphereLight(0xcfe2ff, 0x7d88a3, 0.35);
  const sun = new THREE.DirectionalLight(0xfff0dc, 3.6);
  scene.add(hemi, sun);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const physSky = new Sky();
  physSky.scale.setScalar(10000);
  physSky.material.uniforms.rayleigh.value = 1.4;
  physSky.material.uniforms.turbidity.value = 2;
  const envScene = new THREE.Scene();
  envScene.add(physSky);
  const snowfall = snowParticles();
  scene.add(snowfall);

  // Light the scene for a moment in time and a kind of weather.
  let shadedFor = "";
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
    const u = dome.material.uniforms;
    u.sun.value.copy(dir); u.top.value.copy(p.top); u.mid.value.copy(p.mid); u.hor.value.copy(p.hor);
    u.glow.value.copy(p.sun).multiplyScalar(look.kind === "clear" ? 1 : 0.3);
    scene.fog.color.copy(p.hor);
    look.fog = p.fog;
    const lightDir = day ? dir : new THREE.Vector3(0.3, 0.5, -0.4).normalize(); // moonlight at night
    sun.position.copy(lightDir).multiplyScalar(1000);
    sun.color.copy(day ? p.sun : new THREE.Color(0x8fa6e0));
    sun.intensity = day ? p.si : 0.5;
    hemi.intensity = p.amb;
    renderer.toneMappingExposure = p.exp;
    cloudLayer.children.forEach((c, i) => {
      c.material.opacity = Math.min(0.95, p.clouds * (i % 3 === 0 || look.kind !== "clear" ? 0.95 : 0.25));
      c.material.color.copy(p.hor).lerp(new THREE.Color(0xffffff), 0.6);
    });
    snowfall.visible = look.kind === "snow";
    physSky.material.uniforms.sunPosition.value.copy(lightDir);
    scene.environment?.dispose();
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    scene.environmentIntensity = day ? 0.35 : 0.12;
    // Re-cast mountain shadows only when the sun has moved noticeably.
    const key = `${Math.round(elDeg / 3)}:${Math.round((s0.az * 180) / Math.PI / 6)}:${look.kind}`;
    if (key !== shadedFor) { shadedFor = key; shadeTerrain(geo, T, mask, lightDir, day ? p.shadow : 0.4); }
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
  toggle("runs", (on) => (runLayer.visible = on));
  toggle("lifts", (on) => (liftLayer.visible = on));
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

  // ---------- A base as a miniature world: 10 s around it, then pick a lift ----------
  const graph = buildGraph(R, (x, z) => T.heightAt(x, z));
  const dio = new Diorama(renderer);
  let mini = null; // { base, lifts, t0, intro }
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
  function openBase(base) {
    const ls = liftsAt(base).filter((l) => RIDEABLE.includes(l.kind)); // carpets and drag lifts aren't ridden in the game
    // Seen from the base looking up its main lift: the turn starts and ends there, the name plate on that side.
    const main = [...ls].sort((a, b) => b.rise - a.rise)[0];
    const u0 = main ? dio.facing(main) : 0;
    dio.build({ T, R, mask, graph, base, lifts: ls, title: base.name, front: -Math.PI / 4 + u0 * Math.PI * 2 });
    spin = u0;
    mini = { base, lifts: ls, info: new Map(ls.map((l) => [l, liftInfo(l)])), t0: performance.now(), intro: true, pick: null, spinTo: null, raise: 0, spin0: u0 };
    document.body.classList.add("mini");
    document.body.classList.remove("picking", "detail");
    $("introSkip").hidden = false;
    $("miniTitle").textContent = base.name;
    $("miniKick").textContent = RESORT.name;
    $("miniSub").textContent = EN ? `${Math.round(T.heightAt(base.x, base.z) + (R.hmin || 0)).toLocaleString("en-US")} m · ${ls.length} lifts` : `海拔 ${Math.round(T.heightAt(base.x, base.z) + (R.hmin || 0)).toLocaleString("en-US")} m · 缆车 ${ls.length} 条`;
    $("planOut").hidden = true;
    document.querySelectorAll("[data-plan]").forEach((x) => x.classList.remove("on"));
    dio.highlightFrom(null);
    dio.focusLift(null);
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
      card.querySelector(".go").addEventListener("click", () => go(l));
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
    dio.focusLift(l);
    for (const [x, info] of mini.info) {
      info.tag.classList.toggle("on", x === l);
      info.card.classList.toggle("on", x === l);
    }
    if (route) { dio.highlightRoute(route); dio.aim(l, route); }
    else if (changed) { dio.aim(l, [...dio.highlightFrom(l).fromTop]); $("planOut").hidden = true; $("legend").hidden = false; document.querySelectorAll("[data-plan]").forEach((x) => x.classList.remove("on")); }
    if (changed) {
      // Turn the model so the lift is seen from below, the short way round.
      let u = dio.facing(l);
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
      <h3><img src="${IC("layer_runs")}" alt="">山顶直接出发的雪道</h3>${byLevel.length ? byLevel.map((g) => `<p class="runs">${g.map((r) => `<span>${SYMBOL[r.level]}${r.name}</span>`).join("")}</p>`).join("") : "<p class=meta>没有直接出发的雪道</p>"}
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
  function go2(l) { if (mini?.base) addStep(RESORT_ID, { k: "base", name: mini.base.name }); location.href = `../look.html?lift=${encodeURIComponent(l.name)}&resort=${RESORT_ID}`; }

  // Quick plans along the top: a loop from this base at a level, lit run by run.
  document.querySelectorAll("[data-plan]").forEach((b) => b.addEventListener("click", () => {
    if (!mini || mini.intro) return;
    const level = b.dataset.plan, out = $("planOut");
    const was = b.classList.contains("on");
    document.querySelectorAll("[data-plan]").forEach((x) => x.classList.toggle("on", !was && x === b));
    if (was) { out.hidden = true; $("legend").hidden = false; dio.highlightFrom(mini.pick); return; }
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
    dio.aim(null);
    dio.focusLift(null);
    spin = spin % 1;
    mini.spin0 = spin;
    document.body.classList.remove("picking");
    $("introSkip").hidden = false;
  });
  $("miniBack").addEventListener("click", () => { mini = null; document.body.classList.remove("mini", "picking", "detail"); });
  addEventListener("resize", () => dio.resize());
  window.__mtn = { scene, renderer, camera, world, T, R, get runLayer() { return runLayer; }, get lifts() { return lifts; }, look, applyLook, THREE, // test hook
    restyle(run, lift) { // try a line style: rebuild the runs, and the lifts' marks on the snow (null: none)
      world.remove(runLayer); runLayer = runs(T, R.runs, { ...RUN_STYLE, ...run }); world.add(runLayer);
      if (liftLayer) world.remove(liftLayer); liftLayer = lift ? liftMarks(T, R.lifts, lift) : null; if (liftLayer) world.add(liftLayer);
      if (lift?.cables === false) lifts.group.visible = false; } };
  window.__mini = { dio, get mini() { return mini; }, endIntro, openDetail, pickLift: (name) => pickLift(mini.lifts.find((l) => l.name === name), { scroll: true }) }; // test hook
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
      const p = dio.screenOf(info.l), tag = info.tag;
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
        const u = Math.min(1, (now - mini.t0) / 10000); // one turn in ten seconds
        spin = (mini.spin0 || 0) + ease(u);
        if (u >= 1) endIntro();
      } else if (mini.spinTo != null) {
        spin += (mini.spinTo - spin) * (1 - Math.exp(-dt * 3.5));
        if (Math.abs(mini.spinTo - spin) < 1e-4) mini.spinTo = null;
      }
      const glide = 1 - Math.exp(-dt * 3.5); // glide and zoom to the chosen lift
      dio.focus.lerp(dio.focusTo, glide);
      dio.size += (dio.sizeTo - dio.size) * glide;
      // A fixed frame between the top bar and the cards, so the model never shrinks; the detail
      // sheet only raises it.
      const topPx = 100, botPx = 150, want = document.body.classList.contains("detail") ? 0.2 : 0;
      mini.raise += (want - mini.raise) * (1 - Math.exp(-dt * 6));
      dio.orbit(spin, Math.max(0.4, 1 - (topPx + botPx) / innerHeight), topPx / innerHeight, mini.raise);
      placeTags();
      dio.render(t);
      return;
    }
    lifts.update(t);
    controls.update();
    // the painted compass turns with the view (its needle leans 38° east in the picture)
    { const ci = document.querySelector("#compassBtn img"); if (ci) ci.style.transform = `rotate(${(controls.getAzimuthalAngle() * 180 / Math.PI - 38).toFixed(1)}deg)`; }
    // Fog counts from the resort, not from the camera: this view looks from many km out, and in snow a
    // fog a few km deep would hide the whole mountain. Past the resort it closes in as the weather says.
    if (look.fog) { const d = camera.position.distanceTo(controls.target); scene.fog.near = d * 0.8 + look.fog[0]; scene.fog.far = d + look.fog[1]; }
    renderer.render(scene, camera);
    placePins();
  });
}
main().catch((e) => { $("status").textContent = `加载失败：${e.message}`; console.error(e); });
translatePage(); // English, if chosen on the start page
document.getElementById("navBtn").onclick = () => openNav("../");
document.querySelector("#navBtn img").src = `../assets/icons/${myAvatar()}.png?v=1`;
document.getElementById("backBtn").onclick = () => { location.href = "../start.html?tab=resort"; };
