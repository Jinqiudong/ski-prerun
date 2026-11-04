"""Turn a resort render into the quiet watercolour on its lift ticket (assets/wc/<id>.jpg): flatten into
washes, pull the palette toward soft greys and blue-greens, let edges wobble and bleed, pool pigment at the
rims, add paper grain and a ragged white margin. Renders come from tools/capture_vista.mjs. Needs numpy.

usage: python tools/watercolor.py vista.png assets/wc/<id>.jpg [x0 y0 x1 y1]   (we crop 120 150 830 620)
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
if len(sys.argv) > 6: im = im.crop(tuple(int(v) for v in sys.argv[3:7]))
W = 700; im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
a = np.asarray(im).astype(np.float32) / 255
H, W = a.shape[:2]
rng = np.random.default_rng(3)

def box(x, r):  # mean over a (2r+1)^2 box, via cumulative sums
    p = np.pad(x, ((r + 1, r), (r + 1, r)) + ((0, 0),) * (x.ndim - 2), mode="edge")
    c = p.cumsum(0).cumsum(1)
    return (c[2 * r + 1:, 2 * r + 1:] - c[:-2 * r - 1, 2 * r + 1:] - c[2 * r + 1:, :-2 * r - 1] + c[:-2 * r - 1, :-2 * r - 1]) / (2 * r + 1) ** 2

def kuwahara(x, r):
    L = x @ [0.3, 0.59, 0.11]
    m, m2, mc = box(L, r), box(L * L, r), box(x, r)
    v = m2 - m * m
    best = np.full(L.shape, np.inf); outc = np.zeros_like(x)
    for dy in (-r, r):
        for dx in (-r, r):
            vs = np.roll(np.roll(v, dy, 0), dx, 1); cs = np.roll(np.roll(mc, dy, 0), dx, 1)
            take = vs < best; best = np.where(take, vs, best); outc[take] = cs[take]
    return outc

def noise(scale, seed):  # smooth value noise in 0..1
    g = np.random.default_rng(seed).random((H // scale + 2, W // scale + 2)).astype(np.float32)
    return np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)).astype(np.float32) / 255

x = kuwahara(a, 2)
x = np.asarray(Image.fromarray((x * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5))).astype(np.float32) / 255
# Palette: soften the sky's blue, cool the shadows, keep the snow bright and the woods blue-green.
L = x @ [0.3, 0.59, 0.11]
grey = np.stack([L] * 3, -1)
x = grey + (x - grey) * 0.6  # quieter colour
# More contrast in the mid tones so the ridges read, as a painter would push them.
x = np.clip(0.5 + (x - 0.5) * 1.25, 0, 1)
x = x * [0.98, 1.0, 1.01]
# The woods: the darks lean blue-green, the way spruce is painted under snow.
dk = np.clip((0.62 - (x @ [0.3, 0.59, 0.11])) / 0.4, 0, 1)[..., None]
x = x * (1 - 0.45 * dk) + np.array([0.33, 0.44, 0.42]) * 0.45 * dk
x = np.clip((x - 0.06) / 0.92, 0, 1) ** 0.92  # lift
# Edges wobble and bleed: displace by low-frequency noise, then mix in a soft blur.
nx, ny = noise(40, 1) - 0.5, noise(40, 2) - 0.5
yy, xx = np.mgrid[0:H, 0:W]
sx = np.clip((xx + nx * 9).astype(int), 0, W - 1); sy = np.clip((yy + ny * 9).astype(int), 0, H - 1)
x = x[sy, sx]
soft = np.asarray(Image.fromarray((x * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))).astype(np.float32) / 255
x = x * 0.7 + soft * 0.3
# Pigment pools at the rim of each wash: darken where tone changes.
L = x @ [0.3, 0.59, 0.11]
gx = np.abs(np.roll(L, -1, 1) - np.roll(L, 1, 1)); gy = np.abs(np.roll(L, -1, 0) - np.roll(L, 1, 0))
e = np.clip((gx + gy) * 4, 0, 1)
e = np.asarray(Image.fromarray((e * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))).astype(np.float32) / 255
x = x * (1 - 0.22 * e[..., None])
# Granulation (pigment settles in the paper's tooth, more in the darks) and the paper itself.
gran = rng.random((H, W)).astype(np.float32)
gran = np.asarray(Image.fromarray((gran * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 255
dark = 1 - (x @ [0.3, 0.59, 0.11])
x = x * (1 - (gran[..., None] - 0.5) * 0.16 * (0.4 + dark[..., None]))
blot = noise(90, 5)
x = x * (0.96 + 0.06 * blot[..., None])
paper = np.array([0.985, 0.975, 0.955])
x = x * paper
# A ragged white margin, as if painted to the edge of a taped-off sheet.
m = noise(14, 7) * 0.6 + noise(5, 8) * 0.4
d = np.minimum.reduce([xx, W - 1 - xx, yy, H - 1 - yy]).astype(np.float32)
keep = np.clip((d - 6 - m * 22) / 6, 0, 1)
x = x * keep[..., None] + paper * (1 - keep[..., None])
Image.fromarray((np.clip(x, 0, 1) * 255).astype(np.uint8)).save(out, quality=92)
print(out, W, H)
