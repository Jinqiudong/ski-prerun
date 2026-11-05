// Lifts: carriers (chairs, cabins, T-bars), towers, terminals and the haul rope. The rope runs along +z
// (the way up) at y = 0 for carriers; towers and terminals stand on y = 0 and carry it at their own height.
import * as THREE from "three";
import { box, tube, pipe, cyl, at, group, mat, plate, PALETTE } from "./kit.js";

const SEAT = 0.6; // width of one seat

// A chair: fixed grip (thin frame, slatted seats) or detachable (padded, optional bubble).
export function chair({ seats = 4, detach = seats >= 4, bubble = false, paint = PALETTE.paint, pad = PALETTE.pad, glass = PALETTE.glass, bar = "down" } = {}) {
  const W = seats * SEAT, x0 = -W / 2, sy = -2.7, back = -0.42, g = group();
  g.add(at(box(0.34, 0.26, 0.42, "dark"), 0, -0.05, 0)); // grip
  g.add(pipe([[0, -0.15, 0], [0, -1.7, 0], [0, -2.15, back], [0, sy + 0.25, back]], detach ? 0.06 : 0.045, "paint", paint, 0.35)); // hanger
  g.add(tube([x0, sy + 0.25, back], [-x0, sy + 0.25, back], 0.05, "paint", paint)); // back frame
  g.add(tube([x0, sy - 0.08, 0.05], [-x0, sy - 0.08, 0.05], 0.045, "paint", paint)); // seat frame
  for (const s of [-1, 1]) g.add(pipe([[s * W / 2, sy + 0.25, back], [s * W / 2, sy - 0.08, back], [s * W / 2, sy - 0.08, 0.3]], 0.04, "paint", paint, 0.1)); // ends
  for (let i = 0; i < seats; i++) {
    const cx = x0 + SEAT * (i + 0.5);
    if (detach) {
      g.add(at(box(SEAT - 0.06, 0.13, 0.5, "pad", pad, 0.05), cx, sy, 0.05));
      g.add(at(box(SEAT - 0.06, 0.6, 0.12, "pad", pad, 0.05), cx, sy + 0.32, back + 0.02, -0.18));
    } else for (let k = 0; k < 3; k++) { // slats
      g.add(at(box(SEAT - 0.08, 0.04, 0.12, "wood"), cx, sy, -0.1 + k * 0.15));
      g.add(at(box(SEAT - 0.08, 0.12, 0.04, "wood"), cx, sy + 0.15 + k * 0.16, back + 0.03));
    }
  }
  // Restraint bar with footrest: hinged above the outer seats, lowered in front of the riders.
  const yb = bar === "down" ? sy + 0.45 : sy + 1.4, zb = bar === "down" ? 0.55 : -0.1;
  for (const s of [-1, 1]) g.add(pipe([[s * (W / 2 - 0.05), sy + 0.9, back], [s * (W / 2 - 0.05), yb, zb]], 0.03, "steel"));
  g.add(tube([x0 + 0.05, yb, zb], [-x0 - 0.05, yb, zb], 0.03, "steel"));
  if (bar === "down") for (const s of [-0.5, 0.5]) {
    g.add(tube([s * W * 0.5, yb, zb], [s * W * 0.5, sy - 0.75, zb + 0.08], 0.025, "steel"));
    g.add(at(box(W * 0.42, 0.04, 0.22, "steel"), s * W * 0.5, sy - 0.75, zb + 0.08));
  }
  if (bubble) g.add(bubbleShell(W, sy, back, glass, paint));
  return g;
}

// The bubble lowered: a tinted half shell from over the heads down in front to the shins.
function bubbleShell(W, sy, back, glass, paint) {
  const r = 1.0, c = [0, sy + 0.55, back + 0.1], t0 = -0.9, L = 2.75;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(r, r, W + 0.12, 32, 1, true, t0, L), mat("glass", glass));
  shell.rotation.z = Math.PI / 2; shell.position.set(...c); shell.renderOrder = 2;
  const g = group(shell);
  for (const s of [-1, 1]) { // the painted rim at each end
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 6, 32, L), mat("paint", paint));
    rim.rotation.set(0, Math.PI / 2, Math.PI - t0 - L); rim.position.set(s * (W / 2 + 0.06), c[1], c[2]);
    g.add(rim);
  }
  return g;
}

// A gondola cabin: painted lower body, a band of glass, a roof, the hanger arm up to the grip.
export function cabin({ seats = 8, paint = PALETTE.paint, glass = PALETTE.glass } = {}) {
  const w = seats >= 10 ? 2.2 : seats >= 8 ? 1.95 : 1.6, d = seats >= 8 ? 1.7 : 1.5, h = 2.05, top = -1.1, g = group();
  g.add(at(box(0.34, 0.26, 0.42, "dark"), 0, -0.05, 0));
  g.add(pipe([[0, -0.15, 0], [0, -0.55, 0], [0, -0.75, -0.25], [0, top + 0.05, -0.25]], 0.07, "dark", undefined, 0.2));
  g.add(at(box(w, h * 0.5, d, "paint", paint, 0.18), 0, top - h * 0.72, 0)); // lower body
  g.add(at(box(w - 0.04, h * 0.42, d - 0.04, "glass", glass, 0.2), 0, top - h * 0.3, 0)); // glass band
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(box(0.07, h * 0.42, 0.07, "paint", paint), sx * (w / 2 - 0.06), top - h * 0.3, sz * (d / 2 - 0.06))); // pillars
  g.add(at(box(w + 0.04, 0.16, d + 0.04, "paint", paint, 0.07), 0, top - 0.06, 0)); // roof
  g.add(at(box(0.04, h * 0.85, d * 0.5, "dark"), w / 2 + 0.005, top - h * 0.55, 0)); // door seam
  g.add(at(box(w * 0.9, 0.05, 0.4, "steel"), 0, top - h - 0.03, 0)); // skirt
  // ski holders on the outside
  for (const sz of [-0.3, 0.3]) g.add(at(box(0.08, 0.6, 0.06, "steel"), -w / 2 - 0.05, top - h * 0.55, sz));
  return g;
}

// A T-bar: spring box at the rope, a cord, the T for two riders.
export function tbar({ paint = PALETTE.orange } = {}) {
  const g = group(at(box(0.25, 0.2, 0.3, "dark"), 0, -0.05, 0));
  g.add(at(cyl(0.12, 0.5, "paint", paint), 0, -0.4, 0));
  g.add(tube([0, -0.65, 0], [0, -3.3, 0.6], 0.015, "rope"));
  g.add(at(box(0.08, 0.5, 0.08, "dark"), 0, -3.5, 0.62));
  g.add(at(cyl(0.04, 1.1, "paint", paint), 0, -3.75, 0.62, 0, 0, Math.PI / 2));
  return g;
}

// A tower: footing, tapered tube, crossarm, a sheave train each side, ladder and a catwalk.
export function tower({ h = 12, gauge = 5.4, paint = PALETTE.steel, wheels = 6, num = 7, surface = false } = {}) {
  const g = group(at(box(1.6, 0.6, 1.6, "concrete"), 0, 0.2, 0));
  g.add(at(cyl(0.38, h, "paint", paint, 18, 0.28), 0, h / 2, 0));
  const arm = surface ? gauge / 2 + 0.6 : gauge + 0.9;
  g.add(at(box(arm, 0.42, 0.42, "paint", paint), surface ? arm / 2 - 0.3 : 0, h, 0));
  for (const s of surface ? [1] : [-1, 1]) {
    const x = s * gauge / 2, len = wheels * 0.48;
    g.add(at(box(0.18, 0.5, 0.3, "paint", paint), x, h + 0.35, 0));
    g.add(at(box(0.12, 0.22, len, "dark"), x, h + 0.6, 0));
    for (let i = 0; i < wheels; i++) g.add(at(cyl(0.2, 0.1, "dark", undefined, 14), x, h + 0.78, -len / 2 + 0.24 + i * 0.48, 0, 0, Math.PI / 2));
    if (!surface) { // catwalk with a rail
      g.add(at(box(1.2, 0.05, 0.6, "steel"), x - s * 0.9, h + 0.05, -0.55));
      g.add(tube([x - s * 1.5, h + 0.9, -0.85], [x - s * 0.3, h + 0.9, -0.85], 0.025, "steel"));
      for (const xx of [x - s * 1.5, x - s * 0.3]) g.add(tube([xx, h + 0.05, -0.85], [xx, h + 0.9, -0.85], 0.025, "steel"));
    }
  }
  for (const s of [-0.18, 0.18]) g.add(tube([s, 0.5, -0.4], [s, h - 0.2, -0.4], 0.02, "steel")); // ladder
  for (let y = 0.8; y < h - 0.2; y += 0.45) g.add(tube([-0.18, y, -0.4], [0.18, y, -0.4], 0.015, "steel"));
  if (num) g.add(at(plate(0.5, 0.4, (x, w, hh) => { x.fillStyle = "#f3ead8"; x.fillRect(0, 0, w, hh); x.fillStyle = "#22344d"; x.font = `bold ${hh * 0.75}px Georgia, serif`; x.textAlign = "center"; x.fillText(String(num), w / 2, hh * 0.8); }), 0, 3, 0.4));
  return { root: g, rope: h + 0.98 };
}

// A detachable terminal: concrete deck, the long hood over the bullwheel and the detach rail, a canopy
// over the loading point, the operator's hut and the lift's name board.
export function terminalDetach({ paint = PALETTE.paint, gauge = 5.4, name = "American Flyer", roof = PALETTE.snow } = {}) {
  const g = group(at(box(10, 1, 13, "concrete"), 0, 0.5, -2));
  g.add(at(box(1.4, 4.2, 1.4, "paint", paint, 0.1), 0, 3.1, -5)); // column
  g.add(at(box(gauge + 2.2, 2.6, 15, "paint", paint, 0.9), 0, 6.3, -2.5)); // hood
  g.add(at(box(gauge + 1.6, 0.35, 14, "snow", roof, 0.15), 0, 7.65, -2.5)); // snow on top
  g.add(at(box(gauge + 2.4, 0.4, 15.2, "dark", undefined, 0.15), 0, 5.0, -2.5)); // skirt (detach rail)
  g.add(at(box(gauge + 2.25, 0.3, 14.6, "cream"), 0, 6.9, -2.5)); // a painted band
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) g.add(at(box(0.05, 0.7, 1.4, "glass"), sx * (gauge / 2 + 1.12), 6.0, -8.5 + i * 2.2)); // service windows
  // loading carpet and maze
  g.add(at(box(4.2, 0.08, 2.2, "dark"), -gauge / 2, 1.05, 3.4));
  for (const z of [5.5, 7.5]) g.add(tube([-gauge / 2 - 2.4, 1.1, z], [-gauge / 2 + 2.4, 1.1, z], 0.04, "orange"));
  for (const x of [-gauge / 2 - 2.4, -gauge / 2 + 2.4]) for (const z of [5.5, 7.5]) g.add(tube([x, 0, z], [x, 1.15, z], 0.04, "steel"));
  g.add(hut(3.6, -0.5, 5.5));
  g.add(at(nameBoard(name, 3.2), 0, 8.6, 5.1));
  return g;
}

// A fixed-grip terminal: the bullwheel out in the open on a frame, a little hut beside.
export function terminalFixed({ paint = PALETTE.steel, gauge = 4.2 } = {}) {
  const g = group(at(box(5, 0.6, 5, "concrete"), 0, 0.3, -1));
  g.add(at(box(0.9, 4, 0.9, "paint", paint), 0, 2.6, -1));
  g.add(at(box(gauge + 0.6, 0.5, 1.2, "paint", paint), 0, 4.6, -1));
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(gauge / 2, 0.12, 8, 40), mat("dark"));
  wheel.rotation.x = Math.PI / 2; wheel.position.set(0, 4.95, -1); g.add(wheel);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI; g.add(tube([Math.cos(a) * gauge / 2, 4.95, -1 + Math.sin(a) * gauge / 2], [-Math.cos(a) * gauge / 2, 4.95, -1 - Math.sin(a) * gauge / 2], 0.05, "dark")); }
  g.add(at(box(gauge * 0.7, 1.4, 1.6, "paint", paint, 0.2), 0, 5.6, -1.8)); // gearbox
  g.add(hut(3.5, 0, 3));
  return g;
}

function hut(x, y, z) {
  const g = group(at(box(2.4, 2.4, 2.4, "cream"), 0, 1.2, 0));
  g.add(at(box(2.5, 0.9, 2.5, "glass"), 0, 1.65, 0));
  g.add(at(box(3.0, 0.25, 3.0, "roof"), 0, 2.55, 0));
  g.add(at(box(2.9, 0.2, 2.9, "snow", undefined, 0.08), 0, 2.75, 0));
  g.add(at(box(0.9, 1.9, 0.05, "wood"), 0.5, 0.95, 1.22));
  return at(g, x, y + 1, z);
}

export function nameBoard(name, w) {
  return plate(w, 0.7, (x, cw, ch) => {
    x.fillStyle = "#22344d"; x.fillRect(0, 0, cw, ch); x.strokeStyle = "#f3ead8"; x.lineWidth = 6; x.strokeRect(10, 10, cw - 20, ch - 20);
    x.fillStyle = "#f3ead8"; x.font = `600 ${ch * 0.5}px Georgia, serif`; x.textAlign = "center"; x.fillText(name, cw / 2, ch * 0.66);
  }, { role: "dark" });
}

// The haul rope between two points, sagging a little.
export function rope(a, b, sag = 0.6, r = 0.035) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), mid = A.clone().lerp(B, 0.5); mid.y -= sag;
  const c = new THREE.QuadraticBezierCurve3(A, mid, B);
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, 40, r, 6), mat("rope")); m.castShadow = true;
  return { mesh: m, at: (u) => c.getPoint(u) };
}
