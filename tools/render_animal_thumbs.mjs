// The rider page's animal tiles (外形 › 小动物): each resort animal standing on its board (src/rider/animal.js),
// three-quarters on, rendered once into a small transparent PNG under assets/riders/thumbs/animal_<name>.png.
// Rerun it when an animal's model or animal.js's sizes change.
// usage: node tools/render_animal_thumbs.mjs   (needs puppeteer-core: npm i --no-save puppeteer-core, and Google Chrome)
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, extname, normalize } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const OUT = join(ROOT, "assets/riders/thumbs");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SIZE = 160; // drawn at twice this and scaled down, for smooth edges

// The page: lit like the rider page; the camera framed on the animal (the board runs off the edges).
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports": {"three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}</script>
</head><body><script type="module">
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { ANIMAL_RIDERS } from "./src/rider/animal-core.js?v=1";
import { animalRider, idleAnimal } from "./src/rider/animal.js?v=1";
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
const out = {};
for (const a of ANIMAL_RIDERS) {
  const root = await animalRider({ animal: a, board: "A" });
  await new Promise((ok) => setTimeout(ok, 300)); // the board's pictures
  root.userData.gaze.wait = 1e9; idleAnimal(root);
  root.rotation.y = Math.PI / 2 - 0.65; sc.add(root); root.updateMatrixWorld(true);
  const box = new THREE.Box3(); root.userData.model.traverse((o) => { if (o.isMesh) box.expandByObject(o); });
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  c.y -= s.y * 0.04;
  const R = Math.max(s.x, s.y, s.z) * 0.56, dist = R / Math.tan(THREE.MathUtils.degToRad(12));
  cam.position.copy(c).addScaledVector(new THREE.Vector3(0, 0.32, 1).normalize(), dist); cam.lookAt(c);
  r.render(sc, cam); sc.remove(root);
  const g = small.getContext("2d"); g.clearRect(0, 0, ${SIZE}, ${SIZE}); g.imageSmoothingQuality = "high"; g.drawImage(r.domElement, 0, 0, ${SIZE}, ${SIZE});
  out["animal_" + a] = small.toDataURL("image/png");
}
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
