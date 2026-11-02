"""Paint spruce branch cards from Poly Haven's fir twig textures (fir_tree_01, CC0).

  python tools/make_branch.py <dir with fir_tree_01_twig_diff_1k.png and _twig_alpha_1k.png> assets/tex

Writes spruce_branch.png (RGBA: a whole branch seen from above, trunk end on the left), spruce_crown.png
(RGBA: the tree's top, tip up) and spruce_snow.png / spruce_crown_snow.png (grey: where snow lies, used
only on faces turned to the sky).
"""
import math, random, sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

src, out = sys.argv[1], sys.argv[2]
diff = Image.open(f"{src}/fir_tree_01_twig_diff_1k.png").convert("RGB")
alpha = Image.open(f"{src}/fir_tree_01_twig_alpha_1k.png").convert("L")
# Colorado spruce: darker and bluer than the fir's green.
r, g, b = diff.split()
diff = Image.merge("RGB", (r.point(lambda v: v * 0.55), g.point(lambda v: v * 0.72), b.point(lambda v: v * 0.68)))
atlas = diff.copy(); atlas.putalpha(alpha)
BOXES = [(313, 410, 659, 793), (650, 463, 974, 849), (669, 53, 959, 377), (194, 48, 425, 318)]
twigs = [atlas.crop(b) for b in BOXES]
random.seed(4)


def paste_twig(card, snow, sprite, base, phi, length, shade, snowy):
    """Lay a twig with its stem end at base, pointing at angle phi (degrees, y up), length px long."""
    k = length / sprite.height
    s = sprite.resize((max(2, int(sprite.width * k)), max(2, int(sprite.height * k))), Image.LANCZOS)
    if shade != 1:
        rgb = s.convert("RGB").point(lambda v: v * shade); rgb.putalpha(s.split()[3]); s = rgb
    rot = phi - 90
    rs = s.rotate(rot, resample=Image.BICUBIC, expand=True)
    # The stem end: bottom centre of the sprite, as an offset from its centre, rotated.
    a = math.radians(rot)
    vx, vy = 0, s.height / 2  # image coords (y down)
    rx = vx * math.cos(a) + vy * math.sin(a)
    ry = -vx * math.sin(a) + vy * math.cos(a)
    cx, cy = base[0] - rx, base[1] - ry
    pos = (int(cx - rs.width / 2), int(cy - rs.height / 2))
    card.alpha_composite(rs, pos) if 0 <= pos[0] and 0 <= pos[1] and pos[0] + rs.width <= card.width and pos[1] + rs.height <= card.height else card.paste(rs, pos, rs)
    if snowy > 0:
        m = rs.split()[3].point(lambda v: int(v * snowy))
        snow.paste(Image.new("L", rs.size, 255), pos, m)


def branch(W=1024, H=512):
    card = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    snow = Image.new("L", (W, H), 0)
    y0 = H / 2
    stem = lambda t: (24 + t * (W - 70), y0 + 18 * t * t)
    d = ImageDraw.Draw(card)
    pts = [stem(i / 40) for i in range(41)]
    for i in range(40):
        d.line([pts[i], pts[i + 1]], fill=(62, 44, 32, 255), width=int(12 - 9 * i / 40))
    for layer, shade, n in ((0, 0.55, 30), (1, 1.0, 34)):
        for i in range(n):
            t = 0.03 + 0.95 * i / n + random.uniform(-0.01, 0.01)
            side = 1 if (i + layer) % 2 else -1
            phi = side * random.uniform(38, 62) + (-6 * t)
            length = (230 - 140 * t) * random.uniform(0.85, 1.1) * (1.08 if layer == 0 else 1)
            paste_twig(card, snow, random.choice(twigs), stem(t), phi, length, shade * random.uniform(0.85, 1.1), 0 if layer == 0 else random.uniform(0.0, 0.9))
    paste_twig(card, snow, twigs[0], stem(0.97), -4, 120, 1.0, 0.6)
    return card, snow


def crown(W=512, H=1024):
    card = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    snow = Image.new("L", (W, H), 0)
    stem = lambda t: (W / 2, H - 20 - t * (H - 80))
    d = ImageDraw.Draw(card)
    d.line([stem(0), stem(1)], fill=(62, 44, 32, 255), width=8)
    for i in range(36):
        t = i / 36
        side = 1 if i % 2 else -1
        phi = 90 + side * random.uniform(55, 80) - side * 25 * t
        length = (260 - 200 * t) * random.uniform(0.85, 1.1)
        paste_twig(card, snow, random.choice(twigs), stem(t), phi, length, random.uniform(0.75, 1.05), random.uniform(0.2, 0.9))
    paste_twig(card, snow, twigs[3], stem(0.98), 90, 110, 1.0, 0.5)
    return card, snow


def snow_mask(card, snow):
    # Snow lies in soft clumps on the foliage, not on every needle.
    clumps = Image.new("L", card.size, 0)
    d = ImageDraw.Draw(clumps)
    for _ in range(int(card.width * card.height / 2600)):
        x, y, r = random.uniform(0, card.width), random.uniform(0, card.height), random.uniform(10, 34)
        d.ellipse([x - r, y - r * 0.7, x + r, y + r * 0.7], fill=255)
    clumps = clumps.filter(ImageFilter.GaussianBlur(6))
    m = ImageChops.multiply(snow.filter(ImageFilter.GaussianBlur(3)), clumps)
    return ImageChops.multiply(m, card.split()[3])


for name, (card, snow) in (("spruce_branch", branch()), ("spruce_crown", crown())):
    card.save(f"{out}/{name}.png")
    snow_mask(card, snow).save(f"{out}/{name.replace('spruce_branch', 'spruce')}_snow.png" if name == "spruce_branch" else f"{out}/spruce_crown_snow.png")
print("ok")
