// The opening's trip, worked out from the trips on this phone (and the shared ones, refreshed): which one,
// where it stands, who is on it and where each plane is. No DOM work at import, so it is tested in node
// (tests/trip-intro.test.mjs); intro.js draws it.

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
const day0 = (d) => new Date(d + "T00:00:00");
export const between = (a, b) => Math.round((day0(b) - day0(a)) / 86400000);
export const LOOK_BACK = 7; // days after a trip it is still the one the opening is about

// The trip the opening is about, and where it stands today:
//   travel  today is its first day          during  a later day of it (day: 2, 3…)
//   soon    the soonest coming up (left: days to go)   after  ended in the last week (ago: days since)
// One under way comes first, then the soonest coming up, then the latest to have ended. null if none.
export function pickTrip(list, today) {
  const ok = (Array.isArray(list) ? list : []).filter((tr) => tr && DATE.test(tr.from) && DATE.test(tr.to || tr.from)).map((tr) => ({ ...tr, to: tr.to && tr.to >= tr.from ? tr.to : tr.from }));
  const on = ok.filter((tr) => tr.from <= today && tr.to >= today).sort((a, b) => b.from.localeCompare(a.from))[0];
  if (on) return on.from === today ? { trip: on, phase: "travel", day: 1 } : { trip: on, phase: "during", day: between(on.from, today) + 1 };
  const next = ok.filter((tr) => tr.from > today).sort((a, b) => a.from.localeCompare(b.from))[0];
  if (next) return { trip: next, phase: "soon", left: between(today, next.from) };
  const last = ok.filter((tr) => tr.to < today && between(tr.to, today) <= LOOK_BACK).sort((a, b) => b.to.localeCompare(a.to))[0];
  if (last) return { trip: last, phase: "after", ago: between(last.to, today) };
  return null;
}

// How far along its route a plane is, 0 (at home) .. 1 (on the tarmac at Denver), from the days to go: at
// home a month or more out, creeping in over the last 30 days, parked the day before.
export const COUNTDOWN = 30;
export const progress = (left) => Math.max(0, Math.min(1, (COUNTDOWN - left) / (COUNTDOWN - 1)));

// The mountains the trip plans: each day's, in order; else the ones it might ski. Ids.
export function resortsOf(tr) {
  const days = tr?.days && typeof tr.days === "object" && !Array.isArray(tr.days) ? tr.days : {};
  const byDay = Object.keys(days).filter((d) => DATE.test(d) && d >= tr.from && d <= tr.to).sort().map((d) => days[d]).filter(Boolean);
  const out = [...new Set(byDay)];
  return out.length ? out : [...new Set((Array.isArray(tr?.maybe) ? tr.maybe : []).filter(Boolean))];
}
// The mountain planned for one day, or null.
export const resortOn = (tr, date) => (tr?.days && typeof tr.days === "object" && !Array.isArray(tr.days) ? tr.days[date] || null : null);

// Who is on the trip, each with their face, as trips.js shows them: mine is the avatar I chose; on a
// shared trip each member's own pick, else one round the animals by their place in the crew; on a trip
// kept on this phone the others go round the animals in order. Their travel note (members.travel) too.
const CREW = ["av_rider", "av_fox", "av_hare", "av_marmot", "av_elk", "av_bear", "av_girl"];
export function crewOf(tr, { mine = "av_rider", me = "我", avatars = CREW } = {}) {
  const others = CREW.filter((a) => a !== mine), members = tr?.srv?.members || [];
  let o = 0;
  return (Array.isArray(tr?.people) ? tr.people : []).map((p0, i) => {
    const p = typeof p0 === "string" ? { name: p0, from: "" } : p0 || {};
    const isMe = tr.shared ? !!p.me : p.name === me;
    const face = isMe ? mine : tr.shared ? (avatars.includes(p.avatar) ? p.avatar : others[Math.max(0, i) % others.length]) : others[o++ % others.length];
    const tv = tr.shared ? members[i]?.travel : null;
    const note = typeof tv === "string" ? tv : tv && typeof tv === "object" ? [tv.note, tv.flight, tv.text, tv.mode].find((x) => typeof x === "string" && x.trim()) || "" : "";
    return { name: String(p.name ?? "").slice(0, 20), from: /^[A-Z]{3}$/.test(p.from) ? p.from : "", face, me: isMe, note: String(note).slice(0, 80) };
  });
}

// The routes on the pane: the direction each city lies from Denver (radians, y up, as on a map), kept
// above the horizon a little (Denver sits low on the pane) and pushed apart so no two planes share a line.
export function spread(angles, gap = 0.52, lo = -0.4, hi = Math.PI + 0.4) {
  const order = angles.map((a, i) => [Math.max(lo, Math.min(hi, a)), i]).sort((x, y) => x[0] - y[0]);
  for (let pass = 0; pass < 8; pass++) {
    for (let k = 1; k < order.length; k++) if (order[k][0] - order[k - 1][0] < gap) { const mid = (order[k][0] + order[k - 1][0]) / 2; order[k - 1][0] = mid - gap / 2; order[k][0] = mid + gap / 2; }
    const over = Math.max(0, lo - order[0]?.[0]), under = Math.max(0, (order.at(-1)?.[0] ?? 0) - hi);
    for (const x of order) x[0] += over - under;
  }
  const out = []; for (const [a, i] of order) out[i] = a; return out;
}
// The direction of an airport from Denver on a north-up map.
export const bearing = ([la, lo], [dla, dlo]) => Math.atan2(la - dla, ((((lo - dlo) % 360) + 540) % 360 - 180) * Math.cos((dla * Math.PI) / 180)); // the short way round (Asia lies west)
