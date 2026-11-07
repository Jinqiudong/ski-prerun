// Voice while riding together (together.js makes it when friends share the ride channel). Peer to peer:
// one WebRTC connection per friend live on the channel (a mesh, at most 7 others), set up over the same
// Realtime broadcast channel ("v": offer, answer, bye; "vs": my mic and walkie-talkie). Every friend is
// connected while they're here, so I always hear them; I only send when my mic is open (to friends within
// earshot) or the walkie-talkie is held (to everyone). The mic is off until I tap it.
//   Near: a friend's voice is placed where they are (a panner from the camera) and louder the closer they
//   are (voice-core.js gainAt: clear in the same chair, gone from 150 m).
//   Walkie-talkie: hold the button; friends hear me band-passed and a little driven, with a squelch at each
//   end, and my rider raises the radio on their screen too.
// Remote audio plays through WebAudio (the engine's voice bus); a muted <audio playsinline> per friend holds
// the stream (Chrome plays nothing from a remote stream that no media element holds). With the page hidden
// (iOS stops audio and the mic), everything is hung up and comes back when the page shows again.
// The rules with no DOM are in voice-core.js; the ICE servers (STUN, an optional TURN) in voice-config.js.
import * as THREE from "three";
import { start as audioStart, duck, keepAwake } from "../audio/engine.js?v=4";
import { t } from "../core/i18n.js?v=32";
import { VOICE, gainAt, sendTo, wantPeers, offerer, retryAfter, cleanSignal, cleanVoiceState, RADIO_HOLD, speaking, duckFor, micProblem } from "./voice-core.js?v=1";
import { ICE_SERVERS } from "./voice-config.js?v=1";

const GATHER = 3000, CONNECT = 15000, DISCONNECT = 6000, KEEP_MIC = 20000, LEVEL_EVERY = 60, MUTE = "prerunVoiceMute";
const HINTS = {
  denied: "没有麦克风权限。点地址栏左边的「大小」›「网站设置」›「麦克风」选「允许」，再点一次麦克风",
  none: "没找到麦克风",
  busy: "麦克风被占用了（比如正在打电话），挂断后再试",
  insecure: "这个页面用不了麦克风（需要 https）",
  other: "麦克风打不开，再试一次",
};
const CSS = `
#vcMic { right: 14px; top: calc(278px + env(safe-area-inset-top)); flex-direction: column; gap: 0; color: #22344d; font: 600 12px/1.15 "Noto Serif SC", serif; display: flex; align-items: center; justify-content: center; }
#vcMic small { font: 600 15px/1.1 "Noto Serif SC", serif; color: #6f685f; }
#vcMic.on small { color: #bfe3cb; }
#vcMic.on { background: #22344d; color: #fdfbf6; }
#vcTalk { position: fixed; z-index: 12; left: 14px; bottom: calc(172px + env(safe-area-inset-bottom)); width: 66px; height: 66px; padding: 0; border: 2px solid #cbbfa9; border-radius: 50%; background: rgba(253,251,246,.96); color: #22344d; box-shadow: 0 6px 14px rgba(40,50,70,.22); font: 600 13px/1.2 "Noto Serif SC", serif; display: flex; flex-direction: column; align-items: center; justify-content: center; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; cursor: pointer; transition: transform .12s, background .15s; }
#vcTalk small { color: inherit; opacity: .85; font-size: 11px; }
#vcTalk.on { background: #b6463b; border-color: #fdfbf6; color: #fdfbf6; transform: scale(1.08); }
#vcMic[hidden], #vcTalk[hidden], #vcNote[hidden] { display: none; }
#vcNote { position: fixed; z-index: 13; right: 84px; top: calc(286px + env(safe-area-inset-top)); max-width: min(62vw, 270px); padding: 6px 12px; border-radius: 12px; background: rgba(253,251,246,.97); color: #22344d; box-shadow: 0 6px 14px rgba(40,30,20,.22); font: 13px/1.45 "Noto Serif SC", serif; animation: tg-in .3s ease-out; }
.tgTag.talk img { box-shadow: 0 0 0 2px #fdfbf6, 0 0 0 4px #3f7d5c; animation: vc-ring .9s ease-in-out infinite alternate; }
.tgTag.radio img { box-shadow: 0 0 0 2px #fdfbf6, 0 0 0 4px #b6463b; }
.tgTag .vc { margin-left: 2px; padding: 0 6px; border-radius: 8px; background: #22344d; color: #fdfbf6; font: 600 11px/17px "Noto Serif SC", serif; }
.tgTag.radio .vc { background: #b6463b; }
.tgTag.muted img { filter: grayscale(1); opacity: .6; } .tgTag.muted .vc { background: #8a8278; }
@keyframes vc-ring { to { box-shadow: 0 0 0 2px #fdfbf6, 0 0 0 6px rgba(63,125,92,.55); } }
`;
const loadMuted = () => { try { return new Set(JSON.parse(localStorage.getItem(MUTE) || "[]")); } catch { return new Set(); } };

// api: { ch (the ride channel), me (my member id), camera, myPos(out) (where I am, world), talk(on) (my
// rider's radio), nameOf(id) }.
export function rideVoice({ ch, me, camera, myPos, talk, nameOf }) {
  const peers = new Map(); // id → peer
  const said = new Map(); // id → { mic, r, at } from their "vs"
  const muted = loadMuted();
  let stream = null, micOn = false, radio = false, asking = null, dropAt = 0, away = document.hidden, wasMic = false;
  let mine = null, myLevel = 0, mySpk = null, ducked = 0, levelAt = 0, sentAt = 0, shown = false, awake = false;
  const v = new THREE.Vector3(), me3 = new THREE.Vector3();
  const mix = () => audioStart();

  // ---- The HUD: the mic (on / off), the walkie-talkie (hold), a line for what's going on.
  const style = document.createElement("style"); style.textContent = CSS; document.head.append(style);
  const micBtn = document.createElement("button"); micBtn.id = "vcMic"; micBtn.className = "rfab"; micBtn.hidden = true;
  const talkBtn = document.createElement("button"); talkBtn.id = "vcTalk"; talkBtn.hidden = true;
  const note = document.createElement("div"); note.id = "vcNote"; note.hidden = true; note.setAttribute("role", "status");
  const holder = document.createElement("div"); holder.hidden = true; // the friends' <audio> elements
  document.body.append(micBtn, talkBtn, note, holder);
  const paint = () => {
    micBtn.innerHTML = `<span>${t("麦克风")}</span><small>${micOn ? t("开") : t("关")}</small>`;
    micBtn.classList.toggle("on", micOn); micBtn.setAttribute("aria-pressed", micOn);
    micBtn.setAttribute("aria-label", micOn ? t("麦克风开着，点一下关掉") : t("麦克风关着，点一下打开"));
    talkBtn.innerHTML = radio ? `<span>${t("对讲中")}</span><small>${t("松开结束")}</small>` : `<span>${t("按住")}</span><span>${t("对讲")}</span>`;
    talkBtn.classList.toggle("on", radio);
  };
  paint();
  let noteT = 0;
  function say(text, ms = 5000) {
    note.textContent = text; note.hidden = !text;
    clearTimeout(noteT); if (text && ms) noteT = setTimeout(() => (note.hidden = true), ms);
  }

  // ---- My mic: asked for only from a tap (iOS), echo cancellation and noise suppression on.
  async function getMic() {
    if (stream) return stream;
    if (asking) return asking;
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) { say(t(HINTS[micProblem({ name: "insecure" })]), 8000); return null; }
    try { if (navigator.audioSession) navigator.audioSession.type = "play-and-record"; } catch { /* older Safari */ }
    mix()?.ctx.resume().catch(() => {}); // still inside the tap
    asking = md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }).then((s) => {
      stream = s; asking = null;
      const ctx = mix()?.ctx;
      if (ctx) { ctx.resume().catch(() => {}); const an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(s).connect(an); mine = { an, buf: new Uint8Array(an.fftSize) }; }
      s.getAudioTracks()[0]?.addEventListener("ended", () => { if (stream === s) dropMic(); });
      return s;
    }, (e) => {
      asking = null;
      try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch { /* older Safari */ }
      say(t(HINTS[micProblem(e)]), 12000);
      console.warn("mic", e?.name, e?.message);
      return null;
    });
    return asking;
  }
  function dropMic() {
    for (const tr of stream?.getTracks() || []) tr.stop();
    stream = null; mine = null; myLevel = 0; mySpk = null;
    for (const P of peers.values()) setSend(P, false);
    try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch { /* older Safari */ }
  }
  const track = () => stream?.getAudioTracks()[0] || null;

  micBtn.onclick = async (e) => {
    e.stopPropagation();
    if (micOn) { micOn = false; if (!radio) dropMic(); paint(); sendState(); say(t("麦克风关了"), 2500); return; }
    if (!(await getMic())) return;
    micOn = true; wasMic = false; paint(); sendState();
    say(t("麦克风开了：附近的朋友能听到你"), 3500);
  };
  // The walkie-talkie: while the finger is down. The first press may only ask for the mic.
  async function press(on) {
    if (on === radio) return;
    if (on) {
      const had = !!stream, s = await getMic();
      if (!s) return;
      if (!had && !micOn) say(t("麦克风好了，按住说话"), 3000);
      if (!down) return; // let go while the mic was being asked for
    }
    radio = on; dropAt = on ? 0 : performance.now() + KEEP_MIC;
    talk(on); paint(); sendState(); squelch(on);
    navigator.vibrate?.(on ? 25 : 15);
  }
  let down = false;
  talkBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); down = true; try { talkBtn.setPointerCapture(e.pointerId); } catch { /* fine */ } press(true); });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) talkBtn.addEventListener(ev, () => { if (!down) return; down = false; press(false); });
  talkBtn.addEventListener("contextmenu", (e) => e.preventDefault());

  // My voice state to everyone: when it changes, and every second while the walkie-talkie is up.
  function sendState(now = performance.now()) { sentAt = now; ch.broadcast("vs", { id: me, mic: micOn && !!stream, r: radio }); }

  // ---- Peers
  function peer(id) {
    let P = peers.get(id);
    if (!P) { P = { id, pc: null, n: null, tr: null, born: performance.now(), at: 0, fails: 0, retryAt: 0, live: false, lostAt: 0, sending: false, gain: 0, spk: null, level: 0, nodes: null, el: null, failNoted: false }; peers.set(id, P); }
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
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      if (P.pc !== pc) return;
      ch.broadcast("v", { id: me, to: P.id, k: "offer", n, sdp: pc.localDescription.sdp });
    } catch (e) { console.warn("voice offer", e); fail(P); }
  }
  async function answer(P, s) {
    close(P);
    const pc = (P.pc = makePc(P)); P.n = s.n; P.at = performance.now(); P.live = false;
    try {
      await pc.setRemoteDescription({ type: "offer", sdp: s.sdp });
      P.tr = pc.getTransceivers()[0]; if (P.tr) P.tr.direction = "sendrecv";
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      if (P.pc !== pc) return;
      ch.broadcast("v", { id: me, to: P.id, k: "answer", n: s.n, sdp: pc.localDescription.sdp });
    } catch (e) { console.warn("voice answer", e); fail(P); }
  }
  // Hang up one friend (tell: say so on the channel); the peer stays, to try again later.
  function close(P) {
    if (P.pc) { try { P.pc.close(); } catch { /* closed */ } }
    P.pc = null; P.tr = null; P.live = false; P.sending = false; P.lostAt = 0;
    if (P.nodes) { try { P.nodes.src.disconnect(); P.nodes.out.disconnect(); } catch { /* gone */ } P.nodes = null; }
    if (P.el) { P.el.srcObject = null; P.el.remove(); P.el = null; }
    P.spk = null; P.level = 0;
  }
  function drop(id, tell = true) {
    const P = peers.get(id); if (!P) return;
    if (tell && P.pc) ch.broadcast("v", { id: me, to: id, k: "bye", n: P.n || "x" });
    close(P); peers.delete(id);
  }
  function fail(P) {
    close(P); P.fails++; P.retryAt = performance.now() + retryAfter(P.fails);
    if (P.fails >= 3 && !P.failNoted) { P.failNoted = true; say(t("和 {name} 的语音连不上：可能是网络挡住了", { name: nameOf(P.id) }), 6000); }
  }
  // A friend's stream: held by a muted element, played through WebAudio: near (panned, by distance) and
  // radio (band-pass, a little drive) side by side, crossfaded.
  function attach(P, s) {
    if (P.el) { P.el.srcObject = null; P.el.remove(); }
    const el = (P.el = document.createElement("audio"));
    el.setAttribute("playsinline", ""); el.autoplay = true; el.muted = true; el.srcObject = s; holder.append(el);
    el.play?.().catch(() => {});
    const m = mix();
    if (!m) { el.muted = false; return; } // no WebAudio: the element plays it, plainly
    if (P.nodes) { try { P.nodes.src.disconnect(); P.nodes.out.disconnect(); } catch { /* gone */ } }
    const ctx = m.ctx, src = ctx.createMediaStreamSource(s), an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
    const pan = ctx.createPanner(); pan.panningModel = "equalpower"; pan.distanceModel = "inverse"; pan.refDistance = 1; pan.rolloffFactor = 0;
    const near = ctx.createGain(); near.gain.value = 0; src.connect(pan); pan.connect(near);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1700; bp.Q.value = 1.2;
    const drive = ctx.createGain(); drive.gain.value = 3;
    const ws = ctx.createWaveShaper(); ws.curve = softClip(); ws.oversample = "2x";
    const far = ctx.createGain(); far.gain.value = 0; src.connect(bp); bp.connect(drive); drive.connect(ws); ws.connect(far);
    const out = ctx.createGain(); near.connect(out); far.connect(out); out.connect(m.voice.input);
    P.nodes = { src, an, pan, near, far, out, buf: new Uint8Array(an.fftSize) };
  }
  // Sending to this friend or not: the track on their line, or nothing (no renegotiation).
  function setSend(P, on) {
    const tk = on ? track() : null;
    if (!P.tr || (P.sending === !!tk && P.sentTrack === tk)) return;
    P.sending = !!tk; P.sentTrack = tk;
    P.tr.sender.replaceTrack(tk).catch((e) => console.warn("voice send", e));
  }

  // ---- The channel: v (offer, answer, bye) and vs.
  function onMessage(ev, p) {
    if (ev === "vs") {
      const s = cleanVoiceState(p); if (!s || s.id === me) return;
      const was = radioOf(s.id);
      said.set(s.id, { ...s, at: performance.now() });
      if (radioOf(s.id) !== was && !muted.has(s.id) && peers.get(s.id)?.live) squelch(!was);
      return;
    }
    if (ev !== "v") return;
    const s = cleanSignal(p, me); if (!s) return;
    if (s.k === "offer") {
      if (offerer(me, s.id) || away) return; // I'm the one who offers (or not here)
      if (peers.size >= VOICE.PEERS && !peers.has(s.id)) return;
      answer(peer(s.id), s);
    } else if (s.k === "answer") {
      const P = peers.get(s.id);
      if (!P?.pc || P.n !== s.n || P.pc.signalingState !== "have-local-offer") return;
      P.pc.setRemoteDescription({ type: "answer", sdp: s.sdp }).catch((e) => { console.warn("voice answer in", e); fail(P); });
    } else if (s.k === "bye") {
      const P = peers.get(s.id); if (!P) return;
      close(P); P.retryAt = performance.now() + 2000; // they may be back in a moment (a page shown again)
    }
  }
  // A friend just joined the channel (their "hi" asks who's here): a fresh page, so a fresh call; and they
  // need to know my voice state.
  function hello(id) {
    const P = peers.get(id);
    if (P && offerer(me, id)) { close(P); P.retryAt = 0; P.fails = 0; }
    if (micOn || radio) sendState();
  }
  function radioOf(id) { const s = said.get(id); return !!s?.r && performance.now() - s.at < RADIO_HOLD; }

  // ---- Every frame (together.js, with the friends live on the channel: { id, pos, inMine, at, gone }).
  function frame(now, live) {
    const any = live.length > 0;
    if (any !== shown) { shown = any; micBtn.hidden = talkBtn.hidden = !any; if (!any && radio) { down = false; press(false); } }
    if (radio && now - sentAt > 1000) sendState(now);
    if (stream && !micOn && !radio && dropAt && now > dropAt) dropMic();
    if (away) return;
    myPos(me3);
    const dist = new Map();
    for (const f of live) dist.set(f.id, f.pos ? f.pos.distanceTo(me3) : null);
    const want = new Set(wantPeers(live.map((f) => ({ id: f.id, d: dist.get(f.id), at: f.at, gone: f.gone })), now));
    for (const [id, P] of peers) if (!want.has(id) && now - P.born > 6000) drop(id);
    if (awake !== peers.size > 0) { awake = peers.size > 0; keepAwake(awake); }
    for (const id of want) {
      const P = peer(id);
      if (!P.pc && offerer(me, id) && now >= P.retryAt) call(P, now);
    }
    const levels = now - levelAt >= LEVEL_EVERY; if (levels) levelAt = now;
    const speakers = [];
    for (const f of live) {
      const P = peers.get(f.id); if (!P?.pc) continue;
      const st = P.pc.connectionState || P.pc.iceConnectionState;
      if (st === "connected" || st === "completed") { if (!P.live) { P.live = true; P.fails = 0; P.failNoted = false; } P.lostAt = 0; }
      else if (st === "failed" || st === "closed") { fail(P); continue; }
      else if (st === "disconnected") { P.lostAt ||= now; if (now - P.lostAt > DISCONNECT) { fail(P); continue; } }
      else if (!P.live && now - P.at > CONNECT) { fail(P); continue; }
      const d = dist.get(f.id), r = radioOf(f.id);
      setSend(P, sendTo(d ?? -1, { mic: micOn, radio, sameChair: f.inMine }));
      P.gain = gainAt(d ?? -1, { sameChair: f.inMine, radio: r, muted: muted.has(f.id) });
      if (P.nodes) {
        const c = P.nodes.near.context, k = r ? 1 : 0;
        P.nodes.near.gain.setTargetAtTime(r ? 0 : P.gain, c.currentTime, 0.08);
        P.nodes.far.gain.setTargetAtTime(k * P.gain, c.currentTime, 0.03);
        if (f.pos && !r) { // where they are as I look: in the camera's frame, at one metre (the gain does distance)
          v.copy(f.pos).applyMatrix4(camera.matrixWorldInverse); if (v.lengthSq() < 1e-6) v.set(0, 0, -1); v.normalize();
          const pn = P.nodes.pan;
          if (pn.positionX) { pn.positionX.setTargetAtTime(v.x, c.currentTime, 0.05); pn.positionY.setTargetAtTime(v.y, c.currentTime, 0.05); pn.positionZ.setTargetAtTime(v.z, c.currentTime, 0.05); }
          else pn.setPosition(v.x, v.y, v.z);
        }
        if (levels) { P.level = rms(P.nodes.an, P.nodes.buf); P.spk = speaking(P.spk, P.level, now); }
      }
      speakers.push({ on: !!P.spk?.on, gain: P.gain });
    }
    if (mine && levels) { myLevel = rms(mine.an, mine.buf); mySpk = speaking(mySpk, (micOn || radio) ? myLevel : 0, now); }
    if (micOn && shown) micBtn.style.boxShadow = `0 6px 14px rgba(40,50,70,.22), 0 0 0 ${Math.round(2 + Math.min(1, myLevel * 12) * 4)}px rgba(63,125,92,${mySpk?.on ? 0.55 : 0.18})`;
    else micBtn.style.boxShadow = "";
    const a = duckFor(speakers, radio || (micOn && !!mySpk?.on));
    if (Math.abs(a - ducked) > 0.04) { ducked = a; duck(a, a ? 0.2 : 0.6); }
  }
  // What a friend's tag shows: speaking (near enough to hear), on the walkie-talkie, muted.
  function stateOf(id) {
    const P = peers.get(id);
    return { live: !!P?.live, speaking: !!P?.spk?.on && (P.gain > 0.05 || radioOf(id)), radio: radioOf(id), muted: muted.has(id), mic: !!said.get(id)?.mic, gain: P?.gain ?? 0 };
  }
  function mute(id, on) {
    if (on) muted.add(id); else muted.delete(id);
    try { localStorage.setItem(MUTE, JSON.stringify([...muted].slice(-50))); } catch { /* storage off */ }
  }

  // ---- The page hidden (another app, the lock screen): iOS stops the mic and the sound, so hang up and say
  // so; shown again, connect again (the mic waits for a tap).
  function hide() {
    if (away) return;
    away = true; wasMic = micOn;
    for (const id of [...peers.keys()]) drop(id);
    if (radio) { down = false; radio = false; talk(false); }
    micOn = false; dropMic(); paint(); sendState(); awake = false; keepAwake(false); duck(0); ducked = 0;
    if (shown) say(t("语音已断开，回到页面后重新连接"), 0);
  }
  function show() {
    if (!away) return;
    away = false;
    if (!shown) return say("");
    say(wasMic ? t("语音重新连接了。麦克风关着，点一下再打开") : t("语音重新连接了"), 4000);
  }
  document.addEventListener("visibilitychange", () => (document.hidden ? hide() : show()));
  addEventListener("pagehide", () => { for (const id of [...peers.keys()]) drop(id); dropMic(); });

  // ---- Sound bits: the squelch at each end of a walkie-talkie call, the level of a stream.
  let noise = null;
  function squelch(open) {
    const m = mix(); if (!m || m.ctx.state !== "running") return;
    const ctx = m.ctx, at = ctx.currentTime + 0.01;
    if (!noise) { noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate); const d = noise.getChannelData(0); let s = 7; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; } }
    const src = ctx.createBufferSource(); src.buffer = noise;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = open ? 2600 : 1900; bp.Q.value = 0.8;
    const g = ctx.createGain(), len = open ? 0.07 : 0.16;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(open ? 0.22 : 0.3, at + 0.004); g.gain.setTargetAtTime(0, at + len * 0.5, len / 3);
    src.connect(bp); bp.connect(g); g.connect(m.voice.input); src.start(at); src.stop(at + len + 0.1);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = open ? 1400 : 900; // the click
    og.gain.setValueAtTime(0.18, at); og.gain.exponentialRampToValueAtTime(0.001, at + 0.03);
    o.connect(og); og.connect(m.voice.input); o.start(at); o.stop(at + 0.04);
  }

  window.__voice = { peers, said, muted, get micOn() { return micOn; }, get radio() { return radio; }, get stream() { return stream; }, get away() { return away; }, get ducked() { return ducked; }, press, stateOf, hide, show,
    async stats() { const out = {}; for (const [id, P] of peers) { let bytes = 0, sent = 0; if (P.pc) (await P.pc.getStats()).forEach((r) => { if (r.type === "inbound-rtp" && r.kind === "audio") bytes += r.bytesReceived || 0; if (r.type === "outbound-rtp" && r.kind === "audio") sent += r.bytesSent || 0; }); out[id] = { state: P.pc?.connectionState || null, live: P.live, bytesIn: bytes, bytesOut: sent, sending: P.sending, gain: +P.gain.toFixed(3), level: +P.level.toFixed(4), speaking: !!P.spk?.on, radio: radioOf(id), farGain: P.nodes ? +P.nodes.far.gain.value.toFixed(3) : null, nearGain: P.nodes ? +P.nodes.near.gain.value.toFixed(3) : null }; } return out; } }; // testing
  return { onMessage, hello, frame, stateOf, radioOf, mute, drop };
}

function softClip(k = 4, n = 1024) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  return c;
}
function rms(an, buf) {
  an.getByteTimeDomainData(buf);
  let s = 0; for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; s += x * x; }
  return Math.sqrt(s / buf.length);
}
