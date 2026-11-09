// The roadbook's rules with no DOM (tested): a pre-run day's steps as legs. A leg is one lift ridden to its
// top and the way down after it: the runs you came to ski (real) and the ones that only take you somewhere
// (connectors). Legs group by area (the base each lift leaves from) and a leg that skis from one area to
// another is a transfer. Old days (before legs were recorded) are read too.
import { PACE } from "../core/route.js?v=7";

// What is written while riding (src/ride/ride.js), per day in localStorage prerunBook:
//   { k: "base", name }                      the base picked on the resort page
//   { k: "up", lift, id }                    reached the top of a lift (the lift really was ridden)
//   { k: "go", kind, title, to, first, next, segs, path, changed? }
//                                            the way down picked at the top: kind "run" (a run you came for)
//                                            or "lift" / "base" / "friend" (a place to get to); to: where;
//                                            first: the run's id for "run"; next: the lift the plan goes on by
//                                            (this way down ends at its bottom); segs: segsOf(); path: the plan
//   { k: "down", track }                     the bottom: the line really ridden, thinned
//   { k: "jump", to }                        skipped ahead on the map (the stretch wasn't ridden)
//   { k: "hike", name, mins, gain, gear }
// Old days also have { k: "lift", name } (written when a lift's page opened, ridden or not), { k: "top", at,
// options, chose }, { k: "route", segs: [{ n, l, m }], path, next, changed } and { k: "arrive", title }.

// A run you came to ski on the way to somewhere: a long stretch with real vertical counts as a run.
export const REAL = { len: 1000, drop: 250 };
// Track points closer than this are dropped; a gap wider than this is a jump (not ridden).
export const TRACK = { step: 20, gap: 120 };

// The planner's legs (src/core/route.js) down to the first lift as the book's segments: one per run, its id,
// name, level, the stretch (point indices a..b), length and drop. heightAt(x, z) → m.
export function segsOf(legs, heightAt) {
  const out = [];
  for (const l of legs) {
    if (l.type === "lift") break;
    if (l.type !== "run") continue;
    const r = l.run, last = out[out.length - 1];
    if (last && last.id === String(r.id) && last.b === l.from) { last.b = l.to; continue; }
    out.push({ id: String(r.id), n: r.name || "无名雪道", l: r.level, a: l.from, b: l.to });
  }
  for (const s of out) {
    const r = legs.find((l) => l.type === "run" && String(l.run.id) === s.id).run, pts = r.pts.slice(s.a, s.b + 1);
    let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const hs = pts.map(([x, z]) => heightAt(x, z));
    s.len = Math.round(len); s.drop = Math.max(0, Math.round(hs[0] - Math.min(...hs)));
  }
  return out;
}
// The line ridden, light enough to keep: a point every TRACK.step metres, whole metres.
export function thinTrack(track, step = TRACK.step) {
  const out = [];
  for (const p of track) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) >= step) out.push([Math.round(p[0]), Math.round(p[1])]); }
  const end = track[track.length - 1];
  if (end && out.length && out[out.length - 1] !== end && (out[out.length - 1][0] !== Math.round(end[0]) || out[out.length - 1][1] !== Math.round(end[1]))) out.push([Math.round(end[0]), Math.round(end[1])]);
  return out;
}
// A track in the pieces really ridden (a jump leaves a gap).
export function trackPieces(track, gap = TRACK.gap) {
  const out = []; let cur = [];
  for (const p of track || []) {
    const q = cur[cur.length - 1];
    if (q && Math.hypot(p[0] - q[0], p[1] - q[1]) > gap) { if (cur.length > 1) out.push(cur); cur = []; }
    cur.push(p);
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

// An old "top" choice's title → what kind of way down it was.
export function kindOfTitle(title = "") {
  let m;
  if ((m = /^接 (.+) 缆车$/.exec(title))) return { kind: "lift", to: m[1] };
  if ((m = /^再坐一趟 (.+)$/.exec(title))) return { kind: "lift", to: m[1] };
  if ((m = /^回 (.+)$/.exec(title))) return { kind: "base", to: m[1] };
  if (/身边/.test(title)) return { kind: "friend", to: null };
  return { kind: "run", to: null };
}
// Is this segment a run you came to ski? Picked as a run at the top: that run. Going somewhere: only a long
// stretch with real vertical (REAL).
export function isReal(go, seg) {
  if (!go) return false;
  if (go.kind === "run") return go.first != null && seg.id != null ? seg.id === String(go.first) : seg.n === go.title;
  return (seg.len || 0) >= REAL.len && (seg.drop || 0) >= REAL.drop;
}

// A day's steps → { start, legs, peeks, hikes }. A leg: { no, lift, id, go, segs (each with real), path,
// track, partial, end: { k: "lift" | "base", name } | null, old }.
export function legsOf(day) {
  const legs = [], peeks = [];
  let start = null, cur = null, pending = null;
  const open = (lift, id, old) => { cur = { lift, id: id != null ? String(id) : null, go: null, segs: [], path: null, track: null, partial: false, end: null, old: !!old, t: 0 }; legs.push(cur); return cur; };
  for (const s of day.steps || []) {
    if (s.k === "base") { if (!legs.length) start = s.name; continue; }
    if (s.k === "lift") { if (pending) peeks.push(pending); pending = s.name; continue; } // old: opened, maybe not ridden
    if (s.k === "up") { if (pending === s.lift) pending = null; open(s.lift, s.id, false).t = s.t || 0; continue; }
    if (s.k === "top") {
      if (pending && pending !== s.at) peeks.push(pending);
      pending = null;
      open(s.at, null, true).t = s.t || 0;
      cur.go = { ...kindOfTitle(s.chose), title: s.chose };
      continue;
    }
    if (!cur) { if (s.k === "hike") legs.push({ hike: true, name: s.name, mins: s.mins, gain: s.gain }); continue; }
    if (s.k === "go") {
      cur.next = s.next || null; // the plan goes on by lift from here: this way down ends at that lift
      if (s.changed && cur.go) {
        // replanned on the way (off the route, or a new place picked): the runs so far, then the new ones;
        // what kind of way down it was stays what was picked at the top
        cur.changed = true; cur.go.to = s.to ?? cur.go.to;
        const add = (s.segs || []).map((g) => ({ ...g })), last = cur.segs[cur.segs.length - 1];
        if (last && add[0] && last.id === add[0].id) { last.b = Math.max(last.b ?? 0, add[0].b ?? 0); last.len = Math.max(last.len || 0, add[0].len || 0); last.drop = Math.max(last.drop || 0, add[0].drop || 0); add.shift(); }
        cur.segs.push(...add); cur.path = [...(cur.path || []), ...(s.path || [])];
      } else {
        cur.go = { kind: s.kind, title: s.title, to: s.to ?? null, first: s.first ?? null };
        cur.segs = (s.segs || []).map((g) => ({ ...g })); cur.path = s.path || null;
      }
    } else if (s.k === "route") {
      if (!cur.go) cur.go = { kind: "run", title: s.title };
      if (s.changed) cur.changed = true;
      cur.segs = (s.segs || []).map((g) => ({ n: g.n, l: g.l, ...(g.m ? { m: 1 } : {}) })); cur.path = s.path || null;
      if (s.next) cur.next = s.next;
    } else if (s.k === "jump") cur.partial = true;
    else if (s.k === "down") cur.track = s.track || null;
    else if (s.k === "hike") legs.push({ hike: true, name: s.name, mins: s.mins, gain: s.gain });
  }
  if (pending) peeks.push(pending);
  // where each leg ended: the place picked at the top, else the lift ridden next
  const rides = legs.filter((l) => !l.hike);
  rides.forEach((l, i) => {
    for (const g of l.segs) g.real = isReal(l.go, g);
    const k = l.go?.kind;
    if (l.next) l.end = { k: "lift", name: l.next };
    else if ((k === "lift" || k === "base") && l.go.to) l.end = { k, name: l.go.to };
    else if (rides[i + 1]) l.end = { k: "lift", name: rides[i + 1].lift };
    l.no = i + 1;
  });
  return { start, legs, peeks: [...new Set(peeks)].filter((p) => !rides.some((l) => l.lift === p)), hikes: legs.filter((l) => l.hike) };
}

// Areas: which base each lift leaves from, when the resort has more than one (Winter Park and Mary Jane,
// Copper's villages). lifts: the resort's lifts ({ name, id, pts }), bases: [{ name, x, z }].
// A base's short name for a heading: "Mary Jane Base" → "Mary Jane".
export const areaName = (base) => String(base).replace(/\s+(base|base area|village base)$/i, "");
const nearestBase = (bases, [x, z]) => { let b = null, d = Infinity; for (const q of bases) { const e = Math.hypot(q.x - x, q.z - z); if (e < d) { d = e; b = q; } } return b; };
// A leg's last point: the end of its track, else of its plan, else of its last segment.
export function endPoint(leg, runsById = new Map()) {
  const tr = leg.track; if (tr?.length) return tr[tr.length - 1];
  const p = leg.path; if (p?.length) return p[p.length - 1];
  const s = leg.segs[leg.segs.length - 1], r = s && runsById.get(String(s.id));
  return r ? r.pts[Math.min(r.pts.length - 1, s.b ?? r.pts.length - 1)] : null;
}
// The day as blocks to show: { area, legs } and { xfer: leg, from, to }; area is null when there's only one.
export function blocksOf(legs, { lifts = [], bases = [], runsById = new Map() } = {}) {
  const rides = legs.filter((l) => !l.hike), multi = bases.length > 1;
  const liftOf = (l) => lifts.find((q) => (l.id != null && String(q.id) === l.id)) || lifts.find((q) => q.name === l.lift);
  for (const l of rides) {
    const lf = liftOf(l), a = multi && lf ? nearestBase(bases, lf.pts[0]) : null;
    l.area = a ? areaName(a.name) : null;
    // where it took you: the base it ended at, or the next lift's bottom (a run ending mid-mountain stays put)
    const end = l.end?.k === "base" ? bases.find((b) => b.name === l.end.name) : null;
    const ep = end ? [end.x, end.z] : l.end?.k === "lift" ? lifts.find((q) => q.name === l.end.name)?.pts[0] : null;
    const b = multi && ep ? nearestBase(bases, ep) : null;
    l.toArea = b ? areaName(b.name) : l.area;
  }
  const out = [];
  let block = null;
  for (const l of legs) {
    if (l.hike) { (block ||= (out.push({ area: null, legs: [] }), out[out.length - 1])).legs.push(l); continue; }
    if (multi && l.area && l.toArea && l.area !== l.toArea) { out.push({ xfer: l, from: l.area, to: l.toArea }); block = null; continue; }
    if (!block || (multi && block.area !== l.area)) { block = { area: multi ? l.area : null, legs: [] }; out.push(block); }
    block.legs.push(l);
  }
  // one area all day: no headings
  const areas = new Set(rides.flatMap((l) => [l.area, l.toArea]).filter(Boolean));
  if (areas.size < 2) for (const b of out) if (b.legs) b.area = null;
  return out;
}

// Estimated minutes (the planner's pace, not measured): the lift up (with the line) and the way down.
export function lapTimes(leg, liftLen) {
  const up = liftLen ? PACE.wait + liftLen / PACE.lift : null;
  const segs = leg.segs.filter((s) => s.len);
  const down = segs.length ? segs.reduce((t, s) => t + s.len / (PACE.run[s.l] || PACE.run.intermediate), 0) : null;
  const m = (s) => (s == null ? null : Math.max(1, Math.round(s / 60)));
  return { up: m(up), down: m(down), lap: up != null && down != null ? m(up + down) : null };
}

// Distance from p to a polyline.
export function near(pts, p) {
  let d = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const A = pts[i], B = pts[i + 1] || A, dx = B[0] - A[0], dz = B[1] - A[1], L = dx * dx + dz * dz;
    const k = L ? Math.max(0, Math.min(1, ((p[0] - A[0]) * dx + (p[1] - A[1]) * dz) / L)) : 0;
    d = Math.min(d, Math.hypot(A[0] + dx * k - p[0], A[1] + dz * k - p[1]));
  }
  return d;
}
// A segment's run and the stretch of it ridden: by id (new days), else the run of that name nearest the
// leg's plan (old days kept names only). → { run, pts } (both null when it can't be found).
export function runOfSeg(s, leg, runsById = new Map(), runsByName = new Map()) {
  let r = s.id != null ? runsById.get(String(s.id)) : null;
  if (r) return { run: r, pts: r.pts.slice(s.a ?? 0, (s.b ?? r.pts.length - 1) + 1) };
  const cands = runsByName.get(s.n) || [], ref = leg?.path?.length ? leg.path : null;
  r = ref ? cands.map((c) => [c, Math.min(...ref.map((p) => near(c.pts, p)))]).sort((x, y) => x[1] - y[1])[0]?.[0] : cands[0];
  return { run: r || null, pts: r?.pts || null };
}

// What the book's map draws: only what was ridden. lifts: [{ a, b, nos }] (straight, bottom to top, the legs'
// numbers); lines: [{ pts, level, real }] (the line really ridden where it was kept, else the plan, coloured
// by the segment each point is on); labels: the real runs' names; lodges: the bases set out from and ended at.
// runsById: Map id → run; runsByName: Map name → [run]; lifts: the resort's lifts; bases: [{ name, x, z }].
export function mapItems(day, { runsById = new Map(), runsByName = new Map(), lifts = [], bases = [] } = {}) {
  const { start, legs } = day, rides = legs.filter((l) => !l.hike);
  const liftOf = (l) => lifts.find((q) => l.id != null && String(q.id) === l.id) || lifts.find((q) => q.name === l.lift);
  const byLift = new Map(), out = { lifts: [], lines: [], labels: [], lodges: [] };
  for (const l of rides) {
    const lf = liftOf(l); if (!lf) continue;
    if (!byLift.has(lf)) { const it = { a: lf.pts[0], b: lf.pts[lf.pts.length - 1], nos: [] }; byLift.set(lf, it); out.lifts.push(it); }
    byLift.get(lf).nos.push(l.no);
  }
  const named = new Set();
  for (const l of rides) {
    // each segment's line on the snow: its stretch of its run (old days: the run of that name nearest the plan)
    const geo = l.segs.map((s) => ({ s, pts: runOfSeg(s, l, runsById, runsByName).pts })).filter((g) => g.pts?.length > 1);
    const src = l.track?.length > 1 ? trackPieces(l.track) : l.path?.length > 1 ? [l.path] : geo.map((g) => g.pts);
    for (const piece of src) {
      let cur = null, lastSeg = geo[0]?.s || null;
      for (const p of piece) {
        let best = null, bd = 50;
        for (const g of geo) { const d = near(g.pts, p); if (d < bd) { bd = d; best = g.s; } }
        const seg = best || lastSeg; lastSeg = seg;
        const real = !!seg?.real, level = seg?.l || "intermediate";
        if (!cur || cur.real !== real || cur.level !== level) { const prev = cur?.pts[cur.pts.length - 1]; cur = { pts: prev ? [prev] : [], level, real }; out.lines.push(cur); }
        cur.pts.push(p);
      }
    }
    for (const g of geo) if (g.s.real && !named.has(g.s.n)) { named.add(g.s.n); out.labels.push({ text: g.s.n, at: g.pts[Math.floor(g.pts.length / 2)] }); }
  }
  out.lines = out.lines.filter((x) => x.pts.length > 1);
  const ends = [start, ...rides.filter((l) => l.end?.k === "base").map((l) => l.end.name)];
  for (const n of new Set(ends)) { const b = bases.find((q) => q.name === n); if (b) out.lodges.push([b.x, b.z]); }
  return out;
}
