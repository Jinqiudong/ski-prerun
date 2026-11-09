// A rider on skis (双板, a look's ch.sport "ski"): the same character template, the board and its bindings
// hidden, two skis on the boots and a pole in each hand, facing the way they go. Until the character AI's ski
// gear and clips arrive (docs/SKI_RIDERS.md: Ski_* meshes, MAT_ski_top / MAT_ski_base / MAT_pole, Ski_* clips)
// the gear here is a stand-in made in code, and the pose is the skeleton posed by hand from ski-core.js STANDIN's
// numbers: the hips lowered, the legs and arms reached to their targets (two-bone IK), the feet kept flat on
// their skis. With the real files it only hides the board and leaves the pose to the clips (boarder.js).
// Used by boarder.js (the ride) and start.js (the rider page).
import * as THREE from "three";
import { standinParams, skiWeights, newPlant, plantStep } from "./ski-core.js?v=1";

// Each friend's board picks the skis' colours too (top, the stripe along it): A..D, as character.js BOARDS.
export const SKI_COLORS = { A: ["#55604b", "#e3dccb"], B: ["#1f2430", "#8fb8e6"], C: ["#b8326e", "#f3efe6"], D: ["#e9ecef", "#e8742a"] };
const POLE_COLOR = "#2b2d33";

// Whether a template's file has the real ski gear (the character AI's), and its clips.
export const hasSkiGear = (C) => { let y = false; C.root.traverse((o) => { if (o.isMesh && /^Ski_/.test(o.name)) y = true; }); return y; };
// How far the boots' soles stand over the snow on the stand-in skis (binding plate and ski).
export const SKI_STACK = 0.046;
export const hasSkiClips = (C) => !!C.clips?.Ski_Glide;

// A ski, 0.92 × the rider's height long, along +z with its middle at the origin and its top at y = 0: waisted
// (wider at the tip and tail), the tip turned up, the tail a little.
function skiGeometry(L) {
  const g = new THREE.BoxGeometry(0.075, 0.018, L, 1, 1, 28); g.translate(0, -0.009, 0);
  const p = g.attributes.position, h = L / 2;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), u = Math.abs(z) / h;
    p.setX(i, p.getX(i) * (1 + 0.32 * u * u));
    if (z > h - 0.2) { const t = (z - (h - 0.2)) / 0.2; p.setY(i, p.getY(i) + t * t * 0.075); p.setZ(i, z - t * t * 0.03); }
    if (z < -h + 0.08) { const t = (-h + 0.08 - z) / 0.08; p.setY(i, p.getY(i) + t * t * 0.025); }
  }
  g.computeVertexNormals();
  return g;
}
// A pole, its grip's top at the origin and its shaft down -y to the tip: grip, strap-less shaft, a basket.
function poleObject(L) {
  const pole = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: POLE_COLOR, roughness: 0.45, metalness: 0.5, name: "MAT_pole" });
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.015, 0.14, 8), new THREE.MeshStandardMaterial({ color: "#1b1c20", roughness: 0.8, name: "MAT_pole_grip" }));
  grip.position.y = -0.07;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, L - 0.12, 6), mat); shaft.position.y = -0.12 - (L - 0.12) / 2;
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.008, 12), new THREE.MeshStandardMaterial({ color: "#3a3d44", roughness: 0.7, name: "MAT_pole_basket" }));
  basket.position.y = -L + 0.09;
  for (const m of [grip, shaft, basket]) { m.castShadow = true; m.name = "Pole_part"; pole.add(m); }
  pole.userData.L = L;
  return pole;
}

// Put a template's character on skis: board and bindings hidden; the stand-in skis on the feet and poles for
// the hands unless the file has its own (Ski_*). Measures the bones the stand-in pose needs, in the model's own
// frame (it must be in its rest pose, unposed: right after makeCharacter, or with every clip's weight at 0).
// Returns the gear: { skis: [L, R], poles: [L, R], real, rig, colors(board) }.
// { rigOnly }: only the measures (the real gear is on: ski.js), nothing put on or hidden.
export function dressSkier(C, ch, { rigOnly = false } = {}) {
  const root = C.root, real = rigOnly || hasSkiGear(C);
  if (!rigOnly) root.traverse((o) => { if (o.isMesh && /^(Board|Bindings)_/.test(o.name)) o.visible = false; });
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const at = (n) => C.bones[n.replace(".", "")].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv); // in the model's frame (unscaled)
  // The boots' soles (the board left out): where the skis go.
  const boots = new THREE.Box3(); root.traverse((o) => { if (o.isMesh && /^Boots_/.test(o.name)) boots.expandByObject(o, true); });
  const sole = boots.isEmpty() ? 0 : boots.min.clone().applyMatrix4(inv).y, toe = boots.isEmpty() ? 0.15 : boots.max.clone().applyMatrix4(inv).z;
  const rig = {
    hips: at("Hips"), hipL: at("Thigh.L"), hipR: at("Thigh.R"), kneeL: at("Shin.L"), ankL: at("Foot.L"), ankR: at("Foot.R"),
    shL: at("UpperArm.L"), elL: at("Forearm.L"), wrL: at("Hand.L"), sole, toe,
    footQ: {}, // each foot's rest turn in the model's frame
  };
  rig.thigh = rig.hipL.distanceTo(rig.kneeL); rig.shin = rig.kneeL.distanceTo(rig.ankL);
  rig.upper = rig.shL.distanceTo(rig.elL); rig.fore = rig.elL.distanceTo(rig.wrL);
  rig.ankH = rig.ankL.y - sole; // ankle over the sole
  const rq = root.getWorldQuaternion(new THREE.Quaternion()).invert();
  for (const f of ["L", "R"]) rig.footQ[f] = rq.clone().multiply(C.bones["Foot" + f].getWorldQuaternion(new THREE.Quaternion()));
  const gear = { skis: [], poles: [], real, rig, mats: null };
  if (!real) {
    const tall = (ch?.height || 165) / 100, L = 0.92 * tall;
    const top = new THREE.MeshStandardMaterial({ color: "#55604b", roughness: 0.4, metalness: 0.05, name: "MAT_ski_top" });
    const base = new THREE.MeshStandardMaterial({ color: "#26282d", roughness: 0.6, name: "MAT_ski_base" });
    const stripe = new THREE.MeshStandardMaterial({ color: "#e3dccb", roughness: 0.5, name: "MAT_ski_stripe" });
    const bind = new THREE.MeshStandardMaterial({ color: "#3b3d42", roughness: 0.5, metalness: 0.3, name: "MAT_ski_binding" });
    gear.mats = { top, stripe };
    const geo = skiGeometry(L), sg = new THREE.BoxGeometry(0.02, 0.002, L * 0.7), bg = new THREE.BoxGeometry(0.06, 0.028, 0.34);
    for (const f of ["L", "R"]) {
      const foot = C.bones["Foot" + f], ank = f === "L" ? rig.ankL : rig.ankR;
      const ski = new THREE.Group(); ski.name = "Ski_" + f + "_standin";
      const body = new THREE.Mesh(geo, [base, base, top, base, base, base]); body.castShadow = true; body.position.y = -0.028; // under the binding plate
      const st = new THREE.Mesh(sg, stripe); st.position.set(0, -0.027, -0.02);
      const bd = new THREE.Mesh(bg, bind); bd.position.y = -0.014; bd.castShadow = true;
      ski.add(body, st, bd);
      // Under the boot: its middle a little behind the toe, along the model's +z, flat; carried by the foot.
      ski.position.copy(root.localToWorld(new THREE.Vector3(ank.x, sole, (toe + ank.z) / 2 - 0.02)));
      ski.quaternion.copy(root.getWorldQuaternion(new THREE.Quaternion()));
      foot.attach(ski);
      gear.skis.push(ski);
    }
    for (const f of ["L", "R"]) { const p = poleObject(0.7 * tall); p.name = "Pole_" + f + "_standin"; root.add(p); gear.poles.push(p); }
  }
  colorSkis(gear, ch);
  return gear;
}
// The skis in the colours of the board picked (ch.board).
export function colorSkis(gear, ch) {
  if (!gear?.mats) return;
  const [a, b] = SKI_COLORS[ch?.board] || SKI_COLORS.A;
  gear.mats.top.color.set(a); gear.mats.stripe.color.set(b);
}
// The character AI's skis (ski.js C.skiGear) in a wash of the board picked's colour over their own graphic (white:
// the graphic as drawn, board A).
export function tintSkiGear(C, ch) {
  const [a] = SKI_COLORS[ch?.board] || SKI_COLORS.A, c = new THREE.Color(a).lerp(new THREE.Color("#ffffff"), 0.45);
  for (const g of C.skiGear || []) g.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.name === "MAT_ski_top") m.color.copy(ch?.board && ch.board !== "A" ? c : new THREE.Color("#ffffff")); });
}
// Back to a board: the stand-ins taken off, the board shown again.
export function undressSkier(C, gear) {
  for (const o of [...(gear?.skis || []), ...(gear?.poles || [])]) o.removeFromParent();
  C.root.traverse((o) => { if (o.isMesh && /^(Board|Bindings)_/.test(o.name)) o.visible = true; });
}

// ---- posing the skeleton by hand ----
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _m = new THREE.Vector3(), _n = new THREE.Vector3(), _k = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3();
// Turn a bone so its child lies toward a world point.
function aim(bone, child, target) {
  const P = bone.getWorldPosition(_a), cur = child.getWorldPosition(_b).sub(P).normalize(), want = _c.copy(target).sub(P).normalize();
  if (cur.lengthSq() < 1e-8 || want.lengthSq() < 1e-8) return;
  _q.setFromUnitVectors(cur, want).multiply(bone.getWorldQuaternion(_q2));
  bone.quaternion.copy(bone.parent.getWorldQuaternion(_q3).invert().multiply(_q));
  bone.updateMatrixWorld(true);
}
// Two bones (upper → lower → end) reaching the end to a world target, bending toward a world direction (pole).
function reach(upper, lower, end, target, pole, la, lb) {
  const A = upper.getWorldPosition(_d).clone(), dir = _t.copy(target).sub(A), d = Math.min(la + lb - 1e-4, Math.max(Math.abs(la - lb) + 1e-3, dir.length()));
  dir.normalize();
  const cosA = (la * la + d * d - lb * lb) / (2 * la * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  _n.copy(dir).cross(pole); if (_n.lengthSq() < 1e-8) _n.set(1, 0, 0); _n.normalize();
  _m.copy(_n).cross(dir).normalize(); // in the plane, toward the pole
  const K = _k.copy(A).addScaledVector(dir, la * cosA).addScaledVector(_m, la * sinA).clone();
  aim(upper, lower, K);
  aim(lower, end, _p.copy(A).addScaledVector(dir, d));
}
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
// Rotate a bone about an axis given in the model's frame.
function turnIn(C, bone, axis, angle) {
  if (!bone || !angle) return;
  const ax = _a.copy(axis).transformDirection(C.root.matrixWorld);
  bone.parent.getWorldQuaternion(_q3); ax.applyQuaternion(_q3.invert()).normalize();
  bone.quaternion.premultiply(_q.setFromAxisAngle(ax, angle));
  bone.updateMatrixWorld(true);
}

// The stand-in pose on a character in its rest pose (call after the mixer has put it back): P from ski-core.js
// standinParams, plus { tilt (the body's lean into the turn, for the angulation), slip (the skis turned across
// the way you go: the chest turns back toward it), plant: { side, k } (a pole plant), skate (its phase, s) }.
// Legs and arms only; the clips' upper body stays when { legsOnly }.
export function poseSkiBody(C, gear, P, { tilt = 0, slip = 0, plant = null, skate = null, legsOnly = false } = {}) {
  const R = gear.rig, B = C.bones, root = C.root, w = (v) => root.localToWorld(v);
  root.updateMatrixWorld(true);
  // Hips: down and back.
  const hp = w(_p.set(R.hips.x, R.hips.y - P.drop, R.hips.z - P.back)).clone();
  B.Hips.position.copy(B.Hips.parent.worldToLocal(hp)); B.Hips.updateMatrixWorld(true);
  turnIn(C, B.Hips, X, P.fwd * 0.25); // the pelvis tipped forward a little
  // Skating: one leg pushing out to the side while the other glides, then the other.
  let pushL = 0, pushR = 0;
  if (skate) { const s = Math.sin(skate.ph * Math.PI * 2) * skate.k; pushL = Math.max(0, s); pushR = Math.max(0, -s); }
  // Legs: each ankle over its ski, knees bending forward (and a touch in for a plough).
  for (const f of ["L", "R"]) {
    const sg = f === "L" ? 1 : -1, push = f === "L" ? pushL : pushR;
    const ank = w(_b.set(sg * (P.width + push * 0.16), R.sole + R.ankH + P.ankUp + push * 0.04, (R.ankL.z + sg * P.lead / 2) - push * 0.12)).clone();
    const pole = _c.set(sg * P.toe * 0.6, 0, 1).transformDirection(root.matrixWorld).clone();
    reach(B["Thigh" + f], B["Shin" + f], B["Foot" + f], ank, pole, R.thigh * root.scale.x, R.shin * root.scale.x);
    // the foot flat on its ski, the ski turned: tips in for a plough, out for a skate (and the pushing ski out more)
    const yaw = -sg * P.toe + sg * push * 0.25;
    _q.copy(root.getWorldQuaternion(_q2)).multiply(_q3.setFromAxisAngle(Y, yaw)).multiply(R.footQ[f]);
    B["Foot" + f].quaternion.copy(B["Foot" + f].parent.getWorldQuaternion(_q2).invert().multiply(_q));
    B["Foot" + f].updateMatrixWorld(true);
  }
  if (legsOnly) return;
  // The upper body: bent forward, the chest turned back toward the way you go (and against the turn), staying
  // more upright than the legs (angulation); the head up, looking ahead.
  turnIn(C, B.Spine, X, P.fwd * 0.4); turnIn(C, B.Chest, X, P.fwd * 0.3);
  turnIn(C, B.Spine, Y, (P.counter - slip * 0.45) * 0.5); turnIn(C, B.Chest, Y, (P.counter - slip * 0.45) * 0.5);
  turnIn(C, B.Spine, Z, -tilt * 0.22); turnIn(C, B.Chest, Z, -tilt * 0.16);
  turnIn(C, B.Neck, X, -P.fwd * 0.35); turnIn(C, B.Head, X, -P.fwd * 0.3);
  // Arms: hands out in front (a plant reaches one forward and down), elbows out and a little back.
  const hipY = R.hips.y - P.drop, dbl = skate ? Math.max(0, Math.sin(skate.ph * Math.PI * 4)) * skate.k : 0;
  for (const f of ["L", "R"]) {
    const sg = f === "L" ? 1 : -1, pk = plant?.side === f ? Math.sin(Math.PI * plant.k) : 0;
    const out = P.hand[0] - pk * 0.04, up = P.hand[1] - pk * 0.05 + dbl * 0.12, ahead = P.hand[2] - P.back + pk * 0.16 + dbl * 0.1;
    const hand = w(_b.set(sg * out, hipY + up, R.hips.z + ahead)).clone();
    const pole = _c.set(sg * (0.8 + P.arm), -0.4 + P.arm, -0.6 * (1 - P.arm)).transformDirection(root.matrixWorld).clone();
    reach(B["UpperArm" + f], B["Forearm" + f], B["Hand" + f], hand, pole, R.upper * root.scale.x, R.fore * root.scale.x);
  }
}

// The stand-in poles: from each fist to its tip (P.tip: out, ahead of the boots, up off the snow; a plant puts
// it in the snow ahead of the boots and lets it drag back past them; a skate's double-pole pushes back).
// parent: the object the poles hang under (start of a frame, not mirrored); hidden: off (the chair).
// planted: stuck upright in the snow beside the skier (hands busy: a wave, a photo).
export function placePoles(C, gear, P, { plant = null, skate = null, hidden = false, planted = false } = {}) {
  if (!gear?.poles?.length) return;
  const R = gear.rig, root = C.root;
  for (let i = 0; i < 2; i++) {
    const p = gear.poles[i], f = i ? "R" : "L", sg = i ? -1 : 1;
    p.visible = !hidden; if (hidden) continue;
    const par = p.parent; par.updateMatrixWorld(true); p.scale.setScalar(1 / par.getWorldScale(_c).x); // its own length, whatever the rider's height
    if (planted) { // the two together off the right ski, leaning a little apart, a hand's width into the snow
      const base = root.localToWorld(_b.set(-0.42 + i * 0.07, R.sole - SKI_STACK - 0.12, R.ankL.z + 0.12 - i * 0.1)).clone();
      const dir = _c.set(0.06 - i * 0.12, 1, 0.04).transformDirection(root.matrixWorld).clone();
      p.position.copy(par.worldToLocal(base.addScaledVector(dir, p.userData.L)));
      p.quaternion.copy(par.getWorldQuaternion(_q2).invert().multiply(_q.setFromUnitVectors(_a.set(0, 1, 0), dir)));
      continue;
    }
    const hand = C.bones["Hand" + f].getWorldPosition(_a).clone();
    const pk = plant?.side === f ? plant.k : -1, dbl = skate ? Math.sin(skate.ph * Math.PI * 4) * skate.k : 0;
    let tx = P.tip[0], tz = P.tip[1] - P.back, ty = P.tip[2];
    if (pk >= 0) { const s = Math.sin(Math.PI * Math.min(1, pk * 1.6)); tx += (0.3 - tx) * s; tz += (0.55 - tz) * s; ty *= 1 - s; }
    if (dbl) { tz += dbl > 0 ? 0.3 * dbl : 0.5 * dbl; ty = Math.max(0, ty); }
    const tip = root.localToWorld(_b.set(sg * tx, R.sole - SKI_STACK + 0.01 + ty, R.ankL.z + tz)).clone();
    // the grip just above the fist; the shaft toward the tip
    const dir = tip.sub(hand).normalize();
    const top = hand.clone().addScaledVector(dir, -0.06);
    p.position.copy(par.worldToLocal(top.clone()));
    const wq = _q.setFromUnitVectors(_c.set(0, -1, 0), dir);
    p.quaternion.copy(par.getWorldQuaternion(_q2).invert().multiply(wq));
  }
}

export { standinParams };

// ---- The rider page (start.js): the page's full character, playing its pose clips, put on skis ----
// rest: the bones' rest pose ([bone, position, quaternion], taken when the character was made), since a page
// character is already posed when skis go on. Each frame: before() puts back the clip's own output (the mixer
// only writes what changed, and the stand-in pose goes on top), then the character steps, then after(dt, ride,
// still): riding an entrance (ride: { edge, tuck, hockey, slip } from entrance.js) the whole stand-in pose, the
// body leaning into its turns and swung across in the stop; standing, the legs only (narrow, on the skis) under
// the clip's upper body, the poles in hand (still: the plain standing pose) or planted beside (any other pose).
const dampTo = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
// { rigOnly }: on the real gear (ski.js), only the legs under the board's poses (the Ski_ clips need nothing).
export function skiStage(C, ch, rest, { rigOnly = false } = {}) {
  const bones = []; C.root.traverse((o) => { if (o.isBone) bones.push(o); });
  const now = bones.map((b) => [b.position.clone(), b.quaternion.clone()]);
  if (rest) for (const [b, p, q] of rest) { b.position.copy(p); b.quaternion.copy(q); }
  C.root.updateMatrixWorld(true);
  const gear = dressSkier(C, ch, { rigOnly });
  bones.forEach((b, i) => { b.position.copy(now[i][0]); b.quaternion.copy(now[i][1]); });
  C.root.updateMatrixWorld(true);
  const saved = bones.map((b) => [b, b.position.clone(), b.quaternion.clone()]);
  let has = false;
  const plant = newPlant(), s = { edge: 0, tuck: 0, hockey: 0, slip: 0, plough: 0, skate: 0 };
  return {
    gear,
    before() { if (has) for (const [b, p, q] of saved) { b.position.copy(p); b.quaternion.copy(q); } },
    after(dt, ride = null, still = true) {
      for (const x of saved) { x[1].copy(x[0].position); x[2].copy(x[0].quaternion); } has = true;
      for (const k of Object.keys(s)) s[k] = dampTo(s[k], ride?.[k] || 0, k === "slip" ? 5 : 8, dt);
      C.root.rotation.set(0, s.slip, s.edge); C.root.updateMatrixWorld(true);
      if (ride || Math.abs(s.edge) + Math.abs(s.slip) + s.hockey + s.tuck > 0.02) {
        const pl = plantStep(plant, s.edge, ride ? 6 : 0, dt), w = skiWeights(s), P = standinParams(w);
        poseSkiBody(C, gear, P, { tilt: s.edge, slip: s.slip, plant: pl });
        placePoles(C, gear, P, { plant: pl });
        return;
      }
      const P = standinParams({ stand: 1 });
      poseSkiBody(C, gear, P, { legsOnly: true });
      placePoles(C, gear, P, { planted: !still });
    },
    off() { C.root.rotation.set(0, 0, 0); if (!rigOnly) undressSkier(C, gear); has = false; },
  };
}
