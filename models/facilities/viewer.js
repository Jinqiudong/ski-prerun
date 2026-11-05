// A catalogue of the facility models, in either look, with a few set views. ?look=ink|miniature&view=…
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { setLook, inkLines, at, group, PALETTE } from "./kit.js";
import { chair, cabin, tbar, tower, terminalDetach, terminalFixed, rope } from "./lifts.js";
import { runSign, junction, notice, mapBoard, ropeLine } from "./signs.js";
import { restaurant, yurt } from "./buildings.js";

const q = new URLSearchParams(location.search);
let lookName = q.get("look") || "miniature", view = q.get("view") || "hero";
const VIEWS = {
  hero: { label: "全景", cap: "站台、塔架、缆车线和吊椅，山腰的餐厅和路牌", pos: [-34, 19, -24], at: [4, 5, 22] },
  chairs: { label: "吊椅", cap: "左起：6 人带罩（高速）· 4 人高速 · 2 人固定抱索 · 8 人吊厢 · 10 人吊厢 · T 型拖牵", pos: [-4, 4.6, 21], at: [0.9, 3.3, 0], base: [0, 0, -260] },
  stations: { label: "站台", cap: "高速缆车站（大罩子）和固定抱索的露天大轮站", pos: [20, 12, 24], at: [0, 4, 0], base: [0, 0, -520] },
  signs: { label: "路牌", cap: "雪道牌 · 路口指示 · 下缆车提示 · 减速牌 · 雪场地图板 · 封闭绳", pos: [0.5, 3.4, 17], at: [0.5, 1.9, -1], base: [0, 0, -780] },
  lodge: { label: "建筑", cap: "山腰餐厅（露台、桌子、雪板架）和取暖帐篷", pos: [-14, 9, 26], at: [2, 3, 2], base: [0, 0, -1040] },
};

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
let scene, sun;

function build() {
  setLook(lookName);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(lookName === "ink" ? 0xf1ece0 : 0xcfe0ee);
  scene.fog = new THREE.Fog(scene.background, 120, 200);
  scene.add(new THREE.HemisphereLight(0xeaf2ff, 0xd9d2c4, lookName === "ink" ? 0.7 : 1.1));
  sun = new THREE.DirectionalLight(0xfff1dc, lookName === "ink" ? 2.4 : 2.6);
  sun.position.set(-40, 60, 30); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, far: 300 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: lookName === "ink" ? 0xf6f3ec : 0xf4f6fa, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const W = new THREE.Group(); scene.add(W);
  // Hero: a six-pack line from its terminal up past two towers, the restaurant above, signs at the top.
  const P = PALETTE.blue, gauge = 6.2;
  W.add(terminalDetach({ paint: P, gauge, name: "American Flyer" }));
  const t1 = tower({ h: 11, gauge, paint: P, num: 1 }), t2 = tower({ h: 13, gauge, paint: P, num: 2 });
  W.add(at(t1.root, 0, 0, 22), at(t2.root, 0, 0, 52));
  for (const s of [-1, 1]) {
    const a = rope([s * gauge / 2, 7.0, 4], [s * gauge / 2, t1.rope, 22], 0.4), b = rope([s * gauge / 2, t1.rope, 22], [s * gauge / 2, t2.rope, 52], 1.2);
    W.add(a.mesh, b.mesh);
    for (const [r, us] of [[a, [0.75]], [b, [0.3, 0.75]]]) for (const u of us) { const p = r.at(u), c = chair({ seats: 6, bubble: s > 0 || u > 0.5, paint: P }); c.position.copy(p); if (s < 0) c.rotation.y = Math.PI; W.add(c); }
  }
  W.add(at(restaurant({}), 26, 0, 40, 0, -Math.PI / 2 + 0.3));
  W.add(at(runSign("Main Vein", "blue"), 9, 0, 12, 0, -0.5));
  W.add(at(junction([["Andy's Encore", "blue", 0], ["Hallelujah", "black", 0.9], ["Soliloquy", "green", -0.7]]), 12, 0, 30, 0, -0.6));
  W.add(at(ropeLine(12, { closed: true }), -14, 0, 26, 0, 0.4));

  // Carriers in a row on a bar.
  const C = group(); C.position.set(...VIEWS.chairs.base); W.add(C);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 26, 8), new THREE.MeshStandardMaterial({ color: 0x2b2d31 })); bar.rotation.z = Math.PI / 2; bar.position.y = 6.4; C.add(bar);
  [[-8.6, chair({ seats: 6, bubble: true, paint: P })], [-3.6, chair({ seats: 4, paint: PALETTE.red, pad: 0x2b2b2b })], [0.6, chair({ seats: 2, detach: false, paint: 0x5d6a74 })],
   [3.9, cabin({ seats: 8, paint: PALETTE.red })], [7.3, cabin({ seats: 10, paint: 0x2f5446 })], [10.2, tbar({})]].forEach(([x, m]) => { m.position.set(x, 6.4, 0); C.add(m); });

  // Stations.
  const S = group(); S.position.set(...VIEWS.stations.base); W.add(S);
  S.add(at(terminalDetach({ paint: PALETTE.red, gauge, name: "Super Bee" }), -9, 0, 0, 0, Math.PI));
  S.add(at(terminalFixed({ paint: 0x5d6a74, gauge: 4.2 }), 10, 0, 0, 0, Math.PI));
  const tt = tower({ h: 6, gauge: 4.2, surface: true, paint: PALETTE.orange, wheels: 2, num: 0 }); S.add(at(tt.root, 22, 0, -4));

  // Signs.
  const G = group(); G.position.set(...VIEWS.signs.base); W.add(G);
  G.add(at(runSign("Bittersweet", "green"), -9.5, 0, 0));
  G.add(at(runSign("Andy's Encore", "blue"), -6.6, 0, 0));
  G.add(at(runSign("Enchanted Forest", "black"), -3.4, 0, 0));
  G.add(at(junction([["Union Meadows", "green", 0], ["Rhapsody", "double", 0.6], ["Hallelujah", "park", -0.5]]), 0.6, 0, -0.3, 0, -0.2));
  G.add(at(notice("PREPARE TO UNLOAD", { sub: "Raise the bar · 准备下缆车" }), 6.6, 0, -0.6));
  G.add(at(notice("SLOW", { bg: "#e8c547", fg: "#1d1f22", h: 0.7 }), 10.4, 0, -0.4));
  G.add(at(mapBoard(drawMap), 1, 0, -7));
  G.add(at(ropeLine(9, { closed: true }), -10, 0, 3.2));

  // Buildings.
  const B = group(); B.position.set(...VIEWS.lodge.base); W.add(B);
  B.add(at(restaurant({}), 0, 0, 0));
  B.add(at(yurt({}), -16, 0, 6));
  inkLines(W);
}

// A little painted trail map for the board.
function drawMap(x, w, h) {
  x.fillStyle = "#f3ead8"; x.fillRect(0, 0, w, h);
  x.fillStyle = "#dfe6ee"; x.beginPath(); x.moveTo(0, h); x.lineTo(w * 0.3, h * 0.2); x.lineTo(w * 0.55, h * 0.35); x.lineTo(w * 0.8, h * 0.12); x.lineTo(w, h); x.fill();
  const runs = [["#2f8a4e", 0.2], ["#2d5fb3", 0.4], ["#1d1f22", 0.62], ["#2d5fb3", 0.8]];
  x.lineWidth = 6; for (const [c, u] of runs) { x.strokeStyle = c; x.beginPath(); x.moveTo(w * u, h * 0.3); x.bezierCurveTo(w * (u + 0.08), h * 0.55, w * (u - 0.06), h * 0.7, w * u, h * 0.95); x.stroke(); }
  x.strokeStyle = "#b6463b"; x.lineWidth = 4; x.setLineDash([10, 8]); x.beginPath(); x.moveTo(w * 0.45, h * 0.95); x.lineTo(w * 0.55, h * 0.35); x.stroke(); x.setLineDash([]);
  x.fillStyle = "#22344d"; x.font = `600 ${h * 0.09}px Georgia, serif`; x.fillText("TRAIL MAP", w * 0.05, h * 0.12);
}

function go(v) {
  view = v; const V = VIEWS[v], b = new THREE.Vector3(...(V.base || [0, 0, 0]));
  sun.target.position.copy(b).add(new THREE.Vector3(...V.at)); sun.position.copy(sun.target.position).add(new THREE.Vector3(-40, 60, 30));
  camera.position.set(...V.pos).add(b); controls.target.set(...V.at).add(b); controls.update();
  document.getElementById("cap").textContent = `${lookName === "ink" ? "B 水彩描边" : "A 沙盘模型"} · ${V.cap}`;
  menu();
}
function menu() {
  const bar = document.getElementById("bar"); bar.innerHTML = "";
  for (const [k, l] of [["miniature", "A 沙盘"], ["ink", "B 描边"]]) { const b = document.createElement("button"); b.textContent = l; b.className = k === lookName ? "on" : ""; b.onclick = () => { lookName = k; build(); go(view); }; bar.append(b); }
  for (const [k, V] of Object.entries(VIEWS)) { const b = document.createElement("button"); b.textContent = V.label; b.className = k === view ? "on" : ""; b.onclick = () => go(k); bar.append(b); }
}
function size() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", size); size();
build(); go(view);
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
window.__ready = true;
