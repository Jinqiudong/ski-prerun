// The animals on the resort tiles as desk pets (the owner's idea, 2026-11-05). Long-press one (~300 ms, so an
// ordinary drag still turns the map) and it lifts into your finger, dangling and kicking, a small shadow under
// it; let go and it falls onto whatever is below — a tile or the painted map — lands with a squash and a puff
// of snow, shakes itself off, looks around, and then wanders round its new spot. Where you left it is kept
// (localStorage) for next time. A quick tap makes it hop or spin with a little speech bubble; left alone a
// long while it lies down and dozes. The models have no face rig, so all the expression is body language
// (hops, wiggles, a head tilt, a look at you) and the bubbles.
//
// Hooks in collection.js: `this.pets = new Pets(this)` (constructor), `if (this.pets.tap(e)) return;` (tap),
// `this.pets.frame(t)` (frame, in place of walking the animals round their loops).
import * as THREE from "three";

// The emote bubbles. Art comes only from the owner's painted icon library (assets/icons/README.md); these are
// the closest icons there for now. When the painted emotes arrive, swap the one name on each line (and drop
// the text if the icon says it on its own). Wanted, 128×128 transparent PNG like the rest:
// emo_heart (比心: a hand heart), emo_happy (a happy sparkle star), emo_music (music notes), emo_surprise
// ("!"), emo_question ("?"), emo_sleepy ("zzz" with a little moon), emo_snow (a snowflake; `season` may do).
const EMOTES = {
  heart: { icon: "st_favorite", text: "比心" }, // → emo_heart
  happy: { icon: "star", text: "" }, // → emo_happy
  music: { icon: "sunny", text: "" }, // → emo_music
  surprise: { icon: "challenge", text: "!" }, // → emo_surprise
  question: { icon: "compass_n", text: "?" }, // → emo_question
  sleepy: { icon: "nightski", text: "zzz" }, // → emo_sleepy
  snow: { icon: "season", text: "" }, // → emo_snow
};
const PRESS_MS = 300, SLOP = 8, KEY = "prerunPets";
const LIFT_PX = 14; // with a finger, aim just above the fingertip (the pet itself hangs higher still, in view)
const DOZE_AFTER = 90; // seconds alone before it lies down for a nap
const rnd = (a, b) => a + Math.random() * (b - a);
const pickOf = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
const angTo = (from, to) => { let d = (to - from) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

const CSS = `
.pemo { position: absolute; left: 0; top: 0; pointer-events: none; display: flex; align-items: center; gap: 2px; padding: 3px 7px 3px 4px;
  background: #fdfbf6; border: 1.5px solid rgba(34,52,77,.75); border-radius: 15px; box-shadow: 0 3px 8px rgba(60,45,30,.18);
  font: 600 13px "Cormorant Garamond", "Noto Serif SC", serif; color: #22344d; white-space: nowrap; will-change: transform; }
.pemo.solo { padding: 3px; }
.pemo img { width: 26px; height: 26px; display: block; }
.pemo::after { content: ""; position: absolute; left: 50%; bottom: -6px; width: 9px; height: 9px; margin-left: -5px; background: #fdfbf6;
  border-right: 1.5px solid rgba(34,52,77,.75); border-bottom: 1.5px solid rgba(34,52,77,.75); transform: rotate(45deg); }
.pemo i { display: block; font-style: normal; padding-right: 1px; }
.pemo.out { opacity: 0; transition: opacity .25s; }
.pemo > span { display: flex; align-items: center; gap: 2px; animation: pemoPop .32s cubic-bezier(.3,1.6,.5,1) both; transform-origin: 50% 100%; }
@keyframes pemoPop { from { transform: scale(.2); opacity: 0; } to { transform: scale(1); opacity: 1; } }
#world canvas, #ctags .ctag { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: none; }
`;

export class Pets {
  constructor(col) {
    this.col = col; this.list = []; this.puffs = []; this.last = 0; this.now = 0; this.press = null; this.held = null; this.swallow = 0;
    this.dozeAfter = DOZE_AFTER; this.lastPicked = null; this.pointers = new Set();
    if (!document.getElementById("petsCss")) { const st = document.createElement("style"); st.id = "petsCss"; st.textContent = CSS; document.head.append(st); }
    const cv = col.canvas, world = cv.parentElement || cv;
    // On the whole map, not just the canvas: from far out a resort's name tag can sit right over its animal.
    world.addEventListener("pointerdown", (e) => { if (e.target === cv || e.target.closest?.(".ctag")) this.down(e); });
    world.addEventListener("click", (e) => { if (performance.now() < this.swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
    addEventListener("pointermove", (e) => this.move(e));
    addEventListener("pointerup", (e) => this.up(e));
    addEventListener("pointercancel", (e) => this.up(e));
    cv.addEventListener("contextmenu", (e) => { if (this.press || this.held) e.preventDefault(); });
    // A small soft shadow for the one in your hand, and the snow puff's ball.
    const sc = document.createElement("canvas"); sc.width = sc.height = 64; const g = sc.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(30,40,60,.55)"); gr.addColorStop(1, "rgba(30,40,60,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.shadow.visible = false; this.shadow.renderOrder = 2; col.scene.add(this.shadow);
    this.ball = new THREE.SphereGeometry(1, 8, 6);
    this.hang = new THREE.Group(); this.swing = new THREE.Group(); this.hang.add(this.swing); col.scene.add(this.hang);
  }

  // ---- setup, once the tiles are built ----
  init(t) {
    const col = this.col;
    this.floor = col.scene.children.find((o) => o.isMesh && o.material?.alphaMap) || null;
    this.floorY = (this.floor?.position.y ?? -1.6) + 0.02;
    const pp = this.floor?.geometry.parameters, fp = this.floor?.position || new THREE.Vector3();
    // Keep to the map's inner part: its edges fade into the snow.
    this.bounds = pp ? { x0: fp.x - pp.width * 0.42, x1: fp.x + pp.width * 0.42, z0: fp.z - pp.height * 0.42, z1: fp.z + pp.height * 0.42 } : { x0: -60, x1: 60, z0: -60, z1: 60 };
    const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } })();
    this.hOf = new Map();
    for (const w of col.walkers || []) this.hOf.set(w.a.parent, w.h);
    for (const w of col.walkers || []) {
      const a = w.a, tile = col.tiles.find((x) => x.group === a.parent), kind = a.userData.kind;
      const S = tile?.group.children[0]?.geometry?.parameters?.width || 12;
      const p = { a, kind, tall: a.userData.tall || 1, seed: w.seed, u: t * 0.18 + w.seed, mode: "loop", S, place: { g: a.parent, h: w.h, id: tile?.userData.id },
        yaw: 0, x: 0, z: 0, poke: t + rnd(0, 40), act: null, bubble: null, next: t + rnd(60, 200), meet: 0, head: { yaw: 0, pitch: 0, roll: 0 } };
      const s = saved[kind];
      if (s && Number.isFinite(s.x) && Number.isFinite(s.z)) {
        const on = s.on === "map" ? null : col.tiles.find((x) => x.userData.id === s.on);
        if (s.on === "map" || on) { this.settle(p, on ? on.group : col.scene, s.x, s.z, s.yaw || 0); p.mode = "wander"; p.wait = rnd(0, 2); }
      }
      this.list.push(p);
    }
    window.__pets = this; // testing
  }
  // Put a pet on a place (a tile's group, or the scene for the map) at local x, z, looking `yaw`.
  settle(p, g, x, z, yaw) {
    const map = g === this.col.scene;
    if (map) [x, z] = this.onMap(x, z); else { const m = p.S / 2 - 0.6; x = clamp(x, -m, m); z = clamp(z, -m, m); }
    const tile = map ? null : this.col.tiles.find((t) => t.group === g);
    p.place = map ? { g, h: () => this.floorY, id: "map" } : { g, h: this.hOf.get(g) || (() => 0), id: tile?.userData.id };
    g.add(p.a); p.a.rotation.set(0, yaw, 0); p.a.scale.setScalar(1);
    p.x = p.hx = x; p.z = p.hz = z; p.yaw = yaw; p.tx = x; p.tz = z;
    p.a.position.set(x, p.place.h(x, z), z);
  }
  // A spot on the map: inside its inner part, and pushed off any tile's footprint (sunk ones too, as they rise again).
  onMap(x, z) {
    const B = this.bounds; x = clamp(x, B.x0, B.x1); z = clamp(z, B.z0, B.z1);
    for (const t of this.col.tiles) {
      const half = (t.group.children[0]?.geometry?.parameters?.width || 12) * 0.5 * Math.max(1, t.group.scale.x) + 1.4, dx = x - t.base.x, dz = z - t.base.z;
      if (Math.abs(dx) < half && Math.abs(dz) < half) {
        if (half - Math.abs(dx) < half - Math.abs(dz)) x = t.base.x + Math.sign(dx || 1) * half; else z = t.base.z + Math.sign(dz || 1) * half;
      }
    }
    return [clamp(x, B.x0, B.x1), clamp(z, B.z0, B.z1)];
  }
  save() {
    const o = {};
    for (const p of this.list) if (p.mode !== "loop" && p.place) o[p.kind] = { on: p.place.id || "map", x: +p.hx.toFixed(2), z: +p.hz.toFixed(2), yaw: +p.yaw.toFixed(2) };
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch {}
  }

  // ---- what's where on screen ----
  sunk(p) { const g = p.place?.g; return g && g !== this.col.scene && (g.position.y < -1 || (this.col.picked && this.col.picked.group !== g)); }
  // A pet's middle on screen and how big it looks: { x, y, r } in CSS pixels.
  screen(p) {
    const cam = this.col.camera, cv = this.col.canvas, w = cv.clientWidth, h = cv.clientHeight;
    const lo = p.a.localToWorld(new THREE.Vector3(0, 0, 0)), hi = p.a.localToWorld(new THREE.Vector3(0, p.tall, 0)), mid = lo.clone().lerp(hi, 0.5);
    const s = (v) => { const q = v.clone().project(cam); return { x: (q.x * 0.5 + 0.5) * w, y: (-q.y * 0.5 + 0.5) * h, z: q.z }; };
    const a = s(lo), b = s(hi), m = s(mid);
    return { x: m.x, y: m.y, r: Math.hypot(a.x - b.x, a.y - b.y) / 2, z: m.z };
  }
  at(e, minR) {
    const r = this.col.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 1e9;
    for (const p of this.list) {
      if (p === this.held || p.mode === "fall" || !p.a.children.length || this.sunk(p)) continue;
      const s = this.screen(p); if (s.z > 1) continue;
      const d = Math.hypot(s.x - x, s.y - y), lim = Math.max(minR, s.r * 1.1);
      if (d < lim && d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // ---- pointer: long-press to lift, move, let go ----
  down(e) {
    this.pointers.add(e.pointerId);
    if (this.pointers.size > 1 || !this.list.length) { this.cancelPress(); return; }
    if (e.button > 0) return;
    const p = this.at(e, 22); if (!p) return;
    this.press = { p, id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType !== "mouse", timer: setTimeout(() => this.lift(), PRESS_MS) };
  }
  cancelPress() { if (this.press) clearTimeout(this.press.timer); this.press = null; }
  move(e) {
    if (this.press && e.pointerId === this.press.id && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > SLOP) this.cancelPress();
    if (this.held && e.pointerId === this.grip.id) { this.grip.x = e.clientX; this.grip.y = e.clientY; }
  }
  up(e) {
    this.pointers.delete(e.pointerId);
    if (this.press && e.pointerId === this.press.id) this.cancelPress();
    if (this.held && e.pointerId === this.grip.id) this.drop();
  }
  // A quick tap (from collection.tap): true when it was about a pet, so the tile under it isn't picked.
  tap(e) {
    if (this.held || performance.now() < this.swallow) return true;
    const p = this.at(e, 13); if (!p) return false;
    this.poke(p); return true;
  }

  lift() {
    const pr = this.press; this.press = null; if (!pr) return;
    const p = pr.p, col = this.col;
    col.controls.enabled = false; // the finger is the pet's now, not the map's
    this.held = p; this.grip = { id: pr.id, x: pr.x, y: pr.y, touch: pr.touch };
    const wp = p.a.getWorldPosition(new THREE.Vector3()), ws = p.a.getWorldScale(new THREE.Vector3()).x;
    p.wasMode = p.mode; p.mode = "held"; p.act = null; p.poke = this.now; p.hs = ws; p.held0 = this.now;
    this.hang.position.copy(wp).y += p.tall * ws * 0.85; this.hv = new THREE.Vector3(); this.sw = { x: 0, z: 0, vx: 0, vz: 0 };
    this.swing.rotation.set(0, 0, 0); this.swing.add(p.a);
    p.a.position.set(0, 0, 0); p.a.rotation.set(0, 0.9, 0); p.a.scale.setScalar(ws);
    this.shadow.visible = true;
    this.emote(p, "surprise", 1.1);
    navigator.vibrate?.(12);
  }
  // Where a pointer's ray meets the ground (a tile or the map): its world point.
  groundUnder(cx, cy) {
    const r = this.col.canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.col.camera);
    const live = this.col.tiles.filter((t) => t.group.position.y > -1 && !(this.col.picked && this.col.picked !== t)).map((t) => t.group.children[0]);
    const hit = ray.intersectObjects(live, false)[0];
    if (hit) return { ray: ray.ray, p: hit.point };
    const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.floorY), p)) return null;
    return { ray: ray.ray, p };
  }
  // The ground straight below a world point: the place to land on, its local spot and its world height.
  surfaceAt(wx, wz) {
    const col = this.col, v = new THREE.Vector3();
    let best = null;
    for (const t of col.tiles) {
      const g = t.group; if (g.position.y < -1 || (col.picked && col.picked !== t)) continue;
      const l = g.worldToLocal(v.set(wx, 0, wz)), S = g.children[0]?.geometry?.parameters?.width || 12, m = S / 2 - 0.6, h = this.hOf.get(g);
      if (!h || Math.abs(l.x) > S / 2 || Math.abs(l.z) > S / 2) continue;
      const x = clamp(l.x, -m, m), z = clamp(l.z, -m, m), wy = g.localToWorld(new THREE.Vector3(x, h(x, z), z)).y;
      if (!best || wy > best.wy) best = { g, x, z, wy };
    }
    if (best) return best;
    const [x, z] = this.onMap(wx, wz);
    return { g: col.scene, x, z, wy: this.floorY };
  }
  drop() {
    const p = this.held; this.held = null; this.col.controls.enabled = true; this.swallow = performance.now() + 120;
    const wp = p.a.getWorldPosition(new THREE.Vector3()), ws = p.a.getWorldScale(new THREE.Vector3()).x;
    const below = this.surfaceAt(this.hang.position.x, this.hang.position.z);
    this.col.scene.add(p.a); p.a.position.copy(wp); p.a.scale.setScalar(ws);
    const yaw = p.a.rotation.y + this.hang.rotation.y, pitch = p.a.rotation.x;
    p.a.rotation.set(pitch, yaw, 0);
    p.mode = "fall"; p.fall = { from: wp.clone(), s0: ws, t0: this.now, vy: 0, to: below, yaw, pitch, tilt: this.swing.rotation.z };
  }

  // ---- reactions ----
  poke(p) {
    p.poke = this.now;
    if (p.mode === "doze") { p.mode = p.wasMode || "wander"; this.emote(p, "surprise"); this.act(p, "hop", 0.55); return; }
    const r = pickOf(["hop", "spin", "wiggle", "look", "hop2"]);
    this.act(p, r, { hop: 0.6, hop2: 1.1, spin: 0.9, wiggle: 0.9, look: 1.6 }[r]);
    this.emote(p, { hop: pickOf(["happy", "heart"]), hop2: "happy", spin: pickOf(["music", "happy"]), wiggle: "music", look: "heart" }[r]);
  }
  act(p, kind, dur, extra = {}) { p.act = { kind, t0: this.now, dur, ...extra }; }
  emote(p, name, dur = 2.4) {
    const E = EMOTES[name]; if (!E) return;
    if (p.bubble) p.bubble.el.remove();
    const el = document.createElement("div");
    el.className = `pemo${E.text ? "" : " solo"}`; el.dataset.emote = name;
    el.innerHTML = `<span><img src="assets/icons/${E.icon}.png?v=1" alt="">${E.text ? `<i>${E.text}</i>` : ""}</span>`;
    this.col.labels.append(el);
    p.bubble = { el, t0: this.now, dur, name };
  }

  // ---- every frame ----
  frame(t) {
    if (!this.list.length) { if (this.col.walkers?.length) this.init(t); else return; }
    const dt = this.last ? clamp(t - this.last, 0, 0.1) : 0; this.last = t; this.now = t;
    // Picking a resort: its animal is pleased; now and then another one wonders why not theirs.
    if (this.col.picked !== this.lastPicked) {
      const pk = this.col.picked; this.lastPicked = pk;
      if (pk) {
        const mine = this.list.find((p) => p.place?.g === pk.group && p.mode !== "held");
        if (mine && Math.random() < 0.6) mine.later = { at: t + 1.4, fn: () => { this.act(mine, "hop2", 1.1); this.emote(mine, "happy"); } };
        const others = this.list.filter((p) => p !== mine && p.place?.g === this.col.scene && (p.mode === "wander" || p.mode === "loop"));
        if (others.length && Math.random() < 0.35) { const o = pickOf(others); o.later = { at: t + 2, fn: () => { this.act(o, "look", 1.6); this.emote(o, pickOf(["question", "surprise"])); } }; }
      }
    }
    for (const p of this.list) {
      if (p.later && t >= p.later.at) { const f = p.later.fn; p.later = null; f(); }
      if (p.mode === "held") this.holdFrame(p, dt);
      else if (p.mode === "fall") this.fallFrame(p, dt);
      else this.groundFrame(p, dt);
    }
    this.meetings(t);
    this.puffFrame(dt);
    this.bubbles();
  }

  holdFrame(p, dt) {
    const col = this.col, g = this.grip, cam = col.camera, tg = col.controls.target;
    // Seen at least ~64 px tall in your hand, however far out the map is zoomed.
    const want = 64, dist = cam.position.distanceTo(this.hang.position), px = (p.tall / (2 * dist * Math.tan((cam.fov * Math.PI) / 360))) * col.canvas.clientHeight;
    const boost = clamp(want / Math.max(1, px), 1, 3.2) * Math.max(1, p.hs * 0.8);
    const k = Math.min(1, (this.now - p.held0) / 0.25), sc = p.hs + (boost - p.hs) * ease(k);
    p.a.scale.setScalar(sc);
    const L = p.tall * sc * 0.85; // scruff to feet
    // It hangs straight above the ground under your fingertip (where its shadow falls, and where it will land).
    const gu = this.groundUnder(g.x, g.y - (g.touch ? LIFT_PX : 0));
    if (gu) {
      const aim = gu.p.clone(); aim.y += L + p.tall * sc * 0.75 + 0.6;
      const before = this.hang.position.clone();
      this.hang.position.lerp(aim, 1 - Math.exp(-dt * 22));
      if (dt > 0) this.hv.lerp(this.hang.position.clone().sub(before).divideScalar(dt), 0.4);
    }
    // Face the hang frame to the camera: its x is the screen's right, its z toward you.
    const az = Math.atan2(cam.position.x - tg.x, cam.position.z - tg.z); this.hang.rotation.y = az;
    const v = this.hv.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -az), S = this.sw, kk = 70, c = 6, u = 1 / Math.max(4, L * 2);
    const tz = clamp(-v.x * u * 0.9, -1, 1), tx = clamp(v.z * u * 0.9, -0.8, 0.8);
    S.vz += (kk * (tz - S.z) - c * S.vz) * dt; S.z += S.vz * dt; S.vx += (kk * (tx - S.x) - c * S.vx) * dt; S.x += S.vx * dt;
    const t = this.now;
    this.swing.rotation.set(S.x + Math.sin(t * 2.1) * 0.06, 0, S.z + Math.sin(t * 1.7) * 0.1);
    // Dangling from the scruff (nose up, rump down), squirming, legs kicking.
    p.a.rotation.set(-0.55 + Math.sin(t * 7.3) * 0.12, 0.9 + Math.sin(t * 4.1) * 0.35, Math.sin(t * 9.2) * 0.2);
    p.a.position.set(0, p.tall * 0.85, p.tall * 0.22).multiplyScalar(-sc).applyEuler(p.a.rotation);
    this.mix(p, dt * 3.4);
    this.headLook(p, Math.sin(t * 3) * 0.5, -0.25 + Math.sin(t * 5) * 0.15, Math.sin(t * 2.3) * 0.3);
    // Its shadow on the ground straight below.
    const below = this.surfaceAt(this.hang.position.x, this.hang.position.z), hgt = this.hang.position.y - L - below.wy;
    this.shadow.position.set(this.hang.position.x, below.wy + 0.04, this.hang.position.z);
    this.shadow.scale.setScalar(p.tall * sc * (0.55 + 0.15 * Math.exp(-hgt / 6)));
    this.shadow.material.opacity = clamp(1.1 - hgt / (L * 6), 0.35, 0.9);
  }

  fallFrame(p, dt) {
    const F = p.fall, B = F.to, tgt = B.g.localToWorld(new THREE.Vector3(B.x, this.hOf.get(B.g)?.(B.x, B.z) ?? this.floorY, B.z));
    if (B.g === this.col.scene) tgt.y = this.floorY;
    const u = this.now - F.t0, H = Math.max(0.5, F.from.y - tgt.y), T = clamp(Math.sqrt(H) * 0.12, 0.28, 0.6), k = Math.min(1, u / T);
    const endS = B.g === this.col.scene ? 1 : B.g.getWorldScale(new THREE.Vector3()).x;
    p.a.position.set(F.from.x + (tgt.x - F.from.x) * ease(k), Math.max(tgt.y, F.from.y + (tgt.y - F.from.y) * k * k), F.from.z + (tgt.z - F.from.z) * ease(k));
    p.a.scale.setScalar(F.s0 + (endS - F.s0) * ease(k));
    p.a.rotation.set(F.pitch * (1 - ease(k)), F.yaw, F.tilt * (1 - k));
    this.mix(p, dt * 2.5);
    this.shadow.position.set(tgt.x, tgt.y + 0.04, tgt.z); this.shadow.scale.setScalar(p.tall * p.a.scale.x * (0.55 + 0.15 * k));
    if (k >= 1) {
      this.shadow.visible = false;
      const gyaw = B.g === this.col.scene ? 0 : B.g.rotation.y;
      this.settle(p, B.g, B.x, B.z, F.yaw - gyaw);
      p.mode = "land"; p.land = this.now; p.wasMode = "wander";
      this.puff(tgt, p.tall * endS);
      this.save();
    }
  }

  // On the ground: walking its loop or wandering, with whatever it's doing on top.
  groundFrame(p, dt) {
    const t = this.now; let speed = 0, hop = 0, spin = 0, roll = 0, pitch = 0, sy = 1, hy = 0, hp = 0, hr = 0;
    const camL = p.place.g.worldToLocal(this.col.camera.position.clone()), toCam = Math.atan2(camL.x - p.x, camL.z - p.z);
    if (p.mode === "loop" && !p.act) {
      p.u += dt * 0.18; const r = p.S * 0.28, f = (u) => [Math.cos(u) * r + Math.sin(u * 2.3) * r * 0.25, Math.sin(u) * r * 0.8 + Math.cos(u * 1.7) * r * 0.2];
      const [x, z] = f(p.u), [x2, z2] = f(p.u + 0.01); p.x = x; p.z = z; p.yaw = Math.atan2(x2 - x, z2 - z); speed = 1.1;
    } else if (p.mode === "wander" && !p.act) {
      if (p.wait > 0) { p.wait -= dt; hy = Math.sin(t * 0.7 + p.seed) * 0.35; }
      else {
        const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { p.wait = rnd(1.5, 4.5); this.newTarget(p); }
        else {
          const want = Math.atan2(dx, dz); p.yaw += angTo(p.yaw, want) * Math.min(1, dt * 4);
          const v = (0.3 + 0.12 * p.tall) * dt * Math.max(0, Math.cos(angTo(p.yaw, want)));
          p.x += Math.sin(p.yaw) * Math.min(v, d); p.z += Math.cos(p.yaw) * Math.min(v, d); speed = 1.0;
        }
      }
    } else if (p.mode === "land") {
      // Squash and bounce, shake off the snow, look around (and at you), then off it goes.
      const u = t - p.land;
      sy = 1 - 0.38 * Math.exp(-u * 7) * Math.cos(u * 17);
      if (u < 0.45) hop = Math.max(0, Math.sin(Math.min(1, u / 0.45) * Math.PI)) * p.tall * 0.22 * (u > 0.08 ? 1 : 0);
      if (u > 0.55 && u < 1.35) { const s = (u - 0.55) / 0.8; roll = Math.sin(s * Math.PI * 9) * 0.22 * (1 - s); hr = -roll * 1.5; if (!p.shook) { p.shook = 1; this.emote(p, "snow", 1.8); } }
      if (u > 1.35 && u < 3.2) { const s = (u - 1.35) / 1.85; hy = Math.sin(s * Math.PI * 2) * 0.75; hp = -0.15; if (s > 0.62) { hy = clamp(angTo(p.yaw, toCam), -0.9, 0.9); hr = 0.3; } }
      if (u >= 3.2) { p.mode = "wander"; p.shook = 0; p.wait = rnd(0.3, 1.2); this.newTarget(p); }
    } else if (p.mode === "doze") {
      const u = t - p.dozeAt; sy = 0.86 + Math.sin(t * 1.6) * 0.025; hp = Math.min(0.55, u * 0.4); hr = 0.15;
      if (t > p.zzz) { this.emote(p, "sleepy", 3); p.zzz = t + rnd(5, 8); }
      if (u > 45 + p.seed * 10) { p.mode = p.wasMode || "wander"; p.poke = t; this.act(p, "wiggle", 0.8); }
    }
    // A reaction on top.
    if (p.act) {
      const A = p.act, u = (t - A.t0) / A.dur;
      if (u >= 1) p.act = null;
      else if (A.kind === "hop") { hop = Math.sin(u * Math.PI) * p.tall * 0.55; sy = 1 + Math.sin(u * Math.PI) * 0.12; speed = 2.5; }
      else if (A.kind === "hop2") { const v = (u * 2) % 1; hop = Math.sin(v * Math.PI) * p.tall * 0.45; sy = v < 0.12 || v > 0.88 ? 0.85 : 1.1; speed = 3; hr = Math.sin(u * Math.PI * 2) * 0.3; }
      else if (A.kind === "spin") { spin = ease(u) * Math.PI * 2; hop = Math.sin(u * Math.PI) * p.tall * 0.3; speed = 2; }
      else if (A.kind === "wiggle") { roll = Math.sin(u * Math.PI * 8) * 0.22 * (1 - u); hr = Math.sin(u * Math.PI * 4) * 0.4; speed = 0.5; }
      else if (A.kind === "look" || A.kind === "greet") {
        const to = A.kind === "look" ? toCam : A.yaw;
        p.yaw += angTo(p.yaw, to) * Math.min(1, dt * 5) * (u < 0.85 ? 1 : 0); hr = Math.sin(Math.min(1, u * 2) * Math.PI / 2) * 0.35; hp = -0.12;
      }
    }
    if (p.mode !== "doze" && p.mode !== "land" && !p.act && t - p.poke > this.dozeAfter + p.seed * 8) {
      p.wasMode = p.mode; p.mode = "doze"; p.dozeAt = t; p.zzz = t + 1.2; if (p.action) p.action.time = 0;
    }
    if ((p.mode === "wander" || p.mode === "loop") && !p.act && t > p.next) { p.next = t + rnd(90, 240); this.emote(p, pickOf(["music", "snow", "happy"])); }
    const a = p.a, y = p.place.h(p.x, p.z);
    a.position.set(p.x, y + Math.max(0, hop), p.z); // never below the ground
    a.rotation.set(pitch, p.yaw + spin, roll); a.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    this.mix(p, dt * speed);
    this.headLook(p, hy, hp, hr);
  }
  newTarget(p) {
    const map = p.place.g === this.col.scene, R = clamp(p.tall * 2.2, 1.6, 3.5);
    for (let i = 0; i < 8; i++) {
      const a = rnd(0, Math.PI * 2), r = rnd(0.4, 1) * R; let x = p.hx + Math.sin(a) * r, z = p.hz + Math.cos(a) * r;
      if (map) { const [mx, mz] = this.onMap(x, z); if (Math.hypot(mx - x, mz - z) > 0.01) continue; }
      else { const m = p.S / 2 - 0.8; if (Math.abs(x) > m || Math.abs(z) > m) continue; }
      p.tx = x; p.tz = z; return;
    }
    p.tx = p.hx; p.tz = p.hz;
  }
  // Two animals that bump into each other say hello (rarely).
  meetings(t) {
    const free = this.list.filter((p) => (p.mode === "wander" || p.mode === "loop") && !p.act && t > p.meet && !this.sunk(p));
    for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
      const a = free[i], b = free[j], pa = a.a.getWorldPosition(new THREE.Vector3()), pb = b.a.getWorldPosition(new THREE.Vector3());
      if (pa.distanceTo(pb) > (a.tall + b.tall) * 0.7 + 0.8) continue;
      a.meet = b.meet = t + 40;
      if (Math.random() > 0.6) continue;
      const ya = Math.atan2(pb.x - pa.x, pb.z - pa.z), yb = ya + Math.PI;
      const lyaw = (p, y) => y - (p.place.g === this.col.scene ? 0 : p.place.g.rotation.y);
      this.act(a, "greet", 2.2, { yaw: lyaw(a, ya) }); this.act(b, "greet", 2.2, { yaw: lyaw(b, yb) });
      this.emote(a, pickOf(["heart", "music"])); b.later = { at: t + 0.7, fn: () => this.emote(b, pickOf(["heart", "happy", "question"])) };
    }
  }
  mix(p, d) {
    const U = p.a.userData; p.action ||= U.action;
    // The mixer only writes a bone when its value changes, so put back the head as the clip left it first,
    // or last frame's head turn would pile up while the clip stands still.
    if (p.hq && U.head) U.head.quaternion.copy(p.hq);
    U.mixer?.update(Math.max(0, d));
  }
  // Turn the head bone in the animal's own frame (yaw left/right, pitch down, roll a tilt) on top of the clip.
  headLook(p, yaw, pitch, roll) {
    const H = p.head, k = 0.12; H.yaw += (yaw - H.yaw) * k; H.pitch += (pitch - H.pitch) * k; H.roll += (roll - H.roll) * k;
    const bone = p.a.userData.head; if (!bone?.parent) return;
    (p.hq ||= new THREE.Quaternion()).copy(bone.quaternion);
    if (Math.abs(H.yaw) + Math.abs(H.pitch) + Math.abs(H.roll) < 1e-3) return;
    p.a.updateMatrixWorld(true);
    const qa = p.a.getWorldQuaternion(new THREE.Quaternion()), qp = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    const r = new THREE.Quaternion().setFromEuler(new THREE.Euler(H.pitch, H.yaw, H.roll, "YXZ"));
    const rw = qa.clone().multiply(r).multiply(qa.clone().invert());
    bone.quaternion.premultiply(qp.clone().invert().multiply(rw).multiply(qp));
  }
  puff(at, size) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }), g = new THREE.Group(), bits = [];
    for (let i = 0; i < 11; i++) {
      const m = new THREE.Mesh(this.ball, mat), a = (i / 11) * Math.PI * 2 + rnd(-0.2, 0.2);
      m.userData.v = new THREE.Vector3(Math.sin(a) * rnd(0.8, 1.4), rnd(0.3, 0.9), Math.cos(a) * rnd(0.8, 1.4)).multiplyScalar(size * 1.4);
      m.userData.r = size * rnd(0.12, 0.2); m.scale.setScalar(m.userData.r); g.add(m); bits.push(m);
    }
    g.position.copy(at).y += 0.05; this.col.scene.add(g); this.puffs.push({ g, bits, mat, t: 0 });
  }
  puffFrame(dt) {
    for (const P of this.puffs) {
      P.t += dt; const u = P.t / 0.75;
      for (const m of P.bits) { m.position.addScaledVector(m.userData.v, dt * Math.max(0, 1 - u)); m.position.y = Math.max(0, m.position.y); m.scale.setScalar(m.userData.r * (1 + u * 1.6)); }
      P.mat.opacity = 0.95 * Math.max(0, 1 - u * u);
      if (u >= 1) { this.col.scene.remove(P.g); P.mat.dispose(); }
    }
    this.puffs = this.puffs.filter((P) => P.t < 0.75);
  }
  bubbles() {
    const cam = this.col.camera, w = this.col.canvas.clientWidth, h = this.col.canvas.clientHeight, v = new THREE.Vector3();
    for (const p of this.list) {
      const B = p.bubble; if (!B) continue;
      const u = this.now - B.t0;
      if (u > B.dur + 0.3) { B.el.remove(); p.bubble = null; continue; }
      if (u > B.dur) B.el.classList.add("out");
      p.a.localToWorld(v.set(0, p.tall * 1.08, 0)).project(cam);
      const hide = v.z > 1 || this.sunk(p);
      B.el.style.visibility = hide ? "hidden" : "";
      B.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h - 8}px) translate(-50%, -100%)`;
    }
  }
}
