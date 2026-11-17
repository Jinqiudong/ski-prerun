// The resort page: the resort as one lit relief block (src/mountain/relief.js), framed from its bases looking
// up the mountain, a flag at each base. Tap a flag: that base's lifts glow gold with their top heights, and the
// card at the bottom lists them, one row each; tap a row to ride it. One page, no second view.
import * as THREE from "three";
import { Terrain } from "../ride/world.js?v=5";
import { Relief } from "./relief.js?v=1";
import { solar, weatherKind, WEATHER_ZH } from "../ride/sky.js?v=2";
import { addStep } from "../ride/roadbook.js?v=32";
import { translatePage, myAvatar, t as tr, EN_ON as EN } from "../core/i18n.js?v=51";
import { openNav } from "../core/nav.js?v=28";
import { liftTicket } from "../core/transition.js?v=21";
import { startParty } from "../core/party.js?v=24";
import { guard, pixelRatio, freeOnLeave, shadowSize, PHONE } from "../core/detail.js?v=1";
import { bunnySpot } from "../ride/practice-core.js?v=2";
import { load as loadCond, save as saveCond, choose, dateAt, LIVE } from "../core/conditions.js?v=2";
import { regionOf } from "../core/regions.js?v=1";
import { buildGraph, LEVELS } from "../core/route.js?v=8";
import { liftInfo, recommend, tipParts } from "./liftinfo-core.js?v=1";

// Which resort: ?resort=, else the one picked on the start screen. Its place comes with its data.
const RESORT_ID = (() => { try { return new URLSearchParams(location.search).get("resort") || JSON.parse(localStorage.getItem("prerun") || "{}").resort || "copper"; } catch { return "copper"; } })().replace(/[^a-z0-9-]/g, "");
const RESORT = { lat: 39.4775, lon: -106.1605, tz: "America/Denver", name: "Copper Mountain" };
// The party (src/core/party.js): its pet on the right edge; in a party, a lift row calls everyone to ride it
// together (一起坐) instead of going alone.
const party = startParty({ page: "resort", root: "../", resort: RESORT_ID });
const $ = (id) => document.getElementById(id);
const status = (t) => { $("status").textContent = t; return new Promise((r) => setTimeout(r, 20)); };
const IC = (n) => `../assets/icons/${n}.png?v=1`;

guard("resort"); // killed for memory last time: lighter from now on (core/detail.js)
const renderer = new THREE.WebGLRenderer({ canvas: $("c"), antialias: true });
renderer.setPixelRatio(pixelRatio());
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NoToneMapping; // flat print colours, as the mock
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // the block and the sun stay put: the shadows are drawn when they change
freeOnLeave(renderer);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 50, 200000);

const EL = (34 * Math.PI) / 180; // the camera's height angle
const BASE_RADIUS = 350; // lift bottoms within this distance belong to the base
const RIDEABLE = ["chair_lift", "mixed_lift", "gondola", "cable_car"];
// Copper is seen from its villages to the north (bearing from the middle to the camera); the sun stands
// low behind the mountain to the side, as in the mock. Other resorts turn both to face their own bases.
const COPPER_CAM = Math.atan2(-0.92, 0.38), SUN_TURN = Math.atan2(0.39, -0.84) - COPPER_CAM, SUN_EL = (22 * Math.PI) / 180;

async function main() {
  await status("下载地形…");
  const R = await fetch(`../data/${RESORT_ID}.json`).then((r) => r.json());
  Object.assign(RESORT, { lat: R.origin.lat, lon: R.origin.lon, name: R.name }); // Colorado and Utah: both on Mountain Time (America/Denver)
  party.setRn(R.name);
  document.title = `${R.name} · 雪场预滑`;
  document.querySelector("#title b").textContent = R.name;
  fetch("../data/resorts.json").then((r) => r.json()).then((list) => {
    const me = list.find((x) => x.id === RESORT_ID);
    if (me) document.querySelector("#title i").textContent = regionOf(me).en.toUpperCase(); // COLORADO, UTAH
    if (me?.skiOnly) $("heights").textContent = tr("只许双板"); // Alta, Deer Valley: no snowboards
  }).catch(() => {});

  await status("生成山体…");
  const T = new Terrain(R);
  const relief = new Relief({ scene, T, R, phone: PHONE, shadow: shadowSize(), resolution: new THREE.Vector2(innerWidth, innerHeight) });
  addEventListener("pagehide", (e) => { if (!e.persisted) relief.dispose(); });

  // Which way the camera looks: from the bases toward the middle of the lifts, up the mountain.
  const villages = R.places.filter((p) => p.kind === "village");
  const liftPts = R.lifts.filter((l) => l.kind !== "magic_carpet").flatMap((l) => l.pts);
  const mx = liftPts.reduce((a, p) => a + p[0], 0) / liftPts.length, mz = liftPts.reduce((a, p) => a + p[1], 0) / liftPts.length;
  let home = COPPER_CAM;
  if (RESORT_ID !== "copper" && villages.length) {
    const bx = villages.reduce((a, p) => a + p.x, 0) / villages.length - mx, bz = villages.reduce((a, p) => a + p.z, 0) / villages.length - mz;
    if (Math.hypot(bx, bz) > 200) home = Math.atan2(bz, bx);
    // never square on to a side of the block: at least Copper's 22.5° off it, so it reads as a block
    const q = Math.PI / 2, off = home - Math.round(home / q) * q, min = Math.PI / 8;
    if (Math.abs(off) < min) home += (off < 0 ? -min : min) - off;
  }
  const sunAng = home + SUN_TURN;
  const sunDir = new THREE.Vector3(Math.cos(sunAng) * Math.cos(SUN_EL), Math.sin(SUN_EL), Math.sin(sunAng) * Math.cos(SUN_EL));

  // ---------- Day or dusk, by the hour at the resort (or the hour chosen on the weather chip) ----------
  const look = { live: true, date: new Date(), kind: "clear", liveKind: "clear", temp: null, mode: null };
  const cond0 = loadCond(localStorage, RESORT_ID);
  if (!cond0.live) Object.assign(look, { live: false, date: dateAt(cond0.hour, RESORT.tz), kind: cond0.sky });
  const keepCond = () => saveCond(localStorage, RESORT_ID, look.live ? LIVE : choose(LIVE, { hour: +$("hour").value, sky: look.kind }, { liveSky: look.liveKind }));
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${RESORT.lat}&longitude=${RESORT.lon}&current=temperature_2m,weather_code,cloud_cover&timezone=${encodeURIComponent(RESORT.tz)}`;
  const fetchWeather = async () => {
    try {
      const w = await (await fetch(weatherUrl)).json();
      look.liveKind = weatherKind(w.current.weather_code, w.current.cloud_cover);
      if (look.live) look.kind = look.liveKind;
      look.temp = w.current.temperature_2m;
    } catch { /* offline: keep the last weather */ }
  };
  const FORCE = new URLSearchParams(location.search).get("look"); // ?look=day|dusk for previews
  const applyLook = () => {
    const el = (solar(look.date, RESORT.lat, RESORT.lon).el * 180) / Math.PI, day = el > 0;
    const mode = FORCE === "day" || FORCE === "dusk" ? FORCE : el > 7 ? "day" : "dusk";
    if (mode !== look.mode) {
      look.mode = mode;
      const L = relief.setLook(mode, sunDir);
      scene.background = new THREE.Color(L.bg);
      document.documentElement.style.background = L.bg;
      document.body.classList.toggle("dusk", mode === "dusk");
      renderer.shadowMap.needsUpdate = true;
      dirty = true;
    }
    const local = look.date.toLocaleTimeString("zh-CN", { timeZone: RESORT.tz, hour: "2-digit", minute: "2-digit" });
    $("nowIcon").src = IC({ clear: day ? "sunny" : "partly", cloudy: "partly", overcast: "cloudy", snow: "snow_now" }[look.kind] || "cloudy");
    $("now").classList.toggle("chosen", !look.live);
    $("now").title = `${tr(look.live ? "现在" : "自选")} · ${tr(WEATHER_ZH[look.kind])}${look.temp !== null && look.live ? ` ${Math.round(look.temp)}°C` : ""}`;
    $("nowTime").textContent = local;
  };
  let dirty = true;
  await fetchWeather();
  applyLook();
  setInterval(() => { if (look.live) { look.date = new Date(); applyLook(); } }, 60000);
  // The panel under the chip: slide to any hour (local), tap a weather; 实时 brings back now and the real
  // weather together. The ride goes up in what is chosen here (src/core/conditions.js).
  const fmtH = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
  const hourNow = () => { const d = new Date(), [h, m] = d.toLocaleTimeString("en-GB", { timeZone: RESORT.tz, hour: "2-digit", minute: "2-digit" }).split(":"); return +h + m / 60; };
  const sync = () => {
    if (look.live) $("hour").value = hourNow();
    $("tpTime").textContent = fmtH(+$("hour").value);
    $("tpLive").classList.toggle("on", look.live);
    document.querySelectorAll("[data-wx]").forEach((b) => b.classList.toggle("on", b.dataset.wx === look.kind));
  };
  { // sunrise and sunset today: where the sun crosses the horizon
    const day0 = new Date(); let rise = 7, set = 17, prev = null;
    for (let q = 0; q < 96; q++) { const h = q / 4, d = new Date(day0.getTime() + (h - hourNow()) * 3600000), up = solar(d, RESORT.lat, RESORT.lon).el > 0;
      if (prev !== null && up !== prev) up ? (rise = h) : (set = h); prev = up; }
    const at = (id, h) => ($(id).style.left = `${(h / 23.75) * 100}%`);
    at("tpRise", rise); at("tpNoon", 12); at("tpSet", set);
  }
  $("hour").addEventListener("input", () => {
    look.live = false;
    look.date = new Date(Date.now() + (+$("hour").value - hourNow()) * 3600000);
    applyLook(); sync(); keepCond();
  });
  document.querySelectorAll("[data-wx]").forEach((b) => b.addEventListener("click", () => {
    if (look.live) { look.live = false; $("hour").value = hourNow(); } // keep the time where it is
    look.kind = b.dataset.wx; applyLook(); sync(); keepCond();
  }));
  $("tpLive").addEventListener("click", async () => { look.live = true; look.date = new Date(); keepCond(); await fetchWeather(); applyLook(); sync(); });
  if (!look.live) $("hour").value = cond0.hour;
  sync();
  $("now").addEventListener("click", () => $("timePanel").classList.toggle("show"));
  // Back from the ride (the page kept in memory): the pill there may have changed the conditions.
  addEventListener("pageshow", async (e) => {
    if (!e.persisted) return;
    const c = loadCond(localStorage, RESORT_ID);
    if (c.live) { look.live = true; look.date = new Date(); await fetchWeather(); }
    else { Object.assign(look, { live: false, date: dateAt(c.hour, RESORT.tz), kind: c.sky }); $("hour").value = c.hour; }
    applyLook(); sync(); dirty = true;
  });

  // ---------- Bases, their lifts, the bunny hill ----------
  const nearestBase = (x, z) => villages.reduce((best, b) => (!best || Math.hypot(b.x - x, b.z - z) < Math.hypot(best.x - x, best.z - z) ? b : best), null);
  // The bunny hill (宝宝坡, practice-core.js): its lift is a row in its base's list under its real name (the
  // nearest base's when its bottom is further out); a hill with no lift gets a row of its own there.
  const bunny = bunnySpot(R, (x, z) => T.heightAt(x, z));
  const bunnyLift = bunny.kind === "lift" ? R.lifts.find((l) => l.name === bunny.lift) || null : null;
  const bunnyBase = bunnyLift ? nearestBase(...bunnyLift.pts[0]) : nearestBase(bunny.x, bunny.z);
  const liftsAt = (base) => {
    const ls = R.lifts.filter((l) => Math.hypot(l.pts[0][0] - base.x, l.pts[0][1] - base.z) < BASE_RADIUS && RIDEABLE.includes(l.kind)).sort((a, b) => b.rise - a.rise);
    if (bunnyLift && base === bunnyBase && !ls.includes(bunnyLift)) ls.push(bunnyLift);
    return ls;
  };
  const KIND_ZH = { magic_carpet: "魔毯", rope_tow: "拖牵", "t-bar": "拖牵", platter: "拖牵", drag_lift: "拖牵", chair_lift: "缆车" };
  const liftName = (l) => (!l.name || l.name === "Lift" ? tr(KIND_ZH[l.kind] || "缆车") : l.name);
  const liftLen = (l) => l.length || l.pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - l.pts[i - 1][0], p[1] - l.pts[i - 1][1]) : 0), 0);
  const minsOf = (l) => Math.max(1, Math.round(liftLen(l) / 4.5 / 60)); // the ride up, as the lift cards always said
  const together = () => party.in && party.members().length > 0;
  // What each lift's top leads to (liftinfo-core.js): the runs leaving it, the lifts in reach; worked out once
  // per lift, from the same route graph as the ride's lift top. The rider's level as the ride reads it.
  const graph = buildGraph(R, (x, z) => T.heightAt(x, z));
  const infos = new Map(), infoOf = (l) => { if (!infos.has(l)) infos.set(l, liftInfo(R, graph, l)); return infos.get(l); };
  const myLevel = (() => { try { const l = JSON.parse(localStorage.getItem("prerun") || "{}").level; return LEVELS.includes(l) ? l : "intermediate"; } catch { return "intermediate"; } })();
  const SYM = (lv) => `<i class="sym ${lv}"></i>`;
  const infoHtml = (i) => {
    const runs = Object.entries(i.counts).map(([lv, n]) => `<span class="lv">${SYM(lv)}${n}</span>`).join("");
    return `<span class="l1"><b>${i.seats}</b>${runs ? `<i class="dot">·</i>${runs}` : ""}</span>${i.change.length ? `<span class="l2">可换 ${i.change.length} 条</span>` : ""}`;
  };

  // The flags: one per base, a pill on a thin post standing at the base.
  const flagBox = $("flags"), tagBox = $("tops");
  const flags = villages.map((base) => {
    const el = document.createElement("button");
    el.className = "flag";
    el.setAttribute("translate", "no");
    el.innerHTML = `<span class="pill">${base.name}</span><i class="post"></i>`;
    el.addEventListener("click", (e) => { e.stopPropagation(); pick === base ? null : select(base); });
    flagBox.append(el);
    return { base, el, pill: el.firstChild, post: el.lastChild, pos: new THREE.Vector3(base.x, relief.Y(base.x, base.z), base.z), at: null };
  });

  // ---------- Choosing a base ----------
  let pick = null, tops = [];
  function select(base) {
    pick = base;
    const ls = base ? liftsAt(base) : [];
    relief.choose(base, ls.filter((l) => l.kind !== "magic_carpet"));
    for (const f of flags) { f.el.classList.toggle("on", f.base === base); f.el.classList.toggle("off", !!base && f.base !== base); f.at = null; }
    document.body.classList.toggle("picked", !!base);
    party.setSub(base ? "base" : "");
    // a thin gold pin at each lift's top: its name, its height
    tagBox.innerHTML = "";
    tops = ls.filter((l) => relief.lifts.has(l)).map((l) => {
      const el = document.createElement("div");
      el.className = "top";
      el.setAttribute("translate", "no");
      const p = relief.topOf(l);
      el.innerHTML = `<span class="lab"><small>${liftName(l)}</small><b>${Math.round(T.data.hmin + T.heightAt(p.x, p.z))} M</b></span><i class="tri"></i><i class="post"></i><span class="info">${infoHtml(infoOf(l))}</span>`;
      tagBox.append(el);
      return { l, el, lab: el.children[0], tri: el.children[1], post: el.children[2], info: el.children[3], pos: p, at: null, infoAt: null };
    });
    fillSheet(base, ls);
    if (base) navigator.vibrate?.(8);
    aim();
  }
  // The card: the base's name, then a row per lift: icon, name, the minutes up. Tap a row to ride it.
  function fillSheet(base, ls) {
    const rows = $("rows");
    rows.innerHTML = "";
    if (!base) return;
    $("eyebrow").textContent = base.name;
    // One tip: the lift to ride first at your level (the most runs you can ski leaving its top, the shorter
    // ride on a tie), or, honestly, that none has one. Its row gets a small 推荐.
    const cands = ls.filter((l) => l !== bunnyLift && relief.lifts.has(l)).map((l) => ({ lift: l, minutes: minsOf(l) }));
    const rec = cands.length ? recommend(R, graph, cands, myLevel) : undefined;
    $("tip").hidden = rec === undefined;
    if (rec !== undefined) {
      $("tip").innerHTML = "";
      for (const p of tipParts(rec, myLevel, { bunny: base === bunnyBase })) {
        if (typeof p === "string") $("tip").append(p);
        else { const b = document.createElement("b"); b.setAttribute("translate", "no"); b.textContent = p.lift; $("tip").append(b); }
      }
    }
    const row = (icon, name, right, go, tag) => {
      const b = document.createElement("button");
      b.className = "row";
      b.innerHTML = `<img src="${IC(icon)}" alt=""><b translate="no">${name}</b>${tag ? `<em>${tag}</em>` : ""}<span>${right}</span>`;
      b.addEventListener("click", go);
      rows.append(b);
      return b;
    };
    for (const l of ls) {
      const r = row(l === bunnyLift ? "practice" : "lift", liftName(l), "", () => { if (together() && l !== bunnyLift) party.callLift(l.name, RESORT_ID, R.name); else go(l); }, rec?.lift === l ? "推荐" : "");
      r.l = l;
    }
    if (!bunnyLift && base === bunnyBase) { // a gentle slope with no lift of its own
      const name = bunny.kind === "run" ? tr("{name} 宝宝坡", { name: bunny.name || tr("绿道") }) : tr("{name} 旁的缓坡", { name: bunny.name });
      row("practice", name, EN ? "Practise ›" : "去练习 ›", goPractice);
    }
    if (!rows.children.length) rows.innerHTML = `<p class="none">${EN ? "No lift leaves from here" : "这里没有缆车出发"}</p>`;
    labelRows();
  }
  const labelRows = () => {
    for (const r of $("rows").children) if (r.l) {
      const k = r.l === bunnyLift ? (EN ? "Bunny hill ›" : "宝宝坡 ›") : together() ? (EN ? "Ride together ›" : "一起坐 ›") : EN ? `${minsOf(r.l)} min ›` : `${minsOf(r.l)} 分钟 ›`;
      const s = r.querySelector("span"); if (s.textContent !== k) s.textContent = k;
    }
  };
  setInterval(labelRows, 1000); // joining or leaving a party turns the rows into 一起坐

  const goPractice = () => {
    if (pick) addStep(RESORT_ID, { k: "base", name: pick.name });
    const to = () => (location.href = `../look.html?practice=1&resort=${RESORT_ID}`);
    if (typeof DeviceOrientationEvent?.requestPermission === "function") DeviceOrientationEvent.requestPermission().catch(() => "denied").finally(to); // iOS: tilt to ride
    else to();
  };
  function go(l) {
    if (l === bunnyLift) return goPractice(); // its hill is the practice
    // Ask for motion access on this tap (iOS), so turning the phone looks around on the chair.
    if (typeof DeviceOrientationEvent?.requestPermission === "function") { DeviceOrientationEvent.requestPermission().catch(() => "denied").finally(() => go2(l)); return; }
    go2(l);
  }
  function go2(l) {
    if (pick) addStep(RESORT_ID, { k: "base", name: pick.name });
    liftTicket({ resort: RESORT_ID, name: l.name, kind: l.kind, seats: l.seats || 4, bubble: !!l.bubble, km: (liftLen(l) / 1000).toFixed(1), mins: minsOf(l) });
    location.href = `../look.html?lift=${encodeURIComponent(l.name)}&resort=${RESORT_ID}`;
  }

  // ---------- The camera: the whole block between the title and the card ----------
  const cur = { th: home, d: 0, t: relief.center.clone(), ox: 0, oy: 0 }, goal = { th: home, d: 0, t: relief.center.clone(), ox: 0, oy: 0 };
  let turn = 0; // drag to turn, radians either way
  const ndc = new THREE.Vector3();
  const place = (c, th, d, t) => { c.position.set(t.x + Math.cos(th) * Math.cos(EL) * d, t.y + Math.sin(EL) * d, t.z + Math.sin(th) * Math.cos(EL) * d); c.lookAt(t); c.updateMatrixWorld(); };
  const probe = camera.clone();
  const extent = (th, d, t) => {
    place(probe, th, d, t);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of relief.frame) { ndc.copy(p).project(probe); x0 = Math.min(x0, ndc.x); x1 = Math.max(x1, ndc.x); y0 = Math.min(y0, ndc.y); y1 = Math.max(y1, ndc.y); }
    return { x0, x1, y0, y1 };
  };
  const band = () => {
    const top = $("title").getBoundingClientRect().bottom + 8;
    const sheet = $("sheet").getBoundingClientRect();
    const bot = pick ? Math.min(innerHeight - 190, sheet.top - 10) : innerHeight - 190;
    return { top, bot: Math.max(bot, top + innerHeight * 0.4) };
  };
  function aim() {
    const th = home + turn, b = band(), W = innerWidth, H = innerHeight;
    probe.aspect = W / H; probe.fov = camera.fov; probe.clearViewOffset(); probe.updateProjectionMatrix();
    let t = relief.center.clone();
    // fits: the block's height in the band, its width at most a little wider than the screen (the mock crops it)
    const fits = (d) => { const e = extent(th, d, t); return ((e.y1 - e.y0) / 2) * H <= b.bot - b.top && ((e.x1 - e.x0) / 2) * W <= W * 1.45; };
    let lo = relief.span * 0.2, hi = relief.span * 8;
    for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; fits(m) ? (hi = m) : (lo = m); }
    let d = hi;
    if (pick) { // ease in a little toward the base's lifts; the block stays the view
      const ls = tops.length ? tops.map((q) => q.pos) : [flags.find((f) => f.base === pick).pos];
      const c = ls.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / ls.length);
      c.add(flags.find((f) => f.base === pick).pos).multiplyScalar(0.5);
      t = t.clone().lerp(new THREE.Vector3(c.x, t.y, c.z), 0.45);
      d *= 0.92;
    }
    const e = extent(th, d, t);
    Object.assign(goal, { th, d, t, ox: ((e.x0 + e.x1) / 4) * W, oy: -((e.y0 + e.y1) / 4) * H + (H / 2 - (b.top + b.bot) / 2) });
    if (!cur.d) Object.assign(cur, { th, d, t: t.clone(), ox: goal.ox, oy: goal.oy });
    dirty = true;
  }

  // ---------- Labels: flags and top pins kept off each other and off the gold lines ----------
  const v = new THREE.Vector3();
  const scr = (p) => { v.copy(p).project(camera); return v.z < 1 ? { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight } : null; };
  const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  function layout() {
    const placed = [], gold = (relief.goldPts || []).flatMap((line) => line.map(scr).filter(Boolean));
    const b = band(), topLimit = b.top - 30;
    const pet = $("ptPet")?.getBoundingClientRect(); // the party's pet on the right edge: keep the flags off it
    if (pet?.width) placed.push({ x0: pet.left, x1: pet.right, y0: pet.top, y1: pet.bottom });
    const score = (r, pref) => {
      let s = pref;
      for (const q of placed) s += overlap(r, q) * 3;
      for (const g of gold) if (g.x > r.x0 - 3 && g.x < r.x1 + 3 && g.y > r.y0 - 3 && g.y < r.y1 + 3) s += 140;
      if (r.y0 < topLimit) s += (topLimit - r.y0) * 40;
      if (r.x0 < 4) s += (4 - r.x0) * 40; if (r.x1 > innerWidth - 4) s += (r.x1 - innerWidth + 4) * 40;
      return s;
    };
    const solve = (item, p, cands) => {
      const scored = cands.map((c) => ({ c, s: score(c.r, c.pref) }));
      let best = scored.reduce((a, q) => (q.s < a.s ? q : a));
      const was = item.at && scored.find((q) => q.c.key === item.at);
      if (was && was.s <= best.s + 60) best = was; // stay put unless clearly better
      item.at = best.c.key;
      placed.push(best.c.r);
      return best.c;
    };
    // the tops first: they belong to the lines
    for (const q of tops) {
      const p = scr(q.pos);
      q.el.style.display = p ? "" : "none";
      q.r = null;
      if (!p) continue;
      q.w ||= q.lab.offsetWidth; q.h ||= q.lab.offsetHeight;
      // over the pin, or slid along to a side (the triangle stays on the pin), kept on the screen
      const cands = [];
      for (const [i, post] of [10, 34, 60, 88].entries()) for (const sx of [0, -0.3, 0.3, -0.45, 0.45]) {
        const x0 = p.x - q.w / 2 + sx * q.w, y1 = p.y - post - 8;
        cands.push({ key: `${post}:${sx}`, post, sx, pref: i * 25 + Math.abs(sx) * 60, r: { x0, x1: x0 + q.w, y0: y1 - q.h, y1 } });
      }
      const c = solve(q, p, cands);
      q.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      q.post.style.height = `${c.post}px`;
      q.tri.style.transform = `translate(-50%, ${-c.post - 8}px)`;
      q.lab.style.transform = `translate(${-q.w / 2 + c.sx * q.w}px, ${-c.post - 8 - q.h}px)`;
      q.r = c.r; q.p = p;
    }
    // the chosen flag next, then the tops' small cards, then the other flags
    const placeFlag = (f) => {
      const p = scr(f.pos);
      f.el.style.display = p ? "" : "none";
      if (!p) return;
      f.w ||= f.pill.offsetWidth; f.h ||= f.pill.offsetHeight;
      const { w, h } = f, cands = [];
      // the pill stands over the base, or a little to a side on a slanted post, clear of the gold lines
      for (const [i, post] of [26, 54, 84].entries()) for (const dx of [0, -40, 40, -80, 80]) {
        cands.push({ key: `${dx}:${post}`, post, dx, pref: i * 30 + Math.abs(dx) * 0.9, r: { x0: p.x + dx - w / 2, x1: p.x + dx + w / 2, y0: p.y - post - h, y1: p.y - post } });
      }
      const c = solve(f, p, cands);
      f.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      const len = Math.hypot(c.dx, c.post);
      f.post.style.height = `${len}px`;
      f.post.style.transform = `rotate(${Math.atan2(c.dx, c.post)}rad)`;
      f.pill.style.transform = `translate(${c.dx - w / 2}px, ${-c.post - h}px)`;
      f.el.dataset.at = c.key;
    };
    for (const f of flags) if (f.base === pick) placeFlag(f);
    // each top's small card (seats, the runs leaving it, 可换) beside its name and height, never on them
    const labs = tops.filter((q) => q.r).map((q) => q.r);
    for (const q of tops) {
      if (!q.r || q.el.style.display === "none") continue;
      q.iw ||= q.info.offsetWidth; q.ih ||= q.info.offsetHeight;
      const { r, p } = q, w = q.iw, h = q.ih, gap = 6, cy = (r.y0 + r.y1) / 2, cx = (r.x0 + r.x1) / 2, cands = [];
      const at = (key, x0, y0, pref) => cands.push({ key, pref, r: { x0, x1: x0 + w, y0, y1: y0 + h } });
      at("r", r.x1 + gap, cy - h / 2, 0); at("l", r.x0 - gap - w, cy - h / 2, 10);
      at("rt", r.x1 + gap, r.y0 - h * 0.6, 30); at("lt", r.x0 - gap - w, r.y0 - h * 0.6, 40);
      at("t", cx - w / 2, r.y0 - gap - h, 50);
      at("rb", r.x1 + gap, r.y1 - h * 0.4, 60); at("lb", r.x0 - gap - w, r.y1 - h * 0.4, 70);
      for (const c of cands) for (const o of labs) c.pref += overlap(c.r, o) * 50; // a name or a height covered: never
      const c = solve({ get at() { return q.infoAt; }, set at(k) { q.infoAt = k; } }, p, cands);
      q.info.style.transform = `translate(${c.r.x0 - p.x}px, ${c.r.y0 - p.y}px)`;
    }
    for (const f of flags) if (f.base !== pick) placeFlag(f);
  }

  // ---------- Touch: drag to turn a little; tap a base or a flag to choose it, tap elsewhere to let go ----------
  let down = null;
  const cv = renderer.domElement;
  cv.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, turn, moved: false }; $("timePanel").classList.remove("show"); });
  addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - down.x;
    if (!down.moved && Math.hypot(dx, e.clientY - down.y) > 8) down.moved = true;
    if (down.moved) { turn = Math.max(-1.1, Math.min(1.1, down.turn - dx / 320)); aim(); }
  });
  addEventListener("pointerup", (e) => {
    const d = down; down = null;
    if (!d || d.moved || e.target !== cv) return;
    let best = null, bd = 44; // a tap near a base picks it
    for (const f of flags) { const p = scr(f.pos); const k = p && Math.hypot(p.x - e.clientX, p.y - e.clientY); if (p && k < bd) { bd = k; best = f.base; } }
    if (best) { if (best !== pick) select(best); }
    else if (pick) select(null);
  });
  $("backBtn").onclick = () => { if (pick) select(null); else location.href = "../start.html?tab=resort"; };

  const resize = () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    relief.resize(innerWidth, innerHeight);
    for (const q of [...flags, ...tops]) { q.w = q.h = q.iw = q.ih = 0; }
    aim();
  };
  addEventListener("resize", resize);

  $("status").remove();
  aim();
  // ?base=: back from the ride (its back sheet's 回雪场页), the base that lift leaves from is still chosen.
  const base0 = villages.find((b) => b.name === new URLSearchParams(location.search).get("base"));
  if (base0) select(base0);
  renderer.shadowMap.needsUpdate = true;
  window.__resort = { relief, renderer, camera, scene, flags, get pick() { return pick; }, select: (name) => select(villages.find((b) => b.name === name) || null), applyLook, look }; // test hook

  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const k = 1 - Math.exp(-dt * 5);
    const far = Math.abs(goal.th - cur.th) + Math.abs(goal.d - cur.d) / goal.d + cur.t.distanceTo(goal.t) / goal.d + (Math.abs(goal.ox - cur.ox) + Math.abs(goal.oy - cur.oy)) / 200;
    if (far > 1e-4) {
      cur.th += (goal.th - cur.th) * k; cur.d += (goal.d - cur.d) * k; cur.t.lerp(goal.t, k);
      cur.ox += (goal.ox - cur.ox) * k; cur.oy += (goal.oy - cur.oy) * k;
      dirty = true;
    }
    if (!dirty) return;
    dirty = false;
    camera.setViewOffset(innerWidth, innerHeight, cur.ox, cur.oy, innerWidth, innerHeight);
    place(camera, cur.th, cur.d, cur.t);
    renderer.render(scene, camera);
    layout();
  });
}
main().catch((e) => { const s = $("status"); if (s) s.textContent = `加载失败：${e.message}`; console.error(e); });
translatePage(); // English, if chosen on the start page
if (EN) {
  $("hint").textContent = "Tap a village to start";
  $("credit").textContent = "Runs and lifts © OpenStreetMap contributors · terrain AWS Terrain Tiles · a prototype for learning the way: use the resort's official map";
}
document.getElementById("navBtn").onclick = () => openNav("../");
document.querySelector("#navBtn img").src = `../assets/icons/${myAvatar()}.png?v=1`;
document.getElementById("backBtn").onclick = () => { location.href = "../start.html?tab=resort"; }; // until the page is up
