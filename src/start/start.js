// The first screen: your rider standing in one snow world (the slope running into the painted mountains, the
// whole screen), a row of poses and the entrances under them; 换装 opens the wardrobe round the rider: a rail
// down the left (outfits, the jacket, the pants, the gear, the look) and a paper sheet with the choices.
// Every change shows on the rider at once and is what you ride in; an outfit you like can be saved by name.
// All on this phone only.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RIDERS, OUTFITS } from "../rider/boarder.js?v=28";
import { ANIMAL_RIDERS, ANIMAL_ZH, RIGGED, animalOf, riggedOf, deskPetOf } from "../rider/animal-core.js?v=2";
import { animalRider, animalStage, PET_MOVES } from "../rider/animal.js?v=3";
import { CFG, PETS, petParts, COLOR_MATS, HAIR, hairOf, setHair, POSES, BOARDS, makeCharacter, presetChar, partColors, setPartColor } from "../rider/character.js?v=13";
import { makeEntrance } from "./entrance.js?v=26";
import { skiStage, colorSkis, tintSkiGear, SKI_COLORS } from "../rider/skier.js?v=1";
import { addSki } from "../rider/ski.js?v=2";
import { sportOf } from "../rider/ski-core.js?v=1";
import { openBookPage, locateIn } from "../ride/roadbook.js?v=31";
import { t, EN_ON, translatePage, openSettings, myAvatar } from "../core/i18n.js?v=50";
import { playIntro } from "./intro.js?v=37";
import { flyTo } from "../core/transition.js?v=20";
import { startParty } from "../core/party.js?v=22";
// The opening (about your nearest trip, if there is one); its buttons open that trip, go straight to today's
// mountain, or the Memory wtab.
playIntro({ open: (id) => openTrip(id), go: (id) => goResort(id), memory: () => setTab("log") });

const $ = (id) => document.getElementById(id);
// No page zoom here (iOS Safari ignores user-scalable=no): no pinch, no double-tap zoom; a double tap on the
// rider is two taps.
for (const ev of ["gesturestart", "gesturechange", "dblclick"]) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
// The stage never scrolls (a focused input or a scrolled-to card would push the whole snow world up).
$("stage").addEventListener("scroll", (e) => { e.target.scrollTop = e.target.scrollLeft = 0; });
// A muted outdoor palette (stone, sage, slate, clay...): nothing loud, and any mix of them goes together. Eight a
// part; the round palette after them opens the rest of the colours (PALETTE).
const SWATCHES = {
  jacket: ["#525a42", "#dcd7cc", "#2b2c30", "#2f3a4c", "#7b8a96", "#a8674f", "#c2b49a", "#6e5f6e"],
  pants: ["#c9bfac", "#dcd7cc", "#8f8670", "#4f5645", "#4a5a6e", "#2f3a4c", "#9c6a55", "#222326"],
  helmet: ["#2b2b2e", "#d9d6ce", "#8f8b82", "#4a5a6e", "#55604b", "#b8a98c", "#9a5f4a", "#f0eee8"],
  gloves: ["#e3dccb", "#3b3d40", "#222326", "#a8674f", "#4a5a6e", "#55604b", "#b6463b", "#c2b49a"],
  lens: ["#4d5ce0", "#ad5599", "#3a3c42", "#b8873e", "#b78473", "#7f9fb8", "#6f8f7a", "#9aa1a8"],
  boots: ["#1d1d20", "#3b3d40", "#8f8670", "#a39d8f", "#4a5a6e", "#9c6a55", "#dcd7cc", "#7f9fb8"],
  vest: ["#17171a", "#3b3d40", "#4f5645", "#2f3a4c", "#a8674f", "#c2b49a", "#dcd7cc", "#6e5f6e"],
  hair: ["#3f2a1f", "#1d1a18", "#6b4a2e", "#a07850", "#c9a66b"],
  // a rigged animal's own: its fur, its beanie, its backpack
  fur: ["#deb88a", "#c9a27a", "#a8825e", "#8a6a4c", "#e8d8c0", "#b9a48a", "#6e5440", "#5c4636"],
  beanie: ["#f49228", "#e0b04a", "#a8674f", "#b6463b", "#4a5a6e", "#55604b", "#dcd7cc", "#2b2c30"],
  backpack: ["#302c28", "#4f5645", "#2f3a4c", "#6e5f6e", "#a8674f", "#8f8670", "#c2b49a", "#dcd7cc"],
};
// Every other colour: 32 picked in the game's greyed, misty tones (greys, slates and blues, greens, earth and
// clay, plums), four rows of eight. No phone colour picker: its rainbow is not this world's.
const PALETTE = ["#2b2c30", "#3d4148", "#5c6168", "#8a8f94", "#b9bbb8", "#dcd7cc", "#efebe3", "#fdfbf6",
  "#2f3a4c", "#3f5a6e", "#4a6a8a", "#7b8a96", "#9fb3c4", "#c7d3dc", "#5b6f6a", "#7f9a90",
  "#2f3d2e", "#4f5645", "#525a42", "#6f7a52", "#9aa07a", "#c2b49a", "#a89474", "#7a6448",
  "#6e2f2c", "#9a4a3e", "#a8674f", "#c98a68", "#d9b48f", "#6e5f6e", "#8e7a90", "#b7a3b4"];
const PART_ZH = { jacket: "上衣颜色", pants: "裤子颜色", helmet: "头盔颜色", gloves: "手套颜色", lens: "雪镜颜色", boots: "雪鞋颜色", vest: "马甲颜色", hair: "头发颜色", fur: "毛色", beanie: "帽子颜色", backpack: "背包颜色" };
// The colours last picked off the palette (on this phone), newest first.
const RECENT = "prerunColors";
const recent = () => { try { const a = JSON.parse(localStorage.getItem(RECENT) || "[]"); return Array.isArray(a) ? a.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 8) : []; } catch { return []; } };
const remember = (c) => { try { localStorage.setItem(RECENT, JSON.stringify([c, ...recent().filter((x) => !same(x, c))].slice(0, 8))); } catch { /* full or private */ } };
// The materials each colour sets: the game's six parts (character.js), the vest and the hair.
const MATS = { ...COLOR_MATS, vest: ["MAT_vest"], hair: ["MAT_hair"], fur: ["MAT_fur"], beanie: ["MAT_beanie"], backpack: ["MAT_backpack"] };
// A rigged animal (the capybara) wears its own colours (ch.pet.colors over animals.json's), so a person's clothes
// are still theirs when they choose a body again.
const colorsOf = (ch) => (riggedOf(ch.animal) ? { ...PETS[ch.animal].colors, ...(ch.pet?.colors || {}) } : ch.colors);
const colorOf = (ch, part) => (colorsOf(ch)[MATS[part][0]] || "#888888").toLowerCase();
const paint = (ch, part, c) => { const to = riggedOf(ch.animal) ? ((ch.pet ||= { colors: {} }).colors ||= {}) : ch.colors; for (const m of MATS[part]) to[m] = c; };
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

// ---- Saved state ("prerun"): { wear: { ch, from, name, stance, dirty } (what I wear: a character, the outfit it
// started as, that outfit's name, regular or goofy, and whether it was changed since), riders: [{ id, base, name,
// colors, ch }] (my saved outfits), rider (wear.from again, for pages from before wear), resort }. A character
// riding as one of the resort animals says which in ch.animal (animal-core.js); the rest of it (template,
// colours, board) stays, so choosing a body again brings the person back as they were. ch.fav: the entrance
// played when the page opens (a clip of ENTRANCES); ch.petFav: an animal's.
const load = () => { try { return JSON.parse(localStorage.getItem("prerun") || "{}"); } catch { return {}; } };
const st = load();
st.riders = (st.riders || []).filter((r) => r.base in RIDERS); // riders on a base model since removed are dropped
delete st.kind; // everyone snowboards now
const save = () => { st.rider = st.wear.from || undefined; try { localStorage.setItem("prerun", JSON.stringify(st)); } catch { /* full or private */ } };
const deep = (o) => JSON.parse(JSON.stringify(o));
const template = (k) => ({ id: k, base: "rider_a", name: EN_ON ? OUTFITS[k].en : OUTFITS[k].zh, colors: { ...OUTFITS[k].colors }, ch: presetChar(OUTFITS[k].ch), isDefault: true });
// Every rider is a character (template, body, fit, parts, colours); outfits saved before that get one from A, in their colours.
const charOf = (r) => { if (r.ch) return r.ch; const ch = presetChar("A"); for (const [p, c] of Object.entries(r.colors || {})) setPartColor(ch, p, c); return ch; };
const outfitOf = (id) => st.riders.find((r) => r.id === id) || (OUTFITS[id] ? template(id) : null);
// Saved before there was a wear: the outfit chosen then (st.rider), in its stance (st.stances, per outfit), is worn.
if (!CFG.templates[st.wear?.ch?.tpl] || !st.wear.ch.parts || !st.wear.ch.colors) {
  const r = outfitOf(st.rider) || template("o_pine");
  st.wear = { ch: deep(charOf(r)), from: r.id, name: r.name, stance: (st.stances || {})[r.id] === "goofy" ? "goofy" : "regular", dirty: false };
  save();
}
const wear = st.wear;
if ("animal" in wear.ch && !animalOf(wear.ch.animal)) delete wear.ch.animal;
// petOf: one of the resort animals (animal.js); rigOf: a rigged animal (character.js PETS), dressed and posed as a
// person is; tplOf: the character.js template a rider is made from.
const petOf = (ch) => deskPetOf(ch.animal);
const rigOf = (ch) => riggedOf(ch.animal);
const tplOf = (ch) => rigOf(ch) || ch.tpl;
const wearName = () => { const r = outfitOf(wear.from); return r ? r.name : wear.name || t("我的穿搭"); };
// Something changed: shown at once, kept at once (there is no "wear this" step), and the outfit is now changed.
function changed({ body = false } = {}) {
  if (!wear.dirty) { wear.dirty = true; if (wtab === "outfits") render(); }
  if (body) render();
  save(); show();
}

// ---- The snow world: the rider on the slope, the painted mountains round it (entrance.js), turning when dragged.
const canvas = $("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
// Light: a soft studio environment for the fabrics and helmets, a cool sky from above, a warm low sun that
// follows the rider (so their shadow is always there), and a pale rim from behind to cut them from the snow.
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
scene.add(new THREE.HemisphereLight(0xe4eeff, 0x9aa6b6, 1.1));
const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 30 });
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0xdfe9ff, 1.3); rim.position.set(-3, 3, -6); scene.add(rim);
const entrance = makeEntrance(scene);
const turntable = new THREE.Group();
scene.add(turntable);
let rider = null, drag = null, spinTo = null;
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();
// Drag to turn the rider round; a tap on a part of them (the jacket, the helmet...) opens the wardrobe on that
// part; a tap on the snow beside them, from a close look at a part, goes back to the whole rider.
canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, a: turntable.rotation.y }; spinTo = null; });
addEventListener("pointermove", (e) => { if (drag && !entrance.running) turntable.rotation.y = drag.a + (e.clientX - drag.x) / 120; });
addEventListener("pointerup", (e) => {
  if (!drag) return; const moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y); drag = null;
  if (moved > 8) return;
  const hit = partAt(e);
  if (hit) open(...hit);
  else if (focus !== "full") { focus = "full"; }
});
// Which wardrobe item a point on the rider is, by the material under it.
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const PART_OF = [[/^MAT_(jacket|vest|zip|seam|cord)/, ["top"]], [/^MAT_pants/, ["pants"]], [/^MAT_(helmet|sticker)/, ["gear", "helmet"]], [/^MAT_mitten/, ["gear", "gloves"]],
  [/^MAT_(goggle|lens|face_mask)/, ["gear", "lens"]], [/^MAT_boot/, ["gear", "boots"]], [/^MAT_(board|binding)/, ["gear", "board"]], [/^MAT_hair/, ["look"]],
  [/^MAT_backpack/, ["top"]], [/^MAT_(beanie|leaf|stem)/, ["gear", "helmet"]], [/^MAT_(fur|eye|nose|blush)/, ["look"]]]; // a rigged animal's
const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
function partAt(e) {
  if (!rider || entrance.running) return null;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  // a skinned mesh's bounds are kept from its first pose: drop them so they follow this one
  rider.root.traverse((o) => { if (o.isSkinnedMesh) o.boundingSphere = o.boundingBox = null; });
  const hit = ray.intersectObject(rider.root, true).find((h) => shown(h.object));
  if (!hit) return null;
  if (rider.isAnimal) return ["look"]; // an animal: its picture in the look
  const m = [].concat(hit.object.material)[hit.face?.materialIndex || 0] || [].concat(hit.object.material)[0];
  return PART_OF.find(([re]) => re.test(m?.name || ""))?.[1] || null;
}

// ---- Entrances (出场): each comes down the slope from far up in the mountains to you (entrance.js routes).
// [clip (what ch.fav keeps), name, route]. The tricks are the ride's (its trick wheel), not here.
const ENTRANCES = [["Anim_Carve_Ref", "欧式刻滑", "A"], ["Anim_Carve_Spin_Toe", "刻平陀螺", "B"], ["Anim_Carve_S", "立刃 S 弯", "C"],
  ["Entrance_D", "跳台 Method", "D"], ["Anim_Skid_S", "搓雪 S 弯", "E"], ["Anim_Pop_Ref", "坡上跳跃", "F"], ["Anim_Toe_Slide_Ref", "平花倒滑", "G"]];
// Each one's line as a little drawing on its card (84 × 56).
const GLYPH = {
  A: `<path d="M6 46 C 22 46, 20 10, 38 10 S 58 44, 78 22"/>`,
  B: `<path d="M6 46 C 22 40, 30 32, 42 30"/><circle cx="56" cy="26" r="12"/>`,
  C: `<path d="M42 4 C 70 12, 70 22, 42 28 S 14 44, 42 52"/>`,
  D: `<path d="M6 48 L 34 40 Q 40 38, 42 30"/><path d="M42 30 C 50 6, 64 8, 70 36" stroke-dasharray="2 5"/><path d="M70 36 L 80 34"/>`,
  E: `<path d="M42 4 C 70 12, 70 22, 42 28 S 14 44, 42 52" stroke-width="6" stroke-dasharray="3 4" opacity=".75"/>`,
  F: `<path d="M6 48 L 30 40"/><path d="M30 40 C 40 8, 56 8, 64 34" stroke-dasharray="2 5"/><path d="M64 34 L 80 30"/>`,
  G: `<path d="M6 46 C 22 42, 32 34, 46 30"/><path d="M50 22 L 52 38 M58 20 L 60 36 M66 18 L 68 34" stroke-width="2.5"/>`,
  P: `<path d="M20 4 C 60 10, 60 22, 36 28 S 20 44, 42 52"/><circle cx="62" cy="46" r="5"/>`,
};
// On skis (双板): the board's moves don't apply; the skier's own, posed by skier.js from entrance.js's numbers.
const SKI_ENTRANCES = [["Ski_S", "平行 S 弯", "S"], ["Ski_Schuss", "直滑降", "T"]];
GLYPH.S = `<path d="M38 4 C 66 12, 66 22, 40 28 S 14 44, 42 52"/><path d="M46 4 C 74 12, 74 22, 48 28 S 22 44, 50 52" opacity=".55"/>`;
GLYPH.T = `<path d="M30 4 L 40 52" /><path d="M38 4 L 48 52" opacity=".55"/><path d="M34 52 L 56 46" stroke-width="5"/>`;
// An old favourite that was a trick: the nearest entrance (a jump for the jumps, else the carve). A skier's
// favourite is kept apart (ch.skiFav), so going back to the board keeps the board's.
const onSkis = () => sportOf(wear.ch) === "ski";
const entrancesOf = () => (onSkis() ? SKI_ENTRANCES : rider?.pet ? ENTRANCES.filter(([k]) => rider.clips[k]) : ENTRANCES); // a rigged animal: the ones it has clips for
const favOf = (ch) => (onSkis() ? (SKI_ENTRANCES.some(([k]) => k === ch.skiFav) ? ch.skiFav : SKI_ENTRANCES[0][0])
  : entrancesOf().some(([k]) => k === ch.fav) ? ch.fav : /Ollie|Air/.test(ch.fav || "") ? "Anim_Pop_Ref" : "Anim_Carve_Ref");
// An animal rides the same slope down (a gentle S) and does one of its moves in front of you (animal.js).
const petFav = (ch) => (PET_MOVES.some(([k]) => k === ch.petFav) ? ch.petFav : PET_MOVES.some(([k]) => k === ch.fav) ? ch.fav : PET_MOVES[0][0]);
let lastEntry = null, afterEntry = null;
// The rider's entrance: the one tapped (k: its clip), else their favourite.
function enter(k) {
  if (!rider) return;
  focus = "full"; pose = "Stand_Idle"; renderPoses();
  if (rider.isAnimal) { k ||= petFav(wear.ch); afterEntry = k; entrance.start("P", rider, turntable); }
  else { k ||= favOf(wear.ch); afterEntry = null; entrance.start(entrancesOf().find(([c]) => c === k)[2], rider, turntable); }
  lastEntry = k; renderEntries();
}
// Back on the spot, facing you (for a close look at a part, or a pose).
function center() {
  entrance.stop(); turntable.position.set(0, 0, 0); afterEntry = null;
  turntable.rotation.y = Math.atan2(Math.sin(turntable.rotation.y), Math.cos(turntable.rotation.y)); spinTo = 0;
}

// ---- The camera: the whole rider, or close on the part being changed (the upper body for the jacket, the legs
// for the pants, the head for the helmet and goggles...), framed in the clear part of the screen: between the
// title and the poses, or right of the wardrobe's rail and above its sheet. [bone(s), distance, how far above,
// look lower by]
const REST = { pos: new THREE.Vector3(0, 1.2, 4.7), at: new THREE.Vector3(0, 0.86, 0) };
const view = { pos: REST.pos.clone(), at: REST.at.clone() }, look = REST.at.clone();
const SHOTS = { upper: [["Chest"], 3.2, 0.12, 0.08], legs: [["ShinL", "ShinR"], 3.6, 0.15, 0.05], head: [["Head"], 1.9, 0.08, 0.02],
  hands: [["HandL", "HandR"], 2.8, 0.15, 0.06], feet: [["FootL", "FootR"], 2.6, 0.35, -0.02], board: [["FootL", "FootR"], 4.6, 0.55, -0.4] };
const FOCUS = { top: "upper", pants: "legs", gloves: "hands", lens: "head", helmet: "head", boots: "feet", board: "board" };
let focus = "full";
const v3 = new THREE.Vector3();
function aim() {
  const s = SHOTS[focus];
  // an animal: nearer and lower, the whole board in the picture
  if (rider?.isAnimal || (rider?.pet && !s)) { const h = rider.tall; view.at.set(0, h * 0.42, 0); view.pos.set(0, h * 0.42 + 0.7 + h * 0.2, 3.4 + h * 0.9); return; }
  if (!s || !rider) { view.pos.copy(REST.pos); view.at.copy(REST.at); return; }
  // a rigged animal's head is a big one, with its hat (and the leaf on it) well above the Head bone
  const big = rider.pet && focus === "head", [bones, d0, up, low] = s, d = big ? d0 * 1.8 : d0;
  view.at.set(0, 0, 0); for (const b of bones) view.at.add(rider.bones[b].getWorldPosition(v3)); view.at.divideScalar(bones.length);
  view.at.x *= 0.5; view.at.z *= 0.5; view.at.y -= big ? -0.12 : low; // keep near the middle, a little below the part
  view.pos.set(view.at.x, view.at.y + d * up, view.at.z + d);
}
// The clear part of the screen (CSS px), and the picture moved and scaled so its middle is there and its height
// fits it (camera zoom and view offset: the snow world stays one picture, just framed).
const clear = () => {
  const W = innerWidth, H = innerHeight, r = (id) => $(id).getBoundingClientRect();
  if (dressing) { const top = r("dressTop").bottom + 4, left = r("rail").right + 2, bottom = r("sheet").top - 4; return { x: left, y: top, w: W - left, h: Math.max(80, bottom - top) }; }
  const top = r("head").bottom + 4, bottom = r("dock").top;
  return { x: 0, y: top, w: W, h: Math.max(80, bottom - top) };
};
const frame = { cx: 0, cy: 0, k: 1, ready: false };
function fit(dt) {
  const W = innerWidth, H = innerHeight, c = clear(), cx = c.x + c.w / 2, cy = c.y + c.h / 2, k = Math.min(1, c.h / H);
  const e = frame.ready ? 1 - Math.exp(-dt * 6) : 1; frame.ready = true;
  frame.cx += (cx - frame.cx) * e; frame.cy += (cy - frame.cy) * e; frame.k += (k - frame.k) * e;
  camera.zoom = frame.k; camera.setViewOffset(W, H, W / 2 - frame.cx, H / 2 - frame.cy, W, H); camera.updateProjectionMatrix();
}
window.__stage = { scene, camera, turntable, entrance, get rider() { return rider; }, get focus() { return focus; }, enter, open, closeDress, playPose: (k) => playPose(k) }; // testing
// Poses are loops, under the breath and the gaze character.js adds while a pose holds. Since the character AI's
// batch 4d these clips are seamless loops that start in the pose (the wave only in the mitten, the cheer a fan
// from the shoulders, the photo and radio a breath and a nod), so they play straight through, round and round;
// played to and fro, the wave and the cheer ran backwards every other pass. Any other pose goes to and fro over
// the whole clip.
const CYCLE = new Set(["Pose_Wave", "Pose_Cheer", "Pose_Hold_Photo", "Radio_Talk_Stand", "Board_Hold", "Sit_Snow"]);
const looping = { k: null, t: 0 };
function loopPose(dt) {
  if (!rider || rider.isAnimal || entrance.running || !POSES.some(([n]) => n === rider.current)) { looping.k = null; return; }
  const k = rider.current, clip = rider.clips[k], a = clip && rider.mixer.existingAction(clip); if (!a) return;
  if (looping.k !== k) { looping.k = k; looping.t = 0; }
  const L = clip.duration - 1e-3, s = (looping.t += dt);
  a.time = CYCLE.has(k) ? s % clip.duration : s % (2 * L) < L ? s % (2 * L) : 2 * L - (s % (2 * L));
}
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (tab !== "rider") return;
  const sk = skiNow(); sk?.before();
  if (rider) { loopPose(dt); rider.step(dt); const was = entrance.running; entrance.step(dt);
    sk?.after(dt, entrance.running ? entrance.now?.ski || null : null, pose === "Stand_Idle");
    if (was && !entrance.running && afterEntry) { rider.play(afterEntry, { once: true }); afterEntry = null; } } // an animal's move, arrived
  if (spinTo !== null) { turntable.rotation.y += (spinTo - turntable.rotation.y) * (1 - Math.exp(-dt * 6)); if (Math.abs(turntable.rotation.y - spinTo) < 1e-3) spinTo = null; }
  // the sun and its shadow camera ride along with the rider
  const at = turntable.position; sun.position.set(at.x + 3, at.y + 6, at.z + 4); sun.target.position.copy(at);
  // the camera: the entrance's shots while it runs, else easing to the rider (or the part being changed)
  fit(dt); aim();
  if (!entrance.shoot(camera, dt, view)) { const k = 1 - Math.exp(-dt * 4); camera.position.lerp(view.pos, k); look.lerp(view.at, k); camera.lookAt(look); }
  renderer.render(scene, camera);
});

// Dress the rider in what I wear. { enter }: and run their entrance (a new outfit).
const chars = {};
// The skier stages by template: the one worn now, if on skis. The character AI's gear and Ski_ clips (ski.js), or
// the stand-in (skier.js skiStage) if they don't load.
const skis = {};
// With the real files: Ski_Stand for 站立; an entrance plays the clip its numbers call for (entrance.js run.now.ski:
// a hockey stop, a tuck, a turn, a glide), back to the pose when it ends.
// The board's poses (a wave, a photo) keep their upper body; their legs are put on the skis by hand (skier.js, legs only).
function realSki(c, ch) {
  c.ski(true);
  const mirror = (on) => { c.root.scale.z = Math.abs(c.root.scale.z) * (on ? -1 : 1); };
  const legs = skiStage(c, ch, c.rest, { rigOnly: true });
  let riding = false;
  return {
    real: true, gear: null,
    before() { if (!/^Ski_/.test(c.current || "")) legs.before(); },
    after(dt, ride) {
      const own = /^Ski_/.test(c.current || "");
      holder.rotation.y = own ? -Math.PI / 2 : 0; // the Ski_ clips face +x (docs/SKI_RIDERS.md); the board's poses face you
      if (!own && !ride) legs.after(dt, null, true);
      if (ride) {
        const k = ride.hockey > 0.3 ? "Ski_Hockey_Stop" : ride.tuck > 0.5 ? "Ski_Tuck" : ride.edge > 0.18 ? "Ski_Turn_R" : ride.edge < -0.18 ? "Ski_Turn_L" : "Ski_Glide";
        // the clip's hockey stop swings the skis to the right: after a left turn (slip > 0) it is played mirrored,
        // across the skier's left and right (the model's z: its forward is +x)
        if (k === "Ski_Hockey_Stop" && c.current !== k) mirror(ride.slip > 0);
        if (c.current !== k) c.play(k, { once: k === "Ski_Hockey_Stop", fade: 0.35 });
        riding = true;
      } else if (riding) { riding = false; mirror(false); c.play(clipOf(pose), { fade: 0.6 }); }
    },
    off() { mirror(false); legs.off(); c.ski(false); },
  };
}
// The pose's clip: on the real skis, standing is Ski_Stand.
const clipOf = (k) => (k === "Stand_Idle" && skiNow()?.real ? "Ski_Stand" : k);
const skiNow = () => (rider && !rider.isAnimal && onSkis() ? skis[tplOf(wear.ch)] : null);
const holder = new THREE.Group(); turntable.add(holder);
// An animal (animal.js) is made when picked and let go when another is (its file goes with it).
let pet = null; // { animal, made: a promise of its stage figure }
const dropPet = () => { const p = pet; pet = null; p?.made.then((s) => { if (rider === s) { holder.remove(s.root); rider = null; } s.dispose(); }); };
async function show({ enter: go = false } = {}) {
  const ch = wear.ch, a = petOf(ch), key = a || tplOf(ch);
  if (pet && pet.animal !== a) dropPet();
  if (a && !pet) pet = { animal: a, made: animalRider({ animal: a }).then(animalStage) };
  const c = await (a ? pet.made : (chars[tplOf(ch)] ||= makeCharacter(tplOf(ch)).then((m) => { m.rest = []; m.root.traverse((o) => { if (o.isBone) m.rest.push([o, o.position.clone(), o.quaternion.clone()]); }); return m; })));
  if (ch !== wear.ch || key !== (petOf(wear.ch) || tplOf(wear.ch))) return; // something else was put on meanwhile
  const swapped = rider !== c;
  if (swapped) { if (rider) holder.remove(rider.root); rider = c; holder.add(c.root); if (a) center(); renderPoses(); }
  if (a) c.setBoard(ch.board); else c.set(ch);
  // regular or goofy: the character is mirrored (the entrance rides goofy's line mirrored, entrance.js); a skier never
  holder.scale.x = wear.stance === "goofy" && !onSkis() ? -1 : 1;
  // on skis or off them (skier.js: the board hidden, skis and poles on; the old stage let go)
  const want = !a && onSkis() ? tplOf(ch) : null;
  for (const k of Object.keys(skis)) if (skis[k] && k !== want) { skis[k].off(); skis[k] = null; }
  if (want && !skis[want]) {
    const real = await addSki(c).then(() => !!(c.skiGear?.length && c.clips.Ski_Stand)).catch(() => false);
    if (ch !== wear.ch || !onSkis()) return show(); // changed meanwhile
    holder.updateMatrixWorld(true);
    skis[want] ||= real ? realSki(c, ch) : skiStage(c, ch, c.rest);
  }
  if (want) { colorSkis(skis[want].gear, ch); if (skis[want].real) tintSkiGear(c, ch); }
  if (!want) holder.rotation.y = 0;
  holder.position.y = a ? 0.004 : c.pet ? 0.062 : 0.062 * ch.height / CFG.templates[ch.tpl].height; // the template's snow is a little below its origin
  if (go && focus === "full") enter();
  else if (swapped || !c.current || (want && skis[want]?.real && c.current === "Stand_Idle") || (!want && /^Ski_/.test(c.current || ""))) { if (entrance.running) center(); c.play(clipOf(pose), { fade: 0 }); }
  $("status").hidden = true;
}
const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---- Poses (摆姿势): one row of chips, all loops. An animal only stands (its walk, slowly); its moves are its entrances.
const POSE_ROW = ["Stand_Idle", "Board_Hold", "Pose_Wave", "Pose_Cheer", "Sit_Snow", "Pose_Hold_Photo", "Radio_Talk_Stand"];
const LABEL = Object.fromEntries([...POSES, ...ENTRANCES, ...SKI_ENTRANCES, ...PET_MOVES.map(([k, l]) => [k, l])]);
// On skis: the poses that don't need the board (no 抱板, no sitting in the snow on it).
const SKI_POSES = ["Stand_Idle", "Pose_Wave", "Pose_Cheer", "Pose_Hold_Photo", "Radio_Talk_Stand"];
let pose = "Stand_Idle", entries = false;
function playPose(k) {
  if (!rider) return;
  if (entrance.running) center();
  pose = k; rider.play(clipOf(k)); renderPoses();
}
function renderPoses() {
  // a rigged animal: the poses it has clips for (character.js leaves out the ones its short arms can't do)
  const list = petOf(wear.ch) ? ["Stand_Idle"] : rigOf(wear.ch) ? POSE_ROW.filter((k) => !rider?.pet || rider.clips[k]) : onSkis() ? SKI_POSES : POSE_ROW;
  $("poses").innerHTML = list.map((k) => `<button class="${k === pose ? "on" : ""}" data-pose="${k}">${t(LABEL[k])}</button>`).join("");
}
$("poses").addEventListener("click", (e) => { const b = e.target.closest("[data-pose]"); if (b) playPose(b.dataset.pose); });
// The entrances' strip, in place of the poses: a tap plays one from the top of the slope, every time from the
// start; a tap on the one just played makes it the favourite (★, played when the page opens).
function renderEntries() {
  const a = petOf(wear.ch), fav = a ? petFav(wear.ch) : favOf(wear.ch);
  const list = a ? PET_MOVES.map(([k, l]) => [k, l, "P"]) : entrancesOf();
  $("entries").innerHTML = list.map(([k, l, r]) => `<button class="ecard${k === lastEntry ? " on" : ""}" data-entry="${k}">${k === fav ? `<i class="st">★</i>` : ""}<svg viewBox="0 0 84 56" aria-hidden="true">${GLYPH[r]}</svg><span>${t(l)}</span></button>`).join("");
}
$("entries").addEventListener("click", (e) => {
  const b = e.target.closest("[data-entry]"); if (!b) return;
  const k = b.dataset.entry, a = petOf(wear.ch);
  if (k === lastEntry && k !== (a ? petFav(wear.ch) : favOf(wear.ch))) { if (a) wear.ch.petFav = k; else if (onSkis()) wear.ch.skiFav = k; else wear.ch.fav = k; save(); renderEntries(); return; }
  enter(k);
});
function showEntries(on) {
  entries = on; $("posePane").hidden = on; $("entryPane").hidden = !on; $("goBtn").hidden = on;
  if (on) { renderEntries(); enter(); }
}
$("goBtn").onclick = () => showEntries(true);
$("entryClose").onclick = () => showEntries(false);

// ---- The wardrobe (换装): a rail of icons down the left, what the chosen one changes on a sheet at the bottom;
// the tabs step aside meanwhile. Opened by 换装 or by a tap on a part of the rider; ‹ 人物 or 完成 closes it.
const ICON = (n) => `assets/icons/${n}.png?v=1`;
const NAV = [["outfits", "hanger", "穿搭"], ["top", "jacket", "上衣"], ["pants", "pants", "裤子"], ["gear", "helmet", "装备"], null, ["look", "look_mirror", "外形"]];
const GEAR = [["gloves", "gloves", "手套"], ["lens", "lens", "雪镜"], ["helmet", "helmet", "头盔"], ["boots", "boots", "雪鞋"], ["board", "board", "雪板"]];
// 单板 / 双板, the 雪板 sheet's first row: board or skis, kept on the rider (ch.sport "ski", else a board), so
// friends see it too (core/look.js, together-core.js cleanRider). Under it, the board's styles and stance, or the
// skis' colour wash. The animals ride boards: no row for them.
const sportRow = (ch) => (ch.animal ? "" : `<div class="seg sport">${[["board", "snowboard", "单板"], ["ski", "ski", "双板"]].map(([k, ic, l]) =>
  `<button class="${sportOf(ch) === k ? "on" : ""}" data-sport="${k}"><img src="${ICON(ic)}" alt="">${t(l)}</button>`).join("")}</div>`);
// A rigged animal's gear: bare paws (no gloves), and a hat (its beanie, or the helmet under it).
const RIG_GEAR = GEAR.filter(([k]) => k !== "gloves").map((n) => (n[0] === "helmet" ? ["helmet", "helmet", "帽子"] : n));
let wtab = "outfits", gear = "helmet", naming = false, dressing = false, palette = null;
// Open a wardrobe item (and a gear's own sub-item): the camera goes close on that part, or back out.
// An animal wears nothing: its camera stays put, and of the gear only the board is left.
function open(k, sub) {
  if (!dressing) { dressing = true; document.body.classList.add("dressing"); if (entries) showEntries(false); }
  wtab = k; if (sub) gear = sub; naming = false; palette = null;
  if (rigOf(wear.ch) && gear === "gloves") gear = "helmet";
  focus = petOf(wear.ch) ? "full" : (k === "gear" ? FOCUS[gear] : FOCUS[k]) || "full";
  if (focus !== "full") { const was = entrance.running; center(); if (was && rider) { pose = "Stand_Idle"; rider.play(clipOf(pose)); renderPoses(); } }
  render();
}
function closeDress() {
  dressing = false; document.body.classList.remove("dressing"); focus = "full"; naming = false; palette = null;
}
$("dressBtn").onclick = () => open(wtab);
$("dressBack").onclick = $("dressDone").onclick = closeDress;
const nav = ([k, ic, l], cur, off = false) => `<button class="${k === cur ? "on" : ""}${off ? " off" : ""}" data-k="${k}"><img src="${ICON(ic)}" alt="">${t(l)}</button>`;
// One row of swatches for a part; the colour worn now leads it when it isn't one of them; the last opens the palette.
function swatches(part) {
  const cur = colorOf(wear.ch, part), list = SWATCHES[part].some((c) => same(c, cur)) ? SWATCHES[part] : [cur, ...SWATCHES[part]];
  return `<div class="swrow" data-paint="${part}">${list.map((c) => `<button class="sw${same(c, cur) ? " on" : ""}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join("")}`
    + `<button class="sw more" data-palette="${part}" aria-label="${t("更多颜色")}"><img src="${ICON("palette")}" alt=""></button></div>`;
}
// The palette: 32 colours and the last few picked, on the sheet in place of the part's choices.
function paletteCard(part) {
  const cur = colorOf(wear.ch, part), rec = recent(), dot = (c) => `<button class="sw${same(c, cur) ? " on" : ""}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`;
  return `<div class="phead"><b>${t(PART_ZH[part])}</b><button class="back" data-pclose>${t("‹ 收起")}</button></div>`
    + `<div class="pgrid" data-paint="${part}">${PALETTE.map(dot).join("")}</div>`
    + (rec.length ? `<small class="lbl">${t("最近用过")}</small><div class="swrow" data-paint="${part}">${rec.map(dot).join("")}</div>` : "");
}
// A part on or off, as a little picture of it (tools/render_thumbs.mjs).
const tile = (k, l) => `<button class="tile${wear.ch.parts[k] ? " on" : ""}" data-part="${k}"><i style="background-image:url(assets/riders/thumbs/${k}_${wear.ch.tpl.toLowerCase()}.png?v=2)"></i>${t(l)}</button>`;
// An outfit's colours as dots; an animal's, its picture (tools/render_animal_thumbs.mjs).
const petPic = (a) => `assets/riders/thumbs/animal_${a}.png?v=1`;
const dots = (ch) => ch.animal ? `<span class="dots pet"><i style="background-image:url(${petPic(ch.animal)})"></i></span>` : `<span class="dots">${["jacket", "pants", "helmet", "lens", "boots"].map((p) => `<i style="background:${colorOf(ch, p)}"></i>`).join("")}</span>`;
// The look in three-way choices: build (the weight and muscle morphs) and fit (the jacket's and the pants'
// ease and the jacket's length together); 标准 is the template's own. A look made with the old sliders shows
// as the nearest of the three, and keeps its numbers until one is picked.
const BUILD = { slim: { weight: 30, muscle: 34 }, std: null, strong: { weight: 62, muscle: 70 } };
const FIT = { snug: { jease: 64, pease: 52, jlen: -6 }, std: null, loose: { jease: 90, pease: 96, jlen: -1 } };
const BUILD_ZH = { slim: "偏瘦", std: "标准", strong: "结实" }, FIT_ZH = { snug: "合身", std: "标准", loose: "宽松" };
const presetOf = (set, k, tpl) => set[k] || Object.fromEntries(Object.keys(Object.values(set).find(Boolean)).map((x) => [x, CFG.templates[tpl].base[x]]));
function nearest(set, ch) {
  const S = Object.fromEntries(CFG.sliders.map((x) => [x.key, x])); let best = null, bd = Infinity;
  for (const k of Object.keys(set)) { const p = presetOf(set, k, ch.tpl), d = Object.entries(p).reduce((s, [x, v]) => s + ((ch[x] - v) / (S[x].hi - S[x].lo)) ** 2, 0); if (d < bd) { bd = d; best = k; } }
  return best;
}
const seg = (set, zh, ch, key) => `<div class="seg">${Object.keys(set).map((k) => `<button class="${nearest(set, ch) === k ? "on" : ""}" data-${key}="${k}">${t(zh[k])}</button>`).join("")}</div>`;
// The hair: short (none: under the helmet), long or a braid (the woman's template; the man's has none).
const HAIR_ROW = [["none", "短发"], ["loose", "长发"], ["braid", "辫子"]].filter(([k]) => HAIR.some(([h]) => h === k));
function render() {
  const ch = wear.ch, a = petOf(ch), rig = rigOf(ch), gk = a ? "board" : gear;
  $("rail").innerHTML = NAV.map((n) => (n ? nav(n, wtab, a && (n[0] === "top" || n[0] === "pants")) : `<hr>`)).join("");
  $("wsub").innerHTML = wtab === "gear" && !palette ? (rig ? RIG_GEAR : GEAR).filter((n) => !a || n[0] === "board").map((n) => nav(n, gk)).join("") : "";
  $("wsub").hidden = wtab !== "gear" || !!palette;
  let h = "";
  const noClothes = `<p class="pethint">${t("小动物不穿衣服，换块雪板吧")}<button class="chip" data-toboard>${t("雪板")} ›</button></p>`;
  if (wtab === "outfits") {
    const card = (r) => `<button class="combo${wear.from === r.id && !wear.dirty ? " on" : ""}" data-outfit="${r.id}">${dots(charOf(r))}<span translate="no">${escape(r.name)}</span>${r.isDefault ? "" : `<i class="del" data-del="${r.id}" aria-label="${t("删除")}">×</i>`}</button>`;
    h = naming
      ? `<form class="naming"><input id="name" maxlength="16" placeholder="${t("比如：周末粉雪")}" value="${escape(outfitOf(wear.from)?.isDefault ? "" : wearName())}"><button type="button" data-cancel>${t("取消")}</button><button class="go">${t("保存")}</button></form>`
      : `<small class="lbl">${t("穿搭")}</small><div class="swrow cards">${wear.dirty ? `<button class="combo keep" data-keep>${dots(ch)}<span>${t("存成我的")}</span></button>` : ""}`
        + `<button class="combo rnd" data-shuffle aria-label="${t("随机")}"><img src="${ICON("shuffle")}" alt=""><span>${t("随机")}</span></button>`
        + Object.keys(OUTFITS).map((k) => card(template(k))).join("") + st.riders.map(card).join("") + `</div>`;
  }
  const colours = (part) => `<small class="lbl">${t("颜色")}</small>${swatches(part)}`;
  // a rigged animal's own accessories: on or off, as chips (it has no part pictures)
  const acc = (k, l) => `<button class="chip${petParts(PETS[rig], ch)[k] ? " on" : ""}" data-ppart="${k}">${t(l)}</button>`;
  if (a && (wtab === "top" || wtab === "pants")) h = noClothes;
  else if (rig && wtab === "top") h = colours("jacket") + `<small class="lbl">${t("款式")}</small><div class="tiles">${acc("backpack", "背包")}</div>`
    + (petParts(PETS[rig], ch).backpack ? `<small class="lbl">${t("背包颜色")}</small>${swatches("backpack")}` : "");
  else if (wtab === "top") h = colours("jacket") + `<small class="lbl">${t("款式")}</small><div class="tiles">${tile("hood", "帽兜")}${tile("vest", "马甲")}${tile("grid", "格子")}</div>`
    + (ch.parts.vest ? `<small class="lbl">${t("马甲颜色")}</small>${swatches("vest")}` : "");
  else if (wtab === "pants") h = colours("pants");
  if (wtab === "gear") {
    if (rig && gk === "helmet") { const on = petParts(PETS[rig], ch).beanie;
      h = `<small class="lbl">${t("款式")}</small><div class="tiles">${acc("beanie", "橘子帽")}<button class="chip${!on ? " on" : ""}" data-ppart="beanie">${t("头盔")}</button></div>`
        + `<small class="lbl">${t(on ? "帽子颜色" : "头盔颜色")}</small>${swatches(on ? "beanie" : "helmet")}`; }
    else if (gk === "helmet") h = colours("helmet") + `<small class="lbl">${t("款式")}</small><div class="tiles">${tile("visor", "帽檐")}${tile("stickers", "贴纸")}<button class="chip${ch.glossyHelmet ? " on" : ""}" data-gloss>${t("亮面")}</button></div>`;
    else if (gk === "board" && onSkis()) h = sportRow(ch) + `<div class="boardrow"><div class="boards">${BOARDS.map((k) => `<button class="${ch.board === k ? "on" : ""}" data-board="${k}"><span class="skis">${[0, 1].map(() => `<i style="--a:${SKI_COLORS[k][0]};--b:${SKI_COLORS[k][1]}"></i>`).join("")}</span></button>`).join("")}</div></div>`;
    else if (gk === "board") h = (a ? `<p class="pethint">${t("小动物不穿衣服，换块雪板吧")}</p>` : sportRow(ch)) + `<div class="boardrow"><div class="boards">${BOARDS.map((k) => `<button class="${ch.board === k ? "on" : ""}" data-board="${k}"><img src="assets/riders/boards/${k}_base.jpg?v=1" alt=""></button>`).join("")}</div>`
      + `<div class="stance">${["regular", "goofy"].map((s) => `<button class="chip${wear.stance === s ? " on" : ""}" data-stance="${s}">${s === "regular" ? "Regular" : "Goofy"}</button>`).join("")}<small>${t(wear.stance === "goofy" ? "右脚在前" : "左脚在前")}</small></div></div>`;
    else h = colours(gear);
  }
  if (wtab === "look") {
    const T = CFG.templates[ch.tpl];
    // who: one of the two bodies, or one of the resort animals on a board
    h = `<small class="lbl">${t("角色")}</small><div class="swrow who">${["F", "M"].map((k, i) => `<button class="tile${!ch.animal && ch.tpl === k ? " on" : ""}" data-tpl="${k}"><i style="background-image:url(assets/riders/thumbs/body_${k.toLowerCase()}.png?v=1)"></i>${t("体形 {n}", { n: i + 1 })}</button>`).join("")}`
      + [...RIGGED, ...ANIMAL_RIDERS].map((k) => `<button class="tile${ch.animal === k ? " on" : ""}" data-animal="${k}"><i style="background-image:url(${petPic(k)})"></i>${t(ANIMAL_ZH[k])}</button>`).join("") + `</div>`;
    // a rigged animal: its fur's colour; no hair, height or body (it has no sliders)
    if (rig) h += `<small class="lbl">${t("毛色")}</small>${swatches("fur")}`;
    else if (!a) h += (ch.tpl === "F" ? `<div class="sec"><div class="t">${t("发型")}</div><div class="seg">${HAIR_ROW.map(([k, l]) => `<button class="${hairOf(ch) === k ? "on" : ""}" data-hair="${k}">${t(l)}</button>`).join("")}</div>`
        + (hairOf(ch) !== "none" ? `<div class="swrow hairc">${SWATCHES.hair.map((c) => `<button class="sw${same(c, colorOf(ch, "hair")) ? " on" : ""}" data-c="${c}" data-for="hair" style="background:${c}" aria-label="${c}"></button>`).join("")}</div>` : "") + `</div>` : "")
      + `<label class="sec"><div class="t">${t("身高")}<em data-v="height">${ch.height} cm</em></div><input type="range" data-k="height" min="${T.hmin}" max="${T.hmax}" step="1" value="${ch.height}"></label>`
      + `<div class="sec"><div class="t">${t("身材")}</div>${seg(BUILD, BUILD_ZH, ch, "build")}</div>`
      + `<div class="sec"><div class="t">${t("衣服版型")}</div>${seg(FIT, FIT_ZH, ch, "fit")}</div>`;
  }
  if (palette) h = paletteCard(palette);
  $("wbody").innerHTML = h; $("wbody").dataset.tab = palette ? "palette" : wtab;
  // the outfit (or who) worn, in sight in its row (the row only: scrollIntoView would move the whole stage)
  const on = $("wbody").querySelector(".combo.on, .who .tile.on");
  if (on) on.parentElement.scrollLeft = on.offsetLeft - (on.parentElement.clientWidth - on.offsetWidth) / 2;
  if (naming) { $("name").focus(); $("name").select(); } // keep the name to update that outfit, or type a new one
}
$("rail").addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) open(b.dataset.k); });
$("wsub").addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) open("gear", b.dataset.k); });
// Wear an outfit: a new copy of it (your stance stays yours), and its entrance.
function wearOutfit(r) {
  const was = petOf(wear.ch), sport = wear.ch.sport;
  Object.assign(wear, { ch: deep(charOf(r)), from: r.id, name: r.name, dirty: false });
  if (sport === "ski") wear.ch.sport = "ski"; else delete wear.ch.sport; // board or skis is yours, whatever you wear
  if (was !== petOf(wear.ch)) { if (wtab !== "outfits") open(wtab); pose = "Stand_Idle"; renderPoses(); }
  save(); render(); show({ enter: true });
}
// To or from an animal: the poses change, and so does what the wardrobe offers.
function becomePet(k) {
  if (k) wear.ch.animal = k; else delete wear.ch.animal;
  pose = "Stand_Idle"; renderPoses(); lastEntry = null;
  wear.dirty = true; save(); render(); show({ enter: true });
}
$("wbody").addEventListener("click", (e) => {
  const el = e.target.closest("button, [data-del]"); if (!el) return;
  const d = el.dataset, ch = wear.ch;
  if (d.del) {
    e.stopPropagation(); const r = st.riders.find((x) => x.id === d.del);
    if (!r || !confirm(`${t("删除")}「${r.name}」？`)) return;
    st.riders = st.riders.filter((x) => x !== r);
    if (wear.from === r.id) Object.assign(wear, { from: null, name: r.name, dirty: true });
    save(); render(); show(); return;
  }
  if (d.outfit) return wearOutfit(outfitOf(d.outfit));
  if (d.animal) return d.animal !== ch.animal && becomePet(animalOf(d.animal));
  if ("toboard" in d) return open("gear", "board");
  if ("keep" in d) { naming = true; return render(); }
  if ("cancel" in d) { naming = false; return render(); }
  if (d.palette) { palette = d.palette; return render(); }
  if ("pclose" in d) { palette = null; return render(); }
  if ("shuffle" in d) { // a colour from each part's list
    for (const p of ["jacket", "pants", "helmet", "gloves", "lens", "boots"]) if (!(rigOf(ch) && p === "gloves")) paint(ch, p, SWATCHES[p][Math.floor(Math.random() * SWATCHES[p].length)]);
    wear.dirty = true; render(); return changed();
  }
  if (d.c) { // a swatch: its row says which part (the hair's dots say it themselves); off the palette, kept as recent
    const part = d.for || el.closest("[data-paint]").dataset.paint; paint(ch, part, d.c);
    if (palette) { remember(d.c); changed(); return render(); }
    for (const s of el.parentElement.querySelectorAll(".sw[data-c]")) s.classList.toggle("on", s === el);
    return changed();
  }
  if (d.part) { ch.parts[d.part] = !ch.parts[d.part]; return changed({ body: true }); }
  if (d.ppart && rigOf(ch)) { ch.parts[d.ppart] = !petParts(PETS[rigOf(ch)], ch)[d.ppart]; return changed({ body: true }); }
  if ("gloss" in d) { ch.glossyHelmet = !ch.glossyHelmet; return changed({ body: true }); }
  if (d.board) { ch.board = d.board; return changed({ body: true }); }
  if (d.sport) { // on skis (or off them) at once, standing: Ski_Stand on skis
    if (d.sport === sportOf(ch) || ch.animal) return;
    if (d.sport === "ski") ch.sport = "ski"; else delete ch.sport;
    if (entrance.running) center();
    pose = "Stand_Idle"; lastEntry = null; renderPoses(); if (entries) renderEntries();
    save(); render(); return show();
  }
  if (d.stance) { wear.stance = d.stance; save(); render(); return show(); }
  if (d.hair) { setHair(ch, d.hair); return changed({ body: true }); }
  if (d.build) { Object.assign(ch, presetOf(BUILD, d.build, ch.tpl)); return changed({ body: true }); }
  if (d.fit) { Object.assign(ch, presetOf(FIT, d.fit, ch.tpl)); return changed({ body: true }); }
  if (d.tpl && ch.animal) { // back to a person: the body tapped, in the clothes they had
    if (d.tpl !== ch.tpl) { const pre = presetChar(Object.keys(CFG.presets).find((k) => CFG.presets[k].tpl === d.tpl)); Object.assign(ch, { tpl: pre.tpl, height: pre.height }); setHair(ch, hairOf(pre)); }
    return becomePet(null);
  }
  if (d.tpl && d.tpl !== ch.tpl) { // the other template: its preset's height and hair, the same colours, parts and fit
    const pre = presetChar(Object.keys(CFG.presets).find((k) => CFG.presets[k].tpl === d.tpl));
    Object.assign(ch, { tpl: pre.tpl, height: pre.height }); setHair(ch, hairOf(pre));
    return changed({ body: true });
  }
});
// The height: live as it slides.
$("wbody").addEventListener("input", (e) => {
  const i = e.target; if (i.type !== "range") return;
  wear.ch[i.dataset.k] = +i.value; $("wbody").querySelector(`[data-v="${i.dataset.k}"]`).textContent = `${wear.ch[i.dataset.k]} cm`; changed();
});
// Save what I wear as one of my outfits, by a short name (the same name as the one it came from: that one, updated).
$("wbody").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("name").value.trim();
  if (!name) { $("name").focus(); $("name").placeholder = t("先取个名字"); return; }
  const was = st.riders.find((r) => r.id === wear.from), r = was && was.name === name ? was : { id: "r" + Date.now().toString(36), base: "rider_a" };
  Object.assign(r, { name, colors: partColors(wear.ch), ch: deep(wear.ch) });
  if (r !== was) st.riders.push(r);
  Object.assign(wear, { from: r.id, name, dirty: false }); naming = false;
  save(); render(); show();
});

// ---- Tabs: the rider, the resorts (a map of them to conquer), the journal. Riding in what you wear is the
// 雪场 tab: pick a mountain there (what you wear is kept as you change it).
let collection = null, tab = "rider";
const party = startParty({ page: "home", sub: "rider" }); // the party pet (src/core/party.js), on every tab
const logOf = () => { try { return JSON.parse(localStorage.getItem("prerunLog") || "{}"); } catch { return {}; } };
async function setTab(t) {
  tab = t; $("tabs").classList.remove("shut"); party.setSub(t);
  for (const b of $("tabs").children) b.classList.toggle("on", b.dataset.tab === t);
  const rider = t === "rider";
  $("stage").hidden = !rider;
  if (!rider && dressing) closeDress();
  $("status").hidden = !rider || !!rider_ready;
  $("world").hidden = t !== "resort"; $("records").hidden = t !== "log"; $("trips").hidden = t !== "trip";
  if (t === "trip") await openTrips();
  if (t === "resort") await openWorld();
  if (t === "log") await openRecords();
}
let rider_ready = false;
// The tabs fold into one round button while you look around — scrolling a page down, exploring the map — and
// a tap on it opens them again; scrolling back to the top opens them too.
const fold = () => $("tabs").classList.add("shut");
for (const id of ["trips", "records"]) {
  let last = 0; const el = $(id);
  el.addEventListener("scroll", () => { const y = el.scrollTop; if (y > last + 6 && y > 40) fold(); else if (y < 8) $("tabs").classList.remove("shut"); last = y; }, { passive: true });
}
for (const b of $("tabs").children) b.onclick = () => { if ($("tabs").classList.contains("shut")) { $("tabs").classList.remove("shut"); return; } setTab(b.dataset.tab); }; // folded: a tap opens it
const resortList = async () => (await (await fetch("data/resorts.json")).json()).filter((r) => r.ready);
async function openWorld() {
  const cv = $("world").querySelector("canvas");
  if (!collection) {
    const { Collection } = await import("./collection.js?v=64");
    collection = new Collection(cv, $("ctags")); window.__world = collection; // testing
    const stats = Object.fromEntries(Object.entries(logOf()).map(([id, l]) => [id, l.stats || {}]));
    collection.resize();
    addEventListener("resize", () => collection.resize());
    await collection.build(await resortList(), stats, logOf());
    // Under the title, just how far you've got: mountains visited, and how much of all of them you've skied.
    { const list = await resortList(), been = list.filter((r) => stats[r.id]?.touched).length, all = list.reduce((a, r) => a + (stats[r.id]?.share || 0), 0) / Math.max(1, list.length);
      $("worldHead").querySelector("small").textContent = been ? t("去过 {a} 座 · {b} 座里滑了 {p}%", { a: been, b: list.length, p: Math.max(1, Math.round(all * 100)) }) : t("{b} 座山，还没开始", { b: list.length }); }
    $("worldHome").onclick = () => { collection.overview(); $("worldCard").hidden = true; };
    $("allBtn").onclick = $("worldHome").onclick;
    collection.onPick = (r) => { $("tabs").classList.add("shut");
      const s = logOf()[r.id]?.stats, card = $("worldCard");
      card.innerHTML = `<img class="st" src="assets/icons/${s?.touched ? "st_prerun" : "st_notyet"}.png?v=1" alt=""><b>${r.name}</b><small>${EN_ON ? "" : `${r.zh} · `}${s?.touched ? t("滑过 {a}/{b} 条雪道 · {km} 公里", { a: s.touched, b: s.runs, km: s.km.toFixed(1) }) : t("还没去过")}</small>
        <div class="bar"><i style="width:${Math.round((s?.share || 0) * 100)}%"></i></div><button>${t(s?.touched ? "继续征服 ›" : "去这里 ›")}</button>`;
      card.querySelector("button").onclick = () => { st.resort = r.id; save(); flyTo(r.id); location.href = `mountain/?resort=${encodeURIComponent(r.id)}`; };
      card.hidden = false;
    };
    collection.onExplore = () => $("tabs").classList.add("shut"); // turning or zooming the map folds the tabs away
    const loop = (now) => { if (tab === "resort") { collection.frame(now / 1000); $("world").classList.toggle("focus", !!collection.picked); $("compass").style.transform = `rotate(${(collection.controls.getAzimuthalAngle() * 180 / Math.PI).toFixed(1)}deg)`; } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  collection.resize();
}
// Trips: plan where and when, with whom; share as a link.
let trips = null;
// Straight to a mountain, flying in from Denver.
function goResort(id) { st.resort = id; save(); flyTo(id); location.href = `mountain/?resort=${encodeURIComponent(id)}`; }
// One trip on the trips tab (from the opening).
async function openTrip(id) {
  await setTab("trip");
  const tr = trips.list.find((x) => x.id === id);
  if (tr?.shared) trips.open(id); else if (tr) trips.show(tr);
}
async function openTrips() {
  if (!trips) {
    const { Trips } = await import("./trips.js?v=50");
    const sprite = (() => { try { return localStorage.getItem("prerunSprite"); } catch { return null; } })();
    trips = new Trips($("trips"), await resortList(), { me: "我", sprite, go: goResort });
    const code = new URLSearchParams(location.search).get("trip");
    if (code) trips.incoming(code);
  }
  trips.render();
}
async function openRecords() {
  const list = await resortList();
  const { renderMemory } = await import("./memory.js?v=34");
  renderMemory($("memory"), { resorts: list, openBook: (id) => openBook(list.find((r) => r.id === id)) });
}
// The roadbook for one resort: the steps of each pre-run, its way on the map, and where you are now.
async function openBook(r) {
  const [{ Terrain, treeMaskFn }, { TrailMap }] = await Promise.all([import("../ride/world.js?v=5"), import("../ride/mapview.js?v=10")]);
  const R = await (await fetch(`data/${r.id}.json`)).json(), T = new Terrain(R);
  const tm = new TrailMap(T, R, treeMaskFn(R, T), R.places.filter((p) => p.kind === "village"));
  openBookPage(r.id, { name: r.name, map: tm, locate: locateIn(R.origin) });
}
render(); renderPoses();
show({ enter: true }).then(() => (rider_ready = true)).catch((e) => { $("status").textContent = t("人物没加载出来，刷新试试"); console.warn(e); });
// ?tab=resort or ?tab=log (from the game's menu); a rider already chosen starts on the map.
const askTab = new URLSearchParams(location.search).get("tab");
setTab(new URLSearchParams(location.search).has("trip") ? "trip" : ({ log: "log", resort: "resort", trip: "trip" })[askTab] || "rider");
// Settings (the language) from the avatar on the rider page.
$("setBtn").onclick = openSettings;
const face = () => ($("setBtn").querySelector("img").src = `assets/icons/${myAvatar()}.png?v=1`);
face(); addEventListener("prerun:avatar", () => { face(); trips?.render?.(); });
// A pre-run left half way (kept by the ride page): a pill under the title, the little crayon rider hopping;
// a tap goes straight back to where you left off.
(() => {
  let ses = null; try { ses = JSON.parse(localStorage.getItem("prerunSession") || "null"); } catch {}
  if (!ses || Date.now() - ses.t > 36 * 3600e3) return;
  const btn = $("resumeBtn"), name = ses.resort.replace(/(^|-)\w/g, (m) => m.toUpperCase()).replace(/-/g, " ");
  btn.hidden = false;
  btn.innerHTML = `<span class="hop"><span>${[0, 1, 2].map((i) => `<img class="f${i}" src="assets/icons/ride_crayon_${i}.png?v=2" alt="">`).join("")}</span></span><span>${t("继续")} · <b translate="no">${escape(name)}</b></span>`;
  btn.setAttribute("aria-label", `${t("继续")} · ${name} ${ses.where || ""}`);
  btn.onclick = () => { save(); location.href = `look.html?resort=${encodeURIComponent(ses.resort)}&lift=${encodeURIComponent(ses.lift)}&at=${ses.at}`; };
})();
translatePage();
