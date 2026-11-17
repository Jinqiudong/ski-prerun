// The resort page's mountain: the resort's terrain as one solid cut block, lit like a relief print (the owner's
// mock, 2026-11-17, from the Blender study relief.py). Snow on top, rock on the steep faces, the forest a muted
// green tint from the OSM tree mask, so the runs read as white cuts through it; a low warm sun from the side
// with real shadows on the terrain; sides cut straight down to a flat bottom in a soft vertical gradient.
// The lifts are thin dark lines; the chosen base's lifts glow gold (a core and a soft halo line), with a gold
// ring at the base. No textures but the small tree mask, no 3D trees, no run lines.
import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";

export const EX = 1.6; // height exaggeration
const LIFT_UP = 18; // metres: the lift lines ride this far over the snow
const SKIRT = 260; // metres under the lowest ground the block is cut
const MARGIN = 450; // metres round the lifts and bases

// Day: paper cream. Dusk and night: lavender. Colours as written (sRGB); three.js keeps them linear.
export const LOOKS = {
  day: { snow: "#fbfaf7", rock: "#b9ada0", forest: "#a9b8a8", sideTop: "#efe6d6", sideBot: "#c8b08c", bg: "#f6f2ea",
    sun: "#fff4e2", sunI: 3.8, sky: "#e8ecf5", ground: "#cdbfa8", amb: 0.72, wall: 0.42, lift: "#3b4152", halo: 0.32, add: false },
  dusk: { snow: "#f3f4fa", rock: "#7e7f8e", forest: "#6f8590", sideTop: "#cfd3e6", sideBot: "#6f7896", bg: "#b9bfdc",
    sun: "#ffe7cc", sunI: 2.7, sky: "#c3c8e8", ground: "#6f7896", amb: 0.95, wall: 0.36, lift: "#3b4152", halo: 0.4, add: true },
};
const GOLD = "#ff9a12", GOLD_CORE = "#ffc547";

// Which ground the block holds: the lifts (not the carpets) and the bases, with a margin, inside the data.
function cropOf(T, R) {
  const pts = [...R.lifts.filter((l) => l.kind !== "magic_carpet").flatMap((l) => l.pts), ...R.places.filter((p) => p.kind === "village").map((p) => [p.x, p.z])];
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  return {
    x0: Math.max(T.x0, Math.min(...xs) - MARGIN), x1: Math.min(T.x1, Math.max(...xs) + MARGIN),
    z0: Math.max(T.z0, Math.min(...zs) - MARGIN), z1: Math.min(T.z1, Math.max(...zs) + MARGIN),
  };
}

// The tree mask (data trees.bits, 1 bit a cell) over the block, softly blurred, as a one-channel texture.
function forestTexture(R, crop) {
  const tr = R.trees; if (!tr?.bits) return null;
  const [mw, mh] = tr.grid, [bx0, bz0, bx1, bz1] = R.bounds;
  const raw = Uint8Array.from(atob(tr.bits), (c) => c.charCodeAt(0));
  const ci = (x) => ((x - bx0) / (bx1 - bx0)) * (mw - 1), ri = (z) => ((z - bz0) / (bz1 - bz0)) * (mh - 1);
  const c0 = Math.max(0, Math.floor(ci(crop.x0))), c1 = Math.min(mw - 1, Math.ceil(ci(crop.x1)));
  const r0 = Math.max(0, Math.floor(ri(crop.z0))), r1 = Math.min(mh - 1, Math.ceil(ri(crop.z1)));
  const step = Math.max(1, Math.ceil(Math.max(c1 - c0 + 1, r1 - r0 + 1) / 1024)); // never past 1024 px a side
  const w = Math.floor((c1 - c0) / step) + 1, h = Math.floor((r1 - r0) / step) + 1;
  let a = new Float32Array(w * h);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const k = (r0 + r * step) * mw + c0 + c * step;
    a[r * w + c] = raw[k >> 3] & (0x80 >> (k & 7)) ? 1 : 0;
  }
  // soft: three box passes each way (about a Gaussian of 1.4 cells)
  const b = new Float32Array(w * h);
  for (let pass = 0; pass < 3; pass++) {
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) { const i = r * w + c; b[i] = (a[i] + a[r * w + Math.max(0, c - 1)] + a[r * w + Math.min(w - 1, c + 1)]) / 3; }
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) { const i = r * w + c; a[i] = (b[i] + b[Math.max(0, r - 1) * w + c] + b[Math.min(h - 1, r + 1) * w + c]) / 3; }
  }
  const px = new Uint8Array(w * h);
  for (let i = 0; i < px.length; i++) px[i] = Math.round(a[i] * 255);
  a = null;
  const tex = new THREE.DataTexture(px, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  Object.assign(tex, { magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, unpackAlignment: 1, generateMipmaps: false, needsUpdate: true });
  // ground (x, z) → texture uv, through the mask's own cell centres
  tex.uvOf = (x, z) => [((ci(x) - c0) / step + 0.5) / w, ((ri(z) - r0) / step + 0.5) / h];
  return tex;
}

export class Relief {
  // opts: { scene, T, R, phone, shadow (map size) }
  constructor({ scene, T, R, phone = false, shadow = 1024, resolution }) {
    Object.assign(this, { scene, T, R });
    this.group = new THREE.Group();
    scene.add(this.group);
    this.res = resolution || new THREE.Vector2(innerWidth, innerHeight);
    const crop = (this.crop = cropOf(T, R));
    const { gw, h } = T, cx = (T.x1 - T.x0) / (T.gw - 1), cz = (T.z1 - T.z0) / (T.gh - 1);
    const c0 = Math.ceil((crop.x0 - T.x0) / cx), c1 = Math.floor((crop.x1 - T.x0) / cx);
    const r0 = Math.ceil((crop.z0 - T.z0) / cz), r1 = Math.floor((crop.z1 - T.z0) / cz);
    const step = Math.max(1, Math.ceil(Math.max(c1 - c0, r1 - r0) / (phone ? 300 : 380)));
    const cols = [], rows = [];
    for (let c = c0; c <= c1; c += step) cols.push(c);
    for (let r = r0; r <= r1; r += step) rows.push(r);
    const nc = cols.length, nr = rows.length;
    const mask = (this.mask = forestTexture(R, crop));
    const pos = new Float32Array(nc * nr * 3), uv = new Float32Array(nc * nr * 2);
    let lo = Infinity;
    for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
      const k = i * nc + j, x = T.x0 + cols[j] * cx, z = T.z0 + rows[i] * cz, y = h[rows[i] * gw + cols[j]];
      lo = Math.min(lo, y);
      pos.set([x, y * EX, z], k * 3);
      uv.set(mask ? mask.uvOf(x, z) : [0, 0], k * 2);
    }
    const idx = new Uint32Array((nc - 1) * (nr - 1) * 6);
    let n = 0;
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < nc - 1; j++) { const a = i * nc + j; idx.set([a, a + nc, a + 1, a + 1, a + nc, a + nc + 1], n); n += 6; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aM", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    this.hb = lo - SKIRT;

    // The top: snow, rock by slope, the forest's tint.
    const U = (this.U = { uSnow: { value: new THREE.Color() }, uRock: { value: new THREE.Color() }, uForest: { value: new THREE.Color() }, uMask: { value: mask },
      uTop: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uWall: { value: 0.4 } });
    const top = new THREE.MeshLambertMaterial();
    top.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, { uSnow: U.uSnow, uRock: U.uRock, uForest: U.uForest, uMask: U.uMask });
      s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nattribute vec2 aM; varying vec2 vM; varying float vNy;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvM = aM; vNy = normal.y;");
      s.fragmentShader = s.fragmentShader.replace("#include <common>", `#include <common>\nuniform vec3 uSnow, uRock, uForest; uniform sampler2D uMask; varying vec2 vM; varying float vNy;`)
        .replace("vec4 diffuseColor = vec4( diffuse, opacity );", `vec3 cc = mix(uRock, uSnow, smoothstep(0.6, 0.8, vNy));
          ${mask ? "cc = mix(cc, uForest, texture2D(uMask, vM).r);" : ""}
          vec4 diffuseColor = vec4(cc, opacity);`);
    };
    this.ground = new THREE.Mesh(geo, top);
    this.ground.castShadow = this.ground.receiveShadow = true;
    this.group.add(this.ground);

    // The sides: straight down from the edge to the flat bottom; light at the top, darker toward the bottom.
    const wpos = [], wnor = [], wt = [], widx = [];
    // light at the edge of the snow, darker down to the bottom, whatever the wall's height there
    const side = (ks, nx, nz) => {
      const b = wpos.length / 3;
      for (const k of ks) {
        const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
        wpos.push(x, y, z, x, this.hb * EX, z); wnor.push(nx, 0, nz, nx, 0, nz); wt.push(1, 0);
      }
      for (let q = 0; q < ks.length - 1; q++) { const a = b + q * 2, c = a + 2; widx.push(a, c, a + 1, a + 1, c, c + 1); }
    };
    const range = (m, f) => Array.from({ length: m }, (_, i) => f(i));
    side(range(nc, (j) => j), 0, -1); // the z0 edge
    side(range(nc, (j) => (nr - 1) * nc + (nc - 1 - j)), 0, 1); // the z1 edge
    side(range(nr, (i) => (nr - 1 - i) * nc), -1, 0); // the x0 edge
    side(range(nr, (i) => i * nc + nc - 1), 1, 0); // the x1 edge
    const wg = new THREE.BufferGeometry();
    wg.setAttribute("position", new THREE.Float32BufferAttribute(wpos, 3));
    wg.setAttribute("normal", new THREE.Float32BufferAttribute(wnor, 3));
    wg.setAttribute("aT", new THREE.Float32BufferAttribute(wt, 1));
    wg.setIndex(widx);
    const wm = new THREE.MeshLambertMaterial(); // each side's triangles wind to face outward
    wm.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, { uTop: U.uTop, uBot: U.uBot, uWall: U.uWall });
      s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nattribute float aT; varying float vT;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvT = aT;");
      s.fragmentShader = s.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uTop, uBot; uniform float uWall; varying float vT;")
        .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4(mix(uBot, uTop, vT), opacity);")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uWall;");
    };
    this.walls = new THREE.Mesh(wg, wm);
    this.walls.receiveShadow = true;
    this.group.add(this.walls);

    // Where the block is, for the camera and the light.
    this.center = new THREE.Vector3((crop.x0 + crop.x1) / 2, 0, (crop.z0 + crop.z1) / 2);
    this.center.y = ((lo + (this.T.heightAt(this.center.x, this.center.z))) / 2) * EX;
    this.span = Math.hypot(crop.x1 - crop.x0, crop.z1 - crop.z0);
    // points to frame: the top every few vertices, and the bottom's corners
    this.frame = [];
    const sk = Math.max(1, Math.round(Math.sqrt((nc * nr) / 700)));
    for (let i = 0; i < nr; i += sk) for (let j = 0; j < nc; j += sk) { const k = i * nc + j; this.frame.push(new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2])); }
    for (const [x, z] of [[crop.x0, crop.z0], [crop.x1, crop.z0], [crop.x0, crop.z1], [crop.x1, crop.z1]]) this.frame.push(new THREE.Vector3(x, this.hb * EX, z));

    // Light: a low warm sun with shadows, a weak sky.
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadow, shadow);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 8;
    this.sun.target.position.copy(this.center);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xcccccc, 1);
    scene.add(this.sun, this.sun.target, this.hemi);

    // The lifts: thin dark lines.
    this.lifts = new Map();
    this.lineMats = [];
    const dark = (this.darkMat = this.mat({ color: LOOKS.day.lift, linewidth: 1.3, transparent: true, opacity: 0.8 }));
    for (const l of R.lifts) {
      if (l.kind === "magic_carpet" || l.pts.length < 2) continue;
      const line = this.liftPath(l);
      const o = new Line2(this.lineGeo(line), dark);
      o.renderOrder = 2;
      this.group.add(o);
      this.lifts.set(l, { line, dark: o });
    }
    // The gold: built for the chosen base, dropped when it changes.
    this.goldCore = this.mat({ color: GOLD_CORE, linewidth: 3.2, depthTest: false, transparent: true });
    this.goldHalo = this.mat({ color: GOLD, linewidth: 12, depthTest: false, transparent: true, opacity: 0.32, depthWrite: false });
    this.gold = new THREE.Group();
    this.gold.renderOrder = 10;
    this.group.add(this.gold);
  }

  mat(o) { const m = new LineMaterial({ worldUnits: false, ...o, color: new THREE.Color(o.color) }); m.resolution.copy(this.res); this.lineMats.push(m); return m; }
  lineGeo(pts) { const g = new LineGeometry(); g.setPositions(pts.flatMap((p) => [p.x, p.y, p.z])); return g; }
  // ground height at (x, z), exaggerated
  Y(x, z) { return this.T.heightAt(x, z) * EX; }
  // A lift as a straight cable from its bottom to its top, kept above the ground in between.
  liftPath(l) {
    let a = l.pts[0], b = l.pts[l.pts.length - 1];
    const T = this.T;
    if (T.heightAt(...a) > T.heightAt(...b)) [a, b] = [b, a];
    const ya = T.heightAt(...a), yb = T.heightAt(...b), out = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24, x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u;
      out.push(new THREE.Vector3(x, (Math.max(ya + (yb - ya) * u, T.heightAt(x, z)) + LIFT_UP) * EX, z));
    }
    return out;
  }
  // The top station: the higher end, a little over the snow.
  topOf(l) { const p = this.lifts.get(l)?.line || this.liftPath(l); return p[p.length - 1].clone(); }

  // The chosen base and its lifts in gold, a gold ring at the base; null clears it.
  choose(base, lifts = []) {
    for (const o of [...this.gold.children]) { o.geometry.dispose(); this.gold.remove(o); }
    for (const [, v] of this.lifts) v.dark.visible = true;
    this.goldPts = [];
    if (!base) return;
    const add = (pts, halo = true) => {
      for (const [m, order] of halo ? [[this.goldHalo, 11], [this.goldCore, 12]] : [[this.goldCore, 12]]) { const o = new Line2(this.lineGeo(pts), m); o.renderOrder = order; this.gold.add(o); }
      this.goldPts.push(pts);
    };
    for (const l of lifts) { const v = this.lifts.get(l); if (!v) continue; v.dark.visible = false; add(v.line); }
    const r = 0.018 * this.span, ring = [];
    for (let i = 0; i <= 48; i++) { const t = (i / 48) * Math.PI * 2, x = base.x + Math.cos(t) * r, z = base.z + Math.sin(t) * r; ring.push(new THREE.Vector3(x, this.Y(x, z) + 6 * EX, z)); }
    add(ring, false);
  }

  // The look for day or dusk; sunDir: toward the sun.
  setLook(name, sunDir) {
    const L = LOOKS[name] || LOOKS.day, U = this.U;
    U.uSnow.value.set(L.snow); U.uRock.value.set(L.rock); U.uForest.value.set(L.forest);
    U.uTop.value.set(L.sideTop); U.uBot.value.set(L.sideBot); U.uWall.value = L.wall;
    this.sun.color.set(L.sun); this.sun.intensity = L.sunI;
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.amb;
    this.darkMat.color.set(L.lift);
    this.goldHalo.opacity = L.halo;
    this.goldHalo.blending = L.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.goldHalo.needsUpdate = true;
    if (sunDir) {
      const R = this.span * 0.62, c = this.center;
      this.sun.position.copy(c).addScaledVector(sunDir, R * 1.5);
      const cam = this.sun.shadow.camera;
      Object.assign(cam, { left: -R, right: R, top: R, bottom: -R, near: R * 0.3, far: R * 2.8 });
      cam.updateProjectionMatrix();
    }
    return L;
  }

  resize(w, h) { this.res.set(w, h); for (const m of this.lineMats) m.resolution.set(w, h); }

  dispose() {
    this.choose(null);
    this.group.traverse((o) => { o.geometry?.dispose?.(); });
    for (const m of [this.ground.material, this.walls.material, ...this.lineMats]) m.dispose();
    this.mask?.dispose();
    this.sun.shadow.map?.dispose();
    this.scene.remove(this.group, this.sun, this.sun.target, this.hemi);
  }
}
