// Signs on the mountain: run signs with the difficulty mark, junction posts with arrows, lift signs,
// the trail map board, slow and closed ropes.
import { box, tube, at, group, plate } from "./kit.js";

// How wide a line of text is, in metres, at a letter height of h metres.
const meter = document.createElement("canvas").getContext("2d");
function textW(t, h, weight = 600) { meter.font = `${weight} 100px Georgia, serif`; return meter.measureText(t).width / 100 * h; }

const INK = "#22344d", CREAM = "#f3ead8";
const MARK = { green: "#2f8a4e", blue: "#2d5fb3", black: "#1d1f22", double: "#1d1f22", park: "#e27a2b" };

// The difficulty mark drawn at (cx, cy), size s.
function mark(x, kind, cx, cy, s) {
  x.fillStyle = MARK[kind];
  x.save(); x.translate(cx, cy);
  if (kind === "green") { x.beginPath(); x.arc(0, 0, s / 2, 0, Math.PI * 2); x.fill(); }
  else if (kind === "blue") x.fillRect(-s / 2, -s / 2, s, s);
  else if (kind === "park") { x.beginPath(); x.roundRect(-s * 0.7, -s * 0.4, s * 1.4, s * 0.8, s * 0.15); x.fill(); }
  else for (const dx of kind === "double" ? [-s * 0.42, s * 0.42] : [0]) { x.beginPath(); x.moveTo(dx, -s / 2); x.lineTo(dx + s * 0.4, 0); x.lineTo(dx, s / 2); x.lineTo(dx - s * 0.4, 0); x.closePath(); x.fill(); }
  x.restore();
}

// A run sign: a cream board with the mark and the run's name, on a timber post.
export function runSign(name, kind = "blue", { arrow = 0 } = {}) {
  const w = 0.62 + textW(name, 0.2) + (arrow ? 0.2 : 0), g = group(at(box(0.14, 2.6, 0.14, "timber"), 0, 1.3, 0));
  g.add(at(arrowBoard(name, kind, w, arrow), arrow * (w / 2 - 0.1), 2.2, 0.09));
  g.add(at(box(0.22, 0.08, 0.22, "snow", undefined, 0.03), 0, 2.64, 0));
  return g;
}

// A board, pointed at one end when it shows a way (arrow -1 left, 1 right).
function arrowBoard(name, kind, w, arrow) {
  return plate(w, 0.42, (x, cw, ch) => {
    x.fillStyle = CREAM; x.fillRect(0, 0, cw, ch);
    x.strokeStyle = INK; x.lineWidth = 5; x.strokeRect(6, 6, cw - 12, ch - 12);
    const p = ch * 0.55, left = arrow < 0 ? ch * 0.5 : 0;
    mark(x, kind, left + ch * 0.5, ch / 2, p);
    x.fillStyle = INK; x.font = `600 ${ch * 0.48}px Georgia, serif`; x.textBaseline = "middle"; x.fillText(name, left + ch * 0.95, ch * 0.54);
    if (arrow) { x.fillStyle = INK; const ax = arrow > 0 ? cw - ch * 0.35 : ch * 0.35; x.beginPath(); x.moveTo(ax + arrow * ch * 0.2, ch / 2); x.lineTo(ax - arrow * ch * 0.12, ch * 0.25); x.lineTo(ax - arrow * ch * 0.12, ch * 0.75); x.fill(); }
  });
}

// A junction post: one board per way, stacked, each turned to point down its run.
export function junction(ways) {
  const g = group(at(box(0.16, 3.2, 0.16, "timber"), 0, 1.6, 0), at(box(0.24, 0.08, 0.24, "snow", undefined, 0.03), 0, 3.24, 0));
  ways.forEach(([name, kind, turn], i) => {
    const w = 0.82 + textW(name, 0.2), b = arrowBoard(name, kind, w, 1);
    b.position.x = w / 2 - 0.05; const h = group(b); h.position.y = 2.85 - i * 0.5; h.rotation.y = turn; g.add(h);
  });
  return g;
}

// A sign on two posts with a short message (lift signs, SLOW, ski patrol).
export function notice(text, { bg = CREAM, fg = INK, w = 0, h = 0.8, sub = "" } = {}) {
  w = Math.max(w, 0.5 + textW(text, h * (sub ? 0.36 : 0.5), 700), sub ? 0.4 + textW(sub, h * 0.2, 400) : 0);
  const g = group();
  for (const s of [-1, 1]) g.add(at(box(0.1, 1.8 + h, 0.1, "steel"), s * (w / 2 - 0.15), (1.8 + h) / 2, 0));
  g.add(at(plate(w, h, (x, cw, ch) => {
    x.fillStyle = bg; x.fillRect(0, 0, cw, ch); x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(8, 8, cw - 16, ch - 16);
    x.fillStyle = fg; x.textAlign = "center"; x.textBaseline = "middle";
    x.font = `700 ${ch * (sub ? 0.36 : 0.5)}px Georgia, serif`; x.fillText(text, cw / 2, ch * (sub ? 0.38 : 0.53));
    if (sub) { x.font = `${ch * 0.2}px Georgia, serif`; x.fillText(sub, cw / 2, ch * 0.74); }
  }), 0, 1.8 + h / 2 - 0.1, 0.06));
  return g;
}

// The trail map board under a little roof.
export function mapBoard(draw) {
  const g = group();
  for (const s of [-1, 1]) g.add(at(box(0.18, 3.4, 0.18, "timber"), s * 1.7, 1.7, 0));
  g.add(at(plate(3.2, 2.0, draw), 0, 2.1, 0.05, -0.05));
  g.add(at(box(4, 0.15, 0.9, "roof"), 0, 3.5, 0, 0.12));
  g.add(at(box(3.9, 0.15, 0.85, "snow", undefined, 0.05), 0, 3.62, 0, 0.12));
  return g;
}

// A rope line on bamboo poles with flags, closed or slow.
export function ropeLine(len, { closed = true } = {}) {
  const g = group(), n = Math.round(len / 3);
  for (let i = 0; i <= n; i++) g.add(at(box(0.05, 1.3, 0.05, "wood", 0xd8b56a), i * len / n, 0.65, 0));
  g.add(tube([0, 1.15, 0], [len, 1.15, 0], 0.012, "orange"));
  for (let i = 0; i < n; i++) g.add(at(box(0.18, 0.22, 0.005, "orange"), (i + 0.5) * len / n, 1.02, 0, 0, 0, Math.PI / 4));
  if (closed) g.add(at(plate(1.0, 0.45, (x, cw, ch) => { x.fillStyle = "#b6463b"; x.fillRect(0, 0, cw, ch); x.fillStyle = CREAM; x.font = `700 ${ch * 0.42}px Georgia, serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("CLOSED", cw / 2, ch / 2); }), len / 2, 0.82, 0.02));
  return g;
}
