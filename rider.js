// The rider: a skier or a snowboarder at real proportions, slope physics, tracks in the snow and spray.
import * as THREE from "three";

const lambert = (color) => new THREE.MeshLambertMaterial({ color });
const THIGH = 0.44, SHIN = 0.44;

// Hierarchy (root sits at the feet, local +z is the direction of travel):
//   root → yaw (board/skis skidding across) → gear (skis or board, tilts onto its edge)
//                                          → pivot (whole-body inclination into the turn)
//                                              → stance (ski: facing forward; board: chest to the toe side, +x)
//                                                  → legs (two segments each) and hips → upper body, arms, head
export function riderModel(kind) {
  const root = new THREE.Group(), yaw = new THREE.Group(), gear = new THREE.Group(), pivot = new THREE.Group(), stance = new THREE.Group();
  root.add(yaw);
  yaw.add(gear, pivot);
  pivot.add(stance);
  const board = kind === "board";
  const jacket = lambert(board ? 0xd9643f : 0x2f6f8f), pants = lambert(0x2b2f3d), dark = lambert(0x1d1f27);
  const limb = (r, len, mat) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), mat); m.castShadow = true; return m; };

  // Legs: hip joint → thigh → knee joint → shin → boot. Bending is set in pose().
  const footX = board ? 0.26 : 0.12;
  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    const thigh = limb(0.095, THIGH - 0.1, pants); thigh.position.y = -THIGH / 2;
    const knee = new THREE.Group(); knee.position.y = -THIGH;
    const shin = limb(0.08, SHIN - 0.08, pants); shin.position.y = -SHIN / 2;
    const ankle = new THREE.Group(); ankle.position.y = -SHIN;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.16, 0.3), dark); boot.position.set(0, -0.02, 0.04); boot.castShadow = true;
    ankle.add(boot); knee.add(shin, ankle); hip.add(thigh, knee);
    hip.position.x = side * footX;
    stance.add(hip);
    return { side, hip, knee, ankle };
  });

  const hips = new THREE.Group(); // upper body pivots here
  stance.add(hips);
  const torso = limb(0.19, 0.38, jacket); torso.position.y = 0.3;
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.13), lambert(0x3a4256)); pack.position.set(0, 0.34, -0.2); pack.castShadow = true;
  const neck = new THREE.Group(); neck.position.y = 0.66;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), lambert(0xf0c8a8)); head.position.y = 0.12;
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), lambert(0xf6f6f6)); lid.position.y = 0.14; lid.castShadow = true;
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.07, 0.06), new THREE.MeshLambertMaterial({ color: 0xff9a3c, emissive: 0x552200 })); lens.position.set(0, 0.13, 0.125);
  neck.add(head, lid, lens);
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group(); shoulder.position.set(side * 0.25, 0.5, 0.02);
    const arm = limb(0.06, 0.5, jacket); arm.position.y = -0.28;
    shoulder.add(arm);
    if (!board) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.15), dark);
      pole.position.set(0, -0.6, 0.05);
      shoulder.add(pole);
    }
    hips.add(shoulder);
    return { side, shoulder };
  });
  hips.add(torso, pack, neck);

  if (board) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 1.55), lambert(0x2f7fe8));
    deck.position.y = 0.02; deck.castShadow = true;
    gear.add(deck);
    stance.rotation.y = Math.PI / 2; // regular stance: chest to the toe edge (+x), left foot forward
  } else {
    gear.userData.skis = [-1, 1].map((side) => {
      const ski = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 1.72), lambert(0xe2463d));
      ski.position.set(side * footX, 0.015, 0.05); ski.castShadow = true;
      gear.add(ski);
      return ski;
    });
  }
  root.userData = { kind, yaw, gear, pivot, stance, hips, neck, legs, arms, t: 0 };
  return root;
}

const damp = (cur, target, rate, dt) => cur + (target - cur) * Math.min(1, dt * rate);

// Slope physics for one rider. Units: meters, seconds, radians. heading 0 = +z.
export class Rider {
  constructor(terrain, kind) {
    this.terrain = terrain;
    this.kind = kind;
    this.x = 0; this.z = 0; this.y = 0;
    this.heading = 0; this.speed = 0; this.steer = 0; this.lean = 0;
    this.n = new THREE.Vector3(0, 1, 0);
    this.anim = { crouch: 0.3, pitch: 0.15, skid: 0, counter: 0, plow: 0, push: 0, phase: 0 };
  }

  place(x, z, heading, speed = 2) {
    Object.assign(this, { x, z, heading, speed, steer: 0, lean: 0 });
    this.y = this.terrain.heightAt(x, z);
  }

  // input: steer -1..1 (right positive), brake, push; offPiste adds deep-snow drag.
  step(dt, { steer, brake, push, offPiste }) {
    const t = this.terrain, n = t.normalAt(this.x, this.z, this.n);
    const board = this.kind === "board";
    this.steer = damp(this.steer, steer, board ? 5 : 7, dt);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const drop = (n.x * fx + n.z * fz) / n.y; // meters of drop per meter along the heading; negative = uphill
    const along = (9.8 * drop) / Math.sqrt(1 + drop * drop);
    const mu = 0.045 + (brake ? 0.7 : 0) + (offPiste ? 0.1 : 0);
    let a = along - mu * 9.8 * n.y - 0.0032 * this.speed * this.speed - Math.abs(this.steer) * this.speed * 0.07;
    // Skating or one-foot pushing only works on the flat: it cannot beat gravity up a slope.
    this.pushing = push && this.speed < (board ? 3 : 5.5) && drop > -0.03;
    if (this.pushing) a += board ? 1.0 : 1.8;
    this.speed = Math.max(0, Math.min(30, this.speed + a * dt));
    if (this.speed < 0.5 && drop < 0.05 && !this.pushing) {
      // Stopped across or facing up the hill: turn back toward the fall line instead of standing still.
      const fall = Math.atan2(n.x, n.z);
      const diff = Math.atan2(Math.sin(fall - this.heading), Math.cos(fall - this.heading));
      this.heading += Math.sign(diff) * Math.min(Math.abs(diff), dt * 1.2);
    }
    const turn = (board ? 1.6 : 2.0) / (1 + this.speed / 16);
    this.heading -= this.steer * turn * dt;
    const horiz = this.speed / Math.sqrt(1 + drop * drop);
    this.x += Math.sin(this.heading) * horiz * dt;
    this.z += Math.cos(this.heading) * horiz * dt;
    this.x = Math.min(Math.max(this.x, t.x0 + 30), t.x1 - 30);
    this.z = Math.min(Math.max(this.z, t.z0 + 30), t.z1 - 30);
    this.y = t.heightAt(this.x, this.z);
    // Inclination into the turn grows with speed (balance against the turn's pull).
    this.lean = damp(this.lean, Math.atan((this.speed * this.speed * Math.abs(this.steer) * turn) / (9.8 * Math.max(this.speed, 1))) * Math.sign(this.steer), 6, dt);
    this.braking = brake;
    this.dt = dt;
    return this;
  }

  pose(model) {
    const u = model.userData, A = this.anim, dt = this.dt || 0.016, board = u.kind === "board";
    model.position.set(this.x, this.y + 0.03, this.z);
    model.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.n);
    model.rotateY(this.heading);
    const fast = this.speed > 14 && Math.abs(this.steer) < 0.25 && !this.braking;
    const carve = Math.min(Math.abs(this.steer) * this.speed / 10, 1);
    // Right turns (steer > 0) bend toward -x; for a regular snowboarder that is the heel edge.
    const heelside = this.steer > 0.05, toeside = this.steer < -0.05;
    const plow = !board && this.braking && this.speed < 6;
    const skid = this.braking && !plow ? 1 : 0;
    A.skid = damp(A.skid, skid, 5, dt);
    A.plow = damp(A.plow, plow ? 1 : 0, 6, dt);
    A.push = damp(A.push, this.pushing ? 1 : 0, 6, dt);
    A.phase += dt * (this.pushing ? 7 : 0);

    // Skidding stop: skis or board swing across the fall line, the upper body keeps facing down the hill.
    const across = (board ? 1.25 : 1.05) * A.skid;
    u.yaw.rotation.y = across;
    u.pivot.rotation.z = this.lean * (board ? 1 : 0.85) + (board ? 0.35 : 0.25) * A.skid;
    u.gear.rotation.z = (board ? 0 : this.lean * 0.4);

    let crouch, pitch;
    if (board) {
      // Heel side: sit back over the heels, arms forward. Toe side: knees and hips drive toward the toes.
      crouch = 0.35 + carve * 0.35 + A.skid * 0.2;
      pitch = heelside ? -0.25 - carve * 0.25 : toeside ? 0.35 + carve * 0.2 : 0.1;
      u.neck.rotation.y = damp(u.neck.rotation.y, -Math.PI / 2 + 0.25 + across * 0.6, 5, dt); // look where you are going
      u.hips.rotation.y = damp(u.hips.rotation.y, -0.35 + across * 0.3, 5, dt);
      for (const arm of u.arms) {
        arm.shoulder.rotation.x = damp(arm.shoulder.rotation.x, heelside ? -0.9 : toeside ? -0.2 : -0.4, 6, dt);
        arm.shoulder.rotation.z = damp(arm.shoulder.rotation.z, arm.side * (toeside ? 0.9 : 0.6), 6, dt);
      }
    } else {
      crouch = fast ? 0.85 : 0.3 + carve * 0.3 + A.plow * 0.15 + A.skid * 0.25;
      pitch = fast ? 0.75 : 0.2 + carve * 0.1;
      // Counter-rotation and angulation: the upper body stays facing down the fall line.
      u.hips.rotation.y = damp(u.hips.rotation.y, -across * 0.95 + this.steer * 0.25, 6, dt);
      u.hips.rotation.z = damp(u.hips.rotation.z, -this.lean * 0.5, 6, dt);
      u.neck.rotation.y = damp(u.neck.rotation.y, 0, 5, dt);
      for (const arm of u.arms) {
        const swing = A.push * Math.sin(A.phase + (arm.side > 0 ? 0 : Math.PI)) * 0.7;
        arm.shoulder.rotation.x = damp(arm.shoulder.rotation.x, fast ? -1.2 : -0.45 + swing, 8, dt);
        arm.shoulder.rotation.z = damp(arm.shoulder.rotation.z, arm.side * (fast ? 0.15 : 0.3), 8, dt);
      }
      // Snowplow: ski tips together, tails apart.
      gearSkis(u.gear, A.plow);
    }
    A.crouch = damp(A.crouch, crouch, 6, dt);
    A.pitch = damp(A.pitch, pitch, 6, dt);
    // Bend the knees: thigh forward, shin back, so the feet stay under the hips.
    const knee = 0.25 + A.crouch * 1.15;
    for (const leg of u.legs) {
      let k = knee, lift = 0;
      if (A.push > 0.01) {
        // Skating (skis) or pushing with the back foot (board): one leg works at a time.
        const w = Math.max(0, Math.sin(A.phase + (leg.side > 0 ? 0 : Math.PI)));
        k += w * 0.5 * A.push;
        lift = board && leg.side < 0 ? 0.12 * A.push : 0;
      }
      leg.hip.rotation.x = -k / 2 - (board ? 0 : A.pitch * 0.3);
      leg.knee.rotation.x = k;
      leg.ankle.rotation.x = -k / 2 + (board ? 0 : A.pitch * 0.3);
      leg.hip.position.y = 0.08 + (THIGH + SHIN) * Math.cos(knee / 2) + lift;
      leg.hip.position.z = board && leg.side < 0 ? -0.25 * A.push : 0;
    }
    u.hips.position.y = 0.08 + (THIGH + SHIN) * Math.cos(knee / 2);
    u.hips.rotation.x = A.pitch;
  }
}

function gearSkis(gear, plow) {
  for (const [i, ski] of gear.userData.skis.entries()) {
    const side = i ? 1 : -1;
    ski.rotation.y = -side * 0.32 * plow;
    ski.position.x = side * (0.12 + 0.18 * plow);
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
