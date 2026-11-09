// Route planner: runs go downhill, lifts go uphill, and a short skate links any two that touch.
// Pure functions (no three.js) so the planner can be tested on its own.

export const LEVELS = ["easy", "intermediate", "advanced", "expert"];
// Average speed on a run including short stops, m/s. Used only to estimate times.
const RUN_SPEED = { easy: 6, intermediate: 8, advanced: 7.5, expert: 6.5 };
const LIFT_SPEED = 4.5; // detachable chairs run about 5 m/s, fixed grips slower
const LIFT_WAIT = 90; // seconds in line and boarding
// The planner's pace, for estimates shown to the rider (labelled 估算: not measured).
export const PACE = { run: RUN_SPEED, lift: LIFT_SPEED, wait: LIFT_WAIT };
const JOIN = 80; // meters: close enough to skate from one element onto another

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function lengthAlong(pts, from, to) {
  let s = 0;
  for (let i = from + 1; i <= to; i++) s += dist(pts[i - 1], pts[i]);
  return s;
}

export function buildGraph(resort, heightAt) {
  const nodes = [];
  const edges = [];
  const add = (node) => {
    node.id = nodes.length;
    node.y = heightAt(node.x, node.z);
    nodes.push(node);
    edges.push([]);
    return node;
  };

  // Every run and lift end is a place where you can join or leave something else.
  const ends = [];
  for (const run of resort.runs) ends.push(run.pts[0], run.pts[run.pts.length - 1]);
  for (const lift of resort.lifts) ends.push(lift.pts[0], lift.pts[lift.pts.length - 1]);

  const runNodes = new Map();
  for (const run of resort.runs) {
    const last = run.pts.length - 1;
    const keys = new Set([0, last]);
    for (const end of ends) {
      let best = -1, bestD = JOIN;
      run.pts.forEach((p, i) => {
        const d = dist(p, end);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best >= 0) keys.add(best);
    }
    const list = [...keys].sort((a, b) => a - b).map((i) => add({ x: run.pts[i][0], z: run.pts[i][1], run, i }));
    for (let k = 1; k < list.length; k++) {
      const a = list[k - 1], b = list[k];
      const length = lengthAlong(run.pts, a.i, b.i);
      edges[a.id].push({ to: b.id, cost: length / RUN_SPEED[run.level], leg: { type: "run", run, from: a.i, to: b.i, length } });
    }
    runNodes.set(run, list);
  }

  const liftNodes = new Map();
  for (const lift of resort.lifts) {
    const pts = lift.pts;
    const bottom = add({ x: pts[0][0], z: pts[0][1], lift, end: "bottom" });
    const top = add({ x: pts[pts.length - 1][0], z: pts[pts.length - 1][1], lift, end: "top" });
    const length = lengthAlong(pts, 0, pts.length - 1);
    edges[bottom.id].push({ to: top.id, cost: LIFT_WAIT + length / LIFT_SPEED, leg: { type: "lift", lift, length } });
    liftNodes.set(lift, { bottom, top });
  }

  // Skate across to anything you can enter nearby without climbing more than a few meters.
  const enterable = nodes.filter((n) => (n.run && n.i < n.run.pts.length - 1) || n.end === "bottom");
  for (const a of nodes) {
    for (const b of enterable) {
      if (a === b || (a.run && a.run === b.run)) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < JOIN * 1.3 && b.y <= a.y + 6) edges[a.id].push({ to: b.id, cost: 10 + d / 2, leg: { type: "skate", length: d } });
    }
  }
  return { nodes, edges, runNodes, liftNodes };
}

// Cheapest route (by time) from any of `from` to any of `to`, using runs no harder than `maxLevel`.
export function planRoute(graph, from, to, maxLevel = "expert") {
  const cap = LEVELS.indexOf(maxLevel);
  const n = graph.nodes.length;
  const best = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const via = new Array(n);
  const done = new Uint8Array(n);
  const targets = new Set(to.map((node) => node.id));
  for (const node of from) best[node.id] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && best[i] < Infinity && (u < 0 || best[i] < best[u])) u = i;
    if (u < 0) return null;
    if (targets.has(u)) return toLegs(graph, u, prev, via, best[u]);
    done[u] = 1;
    for (const e of graph.edges[u]) {
      if (e.leg.type === "run" && LEVELS.indexOf(e.leg.run.level) > cap) continue;
      const c = best[u] + e.cost;
      if (c < best[e.to]) { best[e.to] = c; prev[e.to] = u; via[e.to] = e.leg; }
    }
  }
}

// Every cheapest way from `from` at once (Dijkstra over the whole graph, with a heap): for a lift's top that
// is asked the way to many places. lifts: false skis only (no lift legs). routeTo(to) is planRoute's answer
// for that target set, from the same tree.
export function planTree(graph, from, { maxLevel = "expert", lifts = true } = {}) {
  const cap = LEVELS.indexOf(maxLevel);
  const n = graph.nodes.length;
  const best = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const via = new Array(n);
  const done = new Uint8Array(n);
  const heap = []; // [cost, node], a binary min-heap
  const push = (c, u) => {
    heap.push([c, u]);
    for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  for (const node of from) { best[node.id] = 0; push(0, node.id); }
  while (heap.length) {
    const [c0, u] = pop();
    if (done[u] || c0 > best[u]) continue;
    done[u] = 1;
    for (const e of graph.edges[u]) {
      if (e.leg.type === "run" && LEVELS.indexOf(e.leg.run.level) > cap) continue;
      if (!lifts && e.leg.type === "lift") continue;
      const c = best[u] + e.cost;
      if (c < best[e.to]) { best[e.to] = c; prev[e.to] = u; via[e.to] = e.leg; push(c, e.to); }
    }
  }
  return {
    best,
    routeTo(to) {
      let u = -1;
      for (const node of to) if (best[node.id] < Infinity && (u < 0 || best[node.id] < best[u])) u = node.id;
      return u < 0 ? null : toLegs(graph, u, prev, via, best[u]);
    },
  };
}

function toLegs(graph, end, prev, via, seconds) {
  const raw = [];
  for (let v = end; prev[v] >= 0; v = prev[v]) raw.unshift(via[v]);
  // Join consecutive pieces of the same run; skates stay as their own short legs.
  const legs = [];
  for (const leg of raw) {
    const last = legs[legs.length - 1];
    if (last && leg.type === "run" && last.type === "run" && last.run === leg.run && last.to === leg.from) {
      last.to = leg.to;
      last.length += leg.length;
    } else legs.push({ ...leg });
  }
  return { legs: legs.filter((l) => l.type !== "skate" || l.length > 5), seconds, end: graph.nodes[end] };
}

// Nodes a place-based origin or destination maps onto.
export function nodesNear(graph, x, z, radius, filter = () => true) {
  const found = graph.nodes.filter((n) => Math.hypot(n.x - x, n.z - z) < radius && filter(n));
  if (found.length) return found;
  let nearest = null;
  for (const n of graph.nodes) if (filter(n) && (!nearest || Math.hypot(n.x - x, n.z - z) < Math.hypot(nearest.x - x, nearest.z - z))) nearest = n;
  return nearest ? [nearest] : [];
}
