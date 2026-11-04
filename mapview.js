// The trail map, drawn like a cosy game map (think Stardew Valley): warm snow with soft relief, round
// little trees, runs as paths with white edges, lifts dashed with small station huts, lodges as houses,
// names in a friendly hand. It is painted once into one big picture; the corner map and the full-screen
// map only crop it and draw on top: your route in gold, where you are as your rider's portrait,
// bouncing, and on the full map a pin where you tapped. North is up.
const LV = { easy: "#62bd80", intermediate: "#6a95df", advanced: "#4b4f5a", expert: "#4b4f5a" };

export class TrailMap {
  constructor(T, R, mask, bases = []) {
    this.T = T; this.R = R; this.mask = mask; this.bases = bases;
    this.avatar = null;
    const src = (() => { try { return localStorage.getItem("prerunSprite"); } catch { return null; } })();
    if (src) this.setAvatar(src);
  }

  // The figure that stands for you: an image URL (a transparent full-body picture of your rider).
  setAvatar(src) { const im = new Image(); im.onload = () => (this.avatar = im); im.src = src; }

  // Paint the whole map once (lazily: it takes a moment).
  build() {
    if (this.base) return;
    const { T, R, mask } = this, W = Math.max(T.x1 - T.x0, T.z1 - T.z0);
    const s = (this.s = Math.min(0.5, 2000 / W)); // pixels per metre
    const cw = Math.round((T.x1 - T.x0) * s), ch = Math.round((T.z1 - T.z0) * s);
    const c = (this.base = document.createElement("canvas")); c.width = cw; c.height = ch;
    const g = c.getContext("2d");
    const P = (x, z) => [(x - T.x0) * s, (z - T.z0) * s];
    // Snow with soft relief, lit from the north-west, painted small and smoothed up.
    const rw = Math.round(cw / 4), rh = Math.round(ch / 4), rc = document.createElement("canvas"); rc.width = rw; rc.height = rh;
    const rg = rc.getContext("2d"), img = rg.createImageData(rw, rh), d = 4 / s;
    for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) {
      const x = T.x0 + i * d, z = T.z0 + j * d;
      const gx = (T.heightAt(x + d, z) - T.heightAt(x - d, z)) / (2 * d), gz = (T.heightAt(x, z + d) - T.heightAt(x, z - d)) / (2 * d);
      const lit = Math.max(0, Math.min(1, 0.62 + (gx + gz) * 1.1)); // facing up-left is bright
      const k = (j * rw + i) * 4, a = [251, 248, 241], b = [206, 214, 228];
      for (let q = 0; q < 3; q++) img.data[k + q] = Math.round(b[q] + (a[q] - b[q]) * lit);
      img.data[k + 3] = 255;
    }
    rg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.drawImage(rc, 0, 0, cw, ch);
    // Runs: a white edge, then the colour.
    const path = (pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...P(...p)) : g.moveTo(...P(...p)))); };
    g.lineCap = g.lineJoin = "round";
    const runs = R.runs.filter((r) => !r.area);
    for (const r of runs) { path(r.pts); g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 9 * s * 2.2; g.stroke(); }
    for (const r of runs) { path(r.pts); g.strokeStyle = LV[r.level] || LV.intermediate; g.lineWidth = 5 * s * 2.2; g.stroke(); }
    // Woods: round little trees, two greens and a highlight, a soft shadow; denser in the forest.
    let seed = 11; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const step = 26, tr = 9 * s * 1.6;
    for (let z = T.z0; z < T.z1; z += step) for (let x = T.x0; x < T.x1; x += step) {
      const px = x + (rand() - 0.5) * step, pz = z + (rand() - 0.5) * step;
      if (!mask(px, pz) || rand() > 0.75) continue;
      const [u, v] = P(px, pz), r = tr * (0.8 + rand() * 0.45);
      g.fillStyle = "rgba(60,70,90,.18)"; g.beginPath(); g.ellipse(u + r * 0.35, v + r * 0.55, r, r * 0.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#3f7a55"; g.beginPath(); g.arc(u, v, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#5c9c6a"; g.beginPath(); g.arc(u - r * 0.25, v - r * 0.3, r * 0.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.arc(u - r * 0.35, v - r * 0.45, r * 0.22, 0, Math.PI * 2); g.fill();
    }
    // Lifts: dashed dark line and a hut at each end.
    for (const l of R.lifts) {
      if (l.kind === "magic_carpet") continue;
      path(l.pts); g.setLineDash([10 * s * 2, 7 * s * 2]); g.strokeStyle = "#3a3f4a"; g.lineWidth = 2.4 * s * 2; g.stroke(); g.setLineDash([]);
      for (const p of [l.pts[0], l.pts[l.pts.length - 1]]) this.hut(g, ...P(...p), 14 * s * 2, "#8a5a35", "#4a5160");
    }
    // Lodges.
    for (const b of this.bases) this.hut(g, ...P(b.x, b.z), 26 * s * 2, "#c9563f", "#f1e6d2");
    // Names: runs along their middle, lifts and lodges by their huts.
    const label = (text, u, v, size, fg, bg) => {
      g.font = `700 ${size}px "Avenir Next Rounded", "Arial Rounded MT Bold", -apple-system, "PingFang SC", sans-serif`;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.lineWidth = size * 0.32; g.strokeStyle = bg; g.strokeText(text, u, v); g.fillStyle = fg; g.fillText(text, u, v);
    };
    const named = new Set();
    for (const r of runs.sort((a, b) => b.length - a.length)) {
      if (!r.name || named.has(r.name) || r.length < 250) continue;
      named.add(r.name);
      const p = r.pts[Math.floor(r.pts.length / 2)];
      label(r.name, ...P(...p), Math.max(9, 13 * s * 2.2), "#2d3440", "rgba(255,255,255,.9)");
    }
    for (const l of R.lifts) if (l.kind !== "magic_carpet") { const [u, v] = P(...l.pts[0]); label(`🚡 ${l.name}`, u, v + 16 * s * 2.2, Math.max(9, 12 * s * 2.2), "#ffffff", "rgba(58,63,74,.95)"); }
    for (const b of this.bases) { const [u, v] = P(b.x, b.z); label(`🏠 ${b.name}`, u, v + 24 * s * 2.2, Math.max(10, 14 * s * 2.2), "#7a2e1d", "rgba(255,248,235,.95)"); }
  }

  hut(g, u, v, w, roof, wall) {
    g.fillStyle = "rgba(60,70,90,.22)"; g.fillRect(u - w / 2 + w * 0.15, v - w * 0.1, w, w * 0.55);
    g.fillStyle = wall; g.fillRect(u - w / 2, v - w * 0.25, w, w * 0.55);
    g.fillStyle = roof; g.beginPath(); g.moveTo(u - w * 0.62, v - w * 0.22); g.lineTo(u, v - w * 0.7); g.lineTo(u + w * 0.62, v - w * 0.22); g.closePath(); g.fill();
  }

  // Draw a view: centre (cx, cz) in metres, `zoom` screen pixels per metre, into canvas `cv` (its own
  // pixel size). Overlays: route [x, z][], you {x, z, heading}, pin [x, z], bounce phase t.
  view(cv, { cx, cz, zoom, route = [], you = null, pin = null, t = 0, dpr = 1 }) {
    this.build();
    const g = cv.getContext("2d"), W = cv.width, H = cv.height, k = zoom * dpr / this.s, T = this.T;
    g.fillStyle = "#e9edf2"; g.fillRect(0, 0, W, H);
    const sx = (cx - T.x0) * this.s - W / 2 / k, sz = (cz - T.z0) * this.s - H / 2 / k;
    g.imageSmoothingEnabled = true;
    g.drawImage(this.base, sx, sz, W / k, H / k, 0, 0, W, H);
    const S = (x, z) => [(x - cx) * zoom * dpr + W / 2, (z - cz) * zoom * dpr + H / 2];
    // Overlays keep to the map's scale (a route as wide as a wide run), within what stays readable.
    const px = (m, lo, hi) => Math.max(lo, Math.min(hi, m * zoom)) * dpr;
    if (route.length > 1) {
      g.lineCap = g.lineJoin = "round";
      g.beginPath(); route.forEach((p, i) => (i ? g.lineTo(...S(...p)) : g.moveTo(...S(...p))));
      const w = px(14, 2.5, 9);
      g.strokeStyle = "rgba(60,40,10,.75)"; g.lineWidth = w + 2.5 * dpr; g.stroke();
      g.strokeStyle = "#f2b632"; g.lineWidth = w; g.stroke();
      const [ex, ez] = route[route.length - 1], [u, v] = S(ex, ez), f = px(60, 10, 18); // the end: a little flag
      g.fillStyle = "#3a3f4a"; g.fillRect(u - 0.06 * f, v - f, 0.12 * f, f);
      g.fillStyle = "#e8453c"; g.beginPath(); g.moveTo(u + 0.06 * f, v - f); g.lineTo(u + 0.75 * f, v - 0.75 * f); g.lineTo(u + 0.06 * f, v - 0.5 * f); g.fill();
    }
    if (pin) {
      const [u, v] = S(...pin);
      g.fillStyle = "#e8453c"; g.strokeStyle = "#fff"; g.lineWidth = 2 * dpr;
      g.beginPath(); g.arc(u, v - 14 * dpr, 8 * dpr, Math.PI, 0); g.lineTo(u, v); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(u, v - 14 * dpr, 3 * dpr, 0, Math.PI * 2); g.fill();
    }
    if (you) this.drawYou(g, ...S(you.x, you.z), you.heading, t, dpr, px(150, 26, 54));
  }

  // You: your rider, a little full-body figure (rendered from the 3D model), hopping on the spot, with a
  // small arrow on the ground the way you're heading. h: the figure's height in canvas pixels.
  drawYou(g, u, v, heading, t, dpr, h = 40 * dpr) {
    const hop = Math.abs(Math.sin(t * 4)) * h * 0.16;
    // Heading: x east, z south (down the screen).
    const ax = Math.sin(heading), ay = Math.cos(heading), r = h * 0.32;
    g.fillStyle = "rgba(40,50,70,.28)"; g.beginPath(); g.ellipse(u, v, r * (1 - hop / h), r * 0.38, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#f2b632"; g.strokeStyle = "#3a2a10"; g.lineWidth = 1.2 * dpr;
    g.beginPath(); g.moveTo(u + ax * r * 1.9, v + ay * r * 0.8); g.lineTo(u + ax * r * 1.1 - ay * r * 0.45, v + ay * r * 0.45 + ax * r * 0.25); g.lineTo(u + ax * r * 1.1 + ay * r * 0.45, v + ay * r * 0.45 - ax * r * 0.25); g.closePath(); g.fill(); g.stroke();
    if (this.avatar) {
      const w = h * (this.avatar.width / this.avatar.height);
      g.drawImage(this.avatar, u - w / 2, v - h - hop + h * 0.04, w, h);
    } else {
      g.font = `${h * 0.7}px sans-serif`; g.textAlign = "center"; g.textBaseline = "bottom"; g.fillText("🏂", u, v - hop);
    }
  }
}
