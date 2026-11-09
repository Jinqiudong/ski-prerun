// The guide, drawn: a little animal on its own four feet (runner.js) running the route ahead of you, paw prints
// and puffs of snow behind it, and a painted sign in a paper bubble over its head (the party note's
// look, core/party.js). Its rules are guide-core.js; ride.js makes one at the top, starts it with each way down,
// steps it in the skiing phase (it may hand back a plan with a detour spliced in, or without it again), and asks
// how much the gold arrowheads should show and how wooded the way is just now.
// On foot, never on a board (the owner): riding together, a board is a friend; the animal running is the guide.
// Which one: the resort's, unless it is pale and would vanish on the snow (guide-core.js guideAnimal).
import * as THREE from "three";
import { Runner } from "./runner.js?v=1";
import { Spray } from "./board.js?v=16";
import { ANIMAL_ZH } from "../rider/animal-core.js?v=2";
import { ANIMALS } from "../start/resort-tiles.js?v=5";
import { myRider, fallState } from "../rider/boarder.js?v=30";
import { t } from "../core/i18n.js?v=51";
import { guideAnimal, SIGNS, MOMENT, heldSign, phraseBag, newGuide, guideStep, arrowAlpha, DETOURS, DETOUR, wantDetour, pointAt, splicePlan, spotKey, loadSpots, addSpot, knownSpot } from "./guide-core.js?v=5";

const CSS = `
#gdBubble { position: fixed; left: 0; top: 0; z-index: 30; width: max-content; max-width: 230px; padding: 4px 6px; border-radius: 12px; background: #fdfbf6; border: 1px solid #d8ccb6;
  box-shadow: 0 6px 16px rgba(40,30,20,.25); color: #22344d; font: 600 14px/1.3 "Noto Serif SC", serif; text-align: center; pointer-events: none; transform: translate(-50%, -100%);
  transition: opacity .25s; white-space: normal; }
#gdBubble[hidden] { display: none; }
#gdBubble::after { content: ""; position: absolute; left: var(--tail, 50%); bottom: -7px; width: 12px; height: 12px; margin-left: -6px; background: #fdfbf6;
  border-right: 1px solid #d8ccb6; border-bottom: 1px solid #d8ccb6; transform: rotate(45deg); }
#gdBubble.pop { animation: gd-pop .45s cubic-bezier(.3,1.6,.5,1); }
#gdBubble img.sign { display: block; width: 48px; height: 48px; flex: none; }
#gdBubble:not(.ask) { display: flex; align-items: center; gap: 2px; } #gdBubble:not(.ask)[hidden] { display: none; }
#gdBubble .say { padding: 0 6px 0 2px; font: 600 16px/1.1 "Noto Serif SC", serif; color: #22344d; white-space: nowrap; }
#gdBubble.ask { padding: 6px 12px 8px; } #gdBubble img.ic { display: block; width: 44px; height: 44px; margin: 0 auto 2px; } #gdBubble b { display: block; font: 600 15px/1.3 "Noto Serif SC", serif; }
#gdBubble .acts { display: flex; gap: 6px; justify-content: center; margin-top: 6px; pointer-events: auto; }
#gdBubble .acts button { font: 600 13px "Noto Serif SC", serif; padding: 5px 12px; border-radius: 999px; border: 1px solid #cbbfa9; background: #fdfbf6; color: #22344d; box-shadow: 0 3px 8px rgba(40,30,20,.16); }
#gdBubble .acts button.go { background: #22344d; border-color: #22344d; color: #fdfbf6; }
#gdUnlock { position: fixed; left: 50%; top: calc(env(safe-area-inset-top) + 215px); z-index: 31; transform: translateX(-50%); display: flex; align-items: center; gap: 10px;
  padding: 10px 16px 10px 12px; border-radius: 10px; background: #fdfbf6; border: 1px solid #d8ccb6; box-shadow: 0 10px 24px rgba(40,30,20,.3); color: #22344d;
  font: 14px "Noto Serif SC", serif; pointer-events: none; animation: gd-unlock 3.8s ease both; white-space: nowrap; }
#gdUnlock[hidden] { display: none; }
#gdUnlock .art { position: relative; width: 48px; height: 48px; } #gdUnlock .art img { position: absolute; }
#gdUnlock .art .tree { left: 0; top: 0; width: 48px; height: 48px; } #gdUnlock .art .star { right: -8px; top: -8px; width: 24px; height: 24px; animation: gd-spin 1.2s ease-out; }
#gdUnlock small { display: block; color: #8a6d3b; font: 600 11px/1.2 "Noto Serif SC", serif; letter-spacing: .2em; }
#gdUnlock b { display: block; font: 600 17px/1.25 "Noto Serif SC", serif; }
#gdUnlock em { display: block; font: 500 12px/1.2 "Noto Serif SC", serif; color: #6f5a46; font-style: normal; }
.gdSpots { display: block; margin-top: 4px; font-size: 12px; } .gdSpots img { width: 16px; height: 16px; vertical-align: -3px; margin-right: 3px; }
@keyframes gd-pop { from { transform: translate(-50%, -100%) scale(.6); } to { transform: translate(-50%, -100%) scale(1); } }
@keyframes gd-unlock { 0% { opacity: 0; transform: translateX(-50%) translateY(-14px) scale(.8); } 10% { opacity: 1; transform: translateX(-50%) scale(1.04); } 16% { transform: translateX(-50%) scale(1); }
  85% { opacity: 1; } 100% { opacity: 0; transform: translateX(-50%) translateY(-8px); } }
@keyframes gd-spin { from { transform: rotate(-180deg) scale(.2); } to { transform: none; } }
`;
const ICON = (n) => `assets/icons/${n}.png?v=1`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const Y = new THREE.Vector3(0, 1, 0);
// How tall it stands, metres: a small animal beside a rider (the owner: not bigger); 10–16 m ahead, its paw
// prints and puffs make it easy to follow.
const TALL = 1.3;

export class Guide {
  // scene; camera; T (heightAt, normalAt); ground(x, z): the snow's surface (moguls, powder); trees: { grid, cell }
  // (ride.js's tree grid: every tree planted); resort; rider: my rider's root (to see a crash); force: ?detour.
  constructor({ scene, camera, T, ground, trees, resort, rider, force = null, storage = localStorage }) {
    Object.assign(this, { scene, camera, T, ground, trees, resort, rider, force, storage });
    this.holder = new THREE.Group(); this.holder.visible = false; scene.add(this.holder);
    this.root = null; this.P = null; this.g = null; this.det = null; this.pending = null; this.woods = 0; this.alpha = 1; this.lastDetour = -Infinity;
    this.found = []; this.clock = 0; this.held = null; this.shown = ""; this.word = phraseBag();
    const mine = myRider().ch.animal || null;
    this.animal = guideAnimal(ANIMALS[resort], mine);
    this.name = t(ANIMAL_ZH[this.animal] || "小狐狸");
    this.runner = new Runner(this.animal, TALL);
    this.runner.ready.then(() => { this.root = this.runner.root; this.holder.add(this.root); }).catch(() => {});
    this.prints = new Prints(scene, T); this.puffs = new Spray(scene, { n: 240, size: 0.32, opacity: 0.85, color: 0xf2f6fc }); this.lookT = 4;
    if (!document.getElementById("gdCss")) { const s = document.createElement("style"); s.id = "gdCss"; s.textContent = CSS; document.head.append(s); }
    this.bubble = document.createElement("div"); this.bubble.id = "gdBubble"; this.bubble.hidden = true; document.body.append(this.bubble);
    this.card = document.createElement("div"); this.card.id = "gdUnlock"; this.card.hidden = true; document.body.append(this.card);
    this.bub = null; // { until, acts }
    this.pos = new THREE.Vector3(); this.heading = 0; this.circle = 0; this.placed = false; this.n = new THREE.Vector3(0, 1, 0);
  }
  // A new way down: in front of you, ready to go, with a hello.
  start(P, prog) {
    this.P = P; this.det = null; this.pending = null; this.detNext = 0; this.detDone = false; this.woods = 0;
    this.g = newGuide(P.dist[prog] || 0); this.placed = false; this.holder.visible = !!this.root;
    this.card.hidden = true; this.found = []; this.held = null; this.bub = null;
  }
  hide() { this.holder.visible = false; this.prints.clear(); this.bubble.hidden = true; this.bub = null; this.held = null; this.shown = ""; this.P = null; this.alpha = 1; }
  // Where you are along the way: the nearest point's distance, plus how far past it you are toward the next.
  along(P, prog, x, z) {
    const i = Math.min(prog, P.path.length - 2), [ax, az] = P.path[i], [bx, bz] = P.path[i + 1], L = P.dist[i + 1] - P.dist[i] || 1;
    return P.dist[i] + clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / L, -L, L);
  }
  treesNear(x, z, r) {
    const { grid, cell } = this.trees, out = [], n = Math.ceil(r / cell);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (const t of grid.get(`${Math.floor(x / cell) + i},${Math.floor(z / cell) + j}`) || []) if (Math.abs(t.x - x) < r && Math.abs(t.z - z) < r) out.push(t);
    return out;
  }
  // One frame of skiing. P: the plan now; prog: where on it; r: the board's physics; off: metres off the route;
  // js: the way's junctions (skinav.js). Returns a plan to ride instead (a detour spliced in or taken out) or null.
  step(dt, { P, prog, r, off, js = [] }) {
    if (!this.P || !this.g) return null;
    this.clock += dt;
    this.js = js;
    if (this.pending) { const Q = this.pending, was = this.P; this.pending = null; this.P = Q; if (was?.orig === Q) for (const j of js) j.i = was.unshift(j.i); return Q; }
    if (P !== this.P) { // planned again (off the route, the map, a friend): from here on that one, no detour on it
      this.P = P; this.g = newGuide(this.along(P, prog, r.x, r.z));
      if (this.det && P !== this.det.Q) { this.det = null; this.detDone = true; }
    }
    const g = this.g, sR = (this.sR = this.along(P, prog, r.x, r.z)), end = P.dist[P.dist.length - 1];
    // The turn-offs ahead, and a detour's way in as one.
    const turns = [];
    for (const j of js) { const way = j.options.find((o) => o.route); if (way && j.i < P.path.length) turns.push({ s: P.dist[j.i], bearing: way.bearing, many: j.options.length > 1, key: j }); }
    const D = this.det;
    if (D?.Q === P && D.state !== "done") turns.push({ s: P.dist[P.detour.a] + 10, bearing: D.line.side * 0.7, key: D });
    turns.sort((a, b) => a.s - b.s);
    const inTrees = D?.Q === P && sR > P.dist[P.detour.a] && sR < P.dist[P.detour.b];
    this.woods += ((inTrees ? 1 : 0) - this.woods) * Math.min(1, dt * 2);
    const said = guideStep(g, { sR, speed: r.speed, off, end, turns, down: !!fallState(this.rider), inTrees, dt });
    for (const k of said) {
      if (MOMENT[k]) this.speak(k, true);
      else if (["turnL", "turnR", "straight", "atTurn", "wait", "crash"].includes(k) && this.root) this.runner.hop(1); // a little jump as the sign comes up
    }
    this.held = heldSign(g, turns, sR);
    let ret = this.detours(P, sR, end);
    // Where it is: along the route (a little weave of its own), circling the mouth of a turn-off, or coming back to you.
    const want = new THREE.Vector3();
    if (g.mode === "back") {
      // in front of you where you can see it, a little toward the route, turned to you
      const c = pointAt(P.path, P.dist, sR), tx = c.x - r.x, tz = c.z - r.z, L = Math.hypot(tx, tz) || 1;
      want.set(r.x + Math.sin(r.heading) * 8 + (tx / L) * 2.5, 0, r.z + Math.cos(r.heading) * 8 + (tz / L) * 2.5);
    } else if (g.mode === "turn" && g.turn) {
      this.circle += dt * 2.4;
      const c = pointAt(P.path, P.dist, Math.min(end, g.turn.s + 7));
      want.set(c.x + Math.cos(this.circle) * 2.6, 0, c.z + Math.sin(this.circle) * 2.6);
    } else {
      const p = pointAt(P.path, P.dist, g.s, prog), moving = g.mode === "lead" ? clamp(g.v / 4, 0, 1) : 0;
      // a little to one side of your line (not hidden behind your rider, still near the middle of the screen)
      const lat = clamp(3 * Math.sin(g.s / 80), -1, 1) * (2.2 + 0.6 * Math.sin(g.s / 11)) * (0.6 + 0.4 * moving);
      want.set(p.x - Math.cos(p.h) * lat, 0, p.z + Math.sin(p.h) * lat);
    }
    if (!this.placed) { this.pos.copy(want); this.placed = true; }
    const was = this.pos.clone(), step = (Math.max(r.speed, 6) + 9) * dt, d = Math.hypot(want.x - this.pos.x, want.z - this.pos.z);
    if (d > 60) this.pos.copy(want); // far behind (a jump on the map): just there
    else if (d > step) { this.pos.x += ((want.x - this.pos.x) / d) * step; this.pos.z += ((want.z - this.pos.z) / d) * step; }
    else { this.pos.x = want.x; this.pos.z = want.z; }
    this.pos.y = this.ground(this.pos.x, this.pos.z);
    const vx = (this.pos.x - was.x) / Math.max(dt, 1e-3), vz = (this.pos.z - was.z) / Math.max(dt, 1e-3), v = Math.hypot(vx, vz);
    // Facing the way it goes; stopped, turned round to you.
    const h0 = this.heading, face = v > 0.8 ? Math.atan2(vx, vz) : Math.atan2(r.x - this.pos.x, r.z - this.pos.z);
    this.heading += angleDiff(face, this.heading) * Math.min(1, dt * (v > 0.8 ? 7 : 3));
    const yawRate = angleDiff(this.heading, h0) / Math.max(dt, 1e-3);
    this.n.copy(this.T.normalAt(this.pos.x, this.pos.z, this.n));
    this.holder.visible = !!this.root;
    if (this.root) {
      this.holder.position.copy(this.pos); this.holder.rotation.set(0, this.heading, 0);
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading), L = this.runner.len * 0.5 || 1;
      const pitch = Math.atan2(this.ground(this.pos.x - fx * L, this.pos.z - fz * L) - this.ground(this.pos.x + fx * L, this.pos.z + fz * L), 2 * L);
      // now and then, leading, a look back over its shoulder to see you're there
      if (g.mode === "lead" && (this.lookT -= dt) < 0) { this.lookT = 6 + Math.random() * 5; this.runner.lookBack(1.1, Math.sign(fz * (r.x - this.pos.x) - fx * (r.z - this.pos.z)) || 1); }
      for (const f of this.runner.update(dt, { v, yawRate, pitch })) {
        const x = this.pos.x + fz * f.x + fx * f.z, z = this.pos.z - fx * f.x + fz * f.z, y = this.ground(x, z);
        this.prints.add(x, y, z, this.heading);
        this.puffs.emit({ x, y, z, heading: this.heading, speed: 0.5, steer: 1, skid: 0.6 }, 3, 1);
      }
    }
    this.prints.update(dt); this.puffs.update(dt);
    // The arrows under it: quiet while it's in sight and leading.
    const seen = this.holder.visible && Math.hypot(this.pos.x - r.x, this.pos.z - r.z) < 70;
    this.alpha = arrowAlpha({ mode: g.mode, off, seen });
    this.place();
    return ret;
  }
  // The detour: looked for a little ahead, offered with ~100 m to go (the plan with it spliced in, so the board
  // follows it unless you say no), and the spot unlocked as you come out of it.
  detours(P, sR, end) {
    const D = this.det;
    if (!D && !this.detDone && sR >= this.detNext && P.path.length > 4) {
      this.detNext = sR + 150;
      const def = DETOURS.find((d) => d.ready && d.key === "trees");
      const avoid = [];
      for (const s of this.turnSpots(P)) avoid.push([s - DETOUR.nearTurn, s + DETOUR.nearTurn]);
      const from = Math.max(DETOUR.first, sR + 110), to = Math.min(sR + 320, end - DETOUR.last - 190);
      const line = to > from ? def.find({ path: P.path, dist: P.dist, from, to, treesNear: (x, z, r) => this.treesNear(x, z, r), height: (x, z) => this.T.heightAt(x, z), avoid }) : null;
      if (line) {
        const mid = line.pts[line.pts.length >> 1], key = spotKey(def.key, mid[0], mid[1]), known = knownSpot(this.storage, this.resort, key);
        if (wantDetour({ known, sinceLast: this.clock - this.lastDetour, force: this.force })) {
          const seg = P.segs.filter((g) => g.at <= line.a).pop();
          this.det = { def, line, key, known, state: "ahead", name: def.spot(seg?.run.name), label: def.spot(seg?.run.name, t), mid };
          this.detDone = true;
        } else if (!this.force) this.detDone = true; // asked once this way down: no
      }
      return null;
    }
    if (!D) return null;
    if (D.state === "ahead" && P.dist[D.line.a] - sR < 110) {
      D.Q = splicePlan(P, D.line.a, D.line.b, D.line.pts, (x, z) => this.T.heightAt(x, z));
      D.state = "offered"; this.lastDetour = this.clock;
      this.speak("offer", true, [[t("走！"), () => this.speak("go")], [t("不了"), () => { if (this.sR >= D.Q.dist[D.Q.detour.a]) return; D.state = "done"; this.pending = D.Q.orig; }]]);
      for (const j of this.js) j.i = D.Q.shift(j.i); // the junctions past it move along with their points
      this.P = D.Q;
      return D.Q;
    }
    if (D.Q !== P) return null;
    if (D.state === "offered" && sR > P.dist[P.detour.a] + 4) { D.state = "in"; if (this.bub?.acts) this.speak("go"); }
    if (D.state === "in" && sR > P.dist[P.detour.b] - 3) { D.state = "done"; this.unlock(D); }
    return null;
  }
  turnSpots(P) { return (this.js || []).map((j) => P.dist[j.i]); }
  unlock(D) {
    const isNew = addSpot(this.storage, this.resort, { key: D.key, kind: D.def.key, name: D.name, x: D.mid[0], z: D.mid[1] });
    this.found.push({ name: D.name, isNew });
    const n = loadSpots(this.storage, this.resort).length;
    this.card.innerHTML = `<div class="art"><img class="tree" src="${ICON(D.def.icon)}" alt=""><img class="star" src="${ICON("star")}" alt=""></div><div><small>${isNew ? t("解锁新地点") : t("又来啦")}</small><b>${D.label}</b><em>${t("已发现 {n} 处秘密地点", { n })}</em></div>`;
    this.card.hidden = false; this.card.style.animation = "none"; void this.card.offsetWidth; this.card.style.animation = "";
    clearTimeout(this.cardT); this.cardT = setTimeout(() => (this.card.hidden = true), 3900);
    navigator.vibrate?.([40, 60, 40]);
    this.speak("unlock", true);
  }
  // A moment in the bubble, over whatever it holds: kind is a guideStep moment (guide-core.js MOMENT), "offer"
  // (the detour's icon, its three words and buttons: acts) or a sign of the way's from the ride (sign(): moguls,
  // lift, lodge). hop: a little jump as it shows.
  speak(kind, hop = false, acts = null) {
    if (this.bub?.acts && !acts && kind !== "go") return; // the offer stays up till it's answered or passed
    const [sign, secs] = kind === "offer" ? [null, 7] : MOMENT[kind] || [];
    if (kind !== "offer" && !sign) return;
    this.bub = { key: `${kind}:${this.clock}`, sign, acts, until: this.clock + secs };
    if (hop && this.root) this.runner.hop(kind === "unlock" ? 2 : 1);
  }
  // The ride's own moments for the bubble: nearly there ("lift" or "lodge"). The road's conditions are not the
  // guide's (ride.js roadCue).
  sign(kind, secs = 2.6) { if (!this.P || this.bub?.acts || !SIGNS[kind]) return; this.bub = { key: `${kind}:${this.clock}`, sign: kind, until: this.clock + secs }; }
  // What the bubble shows now: a moment, else the held sign (the turn-off ahead, waiting, coming back), else nothing.
  // Rebuilt only when that changes, with a pop.
  paint() {
    const b = this.bubble;
    if (this.bub && !this.bub.acts && this.clock > this.bub.until) this.bub = null;
    if (this.bub?.acts && this.clock > this.bub.until) this.bub = null;
    const m = this.bub, key = m ? m.key : this.held ? `held:${this.held}` : "";
    if (key === this.shown) return !!key;
    this.shown = key;
    if (!key) { b.hidden = true; return false; }
    b.classList.toggle("ask", !!m?.acts);
    if (m && !m.sign) { // the detour's offer
      b.innerHTML = `<img class="ic" src="${ICON(this.det?.def.icon || "trees")}" alt=""><b>${t(this.det?.def.offer || "")}</b>`;
      const row = document.createElement("div"); row.className = "acts";
      m.acts.forEach(([label, fn], k) => { const x = document.createElement("button"); x.textContent = label; if (!k) x.className = "go"; x.onclick = (e) => { e.stopPropagation(); this.bub = null; fn(); }; x.onpointerdown = (e) => e.stopPropagation(); row.append(x); });
      b.append(row);
    } else { // the sign, and a word or two beside it (guide-core.js PHRASES)
      const sign = m ? m.sign : this.held, w = t(this.word(sign));
      b.innerHTML = `<img class="sign" src="${ICON(SIGNS[sign])}" alt="">${w ? `<span class="say">${w}</span>` : ""}`;
    }
    b.hidden = false; b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
    return true;
  }
  // The bubble over its head, on screen.
  place() {
    const b = this.bubble;
    if (!this.paint()) return;
    const p = this.pos.clone().addScaledVector(Y, TALL + 0.55).project(this.camera);
    const behind = p.z > 1, w = b.offsetWidth || 80, ask = !!this.bub?.acts;
    let x = (p.x * 0.5 + 0.5) * innerWidth, y = (-p.y * 0.5 + 0.5) * innerHeight;
    if (behind) { x = innerWidth / 2; y = innerHeight * 0.3; }
    // a bubble with buttons stays toward the middle, whatever the animal's place
    const lo = ask ? Math.max(w / 2 + 8, innerWidth * 0.5 - 24) : w / 2 + 8, hi = ask ? Math.min(innerWidth - w / 2 - 8, innerWidth * 0.5 + 24) : innerWidth - w / 2 - 8;
    const cx = clamp(x, lo, hi), cy = clamp(y - 4, 150, innerHeight - 120);
    b.style.left = `${cx}px`; b.style.top = `${cy}px`;
    b.style.setProperty("--tail", `${clamp(50 + ((x - cx) / w) * 100, 12, 88)}%`);
  }
  // The end of the way down: it's gone, and the summary says what's been found.
  arrive(noteEl) {
    this.hide();
    const n = loadSpots(this.storage, this.resort).length;
    if (!n || !noteEl) return;
    const now = this.found.filter((f) => f.isNew).length;
    const s = document.createElement("span"); s.className = "gdSpots";
    s.innerHTML = `<img src="${ICON("trees")}" alt="">${t("已发现 {n} 处秘密地点", { n })}${now ? ` · ${t("这趟 +{k}", { k: now })}` : ""}`;
    noteEl.append(s);
  }
}

// Paw prints in the snow behind it: small blue-grey ovals laid on the slope, fading back to white in ~10 s.
const PRINTS = 64, SNOW = new THREE.Color(0xf4f7fb), INK = new THREE.Color(0x8ea3c2);
class Prints {
  constructor(scene, T) {
    const geo = new THREE.CircleGeometry(0.12, 10); geo.rotateX(-Math.PI / 2); geo.scale(1, 1, 1.35);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), PRINTS);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PRINTS * 3).fill(1), 3);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    this.T = T; this.age = new Float32Array(PRINTS).fill(99); this.next = 0; this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.q2 = new THREE.Quaternion(); this.n = new THREE.Vector3(); this.c = new THREE.Color();
    this.clear(); scene.add(this.mesh);
  }
  clear() { this.m.makeScale(0, 0, 0); for (let i = 0; i < PRINTS; i++) { this.mesh.setMatrixAt(i, this.m); this.age[i] = 99; } this.mesh.instanceMatrix.needsUpdate = true; }
  add(x, y, z, h) {
    const i = this.next = (this.next + 1) % PRINTS;
    this.q.setFromUnitVectors(Y, this.T.normalAt(x, z, this.n)).multiply(this.q2.setFromAxisAngle(Y, h));
    this.m.compose(new THREE.Vector3(x, y + 0.04, z), this.q, new THREE.Vector3(1, 1, 1));
    this.mesh.setMatrixAt(i, this.m); this.age[i] = 0; this.mesh.instanceMatrix.needsUpdate = true;
  }
  update(dt) {
    for (let i = 0; i < PRINTS; i++) { if (this.age[i] > 12) continue; this.age[i] += dt; this.mesh.setColorAt(i, this.c.copy(INK).lerp(SNOW, Math.min(1, this.age[i] / 10))); }
    this.mesh.instanceColor.needsUpdate = true;
  }
}
