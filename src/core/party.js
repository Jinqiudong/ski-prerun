// The party (一起滑): friends on a shared trip, together on any page. Anyone on the trip can invite anyone on
// it, join or leave at any time; nobody leads, and nobody leaving (or closing the app) breaks it for the rest:
// their row greys out, then goes. Being in the party: you see where the others are on every page, voice works
// (mic off until you turn it on), and you can act on each other: 去找他 (go to them), 跟着他 (follow: carried
// onto the lift they board and down the route they choose, until 自由滑), 一起坐 (everyone who accepts boards
// the same chair at the same moment), 叫他来 (ping someone who isn't at a resort). Nothing happens to you
// without a tap, except while you follow someone.
//
// The entry and the notifications are a pet, not a pill: the owner's capybara in goggles, peeking over a
// little snowy ledge stuck to the edge of the screen (assets/party/, cut by tools/cut_party_art.py). It
// peeks and blinks, and dozes after a while. Something happens (an invite, a 一起坐 call, someone calling
// you): it's surprised, then pops up holding a wooden sign with the message (our own words on the plank; a
// 一起坐 sign has its 3-second bar), and a red dot stays till it's seen. Pull it down (or tap it) and it comes
// out holding the sign, the party panel hanging under it; push it up or tap outside and it goes back, happy.
//
// One Realtime broadcast channel per shared trip, party:<trip> (shared-trip.js's Channel): presence every
// few seconds (where I am: page, resort, lift, chair, route, whom I follow, mic), invites, calls, pings. The
// ride keeps its own channel for fine positions (together.js). What I chose (in the party, whom I follow, my
// mic) is kept in localStorage, so every page rejoins silently. The rules with no DOM are in party-core.js.
//
// startParty({ page: "home" | "resort" | "ride", root, resort, rn, sub, lift }) on every page; the ride
// hands it its hooks with setRide({ state, find, follow, unfollow, voice }).
import { Channel, memberId, myName } from "../start/shared-trip.js?v=2";
import { t, myAvatar } from "./i18n.js?v=44";
import { rideTrip } from "../ride/together-core.js?v=6";
import { cleanPresence, cleanInvite, cleanPing, cleanCall, cleanOk, liveMembers, resolveFollow, teamLead, followMove, findWay, callAt, callLeft, callChair, spotFor, statusOf, petOf, EVERY, COUNTDOWN } from "./party-core.js?v=1";

const KEY = "prerunParty", SEEN = "prerunPartySeen", RIDE_TRIP = "prerunRideTrip", LAND = "prerunTogetherLand";
const FACES = ["peek", "blink", "happy", "surprised", "doze", "love"];
// The pet holds on to the top edge of whatever it brings: its paws (drag.png) over the note or the panel (the owner).
const DOZE_AFTER = 45000;
const store = (s, k, v) => { try { if (v === undefined) return s.getItem(k); if (v === null) s.removeItem(k); else s.setItem(k, v); } catch { /* storage off */ } return null; };
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const CSS = `
#ptPet { position: fixed; z-index: 40; width: 92px; height: 66px; pointer-events: none; transition: left .5s, right .5s, top .5s; }
#ptPet .pet { position: absolute; inset: 0; padding: 0; border: 0; background: none; cursor: pointer; pointer-events: auto; touch-action: none; -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; }
#ptPet .cap { position: absolute; left: 3px; bottom: 15px; width: 86px; height: auto; transform-origin: 50% 100%; animation: pt-breathe 3.2s ease-in-out infinite; pointer-events: none; }
#ptPet .ledge { position: absolute; left: 0; bottom: 0; width: 92px; height: auto; pointer-events: none; }
#ptPet.left { left: -16px; } #ptPet.right { right: -16px; }
#ptPet.left .cap { left: 13px; } #ptPet.right .cap { left: -7px; }
#ptPet.doze .cap { animation-duration: 5s; }
#ptPet.perk .cap { animation: pt-perk .5s cubic-bezier(.3,1.6,.5,1); }
#ptPet .dot { position: absolute; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: #c8463b; border: 2px solid #fdfbf6; box-shadow: 0 1px 3px rgba(40,30,20,.3); display: none; }
#ptPet.left .dot { left: 66px; } #ptPet.right .dot, #ptPet.top .dot { left: 12px; }
#ptPet.unseen .dot { display: block; }
#ptPet.hide .pet { opacity: 0; pointer-events: none; }
#ptPet .pet { transition: opacity .3s, transform .35s; }
#ptPet.pulled .pet { transform: translateY(14px); }
#ptSign { position: fixed; z-index: 41; width: 200px; pointer-events: none; transform-origin: 50% 100%; }
#ptSign[hidden] { display: none; }
#ptSign .art { position: relative; width: 200px; pointer-events: auto; cursor: pointer; animation: pt-pop .55s cubic-bezier(.3,1.5,.5,1) both; }
#ptSign .art img.pt, #ptOpen .hold img.pt { display: block; width: 150px; height: auto; margin: 0 auto; position: relative; z-index: 2; }
#ptSign .note { position: relative; margin-top: -20px; padding: 18px 12px 10px; border-radius: 10px; background: #fdfbf6; border: 1px solid #d8ccb6; box-shadow: 0 8px 20px rgba(40,30,20,.25); }
#ptSign .face { display: grid; gap: 2px; text-align: center; color: #22344d; font: 600 15px/1.25 "Noto Serif SC", serif; }
#ptSign .face b { font: 600 17px/1.15 "Noto Serif SC", serif; } #ptSign .face small { font: 500 12px/1.2 "Noto Serif SC", serif; color: #6f5a46; }
#ptSign .bar { position: relative; margin: 8px 6px 0; height: 5px; border-radius: 3px; background: rgba(74,52,36,.18); overflow: hidden; }
#ptSign .bar i { display: block; height: 100%; width: 100%; background: #b6463b; transform-origin: 0 50%; }
#ptSign .acts { display: flex; justify-content: center; gap: 6px; margin-top: 8px; pointer-events: auto; }
#ptSign .acts button { padding: 5px 11px !important; font-size: 12.5px !important; }
#ptSign .acts button, #ptPanel button { font: 600 13px "Noto Serif SC", serif; padding: 6px 12px; border-radius: 999px; border: 1px solid #cbbfa9; background: #fdfbf6; color: #22344d; cursor: pointer; box-shadow: 0 3px 8px rgba(40,30,20,.16); white-space: nowrap; }
#ptSign .acts button.go, #ptPanel button.go { background: #22344d; border-color: #22344d; color: #fdfbf6; }
#ptScrim { position: fixed; inset: 0; z-index: 44; background: rgba(40,34,28,0); transition: background .3s; }
#ptScrim.on { background: rgba(40,34,28,.28); }
#ptOpen { position: fixed; z-index: 45; left: 50%; top: calc(env(safe-area-inset-top) + 4px); width: min(360px, calc(100vw - 20px)); transform: translate(-50%, -110%) rotate(-3deg); transform-origin: 50% 0; transition: transform .55s cubic-bezier(.3,1.35,.5,1); }
#ptOpen.on { transform: translate(-50%, 0) rotate(0); }
#ptOpen .hold { position: relative; width: 150px; margin: 0 auto -20px; z-index: 2; touch-action: none; cursor: grab; }
#ptOpen .hold img { pointer-events: none; }
#ptPanel { position: relative; max-height: calc(100vh - 230px - env(safe-area-inset-top)); overflow: auto; padding: 18px 12px 12px; border-radius: 10px; background: #fdfbf6; border: 1px solid #d8ccb6; box-shadow: 0 10px 26px rgba(40,30,20,.3); color: #22344d; font: 14px "Noto Serif SC", serif; }
#ptPanel select { font: inherit; width: 100%; margin-bottom: 8px; padding: 6px; border-radius: 6px; border: 1px solid #cbbfa9; background: #f6f1e7; color: #22344d; }
#ptPanel .row { display: grid; grid-template-columns: 36px 1fr; gap: 2px 8px; align-items: center; padding: 8px 2px; border-top: 1px dashed #e0d6c4; }
#ptPanel .row:first-of-type { border-top: 0; }
#ptPanel .row img { width: 36px; height: 36px; border-radius: 50%; background: #e6ebee; grid-row: span 2; }
#ptPanel .row b { font: 600 15px "Noto Serif SC", serif; } #ptPanel .row small { color: #6f685f; font-size: 12px; }
#ptPanel .row .btns { grid-column: 2; display: flex; flex-wrap: wrap; gap: 5px; margin-top: 3px; }
#ptPanel .row .btns button { padding: 4px 10px; font-size: 12.5px; box-shadow: none; }
#ptPanel .row.grey { opacity: .45; }
#ptPanel .row.me { background: #f4efe4; border-radius: 8px; border-top: 0; margin-top: 4px; }
#ptPanel button.on { background: #3f7d5c; border-color: #3f7d5c; color: #fdfbf6; }
#ptPanel button:disabled { opacity: .45; cursor: default; }
#ptPanel .foot { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; } #ptPanel .foot button { flex: 1; }
#ptPanel .hint { color: #8a8278; font-size: 12.5px; text-align: center; margin: 6px 0 2px; }
#ptPanel .pick { display: grid; gap: 4px; margin-top: 8px; padding: 8px; border-radius: 8px; background: #f4efe4; }
#ptPanel .pick label { display: flex; align-items: center; gap: 8px; font-size: 14px; }
#ptPanel .pick img { width: 26px; height: 26px; border-radius: 50%; background: #e6ebee; }
#ptPanel .pick small { color: #3f7d5c; font-size: 11px; }
@keyframes pt-breathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.015, 1.035); } }
@keyframes pt-perk { 0% { transform: translateY(8px) scale(1, .9); } 60% { transform: translateY(-6px) scale(1, 1.06); } }
@keyframes pt-pop { from { transform: translateY(40px) scale(.6); opacity: 0; } }
@keyframes pt-sway { 0%, 100% { transform: rotate(0); } 30% { transform: rotate(-4deg); } 70% { transform: rotate(3deg); } }
#ptPet.sway .cap { animation: pt-sway 1.4s ease-in-out; }
@media (prefers-reduced-motion: reduce) {
  #ptPet .cap, #ptPet.perk .cap, #ptPet.sway .cap, #ptSign .art { animation: none !important; }
  #ptPet, #ptPet .pet, #ptOpen, #ptScrim { transition: none !important; }
}
`;

export function startParty({ page, root = "", resort = null, rn = null, sub = "", lift = null } = {}) {
  const me = memberId();
  const A = (n) => `${root}assets/party/${petOf(myAvatar())}${n}.png?v=1`;
  const icon = (av) => `${root}assets/icons/${av}.png?v=1`;
  const saved = (() => { try { return JSON.parse(store(localStorage, KEY) || "{}") || {}; } catch { return {}; } })();
  const keep = () => store(localStorage, KEY, JSON.stringify({ trip: S.trip, in: S.in, since: S.since, fol: S.fol, mic: S.mic }));
  const S = { trip: null, in: !!saved.in, since: saved.since || 0, fol: saved.fol || null, mic: !!saved.mic, sub, ride: null, open: false };
  const heard = new Map(); // id → presence + { at, gone }
  const notes = []; // { kind, from, call?, heardAt, done }
  let ch = null, voice = null, voiceLoading = null;

  // ---- Which trip: the one picked in the panel if I'm still on it, else today's / the next / the latest.
  const myTrips = () => { let list = []; try { list = JSON.parse(localStorage.getItem("prerunTrips") || "[]"); } catch { /* none */ } return (Array.isArray(list) ? list : []).filter((tr) => tr?.shared && typeof tr.id === "string" && (!tr.srv?.members || tr.srv.members.some((m) => m.id === me))); };
  const tripOf = (id) => myTrips().find((tr) => tr.id === id) || null;
  function chooseTrip() {
    const list = myTrips();
    if (saved.trip && list.some((tr) => tr.id === saved.trip)) return saved.trip;
    const viaUrl = new URLSearchParams(location.search).get("trip");
    if (viaUrl && list.some((tr) => tr.id === viaUrl)) return viaUrl;
    return rideTrip(list, ymd(new Date()), resort, me);
  }
  S.trip = chooseTrip();
  if (!S.trip) S.in = false;

  // ---- The pet
  const style = document.createElement("style"); style.textContent = CSS; document.head.append(style);
  const pet = document.createElement("div"); pet.id = "ptPet";
  pet.innerHTML = `<button class="pet" type="button"><img class="cap" alt="" draggable="false"><img class="ledge" alt="" draggable="false"><i class="dot"></i></button>`;
  const btn = pet.querySelector(".pet"), cap = pet.querySelector(".cap");
  btn.setAttribute("aria-label", t("一起滑"));
  pet.querySelector(".ledge").src = A("snowledge");
  const sign = document.createElement("div"); sign.id = "ptSign"; sign.hidden = true; sign.setAttribute("role", "status");
  document.body.append(pet, sign);
  for (const f of FACES) new Image().src = A(f); // so a swap never flashes
  let face = "peek";
  const setFace = (f) => { face = f; cap.src = A(f); };
  setFace("peek");

  // Where it sits on this page: the spot table in party-core.
  function place() {
    const s = spotFor(page, S.sub);
    pet.classList.remove("left", "right", "top");
    pet.classList.add(s.edge);
    pet.style.left = pet.style.right = pet.style.top = "";
    if (s.edge === "top") { pet.style.top = `calc(env(safe-area-inset-top) + ${Math.round((s.y || 0) * innerHeight) + 4}px)`; pet.style.left = `${Math.round(s.x * innerWidth - 46)}px`; }
    else pet.style.top = `${Math.round(s.y * innerHeight - 50)}px`;
    if (!sign.hidden) placeSign();
  }
  addEventListener("resize", place);

  // Idle: peek, a blink now and then, a sway once in a while; asleep after a while with nothing going on.
  let lastPoke = performance.now(), idleT = 0;
  function idle() {
    clearTimeout(idleT);
    idleT = setTimeout(() => {
      if (S.open || !sign.hidden || face === "happy" || face === "love" || face === "surprised") return idle();
      const quiet = performance.now() - lastPoke > DOZE_AFTER;
      if (quiet) { if (face !== "doze") { setFace("doze"); pet.classList.add("doze"); } return idle(); }
      pet.classList.remove("doze");
      setFace("blink"); setTimeout(() => face === "blink" && setFace("peek"), 170);
      if (!calm() && Math.random() < 0.25) { pet.classList.remove("sway"); void pet.offsetWidth; pet.classList.add("sway"); setTimeout(() => pet.classList.remove("sway"), 1500); }
      idle();
    }, 2600 + Math.random() * 3200);
  }
  idle();
  const poke = () => { lastPoke = performance.now(); pet.classList.remove("doze"); if (face === "doze") setFace("peek"); };
  // A little reaction, then back to peeking.
  function react(f, ms = 1400) { poke(); setFace(f); clearTimeout(react.t); react.t = setTimeout(() => { if (face === f) setFace("peek"); }, ms); }

  // Pull it down (or tap it): the panel. A drag of 22 px down opens it.
  let drag = null;
  btn.addEventListener("pointerdown", (e) => { drag = { y: e.clientY, x: e.clientX, id: e.pointerId }; try { btn.setPointerCapture(e.pointerId); } catch { /* fine */ } poke(); });
  btn.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    pet.classList.toggle("pulled", dy > 8);
    if (dy > 22) { drag = null; pet.classList.remove("pulled"); openPanel(); }
  });
  for (const ev of ["pointerup", "pointercancel"]) btn.addEventListener(ev, (e) => {
    if (!drag) return;
    const tap = Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 10 && ev === "pointerup";
    drag = null; pet.classList.remove("pulled");
    if (tap) { if (!sign.hidden && notes.some((n) => !n.done)) actNote(notes.find((n) => !n.done)); else openPanel(); }
  });
  btn.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPanel(); } });
  btn.addEventListener("click", (e) => { if (e.detail === 0) openPanel(); }); // keyboard and screen readers

  // ---- The sign: a message held up over the ledge, our words on the owner's plank.
  const holdArt = () => `<img class="pt" src="${A("drag")}" alt="">`;
  function placeSign() {
    const r = pet.getBoundingClientRect(), w = 200, h = sign.offsetHeight || 170;
    const left = Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2));
    const below = r.top < h + 20; // near the top of the screen: it hangs below the ledge instead
    sign.style.left = `${left}px`; sign.style.top = `${below ? r.top : r.top - h + 56}px`;
  }
  let signT = 0;
  function showNote(n) {
    poke(); pet.classList.add("unseen");
    setFace("surprised");
    if (!calm()) { pet.classList.remove("perk"); void pet.offsetWidth; pet.classList.add("perk"); }
    if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([20, 40, 20]);
    clearTimeout(signT);
    signT = setTimeout(() => { // surprised first, then out it comes with the sign
      pet.classList.add("hide");
      const f = heard.get(n.from), name = f?.name || t("朋友");
      let words = "", acts = "";
      if (n.kind === "inv") { words = `<b>${esc(t("{name} 约你一起滑", { name }))}</b>`; acts = `<button class="go" data-a="yes">${t("加入")}</button><button data-a="no">${t("等会儿")}</button>`; }
      if (n.kind === "ping") { words = `<b>${esc(t("{name} 叫你过去", { name }))}</b><small>${esc(t(...statusOf(f)))}</small>`; acts = `<button class="go" data-a="yes">${t("去找他")}</button><button data-a="no">${t("等会儿")}</button>`; }
      if (n.kind === "call") {
        const mine = n.call.id === me;
        words = mine ? `<b>${esc(t("约大家一起坐"))}</b><small>${esc(n.call.lift)}</small>` : `<b>${esc(name)}</b><small>${esc(t("约你一起坐 {lift}", { lift: n.call.lift }))}</small>`;
        acts = mine ? `<button data-a="no">${t("取消")}</button>` : `<button class="go" data-a="yes">${t("一起坐")}</button><button data-a="no">${t("这次不坐")}</button>`;
      }
      if (n.kind === "info") { words = `<b>${esc(n.text)}</b>`; acts = ""; }
      sign.innerHTML = `<div class="art">${holdArt()}<div class="note"><div class="face">${words}</div>${n.kind === "call" ? `<div class="bar"><i></i></div>` : ""}${acts ? `<div class="acts">${acts}</div>` : ""}</div></div>`;
      sign.hidden = false; placeSign();
      sign.querySelector(".art").onclick = () => actNote(n);
      for (const b of sign.querySelectorAll("[data-a]")) b.onclick = (e) => { e.stopPropagation(); b.dataset.a === "yes" ? actNote(n) : dropNote(n, n.kind === "call" && n.call.id === me ? "cancel" : "no"); };
      if (n.kind === "info") setTimeout(() => dropNote(n), 3200);
    }, calm() ? 0 : 650);
  }
  function hideSign(happy = false) {
    clearTimeout(signT);
    sign.hidden = true; sign.innerHTML = ""; pet.classList.remove("hide", "perk");
    react(happy ? (Math.random() < 0.5 ? "love" : "happy") : "peek", happy ? 1600 : 10);
  }
  function nextNote() { const n = notes.find((x) => !x.done); if (n) showNote(n); else { pet.classList.remove("unseen"); } }
  function dropNote(n, why = "no") {
    n.done = true;
    if (n.kind === "call" && why === "cancel") ch?.broadcast("ok", { id: me, k: n.call.k, no: true });
    hideSign(false); setTimeout(nextNote, 400);
  }
  function note(n) {
    if (notes.some((x) => !x.done && x.kind === n.kind && x.from === n.from && (n.kind !== "call" || x.call.k === n.call.k))) return;
    notes.push({ ...n, heardAt: Date.now(), done: false });
    while (notes.length > 12) notes.shift();
    if (sign.hidden && !S.open) showNote(notes[notes.length - 1]);
    else pet.classList.add("unseen");
  }
  function actNote(n) {
    if (!n || n.done) return;
    if (n.kind === "inv") { n.done = true; join(); hideSign(true); return; }
    if (n.kind === "ping") { n.done = true; hideSign(true); goFind(n.from); return; }
    if (n.kind === "call" && n.call.id !== me && !n.yes) { n.yes = true; ch?.broadcast("ok", { id: me, k: n.call.k }); okOf(n.call.k).add(me); const a = sign.querySelector("[data-a=yes]"); if (a) { a.textContent = t("等大家…"); a.disabled = true; } return; }
    if (n.kind === "info") dropNote(n);
  }

  // ---- 一起坐: a call, its countdown on everyone's sign, then everyone who said yes boards together.
  const oks = new Map(); // call k → Set of ids in
  const okOf = (k) => { if (!oks.has(k)) oks.set(k, new Set()); return oks.get(k); };
  function callLift(liftName, res = resort, resName = rn) {
    if (!S.in || !ch?.joined || !liftName || !res) return false;
    const call = { id: me, k: Math.random().toString(36).slice(2, 10), lift: liftName, resort: res, rn: resName || res, at: callAt(Date.now()) };
    ch.broadcast("call", call);
    okOf(call.k).add(me);
    note({ kind: "call", from: me, call, yes: true });
    return true;
  }
  function stepCalls(now) {
    for (const n of notes) {
      if (n.done || n.kind !== "call") continue;
      const { frac, end } = callLeft(n.call, n.heardAt, now);
      const bar = sign.querySelector(".bar i"); if (bar && !sign.hidden) bar.style.transform = `scaleX(${frac})`;
      if (now < end) continue;
      n.done = true;
      if (n.yes) board(n.call);
      else hideSign(false), setTimeout(nextNote, 300);
    }
  }
  function board(call) {
    const crew = [...okOf(call.k)].filter((id) => id === me || heard.get(id)?.in).slice(0, 12);
    if (!crew.includes(call.id)) crew.push(call.id);
    hideSign(true);
    store(sessionStorage, LAND, null);
    go(rideUrl({ resort: call.resort, lift: call.lift, sync: Math.round(call.at), host: call.id, crew: crew.join(",") }), `seat:${call.k}`);
  }

  // ---- Going places
  function rideUrl(q) {
    const u = new URLSearchParams({ lift: q.lift, resort: q.resort, trip: S.trip || "" });
    for (const k of ["with", "find", "sync", "host", "crew"]) if (q[k] != null) u.set(k, q[k]);
    return `${root}look.html?${u}`;
  }
  const resortUrl = (r) => `${root}mountain/?resort=${encodeURIComponent(r)}`;
  function go(url, seenKey = null) {
    if (seenKey) store(sessionStorage, SEEN, seenKey);
    if (S.trip) store(sessionStorage, RIDE_TRIP, S.trip);
    keep();
    location.href = url;
  }
  // 去找他: to their resort, beside them in the ride (their chair if they're on a lift).
  function goFind(id) {
    const f = heard.get(id), w = findWay(f); if (!w) return false;
    poke();
    if (page === "ride" && w.go === "ride" && w.resort === resort && S.ride?.find?.(id)) { closePanel(); return true; }
    if (w.go === "resort") { go(resortUrl(w.resort)); return true; }
    if (!w.lift) { go(resortUrl(w.resort)); return true; }
    store(sessionStorage, LAND, f.name || t("朋友"));
    go(rideUrl(w.chair ? { resort: w.resort, lift: w.lift, with: id } : { resort: w.resort, lift: w.lift, find: id }));
    return true;
  }
  // 跟着他: whom I follow; the ride follows them on the snow, and their lift and route carry me along.
  function setFollow(id) {
    S.fol = id && id !== me ? id : null; S.rideFol = null; keep(); sendNow();
    if (page === "ride") { if (S.fol) S.ride?.follow?.(S.fol); else S.ride?.unfollow?.(); }
    if (S.fol) stepFollow(true);
    paintPanel();
  }
  let folAt = 0;
  function stepFollow(force = false) {
    const now = Date.now();
    if (!S.in || !S.fol || (!force && now - folAt < 1000)) return;
    folAt = now;
    const who = resolveFollow(heard, me, S.fol, now);
    if (!who) return;
    if (page === "ride" && who !== S.rideFol) { S.rideFol = who; S.ride?.follow?.(who); }
    const mv = followMove(heard.get(who), mine(), store(sessionStorage, SEEN));
    if (!mv) return;
    if (mv.act === "resort") { go(resortUrl(mv.resort), mv.key); return; }
    if (mv.act === "lift") { store(sessionStorage, LAND, heard.get(who).name || t("朋友")); go(rideUrl({ resort: mv.resort, lift: mv.lift, with: who }), mv.key); return; }
    if (mv.act === "route") {
      store(sessionStorage, SEEN, mv.key);
      if (page === "ride" && mv.resort === resort && S.ride?.find?.(who)) return;
      if (!mv.lift) return;
      store(sessionStorage, LAND, heard.get(who).name || t("朋友"));
      go(rideUrl({ resort: mv.resort, lift: mv.lift, find: who }), mv.key);
    }
  }

  // ---- Presence: mine, as the others see me.
  function mine() {
    const o = { id: me, name: myName() || tripOf(S.trip)?.people?.find((p) => p.me)?.name || t("朋友"), av: myAvatar(), in: S.in };
    if (!S.in) return o;
    Object.assign(o, { page, fol: S.fol, mic: S.mic && micOn(), since: S.since });
    if (page === "home") o.tab = S.sub || "rider";
    if (page !== "home") { o.resort = resort; o.rn = rn || resort; }
    if (page === "resort") o.ph = S.sub === "base" ? "base" : null;
    if (page === "ride") Object.assign(o, { ph: "lift", lift }, S.ride?.state?.() || {});
    return o;
  }
  let sentAt = 0, lastSent = "";
  function sendNow() { sentAt = 0; }
  function send(now) {
    if (!ch?.joined || document.hidden) return;
    const p = mine(), s = JSON.stringify(p);
    if (s === lastSent && now - sentAt < EVERY) return;
    if (s !== lastSent && now - sentAt < 400) return;
    if (ch.broadcast("p", p)) { sentAt = now; lastSent = s; }
  }

  // ---- The channel
  function connect() {
    ch?.close(); ch = null; heard.clear();
    if (voice) { voice.setMic(false); voice = null; voiceLoading = null; } // it spoke on the old channel
    if (!S.trip) return;
    store(sessionStorage, RIDE_TRIP, S.trip);
    ch = new Channel(`party:${S.trip}`, onMessage, { onJoin: () => { lastSent = ""; sentAt = 0; ch.broadcast("p", { ...mine(), ask: true }); } });
    if (S.in && page !== "ride" && voice === null && voiceLoading === null && document.readyState !== "loading") wantVoice();
  }
  function onMessage(ev, p) {
    if (!p || p.id === me) return;
    const now = Date.now();
    if (ev === "v" || ev === "vs") { voice?.onMessage(ev, p); return; }
    if (ev === "p") {
      const o = cleanPresence(p); if (!o) return;
      const was = heard.get(o.id);
      heard.set(o.id, { ...o, at: now, gone: 0 });
      if (p.ask) { lastSent = ""; sentAt = 0; voice?.hello(o.id); } // someone just came: tell them where I am at once
      if (o.in && was && !was.in && S.in) note({ kind: "info", from: o.id, text: t("{name} 加入了", { name: o.name || t("朋友") }) });
      if (o.id === S.fol || S.fol) stepFollow(true);
      paintSoon();
    } else if (ev === "bye") {
      const f = heard.get(p.id); if (f) { f.gone = now; f.in = false; }
      voice?.drop?.(p.id, false);
      paintSoon();
    } else if (ev === "inv") {
      const iv = cleanInvite(p, me); if (!iv || S.in) return;
      note({ kind: "inv", from: iv.id });
    } else if (ev === "ping") {
      if (!cleanPing(p, me) || !S.in) return;
      note({ kind: "ping", from: p.id });
    } else if (ev === "call") {
      const c = cleanCall(p); if (!c || !S.in) return;
      okOf(c.k).add(c.id);
      note({ kind: "call", from: c.id, call: c });
    } else if (ev === "ok") {
      const o = cleanOk(p); if (!o) return;
      if (p.no === true) { okOf(o.k).delete(o.id); const n = notes.find((x) => x.kind === "call" && x.call.k === o.k && !x.done); if (n && n.call.id === o.id) dropNote(n); return; } // the caller called it off
      okOf(o.k).add(o.id);
    }
  }

  // ---- Joining and leaving
  function join() {
    if (!S.trip) return;
    S.in = true; S.since = S.since || Date.now(); keep(); sendNow(); paintPanel();
    wantVoice();
  }
  function leave() {
    ch?.broadcast("bye", { id: me });
    S.in = false; S.since = 0; S.fol = null; keep(); sendNow();
    if (page === "ride") S.ride?.unfollow?.();
    setMic(false, true);
    paintPanel();
  }
  function invite(ids) {
    if (!ids.length || !ch?.joined) return;
    if (!S.in) join();
    ch.broadcast("inv", { id: me, to: ids });
    note({ kind: "info", from: me, text: t("邀请已发出") });
  }
  function ping(id) { if (ch?.broadcast("ping", { id: me, to: id })) note({ kind: "info", from: me, text: t("叫过了，等他来") }); }

  // ---- Voice: in the ride, the ride's own (near friends by distance, the walkie-talkie); elsewhere a group
  // call with whoever in the party is off the slopes too, on this channel. Off until you turn it on.
  const micOn = () => (page === "ride" ? !!S.ride?.voice?.micOn : !!voice?.micOn);
  async function wantVoice() {
    if (page === "ride" || voice || voiceLoading || !ch) return voice;
    voiceLoading = import("../ride/voice.js?v=12").then(({ rideVoice }) => {
      voice = rideVoice({ ch, me, camera: null, myPos: (o) => o.set(0, 0, 0), talk: () => {}, nameOf: (id) => heard.get(id)?.name || t("朋友"), hud: false, onSay: (s) => s && note({ kind: "info", from: me, text: s }) });
      return voice;
    }).catch((e) => { console.warn("voice", e); return null; });
    return voiceLoading;
  }
  async function setMic(on, quiet = false) {
    if (!quiet) { S.mic = on; keep(); }
    if (page === "ride") { await S.ride?.voice?.setMic?.(on); sendNow(); paintPanel(); return; }
    if (!on && !voice) return;
    const v = await wantVoice(); if (!v) return;
    await v.setMic(on); sendNow(); paintPanel();
  }
  // A mic left on is asked for again on the first tap of this page (phones only open it from a tap).
  addEventListener("pointerdown", () => { if (S.in && S.mic && !micOn()) setMic(true); }, { once: true, capture: true });
  function stepVoice(now) {
    if (page === "ride" || !voice) return;
    const live = S.in ? liveMembers(heard, now).filter((m) => m.state === "live" && m.page !== "ride").map((m) => ({ id: m.id, pos: null, inMine: true, at: performance.now() - (now - m.at), gone: 0 })) : [];
    voice.frame(performance.now(), live);
  }

  // ---- The panel: the pet comes out holding the sign, the party hanging under it.
  const scrim = document.createElement("div"); scrim.id = "ptScrim"; scrim.hidden = true;
  const box = document.createElement("div"); box.id = "ptOpen"; box.hidden = true; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", t("一起滑"));
  document.body.append(scrim, box);
  let picking = false;
  function openPanel() {
    if (S.open) return;
    S.open = true; picking = false; poke();
    pet.classList.remove("unseen"); pet.classList.add("hide");
    sign.hidden = true;
    scrim.hidden = box.hidden = false; paintPanel(true);
    requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add("on"); box.classList.add("on"); }));
  }
  function closePanel() {
    if (!S.open) return;
    S.open = false; scrim.classList.remove("on"); box.classList.remove("on");
    setTimeout(() => { if (S.open) return; scrim.hidden = box.hidden = true; pet.classList.remove("hide"); react(S.in ? "happy" : "peek", 1500); setTimeout(nextNote, 900); }, calm() ? 0 : 450);
  }
  scrim.addEventListener("click", closePanel);
  addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });
  // Push it up: a drag up on the pet and its sign.
  let up = null;
  box.addEventListener("pointerdown", (e) => { if (e.target.closest(".hold")) up = { y: e.clientY }; });
  addEventListener("pointermove", (e) => { if (up && up.y - e.clientY > 30) { up = null; closePanel(); } });
  addEventListener("pointerup", () => (up = null));

  let paintT = 0;
  const paintSoon = () => { if (S.open && !paintT) paintT = setTimeout(() => { paintT = 0; paintPanel(); }, 400); };
  function paintPanel(full = false) {
    if (!S.open) return;
    const now = Date.now(), trips = myTrips(), tr = tripOf(S.trip);
    const all = liveMembers(heard, now, { all: true });
    const members = all.filter((m) => m.in), online = new Set(all.map((m) => m.id));
    const lead = S.fol ? resolveFollow(heard, me, S.fol, now) : null;
    const head = `<div class="hold">${holdArt()}</div>`;
    let h = "";
    if (trips.length > 1) h += `<select data-k="trip" aria-label="${esc(t("哪个行程"))}">${trips.map((x) => `<option value="${esc(x.id)}"${x.id === S.trip ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>`;
    if (!S.trip) h += `<p class="hint">${esc(t("先在行程里分享给朋友"))}</p>`;
    for (const m of members) {
      const st = statusOf(m), way = findWay(m), fol = S.fol === m.id;
      h += `<div class="row${m.state === "grey" ? " grey" : ""}"><img src="${icon(m.av)}" alt=""><b translate="no">${esc(m.name || t("朋友"))}</b><small>${esc(t(st[0], st[1]))}${m.mic ? ` · ${esc(t("麦克风开着"))}` : ""}${m.fol === me ? ` · ${esc(t("跟着你"))}` : ""}</small>
        <div class="btns">${S.in ? `${way ? `<button class="go" data-k="find" data-id="${m.id}">${t("去找他")}</button>` : `<button data-k="ping" data-id="${m.id}">${t("叫他来")}</button>`}<button data-k="follow" data-id="${m.id}" class="${fol ? "on" : ""}">${fol ? t("跟着中") : t("跟着他")}</button>` : ""}</div></div>`;
    }
    if (S.trip && !members.length) h += `<p class="hint">${esc(t(S.in ? "还没有别人。点＋邀请，叫上一起去的朋友" : "还没有人在一起滑"))}</p>`;
    if (S.in) {
      const myst = statusOf(mine()), folName = lead ? heard.get(lead)?.name : null;
      h += `<div class="row me"><img src="${icon(myAvatar())}" alt=""><b>${esc(t("我"))}</b><small>${esc(t(myst[0], myst[1]))}${folName ? ` · ${esc(t("跟着 {name}", { name: folName }))}` : ""}</small>
        <div class="btns"><button data-k="free" class="${S.fol ? "" : "on"}">${t("自由滑")}</button><button data-k="team" class="${S.fol ? "on" : ""}"${members.length ? "" : " disabled"}>${t("跟队")}</button></div></div>`;
    }
    if (picking) {
      const people = (tr?.people || []).filter((p) => !p.me && p.id && !members.some((m) => m.id === p.id));
      h += `<div class="pick">${people.length ? people.map((p) => `<label><input type="checkbox" value="${esc(p.id)}" checked><img src="${icon(/^av_[a-z]+$/.test(p.avatar) ? p.avatar : "av_rider")}" alt=""><span translate="no">${esc(p.name || t("朋友"))}</span>${online.has(p.id) ? `<small>${t("在线")}</small>` : ""}</label>`).join("") + `<button class="go" data-k="send">${t("发邀请")}</button>` : `<p class="hint">${esc(t("行程里的人都在了"))}</p>`}</div>`;
    }
    const can = !!S.trip, callable = S.in && members.length ? (page === "ride" ? S.ride?.callable?.() : null) : null;
    if (callable) h += `<div class="foot"><button class="go" data-k="call" data-lift="${esc(callable)}">${esc(t("约大家一起坐 {lift}", { lift: callable }))}</button></div>`;
    h += `<div class="foot">${S.in
      ? `<button data-k="mic" class="${micOn() ? "on" : ""}" aria-pressed="${micOn()}">${t("麦克风")} ${micOn() ? t("开") : t("关")}</button><button data-k="invite"${can ? "" : " disabled"}>${t("＋邀请")}</button><button data-k="leave">${t("离开")}</button>`
      : `<button class="go" data-k="join"${can ? "" : " disabled"}>${t("加入一起滑")}</button><button data-k="invite"${can ? "" : " disabled"}>${t("＋邀请")}</button>`}</div>`;
    if (full || !box.querySelector("#ptPanel")) box.innerHTML = `${head}<div id="ptPanel">${h}</div>`;
    else box.querySelector("#ptPanel").innerHTML = h;
  }
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-k]"); if (!b || b.disabled) return;
    const k = b.dataset.k, id = b.dataset.id;
    poke();
    if (k === "join") join();
    if (k === "leave") { leave(); closePanel(); }
    if (k === "invite") { picking = !picking; paintPanel(); }
    if (k === "send") { invite([...box.querySelectorAll(".pick input:checked")].map((x) => x.value)); picking = false; paintPanel(); }
    if (k === "find") goFind(id);
    if (k === "ping") ping(id);
    if (k === "follow") setFollow(S.fol === id ? null : id);
    if (k === "free") setFollow(null);
    if (k === "team") setFollow(teamLead(heard, me, Date.now()));
    if (k === "mic") setMic(!micOn());
    if (k === "call") { closePanel(); setTimeout(() => callLift(b.dataset.lift), 500); }
  });
  box.addEventListener("change", (e) => {
    if (e.target.dataset.k !== "trip") return;
    const was = S.in; if (was) ch?.broadcast("bye", { id: me });
    S.trip = e.target.value; S.fol = null; keep(); connect(); if (was) join(); paintPanel();
  });

  // ---- Every 250 ms: presence, calls, follow, voice.
  setInterval(() => { const now = Date.now(); send(now); stepCalls(now); stepFollow(); stepVoice(now); if (S.open && Math.floor(now / 1000) !== Math.floor((now - 250) / 1000)) paintSoon(); }, 250);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) sendNow(); });
  place(); connect();
  if (S.in && page !== "ride") wantVoice(); // connected to the others from the start (listening costs little; the mic waits)

  const api = {
    get trip() { return S.trip; }, get in() { return S.in; }, get fol() { return S.fol; }, me,
    setRn(n) { rn = n; sendNow(); },
    setSub(s) { if (s === S.sub) return; S.sub = s; place(); sendNow(); },
    setRide(hooks) { S.ride = hooks; sendNow(); if (S.fol) { S.rideFol = null; stepFollow(true); } },
    callLift, goFind, setFollow, join, leave, open: openPanel, close: closePanel,
    members: () => liveMembers(heard, Date.now()),
  };
  window.__party = Object.defineProperties({ heard, notes, S, invite, ping, mine, okOf, get ch() { return ch; }, get voice() { return voice; } }, Object.getOwnPropertyDescriptors(api)); // testing
  return api;
}
