// Each friend's entrance on the rider page: they come down out of the painted mountains, far to near,
// doing their signature move on a snow slope, leaving their track in the snow (a carve's line, a spin's
// circle, an S; D flies a kicker into a Method), and pull up in front of you.
import * as THREE from "three";

// The slope: flat where the rider stops (z = 0), rising into the distance; its far edges fade into the painting.
export const groundY = (z) => 0.035 * (Math.sqrt(z * z + 4) - z - 2);
const FAR = -40;
export let TURN = +(new URLSearchParams(location.search).get("turn") ?? 0); // the model's board axis against the path

function fadeTex() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d");
  const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, "rgba(255,255,255,0)"); v.addColorStop(0.55, "rgba(255,255,255,.55)"); v.addColorStop(0.8, "#fff"); v.addColorStop(1, "#fff");
  g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = "destination-in";
  const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, "rgba(0,0,0,0)"); h.addColorStop(0.25, "#000"); h.addColorStop(0.75, "#000"); h.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}

// What each friend does on the way down: clips in a row, each ridden along the line its own board implies
// (character.js trace), the whole line turned to come at you out of the mountains and end at your feet.
const ROUTES = {
  A: { segs: [["Anim_Carve_Ref", 2, 7]] },                                   // long euro carves
  B: { segs: [["Anim_Chill_Cruise", 1, 6.5], ["Anim_Carve_Spin_Toe", 1, 6]] },  // ride in, then the carved spin
  C: { segs: [["Anim_Carve_S", 2, 7]] },                                     // S turns down the fall line
  D: { segs: [["Anim_Chill_Cruise", 2, 7], ["Anim_Method_Air", 1, 7]], kicker: { at: 0.12, h: 0.7, peak: 1.6 } }, // a kicker, a Method
};
const LONG = 30; // the longest way in (m): longer lines are drawn in to this
const rotY = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
function lineOf(char, r) {
  const pts = [], hd = [], segAt = []; let ox = 0, oz = 0, oh = 0;
  for (const [clip, reps, v] of r.segs) {
    const T = char.trace(clip, reps, v); if (!T) continue;
    segAt.push({ clip, i0: pts.length, n: T.pts.length, once: reps === 1 && clip === "Anim_Method_Air" });
    for (let i = 0; i < T.pts.length; i++) { const [x, z] = rotY(T.pts[i][0], T.pts[i][1], oh); pts.push([ox + x, oz + z]); hd.push(oh + T.hd[i]); }
    [ox, oz] = pts[pts.length - 1]; oh = hd[hd.length - 1];
  }
  // end at the origin; the start out toward the mountains (-z), a little to one side
  const [ex, ez] = pts[pts.length - 1], [sx, sz] = [pts[0][0] - ex, pts[0][1] - ez], L = Math.hypot(sx, sz), k = Math.min(1, LONG / L);
  const ang = (x, z) => Math.atan2(-z, x), alpha = ang(-0.12, -1) - ang(sx, sz);
  const P = pts.map(([x, z]) => rotY((x - ex) * k, (z - ez) * k, alpha));
  let H = hd.map((h) => h + alpha);
  // keep it in view: a line wandering out past the sides is drawn in sideways (and its headings follow)
  const wide = Math.max(...P.map(([x, z]) => Math.abs(x) / (0.8 + 0.3 * Math.abs(z))));
  if (wide > 1) {
    const D = P.map(([x, z]) => [x / wide, z]);
    H = H.map((h, i) => { const a = D[Math.max(0, i - 1)], b = D[Math.min(D.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], q = P[Math.max(0, i - 1)], w = P[Math.min(P.length - 1, i + 1)];
      return Math.hypot(dx, dz) > 1e-4 ? h + (Math.atan2(-dz, dx) - Math.atan2(-(w[1] - q[1]), w[0] - q[0])) : h; });
    return { pts: D, hd: H, segAt, fps: 30 };
  }
  return { pts: P, hd: H, segAt, fps: 30 };
}

export function makeEntrance(scene) {
  // the slope
  const geo = new THREE.PlaneGeometry(26, -FAR + 8, 26, 64); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, (FAR - 8) / 2 + 4);
  const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) pos.setY(i, groundY(pos.getZ(i)));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x2c3036, roughness: 1, map: fadeTex(), transparent: true, depthWrite: false }));
  ground.receiveShadow = true; ground.renderOrder = -1;
  // the track: a strip laid behind the board as it goes
  const N = 900, tPos = new Float32Array(N * 2 * 3), idx = [];
  for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const tGeo = new THREE.BufferGeometry(); tGeo.setAttribute("position", new THREE.BufferAttribute(tPos, 3)); tGeo.setIndex(idx);
  const track = new THREE.Mesh(tGeo, new THREE.MeshBasicMaterial({ color: 0xa9b8c8, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
  track.frustumCulled = false; track.renderOrder = 0;
  // the kicker: a snow wedge up to its lip, rounded off behind; placed where D takes off
  const KH = 0.7, KL = 2.6, sh = new THREE.Shape();
  sh.moveTo(-KL / 2, -0.05); sh.quadraticCurveTo(KL * 0.1, 0.05, KL / 2 - 0.15, KH); sh.lineTo(KL / 2 + 0.1, KH - 0.05); sh.quadraticCurveTo(KL / 2 + 0.9, KH * 0.6, KL / 2 + 1.6, -0.05); sh.lineTo(-KL / 2, -0.05);
  const kg = new THREE.ExtrudeGeometry(sh, { depth: 1.8, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.2, bevelSegments: 4, curveSegments: 12 });
  kg.translate(0, 0, -0.9);
  const kick = new THREE.Mesh(kg, new THREE.MeshStandardMaterial({ color: 0xdfe5ec, emissive: 0x8d949c, roughness: 1, transparent: true, side: THREE.DoubleSide }));
  kick.receiveShadow = true; // (its shadow falls outside the small shadow camera and smears)
  const group = new THREE.Group(); group.add(ground, track, kick); scene.add(group);

  let run = null, n = 0;
  const lay = (x, y, z, h) => { // across the board's line, a little above the snow
    if (n >= N) return; const w = 0.09, o = n * 6, cx = Math.sin(h) * w, cz = Math.cos(h) * w;
    tPos.set([x - cx, y + 0.02, z - cz, x + cx, y + 0.02, z + cz], o);
    n++; tGeo.setDrawRange(0, Math.max(0, (n - 1) * 6)); tGeo.attributes.position.needsUpdate = true;
  };
  const cache = new Map();
  const E = {
    group,
    start(k, char, mover) {
      const r = ROUTES[k]; if (!r) return false;
      const key = char.root.uuid + k + char.root.scale.x; if (!cache.has(key)) cache.set(key, lineOf(char, r));
      const line = cache.get(key);
      n = 0; tGeo.setDrawRange(0, 0); kick.visible = false;
      let air = null;
      if (r.kicker) { // the takeoff: a little way into the Method; the kicker sits just before it, along the line
        const sg = line.segAt.find((s) => s.clip === "Anim_Method_Air"), i0 = sg.i0 + Math.round(sg.n * r.kicker.at), i1 = sg.i0 + Math.round(sg.n * 0.78);
        const [x, z] = line.pts[i0], h = line.hd[i0], back = KL / 2 - 0.15, kx = x - Math.cos(h) * back, kz = z + Math.sin(h) * back;
        kick.position.set(kx, groundY(kz), kz); kick.rotation.y = h; kick.visible = true;
        air = { i0, i1, ...r.kicker };
      }
      run = { line, char, mover, t: 0, seg: -1, air, done: 0 };
      return true;
    },
    get running() { return !!run && !run.done; },
    stop() { run = null; },
    // Advance; when the line ends the rider stops on their board and turns to you.
    step(dt) {
      if (!run) return false;
      const { line, char, mover, air } = run;
      if (run.done) { run.done += dt; mover.rotation.y += (Math.round(mover.rotation.y / (2 * Math.PI)) * 2 * Math.PI - mover.rotation.y) * Math.min(1, dt * 3); if (run.done > 1.5) run = null; return false; }
      run.t += dt;
      const f = run.t * line.fps, i = Math.min(line.pts.length - 1, Math.floor(f)), j = Math.min(line.pts.length - 1, i + 1), u = f - Math.floor(f);
      const s = line.segAt.findLastIndex((sg) => i >= sg.i0);
      if (s !== run.seg) { run.seg = s; const sg = line.segAt[s]; char.play(sg.clip, sg.once ? { once: true } : {}); }
      const x = line.pts[i][0] + (line.pts[j][0] - line.pts[i][0]) * u, z = line.pts[i][1] + (line.pts[j][1] - line.pts[i][1]) * u, h = line.hd[i] + (line.hd[j] - line.hd[i]) * u;
      let y = groundY(z), flying = false;
      if (air && i >= air.i0 - 6 && i < air.i0) y += air.h * (i - air.i0 + 6 + u) / 6; // up the kicker
      if (air && i >= air.i0 && i < air.i1) { const q = (i - air.i0 + u) / (air.i1 - air.i0); y += air.h * (1 - q) + air.peak * 4 * q * (1 - q); flying = true; }
      mover.position.set(x, y, z); mover.rotation.y = h;
      if (!flying) lay(x, y, z, h);
      if (air) kick.material.opacity = Math.min(1, Math.max(0, 1 - (i - air.i1) / 20));
      if (i >= line.pts.length - 1) { run.done = 1e-6; char.play("Anim_Idle"); }
      return false;
    },
  };
  return E;
}
