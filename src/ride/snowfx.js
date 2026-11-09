// The snow's fun, drawn: trees you can see your rider through, a crash into a tree (snow sliding off its
// branches, dizzy stars), powder on the ground, and moguls on the runs. The rules (where powder lies, which
// runs have moguls, the bumps) are snow-core.js; the ride (ride.js) calls these.
// Phone cost: the see-through is a few shader instructions per tree vertex and fragment, no CPU work; a crash
// is one instanced mesh (36 clumps) and one points draw (stars, birds and puffs together), updated only while
// something is falling; the moguls are one static mesh per mogul run near the way down.
import * as THREE from "three";
import { lineHeight, MOGULS } from "./snow-core.js?v=5";

// ---------- Seeing the rider through the trees ----------
// Tree pixels in a cone from the camera to the rider (occK.x m round at the lens, occK.y at the rider) and
// anything closer to the lens than occK.z..occK.w m are screen-door dithered away (a fixed pattern of
// discarded pixels: no sorting, no blending), so from the chase camera you see your rider through the
// branches. Trees whose trunk stands right in that line thin out as a whole as well (tested per instance in
// the vertex shader), by occT 0..1. The chase camera uses 3.2, 1.3, 2..5 m and 1; down at eye level in the
// woods (ride.js) the tunnel is narrow, only what's right at the lens goes and whole trees hardly thin, so the
// trunks you ride between stay solid and nothing flickers away as you pass. Shadows use the default depth
// material, so the trees still throw them.
export const sight = { occA: { value: new THREE.Vector3() }, occB: { value: new THREE.Vector3() }, occOn: { value: 0 }, occK: { value: new THREE.Vector4(3.2, 1.3, 2, 5) }, occT: { value: 1 } };
export function seeThrough(mat, crown = 0.3) {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => key() + "|see";
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    Object.assign(sh.uniforms, sight);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform vec3 occA, occB; uniform float occOn, occT; varying float vOcc; varying float vViewZ; varying vec3 vOW;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        vOcc = 0.0; vViewZ = -mvPosition.z;
        #ifdef USE_INSTANCING
        vOW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        if (occOn > 0.5) {
          vec3 tb = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec2 ab = occB.xz - occA.xz;
          float t = dot(tb.xz - occA.xz, ab) / max(dot(ab, ab), 1e-4);
          float rad = length(instanceMatrix[1].xyz) * ${crown.toFixed(2)} + 0.8; // the crown's reach, from the tree's height
          float off = length(occA.xz + ab * clamp(t, 0.0, 1.0) - tb.xz);
          vOcc = occT * (1.0 - smoothstep(rad * 0.6, rad, off)) * (1.0 - smoothstep(0.75, 0.92, t)) * step(-0.2, t);
        }
        #else
        vOW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 occA, occB; uniform vec4 occK; uniform float occOn; varying float vOcc; varying float vViewZ; varying vec3 vOW;")
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
        if (occOn > 0.5) {
          vec3 ab = occB - occA;
          float t = clamp(dot(vOW - occA, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0), rad = mix(occK.x, occK.y, t);
          float cone = (1.0 - smoothstep(rad * 0.5, rad, length(occA + ab * t - vOW))) * (1.0 - smoothstep(0.97, 1.0, t)); // right up to the rider, nothing beyond
          float occ = max(max(cone, vOcc * 0.6), 1.0 - smoothstep(occK.z, occK.w, vViewZ));
          if (occ > 0.0 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) < occ) discard; // clear in the middle, dithered at the edge
        }`);
  };
  return mat;
}

// ---------- Painted bits: stars, a little bird, a puff of snow ----------
// One atlas, four cells of 128 px: a star, a pale star, a bird, a puff. Navy wobbly ink and soft washes, like
// the icon library (assets/icons), drawn once on a canvas.
function paintAtlas() {
  const S = 128, c = document.createElement("canvas"); c.width = S * 4; c.height = S;
  const g = c.getContext("2d"), INK = "#23304a";
  let seed = 9; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const wobblePath = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => { const j = (rnd() - 0.5) * 1.6; (i ? g.lineTo : g.moveTo).call(g, x + j, y + j); }); g.closePath(); };
  const star = (cx, fill, hi) => {
    const pts = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 19 : 44; for (let m = 0; m < 3; m++) { const a2 = a + (m / 3) * (Math.PI / 5); const r2 = r + ((k % 2 ? 44 : 19) - r) * (m / 3); pts.push([cx + Math.cos(a2) * r2, 66 + Math.sin(a2) * r2]); } }
    wobblePath(pts);
    const gr = g.createRadialGradient(cx - 10, 54, 4, cx, 66, 46); gr.addColorStop(0, hi); gr.addColorStop(1, fill);
    g.fillStyle = gr; g.fill(); g.lineJoin = "round"; g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.moveTo(cx - 14, 52); g.quadraticCurveTo(cx - 10, 42, cx - 3, 38); g.stroke();
  };
  star(64, "#e8b84a", "#fff3c2");
  star(192, "#f1d690", "#fffaf0");
  // the bird: a round blue-grey body, a wing, a tail, a dot of an eye and a little beak
  { const x = 320, y = 70; g.lineJoin = g.lineCap = "round"; g.lineWidth = 6; g.strokeStyle = INK;
    wobblePath([[x - 34, y - 2], [x - 50, y - 16], [x - 46, y + 4], [x - 30, y + 14]]); g.fillStyle = "#6f86a6"; g.fill(); g.stroke(); // tail
    g.beginPath(); g.ellipse(x, y, 32, 25, -0.15, 0, Math.PI * 2); const gr = g.createRadialGradient(x - 8, y - 10, 3, x, y, 34); gr.addColorStop(0, "#c9d6e8"); gr.addColorStop(1, "#93abc9"); g.fillStyle = gr; g.fill(); g.stroke();
    wobblePath([[x - 14, y - 2], [x + 8, y - 26], [x + 14, y - 4]]); g.fillStyle = "#e6b4bb"; g.fill(); g.stroke(); // wing up
    wobblePath([[x + 30, y - 6], [x + 46, y - 1], [x + 30, y + 4]]); g.fillStyle = "#e3cf96"; g.fill(); g.lineWidth = 4; g.stroke(); // beak
    g.fillStyle = INK; g.beginPath(); g.arc(x + 17, y - 9, 4, 0, Math.PI * 2); g.fill(); }
  // a puff: soft white, a blue-grey wash under it so it reads against the snow
  { const x = 448, y = 64;
    for (const [dx, dy, r, a] of [[4, 10, 50, 0.55], [-14, 4, 30, 0.9], [14, -6, 34, 0.9], [-2, -16, 28, 0.95]]) {
      const gr = g.createRadialGradient(x + dx - 6, y + dy - 8, 2, x + dx, y + dy, r);
      gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.6, `rgba(238,243,252,${a * 0.75})`); gr.addColorStop(1, "rgba(176,194,224,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(x + dx, y + dy, r, 0, Math.PI * 2); g.fill();
    } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const FRAME = { star: 0, pale: 1, bird: 2, puff: 3 };

// Points with a size in metres, an alpha, an atlas cell and a turn each: stars, birds and puffs in one draw.
function spriteCloud(n, map) {
  const geo = new THREE.BufferGeometry();
  const attr = (k, size) => { const a = new THREE.BufferAttribute(new Float32Array(n * size), size); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); return a.array; };
  const pos = attr("position", 3), size = attr("aSize", 1), alpha = attr("aAlpha", 1), frame = attr("aFrame", 1), rot = attr("aRot", 1);
  pos.fill(-1e5);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { map: { value: map }, scale: { value: 800 } },
    vertexShader: `attribute float aSize, aAlpha, aFrame, aRot; varying float vA, vF, vR; uniform float scale;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = aAlpha > 0.0 ? aSize * scale / max(0.1, -mv.z) : 0.0; vA = aAlpha; vF = aFrame; vR = aRot; }`,
    fragmentShader: `uniform sampler2D map; varying float vA, vF, vR;
      void main() { vec2 p = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR); p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) * 1.15 + 0.5;
        if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) discard;
        vec4 t = texture2D(map, vec2((p.x + vF) / 4.0, 1.0 - p.y)); gl_FragColor = vec4(t.rgb, t.a * vA); if (gl_FragColor.a < 0.02) discard;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = 4;
  return { pts, geo, pos, size, alpha, frame, rot, n };
}

// ---------- A crash into a tree ----------
const STARS = 6, PUFFS = 260, CLUMPS = 36;
export class CrashFX {
  constructor(scene, groundAt) {
    this.groundAt = groundAt;
    this.cloud = spriteCloud(STARS + PUFFS, paintAtlas());
    scene.add(this.cloud.pts);
    // Clumps: lumpy little snowballs, one instanced mesh.
    const geo = new THREE.SphereGeometry(1, 10, 7), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.86 + 0.12 * Math.sin(x * 4.1 + y * 2.3) * Math.cos(z * 3.7 - y * 1.9); p.setXYZ(i, x * k, y * k * 0.8, z * k); } // lumpy, a little flattened
    geo.computeVertexNormals();
    this.clumps = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xf2f5fb, roughness: 1, flatShading: false }), CLUMPS);
    this.clumps.frustumCulled = false; this.clumps.count = 0;
    scene.add(this.clumps);
    this.c = Array.from({ length: CLUMPS }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0, wait: 0, rest: 0, spin: 0 }));
    this.p = Array.from({ length: PUFFS }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, s0: 0, s1: 0 }));
    this.nextPuff = 0; this.stars = null; this.wob = null; this.busy = false;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
    this._m2 = new THREE.Matrix4(); this._t = new THREE.Matrix4(); this._ax = new THREE.Vector3();
  }

  // Snow off a tree you hit: tree { x, y, z, h, inst }, (fx, fz) the way you were going. The tree shudders,
  // clumps let go from its branches (high ones a moment later, as a shake runs up the trunk), powder sifts down.
  hitTree(tree, fx, fz, hard = 1) {
    const H = tree.h || 18, n = Math.round(14 + 14 * hard);
    let k = 0;
    for (const c of this.c) {
      if (c.on || k >= n) continue;
      const u = 0.2 + Math.random() * 0.55, y = H * u, reach = (0.34 * Math.pow(Math.max(0, 1 - (u - 0.09) / 0.66), 0.95) + 0.06) * H * (0.5 + Math.random() * 0.5); // out on a branch at that height
      const a = Math.atan2(-fx, -fz) + (Math.random() - 0.5) * 2.6; // mostly on the rider's side
      Object.assign(c, { on: true, x: tree.x + Math.sin(a) * reach, y: tree.y + y, z: tree.z + Math.cos(a) * reach, vx: Math.sin(a) * 0.6, vy: -0.4, vz: Math.cos(a) * 0.6,
        s: 0.07 + Math.random() * 0.16, wait: u * 0.5 + Math.random() * 0.25, rest: 0, spin: Math.random() * 6 });
      k++;
      for (let j = 0; j < 2; j++) this.puff(c.x, c.y, c.z, 0.6, 0.8 + Math.random() * 1.2, 1.2 + Math.random() * 0.9, c.wait, -1.6 - Math.random()); // powder shaken off with it
    }
    // a curtain of powder sifting down out of the branches round the trunk, on the rider's side
    for (let j = 0; j < 40 * hard; j++) {
      const u = 0.12 + Math.random() * 0.5, a = Math.atan2(-fx, -fz) + (Math.random() - 0.5) * 3, rr = (0.15 + Math.random() * 0.25) * H;
      this.puff(tree.x + Math.sin(a) * rr, tree.y + H * u, tree.z + Math.cos(a) * rr, 0.4, 0.7 + Math.random() * 1.1, 1.3 + Math.random(), Math.random() * 0.9, -1.2 - Math.random() * 1.2);
    }
    if (tree.inst) this.wob = { tree, t: 0, ax: this._ax.set(fz, 0, -fx).normalize().clone(), base: tree.inst.map(([m, i]) => { const b = new THREE.Matrix4(); m.getMatrixAt(i, b); return b; }) };
    this.busy = true;
  }
  // A puff of powder at (x, y, z): drifting (spread m/s), size s (m), lasting life (s), after a delay.
  puff(x, y, z, spread, s, life, delay = 0, vy = -0.3 - Math.random() * 0.6) {
    const i = this.nextPuff = (this.nextPuff + 1) % PUFFS, q = this.p[i], C = this.cloud, k = STARS + i;
    Object.assign(q, { life: life + delay, max: life, wait: delay, vx: (Math.random() - 0.5) * spread * 2, vy, vz: (Math.random() - 0.5) * spread * 2, s0: s * 0.5, s1: s });
    C.pos.set([x, y, z], k * 3); C.frame[k] = FRAME.puff; C.rot[k] = Math.random() * 6; C.alpha[k] = 0;
    this.busy = true;
  }
  // Stars and a bird round the rider's head while they lie dazed (k 0..1, how much), at head (Vector3).
  dizzy(k, head) {
    if (k <= 0.01) { this.stars = null; return; }
    this.stars ||= { k: 0, x: 0, y: 0, z: 0 }; this.stars.k = k; this.stars.x = head.x; this.stars.y = head.y; this.stars.z = head.z;
    this.busy = true;
  }

  update(dt, camera, renderer) {
    if (!this.busy) return;
    const C = this.cloud, now = performance.now() / 1000;
    C.pts.material.uniforms.scale.value = (renderer.domElement.height * 0.5) / Math.tan((camera.fov * Math.PI) / 360);
    let live = false;
    // stars and birds circling
    for (let k = 0; k < STARS; k++) {
      if (!this.stars) { C.alpha[k] = 0; continue; }
      const S = this.stars, a = now * 3.4 + (k / STARS) * Math.PI * 2, R = 0.5;
      C.pos[k * 3] = S.x + Math.cos(a) * R; C.pos[k * 3 + 1] = S.y + 0.22 + Math.sin(now * 6 + k) * 0.04; C.pos[k * 3 + 2] = S.z + Math.sin(a) * R;
      C.size[k] = (k % 3 === 2 ? 0.44 : k % 3 === 1 ? 0.3 : 0.38) * Math.min(1, S.k * 1.4);
      C.frame[k] = k % 3 === 2 ? FRAME.bird : k % 3 === 1 ? FRAME.pale : FRAME.star;
      C.rot[k] = k % 3 === 2 ? Math.sin(now * 8 + k) * 0.25 : now * 2.5 + k;
      C.alpha[k] = Math.min(1, S.k * 2); live = true;
    }
    // puffs
    const drag = Math.exp(-dt * 1.8);
    for (let i = 0; i < PUFFS; i++) {
      const q = this.p[i], k = STARS + i;
      if (q.life <= 0) { if (C.alpha[k]) { C.alpha[k] = 0; C.pos[k * 3 + 1] = -1e5; } continue; }
      q.life -= dt; live = true;
      if (q.wait > 0) { q.wait -= dt; C.alpha[k] = 0; continue; }
      q.vx *= drag; q.vz *= drag; q.vy = q.vy * drag - 0.9 * dt; // light: it drifts down slowly
      C.pos[k * 3] += q.vx * dt; C.pos[k * 3 + 1] += q.vy * dt; C.pos[k * 3 + 2] += q.vz * dt;
      const f = 1 - Math.max(0, q.life) / q.max;
      C.size[k] = q.s0 + (q.s1 - q.s0) * f; C.alpha[k] = Math.min(1, f * 6) * (1 - f * f) * 0.9; C.rot[k] += dt * 0.6;
    }
    // clumps falling, landing in a burst, then sinking into the snow
    const m = this._m, q = this._q, v = this._v, s = this._s;
    let n = 0;
    for (const c of this.c) {
      if (!c.on) continue;
      live = true;
      if (c.wait > 0) c.wait -= dt;
      else if (c.rest > 0) { c.rest -= dt; if (c.rest <= 0) { c.on = false; continue; } }
      else {
        c.vy -= 9.8 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.spin += dt * 4;
        const g = this.groundAt(c.x, c.z);
        if (c.y - c.s * 0.6 <= g) { c.y = g + c.s * 0.25; c.rest = 2.5; for (let j = 0; j < 4; j++) this.puff(c.x, c.y + 0.1, c.z, 1.3, 0.6 + c.s * 2, 0.7 + Math.random() * 0.5); }
      }
      const sink = c.rest > 0 ? Math.min(1, c.rest / 1.2) : 1;
      m.compose(v.set(c.x, c.y, c.z), q.setFromEuler(this._e.set(c.spin, c.spin * 0.7, 0)), s.setScalar(c.s * (c.wait > 0 ? 0 : sink)));
      this.clumps.setMatrixAt(n++, m);
    }
    this.clumps.count = n;
    if (n) this.clumps.instanceMatrix.needsUpdate = true;
    // the tree shudders and settles
    if (this.wob) {
      const W = this.wob; W.t += dt;
      const ang = 0.045 * Math.exp(-W.t * 3) * Math.sin(W.t * 15), done = W.t > 1.6;
      W.tree.inst.forEach(([mesh, i], j) => {
        const b = W.base[j];
        if (done) mesh.setMatrixAt(i, b);
        else { v.setFromMatrixPosition(b); this._t.makeTranslation(v.x, v.y, v.z).multiply(this._m2.makeRotationAxis(W.ax, ang)).multiply(m.makeTranslation(-v.x, -v.y, -v.z)).multiply(b); mesh.setMatrixAt(i, this._t); }
        mesh.instanceMatrix.needsUpdate = true;
      });
      if (done) this.wob = null; else live = true;
    }
    for (const k of ["position", "aSize", "aAlpha", "aFrame", "aRot"]) C.geo.attributes[k].needsUpdate = true;
    this.busy = live;
  }
}

// ---------- Powder on the ground ----------
// The field (snow-core.js powderField) as a one-channel texture over the terrain's bounds, for the snow's
// shader (ride.js snowA): it raises the snow a little where powder lies (the board sinks into it), smooths and
// brightens it, and ?powder=map paints the field itself.
export const powderU = { powderMap: { value: null }, powderAmt: { value: 0 }, powderBox: { value: new THREE.Vector4(0, 0, 1, 1) }, powderDebug: { value: 0 }, powderRaise: { value: 0.22 } };
export const POWDER_RAISE = 0.22; // m: how far the snow rises where the field is 1 on the deepest day
{ const t = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat); t.needsUpdate = true; powderU.powderMap.value = t; }
export function setPowderField(f, amount) {
  powderU.powderMap.value?.dispose();
  const t = new THREE.DataTexture(f.data, f.w, f.h, THREE.RedFormat, THREE.UnsignedByteType);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.unpackAlignment = 1; t.needsUpdate = true;
  powderU.powderMap.value = t; powderU.powderBox.value.set(f.x0, f.z0, f.x1, f.z1); powderU.powderAmt.value = amount;
}

// ---------- Moguls ----------
// A mogul run's bumps as one mesh, every 0.85 m along and across its middle 30 m (its line's lo..hi), on
// the terrain: each bump a soft rounded cap a touch whiter on top, faint blue shade in the troughs between.
// line: a MogulField line (snow-core.js). 36 × 1.2k vertices (85k triangles, ~2.5 MB) a kilometre.
const TROUGH = new THREE.Color(0.8, 0.85, 0.95), CAP = new THREE.Color(1.05, 1.05, 1.06);
export function mogulMesh(T, line, mat, rules = MOGULS) {
  const s0 = line.lo, s1 = line.hi, step = 0.85, W = 15, cols = Math.round((2 * W) / step) + 1, rows = Math.max(2, Math.round((s1 - s0) / step) + 1);
  const pos = new Float32Array(rows * cols * 3), col = new Float32Array(rows * cols * 3), c = new THREE.Color();
  const { xs, zs, tx, tz, ss } = line, n = xs.length;
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const s = Math.min(line.len, s0 + r * step);
    while (i < n - 2 && ss[i + 1] < s) i++;
    const u = Math.min(1, Math.max(0, (s - ss[i]) / (ss[i + 1] - ss[i] || 1)));
    const cx = xs[i] + (xs[i + 1] - xs[i]) * u, cz = zs[i] + (zs[i + 1] - zs[i]) * u;
    let ax = tx[i] + (tx[i + 1] - tx[i]) * u, az = tz[i] + (tz[i + 1] - tz[i]) * u; const L = Math.hypot(ax, az) || 1; ax /= L; az /= L;
    for (let k = 0; k < cols; k++) {
      const d = -W + k * step, x = cx + az * d, z = cz - ax * d; // d + to the right of the way down, as MogulField
      const h = lineHeight(line, s, d, rules), j = (r * cols + k) * 3;
      pos[j] = x; pos[j + 1] = T.heightAt(x, z) + 0.05 + h; pos[j + 2] = z;
      const f = Math.min(1, h / 0.55); c.copy(TROUGH).lerp(CAP, f * f * (3 - 2 * f));
      col[j] = c.r; col[j + 1] = c.g; col[j + 2] = c.b;
    }
  }
  const idx = new (rows * cols > 65000 ? Uint32Array : Uint16Array)((rows - 1) * (cols - 1) * 6); let p = 0;
  for (let r = 0; r < rows - 1; r++) for (let k = 0; k < cols - 1; k++) { const a = r * cols + k; idx.set([a, a + cols, a + 1, a + 1, a + cols, a + cols + 1], p); p += 6; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}
// The bumps' snow: the colours above, the snow's fine grain in the normals, drawn over the run's corduroy,
// raised with the ground's powder (powderU) on a powder day.
export function mogulMaterial(snowN) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { snowN: { value: snowN } }, powderU);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP; uniform sampler2D powderMap; uniform vec4 powderBox; uniform float powderAmt, powderRaise;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        { vec2 puv = (transformed.xz - powderBox.xy) / (powderBox.zw - powderBox.xy); // on a powder day the bumps are under it too, as the ground
          transformed.y += puv.x < 0.0 || puv.y < 0.0 || puv.x > 1.0 || puv.y > 1.0 ? 0.0 : texture2D(powderMap, puv).r * powderAmt * powderRaise; }`)
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D snowN; varying vec3 vWP;")
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        vec3 nt = texture2D(snowN, vWP.xz / 5.0).xyz * 2.0 - 1.0;
        normal = normalize(normal + (viewMatrix * vec4(nt.x, 0.0, -nt.y, 0.0)).xyz * 0.35);`);
  };
  mat.customProgramCacheKey = () => "moguls";
  return mat;
}
