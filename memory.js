// Snow memory: every pre-run day and every trip you've been on becomes a card (that mountain in
// watercolour, the day's words, its stamp), stacked into a season you can flip back through: swipe up to
// send the front card to the back. Tap one for the day: the painting, its stickers, the way you went.
import { t, EN_ON } from "./i18n.js?v=22";
import { daysOf } from "./roadbook.js?v=12";

const C = { ink: "#22344d", red: "#b6463b", card: "#f8f1e4", mute: "#8a8278" };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const paint = (id) => `assets/wc/${id}.jpg?v=1`;
const when = (ms) => { const d = new Date(ms); return EN_ON ? `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`; };
const dayOf = (ms) => { const d = new Date(ms); return EN_ON ? `${MON[d.getMonth()]} ${d.getDate()}` : `${d.getMonth() + 1} · ${d.getDate()}`; };
const monthOf = (ms) => { const d = new Date(ms); return `${MON[d.getMonth()]} ${d.getFullYear()}`; };

const CSS = `
.mem { margin: 0 -14px 18px; padding: 18px 0 20px; background: linear-gradient(#3d4466, #2f3552); color: #f1ebe0; text-align: center; overflow: hidden; }
.mem .k { font: 500 10px Oswald, sans-serif; letter-spacing: .3em; color: #c9c2d8; }
.mem .h { font: 600 30px/1.1 "Cormorant Garamond", "Noto Serif SC", serif; color: #f6efe3; margin-top: 4px; }
.mem .s { font: 15px "Cormorant Garamond", "Noto Serif SC", serif; color: #b8b2c9; } .mem .s i { font-style: normal; color: #8a86a3; margin: 0 6px; }
.mem .stack { position: relative; height: 440px; margin: 14px auto 0; width: 300px; perspective: 900px; touch-action: pan-x; user-select: none; -webkit-user-select: none; }
.mem .mcard { position: absolute; left: 0; right: 0; top: 0; background: ${C.card}; border-radius: 14px; box-shadow: 0 10px 24px rgba(0,0,0,.35); overflow: hidden; text-align: left; transform-origin: 50% 0; transition: transform .5s cubic-bezier(.3,.7,.3,1), opacity .35s, filter .5s; cursor: pointer; }
.mem .mcard .top { display: flex; justify-content: space-between; padding: 10px 14px 4px; font: 12px "Cormorant Garamond", serif; color: #7b746b; letter-spacing: .04em; }
.mem .mcard .top b { font-weight: 500; color: ${C.red}; white-space: nowrap; margin-left: 8px; flex: none; } .mem .mcard .top span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mem .mcard .pic { position: relative; height: 280px; margin: 4px 14px 0; background: center/cover; }
.mem .mcard .foot { display: flex; justify-content: space-between; align-items: baseline; padding: 10px 16px 14px; }
.mem .mcard .foot b { font: 600 24px "Cormorant Garamond", "Noto Serif SC", serif; color: #33302c; } .mem .mcard .foot small { font: 14px "Cormorant Garamond", "Noto Serif SC", serif; color: #7b746b; }
.mem .mcard .seal { position: absolute; right: 10px; top: 10px; width: 70px; height: 70px; transform: rotate(10deg); filter: drop-shadow(0 3px 4px rgba(0,0,0,.25)); }
.mem .hint { font: 14px "Cormorant Garamond", "Noto Serif SC", serif; color: #b8b2c9; margin-top: 8px; }
.mem .empty { font: 16px "Cormorant Garamond", "Noto Serif SC", serif; color: #d8d2e4; padding: 30px 30px 10px; line-height: 1.5; }
.memday { position: fixed; inset: 0; z-index: 30; overflow-y: auto; background: #f6efe3; padding: calc(18px + env(safe-area-inset-top)) 18px 40px; color: #3d3a36; }
.memday .x { position: fixed; right: 14px; top: calc(12px + env(safe-area-inset-top)); width: 38px; height: 38px; border-radius: 50%; font-size: 20px; color: ${C.ink}; background: #fffdf8; border: 1px solid #cbbfa9; z-index: 2; }
.memday .k { font: 500 10px Oswald, sans-serif; letter-spacing: .3em; color: ${C.mute}; }
.memday .h { font: 600 30px/1.1 "Cormorant Garamond", "Noto Serif SC", serif; color: ${C.ink}; margin: 4px 0 2px; }
.memday .s { font: 15px "Cormorant Garamond", "Noto Serif SC", serif; color: ${C.mute}; }
.memday .mrow { display: flex; gap: 12px; margin-top: 16px; align-items: flex-start; }
.memday .frame { flex: 0 0 210px; background: #fdfbf6; padding: 12px 12px 8px; box-shadow: 0 8px 18px rgba(90,70,40,.16); }
.memday .frame .pic { height: 230px; background: center/cover; }
.memday .frame .cap { text-align: center; font: 14px "Cormorant Garamond", serif; color: #7b746b; margin-top: 8px; line-height: 1.3; }
.memday .stk { position: relative; flex: 1; min-height: 260px; }
.memday .stk > * { position: absolute; filter: drop-shadow(0 3px 4px rgba(90,70,40,.22)); }
.memday .sec { display: flex; align-items: center; gap: 10px; margin: 22px 0 8px; font: 18px "Cormorant Garamond", "Noto Serif SC", serif; color: #6f675e; }
.memday .sec::after { content: ""; flex: 1; height: 1px; background: #d9cdb9; }
.memday .way { font: 17px/1.55 "Cormorant Garamond", "Noto Serif SC", serif; color: #5b554e; }
.memday .acts { display: flex; gap: 8px; margin-top: 18px; }
.memday .acts button { flex: 1; font: 16px "Cormorant Garamond", "Noto Serif SC", serif; color: #fffdf8; background: ${C.ink}; border: 0; border-radius: 999px; padding: 8px; }
.memday .acts button.o { color: ${C.ink}; background: #fdfbf6; border: 1px solid #cbbfa9; }
`;
let styled = false;
const style = () => { if (styled) return; styled = true; const s = document.createElement("style"); s.textContent = CSS; document.head.append(s); };
const seal = (label, cls = "seal") => `<svg class="${cls}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#fbf7ef"/><circle cx="50" cy="50" r="40" fill="none" stroke="${C.red}" stroke-width="2.4"/><circle cx="50" cy="50" r="33" fill="none" stroke="${C.red}" stroke-width="1" stroke-dasharray="2 3"/><path d="M30 60 L42 44 L50 52 L58 40 L72 60Z" fill="${C.red}" opacity=".85"/><text x="50" y="76" text-anchor="middle" font-family="Cormorant Garamond" font-size="11" font-weight="600" fill="${C.red}">${esc(label)}</text><text x="50" y="32" text-anchor="middle" font-family="Oswald" font-size="7" letter-spacing="1.5" fill="${C.red}">PRE-RUN</text></svg>`;
const stub = (text) => `<svg viewBox="0 0 120 60" style="width:118px"><rect x="4" y="6" width="112" height="48" rx="4" fill="#5f6f7c" stroke="#fffdf8" stroke-width="4"/><circle cx="96" cy="30" r="5" fill="#f6efe3"/><text x="12" y="26" font-family="Oswald" font-size="9" letter-spacing="2" fill="#fffdf8">LIFT TICKET</text><text x="12" y="44" font-family="Cormorant Garamond" font-size="15" font-weight="600" fill="#fffdf8">${esc(text)}</text></svg>`;

// The cards: one per pre-run day (from the roadbook) and one per trip that's over.
function cards(resorts) {
  const name = (id) => resorts.find((r) => r.id === id)?.name.replace(/ Mountain$| Basin$/, "") || id, out = [];
  for (const r of resorts) for (const day of daysOf(r.id)) {
    const runs = [], lifts = [];
    for (const s of day.steps) { if (s.k === "route") for (const g of s.segs) if (!runs.includes(g.n)) runs.push(g.n); if (s.k === "lift") lifts.push(s.name); }
    out.push({ kind: "prerun", id: r.id, t: day.t0, title: name(r.id), words: (runs.length ? runs : lifts).slice(0, 3).join(" · ") || name(r.id), runs, lifts, day,
      stat: EN_ON ? `${runs.length} runs · ${lifts.length} lifts` : `${runs.length} 条雪道 · ${lifts.length} 趟缆车` });
  }
  let trips = []; try { trips = JSON.parse(localStorage.getItem("prerunTrips") || "[]"); } catch { /* none */ }
  const now = new Date().toISOString().slice(0, 10);
  for (const tr of trips) if (tr.to < now) {
    const ids = (tr.maybe && tr.maybe.length ? tr.maybe : [...new Set((tr.days || []).map((d) => d.resort))]).filter((id) => resorts.some((r) => r.id === id));
    if (!ids.length) continue;
    out.push({ kind: "trip", id: ids[0], t: new Date(tr.from + "T09:00:00").getTime(), title: tr.name, words: ids.map(name).join(" · "), stat: EN_ON ? "a trip" : "一次旅行", trip: tr });
  }
  return out.sort((a, b) => b.t - a.t);
}

export function renderMemory(box, { resorts, openBook }) {
  style();
  const list = cards(resorts);
  const days = new Set(list.map((c) => new Date(c.t).toDateString())).size, mts = new Set(list.map((c) => c.id)).size, trips = list.filter((c) => c.kind === "trip").length;
  box.className = "mem";
  box.innerHTML = `<div class="k">SNOW MEMORY</div><div class="h">${t("我的雪季")}</div>
    <div class="s">${EN_ON ? `${list.length} cards<i>·</i>${days} days<i>·</i>${mts} mountains` : `${list.length} 张卡<i>·</i>${days} 天<i>·</i>${mts} 座山`}${trips ? `<i>·</i>${EN_ON ? `${trips} trips` : `${trips} 次旅行`}` : ""}</div>
    ${list.length ? `<div class="stack">${list.map((c, k) => `<div class="mcard" data-k="${k}"><div class="top"><span>${esc(c.words)}</span><b>${monthOf(c.t)}</b></div>
      <div class="pic" style="background-image:url(${paint(c.id)})">${c.kind === "prerun" ? seal(dayOf(c.t)) : ""}</div>
      <div class="foot"><b>${esc(c.title)}</b><small>${esc(c.stat)}</small></div></div>`).join("")}</div>
      <div class="hint">${list.length > 1 ? `↑ ${t("向上翻，一张一张往回看")}` : ""}</div>` : `<div class="empty">${t("还没有记忆。去预滑或者去滑一趟，就会在这里留下一张卡。")}</div>`}`;
  if (!list.length) return;
  const els = [...box.querySelectorAll(".mcard")], n = els.length;
  let order = els.map((_, k) => k);
  // The front card down at the bottom, the older ones rising behind it, tipped back.
  const lay = () => order.forEach((k, pos) => {
    const c = els[k], back = Math.min(pos, 4);
    c.style.zIndex = 20 - pos;
    c.style.opacity = pos > 4 ? "0" : "1";
    c.style.filter = pos ? `brightness(${1 - back * 0.08})` : "none";
    c.style.transform = pos ? `translateY(${100 - back * 34}px) translateZ(${-back * 30}px) rotateX(${22 + back * 4}deg) scale(${1 - back * 0.03})` : "translateY(100px)";
  });
  lay();
  const stack = box.querySelector(".stack");
  let y0 = null, moved = false;
  stack.onpointerdown = (e) => { y0 = e.clientY; moved = false; };
  stack.onpointermove = (e) => { if (y0 != null && Math.abs(e.clientY - y0) > 10) moved = true; };
  stack.onpointerup = (e) => {
    if (y0 == null) return; const dy = e.clientY - y0; y0 = null;
    if (!moved) { const k = order[0]; openDay(list[k], openBook); return; }
    if (n < 2 || Math.abs(dy) < 30) return;
    const front = els[order[0]];
    if (dy < 0) { front.style.transform = "translateY(-60px) rotateX(70deg)"; front.style.opacity = "0"; setTimeout(() => { order = [...order.slice(1), order[0]]; lay(); }, 280); }
    else { order = [order[n - 1], ...order.slice(0, n - 1)]; lay(); }
  };
}

// One day, as a page of the journal: the painting with its caption, the day's stickers, the way you went.
function openDay(c, openBook) {
  const el = document.createElement("div");
  el.className = "memday";
  const way = c.kind === "prerun" ? c.day.steps.map((s) => (s.k === "base" ? s.name : s.k === "lift" ? `🚡 ${s.name}` : s.k === "route" ? s.segs.map((g) => g.n).join(" → ") : s.k === "arrive" ? `📍 ${s.title}` : "")).filter(Boolean).join(" → ") : c.words;
  el.innerHTML = `<button class="x" aria-label="close">×</button><div class="k">SNOW MEMORY · ${t("雪的记忆")}</div><div class="h">${esc(c.title)}</div><div class="s">${when(c.t)}${c.kind === "prerun" ? ` · ${t("预滑")}` : ""}</div>
    <div class="mrow"><div class="frame"><div class="pic" style="background-image:url(${paint(c.id)})"></div><div style="text-align:center;color:#c3b59d;font-size:10px;margin-top:6px">• • •</div><div class="cap">${esc(c.words)}</div></div>
      <div class="stk"><div style="left:0;top:0;transform:rotate(-6deg)">${stub(`${c.title} · ${monthOf(c.t)}`)}</div>
        <div style="left:14px;top:62px;width:86px;height:86px;transform:rotate(9deg)">${seal(dayOf(c.t), "")}</div>
        ${c.lifts?.length ? `<div style="left:6px;top:160px;transform:rotate(4deg)">${stub(`🚡 ${c.lifts[0]}`)}</div>` : ""}</div></div>
    <div class="sec">${t("那天")}</div><div class="way">${esc(way) || "—"}<br><span style="color:#8a8278">${esc(c.stat)}</span></div>
    <div class="acts">${c.kind === "prerun" ? `<button class="bk">${t("📜 预滑路书")}</button>` : ""}<button class="o close">${t("收起")}</button></div>`;
  document.body.append(el);
  const close = () => el.remove();
  el.querySelector(".x").onclick = close; el.querySelector(".close").onclick = close;
  el.querySelector(".bk")?.addEventListener("click", () => { close(); openBook(c.id); });
}
