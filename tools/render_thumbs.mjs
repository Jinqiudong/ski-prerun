// The rider page's accessory tiles (上衣 › 帽兜 / 马甲 / 格子, 装备 › 头盔 › 帽檐 / 贴纸) and the look's two bodies:
// each rendered once on each template, close up, into a small transparent PNG under
// assets/riders/thumbs/<part>_<f|m>.png (and body_<f|m>.png).
// Rerun it when a template or a part changes.
// usage: node tools/render_thumbs.mjs   (needs puppeteer-core: npm i --no-save puppeteer-core, and Google Chrome)
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, extname, normalize } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const OUT = join(ROOT, "assets/riders/thumbs");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SIZE = 240; // drawn at twice this and scaled down, for smooth edges

// The page: both templates in the same calm colours (pine jacket, dark helmet), lit like the rider page.
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports": {"three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}</script>
</head><body><script type="module">
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { makeCharacter, presetChar } from "./src/rider/character.js?v=13";
const S = ${SIZE} * 2;
const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
r.setSize(S, S); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.setClearColor(0, 0);
const sc = new THREE.Scene();
sc.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture; sc.environmentIntensity = 0.45;
sc.add(new THREE.HemisphereLight(0xe4eeff, 0x9aa6b6, 1.2));
const sun = new THREE.DirectionalLight(0xfff0dc, 2.4); sun.position.set(2, 4, 4); sc.add(sun);
const rim = new THREE.DirectionalLight(0xdfe9ff, 1.2); rim.position.set(-3, 3, -6); sc.add(rim);
const cam = new THREE.PerspectiveCamera(24, 1, 0.05, 50);
const small = document.createElement("canvas"); small.width = small.height = ${SIZE};
const COLORS = { MAT_jacket: "#525a42", MAT_pants: "#c9bfac", MAT_helmet: "#2b2b2e", MAT_lens: "#4d5ce0", MAT_mitten: "#e3dccb" };
const v = new THREE.Vector3(), box = new THREE.Box3();
// The head and what's on it, left out of the clothes' pictures (only a helmet item shows the head).
const HEADWEAR = /^(Helmet|Goggles|FaceMask|ACC_Hair|ACC_Stickers|ACC_Visor)/;
async function snap(tpl, on, { bones, dir, pad, jacket, hair = false, head = false, as = null }) {
  const C = await makeCharacter(tpl), ch = presetChar(tpl === "F" ? "A" : "B");
  if (!as) {
    Object.assign(ch.colors, COLORS); if (jacket) ch.colors.MAT_jacket = jacket;
    for (const k of Object.keys(ch.parts)) ch.parts[k] = false;
    ch.parts.hair = hair && tpl === "F"; ch.parts[on] = true;
  }
  sc.add(C.root); C.set(ch); C.play("Stand_Idle", { fade: 0 }); C.mixer.update(0);
  if (!head) C.root.traverse((o) => { if (o.isMesh && HEADWEAR.test(o.name)) o.visible = false; });
  C.root.updateMatrixWorld(true); box.makeEmpty();
  for (const [n, b] of Object.entries(C.bones)) if (bones.some((k) => n.startsWith(k))) box.expandByPoint(b.getWorldPosition(v));
  box.expandByScalar(pad);
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const R = Math.max(s.x, s.y, s.z) * 0.5, dist = R / Math.tan(THREE.MathUtils.degToRad(12)) + 0.2;
  cam.position.copy(c).addScaledVector(new THREE.Vector3(...dir).normalize(), dist); cam.lookAt(c);
  r.render(sc, cam); sc.remove(C.root);
  const g = small.getContext("2d"); g.clearRect(0, 0, ${SIZE}, ${SIZE}); g.imageSmoothingQuality = "high"; g.drawImage(r.domElement, 0, 0, ${SIZE}, ${SIZE});
  return small.toDataURL("image/png");
}
// One framing for the clothes: the chest and shoulders, close (the hood from behind, where it hangs); the
// helmet's items on the head; the two bodies (the look's 角色 row) head to waist, as their preset dresses them.
const CHEST = { bones: ["Chest", "Shoulder", "Neck"], dir: [0.35, 0.12, 1], pad: 0.12 };
const HEAD = { bones: ["Head", "Neck"], dir: [0.8, 0.1, 1], pad: 0.13, head: true };
const JOBS = {
  hood: { ...CHEST, dir: [1, 0.45, -0.35] },
  vest: CHEST,
  grid: { ...CHEST, pad: 0.03, jacket: "#3b3d40" }, // dark and a little nearer, where the grid's fine lines show
  visor: HEAD,
  stickers: { ...HEAD, dir: [0.5, 0.8, 1] },
  body: { bones: ["Head", "Chest", "Hips"], dir: [0.25, 0.08, 1], pad: 0.12, head: true, as: true },
};
const out = {};
for (const tpl of ["F", "M"]) for (const [k, o] of Object.entries(JOBS)) out[k + "_" + tpl.toLowerCase()] = await snap(tpl, k, o);
window.__out = out;
</script></body></html>`;

const TYPES = { ".js": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary", ".jpg": "image/jpeg", ".png": "image/png", ".html": "text/html" };
const server = createServer((req, res) => {
  const path = decodeURIComponent(req.url.split("?")[0]);
  if (path === "/thumbs.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  const f = normalize(join(ROOT, path));
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
}).listen(0);
const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--use-angle=metal"] });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error(e.message));
  await page.goto(`http://127.0.0.1:${port}/thumbs.html`);
  await page.waitForFunction(() => window.__out, { timeout: 120000 });
  const out = await page.evaluate(() => window.__out);
  mkdirSync(OUT, { recursive: true });
  for (const [k, url] of Object.entries(out)) { writeFileSync(join(OUT, `${k}.png`), Buffer.from(url.split(",")[1], "base64")); console.log(`assets/riders/thumbs/${k}.png`); }
} finally { await browser.close(); server.close(); }
