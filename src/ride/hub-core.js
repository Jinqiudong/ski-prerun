// The lift top's page (the hub), with no DOM: from a lift's top, every place you can ski to, grouped the
// way you think about it on the mountain:
//   same   再坐一次: back to this lift's own bottom;
//   change 换缆车: another lift up the mountain (the quickest first; `show` of them, the rest under 更多);
//   bases  滑到底，回村子: each base / village, with the lifts whose bottom is in it folded in ("有 X、Y"),
//          so those lifts are not listed again under change.
// Each place holds at most one way per difficulty (the hardest run on it): the quickest, timed with the
// planner's pace (route.js PACE, an estimate). Ski only: a way that needs another lift is not a way down.
// Used by ride.js (the page itself, and the chained "坐上去以后能去的" from the next lift's top); tested.
import { LEVELS, planTree, nodesNear } from "../core/route.js?v=7";

export const VILLAGE_R = 350; // m: a lift whose bottom is this close to a village leaves from that village
export const MAX_MIN = 20; // minutes: a lift further than this (by the quickest way) is not offered
export const SHOW = 4; // lifts shown under 换缆车 before 更多

// The lifts worth riding to from a top: not a carpet, and climbing at least 40 m (as the ride's other lists).
export const bigLift = (l) => l.kind !== "magic_carpet" && (l.rise ?? 100) >= 40;
const villagesOf = (R) => R.places.filter((p) => p.kind === "village");
const lvIx = (lv) => Math.max(0, LEVELS.indexOf(lv));

// A planner route as a way to show: its runs in order (pieces of one run merged), the hardest level, a key
// that tells two ways apart (the runs' ids in order), where it ends.
export function variantOf(rt, myLevel = "intermediate") {
  const runs = [];
  for (const l of rt.legs) {
    if (l.type === "lift") return null; // not a way down
    if (l.type !== "run") continue;
    const last = runs[runs.length - 1], id = l.run.id ?? l.run.name;
    if (last && last.id === id) continue;
    runs.push({ id, name: l.run.name || "", level: l.run.level });
  }
  if (!runs.length) return null;
  const level = LEVELS[Math.max(...runs.map((r) => lvIx(r.level)))];
  // The names to read out: unnamed connectors dropped, a name met again right after itself once.
  const names = [];
  for (const r of runs) if (r.name && names[names.length - 1]?.name !== r.name) names.push({ name: r.name, level: r.level });
  return { key: runs.map((r) => r.id).join(","), level, seconds: rt.seconds, legs: rt.legs, runs, names, end: [rt.end.x, rt.end.z], harder: lvIx(level) > lvIx(myLevel) };
}

// One way per level, the quickest of each; in level order (green first).
export function bestPerLevel(vs) {
  const by = new Map();
  for (const v of vs) if (v && (!by.has(v.level) || v.seconds < by.get(v.level).seconds)) by.set(v.level, v);
  return [...by.values()].sort((a, b) => lvIx(a.level) - lvIx(b.level));
}
// The way picked for you: the quickest within your level, else the easiest there is.
export const pickDefault = (vs) => vs.filter((v) => !v.harder).sort((a, b) => a.seconds - b.seconds)[0] || vs[0] || null;

// The trees from a top: one per level, ski only (lifts: false). Shared by every place asked about.
export function treesFrom(graph, from) {
  return LEVELS.map((lv) => planTree(graph, from, { maxLevel: lv, lifts: false }));
}
function waysTo(trees, to, myLevel) {
  const seen = new Set(), out = [];
  for (const tr of trees) {
    const v = variantOf(tr.routeTo(to) || { legs: [{ type: "lift" }] }, myLevel);
    if (v && !seen.has(v.key)) { seen.add(v.key); out.push({ ...v, to }); }
  }
  return out;
}

// The hub for `lift` (an entry of R.lifts): { lift, same, change, more, bases, all }.
// change holds every other lift in reach (sorted, quickest first); the page shows change.slice(0, show),
// `more` is how many are left for 更多.
export function liftHub(R, graph, lift, { level = "intermediate", show = SHOW, maxMin = MAX_MIN, villageR = VILLAGE_R } = {}) {
  const ln = graph.liftNodes.get(lift);
  if (!ln) return null;
  const trees = treesFrom(graph, [ln.top]);
  const villages = villagesOf(R);
  const dest = (kind, name, at, extra, to, vs) => {
    const variants = bestPerLevel(vs);
    if (!variants.length) return null;
    const best = pickDefault(variants);
    return { kind, key: `${kind === "base" ? "base" : "lift"}:${name}`, name, at, lifts: [], to, variants, best, seconds: best.seconds, ...extra };
  };
  const villageOf = (l) => villages.map((v) => ({ v, d: Math.hypot(v.x - l.pts[0][0], v.z - l.pts[0][1]) })).filter((o) => o.d < villageR).sort((a, b) => a.d - b.d)[0]?.v || null;

  // Back to this lift's bottom.
  const sameTo = [ln.bottom];
  const same = dest("same", lift.name, lift.pts[0], { lift }, sameTo, waysTo(trees, sameTo, level));

  // Each village: its own snow (run nodes and lift bottoms near it), and the lifts that leave from it.
  const bases = [];
  const byVillage = new Map();
  for (const v of villages) {
    const to = nodesNear(graph, v.x, v.z, 220, (n) => !!n.run || n.end === "bottom");
    byVillage.set(v, { to, ways: waysTo(trees, to, level), lifts: [] });
  }
  const change = [];
  for (const l of R.lifts) {
    if (l === lift || !bigLift(l) || !graph.liftNodes.get(l)) continue;
    const to = [graph.liftNodes.get(l).bottom], v = villageOf(l);
    if (v && byVillage.has(v)) { // folded into its village
      const b = byVillage.get(v);
      b.lifts.push(l.name);
      b.ways.push(...waysTo(trees, to, level).map((w) => ({ ...w, via: l.name })));
      continue;
    }
    const d = dest("lift", l.name, l.pts[0], { lift: l, top: l.pts[l.pts.length - 1] }, to, waysTo(trees, to, level));
    if (d && d.seconds <= maxMin * 60) change.push(d);
  }
  const sameVillage = villageOf(lift);
  for (const [v, b] of byVillage) {
    const d = dest("base", v.name, [v.x, v.z], { place: v }, b.to, b.ways);
    if (!d) continue;
    d.lifts = b.lifts.filter((n) => n !== lift.name);
    d.home = v === sameVillage; // this lift leaves from here too
    bases.push(d);
  }
  change.sort((a, b) => a.seconds - b.seconds || a.name.localeCompare(b.name));
  bases.sort((a, b) => a.seconds - b.seconds || a.name.localeCompare(b.name));
  return { lift, same, change, shown: change.slice(0, show), more: Math.max(0, change.length - show), bases, all: [same, ...change, ...bases].filter(Boolean) };
}

// "Center Village · 有 American Eagle、American Flyer": a village's line, its lifts named (up to `n`).
export function foldLabel(d, n = 2) {
  if (!d.lifts?.length) return d.name;
  return `${d.name} · 有 ${d.lifts.slice(0, n).join("、")}${d.lifts.length > n ? " 等" : ""}`;
}

// What the go button says for a place: 就滑这条 (back to this lift), 滑去坐 X (another lift), 滑回 X (a village).
// GO holds the templates ({x}: the place), for the page's i18n.
export const GO = { same: "就滑这条", lift: "滑去坐 {x}", base: "滑回 {x}" };
export const goLabel = (d) => (d ? GO[d.kind].split("{x}").join(d.name) : "");

// The chained leg, from the address (?to=, ?lv=, ?via=): which place and which level on this hub, if still
// here. key "base:X" / "lift:X" / "run:Name" (an older link: the way whose first run has that name).
export function findPlanned(hub, key, lv) {
  if (!hub || !key) return null;
  if (key.startsWith("run:")) {
    const name = key.slice(4);
    for (const d of hub.all) { const v = d.variants.find((w) => w.runs[0]?.name === name); if (v) return { dest: d, variant: v }; }
    return null;
  }
  const d = hub.all.find((x) => x.key === key || (x.kind === "same" && key === `lift:${x.name}`));
  if (!d) return null;
  return { dest: d, variant: d.variants.find((w) => w.level === lv) || d.best };
}

// The breadcrumb: the lifts ridden on this chain (from ?via=, comma separated, at most 3 kept), this one, and
// the next: a lift, a village, or ？ while open.
export function crumbOf(via, here, next) {
  const before = (via || "").split(",").map((s) => s.trim()).filter(Boolean).slice(-3);
  return [...before, here, next || "？"];
}
// The ?via= for the next lift's page: this chain's lifts so far, this one added.
export const viaNext = (via, here) => crumbOf(via, here, null).slice(0, -1).slice(-3).join(",");
