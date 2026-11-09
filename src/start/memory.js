// Snow memory: every ski day becomes a card, a group photo of who skied it (photo.js: the owner's crayon
// snowboarders in front of that mountain's watercolour), stacked into a deck you flip back through: swipe up
// to send the front card to the back. Chips at the top pick a season (November to April) or all of them;
// the season's trips, days, mountains and runs and the friends on them sit above the deck. Each photo is
// drawn once and kept in IndexedDB, and only the cards at the front of the deck are drawn. Tap the front
// card to see it large and share or save it.
import { t, EN_ON, myAvatar } from "../core/i18n.js?v=50";
import { memberId } from "./shared-trip.js?v=2";
import { myRiderLook } from "../core/look.js?v=21";
import { buildSeasons, summary, seasonOf, seasonName, seasonShort, photoKey, ymd } from "./season.js?v=19";

const PHOTO_V = 3; // bump when photo.js draws photos differently (older ones are let go)
const C = { ink: "#22344d", red: "#b6463b", card: "#f8f1e4", mute: "#8a8278" };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const paint = (id) => (id ? `assets/wc/${id}.jpg?v=1` : "assets/wc/colorado.jpg?v=6");
const day0 = (d) => new Date(d + "T00:00:00");
const dateOf = (d) => { const x = day0(d); return EN_ON ? `${MON[x.getMonth()]} ${x.getDate()}` : `${x.getMonth() + 1} 月 ${x.getDate()} 日`; };
const monthOf = (d) => { const x = day0(d); return `${MON[x.getMonth()]} ${x.getFullYear()}`; };
const stampOf = (d) => { const x = day0(d); return EN_ON ? `${MON[x.getMonth()]} ${x.getDate()}` : `${x.getMonth() + 1} · ${x.getDate()}`; };
const ICON = (n, cls = "") => `<img class="${cls}" src="assets/icons/${n}.png?v=1" alt="">`;

const CSS = `
#records { background: #2f3552; }
.mem { margin: 0 -14px 18px; padding: 18px 0 20px; background: linear-gradient(#3d4466, #2f3552); color: #f1ebe0; text-align: center; overflow: hidden; }
.mem .k { font: 500 10px Oswald, sans-serif; letter-spacing: .3em; color: #c9c2d8; }
.mem .h { font: 600 30px/1.1 "Cormorant Garamond", "Noto Serif SC", serif; color: #f6efe3; margin-top: 4px; }
.mem .chips { display: flex; justify-content: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; padding: 0 12px; }
.mem .chips button { font: 15px "Cormorant Garamond", "Noto Serif SC", serif; color: #e9e3d6; background: transparent; border: 1px solid rgba(233,227,214,.4); border-radius: 999px; padding: 2px 13px; cursor: pointer; }
.mem .chips button.on { background: #f6efe3; color: ${C.ink}; border-color: #f6efe3; }
.mem .nums { display: flex; justify-content: center; gap: 22px; margin-top: 12px; }
.mem .nums div { display: grid; justify-items: center; }
.mem .nums b { font: 600 26px/1.1 "Cormorant Garamond", serif; color: #f6efe3; }
.mem .nums small { font: 12px "Noto Serif SC", serif; color: #b8b2c9; }
.mem .crew { display: flex; justify-content: center; margin-top: 12px; }
.mem .crew img { width: 40px; height: 40px; border-radius: 50%; border: 2px solid #f6efe3; background: #e6ebee; margin-left: -8px; box-shadow: 0 3px 6px rgba(0,0,0,.25); }
.mem .crew img:first-child { margin-left: 0; }
.mem .with { font: 14px "Noto Serif SC", serif; color: #b8b2c9; margin-top: 5px; }
.mem .stack { position: relative; height: 400px; margin: 44px auto 0; width: 310px; perspective: 900px; touch-action: pan-x; user-select: none; -webkit-user-select: none; }
.mem .mcard { position: absolute; left: 0; right: 0; top: 0; background: ${C.card}; border-radius: 14px; box-shadow: 0 10px 24px rgba(0,0,0,.35); overflow: hidden; text-align: left; transform-origin: 50% 0; transition: transform .5s cubic-bezier(.3,.7,.3,1), opacity .35s, filter .5s; cursor: pointer; }
.mem .mcard .top { display: flex; justify-content: space-between; padding: 10px 14px 4px; font: 12px "Cormorant Garamond", "Noto Serif SC", serif; color: #7b746b; letter-spacing: .04em; }
.mem .mcard .top b { font-weight: 500; color: ${C.red}; white-space: nowrap; margin-left: 8px; flex: none; } .mem .mcard .top span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mem .mcard .pic { position: relative; aspect-ratio: 900 / 700; margin: 4px 12px 0; background: #e7e5e0 center/cover; overflow: hidden; }
.mem .mcard .pic .dev { position: absolute; left: 0; right: 0; bottom: 10px; text-align: center; font: 500 10px Oswald, sans-serif; letter-spacing: .3em; color: #5f6675; }
.mem .mcard .pic img.ph { position: absolute; inset: 0; width: 100%; height: 100%; display: block; opacity: 0; transition: opacity .5s; }
.mem .mcard .pic img.ph.in { opacity: 1; }
.mem .mcard .foot { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 10px 16px 14px; }
.mem .mcard .foot b { font: 600 22px "Cormorant Garamond", "Noto Serif SC", serif; color: #33302c; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .mem .mcard .foot small { font: 14px "Cormorant Garamond", "Noto Serif SC", serif; color: #7b746b; white-space: nowrap; }
.mem .mcard .seal { position: absolute; right: 8px; top: 8px; width: 62px; height: 62px; transform: rotate(10deg); filter: drop-shadow(0 3px 4px rgba(0,0,0,.25)); z-index: 1; }
.mem .hint { font: 14px "Cormorant Garamond", "Noto Serif SC", serif; color: #b8b2c9; margin-top: 8px; }
.mem .empty { font: 16px "Cormorant Garamond", "Noto Serif SC", serif; color: #d8d2e4; padding: 30px 30px 10px; line-height: 1.5; }
.memshot { position: fixed; inset: 0; z-index: 30; overflow-y: auto; background: #f6efe3; padding: calc(18px + env(safe-area-inset-top)) 16px 40px; color: #3d3a36; }
.memshot .x { position: fixed; right: 14px; top: calc(12px + env(safe-area-inset-top)); width: 38px; height: 38px; border-radius: 50%; font-size: 20px; color: ${C.ink}; background: #fffdf8; border: 1px solid #cbbfa9; z-index: 2; }
.memshot .k { font: 500 10px Oswald, sans-serif; letter-spacing: .3em; color: ${C.mute}; }
.memshot .frame { background: #fdfbf6; padding: 12px 12px 16px; margin-top: 14px; box-shadow: 0 10px 22px rgba(90,70,40,.2); }
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
const seal = (label) => `<svg class="seal" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#fbf7ef"/><circle cx="50" cy="50" r="40" fill="none" stroke="${C.red}" stroke-width="2.4"/><circle cx="50" cy="50" r="33" fill="none" stroke="${C.red}" stroke-width="1" stroke-dasharray="2 3"/><path d="M30 60 L42 44 L50 52 L58 40 L72 60Z" fill="${C.red}" opacity=".85"/><text x="50" y="76" text-anchor="middle" font-family="Cormorant Garamond" font-size="11" font-weight="600" fill="${C.red}">${esc(label)}</text><text x="50" y="32" text-anchor="middle" font-family="Oswald" font-size="7" letter-spacing="1.5" fill="${C.red}">PRE-RUN</text></svg>`;

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
// One photo at a time: the drawing is quick, but a phone shouldn't do several at once while you swipe.
let line = Promise.resolve();
const draw = (d) => { const p = line.then(async () => (await import("./photo.js?v=5")).renderPhoto({ resort: d.resort, date: d.date, people: d.people })); line = p.catch(() => {}); return p; };
const pending = new Map();
const photoURL = (d) => { const k = photoKey(d, PHOTO_V); if (!pending.has(k)) pending.set(k, fetchPhoto(d, k).finally(() => pending.delete(k))); return pending.get(k); };
async function fetchPhoto(d, k) {
  if (urls.has(k)) return urls.get(k);
  let b = await idb("readonly", (s) => s.get(k));
  if (!(b instanceof Blob)) { b = await draw(d); idb("readwrite", (s) => s.put(b, k)); }
  blobs.set(k, b);
  const u = URL.createObjectURL(b); urls.set(k, u); return u;
}

// ---- The words of a day: a title, and a line under it.
function words(d, first, name) {
  const at = d.resort ? name(d.resort) : null;
  const title = d.trip ? (at ? `${at} · ${t("第 {n} 天", { n: d.n })}` : t("还没定雪场的那天")) : `${at} · ${t("预滑")}`;
  let line;
  if (d.runs.length) line = d.runs.slice(0, 3).join(" · ");
  else if (d === first) line = t("开板第一天");
  else if (d.trip) line = d.trip.name ? `「${d.trip.name}」${at ? "" : ` · ${t("第 {n} 天", { n: d.n })}`}` : t("第 {n} 天", { n: d.n });
  else line = t("一个人的预滑");
  return { title, line };
}
const withLine = (names) => {
  const shown = names.slice(0, 4), more = names.length - shown.length;
  if (EN_ON) return more ? `with ${shown.join(", ")} and ${more} more` : `with ${shown.slice(0, -1).join(", ")}${shown.length > 1 ? " and " : ""}${shown[shown.length - 1]}`;
  return `和 ${shown.join("、")}${more ? ` 等 ${names.length} 人` : ""} 一起滑`;
};

// ---- The page.
export function renderMemory(box, { resorts, openBook }) {
  style();
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || d); } catch { return JSON.parse(d); } };
  const byId = Object.fromEntries(resorts.map((r) => [r.id, r]));
  const name = (id) => byId[id]?.name.replace(/ Mountain$| Basin$/, "") || id;
  const today = ymd(new Date()), now = seasonOf(today);
  const seasons = buildSeasons({ trips: read("prerunTrips", "[]"), book: read("prerunBook", "{}"), valid: (id) => !!byId[id], today,
    me: { id: memberId(), name: "我", avatar: myAvatar(), rider: myRiderLook() } });
  if (!seasons.some((s) => s.season === now)) seasons.push({ season: now, days: [], ...summary([]) });
  seasons.sort((a, b) => b.season - a.season);
  // "all": every season's days together.
  const all = seasons.flatMap((s) => s.days), ALL = { season: "all", days: all, ...summary([...all].reverse()) };
  const pick = (seasons.find((s) => s.season === now && s.days.length) || seasons.find((s) => s.days.length) || seasons[0]).season;
  box.className = "mem";
  const show = (cur) => {
    const S = cur === "all" ? ALL : seasons.find((s) => s.season === cur), st = S.stats, list = S.days, first = list[list.length - 1];
    const names = S.friends.map((p) => p.name).filter(Boolean);
    box.innerHTML = `<div class="k">SNOW MEMORY</div><div class="h">${cur === "all" ? t("我的雪季") : `${seasonName(cur)} ${t("雪季")}`}</div>
      <div class="chips">${seasons.map((s) => `<button data-s="${s.season}" class="${s.season === cur ? "on" : ""}">${seasonShort(s.season)}</button>`).join("")}${seasons.length > 1 ? `<button data-s="all" class="${cur === "all" ? "on" : ""}">${t("全部")}</button>` : ""}</div>
      <div class="nums">${[[st.trips, "趟行程"], [st.days, "天"], [st.mountains, "座山"], [st.runs, "条雪道"]].map(([n, w]) => `<div><b>${n}</b><small>${t(w)}</small></div>`).join("")}</div>
      ${S.friends.length ? `<div class="crew">${S.friends.slice(0, 8).map((p) => ICON(p.avatar)).join("")}</div><div class="with" translate="no">${esc(withLine(names))}</div>` : ""}
      ${list.length ? `<div class="stack">${list.map((d, k) => { const w = words(d, first, name); return `<div class="mcard" data-k="${k}"><div class="top"><span translate="no">${esc(w.line)}</span><b>${monthOf(d.date)}</b></div>
        <div class="pic" style="background-image:url(${paint(d.resort)})">${d.prerun && !d.trip ? seal(stampOf(d.date)) : ""}<div class="dev">${t("冲洗中…")}</div></div>
        <div class="foot"><b translate="no">${esc(w.title)}</b><small>${dateOf(d.date)}</small></div></div>`; }).join("")}</div>
        <div class="hint">${list.length > 1 ? t("向上翻，一张一张往回看") : ""}</div>`
        : `<div class="empty">${t(cur === now ? "这个雪季还没开板。去预滑一趟，或者和朋友去滑，每天都会在这里留一张合照。" : "这个雪季没有记录。")}</div>`}`;
    for (const b of box.querySelectorAll(".chips button")) b.onclick = () => show(b.dataset.s === "all" ? "all" : +b.dataset.s);
    if (list.length) deck(box, list, (d) => openShot(d, words(d, first, name), cur === "all" ? seasonName(seasonOf(d.date)) : seasonName(cur), openBook));
  };
  show(pick);
}

// The deck: the front card down at the bottom, the older ones rising behind it, tipped back. Swipe up to
// send the front card to the back, down to bring the last one forward; tap the front one to open it.
function deck(box, list, open) {
  const els = [...box.querySelectorAll(".mcard")], n = els.length;
  let order = els.map((_, k) => k);
  // Draw the photos of the cards you can see (the front three), front first.
  const develop = () => { for (const k of order.slice(0, 3)) { const c = els[k]; if (c.dataset.dev) continue; c.dataset.dev = "1";
    photoURL(list[k]).then((u) => { const im = new Image(); im.className = "ph"; im.alt = ""; im.onload = () => im.classList.add("in"); im.src = u; c.querySelector(".pic").append(im); })
      .catch((e) => { console.warn("photo", e); c.querySelector(".dev").textContent = ""; }); } };
  const lay = () => { order.forEach((k, pos) => {
    const c = els[k], back = Math.min(pos, 4);
    c.style.zIndex = 20 - pos;
    c.style.opacity = pos > 4 ? "0" : "1";
    c.style.filter = pos ? `brightness(${1 - back * 0.08})` : "none";
    c.style.transform = pos ? `translateY(${100 - back * 34}px) translateZ(${-back * 30}px) rotateX(${22 + back * 4}deg) scale(${1 - back * 0.03})` : "translateY(100px)";
  }); develop(); };
  lay();
  const stack = box.querySelector(".stack");
  let y0 = null, moved = false;
  stack.onpointerdown = (e) => { y0 = e.clientY; moved = false; };
  stack.onpointermove = (e) => { if (y0 != null && Math.abs(e.clientY - y0) > 10) moved = true; };
  stack.onpointerup = (e) => {
    if (y0 == null) return; const dy = e.clientY - y0; y0 = null;
    if (!moved) { open(list[order[0]]); return; }
    if (n < 2 || Math.abs(dy) < 30) return;
    const front = els[order[0]];
    if (dy < 0) { front.style.transform = "translateY(-60px) rotateX(70deg)"; front.style.opacity = "0"; setTimeout(() => { order = [...order.slice(1), order[0]]; lay(); }, 280); }
    else { order = [order[n - 1], ...order.slice(0, n - 1)]; lay(); }
  };
}

// One photo, large: share it, save it, or open that day's roadbook.
async function openShot(d, w, season, openBook) {
  const el = document.createElement("div");
  el.className = "memshot";
  const who = d.people.map((p) => (p.me ? t("我") : p.name)).filter(Boolean);
  const canShare = !!navigator.share && !!navigator.canShare;
  el.innerHTML = `<button class="x" aria-label="close">×</button><div class="k">SNOW MEMORY · ${season}</div>
    <div class="frame"><img alt=""><b translate="no">${esc(w.title)}</b><small translate="no">${dateOf(d.date)} · ${esc(w.line)}</small>
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
