// What the resort page says about a lift, with no DOM (the owner's mock A2, 2026-11-17): the label by its
// top's pin (the seats, the runs that leave from the top by level, how many other lifts you can change to)
// and the card's one tip line (which lift to ride first at your level). Read from the route graph
// (route.js buildGraph) and the lift top's hub (hub-core.js liftHub); nothing here is made up: a lift with no
// seat count says its kind, a top with no named run says nothing. Tested on real resorts (tests/liftinfo.test.mjs).
import { LEVELS } from "../core/route.js?v=8";
import { liftHub, treesFrom, MAX_MIN } from "../ride/hub-core.js?v=2";

const lvIx = (lv) => LEVELS.indexOf(lv);
// The kind, when OpenStreetMap has no seat count: 吊箱 (a gondola, or a mixed lift of chairs and cabins), 吊椅.
export const KIND_ZH = { gondola: "吊箱", mixed_lift: "吊箱", cable_car: "缆车厢", chair_lift: "吊椅" };
export const seatsLabel = (lift) => (lift.seats > 0 ? `${lift.seats} 人` : KIND_ZH[lift.kind] || "缆车");
// A level's name as the trail map's colour (US): 绿道 蓝道 黑道 双黑; and the rider's level as chosen on the start page.
export const RUN_ZH = { easy: "绿道", intermediate: "蓝道", advanced: "黑道", expert: "双黑" };
export const LEVEL_ZH = { easy: "初级", intermediate: "中级", advanced: "高级", expert: "专家" };

// The named runs that leave straight from a lift's top: a run edge from the top's node, or one skate hop and
// then a run edge. One entry per name (a run met in pieces counts once, at its hardest piece), easy first.
export function topRuns(graph, lift) {
  const ln = graph.liftNodes.get(lift);
  if (!ln) return [];
  const runs = new Map();
  const take = (id) => {
    for (const e of graph.edges[id]) {
      if (e.leg.type !== "run" || !e.leg.run.name) continue;
      const { name, level } = e.leg.run, had = runs.get(name);
      if (!had || lvIx(level) > lvIx(had)) runs.set(name, level);
    }
  };
  take(ln.top.id);
  for (const e of graph.edges[ln.top.id]) if (e.leg.type === "skate") take(e.to);
  return [...runs].map(([name, level]) => ({ name, level })).sort((a, b) => lvIx(a.level) - lvIx(b.level) || a.name.localeCompare(b.name));
}
// { easy: 2, advanced: 1 }: only the levels there are, in level order.
export function countByLevel(runs) {
  const out = {};
  for (const lv of LEVELS) { const n = runs.filter((r) => r.level === lv).length; if (n) out[lv] = n; }
  return out;
}

// The other lifts you can ski to from this lift's top within MAX_MIN minutes: the hub's 换缆车 (each within
// MAX_MIN already) and the lifts folded into the villages (滑到底，回村子), each timed to its own bottom. Not the
// lift itself, no carpets (hub-core bigLift). At any level unless `level` is given: then only by runs at or
// under it. Quickest first: [{ name, seconds }].
export function changeLifts(R, graph, lift, { level = "expert", maxMin = MAX_MIN } = {}) {
  const hub = liftHub(R, graph, lift, { level: "expert", maxMin: Infinity });
  if (!hub) return [];
  const tree = treesFrom(graph, [graph.liftNodes.get(lift).top])[Math.max(0, lvIx(level))];
  const out = new Map();
  const names = [...hub.change.map((d) => d.name), ...hub.bases.flatMap((b) => b.lifts)];
  for (const name of names) {
    if (name === lift.name || out.has(name)) continue;
    const l = R.lifts.find((x) => x.name === name);
    const ln = l && l.kind !== "magic_carpet" && graph.liftNodes.get(l);
    const s = ln ? tree.best[ln.bottom.id] : Infinity;
    if (s <= maxMin * 60) out.set(name, s);
  }
  return [...out].map(([name, seconds]) => ({ name, seconds })).sort((a, b) => a.seconds - b.seconds || a.name.localeCompare(b.name));
}

// Everything the label needs: { seats: "6 人" | "吊箱", runs, counts, change }.
export function liftInfo(R, graph, lift) {
  const runs = topRuns(graph, lift);
  return { lift, seats: seatsLabel(lift), runs, counts: countByLevel(runs), change: changeLifts(R, graph, lift) };
}

// Which of a base's lifts to ride first at your level: the one with the most runs at or under your level
// leaving its top, the shorter ride when two tie. `lifts`: [{ lift, minutes }]. null when no lift has a run
// you can ski from its top (the tip says so instead).
export function recommend(R, graph, lifts, level = "intermediate") {
  const cap = Math.max(0, lvIx(level));
  let best = null;
  for (const { lift, minutes } of lifts) {
    const ok = topRuns(graph, lift).filter((r) => lvIx(r.level) <= cap);
    if (!ok.length) continue;
    if (!best || ok.length > best.ok.length || (ok.length === best.ok.length && minutes < best.minutes)) best = { lift, minutes, ok };
  }
  if (!best) return null;
  return { ...best, next: changeLifts(R, graph, best.lift, { level })[0]?.name || null };
}

// The tip's words (Chinese, as the mock): "第一次来？中级可以先坐 American Eagle，上去有 2 条蓝道，滑下来还能换
// Excelerator。" As parts, so the page can set the lift's name in bold: [text, { lift }, text].
export function tipParts(rec, level = "intermediate", { bunny = false } = {}) {
  const lv = LEVEL_ZH[level] || LEVEL_ZH.intermediate;
  if (!rec) {
    const tail = bunny ? "可以先去宝宝坡练习，或者换一个村子。" : "换一个村子看看。";
    return [`这里的缆车上去都没有${lv}能滑的道，${tail}`];
  }
  const c = countByLevel(rec.ok), runs = Object.entries(c).map(([k, n]) => `${n} 条${RUN_ZH[k]}`).join("、");
  return [`第一次来？${lv}可以先坐 `, { lift: rec.lift.name }, `，上去有 ${runs}${rec.next ? `，滑下来还能换 ${rec.next}` : ""}。`];
}
export const tipText = (rec, level, o) => tipParts(rec, level, o).map((p) => (typeof p === "string" ? p : p.lift)).join("");
