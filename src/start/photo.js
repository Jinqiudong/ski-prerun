// A day's group photo, rendered once and kept as a JPEG: that mountain's watercolour behind, the snow in
// front, and the people who skied it standing there as their own 3D riders (character.js), board in hand.
// From a trip's second day on, the one in the middle holds up a framed picture of the day before.
// One WebGL renderer for every photo; the riders are pooled while photos are being made and everything is
// let go a little after the last one.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CFG, makeCharacter, presetChar, setPartColor } from "../rider/character.js?v=8";

export const W = 900, H = 700; // a change to how photos look: bump PHOTO_V in memory.js
// A day with no mountain picked: the snowy heart of the Colorado watercolour (the start page's map).
const GENERAL = { url: "assets/wc/colorado.jpg?v=1", crop: [470, 520, 760, 520] };
const paint = (id) => (id ? { url: `assets/wc/${id}.jpg?v=1`, crop: null } : GENERAL);

const imgs = new Map();
const loadImg = (url) => {
  if (!imgs.has(url)) imgs.set(url, new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => { imgs.delete(url); no(new Error("image " + url)); }; im.src = url; }));
  return imgs.get(url);
};
// Draw a painting into a box, covering it (from its crop, if it has one).
function cover(g, im, crop, x, y, w, h) {
  const iw = im.naturalWidth, ih = im.naturalHeight; // the paintings' torn edges stay outside the photo
  let [sx, sy, sw, sh] = crop || [iw * 0.05, ih * 0.07, iw * 0.9, ih * 0.88];
  const k = w / h;
  if (sw / sh > k) { const nw = sh * k; sx += (sw - nw) / 2; sw = nw; } else { const nh = sw / k; sy += (sh - nh) * 0.35; sh = nh; }
  g.drawImage(im, sx, sy, sw, sh, x, y, w, h);
}

// A rider as a look describes it, as a whole character.
export function charOf(rider) {
  if (rider?.ch && CFG.templates[rider.ch.tpl]) {
    const base = presetChar(Object.keys(CFG.presets).find((k) => CFG.presets[k].tpl === rider.ch.tpl) || "A");
    return { ...base, ...rider.ch, parts: { ...base.parts, ...rider.ch.parts }, colors: { ...base.colors, ...rider.ch.colors } };
  }
  const ch = presetChar(CFG.presets[rider?.preset] ? rider.preset : "A");
  for (const [p, c] of Object.entries(rider?.colors || {})) if (/^#[0-9a-f]{6}$/i.test(c)) try { setPartColor(ch, p, c); } catch { /* not a part */ }
  return ch;
}

// ---- The stage: made on the first photo, let go when idle.
let S = null, idle = 0;
function stage() {
  if (S) return S;
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer), env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  scene.environment = env; scene.environmentIntensity = 0.45;
  scene.add(new THREE.HemisphereLight(0xe4eeff, 0x9aa6b6, 1.1));
  // A warm sun from the front left (so the faces are lit and the shadows fall back and right), a pale rim behind.
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.5);
  sun.position.set(-3, 6, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 4, bottom: -4, near: 0.5, far: 30 });
  const rim = new THREE.DirectionalLight(0xdfe9ff, 1.2); rim.position.set(2, 3, -6);
  // The snow only catches shadows; the painting and the snow under them are drawn in 2D.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ color: 0x3a4a66, opacity: 0.2 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(sun, sun.target, rim, ground);
  const camera = new THREE.PerspectiveCamera(26, W / H, 0.1, 60);
  S = { renderer, scene, camera, env, ground, pool: { F: [], M: [] } };
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); release(); });
  return S;
}
// Let everything go: the pooled riders' own materials (their meshes share the template's geometry, which
// character.js keeps), the light probe, the renderer and its context.
export function release() {
  if (!S) return;
  const s = S; S = null;
  for (const list of Object.values(s.pool)) for (const r of list) r.c.root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) m.dispose(); });
  s.ground.geometry.dispose(); s.ground.material.dispose(); s.env.dispose();
  s.renderer.dispose(); s.renderer.forceContextLoss();
}
async function riders(tpl, k) {
  const list = S.pool[tpl];
  while (list.length < k) { const c = await makeCharacter(tpl), wrap = new THREE.Group(); wrap.add(c.root); list.push({ c, wrap }); }
  return list;
}

// The framed picture someone holds up: a white mount, the painting, a little bevel of shadow.
function heldFrame(im, crop) {
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 192;
  const g = cv.getContext("2d"); cover(g, im, crop, 0, 0, 256, 192);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const grp = new THREE.Group();
  const mount = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.4, 0.016), new THREE.MeshStandardMaterial({ color: 0xf7f3ea, roughness: 0.85 }));
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  pic.position.set(0, 0.03, 0.0085); mount.castShadow = true;
  grp.add(mount, pic);
  grp.userData.dispose = () => { mount.geometry.dispose(); mount.material.dispose(); pic.geometry.dispose(); pic.material.dispose(); tex.dispose(); };
  return grp;
}

// spec: { resort (id or null), held (undefined: no picture; { resort }: the day before), people: [{ rider }],
// holder (index) }. Resolves to a JPEG blob.
let line = Promise.resolve();
export function renderPhoto(spec) { const p = line.then(() => shoot(spec)); line = p.catch(() => {}); return p; } // one at a time
async function shoot(spec) {
  clearTimeout(idle);
  const placed = []; let frame = null; // taken off the stage again however the shot goes
  try {
    const s = stage(), bg = paint(spec.resort), ppl = spec.people.slice(0, 7);
    const chars = ppl.map((p) => charOf(p.rider));
    const need = { F: 0, M: 0 }; for (const ch of chars) need[ch.tpl]++;
    for (const tpl of Object.keys(need)) if (need[tpl]) await riders(tpl, need[tpl]);
    const [bgIm, heldIm] = await Promise.all([loadImg(bg.url), spec.held ? loadImg(paint(spec.held.resort).url) : null]);
    if (!S) throw new Error("context lost");
    // Stand them in a row, a step apart, turned a little toward the middle; the holder a half step forward.
    const n = ppl.length, gap = 0.74, used = { F: 0, M: 0 };
    chars.forEach((ch, i) => {
      const { c, wrap } = s.pool[ch.tpl][used[ch.tpl]++], x = (i - (n - 1) / 2) * gap, hold = i === spec.holder && heldIm, k = ch.height / CFG.templates[ch.tpl].height;
      c.set(ch);
      c.play(hold ? "Stand_Idle" : "Board_Hold", { fade: 0.01 }); c.mixer.update(1);
      wrap.position.set(x, 0.062 * k, hold ? 0.12 : (i % 2) * -0.08); wrap.rotation.set(0, -x * 0.12, 0);
      s.scene.add(wrap); placed.push(wrap);
      if (hold) { frame = heldFrame(heldIm, paint(spec.held.resort).crop); frame.position.set(x, 1.1 * k, 0.45); frame.rotation.set(-0.06, -x * 0.12, 0.05); s.scene.add(frame); }
    });
    // The boards' prints load on first use: wait for them (a little), or the boards come out black.
    for (let k = 0; k < 80 && placed.some((w) => { let wait = false; w.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.map && !m.map.image) wait = true; }); return wait; }); k++) await new Promise((r) => setTimeout(r, 50));
    // Frame the row: wide enough for everyone, tall enough for a head and the snow at their feet.
    const cam = s.camera, half = THREE.MathUtils.degToRad(cam.fov / 2), hw = ((n - 1) / 2) * gap + 0.62, hh = 1.12;
    const d = Math.max(hw / (Math.tan(half) * cam.aspect), hh / Math.tan(half));
    cam.position.set(0, 1.12, d); cam.lookAt(0, 0.9, 0); cam.updateProjectionMatrix();
    s.renderer.render(s.scene, cam);
    // The photo: the painting, the snow it fades into, the riders and their shadows on top.
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const g = out.getContext("2d"), horizon = Math.round(H * 0.7);
    cover(g, bgIm, bg.crop, 0, 0, W, horizon + 40);
    const snow = g.createLinearGradient(0, horizon - 70, 0, H);
    snow.addColorStop(0, "rgba(238,240,243,0)"); snow.addColorStop(0.32, "rgba(238,240,243,.94)"); snow.addColorStop(1, "#e2e5ea");
    g.fillStyle = snow; g.fillRect(0, horizon - 70, W, H - horizon + 70);
    g.drawImage(s.renderer.domElement, 0, 0, W, H);
    return await new Promise((ok, no) => out.toBlob((b) => (b ? ok(b) : no(new Error("toBlob"))), "image/jpeg", 0.88));
  } finally {
    for (const w of placed) w.parent?.remove(w);
    if (frame) { frame.parent?.remove(frame); frame.userData.dispose(); }
    idle = setTimeout(release, 15000);
  }
}
