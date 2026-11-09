// The ride's rider: one of the character templates (character.js), dressed as the rider page saved it, on
// its board. The ride draws the light version (tpl_*_lod.glb, about 30k triangles) with the ride's clips
// (tpl_*_ride.glb), each file loaded once and shared by every rider made from it. Most clips go from the
// base pose to their peak and back; we hold them at their peak and blend them by how the rider is steering,
// braking and crouching. A few play through: the push, the walk with the board, the pop, a fall and getting
// up, talking and waving on the chair. The jacket's corrective morphs ride in the same clips.
import * as THREE from "three";
import { CFG, COLOR_MATS, makeCharacter, loadTemplate, presetChar, partColors, setPartColor, holdProp } from "./character.js?v=13";
import { myRiderLook } from "../core/look.js?v=20";
import { animalOf, riggedOf, deskPetOf, petColors } from "./animal-core.js?v=2";
import { carveDepth, carveLayer, leanScale, twoBone } from "./carve-core.js?v=2";
import { loadAnimal, animalRider, disposeAnimal, poseAnimal, sitAnimal, idleAnimal, hikeAnimal, ANIMAL_TRICKS, startAnimalTrick, fallAnimal } from "./animal.js?v=3";
import { SKI_CLIPS, skiTricks, skiWeights, newPlant, plantStep, standinParams, sportOf, extraLean, fallSide } from "./ski-core.js?v=1";
import { dressSkier, poseSkiBody, placePoles, tintSkiGear, SKI_STACK } from "./skier.js?v=1";
import { addSki, loadSki } from "./ski.js?v=1";

// Riders saved before the templates (on the first model, "rider_a") keep their six part colours; parts they
// never picked default to these.
export const RIDERS = {
  rider_a: { name: "Rider A", parts: { jacket: { color: "#525942" }, pants: { color: "#c5bcaa" }, helmet: { color: "#272729" }, lens: { color: "#95a2f9" }, gloves: { color: "#d8cfb8" }, boots: { color: "#c6c9c5" } } },
};
export const PART_ZH = { jacket: "外套", pants: "雪裤", helmet: "头盔", lens: "雪镜", gloves: "手套", boots: "雪鞋" };
// The four outfits on the rider page: ch is the template preset each one is (character.js); colours are its
// parts' (the swatches on its card).
export const OUTFITS = {
  o_pine: { zh: "松林", en: "Pine", ch: "A", colors: { jacket: "#525a42", pants: "#c9bfac", helmet: "#2b2b2e", lens: "#4d5ce0", gloves: "#e3dccb", boots: "#1d1d20" } },
  o_night: { zh: "夜航", en: "Night Flight", ch: "B", colors: { jacket: "#18181b", pants: "#1a1a1d", helmet: "#151517", lens: "#4d5ce0", gloves: "#1b1b1d", boots: "#8fb8e6" } },
  o_wine: { zh: "热红酒", en: "Mulled Wine", ch: "C", colors: { jacket: "#e0157f", pants: "#d61a7b", helmet: "#1b1b1e", lens: "#1d1d22", gloves: "#d8cdb3", boots: "#3e4046" } },
  o_glacier: { zh: "冰川", en: "Glacier", ch: "D", colors: { jacket: "#e6e9ec", pants: "#151517", helmet: "#d6c8a0", lens: "#ff7a1a", gloves: "#1b1b1d", boots: "#5fa2e3" } },
};

// A look's rider (core/look.js: { ch }, { preset, colors } or { preset }; mine or a friend's) as a character,
// every value kept inside the template's ranges (a friend's comes over the wire).
const clamp = (v, lo, hi, d) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const HEX = /^#[0-9a-f]{6}$/i;
export function charOfLook(rider) {
  const c = rider?.ch;
  if (c && CFG.templates[c.tpl]) {
    const T = CFG.templates[c.tpl], base = presetChar(Object.keys(CFG.presets).find((k) => CFG.presets[k].tpl === c.tpl));
    const ch = { ...base, parts: { ...base.parts }, colors: { ...base.colors }, board: CFG.presets[c.board] ? c.board : base.board, glossyHelmet: !!c.glossyHelmet };
    ch.height = clamp(c.height, T.hmin, T.hmax, base.height);
    for (const s of CFG.sliders) ch[s.key] = clamp(c[s.key], s.lo, s.hi, base[s.key]);
    for (const k of Object.keys(ch.parts)) if (k in (c.parts || {})) ch.parts[k] = !!c.parts[k];
    for (const [m, v] of Object.entries(c.colors || {})) if (/^MAT_\w+$/.test(m) && HEX.test(v)) ch.colors[m] = v;
    if (animalOf(c.animal)) ch.animal = c.animal; // riding as one of the resort animals (animal.js), or a rigged one
    if (sportOf({ sport: c.sport, animal: ch.animal }) === "ski") ch.sport = "ski"; // on skis (双板): a person only
    if (riggedOf(c.animal)) { // its own colours and accessories (character.js applyPet)
      ch.pet = { colors: petColors(c.pet?.colors) };
      for (const k of ["beanie", "backpack"]) if (k in (c.parts || {})) ch.parts[k] = !!c.parts[k];
    }
    return ch;
  }
  const ch = presetChar(CFG.presets[rider?.preset] ? rider.preset : "A");
  for (const [p, v] of Object.entries(rider?.colors || {})) if (COLOR_MATS[p] && HEX.test(v)) setPartColor(ch, p, v);
  return ch;
}

// The rider saved on this phone (see start.js): what I wear (st.wear), else the outfit chosen before there was
// one; its character, name, look and stance.
export function myRider() {
  let st = {};
  try { st = JSON.parse(localStorage.getItem("prerun") || "{}"); } catch { /* fresh */ }
  const mine = (st.riders || []).find((r) => r.id === st.rider), outfit = OUTFITS[st.rider];
  const id = mine?.id || (outfit ? st.rider : "o_pine"), look = myRiderLook(), ch = charOfLook(look);
  const stance = st.wear?.ch ? st.wear.stance : (st.stances || {})[id] ?? (st.stances || {})[mine?.base || "rider_a"];
  return { name: (st.wear?.ch && st.wear.name) || mine?.name || outfit?.zh || "Rider A", look, ch, colors: partColors(ch), stance: stance === "goofy" ? "goofy" : "regular" };
}

// Start loading a template's light version and its clips (mine by default; or my animal's file, if I ride as
// one); boarderModel waits for it anyway.
export const loadBoarder = (tpl = null) => { const ch = myRider().ch; if (!tpl && sportOf(ch) === "ski") loadSki(ch.tpl).catch(() => null); return !tpl && deskPetOf(ch.animal) ? loadAnimal(ch.animal) : loadTemplate(tpl || riggedOf(ch.animal) || ch.tpl, { lod: true }); };

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
// The clips the ride plays, by what it calls them. Held at their peak, except the ones marked played.
const CLIPS = {
  stance: "Snowboard_Stance", left: "Left_Turn", right: "Right_Turn", knee: "Knee_Bend", low: "Low_Stance", idle: "Neutral_Standing",
  toe: "Toeside_Carve", heel: "Heelside_Carve", toeTurn: "Toeside_Turn", heelTurn: "Heelside_Turn", toToe: "HeelToToe_HipPush", toHeel: "ToeToHeel_Crouch",
  skid: "Skid_Stop_Heel",
  push: "Skate_Push", carry: "Board_Carry", // played: one push, one stride
  sit: "Chairlift_Sit", lookL: "Chairlift_LookLeft", lookR: "Chairlift_LookRight", exit: "Lift_Exit",
  talk: "Chairlift_Sit_Talk", point: "Chairlift_Point", wave: "Chairlift_Wave", // played
  pop: "Ollie", ollie: "Ollie_Air", indy: "Indy_Grab", melon: "Melon_Grab", tailGrab: "Tail_Grab", nose: "Nose_Press", tailPress: "Tail_Press", // pop: played
  fallHeel: "Fall_Heel", fallToe: "Fall_Toe", upHeel: "Get_Up", upToe: "Get_Up_Toe", // played
};
// Chairlift_Sit_Talk swings its left arm out and up toward whoever it talks to (mirrored for a friend on the
// right: the right arm), reaching across the neighbour at chest height, and turns the chest so the other hand
// lifts off its knee. On the chair both hands rest on the knees, the same on both sides (the owner's call): the
// talk clip is played as Chairlift_Sit with only its neck and head, which turn to the friend and nod along.
// Made once per set of clips (a template's, or a rigged animal's).
const TALK_BONES = /^(Neck|Head)\./;
const quiet = new WeakMap();
function quietTalk(C) {
  const talk = C.clips.Chairlift_Sit_Talk, sit = C.clips.Chairlift_Sit;
  if (!talk || !sit) return talk || null;
  if (!quiet.has(talk)) {
    const c = talk.clone();
    c.tracks = sit.tracks.filter((t) => !TALK_BONES.test(t.name)).map((t) => t.clone()).concat(talk.tracks.filter((t) => TALK_BONES.test(t.name)).map((t) => t.clone()));
    quiet.set(talk, c);
  }
  return quiet.get(talk);
}
// Talking on the radio while riding: Radio_Talk_Ride's right arm and head, laid over whatever the legs are doing.
const RADIO_BONES = ["ShoulderR", "UpperArmR", "ForearmR", "HandR", "Neck", "Head"];

// root sits at the board's base with local +z the direction of travel, the way board.js's physics moves it:
//   root → yaw (board skidding across) → lean (board on its edge, rider inclined into the turn) → model
// friend: { rider (their look's rider), stance } makes a friend riding with you (their own materials, so their
// own colours), posed by the same functions; without it, the one rider on the mountain: you.
export async function boarderModel(friend = null) {
  const me = friend ? { ch: charOfLook(friend.rider), stance: friend.stance === "goofy" ? "goofy" : "regular" } : myRider();
  // An animal on its board instead (animal.js): every pose function below hands it on.
  if (deskPetOf(me.ch.animal)) return animalRider({ animal: me.ch.animal, board: me.ch.board, stance: me.stance });
  // A rigged animal (character.js PETS) rides as a person does: the same clips, on its own file.
  const C = await makeCharacter(riggedOf(me.ch.animal) || me.ch.tpl, { lod: true });
  C.set(me.ch);
  if (sportOf(me.ch) === "ski") { await addSki(C).catch(() => null); return skierModel(C, me); } // the gear and Ski_ clips (ski.js), or the stand-in
  const root = new THREE.Group(), yaw = new THREE.Group(), lean = new THREE.Group(), model = C.root;
  root.add(yaw); yaw.add(lean); lean.add(model);
  model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; }); // a skinned mesh's bounds are its rest pose's
  // The board runs along the model's x axis; the leading foot's end is the nose. Turn that to +z.
  model.updateMatrixWorld(true);
  const bone = (n) => C.bones[n.replace(".", "")]; // the loader drops the dot
  const fl = bone("Foot.L").getWorldPosition(new THREE.Vector3());
  const fr = bone("Foot.R").getWorldPosition(new THREE.Vector3());
  // The leading (left) foot to the nose, +z. A goofy rider is this rider's mirror image (not the same
  // rider turned round, which would be riding switch): poses are worked out as regular, then root is
  // mirrored across the way of travel (see `finish`), so the right foot leads and she looks to the nose.
  model.rotation.y = fl.x > fr.x ? -Math.PI / 2 : Math.PI / 2;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  model.position.y = -box.min.y; // the board's base on the snow (the template's is a little below its origin)
  root.updateMatrixWorld(true);
  // Which side the toes point to (+1: +x, -1: -x): the foot bones run heel to toe.
  // Where the board's edges are (across it, in the rider's frame), measured on the model: the board pivots
  // on whichever edge is in the snow.
  const edges = new THREE.Box3();
  model.traverse((o) => { if (o.isMesh && /^MAT_board/.test([].concat(o.material)[0].name)) edges.expandByObject(o, true); });
  if (edges.isEmpty()) edges.min.x = -(edges.max.x = 0.13);
  const toes = new THREE.Vector3(0, 1, 0).applyQuaternion(bone("Foot.L").getWorldQuaternion(new THREE.Quaternion()));
  const toeX = Math.sign(root.worldToLocal(toes.add(root.getWorldPosition(new THREE.Vector3()))).x) || 1;
  const mixer = C.mixer, A = {};
  for (const [k, n] of Object.entries(CLIPS)) {
    const c = k === "talk" ? quietTalk(C) : C.clips[n]; if (!c) continue;
    const a = mixer.clipAction(c);
    a.play(); a.paused = true; a.time = c.duration / 2; a.setEffectiveWeight(0); // held at its peak
    A[k] = a;
  }
  const B = { spine: bone("Spine"), chest: bone("Chest"), neck: bone("Neck"), armL: bone("UpperArm.L"), armR: bone("UpperArm.R"),
    board: bone("Board"), hips: bone("Hips"), head: bone("Head"), thighL: bone("Thigh.L"), thighR: bone("Thigh.R"), shinL: bone("Shin.L"), shinR: bone("Shin.R"),
    footL: bone("Foot.L"), footR: bone("Foot.R"), foreL: bone("Forearm.L"), foreR: bone("Forearm.R") };
  const bones = []; model.traverse((o) => { if (o.isBone) bones.push(o); });
  // The radio pose's arm and head, read once off the clip at its peak.
  const radio = [], rc = C.clips.Radio_Talk_Ride;
  if (rc) for (const n of RADIO_BONES) {
    const tr = rc.tracks.find((t) => t.name === `${n}.quaternion`); if (!tr || !C.bones[n]) continue;
    radio.push([C.bones[n], new THREE.Quaternion().fromArray(tr.createInterpolant().evaluate(rc.duration / 2))]);
  }
  // The leading foot (the one nearer the nose, +z): it stays strapped in on the chairlift.
  const lead = root.worldToLocal(B.footL.getWorldPosition(new THREE.Vector3())).z > 0 ? "L" : "R";
  // The legs' bones (thigh, shin), for bending them so the feet stay on the board as the hips move.
  const wp = (b) => b.getWorldPosition(new THREE.Vector3());
  const legs = ["L", "R"].map((s) => ({ thigh: B["thigh" + s], shin: B["shin" + s], foot: B["foot" + s] })).filter((l) => l.thigh && l.shin && l.foot);
  for (const l of legs) { l.l1 = wp(l.thigh).distanceTo(wp(l.shin)); l.l2 = wp(l.shin).distanceTo(wp(l.foot)); }
  const legLen = legs.length ? (legs[0].l1 + legs[0].l2) : 0.85;
  const armZ = Math.sign(root.worldToLocal(B.armL.getWorldPosition(new THREE.Vector3())).z) || 1; // the left arm's end of the board
  root.userData = { kind: "board", C, tpl: C.tpl, goofy: me.stance === "goofy", flip: me.stance === "goofy", pushT: 0, walkT: 0, at: 0, yaw, lean, model, mixer, A, B, bones, radio, lead, toeX, armZ, legs, legLen,
    edgeX: [edges.min.x, edges.max.x], s: { edge: 0, skid: 0, knee: 0, fore: 0, tuck: 0, radio: 0, toeD: 0, heelD: 0 } };
  return root;
}
// A friend's rider gone: its own materials, skeleton and mixer go too (the geometry and textures are shared).
export function disposeBoarder(root) {
  if (root?.userData?.kind === "animal") return disposeAnimal(root);
  const u = root?.userData; if (!u?.C) return;
  root.removeFromParent();
  holdProp(u.C, null);
  u.mixer.stopAllAction(); u.mixer.uncacheRoot(u.model);
  u.model.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.dispose(); if (o.isMesh) for (const m of [].concat(o.material)) m.dispose(); });
  u.C = null;
}

// The mixer only writes a bone when the blend changes, so put back its last output before our own turns
// go on top (or they would pile up frame after frame while a pose holds still).
function mix(u) {
  for (const b of u.bones) if (b.userData.mixed) { b.position.copy(b.userData.mixed.p); b.quaternion.copy(b.userData.mixed.q); }
  u.mixer.update(0);
  for (const b of u.bones) { const m = (b.userData.mixed ||= { p: new THREE.Vector3(), q: new THREE.Quaternion() }); m.p.copy(b.position); m.q.copy(b.quaternion); }
}
// Work every pose out unmirrored, then mirror a goofy rider (three.js flips the faces' winding for it).
// On the chair a rider talking to a friend on their right is mirrored instead (the clip leans to the left).
const start = (root) => { root.scale.set(1, 1, 1); root.updateMatrixWorld(true); };
const finish = (root) => { root.scale.x = root.userData.flip ? -1 : 1; root.updateMatrixWorld(true); };
const weights = (u, w) => { for (const [k, a] of Object.entries(u.A)) a.setEffectiveWeight(w[k] || 0); };
// A played clip at f (0..1) of its length.
const at = (a, f) => { a.time = Math.max(0, Math.min(1, f)) * (a.getClip().duration - 1e-3); };
// Seconds since this rider was last posed (each pose function runs once a frame).
const tick = (u) => { const now = performance.now(), dt = u.at ? Math.min(0.1, (now - u.at) / 1000) : 0.016; u.at = now; return dt; };

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
const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const A_ = (u, k) => !!u.A[k];

// The carving body (carve-core.js) over the clips, worked out in the lean frame (the board on its edge: x
// across it, the toes at toeX; y off its base; z to the nose): the hips move toward the toes and down (顶胯)
// or back over the heels and well down (sitting), and the legs bend to keep the feet where they were on the
// board; the trunk is brought to its tilt on that side, the chest turned to face the toes or opened to the
// nose, and the arms go low and forward (toe side) or forward for balance (heel side).
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _wq = new THREE.Quaternion(), _dq = new THREE.Quaternion(), _iq = new THREE.Quaternion();
// Turn a bone (in the world) by the turn taking direction `from` to `to`, k of the way.
function aim(bone, from, to, k = 1) {
  if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
  _dq.setFromUnitVectors(_a.copy(from).normalize(), _b.copy(to).normalize());
  if (k < 1) _dq.slerp(_iq.identity(), 1 - k);
  bone.getWorldQuaternion(_wq).premultiply(_dq);
  bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_wq));
  bone.updateMatrixWorld(true);
}
const wpos = (b, out) => b.getWorldPosition(out);
function carveBody(u, toe, heel) {
  if (toe + heel < 0.004 || !u.B.hips || u.legs.length < 2) return;
  const L = carveLayer(toe, heel), F = u.lean, tx = u.toeX, B = u.B;
  const across = new THREE.Vector3(tx, 0, 0).transformDirection(F.matrixWorld), up = new THREE.Vector3(0, 1, 0).transformDirection(F.matrixWorld);
  // The feet where the clip put them (on the board), before the hips move.
  const feet = u.legs.map((l) => ({ p: wpos(l.foot, new THREE.Vector3()), q: l.foot.getWorldQuaternion(new THREE.Quaternion()) }));
  // Hips: toward the toes or the heels, and down.
  const hp = wpos(B.hips, _c).addScaledVector(across, L.hipIn * u.legLen).addScaledVector(up, -L.hipDown * u.legLen);
  B.hips.position.copy(B.hips.parent.worldToLocal(hp));
  B.hips.updateMatrixWorld(true);
  // Each leg bent to reach its foot again, in the plane the clip's knee was in.
  u.legs.forEach((l, i) => {
    const H = wpos(l.thigh, new THREE.Vector3()), K0 = wpos(l.shin, new THREE.Vector3()), P = feet[i].p;
    const hf = _d.copy(P).sub(H), dist = hf.length(); if (dist < 1e-5) return;
    const { hip } = twoBone(l.l1, l.l2, dist);
    const dir = hf.clone().normalize(), side = K0.clone().sub(H);
    const v = side.addScaledVector(dir, -side.dot(dir)); // the knee's side of the hip-to-foot line
    if (v.lengthSq() < 1e-8) v.copy(across); v.normalize();
    const K = H.clone().addScaledVector(dir, Math.cos(hip) * l.l1).addScaledVector(v, Math.sin(hip) * l.l1);
    aim(l.thigh, K0.clone().sub(H), K.clone().sub(H));
    const Kn = wpos(l.shin, new THREE.Vector3());
    aim(l.shin, wpos(l.foot, _e).sub(Kn), P.clone().sub(Kn));
    l.foot.parent.getWorldQuaternion(_pq); l.foot.quaternion.copy(_pq.invert().multiply(feet[i].q)); l.foot.updateMatrixWorld(true);
  });
  // The trunk: brought to its tilt toward the toes on the board, split between spine and chest.
  // (The chest is turned first; twice round, as the spine's pivot sits above the hips.)
  turn(B.chest, F, Y, tx * L.twist);
  if (B.spine && B.neck) for (let i = 0; i < 2; i++) {
    const t = wpos(B.neck, new THREE.Vector3()).sub(wpos(B.hips, _c));
    const now = Math.atan2(t.dot(across), t.dot(up)), fix = (L.trunk - now) * L.trunkK;
    turn(B.spine, F, Z, -tx * fix * 0.55);
    turn(B.chest, F, Z, -tx * fix * 0.45);
  }
  // Arms: each upper arm's direction pulled toward the toes and down, by its own length.
  const ak = u.C?.pet ? 0.5 : 1; // the capybara's short arms: half as far
  for (const [arm, fore] of [[B.armL, B.foreL], [B.armR, B.foreR]]) {
    if (!arm || !fore) continue;
    const a = wpos(fore, new THREE.Vector3()).sub(wpos(arm, _c)), n = a.length(); if (n < 1e-5) continue;
    a.divideScalar(n);
    aim(arm, a, a.clone().addScaledVector(across, L.armIn * ak).addScaledVector(up, -L.armDown * ak));
  }
}

// Pose from the physics state (board.js's Rider). The whole rider and board incline into the turn by the
// angle that balances it, so the board rides its inside edge: the toe edge when the turn's inside is the
// side the toes point to, the heel edge otherwise. On top of that, as coaches teach it: on the toe side
// the upper body stays stacked upright over the toes; on the heel side the rider sinks lower (knee bend)
// with the chest upright over the hips and the shoulders opened toward the nose; either way the chest
// stays more upright than the legs (angulation) and the arms balance. The carve clips are posed on a
// nearly flat board, so the inclination is all ours (none from the clip on top of it).
// To slow down the board swings across the way you move and the rider sits back onto the heel edge:
// Skid_Stop_Heel, which brings its own edge.
export function poseBoarder(root, r) {
  if (root.userData.kind === "animal") return poseAnimal(root, r);
  if (root.userData.kind === "ski") return poseSkier(root, r);
  const u = root.userData, s = u.s, dt = r.dt || 0.016, tx = u.toeX, g = u.goofy ? -1 : 1;
  u.at = performance.now(); u.flip = u.goofy;
  start(root);
  root.position.set(r.x, r.y, r.z);
  root.quaternion.setFromUnitVectors(Y, r.n);
  root.rotateY(r.heading);
  root.updateMatrixWorld(true);
  // Steer > 0 turns toward local -x, which is where a positive lean (rotation about +z) tilts the rider.
  // Goofy: posed as the mirror turn (g), then mirrored back.
  s.edge = damp(s.edge, Math.max(-0.9, Math.min(0.9, g * r.lean)), 8, dt);
  s.skid = damp(s.skid, r.skid ?? (r.braking ? 1 : 0), 5, dt);
  s.tuck = damp(s.tuck, Math.max(r.tuck ?? 0, r.absorb ?? 0), r.absorb ? 9 : 4, dt); // a tuck, or the knees soaking up a bump
  s.push = damp(s.push || 0, r.pushing || r.walking ? 1 : 0, 6, dt);
  s.radio = damp(s.radio, u.talking ? 1 : 0, 6, dt);
  // How far onto each edge, 0..1 (full at about 30° of inclination). A shallow turn is the model's Turn
  // clip; deeper, it becomes the Carve clip. Rolling quickly from one edge to the other plays the edge
  // change (toe to heel: sink; heel to toe: drive the hips over the toes). A tuck is Low_Stance.
  const sk = A_(u, "skid") ? Math.min(1, s.skid * 1.2) : 0; // braking: the skid stop takes over
  const toe = Math.min(1, Math.max(0, -s.edge * tx) / 0.5), heel = Math.min(1, Math.max(0, s.edge * tx) / 0.5 + (sk ? 0 : s.skid * 0.7));
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
  if (sk) { for (const key of Object.keys(w)) w[key] *= 1 - sk; w.skid = sk; }
  // A trick takes over: in quickly, held, out at the end; in the air the board levels off. An air trick
  // starts with the Ollie's pop (crouch, pop, tuck) and moves into its grab.
  let k = 0, lift = 0;
  if (u.trick) {
    const tr = u.trick; tr.t += dt;
    const f = tr.t / tr.dur;
    if (f >= 1) u.trick = null;
    else {
      k = Math.min(1, f / 0.22, (1 - f) / 0.22);
      lift = tr.air * 4 * f * (1 - f); // a parabola
      for (const key of Object.keys(w)) w[key] *= 1 - k;
      const pop = tr.air && A_(u, "pop") ? Math.min(1, Math.max(0, (0.3 - f) / 0.12)) : 0;
      if (pop) at(u.A.pop, (7 + (f / 0.3) * 12) / 26); // its frames 7 (crouch) to 19 (tucked)
      w.pop = k * pop; w[tr.key] = k * (1 - pop);
    }
  }
  // A fall takes over everything: down (Fall_Heel or Fall_Toe), a moment on the snow, back up (Get_Up,
  // Get_Up_Toe), each starting where the other ends.
  let down = 0, daze = 0;
  if (u.fall) {
    const fl = u.fall, T1 = 1.0, T2 = 1.4 + fl.hold, T3 = 2.4 + fl.hold, side = fl.heel ? "Heel" : "Toe";
    fl.t += dt;
    if (fl.t >= T3) u.fall = null;
    else {
      down = Math.min(1, fl.t / 0.12, (T3 - fl.t) / 0.15);
      for (const key of Object.keys(w)) w[key] *= 1 - down;
      const up = fl.t > T2;
      if (up) at(u.A["up" + side], (fl.t - T2) / (T3 - T2)); else at(u.A["fall" + side], fl.t / T1);
      if (fl.hold && fl.t > T1 && !up) daze = Math.sin(fl.t * 5) * 0.14 * Math.min(1, (fl.t - T1) * 3); // dazed: the head lolls
      w[(up ? "up" : "fall") + side] = down;
      k = Math.max(k, down); lift = 0;
    }
  }
  s.trickK = k;
  weights(u, w);
  if (push > 0.01) { u.pushT = (u.pushT + dt * 0.9) % 1; at(u.A.push, u.pushT); } // a push every ~1.1 s
  u.lean.position.set(0, 0, 0); u.lean.rotation.set(0, 0, 0); u.yaw.rotation.set(0, 0, 0); u.yaw.position.set(0, 0, 0); u.model.position.x = u.model.position.z = 0;
  mix(u);
  // Skid: the board swings so the toes face the way you are going and the heel edge trails uphill.
  u.yaw.rotation.y = -tx * 1.2 * s.skid * (1 - down);
  // About the board's long axis; + leans toward -x. Deep on the toe side the body shows a little less of it
  // (carve-core.js leanScale), so the pose reads as a laid-out carve, not kneeling.
  const tilt = (s.edge * (1 - s.skid) * leanScale(s.toeD * (1 - k), s.heelD * (1 - k)) - tx * 0.3 * s.skid * (1 - sk)) * (1 - k);
  u.lean.rotation.z = tilt;
  u.lean.position.y = -Math.min(u.edgeX[0] * Math.sin(tilt), u.edgeX[1] * Math.sin(tilt)); // pivot on the edge in the snow, not under it
  u.lean.updateMatrixWorld(true);
  // The carving body on top (carveBody): how deep into the toe or heel edge, by its angle and the speed; it
  // gives way to a skid, a push, a trick and a fall.
  const dEdge = carveDepth(s.edge * (1 - s.skid), r.speed ?? 10), onToe = -s.edge * tx > 0;
  const give = (1 - Math.min(1, s.skid * 1.5)) * (1 - push) * (1 - k);
  s.toeD = damp(s.toeD, onToe ? dEdge * give : 0, 10, dt); s.heelD = damp(s.heelD, onToe ? 0 : dEdge * give, 10, dt);
  carveBody(u, s.toeD * (1 - k), s.heelD * (1 - k)); // a trick or a fall takes over at once
  // Angulation: the chest comes back toward upright by part of the inclination (the clips are posed on a
  // flat board; the inclination comes from tilting the whole rider).
  turn(u.B.spine, u.lean, Z, -tilt * 0.18);
  turn(u.B.chest, u.lean, Z, -tilt * 0.14);
  if (daze) turn(u.B.head, u.lean, Y, daze);
  // The radio to the mouth (talkBoarder): its arm and head over the riding pose, the radio in the hand.
  const rk = s.radio * (1 - down);
  if (rk > 0.01) for (const [b, q] of u.radio) b.quaternion.slerp(q, rk);
  holdProp(u.C, rk > 0.5 ? "Radio_Talk_Ride" : null);
  if (lift) { root.position.addScaledVector(r.n, lift); }
  finish(root);
}

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
export const tricksOf = (root) => (root?.userData?.kind === "animal" ? ANIMAL_TRICKS : root?.userData?.kind === "ski" ? skiTricks(root.userData.real, (k) => !!root.userData.SA[k]) : root?.userData?.A ? TRICKS.filter((t) => root.userData.A[t.key]) : []);
export function startTrick(root, key) {
  if (root.userData.kind === "animal") return startAnimalTrick(root, key);
  const u = root.userData, t = (u.kind === "ski" ? tricksOf(root) : TRICKS).find((x) => x.key === key);
  if (!t || (u.kind !== "ski" && !u.A?.[key]) || u.trick || u.fall) return false;
  u.trick = { ...t, t: 0 };
  return true;
}
// A fall (into a tree, say): on the heel side, sitting back, or the toe side, onto the knees; then up again.
// heel: which side, else the edge the rider is on. hold: seconds more lying in the snow (dazed after a
// crash). Returns how long it all takes (s), or false. fallState(root): { t, down, dazed } while it lasts.
export function fallBoarder(root, heel = null, hold = 0) {
  if (root.userData.kind === "animal") return fallAnimal(root, heel, hold);
  const u = root.userData;
  if ((u.real ? !u.SA?.fallL || !u.SA.upL : !u.A?.fallHeel || !u.A.upHeel) || u.fall) return false; // (a skier's: Ski_Fall_L / _R and its get-up)
  u.trick = null;
  u.fall = { t: 0, hold, heel: u.kind === "ski" || (heel ?? (u.s.edge * u.toeX >= 0 || !u.A.fallToe || !u.A.upToe)), side: u.kind === "ski" && u.SA?.fallR ? fallSide(u.s.edge) : "L" }; // a skier: to the side of the turn
  return (u.real ? 3.33 : 2.4) + hold;
}
export function fallState(root) {
  const f = root?.userData?.fall; if (!f) return null;
  const down = root.userData.kind === "animal" ? 0.75 : 1.0, lie = (root.userData.kind === "animal" ? 1.45 : 1.4) + f.hold;
  return { t: f.t, dazed: f.t > down * 0.8 && f.t < lie + 0.2 ? Math.min(1, (f.t - down * 0.8) * 3, (lie + 0.2 - f.t) * 3) : 0 };
}
// Where the rider's head is now (world), for the stars over a dazed rider and the like.
export function headOf(root, out) {
  const u = root.userData, h = u.kind === "animal" ? u.head : u.B?.head;
  if (h) return h.getWorldPosition(out);
  return root.localToWorld(out.set(0, (u.tall || 1.7) * 0.85, 0));
}
// The radio raised to the mouth (on), or put away: the walkie-talkie in voice chat (src/ride/voice.js), for
// me and for a friend holding theirs. Riding, sitting on the chair and standing at the top all show it.
export function talkBoarder(root, on = true) { if (root?.userData) root.userData.talking = !!on; }
// The radio over a pose that isn't riding (the chair, standing): Radio_Talk_Ride's arm and head eased in,
// the radio in the hand; without it, the hand is empty.
function radioOver(u, dt) {
  const s = u.s; s.radio = damp(s.radio, u.talking ? 1 : 0, 6, dt);
  if (s.radio > 0.01) for (const [b, q] of u.radio) b.quaternion.slerp(q, s.radio);
  holdProp(u.C, s.radio > 0.5 ? "Radio_Talk_Ride" : null);
}

// Riding the lift and getting off: the rider faces the way the chair goes (root +z), not the board.
// On the chair: seated (Chairlift_Sit, the whole clip), the leading foot still strapped in so the board
// hangs off it, hands on the lap; lookYaw turns the head and chest with the model's look-left and look-right
// poses. The hips land on `seat`, a point in root's frame: root stands on the chair 0.595 m under the cushion
// (kitworld.js), so the hips go just above it. Off the chair: standing on the board, gliding down the ramp.
// talk: a friend beside you on the chair, +1 on your left (+x), -1 on your right: Chairlift_Sit_Talk.
export const SEAT = new THREE.Vector3(0, 0.6, -0.08);
// A rigged animal (the capybara) on the chair: the people's sit puts its short legs straight out along the seat, so
// its feet rest on the seat and the board, hanging from the lead foot, cuts up through it. It sits further forward
// instead (PET_FWD): its legs reach out past the seat's front edge, as a small animal sits, and the board hangs in
// front of the chair.
const PET_FWD = 0.2;
const _v = new THREE.Vector3();
function faceForward(u) {
  u.yaw.rotation.set(0, u.kind === "ski" ? (u.real ? Math.PI / 2 : 0) : u.toeX < 0 ? Math.PI / 2 : -Math.PI / 2, 0); // chest (the toes' side) to +z (the stand-in skier faces it already)
  u.lean.rotation.set(0, 0, 0); u.lean.position.set(0, 0, 0);
}
export function sitBoarder(root, lookYaw = 0, seat = SEAT, talk = 0) {
  if (root.userData.kind === "animal") return sitAnimal(root, lookYaw, seat);
  const u = root.userData, B = u.B, F = u.yaw, dt = tick(u);
  start(root);
  // The talk clip leans to the left; to talk to a friend on the right, the rider is mirrored.
  const talking = talk && A_(u, "talk");
  u.flip = talking ? talk < 0 : u.goofy;
  if (u.flip) { lookYaw = -lookYaw; seat = seat.clone(); seat.x = -seat.x; }
  faceForward(u);
  u.model.position.x = u.model.position.z = 0; u.yaw.position.y = 0;
  // Looking about with the model's own look-left and look-right poses as you turn the phone (lookYaw > 0:
  // to the left); talking, a little less. A wave or a point plays once over the seat.
  const look = Math.max(-1, Math.min(1, lookYaw / 0.9)) * (talking ? 0.4 : 1), base = talking ? "talk" : "sit";
  const w = A_(u, "lookL") ? { [base]: 1 - Math.abs(look), lookL: Math.max(0, look), lookR: Math.max(0, -look) } : { [base]: 1 };
  if (talking) { u.talkT = ((u.talkT || 0) + dt / u.A.talk.getClip().duration) % 1; at(u.A.talk, u.talkT); }
  if (u.gesture) {
    const gs = u.gesture, a = u.A[gs.key]; gs.t += dt;
    const f = gs.t / a.getClip().duration;
    if (f >= 1) u.gesture = null;
    else { const k = Math.min(1, f / 0.12, (1 - f) / 0.12); for (const key of Object.keys(w)) w[key] *= 1 - k; w[gs.key] = k; at(a, f); }
  }
  weights(u, w);
  if (u.SA) skiWeightsOn(u, {}); // a skier: none of the riding clips (Ski_Stand left on from the lift's ramp turned the hips and skis 45°)
  mix(u);
  if (!A_(u, "lookL")) { turn(B.spine, F, Y, lookYaw * 0.25); turn(B.head, F, Y, Math.max(-1, Math.min(1, lookYaw * 0.75))); }
  if (u.kind === "ski" && u.real) sitSquare(u, root);
  radioOver(u, dt);
  if (u.gear) placePoles(u.C, u.gear, null, { hidden: true }); // poles put away on the chair; the skis hang off the boots
  root.updateMatrixWorld(true);
  // Hips onto the seat.
  const h = root.worldToLocal(B.hips.getWorldPosition(_v));
  u.model.position.x -= h.x - seat.x; u.model.position.z -= h.z - seat.z;
  u.yaw.position.y = seat.y - h.y;
  if (u.C?.pet) { // forward on the seat: the root's +z (the way the chest faces) in the model's parent's frame
    root.updateMatrixWorld(true);
    const o = u.model.parent.worldToLocal(root.localToWorld(_v.set(0, 0, 0))).clone(), f = u.model.parent.worldToLocal(root.localToWorld(_v.set(0, 0, PET_FWD)));
    u.model.position.add(f.sub(o));
  }
  finish(root);
}
// A skier on the chair sits square (Ski_Chair_Sit: hips and chest the way the chair goes, shins hanging, skis
// parallel and straight ahead); the clip lets the skis' tips drop 22°, so the feet are turned up a little at the
// ankle (SKI_TIPS_UP) to bring the tips just above level.
const SKI_TIPS_UP = 0.46, X_ = new THREE.Vector3(1, 0, 0);
function sitSquare(u, root) {
  root.updateMatrixWorld(true);
  for (const f of [u.B.footL, u.B.footR]) turn(f, root, X_, -SKI_TIPS_UP); // about the chair's cross axis: toes up
}
// On the chair: a wave (Chairlift_Wave) or pointing ahead (Chairlift_Point), once.
export function gestureBoarder(root, key = "wave") {
  const u = root.userData;
  if (!u.A?.[key] || u.gesture) return false;
  u.gesture = { key, t: 0 };
  return true;
}
// Getting off (k 0..1 down the ramp): Lift_Exit, settling into standing on the board.
export function standBoarder(root, k = 1) {
  if (root.userData.kind === "animal") return idleAnimal(root);
  if (root.userData.kind === "ski") return stillSkier(root, { stand: 1 - 0.6 * k, glide: 0.6 * k }); // down the ramp, gliding off
  const u = root.userData, dt = tick(u);
  faceForward(u); u.yaw.position.y = 0; u.flip = u.goofy;
  u.yaw.rotation.y = 0; // gliding off: the board along the ramp
  u.model.position.x = u.model.position.z = 0;
  const exit = A_(u, "exit") ? 1 - k : 0;
  weights(u, A_(u, "idle") ? { exit, idle: 1 - exit } : { stance: 0.6, knee: 0.4 });
  start(root); mix(u); radioOver(u, dt); finish(root);
}
// Standing on the board, as on the start screen.
export function idleBoarder(root) {
  if (root.userData.kind === "animal") return idleAnimal(root);
  if (root.userData.kind === "ski") return stillSkier(root, { stand: 1 });
  const u = root.userData, dt = tick(u);
  start(root); u.flip = u.goofy;
  u.lean.position.set(0, 0, 0); u.lean.rotation.set(0, 0, 0); u.yaw.rotation.set(0, 0, 0); u.yaw.position.set(0, 0, 0); u.model.position.x = u.model.position.z = 0;
  weights(u, A_(u, "idle") ? { idle: 1 } : { stance: 1 });
  mix(u); radioOver(u, dt); finish(root);
}

// On foot, the board carried (a hike-to): Board_Carry's walk at its own pace, bobbing a little with each
// step (phase in steps).
export function hikeBoarder(root, phase) {
  if (root.userData.kind === "animal") return hikeAnimal(root, phase);
  if (root.userData.kind === "ski") return stillSkier(root, { stand: 0.5, skate: 0.5 }, { ph: phase / 2, k: 0.6 }); // pushing along on the poles (Ski_Push; the stand-in a skate)
  const u = root.userData, dt = tick(u);
  start(root); u.flip = u.goofy;
  u.lean.position.set(0, 0, 0); u.lean.rotation.set(0.08, 0, 0); u.yaw.rotation.set(0, Math.sin(phase * Math.PI) * 0.04, 0); u.model.position.x = u.model.position.z = 0;
  u.yaw.position.set(0, Math.abs(Math.sin(phase * Math.PI)) * 0.05, 0);
  faceForward(u);
  if (A_(u, "carry")) { u.walkT = (u.walkT + dt / u.A.carry.getClip().duration) % 1; at(u.A.carry, u.walkT); }
  weights(u, A_(u, "carry") ? { carry: 1 } : A_(u, "idle") ? { idle: 1 } : { stance: 1 });
  holdProp(u.C, null);
  mix(u); finish(root);
}

// ---- On skis (双板: a look's ch.sport "ski") ----
// The character AI's gear and Ski_ clips (ski.js addSki; docs/SKI_RIDERS.md): the skis on the feet and the poles
// in the hands, the board hidden, the clips blended by the ride's numbers (ski-core.js) as the board's are. Their
// forward is +x like the board's nose, so the model turns as the board's does (-π/2). Without those files (an old
// cache, a failed load) the stand-in from skier.js: code-made skis and poles, the skeleton posed by hand.
// root → yaw (the skis turned across the way you go: a skid, a hockey stop) → lean (both skis on edge, the
// skier inclined into the turn, past what the turn clips already show) → model.
// Skiers have no stance: never mirrored, except on the chair talking to a friend on the right (as boarders), and a
// hockey stop to the left (the clip swings the skis to the right only).
function skierModel(C, me) {
  const root = new THREE.Group(), yaw = new THREE.Group(), lean = new THREE.Group(), model = C.root;
  root.add(yaw); yaw.add(lean); lean.add(model);
  const real = !!(C.skiGear?.length && C.clips.Ski_Glide);
  let gear = null;
  model.updateMatrixWorld(true);
  if (real) {
    C.ski(true); tintSkiGear(C, me.ch);
    model.rotation.y = -Math.PI / 2; model.updateMatrixWorld(true);
    const skis = new THREE.Box3(); for (const o of C.skiGear) if (/^Ski_/.test(o.name)) skis.expandByObject(o, true);
    model.position.y = skis.isEmpty() ? 0.061 * model.scale.x : -skis.min.y; // the skis' bases on the snow
  } else {
    gear = dressSkier(C, me.ch); // in the rest pose, before any clip plays
    const boots = new THREE.Box3(); model.traverse((o) => { if (o.isMesh && /^Boots_/.test(o.name)) boots.expandByObject(o, true); });
    model.position.y = (boots.isEmpty() ? 0 : -boots.min.y) + SKI_STACK;
  }
  model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  const bone = (n) => C.bones[n.replace(".", "")];
  const mixer = C.mixer, A = {}, SA = {};
  const hold = (c) => { const a = mixer.clipAction(c); a.play(); a.paused = true; a.time = c.duration / 2; a.setEffectiveWeight(0); return a; };
  // the chair, the wave, the falls: the skier's own where there are (Ski_Chair_Sit, Ski_Wave, Ski_Fall), else the people's
  const board = real ? { sit: "Ski_Chair_Sit", wave: "Ski_Wave" } : { ...CLIPS };
  for (const [k, n] of Object.entries(board)) if (C.clips[n]) A[k] = hold(C.clips[n]);
  if (real) for (const [k, n] of Object.entries(SKI_CLIPS)) if (C.clips[n] && k !== "sit" && k !== "wave") SA[k] = hold(C.clips[n]);
  const B = { spine: bone("Spine"), chest: bone("Chest"), neck: bone("Neck"), head: bone("Head"), hips: bone("Hips"), footL: bone("Foot.L"), footR: bone("Foot.R"), armL: bone("UpperArm.L"), armR: bone("UpperArm.R") };
  const bones = []; model.traverse((o) => { if (o.isBone) bones.push(o); });
  const radio = [], rc = C.clips.Radio_Talk_Ride;
  if (rc) for (const n of RADIO_BONES) {
    const tr = rc.tracks.find((t) => t.name === `${n}.quaternion`); if (!tr || !C.bones[n]) continue;
    radio.push([C.bones[n], new THREE.Quaternion().fromArray(tr.createInterpolant().evaluate(rc.duration / 2))]);
  }
  root.userData = { kind: "ski", C, tpl: C.tpl, goofy: false, flip: false, at: 0, yaw, lean, model, mixer, A, SA, real, B, bones, radio, gear,
    plant: newPlant(), skT: 0, hkT: 0, hkFlip: false, toeX: 1, armZ: 1, lead: "L", s: { edge: 0, tuck: 0, plough: 0, hockey: 0, skate: 0, slip: 0, radio: 0 } };
  return root;
}
const skiWeightsOn = (u, w) => { for (const [k, a] of Object.entries(u.SA)) a.setEffectiveWeight(w[k] || 0); };
const resetGroups = (u) => { u.lean.position.set(0, 0, 0); u.lean.rotation.set(0, 0, 0); u.yaw.rotation.set(0, 0, 0); u.yaw.position.set(0, 0, 0); u.model.position.x = u.model.position.z = 0; };

// Riding: the turn, glide and tuck blended by how far on edge and how tucked; a plough when slow or braking, a
// hockey stop for a hard brake (the skis thrown across, the chest still down the hill); the double-pole push on
// the flat; a pole planted at each edge change. Friends' riders get only lean and speed: they glide and turn.
function poseSkier(root, r) {
  const u = root.userData, s = u.s, dt = r.dt || 0.016;
  u.at = performance.now();
  start(root);
  root.position.set(r.x, r.y, r.z);
  root.quaternion.setFromUnitVectors(Y, r.n);
  root.rotateY(r.heading);
  root.updateMatrixWorld(true);
  s.edge = damp(s.edge, Math.max(-0.9, Math.min(0.9, r.lean || 0)), 8, dt);
  s.tuck = damp(s.tuck, Math.max(r.tuck ?? 0, r.absorb ?? 0), r.absorb ? 9 : 4, dt);
  s.plough = damp(s.plough, r.plough ?? 0, 6, dt);
  s.hockey = damp(s.hockey, r.hockey ?? 0, 8, dt);
  s.skate = damp(s.skate, r.pushing || r.walking ? 1 : 0, 6, dt);
  s.slip = damp(s.slip, r.ski ? r.slip || 0 : 0, 10, dt);
  s.radio = damp(s.radio, u.talking ? 1 : 0, 6, dt);
  if (s.skate > 0.01) u.skT = (u.skT + dt / (u.SA.skate?.getClip().duration || 1.25)) % 1; // a push (or a stride) at the clip's pace
  // the hockey stop's clip plays once from its start; it swings the skis to the right, so one to the left is mirrored
  if (s.hockey > 0.05) { if (!u.hkT) u.hkFlip = s.slip > 0; u.hkT += dt; } else u.hkT = 0;
  const plant = plantStep(u.plant, s.edge, r.speed || 0, dt);
  const w = skiWeights(s);
  // A trick (ski-core.js SKI_TRICKS): the jump's clip played through (it lifts the skis itself); on the stand-in
  // its pose at the top of a hop.
  let k = 0, lift = 0, trick = null;
  if (u.trick) {
    const tr = u.trick; tr.t += dt;
    const f = tr.t / tr.dur;
    if (f >= 1) u.trick = null;
    else {
      k = Math.min(1, f / 0.15, (1 - f) / 0.15); for (const key of Object.keys(w)) w[key] *= 1 - k;
      if (u.real && tr.clip) { trick = { key: tr.clip, f }; w[tr.clip] = k; } else { lift = tr.air * 4 * f * (1 - f); w[tr.key] = k; }
    }
  }
  // A fall (a tree): Ski_Fall_L or _R (onto that hip, lying there a moment), then Ski_GetUp on the same side; on
  // the stand-in the people's Fall_Heel, a moment in the snow, Get_Up. The skis stay on.
  let down = 0, daze = 0;
  const fw = {};
  if (u.fall) {
    const fl = u.fall, T1 = u.real ? 1.4 : 1.0, T2 = 1.4 + fl.hold, T3 = T2 + (u.real ? 1.93 : 1); // (the get-up clip's own length)
    fl.t += dt;
    if (fl.t >= T3) u.fall = null;
    else {
      const up = fl.t > T2;
      if (u.real) { // its get-up ends in the standing pose: the last moment eases back into riding
        down = Math.min(1, fl.t / 0.12, (T3 - fl.t) / 0.2);
        if (up) { at(u.SA["up" + fl.side], (fl.t - T2) / (T3 - T2)); fw.skiUp = down; } else { at(u.SA["fall" + fl.side], fl.t / T1); fw.skiFall = down; }
      }
      else { down = Math.min(1, fl.t / 0.12, (T3 - fl.t) / 0.15); if (up) at(u.A.upHeel, (fl.t - T2) / (T3 - T2)); else at(u.A.fallHeel, fl.t / T1); fw[up ? "upHeel" : "fallHeel"] = down; }
      if (fl.hold && fl.t > T1 && !up) daze = Math.sin(fl.t * 5) * 0.14 * Math.min(1, (fl.t - T1) * 3);
      k = Math.max(k, down); lift = 0;
    }
  }
  s.trickK = k;
  u.flip = u.real && u.hkT > 0 && u.hkFlip;
  const mir = u.flip ? -1 : 1; // posed as its mirror image, then mirrored back (finish)
  const skate = s.skate > 0.01 ? { ph: u.skT, k: s.skate } : null;
  weights(u, u.real ? {} : fw);
  if (u.real) {
    const sw = {}; for (const [key, v] of Object.entries(w)) sw[key] = v * (1 - down);
    if (fw.skiFall) sw["fall" + u.fall.side] = fw.skiFall;
    if (fw.skiUp) sw["up" + u.fall.side] = fw.skiUp;
    if (u.SA.skate && skate) at(u.SA.skate, skate.ph);
    if (u.SA.hockey) at(u.SA.hockey, u.hkT / u.SA.hockey.getClip().duration);
    if (trick) at(u.SA[trick.key], trick.f);
    for (const side of ["L", "R"]) if (u.SA["pole" + side] && plant.side === side && !k) { sw["pole" + side] = Math.sin(Math.PI * plant.k); at(u.SA["pole" + side], plant.k); }
    skiWeightsOn(u, sw);
  }
  resetGroups(u);
  // across the way you go: on the stand-in all of the slip; with the clips, what the hockey stop's own swing (78°) leaves
  u.yaw.rotation.y = mir * s.slip * (1 - down) * (u.real ? 1 - Math.min(1, w.hockey * 1.2) * 0.9 : 1);
  const tilt = mir * (u.real ? extraLean(s.edge) * (1 - s.hockey) : s.edge - Math.sign(s.slip) * 0.45 * s.hockey) * (1 - k);
  u.lean.rotation.z = tilt;
  u.lean.position.y = Math.abs(Math.sin(tilt)) * 0.15; // on the edges, not through the snow
  root.updateMatrixWorld(true);
  mix(u);
  if (u.real) { turn(u.B.spine, u.lean, Z, -tilt * 0.18); turn(u.B.chest, u.lean, Z, -tilt * 0.14); }
  else if (!down) { const P = standinParams(w); poseSkiBody(u.C, u.gear, P, { tilt, slip: s.slip, plant, skate }); placePoles(u.C, u.gear, P, { plant, skate }); }
  if (daze) turn(u.B.head, u.lean, Y, daze);
  const rk = s.radio * (1 - down);
  if (rk > 0.01) for (const [b, q] of u.radio) b.quaternion.slerp(q, rk);
  holdProp(u.C, rk > 0.5 ? "Radio_Talk_Ride" : null);
  if (lift) root.position.addScaledVector(r.n, lift);
  finish(root);
}
// Standing still on skis (the top, the lift's ramp, the picture), or pushing up a rise: a blend of the Ski_* clips
// (stand, glide, the push) or of the stand-in poses (ski-core.js STANDIN).
function stillSkier(root, w, skate = null) {
  const u = root.userData, dt = tick(u);
  start(root); u.flip = false;
  resetGroups(u);
  weights(u, {});
  if (u.real) { skiWeightsOn(u, w); if (skate && u.SA.skate) at(u.SA.skate, skate.ph % 1); }
  root.updateMatrixWorld(true);
  mix(u);
  if (!u.real) { const P = standinParams(w); poseSkiBody(u.C, u.gear, P, { skate }); placePoles(u.C, u.gear, P, { skate }); }
  radioOver(u, dt);
  finish(root);
}
