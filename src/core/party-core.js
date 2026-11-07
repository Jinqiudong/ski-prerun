// The party (一起滑), the parts with no DOM (tested in node: tests/party.test.mjs): which shared trip's party,
// what a message on the party channel may hold, who is live, whom I really follow, when a friend I follow
// has done something that carries me along, the timing and seats of a 一起坐 call, where the pet sits on
// each page, and the words for where someone is.
//
// Messages on the channel party:<trip> (src/core/party.js; only people who have the trip id can join it):
//   p    presence, every few seconds and on a change:
//        { id, name, av, in }                      on the trip, not in the party: nothing about where
//        + { page, tab, resort, rn, ph, lift, b, c, run, e, en, fol, mic, since }   in the party
//   inv  { id, to: [ids] }                         an invite to the party
//   call { id, k, lift, resort, rn, at }           一起坐: everyone in the party, board lift at `at` (epoch ms)
//   ok   { id, k }                                 I'm in for call k
//   ping { id, to }                                叫他来: come over
//   bye  { id }                                    I left the party
//   v / vs                                         voice (src/ride/voice.js), off the slopes

export const ID = /^[\w-]{4,40}$/;
const AV = /^av_[a-z]+$/, RESORT = /^[a-z0-9-]{2,40}$/, K = /^[\w-]{4,24}$/;
export const PAGES = ["home", "resort", "ride"];
export const TABS = ["rider", "resort", "trip", "log"];
export const PHASES = ["base", "lift", "top", "pick", "ski", "hike"];
export const GREY = 8000, STALE = 15000, EVERY = 4000; // presence: sent every EVERY ms; grey, then gone
export const COUNTDOWN = 3000; // 一起坐: the invite's bar
const num = (v, lo, hi) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);
const str = (v, n = 60) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

// A presence from the wire, checked and trimmed; null if it isn't one.
export function cleanPresence(p) {
  if (!p || typeof p !== "object" || !ID.test(p.id)) return null;
  const o = { id: p.id, name: str(p.name, 20) || "", av: AV.test(p.av) ? p.av : "av_rider", in: p.in === true };
  if (!o.in) return o;
  o.page = PAGES.includes(p.page) ? p.page : "home";
  if (o.page === "home") o.tab = TABS.includes(p.tab) ? p.tab : "rider";
  if (o.page !== "home") {
    if (!RESORT.test(p.resort)) { o.page = "home"; o.tab = "rider"; } else { o.resort = p.resort; o.rn = str(p.rn, 40) || p.resort; }
  }
  if (o.page === "ride") {
    o.ph = PHASES.includes(p.ph) ? p.ph : "lift";
    o.lift = str(p.lift); o.run = str(p.run); o.c = str(p.c, 80);
    o.b = num(p.b, 0, 1e14);
    if (Array.isArray(p.e) && num(p.e[0], -1e5, 1e5) != null && num(p.e[1], -1e5, 1e5) != null) { o.e = [p.e[0], p.e[1]]; o.en = str(p.en) || ""; }
  }
  if (o.page === "resort") o.ph = p.ph === "base" ? "base" : null;
  o.fol = ID.test(p.fol) && p.fol !== p.id ? p.fol : null;
  o.mic = p.mic === true;
  o.since = num(p.since, 0, 1e14) ?? 0;
  return o;
}
// An invite or a ping, if it's meant for me.
export function cleanInvite(p, me) {
  if (!p || typeof p !== "object" || !ID.test(p.id) || p.id === me || !Array.isArray(p.to)) return null;
  const to = p.to.filter((x) => ID.test(x)).slice(0, 20);
  return to.includes(me) ? { id: p.id, to } : null;
}
export function cleanPing(p, me) {
  if (!p || typeof p !== "object" || !ID.test(p.id) || p.id === me || p.to !== me) return null;
  return { id: p.id, to: me };
}
// A 一起坐 call: which lift, at which resort, boarding at `at`.
export function cleanCall(p) {
  if (!p || typeof p !== "object" || !ID.test(p.id) || !K.test(p.k) || !RESORT.test(p.resort)) return null;
  const lift = str(p.lift), at = num(p.at, 0, 1e14);
  if (!lift || at == null) return null;
  return { id: p.id, k: p.k, lift, resort: p.resort, rn: str(p.rn, 40) || p.resort, at };
}
export function cleanOk(p) {
  if (!p || typeof p !== "object" || !ID.test(p.id) || !K.test(p.k)) return null;
  return { id: p.id, k: p.k };
}

// Everyone heard from: id → { ...presence, at (when heard, my clock), gone (a bye) }. Who to show, and how:
// "live" (heard in the last GREY ms), "grey" (quiet a while: closed the app, or on a slow page load), and
// those quiet past STALE or who said bye are left out. Members of the party only, unless all.
export function liveMembers(heard, now, { all = false } = {}) {
  const out = [];
  for (const m of heard.values()) {
    if (!m || m.gone || now - m.at > STALE || (!all && !m.in)) continue;
    out.push({ ...m, state: now - m.at > GREY ? "grey" : "live" });
  }
  return out.sort((a, b) => (a.since || 0) - (b.since || 0) || (a.id < b.id ? -1 : 1));
}

// Whom I really follow: the one I asked to follow if they're here; if they've gone, whoever they were
// following (so a party following one friend keeps going when someone in the middle leaves). A chain that
// comes back to me goes nowhere (null): two people following each other just stay put.
export function resolveFollow(heard, me, fol, now) {
  const here = (id) => { const m = heard.get(id); return m && m.in && !m.gone && now - m.at <= STALE; };
  let cur = fol;
  for (let i = 0; cur && i < 12; i++) {
    if (cur === me) return null;
    if (here(cur)) {
      // their own chain must not lead back to me
      let x = heard.get(cur).fol;
      for (let j = 0; x && j < 12; j++) { if (x === me) return null; x = heard.get(x)?.fol; }
      return cur;
    }
    cur = heard.get(cur)?.fol || null;
  }
  return null;
}
// 跟队: whom to follow to stay with the party: the one most others follow, else whoever joined first; never
// someone whose chain comes back to me.
export function teamLead(heard, me, now) {
  const live = liveMembers(heard, now).filter((m) => m.id !== me);
  if (!live.length) return null;
  const n = new Map();
  for (const m of live) { const t = resolveFollow(heard, m.id, m.fol, now); if (t && t !== me) n.set(t, (n.get(t) || 0) + 1); }
  const ok = live.filter((m) => resolveFollow(heard, me, m.id, now) === m.id);
  ok.sort((a, b) => (n.get(b.id) || 0) - (n.get(a.id) || 0) || (a.since || 0) - (b.since || 0) || (a.id < b.id ? -1 : 1));
  return ok[0]?.id || null;
}

// What the friend I follow just did that carries me along, given where I am (mine: my presence) and the last
// move I already went along with (seen). Returns { act, key, ... } or null:
//   "lift"   they got on a lift: onto the same lift, into their chair (unless I'm already on it with them)
//   "route"  they set off down a route from the top: land beside them and go their way (if I'm at that
//            resort in the ride, not on a lift or skiing my own way already; skiing, the ride follows them)
//   "resort" they opened a resort's page and I'm not riding: open it too
export function followMove(t, mine, seen = null) {
  if (!t || !t.in || !mine) return null;
  if (t.page === "ride" && t.ph === "lift" && t.lift && t.b) {
    const key = `lift:${t.resort}:${t.lift}:${t.b}`;
    if (key === seen) return null;
    if (mine.page === "ride" && mine.resort === t.resort && mine.ph === "lift" && mine.lift === t.lift && (mine.c === t.c || Math.abs((mine.b || 0) - t.b) < 15000)) return null;
    return { act: "lift", key, resort: t.resort, lift: t.lift };
  }
  if (t.page === "ride" && t.ph === "ski" && t.e) {
    const key = `route:${t.resort}:${t.e[0]},${t.e[1]}`;
    if (key === seen) return null;
    if (mine.page === "ride" && (mine.resort !== t.resort || mine.ph === "lift" || mine.ph === "ski" || mine.ph === "hike")) return null;
    return { act: "route", key, resort: t.resort, lift: t.lift };
  }
  if (t.page === "resort" && t.resort) {
    const key = `resort:${t.resort}`;
    if (key === seen || mine.page === "ride" || (mine.page === "resort" && mine.resort === t.resort)) return null;
    return { act: "resort", key, resort: t.resort };
  }
  return null;
}

// Where 去找他 takes me: { go: "ride", ... } beside them in the ride (on their lift and into their chair, or
// landing beside them on the snow), { go: "resort" } their resort's page, or null (they're on the home page:
// nothing to go to; 叫他来 instead).
export function findWay(t) {
  if (!t || !t.in || t.page === "home") return null;
  if (t.page === "resort") return { go: "resort", resort: t.resort };
  if (t.ph === "lift" && t.lift) return { go: "ride", resort: t.resort, lift: t.lift, chair: true };
  return { go: "ride", resort: t.resort, lift: t.lift || null, chair: false };
}

// 一起坐: the call boards at now + COUNTDOWN + a little for the message to get there.
export const callAt = (now) => now + COUNTDOWN + 500;
// How long is left on a call I heard at `heardAt` (my clock), as a fraction of the bar and in ms. Phones'
// clocks differ a little, so a call whose `at` looks far off on my clock runs on the time I heard it instead.
export function callLeft(call, heardAt, now) {
  let end = call.at;
  if (end - heardAt > COUNTDOWN + 4000 || end - heardAt < 500) end = heardAt + COUNTDOWN;
  const left = Math.max(0, end - now);
  return { left, frac: Math.min(1, left / COUNTDOWN), end };
}
// The chair everyone on a call shares, and who sits where: the caller's chair at `at`; seats by the order
// people fill a chair (together-core's seatOrder), everyone boarding at the same moment, so by id. Those
// who don't fit ride the chair behind (-1).
export const callChair = (call) => `${call.id}@${Math.round(call.at)}`;
export function callSeats(ids, n) {
  const order = [1, 2, 0]; for (let i = 3; i < n; i++) order.push(i);
  const seats = order.filter((i) => i < n), sorted = [...new Set(ids)].filter((x) => ID.test(x)).sort();
  return new Map(sorted.map((id, i) => [id, i < seats.length ? seats[i] : -1]));
}

// Where the pet sits on each page: the emptiest edge. edge "left" / "right" (at y, a fraction of the screen
// height, the ledge's middle) or "top" (at x, a fraction of the width; y: how far down, below a bar at the top,
// past the safe area). Checked on screenshots at 390×844 (docs/art/party/).
export const SPOTS = {
  "home:rider": { edge: "left", y: 0.3 }, // beside the rider, below the title, clear of the pose chips
  "home:resort": { edge: "right", y: 0.56 }, // the map: right edge, under the compass, above the card
  "home:trip": { edge: "right", y: 0.84 }, // the trips list: low on the right, over the tabs' end
  "home:log": { edge: "right", y: 0.4 }, // the log: between the season's numbers and the photo deck
  "resort": { edge: "right", y: 0.5 }, // the resort page: right edge, middle
  "ride:lift": { edge: "top", x: 0.13, y: 0.085 }, // on the lift: under the title pill's left end, clear of the toasts
  "ride:top": { edge: "right", y: 0.62 },
  "ride:pick": { edge: "right", y: 0.36 }, // choosing a run: above the cards and the map pin of me
  "ride:ski": { edge: "right", y: 0.62 }, // skiing: right edge, below the turn cue and the round buttons
  "ride:end": { edge: "left", y: 0.42 }, // at the bottom, the arrival card up: left, above it and the walkie-talkie
};
export function spotFor(page, sub) {
  return SPOTS[`${page}:${sub}`] || SPOTS[page] || (page === "ride" ? SPOTS["ride:ski"] : SPOTS["home:rider"]);
}

// Where someone is, as words: [zh, vars] for i18n's t().
const TAB_ZH = { rider: "选衣服", resort: "看地图", trip: "看行程", log: "翻记录" };
export function statusOf(m) {
  if (!m) return ["", {}];
  if (!m.in) return ["在行程里", {}];
  if (m.page === "home") return ["还在主页 · {what}", { what: TAB_ZH[m.tab] || TAB_ZH.rider }];
  const rn = m.rn || m.resort;
  if (m.page === "resort") return m.ph === "base" ? ["{rn} · 在山脚选缆车", { rn }] : ["{rn} · 看全山", { rn }];
  if (m.ph === "lift") return ["{rn} · 坐 {lift} 上山中", { rn, lift: m.lift || "" }];
  if (m.ph === "top" || m.ph === "pick") return m.lift ? ["{rn} · 在 {lift} 山顶", { rn, lift: m.lift }] : ["{rn} · 在山顶", { rn }];
  if (m.ph === "hike") return ["{rn} · 徒步上山", { rn }];
  if (m.e && m.en) return ["{rn} · 滑向 {to}", { rn, to: m.en }];
  return m.run ? ["{rn} · 在滑 {run}", { rn, run: m.run }] : ["{rn} · 滑行中", { rn }];
}

// Which pet: the capybara for everyone for now. Another animal is the same set of PNGs in assets/party/<name>/
// and one line here (avatar → folder).
export const PETS = { default: "" };
export const petOf = (avatar) => (Object.hasOwn(PETS, avatar) ? PETS[avatar] : PETS.default);
