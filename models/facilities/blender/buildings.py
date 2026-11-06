"""Buildings and the furniture around them."""
import math, random
from mathutils import Vector
from lib import *
import lib

def restaurant():
    """A mountain restaurant: stone footing, log walls, a glass gable front lit warm from inside,
    a deep snowy roof, a deck with tables and parasols, a board rack."""
    new_col("restaurant")
    W, D, F, T, R = 16.0, 11.0, 1.2, 5.0, 4.4
    ST, LOG, TIM, DECK, ROOF, SN = stone("stone"), wood("log", "#5a3b26", "#8c6240", "X"), wood("timber", "#4a3020", "#6e4a31", "Z"), wood("deck", "#7a5638", "#a37a52", "X"), wood("roof", "#3b2a22", "#54392b", "Y"), snow()
    LOGY = wood("logy", "#5a3b26", "#8c6240", "Y")
    WIN, LAMP, GL = lit("window"), lit("lamp", "#ffd9a0", 6.0, "#ffffff", window=False), glass("glass", "#9fb6c8", 0.25)
    box((W + 0.4, D + 0.4, F + 0.3), (0, 0, (F - 0.3) / 2), ST, bevel=0.06)
    box((W - 0.4, D - 0.4, T - F), (0, 0, (F + T) / 2), wood("inner", "#3e2a1e", "#553a29"))
    n = int((T - F) / 0.32)
    for i in range(n):  # log walls: sides along Y, back along X, crossing at the corners
        z = F + 0.17 + i * 0.32
        for s in (-1, 1): cyl(0.17, D + 0.7, (s * W / 2, 0.08, z + (0.16 if s > 0 else 0)), LOGY, rot=(math.pi / 2, 0, 0), verts=12)
        cyl(0.17, W + 0.7, (0, D / 2, z + 0.08), LOG, rot=(0, math.pi / 2, 0), verts=12)
    # The front: posts, beams, lit windows, a double door in the middle bay.
    fy = -D / 2
    bays = 6
    for k in range(bays + 1): box((0.34, 0.34, T - F), (-W / 2 + k * W / bays, fy, (F + T) / 2), TIM, bevel=0.03)
    box((W + 0.5, 0.42, 0.42), (0, fy, T), TIM, bevel=0.04)
    box((W, 0.3, 0.22), (0, fy, F + 0.11), TIM, bevel=0.02)
    for k in range(bays):
        x0, x1 = -W / 2 + k * W / bays + 0.17, -W / 2 + (k + 1) * W / bays - 0.17; cx, w = (x0 + x1) / 2, x1 - x0
        if k == 3:
            for s in (-1, 1): box((w / 2 - 0.05, 0.12, 2.4), (cx + s * w / 4, fy - 0.02, F + 1.25), TIM, bevel=0.02)
            box((w / 2 - 0.35, 0.05, 1.0), (cx - w / 4, fy - 0.09, F + 1.7), WIN, kind="lit"); box((w / 2 - 0.35, 0.05, 1.0), (cx + w / 4, fy - 0.09, F + 1.7), WIN, kind="lit")
            box((w, 0.12, T - F - 2.6), (cx, fy - 0.02, (F + 2.5 + T) / 2), WIN, kind="lit")
            for s in (-1, 1): box((0.14, 0.14, 0.28), (cx + s * (w / 2 + 0.1), fy - 0.28, F + 2.3), LAMP, kind="lamp")
            continue
        box((w, 0.1, T - F - 0.4), (cx, fy, (F + T) / 2), WIN, kind="lit")
        box((w, 0.16, 0.12), (cx, fy - 0.05, F + 2.4), TIM)  # transom
        box((0.08, 0.16, T - F - 0.4), (cx, fy - 0.05, (F + T) / 2), TIM)  # mullion
    # Gables: the front one glass in a timber frame, the back one boarded.
    rise = R
    tri([(-W / 2, fy + 0.05, T), (W / 2, fy + 0.05, T), (0, fy + 0.05, T + rise)], WIN, kind="lit")
    for x in (-W / 4, 0, W / 4):
        h = rise * (1 - abs(x) / (W / 2)); box((0.22, 0.24, h), (x, fy - 0.03, T + h / 2), TIM)
    box((W * 0.75, 0.24, 0.2), (0, fy - 0.03, T + rise * 0.4), TIM)
    tri([(-W / 2, D / 2, T), (W / 2, D / 2, T), (0, D / 2, T + rise)], wood("boards", "#4d3424", "#6b4a33", "Z"), thick=0.2)
    # Roof: two slabs from the ridge out past the walls, timber fascia, deep snow with a rounded lip.
    a = math.atan2(rise, W / 2); over = 1.5; L = (W / 2 + over) / math.cos(a); ridge = Vector((0, 0, T + rise + 0.25))
    for s in (-1, 1):
        d = Vector((s * math.cos(a), 0, -math.sin(a))); nrm = Vector((s * math.sin(a), 0, math.cos(a)))
        c = ridge + d * (L / 2); rot = (0, s * a, 0)
        box((L, D + 2.8, 0.36), c, ROOF, rot=rot, bevel=0.04)
        for y in (-(D / 2 + 1.4), D / 2 + 1.4): box((L, 0.26, 0.5), c + Vector((0, y, -0.08)), TIM, rot=rot, bevel=0.03)
        slab((L - 0.1, D + 2.7, 0.62), c + nrm * 0.48, SN, rot=rot)
        eave = ridge + d * L + nrm * 0.45
        cyl(0.3, D + 2.7, eave, SN, rot=(math.pi / 2, 0, 0), verts=12)
        for i in range(26):  # icicles
            y = -D / 2 - 1.2 + rnd.random() * (D + 2.4); h = 0.15 + rnd.random() * 0.45
            cyl(0.05, h, eave + Vector((0, 0, 0)) + Vector((s * 0.05, y, -0.3 - h / 2)), flat("ice", "#cfe3f2", 0.2, grain=0), verts=6, r2=0.0)
    cyl(0.4, D + 2.7, ridge + Vector((0, 0, 0.45)), SN, rot=(math.pi / 2, 0, 0), verts=14)
    # Chimney.
    cx, cy = W * 0.22, D * 0.2; ztop = T + rise * (1 - cx / (W / 2)) + 2.2
    box((1.1, 1.1, 3.2), (cx, cy, ztop - 1.6), ST, bevel=0.04); box((1.4, 1.4, 0.18), (cx, cy, ztop + 0.05), ST, bevel=0.03)
    blob((1.4, 1.4, 0.4), (cx, cy, ztop + 0.3), SN)
    # The deck.
    dy0, dd = fy - 0.2, 4.8
    box((W + 0.6, dd, 0.3), (0, dy0 - dd / 2, F - 0.2), TIM, bevel=0.03)
    for i in range(int(dd / 0.2)): box((W + 0.5, 0.17, 0.07), (0, dy0 - 0.1 - i * 0.2, F - 0.02), DECK, bevel=0.01)
    for x in (-W / 2, -W / 6, W / 6, W / 2): box((0.3, 0.3, F), (x, dy0 - dd + 0.15, (F - 0.3) / 2), TIM)
    ry = dy0 - dd + 0.08
    for i in range(17): x = -W / 2 - 0.2 + i * (W + 0.4) / 16; box((0.12, 0.12, 1.0), (x, ry, F + 0.5), TIM)
    for z in (F + 0.5, F + 1.0): box((W + 0.5, 0.14, 0.14), (0, ry, z), TIM)
    for s in (-1, 1):
        for i in range(4): box((0.12, 0.12, 1.0), (s * (W / 2 + 0.2), dy0 - i * dd / 3.5, F + 0.5), TIM)
        box((0.14, dd, 0.14), (s * (W / 2 + 0.2), dy0 - dd / 2, F + 1.0), TIM)
    blob((W + 0.4, 0.26, 0.16), (0, ry, F + 1.12), SN, lumps=0.03)
    for i, x in enumerate((-W * 0.3, 0, W * 0.3)): picnic((x, dy0 - 2.3, F + 0.05), DECK, SN, rot=0.1 * (i - 1))
    for x, col in ((-W * 0.15, "#8e3b32"), (W * 0.15, "#e6dac3")): parasol((x, dy0 - 2.3, F + 0.05), TIM, flat("cloth" + col, col, 0.9))
    rack((W / 2 + 1.6, dy0 - 1.0, 0), TIM, SN)
    # Snow banked against the walls and drifts on the ground.
    for s in (-1, 1): blob((1.4, D + 1.5, 1.0), (s * (W / 2 + 0.5), 0.5, 0.25), SN, lumps=0.15)
    blob((W + 2, 1.6, 1.0), (0, D / 2 + 0.6, 0.25), SN, lumps=0.15)
    # String lights under the front eaves, side windows with shutters, firewood, steps, lanterns.
    for s in (-1, 1):
        for i in range(15):
            u = (i + 0.5) / 15; x = s * u * (W / 2 + 0.8); z = T + rise * (1 - u * (W / 2 + 0.8) / (W / 2)) - 0.35 - math.sin(u * math.pi * 3) ** 2 * 0.25
            cyl(0.07, 0.14, (x, fy - 0.45, z), LAMP, verts=8, kind="lamp")
    SHUT = flat("shutter", "#3f5a4a", 0.6, grain=0.06)
    for s in (-1, 1):
        for y in (-D / 4, D / 4):
            x = s * (W / 2 + 0.18)
            box((0.1, 1.3, 1.5), (x, y, F + 2.0), WIN, kind="lit")
            box((0.2, 1.55, 0.14), (x + s * 0.05, y, F + 2.8), TIM); box((0.24, 1.6, 0.14), (x + s * 0.06, y, F + 1.2), TIM)
            for t in (-1, 1): box((0.08, 0.68, 1.55), (x + s * 0.12, y + t * 1.05, F + 2.0), SHUT, rot=(0, 0, t * s * 0.15), bevel=0.02)
            blob((0.4, 1.6, 0.16), (x + s * 0.1, y, F + 1.33), SN, lumps=0.02)
    END = wood("logend", "#6b4a2e", "#a07a52", "X")
    for i in range(5):
        for j in range(9): cyl(0.11, 1.0, (W / 2 + 0.75, D / 2 - 1.0 - j * 0.23 - (i % 2) * 0.11, 0.12 + i * 0.2), END, rot=(0, math.pi / 2, 0), verts=8)
    box((1.1, 2.6, 0.08), (W / 2 + 0.75, D / 2 - 2.0, 1.2), ROOF); blob((1.2, 2.7, 0.2), (W / 2 + 0.75, D / 2 - 2.0, 1.33), SN, lumps=0.03)
    for i in range(4): box((2.4, 0.4, 0.22), (-W / 2 + 2.0, dy0 - dd - 0.25 - i * 0.4, F - 0.25 - i * 0.25), ST, bevel=0.03)
    for x in (-W / 2 - 0.2, W / 2 + 0.2):
        box((0.16, 0.16, 1.6), (x, ry, F + 1.4), TIM); box((0.3, 0.3, 0.4), (x, ry, F + 2.35), LAMP, kind="lamp", bevel=0.04)
        box((0.4, 0.4, 0.06), (x, ry, F + 2.58), TIM)
    # The name board over the door.
    box((4.2, 0.14, 0.8), (W / 12 * 1.0 + 0.0, fy - 0.3, T + 0.75), TIM, bevel=0.04)
    text("SUMMIT HOUSE", 0.42, (W / 12, fy - 0.4, T + 0.73), flat("paint_cream", "#ece2cd", 0.6, grain=0))
    finalize("restaurant", 2048)

def picnic(at, DECK, SN, rot=0.0):
    x, y, z = at; c, s = math.cos(rot), math.sin(rot)
    P = lambda dx, dy, dz: (x + dx * c - dy * s, y + dx * s + dy * c, z + dz)
    for k in (-0.3, 0, 0.3): box((1.9, 0.27, 0.06), P(0, k, 0.76), DECK, rot=(0, 0, rot), bevel=0.01)
    for k in (-0.72, 0.72): box((1.9, 0.27, 0.06), P(0, k, 0.45), DECK, rot=(0, 0, rot), bevel=0.01)
    for e in (-0.7, 0.7):
        for t in (-1, 1): box((0.09, 0.09, 1.0), P(e, t * 0.38, 0.4), DECK, rot=(t * 0.55, 0, rot))
        box((0.09, 1.6, 0.09), P(e, 0, 0.4), DECK, rot=(0, 0, rot))
    blob((1.7, 0.75, 0.12), P(0, 0, 0.84), SN, rot=(0, 0, rot), lumps=0.02)

def parasol(at, TIM, CL):
    x, y, z = at; cyl(0.045, 2.7, (x, y, z + 1.35), TIM, verts=8)
    cyl(1.6, 0.6, (x, y, z + 2.55), CL, verts=10, r2=0.05); cyl(1.0, 0.32, (x, y, z + 2.76), snow(), verts=10, r2=0.05, kind="snow")

def rack(at, TIM, SN):
    x, y, z = at
    for s in (-1, 1): box((0.12, 0.6, 1.2), (x, y + s * 1.3, z + 0.6), TIM)
    for zz in (0.25, 1.05): box((0.14, 2.7, 0.12), (x, y, z + zz), TIM)
    cols = ["#3f5a4a", "#8e3b32", "#36506e", "#c9a65a", "#e6dac3", "#2b2f36"]
    for i, c in enumerate(cols): box((0.03, 0.28, 1.55), (x + 0.12, y - 1.05 + i * 0.42, z + 0.85), flat("board" + c, c, 0.4, grain=0), rot=(0, -0.16, 0), bevel=0.012)
    blob((0.3, 2.7, 0.12), (x, y, z + 1.17), SN, lumps=0.02)

def firstaid():
    """The patrol hut: a small log cabin on a stone footing, red cross over the door, a rescue sled."""
    new_col("firstaid")
    W, D, F, T, R = 4.4, 3.8, 0.6, 3.0, 1.6
    ST, LOG, LOGY, TIM, ROOF, SN = stone("stone"), wood("log", "#5a3b26", "#8c6240", "X"), wood("logy", "#5a3b26", "#8c6240", "Y"), wood("timber", "#4a3020", "#6e4a31", "Z"), wood("roof", "#3b2a22", "#54392b", "Y"), snow()
    RED, CREAM, WIN = textured("red", "old_planks_02", 1.2, (1.25, 0.42, 0.36), 0.6, "Z"), flat("paint_cream", "#ece2cd", 0.6, grain=0), lit("window", strength=1.2)
    box((W + 0.3, D + 0.3, F + 0.2), (0, 0, (F - 0.2) / 2), ST, bevel=0.05)
    box((W - 0.3, D - 0.3, T - F), (0, 0, (F + T) / 2), wood("inner", "#3e2a1e", "#553a29"))
    for i in range(int((T - F) / 0.3)):
        z = F + 0.15 + i * 0.3
        for s in (-1, 1): cyl(0.15, D + 0.5, (s * W / 2, 0, z + (0.15 if s > 0 else 0)), LOGY, rot=(math.pi / 2, 0, 0), verts=10)
        for s in (-1, 1): cyl(0.15, W + 0.5, (0, s * D / 2, z + 0.075), LOG, rot=(0, math.pi / 2, 0), verts=10)
    fy = -D / 2 - 0.16
    box((1.0, 0.1, 2.0), (-0.6, fy, F + 1.0), RED, bevel=0.03)
    box((0.95, 0.1, 0.8), (0.95, fy, F + 1.45), WIN, kind="lit")
    for s in (-1, 1): box((0.42, 0.06, 0.85), (0.95 + s * 0.72, fy - 0.03, F + 1.45), RED)
    box((1.1, 0.12, 0.16), (0.95, fy - 0.03, F + 1.0), TIM)
    # The cross on a cream board above the door.
    box((0.9, 0.08, 0.9), (-0.6, fy - 0.05, T - 0.05), CREAM, bevel=0.03)
    box((0.62, 0.06, 0.18), (-0.6, fy - 0.1, T - 0.05), RED); box((0.18, 0.06, 0.62), (-0.6, fy - 0.1, T - 0.05), RED)
    # Gables and the roof.
    for y in (-D / 2, D / 2): tri([(-W / 2, y, T), (W / 2, y, T), (0, y, T + R)], wood("boards", "#4d3424", "#6b4a33", "Z"), thick=0.15 if y > 0 else -0.15)
    a = math.atan2(R, W / 2); over = 0.6; L = (W / 2 + over) / math.cos(a); ridge = Vector((0, 0, T + R + 0.18))
    for s in (-1, 1):
        dv = Vector((s * math.cos(a), 0, -math.sin(a))); nrm = Vector((s * math.sin(a), 0, math.cos(a))); c = ridge + dv * (L / 2)
        box((L, D + 1.2, 0.24), c, ROOF, rot=(0, s * a, 0), bevel=0.03)
        slab((L, D + 1.15, 0.45), c + nrm * 0.33, SN, rot=(0, s * a, 0))
        cyl(0.2, D + 1.15, ridge + dv * L + nrm * 0.3, SN, rot=(math.pi / 2, 0, 0), verts=10)
    cyl(0.28, D + 1.15, ridge + Vector((0, 0, 0.32)), SN, rot=(math.pi / 2, 0, 0), verts=12)
    # A stovepipe, snow banked, a bench, the rescue sled leaning on the wall.
    cyl(0.1, 1.6, (1.0, 0.6, T + R * 0.6 + 0.4), flat("dark", "#1c1f23", 0.5, 0.4, grain=0), verts=10)
    for s in (-1, 1): blob((0.9, D + 0.8, 0.7), (s * (W / 2 + 0.35), 0, 0.2), SN, lumps=0.1)
    blob((W + 1.2, 0.9, 0.7), (0, D / 2 + 0.35, 0.2), SN, lumps=0.1)
    box((1.4, 0.4, 0.07), (1.6, fy - 0.6, 0.45), wood("deck", "#7a5638", "#a37a52", "X"), bevel=0.01)
    for x in (1.05, 2.15): box((0.08, 0.35, 0.45), (x, fy - 0.6, 0.22), TIM)
    sled = box((0.75, 0.25, 2.1), (-W / 2 - 0.45, -0.2, 1.05), flat("sled", "#c8622e", 0.45, grain=0.02), rot=(0, -0.22, 0), bevel=0.11, seg=4)
    for z in (0.6, 1.5): box((0.8, 0.05, 0.05), (-W / 2 - 0.62, -0.2, z), flat("dark", "#1c1f23", 0.5, 0.4, grain=0), rot=(0, -0.22, 0))
    text("SKI PATROL", 0.18, (0.95, fy - 0.08, T - 0.25), CREAM, extrude=0.01)
    finalize("firstaid", 1024, ao_dist=1.0)

MODELS = {"restaurant": restaurant, "firstaid": firstaid}
