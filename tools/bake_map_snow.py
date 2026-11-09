"""Paint the map under the resort tiles in the owner's snowy watercolour (their nav concept, 2026-11-05):
the real relief from data/region.png as snow — white where it faces the sun, soft blue-grey in shade, a fine
blue ink along the ridges; warm cream paper in the valleys; little painted spruce, snow on them, in the
forest belt; rivers pale blue, the highways as faint warm lines, Denver a warm patch.

usage: python tools/bake_map_snow.py [out]        → assets/wc/colorado.jpg by default   (needs numpy and pillow)
       python tools/bake_map_snow.py --region ut   → assets/wc/utah.jpg, from data/region-ut.png / .json
A region other than Colorado sits lower: the Wasatch's valleys are at ~1,300 m and its spruce and fir grow
from ~1,900 m, so its snow line, forest belt and ridge ink are its own (LOOK); its city is its rank-3 town.
"""
import json, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

args = sys.argv[1:]
RID = args.pop(args.index("--region") + 1) if "--region" in args else "co"
if "--region" in args: args.remove("--region")
NAMES = {"co": "colorado", "ut": "utah"}
OUT = args[0] if args else f"assets/wc/{NAMES[RID]}.jpg"
STEM = "data/region" if RID == "co" else f"data/region-{RID}"
# snow line (m, over m), forest belt (m), ridge ink from (m), the city's warm patch (lon, lat)
LOOK = {"co": {"snow": (1900, 900), "forest": (2300, 3300), "ridge": 2600, "city": (-104.96, 39.72)},
        "ut": {"snow": (1550, 700), "forest": (1900, 3000), "ridge": 2300, "city": (-111.89, 40.74)}}[RID]
meta = json.load(open(f"{STEM}.json"))
S, N, W, E = meta["bounds"]; LAT0, LON0, KX, KZ = meta["origin"]; GW, GH = meta["grid"]
px = np.asarray(Image.open(f"{STEM}.png").convert("RGB")).astype(np.float32)
H = np.minimum(4400, (px[..., 0] * 256 + px[..., 1]) / 2)
# ~7.2 px per km (the look was tuned at that scale: tree sizes, blurs), at most 4096 wide for phones' GPUs
TW = min(4096, round((E - W) * KX * 7.16)); TH = round(TW * GH / GW)
PXKM = TW / ((E - W) * KX)
H = np.asarray(Image.fromarray(H).resize((TW, TH), Image.BICUBIC))
cell = (E - W) * KX * 1000 / TW
gz, gx = np.gradient(H, cell)
n = np.dstack([-gx * 1.6, np.ones_like(H), -gz * 1.6]); n /= np.linalg.norm(n, axis=2, keepdims=True)
L = np.array([-0.6, 0.7, -0.4]); L /= np.linalg.norm(L)
sun = np.clip((n * L).sum(2), 0, 1)
slope = np.hypot(gx, gz)
rng = np.random.default_rng(2)
def noise(k, seed):
    g = np.random.default_rng(seed).random((max(2, TH // k), max(2, TW // k)))
    return np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((TW, TH), Image.BICUBIC)).astype(np.float32) / 255
h = H + (noise(30, 1) - 0.5) * 200
# snow cover: none on the plains, full up high, mottled between
snow = np.clip((h - LOOK["snow"][0]) / LOOK["snow"][1], 0, 1) ** 0.8
paper = np.array([0.965, 0.945, 0.905]); snowc = np.array([0.985, 0.99, 1.0]); shadow = np.array([0.56, 0.65, 0.76])
col = paper * (1 - snow[..., None]) + snowc * snow[..., None]
# shade: blue-grey on the snow, a soft warm grey on the bare ground
sh = (1 - sun)[..., None] ** 1.3
col = col * (1 - sh * (0.55 * snow[..., None] + 0.25)) + (shadow * snow[..., None] + np.array([0.7, 0.66, 0.6]) * (1 - snow[..., None])) * sh * (0.55 * snow[..., None] + 0.25)
# ridges: where the ground is highest around it, a fine blue ink line
def gblur(a, r):  # a separable box blur, three passes ≈ gaussian (PIL can't blur float images)
    for _ in range(3):
        k = int(r); c = np.cumsum(np.pad(a, ((0, 0), (k + 1, k)), mode="edge"), 1); a = (c[:, 2 * k + 1:] - c[:, :-2 * k - 1]) / (2 * k + 1)
        c = np.cumsum(np.pad(a, ((k + 1, k), (0, 0)), mode="edge"), 0); a = (c[2 * k + 1:] - c[:-2 * k - 1]) / (2 * k + 1)
    return a
blur = gblur(H.astype(np.float64), 4)
ridge = np.clip((H - blur - 25) / 60, 0, 1) * np.clip((H - LOOK["ridge"]) / 500, 0, 1)
col = col * (1 - ridge[..., None] * 0.35) + np.array([0.25, 0.33, 0.45]) * ridge[..., None] * 0.35
img = Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8)).convert("RGBA")
ink = Image.new("RGBA", (TW, TH), (0, 0, 0, 0)); g = ImageDraw.Draw(ink)
P = lambda p: ((p[0] - (W - LON0) * KX) / ((E - W) * KX) * TW, (p[1] + (N - LAT0) * KZ) / ((N - S) * KZ) * TH)
for r in meta["rivers"]: g.line([P(p) for p in r], fill=(130, 170, 200, 160), width=2, joint="curve")
for w in meta["water"]: g.polygon([P(p) for p in w], fill=(150, 185, 210, 200))
for cls, colr, wd in [(2, (150, 130, 110, 60), 1), (1, (140, 118, 98, 95), 2), (0, (130, 105, 88, 120), 2)]:
    for r in meta["roads"]:
        if r["c"] == cls: g.line([P(p) for p in r["p"]], fill=colr, width=wd, joint="curve")
dx, dz = (LOOK["city"][0] - LON0) * KX, -(LOOK["city"][1] - LAT0) * KZ
cx, cy = P((dx, dz)); rad = 17 * TW / ((E - W) * KX)
blob = Image.new("L", (TW, TH), 0); ImageDraw.Draw(blob).ellipse([cx - rad, cy - rad * 0.8, cx + rad, cy + rad * 0.8], fill=90)
blob = blob.filter(ImageFilter.GaussianBlur(rad * 0.4))
img = Image.composite(Image.new("RGBA", (TW, TH), (214, 188, 160, 255)), img, blob)
img = Image.alpha_composite(img, ink.filter(ImageFilter.GaussianBlur(0.6)))
# spruce: little painted trees in the forest belt (LOOK: 2300-3300 m in Colorado; not too steep), in clumps
trees = Image.new("RGBA", (TW, TH), (0, 0, 0, 0)); tg = ImageDraw.Draw(trees)
clump = noise(40, 9)
for _ in range(round(26000 * TW * TH / (1600 * 1383))):  # the same density as on the first, smaller map
    x, y = rng.integers(4, TW - 4), rng.integers(8, TH - 2)
    hh = H[y, x]
    if not (LOOK["forest"][0] < hh < LOOK["forest"][1]) or slope[y, x] > 0.6 or clump[y, x] < 0.55 or rng.random() > (clump[y, x] - 0.5) * 2: continue
    s = 2.2 + rng.random() * 2.2
    tg.polygon([(x + s * 0.6, y + 1), (x + s * 2.2, y + 1.5), (x + s * 0.2, y - 0.5)], fill=(70, 90, 110, 50))  # shadow to the lower right
    c = [(62, 92, 82), (52, 80, 72), (74, 102, 92)][rng.integers(3)]
    tg.polygon([(x, y - s * 2.6), (x - s, y), (x + s, y)], fill=c + (235,))
    tg.polygon([(x, y - s * 2.6), (x - s * 0.45, y - s * 1.3), (x + s * 0.1, y - s * 1.5)], fill=(245, 248, 250, 200))  # snow on the sunny side
img = Image.alpha_composite(img, trees).convert("RGB")
# watercolour: soften, wobble, pool pigment at the rims, granulate, sit on paper
x = np.asarray(img.filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 255
yy, xx = np.mgrid[0:TH, 0:TW]
sx = np.clip((xx + (noise(25, 3) - 0.5) * 5).astype(int), 0, TW - 1); sy = np.clip((yy + (noise(25, 4) - 0.5) * 5).astype(int), 0, TH - 1)
x = x[sy, sx]
Lm = x @ [0.3, 0.59, 0.11]
gran = np.asarray(Image.fromarray((rng.random((TH, TW)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
x = x * (1 - (gran[..., None] - 0.5) * 0.08 * (0.5 + (1 - Lm[..., None])))
x = x * (0.975 + 0.04 * noise(120, 5)[..., None])
# fade the borders into the plain snowy ground the map lies on (collection.js), so it has no edge
EDGE = np.array([0xec, 0xef, 0xf2]) / 255
fx = np.minimum(xx, TW - 1 - xx) / (PXKM * 20); fy = np.minimum(yy, TH - 1 - yy) / (PXKM * 20)  # over ~20 km
f = np.clip(np.minimum(fx, fy) + (noise(18, 7) - 0.5) * 0.5, 0, 1)[..., None] ** 1.5
x = x * f + EDGE * (1 - f)
# a phone downloads it: if it comes out heavy, step it down until it's under ~1.4 MB
out = Image.fromarray((np.clip(x, 0, 1) * 255).astype(np.uint8)); k = 1.0
while True:
    im = out if k == 1 else out.resize((round(TW * k), round(TH * k)), Image.LANCZOS)
    im.save(OUT, quality=84, optimize=True, progressive=True)
    import os
    if os.path.getsize(OUT) < 1.4e6 or k < 0.5: break
    k *= 0.9
print(OUT, im.size, os.path.getsize(OUT))
