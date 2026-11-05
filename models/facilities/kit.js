// Shared pieces for the facility models: the two looks under review, materials by role, and small
// geometry helpers. Every model is built in metres from code, so seats, bubbles and colours can follow
// each lift's OpenStreetMap tags and a resort's paint.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Materials by role. A model asks for a role ("steel", "paint", "glass"…); the look decides the surface.
export const PALETTE = {
  steel: 0x8d98a2, dark: 0x3a4048, paint: 0x2f5aa8, pad: 0x26324a, glass: 0x7fb2e6, concrete: 0xc9c3b8,
  wood: 0x8a5a3a, timber: 0x6e4a33, stone: 0x9a9184, roof: 0x4b3b33, snow: 0xf7f8fb, red: 0xb6463b,
  green: 0x2f8a4e, blue: 0x2d5fb3, black: 0x1d1f22, orange: 0xe27a2b, yellow: 0xe8c547, cream: 0xf3ead8, rope: 0x2b2d31,
};

const gradient = (() => { // three bands of light for the toon look
  const c = new Uint8Array([90, 180, 255]); const t = new THREE.DataTexture(c, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();

export const LOOKS = {
  // A: a miniature — matte, softly shaded, rounded edges, no outlines.
  miniature: { outline: 0, make: (role, c) => role === "glass"
    ? new THREE.MeshPhysicalMaterial({ color: c, transparent: true, opacity: 0.38, roughness: 0.15, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false })
    : new THREE.MeshStandardMaterial({ color: c, roughness: role === "steel" || role === "dark" ? 0.55 : 0.85, metalness: role === "steel" ? 0.35 : 0 }) },
  // B: ink and wash — three flat bands of light and a navy ink line, like the painted icons.
  ink: { outline: 0.035, make: (role, c) => role === "glass"
    ? new THREE.MeshToonMaterial({ color: c, gradientMap: gradient, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
    : new THREE.MeshToonMaterial({ color: c, gradientMap: gradient }) },
};

let look = LOOKS.miniature; const cache = new Map();
export function setLook(name) { look = LOOKS[name]; cache.clear(); }
export function mat(role, color) {
  const c = color ?? PALETTE[role] ?? 0xffffff, k = role + ":" + c;
  if (!cache.has(k)) { const m = look.make(role, c); m.userData.role = role; cache.set(k, m); }
  return cache.get(k);
}

// Geometry helpers. Everything returns a Mesh already placed.
export function box(w, h, d, role, color, r = 0) {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d);
  return shade(new THREE.Mesh(g, mat(role, color)));
}
const UP = new THREE.Vector3(0, 1, 0);
export function tube(a, b, r, role, color, seg = 10) {
  a = new THREE.Vector3(...a); b = new THREE.Vector3(...b);
  const len = a.distanceTo(b), m = shade(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat(role, color)));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
  return m;
}
// A bent pipe through points, round at the corners.
export function pipe(pts, r, role, color, bend = 0.25) {
  const v = pts.map((p) => new THREE.Vector3(...p)), path = new THREE.CurvePath();
  let prev = v[0];
  for (let i = 1; i < v.length; i++) {
    const last = i === v.length - 1;
    const end = last ? v[i] : v[i].clone().lerp(v[i - 1], Math.min(bend / v[i].distanceTo(v[i - 1]), 0.45));
    path.add(new THREE.LineCurve3(prev, end));
    if (!last) { const out = v[i].clone().lerp(v[i + 1], Math.min(bend / v[i].distanceTo(v[i + 1]), 0.45)); path.add(new THREE.QuadraticBezierCurve3(end, v[i], out)); prev = out; }
  }
  return shade(new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(8, pts.length * 12), r, 8, false), mat(role, color)));
}
export function cyl(r, h, role, color, seg = 16, r2 = r) { return shade(new THREE.Mesh(new THREE.CylinderGeometry(r2, r, h, seg), mat(role, color))); }
export function at(o, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; }
export function group(...kids) { const g = new THREE.Group(); for (const k of kids.flat()) if (k) g.add(k); return g; }
function shade(m) { m.castShadow = m.receiveShadow = true; return m; }

// A flat board with painted text or a shape, both faces.
export function plate(w, h, draw, { role = "cream", color } = {}) {
  const px = 128, cv = document.createElement("canvas"); cv.width = Math.round(w * px); cv.height = Math.round(h * px);
  const x = cv.getContext("2d"); draw(x, cv.width, cv.height);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const face = look === LOOKS.ink ? new THREE.MeshToonMaterial({ map: t, gradientMap: gradient }) : new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  const g = group(at(box(w, h, 0.04, role, color), 0, 0, 0));
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), face); f.position.z = 0.021; g.add(f);
  const b = f.clone(); b.rotation.y = Math.PI; b.position.z = -0.021; g.add(b);
  return g;
}

// The ink line: a navy hull pushed out along the normals, drawn from the back.
const inkMat = (() => {
  const m = new THREE.MeshBasicMaterial({ color: 0x22344d, side: THREE.BackSide });
  // The push grows with distance, so the line stays about the same width on screen.
  m.onBeforeCompile = (s) => { s.uniforms.k = { value: 0.0032 }; s.vertexShader = "uniform float k;\n" + s.vertexShader.replace("#include <begin_vertex>", "float dist = -(modelViewMatrix * vec4(position, 1.0)).z;\nvec3 transformed = position + normal * k * clamp(dist, 2.0, 60.0);"); };
  return m;
})();
export function inkLines(root) {
  if (!look.outline) return;
  const add = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.ink && o.material.userData?.role && o.material.userData.role !== "glass" && o.material.userData.role !== "rope") add.push(o); });
  for (const o of add) { const h = new THREE.Mesh(o.geometry, inkMat); h.userData.ink = true; o.add(h); }
}
