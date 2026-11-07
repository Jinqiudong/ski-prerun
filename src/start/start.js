// The first screen: your rider on a watercolour card, and the wardrobe under it: outfits (four suggestions and
// the ones you saved), the jacket, the pants, the gear, and the look (hair, body, or one of the resort animals
// on a board). Every change shows on the rider at once and is what you ride in; an outfit you like can be saved
// by name. All on this phone only.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RIDERS, OUTFITS } from "../rider/boarder.js?v=6";
import { ANIMAL_RIDERS, ANIMAL_ZH, animalOf } from "../rider/animal-core.js?v=1";
import { animalRider, animalStage, PET_MOVES } from "../rider/animal.js?v=2";
import { CFG, COLOR_MATS, HAIR, hairOf, setHair, POSES, TRICKS, BOARDS, SIGNATURE, makeCharacter, presetChar, partColors, setPartColor } from "../rider/character.js?v=12";
import { makeEntrance } from "./entrance.js?v=24";
import { openBookPage, paintWith, locateIn } from "../ride/roadbook.js?v=17";
import { t, EN_ON, translatePage, openSettings, myAvatar } from "../core/i18n.js?v=36";
import { playIntro } from "./intro.js?v=23";
import { flyTo } from "../core/transition.js?v=7";
import { startParty } from "../core/party.js?v=6";
// The opening (about your nearest trip, if there is one); its buttons open that trip, go straight to today's
// mountain, or the Memory wtab.
playIntro({ open: (id) => openTrip(id), go: (id) => goResort(id), memory: () => setTab("log") });

const $ = (id) => document.getElementById(id);
// A muted outdoor palette (stone, sage, slate, clay...): nothing loud, and any mix of them goes together. Eight a
// part; the round rainbow one after them opens the phone's own colour picker for anything else.
const SWATCHES = {
  jacket: ["#525a42", "#dcd7cc", "#2b2c30", "#2f3a4c", "#7b8a96", "#a8674f", "#c2b49a", "#6e5f6e"],
  pants: ["#c9bfac", "#dcd7cc", "#8f8670", "#4f5645", "#4a5a6e", "#2f3a4c", "#9c6a55", "#222326"],
  helmet: ["#2b2b2e", "#d9d6ce", "#8f8b82", "#4a5a6e", "#55604b", "#b8a98c", "#9a5f4a", "#f0eee8"],
  gloves: ["#e3dccb", "#3b3d40", "#222326", "#a8674f", "#4a5a6e", "#55604b", "#b6463b", "#c2b49a"],
  lens: ["#4d5ce0", "#ad5599", "#3a3c42", "#b8873e", "#b78473", "#7f9fb8", "#6f8f7a", "#9aa1a8"],
  boots: ["#1d1d20", "#3b3d40", "#8f8670", "#a39d8f", "#4a5a6e", "#9c6a55", "#dcd7cc", "#7f9fb8"],
  vest: ["#17171a", "#3b3d40", "#4f5645", "#2f3a4c", "#a8674f", "#c2b49a", "#dcd7cc", "#6e5f6e"],
  hair: ["#3f2a1f", "#1d1a18", "#6b4a2e", "#a07850", "#c9a66b"],
};
// The materials each colour sets: the game's six parts (character.js), the vest and the hair.
const MATS = { ...COLOR_MATS, vest: ["MAT_vest"], hair: ["MAT_hair"] };
const colorOf = (ch, part) => (ch.colors[MATS[part][0]] || "#888888").toLowerCase();
const paint = (ch, part, c) => { for (const m of MATS[part]) ch.colors[m] = c; };

// ---- Saved state ("prerun"): { wear: { ch, from, name, stance, dirty } (what I wear: a character, the outfit it
// started as, that outfit's name, regular or goofy, and whether it was changed since), riders: [{ id, base, name,
// colors, ch }] (my saved outfits), rider (wear.from again, for pages from before wear), resort }. A character
// riding as one of the resort animals says which in ch.animal (animal-core.js); the rest of it (template,
// colours, board) stays, so choosing a body again brings the person back as they were.
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
const petOf = (ch) => animalOf(ch.animal);
const wearName = () => { const r = outfitOf(wear.from); return r ? r.name : wear.name || t("我的穿搭"); };
// Something changed: shown at once, kept at once (there is no "wear this" step), and the outfit is now changed.
function changed({ body = false } = {}) {
  if (!wear.dirty) { wear.dirty = true; if (wtab === "outfits") render(); }
  if (body) render();
  save(); show();
}

// ---- The 3D preview: the rider on the snow, turning when dragged.
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
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 30 });
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0xdfe9ff, 1.3); rim.position.set(-3, 3, -6); scene.add(rim);
const entrance = makeEntrance(scene);
const turntable = new THREE.Group();
scene.add(turntable);
let rider = null, drag = null, spinTo = null;
function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight * 0.56;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();
// Drag to turn the rider round; a tap on a part of them (the jacket, the helmet...) opens that part below, and a
// tap beside them, on the outfits or the look, runs their entrance again.
canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, a: turntable.rotation.y }; spinTo = null; });
addEventListener("pointermove", (e) => { if (drag && !entrance.running) turntable.rotation.y = drag.a + (e.clientX - drag.x) / 120; });
addEventListener("pointerup", (e) => {
  if (!drag) return; const moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y); drag = null;
  if (moved > 8) return;
  $("morePoses").hidden = true;
  const hit = partAt(e);
  if (hit) open(...hit); else if (focus === "full") enter();
});
// Which wardrobe item a point on the rider is, by the material under it.
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const PART_OF = [[/^MAT_(jacket|vest|zip|seam|cord)/, ["top"]], [/^MAT_pants/, ["pants"]], [/^MAT_(helmet|sticker)/, ["gear", "helmet"]], [/^MAT_mitten/, ["gear", "gloves"]],
  [/^MAT_(goggle|lens|face_mask)/, ["gear", "lens"]], [/^MAT_boot/, ["gear", "boots"]], [/^MAT_(board|binding)/, ["gear", "board"]], [/^MAT_hair/, ["look"]]];
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
  const m = [].concat(hit.object.material)[hit.face?.materialIndex || 0] || [].concat(hit.object.material)[0];
  return PART_OF.find(([re]) => re.test(m?.name || ""))?.[1] || null;
}
const ROUTE_OF = Object.fromEntries(Object.entries(SIGNATURE).map(([k, c]) => [c, k]));
// The rider's entrance: their favourite move's route (a carve's, a spin's, an S, a kicker), else the carve.
// An animal just does its favourite move (or a hop) once, on the spot.
function enter() {
  if (!rider) return;
  pose = "Stand_Idle"; renderPoses();
  if (rider.isAnimal) { center(); rider.play(PET_MOVES.some(([k]) => k === wear.ch.fav) ? wear.ch.fav : "Anim_Ollie", { once: true }); return; }
  entrance.start(ROUTE_OF[wear.ch.fav] || "A", rider, turntable);
}
// Back on the spot, facing you (for a close look at a part, or a pose).
function center() {
  entrance.stop(); turntable.position.set(0, 0, 0);
  turntable.rotation.y = Math.atan2(Math.sin(turntable.rotation.y), Math.cos(turntable.rotation.y)); spinTo = 0;
}
// The camera: the whole rider, or close on the part being changed (the upper body for the jacket, the legs for
// the pants, the head for the helmet and goggles...). [bone(s) to look at, distance, how far above, look lower by]
const REST = { pos: new THREE.Vector3(0, 1.3, 5.6), at: new THREE.Vector3(0, 0.88, 0) };
const view = { pos: REST.pos.clone(), at: REST.at.clone() }, look = REST.at.clone();
const SHOTS = { upper: [["Chest"], 3.6, 0.12, 0.08], legs: [["ShinL", "ShinR"], 3.9, 0.15, 0.05], head: [["Head"], 2, 0.08, 0.04],
  hands: [["HandL", "HandR"], 3, 0.15, 0.06], feet: [["FootL", "FootR"], 2.7, 0.35, -0.02], board: [["FootL", "FootR"], 5.4, 0.55, -0.45] };
const FOCUS = { top: "upper", pants: "legs", gloves: "hands", lens: "head", helmet: "head", boots: "feet", board: "board" };
let focus = "full";
const v3 = new THREE.Vector3();
function aim() {
  const s = SHOTS[focus];
  // an animal: nearer and lower, the whole board in the picture
  if (rider?.isAnimal) { const h = rider.tall; view.at.set(0, h * 0.42, 0); view.pos.set(0, h * 0.42 + 0.7 + h * 0.2, 3.4 + h * 0.9); return; }
  if (!s || !rider) { view.pos.copy(REST.pos); view.at.copy(REST.at); return; }
  const [bones, d, up, low] = s;
  view.at.set(0, 0, 0); for (const b of bones) view.at.add(rider.bones[b].getWorldPosition(v3)); view.at.divideScalar(bones.length);
  view.at.x *= 0.5; view.at.z *= 0.5; view.at.y -= low; // keep near the middle, a little below the part (the pose buttons sit at the bottom)
  view.pos.set(view.at.x, view.at.y + d * up, view.at.z + d);
}
window.__stage = { scene, camera, turntable, entrance, get rider() { return rider; }, get focus() { return focus; } }; // testing
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (rider) { rider.step(dt); entrance.step(dt); }
  if (spinTo !== null) { turntable.rotation.y += (spinTo - turntable.rotation.y) * (1 - Math.exp(-dt * 6)); if (Math.abs(turntable.rotation.y - spinTo) < 1e-3) spinTo = null; }
  // the sun and its shadow camera ride along with the rider
  const at = turntable.position; sun.position.set(at.x + 3, at.y + 6, at.z + 4); sun.target.position.copy(at);
  // the camera: the entrance's shots while it runs, else easing to the rider (or the part being changed)
  if (!entrance.shoot(camera, dt, REST)) { aim(); const k = 1 - Math.exp(-dt * 4); camera.position.lerp(view.pos, k); look.lerp(view.at, k); camera.lookAt(look); }
  renderer.render(scene, camera);
});

// Dress the rider in what I wear. { enter }: and run their entrance (a new outfit).
const chars = {};
const holder = new THREE.Group(); turntable.add(holder);
// An animal (animal.js) is made when picked and let go when another is (its file goes with it).
let pet = null; // { animal, made: a promise of its stage figure }
const dropPet = () => { const p = pet; pet = null; p?.made.then((s) => { if (rider === s) { holder.remove(s.root); rider = null; } s.dispose(); }); };
async function show({ enter: go = false } = {}) {
  const ch = wear.ch, a = petOf(ch), key = a || ch.tpl;
  if (pet && pet.animal !== a) dropPet();
  if (a && !pet) pet = { animal: a, made: animalRider({ animal: a }).then(animalStage) };
  const c = await (a ? pet.made : (chars[ch.tpl] ||= makeCharacter(ch.tpl)));
  if (ch !== wear.ch || key !== (petOf(wear.ch) || wear.ch.tpl)) return; // something else was put on meanwhile
  const swapped = rider !== c;
  if (swapped) { if (rider) holder.remove(rider.root); rider = c; holder.add(c.root); if (a) center(); }
  if (a) c.setBoard(ch.board); else c.set(ch);
  // regular or goofy: the character is mirrored (the entrance rides goofy's line mirrored, entrance.js)
  holder.scale.x = wear.stance === "goofy" ? -1 : 1;
  holder.position.y = a ? 0.004 : 0.062 * ch.height / CFG.templates[ch.tpl].height; // the template's snow is a little below its origin
  if (go && focus === "full") enter();
  else if (swapped || !c.current) { if (entrance.running) center(); c.play(pose, { fade: 0 }); }
  $("status").hidden = true;
  $("who").innerHTML = `${escape(wearName())}${wear.dirty ? `<small>${t("改过")}</small>` : ""}`;
}
const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---- Poses: a row of them on the card, the rest (and the tricks) behind "…".
const PILLS = ["Stand_Idle", "Board_Hold", "Pose_Wave", "Pose_Cheer"];
const LABEL = Object.fromEntries([...POSES, ...TRICKS, ...PET_MOVES.map(([k, l]) => [k, l])]);
let pose = "Stand_Idle";
// An animal only stands (its walk, slowly) and does its few moves (animal.js).
const movesOf = () => (petOf(wear.ch) ? { pills: ["Stand_Idle"], poses: [], tricks: PET_MOVES } : { pills: PILLS, poses: POSES, tricks: TRICKS });
function playPose(k) {
  if (!rider) return;
  if (pose === k && movesOf().tricks.some(([n]) => n === k)) { wear.ch.fav = wear.ch.fav === k ? null : k; save(); } // a playing trick tapped again: your favourite
  else { if (entrance.running) center(); pose = k; rider.play(k); }
  renderPoses();
}
function renderPoses() {
  const { pills, poses, tricks } = movesOf(), more = !pills.includes(pose);
  $("poses").innerHTML = pills.map((k) => `<button class="${k === pose ? "on" : ""}" data-pose="${k}">${t(LABEL[k])}</button>`).join("")
    + `<button class="${more ? "on" : ""}" data-pose="more" aria-label="${t("更多动作")}">…</button>`;
  $("morePoses").innerHTML = (poses.length ? `<div class="chips">${poses.filter(([k]) => !pills.includes(k)).map(([k, l]) => `<button class="${k === pose ? "on" : ""}" data-pose="${k}">${t(l)}</button>`).join("")}</div>` : "")
    + `<div class="chips">${tricks.map(([k, l]) => `<button class="${k === pose ? "on" : ""}" data-pose="${k}">${wear.ch.fav === k ? "<i>★</i>" : ""}${t(l)}</button>`).join("")}</div>
    <p>${t("再点一次正在做的 trick，设成最爱（出场时会做）")}</p>`;
}
for (const id of ["poses", "morePoses"]) $(id).addEventListener("click", (e) => {
  const b = e.target.closest("[data-pose]"); if (!b) return;
  if (b.dataset.pose === "more") { $("morePoses").hidden = !$("morePoses").hidden; return; }
  playPose(b.dataset.pose);
});

// ---- The wardrobe: a row of icons, and what the chosen one changes below it.
const ICON = (n) => `assets/icons/${n}.png?v=1`;
const NAV = [["outfits", "hanger", "穿搭"], ["top", "jacket", "上衣"], ["pants", "pants", "裤子"], ["gear", "helmet", "装备"], null, ["look", "look_mirror", "外形"]];
const GEAR = [["gloves", "gloves", "手套"], ["lens", "lens", "雪镜"], ["helmet", "helmet", "头盔"], ["boots", "boots", "雪鞋"], ["board", "board", "雪板"]];
let wtab = "outfits", gear = "helmet", naming = false, more = false;
// Open a wardrobe item (and a gear's own sub-item): the camera goes close on that part, or back out.
// An animal wears nothing: its camera stays put, and of the gear only the board is left.
function open(k, sub) {
  wtab = k; if (sub) gear = sub; naming = false;
  focus = petOf(wear.ch) ? "full" : (k === "gear" ? FOCUS[gear] : FOCUS[k]) || "full";
  if (focus !== "full") { const was = entrance.running; center(); if (was && rider) { pose = "Stand_Idle"; rider.play(pose); renderPoses(); } }
  $("who").hidden = focus !== "full";
  render();
}
const nav = ([k, ic, l], cur, off = false) => `<button class="${k === cur ? "on" : ""}${off ? " off" : ""}" data-k="${k}"><img src="${ICON(ic)}" alt="">${t(l)}</button>`;
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
// One row of swatches for a part; the colour worn now leads it when it isn't one of them; the last opens a picker.
function swatches(part) {
  const cur = colorOf(wear.ch, part), list = SWATCHES[part].some((c) => same(c, cur)) ? SWATCHES[part] : [cur, ...SWATCHES[part]];
  return `<div class="swrow" data-paint="${part}">${list.map((c) => `<button class="sw${same(c, cur) ? " on" : ""}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join("")}`
    + `<label class="sw more" aria-label="${t("更多颜色")}"><input type="color" value="${cur}"></label></div>`;
}
// A part on or off, as a little picture of it (tools/render_thumbs.mjs).
const tile = (k, l) => `<button class="tile${wear.ch.parts[k] ? " on" : ""}" data-part="${k}"><i style="background-image:url(assets/riders/thumbs/${k}_${wear.ch.tpl.toLowerCase()}.png?v=1)"></i>${t(l)}</button>`;
// An outfit's colours as dots; an animal's, its picture (tools/render_animal_thumbs.mjs).
const petPic = (a) => `assets/riders/thumbs/animal_${a}.png?v=1`;
const dots = (ch) => petOf(ch) ? `<span class="dots pet"><i style="background-image:url(${petPic(ch.animal)})"></i></span>` : `<span class="dots">${["jacket", "pants", "helmet", "lens", "boots"].map((p) => `<i style="background:${colorOf(ch, p)}"></i>`).join("")}</span>`;
const fmts = {};
const slider = (key, label, lo, hi, step, fmt) => (fmts[key] = fmt, `<label class="sl"><span>${t(label)}<b data-v="${key}">${fmt(wear.ch[key])}</b></span><input type="range" data-k="${key}" min="${lo}" max="${hi}" step="${step}" value="${wear.ch[key]}"></label>`);
const word = (lo, hi, a, b, c) => (v) => t(v < lo + (hi - lo) / 3 ? a : v > hi - (hi - lo) / 3 ? c : b);
function render() {
  const ch = wear.ch, a = petOf(ch), gk = a ? "board" : gear;
  $("wnav").innerHTML = NAV.map((n) => (n ? nav(n, wtab, a && (n[0] === "top" || n[0] === "pants")) : `<i class="vr"></i>`)).join("");
  $("wsub").innerHTML = wtab === "gear" ? GEAR.filter((n) => !a || n[0] === "board").map((n) => nav(n, gk)).join("") : "";
  $("wsub").hidden = wtab !== "gear";
  let h = "";
  const noClothes = `<p class="pethint">${t("小动物不穿衣服，换块雪板吧")}<button class="chip" data-toboard>${t("雪板")} ›</button></p>`;
  if (wtab === "outfits") {
    const card = (r) => `<button class="combo${wear.from === r.id && !wear.dirty ? " on" : ""}" data-outfit="${r.id}">${dots(charOf(r))}<span translate="no">${escape(r.name)}</span>${r.isDefault ? "" : `<i class="del" data-del="${r.id}" aria-label="${t("删除")}">×</i>`}</button>`;
    h = naming
      ? `<form class="naming"><input id="name" maxlength="16" placeholder="${t("比如：周末粉雪")}" value="${escape(outfitOf(wear.from)?.isDefault ? "" : wearName())}"><button type="button" data-cancel>${t("取消")}</button><button class="go">${t("保存")}</button></form>`
      : `<div class="swrow cards">${wear.dirty ? `<button class="combo keep" data-keep>${dots(ch)}<span>${t("存成我的")}</span></button>` : ""}`
        + `<button class="combo rnd" data-shuffle aria-label="${t("随机")}"><img src="${ICON("shuffle")}" alt=""><span>${t("随机")}</span></button>`
        + Object.keys(OUTFITS).map((k) => card(template(k))).join("") + st.riders.map(card).join("") + `</div>`;
  }
  if (a && (wtab === "top" || wtab === "pants")) h = noClothes;
  else if (wtab === "top") h = swatches("jacket") + `<div class="tiles">${tile("hood", "帽兜")}${tile("vest", "马甲")}${tile("grid", "格纹")}</div>`
    + (ch.parts.vest ? `<div class="lrow"><span>${t("马甲颜色")}</span>${swatches("vest")}</div>` : "");
  else if (wtab === "pants") h = swatches("pants");
  if (wtab === "gear") {
    if (gk === "helmet") h = swatches("helmet") + `<div class="tiles">${tile("visor", "帽檐")}${tile("stickers", "贴纸")}<button class="chip${ch.glossyHelmet ? " on" : ""}" data-gloss>${t("亮面")}</button></div>`;
    else if (gk === "board") h = (a ? `<p class="pethint">${t("小动物不穿衣服，换块雪板吧")}</p>` : "") + `<div class="boardrow"><div class="boards">${BOARDS.map((k) => `<button class="${ch.board === k ? "on" : ""}" data-board="${k}"><img src="assets/riders/boards/${k}_base.jpg?v=1" alt=""></button>`).join("")}</div>`
      + `<div class="stance">${["regular", "goofy"].map((s) => `<button class="chip${wear.stance === s ? " on" : ""}" data-stance="${s}">${s === "regular" ? "Regular" : "Goofy"}</button>`).join("")}<small>${t(wear.stance === "goofy" ? "右脚在前" : "左脚在前")}</small></div></div>`;
    else h = swatches(gear);
  }
  if (wtab === "look") {
    const T = CFG.templates[ch.tpl], S = Object.fromEntries(CFG.sliders.map((x) => [x.key, x]));
    // the animals: a row of their pictures; one picked hides the person's sliders (a body chip brings them back)
    const pets = `<div class="lrow pets"><span>${t("小动物")}</span><div class="swrow">${ANIMAL_RIDERS.map((k) => `<button class="tile${a === k ? " on" : ""}" data-animal="${k}"><i style="background-image:url(${petPic(k)})"></i>${t(ANIMAL_ZH[k])}</button>`).join("")}</div></div>`;
    const body = `<div class="lrow"><span>${t("身材")}</span><div class="swrow">${["F", "M"].map((k, i) => `<button class="chip${!a && ch.tpl === k ? " on" : ""}" data-tpl="${k}">${t("体形 {n}", { n: i + 1 })}</button>`).join("")}</div></div>`;
    if (a) h = body + pets;
    else h = (ch.tpl === "F" ? `<div class="lrow"><span>${t("发型")}</span><div class="swrow">${HAIR.map(([k, l]) => `<button class="chip${hairOf(ch) === k ? " on" : ""}" data-hair="${k}">${k === "none" ? (EN_ON ? t("不要头发") : "不要") : t(l)}</button>`).join("")}<i class="gap"></i>`
        + SWATCHES.hair.map((c) => `<button class="sw${same(c, colorOf(ch, "hair")) ? " on" : ""}" data-c="${c}" data-for="hair" style="background:${c}"></button>`).join("") + `</div></div>` : "")
      + body + pets
      + slider("height", "身高", T.hmin, T.hmax, 1, (v) => `${v} cm`)
      + `<button class="morebtn" data-more>${t(more ? "收起 ⌃" : "更多 ⌄")}</button>`
      + (more ? `<div class="sl2">` + slider("weight", "体重", S.weight.lo, S.weight.hi, 1, word(S.weight.lo, S.weight.hi, "偏瘦", "适中", "偏壮"))
        + slider("muscle", "肌肉", S.muscle.lo, S.muscle.hi, 1, word(S.muscle.lo, S.muscle.hi, "柔和", "普通", "结实"))
        + slider("jease", "外套宽松", S.jease.lo, S.jease.hi, 1, word(S.jease.lo, S.jease.hi, "合身", "适中", "宽松"))
        + slider("jlen", "外套长度", S.jlen.lo, S.jlen.hi, 0.5, word(S.jlen.lo, S.jlen.hi, "短", "适中", "长"))
        + slider("pease", "裤子宽松", S.pease.lo, S.pease.hi, 1, word(S.pease.lo, S.pease.hi, "合身", "适中", "宽松")) + `</div>` : "");
  }
  $("wbody").innerHTML = h; $("wbody").dataset.tab = wtab;
  $("wbody").querySelector(".combo.on, .pets .tile.on")?.scrollIntoView({ block: "nearest", inline: "nearest" }); // the outfit (or animal) worn, in sight
  if (naming) { $("name").focus(); $("name").select(); } // keep the name to update that outfit, or type a new one
}
for (const id of ["wnav", "wsub"]) $(id).addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (!b) return; id === "wnav" ? open(b.dataset.k) : open("gear", b.dataset.k); });
// Wear an outfit: a new copy of it (your stance stays yours), and its entrance.
function wearOutfit(r) {
  const was = petOf(wear.ch);
  Object.assign(wear, { ch: deep(charOf(r)), from: r.id, name: r.name, dirty: false });
  if (was !== petOf(wear.ch)) { if (wtab !== "outfits") open(wtab); pose = "Stand_Idle"; renderPoses(); }
  save(); render(); show({ enter: true });
}
// To or from an animal: the poses change, and so does what the wardrobe offers.
function becomePet(k) {
  if (k) wear.ch.animal = k; else delete wear.ch.animal;
  pose = "Stand_Idle"; renderPoses(); $("morePoses").hidden = true;
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
  if ("shuffle" in d) { // a colour from each part's list
    for (const p of ["jacket", "pants", "helmet", "gloves", "lens", "boots"]) paint(ch, p, SWATCHES[p][Math.floor(Math.random() * SWATCHES[p].length)]);
    wear.dirty = true; render(); return changed();
  }
  if (d.c) { // a swatch: its row says which part (the hair's dots say it themselves)
    const part = d.for || el.closest("[data-paint]").dataset.paint; paint(ch, part, d.c);
    for (const s of el.parentElement.querySelectorAll(".sw[data-c]")) s.classList.toggle("on", s === el);
    return changed();
  }
  if (d.part) { ch.parts[d.part] = !ch.parts[d.part]; return changed({ body: true }); }
  if ("gloss" in d) { ch.glossyHelmet = !ch.glossyHelmet; return changed({ body: true }); }
  if (d.board) { ch.board = d.board; return changed({ body: true }); }
  if (d.stance) { wear.stance = d.stance; save(); render(); return show(); }
  if (d.hair) { setHair(ch, d.hair); return changed({ body: true }); }
  if (d.tpl && petOf(ch)) { // back to a person: the body tapped, in the clothes they had
    if (d.tpl !== ch.tpl) { const pre = presetChar(Object.keys(CFG.presets).find((k) => CFG.presets[k].tpl === d.tpl)); Object.assign(ch, { tpl: pre.tpl, height: pre.height }); setHair(ch, hairOf(pre)); }
    return becomePet(null);
  }
  if (d.tpl && d.tpl !== ch.tpl) { // the other template: its preset's height and hair, the same colours, parts and fit
    const pre = presetChar(Object.keys(CFG.presets).find((k) => CFG.presets[k].tpl === d.tpl));
    Object.assign(ch, { tpl: pre.tpl, height: pre.height }); setHair(ch, hairOf(pre));
    return changed({ body: true });
  }
  if ("more" in d) { more = !more; render(); }
});
// The phone's colour picker: live while it's open, and the row is redrawn (the new colour first) when it closes.
$("wbody").addEventListener("input", (e) => {
  const i = e.target;
  if (i.type === "color") { paint(wear.ch, i.closest("[data-paint]").dataset.paint, i.value); for (const s of i.closest(".swrow").querySelectorAll(".sw")) s.classList.remove("on"); return changed(); }
  if (i.type === "range") { const k = i.dataset.k; wear.ch[k] = +i.value; $("wbody").querySelector(`[data-v="${k}"]`).textContent = fmts[k](wear.ch[k]); changed(); }
});
$("wbody").addEventListener("change", (e) => { if (e.target.type === "color") render(); });
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

// ---- Tabs: the rider, the resorts (a map of them to conquer), the journal.
let collection = null, tab = "rider";
const party = startParty({ page: "home", sub: "rider" }); // the party pet (src/core/party.js), on every tab
const logOf = () => { try { return JSON.parse(localStorage.getItem("prerunLog") || "{}"); } catch { return {}; } };
async function setTab(t) {
  tab = t; $("tabs").classList.remove("shut"); party.setSub(t);
  for (const b of $("tabs").children) b.classList.toggle("on", b.dataset.tab === t);
  const rider = t === "rider";
  for (const id of ["stage", "sheet"]) $(id).hidden = !rider;
  $("status").hidden = !rider || !!rider_ready;
  $("world").hidden = t !== "resort"; $("records").hidden = t !== "log"; $("trips").hidden = t !== "trip";
  if (t === "trip") await openTrips();
  if (t === "resort") await openWorld();
  if (t === "log") await openRecords();
}
let rider_ready = false;
// The tabs fold into one round button while you look around — scrolling a page down, turning the rider,
// exploring the map — and a tap on it opens them again; scrolling back to the top opens them too.
const fold = () => $("tabs").classList.add("shut");
for (const id of ["sheet", "trips", "records"]) {
  let last = 0; const el = $(id);
  el.addEventListener("scroll", () => { const y = el.scrollTop; if (y > last + 6 && y > 40) fold(); else if (y < 8) $("tabs").classList.remove("shut"); last = y; }, { passive: true });
}
canvas.addEventListener("pointerdown", fold);
for (const b of $("tabs").children) b.onclick = () => { if ($("tabs").classList.contains("shut")) { $("tabs").classList.remove("shut"); return; } setTab(b.dataset.tab); }; // folded: a tap opens it
$("useBtn").onclick = () => { save(); setTab("resort"); };
const resortList = async () => (await (await fetch("data/resorts.json")).json()).filter((r) => r.ready);
async function openWorld() {
  const cv = $("world").querySelector("canvas");
  if (!collection) {
    const { Collection } = await import("./collection.js?v=51");
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
    const { Trips } = await import("./trips.js?v=36");
    const sprite = (() => { try { return localStorage.getItem("prerunSprite"); } catch { return null; } })();
    trips = new Trips($("trips"), await resortList(), { me: "我", sprite, go: goResort });
    const code = new URLSearchParams(location.search).get("trip");
    if (code) trips.incoming(code);
  }
  trips.render();
}
async function openRecords() {
  const list = await resortList();
  const { renderMemory } = await import("./memory.js?v=21");
  renderMemory($("memory"), { resorts: list, openBook: (id) => openBook(list.find((r) => r.id === id)) });
}
// The roadbook for one resort: the steps of each pre-run, its way on the map, and where you are now.
async function openBook(r) {
  const [{ Terrain, treeMaskFn }, { TrailMap }] = await Promise.all([import("../ride/world.js?v=5"), import("../ride/mapview.js?v=8")]);
  const R = await (await fetch(`data/${r.id}.json`)).json(), T = new Terrain(R);
  const tm = new TrailMap(T, R, treeMaskFn(R, T), R.places.filter((p) => p.kind === "village"));
  openBookPage(r.id, { name: r.name, drawMap: paintWith(tm), locate: locateIn(R.origin) });
}
render(); renderPoses();
show({ enter: true }).then(() => (rider_ready = true)).catch((e) => { $("status").textContent = t("人物没加载出来，刷新试试"); console.warn(e); });
// ?tab=resort or ?tab=log (from the game's menu); a rider already chosen starts on the map.
const askTab = new URLSearchParams(location.search).get("tab");
setTab(new URLSearchParams(location.search).has("trip") ? "trip" : ({ log: "log", resort: "resort", trip: "trip" })[askTab] || "rider");
// Settings (the language) from the gear on the rider page.
$("setBtn").onclick = openSettings;
const face = () => ($("setBtn").querySelector("img").src = `assets/icons/${myAvatar()}.png?v=1`);
face(); addEventListener("prerun:avatar", () => { face(); trips?.render?.(); });
// A pre-run left half way (kept by the ride page): the go button becomes the little crayon rider hopping,
// and a tap goes straight back to where you left off.
(() => {
  let ses = null; try { ses = JSON.parse(localStorage.getItem("prerunSession") || "null"); } catch {}
  if (!ses || Date.now() - ses.t > 36 * 3600e3) return;
  const btn = $("useBtn"), name = ses.resort.replace(/(^|-)\w/g, (m) => m.toUpperCase()).replace(/-/g, " ");
  btn.classList.add("resume");
  btn.innerHTML = `<span class="hop"><span>${[0, 1, 2].map((i) => `<img class="f${i}" src="assets/icons/ride_crayon_${i}.png?v=2" alt="">`).join("")}</span></span>`;
  btn.setAttribute("aria-label", `${t("继续")} · ${name} ${ses.where || ""}`);
  btn.onclick = () => { save(); location.href = `look.html?resort=${encodeURIComponent(ses.resort)}&lift=${encodeURIComponent(ses.lift)}&at=${ses.at}`; };
})();
translatePage();
