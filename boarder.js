// Rider A, the owner's snowboarder: a rigged model with six in-place clips (stance, knee bend, left and
// right turn, ...). Each clip goes from the base pose to its peak and back; we hold clips at their peak
// and blend them by how the rider is steering, braking and crouching. The jacket's corrective morph is
// animated in the same clips, so the mixer drives bones and morph together.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

let gltf = null;
export async function loadBoarder(url = "assets/riders/rider_a.glb") {
  if (!gltf) {
    const draco = new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/");
    gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(url);
  }
  return gltf;
}

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

// root sits at the board's base with local +z the direction of travel, like rider.js's models:
//   root → yaw (board skidding across) → lean (inclination into the turn) → model
export function boarderModel() {
  const root = new THREE.Group(), yaw = new THREE.Group(), lean = new THREE.Group();
  const model = gltf.scene; // one rider on the mountain, so no clone
  root.add(yaw); yaw.add(lean); lean.add(model);
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  // The board runs along the model's x axis; the leading foot's end is the nose. Turn that to +z.
  model.updateMatrixWorld(true);
  const bone = (n) => model.getObjectByName(n) || model.getObjectByName(n.replace(".", "")); // the loader drops the dot
  const fl = bone("Foot.L").getWorldPosition(new THREE.Vector3());
  const fr = bone("Foot.R").getWorldPosition(new THREE.Vector3());
  const box = new THREE.Box3().setFromObject(model);
  model.rotation.y = fl.x > fr.x ? -Math.PI / 2 : Math.PI / 2; // regular (left foot first) or goofy
  model.position.y = -box.min.y;
  const mixer = new THREE.AnimationMixer(model);
  const clip = (n) => {
    const c = gltf.animations.find((a) => a.name === n);
    const a = mixer.clipAction(c);
    a.play(); a.paused = true; a.time = c.duration / 2; a.setEffectiveWeight(0); // held at its peak
    return a;
  };
  const A = { stance: clip("Snowboard_Stance"), left: clip("Left_Turn"), right: clip("Right_Turn"), knee: clip("Knee_Bend") };
  root.userData = { kind: "board", yaw, lean, model, mixer, A, s: { turn: 0, knee: 0, skid: 0, lean: 0 } };
  return root;
}

// Pose from the physics state (rider.js's Rider), like Rider.pose does for the built-in models.
export function poseBoarder(root, r) {
  const u = root.userData, s = u.s, dt = r.dt || 0.016;
  root.position.set(r.x, r.y + 0.01, r.z);
  root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), r.n);
  root.rotateY(r.heading);
  // Steer > 0 turns right. The turn clips are weight shifts, so they follow the steering input.
  s.turn = damp(s.turn, Math.max(-1, Math.min(1, r.steer * 1.4)), 6, dt);
  s.skid = damp(s.skid, r.braking ? 1 : 0, 5, dt);
  s.knee = damp(s.knee, Math.min(1, 0.25 + s.skid * 0.5 + Math.abs(s.turn) * 0.3 + (r.speed > 14 ? 0.3 : 0)), 5, dt);
  s.lean = damp(s.lean, Math.max(-0.45, Math.min(0.45, r.lean)), 6, dt);
  const right = Math.max(0, s.turn), left = Math.max(0, -s.turn);
  u.A.right.setEffectiveWeight(right);
  u.A.left.setEffectiveWeight(left);
  u.A.knee.setEffectiveWeight(s.knee * (1 - right - left) * 0.8);
  u.A.stance.setEffectiveWeight(Math.max(0, 1 - right - left - s.knee * 0.8));
  u.mixer.update(0);
  u.yaw.rotation.y = 1.1 * s.skid; // braking: board slides across the fall line
  u.lean.rotation.z = s.lean * 0.8;
}
