// The animals on the resort tiles as desk pets (the owner's idea, 2026-11-05). Long-press one (~300 ms, so an
// ordinary drag still turns the map) and it lifts into your finger, dangling and kicking, a small shadow under
// it; let go and it falls onto whatever is below — a tile or the painted map — lands with a squash and a puff
// of snow, shakes itself off, looks around, and then wanders round its new spot. Where you left it is kept
// (localStorage) for next time. A quick tap makes it hop or spin with a little speech bubble; left alone a
// long while it lies down and dozes. The models have no face rig, so all the expression is body language
// (hops, wiggles, a head tilt, a look at you) and the bubbles.
// Where you drop it matters: down low (the map, a valley, far below where it was) it sweats, sighs and trudges
// back uphill to its own mountain, climbing up the tile's side, panting now and then, relieved once home; up
// high (a tile's top) it basks in the sun a while; in between it shakes off and wanders. Stroke it (a finger
// rubbing back and forth over it) or tap it and it answers with an emote and a little body reaction.
// Below its own tile, a little wooden ladder pops up against the cliff and it climbs home rung by rung.
// Drop one next to another and they react by who they are (friends, rivals or neither: the same every time
// for a pair): friends snuggle side by side (贴贴), rivals stand back to back and huff, the rest sniff and go on.
//
// Hooks in collection.js: `this.pets = new Pets(this)` (constructor), `if (this.pets.tap(e)) return;` (tap),
// `this.pets.frame(t)` (frame, in place of walking the animals round their loops).
import * as THREE from "three";

// The emote bubbles. Art comes only from the owner's painted icon library (assets/icons/README.md); these are
// the closest icons there for now. When the painted emotes arrive, swap the one name on each line (and drop
// the text if the icon says it on its own). Wanted, 128×128 transparent PNG like the rest:
// emo_heart (比心: a hand heart), emo_happy (a happy sparkle star), emo_music (music notes), emo_surprise
// ("!"), emo_question ("?"), emo_sleepy ("zzz" with a little moon), emo_snow (a snowflake; `season` may do),
// emo_sweat (a sweat drop, puffing), emo_sun (basking in the sun), emo_relieved (phew, made it home),
// emo_homesick (想回家, looking up at home), emo_missing (想家, missing its own mountain), emo_huff (哼, a huffy puff),
// emo_lost (找不着北), emo_ladder (想要梯子).
// Bubbles are kept few: a reaction to what you just did (drop, tap, stroke) shows at once (emote); anything an
// animal thinks of by itself (think) waits until no other animal on the map has a bubble up, and then each
// animal stays quiet for a minute or two.
const EMOTES = {
  heart: { icon: "st_favorite", text: "比心" }, // → emo_heart
  happy: { icon: "star", text: "" }, // → emo_happy
  music: { icon: "palette", text: "" }, // → emo_music
  surprise: { icon: "challenge", text: "!" }, // → emo_surprise
  question: { icon: "compass_n", text: "?" }, // → emo_question
  sleepy: { icon: "nightski", text: "zzz" }, // → emo_sleepy
  snow: { icon: "season", text: "" }, // → emo_snow
  sweat: { icon: "hike", text: "", drop: true }, // → emo_sweat (the CSS drop goes once the icon has its own)
  sun: { icon: "sunny", text: "" }, // → emo_sun
  relieved: { icon: "rest", text: "呼~" }, // → emo_relieved
  homesick: { icon: "lodge", text: "想回家" }, // → emo_homesick
  missing: { icon: "resorts", text: "想家" }, // → emo_missing (on someone else's mountain, looking toward its own)
  lost: { icon: "compass_rose", text: "找不着北" }, // → emo_lost
  wantLadder: { icon: "lift", text: "想要梯子" }, // → emo_ladder
  huff: { icon: "windy", text: "哼" }, // → emo_huff
};
// Friends, rivals or neither: fixed for each pair of kinds (a hash of the two names), so it feels random but
// a pair always gets on (or doesn't) the same way.
const relation = (a, b) => {
  let h = 2166136261; for (const c of [a, b].sort().join("+")) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const u = (h >>> 0) / 4294967296; return u < 0.45 ? "like" : u < 0.8 ? "dislike" : "neutral";
};
const WOOD = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.9 });
const PETTED = { heart: "look", happy: "hop2", music: "sway", surprise: "hop", question: "tilt" }; // emote → body
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
.pemo b.drop { position: absolute; right: 3px; top: 1px; width: 7px; height: 7px; background: #8cc4ef; border: 1px solid rgba(34,52,77,.55);
  border-radius: 0 50% 50% 50%; transform: rotate(45deg); animation: pemoDrip 1.1s ease-in infinite; }
@keyframes pemoDrip { 0% { translate: 0 0; opacity: 1; } 80% { translate: 0 10px; opacity: .9; } 100% { translate: 0 12px; opacity: 0; } }
.pemo > span { display: flex; align-items: center; gap: 2px; animation: pemoPop .32s cubic-bezier(.3,1.6,.5,1) both; transform-origin: 50% 100%; }
@keyframes pemoPop { from { transform: scale(.2); opacity: 0; } to { transform: scale(1); opacity: 1; } }
#world canvas, #ctags .ctag { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: none; }
`;

export class Pets {
  constructor(col) {
    this.col = col; this.list = []; this.puffs = []; this.props = []; this.last = 0; this.now = 0; this.press = null; this.held = null; this.swallow = 0;
    this.dozeAfter = DOZE_AFTER; this.pace = 1; this.lastPicked = null; this.pointers = new Set(); // pace: tests may hurry them along
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
    gr.addColorStop(0, "rgba(30,40,60,.7)"); gr.addColorStop(0.55, "rgba(30,40,60,.35)"); gr.addColorStop(1, "rgba(30,40,60,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.shadow.visible = false; this.shadow.renderOrder = 2; col.scene.add(this.shadow);
    this.ball = new THREE.SphereGeometry(1, 8, 6);
    // The animal in your hand (and falling from it) is drawn in a pass of its own over the map, so it never
    // looks sunk into a mountain or a cliff (after(), right after the map is drawn).
    this.top = new THREE.Scene();
    this.hang = new THREE.Group(); this.swing = new THREE.Group(); this.hang.add(this.swing); this.top.add(this.hang);
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
    // Each tile's ground: how low and high it goes, and the upper slopes an animal heads back to.
    this.range = new Map();
    for (const [g, h] of this.hOf) {
      const S = g.children[0]?.geometry?.parameters?.width || 12, m = S / 2 - 0.9, pts = [];
      for (let j = 0; j <= 24; j++) for (let i = 0; i <= 24; i++) { const x = -m + (2 * m * i) / 24, z = -m + (2 * m * j) / 24; pts.push([x, z, h(x, z)]); }
      const lo = Math.min(...pts.map((q) => q[2])), hi = Math.max(...pts.map((q) => q[2])), u = (y) => (y - lo) / (hi - lo || 1);
      this.range.set(g, { lo, hi, up: pts.filter((q) => u(q[2]) > 0.5 && u(q[2]) < 0.75) });
    }
    const sun = col.scene.children.find((o) => o.isDirectionalLight && o.castShadow);
    this.sunYaw = sun ? Math.atan2(sun.position.x, sun.position.z) : -2.2;
    for (const w of col.walkers || []) {
      const a = w.a, tile = col.tiles.find((x) => x.group === a.parent), kind = a.userData.kind;
      const S = tile?.group.children[0]?.geometry?.parameters?.width || 12;
      const p = { a, kind, homeG: a.parent, tall: a.userData.tall || 1, seed: w.seed, u: t * 0.18 + w.seed, mode: "loop", S, place: { g: a.parent, h: w.h, id: tile?.userData.id },
        yaw: 0, x: 0, z: 0, poke: t + rnd(0, 40), act: null, bubble: null, next: t + rnd(60, 200), meet: 0, head: { yaw: 0, pitch: 0, roll: 0 } };
      const s = saved[kind];
      if (s && Number.isFinite(s.x) && Number.isFinite(s.z)) {
        const on = s.on === "map" ? null : col.tiles.find((x) => x.userData.id === s.on);
        if (s.on === "map" || on) {
          this.settle(p, on ? on.group : col.scene, s.x, s.z, s.yaw || 0); p.mode = "wander"; p.wait = rnd(0, 2);
          if (s.mood === "low") { p.mood = "low"; this.startTrip(p, false); } // still on its way home
          else this.homesick(p, t);
        }
      }
      a.rotation.order = "YXZ"; // turn, then pitch and roll in its own frame
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
  onMap(x, z, except = null) {
    const B = this.bounds; x = clamp(x, B.x0, B.x1); z = clamp(z, B.z0, B.z1);
    for (const t of this.col.tiles) {
      if (t.group === except) continue;
      const half = (t.group.children[0]?.geometry?.parameters?.width || 12) * 0.5 * Math.max(1, t.group.scale.x) + 1.4, dx = x - t.base.x, dz = z - t.base.z;
      if (Math.abs(dx) < half && Math.abs(dz) < half) {
        if (half - Math.abs(dx) < half - Math.abs(dz)) x = t.base.x + Math.sign(dx || 1) * half; else z = t.base.z + Math.sign(dz || 1) * half;
      }
    }
    return [clamp(x, B.x0, B.x1), clamp(z, B.z0, B.z1)];
  }
  save() {
    const o = {};
    for (const p of this.list) if (p.hx !== undefined && p.place) o[p.kind] = { on: p.place.id || "map", x: +p.hx.toFixed(2), z: +p.hz.toFixed(2), yaw: +p.yaw.toFixed(2), ...(p.mood === "low" ? { mood: "low" } : {}) };
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
      if (p === this.held || p.mode === "fall" || p.mode === "scramble" || !p.a.children.length || this.sunk(p)) continue;
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
    // A finger rubbing back and forth over an animal is petting it (watched from here, see move()).
    const sp = this.at(e, 30), c = this.col;
    this.stroke = sp ? { p: sp, id: e.pointerId, lx: e.clientX, ly: e.clientY, sx: 0, sy: 0, fx: 0, fy: 0, path: 0, on: false, mark: 0, cam: c.camera.position.clone(), tg: c.controls.target.clone() } : null;
    const p = this.at(e, 22); if (!p) return;
    this.press = { p, id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType !== "mouse", timer: setTimeout(() => this.lift(), PRESS_MS) };
  }
  cancelPress() { if (this.press) clearTimeout(this.press.timer); this.press = null; }
  move(e) {
    if (this.press && e.pointerId === this.press.id && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > SLOP) this.cancelPress();
    if (this.held && e.pointerId === this.grip.id) { this.grip.x = e.clientX; this.grip.y = e.clientY; }
    if (this.stroke && e.pointerId === this.stroke.id && !this.held) this.rub(e);
  }
  rub(e) {
    const S = this.stroke, dx = e.clientX - S.lx, dy = e.clientY - S.ly;
    if (Math.hypot(dx, dy) < 3) return;
    S.lx = e.clientX; S.ly = e.clientY; S.path += Math.hypot(dx, dy);
    const sx = Math.abs(dx) >= 3 ? Math.sign(dx) : 0, sy = Math.abs(dy) >= 3 ? Math.sign(dy) : 0;
    if (sx && S.sx && sx !== S.sx) S.fx++; if (sx) S.sx = sx;
    if (sy && S.sy && sy !== S.sy) S.fy++; if (sy) S.sy = sy;
    const r = this.col.canvas.getBoundingClientRect(), q = this.screen(S.p), near = Math.hypot(e.clientX - r.left - q.x, e.clientY - r.top - q.y) < Math.max(40, q.r * 1.8);
    if (!near && !S.on) { this.stroke = null; return; } // off the animal: an ordinary drag of the map
    const flips = Math.max(S.fx, S.fy);
    if (!S.on && flips >= 2 && S.path > 24) {
      // Petting, not turning the map: hold the map still and put back the little turn the rubbing made.
      const c = this.col; S.on = true; c.controls.enabled = false; c.controls._sphericalDelta?.set(0, 0, 0); c.controls._panOffset?.set(0, 0, 0);
      c.camera.position.copy(S.cam); c.controls.target.copy(S.tg); c.camera.lookAt(S.tg);
      S.mark = flips; this.poke(S.p);
    } else if (S.on && flips - S.mark >= 4 && !S.p.act) { S.mark = flips; this.poke(S.p); }
  }
  up(e) {
    this.pointers.delete(e.pointerId);
    if (this.stroke && e.pointerId === this.stroke.id) { if (this.stroke.on) { this.col.controls.enabled = true; this.swallow = performance.now() + 150; } this.stroke = null; }
    if (this.press && e.pointerId === this.press.id) this.cancelPress();
    if (this.held && e.pointerId === this.grip.id) this.drop();
  }
  // A quick tap (from collection.tap): true when it was about a pet, so the tile under it isn't picked.
  tap(e) {
    if (this.held || this.stroke?.on || performance.now() < this.swallow) return true;
    const p = this.at(e, 13); if (!p) return false;
    this.poke(p); return true;
  }

  lift() {
    const pr = this.press; this.press = null; if (!pr) return;
    const p = pr.p, col = this.col;
    col.controls.enabled = false; // the finger is the pet's now, not the map's
    this.held = p; this.grip = { id: pr.id, x: pr.x, y: pr.y, touch: pr.touch };
    const wp = p.a.getWorldPosition(new THREE.Vector3()), ws = p.a.getWorldScale(new THREE.Vector3()).x;
    p.wasMode = p.mode; p.mode = "held"; p.act = null; p.poke = this.now; p.hs = ws; p.held0 = this.now; p.trip = null; p.liftY = wp.y; this.stroke = null;
    if (p.lad) this.foldLadder(p);
    if (p.soc) this.endSocial(p.soc, p);
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
    if (hit) return { ray: ray.ray, p: hit.point, tile: true };
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
  // Tiles are magnetic: over one, or within a quarter tile (or ~40 px) of its edge, it lands on that tile, at
  // the nearest spot on its top; clearly away from every tile, on the map.
  magnet(P) {
    const col = this.col, cam = col.camera, perPx = (2 * cam.position.distanceTo(P) * Math.tan((cam.fov * Math.PI) / 360)) / col.canvas.clientHeight;
    let best = null, bd = 1e9;
    for (const t of col.tiles) {
      const g = t.group, h = this.hOf.get(g); if (!h || g.position.y < -1 || (col.picked && col.picked !== t)) continue;
      const S = g.children[0]?.geometry?.parameters?.width || 12, sc = g.scale.x, l = g.worldToLocal(new THREE.Vector3(P.x, g.position.y, P.z));
      const out = Math.hypot(Math.max(0, Math.abs(l.x) - S / 2), Math.max(0, Math.abs(l.z) - S / 2)) * sc, margin = Math.max(0.25 * S * sc, 40 * perPx);
      if (out > margin || out >= bd) continue;
      const m = S / 2 - 0.7, x = clamp(l.x, -m, m), z = clamp(l.z, -m, m);
      bd = out; best = { g, x, z, wy: g.localToWorld(new THREE.Vector3(x, h(x, z), z)).y, tile: t };
    }
    if (best) return best;
    const [x, z] = this.onMap(P.x, P.z);
    return { g: col.scene, x, z, wy: this.floorY };
  }
  // The tile it would land on glows and lifts a little (the map's own hover lift), and its shadow jumps there.
  target(aim) {
    const was = this.aim?.tile, now = aim?.tile; this.aim = aim;
    if (was === now) return;
    this.shadowSnap = true;
    if (was) { was.group.children[0].material.emissive?.setHex(0x000000); if (this.col.hover === was) this.col.hover = null; }
    if (this.halo) this.halo.visible = false;
    if (!now) return;
    now.group.children[0].material.emissive?.setHex(0x3a2e10);
    if (now !== this.col.picked) this.col.hover = now;
    if (!this.halo) { // a soft warm glow on the map round the tile's foot
      const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
      for (let i = 0; i < 24; i++) { const k = i / 24; x.fillStyle = `rgba(255,196,80,${0.1 * (1 - k)})`; const r = 30 + k * 30; x.fillRect(64 - r, 64 - r, 2 * r, 2 * r); }
      this.halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
      this.halo.renderOrder = 1; this.col.scene.add(this.halo);
    }
    const S = now.group.children[0]?.geometry?.parameters?.width || 12;
    this.halo.visible = true; this.halo.position.set(now.group.position.x, this.floorY + 0.03, now.group.position.z); this.halo.scale.setScalar(S * 2.1 * Math.max(1, now.group.scale.x));
  }
  drop() {
    const p = this.held; this.held = null; this.col.controls.enabled = true; this.swallow = performance.now() + 120;
    const wp = p.a.getWorldPosition(new THREE.Vector3()), ws = p.a.getWorldScale(new THREE.Vector3()).x;
    const below = this.aim || this.surfaceAt(this.hang.position.x, this.hang.position.z); this.target(null);
    this.top.add(p.a); // falls in the pass drawn over the map p.a.position.copy(wp); p.a.scale.setScalar(ws);
    const yaw = p.a.rotation.y + this.hang.rotation.y, pitch = p.a.rotation.x;
    p.a.rotation.set(pitch, yaw, 0);
    p.mode = "fall"; p.fall = { from: wp.clone(), s0: ws, t0: this.now, vy: 0, to: below, yaw, pitch, tilt: this.swing.rotation.z };
  }

  // ---- reactions ----
  poke(p) {
    p.poke = this.now;
    if (p.mode === "doze") { p.mode = p.wasMode || "wander"; this.emote(p, "surprise"); this.act(p, "hop", 0.55); return; }
    const g = p.place?.g;
    if (g === this.col.scene) { this.emote(p, this.floorThought(p)); this.act(p, "look", 1.2); return; } // down on the map: only its three thoughts
    if (g && g !== p.homeG && (p.mode === "wander" || p.mode === "social" || p.mode === "bask")) { // on someone else's mountain
      if (p.soc) this.endSocial(p.soc);
      if (Math.random() < 0.5) { this.emote(p, "sun", 2.6); p.mode = "bask"; p.baskEnd = this.now + rnd(8, 12); p.sunAt = 1e9; }
      else { this.emote(p, "missing", 2.6); this.act(p, "pine", 1.6, { yaw: this.yawHome(p) }); p.later = { at: this.now + 1.6, fn: () => { p.mood = "low"; this.startTrip(p, false); } }; }
      return;
    }
    // A random emote, never the same twice running, with the body to match.
    const e = pickOf(Object.keys(PETTED).filter((k) => k !== p.lastPet)), r = PETTED[e]; p.lastPet = e;
    this.act(p, r, { hop: 0.6, hop2: 1.1, sway: 1.4, look: 1.6, tilt: 1.3 }[r]);
    this.emote(p, e);
  }
  // Down low, up high, or in between: from the ground it landed on (B, at world height y).
  moodOf(p, B, y) {
    if (B.g === this.col.scene) return p.homeG ? "low" : "mid"; // the map lies below every mountain
    const R = this.range.get(B.g); if (!R) return "mid";
    const u = (this.hOf.get(B.g)(B.x, B.z) - R.lo) / (R.hi - R.lo || 1), fell = (p.liftY - y) / B.g.getWorldScale(new THREE.Vector3()).x;
    if (u >= 0.72) return "high";
    if (u <= 0.25 || fell > 0.5 * (R.hi - R.lo)) return "low";
    return "mid";
  }
  // Back home the hard way: a sigh, then down off a strange tile, across the map, up its own tile's side and
  // uphill to the upper slopes, slowly, stopping to pant.
  startTrip(p, sigh) {
    p.mode = "trip"; p.mood = "low"; p.trip = { stage: null, t0: this.now, pause: 0, nextPause: this.now + rnd(3, 5), drip: this.now + 1 };
    if (sigh && p.place.g === this.col.scene) { p.trip.stage = "think"; p.trip.dur = rnd(2, 4); this.emote(p, this.floorThought(p), p.trip.dur); } // one short thought, then off to the ladder
    else if (sigh) { p.trip.stage = "sigh"; this.emote(p, "sweat", 2.6); }
    else this.nextStage(p);
  }
  nextStage(p) {
    const T = p.trip, g = p.place.g, col = this.col; T.t0 = this.now;
    if (g === p.homeG) { // uphill to the nearest upper slope
      const up = this.range.get(g)?.up || [];
      let best = [0, 0], bd = 1e9; for (const [x, z] of up) { const d = Math.hypot(x - p.x, z - p.z); if (d < bd) { bd = d; best = [x, z]; } }
      Object.assign(T, { stage: "uphill", tx: best[0], tz: best[1] });
    } else if (g === col.scene) { // near its own tile the ladder's there at once; farther, it walks over first
      T.stage = "map";
      const hb = col.tiles.find((x) => x.group === p.homeG)?.base, half = p.S / 2 * p.homeG.scale.x;
      if (hb && !col.picked && Math.hypot(Math.max(0, Math.abs(p.x - hb.x) - half), Math.max(0, Math.abs(p.z - hb.z) - half)) < 20) this.ladder(p);
    }
    else { // to this tile's edge on the side toward home
      const hc = g.worldToLocal(p.homeG.getWorldPosition(new THREE.Vector3())), m = p.S / 2 - 0.5, k = m / Math.max(Math.abs(hc.x), Math.abs(hc.z), 0.01);
      Object.assign(T, { stage: "edge", tx: hc.x * k, tz: hc.z * k });
    }
  }
  // Walk toward (tx, tz) in the place's own frame at speed v; true once there.
  walkTo(p, tx, tz, v, dt) {
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz); if (d < 0.1) return true;
    const want = Math.atan2(dx, dz); p.yaw += angTo(p.yaw, want) * Math.min(1, dt * 3);
    const step = Math.min(d, v * dt * Math.max(0, Math.cos(angTo(p.yaw, want))));
    let x = p.x + Math.sin(p.yaw) * step, z = p.z + Math.cos(p.yaw) * step;
    if (p.place.g === this.col.scene) [x, z] = this.onMap(x, z, p.homeG); // round other tiles, not into them
    else { const m = p.S / 2 - 0.5; x = clamp(x, -m, m); z = clamp(z, -m, m); }
    p.x = x; p.z = z; return false;
  }
  tripStep(p, dt, t) {
    const T = p.trip, col = this.col, o = { speed: 0 };
    if (T.stage === "sigh") { // a big sigh: slump, head down
      const u = (t - T.t0) / 1.8; o.sy = 1 - 0.1 * Math.sin(Math.min(1, u) * Math.PI); o.hp = 0.45 * Math.sin(Math.min(1, u) * Math.PI); o.hr = 0.15;
      if (u >= 1) this.nextStage(p);
      return o;
    }
    if (T.stage === "think") { // a moment's thought (looking about, up at home), then straight to the ladder
      const u = t - T.t0; o.hy = Math.sin(u * 2.2) * 0.5; o.hp = -0.25; o.hr = 0.15;
      if (u > T.dur / Math.sqrt(this.pace)) this.nextStage(p);
      return o;
    }
    const uphill = T.stage === "uphill"; // only the slope on its own tile is a slog; down on the map it just goes
    if (uphill) {
      if (t > T.drip) { T.drip = t + rnd(2, 3.5); this.sweat(p); }
      if (T.pause > t) { o.sy = 1 + Math.sin(t * 16) * 0.035; o.hp = 0.4; o.hr = Math.sin(t * 3) * 0.1; return o; } // panting
      if (t > T.nextPause) { T.pause = t + 1.5; T.at = null; T.nextPause = t + 1.5 + rnd(3.5, 6); this.sweat(p); return o; }
    }
    const v = (0.3 + 0.12 * p.tall) * (uphill ? 0.5 : 1.6) * this.pace; o.speed = (uphill ? 0.65 : 1.5) * this.pace; o.hp = uphill ? 0.18 : 0.05;
    if (T.stage === "uphill" && this.walkTo(p, T.tx, T.tz, v, dt)) { // home: phew
      p.mode = "wander"; p.mood = null; p.trip = null; p.hx = p.x; p.hz = p.z; p.wait = rnd(1, 2); p.poke = t;
 this.think(p, "relieved", 2.4, false); this.act(p, "hop2", 1.1); this.save();
    } else if (T.stage === "edge" && this.walkTo(p, T.tx, T.tz, v, dt)) { // hop down onto the map
      const g = p.place.g, wc = g.getWorldPosition(new THREE.Vector3()), hc = p.homeG.getWorldPosition(new THREE.Vector3()).sub(wc).setY(0);
      const half = p.S / 2 * g.scale.x, k = (half + 1.7) / Math.max(Math.abs(hc.x), Math.abs(hc.z), 0.01), to = wc.clone().addScaledVector(hc, k);
      [to.x, to.z] = this.onMap(to.x, to.z, p.homeG); to.y = this.floorY;
      this.scramble(p, "jump", to, null, 0.75);
    } else if (T.stage === "map") {
      if (col.picked) { T.at = null; o.speed = 0; o.hp = 0.2; o.hy = Math.sin(t * 0.6) * 0.3; return o; } // its mountain is away (a resort is open): it sits quietly till it's back
      const hb = col.tiles.find((x) => x.group === p.homeG).base, half = p.S / 2 * p.homeG.scale.x;
      const cx = clamp(p.x, hb.x - half, hb.x + half), cz = clamp(p.z, hb.z - half, hb.z + half), d = Math.hypot(p.x - cx, p.z - cz) || 1;
      const sx = cx + ((p.x - cx) / d) * 1.6, sz = cz + ((p.z - cz) / d) * 1.6;
      // Stuck (wedged between tiles, or a tile in the way): note how long it hasn't got anywhere.
      if (!T.at || Math.hypot(p.x - T.at[0], p.z - T.at[1]) > 0.3) T.at = [p.x, p.z, t];
      if (t - T.at[2] > 4) { T.at = null; this.scramble(p, "jump", new THREE.Vector3(sx, this.floorY, sz), null, 1.1, 4); return o; } // a big leap over
      if (d < 1.75 || this.walkTo(p, sx, sz, v, dt)) { // at the foot of its own tile: a ladder, or (no room) up the wall
        if (!this.ladder(p)) {
          const l = p.homeG.worldToLocal(new THREE.Vector3(cx, 0, cz)), m = p.S / 2 - 0.6; l.x = clamp(l.x, -m, m); l.z = clamp(l.z, -m, m);
          this.scramble(p, "climb", null, l, 1.8);
        }
      }
    } else if (T.stage === "toLadder") { // to the ladder's foot, then turn to the cliff
      if (col.picked) { this.foldLadder(p); T.stage = "map"; return o; }
      const L = p.lad;
      if (this.walkTo(p, L.footW.x, L.footW.z, v, dt)) { T.stage = "look"; T.t0 = t; }
    } else if (T.stage === "look") { // looks up at home: 想回家
      if (col.picked) { this.foldLadder(p); T.stage = "map"; return o; }
      p.yaw += angTo(p.yaw, p.lad.faceW) * Math.min(1, dt * 4); o.speed = 0; o.hp = -0.55; o.hr = 0.15;
      if (t - T.t0 > 0.8 / Math.sqrt(this.pace)) { this.climbLadder(p); return o; }
    }
    return o;
  }
  // ---- down on the map, and lost on someone else's mountain ----
  // Down on the map it has only three thoughts: lost far from home, else wanting a ladder or missing home.
  floorThought(p) {
    const hb = this.col.tiles.find((x) => x.group === p.homeG)?.base, far = hb && Math.hypot(p.x - hb.x, p.z - hb.z) > 26;
    return far ? "lost" : pickOf(["wantLadder", "missing"]);
  }
  yawHome(p) { const hc = p.place.g.worldToLocal(p.homeG.getWorldPosition(new THREE.Vector3())); return Math.atan2(hc.x - p.x, hc.z - p.z); }
  // On someone else's mountain it isn't happy; a long while later, if nothing else happens, it heads home quietly.
  homesick(p, t = this.now) {
    const g = p.place?.g; p.missAt = 0;
    if (g && g !== this.col.scene && g !== p.homeG) p.missAt = t + rnd(90, 150);
  }
  missFrame(p, t) {
    if (p.missAt && t > p.missAt && !p.act) { p.missAt = 0; this.think(p, "missing", 2.4); this.act(p, "pine", 1.8, { yaw: this.yawHome(p) }); p.later = { at: t + 1.8, fn: () => { if (p.mode === "wander") { p.mood = "low"; this.startTrip(p, false); } } }; }
  }

  // ---- the ladder home ----
  // A little wooden ladder against home's cliff on the side the animal's on; false if there's no room for one.
  ladder(p) {
    const g = p.homeG, h = this.hOf.get(g), half = p.S / 2, col = this.col, T = p.trip;
    const lp = g.worldToLocal(new THREE.Vector3(p.x, g.position.y, p.z)), m = half - 1;
    const n = Math.abs(lp.x) > Math.abs(lp.z) ? new THREE.Vector3(Math.sign(lp.x), 0, 0) : new THREE.Vector3(0, 0, Math.sign(lp.z));
    const edge = n.x ? new THREE.Vector3(n.x * half, 0, clamp(lp.z, -m, m)) : new THREE.Vector3(clamp(lp.x, -m, m), 0, n.z * half);
    const out = 0.8, foot = edge.clone().addScaledVector(n, out), yMap = (this.floorY - g.position.y) / g.scale.y;
    const footW = g.localToWorld(foot.clone().setY(yMap)), [fx, fz] = this.onMap(footW.x, footW.z, g);
    if (Math.hypot(fx - footW.x, fz - footW.z) > 0.05) return false; // another tile's in the way
    const top = h(edge.x - n.x * 0.15, edge.z - n.z * 0.15), H = top - yMap + 0.3, d = out - 0.06, w = clamp(p.tall * 0.55, 0.45, 1.1);
    const lad = new THREE.Group(), inner = new THREE.Group(); lad.add(inner);
    const bar = (a, b, r) => { const v = b.clone().sub(a), m2 = new THREE.Mesh(new THREE.CylinderGeometry(r, r, v.length(), 6), WOOD); m2.position.copy(a).add(b).multiplyScalar(0.5); m2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); m2.castShadow = true; return m2; };
    for (const sd of [-1, 1]) inner.add(bar(new THREE.Vector3(sd * w / 2, 0, 0), new THREE.Vector3(sd * w / 2, H, -d), 0.045));
    const len = Math.hypot(H, d), R = Math.max(3, Math.round(len / 0.34));
    for (let k = 1; k < R; k++) { const f = k / R; inner.add(bar(new THREE.Vector3(-w / 2, H * f, -d * f), new THREE.Vector3(w / 2, H * f, -d * f), 0.03)); }
    lad.position.copy(foot).setY(yMap); lad.rotation.y = Math.atan2(n.x, n.z); lad.scale.set(1, 0.01, 1); g.add(lad);
    p.lad = { g, n, edge, foot, yMap, top, H, d, R, len, lad, born: this.now, footW: new THREE.Vector3(fx, this.floorY, fz), faceW: Math.atan2(-n.x, -n.z) + g.rotation.y };
    this.props.push({ lad, t0: this.now, kind: "pop" });
    T.stage = "toLadder"; T.t0 = this.now; T.at = null;
    return true;
  }
  climbLadder(p) {
    const L = p.lad; L.g.add(p.a); p.a.scale.setScalar(1);
    p.mode = "ladder"; L.k = 0; L.t0 = this.now; L.rest = 0;
  }
  // Rung by rung, legs paddling, a breather every few rungs; then a hop onto the top.
  ladderFrame(p, dt) {
    const L = p.lad, t = this.now, n = L.n, yawL = Math.atan2(-n.x, -n.z), lean = Math.atan2(L.d, L.H);
    const step = 0.42 / this.pace, rest = L.k % 4 === 3 ? 1.1 / this.pace : 0.15 / this.pace;
    let f, speed = 0, hp = -0.3, hr = 0, sy = 1;
    if (L.k < L.R) {
      const u = (t - L.t0) / step;
      if (u < 1) { f = (L.k + ease(u)) / L.R; speed = 2.4 * this.pace; }
      else { f = (L.k + 1) / L.R; if (L.k % 4 === 3) { sy = 1 + Math.sin(t * 16) * 0.03; hp = 0.2; if (!L.wiped) { L.wiped = 1; this.sweat(p); } } }
      if (u >= 1 + rest / step) { L.k++; L.t0 = t; L.wiped = 0; }
      const at = L.foot.clone().setY(L.yMap).add(new THREE.Vector3(-n.x * L.d * f, L.H * f - 0.15 * f, -n.z * L.d * f)).addScaledVector(n, p.tall * 0.22);
      p.a.position.copy(at); p.a.rotation.set(-(Math.PI / 2 - lean) * 0.85, yawL, Math.sin(t * 9) * 0.05 * (speed ? 1 : 0)); p.a.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
      if (L.k >= L.R) { L.hop = t; L.from = p.a.position.clone(); }
    } else { // over the lip
      const u = Math.min(1, (t - L.hop) / 0.55), land = L.edge.clone().addScaledVector(n, -1.0), h = this.hOf.get(L.g), y = h(land.x, land.z);
      p.a.position.set(L.from.x + (land.x - L.from.x) * ease(u), L.from.y + (y - L.from.y) * ease(u) + Math.sin(u * Math.PI) * p.tall * 0.5, L.from.z + (land.z - L.from.z) * ease(u));
      p.a.rotation.set(-(Math.PI / 2 - lean) * 0.85 * (1 - ease(u)), yawL, 0); p.a.scale.setScalar(1); speed = 2;
      if (u >= 1) {
        this.settle(p, L.g, land.x, land.z, yawL); this.foldLadder(p);
        p.mode = "wander"; p.mood = null; p.trip = null; p.wait = rnd(1.2, 2); p.poke = t; p.hx = p.x - n.x * 0.8; p.hz = p.z - n.z * 0.8;
        this.think(p, "relieved", 2.4, false); this.act(p, "hop2", 1.1); this.puff(p.a.getWorldPosition(new THREE.Vector3()), p.tall * 0.4); this.save();
        return;
      }
    }
    this.mix(p, dt * speed);
    this.headLook(p, 0, hp, hr);
  }
  foldLadder(p) { const L = p.lad; p.lad = null; if (L) this.props.push({ lad: L.lad, t0: this.now, kind: "fold", g: L.g }); }
  propFrame() {
    for (const P of this.props) {
      const u = (this.now - P.t0) / (P.kind === "pop" ? 0.55 : 0.7);
      if (P.kind === "pop") P.lad.scale.y = u >= 1 ? 1 : 1 + Math.sin(u * Math.PI * 1.5) * 0.18 * (1 - u) - (1 - ease(Math.min(1, u * 1.6))) * 1; // springs up with a bounce
      else { P.lad.scale.y = Math.max(0.01, 1 - ease(Math.min(1, u))); P.lad.rotation.z = 0; if (u >= 1) { P.g.remove(P.lad); P.lad.traverse((o) => o.geometry?.dispose()); } }
      P.done = u >= 1;
    }
    this.props = this.props.filter((P) => !P.done);
  }

  // ---- friends and rivals ----
  // Who's right beside p (same ground, within ~1.5 units) and free to react.
  neighbour(p) {
    let best = null, bd = 1e9;
    for (const o of this.list) {
      if (o === p || o.place?.g !== p.place.g || !["wander", "loop", "bask", "doze"].includes(o.mode) || o.soc) continue;
      const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < 1.5 + (o.tall + p.tall) * 0.35 && d < bd) { bd = d; best = o; }
    }
    return best;
  }
  startSocial(a, b, byYou = false) {
    const t = this.now, rel = relation(a.kind, b.kind);
    for (const q of [a, b]) { if (q.hx === undefined || q.mode === "loop") { q.hx = q.x; q.hz = q.z; } q.wasMood = q.mood; q.mode = "social"; q.act = null; q.trip = null; q.poke = t; }
    const S = { rel, a, b, t0: t, end: t + (rel === "like" ? rnd(20, 40) : rel === "dislike" ? rnd(8, 14) : 2.6), nextHeart: t + rnd(4, 7) };
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1; S.ux = dx / d; S.uz = dz / d; S.mx = (a.x + b.x) / 2; S.mz = (a.z + b.z) / 2;
    // Friends sit side by side facing you; work out which way that is.
    const cam = a.place.g.worldToLocal(this.col.camera.position.clone()); let fx = -S.uz, fz = S.ux; if (fx * (cam.x - S.mx) + fz * (cam.z - S.mz) < 0) { fx = -fx; fz = -fz; } S.face = Math.atan2(fx, fz);
    a.soc = b.soc = S;
    // The one you dropped answers at once; the other's bubble waits its turn.
    const say = (q, e) => (byYou ? this.emote(q, e) : this.think(q, e, 2.4, false));
    if (rel === "like") { say(a, "heart"); b.later = { at: t + 2.7, fn: () => this.think(b, "heart", 2.4, false) }; }
    else if (rel === "dislike") { say(a, "huff"); b.later = { at: t + 2.7, fn: () => this.think(b, "huff", 2.4, false) }; }
    else if (a.place.g === a.homeG || a.place.g === this.col.scene) say(pickOf([a, b]), "question");
  }
  endSocial(S, picked = null) {
    const t = this.now;
    for (const q of [S.a, S.b]) {
      q.soc = null; q.meet = t + 60;
      if (q === picked) continue;
      q.mode = "wander"; q.wait = rnd(0.5, 2); q.mood = q.wasMood; this.homesick(q, t - 6); // after a friend, home calls again soon
      if (q.mood === "low") this.startTrip(q, false); else if (q.mood === "high") { q.mode = "bask"; q.baskEnd = t + rnd(12, 20); q.sunAt = t + 1; }
    }
  }
  socialStep(p, dt, t) {
    const S = p.soc, o = S.a === p ? S.b : S.a, u = t - S.t0, me = S.a === p ? -1 : 1, out = { speed: 0 };
    const toO = Math.atan2(o.x - p.x, o.z - p.z), gap = (p.tall + o.tall) * 0.38 + 0.2;
    const go = (x, z, v) => { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d < 0.03) return true; const k = Math.min(d, v * dt); p.x += (dx / d) * k; p.z += (dz / d) * k; out.speed = 0.9; return false; };
    if (S.rel === "like") {
      if (u < 1.6) { p.yaw += angTo(p.yaw, toO) * Math.min(1, dt * 5); out.hr = 0.3; } // face each other, hearts
      else { // side by side, leaning together, swaying
        const there = go(S.mx + S.ux * me * gap / 2, S.mz + S.uz * me * gap / 2, 0.6);
        if (there) {
          p.yaw += angTo(p.yaw, S.face) * Math.min(1, dt * 3);
          const lx = Math.cos(p.yaw), lz = -Math.sin(p.yaw), side = Math.sign((o.x - p.x) * lx + (o.z - p.z) * lz) || 1; // the other's on my left (+) or right (-)
          out.roll = -side * 0.12 + Math.sin(t * 1.2) * 0.03; out.hr = out.roll * 2.2; out.hy = -side * 0.25; out.sy = 0.97 + Math.sin(t * 1.2 + me) * 0.01;
        }
        if (p === S.a && t > S.nextHeart) { S.nextHeart = t + rnd(15, 25); this.think(pickOf([S.a, S.b]), "heart", 2.4, false); }
      }
    } else if (S.rel === "dislike") {
      if (u < 1.0) { p.yaw += angTo(p.yaw, toO) * Math.min(1, dt * 6); out.sy = 1.04; } // a glare
      else { // back to back, stiff, a step apart, huffing
        const d = Math.hypot(o.x - p.x, o.z - p.z), want = (p.tall + o.tall) * 0.45 + 0.2;
        if (d < want) go(p.x - Math.sin(toO) * 0.2, p.z - Math.cos(toO) * 0.2, 0.5);
        p.yaw += angTo(p.yaw, toO + Math.PI) * Math.min(1, dt * 4); out.sy = 1.05; out.hp = -0.25;
        if (!p.huffAt || t > p.huffAt + 0.3) { if (!p.huffAt || t > p.huffAt) { p.huffAt = t + rnd(2.5, 4); if (u > 2 && Math.random() < 0.4) this.think(p, "huff", 1.6); } }
        if (p.huffAt && p.huffAt - t > 0 && p.huffAt - t < 0.25) out.hop = Math.sin(((0.25 - (p.huffAt - t)) / 0.25) * Math.PI) * p.tall * 0.08;
      }
      if (t > S.end && p === S.a) { // one of them walks off
        const leaver = Math.random() < 0.5 ? S.a : S.b, other = leaver === S.a ? S.b : S.a; this.endSocial(S);
        const ang = Math.atan2(leaver.x - other.x, leaver.z - other.z), R = clamp(leaver.tall * 3, 2.5, 4);
        leaver.hx = leaver.x + Math.sin(ang) * R; leaver.hz = leaver.z + Math.cos(ang) * R;
        if (leaver.place.g === this.col.scene) [leaver.hx, leaver.hz] = this.onMap(leaver.hx, leaver.hz); else { const m = leaver.S / 2 - 1; leaver.hx = clamp(leaver.hx, -m, m); leaver.hz = clamp(leaver.hz, -m, m); }
        if (leaver.mode === "wander") { leaver.wait = 0; leaver.tx = leaver.hx; leaver.tz = leaver.hz; }
        other.wait = 2.5; this.save();
      }
      return out;
    } else { // neutral: a sniff, a "?", carry on
      p.yaw += angTo(p.yaw, toO) * Math.min(1, dt * 5); out.hp = 0.35; out.hy = Math.sin(t * 9) * 0.12;
    }
    if (t > S.end && p === S.a) { this.endSocial(S); this.save(); }
    return out;
  }

  // A climb up a tile's side or a jump down off it, through the scene: to a world point, or a spot on home.
  scramble(p, kind, to, local, T, arc = 0.8) {
    const from = p.a.getWorldPosition(new THREE.Vector3()), s0 = p.a.getWorldScale(new THREE.Vector3()).x;
    this.col.scene.add(p.a); p.a.position.copy(from); p.a.scale.setScalar(s0);
    p.mode = "scramble"; p.scr = { kind, from, to, local, T, t0: this.now, s0, arc };
  }
  scrambleFrame(p, dt) {
    const S = p.scr, u = Math.min(1, (this.now - S.t0) / S.T), g = p.homeG;
    const to = S.local ? g.localToWorld(new THREE.Vector3(S.local.x, this.hOf.get(g)(S.local.x, S.local.z), S.local.z)) : S.to;
    const s1 = S.local ? g.getWorldScale(new THREE.Vector3()).x : 1, a = p.a;
    let xz, y, pitch;
    if (S.kind === "climb") { // up the wall first, nose up, then over the lip
      xz = u < 0.7 ? 0.25 * ease(u / 0.7) : 0.25 + 0.75 * ease((u - 0.7) / 0.3); y = ease(Math.min(1, u / 0.72)); pitch = -1.1 * Math.sin(Math.min(1, u / 0.8) * Math.PI);
    } else { xz = ease(u); y = u * u; pitch = 0.45 * Math.sin(u * Math.PI); }
    a.position.set(S.from.x + (to.x - S.from.x) * xz, S.from.y + (to.y - S.from.y) * y + (S.kind === "jump" ? Math.sin(u * Math.PI) * p.tall * S.arc : 0), S.from.z + (to.z - S.from.z) * xz);
    if (S.kind === "climb") a.position.y = Math.max(a.position.y, S.from.y);
    const yaw = Math.atan2(to.x - S.from.x, to.z - S.from.z); a.rotation.set(pitch, yaw, 0); a.scale.setScalar(S.s0 + (s1 - S.s0) * u);
    this.mix(p, dt * 2.2);
    if (u >= 1) {
      if (S.local) this.settle(p, g, S.local.x, S.local.z, yaw - g.rotation.y);
      else { this.settle(p, this.col.scene, to.x, to.z, yaw); this.puff(to, p.tall * 0.6); }
      p.mode = "trip"; this.nextStage(p); p.trip.nextPause = this.now + 0.6; this.save();
    }
  }
  sweat(p) {
    const at = p.a.localToWorld(new THREE.Vector3(0, p.tall * 0.92, p.tall * 0.25)), s = p.a.getWorldScale(new THREE.Vector3()).x;
    this.puff(at, p.tall * s * 0.35, { color: 0x8cc4ef, n: 3, grav: 1, life: 0.7, r: [0.07, 0.1] });
  }
  // A thought of its own: only when nobody else is showing one, and not again for 60–120 s (own = false: an
  // event in a story you started, which skips the per-animal quiet but still waits its turn on the map).
  think(p, name, dur = 2.4, own = true) {
    if (p.bubble || this.list.some((q) => q.bubble && q !== p) || this.now < (this.calm || 0)) return false; // and a quiet spell map-wide after each
    if (own && this.now < (p.quiet || 0)) return false;
    this.emote(p, name, dur); if (own) p.quiet = this.now + rnd(60, 120);
    this.calm = this.now + dur + rnd(15, 25);
    return true;
  }
  act(p, kind, dur, extra = {}) { p.act = { kind, t0: this.now, dur, ...extra }; }
  emote(p, name, dur = 2.4) {
    const E = EMOTES[name]; if (!E) return;
    if (p.bubble) p.bubble.el.remove();
    const el = document.createElement("div");
    el.className = `pemo${E.text ? "" : " solo"}`; el.dataset.emote = name;
    el.innerHTML = `<span><img src="assets/icons/${E.icon}.png?v=1" alt="">${E.text ? `<i>${E.text}</i>` : ""}</span>${E.drop ? "<b class=drop></b>" : ""}`;
    this.col.labels.append(el);
    p.bubble = { el, t0: this.now, dur, name }; p.quiet = Math.max(p.quiet || 0, this.now + 30);
  }

  after() {
    if (!this.held && !this.list.some((p) => p.mode === "fall")) return;
    const r = this.col.renderer;
    if (!this.topLit) { this.topLit = 1; for (const o of this.col.scene.children) if (o.isLight) { const c = o.clone(); c.castShadow = false; this.top.add(c); } }
    r.autoClear = false; r.clearDepth(); r.render(this.top, this.col.camera); r.autoClear = true;
  }
  // The highest ground (a tile's top, or the map) within r of a world point.
  groundTop(x, z, r) {
    let y = this.floorY;
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
      const px = x + dx * r, pz = z + dz * r;
      for (const t of this.col.tiles) {
        const g = t.group, h = this.hOf.get(g); if (!h || g.position.y < -1 || (this.col.picked && this.col.picked !== t)) continue;
        const S = g.children[0]?.geometry?.parameters?.width || 12, l = g.worldToLocal(new THREE.Vector3(px, g.position.y, pz));
        if (Math.abs(l.x) <= S / 2 && Math.abs(l.z) <= S / 2) y = Math.max(y, g.localToWorld(l.setY(h(l.x, l.z))).y);
      }
    }
    return y;
  }
  // Finger on the map beside a tile's cliff (or on the cliff itself, where the ray goes through the wall to the
  // map under it): slide the hanging point toward the camera until its body is clear of the wall.
  offWalls(P, r) {
    const cam = this.col.camera.position;
    for (let pass = 0; pass < 3; pass++) for (const t of this.col.tiles) {
      const g = t.group; if (g.position.y < -1 || (this.col.picked && this.col.picked !== t)) continue;
      const S = g.children[0]?.geometry?.parameters?.width || 12, h2 = (S / 2) * g.scale.x + r;
      const l = g.worldToLocal(new THREE.Vector3(P.x, g.position.y, P.z)).multiplyScalar(g.scale.x);
      if (Math.abs(l.x) >= h2 || Math.abs(l.z) >= h2) continue;
      const d = new THREE.Vector3(cam.x - P.x, 0, cam.z - P.z).normalize(), dl = d.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -g.rotation.y);
      const ex = (v, dv) => (dv > 1e-6 ? (h2 - v) / dv : dv < -1e-6 ? (-h2 - v) / dv : 1e9), k = Math.min(ex(l.x, dl.x), ex(l.z, dl.z)) + 0.05;
      P.x += d.x * k; P.z += d.z * k;
    }
    return P;
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

      }
    }
    for (const p of this.list) {
      if (p.later && t >= p.later.at) { const f = p.later.fn; p.later = null; f(); }
      if (p.mode === "held") this.holdFrame(p, dt);
      else if (p.mode === "fall") this.fallFrame(p, dt);
      else if (p.mode === "scramble") this.scrambleFrame(p, dt);
      else if (p.mode === "ladder") this.ladderFrame(p, dt);
      else this.groundFrame(p, dt);
    }
    this.meetings(t);
    this.puffFrame(dt);
    this.propFrame();
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
      // Clear of everything under its body: off any cliff beside it, and its lowest point above the highest ground below.
      const r = Math.max(p.tall * sc * 0.9, L * 0.7), P = gu.tile ? gu.p.clone() : this.offWalls(gu.p.clone(), r); // over a tile's top: lifted above it instead
      const aim = P.clone(); aim.y = this.groundTop(P.x, P.z, r) + L + p.tall * sc * 0.75 + 0.6;
      const before = this.hang.position.clone();
      this.hang.position.lerp(aim, 1 - Math.exp(-dt * 22));
      this.target(this.magnet(gu.p));
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
    // Its shadow where it will land: on the tile it's over or near (tiles pull it in), else on the map.
    const below = this.aim || this.surfaceAt(this.hang.position.x, this.hang.position.z), hgt = this.hang.position.y - L - below.wy;
    const sp = below.g === col.scene ? new THREE.Vector3(below.x, below.wy, below.z) : below.g.localToWorld(new THREE.Vector3(below.x, this.hOf.get(below.g)(below.x, below.z), below.z));
    this.shadow.position.lerp(sp.setY(sp.y + 0.05), this.shadowSnap ? 1 : 1 - Math.exp(-dt * 30)); this.shadowSnap = false;
    this.shadow.scale.setScalar(p.tall * sc * (0.55 + 0.15 * Math.exp(-hgt / 6)));
    this.shadow.material.opacity = clamp(1.1 - hgt / (L * 6), 0.35, 0.9);
    const onTile = below.g !== col.scene; this.shadow.material.depthTest = !onTile; // on a tile: drawn over its bumps, clearly there
    if (onTile) { this.shadow.material.opacity = 1; this.shadow.scale.multiplyScalar(0.75); }
  }

  fallFrame(p, dt) {
    const F = p.fall, B = F.to, tgt = B.g.localToWorld(new THREE.Vector3(B.x, this.hOf.get(B.g)?.(B.x, B.z) ?? this.floorY, B.z));
    if (B.g === this.col.scene) tgt.y = this.floorY;
    const u = this.now - F.t0, H = Math.max(0.5, F.from.y - tgt.y), T = clamp(Math.sqrt(H) * 0.12, 0.28, 0.6) * (B.g !== this.col.scene ? 1.7 : 1), k = Math.min(1, u / T);
    const endS = B.g === this.col.scene ? 1 : B.g.getWorldScale(new THREE.Vector3()).x;
    // Onto a tile it glides in, hovers just above the spot, and settles; onto the map it simply drops.
    const tileDrop = B.g !== this.col.scene, hov = p.tall * endS * 0.5;
    const y = tileDrop ? (k < 0.65 ? F.from.y + (tgt.y + hov - F.from.y) * ease(k / 0.65) : tgt.y + hov * (1 - ease((k - 0.65) / 0.35))) : F.from.y + (tgt.y - F.from.y) * k * k;
    p.a.position.set(F.from.x + (tgt.x - F.from.x) * ease(Math.min(1, k * (tileDrop ? 1.5 : 1))), Math.max(tgt.y, y), F.from.z + (tgt.z - F.from.z) * ease(Math.min(1, k * (tileDrop ? 1.5 : 1))));
    p.a.scale.setScalar(F.s0 + (endS - F.s0) * ease(k));
    p.a.rotation.set(F.pitch * (1 - ease(k)), F.yaw, F.tilt * (1 - k));
    this.mix(p, dt * 2.5);
    this.shadow.position.set(tgt.x, tgt.y + 0.04, tgt.z); this.shadow.scale.setScalar(p.tall * p.a.scale.x * (0.55 + 0.15 * k));
    if (k >= 1) {
      this.shadow.visible = false; this.shadow.material.depthTest = true;
      const gyaw = B.g === this.col.scene ? 0 : B.g.rotation.y;
      this.settle(p, B.g, B.x, B.z, F.yaw - gyaw);
      p.mode = "land"; p.land = this.now; p.wasMode = "wander"; p.mood = this.moodOf(p, B, tgt.y); this.homesick(p);
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
      this.missFrame(p, t);
      if (p.mode !== "wander") return this.groundFrame(p, 0);
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
      const nb = u > 0.55 && !p.shook ? this.neighbour(p) : null;
      const away = p.place.g !== this.col.scene && p.place.g !== p.homeG, rel = nb && relation(p.kind, nb.kind);
      if (nb && (!away || rel !== "neutral")) this.startSocial(p, nb, true); // dropped right beside another: friends, rivals or neither
      else if (u > 0.55 && away) { p.mode = "wander"; p.mood = null; p.wait = rnd(1, 2); this.emote(p, "lost", 2.6); this.act(p, "look", 1.6); this.homesick(p); } // someone else's mountain: lost
      else if (u > 0.55 && p.mood === "low") { p.mode = "wander"; this.startTrip(p, true); }
      else if (u > 0.55 && p.mood === "high") { p.mode = "bask"; p.baskEnd = t + rnd(20, 32); p.sunAt = p.baskFrom = t; }
      else if (u > 0.55 && u < 1.35) { const s = (u - 0.55) / 0.8; roll = Math.sin(s * Math.PI * 9) * 0.22 * (1 - s); hr = -roll * 1.5; if (!p.shook) { p.shook = 1; this.emote(p, "snow", 1.8); } }
      if (u > 1.35 && u < 3.2) { const s = (u - 1.35) / 1.85; hy = Math.sin(s * Math.PI * 2) * 0.75; hp = -0.15; if (s > 0.62) { hy = clamp(angTo(p.yaw, toCam), -0.9, 0.9); hr = 0.3; } }
      if (u >= 3.2) { p.mode = "wander"; p.shook = 0; p.wait = rnd(0.3, 1.2); this.newTarget(p); }
    } else if (p.mode === "social") {
      ({ speed = 0, sy = 1, hy = 0, hp = 0, hr = 0, roll = 0, hop = 0 } = this.socialStep(p, dt, t) || {});
    } else if (p.mode === "trip" && !p.act) {
      ({ speed = 0, sy = 1, hy = 0, hp = 0, hr = 0, roll = 0 } = this.tripStep(p, dt, t) || {});
      if (p.mode === "scramble") return; // it has just set off up (or down) a tile's side
    } else if (p.mode === "bask") {
      // Lying in the sun, facing it, with a contented little sway.
      const to = this.sunYaw - (p.place.g === this.col.scene ? 0 : p.place.g.rotation.y);
      p.yaw += angTo(p.yaw, to) * Math.min(1, dt * 2);
      sy = 0.86 + Math.sin(t * 1.1) * 0.015; roll = Math.sin(t * 1.3) * 0.05; hp = -0.38; hr = Math.sin(t * 0.9) * 0.18; hy = Math.sin(t * 0.45) * 0.2;
      if (t > p.sunAt) { if (p.sunAt === p.baskFrom) this.emote(p, "sun", 3); else this.think(p, "sun", 3); p.sunAt = t + rnd(30, 50); }
      if (t > p.baskEnd) { p.mode = "wander"; p.mood = null; p.wait = rnd(0.5, 1.5); this.newTarget(p); this.act(p, "wiggle", 0.9); this.save(); }
    } else if (p.mode === "doze") {
      const u = t - p.dozeAt; sy = 0.86 + Math.sin(t * 1.6) * 0.025; hp = Math.min(0.55, u * 0.4); hr = 0.15;
      if (t > p.zzz) { this.think(p, "sleepy", 3); p.zzz = t + rnd(20, 40); }
      if (u > 45 + p.seed * 10) { p.mode = p.wasMode || "wander"; p.poke = t; this.act(p, "wiggle", 0.8); }
    }
    // A reaction on top.
    if (p.act) {
      const A = p.act, u = (t - A.t0) / A.dur;
      if (u >= 1) p.act = null;
      else if (A.kind === "hop") { hop = Math.sin(u * Math.PI) * p.tall * 0.55; sy = 1 + Math.sin(u * Math.PI) * 0.12; speed = 2.5; }
      else if (A.kind === "hop2") { const v = (u * 2) % 1; hop = Math.sin(v * Math.PI) * p.tall * 0.45; sy = v < 0.12 || v > 0.88 ? 0.85 : 1.1; speed = 3; hr = Math.sin(u * Math.PI * 2) * 0.3; }
      else if (A.kind === "spin") { spin = ease(u) * Math.PI * 2; hop = Math.sin(u * Math.PI) * p.tall * 0.3; speed = 2; }
      else if (A.kind === "pine") { p.yaw += angTo(p.yaw, A.yaw) * Math.min(1, dt * 3); const k = Math.sin(Math.min(1, u * 1.3) * Math.PI); sy = 1 - 0.07 * k; hp = 0.15 - 0.4 * Math.sin(Math.min(1, u * 3) * Math.PI); hr = 0.2 * k; }
      else if (A.kind === "sway") { roll = Math.sin(u * Math.PI * 4) * 0.12; hr = Math.sin(u * Math.PI * 4) * 0.45; hy = Math.sin(u * Math.PI * 2) * 0.3; speed = 0.4; }
      else if (A.kind === "tilt") { const k = Math.sin(Math.min(1, u * 1.4) * Math.PI); hr = 0.55 * k; hp = -0.1 * k; hy = clamp(angTo(p.yaw, toCam), -0.8, 0.8) * k; }
      else if (A.kind === "wiggle") { roll = Math.sin(u * Math.PI * 8) * 0.22 * (1 - u); hr = Math.sin(u * Math.PI * 4) * 0.4; speed = 0.5; }
      else if (A.kind === "look" || A.kind === "greet") {
        const to = A.kind === "look" ? toCam : A.yaw;
        p.yaw += angTo(p.yaw, to) * Math.min(1, dt * 5) * (u < 0.85 ? 1 : 0); hr = Math.sin(Math.min(1, u * 2) * Math.PI / 2) * 0.35; hp = -0.12;
      }
    }
    if ((p.mode === "wander" || p.mode === "loop") && !p.act && t - p.poke > this.dozeAfter + p.seed * 8) {
      p.wasMode = p.mode; p.mode = "doze"; p.dozeAt = t; p.zzz = t + 1.2; if (p.action) p.action.time = 0;
    }
    if ((p.mode === "wander" || p.mode === "loop") && !p.act && t > p.next && p.place.g === p.homeG) { p.next = t + rnd(60, 120); this.think(p, pickOf(["music", "snow", "happy"])); }
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
      if (Math.random() > 0.6 || a.place.g !== b.place.g) continue;
      this.startSocial(a, b); return; // the same friends-or-rivals as when you put one beside the other
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
  // A puff of snow where it lands (or, with opt, a few falling drops of sweat).
  puff(at, size, opt = {}) {
    const { color = 0xffffff, n = 11, grav = 0, life = 0.75, r = [0.12, 0.2] } = opt;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }), g = new THREE.Group(), bits = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.ball, mat), a = (i / n) * Math.PI * 2 + rnd(-0.2, 0.2);
      m.userData.v = new THREE.Vector3(Math.sin(a) * rnd(0.8, 1.4), rnd(0.3, 0.9) + grav, Math.cos(a) * rnd(0.8, 1.4)).multiplyScalar(size * 1.4);
      m.userData.r = size * rnd(r[0], r[1]); m.scale.setScalar(m.userData.r); g.add(m); bits.push(m);
    }
    g.position.copy(at).y += 0.05; this.col.scene.add(g); this.puffs.push({ g, bits, mat, t: 0, grav: grav * size * 9, life, sink: grav ? -1e9 : 0, dry: !grav });
  }
  puffFrame(dt) {
    for (const P of this.puffs) {
      P.t += dt; const u = P.t / P.life;
      for (const m of P.bits) {
        if (P.grav) m.userData.v.y -= P.grav * dt;
        m.position.addScaledVector(m.userData.v, dt * (P.dry ? Math.max(0, 1 - u) : 1)); m.position.y = Math.max(P.sink, m.position.y);
        if (P.dry) m.scale.setScalar(m.userData.r * (1 + u * 1.6));
      }
      P.mat.opacity = 0.95 * Math.max(0, 1 - u * u);
      if (u >= 1) { this.col.scene.remove(P.g); P.mat.dispose(); }
    }
    this.puffs = this.puffs.filter((P) => P.t < P.life);
  }
  // Pinned over each head with the camera exactly as this frame renders it (after the phone-tilt turn) and
  // the animal where it is right now (hopping, climbing, on a tile that's sinking or rising).
  bubbles() {
    const cam = this.col.camera, w = this.col.canvas.clientWidth, h = this.col.canvas.clientHeight, v = new THREE.Vector3(), s = new THREE.Vector3();
    cam.updateMatrixWorld();
    for (const p of this.list) {
      const B = p.bubble; if (!B) continue;
      const u = this.now - B.t0;
      if (u > B.dur + 0.3) { B.el.remove(); p.bubble = null; continue; }
      if (u > B.dur) B.el.classList.add("out");
      p.a.updateWorldMatrix(true, true); p.a.getWorldScale(s);
      const head = p.a.userData.head; if (head) head.getWorldPosition(v).y += p.tall * 0.42 * s.y; else p.a.localToWorld(v.set(0, p.tall * 1.08, 0));
      v.project(cam);
      const hide = v.z > 1 || this.sunk(p);
      B.el.style.visibility = hide ? "hidden" : "";
      B.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h - 8}px) translate(-50%, -100%)`;
    }
  }
}
