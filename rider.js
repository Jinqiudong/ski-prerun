// The rider: a skier or a snowboarder at real proportions, slope physics, tracks in the snow and spray.
import * as THREE from "three";

const lambert = (color) => new THREE.MeshLambertMaterial({ color });

export function riderModel(kind) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // leans and crouches
  root.add(body);
  const jacket = lambert(kind === "board" ? 0xd9643f : 0x2f6f8f), pants = lambert(0x2b2f3d), helmet = lambert(0xf6f6f6), dark = lambert(0x1d1f27);
  const goggles = new THREE.MeshLambertMaterial({ color: 0xff9a3c, emissive: 0x552200 });
  const limb = (r, len, mat) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), mat); m.castShadow = true; return m; };

  const legs = new THREE.Group();
  for (const side of [-1, 1]) {
    const leg = limb(0.11, 0.62, pants);
    leg.position.set(side * 0.13, 0.48, 0);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.32), dark);
    boot.position.set(side * 0.13, 0.1, 0.03);
    legs.add(leg, boot);
  }
  const torso = limb(0.2, 0.42, jacket);
  torso.position.y = 1.17;
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.14), lambert(0x3a4256));
  pack.position.set(0, 1.2, -0.2);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 10), lambert(0xf0c8a8));
  head.position.y = 1.62;
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), helmet);
  lid.position.y = 1.64;
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.06), goggles);
  lens.position.set(0, 1.63, 0.13);
  const arms = new THREE.Group();
  for (const side of [-1, 1]) {
    const arm = limb(0.065, 0.5, jacket);
    arm.position.set(side * 0.27, 1.12, 0.08);
    arm.rotation.set(-0.5, 0, side * 0.35);
    arms.add(arm);
  }
  for (const m of [head, lid, pack]) m.castShadow = true;
  body.add(legs, torso, pack, head, lid, lens, arms);

  if (kind === "board") {
    // Sideways stance, left foot forward: the body faces across the board.
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 1.55), lambert(0x2f7fe8));
    board.position.y = 0.02;
    board.castShadow = true;
    root.add(board);
    // Feet apart along the board: the body turns sideways, so its local x lies along the board.
    legs.children.forEach((m) => { m.position.x *= 2.1; });
    body.rotation.y = Math.PI / 2 - 0.25;
    arms.children.forEach((m, i) => { m.rotation.set(0, 0, (i ? 1 : -1) * 1.0); });
  } else {
    for (const side of [-1, 1]) {
      const ski = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 1.72), lambert(0xe2463d));
      ski.position.set(side * 0.13, 0.015, 0.05);
      ski.castShadow = true;
      root.add(ski);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.15), dark);
      pole.position.set(side * 0.42, 0.62, -0.05);
      pole.rotation.x = -0.45;
      body.add(pole);
    }
  }
  root.userData = { body, legs, kind };
  return root;
}

// Slope physics for one rider. Units: meters, seconds, radians. heading 0 = +z.
export class Rider {
  constructor(terrain, kind) {
    this.terrain = terrain;
    this.kind = kind;
    this.x = 0; this.z = 0; this.y = 0;
    this.heading = 0; this.speed = 0; this.steer = 0; this.lean = 0; this.edge = 0;
    this.n = new THREE.Vector3(0, 1, 0);
  }

  place(x, z, heading, speed = 2) {
    Object.assign(this, { x, z, heading, speed, steer: 0, lean: 0 });
    this.y = this.terrain.heightAt(x, z);
  }

  // input: steer -1..1 (right positive), brake, push; offPiste adds deep-snow drag.
  step(dt, { steer, brake, push, offPiste }) {
    const t = this.terrain, n = t.normalAt(this.x, this.z, this.n);
    const board = this.kind === "board";
    this.steer += (steer - this.steer) * Math.min(1, dt * (board ? 5 : 7));
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const drop = (n.x * fx + n.z * fz) / n.y; // meters of drop per meter of heading
    const along = (9.8 * drop) / Math.sqrt(1 + drop * drop);
    const mu = 0.045 + (brake ? 0.7 : 0) + (offPiste ? 0.1 : 0);
    let a = along - mu * 9.8 * n.y - 0.0032 * this.speed * this.speed - Math.abs(this.steer) * this.speed * 0.07;
    if (push && this.speed < (board ? 3.5 : 6.5) && along < 1) a += board ? 1.4 : 2.4;
    this.speed = Math.max(0, Math.min(30, this.speed + a * dt));
    if (this.speed < 0.4 && along < 0.25 && !push && Math.abs(steer) < 0.1) {
      // Stopped across the hill: swing back toward the fall line instead of getting stuck.
      const fall = Math.atan2(n.x, n.z);
      const diff = Math.atan2(Math.sin(fall - this.heading), Math.cos(fall - this.heading));
      this.heading += Math.sign(diff) * Math.min(Math.abs(diff), dt * 0.9);
    }
    const turn = (board ? 1.6 : 2.0) / (1 + this.speed / 16);
    this.heading -= this.steer * turn * dt;
    const horiz = this.speed / Math.sqrt(1 + drop * drop);
    this.x += Math.sin(this.heading) * horiz * dt;
    this.z += Math.cos(this.heading) * horiz * dt;
    this.x = Math.min(Math.max(this.x, t.x0 + 30), t.x1 - 30);
    this.z = Math.min(Math.max(this.z, t.z0 + 30), t.z1 - 30);
    this.y = t.heightAt(this.x, this.z);
    this.lean += (this.steer * Math.min(this.speed / 9, 1) * (board ? 0.55 : 0.4) - this.lean) * Math.min(1, dt * 6);
    this.braking = brake;
    return this;
  }

  pose(model) {
    const up = new THREE.Vector3(0, 1, 0);
    model.position.set(this.x, this.y + 0.05, this.z);
    model.quaternion.setFromUnitVectors(up, this.n);
    model.rotateY(this.heading);
    const { body, legs, kind } = model.userData;
    const crouch = this.braking ? 0.82 : 0.9 - Math.min(this.speed / 60, 0.1);
    legs.scale.y = crouch;
    if (kind === "board") {
      // Heel or toe edge: the whole rider tips into the turn; braking skids the board across.
      model.rotateY(this.braking ? 1.1 : 0.15 + Math.abs(this.steer) * 0.4);
      model.rotateZ(-this.lean * 0.6);
      body.position.y = crouch - 0.9;
    } else {
      model.rotateZ(-this.lean);
      body.rotation.x = 0.18 + (this.braking ? 0.1 : 0);
      body.position.y = crouch - 0.9;
    }
  }
}

// Tracks left in the snow behind the rider: one strip per ski, one wide strip for a board.
export class Tracks {
  constructor(scene, terrain, kind) {
    this.terrain = terrain;
    this.max = 600;
    this.points = [];
    this.strips = (kind === "board" ? [[0, 0.16]] : [[-0.13, 0.05], [0.13, 0.05]]).map(([offset, width]) => {
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
    this.n = 260;
    this.life = new Float32Array(this.n);
    this.vel = new Float32Array(this.n * 3);
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.n * 3).fill(-1e5);
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0.9, depthWrite: false }));
    this.points.frustumCulled = false;
    this.next = 0;
    scene.add(this.points);
  }

  emit(r, rate, dt) {
    const count = Math.floor(rate * dt + Math.random());
    for (let c = 0; c < count; c++) {
      const i = this.next = (this.next + 1) % this.n;
      const side = Math.sign(r.steer || 1);
      const sx = Math.cos(r.heading) * side, sz = -Math.sin(r.heading) * side;
      this.pos.set([r.x + (Math.random() - 0.5) * 0.4, r.y + 0.1, r.z + (Math.random() - 0.5) * 0.4], i * 3);
      this.vel.set([sx * (2 + Math.random() * 3) - Math.sin(r.heading) * r.speed * 0.2, 1.5 + Math.random() * 2.5, sz * (2 + Math.random() * 3) - Math.cos(r.heading) * r.speed * 0.2], i * 3);
      this.life[i] = 0.6 + Math.random() * 0.4;
    }
  }

  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -1e5; continue; }
      this.vel[i * 3 + 1] -= 9.8 * dt;
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
