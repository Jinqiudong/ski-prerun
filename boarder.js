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
    // v2, fourth pass: joint spec, per-frame IK solve, 39 clips. ?v= changes when the file does (phones cache it).
    name: "Rider A", file: "assets/riders/rider_a_v2.glb?v=4",
    hide: /Jacket_chest_logo|Pants_back_ellipse/, // the owner wants no logos on the jacket or pants
    parts: {
      jacket: { mats: ["V02_JACKET_new_photo_gray_olive"], trim: ["V02_olive_stitch", "V02_zip_tape_olive_charcoal", "RAC_zip_tape_olive_dark", "RAC_seam_shadow"], color: "#525942" },
      pants: { mats: ["V02_PANTS_ivory_shell", "V02_PANTS_ivory_shell.001"], color: "#c5bcaa" },
      helmet: { mats: ["Helmet matte charcoal"], color: "#272729" },
      lens: { mats: ["RAC_lens_blue_violet_mirror", "MVP_pink_purple_mirrored_lens"], color: "#95a2f9" },
      // The mittens are painted in vertex colours: recolouring them drops those for a plain colour.
      gloves: { mats: ["RAC_mitten_vcol"], color: "#d8cfb8", vcol: true },
      boots: { mats: ["V02_BOOT_white_textile", "V02_BOOT_white_rubber"], color: "#c6c9c5" },
    },
  },
};
export const PART_ZH = { jacket: "外套", pants: "雪裤", helmet: "头盔", lens: "雪镜", gloves: "手套", boots: "雪鞋" };
// Outfit templates for Rider A: pick one to wear, or start from one and save your own. For now these are
// colourways of the one model; the owner is modelling four preset outfits (on a man's and a woman's base)
// that will take their place.
export const OUTFITS = { // ch: the character template preset each is (character.js); colours are its parts', for the ride
  o_pine: { zh: "松林", en: "Pine", ch: "A", colors: { jacket: "#525a42", pants: "#c9bfac", helmet: "#2b2b2e", lens: "#4d5ce0", gloves: "#e3dccb", boots: "#1d1d20" } },
  o_night: { zh: "夜航", en: "Night Flight", ch: "B", colors: { jacket: "#18181b", pants: "#1a1a1d", helmet: "#151517", lens: "#4d5ce0", gloves: "#1b1b1d", boots: "#8fb8e6" } },
  o_wine: { zh: "热红酒", en: "Mulled Wine", ch: "C", colors: { jacket: "#e0157f", pants: "#d61a7b", helmet: "#1b1b1e", lens: "#1d1d22", gloves: "#d8cdb3", boots: "#3e4046" } },
  o_glacier: { zh: "冰川", en: "Glacier", ch: "D", colors: { jacket: "#e6e9ec", pants: "#151517", helmet: "#d6c8a0", lens: "#ff7a1a", gloves: "#1b1b1d", boots: "#5fa2e3" } },
};

// The rider saved on this phone (see start.html): { base, name, colors }. Falls back to Rider A as made.
export function myRider() {
  let st = {};
  try { st = JSON.parse(localStorage.getItem("prerun") || "{}"); } catch { /* fresh */ }
  const mine = (st.riders || []).find((r) => r.id === st.rider), outfit = OUTFITS[st.rider];
  const base = RIDERS[mine?.base] ? mine.base : "rider_a", id = mine?.id || (outfit ? st.rider : "o_pine");
  const stance = (st.stances || {})[id] ?? (st.stances || {})[base];
  return { base, name: mine?.name || outfit?.zh || RIDERS[base].name, colors: mine?.colors || outfit?.colors || {}, stance: stance === "goofy" ? "goofy" : "regular" };
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
    if (p.vcol) { // as made (its own painted colours) until you pick one
      for (const n of p.mats) { const m = byName.get(n); if (!m) continue;
        const own = !colors[part]; if (m.vertexColors !== own) { m.vertexColors = own; m.needsUpdate = true; }
        m.color.set(own ? "#ffffff" : c); }
      continue;
    }
    for (const n of p.mats) byName.get(n)?.color.copy(c);
    const dark = c.clone().multiplyScalar(0.72);
    for (const n of p.trim || []) byName.get(n)?.color.copy(dark);
  }
  if (def.hide) scene.traverse((o) => { if (o.isMesh && [].concat(o.material).some((m) => def.hide.test(m.name))) o.visible = false; });
}

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

// root sits at the board's base with local +z the direction of travel, the way rider.js's physics moves it:
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
    if (!c) return null;
    const a = mixer.clipAction(c);
    a.play(); a.paused = true; a.time = c.duration / 2; a.setEffectiveWeight(0); // held at its peak
    return a;
  };
  // Left_Turn and Right_Turn shift the weight toward the nose or the tail; Knee_Bend sinks the hips.
  // Each held at its peak and blended by weight, except Skate_Push, which plays (one push per clip).
  const A = { stance: clip("Snowboard_Stance"), left: clip("Left_Turn"), right: clip("Right_Turn"), knee: clip("Knee_Bend"), stand: clip("Neutral_Standing"),
    toe: clip("Toeside_Carve"), heel: clip("Heelside_Carve"), sit: clip("Chairlift_Sit"), idle: clip("Stand_Idle"), push: clip("Skate_Push"), exit: clip("Lift_Exit"),
    toeTurn: clip("Toeside_Turn"), heelTurn: clip("Heelside_Turn"), toToe: clip("HeelToToe_HipPush"), toHeel: clip("ToeToHeel_Crouch"),
    low: clip("Low_Stance"), lookL: clip("Chairlift_LookLeft"), lookR: clip("Chairlift_LookRight"),
    carry: clip("Board_Carry"), ollie: clip("Ollie_Air"), indy: clip("Indy_Grab"), melon: clip("Melon_Grab"), tailGrab: clip("Tail_Grab"), nose: clip("Nose_Press"), tailPress: clip("Tail_Press") };
  for (const k of Object.keys(A)) if (!A[k]) delete A[k];
  const B = { spine: bone("Spine"), chest: bone("Chest"), neck: bone("Neck"), armL: bone("UpperArm.L"), armR: bone("UpperArm.R"),
    board: bone("Board"), hips: bone("Hips"), head: bone("Head"), thighL: bone("Thigh.L"), thighR: bone("Thigh.R"), shinL: bone("Shin.L"), shinR: bone("Shin.R"),
    footL: bone("Foot.L"), footR: bone("Foot.R"), foreL: bone("Forearm.L"), foreR: bone("Forearm.R") };
  const bones = []; model.traverse((o) => { if (o.isBone) bones.push(o); });
  // The leading foot (the one nearer the nose, +z): it stays strapped in on the chairlift.
  const lead = root.worldToLocal(B.footL.getWorldPosition(new THREE.Vector3())).z > 0 ? "L" : "R";
  const armZ = Math.sign(root.worldToLocal(B.armL.getWorldPosition(new THREE.Vector3())).z) || 1; // the left arm's end of the board
  root.userData = { kind: "board", goofy: me.stance === "goofy", pushT: 0, yaw, lean, model, mixer, A, B, bones, lead, toeX, armZ, edgeX: [edges.min.x, edges.max.x], s: { edge: 0, skid: 0, knee: 0, fore: 0, tuck: 0 } };
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
  s.push = damp(s.push || 0, r.pushing || r.walking ? 1 : 0, 6, dt);
  // How far onto each edge, 0..1 (full at about 30° of inclination). A shallow turn is the model's Turn
  // clip; deeper, it becomes the Carve clip. Rolling quickly from one edge to the other plays the edge
  // change (toe to heel: sink; heel to toe: drive the hips over the toes). A tuck is Low_Stance.
  const toe = Math.min(1, Math.max(0, -s.edge * tx) / 0.5), heel = Math.min(1, Math.max(0, s.edge * tx) / 0.5 + s.skid * 0.7);
  const roll = (s.edge - (s.lastEdge ?? s.edge)) / dt * tx; s.lastEdge = s.edge; // + rolling toward the heels
  s.roll = damp(s.roll || 0, Math.max(-1, Math.min(1, roll / 1.2)), 6, dt);
  const deep = (t) => Math.max(0, (t - 0.5) / 0.5), side = Math.max(toe, Math.min(1, heel));
  const push = A_(u, "push") ? s.push * (1 - side) : 0;
  const change = (1 - side) * (1 - push), toHeel = A_(u, "toHeel") ? Math.max(0, s.roll) * change : 0, toToe = A_(u, "toToe") ? Math.max(0, -s.roll) * change : 0;
  const w = {
    toeTurn: A_(u, "toeTurn") ? toe * (1 - deep(toe)) : 0, toe: A_(u, "toe") ? (A_(u, "toeTurn") ? deep(toe) : toe) : 0,
    heelTurn: A_(u, "heelTurn") ? Math.min(1, heel) * (1 - deep(Math.min(1, heel))) : 0, heel: A_(u, "heel") ? (A_(u, "heelTurn") ? deep(Math.min(1, heel)) : Math.min(1, heel)) : 0,
    push, toHeel, toToe,
  };
  const used = Object.values(w).reduce((a, v) => a + v, 0), rest = Math.max(0, 1 - used);
  if (A_(u, "low")) w.low = rest * Math.min(1, s.tuck * 1.2); else w.knee = rest * Math.min(1, s.tuck * 0.7);
  w.stance = Math.max(0, rest - (w.low || w.knee || 0));
  // A trick takes over: in quickly, held, out at the end; in the air the board levels off.
  let k = 0, lift = 0;
  if (u.trick) {
    const tr = u.trick; tr.t += dt;
    const f = tr.t / tr.dur;
    if (f >= 1) u.trick = null;
    else {
      k = Math.min(1, f / 0.22, (1 - f) / 0.22);
      lift = tr.air * 4 * f * (1 - f); // a parabola
      for (const key of Object.keys(w)) w[key] *= 1 - k;
      w[tr.key] = k;
    }
  }
  s.trickK = k;
  weights(u, w);
  if (push > 0.01) { u.pushT = (u.pushT + dt * 0.9) % 1; u.A.push.time = u.pushT * u.A.push.getClip().duration; } // a push every ~1.1 s
  u.lean.position.set(0, 0, 0); u.lean.rotation.set(0, 0, 0); u.yaw.rotation.set(0, 0, 0); u.yaw.position.set(0, 0, 0); u.model.position.x = u.model.position.z = 0;
  mix(u);
  // Skid: the board swings so the toes face the way you are going and the heel edge trails uphill.
  u.yaw.rotation.y = -tx * 1.2 * s.skid;
  const tilt = (s.edge * (1 - s.skid) - tx * 0.3 * s.skid) * (1 - k); // about the board's long axis; + leans toward -x
  u.lean.rotation.z = tilt;
  u.lean.position.y = -Math.min(u.edgeX[0] * Math.sin(tilt), u.edgeX[1] * Math.sin(tilt)); // pivot on the edge in the snow, not under it
  u.lean.updateMatrixWorld(true);
  // Angulation: the chest comes back toward upright by part of the inclination (the clips are posed on a
  // flat board; the inclination comes from tilting the whole rider).
  turn(u.B.spine, u.lean, Z, -tilt * 0.18);
  turn(u.B.chest, u.lean, Z, -tilt * 0.14);
  if (lift) { root.position.addScaledVector(r.n, lift); }
  finish(root);
}
const A_ = (u, k) => !!u.A[k];

// Tricks, on demand (the trick wheel in look.html): air ones are a hop with the model's pose at the top;
// presses stay on the snow. key: the clip; air: jump height in metres; dur: seconds.
export const TRICKS = [
  { key: "ollie", name: "Ollie", air: 0.9, dur: 0.8 },
  { key: "indy", name: "Indy", air: 1.3, dur: 1.05 },
  { key: "melon", name: "Melon", air: 1.3, dur: 1.05 },
  { key: "tailGrab", name: "Tail Grab", air: 1.4, dur: 1.1 },
  { key: "nose", name: "Nose Press", air: 0, dur: 1.4 },
  { key: "tailPress", name: "Tail Press", air: 0, dur: 1.4 },
];
export const tricksOf = (root) => (root?.userData?.A ? TRICKS.filter((t) => root.userData.A[t.key]) : []);
export function startTrick(root, key) {
  const t = TRICKS.find((x) => x.key === key), u = root.userData;
  if (!t || !u.A?.[key] || u.trick) return false;
  u.trick = { ...t, t: 0 };
  return true;
}
// Riding the lift and getting off: the rider faces the way the chair goes (root +z), not the board.
// On the chair: seated, the leading foot still strapped in so the board hangs off it, the back foot free;
// hands on the lap; lookYaw turns the head (and a little of the chest). The hips land on `seat`, a point
// in root's frame. Off the chair: standing on the board, gliding down the ramp.
const _v = new THREE.Vector3();
function faceForward(u) {
  u.yaw.rotation.set(0, u.toeX < 0 ? Math.PI / 2 : -Math.PI / 2, 0); // chest (the toes' side) to +z
  u.lean.rotation.set(0, 0, 0); u.lean.position.set(0, 0, 0);
}
export function sitBoarder(root, lookYaw = 0, seat = new THREE.Vector3(0, 0.45, 0)) {
  const u = root.userData, B = u.B, F = u.yaw;
  start(root);
  if (u.goofy) { lookYaw = -lookYaw; seat = seat.clone(); seat.x = -seat.x; }
  faceForward(u);
  u.model.position.x = u.model.position.z = 0; u.yaw.position.y = 0;
  // Chairlift_Sit (front foot strapped in, board hanging, hands on the knees), turning to look with the
  // model's own look-left and look-right poses as you turn the phone (lookYaw > 0: to the left).
  const look = Math.max(-1, Math.min(1, lookYaw / 0.9));
  if (A_(u, "lookL")) weights(u, { sit: 1 - Math.abs(look), lookL: Math.max(0, look), lookR: Math.max(0, -look) });
  else weights(u, { sit: 1 });
  mix(u);
  if (!A_(u, "lookL")) { turn(B.spine, F, Y, lookYaw * 0.25); turn(B.head, F, Y, Math.max(-1, Math.min(1, lookYaw * 0.75))); }
  root.updateMatrixWorld(true);
  // Hips onto the seat.
  const h = root.worldToLocal(B.hips.getWorldPosition(_v));
  u.model.position.x -= h.x - seat.x; u.model.position.z -= h.z - seat.z;
  u.yaw.position.y = seat.y - h.y;
  finish(root);
}
// Getting off (k 0..1 down the ramp): Lift_Exit, settling into Stand_Idle on the board.
export function standBoarder(root, k = 1) {
  const u = root.userData;
  faceForward(u); u.yaw.position.y = 0;
  u.yaw.rotation.y = 0; // gliding off: the board along the ramp
  u.model.position.x = u.model.position.z = 0;
  const exit = A_(u, "exit") ? 1 - k : 0;
  weights(u, A_(u, "idle") ? { exit, idle: 1 - exit } : { stance: 0.6, knee: 0.4 });
  start(root); mix(u); finish(root);
}
// Standing on the board, as on the start screen.
export function idleBoarder(root) {
  const u = root.userData;
  start(root);
  u.lean.position.set(0, 0, 0); u.lean.rotation.set(0, 0, 0); u.yaw.rotation.set(0, 0, 0); u.yaw.position.set(0, 0, 0); u.model.position.x = u.model.position.z = 0;
  weights(u, A_(u, "idle") ? { idle: 1 } : { stance: 1 });
  mix(u); finish(root);
}

// On foot, the board carried (a hike-to): the carry pose, bobbing a little with each step (phase in steps).
export function hikeBoarder(root, phase) {
  const u = root.userData;
  start(root);
  u.lean.position.set(0, 0, 0); u.lean.rotation.set(0.08, 0, 0); u.yaw.rotation.set(0, Math.sin(phase * Math.PI) * 0.04, 0); u.model.position.x = u.model.position.z = 0;
  u.yaw.position.set(0, Math.abs(Math.sin(phase * Math.PI)) * 0.05, 0);
  faceForward(u);
  weights(u, A_(u, "carry") ? { carry: 1 } : A_(u, "idle") ? { idle: 1 } : { stance: 1 });
  mix(u); finish(root);
}
