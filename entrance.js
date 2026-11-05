// Each friend's entrance on the rider page: they come down out of the painted mountains, far to near,
// doing their signature move on a snow slope, leaving their track in the snow (a carve's line, a spin's
// circle, an S; D flies a kicker into a Method), and pull up in front of you.
import * as THREE from "three";

// The slope: flat where the rider stops (z = 0), rising into the distance; its far edges fade into the painting.
export const groundY = (z) => 0.035 * (Math.sqrt(z * z + 4) - z - 2);
const FAR = -34;
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

// The paths (x, z), far to near, sampled into a curve; each friend's clip plays along it.
const P = (pts) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
const ROUTES = {
  // A: long euro carves, edge to edge, across the slope
  A: { curve: P([[2, FAR], [-5, -24], [5, -15], [-4, -8], [2, -3], [0, 0]]), dur: 6.5, clip: "Anim_Carve_Ref" },
  // B: straight out of the hills, then a carved spin: a full circle before stopping
  B: { curve: P([[-1, FAR], [0, -18], [0.4, -8], [1.4, -4.4], [0.2, -3.2], [-1.2, -4.3], [-0.2, -5.6], [1.2, -4.6], [0.5, -2], [0, 0]]), dur: 6.8, clip: "Anim_Carve_Spin_Toe" },
  // C: quick S turns down the fall line
  C: { curve: P([[0, FAR], [3, -27], [-3, -21], [3, -15], [-3, -10], [2.5, -5.5], [-1.5, -2.2], [0, 0]]), dur: 6.2, clip: "Anim_Carve_S" },
  // D: straight at the kicker, a Method in the air, a long landing
  D: { curve: P([[-4, FAR], [-3, -20], [-2.2, -12.5], [-1.7, -9.2], [-1.2, -6.6], [-0.6, -3.4], [-0.2, -1], [0, 0]]), dur: 5.2, clip: "Anim_Chill_Cruise", kicker: { z0: -11.5, z1: -9.2, h: 0.75, land: -3, peak: 2.4, trick: "Anim_Method_Air" } },
};

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
  // D's kicker
  // D's kicker: a snow wedge up to its lip, rounded off behind (it reads as a mound from below)
  const k = ROUTES.D.kicker, L = k.z1 - k.z0, sh = new THREE.Shape();
  sh.moveTo(-L / 2, -0.05); sh.quadraticCurveTo(L * 0.1, 0.05, L / 2 - 0.15, k.h); sh.lineTo(L / 2 + 0.1, k.h - 0.05); sh.quadraticCurveTo(L / 2 + 0.9, k.h * 0.6, L / 2 + 1.6, -0.05); sh.lineTo(-L / 2, -0.05);
  const kg = new THREE.ExtrudeGeometry(sh, { depth: 1.8, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.2, bevelSegments: 4, curveSegments: 12 });
  kg.translate(0, 0, -0.9); kg.rotateY(-Math.PI / 2);
  const kick = new THREE.Mesh(kg, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x2c3036, roughness: 1 }));
  { const c = ROUTES.D.curve, pts = c.getSpacedPoints(400), mid = (k.z0 + k.z1) / 2, at = pts.reduce((b, q) => (Math.abs(q.z - mid) < Math.abs(b.z - mid) ? q : b)), i = pts.indexOf(at), d = pts[Math.min(399, i + 1)].clone().sub(at);
    kick.position.set(at.x, groundY(at.z), at.z); kick.rotation.y = Math.atan2(d.x, d.z); }
  kick.castShadow = kick.receiveShadow = true;
  const group = new THREE.Group(); group.add(ground, track, kick); scene.add(group);

  let run = null, n = 0;
  const lay = (x, y, z, dx, dz) => { // two points across the track, a little above the snow
    if (n >= N) return; const l = Math.hypot(dx, dz) || 1, w = 0.07, o = n * 6;
    tPos.set([x - (dz / l) * w, y + 0.02, z + (dx / l) * w, x + (dz / l) * w, y + 0.02, z - (dx / l) * w], o);
    n++; tGeo.setDrawRange(0, Math.max(0, (n - 1) * 6)); tGeo.attributes.position.needsUpdate = true;
  };
  const E = {
    group, has: (k) => k in ROUTES,
    // Start k's entrance with this character on this mover (a group placed and turned along the path).
    start(k, char, mover) {
      const r = ROUTES[k]; if (!r) return false;
      n = 0; tGeo.setDrawRange(0, 0); kick.visible = !!r.kicker;
      run = { r, char, mover, t: 0, mode: null };
      return true;
    },
    get running() { return !!run; },
    stop() { run = null; },
    // Advance; returns true when the rider has pulled up (then they idle on their board).
    step(dt) {
      if (!run) return false;
      const { r, char, mover } = run; run.t += dt;
      const u = Math.min(1, run.t / r.dur), e = 1 - Math.pow(1 - u, 1.6); // ease out: slowing to a stop
      const p = r.curve.getPointAt(e), tan = r.curve.getTangentAt(Math.min(0.999, e));
      let y = groundY(p.z), air = false;
      const kk = r.kicker;
      if (kk) {
        if (p.z > kk.z0 && p.z < kk.z1) y += kk.h * (p.z - kk.z0) / (kk.z1 - kk.z0); // up the ramp
        if (p.z >= kk.z1 && p.z < kk.land) { const s = (p.z - kk.z1) / (kk.land - kk.z1); y = THREE.MathUtils.lerp(groundY(kk.z1) + kk.h, groundY(p.z), s) + kk.peak * 4 * s * (1 - s); air = true; }
        const want = air ? kk.trick : r.clip;
        if (run.mode !== want) { char.play(want, { once: air, dur: air ? 1.1 : 0 }); run.mode = want; }
      } else if (!run.mode) { char.play(r.clip); run.mode = r.clip; }
      mover.position.set(p.x, y, p.z);
      // The board runs along the path: the rider faces across it (their chest to the downhill side).
      mover.rotation.y = Math.atan2(tan.x, tan.z) + TURN;
      if (!air) lay(p.x, groundY(p.z) + (kk && p.z > kk.z0 && p.z < kk.z1 ? kk.h * (p.z - kk.z0) / (kk.z1 - kk.z0) : 0), p.z, tan.x, tan.z);
      kick.material.opacity = kk ? Math.min(1, Math.max(0, (kk.land + 1 - p.z) / 2)) : 1; kick.material.transparent = kick.material.opacity < 1;
      if (u >= 1) { run = null; char.play("Anim_Idle"); return true; }
      return false;
    },
  };
  return E;
}
