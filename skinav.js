// Finding the way while skiing: where the route meets other runs, the signs that stand there, and arrows on
// the snow before a turn.
import * as THREE from "three";

const COLOR = { easy: "#22b35a", intermediate: "#1f6fe5", advanced: "#15171c", expert: "#15171c" };
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const dirAt = (pts, i, k = 3) => { const a = pts[Math.max(0, i - k)], b = pts[Math.min(pts.length - 1, i + k)]; return Math.atan2(b[0] - a[0], b[1] - a[1]); };

// Junctions along a path: every named run that starts beside it (within 40 m) is a way off, and
// where the route itself changes run it says which way to go. Options carry their bearing relative
// to the way you arrive (> 0 is to the left, as for the rider's heading).
export function junctions(path, segs, R) {
  const near = (x, z) => {
    let best = Infinity, bi = 0;
    for (let i = 0; i < path.length; i++) { const d = (path[i][0] - x) ** 2 + (path[i][1] - z) ** 2; if (d < best) { best = d; bi = i; } }
    return { i: bi, d: Math.sqrt(best) };
  };
  const found = [];
  const routeRuns = new Set(segs.map((s) => s.run.name));
  for (const r of R.runs) {
    if (!r.name || r.area || r.pts.length < 4) continue;
    const { i, d } = near(r.pts[0][0], r.pts[0][1]);
    if (d > 40 || i < 3 || i > path.length - 4) continue;
    found.push({ i, run: r, bearing: angleDiff(dirAt(r.pts, 2, 2), dirAt(path, i, 4)), route: false });
  }
  for (let k = 1; k < segs.length; k++) {
    const s = segs[k];
    found.push({ i: s.at, run: s.run, bearing: angleDiff(dirAt(path, s.at + 4, 3), dirAt(path, Math.max(0, s.at - 4), 3)), route: true });
  }
  // Group options within 60 m of path into one junction; one option per run name, the route's wins.
  found.sort((a, b) => a.i - b.i);
  const out = [];
  for (const f of found) {
    let j = out[out.length - 1];
    if (!j || Math.hypot(path[f.i][0] - path[j.i][0], path[f.i][1] - path[j.i][1]) > 60) out.push((j = { i: f.i, options: [] }));
    const same = j.options.find((o) => o.run.name === f.run.name);
    if (same) { same.route ||= f.route; continue; }
    j.options.push(f);
  }
  for (const j of out) {
    // Carrying straight on along the route is an option too, unless the route turns off here.
    if (!j.options.some((o) => o.route)) {
      const cur = segs.filter((s) => s.at <= j.i).pop();
      if (cur && !j.options.some((o) => o.run.name === cur.run.name)) j.options.push({ i: j.i, run: cur.run, bearing: 0, route: true, straight: true });
      else if (cur) j.options.find((o) => o.run.name === cur.run.name).route = true;
    }
    j.options.sort((a, b) => b.bearing - a.bearing); // left to right
  }
  return out.filter((j) => j.options.length > 1 || j.options.some((o) => o.route && !o.straight));
}

const arrowOf = (b) => (b > 0.5 ? "↰" : b < -0.5 ? "↱" : b > 0.18 ? "↖" : b < -0.18 ? "↗" : "↑");
export const turnWord = (b) => (b > 0.5 ? "左转" : b < -0.5 ? "右转" : b > 0.18 ? "靠左" : b < -0.18 ? "靠右" : "直行");
export const arrowText = arrowOf;

// A junction signpost: one row per way, arrow + difficulty + name; the route's row picked out in gold.
export function junctionSign(T, x, z, yaw, options, renderer) {
  const rows = options.length, W = 720, RH = 120, H = rows * RH + 30;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#1d2a22"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#e8e2d2"; g.lineWidth = 8; g.strokeRect(8, 8, W - 16, H - 16);
  options.forEach((o, k) => {
    const y = 15 + k * RH + RH / 2;
    if (o.route) { g.fillStyle = "#f2b632"; g.fillRect(18, y - RH / 2 + 6, W - 36, RH - 12); }
    g.fillStyle = o.route ? "#1d1606" : "#f4efe2";
    g.font = `700 76px -apple-system, "Helvetica Neue", sans-serif`; g.textBaseline = "middle";
    g.fillText(arrowOf(o.bearing), 36, y + 4);
    const col = COLOR[o.run.level];
    g.fillStyle = o.run.level === "easy" || o.run.level === "intermediate" ? col : "#0d0f12";
    if (o.run.level === "easy") { g.beginPath(); g.arc(150, y, 28, 0, Math.PI * 2); g.fill(); }
    else if (o.run.level === "intermediate") g.fillRect(122, y - 28, 56, 56);
    else { g.save(); g.translate(150, y); g.rotate(Math.PI / 4); g.strokeStyle = "#fff"; g.lineWidth = 4; g.fillRect(-22, -22, 44, 44); g.strokeRect(-22, -22, 44, 44); g.restore(); }
    g.fillStyle = o.route ? "#1d1606" : "#f4efe2";
    let size = 64;
    do { g.font = `700 ${size}px -apple-system, "Helvetica Neue", sans-serif`; size -= 4; } while (g.measureText(o.run.name).width > 500 && size > 28);
    g.fillText(o.run.name, 200, y + 3);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const post = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 }), cap = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.9 });
  const bw = 3.6, bh = (bw * H) / W, s = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.08), [post, post, cap, post, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), post]);
  board.position.y = 2.3 + bh / 2;
  const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.4 + bh, 8), post);
  p1.position.set(-1.3, (2.4 + bh) / 2, -0.06);
  const p2 = p1.clone(); p2.position.x = 1.3;
  const top = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.1, 0.1, 0.22), cap);
  top.position.y = 2.35 + bh;
  s.add(board, p1, p2, top);
  s.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  s.position.set(x, T.heightAt(x, z) - 0.2, z);
  s.rotation.y = yaw;
  return s;
}

// Gold chevrons lying on the snow before a turn, pointing the way out of the junction.
export function chevrons(T, path, i, bearingOut) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.6); shape.lineTo(1.5, -0.4); shape.lineTo(0.8, -0.9); shape.lineTo(0, 0.3); shape.lineTo(-0.8, -0.9); shape.lineTo(-1.5, -0.4); shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2); // lying flat, tip toward -z… turned below to the way out
  const mat = new THREE.MeshBasicMaterial({ color: 0xf2b632, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const g = new THREE.Group();
  for (const back of [45, 30, 15]) {
    // Walk back along the path `back` metres from the junction.
    let k = i, d = 0;
    while (k > 0 && d < back) { d += Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]); k--; }
    const [x, z] = path[k], h = dirAt(path, k, 3) + bearingOut * (1 - back / 60);
    const m = new THREE.Mesh(geo, mat);
    m.scale.setScalar(1.6);
    m.position.set(x, T.heightAt(x, z) + 0.35, z);
    m.rotation.y = h + Math.PI; // the shape's tip points to -z after rotateX; heading h is toward +sin/+cos
    g.add(m);
  }
  return g;
}
