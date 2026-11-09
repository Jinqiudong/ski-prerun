// Audit a baked resort's map: do lifts go up, does every lift top have a way down, can every base reach the
// lifts and be skied back to, do runs go downhill and connect, what the lift-top page (hub-core) offers, and
// whether the lift names match the facility research and the resort's official lift list.
// Uses the planner itself (src/core/route.js) on the resort's own height grid, so it sees what the game sees.
//
// usage: node tools/audit_resorts.mjs [id ...] [--json out.json] [--official tools/official_lifts.json] [--quiet]
//   no ids: every resort in data/resorts.json that is ready. Exit code 1 when a structural check fails
//   (a reversed lift, a lift top with no way down, a base that reaches no lift).
// The functions are exported for tests/resorts.test.mjs.
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { buildGraph, planTree, nodesNear, LEVELS } from "../src/core/route.js";
import { liftHub, bigLift, VILLAGE_R } from "../src/ride/hub-core.js";

const ROOT = new URL("../", import.meta.url);
const SKATE = 80 * 1.3; // route.js: a skate link is this long at most (climbing at most 6 m)
const NEAR_MISS = 200; // m: an unlinked run end this close to something enterable is worth a look
const AT_BASE = 350; // m: a run ending this close to a village ends at the base (not a dead end)

const readJSON = (rel) => JSON.parse(readFileSync(new URL(rel, ROOT)));
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// The height grid, read as tests/route.test.mjs and the ride do.
export function heightFn(R) {
  const [gw, gh] = R.grid, [x0, z0, x1, z1] = R.bounds;
  const q = new Uint16Array(Uint8Array.from(Buffer.from(R.heights, "base64")).buffer);
  return (x, z) => {
    const c = Math.min(Math.max(((x - x0) / (x1 - x0)) * (gw - 1), 0), gw - 1.001);
    const r = Math.min(Math.max(((z - z0) / (z1 - z0)) * (gh - 1), 0), gh - 1.001);
    const i = Math.floor(r), j = Math.floor(c), fr = r - i, fc = c - j, h = (a, b) => q[a * gw + b] / 10;
    return h(i, j) * (1 - fc) * (1 - fr) + h(i, j + 1) * fc * (1 - fr) + h(i + 1, j) * (1 - fc) * fr + h(i + 1, j + 1) * fc * fr;
  };
}

export function loadResort(id) {
  const R = readJSON(`data/${id}.json`);
  const heightAt = heightFn(R);
  return { id, R, heightAt, graph: buildGraph(R, heightAt) };
}

const villagesOf = (R) => R.places.filter((p) => p.kind === "village");
const label = (l) => `${l.name} (${l.id})`;
const runLabel = (r) => `${r.name || "(unnamed)"} [${r.level}] (${r.id})`;
// Lifts a rider is offered: big ones (hub-core bigLift) — carpets and 40 m-or-less tows are left out of most checks.
const rideable = (l) => bigLift(l);

// Where a village's snow is, as hub-core asks it (runs and lift bottoms near it).
const villageNodes = (graph, v) => nodesNear(graph, v.x, v.z, 220, (n) => !!n.run || n.end === "bottom");
// Where you start from a village, as the planner's tests do.
const villageStart = (graph, v) => nodesNear(graph, v.x, v.z, 250);
const reached = (tree, nodes) => nodes.some((n) => tree.best[n.id] < Infinity);

// ---- 1-4: structure ---------------------------------------------------------------------------------------
export function structure({ R, heightAt, graph }) {
  const out = { lifts: [], reversed: [], flatLifts: [], stranded: [], orphan: [], runs: [], uphillRuns: [], deadEnds: [], nearMiss: [], unreachableRuns: [], strandingRuns: [], bases: [] };
  const villages = villagesOf(R);
  const allBottoms = R.lifts.map((l) => graph.liftNodes.get(l).bottom);
  const villageTo = villages.map((v) => villageNodes(graph, v)).flat();
  const downTargets = [...allBottoms, ...villageTo]; // a "way down" ends at some lift's bottom or a base

  // 1. Lift direction.
  for (const l of R.lifts) {
    const a = l.pts[0], b = l.pts[l.pts.length - 1], ha = heightAt(...a), hb = heightAt(...b);
    const row = { name: l.name, id: l.id, kind: l.kind, rise: Math.round(hb - ha), length: Math.round(d2(a, b)), rideable: rideable(l) };
    out.lifts.push(row);
    if (hb < ha - 2) out.reversed.push(row);
    else if (Math.abs(hb - ha) <= 2 && rideable(l)) out.flatLifts.push(row);
  }

  // 2. Lift ends. Tops: ski only (any level) to some lift's bottom or a base. Bottoms: from a base, with lifts.
  const fromBases = villages.length ? planTree(graph, villages.flatMap((v) => villageStart(graph, v))) : null;
  for (const l of R.lifts) {
    const ln = graph.liftNodes.get(l);
    const ski = planTree(graph, [ln.top], { lifts: false });
    const row = out.lifts.find((r) => r.id === l.id && r.name === l.name);
    row.wayDown = reached(ski, downTargets.filter((n) => n !== ln.top));
    // The easiest level that has a way down.
    row.downLevel = null;
    for (const lv of LEVELS) if (reached(planTree(graph, [ln.top], { lifts: false, maxLevel: lv }), downTargets)) { row.downLevel = lv; break; }
    // Any way back to a base at all (lifts allowed): "can you ever ride down from here".
    const anyway = planTree(graph, [ln.top]);
    row.backToBase = villages.length ? reached(anyway, villageTo) : null;
    row.fromBase = fromBases ? fromBases.best[ln.bottom.id] < Infinity : null;
    // What enters the bottom other than the lift itself: a run piece or a skate.
    row.bottomFed = graph.edges.some((es, u) => u !== ln.bottom.id && es.some((e) => e.to === ln.bottom.id));
    if (!row.wayDown) out.stranded.push(row);
    if (row.fromBase === false) out.orphan.push(row);
  }

  // 3. Runs.
  const indeg = new Array(graph.nodes.length).fill(0);
  graph.edges.forEach((es) => es.forEach((e) => indeg[e.to]++));
  for (const run of R.runs) {
    const p = run.pts, h0 = heightAt(...p[0]), h1 = heightAt(...p[p.length - 1]);
    const row = { name: run.name, id: run.id, level: run.level, area: !!run.area, drop: Math.round(h0 - h1), length: run.length };
    out.runs.push(row);
    if (h1 > h0 + 5) out.uphillRuns.push(row);
    const list = graph.runNodes.get(run), first = list[0], last = list[list.length - 1];
    const atBase = villages.some((v) => d2([v.x, v.z], p[p.length - 1]) < AT_BASE);
    const startCut = indeg[first.id] === 0; // nothing leads onto its top
    const endCut = graph.edges[last.id].length === 0 && !atBase; // nothing to go on to at its bottom
    if (startCut || endCut) {
      out.deadEnds.push({ ...row, startCut, endCut });
      if (endCut) {
        // The nearest thing it could have joined: another run's point or a lift bottom.
        let best = null;
        for (const other of R.runs) {
          if (other === run) continue;
          other.pts.forEach((q, i) => {
            if (i === other.pts.length - 1) return;
            const d = d2(q, p[p.length - 1]);
            if (!best || d < best.d) best = { d, what: `run ${runLabel(other)} @${i}`, climb: heightAt(...q) - h1 };
          });
        }
        for (const l of R.lifts) {
          const d = d2(l.pts[0], p[p.length - 1]);
          if (!best || d < best.d) best = { d, what: `lift ${label(l)} bottom`, climb: heightAt(...l.pts[0]) - h1 };
        }
        if (best && best.d < NEAR_MISS) out.nearMiss.push({ run: runLabel(run), to: best.what, d: Math.round(best.d), climb: Math.round(best.climb), lift: best.what.startsWith("lift"), why: best.d >= SKATE ? "too far to skate" : "climbs over 6 m" });
      }
    }
    if (fromBases && !list.some((n) => fromBases.best[n.id] < Infinity)) out.unreachableRuns.push(row);
    if (villages.length && !reached(planTree(graph, [last]), villageTo)) out.strandingRuns.push(row);
  }

  // 4. Bases: each reaches every rideable lift's top (with lifts) and is reached back from it.
  for (const v of villages) {
    const tree = planTree(graph, villageStart(graph, v)), to = villageNodes(graph, v);
    const cant = [], noReturn = [];
    for (const l of R.lifts.filter(rideable)) {
      const ln = graph.liftNodes.get(l);
      if (tree.best[ln.top.id] === Infinity) cant.push(l.name);
      if (!reached(planTree(graph, [ln.top]), to)) noReturn.push(l.name);
    }
    const reachesAny = R.lifts.some((l) => tree.best[graph.liftNodes.get(l).top.id] < Infinity && graph.liftNodes.get(l).top);
    out.bases.push({ name: v.name, reachesAny, cantReach: cant, noReturnFrom: noReturn });
  }
  return out;
}

// ---- 5: the lift-top page ---------------------------------------------------------------------------------
export function hubs({ R, heightAt, graph }) {
  const villages = villagesOf(R), notes = [];
  for (const lift of R.lifts.filter(rideable)) {
    const H = liftHub(R, graph, lift, { level: "expert" });
    const top = lift.pts[lift.pts.length - 1], bottom = lift.pts[0];
    const flags = [], info = [];
    if (!H || !H.all.length) flags.push("zero options");
    if (H && !H.same) {
      // An obvious return: a run starting near the top and ending near the bottom.
      const obvious = R.runs.filter((r) => d2(r.pts[0], top) < 200 && d2(r.pts[r.pts.length - 1], bottom) < 250);
      flags.push(`no 再坐一次${obvious.length ? ` (but ${obvious.map((r) => r.name || r.id).join(", ")} goes top→bottom)` : ""}`);
    }
    if (H) {
      // A lift offered by a long way round: the way skied is over 2.5 times the straight line (and a few
      // hundred metres at least), or close to the page's limit (hub-core MAX_MIN).
      for (const d of H.change) {
        const straight = d2(top, d.at), min = d.seconds / 60, skied = d.best.legs.reduce((s, l) => s + (l.length || 0), 0);
        if (min > 18 || (straight > 300 && skied / straight > 2.5))
          flags.push(`换缆车 ${d.name}: ${min.toFixed(1)} min, ${Math.round(skied)} m skied for ${Math.round(straight)} m straight`);
      }
      for (const b of H.bases) {
        const v = b.place, vh = heightAt(v.x, v.z);
        for (const n of b.lifts) {
          const l = R.lifts.find((x) => x.name === n), bh = heightAt(...l.pts[0]);
          if (bh - vh > 120) flags.push(`${n} folded into ${v.name} but its bottom is ${Math.round(bh - vh)} m above it`);
        }
      }
      // Not a fault by itself (a resort's other base can need a lift), so kept as information.
      const missingBases = villages.filter((v) => !H.bases.some((b) => b.place === v)).map((v) => v.name);
      if (missingBases.length) info.push(`no ski-only way to ${missingBases.join(", ")}`);
      if (!H.change.length && !H.bases.length) flags.push("no 换缆车 and no village");
    }
    notes.push({
      lift: lift.name, id: lift.id, flags, info,
      same: !!H?.same, change: H ? H.change.map((d) => `${d.name} ${Math.round(d.seconds / 60)}m`) : [],
      bases: H ? H.bases.map((b) => `${b.name}${b.lifts.length ? ` (${b.lifts.join(", ")})` : ""}`) : [],
    });
  }
  return notes;
}

// ---- 6: names against the official list, 7: against the facility research ---------------------------------
export const norm = (s) => s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[’']/g, "").replace(/\b(lift|express|chairlift|chair|quad|gondola|the)\b/g, "").replace(/[^a-z0-9]+/g, "");

export function official(R, list) {
  if (!list) return null;
  const ours = [...new Set(R.lifts.filter((l) => l.name && l.name !== "Lift").map((l) => l.name))];
  const names = list.lifts.map((l) => l.name);
  const renamed = (list.renamed || []).filter((r) => ours.includes(r.from));
  const gone = new Set([...(list.removed || []).map((r) => r.name), ...(list.not_public_or_other_resort || []).map((r) => r.name)]);
  const match = (a, b) => norm(a) === norm(b);
  const extra = ours.filter((n) => !names.some((m) => match(n, m)) && !renamed.some((r) => r.from === n));
  const missing = names.filter((m) => !ours.some((n) => match(n, m)) && !renamed.some((r) => match(r.to, m)));
  return { renamed, extra, missing, removed: extra.filter((n) => gone.has(n)), unknown: extra.filter((n) => !gone.has(n)) };
}

export function facilities(id, R) {
  const p = `data/facilities/${id}.json`;
  if (!existsSync(new URL(p, ROOT))) return null;
  const F = readJSON(p), mism = [], stale = [], absent = [];
  const excluded = new Set((readJSON("tools/resorts.json")[id]?.exclude || []).map(String)); // left out on purpose (bake.py)
  for (const [k, v] of Object.entries(F.lifts || {})) {
    const l = R.lifts.find((x) => String(x.id) === k);
    if (!l) { if (!excluded.has(k)) stale.push(`${v.name} (${k})`); }
    else if (v.name && norm(v.name) !== norm(l.name)) mism.push(`${k}: facilities "${v.name}" vs data "${l.name}"`);
  }
  for (const l of R.lifts.filter(rideable)) if (!F.lifts?.[String(l.id)]) absent.push(label(l));
  return { mismatch: mism, stale, absent };
}

// Other data keyed on run ids or lift names.
export function crossRefs(id, R) {
  const flats = readJSON("data/flats.json")[id] || {}, hikes = readJSON("data/hikes.json")[id] || [];
  const ids = new Set(R.runs.map((r) => String(r.id)));
  return {
    flatsMissingRun: Object.keys(flats).filter((k) => !ids.has(k)),
    hikesMissingLift: hikes.filter((h) => h.from && !R.lifts.some((l) => norm(l.name) === norm(h.from))).map((h) => `${h.name} from ${h.from}`),
  };
}

// Lifts baked into more than one resort (the boxes overlap: a neighbour's lift).
export function shared(ids) {
  const seen = new Map(), out = {};
  for (const id of ids) for (const l of readJSON(`data/${id}.json`).lifts) {
    const k = l.id;
    if (seen.has(k) && seen.get(k) !== id) { (out[id] ||= []).push(`${l.name} (${k}, also in ${seen.get(k)})`); (out[seen.get(k)] ||= []).push(`${l.name} (${k}, also in ${id})`); }
    else seen.set(k, id);
  }
  return out;
}

export function audit(id, officialLists) {
  const res = loadResort(id);
  return {
    id, name: res.R.name, lifts: res.R.lifts.length, runs: res.R.runs.length,
    structure: structure(res), hubs: hubs(res),
    official: official(res.R, officialLists?.[id]), facilities: facilities(id, res.R), refs: crossRefs(id, res.R),
  };
}

// ---- command line -----------------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
  const jsonOut = opt("--json"), offPath = opt("--official") || "tools/official_lifts.json";
  const quiet = args.includes("--quiet"); if (quiet) args.splice(args.indexOf("--quiet"), 1);
  const ids = args.length ? args : readJSON("data/resorts.json").filter((r) => r.ready).map((r) => r.id);
  const off = existsSync(new URL(offPath, ROOT)) ? readJSON(offPath) : null;
  const sh = shared(ids), all = [];
  let fail = 0;
  const say = (...a) => { if (!quiet) console.log(...a); };
  for (const id of ids) {
    const A = audit(id, off); A.sharedLifts = sh[id] || [];
    all.push(A);
    const S = A.structure;
    say(`\n=== ${A.name} (${id}): ${A.lifts} lifts, ${A.runs} runs ===`);
    say(`lifts: ${S.lifts.length - S.reversed.length} go up, reversed ${S.reversed.length}, flat ${S.flatLifts.length}`);
    for (const r of S.reversed) say(`  REVERSED ${r.name} (${r.id}) rise ${r.rise} m`);
    for (const r of S.flatLifts) say(`  flat ${r.name} (${r.id}) rise ${r.rise} m`);
    for (const r of S.stranded) say(`  STRANDED TOP ${r.name} (${r.id}) ${r.kind}${r.rideable ? "" : " (small)"}`);
    for (const r of S.orphan) say(`  orphan (no base reaches its bottom) ${r.name} (${r.id})`);
    for (const r of S.lifts.filter((r) => r.wayDown && r.backToBase === false)) say(`  no way back to any base from ${r.name}`);
    for (const r of S.lifts.filter((r) => r.rideable && r.downLevel && r.downLevel !== "easy")) say(`  ${r.name}: easiest way down is ${r.downLevel}`);
    say(`runs: ${S.runs.length}, uphill ${S.uphillRuns.length}, dead ends ${S.deadEnds.length} (start ${S.deadEnds.filter((d) => d.startCut).length}, end ${S.deadEnds.filter((d) => d.endCut).length}), unreachable ${S.unreachableRuns.length}, stranding ${S.strandingRuns.length}`);
    for (const r of S.uphillRuns) say(`  UPHILL ${runLabel(r)} drop ${r.drop} m`);
    for (const r of S.deadEnds.filter((d) => d.endCut)) say(`  end goes nowhere: ${runLabel(r)}`);
    for (const m of S.nearMiss) say(`  near miss: ${m.run} ends ${m.d} m from ${m.to} (climb ${m.climb} m: ${m.why})`);
    for (const r of S.strandingRuns) say(`  stranding: ${runLabel(r)}`);
    for (const b of S.bases) say(`base ${b.name}: ${b.reachesAny ? "reaches lifts" : "REACHES NO LIFT"}${b.cantReach.length ? `; can't reach ${b.cantReach.join(", ")}` : ""}${b.noReturnFrom.length ? `; no return from ${b.noReturnFrom.join(", ")}` : ""}`);
    for (const h of A.hubs.filter((h) => h.flags.length)) say(`hub ${h.lift}: ${h.flags.join("; ")}`);
    for (const h of A.hubs.filter((h) => h.info.length)) say(`  (hub ${h.lift}: ${h.info.join("; ")})`);
    if (A.official) say(`official: extra ${JSON.stringify(A.official.extra)} missing ${JSON.stringify(A.official.missing)} renamed ${JSON.stringify(A.official.renamed.map((r) => `${r.from}→${r.to}`))}`);
    else say("official: no list");
    if (A.facilities) say(`facilities: mismatch ${JSON.stringify(A.facilities.mismatch)} stale ${JSON.stringify(A.facilities.stale)} absent ${JSON.stringify(A.facilities.absent)}`);
    if (A.sharedLifts.length) say(`shared with a neighbour: ${A.sharedLifts.join("; ")}`);
    if (A.refs.flatsMissingRun.length || A.refs.hikesMissingLift.length) say(`refs: ${JSON.stringify(A.refs)}`);
    if (S.reversed.length || S.stranded.some((r) => r.rideable) || S.bases.some((b) => !b.reachesAny)) fail = 1;
  }
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(all, null, 1));
  process.exitCode = fail;
}
