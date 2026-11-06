// The resort seen from the air, in the start map's style: the snow lit from the north-west and cool in the
// shade, dark woods with the runs cut through them, grey rock on the steeps (assets/aerial/<id>.jpg, baked by
// tools/bake_tiles.py --aerial), fading into the paper at its edges. Runs are thin ink ribbons, lifts thin
// dark cables on small towers, the base lodges the kit's model.
// Used two ways: on the resort page it lives in the page's own scene (the whole mountain, and a base flown
// down to); at the top of a lift in the ride it is a scene of its own around the top (build()).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";

export const PAPER = 0xf6f1e7; // the app's paper (--paper in src/styles/paper.css)
// The painted map's ink (src/ride/paintedmap.js), a little deeper and calmer than a resort map's colours.
export const INK = { easy: 0x2e8b4f, intermediate: 0x2a5db0, advanced: 0x1c1f25, expert: 0x1c1f25 };
const RUN = { px: 2.2, op: 0.8 }; // a run's width on screen (CSS px; kept between min and max metres) and its ink
const TOWER = 14; // m: towers, and the cable on them
const CABLE = 0x363a41, STEEL = 0x4a4f57, STATION = 0xa9adb2, ROOF = 0x5b6068, GLOW = 0xe0a640;
const LODGE = 1.6; // the base lodge a little larger than life, so it reads from the air
const ELEVATION = 63; // degrees: the steep look down on a base or a lift's top
const FADE = [350, 900]; // m: the shortest and the longest fade into the paper

// The baked picture and where it lies, loaded once per resort. root: the page's way to the site's root.
const shots = new Map();
export function aerialTexture(id, root = "") {
  if (!shots.has(id)) shots.set(id, Promise.all([
    fetch(`${root}data/aerial.json?v=1`).then((r) => r.json()),
    new THREE.TextureLoader().loadAsync(`${root}assets/aerial/${id}.jpg?v=1`),
  ]).then(([all, tex]) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.userData.keep = true; // shared: never disposed with a view
    return { tex, bounds: all[id].bounds };
  }));
  return shots.get(id);
}
let lodgeModel = null;
function lodge(root) {
  lodgeModel ||= new Promise((ok, no) => new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/"))
    .load(`${root}models/facilities/glb/base_lodge.glb?v=9`, (g) => {
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.userData.keep = true;
        for (const m of [o.material].flat()) {
          m.userData.keep = true;
          m.normalMap?.dispose(); m.normalMap = null; // no relief to see from up here
          // A few dozen pixels on screen: its 2048 px picture is kept at 256 (16 MB less on a phone).
          if (m.map?.image?.width > 256) {
            const c = document.createElement("canvas"); c.width = c.height = 256;
            c.getContext("2d").drawImage(m.map.image, 0, 0, 256, 256);
            const t = m.map.clone(); t.source = new THREE.Source(c); t.needsUpdate = true;
            m.map.dispose(); m.map = t;
          }
        }
      });
      ok(g.scene);
    }, undefined, no));
  return lodgeModel;
}

const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

export class Aerial {
  // scene, camera: the page's own (the resort page), else the view makes its own (the ride's top).
  constructor(renderer, { scene, camera, exag = 1.3, root = "" } = {}) {
    this.renderer = renderer;
    this.own = !scene;
    this.scene = scene || new THREE.Scene();
    if (this.own) {
      this.scene.background = new THREE.Color(PAPER);
      const sun = new THREE.DirectionalLight(0xfff4e6, 1.8);
      sun.position.set(-550, 620, -550); // from the north-west, as the picture is lit
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d0c2, 1.6), sun);
    }
    this.camera = camera || new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 10, 60000);
    this.exag = exag;
    this.rootPath = root;
    this.root = null;
    this.lines = [];
    this.anims = [];
    this.anchors = new Map();
    this.liftParts = new Map();
    // Shared by every run: how wide on screen (set each frame from the camera).
    this.inkU = { uK: { value: 0.002 }, uMin: { value: 3 }, uMax: { value: 30 } };
    this.groundU = { uMap: { value: null }, uHas: { value: 0 }, uBounds: { value: new THREE.Vector4(0, 0, 1, 1) }, uFade: { value: new THREE.Vector4() }, uFadeW: { value: new THREE.Vector4() },
      uPaper: { value: new THREE.Color(PAPER) }, uTint: { value: new THREE.Color(1, 1, 1) } };
    this.focus = new THREE.Vector3();
    this.focusTo = new THREE.Vector3();
    this.size = this.sizeTo = this.whole = 1000;
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    for (const m of this.lines) m.resolution.set(innerWidth, innerHeight);
  }

  // The layers: the textured ground, the runs, the lifts and the lodges. area: [x0, x1, z0, z1] to cut the
  // ground and the runs to (the ride's top), else the whole resort. keep: [x0, x1, z0, z1], what should show
  // whole. The picture fades into the paper by the ground's edge on every side: over the room left outside
  // `keep` (at least FADE[0], so no edge is ever hard, at most FADE[1]).
  layers({ T, R, id, lifts, lodges = [], area = null, keep, maxW = 30 }) {
    this.dispose();
    this.T = T; this.R = R;
    const [x0, x1, z0, z1] = area || [T.x0, T.x1, T.z0, T.z1];
    let lo = 0;
    if (area) { lo = Infinity; for (let x = x0; x <= x1; x += T.cell * 2) for (let z = z0; z <= z1; z += T.cell * 2) lo = Math.min(lo, T.heightAt(x, z)); }
    this.lo = lo;
    this.Y = (x, z) => (T.heightAt(x, z) - lo) * this.exag;
    const root = (this.root = new THREE.Group());
    this.scene.add(root);
    const g = this.groundU;
    const w = [keep[0] - x0, x1 - keep[1], keep[2] - z0, z1 - keep[3]].map((m) => Math.min(FADE[1], Math.max(FADE[0], m)));
    g.uFade.value.set(x0 + w[0], z0 + w[2], x1 - w[1], z1 - w[3]); // whole inside this, faded to paper at the edge
    g.uFadeW.value.set(...w);
    aerialTexture(id, this.rootPath).then(({ tex, bounds }) => {
      g.uMap.value = tex; g.uHas.value = 1;
      g.uBounds.value.set(...bounds);
    }).catch(() => {}); // no picture: plain snow
    root.add(this.ground(x0, x1, z0, z1, area ? T.cell : 0));
    const inside = area ? ([x, z]) => x > x0 && x < x1 && z > z0 && z < z1 : () => true;
    this.inkU.uMax.value = maxW;
    this.runLayer = this.runs(R.runs, inside, maxW);
    this.liftLayer = new THREE.Group();
    for (const l of lifts) this.liftLayer.add(this.lift(l));
    root.add(this.runLayer, this.liftLayer);
    lodge(this.rootPath).then((m) => {
      if (this.root !== root) return; // rebuilt meanwhile
      for (const b of lodges) {
        // Beside the base, not on its lifts: a little away from the nearest lift bottom.
        const near = lifts.map((l) => l.pts[0]).sort((a, c) => Math.hypot(a[0] - b.x, a[1] - b.z) - Math.hypot(c[0] - b.x, c[1] - b.z))[0];
        let dx = b.x - (near ? near[0] : b.x - 1), dz = b.z - (near ? near[1] : b.z);
        const k = Math.hypot(dx, dz) || 1; dx /= k; dz /= k;
        const x = b.x + dx * 50, z = b.z + dz * 50, o = m.clone();
        o.scale.setScalar(LODGE);
        o.position.set(x, this.Y(x, z) - 1, z);
        o.rotation.y = Math.atan2(dx, dz);
        root.add(o);
      }
    }).catch(() => {}); // no lodge model: the base pins still say where
    return this;
  }

  // The ground, cut from the terrain's own grid (step 0) or sampled every `step` metres.
  ground(x0, x1, z0, z1, step) {
    const T = this.T;
    const nx = step ? Math.round((x1 - x0) / step) + 1 : T.gw, nz = step ? Math.round((z1 - z0) / step) + 1 : T.gh;
    const pos = new Float32Array(nx * nz * 3);
    for (let i = 0; i < nz; i++) for (let j = 0; j < nx; j++) {
      const x = x0 + ((x1 - x0) * j) / (nx - 1), z = z0 + ((z1 - z0) * i) / (nz - 1);
      pos.set([x, this.Y(x, z), z], (i * nx + j) * 3);
    }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let p = 0;
    for (let i = 0; i < nz - 1; i++) for (let j = 0; j < nx - 1; j++) { const a = i * nx + j; idx.set([a, a + nx, a + 1, a + 1, a + nx, a + nx + 1], p); p += 6; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    // The picture already holds its light: drawn as it is, then faded into the paper.
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.groundU);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vXZ;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvXZ = (modelMatrix * vec4(position, 1.0)).xz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vXZ; uniform sampler2D uMap; uniform float uHas; uniform vec4 uBounds, uFade, uFadeW; uniform vec3 uPaper, uTint;")
        .replace("#include <color_fragment>", `#include <color_fragment>
          vec2 uv = vec2((vXZ.x - uBounds.x) / (uBounds.z - uBounds.x), 1.0 - (vXZ.y - uBounds.y) / (uBounds.w - uBounds.y));
          vec3 c = mix(vec3(0.92, 0.93, 0.95), texture2D(uMap, uv).rgb, uHas) * uTint;
          vec2 q = max(max((uFade.xy - vXZ) / uFadeW.xz, (vXZ - uFade.zw) / uFadeW.yw), 0.0);
          diffuseColor.rgb = mix(c, uPaper, smoothstep(0.0, 1.0, length(q)));`);
    };
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = -1;
    return m;
  }

  // Runs as ink ribbons draped on the snow. Each is as wide on screen as RUN.px wherever the camera is (the
  // vertex shader widens it with distance); `edge` holds the slope across it, so a wide one still lies on
  // the snow. `along` runs 0 at the top to 1 at the bottom, for lighting a run up as it is skied.
  runs(list, inside, maxW) {
    const group = new THREE.Group(), T = this.T, step = T.cell * 0.6;
    for (const run of list) {
      let pts = (run.outline || run.pts).filter(inside);
      if (pts.length < 2) continue;
      const dense = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
        for (let k = 1; k <= n; k++) dense.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
      }
      pts = dense;
      const d = [0];
      for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const hs = pts.map(([x, z]) => this.Y(x, z)), hmax = Math.max(...hs), hmin = Math.min(...hs), downhill = hs[0] >= hs[hs.length - 1];
      const at = (i) => (run.area ? (hmax - hs[i]) / (hmax - hmin || 1) : downhill ? d[i] / d[d.length - 1] : 1 - d[i] / d[d.length - 1]);
      const pos = [], side = [], edge = [], along = [], idx = [];
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i], [ax, az] = pts[Math.max(0, i - 1)], [bx, bz] = pts[Math.min(pts.length - 1, i + 1)];
        let dx = bx - ax, dz = bz - az;
        const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
        for (const s of [-1, 1]) {
          pos.push(x, hs[i] + 1.5, z);
          side.push(-dz * s, dx * s);
          edge.push(this.Y(x - dz * s * maxW / 2, z + dx * s * maxW / 2) - hs[i]);
          along.push(at(i));
        }
        if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("side", new THREE.Float32BufferAttribute(side, 2));
      geo.setAttribute("edge", new THREE.Float32BufferAttribute(edge, 1));
      geo.setAttribute("along", new THREE.Float32BufferAttribute(along, 1));
      geo.setIndex(idx);
      const mat = new THREE.MeshBasicMaterial({ color: INK[run.level] ?? INK.intermediate, transparent: true, opacity: RUN.op, depthWrite: false, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      // Above uReveal the run shows at uTo, below it still at uFrom; a pale band marks the front.
      const u = { uReveal: { value: 1 }, uFrom: { value: 1 }, uTo: { value: 1 }, uFront: { value: 0 }, uThin: { value: run.area ? 0.6 : 1 } };
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, u, this.inkU);
        sh.vertexShader = "attribute vec2 side;\nattribute float edge, along;\nuniform float uK, uMin, uMax, uThin;\nvarying float vAlong;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
          vAlong = along;
          float w = clamp(distance((modelMatrix * vec4(position, 1.0)).xyz, cameraPosition) * uK, uMin, uMax) * uThin;
          transformed.xz += side * w * 0.5;
          transformed.y += edge * w / uMax;`);
        sh.fragmentShader = "varying float vAlong;\nuniform float uReveal, uFrom, uTo, uFront;\n" + sh.fragmentShader.replace("#include <dithering_fragment>", `#include <dithering_fragment>
          gl_FragColor.a *= mix(uFrom, uTo, step(vAlong, uReveal));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), 0.5 * uFront * smoothstep(0.07, 0.0, abs(vAlong - uReveal)));`);
      };
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false; // it widens in the shader
      mesh.userData.run = run;
      mesh.userData.u = u;
      group.add(mesh);
    }
    return group;
  }

  // A lift: a thin dark cable on small towers, a small grey station at each end. Its glow (a soft amber line
  // under the cable) shows when it is the chosen one.
  lift(l) {
    const group = new THREE.Group();
    const pts = l.pts.map(([x, z]) => new THREE.Vector3(x, this.Y(x, z), z));
    const dense = [];
    for (let i = 1; i < pts.length; i++) {
      const n = Math.max(1, Math.round(pts[i].distanceTo(pts[i - 1]) / 120));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) dense.push(pts[i - 1].clone().lerp(pts[i], k / n));
    }
    const rope = dense.map((p) => p.clone().add(new THREE.Vector3(0, TOWER, 0)));
    const mid = dense[Math.round(dense.length * 0.6)] || pts[pts.length - 1];
    this.anchors.set(l, mid.clone().add(new THREE.Vector3(0, TOWER + 30, 0)));
    const line = (width, color, opacity, order) => {
      const geo = new LineGeometry().setPositions(rope.flatMap((p) => [p.x, p.y, p.z]));
      const mat = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthWrite: false, toneMapped: false });
      mat.resolution.set(innerWidth, innerHeight);
      this.lines.push(mat);
      const o = new Line2(geo, mat);
      o.renderOrder = order;
      return o;
    };
    const glow = line(5, GLOW, 0.45, 1);
    glow.visible = false;
    const cable = line(1.2, CABLE, 0.9, 2);
    const towers = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 1.3, TOWER, 5).translate(0, TOWER / 2, 0), new THREE.MeshLambertMaterial({ color: STEEL }), Math.max(1, dense.length - 2));
    const m = new THREE.Matrix4();
    for (let i = 1; i < dense.length - 1; i++) towers.setMatrixAt(i - 1, m.makeTranslation(dense[i].x, dense[i].y - 1, dense[i].z));
    towers.count = Math.max(0, dense.length - 2);
    group.add(glow, cable, towers);
    // The stations: a low grey hall with a darker roof, along the line.
    const hall = new THREE.BoxGeometry(14, 6, 22).translate(0, 3, 0), roof = new THREE.BoxGeometry(16, 2, 25).translate(0, 7, 0);
    const wall = new THREE.MeshLambertMaterial({ color: STATION }), top = new THREE.MeshLambertMaterial({ color: ROOF });
    for (const [p, q] of [[pts[0], pts[1]], [pts[pts.length - 1], pts[pts.length - 2]]]) {
      const st = new THREE.Group();
      st.add(new THREE.Mesh(hall, wall), new THREE.Mesh(roof, top));
      st.position.copy(p).y -= 1;
      st.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
      group.add(st);
    }
    this.liftParts.set(l, { group, glow });
    return group;
  }

  // The chosen lift glows; the others fade back. Null shows every lift as it is.
  focusLift(l) {
    for (const [x, { group, glow }] of this.liftParts) {
      glow.visible = x === l;
      group.traverse((o) => {
        if (!o.material || o === glow) return;
        o.material.transparent = true;
        o.material.opacity = (o.material.isLineMaterial ? 0.9 : 1) * (l && x !== l ? 0.3 : 1);
      });
    }
    this.chosen = l;
  }

  // Where the picture is framed: a base and the tops of its lifts, or `points` ([x, z] pairs: a lift's top
  // and where you can go from it). Sets the box, the focus and how much to fit.
  frame({ base, lifts = [], points, maxHalf = 1700 }) {
    const T = this.T;
    const xs = points ? points.map((p) => p[0]) : [base.x, ...lifts.map((l) => l.pts[l.pts.length - 1][0])];
    const zs = points ? points.map((p) => p[1]) : [base.z, ...lifts.map((l) => l.pts[l.pts.length - 1][1])];
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const half = Math.min(maxHalf, Math.max(900, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2 + (points ? 250 : 450)));
    const x0 = Math.max(T.x0, cx - half), x1 = Math.min(T.x1, cx + half), z0 = Math.max(T.z0, cz - half), z1 = Math.min(T.z1, cz + half);
    this.box = { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
    const ys = xs.map((x, i) => this.Y(x, zs[i]));
    this.boxY = ys.reduce((a, y) => a + y, 0) / ys.length;
    this.focus.set(this.box.cx, this.boxY, this.box.cz);
    this.focusTo.copy(this.focus);
    this.whole = (Math.hypot(x1 - x0, z1 - z0) / 2 + 150) * 0.8; // the frame's corners may crop a little
    this.size = this.sizeTo = this.whole;
    return this.box;
  }

  // The ride's top: a view of its own over the area around `points`, fading out past it.
  build({ T, R, id, graph, lifts, points, lodges = [], maxHalf = 2200, maxW = 40 }) {
    this.T = T;
    this.Y = (x, z) => T.heightAt(x, z) * this.exag; // for frame() before the layers exist
    const b = this.frame({ points, maxHalf }), M = 700;
    const area = [Math.max(T.x0, b.x0 - M), Math.min(T.x1, b.x1 + M), Math.max(T.z0, b.z0 - M), Math.min(T.z1, b.z1 + M)];
    this.layers({ T, R, id, lifts, lodges, area, keep: [b.x0, b.x1, b.z0, b.z1], maxW });
    this.frame({ points, maxHalf }); // again, on the layers' heights
    this.graph = graph;
    return this;
  }

  // Free the view's geometry and materials (all: the shared picture and lodge too, when the page is done
  // with views from the air: the ride, once you leave the top).
  dispose(all = false) {
    if (all) {
      this.groundU.uMap.value?.dispose(); this.groundU.uMap.value = null; this.groundU.uHas.value = 0;
      shots.clear();
      lodgeModel?.then((m) => m.traverse((o) => { o.geometry?.dispose(); for (const x of [o.material].flat()) { x?.map?.dispose(); x?.dispose(); } })).catch(() => {});
      lodgeModel = null;
    }
    if (!this.root) return;
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry && (all || !o.geometry.userData.keep)) o.geometry.dispose();
      for (const m of [o.material].flat()) if (m && (all || !m.userData.keep)) m.dispose();
    });
    this.root = null;
    this.lines = [];
    this.anims = [];
    this.anchors.clear();
    this.liftParts.clear();
  }

  // Light up the runs you can reach from a lift's top without taking another lift; hide the rest.
  // Two tiers: runs leaving the top, runs you can carry on to; runs out of reach are hidden. The light flows
  // downhill: runs leaving the top first, then the ones they lead to.
  highlightFrom(lift) {
    const depth = new Map();
    if (lift && this.graph) {
      const start = this.graph.liftNodes.get(lift).top.id, seen = new Set([start]), queue = [[start, 0]];
      while (queue.length) {
        const [u, d] = queue.shift();
        for (const e of this.graph.edges[u]) {
          if (e.leg.type === "lift") continue;
          let nd = d;
          if (e.leg.type === "run") { if (!depth.has(e.leg.run)) depth.set(e.leg.run, d); nd = d + 1; }
          if (!seen.has(e.to)) { seen.add(e.to); queue.push([e.to, nd]); }
        }
      }
    }
    const top = lift && lift.pts[lift.pts.length - 1];
    const fromTop = new Set(lift ? this.R.runs.filter((r) => Math.hypot(r.pts[0][0] - top[0], r.pts[0][1] - top[1]) < 160) : []);
    for (const r of fromTop) depth.set(r, 0);
    this.light3(lift ? (run) => (fromTop.has(run) ? 1 : depth.has(run) ? 0.5 : 0) : () => 1, (run) => Math.min(depth.get(run) ?? 0, 6) * 0.3);
    return { reach: new Set(depth.keys()), fromTop };
  }

  // Light only the runs of a route, one after another in the order they are skied.
  highlightRoute(runs) {
    const order = new Map();
    runs.forEach((r, i) => order.has(r) || order.set(r, i));
    this.light3((run) => (order.has(run) ? 1 : 0), (run) => (order.get(run) ?? 0) * 0.45);
  }

  light3(tier, delay) {
    const now = performance.now() / 1000;
    this.anims = [];
    for (const m of this.runLayer.children) {
      const u = m.userData.u, to = tier(m.userData.run);
      m.visible = to > 0; // runs this lift cannot reach are not drawn at all
      if (to > 0) {
        u.uFrom.value = 0; u.uTo.value = to; u.uReveal.value = 0; u.uFront.value = 1;
        this.anims.push({ u, t0: now + delay(m.userData.run), dur: 0.9 });
      } else {
        u.uFrom.value = u.uTo.value = to; u.uReveal.value = 1; u.uFront.value = 0;
      }
    }
  }

  // Every run as it is, at once (the whole mountain again).
  showAll() {
    this.anims = [];
    for (const m of this.runLayer.children) { const u = m.userData.u; m.visible = true; u.uFrom.value = u.uTo.value = u.uReveal.value = 1; u.uFront.value = 0; }
  }

  // The camera around the focus; u in [0, 1) is the place on the circle, elevation how steeply it looks down.
  // visible: the fraction of the screen height between the panels; the frame is fitted into that part and
  // centred in it. A flight under way (flyFrom) eases from where it began.
  orbit(u, visible = 1, topPad = 0, raise = 0, elevation = ELEVATION) {
    const vfov = (this.camera.fov * Math.PI) / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const room = 2 * Math.atan(Math.tan(vfov / 2) * visible); // vertical angle of the visible part
    const centreFromTop = topPad + visible / 2 - raise;
    return this.glide({
      f: this.focus.clone(), d: this.size / Math.sin(Math.min(room, hfov) / 2),
      a: -Math.PI / 4 + u * Math.PI * 2, el: (elevation * Math.PI) / 180,
      // Tilt down so the focus sits in the middle of the visible part, not of the whole screen.
      shift: Math.atan((0.5 - centreFromTop) * 2 * Math.tan(vfov / 2)),
    });
  }

  // A camera place as an orbit: what it looks at, how far, which way round, how steep, the tilt.
  poseOf(pos, target) {
    const v = pos.clone().sub(target), d = v.length();
    return { f: target.clone(), d, a: Math.atan2(v.z, v.x), el: Math.asin(v.y / d), shift: 0 };
  }

  place(p) {
    const c = this.camera, h = p.d * Math.cos(p.el);
    c.position.set(p.f.x + Math.cos(p.a) * h, p.f.y + p.d * Math.sin(p.el), p.f.z + Math.sin(p.a) * h);
    c.up.set(0, 1, 0);
    c.lookAt(p.f);
    c.rotateX(-p.shift);
    c.updateMatrixWorld();
    this.last = p;
  }

  // Fly from a camera place to wherever the view wants to be, over `secs`.
  flyFrom(from, secs = 1.8) { this.flight = { from, t0: performance.now(), dur: secs * 1000 }; }
  // Put the camera where it is wanted, or on the way there; true while still flying.
  glide(want) {
    let p = want;
    if (this.flight) {
      const k = Math.min(1, (performance.now() - this.flight.t0) / this.flight.dur), e = ease(k), a = this.flight.from;
      const turn = want.a + Math.round((a.a - want.a) / (Math.PI * 2)) * Math.PI * 2; // the short way round
      p = { f: a.f.clone().lerp(want.f, e), d: a.d * Math.pow(want.d / a.d, e), a: a.a + (turn - a.a) * e, el: a.el + (want.el - a.el) * e, shift: a.shift + (want.shift - a.shift) * e };
      if (k >= 1) this.flight = null;
    }
    this.place(p);
    return !!this.flight;
  }

  // Where a lift's tag goes on screen, in CSS pixels; null when behind the camera.
  screenOf(l, v = new THREE.Vector3()) {
    const p = this.anchors.get(l);
    if (!p) return null;
    v.copy(p).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
  }

  // Frame a lift and the runs it leads to: centre on them and zoom so they fill the frame (small lifts come
  // closer, up to twice the size of the whole frame). Null frames the whole of it.
  aim(l, runs = []) {
    if (!l) { this.focusTo.set(this.box.cx, this.boxY, this.box.cz); this.sizeTo = this.whole; return; }
    const { x0, x1, z0, z1 } = this.box;
    const pts = [...l.pts, ...runs.flatMap((r) => r.pts)].filter(([x, z]) => x > x0 && x < x1 && z > z0 && z < z1);
    if (!pts.length) return;
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]), ys = pts.map(([x, z]) => this.Y(x, z));
    const c = new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2);
    let r = 0;
    for (let i = 0; i < pts.length; i++) r = Math.max(r, Math.hypot(xs[i] - c.x, ys[i] - c.y, zs[i] - c.z));
    this.focusTo.copy(c);
    this.sizeTo = Math.min(this.whole, Math.max(this.whole * 0.5, r * 1.08));
  }

  // The orbit place that looks up a lift from below, facing the slope its runs come down.
  facing(l) {
    const b = l.pts[0], t = l.pts[l.pts.length - 1];
    const a = Math.atan2(b[1] - t[1], b[0] - t[0]) + 0.2;
    return (((a + Math.PI / 4) / (Math.PI * 2)) % 1 + 1) % 1;
  }

  // Each frame: the runs' width for this camera, the chosen lift's slow pulse, runs lighting up.
  tick() {
    this.inkU.uK.value = (RUN.px * 2 * Math.tan((this.camera.fov * Math.PI) / 360)) / innerHeight;
    const now = performance.now() / 1000;
    const g = this.chosen && this.liftParts.get(this.chosen);
    if (g) g.glow.material.opacity = 0.35 + 0.15 * Math.sin(now * 3.2);
    for (const a of this.anims) {
      const k = Math.min(1, Math.max(0, (now - a.t0) / a.dur));
      a.u.uReveal.value = 1 - (1 - k) * (1 - k);
      if (k >= 1) a.u.uFront.value = 0;
    }
  }

  render() {
    this.tick();
    this.renderer.render(this.scene, this.camera);
  }
}
