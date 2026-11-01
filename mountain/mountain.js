// Style frame for step 1 of the art direction: the mountain alone, semi-realistic.
// Real terrain, runs and lifts; a bright winter day; resort-map run colors on white snow.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Sky } from "three/addons/objects/Sky.js";
import { Terrain, farTerrain, treeMaskFn, ribbon, Lifts } from "../world.js?v=5";

const SUN = new THREE.Vector3(-0.62, 0.46, 0.62).normalize(); // mid-afternoon from the south-west: long shadows model the ridges
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
    uniforms: { sun: { value: SUN } },
    vertexShader: "varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `varying vec3 v; uniform vec3 sun;
      void main(){
        float h = clamp(v.y, -0.05, 1.0);
        vec3 horizon = vec3(0.80, 0.89, 0.97), mid = vec3(0.36, 0.62, 0.93), top = vec3(0.10, 0.33, 0.78);
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.22, h));
        c = mix(c, top, smoothstep(0.22, 0.9, h));
        float s = max(dot(normalize(v), sun), 0.0);
        c += vec3(1.0, 0.92, 0.78) * (pow(s, 8.0) * 0.18 + pow(s, 600.0) * 1.2);
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

function terrainMesh(T, mask) {
  const { gw, gh } = T;
  const pos = new Float32Array(gw * gh * 3), col = new Float32Array(gw * gh * 3);
  const shadow = new THREE.Color(0x8ea6d6), forestFloor = new THREE.Color(0xb7c2cf), c = new THREE.Color();
  for (let r = 0; r < gh; r++) {
    for (let j = 0; j < gw; j++) {
      const k = r * gw + j, x = T.x0 + j * T.cell, z = T.z0 + ((T.z1 - T.z0) * r) / (gh - 1), y = T.h[k];
      pos.set([x, y, z], k * 3);
      c.set(0xffffff);
      if (mask(x, z)) c.lerp(forestFloor, 0.5);
      c.lerp(shadow, T.sunShadow(x, z, y) * 0.7);
      col.set([c.r, c.g, c.b], k * 3);
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
  const tiers = [[0.6, 6.5, 3.6], [4.2, 6.0, 2.8], [7.8, 5.2, 2.0], [11.0, 4.6, 1.1]];
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
      c.copy(needles).lerp(snow, Math.min(0.7, up * (0.35 + 0.45 * top) * (0.5 + 0.7 * lump)));
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
    if (!mask.at(c, r) || rand() > 0.1) continue;
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
      const k = 1.0 + v * 0.9;
      m.compose(p.set(x, T.heightAt(x, z) - 0.5, z), q.setFromAxisAngle(Y, v * 6.28), sc.set(k, k * (0.9 + v * 0.4), k));
      mesh.setMatrixAt(i, m);
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}

// Runs as on a resort map: a white casing and a colored core.
function runs(T, list) {
  const group = new THREE.Group();
  const casing = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const mats = {};
  for (const run of list) {
    const pts = run.outline || run.pts;
    if (!run.area) group.add(new THREE.Mesh(ribbon(T, pts, 22, 0.6), casing));
    mats[run.level] ??= new THREE.MeshBasicMaterial({ color: RUN_COLOR[run.level], transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    group.add(new THREE.Mesh(ribbon(T, pts, run.area ? 6 : 11, 0.8), mats[run.level]));
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
let liftTags = [], liftGlow = null;
function chooseBase(T, R, base, basePins) {
  const lifts = R.lifts.filter((l) => Math.hypot(l.pts[0][0] - base.x, l.pts[0][1] - base.z) < BASE_RADIUS)
    .sort((a, b) => Math.hypot(a.pts[0][0] - base.x, a.pts[0][1] - base.z) - Math.hypot(b.pts[0][0] - base.x, b.pts[0][1] - base.z));
  basePins.forEach((p) => p.el.classList.toggle("on", p.base === base));
  liftTags.forEach((t) => { t.el.remove(); pins.splice(pins.indexOf(t), 1); });
  liftTags = [];
  if (liftGlow) scene.remove(liftGlow);
  liftGlow = new THREE.Group();
  const glow = new THREE.MeshBasicMaterial({ color: 0xe0402f, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 });
  for (const l of lifts) {
    liftGlow.add(new THREE.Mesh(ribbon(T, l.pts, 9, 1.2), glow));
    const top = l.pts[l.pts.length - 1];
    liftTags.push(pin(`🚡 ${l.name}`, "tag", new THREE.Vector3(top[0], T.heightAt(top[0], top[1]) + 40, top[1])));
  }
  scene.add(liftGlow);
  // Fly to the base, looking up the mountain along its lifts.
  const tops = lifts.map((l) => l.pts[l.pts.length - 1]);
  const ux = tops.reduce((a, t) => a + t[0], 0) / Math.max(1, tops.length) - base.x, uz = tops.reduce((a, t) => a + t[1], 0) / Math.max(1, tops.length) - base.z;
  const len = Math.hypot(ux, uz) || 1, y = T.heightAt(base.x, base.z);
  controls.target.set(base.x + (ux / len) * 900, y + 250, base.z + (uz / len) * 900);
  camera.position.set(base.x - (ux / len) * 1700 + (uz / len) * 500, y + 1000, base.z - (uz / len) * 1700 - (ux / len) * 500);
  controls.autoRotate = false;
  $("spin").classList.remove("on");
  $("baseName").textContent = `🏠 ${base.name}`;
  $("baseMeta").textContent = `山脚海拔 ${Math.round(T.data.hmin + y)} 米 · 从这里出发有 ${lifts.length} 条缆车`;
  $("baseLifts").innerHTML = lifts.map((l) => {
    const top = l.pts[l.pts.length - 1];
    return `<li><span>🚡 ${l.name}</span><small>爬升 ${l.rise} 米 · 山顶 ${Math.round(T.data.hmin + T.heightAt(top[0], top[1]))} 米</small></li>`;
  }).join("");
  $("base").classList.add("show");
}

const VIEWS = {
  hero: (c) => ({ target: [c.x, c.y + 450, c.z + 400], pos: [c.x + 2900, c.y + 1500, c.z - 6600] }),
  close: (c) => ({ target: [c.x - 300, c.y + 450, c.z + 300], pos: [c.x + 900, c.y + 1300, c.z - 2300] }),
  top: (c) => ({ target: [c.x, c.y, c.z], pos: [c.x + 200, c.y + 9000, c.z - 1200] }),
};
let center;
function setView(name) {
  const v = VIEWS[name](center);
  controls.target.set(...v.target);
  camera.position.set(...v.pos);
  document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("on", b.dataset.view === name));
}

async function main() {
  await status("下载地形…");
  const [R, far] = await Promise.all([fetch("../data/copper.json").then((r) => r.json()), fetch("../data/copper-far.json").then((r) => r.json())]);
  const [snowD, snowN, rockD] = await Promise.all([load("snow_02_diff_1k.jpg", true), load("snow_02_nor_gl_1k.jpg"), load("aerial_rocks_02_diff_1k.jpg", true)]);
  await status("生成山体和阴影…");
  const T = new Terrain(R);
  const mask = treeMaskFn(R, T);
  const ground = new THREE.Mesh(terrainMesh(T, mask), snowMaterial(snowD, snowN, rockD));
  const ranges = farTerrain(far, T);
  ranges.material = snowMaterial(snowD, snowN, rockD);
  scene.add(skyDome(), clouds(T.data.hmin > 0 ? 900 : 900), ground, ranges);
  await status("种树、画雪道…");
  scene.add(forest(T, mask));
  const runLayer = runs(T, R.runs);
  scene.add(runLayer);
  const lifts = new Lifts(T, R.lifts);
  scene.add(lifts.group);
  // Light: one warm sun, a cool sky fill, and image-based light from a physical sky.
  scene.add(new THREE.HemisphereLight(0xcfe2ff, 0x7d88a3, 0.35));
  const sun = new THREE.DirectionalLight(0xfff0dc, 3.6);
  sun.position.copy(SUN).multiplyScalar(1000);
  scene.add(sun);
  const sky = new Sky();
  sky.scale.setScalar(10000);
  Object.assign(sky.material.uniforms, {});
  sky.material.uniforms.sunPosition.value.copy(SUN);
  sky.material.uniforms.rayleigh.value = 1.4;
  sky.material.uniforms.turbidity.value = 2;
  const env = new THREE.Scene();
  env.add(sky);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(env, 0.04).texture;
  scene.environmentIntensity = 0.35;

  const all = R.runs.flatMap((r) => r.pts);
  const cx = all.reduce((a, p) => a + p[0], 0) / all.length, cz = all.reduce((a, p) => a + p[1], 0) / all.length;
  center = { x: cx, z: cz, y: T.heightAt(cx, cz) };
  setView("hero");
  $("status").remove();

  const basePins = R.places.filter((p) => p.kind === "village").map((base) => {
    const item = pin(`<b>🏠 ${base.name}</b><i></i>`, "pin", new THREE.Vector3(base.x, T.heightAt(base.x, base.z) + 60, base.z), () => chooseBase(T, R, base, basePins));
    item.base = base;
    return item;
  });
  $("baseClose").addEventListener("click", () => {
    $("base").classList.remove("show");
    basePins.forEach((p) => p.el.classList.remove("on"));
    liftTags.forEach((t) => { t.el.remove(); pins.splice(pins.indexOf(t), 1); });
    liftTags = [];
    if (liftGlow) scene.remove(liftGlow);
    setView("hero");
  });

  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  const toggle = (id, fn) => $(id).addEventListener("click", () => { $(id).classList.toggle("on"); fn($(id).classList.contains("on")); });
  toggle("spin", (on) => (controls.autoRotate = on));
  toggle("runs", (on) => (runLayer.visible = on));
  toggle("lifts", (on) => (lifts.group.visible = on));
  renderer.domElement.addEventListener("pointerdown", () => { controls.autoRotate = false; $("spin").classList.remove("on"); });

  let t = 0, last = performance.now();
  renderer.setAnimationLoop((now) => {
    t += (now - last) / 1000; last = now;
    lifts.update(t);
    controls.update();
    renderer.render(scene, camera);
    placePins();
  });
}
main().catch((e) => { $("status").textContent = `加载失败：${e.message}`; console.error(e); });
