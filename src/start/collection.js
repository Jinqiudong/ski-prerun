// The resorts as little dioramas (resort-tiles.js) standing on a snowy watercolour map of central Colorado
// (tools/bake_map_snow.py), fading toward the screen's edges: each one a square
// of the resort's real mountain (data/tiles.json, assets/tiles: tools/bake_tiles.py) on a pale plinth, set
// where it is (Aspen's four, too close together, sit as a two-by-two in their valley); each framed with the
// town it's by; the drives between them along the roads, with how long they take (data/drives.json), and
// Denver. Turn it all the way round, tilt and zoom; tap a tile to lift it and see it. Its colour comes back
// the more of it you've skied; ski all of it and a flag goes up.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { EN_ON } from "../core/i18n.js?v=38";
import { ANIMALS, strataWalls, heightAt, pines, animal3d } from "./resort-tiles.js?v=4";
import { Pets } from "./pets.js?v=4";

// Diorama tiles (taller, cut-away sides in layers, pines, an animal each); ?flat for the plain ones.
const DIO = !new URLSearchParams(location.search).has("flat");

const S = 12, PLINTH = 1.6, EX = 1.35; // tile size, plinth depth, vertical exaggeration
// The painted map's bounds (tools/bake_region.py, tools/bake_map_snow.py): wide enough to fill a portrait
// phone at the home view, where west is the top of the screen and east the bottom.
const MAP = { S: 38.0, N: 41.5, W: -110.0, E: -103.2 };
// The scene's origin and scale are fixed (the first, smaller map's middle and 140 units across its 2.62°),
// so the tiles, towns, drives and the camera stay where they were whatever the map's bounds.
const O = { lat: 39.85, lon: -106.09 }, KM = 140 / (2.62 * 85.3); // scene units per km
const at = (lat, lon) => new THREE.Vector3((lon - O.lon) * 85.3 * KM, 0, -(lat - O.lat) * 111 * KM);
// The towns, and which resorts each frames. Aspen's four sit as a two-by-two around the valley's middle.
const TOWNS = [
  { zh: "Aspen · Snowmass Village", en: "Aspen · Snowmass Village", ids: ["snowmass", "buttermilk", "highlands", "aspenmountain"], grid: [["snowmass", "buttermilk"], ["highlands", "aspenmountain"]] },
  { zh: "Steamboat Springs", en: "Steamboat Springs", ids: ["steamboat"] },
  { zh: "Fraser · Winter Park", en: "Fraser · Winter Park", ids: ["winterpark"] },
  { zh: "Nederland", en: "Nederland", ids: ["eldora"] },
  { zh: "Frisco · Summit County", en: "Frisco · Summit County", ids: ["copper"] },
  { zh: "Keystone · Summit County", en: "Keystone · Summit County", ids: ["abasin"] },
];
const DENVER = [39.7392, -104.9903];
const ink = (c, o) => new THREE.LineDashedMaterial({ color: c, transparent: true, opacity: o, dashSize: 0.9, gapSize: 0.6 });

export class Collection {
  constructor(canvas, labels) {
    this.canvas = canvas; this.labels = labels;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    const s = (this.scene = new THREE.Scene());
    s.background = new THREE.Color(0xeef2f5);
    s.add(new THREE.HemisphereLight(0xffffff, 0xd9d0c2, 1.5));
    const sun = new THREE.DirectionalLight(0xfff4e6, 2.3);
    sun.position.set(-60, 100, -48); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 1, far: 300 });
    sun.shadow.bias = -0.0008; sun.shadow.radius = 4;
    s.add(sun);
    const fill = new THREE.DirectionalLight(0xe6eefb, 0.9); fill.position.set(30, 20, 40); s.add(fill); // the sky's light on the sides facing you
    // The painted map the tiles stand on (it takes their shadows too).
    const mw = (MAP.E - MAP.W) * 85.3 * KM, mh = (MAP.N - MAP.S) * 111 * KM;
    const tex = new THREE.TextureLoader().load("assets/wc/colorado.jpg?v=6", (x) => (x.colorSpace = THREE.SRGBColorSpace));
    tex.anisotropy = 8;
    // Its own border fades into the snow it lies on, over ~40 km, so the sheet has no edge anywhere.
    const fade = (() => { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"), g = x.createImageData(256, 256), kw = mw / KM, kh = mh / KM;
      const ss = (e) => { const a = Math.min(1, Math.max(0, (e - 4) / 40)); return a * a * (3 - 2 * a); };
      for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) { const a = ss(Math.min(Math.min(i, 255 - i) / 255 * kw, Math.min(j, 255 - j) / 255 * kh)); const k = (j * 256 + i) * 4; g.data[k] = g.data[k + 1] = g.data[k + 2] = 255 * a; g.data[k + 3] = 255; }
      x.putImageData(g, 0, 0); return new THREE.CanvasTexture(c); })();
    const fmat = new THREE.MeshStandardMaterial({ map: tex, color: 0xf4f4f4, roughness: 1, alphaMap: fade, transparent: true, depthWrite: false });
    // And it weakens toward the screen's edges, the farther from the middle the fainter, into the snow: a
    // vignette that follows the screen, not the sheet.
    this.vig = { value: new THREE.Vector2(1, 1) };
    fmat.onBeforeCompile = (sh) => {
      sh.uniforms.vigRes = this.vig;
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec2 vigRes;")
        .replace("#include <alphamap_fragment>", "#include <alphamap_fragment>\nvec2 vq = abs(gl_FragCoord.xy / vigRes - 0.5) * 2.0;\nfloat vd = pow(pow(vq.x, 2.5) + pow(vq.y, 2.5), 0.4);\ndiffuseColor.a *= 1.0 - smoothstep(0.3, 1.12, vd);");
    };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), fmat);
    floor.rotation.x = -Math.PI / 2; floor.position.copy(at((MAP.N + MAP.S) / 2, (MAP.W + MAP.E) / 2)).setY(-PLINTH); floor.receiveShadow = true; s.add(floor);
    // the snowy ground the map lies on, far past its (faded) edges
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(mw * 8, mh * 8), new THREE.MeshStandardMaterial({ color: 0xeceff2, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -PLINTH - 0.03; ground.receiveShadow = true; s.add(ground);
    this.marks = []; // HTML labels pinned to the map: towns, drive times, Denver
    this.camera = new THREE.PerspectiveCamera(30, 1, 4, 900);
    const c = (this.controls = new OrbitControls(this.camera, canvas));
    Object.assign(c, { enableDamping: true, dampingFactor: 0.08, minDistance: 14, maxDistance: 700, minPolarAngle: 0.25, maxPolarAngle: 1.25, enablePan: true, screenSpacePanning: false });
    c.addEventListener("start", () => { this.fly = null; this.moved = true; this.dragging = true; this.onExplore?.(); });
    c.addEventListener("end", () => (this.dragging = false));
    this.tiles = []; this.picked = null; this.onPick = null;
    canvas.addEventListener("pointerdown", (e) => (this.down = { x: e.clientX, y: e.clientY }));
    // With a mouse, the tile under it rises a little.
    canvas.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" && !this.down) this.hover = this.under(e); });
    canvas.addEventListener("pointerleave", () => (this.hover = null));
    canvas.addEventListener("pointerup", (e) => { const d = this.down; this.down = null; if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) this.tap(e); });
    // Tilt the phone and the map turns with it, a little, as if you were holding the sheet. The way you
    // hold it is the middle; that middle follows you slowly, so it never drifts off.
    this.tilt = { want: { az: 0, pol: 0 }, now: { az: 0, pol: 0 }, on: { az: 0, pol: 0 }, mid: null, at: 0 };
    addEventListener("deviceorientation", (e) => {
      if (e.beta == null) return;
      const T = this.tilt, now = performance.now(), dt = Math.min(1, (now - (T.at || now)) / 1000); T.at = now;
      if (!T.mid) T.mid = { b: e.beta, g: e.gamma };
      const k = 1 - Math.exp(-dt / 8); T.mid.b += (e.beta - T.mid.b) * k; T.mid.g += (e.gamma - T.mid.g) * k;
      const R = Math.PI / 180, c = (v, m) => Math.max(-m, Math.min(m, v));
      T.want = { az: c(-(e.gamma - T.mid.g) * R * 1.4, 0.45), pol: c(-(e.beta - T.mid.b) * R * 0.9, 0.22) };
    });
    const ask = () => { const E = globalThis.DeviceOrientationEvent; if (typeof E?.requestPermission === "function") E.requestPermission().catch(() => {}); };
    for (const ev of ["touchend", "click"]) addEventListener(ev, ask, { once: true, capture: true });
    this.pets = new Pets(this); // the animals are desk pets: long-press to lift, tap to play (pets.js)
  }

  // Turn the camera about the target by the tilt: first take back last frame's turn, so the controls only
  // ever see the view you set by hand.
  tiltCamera(sign) {
    const T = this.tilt, o = sign > 0 ? T.on : { az: -T.on.az, pol: -T.on.pol };
    if (!o.az && !o.pol) return;
    const c = this.controls, off = this.camera.position.clone().sub(c.target), sp = new THREE.Spherical().setFromVector3(off);
    sp.theta += o.az; sp.phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.02, sp.phi + o.pol));
    this.camera.position.copy(c.target).add(off.setFromSpherical(sp)); this.camera.lookAt(c.target);
  }

  // list: [{ id, name, lat, lon }]; stats: { id: { share } }.
  async build(list, stats) {
    const [data, drives] = await Promise.all([fetch("data/tiles.json").then((x) => x.json()), fetch("data/drives.json").then((x) => x.json()).catch(() => [])]);
    const loader = new THREE.TextureLoader(), byId = Object.fromEntries(list.map((r) => [r.id, r]));
    // Where each tile stands: its own place, or its square of a town's two-by-two.
    const spot = {};
    for (const r of list) spot[r.id] = at(r.lat, r.lon);
    for (const town of TOWNS) if (town.grid) {
      const mid = town.ids.reduce((m, id) => m.add(spot[id] || new THREE.Vector3()), new THREE.Vector3()).multiplyScalar(1 / town.ids.length);
      town.grid.forEach((row, j) => row.forEach((id, i) => (spot[id] = mid.clone().add(new THREE.Vector3((i - 0.5) * (S + 1.6), 0, (j - 0.5) * (S + 1.6))))));
    }
    // Tiles too close to their neighbours are nudged apart a little (towns move as one).
    const groupOf = (id) => TOWNS.find((tw) => tw.ids.includes(id));
    for (let it = 0; it < 80; it++) for (const a of list) for (const b of list) {
      if (a === b || groupOf(a.id) === groupOf(b.id) && groupOf(a.id)?.grid || !spot[a.id] || !spot[b.id]) continue;
      const d = spot[a.id].clone().sub(spot[b.id]).setY(0), len = d.length(), min = S + 3;
      if (len < min) { d.setLength((min - len) / 2 || 0.5); for (const [r, sg] of [[a, 1], [b, -1]]) { const tw = groupOf(r.id); for (const id of tw?.grid ? tw.ids : [r.id]) spot[id].addScaledVector(d, sg); } }
    }
    for (const r of list) {
      const d = data[r.id]; if (!d) continue;
      const share = stats[r.id]?.share || 0;
      const tile = this.tile(d, loader.load(`assets/tiles/${r.id}.jpg?v=2`, (x) => (x.colorSpace = THREE.SRGBColorSpace)), share, r.id);
      tile.position.copy(spot[r.id]);
      const el = document.createElement("button");
      el.className = "ctag";
      el.innerHTML = `<b>${share >= 0.999 ? "⚑ " : ""}${r.name.replace(/ Mountain$| Basin$/, "").toUpperCase()}</b>${share > 0 && share < 0.999 ? `<small>${Math.max(1, Math.round(share * 100))}%</small>` : ""}`;
      const t = { userData: { ...r, share, tag: el }, group: tile, base: tile.position.clone() };
      el.onclick = () => this.pick(t);
      this.labels.append(el);
      this.tiles.push(t); this.scene.add(tile);
    }
    // Each town's frame: a dashed line round its tiles, its name at the top corner.
    const y0 = -PLINTH + 0.06;
    for (const town of TOWNS) {
      const ps = town.ids.map((id) => spot[id]).filter(Boolean); if (!ps.length) continue;
      const pad = S / 2 + 1.8, x0 = Math.min(...ps.map((p) => p.x)) - pad, x1 = Math.max(...ps.map((p) => p.x)) + pad, z0 = Math.min(...ps.map((p) => p.z)) - pad, z1 = Math.max(...ps.map((p) => p.z)) + pad;
      const g = new THREE.BufferGeometry().setFromPoints([[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]].map(([x, z]) => new THREE.Vector3(x, y0, z)));
      const line = new THREE.Line(g, ink(0x22344d, 0.45)); line.computeLineDistances(); this.scene.add(line);
      this.mark(EN_ON ? town.en : town.zh, new THREE.Vector3((x0 + x1) / 2, y0, (z0 + z1) / 2), town.grid ? "town group" : "town", [x0, x1, z0, z1]);
      if (town.grid) for (const id of town.ids) { const t = this.tiles.find((x) => x.userData.id === id); if (t) t.inGroup = true; }
    }
    // The drives, drawn by hand: a row of dots along the road from one to the other, a ring at each end,
    // and the time in small writing at the middle.
    const dotTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.beginPath(); g.arc(16, 16, 12, 0, 7); g.fill(); return new THREE.CanvasTexture(c); })();
    const dotMat = new THREE.PointsMaterial({ color: 0x8a3b34, size: 0.55, map: dotTex, transparent: true, alphaTest: 0.4, depthWrite: false });
    let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
    for (const dv of drives) {
      const pts = dv.line.map(([la, lo]) => at(la, lo).setY(y0 + 0.05)), dots = [];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.round(a.distanceTo(b) / 1.05));
        for (let k = 0; k < n; k++) { const p = a.clone().lerp(b, k / n); p.x += rnd() * 0.18; p.z += rnd() * 0.18; dots.push(p); } // a hand's wobble
      }
      this.scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(dots), dotMat));
      for (const end of [pts[0], pts[pts.length - 1]]) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.7, 20), new THREE.MeshBasicMaterial({ color: 0x8a3b34, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.copy(end).setY(y0 + 0.06); this.scene.add(ring);
      }
      const h = Math.floor(dv.min / 60), m = dv.min % 60;
      const txt = EN_ON ? `${h ? `${h} h ` : ""}${m ? `${m} min` : ""}`.trim() : `约 ${h ? `${h} 小时` : ""}${m ? `${m} 分` : ""}`;
      this.mark(txt, pts[Math.floor(pts.length / 2)], "drive");
    }
    const den = at(...DENVER).setY(y0);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.25, 24), new THREE.MeshStandardMaterial({ color: 0xb6463b }));
    pin.position.copy(den); this.scene.add(pin);
    this.mark("DENVER ✈", den, "city");
    const box = new THREE.Box3(); for (const t of this.tiles) box.expandByPoint(t.base); box.expandByPoint(den);
    // Seen from the east, as if driving in from Denver: Denver at the bottom, Aspen at the top, so the
    // long east–west spread runs up a phone screen.
    this.home = { target: box.getCenter(new THREE.Vector3()), polar: 0.55, az: Math.PI / 2 };
    this._fit = null; // measured again now the tiles are in place
    this.view(this.home.target, this.fitDist(), this.home.polar, this.home.az, false);
  }
  // A label pinned to a point on the map.
  // A town's label sits on its frame's edge nearest the top of the screen (rect: x0, x1, z0, z1).
  mark(text, at3, kind, rect = null) {
    const el = document.createElement("div");
    el.className = `cmark ${kind}`; el.textContent = text;
    this.labels.append(el); this.marks.push({ el, at: at3, kind, rect });
  }

  // One tile: the terrain on top (its texture greyed until you've skied it), a plinth under it.
  tile(d, tex, share, id) {
    const g = new THREE.Group(), n = d.grid;
    const raw = Uint8Array.from(atob(d.heights), (ch) => ch.charCodeAt(0)), q = new Uint16Array(raw.buffer);
    const k = (S / d.size) * (DIO ? 2.1 : EX), top = new THREE.PlaneGeometry(S, S, n - 1, n - 1);
    top.rotateX(-Math.PI / 2);
    const pos = top.attributes.position;
    for (let v = 0; v < pos.count; v++) pos.setY(v, (q[v] / 2) * k + (DIO ? 1.0 : 0.15));
    top.computeVertexNormals();
    const vivid = share > 0 ? 0.6 + 0.4 * share : 0.5;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.vivid = { value: vivid };
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float vivid;")
        .replace("#include <map_fragment>", "#include <map_fragment>\nfloat lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));\ndiffuseColor.rgb = mix(vec3(lum) * vec3(0.98, 0.99, 1.02), diffuseColor.rgb, vivid);");
    };
    const land = new THREE.Mesh(top, mat);
    land.castShadow = land.receiveShadow = true; g.add(land);
    // The plinth: walls from the terrain's edge down to its foot.
    const side = [], idx = [], edge = [];
    for (let i = 0; i < n; i++) edge.push(i);
    for (let j = 1; j < n; j++) edge.push(j * n + n - 1);
    for (let i = n - 2; i >= 0; i--) edge.push((n - 1) * n + i);
    for (let j = n - 2; j >= 0; j--) edge.push(j * n);
    for (const v of edge) side.push(pos.getX(v), pos.getY(v), pos.getZ(v), pos.getX(v), -PLINTH, pos.getZ(v));
    for (let e = 0; e + 1 < edge.length; e++) { const a = e * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    if (DIO) {
      g.add(strataWalls(pos, edge, -PLINTH));
      const h = heightAt(pos, n, S); let lo = 1e9, hi = -1e9; for (let v = 0; v < pos.count; v++) { lo = Math.min(lo, pos.getY(v)); hi = Math.max(hi, pos.getY(v)); }
      g.add(pines(h, S, lo, hi, 7 + (id || "").length * 13));
      if (ANIMALS[id]) { const a = animal3d(ANIMALS[id]); g.add(a); (this.walkers ||= []).push({ a, h, seed: (id.charCodeAt(0) % 7) * 0.9 }); }
    } else {
      const wg = new THREE.BufferGeometry(); wg.setAttribute("position", new THREE.Float32BufferAttribute(side, 3)); wg.setIndex(idx); wg.computeVertexNormals();
      const wall = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: 0xf1ede7, roughness: 0.85, side: THREE.DoubleSide }));
      wall.castShadow = wall.receiveShadow = true; g.add(wall);
    }
    // Conquered: a little red flag on the highest point.
    if (share >= 0.999) {
      let hi = 0; for (let v = 1; v < pos.count; v++) if (pos.getY(v) > pos.getY(hi)) hi = v;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6), new THREE.MeshStandardMaterial({ color: 0x3a3f4a }));
      pole.position.set(pos.getX(hi), pos.getY(hi) + 0.8, pos.getZ(hi));
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshStandardMaterial({ color: 0xb6463b, side: THREE.DoubleSide }));
      flag.position.set(pos.getX(hi) + 0.4, pos.getY(hi) + 1.35, pos.getZ(hi));
      g.add(pole, flag);
    }
    let pk = 0; for (let v = 1; v < pos.count; v++) if (pos.getY(v) > pos.getY(pk)) pk = v;
    // the flag's spot: the highest ground near the middle (the very top can sit on an edge, off screen)
    let mid = -1; for (let v = 0; v < pos.count; v++) if (Math.abs(pos.getX(v)) < S * 0.22 && Math.abs(pos.getZ(v)) < S * 0.22 && (mid < 0 || pos.getY(v) > pos.getY(mid))) mid = v;
    g.userData.top = pos.getY(pk); g.userData.peak = new THREE.Vector3(pos.getX(mid), pos.getY(mid), pos.getZ(mid));
    return g;
  }

  // Look at target from dist: polar angle from straight down, azimuth round from the south.
  view(target, dist, polar, az, glide = true) {
    const off = new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az)).multiplyScalar(dist);
    if (this.tilt) this.tilt.on = { az: 0, pol: 0 }; // the camera is set afresh: no tilt in it to take back
    if (!glide) { this.controls.target.copy(target); this.camera.position.copy(target).add(off); this.controls.update(); return; }
    this.fly = { t0: performance.now(), fromT: this.controls.target.clone(), fromP: this.camera.position.clone(), toT: target.clone(), toP: target.clone().add(off) };
  }
  // Far enough that every tile's corners fit the screen (measured by projecting them), leaving the top for
  // the heading and the bottom for the card.
  fitDist() {
    if (this._fit && this._fit.a === this.camera.aspect) return this._fit.d;
    const cam = this.camera.clone(), v = new THREE.Vector3(), { target, polar, az } = this.home, pts = [];
    for (const t of this.tiles) for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pts.push(new THREE.Vector3(t.base.x + (dx * S) / 2, 0, t.base.z + (dz * S) / 2));
    pts.push(at(...DENVER));
    let d = 60;
    for (let it = 0; it < 6; it++) {
      cam.position.set(target.x + Math.sin(polar) * Math.sin(az) * d, target.y + Math.cos(polar) * d, target.z + Math.sin(polar) * Math.cos(az) * d);
      cam.lookAt(target); cam.updateMatrixWorld();
      let m = 0; for (const p of pts) { v.copy(p).project(cam); m = Math.max(m, Math.abs(v.x) / 1.0, Math.abs(v.y) / 0.78); }
      d *= m;
    }
    this._fit = { a: this.camera.aspect, d: Math.min(this.controls.maxDistance, d) };
    return this._fit.d;
  }

  // The tile under a pointer, if any.
  under(e) {
    const r = this.canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hit = ray.intersectObjects(this.tiles.map((x) => x.group), true)[0];
    return hit ? this.tiles.find((x) => { let o = hit.object; while (o && o !== x.group) o = o.parent; return !!o; }) : null;
  }
  tap(e) { if (this.pets.tap(e)) return; const t = this.under(e); if (t) this.pick(t); }
  pick(t) {
    this.picked = t;
    for (const x of this.tiles) x.userData.tag.classList.toggle("on", x === t);
    const az = Math.atan2(this.camera.position.x - this.controls.target.x, this.camera.position.z - this.controls.target.z);
    this.view(t.base.clone().setY(5), 70, 0.95, az);
    this.onPick?.(t.userData);
  }
  // The town a resort is by, for the title over an opened tile.
  townOf(id) { return TOWNS.find((tw) => tw.ids.includes(id))?.en || ""; }
  overview() { this.picked = null; this.moved = false; for (const x of this.tiles) x.userData.tag.classList.remove("on"); this.view(this.home.target, this.fitDist(), this.home.polar, this.home.az); }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.getDrawingBufferSize(this.vig.value);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.home && !this.picked && !this.moved) this.view(this.home.target, this.fitDist(), this.home.polar, this.home.az, false);
  }

  frame(t) {
    if (!this.home) return;
    this.tiltCamera(-1);
    if (this.fly) {
      const u = Math.min(1, (performance.now() - this.fly.t0) / 1300), e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
      this.controls.target.lerpVectors(this.fly.fromT, this.fly.toT, e); this.camera.position.lerpVectors(this.fly.fromP, this.fly.toP, e);
      if (u >= 1) this.fly = null;
    }
    this.controls.update();
    const T = this.tilt; for (const k of ["az", "pol"]) T.now[k] += (T.want[k] - T.now[k]) * 0.08;
    T.on = { ...T.now }; this.tiltCamera(1);
    for (const x of this.tiles) {
      // The picked tile lifts off the map and grows, turning slowly; the others sink into the map so nothing
      // crosses it as it turns, and rise again when it's put back.
      const on = x === this.picked, hov = x === this.hover && !on, away = this.picked && !on;
      const up = on ? 5 + Math.sin(t * 1.6) * 0.25 : away ? -14 : hov ? 1.5 : 0, sc = on ? 1.7 : hov ? 1.15 : 1;
      x.group.position.y += (up - x.group.position.y) * 0.1;
      x.group.scale.setScalar(x.group.scale.x + (sc - x.group.scale.x) * 0.1);
      if (on && !this.fly && !this.dragging) x.group.rotation.y += 0.0035;
      if (!on) x.group.rotation.y += (0 - x.group.rotation.y) * 0.1;
    }
    this.pets.frame(t);
    this.renderer.render(this.scene, this.camera);
    this.pets.after(); // the animal in your hand, drawn over the map
    // Each name floats above its own tile on a thin line, so it's clear which is which however you turn
    // it. Where names would overlap, the nearer tile keeps its name.
    const v = new THREE.Vector3(), w = this.canvas.clientWidth, h = this.canvas.clientHeight, cam = this.camera.position;
    const dist = cam.distanceTo(this.controls.target), far = dist > this.fitDist() * 0.72, placed = [];
    const order = [...this.tiles].sort((a, b) => (b === this.picked) - (a === this.picked) || a.group.position.distanceTo(cam) - b.group.position.distanceTo(cam));
    for (const x of order) {
      const c = x.group.position, el = x.userData.tag;
      v.set(c.x, c.y + (x.group.userData.top + 2.2) * x.group.scale.x, c.z).project(this.camera);
      const px = (v.x * 0.5 + 0.5) * w, py = (-v.y * 0.5 + 0.5) * h, bw = (el._w ||= el.offsetWidth || 80), bh = 22;
      const clash = placed.some((r) => Math.abs(r.x - px) < (r.w + bw) / 2 + 4 && Math.abs(r.y - py) < bh);
      const hide = v.z > 1 || clash || (x.inGroup && far && x !== this.picked);
      el.style.visibility = hide ? "hidden" : "";
      if (!hide) placed.push({ x: px, y: py, w: bw });
      el.style.transform = `translate(${px}px, ${py}px) translate(-50%, -100%)`;
    }
    for (const m of this.marks) {
      if (m.rect) { // the frame side farthest from the camera, shown at the top of the screen
        const [x0, x1, z0, z1] = m.rect, c = m.at, d = new THREE.Vector3(c.x - cam.x, 0, c.z - cam.z);
        if (Math.abs(d.x) > Math.abs(d.z)) v.set(d.x > 0 ? x1 : x0, c.y, c.z); else v.set(c.x, c.y, d.z > 0 ? z1 : z0);
        v.project(this.camera);
      } else v.copy(m.at).project(this.camera);
      const hide = v.z > 1 || (far && m.kind !== "city" && m.kind !== "town group"); // towns and drive times once you're a little closer
      m.el.style.visibility = hide ? "hidden" : "";
      m.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(${m.rect ? "-50%, -120%" : "-50%, -50%"})`;
    }
  }
}
