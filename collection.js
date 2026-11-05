// The resorts as little relief models standing on a watercolour map of central Colorado: each one a square
// of the resort's real mountain (data/tiles.json, assets/tiles: tools/bake_tiles.py) on a pale plinth, set
// where it is (Aspen's four, too close together, sit as a two-by-two in their valley); each framed with the
// town it's by; the drives between them along the roads, with how long they take (data/drives.json), and
// Denver. Turn it all the way round, tilt and zoom; tap a tile to lift it and see it. Its colour comes back
// the more of it you've skied; ski all of it and a flag goes up.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { EN_ON } from "./i18n.js?v=9";
import { ANIMALS, strataWalls, heightAt, pines, animal, walk } from "./diorama.js?v=1";

// Diorama tiles (taller, cut-away sides in layers, pines, an animal each): on trial with ?diorama.
const DIO = new URLSearchParams(location.search).has("diorama");

const S = 12, PLINTH = 1.6, EX = 1.35; // tile size, plinth depth, vertical exaggeration
const MAP = { S: 38.98, N: 40.72, W: -107.4, E: -104.78, w: 140 }; // the painted map (tools/bake_map.py) and its width in scene units
const KM = MAP.w / ((MAP.E - MAP.W) * 85.3); // scene units per km
const at = (lat, lon) => new THREE.Vector3((lon - (MAP.W + MAP.E) / 2) * 85.3 * KM, 0, -(lat - (MAP.N + MAP.S) / 2) * 111 * KM);
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
    s.background = new THREE.Color(0xf3efe8);
    s.add(new THREE.HemisphereLight(0xffffff, 0xd9d0c2, 1.5));
    const sun = new THREE.DirectionalLight(0xfff4e6, 2.3);
    sun.position.set(-60, 100, -48); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 1, far: 300 });
    sun.shadow.bias = -0.0008; sun.shadow.radius = 4;
    s.add(sun);
    const fill = new THREE.DirectionalLight(0xe6eefb, 0.9); fill.position.set(30, 20, 40); s.add(fill); // the sky's light on the sides facing you
    // The painted map the tiles stand on (it takes their shadows too).
    const mh = MAP.w * ((MAP.N - MAP.S) * 111) / ((MAP.E - MAP.W) * 85.3);
    const tex = new THREE.TextureLoader().load("assets/wc/colorado.jpg?v=2", (x) => (x.colorSpace = THREE.SRGBColorSpace));
    tex.anisotropy = 8;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAP.w, mh), new THREE.MeshStandardMaterial({ map: tex, color: 0xdedbd6, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -PLINTH; floor.receiveShadow = true; s.add(floor);
    // The sheet's edge, a little thickness of paper.
    const edge = new THREE.Mesh(new THREE.BoxGeometry(MAP.w, 2, mh), new THREE.MeshStandardMaterial({ color: 0xece6db, roughness: 1 }));
    edge.position.y = -PLINTH - 1.2; edge.receiveShadow = true; s.add(edge);
    this.marks = []; // HTML labels pinned to the map: towns, drive times, Denver
    this.camera = new THREE.PerspectiveCamera(30, 1, 4, 900);
    const c = (this.controls = new OrbitControls(this.camera, canvas));
    Object.assign(c, { enableDamping: true, dampingFactor: 0.08, minDistance: 14, maxDistance: 700, minPolarAngle: 0.25, maxPolarAngle: 1.25, enablePan: true, screenSpacePanning: false });
    c.addEventListener("start", () => { this.fly = null; this.moved = true; this.dragging = true; });
    c.addEventListener("end", () => (this.dragging = false));
    this.tiles = []; this.picked = null; this.onPick = null;
    canvas.addEventListener("pointerdown", (e) => (this.down = { x: e.clientX, y: e.clientY }));
    // With a mouse, the tile under it rises a little.
    canvas.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" && !this.down) this.hover = this.under(e); });
    canvas.addEventListener("pointerleave", () => (this.hover = null));
    canvas.addEventListener("pointerup", (e) => { const d = this.down; this.down = null; if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) this.tap(e); });
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
    for (let v = 0; v < pos.count; v++) pos.setY(v, (q[v] / 2) * k + (DIO ? 1.6 : 0.15));
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
      if (ANIMALS[id]) { const a = animal(ANIMALS[id]); g.add(a); (this.walkers ||= []).push({ a, h, seed: (id.charCodeAt(0) % 7) * 0.9 }); }
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
    g.userData.top = Math.max(...Array.from({ length: pos.count }, (_, v) => pos.getY(v)));
    return g;
  }

  // Look at target from dist: polar angle from straight down, azimuth round from the south.
  view(target, dist, polar, az, glide = true) {
    const off = new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az)).multiplyScalar(dist);
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
      let m = 0; for (const p of pts) { v.copy(p).project(cam); m = Math.max(m, Math.abs(v.x) / 0.96, Math.abs(v.y) / 0.6); }
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
  tap(e) { const t = this.under(e); if (t) this.pick(t); }
  pick(t) {
    this.picked = t;
    for (const x of this.tiles) x.userData.tag.classList.toggle("on", x === t);
    const az = Math.atan2(this.camera.position.x - this.controls.target.x, this.camera.position.z - this.controls.target.z);
    this.view(t.base.clone().setY(5), 70, 0.95, az);
    this.onPick?.(t.userData);
  }
  overview() { this.picked = null; this.moved = false; for (const x of this.tiles) x.userData.tag.classList.remove("on"); this.view(this.home.target, this.fitDist(), this.home.polar, this.home.az); }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.home && !this.picked && !this.moved) this.view(this.home.target, this.fitDist(), this.home.polar, this.home.az, false);
  }

  frame(t) {
    if (!this.home) return;
    if (this.fly) {
      const u = Math.min(1, (performance.now() - this.fly.t0) / 1300), e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
      this.controls.target.lerpVectors(this.fly.fromT, this.fly.toT, e); this.camera.position.lerpVectors(this.fly.fromP, this.fly.toP, e);
      if (u >= 1) this.fly = null;
    }
    this.controls.update();
    // The picked tile lifts off the map and grows, turning slowly, so its relief reads; the rest stay put.
    for (const x of this.tiles) {
      const on = x === this.picked, hov = x === this.hover && !on, up = on ? 5 + Math.sin(t * 1.6) * 0.25 : hov ? 1.5 : 0, sc = on ? 1.7 : hov ? 1.15 : 1;
      x.group.position.y += (up - x.group.position.y) * 0.1;
      x.group.scale.setScalar(x.group.scale.x + (sc - x.group.scale.x) * 0.1);
      if (on && !this.fly && !this.dragging) x.group.rotation.y += 0.0035;
      if (!on) x.group.rotation.y += (0 - x.group.rotation.y) * 0.1;
    }
    for (const w of this.walkers || []) walk(w.a, w.h, t, w.seed, S);
    this.renderer.render(this.scene, this.camera);
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
