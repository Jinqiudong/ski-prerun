"""Paint the map under the resort tiles: central Colorado, Denver to Aspen and Steamboat, as a quiet
watercolour. The relief from data/region.png (tools/bake_region.py) in soft washes (warm plains, sage
foothills, blue-grey ranges, snow on the high ground), rivers in blue, the highways as fine ink lines,
Denver as a warm patch; then paper grain and pigment pooling at the edges of the washes.

usage: python tools/bake_map.py      → assets/wc/colorado.jpg   (needs numpy and pillow)
"""
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

meta = json.load(open("data/region.json"))
S, N, W, E = meta["bounds"]; LAT0, LON0, KX, KZ = meta["origin"]; GW, GH = meta["grid"]
px = np.asarray(Image.open("data/region.png").convert("RGB")).astype(np.float32)
H = np.minimum(4400, (px[..., 0] * 256 + px[..., 1]) / 2)
TW = 1600; TH = round(TW * GH / GW)
H = np.asarray(Image.fromarray(H).resize((TW, TH), Image.BICUBIC))
cell = (E - W) * KX * 1000 / TW
gz, gx = np.gradient(H, cell)
n = np.dstack([-gx * 1.4, np.ones_like(H), -gz * 1.4]); n /= np.linalg.norm(n, axis=2, keepdims=True)
L = np.array([-0.6, 0.7, -0.4]); L /= np.linalg.norm(L)
sun = np.clip((n * L).sum(2), 0, 1)
rng = np.random.default_rng(2)
def noise(k, seed):
    g = np.random.default_rng(seed).random((max(2, TH // k), max(2, TW // k)))
    return np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((TW, TH), Image.BICUBIC)).astype(np.float32) / 255
# Washes by height, the edges between them wobbled by noise so they bleed.
h = H + (noise(30, 1) - 0.5) * 220
stops = [(1500, (0.95, 0.91, 0.83)), (1900, (0.90, 0.88, 0.80)), (2300, (0.78, 0.82, 0.76)), (2900, (0.66, 0.73, 0.76)), (3350, (0.80, 0.85, 0.89)), (3700, (0.97, 0.97, 0.96))]
col = np.zeros((TH, TW, 3), np.float32)
for i in range(len(stops)):
    lo, c0 = stops[i - 1] if i else (0, stops[0][1]); hi, c1 = stops[i]
    t = np.clip((h - lo) / max(1, hi - lo), 0, 1)[..., None]
    m = ((h > lo) & (h <= hi))[..., None] if i else (h <= hi)[..., None]
    col = np.where(m, np.array(c0) + (np.array(c1) - np.array(c0)) * t, col)
col = np.where((h > stops[-1][0])[..., None], np.array(stops[-1][1]), col)
# Shade: cool and blue where the slopes turn from the sun, a little warmth where they face it.
shade = (0.55 + 0.6 * sun)[..., None]
col = col * shade + np.array([0.18, 0.24, 0.34]) * (1 - shade) * 0.35
# The lines: rivers, then the highways, then I-70 a touch stronger; Denver a warm patch.
img = Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8)).convert("RGBA")
ink = Image.new("RGBA", (TW, TH), (0, 0, 0, 0)); g = ImageDraw.Draw(ink)
P = lambda p: ((p[0] - (W - LON0) * KX) / ((E - W) * KX) * TW, (p[1] + (N - LAT0) * KZ) / ((N - S) * KZ) * TH)
for r in meta["rivers"]: g.line([P(p) for p in r], fill=(120, 160, 190, 170), width=2, joint="curve")
for w in meta["water"]: g.polygon([P(p) for p in w], fill=(140, 178, 205, 200))
for cls, colr, wd in [(2, (120, 105, 90, 90), 1), (1, (110, 95, 80, 140), 2), (0, (95, 80, 70, 170), 2)]:
    for r in meta["roads"]:
        if r["c"] == cls: g.line([P(p) for p in r["p"]], fill=colr, width=wd, joint="curve")
dx, dz = (-104.96 - LON0) * KX, -(39.72 - LAT0) * KZ
cx, cy = P((dx, dz)); rad = 17 * TW / ((E - W) * KX)
blob = Image.new("L", (TW, TH), 0); ImageDraw.Draw(blob).ellipse([cx - rad, cy - rad * 0.8, cx + rad, cy + rad * 0.8], fill=110)
blob = blob.filter(ImageFilter.GaussianBlur(rad * 0.4))
img = Image.composite(Image.new("RGBA", (TW, TH), (196, 170, 150, 255)), img, blob)
img = Image.alpha_composite(img, ink.filter(ImageFilter.GaussianBlur(0.6))).convert("RGB")
# Watercolour: soften into washes, wobble, pool pigment at the rims, granulate, and sit on paper.
x = np.asarray(img.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
yy, xx = np.mgrid[0:TH, 0:TW]
sx = np.clip((xx + (noise(25, 3) - 0.5) * 8).astype(int), 0, TW - 1); sy = np.clip((yy + (noise(25, 4) - 0.5) * 8).astype(int), 0, TH - 1)
x = x[sy, sx]
Lm = x @ [0.3, 0.59, 0.11]
e = np.clip((np.abs(np.roll(Lm, -2, 1) - np.roll(Lm, 2, 1)) + np.abs(np.roll(Lm, -2, 0) - np.roll(Lm, 2, 0))) * 3, 0, 1)
e = np.asarray(Image.fromarray((e * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
x = x * (1 - 0.12 * e[..., None])
gran = np.asarray(Image.fromarray((rng.random((TH, TW)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
x = x * (1 - (gran[..., None] - 0.5) * 0.1 * (0.5 + (1 - Lm[..., None])))
x = x * (0.965 + 0.05 * noise(120, 5)[..., None])
x = x * 0.94 + np.array([0.965, 0.945, 0.91]) * 0.06
Image.fromarray((np.clip(x, 0, 1) * 255).astype(np.uint8)).save("assets/wc/colorado.jpg", quality=82)
print(TW, TH)
