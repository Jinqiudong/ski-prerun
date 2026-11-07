// Two short transitions, in the opening's style (frosted paper, serif, navy ink, patrol red, Oswald caps):
//   flyIn()    on the resort page while it loads: a little plane from Denver over the painted map, a push-in,
//              and a "LANDED" stamp over the resort's watercolour with today's facts; it ends when the page
//              is ready (never before MIN), then fades into it.
//   liftRide() on the ride page while it loads: the lift ticket gets punched, a chair slides across, into the ride.
//   dropIn(P)  at the top, once a way down is chosen: the run's card and one hint for the way, then DROP IN.
// Tap to skip. Shorter once you've seen one (a count per transition, kept on this phone). prefers-reduced-motion
// gets a plain fade. None under navigator.webdriver (the headless tests) unless the page has ?transition=force.
// Pure DOM, CSS and a 2D canvas: no three.js, so it can start before the page's heavy modules arrive.
import { EN_ON } from "./i18n.js?v=41";

// ---- The words. The owner adds lines here: a fixed pool, one picked at random; "when" limits a line to
// when it is true ("bubble": only on a chair with a bubble). English for everything.
export const COPY = [
  { zh: "明天的雪道，今晚先走一遍", en: "Tomorrow's runs, tonight" },
  { zh: "先认路，明天就不用停下来看地图", en: "Learn the way now; tomorrow, no stopping for the map" },
  { zh: "今天的第一条，慢慢滑", en: "The first run of the day: take it slow" },
  { zh: "坐稳了，放下防风罩", en: "Sit back, pull the bubble down", when: "bubble" },
];
// Lines made from data, shown only when the data is real; and the fixed words of each scene.
export const WORDS = {
  weather: { zh: "今天 · {sky} {temp}", en: "Today · {sky} {temp}" },
  snow: { zh: "{where} 有新雪 · {cm} 厘米", en: "Fresh snow at {where} · {cm} cm" },
  friends: { zh: "{names}已经在山上", en: "{names} already on the mountain" },
  skied: { zh: "你在 {resort} 滑过 {n} 条雪道", en: "You've skied {n} runs at {resort}" },
  progress: { zh: "这是你在 {resort} 的第 {n} 条雪道", en: "Run number {n} for you at {resort}" },
  takeoff: { zh: "起飞", en: "Take off" },
  landed: { zh: "LANDED", en: "LANDED" },
  punch: { zh: "咔哒，票打了孔", en: "Click: ticket punched" },
  seats: { zh: "{n} 人", en: "{n} seats" },
  bubble: { zh: "带防风罩", en: "bubble" },
  cabin: { zh: "{n} 人吊厢", en: "{n}-seat cabin" },
  minutes: { zh: "{km} 公里 · 约 {min} 分钟", en: "{km} km · about {min} min" },
  skip: { zh: "轻点跳过", en: "TAP TO SKIP" },
  top: { zh: "DROP IN · 山顶 {m} m", en: "DROP IN · TOP {m} m" },
  go: { zh: "DROP IN →", en: "DROP IN →" },
  turn: { zh: "一路向下，<br>在 {run} {turn}", en: "All the way down,<br>{turn} at {run}" },
  onto: { zh: "一路向下，<br>接上 {run}", en: "All the way down,<br>then onto {run}" },
  toLift: { zh: "一路向下，<br>到底就是 {lift} 缆车", en: "All the way down<br>to the {lift} lift" },
  toBase: { zh: "一路向下，<br>滑回 {base}", en: "All the way down<br>to {base}" },
  down: { zh: "一路向下，<br>慢慢滑", en: "All the way down,<br>take it slow" },
  connects: { zh: "接 {x} 缆车", en: "to the {x} lift" },
  base: { zh: "回 {x}", en: "back to {x}" },
  via: { zh: "先滑 {x}", en: "first {x}" },
};
const SKY = { clear: ["蓝鸟天", "bluebird"], night: ["晴夜", "clear night"], partly: ["晴间多云", "sun and cloud"], cloudy: ["阴天", "overcast"], fog: ["有雾", "fog"],
  snow: ["正在下雪", "snowing"], rain: ["雨夹雪", "sleet"], storm: ["暴风雪", "storm"] };
const LEVEL = { easy: ["绿道", "Green"], intermediate: ["蓝道", "Blue"], advanced: ["黑道", "Black"], expert: ["双黑", "Double black"] };
const TURN = { 左转: "turn left", 右转: "turn right", 靠左: "keep left", 靠右: "keep right" };
// Three letters for each resort, for the flight label.
const CODE = { copper: "CPR", winterpark: "WPK", steamboat: "STM", abasin: "ABA", eldora: "ELD", snowmass: "SMS", aspenmountain: "ASP", highlands: "HLD", buttermilk: "BMK" };
const MAP = { S: 38.98, N: 40.72, W: -107.4, E: -104.78 }; // the painted map's bounds (src/start/collection.js)
const DEN = [39.7385, -104.9903];

const say = (k, vars = {}) => { let s = WORDS[k][EN_ON ? "en" : "zh"]; for (const [a, b] of Object.entries(vars)) s = s.split(`{${a}}`).join(b); return s; };
const line = (l) => (EN_ON ? l.en : l.zh);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ROOT = () => (location.pathname.includes("/mountain/") ? "../" : "");
const short = (name) => String(name).replace(/ Mountain$/, "");
const store = (s, k, v) => { try { if (v === undefined) return s.getItem(k); if (v === null) s.removeItem(k); else s.setItem(k, v); } catch { /* storage off */ } return null; };
const json = (s) => { try { return JSON.parse(s || "null"); } catch { return null; } };
const FORCE = () => new URLSearchParams(location.search).get("transition") === "force";
const off = () => navigator.webdriver && !FORCE(); // not in the headless tests
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// How many times each has played; seen once, it runs at this pace.
function seen(key) { const all = json(store(localStorage, "prerunTransitions")) || {}, n = all[key] || 0; all[key] = n + 1; store(localStorage, "prerunTransitions", JSON.stringify(all)); return n; }
// The page under a transition shows a plain cover until it starts (the pages' head scripts); lift it.
const uncover = () => document.documentElement.classList.remove("trans-cover");
// The page is ready when its loading note goes (or says it failed: then the transition gets out of the way).
const pageReady = () => new Promise((res) => { const t = setInterval(() => { const s = document.getElementById("status"); if (!s || /失败|fail/i.test(s.textContent)) { clearInterval(t); res(); } }, 80); });

// ---- Hand-offs from the page that navigates: which resort was chosen, which lift's ticket.
export const flyTo = (id) => store(sessionStorage, "prerunFly", id);
export const liftTicket = (ticket) => store(sessionStorage, "prerunTicket", JSON.stringify(ticket));

const CSS = `
#trans { position: fixed; inset: 0; z-index: 90; background: #dde3e9; overflow: hidden; font-family: "Noto Serif SC", serif; color: #22344d; cursor: pointer; transition: opacity .5s; -webkit-user-select: none; user-select: none; touch-action: none; }
#trans.out { opacity: 0; pointer-events: none; }
#trans .fade { transition: opacity .5s, transform .6s; }
#trans .hide, #trans .hide.on { opacity: 0 !important; }
#trans canvas.map { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
#trans .kick { position: absolute; left: 0; right: 0; top: calc(11vh + env(safe-area-inset-top)); text-align: center; text-shadow: 0 0 10px #eef2f5, 0 0 4px #eef2f5; }
#trans .kick i { display: block; font: 500 11px Oswald, sans-serif; letter-spacing: .4em; color: #6f685f; }
#trans .kick b { display: block; margin-top: 4px; font-weight: 600; font-size: 30px; letter-spacing: .2em; }
#trans .say { position: absolute; left: 28px; right: 28px; top: 27vh; text-align: center; transform: translateY(8px); text-shadow: 0 0 12px #eef2f5, 0 0 4px #eef2f5, 0 0 2px #fff; }
#trans .say.on, #trans .facts p.on, #trans .fly.on { opacity: 1; transform: none; }
#trans .say p { margin: 0; font-size: 19px; letter-spacing: .25em; line-height: 2.1; font-weight: 600; }
#trans .say small { display: block; margin-top: 2px; font: italic 500 15px "Cormorant Garamond", serif; letter-spacing: .02em; color: #6f685f; }
#trans .land { position: absolute; inset: 0; }
#trans .wc { position: absolute; inset: -3%; background: #dde3e9 center / cover no-repeat; transform: scale(1.12); transition: transform 9s cubic-bezier(.2,.7,.3,1); }
#trans .land.on .wc, #trans .drop .wc { transform: scale(1.02); }
#trans .mist { position: absolute; inset: 0; background: linear-gradient(rgba(226,232,238,.9), rgba(226,232,238,0) 20%, rgba(226,232,238,0) 46%, rgba(236,240,244,.94) 70%); }
#trans .stamp { position: absolute; left: 50%; top: 33%; width: 168px; height: 168px; margin: -84px 0 0 -84px; border: 3px solid #b6463b; border-radius: 50%; display: grid; place-content: center; text-align: center; color: #b6463b; background: rgba(253,251,246,.38); opacity: 0; transform: rotate(-9deg) scale(1.9); }
#trans .stamp::after { content: ""; position: absolute; inset: 6px; border: 1px solid rgba(182,70,59,.55); border-radius: 50%; }
#trans .stamp.on { animation: tr-stamp .32s cubic-bezier(.3,1.5,.5,1) forwards; }
#trans .stamp i { font: 600 15px Oswald, sans-serif; letter-spacing: .2em; font-style: normal; }
#trans .stamp b { font: italic 600 31px/1.15 "Cormorant Garamond", serif; margin: 2px 6px; }
#trans .stamp small { font: 600 15px Oswald, sans-serif; letter-spacing: .08em; }
@keyframes tr-stamp { from { opacity: 0; transform: rotate(-9deg) scale(1.9); } to { opacity: .93; transform: rotate(-9deg) scale(1); } }
#trans .facts { position: absolute; left: 18px; right: 18px; top: 57%; text-align: center; }
#trans .facts p { margin: 0 0 12px; font-size: 16px; font-weight: 600; letter-spacing: .16em; line-height: 1.6; opacity: 0; transform: translateY(6px); transition: opacity .5s, transform .5s; text-shadow: 0 0 10px #f2f4f6, 0 0 4px #fff; }
#trans .facts p.fr { color: #6f685f; font-style: italic; }
#trans .tip { position: absolute; left: 0; right: 0; bottom: calc(20px + env(safe-area-inset-bottom)); text-align: center; font: 500 10px Oswald, sans-serif; letter-spacing: .35em; color: #8f857a; opacity: .55; }
#trans .tip i { display: inline-block; width: 4px; height: 4px; margin: 0 3px 1px; border-radius: 50%; background: #8f857a; opacity: 0; animation: tr-dot 1.2s infinite; }
#trans .tip i:nth-child(2) { animation-delay: .2s; } #trans .tip i:nth-child(3) { animation-delay: .4s; }
#trans .tip.wait i { opacity: .2; }
@keyframes tr-dot { 50% { opacity: 1; } }
#trans .ticket { position: absolute; left: 50%; top: 20vh; width: min(320px, 84vw); margin-left: calc(min(320px, 84vw) / -2); background: #fdfbf6; border-radius: 4px; box-shadow: 0 12px 26px rgba(40,50,70,.2); overflow: hidden; transform: translateY(60vh) rotate(4deg); transition: transform .6s cubic-bezier(.2,.9,.3,1), opacity .5s; }
#trans .ticket.on { transform: rotate(-1.5deg); }
#trans .ticket.gone { transform: translateY(-75vh) rotate(-6deg); opacity: 0; transition-timing-function: cubic-bezier(.6,0,.8,.4); }
#trans .ticket.shake { animation: tr-shake .18s; }
@keyframes tr-shake { 50% { margin-top: 3px; } }
#trans .ticket .pic { height: 150px; background: #dde3e9 center / cover no-repeat; }
#trans .ticket .bd { position: relative; padding: 14px 18px 16px; }
#trans .ticket .bd i { display: block; font: 500 10px Oswald, sans-serif; letter-spacing: .25em; color: #6f685f; font-style: normal; text-transform: uppercase; padding-right: 44px; }
#trans .ticket .bd b { display: block; margin: 6px 0 4px; font-size: 26px; font-weight: 600; letter-spacing: .04em; }
#trans .ticket .bd small { font: italic 500 15px "Cormorant Garamond", serif; color: #6f685f; }
#trans .ticket .hole { position: absolute; right: 18px; top: 12px; width: 32px; height: 32px; border-radius: 50%; border: 1.5px dashed #c4bcae; box-sizing: border-box; }
#trans .ticket .hole.punched { border: 0; background: #dfe4ea; box-shadow: inset 0 2px 4px rgba(40,50,70,.3); }
#trans .chad { position: absolute; width: 30px; height: 30px; border-radius: 50%; background: #fdfbf6; box-shadow: 0 1px 2px rgba(40,50,70,.2); transition: transform .9s cubic-bezier(.4,0,.9,.6), opacity .9s; }
#trans .cap { position: absolute; left: 0; right: 0; top: 70vh; text-align: center; font-size: 18px; letter-spacing: .3em; font-weight: 600; transform: translateY(8px); }
#trans .cap.on { opacity: 1; transform: none; }
#trans .cap small { display: block; font: italic 500 15px "Cormorant Garamond", serif; letter-spacing: .02em; color: #6f685f; margin-top: 4px; }
#trans svg.chair { position: absolute; left: 0; top: 24vh; width: 100%; height: 36vh; overflow: visible; }
#trans .drop .card { position: absolute; left: 20px; right: 20px; top: 36%; padding: 20px 16px 18px; background: rgba(253,251,246,.95); border-radius: 6px; box-shadow: 0 10px 26px rgba(40,50,70,.2); text-align: center; transform: translateY(14px) scale(.96); opacity: 0; transition: transform .45s cubic-bezier(.2,.9,.3,1), opacity .35s; }
#trans .drop .card.on { transform: none; opacity: 1; }
#trans .drop .card b { font: 600 32px/1.15 "Cormorant Garamond", "Noto Serif SC", serif; }
#trans .drop .card .lv { display: inline-block; width: 16px; height: 16px; margin: 0 10px 3px 0; vertical-align: middle; }
#trans .drop .card .lv.easy { background: #22b35a; border-radius: 50%; }
#trans .drop .card .lv.intermediate { background: #1f6fe5; }
#trans .drop .card .lv.advanced, #trans .drop .card .lv.expert { background: #15171c; transform: rotate(45deg) scale(.82); }
#trans .drop .card small { display: block; margin-top: 8px; font-size: 14px; color: #5d5750; letter-spacing: .06em; line-height: 1.6; }
#trans .drop .hint { position: absolute; left: 22px; right: 22px; top: 64%; text-align: center; font-size: 17px; letter-spacing: .22em; line-height: 2; font-weight: 600; text-shadow: 0 0 10px #f2f4f6, 0 0 4px #fff; }
#trans .drop .hint small { display: block; font-size: 13px; letter-spacing: .14em; font-weight: 400; color: #6f685f; }
#trans .drop .go { position: absolute; left: 0; right: 0; bottom: calc(12vh + env(safe-area-inset-bottom)); text-align: center; font: 600 15px Oswald, sans-serif; letter-spacing: .5em; transform: translateX(-16px); }
#trans .drop .go.on { opacity: 1; transform: none; }
#trans .drop .kick i { color: #5d5750; }
#trans.still * { transition: none !important; animation: none !important; }
#trans.still .stamp { opacity: .93; transform: rotate(-9deg); }
`;

// The overlay: a root on top of the page; tap anywhere to skip. finish() fades it out and removes it.
function overlay(cls = "") {
  let st = document.getElementById("trans-css");
  if (!st) { st = document.createElement("style"); st.id = "trans-css"; st.textContent = CSS; document.head.append(st); }
  const box = document.createElement("div"); box.id = "trans"; box.className = cls; box.setAttribute("translate", "no"); // our own English, not the page translator's
  document.body.append(box);
  uncover();
  let done = false, onEnd = () => {};
  const T = {
    box, live: () => !done, ended: new Promise((r) => (onEnd = r)),
    finish(ms = 500) { if (done) return; done = true; box.style.transitionDuration = `${ms}ms`; box.classList.add("out"); onEnd(); setTimeout(() => box.remove(), ms + 50); },
  };
  box.addEventListener("click", () => T.finish(350));
  return T;
}
// A timeline: run each step at its time (scaled), unless the overlay has gone.
async function steps(T, list) {
  const t0 = performance.now();
  for (const [at, fn] of list) { const dt = at - (performance.now() - t0); if (dt > 0) await wait(dt); if (!T.live()) return; fn(); }
}
const on = (el) => el && el.classList.add("on");

// ================= Transition 1: a resort chosen → its page =================
// Called first thing on the resort page. Plays only when you came by choosing this resort (flyTo).
export async function flyIn() {
  const id = (new URLSearchParams(location.search).get("resort") || "").replace(/[^a-z0-9-]/g, "");
  const chosen = store(sessionStorage, "prerunFly"); store(sessionStorage, "prerunFly", null);
  if (off() || !id || (chosen !== id && !FORCE())) return uncover();
  const ready = pageReady();
  const [list, drives] = await Promise.all([fetch(`${ROOT()}data/resorts.json`).then((r) => r.json()).catch(() => []), fetch(`${ROOT()}data/drives.json`).then((r) => r.json()).catch(() => [])]);
  const r = list.find((x) => x.id === id);
  if (!r) return uncover();
  const F = seen("fly") ? 0.8 : 1, MIN = 3200 * F, quiet = still();
  const T = overlay(quiet ? "still" : "");
  const name = short(r.name), facts = [];
  T.box.innerHTML = `<canvas class="map"></canvas>
    <div class="kick fade"><i>DEN → ${CODE[id] || id.slice(0, 3).toUpperCase()}${miles(drives, id) ? ` · ${miles(drives, id)} MI` : ""}</i><b>${say("takeoff")}</b></div>
    <div class="say fade hide">${(() => { const l = pick(COPY.filter((c) => !c.when)); return EN_ON ? `<p>${esc(l.en)}</p>` : `<p>${esc(l.zh).replace("，", "<br>")}</p><small>${esc(l.en)}</small>`; })()}</div>
    <div class="land fade hide"><div class="wc" style="background-image:url(${ROOT()}assets/wc/${id}.jpg?v=1)"></div><div class="mist"></div>
      <div class="stamp"><i>${say("landed")}</i><b>${esc(name)}</b><small>${r.stats?.top ? `${r.stats.top.toLocaleString("en-US")} m` : ""}</small></div><div class="facts"></div></div>
    <div class="tip">${say("skip")}<br><i></i><i></i><i></i></div>`;
  const $ = (s) => T.box.querySelector(s);
  // Today's facts, each only when real: the weather (fetched now; shown if it comes in time), new snow,
  // friends on the trip who are here today, how much of this resort you've skied.
  let landed = false;
  // Lines already up stay put; one arriving late (the weather) fades in at its place.
  const show = () => {
    if (!landed) return;
    const box = $(".facts"), keep = facts.slice(0, 3);
    for (const p of [...box.children]) if (!keep.includes(p.f)) p.remove();
    keep.forEach((f, i) => { if (f.el) return; const p = document.createElement("p"); p.className = f.cls || ""; p.innerHTML = f.html; p.style.transitionDelay = `${0.15 + i * 0.2}s`; p.f = f; f.el = p;
      box.insertBefore(p, box.children[i] || null); requestAnimationFrame(() => requestAnimationFrame(() => on(p))); });
  };
  todayAt(r).then((w) => { if (!w) return; facts.unshift(...[w.sky && { html: say("weather", w.sky) }, w.snow && { html: say("snow", { where: esc(name), cm: w.snow }) }].filter(Boolean)); show(); });
  const fr = friendsAt(id); if (fr) facts.push({ html: say("friends", { names: fr }), cls: "fr" });
  const skied = json(store(localStorage, "prerunLog"))?.[id]?.stats?.touched; if (skied > 0) facts.push({ html: say("skied", { resort: esc(name), n: skied }) });
  if (!quiet) flight(T, $(".map"), r, F);
  const land = () => { landed = true; $(".kick").classList.add("hide"); $(".say").classList.add("hide"); on($(".land")); $(".land").classList.remove("hide"); show(); };
  if (quiet) land();
  await steps(T, quiet ? [] : [[1000 * F, () => $(".kick").classList.add("hide")], [1150 * F, () => { $(".say").classList.remove("hide"); on($(".say")); }],
    [2050 * F, land], [2350 * F, () => on($(".stamp"))]]);
  await Promise.race([Promise.all([ready, wait(Math.max(0, MIN - (quiet ? 0 : 2350 * F)))]), T.ended]);
  // Still loading after its time: say so, quietly, with the stamp and facts up.
  if (T.live()) { $(".tip").classList.add("wait"); await Promise.race([ready, T.ended, wait(20000)]); }
  T.finish(quiet ? 400 : 600);
}
// Miles from Denver by road (data/drives.json, the shortest way along its legs).
function miles(drives, id) {
  const dist = { denver: 0 }, todo = new Set(["denver"]);
  while (todo.size) {
    const a = [...todo].sort((x, y) => dist[x] - dist[y])[0]; todo.delete(a);
    for (const d of drives) for (const [p, q] of [[d.a, d.b], [d.b, d.a]]) if (p === a && (dist[q] ?? Infinity) > dist[a] + d.km) { dist[q] = dist[a] + d.km; todo.add(q); }
  }
  return dist[id] ? Math.round(dist[id] / 1.609) : 0;
}
// The weather where the ride asks for it (Open-Meteo: now, and snow over the last three days).
async function todayAt(r) {
  try {
    const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${r.lat.toFixed(4)}&longitude=${r.lon.toFixed(4)}&current=temperature_2m,weather_code,snowfall,cloud_cover,is_day&daily=snowfall_sum&past_days=3&forecast_days=1&timezone=auto`)).json();
    const c = w.current, code = c.weather_code;
    const kind = code >= 95 ? "storm" : [71, 73, 75, 77, 85, 86].includes(code) || c.snowfall > 0 ? "snow" : code >= 51 ? "rain" : code === 45 || code === 48 ? "fog" : code === 3 || c.cloud_cover > 80 ? "cloudy" : code === 2 || c.cloud_cover > 35 ? "partly" : c.is_day === 0 ? "night" : "clear";
    const temp = Number.isFinite(c.temperature_2m) ? `${Math.round(c.temperature_2m)}°C`.replace("-", "−") : "";
    const cm = Math.round((w.daily?.snowfall_sum || []).slice(0, 3).reduce((a, b) => a + (b || 0), 0));
    return { sky: { sky: SKY[kind][EN_ON ? 1 : 0], temp }, snow: cm >= 1 ? cm : 0 };
  } catch { return null; } // offline: no weather line
}
// Friends on a shared trip whose plan for today is this resort (not you).
function friendsAt(id) {
  const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  for (const tr of json(store(localStorage, "prerunTrips")) || []) {
    if (!tr?.shared || tr.days?.[today] !== id) continue;
    const names = (tr.people || []).filter((p) => p && !p.me && p.name).map((p) => esc(String(p.name).slice(0, 12)));
    if (names.length) return names.length > 3 ? `${names.slice(0, 3).join(EN_ON ? ", " : "、")}${EN_ON ? ` and ${names.length - 3} more` : ` 等 ${names.length} 人`}` : names.join(EN_ON ? ", " : "、");
  }
  return null;
}
// The painted map: the plane lifts off Denver, a red dashed route drawn behind it, and the view follows
// and pushes in toward the resort.
function flight(T, cv, r, F) {
  const img = new Image(); img.src = `${ROOT()}assets/wc/colorado.jpg?v=4`; // the start page's map: likely cached
  const dpr = Math.min(2, devicePixelRatio || 1), g = cv.getContext("2d");
  const size = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
  size(); addEventListener("resize", size);
  const IW = 1600, IH = 1383; // colorado.jpg
  const P = (lat, lon) => [((lon - MAP.W) / (MAP.E - MAP.W)) * IW, ((MAP.N - lat) / (MAP.N - MAP.S)) * IH];
  const a = P(...DEN), b = P(r.lat, r.lon), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const c = [(a[0] + b[0]) / 2 + ((a[1] - b[1]) / len) * len * 0.16, (a[1] + b[1]) / 2 + ((b[0] - a[0]) / len) * len * 0.16]; // a gentle arc
  const at = (u) => [(1 - u) ** 2 * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1]];
  const ease = (x) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
  const born = performance.now(); let t0 = null; const D = 1950 * F; // the flight, ms; the landing card covers the rest
  const frame = (now) => {
    if (!T.live()) return removeEventListener("resize", size);
    if (t0 === null) { if (!img.complete && now - born < 700) return requestAnimationFrame(frame); t0 = now; } // the map first (cached, mostly)
    const t = Math.min(1, (now - t0) / D), W = cv.width, H = cv.height;
    const u = 0.04 + 0.95 * ease(t), p = at(u), q = at(Math.min(1, u + 0.01)), push = ease((t - 0.4) / 0.6), follow = ease(t / 0.75);
    // the view: Denver and the plane at first, then closing on the plane, the map growing
    const s = Math.max(W / IW, H / IH) * (1 + 0.9 * push), k = 0.45 + 0.55 * follow;
    let cx = a[0] + (p[0] - a[0]) * k, cy = a[1] + (p[1] - a[1]) * k + (H / s) * 0.08 * (1 - push);
    // keep the map on screen, but let a resort near its edge come off it a little (the edge feathered)
    const mx = (W / 2 / s) * (1 - 0.25 * follow), my = (H / 2 / s) * (1 - 0.35 * follow);
    cx = Math.max(mx, Math.min(IW - mx, cx)); cy = Math.max(my, Math.min(IH - my, cy));
    const X = (x) => (x - cx) * s + W / 2, Y = (y) => (y - cy) * s + H / 2;
    g.fillStyle = "#dde3e9"; g.fillRect(0, 0, W, H);
    if (img.complete && img.naturalWidth) {
      g.drawImage(img, X(0), Y(0), IW * s, IH * s);
      const fe = 60 * dpr, edge = (x0, y0, x1, y1, rx, ry, rw, rh, inside) => { if (inside <= 0) return; g.globalAlpha = Math.min(1, inside / fe); const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, "#dde3e9"); gr.addColorStop(1, "rgba(221,227,233,0)"); g.fillStyle = gr; g.fillRect(rx, ry, rw, rh); g.globalAlpha = 1; }; // only where the map's edge has come on screen
      edge(X(0), 0, X(0) + fe, 0, X(0), 0, fe, H, X(0)); edge(X(IW), 0, X(IW) - fe, 0, X(IW) - fe, 0, fe, H, W - X(IW));
      edge(0, Y(0), 0, Y(0) + fe, 0, Y(0), W, fe, Y(0)); edge(0, Y(IH), 0, Y(IH) - fe, 0, Y(IH) - fe, W, fe, H - Y(IH));
    }
    g.fillStyle = "rgba(221,227,233,.18)"; g.fillRect(0, 0, W, H); // a frost over the paint, as the intro's pane
    // the route so far
    g.save(); g.strokeStyle = "#b6463b"; g.lineWidth = 2.2 * dpr; g.setLineDash([5 * dpr, 6 * dpr]); g.lineCap = "round"; g.beginPath();
    for (let i = 0; i <= 60; i++) { const v = (u * i) / 60, [x, y] = at(v); i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)); }
    g.stroke(); g.restore();
    // Denver: a red dot with a halo, its name
    g.fillStyle = "rgba(182,70,59,.22)"; g.beginPath(); g.arc(X(a[0]), Y(a[1]), 13 * dpr, 0, 7); g.fill();
    g.fillStyle = "#b6463b"; g.beginPath(); g.arc(X(a[0]), Y(a[1]), 6 * dpr, 0, 7); g.fill();
    g.font = `600 ${12 * dpr}px Oswald, sans-serif`; g.textBaseline = "middle"; g.letterSpacing = `${2 * dpr}px`;
    g.fillText("DENVER", X(a[0]) + 14 * dpr, Y(a[1]));
    // the resort, a navy ring that appears as we close in
    g.globalAlpha = push; g.strokeStyle = "#22344d"; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(X(b[0]), Y(b[1]), 8 * dpr, 0, 7); g.stroke(); g.globalAlpha = 1;
    // the plane, its shadow on the snow further off the higher it flies
    const alt = Math.sin(Math.PI * Math.min(1, u * 1.15)), sc = (1.25 + 0.5 * alt) * dpr, ang = Math.atan2(Y(q[1]) - Y(p[1]), X(q[0]) - X(p[0]));
    g.fillStyle = "rgba(40,50,70,.2)"; g.beginPath(); g.ellipse(X(p[0]) + 22 * alt * dpr, Y(p[1]) + 18 * alt * dpr, 14 * sc, 5 * sc, ang, 0, 7); g.fill();
    g.save(); g.translate(X(p[0]), Y(p[1])); g.rotate(ang); g.scale(sc, sc);
    g.fillStyle = "#22344d"; g.beginPath(); g.ellipse(0, 0, 16, 3.2, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(4, 0); g.lineTo(-5, -15); g.lineTo(-9, -15); g.lineTo(-4, 0); g.lineTo(-9, 15); g.lineTo(-5, 15); g.closePath(); g.fill(); // swept wings
    g.fillRect(-15, -5.5, 3.5, 11); // tail
    g.fillStyle = "#fdfbf6"; g.fillRect(-2, -0.8, 12, 1.6); g.restore();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// ================= Transition 2, part 1: the ride page loading =================
// The ticket comes from the resort page (liftTicket) for the lift in the URL.
export async function liftRide() {
  const p = new URLSearchParams(location.search), tk = json(store(sessionStorage, "prerunTicket"));
  store(sessionStorage, "prerunTicket", null);
  if (off() || !tk || tk.name !== p.get("lift")) return uncover();
  const ready = pageReady(), F = seen("lift") ? 0.65 : 1, quiet = still();
  const T = overlay(quiet ? "still" : "");
  T.box.style.background = "linear-gradient(#d6dee7, #e6ebf0)";
  const cabin = tk.kind === "gondola" || tk.kind === "cable_car", bubble = !!tk.bubble && !cabin;
  const kind = cabin ? say("cabin", { n: tk.seats }) : `${say("seats", { n: tk.seats })}${bubble ? ` · ${say("bubble")}` : ""}`;
  const l = bubble ? COPY.find((c) => c.when === "bubble") : pick(COPY.filter((c) => !c.when));
  T.box.innerHTML = `<div class="ticket"><div class="pic" style="background-image:url(assets/wc/${esc(tk.resort)}.jpg?v=1)"></div>
      <div class="bd"><i>LIFT TICKET · ${esc(tk.name)}</i><b>${kind}</b><small>${tk.km ? say("minutes", { km: tk.km, min: tk.mins }) : ""}</small><span class="hole"></span></div></div>
    <div class="cap fade hide">${say("punch")}</div>
    ${chairSvg(cabin, bubble)}
    <div class="cap fade hide c2">${EN_ON ? esc(l.en) : `${esc(l.zh).replace("，", "<br>")}<small>${esc(l.en)}</small>`}</div>
    <div class="tip">${say("skip")}<br><i></i><i></i><i></i></div>`;
  const $ = (s) => T.box.querySelector(s), tkt = $(".ticket"), chair = $(".chair .car");
  let crossing = null;
  const cross = (ms) => { // a chair across the screen along the rope, swinging a little; then the next
    const t0 = performance.now(), go = (now) => { if (!T.live()) return; const u = ((now - t0) % ms) / ms, x = -90 + 570 * u, y = 52 + (x / 390) * -22, sw = Math.sin(u * 9) * 3 * (1 - u);
      chair.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${sw.toFixed(2)})`); crossing = requestAnimationFrame(go); };
    crossing = requestAnimationFrame(go);
  };
  if (quiet) { tkt.classList.add("on"); $(".hole").classList.add("punched"); $(".cap").classList.remove("hide"); on($(".cap")); }
  await steps(T, quiet ? [] : [
    [30, () => on(tkt)],
    [900 * F, () => { // 咔哒: the hole punched out, its little disc falling away
      const h = $(".hole"), r = h.getBoundingClientRect(), chad = document.createElement("i"); chad.className = "chad";
      chad.style.left = `${r.left}px`; chad.style.top = `${r.top}px`; T.box.append(chad);
      h.classList.add("punched"); tkt.classList.add("shake");
      requestAnimationFrame(() => requestAnimationFrame(() => { chad.style.transform = `translate(30px, ${innerHeight * 0.7}px) rotate(200deg) scale(.6)`; chad.style.opacity = "0"; }));
      $(".cap").classList.remove("hide"); on($(".cap"));
    }],
    [1900 * F, () => { tkt.classList.add("gone"); $(".cap").classList.add("hide"); }],
    [2150 * F, () => { $(".chair").classList.remove("hide"); cross(2600 * F); }],
    [2450 * F, () => { $(".c2").classList.remove("hide"); on($(".c2")); }],
  ]);
  await Promise.race([Promise.all([ready, wait(quiet ? 1200 : 1500 * F)]), T.ended]);
  if (T.live()) { $(".tip").classList.add("wait"); await Promise.race([ready, T.ended, wait(30000)]); }
  T.finish(quiet ? 400 : 650);
  setTimeout(() => cancelAnimationFrame(crossing), 700);
}
// The chair (or cabin) in silhouette, hung from the rope; the rope itself across the screen.
function chairSvg(cabin, bubble) {
  const car = cabin
    ? `<line x1="0" y1="0" x2="0" y2="44" stroke="#22344d" stroke-width="5"/><rect x="-38" y="44" width="76" height="70" rx="12" fill="#22344d"/><rect x="-28" y="54" width="56" height="30" rx="5" fill="#cfdbe8"/>`
    : `${bubble ? `<path d="M-60 92 Q0 20 60 92 Z" fill="rgba(110,150,214,.32)" stroke="#6f9ad8" stroke-width="4"/>` : ""}<line x1="0" y1="0" x2="0" y2="92" stroke="#22344d" stroke-width="6"/><path d="M-44 92 H44 V124 H-44 Z" fill="none" stroke="#22344d" stroke-width="6" stroke-linejoin="round"/>`;
  return `<svg class="chair fade hide" viewBox="0 0 390 260" preserveAspectRatio="xMidYMid meet"><line x1="-200" y1="${52 + 200 * 22 / 390}" x2="590" y2="${52 - 590 * 22 / 390}" stroke="#22344d" stroke-width="2"/><g class="car" transform="translate(-90 52)"><g transform="scale(1.35)">${car}</g></g></svg>`;
}

// ================= Transition 2, part 2: at the top, the way down chosen =================
// P is the plan from topOfLift (src/ride/ride.js): its title, first run, length, where it ends, its path
// and the runs along it. Resolves as the card starts to fade, so the ride starts beneath it.
export async function dropIn(P, resort, R) {
  if (off() || !P) return;
  const F = seen("drop") ? 0.6 : 1, quiet = still();
  const run = P.first, level = run?.level || P.hardest, len = run ? run.length : P.length;
  // A run: its name, and where it ends. A place (a base, another lift): where to, and the first run on the way.
  const via = !run && P.steps?.find((x) => x.type === "run")?.name;
  const where = run ? (P.leads?.lifts?.length ? say("connects", { x: esc(P.leads.lifts[0]) }) : P.leads?.base ? say("base", { x: esc(P.leads.base) }) : "") : via ? say("via", { x: esc(via) }) : "";
  const title = run ? esc(run.name || P.title) : P.kind === "lift" && P.lift ? say("connects", { x: esc(P.lift.name) }) : P.base ? say("base", { x: esc(P.base.name) }) : esc(P.title);
  const Title = EN_ON ? title.charAt(0).toUpperCase() + title.slice(1) : title;
  const top = R && P.hs ? Math.round(P.hs[0] + (R.hmin || 0)) : 0;
  const lv = LEVEL[level] || LEVEL.intermediate;
  const facts = [EN_ON ? lv[1] : lv[0], len >= 1000 ? `${(len / 1000).toFixed(1)} ${EN_ON ? "km" : "公里"}` : `${Math.round(len)} ${EN_ON ? "m" : "米"}`, where].filter(Boolean);
  // This run new to you? Then it's your (n+1)th here (src/core/skilog.js keeps the runs by id).
  let progress = "";
  const log = json(store(localStorage, "prerunLog"))?.[resort];
  if (run?.name && log?.stats?.touched >= 0 && R) {
    const ids = new Set(R.runs.filter((x) => x.name === run.name).map((x) => String(x.id)));
    if (!Object.keys(log.runs || {}).some((k) => ids.has(k))) progress = say("progress", { resort: esc(short(R.name || resort)), n: log.stats.touched + 1 });
  }
  const way = await hint(P), T = overlay(quiet ? "still" : "");
  T.box.innerHTML = `<div class="drop"><div class="wc" style="background-image:url(assets/wc/${esc(resort)}.jpg?v=1)"></div><div class="mist"></div>
    <div class="kick"><i>${top ? say("top", { m: top.toLocaleString("en-US") }) : "DROP IN"}</i></div>
    <div class="card"><b><i class="lv ${level}"></i>${Title}</b><small>${facts.join(" · ")}</small></div>
    <div class="hint fade hide">${way}${progress ? `<small>${progress}</small>` : ""}</div>
    <div class="go fade hide">${say("go")}</div></div>`;
  const $ = (s) => T.box.querySelector(s);
  if (quiet) { on($(".card")); $(".hint").classList.remove("hide"); }
  await steps(T, quiet ? [[900, () => {}]] : [[30, () => on($(".card"))], [700 * F, () => { $(".hint").classList.remove("hide"); }],
    [1700 * F, () => { $(".go").classList.remove("hide"); on($(".go")); }], [2700 * F, () => {}]]);
  T.finish(quiet ? 350 : 450);
}
// One hint for the way, from the plan: the first change of run, and which way it turns (as the junction
// signs do, src/ride/skinav.js); else where the way ends.
async function hint(P) {
  const segs = P.segs || [], path = P.path || [];
  if (segs.length > 1 && path.length > 8) {
    const { turnWord } = await import("../ride/skinav.js?v=9");
    const dir = (i, k) => { const a = path[Math.max(0, i - k)], b = path[Math.min(path.length - 1, i + k)]; return Math.atan2(b[0] - a[0], b[1] - a[1]); };
    const s = segs[1], d = dir(s.at + 4, 3) - dir(Math.max(0, s.at - 4), 3), w = turnWord(Math.atan2(Math.sin(d), Math.cos(d)));
    const name = esc(s.run.name || "");
    if (name) return w === "直行" ? say("onto", { run: name }) : say("turn", { run: name, turn: EN_ON ? TURN[w] : w });
  }
  if (P.leads?.lifts?.length) return say("toLift", { lift: esc(P.leads.lifts[0]) });
  if (P.leads?.base || P.base) return say("toBase", { base: esc(P.leads?.base || P.base.name) });
  return say("down");
}
