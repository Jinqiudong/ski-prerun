// The resort's shared pieces: the terrain (heights, normals, baked sun shadows), the far ranges, where the
// woods are, run ribbons and the moving lifts.
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
    // Same triangles as mesh(): (a, a+gw, a+1) and (a+1, a+gw, a+gw+1), so riders sit exactly on the drawn snow.
    if (fr + fc <= 1) return h[k] + (h[k + 1] - h[k]) * fc + (h[k + gw] - h[k]) * fr;
    return h[k + gw + 1] + (h[k + gw] - h[k + gw + 1]) * (1 - fc) + (h[k + 1] - h[k + gw + 1]) * (1 - fr);
  }

  normalAt(x, z, out = new THREE.Vector3()) {
    const s = 5;
    return out.set(this.heightAt(x - s, z) - this.heightAt(x + s, z), 2 * s, this.heightAt(x, z - s) - this.heightAt(x, z + s)).normalize();
  }

  // 0 = in the sun, 1 = in a mountain's shadow (soft near the edge).
  sunShadow(x, z, y, dir = SUN_DIR) {
    if (dir.y <= 0.02) return 1; // sun at or below the horizon
    const dx = dir.x, dz = dir.z, horiz = Math.hypot(dx, dz) || 1e-6, rise = dir.y / horiz;
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

}

// The ranges around the resort (data/<resort>-far.json): coarse, sunk under the detailed resort terrain.
export function farTerrain(far, terrain) {
  const n = far.grid, H = far.half, raw = Uint8Array.from(atob(far.heights), (c) => c.charCodeAt(0)), q = new Uint16Array(raw.buffer);
  const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
  const at = (r, c) => q[r * n + c] * far.scale + far.offset;
  const snow = new THREE.Color(0xf4f6fa), forest = new THREE.Color(0x2c4a3c), rock = new THREE.Color(0x8b8580), c = new THREE.Color();
  const cell = (2 * H) / (n - 1), base = terrain.data.hmin;
  for (let r = 0; r < n; r++) {
    for (let j = 0; j < n; j++) {
      const x = -H + j * cell, z = -H + r * cell;
      let y = at(r, j);
      const inside = x > terrain.x0 + 200 && x < terrain.x1 - 200 && z > terrain.z0 + 200 && z < terrain.z1 - 200;
      if (inside) y -= 60; // hidden under the detailed terrain
      pos.set([x, y, z], (r * n + j) * 3);
      const dzx = (at(r, Math.min(n - 1, j + 1)) - at(r, Math.max(0, j - 1))) / (2 * cell);
      const dzz = (at(Math.min(n - 1, r + 1), j) - at(Math.max(0, r - 1), j)) / (2 * cell);
      const steep = Math.hypot(dzx, dzz), alt = y + base;
      // Winter: snow everywhere, dark forest belts below ~3450 m, rock on the steepest faces.
      const woods = Math.max(0, Math.min(1, (3450 - alt) / 250)) * (0.55 + 0.25 * Math.sin(x / 700 + Math.cos(z / 900) * 2));
      c.copy(snow).lerp(forest, woods * (steep < 0.9 ? 1 : 0.4));
      if (steep > 0.75) c.lerp(rock, Math.min(0.75, (steep - 0.75) * 1.5));
      col.set([c.r, c.g, c.b], (r * n + j) * 3);
    }
  }
  const idx = [];
  for (let r = 0; r < n - 1; r++) for (let j = 0; j < n - 1; j++) { const a = r * n + j; idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.name = "far";
  mesh.receiveShadow = false;
  return mesh;
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

function at(path, d) {
  for (let i = 1; i < path.length; i++) {
    const seg = path[i].distanceTo(path[i - 1]);
    if (d <= seg) return [path[i - 1], path[i], seg ? d / seg : 0];
    d -= seg;
  }
  return [path[path.length - 2], path[path.length - 1], 1];
}
