// The corner map while skiing, as pixel art: seen from above, the way ahead up, a little pixel rider in
// the middle. Snow shaded by the slope, woods, runs in their colours, the route in gold, lifts as dotted
// lines with their stations. Drawn into a tiny canvas that the page scales up without smoothing.
const C = {
  snow: [238, 242, 247], shade: [196, 207, 222], tree: [63, 107, 79], treeDark: [44, 79, 58],
  easy: [47, 163, 90], intermediate: [47, 111, 214], advanced: [35, 38, 46], expert: [35, 38, 46],
  route: [242, 182, 50], lift: [91, 95, 105], station: [138, 90, 53], flag: [232, 69, 60],
};
// The rider, 5 × 8, facing up: helmet, goggles, jacket, pants, board.
const SPRITE = [
  "..K..",
  ".KGK.",
  ".JJJ.",
  "JJJJJ",
  ".JJJ.",
  ".P.P.",
  "BBBBB",
  ".....",
];
const SP = { K: [25, 27, 30], G: [149, 162, 249], J: [95, 125, 85], P: [214, 205, 186], B: [196, 72, 60] };

export class PixelMap {
  constructor(canvas, T, R, mask) {
    this.canvas = canvas; this.T = T; this.R = R; this.mask = mask;
    this.g = canvas.getContext("2d");
    this.view = null;
  }

  // n: pixels across; radius: metres from the middle to the edge; (x, z, heading): the rider.
  draw({ x, z, heading, route = [], dest = null, n = 72, radius = 260 }) {
    const { T, R, mask } = this, cv = this.canvas;
    if (cv.width !== n) { cv.width = cv.height = n; }
    const img = this.g.createImageData(n, n), px = img.data, m = (2 * radius) / n;
    // Screen up is the heading: a pixel (i, j) is at world point centre + right·u + ahead·v.
    const fx = Math.sin(heading), fz = Math.cos(heading), rx = -fz, rz = fx; // right of the way you face
    const world = (i, j) => { const u = (i + 0.5 - n / 2) * m, v = (n / 2 - j - 0.5) * m; return [x + rx * u + fx * v, z + rz * u + fz * v]; };
    const toPix = (wx, wz) => { const dx = wx - x, dz = wz - z, u = dx * rx + dz * rz, v = dx * fx + dz * fz; return [Math.floor(u / m + n / 2), Math.floor(n / 2 - v / m)]; };
    this.view = { world, toPix, n };
    const put = (i, j, c) => { if (i < 0 || j < 0 || i >= n || j >= n) return; const k = (j * n + i) * 4; px[k] = c[0]; px[k + 1] = c[1]; px[k + 2] = c[2]; px[k + 3] = 255; };
    // Snow, lit from the west so the relief shows; woods as two-tone tree pixels.
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const [wx, wz] = world(i, j), s = m;
      const slope = (T.heightAt(wx - s, wz) - T.heightAt(wx + s, wz)) / (2 * s);
      const t = Math.max(0, Math.min(1, 0.55 - slope * 2.2));
      const c = [0, 1, 2].map((k) => Math.round(C.shade[k] + (C.snow[k] - C.shade[k]) * t));
      put(i, j, mask(wx, wz) ? ((i + j) % 3 ? C.tree : C.treeDark) : c);
    }
    const line = (pts, c, w = 1, dash = 0) => {
      let step = 0;
      for (let k = 1; k < pts.length; k++) {
        let [x0, y0] = toPix(...pts[k - 1]); const [x1, y1] = toPix(...pts[k]);
        if ((x0 < -n && x1 < -n) || (x0 > 2 * n && x1 > 2 * n) || (y0 < -n && y1 < -n) || (y0 > 2 * n && y1 > 2 * n)) continue;
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (let guard = 0; guard < 4 * n; guard++) {
          if (!dash || step++ % dash < dash / 2) for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) put(x0 + a, y0 + b, c);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      }
    };
    const near = (pts) => pts.some(([wx, wz]) => Math.abs(wx - x) < radius * 1.6 && Math.abs(wz - z) < radius * 1.6);
    for (const r of R.runs) if (!r.area && near(r.pts)) line(r.pts, C[r.level] || C.intermediate, radius > 400 ? 1 : 2);
    if (route.length) line(route, C.route, 2);
    for (const l of R.lifts) {
      if (!near(l.pts)) continue;
      line(l.pts, C.lift, 1, 4);
      for (const p of [l.pts[0], l.pts[l.pts.length - 1]]) { const [i, j] = toPix(...p); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) put(i + a, j + b, C.station); }
    }
    if (dest) { const [i, j] = toPix(...dest); for (let b = 0; b < 6; b++) put(i, j - b, C.advanced); for (let a = 1; a < 4; a++) for (let b = 4; b < 6; b++) put(i + a, j - b, C.flag); }
    // The rider in the middle, with a dark outline so it reads on snow and trees alike.
    const ox = Math.floor(n / 2 - 2), oy = Math.floor(n / 2 - 4);
    SPRITE.forEach((row, b) => [...row].forEach((ch, a) => {
      if (ch === ".") { const near8 = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([da, db]) => SPRITE[b + db]?.[a + da] && SPRITE[b + db][a + da] !== "."); if (near8) put(ox + a, oy + b, [20, 24, 32]); return; }
      put(ox + a, oy + b, SP[ch]);
    }));
    this.g.putImageData(img, 0, 0);
  }

  // A point on the canvas (0..1 across and down) to the world point it shows.
  toWorld(fx, fy) {
    if (!this.view) return null;
    const { world, n } = this.view;
    return world(fx * n - 0.5, fy * n - 0.5);
  }
}
