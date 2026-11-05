// The resort tiles as little dioramas (the owner's references, 2026-11-05): the cut-away sides show the
// ground in layers — snow, earth, rock — following the slope; small pines stand on the lower slopes; and on
// each a cartoon animal of that mountain walks its round.
import * as THREE from "three";

// The animal for each resort, from what lives there (and is fun to meet).
export const ANIMALS = {
  copper: "pika", winterpark: "moose", steamboat: "elk", abasin: "goat", eldora: "fox",
  snowmass: "lynx", aspenmountain: "bear", highlands: "sheep", buttermilk: "hare",
};

// Layers under the snow, as depths below the surface (top) or heights (flat base): [depth, colour].
const BANDS = [[0, 0xf7f8fa], [0.28, 0xf7f8fa], [0.32, 0xa68564], [1.05, 0x8d6e52], [1.09, 0xa3a19c], [2.5, 0x8f8b84], [2.54, 0xb3aba0]];
// Walls from the terrain's edge down to a flat foot at `foot`, banded by depth below the ground.
export function strataWalls(pos, edge, foot) {
  const P = [], C = [], idx = [], c = new THREE.Color(), rows = BANDS.length + 1;
  for (const v of edge) {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
    for (const [d, col] of BANDS) { P.push(x, Math.max(foot, y - d), z); c.set(col); C.push(c.r, c.g, c.b); }
    P.push(x, foot, z); c.set(0xb3aba0); C.push(c.r, c.g, c.b);
  }
  for (let e = 0; e + 1 < edge.length; e++) for (let r = 0; r + 1 < rows; r++) { const a = e * rows + r, b = a + rows; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide, flatShading: true }));
  m.castShadow = m.receiveShadow = true; return m;
}

// Ground height on a tile at local (x, z), from its top geometry (n × n, size s).
export const heightAt = (pos, n, s) => (x, z) => {
  const fx = Math.min(n - 1.001, Math.max(0, (x / s + 0.5) * (n - 1))), fz = Math.min(n - 1.001, Math.max(0, (z / s + 0.5) * (n - 1)));
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, w = fz - j, Y = (a, b) => pos.getY(b * n + a);
  return (Y(i, j) * (1 - u) + Y(i + 1, j) * u) * (1 - w) + (Y(i, j + 1) * (1 - u) + Y(i + 1, j + 1) * u) * w;
};

// Pines on the lower two thirds of the slopes, in clumps, not on the steepest ground.
export function pines(h, s, lo, hi, seed) {
  let k = seed; const rnd = () => ((k = (k * 16807) % 2147483647) / 2147483647);
  const spots = [];
  for (let i = 0; i < 900 && spots.length < 70; i++) {
    const x = (rnd() - 0.5) * s * 0.94, z = (rnd() - 0.5) * s * 0.94, y = h(x, z), u = (y - lo) / (hi - lo || 1);
    const steep = Math.abs(h(x + 0.3, z) - h(x - 0.3, z)) + Math.abs(h(x, z + 0.3) - h(x, z - 0.3));
    const clump = Math.sin(x * 0.9 + seed) * Math.cos(z * 1.1 - seed) > 0.1;
    if (u > 0.62 || steep > 1.1 || !clump) continue;
    spots.push([x, y, z, 0.55 + rnd() * 0.5]);
  }
  const g = new THREE.Group(), cone = new THREE.ConeGeometry(0.32, 0.9, 6), cap = new THREE.ConeGeometry(0.2, 0.42, 6), trunk = new THREE.CylinderGeometry(0.05, 0.06, 0.25, 5);
  const green = new THREE.InstancedMesh(cone, new THREE.MeshStandardMaterial({ color: 0x3f5f52, roughness: 0.9, flatShading: true }), spots.length);
  const snow = new THREE.InstancedMesh(cap, new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.8, flatShading: true }), spots.length);
  const wood = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: 0x6b4f3a }), spots.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3();
  spots.forEach(([x, y, z, sc], i) => {
    M.compose(v.set(x, y + 0.55 * sc, z), q, new THREE.Vector3(sc, sc, sc)); green.setMatrixAt(i, M);
    M.compose(v.set(x, y + 0.85 * sc, z), q, new THREE.Vector3(sc, sc, sc)); snow.setMatrixAt(i, M);
    M.compose(v.set(x, y + 0.1 * sc, z), q, new THREE.Vector3(sc, sc, sc)); wood.setMatrixAt(i, M);
  });
  for (const m of [green, snow, wood]) { m.castShadow = true; g.add(m); }
  return g;
}

// A cartoon animal from simple rounded shapes; its legs swing as it walks. Faces +z.
export function animal(kind) {
  const L = {
    pika: { c: 0x9c8570, s: 0.55, body: [0.45, 0.32, 0.5], head: 0.3, ears: "round", legs: 0.12, tail: 0 },
    hare: { c: 0xf2f0ec, s: 0.6, body: [0.4, 0.38, 0.6], head: 0.28, ears: "long", legs: 0.2, tail: "puff" },
    fox: { c: 0xc66a34, s: 0.7, body: [0.36, 0.34, 0.8], head: 0.28, ears: "point", legs: 0.3, tail: "bush", snout: 1 },
    lynx: { c: 0xb9a58c, s: 0.8, body: [0.4, 0.4, 0.8], head: 0.32, ears: "tuft", legs: 0.38, tail: "stub" },
    bear: { c: 0x3b2e28, s: 1.0, body: [0.62, 0.55, 1.0], head: 0.4, ears: "round", legs: 0.4, tail: 0, snout: 1 },
    goat: { c: 0xf5f3ee, s: 0.85, body: [0.42, 0.45, 0.85], head: 0.3, ears: "point", legs: 0.5, tail: 0, horns: "goat", beard: 1 },
    sheep: { c: 0xb59a7a, s: 0.85, body: [0.45, 0.45, 0.85], head: 0.3, ears: "point", legs: 0.5, tail: 0, horns: "curl", rump: 1 },
    elk: { c: 0x8a6446, s: 1.1, body: [0.45, 0.5, 1.05], head: 0.32, ears: "point", legs: 0.75, tail: 0, antlers: "elk", neck: 1 },
    moose: { c: 0x4a3a30, s: 1.2, body: [0.5, 0.6, 1.1], head: 0.38, ears: "point", legs: 0.85, tail: 0, antlers: "moose", neck: 1, snout: 1 },
  }[kind];
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const fur = mat(L.c), dark = mat(0x2a2522), light = mat(0xf2ede4), horn = mat(0xd8cbb2), root = new THREE.Group(), body = new THREE.Group();
  const ball = (r, m, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); o.scale.set(sx, sy, sz); o.castShadow = true; return o; };
  const [bw, bh, bl] = L.body, legH = L.legs;
  const torso = ball(1, fur, bw, bh, bl / 2 + 0.1); torso.position.y = legH + bh * 0.7; body.add(torso);
  if (L.rump) { const r = ball(0.22, light, 1.2, 1, 0.6); r.position.set(0, legH + bh * 0.8, -bl / 2); body.add(r); }
  const head = new THREE.Group(); head.position.set(0, legH + bh * (L.neck ? 1.6 : 1.15), bl / 2 + L.head * 0.5); body.add(head);
  head.add(ball(L.head, fur, 1, 0.95, 1.1));
  if (L.snout) { const sn = ball(L.head * 0.55, kind === "fox" ? light : fur, 0.9, 0.8, 1.3); sn.position.set(0, -L.head * 0.25, L.head * 0.85); head.add(sn); }
  if (L.neck) { const nk = new THREE.Mesh(new THREE.CylinderGeometry(L.head * 0.55, bw * 0.6, bh * 1.1, 10), fur); nk.position.set(0, legH + bh * 1.2, bl / 2 - 0.05); nk.rotation.x = 0.6; nk.castShadow = true; body.add(nk); }
  for (const sd of [-1, 1]) { const e = ball(L.head * 0.12, dark); e.position.set(sd * L.head * 0.45, L.head * 0.2, L.head * 0.85); head.add(e); }
  const nose = ball(L.head * 0.1, dark); nose.position.set(0, L.head * (L.snout ? -0.2 : 0), L.head * (L.snout ? 1.55 : 1.05)); head.add(nose);
  for (const sd of [-1, 1]) {
    let ear;
    if (L.ears === "long") { ear = ball(0.1, fur, 0.8, 3.2, 0.5); ear.position.set(sd * 0.12, L.head + 0.25, -0.05); ear.rotation.z = -sd * 0.15; }
    else if (L.ears === "round") { ear = ball(L.head * 0.32, fur, 1, 1, 0.5); ear.position.set(sd * L.head * 0.65, L.head * 0.75, 0); }
    else { ear = new THREE.Mesh(new THREE.ConeGeometry(L.head * 0.25, L.head * (L.ears === "tuft" ? 0.9 : 0.6), 6), fur); ear.position.set(sd * L.head * 0.55, L.head * 0.95, 0); ear.rotation.z = -sd * 0.3; ear.castShadow = true;
      if (L.ears === "tuft") { const tf = ball(0.04, dark, 1, 2, 1); tf.position.y = L.head * 0.5; ear.add(tf); } }
    head.add(ear);
    if (L.horns === "goat") { const h = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.42, 6), dark); h.position.set(sd * 0.12, L.head + 0.15, -0.08); h.rotation.x = -0.5; head.add(h); }
    if (L.horns === "curl") { const h = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 6, 12, Math.PI * 1.5), horn); h.position.set(sd * 0.26, L.head * 0.6, -0.05); h.rotation.y = Math.PI / 2; head.add(h); }
    if (L.antlers) {
      const a = new THREE.Group(); a.position.set(sd * L.head * 0.5, L.head * 0.8, -0.05); head.add(a);
      if (L.antlers === "moose") { const p = ball(0.35, horn, 1.2, 0.25, 0.8); p.position.set(sd * 0.4, 0.2, 0); p.rotation.z = sd * 0.4; a.add(p); }
      else { const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 5), horn); beam.position.set(sd * 0.2, 0.4, -0.1); beam.rotation.z = -sd * 0.4; beam.rotation.x = -0.3; a.add(beam);
        for (let t = 0; t < 3; t++) { const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.35, 4), horn); tine.position.set(sd * (0.12 + t * 0.1), 0.25 + t * 0.22, 0.05); tine.rotation.x = 0.7; a.add(tine); } }
    }
  }
  if (L.beard) { const b = ball(0.08, light, 1, 2, 1); b.position.set(0, -L.head * 0.8, L.head * 0.6); head.add(b); }
  if (L.tail === "bush") { const tl = ball(0.18, fur, 0.8, 0.8, 2.2); tl.position.set(0, legH + bh * 0.8, -bl / 2 - 0.3); tl.rotation.x = 0.5; const tip = ball(0.12, light); tip.position.z = -0.35; tl.add(tip); body.add(tl); }
  if (L.tail === "puff") { const tl = ball(0.14, light); tl.position.set(0, legH + bh * 0.8, -bl / 2 - 0.05); body.add(tl); }
  if (L.tail === "stub") { const tl = ball(0.08, dark, 1, 1, 1.5); tl.position.set(0, legH + bh * 0.9, -bl / 2 - 0.05); body.add(tl); }
  const legs = [];
  for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group(); pivot.position.set(lx * bw * 0.55, legH + 0.05, lz * bl * 0.32);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06 + legH * 0.05, 0.05 + legH * 0.04, legH + 0.05, 6), fur); leg.position.y = -(legH + 0.05) / 2; leg.castShadow = true;
    const hoof = ball(0.07 + legH * 0.04, dark, 1, 0.6, 1.2); hoof.position.y = -(legH + 0.05); pivot.add(leg, hoof); body.add(pivot); legs.push(pivot);
  }
  root.add(body); root.scale.setScalar(L.s * 0.85);
  root.userData = { body, legs, head, hop: kind === "hare" || kind === "pika" };
  return root;
}

// Walk an animal round a loop on its tile: a gentle wandering circle, following the ground.
export function walk(a, h, t, seed, s) {
  const r = s * 0.28, sp = 0.18, u = t * sp + seed;
  const x = Math.cos(u) * r + Math.sin(u * 2.3) * r * 0.25, z = Math.sin(u) * r * 0.8 + Math.cos(u * 1.7) * r * 0.2;
  const x2 = Math.cos(u + 0.01) * r + Math.sin((u + 0.01) * 2.3) * r * 0.25, z2 = Math.sin(u + 0.01) * r * 0.8 + Math.cos((u + 0.01) * 1.7) * r * 0.2;
  const { body, legs, head, hop } = a.userData, ph = t * 7;
  a.position.set(x, h(x, z) + (hop ? Math.abs(Math.sin(ph * 0.6)) * 0.25 : 0), z);
  a.rotation.y = Math.atan2(x2 - x, z2 - z);
  legs.forEach((l, i) => (l.rotation.x = hop ? Math.sin(ph * 0.6) * 0.5 : Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.45));
  body.position.y = hop ? 0 : Math.abs(Math.sin(ph)) * 0.04; head.rotation.y = Math.sin(t * 0.7 + seed) * 0.3;
}
