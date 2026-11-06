// The detailed facility models (built in Blender by blender/build.py) on a snowy slope, in game light.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const VIEWS = {
  all: { label: "全景", cap: "山腰餐厅、巡逻医疗站、8 人吊厢，云杉", pos: [26, 11, 40], at: [-5, 4, 2] },
};
const SCENES = {
  lodge: { label: "餐厅", cap: "石头墙基、原木墙、暖光玻璃山墙、厚雪屋顶和冰柱、露台", pos: [9, 5, 21], at: [0, 4, 0] },
  cabin: { label: "吊厢", cap: "8 人吊厢：圆润车身、烟色玻璃、银色饰条、里面的座椅", pos: [8.5, 11.2, 18.5], at: [6, 10, 14] },
  hut: { label: "医疗站", cap: "巡逻医疗站：红十字、救援雪橇、小长椅", pos: [-14, 3, 16], at: [-22, 2, 6] },
};
const q = new URLSearchParams(location.search);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xdfe8f1); scene.fog = new THREE.Fog(0xdfe8f1, 80, 330);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1200);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;

// Sky and the painted mountains all round.
const SUN = new THREE.Vector3(-0.55, 0.62, 0.55).normalize();
scene.add(new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { sun: { value: SUN } },
  vertexShader: "varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform vec3 sun; varying vec3 vD; void main() { float h = clamp(vD.y, 0.0, 1.0); vec3 c = mix(vec3(0.90, 0.93, 0.97), vec3(0.36, 0.56, 0.84), pow(h, 0.55)); float s = max(dot(vD, sun), 0.0); c += vec3(1.0, 0.93, 0.78) * (pow(s, 10.0) * 0.4 + pow(s, 400.0) * 1.2); gl_FragColor = vec4(c, 1.0); }" })));
const wc = new THREE.TextureLoader().load("../../assets/wc/copper.jpg?v=1"); wc.colorSpace = THREE.SRGBColorSpace; wc.wrapS = THREE.MirroredRepeatWrapping; wc.repeat.set(5, 1);
const ring = new THREE.Mesh(new THREE.CylinderGeometry(400, 400, 150, 64, 1, true), new THREE.MeshBasicMaterial({ map: wc, side: THREE.BackSide, fog: false, transparent: true, opacity: 0.9 }));
{ const uv = ring.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 0.12 + uv.getY(i) * 0.5); }
ring.position.y = 40; scene.add(ring);

scene.add(new THREE.HemisphereLight(0xdfeaff, 0xcfc6b6, 1.0));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.8); sun.position.copy(SUN).multiplyScalar(80); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, far: 220 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

// Snow underfoot: gentle rolls, a faint grain.
const ground = new THREE.PlaneGeometry(1600, 700, 320, 140); ground.rotateX(-Math.PI / 2);
const P = ground.attributes.position, hgt = (x, z) => { const r = Math.hypot(x, z); return r < 26 || x > 140 ? 0 : Math.min(1, (140 - x) / 60) * (Math.sin(x * 0.07) * Math.cos(z * 0.05) * 1.2 + Math.max(0, -z - 30) * 0.12) * Math.min(1, (r - 26) / 20); };
for (let i = 0; i < P.count; i++) P.setY(i, hgt(P.getX(i), P.getZ(i)));
ground.computeVertexNormals();
const nor = new THREE.TextureLoader().load("../../assets/tex/snow_02_nor_gl_1k.jpg"); nor.wrapS = nor.wrapT = THREE.RepeatWrapping; nor.repeat.set(90, 90);
const snowMesh = new THREE.Mesh(ground, new THREE.MeshStandardMaterial({ color: 0xf6f8fc, roughness: 0.85, normalMap: nor, normalScale: new THREE.Vector2(0.35, 0.35) }));
snowMesh.receiveShadow = true; scene.add(snowMesh);

// What a lit room looks like through the glass: a dark timber ceiling, pendant lamps, a warm glow, the
// shapes of tables and people low down. Mapped onto the panes by where they are on the wall.
const ROOM = (() => {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "#1c120b"); g.addColorStop(0.3, "#5a3519"); g.addColorStop(0.6, "#b0692c"); g.addColorStop(1, "#6a3c1b");
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 5; i++) {
    const cx = 50 + i * 103, cy = 70 + (i % 2) * 12, h = x.createRadialGradient(cx, cy, 2, cx, cy, 70);
    h.addColorStop(0, "rgba(255,214,150,0.9)"); h.addColorStop(0.15, "rgba(255,170,90,0.45)"); h.addColorStop(1, "rgba(255,150,70,0)");
    x.fillStyle = h; x.fillRect(cx - 80, cy - 80, 160, 160); x.fillStyle = "#2a1a10"; x.fillRect(cx - 1, 0, 2, cy - 6);
  }
  x.fillStyle = "rgba(30,18,10,0.85)";
  for (let i = 0; i < 9; i++) { const cx = 25 + i * 57 + (i % 3) * 7; x.fillRect(cx - 22, 190, 44, 6); x.fillRect(cx - 3, 196, 6, 60); x.beginPath(); x.ellipse(cx + 26 * (i % 2 ? 1 : -1), 170, 9, 11, 0, 0, 7); x.fill(); x.fillRect(cx + 26 * (i % 2 ? 1 : -1) - 11, 180, 22, 76); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})();
function roomUV(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { const side = Math.abs(n.getX(i)) > Math.abs(n.getZ(i)); uv[i * 2] = (side ? p.getZ(i) : p.getX(i)) / 6.5; uv[i * 2 + 1] = (p.getY(i) - 1.0) / 4.2; }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

const VER = q.get("v") || "7";
const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/"));
// Snow can be thinned or taken away: the layer shrinks along its normals (0 deep, 0.12 light, off: hidden).
const SNOW = { thin: { value: 0 } }, snowMeshes = [];
const load = (n) => new Promise((ok, no) => loader.load(`glb/${n}.glb?v=${VER}`, (g) => {
  // Baked parts carry their materials and contact shade; the sun and sky light them live. Windows are
  // dark glass with the room's warm light behind; lamps glow.
  g.scene.traverse((o) => {
    if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true; const m = o.material;
    if (/^window/.test(m.name)) { roomUV(o.geometry); o.material = new THREE.MeshStandardMaterial({ color: 0x141a20, roughness: 0.06, metalness: 0.3, emissive: 0xffffff, emissiveMap: ROOM, emissiveIntensity: 1, envMapIntensity: 1.8 }); }
    else if (/^lamp/.test(m.name)) o.material = new THREE.MeshBasicMaterial({ color: 0xffe2b0 });
    else if (m.transparent) { o.castShadow = false; m.envMapIntensity = 1.6; m.roughness = 0.05; }
    else if (/_snow_mat$/.test(m.name)) {
      m.onBeforeCompile = (sh) => { sh.uniforms.thin = SNOW.thin; sh.vertexShader = "uniform float thin;\n" + sh.vertexShader.replace("#include <begin_vertex>", "vec3 transformed = position - normal * thin;"); };
      snowMeshes.push(o);
    } else m.envMapIntensity = 0.5;
  });
  ok(g.scene);
}, undefined, no));
const [lodge, cabin, hut, pine] = await Promise.all(["restaurant", "gondola", "firstaid", "pine"].map(load));
scene.add(lodge);
hut.position.set(-22, 0, 6); hut.rotation.y = 0.45; scene.add(hut);
// The gondola line: two ropes passing in front, cabins on both.
const ropeMat = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.5, metalness: 0.4 });
for (const [z, y0, y1, xs, dir] of [[14, 9, 16, [-14, 6, 26], 1], [20, 9.2, 16.2, [-4, 18], -1]]) {
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-90, y0, z), new THREE.Vector3(0, (y0 + y1) / 2 - 1.2, z), new THREE.Vector3(90, y1, z));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.04, 6), ropeMat); m.castShadow = true; scene.add(m);
  for (const x of xs) { const c = cabin.clone(); const u = (x + 90) / 180; c.position.copy(curve.getPoint(u)); c.rotation.y = dir > 0 ? 0 : Math.PI; scene.add(c); }
}
// Spruces round the clearing.
const rng = (() => { let s = 3; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
for (let i = 0; i < 90; i++) {
  const a = rng() * Math.PI * 2, r = 28 + rng() * 70, x = Math.cos(a) * r, z = Math.sin(a) * r - 10;
  if (z > 30 && Math.abs(x) < 40) continue;
  const t = pine.clone(); const s = 0.75 + rng() * 0.6; t.scale.setScalar(s); t.position.set(x, hgt(x, z) - 0.2, z); t.rotation.y = rng() * 6; scene.add(t);
}
for (const [x, z, s] of [[-12, -6, 1.1], [13, -9, 1.2], [-30, -2, 0.9], [20, 4, 0.85]]) { const t = pine.clone(); t.scale.setScalar(s); t.position.set(x, 0, z); scene.add(t); }

// The catalogue: each family in a row of its own off to the east, carriers hung from a rope.
const FAMILIES = [["lifts", "缆车"], ["stations", "站台"], ["signs", "路牌"], ["buildings", "建筑"], ["props", "道具"]];
const rows = {};
await Promise.all(FAMILIES.map(async ([f], fi) => {
  const list = await (await fetch(`glb/${f}.json?v=${Date.now()}`)).json().catch(() => []);
  const items = (await Promise.all(list.map((e) => load(e.name).then((o) => [e, o]).catch(() => null)))).filter(Boolean);
  let x = 200; const z = -fi * 70, row = [];
  for (const [e, o] of items) {
    const box = new THREE.Box3().setFromObject(o), w = box.max.x - box.min.x;
    x += w / 2; o.position.set(x - (box.min.x + box.max.x) / 2, e.hang ? 8 : 0, z); scene.add(o);
    if (e.hang) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, w + 4, 6), ropeMat); r.rotation.z = Math.PI / 2; r.position.set(x, 8, z); scene.add(r); }
    row.push({ e, o, x, z, size: Math.max(w, box.max.y - box.min.y, box.max.z - box.min.z) }); x += w / 2 + 4;
  }
  rows[f] = row;
}));

let view = q.get("view") || "all", item = 0;
const frame = (r) => { const y = r.e.hang ? 8 - r.size * 0.35 : r.size * 0.35, d = r.size * 1.5 + 3; return { pos: [r.x + d * 0.45, y + d * 0.3, r.z + d], at: [r.x, y, r.z], cap: r.e.label }; };
function go(v, k = 0) {
  view = v; item = k;
  const row = rows[v], V = VIEWS[v] || SCENES[v] || (row?.length ? frame(row[(k + row.length) % row.length]) : { pos: [260, 20, 60], at: [240, 0, 0], cap: "还没有模型" });
  camera.position.set(...V.pos); controls.target.set(...V.at); controls.update();
  sun.target.position.set(...V.at); sun.position.copy(SUN).multiplyScalar(80).add(sun.target.position);
  document.getElementById("cap").textContent = row ? `${V.cap}  ·  ${(k % row.length + row.length) % row.length + 1} / ${row.length}` : V.cap;
  const bar = document.getElementById("bar"); bar.innerHTML = "";
  const btn = (t, on, f) => { const b = document.createElement("button"); b.textContent = t; b.className = on ? "on" : ""; b.onclick = f; bar.append(b); };
  btn("全景", v === "all", () => go("all"));
  for (const [f, l] of FAMILIES) btn(`${l} ${rows[f]?.length || 0}`, v === f, () => go(f));
  if (row?.length > 1) { btn("‹", false, () => go(v, item - 1)); btn("›", false, () => go(v, item + 1)); }
  for (const [t, k2] of [["厚雪", 0], ["薄雪", 0.12], ["无雪", -1]]) btn(t, (k2 < 0 ? !snowMeshes[0]?.visible : snowMeshes[0]?.visible && SNOW.thin.value === k2), () => { SNOW.thin.value = Math.max(0, k2); for (const m of snowMeshes) m.visible = k2 >= 0; go(view, item); });
}
function size() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", size); size(); go(view, +(q.get("item") || 0));
if (q.get("snow")) { const k = { light: 0.12, none: -1 }[q.get("snow")] ?? 0; SNOW.thin.value = Math.max(0, k); for (const m of snowMeshes) m.visible = k >= 0; }
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
window.__ready = true;
