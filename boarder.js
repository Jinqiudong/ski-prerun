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
  return { base, name: mine?.name || RIDERS[base].name, colors: mine?.colors || {}, stance: (st.stances || {})[mine?.id || base] === "goofy" ? "goofy" : "regular" };
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
  model.position.set(0, 0, 0); model.rotation.set(0, 0, 0); // it may have been built before (another stance)
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
  // The leading (left) foot to the nose, +z. A goofy rider is this rider's mirror image (not the same
  // rider turned round, which would be riding switch): poses are worked out as regular, then root is
  // mirrored across the way of travel (see `finish`), so the right foot leads and she looks to the nose.
  model.rotation.y = fl.x > fr.x ? -Math.PI / 2 : Math.PI / 2;
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
  const A = { stance: clip("Snowboard_Stance"), left: clip("Left_Turn"), right: clip("Right_Turn"), knee: clip("Knee_Bend"), stand: clip("Neutral_Standing") };
  const B = { spine: bone("Spine"), chest: bone("Chest"), neck: bone("Neck"), armL: bone("UpperArm.L"), armR: bone("UpperArm.R"),
    board: bone("Board"), hips: bone("Hips"), head: bone("Head"), thighL: bone("Thigh.L"), thighR: bone("Thigh.R"), shinL: bone("Shin.L"), shinR: bone("Shin.R"),
    footL: bone("Foot.L"), footR: bone("Foot.R"), foreL: bone("Forearm.L"), foreR: bone("Forearm.R") };
  const bones = []; model.traverse((o) => { if (o.isBone) bones.push(o); });
  // The leading foot (the one nearer the nose, +z): it stays strapped in on the chairlift.
  const lead = root.worldToLocal(B.footL.getWorldPosition(new THREE.Vector3())).z > 0 ? "L" : "R";
  const armZ = Math.sign(root.worldToLocal(B.armL.getWorldPosition(new THREE.Vector3())).z) || 1; // the left arm's end of the board
  root.userData = { kind: "board", goofy: me.stance === "goofy", yaw, lean, model, mixer, A, B, bones, lead, toeX, armZ, edgeX: [edges.min.x, edges.max.x], s: { edge: 0, skid: 0, knee: 0, fore: 0, tuck: 0 } };
  return root;
}

// The mixer only writes a bone when the blend changes, so put back its last output before our own turns
// go on top (or they would pile up frame after frame while a pose holds still).
function mix(u) {
  for (const b of u.bones) if (b.userData.mixed) { b.position.copy(b.userData.mixed.p); b.quaternion.copy(b.userData.mixed.q); }
  u.mixer.update(0);
  for (const b of u.bones) { const m = (b.userData.mixed ||= { p: new THREE.Vector3(), q: new THREE.Quaternion() }); m.p.copy(b.position); m.q.copy(b.quaternion); }
}
// Work every pose out unmirrored, then mirror a goofy rider (three.js flips the faces' winding for it).
const start = (root) => { root.scale.set(1, 1, 1); root.updateMatrixWorld(true); };
const finish = (root) => { root.scale.x = root.userData.goofy ? -1 : 1; root.updateMatrixWorld(true); };
const weights = (u, w) => { for (const [k, a] of Object.entries(u.A)) a.setEffectiveWeight(w[k] || 0); };

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
// side the toes point to, the heel edge otherwise. On top of that, as coaches teach it: on the toe side
// the upper body stays stacked upright over the toes; on the heel side the rider sinks lower (knee bend)
// with the chest upright over the hips and the shoulders opened toward the nose; either way the chest
// stays more upright than the legs (angulation) and the arms balance.
// To slow down the board swings across the way you move and the rider sits back onto the heel edge.
export function poseBoarder(root, r) {
  const u = root.userData, s = u.s, dt = r.dt || 0.016, tx = u.toeX, g = u.goofy ? -1 : 1;
  start(root);
  root.position.set(r.x, r.y, r.z);
  root.quaternion.setFromUnitVectors(Y, r.n);
  root.rotateY(r.heading);
  root.updateMatrixWorld(true);
  // Steer > 0 turns toward local -x, which is where a positive lean (rotation about +z) tilts the rider.
  // Goofy: posed as the mirror turn (g), then mirrored back.
  s.edge = damp(s.edge, Math.max(-0.9, Math.min(0.9, g * r.lean)), 8, dt);
  s.skid = damp(s.skid, r.skid ?? (r.braking ? 1 : 0), 5, dt);
  s.tuck = damp(s.tuck, r.tuck ?? 0, 4, dt);
  s.fore = damp(s.fore, Math.max(-1, Math.min(1, g * r.steer)) * 0.3, 4, dt); // weight forward into a turn
  const toe = Math.min(1, Math.max(0, -s.edge * tx) / 0.7), heel = Math.min(1, Math.max(0, s.edge * tx) / 0.7) + s.skid * 0.6;
  // Legs come from the clips only (bending them by hand bowed the knees): the knee bend deepens on the
  // heel side, in a skid and in a tuck. Toe- and heel-side clips from the model would do this properly.
  s.knee = damp(s.knee, Math.min(1, 0.25 + Math.min(1, heel) * 0.6 + toe * 0.3 + s.tuck * 0.5), 5, dt);
  const fwd = Math.max(0, s.fore), back = Math.max(0, -s.fore);
  weights(u, { right: fwd, left: back, knee: s.knee * (1 - fwd - back), stance: Math.max(0, 1 - fwd - back - s.knee * (1 - fwd - back)) });
  u.lean.position.set(0, 0, 0); u.lean.rotation.set(0, 0, 0); u.yaw.rotation.set(0, 0, 0); u.yaw.position.set(0, 0, 0); u.model.position.x = u.model.position.z = 0;
  mix(u);
  // Skid: the board swings so the toes face the way you are going and the heel edge trails uphill.
  u.yaw.rotation.y = -tx * 1.2 * s.skid;
  const tilt = s.edge * (1 - s.skid) - tx * 0.3 * s.skid; // about the board's long axis; + leans toward -x
  u.lean.rotation.z = tilt;
  u.lean.position.y = -Math.min(u.edgeX[0] * Math.sin(tilt), u.edgeX[1] * Math.sin(tilt)); // pivot on the edge in the snow, not under it
  u.lean.updateMatrixWorld(true);
  // Upper body: back toward upright (angulation); stacked over the hips on the heel side, a touch over
  // the toes on the toe side; shoulders open toward the nose on the heel side.
  turn(u.B.spine, u.lean, Z, -tilt * 0.22);
  turn(u.B.chest, u.lean, Z, -tilt * 0.18);
  turn(u.B.spine, u.lean, Z, -tx * (0.12 * toe + 0.16 * Math.min(1, heel) + 0.12 * s.tuck));
  turn(u.B.chest, u.lean, Y, -tx * 0.3 * Math.min(1, heel)); // the nose is always +z
  turn(u.B.head, u.lean, Y, -tx * 0.15 * (toe + heel));
  // Arms: out toward the nose and tail as the edge grows; on the heel side reaching forward over the toes.
  const arms = Math.min(1, Math.abs(tilt) * 1.2 + s.skid * 0.4) * 0.6;
  turn(u.B.armL, u.lean, X, -u.armZ * arms);
  turn(u.B.armR, u.lean, X, u.armZ * arms);
  turn(u.B.armL, u.lean, Z, tx * 0.35 * Math.min(1, heel));
  turn(u.B.armR, u.lean, Z, tx * 0.35 * Math.min(1, heel));
  finish(root);
}

// Riding the lift and getting off: the rider faces the way the chair goes (root +z), not the board.
// On the chair: seated, the leading foot still strapped in so the board hangs off it, the back foot free;
// hands on the lap; lookYaw turns the head (and a little of the chest). The hips land on `seat`, a point
// in root's frame. Off the chair: standing on the board, gliding down the ramp.
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _v = new THREE.Vector3();
function faceForward(u) {
  u.yaw.rotation.set(0, u.toeX < 0 ? Math.PI / 2 : -Math.PI / 2, 0); // chest (the toes' side) to +z
  u.lean.rotation.set(0, 0, 0); u.lean.position.set(0, 0, 0);
}
export function sitBoarder(root, lookYaw = 0, seat = new THREE.Vector3(0, 0.45, 0)) {
  const u = root.userData, B = u.B, tx = u.toeX, F = u.yaw; // F: the frame we turn bones in (board axes)
  start(root);
  if (u.goofy) { lookYaw = -lookYaw; seat = seat.clone(); seat.x = -seat.x; }
  faceForward(u);
  u.model.position.x = u.model.position.z = 0;
  weights(u, { stand: 1 });
  mix(u);
  root.updateMatrixWorld(true);
  const lead = u.lead === "L" ? B.footL : B.footR;
  // Where the board sits relative to the leading foot while standing: it keeps that when the leg moves.
  const rel = _m.copy(lead.matrixWorld).invert().multiply(B.board.matrixWorld);
  for (const [th, sh, ft] of [[B.thighL, B.shinL, B.footL], [B.thighR, B.shinR, B.footR]]) {
    turn(th, F, Z, tx * 1.45); // thighs forward along the seat
    turn(sh, F, Z, -tx * 1.45); // shins hang down
  }
  turn(B.spine, F, Z, -tx * 0.08); // sit back a touch
  turn(B.spine, F, Y, lookYaw * 0.25);
  turn(B.head, F, Y, Math.max(-1, Math.min(1, lookYaw * 0.75)));
  for (const [arm, fore, side] of [[B.armL, B.foreL, 1], [B.armR, B.foreR, -1]]) {
    turn(arm, F, Z, tx * 0.7); // arms forward, hands to the lap
    turn(fore, F, Z, tx * 0.9);
    turn(arm, F, X, u.armZ * side * 0.55); // in from the A-pose, toward the body
  }
  root.updateMatrixWorld(true);
  // Move the board to hang off the leading foot, keeping the hips (and so the legs) where they are.
  const hips = _m2.copy(B.hips.matrixWorld);
  const board = new THREE.Matrix4().multiplyMatrices(lead.matrixWorld, rel);
  B.board.matrix.copy(B.board.parent.matrixWorld).invert().multiply(board).decompose(B.board.position, B.board.quaternion, B.board.scale);
  B.board.updateMatrixWorld(true);
  B.hips.matrix.copy(B.board.matrixWorld).invert().multiply(hips).decompose(B.hips.position, B.hips.quaternion, B.hips.scale);
  root.updateMatrixWorld(true);
  // Hips onto the seat.
  const h = root.worldToLocal(B.hips.getWorldPosition(_v));
  u.model.position.x -= h.x - seat.x; u.model.position.z -= h.z - seat.z;
  u.yaw.position.y = seat.y - h.y;
  finish(root);
}
export function standBoarder(root) {
  const u = root.userData;
  faceForward(u); u.yaw.position.y = 0;
  u.yaw.rotation.y = 0; // gliding off: the board along the ramp
  u.model.position.x = u.model.position.z = 0;
  weights(u, { stance: 0.6, knee: 0.4 });
  start(root); mix(u); finish(root);
}
