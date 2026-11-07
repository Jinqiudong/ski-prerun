"""Cut the party pet's art out of the owner's painted sheet (the capybara peeking over a snowy ledge, its
expressions, the sign it holds up, and the little ledge, plank and snow pieces) into transparent PNGs.

The sheet is painted on beige paper. Each piece is a box on the sheet; the paper is keyed out by flooding
in from the box's edges over paper-coloured pixels (so paper-coloured paint inside an ink outline, like the
sign's wood, stays), with a soft ramp at the edge and the paper's colour taken back out of the edge pixels
(no beige halo; the snow stays white). Paper shut inside a piece (between an arm and a sign post) is keyed
from the extra seed points listed with it. The sign's lettering is painted out (filled from the wood
around it), so the page writes its own words on it.

usage: python3 tools/cut_party_art.py [path/to/peek_reference.png]   → assets/party/<name>.png
       add --preview=<file.png> for a check sheet: every piece on paper, on navy and on a checkerboard
Other animals later: the same set of names, as assets/party/<animal>/<name>.png (src/core/party.js PETS).
"""
import math, os, random, sys
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "party")
SRC = next((a for a in sys.argv[1:] if not a.startswith("--")), os.path.expanduser("~/Desktop/SnowboardGame/handoff/party/peek_reference.png"))

# Each piece: its box on the sheet; seeds (paper shut inside it), quads (lettering to paint out), erase
# (boxes of the neighbours' bits to drop: the flow's arrows, a sparkle); canvas: a fixed box on the sheet to
# place it in instead of cropping it tight, so the expressions all line up and can be swapped in place.
# The expressions are cut just above their own ledge's line: the page puts its ledge in front of the paws.
EXPR_Y = (853, 948)
def expr(x0, x1, cx): return dict(box=(x0, EXPR_Y[0], x1, EXPR_Y[1]), canvas=(cx - 86, EXPR_Y[0], cx + 86, EXPR_Y[1]))
PIECES = {
    # The bottom row: 探头 眨眼 开心 惊喜 打瞌睡 喜欢.
    "peek": expr(24, 181, 102), "blink": expr(181, 334, 256), "happy": expr(334, 498, 412),
    "surprised": expr(499, 640, 564), "doze": expr(640, 786, 714), "love": expr(786, 940, 864),
    # The top row: (2) dragged down, (3) out holding the sign, (4) staying, a heart beside it.
    "drag": dict(box=(352, 150, 610, 300), erase=[(462, 290, 500, 300)]),
    "sign": dict(box=(604, 18, 914, 362), quads=[((650, 72), (886, 46), (893, 154), (656, 186))], erase=[(604, 150, 624, 270), (604, 225, 657, 270)]),
    "sign_love": dict(box=(944, 58, 1228, 360), quads=[((988, 126), (1168, 84), (1174, 148), (996, 188))], erase=[(944, 225, 968, 270), (1195, 225, 1228, 270)]),
    # Decoration: the snow-capped ledge, the plank, a snow-only ledge, a snow pile, the pines.
    "ledge": dict(box=(990, 866, 1198, 931)), "plank": dict(box=(1218, 866, 1366, 925)),
    "snowledge": dict(box=(992, 938, 1190, 994)), "snowpile": dict(box=(1208, 929, 1340, 988)), "pines": dict(box=(1358, 848, 1516, 982)),
}
LO, HI = 9, 24  # distance from the paper: below LO fully paper, above HI fully paint

def dist(a, b): return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5

def paper_of(im):
    """The paper's colour: the median of the box's border pixels."""
    w, h = im.size; px = im.load()
    ring = [px[x, y] for x in range(w) for y in (0, h - 1)] + [px[x, y] for y in range(h) for x in (0, w - 1)]
    return tuple(sorted(c[i] for c in ring)[len(ring) // 2] for i in range(3))

def inpaint(im, quad):
    """Paint out the lettering inside a quad: everything not like the wood there is filled from its neighbours."""
    px = im.load(); w, h = im.size
    def inside(x, y):
        s = 0
        for i in range(4):
            (ax, ay), (bx, by) = quad[i], quad[(i + 1) % 4]
            c = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
            if c != 0: s += 1 if c > 0 else -1
        return abs(s) == 4
    pts = [(x, y) for y in range(h) for x in range(w) if inside(x, y)]
    wood = tuple(sorted(px[p][i] for p in pts)[len(pts) // 2] for i in range(3))
    bad = {p for p in pts if dist(px[p], wood) > 30}
    for _ in range(3):  # and the soft edge of each stroke
        bad |= {(x + dx, y + dy) for (x, y) in bad for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if inside(x + dx, y + dy)}
    todo = set(bad)
    while todo:  # fill from the outside in: each pixel the mean of its filled neighbours
        nxt = set(); done = {}
        for (x, y) in todo:
            ns = [px[x + dx, y + dy] for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2) if (dx or dy) and (x + dx, y + dy) not in todo and 0 <= x + dx < w and 0 <= y + dy < h]
            if len(ns) >= 3: done[(x, y)] = tuple(sum(c[i] for c in ns) // len(ns) for i in range(3))
            else: nxt.add((x, y))
        if not done: break
        for p, c in done.items(): px[p] = c
        todo = nxt
    # a little of the wood's grain back, so the patch isn't flat
    rnd = random.Random(7)
    for p in bad:
        c = px[p]; k = rnd.randint(-3, 3); px[p] = (c[0] + k, c[1] + k, c[2] + k)

def cut(sheet, box, seeds=(), quads=(), erase=(), canvas=None):
    im = sheet.crop(box).convert("RGB")
    bg0 = paper_of(im)
    for (x0, y0, x1, y1) in erase: im.paste(bg0, (x0 - box[0], y0 - box[1], x1 - box[0], y1 - box[1]))
    for q in quads: inpaint(im, [(x - box[0], y - box[1]) for x, y in q])
    w, h = im.size; px = im.load(); bg = paper_of(im)
    d = [[dist(px[x, y], bg) for x in range(w)] for y in range(h)]
    # flood the paper in from the edges (and the seeds), over pixels close enough to it
    paper = [[False] * w for _ in range(h)]
    st = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)] + [(x - box[0], y - box[1]) for x, y in seeds]
    while st:
        x, y = st.pop()
        if not (0 <= x < w and 0 <= y < h) or paper[y][x] or d[y][x] >= HI: continue
        paper[y][x] = True
        st += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    out = Image.new("RGBA", (w, h)); op = out.load()
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if paper[y][x]: a = max(0.0, min(1.0, (d[y][x] - LO) / (HI - LO)))
            else:
                # paint next to the paper: the ink's soft edge, partly paper too
                near = any(0 <= x + dx < w and 0 <= y + dy < h and paper[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                a = min(1.0, 0.55 + d[y][x] / 60) if near else 1.0
            if a <= 0: op[x, y] = (0, 0, 0, 0); continue
            # take the paper back out of the colour: c = a·paint + (1 − a)·paper
            pc = tuple(max(0, min(255, round((c[i] - (1 - a) * bg[i]) / a))) for i in range(3))
            op[x, y] = pc + (round(a * 255),)
    # a speck of paper left alone (a lone pixel of grain) goes; then crop to what's there, 2 px around
    al = out.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    out.putalpha(Image.composite(out.getchannel("A"), Image.new("L", out.size, 0), al.point(lambda v: 255 if v > 0 else 0)))
    if canvas:
        c = Image.new("RGBA", (canvas[2] - canvas[0], canvas[3] - canvas[1])); c.paste(out, (box[0] - canvas[0], box[1] - canvas[1])); return c, canvas
    bb = out.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bb: return out, box
    out = out.crop((max(0, bb[0] - 2), max(0, bb[1] - 2), min(w, bb[2] + 2), min(h, bb[3] + 2)))
    return out, (box[0] + max(0, bb[0] - 2), box[1] + max(0, bb[1] - 2))

def main():
    sheet = Image.open(SRC).convert("RGB")
    os.makedirs(OUT, exist_ok=True)
    made = {}
    for name, P in PIECES.items():
        im, at = cut(sheet, **P)
        p = os.path.join(OUT, name + ".png"); im.save(p, optimize=True)
        made[name] = im
        print(f"{name}: {im.size[0]}×{im.size[1]}, {os.path.getsize(p) // 1024} KB")
        for q in P.get("quads", []):  # where the page writes on the sign: the blank face, as fractions of the image
            fx = [round((x - at[0]) / im.width, 3) for x, _ in q]; fy = [round((y - at[1]) / im.height, 3) for _, y in q]
            ang = math.degrees(math.atan2(q[1][1] - q[0][1], q[1][0] - q[0][0]))
            print(f"  face: x {min(fx)}..{max(fx)}, y {min(fy)}..{max(fy)}, centre ({sum(fx) / 4:.3f}, {sum(fy) / 4:.3f}), tilt {ang:.1f} deg")
    prev = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--preview=")), None)
    if prev:  # every piece on paper, on dark and on a checkerboard, to look for halos
        W = sum(im.width + 10 for im in made.values()); H = max(im.height for im in made.values())
        sheetp = Image.new("RGB", (W, H * 3 + 20), (244, 239, 230))
        dark = Image.new("RGB", (W, H), (40, 52, 77)); sheetp.paste(dark, (0, H + 10))
        x = 0
        for im in made.values():
            for k in range(3):
                if k == 2:
                    ck = Image.new("RGB", im.size, (255, 255, 255)); cp = ck.load()
                    for yy in range(im.height):
                        for xx in range(im.width):
                            if (xx // 8 + yy // 8) % 2: cp[xx, yy] = (200, 205, 210)
                    sheetp.paste(ck, (x, (H + 10) * 2))
                sheetp.paste(im, (x, (H + 10) * k), im)
            x += im.width + 10
        sheetp.save(prev); print("preview:", prev)

if __name__ == "__main__":
    main()
