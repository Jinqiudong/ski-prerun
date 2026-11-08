// Draws the icons the owner hasn't painted yet, in the house style of assets/icons (navy hand-drawn ink line,
// soft watercolour fills in sage / cream / dusty pink / slate, a small white highlight), as 128×128 PNGs with
// transparent backgrounds. Each icon is a list of parts in a 128-unit box; the page jitters every outline a little
// so it reads hand-drawn, washes the fills with a faint paper texture, pools a darker tone at the edges, and
// renders at 4× before scaling down. Also writes a review sheet next to some of the owner's icons.
// usage: node tools/draw_icons.mjs [--sheet] [name ...]  (--sheet: the review sheet of just the named icons)   (needs puppeteer-core: npm i --no-save puppeteer-core, and Chrome)
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const OUT = join(ROOT, "assets/icons");
const SHEET = join(ROOT, "docs/art/icons/new_icons_review.png");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// ---- palette (sampled from the owner's icons) ----
const INK = "#23304a";
const C = {
  sage: "#a9ae8f", cream: "#f4ead0", pink: "#e6b4bb", slate: "#6e747e", dslate: "#4f5767", grey: "#a3a8b0",
  blue: "#93abc9", ice: "#e3ebf3", white: "#faf7f0", tan: "#cda37a", orange: "#d89b63", red: "#c0675c",
  screen: "#cdd6c3", gold: "#e3cf96",
};

// ---- shape helpers (absolute SVG path strings, one subpath each) ----
const rr = (x, y, w, h, r) => {
  r = Math.min(r, w / 2, h / 2);
  return `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
    ` H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;
};
const circ = (cx, cy, r) => `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
const ell = (cx, cy, rx, ry) => `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
const poly = (...p) => "M" + p.map(([x, y]) => `${x} ${y}`).join(" L") + " Z";
const line = (...p) => "M" + p.map(([x, y]) => `${x} ${y}`).join(" L");
// a capsule from (x1,y1) to (x2,y2) of width w, as a rounded rect plus transform
const capsule = (x1, y1, x2, y2, w) => {
  const len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI - 90;
  return { d: rr(-w / 2, -w / 2, w, len + w, w / 2), transform: `translate(${x1} ${y1}) rotate(${ang})` };
};
// a small 6-arm snowflake as ink lines
const flake = (x, y, r) => [0, 60, 120].map((a) => {
  const t = a * Math.PI / 180, dx = Math.cos(t) * r, dy = Math.sin(t) * r;
  return { d: line([x - dx, y - dy], [x + dx, y + dy]), sw: 2.8 };
});

// part: { d, fill?, sw? (ink width, 0 = none), hl?: [d] white highlights, shade?: colour pooled at edges,
//         transform?, dash?, jit? (wobble), detail?: [parts drawn clipped inside], under?: true (stroke-only pass) }
// U(...) = a union: all outlines first, then all fills, so touching parts read as one silhouette.
const U = (...parts) => ({ union: parts });

const ICONS = {
  look_mirror: () => [
    { ...capsule(60, 86, 60, 112, 18), fill: C.tan, hl: ["M-4 8 V22"] },
    { d: rr(50, 80, 20, 12, 5), fill: C.tan, sw: 4.5 },
    { d: ell(60, 46, 38, 42), fill: C.pink, hl: ["M30 30 Q36 14 50 9"] },
    { d: ell(60, 46, 27, 31), fill: C.ice, shade: C.blue, sw: 4.5,
      detail: [{ d: line([42, 58], [64, 22]), sw: 7, ink: C.white, op: 0.95 }, { d: line([52, 68], [74, 32]), sw: 3.5, ink: C.white, op: 0.9 }] },
    { d: "M108 64 Q110 74 120 76 Q110 78 108 88 Q106 78 96 76 Q106 74 108 64 Z", fill: C.gold, sw: 3.5 },
  ],

  voice_mic: () => mic(false),
  voice_mic_off: () => mic(true),

  voice_radio: () => [
    { d: rr(46, 4, 11, 36, 5), fill: C.dslate, hl: ["M50 10 V24"] },
    { d: rr(70, 20, 13, 16, 4), fill: C.dslate },
    { d: rr(27, 60, 10, 30, 4), fill: C.dslate },
    { d: rr(33, 42, 62, 82, 10), fill: C.slate, shade: C.dslate, hl: ["M40 62 V84"],
      detail: [
        ...[60, 68, 76].map((y) => ({ d: line([50, y], [86, y]), sw: 3.2 })),
        { d: rr(46, 86, 36, 17, 4), fill: C.screen, sw: 3.2 },
        { d: line([54, 98], [54, 94]), sw: 3 }, { d: line([60, 98], [60, 91]), sw: 3 },
        ...[50, 64, 78].map((x) => ({ d: rr(x - 4, 109, 9, 5, 2.5), fill: C.dslate, sw: 2.6 })),
      ] },
    { d: "M33 54 V42 Q33 30 45 30 H83 Q95 30 95 42 V54 Z", fill: C.orange, hl: ["M42 37 H66"] },
  ],

  voice_speaking: () => [
    U({ d: rr(6, 22, 78, 62, 26), fill: C.cream, hl: ["M18 44 Q20 32 34 29"] },
      { d: poly([20, 70], [12, 104], [44, 80]), fill: C.cream }),
    { d: line([30, 46], [30, 60]), sw: 5.5 }, { d: line([45, 40], [45, 66]), sw: 5.5 }, { d: line([60, 47], [60, 59]), sw: 5.5 },
    { d: "M94 38 Q102 53 94 68", sw: 5.5 },
    { d: "M105 26 Q120 53 105 80", sw: 5.5 },
  ],

  msg_chat: () => [
    U({ d: rr(48, 10, 74, 54, 22), fill: C.pink, hl: ["M60 28 Q62 20 72 18"] },
      { d: poly([100, 52], [118, 78], [86, 60]), fill: C.pink }),
    U({ d: rr(6, 38, 88, 66, 26), fill: C.cream, hl: ["M18 60 Q20 48 34 45"] },
      { d: poly([22, 90], [12, 122], [48, 98]), fill: C.cream }),
    { d: circ(31, 71, 5.5), fill: INK, sw: 0 }, { d: circ(50, 71, 5.5), fill: INK, sw: 0 }, { d: circ(69, 71, 5.5), fill: INK, sw: 0 },
  ],

  msg_wait: () => [
    U({ ...capsule(38, 86, 17, 58, 15), fill: C.cream },
      { ...capsule(43, 26, 43, 62, 15), fill: C.cream },
      { ...capsule(57, 18, 57, 62, 15), fill: C.cream },
      { ...capsule(71, 22, 71, 62, 15), fill: C.cream },
      { ...capsule(84, 34, 84, 66, 14), fill: C.cream },
      { d: rr(34, 52, 58, 52, 18), fill: C.cream, hl: ["M42 64 Q42 58 48 56"] }),
    { d: line([50, 32], [50, 60]), sw: 3 }, { d: line([64, 26], [64, 60]), sw: 3 }, { d: line([78, 34], [78, 62]), sw: 3 },
    { d: rr(38, 98, 50, 24, 7), fill: C.grey, shade: C.slate },
    { d: "M100 14 Q110 20 112 32", sw: 4.5 }, { d: "M108 6 Q122 14 124 30", sw: 4.5 },
  ],

  msg_meet: () => [
    { d: line([2, 4], [48, 54]), sw: 4 },
    { d: line([22, 25], [22, 34]), sw: 4 },
    { d: rr(7, 33, 30, 25, 8), fill: C.gold, hl: ["M12 40 V44"], detail: [{ d: rr(11, 39, 22, 9, 2.5), fill: C.ice, sw: 3.2 }] },
    { d: rr(10, 80, 66, 42, 4), fill: C.cream, hl: ["M16 88 V100"],
      detail: [{ d: rr(30, 94, 26, 30, 3), fill: C.dslate, sw: 3.5 }] },
    { d: poly([4, 82], [18, 62], [68, 62], [82, 82]), fill: C.blue, shade: "#6f86a6", hl: ["M22 68 H46"] },
    { d: ell(46, 58, 16, 5.5), fill: C.slate, sw: 4.5 },
    { d: "M94 78 C82 62 72 52 72 36 A22 22 0 1 1 116 36 C116 52 106 62 94 78 Z", fill: C.red, shade: "#9b4c46",
      hl: ["M80 28 Q84 18 92 16"], detail: [{ d: circ(94, 35, 8), fill: C.white, sw: 4 }] },
  ],

  msg_good: () => [
    { d: rr(10, 58, 24, 56, 6), fill: C.sage, hl: ["M16 66 V80"] },
    U({ ...capsule(50, 66, 58, 34, 26), fill: C.cream },
      { d: rr(30, 56, 64, 58, 16), fill: C.cream, hl: ["M40 66 Q40 62 44 61"] }),
    { d: line([62, 75], [92, 75]), sw: 3.2 }, { d: line([62, 88], [92, 88]), sw: 3.2 }, { d: line([62, 101], [90, 101]), sw: 3.2 },
    ...flake(100, 22, 8), ...flake(116, 50, 6), ...flake(22, 30, 5.5), { d: circ(88, 44, 2.6), fill: INK, sw: 0 },
    { d: circ(30, 46, 2.4), fill: INK, sw: 0 },
  ],

  msg_down: () => [
    { d: "M4 60 Q6 52 18 52 Q30 52 38 62 Q54 82 66 104 Q74 116 92 118 Q102 120 100 124 H12 Q4 124 4 114 Z",
      fill: C.white, shade: C.blue, sw: 5, hl: ["M10 62 Q16 58 26 59"] },
    { d: line([12, 16], [32, 16]), sw: 4 }, { d: line([6, 28], [22, 28]), sw: 4 }, { d: line([16, 40], [28, 40]), sw: 4 },
    { ...capsule(42, 54, 74, 102, 12), fill: C.blue, hl: ["M-2 12 V34"] },
    U({ ...capsule(57, 67, 74, 56, 14), fill: C.tan }, { ...capsule(68, 83, 77, 58, 14), fill: C.tan },
      { ...capsule(76, 56, 84, 38, 28), fill: C.sage, hl: ["M-8 2 V12"] },
      { ...capsule(80, 40, 60, 48, 11), fill: C.sage }, { ...capsule(90, 40, 112, 48, 11), fill: C.sage }),
    { d: circ(88, 21, 16), fill: C.dslate, hl: ["M78 16 Q80 9 87 8"] },
    { d: rr(86, 16, 22, 11, 5.5), fill: C.pink, sw: 3.8 },
  ],

  msg_coming: () => [
    { d: "M6 116 C16 96 34 122 46 98", sw: 4, dash: "7 8" },
    { d: poly([120, 12], [52, 74], [64, 110]), fill: C.blue, shade: "#6f86a6" },
    { d: poly([120, 12], [6, 56], [52, 74]), fill: C.white, shade: C.blue, hl: ["M24 56 L70 40"] },
    { d: poly([52, 74], [58, 90], [64, 110]), fill: "#7d93b3", sw: 4.5 },
  ],

  // Moguls (蘑菇, "mushrooms" in Chinese ski slang): round snow bumps stepping down a slope, each a soft cap
  // over a blue shadow in its trough, the nearest with a few pale spots; a tiny mushroom peeks out beside them.
  moguls: () => [
    { d: "M4 112 Q4 104 16 100 Q48 88 78 78 Q104 70 116 56 Q124 50 124 62 V114 Q124 122 116 122 H12 Q4 122 4 112 Z", fill: C.white, shade: C.blue, sw: 5, hl: ["M14 106 Q30 98 44 94"] },
    ...[[99, 66, 16, 15], [68, 85, 20, 18], [33, 106, 26, 22]].flatMap(([cx, y, w, h], k) => [
      { d: ell(cx + 3, y + 3, w * 0.85, 4), fill: C.blue, sw: 0 },
      { d: `M${cx - w} ${y} Q${cx - w} ${y - h * 1.3} ${cx} ${y - h * 1.25} Q${cx + w} ${y - h * 1.3} ${cx + w} ${y} Q${cx} ${y + 5} ${cx - w} ${y} Z`,
        fill: C.ice, shade: C.blue, sw: 4.5, hl: [`M${cx - w * 0.62} ${y - h * 0.5} Q${cx - w * 0.5} ${y - h * 0.95} ${cx - w * 0.12} ${y - h * 1.02}`],
        detail: k === 2 ? [[cx + 7, y - 15, 3.4], [cx + 16, y - 7, 2.6], [cx - 3, y - 6, 2.2]].map(([x, yy, r]) => ({ d: circ(x, yy, r), fill: C.pink, sw: 0 })) : [] },
    ]),
    { d: rr(102, 96, 9, 17, 4), fill: C.cream, sw: 3.6 },
    { d: "M91 99 Q91 81 106.5 81 Q122 81 122 99 Q106.5 103 91 99 Z", fill: C.red, shade: "#9b4c46", sw: 3.8,
      detail: [[100, 90, 2.6], [112, 88, 2.2], [107, 96, 1.8]].map(([x, y, r]) => ({ d: circ(x, y, r), fill: C.white, sw: 0 })) },
    ...flake(20, 24, 7), ...flake(52, 16, 5), { d: circ(38, 40, 2.4), fill: INK, sw: 0 },
  ],
  // The bunny hill (宝宝坡, the practice): a gentle slope with an S of turns traced down it between two training
  // cones, a little flag at the top.
  practice: () => [
    { d: "M4 110 Q4 100 18 96 Q60 84 92 70 Q112 61 120 58 Q125 57 125 64 V114 Q125 122 117 122 H12 Q4 122 4 114 Z", fill: C.white, shade: C.blue, sw: 5, hl: ["M14 104 Q34 96 52 92"] },
    { d: "M98 70 C80 76 70 82 80 90 C92 98 70 106 46 108 C30 110 24 114 26 118", sw: 3.6, dash: "6 6.5", ink: C.dslate },
    ...[[62, 92, 11, 18], [100, 98, 10, 16]].flatMap(([x, y, w, h]) => [
      { d: ell(x, y + 1, w + 3, 3.2), fill: C.blue, sw: 0 },
      { d: `M${x - w} ${y} L${x - 2.4} ${y - h} Q${x} ${y - h - 2.5} ${x + 2.4} ${y - h} L${x + w} ${y} Q${x} ${y + 3} ${x - w} ${y} Z`, fill: C.orange, shade: "#a86a3c", sw: 4,
        detail: [{ d: line([x - w * 0.55, y - h * 0.42], [x + w * 0.55, y - h * 0.42]), sw: 4.2, ink: C.white, op: 0.95 }] },
    ]),
    { d: line([106, 64], [106, 26]), sw: 4.5 },
    { d: "M106 26 Q118 24 124 32 Q116 36 106 40 Z", fill: C.pink, shade: "#b77d86", sw: 3.8 },
    ...flake(22, 26, 7), ...flake(54, 16, 5), { d: circ(38, 44, 2.4), fill: INK, sw: 0 }, { d: circ(80, 34, 2.2), fill: INK, sw: 0 },
  ],
};

// The trick wheel: the button (a board in the air with a sparkle) and one per trick. Grabs are the board from
// above with a mitten on the edge it holds; presses are the board from the side, one end in the snow.
ICONS.trick = () => [
  ...board(64, 58, -14),
  { d: "M98 6 Q101 20 114 22 Q101 24 98 38 Q95 24 82 22 Q95 20 98 6 Z", fill: C.gold, sw: 3.8 },
  { d: "M22 18 Q24 26 31 27 Q24 28 22 36 Q20 28 13 27 Q20 26 22 18 Z", fill: C.gold, sw: 3.2 },
  { d: "M26 98 Q46 112 70 104", sw: 4.5 }, { d: "M40 114 Q60 124 84 116", sw: 4.5 },
];
ICONS.trick_ollie = () => [
  snowLine(),
  { d: "M6 96 Q16 66 34 58", sw: 4, dash: "7 8" },
  ...board(72, 50, -12),
  { d: line([52, 76], [52, 90]), sw: 4.5 }, { d: line([72, 74], [72, 94]), sw: 4.5 }, { d: line([92, 70], [92, 84]), sw: 4.5 },
];
ICONS.trick_spin = () => [
  { d: "M8 72 A56 38 0 0 1 116 50", sw: 5.5 },
  ...board(64, 64, 0),
  { d: "M120 74 A56 38 0 0 1 36 104", sw: 5.5 },
  { d: poly([20, 102], [40, 92], [38, 114]), fill: INK, sw: 3 },
];
ICONS.trick_indy = () => grab(64, 74, 0);
ICONS.trick_melon = () => grab(64, 54, 180);
ICONS.trick_tailgrab = () => grab(26, 74, 35);
ICONS.trick_nose = () => press(1);
ICONS.trick_tailpress = () => press(-1);

// The guide's way-finding signs (the fox's bubble on the way down): fat gold arrows with an ink line, like a
// painted trail sign; the wrong way back is dusty pink. And the HUD's speed: a little dial.
const ARROW = { fill: "#e8c26e", shade: "#a8823a" }; // a deeper gold than C.gold: it has to read on the paper bubble
const turn = (m) => { // a left turn; m mirrors it into a right one
  const X = (x) => (m ? 128 - x : x);
  return [U(
    { ...capsule(X(84), 118, X(84), 52, 28), ...ARROW, hl: ["M-6 10 V40"] },
    { ...capsule(X(84), 50, X(48), 50, 28), ...ARROW },
    { d: poly([X(54), 18], [X(8), 50], [X(54), 82]), ...ARROW, hl: [m ? "M98 32 L110 44" : "M30 32 L18 44"] }),
  ];
};
ICONS.nav_left = () => turn(false);
ICONS.nav_right = () => turn(true);
ICONS.nav_straight = () => [U(
  { ...capsule(64, 120, 64, 52, 30), ...ARROW, hl: ["M-7 8 V40"] },
  { d: poly([24, 58], [64, 8], [104, 58]), ...ARROW, hl: ["M44 44 L58 26"] }),
];
// 就是这里: an arrow down into a spot on the snow
ICONS.nav_here = () => [
  { d: ell(64, 110, 50, 12), fill: C.white, shade: C.blue, sw: 4.5, hl: ["M26 108 Q36 101 52 100"] },
  { d: ell(64, 109, 18, 4.5), fill: C.blue, sw: 0 },
  U({ ...capsule(64, 8, 64, 60, 28), ...ARROW, hl: ["M-6 8 V30"] },
    { d: poly([28, 56], [64, 100], [100, 56]), ...ARROW }),
];
// 走错了: a U-turn, back the way you came
ICONS.nav_back = () => {
  const P = { fill: C.pink, shade: "#b77d86" };
  return [U(
    { ...capsule(90, 120, 90, 54, 26), ...P, hl: ["M-5 10 V40"] },
    { d: "M103 54 A39 39 0 0 0 25 54 L51 54 A13 13 0 0 1 77 54 Z", ...P, hl: ["M34 44 Q40 26 58 20"] },
    { ...capsule(38, 54, 38, 70, 26), ...P },
    { d: poly([8, 66], [38, 108], [68, 66]), ...P }),
  ];
};
// the HUD's speed: a dial, green to red, the needle well over
ICONS.hud_speed = () => [
  { d: "M10 96 A54 54 0 0 1 118 96 Q118 104 110 104 H18 Q10 104 10 96 Z", fill: C.cream, hl: ["M22 78 Q30 58 48 50"] },
  { d: "M24 92 A40 40 0 0 1 40 60", sw: 9, ink: C.sage, jit: 0.3 },
  { d: "M46 56 A40 40 0 0 1 84 56", sw: 9, ink: C.gold, jit: 0.3 },
  { d: "M90 60 A40 40 0 0 1 104 92", sw: 9, ink: C.red, jit: 0.3 },
  { ...capsule(64, 92, 94, 58, 9), fill: C.dslate, sw: 3.5 },
  { d: circ(64, 92, 10), fill: C.dslate, sw: 4, hl: ["M59 89 Q60 86 63 85"] },
  { d: line([2, 120], [26, 120]), sw: 4 }, { d: line([40, 120], [88, 120]), sw: 4 }, { d: line([102, 120], [120, 120]), sw: 4 },
];
// The road's conditions (the ride's road sign, not the guide's bubble). 平路: a flat run-out ahead, keep your
// speed: a flat arrow over level snow with speed lines behind it. 上坡: a climb: an arrow up a rising slope.
ICONS.road_flat = () => [
  { d: "M4 104 Q4 96 14 96 H114 Q124 96 124 104 V114 Q124 122 116 122 H12 Q4 122 4 114 Z", fill: C.white, shade: C.blue, sw: 4.5, hl: ["M14 102 H46"] },
  { d: line([6, 46], [26, 46]), sw: 4.5 }, { d: line([2, 62], [22, 62]), sw: 4.5 }, { d: line([8, 78], [26, 78]), sw: 4.5 },
  U({ ...capsule(36, 62, 84, 62, 26), ...ARROW, hl: ["M-6 8 V34"] },
    { d: poly([80, 30], [122, 62], [80, 94]), ...ARROW, hl: ["M90 46 L104 56"] }),
];
ICONS.road_up = () => [
  { d: "M4 114 Q4 106 14 104 L112 46 Q124 40 124 54 V114 Q124 122 116 122 H12 Q4 122 4 114 Z", fill: C.white, shade: C.blue, sw: 4.5, hl: ["M20 106 L60 84"] },
  U({ ...capsule(22, 80, 72, 50, 24), ...ARROW, hl: ["M-5 8 V30"] },
    { d: poly([60, 26], [110, 30], [88, 74]), ...ARROW }),
  ...[[96, 92], [76, 104], [108, 76]].map(([x, y]) => ({ d: circ(x, y, 2.4), fill: INK, sw: 0 })),
];

// a snowboard from the side, centred on (cx, cy), turned by a degrees
function board(cx, cy, a) {
  const tr = `rotate(${a} ${cx} ${cy})`;
  return [
    { d: rr(cx - 56, cy - 10, 112, 20, 10), fill: C.blue, shade: "#6f86a6", hl: [`M${cx - 42} ${cy - 3} H${cx - 4}`], transform: tr,
      detail: [{ d: line([cx - 50, cy + 4], [cx + 50, cy + 4]), sw: 3, ink: C.white, op: 0.7 }] },
    { d: rr(cx - 34, cy - 24, 20, 15, 4), fill: C.dslate, sw: 4, transform: tr },
    { d: rr(cx + 14, cy - 24, 20, 15, 4), fill: C.dslate, sw: 4, transform: tr },
  ];
}
function snowLine() {
  return { d: "M4 112 Q36 100 64 104 Q96 108 124 98 V116 Q124 124 116 124 H12 Q4 124 4 116 Z", fill: C.white, shade: C.blue, sw: 5, hl: ["M14 110 Q30 104 44 103"] };
}
// a board from above with a sleeved mitten coming in from (hx, hy) to grab its edge, turned by a
function grab(hx, hy, a) {
  const mitten = (x, y) => [
    U({ ...capsule(x, y + 32, x, y + 70, 24), fill: C.sage },
      { d: rr(x - 16, y - 8, 32, 40, 14), fill: C.cream, hl: [`M${x - 9} ${y + 2} V${y + 14}`] },
      { ...capsule(x + 16, y + 22, x + 22, y + 6, 12), fill: C.cream }),
    { d: line([x - 16, y + 32], [x + 16, y + 32]), sw: 4 },
  ];
  return [
    { d: rr(6, 44, 116, 40, 20), fill: C.blue, shade: "#6f86a6", hl: ["M20 54 H52"],
      detail: [{ d: rr(30, 40, 14, 48, 4), fill: C.dslate, sw: 3.6 }, { d: rr(84, 40, 14, 48, 4), fill: C.dslate, sw: 3.6 }] },
    { parts: mitten(0, 0), at: [hx, hy, a] },
  ];
}
// a board from the side pressing its nose (dir 1) or tail (-1) into the snow, the other end up
function press(dir) {
  const cx = 64 - dir * 4, cy = 70, a = dir * 24, end = 64 + dir * 48;
  return [
    snowLine(),
    ...board(cx, cy, a),
    { d: circ(end + dir * 6, 94, 3), fill: INK, sw: 0 }, { d: circ(end - dir * 4, 88, 2.4), fill: INK, sw: 0 },
    { d: circ(end + dir * 12, 84, 2.2), fill: INK, sw: 0 },
    { d: `M${64 - dir * 46} 22 Q${64 - dir * 40} 14 ${64 - dir * 30} 12`, sw: 4.5 },
  ];
}

function mic(off) {
  const body = off ? C.grey : C.slate;
  const parts = [
    { d: "M28 54 C28 82 44 98 64 98 C84 98 100 82 100 54", sw: 6.5 },
    { d: line([64, 98], [64, 116]), sw: 6.5 },
    { d: line([44, 119], [84, 119]), sw: 6.5 },
    { d: rr(42, 6, 44, 74, 22), fill: body, shade: off ? C.slate : C.dslate, hl: ["M51 22 V40"],
      detail: [24, 36, 48].map((y) => ({ d: line([60, y], [77, y]), sw: 3.2 })) },
  ];
  if (!off) return parts;
  return [
    { mask: { d: line([18, 8], [112, 120]), w: 22 }, parts },
    { ...capsule(18, 10, 110, 118, 11), fill: C.red, shade: "#9b4c46" },
  ];
}

// ---------------- the page ----------------
const PAGE = `<!doctype html><html><body style="margin:0"><svg id="probe" width="0" height="0"></svg><script>
const INK = ${JSON.stringify(INK)};
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const NS = "http://www.w3.org/2000/svg";
// sample a path, nudge each point along its normal by a smooth periodic wobble, and redraw it as a Catmull-Rom curve
function wobble(d, amp, R) {
  return d.split(/(?=M)/).map((sub) => {
    const closed = /Z\\s*$/i.test(sub);
    const p = document.createElementNS(NS, "path"); p.setAttribute("d", sub); probe.appendChild(p);
    const L = p.getTotalLength(); amp *= Math.min(1, L / 50); const n = Math.max(closed ? 14 : 3, Math.round(L / 2.6));
    const ph = [R() * 6.28, R() * 6.28, R() * 6.28], k = [2 + Math.floor(R() * 2), 4 + Math.floor(R() * 3), 9 + Math.floor(R() * 4)];
    const pts = [];
    const cnt = closed ? n : n + 1;
    for (let i = 0; i < cnt; i++) {
      const s = (i / n) * L, a = p.getPointAtLength(Math.max(0, s - 0.5)), b = p.getPointAtLength(Math.min(L, s + 0.5));
      const q = p.getPointAtLength(s); let nx = -(b.y - a.y), ny = b.x - a.x; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
      const t = i / n;
      let w = amp * (0.55 * Math.sin(6.283 * k[0] * t + ph[0]) + 0.3 * Math.sin(6.283 * k[1] * t + ph[1]) + 0.15 * Math.sin(6.283 * k[2] * t + ph[2]));
      if (!closed) w *= Math.min(1, Math.min(t, 1 - t) * 6 + 0.3);
      pts.push([q.x + nx * w, q.y + ny * w]);
    }
    p.remove();
    const N = pts.length, P = (i) => closed ? pts[(i + N) % N] : pts[Math.max(0, Math.min(N - 1, i))];
    let out = "M" + pts[0][0].toFixed(2) + " " + pts[0][1].toFixed(2);
    const last = closed ? N : N - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      out += " C" + [c1, c2, p2].map((v) => v[0].toFixed(2) + " " + v[1].toFixed(2)).join(" ");
    }
    return out + (closed ? " Z" : "");
  }).join(" ");
}
function mix(a, b, t) { const h = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)); const A = h(a), B = h(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); }

function buildSVG(name, items) {
  let uid = 0; const defs = []; const R = rng([...name].reduce((s, c) => s * 31 + c.charCodeAt(0), 7));
  defs.push(\`<filter id="wash" x="0" y="0" width="1" height="1">
    <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="\${Math.floor(R() * 99)}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.3 0 0 0 -0.55" result="lite"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.14  0 0 0 0 0.19  0 0 0 0 0.29  -0.5 0 0 0 0.16" result="dark"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0.14  0 0 0 0 0.19  0 0 0 0 0.29  0 0 0 0.16 -0.04" result="grain"/>
    <feMerge result="m"><feMergeNode in="SourceGraphic"/><feMergeNode in="lite"/><feMergeNode in="dark"/><feMergeNode in="grain"/></feMerge>
    <feComposite in="m" in2="SourceGraphic" operator="in"/></filter>
    <filter id="soft" filterUnits="userSpaceOnUse" x="-80" y="-80" width="300" height="300"><feGaussianBlur stdDeviation="2.6"/></filter>
    <filter id="hlb" filterUnits="userSpaceOnUse" x="-80" y="-80" width="300" height="300"><feGaussianBlur stdDeviation="0.5"/></filter>
    <filter id="ink" filterUnits="userSpaceOnUse" x="-80" y="-80" width="300" height="300"><feGaussianBlur stdDeviation="0.28"/></filter>
    <radialGradient id="lit" cx="0.3" cy="0.22" r="0.85"><stop offset="0" stop-color="#fff" stop-opacity="0.38"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/></radialGradient>\`);
  const amp = (p, d) => p.jit ?? 0.55;
  const strokeOf = (p, d) => p.sw === 0 ? "" :
    \`<path d="\${d}" fill="none" stroke="\${p.ink || INK}" stroke-opacity="\${p.op ?? 1}" stroke-width="\${p.sw ?? 5.5}" stroke-linejoin="round" stroke-linecap="round" \${p.dash ? \`stroke-dasharray="\${p.dash}"\` : ""} filter="url(#ink)"/>\`;
  function fillOf(p, d) {
    if (!p.fill) return "";
    if (p.fill === INK || p.flat) return \`<path d="\${d}" fill="\${p.fill}" filter="url(#ink)"/>\`;
    const id = "c" + (uid++); defs.push(\`<clipPath id="\${id}"><path d="\${d}"/></clipPath>\`);
    const shade = p.shade || mix(p.fill, INK, 0.28);
    let s = \`<g clip-path="url(#\${id})"><g filter="url(#wash)"><path d="\${d}" fill="\${p.fill}"/></g>
      <path d="\${d}" fill="url(#lit)"/>
      <path d="\${d}" fill="none" stroke="\${shade}" stroke-opacity="0.38" stroke-width="9" filter="url(#soft)"/>\`;
    for (const h of p.hl || []) s += \`<path d="\${wobble(h, 0.4, R)}" fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="3.6" stroke-linecap="round" filter="url(#hlb)"/>\`;
    for (const q of p.detail || []) s += part(q);
    return s + "</g>";
  }
  function part(p) {
    const d = wobble(p.d, amp(p), R);
    const body = fillOf(p, d) + strokeOf(p, d);
    return p.transform ? \`<g transform="\${p.transform}">\${body}</g>\` : body;
  }
  function item(it) {
    if (it.union) {
      const ds = it.union.map((p) => wobble(p.d, amp(p), R));
      const wrap = (p, s) => p.transform ? \`<g transform="\${p.transform}">\${s}</g>\` : s;
      return it.union.map((p, i) => wrap(p, strokeOf(p, ds[i]))).join("") + it.union.map((p, i) => wrap(p, fillOf(p, ds[i]))).join("");
    }
    if (it.at) return \`<g transform="translate(\${it.at[0]} \${it.at[1]}) rotate(\${it.at[2]})">\${it.parts.map(item).join("")}</g>\`;
    if (it.mask) {
      const id = "m" + (uid++);
      defs.push(\`<mask id="\${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="128" height="128"><rect width="128" height="128" fill="#fff"/>
        <path d="\${it.mask.d}" stroke="#000" stroke-width="\${it.mask.w}" stroke-linecap="round"/></mask>\`);
      return \`<g mask="url(#\${id})">\${it.parts.map(item).join("")}</g>\`;
    }
    return part(it);
  }
  const body = items.map(item).join("");
  return \`<svg xmlns="\${NS}" viewBox="0 0 128 128" width="512" height="512"><defs>\${defs.join("")}</defs>\${body}</svg>\`;
}
function load(src) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; }); }
async function render(name, items) {
  const svg = buildSVG(name, items);
  const img = await load("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
  let c = document.createElement("canvas"); c.width = c.height = 512; c.getContext("2d").drawImage(img, 0, 0);
  for (const s of [256, 128]) { const n = document.createElement("canvas"); n.width = n.height = s; const g = n.getContext("2d");
    g.imageSmoothingQuality = "high"; g.drawImage(c, 0, 0, s, s); c = n; }
  return c.toDataURL("image/png");
}
async function sheet(news, olds) {
  const cell = 104, pad = 14, cols = Math.max(news.length, olds.length);
  const c = document.createElement("canvas"); const W = pad * 2 + cols * cell; const H = 600; c.width = W; c.height = H;
  const g = c.getContext("2d"); g.fillStyle = "#f6f1e7"; g.fillRect(0, 0, W, H); g.imageSmoothingQuality = "high";
  g.fillStyle = "#23304a"; g.font = "13px -apple-system, Helvetica";
  const row = async (list, y, size, label) => { g.fillText(label, pad, y - 6);
    for (let i = 0; i < list.length; i++) { const im = await load(list[i][1]);
      const x = pad + i * cell + (cell - size) / 2; g.drawImage(im, x, y, size, size);
      if (size > 40) { g.globalAlpha = 0.6; g.font = "10px -apple-system, Helvetica"; g.fillText(list[i][0], pad + i * cell + 4, y + size + 12); g.globalAlpha = 1; g.font = "13px -apple-system, Helvetica"; } } };
  await row(news, 30, 96, "new (drawn by the game agent)");
  await row(olds, 170, 96, "owner's icons");
  await row(news, 330, 32, "new at 32 px");
  await row(olds, 395, 32, "owner's at 32 px");
  // mixed row at 32 px: alternate new and old, as they would sit together in the UI
  const mixed = []; for (let i = 0; i < Math.max(news.length, olds.length); i++) { if (news[i]) mixed.push(news[i]); if (olds[i]) mixed.push(olds[i]); }
  g.fillText("mixed at 32 px (new, old, new, old ...)", pad, 464);
  for (let i = 0; i < mixed.length; i++) { const im = await load(mixed[i][1]); g.drawImage(im, pad + i * 48, 476, 32, 32); }
  g.fillText("at 24 px", pad, 540);
  for (let i = 0; i < mixed.length; i++) { const im = await load(mixed[i][1]); g.drawImage(im, pad + i * 40, 552, 24, 24); }
  return c.toDataURL("image/png");
}
</script></body></html>`;

const args = process.argv.slice(2), wantSheet = args.includes("--sheet"), only = args.filter((a) => a !== "--sheet");
const names = Object.keys(ICONS).filter((n) => !only.length || only.includes(n));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
await page.setContent(PAGE);
const made = [];
for (const name of names) {
  const url = await page.evaluate((n, items) => render(n, items), name, ICONS[name]());
  writeFileSync(join(OUT, name + ".png"), Buffer.from(url.split(",")[1], "base64"));
  made.push([name, url]);
  console.log("drew", name);
}
if (!only.length || wantSheet) { // --sheet with names: the review sheet of just those
  const OLD = ["jacket", "gloves", "lens", "helmet", "hanger", "palette", "lift", "star", "rest", "photo", "memory"];
  const olds = OLD.map((n) => [n, "data:image/png;base64," + readFileSync(join(OUT, n + ".png")).toString("base64")]);
  const url = await page.evaluate((a, b) => sheet(a, b), made, olds);
  mkdirSync(dirname(SHEET), { recursive: true });
  writeFileSync(SHEET, Buffer.from(url.split(",")[1], "base64"));
  console.log("review sheet", SHEET);
}
await browser.close();
