// Riders dressed as the people on the trip. A base body (Quaternius Universal Base Characters, CC0) with
// clothes grown from the body itself: the jacket, baggy pants, gloves and boots are shells pushed out
// from the skin and bound to the same skeleton, so they move with it. Helmet, goggles, hair and the
// board are added on top. No faces or photos: friends are told apart by what they wear.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Each rider's kit, from the design sheets and photos the owner shared (2026-11-01).
export const RIDERS = {
  a: {
    name: "Rider A", sex: "Male", height: 1.78, kind: "board", hair: "Hair_Buzzed", hairColor: 0x1b1714,
    jacket: 0x1a1b1e, jacketPanel: 0x1a1b1e, pants: 0x17181b, gloves: 0x111214, boots: 0x15161a,
    helmet: 0x1c1d20, goggle: 0x4b4bd8, goggleTint: 0x8a3cff, balaclava: 0x111214, board: "a",
  },
  b: {
    name: "Rider B", sex: "Female", height: 1.58, kind: "board", hair: "Hair_Long", hairColor: 0x2a1a12,
    jacket: 0x565b46, jacketPanel: 0x565b46, pants: 0xe2d7c7, gloves: 0xe2d2bb, boots: 0x16171a,
    helmet: 0x111111, goggle: 0xc85a9a, goggleTint: 0xff6fb0, board: "b",
  },
  c: {
    name: "Rider C", sex: "Female", height: 1.62, kind: "board", hair: "Hair_Long", hairColor: 0x3b2618,
    jacket: 0xb9a7c9, jacketPanel: 0x4a3f78, pants: 0xe6dccb, gloves: 0x141416, boots: 0xe9e9ea,
    helmet: 0xb8b2a8, goggle: 0x3a6fd0, goggleTint: 0xff9a3c, board: "c",
  },
  d: { // light grey shell under a black vest, cream helmet, fire-orange goggles, white boots
    name: "Rider D", sex: "Female", height: 1.65, kind: "board", hair: "Hair_Buns", hairColor: 0x1b1410,
    jacket: 0xd9dcde, jacketPanel: 0xd9dcde, vest: 0x141517, pants: 0x141517, gloves: 0x141517, boots: 0xe8eaec,
    helmet: 0xe6dcc0, goggle: 0xff5a1f, goggleTint: 0xff3b1a, balaclava: 0x111214, board: "d",
  },
};

const BASE = "assets/models/ubc/";
const loader = new GLTFLoader();
const cache = new Map();
const load = (name) => {
  if (!cache.has(name)) cache.set(name, loader.loadAsync(`${BASE}${name}.gltf`));
  return cache.get(name);
};

// Which part of the body a vertex belongs to, from the bone that moves it most.
function region(bone) {
  if (/^(Head|neck)/.test(bone)) return "head";
  if (/^(spine|clavicle)/.test(bone)) return "torso";
  if (/^(upperarm|lowerarm)/.test(bone)) return "arm";
  if (/^(hand|index|middle|ring|pinky|thumb)/.test(bone)) return "hand";
  if (/^(thigh|calf)/.test(bone)) return "leg";
  if (/^(foot|ball)/.test(bone)) return "foot";
  if (/^pelvis/.test(bone)) return "pelvis";
  return "other";
}

// A shell over part of the body: the chosen triangles, pushed out along their normals.
function shell(body, keep, push, color, colorAt) {
  const src = body.geometry, pos = src.attributes.position, nor = src.attributes.normal, n = pos.count;
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(n * 3), cols = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const d = keep(i) ? push(i) : 0;
    p[i * 3] = pos.getX(i) + nor.getX(i) * d;
    p[i * 3 + 1] = pos.getY(i) + nor.getY(i) * d;
    p[i * 3 + 2] = pos.getZ(i) + nor.getZ(i) * d;
    c.set(colorAt ? colorAt(i) : color);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
  geo.setAttribute("normal", src.attributes.normal.clone()); // its own: computeVertexNormals below rewrites it
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  geo.setAttribute("skinIndex", src.attributes.skinIndex);
  geo.setAttribute("skinWeight", src.attributes.skinWeight);
  const idx = src.index.array, out = [];
  for (let t = 0; t < idx.length; t += 3) if (keep(idx[t]) && keep(idx[t + 1]) && keep(idx[t + 2])) out.push(idx[t], idx[t + 1], idx[t + 2]);
  geo.setIndex(out);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true }); // fabric is matte
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.bind(body.skeleton, body.bindMatrix);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

// The board's top sheet, painted (no brand logos).
function boardTexture(kind) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 512;
  const g = c.getContext("2d");
  if (kind === "a") { // black, a thin white line down the middle, a bronze medallion
    g.fillStyle = "#121315"; g.fillRect(0, 0, 128, 512);
    g.fillStyle = "#e9e6df"; g.fillRect(60, 30, 8, 452);
    g.fillStyle = "#8a6b45"; g.beginPath(); g.ellipse(64, 256, 26, 46, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#2a2118"; g.beginPath(); g.ellipse(64, 262, 14, 22, 0, 0, Math.PI * 2); g.fill();
  } else if (kind === "b") { // a starry night over a red desert, a full moon
    const grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, "#14182b"); grd.addColorStop(0.55, "#232a44"); grd.addColorStop(0.7, "#b85a3a"); grd.addColorStop(1, "#d98aa8");
    g.fillStyle = grd; g.fillRect(0, 0, 128, 512);
    g.fillStyle = "#fff";
    for (let i = 0; i < 90; i++) g.fillRect(Math.random() * 128, Math.random() * 280, 1.5, 1.5);
    g.fillStyle = "#e9e4d2"; g.beginPath(); g.arc(64, 110, 20, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#d65a2c"; g.fillRect(52, 330, 22, 60);
  } else if (kind === "d") { // pale grey, a blue band
    g.fillStyle = "#e4e7ea"; g.fillRect(0, 0, 128, 512);
    g.fillStyle = "#3d7cc9"; g.fillRect(0, 230, 128, 52);
    g.fillStyle = "#1d2330"; g.fillRect(0, 290, 128, 8);
  } else { // white with a dark mountain range at the tail and a purple mark
    g.fillStyle = "#f2f2f0"; g.fillRect(0, 0, 128, 512);
    g.fillStyle = "#1c1f2b";
    g.beginPath(); g.moveTo(0, 512); g.lineTo(0, 380); g.lineTo(30, 330); g.lineTo(50, 360); g.lineTo(78, 300); g.lineTo(100, 350); g.lineTo(128, 320); g.lineTo(128, 512); g.fill();
    g.fillStyle = "#5b3fa0";
    g.beginPath(); g.moveTo(44, 90); g.lineTo(54, 70); g.lineTo(64, 88); g.lineTo(74, 66); g.lineTo(84, 90); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function board(kind) {
  const geo = new RoundedBoxGeometry(0.27, 0.014, 1.52, 2, 0.006);
  // Narrow waist and round tips: squeeze the width along the length.
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) / 0.76, w = 1 - 0.1 * Math.cos(z * Math.PI / 2) ** 2 - (Math.abs(z) > 0.85 ? (Math.abs(z) - 0.85) * 2.2 : 0);
    p.setX(i, p.getX(i) * w);
    if (Math.abs(z) > 0.88) p.setY(i, p.getY(i) + (Math.abs(z) - 0.88) * 0.25); // tips turn up
  }
  geo.computeVertexNormals();
  const top = new THREE.MeshPhongMaterial({ map: boardTexture(kind), shininess: 60, specular: 0x333333 });
  // The top sheet faces up; the base is black.
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 0.27 + 0.5, p.getZ(i) / 1.52 + 0.5);
  const m = new THREE.Mesh(geo, [top, top, top, new THREE.MeshLambertMaterial({ color: 0x111111 }), top, top]);
  m.castShadow = true;
  return m;
}

// Build a rider. Returns a group with its feet at the origin, facing +z, and pose helpers.
export async function buildRider(profile) {
  const gltf = await load(`Superhero_${profile.sex}_FullBody`);
  const model = SkeletonUtils.clone(gltf.scene);
  const root = new THREE.Group(), turn = new THREE.Group();
  root.add(turn);
  turn.add(model);
  let body = null;
  model.traverse((o) => {
    if (o.isSkinnedMesh && (!body || o.geometry.attributes.position.count > body.geometry.attributes.position.count)) body = o;
    if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; }
  });
  body.geometry = body.geometry.clone(); // clones of one body share geometry; this rider edits its own
  const bones = {};
  body.skeleton.bones.forEach((b) => (bones[b.name] = b));
  model.updateMatrixWorld(true);

  // Face +z: the toes point forward.
  const w = (b) => b.getWorldPosition(new THREE.Vector3());
  const fwd = w(bones.ball_l).sub(w(bones.foot_l)).setY(0).normalize();
  turn.rotation.y = -Math.atan2(fwd.x, fwd.z);
  root.updateMatrixWorld(true);
  // Real height, feet on the ground.
  const box = new THREE.Box3().setFromObject(body);
  const k = profile.height / (box.max.y - box.min.y);
  turn.scale.setScalar(k);
  root.updateMatrixWorld(true);
  turn.position.y = -new THREE.Box3().setFromObject(body).min.y;
  root.updateMatrixWorld(true);

  // Classify every vertex by its dominant bone, and find heights in the rest pose (world space).
  const geo = body.geometry, n = geo.attributes.position.count;
  const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const reg = new Array(n), wp = new Array(n), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    let best = 0;
    for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, best)) best = j;
    reg[i] = region(body.skeleton.bones[si.getComponent(i, best)].name);
    body.getVertexPosition(i, v);
    wp[i] = v.clone().applyMatrix4(body.matrixWorld);
  }
  const hipY = w(bones.pelvis).y, footY = w(bones.foot_l).y, headY = w(bones.Head).y, neckY = w(bones.neck_01).y;
  const u = 1 / k; // offsets below are in metres; the mesh is in its own units
  const jacketHem = hipY - 0.1;
  const inJacket = (i) => reg[i] === "torso" || reg[i] === "arm" || (reg[i] === "pelvis" && wp[i].y > hipY - 0.02) || (reg[i] === "leg" && wp[i].y > jacketHem) || (reg[i] === "head" && wp[i].y < neckY + 0.02);
  const inPants = (i) => reg[i] === "leg" || reg[i] === "pelvis";
  const panel = (i) => {
    const p = wp[i];
    return p.z > 0.02 && Math.abs(p.x) < 0.11 && p.y > hipY + 0.12 && p.y < neckY - 0.06;
  };
  const parent = body.parent;
  const jacket = shell(body, inJacket, (i) => (reg[i] === "arm" ? 0.04 : reg[i] === "head" ? 0.03 : 0.055) * u, profile.jacket, (i) => (panel(i) ? profile.jacketPanel : profile.jacket));
  // A vest over the jacket: the torso only, a little further out.
  if (profile.vest) parent.add(shell(body, (i) => reg[i] === "torso" || (reg[i] === "pelvis" && wp[i].y > hipY - 0.02) || (reg[i] === "leg" && wp[i].y > jacketHem + 0.03), () => 0.07 * u, profile.vest));
  const pants = shell(body, inPants, (i) => (0.035 + 0.045 * Math.min(1, Math.max(0, 1 - (wp[i].y - footY) / (hipY - footY)))) * u, profile.pants);
  const gloves = shell(body, (i) => reg[i] === "hand", () => 0.014 * u, profile.gloves);
  const boots = shell(body, (i) => reg[i] === "foot" || (reg[i] === "leg" && wp[i].y < footY + 0.14), () => 0.03 * u, profile.boots);
  parent.add(pants, jacket, gloves, boots);
  // Only the face of the body itself still shows.
  const idx = geo.index.array, faceOnly = [];
  for (let t = 0; t < idx.length; t += 3) if (reg[idx[t]] === "head" && wp[idx[t]].y > neckY + 0.02) faceOnly.push(idx[t], idx[t + 1], idx[t + 2]);
  geo.setIndex(faceOnly);
  if (profile.balaclava) parent.add(shell(body, (i) => reg[i] === "head" && wp[i].y < headY + 0.07 && wp[i].y > neckY, () => 0.006 * u, profile.balaclava));

  // Head gear, placed in the rest pose then carried by the head bone.
  const headPts = wp.filter((p, i) => reg[i] === "head" && p.y > neckY + 0.04);
  const hb = new THREE.Box3().setFromPoints(headPts), hc = hb.getCenter(new THREE.Vector3()), hs = hb.getSize(new THREE.Vector3());
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshPhongMaterial({ color: profile.helmet, shininess: 40, specular: 0x444444 }));
  helmet.scale.set(hs.x * 1.22, hs.y * 1.05, hs.z * 1.2);
  helmet.position.set(hc.x, hc.y + hs.y * 0.05, hc.z - hs.z * 0.04);
  const goggles = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.0, 6, 16), new THREE.MeshPhongMaterial({ color: profile.goggle, shininess: 120, specular: 0xffffff, emissive: profile.goggleTint, emissiveIntensity: 0.25 }));
  goggles.rotation.z = Math.PI / 2;
  goggles.scale.set(hs.y * 0.11, hs.x * 0.42, hs.z * 0.12);
  goggles.position.set(hc.x, hc.y + hs.y * 0.08, hb.max.z - hs.z * 0.02);
  const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 1, true), new THREE.MeshLambertMaterial({ color: 0x111111, side: THREE.DoubleSide }));
  strap.scale.set(hs.x * 1.16, hs.y * 0.09, hs.z * 1.14);
  strap.position.set(hc.x, hc.y + hs.y * 0.08, hc.z);
  for (const o of [helmet, goggles, strap]) { o.castShadow = true; root.add(o); o.updateMatrixWorld(); }
  // Hair: modelled in the same rest space as the body.
  if (profile.hair) {
    const hair = SkeletonUtils.clone((await load(profile.hair)).scene);
    hair.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(profile.hairColor); o.castShadow = true; } });
    model.add(hair);
    model.updateMatrixWorld(true);
    bones.Head.attach(hair);
  }
  root.updateMatrixWorld(true);
  for (const o of [helmet, goggles, strap]) bones.Head.attach(o);

  const rest = {};
  for (const b of body.skeleton.bones) rest[b.name] = b.quaternion.clone();
  root.userData = { bones, rest, profile, body, model, turn };
  return root;
}

// ---------- Posing: aim bones at directions in the rider's own frame (y up, z forward) ----------
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
function aim(rider, name, child, dir) {
  const { bones } = rider.userData, bone = bones[name], to = bones[child];
  bone.updateWorldMatrix(true, true);
  const from = bone.getWorldPosition(_a), cur = to.getWorldPosition(_b).sub(from).normalize();
  const want = dir.clone().normalize().transformDirection(rider.matrixWorld);
  _q.setFromUnitVectors(cur, want); // a world-space turn
  const pq = bone.parent.getWorldQuaternion(_q2);
  const wq = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(_q);
  bone.quaternion.copy(pq.invert().multiply(wq));
  bone.updateWorldMatrix(false, true);
}
function turnWorld(rider, name, axis, angle) {
  const bone = rider.userData.bones[name];
  const ax = axis.clone().transformDirection(rider.matrixWorld);
  const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const wq = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromAxisAngle(ax, angle));
  bone.quaternion.copy(pq.invert().multiply(wq));
  bone.updateWorldMatrix(false, true);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function reset(rider) {
  const { bones, rest } = rider.userData;
  for (const [n, q] of Object.entries(rest)) bones[n].quaternion.copy(q);
  rider.updateMatrixWorld(true);
}

export function standPose(rider) {
  reset(rider);
  for (const [s, side] of [["l", 1], ["r", -1]]) {
    // Sides of the body: x is the rider's left for "l" when facing +z.
    aim(rider, `upperarm_${s}`, `lowerarm_${s}`, V(0.28 * side, -1, 0.02));
    aim(rider, `lowerarm_${s}`, `hand_${s}`, V(0.12 * side, -1, 0.2));
  }
}

// Seated on a chair: thighs forward, shins hanging, hands on the bar; lookYaw turns head and shoulders.
export function sitPose(rider, lookYaw = 0) {
  reset(rider);
  for (const [s, side] of [["l", 1], ["r", -1]]) {
    aim(rider, `thigh_${s}`, `calf_${s}`, V(0.12 * side, -0.08, 1));
    aim(rider, `calf_${s}`, `foot_${s}`, V(0.02 * side, -1, 0.25));
    aim(rider, `upperarm_${s}`, `lowerarm_${s}`, V(0.3 * side, -0.75, 0.45));
    aim(rider, `lowerarm_${s}`, `hand_${s}`, V(-0.1 * side, -0.15, 1));
  }
  turnWorld(rider, "spine_02", V(0, 1, 0), lookYaw * 0.25);
  turnWorld(rider, "Head", V(0, 1, 0), Math.max(-1, Math.min(1, lookYaw * 0.75)));
}

// Where the seat goes under a seated rider: just below the pelvis, in the rider's frame.
export function seatPoint(rider) {
  rider.updateMatrixWorld(true);
  const p = rider.userData.bones.pelvis.getWorldPosition(new THREE.Vector3());
  return rider.worldToLocal(p).add(V(0, -0.1, -0.05));
}
