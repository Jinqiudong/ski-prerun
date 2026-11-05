// The pre-run roadbook: what you did on a pre-run, step by step, kept on this phone, so that on the day
// you can follow it. The base you set out from, each lift, at each top the ways you could have gone and the
// one you took, the runs in order, where you came out. Steps a few hours apart start a new day.
// Drawn as a page of the journal: a map of the day's way at the top, then the steps as a path with forks.
import { t, EN_ON } from "./i18n.js?v=19";
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

const SERIF = `"Cormorant Garamond", "Noto Serif SC", serif`;
const CSS = `
.bookPage { position: fixed; inset: 0; z-index: 30; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: calc(18px + env(safe-area-inset-top)) 18px 40px; background-color: #f6f1e7;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .45  0 0 0 0 .38  0 0 0 0 .3  0 0 0 .07 0'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>"); }
.bookPage .x { position: fixed; right: 14px; top: calc(12px + env(safe-area-inset-top)); width: 36px; height: 36px; border-radius: 50%; font-size: 18px; color: #22344d; background: #fdfbf6; border: 1px solid #cbbfa9; z-index: 1; }
.book { color: #33302c; font-family: "Noto Serif SC", serif; }
.book .bk { font: 500 10px Oswald, sans-serif; letter-spacing: .3em; color: #8a8278; }
.book .bh { font: 600 32px/1.05 ${SERIF}; color: #22344d; margin: 3px 0 2px; }
.book .bs { font: 15px ${SERIF}; color: #8a8278; margin-bottom: 12px; }
.book .days { display: flex; gap: 6px; overflow-x: auto; margin: 0 0 10px; }
.book .days button { flex: none; font: 14px ${SERIF}; color: #22344d; background: #fdfbf6; border: 1px solid #cbbfa9; border-radius: 999px; padding: 3px 12px; }
.book .days button.on { background: #22344d; color: #fdfbf6; border-color: #22344d; }
.book .photo { position: relative; background: #fdfbf6; padding: 10px 10px 30px; box-shadow: 0 8px 18px rgba(90,70,40,.16); margin: 6px 0 22px; }
.book .photo canvas { width: 100%; height: 230px; display: block; background: #e9edf2; touch-action: none; }
.book .photo .cap { position: absolute; left: 12px; bottom: 7px; font: italic 14px ${SERIF}; color: #8a8278; }
.book .photo .me { position: absolute; right: 10px; bottom: 5px; font: 14px ${SERIF}; color: #22344d; background: #fdfbf6; border: 1px solid #cbbfa9; border-radius: 999px; padding: 1px 12px; }
.book ol { list-style: none; margin: 0; padding: 0 0 0 30px; position: relative; }
.book ol::before { content: ""; position: absolute; left: 11px; top: 10px; bottom: 10px; border-left: 1.5px dashed #b9a98f; }
.book li { position: relative; margin: 0 0 16px; font-size: 14px; line-height: 1.5; }
.book li::before { content: attr(data-n); position: absolute; left: -30px; top: 2px; width: 22px; height: 22px; border-radius: 50%; background: #22344d; color: #fdfbf6; font: 500 11px/22px Oswald, sans-serif; text-align: center; }
.book li b { font: 600 19px ${SERIF}; color: #22344d; font-weight: 600; }
.book li small { display: block; color: #8a8278; font-size: 13px; }
.book .fork { margin: 6px 0 0; padding: 8px 12px; background: #fdfbf6; box-shadow: 0 4px 10px rgba(90,70,40,.1); font: 15px ${SERIF}; }
.book .fork div { padding: 2px 0 2px 18px; position: relative; color: #a0968b; }
.book .fork div::before { content: "–"; position: absolute; left: 2px; color: #c7bba7; }
.book .fork div.took { color: #22344d; font-weight: 600; }
.book .fork div.took::before { content: "➜"; color: #b6463b; }
.book .fork div.took::after { content: "${EN_ON ? "took this" : "走了这条"}"; margin-left: 8px; font: 12px "Noto Serif SC", serif; color: #b6463b; border: 1px solid #b6463b; border-radius: 999px; padding: 0 7px; }
.book .runs { margin-top: 2px; font: 15px ${SERIF}; color: #4a453f; } .book .runs span { white-space: nowrap; }
.book .heads { margin-top: 4px; padding: 3px 8px; background: #fbf1dc; border-left: 3px solid #c9a24a; font-size: 13px; color: #5b4a2e; }
.book .gear { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; } .book .gear span { font-size: 12px; padding: 1px 8px; border: 1px solid #cbbfa9; border-radius: 999px; color: #22344d; }
.book .empty { font: 16px ${SERIF}; color: #8a8278; line-height: 1.5; }
`;
let styled = false;
const style = () => { if (styled) return; styled = true; const s = document.createElement("style"); s.textContent = CSS; document.head.append(s); };

// The page for one resort. host: { name, drawMap(canvas, day, me) } where drawMap paints the day's way on
// the resort's map (me: your position now, if known); locate() asks the phone where you are.
export function renderBook(box, resort, host) {
  style();
  const days = daysOf(resort);
  box.classList.add("book");
  if (!days.length) { box.innerHTML = `<div class="bk">ROADBOOK</div><div class="bh">${t("预滑路书")}</div><div class="empty">${t("还没有。去预滑一趟，坐的缆车、在山顶的选择、滑的雪道都会一步一步记在这里。")}</div>`; return; }
  let pick = days.length - 1, me = null;
  const draw = () => {
    const day = days[pick], d = new Date(day.t0);
    let n = 0;
    const steps = day.steps.map((s) => {
      n++;
      if (s.k === "base") return `<li data-n="${n}"><b><img src="${location.pathname.includes("/mountain/") ? "../" : ""}assets/icons/lodge.png?v=1" alt="" style="width:20px;height:20px;vertical-align:-4px;margin-right:4px">${t("从 {x} 出发", { x: esc(s.name) })}</b></li>`;
      if (s.k === "lift") return `<li data-n="${n}"><b>🚡 ${t("坐 {x} 上山", { x: esc(s.name) })}</b></li>`;
      if (s.k === "top") {
        const opts = s.options.slice(0, 7), more = s.options.length - opts.length;
        if (!opts.includes(s.chose)) opts.unshift(s.chose);
        return `<li data-n="${n}"><b>🏔 ${t("到 {x} 山顶", { x: esc(s.at) })}</b><small>${t("这里可以：")}</small><div class="fork">${opts.map((o) => `<div class="${o === s.chose ? "took" : ""}">${esc(o)}</div>`).join("")}${more > 0 ? `<div>${t("…还有 {n} 条", { n: more })}</div>` : ""}</div></li>`;
      }
      if (s.k === "route") {
        const runs = s.segs.map((g) => `<span>${MARK[g.l] || ""} ${esc(g.n)}</span>`).join(" › ");
        const flats = (s.flats || []).map((f) => `<div class="heads">${f.k === "flat" ? (EN_ON ? `Flat, ${f.m} m on ${esc(f.n)} (about ${f.at} m in): carry speed, board flat` : `${esc(f.n)} 有 ${f.m} 米平路（出发后约 ${f.at} 米）：带速度、板放平`) : (EN_ON ? `Uphill, ${f.m} m on ${esc(f.n)}: you'll walk` : `${esc(f.n)} 有 ${f.m} 米上坡：要走上去`)}</div>`).join("");
        return `<li data-n="${n}"><b>${t(s.changed ? "↩ 改路线" : "⛷ 滑下去")}</b><div class="runs">${runs}</div>${flats}${s.next ? `<small>${t("到底坐 🚡 {x}", { x: esc(s.next) })} · ${t("快到底放慢，别滑过站")}</small>` : ""}</li>`;
      }
      if (s.k === "jump") return `<li data-n="${n}"><b>⏭ ${t("跳到 {x}", { x: esc(s.to) })}</b><small>${t("中间这段算看过了")}</small></li>`;
      if (s.k === "hike") return `<li data-n="${n}"><b>🥾 ${esc(s.name)}</b><small>${EN_ON ? `about ${s.mins[0]}–${s.mins[1]} min on foot${s.gain ? `, +${s.gain} m` : ""}` : `走路约 ${s.mins[0]}–${s.mins[1]} 分钟${s.gain ? `，爬升约 ${s.gain} 米` : ""}`}</small>${s.gear ? `<div class="gear">${s.gear.map((g) => `<span>${esc(g)}</span>`).join("")}</div>` : ""}</li>`;
      if (s.k === "arrive") return `<li data-n="${n}"><b>📍 ${esc(s.title)}</b></li>`;
      n--; return "";
    }).join("");
    box.innerHTML = `<div class="bk">ROADBOOK</div><div class="bh">${t("预滑路书")}</div><div class="bs">${esc(host.name)} · ${EN_ON ? `pre-run ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getDate()} · follow it on the day` : `${d.getMonth() + 1} 月 ${d.getDate()} 日预滑 · 明天照着走`}</div>
      ${days.length > 1 ? `<div class="days">${days.map((x, i) => { const t = new Date(x.t0); return `<button data-i="${i}" class="${i === pick ? "on" : ""}">${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}</button>`; }).reverse().join("")}</div>` : ""}
      <div class="photo"><canvas></canvas><span class="cap">${t("金色是这一趟的路线")}</span>${host.locate ? `<button class="me">${t(me ? "📍 我在这" : "📍 显示我在哪")}</button>` : ""}</div>
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
