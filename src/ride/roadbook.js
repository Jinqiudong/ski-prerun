// The pre-run roadbook: what you rode on a pre-run, kept on this phone, so that on the day you can follow it.
// A day is a list of legs: a lift to its top, then the run you came for (in ink) or only the way to the next
// lift (grey); legs group by area and a ski from one area to another is one short line. Tap a leg for its
// details: the times (estimated), and for each run its length, drop, steepest pitch, the snow (groomed or
// moguls, maybe powder), each with where it comes from. The map draws only what was ridden.
// The rules (steps → legs, areas, the map's lines) are in roadbook-core.js; the run facts in snow-core.js.
import { t, EN_ON } from "../core/i18n.js?v=45";
import { legsOf, blocksOf, mapItems, runOfSeg, lapTimes } from "./roadbook-core.js?v=1";
import { runFacts, powderAmount, powderField } from "./snow-core.js?v=3";
const KEY = "prerunBook", GAP = 3 * 3600e3, KEEP = 30;
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const MARK = (l) => `<i class="lv ${esc(l)}"></i>`;
// A painted icon inline (assets/icons, relative to the page: the book opens on the ride, the resort and the start page).
const ROOT = () => (location.pathname.includes("/mountain/") ? "../" : "");
const ICONS = ["lift", "snowboard", "difficulty", "groomed", "moguls", "powder", "trees", "alpine", "lodge", "trailmap", "hike"];
const ic = (n) => `<img class="ic" src="${ROOT()}assets/icons/${n}.png?v=1" alt="">`;
// The icons loaded before the page shows (no broken pictures while the map paints); the lodge for the map.
let iconsReady = null;
const preload = () => (iconsReady ||= Promise.all(ICONS.map((n) => new Promise((ok) => { const im = new Image(); im.onload = im.onerror = () => ok([n, im]); im.src = `${ROOT()}assets/icons/${n}.png?v=1`; }))).then((l) => new Map(l)));

// step: see roadbook-core.js for the kinds and their fields.
export function addStep(resort, step) {
  const all = load(), list = (all[resort] ||= []), now = Date.now();
  let day = list[list.length - 1];
  if (!day || now - day.t1 > GAP) list.push((day = { t0: now, t1: now, steps: [] }));
  const last = day.steps[day.steps.length - 1], same = (a, b) => JSON.stringify({ ...a, t: 0 }) === JSON.stringify({ ...b, t: 0 });
  if (!last || !same(last, step)) day.steps.push({ ...step, t: now }); // a page reload repeats the step: once is enough
  day.t1 = now;
  if (list.length > KEEP) list.splice(0, list.length - KEEP);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* full */ }
}
export const daysOf = (resort) => (load()[resort] || []).filter((d) => d.steps.length);
// A route's path for the book: every 4th point, whole metres.
export const thinPath = (path) => path.filter((_, i) => i % 4 === 0 || i === path.length - 1).map(([x, z]) => [Math.round(x), Math.round(z)]);

// Snow in the last three days at a place (Open-Meteo, as the ride reads it), once a session.
const snowCache = new Map();
export function recentSnow(origin) {
  const k = `${origin.lat.toFixed(3)},${origin.lon.toFixed(3)}`;
  if (!snowCache.has(k)) snowCache.set(k, fetch(`https://api.open-meteo.com/v1/forecast?latitude=${origin.lat.toFixed(4)}&longitude=${origin.lon.toFixed(4)}&daily=snowfall_sum&past_days=3&forecast_days=1&timezone=auto`)
    .then((r) => r.json()).then((w) => w.daily.snowfall_sum.slice(0, 3).reduce((a, b) => a + (b || 0), 0)).catch(() => null));
  return snowCache.get(k);
}

const SERIF = `"Cormorant Garamond", "Noto Serif SC", serif`;
const CSS = `
.bookPage { position: fixed; inset: 0; z-index: 30; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: calc(18px + env(safe-area-inset-top)) 18px 40px; background-color: #f6f1e7;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .45  0 0 0 0 .38  0 0 0 0 .3  0 0 0 .07 0'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>"); }
.bookPage .x { position: fixed; right: 14px; top: calc(12px + env(safe-area-inset-top)); width: 36px; height: 36px; border-radius: 50%; font-size: 18px; color: #22344d; background: #fdfbf6; border: 1px solid #cbbfa9; z-index: 1; }
body.bookOpen #ptPet, body.bookOpen #ptSign { display: none !important; }
.book { color: #33302c; font-family: "Noto Serif SC", serif; }
.book .bk { font: 500 10px Oswald, sans-serif; letter-spacing: .3em; color: #8a8278; }
.book .bh { font: 600 32px/1.05 ${SERIF}; color: #22344d; margin: 3px 0 2px; }
.book .bs { font: 15px ${SERIF}; color: #8a8278; margin-bottom: 8px; }
.book .days { display: flex; gap: 6px; overflow-x: auto; margin: 0 0 10px; }
.book .days button { flex: none; font: 14px ${SERIF}; color: #22344d; background: #fdfbf6; border: 1px solid #cbbfa9; border-radius: 999px; padding: 3px 12px; }
.book .days button.on { background: #22344d; color: #fdfbf6; border-color: #22344d; }
.book .photo { position: relative; background: #fdfbf6; padding: 8px 8px 30px; box-shadow: 0 8px 18px rgba(90,70,40,.16); margin: 4px 0 14px; transform: rotate(-.4deg); }
.book .photo canvas { width: 100%; height: 280px; display: block; background: #f3efe6; touch-action: none; }
.book .photo .cap { position: absolute; left: 10px; bottom: 6px; display: flex; gap: 12px; font: 12px "Noto Serif SC", serif; color: #6f665c; }
.book .cap i { display: inline-block; width: 22px; height: 0; vertical-align: 4px; margin-right: 4px; }
.book .cap .k1 { border-top: 3px solid #2a5db0; } .book .cap .k2 { border-top: 2.5px dotted #2a5db0; opacity: .7; } .book .cap .k3 { border-top: 2px dashed #22344d; }
.book .photo .me { position: absolute; right: 8px; bottom: 4px; font: 13px ${SERIF}; color: #22344d; background: #fdfbf6; border: 1px solid #cbbfa9; border-radius: 999px; padding: 1px 10px; }
.book .ar { font: 600 13px "Noto Serif SC", serif; letter-spacing: .2em; color: #8a6a4a; margin: 14px 0 4px; }
.book .lg { position: relative; display: flex; align-items: baseline; gap: 10px; padding: 9px 22px 9px 0; border-bottom: 1px solid #e3d9c7; cursor: pointer; }
.book .lg::after { content: ""; position: absolute; right: 4px; top: 50%; width: 7px; height: 7px; border-right: 1.5px solid #b9a98f; border-bottom: 1.5px solid #b9a98f; transform: translateY(-70%) rotate(45deg); }
.book .lg.open::after { transform: translateY(-30%) rotate(225deg); }
.book .lg .no { flex: none; width: 22px; height: 22px; border-radius: 50%; background: #22344d; color: #fdfbf6; font: 500 11px/22px Oswald, sans-serif; text-align: center; align-self: center; }
.book .lg .l { flex: none; max-width: 46%; font: 15px ${SERIF}; color: #6f665c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.book .lg .r { flex: 1; min-width: 0; font: 600 17px/1.3 ${SERIF}; color: #22344d; }
.book .lg .r span:not(.lnk) { white-space: nowrap; }
.book .lg .r .lnk { font-weight: 400; font-size: 15px; color: #a0968b; text-decoration: underline dotted #c9bca6 1.5px; text-underline-offset: 3px; }
.book .lg.hk { cursor: default; } .book .lg.hk::after { display: none; } .book .lg.hk .no { background: none; } .book .lg .ic { width: 22px; height: 22px; }
.book .lv { display: inline-block; width: 10px; height: 10px; margin: 0 4px 1px 0; } .book .lv.easy { background: #22b35a; border-radius: 50%; } .book .lv.intermediate { background: #1f6fe5; }
.book .lv.advanced, .book .lv.expert { background: #111; transform: rotate(45deg) scale(.85); } .book .lv.expert { box-shadow: 6px -6px 0 #111; margin-right: 9px; }
.book .xl { margin: 2px 0; padding: 7px 26px 7px 10px; border: 1.5px dashed #c9a24a; background: #fbf3df; border-radius: 3px; font: 600 14px "Noto Serif SC", serif; color: #5b4a2e; position: relative; cursor: pointer; }
.book .xl::after { content: ""; position: absolute; right: 10px; top: 50%; width: 7px; height: 7px; border-right: 1.5px solid #c9a24a; border-bottom: 1.5px solid #c9a24a; transform: translateY(-70%) rotate(45deg); }
.book .xl.open::after { transform: translateY(-30%) rotate(225deg); }
.book .xl .ic { width: 20px; height: 20px; vertical-align: -5px; margin-right: 2px; } .book .xl .n { font: 500 11px Oswald, sans-serif; display: inline-block; width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: 50%; background: #22344d; color: #fdfbf6; vertical-align: 1px; margin: 0 4px 0 2px; }
.book .endl { margin: 12px 0 0; font: 600 15px "Noto Serif SC", serif; color: #22344d; } .book .endl .ic { width: 20px; height: 20px; vertical-align: -4px; margin-right: 2px; }
.book .det { margin: 0 0 6px 32px; padding: 10px 12px 8px; background: #fdfbf6; box-shadow: 0 4px 12px rgba(90,70,40,.12); font: 14px "Noto Serif SC", serif; color: #33302c; }
.book .xl + .det { margin-left: 0; }
.book .det .tm { display: flex; gap: 14px; flex-wrap: wrap; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px dotted #cbbfa9; }
.book .det .tm span { white-space: nowrap; } .book .det .tm b { font: 600 17px ${SERIF}; color: #22344d; margin: 0 2px; }
.book .det .ic { width: 22px; height: 22px; vertical-align: -6px; margin-right: 3px; }
.book .det .rnm { font: 600 17px ${SERIF}; color: #22344d; margin: 2px 0 3px; }
.book .det .f { display: flex; align-items: center; gap: 4px; margin: 3px 0; }
.book .det .src { margin-left: auto; font-size: 11px; color: #a0968b; border: 1px solid #ddd2bf; border-radius: 999px; padding: 0 6px; white-space: nowrap; }
.book .det .src.inf { border-style: dashed; }
.book .det .via { margin-top: 8px; font-size: 12px; color: #a0968b; }
.book .det .foot { margin-top: 6px; font-size: 11px; color: #a0968b; }
.book .peek { margin-top: 16px; font: 12px "Noto Serif SC", serif; color: #a0968b; border-top: 1px dotted #cbbfa9; padding-top: 8px; }
.book .empty { font: 16px ${SERIF}; color: #8a8278; line-height: 1.5; }
`;
let styled = false;
const style = () => { if (styled) return; styled = true; const s = document.createElement("style"); s.textContent = CSS; document.head.append(s); };

const SRC = { tag: () => `<span class="src">${t("地图标注")}</span>`, terrain: () => `<span class="src">${t("地形算的")}</span>`, inferred: () => `<span class="src inf">${t("推测")}</span>` };
const SURFACE = {
  moguls: { tag: ["moguls", "蘑菇道"], inferred: ["moguls", "多半有蘑菇（陡、不压雪）"] },
  groomed: { tag: ["groomed", "压雪道"], inferred: ["groomed", "多半压过雪"] },
  offpiste: { tag: ["alpine", "野雪区，不压雪"] },
  ungroomed: { inferred: ["trees", "多半不压雪"] },
};
const km = (m) => (m >= 1000 ? t("{n} 公里", { n: (m / 1000).toFixed(1) }) : t("{n} 米", { n: Math.round(m / 10) * 10 }));

// The page for one resort. host: { name, map (a TrailMap: its T, R and mask), locate?(cb), snow?() →
// Promise<{ cm, amt, f? }> (the ride's own; else the book asks the weather) }.
export function renderBook(box, resort, host) {
  style();
  const days = daysOf(resort);
  box.classList.add("book");
  if (!days.length) { box.innerHTML = `<div class="bk">ROADBOOK</div><div class="bh">${t("预滑路书")}</div><div class="empty">${t("还没有。去预滑一趟，坐的缆车和滑的雪道都会记在这里。")}</div>`; return Promise.resolve(); }
  const tm = host.map, R = tm.R, T = tm.T, heightAt = (x, z) => T.heightAt(x, z);
  const runsById = new Map(R.runs.map((r) => [String(r.id), r])), runsByName = new Map();
  for (const r of R.runs) if (r.name && !r.area) (runsByName.get(r.name) || runsByName.set(r.name, []).get(r.name)).push(r);
  const bases = R.places.filter((p) => p.kind === "village");
  const liftLen = (name) => { const l = R.lifts.find((q) => q.name === name); if (!l) return null; let s = 0; for (let i = 1; i < l.pts.length; i++) s += Math.hypot(l.pts[i][0] - l.pts[i - 1][0], l.pts[i][1] - l.pts[i - 1][1]); return s; };
  // The snow for the facts: the ride's own when it has them, else the last three days' snowfall here.
  let snowP = null;
  const snow = () => (snowP ||= (async () => {
    const own = host.snow ? await host.snow() : null;
    const force = new URLSearchParams(location.search).get("powder");
    const cm = own?.cm ?? (R.origin ? await recentSnow(R.origin) : null), amt = own?.amt ?? powderAmount(cm, force);
    const f = own?.f || (amt > 0 && tm.mask?.grid ? powderField(T, tm.mask, R.runs, tm.mask.grid[0], tm.mask.grid[1]) : null);
    return { cm, amt, f, forced: force != null && force !== "" };
  })());
  let pick = days.length - 1, me = null, open = null;

  const detHtml = (leg, sn) => {
    const tms = lapTimes(leg, liftLen(leg.lift)), real = leg.segs.filter((s) => s.real), links = leg.segs.filter((s) => !s.real);
    let h = tms.up || tms.down ? `<div class="tm">${tms.up ? `<span>${ic("lift")}${t("坐缆车")}<b>${tms.up}</b>${t("分")}</span>` : ""}${tms.down ? `<span>${ic("snowboard")}${t("滑下")}<b>${tms.down}</b>${t("分")}</span>` : ""}${tms.lap ? `<span>${t("一圈约")}<b>${tms.lap}</b>${t("分")}</span>` : ""}</div>` : "";
    for (const s of real) {
      const { run, pts } = runOfSeg(s, leg, runsById, runsByName);
      h += `<div class="rnm" translate="no">${MARK(s.l)}${esc(s.n)}</div>`;
      if (!run || !pts || pts.length < 2) { h += `<div class="f">${t("这条雪道在地图数据里找不到")}</div>`; continue; }
      const f = runFacts(run, pts, heightAt, sn && sn.f ? { f: sn.f, amt: sn.amt } : null);
      h += `<div class="f">${ic("difficulty")}${km(s.len || f.len)} · ${t("落差 {n} 米", { n: s.drop ?? f.drop })} · ${t("最陡 {n}°", { n: f.pitch })}${SRC.terrain()}</div>`;
      const [icon, words] = SURFACE[f.surface.k]?.[f.surface.src] || SURFACE.ungroomed.inferred;
      h += `<div class="f">${ic(icon)}${f.surface.wild ? t("树林 / 碗区，") : ""}${t(words)}${SRC[f.surface.src]()}</div>`;
      if (f.powder) h += `<div class="f">${ic("powder")}${t(f.powder.k === "edges" ? "两边可能有粉雪，中间压实了" : "可能整条都有粉雪")}${SRC.inferred()}</div>`;
    }
    if (links.length) {
      const flat = links.some((s) => s.len >= 120 && Math.atan2(s.drop || 0, s.len) * 57.3 <= 4);
      h += `<div class="via">${t("过渡")} <span translate="no">${links.map((s) => esc(s.n)).join(" · ")}</span>${flat ? ` · ${t("有平路，带速度")}` : ""}</div>`;
    }
    if (leg.partial) h += `<div class="via">${t("中间在地图上跳过了一段")}</div>`;
    const sw = !sn ? "" : sn.forced ? t("粉雪：预览强制") : sn.cm == null ? t("没拿到降雪数据，不说粉雪") : t("粉雪按近 3 天降雪 {n} cm", { n: (sn.cm || 0).toFixed(1) });
    h += `<div class="foot">${t("时间是估算")}${sw ? ` · ${sw}` : ""}</div>`;
    return `<div class="det">${h}</div>`;
  };
  const rowHtml = (leg) => {
    if (leg.hike) return `<div class="lg hk"><span class="no">${ic("hike")}</span><span class="r">${esc(leg.name)}</span></div>`;
    const real = leg.segs.filter((s) => s.real), going = leg.go && leg.go.kind !== "run" && leg.end;
    // a way picked to get somewhere: where, after the runs skied on the way (grey)
    const then = going ? ` <span class="lnk">${leg.end.k === "base" ? t("回 {x}", { x: esc(leg.end.name) }) : t("去接 {x}", { x: esc(leg.end.name) })}</span>` : "";
    const runs = real.length ? real.map((s) => `<span>${MARK(s.l)}${esc(s.n)}</span>`).join(" ") + then
      : leg.end?.k === "base" ? `<span class="lnk">${t("回 {x}", { x: esc(leg.end.name) })}</span>`
        : leg.end ? `<span class="lnk">${t("去接 {x}", { x: esc(leg.end.name) })}</span>`
          : `<span class="lnk">${leg.segs.map((s) => esc(s.n)).join(" · ") || "…"}</span>`;
    return `<div class="lg${open === leg.no ? " open" : ""}" data-no="${leg.no}"><span class="no">${leg.no}</span><span class="l" translate="no">${esc(leg.lift)} ›</span><span class="r" translate="no">${runs}</span></div>`;
  };
  const xferHtml = (b) => {
    const l = b.xfer, real = l.segs.filter((s) => s.real), via = (real.length ? real : l.segs.slice(0, 1)).map((s) => esc(s.n)).join(" › ");
    return `<div class="xl${open === l.no ? " open" : ""}" data-no="${l.no}">${ic("trailmap")}${t("换到 {x}：", { x: esc(b.to) })}<span class="n">${l.no}</span><span translate="no">${esc(l.lift)}${via ? ` › ${via}` : ""}</span></div>`;
  };

  const draw = async () => {
    const day = days[pick], d = new Date(day.t0), parsed = legsOf(day), rides = parsed.legs.filter((l) => !l.hike);
    const blocks = blocksOf(parsed.legs, { lifts: R.lifts, bases, runsById });
    const icons = await preload();
    const sn = open != null ? await snow() : null;
    let html = `<div class="bk">ROADBOOK</div><div class="bh">${t("预滑路书")}</div><div class="bs">${esc(host.name)} · ${EN_ON ? `pre-run ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getDate()}` : `${d.getMonth() + 1} 月 ${d.getDate()} 日预滑`}</div>`;
    if (days.length > 1) html += `<div class="days">${days.map((x, i) => { const q = new Date(x.t0); return `<button data-i="${i}" class="${i === pick ? "on" : ""}">${q.getMonth() + 1}/${q.getDate()} ${String(q.getHours()).padStart(2, "0")}:${String(q.getMinutes()).padStart(2, "0")}</button>`; }).reverse().join("")}</div>`;
    if (!rides.length) {
      html += `<div class="empty">${t("这一天还没坐上过缆车。")}</div>`;
    } else {
      html += `<div class="photo"><canvas></canvas><span class="cap"><span><i class="k1"></i>${t("完整一趟")}</span><span><i class="k2"></i>${t("过渡")}</span><span><i class="k3"></i>${t("缆车")}</span></span>${host.locate ? `<button class="me">${t(me ? "我在这" : "显示我在哪")}</button>` : ""}</div>`;
      for (const b of blocks) {
        if (b.xfer) { html += xferHtml(b); if (open === b.xfer.no) html += detHtml(b.xfer, sn); continue; }
        if (b.area) html += `<div class="ar" translate="no">${esc(b.area)}</div>`;
        for (const l of b.legs) { html += rowHtml(l); if (!l.hike && open === l.no) html += detHtml(l, sn); }
      }
      const last = rides[rides.length - 1];
      if (last.end?.k === "base") html += `<div class="endl">${ic("lodge")}${t("收工 · {x}", { x: esc(last.end.name) })}</div>`;
    }
    if (parsed.peeks.length) html += `<div class="peek">${t("只打开看了、没坐上去的缆车不记：{x}", { x: parsed.peeks.map(esc).join("、") })}</div>`;
    const top = box.parentElement?.scrollTop;
    box.innerHTML = html;
    if (top != null) box.parentElement.scrollTop = top;
    for (const b of box.querySelectorAll(".days button")) b.onclick = () => { pick = +b.dataset.i; open = null; draw(); };
    for (const r of box.querySelectorAll(".lg[data-no], .xl[data-no]")) r.onclick = () => { open = open === +r.dataset.no ? null : +r.dataset.no; draw(); };
    const cv = box.querySelector("canvas");
    if (!cv) return;
    const items = mapItems(parsed, { runsById, runsByName, lifts: R.lifts, bases });
    const paint = () => { const dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); tm.drawBook(cv, items, { dpr, lodge: icons.get("lodge"), you: me }); };
    await new Promise((ok) => requestAnimationFrame(() => { paint(); ok(); }));
    box.querySelector(".me")?.addEventListener("click", () => host.locate((p) => { me = p; paint(); box.querySelector(".me").textContent = t(p ? "我在这" : "找不到位置"); }));
  };
  return draw();
}

// The page over everything, with a close button (the party's pet steps aside while it's open).
export function openBookPage(resort, host) {
  const page = document.createElement("div"), body = document.createElement("div");
  page.className = "bookPage"; page.innerHTML = `<button class="x" aria-label="${t("关闭")}">×</button>`;
  page.append(body); document.body.append(page); document.body.classList.add("bookOpen");
  page.querySelector(".x").onclick = () => { page.remove(); if (!document.querySelector(".bookPage")) document.body.classList.remove("bookOpen"); };
  return renderBook(body, resort, host);
}
// Where the phone is, in the resort's metres (the same flat projection as tools/bake.py).
export const locateIn = (origin) => (cb) => {
  if (!navigator.geolocation) return cb(null);
  navigator.geolocation.getCurrentPosition((p) => cb({ x: (p.coords.longitude - origin.lon) * 111320 * Math.cos((origin.lat * Math.PI) / 180), z: -(p.coords.latitude - origin.lat) * 110574, heading: (p.coords.heading || 0) * Math.PI / 180 }), () => cb(null), { enableHighAccuracy: true, timeout: 15000 });
};
