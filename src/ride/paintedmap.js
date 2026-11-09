// The painted map (approved 2026-11-05): the resort's watercolour (assets/wc/<id>.jpg) with its runs inked
// where they fall on it (data/vista/<id>.json, baked by tools/bake_vista_lines.mjs).
// Small: a round cut-out in the corner around you with "已滑 N%"; tap it for the sheet: the whole painting
// (pinch and pan), how much of each level you've skied, the people; tap anywhere to start from there, tap a
// run for its name and level. Skied runs are clean coloured ink on a thin paper casing, the rest a faint
// pencil dash. People are their own avatars (assets/icons/av_*.png); ones that overlap gather into one
// bubble with "+N" (tap it and they fan out; zoom in and they separate). You are always on top, ringed red.
import { t, myAvatar } from "../core/i18n.js?v=48";

const INK = { easy: "#2e8b4f", intermediate: "#2a5db0", advanced: "#1c1f25", expert: "#1c1f25" };
const LEVELS = [["easy", "绿道"], ["intermediate", "蓝道"], ["advanced", "黑道"], ["expert", "双黑"]];
const RED = "#b6463b", NAVY = "#22344d", PAPER = "#fbf7ee";
const MINI_SPAN = 150; // painting pixels across the corner map
const dist2Seg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return [Math.hypot(ax + dx * k - px, ay + dy * k - py), k];
};

export class PaintedMap {
  // o: resort, R, log (SkiLog), me() → {x, z} or null, route() → the planned way [[x, z]…], track() → this
  // ride [[x, z]…], rideable(lift), routeName() → where the route goes, onGo(choice) with choice
  // { spot: {run, i}, at } or { lift, at }, onMore(); for friends onFind(person), onFollow(person) (no-ops for now).
  constructor(o) {
    Object.assign(this, { route: () => [], track: () => [], routeName: () => "", rideable: () => true, onMore() {}, onFind() {}, onFollow() {} }, o);
    this.ok = false; this.isOpen = false; this.people = []; this.faces = new Map(); this.fan = null; this.choice = null;
    this.v = { s: 1, ox: 0, oy: 0, fit: 1 }; this.ptrs = new Map(); this.refreshedAt = -1e9;
    this.dom();
    this.ready = this.load().catch(() => (this.ok = false));
  }

  async load() {
    const [V, img] = await Promise.all([
      fetch(`data/vista/${this.resort}.json?v=2`).then((r) => (r.ok ? r.json() : null)),
      new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = `assets/wc/${this.resort}.jpg?v=1`; }),
    ]);
    if (!V?.grid) return;
    this.V = V; this.img = img; this.W = V.w; this.H = V.h;
    // Each run's line on the painting, and which of the run's points each painting point stands for (the
    // bake keeps every other point and the last).
    this.lines = [];
    for (const run of this.R.runs) {
      const pts = V.runs[run.id]; if (!pts || run.area || pts.length < 2) continue;
      let kept = run.pts.map((_, i) => i).filter((i, _, a) => i % 2 === 0 || i === run.pts.length - 1);
      if (kept.length !== pts.length) kept = pts.map((_, j) => Math.round((j * (run.pts.length - 1)) / (pts.length - 1)));
      this.lines.push({ run, pts, kept });
    }
    this.lifts = this.R.lifts.filter((l) => V.lifts[l.id] && l.kind !== "magic_carpet").map((lift) => ({ lift, a: V.lifts[lift.id][0], b: V.lifts[lift.id][1] }));
    this.ok = true;
    this.refresh(true);
  }

  // Ground (x, z) → painting pixel, from the baked grid of the terrain's projection.
  toPaint(x, z) {
    const g = this.V.grid, fi = Math.min(g.n - 1.0001, Math.max(0, ((x - g.x0) / (g.x1 - g.x0)) * (g.n - 1))), fj = Math.min(g.m - 1.0001, Math.max(0, ((z - g.z0) / (g.z1 - g.z0)) * (g.m - 1)));
    const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j, P = (ii, jj, k) => g.uv[(jj * g.n + ii) * 2 + k];
    return [0, 1].map((k) => (P(i, j, k) * (1 - a) + P(i + 1, j, k) * a) * (1 - b) + (P(i, j + 1, k) * (1 - a) + P(i + 1, j + 1, k) * a) * b);
  }

  // What you've skied, as painted stretches; the share and each level's runs. Cheap; at most once a second.
  refresh(force = false) {
    if (!this.ok || (!force && performance.now() - this.refreshedAt < 1000)) return;
    this.refreshedAt = performance.now();
    const marks = this.log.runs, segs = [], lv = Object.fromEntries(LEVELS.map(([k]) => [k, { all: new Set(), done: new Set() }]));
    for (const L of this.lines) {
      const set = marks.get(String(L.run.id)), n = L.pts.length, on = new Array(n).fill(false);
      if (set?.size) for (let j = 0; j < n; j++) { const to = j < n - 1 ? L.kept[j + 1] : L.kept[j] + 1; for (let i = L.kept[j]; i < to; i++) if (set.has(i)) { on[j] = true; break; } }
      let seg = null;
      for (let j = 0; j < n; j++) {
        if (on[j]) { if (!seg) { seg = { level: L.run.level, pts: [] }; segs.push(seg); } seg.pts.push(L.pts[j]); }
        else if (seg) { if (seg.pts.length < 2) seg.pts.push(L.pts[j]); seg = null; }
      }
      if (seg && seg.pts.length < 2 && n > 1) seg.pts.unshift(L.pts[n - 2]);
      const k = lv[L.run.level] && L.run.name ? lv[L.run.level] : null;
      if (k) { k.all.add(L.run.name); if (set?.size) k.done.add(L.run.name); }
    }
    this.segs = segs; this.levels = lv;
    const s = this.log.stats(); this.stats = s;
    this.miniChip.textContent = t("已滑 {p}%", { p: Math.round(s.share * 100) });
    this.mini.style.setProperty("--share", Math.min(1, s.share).toFixed(3)); this.mini.title = this.miniChip.textContent; // the ring round it (ride-paper.css)
    if (this.isOpen) this.fillSheet();
  }

  // Friends' faces, for when we see them live: [{ id, avatar, name, x, z, where? }].
  setPeople(list) { this.people = (list || []).filter((p) => p && p.id !== "me"); if (this.isOpen) this.fillPeople(); }

  face(name) {
    let im = this.faces.get(name);
    if (!im) { im = new Image(); im.src = `assets/icons/${name}.png?v=1`; this.faces.set(name, im); }
    return im.complete && im.naturalWidth ? im : null;
  }

  // ---------- Drawing (canvas pixels; painting → canvas is p * s + o) ----------
  path(g, pts, s, ox, oy, smooth) {
    let lx = Infinity, ly = Infinity; const q = [];
    for (const [u, v] of pts) { const x = u * s + ox, y = v * s + oy; if (Math.hypot(x - lx, y - ly) >= 1.2 || q.length === 0) { q.push([x, y]); lx = x; ly = y; } }
    const [ex, ey] = [pts[pts.length - 1][0] * s + ox, pts[pts.length - 1][1] * s + oy];
    if (q.length < 2) q.push([ex, ey]); else q[q.length - 1] = [ex, ey];
    g.beginPath(); g.moveTo(...q[0]);
    if (!smooth || q.length < 3) { for (let i = 1; i < q.length; i++) g.lineTo(...q[i]); return; }
    // Through the midpoints, each point a control: a clean, smooth line with no corners or wobble.
    for (let i = 1; i < q.length - 1; i++) g.quadraticCurveTo(q[i][0], q[i][1], (q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2);
    g.lineTo(...q[q.length - 1]);
  }

  paint(g, s, ox, oy, dpr, big) {
    g.drawImage(this.img, ox, oy, this.W * s, this.H * s);
    g.lineCap = g.lineJoin = "round";
    // Not skied yet: a faint pencil dash.
    g.setLineDash([3 * dpr, 2.6 * dpr]); g.strokeStyle = "rgba(58,60,68,.5)"; g.lineWidth = Math.max(0.7, Math.min(1.3, 0.45 * s)) * dpr;
    for (const L of this.lines) { this.path(g, L.pts, s, ox, oy, false); g.stroke(); }
    // Lifts: a fine graphite line, a dot at each end.
    g.setLineDash([]); g.strokeStyle = "rgba(48,52,62,.55)"; g.fillStyle = "rgba(48,52,62,.7)"; g.lineWidth = 0.9 * dpr;
    for (const { a, b } of this.lifts) {
      g.beginPath(); g.moveTo(a[0] * s + ox, a[1] * s + oy); g.lineTo(b[0] * s + ox, b[1] * s + oy); g.stroke();
      for (const p of [a, b]) { g.beginPath(); g.arc(p[0] * s + ox, p[1] * s + oy, 1.4 * dpr, 0, Math.PI * 2); g.fill(); }
    }
    // The planned way, a soft gold band under the ink.
    const route = this.route();
    if (route?.length > 1) {
      const pts = route.filter((_, i) => i % 3 === 0 || i === route.length - 1).map(([x, z]) => this.toPaint(x, z));
      this.path(g, pts, s, ox, oy, true);
      g.strokeStyle = "rgba(242,182,50,.75)"; g.lineWidth = (big ? Math.min(7, 2.2 * s) + 2 : 5) * dpr; g.stroke();
      if (big) { const [u, v] = pts[pts.length - 1]; this.flag(g, u * s + ox, v * s + oy, dpr); }
    }
    // Skied: clean coloured ink on a thin paper casing.
    const w = (big ? Math.max(1.8, Math.min(4, 1.1 * s)) : 2.3) * dpr;
    for (const k of [0, 1]) for (const seg of this.segs) {
      this.path(g, seg.pts, s, ox, oy, true);
      if (k === 0) { g.strokeStyle = PAPER; g.lineWidth = w + 2.2 * dpr; } else { g.strokeStyle = INK[seg.level] || INK.intermediate; g.lineWidth = w; }
      g.stroke();
    }
    // This ride, dashed (as the old journal map did).
    const tr = big ? this.track() : null;
    if (tr?.length > 1) {
      this.path(g, tr.map(([x, z]) => this.toPaint(x, z)), s, ox, oy, true);
      g.setLineDash([4 * dpr, 3 * dpr]); g.strokeStyle = "rgba(34,52,77,.8)"; g.lineWidth = 1.2 * dpr; g.stroke(); g.setLineDash([]);
    }
  }

  flag(g, u, v, dpr) {
    const f = 14 * dpr;
    g.fillStyle = NAVY; g.fillRect(u - 0.7 * dpr, v - f, 1.4 * dpr, f);
    g.fillStyle = RED; g.beginPath(); g.moveTo(u + 0.7 * dpr, v - f); g.lineTo(u + 0.7 * dpr + f * 0.62, v - f * 0.8); g.lineTo(u + 0.7 * dpr, v - f * 0.58); g.fill();
  }

  pin(g, u, v, dpr) {
    g.fillStyle = RED; g.strokeStyle = PAPER; g.lineWidth = 2 * dpr;
    g.beginPath(); g.arc(u, v - 14 * dpr, 7 * dpr, Math.PI, 0); g.lineTo(u, v); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = PAPER; g.beginPath(); g.arc(u, v - 14 * dpr, 2.6 * dpr, 0, Math.PI * 2); g.fill();
  }

  // One face: the avatar in a circle, a paper ring (yours red).
  drawFace(g, x, y, r, avatar, me, dpr) {
    g.save();
    g.shadowColor = "rgba(40,30,20,.3)"; g.shadowBlur = 4 * dpr; g.shadowOffsetY = 1.5 * dpr;
    g.fillStyle = me ? RED : PAPER; g.beginPath(); g.arc(x, y, r + (me ? 2.6 : 2) * dpr, 0, Math.PI * 2); g.fill();
    g.restore();
    g.fillStyle = "#e6ebee"; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    const im = this.face(avatar);
    if (im) { g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip(); g.drawImage(im, x - r * 1.08, y - r * 1.08, r * 2.16, r * 2.16); g.restore(); }
  }

  // Everyone, gathered where they overlap on screen; you on top. Returns what can be tapped.
  drawPeople(g, s, ox, oy, dpr, r) {
    const me = this.me?.();
    const all = [...(me ? [{ id: "me", avatar: myAvatar(), name: t("你"), x: me.x, z: me.z, me: true }] : []), ...this.people];
    const clusters = [];
    for (const p of all) {
      const [u, v] = this.toPaint(p.x, p.z), x = u * s + ox, y = v * s + oy;
      const c = clusters.find((c) => Math.hypot(c.x - x, c.y - y) < r * 1.6);
      if (c) c.m.push({ p, x, y }); else clusters.push({ x, y, m: [{ p, x, y }] });
    }
    for (const c of clusters) c.key = c.m.map((e) => e.p.id).sort().join("|");
    clusters.sort((a, b) => (a.m[0].p.me ? 1 : 0) - (b.m[0].p.me ? 1 : 0)); // yours last: on top
    const hits = [];
    for (const c of clusters) {
      if (c.m.length === 1) { const { p } = c.m[0]; this.drawFace(g, c.x, c.y, r, p.avatar, p.me, dpr); hits.push({ x: c.x, y: c.y, r: r * 1.3, person: p }); continue; }
      if (this.fan === c.key) { // fanned out round where they stand
        const n = c.m.length, R = r * (n > 4 ? 3 : 2.5);
        c.m.forEach((e, k) => {
          const a = -Math.PI / 2 + ((k - (n - 1) / 2) * Math.PI * 2) / Math.max(n, 3) * 0.9, x = c.x + Math.cos(a) * R, y = c.y + Math.sin(a) * R;
          g.strokeStyle = "rgba(34,52,77,.55)"; g.lineWidth = 1 * dpr; g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(x, y); g.stroke();
          e.fx = x; e.fy = y;
        });
        g.fillStyle = NAVY; g.beginPath(); g.arc(c.x, c.y, 2.5 * dpr, 0, Math.PI * 2); g.fill();
        for (const e of [...c.m].sort((a, b) => (a.p.me ? 1 : 0) - (b.p.me ? 1 : 0))) { this.drawFace(g, e.fx, e.fy, r, e.p.avatar, e.p.me, dpr); hits.push({ x: e.fx, y: e.fy, r: r * 1.3, person: e.p }); }
        continue;
      }
      // A stacked bubble: two faces fanned behind, the top one in front (yours if you're in it), "+N".
      const top = c.m.find((e) => e.p.me) || c.m[0], rest = c.m.filter((e) => e !== top);
      rest.slice(0, 2).forEach((e, k) => this.drawFace(g, c.x + (k ? 1 : -1) * r * 0.62, c.y - r * 0.18, r * 0.82, e.p.avatar, false, dpr));
      this.drawFace(g, c.x, c.y, r, top.p.avatar, top.p.me, dpr);
      const txt = `+${rest.length}`; g.font = `600 ${10.5 * dpr}px "Cormorant Garamond", "Noto Serif SC", serif`;
      const tw = g.measureText(txt).width + 8 * dpr, bx = c.x + r * 0.55, by = c.y + r * 0.55, bh = 14 * dpr;
      g.fillStyle = NAVY; g.strokeStyle = PAPER; g.lineWidth = 1.5 * dpr;
      g.beginPath(); g.roundRect(bx, by, tw, bh, bh / 2); g.fill(); g.stroke();
      g.fillStyle = PAPER; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, bx + tw / 2, by + bh / 2 + 0.5 * dpr);
      hits.push({ x: c.x, y: c.y, r: r * 1.6, cluster: c.key });
    }
    return hits;
  }

  // ---------- The corner map ----------
  drawMini() {
    if (!this.ok || this.mini.hidden) return;
    this.refresh();
    const cv = this.miniCv, dpr = Math.min(3, devicePixelRatio || 1), D = Math.round(cv.clientWidth * dpr) || 1;
    if (cv.width !== D) cv.width = cv.height = D;
    const g = cv.getContext("2d"), me = this.me?.(); if (!me) return;
    const [u, v] = this.toPaint(me.x, me.z), s = D / MINI_SPAN, ox = D / 2 - u * s, oy = D / 2 - v * s;
    g.clearRect(0, 0, D, D);
    g.save(); g.beginPath(); g.arc(D / 2, D / 2, D / 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = "#f3efe6"; g.fillRect(0, 0, D, D);
    this.paint(g, s, ox, oy, dpr, false);
    this.drawPeople(g, s, ox, oy, dpr, 10 * dpr);
    g.restore();
  }

  // ---------- The sheet ----------
  dom() {
    const mini = (this.mini = document.createElement("button"));
    mini.id = "pmMini"; mini.hidden = true; mini.setAttribute("aria-label", t("雪场地图"));
    mini.innerHTML = `<canvas></canvas><span></span>`;
    this.miniCv = mini.querySelector("canvas"); this.miniChip = mini.querySelector("span");
    mini.onclick = () => this.openSheet();
    const sh = (this.sheet = document.createElement("div"));
    sh.id = "pmSheet"; sh.hidden = true;
    sh.innerHTML = `<div class="pmDim"></div><div class="pmBody">
      <i class="pmGrab"></i>
      <header><h2></h2><div class="pmPct"><small>${t("已滑")}</small><b></b></div><button class="pmX" aria-label="${t("合上")}">×</button></header>
      <p class="pmSub"></p>
      <div class="pmWrap"><canvas></canvas><div class="pmPop" hidden></div>
        <div class="pmTools"><button data-k="me"><img src="assets/icons/compass_n.png?v=1" alt="">${t("回到我")}</button><button data-k="all"><img src="assets/icons/trailmap.png?v=1" alt="">${t("全图")}</button></div></div>
      <div class="pmCard" hidden></div>
      <div class="pmPeople" hidden></div>
      <div class="pmLv"></div>
      <p class="pmHint">${t("点山上任意地方 → 从那里出发 · 点雪道 → 看名字和难度 · 彩色 = 滑过 · 铅笔线 = 还没滑")}</p>
      <div class="pmBtns"><button data-k="more"><img src="assets/icons/difficulty.png?v=1" alt="">${t("换条路线")}</button></div>
    </div>`;
    document.body.append(mini, sh);
    this.cv = sh.querySelector("canvas"); this.wrap = sh.querySelector(".pmWrap"); this.pop = sh.querySelector(".pmPop"); this.card = sh.querySelector(".pmCard");
    sh.querySelector(".pmDim").onclick = () => this.close();
    sh.querySelector(".pmX").onclick = () => this.close();
    sh.querySelector("[data-k=me]").onclick = () => this.focusMe();
    sh.querySelector("[data-k=all]").onclick = () => this.fitAll();
    sh.querySelector("[data-k=more]").onclick = () => { this.close(); this.onMore(); };
    this.gestures();
    // Pull the sheet down by its handle or header to close it.
    const body = sh.querySelector(".pmBody"); let y0 = null, dy = 0;
    for (const el of [sh.querySelector(".pmGrab"), sh.querySelector("header")]) el.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; y0 = e.clientY; dy = 0; body.style.transition = "none"; });
    addEventListener("pointermove", (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); body.style.transform = `translateY(${dy}px)`; });
    addEventListener("pointerup", () => { if (y0 == null) return; y0 = null; body.style.transition = ""; body.style.transform = ""; if (dy > 80) this.close(); });
  }

  show(on) { this.mini.hidden = !on || !this.ok; if (on && !this.ok) this.ready.then(() => { if (this.ok && on) { this.mini.hidden = false; this.drawMini(); } }); }

  // browse: only look (after the run): taps name the run, nothing to start.
  openSheet({ browse = false } = {}) {
    if (!this.ok || this.isOpen) return;
    this.browse = browse; this.sheet.querySelector("[data-k=more]").hidden = browse;
    this.isOpen = true; this.sheet.hidden = false; this.choice = null; this.card.hidden = true; this.fan = null; this.pop.hidden = true;
    this.sheet.querySelector("h2").textContent = t("我的 {name}", { name: this.R.name.replace(/ (Mountain|Basin|Ski Area|Resort)$/, "") });
    this.refresh(true); this.fillSheet(); this.fillPeople();
    requestAnimationFrame(() => { this.sheet.classList.add("on"); this.size(); this.fitRuns(); this.loop(); });
  }
  close() {
    if (!this.isOpen) return;
    this.isOpen = false; this.sheet.classList.remove("on"); this.pop.hidden = true;
    setTimeout(() => { if (!this.isOpen) this.sheet.hidden = true; }, 260);
  }

  fillSheet() {
    const s = this.stats; if (!s) return;
    this.sheet.querySelector(".pmPct b").textContent = `${Math.round(s.share * 100)}%`;
    this.sheet.querySelector(".pmSub").textContent = t("滑过 {a}/{b} 条雪道 · {km} 公里", { a: s.touched, b: s.runs, km: s.km.toFixed(1) });
    this.sheet.querySelector(".pmLv").innerHTML = LEVELS.map(([k, name]) => {
      const { all, done } = this.levels[k], n = all.size; if (!n) return "";
      return `<div><i class="lv ${k}"></i><span>${t(name)}</span><em><i style="width:${Math.round((done.size / n) * 100)}%;background:${INK[k]}"></i></em><b>${done.size}/${n}</b></div>`;
    }).join("");
  }

  fillPeople() {
    const box = this.sheet.querySelector(".pmPeople");
    box.hidden = !this.people.length;
    box.innerHTML = "";
    for (const p of this.people) {
      const el = document.createElement("div"); el.className = "pmChip";
      el.innerHTML = `<img src="assets/icons/${p.avatar}.png?v=1" alt=""><span translate="no"></span><button data-k="find">${t("去找他 ›")}</button><button data-k="follow">${t("跟随")}</button>`;
      el.querySelector("span").textContent = p.where ? `${p.name} · ${p.where}` : p.name;
      el.querySelector("[data-k=find]").onclick = () => this.onFind(p);
      el.querySelector("[data-k=follow]").onclick = () => this.onFollow(p);
      box.append(el);
    }
  }

  size() {
    const dpr = Math.min(2, devicePixelRatio || 1), w = this.wrap.clientWidth, h = this.wrap.clientHeight;
    this.dpr = dpr; this.cw = w; this.ch = h;
    if (this.cv.width !== Math.round(w * dpr)) { this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr); }
    this.v.fit = Math.min(w / this.W, h / this.H);
  }
  // Opening: the resort's runs filling the frame (the painting's far ranges trimmed); 全图 shows it all.
  fitRuns() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const L of this.lines) for (const [u, w] of L.pts) { x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, w); y1 = Math.max(y1, w); }
    if (!(x1 > x0)) return this.fitAll();
    const v = this.v; v.s = Math.min(this.cw / ((x1 - x0) * 1.2), this.ch / ((y1 - y0) * 1.3), v.fit * 2.2);
    v.ox = this.cw / 2 - ((x0 + x1) / 2) * v.s; v.oy = this.ch / 2 - ((y0 + y1) / 2) * v.s; this.clamp();
  }
  fitAll() { const v = this.v; v.s = v.fit; v.ox = (this.cw - this.W * v.s) / 2; v.oy = (this.ch - this.H * v.s) / 2; }
  focusMe() { const me = this.me?.(); if (!me) return; const [u, w] = this.toPaint(me.x, me.z), v = this.v; v.s = v.fit * 2.6; v.ox = this.cw / 2 - u * v.s; v.oy = this.ch / 2 - w * v.s; this.clamp(); }
  clamp() {
    const v = this.v; v.s = Math.max(v.fit * 0.9, Math.min(v.fit * 6, v.s));
    const pw = this.W * v.s, ph = this.H * v.s;
    v.ox = pw <= this.cw ? (this.cw - pw) / 2 : Math.min(0, Math.max(this.cw - pw, v.ox));
    v.oy = ph <= this.ch ? (this.ch - ph) / 2 : Math.min(0, Math.max(this.ch - ph, v.oy));
  }

  loop() {
    if (!this.isOpen) return;
    this.refresh();
    const g = this.cv.getContext("2d"), d = this.dpr, { s, ox, oy } = this.v;
    g.fillStyle = "#f3efe6"; g.fillRect(0, 0, this.cv.width, this.cv.height);
    this.paint(g, s * d, ox * d, oy * d, d, true);
    if (this.choice) { const [u, v] = this.choice.uv; this.pin(g, (u * s + ox) * d, (v * s + oy) * d, d); }
    this.hits = this.drawPeople(g, s * d, ox * d, oy * d, d, 13 * d).map((h) => ({ ...h, x: h.x / d, y: h.y / d, r: h.r / d }));
    if (!this.pop.hidden && this.popFor) { const h = this.hits.find((h) => h.person?.id === this.popFor.id); if (h) this.placePop(h); else this.pop.hidden = true; }
    requestAnimationFrame(() => this.loop());
  }

  gestures() {
    const cv = this.cv, P = this.ptrs;
    let moved = 0, pinch = null;
    cv.addEventListener("pointerdown", (e) => {
      P.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0;
      if (P.size === 2) { const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: this.v.s }; }
    });
    cv.addEventListener("pointermove", (e) => {
      const p = P.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (P.size === 2 && pinch) {
        const [a, b] = [...P.values()], r = cv.getBoundingClientRect(), mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        this.zoomAt(pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, mx, my); moved += 99; return;
      }
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6) { this.v.ox += dx; this.v.oy += dy; this.clamp(); }
    });
    const up = (e) => {
      const was = P.has(e.pointerId); P.delete(e.pointerId); if (P.size < 2) pinch = null;
      if (!was || moved > 8 || P.size) return;
      const r = cv.getBoundingClientRect(); this.tap(e.clientX - r.left, e.clientY - r.top);
    };
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", (e) => { P.delete(e.pointerId); pinch = null; });
    cv.addEventListener("wheel", (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); this.zoomAt(this.v.s * (e.deltaY < 0 ? 1.15 : 0.87), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  }
  zoomAt(s, mx, my) {
    const v = this.v, s1 = Math.max(v.fit * 0.9, Math.min(v.fit * 6, s)), k = s1 / v.s;
    v.ox = mx - (mx - v.ox) * k; v.oy = my - (my - v.oy) * k; v.s = s1; this.clamp();
    if (k !== 1) this.fan = null;
  }

  // A tap: a person or a bubble first, then a lift or a run (to start from there).
  tap(x, y) {
    this.pop.hidden = true; this.popFor = null;
    for (const h of [...(this.hits || [])].reverse()) {
      if (Math.hypot(h.x - x, h.y - y) > h.r) continue;
      if (h.cluster) { this.fan = this.fan === h.cluster ? null : h.cluster; return; }
      this.popFor = h.person; this.showPop(h); return;
    }
    this.fan = null;
    const v = this.v, u = (x - v.ox) / v.s, w = (y - v.oy) / v.s, tol = 20 / v.s;
    let run = null, rd = Infinity, lift = null, ld = Infinity;
    for (const L of this.lines) for (let j = 1; j < L.pts.length; j++) {
      const [d, k] = dist2Seg(u, w, ...L.pts[j - 1], ...L.pts[j]);
      if (d < rd) { rd = d; run = { L, j: k < 0.5 ? j - 1 : j }; }
    }
    for (const l of this.lifts) { if (!this.rideable(l.lift)) continue; const [d] = dist2Seg(u, w, ...l.a, ...l.b); if (d < ld) { ld = d; lift = l; } }
    if (lift && ld < tol && (ld < tol * 0.5 || ld < rd * 0.8)) {
      this.choice = { lift: lift.lift, at: lift.lift.pts[0], uv: lift.a };
      this.showCard(`<img class="ico" src="assets/icons/lift.png?v=1" alt=""><span translate="no"></span>`, lift.lift.name, t("滑到缆车站，坐上去"), this.browse ? null : t("去坐 ›"));
    } else if (run && rd < tol * 1.6) {
      const { L, j } = run, i = L.kept[j], r = L.run, lv = LEVELS.find(([k]) => k === r.level);
      const skied = this.log.runs.get(String(r.id))?.size > 0;
      this.choice = { spot: { run: r, i }, at: r.pts[i], uv: L.pts[j] };
      const to = this.routeName();
      this.showCard(`<i class="lv ${r.level}"></i><span translate="no"></span>`, r.name || t("无名雪道"),
        [lv ? t(lv[1]) : "", t(skied ? "滑过了" : "还没滑过"), to && !this.browse ? t("在这里重新出发，接着去 {x}", { x: to }) : ""].filter(Boolean).join(" · "), this.browse ? null : t("从这里出发 ›"));
    } else {
      this.choice = null;
      this.showCard("", t("那里没有雪道"), t("点一条雪道或者一条缆车"), null);
    }
  }
  showCard(head, name, sub, go) {
    const c = this.card;
    c.innerHTML = `<b>${head}</b><small></small>${go ? `<div class="two"><button class="no">${t("取消")}</button><button class="go">${go}</button></div>` : ""}`;
    if (head) c.querySelector("b span").textContent = name; else c.querySelector("b").textContent = name;
    c.querySelector("small").textContent = sub;
    c.hidden = false;
    c.querySelector(".no")?.addEventListener("click", () => { c.hidden = true; this.choice = null; });
    c.querySelector(".go")?.addEventListener("click", () => { const ch = this.choice; this.close(); if (ch) this.onGo(ch); });
  }
  showPop(h) {
    const p = h.person;
    this.pop.innerHTML = `<img src="assets/icons/${p.avatar}.png?v=1" alt=""><span translate="no"></span>${p.me ? "" : `<button data-k="find">${t("去找他 ›")}</button><button data-k="follow">${t("跟随")}</button>`}`;
    this.pop.querySelector("span").textContent = p.me ? t("你") : p.where ? `${p.name} · ${p.where}` : p.name;
    this.pop.querySelector("[data-k=find]")?.addEventListener("click", () => this.onFind(p));
    this.pop.querySelector("[data-k=follow]")?.addEventListener("click", () => this.onFollow(p));
    this.pop.hidden = false; this.placePop(h);
  }
  placePop(h) {
    const w = this.pop.offsetWidth, x = Math.max(4, Math.min(this.cw - w - 4, h.x - w / 2)), above = h.y - h.r - 40 > 0;
    this.pop.style.transform = `translate(${x}px, ${above ? h.y - h.r - 38 : h.y + h.r + 6}px)`;
  }
}
