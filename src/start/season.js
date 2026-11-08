// The ski days of each season (November to April), built from what this phone keeps: the trips (each
// past day of a trip, the mountain it went to if one was picked, and who was on it) and the pre-run days
// (the roadbook: when, where, which runs). One day becomes one group photo on the memory tab. No DOM and
// no three.js here, so it is tested in node (tests/season.test.mjs).

import { AVATARS } from "../core/i18n.js?v=47";

// Friends' faces go round the owner's painted animals (as on the trip page).
export const CREW = ["av_rider", "av_fox", "av_hare", "av_marmot", "av_elk", "av_bear", "av_girl"];
export const PRESETS = ["A", "B", "C", "D"];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
const plus = (d, n) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return ymd(x); };

// A season is named by the year it starts: November 2026 to April 2027 is 2026 ("2026/27"). A day out of
// season goes with the nearest one: May and June with the winter before, July on with the winter ahead.
export const seasonOf = (d) => { const y = +d.slice(0, 4), m = +d.slice(5, 7); return m >= 7 ? y : y - 1; };
export const seasonName = (s) => `${s}/${String((s + 1) % 100).padStart(2, "0")}`;
export const seasonShort = (s) => `${String(s % 100).padStart(2, "0")}/${String((s + 1) % 100).padStart(2, "0")}`;

// A small stable hash (FNV-1a), for picking a preset per person and for the photo cache's keys.
export function hash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
// JSON with sorted keys: the same look reads the same after a round trip through the server.
export const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}` : JSON.stringify(v ?? null));

// A rider as a trip member's look carries it: a preset key ("A"…"D"), { preset, colors }, or { ch } (a whole
// character from the rider page). Anything else is no rider.
export function riderOf(look) {
  const r = look?.rider ?? (look?.ch ? { ch: look.ch } : null);
  if (typeof r === "string") return PRESETS.includes(r) ? { preset: r } : null;
  if (r?.ch && typeof r.ch === "object" && typeof r.ch.tpl === "string") return { ch: r.ch };
  if (r && PRESETS.includes(r.preset)) return { preset: r.preset, ...(r.colors && typeof r.colors === "object" ? { colors: r.colors } : {}) };
  return null;
}

// Everyone in one photo gets their own rider: their look's if they have one, else a preset picked by their
// id (or name), moved on to the next free one if someone else in the photo already wears it.
export function dressGroup(people) {
  const used = new Set(people.filter((p) => p.rider?.preset && !p.rider.colors && !p.rider.ch).map((p) => p.rider.preset));
  return people.map((p) => {
    if (p.rider) return p;
    let k = hash(p.key) % 4;
    for (let i = 0; i < 4 && used.has(PRESETS[k]); i++) k = (k + 1) % 4;
    used.add(PRESETS[k]);
    return { ...p, rider: { preset: PRESETS[k] } };
  });
}

// Who's in a photo, in the order they stand: friends in the trip's order, you in the middle. The one who
// holds up yesterday's picture stands just left of the middle (you, when it's two of you or fewer).
export function lineUp(people) {
  const me = people.find((p) => p.me), rest = people.filter((p) => !p.me), at = Math.floor((rest.length + (me ? 1 : 0)) / 2);
  const row = me ? [...rest.slice(0, at), me, ...rest.slice(at)] : rest;
  return { row, holder: Math.max(0, Math.floor((row.length - 1) / 2)) };
}

// trips: the trips as kept on this phone (prerunTrips); book: the roadbook (prerunBook, resort → days);
// valid(id): a resort we have; me: { id (this phone's member id), name (the local trips' "我"), avatar,
// rider }. today: "YYYY-MM-DD". Returns the seasons, newest first.
export function buildSeasons({ trips = [], book = {}, valid = () => true, me, today }) {
  const days = [], others = CREW.filter((a) => a !== me.avatar);
  const mine = { key: "me", me: true, name: me.name, avatar: me.avatar, rider: me.rider };
  for (const tr of trips) {
    if (!tr || !DATE.test(tr.from) || !DATE.test(tr.to) || tr.to < tr.from) continue;
    const plan = tr.days && typeof tr.days === "object" && !Array.isArray(tr.days) ? tr.days : {};
    // The crew: a shared trip's members (their looks: avatar and rider), else the names on a local trip.
    let crew;
    if (tr.srv?.members?.length) {
      crew = tr.srv.members.map((m, k) => (m.id === me.id ? mine : { key: m.id, name: String(m.name ?? ""), avatar: AVATARS.includes(m.look?.avatar) ? m.look.avatar : others[k % others.length], rider: riderOf(m.look) }));
    } else {
      let o = 0;
      crew = (tr.people || []).map((p) => (typeof p === "string" ? { name: p } : p)).map((p) => (p.me || p.name === me.name ? mine : { key: "n:" + p.name, name: String(p.name ?? ""), avatar: others[o++ % others.length], rider: null }));
    }
    crew = crew.filter((p, i) => crew.findIndex((q) => q.key === p.key) === i);
    if (!crew.some((p) => p.me)) crew.unshift(mine);
    for (let d = tr.from, n = 1; d <= tr.to && d <= today; d = plus(d, 1), n++) {
      const at = valid(plan[d]) ? plan[d] : null, prev = n > 1 ? (valid(plan[plus(d, -1)]) ? plan[plus(d, -1)] : null) : undefined;
      days.push({ date: d, resort: at, n, len: Math.round((new Date(tr.to) - new Date(tr.from)) / 864e5) + 1, trip: { id: tr.id, name: tr.name }, held: n > 1 ? { resort: prev } : null, people: crew, runs: [], prerun: false });
    }
  }
  // Pre-run days: with the trip's day when it's the same day at the same mountain, else a day of your own.
  for (const [resort, list] of Object.entries(book || {})) {
    if (!valid(resort) || !Array.isArray(list)) continue;
    for (const day of list) {
      if (!day?.steps?.length || !day.t0) continue;
      const d = ymd(new Date(day.t0)), runs = [];
      for (const s of day.steps) if (s.k === "route" || s.k === "go") for (const g of s.segs || []) if (g.n && !runs.includes(g.n)) runs.push(g.n);
      const same = days.find((x) => x.date === d && x.resort === resort);
      if (same) { for (const r of runs) if (!same.runs.includes(r)) same.runs.push(r); same.prerun = true; continue; }
      days.push({ date: d, resort, n: 0, len: 0, trip: null, held: null, people: [mine], runs, prerun: true, t0: day.t0 });
    }
  }
  // Into seasons, each day's photo line-up decided, newest first.
  const by = new Map();
  for (const d of days.sort((a, b) => (a.date === b.date ? (a.trip ? 0 : 1) - (b.trip ? 0 : 1) : a.date < b.date ? -1 : 1))) {
    const s = seasonOf(d.date);
    if (!by.has(s)) by.set(s, { season: s, days: [] });
    const { row, holder } = lineUp(dressGroup(d.people));
    by.get(s).days.push({ ...d, people: row, holder: d.held ? holder : -1 });
  }
  const out = [...by.values()].sort((a, b) => b.season - a.season);
  for (const S of out) {
    Object.assign(S, summary(S.days));
    S.days.reverse(); // newest first on the page
  }
  return out;
}

// Any set of days at a glance: trips, days, mountains, runs, and the friends on them (first seen first).
export function summary(days) {
  const friends = new Map(), runs = new Set(), trips = new Set();
  for (const d of days) {
    if (d.trip) trips.add(d.trip.id ?? d.trip.name);
    for (const p of d.people) if (!p.me && !friends.has(p.key)) friends.set(p.key, p);
    for (const r of d.runs) runs.add(`${d.resort}:${r}`);
  }
  return { stats: { trips: trips.size, days: new Set(days.map((d) => d.date)).size, mountains: new Set(days.map((d) => d.resort).filter(Boolean)).size, runs: runs.size }, friends: [...friends.values()] };
}

// What a photo is, as a string: the same day, place, held picture and people (in their looks) make the
// same photo, so it's rendered once and kept.
export const photoKey = (d, v = 1) => `p${v}:${hash(canon([d.date, d.resort, d.held?.resort ?? (d.held ? "-" : null), d.holder, d.people.map((p) => [p.key, p.rider])]))}:${d.date}`;
