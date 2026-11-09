// The 对讲机 (walkie-talkie, src/core/voice.js), the parts with no DOM and no WebRTC (tested in node:
// tests/voice.test.mjs): whom to hold a connection with, what a voice message on the channel may hold, when
// someone is speaking (and when their rider holds the radio up), how far the music ducks under it, what went
// wrong asking for the mic, and where the toggle sits on each page.
//
// The voice is one group call for the party (everyone in 一起滑 on the trip), on every page: with the
// 对讲机 on, everyone hears me, whatever the distance, until I turn it off. It lives in the shell
// (index.html, src/core/shell.js), so it never drops when the pages change under it.

const ID = /^[\w-]{4,40}$/, N = /^[\w-]{1,24}$/, AV = /^av_[a-z]+$/;

// PEERS: at most this many others in the mesh. STALE: a member not heard from for this long is gone.
// EVERY: how often my presence goes out. TALK_HOLD: how long a rider keeps the radio up after the voice stops.
export const VOICE = { PEERS: 7, STALE: 15000, EVERY: 3000, TALK_HOLD: 1400 };

// Whom to hold a connection with: members heard from in the last `stale` ms who haven't said bye, at most
// `max`, by id (the same on every phone). list: [{ id, at, gone }]. Everyone is connected, not only those
// talking: listening costs almost nothing, and a voice is heard the moment its 对讲机 goes on.
export function wantPeers(list, now, { stale = VOICE.STALE, max = VOICE.PEERS } = {}) {
  return (Array.isArray(list) ? list : [])
    .filter((f) => f && ID.test(f.id) && !f.gone && now - f.at < stale)
    .map((f) => f.id).sort().slice(0, max);
}
// Of two people, the one who makes the offer (the other answers): the smaller id. Never both at once.
export const offerer = (me, id) => me < id;
// How long to wait before trying a friend again after `fails` failed tries in a row.
export const retryAfter = (fails) => [2000, 5000, 15000, 30000, 60000][Math.min(4, Math.max(0, fails - 1))];

// Messages on the voice channel voice:<trip>:
//   vp  { id, name, av, mic, ask }  my presence, every EVERY ms and when the mic changes; ask: I just came,
//                                   tell me who's here (and the offerer calls me afresh).
//   v   { id, to, k, n, sdp }       to one friend: k "offer" or "answer" (sdp: the whole description, its ICE
//                                   candidates in it; no trickle, so one message each way) or "bye" (hung
//                                   up). n: which try this is, so an answer meets its own offer.
//   bye { id }                      I left the call (left the party, closed the app).
export const SIGNALS = ["offer", "answer", "bye"];
const SDP_MAX = 16000;
// A "v" from the wire, checked: only one meant for me, with a description that looks like one.
export function cleanSignal(p, me) {
  if (!p || typeof p !== "object" || !ID.test(p.id) || p.id === me || p.to !== me || !SIGNALS.includes(p.k) || !N.test(p.n)) return null;
  const s = { id: p.id, to: p.to, k: p.k, n: p.n };
  if (p.k !== "bye") {
    if (typeof p.sdp !== "string" || p.sdp.length > SDP_MAX || !p.sdp.startsWith("v=0") || !/\nm=audio /.test(p.sdp)) return null;
    s.sdp = p.sdp;
  }
  return s;
}
// A "vp" from the wire.
export function cleanVoicePresence(p) {
  if (!p || typeof p !== "object" || !ID.test(p.id)) return null;
  return { id: p.id, name: typeof p.name === "string" ? p.name.slice(0, 20) : "", av: AV.test(p.av) ? p.av : "av_rider", mic: p.mic === true, ask: p.ask === true };
}

// Speaking, from a voice's level (RMS, 0..1) frame by frame: on above ON at once, off after it stays under
// OFF for HOLD ms (so a tag doesn't flicker between words). prev: { on, quiet } or null.
const ON = 0.02, OFF = 0.01, HOLD = 450;
export function speaking(prev, level, now) {
  const s = prev ? { ...prev } : { on: false, quiet: now };
  if (level >= ON) { s.on = true; s.quiet = now; }
  else if (level >= OFF) s.quiet = now;
  else if (s.on && now - s.quiet > HOLD) s.on = false;
  return s;
}
// The rider's radio up while they talk: up at once, down only after `hold` ms of quiet, so it isn't raised
// and lowered between sentences. prev: { on, at } or null.
export function talking(prev, on, now, hold = VOICE.TALK_HOLD) {
  const s = prev ? { ...prev } : { on: false, at: 0 };
  if (on) { s.on = true; s.at = now; }
  else if (s.on && now - s.at > hold) s.on = false;
  return s;
}
// How far to duck the music and the mountain while friends talk (speakers: [{ on, muted }]). My own voice
// doesn't duck anything: with the 对讲机 on all day, the music would pump every time I spoke.
export function duckFor(speakers) {
  return (Array.isArray(speakers) ? speakers : []).some((s) => s?.on && !s.muted) ? 0.6 : 0;
}

// What went wrong asking for the mic (getUserMedia's error), as the kind of hint to show (voice.js HINTS).
export function micProblem(err) {
  const n = err?.name || "";
  if (n === "NotAllowedError" || n === "SecurityError") return "denied";
  if (n === "NotFoundError" || n === "OverconstrainedError") return "none";
  if (n === "NotReadableError" || n === "AbortError") return "busy";
  if (n === "TypeError" || n === "insecure") return "insecure";
  return "other";
}

// Where the 对讲机 sits on each page (party.js tells the shell as the page changes): an edge, and y, the
// button's middle as a fraction of the screen height. Clear of the party pet (party-core.js SPOTS) and of
// each page's own buttons; checked on screenshots at 390×844.
export const MIC_SPOTS = {
  "home:rider": { edge: "right", y: 0.3 },
  "home:resort": { edge: "left", y: 0.56 },
  "home:trip": { edge: "left", y: 0.84 },
  "home:log": { edge: "left", y: 0.4 },
  "resort": { edge: "left", y: 0.5 },
  "ride:lift": { edge: "right", y: 0.44 },
  "ride:top": { edge: "left", y: 0.62 },
  "ride:pick": { edge: "left", y: 0.36 },
  "ride:ski": { edge: "left", y: 0.62 },
  "ride:end": { edge: "right", y: 0.42 },
};
export function micSpot(page, sub) {
  return MIC_SPOTS[`${page}:${sub}`] || MIC_SPOTS[page] || (page === "ride" ? MIC_SPOTS["ride:ski"] : MIC_SPOTS["home:rider"]);
}
