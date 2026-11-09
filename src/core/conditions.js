// The conditions you ride in (条件), as rules with no DOM and no three.js (tested): live (实时), or a chosen
// hour and sky. One record per resort in localStorage `prerunCond`, written by the resort page's weather bar
// (#now / #timePanel) and by the ride's 雪况 pill, read by both: pick 17:00 and 雪 on the resort page and the
// lift goes up at 17:00 in falling snow; change it on the chair and the resort page shows it when you go back.
//   { live: true }                                   the real time and the forecast (the default)
//   { live: false, hour: 0..23.75, sky: "clear" | "cloudy" | "overcast" | "snow" }
// The hour is local to the resort (Colorado and Utah: both America/Denver). 雪 means snow falling now and a
// recent snowfall of at least SNOW_RECENT_CM over three days, so a chosen snow day has powder (snow-core.js
// turns that into ~0.8 of a full powder day). Another sky keeps the real recent snowfall: picking 晴 the day
// after a storm still has the storm's powder (a bluebird day).

export const KEY = "prerunCond";
export const TZ = "America/Denver";
export const SKIES = ["clear", "cloudy", "overcast", "snow"];
export const SNOW_RECENT_CM = 25;
export const LIVE = Object.freeze({ live: true });

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const quarter = (h) => Math.round(clamp(h, 0, 23.75) * 4) / 4;

// A record checked: anything odd is live.
export function normalize(rec) {
  if (!rec || typeof rec !== "object" || rec.live !== false) return LIVE;
  const hour = Number(rec.hour);
  if (!Number.isFinite(hour) || !SKIES.includes(rec.sky)) return LIVE;
  return { live: false, hour: quarter(hour), sky: rec.sky };
}

// Storage: a Storage-like object (getItem / setItem), so the tests pass a plain one.
function readAll(storage) {
  try { const v = JSON.parse(storage?.getItem(KEY) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
export function load(storage, resort) { return normalize(readAll(storage)[resort]); }
export function save(storage, resort, rec) {
  const all = readAll(storage), n = normalize(rec);
  if (n.live) delete all[resort]; else all[resort] = n;
  try { storage?.setItem(KEY, JSON.stringify(all)); } catch { /* storage off: this page only */ }
  return n;
}

// Clock hours (with fractions) at a moment in a time zone, and the moment today at a given local hour.
export function hourIn(date, tz = TZ) {
  const [h, m] = date.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).split(":").map(Number);
  return (h % 24) + m / 60;
}
export const dateAt = (hour, tz = TZ, now = new Date()) => new Date(now.getTime() + (hour - hourIn(now, tz)) * 3600000);
export const fmtHour = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

// A change from a control: the hour or the sky (the other kept; from live, the hour starts at now and the
// sky at the live sky).
export function choose(rec, change, { now = new Date(), tz = TZ, liveSky = "clear" } = {}) {
  const r = normalize(rec);
  const base = r.live ? { hour: quarter(hourIn(now, tz)), sky: SKIES.includes(liveSky) ? liveSky : "clear" } : r;
  return normalize({ live: false, hour: change.hour ?? base.hour, sky: change.sky ?? base.sky });
}

// What the ride uses: the moment for the sun, the sky, whether snow falls, the recent snowfall (cm) for
// powder, from the record and the live forecast ({ kind, falling, recentCm }, any of them null when offline).
export function effective(rec, live = {}, { now = new Date(), tz = TZ } = {}) {
  const r = normalize(rec);
  if (r.live) return { live: true, date: now, kind: live.kind || "clear", falling: !!live.falling, recentCm: live.recentCm ?? null };
  const snow = r.sky === "snow", cm = live.recentCm ?? null;
  return { live: false, date: dateAt(r.hour, tz, now), hour: r.hour, kind: r.sky, falling: snow, recentCm: snow ? Math.max(cm ?? 0, SNOW_RECENT_CM) : cm };
}

// The pill's short words: "自选 17:00 · 雪" or nothing when live.
export const SKY_ZH = { clear: "晴", cloudy: "多云", overcast: "阴", snow: "雪" };
export const label = (rec) => { const r = normalize(rec); return r.live ? "" : `${fmtHour(r.hour)} · ${SKY_ZH[r.sky]}`; };
