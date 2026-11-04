// The pre-run roadbook: what you did on a pre-run, step by step, kept on this phone, so that on the day
// you can follow it. The base you set out from, each lift, at each top the ways you could have gone and the
// one you took, the runs in order, where you came out. Steps a few hours apart start a new day.
// Drawn as a page of the journal: a map of the day's way at the top, then the steps as a path with forks.
import { t, EN_ON } from "./i18n.js?v=2";
const KEY = "prerunBook", GAP = 3 * 3600e3, KEEP = 30;
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const MARK = { easy: "🟢", intermediate: "🟦", advanced: "◆", expert: "◆◆" };

// step: { k: "base" | "lift" | "top" | "route" | "jump" | "arrive", ... } (see render for the fields).
export function addStep(resort, step) {
  const all = load(), list = (all[resort] ||= []), now = Date.now();
  let day = list[list.length - 1];
  if (!day || now - day.t1 > GAP) list.push((day = { t0: now, t1: now, steps: [] }));
  const last = day.steps[day.steps.length - 1], same = (a, b) => JSON.stringify({ ...a, t: 0 }) === JSON.stringify({ ...b, t: 0 });
  if (!last || !same(last, step)) day.steps.push({ ...step, t: now }); // a page reload repeats the lift: once is enough
  day.t1 = now;
  if (list.length > KEEP) list.splice(0, list.length - KEEP);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* full */ }
}
export const daysOf = (resort) => (load()[resort] || []).filter((d) => d.steps.length);
// A route's path for the book's map: every 4th point, whole metres.
export const thinPath = (path) => path.filter((_, i) => i % 4 === 0 || i === path.length - 1).map(([x, z]) => [Math.round(x), Math.round(z)]);
// The day's way, in order, for the map.
export const wayOf = (day) => day.steps.filter((s) => s.path).flatMap((s) => s.path);

const CSS = `
.bookPage { position: fixed; inset: 0; z-index: 30; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: calc(16px + env(safe-area-inset-top)) 18px 40px; background-color: #f4ecd9;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .42  0 0 0 0 .33  0 0 0 0 .2  0 0 0 .12 0'/></filter><rect width='240' height='240' filter='url(%23n)'/></svg>"); }
.bookPage .x { position: fixed; right: 14px; top: calc(12px + env(safe-area-inset-top)); width: 38px; height: 38px; border-radius: 50%; font-size: 20px; color: #4a3626; background: #fffaf0; border: 1.8px solid #5a4636; z-index: 1; }
.book { color: #4a3626; font-family: "Noto Serif SC", serif; }
.book .bh { font-family: "Long Cang", cursive; font-size: 34px; line-height: 1.05; }
.book .bs { font-family: "Long Cang"; font-size: 18px; color: #7a5a3a; margin-bottom: 10px; }
.book .days { display: flex; gap: 6px; overflow-x: auto; margin: 0 0 10px; }
.book .days button { flex: none; font-family: "Long Cang"; font-size: 17px; color: #4a3626; background: #fffaf0; border: 1.5px solid #8a6a4a; border-radius: 999px; padding: 2px 12px; }
.book .days button.on { background: #7a4b25; color: #fff5e1; border-color: #7a4b25; }
.book .photo { position: relative; background: #fffaf0; padding: 8px 8px 26px; box-shadow: 2px 4px 10px rgba(60,40,20,.3); transform: rotate(-1deg); margin: 6px 4px 18px; }
.book .photo canvas { width: 100%; height: 220px; display: block; background: #e9edf2; touch-action: none; }
.book .photo .cap { position: absolute; left: 10px; bottom: 4px; font-family: "Long Cang"; font-size: 17px; color: #6a5040; }
.book .photo .tape { position: absolute; top: -10px; left: 40%; width: 80px; height: 22px; background: rgba(200,170,120,.55); transform: rotate(-4deg); }
.book .photo .me { position: absolute; right: 8px; bottom: 3px; font-family: "Long Cang"; font-size: 16px; color: #4a3626; background: #f4ecd9; border: 1.5px solid #8a6a4a; border-radius: 999px; padding: 0 10px; }
.book ol { list-style: none; margin: 0; padding: 0 0 0 26px; position: relative; }
.book ol::before { content: ""; position: absolute; left: 10px; top: 8px; bottom: 8px; border-left: 2.5px dashed #b5482f; }
.book li { position: relative; margin: 0 0 14px; font-size: 14px; line-height: 1.5; }
.book li::before { content: attr(data-n); position: absolute; left: -27px; top: 1px; width: 20px; height: 20px; border-radius: 50%; background: #f4ecd9; border: 2px solid #b5482f; color: #b5482f; font: 700 11px/20px Oswald, sans-serif; text-align: center; }
.book li b { font-family: "Long Cang"; font-weight: 400; font-size: 21px; }
.book li small { display: block; color: #7a5a3a; }
.book .fork { margin: 4px 0 0; padding: 6px 10px; background: #fbf4e2; border: 1.5px solid #5a4636; border-radius: 4px; box-shadow: 2px 3px 0 rgba(74,54,38,.18); }
.book .fork div { padding: 2px 0 2px 16px; position: relative; color: #9a8a76; }
.book .fork div::before { content: "╌"; position: absolute; left: 0; color: #b9a98f; }
.book .fork div.took { color: #2a1d12; font-weight: 700; }
.book .fork div.took::before { content: "➜"; color: #b5482f; }
.book .fork div.took::after { content: "走了这条"; margin-left: 8px; font: 400 15px "Long Cang"; color: #b5482f; border: 1.5px solid #b5482f; border-radius: 999px; padding: 0 6px; }
.book .runs { margin-top: 2px; }
.book .runs span { white-space: nowrap; }
.book .empty { font-family: "Long Cang"; font-size: 19px; color: #7a5a3a; }
`;
let styled = false;
const style = () => { if (styled) return; styled = true; const s = document.createElement("style"); s.textContent = CSS; document.head.append(s); };

// The page for one resort. host: { name, drawMap(canvas, day, me) } where drawMap paints the day's way on
// the resort's map (me: your position now, if known); locate() asks the phone where you are.
export function renderBook(box, resort, host) {
  style();
  const days = daysOf(resort);
  box.classList.add("book");
  if (!days.length) { box.innerHTML = `<div class="bh">${t("📜 预滑路书")}</div><div class="empty">${t("还没有。去预滑一趟，坐的缆车、在山顶的选择、滑的雪道都会一步一步记在这里。")}</div>`; return; }
  let pick = days.length - 1, me = null;
  const draw = () => {
    const day = days[pick], d = new Date(day.t0);
    let n = 0;
    const steps = day.steps.map((s) => {
      n++;
      if (s.k === "base") return `<li data-n="${n}"><b>🏠 ${t("从 {x} 出发", { x: esc(s.name) })}</b></li>`;
      if (s.k === "lift") return `<li data-n="${n}"><b>🚡 ${t("坐 {x} 上山", { x: esc(s.name) })}</b></li>`;
      if (s.k === "top") {
        const opts = s.options.slice(0, 7), more = s.options.length - opts.length;
        if (!opts.includes(s.chose)) opts.unshift(s.chose);
        return `<li data-n="${n}"><b>🏔 ${t("到 {x} 山顶", { x: esc(s.at) })}</b><small>${t("这里可以：")}</small><div class="fork">${opts.map((o) => `<div class="${o === s.chose ? "took" : ""}">${esc(o)}</div>`).join("")}${more > 0 ? `<div>${t("…还有 {n} 条", { n: more })}</div>` : ""}</div></li>`;
      }
      if (s.k === "route") {
        const runs = s.segs.map((g) => `<span>${MARK[g.l] || ""} ${esc(g.n)}</span>`).join(" › ");
        return `<li data-n="${n}"><b>${t(s.changed ? "↩ 改路线" : "⛷ 滑下去")}</b><div class="runs">${runs}</div>${s.next ? `<small>${t("到底坐 🚡 {x}", { x: esc(s.next) })}</small>` : ""}</li>`;
      }
      if (s.k === "jump") return `<li data-n="${n}"><b>⏭ ${t("跳到 {x}", { x: esc(s.to) })}</b><small>${t("中间这段算看过了")}</small></li>`;
      if (s.k === "arrive") return `<li data-n="${n}"><b>📍 ${esc(s.title)}</b></li>`;
      n--; return "";
    }).join("");
    box.innerHTML = `<div class="bh">${t("📜 预滑路书")}</div><div class="bs">${esc(host.name)} · ${EN_ON ? `pre-run ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getDate()} · follow it on the day` : `${d.getMonth() + 1} 月 ${d.getDate()} 日预滑 · 明天照着走`}</div>
      ${days.length > 1 ? `<div class="days">${days.map((x, i) => { const t = new Date(x.t0); return `<button data-i="${i}" class="${i === pick ? "on" : ""}">${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}</button>`; }).reverse().join("")}</div>` : ""}
      <div class="photo"><i class="tape"></i><canvas></canvas><span class="cap">${t("金色是这一趟的路线")}</span>${host.locate ? `<button class="me">${t(me ? "📍 我在这" : "📍 显示我在哪")}</button>` : ""}</div>
      <ol>${steps}</ol>`;
    for (const b of box.querySelectorAll(".days button")) b.onclick = () => { pick = +b.dataset.i; draw(); };
    const cv = box.querySelector("canvas");
    requestAnimationFrame(() => host.drawMap(cv, day, me));
    box.querySelector(".me")?.addEventListener("click", () => host.locate((p) => { me = p; host.drawMap(cv, day, me); box.querySelector(".me").textContent = t(p ? "📍 我在这" : "📍 找不到位置"); }));
  };
  draw();
}

// The page over everything, with a close button.
export function openBookPage(resort, host) {
  const page = document.createElement("div"), body = document.createElement("div");
  page.className = "bookPage"; page.innerHTML = '<button class="x" aria-label="关闭">×</button>';
  page.append(body); document.body.append(page);
  page.querySelector(".x").onclick = () => page.remove();
  renderBook(body, resort, host);
}
// Paint a day's way on a TrailMap (mapview.js), framed to fit; with you on it when you're near.
export const paintWith = (tm) => (cv, day, me) => {
  const dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr);
  const way = wayOf(day), pts = way.length ? [...way] : [[0, 0]];
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  if (me && Math.hypot(me.x - (Math.min(...xs) + Math.max(...xs)) / 2, me.z - (Math.min(...zs) + Math.max(...zs)) / 2) < 5000) { xs.push(me.x); zs.push(me.z); }
  const w = Math.max(...xs) - Math.min(...xs) + 400, h = Math.max(...zs) - Math.min(...zs) + 400;
  const zoom = Math.max(0.05, Math.min(0.6, cv.clientWidth / w, cv.clientHeight / h));
  tm.view(cv, { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cz: (Math.min(...zs) + Math.max(...zs)) / 2, zoom, route: way, you: me, dpr });
};
// Where the phone is, in the resort's metres (the same flat projection as tools/bake.py).
export const locateIn = (origin) => (cb) => {
  if (!navigator.geolocation) return cb(null);
  navigator.geolocation.getCurrentPosition((p) => cb({ x: (p.coords.longitude - origin.lon) * 111320 * Math.cos((origin.lat * Math.PI) / 180), z: -(p.coords.latitude - origin.lat) * 110574, heading: (p.coords.heading || 0) * Math.PI / 180 }), () => cb(null), { enableHighAccuracy: true, timeout: 15000 });
};
