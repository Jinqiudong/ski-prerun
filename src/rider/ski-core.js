// A skier's pose as numbers (no three.js; tested: tests/ski.test.mjs). The ride's physics (board.js Rider with
// { ski }) says how far the skis are on edge, how tucked, ploughing, hockey-stopping or skating; this blends the
// skier's clips by it (the character AI's Ski_* clips, docs/SKI_RIDERS.md), times the pole plants at the edge
// changes, and, until those clips arrive, gives the stand-in pose (skier.js poses the skeleton itself) the same
// blend as numbers. Signs: edge > 0 is a right turn (board.js lean > 0); x is the skier's left, z ahead.

const clamp01 = (v) => Math.max(0, Math.min(1, v || 0));

// The clips by what the ride calls them (the character AI's, docs/SKI_RIDERS.md). Held at their peak and blended,
// except the ones played through: the pole plants, the hockey stop, the push on the flat (its `skate` here: a
// double-pole push, Ski_Push), the fall, the jump, the wave.
export const SKI_CLIPS = {
  stand: "Ski_Stand", sit: "Ski_Chair_Sit", glide: "Ski_Glide", turnL: "Ski_Turn_L", turnR: "Ski_Turn_R",
  poleL: "Ski_Pole_Plant_L", poleR: "Ski_Pole_Plant_R", tuck: "Ski_Tuck", plough: "Ski_Snowplough",
  hockey: "Ski_Hockey_Stop", skate: "Ski_Push", wave: "Ski_Wave", jump: "Ski_Jump",
  fallL: "Ski_Fall_L", fallR: "Ski_Fall_R", upL: "Ski_GetUp_L", upR: "Ski_GetUp_R", // a fall to one side, and up from it
};
export const SKI_PLAYED = ["poleL", "poleR", "hockey", "skate", "fallL", "fallR", "upL", "upR", "wave", "jump"];
// Which side a skier falls to: into the turn they were in (edge > 0, a right turn: to the right), else the left.
export const fallSide = (edge) => (edge > 0.05 ? "R" : "L");
// The turn clips carry their own inclination (32°, 0.56 rad); the ride leans the skier only past what they show
// (board.js lean is the whole balance angle). An edge in radians → the extra lean on top of the clip.
export const CLIP_LEAN = 0.4;
export const extraLean = (edge) => Math.sign(edge) * Math.max(0, Math.abs(edge) - CLIP_LEAN);

// The blend, summing to 1: a hockey stop over everything, then the plough, the skate on the flat, the turn (by
// how far on edge, full at 0.5 rad of inclination; to its side), and what's left a glide, tucked by `tuck`.
export function skiWeights({ edge = 0, tuck = 0, plough = 0, hockey = 0, skate = 0 } = {}) {
  const hk = clamp01(hockey), pl = clamp01(plough) * (1 - hk), sk = clamp01(skate) * (1 - hk - pl);
  const rest = Math.max(0, 1 - hk - pl - sk), turn = clamp01(Math.abs(edge) / 0.5) * rest, still = rest - turn, tk = clamp01(tuck) * still;
  return { hockey: hk, plough: pl, skate: sk, turnL: edge < 0 ? turn : 0, turnR: edge > 0 ? turn : 0, tuck: tk, glide: still - tk };
}

// Pole plants: at each edge change at speed, the pole on the side of the turn coming is planted (a right turn:
// the right pole), as the skis cross flat; it takes PLANT.dur seconds. plantStep(p, edge, speed, dt) each frame
// returns { side: "L" | "R" | null, k: 0..1 through the plant }.
export const PLANT = { dur: 0.5, min: 0.15, speed: 2.5 };
export const newPlant = () => ({ from: 0, side: null, t: 0 });
export function plantStep(p, edge, speed, dt) {
  if (p.side && (p.t += dt) >= PLANT.dur) p.side = null;
  const s = Math.sign(edge);
  if (p.from && s === -p.from && Math.abs(edge) > 0.03) { // across: into the next one
    if (speed > PLANT.speed && !p.side) { p.side = s > 0 ? "R" : "L"; p.t = 0; }
    p.from = 0;
  } else if (Math.abs(edge) >= PLANT.min && !p.side) p.from = s; // in a turn
  return { side: p.side, k: p.side ? Math.min(1, p.t / PLANT.dur) : 0 };
}

// The stand-in pose (until the Ski_* clips arrive): each clip as a few numbers that skier.js turns into the
// skeleton's pose. In the model's frame, metres and radians: drop (hips lowered), back (hips moved back), fwd
// (the upper body bent forward), width (half the gap between the ankles), toe (each ski's tip turned in: + a
// plough's wedge, − a skate's V), lead (the left foot ahead of the right), counter (the chest turned left), ankUp
// (the feet pulled up under you, in the air), hand ([out, up from the hips' rest height, ahead]), tip (each pole's
// tip: [out, ahead of the feet, up off the snow]), arm (the hands raised out to the sides, 0..1).
export const STANDIN = {
  stand: { drop: 0.03, back: 0, fwd: 0.06, width: 0.12, hand: [0.27, -0.06, 0.16], tip: [0.42, 0.12, 0] },
  glide: { drop: 0.1, back: 0.04, fwd: 0.24, width: 0.11, hand: [0.3, 0, 0.3], tip: [0.42, -0.5, 0.05] },
  turnL: { drop: 0.14, back: 0.04, fwd: 0.22, width: 0.12, lead: 0.07, counter: -0.18, hand: [0.32, 0.02, 0.3], tip: [0.45, -0.45, 0.05] },
  turnR: { drop: 0.14, back: 0.04, fwd: 0.22, width: 0.12, lead: -0.07, counter: 0.18, hand: [0.32, 0.02, 0.3], tip: [0.45, -0.45, 0.05] },
  tuck: { drop: 0.34, back: 0.12, fwd: 0.95, width: 0.12, hand: [0.13, -0.32, 0.4], tip: [0.32, -0.9, 0.55] },
  plough: { drop: 0.1, back: 0.02, fwd: 0.2, width: 0.26, toe: 0.22, hand: [0.33, 0.02, 0.26], tip: [0.55, -0.4, 0.08] },
  hockey: { drop: 0.2, back: 0, fwd: 0.16, width: 0.13, hand: [0.36, 0.08, 0.3], tip: [0.55, -0.25, 0.1] },
  skate: { drop: 0.09, back: 0.02, fwd: 0.4, width: 0.2, toe: -0.3, hand: [0.27, 0.12, 0.4], tip: [0.32, -0.25, 0] },
  // in the air (tricks): a straight jump, knees up; a spread eagle, arms and skis out wide
  hop: { drop: 0.2, back: 0.06, fwd: 0.35, width: 0.11, ankUp: 0.2, hand: [0.3, 0.05, 0.35], tip: [0.42, -0.6, 0.3] },
  spread: { drop: 0.02, back: 0, fwd: 0.05, width: 0.4, toe: -0.45, arm: 1, hand: [0.62, 0.55, 0.05], tip: [0.95, -0.2, 0.9] },
};
const KEYS = ["drop", "back", "fwd", "width", "toe", "lead", "counter", "ankUp", "arm"];
// The stand-in's numbers for a blend (weights by STANDIN key, any sum: normalised; none is the glide).
export function standinParams(w) {
  const out = Object.fromEntries(KEYS.map((k) => [k, 0])); out.hand = [0, 0, 0]; out.tip = [0, 0, 0];
  let sum = 0;
  for (const [k, v] of Object.entries(w || {})) if (STANDIN[k] && v > 0) sum += v;
  const list = sum > 1e-6 ? Object.entries(w).filter(([k, v]) => STANDIN[k] && v > 0) : [["glide", 1]], tot = sum > 1e-6 ? sum : 1;
  for (const [k, v] of list) {
    const P = STANDIN[k], f = v / tot;
    for (const x of KEYS) out[x] += (P[x] || 0) * f;
    for (let i = 0; i < 3; i++) { out.hand[i] += P.hand[i] * f; out.tip[i] += P.tip[i] * f; }
  }
  return out;
}

// The skier's small set of tricks (grabs and presses are a board's): a straight jump (the clip Ski_Jump, which
// lifts the skis itself) and, on the stand-in only, a spread eagle. key: the stand-in pose at the top (STANDIN);
// clip: the SKI_CLIPS key played through with the real files (none: stand-in only); air: height (m), dur: seconds.
export const SKI_TRICKS = [
  { key: "hop", name: "直跳", air: 0.9, dur: 0.8, clip: "jump" },
  { key: "spread", name: "大字跳", air: 1.3, dur: 1.1, clip: null },
];
// The ones a skier can do: with the real clips, those that have one; the stand-in, all.
export const skiTricks = (real, has = () => true) => SKI_TRICKS.filter((t) => (real ? t.clip && has(t.clip) : true));

// A look's sport: "ski" only for a person (the animals ride boards), else "board".
export const sportOf = (ch) => (ch && ch.sport === "ski" && !ch.animal ? "ski" : "board");
