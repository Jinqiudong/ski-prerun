// A miniature world: one base area of the resort cut out as a thick block on a white plinth, with toy-scale
// trees, lifts with moving chairs, a lodge and little skiers. Rendered in its own scene with soft studio
// light and a tilt-shift blur, so it reads as a model on a table.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { HorizontalTiltShiftShader } from "three/addons/shaders/HorizontalTiltShiftShader.js";
import { VerticalTiltShiftShader } from "three/addons/shaders/VerticalTiltShiftShader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const EXAG = 1.8; // a model maker's relief
const STEP = 10; // meters between terrain samples
const TOY = 2.6; // trees, lifts, buildings and people are drawn larger than life, as on a model
const RUN_COLOR = { easy: 0x22b35a, intermediate: 0x1f6fe5, advanced: 0x15171c, expert: 0x15171c };

let seed = 9;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export class Diorama {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe9edf2);
    this.camera = new THREE.PerspectiveCamera(24, innerWidth / innerHeight, 10, 40000);
    // Multisampled target: post-processing would otherwise drop antialiasing and look soft on phones.
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4, type: THREE.HalfFloatType }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.hTilt = new ShaderPass(HorizontalTiltShiftShader);
    this.vTilt = new ShaderPass(VerticalTiltShiftShader);
    this.composer.addPass(this.hTilt);
    this.composer.addPass(this.vTilt);
    this.composer.addPass(new OutputPass());
    this.resize();
    this.root = null;
    this.movers = [];
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(innerWidth, innerHeight);
    const amount = this.blur ?? 1.2; // a light tilt-shift: only the far top and bottom soften
    this.hTilt.uniforms.h.value = amount / innerWidth;
    this.vTilt.uniforms.v.value = amount / innerHeight;
    this.hTilt.uniforms.r.value = this.vTilt.uniforms.r.value = 0.5;
  }

  // Build the block for a base: the area covering the base and the tops of its lifts. Or, given
  // `points` ([x, z] pairs), the area covering them (a lift top and where you can go from it).
  build({ T, R, mask, graph, base, lifts, title, points, lodges = [], maxHalf = 1700, runWidth = 24, front = -Math.PI / 4 }) {
    if (this.root) { this.scene.remove(this.root); this.root.traverse((o) => { o.geometry?.dispose(); }); }
    this.movers = [];
    this.anims = [];
    this.anchors = new Map();
    this.liftParts = new Map();
    this.T = T;
    const xs = points ? points.map((p) => p[0]) : [base.x, ...lifts.map((l) => l.pts[l.pts.length - 1][0])];
    const zs = points ? points.map((p) => p[1]) : [base.z, ...lifts.map((l) => l.pts[l.pts.length - 1][1])];
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const half = Math.min(maxHalf, Math.max(900, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2 + (points ? 250 : 450)));
    const x0 = Math.max(T.x0, cx - half), x1 = Math.min(T.x1, cx + half), z0 = Math.max(T.z0, cz - half), z1 = Math.min(T.z1, cz + half);
    this.box = { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
    this.focus = new THREE.Vector3(this.box.cx, 60, this.box.cz);
    this.focusTo = this.focus.clone();
    this.whole = (Math.hypot(x1 - x0, z1 - z0) / 2 + 150) * 0.8; // the block's corners may crop a little
    this.size = this.sizeTo = this.whole;
    const root = new THREE.Group();
    this.root = root;
    this.scene.add(root);

    // Heights relative to the block's lowest corner, exaggerated; the ground sits on a thick earth layer.
    let lo = Infinity;
    for (let x = x0; x <= x1; x += STEP) for (let z = z0; z <= z1; z += STEP) lo = Math.min(lo, T.heightAt(x, z));
    this.lo = lo;
    const Y = (x, z) => (T.heightAt(x, z) - lo) * EXAG + 120; // 120 m of earth under the lowest snow
    this.Y = Y;

    root.add(this.ground(x0, x1, z0, z1, Y, mask));
    root.add(this.sides(x0, x1, z0, z1, Y));
    root.add(this.plinth(x0, x1, z0, z1, title, front));
    root.add(this.trees(x0, x1, z0, z1, Y, mask));
    root.add(this.runs(R, x0, x1, z0, z1, Y, runWidth));
    this.runLayer = root.children[root.children.length - 1];
    for (const l of lifts) root.add(this.lift(l, Y));
    for (const b of base ? [base] : lodges) root.add(this.lodge(b, Y));
    this.skiers(R, x0, x1, z0, z1, Y, root);
    this.light(x0, x1, z0, z1);
    this.graph = graph;
    this.R = R;
    return this;
  }

  ground(x0, x1, z0, z1, Y, mask) {
    const nx = Math.round((x1 - x0) / STEP) + 1, nz = Math.round((z1 - z0) / STEP) + 1;
    const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
    const snow = new THREE.Color(0xfbfcff), floor = new THREE.Color(0xd8dfe8), c = new THREE.Color();
    for (let i = 0; i < nz; i++) for (let j = 0; j < nx; j++) {
      const x = x0 + ((x1 - x0) * j) / (nx - 1), z = z0 + ((z1 - z0) * i) / (nz - 1), k = i * nx + j;
      pos.set([x, Y(x, z), z], k * 3);
      c.copy(snow);
      if (mask(x, z)) c.lerp(floor, 0.6);
      col.set([c.r, c.g, c.b], k * 3);
    }
    const idx = [];
    for (let i = 0; i < nz - 1; i++) for (let j = 0; j < nx - 1; j++) { const a = i * nx + j; idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
    m.receiveShadow = true;
    return m;
  }

  // The cut faces: a snow crust, then earth, then banded rock, like a cake slice.
  sides(x0, x1, z0, z1, Y) {
    const group = new THREE.Group();
    const bands = [[0, 0xf6f8fb], [10, 0x7b5a40], [55, 0x8a7766], [85, 0x6d6762], [120, 0x847d77], [170, 0x5f5a56]];
    const bottom = -40;
    const edge = (ax, az, bx, bz) => {
      const n = Math.round(Math.hypot(bx - ax, bz - az) / STEP);
      const pos = [], col = [], idx = [];
      const c = new THREE.Color();
      const rows = 24;
      for (let i = 0; i <= n; i++) {
        const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n, top = Y(x, z);
        for (let r = 0; r <= rows; r++) {
          const y = top + ((bottom - top) * r) / rows, depth = top - y;
          let hex = bands[0][1];
          for (const [d, h] of bands) if (depth >= d + Math.sin(x * 0.01 + z * 0.013 + d) * 6) hex = h;
          c.set(hex);
          pos.push(x, y, z);
          col.push(c.r, c.g, c.b);
          if (i && r) { const a = (i - 1) * (rows + 1) + r - 1, b = i * (rows + 1) + r - 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, flatShading: true }));
      m.castShadow = true;
      group.add(m);
    };
    edge(x0, z0, x1, z0); edge(x1, z0, x1, z1); edge(x1, z1, x0, z1); edge(x0, z1, x0, z0);
    return group;
  }

  // front: the bearing (atan2 of z, x from the block's centre) the camera looks from; the plate faces it.
  plinth(x0, x1, z0, z1, title, front = -Math.PI / 4) {
    const group = new THREE.Group();
    const w = x1 - x0 + 120, d = z1 - z0 + 120, h = 260;
    const base = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 6, 40), new THREE.MeshStandardMaterial({ color: 0xf4f5f7, roughness: 0.35 }));
    base.position.set((x0 + x1) / 2, -40 - h / 2, (z0 + z1) / 2);
    base.castShadow = base.receiveShadow = true;
    group.add(base);
    // Name plate on the side facing the camera's start.
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 220;
    const g = c.getContext("2d");
    g.fillStyle = "#3d434d"; g.fillRect(0, 0, 1024, 220);
    g.strokeStyle = "#9aa3ae"; g.lineWidth = 10; g.strokeRect(10, 10, 1004, 200);
    g.fillStyle = "#eef1f4"; g.textAlign = "center"; g.textBaseline = "middle";
    let px = 92; // shrink long names until they fit the plate
    do g.font = `600 ${px}px Helvetica, Arial, sans-serif`; while (g.measureText(title).width > 940 && (px -= 4) > 36);
    g.fillText(title, 512, 112);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const pw = Math.min(w * 0.55, 1300);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(pw, pw * 0.215, 14), [0, 0, 0, 0, 1, 0].map((i) => (i ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.3 }) : new THREE.MeshStandardMaterial({ color: 0x3d434d }))));
    // On the side facing the camera: the side the bearing points through.
    const fx = Math.cos(front), fz = Math.sin(front), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (Math.abs(fx) * d > Math.abs(fz) * w) { plate.position.set(fx > 0 ? x1 + 68 : x0 - 68, -40 - h / 2, cz); plate.rotation.y = fx > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { plate.position.set(cx, -40 - h / 2, fz > 0 ? z1 + 68 : z0 - 68); plate.rotation.y = fz > 0 ? 0 : Math.PI; }
    if (Math.abs(fx) * d > Math.abs(fz) * w) plate.scale.x = Math.min(1, (d * 0.55) / pw);
    group.add(plate);
    // A table to throw soft shadows on.
    const table = new THREE.Mesh(new THREE.CircleGeometry(Math.max(w, d) * 3, 48), new THREE.MeshStandardMaterial({ color: 0xe4e8ee, roughness: 1 }));
    table.rotation.x = -Math.PI / 2;
    table.position.set((x0 + x1) / 2, -40 - h - 1, (z0 + z1) / 2);
    table.receiveShadow = true;
    group.add(table);
    return group;
  }

  // Toy spruces: chunky, round-shouldered, heavy snow caps.
  trees(x0, x1, z0, z1, Y, mask) {
    const parts = [];
    const tier = (y, h, r, color) => {
      const g = new THREE.ConeGeometry(r, h, 8, 1).toNonIndexed();
      g.translate(0, y + h / 2, 0);
      const n = g.attributes.position.count, col = new Float32Array(n * 3), c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const up = (g.attributes.position.getY(i) - y) / h;
        c.set(color).lerp(new THREE.Color(0xf4f7fb), up > 0.55 ? 0.85 : 0.0); // snow on the upper part of each tier
        col.set([c.r, c.g, c.b], i * 3);
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      parts.push(g);
    };
    tier(4 * TOY, 22 * TOY, 12 * TOY, 0x1f4a33); tier(16 * TOY, 18 * TOY, 9 * TOY, 0x24543a); tier(27 * TOY, 14 * TOY, 6 * TOY, 0x2a5e40);
    const trunk = new THREE.CylinderGeometry(1.8 * TOY, 2.4 * TOY, 6 * TOY, 6).toNonIndexed();
    trunk.translate(0, 3 * TOY, 0);
    trunk.setAttribute("color", new THREE.BufferAttribute(new Float32Array(trunk.attributes.position.count * 3).map((_, i) => [0.35, 0.24, 0.16][i % 3]), 3));
    parts.push(trunk);
    const pos = [], col = [];
    for (const p of parts) { pos.push(...p.attributes.position.array); col.push(...p.attributes.color.array); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const spots = [];
    for (let x = x0 + 30; x < x1 - 30; x += 46) for (let z = z0 + 30; z < z1 - 30; z += 46) {
      const px = x + (rand() - 0.5) * 40, pz = z + (rand() - 0.5) * 40;
      if (mask(px, pz) && rand() < 0.7) spots.push([px, pz, rand()]);
    }
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    spots.forEach(([x, z, v], i) => {
      const k = 0.75 + v * 0.6;
      m.compose(p.set(x, Y(x, z) - 1, z), q.setFromAxisAngle(up, v * 6.28), s.set(k, k, k));
      mesh.setMatrixAt(i, m);
    });
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }

  runs(R, x0, x1, z0, z1, Y, runWidth = 24) {
    const group = new THREE.Group();
    const inside = (p) => p[0] > x0 && p[0] < x1 && p[1] > z0 && p[1] < z1;
    const ribbon = (pts, width, lift, area) => {
      const pos = [], idx = [], along = [];
      // 0 at the top of the run, 1 at the bottom: by distance for a line, by height for an outlined area.
      const d = [0];
      for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const hs = pts.map(([x, z]) => Y(x, z)), hmax = Math.max(...hs), hmin = Math.min(...hs);
      const downhill = hs[0] >= hs[hs.length - 1];
      const at = (i) => (area ? (hmax - hs[i]) / (hmax - hmin || 1) : downhill ? d[i] / d[d.length - 1] : 1 - d[i] / d[d.length - 1]);
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i], [ax, az] = pts[Math.max(0, i - 1)], [bx, bz] = pts[Math.min(pts.length - 1, i + 1)];
        let dx = bx - ax, dz = bz - az;
        const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
        for (const sd of [-1, 1]) { const px = x - dz * sd * width / 2, pz = z + dx * sd * width / 2; pos.push(px, Y(px, pz) + lift, pz); along.push(at(i)); }
        if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("along", new THREE.Float32BufferAttribute(along, 1));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return geo;
    };
    for (const run of R.runs) {
      const pts = (run.outline || run.pts).filter(inside);
      if (pts.length < 3) continue;
      const mat = new THREE.MeshStandardMaterial({ color: RUN_COLOR[run.level], roughness: 0.5, transparent: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      // Above uReveal the run shows at uTo, below it still at uFrom; a light band marks the front.
      const u = { uReveal: { value: 1 }, uFrom: { value: 1 }, uTo: { value: 1 }, uFront: { value: 0 } };
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, u);
        sh.vertexShader = "attribute float along;\nvarying float vAlong;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvAlong = along;");
        sh.fragmentShader = "varying float vAlong;\nuniform float uReveal, uFrom, uTo, uFront;\n" + sh.fragmentShader.replace("#include <dithering_fragment>", `#include <dithering_fragment>
          float lit = step(vAlong, uReveal);
          gl_FragColor.a *= mix(uFrom, uTo, lit);
          gl_FragColor.rgb += vec3(0.75, 0.85, 1.0) * uFront * smoothstep(0.07, 0.0, abs(vAlong - uReveal));`);
      };
      const mesh = new THREE.Mesh(ribbon(pts, run.area ? 10 : runWidth, 2, run.area), mat);
      mesh.receiveShadow = true;
      mesh.userData.run = run;
      mesh.userData.u = u;
      group.add(mesh);
    }
    return group;
  }

  lift(l, Y) {
    const group = new THREE.Group();
    const pts = l.pts.map(([x, z]) => new THREE.Vector3(x, Y(x, z), z));
    const dense = [];
    for (let i = 1; i < pts.length; i++) {
      const n = Math.max(1, Math.round(pts[i].distanceTo(pts[i - 1]) / 120));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) dense.push(pts[i - 1].clone().lerp(pts[i], k / n));
    }
    const towerH = 34 * TOY;
    const mid = dense[Math.round(dense.length * 0.6)] || pts[pts.length - 1];
    this.anchors.set(l, mid.clone().add(new THREE.Vector3(0, towerH + 30, 0)));
    const steel = new THREE.MeshStandardMaterial({ color: 0x5b6270, roughness: 0.4, metalness: 0.5 });
    const rope = dense.map((p) => p.clone().add(new THREE.Vector3(0, towerH, 0)));
    for (let i = 0; i < dense.length; i++) {
      const p = dense[i];
      const t = new THREE.Mesh(new THREE.CylinderGeometry(1.6 * TOY, 2.4 * TOY, towerH, 8), steel);
      t.position.copy(p).add(new THREE.Vector3(0, towerH / 2, 0));
      t.castShadow = true;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(16 * TOY, 2 * TOY, 2 * TOY), steel);
      arm.position.copy(p).add(new THREE.Vector3(0, towerH, 0));
      const dir = (dense[i + 1] || p).clone().sub(dense[i - 1] || p);
      arm.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI / 2;
      arm.castShadow = true;
      group.add(t, arm);
    }
    const side = new THREE.Vector3(rope[rope.length - 1].z - rope[0].z, 0, -(rope[rope.length - 1].x - rope[0].x)).normalize().multiplyScalar(7 * TOY);
    const lines = [rope.map((p) => p.clone().add(side)), rope.map((p) => p.clone().sub(side)).reverse()];
    for (const line of lines) group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(line), line.length * 4, 0.9 * TOY, 4), new THREE.MeshStandardMaterial({ color: 0x2c313a })));
    // A glowing band along the line, shown when this lift is the chosen one.
    const glow = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rope), rope.length * 4, 9 * TOY, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.55, depthWrite: false }));
    glow.visible = false;
    glow.renderOrder = 2;
    group.add(glow);
    this.liftParts.set(l, { group, glow });
    // Stations at both ends.
    for (const [p, q] of [[pts[0], pts[1]], [pts[pts.length - 1], pts[pts.length - 2]]]) {
      const st = new THREE.Group();
      const body = new THREE.Mesh(new RoundedBoxGeometry(40 * TOY, 18 * TOY, 30 * TOY, 3, 4 * TOY), new THREE.MeshStandardMaterial({ color: 0xd9dde3, roughness: 0.4 }));
      body.position.y = 9 * TOY;
      const roof = new THREE.Mesh(new RoundedBoxGeometry(46 * TOY, 5 * TOY, 36 * TOY, 3, 2 * TOY), new THREE.MeshStandardMaterial({ color: 0x2f3946, roughness: 0.5 }));
      roof.position.y = 20 * TOY;
      st.add(body, roof);
      st.position.copy(p);
      st.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
      st.traverse((o) => { o.castShadow = o.receiveShadow = true; });
      group.add(st);
    }
    // Chairs with riders, moving up one side and down the other.
    const chairGeo = new THREE.BoxGeometry(9 * TOY, 2 * TOY, 5 * TOY);
    const chairs = new THREE.InstancedMesh(chairGeo, new THREE.MeshStandardMaterial({ color: 0x3a4250 }), 80);
    const riders = new THREE.InstancedMesh(new THREE.CapsuleGeometry(1.6 * TOY, 3 * TOY, 4, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: false }), 80);
    const colors = [0xe2463d, 0x2f7fe8, 0xf2b632, 0x22b35a, 0x8e5bd9];
    for (let i = 0; i < 80; i++) riders.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    chairs.castShadow = riders.castShadow = true;
    group.add(chairs, riders);
    const curves = lines.map((line) => new THREE.CatmullRomCurve3(line));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    this.movers.push((t) => {
      for (let i = 0; i < 80; i++) {
        const curve = curves[i % 2], u = ((t * 0.012 + i / 80) % 1);
        curve.getPointAt(u, pv);
        const tan = curve.getTangentAt(u);
        q.setFromAxisAngle(up, Math.atan2(tan.x, tan.z));
        m.compose(pv.clone().add(new THREE.Vector3(0, -9 * TOY, 0)), q, s);
        chairs.setMatrixAt(i, m);
        m.compose(pv.clone().add(new THREE.Vector3(0, -6 * TOY, 0)), q, s);
        riders.setMatrixAt(i, m);
      }
      chairs.instanceMatrix.needsUpdate = riders.instanceMatrix.needsUpdate = true;
    });
    return group;
  }

  // The chosen lift glows; the others fade back. Null shows every lift as it is.
  focusLift(l) {
    for (const [x, { group, glow }] of this.liftParts) {
      glow.visible = x === l;
      group.traverse((o) => {
        if (!o.material || o === glow) return;
        o.material.transparent = true;
        o.material.opacity = l && x !== l ? 0.3 : 1;
      });
    }
    this.chosen = l;
  }

  // A chalet at the base: timber walls, a steep snowy roof, lit windows.
  lodge(base, Y) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.7 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x9a948c, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(70, 26, 40), wood);
    body.position.y = 13 + 8;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(74, 8, 44), stone);
    plinth.position.y = 4;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 34, 22, 4, 1), new THREE.MeshStandardMaterial({ color: 0xf3f6fa, roughness: 0.5 }));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.45, 1, 0.9);
    roof.position.y = 34 + 11;
    const windows = new THREE.Mesh(new THREE.BoxGeometry(60, 6, 41), new THREE.MeshStandardMaterial({ color: 0xffd48a, emissive: 0xffb04a, emissiveIntensity: 0.8 }));
    windows.position.y = 20;
    g.add(plinth, body, roof, windows);
    const x = base.x + 60 * TOY, z = base.z - 70 * TOY;
    g.scale.setScalar(TOY);
    g.position.set(x, Y(x, z) - 2, z);
    g.rotation.y = 0.4;
    g.traverse((o) => { o.castShadow = o.receiveShadow = true; });
    return g;
  }

  // Little skiers going down the runs near the base.
  skiers(R, x0, x1, z0, z1, Y, root) {
    const inside = (p) => p[0] > x0 + 20 && p[0] < x1 - 20 && p[1] > z0 + 20 && p[1] < z1 - 20;
    const tracks = R.runs.filter((r) => !r.area && r.pts.filter(inside).length > 20).map((r) => r.pts.filter(inside));
    if (!tracks.length) return;
    const n = Math.min(60, tracks.length * 5);
    const mesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(2.2 * TOY, 5 * TOY, 4, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }), n);
    const colors = [0xe2463d, 0x2f7fe8, 0xf2b632, 0xffffff, 0x8e5bd9, 0x22b35a];
    for (let i = 0; i < n; i++) mesh.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    mesh.castShadow = true;
    root.add(mesh);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    const offs = Array.from({ length: n }, () => [rand(), (rand() - 0.5) * 8, 0.004 + rand() * 0.004]);
    this.movers.push((t) => {
      for (let i = 0; i < n; i++) {
        const tr = tracks[i % tracks.length], [o, side, sp] = offs[i];
        const u = (t * sp + o) % 1, f = u * (tr.length - 1), a = tr[Math.floor(f)], b = tr[Math.min(tr.length - 1, Math.floor(f) + 1)];
        const x = a[0] + (b[0] - a[0]) * (f % 1) + Math.sin(t * 2 + i) * side, z = a[1] + (b[1] - a[1]) * (f % 1);
        m.compose(p.set(x, Y(x, z) + 5 * TOY, z), q, s);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  light(x0, x1, z0, z1) {
    for (const o of this.scene.children.filter((c) => c.isLight)) this.scene.remove(o);
    this.scene.add(new THREE.HemisphereLight(0xf2f6ff, 0xb9c0cc, 1.1));
    const key = new THREE.DirectionalLight(0xfff4e6, 2.6);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, size = Math.max(x1 - x0, z1 - z0);
    key.position.set(cx - size, size * 1.4, cz + size * 0.7);
    key.target.position.set(cx, 0, cz);
    key.castShadow = true;
    key.shadow.mapSize.setScalar(matchMedia("(pointer: coarse)").matches ? 2048 : 4096);
    Object.assign(key.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 10, far: size * 5 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 2;
    key.shadow.radius = 4;
    this.scene.add(key, key.target);
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

  // Camera on a circle around the block; u in [0, 1) is the position on the circle.
  // u: position on the circle [0, 1). visible: the fraction of the screen height above the drawer;
  // the block is fitted into that part and centred in it.
  orbit(u, visible = 1, topPad = 0, raise = 0, elevation = 36) {
    const radius = this.size; // how much to fit: the whole block, or a lift and its runs
    const vfov = (this.camera.fov * Math.PI) / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const room = 2 * Math.atan(Math.tan(vfov / 2) * visible); // vertical angle of the visible part
    // Start and rest at a three-quarter view (u = 0 is 45° off the base's side), slightly from above.
    const dist = radius / Math.sin(Math.min(room, hfov) / 2),
      el = (elevation * Math.PI) / 180, a = -Math.PI / 2 + Math.PI / 4 + u * Math.PI * 2;
    const f = this.focus; // the point at the centre of the frame: the block's centre, or the chosen lift
    this.camera.position.set(f.x + Math.cos(a) * dist * Math.cos(el), f.y + dist * Math.sin(el), f.z + Math.sin(a) * dist * Math.cos(el));
    this.camera.lookAt(f);
    // Tilt down so the block's centre sits in the middle of the visible part, not of the whole screen.
    const centreFromTop = topPad + visible / 2 - raise, shift = Math.atan((0.5 - centreFromTop) * 2 * Math.tan(vfov / 2));
    this.camera.rotateX(-shift);
    this.hTilt.uniforms.r.value = this.vTilt.uniforms.r.value = 1 - centreFromTop; // focus on the block
    this.camera.updateMatrixWorld();
    this.a = a;
  }

  // Where a lift's tag goes on screen, in CSS pixels; null when behind the camera.
  screenOf(l, v = new THREE.Vector3()) {
    const p = this.anchors.get(l);
    if (!p) return null;
    v.copy(p).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
  }

  // Centre the frame on a lift (the middle of its line), or on the whole block when null.
  // Frame a lift and the runs it leads to: centre on them and zoom so they fill the frame (small
  // lifts come closer, up to twice the size of the whole block). Null frames the whole block.
  aim(l, runs = []) {
    if (!l) { this.focusTo.set(this.box.cx, 60, this.box.cz); this.sizeTo = this.whole; return; }
    const { x0, x1, z0, z1 } = this.box;
    const pts = [...l.pts, ...runs.flatMap((r) => r.pts)].filter(([x, z]) => x > x0 && x < x1 && z > z0 && z < z1);
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]), ys = pts.map(([x, z]) => this.Y(x, z));
    const c = new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2);
    let r = 0;
    for (let i = 0; i < pts.length; i++) r = Math.max(r, Math.hypot(xs[i] - c.x, ys[i] - c.y, zs[i] - c.z));
    this.focusTo.copy(c);
    this.sizeTo = Math.min(this.whole, Math.max(this.whole * 0.5, r * 1.08));
  }

  // The orbit position that looks up a lift from below, facing the slope its runs come down.
  facing(l) {
    const b = l.pts[0], t = l.pts[l.pts.length - 1];
    const a = Math.atan2(b[1] - t[1], b[0] - t[0]) + 0.2;
    return (((a + Math.PI / 4) / (Math.PI * 2)) % 1 + 1) % 1;
  }

  render(t) {
    for (const f of this.movers) f(t);
    const now = performance.now() / 1000;
    const g = this.chosen && this.liftParts.get(this.chosen);
    if (g) g.glow.material.opacity = 0.42 + 0.2 * Math.sin(now * 3.2); // a slow pulse
    for (const a of this.anims) {
      const k = Math.min(1, Math.max(0, (now - a.t0) / a.dur));
      a.u.uReveal.value = 1 - (1 - k) * (1 - k);
      if (k >= 1) a.u.uFront.value = 0;
    }
    this.composer.render();
  }
}
