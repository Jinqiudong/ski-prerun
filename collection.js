// The resorts as a set of little relief models, like a shelf of terrain tiles: each one a square of the
// resort's real mountain (data/tiles.json, assets/tiles: tools/bake_tiles.py) on a pale plinth, laid out
// three by three, north at the back. Turn the whole set all the way round, tilt and zoom; tap a tile to
// lift it and see it. Its colour comes back the more of it you've skied; ski all of it and a flag goes up.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const S = 10, GAP = 14, PLINTH = 1.4, EX = 1.35; // tile size, spacing, plinth depth, vertical exaggeration
// Three by three, roughly as they lie: Steamboat and the Front Range up top, Summit County, then Aspen's four.
const LAYOUT = [["steamboat", "winterpark", "eldora"], ["snowmass", "copper", "abasin"], ["buttermilk", "highlands", "aspenmountain"]];

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
    sun.position.set(-30, 50, -24); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 });
    sun.shadow.bias = -0.0008; sun.shadow.radius = 4;
    s.add(sun);
    const fill = new THREE.DirectionalLight(0xe6eefb, 0.9); fill.position.set(30, 20, 40); s.add(fill); // the sky's light on the sides facing you
    // A floor that only catches the tiles' shadows.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -PLINTH; floor.receiveShadow = true; s.add(floor);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 600);
    const c = (this.controls = new OrbitControls(this.camera, canvas));
    Object.assign(c, { enableDamping: true, dampingFactor: 0.08, minDistance: 14, maxDistance: 320, minPolarAngle: 0.25, maxPolarAngle: 1.25, enablePan: true, screenSpacePanning: false });
    c.addEventListener("start", () => { this.fly = null; this.moved = true; });
    this.tiles = []; this.picked = null; this.onPick = null;
    canvas.addEventListener("pointerdown", (e) => (this.down = { x: e.clientX, y: e.clientY }));
    canvas.addEventListener("pointerup", (e) => { const d = this.down; this.down = null; if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) this.tap(e); });
  }

  // list: [{ id, name }]; stats: { id: { share } }.
  async build(list, stats) {
    const data = await (await fetch("data/tiles.json")).json(), loader = new THREE.TextureLoader();
    const byId = Object.fromEntries(list.map((r) => [r.id, r]));
    LAYOUT.forEach((row, j) => row.forEach((id, i) => {
      const r = byId[id], d = data[id]; if (!r || !d) return;
      const share = stats[id]?.share || 0;
      const tile = this.tile(d, loader.load(`assets/tiles/${id}.jpg?v=2`, (tx) => (tx.colorSpace = THREE.SRGBColorSpace)), share);
      tile.position.set((i - 1) * GAP, 0, (j - 1) * GAP);
      const el = document.createElement("button");
      el.className = "ctag";
      el.innerHTML = `<b>${share >= 0.999 ? "⚑ " : ""}${r.name.replace(/ Mountain$| Basin$/, "").toUpperCase()}</b>${share > 0 && share < 0.999 ? `<small>${Math.max(1, Math.round(share * 100))}%</small>` : ""}`;
      const t = { userData: { ...r, share, tag: el }, group: tile, base: tile.position.clone() };
      el.onclick = () => this.pick(t);
      this.labels.append(el);
      this.tiles.push(t); this.scene.add(tile);
    }));
    this.home = { target: new THREE.Vector3(0, 0, 1), polar: 0.9, az: 0.38 };
    this.view(this.home.target, this.fitDist(), this.home.polar, this.home.az, false);
  }

  // One tile: the terrain on top (its texture greyed until you've skied it), a plinth under it.
  tile(d, tex, share) {
    const g = new THREE.Group(), n = d.grid;
    const raw = Uint8Array.from(atob(d.heights), (ch) => ch.charCodeAt(0)), q = new Uint16Array(raw.buffer);
    const k = (S / d.size) * EX, top = new THREE.PlaneGeometry(S, S, n - 1, n - 1);
    top.rotateX(-Math.PI / 2);
    const pos = top.attributes.position;
    for (let v = 0; v < pos.count; v++) pos.setY(v, (q[v] / 2) * k + 0.15);
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
    const wg = new THREE.BufferGeometry(); wg.setAttribute("position", new THREE.Float32BufferAttribute(side, 3)); wg.setIndex(idx); wg.computeVertexNormals();
    const wall = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: 0xf1ede7, roughness: 0.85, side: THREE.DoubleSide }));
    wall.castShadow = wall.receiveShadow = true; g.add(wall);
    // Conquered: a little red flag on the highest point.
    if (share >= 0.999) {
      let hi = 0; for (let v = 1; v < pos.count; v++) if (pos.getY(v) > pos.getY(hi)) hi = v;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6), new THREE.MeshStandardMaterial({ color: 0x3a3f4a }));
      pole.position.set(pos.getX(hi), pos.getY(hi) + 0.8, pos.getZ(hi));
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshStandardMaterial({ color: 0xb6463b, side: THREE.DoubleSide }));
      flag.position.set(pos.getX(hi) + 0.4, pos.getY(hi) + 1.35, pos.getZ(hi));
      g.add(pole, flag);
    }
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
    const cam = this.camera.clone(), v = new THREE.Vector3(), { target, polar, az } = this.home, pts = [];
    for (const t of this.tiles) for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pts.push(new THREE.Vector3(t.base.x + (dx * S) / 2, 0, t.base.z + (dz * S) / 2));
    let d = 60;
    for (let it = 0; it < 6; it++) {
      cam.position.set(target.x + Math.sin(polar) * Math.sin(az) * d, target.y + Math.cos(polar) * d, target.z + Math.sin(polar) * Math.cos(az) * d);
      cam.lookAt(target); cam.updateMatrixWorld();
      let m = 0; for (const p of pts) { v.copy(p).project(cam); m = Math.max(m, Math.abs(v.x) / 0.97, Math.abs(v.y) / 0.66); }
      d *= m;
    }
    return Math.min(this.controls.maxDistance, d);
  }

  tap(e) {
    const r = this.canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hit = ray.intersectObjects(this.tiles.map((x) => x.group), true)[0];
    if (!hit) return;
    const t = this.tiles.find((x) => { let o = hit.object; while (o && o !== x.group) o = o.parent; return !!o; });
    if (t) this.pick(t);
  }
  pick(t) {
    this.picked = t;
    for (const x of this.tiles) x.userData.tag.classList.toggle("on", x === t);
    const az = Math.atan2(this.camera.position.x - this.controls.target.x, this.camera.position.z - this.controls.target.z);
    this.view(t.base.clone().setY(1.5), 40, 0.95, az);
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
    for (const x of this.tiles) { const up = x === this.picked ? 1.2 + Math.sin(t * 2.4) * 0.12 : 0; x.group.position.y += (up - x.group.position.y) * 0.12; }
    this.renderer.render(this.scene, this.camera);
    // Each name sits by its tile's foot, on the side facing you.
    const v = new THREE.Vector3(), w = this.canvas.clientWidth, h = this.canvas.clientHeight, cam = this.camera.position;
    for (const x of this.tiles) {
      const c = x.group.position, dir = new THREE.Vector3(cam.x - c.x, 0, cam.z - c.z).normalize();
      v.set(c.x + dir.x * S * 0.66, c.y - PLINTH, c.z + dir.z * S * 0.66).project(this.camera);
      const el = x.userData.tag;
      el.style.visibility = v.z > 1 ? "hidden" : "";
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, 0)`;
    }
  }
}
