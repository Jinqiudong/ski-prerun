// The rider: a skier or a snowboarder at real proportions, slope physics, tracks in the snow and spray.
import * as THREE from "three";

const lambert = (color) => new THREE.MeshLambertMaterial({ color });

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

// A semi-realistic person (assets/models/rider.glb, a humanoid rig) dressed for the snow and posed by bones.
let avatarGltf = null;
export async function loadAvatar() {
  if (!avatarGltf) avatarGltf = await new GLTFLoader().loadAsync("assets/models/rider.glb");
  return avatarGltf;
}

const OUTFIT = {
  ski: { top: 0x1f4f8f, bottom: 0x23262e, helmet: 0xf2f3f5 },
  board: { top: 0xd86a2e, bottom: 0x2b3340, helmet: 0x2a2d33 },
};

// Hierarchy (root sits at the feet, local +z is the direction of travel):
//   root → yaw (board/skis skidding across) → gear (skis or board, tilts onto its edge)
//                                          → pivot (whole-body inclination into the turn)
//                                              → stance (ski: facing forward; board: chest to the toe side, +x) → avatar
export function riderModel(kind) {
  const root = new THREE.Group(), yaw = new THREE.Group(), gear = new THREE.Group(), pivot = new THREE.Group(), stance = new THREE.Group();
  root.add(yaw);
  yaw.add(gear, pivot);
  pivot.add(stance);
  const board = kind === "board";
  const outfit = OUTFIT[kind];
  const avatar = SkeletonUtils.clone(avatarGltf.scene);
  const bones = {};
  avatar.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;
      const name = o.material.name || "";
      o.material = o.material.clone();
      if (name.includes("Outfit_Top")) o.material.color.set(outfit.top);
      if (name.includes("Outfit_Bottom")) o.material.color.set(outfit.bottom);
      if (name.includes("Headwear") || name.includes("Hair") || name.includes("Beard")) o.visible = false; // under the helmet
    }
  });
  stance.add(avatar);
  // Helmet and goggles ride on the head bone.
  const head = bones.Head;
  // Sized to the head (about 19 cm wide), not a cartoon bubble.
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.104, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), new THREE.MeshStandardMaterial({ color: outfit.helmet, roughness: 0.35 }));
  helmet.position.set(0, 0.105, -0.008);
  helmet.scale.set(0.98, 0.95, 1.1);
  const goggles = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.1, 4, 12), new THREE.MeshStandardMaterial({ color: 0xff8a3d, roughness: 0.12, metalness: 0.7, emissive: 0x2a1000 }));
  goggles.rotation.z = Math.PI / 2;
  goggles.position.set(0, 0.075, 0.088);
  goggles.scale.set(1, 1, 0.5);
  helmet.castShadow = true;
  head.add(helmet, goggles);

  if (board) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 1.55), new THREE.MeshStandardMaterial({ color: 0x2f7fe8, roughness: 0.4 }));
    deck.position.y = 0.035; deck.castShadow = true;
    gear.add(deck);
    stance.rotation.y = Math.PI / 2; // regular stance: chest to the toe edge (+x), left foot forward
  } else {
    gear.userData.skis = [-1, 1].map((side) => {
      const ski = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 1.72), new THREE.MeshStandardMaterial({ color: 0xe2463d, roughness: 0.4 }));
      ski.position.set(side * 0.11, 0.02, 0.05); ski.castShadow = true;
      gear.add(ski);
      return ski;
    });
    for (const side of ["Left", "Right"]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1.2), new THREE.MeshStandardMaterial({ color: 0x1d1f27 }));
      pole.position.set(0, -0.08, 0.02);
      pole.rotation.x = Math.PI / 2;
      bones[`${side}Hand`]?.add(pole);
    }
  }
  const rest = {};
  for (const [name, bone] of Object.entries(bones)) rest[name] = { q: bone.quaternion.clone(), p: bone.position.clone() };
  root.userData = { kind, yaw, gear, pivot, stance, avatar, bones, rest };
  return root;
}

const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _ax = new THREE.Vector3(), _ref = new THREE.Quaternion();
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
// Rotate a bone about an axis given in the avatar's own frame (x = its left, y = up, z = facing).
function turn(bone, axis, angle) {
  if (!bone || !angle) return;
  _ax.copy(AX[axis]).applyQuaternion(_ref);
  bone.parent.getWorldQuaternion(_pq);
  _ax.applyQuaternion(_pq.invert()).normalize();
  bone.quaternion.premultiply(_q.setFromAxisAngle(_ax, angle));
  bone.updateMatrixWorld(true);
}

// Pose by joint angles (radians). knee: bend; fwd: upper body forward; twist: upper body yaw;
// armsOut/armsFwd/elbow; headYaw; spread: legs apart; sit: seated on a chair.
export function applyPose(model, p) {
  const { bones: b, rest, avatar } = model.userData;
  for (const [name, r] of Object.entries(rest)) { b[name].quaternion.copy(r.q); b[name].position.copy(r.p); }
  avatar.updateMatrixWorld(true);
  avatar.parent.getWorldQuaternion(_ref); // the rider's frame: y up, z facing (the glTF root itself is rotated)
  const knee = p.sit ? 1.5 : p.knee, hip = p.sit ? 1.5 : knee * 0.55;
  b.Hips.position.y = rest.Hips.p.y - (p.sit ? 0.45 : 0.9 * (1 - Math.cos(knee * 0.5)) + 0.02);
  turn(b.Spine, "x", p.fwd * 0.5); turn(b.Spine1, "x", p.fwd * 0.3); turn(b.Spine2, "x", p.fwd * 0.2);
  turn(b.Spine, "y", p.twist * 0.6); turn(b.Spine2, "y", p.twist * 0.4);
  turn(b.Spine, "z", p.side || 0);
  for (const [side, s] of [["Left", 1], ["Right", -1]]) {
    const leg = (p.legs && p.legs[side]) || 0;
    turn(b[`${side}UpLeg`], "z", s * (p.spread || 0.05));
    turn(b[`${side}UpLeg`], "x", -(hip + leg));
    turn(b[`${side}Leg`], "x", knee + leg * 1.5);
    turn(b[`${side}Foot`], "x", p.sit ? -0.2 : -(knee - hip) - leg * 0.5);
    // The rest pose already hangs the arms ~55° down: armsOut lifts them away from the body.
    turn(b[`${side}Arm`], "z", s * (p.armsOut || 0));
    turn(b[`${side}Arm`], "y", -s * p.armsFwd);
    turn(b[`${side}ForeArm`], "y", -s * (p.elbow ?? 0.3));
  }
  turn(b.Neck, "x", -p.fwd * 0.45);
  turn(b.Head, "y", p.headYaw || 0);
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

  // input: steer -1..1 (right positive): how hard to edge into a turn. pace -1..1: -1 skids the board or
  // skis across the way you are going to slow down, +1 tucks for speed (brake is pace -1). push: skate or
  // walk on the flat. offPiste adds deep-snow drag.
  step(dt, { steer, pace = 0, brake, push, offPiste }) {
    const t = this.terrain, n = t.normalAt(this.x, this.z, this.n);
    const board = this.kind === "board";
    if (brake) pace = -1;
    this.steer = damp(this.steer, steer, board ? 5 : 7, dt);
    this.pace = damp(this.pace ?? 0, pace, 4, dt);
    const skid = Math.max(0, -this.pace), tuck = Math.max(0, this.pace);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const drop = (n.x * fx + n.z * fz) / n.y; // meters of drop per meter along the heading; negative = uphill
    const along = (9.8 * drop) / Math.sqrt(1 + drop * drop);
    // The turn: the stick asks for a sideways pull of up to g·tan 50° from the edge. The rider has to
    // incline into it to balance (tan lean = pull / g), so a fast turn is a wide one and a slow one a pivot.
    const pull = Math.abs(this.steer) * 9.8 * Math.tan((50 * Math.PI) / 180) * (1 - 0.4 * skid);
    const rate = Math.min(board ? 1.6 : 2.0, pull / Math.max(this.speed, 2.5));
    // Snow friction grows as the base turns across the way you move (a skid); a tuck cuts the air drag.
    const mu = 0.045 + 0.65 * skid + (offPiste ? 0.1 : 0);
    let a = along - mu * 9.8 * n.y - 0.0032 * (1 - 0.4 * tuck) * this.speed * this.speed - (this.speed * rate * Math.abs(this.steer)) * 0.05;
    // Skating or one-foot pushing only works on the flat: it cannot beat gravity up a slope.
    this.pushing = push && this.speed < (board ? 3 : 5.5) && drop > -0.03;
    if (this.pushing) a += board ? 1.0 : 1.8;
    this.speed = Math.max(0, Math.min(30, this.speed + a * dt));
    // Up a short rise you don't slide: you walk (or side-step) it at walking pace.
    this.walking = push && drop <= -0.03 && this.speed < 1.2;
    if (this.walking) this.speed = 1.2;
    if (this.speed < 0.5 && drop < 0.05 && !this.pushing) {
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

  pose(model) {
    const u = model.userData, A = this.anim, dt = this.dt || 0.016, board = u.kind === "board";
    model.position.set(this.x, this.y + 0.01, this.z);
    model.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.n);
    model.rotateY(this.heading);
    if (board) u.stance.rotation.y = Math.PI / 2;
    const fast = this.speed > 14 && Math.abs(this.steer) < 0.25 && !this.braking;
    const carve = Math.min(Math.abs(this.steer) * this.speed / 10, 1);
    // Right turns (steer > 0) bend toward -x; for a regular snowboarder that is the heel edge.
    const heelside = this.steer > 0.05, toeside = this.steer < -0.05;
    const plow = !board && this.braking && this.speed < 6;
    A.skid = damp(A.skid, this.braking && !plow ? 1 : 0, 5, dt);
    A.plow = damp(A.plow, plow ? 1 : 0, 6, dt);
    A.push = damp(A.push, this.pushing ? 1 : 0, 6, dt);
    A.phase += dt * (this.pushing ? 7 : 0);
    // Inclination is capped: real riders angulate at the hips instead of lying on the snow.
    const lean = Math.max(-0.55, Math.min(0.55, this.lean));
    const across = (board ? 1.25 : 1.05) * A.skid;
    u.yaw.rotation.y = across;
    u.pivot.rotation.z = lean * (board ? 0.9 : 0.7) + (board ? 0.25 : 0.18) * A.skid;
    u.gear.rotation.z = board ? 0 : lean * 0.35;
    const pose = { spread: board ? 0.26 : 0.06, legs: {} };
    if (board) {
      // Heel side: sit back over the heels, arms forward. Toe side: knees and hips toward the toes.
      A.crouch = damp(A.crouch, 0.95 + carve * 0.4 + A.skid * 0.3, 6, dt);
      A.pitch = damp(A.pitch, heelside ? -0.1 - carve * 0.15 : toeside ? 0.35 + carve * 0.25 : 0.2, 6, dt);
      Object.assign(pose, { knee: A.crouch, fwd: A.pitch, twist: -0.35 - across * 0.3, armsOut: heelside ? 0.5 : 0.75, armsFwd: heelside ? 0.6 : 0.2, elbow: 0.35, headYaw: -1.1 });
      if (A.push > 0.01) pose.legs.Right = Math.max(0, Math.sin(A.phase)) * 0.5 * A.push; // back foot pushes
    } else {
      A.crouch = damp(A.crouch, fast ? 1.45 : 0.8 + carve * 0.4 + A.plow * 0.2 + A.skid * 0.35, 6, dt);
      A.pitch = damp(A.pitch, fast ? 0.85 : 0.35 + carve * 0.1, 6, dt);
      // Counter-rotation and angulation: the upper body faces down the fall line, hips drop inside the turn.
      Object.assign(pose, { knee: A.crouch, fwd: A.pitch, twist: -across * 0.9 + this.steer * 0.3, side: -lean * 0.6, armsOut: fast ? 0.1 : 0.35, armsFwd: fast ? 1.0 : 0.55, elbow: fast ? 0.9 : 0.6, headYaw: across * 0.6 });
      pose.spread = 0.06 + A.plow * 0.12;
      if (A.push > 0.01) for (const [side, ph] of [["Left", 0], ["Right", Math.PI]]) pose.legs[side] = Math.max(0, Math.sin(A.phase + ph)) * 0.45 * A.push;
      gearSkis(u.gear, A.plow);
    }
    applyPose(model, pose);
  }
}

function gearSkis(gear, plow) {
  for (const [i, ski] of gear.userData.skis.entries()) {
    const side = i ? 1 : -1;
    ski.rotation.y = -side * 0.32 * plow;
    ski.position.x = side * (0.11 + 0.14 * plow);
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
    this.n = 900;
    this.life = new Float32Array(this.n);
    this.vel = new Float32Array(this.n * 3);
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.n * 3).fill(-1e5);
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    const dot = document.createElement("canvas");
    dot.width = dot.height = 32;
    const g = dot.getContext("2d"), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, map: new THREE.CanvasTexture(dot), transparent: true, opacity: 0.9, depthWrite: false }));
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
