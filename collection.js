// The resorts as a collection to conquer: a cream slab of the Colorado mountains (Denver and I-70 for
// bearings) with each resort a little 3D block of its real terrain at its real place, like a set of model
// tiles. Unskied resorts are grey; the more of one you've skied, the more its colour comes back; ski all
// of it and flowers grow on it and a flag goes up. Tap a block to choose it.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const LAT0 = 39.75, LON0 = -105.95, KX = 85.3, KZ = 111; // km per degree here
const at = (lat, lon) => new THREE.Vector3((lon - LON0) * KX, 0, -(lat - LAT0) * KZ);
const I70 = [[39.74, -104.99], [39.74, -105.51], [39.68, -105.93], [39.6, -106.07], [39.5, -106.15], [39.64, -106.37], [39.64, -106.8], [39.55, -107.32]];
const TILE = 21, HALF_KM = 5;

export class Collection {
  constructor(canvas, labels) {
    this.canvas = canvas; this.labels = labels;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    const s = (this.scene = new THREE.Scene());
    s.background = new THREE.Color(0xd9e1ea);
    s.add(new THREE.HemisphereLight(0xffffff, 0xb8ae9c, 1.5));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
    sun.position.set(-60, 120, 70); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 1, far: 400 });
    s.add(sun);
    this.camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);
    this.tiles = []; this.picked = null; this.onPick = null;
    this.spin = 0; this.drag = null;
    canvas.addEventListener("pointerdown", (e) => (this.drag = { x: e.clientX, s: this.spin, moved: 0 }));
    addEventListener("pointermove", (e) => { if (this.drag) { this.drag.moved = Math.max(this.drag.moved, Math.abs(e.clientX - this.drag.x)); this.spin = Math.max(-0.6, Math.min(0.6, this.drag.s + (e.clientX - this.drag.x) / 500)); } });
    canvas.addEventListener("pointerup", (e) => { const d = this.drag; this.drag = null; if (d && d.moved < 8) this.tap(e); });
    this.ground();
  }

  // The slab: cream, rounded, the I-70 corridor dashed across it, Denver marked.
  ground() {
    const g = new THREE.Group();
    const road = I70.map(([la, lo]) => at(la, lo).setY(0.05));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(road), new THREE.LineDashedMaterial({ color: 0xa79b86, dashSize: 2.5, gapSize: 1.6 }));
    line.computeLineDistances(); g.add(line);
    const den = at(39.74, -104.99), pin = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4, 12), new THREE.MeshStandardMaterial({ color: 0xc9563f }));
    pin.rotation.x = Math.PI; pin.position.copy(den).setY(2); g.add(pin);
    this.denver = den;
    this.scene.add(g);
  }

  // list: [{ id, name, lat, lon }]; stats: { id: { share } }. Each block's terrain from data/<id>-far.json.
  async build(list, stats) {
    this.list = list;
    for (const r of list) {
      const far = await (await fetch(`data/${r.id}-far.json`)).json().catch(() => null);
      const share = stats[r.id]?.share || 0;
      const tile = this.tile(far, share);
      tile.position.copy(at(r.lat, r.lon));
      tile.userData = { ...r, share, base: tile.position.clone() };
      this.tiles.push(tile); this.scene.add(tile);
    }
    // Neighbours a few km apart (the four Aspen mountains) are spread so the blocks don't overlap.
    for (let it = 0; it < 60; it++) for (const a of this.tiles) for (const b of this.tiles) {
      if (a === b) continue;
      const d = a.position.clone().sub(b.position).setY(0), L = d.length(), min = TILE * 1.4;
      if (L < min) { d.setLength((min - L) / 2 || 0.5); a.position.add(d); b.position.sub(d); }
    }
    for (const t of this.tiles) t.userData.base.copy(t.position);
    // The slab under them all (Denver included), and the view to fit it.
    const box = new THREE.Box3(); for (const t of this.tiles) box.expandByPoint(t.position); box.expandByPoint(this.denver);
    box.expandByScalar(TILE * 0.9);
    const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const slab = new THREE.Mesh(new RoundedBoxGeometry(size.x + 8, 6, size.z + 8, 4, 4), new THREE.MeshStandardMaterial({ color: 0xf7f2e7, roughness: 0.9 }));
    slab.position.set(mid.x, -6, mid.z); slab.receiveShadow = true; this.scene.add(slab);
    this.fit = { mid, half: new THREE.Vector2(size.x / 2 + 4, size.z / 2 + 4) };
    for (const t of this.tiles) {
      const el = document.createElement("button");
      const sh = t.userData.share;
      el.className = "ctag"; el.innerHTML = `<b>${sh >= 0.999 ? "🌸 " : ""}${t.userData.name.replace(/ Mountain$| Basin$/, "")}</b>${sh > 0 && sh < 0.999 ? `<small>${Math.max(1, Math.round(sh * 100))}%</small>` : ""}`;
      el.onclick = () => this.pick(t);
      this.labels.append(el); t.userData.tag = el;
    }
    const den = document.createElement("div"); den.className = "ctag city"; den.textContent = "Denver"; this.labels.append(den); this.denTag = den;
  }

  tile(far, share) {
    const g = new THREE.Group(), n = 44;
    const body = new THREE.Mesh(new RoundedBoxGeometry(TILE, 3, TILE, 3, 0.8), new THREE.MeshStandardMaterial({ color: 0xe9e3d6, roughness: 0.85 }));
    body.position.y = -1.5; body.castShadow = body.receiveShadow = true; g.add(body);
    const geo = new THREE.PlaneGeometry(TILE - 0.4, TILE - 0.4, n - 1, n - 1); geo.rotateX(-Math.PI / 2);
    const hs = new Float32Array(n * n);
    if (far) {
      const raw = Uint8Array.from(atob(far.heights), (c) => c.charCodeAt(0)), q = new Uint16Array(raw.buffer), N = far.grid;
      const cells = (HALF_KM * 1000) / ((2 * far.half) / (N - 1)), c0 = (N - 1) / 2;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const cc = Math.round(c0 - cells + (2 * cells * i) / (n - 1)), rr = Math.round(c0 - cells + (2 * cells * j) / (n - 1));
        hs[j * n + i] = q[rr * N + cc] * far.scale + far.offset;
      }
    }
    let lo = Infinity, hi = -Infinity; for (const h of hs) { lo = Math.min(lo, h); hi = Math.max(hi, h); }
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color(), grey = new THREE.Color();
    const forest = new THREE.Color(0x5f8a5c), rock = new THREE.Color(0x9a9286), snow = new THREE.Color(0xf7f8fa);
    const vivid = share > 0 ? 0.35 + 0.65 * share : 0; // grey until you've been, then colour comes back
    for (let k = 0; k < pos.count; k++) {
      const h = hs[k], t = hi > lo ? (h - lo) / (hi - lo) : 0;
      pos.setY(k, (h - lo) * 0.0045 + 0.02);
      c.copy(t < 0.45 ? forest : t < 0.62 ? forest.clone().lerp(rock, (t - 0.45) / 0.17) : t < 0.75 ? rock.clone().lerp(snow, (t - 0.62) / 0.13) : snow);
      const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; grey.setRGB(l * 0.95 + 0.04, l * 0.95 + 0.04, l * 0.97 + 0.05);
      c.lerpColors(grey, c, vivid);
      col.set([c.r, c.g, c.b], k * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: false }));
    land.castShadow = land.receiveShadow = true; g.add(land);
    // Conquered: flowers all over and a flag on the top.
    if (share >= 0.999) {
      const petal = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: 0xffffff }), 90), m = new THREE.Matrix4();
      const palette = [0xf28ab2, 0xffd166, 0xffffff, 0xc39bd3];
      for (let k = 0; k < 90; k++) {
        const v = Math.floor(Math.random() * pos.count);
        m.makeTranslation(pos.getX(v), pos.getY(v) + 0.12, pos.getZ(v)); petal.setMatrixAt(k, m); petal.setColorAt(k, new THREE.Color(palette[k % 4]));
      }
      g.add(petal);
      let top = 0; for (let k = 1; k < pos.count; k++) if (pos.getY(k) > pos.getY(top)) top = k;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2), new THREE.MeshStandardMaterial({ color: 0x3a3f4a }));
      pole.position.set(pos.getX(top), pos.getY(top) + 1.1, pos.getZ(top));
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshStandardMaterial({ color: 0xe8453c, side: THREE.DoubleSide }));
      flag.position.set(pos.getX(top) + 0.55, pos.getY(top) + 1.85, pos.getZ(top));
      g.add(pole, flag);
    }
    return g;
  }

  tap(e) {
    const r = this.canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hit = ray.intersectObjects(this.tiles, true)[0];
    if (!hit) return;
    let t = hit.object; while (t && !this.tiles.includes(t)) t = t.parent;
    if (t) this.pick(t);
  }
  pick(t) {
    this.picked = t;
    for (const x of this.tiles) x.userData.tag.classList.toggle("on", x === t);
    this.onPick?.(t.userData);
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  frame(t) {
    if (!this.fit) return;
    // Seen from the south, steeply, at the distance that fits the slab: across by its width, up and down
    // by its depth foreshortened.
    const cam = this.camera, a = this.spin, c = this.fit.mid, el = 1.12; // ~64° down
    const tv = Math.tan((cam.fov * Math.PI) / 360), th = tv * cam.aspect;
    const D = Math.max(this.fit.half.x / th, (this.fit.half.y * Math.sin(el) + 6) / tv) * 1.04;
    cam.position.set(c.x + Math.sin(a) * D * Math.cos(el), D * Math.sin(el), c.z + Math.cos(a) * D * Math.cos(el));
    cam.lookAt(c.x, 0, c.z);
    for (const x of this.tiles) {
      const up = x === this.picked ? 2 + Math.sin(t * 3) * 0.3 : 0;
      x.position.y += (up - x.position.y) * 0.15;
    }
    this.renderer.render(this.scene, cam);
    const v = new THREE.Vector3(), w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const place = (el, p) => { v.copy(p).project(cam); el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, 0)`; };
    for (const x of this.tiles) place(x.userData.tag, x.position.clone().add(new THREE.Vector3(0, x.position.y + 1, TILE * 0.62)).setY(2)); // under the block
    if (this.denTag) place(this.denTag, this.denver.clone().setY(4.5));
  }
}
