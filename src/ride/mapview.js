// The trail map, drawn like a cosy game map (think Stardew Valley): warm snow with soft relief, round
// little trees, runs as paths with white edges, lifts dashed with small station huts, lodges as houses,
// names in a friendly hand. It is painted once into one big picture; the roadbook's maps only crop it
// and draw on top: your route in gold, where you are as your rider's portrait,
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

  // Paint the whole map once (lazily: it takes a moment). quiet: no names (the roadbook's ground, which turns).
  build(quiet = false) {
    if (quiet ? this.quietBase : this.base) return;
    const { T, R, mask } = this, W = Math.max(T.x1 - T.x0, T.z1 - T.z0);
    const s = (this.s = Math.min(0.5, 2000 / W)); // pixels per metre
    const cw = Math.round((T.x1 - T.x0) * s), ch = Math.round((T.z1 - T.z0) * s);
    const c = document.createElement("canvas"); c.width = cw; c.height = ch;
    if (quiet) this.quietBase = c; else this.base = c;
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
    if (quiet) return;
    // Names: runs along their middle, lifts and lodges by their huts (the huts say which is which).
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
    for (const l of R.lifts) if (l.kind !== "magic_carpet") { const [u, v] = P(...l.pts[0]); label(l.name, u, v + 16 * s * 2.2, Math.max(9, 12 * s * 2.2), "#ffffff", "rgba(58,63,74,.95)"); }
    for (const b of this.bases) { const [u, v] = P(b.x, b.z); label(b.name, u, v + 24 * s * 2.2, Math.max(10, 14 * s * 2.2), "#7a2e1d", "rgba(255,248,235,.95)"); }
  }

  hut(g, u, v, w, roof, wall) {
    g.fillStyle = "rgba(60,70,90,.22)"; g.fillRect(u - w / 2 + w * 0.15, v - w * 0.1, w, w * 0.55);
    g.fillStyle = wall; g.fillRect(u - w / 2, v - w * 0.25, w, w * 0.55);
    g.fillStyle = roof; g.beginPath(); g.moveTo(u - w * 0.62, v - w * 0.22); g.lineTo(u, v - w * 0.7); g.lineTo(u + w * 0.62, v - w * 0.22); g.closePath(); g.fill();
  }

  // Draw a view: centre (cx, cz) in metres, `zoom` screen pixels per metre, into canvas `cv` (its own
  // pixel size). Overlays: route [x, z][], you {x, z, heading}, pin [x, z], bounce phase t.
  // up: a heading to turn the map to (the way you're going pointing up), as the corner map does; leave it
  // out for north up.
  // skied: stretches you've skied (point lists), drawn in red-brown ink; track: your last ride, dashed.
  view(cv, { cx, cz, zoom, route = [], you = null, pin = null, t = 0, dpr = 1, up = null, skied = null, track = null }) {
    this.build();
    const g = cv.getContext("2d"), k = zoom * dpr / this.s, T = this.T;
    g.fillStyle = "#e9edf2"; g.fillRect(0, 0, cv.width, cv.height);
    g.save();
    // Turned: draw a square big enough to fill the canvas at any angle, rotated about the middle.
    let W = cv.width, H = cv.height;
    if (up != null) {
      const D = Math.ceil(Math.hypot(W, H));
      g.translate(W / 2, H / 2); g.rotate(-Math.PI / 2 - Math.atan2(Math.cos(up), Math.sin(up))); g.translate(-D / 2, -D / 2);
      W = H = D;
    }
    const sx = (cx - T.x0) * this.s - W / 2 / k, sz = (cz - T.z0) * this.s - H / 2 / k;
    g.imageSmoothingEnabled = true;
    // Only the part of the picture that's in view, mapped to where it goes: a source rectangle reaching
    // past the picture's edge is clipped differently by browsers (Safari stretches what's left), which
    // shifted the map under the route.
    const bw = this.base.width, bh = this.base.height;
    const x0 = Math.max(0, sx), z0 = Math.max(0, sz), x1 = Math.min(bw, sx + W / k), z1 = Math.min(bh, sz + H / k);
    if (x1 > x0 && z1 > z0) g.drawImage(this.base, x0, z0, x1 - x0, z1 - z0, (x0 - sx) * k, (z0 - sz) * k, (x1 - x0) * k, (z1 - z0) * k);
    const S = (x, z) => [(x - cx) * zoom * dpr + W / 2, (z - cz) * zoom * dpr + H / 2];
    // Overlays keep to the map's scale (a route as wide as a wide run), within what stays readable.
    const px = (m, lo, hi) => Math.max(lo, Math.min(hi, m * zoom)) * dpr;
    if (skied?.length) {
      g.lineCap = g.lineJoin = "round";
      const w = px(12, 1.5, 9);
      for (const seg of skied) { g.beginPath(); seg.forEach((p, i) => (i ? g.lineTo(...S(...p)) : g.moveTo(...S(...p)))); g.strokeStyle = "rgba(255,250,240,.9)"; g.lineWidth = w + 2.5 * dpr; g.stroke(); g.strokeStyle = "#b5482f"; g.lineWidth = w; g.stroke(); }
    }
    if (track?.length > 1) {
      g.beginPath(); track.forEach((p, i) => (i ? g.lineTo(...S(...p)) : g.moveTo(...S(...p))));
      g.setLineDash([px(14, 4, 10), px(10, 3, 8)]); g.strokeStyle = "#2d3440"; g.lineWidth = px(4, 1.2, 3); g.stroke(); g.setLineDash([]);
    }
    if (route.length > 1) {
      g.lineCap = g.lineJoin = "round";
      g.beginPath(); route.forEach((p, i) => (i ? g.lineTo(...S(...p)) : g.moveTo(...S(...p))));
      const w = px(14, 1, 14); // the outline too keeps to scale
      g.strokeStyle = "rgba(60,40,10,.75)"; g.lineWidth = w * 1.45 + 0.6 * dpr; g.stroke();
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
    g.restore();
    // You stand upright in any case: in the middle, heading up, on a turned map.
    if (you) {
      if (up != null) this.drawYou(g, cv.width / 2, cv.height / 2, Math.PI, t, dpr, px(150, 26, 54));
      else this.drawYou(g, ...S(you.x, you.z), you.heading, t, dpr, px(150, 26, 54));
    }
  }

  // The roadbook's map: only what was ridden (roadbook-core.js mapItems) on the quiet ground faded under a
  // paper wash (Safari has no ctx.filter), turned so the lifts climb up the page. Lifts are straight dashed
  // lines with the legs' numbers at the bottom; real runs in ink with their names, connectors dotted.
  // o: { dpr, lodge (an Image), you: { x, z } }.
  drawBook(cv, items, { dpr = 1, lodge = null, you = null, t = 0 } = {}) {
    this.build(true);
    const g = cv.getContext("2d"), W = cv.width, H = cv.height, T = this.T;
    let dx = 0, dz = 0; for (const l of items.lifts) { dx += l.b[0] - l.a[0]; dz += l.b[1] - l.a[1]; }
    const rot = dx || dz ? -Math.PI / 2 - Math.atan2(dz, dx) : 0, c = Math.cos(rot), sn = Math.sin(rot);
    const turn = (x, z) => [x * c - z * sn, x * sn + z * c];
    const all = [...items.lifts.flatMap((l) => [l.a, l.b]), ...items.lines.flatMap((l) => l.pts), ...items.lodges];
    if (!all.length) all.push([0, 0]);
    const tp = all.map((p) => turn(...p)), us = tp.map((p) => p[0]), vs = tp.map((p) => p[1]);
    const mu = (Math.min(...us) + Math.max(...us)) / 2, mv = (Math.min(...vs) + Math.max(...vs)) / 2;
    const zoom = Math.min(0.6, (W / dpr) / (Math.max(...us) - Math.min(...us) + 420), (H / dpr) / (Math.max(...vs) - Math.min(...vs) + 520)) * dpr;
    const cx = mu * c + mv * sn, cz = -mu * sn + mv * c; // the middle, back in the world
    const S = (x, z) => { const [u, v] = turn(x - cx, z - cz); return [u * zoom + W / 2, v * zoom + H / 2]; };
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#f3efe6"; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H / 2); g.rotate(rot); g.scale(zoom / this.s, zoom / this.s); g.translate(-(cx - T.x0) * this.s, -(cz - T.z0) * this.s);
    g.imageSmoothingEnabled = true; g.drawImage(this.quietBase, 0, 0); g.restore();
    g.fillStyle = "rgba(246,241,231,.68)"; g.fillRect(0, 0, W, H);
    const INK = { easy: "#2e8b4f", intermediate: "#2a5db0", advanced: "#1c1f25", expert: "#1c1f25" };
    const path = (pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...S(...p)) : g.moveTo(...S(...p)))); };
    g.lineCap = g.lineJoin = "round";
    for (const l of items.lines) if (!l.real) { path(l.pts); g.setLineDash([0.1, 5 * dpr]); g.globalAlpha = 0.8; g.strokeStyle = INK[l.level] || INK.intermediate; g.lineWidth = 3 * dpr; g.stroke(); g.globalAlpha = 1; g.setLineDash([]); }
    for (const l of items.lines) if (l.real) { path(l.pts); g.strokeStyle = "rgba(253,251,246,.95)"; g.lineWidth = 7 * dpr; g.stroke(); g.strokeStyle = INK[l.level] || INK.intermediate; g.lineWidth = 3.6 * dpr; g.stroke(); }
    for (const l of items.lifts) {
      const a = S(...l.a), b = S(...l.b);
      g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.strokeStyle = "rgba(253,251,246,.9)"; g.lineWidth = 4.5 * dpr; g.stroke();
      g.setLineDash([6 * dpr, 4 * dpr]); g.strokeStyle = "#22344d"; g.lineWidth = 2 * dpr; g.stroke(); g.setLineDash([]);
      g.fillStyle = "#22344d"; g.beginPath(); g.arc(...b, 3 * dpr, 0, Math.PI * 2); g.fill();
    }
    // names of the real runs, kept clear of each other and of the numbers
    const taken = [], th = 13 * dpr, hit = (x0, y0, x1, y1) => taken.some((b) => x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]);
    for (const l of items.lifts) { const [u, v] = S(...l.a); taken.push([u - 16 * dpr, v - 10 * dpr, u + 16 * dpr, v + 10 * dpr]); }
    g.font = `italic 600 ${11 * dpr}px "Cormorant Garamond", "Noto Serif SC", serif`; g.textBaseline = "middle"; g.textAlign = "left";
    for (const lb of items.labels) {
      const [u, v] = S(...lb.at), w = g.measureText(lb.text).width;
      const spot = [[8, 0], [-w / dpr - 8, 0], [8, -14], [8, 14], [-w / dpr - 8, -14], [-w / dpr - 8, 14], [8, 28]].map(([ox, oy]) => [u + ox * dpr, v + oy * dpr]).find(([x, y]) => !hit(x, y - th / 2, x + w, y + th / 2));
      if (!spot) continue;
      taken.push([spot[0], spot[1] - th / 2, spot[0] + w, spot[1] + th / 2]);
      g.lineWidth = 4 * dpr; g.strokeStyle = "rgba(251,247,238,.95)"; g.strokeText(lb.text, ...spot); g.fillStyle = "#22344d"; g.fillText(lb.text, ...spot);
    }
    for (const l of items.lifts) {
      const [u, v] = S(...l.a), txt = l.nos.join("·"), r = 9 * dpr, w = Math.max(2 * r, (txt.length * 6 + 8) * dpr);
      g.fillStyle = "#22344d"; g.strokeStyle = "#fdfbf6"; g.lineWidth = 2 * dpr;
      g.beginPath(); g.roundRect ? g.roundRect(u - w / 2, v - r, w, 2 * r, r) : g.rect(u - w / 2, v - r, w, 2 * r); g.fill(); g.stroke();
      g.fillStyle = "#fdfbf6"; g.font = `500 ${11 * dpr}px Oswald, sans-serif`; g.textAlign = "center"; g.fillText(txt, u, v + 0.5 * dpr);
    }
    if (lodge?.complete && lodge.naturalWidth) for (const p of items.lodges) { const [u, v] = S(...p); g.drawImage(lodge, u - 40 * dpr, v - 24 * dpr, 26 * dpr, 26 * dpr); }
    if (you) { const [u, v] = S(you.x, you.z); if (u > 0 && v > 0 && u < W && v < H) this.drawYou(g, u, v, (you.heading || 0) - rot, t, dpr, 40 * dpr); }
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
      g.fillStyle = "#22344d"; g.strokeStyle = "#fdfbf6"; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(u, v - h * 0.3 - hop, h * 0.18, 0, Math.PI * 2); g.fill(); g.stroke(); // no figure yet: a dot
    }
  }
}
