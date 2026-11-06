// The facility kit (models/facilities, built in Blender) in the ride: which model each real lift gets,
// loading the GLBs lazily and sharing their geometry and materials, instanced pools with a near and a far
// level of detail, and the pieces the ride places: towers, terminals, carriers, buildings, signs, props.
//
// Per-lift facts come from data/facilities/<resort>.json (the research: docs/research/facilities.md) when
// it has the lift, else from the OpenStreetMap tags baked into data/<resort>.json (kind, seats, bubble,
// detachable). The research keys lifts by OSM way id: { type: detach_chair | fixed_chair | gondola |
// cabriolet | chondola | platter | tbar | rope_tow | magic_carpet, seats, bubble, color: { chair, cabin,
// bubble, terminal, tower … } }, and lists buildings with local x/z, footprint and the kit model that fits.
// Nothing is invented: a lift missing from both keeps the plain charcoal kit.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const VER = 9;
const BASE = "models/facilities/glb/"; // relative to look.html
export const CHARCOAL = "#3b4048";
const CARRIERS = ["chair2", "chair3", "chair4_fixed", "chair4", "chair6", "chair6_bubble", "chair8_bubble", "gondola6", "gondola", "gondola10", "cabriolet", "tbar", "platter"];
const BUILDINGS = ["restaurant", "firstaid", "base_lodge", "warming_hut", "yurt", "restroom", "ticket_office"];

// ---------- What each real lift is ----------
export async function loadResearch(resort) {
  try {
    const r = await fetch(`data/facilities/${resort}.json`);
    if (!r.ok) return null;
    const j = await r.json();
    const lifts = new Map();
    for (const [k, v] of Array.isArray(j.lifts) ? j.lifts.map((l) => [l.id ?? l.name, l]) : Object.entries(j.lifts || {})) {
      if (k != null) lifts.set(String(k), v);
      if (v?.name) lifts.set(v.name.toLowerCase(), v);
    }
    return { lifts, buildings: Array.isArray(j.buildings) ? j.buildings : [] };
  } catch { return null; }
}

// The models for a lift: carrier, terminals, gauge, paint. `known` is a checked override (seats, bubble).
export function liftSpec(lift, research, known) {
  const r = research?.lifts.get(String(lift.id)) || research?.lifts.get(lift.name.toLowerCase()) || {};
  const seats = r.seats ?? known?.seats ?? lift.seats ?? 4;
  const bubble = !!(r.bubble ?? (known ? known.bubble : lift.bubble));
  const typed = [r.model, r.carrier, r.type].find((t) => CARRIERS.includes(t));
  const type = r.type; // the research's lift type
  const cabin = typed ? /^gondola|cabriolet/.test(typed) : type ? type === "gondola" || type === "cabriolet" : lift.kind === "gondola" || lift.kind === "cable_car";
  const surface = type ? ["platter", "tbar", "rope_tow", "j-bar"].includes(type) : ["t-bar", "j-bar", "platter", "drag_lift", "rope_tow"].includes(lift.kind);
  const detachable = !!(type ? type === "detach_chair" || cabin || type === "chondola" : r.detachable ?? lift.detachable ?? (cabin || seats >= 6 || bubble || /express/i.test(lift.name)));
  let carrier = typed;
  if (!carrier) {
    if (cabin) carrier = type === "cabriolet" || /cabriolet/i.test(lift.name) ? "cabriolet" : seats >= 10 ? "gondola10" : seats <= 6 ? "gondola6" : "gondola";
    else if (surface) carrier = (type || lift.kind) === "platter" ? "platter" : ["tbar", "t-bar", "j-bar"].includes(type || lift.kind) ? "tbar" : null;
    else if (seats >= 7) carrier = "chair8_bubble";
    else if (seats >= 5) carrier = bubble ? "chair6_bubble" : "chair6";
    else if (seats === 4) carrier = detachable ? "chair4" : "chair4_fixed";
    else carrier = seats === 3 ? "chair3" : "chair2";
  }
  const isCabin = /^gondola|cabriolet/.test(carrier || "");
  const term = isCabin ? ["gondola_station", "gondola_station"] : detachable ? ["terminal_detach", "terminal_detach_top"] : ["terminal_fixed", "terminal_fixed"];
  return {
    carrier, cabin: isCabin, surface, seats, detachable,
    bubble: /bubble/.test(carrier || ""), bottom: term[0], top: term[1],
    gauge: TERMINAL[term[0]].gauge, ...colours(r, known), researched: !!r.type, chondola: type === "chondola" || lift.kind === "mixed_lift" && !!r.cabin_model, note: r.type === "chondola" ? "chondola: drawn as its chairs" : null,
  };
}

// Paint per part: the chairs, the terminal hood, the towers (else the hood's colour), the bubble.
function colours(r, known) {
  const c = typeof r.color === "string" ? { chair: r.color } : r.color || r.colour || {};
  const chair = c.chair || CHARCOAL, terminal = c.terminal || CHARCOAL; // cabins keep the kit's graphite
  return { color: chair, terminalColor: terminal, towerColor: c.tower || terminal, bubbleColor: c.bubble || known?.bubbleColor || null };
}

// Terminals in the game's frame (+z the way up, +x the up rope's side). `bull`: the local z of the
// bullwheel (the line's end); `box`: the deck's footprint; `top`: the top's placement turned round
// (`flip`) and mirrored (`mirror`) so the unload ramp is under the up rope; `stand`: where a rider gets
// off; `unload`: metres before the line's end where the chair stops.
export const TERMINAL = {
  terminal_detach: { gauge: 3.0, ropeH: 4.45, bull: -10, box: [-6.5, 13.6, -15, 12] },
  terminal_detach_top: { gauge: 3.0, ropeH: 5.35, bull: 10, box: [-6, 13, -15, 14.4], stand: [9.5, 0.75, -5.5], unload: 12 },
  terminal_fixed: { gauge: 2.3, ropeH: 4.0, bull: 0, box: [-3.7, 12.3, -4.6, 7.4], top: { flip: true, mirror: true }, stand: [7, 0.2, 1.5], unload: 4 },
  gondola_station: { gauge: 3.0, ropeH: 4.25, bull: -7, box: [-10, 10, -16.6, 14.6], top: { flip: true }, stand: [11, 0.6, 3], unload: 9 },
};
// Where a terminal stands: its origin, yaw and mirror, for the line's end p heading dir (the way up).
export function terminalPlace(name, atTop, p, dir) {
  const t = TERMINAL[name], f = (atTop && t.top) || {}, flip = f.flip ? -1 : 1;
  const origin = p.clone().addScaledVector(dir, -flip * t.bull);
  return { origin, yaw: Math.atan2(dir.x, dir.z) + (f.flip ? Math.PI : 0), mirror: f.mirror ? -1 : 1 };
}
export function localToWorld(pl, x, y, z, out = new THREE.Vector3()) {
  const c = Math.cos(pl.yaw), s = Math.sin(pl.yaw), lx = x * pl.mirror;
  return out.set(pl.origin.x + lx * c + z * s, pl.origin.y + y, pl.origin.z - lx * s + z * c);
}
// The highest ground under a terminal's deck (a little in from its edges), so no slope pokes through.
export function deckLevel(T, name, pl) {
  const [x0, x1, z0, z1] = TERMINAL[name].box, v = new THREE.Vector3();
  let hi = -Infinity, lo = Infinity, sum = 0, n = 0;
  for (let x = x0 + 2; x <= x1 - 2; x += 3) for (let z = z0 + 2; z <= z1 - 2; z += 3) {
    localToWorld(pl, x, 0, z, v); const h = T.heightAt(v.x, v.z); hi = Math.max(hi, h); lo = Math.min(lo, h); sum += h; n++;
  }
  return { hi, lo, mean: sum / n };
}
// Grade a level pad for a terminal into the terrain's heights (before the ground is built): flat under
// the deck and a little round it, blending back into the slope over `blend` metres.
export function gradePad(T, name, pl, level, margin = 16, blend = 32) {
  const [x0, x1, z0, z1] = TERMINAL[name].box, c = Math.cos(pl.yaw), s = Math.sin(pl.yaw);
  const cz = (T.z1 - T.z0) / (T.gh - 1), reach = Math.hypot(x1 - x0, z1 - z0) / 2 + Math.max(Math.abs(x0), Math.abs(x1), Math.abs(z0), Math.abs(z1)) + margin + blend;
  const c0 = Math.max(0, Math.floor((pl.origin.x - reach - T.x0) / T.cell)), c1 = Math.min(T.gw - 1, Math.ceil((pl.origin.x + reach - T.x0) / T.cell));
  const r0 = Math.max(0, Math.floor((pl.origin.z - reach - T.z0) / cz)), r1 = Math.min(T.gh - 1, Math.ceil((pl.origin.z + reach - T.z0) / cz));
  for (let r = r0; r <= r1; r++) for (let j = c0; j <= c1; j++) {
    const dx = T.x0 + j * T.cell - pl.origin.x, dz = T.z0 + r * cz - pl.origin.z;
    const lx = (dx * c - dz * s) * pl.mirror, lz = dx * s + dz * c; // into the terminal's frame
    const ox = Math.max(x0 - lx, 0, lx - x1), oz = Math.max(z0 - lz, 0, lz - z1), d = Math.hypot(ox, oz);
    const t = Math.min(1, Math.max(0, (d - margin) / blend)), w = 1 - t * t * (3 - 2 * t);
    if (w > 0) { const k = r * T.gw + j; T.h[k] += (level - T.h[k]) * w; }
  }
}

// Where a rider sits in each carrier (the game's frame: grip at the origin, +z the way up).
const DETACH_L = { chair4: 2.5, chair6: 2.7, chair6_bubble: 2.95, chair8_bubble: 3.1 };
const CABIN = { gondola: [1.7, 2.1], gondola6: [1.5, 2.0], gondola10: [1.95, 2.2] };
export function seatOf(name) {
  if (DETACH_L[name]) {
    const n = +name.match(/\d/)[0], L = DETACH_L[name], sw = 0.62;
    return { xs: Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * sw), top: -L + 0.09, z: 0.13, pivot: [-L + 0.74, -0.36] };
  }
  if (/^chair/.test(name)) { const n = +name.match(/\d/)[0], sw = 0.56; return { xs: Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * sw), top: -2.2 + 0.045, z: 0.08 }; }
  if (CABIN[name]) { const [d, h] = CABIN[name]; return { xs: [-0.45, 0.45], top: -1.15 - h + 0.65, z: -(d / 2 - 0.36), cabin: true, glassY: -1.15 - h + 0.95 + 0.5 }; }
  return { xs: [-0.35, 0.35], top: -3.55 + 0.65, z: 0.25, cabin: true, open: true, glassY: -2.4 }; // the cabriolet: riders stand
}

// ---------- Loading and sharing ----------
const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/"));
const cache = new Map();
const SNOW = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, vertexColors: true });
const LAMP = new THREE.MeshBasicMaterial({ color: 0xffe2b0 });
let ROOM = null, WINDOW = null;
function windowMat() {
  if (WINDOW) return WINDOW;
  // What a lit room looks like through the glass (as in the catalogue): a warm glow, lamps, tables.
  const c = document.createElement("canvas"); c.width = 256; c.height = 128; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, "#1c120b"); g.addColorStop(0.3, "#5a3519"); g.addColorStop(0.6, "#b0692c"); g.addColorStop(1, "#6a3c1b");
  x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 5; i++) { const cx = 25 + i * 52, cy = 35 + (i % 2) * 6, h = x.createRadialGradient(cx, cy, 1, cx, cy, 35); h.addColorStop(0, "rgba(255,214,150,0.9)"); h.addColorStop(1, "rgba(255,150,70,0)"); x.fillStyle = h; x.fillRect(cx - 40, cy - 40, 80, 80); }
  x.fillStyle = "rgba(30,18,10,0.85)"; for (let i = 0; i < 9; i++) { const cx = 12 + i * 28; x.fillRect(cx - 11, 95, 22, 3); x.fillRect(cx - 2, 98, 3, 30); }
  ROOM = new THREE.CanvasTexture(c); ROOM.colorSpace = THREE.SRGBColorSpace; ROOM.wrapS = ROOM.wrapT = THREE.RepeatWrapping;
  return (WINDOW = new THREE.MeshStandardMaterial({ color: 0x141a20, roughness: 0.06, metalness: 0.3, emissive: 0xffffff, emissiveMap: ROOM, emissiveIntensity: 0.55, envMapIntensity: 1.8 }));
}
function roomUV(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { const side = Math.abs(n.getX(i)) > Math.abs(n.getZ(i)); uv[i * 2] = (side ? p.getZ(i) : p.getX(i)) / 6.5; uv[i * 2 + 1] = (p.getY(i) - 1.0) / 4.2; }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}
const paints = new Map();
export function paintMat(color = CHARCOAL) {
  const k = new THREE.Color(color).getHexString();
  if (!paints.has(k)) paints.set(k, new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.45, metalness: 0.35 }));
  return paints.get(k);
}

// A model as its parts by kind: bake, paint, snow, glass, lit, lamp, flat. Loaded once, shared by all.
export function kit(name) {
  if (!cache.has(name)) cache.set(name, new Promise((ok, no) => loader.load(`${BASE}${name}.glb?v=${VER}`, (g) => {
    const parts = {};
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      const kind = o.name === name ? "bake" : o.name.startsWith(name + "_") ? o.name.slice(name.length + 1) : "bake";
      const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
      let material = o.material;
      if (kind === "bake") material.envMapIntensity = 0.5;
      else if (kind === "snow") material = SNOW;
      else if (kind === "lamp") material = LAMP;
      else if (kind === "lit") { roomUV(geometry); material = windowMat(); }
      else if (kind === "glass") { material.envMapIntensity = 1.6; material.roughness = 0.05; material.depthWrite = false; material.side = THREE.DoubleSide; }
      geometry.computeBoundingBox();
      parts[kind] = { geometry, material, kind };
    });
    const box = new THREE.Box3();
    for (const p of Object.values(parts)) box.union(p.geometry.boundingBox);
    ok({ name, parts, box });
  }, undefined, no)));
  return cache.get(name);
}
export const kits = (names) => Promise.all(names.map(kit));

// Keep the attributes all the geometries share, so they merge.
function mergeSame(list) {
  list = list.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g.clone()));
  if (!list.length) return null;
  const keep = Object.keys(list[0].attributes).filter((a) => list.every((g) => g.attributes[a]));
  for (const g of list) for (const a of Object.keys(g.attributes)) if (!keep.includes(a)) g.deleteAttribute(a);
  return mergeGeometries(list);
}

// A tower: footing, the shaft stretched to the rope height, the head with its sheaves at the gauge. All
// towers of the game are this one shape (scaled across for another gauge), so they share one pool.
export const ROPE_H = 11.5, SURFACE_H = 6.5;
export function towerParts([base, shaft, head], ropeH = ROPE_H, surface = false) {
  const sink = 0.25, foot = 0.65 - sink, rz = surface ? 1.195 : 1.845, L = ropeH - rz - foot;
  const sx = surface ? 0.5 : 1;
  const sh = (g) => g && g.clone().scale(sx, L, sx).translate(0, foot, 0);
  const hd = (g) => g && g.clone().translate(0, foot + L, 0);
  const bs = (g) => g && g.clone().translate(0, -sink, 0);
  const B = base.parts, S = shaft.parts, H = head.parts;
  const parts = [
    { geometry: bs(B.bake.geometry), material: B.bake.material },
    { geometry: sh(S.bake.geometry), material: S.bake.material },
    { geometry: hd(H.bake.geometry), material: H.bake.material },
    { geometry: mergeSame([bs(B.paint?.geometry), sh(S.paint?.geometry), hd(H.paint?.geometry)]), paint: true },
    { geometry: mergeSame([bs(B.snow?.geometry), hd(H.snow?.geometry)]), material: SNOW },
  ];
  // Far away: the shaft and a plain crossarm.
  const w = surface ? 1.9 : 2 * 2.8 + 0.5, arm = new THREE.BoxGeometry(w, 0.42, 0.42).translate(surface ? 0.85 : 0, foot + L + (surface ? 0.45 : 0.85), 0);
  const far = [{ geometry: mergeSame([sh(S.paint.geometry), arm, new THREE.CylinderGeometry(0.9, 0.95, 0.9, 8).translate(0, 0.2, 0)]), paint: true }];
  return { parts, far, ropeY: ropeH };
}

// A plain stand-in for a carrier far away.
export function farCarrier(name) {
  const s = seatOf(name), list = [];
  if (s.cabin) {
    const [d, h] = CABIN[name] || [2, 2.2], w = name === "gondola10" ? 2.3 : name === "gondola6" ? 1.7 : 1.95;
    list.push(new THREE.BoxGeometry(w, h, d).translate(0, -1.15 - h / 2, 0), new THREE.BoxGeometry(0.12, 1.1, 0.12).translate(0, -0.6, 0));
  } else {
    const W = s.xs.length * 0.62 + 0.2, top = s.top;
    list.push(new THREE.BoxGeometry(0.1, -top, 0.1).translate(0, top / 2, -0.4), new THREE.BoxGeometry(W, 0.12, 0.6).translate(0, top - 0.05, 0.05), new THREE.BoxGeometry(W, 0.6, 0.1).translate(0, top + 0.3, -0.3));
    if (/bubble/.test(name)) list.push(new THREE.BoxGeometry(W + 0.2, 0.08, 1.1).translate(0, top + 0.95, 0.15));
  }
  return mergeSame(list);
}

// The bubble's dark rubber rim is baked in with the chair; split it out (the triangles hugging the glass)
// so it can swing up with the glass.
export function splitRim(k) {
  const glass = k.parts.glass?.geometry, bake = k.parts.bake.geometry;
  if (!glass) return { bake, rim: null };
  const gp = glass.attributes.position, pts = [];
  for (let i = 0; i < gp.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(gp, i));
  const src = bake.index ? bake.toNonIndexed() : bake, p = src.attributes.position, v = new THREE.Vector3();
  const near = (i) => { v.fromBufferAttribute(p, i); for (const q of pts) if (q.distanceToSquared(v) < 0.0036) return true; return false; };
  const keepA = [], keepB = [];
  for (let t = 0; t < p.count; t += 3) (near(t) && near(t + 1) && near(t + 2) ? keepB : keepA).push(t);
  const pick = (tris) => {
    const g = new THREE.BufferGeometry();
    for (const [n, a] of Object.entries(src.attributes)) {
      const arr = new a.array.constructor(tris.length * 3 * a.itemSize);
      tris.forEach((t, j) => { for (let k2 = 0; k2 < 3 * a.itemSize; k2++) arr[j * 3 * a.itemSize + k2] = a.array[t * a.itemSize + k2]; });
      g.setAttribute(n, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
    }
    return g;
  };
  return { bake: pick(keepA), rim: keepB.length ? pick(keepB) : null };
}

// ---------- Instanced pools with a near and a far level of detail ----------
const _m = new THREE.Matrix4();
export class Pool {
  // parts: [{ geometry, material | paint }]; each instance can carry its own paint colour (per lift).
  constructor(group, parts, far, cap = 64, { shadow = true, nearR = 250, farR = 900 } = {}) {
    Object.assign(this, { group, partsDef: parts.filter((p) => p.geometry), farDef: (far || []).filter((p) => p.geometry), shadow, nearR, farR, cap: 0, items: [], meshes: [], farMeshes: [] });
    this.grow(cap);
  }
  grow(cap) {
    for (const m of [...this.meshes, ...this.farMeshes]) { this.group.remove(m); m.dispose(); }
    this.cap = cap;
    const make = (p, shadow) => {
      const m = new THREE.InstancedMesh(p.geometry, p.paint ? paintMat("#ffffff") : p.material, cap); // paint: white × each instance's colour
      if (p.paint) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      m.count = 0; m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = true; m.renderOrder = p.order || 0; m.userData.paint = !!p.paint;
      this.group.add(m); return m;
    };
    this.meshes = this.partsDef.map((p) => make(p, this.shadow));
    this.farMeshes = this.farDef.map((p) => make(p, false));
  }
  // Static items: { m: Matrix4, color } (positions in m.elements[12..14]).
  add(m, color = CHARCOAL) { this.items.push({ m: m.clone(), color: new THREE.Color(color) }); if (this.items.length > this.cap) this.grow(Math.max(this.items.length, this.cap * 2)); this.dirty = true; }
  // Place the instances near the camera with the full model, the rest (to farR) with the stand-in.
  refresh(cam, items = this.items, count = items.length) {
    let n = 0, f = 0;
    const nr = this.nearR * this.nearR, fr = this.farR * this.farR;
    for (let i = 0; i < count; i++) {
      const it = items[i], e = it.m.elements, d = (e[12] - cam.x) ** 2 + (e[13] - cam.y) ** 2 + (e[14] - cam.z) ** 2;
      if (d < nr || !this.farMeshes.length && d < fr) { for (const m of this.meshes) { m.setMatrixAt(n, it.m); if (m.userData.paint) m.setColorAt(n, it.color); } this.uvOff?.(n, it); n++; }
      else if (d < fr) { for (const m of this.farMeshes) { m.setMatrixAt(f, it.m); if (m.userData.paint) m.setColorAt(f, it.color); } f++; }
      if (n >= this.cap || f >= this.cap) break;
    }
    for (const m of this.meshes) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; if (m.geometry.attributes.uvOff) m.geometry.attributes.uvOff.needsUpdate = true; }
    for (const m of this.farMeshes) { m.count = f; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    this.near = n; this.far = f;
  }
}

// ---------- Painted faces: name boards and signs ----------
const DIFF = { easy: "#1f9d4c", intermediate: "#1f5fbf", advanced: "#111317", expert: "#111317" };
export function diffMark(g, level, cx, cy, r) {
  g.save();
  if (level === "easy") { g.fillStyle = DIFF.easy; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); }
  else if (level === "intermediate") { g.fillStyle = DIFF.intermediate; g.fillRect(cx - r * 0.9, cy - r * 0.9, r * 1.8, r * 1.8); }
  else if (level === "advanced" || level === "expert") {
    const one = (x, s) => { g.save(); g.translate(x, cy); g.rotate(Math.PI / 4); g.fillStyle = DIFF.advanced; g.fillRect(-s, -s, 2 * s, 2 * s); g.restore(); };
    if (level === "expert") { one(cx - r * 0.62, r * 0.6); one(cx + r * 0.62, r * 0.6); } else one(cx, r * 0.72);
  }
  g.restore();
}
const fit = (g, text, max, size, weight = 800, family = '-apple-system, "Helvetica Neue", sans-serif') => {
  do { g.font = `${weight} ${size}px ${family}`; size -= 2; } while (g.measureText(text).width > max && size > 10);
};
function canvasTex(c, renderer) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; // the kit's UVs run from the top
  t.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4; return t;
}
// The lift's name on a terminal's board (4.6 × 0.75 m or 6 × 0.48 m): navy letters on cream.
export function nameBoard(part, name, sub, renderer) {
  const b = part.geometry.boundingBox, w = b.max.x - b.min.x, h = b.max.y - b.min.y;
  const c = document.createElement("canvas"); c.width = 1024; c.height = Math.round((1024 * h) / w); const g = c.getContext("2d");
  g.fillStyle = "#ece2cd"; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#1f2f4a"; g.lineWidth = 8; g.strokeRect(10, 10, c.width - 20, c.height - 20);
  g.fillStyle = "#1f2f4a"; g.textAlign = "center"; g.textBaseline = "middle";
  fit(g, name.toUpperCase(), c.width - 80, Math.round(c.height * (sub ? 0.5 : 0.62)));
  g.fillText(name.toUpperCase(), c.width / 2, c.height * (sub ? 0.4 : 0.54));
  if (sub) { g.font = `600 ${Math.round(c.height * 0.2)}px -apple-system, "PingFang SC", sans-serif`; g.fillText(sub, c.width / 2, c.height * 0.78); }
  return new THREE.MeshStandardMaterial({ map: canvasTex(c, renderer), roughness: 0.6 });
}
// A lift sign before the top (1.72 × 0.92 m): the lift, "prepare to unload", the top's altitude.
export function liftSignMat(name, alt, renderer) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 274; const g = c.getContext("2d");
  g.fillStyle = "#123a6b"; g.fillRect(0, 0, 512, 274); g.strokeStyle = "#fff"; g.lineWidth = 8; g.strokeRect(10, 10, 492, 254);
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
  fit(g, name.toUpperCase(), 460, 64); g.fillText(name.toUpperCase(), 256, 70);
  g.fillStyle = "#f2b632"; fit(g, "PREPARE TO UNLOAD", 460, 46, 800); g.fillText("PREPARE TO UNLOAD", 256, 140);
  g.fillStyle = "#fff"; g.font = `600 36px -apple-system, "PingFang SC", sans-serif`; g.fillText(`准备下缆车 · 海拔 ${alt.toLocaleString("en-US")} 米`, 256, 210);
  return new THREE.MeshStandardMaterial({ map: canvasTex(c, renderer), roughness: 0.6 });
}
// Run sign faces in one atlas, so all the run signs draw as one mesh. Cells are 256 × 116 (1.1 × 0.5 m).
export function runFaceAtlas(runs, renderer) {
  const CW = 256, CH = 116, cols = 8, rows = Math.max(1, Math.ceil(runs.length / cols));
  const c = document.createElement("canvas"); c.width = CW * cols; c.height = CH * rows; const g = c.getContext("2d");
  runs.forEach((r, i) => {
    const x = (i % cols) * CW, y = Math.floor(i / cols) * CH;
    g.fillStyle = "#f1ead8"; g.fillRect(x, y, CW, CH);
    g.strokeStyle = "#20262c"; g.lineWidth = 5; g.strokeRect(x + 5, y + 5, CW - 10, CH - 10);
    diffMark(g, r.level, x + 44, y + CH / 2, 26);
    g.fillStyle = "#1a1f24"; g.textAlign = "left"; g.textBaseline = "middle";
    const words = r.name.toUpperCase();
    fit(g, words, CW - 98, 40, 800);
    if (g.measureText(words).width > CW - 98 && words.includes(" ")) { // two lines
      const k = words.lastIndexOf(" ", Math.ceil(words.length / 2) + 2) > 0 ? words.lastIndexOf(" ", Math.ceil(words.length / 2) + 2) : words.indexOf(" ");
      const a = words.slice(0, k), b = words.slice(k + 1); fit(g, a.length > b.length ? a : b, CW - 98, 30, 800);
      g.fillText(a, x + 82, y + CH / 2 - 17); g.fillText(b, x + 82, y + CH / 2 + 17);
    } else g.fillText(words, x + 82, y + CH / 2 + 2);
  });
  const tex = canvasTex(c, renderer);
  return { tex, uvOf: (i, u, v) => [((i % cols) + u) / cols, (Math.floor(i / cols) + v) / rows] };
}
// A junction post's three arrow boards (left board middle, right boards top and bottom), one way each:
// arrow, difficulty, name; the route's board in gold.
export function junctionFaceMat(options, renderer) {
  // Three boards in the atlas (each 1 × 0.22 m): u 0..⅓ the top board (points right), ⅓..⅔ the middle
  // (points left), ⅔..1 the bottom (points right). Left-going ways on the left board.
  const W = 512, H = 116, c = document.createElement("canvas"); c.width = W * 3; c.height = H; const g = c.getContext("2d");
  const lefts = options.filter((o) => o.bearing > 0.18), rest = options.filter((o) => !(o.bearing > 0.18));
  const slots = [rest[0] || null, lefts[0] || null, rest[1] || lefts[1] || null];
  const arrow = (b) => (b > 0.5 ? "←" : b < -0.5 ? "→" : b > 0.18 ? "↖" : b < -0.18 ? "↗" : "↑");
  slots.forEach((o, k) => {
    const x = k * W, left = k === 1; // the left board's point is at the cell's left, the others' at the right
    g.fillStyle = o ? (o.route ? "#f2b632" : "#f1ead8") : "#e6dcc6"; g.fillRect(x, 0, W, H);
    if (!o) return;
    g.fillStyle = "#1a1f24"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "800 92px -apple-system, sans-serif";
    g.fillText(arrow(o.bearing), left ? x + 52 : x + W - 52, H / 2 + 4);
    diffMark(g, o.run.level, left ? x + 128 : x + 44, H / 2, 30);
    g.textAlign = "left"; fit(g, o.run.name.toUpperCase(), left ? 330 : 350, 78, 800, '"Arial Narrow", "Helvetica Neue", sans-serif');
    g.fillText(o.run.name.toUpperCase(), left ? x + 168 : x + 84, H / 2 + 3);
  });
  return new THREE.MeshStandardMaterial({ map: canvasTex(c, renderer), roughness: 0.6 });
}

// ---------- Placing things on the mountain ----------
// Runs and lift lines as segments in a coarse grid, for "is this spot clear?".
export function clearance(R) {
  const G = 100, grid = new Map(), key = (i, j) => i * 100003 + j;
  const put = (a, b, w) => {
    const i0 = Math.floor(Math.min(a[0], b[0]) / G) - 1, i1 = Math.floor(Math.max(a[0], b[0]) / G) + 1;
    const j0 = Math.floor(Math.min(a[1], b[1]) / G) - 1, j1 = Math.floor(Math.max(a[1], b[1]) / G) + 1;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([a, b, w]); }
  };
  for (const r of R.runs) { const ps = r.outline || r.pts; for (let i = 1; i < ps.length; i++) put(ps[i - 1], ps[i], r.area ? 4 : 16); }
  for (const l of R.lifts) for (let i = 1; i < l.pts.length; i++) put(l.pts[i - 1], l.pts[i], 9);
  const segDist = (x, z, [a, b]) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
  };
  // How far a disc of radius rad at (x, z) is clear of every run and lift (negative: it overlaps).
  return (x, z, rad) => {
    let best = Infinity;
    for (const s of grid.get(key(Math.floor(x / G), Math.floor(z / G))) || []) best = Math.min(best, segDist(x, z, s) - s[2] - rad);
    return best;
  };
}
// The nearest run's point to (x, z), for facing a building toward it.
export function nearestRunPoint(R, x, z, max = 400) {
  let best = null, bd = max * max;
  for (const r of R.runs) { if (r.area) continue; for (const [px, pz] of r.pts) { const d = (px - x) ** 2 + (pz - z) ** 2; if (d < bd) { bd = d; best = [px, pz]; } } }
  return best;
}
