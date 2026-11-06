// A day's group photo, drawn once in 2D and kept as a JPEG: that mountain's watercolour behind, a snow bank
// in front, and everyone who skied that day on it as the owner's crayon snowboarder (assets/icons), each in
// their own colours, in a pose of their own, a little turned and overlapping like a real group shot.
// The pose sheets are plain paintings on paper: the paper around the figure is keyed out (filled in from the
// edges, so the white helmet inside the outline stays), and the jacket, pants and board are found by colour
// once, so each person can be repainted in theirs.

// The poses: one line each. A sheet is a square painting of one figure on paper, its feet (or board) at the
// bottom. The owner's next sheets drop in here as files and a line: standing with the board, peace sign,
// waving, holding a photo up with both hands, sitting.
export const POSES = [
  { id: "crouch", src: "assets/icons/ride_crayon_0.png?v=1" },
  { id: "hop", src: "assets/icons/ride_crayon_1.png?v=1" },
  { id: "cheer", src: "assets/icons/ride_crayon_2.png?v=1" },
];

export const W = 900, H = 700;
// A day with no mountain picked: the snowy ridges in the heart of the Colorado watercolour (the start page's map).
const GENERAL = { url: "assets/wc/colorado.jpg?v=6", crop: [1230, 1230, 600, 467] };
const paint = (id) => (id ? { url: `assets/wc/${id}.jpg?v=1`, crop: null } : GENERAL);

// The crayon board's colour for each friend's own board (character.js BOARDS), and colours for anyone
// whose look has none, picked by who they are.
const BOARD = { A: "#e0694a", B: "#2f3036", C: "#5c2f6c", D: "#3b7fd4" };
const PALETTE = [["#4a5a6e", "#c5c4b6", "#b6463b"], ["#a8674f", "#3b3d40", "#2f5446"], ["#6e5f6e", "#dcd7cc", "#c9a227"], ["#2f5446", "#a39d8f", "#4a6fa5"], ["#8e4a36", "#4f5645", "#dcd7cc"], ["#7b8a96", "#222326", "#e0694a"]];

const imgs = new Map();
const loadImg = (url) => {
  if (!imgs.has(url)) imgs.set(url, new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => { imgs.delete(url); no(new Error("image " + url)); }; im.src = url; }));
  return imgs.get(url);
};
const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
// Draw a painting into a box, covering it (from its crop; else inside its torn painted edges).
function cover(g, im, crop, x, y, w, h) {
  const iw = im.naturalWidth, ih = im.naturalHeight;
  let [sx, sy, sw, sh] = crop || [iw * 0.05, ih * 0.07, iw * 0.9, ih * 0.88];
  const k = w / h;
  if (sw / sh > k) { const nw = sh * k; sx += (sw - nw) / 2; sw = nw; } else { const nh = sw / k; sy += (sh - nh) * 0.35; sh = nh; }
  g.drawImage(im, sx, sy, sw, sh, x, y, w, h);
}
const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ""); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h / 6) + 1) % 1, mx ? d / mx : 0, mx / 255];
}

// ---- A pose sheet, made ready once: the figure on transparent, which part each pixel is, and its bounds.
const JACKET = 1, PANTS = 2, BOARDP = 3, REF = [0, 0.68, 0.95, 0.8]; // each part's usual brightness, to keep the crayon grain
const sheets = new Map();
export const sheetOf = (pose) => {
  if (!sheets.has(pose.src)) sheets.set(pose.src, loadImg(pose.src).then(prepare));
  return sheets.get(pose.src);
};
function prepare(im) {
  const w = im.naturalWidth, h = im.naturalHeight, c = canvas(w, h), g = c.getContext("2d");
  g.drawImage(im, 0, 0);
  const data = g.getImageData(0, 0, w, h), px = data.data, N = w * h;
  // The paper: whatever is close to the corner's colour and reachable from the edges.
  const pr = px[0], pg = px[1], pb = px[2], T = 22, dist = new Float32Array(N), bg = new Uint8Array(N), stack = [];
  for (let i = 0; i < N; i++) dist[i] = Math.hypot(px[i * 4] - pr, px[i * 4 + 1] - pg, px[i * 4 + 2] - pb);
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || dist[i] > T) continue;
    bg[i] = 1; const x = i % w;
    if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1); if (i >= w) stack.push(i - w); if (i < N - w) stack.push(i + w);
  }
  // Which part: each pixel's colour, then a vote in its neighbourhood (the crayon grain is speckled).
  const cand = [null, new Uint8Array(N), new Uint8Array(N), new Uint8Array(N)], val = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (bg[i]) continue;
    const [hh, s, v] = hsv(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); val[i] = v;
    if (hh >= 0.11 && hh <= 0.25 && s > 0.25 && v > 0.35) cand[JACKET][i] = 1;
    else if (hh >= 0.06 && hh <= 0.17 && s > 0.07 && s <= 0.25 && v > 0.8) cand[PANTS][i] = 1;
    else if ((hh <= 0.06 || hh >= 0.95) && s > 0.38 && v > 0.45) cand[BOARDP][i] = 1;
  }
  const R = 4, box = (m) => { // the share of a (2R+1)² window around each pixel that is m
    const S = new Float32Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) for (let x = 0, row = 0; x < w; x++) { row += m[y * w + x]; S[(y + 1) * (w + 1) + x + 1] = S[y * (w + 1) + x + 1] + row; }
    const out = new Float32Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - R), x1 = Math.min(w, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(h, y + R + 1);
      out[y * w + x] = (S[y1 * (w + 1) + x1] - S[y0 * (w + 1) + x1] - S[y1 * (w + 1) + x0] + S[y0 * (w + 1) + x0]) / ((2 * R + 1) ** 2);
    }
    return out;
  };
  const dens = [null, box(cand[1]), box(cand[2]), box(cand[3])], part = new Uint8Array(N);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let i = 0; i < N; i++) {
    if (bg[i]) { px[i * 4 + 3] = 0; continue; }
    let k = 0, best = 0.35; for (let p = 1; p <= 3; p++) if (dens[p][i] > best) { best = dens[p][i]; k = p; }
    if (k && val[i] > 0.5) part[i] = k;
    // Soft edges where the figure meets the paper.
    const x = i % w, y = (i / w) | 0;
    if ((x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w])) px[i * 4 + 3] = Math.max(0, Math.min(255, ((dist[i] - T) / 50) * 255));
    if (px[i * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  // A part is a whole patch of colour: specks of it elsewhere (the helmet's grain reads as pants) are dropped.
  const seen = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (!part[i] || seen[i]) continue;
    const k = part[i], blob = [i]; seen[i] = 1;
    for (let j = 0; j < blob.length; j++) {
      const q = blob[j], x = q % w;
      for (const r of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w]) if (r >= 0 && r < N && !seen[r] && part[r] === k) { seen[r] = 1; blob.push(r); }
    }
    if (blob.length < N * 0.006) for (const q of blob) part[q] = 0;
  }
  return { w, h, data, part, val, bbox: [x0, y0, x1 + 1, y1 + 1] };
}
// The sheet in someone's colours: [jacket, pants, board] as [r, g, b] (null keeps the painted one).
function dressed(sh, cols) {
  const c = canvas(sh.w, sh.h), g = c.getContext("2d"), d = new ImageData(new Uint8ClampedArray(sh.data.data), sh.w, sh.h), px = d.data;
  for (let i = 0; i < sh.part.length; i++) {
    const k = sh.part[i], col = k && cols[k - 1]; if (!col) continue;
    const f = Math.max(0.55, Math.min(1.2, sh.val[i] / REF[k]));
    const grain = (sh.val[i] - REF[k]) * 70; // so dark colours keep the crayon's grain too
    px[i * 4] = col[0] * f + grain; px[i * 4 + 1] = col[1] * f + grain; px[i * 4 + 2] = col[2] * f + grain;
  }
  g.putImageData(d, 0, 0);
  return c;
}

// ---- Who wears what. A look's rider: { ch } (its colours by material), { preset, colors } or { preset }.
let presets = null;
const presetsOf = () => (presets ||= fetch("data/rider_templates.json?v=1").then((r) => r.json()).then((j) => j.presets).catch(() => ({}))); // the four friends' colours (character.js presets)
export function coloursOf(rider, key, P) {
  const pal = PALETTE[hashOf(key) % PALETTE.length];
  const ch = rider?.ch || P[rider?.preset] || null, legacy = rider?.colors || {};
  const jacket = hex(legacy.jacket) || hex(ch?.colors?.MAT_jacket) || hex(pal[0]);
  const pants = hex(legacy.pants) || hex(ch?.colors?.MAT_pants) || hex(pal[1]);
  const board = hex(BOARD[ch?.board || rider?.preset]) || hex(pal[2]);
  return [jacket, pants, board];
}
const hashOf = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
// A little random that's the same every time for the same day and person.
const rng = (seed) => { let s = hashOf(seed) || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)) >>> 0) / 4294967296; };

// spec: { resort (id or null), date, people: [{ key, rider }] }. Resolves to a JPEG blob.
export async function renderPhoto(spec) {
  const bg = paint(spec.resort), ppl = spec.people.slice(0, 8), n = ppl.length;
  const [bgIm, P] = await Promise.all([loadImg(bg.url), presetsOf()]);
  const start = hashOf(`${spec.date}`) % POSES.length;
  // Poses: round the list from a start picked by the day, so neighbours differ.
  const poses = ppl.map((p, i) => POSES[(start + i * (POSES.length > 2 ? 2 : 1)) % POSES.length]);
  const sh = await Promise.all(poses.map(sheetOf));
  const out = canvas(W, H), g = out.getContext("2d");
  cover(g, bgIm, bg.crop, 0, 0, W, H);
  // The snow bank they stand on.
  const bank = g.createLinearGradient(0, H * 0.6, 0, H);
  bank.addColorStop(0, "rgba(244,246,248,0)"); bank.addColorStop(0.45, "rgba(244,246,248,.9)"); bank.addColorStop(1, "#eef0f3");
  g.fillStyle = bank; g.fillRect(0, H * 0.6, W, H * 0.4);
  // Sizes: one figure about half the photo's height, smaller as more of them squeeze in, a third overlapping.
  const fh = Math.min(H * (n === 1 ? 0.58 : 0.5), (W * 0.94) / (0.95 + (n - 1) * 0.68));
  const step = fh * 0.68, x0 = W / 2 - ((n - 1) * step) / 2;
  const figs = ppl.map((p, i) => {
    const r = rng(`${spec.date}:${p.key}`), s = sh[i], [bx0, by0, bx1, by1] = s.bbox;
    const k = (fh / (by1 - by0)) * (0.92 + r() * 0.14);
    const back = n > 2 && i % 2 === 1; // every other one a step back, a little higher and smaller
    return { s, p, k: back ? k * 0.92 : k, x: x0 + i * step + (r() - 0.5) * step * 0.18, foot: H * (back ? 0.86 : 0.93) - r() * H * 0.02, tilt: (r() - 0.5) * 0.16, flip: i > (n - 1) / 2 || (n === 1 && r() < 0.5), back, bw: bx1 - bx0, bh: by1 - by0, bx0, by0 };
  });
  const order = [...figs].sort((a, b) => (a.back === b.back ? 0 : a.back ? -1 : 1));
  for (const f of order) {
    const w = f.bw * f.k, h = f.bh * f.k;
    // A soft shadow on the snow under each.
    const sg = g.createRadialGradient(f.x, f.foot - 4, 2, f.x, f.foot - 4, w * 0.5);
    sg.addColorStop(0, "rgba(70,86,120,.28)"); sg.addColorStop(1, "rgba(70,86,120,0)");
    g.save(); g.translate(f.x, f.foot - 4); g.scale(1, 0.22); g.translate(-f.x, -(f.foot - 4)); g.fillStyle = sg; g.fillRect(f.x - w * 0.6, f.foot - 4 - w * 0.6, w * 1.2, w * 1.2); g.restore();
    const art = dressed(f.s, coloursOf(f.p.rider, f.p.key, P));
    g.save(); g.translate(f.x, f.foot); g.rotate(f.tilt); if (f.flip) g.scale(-1, 1);
    g.drawImage(art, f.bx0, f.by0, f.bw, f.bh, -w / 2, -h, w, h);
    g.restore();
  }
  return new Promise((ok, no) => out.toBlob((b) => (b ? ok(b) : no(new Error("toBlob"))), "image/jpeg", 0.9));
}
