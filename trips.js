// Trips, as a quiet watercolour page: the boarding passes to Denver (one per city people fly from, a deck
// held by a paperclip: swipe up or down to deal the next), a lift ticket for each mountain you might ski
// (its painting grey until the forecast is out, then split into one panel per day in that day's weather),
// the dates, the crew. Tap a mountain for its guide. Kept on this phone; shared as a link that carries
// the whole trip, so a friend opening it sees the same plan and can keep it.
import { t, EN_ON, myAvatar } from "./i18n.js?v=19";
import { daysOf } from "./roadbook.js?v=11";

const KEY = "prerunTrips";
const PASSES = { ikon: "Ikon", epic: "Epic", day: "日票", none: "还没买" };
// Which resorts each pass opens here. All nine built so far are Ikon resorts; Epic's aren't built yet.
const OPENS = { ikon: () => true, epic: () => false, day: () => true, none: () => true };
const C = { ink: "#22344d", pine: "#2f5446", wine: "#6e2f36", red: "#b6463b", card: "#fdfbf6", paper: "#f6f1e7", line: "#e6dccb", mute: "#8a8278" };
// Each mountain in a line, three words for its card, and the drive from Denver (hours).
const ABOUT = {
  copper: { zh: "地形天然按难度分开：西边简单、中间中级、东边难，不太会误入难道。", en: "The terrain sorts itself by level: easy to the west, blue in the middle, hard to the east.", words: "Sorted by Level · Union Creek · Copper Bowl", drive: 1.5 },
  winterpark: { zh: "两座山连在一起：Winter Park 的长蓝道，和 Mary Jane 出名的猫跳。", en: "Two mountains in one: long groomers, and Mary Jane's famous bumps.", words: "Mary Jane · Bumps · Long Groomers", drive: 1.5 },
  steamboat: { zh: "以“香槟粉雪”和树林道出名，山脚是有温泉的牧场小镇。", en: "Known for 'Champagne Powder' and tree skiing; a ranch town with hot springs below.", words: "Champagne Powder · Trees · Hot Springs", drive: 3 },
  abasin: { zh: "海拔高、雪季长，常常是科罗拉多最早开、最晚关的雪场。", en: "High and long-seasoned: often the first to open and the last to close in Colorado.", words: "High Alpine · Pallavicini · Long Season", drive: 1.5 },
  eldora: { zh: "离 Boulder 最近，小而方便，一天来回。", en: "Closest to Boulder: small and easy, a day trip.", words: "Close to Boulder · Small · Easy Day", drive: 1 },
  snowmass: { zh: "Aspen 四座山里最大的，长长的巡航蓝道，适合大多数人。", en: "The biggest of Aspen's four: long cruisers for almost everyone.", words: "Big Mountain · Long Cruisers · Village", drive: 4 },
  aspenmountain: { zh: "就在 Aspen 镇上，没有绿道，中级和以上。", en: "Right above Aspen town: no greens, intermediate and up.", words: "Town Lift · No Greens · Ajax", drive: 4 },
  highlands: { zh: "以 Highland Bowl 出名，要徒步上去的高山大碗。", en: "Home of Highland Bowl, a hike-to alpine bowl.", words: "Highland Bowl · Hike-to · Steeps", drive: 4 },
  buttermilk: { zh: "缓、宽，适合初学，也是 X Games 的场地。", en: "Gentle and wide for learning, and home of the X Games.", words: "Gentle · Learn Here · X Games", drive: 4 },
};
const CITY = { SFO: "San Francisco", LAX: "Los Angeles", SEA: "Seattle", JFK: "New York", EWR: "Newark", LGA: "New York", BOS: "Boston", ORD: "Chicago", IAH: "Houston", DFW: "Dallas", ATL: "Atlanta", MIA: "Miami", SAN: "San Diego", PDX: "Portland", SJC: "San Jose", OAK: "Oakland", PHX: "Phoenix", SLC: "Salt Lake City", MSP: "Minneapolis", DCA: "Washington", IAD: "Washington", AUS: "Austin", YVR: "Vancouver", YYZ: "Toronto", PEK: "Beijing", PVG: "Shanghai", SHA: "Shanghai", CAN: "Guangzhou", SZX: "Shenzhen", HKG: "Hong Kong", TPE: "Taipei", NRT: "Tokyo", HND: "Tokyo", ICN: "Seoul", LHR: "London", DEN: "Denver" };
const BANDS = [C.ink, C.pine, C.wine];
// What to carry for a hike-to (from guides to Highland Bowl and the like).
export const GEAR = { zh: ["能挂板的背包（25–30 升）或板带", "水，比你觉得的多带一些", "能量棒", "多一件保暖中间层", "备用手套", "雪镜和墨镜", "防晒", "手机充满电"], en: ["A pack that carries a board (25–30 L), or straps", "Water — more than you think", "Snacks", "A warm mid layer", "Spare gloves", "Goggles and sunglasses", "Sunscreen", "A charged phone"] };
let HIKES = null;
const hikesOf = async (id) => { if (!HIKES) HIKES = await fetch("data/hikes.json").then((x) => x.json()).catch(() => ({})); return HIKES[id] || []; };
// Airports people fly to Denver from, to find the nearest one to where you are.
export const AIRPORTS = { SFO: [37.62, -122.38], OAK: [37.72, -122.22], SJC: [37.36, -121.93], LAX: [33.94, -118.41], SAN: [32.73, -117.19], SEA: [47.45, -122.31], PDX: [45.59, -122.6], PHX: [33.43, -112.01], SLC: [40.79, -111.98], DEN: [39.86, -104.67], DFW: [32.9, -97.04], IAH: [29.99, -95.34], AUS: [30.19, -97.67], ORD: [41.98, -87.9], MSP: [44.88, -93.22], ATL: [33.64, -84.43], MIA: [25.79, -80.29], BOS: [42.36, -71.01], JFK: [40.64, -73.78], EWR: [40.69, -74.17], IAD: [38.95, -77.46], DCA: [38.85, -77.04], YVR: [49.19, -123.18], YYZ: [43.68, -79.63], PEK: [40.08, 116.6], PVG: [31.14, 121.81], CAN: [23.39, 113.3], SZX: [22.64, 113.81], HKG: [22.31, 113.91], TPE: [25.08, 121.23], NRT: [35.77, 140.39], HND: [35.55, 139.78], ICN: [37.46, 126.44], LHR: [51.47, -0.45] };
const nearestAirport = (lat, lon) => {
  let best = null, bd = Infinity;
  for (const [code, [a, b]] of Object.entries(AIRPORTS)) { const d = (a - lat) ** 2 + ((b - lon) * Math.cos((lat * Math.PI) / 180)) ** 2; if (d < bd) { bd = d; best = code; } }
  return best;
};

const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]").map(norm); } catch { return []; } };
const save = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* full */ } };
// Older trips had one pass, people as names and a resort per day.
function norm(t0) {
  const tr = { ...t0 };
  tr.passes = tr.passes || [tr.pass || "ikon"];
  tr.people = (tr.people || []).map((p) => (typeof p === "string" ? { name: p, from: "" } : p));
  tr.maybe = tr.maybe || [...new Set((tr.days || []).map((d) => d.resort).filter(Boolean))];
  delete tr.pass; delete tr.days;
  return tr;
}
const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
const day0 = (d) => new Date(d + "T00:00:00");
const plus = (d, n) => { const x = day0(d); x.setDate(x.getDate() + n); return ymd(x); };
const between = (a, b) => Math.round((day0(b) - day0(a)) / 86400000);
const today = () => ymd(new Date());
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WK = EN_ON ? ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] : ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const fmt = (d) => { const x = day0(d); return EN_ON ? `${MON[x.getMonth()]} ${x.getDate()}` : `${x.getMonth() + 1} 月 ${x.getDate()} 日`; };
const short = (d) => { const x = day0(d); return `${x.getDate()} ${MON[x.getMonth()].toUpperCase()}`; };

// The weather on the trip's days at a resort, from Open-Meteo (about 16 days ahead). Cached for the visit.
const WXC = new Map();
async function forecast(r, from, to) {
  const key = `${r.id}:${from}:${to}`;
  if (WXC.has(key)) return WXC.get(key);
  const now = today(), last = plus(now, 15), end = to < last ? to : last;
  let out = null;
  if (from <= last && to >= now) {
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${r.lat}&longitude=${r.lon}&daily=weather_code,snowfall_sum,temperature_2m_max,temperature_2m_min&timezone=America%2FDenver&start_date=${from < now ? now : from}&end_date=${end}`;
      const j = await (await fetch(u)).json();
      out = Object.fromEntries(j.daily.time.map((d, i) => [d, { code: j.daily.weather_code[i], cm: j.daily.snowfall_sum[i] || 0, hi: j.daily.temperature_2m_max[i], lo: j.daily.temperature_2m_min[i] }]));
    } catch { out = null; }
  }
  WXC.set(key, out);
  return out;
}
const kindOf = (w) => (!w ? null : w.cm >= 0.5 || [71, 73, 75, 77, 85, 86].includes(w.code) ? "snow" : w.code <= 1 ? "sun" : "cloud");
const WX = {
  snow: { icon: "🌨", word: (w) => (w.cm >= 1 ? `${Math.round(w.cm)} cm` : t("小雪")), over: '<i class="snowfall"></i>', filter: "saturate(.8) brightness(.97)" },
  sun: { icon: "☀", word: () => t("晴"), over: '<i class="sky"></i><i class="glint"></i>', filter: "saturate(1.7) contrast(1.06) brightness(1.06)" },
  cloud: { icon: "☁", word: () => t("阴"), over: '<i class="fog"></i>', filter: "saturate(.45) brightness(1.05)" },
};

// The owner's painted icons (assets/icons/README.md): the day's weather, the stamps, the crew's faces.
const ICON = (n, cls = "ic") => `<img class="${cls}" src="assets/icons/${n}.png?v=1" alt="">`;
const wxIcon = (w) => {
  if (!w) return null; const c = w.code;
  if (w.cm >= 0.5 || [71, 73, 75, 77, 85, 86].includes(c)) return w.cm >= 10 || c === 75 || c === 86 ? "heavysnow" : c <= 2 ? "snowsun" : w.cm < 2 || c === 71 || c === 85 ? "lightsnow" : "snow";
  return c === 0 ? "sunny" : c <= 2 ? "partly" : c === 45 || c === 48 ? "fog" : "cloudy";
};
const SEC = (icon, text) => `<div class="sec">${ICON(icon, "si")}${text}</div>`; // a section heading with its painted icon
// Where a trip stands, as the owner's stamps: coming up, under way, done.
const status = (tr, now) => (tr.to < now ? "st_done" : tr.from <= now ? "st_ontrip" : "st_booked");
const WXWORD = { sunny: ["晴", "Sunny"], partly: ["少云", "Partly cloudy"], cloudy: ["多云", "Cloudy"], fog: ["雾", "Fog"], lightsnow: ["小雪", "Light snow"], snow: ["降雪", "Snow"], heavysnow: ["大雪", "Heavy snow"], snowsun: ["晴雪", "Snow & sun"] };
const wxWord = (w) => WXWORD[wxIcon(w)][EN_ON ? 1 : 0];
const CREW = ["av_rider", "av_fox", "av_hare", "av_marmot", "av_elk", "av_bear", "av_girl"]; // me first, then friends round the animals

const SERIF = `"Cormorant Garamond", "Noto Serif SC", serif`;
const CSS = `
.pl { color: #33302c; font-family: "Noto Serif SC", serif; }
.pl .kicker { font-family: Oswald, sans-serif; font-size: 10px; letter-spacing: .25em; color: ${C.mute}; }
.pl .h1 { font-family: ${SERIF}; font-weight: 600; font-size: 34px; line-height: 1.05; color: ${C.ink}; margin: 4px 0 2px; }
.pl .lead { font-family: ${SERIF}; font-size: 16px; color: ${C.mute}; }
.pl .lead i { font-style: normal; color: #c3b59d; margin: 0 6px; }
.pl .sec { display: flex; align-items: center; gap: 10px; margin: 22px 0 8px; font-family: ${SERIF}; font-size: 18px; color: #6f675e; letter-spacing: .06em; }
.pl .sec .si { width: 26px; height: 26px; margin: -4px -2px -4px 0; }
.pl .tstamp { position: absolute; width: 64px; height: 64px; right: 4px; top: -16px; transform: rotate(10deg); pointer-events: none; filter: drop-shadow(0 3px 4px rgba(90,70,40,.2)); z-index: 2; }
.pl .tstamp.big { width: 84px; height: 84px; right: 0; top: 0; }
.pl .sec::after { content: ""; flex: 1; height: 1px; background: #d9cdb9; }
.pl .back { font-family: ${SERIF}; font-size: 16px; color: ${C.mute}; background: none; border: 0; padding: 0; margin-bottom: 8px; cursor: pointer; }
.pl button { cursor: pointer; }
.pl .pill { font-family: ${SERIF}; font-weight: 600; font-size: 14px; color: #fffdf8; background: ${C.ink}; border: 0; border-radius: 999px; padding: 2px 10px; white-space: nowrap; }
.pl .ghostbtn { font-family: ${SERIF}; font-size: 16px; color: ${C.ink}; background: ${C.card}; border: 1px solid #cbbfa9; border-radius: 999px; padding: 7px 16px; }
.pl .acts { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 22px; } .pl .acts .main { flex: 1; color: #fffdf8; background: ${C.ink}; border-color: ${C.ink}; }
.pl .note { font-family: ${SERIF}; font-size: 14px; color: ${C.mute}; margin: 8px 2px; }
/* Boarding passes */
.pl .deck { position: relative; margin: 26px 0 0; touch-action: pan-x; user-select: none; -webkit-user-select: none; }
.pl .bp { position: absolute; left: 0; right: 0; top: 0; display: flex; height: 128px; background: ${C.card}; border-radius: 7px; box-shadow: 0 1px 0 rgba(0,0,0,.06), 0 6px 14px rgba(40,30,20,.18); overflow: hidden; font-family: Oswald, sans-serif; color: #23272e; transition: transform .45s cubic-bezier(.3,.7,.3,1), opacity .3s; text-align: left; }
.pl .bp .band { height: 22px; color: #f6f1e7; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 0 10px; font-size: 10px; letter-spacing: .12em; font-weight: 500; white-space: nowrap; overflow: hidden; }
.pl .bp .lab { font-size: 7px; letter-spacing: .2em; color: #9a9188; }
.pl .bp .code { font-size: 27px; font-weight: 600; line-height: 1; }
.pl .bp .city { font-family: "Cormorant Garamond", serif; font-size: 11px; color: ${C.mute}; white-space: nowrap; }
.pl .bp .grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr 1fr; border-top: 1px solid ${C.line}; padding-top: 3px; }
.pl .bp .grid b { display: block; font-weight: 500; font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pl .bp .bars { height: 14px; margin-top: 3px; opacity: .85; background: repeating-linear-gradient(90deg, #2b2f36 0 1px, transparent 1px 3px, #2b2f36 3px 5px, transparent 5px 6px, #2b2f36 6px 7px, transparent 7px 10px, #2b2f36 10px 11px, transparent 11px 12px); }
.pl .bp .stub { position: relative; width: 62px; flex: none; border-left: 1.5px dashed #d6cbb8; display: flex; flex-direction: column; }
.pl .bp .stub::before, .pl .bp .stub::after { content: ""; position: absolute; left: -8px; width: 14px; height: 14px; border-radius: 50%; background: ${C.paper}; }
.pl .bp .stub::before { top: -7px; } .pl .bp .stub::after { bottom: -7px; }
.pl .bp .setfrom { color: ${C.red}; text-decoration: underline dotted; cursor: pointer; }
.pl .clip { position: absolute; left: 46%; top: -24px; width: 30px; height: 84px; z-index: 20; filter: drop-shadow(1px 2px 1.5px rgba(0,0,0,.28)); pointer-events: none; }
.pl .dealhint { text-align: center; font-family: ${SERIF}; font-size: 13px; color: ${C.mute}; margin-top: 8px; min-height: 4px; }
/* Lift tickets */
.pl .lt { position: relative; margin: 16px 2px 0; cursor: pointer; }
.pl .lt .tk { position: relative; display: flex; min-height: 104px; background: ${C.card}; box-shadow: 0 1px 0 rgba(0,0,0,.04), 0 6px 14px rgba(90,70,40,.14); }
.pl .lt .art { position: relative; width: 150px; flex: none; margin: 8px 0 8px 8px; display: flex; flex-direction: column; }
.pl .lt .pic { position: relative; flex: 1; min-height: 72px; overflow: hidden; display: flex; gap: 3px; }
.pl .lt .pan { position: relative; flex: 1; overflow: hidden; }
.pl .lt .pan > b { position: absolute; top: 0; bottom: 0; background-size: cover; background-position: center; }
.pl .lt .wish { position: absolute; left: 0; right: 0; bottom: 2px; text-align: center; font-family: "Cormorant Garamond", serif; font-style: italic; font-size: 11px; color: #6f6a63; background: rgba(253,251,246,.78); }
.pl .lt .days { display: flex; gap: 3px; margin-top: 3px; }
.pl .lt .days div { flex: 1; text-align: center; line-height: 1.1; min-width: 0; }
.pl .lt .days small { display: block; font-family: Oswald, sans-serif; font-size: 8px; letter-spacing: .1em; color: #9a9188; }
.pl .lt .days span { font-family: "Cormorant Garamond", serif; font-size: 11px; font-weight: 600; color: #5b554e; white-space: nowrap; display: grid; justify-items: center; line-height: 1; }
.pl .lt .days span .ic { width: 22px; height: 22px; }
.pl .lt .days .best span { color: ${C.red}; }
.pl .lt .powder { position: absolute; top: -9px; font-family: ${SERIF}; font-size: 11px; font-weight: 600; color: #fffdf8; background: ${C.red}; padding: 0 6px; border-radius: 8px; transform: rotate(-6deg); z-index: 3; white-space: nowrap; }
.pl .lt .txt { flex: 1; min-width: 0; padding: 10px 8px 8px 12px; display: flex; flex-direction: column; justify-content: space-between; }
.pl .lt .txt .k { font-family: Oswald, sans-serif; font-size: 7.5px; letter-spacing: .25em; color: #a0968b; }
.pl .lt .txt .n { font-family: "Cormorant Garamond", serif; font-weight: 600; font-size: 22px; line-height: 1.05; color: ${C.ink}; margin-top: 2px; }
.pl .lt .txt .w { font-family: "Cormorant Garamond", serif; font-style: italic; font-size: 12.5px; line-height: 1.25; color: ${C.mute}; }
.pl .lt .stub { position: relative; width: 64px; flex: none; border-left: 1.5px dashed #dccfb9; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding: 0 0 10px; }
.pl .lt .stub::before { content: ""; position: absolute; top: 10px; width: 10px; height: 10px; border-radius: 50%; background: ${C.paper}; box-shadow: inset 1px 1px 2px rgba(0,0,0,.25); }
.pl .stamp { position: absolute; right: 26px; top: -14px; width: 64px; height: 64px; pointer-events: none; filter: drop-shadow(0 3px 4px rgba(90,70,40,.22)); transform: rotate(-8deg); }
.pl .stamp img { width: 100%; height: 100%; display: block; } .pl .stamp.ghost { filter: none; opacity: .8; }
.pl .stamp b { position: absolute; right: -4px; bottom: 0; font: 600 13px "Cormorant Garamond", serif; color: ${C.red}; background: #fbf7ef; border-radius: 999px; padding: 0 5px; }
.pl .snowfall { position: absolute; left: 0; right: 0; top: -20px; bottom: 0; background-image: radial-gradient(circle, #fff 1.2px, transparent 1.8px), radial-gradient(circle, rgba(255,255,255,.85) .9px, transparent 1.4px); background-size: 14px 16px, 9px 11px; background-position: 0 0, 5px 7px; animation: plfall 3s linear infinite; }
@keyframes plfall { to { transform: translateY(20px); } }
.pl .fog { position: absolute; left: -40%; right: -40%; top: 25%; height: 45%; background: linear-gradient(90deg, transparent, rgba(250,250,248,.75) 30%, rgba(250,250,248,.35) 55%, transparent 80%); filter: blur(4px); animation: pldrift 9s ease-in-out infinite alternate; }
@keyframes pldrift { from { transform: translateX(-12%); } to { transform: translateX(12%); } }
.pl .sky { position: absolute; inset: 0; background: linear-gradient(rgba(96,150,205,.55), rgba(96,150,205,0) 45%), linear-gradient(transparent 55%, rgba(240,190,120,.28)); mix-blend-mode: multiply; }
.pl .glint { position: absolute; right: 8%; top: 8%; width: 22px; height: 22px; border-radius: 50%; background: radial-gradient(circle, rgba(255,246,220,.95), rgba(255,236,190,0) 70%); animation: plglint 3.5s ease-in-out infinite; }
@keyframes plglint { 50% { transform: scale(1.35); opacity: .7; } }
/* Calendar */
.pl .cal { background: ${C.card}; padding: 10px 14px 8px; box-shadow: 0 6px 14px rgba(90,70,40,.12); }
.pl .cal .top { display: flex; justify-content: space-between; align-items: baseline; font-family: ${SERIF}; }
.pl .cal .top b { font-size: 17px; } .pl .cal .top button { background: none; border: 0; color: ${C.mute}; font: inherit; font-size: 15px; }
.pl .cal .g { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; margin-top: 4px; }
.pl .cal .g .wd { font-family: Oswald, "Noto Serif SC", sans-serif; font-size: 9px; letter-spacing: .2em; color: #a0968b; }
.pl .cal .g .d { position: relative; font-family: "Cormorant Garamond", serif; font-size: 18px; line-height: 32px; color: ${C.mute}; border: 0; background: none; padding: 0; }
.pl .cal .g .d.in { color: #33302c; font-weight: 600; }
.pl .cal .g .d.in::before { content: ""; position: absolute; left: 0; right: 0; top: 5px; bottom: 5px; background: #b9cad8; opacity: .7; }
.pl .cal .g .d.a::before { border-radius: 14px 0 0 14px; left: 3px; } .pl .cal .g .d.z::before { border-radius: 0 14px 14px 0; right: 3px; } .pl .cal .g .d.a.z::before { border-radius: 14px; }
.pl .cal .g .d span { position: relative; } .pl .cal .g .d.x { visibility: hidden; }
.pl .cal .g .d.today span { text-decoration: underline ${C.red}; }
/* Crew */
.pl .crew { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
.pl .crew .p { text-align: center; width: 54px; font-size: 12px; }
.pl .crew .face img { width: 100%; height: 100%; border-radius: 50%; display: block; }
.pl .crew .face { width: 56px; height: 56px; overflow: hidden; border-radius: 50%; background: #e6ebee center/cover no-repeat; border: 3px solid #fffdf8; box-shadow: 0 3px 6px rgba(90,70,40,.18); display: grid; place-items: center; font-size: 24px; margin: 0 auto 3px; }
.pl .crew small { display: block; font-family: "Cormorant Garamond", serif; font-size: 11px; color: ${C.mute}; }
.pl .crew .add { width: 50px; height: 50px; border-radius: 50%; border: 1.5px dashed #c7bba7; background: none; color: ${C.mute}; font-size: 20px; margin-bottom: 3px; }
/* List */
.pl .new { width: 100%; text-align: left; padding: 14px 16px; margin-top: 16px; background: ${C.card}; border: 1px dashed #c7bba7; color: ${C.ink}; font-family: ${SERIF}; font-size: 20px; }
.pl .new small { display: block; font-size: 13px; color: ${C.mute}; }
.pl .triprow { position: relative; margin-top: 18px; cursor: pointer; }
.pl .triprow .bp { position: relative; }
.pl .triprow .count { position: absolute; left: 34%; top: 54px; font-family: ${SERIF}; font-size: 14px; color: ${C.red}; border: 1px solid ${C.red}; border-radius: 999px; padding: 0 8px; transform: rotate(-4deg); background: ${C.card}; }
/* Form */
.pl .chips { display: flex; gap: 8px; flex-wrap: wrap; }
.pl .chip { font-family: ${SERIF}; font-size: 16px; font-weight: 600; color: ${C.ink}; background: ${C.card}; border: 1px solid #cbbfa9; border-radius: 6px; padding: 8px 14px; box-shadow: 0 3px 6px rgba(90,70,40,.1); }
.pl .chip.on { background: ${C.ink}; border-color: ${C.ink}; color: #fffdf8; }
.pl .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pl .tile { position: relative; height: 74px; background: center/cover; border: 4px solid ${C.card}; box-shadow: 0 4px 8px rgba(90,70,40,.16); padding: 0; text-align: left; }
.pl .tile span { position: absolute; left: 6px; bottom: 4px; font-family: "Cormorant Garamond", serif; font-weight: 600; font-size: 15px; color: ${C.ink}; background: rgba(253,251,246,.85); padding: 0 6px; }
.pl .tile.off { filter: grayscale(1) opacity(.5); }
.pl .tile.on::after { content: "✓"; position: absolute; right: 5px; top: 4px; width: 20px; height: 20px; border-radius: 50%; background: ${C.red}; color: #fff; font-size: 12px; line-height: 20px; text-align: center; }
.pl .tile.no { filter: grayscale(1) opacity(.25); cursor: default; }
.pl .field { width: 100%; font: inherit; font-size: 16px; color: #33302c; background: ${C.card}; border: 1px solid #cbbfa9; border-radius: 6px; padding: 9px 10px; }
/* Resort guide */
.plsheet { position: fixed; inset: 0; z-index: 40; background: rgba(40,34,28,.35); display: flex; align-items: flex-end; }
.plsheet .s { position: relative; width: 100%; max-height: 88%; overflow-y: auto; background: ${C.card}; border-radius: 16px 16px 0 0; box-shadow: 0 -6px 20px rgba(40,25,10,.3); padding-bottom: calc(20px + env(safe-area-inset-bottom)); }
.plsheet .hero { position: relative; height: 180px; background: center/cover; }
.plsheet .hero .t { position: absolute; left: 14px; bottom: 12px; background: rgba(253,251,246,.88); padding: 4px 10px; }
.plsheet .x { position: absolute; right: 12px; top: 12px; width: 34px; height: 34px; border-radius: 50%; border: 0; background: rgba(253,251,246,.92); font-size: 18px; z-index: 2; }
.plsheet .b { padding: 12px 16px; }
.plsheet .quote { font-family: ${SERIF}; font-size: 18px; line-height: 1.45; color: #4a453f; }
.plsheet .wx { display: grid; grid-template-columns: repeat(auto-fit, minmax(78px, 1fr)); gap: 8px; }
.plsheet .wx div { background: #f2f4f5; border-radius: 6px; padding: 6px; text-align: center; font-family: ${SERIF}; font-size: 14px; }
.pl .ni { width: 24px; height: 24px; display: block; } .pl .ni.inl { display: inline-block; vertical-align: -6px; } .plsheet .nums .ni { margin: 0 0 2px; }
.plsheet .wx b { display: block; font-size: 22px; } .plsheet .wx b .ic { width: 40px; height: 40px; } .plsheet .wx small { display: block; color: ${C.mute}; font-size: 12px; }
.plsheet .bar { display: flex; height: 12px; border-radius: 3px; overflow: hidden; }
.plsheet .legend { display: flex; justify-content: space-between; font-size: 12px; margin-top: 4px; color: #5b554e; }
.plsheet .nums { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 10px; }
.plsheet .nums div { border-bottom: 1px dashed #d9cdb9; padding-bottom: 3px; } .plsheet .nums small { display: block; font-size: 12px; color: ${C.mute}; } .plsheet .nums b { font-family: "Cormorant Garamond", serif; font-size: 19px; }
.plsheet .wish { border: 1.5px dashed #9fb6c8; border-radius: 10px; padding: 12px; text-align: center; font-family: "Cormorant Garamond", serif; font-size: 24px; color: #3f5f7a; }
.plsheet .wish small { display: block; font-family: "Noto Serif SC", serif; font-size: 13px; color: ${C.mute}; margin-top: 4px; }
`;
let styled = false;
const style = () => { if (styled) return; styled = true; const s = document.createElement("style"); s.textContent = CSS; document.head.append(s); };
const stamp = (runs) => `<div class="stamp">${ICON("st_prerun", "")}<b>×${runs}</b></div>`;
const ghost = () => `<div class="stamp ghost">${ICON("st_notyet", "")}</div>`;
const clipSvg = `<svg class="clip" viewBox="0 0 40 110"><defs><linearGradient id="plsteel" x1="0" x2="1"><stop offset="0" stop-color="#8d949c"/><stop offset=".45" stop-color="#e9edf1"/><stop offset="1" stop-color="#7c838b"/></linearGradient></defs><path d="M12 96 V18 a8 8 0 0 1 16 0 V86 a12 12 0 0 1 -24 0 V28" fill="none" stroke="url(#plsteel)" stroke-width="3.6" stroke-linecap="round"/></svg>`;
const paintUrl = (id) => `assets/wc/${id}.jpg?v=1`;

export class Trips {
  constructor(box, resorts, { me = "我", go, sprite = null }) {
    this.box = box; this.resorts = resorts; this.me = me; this.go = go; this.sprite = sprite;
    this.byId = Object.fromEntries(resorts.map((r) => [r.id, r]));
    box.classList.add("pl"); style();
  }
  get list() { return load(); }
  name(id) { return this.byId[id]?.name.replace(/ Mountain$| Basin$/, "") || id; }
  // The resorts a trip's passes open (the ones built so far).
  opened(passes) { return this.resorts.filter((r) => passes.some((p) => (OPENS[p] || OPENS.none)(r.id))); }
  maybeOf(tr) { return tr.maybe.length ? tr.maybe.filter((id) => this.byId[id]) : this.opened(tr.passes).map((r) => r.id); }

  // A trip that came in a link (?trip=...): only what a trip can hold, since it comes from anyone.
  incoming(code) {
    try {
      const x = JSON.parse(unb64(code)), str = (v, n) => String(v ?? "").slice(0, n);
      if (!DATE.test(x.from) || !DATE.test(x.to)) return false;
      const n = norm(x);
      this.shared = { name: str(n.name, 30) || "Ski trip", from: x.from, to: x.to < x.from ? x.from : x.to > plus(x.from, 13) ? plus(x.from, 13) : x.to,
        passes: (Array.isArray(n.passes) ? n.passes : []).filter((p) => p in PASSES).slice(0, 4), maybe: (Array.isArray(n.maybe) ? n.maybe : []).filter((id) => this.byId[id]),
        people: (Array.isArray(n.people) ? n.people : []).slice(0, 20).map((p) => ({ name: str(p?.name, 20), from: /^[A-Z]{3}$/.test(p?.from) ? p.from : "" })), notes: str(n.notes, 80) };
      if (!this.shared.passes.length) this.shared.passes = ["ikon"];
      return true;
    } catch { return false; }
  }
  link(tr) { return `${location.origin}${location.pathname.replace(/[^/]*$/, "")}start.html?trip=${b64(JSON.stringify({ ...tr, id: undefined }))}`; }

  // ---- The boarding passes: one per city people fly from.
  groups(tr) {
    const by = new Map();
    for (const p of tr.people.length ? tr.people : [{ name: this.me, from: "" }]) { const k = p.from || "?"; if (!by.has(k)) by.set(k, []); by.get(k).push(p.name); }
    return [...by].map(([from, names]) => ({ from, names }));
  }
  pass(tr, g, k, n) {
    const band = BANDS[k % 3], seat = g.names.length > 1 ? `14A–${String.fromCharCode(64 + Math.min(6, g.names.length))}` : "22C";
    const names = esc(g.names.map((x) => (x === this.me && EN_ON ? t("我") : x)).join(" · "));
    const unknown = g.from === "?", pass = tr.passes.map((p) => ({ ikon: "IKON", epic: "EPIC", day: "DAY" })[p] || "—").join("/");
    return `<div style="flex:1;min-width:0;display:flex;flex-direction:column">
        <div class="band" style="background:${band}"><span>✈ PRE-RUN AIR</span><span>${unknown ? "" : `${g.from} → `}DEN · ${names}</span></div>
        <div style="flex:1;padding:5px 10px 6px;display:flex;flex-direction:column;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:6px">
            <div><div class="code">${unknown ? "???" : g.from}</div><div class="city">${unknown ? t("在「改一改」里填从哪飞") : esc(CITY[g.from] || "")}</div></div>
            <div style="flex:1;display:flex;align-items:center;margin-bottom:12px;color:${band}"><i style="flex:1;border-top:1px dashed #b9b0a3"></i><span style="font-size:12px;margin:0 3px">✈</span><i style="flex:1;border-top:1px dashed #b9b0a3"></i></div>
            <div style="text-align:right"><div class="code" style="color:${C.red}">DEN</div><div class="city">Denver</div></div></div>
          <div class="grid">${[["PASSENGER", names], ["FLIGHT", `PR ${1118 + k * 7}`], ["DATE", short(tr.from)], ["SEAT", seat], ["PASS", pass]].map(([a, v]) => `<div><div class="lab">${a}</div><b>${v}</b></div>`).join("")}</div>
          <div class="bars"></div></div></div>
      <div class="stub"><div style="height:22px;background:${band};color:#f6f1e7;font-size:9px;line-height:22px;letter-spacing:.14em;text-align:center">${g.names.length} PAX</div>
        <div style="padding:6px 8px"><div class="lab">TO</div><div style="font-weight:600;font-size:15px">DEN</div><div class="lab">SEAT</div><div style="font-weight:500;font-size:12px">${seat}</div><div style="font-size:8px;color:#9a9188;margin-top:4px">${k + 1} / ${n}</div></div></div>`;
  }
  // The passes as a deck under one paperclip, the others' bands peeking above; a swipe deals the next.
  deck(tr, el) {
    const groups = this.groups(tr), n = groups.length, gap = 18;
    let order = groups.map((_, k) => k);
    el.style.height = `${128 + (n - 1) * gap + 4}px`;
    el.innerHTML = clipSvg + groups.map((g, k) => `<div class="bp" data-k="${k}">${this.pass(tr, g, k, n)}</div>`).join("");
    const cards = [...el.querySelectorAll(".bp")];
    const lay = () => order.forEach((k, pos) => { const c = cards[k]; c.style.zIndex = 10 - pos; c.style.left = `${pos * 4}px`; c.style.right = `${pos * 4}px`; c.style.transform = `translateY(${(n - 1 - pos) * gap}px) rotate(${[-0.8, 1.1, -0.5][pos % 3]}deg)`; });
    lay();
    if (n > 1) {
      let y0 = null;
      el.onpointerdown = (e) => { y0 = e.clientY; };
      el.onpointerup = (e) => {
        if (y0 == null) return; const dy = e.clientY - y0; y0 = null;
        if (Math.abs(dy) < 24) return;
        const top = cards[order[0]];
        top.style.transform = `translateY(${(n - 1) * gap + (dy < 0 ? -150 : 150)}px) rotate(${dy < 0 ? -6 : 6}deg)`; top.style.opacity = "0";
        setTimeout(() => { order = [...order.slice(1), order[0]]; top.style.opacity = "1"; lay(); }, 260);
      };
    }
  }


  // ---- The trip list.
  render() {
    if (this.shared) return this.show(this.shared, true);
    const list = this.list.sort((a, b) => a.from.localeCompare(b.from)), now = today();
    const coming = list.filter((x) => x.to >= now), past = list.filter((x) => x.to < now);
    const row = (tr) => { const n = between(now, tr.from); return `<div class="triprow" data-id="${tr.id}" style="position:relative">${ICON(status(tr, now), "tstamp")}<div class="bp">${this.pass(tr, this.groups(tr)[0], 0, 1)}</div>${tr.to >= now ? `<span class="count">${n > 0 ? (EN_ON ? `${n} days to go` : `还有 ${n} 天`) : n === 0 ? t("今天出发！") : t("进行中")}</span>` : ""}<div class="note" style="margin:6px 2px 0"><span translate="no">${esc(tr.name)}</span> · ${tr.maybe.length ? tr.maybe.map((id) => this.name(id)).join(" · ") : t("看雪定山")}</div></div>`; };
    this.box.innerHTML = `<div class="kicker">MY TRIPS</div><div class="h1">${t("我的行程")}</div>
      <button class="new">${t("＋ 新建行程")}<small>${t("先选雪卡，再看能去哪些山")}</small></button>
      ${coming.length ? `<div class="sec">${t("即将出发")}</div>${coming.map(row).join("")}` : ""}
      ${past.length ? `<div class="sec">${t("去过的")}</div>${past.map(row).join("")}` : ""}
      ${list.length ? "" : `<div class="note">${t("还没有行程。建一个，生成链接发给朋友，大家就能看到同一份计划。")}</div>`}`;
    this.box.querySelector(".new").onclick = () => this.edit();
    for (const el of this.box.querySelectorAll(".triprow")) el.onclick = () => this.show(this.list.find((x) => x.id === el.dataset.id));
    this.box.scrollTop = 0;
  }

  // ---- One trip.
  show(tr, shared = false) {
    const now = today(), n = between(now, tr.from), len = between(tr.from, tr.to) + 1, maybe = this.maybeOf(tr), groups = this.groups(tr);
    const lead = n > 1 ? (EN_ON ? `${n} days to go` : `还有 ${n} 天`) : n === 1 ? (EN_ON ? "Tomorrow" : "明天出发") : n === 0 ? t("今天出发！") : tr.to >= now ? t("进行中") : fmt(tr.from);
    // your own face is the avatar you chose; friends go round the others
    const mine = myAvatar(), others = CREW.filter((a) => a !== mine);
    let o = 0; const face = (p) => `<div class="face">${ICON(p.name === this.me && !shared ? mine : others[o++ % others.length], "")}</div>`;
    this.box.innerHTML = `<button class="back">${t("‹ 我的行程")}</button>
      <div class="kicker">${shared ? esc(t("朋友分享给你的行程")) : "TRIP"}</div><div style="position:relative;padding-right:84px"><div class="h1" translate="no">${esc(tr.name)}</div>${ICON(status(tr, now), "tstamp big")}</div>
      <div class="lead">${lead}<i>·</i>${fmt(tr.from)} – ${fmt(tr.to)}<i>·</i>${EN_ON ? `${len} days` : `${len} 天`}</div>
      <div class="deck"></div><div class="dealhint">${groups.length > 1 ? `↕ ${t("上下滑，抽下一张")} · ${groups.length} ${t("张机票")}` : ""}</div>
      ${SEC("resorts", t("可能去的山"))}<div class="tickets">${maybe.map((id) => this.ticketHTML(id)).join("")}</div>
      ${tr.passes.includes("epic") ? `<div class="note">${t("这些 Epic 雪场还没做：Vail、Breckenridge、Keystone、Beaver Creek")}</div>` : ""}
      ${SEC("season", t("日子"))}<div class="cal"></div>
      ${SEC("av_rider", t("一起滑的人"))}<div class="crew">${(tr.people.length ? tr.people : [{ name: this.me, from: "" }]).map((p) => `<div class="p">${face(p)}<span translate="no">${esc(p.name === this.me && EN_ON ? t("我") : p.name)}</span><small>${esc(p.from || "")}</small></div>`).join("")}${shared ? "" : `<div class="p"><button class="add" data-invite>＋</button><small>${t("邀请")}</small></div>`}</div>
      <div class="acts">${shared ? `<button class="ghostbtn main keep">${t("存到我的行程")}</button>` : `<button class="ghostbtn main share">${t("🔗 分享给朋友")}</button><button class="ghostbtn edit">${t("改一改")}</button><button class="ghostbtn del">${t("删掉")}</button>`}</div>`;
    this.deck(tr, this.box.querySelector(".deck"));
    this.calendar(tr, this.box.querySelector(".cal"), null);
    this.box.querySelector(".back").onclick = () => { this.shared = null; history.replaceState(null, "", location.pathname + "?tab=trip"); this.render(); };
    for (const el of this.box.querySelectorAll(".lt")) {
      el.onclick = (e) => { if (e.target.closest(".pill")) { if (!shared) this.go(el.dataset.id); return; } this.guide(tr, el.dataset.id); };
      this.weather(tr, el);
    }
    const share = async (e) => {
      const url = this.link(tr), text = EN_ON ? `Ski trip: ${tr.name} (${fmt(tr.from)}–${fmt(tr.to)})` : `一起去滑雪：${tr.name}（${fmt(tr.from)}–${fmt(tr.to)}）`;
      if (navigator.share) { navigator.share({ title: tr.name, text, url }).catch(() => {}); return; }
      try { await navigator.clipboard.writeText(url); e.target.textContent = t("链接已复制 ✓"); } catch { prompt(t("复制这个链接发给朋友"), url); }
    };
    this.box.querySelector(".share")?.addEventListener("click", share);
    this.box.querySelector("[data-invite]")?.addEventListener("click", share);
    this.box.querySelector(".edit")?.addEventListener("click", () => this.edit(tr));
    this.box.querySelector(".del")?.addEventListener("click", () => { if (confirm(`${t("删掉")}「${tr.name}」？`)) { save(this.list.filter((x) => x.id !== tr.id)); this.render(); } });
    this.box.querySelector(".keep")?.addEventListener("click", () => {
      const mine = { ...tr, id: "t" + Date.now().toString(36), people: tr.people.some((p) => p.name === this.me) ? tr.people : [...tr.people, { name: this.me, from: "" }] };
      save([...this.list, mine]); this.shared = null; history.replaceState(null, "", location.pathname + "?tab=trip"); this.show(mine);
    });
    this.box.scrollTop = 0;
  }
  ticketHTML(id) {
    const a = ABOUT[id] || { words: "" }, r = this.byId[id], runs = daysOf(id).length, rot = [-0.8, 0.9, -0.5][this.resorts.indexOf(r) % 3];
    return `<div class="lt" data-id="${id}" style="transform:rotate(${rot}deg)"><div class="tk">
      <div class="art"><div class="pic"><div class="pan"><b style="left:0;width:100%;background-image:url(${paintUrl(id)});filter:grayscale(1) brightness(1.04) contrast(.92)"></b></div><div class="wish">Manifest for big snow ❄</div></div></div>
      <div class="txt"><div><div class="k">LIFT TICKET${r.stats ? ` · ${r.stats.top.toLocaleString("en-US")} m` : ""}</div><div class="n">${esc(this.name(id))}</div></div><div class="w">${esc(a.words)}</div></div>
      <div class="stub"><button class="pill">Pre-run</button></div></div>
      ${runs ? stamp(runs) : ghost()}</div>`;
  }
  // Paint the ticket in the trip days' weather once the forecast is out: one panel per day (up to five).
  async weather(tr, el) {
    const r = this.byId[el.dataset.id], fc = await forecast(r, tr.from, tr.to);
    if (!fc || !el.isConnected) return;
    const dates = []; for (let d = tr.from; d <= tr.to && dates.length < 5; d = plus(d, 1)) dates.push(d);
    const n = dates.length, pic = el.querySelector(".pic");
    let best = -1;
    dates.forEach((d, i) => { const w = fc[d]; if (w && w.cm >= 3 && (best < 0 || w.cm > fc[dates[best]].cm)) best = i; }); // a powder day: 3 cm or more
    pic.innerHTML = dates.map((d, i) => { const w = fc[d], k = kindOf(w);
      return `<div class="pan"><b style="left:${-i * 100}%;width:${n * 100}%;background-image:url(${paintUrl(r.id)});filter:${k ? WX[k].filter : "grayscale(1) brightness(1.04)"}"></b>${k ? WX[k].over : ""}</div>`; }).join("");
    pic.insertAdjacentHTML("afterend", `<div class="days">${dates.map((d, i) => { const w = fc[d], k = kindOf(w); return `<div class="${i === best ? "best" : ""}"><small>${WK[day0(d).getDay()]}</small><span>${k ? `${ICON(wxIcon(w))}${w.cm >= 1 ? `${Math.round(w.cm)}cm` : ""}` : "—"}</span></div>`; }).join("")}</div>`);
    if (best >= 0) pic.insertAdjacentHTML("beforebegin", `<div class="powder" style="left:${(best / n) * 100}%">${t("粉雪日")}</div>`);
  }
  // A week strip (or a month), the trip's days washed in blue. With pick, taps choose the days.
  calendar(tr, el, month, pick) {
    const now = today(), days = [];
    let first;
    if (month) { first = day0(month); first.setDate(1); const m = first.getMonth(); for (let i = 0; i < first.getDay(); i++) days.push(null); for (const x = new Date(first); x.getMonth() === m; x.setDate(x.getDate() + 1)) days.push(ymd(x)); }
    else { first = day0(tr.from); first.setDate(first.getDate() - first.getDay()); const end = day0(tr.to); end.setDate(end.getDate() + (6 - end.getDay())); for (const x = new Date(first); x <= end && days.length < 14; x.setDate(x.getDate() + 1)) days.push(ymd(x)); }
    const head = month ? (EN_ON ? `${MON[first.getMonth()]} ${first.getFullYear()}` : `${first.getFullYear()} 年 ${first.getMonth() + 1} 月`) : `${fmt(days[0])} – ${fmt(days[days.length - 1])}`;
    el.innerHTML = `<div class="top">${pick ? `<button data-m="-1">‹</button>` : ""}<b>${head}</b>${pick ? `<button data-m="1">›</button>` : `<button data-toggle>${month ? t("收起") : t("整月")} ${month ? "⌃" : "⌄"}</button>`}</div>
      <div class="g">${(EN_ON ? "SMTWTFS".split("") : "日一二三四五六".split("")).map((d) => `<span class="wd">${d}</span>`).join("")}
      ${days.map((d) => (!d ? '<span class="d x"></span>' : `<button class="d ${d >= tr.from && d <= tr.to ? "in" : ""} ${d === tr.from ? "a" : ""} ${d === tr.to ? "z" : ""} ${d === now ? "today" : ""}" data-d="${d}"><span>${day0(d).getDate()}</span></button>`)).join("")}</div>`;
    el.querySelector("[data-toggle]")?.addEventListener("click", () => this.calendar(tr, el, month ? null : tr.from, pick));
    for (const b of el.querySelectorAll("[data-m]")) b.onclick = () => { const x = day0(month); x.setDate(1); x.setMonth(x.getMonth() + +b.dataset.m); this.calendar(tr, el, ymd(x), pick); };
    if (pick) for (const b of el.querySelectorAll("[data-d]")) b.onclick = () => { pick(b.dataset.d); this.calendar(tr, el, month, pick); };
  }

  // ---- A mountain's guide: why it's good, the snow on your days, who it suits, the numbers, your progress.
  async guide(tr, id) {
    const r = this.byId[id], a = ABOUT[id] || {}, st = r.stats, runs = daysOf(id).length;
    const log = (() => { try { return JSON.parse(localStorage.getItem("prerunLog") || "{}")[id]?.stats; } catch { return null; } })();
    const el = document.createElement("div");
    el.className = "plsheet pl";
    const lv = st ? [["🟢", "初级", st.runs.easy, "#39a34a"], ["🟦", "中级", st.runs.intermediate, "#2f6fd6"], ["◆", "高级", st.runs.advanced, "#2b2b2b"], ["◆◆", "专家", st.runs.expert, "#111"]] : [];
    const total = lv.reduce((s, x) => s + x[2], 0);
    const m = (v) => `${v.toLocaleString("en-US")} m`;
    el.innerHTML = `<div class="s"><button class="x" aria-label="close">×</button><div class="hero" style="background-image:url(${paintUrl(id)})"><div class="t"><div class="kicker">RESORT GUIDE</div><div class="h1" style="margin:0;font-size:28px">${esc(r.name)}</div></div></div>
      <div class="b"><div class="quote">“${esc(EN_ON ? a.en : a.zh)}”</div>
        ${SEC("snowreport", t("这几天的雪"))}<div class="wxbox"><div class="wish">Manifest for big snow ❄<small>${t("还太远，天气预报出来（出发前 2 周内）就会写在这里")}</small></div></div>
        ${st ? `${SEC("difficulty", t("适合谁"))}<div class="bar">${lv.map((x) => `<i style="flex:${x[2]};background:${x[3]}"></i>`).join("")}</div><div class="legend">${lv.map((x) => `<span>${x[0]} ${t(x[1])} ${x[2]}</span>`).join("")}</div>
          <div class="note" style="font-size:15px;color:#4a453f">${EN_ON ? `${st.runs.easy + st.runs.intermediate} of ${total} named runs are green or blue.` : `${total} 条有名字的雪道里，绿道和蓝道有 ${st.runs.easy + st.runs.intermediate} 条。`}</div>
        ${SEC("alpine", t("数字"))}<div class="nums">${[["山顶", m(st.top), "alpine"], ["山脚", m(st.base), "lodge"], ["落差", m(st.top - st.base), "difficulty"], ["雪道", total, "trailmap"], ["缆车", st.lifts, "lift"], ["从 Denver", EN_ON ? `~${a.drive} h drive` : `开车约 ${a.drive} 小时`, "trees"]].map(([k, v, ic]) => `<div>${ICON(ic, "ni")}<small>${t(k)}</small><b>${v}</b></div>`).join("")}</div>` : ""}
        ${st?.flats?.length ? `${SEC("groomed", t("单板注意"))}<div class="note" style="font-size:15px;color:#4a453f;margin-top:0">${EN_ON ? "Flats where a board slows (carry speed into them):" : "这些地方比较平，单板容易减速，要提前带速度："}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${st.flats.map(([n, , m]) => `<span style="font-size:13px;padding:2px 10px;background:#fbf1dc;border-left:3px solid #c9a24a">${esc(n)} · ${m} m</span>`).join("")}</div>` : ""}
        <div class="hikes"></div>
        ${SEC("challenge", t("你的进度"))}<div class="note" style="font-size:15px;color:#4a453f">${runs ? (EN_ON ? `Pre-ran ${runs} time${runs > 1 ? "s" : ""}` : `预滑过 ${runs} 趟`) : t("还没预滑过")}${log?.touched ? (EN_ON ? ` · seen ${Math.max(1, Math.round(log.share * 100))}% of the runs` : ` · 看过 ${Math.max(1, Math.round(log.share * 100))}% 的雪道`) : ""}</div>
        <div class="acts"><button class="ghostbtn main go">${t("去预滑 ›")}</button></div></div></div>`;
    document.body.append(el);
    const close = () => el.remove();
    el.onclick = (e) => { if (e.target === el) close(); };
    el.querySelector(".x").onclick = close;
    el.querySelector(".go").onclick = () => this.go(id);
    const hikes = await hikesOf(id);
    if (hikes.length && el.isConnected) el.querySelector(".hikes").innerHTML = `${SEC("hike", t("徒步上去再滑"))}${hikes.map((h) => `<div style="margin:0 0 12px;padding:10px 12px;background:#f2f4f5">
        <div style="font:600 19px ${SERIF};color:${C.ink}">${esc(EN_ON ? h.name : h.zh)}</div>
        <div style="font-size:13px;color:${C.mute};margin:2px 0 4px">${EN_ON ? `from the top of ${esc(h.from)} · about ${h.mins[0]}–${h.mins[1]} min${h.gain ? ` · +${h.gain} m` : ""}${h.summit ? ` · top ${h.summit[0].toLocaleString("en-US")} m` : ""}` : `从 ${esc(h.from)} 顶出发 · 约 ${h.mins[0]}–${h.mins[1]} 分钟${h.gain ? ` · 爬升约 ${h.gain} 米` : ""}${h.summit ? ` · 山顶 ${h.summit[0].toLocaleString("en-US")} 米` : ""}`}</div>
        <div style="font-size:14px;color:#4a453f">${esc(EN_ON ? h.enWhy : h.zhWhy)}</div>
        ${h.snowcat ? `<div style="font-size:13px;color:${C.pine};margin-top:4px;display:flex;gap:6px;align-items:center">${ICON("groomed", "ni")}${esc(EN_ON ? h.snowcatEn : h.snowcat)}</div>` : ""}
        <ul style="margin:6px 0 0;padding-left:18px;font-size:13px;color:#4a453f">${(EN_ON ? h.tipsEn : h.tips).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}
      <div style="font:15px ${SERIF};color:#6f675e;margin:4px 0 6px">${ICON("packing", "ni inl")} ${t("要带的东西")}</div><div style="display:flex;flex-wrap:wrap;gap:6px">${GEAR[EN_ON ? "en" : "zh"].map((g) => `<span style="font-size:12px;padding:2px 9px;border:1px solid #cbbfa9;border-radius:999px;color:${C.ink}">${esc(g)}</span>`).join("")}</div>
      <div class="note">${EN_ON ? "Times and openings change: check the resort's daily report." : "时间和开放情况会变：以雪场当天公告为准。"}</div>`;
    const fc = await forecast(r, tr.from, tr.to);
    if (fc && el.isConnected) {
      const dates = []; for (let d = tr.from; d <= tr.to && dates.length < 7; d = plus(d, 1)) dates.push(d);
      el.querySelector(".wxbox").innerHTML = `<div class="wx">${dates.map((d) => { const w = fc[d], k = kindOf(w); return `<div><small>${fmt(d)} · ${WK[day0(d).getDay()]}</small><b>${k ? ICON(wxIcon(w)) : "—"}</b>${w ? `<span style="color:${k === "snow" ? "#2f5e8a" : C.mute};font-weight:600"><span translate="no">${k === "snow" && w.cm >= 1 ? `+${Math.round(w.cm)} cm` : wxWord(w)}</span></span><small>${Math.round(w.lo)}° / ${Math.round(w.hi)}°C</small>` : "<small>—</small>"}</div>`; }).join("")}</div><div class="note">Open-Meteo</div>`;
    }
  }

  // ---- New or edit: the pass first, then the dates, then the mountains that pass opens.
  edit(tr) {
    const now = today();
    const d = tr ? JSON.parse(JSON.stringify(tr)) : { id: null, name: "", from: plus(now, 14), to: plus(now, 16), passes: ["ikon"], maybe: [], people: [{ name: this.me, from: "" }], notes: "" };
    let picking = false, month = d.from;
    if (!d.people.length) d.people = [{ name: this.me, from: "" }];
    const meP = () => d.people.find((p) => p.name === this.me) || d.people[0];
    const draw = () => {
      const open = this.opened(d.passes).map((r) => r.id);
      d.maybe = d.maybe.filter((id) => open.includes(id));
      this.box.innerHTML = `<button class="back">${t("‹ 取消")}</button><div class="kicker">${tr ? "EDIT" : "NEW TRIP"}</div><div class="h1">${t(tr ? "改行程" : "新建行程")}</div><div class="lead">${t("先选雪卡，再看能去哪些山")}</div>
        <div class="sec">① ${t("用什么雪卡")}</div><div class="chips">${Object.entries(PASSES).map(([k, v]) => `<button class="chip ${d.passes.includes(k) ? "on" : ""}" data-pass="${k}">${t(v)}</button>`).join("")}</div>
        <div class="note">${t("可以多选 · 一起去的人雪卡不一样也行")}</div>
        <div class="sec">② ${t("几号到几号")}</div><div class="cal"></div><div class="note">${t("点第一天，再点最后一天")}</div>
        <div class="sec">③ ${t("可能去哪些山")}</div>
        <div class="tiles">${this.resorts.map((r) => { const ok = open.includes(r.id); return `<button class="tile ${!ok ? "no" : d.maybe.includes(r.id) ? "on" : d.maybe.length ? "off" : ""}" data-id="${r.id}" style="background-image:url(${paintUrl(r.id)})" ${ok ? "" : "disabled"}><span>${esc(this.name(r.id))}</span></button>`; }).join("")}</div>
        ${d.passes.includes("epic") ? `<div class="note">${t("这些 Epic 雪场还没做：Vail、Breckenridge、Keystone、Beaver Creek")}</div>` : ""}
        <div class="chips" style="margin-top:10px"><button class="chip ${d.maybe.length ? "" : "on"}" data-any>${t("🌨 还没想好，都行")}</button></div>
        <div class="sec">④ ${t("你从哪飞（印在机票上）")}</div>
        <div style="display:flex;gap:8px"><input class="field f-from" maxlength="3" style="flex:1;text-transform:uppercase;font-family:Oswald,sans-serif;letter-spacing:.1em" value="${esc(meP().from)}" placeholder="${t("比如 SFO")}"><button class="ghostbtn locate" style="flex:none">${t("📍 用我的位置")}</button></div>
        <div class="note fromnote">${meP().from && CITY[meP().from] ? CITY[meP().from] : ""}</div>
        <div class="sec">${t("叫什么（可以不填）")}</div><input class="field f-name" maxlength="30" value="${esc(d.name)}" placeholder="${EN_ON ? "e.g. First Tracks 2026" : "比如：2026 开板！"}">
        <div class="acts"><button class="ghostbtn main save">${t("保存，发给朋友 ✈")}</button></div>`;
      const keepName = () => { d.name = this.box.querySelector(".f-name").value; const f = this.box.querySelector(".f-from").value.trim().toUpperCase(); meP().from = /^[A-Z]{3}$/.test(f) ? f : ""; };
      const locate = (ask) => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition((p) => {
          const code = nearestAirport(p.coords.latitude, p.coords.longitude), f = this.box.querySelector(".f-from");
          if (!f || (!ask && f.value)) return;
          f.value = code; meP().from = code;
          this.box.querySelector(".fromnote").textContent = t("最近的机场：{x}", { x: `${code} · ${CITY[code] || ""}` });
        }, () => { if (ask) this.box.querySelector(".fromnote").textContent = t("定位不到，手动填吧"); }, { timeout: 10000, maximumAge: 3600e3 });
      };
      this.box.querySelector(".locate").onclick = () => locate(true);
      // Already allowed? Then fill it in without asking.
      if (!meP().from) navigator.permissions?.query({ name: "geolocation" }).then((q) => { if (q.state === "granted") locate(false); }).catch(() => {});
      this.calendar(d, this.box.querySelector(".cal"), month, (day) => {
        keepName();
        if (!picking || day < d.from) { d.from = day; d.to = day; picking = true; }
        else { d.to = day > plus(d.from, 13) ? plus(d.from, 13) : day; picking = false; }
        month = day;
      });
      this.box.querySelector(".back").onclick = () => (tr ? this.show(tr) : this.render());
      for (const b of this.box.querySelectorAll("[data-pass]")) b.onclick = () => { keepName(); const k = b.dataset.pass; d.passes = d.passes.includes(k) ? d.passes.filter((x) => x !== k) : [...d.passes, k]; if (!d.passes.length) d.passes = [k]; draw(); };
      for (const b of this.box.querySelectorAll(".tile[data-id]:not([disabled])")) b.onclick = () => { keepName(); const id = b.dataset.id; d.maybe = d.maybe.includes(id) ? d.maybe.filter((x) => x !== id) : [...d.maybe, id]; draw(); };
      this.box.querySelector("[data-any]").onclick = () => { keepName(); d.maybe = []; draw(); };
      this.box.querySelector(".save").onclick = () => {
        keepName();
        if (!d.name) d.name = d.maybe.length === 1 ? `${this.name(d.maybe[0])} ${EN_ON ? "trip" : "之旅"}` : EN_ON ? `Skiing, ${fmt(d.from)}` : `${fmt(d.from)} 滑雪`;
        const all = this.list, out = { ...d, id: d.id || "t" + Date.now().toString(36) };
        save(d.id ? all.map((x) => (x.id === d.id ? out : x)) : [...all, out]);
        this.show(out);
      };
    };
    draw();
    this.box.scrollTop = 0;
  }
}
