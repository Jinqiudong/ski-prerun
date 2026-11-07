// An animal rider: one of the resort animals (the start map's desk pets, assets/animals/3d/<name>.glb, rigged
// with a walk cycle by tools/build_animals.py) standing on a snowboard, at a toy size (animal-core.js). No
// human skeleton and no clips: everything but the walk cycle is procedural. The board leans, edges and skids
// exactly as the template rider's Board does (boarder.js); the animal leans with it, crouches in turns and
// tucks, hops and spins with it, tumbles in a fall, sits on the chair with the board hanging below.
// Each animal's file loads once and is shared by every rider made from it; it goes when the last one does.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { animalOf, ANIMAL_SIZE } from "./animal-core.js?v=1";

const gltf = new GLTFLoader();
const files = {}; // animal → { p: the loaded file, n: riders made from it }
// Start loading an animal (the rider page or the ride, early); a rider made later shares it.
export const loadAnimal = (a) => (files[a] ||= { p: gltf.loadAsync(`assets/animals/3d/${a}.glb?v=1`).then(prepare), n: 0 }).p;
function dropFile(a) {
  const f = files[a]; if (!f || --f.n > 0) return;
  delete files[a];
  f.p.then((g) => g.scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); for (const m of [].concat(o.material)) m.dispose(); } }));
}
// Measured once per file, in its rest pose: its box and where its legs stand (the board goes under them).
function prepare(g) {
  const o = g.scene; o.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(o), legs = new THREE.Vector3(), v = new THREE.Vector3();
  let n = 0; for (const k of ["thighFL", "thighFR", "thighHL", "thighHR"]) { const b = o.getObjectByName(k); if (b) { legs.add(b.getWorldPosition(v)); n++; } }
  if (n) legs.divideScalar(n); else box.getCenter(legs);
  const spine = o.getObjectByName("spine")?.getWorldPosition(new THREE.Vector3());
  o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; for (const mt of [].concat(m.material)) mt.roughness = 0.9; } });
  g.userData.fit = { box, legs, spineY: spine ? spine.y : box.min.y + (box.max.y - box.min.y) * 0.55 };
  return g;
}

// ---- The board: a strip along z with a gentle sidecut, round tips and kicked-up ends, in the board picked on
// the rider page (the template boards' top and base pictures, assets/riders/boards/<k>_<side>.jpg).
export const BOARD_LEN = 1.5, BOARD_W = 0.27, BOARD_T = 0.018;
const TIP = 0.16, KICK = 0.24;
let boardGeo = null;
function boardGeometry() {
  if (boardGeo) return boardGeo;
  const N = 48, P = [], UV = [], I = [], rows = [];
  for (let i = 0; i <= N; i++) {
    const z = -BOARD_LEN / 2 + (BOARD_LEN * i) / N, a = Math.abs(z), e = a - (BOARD_LEN / 2 - TIP);
    let w = BOARD_W / 2 - 0.012 * Math.max(0, 1 - (z / (BOARD_LEN * 0.36)) ** 2);
    if (e > 0) w = Math.max(0.004, w * Math.sqrt(Math.max(0, 1 - (e / TIP) ** 2)));
    rows.push({ z, w, y: Math.max(0, a - (BOARD_LEN / 2 - KICK)) ** 2 * 1.9, v: i / N });
  }
  const groups = [];
  // One strip: two vertices a row (from vert(row, side)), faced up or down.
  const strip = (vert, down, mat) => {
    const s = P.length / 3, start = I.length;
    for (const r of rows) for (const sd of [-1, 1]) { const [x, y, z, u] = vert(r, sd); P.push(x, y, z); UV.push(u, r.v); }
    for (let i = 0; i < N; i++) { const a = s + i * 2, b = a + 2; if (down) I.push(a, a + 1, b, a + 1, b + 1, b); else I.push(a, b, a + 1, a + 1, b, b + 1); }
    groups.push([start, I.length - start, mat]);
  };
  strip((r, sd) => [sd * r.w, r.y + BOARD_T, r.z, 0.5 + (sd * r.w) / BOARD_W], false, 0); // top
  strip((r, sd) => [sd * r.w, r.y, r.z, 0.5 - (sd * r.w) / BOARD_W], true, 1); // base
  for (const sd of [-1, 1]) strip((r, k) => [sd * r.w, r.y + (k > 0 ? BOARD_T : 0), r.z, 0], sd > 0, 2); // the edges
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I); for (const [s, c, m] of groups) g.addGroup(s, c, m);
  g.computeVertexNormals();
  return (boardGeo = g);
}
const boardMats = {};
const boardTex = (k, side) => { const t = new THREE.TextureLoader().load(`assets/riders/boards/${k}_${side}.jpg?v=1`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
// The board's materials, named as the template's are (the rider page opens the board when one is tapped).
function boardMat(k) {
  return (boardMats[k] ||= [
    Object.assign(new THREE.MeshStandardMaterial({ map: boardTex(k, "top"), roughness: 0.45 }), { name: "MAT_board_top" }),
    Object.assign(new THREE.MeshStandardMaterial({ map: boardTex(k, "base"), roughness: 0.35 }), { name: "MAT_board_base" }),
    Object.assign(new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.5, metalness: 0.3 }), { name: "MAT_board_edge" }),
  ]);
}
export function setAnimalBoard(root, k) { const u = root.userData; if (u.boardKey === k) return; u.boardKey = k; u.board.material = boardMat(/^[A-D]$/.test(k) ? k : "A"); }

// The animal stands a little turned on the board (regular: toward +x; goofy is mirrored), like a rider's stance.
const STANCE = 0.32;
// root sits at the board's base with local +z the way it rides, as boarder.js's rider does:
//   root → yaw (board skidding across) → lean (board on its edge) → board, and turn (the stance) → body → model
export async function animalRider({ animal, board = "A", stance = "regular" }) {
  const a = animalOf(animal) || "fox";
  const g = await loadAnimal(a); files[a].n++;
  const { box, legs, spineY } = g.userData.fit, Z = ANIMAL_SIZE[a];
  const sc = Math.min(Z.len / (box.max.z - box.min.z), Z.tall / (box.max.y - box.min.y));
  const model = clone(g.scene);
  model.scale.setScalar(sc);
  model.position.set(-legs.x * sc, BOARD_T + 0.004 - box.min.y * sc, -legs.z * sc); // its legs over the board's middle, feet on top
  const root = new THREE.Group(), yaw = new THREE.Group(), lean = new THREE.Group(), turn = new THREE.Group(), body = new THREE.Group();
  const boardMesh = new THREE.Mesh(boardGeometry(), boardMat("A")); boardMesh.castShadow = true; boardMesh.receiveShadow = true;
  root.add(yaw); yaw.add(lean); lean.add(boardMesh, turn); turn.add(body); body.add(model);
  const mixer = new THREE.AnimationMixer(model), clip = g.animations[0], walk = clip ? mixer.clipAction(clip) : null;
  if (walk) { walk.play(); walk.paused = true; walk.setEffectiveWeight(0); }
  const head = model.getObjectByName("head") || null;
  const tall = (box.max.y - box.min.y) * sc;
  root.userData = {
    kind: "animal", animal: a, yaw, lean, turn, body, model, board: boardMesh, mixer, walk, clipDur: clip ? clip.duration : 1, head, headMixed: head ? head.quaternion.clone() : null,
    goofy: stance === "goofy", flip: stance === "goofy", tall, sc,
    box: { minY: BOARD_T, maxY: BOARD_T + tall, minZ: (box.min.z - legs.z) * sc, maxZ: (box.max.z - legs.z) * sc }, backY: BOARD_T + (spineY - box.min.y) * sc,
    edgeX: [-BOARD_W / 2, BOARD_W / 2], s: { edge: 0, skid: 0, tuck: 0, push: 0 }, at: 0, walkT: 0, t: 0, gaze: { y: 0, p: 0, ty: 0, tp: 0, wait: 2 },
  };
  setAnimalBoard(root, board);
  return root;
}
// An animal rider gone: its skeleton and mixer go; the file goes with the last rider made from it.
export function disposeAnimal(root) {
  const u = root?.userData; if (u?.kind !== "animal" || !u.mixer) return;
  root.removeFromParent();
  u.mixer.stopAllAction(); u.mixer.uncacheRoot(u.model);
  u.model.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.dispose(); });
  u.mixer = null; dropFile(u.animal);
}

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const ease = (x) => x * x * (3 - 2 * x);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _ax = new THREE.Vector3();
const start = (root) => { root.scale.set(1, 1, 1); root.updateMatrixWorld(true); };
const finish = (root) => { root.scale.x = root.userData.flip ? -1 : 1; root.updateMatrixWorld(true); };
const tick = (u) => { const now = performance.now(), dt = u.at ? Math.min(0.1, (now - u.at) / 1000) : 0.016; u.at = now; return dt; };
// Everything back to riding straight on the board.
function rest(u) {
  u.yaw.position.set(0, 0, 0); u.yaw.rotation.set(0, 0, 0); u.lean.position.set(0, 0, 0); u.lean.rotation.set(0, 0, 0);
  u.turn.rotation.set(0, STANCE, 0); u.body.position.set(0, 0, 0); u.body.rotation.set(0, 0, 0); u.body.scale.set(1, 1, 1);
  u.board.position.set(0, 0, 0); u.board.rotation.set(0, 0, 0);
}
// The walk cycle (weight 0..1, its phase advanced by rate), then the head turned on top: yaw to the left (+),
// pitch down (+). The mixer only writes a bone whose blend changed, so the head's last mix is put back first.
function animate(u, dt, walk = 0, rate = 1, yaw = 0, pitch = 0) {
  if (u.walk) {
    u.walk.setEffectiveWeight(walk);
    if (walk > 0.01) { u.walkT = (u.walkT + (dt * rate) / u.clipDur) % 1; u.walk.time = u.walkT * u.clipDur; }
  }
  if (u.head) u.head.quaternion.copy(u.headMixed);
  u.mixer.update(0);
  if (!u.head) return;
  u.headMixed.copy(u.head.quaternion);
  u.model.updateMatrixWorld(true);
  for (const [axis, ang] of [[Y, yaw], [X, pitch]]) {
    if (!ang) continue;
    _ax.copy(axis).transformDirection(u.body.matrixWorld);
    u.head.parent.getWorldQuaternion(_pq);
    _ax.applyQuaternion(_pq.invert()).normalize();
    u.head.quaternion.premultiply(_q.setFromAxisAngle(_ax, ang));
  }
}
// Alive while it stands: a slow breath, and the head picking somewhere to look (as the template's step does).
function idleLife(u, dt) {
  u.t += dt; const G = u.gaze;
  if ((G.wait -= dt) < 0) { G.wait = 2 + Math.random() * 3.5; const away = Math.random() < 0.6; G.ty = away ? (Math.random() - 0.5) * 1.2 : 0; G.tp = away ? (Math.random() - 0.5) * 0.3 : 0; }
  const k = 1 - Math.exp(-dt * 2.4); G.y += (G.ty - G.y) * k; G.p += (G.tp - G.p) * k;
  const br = Math.sin(u.t * 2.1) * 0.6 + Math.sin(u.t * 0.7) * 0.4;
  u.body.scale.set(1 - br * 0.006, 1 + br * 0.014, 1 - br * 0.006);
  return [G.y, G.p];
}

// Tricks (the trick wheel in look.html, and the rider page's moves): a hop, a hop with a full turn, and
// pressing the nose or the tail. key, name, air (jump height, m), dur (s), as boarder.js's TRICKS.
export const ANIMAL_TRICKS = [
  { key: "ollie", name: "Ollie", air: 0.9, dur: 0.8 },
  { key: "spin", name: "360", air: 1.2, dur: 1.05 },
  { key: "nose", name: "Nose Press", air: 0, dur: 1.4 },
  { key: "tailPress", name: "Tail Press", air: 0, dur: 1.4 },
];
export function startAnimalTrick(root, key) {
  const t = ANIMAL_TRICKS.find((x) => x.key === key), u = root.userData;
  if (!t || u.trick || u.fall) return false;
  u.trick = { ...t, t: 0 };
  return true;
}
// A tumble: over sideways (heel: the way it rolls), a moment lying in the snow, back up.
// hold: seconds more lying there (dazed after a crash). Returns how long it all takes (s).
export function fallAnimal(root, heel = null, hold = 0) {
  const u = root.userData; if (u.fall) return false;
  u.trick = null; u.fall = { t: 0, hold, side: (heel ?? u.s.edge >= 0) ? 1 : -1 };
  return 2.1 + hold;
}

// The board and the animal from u.s (edge, skid, tuck, push: already eased) and a trick or a fall going on.
// Returns how high the hop is (m, along the snow's normal).
function ride(u, dt) {
  const s = u.s;
  let k = 0, lift = 0, spin = 0, press = 0, squat = 0;
  if (u.trick) {
    const tr = u.trick; tr.t += dt; const f = tr.t / tr.dur;
    if (f >= 1) u.trick = null;
    else {
      k = Math.min(1, f / 0.22, (1 - f) / 0.22);
      if (tr.air) {
        // crouch, pop, tuck the legs in at the top, land soft
        const up = Math.max(0, (f - 0.12) / 0.88);
        lift = f < 0.12 ? 0 : tr.air * 4 * up * (1 - up);
        squat = f < 0.12 ? Math.sin((f / 0.12) * Math.PI) * 0.22 : Math.sin(up * Math.PI) * 0.1 + Math.max(0, (up - 0.85) / 0.15) * 0.14;
      }
      if (tr.key === "spin") spin = f < 0.12 ? 0 : ease(Math.min(1, (f - 0.12) / 0.8)) * Math.PI * 2;
      if (tr.key === "nose") press = k * 0.2; if (tr.key === "tailPress") press = -k * 0.2;
    }
  }
  let down = 0, roll = 0, rise = 0;
  if (u.fall) {
    const fl = u.fall, T1 = 0.75, T2 = 1.45 + (fl.hold || 0), T3 = 2.1 + (fl.hold || 0); fl.t += dt;
    if (fl.t >= T3) u.fall = null;
    else {
      down = Math.min(1, fl.t / 0.1, (T3 - fl.t) / 0.15);
      if (fl.t < T1) { const f = fl.t / T1; roll = ease(f) * Math.PI * 2.5; rise = Math.sin(f * Math.PI) * 0.45; }
      else if (fl.t < T2) roll = Math.PI * 2.5 + (fl.hold ? Math.sin(fl.t * 5) * 0.06 : 0); // lying there, dazed: a slow wobble
      else { const f = (fl.t - T2) / (T3 - T2); roll = Math.PI * 2 + (Math.PI / 2) * (1 - ease(f)); rise = Math.sin(f * Math.PI) * 0.15; }
      roll *= fl.side; k = Math.max(k, down); lift = 0; spin = 0; press = 0; squat = 0;
    }
  }
  rest(u);
  // Skid: the board swings across the way you go; on an edge it tilts, pivoting on the edge in the snow.
  u.yaw.rotation.y = -1.2 * s.skid * (1 - down) + spin;
  const tilt = (s.edge * (1 - s.skid) - 0.3 * s.skid) * (1 - k);
  u.lean.rotation.set(press, 0, tilt + roll);
  u.lean.position.y = -Math.min(u.edgeX[0] * Math.sin(tilt), u.edgeX[1] * Math.sin(tilt)) + Math.max(0, (BOARD_LEN / 2) * Math.abs(Math.sin(press)) - 0.09);
  if (roll) { const h = u.tall * 0.42; u.lean.position.x += h * Math.sin(roll); u.lean.position.y += h * (1 - Math.cos(roll)) + rise; }
  // The animal: lower in a turn and a tuck, a little more upright than the board, over the nose or the tail in a press.
  const crouch = (Math.min(1, Math.abs(s.edge) / 0.5) * 0.1 + s.tuck * 0.12 + squat) * (1 - down);
  u.body.scale.set(1 + crouch * 0.35, 1 - crouch, 1 + crouch * 0.15);
  u.body.rotation.set(press * 0.8, 0, -tilt * 0.3);
  u.turn.rotation.y = STANCE * (1 - s.push * 0.7); // pushing along: facing the way it goes, legs paddling
  // the head looks into the turn and back round in a spin
  animate(u, dt, s.push, 1.6, s.edge * 0.6 - Math.sin(spin) * 0.5, -press * 0.8 + crouch * 0.6);
  return lift;
}

// Riding: from the physics state (board.js's Rider), as poseBoarder.
export function poseAnimal(root, r) {
  const u = root.userData, s = u.s, dt = r.dt || 0.016, g = u.goofy ? -1 : 1;
  u.at = performance.now(); u.flip = u.goofy;
  start(root);
  root.position.set(r.x, r.y, r.z);
  root.quaternion.setFromUnitVectors(Y, r.n);
  root.rotateY(r.heading);
  s.edge = damp(s.edge, clamp(g * r.lean, -0.9, 0.9), 8, dt);
  s.skid = damp(s.skid, r.skid ?? (r.braking ? 1 : 0), 5, dt);
  s.tuck = damp(s.tuck, Math.max(r.tuck ?? 0, r.absorb ?? 0), r.absorb ? 9 : 4, dt); // a tuck, or soaking up a bump
  s.push = damp(s.push, r.pushing || r.walking ? 1 : 0, 6, dt);
  const lift = ride(u, dt);
  root.updateMatrixWorld(true);
  if (lift) root.position.addScaledVector(r.n, lift);
  finish(root);
}

// On the chair, facing the way it goes (root +z): sitting up on its haunches on the cushion, its rump on
// `seat` (boarder.js SEAT: a point in root's frame just above the cushion), the board hanging below its hind
// feet; looking about as you turn the phone (lookYaw > 0: to the left).
export function sitAnimal(root, lookYaw = 0, seat = new THREE.Vector3(0, 0.6, -0.08)) {
  const u = root.userData, dt = tick(u);
  start(root); u.flip = false; u.trick = u.fall = null;
  rest(u); u.turn.rotation.y = 0;
  const P = 0.7, c = Math.cos(P), sn = Math.sin(P), B = u.box;
  u.body.rotation.x = -P; // nose up
  // its lowest back corner, turned: onto the cushion, toward the back of the seat
  u.body.position.set(0, seat.y - 0.03 - (B.minY * c + B.minZ * sn), seat.z - 0.14 - (-B.minY * sn + B.minZ * c));
  u.board.position.set(0, seat.y - 0.5, seat.z + 0.42); u.board.rotation.set(0.5, 0, 0);
  const [gy, gp] = idleLife(u, dt);
  animate(u, dt, 0, 1, clamp(lookYaw * 0.8, -1, 1) + gy * 0.4, gp - 0.25);
  finish(root);
}
// Standing on the board: at the top, gliding off the chair (k), and still for a picture.
export function idleAnimal(root) {
  const u = root.userData, dt = tick(u);
  start(root); u.flip = u.goofy; u.trick = u.fall = null;
  rest(u);
  const [gy, gp] = idleLife(u, dt);
  animate(u, dt, 0, 1, gy, gp);
  finish(root);
}
// On foot, the board on its back (a hike-to): the walk cycle at the walk's pace (phase in steps).
export function hikeAnimal(root, phase) {
  const u = root.userData, dt = tick(u);
  start(root); u.flip = u.goofy;
  rest(u); u.turn.rotation.y = 0;
  u.board.position.set(0, u.backY + 0.06 * u.tall + 0.03, 0); u.board.rotation.set(0, 0, 0);
  u.walkT = ((phase / 2) % 1 + 1) % 1;
  animate(u, 0, 1);
  u.lean.position.y = Math.abs(Math.sin(phase * Math.PI)) * 0.03;
  finish(root);
}

// On the rider page: the same animal as a stage figure, as character.js's makeCharacter is one there:
// { root, play(name), step(dt), current }. Standing is the walk cycle, slow; the moves are the tricks, again
// and again with a breath between ({ once }: one, then standing).
export const PET_MOVES = [["Anim_Ollie", "Ollie", "ollie"], ["Animal_Spin", "转一圈", "spin"], ["Anim_Nose_Press", "压板头", "nose"], ["Anim_Tail_Press", "压板尾", "tailPress"]];
export function animalStage(root) {
  const u = root.userData; let cur = "Stand_Idle", wait = 0, once = false;
  // Turned three-quarters to the camera, the board across the picture.
  root.rotation.y = Math.PI / 2 - 0.5;
  const S = {
    root, isAnimal: true, animal: u.animal, tall: u.tall, bones: {},
    get current() { return cur; },
    setBoard: (k) => setAnimalBoard(root, k),
    play(name, o = {}) { const m = PET_MOVES.find(([n]) => n === name); cur = m ? name : "Stand_Idle"; u.trick = null; wait = 0; once = !!o.once; },
    step(dt) {
      let m = PET_MOVES.find(([n]) => n === cur);
      if (m && !u.trick && (wait -= dt) < 0) { startAnimalTrick(root, m[2]); wait = 0.9; if (once) { cur = "Stand_Idle"; m = null; once = false; } }
      u.flip = false;
      const lift = ride(u, dt);
      if (!m && !u.trick) { const [gy, gp] = idleLife(u, dt); animate(u, dt, 1, 0.35, gy * 0.6, gp); }
      root.position.y = lift * 0.35; // a toy hop: the ride's jump would leave the picture
    },
    dispose: () => disposeAnimal(root),
  };
  return S;
}
