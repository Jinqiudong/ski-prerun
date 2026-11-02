// Art-direction test: riding American Flyer in two looks, A (semi-realistic, like Grand Mountain Adventure 2)
// and C (stylised, like Lonely Mountains: Snow Riders). Same terrain, lift line, forest and camera; only the
// assets, materials and light change, so the two can be compared fairly.
import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Terrain, treeMaskFn, farTerrain } from "./world.js?v=5";
import { riderModel, loadAvatar, applyPose } from "./rider.js?v=5";
import { snowNames, fadeNames, trailSigns } from "./snownames.js?v=3";

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

const DESC = {
  A: "A 半写实：分层下垂的云杉、带压雪条纹的雪道、带蓝色防风罩的六人吊椅（American Flyer 实物就是这种）、真实天空和远山雾气",
  C: "C 风格化：块面感的地形和树、柔和的粉蓝色调、干净的色块和雾，像一张插画",
};

let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ---------- Shared: the lift line, its towers and ropes ----------
// Chairs per lift. Verified: American Flyer is a Leitner-Poma detachable six-pack with blue bubbles (2018,
// 182 chairs, 5 m/s). The other six-packs are from news of Copper's Leitner-Poma lifts; lifts not listed
// are drawn as quads until checked.
const LIFT_KIND = { "American Flyer": { seats: 6, bubble: true }, "American Eagle": { seats: 6 }, "Super Bee": { seats: 6 }, "Timberline Express": { seats: 6 } };
const TOWER_EVERY = 85, ROPE_H = 11.5, STATION_H = 3.5, CHAIR_GAP = 33, SPEED = 5;
let HALF_GAUGE = 3.3, SEAT_X = [], MY_SEAT = 0, HAS_BUBBLE = false;
function setLiftKind(name) {
  const k = LIFT_KIND[name] || { seats: 4 };
  const gap = 0.64;
  SEAT_X = Array.from({ length: k.seats }, (_, i) => (i - (k.seats - 1) / 2) * gap);
  MY_SEAT = SEAT_X[1];
  HAS_BUBBLE = !!k.bubble;
  HALF_GAUGE = k.seats === 6 ? 3.3 : 2.7;
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
function chairParts() {
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
    const x = (SEAT_X[i] + SEAT_X[i + 1]) / 2;
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
// A: a spruce of drooping, ragged tiers, snow lying on the upper ones. Unit height, ~260 triangles.
function spruceA() {
  const pos = [], col = [];
  const dark = new THREE.Color(0x173326), tip = new THREE.Color(0x2c553b), snow = new THREE.Color(0xeef3fa), c = new THREE.Color();
  const N = 11, K = 11;
  const push = (x, y, z, color) => { pos.push(x, y, z); col.push(color.r, color.g, color.b); };
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), y = 0.12 + t * 0.8, r = 0.3 * Math.pow(1 - t, 0.9) + 0.035, droop = 0.07 + r * 0.25;
    const rot = rand() * 6.28, ring = [];
    for (let k = 0; k < K * 2; k++) {
      const a = rot + (k / (K * 2)) * Math.PI * 2, rr = r * (k % 2 ? 0.6 : 1) * (0.85 + rand() * 0.3);
      const snowy = Math.min(0.9, Math.max(0, (0.35 + t * 0.5) * (rand() * 1.3 - 0.15)));
      ring.push([Math.cos(a) * rr, y - droop * (k % 2 ? 0.6 : 1) - rand() * 0.015, Math.sin(a) * rr, c.copy(tip).lerp(snow, snowy).clone()]);
    }
    const centre = c.copy(dark).lerp(snow, t * 0.25).clone();
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length];
      push(0, y + 0.05, 0, centre); push(a[0], a[1], a[2], a[3]); push(b[0], b[1], b[2], b[3]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const trunk = new THREE.CylinderGeometry(0.018, 0.03, 0.25, 6).translate(0, 0.12, 0).toNonIndexed();
  trunk.setAttribute("color", new THREE.Float32BufferAttribute(new Array(trunk.attributes.position.count).fill([0.27, 0.19, 0.13]).flat(), 3));
  trunk.deleteAttribute("uv");
  const out = mergeGeometries([geo, trunk.deleteAttribute("normal") && trunk]);
  out.computeVertexNormals();
  return out;
}

// Stacked cones, flat-shaded: C's tree everywhere, and A's tree far from the lift.
function coneTree(green, snowCol, sides) {
  const parts = [];
  for (const [y, h, r] of [[0.08, 0.42, 0.3], [0.36, 0.36, 0.22], [0.6, 0.4, 0.14]]) {
    const g = new THREE.ConeGeometry(r, h, sides, 1).translate(0, y + h / 2, 0).toNonIndexed();
    g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, col = [];
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const top = (p.getY(i) - y) / h;
      c.set(green).lerp(new THREE.Color(snowCol), top > 0.55 && n.getY(i) > 0.3 ? 0.85 : 0);
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.deleteAttribute("uv");
    parts.push(g);
  }
  const trunk = new THREE.CylinderGeometry(0.02, 0.03, 0.12, 5).translate(0, 0.06, 0).toNonIndexed();
  trunk.setAttribute("color", new THREE.Float32BufferAttribute(new Array(trunk.attributes.position.count).fill([0.35, 0.25, 0.2]).flat(), 3));
  trunk.deleteAttribute("uv");
  return mergeGeometries([...parts, trunk]);
}

// Where trees stand: the OSM woods near the lift, kept off the runs and out of the cleared lift line.
function treeSpots(T, R, mask, line) {
  const xs = line.ground.map((p) => p.x), zs = line.ground.map((p) => p.z), M = 900;
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
    if (d < 16) continue; // the lift line is cleared
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
  const g = c.getContext("2d"), grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.32, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
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

// Copper's weather: snow in the last three days whitens the trees; snowing now makes it fall.
// ?snow=0..1 and ?falling=1 override it for previews.
async function weather(params, flakes) {
  let recent = null, now = false;
  try {
    const w = await (await fetch("https://api.open-meteo.com/v1/forecast?latitude=39.4775&longitude=-106.1605&current=weather_code,snowfall&daily=snowfall_sum&past_days=3&forecast_days=1&timezone=America%2FDenver")).json();
    recent = w.daily.snowfall_sum.slice(0, 3).reduce((a, b) => a + (b || 0), 0);
    now = (w.current.snowfall || 0) > 0 || [71, 73, 75, 77, 85, 86].includes(w.current.weather_code);
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
function snowA(tex) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
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
        normal = normalize(normal + (viewMatrix * vec4(wp, 0.0)).xyz);`);
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
  const pos = [], uv = [], idx = [];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i], [ax, az] = pts[Math.max(0, i - 1)], [bx, bz] = pts[Math.min(pts.length - 1, i + 1)];
    let dx = bx - ax, dz = bz - az;
    const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    if (i) s += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    for (const sd of [-1, 1]) {
      const px = x - dz * sd * width / 2, pz = z + dx * sd * width / 2;
      pos.push(px, T.heightAt(px, pz) + lift, pz);
      uv.push(sd < 0 ? 0 : width / 4, s / 20);
    }
    if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// ---------- Lift hardware ----------
function towerGeometries(line, look) {
  const metal = [], dark = [];
  for (let i = 1; i < line.towers.length - 1; i++) {
    if (line.towers[i].station) continue;
    const { p } = line.towers[i];
    const top = ROPE_H - 0.9;
    const yaw = Math.atan2(line.dir.x, line.dir.z);
    const place = (g) => g.rotateY(yaw).translate(p.x, p.y, p.z);
    metal.push(place(new THREE.CylinderGeometry(0.32, 0.55, top, look === "A" ? 10 : 6).translate(0, top / 2, 0)));
    metal.push(place(new THREE.BoxGeometry(HALF_GAUGE * 2 + 1.4, 0.45, 0.45).translate(0, top, 0)));
    if (look === "A") metal.push(place(new THREE.CylinderGeometry(0.9, 1.1, 0.5, 10).translate(0, 0.25, 0))); // footing
    for (const s of [-1, 1]) {
      const x = s * HALF_GAUGE;
      metal.push(place(new THREE.BoxGeometry(0.2, 0.22, 3.4).translate(x, ROPE_H - 0.45, 0))); // sheave beam
      metal.push(place(new THREE.BoxGeometry(0.12, 0.5, 0.12).translate(x, ROPE_H - 0.68, 0)));
      if (look === "A") for (let w = 0; w < 4; w++) dark.push(place(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 14).rotateZ(Math.PI / 2).translate(x, ROPE_H - 0.24, -1.2 + w * 0.8)));
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

function terminal(p, dir, look, mats, { name, alt, top, upSide }) {
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
  add(new THREE.BoxGeometry(W * 2 + 6, 8, 26), snow, 0, -3.75, 6); // deep, so it meets the slope below
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

// ---------- Skies ----------
function gradientSky(top, horizon, bottom) {
  const geo = new THREE.SphereGeometry(20000, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: "varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }",
    fragmentShader: "uniform vec3 top, horizon, bottom; varying vec3 vP; void main() { float h = vP.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.6)) : mix(horizon, bottom, pow(-h, 0.5)); gl_FragColor = vec4(c, 1.0); }",
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -1;
  return m;
}

// ---------- The scene for a look ----------
let world = null, sun = null, myChair = null, chairsUp = null, chairsDown = null, padsUp = null, padsDown = null;
let bubblesUp = null, bubblesDown = null, rimsUp = null, rimsDown = null, myBubble = null, bubbleOpen = 1, bubbleWant = 1;
function build(look, ctx) {
  if (world) { scene.remove(world); world.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } }); }
  world = new THREE.Group();
  scene.add(world);
  const { T, R, line, spots, tex, far, rider } = ctx;
  const A = look === "A";
  seed = 7;

  // Light, sky and air.
  scene.background = null;
  renderer.toneMapping = A ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  renderer.toneMappingExposure = A ? 0.95 : 1;
  const sunDir = A ? new THREE.Vector3(-0.55, 0.45, 0.7).normalize() : new THREE.Vector3(-0.6, 0.55, 0.58).normalize();
  if (A) {
    const sky = new Sky();
    sky.scale.setScalar(20000);
    sky.material.uniforms.turbidity.value = 3;
    sky.material.uniforms.rayleigh.value = 1.2;
    sky.material.uniforms.mieCoefficient.value = 0.004;
    sky.material.uniforms.mieDirectionalG.value = 0.8;
    sky.material.uniforms.sunPosition.value.copy(sunDir);
    world.add(sky);
    const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
    const s2 = new Sky(); s2.scale.setScalar(1000); s2.material.uniforms.sunPosition.value.copy(sunDir); env.add(s2);
    scene.environment = pm.fromScene(env).texture;
    scene.environmentIntensity = 0.5;
    scene.fog = new THREE.FogExp2(0xc6d6e8, 0.00016);
  } else {
    world.add(gradientSky(0x86b6e6, 0xf3dccd, 0xe7e9f2));
    scene.environment = null;
    scene.fog = new THREE.Fog(0xe9e0e4, 400, 7500);
  }
  world.add(new THREE.HemisphereLight(A ? 0xdbe8ff : 0xcfe0ff, A ? 0x8f9bb5 : 0xf0d8c8, A ? 0.55 : 1.15));
  sun = new THREE.DirectionalLight(A ? 0xfff1dd : 0xffe4c8, A ? 3.2 : 1.9);
  sun.userData.dir = sunDir;
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 1, far: 900 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.6;
  world.add(sun, sun.target);
  if (snowing) setSnowyAir();

  // Ground and far ranges.
  const groundMat = A ? snowA(tex) : new THREE.MeshLambertMaterial({ color: 0xe9eef6, flatShading: true });
  const ground = new THREE.Mesh(ctx.groundGeo, groundMat);
  ground.receiveShadow = true;
  world.add(ground);
  const ranges = farTerrain(far, T);
  ranges.material = A ? snowA(tex) : new THREE.MeshLambertMaterial({ color: 0xdfe3ee, flatShading: true });
  world.add(ranges);

  // Runs near the lift.
  const runMat = A
    ? new THREE.MeshStandardMaterial({ map: tex.cord, color: 0xffffff, roughness: 0.62, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
    : new THREE.MeshLambertMaterial({ color: 0xfbfcff, flatShading: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const near = (pts) => pts.some(([x, z]) => line.up.some((g, i) => i % 25 === 0 && Math.hypot(g.x - x, g.z - z) < 1400));
  for (const run of R.runs) {
    if (run.area || !near(run.pts)) continue;
    const m = new THREE.Mesh(runRibbon(T, run.pts, 30, 0.25), runMat);
    m.receiveShadow = true;
    world.add(m);
  }

  // Forest: detailed spruce near the lift in A, cones further out; cones everywhere in C.
  const treeMat = A ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }) : new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const height = (s) => 13 + s.v * 13;
  if (A) {
    const branchMat = foliageMat(tex.branch, tex.branchSnow, true), crownMat = foliageMat(tex.crown, tex.crownSnow, false);
    const bark = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.95 });
    for (const [list, detail] of [[spots.filter((s) => s.d < 380), 1], [spots.filter((s) => s.d >= 380), 0]]) {
      const tree = cardSpruce(detail);
      world.add(plant(list, tree.branches, branchMat, height), plant(list, tree.crown, crownMat, height), plant(list, tree.trunk, bark, height));
    }
  } else {
    world.add(plant(spots, coneTree(0x3f8574, 0xfaf6f2, 6), treeMat, height));
  }

  // Lift: towers, ropes, terminals, chairs.
  const metalMat = A ? new THREE.MeshStandardMaterial({ color: 0x8b929c, metalness: 0.65, roughness: 0.42 }) : new THREE.MeshLambertMaterial({ color: 0xf2efe9, flatShading: true });
  const darkMat = A ? new THREE.MeshStandardMaterial({ color: 0x23272e, metalness: 0.5, roughness: 0.5 }) : new THREE.MeshLambertMaterial({ color: 0x5a5d6a });
  const tg = towerGeometries(line, look);
  const towers = new THREE.Mesh(tg.metal, metalMat);
  towers.castShadow = towers.receiveShadow = true;
  world.add(towers);
  if (tg.dark) { const d = new THREE.Mesh(tg.dark, darkMat); d.castShadow = true; world.add(d); }
  const ropeMat = A ? new THREE.MeshStandardMaterial({ color: 0x2a2e35, metalness: 0.7, roughness: 0.35 }) : new THREE.MeshLambertMaterial({ color: 0x4d5060 });
  for (const path of [line.up, line.down]) world.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), path.length, A ? 0.03 : 0.045, 5), ropeMat));
  const houseMats = { house: A ? new THREE.MeshStandardMaterial({ color: 0x9a6b45, roughness: 0.8 }) : new THREE.MeshLambertMaterial({ color: 0xd98c6a, flatShading: true }), roof: A ? new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.6 }) : new THREE.MeshLambertMaterial({ color: 0x4f5f78 }), metal: metalMat };
  const g0 = line.ground[0], g1 = line.ground[line.ground.length - 1];
  const altOf = (q) => Math.round(T.data.hmin + T.heightAt(q.x, q.z));
  // Chairs go up on the +side rope: at the bottom that is local +x, at the top (turned round) local -x.
  world.add(terminal(line.towers[0].p.clone(), line.dir, look, { ...houseMats, dark: darkMat }, { name: ctx.lift.name, alt: altOf(g0), top: false, upSide: 1 }));
  world.add(terminal(line.towers[line.towers.length - 1].p.clone(), line.dir.clone().negate(), look, { ...houseMats, dark: darkMat }, { name: ctx.lift.name, alt: altOf(g1), top: true, upSide: -1 }));

  const parts = ctx.chair;
  const chairMetal = A ? metalMat : new THREE.MeshLambertMaterial({ color: 0x6b6f7d, flatShading: true });
  const padMat = A ? new THREE.MeshStandardMaterial({ color: 0x1f2c47, roughness: 0.55 }) : new THREE.MeshLambertMaterial({ color: 0xe0665a, flatShading: true });
  const n = Math.floor(line.total / CHAIR_GAP);
  chairsUp = new THREE.InstancedMesh(parts.metal, chairMetal, n); padsUp = new THREE.InstancedMesh(parts.pad, padMat, n);
  chairsDown = new THREE.InstancedMesh(parts.metal, chairMetal, n); padsDown = new THREE.InstancedMesh(parts.pad, padMat, n);
  // Copper's signature blue bubbles: tinted, glossy, see-through.
  const bubbleMat = new THREE.MeshStandardMaterial({ color: 0x2a6fe0, transparent: true, opacity: A ? 0.42 : 0.6, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false });
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
  if (!TRIP) $("desc").textContent = DESC[look];
}

// ---------- Looking around (same as the game: phone turn or drag, limited like a seated rider) ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const look = { yaw: 0, pitch: 0, dragYaw: 0, dragPitch: 0, base: null, phone: null };
addEventListener("deviceorientation", (e) => {
  if (e.alpha == null) return;
  if (!look.base) look.base = { alpha: e.alpha, beta: e.beta };
  const dy = ((e.alpha - look.base.alpha + 540) % 360) - 180;
  look.phone = { yaw: (dy * Math.PI) / 180, pitch: ((e.beta - look.base.beta) * Math.PI) / 180 };
});
const askMotion = () => { if (typeof DeviceOrientationEvent?.requestPermission === "function") DeviceOrientationEvent.requestPermission().catch(() => {}); };
for (const ev of ["touchend", "click"]) addEventListener(ev, askMotion, { once: true, capture: true });
let drag = null;
renderer.domElement.addEventListener("pointerdown", (e) => (drag = { x: e.clientX, y: e.clientY, yaw: look.dragYaw, pitch: look.dragPitch }));
addEventListener("pointermove", (e) => {
  if (!drag) return;
  look.dragYaw = clamp(drag.yaw + ((e.clientX - drag.x) / innerWidth) * 2.4, -1.3, 1.3);
  look.dragPitch = clamp(drag.pitch - ((e.clientY - drag.y) / innerHeight) * 1.2, -0.7, 0.35);
});
addEventListener("pointerup", () => (drag = null));

function sit(model, lookYaw) {
  const u = model.userData;
  u.yaw.rotation.set(0, 0, 0); u.pivot.rotation.set(0, 0, 0); u.stance.rotation.y = 0;
  applyPose(model, { sit: true, knee: 0, fwd: 0.05, twist: lookYaw * 0.25, armsOut: 0, armsFwd: 0.5, elbow: 0.8, headYaw: clamp(lookYaw * 0.75, -1, 1), spread: 0.08 });
}

// Opened from the miniature with ?lift=NAME: a real ride, bottom to top, then the arrival card.
const params = new URLSearchParams(location.search), TRIP = params.has("lift");
async function main() {
  const [R, far] = await Promise.all([fetch("data/copper.json").then((r) => r.json()), fetch("data/copper-far.json").then((r) => r.json())]);
  const load = (f, srgb) => new Promise((res) => new THREE.TextureLoader().load(`assets/tex/${f}`, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    res(t);
  }));
  const [snowD, snowN, rockD, branch, branchSnow, crown, crownSnow] = await Promise.all([load("snow_02_diff_1k.jpg", true), load("snow_02_nor_gl_1k.jpg"), load("aerial_rocks_02_diff_1k.jpg", true),
    load("spruce_branch.png", true), load("spruce_snow.png"), load("spruce_crown.png", true), load("spruce_crown_snow.png")]);
  for (const t of [branch, branchSnow, crown, crownSnow]) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  await loadAvatar();
  const T = new Terrain(R), mask = treeMaskFn(R, T);
  const lift = R.lifts.find((l) => l.name === (params.get("lift") || "American Flyer")) || R.lifts.find((l) => l.name === "American Flyer");
  setLiftKind(lift.name);
  $("liftName").textContent = TRIP ? lift.name : `${lift.name} · 画面样稿`;
  $("bubble").hidden = !HAS_BUBBLE;
  const line = liftLine(T, lift);
  const ctx = { T, R, far, line, spots: treeSpots(T, R, mask, line), tex: { snowD, snowN, rockD, branch, branchSnow, crown, crownSnow, cord: corduroy() }, groundGeo: terrainGeometry(T), chair: chairParts(), rider: riderModel("ski"), lift };
  ctx.tex.cord.repeat.set(1, 1);
  const current = "A"; // semi-realistic, decided 2026-11-01
  build(current, ctx);
  $("status").remove();
  // Run names carved into the snow, met on the way up.
  const g0 = line.ground[0], g1 = line.ground[line.ground.length - 1];
  const names = snowNames(T, R, lift, g1.x - g0.x, g1.z - g0.z, renderer);
  scene.add(names);
  scene.add(trailSigns(T, R, lift, g1.x - g0.x, g1.z - g0.z, renderer));
  const flakes = snowfall();
  scene.add(flakes);
  weather(params, flakes);

  // Ride a stretch of the line over and over: from a quarter of the way up to about two thirds.
  const d0 = TRIP ? 14 : line.total * 0.22, d1 = TRIP ? line.total - 9 : line.total * 0.66; // from the loading point to the unload ramp
  let fast = false, arrived = false;
  const fastBtn = $("fast");
  fastBtn.hidden = !TRIP;
  for (const [ev, v] of [["pointerdown", true], ["pointerup", false], ["pointerleave", false], ["pointercancel", false]]) fastBtn.addEventListener(ev, (e) => { e.stopPropagation(); fast = v; });
  $("skip").hidden = !TRIP;
  $("skip").addEventListener("click", () => (d = d1));
  const kind = (() => { try { return JSON.parse(localStorage.getItem("prerun") || "{}").kind || "ski"; } catch { return "ski"; } })();
  $("again").addEventListener("click", () => location.reload());
  $("skiDown").addEventListener("click", () => (location.href = `./?lift=${encodeURIComponent(lift.name)}&kind=${kind}`));
  const mins = (m) => (m < 60 ? `${Math.max(1, Math.round(m))} 秒` : `${Math.round(m / 60)} 分钟`);
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
    if (!params.has("still") && !arrived) d += SPEED * (fast ? 20 : 3) * dt;
    if (d > d1) {
      if (TRIP) {
        d = d1;
        if (!arrived) { arrived = true; $("arrive").hidden = false; $("fast").hidden = $("skip").hidden = true; $("arriveTitle").textContent = `到山顶了 · ${lift.name}`; }
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
      bm2.copy(m).multiply((i * 7) % 5 < 3 ? bOpen : bShut); bubblesUp.setMatrixAt(i, bm2); rimsUp.setMatrixAt(i, bm2);
      const s2 = (line.total - d + i * CHAIR_GAP + CHAIR_GAP / 2) % line.total;
      along(line.down, s2, p); along(line.down, s2 + 4, q);
      rot.setFromAxisAngle(Y, Math.atan2(q.x - p.x, q.z - p.z));
      chairsDown.setMatrixAt(i, m.compose(p, rot, one)); padsDown.setMatrixAt(i, m);
      bm2.copy(m).multiply(bShut); bubblesDown.setMatrixAt(i, bm2); rimsDown.setMatrixAt(i, bm2);
    }
    for (const c of [chairsUp, padsUp, chairsDown, padsDown, bubblesUp, bubblesDown, rimsUp, rimsDown]) c.instanceMatrix.needsUpdate = true;
    bubbleOpen += (bubbleWant - bubbleOpen) * Math.min(1, dt * 2.5);
    bubbleMatrix(bubbleOpen, myBubble.matrix);

    const k = Math.min(1, dt * 6);
    look.yaw += (clamp(look.dragYaw + (look.phone?.yaw || 0), -1.3, 1.3) - look.yaw) * k;
    look.pitch += (clamp(look.dragPitch + (look.phone?.pitch || 0), -0.7, 0.35) - look.pitch) * k;
    sit(ctx.rider, look.yaw);
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), view = dir.applyAxisAngle(Y, look.yaw);
    // Over the rider's shoulder (they sit left of the hanger), a little above, looking slightly down.
    const head = myChair.position.clone().add(new THREE.Vector3(Math.cos(yaw) * MY_SEAT, -1.5, -Math.sin(yaw) * MY_SEAT));
    camera.position.copy(head).addScaledVector(view, -4.5).add(new THREE.Vector3(0, 2.2, 0));
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
