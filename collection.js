// The resorts as a collection to conquer, on a real 3D map of central Colorado: the mountains from Denver
// to Aspen and Steamboat (real terrain, a little exaggerated), the interstates and highways, rivers and
// reservoirs, the towns. Every resort's runs are drawn where they are: grey until you've skied them, in
// their colour once you have; ski all of one and flowers grow on it and a flag goes up. Drag to move,
// two fingers to turn, tilt and zoom; tap a resort to fly to it. Built from data/region.{png,json}
// (tools/bake_region.py).
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";

const EX = 2.4; // vertical exaggeration, so the relief reads from far up
const BASE = 1350; // m: the floor of the slab, just under the plains
const yOf = (h) => ((h - BASE) / 1000) * EX;
const LEVEL = { easy: new THREE.Color(0x39a34a), intermediate: new THREE.Color(0x2f6fd6), advanced: new THREE.Color(0x1c1c1c), expert: new THREE.Color(0x1c1c1c) };
const UNSKIED = new THREE.Color(0x8d939c);
// Winter relief colours by elevation (m): pale plains, olive foothills, forest, treeline, snow.
const TINT = [[1400, 0xdcd2b4], [1800, 0xd2c9a4], [2150, 0xaeb58d], [2500, 0x809b72], [3050, 0x6c8a66], [3420, 0xc6cdc8], [3700, 0xf5f6f4]].map(([h, c]) => [h, new THREE.Color(c)]);
const tint = (h, out) => {
  if (h <= TINT[0][0]) return out.copy(TINT[0][1]);
  for (let i = 1; i < TINT.length; i++) if (h <= TINT[i][0]) return out.lerpColors(TINT[i - 1][1], TINT[i][1], (h - TINT[i - 1][0]) / (TINT[i][0] - TINT[i - 1][0]));
  return out.copy(TINT[TINT.length - 1][1]);
};
const ROCK = new THREE.Color(0xa8a196);
const loadImage = (src) => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; });

export class Collection {
  constructor(canvas, labels) {
    this.canvas = canvas; this.labels = labels;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    const s = (this.scene = new THREE.Scene());
    s.background = new THREE.Color(0xdde5ee);
    s.fog = new THREE.Fog(0xdde5ee, 700, 1800);
    s.add(new THREE.HemisphereLight(0xffffff, 0xb7ae9c, 1.6));
    const sun = new THREE.DirectionalLight(0xfff3e0, 2.2);
    sun.position.set(-70, 60, -50); // from the north-west, as relief maps are lit
    s.add(sun);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
    const c = (this.controls = new MapControls(this.camera, canvas));
    Object.assign(c, { enableDamping: true, dampingFactor: 0.09, screenSpacePanning: false, minDistance: 22, maxDistance: 900, minPolarAngle: 0.12, maxPolarAngle: 1.32, zoomToCursor: true });
    c.addEventListener("start", () => (this.fly = null));
    this.tiles = []; this.towns = []; this.picked = null; this.onPick = null;
    canvas.addEventListener("pointerdown", (e) => (this.down = { x: e.clientX, y: e.clientY }));
    canvas.addEventListener("pointerup", (e) => { const d = this.down; this.down = null; if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) this.tap(e); });
  }

  // list: [{ id, name, lat, lon }]; stats: { id: { share } }; log: the ski log ({ id: { runs: { runId: [idx] } } }).
  async build(list, stats, log = {}) {
    const [meta, img] = await Promise.all([fetch("data/region.json").then((x) => x.json()), loadImage("data/region.png")]);
    const [S, N, W, E] = meta.bounds, [LAT0, LON0, KX, KZ] = meta.origin, [GW, GH] = meta.grid;
    this.km = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
    const x0 = (W - LON0) * KX, x1 = (E - LON0) * KX, z0 = -(N - LAT0) * KZ, z1 = -(S - LAT0) * KZ;
    this.box = { x0, x1, z0, z1 };
    // Heights: half-meters over red and green. A few bad tiles spike past Colorado's highest peak; clamp.
    const cv = Object.assign(document.createElement("canvas"), { width: GW, height: GH }), g = cv.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, GW, GH).data, H = new Float32Array(GW * GH);
    for (let k = 0; k < GW * GH; k++) H[k] = Math.min(4400, (px[k * 4] * 256 + px[k * 4 + 1]) / 2);
    const hAt = (this.hAt = (x, z) => {
      const fx = Math.max(0, Math.min(GW - 1.001, ((x - x0) / (x1 - x0)) * (GW - 1))), fz = Math.max(0, Math.min(GH - 1.001, ((z - z0) / (z1 - z0)) * (GH - 1)));
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * GW + i;
      return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + GW] * (1 - u) + H[k + GW + 1] * u) * v;
    });

    // The land: a mesh at half the grid, a painted map draped over it, skirts down to the slab floor.
    const sw = Math.floor((GW - 1) / 2), sh = Math.floor((GH - 1) / 2);
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, sw, sh); geo.rotateX(-Math.PI / 2); geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) pos.setY(k, yOf(hAt(pos.getX(k), pos.getZ(k))));
    geo.computeVertexNormals();
    const tex = new THREE.CanvasTexture(this.paint(meta, H, GW, GH));
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const land = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }));
    this.land = land; this.scene.add(land);
    this.scene.add(this.skirt(geo, sw + 1, sh + 1));

    // Runs and lifts, draped on the land: grey where you haven't been, the run's colour where you have.
    const lift = (x, z, up = 0.05) => new THREE.Vector3(x, yOf(hAt(x, z)) + up, z);
    for (const r of list) {
      const R = meta.resorts[r.id]; if (!R) continue;
      const done = log[r.id]?.runs || {}, P = [], C = [];
      for (const run of R.runs) {
        const set = new Set(done[String(run.id)] || []), col = LEVEL[run.l] || LEVEL.intermediate;
        for (let k = 0; k + 1 < run.p.length; k++) {
          let hit = false; for (let i = run.i[k]; i <= run.i[k + 1] && !hit; i++) hit = set.has(i);
          P.push(lift(...run.p[k]), lift(...run.p[k + 1]));
          const c = hit ? col : UNSKIED; C.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
      }
      const lg = new THREE.BufferGeometry().setFromPoints(P); lg.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
      this.scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, fog: false })));
      const L = []; for (const [a, b] of R.lifts) L.push(lift(...a, 0.06), lift(...b, 0.12));
      this.scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(L), new THREE.LineBasicMaterial({ color: 0x40342a, fog: false })));

      // The resort's own spot: the middle of its runs, a pin, its label.
      let cx = 0, cz = 0, n = 0; for (const run of R.runs) for (const p of run.p) { cx += p[0]; cz += p[1]; n++; }
      [cx, cz] = n ? [cx / n, cz / n] : this.km(r.lat, r.lon);
      const share = stats[r.id]?.share || 0, spot = lift(cx, cz, 0);
      const pin = new THREE.Group(); pin.position.copy(spot);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshLambertMaterial({ color: new THREE.Color(0x9aa0a8).lerp(new THREE.Color(0xd2462f), share > 0 ? 0.4 + 0.6 * share : 0) }));
      head.position.y = 2.2;
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2), new THREE.MeshLambertMaterial({ color: 0x4a3a2c }));
      stick.position.y = 1.1; pin.add(head, stick);
      if (share >= 0.999) pin.add(this.bloom(R, lift, spot));
      this.scene.add(pin);
      const el = document.createElement("button");
      el.className = "ctag"; el.innerHTML = `<b>${share >= 0.999 ? "🌸 " : ""}${r.name.replace(/ Mountain$| Basin$/, "")}</b>${share > 0 && share < 0.999 ? `<small>${Math.max(1, Math.round(share * 100))}%</small>` : ""}`;
      const t = { userData: { ...r, share, tag: el }, at: spot.clone().setY(spot.y + 2.8), spot, pin };
      el.onclick = () => this.pick(t);
      this.labels.append(el);
      this.tiles.push(t);
    }
    for (const [name, lat, lon, size] of meta.towns) {
      const [x, z] = this.km(lat, lon), el = document.createElement("div");
      el.className = `ctag town s${size}`; el.textContent = name; this.labels.append(el);
      this.towns.push({ el, at: lift(x, z, 0.3), big: size === 3 });
    }
    this.towns.sort((a, b) => b.big - a.big);
    // First view: all the resorts and Denver, from the south, tilted.
    const b = new THREE.Box3(); for (const t of this.tiles) b.expandByPoint(t.spot); const denver = lift(...this.km(39.74, -104.99), 1); b.expandByPoint(denver);
    this.home = { target: b.getCenter(new THREE.Vector3()).setY(3), denver };
    this.view(this.home.target, this.fitDist(), 0.6, 0, false);
  }

  // The map painted once: relief colours with a hill shade, then the cities, water and roads on top.
  paint(meta, H, GW, GH) {
    const { x0, x1, z0, z1 } = this.box, TW = 2048, TH = Math.round((TW * GH) / GW);
    const small = Object.assign(document.createElement("canvas"), { width: GW, height: GH }), sg = small.getContext("2d");
    const im = sg.createImageData(GW, GH), d = im.data, c = new THREE.Color();
    const cw = ((x1 - x0) * 1000) / (GW - 1), ch = ((z1 - z0) * 1000) / (GH - 1);
    const L = new THREE.Vector3(-1, 1.25, -1).normalize(), n = new THREE.Vector3();
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const k = j * GW + i, h = H[k];
      const dx = (H[j * GW + Math.min(GW - 1, i + 1)] - H[j * GW + Math.max(0, i - 1)]) / (2 * cw), dz = (H[Math.min(GH - 1, j + 1) * GW + i] - H[Math.max(0, j - 1) * GW + i]) / (2 * ch);
      n.set(-dx * 1.6, 1, -dz * 1.6).normalize();
      const shade = Math.max(0, n.dot(L)), steep = 1 - n.y;
      tint(h + steep * 900, c); // steep faces lose their trees: push them up the ramp
      if (h > 3300 && steep > 0.35) c.lerp(ROCK, 0.5); // bare rock on cliffs
      const f = 0.62 + 0.55 * shade;
      d[k * 4] = Math.min(255, c.r * 255 * f * 0.98); d[k * 4 + 1] = Math.min(255, c.g * 255 * f * 0.99); d[k * 4 + 2] = Math.min(255, c.b * 255 * (f * 0.92 + 0.1)); d[k * 4 + 3] = 255;
    }
    sg.putImageData(im, 0, 0);
    const big = Object.assign(document.createElement("canvas"), { width: TW, height: TH }), g = big.getContext("2d");
    g.imageSmoothingQuality = "high"; g.drawImage(small, 0, 0, TW, TH);
    const P = ([x, z]) => [((x - x0) / (x1 - x0)) * TW, ((z - z0) / (z1 - z0)) * TH], s = TW / (x1 - x0); // px per km
    const path = (pts) => { g.beginPath(); pts.forEach((p, i) => g[i ? "lineTo" : "moveTo"](...P(p))); };
    // Denver and Boulder: the built-up plains, a warm grey.
    for (const [lat, lon, r] of [[39.72, -104.96, 17], [40.02, -105.25, 5]]) {
      const [cx, cy] = P(this.km(lat, lon)), grd = g.createRadialGradient(cx, cy, 0, cx, cy, r * s);
      grd.addColorStop(0, "rgba(176,160,146,.55)"); grd.addColorStop(0.7, "rgba(176,160,146,.3)"); grd.addColorStop(1, "rgba(176,160,146,0)");
      g.fillStyle = grd; g.fillRect(cx - r * s, cy - r * s, 2 * r * s, 2 * r * s);
    }
    g.lineJoin = g.lineCap = "round";
    g.strokeStyle = "#86acc9"; g.lineWidth = 1.6;
    for (const r of meta.rivers) { path(r); g.stroke(); }
    g.fillStyle = "#93b9d8";
    for (const w of meta.water) { path(w); g.closePath(); g.fill(); }
    for (const [cls, casing, color, wide] of [[2, null, "#f0cf8a", 1.6], [1, "rgba(255,255,255,.8)", "#eca346", 2.2], [0, "rgba(255,255,255,.9)", "#de6b34", 3]]) {
      const rs = meta.roads.filter((r) => r.c === cls);
      if (casing) { g.strokeStyle = casing; g.lineWidth = wide + 2; for (const r of rs) { path(r.p); g.stroke(); } }
      g.strokeStyle = color; g.lineWidth = wide; for (const r of rs) { path(r.p); g.stroke(); }
    }
    return big;
  }

  // Sides of the slab: earth from the land's edge down to the floor, like a cut-out relief model.
  skirt(geo, cols, rows) {
    const pos = geo.attributes.position, P = [], I = [], edge = [];
    for (let i = 0; i < cols; i++) edge.push(i);
    for (let j = 1; j < rows; j++) edge.push(j * cols + cols - 1);
    for (let i = cols - 2; i >= 0; i--) edge.push((rows - 1) * cols + i);
    for (let j = rows - 2; j >= 0; j--) edge.push(j * cols);
    for (const k of edge) P.push(pos.getX(k), pos.getY(k), pos.getZ(k), pos.getX(k), -1.2, pos.getZ(k));
    for (let e = 0; e + 1 < edge.length; e++) { const a = e * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xb8a487, side: THREE.DoubleSide }));
  }

  // Conquered: flowers along the runs, and a flag on the pin (both placed relative to the pin's spot).
  bloom(R, lift, spot) {
    const g = new THREE.Group(), pts = R.runs.flatMap((r) => r.p), m = new THREE.Matrix4();
    const petal = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), 160);
    const colors = [0xf28ab2, 0xffd166, 0xffffff, 0xc39bd3];
    for (let k = 0; k < 160; k++) {
      const p = pts[Math.floor(Math.random() * pts.length)], v = lift(p[0] + (Math.random() - 0.5) * 0.3, p[1] + (Math.random() - 0.5) * 0.3, 0.08);
      m.makeTranslation(v.x - spot.x, v.y - spot.y, v.z - spot.z); petal.setMatrixAt(k, m); petal.setColorAt(k, new THREE.Color(colors[k % 4]));
    }
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshLambertMaterial({ color: 0xe8453c, side: THREE.DoubleSide }));
    flag.position.set(0.45, 1.7, 0);
    g.add(petal, flag);
    return g;
  }

  // The distance at which every resort and Denver fit the screen, label room included, from the overview
  // angle: measured by projecting them, since the near (south) side of a tilted map spreads wider.
  fitDist() {
    const cam = this.camera.clone(), pts = [...this.tiles.map((t) => t.at), this.home.denver], v = new THREE.Vector3();
    let d = 300;
    for (let it = 0; it < 6; it++) {
      const off = new THREE.Vector3(0, Math.cos(0.6), Math.sin(0.6)).multiplyScalar(d);
      cam.position.copy(this.home.target).add(off); cam.lookAt(this.home.target); cam.updateMatrixWorld();
      let m = 0; for (const p of pts) { v.copy(p).project(cam); m = Math.max(m, Math.abs(v.x) / 0.8, Math.abs(v.y) / 0.7); }
      d *= m;
    }
    return Math.min(this.controls.maxDistance, d);
  }
  // Look at target from dist: polar angle from straight down, azimuth from the south.
  view(target, dist, polar, az, glide = true) {
    const off = new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az)).multiplyScalar(dist);
    if (!glide) { this.controls.target.copy(target); this.camera.position.copy(target).add(off); this.controls.update(); return; }
    this.fly = { t0: performance.now(), fromT: this.controls.target.clone(), fromP: this.camera.position.clone(), toT: target.clone(), toP: target.clone().add(off) };
  }

  tap(e) {
    const r = this.canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hit = ray.intersectObjects(this.tiles.map((t) => t.pin), true)[0];
    if (hit) { const t = this.tiles.find((t) => { let o = hit.object; while (o && o !== t.pin) o = o.parent; return o === t.pin; }); if (t) return this.pick(t); }
    // Or the resort nearest where you tapped the land, if close.
    const land = ray.intersectObject(this.land)[0]; if (!land) return;
    let best = null, bd = 6; for (const t of this.tiles) { const d = Math.hypot(t.spot.x - land.point.x, t.spot.z - land.point.z); if (d < bd) { bd = d; best = t; } }
    if (best) this.pick(best);
  }
  pick(t) {
    this.picked = t;
    for (const x of this.tiles) x.userData.tag.classList.toggle("on", x === t);
    const az = Math.atan2(this.camera.position.x - this.controls.target.x, this.camera.position.z - this.controls.target.z);
    this.view(t.spot, 48, 0.9, az);
    this.onPick?.(t.userData);
  }
  // Back out to the whole map.
  overview() { this.picked = null; for (const x of this.tiles) x.userData.tag.classList.remove("on"); this.view(this.home.target, this.fitDist(), 0.6, 0); }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  frame(t) {
    if (!this.home) return;
    if (this.fly) {
      const u = Math.min(1, (performance.now() - this.fly.t0) / 1400), e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
      this.controls.target.lerpVectors(this.fly.fromT, this.fly.toT, e); this.camera.position.lerpVectors(this.fly.fromP, this.fly.toP, e);
      if (u >= 1) this.fly = null;
    }
    // Keep the view over the map.
    const { x0, x1, z0, z1 } = this.box, tg = this.controls.target, before = tg.clone();
    tg.x = Math.max(x0, Math.min(x1, tg.x)); tg.z = Math.max(z0, Math.min(z1, tg.z));
    this.camera.position.add(tg.clone().sub(before));
    this.controls.update();
    for (const x of this.tiles) x.pin.children[0].position.y = 2.2 + (x === this.picked ? 0.35 + Math.sin(t * 3) * 0.2 : 0);
    this.renderer.render(this.scene, this.camera);
    // Labels: resorts first (the picked one before all), nudged down when they'd overlap; towns where there's room.
    const v = new THREE.Vector3(), w = this.canvas.clientWidth, h = this.canvas.clientHeight, placed = [];
    const put = (el, p, nudge) => {
      v.copy(p).project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) { el.style.visibility = "hidden"; return; }
      const x = (v.x * 0.5 + 0.5) * w; let y = (-v.y * 0.5 + 0.5) * h - 26;
      const bw = (el._w ||= el.offsetWidth || 80), bh = 22;
      const clash = () => placed.some((r) => Math.abs(r.x - x) < (r.w + bw) / 2 + 2 && Math.abs(r.y - y) < bh);
      for (let k = 0; k < (nudge ? 4 : 0) && clash(); k++) y += bh;
      if (clash()) { el.style.visibility = "hidden"; return; }
      placed.push({ x, y, w: bw }); el.style.visibility = "";
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, 0)`;
    };
    for (const x of [...this.tiles].sort((a, b) => (b === this.picked) - (a === this.picked))) put(x.userData.tag, x.at, true);
    for (const x of this.towns) put(x.el, x.at, false);
  }
}
