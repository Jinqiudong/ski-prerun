// Run names carved into the snow along a lift: seen only as the chair passes over them, like reading the
// runs below. Shared by the game (main.js) and the new-look ride (look.js).
import * as THREE from "three";
import { LEVEL } from "./world.js?v=5";

// Run names carved into the snow along a lift, facing the rider riding up.
// Each name follows its run's path where the run passes within 120 m of the line (a phone held upright
// sees little to the sides), repeated every 500 m along a long run;
// it appears only as the chair passes over it.
export function snowNames(T, R, lift, fx, fz, renderer) {
  const group = new THREE.Group(), placed = [];
  // (fx, fz): the direction the chair travels (the OSM line may be drawn either way).
  // The closest point on the lift line to (x, z), and how far it is.
  const nearLine = (x, z) => {
    let best = { d: Infinity };
    for (let i = 1; i < lift.pts.length; i++) {
      const a = lift.pts[i - 1], b = lift.pts[i], dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
      const px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < best.d) best = { d, px, pz };
    }
    return best;
  };
  for (const run of R.runs) {
    if (!run.name || run.area) continue;
    let along = 0, lastAt = -Infinity, n = 0;
    for (let k = 0; k < run.pts.length && n < 3; k++) {
      const [x, z] = run.pts[k];
      if (k) along += Math.hypot(x - run.pts[k - 1][0], z - run.pts[k - 1][1]);
      const { d } = nearLine(x, z);
      if (d > 120 || along - lastAt < 500) continue;
      if (placed.some((q) => Math.hypot(q[0] - x, q[1] - z) < 60)) continue;
      const mesh = snowName(T, run, along, fx, fz, renderer);
      if (!mesh) continue;
      group.add(mesh);
      placed.push([x, z]); lastAt = along; n++;
    }
  }
  return group;
}
function snowName(T, run, at, fx, fz, renderer) {
  const font = 96, pad = 40, c = document.createElement("canvas"), g = c.getContext("2d");
  g.font = `700 ${font}px "Noto Sans SC", -apple-system, sans-serif`;
  const sym = 90, w = Math.ceil(g.measureText(run.name).width) + sym + pad * 2, h = font + pad * 2;
  c.width = w; c.height = h;
  const col = "#" + new THREE.Color(LEVEL[run.level].color).getHexString();
  g.font = `700 ${font}px "Noto Sans SC", -apple-system, sans-serif`;
  g.textBaseline = "middle";
  // Carved into the snow: the groove in blue-grey shade, a dark lip on the far edge and a lit lip on the
  // near edge, as if the letters were cut a hand deep and the sun came from behind the rider.
  const y = h / 2, x0 = pad, tx = x0 + sym;
  g.fillStyle = "rgba(40, 60, 95, 0.7)"; g.fillText(run.name, tx, y - 6);
  g.fillStyle = "rgba(255, 255, 255, 0.95)"; g.fillText(run.name, tx, y + 5);
  g.fillStyle = "rgba(112, 136, 172, 0.92)"; g.fillText(run.name, tx, y);
  // The difficulty mark in front of the name, pressed in in its colour.
  g.fillStyle = run.level === "easy" || run.level === "intermediate" ? col : "#20242c";
  g.globalAlpha = 0.8;
  if (run.level === "easy") { g.beginPath(); g.arc(x0 + 32, y, 30, 0, Math.PI * 2); g.fill(); }
  else if (run.level === "intermediate") g.fillRect(x0 + 4, y - 28, 56, 56);
  else { g.translate(x0 + 32, y); g.rotate(Math.PI / 4); g.fillRect(-24, -24, 48, 48); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  // The name follows the run's curve, centred at distance `at` along it: letters 4 m wide along the run,
  // twice as tall across it since the chair sees the snow at a low angle.
  const W = 4 * w / font, H = 4 * h / font * 2;
  const cum = [0];
  for (let i = 1; i < run.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(run.pts[i][0] - run.pts[i - 1][0], run.pts[i][1] - run.pts[i - 1][1]));
  const total = cum[cum.length - 1];
  if (total < W) return null;
  const s0 = Math.min(total - W / 2, Math.max(W / 2, at));
  const pointAt = (sd) => {
    sd = Math.min(total, Math.max(0, sd));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < sd) i++;
    const t = (sd - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), a = run.pts[i - 1], b = run.pts[i];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  // Read left to right from the chair: run the text the way that points to the rider's right.
  const fl = Math.hypot(fx, fz), rx = -fz / fl, rz = fx / fl;
  const e0 = pointAt(s0 - W / 2), e1 = pointAt(s0 + W / 2);
  const sign = (e1[0] - e0[0]) * rx + (e1[1] - e0[1]) * rz >= 0 ? 1 : -1;
  const nu = Math.max(4, Math.ceil(W / 2)), pos = [], uv = [], idx = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu, sd = s0 + sign * (u - 0.5) * W;
    const [x, z] = pointAt(sd), p = pointAt(sd - sign * 6), q = pointAt(sd + sign * 6); // a smoothed tangent
    let tx = q[0] - p[0], tz = q[1] - p[1];
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const ux = tz, uz = -tx; // the letters' up: to the left of the reading direction, seen from above
    for (const v of [0, 1]) {
      const px = x + ux * (v - 0.5) * H, pz = z + uz * (v - 0.5) * H;
      pos.push(px, T.heightAt(px, pz) + 0.8, pz); uv.push(u, v);
    }
    if (i < nu) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const [cx, cz] = pointAt(s0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, toneMapped: false }));
  mesh.userData.at = new THREE.Vector3(cx, T.heightAt(cx, cz), cz);
  mesh.renderOrder = 3;
  return mesh;
}

// A name shows only as the chair comes over it; then it falls behind.
export function fadeNames(group, camera) {
  for (const m of group.children) {
    const d = camera.position.distanceTo(m.userData.at);
    m.material.opacity = Math.min(1, Math.max(0, (280 - d) / 100));
    m.visible = m.material.opacity > 0.01;
  }
}
