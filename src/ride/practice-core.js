// The bunny hill (宝宝坡) practice's rules, with no DOM and no three.js (tested: tests/practice.test.mjs): where each
// resort's bunny hill is, the steps of the lesson and what passes each one, measured from the board's physics
// (board.js Rider: speed, heading, the fall line, the board across the travel, the edge set, a caught edge).
// practice.js draws it and runs it in the ride. Angles in radians; yaw 0 = +z, as board.js measures it.
import { DEG, wrap, brakeOf } from "./edge-core.js?v=1";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Where: the resort's real bunny hill ----------
// The lap a beginner rides from a point: straight down the fall line in 4 m steps until the snow runs out flat
// (under 3° for 24 m) or `max` metres. Its length, mean and steepest grade (degrees, the runout left out).
export function lapLine(heightAt, x, z, max = 220) {
  const pts = [[x, z]], sl = [];
  let flat = 0, L = 0;
  for (let i = 0; i < max / 4; i++) {
    const s = 5, gx = (heightAt(x - s, z) - heightAt(x + s, z)) / (2 * s), gz = (heightAt(x, z - s) - heightAt(x, z + s)) / (2 * s), g = Math.hypot(gx, gz);
    const deg = Math.atan(g) / DEG;
    sl.push(deg);
    if (deg < 3) { flat += 4; if (flat >= 24) break; } else flat = 0;
    if (g < 1e-4) break;
    x += (gx / g) * 4; z += (gz / g) * 4; L += 4; pts.push([x, z]);
  }
  const body = sl.slice(0, Math.max(1, sl.length - flat / 4));
  return { pts, L, mean: body.reduce((a, b) => a + b, 0) / body.length, max: Math.max(...body) };
}
// What makes a good bunny hill to practise on: long enough for a few linked turns and a stop (90 m+), gentle
// (about 9°, never over 17°), close to a base. Beginner lifts (a magic carpet, a rope tow, a short chair) count
// extra: that is where the real bunny hill is.
export const BUNNY = { minL: 90, maxDeg: 17, minDeg: 4.5, best: 9, liftRise: 110, runNear: 800 };
const BEGINNER = { magic_carpet: 1.5, rope_tow: 1, drag_lift: 0.8, platter: 0.8, "t-bar": 0.6 };
export function scoreLap(lap, { kind = null, rise = 0, toBase = 0 } = {}) {
  if (lap.L < BUNNY.minL || lap.max > BUNNY.maxDeg || lap.mean < BUNNY.minDeg) return -Infinity;
  const bonus = BEGINNER[kind] ?? (rise < 80 && /chair|mixed/.test(kind || "") ? 1.5 : 0);
  return -Math.abs(lap.mean - BUNNY.best) + Math.min(lap.L, 200) / 50 + bonus - toBase / 500;
}
// The bunny hill: R the baked resort (lifts, runs, places), heightAt(x, z). Candidates, scored together: beside the
// tops of the short lifts (a beginner lift's top is where the bunny hill starts) and the tops of green runs near a
// base; failing all of those, the gentlest lap on a grid round each base. Returns { name, kind: lift | run | base, lift, x, z,
// heading (down the fall line), pts, L, mean, max }.
export function bunnySpot(R, heightAt) {
  const bases = R.places.filter((p) => p.kind === "village");
  const toBase = (x, z) => (bases.length ? Math.min(...bases.map((b) => Math.hypot(b.x - x, b.z - z))) : 0);
  const cands = [];
  const add = (x, z, info, extra) => {
    const lap = lapLine(heightAt, x, z), sc = scoreLap(lap, { ...extra, toBase: toBase(x, z) });
    if (sc > -Infinity) cands.push({ ...info, x, z, ...lap, score: sc });
  };
  // A lift's hill starts beside its top station (30–45 m to either side, a little below it): not under the
  // cable, where the towers stand, and the lap must keep clear of the line (15 m+).
  for (const l of R.lifts) {
    if (l.pts.length < 2) continue;
    const [x, z] = l.pts[l.pts.length - 1], [px, pz] = l.pts[l.pts.length - 2], rise = heightAt(x, z) - heightAt(...l.pts[0]);
    if (rise > BUNNY.liftRise) continue;
    const L = Math.hypot(x - px, z - pz) || 1, ux = (x - px) / L, uz = (z - pz) / L;
    for (const side of [-45, -30, 30, 45]) {
      const sx = x - ux * 10 + uz * side, sz = z - uz * 10 - ux * side;
      const lap = lapLine(heightAt, sx, sz);
      if (lap.pts.some(([qx, qz]) => toLine(l.pts, qx, qz) < 15)) continue;
      add(sx, sz, { name: l.name, kind: "lift", lift: l.name, liftKind: l.kind }, { kind: l.kind, rise });
    }
  }
  {
    for (const r of R.runs) {
      if (r.level !== "easy" || r.area || r.pts.length < 2 || toBase(...r.pts[0]) > BUNNY.runNear) continue;
      add(r.pts[0][0], r.pts[0][1], { name: r.name || "", kind: "run", lift: null }, {});
    }
  }
  if (!cands.length) {
    for (const b of bases) for (let dx = -400; dx <= 400; dx += 40) for (let dz = -400; dz <= 400; dz += 40) add(b.x + dx, b.z + dz, { name: b.name, kind: "base", lift: null }, {});
  }
  cands.sort((a, b) => b.score - a.score);
  const c = cands[0] || (() => { const b = bases[0] || { x: 0, z: 0, name: "" }, lap = lapLine(heightAt, b.x, b.z); return { name: b.name, kind: "base", lift: null, x: b.x, z: b.z, ...lap }; })();
  const [a, n] = [c.pts[0], c.pts[Math.min(3, c.pts.length - 1)]];
  return { name: c.name, kind: c.kind, lift: c.lift, liftKind: c.liftKind || null, x: c.x, z: c.z, heading: Math.atan2(n[0] - a[0], n[1] - a[1]) || 0, pts: c.pts, L: c.L, mean: +c.mean.toFixed(1), max: +c.max.toFixed(1) };
}
// The chairlift the ride's world is built round (ride.js plants trees and draws runs round a lift line): the bunny
// hill's own when it is a chair, else the nearest chair or gondola.
export function worldLift(R, spot) {
  const chairs = R.lifts.filter((l) => ["chair_lift", "gondola", "mixed_lift"].includes(l.kind) && l.pts.length >= 2);
  const d = (l) => Math.min(...l.pts.map(([x, z]) => Math.hypot(x - spot.x, z - spot.z)));
  return chairs.find((l) => l.name === spot.lift) || chairs.sort((a, b) => d(a) - d(b))[0] || null;
}
// Metres from (x, z) to a polyline.
function toLine(pts, x, z) {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1, t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / L2, 0, 1);
    d = Math.min(d, Math.hypot(ax + (bx - ax) * t - x, az + (bz - az) * t - z));
  }
  return d;
}
// Where you are on the lap: metres along it and metres off its line.
export function alongLap(pts, x, z) {
  let best = { s: 0, d: Infinity }, acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az) || 1;
    const t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (L * L), 0, 1), d = Math.hypot(ax + (bx - ax) * t - x, az + (bz - az) * t - z);
    if (d < best.d) best = { s: acc + t * L, d };
    acc += L;
  }
  return best;
}

// ---------- The lesson ----------
// Each step: what it is, what to do (one line, readable mid-run), what the coach says, how it starts (the board
// put at the top of the hill: off the fall line by `aim`, toward the heel side when > 0, at `v` m/s).
export const SPEED_GOAL = 18, LINKS = 3, STOP_IN = 12, STOP_FROM = 12; // km/h, edge changes, metres, km/h
export const STEPS = [
  { key: "hold", title: "握好手机", icon: "sliders", goal: "怎么舒服怎么握，点「开始」，现在的角度就是「平」", coach: "先站稳～手机怎么舒服怎么拿", aim: 90, v: 0 },
  { key: "speed", title: "加速", icon: "snowboard", goal: "板头朝坡下放平，手机往前倾（或手指往下拖），滑到 {v} km/h", coach: "板头朝下，放平，冲～", aim: 0, v: 0.5 },
  { key: "edge", title: "立刃转弯", icon: "groomed", goal: "手机左右倾就是立刃。先脚跟刃、再脚尖刃，各压住转过坡下那条线", coach: "压住刃别松，转过滚落线", aim: 50, v: 3 },
  { key: "link", title: "换刃", icon: "trailmap", goal: "连着转：脚跟、脚尖、脚跟……连续换刃 {n} 次", coach: "左一下，右一下，像画 S", aim: 35, v: 4 },
  { key: "brake", title: "减速刹车", icon: "challenge", goal: "滑到 {from} km/h 以上，手机往回倒（或手指往上拖）把板横过来，{m} 米内停住", coach: "板子横过来，脚跟踩住", aim: 0, v: 2 },
  { key: "catch", title: "吃刃", icon: "moguls", goal: "刹车横着滑时往脚尖猛压一下，感受吃刃；再用脚跟刃干净地停一次", coach: "下坡那条刃一插进雪里，就会绊一下", aim: 0, v: 2 },
  { key: "free", title: "自由练习", icon: "star", goal: "想练什么练什么，滑到底会送你回坡顶", coach: "自己玩吧，我在这儿看着", aim: 0, v: 1 },
];
export const stepOf = (key) => STEPS.find((s) => s.key === key) || STEPS[0];
export const goalText = (s, t = (x, v) => x.replace(/\{(\w+)\}/g, (_, k) => v[k])) => t(s.goal, { v: SPEED_GOAL, n: LINKS, from: STOP_FROM, m: STOP_IN });

// Which edge the rider is on: +1 heel, -1 toe, 0 flat. steer as board.js takes it (right +), heel: the way the
// heel side turns the board's nose (ride.js heelSide): a heel-side turn is one where −sign(steer) is heel.
export const EDGE_ON = 0.25;
export const edgeOf = (steer, heel) => (Math.abs(steer) < EDGE_ON ? 0 : -Math.sign(steer) === Math.sign(heel) ? 1 : -1);
// The board's angle to the fall line, signed (+ to the left of straight down), from its travel heading.
export const offFall = (heading, fall) => wrap(heading - fall);

// Turns: an edge held from one side of the fall line, across it, to the other (10°+ each side, still going down
// the hill, under 100° off it). Edge changes in a row: turns that alternate edges; the same edge twice, a stop or
// 8 s with no turn starts the count again.
export const TURN = { across: 10 * DEG, gap: 0.35, lapse: 8 };
export function newTurns() { return { side: 0, from: 0, gap: 0, last: 0, chain: 0, since: 0, heel: 0, toe: 0, still: 0 }; }
export function turnStep(s, { edge, off, speed, dt }) {
  s.since += dt;
  s.still = speed < 0.8 ? s.still + dt : 0;
  if (s.still > 1 || s.since > TURN.lapse) { s.chain = 0; s.last = 0; }
  if (edge !== s.side) {
    if (edge === 0 && s.side !== 0 && (s.gap += dt) < TURN.gap) return 0; // a flicker off the edge doesn't end the turn
    s.side = edge; s.gap = 0; s.from = Math.abs(off) >= TURN.across ? Math.sign(off) : 0;
    return 0;
  }
  s.gap = 0;
  if (!s.side) return 0;
  if (!s.from) { if (Math.abs(off) >= TURN.across) s.from = Math.sign(off); return 0; } // started straight down: not a crossing yet
  if (Math.sign(off) === -s.from && Math.abs(off) >= TURN.across && Math.abs(off) < 100 * DEG && speed > 1) {
    const side = s.side;
    s.from = 0; // the next one needs the next edge (or this one from the other side)
    s.chain = s.last && s.last !== side ? s.chain + 1 : 0;
    s.last = side; s.since = 0;
    if (side > 0) s.heel++; else s.toe++;
    return side;
  }
  return 0;
}

// The board across the way you go, and what it does (edge-core.js brakeOf): under 45° it glides, 45–90° it brakes,
// harder the further round; 80°+ is a full stop.
export function slipZone(slip) {
  const a = Math.abs(slip) / DEG, deg = a > 90 ? 180 - a : a;
  return { deg: Math.round(deg), k: brakeOf(deg * DEG), zone: deg < 45 ? "glide" : deg < 80 ? "brake" : "stop" };
}

// A stop: armed once you're going STOP_FROM km/h, timed from when the brake bites (board 45°+ across) to standing
// still (under 0.3 m/s for 0.4 s). Clean: inside STOP_IN metres, the board 60°+ across at some point, no caught
// edge. Letting off the brake for a second starts it again.
export function newStop() { return { armed: false, at: null, dist: 0, maxSlip: 0, caught: false, off: 0, still: 0, from: 0 }; }
export function stopStep(s, { speed, slip, caught, x, z, dt }) {
  const z0 = slipZone(slip);
  if (!s.armed) { if (speed * 3.6 >= STOP_FROM) s.armed = true; else return null; }
  if (!s.at) {
    if (z0.k > 0) { s.at = { x, z }; s.dist = 0; s.maxSlip = z0.deg; s.caught = false; s.off = 0; s.still = 0; s.from = speed; }
    return null;
  }
  s.dist = Math.hypot(x - s.at.x, z - s.at.z);
  s.maxSlip = Math.max(s.maxSlip, z0.deg);
  if (caught > 0.5) s.caught = true;
  s.off = z0.k > 0 || speed < 0.6 ? 0 : s.off + dt;
  if (s.off > 1) { Object.assign(s, newStop(), { armed: speed * 3.6 >= STOP_FROM }); return null; }
  s.still = speed < 0.3 ? s.still + dt : 0;
  if (s.still < 0.4) return null;
  const out = { ok: s.dist <= STOP_IN && s.maxSlip >= 60 && !s.caught, dist: +s.dist.toFixed(1), maxSlip: s.maxSlip, caught: s.caught, from: +(s.from * 3.6).toFixed(0) };
  Object.assign(s, newStop());
  return out;
}

// One step's check, fed the physics each frame. sample: { speed, heading, fall, slip (board − travel, signed),
// caught, steer, heel, x, z, dt }. Returns { done, parts: what's ticked so far, note: a line for the card }.
export function newCheck(key) { return { key, turns: newTurns(), stop: newStop(), caughtSeen: false, best: 0, parts: {}, done: false, last: null }; }
export function checkStep(c, s) {
  if (c.done) return c;
  const edge = edgeOf(s.steer, s.heel), off = offFall(s.heading, s.fall);
  const turned = turnStep(c.turns, { edge, off, speed: s.speed, dt: s.dt });
  c.edge = edge; c.off = off; c.zone = slipZone(s.slip);
  c.best = Math.max(c.best, s.speed * 3.6);
  const stopped = c.key === "brake" || c.key === "catch" ? stopStep(c.stop, s) : null;
  if (s.caught > 0.5 && !c.caughtSeen) { c.caughtSeen = true; c.parts.caught = true; }
  switch (c.key) {
    case "hold": break; // passed by the 开始 tap
    case "speed": if (s.speed * 3.6 >= SPEED_GOAL) c.done = true; break;
    case "edge":
      if (turned > 0) c.parts.heel = true;
      if (turned < 0) c.parts.toe = true;
      c.done = !!(c.parts.heel && c.parts.toe);
      break;
    case "link": c.parts.chain = Math.max(c.parts.chain || 0, c.turns.chain); c.done = c.turns.chain >= LINKS; break;
    case "brake": if (stopped) { c.last = stopped; c.done = stopped.ok; } break;
    case "catch": if (stopped) { c.last = stopped; if (c.caughtSeen && stopped.ok) { c.parts.clean = true; c.done = true; } } break;
    case "free": if (turned) c.parts.turns = (c.parts.turns || 0) + 1; break;
  }
  return c;
}

// ---------- Progress, kept on this phone ----------
// localStorage prerunPractice: { done: { <step key>: true }, at: the step last worked on }.
export const STORE = "prerunPractice";
export function loadProgress(storage) {
  try { const p = JSON.parse(storage.getItem(STORE) || "{}"); return { done: p.done && typeof p.done === "object" ? p.done : {}, at: STEPS.some((s) => s.key === p.at) ? p.at : null }; } catch { return { done: {}, at: null }; }
}
export function saveProgress(storage, p) { try { storage.setItem(STORE, JSON.stringify({ done: p.done, at: p.at })); } catch { /* storage off */ } }
// The first step not done yet (the free practice once all are).
export const nextStep = (p) => (STEPS.find((s) => s.key !== "free" && !p.done[s.key]) || STEPS[STEPS.length - 1]).key;
