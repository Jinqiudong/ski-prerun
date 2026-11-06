// Snow memory, by ski season (November to April): the season at a glance (trips, days, mountains, runs,
// and who you skied with, by their faces), then one group photo per ski day: that mountain's watercolour
// behind, the people who skied it in front as their own riders, and from a trip's second day on, the day
// before held up in a frame. Each photo is rendered once (photo.js), kept in IndexedDB, and only made when
// it scrolls near; tap one to see it large and save or share it.
import { t, EN_ON, myAvatar } from "../core/i18n.js?v=25";
import { memberId } from "./shared-trip.js?v=1";
import { myRiderLook } from "../core/look.js?v=1";
import { buildSeasons, seasonOf, seasonName, seasonShort, photoKey, ymd } from "./season.js?v=1";

const PHOTO_V = 2; // photo.js VERSION (kept here so the cache is read without loading three.js)
const C = { ink: "#22344d", navy: "#262f4c", red: "#b6463b", card: "#fdfbf6", mute: "#8a8278" };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const paint = (id) => (id ? `assets/wc/${id}.jpg?v=1` : "assets/wc/colorado.jpg?v=1");
const dateOf = (d) => { const x = new Date(d + "T00:00:00"); return `${MON[x.getMonth()]} ${x.getDate()}`; };
const ICON = (n, cls = "") => `<img class="${cls}" src="assets/icons/${n}.png?v=1" alt="">`;

const CSS = `
.mem2 { margin: 0 -14px 18px; }
.mem2 .mh { background: ${C.navy}; color: #f1ebe0; text-align: center; margin-top: calc(-1 * env(safe-area-inset-top)); padding: calc(26px + env(safe-area-inset-top)) 18px 22px; border-radius: 0 0 22px 22px; }
.mem2 .k { font: 500 11px Oswald, sans-serif; letter-spacing: .32em; color: #c9c4d6; }
.mem2 .h { font: 600 34px/1.15 "Cormorant Garamond", "Noto Serif SC", serif; color: #f6efe3; margin-top: 6px; }
.mem2 .chips { display: flex; justify-content: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.mem2 .chips button { font: 15px "Cormorant Garamond", "Noto Serif SC", serif; color: #e9e3d6; background: transparent; border: 1px solid rgba(233,227,214,.45); border-radius: 999px; padding: 3px 13px; cursor: pointer; }
.mem2 .chips button.on { background: #f6efe3; color: ${C.ink}; border-color: #f6efe3; }
.mem2 .nums { display: flex; justify-content: center; gap: 22px; margin-top: 14px; }
.mem2 .nums div { display: grid; justify-items: center; }
.mem2 .nums b { font: 600 30px/1.1 "Cormorant Garamond", serif; color: #f6efe3; }
.mem2 .nums small { font: 12px "Noto Serif SC", serif; color: #c9c4d6; }
.mem2 .crew { display: flex; justify-content: center; margin-top: 14px; }
.mem2 .crew img { width: 46px; height: 46px; border-radius: 50%; border: 2px solid #f6efe3; background: #e6ebee; margin-left: -8px; box-shadow: 0 3px 6px rgba(0,0,0,.25); }
.mem2 .crew img:first-child { margin-left: 0; }
.mem2 .with { font: 14px "Noto Serif SC", serif; color: #d9d3e2; margin-top: 6px; }
.mem2 .photos { padding: 18px 16px 4px; display: grid; gap: 22px; }
.mem2 .ph { background: ${C.card}; padding: 10px 10px 12px; box-shadow: 0 8px 18px rgba(90,70,40,.18); cursor: pointer; transform: rotate(var(--tilt, 0deg)); }
.mem2 .ph .img { position: relative; aspect-ratio: 900 / 700; background: #e7e5e0 center/cover; overflow: hidden; }
.mem2 .ph .img .wash { position: absolute; inset: 0; background: center/cover; opacity: .45; }
.mem2 .ph .img .dev { position: absolute; left: 0; right: 0; bottom: 12px; text-align: center; font: 500 10px Oswald, sans-serif; letter-spacing: .3em; color: #6f7684; }
.mem2 .ph .img img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; opacity: 0; transition: opacity .5s; }
.mem2 .ph .img img.in { opacity: 1; }
.mem2 .ph .cap { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin: 10px 4px 0; }
.mem2 .ph .cap b { font: 600 22px/1.2 "Cormorant Garamond", "Noto Serif SC", serif; color: ${C.ink}; }
.mem2 .ph .cap small { font: 15px "Cormorant Garamond", serif; color: ${C.mute}; white-space: nowrap; }
.mem2 .ph .line { font: italic 14px "Cormorant Garamond", "Noto Serif SC", serif; color: #7b746b; margin: 2px 4px 0; }
.mem2 .empty { font: 16px/1.6 "Cormorant Garamond", "Noto Serif SC", serif; color: #6f675e; padding: 26px 22px 6px; text-align: center; }
.memshot { position: fixed; inset: 0; z-index: 30; overflow-y: auto; background: #f6efe3; padding: calc(18px + env(safe-area-inset-top)) 16px 40px; color: #3d3a36; }
.memshot .x { position: fixed; right: 14px; top: calc(12px + env(safe-area-inset-top)); width: 38px; height: 38px; border-radius: 50%; font-size: 20px; color: ${C.ink}; background: #fffdf8; border: 1px solid #cbbfa9; z-index: 2; }
.memshot .k { font: 500 10px Oswald, sans-serif; letter-spacing: .3em; color: ${C.mute}; }
.memshot .frame { background: ${C.card}; padding: 12px 12px 16px; margin-top: 14px; box-shadow: 0 10px 22px rgba(90,70,40,.2); }
.memshot .frame img { width: 100%; display: block; aspect-ratio: 900 / 700; background: #e7e5e0; }
.memshot .frame b { display: block; font: 600 26px/1.2 "Cormorant Garamond", "Noto Serif SC", serif; color: ${C.ink}; margin-top: 10px; }
.memshot .frame small { font: 15px "Cormorant Garamond", "Noto Serif SC", serif; color: ${C.mute}; }
.memshot .who { font: 15px "Noto Serif SC", serif; color: #6f675e; margin-top: 6px; }
.memshot .acts { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
.memshot .acts button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; font: 16px "Cormorant Garamond", "Noto Serif SC", serif; color: #fffdf8; background: ${C.ink}; border: 0; border-radius: 999px; padding: 8px 12px; white-space: nowrap; }
.memshot .acts button img { width: 22px; height: 22px; }
.memshot .acts button.o { color: ${C.ink}; background: #fdfbf6; border: 1px solid #cbbfa9; }
`;
let styled = false;
const style = () => { if (styled) return; styled = true; const s = document.createElement("style"); s.textContent = CSS; document.head.append(s); };

// ---- The photo cache: IndexedDB (a JPEG blob per photo key), and the blobs' URLs for this visit.
const urls = new Map(), blobs = new Map();
let dbp = null;
const db = () => (dbp ||= new Promise((ok) => {
  try { const r = indexedDB.open("prerunMemory", 1); r.onupgradeneeded = () => r.result.createObjectStore("photos"); r.onsuccess = () => { ok(r.result); prune(r.result); }; r.onerror = () => ok(null); } catch { ok(null); }
}));
// Photos made by an older version are let go.
function prune(d) { try { const s = d.transaction("photos", "readwrite").objectStore("photos"), q = s.getAllKeys(); q.onsuccess = () => { for (const k of q.result) if (!String(k).startsWith(`p${PHOTO_V}:`)) s.delete(k); }; } catch { /* fine */ } }
async function idb(mode, fn) {
  const d = await db(); if (!d) return null;
  return new Promise((ok) => { try { const q = fn(d.transaction("photos", mode).objectStore("photos")); q.onsuccess = () => ok(q.result ?? null); q.onerror = () => ok(null); } catch { ok(null); } });
}
const make = (d) => async () => (await import("./photo.js?v=1")).renderPhoto({ resort: d.resort, held: d.held || undefined, people: d.people, holder: d.holder });
const pending = new Map();
const photoURL = (d) => { const k = photoKey(d, PHOTO_V); if (!pending.has(k)) pending.set(k, fetchPhoto(d, k).finally(() => pending.delete(k))); return pending.get(k); };
async function fetchPhoto(d, k) {
  if (urls.has(k)) return urls.get(k);
  let b = await idb("readonly", (s) => s.get(k));
  if (!(b instanceof Blob)) { b = await make(d)(); idb("readwrite", (s) => s.put(b, k)); }
  blobs.set(k, b);
  const u = URL.createObjectURL(b); urls.set(k, u); return u;
}

// ---- The words of a day.
function words(d, S, name) {
  const at = d.resort ? name(d.resort) : null, date = dateOf(d.date);
  const title = d.trip ? (at ? `${at} · ${t("第 {n} 天", { n: d.n })}` : t("还没定雪场的那天")) : `${at} · ${t("预滑")}`;
  let line;
  if (d.held) line = d.held.resort ? t("手里是前一天的 {x}", { x: name(d.held.resort) }) : t("手里是前一天的雪山");
  else if (d.trip && S.days[S.days.length - 1] === d) line = t("开板第一天");
  else if (d.trip) line = t("「{x}」的第一天", { x: d.trip.name || t("行程") });
  else line = d.runs.length ? d.runs.slice(0, 3).join(" · ") : t("一个人的预滑");
  if (d.trip && !d.resort && !d.held) line = d.trip.name ? `「${d.trip.name}」 · ${t("第 {n} 天", { n: d.n })}` : t("第 {n} 天", { n: d.n });
  return { title, date, line };
}
const withLine = (names) => {
  const shown = names.slice(0, 4), more = names.length - shown.length;
  if (EN_ON) return more ? `with ${shown.join(", ")} and ${more} more` : `with ${shown.slice(0, -1).join(", ")}${shown.length > 1 ? " and " : ""}${shown[shown.length - 1]}`;
  return `和 ${shown.join("、")}${more ? ` 等 ${names.length} 人` : ""} 一起滑`;
};

// ---- The page.
let live = null; // this render's observer, let go on the next
export function renderMemory(box, { resorts, openBook }) {
  style();
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || d); } catch { return JSON.parse(d); } };
  const byId = Object.fromEntries(resorts.map((r) => [r.id, r]));
  const name = (id) => byId[id]?.name.replace(/ Mountain$| Basin$/, "") || id;
  const today = ymd(new Date()), now = seasonOf(today);
  const seasons = buildSeasons({ trips: read("prerunTrips", "[]"), book: read("prerunBook", "{}"), valid: (id) => !!byId[id], today,
    me: { id: memberId(), name: "我", avatar: myAvatar(), rider: myRiderLook() } });
  if (!seasons.some((s) => s.season === now)) seasons.push({ season: now, days: [], friends: [], stats: { trips: 0, days: 0, mountains: 0, runs: 0 } });
  seasons.sort((a, b) => b.season - a.season);
  let cur = (seasons.find((s) => s.season === now && s.days.length) || seasons.find((s) => s.days.length) || seasons[0]).season;
  box.className = "mem2";
  const draw = () => {
    live?.stop();
    const S = seasons.find((s) => s.season === cur), st = S.stats, names = S.friends.map((p) => p.name).filter(Boolean);
    box.innerHTML = `<div class="mh"><div class="k">SNOW MEMORY</div><div class="h">${seasonName(S.season)} ${t("雪季")}</div>
      ${seasons.length > 1 ? `<div class="chips">${seasons.map((s) => `<button data-s="${s.season}" class="${s.season === cur ? "on" : ""}">${seasonShort(s.season)}</button>`).join("")}</div>` : ""}
      <div class="nums">${[[st.trips, "趟行程"], [st.days, "天"], [st.mountains, "座山"], [st.runs, "条雪道"]].map(([n, w]) => `<div><b>${n}</b><small>${t(w)}</small></div>`).join("")}</div>
      ${S.friends.length ? `<div class="crew">${S.friends.slice(0, 8).map((p) => ICON(p.avatar)).join("")}</div><div class="with" translate="no">${esc(withLine(names))}</div>` : S.days.length ? `<div class="with">${t("一个人的雪季")}</div>` : ""}</div>
      ${S.days.length ? `<div class="photos">${S.days.map((d, i) => { const w = words(d, S, name); return `<figure class="ph" data-i="${i}" style="--tilt:${[-0.8, 0.7, -0.4, 0.9][i % 4]}deg;margin:0">
        <div class="img"><div class="wash" style="background-image:url(${paint(d.resort)})"></div><div class="dev">${t("冲洗中…")}</div></div>
        <div class="cap"><b translate="no">${esc(w.title)}</b><small>${w.date}</small></div><div class="line" translate="no">${esc(w.line)}</div></figure>`; }).join("")}</div>`
        : `<div class="empty">${t(S.season === now ? "这个雪季还没开板。去预滑一趟，或者和朋友去滑，每天都会在这里留一张合照。" : "这个雪季没有记录。")}</div>`}`;
    for (const b of box.querySelectorAll(".chips button")) b.onclick = () => { cur = +b.dataset.s; draw(); };
    const figs = [...box.querySelectorAll(".ph")];
    for (const f of figs) f.onclick = () => openShot(S.days[+f.dataset.i], S, name, openBook);
    live = develop(box, figs, S.days);
  };
  draw();
}

// Make the photos near the screen, one at a time, nearest first; the rest wait until they scroll near.
function develop(box, figs, days) {
  const near = new Set(), done = new Set();
  let busy = false, stopped = false;
  const show = (f, u) => { const im = new Image(); im.alt = ""; im.onload = () => im.classList.add("in"); im.src = u; f.querySelector(".img").append(im); };
  const pump = async () => {
    if (busy || stopped) return;
    const mid = innerHeight / 2, next = [...near].filter((f) => !done.has(f)).sort((a, b) => Math.abs(a.getBoundingClientRect().top - mid) - Math.abs(b.getBoundingClientRect().top - mid))[0];
    if (!next) return;
    busy = true; done.add(next);
    try { const u = await photoURL(days[+next.dataset.i]); if (!stopped) show(next, u); }
    catch (e) { console.warn("photo", e); next.querySelector(".dev").textContent = ""; }
    busy = false; pump();
  };
  const io = new IntersectionObserver((es) => { for (const e of es) { if (e.isIntersecting) near.add(e.target); else near.delete(e.target); } pump(); }, { root: box.closest("#records"), rootMargin: "500px 0px" });
  for (const f of figs) io.observe(f);
  return { stop() { stopped = true; io.disconnect(); } };
}

// One photo, large: share it, save it, or open that day's roadbook.
async function openShot(d, S, name, openBook) {
  const w = words(d, S, name), el = document.createElement("div");
  el.className = "memshot";
  const who = d.people.map((p) => (p.me ? t("我") : p.name)).filter(Boolean);
  const canShare = !!navigator.share && !!navigator.canShare;
  el.innerHTML = `<button class="x" aria-label="close">×</button><div class="k">SNOW MEMORY · ${seasonName(S.season)}</div>
    <div class="frame"><img alt=""><b translate="no">${esc(w.title)}</b><small translate="no">${w.date} · ${esc(w.line)}</small>
      <div class="who" translate="no">${esc(who.join(" · "))}</div></div>
    <div class="acts">${canShare ? `<button class="share">${ICON("photo")}${t("分享")}</button>` : ""}<button class="save ${canShare ? "o" : ""}">${canShare ? "" : ICON("photo")}${t("存到手机")}</button>
      ${d.prerun && d.resort ? `<button class="o bk">${ICON("trailmap")}${t("预滑路书")}</button>` : ""}<button class="o close">${t("合上")}</button></div>`;
  document.body.append(el);
  const close = () => el.remove();
  el.querySelector(".x").onclick = close; el.querySelector(".close").onclick = close;
  el.querySelector(".bk")?.addEventListener("click", () => { close(); openBook(d.resort); });
  const u = await photoURL(d).catch(() => null); if (!u || !el.isConnected) return;
  el.querySelector("img").src = u;
  const k = photoKey(d, PHOTO_V), file = () => new File([blobs.get(k)], `snow-${d.date}${d.resort ? "-" + d.resort : ""}.jpg`, { type: "image/jpeg" });
  const save = () => { const a = document.createElement("a"); a.href = u; a.download = `snow-${d.date}.jpg`; document.body.append(a); a.click(); a.remove(); };
  el.querySelector(".save").onclick = save;
  el.querySelector(".share")?.addEventListener("click", async () => {
    const f = file();
    if (navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: w.title }); } catch { /* cancelled */ } } else save();
  });
}
