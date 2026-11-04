// Trips: where, which pass, which days, who's coming; each day a lift ticket in the journal. Kept on this
// phone; shared as a link that carries the whole trip, so a friend opening it sees the same plan and can
// keep it. (Changing a trip together, live, would need a server: not yet.)
const KEY = "prerunTrips";
const PASSES = { ikon: "Ikon Pass", epic: "Epic Pass", day: "日票", none: "还没买" };
// Which pass each resort takes: all nine here are Ikon resorts (Aspen's four and Steamboat, Winter Park,
// Copper, Eldora, Arapahoe Basin); none are on Epic.
const PASS_OK = { ikon: () => true, epic: () => false, day: () => true, none: () => true };

const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const save = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* full */ } };
const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const day0 = (d) => new Date(d + "T00:00:00");
const fmt = (d) => { const x = day0(d); return `${x.getMonth() + 1} 月 ${x.getDate()} 日`; };
const WEEK = "日一二三四五六";
const daysBetween = (a, b) => Math.round((day0(b) - day0(a)) / 86400000);
// Dates as local YYYY-MM-DD (toISOString is UTC, a day off east or west of it).
const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
const today = () => ymd(new Date());
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// A lift ticket, as in the journal.
function ticket({ band, title, sub, extra = "", rot = 0, used = false, cls = "" }) {
  return `<div class="tk ${cls}" style="transform:rotate(${rot}deg)"><div class="tk-band">${band}</div>
    <div class="tk-body"><div class="tk-top">COLORADO · ${esc(PASSES[cls] || "SKI")}</div><div class="tk-title">${title}</div><div class="tk-sub">${sub}</div>${extra}
    ${used ? '<i class="tk-hole" style="right:10px"></i><i class="tk-hole" style="right:28px"></i>' : ""}</div><div class="tk-stub"></div></div>`;
}

// The resorts a trip might go to (older trips only had days), and a resort's short name.
const maybeOf = (t) => t.maybe || [...new Set(t.days.map((d) => d.resort).filter(Boolean))];
const WX = "看天气再定";

export class Trips {
  constructor(box, resorts, { me = "我", go }) {
    this.box = box; this.resorts = resorts; this.me = me; this.go = go;
    this.byId = Object.fromEntries(resorts.map((r) => [r.id, r]));
  }
  get list() { return load(); }
  short(id) { return this.byId[id]?.name.replace(/ Mountain$| Basin$/, "") || id; }
  // A trip that came in a link (?trip=...): show it, offer to keep it.
  incoming(code) {
    // Only what a trip can hold: known passes and resorts, real dates, plain text (it comes from anyone).
    try {
      const t = JSON.parse(unb64(code)), str = (v, n) => String(v ?? "").slice(0, n);
      const days = (Array.isArray(t?.days) ? t.days : []).filter((d) => DATE.test(d?.date) && (d.resort == null || this.byId[d.resort])).slice(0, 14).map((d) => ({ date: d.date, resort: d.resort ?? null, note: str(d.note, 80) }));
      const maybe = (Array.isArray(t.maybe) ? t.maybe : []).filter((id) => this.byId[id]);
      if (!days.length || !DATE.test(t.from) || !DATE.test(t.to)) return false;
      this.shared = { name: str(t.name, 20) || "滑雪行程", from: t.from, to: t.to, pass: t.pass in PASSES ? t.pass : "none", people: (Array.isArray(t.people) ? t.people : []).slice(0, 20).map((p) => str(p, 20)), notes: str(t.notes, 80), days, maybe };
      return true;
    } catch { return false; } // a broken link
  }
  link(t) { return `${location.origin}${location.pathname.replace(/[^/]*$/, "")}start.html?trip=${b64(JSON.stringify({ ...t, id: undefined }))}`; }

  render() {
    if (this.shared) return this.renderShared();
    const list = this.list.sort((a, b) => a.from.localeCompare(b.from)), now = today();
    const coming = list.filter((t) => t.to >= now), past = list.filter((t) => t.to < now);
    const card = (t, i) => {
      const n = daysBetween(now, t.from), len = daysBetween(t.from, t.to) + 1;
      const places = maybeOf(t).map((id) => this.short(id)).join(" · ") || WX;
      return `<div class="tk-wrap" data-id="${t.id}">${ticket({ band: "TRIP", title: esc(t.name), sub: `${fmt(t.from)} · ${len} 天 · ${t.people.length} 人<br>📍 ${esc(places)}`, cls: t.pass, rot: [-2, 1.5, -1][i % 3],
        extra: t.to >= now ? `<span class="tk-count">${n > 0 ? `还有 ${n} 天` : n === 0 ? "今天出发！" : "进行中"}</span>` : "", used: t.to < now })}${i === 0 && t.to >= now ? '<i class="clip"></i>' : ""}</div>`;
    };
    this.box.innerHTML = `<div class="jhead"><div class="jt">我的行程 ✈</div><div class="js">几号到几号 · 可能去哪 · 谁一起</div></div>
      <button class="newtrip">＋ 新建行程<small>选日期和可能去的雪场，分享给朋友一起</small></button>
      ${coming.length ? `<div class="jsec">即将出发</div>${coming.map(card).join("")}` : ""}
      ${past.length ? `<div class="jsec">去过的</div>${past.map(card).join("")}` : ""}
      ${list.length ? "" : '<div class="jnote">还没有行程。建一个，生成链接发给朋友，大家就能看到同一份计划。</div>'}`;
    this.box.querySelector(".newtrip").onclick = () => this.edit();
    for (const el of this.box.querySelectorAll(".tk-wrap")) el.onclick = () => this.open(this.list.find((t) => t.id === el.dataset.id));
  }

  // One trip: a ticket per day, the pass in its pocket, who's coming, share and ride.
  open(t, shared = false) {
    const ok = PASS_OK[t.pass] || (() => true), len = daysBetween(t.from, t.to) + 1;
    const days = t.days.map((d, i) => {
      const r = this.byId[d.resort], dd = day0(d.date), cands = maybeOf(t);
      const sub = `${fmt(d.date)} 周${WEEK[dd.getDay()]}${r ? "" : cands.length ? `<br>在 ${esc(cands.map((id) => this.short(id)).join("、"))} 里挑` : ""}${d.note ? `<br>${esc(d.note)}` : ""}`;
      const go = shared ? "" : r ? `<button class="ride" data-resort="${d.resort}">去预滑 ›</button>` : "";
      return `<div class="tk-wrap">${ticket({ band: `DAY ${i + 1}`, title: r ? esc(r.name) : `🌨 ${WX}`, sub, cls: t.pass, rot: [-1.5, 1.2, -.8][i % 3] })}${go}</div>`;
    }).join("");
    const bad = [...new Set([...maybeOf(t), ...t.days.map((d) => d.resort)].filter(Boolean))].filter((id) => !ok(id)).map((id) => this.byId[id]?.name);
    this.box.innerHTML = `<button class="back">‹ 我的行程</button>
      <div class="jhead"><div class="jt">${esc(t.name)}</div><div class="js">${fmt(t.from)} – ${fmt(t.to)} · ${len} 天 · ${esc(PASSES[t.pass])}</div></div>
      <div class="stamp" style="${bad.length ? "border-color:#8a8a8a;color:#8a8a8a" : ""}">${bad.length ? "CHECK<br>PASS" : `${t.pass === "ikon" ? "IKON" : t.pass === "day" ? "DAY" : "PASS"}<br>VALID`}</div>
      ${bad.length ? `<div class="jnote warn">⚠ ${esc(PASSES[t.pass])} 不能在 ${esc(bad.join("、"))} 用（这些是 Ikon 雪场）</div>` : ""}
      ${maybeOf(t).length ? `<div class="jsec">可能去的山</div><div class="maybe">${maybeOf(t).map((id) => `<button class="ride2" data-resort="${id}">${esc(this.short(id))}${shared ? "" : " · 去预滑 ›"}</button>`).join("")}</div>` : ""}
      <div class="jsec">每天</div>
      ${days}
      <div class="slips"><div class="slip"><b>同行 ⛷</b>${t.people.length > 1 ? t.people.map((p) => `<span>${esc(p)}</span>`).join("") : "<span>只有你 · 分享链接，朋友点开就加入</span>"}</div>
        <div class="slip"><b>备注 ✎</b><span>${esc(t.notes || "—")}</span></div></div>
      <div class="acts">${shared ? '<button class="go keep">存到我的行程</button>' : '<button class="go share">🔗 分享给朋友</button><button class="edit">改一改</button><button class="del">删掉</button>'}</div>`;
    this.box.querySelector(".back").onclick = () => { this.shared = null; history.replaceState(null, "", location.pathname + "?tab=trip"); this.render(); };
    for (const b of this.box.querySelectorAll(".ride" + (shared ? "" : ",.ride2"))) b.onclick = () => this.go(b.dataset.resort);
    this.box.querySelector(".share")?.addEventListener("click", async (e) => {
      const url = this.link(t), text = `一起去滑雪：${t.name}（${fmt(t.from)}–${fmt(t.to)}）`;
      if (navigator.share) { navigator.share({ title: t.name, text, url }).catch(() => {}); return; }
      try { await navigator.clipboard.writeText(url); e.target.textContent = "链接已复制 ✓"; } catch { prompt("复制这个链接发给朋友", url); }
    });
    this.box.querySelector(".edit")?.addEventListener("click", () => this.edit(t));
    this.box.querySelector(".del")?.addEventListener("click", () => { if (confirm(`删掉「${t.name}」？`)) { save(this.list.filter((x) => x.id !== t.id)); this.render(); } });
    this.box.querySelector(".keep")?.addEventListener("click", () => {
      const mine = { ...t, id: "t" + Date.now().toString(36) };
      if (this.me && !mine.people.includes(this.me)) mine.people = [...mine.people, this.me];
      save([...this.list, mine]); this.shared = null; history.replaceState(null, "", location.pathname + "?tab=trip"); this.open(mine);
    });
  }
  renderShared() { this.open(this.shared, true); this.box.querySelector(".jhead .js").insertAdjacentHTML("afterend", '<div class="jnote">朋友分享给你的行程</div>'); }

  // New or edit: name, dates, the resorts you might go to, pass. Each day can stay "see the weather" or
  // be set to one resort. Who's coming isn't typed: friends join from the share link.
  edit(t) {
    const now = today(), plus = (d, n) => { const x = day0(d); x.setDate(x.getDate() + n); return ymd(x); };
    const draft = t ? JSON.parse(JSON.stringify(t)) : { id: null, name: "", from: plus(now, 14), to: plus(now, 16), pass: "ikon", people: [this.me], notes: "", days: [], maybe: [] };
    draft.maybe = maybeOf(draft);
    // One day per date. A day you set keeps its resort while it's still one you might go to; the rest go
    // to the only resort if there's just one, else stay "see the weather".
    const picked = new Set(t ? draft.days.map((d, i) => (d.resort ? i : -1)) : []);
    const fillDays = () => {
      const n = Math.max(1, Math.min(14, daysBetween(draft.from, draft.to) + 1)), only = draft.maybe.length === 1 ? draft.maybe[0] : null;
      draft.days = Array.from({ length: n }, (_, i) => { const r = draft.days[i]?.resort, mine = picked.has(i) && r && (!draft.maybe.length || draft.maybe.includes(r)); return { date: plus(draft.from, i), resort: mine ? r : only, note: draft.days[i]?.note || "" }; });
    };
    const draw = () => {
      fillDays();
      this.box.innerHTML = `<button class="back">‹ 取消</button><div class="jhead"><div class="jt">${t ? "改行程" : "新建行程"}</div></div>
        <div class="form">
          <label>叫什么</label><input class="f-name" maxlength="20" placeholder="比如：Copper 周末" value="${esc(draft.name)}">
          <label>几号到几号</label><div class="row2"><input type="date" class="f-from" value="${draft.from}"><span>–</span><input type="date" class="f-to" value="${draft.to}"></div>
          <label>可能去哪些山（多选，到时候看天气）</label><div class="chips"><button class="chip wx ${draft.maybe.length ? "" : "on"}">🌨 还没想好</button>${this.resorts.map((r) => `<button class="chip ${draft.maybe.includes(r.id) ? "on" : ""}" data-id="${r.id}">${esc(r.name)}</button>`).join("")}</div>
          <label>用什么雪卡</label><div class="chips">${Object.entries(PASSES).map(([k, v]) => `<button class="chip pass ${draft.pass === k ? "on" : ""}" data-pass="${k}">${v}</button>`).join("")}</div>
          <label>每天去哪（可以先不定）</label>${draft.days.map((d, i) => `<div class="dayrow"><span>Day ${i + 1} · ${fmt(d.date)}</span><select data-i="${i}"><option value="">🌨 ${WX}</option>${(draft.maybe.length ? draft.maybe : this.resorts.map((r) => r.id)).map((id) => `<option value="${id}" ${id === d.resort ? "selected" : ""}>${esc(this.byId[id].name)}</option>`).join("")}</select></div>`).join("")}
          <label>备注</label><input class="f-notes" maxlength="80" placeholder="比如：周六早上 7 点出发，记得订停车" value="${esc(draft.notes)}">
        </div><div class="acts"><button class="go save">保存</button></div>`;
      const v = (c) => this.box.querySelector(c).value;
      // Read the form back (a trip is two weeks at most).
      const keep = () => { draft.name = v(".f-name"); draft.from = v(".f-from"); draft.to = v(".f-to") < draft.from ? draft.from : v(".f-to") > plus(draft.from, 13) ? plus(draft.from, 13) : v(".f-to"); draft.notes = v(".f-notes"); };
      this.box.querySelector(".back").onclick = () => (t ? this.open(t) : this.render());
      for (const el of this.box.querySelectorAll(".f-from,.f-to")) el.onchange = () => { keep(); draw(); };
      for (const el of this.box.querySelectorAll(".chip[data-id]")) el.onclick = () => { keep(); const id = el.dataset.id; draft.maybe = draft.maybe.includes(id) ? draft.maybe.filter((x) => x !== id) : [...draft.maybe, id]; draw(); };
      this.box.querySelector(".chip.wx").onclick = () => { keep(); draft.maybe = []; draw(); };
      for (const el of this.box.querySelectorAll(".chip[data-pass]")) el.onclick = () => { keep(); draft.pass = el.dataset.pass; draw(); };
      for (const el of this.box.querySelectorAll(".dayrow select")) el.onchange = () => { keep(); const i = +el.dataset.i; draft.days[i].resort = el.value || null; if (el.value) picked.add(i); else picked.delete(i); };
      this.box.querySelector(".save").onclick = () => {
        keep();
        if (!draft.name) draft.name = draft.maybe.length === 1 ? `${this.short(draft.maybe[0])} 之旅` : `${fmt(draft.from)} 滑雪`;
        const all = this.list, out = { ...draft, id: draft.id || "t" + Date.now().toString(36) };
        save(draft.id ? all.map((x) => (x.id === draft.id ? out : x)) : [...all, out]);
        this.open(out);
      };
    };
    draw();
  }
}
