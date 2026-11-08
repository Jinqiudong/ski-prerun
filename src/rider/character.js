// The character templates (a woman's and a man's, by the owner's character AI; data/rider_templates.json and
// assets/riders/tpl_*.glb): height, body and fit sliders, parts on and off, colour by material, and the show
// poses and tricks. applyCharacter follows the template's own reference (creator_local.html).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

export const CFG = await (await fetch("data/rider_templates.json?v=3")).json();
// The rigged animal riders (the character AI's animals_A: assets/riders/animals/, animals.json): on the templates'
// skeleton, so they play the people's clips; by id: { file, height, colors (MAT_* defaults), accessories, helmet, overrides }.
export const PETS = Object.fromEntries((await (await fetch("assets/riders/animals/animals.json?v=1")).json()).animals.map((a) => [a.id, a]));
export const PARTS = { hair: "ACC_Hair", hood: "ACC_Hood", vest: "ACC_Vest", visor: "ACC_Visor", stickers: "ACC_Stickers", hair_braid: "ACC_Hair_Braid" };
// The parts toggled on and off (the hair is a style, below).
export const PART_LABEL = { hood: "帽兜", vest: "马甲", visor: "帽檐", stickers: "贴纸", grid: "格纹" };
// The woman's hair: loose (ACC_Hair), a braid (ACC_Hair_Braid) or none, never both (the man's template has none).
export const HAIR = [["loose", "披发"], ["braid", "辫子"], ["none", "不要头发"]];
export const hairOf = (ch) => (ch.parts.hair_braid ? "braid" : ch.parts.hair ? "loose" : "none");
export function setHair(ch, style) { ch.parts.hair = style === "loose"; ch.parts.hair_braid = style === "braid"; }
// The game's colour parts and the template's materials they set (trim follows, a little darker).
export const COLOR_MATS = { jacket: ["MAT_jacket"], pants: ["MAT_pants"], helmet: ["MAT_helmet"], lens: ["MAT_lens"], gloves: ["MAT_mitten"], boots: ["MAT_boot_panel", "MAT_boot_sole"] };
// Poses held still (the template's frame at 1 s) and tricks played through.
export const POSES = [["Stand_Idle", "站立"], ["Board_Hold", "抱板"], ["Sit_Snow", "坐雪地"], ["Pose_Wave", "挥手"], ["Pose_Cheer", "欢呼"], ["Pose_Hold_Photo", "举照片"], ["Radio_Talk_Stand", "对讲机"]];
export const TRICKS = [["Anim_Ollie", "Ollie"], ["Anim_Indy_Air", "Indy"], ["Anim_Method_Air", "Method"], ["Anim_Nose_Press", "压板头"], ["Anim_Tail_Press", "压板尾"],
  ["Anim_Carve_Ref", "欧式刻滑"], ["Anim_Carve_Spin_Toe", "刻平陀螺"], ["Anim_Carve_S", "立刃 S 弯"], ["Anim_Skid_S", "搓雪 S 弯"], ["Anim_Pop_Ref", "坡上跳跃"], ["Anim_Toe_Slide_Ref", "平花倒滑"]];

const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/"));
const files = {};
const fileOf = (tpl) => (files[tpl] ||= loader.loadAsync(PETS[tpl] ? `assets/riders/animals/${PETS[tpl].file}?v=1` : `assets/riders/tpl_${tpl.toLowerCase()}.glb?v=6`));
// The ride's clips (stance, turns, lift, air, stops, falls, chairlift talk, radio) live in a second, skeleton-only file;
// tracks bind by bone name, so they play on the template as they are. Only the ride needs them.
const rides = {};
const rideOf = (tpl) => (rides[tpl] ||= loader.loadAsync(`assets/riders/tpl_${tpl.toLowerCase()}_ride.glb?v=2`));
// The light version for the ride (about 30k triangles drawn, 512 px textures): the same skeleton, names and
// morphs, and no clips of its own. Each file loads once; every rider made from it shares its geometry and textures.
const lods = {};
const lodOf = (tpl) => (lods[tpl] ||= loader.loadAsync(`assets/riders/tpl_${tpl.toLowerCase()}_lod.glb?v=3`));
// An animal has one file for the rider page and the ride (no light version); its clips are the woman's template's
// (the same rest orientations), from tpl_f.glb or tpl_f_ride.glb.
const CLIPS_OF = "F";
export const loadTemplate = (tpl, { lod = false } = {}) => Promise.all(PETS[tpl] ? [fileOf(tpl), lod ? rideOf(CLIPS_OF) : fileOf(CLIPS_OF)]
  : lod ? [lodOf(tpl), rideOf(tpl)] : [fileOf(tpl)]);
// The clips an animal can play, made once per animal and set of clips:
// - only the rotations, plus Board's and Hips' moves: the people's clips key every bone's position and scale at a
//   person's proportions, which would pull the animal's short limbs back to a person's length (animals_A handoff);
// - its own version of a clip, <Clip>__<animal>, in place of the people's (Stand_Idle__capybara);
// - without its own version, the clips its short arms can't do are left out (the grabs, holding the board, the
//   radio, the photo): the ride's trick wheel and the rider page's poses don't offer them.
export const PET_NEEDS_OWN = ["Board_Hold", "Pose_Hold_Photo", "Radio_Talk_Stand", "Radio_Talk_Ride", "Indy_Grab", "Melon_Grab", "Tail_Grab", "Anim_Indy_Air", "Anim_Method_Air", "Entrance_D"];
const petClips = {};
function clipsForPet(id, own, people, key) {
  return (petClips[id + key] ||= (() => {
    const keep = (c) => { c = c.clone(); c.tracks = c.tracks.filter((t) => t.name.endsWith(".quaternion") || /^(Board|Hips)\./.test(t.name)); return c; };
    const mine = Object.fromEntries(own.filter((c) => c.name.endsWith(`__${id}`)).map((c) => [c.name.slice(0, -id.length - 2), c]));
    return people.filter((c) => mine[c.name] || !PET_NEEDS_OWN.includes(c.name)).map((c) => { const k = keep(mine[c.name] || c); k.name = c.name; return k; });
  })());
}

// A fresh copy of a template, ready to dress and pose: { root, tpl, set(ch), play(name), step(dt) }.
// { ride }: the full template with the ride's clips too; { lod }: the light one with only the ride's clips.
// tpl may be a rigged animal's id (PETS): its own file, the people's clips (clipsForPet), its own colours and parts.
export async function makeCharacter(tpl, { ride = false, lod = false } = {}) {
  const pet = PETS[tpl] || null, g = await (lod && !pet ? lodOf(tpl) : fileOf(tpl)), src = pet ? CLIPS_OF : tpl, own = pet ? (await fileOf(src)).animations : g.animations;
  let animations = lod ? (await rideOf(src)).animations : ride ? [...own, ...(await rideOf(src)).animations] : own;
  if (pet) animations = clipsForPet(tpl, g.animations, animations, lod ? "lod" : ride ? "ride" : "page");
  const { clone } = await import("three/addons/utils/SkeletonUtils.js");
  const root = clone(g.scene);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.material = [].concat(o.material).map((m) => m.clone()); if (o.material.length === 1) o.material = o.material[0];
    // The fabric's sheen comes in full and white, which lights every edge like a rim light; a third of it reads as cloth.
    for (const m of [].concat(o.material)) if (m.sheen) m.sheen *= 0.3;
  });
  const bones = {}; root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  // The board's turn at rest, relative to the root (for reading its yaw and edge out of a clip).
  const rel = (q = new THREE.Quaternion(), p = new THREE.Vector3()) => { root.updateMatrixWorld(true); new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(bones.Board.matrixWorld).decompose(p, q, new THREE.Vector3()); return q; };
  const boardRest = rel();
  const mixer = new THREE.AnimationMixer(root), clips = Object.fromEntries(animations.map((c) => [c.name, c]));
  let action = null, held = true, t = 0; const off = [], gaze = { y: 0, p: 0, ty: 0, tp: 0, wait: 3 };
  const C = {
    root, tpl, bones, mixer, clips, pet, tall: pet ? pet.height : 0,
    set(ch) { if (pet) applyPet(root, pet, ch); else applyCharacter(root, CFG.templates[tpl], ch); },
    // A pose holds its frame at 1 s; a trick plays on a loop. Crossfade between them.
    // { once, dur }: play it through once (stretched to dur seconds) and hold the last frame.
    play(name, { once = false, dur = 0, fade = 0.25 } = {}) {
      const clip = clips[name]; if (!clip) return;
      const a = mixer.clipAction(clip); held = POSES.some(([n]) => n === name);
      a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); a.clampWhenFinished = once;
      a.timeScale = held ? 0 : dur ? clip.duration / dur : 1; if (held) a.time = 1;
      a.play(); if (action && action !== a) action.crossFadeTo(a, fade, false); action = a; C.current = name;
      holdProp(C, name);
    },
    // The line a clip rides along (the character AI's method, rider_viewer.html): the clip plays in place,
    // and its board says where it goes: on the toe edge the path turns toward the toes, on the heel edge
    // toward the heels, tighter the higher the edge; a board turned across the line (spins, slides) stops
    // steering. From (0, 0) heading 0 (+x), v m/s; returns { pts: [[x, z]], hd: [heading], by: [the board's
    // height in the clip, unscaled: a jump's lift], fps }.
    trace(name, reps = 1, v = 7) {
      const clip = clips[name]; if (!clip) return null;
      const FPS = 30, d = clip.duration, N = Math.round(d * FPS) * reps, pts = [], hd = [], by = [];
      const m2 = new THREE.AnimationMixer(root), a = m2.clipAction(clip); a.play();
      const q = new THREE.Quaternion(), bp = new THREE.Vector3(), inv = boardRest.clone().invert(), lng = new THREE.Vector3(), nrm = new THREE.Vector3(), toe = new THREE.Vector3();
      let x = 0, z = 0, h = 0;
      for (let i = 0; i <= N; i++) {
        a.time = Math.min((i / FPS) % d, d - 1e-4); m2.update(0);
        rel(q, bp).multiply(inv);
        lng.set(1, 0, 0).applyQuaternion(q); nrm.set(0, 1, 0).applyQuaternion(q);
        const psi = Math.atan2(-lng.z, lng.x); toe.set(-Math.sin(psi), 0, Math.cos(psi));
        const phi = Math.asin(Math.max(-1, Math.min(1, nrm.dot(toe)))), w = Math.pow(Math.abs(Math.cos(psi)), 6);
        const kap = Math.abs(phi) > 0.05 ? (Math.sin(phi) / 6) * w : 0;
        pts.push([x, z]); hd.push(h); by.push(bp.y);
        h -= kap * v / FPS; x += (Math.cos(h) * v) / FPS; z += (-Math.sin(h) * v) / FPS;
      }
      m2.stopAllAction(); m2.uncacheRoot(root); if (action) mixer.update(0);
      return { pts, hd, by, fps: FPS };
    },
    // Alive while standing: a slow breath in the chest, the weight shifting, the head looking about.
    step(dt) {
      for (const [b, x, y, z] of off) { b.rotation.x -= x; b.rotation.y -= y; b.rotation.z -= z; } off.length = 0; // undo last frame's
      t += dt; mixer.update(dt);
      if (!held) return;
      // Not a loop: a slow breath (about 4 s), the weight drifting between the feet on slow uneven waves,
      // and the head picking somewhere to look, easing there, staying a few seconds (often back at you).
      const br = Math.sin(t * 1.5) * 0.6 + Math.sin(t * 0.53) * 0.4, sw = Math.sin(t * 0.37) * 0.6 + Math.sin(t * 0.23 + 1) * 0.4;
      if ((gaze.wait -= dt) < 0) { gaze.wait = 2.5 + Math.random() * 4; const away = Math.random() < 0.6; gaze.ty = away ? (Math.random() - 0.5) * 1.1 : 0; gaze.tp = away ? (Math.random() - 0.4) * 0.25 : 0; }
      const k = 1 - Math.exp(-dt * 2.2); gaze.y += (gaze.ty - gaze.y) * k; gaze.p += (gaze.tp - gaze.p) * k;
      const add = (b, x, y, z) => { if (!b) return; b.rotation.x += x; b.rotation.y += y; b.rotation.z += z; off.push([b, x, y, z]); };
      add(bones.Chest, br * 0.014, gaze.y * 0.12, 0); add(bones.Spine, 0, gaze.y * 0.08, sw * 0.016); add(bones.Hips, 0, 0, -sw * 0.01);
      add(bones.Neck, gaze.p * 0.4, gaze.y * 0.3, 0); add(bones.Head, gaze.p * 0.6 + br * 0.006, gaze.y * 0.5, 0);
    },
  };
  return C;
}

// Things held in a hand while a clip plays, on the right palm's socket bone: the radio (assets/props/radio.glb)
// and a photo card (10.5 × 7.5 cm) between the palms. Per template, three.js rotation (XYZ, radians) and position
// (metres) in the socket's frame, fitted by the character AI at the held frame (radio: batch 4b; card: batch 4).
export const PROPS = {
  Radio_Talk_Stand: { prop: "radio", F: [[-0.7685, 1.9, -0.0231], [0.0603, 0.034, -0.0469]], M: [[-1.2481, 1.81, 0.4752], [0.0693, 0.0482, -0.0505]] },
  Radio_Talk_Ride: { prop: "radio", F: [[0.0278, 1.8117, -0.8175], [0.0528, 0.034, -0.0459]], M: [[0.0859, 1.6483, -0.8761], [0.0584, 0.0482, -0.0508]] },
  Pose_Hold_Photo: { prop: "card", F: [[0.3367, -0.2409, 3.1416], [0.0971, 0, -0.0239]], M: [[0.3367, -0.0772, 3.1416], [0.0997, 0, -0.0077]] },
};
let radioFile = null, cardMesh = null;
function propMesh(kind) {
  if (kind === "radio") return (radioFile ||= loader.loadAsync("assets/props/radio.glb?v=1")).then((g) => g.scene.clone());
  if (!cardMesh) { // a little snapshot: a blue sky over a white ridge, on a paper card
    const c = document.createElement("canvas"); c.width = 128; c.height = 92; const x = c.getContext("2d");
    x.fillStyle = "#f6f1e6"; x.fillRect(0, 0, 128, 92);
    const sky = x.createLinearGradient(0, 6, 0, 70); sky.addColorStop(0, "#7fa6cf"); sky.addColorStop(1, "#cfe0ee"); x.fillStyle = sky; x.fillRect(6, 6, 116, 64);
    x.fillStyle = "#f8fafc"; x.beginPath(); x.moveTo(6, 70); x.lineTo(40, 30); x.lineTo(58, 46); x.lineTo(80, 22); x.lineTo(122, 64); x.lineTo(122, 70); x.fill();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    cardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.075, 0.002), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  }
  return Promise.resolve(cardMesh.clone());
}
// Put the clip's prop (if it has one) in C's hand, or take it away. The prop's geometry and material are shared.
export function holdProp(C, clip) {
  const want = PROPS[clip], kind = want?.prop || null;
  if ((C.prop?.userData.kind || null) === kind) { if (want) fitProp(C, want); return; }
  C.prop?.removeFromParent(); C.prop = null; C.propAsk = null;
  if (!kind) return;
  const ask = (C.propAsk = {});
  propMesh(kind).then((o) => {
    if (C.propAsk !== ask) return; // something else was played meanwhile
    o.userData.kind = kind; o.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    C.prop = o; C.bones.Hand_R_Socket?.add(o); fitProp(C, want);
  });
}
const fitProp = (C, want) => { const [r, p] = want[C.tpl] || want.F; C.prop?.rotation.set(...r); C.prop?.position.set(...p); };

// Height (a uniform scale), the sliders (each to its _up or _down morph), parts on or off, and colours.
let gridTex = null, gridEmis = null;
function makeGrid() {
  const mk = (bg, ln) => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    g.fillStyle = bg; g.fillRect(0, 0, 64, 64); g.fillStyle = ln; g.fillRect(0, 0, 64, 3); g.fillRect(0, 0, 3, 64);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  gridTex = mk("#ffffff", "#c8c8c8"); gridEmis = mk("#000000", "#ffffff");
}
// Each of the four has their own board (the real ones, from the character AI's per-rider models); ch.board picks it.
export const BOARDS = ["A", "B", "C", "D"];
const boardTex = {};
const texOf = (k, side) => (boardTex[k + side] ||= (() => { const t = new THREE.TextureLoader().load(`assets/riders/boards/${k}_${side}.jpg?v=1`); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })());
export function applyCharacter(root, tpl, ch) {
  root.scale.setScalar(ch.height / tpl.height);
  root.traverse((o) => {
    if (!o.isMesh || !o.morphTargetDictionary) return;
    for (const s of CFG.sliders) {
      const v = ch[s.key], b = tpl.base[s.key];
      const up = v > b ? (v - b) / (s.hi - b) : 0, dn = v < b ? (b - v) / (b - s.lo) : 0;
      const iu = o.morphTargetDictionary[s.morph + "_up"], id = o.morphTargetDictionary[s.morph + "_down"];
      if (iu !== undefined) o.morphTargetInfluences[iu] = up;
      if (id !== undefined) o.morphTargetInfluences[id] = dn;
    }
  });
  for (const k in PARTS) { const o = root.getObjectByName(PARTS[k]); if (o) o.visible = !!ch.parts[k] && !(k === "hair" && ch.parts.hair_braid); } // one hair style at a time
  root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) {
    const c = ch.colors[m.name]; if (c) m.color.set(c);
    const side = m.name === "MAT_board_top" ? "top" : m.name === "MAT_board_base" ? "base" : null;
    if (side && ch.board && m.userData.board !== ch.board) { m.map = texOf(ch.board, side); m.color.set("#ffffff"); m.needsUpdate = true; m.userData.board = ch.board; }
    if (m.name === "MAT_helmet") { m.roughness = ch.glossyHelmet ? 0.55 : 0.78; m.metalness = ch.glossyHelmet ? 0.25 : 0; }
    if (m.name === "MAT_jacket") {
      if (!gridTex) makeGrid();
      m.map = ch.parts.grid ? gridTex : null; m.emissiveMap = ch.parts.grid ? gridEmis : null;
      const lum = m.color.r * 0.3 + m.color.g * 0.59 + m.color.b * 0.11;
      m.emissive?.setScalar(ch.parts.grid ? 0.05 * Math.max(0, 1 - lum * 4) : 0); m.needsUpdate = true;
    }
  } });
}

// A rigged animal (PETS) as a look has it: its own size (the file is at the animal's size: scale 1, never a
// person's height ratio), its colours (ch.pet.colors over animals.json's), its accessories (ch.parts.beanie,
// ch.parts.backpack; the beanie hides the helmet), the board picked. No body sliders: it has no morphs.
export const petAcc = (pet) => Object.keys(pet.accessories || {}).map((n) => [n.replace(/^ACC_/, "").toLowerCase(), n]);
export const petParts = (pet, ch) => Object.fromEntries(petAcc(pet).map(([k, n]) => [k, k in (ch.parts || {}) ? !!ch.parts[k] : pet.accessories[n].default !== false]));
function applyPet(root, pet, ch) {
  root.scale.setScalar(1);
  const on = petParts(pet, ch), cols = { ...pet.colors, ...(ch.pet?.colors || {}) }, hide = new Set();
  for (const [k, n] of petAcc(pet)) { const o = root.getObjectByName(n); if (o) o.visible = on[k]; if (on[k]) for (const h of pet.accessories[n].hides || []) hide.add(h); }
  if (pet.helmet) { const h = root.getObjectByName(pet.helmet); if (h) h.visible = !hide.has(pet.helmet); }
  root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) {
    const c = cols[m.name]; if (c) m.color.set(c);
    const side = m.name === "MAT_board_top" ? "top" : m.name === "MAT_board_base" ? "base" : null;
    if (side && ch.board && m.userData.board !== ch.board) { m.map = texOf(ch.board, side); m.color.set("#ffffff"); m.needsUpdate = true; m.userData.board = ch.board; }
    if (m.name === "MAT_helmet") { m.roughness = ch.glossyHelmet ? 0.55 : 0.78; m.metalness = ch.glossyHelmet ? 0.25 : 0; }
  } });
}

// A preset's character (a deep copy), and the game's six part colours read off it (the ride's rider wears those).
// Each friend's signature move (the owner's picks): shown now and then on the pick page.
export const SIGNATURE = { A: "Anim_Carve_Ref", B: "Anim_Carve_Spin_Toe", C: "Anim_Carve_S", D: "Anim_Method_Air" };
export const presetChar = (k) => ({ board: k, fav: SIGNATURE[k], ...JSON.parse(JSON.stringify(CFG.presets[k])) });
export const partColors = (ch) => Object.fromEntries(Object.entries(COLOR_MATS).map(([p, [m]]) => [p, ch.colors[m]]));
export function setPartColor(ch, part, c) { for (const m of COLOR_MATS[part]) ch.colors[m] = c; }
