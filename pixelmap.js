// The corner map while skiing, as clean pixel art: seen from above, the way ahead up, a pixel rider in
// the middle. What you need stands out and the rest steps back: your route thick in gold with a dark
// edge, the next junction blinking, lifts dark and dashed with station blocks; other runs thin and pale,
// woods only a faint tint. Enlarged, it names the lifts and where you're going. Drawn into a small
// canvas that the page scales up without smoothing.
const C = {
  snow: [244, 247, 250], wood: [214, 228, 214], edge: [40, 44, 52],
  easy: [120, 196, 146], intermediate: [126, 164, 226], advanced: [120, 124, 134], expert: [120, 124, 134],
  route: [242, 182, 50], lift: [52, 56, 66], station: [52, 56, 66], flag: [232, 69, 60], junction: [232, 69, 60],
};
// The rider, 7 × 10, facing up: helmet, goggles, jacket, pants, board; outlined when drawn.
const SPRITE = [
  "..KKK..",
  ".KGGGK.",
  "..JJJ..",
  ".JJJJJ.",
  "JJJJJJJ",
  ".JJJJJ.",
  "..PPP..",
  ".PP.PP.",
  "BBBBBBB",
  ".BBBBB.",
];
const SP = { K: [25, 27, 30], G: [149, 162, 249], J: [95, 125, 85], P: [214, 205, 186], B: [196, 72, 60] };

export class PixelMap {
  constructor(canvas, T, R, mask) {
    this.canvas = canvas; this.T = T; this.R = R; this.mask = mask;
    this.g = canvas.getContext("2d");
    this.view = null;
  }

  // n: pixels across; radius: metres from the middle to the edge; (x, z, heading): the rider; route: the
  // way still to go; junction: the next turn-off [x, z]; dest: [x, z, name]; labels: name the lifts.
  draw({ x, z, heading, route = [], junction = null, dest = null, n = 96, radius = 260, labels = false, blink = true }) {
    const { T, R, mask } = this, cv = this.canvas;
    if (cv.width !== n) cv.width = cv.height = n;
    const img = this.g.createImageData(n, n), px = img.data, m = (2 * radius) / n;
    const fx = Math.sin(heading), fz = Math.cos(heading), rx = -fz, rz = fx; // ahead, and to your right
    const world = (i, j) => { const u = (i + 0.5 - n / 2) * m, v = (n / 2 - j - 0.5) * m; return [x + rx * u + fx * v, z + rz * u + fz * v]; };
    const toPix = (wx, wz) => { const dx = wx - x, dz = wz - z, u = dx * rx + dz * rz, v = dx * fx + dz * fz; return [Math.floor(u / m + n / 2), Math.floor(n / 2 - v / m)]; };
    this.view = { world, n };
    const put = (i, j, c) => { if (i < 0 || j < 0 || i >= n || j >= n) return; const k = (j * n + i) * 4; px[k] = c[0]; px[k + 1] = c[1]; px[k + 2] = c[2]; px[k + 3] = 255; };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) put(i, j, mask(...world(i, j)) ? C.wood : C.snow);
    const dot = (i, j, c, w) => { const o = Math.floor(w / 2); for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) put(i + a - o, j + b - o, c); };
    const line = (pts, c, w = 1, dash = 0) => {
      let step = 0;
      for (let k = 1; k < pts.length; k++) {
        let [x0, y0] = toPix(...pts[k - 1]); const [x1, y1] = toPix(...pts[k]);
        if ((x0 < 0 && x1 < 0) || (x0 >= n && x1 >= n) || (y0 < 0 && y1 < 0) || (y0 >= n && y1 >= n)) continue;
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (let guard = 0; guard < 4 * n; guard++) {
          if (!dash || step++ % dash < dash / 2) dot(x0, y0, c, w);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      }
    };
    const near = (pts) => pts.some(([wx, wz]) => Math.abs(wx - x) < radius * 1.5 && Math.abs(wz - z) < radius * 1.5);
    const thin = Math.max(1, Math.round(n / 64));
    for (const r of R.runs) if (!r.area && near(r.pts)) line(r.pts, C[r.level] || C.intermediate, thin);
    const lifts = R.lifts.filter((l) => l.kind !== "magic_carpet" && near(l.pts));
    for (const l of lifts) {
      line(l.pts, C.lift, thin, 6);
      for (const p of [l.pts[0], l.pts[l.pts.length - 1]]) { const [i, j] = toPix(...p); dot(i, j, [255, 255, 255], thin * 3 + 2); dot(i, j, C.station, thin * 3); }
    }
    // Your way: a dark edge, then gold on top.
    if (route.length) { line(route, C.edge, thin * 3 + 2); line(route, C.route, thin * 3); }
    if (junction && blink) { const [i, j] = toPix(...junction); dot(i, j, [255, 255, 255], thin * 4 + 2); dot(i, j, C.junction, thin * 4); }
    if (dest) {
      const [i, j] = toPix(dest[0], dest[1]), s = thin;
      for (let b = 0; b < 7 * s; b++) dot(i, j - b, C.edge, s);
      for (let a = 1; a < 5 * s; a++) for (let b = 4 * s; b < 7 * s; b++) put(i + a, j - b, C.flag);
    }
    // The rider in the middle, outlined, bigger on a bigger map.
    const k = Math.max(1, Math.round(n / 96)), W = SPRITE[0].length, H = SPRITE.length;
    const ox = Math.floor(n / 2 - (W * k) / 2), oy = Math.floor(n / 2 - (H * k) / 2);
    const filled = (a, b) => SPRITE[b]?.[a] && SPRITE[b][a] !== ".";
    for (let b = -1; b <= H; b++) for (let a = -1; a <= W; a++) {
      const ch = SPRITE[b]?.[a];
      const c = ch && ch !== "." ? SP[ch] : [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([da, db]) => filled(a + da, b + db)) ? [255, 255, 255] : null;
      if (c) for (let p = 0; p < k; p++) for (let q = 0; q < k; q++) put(ox + a * k + p, oy + b * k + q, c);
    }
    this.g.putImageData(img, 0, 0);
    // Names, on the big map: lifts at their bottom station, and where you're going.
    if (labels) {
      const g = this.g;
      g.font = `600 ${Math.max(7, Math.round(n / 22))}px -apple-system, PingFang SC, sans-serif`;
      g.textBaseline = "bottom";
      const tag = (text, [i, j], bg) => {
        if (i < 2 || j < 6 || i > n - 2 || j > n - 1) return;
        const w = g.measureText(text).width + 4, h = Math.round(n / 18), l = Math.min(n - w - 1, Math.max(1, i - w / 2));
        g.fillStyle = bg; g.fillRect(l, j - h - 3, w, h);
        g.fillStyle = bg === "#f2b632" ? "#1d1606" : "#fff"; g.fillText(text, l + 2, j - 3);
      };
      for (const l of lifts) tag(l.name, toPix(...l.pts[0]), "rgba(40,44,52,.85)");
      if (dest?.[2]) tag(dest[2], toPix(dest[0], dest[1]), "#f2b632");
    }
  }

  // A point on the canvas (0..1 across and down) to the world point it shows.
  toWorld(fx, fy) {
    if (!this.view) return null;
    const { world, n } = this.view;
    return world(fx * n - 0.5, fy * n - 0.5);
  }
}
