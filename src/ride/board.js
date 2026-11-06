// Snowboard physics on the real slope, the track the board leaves in the snow, and the spray it kicks up.
// (Rider A, the model, and its poses are in src/rider/rider-a.js.)
import * as THREE from "three";

const damp = (cur, target, rate, dt) => cur + (target - cur) * Math.min(1, dt * rate);

// Slope physics for one rider. Units: meters, seconds, radians. heading 0 = +z.
export class Rider {
  constructor(terrain) {
    this.terrain = terrain;
    this.x = 0; this.z = 0; this.y = 0;
    this.heading = 0; this.speed = 0; this.steer = 0; this.lean = 0;
    this.n = new THREE.Vector3(0, 1, 0);
  }

  place(x, z, heading, speed = 2) {
    Object.assign(this, { x, z, heading, speed, steer: 0, lean: 0 });
    this.y = this.terrain.heightAt(x, z);
  }

  // input: steer -1..1 (right positive): how hard to edge into a turn. pace -1..1: -1 skids the board
  // across the way you are going to slow down, +1 tucks for speed (brake is pace -1). push: skate or
  // walk on the flat. offPiste adds deep-snow drag.
  // guided: the route does the steering, so don't swing round to the fall line when stopped.
  step(dt, { steer, pace = 0, brake, push, offPiste, guided }) {
    const t = this.terrain, n = t.normalAt(this.x, this.z, this.n);
    if (brake) pace = -1;
    this.steer = damp(this.steer, steer, 5, dt);
    this.pace = damp(this.pace ?? 0, pace, 4, dt);
    const skid = Math.max(0, -this.pace), tuck = Math.max(0, this.pace);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const drop = (n.x * fx + n.z * fz) / n.y; // meters of drop per meter along the heading; negative = uphill
    const along = (9.8 * drop) / Math.sqrt(1 + drop * drop);
    // The turn: the stick asks for a sideways pull of up to g·tan 50° from the edge. The rider has to
    // incline into it to balance (tan lean = pull / g), so a fast turn is a wide one and a slow one a pivot.
    const pull = Math.abs(this.steer) * 9.8 * Math.tan((50 * Math.PI) / 180) * (1 - 0.4 * skid);
    const rate = Math.min(1.6, pull / Math.max(this.speed, 2.5));
    // Snow friction grows as the base turns across the way you move (a skid); a tuck cuts the air drag.
    const mu = 0.045 + 0.65 * skid + (offPiste ? 0.1 : 0);
    let a = along - mu * 9.8 * n.y - 0.0032 * (1 - 0.4 * tuck) * this.speed * this.speed - (this.speed * rate * Math.abs(this.steer)) * 0.05;
    // Skating or one-foot pushing only works on the flat: it cannot beat gravity up a slope.
    // Only where gravity won't do it (a flat, at a crawl): going downhill you ride, both feet strapped in.
    this.pushing = push && this.speed < 3.4 && drop > -0.03 && drop < 0.04;
    if (this.pushing) a += 1.2;
    this.speed = Math.max(0, Math.min(30, this.speed + a * dt));
    // Up a short rise you don't slide: you skate up a gentle one (about 8 km/h) and walk a steep one.
    const climb = drop > -0.08 ? 2.2 : 1.2;
    this.walking = push && drop <= -0.03 && this.speed < climb;
    if (this.walking) this.speed = climb;
    if (this.speed < 0.5 && drop < 0.05 && !this.pushing && !guided) {
      // Stopped across or facing up the hill: turn back toward the fall line instead of standing still.
      const fall = Math.atan2(n.x, n.z);
      const diff = Math.atan2(Math.sin(fall - this.heading), Math.cos(fall - this.heading));
      this.heading += Math.sign(diff) * Math.min(Math.abs(diff), dt * 1.2);
    }
    this.heading -= Math.sign(this.steer) * rate * dt;
    const horiz = this.speed / Math.sqrt(1 + drop * drop);
    this.x += Math.sin(this.heading) * horiz * dt;
    this.z += Math.cos(this.heading) * horiz * dt;
    this.x = Math.min(Math.max(this.x, t.x0 + 30), t.x1 - 30);
    this.z = Math.min(Math.max(this.z, t.z0 + 30), t.z1 - 30);
    this.y = t.heightAt(this.x, this.z);
    // Inclination that balances the turn's pull: tan(lean) = speed · turn rate / g.
    this.lean = damp(this.lean, Math.atan((this.speed * rate) / 9.8) * Math.sign(this.steer), 6, dt);
    this.skid = skid; this.tuck = tuck;
    this.braking = skid > 0.35;
    this.dt = dt;
    return this;
  }
}

// The board's track in the snow behind the rider: one wide strip.
export class Tracks {
  constructor(scene, terrain) {
    this.terrain = terrain;
    this.max = 600;
    this.points = [];
    this.strips = [[0, 0.16]].map(([offset, width]) => {
      const pos = new Float32Array(this.max * 2 * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const idx = [];
      for (let i = 0; i < this.max - 1; i++) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      geo.setIndex(idx);
      geo.setDrawRange(0, 0);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xb9c0dc, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
      mesh.frustumCulled = false;
      scene.add(mesh);
      return { offset, width, pos, geo, mesh };
    });
  }

  clear() { this.points = []; for (const s of this.strips) s.geo.setDrawRange(0, 0); }

  dispose(scene) { for (const s of this.strips) { scene.remove(s.mesh); s.geo.dispose(); } }

  add(r) {
    const last = this.points[this.points.length - 1];
    if (last && Math.hypot(last.x - r.x, last.z - r.z) < 0.6) return;
    if (this.points.length === this.max) this.points.shift();
    this.points.push({ x: r.x, z: r.z, h: r.heading });
    const n = this.points.length;
    for (const s of this.strips) {
      for (let i = 0; i < n; i++) {
        const p = this.points[i], cx = Math.cos(p.h), sx = -Math.sin(p.h);
        for (const [k, w] of [[0, -s.width], [1, s.width]]) {
          const x = p.x + cx * (s.offset + w), z = p.z + sx * (s.offset + w);
          s.pos.set([x, this.terrain.heightAt(x, z) + 0.04, z], (i * 2 + k) * 3);
        }
      }
      s.geo.attributes.position.needsUpdate = true;
      s.geo.setDrawRange(0, Math.max(0, n - 1) * 6);
    }
  }
}

// Snow spray kicked up when carving hard or braking.
export class Spray {
  constructor(scene) {
    this.n = 900;
    this.life = new Float32Array(this.n);
    this.vel = new Float32Array(this.n * 3);
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.n * 3).fill(-1e5);
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    const dot = document.createElement("canvas");
    dot.width = dot.height = 32;
    // A soft dot drawn as an alpha map (white to black): no dark fringe around each puff on white snow.
    const g = dot.getContext("2d"), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "#fff"); grad.addColorStop(1, "#000");
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, alphaMap: new THREE.CanvasTexture(dot), transparent: true, opacity: 0.9, depthWrite: false }));
    this.points.frustumCulled = false;
    this.next = 0;
    scene.add(this.points);
  }

  // Snow leaves the edge toward the outside of the turn; in a skid it sprays ahead of the board, the way
  // you are sliding. Then it falls under gravity and air drag.
  emit(r, rate, dt) {
    const count = Math.min(80, Math.floor(rate * dt + Math.random()));
    const skid = r.skid || 0, fx = Math.sin(r.heading), fz = Math.cos(r.heading);
    for (let c = 0; c < count; c++) {
      const i = this.next = (this.next + 1) % this.n;
      const side = Math.sign(r.steer || 1);
      const sx = Math.cos(r.heading) * side, sz = -Math.sin(r.heading) * side;
      const out = 1.5 + Math.random() * 3, fwd = r.speed * (0.3 + skid * 0.5) * (0.6 + Math.random() * 0.6);
      this.pos.set([r.x + (Math.random() - 0.5) * 0.8, r.y + 0.08, r.z + (Math.random() - 0.5) * 0.8], i * 3);
      this.vel.set([sx * out * (1 - skid * 0.6) + fx * fwd + (Math.random() - 0.5) * 2, 1 + Math.random() * (2 + skid * 2.5), sz * out * (1 - skid * 0.6) + fz * fwd + (Math.random() - 0.5) * 2], i * 3);
      this.life[i] = 0.5 + Math.random() * (0.5 + skid * 0.5);
    }
  }

  update(dt) {
    const drag = Math.exp(-dt * 1.6);
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -1e5; continue; }
      this.vel[i * 3] *= drag; this.vel[i * 3 + 2] *= drag;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag - 9.8 * dt;
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
