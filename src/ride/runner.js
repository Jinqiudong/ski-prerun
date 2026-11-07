// The guide on its own four feet: one of the resort animals (assets/animals/3d/<name>.glb, rigged by
// tools/build_animals.py: spine, neck, head, tail, thigh and shin per leg) running ahead of you, never on a
// board, so it is never taken for a friend riding with you. All procedural: a bounding gallop whose strides
// lengthen as it goes faster (the body bobbing with a little float between strides, the tail streaming), leaning
// into turns and pitched with the slope; standing (breathing, tail swishing, looking about); a look back over its
// shoulder; a hop. Footfalls are reported, so the guide can leave paw prints and a puff of snow (guide.js).
// Its own copy of the file (not animal.js's shared one): a rider made from the same animal can come and go.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";

const loader = new GLTFLoader(), files = {};
const load = (a) => (files[a] ||= loader.loadAsync(`assets/animals/3d/${a}.glb?v=1`));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
// When in the stride each foot comes down (a rotary gallop: the front pair, then the hind pair half a stride on).
const LEGS = [["FL", 0, 1], ["FR", 0.1, 1], ["HL", 0.5, -1], ["HR", 0.6, -1]];

export class Runner {
  // animal: one of animal-core.js's; tall: how tall it stands, metres (a cartoon: bigger than life, to be seen).
  constructor(animal, tall) {
    this.root = new THREE.Group(); // at the ground, +z the way it runs
    this.body = new THREE.Group(); this.root.add(this.body);
    this.ready = load(animal).then((g) => this.build(g, tall));
    this.phase = 0; this.t = 0; this.hopT = -1; this.hops = 0; this.look = 0; this.lookWant = 0; this.lookFor = 0; this.side = 1;
  }
  build(g, tall) {
    const model = clone(g.scene); model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), s = tall / (box.max.y - box.min.y);
    model.scale.setScalar(s);
    const c = box.getCenter(new THREE.Vector3());
    model.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; for (const m of [].concat(o.material)) m.roughness = 0.9; } });
    this.body.add(model);
    this.len = (box.max.z - box.min.z) * s; this.tall = tall;
    // Each bone at rest, and the body's side axis (x) and up axis (y) in its parent's frame: turning a bone about
    // the side axis keeps that axis where it is for its children, so these hold however the legs swing.
    model.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(model.matrixWorld).invert(), q = new THREE.Quaternion();
    const bone = (n) => {
      const b = model.getObjectByName(n); if (!b) return null;
      b.parent.updateMatrixWorld(true);
      const pq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().multiplyMatrices(inv, b.parent.matrixWorld)).invert();
      return { b, rest: b.quaternion.clone(), x: new THREE.Vector3(1, 0, 0).applyQuaternion(pq).normalize(), y: new THREE.Vector3(0, 1, 0).applyQuaternion(pq).normalize(), q };
    };
    this.bones = {};
    for (const n of ["spine", "neck", "head", "tail", "tail2", ...LEGS.flatMap(([k]) => [`thigh${k}`, `shin${k}`])]) this.bones[n] = bone(n);
    this.feet = LEGS.map(([k, off, end]) => ({ k, off, end, x: (k[1] === "L" ? 1 : -1) * 0.18 * this.len, z: end * 0.3 * this.len, down: false }));
  }
  turn(n, ax, ang) { const B = this.bones[n]; if (B && ang) B.b.quaternion.premultiply(B.q.setFromAxisAngle(B[ax], ang)); }
  hop(n = 1) { this.hopT = 0; this.hops = n; }
  // Look back over the shoulder for a moment (side: +1 its left).
  lookBack(sec = 1.2, side = 1) { this.lookFor = sec; this.side = side; }
  // One frame. v: its speed (m/s); yawRate: how fast it turns (rad/s, + to its left); pitch: the slope under it
  // (+ nose down). Returns the feet that came down this frame: [{ x, z }] in its own frame (+z ahead).
  update(dt, { v = 0, yawRate = 0, pitch = 0 } = {}) {
    if (!this.bones) return [];
    this.t += dt;
    const B = this.bones;
    for (const k in B) if (B[k]) B[k].b.quaternion.copy(B[k].rest);
    const run = clamp(v / 4, 0, 1), fast = clamp(v / 14, 0, 1);
    // Longer strides when faster: about a body length at a lope, twice that flat out.
    const stride = this.len * (0.9 + 1.2 * fast);
    if (run > 0.02) this.phase = (this.phase + (Math.max(v, 1.2) / stride) * dt) % 1;
    const p = this.phase, w = (o) => Math.sin(TAU * (p + o));
    const a = run * (0.55 + 0.25 * fast);
    // the legs: thighs swing fore and aft, shins fold as the foot comes forward
    const fell = [];
    for (const f of this.feet) {
      this.turn(`thigh${f.k}`, "x", -a * w(f.off));
      this.turn(`shin${f.k}`, "x", f.end * a * 0.9 * Math.max(0, w(f.off + 0.25)));
      const down = run > 0.02 && w(f.off) < -0.2;
      if (down && !f.down) fell.push({ x: f.x, z: f.z + f.end * 0.15 * stride });
      f.down = down;
    }
    if (run < 0.02) for (const f of this.feet) f.down = false;
    // the back flexes, the head stays steady, the tail streams out behind and bobs
    const flex = a * 0.16 * w(0.25);
    this.turn("spine", "x", flex);
    this.turn("neck", "x", -flex * 0.8);
    const breath = Math.sin(this.t * 2.2);
    this.turn("tail", "x", -0.35 * run + (run > 0.02 ? 0.18 * w(0.4) : 0));
    this.turn("tail", "y", run > 0.02 ? 0 : 0.35 * Math.sin(this.t * 1.7));
    this.turn("tail2", "x", run > 0.02 ? 0.15 * w(0.6) : 0);
    // the head: looking back over the shoulder, or about when it stands
    if (this.lookFor > 0) { this.lookFor -= dt; this.lookWant = this.side * 1.25; }
    else this.lookWant = run > 0.02 ? 0 : 0.35 * Math.sin(this.t * 0.6);
    this.look += (this.lookWant - this.look) * Math.min(1, dt * 6);
    this.turn("neck", "y", this.look * 0.55);
    this.turn("head", "y", this.look * 0.45);
    this.turn("head", "x", run > 0.02 ? 0 : 0.04 * breath);
    // the body: up in the float between strides, rocking, into the turn, with the slope; a hop on top
    let up = run > 0.02 ? a * this.tall * 0.09 * Math.max(0, w(0.15)) : 0, tuck = 0;
    if (this.hopT >= 0) {
      this.hopT += dt; const f = this.hopT / 0.5;
      if (f >= 1) { if (--this.hops > 0) this.hopT = 0; else this.hopT = -1; }
      else { up += this.tall * 0.35 * 4 * f * (1 - f); tuck = Math.sin(f * Math.PI); }
    }
    if (tuck) for (const f of this.feet) { this.turn(`thigh${f.k}`, "x", -f.end * 0.5 * tuck); this.turn(`shin${f.k}`, "x", f.end * 0.8 * tuck); }
    this.body.position.y = up;
    this.body.rotation.set(clamp(pitch, -0.5, 0.5) * 0.7 + a * 0.06 * w(0.4), 0, clamp(Math.atan((v * yawRate) / 9.8), -0.45, 0.45) * -0.8);
    this.body.scale.set(1, 1 + (run < 0.02 ? 0.012 * breath : 0), 1);
    return fell;
  }
}
