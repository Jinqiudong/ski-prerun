// Run names carved into the snow along a lift: seen only as the chair passes over them, like reading the
// runs below. Shared by the game (main.js) and the new-look ride (look.js).
import * as THREE from "three";
import { LEVEL } from "./world.js?v=5";

// Run names carved into the snow along a lift, facing the rider riding up.
// Each name follows its run's path where the run passes within 120 m of the line (a phone held upright
// sees little to the sides), repeated every 500 m along a long run;
// it appears as the chair comes within a few hundred metres and is gone once passed.
export function snowNames(T, R, lift, fx, fz, renderer) {
  const group = new THREE.Group(), placed = [];
  const ends = [lift.pts[0], lift.pts[lift.pts.length - 1]];
  const nearEnd = (x, z) => ends.some(([ex, ez]) => Math.hypot(x - ex, z - ez) < 50); // keep stations clear
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
      if (d > 120 || along - lastAt < 500 || nearEnd(x, z)) continue;
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
  g.fillStyle = "rgba(20, 34, 62, 0.9)"; g.fillText(run.name, tx, y - 7);
  g.fillStyle = "rgba(255, 255, 255, 1)"; g.fillText(run.name, tx, y + 6);
  g.fillStyle = "rgba(70, 96, 140, 0.98)"; g.fillText(run.name, tx, y);
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
  const W = 5 * w / font, H = 5 * h / font * 2;
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
  const fl = Math.hypot(fx, fz), rx = -fz / fl, rz = fx / fl, ffx = fx / fl, ffz = fz / fl;
  const e0 = pointAt(s0 - W / 2), e1 = pointAt(s0 + W / 2);
  const el = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]) || 1;
  const across = ((e1[0] - e0[0]) * rx + (e1[1] - e0[1]) * rz) / el; // 1: the run crosses under the chair
  const sign = across >= 0 ? 1 : -1;
  const nu = Math.max(4, Math.ceil(W / 2)), pos = [], uv = [], idx = [];
  // A run that climbs alongside the lift would put the name sideways or upside down: there the name
  // lies straight across the run like a road marking, letters standing away from the rider.
  const straight = Math.abs(across) < 0.6;
  const [mx, mz] = pointAt(s0);
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    let x, z, ux, uz;
    if (straight) {
      x = mx + rx * (u - 0.5) * W; z = mz + rz * (u - 0.5) * W; ux = ffx; uz = ffz;
    } else {
      const sd = s0 + sign * (u - 0.5) * W;
      [x, z] = pointAt(sd);
      const p = pointAt(sd - sign * 6), q = pointAt(sd + sign * 6); // a smoothed tangent
      let tx = q[0] - p[0], tz = q[1] - p[1];
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      ux = tz; uz = -tx; // the letters' up: to the left of the reading direction, seen from above
    }
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
    m.material.opacity = Math.min(1, Math.max(0, (430 - d) / 120)); // clear for the last ~300 m
    m.visible = m.material.opacity > 0.01;
  }
}

// Trail signs beside the runs near the lift, as at a resort: a timber post, a dark board with the
// difficulty mark and the run's name, a cap of snow. Each turns to face riders coming up the lift, so it
// reads from the chair even where the name in the snow is foreshortened.
export function trailSigns(T, R, lift, fx, fz, renderer) {
  const group = new THREE.Group(), placed = [];
  const fl = Math.hypot(fx, fz); fx /= fl; fz /= fl;
  const ends = [lift.pts[0], lift.pts[lift.pts.length - 1]];
  const post = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 });
  const cap = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.9 });
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
    let along = 0, lastAt = -Infinity;
    for (let k = 0; k < run.pts.length; k++) {
      const [x, z] = run.pts[k];
      if (k) along += Math.hypot(x - run.pts[k - 1][0], z - run.pts[k - 1][1]);
      const { d, px, pz } = nearLine(x, z);
      if (d < 18 || d > 90 || along - lastAt < 600) continue;
      if (ends.some(([ex, ez]) => Math.hypot(x - ex, z - ez) < 50) || placed.some(([qx, qz]) => Math.hypot(qx - x, qz - z) < 45)) continue;
      // At the run's edge nearer the lift.
      const k2 = 14 / d, sx = x + (px - x) * k2, sz = z + (pz - z) * k2;
      // Face a point on the line 70 m before this one: where the riders are coming from.
      const tx = px - fx * 70, tz = pz - fz * 70;
      group.add(sign(run, sx, sz, Math.atan2(tx - sx, tz - sz)));
      placed.push([x, z]); lastAt = along;
    }
  }
  function sign(run, x, z, yaw) {
    const c = document.createElement("canvas"); c.width = 640; c.height = 200;
    const g = c.getContext("2d");
    g.fillStyle = "#1d2a22"; g.fillRect(0, 0, 640, 200);
    g.strokeStyle = "#e8e2d2"; g.lineWidth = 8; g.strokeRect(10, 10, 620, 180);
    const col = "#" + new THREE.Color(LEVEL[run.level].color).getHexString();
    g.fillStyle = run.level === "easy" || run.level === "intermediate" ? col : "#0d0f12";
    if (run.level === "easy") { g.beginPath(); g.arc(85, 100, 46, 0, Math.PI * 2); g.fill(); }
    else if (run.level === "intermediate") g.fillRect(42, 57, 86, 86);
    else { g.save(); g.translate(85, 100); g.rotate(Math.PI / 4); g.strokeStyle = "#fff"; g.lineWidth = 5; g.fillRect(-34, -34, 68, 68); g.strokeRect(-34, -34, 68, 68); g.restore(); }
    g.fillStyle = "#f4efe2"; g.textBaseline = "middle";
    let size = 76;
    do { g.font = `700 ${size}px -apple-system, "Helvetica Neue", sans-serif`; size -= 4; } while (g.measureText(run.name).width > 470 && size > 30);
    g.fillText(run.name, 152, 104);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const s = new THREE.Group();
    const y = T.heightAt(x, z);
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 0.08), [post, post, cap, post, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), post]);
    board.position.y = 3.0;
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 8), post);
    p1.position.set(-1.1, 1.8, -0.06);
    const p2 = p1.clone(); p2.position.x = 1.1;
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.1, 0.22), cap);
    top.position.y = 3.55;
    s.add(board, p1, p2, top);
    s.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    s.position.set(x, y - 0.2, z);
    s.rotation.y = yaw;
    return s;
  }
  return group;
}
