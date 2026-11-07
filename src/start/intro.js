// The opening: a snowy valley from above, clouds drifting over; around it a frosted pane with snowboarders
// carving across its far side; and, on a tap of the speaker, the hiss of their boards and a quiet tune. Once
// per visit, while the rider model loads. With a trip near (on now, coming up, or just over), the opening is
// about that trip instead: its crew's little planes on their way to Denver (see tripIntro).
import { t, EN_ON, myAvatar, AVATARS } from "../core/i18n.js?v=38";
import { pickTrip, progress, resortsOf, resortOn, crewOf, spread, bearing, ymd, between, LOOK_BACK } from "./trip-intro.js?v=1";

const CSS = `
#intro { position: fixed; inset: 0; z-index: 50; background: #dde3e9; overflow: hidden; transition: opacity .6s; font-family: "Noto Serif SC", serif; cursor: pointer; }
#intro.out { opacity: 0; pointer-events: none; }
#intro .bgc { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
#intro .valley { position: absolute; left: 50%; top: calc(14vh + env(safe-area-inset-top)); width: min(340px, 86vw, 42vh); aspect-ratio: 680 / 800; transform: translateX(-50%); filter: drop-shadow(0 10px 24px rgba(40,50,70,.22)); }
#intro .cap { position: absolute; left: 0; right: 0; top: calc(14vh + env(safe-area-inset-top) + min(400px, 101vw, 49.4vh) + 26px); text-align: center; text-shadow: 0 0 8px #fff, 0 0 3px #fff; z-index: 1; pointer-events: none; }
#intro .cap b { display: block; font-weight: 400; font-size: 20px; letter-spacing: .3em; color: #3d3a36; }
#intro .cap p { margin: 10px 0 0; font-size: 12px; letter-spacing: .15em; line-height: 1.9; color: #6f685f; }
#intro .cap small { display: block; margin-top: 12px; font-size: 10px; letter-spacing: .2em; color: #8f857a; }
#intro .cap .brand { display: block; font: 500 10px Oswald, sans-serif; font-style: normal; letter-spacing: .4em; color: #8f857a; margin-bottom: 12px; }
#intro .cap .float { position: relative; display: grid; place-items: center; }
#intro .cap .float p { grid-area: 1 / 1; margin: 0 14px; }
#intro .cap .float .under { font: italic 500 19px/1.4 "Cormorant Garamond", serif; letter-spacing: .02em; color: #8ea0b6; opacity: .42; transform: translate(8px, 10px); }
#intro .cap.quote .float .over { font-size: 17px; font-weight: 600; letter-spacing: .2em; line-height: 2; color: #2a3442; text-shadow: 0 0 6px rgba(221,227,233,.9); }
#intro .cap .ch { display: inline-block; will-change: transform; }
#intro .cap.quote p { font-size: 15px; letter-spacing: .18em; line-height: 2; color: #3d3a36; margin: 0 24px; }
#intro .cap.quote small { margin: 12px 30px 0; font: italic 13px/1.6 "Cormorant Garamond", serif; letter-spacing: .04em; color: #6f685f; }
#intro .cap .go { margin-top: 22px; font: 500 10px Oswald, sans-serif; letter-spacing: .35em; color: #22344d; opacity: 0; transition: opacity 1s; }
#intro .cap .go.on { opacity: .7; }
#intro .snd { position: absolute; right: 16px; top: calc(16px + env(safe-area-inset-top)); z-index: 2; width: 40px; height: 40px; border-radius: 50%; border: 0; background: rgba(253,251,246,.9); box-shadow: 0 3px 8px rgba(40,50,70,.15); cursor: pointer; }
#intro .snd .w { opacity: .3; }
#intro .snd.on .w { opacity: 1; }
/* A trip's opening: the planes over the pane, the words under it, the card for whoever you tap */
#intro .fleet { position: absolute; left: 50%; top: calc(14vh + env(safe-area-inset-top)); width: min(340px, 86vw, 42vh); aspect-ratio: 680 / 800; transform: translateX(-50%); z-index: 1; pointer-events: none; }
#intro .pl { position: absolute; width: 48px; height: 48px; touch-action: none; cursor: grab; pointer-events: auto; will-change: transform, left, top; }
#intro .pl .wob { position: absolute; inset: 0; }
#intro .pl .jet { position: absolute; inset: 0; width: 100%; height: 100%; filter: drop-shadow(0 2px 2px rgba(40,50,70,.25)); }
#intro .pl .av { position: absolute; left: 62%; top: -12px; width: 28px; height: 28px; border-radius: 50%; background: #e6ebee; border: 2px solid #fdfbf6; box-shadow: 0 1px 3px rgba(40,50,70,.35); pointer-events: none; }
#intro .pl.local { width: 36px; height: 36px; transform: translate(-50%, -50%); }
#intro .pl.local .av { left: 0; top: 0; width: 32px; height: 32px; }
#intro .cap.trip { padding: 0 18px; }
#intro .cap.trip b { display: inline-block; font-size: 18px; font-weight: 600; letter-spacing: .12em; line-height: 1.5; color: #22344d; }
#intro .cap.trip p { margin: 8px 6px 0; font-size: 13px; letter-spacing: .1em; line-height: 1.7; }
#intro .cap.trip .wx:empty { display: none; }
#intro .cap.trip .wx img { width: 24px; height: 24px; vertical-align: -7px; margin-right: 4px; }
#intro .cap.trip small { margin-top: 10px; }
#intro .cap.trip button { pointer-events: auto; cursor: pointer; font-family: "Noto Serif SC", serif; }
#intro .cap.trip .cd { background: none; border: 0; padding: 4px 8px; color: inherit; text-shadow: inherit; }
#intro .cap.trip .cd b { border-bottom: 1.5px dashed rgba(182,70,59,.65); padding-bottom: 2px; }
#intro .cap.trip .cd i { display: block; margin-top: 6px; font: 500 10px Oswald, sans-serif; font-style: normal; letter-spacing: .3em; color: #b6463b; }
#intro .cap.trip .act { margin-top: 14px; font-size: 15px; font-weight: 600; letter-spacing: .08em; color: #fdfbf6; background: #22344d; border: 0; border-radius: 999px; padding: 9px 20px; box-shadow: 0 4px 10px rgba(34,52,77,.25); text-shadow: none; }
#intro .cap.trip .stamp { position: absolute; right: 12px; top: -58px; width: 64px; height: 64px; transform: rotate(10deg); opacity: .92; }
#intro .cap.trip .swap { display: grid; }
#intro .cap.trip .swap > div { grid-area: 1 / 1; transition: opacity .7s; }
#intro .cap.trip .swap .c2, #intro .cap.trip .swap.on .c1 { opacity: 0; pointer-events: none; }
#intro .cap.trip .swap.on .c2 { opacity: 1; }
#intro .cap.trip .swap:not(.on) .act { pointer-events: none; }
#intro .who { position: absolute; z-index: 3; display: flex; gap: 10px; align-items: center; max-width: 260px; padding: 10px 16px 10px 10px; background: rgba(253,251,246,.96); border-radius: 10px; box-shadow: 0 8px 20px rgba(40,50,70,.22); color: #33302c; cursor: default; }
#intro .who[hidden] { display: none; }
#intro .who img { width: 44px; height: 44px; border-radius: 50%; background: #e6ebee; flex: none; }
#intro .who b { font-size: 16px; font-weight: 600; color: #22344d; }
#intro .who em { margin-left: 6px; font: 500 10px Oswald, sans-serif; letter-spacing: .2em; color: #b6463b; font-style: normal; }
#intro .who small { display: block; margin-top: 2px; font: 500 11px Oswald, sans-serif; letter-spacing: .12em; color: #6f685f; }
#intro .who i { display: block; margin-top: 4px; font: italic 14px/1.4 "Cormorant Garamond", "Noto Serif SC", serif; color: #6f685f; }
`;

// The welcome's words, each with its own little scene (see valley()). A different one each visit.
const QUOTES = [
  { zh: "答案在路上，<br>自由在风里，<br>永远热爱自由浪漫。", en: "The answer is on the road. Freedom is in the wind.<br>Always love freedom and romance.", scene: "road" },
  { zh: "出发是最有意义的事。", en: "Setting off is what matters most.", scene: "depart" },
  { zh: "高处自有风景在，<br>找不到答案的时候，<br>就去看一看这个世界。", en: "High places have their own scenery.<br>When the answer cannot be found,<br>just go take a look at this world.", scene: "summit" },
  { zh: "都在路上，<br>都在当下。", en: "All on the road, all in the moment.", scene: "now" },
  { zh: "山川不语，风雪有声，<br>那些一起走过的日子，<br>自会替我们记得。", en: "The mountains stand silent,<br>the wind tells its stories,<br>and the days we shared will never truly fade.", scene: "tracks" },
  { zh: "山野有雪，<br>同行有期。", en: "Where snow falls, we shall meet again.", scene: "meet" },
];
// How each scene moves and sounds behind the glass. Riders: how many at once (slots), how often a new run
// starts (gap, s), speed (px/s), turn length (px) and depth (rad), which ways they head; "pair" rides two
// side by side, "meet" brings two in from opposite sides. Sound: a bar's length (s), its chords and tune
// (MIDI, 0 a rest), notes per bar, "arp" climbs each chord instead, wind under it all, how loud the boards hiss.
const MOODS = {
  road: { slots: 3, gap: 6, v: [300, 400], len: [380, 900], amp: [0.5, 1.15], dirs: [[1, 0.35], [-1, 0.35], [0.6, 0.8], [-0.6, 0.8]],
    bar: 3.2, chords: [[50, 57, 62, 66], [45, 52, 57, 61], [47, 54, 59, 62], [43, 50, 55, 59]], tune: [78, 81, 83, 81, 78, 76, 78, 74, 76, 78, 81, 86, 83, 81, 78, 76], per: 4, wind: 0.05, hiss: 1 },
  depart: { slots: 3, gap: 5, v: [260, 330], len: [300, 600], amp: [0.25, 0.6], dirs: [[0, -1], [0.3, -0.95], [-0.3, -0.95]],
    bar: 3.2, chords: [[48, 55, 60, 64], [53, 57, 60, 65], [55, 59, 62, 67], [57, 60, 64, 69]], arp: 1, per: 6, wind: 0.015, hiss: 0.9 },
  summit: { slots: 2, gap: 11, v: [150, 190], len: [700, 1200], amp: [0.6, 1.0], dirs: [[0, 1], [0.3, 0.95]],
    bar: 6, chords: [[38, 45, 57, 64], [36, 43, 55, 62], [41, 48, 57, 64], [43, 50, 59, 66]], tune: [76, 74, 69, 0, 81, 79, 74, 0], per: 2, wind: 0.08, hiss: 0.6, high: 1 },
  now: { slots: 5, gap: 4.5, v: [240, 300], len: [200, 380], amp: [0.4, 0.8], dirs: [[0, 1], [0.5, 0.87], [-0.5, 0.87], [1, 0.25], [-1, 0.25], [0, -1]],
    bar: 2.4, chords: [[52, 59, 64, 68], [49, 56, 61, 64], [45, 52, 57, 61], [47, 54, 59, 63]], tune: [76, 80, 83, 80, 78, 76, 80, 71, 73, 76, 80, 78, 76, 75, 73, 71], per: 4, wind: 0, hiss: 0.7, pluck: 1 },
  tracks: { slots: 2, gap: 9, v: [210, 230], len: [500, 700], amp: [0.6, 0.8], dirs: [[0, 1]], pair: 1,
    bar: 4.5, chords: [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]], tune: [76, 74, 72, 71, 72, 69, 67, 64, 69, 71, 72, 74], per: 3, wind: 0.07, hiss: 0.8 },
  meet: { slots: 2, gap: 9, v: [190, 220], len: [420, 640], amp: [0.4, 0.7], meet: 1,
    bar: 4, chords: [[41, 48, 57, 60], [38, 45, 53, 57], [46, 53, 58, 62], [48, 55, 60, 64]], tune: [72, 74, 77, 74, 72, 69, 70, 72, 77, 76, 74, 72], per: 3, wind: 0.02, hiss: 0.7 },
  trip: { slots: 4, gap: 7, v: [210, 300], len: [280, 800], amp: [0.35, 1.1], dirs: [[0, 1], [0, 1], [0.5, 0.87], [-0.5, 0.87], [1, 0.25], [-1, 0.25], [0, -1]],
    bar: 4, chords: [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]], tune: [74, 76, 78, 81, 78, 76, 74, 71, 74, 76, 74, 69, 71, 74, 78, 76], per: 4, wind: 0, hiss: 1 },
};
const pickQuote = () => {
  const ask = +new URLSearchParams(location.search).get("welcome"); if (ask >= 1 && ask <= QUOTES.length) return ask - 1; // ?welcome=N, to look at one
  let last = -1; try { last = +(localStorage.getItem("prerunWelcome") ?? -1); } catch { /* private mode */ }
  let k = Math.floor(Math.random() * (QUOTES.length - 1)); if (k >= last && last >= 0) k++;
  try { localStorage.setItem("prerunWelcome", k); } catch { /* fine */ }
  return k;
};

// ---- Playing it
// ?intro=force plays it under navigator.webdriver too (the headless tests); any ?intro plays it again in the same visit.
const FORCE = () => new URLSearchParams(location.search).get("intro") === "force";
const firstThisVisit = () => { try { if (sessionStorage.getItem("prerunIntro")) return false; sessionStorage.setItem("prerunIntro", "1"); } catch { /* storage off: play it */ } return true; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => x * x * (3 - 2 * x);
const SND = `<button class="snd" aria-label="${t("声音")}"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 9 H8 L13 5 V19 L8 15 H4Z" fill="#22344d"/><path class="w" d="M16 9 C17.5 10.5 17.5 13.5 16 15 M18.5 6.5 C21.5 9.5 21.5 14.5 18.5 17.5" stroke="#22344d" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg></button>`;

// With no trip (or none near), the welcome: one of the quotes and its scene. With one, the opening is about
// it (see tripIntro). hooks, what a trip's opening can open: open(tripId) that trip on the trips tab,
// go(resortId) straight to a mountain, memory() the Memory tab.
export async function playIntro(hooks = {}) {
  const force = FORCE();
  if (navigator.webdriver && !force) return; // not in tests
  if (!firstThisVisit() && !new URLSearchParams(location.search).has("intro")) return; // once per visit (per tab); ?intro in the link plays it again
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
  const box = document.createElement("div"); box.id = "intro"; document.body.append(box); // the frost first, while the trip is looked up
  let found = null, scene = null;
  try { found = await nearestTrip(); if (found) scene = await tripData(found); } catch (e) { console.warn(e); }
  if (scene) tripIntro(box, st, scene, hooks, still); else general(box, st, still);
}

// The trips on this phone; the shared ones near now fetched again (briefly: the opening won't wait long),
// so a date or a crew changed by a friend shows. Then the one to be about (trip-intro.js).
async function nearestTrip() {
  let list = []; try { list = JSON.parse(localStorage.getItem("prerunTrips") || "[]"); } catch { /* none */ }
  if (!Array.isArray(list) || !list.length) return null;
  const today = ymd(new Date());
  const near = list.filter((tr) => tr?.shared && tr.id && /^\d{4}-\d{2}-\d{2}$/.test(tr.to) && between(tr.to, today) <= LOOK_BACK).slice(0, 4);
  if (near.length) {
    try {
      const S = await import("./shared-trip.js?v=2");
      const got = await Promise.race([Promise.all(near.map((tr) => S.api.get(tr.id).catch(() => null))), wait(1200).then(() => [])]);
      for (const s of got) { if (!s) continue; const tr = S.toLocal(s), i = list.findIndex((x) => x?.id === tr.id); if (i >= 0 && S.isMember(tr)) list[i] = tr; }
    } catch { /* offline: the copies on this phone */ }
  }
  return pickTrip(list, today);
}

// The welcome: a quote, its valley, its riders and tune.
function general(box, st, still) {
  const q = QUOTES[pickQuote()];
  box.innerHTML = `<canvas class="bgc"></canvas><canvas class="valley" width="680" height="800"></canvas>
    <div class="cap quote"><i class="brand">SKI PRE-RUN</i>${!EN_ON ? `<div class="float"><p class="under">${q.en}</p><p class="over">${q.zh}</p></div>` : `<p class="over">${q.en}</p>`}<div class="go">${t("轻点进入")}</div></div>${SND}`;
  const S = stage(box, st, MOODS[q.scene], still);
  valley(box.querySelector(".valley"), q.scene, null, S.alive);
  if (!still) letters(box, S.riders, S.alive);
  setTimeout(() => box.querySelector(".go").classList.add("on"), still ? 300 : 2000);
  box.onclick = () => S.end();
}

// What every opening shares: the pane's riders, the sound and its toggle, and the way out (a tap, or one
// of the trip's buttons: then() runs as it fades). still (prefers-reduced-motion): one frame, no motion.
function stage(box, st, mood, still) {
  let live = true;
  const alive = () => live && !still;
  const bg = box.querySelector(".bgc"); bg.width = innerWidth * 2; bg.height = innerHeight * 2;
  const riders = glass(bg, alive, mood);
  // Sound starts by itself where the browser lets it (most desktops); phones only allow it after a tap, so
  // there it waits for the speaker.
  const A = startSound(riders, mood), snd = box.querySelector(".snd"), mark = () => snd.classList.toggle("on", A.state === "running");
  A.resume().then(mark, mark); A.onstatechange = mark;
  snd.onclick = (e) => { e.stopPropagation(); (A.state === "running" ? A.suspend() : A.resume()).then(mark, mark); };
  let gone = false;
  const end = (then) => { if (gone) return; gone = true; box.classList.add("out"); A.close(); then?.(); setTimeout(() => { live = false; box.remove(); st.remove(); }, 650); };
  return { alive, riders, end };
}

// ---- A trip's opening. Everything it says comes from the trip: its name and dates, who is on it and where
// they fly from, the mountains planned, and the forecast once Open-Meteo has the day (about 16 days ahead).
//   soon    a countdown: each member's plane on its way from home, as far along as the day is near
//           (progress()); tap a plane for who it is, drag it to wiggle it, tap the countdown for the trip
//   travel  the first day: the planes take off from home and land at Denver one after another, then the
//           welcome and today's plan, with a tap straight to that mountain
//   during  "day 2 · Copper today", the planes parked at Denver, a tap straight to the mountain
//   after   the week after: the planes fly home over the whole way, a tap to the Memory tab
async function tripData(P) {
  const [{ AIRPORTS, CITY }, resorts] = await Promise.all([import("./trips.js?v=39"), fetch("data/resorts.json").then((r) => r.json()).catch(() => [])]);
  const tr = P.trip, today = ymd(new Date()), byId = Object.fromEntries((Array.isArray(resorts) ? resorts : []).map((r) => [r.id, r]));
  const crew = crewOf(tr, { mine: myAvatar(), avatars: AVATARS }).slice(0, 6);
  if (!crew.length) crew.push({ name: "", from: "", face: myAvatar(), me: true, note: "" });
  const day = P.phase === "travel" || P.phase === "during" ? resortOn(tr, today) : null;
  return { ...P, tr, today, byId, crew, AIRPORTS, CITY, plan: resortsOf(tr).filter((id) => byId[id]), dayR: byId[day] ? day : null };
}
const shortName = (r) => r.name.replace(/ Mountain$| Basin$/, "");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (d) => { const x = new Date(d + "T00:00:00"); return EN_ON ? `${MON[x.getMonth()]} ${x.getDate()}` : `${x.getMonth() + 1} 月 ${x.getDate()} 日`; };

function tripIntro(box, st, D, hooks, still) {
  const { tr, phase, byId, crew, plan, dayR } = D;
  const name = `<span translate="no">${esc(tr.name || "Ski trip")}</span>`, rn = (id) => esc(shortName(byId[id]));
  const list = plan.map(rn).join(" · ");
  const stamp = (n) => `<img class="stamp" src="assets/icons/${n}.png?v=1" alt="">`;
  const open = `<button class="act" data-open>${t("打开行程 ›")}</button>`, go = dayR ? `<button class="act" data-go="${dayR}">${t("直接去 {resort} ›", { resort: rn(dayR) })}</button>` : open;
  const hint = `<small>${t("轻点飞机，看看是谁")}</small>`, enter = `<div class="go">${t("轻点进入")}</div>`;
  const cap = {
    soon: () => `${stamp("st_booked")}<button class="cd" data-open><b>${D.left === 1 ? t("明天出发 · {name}", { name }) : t("还有 {n} 天 · {name}", { n: D.left, name })}</b><i>${t("打开行程 ›")}</i></button>
      <p>${plan.length ? t("计划去 {list}", { list }) : t("看雪定山")}</p><p class="wx"></p>${hint}${enter}`,
    travel: () => `${stamp("st_ontrip")}<div class="swap"><div class="c1"><b>${t("今天出发！")}</b><p>${name}</p></div>
      <div class="c2"><b>${t("欢迎来到科罗拉多")}</b><p>${dayR ? t("今天的计划：{resort}", { resort: rn(dayR) }) : t("今天还没定去哪")}</p><p class="wx"></p>${go}</div></div>${enter}`,
    during: () => `${stamp("st_ontrip")}<b>${dayR ? t("第 {n} 天 · 今天去 {resort}", { n: D.day, resort: rn(dayR) }) : t("第 {n} 天 · 今天还没定去哪", { n: D.day })}</b><p>${name}</p><p class="wx"></p>${go}${hint}${enter}`,
    after: () => `${stamp("st_done")}<b>${t("这趟滑完了")}</b><p>${name} · ${fmtDay(tr.from)}${tr.to !== tr.from ? ` – ${fmtDay(tr.to)}` : ""}</p>${plan.length ? `<p>${t("这趟的山：{list}", { list })}</p>` : ""}<button class="act" data-memory>${t("看看记录 ›")}</button>${enter}`,
  }[phase]();
  box.innerHTML = `<canvas class="bgc"></canvas><canvas class="valley" width="680" height="800"></canvas><div class="fleet"></div><div class="cap trip">${cap}</div><div class="who" hidden></div>${SND}`;
  const S = stage(box, st, MOODS.trip, still), $ = (s) => box.querySelector(s);
  const fleet = { phase, planes: [], cities: [] };
  const V = valley($(".valley"), "trip", fleet, S.alive);
  layFleet(fleet, V, crew, D.AIRPORTS);
  // The buttons: each fades the opening out, then opens its page.
  const H = { open: hooks.open || (() => { location.href = "start.html?tab=trip"; }), go: hooks.go || ((id) => { location.href = `mountain/?resort=${encodeURIComponent(id)}`; }), memory: hooks.memory || (() => { location.href = "start.html?tab=log"; }) };
  for (const b of box.querySelectorAll("[data-open]")) b.onclick = (e) => { e.stopPropagation(); S.end(() => H.open(tr.id)); };
  // Going to today's mountain from a shared trip: the ride joins that trip's friends (src/ride/together.js).
  for (const b of box.querySelectorAll("[data-go]")) b.onclick = (e) => { e.stopPropagation(); try { if (tr.shared) sessionStorage.setItem("prerunRideTrip", tr.id); } catch { /* storage off */ } S.end(() => H.go(b.dataset.go)); };
  for (const b of box.querySelectorAll("[data-memory]")) b.onclick = (e) => { e.stopPropagation(); S.end(() => H.memory()); };
  // The forecast for the day the words are about, when Open-Meteo has it.
  const wxAt = phase === "soon" ? (D.left <= 15 ? resortOn(tr, tr.from) || (plan.length === 1 ? plan[0] : null) : null) : phase === "after" ? null : dayR;
  if (wxAt && byId[wxAt]) dayWeather(byId[wxAt], phase === "soon" ? tr.from : D.today).then((w) => {
    const el = $(".wx"); if (!w || !el) return;
    const temp = `${Math.round(w.lo)}° / ${Math.round(w.hi)}°`.replace(/-/g, "−"), snow = w.cm >= 1 ? t(" · 新雪 {cm} 厘米", { cm: Math.round(w.cm) }) : "";
    el.innerHTML = `<img src="assets/icons/${wxIcon(w)}.png?v=1" alt="">${t(phase === "soon" ? "第一天 · {resort} · {sky} {temp}" : "今天 · {resort} · {sky} {temp}", { resort: rn(wxAt), sky: t(WXWORD[wxIcon(w)]), temp })}${snow}`;
  });
  // The planes (and anyone already in Denver), over the pane so a finger can find them.
  const layer = $(".fleet"), who = $(".who");
  const JET = `<svg class="jet" viewBox="-24 -24 48 48"><path d="M7 0 L-4 -19 L-9.5 -19 L-4.5 0 L-9.5 19 L-4 19 Z M-15.5 -7 h4 v14 h-4 Z" fill="#22344d"/><ellipse rx="19" ry="4.2" fill="#22344d"/><rect x="-3" y="-0.9" width="14" height="1.8" fill="#fdfbf6"/></svg>`;
  const dom = (p, local) => { const el = document.createElement("div"); el.className = `pl${local ? " local" : ""}`; el.innerHTML = `<div class="wob">${local ? "" : JET}<img class="av" src="assets/icons/${p.face}.png?v=1" alt=""></div>`; layer.append(el); wiggle(el, () => card(p, el)); return el; };
  for (const pl of fleet.planes) { pl.el = dom(pl.p); pl.jet = pl.el.querySelector(".jet"); }
  fleet.local.forEach((p, i) => { const el = dom(p, true); el.style.left = `${((V.den[0] - 46 - i * 38) / V.W) * 100}%`; el.style.top = `${((V.den[1] + 38) / V.H) * 100}%`; });
  // Tap a plane: who it is, from where, and their travel note.
  const card = (p, el) => {
    const nm = p.me && (!p.name || p.name === "我") ? t("我") : p.name || "—", city = D.CITY[p.from] || "";
    who.innerHTML = `<img src="assets/icons/${p.face}.png?v=1" alt=""><div><b translate="no">${esc(nm)}</b>${p.me && nm !== t("我") ? `<em>${t("我")}</em>` : ""}<small>${p.from === "DEN" ? t("已经在 Denver") : p.from ? `${p.from}${city ? ` · ${esc(city)}` : ""} → DEN` : t("还没填从哪飞")}</small>${p.note ? `<i translate="no">${esc(p.note)}</i>` : ""}</div>`;
    who.hidden = false;
    const r = el.getBoundingClientRect(), w = who.offsetWidth, h = who.offsetHeight;
    who.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2))}px`;
    who.style.top = `${r.top - h - 10 > 60 ? r.top - h - 10 : r.bottom + 10}px`;
  };
  who.onclick = (e) => { e.stopPropagation(); who.hidden = true; };
  box.onclick = () => { if (!who.hidden) { who.hidden = true; return; } S.end(); };
  // Moving them.
  const target = phase === "soon" ? progress(D.left) : 1, t0 = performance.now();
  let welcomed = phase !== "travel";
  const tick = (now) => {
    const tt = (now - t0) / 1000;
    for (const pl of fleet.planes) {
      const i = pl.i; let u, alt, back = false, k;
      if (phase === "soon") { u = target * (still ? 1 : ease(clamp((tt - 0.4 - 0.15 * i) / 1.8))); alt = u > 0 && u < 1 ? 0.3 : 0; }
      else if (phase === "travel") { k = still ? 1 : clamp((tt - 0.6 - 0.7 * i) / 3.2); u = 1 - (1 - k) ** 2; alt = Math.sin(Math.PI * k) * 0.9; pl.down = k >= 1; }
      else if (phase === "after") { k = still ? 0.6 : clamp((tt - 0.5 - 0.3 * i) / 4.5); u = 1 - ease(k) * 0.85; alt = Math.sin(Math.PI * Math.min(1, k * 1.2)) * 0.6; back = true; } // flying home; the last stretch left for next time
      else { u = 1; alt = 0; }
      const v = Math.min(u, 0.99), [x, y] = pl.at(u), [x1, y1] = pl.at(v), [x2, y2] = pl.at(v + 0.01);
      pl.u = u; pl.alt = alt; pl.ang = Math.atan2(y2 - y1, x2 - x1) + (back ? Math.PI : 0);
      const bob = phase === "soon" && alt > 0 && !still ? Math.sin(tt * 2.2 + i * 1.7) * 2.5 : 0;
      pl.el.style.left = `${(x / V.W) * 100}%`; pl.el.style.top = `${(y / V.H) * 100}%`;
      pl.el.style.transform = `translate(-50%, calc(-50% + ${bob.toFixed(1)}px)) scale(${(0.92 + alt * 0.45).toFixed(3)})`;
      pl.jet.style.transform = `rotate(${pl.ang.toFixed(3)}rad)`;
    }
    if (!welcomed && fleet.planes.every((p) => p.down)) { welcomed = true; setTimeout(() => { $(".swap")?.classList.add("on"); $(".go").classList.add("on"); }, still ? 0 : 500); }
    if (S.alive()) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  if (phase !== "travel") setTimeout(() => $(".go").classList.add("on"), still ? 300 : 2600);
}

// The routes on the pane: one per city the crew flies from, from the pane's edge on that city's side into
// Denver (cities that lie close together pushed apart); friends from one city side by side on it.
function layFleet(fleet, V, crew, AIRPORTS) {
  const [x0, y0] = V.den, W = V.W, H = V.H, by = new Map();
  for (const p of crew) { const k = p.from === "DEN" ? "DEN" : AIRPORTS[p.from] ? p.from : "?"; if (!by.has(k)) by.set(k, []); by.get(k).push(p); }
  fleet.local = by.get("DEN") || []; by.delete("DEN");
  // Denver sits low on the pane, so the cities fan out above it: east and west lean up toward the top, as
  // a map's bearings squeezed into the upper half (no airport yet: from the west).
  const fan = (a) => { const w = ((a + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI / 2; return Math.PI / 2 + (Math.max(-0.5, Math.min(Math.PI + 0.5, w)) - Math.PI / 2) * 0.62; }; // south-west stays west
  const keys = [...by.keys()], ang = spread(keys.map((k) => fan(k === "?" ? Math.PI * 0.82 : bearing(AIRPORTS[k], AIRPORTS.DEN))), 0.42, 0.12, Math.PI - 0.12);
  const reach = (v, lo, hi, o) => (v > 1e-6 ? (hi - o) / v : v < -1e-6 ? (lo - o) / v : Infinity);
  const legs = [];
  keys.forEach((k, g) => {
    const ux = Math.cos(ang[g]), uy = -Math.sin(ang[g]), nx = -uy, ny = ux;
    const len = Math.min(520, reach(ux, 70, W - 70, x0), reach(uy, 110, H - 84, y0)), cx = x0 + ux * len, cy = y0 + uy * len;
    fleet.cities.push({ x: cx, y: cy, code: k === "?" ? "???" : k, dx: ux });
    const m = by.get(k);
    m.forEach((p, j) => { const off = (j - (m.length - 1) / 2) * 44; legs.push({ p, A: [cx + nx * off, cy + ny * off], ang: ang[g] + j * 1e-3 }); });
  });
  // Each lands on the tarmac in a row above Denver, west to east, so no two park on top of each other.
  const n = legs.length, order = [...legs].sort((a, b) => b.ang - a.ang);
  for (const leg of legs) {
    const { A } = leg, B = [x0 + (order.indexOf(leg) - (n - 1) / 2) * 96, y0 - 66];
    const l = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, nx = -(B[1] - A[1]) / l, ny = (B[0] - A[0]) / l, up = ny > 0 ? -1 : 1;
    const C = [(A[0] + B[0]) / 2 + nx * l * 0.14 * up, (A[1] + B[1]) / 2 + ny * l * 0.14 * up]; // arcing over, as flights do
    const at = (u) => [(1 - u) ** 2 * A[0] + 2 * (1 - u) * u * C[0] + u * u * B[0], (1 - u) ** 2 * A[1] + 2 * (1 - u) * u * C[1] + u * u * B[1]];
    fleet.planes.push({ p: leg.p, at, u: 0, alt: 0, ang: 0, i: fleet.planes.length });
  }
}

// Drag a plane and it wobbles after your finger a little, then springs back; a tap (barely moved) is tap().
function wiggle(el, tap) {
  const wob = el.querySelector(".wob"); let d = null;
  el.onpointerdown = (e) => { e.stopPropagation(); try { el.setPointerCapture(e.pointerId); } catch { /* fine */ } d = { x: e.clientX, y: e.clientY, moved: false }; wob.style.transition = "none"; };
  el.onpointermove = (e) => {
    if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.hypot(dx, dy) > 6) d.moved = true;
    const ox = 16 * Math.tanh(dx / 40), oy = 16 * Math.tanh(dy / 40);
    wob.style.transform = `translate(${ox.toFixed(1)}px, ${oy.toFixed(1)}px) rotate(${(ox * 1.4).toFixed(1)}deg)`;
  };
  const up = (e) => { if (!d) return; e.stopPropagation(); const moved = d.moved; d = null; wob.style.transition = "transform .7s cubic-bezier(.3,1.9,.5,1)"; wob.style.transform = ""; if (!moved) tap(); };
  el.onpointerup = up; el.onpointercancel = up;
  el.onclick = (e) => e.stopPropagation(); // not a tap to skip
}

// A day's weather at a resort (Open-Meteo's daily forecast, as the trips page reads it), or null.
async function dayWeather(r, date) {
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${r.lat}&longitude=${r.lon}&daily=weather_code,snowfall_sum,temperature_2m_max,temperature_2m_min&timezone=America%2FDenver&start_date=${date}&end_date=${date}`;
    const j = await (await fetch(u)).json(), dd = j.daily;
    if (!dd?.time?.length || !Number.isFinite(dd.temperature_2m_max[0])) return null;
    return { code: dd.weather_code[0], cm: dd.snowfall_sum[0] || 0, hi: dd.temperature_2m_max[0], lo: dd.temperature_2m_min[0] };
  } catch { return null; } // offline, or past its window: no line
}
// The owner's weather icons, as the trips page picks them, and their words.
const wxIcon = (w) => {
  const c = w.code;
  if (w.cm >= 0.5 || [71, 73, 75, 77, 85, 86].includes(c)) return w.cm >= 10 || c === 75 || c === 86 ? "heavysnow" : c <= 2 ? "snowsun" : w.cm < 2 || c === 71 || c === 85 ? "lightsnow" : "snow";
  return c === 0 ? "sunny" : c <= 2 ? "partly" : c === 45 || c === 48 ? "fog" : "cloudy";
};
const WXWORD = { sunny: "晴", partly: "少云", cloudy: "多云", fog: "雾", lightsnow: "小雪", snow: "降雪", heavysnow: "大雪", snowsun: "晴雪" };

// The frosted pane behind the intro, seen from below: snowboarders ride across its far side. The board is
// pressed to the glass, so it's sharp; the rider standing on it rises away from us, so their legs blur more the
// higher they go, and their body is a soft shadow leaning into the turn. Each run comes in from some edge,
// links turns of its own sizes down its own fall line, and leaves; then another starts. Snow thrown off each
// turn hangs and settles.
function glass(c, alive, mood) {
// Safari can't blur on a canvas (ctx.filter), so each depth gets its own canvas, blurred and faded by CSS:
// the farther from the glass, the blurrier. Shapes within a layer are drawn solid, so they merge, not stack.
const W = c.width, H = c.height;
const layer = (blur, opacity, scale) => { const e = document.createElement("canvas"); e.width = W * scale; e.height = H * scale;
  e.style.cssText = `position:absolute;left:0;top:0;width:${c.style.width || "100%"};height:${c.style.height || "100%"};filter:blur(${blur}px);opacity:${opacity};pointer-events:none`;
  c.after(e); const x = e.getContext("2d"); x.setTransform(scale, 0, 0, scale, 0, 0); return x; };
// built in reverse (each goes right after #bg): board on top, then shins, thighs, body, spray
const L_BOARD = layer(0.9, 0.92, 1), L_SHIN = layer(4, 0.78, 0.5), L_THIGH = layer(9, 0.6, 0.5), L_BODY = layer(17, 0.42, 0.5), L_SPRAY = layer(3.5, 1, 0.5);
const g = c.getContext("2d"), LAYERS = [L_BOARD, L_SHIN, L_THIGH, L_BODY, L_SPRAY];
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const M = mood, SLOTS = M.slots, GAP = M.gap; // riders at a time; a slot's next run starts GAP s after its last began
const lerp = ([a, b], u) => a + (b - a) * u;
// A run: start off one edge, head across (mostly downhill: top to bottom, but sometimes side to side or
// diagonally), turning by a heading that swings left and right, each turn its own length and depth.
const runs = new Map();
function run(slot, n) {
  const key = slot * 1e5 + n; if (runs.has(key)) return runs.get(key);
  if (M.pair && slot === 1) { // the friend, riding alongside: the same line, a little to one side
    const a = run(0, n), pts = a.pts.map(([x, y, th, k]) => [x - Math.sin(th) * 120, y + Math.cos(th) * 120, th, k]);
    const r = { pts, v: a.v, start: a.start + 0.25 }; runs.set(key, r); return r;
  }
  const h = (i) => hash(key * 13 + i);
  const dirs = M.meet ? [[slot ? -1 : 1, 0.3]] : M.dirs; // meet: two from opposite sides
  const [dx, dy] = dirs[Math.floor(h(1) * dirs.length)], base = Math.atan2(dy, dx);
  // enter from the edge behind the direction of travel, somewhere along it
  const along = M.meet ? 0.5 : 0.15 + 0.7 * h(2);
  let x = W / 2 - dx * (W / 2 + 260) + (dy ? (along - 0.5) * W : 0), y = H / 2 - dy * (H / 2 + 260) + (dx ? (along - 0.5) * H : 0);
  const pts = []; let th = base, s = 0, turn = 0, sign = h(3) < 0.5 ? 1 : -1, len = 0, amp = 0, s0 = 0;
  while (pts.length < 4000) {
    if (s >= s0 + len) { s0 = s; len = lerp(M.len, h(10 + turn)); amp = lerp(M.amp, h(40 + turn)); sign = -sign; turn++; } // a new turn
    const u = (s - s0) / len, prev = th;
    th = base + sign * amp * Math.sin(Math.PI * u);
    const k = (th - prev) / 4; // curvature, radians per px
    pts.push([x, y, th, k]);
    x += Math.cos(th) * 4; y += Math.sin(th) * 4; s += 4;
    if (x < -400 || x > W + 400 || y < -400 || y > H + 400) break;
  }
  const r = { pts, v: lerp(M.v, h(5)), start: (M.meet ? 0 : slot * GAP / SLOTS + h(6) * 2) + n * GAP - 4 };
  runs.set(key, r); if (runs.size > 40) runs.delete(runs.keys().next().value);
  return r;
}
// Where slot's rider is at time t: [x, y, heading, lean (-1..1, + = turning to its left), run id], or null.
const T_OFF = Math.random() * 120; // a different moment each visit
function at(slot, t) {
  t += T_OFF;
  for (let n = Math.max(0, Math.floor((t - slot * GAP / SLOTS) / GAP) - 1); ; n++) {
    const r = run(slot, n); if (r.start > t) return null;
    const i = Math.floor((t - r.start) * r.v / 4); if (i < r.pts.length) { const [x, y, th, k] = r.pts[i]; return [x, y, th, Math.max(-1, Math.min(1, k * 260)), n]; }
  }
}
const riders = (t) => Array.from({ length: SLOTS }, (_, s) => { const p = at(s, t); return p ? { x: p[0] / W, y: p[1] / H, lean: p[3] } : { x: 0.5, y: -1, lean: 0 }; });

// The rider, in screen space. "Up" (away from the glass) shows as a drift away from the screen's middle, as
// if we looked up from below its centre; and they lean to the inside of the turn.
const INK = "#161a1f";
function rider(x, y, th, lean) {
  const fx = Math.cos(th), fy = Math.sin(th), px = -fy, py = fx;
  let ux = (x - W / 2) / W, uy = (y - H / 2) / H; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
  const L = 175, ix = px * lean * 80, iy = py * lean * 80;
  const up = (f) => [ux * L * f + ix * f, uy * L * f + iy * f];
  const feet = [-46, 46].map((b) => [x + fx * b, y + fy * b]);
  const knee = (f, side) => { const [a, b] = up(0.55); return [f[0] + a + fx * side * 12, f[1] + b + fy * side * 12]; };
  const [hx, hy] = up(1.05), hip = [x + hx, y + hy], [tx, ty] = up(1.75), chest = [x + tx, y + ty];
  // a limb: tapered, wider at the top, as a filled shape so it reads soft, not as a stick
  const limb = (g, a, b, w0, w1) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    g.fillStyle = INK; g.beginPath(); g.moveTo(a[0] + nx * w0, a[1] + ny * w0); g.lineTo(b[0] + nx * w1, b[1] + ny * w1); g.lineTo(b[0] - nx * w1, b[1] - ny * w1); g.lineTo(a[0] - nx * w0, a[1] - ny * w0); g.fill();
    g.beginPath(); g.arc(a[0], a[1], w0, 0, 7); g.arc(b[0], b[1], w1, 0, 7); g.fill(); };
  L_BODY.fillStyle = INK; L_BODY.beginPath(); L_BODY.ellipse(chest[0], chest[1], 74, 60, th, 0, 7); L_BODY.fill();
  for (const sd of [-1, 1]) limb(L_BODY, chest, [chest[0] + fx * sd * 100 + ux * 30, chest[1] + fy * sd * 100 + uy * 30], 22, 14);
  limb(L_BODY, hip, chest, 46, 56);
  feet.forEach((f, i) => { const kn = knee(f, i ? -1 : 1); limb(L_THIGH, kn, hip, 24, 30); limb(L_SHIN, f, kn, 19, 23); });
}
function board(x, y, th) {
  const g = L_BOARD; g.save(); g.translate(x, y); g.rotate(th);
  // a real board's outline: round nose and tail, wider than the waist (the sidecut)
  const out = () => { g.beginPath(); g.moveTo(-84, -26); g.quadraticCurveTo(0, -20, 84, -26); g.bezierCurveTo(112, -27, 116, 27, 84, 26);
    g.quadraticCurveTo(0, 20, -84, 26); g.bezierCurveTo(-116, 27, -112, -27, -84, -26); g.closePath(); };
  g.fillStyle = "#1b1f24"; out(); g.fill();
  g.strokeStyle = "rgba(160,170,180,.5)"; g.lineWidth = 2; out(); g.stroke(); // the steel edge catching the light
  g.fillStyle = "#2f353c"; for (const b of [-46, 46]) { g.beginPath(); g.roundRect(b - 15, -20, 30, 40, 9); g.fill(); }
  g.restore();
}
const DT = 0.05, LIFE = 1.4;
function frame(now) {
  const t = now / 1000;
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#e2e8ee"); bg.addColorStop(1, "#d2dae2");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (const l of LAYERS) l.clearRect(0, 0, W, H);
  // spray off the outside of each turn, through its apex
  const sp = L_SPRAY;
  for (let sl = 0; sl < SLOTS; sl++) {
    const now = at(sl, t); if (!now) continue;
    for (let k = Math.floor(t / DT); k * DT > t - LIFE; k--) {
      const born = k * DT, age = (t - born) / LIFE; if (age < 0) continue;
      const p = at(sl, born); if (!p || p[4] !== now[4]) continue;
      const [x, y, th, lean] = p, hard = lean * lean; if (hard < 0.12) continue;
      const fx = Math.cos(th), fy = Math.sin(th), sg = lean > 0 ? -1 : 1, nx = -fy * sg, ny = fx * sg;
      for (let j = 0; j < 4; j++) {
        const h = hash(sl * 1e4 + k * 7 + j), h2 = hash(sl * 1e4 + k * 7 + j + 0.5);
        const out = (30 + h * 70) * hard * (0.5 + age), back = -age * 40;
        const qx = x + nx * out + fx * back + (h2 - 0.5) * 30, qy = y + ny * out + fy * back + (h - 0.5) * 30;
        const rad = (14 + h2 * 20) * (0.6 + age * 1.4) * hard, a = (1 - age) ** 1.5;
        sp.fillStyle = `rgba(120,138,160,${0.3 * a})`; sp.beginPath(); sp.arc(qx + 6, qy + 8, rad, 0, 7); sp.fill();
        sp.fillStyle = `rgba(255,255,255,${0.9 * a})`; sp.beginPath(); sp.arc(qx, qy, rad, 0, 7); sp.fill();
      }
    }
  }
  for (let sl = 0; sl < SLOTS; sl++) { const p = at(sl, t); if (p) { rider(p[0], p[1], p[2], p[3]); board(p[0], p[1], p[2]); } }
  if (alive()) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
return riders;
}

// The words, letter by letter (words, for English), pushed aside as a rider passes over them and easing back,
// with a little tilt, as if the board's wind caught them.
function letters(box, riders, alive) {
  const wrap = (p, by) => { const parts = p.innerHTML.split(/(<br>)/); p.innerHTML = parts.map((x) => x === "<br>" ? x : (by === "word" ? x.split(/( )/) : [...x]).map((ch) => ch === " " ? " " : `<span class="ch">${ch}</span>`).join("")).join(""); };
  box.querySelectorAll(".cap .over").forEach((p) => wrap(p, EN_ON ? "word" : "char"));
  box.querySelectorAll(".cap .under").forEach((p) => wrap(p, "word"));
  const els = [...box.querySelectorAll(".cap .ch")].map((e) => ({ e, deep: !!e.closest(".under"), x: 0, y: 0, vx: 0, vy: 0, cx: 0, cy: 0 }));
  const measure = () => { for (const l of els) { l.e.style.transform = ""; const r = l.e.getBoundingClientRect(); l.cx = r.left + r.width / 2; l.cy = r.top + r.height / 2; } };
  measure(); addEventListener("resize", measure);
  let last = performance.now();
  const step = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const rs = riders(now / 1000).map((r) => [r.x * innerWidth, r.y * innerHeight]);
    for (const l of els) {
      let fx = 0, fy = 0;
      for (const [x, y] of rs) { const dx = l.cx - x, dy = l.cy - y, d = Math.hypot(dx, dy); if (d < 140) { const f = (1 - d / 140) ** 2 * (l.deep ? 900 : 1600); fx += dx / (d || 1) * f; fy += dy / (d || 1) * f; } }
      l.vx += (fx - l.x * 60 - l.vx * 9) * dt; l.vy += (fy - l.y * 60 - l.vy * 9) * dt; // a spring home, damped
      l.x += l.vx * dt; l.y += l.vy * dt;
      l.e.style.transform = Math.abs(l.x) + Math.abs(l.y) < 0.1 ? "" : `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px) rotate(${(l.x * 0.6).toFixed(1)}deg)`;
    }
    if (alive()) requestAnimationFrame(step); else removeEventListener("resize", measure);
  };
  requestAnimationFrame(step);
}

// The valley from above, painted on its own canvas, dressed for its words:
//   road    the highway up the valley, a little car on it, wind streaming across
//   depart  a plane taking off from Denver and climbing away
//   summit  high ground: peaks in strong light and shade, prayer flags on the top
//   now     the road and the river, cars on the move, light glinting on the ice
//   tracks  a slope in falling snow, two riders' tracks drawn side by side
//   meet    a cabin with a warm window, two lines of footprints coming to it
//   trip    a trip's routes, one per city its crew flies from, into Denver (the planes are fleet's, drawn
//           over the pane in the page so they can be tapped; here go their trails, shadows and the cities)
// Returns where Denver is on it. alive() false after the first frame: a still picture.
function valley(c, scene, fleet, alive) {
const g = c.getContext("2d"), W = c.width, H = c.height;
const SC = { road: { seed: 7, road: 1, river: 1, den: 0 }, depart: { seed: 11, road: 1, river: 1, den: 1 }, summit: { seed: 23, road: 0, river: 0, den: 0, relief: 2.4 },
  now: { seed: 5, road: 1, river: 1, den: 0 }, tracks: { seed: 31, road: 0, river: 0, den: 0, relief: 1.4, snow: 3 }, meet: { seed: 17, road: 0, river: 1, den: 0 }, trip: { seed: 7, road: 1, river: 1, den: 1, rx: 0.44, vx: 0.82, dy: 0.8 } }[scene];
let seed = SC.seed; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// Value noise.
const P = Array.from({ length: 512 }, () => rnd());
const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, h = (i, j) => P[((i * 73856093) ^ (j * 19349663)) & 511], s = (t) => t * t * (3 - 2 * t);
  const a = h(xi, yi), b = h(xi + 1, yi), cc = h(xi, yi + 1), d = h(xi + 1, yi + 1); return a + (b - a) * s(xf) + (cc - a) * s(yf) + (a - b - cc + d) * s(xf) * s(yf); };
const fbm = (x, y) => vn(x, y) * 0.5 + vn(x * 2, y * 2) * 0.25 + vn(x * 4, y * 4) * 0.125 + vn(x * 8, y * 8) * 0.0625;
// The ground, painted once.
const ground = document.createElement("canvas"); ground.width = W; ground.height = H;
const gg = ground.getContext("2d"), img = gg.createImageData(W, H);
const river = (y) => W * (SC.vx || 0.62) + Math.sin(y / 120) * 60 + Math.sin(y / 47) * 14; // the river's line
const road = (y) => W * (SC.rx || 0.3) + Math.sin(y / 160 + 1) * 46;
const RL = SC.relief || 1;
// For the summit, a mountain: a peak with ridges running off it (ridged noise on a cone), lit from the top left.
const PK = [W * 0.55, H * 0.42];
const ridged = (x, y) => { let a = 0, f = 1 / 160, w = 0.5; for (let i = 0; i < 4; i++) { a += (1 - Math.abs(vn(x * f, y * f) * 2 - 1)) * w; f *= 2; w *= 0.5; } return a; };
const mtn = (x, y) => { const d = Math.hypot(x - PK[0], (y - PK[1]) * 1.1), a = Math.atan2(y - PK[1], x - PK[0]);
  const arms = 0.5 + 0.5 * Math.cos(a * 4 + 0.6) ** 8; // four ridges running off the top
  return Math.max(0, 1 - d / (300 + 160 * arms)) ** 1.5 * (0.7 + 0.3 * ridged(x, y)); };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const h = RL > 2 ? mtn(x, y) : fbm(x / 140, y / 140);
  const e = RL > 2 ? (mtn(x + 2, y + 2) - mtn(x - 2, y - 2)) * 260 : (fbm((x + 3) / 140, y / 140) - fbm((x - 3) / 140, y / 140)) * 30 * RL; // slope toward the light
  let r = 244, gr = 247, b = 251;
  const shade = Math.max(-1, Math.min(1, e)); r -= shade * 26 + 6; gr -= shade * 20 + 4; b -= shade * 8; // blue shadows
  if (RL > 2) { const lo = Math.max(0, 0.35 - h) * 70; r -= lo; gr -= lo * 0.6; b -= lo * 0.15; } // high ground stays bright, the valleys go blue
  const k = (y * W + x) * 4;
  const dr = SC.river ? Math.abs(x - river(y)) : 1e9, drd = SC.road ? Math.abs(x - road(y)) : 1e9;
  if (dr < 22 + vn(y / 20, 3) * 6) { const ice = dr < 15; r = ice ? 140 : 205; gr = ice ? 186 : 222; b = ice ? 222 : 236; } // ice, and its snowy bank
  else if (drd < 7) { r = 170; gr = 158; b = 146; } // the road, ploughed
  img.data[k] = r; img.data[k + 1] = gr; img.data[k + 2] = b; img.data[k + 3] = 255;
}
gg.putImageData(img, 0, 0);
// Spruce in clumps where the noise says woods, kept off the river and the road.
for (let i = 0; i < 2600; i++) {
  const x = rnd() * W, y = rnd() * H;
  if (fbm(x / 90 + 9, y / 90) < 0.52 || (SC.river && Math.abs(x - river(y)) < 30) || (SC.road && Math.abs(x - road(y)) < 16)) continue;
  if (RL > 2 && mtn(x, y) > 0.28) continue; // no trees up high
  if (scene === "tracks" && Math.abs(x - W * 0.5) < 150) continue; // the open slope
  if (scene === "meet" && Math.hypot(x - W * 0.42, y - H * 0.55) < 70) continue; // the cabin's clearing
  const s = 4 + rnd() * 5;
  gg.fillStyle = "rgba(40,60,70,.18)"; gg.beginPath(); gg.ellipse(x + s * 0.8, y + s * 0.6, s, s * 0.6, 0, 0, 7); gg.fill(); // shadow, the sun from the top left
  gg.fillStyle = ["#2f5446", "#3b6152", "#294a3e"][i % 3]; gg.beginPath(); gg.arc(x, y, s, 0, 7); gg.fill();
  gg.fillStyle = "rgba(255,255,255,.7)"; gg.beginPath(); gg.arc(x - s * 0.3, y - s * 0.35, s * 0.45, 0, 7); gg.fill(); // snow on top
}
// Denver: a few warm roofs where the road meets the bottom.
const den = { x: road(H * (SC.dy || 0.82)) + 30, y: H * (SC.dy || 0.82) };
if (SC.den) for (let i = 0; i < 26; i++) { const x = den.x + (rnd() - 0.5) * 90, y = den.y + (rnd() - 0.5) * 50; gg.fillStyle = ["#c9a07a", "#b6463b", "#d8c4a8"][i % 3]; gg.fillRect(x, y, 7, 5); gg.fillStyle = "rgba(255,255,255,.8)"; gg.fillRect(x, y, 7, 2); }
// The torn paper edge.
const mask = document.createElement("canvas"); mask.width = W; mask.height = H;
const mg = mask.getContext("2d"); mg.fillStyle = "#000"; mg.beginPath();
const edge = (t) => 18 + vn(t / 9, 1) * 16;
for (let x = 0; x <= W; x += 3) mg.lineTo(x, edge(x));
for (let y = 0; y <= H; y += 3) mg.lineTo(W - edge(y + 500), y);
for (let x = W; x >= 0; x -= 3) mg.lineTo(x, H - edge(x + 900));
for (let y = H; y >= 0; y -= 3) mg.lineTo(edge(y + 1300), y);
mg.fill();
// Clouds: soft white heaps drifting, each with its shadow on the snow.
const clouds = Array.from({ length: 6 }, (_, i) => ({ x: rnd() * W, y: rnd() * H, r: 40 + rnd() * 50, v: 6 + rnd() * 8, puffs: Array.from({ length: 7 }, () => [(rnd() - 0.5) * 1.4, (rnd() - 0.5) * 0.8, 0.5 + rnd() * 0.5]) }));
const plane = (x, y, a, s) => { g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
  g.fillStyle = "#4a5563"; g.beginPath(); g.ellipse(0, 0, 16, 3, 0, 0, 7); g.fill(); g.fillRect(-4, -14, 7, 28); g.fillRect(-15, -5, 4, 10);
  g.fillStyle = "#fdfbf6"; g.fillRect(-3, -13, 2, 26); g.restore(); };
// The scene's own things.
let peak = [W / 2, H / 2]; // the highest ground, for the summit's flags
if (scene === "summit") { let best = -1; for (let y = 120; y < H - 120; y += 6) for (let x = 120; x < W - 120; x += 6) { const h = mtn(x, y); if (h > best) { best = h; peak = [x, y]; } } }
const car = (x, y, a, col) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = "rgba(40,50,70,.25)"; g.fillRect(-5, -8, 13, 19); g.fillStyle = col; g.beginPath(); g.roundRect(-6, -10, 12, 20, 3); g.fill();
  g.fillStyle = "rgba(255,255,255,.75)"; g.fillRect(-4.5, -6, 9, 4); g.fillStyle = "#ffe9a8"; g.fillRect(-5, -11, 3, 2); g.fillRect(2, -11, 3, 2); g.restore(); };
const onRoad = (u) => { const y = H * (1.1 - u * 1.3), y2 = y - 4; return [road(y), y, Math.atan2(road(y2) - road(y), -4) * -1]; }; // u 0..1 bottom to top
const trail = (pts, upto, col, w) => { g.fillStyle = col; for (let i = 0; i < pts.length * upto; i++) { const [x, y, side] = pts[i]; g.beginPath(); g.ellipse(x + side * w, y, 2.2, 3.2, 0, 0, 7); g.fill(); } };
const steps = (x0, y0, x1, y1, bend) => Array.from({ length: 40 }, (_, i) => { const u = i / 39; return [x0 + (x1 - x0) * u + Math.sin(u * Math.PI) * bend, y0 + (y1 - y0) * u, i % 2 ? 1 : -1]; });
const cabin = [W * 0.42, H * 0.55], walkA = steps(60, 40, cabin[0] - 14, cabin[1] - 30, 90), walkB = steps(W - 60, 70, cabin[0] + 14, cabin[1] - 30, -110);
function extras(t) {
  if (scene === "road" || scene === "now") { // cars up (and down) the highway
    const cars = scene === "road" ? [[0, "#b6463b", 1]] : [[0, "#b6463b", 1], [0.45, "#22344d", 1], [0.2, "#e8e2d4", -1]];
    for (const [off, col, dir] of cars) { let u = ((t / 9 + off) % 1); if (dir < 0) u = 1 - u; const [x, y] = onRoad(u), [x2, y2] = onRoad(u + 0.005 * dir); car(x + dir * 5, y, Math.atan2(x2 - x, -(y2 - y)), col); }
  }
  if (scene === "now") { g.fillStyle = "rgba(255,255,255,.95)"; for (let i = 0; i < 14; i++) { const y = ((P[i] * H + t * 40) % H), x = river(y) + (P[i + 20] - 0.5) * 14, a = 0.5 + 0.5 * Math.sin(t * 3 + i); g.globalAlpha = a; g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); } g.globalAlpha = 1; }
  if (scene === "road" || scene === "tracks") { // wind: long thin streaks blowing across
    g.strokeStyle = "rgba(255,255,255,.75)"; g.lineCap = "round";
    for (let i = 0; i < 9; i++) { const ph = (t * 0.35 + P[i + 40]) % 1, y = P[i + 80] * H, x = -200 + ph * (W + 400); g.lineWidth = 1.5 + P[i] * 1.5; g.globalAlpha = Math.sin(ph * Math.PI) * 0.8;
      g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 50, y - 10, x + 100, y + 8, x + 160, y - 4); g.stroke(); }
    g.globalAlpha = 1;
  }
  if (scene === "depart") { // off the runway, climbing away north-west, again every 7 s
    const u = (t % 7) / 5; if (u <= 1) { const e = u * u, x0 = den.x + 20, y0 = den.y, x = x0 - e * 520, y = y0 - e * 760, s = 1 + e * 1.6;
      g.fillStyle = "rgba(182,70,59,.7)"; for (let k = 0; k < e; k += 0.02) { g.beginPath(); g.arc(x0 - k * 520, y0 - k * 760, 1.6, 0, 7); g.fill(); }
      g.fillStyle = "rgba(40,50,70,.18)"; g.beginPath(); g.ellipse(x + 40 * e, y + 30 * e, 12 * s, 4 * s, 0, 0, 7); g.fill(); plane(x, y, Math.atan2(-760, -520), s); }
  }
  if (scene === "summit") { // a string of prayer flags across the top, stirring
    const [px, py] = peak, cols = ["#3d6fb6", "#f4f1ea", "#b6463b", "#4f8a5b", "#e2b53c"];
    g.strokeStyle = "rgba(60,50,40,.6)"; g.lineWidth = 1; g.beginPath(); g.moveTo(px - 60, py - 10); g.quadraticCurveTo(px, py + 12, px + 60, py - 14); g.stroke();
    for (let i = 0; i < 10; i++) { const u = (i + 0.5) / 10, x = px - 60 + 120 * u, y = (1 - u) ** 2 * (py - 10) + 2 * (1 - u) * u * (py + 12) + u * u * (py - 14), f = Math.sin(t * 4 + i) * 2;
      g.fillStyle = cols[i % 5]; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.lineTo(x + 4 + f, y + 9); g.lineTo(x - 4 + f, y + 9); g.fill(); }
    g.fillStyle = "#4a453f"; g.beginPath(); g.arc(px - 64, py - 10, 2.5, 0, 7); g.arc(px + 64, py - 14, 2.5, 0, 7); g.fill();
  }
  if (scene === "tracks") { // two riders' tracks, side by side down the open slope, drawn as they go (every 9 s)
    const u = Math.min(1, (t % 9) / 6);
    for (const [dx, ph] of [[-16, 0], [16, 0.5]]) { g.strokeStyle = "rgba(120,140,165,.55)"; g.lineWidth = 3; g.beginPath();
      for (let y = 30; y < 30 + (H - 60) * u; y += 4) { const x = W / 2 + dx + Math.sin(y / 110 + ph) * 90; y === 30 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
  }
  if (scene === "meet") { // the cabin, warm inside; two lines of steps arriving
    const u = Math.min(1, (t % 10) / 6), [cx, cy] = cabin;
    trail(walkA, u, "rgba(110,128,150,.55)", 4); trail(walkB, u, "rgba(110,128,150,.55)", 4);
    g.save(); g.translate(cx, cy); g.scale(1.6, 1.6); g.translate(-cx, -cy);
    g.fillStyle = "rgba(40,50,70,.22)"; g.fillRect(cx - 20, cy - 12, 52, 36);
    g.fillStyle = "#7a5a44"; g.fillRect(cx - 26, cy - 18, 52, 36); g.fillStyle = "#f6f4ef"; g.beginPath(); g.moveTo(cx - 32, cy - 18); g.lineTo(cx, cy - 34); g.lineTo(cx + 32, cy - 18); g.lineTo(cx + 32, cy + 2); g.lineTo(cx - 32, cy + 2); g.fill(); // snowy roof
    const glow = 0.75 + 0.25 * Math.sin(t * 2.3); g.fillStyle = `rgba(255,200,110,${glow})`; g.fillRect(cx - 18, cy + 4, 9, 8); g.fillRect(cx + 9, cy + 4, 9, 8);
    const gl = g.createRadialGradient(cx, cy + 14, 4, cx, cy + 14, 60); gl.addColorStop(0, `rgba(255,190,100,${0.28 * glow})`); gl.addColorStop(1, "rgba(255,190,100,0)"); g.fillStyle = gl; g.beginPath(); g.arc(cx, cy + 14, 60, 0, 7); g.fill();
    g.restore();
    for (let i = 0; i < 5; i++) { const ph = (t * 0.3 + i / 5) % 1; g.fillStyle = `rgba(250,250,252,${0.6 * (1 - ph)})`; g.beginPath(); g.arc(cx + 16 + ph * 30, cy - 30 - ph * 70, 5 + ph * 12, 0, 7); g.fill(); } // chimney smoke
  }
}
// A trip's routes: each city a navy dot with its code; the way to Denver faint and dashed, the part flown
// in red dots (home again after it: the whole way), each plane's shadow on the snow; Denver a red dot.
function routes(t) {
  g.lineCap = "round";
  for (const p of fleet?.planes || []) {
    const to = fleet.phase === "after" ? 1 : p.u; // after the trip: the whole way, flown
    if (fleet.phase !== "travel" || p.u > 0) { g.strokeStyle = "rgba(34,52,77,.42)"; g.lineWidth = 2.5; g.setLineDash([8, 9]); g.beginPath(); for (let k = 0; k <= 40; k++) { const [x, y] = p.at(k / 40); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.setLineDash([]); }
    g.fillStyle = "rgba(182,70,59,.8)"; for (let k = 0; k < to; k += 0.03) { const [x, y] = p.at(k); g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); }
    if (p.alt > 0.02) { const [x, y] = p.at(p.u), s = 1 + p.alt; g.fillStyle = "rgba(40,50,70,.16)"; g.beginPath(); g.ellipse(x + 34 * p.alt, y + 28 * p.alt, 20 * s, 7 * s, p.ang, 0, 7); g.fill(); }
  }
  g.font = "600 22px Oswald, sans-serif"; g.textBaseline = "middle";
  for (const c of fleet?.cities || []) {
    g.fillStyle = "rgba(253,251,246,.9)"; g.beginPath(); g.arc(c.x, c.y, 9, 0, 7); g.fill();
    g.fillStyle = "#22344d"; g.beginPath(); g.arc(c.x, c.y, 5.5, 0, 7); g.fill();
    const lx = Math.max(56, Math.min(W - 56, c.x)), ly = c.y - 24; // its code above it, kept on the paper
    g.textAlign = "center"; g.lineWidth = 5; g.strokeStyle = "rgba(253,251,246,.85)"; g.lineJoin = "round"; g.strokeText(c.code, lx, ly);
    g.fillStyle = "#22344d"; g.fillText(c.code, lx, ly);
  }
  // Denver
  g.fillStyle = `rgba(182,70,59,${0.18 + 0.08 * Math.sin(t * 2)})`; g.beginPath(); g.arc(den.x, den.y, 18, 0, 7); g.fill();
  g.fillStyle = "#b6463b"; g.beginPath(); g.arc(den.x, den.y, 8, 0, 7); g.fill();
  g.textAlign = "left"; g.lineWidth = 5; g.strokeStyle = "rgba(253,251,246,.85)"; g.strokeText("DEN", den.x + 22, den.y + 2); g.fillStyle = "#b6463b"; g.fillText("DEN", den.x + 22, den.y + 2);
  g.textBaseline = "alphabetic";
}
const FLAKES = 60 * (SC.snow || 1);
const t0 = performance.now();
function frame(now) {
  const t = (now - t0) / 1000;
  g.clearRect(0, 0, W, H); g.save(); g.drawImage(mask, 0, 0); g.globalCompositeOperation = "source-in"; g.drawImage(ground, 0, 0);
  g.globalCompositeOperation = "source-atop";
  for (const cl of clouds) { // shadows first, then the clouds above them
    const x = ((cl.x + cl.v * t * 6) % (W + 300)) - 150, y = cl.y;
    g.fillStyle = "rgba(60,80,110,.12)"; for (const [dx, dy, s] of cl.puffs) { g.beginPath(); g.arc(x + dx * cl.r + 34, y + dy * cl.r + 26, cl.r * s, 0, 7); g.fill(); }
  }
  extras(t);
  if (scene === "trip") routes(t);
  for (const cl of clouds) {
    const x = ((cl.x + cl.v * t * 6) % (W + 300)) - 150, y = cl.y;
    for (const [dx, dy, s] of cl.puffs) { const gr = g.createRadialGradient(x + dx * cl.r - 6, y + dy * cl.r - 8, 2, x + dx * cl.r, y + dy * cl.r, cl.r * s); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.7, "rgba(250,251,253,.95)"); gr.addColorStop(1, "rgba(235,240,246,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x + dx * cl.r, y + dy * cl.r, cl.r * s, 0, 7); g.fill(); }
  }
  // falling snow, tiny
  g.fillStyle = "rgba(255,255,255,.9)";
  for (let i = 0; i < FLAKES; i++) { const x = (P[i % 512] * W + t * 8 * (1 + P[(i + 60) % 512]) + i * 37) % W, y = (P[i + 120] * H + t * 30 * (1 + P[i + 200])) % H; g.beginPath(); g.arc(x, y, 1.2 + P[i + 300] * 1.4, 0, 7); g.fill(); }
  // landed: a stamp at Denver, counting them in
  const FP = fleet?.planes || [], landed = FP.filter((p) => p.down).length;
  if (scene === "trip" && fleet.phase === "travel" && landed) { g.fillStyle = "rgba(253,251,246,.92)"; g.fillRect(den.x - 48, den.y + 34, 96, 24); g.fillStyle = "#b6463b"; g.font = "600 21px 'Cormorant Garamond', serif"; g.textAlign = "center"; g.fillText(`DEN · ${landed}/${FP.length}`, den.x, den.y + 52); }
  g.restore();
  if (alive()) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
return { den: [den.x, den.y], W, H };
}

// The intro's sound, made here (no files): the hiss of boards on snow, swelling as each rider sets an edge
// and panned to where they are; and a slow, quiet piano-ish tune over soft pads. Starts on a tap (browsers
// won't play before one).
function startSound(riders, M) {
  const A = new (window.AudioContext || window.webkitAudioContext)(), out = A.createGain(); out.gain.value = 0.55; out.connect(A.destination);
  // a short room: a feedback delay, lowpassed
  const wet = A.createGain(), dl = A.createDelay(), fb = A.createGain(), lp = A.createBiquadFilter();
  dl.delayTime.value = 0.32; fb.gain.value = 0.38; lp.type = "lowpass"; lp.frequency.value = 2200; wet.gain.value = 0.35;
  dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(out);
  // noise, shared
  const nb = A.createBuffer(1, A.sampleRate * 2, A.sampleRate), d = nb.getChannelData(0);
  let b0 = 0; for (let i = 0; i < d.length; i++) { b0 = 0.97 * b0 + 0.03 * (Math.random() * 2 - 1); d[i] = (Math.random() * 2 - 1) * 0.5 + b0 * 3; } // white with some weight
  // one hiss per rider: noise → bandpass (higher, brighter on the edge) → gain → pan
  const voices = (riders(0)).map(() => {
    const src = A.createBufferSource(); src.buffer = nb; src.loop = true; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const bp = A.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.7; bp.frequency.value = 1200;
    const gn = A.createGain(); gn.gain.value = 0; const pan = A.createStereoPanner();
    src.connect(bp); bp.connect(gn); gn.connect(pan); pan.connect(out); src.start();
    return { bp, gn, pan };
  });
  const tick = () => {
    const t = performance.now() / 1000, rs = riders(t);
    rs.forEach((r, i) => { const v = voices[i]; if (!v) return;
      const on = r.y > -0.05 && r.y < 1.05 ? 1 : 0, edge = Math.abs(r.lean) ** 2; // one long "shhh" through each turn's apex
      v.gn.gain.setTargetAtTime(on * (0.008 + 0.05 * edge) * M.hiss, A.currentTime, 0.35);
      v.bp.frequency.setTargetAtTime(600 + edge * 900, A.currentTime, 0.4);
      v.pan.pan.setTargetAtTime((r.x - 0.5) * 1.6, A.currentTime, 0.1); });
    if (A.state !== "closed") requestAnimationFrame(tick);
  };
  tick();
  // wind: low noise breathing in and out (a thin whistle on it, up high)
  if (M.wind) { const src = A.createBufferSource(); src.buffer = nb; src.loop = true; const lp2 = A.createBiquadFilter(); lp2.type = M.high ? "bandpass" : "lowpass"; lp2.frequency.value = M.high ? 1400 : 420; lp2.Q.value = M.high ? 4 : 0.7;
    const wg = A.createGain(); wg.gain.value = M.wind; const lfo = A.createOscillator(), lg = A.createGain(); lfo.frequency.value = 0.09; lg.gain.value = M.wind * 0.8; lfo.connect(lg); lg.connect(wg.gain);
    src.connect(lp2); lp2.connect(wg); wg.connect(out); src.start(); lfo.start(); }
  // the tune: D major pentatonic, a chord every 4 s under a few soft notes
  const note = (f, at, len, vol, type = "sine") => {
    const o = A.createOscillator(), o2 = A.createOscillator(), g = A.createGain(); o.type = M.pluck ? "triangle" : type; o2.type = "sine"; o.frequency.value = f; o2.frequency.value = f * 2.003;
    const g2 = A.createGain(); g2.gain.value = 0.15; o2.connect(g2); g2.connect(g); o.connect(g);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    g.connect(out); g.connect(dl); o.start(at); o2.start(at); o.stop(at + len + 0.1); o2.stop(at + len + 0.1);
  };
  const pad = (fs, at, len) => { for (const f of fs) { const o = A.createOscillator(), g = A.createGain(), f2 = A.createBiquadFilter(); o.type = "triangle"; o.frequency.value = f; f2.type = "lowpass"; f2.frequency.value = 900;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.018, at + 1.5); g.gain.linearRampToValueAtTime(0, at + len); o.connect(f2); f2.connect(g); g.connect(out); g.connect(dl); o.start(at); o.stop(at + len + 0.1); } };
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  const { chords, tune, bar: B, per } = M;
  let bar = 0; const t0 = A.currentTime + 0.1;
  const plan = () => { // schedule a bar ahead
    while (t0 + bar * B < A.currentTime + 6) { const at = t0 + bar * B, ch = chords[bar % chords.length];
      pad(ch.map(hz), at, B * 1.1);
      for (let i = 0; i < per; i++) {
        const m = M.arp ? ch[i % 4] + 12 * (1 + Math.floor(i / 4)) : tune[(bar * per + i) % tune.length]; // arp: climb the chord
        if (m && Math.random() < 0.85) note(hz(m), at + i * (B / per) + (i % 2) * 0.06 * B / 4, M.pluck ? 1.2 : 2.6, M.pluck ? 0.04 : 0.05);
      }
      bar++; }
    if (A.state !== "closed") setTimeout(plan, 1000);
  };
  plan();
  return A;
}
