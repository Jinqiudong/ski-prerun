// Riding together, the parts with no DOM and no three.js (tested in node: tests/together.test.mjs): which
// shared trip the ride belongs to, what a friend's state message may hold, who shares which chair and in
// which seat, when my own state is worth sending again, and the words for where a friend is.
import { animalOf, riggedOf, petColors } from "../rider/animal-core.js?v=2";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[\w-]{4,40}$/;

// The shared trip this ride belongs to: the one I opened the ride from (wanted), if I have it or nothing
// else is known, else a shared trip I'm a member of: the one on today (planned for this resort today first),
// or, before or after the trip, the next one coming up or the latest. null: ride alone.
export function rideTrip(list, today, resort, member, wanted = null) {
  const trips = (Array.isArray(list) ? list : []).filter((tr) => tr && tr.shared && typeof tr.id === "string");
  const mine = (tr) => !tr.srv?.members || tr.srv.members.some((m) => m.id === member);
  if (wanted && ID.test(wanted)) { const tr = trips.find((x) => x.id === wanted); return !tr || mine(tr) ? wanted : null; }
  const on = trips.filter((tr) => DATE.test(tr.from) && tr.from <= today && (DATE.test(tr.to) ? tr.to : tr.from) >= today && mine(tr));
  const here = on.find((tr) => tr.days && tr.days[today] === resort);
  if (here || on[0]) return (here || on[0]).id;
  // Not on a trip today (practising before it): the next one coming up, else the latest one, so friends on the
  // same trip still meet whatever the date. Every phone picks the same way, so they land on the same channel.
  const dated = trips.filter((tr) => DATE.test(tr.from) && mine(tr));
  const next = dated.filter((tr) => tr.from > today).sort((a, b) => a.from.localeCompare(b.from))[0];
  const last = dated.filter((tr) => tr.from <= today).sort((a, b) => b.from.localeCompare(a.from))[0];
  return (next || last || trips.find(mine))?.id || null;
}

// Messages on the channel ride:<trip>:<resort>:
//   hi   { id, name, avatar, colors, rider, stance, ask }   who I am: rider is my look's (ask: please say who you are too)
//   s    { id, ph, ... }                             where I am (below), about 4 a second while it changes
//   m    { id, k }                                   a quick message (QUICK)
//   bye  { id }                                      I left
// A state: ph "lift" (l lift, d metres along it, v metres a second, b when I boarded, c chair id, k my seat
// and kt when I took it, hd 1 while my chair waits at the loading point for friends on their way),
// "top" (l, x, z, h), "ski" (x, z, h heading, sp speed, ln lean, run, w the lift I wait at the bottom of),
// "hike" (x, z, h). Skiing also says where to: e [x, z] and en, its name.
export const PHASES = ["lift", "top", "ski", "hike"];
export const QUICK = [
  { k: "wait", zh: "等我", icon: "msg_wait" },
  { k: "meet", zh: "缆车站见", icon: "msg_meet" },
  { k: "good", zh: "这条好滑", icon: "msg_good" },
  { k: "down", zh: "我先下去了", icon: "msg_down" },
  { k: "coming", zh: "去找你", icon: "msg_coming" },
];
const num = (v, lo, hi) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);
const str = (v, n = 60) => (typeof v === "string" ? v.slice(0, n) : null);
const AV = /^av_[a-z]+$/, HEX = /^#[0-9a-f]{6}$/i;

// A state from the wire, checked and trimmed; null if it isn't one.
export function cleanState(p) {
  if (!p || typeof p !== "object" || !ID.test(p.id) || !PHASES.includes(p.ph)) return null;
  const s = { id: p.id, ph: p.ph };
  if (p.ph === "lift") {
    s.l = str(p.l); s.d = num(p.d, 0, 20000); s.v = num(p.v, 0, 200) ?? 0; s.b = num(p.b, 0, 1e14); s.c = str(p.c, 80);
    if (!s.l || s.d == null) return null;
    if (Number.isInteger(p.k) && p.k >= 0 && p.k < 12) { s.k = p.k; s.kt = num(p.kt, 0, 1e14) ?? 0; }
    if (p.hd === 1) s.hd = 1;
  } else {
    s.x = num(p.x, -1e5, 1e5); s.z = num(p.z, -1e5, 1e5); s.h = num(p.h, -100, 100) ?? 0;
    if (s.x == null || s.z == null) return null;
    if (p.ph === "top") s.l = str(p.l);
    if (p.ph === "ski") {
      s.sp = num(p.sp, 0, 60) ?? 0; s.ln = num(p.ln, -2, 2) ?? 0; s.run = str(p.run); s.w = str(p.w);
      if (Array.isArray(p.e) && num(p.e[0], -1e5, 1e5) != null && num(p.e[1], -1e5, 1e5) != null) { s.e = [p.e[0], p.e[1]]; s.en = str(p.en) || ""; }
    }
  }
  return s;
}
// Who someone is, from a "hi".
export function cleanHi(p) {
  if (!p || typeof p !== "object" || !ID.test(p.id)) return null;
  const colors = {};
  if (p.colors && typeof p.colors === "object") for (const [k, v] of Object.entries(p.colors)) if (/^[a-z]{2,10}$/.test(k) && HEX.test(v)) colors[k] = v;
  return { id: p.id, name: str(p.name, 20) || "", avatar: AV.test(p.avatar) ? p.avatar : "av_rider", colors, rider: cleanRider(p.rider), stance: p.stance === "goofy" ? "goofy" : "regular", ask: !!p.ask };
}
// The rider in someone's look (core/look.js): { ch } (a character: template, sizes, parts, colours by
// material, board, and animal if they ride as one of the resort animals), { preset, colors } or { preset }; only
// the right kinds of value (the ride keeps the sizes inside the template's ranges). null if it isn't one.
export function cleanRider(r) {
  if (!r || typeof r !== "object") return null;
  if (r.ch && typeof r.ch === "object") {
    const c = r.ch; if (c.tpl !== "F" && c.tpl !== "M") return null;
    const ch = { tpl: c.tpl, parts: {}, colors: {} };
    for (const [k, v] of Object.entries(c).slice(0, 40)) if (/^[a-z]{2,12}$/.test(k) && typeof v === "number" && Number.isFinite(v)) ch[k] = v;
    if (c.parts && typeof c.parts === "object") for (const [k, v] of Object.entries(c.parts).slice(0, 20)) if (/^[a-z_]{2,16}$/.test(k)) ch.parts[k] = !!v;
    if (c.colors && typeof c.colors === "object") for (const [k, v] of Object.entries(c.colors).slice(0, 40)) if (/^MAT_\w{1,30}$/.test(k) && HEX.test(v)) ch.colors[k] = v;
    if (/^[A-D]$/.test(c.board)) ch.board = c.board;
    if (c.glossyHelmet === true) ch.glossyHelmet = true;
    if (animalOf(c.animal)) ch.animal = c.animal;
    if (riggedOf(c.animal) && c.pet && typeof c.pet === "object") ch.pet = { colors: petColors(c.pet.colors) }; // its own colours
    return { ch };
  }
  const out = {};
  if (/^[A-D]$/.test(r.preset)) out.preset = r.preset;
  if (r.colors && typeof r.colors === "object") for (const [k, v] of Object.entries(r.colors).slice(0, 12)) if (/^[a-z]{2,10}$/.test(k) && HEX.test(v)) (out.colors ||= {})[k] = v;
  return out.preset || out.colors ? out : null;
}

// Worth sending again? Moved, turned, changed phase, or quiet for `keep` ms (so friends know I'm here).
// On a lift the chair's motion is predictable: only a change of speed, a jump, or once a second.
export function changed(a, b, dt, keep = 5000) {
  if (!a || !b || a.ph !== b.ph || a.l !== b.l || a.c !== b.c || a.k !== b.k || a.hd !== b.hd || a.w !== b.w || a.run !== b.run || a.en !== b.en) return true;
  if (dt >= keep) return true;
  if (a.ph === "lift") return dt >= 1000 || Math.abs(a.v - b.v) > 0.05 || Math.abs(a.d + (a.v * dt) / 1000 - b.d) > 3;
  return Math.hypot(a.x - b.x, a.z - b.z) > 0.3 || Math.abs(a.h - b.h) > 0.05;
}

// Seats in the order people fill a chair: next to the first (whose seat is the ride's own, index 1), then
// the other side, then on outwards.
export function seatOrder(n) {
  const out = [1, 2, 0]; for (let i = 3; i < n; i++) out.push(i);
  return out.filter((i) => i < n);
}
// Everyone in one chair, in the order they boarded (then by id): their seat indices. Who doesn't fit
// gets -1 (they ride the chair behind).
export function seatsOf(members, n) {
  const order = seatOrder(n), sorted = [...members].sort((a, b) => (a.b ?? 0) - (b.b ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return new Map(sorted.map((m, i) => [m.id, i < order.length ? order[i] : -1]));
}
// Do I share a friend's chair? me { id, lift, b (when I boarded) }, states: friends' latest. A friend on
// the same lift who boarded up to `win` ms before me (or at the same moment, with a smaller id), or whose
// chair still waits at the loading point (hd), owns the chair; or `want` (a friend I asked to ride with: no
// time limit). Returns the state whose chair I take, or null.
export const HOLD = 20000, HOLD_MAX = 45000;
export function chairToJoin(me, states, { win = HOLD, want = null } = {}) {
  let best = null;
  for (const s of states) {
    if (!s || s.ph !== "lift" || s.l !== me.lift || s.id === me.id || !s.c) continue;
    if (s.c.startsWith(me.id + "@")) continue; // they are in mine
    const asked = want && s.id === want;
    const first = s.b < me.b || (s.b === me.b && s.id < me.id);
    if (!asked && (!first || (me.b - s.b > win && !s.hd))) continue;
    if (!best || asked || s.b < best.b) best = s;
    if (asked) break;
  }
  return best;
}

// Who sits where in one chair of n seats. members [{ id, k (the seat they took), kt (when) }]: the earliest
// claim on a seat keeps it (then the smaller id); the others take the free seat nearest the one they wanted,
// and those who never said take free seats in seatOrder. Who doesn't fit: -1 (the chair behind). Every phone
// works it out from the same states, so two riders never share a seat, whatever the channel drops.
export function chairSeats(members, n) {
  const ok = (k) => Number.isInteger(k) && k >= 0 && k < n, byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const when = (m) => (ok(m.k) ? m.kt ?? 0 : Infinity);
  const out = new Map(), taken = new Set(), rest = [];
  const list = [...members].sort((a, b) => (when(a) === when(b) ? 0 : when(a) < when(b) ? -1 : 1) || byId(a, b));
  for (const m of list) if (ok(m.k) && !taken.has(m.k)) { taken.add(m.k); out.set(m.id, m.k); } else rest.push(m);
  for (const m of rest) {
    const free = ok(m.k) ? [...Array(n).keys()].filter((i) => !taken.has(i)).sort((a, b) => Math.abs(a - m.k) - Math.abs(b - m.k) || a - b) : seatOrder(n).filter((i) => !taken.has(i));
    const k = free.length ? free[0] : -1;
    if (k >= 0) taken.add(k);
    out.set(m.id, k);
  }
  return out;
}
// The first free seat in the order people fill a chair (for someone getting on), or -1.
export function freeSeat(seats, n) { const used = new Set(seats.values()); return seatOrder(n).find((i) => !used.has(i)) ?? -1; }
// The nearest free seat from `from` toward dir (+1: up the seat numbers, the rider's left; -1: right), or -1.
export function seatToward(seats, n, from, dir) {
  const used = new Set(seats.values());
  for (let i = from + dir; i >= 0 && i < n; i += dir) if (!used.has(i)) return i;
  return -1;
}

// Boarding together: the first of us at the lift holds the chair at the loading point while friends are on
// their way (coming: [{ loading }], loading: their ride page is still opening), HOLD ms from sitting down,
// HOLD_MAX while someone's page loads. How long it still waits (ms); 0: go.
export function holdLeft(since, now, coming) {
  if (!coming.length) return 0;
  return Math.max(0, since + (coming.some((c) => c.loading) ? HOLD_MAX : HOLD) - now);
}
// Who is on their way to my chair. me { id, lift, resort, b, c (my chair) }; members: the party's presences
// (party-core cleanPresence); states: friends' ride states. On their way: a party member opening this lift's
// ride after me (not in my chair yet), one following me (the party brings them onto my lift), or a friend
// waiting at the bottom of this lift (they're offered my chair). Not those in my chair already, nor those
// riding up this lift in another chair (past d0 + 20 m: the chair behind, say). Returns [{ id, loading }].
export function comingTo(me, members, states) {
  const inMine = new Set(states.filter((s) => s?.ph === "lift" && (s.c === me.c || (s.l === me.lift && s.d > (me.d0 || 0) + 20))).map((s) => s.id)), out = new Map();
  for (const m of members) {
    if (!m || m.id === me.id || !m.in || inMine.has(m.id) || m.c === me.c) continue;
    const here = m.page === "ride" && m.resort === me.resort && m.lift === me.lift && (m.ph || "lift") === "lift";
    if (here ? !m.b || m.b > me.b : m.fol === me.id) out.set(m.id, { id: m.id, loading: true });
  }
  for (const s of states) if (s && s.id !== me.id && s.ph === "ski" && s.w === me.lift && !inMine.has(s.id) && !out.has(s.id)) out.set(s.id, { id: s.id, loading: false });
  return [...out.values()];
}

// Where a friend is, as words: [zh, vars] for i18n's t().
export function whereOf(s) {
  if (!s) return null;
  if (s.ph === "lift") return ["{lift} 缆车上", { lift: s.l }];
  if (s.ph === "top") return s.l ? ["{lift} 山顶", { lift: s.l }] : ["在山顶", {}];
  if (s.ph === "hike") return ["徒步上山", {}];
  if (s.w) return ["在 {lift} 底站", { lift: s.w }];
  return s.run ? ["在 {run}", { run: s.run }] : ["滑行中", {}];
}

// The point at distance d along a polyline [[x, z]…] (horizontal metres), and the way it runs.
export function alongPts(pts, d) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az);
    if (acc + L >= d || i === pts.length - 1) { const t = L ? Math.max(0, Math.min(1, (d - acc) / L)) : 0; return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, h: Math.atan2(bx - ax, bz - az) }; }
    acc += L;
  }
  return pts.length ? { x: pts[0][0], z: pts[0][1], h: 0 } : { x: 0, z: 0, h: 0 };
}
