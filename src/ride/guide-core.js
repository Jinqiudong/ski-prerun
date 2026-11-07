// The guide's rules, with no DOM and no three.js (tested: tests/guide.test.mjs). A little animal on its own feet runs
// the route 15–25 m ahead of you: it waits (turned round, a word in a bubble) when you fall behind, holds at a
// junction's mouth until you're there, comes back when you go the wrong way. Sometimes it takes you off the route
// for a detour that finds a new spot (a line through the trees; moguls and powder are designed, not built), then
// back onto the route. guide.js draws it and talks; ride.js asks it each frame (and splices a detour in).

// ---------- Which animal guides ----------
// The resort's own (start/resort-tiles.js ANIMALS), unless it is white or cream and would vanish on the snow 20 m
// ahead (pika, hare, ptarmigan, bighorn): then the fox, orange. Never the one you ride as yourself.
export const SNOWY = ["pika", "hare", "ptarmigan", "sheep"];
export function guideAnimal(resortAnimal, mine) {
  const a = resortAnimal && !SNOWY.includes(resortAnimal) ? resortAnimal : "fox";
  if (a !== mine) return a;
  return mine === "fox" ? "marmot" : "fox";
}

// ---------- What it says ----------
// One pool per moment. {name}: the animal's name; the rest are said as they are.
export const LINES = {
  start: ["我是{name}，今天我带路！", "跟着{name}走，不会迷路～", "出发咯，跟紧我！", "{name}来带路啦"],
  lead: ["这边这边～", "跟紧我哦", "今天雪真好", "风好舒服～", "你滑得不错嘛", "看我的脚印走就对了", "前面一路顺～", "嘿嘿，追上我呀", "我闻到松树的味道了", "别看风景啦，看我～"],
  wait: ["慢慢来～", "跟上呀", "我在这儿等你", "不急不急～", "我在前面哦！", "喂～这边！", "等你一下下", "我不走，你慢慢滑"],
  resume: ["走咯！", "好嘞，继续！", "跟上啦～", "就是这样！"],
  turnL: ["前面要左转哦", "下个路口往左～", "等下靠左边！"],
  turnR: ["前面要右转哦", "下个路口往右～", "等下靠右边！"],
  atTurn: ["这边！", "从这儿进～", "看我，就是这条", "这个口子，别错过"],
  wrong: ["哎——不是那边！", "走错啦，回来回来～", "那边不对哦", "等等我！路在这边"],
  back: ["对啦，就是这条", "回来啦～", "好险好险", "嗯！跟着我"],
  crash: ["哎呀，没事吧？", "拍拍雪，再来～", "树也吓了一跳", "摔一下不算什么"],
  inTrees: ["小心树哦～", "低头，有树枝！", "跟着我的脚印走", "这里好安静", "松针掉进领子里了"],
  go: ["跟我来！", "走！钻树林咯～", "就这儿，进！"],
  no: ["好，下次再带你去～", "那我们走大路～"],
  unlock: ["找到啦！", "这是我们的秘密基地～", "记住这里哦"],
};
// A shuffled bag per pool: every line once before any comes back, never the same twice running.
export function lineBag(rand = Math.random) {
  const bags = {}, last = {};
  return (kind, vars) => {
    const pool = LINES[kind]; if (!pool?.length) return "";
    let bag = bags[kind];
    if (!bag?.length) {
      bag = bags[kind] = pool.map((_, i) => i);
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (bag.length > 1 && bag[bag.length - 1] === last[kind]) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    const i = bag.pop(); last[kind] = i;
    let s = pool[i];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
    return s;
  };
}

// ---------- Where it rides ----------
// Distances along the route, in metres. Close enough to read at a glance on a phone (it rides just beyond your
// rider), a little further when fast; closer still in the trees.
export const GAP = { min: 10, max: 16, trees: 14, wait: 36, resume: 18, slowFor: 3, chatter: [22, 40], waitAgain: 7 };
export const gapFor = (speed, inTrees = false) => (inTrees ? GAP.trees : Math.min(GAP.max, GAP.min + Math.max(0, speed) * 0.5));
export function newGuide(sR = 0) { return { s: sR + 12, v: 0, mode: "lead", t: 0, slow: 0, off: 0, chat: 30, told: new Set(), turn: null }; }
// One step. inp: { sR: you, along the route; speed; off: how far you are from the route; end: the route's length;
// turns: [{ s, bearing, key }] the way's turn-offs ahead (bearing > 0 is to the left); down: you're in the snow
// after a crash; inTrees; dt }. Moves g.s (where it is along the route; "back" means off the route, toward you)
// and returns what it wants to say: [kind] (see LINES).
export function guideStep(g, inp) {
  const { sR, speed = 0, off = 0, end = Infinity, turns = [], down = false, inTrees = false, dt } = inp, say = [];
  const to = (m) => { if (g.mode !== m) { g.mode = m; g.t = 0; } };
  g.t += dt;
  g.slow = speed < 1.5 && !down ? g.slow + dt : 0;
  g.off = off > 32 ? g.off + dt : 0;
  // The wrong way: it comes back toward you, until you're near the route again.
  if (g.mode === "back") {
    if (off < 18) { to("lead"); g.s = Math.max(g.s, sR + 6); say.push("back"); }
    return say;
  }
  if (g.off > 1.5) { to("back"); g.turn = null; say.push("wrong"); return say; }
  const gap = g.s - sR, want = gapFor(speed, inTrees);
  // The turn-off coming up: said once, from about 90 m out.
  const next = turns.find((j) => j.s > sR - 5);
  if (next && next.s - sR < 90 && !g.told.has(next.key)) { g.told.add(next.key); if (Math.abs(next.bearing) > 0.18) say.push(next.bearing > 0 ? "turnL" : "turnR"); }
  if (g.mode === "turn") {
    // Holding at the mouth of the right way until you're nearly there.
    if (!g.turn || sR > g.turn.s - 12) { g.turn = null; to("lead"); }
    else { g.v = 0; if (g.t > GAP.waitAgain && gap > 30) { g.t = 0; say.push("wait"); } return say; }
  }
  if (g.mode === "wait") {
    g.v = 0;
    if (gap < GAP.resume - 8 || (speed > 2.5 && gap < 30)) { to("lead"); if (Math.random() < 0.6) say.push("resume"); } // you're riding up to it
    else if (g.t > GAP.waitAgain) { g.t = 0; say.push(down ? "crash" : "wait"); }
    return say;
  }
  // Leading: as fast as you, a little faster to open the gap, slower to close it. You down in the snow, or
  // stopped a while, or far behind: it stops and turns round.
  if (gap > GAP.wait || (g.slow > GAP.slowFor && gap > 8) || (down && gap > 6)) { to("wait"); say.push(down ? "crash" : "wait"); g.v = 0; return say; }
  if (next && next.turnHere !== false && next.s - g.s < 10 && next.s - sR > 14) { g.turn = next; to("turn"); g.s = Math.min(Math.max(g.s, next.s), end); say.push("atTurn"); return say; }
  g.v = Math.max(0, Math.min(speed + 6, speed + (want - gap) * 0.8));
  if (gap < 3) g.v = speed + 8; // you caught it up: it scoots on
  g.s = Math.min(end - 2, Math.max(g.s + g.v * dt, sR + 2));
  if ((g.chat -= dt) < 0) { g.chat = GAP.chatter[0] + Math.random() * (GAP.chatter[1] - GAP.chatter[0]); say.push(inTrees ? "inTrees" : "lead"); }
  return say;
}
// How much the gold arrowheads on the snow show (0.2..1): faint while the guide is in sight and leading you, full
// near a turn-off, when it has gone back for you, or when you're off the route.
export function arrowAlpha({ mode, toTurn = Infinity, off = 0, seen = true }) {
  if (!seen || mode === "back" || off > 25) return 1;
  if (toTurn < 80) return 1;
  if (toTurn < 140) return 0.2 + 0.8 * (1 - (toTurn - 80) / 60);
  return 0.2;
}

// ---------- Detours ----------
// The side quests the guide can lead you on. Only the trees are built; moguls and powder are hooks for later: a
// detour has a key, a kind of spot it unlocks, its spot's name, and how it is found along the route (find).
// spot(run, tr): its name, through tr (i18n.js t) when shown.
const fill = (s, v) => Object.entries(v).reduce((a, [k, x]) => a.split(`{${k}}`).join(x), s);
export const DETOURS = [
  { key: "trees", ready: true, icon: "trees", spot: (run, tr = fill) => tr("{run} 旁的松林", { run: run || "雪道" }), offer: "要不要钻一下树林？", find: (o) => findTreeLine(o) },
  // 天塌了，误入蘑菇道: off onto a nearby mogul run (snow-core.js MogulField) for a stretch, back at its foot.
  { key: "moguls", ready: false, icon: "moguls", spot: (run, tr = fill) => tr("{run} 的蘑菇阵", { run: run || "雪道" }), offer: "敢不敢试试蘑菇？", find: () => null },
  // 滑进深粉: across to where powder lies deepest beside the run (snow-core.js powderField) and back.
  { key: "powder", ready: false, icon: "powder", spot: (run, tr = fill) => tr("{run} 边的深粉", { run: run || "雪道" }), offer: "那边有深粉，去不去？", find: () => null },
];
// How often: once a run at most, never in the first 120 m or the last 200 m, never near a turn-off, not two
// within three minutes; a place not yet found more often (65%) than one you know (20%). force: "trees" (?detour=trees)
// always, "0" never.
export const DETOUR = { first: 120, last: 200, chanceNew: 0.65, chanceKnown: 0.2, gapSec: 180, nearTurn: 70 };
export function wantDetour({ known, sinceLast = Infinity, force = null, rand = Math.random }) {
  if (force === "0") return false;
  if (force) return true;
  if (sinceLast < DETOUR.gapSec) return false;
  return rand() < (known ? DETOUR.chanceKnown : DETOUR.chanceNew);
}

const smooth = (u) => u * u * (3 - 2 * u);
// The route at distance s: point and heading. path: [[x, z]], dist: metres along it.
export function pointAt(path, dist, s, i0 = 0) {
  let i = Math.max(0, Math.min(i0, path.length - 2));
  while (i > 0 && dist[i] > s) i--;
  while (i < path.length - 2 && dist[i + 1] < s) i++;
  const t = Math.max(0, Math.min(1, (s - dist[i]) / (dist[i + 1] - dist[i] || 1))), [ax, az] = path[i], [bx, bz] = path[i + 1];
  return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, h: Math.atan2(bx - ax, bz - az), i };
}
export const indexAt = (dist, s) => { let i = 0; while (i < dist.length - 1 && dist[i + 1] <= s) i++; return i; };

// A line through the trees beside the route: it leaves the route at a, swings 20–35 m out to one side into the
// woods, runs among the trees, and comes back onto the route at b. Each candidate's line is threaded between the
// trunks (a best path over sideways nudges of up to 5 m, 1 m per 3 m, as far from them as it can, up to 5 m); it
// must keep 2.4 m clear of every trunk, have the woods close round it, and never climb. Of those, the most wooded
// with the widest gaps (a line you can ride, not a slalom of near misses):
// { a, b, pts, side, woods, clear, s0, L } or null. treesNear(x, z, r) → [{ x, z }]; height(x, z); avoid: [[s0, s1]] stretches to keep out of (turn-offs).
export function findTreeLine({ path, dist, from, to, treesNear, height, avoid = [], lengths = [150, 190], outs = [22, 32], step = 20 }) {
  const total = dist[dist.length - 1];
  let best = null;
  const clearAt = (x, z) => { let c = 9; for (const t of treesNear(x, z, 9)) c = Math.min(c, Math.hypot(t.x - x, t.z - z)); return c; };
  for (let s0 = from; s0 <= to; s0 += step) for (const L of lengths) {
    if (s0 + L > total - 20) continue;
    if (avoid.some(([p, q]) => s0 - 30 < q && s0 + L + 30 > p)) continue;
    for (const D of outs) for (const side of [1, -1]) {
      const n = Math.round(L / 3), base = [];
      for (let k = 1; k < n; k++) {
        const u = k / n, p = pointAt(path, dist, s0 + u * L), o = side * D * (u < 0.28 ? smooth(u / 0.28) : u > 0.72 ? smooth((1 - u) / 0.28) : 1);
        base.push({ u, x: p.x + Math.cos(p.h) * o, z: p.z - Math.sin(p.h) * o, nx: Math.cos(p.h), nz: -Math.sin(p.h) });
      }
      // Open snow out there: not worth threading (most candidates stop here; the search runs on a phone).
      const near = new Set();
      for (let k = 0; k < base.length; k += 4) if (base[k].u > 0.3 && base[k].u < 0.7) for (const t of treesNear(base[k].x, base[k].z, 10)) near.add(t);
      if (near.size < 6) continue;
      // Threading it: Viterbi over nudges -5..5 m; near the ends (on the run) the nudge is held to 0.
      const N = 11, score = [], from_ = [];
      for (let k = 0; k < base.length; k++) {
        const b = base[k], lim = Math.min(5, Math.floor(Math.min(b.u, 1 - b.u) * 40)), sc = new Float32Array(N).fill(-1e9), fr = new Int8Array(N);
        for (let j = 0; j < N; j++) {
          const o = j - 5; if (Math.abs(o) > lim) continue;
          const c = Math.min(5, clearAt(b.x + b.nx * o, b.z + b.nz * o)), here = c < 2.4 ? -50 : c - Math.abs(o) * 0.05;
          if (!k) { sc[j] = here; continue; }
          let bj = -1, bv = -1e9;
          for (const d of [-1, 0, 1]) { const q = j + d; if (q >= 0 && q < N && score[k - 1][q] > bv) { bv = score[k - 1][q]; bj = q; } }
          sc[j] = bv + here; fr[j] = bj;
        }
        score.push(sc); from_.push(fr);
      }
      let j = 0; for (let q = 1; q < N; q++) if (score[score.length - 1][q] > score[score.length - 1][j]) j = q;
      const nud = new Array(base.length);
      for (let k = base.length - 1; k >= 0; k--) { nud[k] = j - 5; j = from_[k][j]; }
      let pts = base.map((b, k) => [b.x + b.nx * nud[k], b.z + b.nz * nud[k]]);
      pts = pts.map((p, k) => (k === 0 || k === pts.length - 1 ? p : [(pts[k - 1][0] + 2 * p[0] + pts[k + 1][0]) / 4, (pts[k - 1][1] + 2 * p[1] + pts[k + 1][1]) / 4]));
      // Check it: clear of trunks all along, wooded in the middle, downhill (never more than 0.4 m up over 6 m).
      let clear = 9, ok = true; const seen = new Set();
      for (let k = 0; k < pts.length && ok; k++) {
        const [x, z] = pts[k], c = clearAt(x, z), u = base[k].u;
        if (c < (u > 0.12 && u < 0.88 ? 2.4 : 1.8)) ok = false;
        clear = Math.min(clear, c);
        if (u > 0.2 && u < 0.8) for (const t of treesNear(x, z, 10)) seen.add(t);
        if (k >= 2 && height(x, z) > height(pts[k - 2][0], pts[k - 2][1]) + 0.4) ok = false;
      }
      const woods = seen.size;
      if (!ok || woods < 10) continue;
      const sc = woods + clear * 6;
      if (!best || sc > best.sc) best = { a: indexAt(dist, s0), b: indexAt(dist, s0 + L) + 1, pts, side, woods, clear: +clear.toFixed(2), s0, L, sc };
    }
  }
  if (!best) return null;
  // The route's own points a and b stay; the line runs between them.
  best.pts = best.pts.filter(([x, z]) => Math.hypot(x - path[best.a][0], z - path[best.a][1]) > 2 && Math.hypot(x - path[best.b][0], z - path[best.b][1]) > 2);
  return best;
}

// A plan (ride.js makePlan) with a detour spliced in: path[0..a], the detour's points, path[b..]. Indices past the
// detour move (segs, flats; the caller's junctions: shift); flats inside it go. orig: the plan without it.
export function splicePlan(P, a, b, pts, height) {
  const path = [...P.path.slice(0, a + 1), ...pts, ...P.path.slice(b)];
  const dist = [0];
  for (let i = 1; i < path.length; i++) dist.push(dist[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const m = pts.length, delta = a + 1 + m - b, shift = (i) => (i >= b ? i + delta : i > a ? a : i);
  return {
    ...P, path, dist, hs: path.map(([x, z]) => height(x, z)), length: dist[dist.length - 1],
    segs: P.segs.map((g) => ({ ...g, at: shift(g.at) })),
    flats: P.flats.filter((f) => f.b <= a || f.a >= b).map((f) => ({ ...f, a: shift(f.a), b: shift(f.b) })),
    detour: { a, b: a + m + 1, m }, orig: P, shift, unshift: (i) => (i >= a + 1 + m ? i - delta : i > a ? a : i),
  };
}

// ---------- Spots found ----------
// In localStorage "prerunSpots": { [resort]: [{ key, kind, name, x, z, at }] }. storage: localStorage or a stand-in.
const SPOTS = "prerunSpots";
export const spotKey = (kind, x, z) => `${kind}:${Math.round(x / 60)},${Math.round(z / 60)}`;
export function loadSpots(storage, resort) {
  try { const all = JSON.parse(storage.getItem(SPOTS) || "{}"); return Array.isArray(all[resort]) ? all[resort] : []; } catch { return []; }
}
// Adds one; returns true if it is new.
export function addSpot(storage, resort, spot) {
  let all = {};
  try { all = JSON.parse(storage.getItem(SPOTS) || "{}") || {}; } catch {}
  const list = Array.isArray(all[resort]) ? all[resort] : [];
  if (list.some((s) => s.key === spot.key)) return false;
  list.push({ key: spot.key, kind: spot.kind, name: spot.name, x: Math.round(spot.x), z: Math.round(spot.z), at: spot.at ?? Date.now() });
  all[resort] = list;
  try { storage.setItem(SPOTS, JSON.stringify(all)); } catch {}
  return true;
}
export const knownSpot = (storage, resort, key) => loadSpots(storage, resort).some((s) => s.key === key);
