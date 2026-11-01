// The resort as a scene: terrain with baked sun shadows, sky, forest, runs, trail signs and moving lifts.
// Look: stylized realism. Warm low sun, lavender-blue shadows, real proportions.
import * as THREE from "three";

export const LEVEL = {
  easy: { zh: "初级", color: 0x2fae5a },
  intermediate: { zh: "中级", color: 0x2f7fe8 },
  advanced: { zh: "高级", color: 0x23252f },
  expert: { zh: "专家", color: 0x23252f },
};

// Afternoon sun from the west, fairly high, so the north-facing runs are lit with long shadows off the ridges.
export const SUN_DIR = new THREE.Vector3(-0.78, 0.6, 0.18).normalize();

export class Terrain {
  constructor(data) {
    this.data = data;
    [this.gw, this.gh] = data.grid;
    [this.x0, this.z0, this.x1, this.z1] = data.bounds;
    const raw = Uint8Array.from(atob(data.heights), (c) => c.charCodeAt(0));
    const q = new Uint16Array(raw.buffer);
    this.h = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) this.h[i] = q[i] / 10;
    this.cell = (this.x1 - this.x0) / (this.gw - 1);
  }

  heightAt(x, z) {
    const { gw, gh, h } = this;
    let c = ((x - this.x0) / (this.x1 - this.x0)) * (gw - 1);
    let r = ((z - this.z0) / (this.z1 - this.z0)) * (gh - 1);
    c = Math.min(Math.max(c, 0), gw - 1.001);
    r = Math.min(Math.max(r, 0), gh - 1.001);
    const i = Math.floor(r), j = Math.floor(c), fr = r - i, fc = c - j;
    const k = i * gw + j;
    return h[k] * (1 - fc) * (1 - fr) + h[k + 1] * fc * (1 - fr) + h[k + gw] * (1 - fc) * fr + h[k + gw + 1] * fc * fr;
  }

  normalAt(x, z, out = new THREE.Vector3()) {
    const s = 5;
    return out.set(this.heightAt(x - s, z) - this.heightAt(x + s, z), 2 * s, this.heightAt(x, z - s) - this.heightAt(x, z + s)).normalize();
  }

  altitude(y) { return Math.round(this.data.hmin + y); }

  // 0 = in the sun, 1 = in a mountain's shadow (soft near the edge).
  sunShadow(x, z, y) {
    const dx = SUN_DIR.x, dz = SUN_DIR.z, horiz = Math.hypot(dx, dz), rise = SUN_DIR.y / horiz;
    let t = this.cell, shade = 0;
    while (t < 3500) {
      const px = x + (dx / horiz) * t, pz = z + (dz / horiz) * t;
      if (px < this.x0 || px > this.x1 || pz < this.z0 || pz > this.z1) break;
      const above = this.heightAt(px, pz) - (y + t * rise);
      if (above > 0) return 1;
      shade = Math.max(shade, 1 + above / 18); // grazing the ridge: penumbra
      t *= 1.07;
    }
    return Math.max(0, Math.min(1, shade));
  }

  mesh(treeMask) {
    const { gw, gh } = this;
    const pos = new Float32Array(gw * gh * 3), col = new Float32Array(gw * gh * 3);
    const snow = new THREE.Color(0xfaf7f4), shadowTint = new THREE.Color(0x9fa6d9), rock = new THREE.Color(0x8f8794), forestFloor = new THREE.Color(0xd9dbe8);
    const c = new THREE.Color(), n = new THREE.Vector3();
    for (let r = 0; r < gh; r++) {
      for (let j = 0; j < gw; j++) {
        const k = r * gw + j;
        const x = this.x0 + j * this.cell, z = this.z0 + ((this.z1 - this.z0) * r) / (gh - 1), y = this.h[k];
        pos.set([x, y, z], k * 3);
        this.normalAt(x, z, n);
        const steep = 1 - n.y;
        c.copy(snow);
        if (treeMask && treeMask(x, z)) c.lerp(forestFloor, 0.6);
        if (steep > 0.3) c.lerp(rock, Math.min((steep - 0.3) * 3.2, 0.85)); // wind-scoured cliffs
        c.lerp(shadowTint, this.sunShadow(x, z, y) * 0.42);
        col.set([c.r, c.g, c.b], k * 3);
      }
    }
    const idx = new Uint32Array((gw - 1) * (gh - 1) * 6);
    let p = 0;
    for (let r = 0; r < gh - 1; r++) {
      for (let j = 0; j < gw - 1; j++) {
        const a = r * gw + j;
        idx.set([a, a + gw, a + 1, a + 1, a + gw, a + gw + 1], p);
        p += 6;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.receiveShadow = true;
    return mesh;
  }
}

export function sky() {
  const geo = new THREE.SphereGeometry(40000, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sun: { value: SUN_DIR } },
    vertexShader: "varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `varying vec3 v; uniform vec3 sun;
      void main(){
        float h = clamp(v.y, -0.1, 1.0);
        vec3 top = vec3(0.55,0.78,0.80), mid = vec3(0.78,0.90,0.89), low = vec3(0.98,0.90,0.84);
        vec3 c = mix(low, mid, smoothstep(0.0, 0.18, h));
        c = mix(c, top, smoothstep(0.18, 0.8, h));
        float s = max(dot(normalize(v), sun), 0.0);
        c += vec3(1.0,0.75,0.55) * (pow(s, 12.0) * 0.35 + pow(s, 400.0) * 0.8);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  return mesh;
}

export function lights(scene) {
  scene.add(new THREE.HemisphereLight(0xe3ebff, 0xb9b6d8, 1.35));
  const sun = new THREE.DirectionalLight(0xffe2c4, 2.6);
  sun.position.copy(SUN_DIR).multiplyScalar(500);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 1500 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  return sun;
}

export function treeMaskFn(data, terrain) {
  const [mw, mh] = data.trees.grid;
  const bits = Uint8Array.from(atob(data.trees.bits), (c) => c.charCodeAt(0));
  const at = (c, r) => { const k = r * mw + c; return (bits[k >> 3] & (0x80 >> (k & 7))) !== 0; };
  const fn = (x, z) => {
    const c = Math.round(((x - terrain.x0) / (terrain.x1 - terrain.x0)) * (mw - 1));
    const r = Math.round(((z - terrain.z0) / (terrain.z1 - terrain.z0)) * (mh - 1));
    return c >= 0 && r >= 0 && c < mw && r < mh && at(c, r);
  };
  fn.grid = [mw, mh];
  fn.at = at;
  return fn;
}

// Conifers at real size: three stacked cones, dark needles with snow on the upper tiers.
export function forest(terrain, mask) {
  const parts = [[0, 7, 3.6], [4.5, 6.5, 2.7], [8.5, 5.5, 1.7]].map(([y, h, r], tier) => {
    const g = new THREE.ConeGeometry(r, h, 6, 1);
    g.translate(0, y + h / 2 + 1.2, 0);
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    const dark = new THREE.Color(0x24423a), snowy = new THREE.Color(0xc8d2e4), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const top = (g.attributes.position.getY(i) - y - 1.2) / h;
      c.copy(dark).lerp(snowy, top > 0.95 ? 0.0 : (1 - top) * 0.12 + tier * 0.12);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  });
  const geo = mergeGeometries(parts);

  const [mw, mh] = mask.grid;
  const spots = [];
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let r = 0; r < mh; r++) {
    for (let c = 0; c < mw; c++) {
      if (!mask.at(c, r) || rand() > 0.04) continue;
      const x = terrain.x0 + ((terrain.x1 - terrain.x0) * (c + rand() - 0.5)) / (mw - 1);
      const z = terrain.z0 + ((terrain.z1 - terrain.z0) * (r + rand() - 0.5)) / (mh - 1);
      spots.push([x, z, rand()]);
    }
  }
  // Chunks of trees so the camera and the shadow pass only draw the ones near them.
  const CH = 10, group = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const buckets = Array.from({ length: CH * CH }, () => []);
  for (const spot of spots) {
    const c = Math.min(CH - 1, Math.max(0, Math.floor(((spot[0] - terrain.x0) / (terrain.x1 - terrain.x0)) * CH)));
    const r = Math.min(CH - 1, Math.max(0, Math.floor(((spot[1] - terrain.z0) / (terrain.z1 - terrain.z0)) * CH)));
    buckets[r * CH + c].push(spot);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  for (const bucket of buckets) {
    if (!bucket.length) continue;
    const mesh = new THREE.InstancedMesh(geo, mat, bucket.length);
    bucket.forEach(([x, z, v], i) => {
      const k = 0.8 + v * 0.75;
      q.setFromAxisAngle(yAxis, v * 6.28);
      m.compose(p.set(x, terrain.heightAt(x, z) - 0.4, z), q, s.set(k, k * (0.9 + v * 0.35), k));
      mesh.setMatrixAt(i, m);
    });
    mesh.computeBoundingSphere();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.userData.count = spots.length;
  return group;
}

function mergeGeometries(list) {
  const pos = [], col = [], idx = [];
  let offset = 0;
  for (const g of list) {
    const gi = g.index ? g : g.toNonIndexed();
    pos.push(...gi.attributes.position.array);
    col.push(...gi.attributes.color.array);
    if (gi.index) for (const v of gi.index.array) idx.push(v + offset);
    else for (let v = 0; v < gi.attributes.position.count; v++) idx.push(v + offset);
    offset += gi.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// A strip draped on the terrain along a polyline; v runs along it in meters.
export function ribbon(terrain, pts, width, lift = 0.35) {
  const pos = [], uv = [], idx = [];
  let along = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    const [ax, az] = pts[Math.max(i - 1, 0)], [bx, bz] = pts[Math.min(i + 1, pts.length - 1)];
    let dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    if (i) along += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    for (const side of [-1, 1]) {
      const px = x - dz * side * width / 2, pz = z + dx * side * width / 2;
      pos.push(px, terrain.heightAt(px, pz) + lift, pz);
      uv.push(side < 0 ? 0 : 1, along);
    }
    if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Groomed corduroy: faint lengthwise stripes, only visible up close.
function corduroyTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 4;
  const g = c.getContext("2d");
  for (let x = 0; x < 64; x++) {
    const v = 236 + (x % 4 < 2 ? 14 : 0);
    g.fillStyle = `rgb(${v},${v},${Math.min(255, v + 6)})`;
    g.fillRect(x, 0, 1, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Map look: every run is a soft groomed band with a thin difficulty line down the middle, the way runs
// read on a real slope. The selected run or route is drawn bold in its color on top (see highlight()).
export function runLayers(terrain, runs) {
  const mapLayer = new THREE.Group(), skiLayer = new THREE.Group();
  const meshes = new Map();
  const cord = corduroyTexture();
  const band = new THREE.MeshBasicMaterial({ color: 0xc4c8d8, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  for (const run of runs) {
    const line = run.outline || run.pts;
    if (!run.area) mapLayer.add(new THREE.Mesh(ribbon(terrain, line, 26, 0.4), band));
    const mat = new THREE.MeshBasicMaterial({
      color: LEVEL[run.level].color, transparent: true, opacity: run.area ? 0.35 : 0.7, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    const mesh = new THREE.Mesh(ribbon(terrain, line, run.area ? 5 : 4, 0.6), mat);
    mesh.userData.run = run;
    mapLayer.add(mesh);
    meshes.set(run, mesh);
    if (!run.area) {
      const tex = cord.clone();
      tex.repeat.set(1, 1 / 4);
      tex.needsUpdate = true;
      const groomed = new THREE.Mesh(ribbon(terrain, run.pts, 34, 0.12), new THREE.MeshLambertMaterial({
        map: tex, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }));
      groomed.receiveShadow = true;
      skiLayer.add(groomed);
    }
  }
  return { mapLayer, skiLayer, meshes };
}

// Bold colored band(s) for a selected run or a planned route.
export function highlight(terrain, pieces) {
  const group = new THREE.Group();
  for (const { pts, level, color } of pieces) {
    if (pts.length < 2) continue;
    if (color !== undefined) {
      // Lifts: a thin line under the cable.
      group.add(new THREE.Mesh(ribbon(terrain, pts, 7, 0.8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })));
      continue;
    }
    const mat = new THREE.MeshBasicMaterial({
      color: color ?? LEVEL[level].color, transparent: true, opacity: 0.92, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
    });
    group.add(new THREE.Mesh(ribbon(terrain, pts, 22, 0.8), mat));
    const edge = new THREE.MeshBasicMaterial({ color: 0xf2e36b, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
    group.add(new THREE.Mesh(ribbon(terrain, pts, 30, 0.7), edge));
  }
  return group;
}

// Trail signs where runs start: a post with the run's difficulty symbol and name, like on the mountain.
export function signs(terrain, runs) {
  const group = new THREE.Group();
  const seen = [];
  const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6);
  postGeo.translate(0, 1.3, 0);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x6b5a48 });
  for (const run of runs) {
    if (!run.name || run.pts.length < 3) continue;
    const [x, z] = run.pts[1];
    if (seen.some((s) => s.name === run.name && Math.hypot(s.x - x, s.z - z) < 300)) continue;
    seen.push({ name: run.name, x, z });
    const [nx, nz] = run.pts[Math.min(4, run.pts.length - 1)];
    const dirX = nx - run.pts[0][0], dirZ = nz - run.pts[0][1];
    // Stand at the side of the run, facing skiers coming from above.
    const len = Math.hypot(dirX, dirZ) || 1;
    const sx = x + (-dirZ / len) * 14, sz = z + (dirX / len) * 14;
    const sign = new THREE.Group();
    sign.position.set(sx, terrain.heightAt(sx, sz), sz);
    sign.rotation.y = Math.atan2(-dirX, -dirZ);
    const post = new THREE.Mesh(postGeo, postMat);
    post.castShadow = true;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: signTexture(run), side: THREE.DoubleSide }));
    board.position.y = 2.25;
    sign.add(post, board);
    group.add(sign);
  }
  return group;
}

function signTexture(run) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#f4efe6"; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = "#3a3a3a"; g.lineWidth = 6; g.strokeRect(3, 3, 506, 122);
  drawSymbol(g, run.level, 64, 64, 34);
  g.fillStyle = "#23252f";
  g.font = "bold 50px -apple-system, Helvetica, sans-serif";
  g.textBaseline = "middle";
  let text = run.name;
  while (g.measureText(text).width > 380 && text.length > 3) text = text.slice(0, -2) + "…";
  g.fillText(text, run.level === "expert" ? 140 : 118, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function drawSymbol(g, level, cx, cy, r) {
  g.save();
  if (level === "easy") { g.fillStyle = "#2fae5a"; g.beginPath(); g.arc(cx, cy, r * 0.8, 0, Math.PI * 2); g.fill(); }
  else if (level === "intermediate") { g.fillStyle = "#2f7fe8"; g.fillRect(cx - r * 0.75, cy - r * 0.75, r * 1.5, r * 1.5); }
  else {
    g.fillStyle = "#111";
    const diamond = (x) => { g.beginPath(); g.moveTo(x, cy - r); g.lineTo(x + r * 0.8, cy); g.lineTo(x, cy + r); g.lineTo(x - r * 0.8, cy); g.closePath(); g.fill(); };
    if (level === "expert") { diamond(cx - r * 0.45); diamond(cx + r * 1.25); } else diamond(cx);
  }
  g.restore();
}

// Lifts: towers, a haul rope, terminals, and chairs that actually move.
export class Lifts {
  constructor(terrain, lifts) {
    this.group = new THREE.Group();
    this.lines = [];
    const towerMat = new THREE.MeshLambertMaterial({ color: 0x7c8193 });
    const towerGeo = new THREE.CylinderGeometry(0.35, 0.5, 1, 6);
    towerGeo.translate(0, 0.5, 0);
    const armGeo = new THREE.BoxGeometry(6, 0.35, 0.35);
    const ropeMat = new THREE.LineBasicMaterial({ color: 0x3c3f4f });
    const houseMat = new THREE.MeshLambertMaterial({ color: 0x9a9fae });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xb4483f });
    let chairs = 0;
    for (const lift of lifts) {
      const ground = lift.pts.map(([x, z]) => new THREE.Vector3(x, terrain.heightAt(x, z), z));
      const span = densify(ground, 40);
      const rope = span.map((p) => p.clone().add(new THREE.Vector3(0, 11, 0)));
      // Two haul ropes 2.5 m apart: up on one side, down on the other.
      const side = new THREE.Vector3(rope[rope.length - 1].z - rope[0].z, 0, -(rope[rope.length - 1].x - rope[0].x)).normalize().multiplyScalar(1.25);
      const up = rope.map((p) => p.clone().add(side)), down = rope.map((p) => p.clone().sub(side)).reverse();
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(up), ropeMat), new THREE.Line(new THREE.BufferGeometry().setFromPoints(down), ropeMat));
      span.forEach((p, i) => {
        if (i % 3 || i === 0 || i === span.length - 1) return;
        const t = new THREE.Mesh(towerGeo, towerMat);
        t.position.copy(p); t.scale.y = 11.3;
        const arm = new THREE.Mesh(armGeo, towerMat);
        arm.position.copy(p).add(new THREE.Vector3(0, 11.2, 0));
        arm.rotation.y = Math.atan2(side.x, side.z) + Math.PI / 2;
        t.castShadow = arm.castShadow = true;
        this.group.add(t, arm);
      });
      for (const [p, next] of [[ground[0], ground[1]], [ground[ground.length - 1], ground[ground.length - 2]]]) {
        const house = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 7), houseMat); box.position.y = 2.5;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(6.6, 2.4, 4), roofMat); roof.position.y = 6.2; roof.rotation.y = Math.PI / 4; roof.scale.z = 0.8;
        house.add(box, roof);
        house.position.copy(p);
        house.rotation.y = Math.atan2(next.x - p.x, next.z - p.z);
        box.castShadow = roof.castShadow = true;
        this.group.add(house);
      }
      const length = pathLength(up);
      const n = Math.max(4, Math.floor(length / 28));
      this.lines.push({ lift, up, down, length, n, first: chairs });
      lift.path = rope;
      lift.length = Math.round(length);
      chairs += n * 2;
    }
    const chairGeo = chairGeometry();
    this.chairs = new THREE.InstancedMesh(chairGeo, new THREE.MeshLambertMaterial({ color: 0x6f7487 }), chairs);
    this.chairs.castShadow = true;
    this.group.add(this.chairs);
    this.update(0);
  }

  update(time) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
    for (const line of this.lines) {
      for (let k = 0; k < line.n; k++) {
        for (const [path, offset] of [[line.up, 0], [line.down, line.n]]) {
          const d = ((time * 4.5 + (k / line.n) * line.length) % line.length + line.length) % line.length;
          const [a, b, t] = at(path, d);
          p.copy(a).lerp(b, t);
          q.setFromAxisAngle(yAxis, Math.atan2(b.x - a.x, b.z - a.z));
          m.compose(p, q, s);
          this.chairs.setMatrixAt(line.first + offset + k, m);
        }
      }
    }
    this.chairs.instanceMatrix.needsUpdate = true;
  }
}

// One chair to carry the rider during a ride.
export function chairMesh() {
  const m = new THREE.Mesh(chairGeometry(), new THREE.MeshLambertMaterial({ color: 0x6f7487 }));
  m.castShadow = true;
  return m;
}

function chairGeometry() {
  const parts = [];
  const hanger = new THREE.BoxGeometry(0.08, 2.4, 0.08); hanger.translate(0, -1.2, 0); parts.push(hanger);
  const seat = new THREE.BoxGeometry(1.6, 0.08, 0.5); seat.translate(0, -2.4, 0.1); parts.push(seat);
  const back = new THREE.BoxGeometry(1.6, 0.5, 0.05); back.translate(0, -2.1, -0.15); parts.push(back);
  for (const g of parts) g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  return mergeGeometries(parts);
}

function densify(points, step) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const n = Math.max(1, Math.round(a.distanceTo(b) / step));
    for (let k = 1; k <= n; k++) out.push(a.clone().lerp(b, k / n));
  }
  return out;
}

function pathLength(path) {
  let s = 0;
  for (let i = 1; i < path.length; i++) s += path[i].distanceTo(path[i - 1]);
  return s;
}

export function at(path, d) {
  for (let i = 1; i < path.length; i++) {
    const seg = path[i].distanceTo(path[i - 1]);
    if (d <= seg) return [path[i - 1], path[i], seg ? d / seg : 0];
    d -= seg;
  }
  return [path[path.length - 2], path[path.length - 1], 1];
}
