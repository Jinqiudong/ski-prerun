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
const FAR = -40;

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

// What each friend does on the way down: one whole clip by the character AI (Entrance_A ... D, 30 fps), ridden
// along the line its own board implies (character.js trace), turned to come at you out of the mountains and
// end at your feet. Frames are the clip's (rider_templates.json, HANDOFF): air is [take-off, landing], the
// board off the snow (C pops on the slope; D leaves a kicker's lip at the take-off); end is where the skid
// stop may begin (after the move, so it never cuts into it).
const ROUTES = {
  A: { clip: "Entrance_A", v: 5.5 },                                                     // two euro carves
  B: { clip: "Entrance_B", v: 6.5, spin: [125, 242], end: 242 },                         // carves, lower each time, into the carved spin
  C: { clip: "Entrance_C", v: 5.5, air: [233, 276], end: 281 },                          // S turns, then a pop (230), peak 259
  D: { clip: "Entrance_D", v: 7, air: [207, 240], end: 245, kicker: { at: 207 / 250, peak: 0.6 } }, // the run-in, a kicker (lip 207), a Method (peak 220)
};
const STOP = 30; // the skid stop, in line frames
const LONG = 30; // the longest way in (m): longer lines are drawn in to this
const rotY = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
// Goofy (mirror < 0: the rider is drawn mirrored, so the board's nose points the other way): the line is
// mirrored sideways, so a carve still turns toward the toe edge, and the rider is turned half round on it
// (step), so the nose leads.
function lineOf(char, r, mirror = 1) {
  const T = char.trace(r.clip, 1, r.v); if (!T) return null;
  const pts = T.pts.map(([x, z]) => [x, z * mirror]), hd = T.hd.map((h) => h * mirror), n = pts.length;
  // run on past the clip's end, if its move runs late, so the stop comes after it (straight on, the clip held)
  const tail = Math.max(0, (r.end ?? 0) + STOP - (n - 1)), [lx, lz] = pts[n - 1], lh = hd[n - 1], st = r.v / T.fps;
  for (let i = 1; i <= tail; i++) { pts.push([lx + Math.cos(lh) * st * i, lz - Math.sin(lh) * st * i]); hd.push(lh); }
  // end at the origin; the start out toward the mountains (-z), a little to one side
  const [ex, ez] = pts[pts.length - 1], [sx, sz] = [pts[0][0] - ex, pts[0][1] - ez], L = Math.hypot(sx, sz), k = Math.min(1, LONG / L);
  // Turned so its last stretch comes straight at you (then the skid stop is a quarter turn and ends facing
  // you); if that leaves the start too near, turned so the start is out in the mountains instead.
  const ang = (x, z) => Math.atan2(-z, x), m = pts[Math.floor(pts.length * 0.75)];
  let alpha = ang(0.08, 1) - ang(ex - m[0], ez - m[1]);
  if (rotY(sx, sz, alpha)[1] * k > -LONG * 0.5) alpha = ang(-0.12, -1) - ang(sx, sz);
  const P = pts.map(([x, z]) => rotY((x - ex) * k, (z - ez) * k, alpha));
  let H = hd.map((h) => h + alpha);
  const by = T.by.map((y) => y * char.root.scale.x), out = { pts: P, hd: H, by, n, fps: T.fps };
  // keep it in view: a line wandering out past the sides is drawn in sideways (and its headings follow)
  const wide = Math.max(...P.map(([x, z]) => Math.abs(x) / (0.5 + 0.22 * Math.abs(z))));
  if (wide > 1) {
    const D = P.map(([x, z]) => [x / wide, z]);
    H = H.map((h, i) => { const a = D[Math.max(0, i - 1)], b = D[Math.min(D.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], q = P[Math.max(0, i - 1)], w = P[Math.min(P.length - 1, i + 1)];
      return Math.hypot(dx, dz) > 1e-4 ? h + (Math.atan2(-dz, dx) - Math.atan2(-(w[1] - q[1]), w[0] - q[0])) : h; });
    return { ...out, pts: D, hd: H };
  }
  return out;
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
  kick.visible = false; // out until an entrance with a kicker puts it down (an animal on the stage never runs one)
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
  // the camera's lens: 30° at rest; a cut changes it at once
  const lens = (camera, v) => { if (Math.abs(camera.fov - v) > 0.01) { camera.fov = v; camera.updateProjectionMatrix(); } };
  const cache = new Map(), ray = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0);
  const at = (line, i) => line.pts[Math.max(0, Math.min(line.pts.length - 1, i))];
  // the way the line goes round frame i (its chord over a second: in a carve the board's heading swings off it)
  const dirAt = (line, i) => { const a = at(line, i - 15), b = at(line, i + 15); return new THREE.Vector3(b[0] - a[0], 0, b[1] - a[1]).normalize(); };
  const E = {
    group,
    start(k, char, mover) {
      const r = ROUTES[k]; if (!r) return false;
      // regular or goofy: whether the rider is drawn mirrored (start.js sets it before this)
      char.root.updateWorldMatrix(true, false); const mirror = char.root.matrixWorld.determinant() < 0 ? -1 : 1;
      const key = char.root.uuid + k + char.root.scale.x + mirror; if (!cache.has(key)) cache.set(key, lineOf(char, r, mirror));
      const line = cache.get(key); if (!line) return false;
      n = 0; tGeo.setDrawRange(0, 0); kick.visible = false; kick.material.opacity = 1;
      let air = r.air ? { i0: r.air[0], i1: r.air[1], peak: 0, y0: 0, ramp: null } : null;
      if (r.kicker) { // the kicker's lip where the board leaves the snow; the board rides up its face to there
        const i0 = Math.round((line.n - 1) * r.kicker.at), [x, z] = line.pts[i0], h = line.hd[i0], back = KL / 2 - 0.15, kx = x - Math.cos(h) * back, kz = z + Math.sin(h) * back;
        kick.position.set(kx, groundAt(kx, kz), kz); kick.rotation.y = h; kick.visible = true; kick.updateMatrixWorld(true);
        // the face's height under each frame on the way up (read off the kicker itself), and the clip's own
        // lift of the board taken out there, so the board sits on the face
        const surf = (i) => { const [px, pz] = at(line, i); ray.set(new THREE.Vector3(px, 5, pz), DOWN); return ray.intersectObject(kick)[0]?.point.y ?? null; };
        const ramp = new Map(); let i = i0, ref = 0;
        for (; i > i0 - 60; i--) { const y = surf(i); if (y === null || y <= groundAt(...at(line, i)) + 0.01) break; ramp.set(i, y); }
        ref = line.by[i + 1] ?? 0;
        for (const [j, y] of ramp) ramp.set(j, y - Math.max(0, line.by[j] - ref));
        air = { ...air, i0, peak: r.kicker.peak, y0: ramp.get(i0) ?? groundAt(x, z), ramp }; E.kicker = { lip: i0, ramp: [...ramp.keys()].sort((a, b) => a - b) }; // (for tests)
      }
      char.play(r.clip, { once: true, fade: 0.3 });
      run = { line, char, mover, t: 0, air, r, done: 0, k, cam: null, look: null, shot: null, flip: mirror < 0 ? Math.PI : 0 };
      return true;
    },
    get running() { return !!run && !run.done; },
    get now() { return run?.now ? { ...run.now, F: run.line.pts.length - 1 } : null; }, // (for tests)
    // The camera during an entrance, shot by shot, on the clip's frames: the take-off from behind (D and C
    // from low behind, against the sky and the sun), the landing from in front, B's spin from a still camera
    // so it reads; eases back to the resting view (rest: the camera's position and target there) through
    // the stop. A cut jumps; a follow shot glides. Returns false when it isn't driving.
    shoot(camera, dt, rest) {
      if (!run || !run.now) { setSky(0); lens(camera, 30); return false; }
      const { x, y, z, h, i, f } = run.now, P = new THREE.Vector3(x, y, z), line = run.line, r = run.r;
      // the travel direction, smoothed (a carve's swing or a spin shouldn't swing the camera through the rider)
      const Fr = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h)), F = (run.F ||= Fr.clone()).lerp(Fr, 1 - Math.exp(-dt * 1.2)).normalize();
      const S = (run.S ||= new THREE.Vector3(F.z, 0, -F.x).multiplyScalar(F.x > 0 ? -1 : 1)); // one side for the whole shot, toward the viewer
      const up = (v) => new THREE.Vector3(0, v, 0);
      // aim at the hips, not the board: in a laid-out carve or a spin the body is well off the board's line
      const Hp = run.char.bones.Hips.getWorldPosition(new THREE.Vector3()), aim = (v) => Hp.clone().add(up(v - 0.75)), G = (p) => new THREE.Vector3(p[0], groundAt(p[0], p[1]), p[1]);
      // a still camera, set up once when its shot begins (from the line's own direction there, not the smoothed one)
      const still = (id, mk) => (run.still?.id === id ? run.still.pos : (run.still = { id, pos: mk() }).pos);
      let shot, pos, lookAt, wide = 1, snap = 6;
      let fov = 30;
      const key = run.k, air = run.air, chase = () => { pos = P.clone().addScaledVector(F, -8).add(up(2.5)); lookAt = P.clone().addScaledVector(F, 3).add(up(0.5)); snap = 9; };
      // in front of where they land, low, looking back up the line at them
      const front = (j, far = 5.5) => { const d = dirAt(line, j), s = new THREE.Vector3(d.z, 0, -d.x).multiplyScalar(d.x > 0 ? -1 : 1); return G(at(line, j + 6)).addScaledVector(d, far).addScaledVector(s, 1.4).add(up(0.7)); };
      // low behind the take-off, a little to the side, looking up past them at the sky
      const lowBack = (j, back, side) => { const d = dirAt(line, j), s = new THREE.Vector3(d.z, 0, -d.x).multiplyScalar(d.x > 0 ? -1 : 1); return G(at(line, j)).addScaledVector(d, -back).addScaledVector(s, side).add(up(0.25)); };
      if (key === "A") {
        if (f < line.n * 0.3) { shot = "a0"; pos = new THREE.Vector3(1.6, 0.55, 4.5); lookAt = aim(0.8); wide = 0.4; }
        else { shot = "a1"; pos = P.clone().addScaledVector(S, 6.5).addScaledVector(F, -1.5).add(up(0.9)); lookAt = aim(0.7); snap = 9; }
      } else if (key === "B") {
        const [s0, s1] = r.spin, mid = Math.round((s0 + s1) / 2);
        if (i < s0 - 12) { shot = "b0"; chase(); }
        else if (i >= s1 - 8) { shot = "b2"; pos = still("b2", () => front(s1 - 8, 8)); lookAt = aim(0.7); } // out of it, toward you
        else { // still, beside where the spin is at its middle and a little ahead, high enough to see the board turn round
          shot = "b1"; pos = still("b1", () => { const d = dirAt(line, mid), s = new THREE.Vector3(d.z, 0, -d.x).multiplyScalar(d.x > 0 ? -1 : 1); return G(at(line, mid)).addScaledVector(s, 7).addScaledVector(d, 2.5).add(up(2)); });
          lookAt = aim(0.6); }
      } else if ((key === "C" || key === "D") && air) {
        const lip = air.i0, land = air.i1, low = lip - (key === "D" ? 8 : 6), peakEnd = key === "D" ? 222 : 261;
        if (i < low) { shot = "c0"; chase(); }
        else if (i < peakEnd) { // a wider lens, so the sky (and the sun) are round them as they go up
          shot = "up"; pos = still("up", () => lowBack(lip, key === "D" ? 5.5 : 6.5, 1)); lookAt = aim(run.now.flying ? 1.2 : 0.9); fov = 42; }
        else { shot = "land"; pos = still("land", () => front(land)); lookAt = aim(0.7); }
      } else { pos = rest.pos.clone(); lookAt = rest.at.clone(); wide = 0; }
      // the stop: back to the resting view
      const F0 = line.pts.length - 1 - STOP - 6, b = Math.min(1, Math.max(0, (f - F0) / (STOP + 6))), e = b * b * (3 - 2 * b);
      pos.lerp(rest.pos, e); lookAt.lerp(rest.at, e * e); // the aim stays on them a little longer wide *= 1 - e; lens(camera, fov + (30 - fov) * e);
      if (!run.cam) { run.cam = camera.position.clone(); run.look = rest.at.clone(); }
      if (shot !== run.shot) { const cut = run.shot && run.still?.id === shot; run.shot = shot; if (cut) { run.cam.copy(pos); run.look.copy(lookAt); } }
      run.cam.lerp(pos, 1 - Math.exp(-dt * snap)); run.look.lerp(lookAt, 1 - Math.exp(-dt * 12)); // aim quicker than the camera moves, so the rider stays in frame
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
      const F = line.pts.length - 1, fNow = run.t * line.fps, left = F - fNow;
      run.t += dt * (left > STOP ? 1 : Math.max(0.08, left / STOP));
      const f = Math.min(F, run.t * line.fps), i = Math.min(F, Math.floor(f)), j = Math.min(F, i + 1), u = f - Math.floor(f);
      const x = line.pts[i][0] + (line.pts[j][0] - line.pts[i][0]) * u, z = line.pts[i][1] + (line.pts[j][1] - line.pts[i][1]) * u, h = line.hd[i] + (line.hd[j] - line.hd[i]) * u;
      let y = groundAt(x, z), flying = false;
      if (air?.ramp?.has(i)) { const a = air.ramp.get(i), b = air.ramp.get(j) ?? a; y = a + (b - a) * u; } // up the kicker's face
      if (air && f >= air.i0 && f < air.i1) { // off the lip (or the snow) to the landing; the clip lifts the board itself
        const q = (f - air.i0) / (air.i1 - air.i0); if (air.ramp) y = air.y0 * (1 - q) + y * q + air.peak * 4 * q * (1 - q); flying = true; }
      // the rider's yaw on the line: the board's nose along it (turned half round for goofy, see lineOf); the stop ends facing you
      const yaw = h + run.flip, stopW = Math.min(1, Math.max(0, 1 - (F - f) / STOP)), sw = stopW * stopW * (3 - 2 * stopW), end = Math.round(yaw / (2 * Math.PI)) * 2 * Math.PI;
      if (stopW > 0 && !run.stopping) { run.stopping = true; char.play("Stand_Idle", { fade: 1.2 }); }
      mover.position.set(x, y, z); mover.rotation.y = yaw + (end - yaw) * sw;
      run.now = { x, y, z, h, u: f / F, i, f, flying };
      if (!flying) {
        lay(x, y, z, h);
        // spray: off the outside of the turn, more the sharper it turns; a sheet of it while stopping
        const turn = (h - (run.lastH ?? h)) / Math.max(dt, 1e-3); run.lastH = h;
        const side = Math.sign(turn) || 1, ox = Math.sin(h) * side, oz = Math.cos(h) * side, fx = Math.cos(h), fz = -Math.sin(h);
        const n = stopW > 0 ? Math.round(16 * (1 - stopW) + 3) : Math.min(9, Math.round(Math.abs(turn) * 6 + Math.random() * 0.8));
        if (n > 0) emit(x, y + 0.05, z, (stopW > 0 ? fx * 4 : ox * 2.4) + fx * 1.5, 2.2, (stopW > 0 ? fz * 4 : oz * 2.4) + fz * 1.5, n);
        if (run.wasFlying) { emit(x, y, z, 0, 2.5, 0, 40); run.wasFlying = false; } // landing
      } else run.wasFlying = true;
      if (air?.ramp) kick.material.opacity = Math.min(1, Math.max(0, 1 - (i - air.i1) / 20));
      if (f >= F - 0.05) run.done = true;
      return false;
    },
  };
  return E;
}
