// Art-direction test: riding American Flyer in two looks, A (semi-realistic, like Grand Mountain Adventure 2)
// and C (stylised, like Lonely Mountains: Snow Riders). Same terrain, lift line, forest and camera; only the
// assets, materials and light change, so the two can be compared fairly.
import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Terrain, treeMaskFn, farTerrain } from "./world.js?v=5";
import { Rider, Tracks, Spray } from "./rider.js?v=11";
import { addStep, thinPath, openBookPage, paintWith } from "./roadbook.js?v=4";
import { loadBoarder, boarderModel, poseBoarder, sitBoarder, standBoarder, idleBoarder, hikeBoarder, tricksOf, startTrick } from "./boarder.js?v=13";
import { snowNames, fadeNames, trailSigns } from "./snownames.js?v=3";
import { buildGraph, planRoute, nodesNear, LEVELS } from "./route.js?v=5";
import { Diorama } from "./mountain/diorama.js?v=17";
import { solar, sunVector, weatherKind, palette } from "./sky.js?v=1";
import { TrailMap } from "./mapview.js?v=7";
import { SkiLog } from "./skilog.js?v=2";
import { junctions, junctionSign, chevrons, arrowText, turnWord } from "./skinav.js?v=1";
import { translatePage, openSettings } from "./i18n.js?v=9";
import { navRow } from "./nav.js?v=1";

const $ = (id) => document.getElementById(id);
const coarse = matchMedia("(pointer: coarse)").matches;
const renderer = new THREE.WebGLRenderer({ canvas: $("c"), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 30000);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ---------- Shared: the lift line, its towers and ropes ----------
// Chairs per lift. Verified: American Flyer is a Leitner-Poma detachable six-pack with blue bubbles (2018,
// 182 chairs, 5 m/s). The other six-packs are from news of Copper's Leitner-Poma lifts; lifts not listed
// are drawn as quads until checked.
const LIFT_KIND = { "American Flyer": { seats: 6, bubble: true }, "American Eagle": { seats: 6 }, "Super Bee": { seats: 6 }, "Timberline Express": { seats: 6 } };
// Elsewhere the seats and bubbles come from OpenStreetMap (aerialway:occupancy, aerialway:bubble); a
// gondola is drawn as a closed cabin with glass all round.
const TOWER_EVERY = 85, ROPE_H = 11.5, STATION_H = 3.5, SPEED = 5;
let CHAIR_GAP = 33, HALF_GAUGE = 3.3, SEAT_X = [], MY_SEAT = 0, HAS_BUBBLE = false, CABIN = false;
function setLiftKind(lift) {
  CABIN = lift.kind === "gondola" || lift.kind === "cable_car";
  const k = (RESORT === "copper" && LIFT_KIND[lift.name]) || { seats: Math.min(8, Math.max(2, lift.seats || 4)), bubble: !!lift.bubble };
  const gap = 0.64;
  SEAT_X = CABIN ? [-0.45, 0.45] : Array.from({ length: k.seats }, (_, i) => (i - (k.seats - 1) / 2) * gap);
  MY_SEAT = SEAT_X[1];
  HAS_BUBBLE = CABIN || !!k.bubble;
  HALF_GAUGE = CABIN ? 3.0 : k.seats >= 6 ? 3.3 : k.seats >= 4 ? 2.7 : 2.3;
  CHAIR_GAP = CABIN ? 55 : 33;
}
// The bubble hinges at its top back edge and swings up and back when raised.
const BUBBLE_PIVOT = new THREE.Vector3(0, -1.12, -0.5), BUBBLE_UP = -1.35;

function liftLine(T, lift) {
  const ground = lift.pts.map(([x, z]) => new THREE.Vector3(x, T.heightAt(x, z), z));
  // Towers along the ground line, then ropes from tower top to tower top with a little sag.
  const dense = [];
  for (let i = 1; i < ground.length; i++) {
    const a = ground[i - 1], b = ground[i], n = Math.max(1, Math.round(a.distanceTo(b) / 2));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) dense.push(a.clone().lerp(b, k / n));
  }
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].z - dense[i - 1].z));
  const total = cum[cum.length - 1], nT = Math.max(2, Math.round(total / TOWER_EVERY));
  const towers = [];
  for (let k = 0; k <= nT; k++) {
    const s = (total * k) / nT;
    let i = cum.findIndex((c) => c >= s);
    if (i < 0) i = dense.length - 1;
    const p = dense[i];
    towers.push({ s, p: new THREE.Vector3(p.x, T.heightAt(p.x, p.z), p.z) });
  }
  // Stations sit level at the highest ground under them, so no slope pokes through the deck.
  for (const t of [towers[0], towers[towers.length - 1]]) {
    let hi = -Infinity;
    for (let dx = -16; dx <= 16; dx += 4) for (let dz = -16; dz <= 16; dz += 4) hi = Math.max(hi, T.heightAt(t.p.x + dx, t.p.z + dz));
    t.p.y = hi;
    t.h = STATION_H;
  }
  // The rope runs level through each station (20 m), then climbs to the first tower.
  const pointAtS = (s) => { const i = Math.min(dense.length - 1, Math.max(0, cum.findIndex((c) => c >= s))); return dense[i].clone(); };
  const inA = pointAtS(20), inB = pointAtS(total - 20);
  inA.y = towers[0].p.y; inB.y = towers[towers.length - 1].p.y;
  towers.splice(1, 0, { s: 20, p: inA, h: STATION_H, station: true });
  towers.splice(towers.length - 1, 0, { s: total - 20, p: inB, h: STATION_H, station: true });
  while (towers.length > 4 && towers[2].s < 40) towers.splice(2, 1); // no tower inside a station
  while (towers.length > 4 && towers[towers.length - 3].s > total - 40) towers.splice(towers.length - 3, 1);
  const dir = new THREE.Vector3().subVectors(ground[ground.length - 1], ground[0]).setY(0).normalize();
  const side = new THREE.Vector3(dir.z, 0, -dir.x);
  const ropeAt = (s, off) => {
    let k = 1;
    while (k < towers.length - 1 && towers[k].s < s) k++;
    const a = towers[k - 1], b = towers[k], t = (s - a.s) / (b.s - a.s || 1), span = b.s - a.s;
    const p = a.p.clone().lerp(b.p, t);
    const ha = a.h ?? ROPE_H, hb = b.h ?? ROPE_H;
    p.y += ha + (hb - ha) * t - (a.station || b.station ? 0 : span * 0.014 * 4 * t * (1 - t)); // sag between towers
    return p.addScaledVector(side, off);
  };
  const up = [], down = [];
  for (let s = 0; s <= total; s += 2) { up.push(ropeAt(s, HALF_GAUGE)); down.push(ropeAt(total - s, -HALF_GAUGE)); }
  return { towers, dir, side, up, down, total, ground };
}

// Point and heading at distance d along a sampled path (2 m steps).
function along(path, d, out = new THREE.Vector3()) {
  const f = Math.max(0, Math.min(path.length - 1.001, d / 2)), i = Math.floor(f), t = f - i;
  return out.copy(path[i]).lerp(path[i + 1], t);
}

// ---------- Chairs ----------
// A detachable six-pack. Origin at the grip on the rope, +z the way it travels, y up.
// A gondola cabin around the same seat: the rider on the back bench facing the way up, a bench opposite,
// glass from the seats up. Same parts as a chair (metal, pads, glass, frames) so it is drawn the same way.
function cabinParts() {
  const tube = (pts, r = 0.04) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.1), Math.max(8, pts.length * 6), r, 6);
  const X = 1.05, Z0 = -0.5, Z1 = 1.65, CZ = (Z0 + Z1) / 2, YT = -0.95, YW = -2.5, YB = -3.05;
  const metal = [
    new THREE.BoxGeometry(0.28, 0.36, 0.7).translate(0, -0.12, 0), // grip
    tube([[0, -0.25, 0], [0, -0.6, CZ * 0.5], [0, YT, CZ]], 0.07), // hanger
    new RoundedBoxGeometry(2 * X + 0.1, 0.16, Z1 - Z0 + 0.1, 2, 0.06).translate(0, YT, CZ), // roof
    new RoundedBoxGeometry(2 * X + 0.1, 0.1, Z1 - Z0 + 0.1, 2, 0.04).translate(0, YB, CZ), // floor
  ];
  // Solid lower walls, waist high.
  for (const s of [-1, 1]) metal.push(new THREE.BoxGeometry(0.05, YW - YB, Z1 - Z0).translate(s * X, (YW + YB) / 2, CZ));
  for (const z of [Z0, Z1]) metal.push(new THREE.BoxGeometry(2 * X, YW - YB, 0.05).translate(0, (YW + YB) / 2, z));
  const pad = [];
  for (const [z, back] of [[0.07, -1], [Z1 - 0.32, 1]]) { // two benches, facing each other (low backs, so the view stays open)
    pad.push(new RoundedBoxGeometry(2 * X - 0.15, 0.11, 0.5, 2, 0.04).translate(0, -2.41, z));
    pad.push(new RoundedBoxGeometry(2 * X - 0.15, 0.26, 0.08, 2, 0.03).translate(0, -2.24, z + back * 0.3));
  }
  // Glass all round from the walls to the roof.
  const glass = [];
  for (const s of [-1, 1]) glass.push(new THREE.PlaneGeometry(Z1 - Z0, YT - YW).rotateY(Math.PI / 2).translate(s * X, (YT + YW) / 2, CZ));
  for (const z of [Z0, Z1]) glass.push(new THREE.PlaneGeometry(2 * X, YT - YW).translate(0, (YT + YW) / 2, z));
  const rim = [];
  for (const x of [-X, X]) for (const z of [Z0, Z1]) rim.push(tube([[x, YW, z], [x, YT, z]], 0.035)); // corner posts
  for (const y of [YW, YT + 0.05]) rim.push(tube([[-X, y, Z0], [X, y, Z0], [X, y, Z1], [-X, y, Z1], [-X, y, Z0]], 0.03));
  const merge = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => { g.deleteAttribute("uv"); return g; }));
  return { metal: merge(metal), pad: merge(pad), bubble: merge(glass), rim: merge(rim) };
}

function chairParts() {
  if (CABIN) return cabinParts();
  const tube = (pts, r = 0.04) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.1), Math.max(8, pts.length * 6), r, 6);
  const H = SEAT_X[SEAT_X.length - 1] + 0.35; // half the chair's width
  const metal = [
    new THREE.BoxGeometry(0.28, 0.36, 0.7).translate(0, -0.12, 0), // grip
    tube([[0, -0.25, 0], [0, -0.75, -0.14], [0, -1.35, -0.55], [0, -1.95, -0.5], [0, -2.15, -0.32]], 0.06), // hanger
    tube([[-0.9, -1.25, -0.56], [0.9, -1.25, -0.56]], 0.04), // bubble hinge bar
    tube([[-H, -2.47, -0.22], [H, -2.47, -0.22]], 0.045), tube([[-H, -2.47, 0.36], [H, -2.47, 0.36]], 0.04),
  ];
  for (const s of [-1, 1]) {
    metal.push(tube([[s * H, -2.47, 0.36], [s * H, -2.47, -0.22], [s * H, -1.82, -0.32]]));
    metal.push(tube([[s * H, -2.15, -0.26], [s * H, -2.12, 0.3]], 0.035)); // armrest
    metal.push(tube([[s * H, -1.8, -0.3], [s * H, -1.88, 0.2], [s * (H - 0.03), -1.96, 0.55]], 0.035)); // safety bar arms, lowered
  }
  for (let i = 0; i < SEAT_X.length; i += 2) { // a footrest for each pair of riders
    const x = i + 1 < SEAT_X.length ? (SEAT_X[i] + SEAT_X[i + 1]) / 2 : SEAT_X[i]; // an odd seat out gets its own
    for (const d of [-0.22, 0.22]) metal.push(tube([[x + d, -1.96, 0.56], [x + d, -2.5, 0.6], [x + d, -2.88, 0.62]], 0.028));
    metal.push(new THREE.BoxGeometry(0.62, 0.04, 0.24).translate(x, -2.9, 0.68));
  }
  metal.push(tube([[-H + 0.03, -1.96, 0.55], [H - 0.03, -1.96, 0.55]], 0.035)); // safety bar
  const pad = [];
  for (const x of SEAT_X) { // a cushion per seat
    pad.push(new RoundedBoxGeometry(0.6, 0.11, 0.56, 2, 0.04).translate(x, -2.41, 0.07));
    pad.push(new RoundedBoxGeometry(0.6, 0.55, 0.09, 2, 0.04).rotateX(-0.14).translate(x, -2.08, -0.25));
  }
  // The bubble, lowered: a curved shell from over the heads down in front to the shins, with flat ends.
  const C = new THREE.Vector3(0, -2.05, -0.15), R = 1.0, a0 = -0.33, a1 = 2.2, NA = 18, NX = 12;
  const pos = [], idx = [];
  for (let i = 0; i <= NA; i++) for (let j = 0; j <= NX; j++) {
    const a = a0 + (a1 - a0) * i / NA, x = -H - 0.1 + (2 * H + 0.2) * j / NX;
    pos.push(x, C.y + R * Math.cos(a), C.z + R * Math.sin(a));
    if (i < NA && j < NX) { const k = i * (NX + 1) + j; idx.push(k, k + NX + 1, k + 1, k + 1, k + NX + 1, k + NX + 2); }
  }
  for (const x of [-H - 0.1, H + 0.1]) { // end caps: a fan from the curve's centre
    const c = pos.length / 3;
    pos.push(x, C.y, C.z);
    for (let i = 0; i <= NA; i++) { const a = a0 + (a1 - a0) * i / NA; pos.push(x, C.y + R * Math.cos(a), C.z + R * Math.sin(a)); }
    for (let i = 0; i < NA; i++) idx.push(c, c + 1 + i, c + 2 + i);
  }
  const bubble = new THREE.BufferGeometry();
  bubble.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  bubble.setIndex(idx);
  bubble.computeVertexNormals();
  // Its frame: the bottom edge and the two ends.
  const arc = (x) => Array.from({ length: NA + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / NA; return [x, C.y + R * Math.cos(a), C.z + R * Math.sin(a)]; });
  const rim = mergeGeometries([tube(arc(-H - 0.1), 0.03), tube(arc(H + 0.1), 0.03),
    tube([[-H - 0.1, C.y + R * Math.cos(a1), C.z + R * Math.sin(a1)], [H + 0.1, C.y + R * Math.cos(a1), C.z + R * Math.sin(a1)]], 0.035)].map((g) => g.toNonIndexed()));
  return { metal: mergeGeometries(metal.map((g) => g.toNonIndexed())), pad: mergeGeometries(pad.map((g) => g.toNonIndexed())), bubble, rim };
}

// The bubble's transform for an opening u: 0 lowered, 1 raised (turned up and back about its hinge).
const _bm = new THREE.Matrix4(), _bt = new THREE.Matrix4();
function bubbleMatrix(u, out = new THREE.Matrix4()) {
  return out.makeTranslation(BUBBLE_PIVOT.x, BUBBLE_PIVOT.y, BUBBLE_PIVOT.z)
    .multiply(_bm.makeRotationX(BUBBLE_UP * u))
    .multiply(_bt.makeTranslation(-BUBBLE_PIVOT.x, -BUBBLE_PIVOT.y, -BUBBLE_PIVOT.z));
}

// ---------- Trees ----------
// Where trees stand: the OSM woods near the lift, kept off the runs and out of the cleared lift line.
function treeSpots(T, R, mask, line, M = 900, clear = 16, skip = null) {
  const xs = line.ground.map((p) => p.x), zs = line.ground.map((p) => p.z);
  const x0 = Math.max(T.x0, Math.min(...xs) - M), x1 = Math.min(T.x1, Math.max(...xs) + M);
  const z0 = Math.max(T.z0, Math.min(...zs) - M), z1 = Math.min(T.z1, Math.max(...zs) + M);
  const onRun = new Set(), C = 8, key = (x, z) => `${Math.floor(x / C)},${Math.floor(z / C)}`;
  for (const run of R.runs) {
    const pts = run.outline || run.pts, w = run.area ? 0 : 16;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 4);
      for (let k = 0; k <= n; k++) {
        const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
        for (let dx = -w; dx <= w; dx += C) for (let dz = -w; dz <= w; dz += C) onRun.add(key(x + dx, z + dz));
      }
    }
  }
  const segDist = (x, z) => {
    let d = Infinity;
    const g = line.ground;
    for (let i = 1; i < g.length; i++) {
      const ax = g[i - 1].x, az = g[i - 1].z, dx = g[i].x - ax, dz = g[i].z - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      d = Math.min(d, Math.hypot(ax + dx * t - x, az + dz * t - z));
    }
    return d;
  };
  const spots = [];
  for (let x = x0; x < x1; x += 9) for (let z = z0; z < z1; z += 9) {
    const px = x + (rand() - 0.5) * 8, pz = z + (rand() - 0.5) * 8;
    const woods = mask(px, pz);
    if ((woods ? rand() > 0.62 : rand() > 0.012) || onRun.has(key(px, pz))) continue;
    const d = segDist(px, pz);
    if (d < clear) continue; // the lift line is cleared
    if (skip && skip(px, pz)) continue;
    if (d > 420 && rand() > 0.45) continue; // thinner far away, where fog softens it anyway
    spots.push({ x: px, z: pz, y: T.heightAt(px, pz), d, v: rand() });
  }
  return spots;
}

// A: a spruce built from branch cards (tools/make_branch.py paints them from Poly Haven's fir twigs).
// Tiers of drooping branches around a trunk, a crossed crown on top. Unit height. Normals lean outward
// and up so the crown shades like a volume rather than flat cards. detail: 1 near the lift, 0 far away.
function cardSpruce(detail) {
  const N = detail ? 13 : 7, K = detail ? 7 : 5, segs = detail ? 2 : 1;
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), y = 0.09 + t * 0.66, L = 0.34 * Math.pow(1 - t, 0.95) + 0.06, w = L * 0.55;
    const rot = rand() * 6.28;
    for (let k = 0; k < K; k++) {
      const yaw = rot + (k / K) * Math.PI * 2 + (rand() - 0.5) * 0.4, c = Math.cos(yaw), sn = Math.sin(yaw);
      const base = pos.length / 3;
      // The branch bends down along its length: a gentle slope near the trunk, steeper at the tip.
      let x = 0, h = 0;
      const prof = [[0, 0]];
      for (let g = 1; g <= segs; g++) {
        const a = (detail ? [0.22, 0.6][g - 1] : 0.4) + (rand() - 0.5) * 0.15, l = L / segs;
        x += Math.cos(a) * l; h -= Math.sin(a) * l;
        prof.push([x, h]);
      }
      prof.forEach(([px, py], g) => {
        for (const v of [0, 1]) {
          const z = (v - 0.5) * w * (1 - 0.25 * (g / segs));
          pos.push(px * c - z * sn, y + py, px * sn + z * c);
          const n = new THREE.Vector3(c * 0.45, 0.9, sn * 0.45).normalize();
          nor.push(n.x, n.y, n.z);
          uv.push(g / segs, v);
        }
      });
      for (let g = 0; g < segs; g++) { const a = base + g * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  // The crown: two crossed upright cards.
  const cp = [], cn = [], cu = [], ci = [];
  for (const a of [0, Math.PI / 2]) {
    const b = cp.length / 3, c = Math.cos(a), sn = Math.sin(a), h0 = 0.62, h1 = 1.0, w = (h1 - h0) / 2;
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      cp.push((u - 0.5) * w * c, h0 + v * (h1 - h0), (u - 0.5) * w * sn);
      cn.push(0, 1, 0); cu.push(u, v);
    }
    ci.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  const crown = new THREE.BufferGeometry();
  crown.setAttribute("position", new THREE.Float32BufferAttribute(cp, 3));
  crown.setAttribute("normal", new THREE.Float32BufferAttribute(cn, 3));
  crown.setAttribute("uv", new THREE.Float32BufferAttribute(cu, 2));
  crown.setIndex(ci);
  const trunk = new THREE.CylinderGeometry(0.008, 0.022, 0.8, 6).translate(0, 0.4, 0);
  return { branches: geo, crown, trunk };
}

// Foliage cards: cut out by the texture's alpha; snow from the mask, only on faces turned to the sky.
// While it snows: grey thick air, a dim sun. Re-applied when the look is rebuilt.
let snowing = false;
function setSnowyAir() {
  scene.fog = new THREE.FogExp2(0xd2d8e0, 0.0016);
  sun.intensity *= 0.35;
}

// How much snow lies on the trees, 0 to 1: set from the weather (see weather()), shared by all foliage.
const treeSnow = { value: 0.6 };
function foliageMat(map, snowMap, upFacing) {
  const mat = new THREE.MeshStandardMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.85 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.snowMap = { value: snowMap };
    sh.uniforms.treeSnow = treeSnow;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D snowMap; uniform float treeSnow;")
      .replace("#include <map_fragment>", `#include <map_fragment>
        float up = ${upFacing ? "(gl_FrontFacing ? 1.0 : 0.08)" : "0.8"};
        float sm = texture2D(snowMap, vMapUv).r * up;
        // More snow: the clumps spread (lower threshold) and a frosting covers the upper faces.
        float edge = 0.32 * (1.0 - treeSnow);
        float cover = max(smoothstep(edge, edge + 0.18, sm), up * treeSnow * treeSnow * 0.45);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 1.0), cover);`);
  };
  return mat;
}

// Falling snow around the camera, only while it snows.
function snowfall() {
  const n = coarse ? 2500 : 5000, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 80, Math.random() * 50 - 20, (Math.random() - 0.5) * 80], i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const c = document.createElement("canvas"); c.width = c.height = 32;
  // A soft dot drawn as an alpha map (white to black), so its edge has no dark fringe on the snow.
  const g = c.getContext("2d"), grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, "#fff"); grd.addColorStop(1, "#000");
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.32, color: 0xffffff, alphaMap: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  pts.frustumCulled = false;
  pts.visible = false;
  pts.userData.step = (dt, at) => {
    const p = geo.attributes.position;
    for (let i = 0; i < n; i++) {
      let y = p.getY(i) - 1.3 * dt, x = p.getX(i) + Math.sin(y * 0.3 + i) * 0.3 * dt;
      if (y < -20) y += 50;
      p.setXY(i, x, y);
    }
    p.needsUpdate = true;
    pts.position.copy(at);
  };
  return pts;
}

// The resort's weather: snow in the last three days whitens the trees; snowing now makes it fall.
// ?snow=0..1 and ?falling=1 override it for previews.
async function weather(params, flakes, at, applySky) {
  let recent = null, now = false;
  try {
    const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${at.lat.toFixed(4)}&longitude=${at.lon.toFixed(4)}&current=weather_code,snowfall,cloud_cover&daily=snowfall_sum&past_days=3&forecast_days=1&timezone=auto`)).json();
    recent = w.daily.snowfall_sum.slice(0, 3).reduce((a, b) => a + (b || 0), 0);
    now = (w.current.snowfall || 0) > 0 || [71, 73, 75, 77, 85, 86].includes(w.current.weather_code);
    applySky?.(weatherKind(w.current.weather_code, w.current.cloud_cover)); // the same greying as the miniature
  } catch { /* offline: keep the default */ }
  if (recent != null) treeSnow.value = Math.min(1, 0.5 + recent / 25);
  if (now) treeSnow.value = Math.max(treeSnow.value, 0.85);
  if (params.has("snow")) treeSnow.value = Math.min(1, Math.max(0, Number(params.get("snow"))));
  if (params.has("falling")) now = params.get("falling") === "1";
  flakes.visible = now;
  snowing = now;
  if (now && sun) setSnowyAir();
  $("weather").textContent = `${now ? "❄️ 正在下雪 · " : ""}${recent != null ? `过去 3 天降雪 ${recent.toFixed(1)} 厘米 · ` : ""}树上积雪 ${Math.round(treeSnow.value * 100)}%`;
}

function plant(spots, geo, mat, scaleOf) {
  const group = new THREE.Group(), CH = 300, buckets = new Map();
  for (const s of spots) {
    const k = `${Math.floor(s.x / CH)},${Math.floor(s.z / CH)}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(s);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  for (const list of buckets.values()) {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((s, i) => {
      const h = scaleOf(s);
      m.compose(p.set(s.x, s.y - 0.3, s.z), q.setFromAxisAngle(Y, s.v * 40), sc.set(h * (0.85 + s.v * 0.3), h, h * (0.85 + s.v * 0.3)));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.setScalar(0.85 + ((s.v * 7.3) % 1) * 0.3));
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}

// ---------- Ground ----------
function terrainGeometry(T) {
  const { gw, gh } = T, pos = new Float32Array(gw * gh * 3), uv = new Float32Array(gw * gh * 2);
  for (let r = 0; r < gh; r++) for (let j = 0; j < gw; j++) {
    const k = r * gw + j, x = T.x0 + j * T.cell, z = T.z0 + ((T.z1 - T.z0) * r) / (gh - 1);
    pos.set([x, T.h[k], z], k * 3);
    uv.set([x, z], k * 2);
  }
  const idx = new Uint32Array((gw - 1) * (gh - 1) * 6);
  let p = 0;
  for (let r = 0; r < gh - 1; r++) for (let j = 0; j < gw - 1; j++) { const a = r * gw + j; idx.set([a, a + gw, a + 1, a + 1, a + gw, a + gw + 1], p); p += 6; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return geo;
}

// A's snow: sculpted texture up close, rock on steep faces, softening with distance.
function snowA(tex, vertexColors = false) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, vertexColors });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { snowD: { value: tex.snowD }, snowN: { value: tex.snowN }, rockD: { value: tex.rockD } });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP; varying vec3 vWN;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D snowD, snowN, rockD; varying vec3 vWP; varying vec3 vWN;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        float d = length(vWP - cameraPosition);
        float fade = smoothstep(300.0, 3000.0, d);
        // Snow stays snow-white: the texture only adds a little grain, rock shows on the steepest faces.
        vec3 sn = mix(texture2D(snowD, vWP.xz / 6.0).rgb * 1.25, vec3(0.97), max(fade, 0.45));
        sn = mix(sn, vec3(0.97), 0.25);
        float steep = 1.0 - vWN.y;
        float rockW = smoothstep(0.55, 0.7, steep + (texture2D(rockD, vWP.xz / 300.0).r - 0.5) * 0.12);
        vec3 rk = texture2D(rockD, vWP.xz / 40.0).rgb;
        diffuseColor.rgb *= mix(sn, rk * 1.2, rockW);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        vec3 nt = texture2D(snowN, vWP.xz / 6.0).xyz * 2.0 - 1.0;
        vec3 nt2 = texture2D(snowN, vWP.xz / 80.0).xyz * 2.0 - 1.0;
        vec3 wp = vec3(nt.x, 0.0, -nt.y) * 0.6 * (1.0 - fade) + vec3(nt2.x, 0.0, -nt2.y) * 0.35;
        normal = normalize(normal + (viewMatrix * vec4(wp, 0.0)).xyz);`)
      // Sparkle: tiny ice crystals catching the light up close.
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        vec3 cell = floor(vWP * 7.0);
        float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float near = 1.0 - smoothstep(4.0, 40.0, length(vWP - cameraPosition));
        totalEmissiveRadiance += vec3(1.0, 0.98, 0.92) * step(0.9965, h) * near * 1.4;`);
  };
  return mat;
}

function corduroy() {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 8;
  const g = c.getContext("2d");
  for (let x = 0; x < 128; x++) {
    const v = 238 + (x % 6 < 3 ? 12 : 0) + Math.round(Math.random() * 4);
    g.fillStyle = `rgb(${v},${v + 2},${Math.min(255, v + 8)})`;
    g.fillRect(x, 0, 1, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function runRibbon(T, pts, width, lift) {
  // Draped on the snow across its width as well as along it (every few metres both ways): a strip
  // stretched flat between its edges would float above a crowned run and swallow the rider's legs.
  const dense = [];
  for (let i = 0; i < pts.length; i++) {
    if (i) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 4);
      for (let k = 1; k < n; k++) dense.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
    }
    dense.push(pts[i]);
  }
  const across = Math.max(2, Math.ceil(width / 3)), cols = across + 1;
  const pos = [], uv = [], idx = [];
  let s = 0;
  for (let i = 0; i < dense.length; i++) {
    const [x, z] = dense[i], [ax, az] = dense[Math.max(0, i - 1)], [bx, bz] = dense[Math.min(dense.length - 1, i + 1)];
    let dx = bx - ax, dz = bz - az;
    const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    if (i) s += Math.hypot(x - dense[i - 1][0], z - dense[i - 1][1]);
    for (let c = 0; c < cols; c++) {
      const sd = (c / across) * 2 - 1, px = x - dz * sd * width / 2, pz = z + dx * sd * width / 2;
      pos.push(px, T.heightAt(px, pz) + lift, pz);
      uv.push(((sd + 1) / 2) * (width / 4), s / 20);
    }
    if (i) for (let c = 0; c < across; c++) { const b = (i - 1) * cols + c; idx.push(b, b + cols, b + 1, b + 1, b + cols, b + cols + 1); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// ---------- Lift hardware ----------
function towerGeometries(line) {
  const metal = [], dark = [];
  for (let i = 1; i < line.towers.length - 1; i++) {
    if (line.towers[i].station) continue;
    const { p } = line.towers[i];
    const top = ROPE_H - 0.9;
    const yaw = Math.atan2(line.dir.x, line.dir.z);
    const place = (g) => g.rotateY(yaw).translate(p.x, p.y, p.z);
    metal.push(place(new THREE.CylinderGeometry(0.32, 0.55, top, 10).translate(0, top / 2, 0)));
    metal.push(place(new THREE.BoxGeometry(HALF_GAUGE * 2 + 1.4, 0.45, 0.45).translate(0, top, 0)));
    metal.push(place(new THREE.CylinderGeometry(0.9, 1.1, 0.5, 10).translate(0, 0.25, 0))); // footing
    for (const s of [-1, 1]) {
      const x = s * HALF_GAUGE;
      metal.push(place(new THREE.BoxGeometry(0.2, 0.22, 3.4).translate(x, ROPE_H - 0.45, 0))); // sheave beam
      metal.push(place(new THREE.BoxGeometry(0.12, 0.5, 0.12).translate(x, ROPE_H - 0.68, 0)));
      for (let w = 0; w < 4; w++) dark.push(place(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 14).rotateZ(Math.PI / 2).translate(x, ROPE_H - 0.24, -1.2 + w * 0.8)));
    }
  }
  const strip = (g) => { g = g.toNonIndexed(); g.deleteAttribute("uv"); return g; };
  return { metal: mergeGeometries(metal.map(strip)), dark: dark.length ? mergeGeometries(dark.map(strip)) : null };
}

// A detachable terminal, after photos of American Flyer's top ("unload area with exposed bullwheel",
// "unloading ramp"): an exposed horizontal bullwheel, a steel carrier along the rope, a canopy on posts
// wrapped in grey foam pads, the operator's glass booth, and at the top an unload ramp ending at a big sign
// with the lift's name. Local frame: the bullwheel at the origin, +z toward the line.
function liftSign(lines, w = 6.4, h = 1.9) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext("2d");
  g.fillStyle = "#123a6b"; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#ffffff"; g.lineWidth = 10; g.strokeRect(14, 14, c.width - 28, c.height - 28);
  g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `800 ${Math.round(c.height * 0.36)}px -apple-system, "Helvetica Neue", sans-serif`;
  g.fillText(lines[0], c.width / 2, c.height * 0.38);
  g.font = `600 ${Math.round(c.height * 0.2)}px -apple-system, "PingFang SC", sans-serif`;
  g.fillText(lines[1], c.width / 2, c.height * 0.74);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
}

function terminal(p, dir, mats, { name, alt, top, upSide }) {
  const g = new THREE.Group();
  const W = HALF_GAUGE + 2.2, steel = mats.metal;
  const foam = new THREE.MeshStandardMaterial({ color: 0x8d939b, roughness: 0.95 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.5 });
  const snow = new THREE.MeshStandardMaterial({ color: 0xf6f8fb, roughness: 0.9 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  // Bullwheel: rim, spokes, hub, at rope height.
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(HALF_GAUGE, 0.16, 10, 64), steel));
  for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(HALF_GAUGE * 2, 0.12, 0.18), steel); sp.rotation.z = (i / 8) * Math.PI; wheel.add(sp); }
  wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 16).rotateX(Math.PI / 2), mats.dark));
  wheel.rotation.x = Math.PI / 2;
  wheel.position.y = STATION_H;
  g.add(wheel);
  // Carrier: the steel beam the chairs run under through the station, on a column over the wheel.
  add(new THREE.BoxGeometry(W * 2 - 1.6, 0.7, 16), steel, 0, STATION_H + 0.9, 8);
  add(new THREE.CylinderGeometry(0.45, 0.6, STATION_H + 0.6, 12), steel, 0, (STATION_H + 0.6) / 2, 0);
  // Canopy on four posts, each post wrapped in a grey foam pad at rider height.
  // A flat canopy well above a rider's head on the chair (and the camera behind them).
  const roof = add(new RoundedBoxGeometry(W * 2 + 1.2, 0.35, 19, 2, 0.12), white, 0, STATION_H + 4.2, 6);
  roof.rotation.x = 0.03;
  for (const x of [-W, W]) for (const z of [-3, 15]) {
    add(new THREE.CylinderGeometry(0.22, 0.22, STATION_H + 4.2, 10), steel, x, (STATION_H + 4.2) / 2, z);
    add(new RoundedBoxGeometry(0.75, 2.0, 0.75, 2, 0.2), foam, x, 1.1, z);
  }
  // Operator booth on the other side from where riders get on or off.
  const bx = -upSide * (W + 2.6);
  add(new THREE.BoxGeometry(2.6, 2.6, 2.6), new THREE.MeshStandardMaterial({ color: 0x9fc4e8, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.3 }), bx, 1.6, 6);
  add(new THREE.BoxGeometry(3.0, 0.3, 3.0), mats.roof, bx, 3.05, 6);
  add(new THREE.BoxGeometry(2.7, 0.35, 2.7), mats.dark, bx, 0.2, 6);
  // The deck riders stand on, level snow.
  // A snow-covered deck on a concrete foundation that reaches down to the slope.
  add(new THREE.BoxGeometry(W * 2 + 6, 0.5, 26), snow, 0, 0, 6);
  add(new THREE.BoxGeometry(W * 2 + 5, 8, 25), new THREE.MeshStandardMaterial({ color: 0x8f8b85, roughness: 0.95 }), 0, -4.2, 6);
  const signAt = new THREE.Vector3(upSide * HALF_GAUGE, 0, -11);
  if (top) {
    // Unload ramp: from under the arriving chairs, sloping down and away past the wheel.
    const ramp = add(new THREE.BoxGeometry(4.2, 0.6, 16), snow, upSide * HALF_GAUGE, 0.05, -1); // skis just clear it
    ramp.rotation.x = -0.06;
  }
  // The sign, facing the riders as they come in (or wait to load).
  for (const x of [-2.8, 2.8]) add(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 8), mats.dark, signAt.x + x, 2.1, signAt.z);
  const sign = liftSign([name.toUpperCase(), top ? `顶站 · 海拔 ${alt.toLocaleString()} 米` : `底站 · 海拔 ${alt.toLocaleString()} 米`]);
  sign.position.set(signAt.x, 3.3, signAt.z + 0.06);
  g.add(sign);
  g.position.copy(p);
  g.rotation.y = Math.atan2(dir.x, dir.z);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ---------- The scene for a look ----------
let world = null, sun = null, myChair = null, chairsUp = null, chairsDown = null, padsUp = null, padsDown = null;
let topTerm = null;
let bubblesUp = null, bubblesDown = null, rimsUp = null, rimsDown = null, myBubble = null, bubbleOpen = 1, bubbleWant = 1;
// ---------- The snow's colour, baked: ridge shadows (blue), the floor under the woods, rock ----------
// Ridges throw long shadows across the slopes in the low winter sun; seen from the air those shadowed
// slopes are blue. Marched once on every other vertex (and filled in) to keep loading quick on phones.
function shadeGround(geo, T, mask, dir, day) {
  const { gw, gh } = T, pos = geo.attributes.position, col = new Float32Array(gw * gh * 3);
  const shade = new Float32Array(gw * gh), lit = new THREE.Color(1, 1, 1), blue = new THREE.Color(0.66, 0.74, 0.96), floor = new THREE.Color(0.8, 0.83, 0.9), c = new THREE.Color();
  for (let r = 0; r < gh; r += 2) for (let j = 0; j < gw; j += 2) { const k = r * gw + j; shade[k] = day ? T.sunShadow(pos.getX(k), pos.getZ(k), pos.getY(k) + 1, dir) : 1; }
  for (let r = 0; r < gh; r++) for (let j = 0; j < gw; j++) {
    const k = r * gw + j, r0 = r & ~1, j0 = j & ~1, r1 = Math.min(gh - 1 - ((gh - 1) & 1), r0 + 2), j1 = Math.min(gw - 1 - ((gw - 1) & 1), j0 + 2);
    const s = (shade[r0 * gw + j0] + shade[r0 * gw + j1] + shade[r1 * gw + j0] + shade[r1 * gw + j1]) / 4;
    c.copy(lit).lerp(blue, s * 0.85);
    if (mask(pos.getX(k), pos.getZ(k))) c.multiply(floor); // shade under the canopy
    col.set([c.r, c.g, c.b], k * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
}

// The forest beyond the way down: the whole mountain wooded where it is, low-detail trees every ~40 m, so
// the slopes read as real from the chair and the top. The runs are left as clear lines through it.
function farForest(T, mask, near, coarse) {
  const spots = [], step = coarse ? 40 : 30;
  for (let z = T.z0 + 50; z < T.z1 - 50; z += step) for (let x = T.x0 + 50; x < T.x1 - 50; x += step) {
    const px = x + (rand() - 0.5) * step * 0.9, pz = z + (rand() - 0.5) * step * 0.9;
    if (!mask(px, pz) || near(px, pz)) continue;
    spots.push({ x: px, z: pz, y: T.heightAt(px, pz), d: 9999, v: rand() });
  }
  return spots;
}

// ---------- Other lifts, seen while skiing ----------
// Every lift near the way down: towers every 85 m, its two ropes, a station at each end, and its name
// floating over the bottom station so you can find it from a distance.
function otherLift(T, l) {
  const g = new THREE.Group(), pts = l.pts.map(([x, z]) => new THREE.Vector3(x, T.heightAt(x, z), z));
  const along = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = a.distanceTo(b), n = Math.max(1, Math.round(L / 85));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) along.push(a.clone().lerp(b, k / n));
  }
  const dir = pts[pts.length - 1].clone().sub(pts[0]).setY(0).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x);
  const steel = new THREE.MeshStandardMaterial({ color: 0x8d96a3, metalness: 0.5, roughness: 0.5 });
  const H = 11, towers = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.45, H, 8), steel, along.length);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 0.4, 0.4), steel, along.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), side), one = new THREE.Vector3(1, 1, 1);
  along.forEach((p, i) => {
    towers.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, p.y + H / 2, p.z), new THREE.Quaternion(), one));
    arms.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, p.y + H, p.z), q, one));
  });
  towers.castShadow = true;
  g.add(towers, arms);
  for (const s of [-2.8, 2.8]) {
    const rope = along.map((p) => new THREE.Vector3(p.x + side.x * s, p.y + H - 0.3, p.z + side.z * s));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rope), new THREE.LineBasicMaterial({ color: 0x2a2e35 })));
  }
  const house = new THREE.MeshStandardMaterial({ color: 0x9a6b45, roughness: 0.8 }), roof = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.6 });
  for (const p of [pts[0], pts[pts.length - 1]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 7), house); b.position.set(p.x, p.y + 2.5, p.z); b.castShadow = true;
    const r = new THREE.Mesh(new THREE.BoxGeometry(11, 0.8, 9), roof); r.position.set(p.x, p.y + 5.4, p.z);
    g.add(b, r);
  }
  // The name over the bottom station, always facing you.
  const c = document.createElement("canvas"), cx = c.getContext("2d"), label = `🚡 ${l.name}`;
  cx.font = "700 44px -apple-system, PingFang SC, sans-serif";
  c.width = Math.ceil(cx.measureText(label).width) + 48; c.height = 72;
  const ctx2 = c.getContext("2d");
  ctx2.fillStyle = "rgba(242,182,50,.95)"; ctx2.beginPath(); ctx2.roundRect(0, 0, c.width, 72, 36); ctx2.fill();
  ctx2.font = "700 44px -apple-system, PingFang SC, sans-serif"; ctx2.fillStyle = "#1d1606"; ctx2.textBaseline = "middle"; ctx2.fillText(label, 24, 38);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, fog: false }));
  tag.scale.set((c.width / 72) * 7, 7, 1);
  tag.position.set(pts[0].x, pts[0].y + 18, pts[0].z);
  tag.renderOrder = 5;
  g.add(tag);
  return g;
}

// ---------- Night: floodlit runs ----------
// Runs mapped as floodlit (lit=yes in OpenStreetMap: night skiing) get lamp posts along both sides every
// 45 m, a warm pool of light on the snow under each, and the rider is lit near them. Elsewhere at night
// only the lift stations are lit, and a faint light keeps the rider visible.
function floodlights(T, runs) {
  const spots = [];
  for (const run of runs) {
    if (!run.lit) continue;
    const pts = run.pts;
    let along = 0, next = 10, side = 1;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az);
      while (along + L >= next) {
        const t = (next - along) / L, x = ax + (bx - ax) * t, z = az + (bz - az) * t, dx = (bx - ax) / L, dz = (bz - az) / L;
        spots.push({ x: x - dz * side * 17, z: z + dx * side * 17, lx: x, lz: z });
        side = -side; next += 45;
      }
      along += L;
    }
  }
  const group = new THREE.Group();
  group.userData.spots = spots;
  if (!spots.length) return group;
  const n = spots.length, m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 10, 6), new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.6 }), n);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.45, 0.8), new THREE.MeshBasicMaterial({ color: 0xfff1c4 }), n);
  const dot = document.createElement("canvas"); dot.width = dot.height = 64;
  const g = dot.getContext("2d"), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "#fff"); grd.addColorStop(0.45, "#888"); grd.addColorStop(1, "#000");
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(46, 46).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd9a0, alphaMap: new THREE.CanvasTexture(dot), transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), n);
  spots.forEach((s, i) => {
    const h = T.heightAt(s.x, s.z);
    poles.setMatrixAt(i, m.compose(p.set(s.x, h + 5, s.z), q.identity(), one));
    heads.setMatrixAt(i, m.compose(p.set(s.x + (s.lx - s.x) * 0.06, h + 10, s.z + (s.lz - s.z) * 0.06), q.identity(), one));
    const px = (s.x + s.lx) / 2, pz = (s.z + s.lz) / 2;
    pools.setMatrixAt(i, m.compose(p.set(px, T.heightAt(px, pz) + 0.25, pz), q.setFromUnitVectors(up, T.normalAt(px, pz)), one));
  });
  poles.castShadow = true;
  for (const o of [poles, heads, pools]) { o.frustumCulled = false; group.add(o); }
  return group;
}

function build(ctx) {
  if (world) { scene.remove(world); world.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } }); }
  world = new THREE.Group();
  scene.add(world);
  const { T, R, line, spots, tex, far, rider } = ctx;
  seed = 7;

  // Light, sky and air.
  scene.background = null;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  // The real sun for the resort right now (as on the miniature), sky and light from it; the weather
  // greys it once it has loaded (ctx.applySky).
  const s0 = solar(new Date(), ctx.R.origin.lat, ctx.R.origin.lon), sunDir = sunVector(s0);
  const day = sunDir.y > 0.02, lightDir = day ? sunDir.clone() : new THREE.Vector3(0.3, 0.5, -0.4).normalize(); // moonlight at night
  const sky = new Sky();
    sky.scale.setScalar(20000);
    sky.material.uniforms.rayleigh.value = 2.2; // a deep, clean mountain blue
    sky.material.uniforms.mieCoefficient.value = 0.003;
    sky.material.uniforms.mieDirectionalG.value = 0.8;
    // What you see: the miniature's sky (sky.js palette), deep blue overhead, light at the horizon, the
    // sunset in its colours; the physical sky only lights the scene (its reflections).
    sky.visible = false;
    world.add(sky);
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(25000, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { sun: { value: new THREE.Vector3() }, top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, glow: { value: new THREE.Color() } },
      vertexShader: "varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `varying vec3 v; uniform vec3 sun, top, mid, hor, glow;
        void main(){ float h = clamp(v.y, -0.05, 1.0); vec3 c = mix(hor, mid, smoothstep(0.0, 0.16, h)); c = mix(c, top, smoothstep(0.16, 0.7, h));
          float s = max(dot(normalize(v), sun), 0.0); c += glow * (pow(s, 8.0) * 0.25 + pow(s, 600.0) * 1.2); gl_FragColor = vec4(c, 1.0); }`,
    }));
    skyDome.renderOrder = -1; skyDome.frustumCulled = false;
    world.add(skyDome);
  const skyEnv = { pm: new THREE.PMREMGenerator(renderer), scene: new THREE.Scene(), sky: new Sky() };
    skyEnv.sky.scale.setScalar(1000); skyEnv.scene.add(skyEnv.sky);
  scene.fog = new THREE.FogExp2(0xc6d6e8, 0.00016);
  const hemi = new THREE.HemisphereLight(0x9fc2ff, 0xb9b2a8, 0.55);
  world.add(hemi);
  sun = new THREE.DirectionalLight(0xfff1dd, 3.2);
  sun.userData.dir = lightDir;
  ctx.applySky = (kind = "clear") => {
    const p = palette((s0.el * 180) / Math.PI, kind);
    { const u = skyDome.material.uniforms; u.sun.value.copy(sunDir); u.top.value.copy(p.top); u.mid.value.copy(p.mid); u.hor.value.copy(p.hor); u.glow.value.copy(p.sun).multiplyScalar(kind === "clear" ? 1 : 0.3); }
    sky.material.uniforms.sunPosition.value.copy(sunDir);
    sky.material.uniforms.turbidity.value = { clear: 1.8, cloudy: 5, overcast: 12, snow: 14 }[kind];
    skyEnv.sky.material.uniforms.sunPosition.value.copy(sunDir);
    skyEnv.sky.material.uniforms.turbidity.value = sky.material.uniforms.turbidity.value;
    scene.environment?.dispose();
    scene.environment = skyEnv.pm.fromScene(skyEnv.scene).texture;
    scene.environmentIntensity = day ? 0.5 : 0.12;
    if (!snowing) { scene.fog.color.copy(p.hor).lerp(new THREE.Color(0xa9c6ea), kind === "clear" ? 0.45 : 0); scene.fog.density = { clear: 0.000075, cloudy: 0.00016, overcast: 0.00035, snow: 0.0009 }[kind]; }
    // Lit snow warm, shaded snow blue: a strong warm sun, and the fill from a blue sky.
    sun.color.copy(day ? p.sun : new THREE.Color(0x8fa6e0)).lerp(new THREE.Color(0xfff0d8), day ? 0.3 : 0);
    sun.intensity = day ? p.si * 1.15 : 0.5;
    hemi.intensity = p.amb + 0.12;
    renderer.toneMappingExposure = p.exp + 0.03;
  };
  ctx.applySky();
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 1, far: 900 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.6;
  world.add(sun, sun.target);
  if (snowing) setSnowyAir();
  // Night (the sun 2° to 8° under the horizon and lower): floodlit runs, lit lift stations, a light on
  // the rider that brightens near the lamps.
  ctx.night = clamp((-(s0.el * 180) / Math.PI - 2) / 6, 0, 1);
  if (ctx.night > 0) {
    const fl = floodlights(T, ctx.R.runs);
    world.add(fl);
    const glow = new THREE.PointLight(0xffe2b0, 0, 45, 1.2);
    world.add(glow);
    ctx.nightLights = { spots: fl.userData.spots, glow };
  }

  // Ground and far ranges.
  const groundMat = snowA(tex, true);
  shadeGround(ctx.groundGeo, T, ctx.mask, lightDir, day);
  const ground = new THREE.Mesh(ctx.groundGeo, groundMat);
  ground.receiveShadow = true;
  world.add(ground);
  const ranges = farTerrain(far, T);
  ranges.material = snowA(tex, true); // its colours: forest belts, rock
  world.add(ranges);

  // Runs near the lift.
  const runMat = new THREE.MeshStandardMaterial({ map: tex.cord, color: 0xffffff, roughness: 0.62, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const near = (pts) => pts.some(([x, z]) => line.up.some((g, i) => i % 25 === 0 && Math.hypot(g.x - x, g.z - z) < 1400));
  const drawn = new Set();
  // Groomed runs; more can be added later along the way down (see addRunsNear).
  ctx.addRunsNear = (test) => {
    for (const run of R.runs) {
      if (run.area || drawn.has(run) || !test(run.pts)) continue;
      drawn.add(run);
      const m = new THREE.Mesh(runRibbon(T, run.pts, 30, 0.03), runMat);
      m.receiveShadow = true;
      world.add(m);
    }
  };
  ctx.addRunsNear(near);

  // Forest: detailed spruce near the lift, simpler further out.
  const height = (s) => 13 + s.v * 13;
  {
    const branchMat = foliageMat(tex.branch, tex.branchSnow, true), crownMat = foliageMat(tex.crown, tex.crownSnow, false);
    const bark = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.95 });
    // Detailed trees near the line, simpler ones further out. Reused for the forest along a run.
    ctx.forest = (spots, near = 380) => {
      const g = new THREE.Group();
      for (const [list, detail] of [[spots.filter((s) => s.d < near), 1], [spots.filter((s) => s.d >= near), 0]]) {
        if (!list.length) continue;
        const tree = cardSpruce(detail);
        g.add(plant(list, tree.branches, branchMat, height), plant(list, tree.crown, crownMat, height), plant(list, tree.trunk, bark, height));
      }
      world.add(g);
      return g;
    };
    ctx.forest(spots);
    // Beyond the trees planted along the lift: the rest of the mountain's forest, low detail.
    const xs = line.ground.map((p) => p.x), zs = line.ground.map((p) => p.z), bx = [Math.min(...xs) - 850, Math.max(...xs) + 850, Math.min(...zs) - 850, Math.max(...zs) + 850];
    ctx.farSpots = farForest(T, ctx.mask, (x, z) => x > bx[0] && x < bx[1] && z > bx[2] && z < bx[3], coarse);
    ctx.forest(ctx.farSpots, -1);
  }

  // Lift: towers, ropes, terminals, chairs.
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x8b929c, metalness: 0.65, roughness: 0.42 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x23272e, metalness: 0.5, roughness: 0.5 });
  const tg = towerGeometries(line);
  const towers = new THREE.Mesh(tg.metal, metalMat);
  towers.castShadow = towers.receiveShadow = true;
  world.add(towers);
  if (tg.dark) { const d = new THREE.Mesh(tg.dark, darkMat); d.castShadow = true; world.add(d); }
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x2a2e35, metalness: 0.7, roughness: 0.35 });
  for (const path of [line.up, line.down]) world.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), path.length, 0.03, 5), ropeMat));
  const houseMats = { house: new THREE.MeshStandardMaterial({ color: 0x9a6b45, roughness: 0.8 }), roof: new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.6 }), metal: metalMat };
  const g0 = line.ground[0], g1 = line.ground[line.ground.length - 1];
  const altOf = (q) => Math.round(T.data.hmin + T.heightAt(q.x, q.z));
  // Chairs go up on the +side rope: at the bottom that is local +x, at the top (turned round) local -x.
  world.add(terminal(line.towers[0].p.clone(), line.dir, { ...houseMats, dark: darkMat }, { name: ctx.lift.name, alt: altOf(g0), top: false, upSide: 1 }));
  world.add(topTerm = terminal(line.towers[line.towers.length - 1].p.clone(), line.dir.clone().negate(), { ...houseMats, dark: darkMat }, { name: ctx.lift.name, alt: altOf(g1), top: true, upSide: -1 }));
  if (ctx.night > 0) for (const t of [line.towers[0].p, line.towers[line.towers.length - 1].p]) { // the stations are lit at night
    const l = new THREE.PointLight(0xffe7c2, 900 * ctx.night, 90, 1.5);
    l.position.copy(t).add(new THREE.Vector3(0, 9, 0));
    world.add(l);
  }

  const parts = ctx.chair;
  const chairMetal = metalMat;
  const padMat = new THREE.MeshStandardMaterial({ color: 0x1f2c47, roughness: 0.55 });
  const n = Math.floor(line.total / CHAIR_GAP);
  chairsUp = new THREE.InstancedMesh(parts.metal, chairMetal, n); padsUp = new THREE.InstancedMesh(parts.pad, padMat, n);
  chairsDown = new THREE.InstancedMesh(parts.metal, chairMetal, n); padsDown = new THREE.InstancedMesh(parts.pad, padMat, n);
  // Copper's signature blue bubbles: tinted, glossy, see-through.
  const bubbleMat = new THREE.MeshStandardMaterial({ color: CABIN ? 0xa9c4d8 : 0x2a6fe0, transparent: true, opacity: CABIN ? 0.22 : 0.42, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.5 });
  bubblesUp = new THREE.InstancedMesh(parts.bubble, bubbleMat, n); bubblesDown = new THREE.InstancedMesh(parts.bubble, bubbleMat, n);
  rimsUp = new THREE.InstancedMesh(parts.rim, rimMat, n); rimsDown = new THREE.InstancedMesh(parts.rim, rimMat, n);
  for (const m of [bubblesUp, bubblesDown]) { m.renderOrder = 2; m.frustumCulled = false; m.visible = HAS_BUBBLE; world.add(m); }
  for (const m of [rimsUp, rimsDown]) { m.frustumCulled = false; m.castShadow = true; m.visible = HAS_BUBBLE; world.add(m); }
  for (const m of [chairsUp, padsUp, chairsDown, padsDown]) { m.castShadow = true; m.frustumCulled = false; world.add(m); }
  myChair = new THREE.Group();
  myChair.add(new THREE.Mesh(parts.metal, chairMetal), new THREE.Mesh(parts.pad, padMat));
  myBubble = new THREE.Group();
  myBubble.add(new THREE.Mesh(parts.bubble, bubbleMat), new THREE.Mesh(parts.rim, rimMat));
  myBubble.matrixAutoUpdate = false;
  myBubble.children[0].renderOrder = 2;
  myBubble.visible = HAS_BUBBLE;
  myChair.add(myBubble);
  myChair.traverse((o) => { o.castShadow = o.receiveShadow = true; });
  rider.position.set(MY_SEAT, -2.95, 0.12);
  myChair.add(rider);
  world.add(myChair);
  if (!TRIP) $("desc").textContent = "画面样稿：半写实的云杉、压雪的雪道、真实的天空和远山";
}

// ---------- At the top: get off, rise above the summit, pick a run, dive back down to ski it ----------
const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const LEVEL_COLOR = { easy: 0x22b35a, intermediate: 0x1f6fe5, advanced: 0x15171c, expert: 0x15171c };
const LEVEL_MARK = { easy: '<i class="lv easy"></i>', intermediate: '<i class="lv intermediate"></i>', advanced: '<i class="lv advanced"></i>', expert: '<i class="lv expert"></i>' };
const LEVEL_ZH = { easy: "绿道", intermediate: "蓝道", advanced: "黑道", expert: "双黑" };
const ROUTE_GOLD = 0xf2b632;
const fmtLen = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} 公里` : `${Math.round(m)} 米`);
const fmtMin = (s) => `${Math.max(1, Math.round(s / 60))} 分钟`;
// At the top: get off, rise above the summit, and plan where to go — a base, the next lift, or just a run.
function topOfLift({ T, R, lift, line, ctx, getChair }) {
  const st = { phase: null, t0: 0, focus: new THREE.Vector3(), pick: null };
  const g1 = line.ground[line.ground.length - 1];
  const myLevel = (() => { try { const l = JSON.parse(localStorage.getItem("prerun") || "{}").level; return LEVELS.includes(l) ? l : "intermediate"; } catch { return "intermediate"; } })();
  const bigLift = (l) => l.kind !== "magic_carpet" && (l.rise ?? 100) >= 40;
  const bases = R.places.filter((p) => p.kind === "village");
  const graph = buildGraph(R, (x, z) => T.heightAt(x, z));
  const fromTop = [graph.liftNodes.get(lift).top];

  // A plan: the legs from this top; the downhill part (skied now, up to the first lift) as one path.
  function makePlan(legs, extra) {
    const first = legs.findIndex((l) => l.type === "lift");
    const path = [], segs = [];
    for (const l of first < 0 ? legs : legs.slice(0, first)) {
      if (l.type !== "run") continue;
      if (!segs.length || segs[segs.length - 1].run.name !== l.run.name || !l.run.name) segs.push({ at: Math.max(0, path.length - 1), run: l.run });
      for (const p of l.run.pts.slice(l.from, l.to + 1)) { const q = path[path.length - 1]; if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.5) path.push(p); }
    }
    if (path.length < 2) return null;
    const dist = [0], hs = path.map(([x, z]) => T.heightAt(x, z));
    for (let i = 1; i < path.length; i++) dist.push(dist[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    let steep = 0;
    for (let i = 0, j = 0; i < path.length; i++) { while (j < i && dist[i] - dist[j] > 25) j++; if (dist[i] - dist[j] > 10) steep = Math.max(steep, Math.atan2(hs[j] - hs[i], dist[i] - dist[j])); }
    const levels = legs.filter((l) => l.type === "run").map((l) => LEVELS.indexOf(l.run.level));
    // The steps to show: runs (same name merged) and lifts; skates are just a few metres across.
    const steps = [];
    for (const l of legs) {
      const name = l.type === "lift" ? l.lift.name : l.type === "run" ? l.run.name || "无名雪道" : null;
      if (!name) continue;
      const lastStep = steps[steps.length - 1];
      if (lastStep && lastStep.type === l.type && lastStep.name === name) continue;
      steps.push({ type: l.type, name, level: l.run?.level });
    }
    return { legs, path, dist, hs, segs, steps, steep: Math.round((steep * 180) / Math.PI), length: dist[dist.length - 1], drop: Math.round(hs[0] - Math.min(...hs)),
      hardest: LEVELS[Math.max(0, ...levels)], next: first >= 0 ? legs[first].lift : null, flats: flatsOf(path, dist, hs, segs), ...extra };
  }
  // Where a snowboard slows on the way: flats (under about 4 degrees for 120 m or more: carry speed, keep
  // the board flat, maybe skate) and rises (you'll walk), with the run they're on and how far along.
  function flatsOf(path, dist, hs, segs) {
    const n = path.length, grade = new Float32Array(n), out = [];
    for (let k = 0; k < n; k++) {
      let a = k, b = k; while (a > 0 && dist[k] - dist[a] < 36) a--; while (b < n - 1 && dist[b] - dist[k] < 36) b++;
      grade[k] = (hs[a] - hs[b]) / Math.max(1, dist[b] - dist[a]);
    }
    for (const [kind, test, least] of [["up", (g) => g < -0.01, 25], ["flat", (g) => g >= -0.01 && g < 0.07, 120]]) {
      for (let k = 0; k < n; k++) {
        if (!test(grade[k])) continue;
        let e = k; while (e + 1 < n && test(grade[e + 1])) e++;
        const m = dist[e] - dist[k];
        if (m >= least) { const seg = segs.filter((g) => g.at <= k).pop() || segs[0]; out.push({ a: k, b: e, m: Math.round(m), kind, run: seg.run, at: Math.round(dist[k]) }); }
        k = e;
      }
    }
    return out.sort((x, y) => x.a - y.a);
  }
  const plan = (to) => {
    for (const lv of LEVELS.slice(LEVELS.indexOf(myLevel))) {
      const rt = planRoute(graph, fromTop, to, lv);
      if (rt) return { rt, harder: lv !== myLevel ? lv : null };
    }
    return null;
  };
  // Where to go: each base, and each lift you can ski over to.
  const dests = [];
  for (const b of bases) {
    const to = nodesNear(graph, b.x, b.z, 220), r = plan(to);
    const p = r && makePlan(r.rt.legs, { to, kind: "base", key: `base:${b.name}`, title: `回 ${b.name}`, short: b.name, icon: "🏠", seconds: r.rt.seconds, harder: r.harder, end: [b.x, b.z], base: b });
    if (p) dests.push(p);
  }
  const liftDests = [];
  for (const l of R.lifts) {
    if (!bigLift(l)) continue;
    const r = plan([graph.liftNodes.get(l).bottom]);
    if (!r || r.rt.legs.some((g) => g.type === "lift") || r.rt.seconds > 20 * 60) continue;
    const p = makePlan(r.rt.legs, { to: [graph.liftNodes.get(l).bottom], kind: "lift", key: `lift:${l.name}`, title: l === lift ? `再坐一趟 ${l.name}` : `接 ${l.name} 缆车`, short: l.name, icon: "🚡", seconds: r.rt.seconds, harder: r.harder, end: l.pts[0], lift: l });
    if (p) liftDests.push(p);
  }
  // A lift that leaves from a base is the same place as that base: one option, "there you can ride X".
  for (const p of liftDests) {
    const b = dests.find((d) => d.base && Math.hypot(d.base.x - p.end[0], d.base.z - p.end[1]) < 350);
    if (b) (b.lifts ||= []).push(p.short);
    else dests.push(p);
  }
  // What a spot at the bottom of a run leads to: lifts that leave from there, or a base.
  const leadsTo = ([x, z]) => {
    const ls = R.lifts.filter((l) => bigLift(l) && Math.hypot(l.pts[0][0] - x, l.pts[0][1] - z) < 260).map((l) => l.name);
    const b = bases.find((b) => Math.hypot(b.x - x, b.z - z) < 450);
    return { lifts: ls, base: b && b.name };
  };
  // Runs that start at this lift's top, the longest of each name.
  const byName = new Map();
  R.runs.forEach((r) => {
    if (!r.name || r.area || Math.hypot(r.pts[0][0] - g1.x, r.pts[0][1] - g1.z) > 200) return;
    if (!byName.has(r.name) || byName.get(r.name).length < r.length) byName.set(r.name, r);
  });
  // A run on its own often ends in the middle of the mountain: carry on (any level) to the nearest lift or base.
  const liftBottoms = R.lifts.filter(bigLift).map((l) => graph.liftNodes.get(l).bottom);
  const runs = [...byName.values()].sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || b.length - a.length)
    .map((r) => {
      const legs = [{ type: "run", run: r, from: 0, to: r.pts.length - 1, length: r.length }];
      let end = r.pts[r.pts.length - 1], leads = leadsTo(end), seconds = r.length / 7;
      if (!leads.lifts.length && !leads.base) {
        const rt = planRoute(graph, [graph.runNodes.get(r).at(-1)], [...liftBottoms, ...bases.flatMap((b) => nodesNear(graph, b.x, b.z, 220))], myLevel)
          || planRoute(graph, [graph.runNodes.get(r).at(-1)], liftBottoms);
        if (rt && !rt.legs.some((g) => g.type === "lift")) { legs.push(...rt.legs); end = [rt.end.x, rt.end.z]; leads = leadsTo(end); seconds += rt.seconds; }
      }
      const to = nodesNear(graph, end[0], end[1], 60);
      return makePlan(legs, { to, kind: "run", key: `run:${r.name}`, title: r.name, icon: "", seconds, end, leads, first: r });
    })
    .filter(Boolean);
  const wantKey = params.get("to");
  let mode = runs.length && !dests.length ? "runs" : "dest";
  if (wantKey?.startsWith("run:")) mode = "runs";

  // Where trees already stand: around the lift from the start, and the overview area once planted.
  const boxes = [];
  const boxOf = (xs, zs, M) => [Math.min(...xs) - M, Math.max(...xs) + M, Math.min(...zs) - M, Math.max(...zs) + M];
  boxes.push(boxOf(line.ground.map((p) => p.x), line.ground.map((p) => p.z), 900));
  const planted = (x, z) => boxes.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  // Trees you can hit: every tree planted so far, in a 10 m grid.
  const treeGrid = new Map(), TG = 10, tkey = (x, z) => `${Math.floor(x / TG)},${Math.floor(z / TG)}`;
  const addTrees = (list) => { for (const t of list) { const k = tkey(t.x, t.z); if (!treeGrid.has(k)) treeGrid.set(k, []); treeGrid.get(k).push(t); } };
  addTrees(ctx.spots); addTrees(ctx.farSpots || []);
  if (ctx.forest) { const plantForest = ctx.forest; ctx.forest = (list, near) => { addTrees(list); return plantForest(list, near); }; }
  const treeAt = (x, z, rad) => {
    let best = null, bd = rad * rad;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const t of treeGrid.get(`${Math.floor(x / TG) + i},${Math.floor(z / TG) + j}`) || []) {
      const d = (t.x - x) ** 2 + (t.z - z) ** 2; if (d < bd) { bd = d; best = t; }
    }
    return best;
  };
  // ---- Skiing the chosen plan: real slope physics, guided along the route. You choose where on the piste
  // to ride (slide a finger left or right) and how fast (drag up to slow, down to let it run); the way
  // itself is always the route's, so you can't get lost. Leave it alone and the rider links easy turns.
  let phys = null, tracks = null, spray = null, prog = 0, auto = false, latIn = 0, paceIn = 0, touching = false, idleFor = 9, ended = false;
  let alerted = null; // the junction already announced (and how close)
  const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const pathDir = (pts, i) => { const a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)]; return Math.atan2(b[0] - a[0], b[1] - a[1]); };
  const nearestOn = (pts, x, z, from, to) => { let best = Infinity, bi = from; for (let i = from; i <= to; i++) { const d = (pts[i][0] - x) ** 2 + (pts[i][1] - z) ** 2; if (d < best) { best = d; bi = i; } } return { i: bi, d: Math.sqrt(best) }; };
  // ---- Hike-to terrain from this lift's top (data/hikes.json; Highland Bowl so far): on foot with the board
  // carried, up the ridge as a quick time-lapse to the summit's prayer flags, then down a line of the bowl.
  let hike = null, hk = null;
  const HIKE_GEAR = ["能挂板的背包或板带", "多带水", "能量棒", "保暖中间层", "备用手套", "雪镜和墨镜", "防晒", "救援三件套（建议）"];
  fetch("data/hikes.json").then((x) => x.json()).then((h) => { hike = (h[RESORT] || []).find((x) => x.from === lift.name && x.summit && x.down) || null; }).catch(() => {});
  function hikePath() {
    // Each line of the bowl once: of the pieces with a name, the one that starts highest.
    const byName = new Map();
    for (const r of R.runs) if (hike.down.includes(r.name) && !r.area && r.pts.length > 4) { const o = byName.get(r.name); if (!o || T.heightAt(...r.pts[0]) > T.heightAt(...o.pts[0])) byName.set(r.name, r); }
    const down = hike.down.map((n) => byName.get(n)).filter(Boolean);
    if (!down.length) return null;
    let top = down[0].pts[0]; for (const r of down) if (T.heightAt(...r.pts[0]) > T.heightAt(...top)) top = r.pts[0];
    // The summit: the highest ground near the bowl's highest line.
    let sx = top[0], sz = top[1], sh = T.heightAt(sx, sz);
    for (let dx = -250; dx <= 250; dx += 15) for (let dz = -250; dz <= 250; dz += 15) { const h = T.heightAt(top[0] + dx, top[1] + dz); if (h > sh) { sh = h; sx = top[0] + dx; sz = top[1] + dz; } }
    const a = ctx.rider.position, L = Math.hypot(sx - a.x, sz - a.z) || 1, n = Math.max(8, Math.round(L / 12)), ux = (sx - a.x) / L, uz = (sz - a.z) / L;
    let pts = [];
    for (let i = 0; i <= n; i++) {
      // Keep to the ridge: the highest ground across the straight line (less far out near the ends).
      const t = i / n, bx = a.x + (sx - a.x) * t, bz = a.z + (sz - a.z) * t, reach = 90 * Math.sin(Math.PI * t);
      let best = [bx, bz], bh = -Infinity;
      for (let o = -reach; o <= reach; o += 6) { const x = bx - uz * o, z = bz + ux * o, h = T.heightAt(x, z) - Math.abs(o) * 0.05; if (h > bh) { bh = h; best = [x, z]; } }
      pts.push(best);
    }
    for (let it = 0; it < 4; it++) pts = pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p : [(pts[i - 1][0] + p[0] * 2 + pts[i + 1][0]) / 4, (pts[i - 1][1] + p[1] * 2 + pts[i + 1][1]) / 4]));
    return { pts, summit: [sx, sz], down };
  }
  // Prayer flags strung between two poles on the summit.
  function prayerFlags(x, z) {
    const g = new THREE.Group(), cols = [0x2f6fd6, 0xf4f4f0, 0xc8452f, 0x3fa34d, 0xe8b830], ends = [[x - 6, z - 2], [x + 6, z + 3]];
    const top = ends.map(([px, pz]) => T.heightAt(px, pz) + 3.2);
    for (const [k, [px, pz]] of ends.entries()) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2), new THREE.MeshStandardMaterial({ color: 0x5a4636 })); pole.position.set(px, top[k] - 1.6, pz); g.add(pole); }
    for (let k = 0; k < 14; k++) {
      const t = (k + 0.5) / 14, f = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.62), new THREE.MeshStandardMaterial({ color: cols[k % 5], side: THREE.DoubleSide, roughness: 0.9 }));
      f.position.set(ends[0][0] + 12 * t, top[0] + (top[1] - top[0]) * t - Math.sin(Math.PI * t) * 0.8 - 0.35, ends[0][1] + 5 * t);
      f.rotation.y = Math.atan2(12, 5) - Math.PI / 2; f.userData.k = k; g.add(f);
    }
    return g;
  }
  function startHike() {
    const hp = hike && hikePath(); if (!hp) return;
    hk = { ...hp, d: 0, dist: [0], flags: prayerFlags(...hp.summit) };
    for (let i = 1; i < hp.pts.length; i++) hk.dist.push(hk.dist[i - 1] + Math.hypot(hp.pts[i][0] - hp.pts[i - 1][0], hp.pts[i][1] - hp.pts[i - 1][1]));
    world.add(hk.flags);
    addStep(RESORT, { k: "hike", name: hike.name, mins: hike.mins, gain: hike.gain || 0, gear: HIKE_GEAR });
    camera.fov = 60; camera.updateProjectionMatrix();
    $("liftOffer").hidden = true; $("guide").hidden = true; closeBigMap();
    document.body.classList.remove("picking"); camera.clearViewOffset();
    for (const m of [...marks.children]) { marks.remove(m); m.geometry.dispose(); }
    routeMarks = []; reveal = null; clearTags();
    // The mountain around the ridge, as for a way down.
    const path = hp.pts;
    for (const l of R.lifts) {
      if (liftsShown.has(l) || l.kind === "magic_carpet" || l.pts.length < 2) continue;
      if (!l.pts.some(([x, z]) => path.some(([rx, rz]) => Math.hypot(rx - x, rz - z) < 900))) continue;
      liftsShown.add(l); world.add(otherLift(T, l));
    }
    ctx.forest(treeSpots(T, R, ctx.mask, { ground: path.map(([x, z]) => ({ x, z })) }, 450, 0, planted), 300);
    boxes.push(boxOf(path.map((p) => p[0]), path.map((p) => p[1]), 400));
    ctx.addRunsNear((pts) => pts.some(([x, z]) => path.some(([rx, rz]) => Math.hypot(rx - x, rz - z) < 700)));
    $("pick").hidden = true;
    $("liftName").textContent = `🥾 ${hike.zh}`;
    st.phase = "hike";
    flash();
  }
  function stepHike(dt) {
    const total = hk.dist[hk.dist.length - 1];
    hk.d = Math.min(total, hk.d + dt * 4.2); // a time-lapse: a walk of most of an hour in a couple of minutes
    let i = 1; while (i < hk.dist.length - 1 && hk.dist[i] < hk.d) i++;
    const u = (hk.d - hk.dist[i - 1]) / Math.max(1e-3, hk.dist[i] - hk.dist[i - 1]), [ax, az] = hk.pts[i - 1], [bx, bz] = hk.pts[i];
    const x = ax + (bx - ax) * u, z = az + (bz - az) * u, h = Math.atan2(bx - ax, bz - az), y = T.heightAt(x, z);
    const rd = ctx.rider;
    rd.position.set(x, y, z); rd.quaternion.identity(); rd.rotation.set(0, h, 0);
    hikeBoarder(rd, hk.d / 0.9);
    // The camera off to the side and above: the view is the point of the walk.
    const side = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h)), back = new THREE.Vector3(-Math.sin(h), 0, -Math.cos(h));
    const want = new THREE.Vector3(x, y, z).addScaledVector(back, 9).addScaledVector(side, 5); want.y = Math.max(T.heightAt(want.x, want.z) + 2, y + 4.5);
    camera.position.lerp(want, Math.min(1, dt * 2.5));
    camera.lookAt(x + Math.sin(h) * 14, y + 1.5, z + Math.cos(h) * 14);
    const left = total - hk.d, alt = Math.round(T.data.hmin + y);
    $("desc").textContent = `海拔 ${alt.toLocaleString("en-US")} 米 · 还有 ${fmtLen(left)} 到顶 · 实际约 ${hike.mins[0]}–${hike.mins[1]} 分钟，这里快放`;
    for (const f of hk.flags.children) if (f.userData.k != null) f.rotation.z = Math.sin(clock() / 300 + f.userData.k) * 0.25; // flags in the wind
    if (hk.d >= total && !hk.top) {
      hk.top = true;
      $("arriveTitle").textContent = `到顶了 · ${alt.toLocaleString("en-US")} 米`;
      $("arriveNote").textContent = "经幡在风里响。从碗里选一条滑下去：";
      $("arriveRow").innerHTML = hk.down.map((r, k) => `<button class="btn${k ? "" : " go"}" data-k="${k}">${LEVEL_MARK[r.level]}${r.name} ›</button>`).join("");
      for (const b of $("arriveRow").querySelectorAll("button")) b.onclick = () => startBowl(hk.down[+b.dataset.k]);
      $("arrive").hidden = false;
    }
  }
  function startBowl(run) {
    const end = run.pts[run.pts.length - 1];
    chosen = makePlan([{ type: "run", run, from: 0, to: run.pts.length - 1, length: run.length }], { kind: "run", key: `run:${run.name}`, title: run.name, short: run.name, icon: "", end, leads: leadsTo(end), first: run });
    if (!chosen) return;
    $("arrive").hidden = true; hk = null;
    bookRoute(chosen);
    $("liftName").innerHTML = `${LEVEL_MARK[run.level]}${run.name}`;
    startSki();
  }
  function startSki() {
    const P = chosen, path = P.path;
    camera.fov = 66; camera.updateProjectionMatrix(); // a wider view on the snow
    setTimeout(() => { if (st.phase === "ski") makeSprite(); }, 1000); // as dressed now
    if (guide) guide.visible = true;
    setTimeout(showTrickBtn, 0);
    origPlan = P; offered = new Set(); offer = null; $("liftOffer").hidden = true; $("guide").hidden = true; closeBigMap();
    document.body.classList.remove("picking");
    camera.clearViewOffset();
    // Keep the route on the snow, faint, as the line to follow.
    for (const m of [...marks.children]) { marks.remove(m); m.geometry.dispose(); }
    routeMarks = []; reveal = null;
    clearTags();
    dress(P);
    phys = new Rider(T);
    // Start a little way down, clear of the top station.
    let i0 = 0;
    while (i0 < path.length - 2 && P.dist[i0] < 25) i0++;
    phys.place(path[i0][0], path[i0][1], pathDir(path, i0), 2);
    const h0 = pathDir(path, i0);
    camera.position.set(phys.x - Math.sin(h0) * 7, phys.y + 3, phys.z - Math.cos(h0) * 7);
    tracks?.dispose(scene);
    tracks = new Tracks(scene, T);
    spray ||= new Spray(scene);
    latIn = 0; paceIn = 0; idleFor = 9; alerted = null;
    prog = i0; ended = false;
    st.phase = "ski";
    $("skiHud").hidden = false;
    $("minimap").hidden = false;
    $("liftName").innerHTML = P.kind === "run" ? `${LEVEL_MARK[P.first.level]}${P.title}` : `${P.icon} ${P.title}`;
    tilt.zero = null; // the way you hold the phone now is "straight on"
    $("desc").textContent = tilt.ok ? "沿路线带你滑 · 手机左右倾转弯 · 往前倾加速、往回倒减速" : "沿路线自动带你滑 · 左右滑动换位置 · 往上拖减速、往下拖加速";
    if (ctx.night > 0.5) { // at night: say where the lights are
      const lit = [...new Set(R.runs.filter((x) => x.lit && x.name).map((x) => x.name))];
      const onRoute = P.segs.some((g) => g.run.lit);
      $("desc").textContent = "🌙 " + (lit.length ? (onRoute ? "夜场：这条路线上有亮灯的雪道" : `夜场只开 ${lit.slice(0, 4).join("、")}，这条路线没有灯`) : "现在是夜里，这个雪场没有夜场灯光");
    }
  }
  // The way down, made findable: forest and runs along it, a sign at every junction saying where each
  // way goes (the route's in gold), chevrons on the snow before each turn, and the minimap.
  let nav = null, offFor = 0, lastLook = 0, onRun = null;
  // The map in the corner while skiing: a small square of the trail map (mapview.js), north up, your route
  // in gold, you as your rider's portrait. Tap it for the full map: pan, pinch, tap a place, and confirm to
  // start from there (a run) or ride it (a lift). Skiing waits while the map is open.
  const tmap = new TrailMap(T, R, ctx.mask, R.places.filter((p) => p.kind === "village"));
  let tmapAt = 0, mapOpen = false, mapUp = null, journal = false;
  // What you've skied here (skilog.js), shown on the journal map.
  const skiLog = new SkiLog(RESORT, R);
  st.log = skiLog; // testing
  st.hud = () => {
    if (st.phase !== "ski" || !phys || ended || mapOpen || clock() - tmapAt < 60) return;
    tmapAt = clock();
    const cv = $("minimap"), dpr = cv.width / 128;
    // Turned with you, the way ahead up (eased, so the map doesn't swing with every wiggle).
    mapUp = mapUp == null ? phys.heading : mapUp + angleDiff(phys.heading, mapUp) * 0.15; // here angleDiff is a - b
    const route = chosen.path.slice(Math.max(0, prog - 1)), t = clock() / 1000;
    if (planetMap) {
      // A wider flat map around you, wrapped onto a little planet, you on top.
      planetSrc ||= Object.assign(document.createElement("canvas"), { width: 256, height: 256 });
      tmap.view(planetSrc, { cx: phys.x, cz: phys.z, zoom: 0.17, route, skied: plStretches, t, dpr: 2, up: mapUp });
      tmap.planet(cv, planetSrc);
      tmap.drawYou(cv.getContext("2d"), cv.width / 2, cv.height / 2 + 10 * dpr, Math.PI, t, dpr, 44 * dpr);
    } else tmap.view(cv, { cx: phys.x, cz: phys.z, zoom: 0.32, route, you: { x: phys.x, z: phys.z, heading: phys.heading }, t, dpr, up: mapUp });
  };
  // The corner map's look: flat, or a little planet (set in the menu, kept on this phone).
  let planetMap = localStorage.getItem("prerunMapStyle") === "planet", planetSrc = null, plStretches = [];
  const setMapStyle = (planet) => { planetMap = planet; $("minimap").classList.toggle("planet", planet); try { localStorage.setItem("prerunMapStyle", planet ? "planet" : "flat"); } catch {} };
  setMapStyle(planetMap);
  setInterval(() => { if (planetMap && st.phase === "ski") plStretches = skiLog.stretches(); }, 4000);
  // The menu (☰): everywhere you can go from here.
  function openMenu() {
    const box = $("menu"), ski = st.phase === "ski" && phys && !ended;
    const item = (icon, label, sub, act, on = true) => on ? `<button class="opt" data-act="${act}">${icon} ${label}${sub ? `<small>${sub}</small>` : ""}</button>` : "";
    box.innerHTML = `<h2>菜单 <button aria-label="关闭">×</button></h2>${navRow()}<div class="opts">
      ${item("🗺", "雪场地图", "看全图，选从哪里出发", "map", ski)}
      ${item("📜", "预滑路书", "这一趟怎么走的，明天照着走", "book")}
      ${item("📖", "滑雪记录", "这个雪场你滑过的地方", "log", !!phys)}
      ${item(planetMap ? "🗺" : "🪐", planetMap ? "小地图改回平面" : "小地图换成小星球", "右上角的小地图样式", "style")}
      ${item("🏔", "回沙盘", R.name, "sandbox")}
      ${item("⚙", "设置", "语言", "settings")}
    </div>`;
    box.querySelector("h2 button").onclick = () => (box.hidden = true);
    box.querySelectorAll(".opt").forEach((b) => (b.onclick = () => {
      box.hidden = true;
      ({ map: openBigMap, log: openJournal, book: () => openBookPage(RESORT, { name: R.name, drawMap: paintWith(tmap) }), style: () => setMapStyle(!planetMap), sandbox: () => (location.href = withResort("mountain/")), settings: openSettings })[b.dataset.act]();
    }));
    box.hidden = false;
  }
  $("menuBtn").onclick = openMenu;
  const bm = { cx: 0, cz: 0, zoom: 0.2, pin: null, choice: null, ptrs: new Map(), moved: 0, pinch: null };
  const bigCv = $("bigMap").querySelector("canvas");
  function drawBig() {
    if (!mapOpen) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (bigCv.width !== Math.round(innerWidth * dpr)) { bigCv.width = Math.round(innerWidth * dpr); bigCv.height = Math.round(innerHeight * dpr); }
    if (journal) tmap.view(bigCv, { cx: bm.cx, cz: bm.cz, zoom: bm.zoom, skied: bm.skied, track: skiLog.track, you: { x: phys.x, z: phys.z, heading: phys.heading }, t: performance.now() / 1000, dpr });
    else tmap.view(bigCv, { cx: bm.cx, cz: bm.cz, zoom: bm.zoom, route: chosen.path.slice(Math.max(0, prog - 1)), skied: bm.skied, you: { x: phys.x, z: phys.z, heading: phys.heading }, pin: bm.pin, t: performance.now() / 1000, dpr });
    requestAnimationFrame(drawBig);
  }
  function openBigMap() {
    if (st.phase !== "ski" || !phys || ended) return;
    journal = false; bm.skied = skiLog.stretches();
    $("bigMap").querySelector(".bar b").textContent = "🗺 雪场地图 · 点一个地方，选从哪里出发";
    mapOpen = true; bm.cx = phys.x; bm.cz = phys.z; bm.zoom = 0.22; bm.pin = null;
    $("bigMap").querySelector(".pickCard").hidden = true;
    $("bigMap").hidden = false;
    drawBig();
  }
  const closeBigMap = () => { mapOpen = false; $("bigMap").hidden = true; };
  // The journal: the whole resort with everything you've skied here in ink, your last ride dashed, and
  // how much of the mountain you've covered.
  function openJournal() {
    if (!phys) return;
    skiLog.save();
    journal = true; bm.skied = skiLog.stretches(); bm.pin = null;
    const s = skiLog.stats(), xs = [], zs = [];
    for (const seg of bm.skied) for (const [x, z] of seg) { xs.push(x); zs.push(z); }
    for (const [x, z] of skiLog.track) { xs.push(x); zs.push(z); }
    if (!xs.length) { xs.push(phys.x); zs.push(phys.z); }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    bm.cx = (x0 + x1) / 2; bm.cz = (z0 + z1) / 2; bm.zoom = clamp(Math.min(innerWidth / (x1 - x0 + 600), innerHeight / (z1 - z0 + 900)), 0.06, 0.5);
    $("bigMap").querySelector(".bar b").innerHTML = `📖 滑雪记录<br><small style="font-weight:500">滑过 ${s.touched}/${s.runs} 条雪道 · 约 ${s.km.toFixed(1)} 公里 · 雪场的 ${Math.round(s.share * 100)}%</small>`;
    const card = $("bigMap").querySelector(".pickCard");
    card.innerHTML = `<b>红线是你滑过的地方，虚线是这一趟</b><small>${s.share >= 1 ? "🌸 整个雪场都滑遍了！" : `还有 ${s.runs - s.touched} 条雪道没去过，下次去打卡吧`}</small>`;
    card.hidden = false;
    mapOpen = true; $("bigMap").hidden = false; drawBig();
  }
  st.journal = openJournal;
  $("minimap").onclick = openBigMap;
  $("mapClose").onclick = closeBigMap;
  $("mapMe").onclick = () => { bm.cx = phys.x; bm.cz = phys.z; };
  $("mapMore").onclick = () => { closeBigMap(); openReplan(); };
  $("mapLog").onclick = () => (journal ? openBigMap() : openJournal());
  // Drag to pan, pinch to zoom, tap to choose.
  bigCv.addEventListener("pointerdown", (e) => { bm.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); bm.moved = 0; if (bm.ptrs.size === 2) { const [a, b] = [...bm.ptrs.values()]; bm.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: bm.zoom }; } });
  bigCv.addEventListener("pointermove", (e) => {
    const p = bm.ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (bm.ptrs.size === 2 && bm.pinch) { const [a, b] = [...bm.ptrs.values()]; bm.zoom = clamp(bm.pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / bm.pinch.d, 0.05, 1.2); bm.moved += 99; return; }
    bm.moved += Math.abs(dx) + Math.abs(dy);
    bm.cx -= dx / bm.zoom; bm.cz -= dy / bm.zoom;
  });
  const ptrUp = (e) => {
    const was = bm.ptrs.has(e.pointerId); bm.ptrs.delete(e.pointerId); if (bm.ptrs.size < 2) bm.pinch = null;
    if (!was || bm.moved > 8 || bm.ptrs.size || journal) return;
    const x = bm.cx + (e.clientX - innerWidth / 2) / bm.zoom, z = bm.cz + (e.clientY - innerHeight / 2) / bm.zoom;
    const c = mapChoice(x, z), card = $("bigMap").querySelector(".pickCard");
    if (!c) { bm.pin = null; card.hidden = false; card.innerHTML = "<b>那里没有雪道</b><small>点一条雪道或者一条缆车</small>"; return; }
    bm.pin = c.at; bm.choice = c;
    card.innerHTML = `<b>${c.label}</b><small>${c.sub}</small><div class="two"><button class="no">取消</button><button class="go">${c.lift ? "去坐 ›" : "从这里出发 ›"}</button></div>`;
    card.querySelector(".no").onclick = () => { card.hidden = true; bm.pin = null; };
    card.querySelector(".go").onclick = () => { closeBigMap(); goTo(c); };
    card.hidden = false;
  };
  bigCv.addEventListener("pointerup", ptrUp); bigCv.addEventListener("pointercancel", (e) => { bm.ptrs.delete(e.pointerId); bm.pinch = null; });
  bigCv.addEventListener("wheel", (e) => { e.preventDefault(); bm.zoom = clamp(bm.zoom * (e.deltaY < 0 ? 1.15 : 0.87), 0.05, 1.2); }, { passive: false });
  const distToLine = (pts, x, z) => {
    let d = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      d = Math.min(d, Math.hypot(ax + dx * t - x, az + dz * t - z));
    }
    return d;
  };
  // What a tap on the map means: the nearest lift line (to ride it) or run (to start there).
  function mapChoice(x, z) {
    const tol = 22 / bm.zoom; // about a fingertip, in metres at this zoom
    const l = R.lifts.filter((l) => rideable(l)).map((l) => ({ l, d: distToLine(l.pts, x, z) })).sort((a, b) => a.d - b.d)[0];
    const spot = runNear(x, z, tol * 1.4), runD = spot ? Math.hypot(spot.run.pts[spot.i][0] - x, spot.run.pts[spot.i][1] - z) : Infinity;
    if (l && l.d < tol && (l.d < tol * 0.5 || l.d < runD * 0.8)) return { lift: l.l, at: l.l.pts[0], label: `🚡 去坐 ${l.l.name}`, sub: "滑到缆车站，坐上去" };
    if (spot) return { spot, at: spot.run.pts[spot.i], label: `从 ${LEVEL_TXT_ICON[spot.run.level] || ""}${spot.run.name || "这条雪道"} 出发`, sub: `在这里重新出生，接着去 ${chosen.short || chosen.title}` };
    return null;
  }
  const LEVEL_TXT_ICON = { easy: "🟢 ", intermediate: "🟦 ", advanced: "◆ ", expert: "◆◆ " };
  // The roadbook: each way down as a step (the runs in order, the lift at the bottom, the path for its map).
  const bookRoute = (P, changed = false) => addStep(RESORT, { k: "route", changed, title: P.title, segs: P.segs.map((g) => ({ n: g.run.name || "无名雪道", l: g.run.level })), next: P.next?.name || null, path: thinPath(P.path),
    flats: P.flats.map((f) => ({ n: f.run.name || "无名雪道", m: f.m, k: f.kind, at: f.at })) });
  // Skipping ahead with a tap on the map: the way from here to there along the chosen route counts as
  // seen, so it goes in the log as skied.
  function markAlong(x, z) {
    const path = chosen?.path; if (!path || !phys || prog >= path.length - 1) return;
    const to = nearestOn(path, x, z, prog, path.length - 1);
    if (to.d > 150) return;
    for (let i = prog; i <= to.i; i++) { const s = runNear(path[i][0], path[i][1], 26); if (s) skiLog.mark(s.run, s.i); }
    skiLog.save();
  }
  function goTo(c) {
    if (c.lift) { markAlong(...c.at); addStep(RESORT, { k: "jump", to: `${c.lift.name} 底站` }); location.href = withResort(`look.html?lift=${encodeURIComponent(c.lift.name)}`); return; }
    goToMapPoint(...c.at, c.spot);
  }
  function goToMapPoint(x, z, spot = runNear(x, z, 120)) {
    if (!phys || !spot) return;
    markAlong(x, z);
    addStep(RESORT, { k: "jump", to: spot.run.name || "一条雪道" });
    const run = spot.run, [sx, sz] = run.pts[spot.i], i2 = Math.min(run.pts.length - 1, spot.i + 2);
    phys.place(sx, sz, Math.atan2(run.pts[i2][0] - sx, run.pts[i2][1] - sz), 3);
    const from = nodesNear(graph, sx, sz, 120), P = chosen;
    let Q = null;
    const rt = from.length && P.to?.length && planFrom(from, P.to);
    if (rt) {
      const { kind, key, title, short, icon, to, base, lift: dLift, leads, first, end, harder } = P;
      Q = makePlan([{ type: "run", run, from: spot.i, to: Math.min(run.pts.length - 1, spot.i + 1), length: 0 }, ...rt.legs], { kind, key, title, short, icon, to, base, lift: dLift, leads, first, end, harder, seconds: rt.seconds });
    }
    if (!Q) Q = makePlan([{ type: "run", run, from: spot.i, to: run.pts.length - 1, length: run.length }], { kind: "run", key: `run:${run.name}`, title: run.name || "无名雪道", short: run.name, icon: "", end: run.pts[run.pts.length - 1], leads: leadsTo(run.pts[run.pts.length - 1]), first: run });
    if (!Q) return;
    rideInstead(Q, `从 ${run.name || "这里"} 重新开始 · 去 ${Q.short || Q.title}`);
    spawn = { t0: clock() }; // the arrival: see stepSki
    flash();
  }
  const liftsShown = new Set([lift]);
  function dress(P) {
    const path = P.path;
    // The other lifts near the way down, so a lift you can take is there to see.
    for (const l of R.lifts) {
      if (liftsShown.has(l) || l.kind === "magic_carpet" || l.pts.length < 2) continue;
      if (!l.pts.some(([x, z]) => path.some(([rx, rz], i) => i % 4 === 0 && Math.hypot(rx - x, rz - z) < 900))) continue;
      liftsShown.add(l);
      world.add(otherLift(T, l));
    }
    ctx.forest(treeSpots(T, R, ctx.mask, { ground: path.filter((_, i) => i % 2 === 0).map(([x, z]) => ({ x, z })) }, 450, 0, planted), 300);
    boxes.push(boxOf(path.map((p) => p[0]), path.map((p) => p[1]), 400));
    ctx.addRunsNear((pts) => pts.some(([x, z]) => path.some(([rx, rz], i) => i % 3 === 0 && Math.hypot(rx - x, rz - z) < 700)));
    if (nav) { scene.remove(nav.group); nav.group.traverse((o) => o.geometry?.dispose()); }
    const group = new THREE.Group(), js = junctions(path, P.segs, R);
    for (const j of js) {
      // The sign stands 25 m before the junction on the rider's right, just off the piste, facing them.
      let k = j.i, d = 0;
      while (k > 0 && d < 25) { d += Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]); k--; }
      const h = pathDir(path, k), [x, z] = path[k];
      group.add(junctionSign(T, x - Math.cos(h) * 17, z + Math.sin(h) * 17, h + Math.PI, j.options, renderer));
      const way = j.options.find((o) => o.route);
      if (way && Math.abs(way.bearing) > 0.18) group.add(chevrons(T, path, j.i, way.bearing));
    }
    scene.add(group);
    nav = { group, js };
  }
  // Off the route and onto another run: plan again from there to the same destination.
  function replan(r) {
    const P = chosen, found = runNear(r.x, r.z, 28);
    if (!found || !found.run.name) return false;
    const nodes = graph.runNodes.get(found.run).filter((n) => n.i >= found.i);
    if (!nodes.length || !P.to?.length) return false;
    let rt = null;
    for (const lv of LEVELS.slice(LEVELS.indexOf(myLevel))) if ((rt = planRoute(graph, [nodes[0]], P.to, lv))) break;
    if (!rt) return false;
    const legs = [{ type: "run", run: found.run, from: found.i, to: nodes[0].i, length: 0 }, ...rt.legs].filter((l) => l.type !== "run" || l.to > l.from);
    const { kind, key, title, short, icon, to, base, lift: dLift, leads, first, end, seconds, harder } = P;
    const Q = makePlan(legs, { kind, key, title, short, icon, to, base, lift: dLift, leads, first, end, seconds, harder });
    if (!Q) return false;
    chosen = Q; prog = 0;
    dress(Q);
    flashCue(`已改走 ${LEVEL_MARK[found.run.level]}${found.run.name}，重新规划到 ${P.short || P.title}`);
    return true;
  }
  let cueHold = 0, cueText = "";
  let simClock = null; // testing: a fake clock while st.sim runs the ski without drawing
  const clock = () => simClock ?? performance.now();
  const flashCue = (t) => { cueText = t; cueHold = clock() + 3500; };
  // The named run nearest to (x, z) within `max` metres, and the index of its nearest point.
  function runNear(x, z, max) {
    let best = null, bd = max * max;
    for (const run of R.runs) {
      if (run.area) continue;
      const ps = run.pts;
      if (Math.abs(ps[0][0] - x) > 3000 && Math.abs(ps[ps.length - 1][0] - x) > 3000) continue;
      for (let i = 0; i < ps.length; i++) { const d = (ps[i][0] - x) ** 2 + (ps[i][1] - z) ** 2; if (d < bd) { bd = d; best = { run, i }; } }
    }
    return best;
  }
  // Touch: a finger's sideways slide moves where on the piste you ride (up to 11 m either side of the
  // route's line); dragging up slows you down, down lets it run. Let go and you drift back to the line.
  let sdrag = null;
  const LAT = 11;
  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (st.phase !== "ski" || ended) return;
    sdrag = { id: e.pointerId, x: e.clientX, y: e.clientY, lat: latIn };
    touching = true;
  });
  addEventListener("pointermove", (e) => {
    if (!sdrag || e.pointerId !== sdrag.id) return;
    latIn = clamp(sdrag.lat + ((e.clientX - sdrag.x) / innerWidth) * 2.4 * LAT, -LAT, LAT);
    // Up and down only count when the finger mostly moves up or down, past a dead zone: a sideways slide
    // that drifts a little must not brake.
    const dx = e.clientX - sdrag.x, dy = e.clientY - sdrag.y;
    paceIn = Math.abs(dy) > Math.abs(dx) * 0.8 && Math.abs(dy) > 28 ? clamp((dy - Math.sign(dy) * 28) / 90, -1, 1) : 0;
  });
  const touchEnd = (e) => { if (!sdrag || e.pointerId !== sdrag.id) return; sdrag = null; touching = false; paceIn = 0; idleFor = 0; };
  addEventListener("pointerup", touchEnd);
  addEventListener("pointercancel", touchEnd);
  st.setAuto = (on) => { auto = on; };
  // The phone's tilt as riding input, relative to how it was held when the run started: a small dead
  // zone, full at 18° either way. Forward and back recentres slowly (over ~10 s) to however you settle
  // into holding it, so a new grip doesn't read as braking.
  let tiltAt = 0, tiltOff = 9;
  const tiltNow = () => {
    if (!tilt.ok) return null;
    tilt.zero ||= { side: tilt.side, fwd: tilt.fwd };
    const now = clock(), dt = Math.min(0.1, (now - (tiltAt || now)) / 1000); tiltAt = now;
    tilt.zero.fwd += (tilt.fwd - tilt.zero.fwd) * dt * 0.1;
    const ramp = (v, dead, full) => Math.sign(v) * clamp((Math.abs(v) - dead * D) / ((full - dead) * D), 0, 1);
    // Speed needs a clear tip (6°+), so holding the phone a little differently never brakes you on a flat.
    return { steer: ramp(tilt.side - tilt.zero.side, 2, 18), pace: ramp(tilt.zero.fwd - tilt.fwd, 6, 24) };
  };
  const segAt = (P, i) => { let k = 0; while (k + 1 < P.segs.length && P.segs[k + 1].at <= i) k++; return k; };
  // Starting again somewhere else: a white flash, the camera dropping from high above, the rider
  // popping up out of a burst of snow; then on you go.
  let spawn = null;
  function spawnStep(dt) {
    const t = (clock() - spawn.t0) / 1000, r = phys, rider = ctx.rider;
    r.speed = 0; r.dt = dt;
    poseBoarder(rider, r);
    const k = clamp((t - 0.45) / 0.45, 0, 1);
    rider.scale.multiplyScalar(Math.max(0.001, k * (1 + 0.35 * Math.sin(k * Math.PI)))); // a little overshoot
    if (!spawn.burst && t > 0.45) {
      spawn.burst = true; navigator.vibrate?.(40);
      for (let i = 0; i < 8; i++) spray.emit({ ...r, x: r.x, z: r.z, y: r.y, heading: (i / 8) * Math.PI * 2, steer: 1, skid: 1, speed: 7 }, 1500, 1 / 30);
    }
    spray.update(dt);
    const u = ease(Math.min(1, t / 1.2)), h = r.heading;
    camera.position.set(r.x - Math.sin(h) * (6.5 + 10 * (1 - u)), r.y + 2.6 + 60 * (1 - u), r.z - Math.cos(h) * (6.5 + 10 * (1 - u)));
    camera.lookAt(r.x + Math.sin(h) * 5 * u, r.y + 1.1, r.z + Math.cos(h) * 5 * u);
    if (t > 1.3) spawn = null;
  }
  // The way to go, on the snow ahead of you: big gold arrowheads every 6.5 m along the route for the next 130 m,
  // flowing forward and fading with distance, so the line through each turn is always in front of you.
  let guide = null;
  function chevronGeometry() { // a flat "^", 1.8 m wide, pointing +z
    const T0 = [0, 0, 0.6], RO = [0.9, 0, -0.3], RI = [0.9, 0, -0.75], N = [0, 0, 0.12], LI = [-0.9, 0, -0.75], LO = [-0.9, 0, -0.3];
    const pos = [T0, RO, RI, T0, RI, N, T0, N, LI, T0, LI, LO].flat();
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }
  const GUIDE_N = 20, GUIDE_GAP = 6.5;
  function stepGuide(P, now) {
    if (!guide) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xf2b632, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, });
      guide = new THREE.InstancedMesh(chevronGeometry(), mat, GUIDE_N);
      guide.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(GUIDE_N * 3), 3);
      guide.frustumCulled = false; guide.renderOrder = 3;
      world.add(guide);
    }
    const d0 = P.dist[prog], flow = ((now / 1000) * 7) % GUIDE_GAP, m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let i = prog;
    const last = P.path.length - 1, gold = new THREE.Color(0xf2b632), snow = new THREE.Color(0xffffff);
    for (let k = 0; k < GUIDE_N; k++) {
      const want = d0 + 4 + k * GUIDE_GAP + flow;
      while (i < last && P.dist[i + 1] < want) i++;
      if (i >= last || want > P.dist[last]) { m.makeScale(0, 0, 0); guide.setMatrixAt(k, m); continue; }
      const t = (want - P.dist[i]) / (P.dist[i + 1] - P.dist[i] || 1), [ax, az] = P.path[i], [bx, bz] = P.path[i + 1];
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t, h = Math.atan2(bx - ax, bz - az);
      q.setFromUnitVectors(up, T.normalAt(x, z, v)).multiply(q2.setFromAxisAngle(up, h));
      const fade = 1 - Math.max(0, (want - d0 - 70) / 70); // full for the first 70 m, gone by 140 m
      m.compose(new THREE.Vector3(x, T.heightAt(x, z) + 0.12, z), q, new THREE.Vector3(2.8, 1, 3.2).multiplyScalar(0.75 + 0.25 * fade));
      guide.setMatrixAt(k, m);
      guide.setColorAt(k, snow.clone().lerp(gold, Math.max(0.05, fade))); // fading to the snow's white
    }
    guide.instanceMatrix.needsUpdate = true; guide.instanceColor.needsUpdate = true;
    guide.material.opacity = 0.92;
  }
  // The trick wheel (like an emote wheel): hold the button, the tricks fan out around it; slide onto one
  // and let go to do it. A tap opens it and leaves it open for a tap on a trick.
  const ICON = { ollie: "⬆️", indy: "🤙", melon: "🍈", tailGrab: "✋", nose: "👇", tailPress: "👆" };
  const wheel = $("trickWheel"), tbtn = $("trickBtn");
  let wheelOpen = null;
  function showTrickBtn() { tbtn.hidden = !(st.phase === "ski" && tricksOf(ctx.rider).length); }
  function openWheel(e) {
    const list = tricksOf(ctx.rider);
    if (!list.length || st.phase !== "ski") return;
    const r = tbtn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = 165;
    wheel.innerHTML = "";
    // A fan up and to the left of the button (it sits in the corner).
    list.forEach((t, i) => {
      const a = Math.PI * (0.45 + (i / Math.max(1, list.length - 1)) * 0.65), el = document.createElement("div");
      el.className = "opt"; el.dataset.key = t.key;
      el.style.left = `${cx + Math.cos(a) * R}px`; el.style.top = `${cy - Math.sin(a) * R}px`;
      el.innerHTML = `<div><span>${ICON[t.key] || "★"}</span>${t.name}</div>`;
      el.onclick = () => { doTrick(t.key); closeWheel(); };
      wheel.append(el);
    });
    wheel.hidden = false; requestAnimationFrame(() => wheel.classList.add("open"));
    tbtn.classList.add("on");
    wheelOpen = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, hot: null };
    navigator.vibrate?.(15);
  }
  function closeWheel() { wheel.classList.remove("open"); wheel.hidden = true; tbtn.classList.remove("on"); wheelOpen = null; }
  function doTrick(key) {
    if (!startTrick(ctx.rider, key)) return;
    const t = tricksOf(ctx.rider).find((x) => x.key === key);
    flashCue(`${ICON[key] || "★"} ${t.name}!`); navigator.vibrate?.(25);
  }
  tbtn.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); if (wheelOpen) { closeWheel(); return; } openWheel(e); tbtn.setPointerCapture?.(e.pointerId); });
  tbtn.addEventListener("pointermove", (e) => {
    if (!wheelOpen || e.pointerId !== wheelOpen.id) return;
    if (Math.hypot(e.clientX - wheelOpen.x, e.clientY - wheelOpen.y) > 18) wheelOpen.moved = true;
    let hot = null, bd = 60;
    for (const el of wheel.children) { const b = el.getBoundingClientRect(), d = Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2)); if (d < bd) { bd = d; hot = el; } }
    for (const el of wheel.children) el.classList.toggle("hot", el === hot);
    if (hot && hot !== wheelOpen.hot) navigator.vibrate?.(8);
    wheelOpen.hot = hot;
  });
  tbtn.addEventListener("pointerup", (e) => {
    if (!wheelOpen || e.pointerId !== wheelOpen.id) return;
    if (wheelOpen.hot) { doTrick(wheelOpen.hot.dataset.key); closeWheel(); }
    else if (wheelOpen.moved) closeWheel(); // slid off: nothing
    // else: a tap; the wheel stays open for a tap on a trick
  });
  st.trick = doTrick; // testing
  function stepSki(dt) {
    if (mapOpen) return; // skiing waits while you look at the map
    if (spawn) { spawnStep(dt); return; }
    const P = chosen, path = P.path, r = phys, last = path.length - 1;
    const near = nearestOn(path, r.x, r.z, Math.max(0, prog - 6), Math.min(last, prog + 40));
    if (near.d < 70) prog = Math.max(prog, near.i);
    const k = segAt(P, prog), seg = P.segs[k], nextSeg = P.segs[k + 1];
    // Aim at a point on the route a little ahead (further when faster), shifted across the piste to where
    // you want to ride. Untouched for a moment, that place swings side to side: easy linked turns.
    const ahead = 8 + r.speed * 1.2;
    let ti = near.i; while (ti < last && P.dist[ti] - P.dist[near.i] < ahead) ti++;
    idleFor = touching ? 0 : idleFor + dt;
    if (!touching) latIn *= Math.exp(-dt * 0.35);
    // (Only once moving: at a crawl on a flat, linked turns would only stall you.)
    // Linked turns, heel edge to toe edge, as a rider controls speed on a piste: about 7 m either side
    // of the line, a turn every 30 m.
    const weave = auto ? 0 : 7 * Math.sin((P.dist[ti] / 30) * Math.PI) * clamp((idleFor - 1.5) / 2, 0, 1) * clamp((r.speed - 4) / 5, 0, 1);
    const lat = clamp(latIn + weave, -LAT, LAT), hd = pathDir(path, ti);
    // The rider's right on screen is local -x: (−cos h, +sin h).
    const tx = path[ti][0] - Math.cos(hd) * lat, tz = path[ti][1] + Math.sin(hd) * lat;
    let steer = clamp(angleDiff(r.heading, Math.atan2(tx - r.x, tz - r.z)) * 2.5, -1, 1); // here angleDiff is a - b
    // Tilting the phone rides it: left or right edges into a turn at once (the route only nudges you
    // back), tipping it away lets it run, toward you slows down. Measured from how you held it at the start.
    const tl = tiltNow();
    // At a crawl a full tilt would only spin you on the spot: it counts for less, the route for more.
    const slow = clamp(r.speed / 5, 0.3, 1);
    if (!auto && tl && Math.abs(tl.steer) > 0.02) { steer = clamp(tl.steer * slow + (1.15 - slow) * steer, -1, 1); idleFor = 0; latIn = 0; tiltOff = 0; }
    else if (!auto && tl) { tiltOff += dt; steer = clamp(steer, -0.35 - tiltOff * 0.3, 0.35 + tiltOff * 0.3); } // ease back to the line after a turn
    // Flats: ahead of one, warn once and stop braking so speed builds; on one, a tilt or a drag that would
    // only scrub speed counts for little, and the board runs straight and tucked; skating takes over at a crawl.
    const flat = P.flats.find((f) => f.kind === "flat" && prog >= f.a && prog <= f.b);
    const flatAhead = P.flats.find((f) => f.kind === "flat" && f.a > prog && P.dist[f.a] - P.dist[prog] < 140);
    const rise = P.flats.find((f) => f.kind === "up" && f.a > prog && P.dist[f.a] - P.dist[prog] < 80);
    for (const f of [flatAhead, rise]) if (f && !f.told) { f.told = true; flashCue(f.kind === "flat" ? `前面 ${fmtLen(f.m)} 平路 · 别刹车，带速度，板放平` : `前面 ${fmtLen(f.m)} 上坡 · 要走上去`); }
    if (flat && !touching) { steer *= 0.35; if (tl && Math.abs(tl.steer) < 0.3) steer = clamp(steer, -0.12, 0.12); }
    // Speed: held to an easy pace for the run's level unless you drag for more or less.
    const cap = { easy: 11, intermediate: 14, advanced: 15, expert: 15 }[seg.run.level] * (flat || flatAhead ? 1.6 : 1);
    const asked = touching && Math.abs(paceIn) > 0.15 ? paceIn : !auto && tl && Math.abs(tl.pace) > 0.15 ? tl.pace : 0;
    let pace = asked ? (asked > 0 && r.speed > cap * 1.6 ? -0.5 : asked) : r.speed > cap ? -1 : 0;
    if (flat && pace > -0.6) pace = Math.max(pace, 0.8); // tucked through a flat unless you really brake
    // On a flat or a short rise (common near lift tops) you skate, or walk up it. Gravity does the rest;
    // nothing pulls you uphill.
    // Stopped on purpose (holding the brake): stand still rather than pivot on the spot.
    const parked = pace < -0.2 && r.speed < 0.8;
    r.step(dt, { steer: parked ? 0 : steer, pace, push: pace >= 0 && r.speed < 4, offPiste: near.d > 45, guided: true });
    // Into a tree: stopped short and put back beside it (the route then leads you on).
    const tree = treeAt(r.x, r.z, 1.6);
    if (tree) {
      const dx = r.x - tree.x, dz = r.z - tree.z, L = Math.hypot(dx, dz) || 1;
      r.x = tree.x + (dx / L) * 1.65; r.z = tree.z + (dz / L) * 1.65; r.y = T.heightAt(r.x, r.z);
      if (r.speed > 2.5) { flashCue("💥 撞到树了"); navigator.vibrate?.(120); }
      r.speed *= 0.15;
    }
    poseBoarder(ctx.rider, r);
    tracks.add(r);
    stepGuide(P, clock());
    const NL = ctx.nightLights;
    if (NL) { // brighter close to a floodlight
      let lamp = 0;
      for (const sp of NL.spots) { const d2 = (sp.lx - r.x) ** 2 + (sp.lz - r.z) ** 2; if (d2 < 1600) lamp = Math.max(lamp, Math.exp(-d2 / 450)); }
      NL.glow.position.set(r.x, r.y + 6, r.z);
      NL.glow.intensity = ctx.night * (10 + 70 * lamp);
    }
    // Snow thrown up off the edge: a little in every turn, a cloud when you skid to slow down.
    const carve = Math.abs(r.lean) * r.speed;
    spray.emit(r, (r.skid || 0) * r.speed * 55 + (carve > 2 ? carve * 9 : 0), dt);
    spray.update(dt);
    // Chase camera, like the game's.
    const back = new THREE.Vector3(-Math.sin(r.heading), 0, -Math.cos(r.heading));
    // Higher and a little further back than before, looking well ahead: more of the slope and the valley.
    const want = new THREE.Vector3(r.x, r.y, r.z).addScaledVector(back, 7.5 + r.speed * 0.1);
    want.y = Math.max(T.heightAt(want.x, want.z) + 1.6, r.y + 3.4);
    camera.position.lerp(want, Math.min(1, dt * 4));
    camera.lookAt(r.x + Math.sin(r.heading) * 9, r.y + 0.6, r.z + Math.cos(r.heading) * 9);
    const left = Math.max(0, P.dist[last] - P.dist[prog]);
    $("skiSpeed").textContent = Math.round(r.speed * 3.6);
    $("skiLeft").textContent = fmtLen(left);
    const name = (s) => `${LEVEL_MARK[s.run.level]}${s.run.name || "无名雪道"}`;
    const nameR = (run) => `${LEVEL_MARK[run.level]}${run.name || "无名雪道"}`;
    const now = clock();
    // Which run am I on, really? (Twice a second is plenty.)
    if (now - lastLook > 500) { lastLook = now; onRun = runNear(r.x, r.z, 26); if (onRun) skiLog.mark(onRun.run, onRun.i); }
    skiLog.step(r.x, r.z, now);
    $("skiWhere").innerHTML = onRun ? `你在 ${nameR(onRun.run)}` : "雪道外";
    // Off the route for a while: replan from the run I'm on, if it leads anywhere.
    offFor = near.d > 45 ? offFor + dt : 0;
    if (offFor > 1.2 && onRun && replan(r)) { offFor = 0; return; }
    const J = nav?.js.find((j) => j.i > prog), toJ = J ? P.dist[J.i] - P.dist[prog] : Infinity;
    let cue;
    if (now < cueHold) cue = cueText;
    else if (near.d > 60) cue = `<b>偏离路线 ${Math.round(near.d)} 米</b>，回到 ${name(seg)}${onRun ? ` · 或者沿 ${nameR(onRun.run)} 滑，会自动重新规划` : ""}`;
    else if (J && toJ < 260) {
      // The junction ahead: every way, left to right, the route's in bold.
      const way = J.options.find((o) => o.route);
      cue = `<b>前方 ${Math.round(toJ)} 米岔口 · ${way ? `${arrowText(way.bearing)} ${turnWord(way.bearing)}进 ${nameR(way.run)}` : ""}</b><br><small>${J.options.filter((o) => o !== way).map((o) => `${arrowText(o.bearing)} ${nameR(o.run)}`).join("　")}</small>`;
    } else if (left < 220) cue = `<b>快到了</b> · ${P.next ? `${P.next.name} 底站` : P.short || "雪道尽头"}还有 ${Math.round(left)} 米`;
    else cue = `沿 ${name(seg)} 滑${nextSeg ? ` · 接着进 ${name(nextSeg)}` : P.next ? ` · 到底坐 🚡${P.next.name}` : P.kind === "base" ? ` · 到底就是 🏠${P.short}` : ""}`;
    $("skiCue").innerHTML = cue;
    // The next turn-off, big at the top of the screen, with a buzz as it comes up and again close to it.
    const way = J && toJ < 160 ? J.options.find((o) => o.route) : null;
    const tc = $("turnCue");
    if (way) {
      tc.hidden = false;
      tc.innerHTML = `<span class="arr">${arrowText(way.bearing)}</span><span><b>${Math.abs(way.bearing) > 0.18 ? turnWord(way.bearing) + "进" : "直行"} ${nameR(way.run)}</b><small>${Math.round(toJ)} 米后岔口</small></span>`;
      const stage = toJ < 50 ? 2 : 1;
      // The big card repeats the line below, so that line lists only the other ways.
      if (now >= cueHold) $("skiCue").innerHTML = J.options.length > 1 ? `<small>别走错：${J.options.filter((o) => o !== way).map((o) => `${arrowText(o.bearing)} ${nameR(o.run)}`).join("　")}</small>` : cue;
      const turning = Math.abs(way.bearing) > 0.18; // only a real turn-off buzzes; straight on stays quiet
      if (!alerted || alerted.j !== J || alerted.stage < stage) { if (turning) navigator.vibrate?.(stage === 2 ? [60, 60, 60] : 40); tc.classList.remove("pop"); void tc.offsetWidth; tc.classList.add("pop"); alerted = { j: J, stage }; }
    } else tc.hidden = true;
    offerLift(r, P, now);
    if (!ended && prog >= last - 1 && near.d < 60) { ended = true; arrive(P); }
  }
  // A lift you can ride, right ahead: offer it once (not the one this plan ends at, the arrival card
  // offers that). Tap to ride it; or keep skiing and it goes away.
  let offered = new Set(), offer = null, offerAt = 0;
  const rideable = (l) => bigLift(l) && ["chair_lift", "gondola", "mixed_lift", "cable_car"].includes(l.kind);
  function offerLift(r, P, now) {
    if (now - offerAt < 400) return;
    offerAt = now;
    const box = $("liftOffer");
    if (offer && Math.hypot(offer.pts[0][0] - r.x, offer.pts[0][1] - r.z) > 260) { box.hidden = true; offer = null; }
    if (offer || P.dist[P.dist.length - 1] - P.dist[prog] < 250) return; // near the end the arrival card offers its lifts
    // Within 180 m and ahead of you (lift stations sit a little off the runs).
    const ahead = (l) => { const dx = l.pts[0][0] - r.x, dz = l.pts[0][1] - r.z, d = Math.hypot(dx, dz); return d < 180 && (d < 50 || (dx * Math.sin(r.heading) + dz * Math.cos(r.heading)) / d > 0.2); };
    const l = R.lifts.find((l) => rideable(l) && !offered.has(l) && l !== P.lift && l !== P.next && ahead(l));
    if (!l) return;
    offered.add(l); offer = l;
    box.innerHTML = `<b>🚡 前面就是 ${l.name}</b><div class="two"><button class="go">坐这条上山 ›</button><button class="no">继续滑</button></div>`;
    box.querySelector(".go").onclick = () => { location.href = withResort(`look.html?lift=${encodeURIComponent(l.name)}`); };
    box.querySelector(".no").onclick = () => { box.hidden = true; };
    box.hidden = false;
    navigator.vibrate?.(30);
  }

  // Missed a turn, or changed your mind: tap the map and choose again from where you are.
  let origPlan = null;
  const planFrom = (from, to) => {
    for (const lv of LEVELS.slice(LEVELS.indexOf(myLevel))) { const rt = planRoute(graph, from, to, lv); if (rt) return rt; }
    return null;
  };
  function rideInstead(Q, note) {
    chosen = Q; prog = 0; ended = false; alerted = null;
    bookRoute(Q, true);
    dress(Q);
    $("liftName").innerHTML = `${Q.icon || ""} ${Q.title}`;
    $("rePlan").hidden = true;
    flashCue(note);
  }
  function openReplan() {
    if (st.phase !== "ski" || ended || !phys) return;
    const r = phys, from = nodesNear(graph, r.x, r.z, 160), P = chosen, opts = [];
    if (from.length && P.to?.length) {
      const { kind, key, title, short, icon, to, base, lift: dLift, leads, first, end, harder } = P; // the plan's place, not its path
      const rt = planFrom(from, P.to), Q = rt && !rt.legs.some((g) => g.type === "lift") && makePlan(rt.legs, { kind, key, title, short, icon, to, base, lift: dLift, leads, first, end, harder, seconds: rt.seconds });
      if (Q) opts.push({ go: true, label: `继续去 ${P.short || P.title}`, sub: `从你现在的位置重新规划 · 约 ${fmtMin(rt.seconds)}`, act: () => rideInstead(Q, `已从这里重新规划到 ${P.short || P.title}`) });
    }
    const near = [];
    if (from.length) for (const l of R.lifts) {
      if (!rideable(l) || Math.hypot(l.pts[0][0] - r.x, l.pts[0][1] - r.z) > 3000) continue;
      const to = [graph.liftNodes.get(l).bottom], rt = planFrom(from, to);
      if (rt && !rt.legs.some((g) => g.type === "lift")) near.push({ l, rt, to });
    }
    near.sort((a, b) => a.rt.seconds - b.rt.seconds);
    for (const { l, rt, to } of near.slice(0, 3)) {
      const Q = makePlan(rt.legs, { to, kind: "lift", key: `lift:${l.name}`, title: `接 ${l.name} 缆车`, short: l.name, icon: "🚡", seconds: rt.seconds, end: l.pts[0], lift: l });
      if (Q) opts.push({ label: `去坐 ${l.name}`, sub: `滑过去约 ${fmtMin(rt.seconds)}`, act: () => rideInstead(Q, `改去坐 ${l.name}`) });
    }
    if (origPlan) opts.push({ label: "回到起点，重滑这条路线", sub: origPlan.title, act: () => { $("rePlan").hidden = true; chosen = origPlan; startSki(); } });
    opts.push({ label: "在地图上选出发点", sub: "打开雪场地图，点哪里就从哪里出发", act: () => { $("rePlan").hidden = true; openBigMap(); } });
    const box = $("rePlan");
    box.innerHTML = `<h2>重新选 <button aria-label="关闭">×</button></h2><p>你在 ${onRun ? onRun.run.name || "无名雪道" : "雪道外"}</p><h3>从这里</h3><div class="opts"></div>`;
    box.querySelector("h2 button").onclick = () => (box.hidden = true);
    for (const o of opts) {
      const b = document.createElement("button");
      b.className = "opt" + (o.go ? " go" : "");
      b.innerHTML = `${o.label}${o.sub ? `<small>${o.sub}</small>` : ""}`;
      b.onclick = o.act;
      box.querySelector(".opts").append(b);
    }
    if (!opts.length) box.querySelector(".opts").innerHTML = "<p>附近找不到能去的地方，先回到雪道上。</p>";
    box.hidden = false;
  }

  // The route written out, to read before a real day: each run, each junction (which way, which not),
  // where it's easy to go wrong, and other ways to the same place. Copy or share it.
  const LV_TXT = { easy: "🟢", intermediate: "🟦", advanced: "◆", expert: "◆◆" };
  function routeGuide(P) {
    const runName = (run) => `${LV_TXT[run.level]}${run.name || "无名雪道"}`;
    const lines = [], html = [];
    const head = `${P.icon || ""} ${P.title}：先滑 ${fmtLen(P.length)}，约 ${fmtMin(P.seconds || P.length / 7)}，最难 ${LV_TXT[P.hardest]}${LEVEL_ZH[P.hardest]}${P.next ? `，中途坐 🚡${P.next.name}` : ""}`;
    lines.push(`从 ${lift.name} 山顶出发`, head, "", "怎么滑：");
    html.push(`<p>从 ${lift.name} 山顶出发</p><p><b>${head}</b></p><h3>怎么滑</h3><ol>`);
    P.segs.forEach((g, k) => {
      const a = P.dist[g.at], b = k + 1 < P.segs.length ? P.dist[P.segs[k + 1].at] : P.dist[P.dist.length - 1];
      const t = `${runName(g.run)}，约 ${fmtLen(b - a)}`;
      lines.push(`${k + 1}. ${t}`); html.push(`<li>${t}</li>`);
    });
    if (P.next) { lines.push(`${P.segs.length + 1}. 到底坐 🚡${P.next.name}`); html.push(`<li>到底坐 🚡${P.next.name}</li>`); }
    html.push("</ol>");
    const js = junctions(P.path, P.segs, R);
    if (js.length) { lines.push("", "岔口："); html.push("<h3>岔口（按顺序）</h3><ol>"); }
    js.forEach((j) => {
      const way = j.options.find((o) => o.route), others = j.options.filter((o) => o !== way);
      if (!way) return;
      // Where: along the run you're on, or, for a turn off at a run's end, "at the end of" the run before.
      let on = P.segs.filter((g) => g.at <= j.i).pop();
      if (on && P.dist[j.i] - P.dist[on.at] < 25) on = P.segs.filter((g) => g.at < on.at).pop() || on;
      const tricky = others.some((o) => Math.abs(o.bearing - way.bearing) < 0.4) || others.some((o) => LEVELS.indexOf(o.run.level) > LEVELS.indexOf(myLevel));
      const along = P.dist[j.i] - (on ? P.dist[on.at] : 0), atEnd = on && on.at < j.i && P.segs.some((g) => g.at === j.i || Math.abs(P.dist[g.at] - P.dist[j.i]) < 25);
      const t = `${on ? (atEnd ? `${runName(on.run)} 滑到头（约 ${fmtLen(along)}）` : `在 ${runName(on.run)} 上约 ${fmtLen(along)} 处`) : "开头"}：${arrowText(way.bearing)} ${Math.abs(way.bearing) > 0.18 ? turnWord(way.bearing) + "进" : "直行"} ${runName(way.run)}`
        + (others.length ? `；别走 ${others.map((o) => `${arrowText(o.bearing)} ${runName(o.run)}`).join("、")}` : "");
      const warn = tricky ? "⚠️ 容易走错：岔路方向很接近，或者是更难的雪道，看清路牌再走" : "";
      lines.push(`- ${t}${warn ? `\n  ${warn}` : ""}`);
      html.push(`<li>${t}${warn ? `<br><span class="warn">${warn}</span>` : ""}</li>`);
    });
    if (js.length) html.push("</ol>");
    // For a snowboard: where it goes flat or climbs, and what to do.
    if (P.flats.length) {
      lines.push("", "单板注意："); html.push("<h3>单板注意 · 平路和上坡</h3><ol>");
      for (const f of P.flats) {
        const t = f.kind === "flat" ? `出发后约 ${fmtLen(f.at)}，${runName(f.run)} 有 ${fmtLen(f.m)} 平路：之前别刹车，带着速度进去，板放平别转弯，不够就单脚蹬` : `出发后约 ${fmtLen(f.at)}，${runName(f.run)} 有 ${fmtLen(f.m)} 往上的坡：要解开后脚走上去`;
        lines.push(`- ${t}`); html.push(`<li>${t}</li>`);
      }
      html.push("</ol>");
    }
    if (P.next) { const t = `到底要坐 🚡${P.next.name}：快到底时放慢，看路牌，别滑过站`; lines.push("", t); html.push(`<p class="warn">${t}</p>`); }
    // Other ways to the same place, at other levels.
    const alt = [];
    if (P.to?.length) for (const lv of LEVELS) {
      const rt = planRoute(graph, fromTop, P.to, lv);
      if (!rt) continue;
      const names = [...new Set(rt.legs.filter((g) => g.type === "run" && g.run.name).map((g) => g.run.name))];
      const key = names.join(">"), mine = [...new Set(P.segs.map((g) => g.run.name))].join(">");
      if (key && key !== mine && !alt.some((a) => a.key === key)) alt.push({ key, lv, rt, names });
    }
    if (alt.length) {
      lines.push("", "其他走法："); html.push("<h3>其他走法</h3><ol>");
      for (const a of alt) {
        const hard = a.rt.legs.filter((g) => g.type === "run").map((g) => LEVELS.indexOf(g.run.level)).reduce((m, v) => Math.max(m, v), 0);
        const t = `${a.names.join(" › ")}（约 ${fmtMin(a.rt.seconds)}，最难 ${LV_TXT[LEVELS[hard]]}${LEVEL_ZH[LEVELS[hard]]}）`;
        lines.push(`- ${t}`); html.push(`<li>${t}</li>`);
      }
      html.push("</ol>");
    }
    lines.push("", "（路线根据 OpenStreetMap 数据规划，到了雪场以官方地图和路牌为准）");
    html.push(`<p style="margin-top:10px;color:#b9c4d3;font-size:12px">路线根据 OpenStreetMap 数据规划，到了雪场以官方地图和路牌为准。</p>`);
    return { text: lines.join("\n"), html: html.join("") };
  }
  function openGuide(P) {
    const g = routeGuide(P), box = $("guide");
    box.innerHTML = `<div class="rod"></div><div class="paper"><div class="ink"><h2>路书 · ${P.title}<button aria-label="收起">×</button></h2>${g.html}
      <div class="opts"><button class="opt zoom">放大</button><button class="opt go">复制</button>${navigator.share ? '<button class="opt share">分享</button>' : ""}</div></div></div><div class="rod"></div>`;
    box.classList.remove("open", "big");
    box.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("open"))); // unroll
    const roll = () => { box.classList.remove("open"); setTimeout(() => { if (!box.classList.contains("open")) box.hidden = true; }, 650); };
    box.querySelector("h2 button").onclick = roll;
    box.querySelector(".zoom").onclick = (e) => { box.classList.toggle("big"); e.target.textContent = box.classList.contains("big") ? "缩小" : "放大"; };
    box.querySelector(".opt.go").onclick = async (e) => { try { await navigator.clipboard.writeText(g.text); e.target.textContent = "已复制 ✓"; } catch { e.target.textContent = "请长按选择文字"; } };
    box.querySelector(".share")?.addEventListener("click", () => navigator.share({ title: P.title, text: g.text }).catch(() => {}));
  }
  st.nearLift = () => { if (!phys) return null; let b = null; for (const l of R.lifts) if (rideable(l)) { const d = Math.hypot(l.pts[0][0] - phys.x, l.pts[0][1] - phys.z); if (!b || d < b.d) b = { name: l.name, d: Math.round(d) }; } return b; }; // testing
  st.placeNear = (name, back = 120) => { const l = R.lifts.find((x) => x.name === name), [x, z] = l.pts[0], [x2, z2] = l.pts[1]; const h = Math.atan2(x - x2, z - z2) + Math.PI; phys.place(x - Math.sin(h) * back, z - Math.cos(h) * back, h, 6); }; // testing
  st.tapMap = (x, z) => goToMapPoint(x, z); st.liftMid = (n) => { const l = R.lifts.find((q) => q.name === n); return l.pts[Math.floor(l.pts.length / 2)]; }; st.runPt = (n) => { const r = R.runs.find((q) => q.name === n); return r.pts[Math.floor(r.pts.length / 2)]; }; // testing
  st.guide = (key) => routeGuide([...dests, ...runs].find((p) => p.key === key) || chosen);

  function arrive(P) {
    $("liftOffer").hidden = true; closeBigMap();
    if (guide) guide.visible = false;
    tbtn.hidden = true; closeWheel();
    $("skiHud").hidden = true;
    $("turnCue").hidden = true;
    $("minimap").hidden = true;
    $("arrive").hidden = false;
    const link = (l, to, label) => `<a class="btn go" href="${withResort(`look.html?lift=${encodeURIComponent(l)}${to ? `&to=${encodeURIComponent(to)}` : ""}`)}">${label}</a>`;
    let title, note, row = "";
    if (P.next) {
      title = `到 ${P.next.name} 底站了`;
      note = `路线下一段：坐 ${P.next.name} 上山，再接着去 ${P.short}`;
      row = link(P.next.name, P.key, `坐 ${P.next.name} 继续去 ${P.short} ›`);
    } else if (P.kind === "base") {
      const ls = R.lifts.filter((l) => bigLift(l) && Math.hypot(l.pts[0][0] - P.base.x, l.pts[0][1] - P.base.z) < 350);
      title = `到 ${P.short} 了 🎉`;
      note = ls.length ? `从这里还能坐：${ls.map((l) => l.name).join("、")}` : "今天的路线滑完了";
      row = ls.slice(0, 3).map((l) => link(l.name, null, `坐 ${l.name} 上山 ›`)).join("");
    } else if (P.kind === "lift") {
      title = `到 ${P.short} 底站了`;
      note = "上去以后可以再选下一段";
      row = link(P.short, null, `坐 ${P.short} 上山 ›`);
    } else {
      title = `滑到底了 · ${P.title}`;
      note = P.leads.lifts.length ? `这里能坐 ${P.leads.lifts.join("、")}` : P.leads.base ? `这里是 ${P.leads.base}` : "这条雪道滑完了";
      row = P.leads.lifts.slice(0, 3).map((n) => link(n, null, `坐 ${n} 上山 ›`)).join("");
    }
    $("arriveTitle").textContent = title;
    addStep(RESORT, { k: "arrive", title });
    $("arriveNote").textContent = note;
    skiLog.save(true);
    $("arriveRow").innerHTML = row + `<button class="btn" id="seeBook">📜 预滑路书</button><button class="btn" id="seeLog">📖 我的滑雪记录</button><a class="btn" href="${withResort("mountain/")}">回沙盘</a><button class="btn" onclick="location.reload()">再来一次</button>`;
    $("seeLog").onclick = openJournal;
    $("seeBook").onclick = () => openBookPage(RESORT, { name: R.name, drawMap: paintWith(tmap) });
  }

  // Where the rider stands after getting off: down the ramp, beside the sign.
  const standAt = () => {
    topTerm.updateMatrixWorld(true);
    return topTerm.localToWorld(new THREE.Vector3(-HALF_GAUGE, 0.25, -7.5));
  };
  const marks = new THREE.Group(); // faint: every run from this top; bold: the chosen plan, drawn in order
  let chosen = null, routeMarks = [], reveal = null;
  const tagBox = $("runTags"), cards = $("runCards");
  let from, fromLook, riderFrom, riderTo, yaw0;
  st.start = (now) => {
    st.phase = "unload"; st.t0 = now;
    bubbleWant = 1;
    const rider = ctx.rider;
    rider.updateMatrixWorld(true);
    riderFrom = rider.getWorldPosition(new THREE.Vector3());
    yaw0 = getChair().rotation.y;
    scene.attach(rider);
    riderTo = standAt();
    $("bubble").hidden = true;
    // No getting-off scene: arriving at the top cuts straight to choosing the way down.
    rider.position.copy(riderTo); rider.rotation.set(0, yaw0, 0);
    standBoarder(rider, 1);
    st.phase = "rise"; st.t0 = now; // a short lift up and back from the rider, then the cut to the miniature
    setupPick();
  };
  const camBehind = (r, ang, dist, hgt) => r.clone().add(new THREE.Vector3(Math.sin(yaw0 + ang) * -dist, hgt, Math.cos(yaw0 + ang) * -dist));
  // The overview camera eases towards `want` (position, look-at and a screen shift that keeps the
  // route between the top panel and the cards); `cur` is where it is now.
  const cur = { pos: new THREE.Vector3(), look: new THREE.Vector3(), ox: 0, oy: 0 }, want = { pos: new THREE.Vector3(), look: new THREE.Vector3(), ox: 0, oy: 0 };
  const applyCam = () => {
    camera.position.copy(cur.pos);
    camera.setViewOffset(innerWidth, innerHeight, cur.ox * innerWidth, cur.oy * innerHeight, innerWidth, innerHeight);
    camera.lookAt(cur.look);
  };
  st.step = (now, dt) => {
    const t = (now - st.t0) / 1000, rider = ctx.rider;
    if (st.phase === "unload") {
      // Stand, glide down the ramp to the sign, camera swinging round to the rider's front quarter.
      const u = ease(Math.min(1, t / 2.6));
      rider.position.lerpVectors(riderFrom, riderTo, u);
      rider.position.y += Math.sin(Math.min(1, t / 0.6) * Math.PI) * 0.15 * (1 - u);
      rider.rotation.set(0, yaw0, 0);
      if (u < 0.25) sitBoarder(rider, 0, new THREE.Vector3(0, 0.6, -0.08)); else standBoarder(rider, (u - 0.25) / 0.75);
      rider.position.y = Math.max(rider.position.y, T.heightAt(rider.position.x, rider.position.z));
      const c = rider.position.clone();
      camera.position.copy(camBehind(c, u * 2.4, 5.5, 2.2));
      camera.lookAt(c.clone().add(new THREE.Vector3(0, 1.1, 0)));
      st.focus.copy(c);
      if (t > 2.8) { st.phase = "rise"; st.t0 = now; setupPick(); }
    } else if (st.phase === "rise" || st.phase === "dive") {
      const u = ease(Math.min(1, t / (st.phase === "rise" ? 1.3 : 1.6)));
      if (st.phase === "rise") {
        cur.pos.lerpVectors(from, st.rise.pos, u); cur.look.lerpVectors(fromLook, st.rise.look, u);
      } else {
        cur.pos.lerpVectors(st.diveFrom.pos, from, u); cur.look.lerpVectors(st.diveFrom.look, fromLook, u); cur.ox = st.diveFrom.ox * (1 - u); cur.oy = st.diveFrom.oy * (1 - u);
      }
      applyCam();
      if (u >= 1) {
        if (st.phase === "rise") {
          st.phase = "pick"; flash(); tagBox.hidden = false; $("pick").hidden = false; document.body.classList.add("picking"); chosen?.card.scrollIntoView({ inline: "center", block: "nearest" });
          if (chosen) requestAnimationFrame(() => aimAt(chosen)); // fit again now the cards are there to fit above
        }
        else startSki();
      }
    } else if (st.phase === "ski") {
      stepSki(Math.min(dt, 0.05));
    } else if (st.phase === "hike" && hk) {
      stepHike(Math.min(dt, 0.05));
    }
    if (reveal && st.phase !== "ski") {
      // Draw the chosen plan leg by leg, from the top down.
      const kk = Math.min(1, (now - reveal.t0) / (900 + 500 * routeMarks.length)), total = reveal.total;
      let acc = 0;
      for (const m of routeMarks) {
        const n = m.geometry.index.count, share = m.userData.len / total;
        const local = clamp((kk - acc) / share, 0, 1);
        m.geometry.setDrawRange(0, Math.floor((n * local) / 6) * 6);
        acc += share;
      }
    }
    st.focus.copy(st.phase === "ski" || st.phase === "hike" ? ctx.rider.position : camera.position);
    if (st.phase === "pick") return; // the miniature is drawn by st.render
  };
  const flash = () => { const f = $("flash"); f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); };
  // Camera framing a set of points: from behind the summit, looking down at them, the whole lot
  // between the top panel and the cards.
  function frame(points, probes = []) {
    const saved = { p: camera.position.clone(), q: camera.quaternion.clone(), view: camera.view && { ...camera.view } };
    camera.clearViewOffset();
    const c = points.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / points.length);
    const dir = new THREE.Vector3(c.x - riderTo.x, 0, c.z - riderTo.z);
    if (dir.lengthSq() < 100) dir.set(g1.x - line.ground[0].x, 0, g1.z - line.ground[0].z).negate();
    dir.normalize();
    const elev = 0.72, v = new THREE.Vector3(), out = { pos: new THREE.Vector3(), look: c.clone(), ox: 0, oy: 0 };
    let box = null;
    for (let D = 350; D < 20000; D *= 1.1) {
      camera.position.copy(c).addScaledVector(dir, -Math.cos(elev) * D).add(new THREE.Vector3(0, Math.sin(elev) * D, 0));
      camera.lookAt(c); camera.updateMatrixWorld();
      box = { x0: 9, x1: -9, y0: 9, y1: -9 };
      let behind = false;
      for (const p of points) {
        v.copy(p).project(camera);
        if (v.z > 1) behind = true;
        box.x0 = Math.min(box.x0, v.x); box.x1 = Math.max(box.x1, v.x); box.y0 = Math.min(box.y0, v.y); box.y1 = Math.max(box.y1, v.y);
      }
      out.pos.copy(camera.position);
      if (!behind && box.x1 - box.x0 < 1.3 && box.y1 - box.y0 < 0.62) break;
    }
    // Shift the picture so the box sits centred left-right and just above the middle (cards below).
    out.ox = ((box.x0 + box.x1) / 2) / 2;
    out.oy = (0.1 - (box.y0 + box.y1) / 2) / 2;
    camera.position.copy(saved.p); camera.quaternion.copy(saved.q);
    if (saved.view?.enabled) camera.setViewOffset(saved.view.fullWidth, saved.view.fullHeight, saved.view.offsetX, saved.view.offsetY, saved.view.width, saved.view.height);
    out.width = clamp(out.pos.distanceTo(c) * 0.009, 18, 60);
    out.xs = probes.map((p) => v.copy(p).project(camera).x);
    return out;
  }
  const pointsOf = (P) => {
    const pts = [riderTo.clone()];
    for (const l of P.legs) {
      const list = l.type === "run" ? l.run.pts.slice(l.from, l.to + 1) : l.type === "lift" ? l.lift.pts : [];
      list.forEach(([x, z], i) => { if (i % 3 === 0 || i === list.length - 1) pts.push(new THREE.Vector3(x, T.heightAt(x, z), z)); });
    }
    return pts;
  };

  // ---- Tags floating over the world: run names, the lifts on the way, the destination.
  let liveTags = [];
  const clearTags = () => { tagBox.innerHTML = ""; liveTags = []; };
  const addTag = (html, cls, x, z, h, onClick) => {
    const el = document.createElement(onClick ? "button" : "div");
    el.className = `rtag ${cls}`; el.innerHTML = html;
    if (onClick) el.onclick = onClick;
    tagBox.append(el);
    const t = { el, cls: cls || "run", pos: new THREE.Vector3(x, dio.Y(x, z) + h * 4, z) };
    liveTags.push(t);
    return t;
  };
  const v = new THREE.Vector3();
  // Tags sit above their spot, kept on screen, and nudged up out of each other's way (earlier tags win).
  const RANK = { me: -1, dest: 0, on: 0, via: 1, pin: 2, leg: 3 };
  function placeTags() {
    const camera = dio.camera;
    liveTags.sort((a, b) => (RANK[a.cls] ?? 2) - (RANK[b.cls] ?? 2));
    const placed = [];
    for (const t of liveTags) {
      v.copy(t.pos).project(camera);
      const on = v.z < 1 && Math.abs(v.x) < 1.1 && v.y < 0.98 && v.y > -1.05;
      t.el.style.display = on ? "" : "none";
      if (!on) continue;
      const w = t.el.offsetWidth, h = t.el.offsetHeight;
      const x = clamp((v.x * 0.5 + 0.5) * innerWidth - w / 2, 4, innerWidth - w - 4), y = (-v.y * 0.5 + 0.5) * innerHeight - h;
      // A tag that would cover one already placed waits until the model turns (drag to turn it).
      if (placed.some((r) => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y)) { t.el.style.display = "none"; continue; }
      placed.push({ x, y, w, h });
      t.el.style.transform = `translate(${x}px, ${y}px)`;
    }
  }
  // A picture of your rider as dressed, full body on a transparent background, for the maps' "you are
  // here": the model is lent to a small studio scene for one render.
  let sprite = null;
  function makeSprite() {
    const rider = ctx.rider, W = 140, H = 180, L = 3; // render layer 3: only the rider and two lights
    idleBoarder(rider); // standing on the board for the picture (the next frame poses it again)
    const lights = [new THREE.HemisphereLight(0xffffff, 0x8a96a8, 2.2), new THREE.DirectionalLight(0xfff3e2, 2.6)];
    lights[1].position.copy(rider.localToWorld(new THREE.Vector3(1.5, 3, 3)));
    lights[1].target.position.copy(rider.position);
    for (const l of lights) { l.layers.set(L); scene.add(l); }
    scene.add(lights[1].target);
    rider.traverse((o) => o.layers.enable(L));
    rider.updateMatrixWorld(true);
    const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
    cam.layers.set(L);
    cam.position.copy(rider.localToWorld(new THREE.Vector3(1.4, 1.5, 4.0)));
    cam.lookAt(rider.localToWorld(new THREE.Vector3(0, 0.82, 0)));
    const rt = new THREE.WebGLRenderTarget(W * 2, H * 2); rt.texture.colorSpace = THREE.SRGBColorSpace; // twice the size, then halved
    const clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha(), fog = scene.fog, bg = scene.background, env = scene.environment;
    scene.fog = null; scene.background = null; scene.environment = null;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam); renderer.setRenderTarget(null);
    renderer.setClearColor(clear, alpha); scene.fog = fog; scene.background = bg; scene.environment = env;
    for (const l of lights) { scene.remove(l); l.dispose?.(); }
    scene.remove(lights[1].target);
    rider.traverse((o) => o.layers.disable(L));
    const W2 = W * 2, H2 = H * 2, px = new Uint8Array(W2 * H2 * 4); renderer.readRenderTargetPixels(rt, 0, 0, W2, H2, px); rt.dispose();
    if (!px.some((v, i) => i % 4 === 3 && v > 0)) return false; // nothing drawn: keep the last picture
    const big = document.createElement("canvas"); big.width = W2; big.height = H2;
    const bgc = big.getContext("2d"), img = bgc.createImageData(W2, H2);
    for (let y = 0; y < H2; y++) img.data.set(px.subarray((H2 - 1 - y) * W2 * 4, (H2 - y) * W2 * 4), y * W2 * 4); // flip
    bgc.putImageData(img, 0, 0);
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(big, 0, 0, W, H);
    sprite = c.toDataURL("image/png");
    try { localStorage.setItem("prerunSprite", sprite); } catch { /* full */ }
    tmap?.setAvatar(sprite);
    for (const el of document.querySelectorAll("#runTags .rtag.me")) el.innerHTML = `<img src="${sprite}" alt="你在这里">`; // if it's up already
    return true;
  }
  setTimeout(makeSprite, 1500); // early on the chair (a picture taken right at the top doesn't come out)
  function setupPick() {
    // From the rider at the sign, rise and pull back above the summit, looking down the way.
    from = camera.position.clone();
    fromLook = ctx.rider.position.clone().add(new THREE.Vector3(0, 1.1, 0));
    cur.pos.copy(from); cur.look.copy(fromLook);
    tagBox.hidden = true;
    // Only a short lift-off above the rider before the cut to the miniature.
    const riseTo = () => {
      const r = ctx.rider.position, back = new THREE.Vector3(r.x - from.x, 0, r.z - from.z).normalize();
      return { pos: r.clone().addScaledVector(back, -14).add(new THREE.Vector3(0, 22, 0)), look: r.clone().addScaledVector(back, 60).add(new THREE.Vector3(0, -15, 0)), ox: 0, oy: 0 };
    };
    st.rise = riseTo();
    // One fixed overview per tab, framing every option at once, so they can be compared side by side.
    const endV = (P) => new THREE.Vector3(P.end[0], T.heightAt(P.end[0], P.end[1]), P.end[1]);
    for (const [m, L] of [["dest", dests], ["runs", runs]]) {
      if (!L.length) continue;
      views[m] = frame(L.flatMap(pointsOf), L.map(endV));
      // Cards in the same left-to-right order as the places on screen.
      const xs = new Map(L.map((P, i) => [P, views[m].xs[i]]));
      L.sort((a, b) => xs.get(a) - xs.get(b));
    }
    scene.add(marks);
    // The choosing happens on a miniature, like the one the day started on: the block covering this top
    // and everywhere you can go from it, seen from the summit's side.
    const all = [[g1.x, g1.z], ...[...dests, ...runs].flatMap((P) => [...P.path.filter((_, i) => i % 6 === 0), P.end])];
    const [x0, x1, z0, z1] = boxOf(all.map((p) => p[0]), all.map((p) => p[1]), 300);
    const inside = ([x, z]) => x > x0 && x < x1 && z > z0 && z < z1;
    dio ||= new Diorama(renderer);
    dio.build({ T, R, mask: ctx.mask, graph, lifts: R.lifts.filter((l) => bigLift(l) && l.pts.some(inside)), points: all, maxHalf: 2200, runWidth: 46,
      lodges: bases.filter((b) => inside([b.x, b.z])), title: `${lift.name} 山顶` });
    addEventListener("resize", () => dio.resize());
    const c = dio.box;
    dio.size = dio.sizeTo = dio.whole * 1.12; // the whole block, corners included
    // Centre on the middle of the terrain's height, not the plinth.
    dio.focus.y = dio.focusTo.y = all.reduce((a, [x, z]) => a + dio.Y(x, z), 0) / all.length;
    spin = spin0 = ((((Math.atan2(g1.z - c.cz, g1.x - c.cx) + Math.PI / 4) / (Math.PI * 2)) % 1) + 1) % 1;
    // The summit: a flag where you stand.
    const flag = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 120), new THREE.MeshStandardMaterial({ color: 0x333a44 }));
    pole.position.y = 60;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(70, 42), new THREE.MeshStandardMaterial({ color: 0xf2b632, side: THREE.DoubleSide }));
    cloth.position.set(35, 99, 0);
    flag.add(pole, cloth);
    flag.position.set(g1.x, dio.Y(g1.x, g1.z), g1.z);
    dio.root.add(flag);
    // You are here: a ring on the snow around the flag, pulsing (and a tag above it).
    here = new THREE.Mesh(new THREE.RingGeometry(46, 66, 40), new THREE.MeshBasicMaterial({ color: 0xe8453c, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    here.rotation.x = -Math.PI / 2;
    here.position.set(g1.x, dio.Y(g1.x, g1.z) + 4, g1.z);
    here.renderOrder = 3;
    dio.root.add(here);
    dio.blur = 3.2; dio.resize(); // a stronger tilt-shift than the base view: the far edges go soft
    $("pickTabs").innerHTML = `<button data-m="dest">去哪儿 · ${dests.length}</button><button data-m="runs">选一条雪道 · ${runs.length}</button>${hike ? `<button data-m="hike">🥾 徒步</button>` : ""}`;
    for (const b of $("pickTabs").children) b.onclick = () => setMode(b.dataset.m);
    setMode(mode, [...dests, ...runs].find((P) => P.key === wantKey));
  }
  const list = () => (mode === "dest" ? dests : runs);
  const views = {};
  let dio = null, here = null, spin = 0, spin0 = 0, pdrag = null;
  renderer.domElement.addEventListener("pointerdown", (e) => { if (st.phase === "pick") pdrag = { x: e.clientX, s: spin }; });
  addEventListener("pointermove", (e) => { if (pdrag) spin = pdrag.s - (e.clientX - pdrag.x) / 600; });
  addEventListener("pointerup", () => (pdrag = null));
  // The miniature fills the part of the screen between the top panel and the cards.
  const dioFrame = () => {
    const topPx = $("top").getBoundingClientRect().bottom + 30, botPx = innerHeight - $("pick").getBoundingClientRect().top + 10;
    dio.orbit(spin, Math.max(0.35, 1 - (topPx + botPx) / innerHeight), topPx / innerHeight, 0, 58); // steep: over the summit, down the slopes
  };
  // Zoom the miniature onto a plan: centred on it and close enough that it just fills the space between
  // the top panel and the cards. The rest of the block runs on past the screen's softened edges.
  function aimAt(P) {
    const flat = [[g1.x, g1.z], P.end];
    for (const l of P.legs) {
      const list = l.type === "run" ? l.run.pts.slice(l.from, l.to + 1) : l.type === "lift" ? l.lift.pts : [];
      list.forEach((p, i) => { if (i % 3 === 0 || i === list.length - 1) flat.push(p); });
    }
    const pts = flat.map(([x, z]) => new THREE.Vector3(x, dio.Y(x, z), z));
    const lo = pts.reduce((a, p) => a.min(p), pts[0].clone()), hi = pts.reduce((a, p) => a.max(p), pts[0].clone());
    const saved = { size: dio.size, focus: dio.focus.clone() };
    dio.focus.lerpVectors(lo, hi, 0.5);
    dio.size = dio.whole;
    const topPx = $("top").getBoundingClientRect().bottom + 30, botPx = innerHeight - $("pick").getBoundingClientRect().top + 10;
    const roomY = Math.max(0.35, 1 - (topPx + botPx) / innerHeight) * 2 * 0.8, roomX = 2 * 0.82; // a margin, so the ends stay clear of the panels
    const at = (p) => v.copy(p).project(dio.camera).clone();
    for (let k = 0; k < 4; k++) { // the projected size goes about as 1 / distance: a few rounds settle it
      dioFrame();
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (const p of pts) { v.copy(p).project(dio.camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
      // Perspective pushes the plan off centre: slide the focus over the snow until the plan's middle
      // sits where the focus does (the middle of the space between the panel and the cards).
      const c = at(dio.focus), right = new THREE.Vector3().setFromMatrixColumn(dio.camera.matrixWorld, 0).setY(0).normalize();
      const up = new THREE.Vector3(-right.z, 0, right.x), dx = at(dio.focus.clone().addScaledVector(right, 100)), dy = at(dio.focus.clone().addScaledVector(up, 100));
      if (Math.abs(dy.y - c.y) < 1e-4) dy.y += 1e-4;
      dio.focus.addScaledVector(right, (((x0 + x1) / 2 - c.x) / (dx.x - c.x || 1e-4)) * 100).addScaledVector(up, (((y0 + y1) / 2 - c.y) / (dy.y - c.y)) * 100);
      dio.size = clamp(dio.size * Math.max((x1 - x0) / roomX, (y1 - y0) / roomY), dio.whole * 0.18, dio.whole * 1.12);
    }
    dio.focusTo.copy(dio.focus); dio.sizeTo = dio.size;
    dio.size = saved.size; dio.focus.copy(saved.focus);
  }
  let lastT = 0;
  st.render = (t) => {
    if (st.phase !== "pick") return false;
    const glide = 1 - Math.exp(-Math.min(0.1, t - lastT || 0) * 4); lastT = t;
    dio.focus.lerp(dio.focusTo, glide);
    dio.size += (dio.sizeTo - dio.size) * glide;
    here.scale.setScalar(1 + 0.25 * Math.sin(t * 3)); // you are here: a slow pulse
    dioFrame();
    placeTags();
    dio.render(t);
    return true;
  };
  function setMode(m, first) {
    mode = m;
    for (const b of $("pickTabs").children) b.classList.toggle("on", b.dataset.m === m);
    if (m === "hike") {
      $("desc").textContent = `从 ${lift.name} 山顶走上去，再滑下来`;
      cards.innerHTML = `<div class="rcard on"><div class="r1"><span>🥾</span><b>${hike.zh}</b><span class="t">约 ${hike.mins[0]}–${hike.mins[1]} 分钟</span></div>
        <div class="steps">${hike.zhWhy}</div>
        <small>爬升约 ${hike.gain} 米 · 山顶 ${hike.summit[0].toLocaleString("en-US")} 米 · 下来可以滑 ${hike.down.slice(0, 4).join("、")} 等</small>
        ${hike.snowcat ? `<small class="to">🚜 ${hike.snowcat}</small>` : ""}
        <small>要带：${HIKE_GEAR.join("、")}</small>
        <small class="warn">${hike.tips[0]} · 以雪场当天公告为准</small>
        <button class="go">背上板走上去 ›</button></div>`;
      cards.querySelector(".go").onclick = startHike;
      return;
    }
    Object.assign(want, views[m]);
    $("desc").textContent = m === "dest" ? `从 ${lift.name} 山顶出发，想去哪儿？按${LEVEL_ZH[myLevel]}及以下规划` : `${runs.length} 条雪道从 ${lift.name} 山顶出发 · 左右滑卡片选一条`;
    cards.innerHTML = "";
    for (const P of list()) {
      const card = document.createElement("div");
      card.className = "rcard";
      const steps = P.steps.map((s) => (s.type === "lift" ? `<span class="lift">🚡 ${s.name}</span>` : `${LEVEL_MARK[s.level]}${s.name}`)).join(" › ");
      card.innerHTML = P.kind === "run"
        ? `<div class="r1">${LEVEL_MARK[P.first.level]}<b>${P.title}</b></div>
          <small>${fmtLen(P.first.length)} · 落差 ${P.first.drop} 米 · 最陡约 ${P.steep}°</small>
          <canvas width="300" height="40"></canvas>
          <small class="to">${P.steps.length > 1 ? `接着 ${P.steps.slice(1).map((s) => `${LEVEL_MARK[s.level]}${s.name}`).join(" › ")} ` : "滑到底 "}→ ${P.leads.lifts.length ? `🚡 ${P.leads.lifts.slice(0, 3).join("、")}` : P.leads.base ? `🏠 ${P.leads.base}` : "雪道尽头"}</small>
          <button class="doc">📜 路书 · 怎么滑、哪里容易错</button>
          <button class="go">从这条滑下去 ›</button>`
        : `<div class="r1"><span>${P.icon}</span><b>${P.title}</b><span class="t">约 ${fmtMin(P.seconds)}</span></div>
          <div class="steps">${steps}</div>
          <small>先滑 ${fmtLen(P.length)} · 最难 ${LEVEL_MARK[P.hardest]}${LEVEL_ZH[P.hardest]}${P.harder ? ` · <b class="warn">要过${LEVEL_ZH[P.harder]}</b>` : ""}${P.next ? ` · 中途坐 🚡${P.next.name}` : ""}</small>
          ${P.lifts ? `<small class="to">到了能坐 🚡 ${P.lifts.join("、")}</small>` : ""}
          <canvas width="300" height="34"></canvas>
          <button class="doc">📜 路书 · 怎么滑、哪里容易错</button>
          <button class="go">按这条路线滑 ›</button>`;
      drawProfile(card.querySelector("canvas"), P);
      card.onclick = (e) => { if (!e.target.closest("button")) select(P, true); };
      card.querySelector(".doc").onclick = () => { select(P); openGuide(P); };
      card.querySelector(".go").onclick = async (e) => {
        addStep(RESORT, { k: "top", at: lift.name, options: [...dests, ...runs].map((x) => x.title), chose: P.title });
        bookRoute(P);
        camera.clearViewOffset();
        startSki();
        $("pick").hidden = true; clearTags(); flash();
      };
      cards.append(card); P.card = card;
    }
    let settle = 0;
    cards.onscroll = () => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        const mid = cards.getBoundingClientRect().left + cards.clientWidth / 2;
        let best = null, bd = Infinity;
        for (const P of list()) { const r = P.card.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid); if (d < bd) { bd = d; best = P; } }
        if (best && best !== chosen) select(best);
      }, 90);
    };
    cards.scrollLeft = 0;
    select(first && list().includes(first) ? first : list()[0], !!first);
  }
  function select(P, scroll) {
    if (!P) return;
    chosen = P;
    for (const o of list()) o.card.classList.toggle("on", o === P);
    // On the miniature: the chosen way lit run by run from the top, the other options dimmed, the rest hidden.
    const order = new Map(), others = new Set();
    P.legs.forEach((l, i) => l.type === "run" && !order.has(l.run) && order.set(l.run, order.size));
    for (const o of list()) for (const l of o.legs) if (l.type === "run") others.add(l.run);
    if (dio) {
      dio.light3((run) => (order.has(run) ? 1 : others.has(run) ? 0.22 : 0), (run) => (order.get(run) ?? 0) * 0.35);
      const via = P.legs.find((l) => l.type === "lift")?.lift || (P.kind === "lift" ? P.lift : null);
      dio.focusLift(via);
      aimAt(P);
    }
    ctx.addRunsNear((pts) => P.legs.some((l) => l.type === "run" && l.run.pts === pts));
    // Tags: in run mode every run from here (tap to pick); the chosen plan's steps and where it ends.
    clearTags();
    if (mode === "runs") for (const o of runs) {
      const i = Math.min(o.first.pts.length - 1, Math.floor(o.first.pts.length * 0.3));
      addTag(`${LEVEL_MARK[o.first.level]}${o.title}`, o === P ? "on" : "", o.first.pts[i][0], o.first.pts[i][1], 6, () => select(o, true));
    }
    P.segs.forEach((s, k) => {
      if (!s.run.name || (mode === "runs" && k === 0)) return;
      const b = k + 1 < P.segs.length ? P.segs[k + 1].at : P.path.length - 1, i = Math.round(s.at + (b - s.at) * 0.4);
      addTag(`${LEVEL_MARK[s.run.level]}${s.run.name}`, "leg", P.path[i][0], P.path[i][1], 6);
    });
    // You are here: your own rider, a little full-body figure, hopping.
    const ava = sprite || (() => { try { return localStorage.getItem("prerunSprite"); } catch { return null; } })();
    addTag(ava ? `<img src="${ava}" alt="你在这里">` : "<span>🏂</span>", "me", g1.x, g1.z, 34);
    for (const l of P.legs) if (l.type === "lift" && P.kind !== "run") addTag(`🚡 坐 ${l.lift.name}`, "via", l.lift.pts[0][0], l.lift.pts[0][1], 10);
    if (mode === "dest") for (const o of [P, ...dests.filter((d) => d !== P)]) addTag(o === P ? `🏁 ${o.short} <small>${fmtMin(o.seconds)}</small>` : `${o.icon} ${o.short}`, o === P ? "dest" : "pin", o.end[0], o.end[1], 10, () => select(o, true));
    else addTag(P.leads.lifts.length ? `→ 🚡 ${P.leads.lifts.slice(0, 2).join("、")}` : P.leads.base ? `→ 🏠 ${P.leads.base}` : "雪道尽头", "dest", P.end[0], P.end[1], 10);
    navigator.vibrate?.(8);
    if (scroll) P.card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
  function drawProfile(cv, P) {
    const g = cv.getContext("2d"), W = cv.width, H = cv.height, hs = P.hs, ds = P.dist;
    const hi = Math.max(...hs), lo = Math.min(...hs), L = ds[ds.length - 1] || 1;
    const y = (h) => 4 + (1 - (h - lo) / (hi - lo || 1)) * (H - 8);
    g.beginPath(); g.moveTo(0, H);
    hs.forEach((h, i) => g.lineTo((ds[i] / L) * W, y(h)));
    g.lineTo(W, H); g.closePath();
    g.fillStyle = "rgba(255,255,255,0.18)"; g.fill();
    // The line in each run's colour, so a route shows where it turns harder.
    const col = (lv) => "#" + new THREE.Color(LEVEL_COLOR[lv] === 0x15171c ? 0xdfe6ef : LEVEL_COLOR[lv]).getHexString();
    g.lineWidth = 2.5;
    P.segs.forEach((s, k) => {
      const a = s.at, b = k + 1 < P.segs.length ? P.segs[k + 1].at : hs.length - 1;
      g.beginPath();
      for (let i = a; i <= b; i++) (i === a ? g.moveTo : g.lineTo).call(g, (ds[i] / L) * W, y(hs[i]));
      g.strokeStyle = col(s.run.level); g.stroke();
    });
  }
  st.plans = { dests, runs };
  // Testing: jump the rider `m` metres down the route, or onto the run named `run`.
  st.warp = (m, run) => {
    if (run) { const r = R.runs.find((x) => x.name === run), q = r.pts[Math.min(r.pts.length - 1, 4)]; phys.place(q[0], q[1], pathDir(r.pts, 4), 8); return; }
    const P = chosen; let i = 0; while (i < P.path.length - 2 && P.dist[i] < m) i++;
    phys.place(P.path[i][0], P.path[i][1], pathDir(P.path, i), 8); prog = i;
  };
  // Testing: ski `secs` seconds at 30 fps without drawing; report where the rider went.
  st.sim = (secs, every = 5, guided = false) => {
    const out = []; simClock = performance.now(); if (!sdrag) st.setAuto(!guided);
    for (let f = 0, t = 0; t < secs && !ended; f++, t = f / 30) {
      simClock += 1000 / 30; stepSki(1 / 30);
      if (f % Math.round(every * 30) === 0) out.push(`${Math.round(t)}s ${Math.round(phys.x)},${Math.round(phys.z)} v${Math.round(phys.speed * 3.6)} prog${prog}/${chosen.path.length} | ${$("skiCue").innerText.replace(/\n/g, " ")}`);
    }
    simClock = null; out.push(ended ? "ARRIVED" : "not arrived"); return out;
  };
  st.state = () => ({ x: Math.round(phys?.x), z: Math.round(phys?.z), heading: +(phys?.heading ?? 0).toFixed(2), lean: +(phys?.lean ?? 0).toFixed(2), steer: +(phys?.steer ?? 0).toFixed(2), prog, plan: chosen?.steps.map((s) => s.name).join(">"), junctions: nav?.js.map((j) => `${Math.round(chosen.dist[j.i])}m: ${j.options.map((o) => (o.route ? "*" : "") + o.run.name).join(", ")}`) });
  st.debug = () => ({ frame: renderer.info.render.frame, phase: st.phase, mode, chosen: chosen?.key, dests: dests.map((d) => `${d.key} ${Math.round(d.seconds)}s ${d.steps.map((s) => s.name).join(">")}`), cam: camera.position.toArray().map(Math.round), want: { ox: +want.ox.toFixed(2), oy: +want.oy.toFixed(2) } });
  st.select = (key) => { const P = [...dests, ...runs].find((p) => p.key === key); if (P) { if (!list().includes(P)) setMode(P.kind === "run" ? "runs" : "dest", P); else select(P, true); } };
  return st;
}

// ---------- Looking around (same as the game: phone turn or drag, limited like a seated rider) ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const look = { yaw: 0, pitch: 0, dragYaw: 0, dragPitch: 0, base: null, phone: null };
// Phone motion, for looking around on the lift and for riding. Not the compass heading (alpha): on phones
// it lags and jumps. Instead:
// - turning: the gyroscope's rotation rate about the vertical, added up, at twice the angle (a turn of
//   the wrist looks to the side), easing back to the middle very slowly against drift;
// - tilting: where "up" is in the phone's frame, from beta/gamma (gravity, quick and steady).
const tilt = { side: 0, fwd: 0, ok: false, zero: null };
const D = Math.PI / 180;
let gyroAt = 0, gyroYaw = 0;
const upInPhone = (b, g) => ({ x: -Math.cos(b * D) * Math.sin(g * D), y: Math.sin(b * D), z: Math.cos(b * D) * Math.cos(g * D) });
addEventListener("deviceorientation", (e) => {
  if (e.beta == null) return;
  const up = upInPhone(e.beta, e.gamma);
  tilt.side = Math.asin(clamp(-up.x, -1, 1)); // the phone's right edge down: positive
  tilt.fwd = e.beta * D; // the top of the phone tipped away from you: smaller
  tilt.up = up; tilt.ok = true;
  if (!look.base) look.base = { beta: e.beta };
  look.phone = { yaw: gyroYaw, pitch: ((e.beta - look.base.beta) * D) * 1.3 };
});
addEventListener("devicemotion", (e) => {
  const r = e.rotationRate, now = performance.now(), dt = Math.min(0.1, (now - (gyroAt || now)) / 1000);
  gyroAt = now;
  if (!r || r.alpha == null || !tilt.up) return;
  // Rotation about the world's vertical: the rate vector (x: beta, y: gamma, z: alpha) along "up".
  const rate = (r.beta * tilt.up.x + r.gamma * tilt.up.y + r.alpha * tilt.up.z) * D;
  gyroYaw = clamp(gyroYaw + rate * 2 * dt, -1.3, 1.3) * (1 - dt * 0.03);
  if (look.phone) look.phone.yaw = gyroYaw;
});
const askMotion = () => {
  for (const E of [globalThis.DeviceMotionEvent, globalThis.DeviceOrientationEvent]) if (typeof E?.requestPermission === "function") E.requestPermission().catch(() => {});
};
for (const ev of ["touchend", "click"]) addEventListener(ev, askMotion, { once: true, capture: true });
let drag = null;
renderer.domElement.addEventListener("pointerdown", (e) => (drag = { x: e.clientX, y: e.clientY, yaw: look.dragYaw, pitch: look.dragPitch }));
addEventListener("pointermove", (e) => {
  if (!drag) return;
  look.dragYaw = clamp(drag.yaw + ((e.clientX - drag.x) / innerWidth) * 2.4, -1.3, 1.3);
  look.dragPitch = clamp(drag.pitch - ((e.clientY - drag.y) / innerHeight) * 1.2, -0.7, 0.35);
});
addEventListener("pointerup", () => (drag = null));

// Rider A: hips on the cushion (it stands on the chair at the feet's height, 0.59 m under the seat).
const sit = (model, lookYaw) => sitBoarder(model, lookYaw, new THREE.Vector3(0, 0.6, -0.08));

// Opened from the miniature with ?lift=NAME: a real ride, bottom to top, then the arrival card.
const params = new URLSearchParams(location.search), TRIP = params.has("lift");
const settings = (() => { try { return JSON.parse(localStorage.getItem("prerun") || "{}"); } catch { return {}; } })();
// Which resort: ?resort=, else the one picked on the start screen. Every link onward carries it.
const RESORT = (params.get("resort") || settings.resort || "copper").replace(/[^a-z0-9-]/g, "");
const withResort = (url) => url + (url.includes("?") ? "&" : "?") + `resort=${RESORT}`;
for (const a of document.querySelectorAll('a[href="mountain/"]')) a.href = withResort("mountain/");
const riderLoad = loadBoarder(); // start early, it is a few MB
async function main() {
  const [R, far] = await Promise.all([fetch(`data/${RESORT}.json`).then((r) => r.json()), fetch(`data/${RESORT}-far.json`).then((r) => r.json())]);
  const load = (f, srgb) => new Promise((res) => new THREE.TextureLoader().load(`assets/tex/${f}`, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    res(t);
  }));
  const [snowD, snowN, rockD, branch, branchSnow, crown, crownSnow] = await Promise.all([load("snow_02_diff_1k.jpg", true), load("snow_02_nor_gl_1k.jpg"), load("aerial_rocks_02_diff_1k.jpg", true),
    load("spruce_branch.png", true), load("spruce_snow.png"), load("spruce_crown.png", true), load("spruce_crown_snow.png")]);
  for (const t of [branch, branchSnow, crown, crownSnow]) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  await riderLoad;
  const T = new Terrain(R), mask = treeMaskFn(R, T);
  // The lift asked for, else the chairlift that climbs highest.
  const chairs = R.lifts.filter((l) => l.kind === "chair_lift" || l.kind === "gondola" || l.kind === "mixed_lift");
  const lift = R.lifts.find((l) => l.name === params.get("lift")) || R.lifts.find((l) => l.name === "American Flyer") || [...(chairs.length ? chairs : R.lifts)].sort((a, b) => b.rise - a.rise)[0];
  setLiftKind(lift);
  if (TRIP) addStep(RESORT, { k: "lift", name: lift.name });
  $("liftName").textContent = TRIP ? lift.name : `${lift.name} · 画面样稿`;
  $("bubble").hidden = !HAS_BUBBLE || CABIN; // a cabin's glass is fixed
  const line = liftLine(T, lift);
  const ctx = { T, R, far, line, spots: treeSpots(T, R, mask, line), tex: { snowD, snowN, rockD, branch, branchSnow, crown, crownSnow, cord: corduroy() }, groundGeo: terrainGeometry(T), chair: chairParts(), rider: boarderModel(), lift, mask };
  ctx.tex.cord.repeat.set(1, 1);
  build(ctx);
  $("status").remove();
  // Run names carved into the snow, met on the way up.
  const g0 = line.ground[0], g1 = line.ground[line.ground.length - 1];
  const names = snowNames(T, R, lift, g1.x - g0.x, g1.z - g0.z, renderer); // read from the chair; while skiing, the junction signs say it instead
  scene.add(names);
  scene.add(trailSigns(T, R, lift, g1.x - g0.x, g1.z - g0.z, renderer));
  const flakes = snowfall();
  scene.add(flakes);
  weather(params, flakes, R.origin, ctx.applySky);

  // Ride a stretch of the line over and over: from a quarter of the way up to about two thirds.
  const d0 = TRIP ? 14 : line.total * 0.22, d1 = TRIP ? line.total - 9 : line.total * 0.66; // from the loading point to the unload ramp
  let fast = false, arrived = false;
  const fastBtn = $("fast");
  fastBtn.hidden = !TRIP;
  for (const [ev, v] of [["pointerdown", true], ["pointerup", false], ["pointerleave", false], ["pointercancel", false]]) fastBtn.addEventListener(ev, (e) => { e.stopPropagation(); fast = v; });
  $("skip").hidden = !TRIP;
  // Skip: the chair speeds up the line and glides into the top station (about two seconds).
  let skipping = null;
  $("skip").addEventListener("click", () => { if (!skipping && !arrived) skipping = { from: d, t0: performance.now() }; });
  $("again").addEventListener("click", () => location.reload());
  const mins = (m) => (m < 60 ? `${Math.max(1, Math.round(m))} 秒` : `${Math.round(m / 60)} 分钟`);
  const top = topOfLift({ T, R, lift, line, ctx, getChair: () => myChair });
  window.__top = top;
  let d = d0 + (Number(params.get("at")) || 0) * (d1 - d0), last = performance.now();
  const p = new THREE.Vector3(), q = new THREE.Vector3(), m = new THREE.Matrix4(), rot = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
  const bOpen = bubbleMatrix(1), bShut = bubbleMatrix(0), bm2 = new THREE.Matrix4();
  // The rider's own bubble: pull it down against the wind, or push it up for the view.
  const bubbleBtn = $("bubble");
  const setBubble = (open) => { bubbleWant = open ? 1 : 0; bubbleBtn.textContent = open ? "🫧 放下防风罩" : "🫧 收起防风罩"; };
  bubbleBtn.addEventListener("click", () => setBubble(bubbleWant < 0.5));
  if (params.get("bubble") === "down") { setBubble(false); bubbleOpen = 0; }
  window.__look = { get d() { return d; }, set d(v) { d = v; }, line, look, camera, setBubble, names };
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (flakes.visible) flakes.userData.step(dt, camera.position);
    if (skipping && !arrived) { const u = Math.min(1, (now - skipping.t0) / 2200); d = skipping.from + (d1 - skipping.from) * ease(u) + (u >= 1 ? 1 : 0); }
    else if (!params.has("still") && !arrived) d += SPEED * (fast ? 20 : 3) * dt;
    if (d > d1) {
      if (TRIP) {
        d = d1;
        if (!arrived) {
          arrived = true; $("fast").hidden = $("skip").hidden = true;
          // Put our chair at the unload point first: after "skip" it was still where it last was.
          along(line.up, d, p); along(line.up, d + 4, q);
          myChair.position.copy(p); myChair.rotation.set(0, Math.atan2(q.x - p.x, q.z - p.z), 0); myChair.updateMatrixWorld(true);
          top.start(now);
        }
      } else d = d0;
    }
    if (TRIP && !arrived) $("desc").textContent = `还有 ${(Math.max(0, d1 - d) / 1000).toFixed(1)} 公里 · 约 ${mins((d1 - d) / (SPEED * (fast ? 20 : 3)))} · 转动手机看四周`;
    along(line.up, d, p); along(line.up, d + 4, q);
    const yaw = Math.atan2(q.x - p.x, q.z - p.z);
    myChair.position.copy(p);
    myChair.rotation.set(0, yaw, 0);
    // The other chairs keep their spacing from ours; the down line runs the other way.
    for (let i = 0; i < chairsUp.count; i++) {
      const s = (d + (i + 1) * CHAIR_GAP) % line.total;
      along(line.up, s, p); along(line.up, s + 4, q);
      rot.setFromAxisAngle(Y, Math.atan2(q.x - p.x, q.z - p.z));
      chairsUp.setMatrixAt(i, m.compose(p, rot, one)); padsUp.setMatrixAt(i, m);
      // Riders going up keep some bubbles down, some up; empty chairs come down with them closed.
      bm2.copy(m).multiply((i * 7) % 5 < 3 && !CABIN ? bOpen : bShut); bubblesUp.setMatrixAt(i, bm2); rimsUp.setMatrixAt(i, bm2);
      const s2 = (line.total - d + i * CHAIR_GAP + CHAIR_GAP / 2) % line.total;
      along(line.down, s2, p); along(line.down, s2 + 4, q);
      rot.setFromAxisAngle(Y, Math.atan2(q.x - p.x, q.z - p.z));
      chairsDown.setMatrixAt(i, m.compose(p, rot, one)); padsDown.setMatrixAt(i, m);
      bm2.copy(m).multiply(bShut); bubblesDown.setMatrixAt(i, bm2); rimsDown.setMatrixAt(i, bm2);
    }
    for (const c of [chairsUp, padsUp, chairsDown, padsDown, bubblesUp, bubblesDown, rimsUp, rimsDown]) c.instanceMatrix.needsUpdate = true;
    bubbleOpen += ((CABIN ? 0 : bubbleWant) - bubbleOpen) * Math.min(1, dt * 2.5);
    bubbleMatrix(bubbleOpen, myBubble.matrix);

    const k = Math.min(1, dt * 16); // the gyro is smooth already: follow it closely
    look.yaw += (clamp(look.dragYaw + (look.phone?.yaw || 0), -1.3, 1.3) - look.yaw) * k;
    look.pitch += (clamp(look.dragPitch + (look.phone?.pitch || 0), -0.7, 0.35) - look.pitch) * k;
    if (top.phase) { top.step(now, dt); if (top.render(now / 1000)) return; sun.position.copy(top.focus).addScaledVector(sun.userData.dir, 600); sun.target.position.copy(top.focus); names.visible = top.phase !== "ski"; fadeNames(names, camera); renderer.render(scene, camera); top.hud?.(); return; }
    sit(ctx.rider, look.yaw);
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), view = dir.applyAxisAngle(Y, look.yaw);
    // Over the rider's shoulder (they sit left of the hanger), a little above, looking slightly down.
    const head = myChair.position.clone().add(new THREE.Vector3(Math.cos(yaw) * MY_SEAT, -1.5, -Math.sin(yaw) * MY_SEAT));
    // Behind and above a chair; behind a cabin at window height, looking in through its back glass.
    if (CABIN) camera.position.copy(head).addScaledVector(view, -4.2).add(new THREE.Vector3(0, 0.35, 0));
    else camera.position.copy(head).addScaledVector(view, -4.5).add(new THREE.Vector3(0, 2.2, 0));
    // Look up the slope, not at a fixed angle: aim 30 m ahead on the line, a little below the rope, so
    // the snow ahead (higher than the chair on the way up) and the names carved in it stay in view.
    const e = Math.min(d + 30, line.total); // 30 m of line ahead, even at the very top
    const ahead = along(line.up, e, new THREE.Vector3()).sub(along(line.up, e - 30, new THREE.Vector3())).add(along(line.up, d, new THREE.Vector3())).sub(head).applyAxisAngle(Y, look.yaw);
    camera.lookAt(head.clone().add(ahead).add(new THREE.Vector3(0, -12 + 30 * Math.tan(look.pitch), 0)));
    sun.position.copy(head).addScaledVector(sun.userData.dir, 400);
    sun.target.position.copy(head);
    fadeNames(names, camera);
    renderer.render(scene, camera);
  });
}
main().catch((e) => { $("status").textContent = `加载失败：${e.message}`; console.error(e); });
translatePage(); // English, if chosen on the start page
