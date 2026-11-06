// The opening: a snowy valley from above, clouds drifting over; around it a frosted pane with snowboarders
// carving across its far side; and, on a tap of the speaker, the hiss of their boards and a quiet tune. Once
// per visit, while the rider model loads. playIntro({ trip }) is the same scene for a trip: a little plane
// for each city its riders fly from, landing at Denver (for when friends open a shared trip).
import { t, EN_ON } from "../core/i18n.js?v=24";

const CSS = `
#intro { position: fixed; inset: 0; z-index: 50; background: #dde3e9; overflow: hidden; transition: opacity .6s; font-family: "Noto Serif SC", serif; cursor: pointer; }
#intro.out { opacity: 0; pointer-events: none; }
#intro .bgc { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
#intro .valley { position: absolute; left: 50%; top: calc(14vh + env(safe-area-inset-top)); width: min(340px, 86vw, 42vh); aspect-ratio: 680 / 800; transform: translateX(-50%); filter: drop-shadow(0 10px 24px rgba(40,50,70,.22)); }
#intro .cap { position: absolute; left: 0; right: 0; top: calc(14vh + env(safe-area-inset-top) + min(400px, 101vw, 49.4vh) + 26px); text-align: center; text-shadow: 0 0 8px #fff, 0 0 3px #fff; z-index: 1; pointer-events: none; }
#intro .cap b { display: block; font-weight: 400; font-size: 20px; letter-spacing: .3em; color: #3d3a36; }
#intro .cap p { margin: 10px 0 0; font-size: 12px; letter-spacing: .15em; line-height: 1.9; color: #6f685f; }
#intro .cap small { display: block; margin-top: 12px; font-size: 10px; letter-spacing: .2em; color: #8f857a; }
#intro .cap .brand { display: block; font: 500 10px Oswald, sans-serif; font-style: normal; letter-spacing: .4em; color: #8f857a; margin-bottom: 12px; }
#intro .cap .float { position: relative; display: grid; place-items: center; }
#intro .cap .float p { grid-area: 1 / 1; margin: 0 14px; }
#intro .cap .float .under { font: italic 500 19px/1.4 "Cormorant Garamond", serif; letter-spacing: .02em; color: #8ea0b6; opacity: .42; transform: translate(8px, 10px); }
#intro .cap.quote .float .over { font-size: 17px; font-weight: 600; letter-spacing: .2em; line-height: 2; color: #2a3442; text-shadow: 0 0 6px rgba(221,227,233,.9); }
#intro .cap .ch { display: inline-block; will-change: transform; }
#intro .cap.quote p { font-size: 15px; letter-spacing: .18em; line-height: 2; color: #3d3a36; margin: 0 24px; }
#intro .cap.quote small { margin: 12px 30px 0; font: italic 13px/1.6 "Cormorant Garamond", serif; letter-spacing: .04em; color: #6f685f; }
#intro .cap .go { margin-top: 22px; font: 500 10px Oswald, sans-serif; letter-spacing: .35em; color: #22344d; opacity: 0; transition: opacity 1s; }
#intro .cap .go.on { opacity: .7; }
#intro .snd { position: absolute; right: 16px; top: calc(16px + env(safe-area-inset-top)); z-index: 2; width: 40px; height: 40px; border-radius: 50%; border: 0; background: rgba(253,251,246,.9); box-shadow: 0 3px 8px rgba(40,50,70,.15); cursor: pointer; }
#intro .snd .w { opacity: .3; }
#intro .snd.on .w { opacity: 1; }
`;

// From the next trip: who flies from where (one plane per city), its name and first day.
async function flights(tr) {
  const { AIRPORTS } = await import("./trips.js?v=28"), [dla, dlo] = AIRPORTS.DEN;
  const codes = [...new Set((tr?.people || []).map((p) => (typeof p === "string" ? "" : p.from)).filter((c) => AIRPORTS[c] && c !== "DEN"))].slice(0, 5);
  // each plane comes in from its city's side of Denver (north up)
  const froms = codes.map((c) => { const [a, b] = AIRPORTS[c], x = (b - dlo) * Math.cos(dla * Math.PI / 180), y = a - dla, l = Math.hypot(x, y) || 1; return [x / l, y / l]; });
  if (!froms.length) froms.push([-0.8, 0.6]); // from the west, by default
  return { codes, froms };
}

// The welcome's words, each with its own little scene (see valley()). A different one each visit.
const QUOTES = [
  { zh: "答案在路上，<br>自由在风里，<br>永远热爱自由浪漫。", en: "The answer is on the road. Freedom is in the wind.<br>Always love freedom and romance.", scene: "road" },
  { zh: "出发是最有意义的事。", en: "Setting off is what matters most.", scene: "depart" },
  { zh: "高处自有风景在，<br>找不到答案的时候，<br>就去看一看这个世界。", en: "High places have their own scenery.<br>When the answer cannot be found,<br>just go take a look at this world.", scene: "summit" },
  { zh: "都在路上，<br>都在当下。", en: "All on the road, all in the moment.", scene: "now" },
  { zh: "山川不语，风雪有声，<br>那些一起走过的日子，<br>自会替我们记得。", en: "The mountains stand silent,<br>the wind tells its stories,<br>and the days we shared will never truly fade.", scene: "tracks" },
  { zh: "山野有雪，<br>同行有期。", en: "Where snow falls, we shall meet again.", scene: "meet" },
];
// How each scene moves and sounds behind the glass. Riders: how many at once (slots), how often a new run
// starts (gap, s), speed (px/s), turn length (px) and depth (rad), which ways they head; "pair" rides two
// side by side, "meet" brings two in from opposite sides. Sound: a bar's length (s), its chords and tune
// (MIDI, 0 a rest), notes per bar, "arp" climbs each chord instead, wind under it all, how loud the boards hiss.
const MOODS = {
  road: { slots: 3, gap: 6, v: [300, 400], len: [380, 900], amp: [0.5, 1.15], dirs: [[1, 0.35], [-1, 0.35], [0.6, 0.8], [-0.6, 0.8]],
    bar: 3.2, chords: [[50, 57, 62, 66], [45, 52, 57, 61], [47, 54, 59, 62], [43, 50, 55, 59]], tune: [78, 81, 83, 81, 78, 76, 78, 74, 76, 78, 81, 86, 83, 81, 78, 76], per: 4, wind: 0.05, hiss: 1 },
  depart: { slots: 3, gap: 5, v: [260, 330], len: [300, 600], amp: [0.25, 0.6], dirs: [[0, -1], [0.3, -0.95], [-0.3, -0.95]],
    bar: 3.2, chords: [[48, 55, 60, 64], [53, 57, 60, 65], [55, 59, 62, 67], [57, 60, 64, 69]], arp: 1, per: 6, wind: 0.015, hiss: 0.9 },
  summit: { slots: 2, gap: 11, v: [150, 190], len: [700, 1200], amp: [0.6, 1.0], dirs: [[0, 1], [0.3, 0.95]],
    bar: 6, chords: [[38, 45, 57, 64], [36, 43, 55, 62], [41, 48, 57, 64], [43, 50, 59, 66]], tune: [76, 74, 69, 0, 81, 79, 74, 0], per: 2, wind: 0.08, hiss: 0.6, high: 1 },
  now: { slots: 5, gap: 4.5, v: [240, 300], len: [200, 380], amp: [0.4, 0.8], dirs: [[0, 1], [0.5, 0.87], [-0.5, 0.87], [1, 0.25], [-1, 0.25], [0, -1]],
    bar: 2.4, chords: [[52, 59, 64, 68], [49, 56, 61, 64], [45, 52, 57, 61], [47, 54, 59, 63]], tune: [76, 80, 83, 80, 78, 76, 80, 71, 73, 76, 80, 78, 76, 75, 73, 71], per: 4, wind: 0, hiss: 0.7, pluck: 1 },
  tracks: { slots: 2, gap: 9, v: [210, 230], len: [500, 700], amp: [0.6, 0.8], dirs: [[0, 1]], pair: 1,
    bar: 4.5, chords: [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]], tune: [76, 74, 72, 71, 72, 69, 67, 64, 69, 71, 72, 74], per: 3, wind: 0.07, hiss: 0.8 },
  meet: { slots: 2, gap: 9, v: [190, 220], len: [420, 640], amp: [0.4, 0.7], meet: 1,
    bar: 4, chords: [[41, 48, 57, 60], [38, 45, 53, 57], [46, 53, 58, 62], [48, 55, 60, 64]], tune: [72, 74, 77, 74, 72, 69, 70, 72, 77, 76, 74, 72], per: 3, wind: 0.02, hiss: 0.7 },
  trip: { slots: 4, gap: 7, v: [210, 300], len: [280, 800], amp: [0.35, 1.1], dirs: [[0, 1], [0, 1], [0.5, 0.87], [-0.5, 0.87], [1, 0.25], [-1, 0.25], [0, -1]],
    bar: 4, chords: [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]], tune: [74, 76, 78, 81, 78, 76, 74, 71, 74, 76, 74, 69, 71, 74, 78, 76], per: 4, wind: 0, hiss: 1 },
};
const pickQuote = () => {
  const ask = +new URLSearchParams(location.search).get("welcome"); if (ask >= 1 && ask <= QUOTES.length) return ask - 1; // ?welcome=N, to look at one
  let last = -1; try { last = +(localStorage.getItem("prerunWelcome") ?? -1); } catch { /* private mode */ }
  let k = Math.floor(Math.random() * (QUOTES.length - 1)); if (k >= last && last >= 0) k++;
  try { localStorage.setItem("prerunWelcome", k); } catch { /* fine */ }
  return k;
};

export async function playIntro({ trip: tr = null } = {}) {
  if (navigator.webdriver) return; // not in tests
  if (!tr) { if (sessionStorage.getItem("prerunIntro")) return; sessionStorage.setItem("prerunIntro", "1"); } // the welcome: once per visit
  const { codes, froms } = tr ? await flights(tr) : { codes: [], froms: [] };
  const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
  const box = document.createElement("div"); box.id = "intro";
  const n = codes.length, d = tr ? new Date(tr.from + "T12:00") : null;
  const q = tr ? null : QUOTES[pickQuote()];
  const title = !tr ? "" : n > 1 ? t("大家都到啦") : t("到 Denver 啦");
  const line = q ? (EN_ON ? q.en : q.zh) : n > 1 ? (EN_ON ? `${n} little planes from ${n} cities,<br>through the clouds, down at Denver.` : `${["", "一", "两", "三", "四", "五"][n]}架小飞机，从${["", "一", "两", "三", "四", "五"][n]}个城市<br>穿过云，落在 Denver。`)
    : (EN_ON ? `A little plane${n ? ` from ${codes[0]}` : ""},<br>through the clouds, down at Denver.` : `一架小飞机${n ? `，从 ${codes[0]}` : ""}<br>穿过云，落在 Denver。`);
  const when = q ? "" : `${tr.name.replace(/[<>&]/g, "")} · ${EN_ON ? d.toLocaleDateString("en", { month: "short", day: "numeric" }) : `${d.getMonth() + 1} 月 ${d.getDate()} 日`}`;
  box.innerHTML = `<canvas class="bgc"></canvas><canvas class="valley" width="680" height="800"></canvas>
    <div class="cap${q ? " quote" : ""}">${q ? `<i class="brand">SKI PRE-RUN</i>` : `<b>${title}</b>`}${q && !EN_ON ? `<div class="float"><p class="under">${q.en}</p><p class="over">${q.zh}</p></div>` : `<p class="${q ? "over" : ""}">${line}</p>`}${when ? `<small>${when}</small>` : ""}<div class="go">${t("轻点进入")}</div></div>
    <button class="snd" aria-label="${t("声音")}"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 9 H8 L13 5 V19 L8 15 H4Z" fill="#22344d"/><path class="w" d="M16 9 C17.5 10.5 17.5 13.5 16 15 M18.5 6.5 C21.5 9.5 21.5 14.5 18.5 17.5" stroke="#22344d" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg></button>`;
  document.body.append(box);
  let live = true; const alive = () => live;
  const bg = box.querySelector(".bgc"); bg.width = innerWidth * 2; bg.height = innerHeight * 2;
  const mood = MOODS[q ? q.scene : "trip"], riders = glass(bg, alive, mood);
  valley(box.querySelector(".valley"), q ? q.scene : "trip", froms, alive);
  if (q) letters(box, riders, alive);
  setTimeout(() => box.querySelector(".go").classList.add("on"), 1000 * (froms.length ? 3.4 + 0.55 * (froms.length - 1) : 2));
  // Sound starts by itself where the browser lets it (most desktops); phones only allow it after a tap, so
  // there it waits for the speaker.
  const A = startSound(riders, mood), snd = box.querySelector(".snd"), mark = () => snd.classList.toggle("on", A.state === "running");
  A.resume().then(mark, mark); A.onstatechange = mark;
  snd.onclick = (e) => { e.stopPropagation(); (A.state === "running" ? A.suspend() : A.resume()).then(mark, mark); };
  box.onclick = () => { box.classList.add("out"); A.close(); setTimeout(() => { live = false; box.remove(); st.remove(); }, 650); };
}

// The frosted pane behind the intro, seen from below: snowboarders ride across its far side. The board is
// pressed to the glass, so it's sharp; the rider standing on it rises away from us, so their legs blur more the
// higher they go, and their body is a soft shadow leaning into the turn. Each run comes in from some edge,
// links turns of its own sizes down its own fall line, and leaves; then another starts. Snow thrown off each
// turn hangs and settles.
function glass(c, alive, mood) {
// Safari can't blur on a canvas (ctx.filter), so each depth gets its own canvas, blurred and faded by CSS:
// the farther from the glass, the blurrier. Shapes within a layer are drawn solid, so they merge, not stack.
const W = c.width, H = c.height;
const layer = (blur, opacity, scale) => { const e = document.createElement("canvas"); e.width = W * scale; e.height = H * scale;
  e.style.cssText = `position:absolute;left:0;top:0;width:${c.style.width || "100%"};height:${c.style.height || "100%"};filter:blur(${blur}px);opacity:${opacity};pointer-events:none`;
  c.after(e); const x = e.getContext("2d"); x.setTransform(scale, 0, 0, scale, 0, 0); return x; };
// built in reverse (each goes right after #bg): board on top, then shins, thighs, body, spray
const L_BOARD = layer(0.9, 0.92, 1), L_SHIN = layer(4, 0.78, 0.5), L_THIGH = layer(9, 0.6, 0.5), L_BODY = layer(17, 0.42, 0.5), L_SPRAY = layer(3.5, 1, 0.5);
const g = c.getContext("2d"), LAYERS = [L_BOARD, L_SHIN, L_THIGH, L_BODY, L_SPRAY];
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const M = mood, SLOTS = M.slots, GAP = M.gap; // riders at a time; a slot's next run starts GAP s after its last began
const lerp = ([a, b], u) => a + (b - a) * u;
// A run: start off one edge, head across (mostly downhill: top to bottom, but sometimes side to side or
// diagonally), turning by a heading that swings left and right, each turn its own length and depth.
const runs = new Map();
function run(slot, n) {
  const key = slot * 1e5 + n; if (runs.has(key)) return runs.get(key);
  if (M.pair && slot === 1) { // the friend, riding alongside: the same line, a little to one side
    const a = run(0, n), pts = a.pts.map(([x, y, th, k]) => [x - Math.sin(th) * 120, y + Math.cos(th) * 120, th, k]);
    const r = { pts, v: a.v, start: a.start + 0.25 }; runs.set(key, r); return r;
  }
  const h = (i) => hash(key * 13 + i);
  const dirs = M.meet ? [[slot ? -1 : 1, 0.3]] : M.dirs; // meet: two from opposite sides
  const [dx, dy] = dirs[Math.floor(h(1) * dirs.length)], base = Math.atan2(dy, dx);
  // enter from the edge behind the direction of travel, somewhere along it
  const along = M.meet ? 0.5 : 0.15 + 0.7 * h(2);
  let x = W / 2 - dx * (W / 2 + 260) + (dy ? (along - 0.5) * W : 0), y = H / 2 - dy * (H / 2 + 260) + (dx ? (along - 0.5) * H : 0);
  const pts = []; let th = base, s = 0, turn = 0, sign = h(3) < 0.5 ? 1 : -1, len = 0, amp = 0, s0 = 0;
  while (pts.length < 4000) {
    if (s >= s0 + len) { s0 = s; len = lerp(M.len, h(10 + turn)); amp = lerp(M.amp, h(40 + turn)); sign = -sign; turn++; } // a new turn
    const u = (s - s0) / len, prev = th;
    th = base + sign * amp * Math.sin(Math.PI * u);
    const k = (th - prev) / 4; // curvature, radians per px
    pts.push([x, y, th, k]);
    x += Math.cos(th) * 4; y += Math.sin(th) * 4; s += 4;
    if (x < -400 || x > W + 400 || y < -400 || y > H + 400) break;
  }
  const r = { pts, v: lerp(M.v, h(5)), start: (M.meet ? 0 : slot * GAP / SLOTS + h(6) * 2) + n * GAP - 4 };
  runs.set(key, r); if (runs.size > 40) runs.delete(runs.keys().next().value);
  return r;
}
// Where slot's rider is at time t: [x, y, heading, lean (-1..1, + = turning to its left), run id], or null.
const T_OFF = Math.random() * 120; // a different moment each visit
function at(slot, t) {
  t += T_OFF;
  for (let n = Math.max(0, Math.floor((t - slot * GAP / SLOTS) / GAP) - 1); ; n++) {
    const r = run(slot, n); if (r.start > t) return null;
    const i = Math.floor((t - r.start) * r.v / 4); if (i < r.pts.length) { const [x, y, th, k] = r.pts[i]; return [x, y, th, Math.max(-1, Math.min(1, k * 260)), n]; }
  }
}
const riders = (t) => Array.from({ length: SLOTS }, (_, s) => { const p = at(s, t); return p ? { x: p[0] / W, y: p[1] / H, lean: p[3] } : { x: 0.5, y: -1, lean: 0 }; });

// The rider, in screen space. "Up" (away from the glass) shows as a drift away from the screen's middle, as
// if we looked up from below its centre; and they lean to the inside of the turn.
const INK = "#161a1f";
function rider(x, y, th, lean) {
  const fx = Math.cos(th), fy = Math.sin(th), px = -fy, py = fx;
  let ux = (x - W / 2) / W, uy = (y - H / 2) / H; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
  const L = 175, ix = px * lean * 80, iy = py * lean * 80;
  const up = (f) => [ux * L * f + ix * f, uy * L * f + iy * f];
  const feet = [-46, 46].map((b) => [x + fx * b, y + fy * b]);
  const knee = (f, side) => { const [a, b] = up(0.55); return [f[0] + a + fx * side * 12, f[1] + b + fy * side * 12]; };
  const [hx, hy] = up(1.05), hip = [x + hx, y + hy], [tx, ty] = up(1.75), chest = [x + tx, y + ty];
  // a limb: tapered, wider at the top, as a filled shape so it reads soft, not as a stick
  const limb = (g, a, b, w0, w1) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    g.fillStyle = INK; g.beginPath(); g.moveTo(a[0] + nx * w0, a[1] + ny * w0); g.lineTo(b[0] + nx * w1, b[1] + ny * w1); g.lineTo(b[0] - nx * w1, b[1] - ny * w1); g.lineTo(a[0] - nx * w0, a[1] - ny * w0); g.fill();
    g.beginPath(); g.arc(a[0], a[1], w0, 0, 7); g.arc(b[0], b[1], w1, 0, 7); g.fill(); };
  L_BODY.fillStyle = INK; L_BODY.beginPath(); L_BODY.ellipse(chest[0], chest[1], 74, 60, th, 0, 7); L_BODY.fill();
  for (const sd of [-1, 1]) limb(L_BODY, chest, [chest[0] + fx * sd * 100 + ux * 30, chest[1] + fy * sd * 100 + uy * 30], 22, 14);
  limb(L_BODY, hip, chest, 46, 56);
  feet.forEach((f, i) => { const kn = knee(f, i ? -1 : 1); limb(L_THIGH, kn, hip, 24, 30); limb(L_SHIN, f, kn, 19, 23); });
}
function board(x, y, th) {
  const g = L_BOARD; g.save(); g.translate(x, y); g.rotate(th);
  // a real board's outline: round nose and tail, wider than the waist (the sidecut)
  const out = () => { g.beginPath(); g.moveTo(-84, -26); g.quadraticCurveTo(0, -20, 84, -26); g.bezierCurveTo(112, -27, 116, 27, 84, 26);
    g.quadraticCurveTo(0, 20, -84, 26); g.bezierCurveTo(-116, 27, -112, -27, -84, -26); g.closePath(); };
  g.fillStyle = "#1b1f24"; out(); g.fill();
  g.strokeStyle = "rgba(160,170,180,.5)"; g.lineWidth = 2; out(); g.stroke(); // the steel edge catching the light
  g.fillStyle = "#2f353c"; for (const b of [-46, 46]) { g.beginPath(); g.roundRect(b - 15, -20, 30, 40, 9); g.fill(); }
  g.restore();
}
const DT = 0.05, LIFE = 1.4;
function frame(now) {
  const t = now / 1000;
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#e2e8ee"); bg.addColorStop(1, "#d2dae2");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (const l of LAYERS) l.clearRect(0, 0, W, H);
  // spray off the outside of each turn, through its apex
  const sp = L_SPRAY;
  for (let sl = 0; sl < SLOTS; sl++) {
    const now = at(sl, t); if (!now) continue;
    for (let k = Math.floor(t / DT); k * DT > t - LIFE; k--) {
      const born = k * DT, age = (t - born) / LIFE; if (age < 0) continue;
      const p = at(sl, born); if (!p || p[4] !== now[4]) continue;
      const [x, y, th, lean] = p, hard = lean * lean; if (hard < 0.12) continue;
      const fx = Math.cos(th), fy = Math.sin(th), sg = lean > 0 ? -1 : 1, nx = -fy * sg, ny = fx * sg;
      for (let j = 0; j < 4; j++) {
        const h = hash(sl * 1e4 + k * 7 + j), h2 = hash(sl * 1e4 + k * 7 + j + 0.5);
        const out = (30 + h * 70) * hard * (0.5 + age), back = -age * 40;
        const qx = x + nx * out + fx * back + (h2 - 0.5) * 30, qy = y + ny * out + fy * back + (h - 0.5) * 30;
        const rad = (14 + h2 * 20) * (0.6 + age * 1.4) * hard, a = (1 - age) ** 1.5;
        sp.fillStyle = `rgba(120,138,160,${0.3 * a})`; sp.beginPath(); sp.arc(qx + 6, qy + 8, rad, 0, 7); sp.fill();
        sp.fillStyle = `rgba(255,255,255,${0.9 * a})`; sp.beginPath(); sp.arc(qx, qy, rad, 0, 7); sp.fill();
      }
    }
  }
  for (let sl = 0; sl < SLOTS; sl++) { const p = at(sl, t); if (p) { rider(p[0], p[1], p[2], p[3]); board(p[0], p[1], p[2]); } }
  if (alive()) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
return riders;
}

// The words, letter by letter (words, for English), pushed aside as a rider passes over them and easing back,
// with a little tilt, as if the board's wind caught them.
function letters(box, riders, alive) {
  const wrap = (p, by) => { const parts = p.innerHTML.split(/(<br>)/); p.innerHTML = parts.map((x) => x === "<br>" ? x : (by === "word" ? x.split(/( )/) : [...x]).map((ch) => ch === " " ? " " : `<span class="ch">${ch}</span>`).join("")).join(""); };
  box.querySelectorAll(".cap .over").forEach((p) => wrap(p, EN_ON ? "word" : "char"));
  box.querySelectorAll(".cap .under").forEach((p) => wrap(p, "word"));
  const els = [...box.querySelectorAll(".cap .ch")].map((e) => ({ e, deep: !!e.closest(".under"), x: 0, y: 0, vx: 0, vy: 0, cx: 0, cy: 0 }));
  const measure = () => { for (const l of els) { l.e.style.transform = ""; const r = l.e.getBoundingClientRect(); l.cx = r.left + r.width / 2; l.cy = r.top + r.height / 2; } };
  measure(); addEventListener("resize", measure);
  let last = performance.now();
  const step = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const rs = riders(now / 1000).map((r) => [r.x * innerWidth, r.y * innerHeight]);
    for (const l of els) {
      let fx = 0, fy = 0;
      for (const [x, y] of rs) { const dx = l.cx - x, dy = l.cy - y, d = Math.hypot(dx, dy); if (d < 140) { const f = (1 - d / 140) ** 2 * (l.deep ? 900 : 1600); fx += dx / (d || 1) * f; fy += dy / (d || 1) * f; } }
      l.vx += (fx - l.x * 60 - l.vx * 9) * dt; l.vy += (fy - l.y * 60 - l.vy * 9) * dt; // a spring home, damped
      l.x += l.vx * dt; l.y += l.vy * dt;
      l.e.style.transform = Math.abs(l.x) + Math.abs(l.y) < 0.1 ? "" : `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px) rotate(${(l.x * 0.6).toFixed(1)}deg)`;
    }
    if (alive()) requestAnimationFrame(step); else removeEventListener("resize", measure);
  };
  requestAnimationFrame(step);
}

// The valley from above, painted on its own canvas, dressed for its words:
//   road    the highway up the valley, a little car on it, wind streaming across
//   depart  a plane taking off from Denver and climbing away
//   summit  high ground: peaks in strong light and shade, prayer flags on the top
//   now     the road and the river, cars on the move, light glinting on the ice
//   tracks  a slope in falling snow, two riders' tracks drawn side by side
//   meet    a cabin with a warm window, two lines of footprints coming to it
//   trip    the trip's planes (one per city) landing at Denver
function valley(c, scene, froms, alive) {
const g = c.getContext("2d"), W = c.width, H = c.height;
const SC = { road: { seed: 7, road: 1, river: 1, den: 0 }, depart: { seed: 11, road: 1, river: 1, den: 1 }, summit: { seed: 23, road: 0, river: 0, den: 0, relief: 2.4 },
  now: { seed: 5, road: 1, river: 1, den: 0 }, tracks: { seed: 31, road: 0, river: 0, den: 0, relief: 1.4, snow: 3 }, meet: { seed: 17, road: 0, river: 1, den: 0 }, trip: { seed: 7, road: 1, river: 1, den: 1 } }[scene];
let seed = SC.seed; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// Value noise.
const P = Array.from({ length: 512 }, () => rnd());
const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, h = (i, j) => P[((i * 73856093) ^ (j * 19349663)) & 511], s = (t) => t * t * (3 - 2 * t);
  const a = h(xi, yi), b = h(xi + 1, yi), cc = h(xi, yi + 1), d = h(xi + 1, yi + 1); return a + (b - a) * s(xf) + (cc - a) * s(yf) + (a - b - cc + d) * s(xf) * s(yf); };
const fbm = (x, y) => vn(x, y) * 0.5 + vn(x * 2, y * 2) * 0.25 + vn(x * 4, y * 4) * 0.125 + vn(x * 8, y * 8) * 0.0625;
// The ground, painted once.
const ground = document.createElement("canvas"); ground.width = W; ground.height = H;
const gg = ground.getContext("2d"), img = gg.createImageData(W, H);
const river = (y) => W * 0.62 + Math.sin(y / 120) * 60 + Math.sin(y / 47) * 14; // the river's line
const road = (y) => W * 0.3 + Math.sin(y / 160 + 1) * 46;
const RL = SC.relief || 1;
// For the summit, a mountain: a peak with ridges running off it (ridged noise on a cone), lit from the top left.
const PK = [W * 0.55, H * 0.42];
const ridged = (x, y) => { let a = 0, f = 1 / 160, w = 0.5; for (let i = 0; i < 4; i++) { a += (1 - Math.abs(vn(x * f, y * f) * 2 - 1)) * w; f *= 2; w *= 0.5; } return a; };
const mtn = (x, y) => { const d = Math.hypot(x - PK[0], (y - PK[1]) * 1.1), a = Math.atan2(y - PK[1], x - PK[0]);
  const arms = 0.5 + 0.5 * Math.cos(a * 4 + 0.6) ** 8; // four ridges running off the top
  return Math.max(0, 1 - d / (300 + 160 * arms)) ** 1.5 * (0.7 + 0.3 * ridged(x, y)); };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const h = RL > 2 ? mtn(x, y) : fbm(x / 140, y / 140);
  const e = RL > 2 ? (mtn(x + 2, y + 2) - mtn(x - 2, y - 2)) * 260 : (fbm((x + 3) / 140, y / 140) - fbm((x - 3) / 140, y / 140)) * 30 * RL; // slope toward the light
  let r = 244, gr = 247, b = 251;
  const shade = Math.max(-1, Math.min(1, e)); r -= shade * 26 + 6; gr -= shade * 20 + 4; b -= shade * 8; // blue shadows
  if (RL > 2) { const lo = Math.max(0, 0.35 - h) * 70; r -= lo; gr -= lo * 0.6; b -= lo * 0.15; } // high ground stays bright, the valleys go blue
  const k = (y * W + x) * 4;
  const dr = SC.river ? Math.abs(x - river(y)) : 1e9, drd = SC.road ? Math.abs(x - road(y)) : 1e9;
  if (dr < 22 + vn(y / 20, 3) * 6) { const ice = dr < 15; r = ice ? 140 : 205; gr = ice ? 186 : 222; b = ice ? 222 : 236; } // ice, and its snowy bank
  else if (drd < 7) { r = 170; gr = 158; b = 146; } // the road, ploughed
  img.data[k] = r; img.data[k + 1] = gr; img.data[k + 2] = b; img.data[k + 3] = 255;
}
gg.putImageData(img, 0, 0);
// Spruce in clumps where the noise says woods, kept off the river and the road.
for (let i = 0; i < 2600; i++) {
  const x = rnd() * W, y = rnd() * H;
  if (fbm(x / 90 + 9, y / 90) < 0.52 || (SC.river && Math.abs(x - river(y)) < 30) || (SC.road && Math.abs(x - road(y)) < 16)) continue;
  if (RL > 2 && mtn(x, y) > 0.28) continue; // no trees up high
  if (scene === "tracks" && Math.abs(x - W * 0.5) < 150) continue; // the open slope
  if (scene === "meet" && Math.hypot(x - W * 0.42, y - H * 0.55) < 70) continue; // the cabin's clearing
  const s = 4 + rnd() * 5;
  gg.fillStyle = "rgba(40,60,70,.18)"; gg.beginPath(); gg.ellipse(x + s * 0.8, y + s * 0.6, s, s * 0.6, 0, 0, 7); gg.fill(); // shadow, the sun from the top left
  gg.fillStyle = ["#2f5446", "#3b6152", "#294a3e"][i % 3]; gg.beginPath(); gg.arc(x, y, s, 0, 7); gg.fill();
  gg.fillStyle = "rgba(255,255,255,.7)"; gg.beginPath(); gg.arc(x - s * 0.3, y - s * 0.35, s * 0.45, 0, 7); gg.fill(); // snow on top
}
// Denver: a few warm roofs where the road meets the bottom.
const den = { x: road(H * 0.82) + 30, y: H * 0.82 };
if (SC.den) for (let i = 0; i < 26; i++) { const x = den.x + (rnd() - 0.5) * 90, y = den.y + (rnd() - 0.5) * 50; gg.fillStyle = ["#c9a07a", "#b6463b", "#d8c4a8"][i % 3]; gg.fillRect(x, y, 7, 5); gg.fillStyle = "rgba(255,255,255,.8)"; gg.fillRect(x, y, 7, 2); }
// The torn paper edge.
const mask = document.createElement("canvas"); mask.width = W; mask.height = H;
const mg = mask.getContext("2d"); mg.fillStyle = "#000"; mg.beginPath();
const edge = (t) => 18 + vn(t / 9, 1) * 16;
for (let x = 0; x <= W; x += 3) mg.lineTo(x, edge(x));
for (let y = 0; y <= H; y += 3) mg.lineTo(W - edge(y + 500), y);
for (let x = W; x >= 0; x -= 3) mg.lineTo(x, H - edge(x + 900));
for (let y = H; y >= 0; y -= 3) mg.lineTo(edge(y + 1300), y);
mg.fill();
// Clouds: soft white heaps drifting, each with its shadow on the snow.
const clouds = Array.from({ length: 6 }, (_, i) => ({ x: rnd() * W, y: rnd() * H, r: 40 + rnd() * 50, v: 6 + rnd() * 8, puffs: Array.from({ length: 7 }, () => [(rnd() - 0.5) * 1.4, (rnd() - 0.5) * 0.8, 0.5 + rnd() * 0.5]) }));
// The friends: each a little plane from their side, landing at Denver one after another.
const planes = froms.map((dir, i) => ({ from: [den.x + dir[0] * 620, den.y - dir[1] * 620], delay: i * 0.55 }));
const plane = (x, y, a, s) => { g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
  g.fillStyle = "#4a5563"; g.beginPath(); g.ellipse(0, 0, 16, 3, 0, 0, 7); g.fill(); g.fillRect(-4, -14, 7, 28); g.fillRect(-15, -5, 4, 10);
  g.fillStyle = "#fdfbf6"; g.fillRect(-3, -13, 2, 26); g.restore(); };
// The scene's own things.
let peak = [W / 2, H / 2]; // the highest ground, for the summit's flags
if (scene === "summit") { let best = -1; for (let y = 120; y < H - 120; y += 6) for (let x = 120; x < W - 120; x += 6) { const h = mtn(x, y); if (h > best) { best = h; peak = [x, y]; } } }
const car = (x, y, a, col) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = "rgba(40,50,70,.25)"; g.fillRect(-5, -8, 13, 19); g.fillStyle = col; g.beginPath(); g.roundRect(-6, -10, 12, 20, 3); g.fill();
  g.fillStyle = "rgba(255,255,255,.75)"; g.fillRect(-4.5, -6, 9, 4); g.fillStyle = "#ffe9a8"; g.fillRect(-5, -11, 3, 2); g.fillRect(2, -11, 3, 2); g.restore(); };
const onRoad = (u) => { const y = H * (1.1 - u * 1.3), y2 = y - 4; return [road(y), y, Math.atan2(road(y2) - road(y), -4) * -1]; }; // u 0..1 bottom to top
const trail = (pts, upto, col, w) => { g.fillStyle = col; for (let i = 0; i < pts.length * upto; i++) { const [x, y, side] = pts[i]; g.beginPath(); g.ellipse(x + side * w, y, 2.2, 3.2, 0, 0, 7); g.fill(); } };
const steps = (x0, y0, x1, y1, bend) => Array.from({ length: 40 }, (_, i) => { const u = i / 39; return [x0 + (x1 - x0) * u + Math.sin(u * Math.PI) * bend, y0 + (y1 - y0) * u, i % 2 ? 1 : -1]; });
const cabin = [W * 0.42, H * 0.55], walkA = steps(60, 40, cabin[0] - 14, cabin[1] - 30, 90), walkB = steps(W - 60, 70, cabin[0] + 14, cabin[1] - 30, -110);
function extras(t) {
  if (scene === "road" || scene === "now") { // cars up (and down) the highway
    const cars = scene === "road" ? [[0, "#b6463b", 1]] : [[0, "#b6463b", 1], [0.45, "#22344d", 1], [0.2, "#e8e2d4", -1]];
    for (const [off, col, dir] of cars) { let u = ((t / 9 + off) % 1); if (dir < 0) u = 1 - u; const [x, y] = onRoad(u), [x2, y2] = onRoad(u + 0.005 * dir); car(x + dir * 5, y, Math.atan2(x2 - x, -(y2 - y)), col); }
  }
  if (scene === "now") { g.fillStyle = "rgba(255,255,255,.95)"; for (let i = 0; i < 14; i++) { const y = ((P[i] * H + t * 40) % H), x = river(y) + (P[i + 20] - 0.5) * 14, a = 0.5 + 0.5 * Math.sin(t * 3 + i); g.globalAlpha = a; g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); } g.globalAlpha = 1; }
  if (scene === "road" || scene === "tracks") { // wind: long thin streaks blowing across
    g.strokeStyle = "rgba(255,255,255,.75)"; g.lineCap = "round";
    for (let i = 0; i < 9; i++) { const ph = (t * 0.35 + P[i + 40]) % 1, y = P[i + 80] * H, x = -200 + ph * (W + 400); g.lineWidth = 1.5 + P[i] * 1.5; g.globalAlpha = Math.sin(ph * Math.PI) * 0.8;
      g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 50, y - 10, x + 100, y + 8, x + 160, y - 4); g.stroke(); }
    g.globalAlpha = 1;
  }
  if (scene === "depart") { // off the runway, climbing away north-west, again every 7 s
    const u = (t % 7) / 5; if (u <= 1) { const e = u * u, x0 = den.x + 20, y0 = den.y, x = x0 - e * 520, y = y0 - e * 760, s = 1 + e * 1.6;
      g.fillStyle = "rgba(182,70,59,.7)"; for (let k = 0; k < e; k += 0.02) { g.beginPath(); g.arc(x0 - k * 520, y0 - k * 760, 1.6, 0, 7); g.fill(); }
      g.fillStyle = "rgba(40,50,70,.18)"; g.beginPath(); g.ellipse(x + 40 * e, y + 30 * e, 12 * s, 4 * s, 0, 0, 7); g.fill(); plane(x, y, Math.atan2(-760, -520), s); }
  }
  if (scene === "summit") { // a string of prayer flags across the top, stirring
    const [px, py] = peak, cols = ["#3d6fb6", "#f4f1ea", "#b6463b", "#4f8a5b", "#e2b53c"];
    g.strokeStyle = "rgba(60,50,40,.6)"; g.lineWidth = 1; g.beginPath(); g.moveTo(px - 60, py - 10); g.quadraticCurveTo(px, py + 12, px + 60, py - 14); g.stroke();
    for (let i = 0; i < 10; i++) { const u = (i + 0.5) / 10, x = px - 60 + 120 * u, y = (1 - u) ** 2 * (py - 10) + 2 * (1 - u) * u * (py + 12) + u * u * (py - 14), f = Math.sin(t * 4 + i) * 2;
      g.fillStyle = cols[i % 5]; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.lineTo(x + 4 + f, y + 9); g.lineTo(x - 4 + f, y + 9); g.fill(); }
    g.fillStyle = "#4a453f"; g.beginPath(); g.arc(px - 64, py - 10, 2.5, 0, 7); g.arc(px + 64, py - 14, 2.5, 0, 7); g.fill();
  }
  if (scene === "tracks") { // two riders' tracks, side by side down the open slope, drawn as they go (every 9 s)
    const u = Math.min(1, (t % 9) / 6);
    for (const [dx, ph] of [[-16, 0], [16, 0.5]]) { g.strokeStyle = "rgba(120,140,165,.55)"; g.lineWidth = 3; g.beginPath();
      for (let y = 30; y < 30 + (H - 60) * u; y += 4) { const x = W / 2 + dx + Math.sin(y / 110 + ph) * 90; y === 30 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
  }
  if (scene === "meet") { // the cabin, warm inside; two lines of steps arriving
    const u = Math.min(1, (t % 10) / 6), [cx, cy] = cabin;
    trail(walkA, u, "rgba(110,128,150,.55)", 4); trail(walkB, u, "rgba(110,128,150,.55)", 4);
    g.save(); g.translate(cx, cy); g.scale(1.6, 1.6); g.translate(-cx, -cy);
    g.fillStyle = "rgba(40,50,70,.22)"; g.fillRect(cx - 20, cy - 12, 52, 36);
    g.fillStyle = "#7a5a44"; g.fillRect(cx - 26, cy - 18, 52, 36); g.fillStyle = "#f6f4ef"; g.beginPath(); g.moveTo(cx - 32, cy - 18); g.lineTo(cx, cy - 34); g.lineTo(cx + 32, cy - 18); g.lineTo(cx + 32, cy + 2); g.lineTo(cx - 32, cy + 2); g.fill(); // snowy roof
    const glow = 0.75 + 0.25 * Math.sin(t * 2.3); g.fillStyle = `rgba(255,200,110,${glow})`; g.fillRect(cx - 18, cy + 4, 9, 8); g.fillRect(cx + 9, cy + 4, 9, 8);
    const gl = g.createRadialGradient(cx, cy + 14, 4, cx, cy + 14, 60); gl.addColorStop(0, `rgba(255,190,100,${0.28 * glow})`); gl.addColorStop(1, "rgba(255,190,100,0)"); g.fillStyle = gl; g.beginPath(); g.arc(cx, cy + 14, 60, 0, 7); g.fill();
    g.restore();
    for (let i = 0; i < 5; i++) { const ph = (t * 0.3 + i / 5) % 1; g.fillStyle = `rgba(250,250,252,${0.6 * (1 - ph)})`; g.beginPath(); g.arc(cx + 16 + ph * 30, cy - 30 - ph * 70, 5 + ph * 12, 0, 7); g.fill(); } // chimney smoke
  }
}
const FLAKES = 60 * (SC.snow || 1);
const t0 = performance.now();
function frame(now) {
  const t = (now - t0) / 1000;
  g.clearRect(0, 0, W, H); g.save(); g.drawImage(mask, 0, 0); g.globalCompositeOperation = "source-in"; g.drawImage(ground, 0, 0);
  g.globalCompositeOperation = "source-atop";
  for (const cl of clouds) { // shadows first, then the clouds above them
    const x = ((cl.x + cl.v * t * 6) % (W + 300)) - 150, y = cl.y;
    g.fillStyle = "rgba(60,80,110,.12)"; for (const [dx, dy, s] of cl.puffs) { g.beginPath(); g.arc(x + dx * cl.r + 34, y + dy * cl.r + 26, cl.r * s, 0, 7); g.fill(); }
  }
  extras(t);
  // the planes, with a dotted trail; they slow and shrink as they come down
  for (const p of planes) {
    const u = Math.min(1, Math.max(0, (t - p.delay) / 3.2)), e = 1 - (1 - u) ** 2;
    const cx = (p.from[0] + den.x) / 2, cy = Math.min(p.from[1], den.y) - 120;
    const at = (k) => [(1 - k) ** 2 * p.from[0] + 2 * (1 - k) * k * cx + k * k * den.x, (1 - k) ** 2 * p.from[1] + 2 * (1 - k) * k * cy + k * k * den.y];
    g.fillStyle = "rgba(182,70,59,.7)";
    for (let k = 0; k < e; k += 0.025) { const [x, y] = at(k); g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
    if (u > 0 && u < 1) { const [x, y] = at(e), [x2, y2] = at(Math.min(1, e + 0.01)); const s = 2.4 - 1.1 * e; g.fillStyle = "rgba(40,50,70,.18)"; g.beginPath(); g.ellipse(x + 30 * (1 - e), y + 24 * (1 - e), 12 * s, 4 * s, 0, 0, 7); g.fill(); plane(x, y, Math.atan2(y2 - y, x2 - x), s); }
  }
  for (const cl of clouds) {
    const x = ((cl.x + cl.v * t * 6) % (W + 300)) - 150, y = cl.y;
    for (const [dx, dy, s] of cl.puffs) { const gr = g.createRadialGradient(x + dx * cl.r - 6, y + dy * cl.r - 8, 2, x + dx * cl.r, y + dy * cl.r, cl.r * s); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.7, "rgba(250,251,253,.95)"); gr.addColorStop(1, "rgba(235,240,246,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x + dx * cl.r, y + dy * cl.r, cl.r * s, 0, 7); g.fill(); }
  }
  // falling snow, tiny
  g.fillStyle = "rgba(255,255,255,.9)";
  for (let i = 0; i < FLAKES; i++) { const x = (P[i % 512] * W + t * 8 * (1 + P[(i + 60) % 512]) + i * 37) % W, y = (P[i + 120] * H + t * 30 * (1 + P[i + 200])) % H; g.beginPath(); g.arc(x, y, 1.2 + P[i + 300] * 1.4, 0, 7); g.fill(); }
  // landed: a stamp at Denver
  const landed = planes.filter((p) => t - p.delay > 3.2).length;
  if (landed && planes.length) { g.fillStyle = "rgba(253,251,246,.92)"; g.fillRect(den.x - 44, den.y + 30, 88, 22); g.fillStyle = "#b6463b"; g.font = "600 20px 'Cormorant Garamond', serif"; g.textAlign = "center"; g.fillText(`DEN · ${landed}/${planes.length}`, den.x, den.y + 47); }
  g.restore();
  if (alive()) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
}

// The intro's sound, made here (no files): the hiss of boards on snow, swelling as each rider sets an edge
// and panned to where they are; and a slow, quiet piano-ish tune over soft pads. Starts on a tap (browsers
// won't play before one).
function startSound(riders, M) {
  const A = new (window.AudioContext || window.webkitAudioContext)(), out = A.createGain(); out.gain.value = 0.55; out.connect(A.destination);
  // a short room: a feedback delay, lowpassed
  const wet = A.createGain(), dl = A.createDelay(), fb = A.createGain(), lp = A.createBiquadFilter();
  dl.delayTime.value = 0.32; fb.gain.value = 0.38; lp.type = "lowpass"; lp.frequency.value = 2200; wet.gain.value = 0.35;
  dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(out);
  // noise, shared
  const nb = A.createBuffer(1, A.sampleRate * 2, A.sampleRate), d = nb.getChannelData(0);
  let b0 = 0; for (let i = 0; i < d.length; i++) { b0 = 0.97 * b0 + 0.03 * (Math.random() * 2 - 1); d[i] = (Math.random() * 2 - 1) * 0.5 + b0 * 3; } // white with some weight
  // one hiss per rider: noise → bandpass (higher, brighter on the edge) → gain → pan
  const voices = (riders(0)).map(() => {
    const src = A.createBufferSource(); src.buffer = nb; src.loop = true; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const bp = A.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.7; bp.frequency.value = 1200;
    const gn = A.createGain(); gn.gain.value = 0; const pan = A.createStereoPanner();
    src.connect(bp); bp.connect(gn); gn.connect(pan); pan.connect(out); src.start();
    return { bp, gn, pan };
  });
  const tick = () => {
    const t = performance.now() / 1000, rs = riders(t);
    rs.forEach((r, i) => { const v = voices[i]; if (!v) return;
      const on = r.y > -0.05 && r.y < 1.05 ? 1 : 0, edge = Math.abs(r.lean) ** 2; // one long "shhh" through each turn's apex
      v.gn.gain.setTargetAtTime(on * (0.008 + 0.05 * edge) * M.hiss, A.currentTime, 0.35);
      v.bp.frequency.setTargetAtTime(600 + edge * 900, A.currentTime, 0.4);
      v.pan.pan.setTargetAtTime((r.x - 0.5) * 1.6, A.currentTime, 0.1); });
    if (A.state !== "closed") requestAnimationFrame(tick);
  };
  tick();
  // wind: low noise breathing in and out (a thin whistle on it, up high)
  if (M.wind) { const src = A.createBufferSource(); src.buffer = nb; src.loop = true; const lp2 = A.createBiquadFilter(); lp2.type = M.high ? "bandpass" : "lowpass"; lp2.frequency.value = M.high ? 1400 : 420; lp2.Q.value = M.high ? 4 : 0.7;
    const wg = A.createGain(); wg.gain.value = M.wind; const lfo = A.createOscillator(), lg = A.createGain(); lfo.frequency.value = 0.09; lg.gain.value = M.wind * 0.8; lfo.connect(lg); lg.connect(wg.gain);
    src.connect(lp2); lp2.connect(wg); wg.connect(out); src.start(); lfo.start(); }
  // the tune: D major pentatonic, a chord every 4 s under a few soft notes
  const note = (f, at, len, vol, type = "sine") => {
    const o = A.createOscillator(), o2 = A.createOscillator(), g = A.createGain(); o.type = M.pluck ? "triangle" : type; o2.type = "sine"; o.frequency.value = f; o2.frequency.value = f * 2.003;
    const g2 = A.createGain(); g2.gain.value = 0.15; o2.connect(g2); g2.connect(g); o.connect(g);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    g.connect(out); g.connect(dl); o.start(at); o2.start(at); o.stop(at + len + 0.1); o2.stop(at + len + 0.1);
  };
  const pad = (fs, at, len) => { for (const f of fs) { const o = A.createOscillator(), g = A.createGain(), f2 = A.createBiquadFilter(); o.type = "triangle"; o.frequency.value = f; f2.type = "lowpass"; f2.frequency.value = 900;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.018, at + 1.5); g.gain.linearRampToValueAtTime(0, at + len); o.connect(f2); f2.connect(g); g.connect(out); g.connect(dl); o.start(at); o.stop(at + len + 0.1); } };
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  const { chords, tune, bar: B, per } = M;
  let bar = 0; const t0 = A.currentTime + 0.1;
  const plan = () => { // schedule a bar ahead
    while (t0 + bar * B < A.currentTime + 6) { const at = t0 + bar * B, ch = chords[bar % chords.length];
      pad(ch.map(hz), at, B * 1.1);
      for (let i = 0; i < per; i++) {
        const m = M.arp ? ch[i % 4] + 12 * (1 + Math.floor(i / 4)) : tune[(bar * per + i) % tune.length]; // arp: climb the chord
        if (m && Math.random() < 0.85) note(hz(m), at + i * (B / per) + (i % 2) * 0.06 * B / 4, M.pluck ? 1.2 : 2.6, M.pluck ? 0.04 : 0.05);
      }
      bar++; }
    if (A.state !== "closed") setTimeout(plan, 1000);
  };
  plan();
  return A;
}
