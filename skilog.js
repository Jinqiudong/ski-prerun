// What you've skied, kept on this phone: for each resort, which stretches of which runs (by point index
// along each run, the runs' points being ~12 m apart), and the line of your last ride. From it: the
// stretches to draw on the journal map, and how much of the resort you've covered.
const KEY = "prerunLog";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };

export class SkiLog {
  constructor(resort, R) {
    this.resort = resort; this.R = R;
    const all = load(), mine = all[resort] || {};
    this.runs = new Map(Object.entries(mine.runs || {}).map(([id, list]) => [id, new Set(list)]));
    this.rides = mine.rides || 0;
    this.track = []; // this ride
    this.last = null; this.dirty = false; this.savedAt = 0;
  }
  // You're at point i of run (seen every half second): mark it, and fill the gap from the last mark on it.
  mark(run, i) {
    if (!run.name || run.area) return;
    const id = String(run.id);
    if (!this.runs.has(id)) this.runs.set(id, new Set());
    const set = this.runs.get(id);
    if (this.last && this.last.id === id && Math.abs(this.last.i - i) < 12) for (let k = Math.min(i, this.last.i); k <= Math.max(i, this.last.i); k++) set.add(k);
    else set.add(i);
    this.last = { id, i }; this.dirty = true;
  }
  step(x, z, now) {
    const t = this.track, p = t[t.length - 1];
    if (!p || Math.hypot(p[0] - x, p[1] - z) > 10) t.push([Math.round(x), Math.round(z)]);
    if (this.dirty && now - this.savedAt > 3000) this.save();
  }
  save(endRide = false) {
    if (endRide) this.rides++;
    const all = load();
    all[this.resort] = { runs: Object.fromEntries([...this.runs].map(([id, s]) => [id, [...s].sort((a, b) => a - b)])), rides: this.rides, stats: this.stats(), lastTrack: this.track.length > 1 ? this.track : all[this.resort]?.lastTrack || [] };
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* full */ }
    this.dirty = false; this.savedAt = performance.now();
  }
  // The stretches skied, as point lists to draw.
  stretches() {
    const out = [], byId = new Map(this.R.runs.map((r) => [String(r.id), r]));
    for (const [id, set] of this.runs) {
      const run = byId.get(id); if (!run) continue;
      const idx = [...set].sort((a, b) => a - b);
      let seg = [];
      for (let k = 0; k < idx.length; k++) {
        if (seg.length && idx[k] !== idx[k - 1] + 1) { if (seg.length > 1) out.push(seg); seg = []; }
        const p = run.pts[idx[k]]; if (p) seg.push(p);
      }
      if (seg.length > 1) out.push(seg);
    }
    return out;
  }
  // Named runs touched, out of all named runs; share of their length covered.
  stats() {
    const named = new Map();
    for (const r of this.R.runs) if (r.name && !r.area) { const n = named.get(r.name) || { len: 0, done: 0 }; n.len += r.pts.length; n.done += this.runs.get(String(r.id))?.size || 0; named.set(r.name, n); }
    let len = 0, done = 0, touched = 0;
    for (const n of named.values()) { len += n.len; done += Math.min(n.len, n.done); if (n.done > 0) touched++; }
    return { runs: named.size, touched, share: len ? done / len : 0, km: (done * 12) / 1000, rides: this.rides };
  }
}
