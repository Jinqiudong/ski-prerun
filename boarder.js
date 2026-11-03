// Rider A, the owner's snowboarder: a rigged model with six in-place clips (stance, knee bend, left and
// right turn, ...). Each clip goes from the base pose to its peak and back; we hold clips at their peak
// and blend them by how the rider is steering, braking and crouching. The jacket's corrective morph is
// animated in the same clips, so the mixer drives bones and morph together.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

// The riders you can pick. Each part you can recolour lists its materials; `trim` materials (seams, zip
// tape) follow the part's colour a shade darker. More riders (men's and women's) get added here.
export const RIDERS = {
  rider_a: {
    // Claude's rebuild (2026-11-03): same rig, clips and axes as the first cut, one skinned mesh.
    name: "Rider A", file: "assets/riders/rider_a_claude.glb",
    hide: /Jacket_chest_logo|Pants_back_ellipse/, // the owner wants no logos on the jacket or pants
    parts: {
      jacket: { mats: ["V02_JACKET_new_photo_gray_olive"], trim: ["V02_olive_stitch", "V02_zip_tape_olive_charcoal", "RAC_zip_tape_olive_dark", "RAC_seam_shadow"], color: "#525942" },
      pants: { mats: ["V02_PANTS_ivory_shell", "V02_PANTS_ivory_shell.001"], color: "#c5bcaa" },
      helmet: { mats: ["Helmet matte charcoal"], color: "#272729" },
      lens: { mats: ["RAC_lens_blue_violet_mirror", "MVP_pink_purple_mirrored_lens"], color: "#95a2f9" },
    },
  },
};
export const PART_ZH = { jacket: "外套", pants: "雪裤", helmet: "头盔", lens: "雪镜" };

// The rider saved on this phone (see start.html): { base, name, colors }. Falls back to Rider A as made.
export function myRider() {
  let st = {};
  try { st = JSON.parse(localStorage.getItem("prerun") || "{}"); } catch { /* fresh */ }
  const mine = (st.riders || []).find((r) => r.id === st.rider);
  const base = RIDERS[mine?.base] ? mine.base : RIDERS[st.rider] ? st.rider : "rider_a";
  return { base, name: mine?.name || RIDERS[base].name, colors: mine?.colors || {} };
}

const gltfs = {};
let gltf = null;
export async function loadBoarder(url) {
  const base = myRider().base;
  url ||= (location.pathname.includes("/mountain/") ? "../" : "") + RIDERS[base].file;
  if (!gltfs[url]) {
    const draco = new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/");
    gltfs[url] = new GLTFLoader().setDRACOLoader(draco).loadAsync(url);
  }
  gltf = await gltfs[url];
  return gltf;
}

// Recolour a loaded rider: { jacket: "#hex", ... }; parts left out go back to how the model was made.
export function dressRider(scene, base, colors = {}) {
  const def = RIDERS[base] || RIDERS.rider_a, byName = new Map();
  scene.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) byName.set(m.name, m); });
  for (const [part, p] of Object.entries(def.parts)) {
    const c = new THREE.Color(colors[part] || p.color);
    for (const n of p.mats) byName.get(n)?.color.copy(c);
    const dark = c.clone().multiplyScalar(0.72);
    for (const n of p.trim || []) byName.get(n)?.color.copy(dark);
  }
  if (def.hide) scene.traverse((o) => { if (o.isMesh && [].concat(o.material).some((m) => def.hide.test(m.name))) o.visible = false; });
}

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

// root sits at the board's base with local +z the direction of travel, like rider.js's models:
//   root → yaw (board skidding across) → lean (board on its edge, rider inclined into the turn) → model
export function boarderModel() {
  const root = new THREE.Group(), yaw = new THREE.Group(), lean = new THREE.Group();
  const model = gltf.scene; // one rider on the mountain, so no clone
  const me = myRider();
  dressRider(model, me.base, me.colors);
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
  root.updateMatrixWorld(true);
  // Which side the toes point to (+1: +x, -1: -x): the foot bones run heel to toe.
  // Where the board's edges are (across it, in the rider's frame), measured on the model: the board pivots
  // on whichever edge is in the snow.
  const edges = new THREE.Box3();
  model.traverse((o) => { if (o.isMesh && /Snowboard/i.test([].concat(o.material)[0].name)) edges.expandByObject(o, true); });
  if (edges.isEmpty()) edges.min.x = -(edges.max.x = 0.13);
  const toes = new THREE.Vector3(0, 1, 0).applyQuaternion(bone("Foot.L").getWorldQuaternion(new THREE.Quaternion()));
  const toeX = Math.sign(root.worldToLocal(toes.add(root.getWorldPosition(new THREE.Vector3()))).x) || 1;
  const mixer = new THREE.AnimationMixer(model);
  const clip = (n) => {
    const c = gltf.animations.find((a) => a.name === n);
    const a = mixer.clipAction(c);
    a.play(); a.paused = true; a.time = c.duration / 2; a.setEffectiveWeight(0); // held at its peak
    return a;
  };
  // Left_Turn and Right_Turn shift the weight toward the nose or the tail; Knee_Bend sinks the hips.
  const A = { stance: clip("Snowboard_Stance"), left: clip("Left_Turn"), right: clip("Right_Turn"), knee: clip("Knee_Bend") };
  const B = { spine: bone("Spine"), chest: bone("Chest"), neck: bone("Neck"), armL: bone("UpperArm.L"), armR: bone("UpperArm.R") };
  const armZ = Math.sign(root.worldToLocal(B.armL.getWorldPosition(new THREE.Vector3())).z) || 1; // the left arm's end of the board
  root.userData = { kind: "board", yaw, lean, model, mixer, A, B, toeX, armZ, edgeX: [edges.min.x, edges.max.x], s: { edge: 0, skid: 0, knee: 0, fore: 0, tuck: 0 } };
  return root;
}

const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _ax = new THREE.Vector3();
// Rotate a bone about an axis given in `frame`'s space (after the mixer has set its pose).
function turn(bone, frame, axis, angle) {
  if (!bone || !angle) return;
  _ax.copy(axis).transformDirection(frame.matrixWorld);
  bone.parent.getWorldQuaternion(_pq);
  _ax.applyQuaternion(_pq.invert()).normalize();
  bone.quaternion.premultiply(_q.setFromAxisAngle(_ax, angle));
  bone.updateMatrixWorld(true);
}
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

// Pose from the physics state (rider.js's Rider). The whole rider and board incline into the turn by the
// angle that balances it, so the board rides its inside edge: the toe edge when the turn's inside is the
// side the toes point to, the heel edge otherwise. To slow down the board swings across the way you move
// and the rider sits back onto the heel edge, uphill. The legs come from the clips (so the feet stay on
// the bindings); the upper body angulates (stays more upright than the legs) and the arms balance.
export function poseBoarder(root, r) {
  const u = root.userData, s = u.s, dt = r.dt || 0.016, tx = u.toeX;
  root.position.set(r.x, r.y, r.z);
  root.quaternion.setFromUnitVectors(Y, r.n);
  root.rotateY(r.heading);
  // Steer > 0 turns toward local -x, which is where a positive lean (rotation about +z) tilts the rider.
  s.edge = damp(s.edge, Math.max(-0.9, Math.min(0.9, r.lean)), 8, dt);
  s.skid = damp(s.skid, r.skid ?? (r.braking ? 1 : 0), 5, dt);
  s.tuck = damp(s.tuck, r.tuck ?? 0, 4, dt);
  s.fore = damp(s.fore, Math.max(-1, Math.min(1, r.steer)) * 0.35, 4, dt); // weight forward into a turn
  const toeSide = Math.max(0, -s.edge * tx), heelSide = Math.max(0, s.edge * tx); // 0..0.9 rad
  s.knee = damp(s.knee, Math.min(1, 0.25 + heelSide * 0.9 + toeSide * 0.4 + s.skid * 0.5 + s.tuck * 0.6), 5, dt);
  const fwd = Math.max(0, s.fore), back = Math.max(0, -s.fore);
  u.A.right.setEffectiveWeight(fwd);
  u.A.left.setEffectiveWeight(back);
  u.A.knee.setEffectiveWeight(s.knee * (1 - fwd - back));
  u.A.stance.setEffectiveWeight(Math.max(0, 1 - fwd - back - s.knee * (1 - fwd - back)));
  // The mixer only writes a bone when the blend changes, so put back its last output before our own
  // turns go on top (or they would pile up frame after frame while the pose holds still).
  for (const b of Object.values(u.B)) if (b.userData.mixed) b.quaternion.copy(b.userData.mixed);
  u.mixer.update(0);
  for (const b of Object.values(u.B)) (b.userData.mixed ||= new THREE.Quaternion()).copy(b.quaternion);
  // Skid: the board swings so the toes face the way you are going and the heel edge trails uphill.
  u.yaw.rotation.y = -tx * 1.2 * s.skid;
  const tilt = s.edge * (1 - s.skid) - tx * 0.3 * s.skid; // about the board's long axis; + leans toward -x
  u.lean.rotation.z = tilt;
  u.lean.position.y = -Math.min(u.edgeX[0] * Math.sin(tilt), u.edgeX[1] * Math.sin(tilt)); // pivot on the edge in the snow, not under it
  u.lean.updateMatrixWorld(true);
  // Angulation: the chest comes back toward upright by about a third of the inclination.
  turn(u.B.spine, u.lean, Z, -tilt * 0.2);
  turn(u.B.chest, u.lean, Z, -tilt * 0.15);
  // Toe side: chest over the toes. Heel side: sit back, chest a little forward to stay over the board.
  turn(u.B.spine, u.lean, Z, -tx * (toeSide * 0.25 + s.tuck * 0.15));
  // Arms out toward the nose and the tail for balance as the edge grows.
  const arms = Math.min(1, Math.abs(tilt) * 1.2 + s.skid * 0.4) * 0.6;
  turn(u.B.armL, u.lean, X, -u.armZ * arms);
  turn(u.B.armR, u.lean, X, u.armZ * arms);
}
