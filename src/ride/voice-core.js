// Voice while riding together, the parts with no DOM and no WebRTC (tested in node: tests/voice.test.mjs):
// how loud a friend is at a distance, whom to hold a connection with and whom to send my voice to, what a
// voice message on the channel may hold, when someone is speaking, and how far the music ducks under it.

const ID = /^[\w-]{4,40}$/, N = /^[\w-]{1,24}$/;

// The falloff, all in one place. Within FULL metres (the same chair, standing together) a friend is as
// loud as on a call; it falls away with the log of the distance, so the next chair (about 33 m) is still
// clear and a friend 100 m off is a murmur; from SILENT on, nothing. RADIO: a walkie-talkie's level,
// whatever the distance. SEND_MARGIN: I keep sending a little past SILENT, so walking apart doesn't cut a
// word in half at the edge.
export const VOICE = { FULL: 8, SILENT: 150, CURVE: 1.6, RADIO: 0.9, SEND_MARGIN: 20, PEERS: 7 };

// How loud a friend's voice is, 0..1. d: metres between us; sameChair: they sit in my chair (always clear,
// whatever the chair's frame says); radio: they hold the walkie-talkie; muted: I muted them.
export function gainAt(d, { sameChair = false, radio = false, muted = false } = {}) {
  if (muted) return 0;
  if (radio) return VOICE.RADIO;
  if (sameChair) return 1;
  if (typeof d !== "number" || !(d >= 0)) return 0; // where they are isn't known
  if (d <= VOICE.FULL) return 1;
  if (d >= VOICE.SILENT) return 0;
  const k = 1 - Math.log(d / VOICE.FULL) / Math.log(VOICE.SILENT / VOICE.FULL);
  return Math.pow(k, VOICE.CURVE);
}

// Do I send my voice to a friend this far away? Only with the mic open (near) or the walkie-talkie held
// (everyone). Far friends get nothing at all, not silence they could turn up.
export function sendTo(d, { mic = false, radio = false, sameChair = false } = {}) {
  if (radio) return true;
  if (!mic) return false;
  return sameChair || (typeof d === "number" && d >= 0 && d < VOICE.SILENT + VOICE.SEND_MARGIN);
}

// Whom to hold a connection with: friends live on the ride channel now (a state, not gone, heard from in
// the last `stale` ms), nearest first, at most `max`. list: [{ id, d (metres, or null), at, gone }].
// Every friend is connected, not only those talking: listening costs almost nothing, and the walkie-talkie
// then speaks at once instead of after a second of setting up.
export function wantPeers(list, now, { stale = 15000, max = VOICE.PEERS } = {}) {
  return (Array.isArray(list) ? list : [])
    .filter((f) => f && ID.test(f.id) && !f.gone && now - f.at < stale)
    .sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9) || (a.id < b.id ? -1 : 1))
    .slice(0, max)
    .map((f) => f.id);
}
// Of two people, the one who makes the offer (the other answers): the smaller id. Never both at once.
export const offerer = (me, id) => me < id;
// How long to wait before trying a friend again after `fails` failed tries in a row.
export const retryAfter = (fails) => [2000, 5000, 15000, 30000, 60000][Math.min(4, Math.max(0, fails - 1))];

// Messages on the ride channel (the same one together.js uses):
//   v   { id, to, k, n, sdp }   to one friend: k "offer" or "answer" (sdp: the whole description, its ICE
//                               candidates in it; no trickle, so one message each way) or "bye" (hung up).
//                               n: which try this is, so an answer meets its own offer.
//   vs  { id, mic, r }          my voice: the mic open, the walkie-talkie held (r). Sent when it changes and,
//                               while r, every second (a lost "let go" mustn't leave a friend's radio up).
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
// A "vs" from the wire.
export function cleanVoiceState(p) {
  if (!p || typeof p !== "object" || !ID.test(p.id)) return null;
  return { id: p.id, mic: p.mic === true, r: p.r === true };
}
// A friend's walkie-talkie is down if they haven't said it's up for this long.
export const RADIO_HOLD = 2500;

// Speaking, from a voice's level (RMS, 0..1) frame by frame: on above ON at once, off after it stays under
// OFF for HOLD ms (so the tag doesn't flicker between words). prev: { on, quiet } or null.
const ON = 0.02, OFF = 0.01, HOLD = 450;
export function speaking(prev, level, now) {
  const s = prev ? { ...prev } : { on: false, quiet: now };
  if (level >= ON) { s.on = true; s.quiet = now; }
  else if (level >= OFF) s.quiet = now;
  else if (s.on && now - s.quiet > HOLD) s.on = false;
  return s;
}
// How far to duck the music and the mountain while someone talks: friends speaking at the gain I hear
// them at, and me on the walkie-talkie. A murmur far off doesn't duck anything.
export function duckFor(speakers, meOnRadio = false) {
  let g = meOnRadio ? 1 : 0;
  for (const s of speakers) if (s.on && s.gain > 0.08) g = Math.max(g, s.gain);
  return g > 0 ? +(0.35 + 0.4 * Math.min(1, g)).toFixed(2) : 0;
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
