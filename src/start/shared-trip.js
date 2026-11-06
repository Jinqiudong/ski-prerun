// Shared trips on Supabase (tools/supabase.sql): the RPCs the page may call with the publishable key, who
// "I" am on a trip (a random member id kept on this phone, no accounts), and live updates. After any change
// the page sends a Realtime broadcast "changed" on channel trip:<id>; everyone with the trip open refetches.
// When the socket is down it still refetches on focus and every ~20 s. No DOM work at import, so the pure
// helpers below are tested in node (tests/shared-trip.test.mjs).

export const SB_URL = "https://xiumcnizickbninrmcir.supabase.co";
export const SB_KEY = "sb_publishable_SW-lS3fYKysKOqS0Fm7sSw_rwp-fb1H"; // publishable: safe in the page
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Sections of a trip (and the keys of trip.data they hold, as in the SQL). Flights are each member's own.
export const SECTIONS = { plan: ["days", "maybe", "routes", "meet"], stay: ["stay"], dates: ["name", "from", "to", "passes"], gear: ["gear"], people: [] };

const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { /* private mode */ } return v; };
// This phone's member id: made once, kept for every trip.
export function memberId() {
  let id = store("prerunMember");
  if (!id) { const r = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`; id = store("prerunMember", "m" + r.replace(/-/g, "").slice(0, 24)); }
  return id;
}
// The name friends see (asked once, kept for the next trip).
export const myName = () => store("prerunName") || "";
export const setMyName = (n) => store("prerunName", String(n).trim().slice(0, 20));

// One RPC. Throws an Error with the server's message ("not a member", "not the owner"…) or "offline".
export async function rpc(fn, args) {
  let r;
  try { r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(args) }); }
  catch { throw Object.assign(new Error("offline"), { offline: true }); }
  const text = await r.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) throw new Error(body?.message || `http ${r.status}`);
  return body;
}

const me = () => memberId();
export const api = {
  create: (name, from, look, data) => rpc("create_trip", { p_member: me(), p_name: name, p_from: from || "", p_look: look, p_data: data }),
  get: (id) => rpc("get_trip", { p_id: id }),
  edit: (id, section, patch, summary, note = null) => rpc("edit_trip", { p_id: id, p_member: me(), p_section: section, p_patch: patch, p_summary: summary, p_note: note || null }),
  decide: (id, proposal, accept, reply = null) => rpc("decide_proposal", { p_id: id, p_member: me(), p_proposal: proposal, p_accept: accept, p_reply: reply || null }),
  reply: (id, proposal, text) => rpc("reply_proposal", { p_id: id, p_member: me(), p_proposal: proposal, p_text: text }),
  setOwner: (id, section, who) => rpc("set_owner", { p_id: id, p_member: me(), p_section: section, p_new: who }),
  join: (id, name, from, look, travel = null) => rpc("join_trip", { p_id: id, p_member: me(), p_name: name, p_from: from || "", p_look: look, p_travel: travel }),
  leave: (id, who = null) => rpc("leave_trip", { p_id: id, p_member: me(), p_who: who }),
};

// Who decides a section: its owner, else whoever made the trip. Gear is everyone's.
export const ownerOf = (srv, section) => (section === "gear" ? null : srv?.owners?.[section] || srv?.created_by || null);
export const canEdit = (srv, section, who) => section === "gear" || ownerOf(srv, section) === who;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// The server's trip as the page keeps it (and caches for offline): the plan's keys at the top, as local
// trips have them, the members as people, and the rest under srv.
export function toLocal(s, mine = me()) {
  const d = s?.data || {};
  const from = DATE.test(d.from) ? d.from : new Date().toISOString().slice(0, 10), to = DATE.test(d.to) && d.to >= from ? d.to : from;
  const members = Array.isArray(s.members) ? s.members : [];
  return {
    id: s.id, shared: true, name: String(d.name ?? "").slice(0, 30) || "Ski trip", from, to,
    passes: Array.isArray(d.passes) && d.passes.length ? d.passes : ["ikon"], maybe: Array.isArray(d.maybe) ? d.maybe : [],
    days: d.days && typeof d.days === "object" && !Array.isArray(d.days) ? d.days : {}, stay: d.stay && typeof d.stay === "object" ? d.stay : null,
    gear: Array.isArray(d.gear) ? d.gear.map((g) => String(g).slice(0, 40)) : [],
    people: members.map((m) => ({ id: m.id, name: String(m.name ?? ""), from: /^[A-Z]{3}$/.test(m.from) ? m.from : "", avatar: m.look?.avatar || null, me: m.id === mine })),
    srv: { owners: s.owners || {}, created_by: s.created_by, version: s.version, members, proposals: s.proposals || [], events: s.events || [], synced: Date.now() },
  };
}
// The trip.data a local trip uploads as.
export const toData = (tr) => ({ name: tr.name, from: tr.from, to: tr.to, passes: tr.passes, maybe: tr.maybe || [], days: tr.days && !Array.isArray(tr.days) ? tr.days : {}, stay: tr.stay || null, gear: tr.gear || [] });
export const isMember = (tr, who = me()) => !!tr?.srv?.members?.some((m) => m.id === who);

// The days an open proposal would change, date → proposals, for the "待确认改动" stamp.
export function pendingDays(tr) {
  const out = {};
  for (const p of tr?.srv?.proposals || []) {
    const next = p.patch?.days; if (p.section !== "plan" || !next || typeof next !== "object") continue;
    for (const d of new Set([...Object.keys(next), ...Object.keys(tr.days || {})])) if ((next[d] || null) !== (tr.days?.[d] || null)) (out[d] ||= []).push(p);
  }
  return out;
}
// Which sections have open proposals.
export const pendingSections = (tr) => new Set((tr?.srv?.proposals || []).map((p) => p.section));

// "刚刚" / "3 分钟前"… as [zh, en].
export function ago(at, now = Date.now()) {
  const m = Math.max(0, Math.round((now - new Date(at).getTime()) / 60000));
  if (m < 1) return ["刚刚", "just now"];
  if (m < 60) return [`${m} 分钟前`, `${m} min ago`];
  const h = Math.round(m / 60); if (h < 24) return [`${h} 小时前`, `${h} h ago`];
  const d = Math.round(h / 24); return [`${d} 天前`, `${d} d ago`];
}

// ---- A Realtime broadcast channel on one topic (a raw WebSocket, no library): join, hear broadcasts as
// onMessage(event, payload), broadcast(event, payload). Reconnects every 5 s while open. Riding together
// (src/ride/together.js) uses one per trip and resort; Live below is the trip page's.
const WS = `${SB_URL.replace(/^http/, "ws")}/realtime/v1/websocket?apikey=${SB_KEY}&vsn=1.0.0`;
export class Channel {
  constructor(topic, onMessage, { onJoin = null } = {}) {
    this.name = topic; this.topic = `realtime:${topic}`; this.onMessage = onMessage; this.onJoin = onJoin; this.ref = 1; this.alive = true; this.joined = false;
    this.connect();
  }
  send(event, payload) { this.ws?.readyState === 1 && this.ws.send(JSON.stringify({ topic: event === "heartbeat" ? "phoenix" : this.topic, event, payload, ref: String(this.ref++), join_ref: "1" })); }
  connect() {
    if (!this.alive || typeof WebSocket === "undefined") return;
    let ws; try { ws = this.ws = new WebSocket(WS); } catch { return; }
    ws.onopen = () => {
      this.send("phx_join", { config: { broadcast: { self: false, ack: false }, presence: { key: "" }, postgres_changes: [], private: false } });
      this.beat = setInterval(() => this.send("heartbeat", {}), 25000);
    };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.topic !== this.topic) return;
      if (m.event === "phx_reply" && m.payload?.status === "ok" && !this.joined) { this.joined = true; this.onJoin?.(); }
      if (m.event === "broadcast" && m.payload?.event) this.onMessage(m.payload.event, m.payload.payload);
    };
    ws.onclose = () => { clearInterval(this.beat); this.joined = false; if (this.alive) this.retry = setTimeout(() => this.connect(), 5000); };
    ws.onerror = () => { try { ws.close(); } catch { /* closed */ } };
  }
  // On the socket when it's up (true); false when it isn't (nothing sent).
  broadcast(event, payload) { if (!this.joined) return false; this.send("broadcast", { type: "broadcast", event, payload }); return true; }
  close() { this.alive = false; clearInterval(this.beat); clearTimeout(this.retry); try { this.ws?.close(); } catch { /* closed */ } }
}

// ---- Live: a Realtime socket on trip:<id>, plus refetching on focus and every 20 s.
export class Live extends Channel {
  constructor(id, onChange, { every = 20000 } = {}) {
    super(`trip:${id}`, (event, payload) => { if (event === "changed") onChange("live", payload); });
    this.id = id;
    this.poll = setInterval(() => { if (!document.hidden) onChange("poll"); }, every);
    this.wake = () => { if (!document.hidden) onChange("focus"); };
    addEventListener("focus", this.wake); document.addEventListener("visibilitychange", this.wake);
  }
  // Tell everyone else on the trip to refetch: on the socket if it's up, else through the REST endpoint.
  ping(version = null) {
    const payload = { version, by: me() };
    if (this.broadcast("changed", payload)) return;
    fetch(`${SB_URL}/realtime/v1/api/broadcast`, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ topic: `trip:${this.id}`, event: "changed", payload }] }) }).catch(() => {});
  }
  close() {
    super.close(); clearInterval(this.poll);
    removeEventListener("focus", this.wake); document.removeEventListener("visibilitychange", this.wake);
  }
}
