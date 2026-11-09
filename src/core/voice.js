// The 对讲机 (walkie-talkie): voice for the party, on every page, for the whole visit. One toggle, always on
// screen: on, my mic stays open and everyone in the party (一起滑 on the trip) hears me, wherever they are,
// until I turn it off; off, I still hear them. No push-to-talk.
//
// It lives in the shell (index.html → src/core/shell.js): the app's pages load in an iframe under it, so a
// page change, a transition or an opening animation never touches the mic, the calls or the sound. Pages reach
// it with voiceHere() (the shell's window.__voice). A page opened on its own (the headless tests open pages
// straight; src/core/frame.js sends everyone else to the shell) starts its own with startVoice(): the same
// thing, but it ends with the page.
//
// Peer to peer: one WebRTC connection per member (a mesh, at most VOICE.PEERS others), signalled on the
// Realtime broadcast channel voice:<trip> (shared-trip.js's Channel; messages in voice-core.js). Everyone in
// the party is connected while they're here, so I always hear them; my track goes on every line while the
// 对讲机 is on (replaceTrack, no renegotiation). Friends' voices play through this window's own AudioContext;
// a muted <audio playsinline> per friend holds each stream (Chrome plays nothing from a remote stream that no
// media element holds). A watchdog keeps it all going: the context resumed after anything suspended it (iOS
// does, around other sound and the lock screen), the elements playing, the mic opened again if the phone took
// it away while the 对讲机 was on (a call, the lock screen), the calls retried.
// The rules with no DOM are in voice-core.js; the ICE servers (STUN, an optional TURN) in voice-config.js.
import { Channel, memberId, myName } from "../start/shared-trip.js?v=2";
import { t, myAvatar } from "./i18n.js?v=50";
import { VOICE, wantPeers, offerer, retryAfter, cleanSignal, cleanVoicePresence, speaking, talking, duckFor, micProblem } from "./voice-core.js?v=1";
import { ICE_SERVERS } from "./voice-config.js?v=1";

const GATHER = 3000, CONNECT = 15000, DISCONNECT = 6000, TICK = 80, WATCH = 1000, MUTE = "prerunVoiceMute", MIC = "prerunVoiceMic";
const HINTS = {
  denied: "没有麦克风权限。点地址栏左边的「大小」›「网站设置」›「麦克风」选「允许」，再点一次麦克风",
  none: "没找到麦克风",
  busy: "麦克风被占用了（比如正在打电话），挂断后再试",
  insecure: "这个页面用不了麦克风（需要 https）",
  other: "麦克风打不开，再试一次",
};
const CSS = `
#vcMic { position: fixed; z-index: 2147483000; width: 62px; height: 66px; padding: 4px 0 3px; border: 2px solid #cbbfa9; border-radius: 18px; background: rgba(253,251,246,.97); color: #22344d; box-shadow: 0 6px 14px rgba(40,50,70,.22); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; cursor: pointer; -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: manipulation; transition: top .45s, left .45s, right .45s, background .15s, border-color .15s; font: 600 11px/1.1 "Noto Serif SC", serif; }
#vcMic.left { left: 8px; } #vcMic.right { right: 8px; }
#vcMic img { width: 34px; height: 34px; pointer-events: none; transition: filter .15s, opacity .15s; }
#vcMic b { font: 600 11px/1.1 "Noto Serif SC", serif; letter-spacing: .02em; }
#vcMic small { font: 600 10px/1 "Noto Serif SC", serif; color: #8a8278; }
#vcMic:not(.on) img { filter: grayscale(1); opacity: .55; }
#vcMic.on { background: #22344d; border-color: #fdfbf6; color: #fdfbf6; }
#vcMic.on small { color: #bfe3cb; }
#vcMic .n { position: absolute; top: -6px; min-width: 18px; height: 18px; padding: 0 4px; box-sizing: border-box; border-radius: 9px; background: #3f7d5c; border: 2px solid #fdfbf6; color: #fdfbf6; font: 600 10px/14px "Noto Serif SC", serif; text-align: center; }
#vcMic.left .n { right: -6px; } #vcMic.right .n { left: -6px; }
#vcMic[hidden], #vcMic .n[hidden], #vcNote[hidden], #vcWho[hidden] { display: none; }
#vcWho { position: fixed; z-index: 2147483000; display: flex; flex-direction: column; gap: 4px; pointer-events: none; }
#vcWho img { width: 30px; height: 30px; border-radius: 50%; background: #e6ebee; box-shadow: 0 0 0 2px #fdfbf6, 0 0 0 4px #3f7d5c; animation: vc-ring .9s ease-in-out infinite alternate; }
#vcNote { position: fixed; z-index: 2147483001; max-width: min(62vw, 270px); padding: 6px 12px; border-radius: 12px; background: rgba(253,251,246,.97); color: #22344d; box-shadow: 0 6px 14px rgba(40,30,20,.22); font: 13px/1.45 "Noto Serif SC", serif; }
@keyframes vc-ring { to { box-shadow: 0 0 0 2px #fdfbf6, 0 0 0 6px rgba(63,125,92,.55); } }
@media (prefers-reduced-motion: reduce) { #vcMic { transition: none; } #vcWho img { animation: none; } }
`;
const store = (s, k, v) => { try { if (v === undefined) return s.getItem(k); if (v === null) s.removeItem(k); else s.setItem(k, v); } catch { /* storage off */ } return null; };
const loadMuted = () => { try { return new Set(JSON.parse(localStorage.getItem(MUTE) || "[]")); } catch { return new Set(); } };

// The voice this page should use: the shell's when the page is in it, else this page's own (if started).
export function voiceHere() { try { return window.parent.__voice || null; } catch { return null; } }

// Start the voice in this window (the shell, or a page on its own). root: the path from this page to the
// site's root, for the icons. Once per window.
export function startVoice({ root = "" } = {}) {
  if (window.__voice) return window.__voice;
  const me = memberId();
  const peers = new Map(); // id → peer
  const members = new Map(); // id → { name, av, mic, at, gone } from their "vp"
  const muted = loadMuted();
  let ch = null, trip = null, stream = null, want = store(sessionStorage, MIC) === "1", asking = null, needTap = false;
  let mine = null, myLevel = 0, mySpk = null, myTalk = null, ducked = 0, sentAt = 0, levelAt = 0, A = null, spot = { edge: "right", y: 0.3 };

  // ---- On screen: the toggle (对讲机, 开 / 关, and how many friends are connected), who's talking beside it,
  // and a line for what's going on.
  const style = document.createElement("style"); style.textContent = CSS; document.head.append(style);
  const btn = document.createElement("button"); btn.id = "vcMic"; btn.type = "button"; btn.hidden = true;
  btn.innerHTML = `<img src="${root}assets/icons/voice_radio.png?v=1" alt="" draggable="false"><b></b><small></small><i class="n" hidden></i>`;
  const who = document.createElement("div"); who.id = "vcWho"; who.hidden = true;
  const note = document.createElement("div"); note.id = "vcNote"; note.hidden = true; note.setAttribute("role", "status");
  const holder = document.createElement("div"); holder.hidden = true; // the friends' <audio> elements
  const mount = () => document.body.append(btn, who, note, holder);
  if (document.body) mount(); else addEventListener("DOMContentLoaded", mount, { once: true });
  const micLive = () => want && !!stream;
  function paint() {
    btn.classList.toggle("on", want);
    btn.querySelector("b").textContent = t("对讲机");
    btn.querySelector("small").textContent = want ? (stream ? t("开") : "…") : t("关");
    btn.setAttribute("aria-pressed", want);
    btn.setAttribute("aria-label", `${t("对讲机")}: ${want ? t("麦克风开着，点一下关掉") : t("麦克风关着，点一下打开")}`);
  }
  // Where it sits: an edge and a height (a fraction of the screen), as the page asks (voice-core MIC_SPOTS).
  function place(s = spot) {
    spot = s && (s.edge === "left" || s.edge === "right") ? s : spot;
    btn.classList.remove("left", "right"); btn.classList.add(spot.edge);
    const h = innerHeight, top = Math.round(Math.max(60, Math.min(h - 80, spot.y * h)) - 33);
    btn.style.top = `${top}px`;
    who.style.top = `${top + 72}px`; who.style.left = spot.edge === "left" ? "18px" : ""; who.style.right = spot.edge === "right" ? "18px" : "";
    note.style.top = `${top + 14}px`; note.style.left = spot.edge === "left" ? "80px" : ""; note.style.right = spot.edge === "right" ? "80px" : "";
  }
  addEventListener("resize", () => place());
  paint(); place();
  let noteT = 0;
  function say(text, ms = 4000) {
    note.textContent = text || ""; note.hidden = !text;
    clearTimeout(noteT); if (text && ms) noteT = setTimeout(() => (note.hidden = true), ms);
  }

  // ---- Sound: this window's own context. Phones start it only from a tap: every tap tries until it runs
  // (taps in the page under the shell count too, unlockFrom), and the watchdog resumes it after iOS suspends it.
  function ctx() {
    if (A) return A;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { A = new AC({ latencyHint: "interactive" }); } catch { return null; }
    return A;
  }
  function unlock() {
    const c = ctx();
    if (c && c.state !== "running") { c.resume().catch(() => {}); const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, c.sampleRate); s.connect(c.destination); s.start(); }
    for (const P of peers.values()) if (P.el?.paused) P.el.play?.().catch(() => {});
    if (needTap && want && !stream) { needTap = false; getMic(); } // the mic, asked for again from a tap
  }
  const unlocked = new WeakSet(); // by document: a frame's window object stays the same from page to page
  function unlockFrom(win) {
    try { const d = win?.document; if (!d || unlocked.has(d)) return; unlocked.add(d); for (const ev of ["pointerdown", "touchend", "click", "keydown"]) d.addEventListener(ev, unlock, true); } catch { /* another origin */ }
  }
  unlockFrom(window);
  const session = (type) => { try { if (navigator.audioSession) navigator.audioSession.type = type; } catch { /* older Safari */ } };

  // ---- My mic: echo cancellation and noise suppression on. Kept open while the 对讲机 is on.
  async function getMic() {
    if (stream) return stream;
    if (asking) return asking;
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) { say(t(HINTS[micProblem({ name: "insecure" })]), 8000); return null; }
    session("play-and-record");
    ctx()?.resume().catch(() => {}); // still inside the tap
    asking = md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }).then((s) => {
      asking = null;
      if (!want) { for (const tr of s.getTracks()) tr.stop(); return null; } // turned off while it was asked for
      stream = s;
      const c = ctx();
      if (c) { const an = c.createAnalyser(); an.fftSize = 512; c.createMediaStreamSource(s).connect(an); mine = { an, buf: new Uint8Array(an.fftSize) }; }
      s.getAudioTracks()[0]?.addEventListener("ended", () => { if (stream === s) lostMic(); });
      for (const P of peers.values()) setSend(P);
      paint(); sendPresence();
      return s;
    }, (e) => {
      asking = null;
      if (e?.name === "NotAllowedError" && navigator.userActivation && !navigator.userActivation.isActive) { needTap = true; return null; } // no tap behind it: wait for one
      if (!stream) session("ambient");
      say(t(HINTS[micProblem(e)]), 12000);
      console.warn("mic", e?.name, e?.message);
      want = false; store(sessionStorage, MIC, null); paint(); sendPresence();
      return null;
    });
    return asking;
  }
  function stopMic() {
    for (const tr of stream?.getTracks() || []) tr.stop();
    stream = null; mine = null; myLevel = 0; mySpk = null;
    for (const P of peers.values()) setSend(P);
  }
  // The phone took the mic away (a call, the lock screen) with the 对讲机 still on: open it again at once
  // (or at the next tap).
  function lostMic() { stopMic(); paint(); sendPresence(); if (want) getMic(); }
  const track = () => (want && stream?.getAudioTracks()[0]) || null;

  // The 对讲机 on or off. true if it's now as asked.
  async function setMic(on) {
    on = !!on;
    if (!on) {
      if (!want && !stream) return true;
      want = false; store(sessionStorage, MIC, null); stopMic(); session("ambient"); paint(); sendPresence(); say(t("麦克风关了"), 2000);
      return true;
    }
    if (want && stream) return true;
    want = true; store(sessionStorage, MIC, "1"); paint();
    if (!(await getMic())) return false;
    say(t("麦克风开了：一起滑的朋友能听到你"), 3000);
    return true;
  }
  btn.addEventListener("click", (e) => { e.stopPropagation(); unlock(); setMic(!want); });

  // ---- The room: the party's trip (party.js says, on every page; null when I'm not in the party).
  function room(id) {
    id = typeof id === "string" && id ? id : null;
    if (id === trip) return;
    leaveRoom();
    trip = id;
    if (!trip) return;
    ch = new Channel(`voice:${trip}`, onMessage, { onJoin: () => sendPresence(true) });
  }
  function leaveRoom() {
    if (ch) { ch.broadcast("bye", { id: me }); ch.close(); }
    ch = null;
    for (const id of [...peers.keys()]) drop(id, false);
    members.clear();
  }
  function sendPresence(ask = false) {
    if (!ch?.joined) return;
    sentAt = performance.now();
    ch.broadcast("vp", { id: me, name: myName() || "", av: myAvatar(), mic: micLive(), ask });
  }

  // ---- Peers
  function peer(id) {
    let P = peers.get(id);
    if (!P) { P = { id, pc: null, n: null, tr: null, born: performance.now(), at: 0, fails: 0, retryAt: 0, live: false, lostAt: 0, sent: null, spk: null, talk: null, level: 0, nodes: null, el: null, failNoted: false }; peers.set(id, P); }
    return P;
  }
  function makePc(P) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.ontrack = (e) => { if (P.pc === pc) attach(P, e.streams?.[0] || new MediaStream([e.track])); };
    return pc;
  }
  const gathered = (pc) => new Promise((ok) => {
    if (pc.iceGatheringState === "complete") return ok();
    const done = () => { clearTimeout(tm); pc.removeEventListener("icegatheringstatechange", check); ok(); };
    const check = () => { if (pc.iceGatheringState === "complete") done(); };
    const tm = setTimeout(done, GATHER); pc.addEventListener("icegatheringstatechange", check);
  });
  // I offer (the smaller id): one audio line both ways; what I send is set later without renegotiating.
  async function call(P, now) {
    close(P);
    const pc = (P.pc = makePc(P)), n = (P.n = Math.random().toString(36).slice(2, 10));
    P.at = now; P.live = false;
    try {
      P.tr = pc.addTransceiver("audio", { direction: "sendrecv" });
      setSend(P);
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      if (P.pc !== pc || !ch) return;
      ch.broadcast("v", { id: me, to: P.id, k: "offer", n, sdp: pc.localDescription.sdp });
    } catch (e) { console.warn("voice offer", e); fail(P); }
  }
  async function answer(P, s) {
    close(P);
    const pc = (P.pc = makePc(P)); P.n = s.n; P.at = performance.now(); P.live = false;
    try {
      await pc.setRemoteDescription({ type: "offer", sdp: s.sdp });
      P.tr = pc.getTransceivers()[0]; if (P.tr) P.tr.direction = "sendrecv";
      setSend(P);
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      if (P.pc !== pc || !ch) return;
      ch.broadcast("v", { id: me, to: P.id, k: "answer", n: s.n, sdp: pc.localDescription.sdp });
    } catch (e) { console.warn("voice answer", e); fail(P); }
  }
  // Hang up one friend; the peer stays, to try again later.
  function close(P) {
    if (P.pc) { try { P.pc.close(); } catch { /* closed */ } }
    P.pc = null; P.tr = null; P.live = false; P.sent = null; P.lostAt = 0;
    if (P.nodes) { try { P.nodes.src.disconnect(); P.nodes.out.disconnect(); } catch { /* gone */ } P.nodes = null; }
    if (P.el) { P.el.srcObject = null; P.el.remove(); P.el = null; }
    P.spk = null; P.talk = null; P.level = 0;
  }
  function drop(id, tell = true) {
    const P = peers.get(id); if (!P) return;
    if (tell && P.pc && ch) ch.broadcast("v", { id: me, to: id, k: "bye", n: P.n || "x" });
    close(P); peers.delete(id);
  }
  function fail(P) {
    close(P); P.fails++; P.retryAt = performance.now() + retryAfter(P.fails);
    if (P.fails >= 3 && !P.failNoted) { P.failNoted = true; say(t("和 {name} 的语音连不上：可能是网络挡住了", { name: members.get(P.id)?.name || t("朋友") }), 6000); }
  }
  // A friend's stream: held by a muted element, played through the context (an analyser for the level, a
  // gain for muting them).
  function attach(P, s) {
    if (P.el) { P.el.srcObject = null; P.el.remove(); }
    const el = (P.el = document.createElement("audio"));
    el.setAttribute("playsinline", ""); el.autoplay = true; el.muted = true; el.srcObject = s; holder.append(el);
    el.play?.().catch(() => {});
    const c = ctx();
    if (!c) { el.muted = muted.has(P.id); return; } // no WebAudio: the element plays it, plainly
    if (P.nodes) { try { P.nodes.src.disconnect(); P.nodes.out.disconnect(); } catch { /* gone */ } }
    const src = c.createMediaStreamSource(s), an = c.createAnalyser(); an.fftSize = 512; src.connect(an);
    const out = c.createGain(); out.gain.value = muted.has(P.id) ? 0 : 1; src.connect(out); out.connect(c.destination);
    P.nodes = { src, an, out, buf: new Uint8Array(an.fftSize) };
  }
  // My track on this friend's line while the 对讲机 is on, nothing otherwise.
  function setSend(P) {
    const tk = track();
    if (!P.tr || P.sent === tk) return;
    P.sent = tk;
    P.tr.sender.replaceTrack(tk).catch((e) => console.warn("voice send", e));
  }

  // ---- The channel
  function onMessage(ev, p) {
    if (!p || p.id === me) return;
    const now = performance.now();
    if (ev === "vp") {
      const s = cleanVoicePresence(p); if (!s) return;
      members.set(s.id, { name: s.name, av: s.av, mic: s.mic, at: now, gone: 0 });
      if (s.ask) { // they just came (a fresh shell): a fresh call, and they need to hear from me now
        const P = peers.get(s.id);
        if (P && offerer(me, s.id)) { close(P); P.retryAt = 0; P.fails = 0; }
        sendPresence();
      }
      return;
    }
    if (ev === "bye") { const m = members.get(p.id); if (m) m.gone = now; drop(p.id, false); return; }
    if (ev !== "v") return;
    const s = cleanSignal(p, me); if (!s) return;
    if (s.k === "offer") {
      if (offerer(me, s.id)) return; // I'm the one who offers
      if (peers.size >= VOICE.PEERS && !peers.has(s.id)) return;
      if (!members.has(s.id)) members.set(s.id, { name: "", av: "av_rider", mic: false, at: now, gone: 0 });
      answer(peer(s.id), s);
    } else if (s.k === "answer") {
      const P = peers.get(s.id);
      if (!P?.pc || P.n !== s.n || P.pc.signalingState !== "have-local-offer") return;
      P.pc.setRemoteDescription({ type: "answer", sdp: s.sdp }).catch((e) => { console.warn("voice answer in", e); fail(P); });
    } else if (s.k === "bye") {
      const P = peers.get(s.id); if (!P) return;
      close(P); P.retryAt = performance.now() + 2000; // they may be back in a moment
    }
  }

  // ---- Every TICK ms: the calls, who's speaking, the toggle's ring.
  function frame() {
    const now = performance.now();
    if (ch?.joined && now - sentAt > VOICE.EVERY) sendPresence();
    const list = [...members].map(([id, m]) => ({ id, at: m.at, gone: m.gone }));
    const wanted = new Set(trip ? wantPeers(list, now) : []);
    for (const [id, P] of peers) if (!wanted.has(id) && now - P.born > 6000) drop(id);
    for (const [id, m] of members) if (now - m.at > VOICE.STALE * 4) members.delete(id);
    for (const id of wanted) {
      const P = peer(id);
      if (!P.pc && offerer(me, id) && now >= P.retryAt) call(P, now);
    }
    const levels = now - levelAt >= 60; if (levels) levelAt = now;
    const speakers = [];
    let live = 0;
    for (const P of peers.values()) {
      if (!P.pc) continue;
      const st = P.pc.connectionState || P.pc.iceConnectionState;
      if (st === "connected" || st === "completed") { if (!P.live) { P.live = true; P.fails = 0; P.failNoted = false; } P.lostAt = 0; }
      else if (st === "failed" || st === "closed") { fail(P); continue; }
      else if (st === "disconnected") { P.lostAt ||= now; if (now - P.lostAt > DISCONNECT) { fail(P); continue; } }
      else if (!P.live && now - P.at > CONNECT) { fail(P); continue; }
      if (P.live) live++;
      setSend(P);
      const off = muted.has(P.id);
      if (P.nodes) {
        P.nodes.out.gain.setTargetAtTime(off ? 0 : 1, P.nodes.out.context.currentTime, 0.05);
        if (levels) { P.level = rms(P.nodes.an, P.nodes.buf); P.spk = speaking(P.spk, P.level, now); }
      }
      P.talk = talking(P.talk, !!P.spk?.on && !off, now);
      speakers.push({ id: P.id, on: !!P.spk?.on, muted: off });
    }
    if (mine && levels) { myLevel = rms(mine.an, mine.buf); mySpk = speaking(mySpk, micLive() ? myLevel : 0, now); }
    myTalk = talking(myTalk, micLive() && !!mySpk?.on, now);
    btn.style.boxShadow = micLive() ? `0 6px 14px rgba(40,50,70,.22), 0 0 0 ${Math.round(2 + Math.min(1, myLevel * 12) * 4)}px rgba(63,125,92,${mySpk?.on ? 0.55 : 0.18})` : "";
    // Only there in a trip with a friend online (or while your mic is still on, so you can turn it off):
    // on the welcome page, or alone, there's nobody to talk to.
    const friends = !!trip && list.some((m) => m.id !== me && !m.gone && now - m.at < VOICE.STALE * 2);
    btn.hidden = !(friends || want); if (btn.hidden) note.hidden = true;
    const n = btn.querySelector(".n"); n.hidden = !live; if (live && n.textContent !== String(live)) n.textContent = live;
    paintWho(speakers.filter((s) => s.on && !s.muted).map((s) => s.id));
    ducked = duckFor(speakers);
  }
  let whoKey = "";
  function paintWho(ids) {
    const key = ids.join(","); if (key === whoKey) return; whoKey = key;
    who.hidden = !ids.length;
    who.innerHTML = ids.slice(0, 4).map((id) => `<img src="${root}assets/icons/${members.get(id)?.av || "av_rider"}.png?v=1" alt="">`).join("");
  }
  setInterval(frame, TICK);

  // ---- The watchdog: whatever stopped (iOS suspends the context and pauses elements around other sound,
  // calls and the lock screen; a page's own sound may take the session), started again.
  function watch() {
    if (document.hidden) return;
    if (want) session("play-and-record");
    const c = A;
    if (c && c.state !== "running" && (peers.size || stream) && (navigator.userActivation?.hasBeenActive ?? true)) c.resume().catch(() => {});
    for (const P of peers.values()) if (P.el?.paused) P.el.play?.().catch(() => {});
    if (want && !asking && !needTap && (!stream || stream.getAudioTracks()[0]?.readyState === "ended")) { if (stream) stopMic(); getMic(); }
  }
  setInterval(watch, WATCH);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    for (const P of peers.values()) if (P.pc && !P.live) P.retryAt = 0; // back: try the lost ones at once
    sendPresence(true); watch();
  });
  addEventListener("pagehide", (e) => { if (!e.persisted) leaveRoom(); });

  function mute(id, on) {
    if (on) muted.add(id); else muted.delete(id);
    try { localStorage.setItem(MUTE, JSON.stringify([...muted].slice(-50))); } catch { /* storage off */ }
  }
  // What a friend's tag shows: connected, speaking, their rider's radio up, their 对讲机 on, muted by me.
  function stateOf(id) {
    const P = peers.get(id), off = muted.has(id);
    return { live: !!P?.live, speaking: !!P?.spk?.on && !off, talking: !!P?.talk?.on, mic: !!members.get(id)?.mic, muted: off };
  }
  async function stats() {
    const out = {};
    for (const [id, P] of peers) {
      let bytesIn = 0, bytesOut = 0;
      if (P.pc) (await P.pc.getStats()).forEach((r) => { if (r.type === "inbound-rtp" && r.kind === "audio") bytesIn += r.bytesReceived || 0; if (r.type === "outbound-rtp" && r.kind === "audio") bytesOut += r.bytesSent || 0; });
      out[id] = { state: P.pc?.connectionState || null, live: P.live, bytesIn, bytesOut, sending: !!P.sent, level: +P.level.toFixed(4), speaking: !!P.spk?.on, talking: !!P.talk?.on };
    }
    return out;
  }

  const api = {
    get micOn() { return want; }, get micLive() { return micLive(); }, setMic, room, place, unlockFrom, stateOf, mute,
    get trip() { return trip; }, get me() { return me; }, get duck() { return ducked; }, get meTalking() { return !!myTalk?.on; },
    get context() { return A; }, get stream() { return stream; }, get channel() { return ch; }, peers, members, stats, // testing
  };
  window.__voice = api;
  return api;
}

function rms(an, buf) {
  an.getByteTimeDomainData(buf);
  let s = 0; for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; s += x * x; }
  return Math.sqrt(s / buf.length);
}
