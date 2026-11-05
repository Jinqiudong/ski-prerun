// Each friend's entrance on the rider page: they come down out of the painted mountains, far to near,
// doing their signature move on a snow slope, leaving their track in the snow (a carve's line, a spin's
// circle, an S; D flies a kicker into a Method), and pull up in front of you.
import * as THREE from "three";
import { Lensflare, LensflareElement } from "three/addons/objects/Lensflare.js";

// The slope: flat where the rider stops (z = 0), rising into the distance; its far edges fade into the painting.
const slope = (z) => 0.035 * (Math.sqrt(z * z + 4) - z - 2);
// Soft rolls in the snow (smooth value noise), quiet where the rider stops so they stand level.
const HN = new Float32Array(256).map((_, i) => ((Math.sin(i * 127.1) * 43758.5453) % 1 + 1) % 1);
const vn = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, h = (a, b) => HN[(a * 57 + b * 131) & 255], sm = (t) => t * t * (3 - 2 * t);
  const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1), u = sm(xf), v = sm(zf); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
const rolls = (x, z) => (vn(x * 0.18, z * 0.12) - 0.5) * 0.5 + (vn(x * 0.5 + 9, z * 0.4) - 0.5) * 0.12;
export const groundAt = (x, z) => slope(z) + rolls(x, z) * Math.min(1, Math.hypot(x, z) / 6);
export const groundY = (z, x = 0) => groundAt(x, z);
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
  const geo = new THREE.PlaneGeometry(30, -FAR + 8, 150, 240); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, (FAR - 8) / 2 + 4);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) pos.setY(i, groundAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  // the hollows a touch blue (shade from the sky), the faces toward the sun a touch warm
  const nrm = geo.attributes.normal, sunDir = new THREE.Vector3(3, 6, 4).normalize();
  for (let i = 0; i < pos.count; i++) { const lit = nrm.getX(i) * sunDir.x + nrm.getY(i) * sunDir.y + nrm.getZ(i) * sunDir.z, k = Math.max(0, Math.min(1, (0.93 - lit) * 6));
    col.set([1 - k * 0.1, 1 - k * 0.06, 1], i * 3); }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  // real snow on it (the ride's textures), tiled small, so the near ground has grain and sparkle, not paper
  // only the snow's fine grain from a texture (as a faint normal map): the shape and colour come from the rolls
  const snowN = new THREE.TextureLoader().load("assets/tex/snow_02_nor_gl_1k.jpg"); snowN.wrapS = snowN.wrapT = THREE.RepeatWrapping; snowN.repeat.set(30, 48); snowN.anisotropy = 8;
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, emissive: 0x1d2126, normalMap: snowN, normalScale: new THREE.Vector2(0.18, 0.18), roughness: 0.85, alphaMap: fadeTex(), transparent: true, depthWrite: false }));
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
      const gy = groundAt(spPos[o], spPos[o + 2]); if (spPos[o + 1] < gy) { spPos[o + 1] = gy; spVel[o + 1] = 0; }
      spAlpha[i] = Math.min(1, spLife[i] * 1.6); }
    spGeo.attributes.position.needsUpdate = spGeo.attributes.alpha.needsUpdate = true;
    for (let i = 0; i < FL; i++) { const o = i * 3; flPos[o] += (0.45 + Math.sin(i + flPos[o + 1]) * 0.2) * dt; flPos[o + 1] -= (0.35 + (i % 5) * 0.06) * dt; flPos[o + 2] += Math.sin(i * 1.7 + flPos[o + 1] * 2) * 0.1 * dt;
      if (flPos[o + 1] < 0) { flPos[o + 1] = 6; flPos[o] = (Math.random() - 0.5) * 12; } if (flPos[o] > 6) flPos[o] = -6; }
    flGeo.attributes.position.needsUpdate = true;
  };
  // For the moving shots: a sky (pale at the horizon, deep overhead, glowing round the sun), the painted
  // mountains as a ring all round, and the sun's flare. They fade in when the camera leaves the
  // painting's view, and out as it comes back.
  const SUN = new THREE.Vector3(3, 6, 4).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false,
    uniforms: { sun: { value: SUN }, op: { value: 0 } },
    vertexShader: "varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 sun; uniform float op; varying vec3 vD; void main() { float h = clamp(vD.y, 0.0, 1.0); vec3 c = mix(vec3(0.93, 0.95, 0.98), vec3(0.40, 0.60, 0.86), pow(h, 0.6)); float s = max(dot(vD, sun), 0.0); c += vec3(1.0, 0.93, 0.78) * (pow(s, 12.0) * 0.45 + pow(s, 400.0) * 1.5); gl_FragColor = vec4(c, op); }" }));
  sky.renderOrder = -3;
  const wc = new THREE.TextureLoader().load("assets/wc/copper.jpg?v=1"); wc.colorSpace = THREE.SRGBColorSpace; wc.wrapS = THREE.MirroredRepeatWrapping; wc.repeat.set(4, 1);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(60, 60, 22, 64, 1, true), new THREE.MeshBasicMaterial({ map: wc, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  { const g = ring.geometry, uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 0.12 + uv.getY(i) * 0.5); } // the mountains' band of the painting, not its paper edges
  ring.position.y = 6; ring.renderOrder = -2;
  const flareTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,250,235,1)"); r.addColorStop(0.3, "rgba(255,236,200,.5)"); r.addColorStop(1, "rgba(255,236,200,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const flare = new Lensflare(); flare.addElement(new LensflareElement(flareTex, 380, 0, new THREE.Color(1, 0.96, 0.88))); flare.addElement(new LensflareElement(flareTex, 60, 0.5, new THREE.Color(0.8, 0.9, 1))); flare.addElement(new LensflareElement(flareTex, 90, 0.8, new THREE.Color(1, 0.9, 0.8)));
  flare.position.copy(SUN).multiplyScalar(60); flare.visible = false;
  const group = new THREE.Group(); group.add(sky, ring, ground, track, kick, spray, flakes, flare); scene.add(group);
  const setSky = (w) => { sky.material.uniforms.op.value = w; ring.material.opacity = w; sky.visible = ring.visible = w > 0.01; flare.visible = w > 0.6; };

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
        kick.position.set(kx, groundAt(kx, kz), kz); kick.rotation.y = h; kick.visible = true;
        air = { i0, i1, ...r.kicker };
      }
      run = { line, char, mover, t: 0, seg: -1, air, done: 0, k, cam: null, look: null };
      return true;
    },
    get running() { return !!run && !run.done; },
    // The camera during an entrance, shot by shot (see SHOTS); eases back to the resting view (rest: the
    // camera's position and target there) as the rider pulls up. Returns false when it isn't driving.
    shoot(camera, dt, rest) {
      if (!run || !run.now) { setSky(0); return false; }
      const { x, y, z, h, u, i, flying } = run.now, P = new THREE.Vector3(x, y, z);
      // the travel direction, smoothed (a carve's swing or a spin shouldn't swing the camera through the rider)
      const Fr = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h)), F = (run.F ||= Fr.clone()).lerp(Fr, 1 - Math.exp(-dt * 1.2)).normalize();
      const S = (run.S ||= new THREE.Vector3(F.z, 0, -F.x).multiplyScalar(F.x > 0 ? -1 : 1)); // one side for the whole shot, toward the viewer
      const up = (v) => new THREE.Vector3(0, v, 0);
      let pos, at, wide = 1, snap = 6;
      const key = run.k, air = run.air;
      if (key === "A") {
        if (u < 0.3) { pos = new THREE.Vector3(1.6, 0.55, 4.5); at = P.clone().add(up(0.8)); wide = 0.4; }
        else { pos = P.clone().addScaledVector(S, 6.5).addScaledVector(F, -1.5).add(up(0.9)); at = P.clone().add(up(0.7)); snap = 9; }
      } else if (key === "B") {
        if (u < 0.5) { pos = P.clone().addScaledVector(F, -8).add(up(2.8)); at = P.clone().addScaledVector(F, 2).add(up(0.4)); snap = 9; }
        else { const a = (run.orbit ??= Math.atan2(S.x, S.z)) + (u - 0.5) * 5.5; pos = P.clone().add(new THREE.Vector3(Math.sin(a) * 5.2, 1.5, Math.cos(a) * 5.2)); at = P.clone().add(up(0.7)); }
      } else if (key === "C") {
        if (u < 0.55) { pos = P.clone().addScaledVector(F, -7).add(up(3.2)); at = P.clone().addScaledVector(F, 3); }
        else { pos = P.clone().addScaledVector(F, 7).addScaledVector(S, 1.2).add(up(0.5)); at = P.clone().add(up(0.8)); }
      } else if (key === "D" && air) {
        if (i < air.i0) { pos = P.clone().addScaledVector(F, -8).add(up(2.2)); at = P.clone().addScaledVector(F, 4).add(up(0.6)); snap = 9; }
        else if (i < air.i1 + 8) { // from beside the lip, looking up: the rider against the sky and the sun
          run.lip ??= kick.position.clone().addScaledVector(F, 0.5).addScaledVector(S, 4.8).add(up(0.3)); pos = run.lip; at = P.clone().add(up(0.5)); snap = 9; }
        else { pos = P.clone().addScaledVector(F, 7).add(up(1)); at = P.clone().add(up(0.8)); }
      } else { pos = rest.pos.clone(); at = rest.at.clone(); wide = 0; }
      // the last stretch: back to the resting view
      const b = Math.min(1, Math.max(0, (u - 0.86) / 0.14)), e = b * b * (3 - 2 * b);
      pos.lerp(rest.pos, e); at.lerp(rest.at, e); wide *= 1 - e;
      const k = 1 - Math.exp(-dt * snap);
      if (!run.cam) { run.cam = camera.position.clone(); run.look = rest.at.clone(); }
      run.cam.lerp(pos, k); run.look.lerp(at, 1 - Math.exp(-dt * 12)); // aim quicker than the camera moves, so the rider stays in frame
      camera.position.copy(run.cam); camera.lookAt(run.look);
      setSky(wide);
      return true;
    },
    stop() { run = null; setSky(0); },
    // Advance; when the line ends the rider stops on their board and turns to you.
    step(dt) {
      particles(dt);
      if (!run) return false;
      const { line, char, mover, air } = run;
      if (run.done) { run = null; setSky(0); return false; }
      // The last stretch is a skid stop: the board swings across the line (the rider ends facing you), the
      // slide slows over about two seconds, and they rise out of the move into standing.
      const F = line.pts.length - 1, STOP = 30, fNow = run.t * line.fps, left = F - fNow;
      run.t += dt * (left > STOP ? 1 : Math.max(0.08, left / STOP));
      const f = run.t * line.fps, i = Math.min(line.pts.length - 1, Math.floor(f)), j = Math.min(line.pts.length - 1, i + 1), u = f - Math.floor(f);
      const s = line.segAt.findLastIndex((sg) => i >= sg.i0);
      if (s !== run.seg && !run.stopping) { run.seg = s; const sg = line.segAt[s]; char.play(sg.clip, sg.once ? { once: true } : {}); }
      const x = line.pts[i][0] + (line.pts[j][0] - line.pts[i][0]) * u, z = line.pts[i][1] + (line.pts[j][1] - line.pts[i][1]) * u, h = line.hd[i] + (line.hd[j] - line.hd[i]) * u;
      let y = groundAt(x, z), flying = false;
      if (air && i >= air.i0 - 6 && i < air.i0) y += air.h * (i - air.i0 + 6 + u) / 6; // up the kicker
      if (air && i >= air.i0 && i < air.i1) { const q = (i - air.i0 + u) / (air.i1 - air.i0); y += air.h * (1 - q) + air.peak * 4 * q * (1 - q); flying = true; }
      const stopW = Math.min(1, Math.max(0, 1 - (F - f) / STOP)), sw = stopW * stopW * (3 - 2 * stopW), end = Math.round(h / (2 * Math.PI)) * 2 * Math.PI;
      if (stopW > 0 && !run.stopping) { run.stopping = true; char.play("Stand_Idle", { fade: 1.2 }); }
      mover.position.set(x, y, z); mover.rotation.y = h + (end - h) * sw;
      run.now = { x, y, z, h, u: f / F, i, flying };
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
