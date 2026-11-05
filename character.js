// The character templates (a woman's and a man's, by the owner's character AI; data/rider_templates.json and
// assets/riders/tpl_*.glb): height, body and fit sliders, parts on and off, colour by material, and the show
// poses and tricks. applyCharacter follows the template's own reference (creator_local.html).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

export const CFG = await (await fetch("data/rider_templates.json?v=1")).json();
export const PARTS = { hair: "ACC_Hair", hood: "ACC_Hood", vest: "ACC_Vest", visor: "ACC_Visor", stickers: "ACC_Stickers" };
export const PART_LABEL = { hair: "长发", hood: "帽兜", vest: "马甲", visor: "帽檐", stickers: "贴纸", grid: "格纹" };
// The game's colour parts and the template's materials they set (trim follows, a little darker).
export const COLOR_MATS = { jacket: ["MAT_jacket"], pants: ["MAT_pants"], helmet: ["MAT_helmet"], lens: ["MAT_lens"], gloves: ["MAT_mitten"], boots: ["MAT_boot_panel", "MAT_boot_sole"] };
// Poses held still (the template's frame at 1 s) and tricks played through.
export const POSES = [["Stand_Idle", "站立"], ["Board_Hold", "抱板"], ["Sit_Snow", "坐雪地"]];
export const TRICKS = [["Anim_Ollie", "Ollie"], ["Anim_Indy_Air", "Indy"], ["Anim_Method_Air", "Method"], ["Anim_Nose_Press", "压板头"], ["Anim_Tail_Press", "压板尾"],
  ["Anim_Carve_Ref", "欧式刻滑"], ["Anim_Carve_Spin_Toe", "刻平陀螺"], ["Anim_Carve_S", "立刃 S 弯"], ["Anim_Skid_S", "搓雪 S 弯"], ["Anim_Pop_Ref", "坡上跳跃"], ["Anim_Toe_Slide_Ref", "平花倒滑"]];

const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/"));
const files = {};
const fileOf = (tpl) => (files[tpl] ||= loader.loadAsync(`assets/riders/tpl_${tpl.toLowerCase()}.glb?v=1`));

// A fresh copy of a template, ready to dress and pose: { root, tpl, set(ch), play(name), step(dt) }.
export async function makeCharacter(tpl) {
  const g = await fileOf(tpl);
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
  const rel = (q = new THREE.Quaternion()) => { root.updateMatrixWorld(true); new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(bones.Board.matrixWorld).decompose(new THREE.Vector3(), q, new THREE.Vector3()); return q; };
  const boardRest = rel();
  const mixer = new THREE.AnimationMixer(root), clips = Object.fromEntries(g.animations.map((c) => [c.name, c]));
  let action = null, held = true, t = 0; const off = [], gaze = { y: 0, p: 0, ty: 0, tp: 0, wait: 3 };
  const C = {
    root, tpl, bones, mixer,
    set(ch) { applyCharacter(root, CFG.templates[tpl], ch); },
    // A pose holds its frame at 1 s; a trick plays on a loop. Crossfade between them.
    // { once, dur }: play it through once (stretched to dur seconds) and hold the last frame.
    play(name, { once = false, dur = 0, fade = 0.25 } = {}) {
      const clip = clips[name]; if (!clip) return;
      const a = mixer.clipAction(clip); held = POSES.some(([n]) => n === name);
      a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); a.clampWhenFinished = once;
      a.timeScale = held ? 0 : dur ? clip.duration / dur : 1; if (held) a.time = 1;
      a.play(); if (action && action !== a) action.crossFadeTo(a, fade, false); action = a; C.current = name;
    },
    // The line a clip rides along (the character AI's method, rider_viewer.html): the clip plays in place,
    // and its board says where it goes: on the toe edge the path turns toward the toes, on the heel edge
    // toward the heels, tighter the higher the edge; a board turned across the line (spins, slides) stops
    // steering. From (0, 0) heading 0 (+x), v m/s; returns { pts: [[x, z]], hd: [heading], fps }.
    trace(name, reps = 1, v = 7) {
      const clip = clips[name]; if (!clip) return null;
      const FPS = 30, d = clip.duration, N = Math.round(d * FPS) * reps, pts = [], hd = [];
      const m2 = new THREE.AnimationMixer(root), a = m2.clipAction(clip); a.play();
      const q = new THREE.Quaternion(), inv = boardRest.clone().invert(), lng = new THREE.Vector3(), nrm = new THREE.Vector3(), toe = new THREE.Vector3();
      let x = 0, z = 0, h = 0;
      for (let i = 0; i <= N; i++) {
        a.time = Math.min((i / FPS) % d, d - 1e-4); m2.update(0);
        rel(q).multiply(inv);
        lng.set(1, 0, 0).applyQuaternion(q); nrm.set(0, 1, 0).applyQuaternion(q);
        const psi = Math.atan2(-lng.z, lng.x); toe.set(-Math.sin(psi), 0, Math.cos(psi));
        const phi = Math.asin(Math.max(-1, Math.min(1, nrm.dot(toe)))), w = Math.pow(Math.abs(Math.cos(psi)), 6);
        const kap = Math.abs(phi) > 0.05 ? (Math.sin(phi) / 6) * w : 0;
        pts.push([x, z]); hd.push(h);
        h -= kap * v / FPS; x += (Math.cos(h) * v) / FPS; z += (-Math.sin(h) * v) / FPS;
      }
      m2.stopAllAction(); m2.uncacheRoot(root); if (action) mixer.update(0);
      return { pts, hd, fps: FPS };
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
  for (const k in PARTS) { const o = root.getObjectByName(PARTS[k]); if (o) o.visible = !!ch.parts[k]; }
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

// A preset's character (a deep copy), and the game's six part colours read off it (the ride's rider wears those).
// Each friend's signature move (the owner's picks): shown now and then on the pick page.
export const SIGNATURE = { A: "Anim_Carve_Ref", B: "Anim_Carve_Spin_Toe", C: "Anim_Carve_S", D: "Anim_Method_Air" };
export const presetChar = (k) => ({ board: k, fav: SIGNATURE[k], ...JSON.parse(JSON.stringify(CFG.presets[k])) });
export const partColors = (ch) => Object.fromEntries(Object.entries(COLOR_MATS).map(([p, [m]]) => [p, ch.colors[m]]));
export function setPartColor(ch, part, c) { for (const m of COLOR_MATS[part]) ch.colors[m] = c; }
