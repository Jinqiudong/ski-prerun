// Buildings on the mountain: the mid-mountain restaurant, a warming yurt, deck furniture.
import * as THREE from "three";
import { box, tube, cyl, at, group, mat } from "./kit.js";

// A gable roof from two slabs, with snow on both.
function gable(w, d, rise, y, roof = "roof") {
  const half = Math.hypot(w / 2 + 0.6, rise), a = Math.atan2(rise, w / 2 + 0.6), g = group();
  for (const s of [-1, 1]) {
    const p = group(at(box(half, 0.3, d + 1.2, roof), 0, 0, 0), at(box(half - 0.1, 0.32, d + 1.0, "snow", undefined, 0.12), 0, 0.3, 0));
    p.position.set(s * (w / 2 + 0.6) / 2, y + rise / 2, 0); p.rotation.z = -s * a; g.add(p);
  }
  return g;
}

// The restaurant: stone footing, timber walls with tall windows, a big gable roof, chimney, deck.
export function restaurant({ w = 14, d = 10, name = "" } = {}) {
  const g = group(at(box(w, 1.2, d, "stone"), 0, 0.6, 0), at(box(w - 0.2, 4.2, d - 0.2, "timber"), 0, 3.3, 0));
  for (let i = 0; i < 5; i++) g.add(at(box(1.6, 2.6, 0.1, "glass"), -w / 2 + 1.8 + i * (w - 3.6) / 4, 3.3, d / 2 - 0.06)); // windows
  for (let i = 0; i <= 6; i++) g.add(at(box(0.18, 4.2, 0.18, "wood"), -w / 2 + 0.1 + i * (w - 0.2) / 6, 3.3, d / 2 - 0.02)); // posts
  // gable ends
  const tri = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, 3.6)]);
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.ShapeGeometry(tri), mat("timber")); m.material.side = THREE.DoubleSide; m.position.set(0, 5.4, s * (d / 2 - 0.1)); g.add(m); }
  g.add(gable(w, d, 3.6, 5.4));
  g.add(at(box(1.1, 3.5, 1.1, "stone"), w * 0.28, 8.2, -d * 0.2), at(box(1.2, 0.2, 1.2, "snow", undefined, 0.06), w * 0.28, 10, -d * 0.2));
  // the deck: boards, rail, picnic tables, parasol, ski rack
  g.add(at(box(w, 0.25, 5, "wood"), 0, 1.0, d / 2 + 2.5));
  g.add(tube([-w / 2, 1.9, d / 2 + 5], [w / 2, 1.9, d / 2 + 5], 0.06, "wood"));
  for (let i = 0; i <= 7; i++) g.add(tube([-w / 2 + i * w / 7, 1.1, d / 2 + 5], [-w / 2 + i * w / 7, 1.9, d / 2 + 5], 0.06, "wood"));
  for (const x of [-w * 0.3, 0, w * 0.3]) g.add(at(picnic(), x, 1.12, d / 2 + 2.6));
  g.add(at(parasol(), -w * 0.15, 1.12, d / 2 + 2.6));
  g.add(at(rack(), w / 2 + 2.2, 0, d / 2 + 1.5, 0, Math.PI / 2));
  return g;
}

export function picnic() {
  const g = group(at(box(1.8, 0.08, 0.8, "wood"), 0, 0.75, 0));
  for (const s of [-1, 1]) { g.add(at(box(1.8, 0.06, 0.3, "wood"), 0, 0.45, s * 0.65)); g.add(at(box(0.08, 0.75, 1.5, "wood"), s * 0.7, 0.38, 0)); }
  g.add(at(box(1.6, 0.06, 0.7, "snow", undefined, 0.03), 0, 0.82, 0));
  return g;
}
function parasol() {
  const g = group(tube([0, 0, 0], [0, 2.6, 0], 0.04, "wood"));
  g.add(at(cyl(0.02, 0.6, "red", undefined, 8, 1.4), 0, 2.4, 0));
  return g;
}
export function rack(n = 6) { // boards stand in it, nose up
  const g = group(at(box(n * 0.45, 0.1, 0.1, "wood"), 0, 1.0, 0), at(box(n * 0.45, 0.1, 0.1, "wood"), 0, 0.2, 0));
  for (const s of [-1, 1]) g.add(at(box(0.1, 1.1, 0.5, "wood"), s * n * 0.225, 0.55, 0));
  const c = [0x2f8a4e, 0xb6463b, 0x2d5fb3, 0xe8c547];
  for (let i = 0; i < n - 2; i++) g.add(at(box(0.28, 1.5, 0.03, "paint", c[i % 4], 0.12), -n * 0.18 + i * 0.5, 0.85, 0.08, -0.12));
  return g;
}

// A warming yurt: round canvas wall, a low cone roof, a stovepipe.
export function yurt({ r = 3.5 } = {}) {
  const g = group(at(cyl(r, 2.4, "cream", undefined, 24), 0, 1.2, 0));
  g.add(at(cyl(r + 0.4, 1.6, "snow", undefined, 24, 0.4), 0, 3.2, 0));
  g.add(at(box(1.0, 2.0, 0.3, "wood"), 0, 1.0, r - 0.05));
  g.add(at(cyl(0.12, 1.4, "dark"), r * 0.4, 4.0, 0));
  return g;
}
