// Each friend's entrance on the rider page: they come down out of the painted mountains, far to near,
// doing their signature move on a snow slope, leaving their track in the snow (a carve's line, a spin's
// circle, an S; D flies a kicker into a Method), and pull up in front of you.
import * as THREE from "three";

// The slope: flat where the rider stops (z = 0), rising into the distance; its far edges fade into the painting.
export const groundY = (z) => 0.035 * (Math.sqrt(z * z + 4) - z - 2);
const FAR = -40;
export let TURN = +(new URLSearchParams(location.search).get("turn") ?? 0); // the model's board axis against the path

// The slope's edges and far end fade out (an alpha map: white solid, black clear).
function fadeTex() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, 64, 256);
  const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, "#000"); v.addColorStop(0.5, "#777"); v.addColorStop(0.75, "#fff"); v.addColorStop(1, "#fff");
  const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, "#000"); h.addColorStop(0.22, "#fff"); h.addColorStop(0.78, "#fff"); h.addColorStop(1, "#000");
  g.fillStyle = v; g.fillRect(0, 0, 64, 256); g.globalCompositeOperation = "multiply"; g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}
// A soft round flake, for the spray and the falling snow.
function flakeTex() {
  const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d");
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.45, "rgba(255,255,255,.7)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
}

// What each friend does on the way down: clips in a row, each ridden along the line its own board implies
// (character.js trace), the whole line turned to come at you out of the mountains and end at your feet.
const ROUTES = {
  A: { segs: [["Anim_Carve_Ref", 2, 5.5]] },                                   // long euro carves
  B: { segs: [["Anim_Chill_Cruise", 1, 6.5], ["Anim_Carve_Spin_Toe", 1, 6]] },  // ride in, then the carved spin
  C: { segs: [["Anim_Carve_S", 2, 5.5]] },                                     // S turns down the fall line
  D: { segs: [["Anim_Chill_Cruise", 2, 7], ["Anim_Method_Air", 1, 7]], kicker: { at: 0.12, h: 0.7, peak: 0.9 } }, // a kicker, a Method
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
  // Turned so its last stretch comes straight at you (then the skid stop is a quarter turn and ends facing
  // you); if that leaves the start too near, turned so the start is out in the mountains instead.
  const ang = (x, z) => Math.atan2(-z, x), m = pts[Math.floor(pts.length * 0.75)];
  let alpha = ang(0.08, 1) - ang(ex - m[0], ez - m[1]);
  if (rotY(sx, sz, alpha)[1] * k > -LONG * 0.5) alpha = ang(-0.12, -1) - ang(sx, sz);
  const P = pts.map(([x, z]) => rotY((x - ex) * k, (z - ez) * k, alpha));
  let H = hd.map((h) => h + alpha);
  // keep it in view: a line wandering out past the sides is drawn in sideways (and its headings follow)
  const wide = Math.max(...P.map(([x, z]) => Math.abs(x) / (0.5 + 0.22 * Math.abs(z))));
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
  // real snow on it (the ride's textures), tiled small, so the near ground has grain and sparkle, not paper
  const tl = new THREE.TextureLoader(), snowD = tl.load("assets/tex/snow_02_diff_1k.jpg"), snowN = tl.load("assets/tex/snow_02_nor_gl_1k.jpg");
  for (const t of [snowD, snowN]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 24); t.anisotropy = 8; } snowD.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x23272c, map: snowD, normalMap: snowN, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.9, alphaMap: fadeTex(), transparent: true, depthWrite: false }));
  ground.receiveShadow = true; ground.renderOrder = -1;
  // the track: a strip laid behind the board as it goes
  const N = 900, tPos = new Float32Array(N * 2 * 3), idx = [];
  for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const tGeo = new THREE.BufferGeometry(); tGeo.setAttribute("position", new THREE.BufferAttribute(tPos, 3)); tGeo.setIndex(idx);
  const track = new THREE.Mesh(tGeo, new THREE.MeshBasicMaterial({ color: 0x8fa3ba, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
  track.frustumCulled = false; track.renderOrder = 0;
  // the kicker: a snow wedge up to its lip, rounded off behind; placed where D takes off
  const KH = 0.7, KL = 2.6, sh = new THREE.Shape();
  sh.moveTo(-KL / 2, -0.05); sh.quadraticCurveTo(KL * 0.1, 0.05, KL / 2 - 0.15, KH); sh.lineTo(KL / 2 + 0.1, KH - 0.05); sh.quadraticCurveTo(KL / 2 + 0.9, KH * 0.6, KL / 2 + 1.6, -0.05); sh.lineTo(-KL / 2, -0.05);
  const kg = new THREE.ExtrudeGeometry(sh, { depth: 1.8, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.2, bevelSegments: 4, curveSegments: 12 });
  kg.translate(0, 0, -0.9);
  const kick = new THREE.Mesh(kg, new THREE.MeshStandardMaterial({ color: 0xdfe5ec, emissive: 0x8d949c, roughness: 1, transparent: true, side: THREE.DoubleSide }));
  kick.receiveShadow = true; // (its shadow falls outside the small shadow camera and smears)
  // Snow thrown off the board's edge (more the harder it turns; a sheet of it in the stop; a puff on
  // landing), and a few flakes drifting on the wind.
  const SP = 700, spPos = new Float32Array(SP * 3), spVel = new Float32Array(SP * 3), spLife = new Float32Array(SP), spAlpha = new Float32Array(SP);
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute("alpha", new THREE.BufferAttribute(spAlpha, 1));
  const ftex = flakeTex();
  const spMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { map: { value: ftex }, size: { value: 42 * Math.min(2, devicePixelRatio || 1) } },
    vertexShader: "attribute float alpha; varying float vA; uniform float size; void main() { vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * (0.35 + alpha * 0.65) / -mv.z; gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform sampler2D map; varying float vA; void main() { vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(0.97, 0.98, 1.0), c.a * vA * 0.9); }" });
  const spray = new THREE.Points(spGeo, spMat); spray.frustumCulled = false; spray.renderOrder = 2;
  let spNext = 0;
  const emit = (x, y, z, vx, vy, vz, n) => { for (let q = 0; q < n; q++) { const i = spNext; spNext = (spNext + 1) % SP;
    spPos.set([x + (Math.random() - 0.5) * 0.3, y + Math.random() * 0.1, z + (Math.random() - 0.5) * 0.3], i * 3);
    spVel.set([vx * (0.6 + Math.random() * 0.8) + (Math.random() - 0.5), vy * (0.5 + Math.random()) , vz * (0.6 + Math.random() * 0.8) + (Math.random() - 0.5)], i * 3); spLife[i] = 0.6 + Math.random() * 0.7; } };
  const FL = 160, flPos = new Float32Array(FL * 3), flA = new Float32Array(FL).fill(0.55);
  for (let i = 0; i < FL; i++) flPos.set([(Math.random() - 0.5) * 12, Math.random() * 6, -12 + Math.random() * 15], i * 3);
  const flGeo = new THREE.BufferGeometry(); flGeo.setAttribute("position", new THREE.BufferAttribute(flPos, 3)); flGeo.setAttribute("alpha", new THREE.BufferAttribute(flA, 1));
  const flakes = new THREE.Points(flGeo, spMat.clone()); flakes.material.uniforms.size.value = 26 * Math.min(2, devicePixelRatio || 1); flakes.frustumCulled = false;
  const particles = (dt) => {
    for (let i = 0; i < SP; i++) { if (spLife[i] <= 0) { spAlpha[i] = 0; continue; } spLife[i] -= dt; const o = i * 3;
      spVel[o + 1] -= 6 * dt; for (let a = 0; a < 3; a++) { spVel[o + a] *= 1 - 1.8 * dt; spPos[o + a] += spVel[o + a] * dt; }
      const gy = groundY(spPos[o + 2]); if (spPos[o + 1] < gy) { spPos[o + 1] = gy; spVel[o + 1] = 0; }
      spAlpha[i] = Math.min(1, spLife[i] * 1.6); }
    spGeo.attributes.position.needsUpdate = spGeo.attributes.alpha.needsUpdate = true;
    for (let i = 0; i < FL; i++) { const o = i * 3; flPos[o] += (0.45 + Math.sin(i + flPos[o + 1]) * 0.2) * dt; flPos[o + 1] -= (0.35 + (i % 5) * 0.06) * dt; flPos[o + 2] += Math.sin(i * 1.7 + flPos[o + 1] * 2) * 0.1 * dt;
      if (flPos[o + 1] < 0) { flPos[o + 1] = 6; flPos[o] = (Math.random() - 0.5) * 12; } if (flPos[o] > 6) flPos[o] = -6; }
    flGeo.attributes.position.needsUpdate = true;
  };
  const group = new THREE.Group(); group.add(ground, track, kick, spray, flakes); scene.add(group);

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
      particles(dt);
      if (!run) return false;
      const { line, char, mover, air } = run;
      if (run.done) { run = null; return false; }
      // The last stretch is a skid stop: the board swings across the line (the rider ends facing you), the
      // slide slows over about two seconds, and they rise out of the move into standing.
      const F = line.pts.length - 1, STOP = 30, fNow = run.t * line.fps, left = F - fNow;
      run.t += dt * (left > STOP ? 1 : Math.max(0.08, left / STOP));
      const f = run.t * line.fps, i = Math.min(line.pts.length - 1, Math.floor(f)), j = Math.min(line.pts.length - 1, i + 1), u = f - Math.floor(f);
      const s = line.segAt.findLastIndex((sg) => i >= sg.i0);
      if (s !== run.seg && !run.stopping) { run.seg = s; const sg = line.segAt[s]; char.play(sg.clip, sg.once ? { once: true } : {}); }
      const x = line.pts[i][0] + (line.pts[j][0] - line.pts[i][0]) * u, z = line.pts[i][1] + (line.pts[j][1] - line.pts[i][1]) * u, h = line.hd[i] + (line.hd[j] - line.hd[i]) * u;
      let y = groundY(z), flying = false;
      if (air && i >= air.i0 - 6 && i < air.i0) y += air.h * (i - air.i0 + 6 + u) / 6; // up the kicker
      if (air && i >= air.i0 && i < air.i1) { const q = (i - air.i0 + u) / (air.i1 - air.i0); y += air.h * (1 - q) + air.peak * 4 * q * (1 - q); flying = true; }
      const stopW = Math.min(1, Math.max(0, 1 - (F - f) / STOP)), sw = stopW * stopW * (3 - 2 * stopW), end = Math.round(h / (2 * Math.PI)) * 2 * Math.PI;
      if (stopW > 0 && !run.stopping) { run.stopping = true; char.play("Stand_Idle", { fade: 1.2 }); }
      mover.position.set(x, y, z); mover.rotation.y = h + (end - h) * sw;
      if (!flying) {
        lay(x, y, z, h);
        // spray: off the outside of the turn, more the sharper it turns; a sheet of it while stopping
        const turn = (h - (run.lastH ?? h)) / Math.max(dt, 1e-3); run.lastH = h;
        const side = Math.sign(turn) || 1, ox = Math.sin(h) * side, oz = Math.cos(h) * side, fx = Math.cos(h), fz = -Math.sin(h);
        const n = stopW > 0 ? Math.round(16 * (1 - stopW) + 3) : Math.min(9, Math.round(Math.abs(turn) * 6 + Math.random() * 0.8));
        if (n > 0) emit(x, y + 0.05, z, (stopW > 0 ? fx * 4 : ox * 2.4) + fx * 1.5, 2.2, (stopW > 0 ? fz * 4 : oz * 2.4) + fz * 1.5, n);
        if (run.wasFlying) { emit(x, y, z, 0, 2.5, 0, 40); run.wasFlying = false; } // landing
      } else run.wasFlying = true;
      if (air) kick.material.opacity = Math.min(1, Math.max(0, 1 - (i - air.i1) / 20));
      if (f >= F - 0.05) run.done = true;
      return false;
    },
  };
  return E;
}
