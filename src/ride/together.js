// Riding together: friends on the same shared trip, live in the ride. A Realtime broadcast channel per trip
// and resort (ride:<trip>:<resort>, shared-trip.js's Channel; only people who have the trip id can join it)
// carries where each of us is, about 4 times a second while it changes. Friends ride as the rider they
// dressed on the rider page (their look) with a paper name tag; on a lift they sit in a chair. Boarding
// together: the first of us at a lift holds the chair at the loading point while friends are on their way
// (the party opening the same lift, following me, or waiting at its bottom; together-core's comingTo,
// holdLeft), and whoever gets on within the wait sits down in it; the chair swings, a bubble stays up (we see
// each other), and it goes. Riding together, the camera watches us from in front, three quarters on (our faces
// button: behind, the way up). Each rider says their seat (k, and when they took it: kt); together-core's chairSeats settles
// who sits where the same way on every phone, so two riders never share one. Tap the free seat beside you
// to move over. The painted map shows them; "去找他" flies you over the mountain
// to land beside them, "跟随" keeps your route on them; quick messages pop over their tags. Voice (voice.js):
// friends near you are heard where they are, the walkie-talkie reaches everyone; peer to peer, set up on
// the same channel.
// Riding alone, or on a trip that isn't shared: nothing is built and nothing is sent.
// The rules with no DOM (which trip, seats, what a message may hold) are in together-core.js.
// In a party (src/core/party.js), the party picks the trip, and the ride is its hands: where I am for the
// party's presence, 去找他 and 跟着他 here, and the address the party opens the ride with: ?find= (land beside
// them), ?with= (into their chair), ?sync=&host=&crew= (一起坐: everyone in the caller's chair, boarded at
// the same moment, seats by id).
import * as THREE from "three";
import { Channel, memberId, myName } from "../start/shared-trip.js?v=2";
import { t, myAvatar } from "../core/i18n.js?v=41";
import { myRider, boarderModel, disposeBoarder, poseBoarder, sitBoarder, standBoarder, idleBoarder, hikeBoarder, gestureBoarder, talkBoarder } from "../rider/boarder.js?v=11";
import { ymd } from "../start/trip-intro.js?v=1";
import { rideTrip, cleanState, cleanHi, changed, seatsOf, chairToJoin, chairSeats, freeSeat, seatToward, holdLeft, comingTo, HOLD_MAX, whereOf, alongPts, QUICK } from "./together-core.js?v=6";
import { rideVoice } from "./voice.js?v=9";

const MAX = 8, STALE = 15000, NEAR = 150, TAG_FAR = 1000, SEND_EVERY = 250, JOIN_FOR = HOLD_MAX;
const SIT = 900, SETTLE = 2400; // sitting down (ms); the boarding moment before a held chair goes
const LAND = "prerunTogetherLand", TRIP = "prerunRideTrip";
const store = (s, k, v) => { try { if (v === undefined) return s.getItem(k); if (v === null) s.removeItem(k); else s.setItem(k, v); } catch { /* storage off */ } return null; };
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const angle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
const quick = (k) => QUICK.find((q) => q.k === k);

const CSS = `
#tgTags { position: fixed; inset: 0; pointer-events: none; z-index: 3; }
.tgTag { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 5px; padding: 2px 9px 2px 2px; border-radius: 999px; background: rgba(253,251,246,.95); border: 1px solid #cbbfa9; box-shadow: 0 3px 8px rgba(40,30,20,.22); color: #22344d; font: 600 13px "Cormorant Garamond", "Noto Serif SC", serif; white-space: nowrap; pointer-events: auto; cursor: pointer; transition: opacity .8s; will-change: transform; }
.tgTag img { width: 24px; height: 24px; border-radius: 50%; background: #e6ebee; }
.tgTag.far { transform-origin: 50% 100%; font-size: 11px; } .tgTag.far img { width: 18px; height: 18px; }
.tgTag.fade { opacity: 0; pointer-events: none; }
.tgTag::after { content: ""; position: absolute; left: 50%; bottom: -5px; margin-left: -4px; border: 4px solid transparent; border-top-color: #cbbfa9; border-bottom: 0; }
.tgTag .say { position: absolute; left: 50%; bottom: calc(100% + 7px); transform: translateX(-50%); display: flex; align-items: center; gap: 4px; padding: 4px 10px 4px 5px; border-radius: 14px; background: #22344d; color: #fdfbf6; font: 600 13px "Noto Serif SC", serif; animation: tg-pop .3s cubic-bezier(.3,1.5,.5,1); }
.tgTag .say img { width: 22px; height: 22px; background: none; }
.tgTag .say::after { content: ""; position: absolute; left: 50%; top: 100%; margin-left: -5px; border: 5px solid transparent; border-top-color: #22344d; border-bottom: 0; }
#tgToasts { position: fixed; left: 0; right: 0; top: calc(84px + env(safe-area-inset-top)); z-index: 14; display: grid; justify-items: center; gap: 6px; pointer-events: none; }
.tgToast { display: flex; align-items: center; gap: 7px; max-width: 80vw; padding: 5px 14px 5px 5px; border-radius: 999px; background: rgba(253,251,246,.96); color: #22344d; box-shadow: 0 6px 14px rgba(40,30,20,.22); font: 14px "Noto Serif SC", serif; animation: tg-in .35s ease-out; transition: opacity .5s, transform .5s; }
.tgToast img { width: 28px; height: 28px; } .tgToast.out { opacity: 0; transform: translateY(-8px); }
.tgToast b { color: #22344d; }
#tgChip { position: fixed; left: 50%; transform: translateX(-50%); top: calc(80px + env(safe-area-inset-top)); z-index: 13; display: flex; align-items: center; gap: 6px; padding: 4px 6px 4px 4px; border-radius: 999px; background: #22344d; color: #fdfbf6; box-shadow: 0 6px 14px rgba(40,30,20,.25); font: 600 14px "Noto Serif SC", serif; white-space: nowrap; }
#tgChip img { width: 26px; height: 26px; border-radius: 50%; background: #fdfbf6; }
#tgChip button { font: inherit; font-size: 13px; color: #22344d; background: #fdfbf6; border: 0; border-radius: 999px; padding: 3px 10px; cursor: pointer; }
#tgChip[hidden], #tgFab[hidden], #tgQuick[hidden], #tgPop[hidden] { display: none; }
#tgFab { right: 14px; top: calc(208px + env(safe-area-inset-top)); }
#tgFab img { width: 38px; height: 38px; } #tgFab .n { position: absolute; right: -2px; top: -2px; min-width: 18px; height: 18px; border-radius: 9px; background: #b6463b; color: #fdfbf6; font: 600 11px/18px Oswald, sans-serif; text-align: center; border: 2px solid #fdfbf6; }
#tgQuick { position: fixed; right: 84px; top: calc(196px + env(safe-area-inset-top)); z-index: 13; display: grid; gap: 6px; }
#tgQuick button { display: flex; align-items: center; gap: 6px; padding: 4px 14px 4px 4px; border: 1px solid #cbbfa9; border-radius: 999px; background: rgba(253,251,246,.97); color: #22344d; box-shadow: 0 4px 10px rgba(40,30,20,.18); font: 600 14px "Noto Serif SC", serif; cursor: pointer; animation: tg-in .25s ease-out both; }
#tgQuick img { width: 28px; height: 28px; }
#tgPop { position: fixed; z-index: 15; display: grid; gap: 6px; padding: 10px 12px; border-radius: 8px; background: rgba(253,251,246,.98); box-shadow: 0 8px 20px rgba(40,30,20,.25); color: #22344d; font: 14px "Noto Serif SC", serif; min-width: 170px; }
#tgPop b { font: 600 17px "Cormorant Garamond", "Noto Serif SC", serif; } #tgPop small { color: #8a8278; }
#tgPop .two { display: flex; gap: 6px; } #tgPop button { flex: 1; font: inherit; padding: 7px 8px; border-radius: 999px; border: 1px solid #cbbfa9; background: #fdfbf6; color: #22344d; cursor: pointer; }
#tgPop button.go { background: #22344d; border-color: #22344d; color: #fdfbf6; }
#tgSeat { position: fixed; left: 50%; bottom: calc(110px + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 13; display: flex; align-items: center; gap: 8px; padding: 6px 16px 6px 6px; border-radius: 999px; background: rgba(253,251,246,.97); box-shadow: 0 6px 16px rgba(40,30,20,.25); color: #22344d; font: 600 15px "Noto Serif SC", serif; white-space: nowrap; animation: tg-in .4s ease-out; transition: opacity .6s; }
#tgSeat .faces { display: flex; } #tgSeat .faces img { width: 32px; height: 32px; border-radius: 50%; border: 2px solid #fdfbf6; background: #e6ebee; } #tgSeat .faces img + img { margin-left: -10px; }
#tgSeat.out { opacity: 0; }
#tgHold { position: fixed; left: 50%; bottom: calc(110px + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 13; display: flex; align-items: center; gap: 8px; padding: 5px 5px 5px 6px; border-radius: 999px; background: rgba(253,251,246,.97); box-shadow: 0 6px 16px rgba(40,30,20,.25); color: #22344d; font: 600 14px "Noto Serif SC", serif; white-space: nowrap; animation: tg-in .4s ease-out; }
#tgHold .faces img { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #fdfbf6; background: #e6ebee; } #tgHold .faces img + img { margin-left: -10px; }
#tgHold b { font: 600 15px Oswald, sans-serif; color: #8a8278; min-width: 1.6em; text-align: right; }
#tgHold button { font: inherit; font-size: 13px; color: #fdfbf6; background: #22344d; border: 0; border-radius: 999px; padding: 5px 12px; cursor: pointer; }
#tgHold[hidden], .tgSeatGo[hidden], #tgView[hidden] { display: none; }
#tgView { left: 14px; top: calc(208px + env(safe-area-inset-top)); } #tgView .faces { display: flex; } #tgView .faces img { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #fdfbf6; background: #e6ebee; } #tgView .faces img + img { margin-left: -12px; }
.tgSeatGo { position: fixed; left: 0; top: 0; z-index: 4; display: flex; align-items: center; gap: 3px; padding: 3px 8px; border-radius: 999px; border: 1.5px dashed #8a8278; background: rgba(253,251,246,.9); color: #22344d; font: 600 12px "Noto Serif SC", serif; white-space: nowrap; cursor: pointer; box-shadow: 0 3px 8px rgba(40,30,20,.18); will-change: transform; }
.tgSeatGo:active { background: #22344d; color: #fdfbf6; }
#tgFly { position: fixed; inset: 0; z-index: 30; pointer-events: auto; opacity: 0; transition: opacity .35s; background: radial-gradient(ellipse 70% 58% at 50% 48%, rgba(233,237,242,0) 48%, rgba(233,237,242,.6) 78%, rgba(226,232,238,.96) 100%); }
#tgFly.on { opacity: 1; } #tgFly.full { background: #dde3e9; }
#tgFly p { position: absolute; left: 0; right: 0; top: 30vh; margin: 0; text-align: center; color: #22344d; font: 600 22px "Noto Serif SC", serif; letter-spacing: .22em; text-shadow: 0 0 12px #eef2f5, 0 0 4px #fff; }
#tgFly p img { display: block; width: 64px; height: 64px; margin: 0 auto 10px; border-radius: 50%; border: 3px solid #fdfbf6; background: #e6ebee; box-shadow: 0 4px 12px rgba(40,30,20,.2); }
#tgFly small { display: block; margin-top: 6px; font: italic 500 15px "Cormorant Garamond", serif; letter-spacing: .04em; color: #6f685f; }
@keyframes tg-in { from { opacity: 0; transform: translateY(-6px); } }
@keyframes tg-pop { from { opacity: 0; transform: translateX(-50%) scale(.6); } }
`;

// A paper card while the page loads after "去找他" took us to another lift (set by the page we left).
function landingCover() {
  const name = store(sessionStorage, LAND); if (name == null) return;
  store(sessionStorage, LAND, null);
  const el = document.createElement("div"); el.id = "tgFly"; el.className = "on full";
  el.innerHTML = `<p></p>`; el.querySelector("p").textContent = t("去找 {name}…", { name });
  document.body.append(el);
  const t0 = performance.now(), tick = setInterval(() => {
    if (document.getElementById("status") && performance.now() - t0 < 20000) return;
    clearInterval(tick); el.classList.remove("on"); setTimeout(() => el.remove(), 500);
  }, 120);
}

export function rideTogether(api) {
  const none = { frame() {}, mate: () => 0, held: () => false, boarding: () => null, active: false };
  const params = new URLSearchParams(location.search);
  if (params.get("trip")) store(sessionStorage, TRIP, params.get("trip"));
  const party = api.party || null;
  const wanted = store(sessionStorage, TRIP) || party?.trip || null;
  let trips = []; try { trips = JSON.parse(localStorage.getItem("prerunTrips") || "[]"); } catch { /* none */ }
  if (!wanted && !trips.some((tr) => tr?.shared)) return none; // alone: nothing at all
  landingCover();
  const me = memberId(), tripId = rideTrip(trips, ymd(new Date()), api.resort, me, wanted);
  if (!tripId) return none;

  const { scene, camera, T, R, lift, line, ctx, top } = api;
  const trip = trips.find((x) => x.id === tripId);
  const rider = myRider();
  const profile = () => ({ id: me, name: myName() || trip?.people?.find((p) => p.me)?.name || t("朋友"), avatar: myAvatar(), colors: rider.colors, rider: rider.look, stance: rider.stance });
  // A friend's rider: as they say in their "hi", else as the trip has their look.
  const lookOf = (id) => trip?.srv?.members?.find((m) => m.id === id)?.look?.rider || null;
  // Boarding: now, unless the ride was resumed part way up (then not "with" anyone by time).
  const at0 = Number(params.get("at")) || 0, want = params.get("with"), findId = params.get("find");
  // 一起坐 (party.js): boarded at the call's moment, in the caller's chair.
  const sync = Number(params.get("sync")) || 0, host = sync ? params.get("host") : null, crew = (params.get("crew") || "").split(",").filter((x) => /^[\w-]{4,40}$/.test(x));
  const boardAt = sync || Date.now() - (api.trip && at0 === 0 ? 0 : 60000);
  const ownChair = `${me}@${boardAt}`;
  let chairId = host ? `${host}@${sync}` : ownChair, joinedChair = !!host, satWith = new Set(), found = false, pendingFollow = null;
  // My seat: its index in the chair (api.seat().xs) and when I took it. 一起坐: by id among the call's crew,
  // all at the call's moment, so nobody's claims collide.
  const xsOf = () => api.seat().xs, seatIx = () => Math.max(0, xsOf().indexOf(api.seat().x));
  let seat = { k: seatIx(), kt: boardAt };
  if (host) { const k = seatsOf([...new Set([...crew, host, me])].map((id) => ({ id, b: sync })), xsOf().length).get(me); seat = { k, kt: sync }; if (k >= 0) api.setSeat(xsOf()[k], true); }
  const friends = new Map(); // id → friend
  const style = document.createElement("style"); style.textContent = CSS; document.head.append(style);
  const tags = Object.assign(document.createElement("div"), { id: "tgTags" }), toasts = Object.assign(document.createElement("div"), { id: "tgToasts" });
  document.body.append(tags, toasts);

  // ---- The channel
  const ch = new Channel(`ride:${tripId}:${api.resort}`, onMessage, { onJoin: () => ch.broadcast("hi", { ...profile(), ask: true }) });
  addEventListener("pagehide", () => { ch.broadcast("bye", { id: me }); ch.close(); });
  const voice = rideVoice({ ch, me, camera, myPos: (out) => ctx.rider.getWorldPosition(out), talk: (on) => talkBoarder(ctx.rider, on), nameOf: (id) => friends.get(id)?.name || t("朋友") });
  const alive = () => [...friends.values()].filter((f) => f.s && !f.gone && performance.now() - f.at < STALE);
  function friend(id) {
    let f = friends.get(id);
    if (!f) {
      if (friends.size >= MAX * 2) return null;
      f = { id, name: "", avatar: "av_rider", colors: {}, rider: lookOf(id), stance: "regular", s: null, at: 0, gone: 0, asked: 0, disp: null, model: null, frame: null, marker: null, tag: null, said: 0 };
      friends.set(id, f);
    }
    return f;
  }
  const rx = {}, tx = { n: 0, bytes: 0 }; // counts, for testing and the bandwidth note
  function onMessage(ev, p) {
    rx[ev] = (rx[ev] || 0) + 1;
    if (!p || p.id === me) return;
    if (ev === "v" || ev === "vs") { voice.onMessage(ev, p); return; }
    const now = performance.now();
    if (ev === "hi") {
      const h = cleanHi(p); if (!h) return;
      const f = friend(h.id); if (!f) return;
      const fresh = !f.name;
      const look = h.rider || lookOf(h.id) || (Object.keys(h.colors).length ? { preset: "A", colors: h.colors } : null);
      if (JSON.stringify([f.colors, f.rider, f.stance]) !== JSON.stringify([h.colors, look, h.stance])) { Object.assign(f, { colors: h.colors, rider: look, stance: h.stance }); dropModel(f); }
      Object.assign(f, { name: h.name || t("朋友"), avatar: h.avatar });
      if (f.tag) fillTag(f);
      if (h.ask) { ch.broadcast("hi", { ...profile(), ask: false }); last = null; voice.hello(h.id); } // and my state at the next tick
      if (fresh && f.s) toast(f.avatar, t("{name} 也在山上", { name: esc(f.name) }));
    } else if (ev === "s") {
      const s = cleanState(p); if (!s) return;
      const f = friend(s.id); if (!f) return;
      if (!f.name && now - f.asked > 5000) { f.asked = now; ch.broadcast("hi", { ...profile(), ask: true }); }
      const was = f.s;
      f.s = s; f.at = now; f.gone = 0;
      if (!f.disp || !was || was.ph !== s.ph || was.l !== s.l) f.disp = null; // jump, don't glide, to a new place
      if (s.ph === "lift" && s.c === chairId && !satWith.has(f.id) && !top.phase && !api.arrived) sitTogether(f, false);
      offerChair(f);
      if (findId && s.id === findId && !found) { found = true; setTimeout(() => goFind(findId), 400); } // opened to land beside them
      if (pendingFollow === s.id) { pendingFollow = null; startFollow(s.id, true); }
    } else if (ev === "m") {
      const f = friends.get(p.id), q = quick(p.k); if (!f || !q) return;
      say(f, q); toast(q.icon, `<b>${esc(f.name)}</b>：${esc(t(q.zh))}`);
      if (f.model && f.s?.ph === "lift") gestureBoarder(f.model, q.k === "good" || q.k === "meet" ? "point" : "wave"); // on a chair, with a hand too
      if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(30);
    } else if (ev === "bye") {
      const f = friends.get(p.id); if (f) f.gone = now;
      voice.drop(p.id, false);
    }
  }

  // ---- Me, as friends see me
  let last = null, lastAt = 0, tickAt = 0;
  function myState() {
    const ph = top.phase;
    if (!ph && !api.arrived) {
      const s = { id: me, ph: "lift", l: lift.name, d: +api.d.toFixed(1), v: held ? 0 : +api.speed().toFixed(2), b: boardAt, c: chairId };
      if (seat.k >= 0) { s.k = seat.k; s.kt = seat.kt; }
      if (held) s.hd = 1;
      return s;
    }
    const r = ctx.rider.position, L = top.live?.() || {}, P = L.phys;
    if (ph === "ski") {
      const s = { id: me, ph: "ski", x: +(P ? P.x : r.x).toFixed(1), z: +(P ? P.z : r.z).toFixed(1), h: +(P ? P.heading : ctx.rider.rotation.y).toFixed(2), sp: +(P?.speed || 0).toFixed(1), ln: +(P?.lean || 0).toFixed(2), run: L.run, w: L.wait };
      if (L.dest) { s.e = [Math.round(L.dest.x), Math.round(L.dest.z)]; s.en = L.dest.name; }
      return s;
    }
    if (ph === "hike") return { id: me, ph: "hike", x: +r.x.toFixed(1), z: +r.z.toFixed(1), h: +ctx.rider.rotation.y.toFixed(2) };
    return { id: me, ph: "top", l: lift.name, x: +r.x.toFixed(1), z: +r.z.toFixed(1), h: +ctx.rider.rotation.y.toFixed(2) };
  }
  function send(now) {
    if (now - tickAt < SEND_EVERY || document.hidden || !ch.joined) return;
    tickAt = now;
    if (!alive().length && !friends.size) return; // nobody else here: nothing to send
    const s = myState();
    if (!changed(last, s, now - lastAt)) return;
    if (ch.broadcast("s", s)) { last = s; lastAt = now; tx.n++; tx.bytes += JSON.stringify(s).length; }
  }

  // ---- Same chair
  const seatInfo = () => api.seat();
  // Everyone in chair c, with the seat each says they took (me: mine, while I'm in it).
  function chairMembers(c) {
    const list = alive().filter((f) => f.s.ph === "lift" && f.s.c === c).map((f) => ({ id: f.id, k: f.s.k, kt: f.s.kt }));
    if (chairId === c && !top.phase && !api.arrived) list.push({ id: me, k: seat.k, kt: seat.kt });
    return list;
  }
  const seatsIn = (c) => chairSeats(chairMembers(c), xsOf().length);
  const extrapD = (f, now = performance.now()) => Math.min(line.total, f.s.d + (f.s.v * (now - f.at)) / 1000);
  // Into chair c (a friend's): the first free seat, else the chair behind. Returns true if I sat down in it.
  function takeSeat(f, c, d) {
    const k = freeSeat(chairSeats(chairMembers(c).filter((m) => m.id !== me), xsOf().length), xsOf().length);
    if (k < 0) { chairId = ownChair; seat = { k: 1 % xsOf().length, kt: Date.now() }; api.setSeat(xsOf()[seat.k], true); api.d = Math.max(api.d0, d - api.step()); toast(f.avatar, t("坐 {name} 后面那把", { name: esc(f.name) })); last = null; return false; }
    chairId = c; seat = { k, kt: Date.now() }; api.d = d; api.setSeat(xsOf()[k], true);
    stopHold(); sitTogether(f, true); last = null;
    return true;
  }
  function tryJoin(now) {
    if (joinedChair || top.phase || api.arrived || (!want && Date.now() - boardAt > JOIN_FOR)) return;
    const states = alive().map((f) => f.s), target = chairToJoin({ id: me, lift: lift.name, b: boardAt }, states, { want });
    if (!target) return;
    joinedChair = true;
    const f = friends.get(target.id);
    takeSeat(f, target.c, extrapD(f, now));
  }
  // My seat as every phone sees it: if a friend's earlier claim has it, the free one nearest; full, the chair
  // behind. A seat I'm moved to is a new claim.
  function settleSeat() {
    if (top.phase || api.arrived) return;
    const r = seatsIn(chairId).get(me);
    if (r === seat.k) return;
    if (r >= 0) { seat = { k: r, kt: Date.now() }; api.setSeat(xsOf()[r]); last = null; return; }
    chairId = ownChair; seat = { k: 1 % xsOf().length, kt: Date.now() }; api.setSeat(xsOf()[seat.k], true); api.d = Math.max(api.d0, api.d - api.step()); last = null;
    toast("lift", t("这把坐满了，坐后面那把"));
  }
  // Move over to seat k, if it's free; the others see it at the next state (sent at once).
  function moveTo(k) {
    if (top.phase || api.arrived || k < 0 || k >= xsOf().length || [...seatsIn(chairId)].some(([id, s]) => id !== me && s === k)) return false;
    seat = { k, kt: Date.now() }; api.setSeat(xsOf()[k]); last = null; tickAt = 0;
    return true;
  }
  // Riding in a friend's chair: their chair's speed is ours; jump away (skip, seek) and you leave it.
  function keepChair(dt) {
    if (chairId === ownChair || top.phase || api.arrived) return;
    const owner = friends.get(chairId.split("@")[0]);
    if (!owner?.s || owner.s.ph !== "lift" || owner.s.c !== chairId || owner.gone) return;
    const want = extrapD(owner), diff = want - api.d;
    if (Math.abs(diff) > 25) { chairId = ownChair; seat = { k: 1 % xsOf().length, kt: Date.now() }; api.setSeat(xsOf()[seat.k]); last = null; return; }
    api.d += diff * Math.min(1, dt * 3);
  }
  // The boarding moment: whoever just got on sits down (me: I got into their chair), the chair swings with
  // the weight, the bubble up, hello.
  let meSitAt = -1e9, swingAt = -1e9, settleUntil = 0;
  function sitTogether(f, mine) {
    const now = performance.now();
    satWith.add(f.id);
    if (mine) meSitAt = now; else f.sitAt = now;
    swingAt = now; settleUntil = now + SETTLE;
    if (seatInfo().bubble) api.setBubble(true); // riding with friends the bubble stays up, so we see each other
    setTimeout(() => { gestureBoarder(ctx.rider, "wave"); if (f.model) gestureBoarder(f.model, "wave"); }, SIT + 150); // hello
    const box = document.createElement("div"); box.id = "tgSeat";
    box.innerHTML = `<span class="faces"><img src="assets/icons/${myAvatar()}.png?v=1" alt=""><img src="assets/icons/${f.avatar}.png?v=1" alt=""></span><span translate="no"></span>`;
    box.lastChild.textContent = t("和 {name} 一起坐 {lift}", { name: f.name || t("朋友"), lift: lift.name });
    document.getElementById("tgSeat")?.remove(); document.body.append(box);
    if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([30, 40, 30]);
    setTimeout(() => box.classList.add("out"), 3600); setTimeout(() => box.remove(), 4300);
  }
  // For the ride, each frame on the chair: how far the chair swings (radians about its cross bar) and, while
  // I sit down, how far I still stand (1 standing … 0 seated; null: seated).
  function boarding(now = performance.now()) {
    const ts = (now - swingAt) / 1000, tm = (now - meSitAt) / SIT;
    const swing = ts >= 0 && ts < 4 ? 0.11 * Math.exp(-ts / 1.1) * Math.sin(ts * Math.PI * 2 / 1.7) : 0;
    // face: worth watching from in front (someone on their way, getting on, or asked for); with: a friend in my chair
    return { swing, stand: tm >= 0 && tm < 1 ? 1 - tm : null, face: waiting || now < settleUntil || (shared && !camBack), with: shared };
  }

  // ---- Boarding together: the first at the lift waits at the loading point for friends on their way
  // (fresh rides only: not resumed, not joining someone, not a 一起坐 call), up to HOLD (HOLD_MAX while a
  // page opens), or until "先走". Two seconds at the loading point first, to hear who is around (the channel joins, friends answer).
  let holding = api.trip && at0 === 0 && !sync && !want && !findId, held = false, waiting = false;
  const listenFor = 2500, holdBox = document.createElement("div"); holdBox.id = "tgHold"; holdBox.hidden = true;
  holdBox.innerHTML = `<span class="faces"></span><span translate="no"></span><b></b><button>${t("先走")}</button>`;
  holdBox.querySelector("button").onclick = () => stopHold();
  document.body.append(holdBox);
  function stopHold() { holding = false; waiting = false; holdBox.hidden = true; if (held) { held = false; last = null; } }
  function stepHold(now) {
    if (!holding) return;
    if (top.phase || api.arrived || chairId !== ownChair || api.d > api.d0 + 3) { if (now >= settleUntil) stopHold(); return; }
    const wall = Date.now(), members = party?.members?.() || [];
    const coming = comingTo({ id: me, lift: lift.name, resort: api.resort, b: boardAt, c: chairId, d0: api.d0 }, members, alive().map((f) => f.s));
    const left = holdLeft(boardAt, wall, coming), listening = wall - boardAt < listenFor;
    const was = held;
    held = left > 0 || now < settleUntil || listening;
    if (held !== was) last = null;
    if (!held) { stopHold(); return; }
    // The card: who we wait for and how long, once someone is coming.
    waiting = coming.length > 0;
    if (!waiting) { holdBox.hidden = true; return; }
    const who = coming.map((c) => friends.get(c.id) || members.find((m) => m.id === c.id)).filter(Boolean);
    const key = who.map((w) => w.id).join();
    if (holdBox.dataset.k !== key) {
      holdBox.dataset.k = key;
      holdBox.querySelector(".faces").innerHTML = who.slice(0, 3).map((w) => `<img src="assets/icons/${w.avatar || w.av || "av_rider"}.png?v=1" alt="">`).join("");
      holdBox.querySelector("span[translate]").textContent = t("等 {name} 一起上", { name: who.map((w) => w.name || t("朋友")).join("、") });
    }
    holdBox.querySelector("b").textContent = `${Math.ceil(left / 1000)}`;
    holdBox.hidden = now < settleUntil;
  }

  // ---- Changing seats: the free seat on each side of me, as a tag on the seat itself. Only with a friend in
  // my chair (riding alone, nothing changes).
  const seatGo = [-1, 1].map((dir) => {
    const b = document.createElement("button"); b.className = "tgSeatGo"; b.hidden = true; b.dataset.dir = dir;
    b.textContent = t("坐这"); // on the empty seat itself (the nearest free one on each side of me)
    b.onclick = (e) => { e.stopPropagation(); if (moveTo(+b.dataset.k)) navigator.vibrate?.(15); };
    b.addEventListener("pointerdown", (e) => e.stopPropagation());
    document.body.append(b);
    return b;
  });
  const sv = new THREE.Vector3();
  // Sharing my chair: the ride watches us from in front, three quarters on (it reads boarding()); a button
  // with our two faces turns the camera back behind the chair, to see the way up, and round again.
  let shared = false, camBack = false;
  const viewBtn = document.createElement("button"); viewBtn.id = "tgView"; viewBtn.className = "rfab"; viewBtn.hidden = true; viewBtn.setAttribute("aria-label", t("看我们"));
  viewBtn.innerHTML = `<span class="faces"><img alt=""><img alt=""></span>`;
  viewBtn.onclick = (e) => { e.stopPropagation(); camBack = !camBack; viewBtn.classList.toggle("on", !camBack); };
  viewBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  document.body.append(viewBtn);
  function stepSeatGo(now) {
    const seats = !top.phase && !api.arrived && !held && now - meSitAt > SIT ? seatsIn(chairId) : null;
    const mates = seats ? [...seats].filter(([id, k]) => id !== me && k >= 0).map(([id]) => friends.get(id)).filter(Boolean) : [];
    shared = mates.length > 0;
    viewBtn.hidden = !shared || !!seatInfo().cabin;
    viewBtn.classList.toggle("on", shared && !camBack);
    if (shared) for (const [img, av] of [[viewBtn.querySelectorAll("img")[0], myAvatar()], [viewBtn.querySelectorAll("img")[1], mates[0].avatar]]) if (img.dataset.av !== av) { img.dataset.av = av; img.src = `assets/icons/${av}.png?v=1`; }
    for (const b of seatGo) {
      const k = shared ? seatToward(seats, xsOf().length, seat.k, +b.dataset.dir) : -1;
      b.hidden = k < 0; if (k < 0) continue;
      b.dataset.k = k;
      sv.set(xsOf()[k], seatInfo().top + 0.12, seatInfo().z); api.chair().localToWorld(sv); sv.project(camera);
      if (sv.z > 1 || Math.abs(sv.x) > 1 || Math.abs(sv.y) > 1) { b.hidden = true; continue; }
      b.style.transform = `translate(${Math.round((sv.x * 0.5 + 0.5) * innerWidth - b.offsetWidth / 2)}px, ${Math.round((-sv.y * 0.5 + 0.5) * innerHeight - b.offsetHeight / 2)}px)`;
    }
  }

  // Waiting at the bottom of a lift a friend just got on: "ride with them" (into their chair).
  const offered = new Set();
  function offerChair(f) {
    const w = top.live?.()?.wait;
    if (!w || f.s.ph !== "lift" || f.s.l !== w || offered.has(f.id) || f.s.d > line.total * 0.5) return;
    const row = document.getElementById("arriveRow"); if (!row || document.getElementById("arrive").hidden) return;
    offered.add(f.id);
    const a = document.createElement("a"); a.className = "btn go"; a.href = api.withResort(`look.html?lift=${encodeURIComponent(w)}&with=${encodeURIComponent(f.id)}`);
    a.textContent = t("和 {name} 一起坐 {lift} ›", { name: f.name, lift: w });
    row.prepend(a);
    toast(f.avatar, f.s.hd ? t("{name} 在 {lift} 等你一起坐", { name: esc(f.name), lift: esc(w) }) : t("{name} 坐上了 {lift}", { name: esc(f.name), lift: esc(w) }));
  }

  // ---- Friends in 3D
  const v = new THREE.Vector3(), v2 = new THREE.Vector3(), nrm = new THREE.Vector3();
  const markerGeo = [new THREE.ConeGeometry(1.1, 3.2, 10).rotateX(Math.PI).translate(0, 1.6, 0), new THREE.SphereGeometry(1.25, 14, 10).translate(0, 3.6, 0)];
  const paths = new Map();
  // A lift's rope as points every few metres: the ride's own line for this lift, else from its map line.
  function liftPath(name) {
    if (name === lift.name) return { up: line.up, step: 2, total: line.total };
    if (paths.has(name)) return paths.get(name);
    const L = R.lifts.find((l) => l.name === name);
    let out = null;
    if (L && L.pts.length > 1) {
      let total = 0; for (let i = 1; i < L.pts.length; i++) total += Math.hypot(L.pts[i][0] - L.pts[i - 1][0], L.pts[i][1] - L.pts[i - 1][1]);
      const up = [];
      for (let s = 0; s <= total; s += 4) { const p = alongPts(L.pts, s), side = 2.6; up.push(new THREE.Vector3(p.x + Math.cos(p.h) * side, T.heightAt(p.x, p.z) + 11.5, p.z - Math.sin(p.h) * side)); }
      out = { up, step: 4, total };
    }
    paths.set(name, out);
    return out;
  }
  const at = (P, d, out) => { const f = Math.max(0, Math.min(P.up.length - 1.001, d / P.step)), i = Math.floor(f); return out.copy(P.up[i]).lerp(P.up[i + 1] || P.up[i], f - i); };
  function chairMeshes(frame) {
    for (const o of api.chair().children) if (o.isMesh) { const m = new THREE.Mesh(o.geometry, o.material); m.castShadow = true; frame.add(m); }
  }
  function ensure(f) {
    if (!f.frame) { f.frame = new THREE.Group(); chairMeshes(f.frame); f.frame.visible = false; scene.add(f.frame); }
    if (!f.marker) {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(f.colors.jacket || "#525a42") }), head = new THREE.MeshBasicMaterial({ color: 0xfdfbf6 });
      f.marker = new THREE.Group(); f.marker.add(new THREE.Mesh(markerGeo[0], mat), new THREE.Mesh(markerGeo[1], head)); f.marker.visible = false; scene.add(f.marker);
    }
    if (!f.tag) { f.tag = document.createElement("button"); f.tag.className = "tgTag"; f.tag.onclick = () => openPop(f); tags.append(f.tag); fillTag(f); }
  }
  function fillTag(f) { f.tag.innerHTML = `<img src="assets/icons/${f.avatar}.png?v=1" alt=""><span translate="no"></span>`; f.tag.querySelector("span").textContent = f.name || "…"; f.sayEl = null; f.vcKey = null; f.spkIcon = null; }
  // Voice on a tag: a ring while they speak, "对讲中" while their walkie-talkie is up, "已静音" if I muted them.
  function voiceTag(f) {
    const vs = voice.stateOf(f.id), key = vs.muted ? "已静音" : vs.radio ? "对讲中" : "";
    f.tag.classList.toggle("talk", vs.speaking && !vs.radio); f.tag.classList.toggle("radio", vs.radio && !vs.muted); f.tag.classList.toggle("muted", vs.muted);
    const spk = vs.speaking && !vs.muted ? (vs.radio ? "voice_radio" : "voice_speaking") : vs.muted ? "voice_mic_off" : "";
    if (spk !== f.spkIcon) {
      f.spkIcon = spk; f.tag.querySelector(".spk")?.remove();
      if (spk) { const i = document.createElement("img"); i.className = "spk"; i.alt = ""; i.src = `assets/icons/${spk}.png?v=1`; f.tag.querySelector("span").after(i); }
    }
    if (key === f.vcKey) return;
    f.vcKey = key; f.tag.querySelector(".vc")?.remove();
    if (key) { const b = document.createElement("span"); b.className = "vc"; b.textContent = t(key); f.tag.querySelector("span").after(b); }
  }
  // Their rider, dressed from their look: null until it's made (the template's light file loads once, the
  // first time anyone wears it).
  function model(f) {
    if (!f.model && !f.making) {
      const making = (f.making = boarderModel({ rider: f.rider, stance: f.stance }).then((m) => {
        if (f.making !== making) { disposeBoarder(m); return; } // their look changed meanwhile
        f.making = null; f.model = m; m.visible = false; scene.add(m);
        m.traverse((o) => { if (o.isMesh) o.frustumCulled = true; });
      }, (e) => { console.warn(e); }));
    }
    return f.model;
  }
  function dropModel(f) {
    f.making = null;
    if (f.marker) f.marker.children[0].material.color.set(f.colors.jacket || "#525a42");
    if (!f.model) return;
    disposeBoarder(f.model);
    f.model = null;
  }
  function hide(f) {
    if (f.model) f.model.visible = false; if (f.frame) f.frame.visible = false; if (f.marker) f.marker.visible = false;
    if (f.tag) f.tag.classList.add("fade");
  }
  // Where a friend is now (smoothed toward their last state, carried on by their speed). Sets f.pos (world,
  // their feet or seat), f.mapXZ, and how to pose them.
  function place(f, now, dt) {
    const s = f.s, age = Math.min(1.5, (now - f.at) / 1000);
    if (s.ph === "lift") {
      const P = liftPath(s.l); if (!P) return false;
      const target = Math.min(P.total, s.d + s.v * age);
      if (!f.disp || f.disp.ph !== "lift" || Math.abs(f.disp.d - target) > 40) f.disp = { ph: "lift", d: target };
      else f.disp.d += (target - f.disp.d) * Math.min(1, dt * 6);
      const meOnLift = !top.phase && !api.arrived && s.l === lift.name, step = api.step();
      let d = f.disp.d, inMine = false, pool = false;
      if (meOnLift) { // seat them in one of the chairs I see on the line (or mine)
        let k = Math.round((d - api.d) / step);
        inMine = s.c === chairId;
        if (!inMine && k === 0) k = d >= api.d ? 1 : -1;
        if (inMine) k = 0;
        d = api.d + k * step; pool = !inMine;
      }
      const xs = xsOf(), k = Math.max(0, seatsIn(s.c).get(f.id) ?? 1);
      const frame = inMine ? api.chair() : f.frame;
      if (!inMine) {
        at(P, d, v); at(P, d + 4, v2);
        frame.position.copy(v); frame.rotation.set(0, Math.atan2(v2.x - v.x, v2.z - v.z), 0);
        for (const m of frame.children) if (m.isMesh) m.visible = !pool; // a pool chair is already there
        frame.visible = true;
      } else f.frame.visible = false;
      // Their own seat, sliding over when they change seats. In my chair they turn to me to talk (+1: I'm
      // on their left, +x).
      const x = xs[Math.min(k, xs.length - 1)];
      f.seatX = f.seatX == null || f.seatFrame !== frame ? x : f.seatX + (x - f.seatX) * Math.min(1, dt * 5); f.seatFrame = frame;
      f.pose = { kind: "lift", frame, seat: new THREE.Vector3(f.seatX, api.seat().top - 0.595, api.seat().z), talk: inMine ? Math.sign(api.seat().x - x) : 0 };
      f.inMine = inMine;
      frame.updateMatrixWorld(true);
      f.pos = frame.localToWorld(f.pose.seat.clone());
      f.mapXZ = [f.pos.x, f.pos.z];
      return true;
    }
    if (f.frame) f.frame.visible = false;
    f.inMine = false;
    const tx = s.x + (s.ph === "ski" ? Math.sin(s.h) * s.sp * Math.min(age, 0.6) : 0), tz = s.z + (s.ph === "ski" ? Math.cos(s.h) * s.sp * Math.min(age, 0.6) : 0);
    if (!f.disp || f.disp.ph !== s.ph || Math.hypot(f.disp.x - tx, f.disp.z - tz) > 40) f.disp = { ph: s.ph, x: tx, z: tz, h: s.h };
    else { const k = Math.min(1, dt * 8); f.disp.x += (tx - f.disp.x) * k; f.disp.z += (tz - f.disp.z) * k; f.disp.h = angle(f.disp.h, s.h, k); }
    f.pos = (f.pos || new THREE.Vector3()).set(f.disp.x, T.heightAt(f.disp.x, f.disp.z), f.disp.z);
    f.mapXZ = [f.disp.x, f.disp.z];
    f.pose = { kind: s.ph };
    return true;
  }
  function pose(f, dt, now) {
    const m = model(f), p = f.pose;
    if (!m) return false;
    talkBoarder(m, voice.radioOf(f.id)); // the walkie-talkie up
    if (p.kind === "lift") {
      if (m.parent !== p.frame) p.frame.add(m);
      m.position.copy(p.seat); m.quaternion.identity();
      if (f.sitAt && now - f.sitAt < SIT) standBoarder(m, 1 - ease((now - f.sitAt) / SIT)); // sitting down: standing, then the exit clip's first moment, then seated
      else sitBoarder(m, Math.sin(now / 2600 + f.id.length) * 0.5, undefined, p.talk);
      return true;
    }
    if (m.parent !== scene) scene.add(m);
    const d = f.disp;
    if (p.kind === "ski") {
      poseBoarder(m, { x: d.x, y: f.pos.y, z: d.z, n: T.normalAt(d.x, d.z, nrm), heading: d.h, lean: f.s.ln, speed: f.s.sp, skid: f.s.sp < 1 ? 0.3 : 0, tuck: 0, dt });
    } else {
      m.position.copy(f.pos); m.quaternion.identity(); m.rotation.set(0, d.h, 0);
      if (p.kind === "hike") hikeBoarder(m, now / 900); else idleBoarder(m);
    }
    return true;
  }

  // ---- Tags, bubbles, toasts
  function project(f, picking) {
    const el = f.tag; if (!el) return;
    if (picking || !f.pos) { el.style.display = "none"; return; }
    v.copy(f.pos); v.y += f.pose?.kind === "lift" ? 1.75 : 2.2;
    const dist = camera.position.distanceTo(v);
    v.project(camera);
    const on = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && dist < TAG_FAR;
    el.style.display = on ? "" : "none"; if (!on) return;
    el.classList.toggle("far", dist > NEAR);
    const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
    el.style.transform = `translate(${Math.round(x - el.offsetWidth / 2)}px, ${Math.round(y - el.offsetHeight - 6)}px)`;
  }
  function say(f, q) {
    if (!f.tag) return;
    f.sayEl?.remove();
    const b = document.createElement("span"); b.className = "say";
    b.innerHTML = `<img src="assets/icons/${q.icon}.png?v=1" alt=""><span></span>`; b.lastChild.textContent = t(q.zh);
    f.tag.append(b); f.sayEl = b;
    clearTimeout(f.sayT); f.sayT = setTimeout(() => { b.remove(); if (f.sayEl === b) f.sayEl = null; }, 5000);
  }
  function toast(icon, html) {
    const el = document.createElement("div"); el.className = "tgToast";
    el.innerHTML = `<img src="assets/icons/${icon}.png?v=1" alt=""><span></span>`;
    el.lastChild.innerHTML = html; // callers escape names
    toasts.append(el);
    while (toasts.children.length > 3) toasts.firstChild.remove();
    setTimeout(() => el.classList.add("out"), 4200); setTimeout(() => el.remove(), 4800);
  }

  // ---- Quick messages: a button with the chips
  const fab = document.createElement("button"); fab.id = "tgFab"; fab.className = "rfab"; fab.hidden = true; fab.setAttribute("aria-label", t("传话"));
  fab.innerHTML = `<img src="assets/icons/msg_chat.png?v=1" alt=""><span class="n"></span>`;
  const qbox = document.createElement("div"); qbox.id = "tgQuick"; qbox.hidden = true;
  qbox.innerHTML = QUICK.map((q, i) => `<button data-k="${q.k}" style="animation-delay:${i * 30}ms"><img src="assets/icons/${q.icon}.png?v=1" alt=""><span>${t(q.zh)}</span></button>`).join("");
  document.body.append(fab, qbox);
  fab.onclick = (e) => { e.stopPropagation(); qbox.hidden = !qbox.hidden; fab.classList.toggle("on", !qbox.hidden); };
  for (const b of qbox.querySelectorAll("button")) b.onclick = (e) => {
    e.stopPropagation(); const q = quick(b.dataset.k);
    ch.broadcast("m", { id: me, k: q.k });
    toast(q.icon, t("已发送：{msg}", { msg: esc(t(q.zh)) }));
    qbox.hidden = true; fab.classList.remove("on");
  };

  // ---- A friend's card (tap their tag): go to them, follow them
  const pop = document.createElement("div"); pop.id = "tgPop"; pop.hidden = true; document.body.append(pop);
  addEventListener("pointerdown", (e) => { if (!pop.hidden && !pop.contains(e.target) && !e.target.closest(".tgTag")) pop.hidden = true; if (!qbox.hidden && !qbox.contains(e.target) && e.target !== fab && !fab.contains(e.target)) { qbox.hidden = true; fab.classList.remove("on"); } });
  const whereText = (f) => { const w = whereOf(f.s); return w ? t(w[0], w[1]) : ""; };
  function openPop(f) {
    const muted = voice.stateOf(f.id).muted;
    pop.innerHTML = `<b translate="no"></b><small></small><div class="two"><button class="go" data-k="find">${t("去找他 ›")}</button><button data-k="follow">${follow?.id === f.id ? t("取消") : t("跟随")}</button></div><div class="two"><button data-k="mute">${muted ? t("取消静音") : t("静音")}</button></div>`;
    pop.querySelector("b").textContent = f.name; pop.querySelector("small").textContent = whereText(f);
    pop.querySelector("[data-k=find]").onclick = () => { pop.hidden = true; goFind(f.id); };
    pop.querySelector("[data-k=follow]").onclick = () => { pop.hidden = true; if (follow?.id === f.id) stopFollow(); else startFollow(f.id); };
    pop.querySelector("[data-k=mute]").onclick = () => { pop.hidden = true; voice.mute(f.id, !muted); toast(f.avatar, t(muted ? "能听到 {name} 了" : "已静音 {name}", { name: esc(f.name) })); };
    pop.hidden = false;
    const r = f.tag.getBoundingClientRect(), w = pop.offsetWidth;
    pop.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    pop.style.top = `${r.top > 170 ? r.top - pop.offsetHeight - 10 : r.bottom + 10}px`;
  }

  // ---- Follow
  let follow = null;
  const chip = document.createElement("div"); chip.id = "tgChip"; chip.hidden = true; document.body.append(chip);
  function startFollow(id, fromParty = false) {
    if (!fromParty && party?.in) { party.setFollow(id); return; } // the party keeps it, and calls back
    const f = friends.get(id); if (!f) { pendingFollow = id; return; }
    if (follow?.id === id) return;
    follow = { id, at: -1e9, planned: -1e9, to: null };
    chip.innerHTML = `<img src="assets/icons/${f.avatar}.png?v=1" alt=""><span translate="no"></span><button>${t("取消")}</button>`;
    chip.querySelector("span").textContent = t("跟着 {name}", { name: f.name });
    chip.querySelector("button").onclick = () => stopFollow();
    chip.hidden = false;
    top.pmap?.close();
    if (top.phase !== "ski") toast(f.avatar, t("滑起来就跟着 {name} 走", { name: esc(f.name) }));
  }
  function stopFollow(fromParty = false) { pendingFollow = null; if (!fromParty && party?.in && party.fol) { party.setFollow(null); return; } follow = null; chip.hidden = true; }
  function stepFollow(now) {
    if (!follow || now - follow.at < 1000) return;
    const f = friends.get(follow.id);
    if (!f?.s || f.gone || now - f.at > STALE) { // off the slopes: the party (if any) keeps following them, from page to page
      if (!party?.fol) toast(f?.avatar || "rider", t("{name} 不在线了，不跟了", { name: esc(f?.name || "") }));
      follow = null; chip.hidden = true; if (party?.fol) pendingFollow = f?.id || null; return;
    }
    if (top.phase !== "ski" || !top.live().phys) return;
    const P = top.live().phys, onLift = f.s.ph === "lift";
    const target = onLift ? { lift: f.s.l } : { x: f.mapXZ?.[0] ?? f.s.x, z: f.mapXZ?.[1] ?? f.s.z };
    const close = !onLift && Math.hypot(P.x - target.x, P.z - target.z) < 35;
    const moved = !follow.to || (onLift ? follow.to.lift !== target.lift : follow.to.lift || Math.hypot(follow.to.x - target.x, follow.to.z - target.z) > 90);
    follow.at = now;
    if (close || !moved || now - follow.planned < 8000) return;
    follow.planned = now; follow.to = target;
    const Q = top.routeTo({ ...target, name: f.name, note: onLift ? t("{name} 在 {lift} 上，去底站", { name: esc(f.name), lift: esc(f.s.l) }) : t("跟着 {name}，重新规划", { name: esc(f.name) }) });
    const far = onLift || Math.hypot(P.x - target.x, P.z - target.z) > 300; // close by, the way is the one you're on
    if (!Q && far && !follow.warned) { follow.warned = true; toast(f.avatar, t("找不到去 {name} 那儿的路", { name: esc(f.name) })); }
  }

  // ---- Go to them: up over the mountain on an arc, the paper closing in at the edges, land beside them.
  let fly = null, lastLand = null;
  function goFind(id) {
    const f = friends.get(id); if (!f?.s || fly) return;
    top.pmap?.close();
    const el = document.createElement("div"); el.id = "tgFly";
    el.innerHTML = `<p><img src="assets/icons/${f.avatar}.png?v=1" alt=""><span translate="no"></span><small></small></p>`;
    el.querySelector("span").textContent = t("去找 {name}…", { name: f.name }); el.querySelector("small").textContent = whereText(f);
    document.body.append(el); requestAnimationFrame(() => el.classList.add("on"));
    ch.broadcast("m", { id: me, k: "coming" });
    const picking = top.phase === "pick" || top.phase === "rise" || top.phase === "dive";
    const look0 = new THREE.Vector3(0, 0, -30).applyQuaternion(camera.quaternion).add(camera.position);
    fly = { f, el, t0: performance.now(), dur: picking ? 1300 : 2600, p0: camera.position.clone(), look0, landed: false, plain: picking || !f.pos };
  }
  function stepFly(now) {
    const { f } = fly, u = Math.min(1, (now - fly.t0) / fly.dur);
    if (!fly.plain && f.pos) {
      const to = f.pos.clone(), h = f.disp?.h ?? 0;
      const p1 = to.clone().add(new THREE.Vector3(-Math.sin(h) * 9, 4.5, -Math.cos(h) * 9));
      const L = fly.p0.distanceTo(p1), mid = fly.p0.clone().lerp(p1, 0.5); mid.y = Math.max(fly.p0.y, p1.y) + 60 + L * 0.35;
      const e = ease(u), a = fly.p0.clone().lerp(mid, e), b = mid.clone().lerp(p1, e);
      camera.position.copy(a.lerp(b, e));
      const look = fly.look0.clone().lerp(to, Math.min(1, e * 1.4)); if (u < 0.5) look.y -= Math.sin(u * Math.PI) * 40;
      camera.lookAt(look);
    }
    if (u >= 0.92 && !fly.landed) { fly.landed = true; land(f); }
    if (u >= 1) { const el = fly.el; fly = null; el.classList.remove("on"); setTimeout(() => el.remove(), 450); }
  }
  // Where to land, from what the friend is doing now.
  function land(f) {
    const s = f.s, onLift = !top.phase && !api.arrived;
    const away = (url) => { store(sessionStorage, LAND, f.name); location.href = api.withResort(url); };
    if (s.ph === "lift") {
      if (onLift && s.l === lift.name) { // in their chair if there's a seat, else the next one
        joinedChair = true;
        if (s.c !== chairId) takeSeat(f, s.c, extrapD(f));
        return;
      }
      away(`look.html?lift=${encodeURIComponent(s.l)}&with=${encodeURIComponent(f.id)}`); return;
    }
    if (s.ph === "top") {
      if (onLift && s.l === lift.name) { api.d = api.d1 + 0.5; return; } // the chair glides in: you stand next to them
      if (s.l) { away(`look.html?lift=${encodeURIComponent(s.l)}&at=1`); return; }
    }
    // On the snow (or their hike): beside them, a few metres to their right, heading their way.
    // Where they are now: their last word carried on by their speed (not the smoothed picture, which may lag).
    const sp = s.ph === "ski" ? s.sp : 0, age = Math.min(1, (performance.now() - f.at) / 1000), h = s.h;
    const x = s.x + Math.sin(h) * sp * age, z = s.z + Math.cos(h) * sp * age;
    // A few metres behind them and to their right, so they're in view ahead as you ride on.
    const lx = x - Math.cos(h) * 3 - Math.sin(h) * 6, lz = z + Math.sin(h) * 3 - Math.cos(h) * 6;
    if (onLift) api.offLift();
    lastLand = { at: [Math.round(lx), Math.round(lz)], s: [Math.round(s.x), Math.round(s.z)], disp: f.disp && [Math.round(f.disp.x), Math.round(f.disp.z)], h };
    if (!top.landAt(lx, lz, h, t("到 {name} 身边了", { name: esc(f.name) }), Math.max(2, sp), { name: f.name, run: s.run, dest: s.e ? { x: s.e[0], z: s.e[1], name: s.en } : null })) toast(f.avatar, t("{name} 那里附近没有雪道", { name: esc(f.name) }));
  }

  // ---- The painted map
  let mapAt = 0, pmapWired = false;
  function feedMap(now, list) {
    const pm = top.pmap; if (!pm) return;
    if (!pmapWired) { pmapWired = true; pm.onFind = (p) => goFind(p.id); pm.onFollow = (p) => startFollow(p.id); }
    if (now - mapAt < (pm.isOpen ? 500 : 1000)) return;
    mapAt = now;
    pm.setPeople(list.filter((f) => f.mapXZ).map((f) => ({ id: f.id, avatar: f.avatar, name: f.name, x: f.mapXZ[0], z: f.mapXZ[1], where: whereText(f) })));
  }

  // ---- Every frame (called by the ride just before it draws)
  let lastFrame = performance.now();
  function frame(now) {
    const dt = Math.max(0, Math.min(0.1, (now - lastFrame) / 1000)); lastFrame = now;
    stepHold(now);
    send(now);
    if (!friends.size) { voice.frame(now, []); return; }
    tryJoin(now); keepChair(dt); settleSeat();
    const picking = top.phase === "pick";
    const live = [];
    for (const f of friends.values()) {
      const gone = !f.s || (f.gone && now - f.gone > 2500) || now - f.at > STALE;
      if (gone) { hide(f); if (f.model || f.making) dropModel(f); continue; } // left: their rider goes (made again if they come back)
      if (live.length >= MAX) { hide(f); continue; }
      ensure(f);
      if (!place(f, now, dt)) { hide(f); continue; }
      live.push(f);
      f.tag.classList.toggle("fade", !!f.gone);
      const dist = camera.position.distanceTo(f.pos), near = dist < NEAR && !f.gone;
      const shown = near && pose(f, dt, now);
      if (f.model) f.model.visible = shown;
      f.marker.visible = !shown && dist < TAG_FAR * 3 && !f.gone;
      if (f.marker.visible) { f.marker.position.copy(f.pos); f.marker.scale.setScalar(f.inMine ? 0.3 : Math.max(1, dist / 180)); } // in my chair, a small one on their seat until their rider is made
      project(f, picking);
      voiceTag(f);
    }
    stepSeatGo(now); // after place(): the seats as they are this frame
    voice.frame(now, live);
    fab.hidden = !live.length; fab.querySelector(".n").textContent = live.length || "";
    if (!live.length) { qbox.hidden = true; }
    feedMap(now, live);
    if (toasts.children.length) { const tc = document.getElementById("turnCue"); toasts.style.top = tc && !tc.hidden ? `${Math.round(tc.getBoundingClientRect().bottom + 8)}px` : ""; }
    stepFollow(now);
    if (fly) stepFly(now);
  }
  // ---- The party: where I am, for its presence; its 去找他 and 跟着他, done here.
  function partyState() {
    const ph = top.phase;
    if (!ph && !api.arrived) return { ph: "lift", lift: lift.name, b: boardAt, c: chairId };
    if (ph === "ski") {
      const L = top.live?.() || {}, o = { ph: "ski", lift: lift.name, run: L.run || null };
      if (L.dest) { o.e = [Math.round(L.dest.x), Math.round(L.dest.z)]; o.en = L.dest.name; }
      return o;
    }
    if (ph === "hike") return { ph: "hike", lift: lift.name };
    return { ph: ph === "pick" ? "pick" : "top", lift: lift.name };
  }
  party?.setRide({
    state: partyState, voice,
    callable: () => top.live?.()?.wait || lift.name, // 一起坐: the lift I wait at the bottom of, else this one again
    find: (id) => { const f = friends.get(id); if (!f?.s || f.gone || performance.now() - f.at > STALE) return false; goFind(id); return true; },
    follow: (id) => startFollow(id, true), unfollow: () => stopFollow(true),
  });
  window.__tg = { get fly() { return fly && { t: Math.round(performance.now() - fly.t0), landed: fly.landed }; }, get lastLand() { return lastLand; }, rx, tx, friends, get chairId() { return chairId; }, get seat() { return seat; }, get held() { return held; }, seatsIn, moveTo, onMessage, ownChair, goFind, startFollow, stopFollow, send: (k) => ch.broadcast("m", { id: me, k }), ch, tripId, me, voice }; // testing
  // A friend beside me in my chair, for the ride to pose me talking to them: +1 on my left (+x), -1 on my right, 0 none.
  function mate() {
    if (top.phase || api.arrived) return 0;
    const xs = xsOf(), mine = xs[seat.k] ?? api.seat().x, seats = seatsIn(chairId);
    let best = 0, bd = Infinity;
    for (const [id, k] of seats) {
      if (id === me || k < 0 || !friends.get(id)?.model?.visible) continue;
      const dx = xs[k] - mine; if (Math.abs(dx) < bd) { bd = Math.abs(dx); best = Math.sign(dx); }
    }
    return best;
  }
  return { active: true, frame, goFind, startFollow, stopFollow, mate, held: () => held, boarding };
}
