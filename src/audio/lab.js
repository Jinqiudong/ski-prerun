// The sound lab (sound.html): every sound the ride makes, played live with the knobs that drive it, next
// to real field recordings and music candidates (assets/audio/lab/manifest.json), so the owner can listen
// A/B and tick what we should use. Picks are kept on this phone (localStorage "prerunSoundLab").
// It uses the game's own sound code (snow.js, ambience.js, music.js) but changes nothing in the game.
import { EN_ON } from "../core/i18n.js?v=30";
import { makeMixer } from "./engine.js?v=4";
import { BoardSound } from "./snow.js?v=3";
import { Ambience } from "./ambience.js?v=3";
import { Music } from "./music.js?v=2";

const EN = {
  声音样品室: "Sound lab", 选这个: "Pick", 合成: "Synth", 真实录音: "Recording", 生成音乐: "Generated", 真实音乐: "Real music", 我的选择: "My picks", 复制: "Copy", 已复制: "Copied",
  还没有选: "Nothing picked yet", 播放: "Play", 停: "Stop", "雪板和雪": "Board on snow", 风: "Wind", 缆车: "The lift", 山上: "On the mountain", 音乐: "Music",
  "没找到能放心用的真实录音": "No real recording with a clear licence found", 加载中: "loading", 来源: "source",
  速度: "Speed", 立刃: "Edge", 连续转弯: "Linked turns", 起始速度: "Start speed", "0 蹬行 · 1 走路": "0 push · 1 walk", 高度: "Height", 防风罩放下: "Bubble down", "播放速度 ×": "Ride speed ×", 离站多近: "Near the station",
  intro: "Every sound can be played and compared. \"Synth\" is what the game uses now; drag its sliders to hear it change. \"Recording\" is a real candidate to replace it. One plays at a time; tick \"Pick\" on what feels right, then copy your picks below to us.",
  footer: "Real recordings come from Freesound (CC0) and OpenGameArt (CC0); each one's author, licence and source are under it and in assets/audio/lab/manifest.json.",
};
const tt = (s) => (EN_ON ? EN[s] ?? s : s);
const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
const $ = (s, r = document) => r.querySelector(s);
const PICKS = "prerunSoundLab";
const picks = (() => { try { return JSON.parse(localStorage.getItem(PICKS) || "{}"); } catch { return {}; } })();
const savePicks = () => { try { localStorage.setItem(PICKS, JSON.stringify(picks)); } catch { /* private mode */ } };

// ---- the live synth: the game's board, air and lift, driven by the sliders ----
let A = null, mix = null, board = null, amb = null, music = null, playing = null, last = 0;
async function audio() {
  if (A) return;
  A = new (window.AudioContext || window.webkitAudioContext)();
  mix = makeMixer(A); mix.music.level.gain.value = 0.6; mix.master.gain.value = 0.85;
  board = new BoardSound(A, mix.sfx.input); amb = new Ambience(A, mix.ambience.input, mix.reverb, mix.sfx.input);
  music = new Music(A, mix); await music.load("assets/audio/music/manifest.json");
  requestAnimationFrame(loop);
}
const quietAir = () => { const t = A.currentTime; for (const g of [amb.windLoG, amb.windHiG, amb.bedG, amb.humG, amb.stationG]) g.gain.setTargetAtTime(0, t, 0.1); amb.last = {}; };
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
  if (playing?.tick) { playing.t += dt; playing.tick(playing.t, dt, playing.p); }
  requestAnimationFrame(loop);
}
const still = { speed: 0, lean: 0, skid: 0, tuck: 0 };
// A scripted stop: ride in, then skid to a standstill, rest, again.
const stopRun = (surface) => (t, dt, p, st = stopRun.st) => {
  board.setSurface(surface); const k = t % 7;
  if (k < dt * 1.5) st.v = p.speed;
  const sk = k > 1.6 && k < 6 ? 1 : 0;
  if (sk) st.v = Math.max(0, st.v - 6.8 * dt);
  board.update(k > 6 ? still : { speed: st.v, lean: sk ? 0.25 : 0.4 * Math.sin(k * 2), skid: sk }, { dt });
  amb.update({ wind: st.v / 15, bed: 0.35 }, dt);
};
stopRun.st = { v: 0 };
const carve = (surface) => (t, dt, p) => {
  board.setSurface(surface);
  board.update({ speed: p.speed, lean: 0.75 * p.edge * (p.turns ? Math.sin((t / 3) * 2 * Math.PI) : 1), skid: 0 }, { dt });
  amb.update({ wind: p.speed / 15, bed: 0.35 }, dt);
};
const S = (key, label, min, max, step, value, unit = "") => ({ key, label, min, max, step, value, unit });
const SYNTH = [
  { id: "syn-glide", group: "board", title: "滑行（板底平放）", en: "Glide (flat base)", params: [S("speed", "速度", 0, 20, 0.5, 10, "m/s")], tick: (t, dt, p) => { board.setSurface("groomed"); board.update({ speed: p.speed, lean: 0.05, skid: 0, tuck: 0.4 }, { dt }); amb.update({ wind: p.speed / 15, bed: 0.35 }, dt); } },
  { id: "syn-carve", group: "board", title: "刻滑（压雪道）", en: "Carve (groomed)", params: [S("speed", "速度", 3, 20, 0.5, 10, "m/s"), S("edge", "立刃", 0, 1, 0.05, 0.7), S("turns", "连续转弯", 0, 1, 1, 1)], tick: carve("groomed") },
  { id: "syn-skid", group: "board", title: "刹车（横滑停下）", en: "Skid stop", params: [S("speed", "起始速度", 4, 18, 0.5, 12, "m/s")], tick: stopRun("groomed") },
  { id: "syn-powder", group: "board", title: "粉雪刻滑", en: "Powder carve", params: [S("speed", "速度", 3, 20, 0.5, 12, "m/s"), S("edge", "立刃", 0, 1, 0.05, 0.6), S("turns", "连续转弯", 0, 1, 1, 1)], tick: carve("powder") },
  { id: "syn-ice", group: "board", title: "冰面刹车", en: "Skid on ice", params: [S("speed", "起始速度", 4, 18, 0.5, 12, "m/s")], tick: stopRun("ice") },
  { id: "syn-push", group: "board", title: "蹬行 / 走路", en: "Push / walk", params: [S("walk", "0 蹬行 · 1 走路", 0, 1, 1, 0)], tick: (t, dt, p) => { board.setSurface("groomed"); board.update({ speed: p.walk ? 1.2 : 2, lean: 0, skid: 0, pushing: !p.walk, walking: !!p.walk }, { dt }); amb.update({ wind: 0.1, bed: 0.4 }, dt); } },
  { id: "syn-ollie", group: "board", title: "跳起 + 落地", en: "Ollie + landing", params: [S("air", "高度", 0.3, 1.5, 0.1, 1.2, "m")], tick: (t, dt, p) => { board.setSurface("groomed"); const f = ((t % 4) - 1.5) / 1.05, air = f > 0 && f < 1 ? p.air * 4 * f * (1 - f) : 0; board.update({ speed: 10, lean: 0.15, skid: 0 }, { air, dt }); amb.update({ wind: 0.66, bed: 0.35 }, dt); } },
  { id: "syn-wind", group: "wind", title: "风（随速度）", en: "Wind with speed", params: [S("speed", "速度", 0, 25, 0.5, 12, "m/s")], tick: (t, dt, p) => { board.hush(); amb.update({ wind: p.speed / 15, bed: 0.35 }, dt); } },
  { id: "syn-hum", group: "lift", title: "缆绳嗡声（坐缆车）", en: "Rope hum on the chair", params: [S("shelter", "防风罩放下", 0, 1, 1, 0)], tick: (t, dt, p) => { board.hush(); amb.update({ wind: 0.38, bed: 0.45, hum: 1, shelter: p.shelter }, dt); } },
  { id: "syn-tower", group: "lift", title: "经过缆车塔（滑轮组）", en: "Passing a tower (sheave train)", params: [S("rate", "播放速度 ×", 1, 4, 1, 1)], tick: (t, dt, p, st = SYNTH.towerSt) => { board.hush(); amb.update({ wind: 0.38, bed: 0.45, hum: 1 }, dt); st.next ??= 0.5; if (t >= st.next) { amb.tower(1, p.rate); st.next = t + 5.7 / p.rate; } } },
  { id: "syn-station", group: "lift", title: "站房机器", en: "Station machinery", params: [S("level", "离站多近", 0, 1, 0.05, 0.9)], tick: (t, dt, p) => { board.hush(); amb.update({ wind: 0.15, bed: 0.4, hum: 0.5 * p.level, station: p.level }, dt); } },
  { id: "syn-bed", group: "mountain", title: "山顶的安静", en: "The quiet at the top", params: [], tick: (t, dt) => { board.hush(); amb.update({ wind: 0.12, bed: 1, hum: 0.1, station: 0.3 }, dt); } },
];
SYNTH.towerSt = {};
const GROUPS = [["board", "雪板和雪"], ["wind", "风"], ["lift", "缆车"], ["mountain", "山上"], ["music", "音乐"]];

// ---- one thing plays at a time ----
const els = new Map(); // id -> <audio> for files
function stopAll() {
  if (playing) { playing.row.classList.remove("on"); playing.row.querySelector(".play").textContent = "▶"; }
  if (playing?.el) { playing.el.pause(); }
  if (A) { board.hush(); quietAir(); music.stop(0.6); }
  playing = null;
}
async function toggle(item, row) {
  const was = playing?.item === item; stopAll(); if (was) return;
  await audio(); if (A.state !== "running") await A.resume();
  playing = { item, row, t: 0, p: values(row, item) }; SYNTH.towerSt = {};
  row.classList.add("on"); row.querySelector(".play").textContent = "■";
  if (item.tick) playing.tick = item.tick;
  else if (item.gen) music.play(item.id, 0, 0.5);
  else {
    let el = els.get(item.id);
    if (!el) { el = new Audio(`assets/audio/lab/${item.file}`); el.loop = !!item.loop; el.preload = "auto"; els.set(item.id, el); el.onended = () => { if (playing?.el === el) stopAll(); }; }
    el.currentTime = 0; el.play().catch(() => {}); playing.el = el;
  }
}
const values = (row, item) => Object.fromEntries((item.params || []).map((q) => [q.key, +row.querySelector(`[data-k="${q.key}"]`).value]));

// ---- the page ----
function rowHtml(item, kind) {
  const note = item.file ? `${esc(item.author)} · ${esc(item.licence)} · <a href="${esc(item.source)}" target="_blank" rel="noopener">${tt("来源")}</a>${item.note ? ` · ${esc(EN_ON ? item.noteEn || item.note : item.note)}` : ""}` : item.gen ? `${tt("生成音乐")} · CC0 · ${esc(item.mood)}` : "";
  return `<div class="row ${kind}" data-id="${esc(item.id)}">
    <button class="play" aria-label="${tt("播放")}">▶</button>
    <div class="what"><span class="tag">${tt(kind === "syn" ? "合成" : kind === "gen" ? "生成音乐" : kind === "realmusic" ? "真实音乐" : "真实录音")}</span><b>${esc(EN_ON ? item.en || item.title : item.title)}</b><small>${note}</small>
      ${(item.params || []).map((q) => `<label>${tt(q.label)} <input type="range" data-k="${q.key}" min="${q.min}" max="${q.max}" step="${q.step}" value="${q.value}"><output>${q.value}${q.unit ? " " + q.unit : ""}</output></label>`).join("")}</div>
    <label class="pick"><input type="checkbox" ${picks[item.id] ? "checked" : ""}><span>${tt("选这个")}</span></label></div>`;
}
function summary(all) {
  const box = $("#picks"), chosen = all.filter((x) => picks[x.id]);
  const name = (x) => `${EN_ON ? x.en || x.title : x.title}${x.author ? ` (${x.author})` : ""}`;
  const text = chosen.length ? GROUPS.map(([g, label]) => { const c = chosen.filter((x) => x.group === g); return c.length ? `${tt(label)}: ${c.map(name).join("; ")}` : ""; }).filter(Boolean).join("\n") : tt("还没有选");
  box.querySelector("pre").textContent = `${tt("声音样品室")} · ${tt("我的选择")}\n${text}`;
}

async function main() {
  const lab = await (await fetch("assets/audio/lab/manifest.json")).json();
  const gen = (await (await fetch("assets/audio/music/manifest.json")).json()).tracks.map((x) => ({ ...x, group: "music", en: x.title }));
  const real = lab.items.map((x) => ({ ...x, en: x.titleEn || x.title }));
  const all = [...SYNTH, ...real, ...gen];
  const body = $("#groups");
  body.innerHTML = GROUPS.map(([g, label]) => {
    const syn = g === "music" ? gen : SYNTH.filter((x) => x.group === g), rec = real.filter((x) => x.group === g);
    const missing = (lab.missing || []).filter((m) => m.group === g);
    return `<section class="card"><h2>${tt(label)}</h2>
      ${syn.map((x) => rowHtml(x, g === "music" ? "gen" : "syn")).join("")}
      ${rec.map((x) => rowHtml(x, g === "music" ? "realmusic" : "rec")).join("")}
      ${missing.map((m) => `<p class="gap">${esc(EN_ON ? m.en : m.zh)} · ${tt("没找到能放心用的真实录音")}</p>`).join("")}</section>`;
  }).join("");
  const byId = new Map(all.map((x) => [x.id, x]));
  for (const row of body.querySelectorAll(".row")) {
    const item = byId.get(row.dataset.id);
    row.querySelector(".play").onclick = () => toggle(item, row);
    for (const r of row.querySelectorAll("input[type=range]")) r.oninput = () => {
      const q = item.params.find((p) => p.key === r.dataset.k); r.nextElementSibling.textContent = `${r.value}${q.unit ? " " + q.unit : ""}`;
      if (playing?.item === item) playing.p = values(row, item);
    };
    row.querySelector(".pick input").onchange = (e) => { if (e.target.checked) picks[item.id] = 1; else delete picks[item.id]; savePicks(); summary(all); };
  }
  $("#copy").onclick = async () => { try { await navigator.clipboard.writeText($("#picks pre").textContent); $("#copy").textContent = tt("已复制"); setTimeout(() => ($("#copy").textContent = tt("复制")), 1500); } catch { /* select it by hand */ } };
  summary(all);
  window.__lab = { all, picks, toggle: (id) => toggle(byId.get(id), body.querySelector(`[data-id="${id}"]`)), stopAll, state: () => ({ ctx: A?.state, playing: playing?.item.id, el: playing?.el ? { t: playing.el.currentTime, err: playing.el.error?.code ?? null } : null }) };
}
for (const el of document.querySelectorAll("[data-t]")) if (EN_ON) el.textContent = tt(el.dataset.t); // Chinese is in the page itself
main().catch((e) => { $("#groups").textContent = String(e); console.error(e); });
