"""Signature buildings of the real Colorado resorts: the base-village blocks every resort needs, and the
lodges people know each resort by (Sunspot, Thunderhead, the Sundeck, the Aerie, Merry-Go-Round), with the
Silver Queen's top terminal. The look and sizes follow docs/research/facilities.md and the photos named in
each docstring; the parts come from buildings.py (frames, roofs, windows, doors, trusses) and stations.py.

Origins on the ground at the middle of the footprint, fronts facing −Y, metres. Where a lift's rope enters a
building its line is in the docstring and in glb/signature.json ("rope": [half gauge, height])."""
import math
import bpy, bmesh
from mathutils import Vector
from lib import *
import lib
import buildings as B
import stations as S

PI = math.pi
Frame, W0 = B.Frame, B.W0

# ---------- materials ----------
def mats():
    """The building palette plus the village's render, coloured boards, metal roofs and dark cladding."""
    M = B.mats()
    M.update(
        tan=flat("render_tan", "#c8b38e", 0.92, grain=0.07), ivory=flat("render_cream", "#ddd2bb", 0.92, grain=0.06),
        taupe=flat("render_taupe", "#9a8f80", 0.9, grain=0.07),
        red=textured("boards_red", "old_planks_02", 1.8, (1.08, 0.6, 0.48), 0.85, "Z"),
        sage=textured("boards_sage", "old_planks_02", 1.8, (0.72, 0.78, 0.7), 0.85, "Z"),
        lap=textured("lap_dark", "old_planks_02", 1.4, (0.5, 0.52, 0.5), 0.85, "X"),
        brown=textured("boards_brown", "old_planks_02", 1.6, (0.55, 0.44, 0.36), 0.85, "Z"),
        honey=textured("glulam", "fine_grained_wood", 1.2, (1.6, 1.15, 0.7), 0.7, "X"),
        honeyz=textured("glulamz", "fine_grained_wood", 1.2, (1.6, 1.15, 0.7), 0.7, "Z"),
        galv=flat("galv_roof", "#9da3a7", 0.45, grain=0.05), seam=flat("seam", "#7d8388", 0.5, grain=0),
        green=flat("roof_green", "#3e4a42", 0.6, grain=0.04), char=flat("char_panel", "#33373b", 0.6, grain=0.03),
        steel2=flat("steel_grey", "#5f656b", 0.5, grain=0.03), conc=flat("concrete", "#a9a49c", 0.92, grain=0.12),
        blue=flat("roof_blue", "#3b6a9a", 0.5, grain=0.03), rust=flat("rust_trim", "#a5532e", 0.6, grain=0.03),
        sign=flat("sign_dark", "#2e3236", 0.6, grain=0))
    return M

# ---------- parts ----------
def win(f, x, z, w, h, M, y=0.0, cols=2, fr="tim", snow=True):
    """A plain framed window (lighter than buildings.window, for walls with many): lit glass, jambs, head,
    sill with a crust of snow, mullions."""
    FR = M[fr]
    f.box((w, 0.06, h), (x, y - 0.02, z + h / 2), M["win"], kind="lit")
    for s in (-1, 1): f.box((0.1, 0.14, h + 0.1), (x + s * (w / 2 + 0.03), y - 0.06, z + h / 2), FR)
    f.box((w + 0.3, 0.18, 0.12), (x, y - 0.08, z + h + 0.06), FR)
    f.box((w + 0.3, 0.22, 0.07), (x, y - 0.1, z - 0.03), FR)
    for k in range(1, cols): f.box((0.05, 0.08, h), (x - w / 2 + k * w / cols, y - 0.05, z + h / 2), FR)
    if snow: f.box((w + 0.2, 0.2, 0.08), (x, y - 0.12, z + 0.03), M["sn"], bevel=0.035, seg=1, kind="snow")

def balcony(f, x, z, w, d, M, y=0.0, posts=True):
    """A timber balcony on two knee braces: deck, rail with balusters, snow on the rail and the deck."""
    TIM = M["tim"]
    f.box((w, d, 0.2), (x, y - d / 2, z - 0.1), TIM)
    for s in (-1, 1):
        f.box((0.12, 0.12, 1.1), (x + s * (w / 2 - 0.06), y - d + 0.06, z + 0.55), TIM)
        f.box((0.1, d, 0.1), (x + s * (w / 2 - 0.06), y - d / 2, z + 1.05), TIM)
        f.box((0.1, 0.1, 1.3), (x + s * (w / 2 - 0.3), y - d * 0.45, z - 0.6), TIM, rot=(-0.75, 0, 0))
    f.box((w, 0.12, 0.1), (x, y - d + 0.06, z + 1.05), TIM)
    f.box((w, 0.08, 0.08), (x, y - d + 0.06, z + 0.15), TIM)
    n = int(w / 0.32)
    for k in range(n): f.box((0.05, 0.05, 0.85), (x - w / 2 + 0.1 + k * (w - 0.2) / (n - 1), y - d + 0.06, z + 0.6), TIM)
    f.box((w + 0.04, 0.2, 0.1), (x, y - d + 0.06, z + 1.14), M["sn"], bevel=0.04, seg=1, kind="snow")
    f.box((w - 0.4, d * 0.6, 0.14), (x, y - d * 0.55, z + 0.03), M["sn"], bevel=0.06, seg=1, kind="snow")

def shopfront(f, x, w, h, M, name, z0=0.3, y=0.0):
    """A shop under the flats: a lit storefront in a timber frame, a glazed door, the sign board over it,
    a little shed canopy on brackets with snow on it."""
    TIM = M["tim"]; gh = h - 1.1
    f.box((w, 0.06, gh), (x, y - 0.02, z0 + 0.45 + gh / 2), M["win"], kind="lit")
    f.box((w + 0.2, 0.2, 0.45), (x, y - 0.06, z0 + 0.22), TIM)
    f.box((w + 0.2, 0.18, 0.14), (x, y - 0.08, z0 + 0.45 + gh), TIM)
    for k in range(4): f.box((0.09, 0.12, gh), (x - w / 2 + k * w / 3, y - 0.06, z0 + 0.45 + gh / 2), TIM)
    f.box((w, 0.1, 0.07), (x, y - 0.07, z0 + 0.45 + gh * 0.78), TIM)
    B.door(f, x + w / 3, z0, 1.1, 2.3, M, glazed=True, y=y - 0.12)
    sz = z0 + 0.45 + gh + 0.45
    f.box((min(w, 3.2), 0.1, 0.55), (x, y - 0.1, sz), M["sign"], bevel=0.02)
    text(name, 0.3, f.p(x, y - 0.17, sz), M["cream"], rot=(PI / 2, 0, f.a), extrude=0.01)
    a = 0.3; dd = 1.3; cz = sz + 0.55
    f.box((w + 0.4, dd, 0.1), (x, y - dd / 2, cz), M["roof"], rot=(a, 0, 0))
    f.box((w + 0.35, dd - 0.1, 0.22), (x, y - dd / 2, cz + 0.15), M["sn"], rot=(a, 0, 0), bevel=0.08, seg=2, kind="snow")
    for s in (-1, 1): f.box((0.08, 0.08, 1.2), (x + s * w / 2, y - 0.45, cz - 0.4), TIM, rot=(0.75, 0, 0))

def stack(x, y, z0, h, M, w=1.2, d=1.6):
    """A stone chimney stack rising through a roof from z0, clay flues and a cap of snow."""
    box((w, d, h), (x, y, z0 + h / 2), M["st"], bevel=0.04)
    box((w + 0.14, d + 0.14, 0.14), (x, y, z0 + h), M["st"], bevel=0.03)
    for k in (-1, 1): cyl(0.12, 0.45, (x, y + k * 0.35, z0 + h + 0.25), flat("clay", "#7d4a3a", 0.8, grain=0.08), verts=10)
    B.pad((w, d - 0.1, 0.2), (x, y, z0 + h + 0.18), M["sn"])

def ridge_vents(xs, y, z, M):
    for x in xs: box((0.5, 0.5, 0.35), (x, y, z), M["steel"], bevel=0.03); B.pad((0.55, 0.55, 0.12), (x, y, z + 0.22), M["sn"])

# ---------- the base village ----------
VILLAGE = {
    # Copper's Center Village: stone shops, tan render above with timber bays, grey roofs and dormers.
    "village_block_a": dict(L=40.0, D=16.0, up=3, wall="tan", accent="boards", fr="tim", pitch=0.66,
                            bays="wbgwbwgbw", signs=["SPORTS", "CAFE", "RENTALS", "MARKET", "BAR & GRILL", "GALLERY", "TICKETS"]),
    # Steamboat's Gondola Square / Highlands Village: red-brown timber over stone, cream render bays, balconies.
    "village_block_b": dict(L=34.0, D=16.0, up=4, wall="red", accent="ivory", fr="tim", pitch=0.8,
                            bays="bwgwbwgb", signs=["SKI SHOP", "COFFEE", "OUTFITTERS", "PIZZA", "BOUTIQUE"]),
    # Winter Park Village / Snowmass Base Village: sage board-and-batten over stone, cream bays, one big gable.
    "village_block_c": dict(L=24.0, D=14.0, up=2, wall="sage", accent="ivory", fr="tim", pitch=0.75,
                            bays="wbGbw", signs=["DELI", "RENTALS", "SPORTS"]),
}

def _village(name):
    """A base-village building: shops behind stone piers on the ground floor, flats above in render or
    timber with balconies and cross-gabled bays, a steep shingled roof with dormers under deep snow,
    stone chimneys, lit windows. Bays: w windows, b balconies, g a cross gable, G a wide glazed gable."""
    P = VILLAGE[name]; new_col(name); M = mats(); B.anchor(M)
    L, D, up = P["L"], P["D"], P["up"]
    ST, TIM, SN, WALL, ACC = M["st"], M["tim"], M["sn"], M[P["wall"]], M[P["accent"]]
    F0, G, FH = 0.3, 4.4, 3.0; T = G + up * FH; R = D / 2 * P["pitch"]
    box((L + 0.5, D + 0.5, F0), (0, 0, F0 / 2), ST, bevel=0.04)
    box((L, D, G - F0), (0, 0, (F0 + G) / 2), ST)
    box((L - 0.1, D - 0.1, T - G), (0, 0, (G + T) / 2), WALL)
    box((L + 0.3, D + 0.3, 0.3), (0, 0, G), TIM, bevel=0.03)
    for sx in (-1, 1):
        for sy in (-1, 1): box((0.28, 0.28, T - G), (sx * L / 2, sy * D / 2, (G + T) / 2), TIM)
    for k in range(1, up): box((L + 0.12, D + 0.12, 0.14), (0, 0, G + k * FH), TIM)  # floor bands
    bays = P["bays"]; nb = len(bays); bw = L / nb
    fr, bk = Frame((0, -D / 2, 0)), Frame((0, D / 2, 0), PI)
    gables = []
    for i, t in enumerate(bays):
        x = -L / 2 + bw * (i + 0.5)
        shopfront(fr, x, bw - 1.1, G - 0.3, M, P["signs"][i % len(P["signs"])])
        if i < nb - 1: fr.box((0.6, 0.35, G - F0), (x + bw / 2, -0.1, (F0 + G) / 2), ST, bevel=0.03)  # stone piers
        for k in range(up):
            z = G + k * FH + 0.75
            if t == "w":
                for s in (-1, 1): win(fr, x + s * bw * 0.22, z, 1.1, 1.65, M)
            elif t == "b":
                fr.box((bw - 0.5, 0.08, FH - 0.1), (x, -0.04, G + k * FH + FH / 2), ACC)
                win(fr, x, z - 0.45, 1.9, 2.2, M, y=-0.08, cols=3, snow=False)
                balcony(fr, x, G + k * FH + 0.15, bw - 0.7, 1.4, M, y=-0.08)
        if t in "gG": gables.append((x, bw if t == "g" else bw * 1.35, t == "G"))
        bx = x  # the back: windows only, and a service door every other bay
        for k in range(up):
            for s in (-1, 1): win(bk, -bx + s * bw * 0.22, G + k * FH + 0.75, 1.1, 1.65, M, snow=False)
        if i % 2: B.door(bk, -bx, F0, 1.0, 2.2, M, lite=True)
        else: win(bk, -bx, 1.2, 2.0, 1.8, M, cols=2)
    # Cross gables: a bay standing forward of the wall up to the roof, its own steep roof and gable.
    for x, w, glazed in gables:
        Pd = 1.3; yf = -D / 2 - Pd; rise = w / 2 * 1.0
        box((w, Pd + 0.2, T - G + 0.2), (x, -D / 2 - Pd / 2 + 0.05, (G + T) / 2), ACC)
        g = Frame((x, yf, 0))
        for s in (-1, 1): g.box((0.24, 0.24, T - G), (s * w / 2, -0.02, (G + T) / 2), TIM)
        B.gable_wall(g, w, 0, T, rise, ACC, 0.2)
        B.gable_roof(Frame((x, 0, 0)), w, yf - 0.6, -D / 2 + rise * 1.6, T, rise, 0.55, M, thick=0.3, st=0.55, ice=8, ends=(True, False))
        for k in range(up):
            z = G + k * FH + 0.6
            if glazed: g.box((w - 0.6, 0.06, FH - 0.5), (0, -0.02, z + (FH - 0.5) / 2 - 0.1), M["win"], kind="lit")
            else: win(g, 0, z, w - 1.4, 1.9, M, cols=3)
        if glazed:
            for xx in range(-2, 3): g.box((0.12, 0.16, T - G - 0.2), (xx * (w - 0.6) / 4, -0.06, (G + T) / 2), TIM)
            for k in range(up): balcony(g, 0, G + k * FH + 0.15, w - 0.4, 1.2, M)
        win(g, 0, T + 0.5, 1.0, 1.1, M, cols=1, snow=False)
        B.truss(g, w, -0.2, T + 0.1, rise - 0.35, M, r=0.22)
    # The main roof: ridge along X, dormers on the front slope between the gables, chimneys.
    ma, mtop = B.gable_roof(Frame((0, 0, 0), PI / 2), D, -L / 2 - 0.9, L / 2 + 0.9, T, R, 1.1, M, thick=0.36, st=0.62, ice=16)
    u = D / 2 - 2.2
    for i, t in enumerate(bays):
        if t == "w": B.dormer(W0, -L / 2 + bw * (i + 0.5), -u, mtop(u), math.tan(ma), 2.4, M, hw=1.9, drise=0.9, wall=ACC)
    for x in (-L * 0.3, L * 0.22): stack(x, 1.2, mtop(1.2) - 0.6, 2.4, M)
    # Gable ends: windows each floor, a small one high in the gable, a lantern by the end door.
    for s in (-1, 1):
        g = Frame((s * (L / 2 + 0.05), 0, 0), s * PI / 2)
        B.gable_wall(g, D + 0.1, 0, T, R, WALL, 0.2)
        for k in range(up):
            for x in (-D * 0.28, 0, D * 0.28): win(g, x, G + k * FH + 0.75, 1.1, 1.65, M)
        win(g, 0, T + R * 0.35, 1.3, 1.4, M, cols=2, snow=False)
        win(g, -D * 0.25, 1.1, 2.4, 2.0, M, cols=3); B.door(g, D * 0.2, F0, 1.6, 2.4, M, double=True, glazed=True)
        B.lantern(g, D * 0.2 + 1.3, 2.5, M)
    B.drifts([(0, D / 2 + 0.7, L + 1.5, 1.6), (-L / 2 - 0.7, 0, 1.4, D), (L / 2 + 0.7, 0, 1.4, D)], M, h=0.7)
    for x in (-L / 2 + 2, L / 2 - 2): blob((3.0, 1.2, 0.5), (x, -D / 2 - 2.4, 0.1), SN, lumps=0.08)
    finalize(name, 2048, ao_dist=1.5)

def village_block_a(): _village("village_block_a")
def village_block_b(): _village("village_block_b")
def village_block_c(): _village("village_block_c")

# ---------- Winter Park: The Lodge at Sunspot ----------
def logwall(x0, y0, x1, y1, z0, z1, M, r=0.17, step=0.34, phase=0.0):
    """A wall of round logs from (x0, y0) to (x1, y1), courses from z0 to z1, ends running past the corners."""
    L = math.hypot(x1 - x0, y1 - y0); a = math.atan2(y1 - y0, x1 - x0); mat = M["log"] if abs(math.cos(a)) > 0.7 else M["logy"]
    for i in range(int((z1 - z0) / step)):
        z = z0 + r + i * step + phase
        cyl(r, L + 0.7, ((x0 + x1) / 2, (y0 + y1) / 2, z), mat, rot=(0, PI / 2, a), verts=10)

def lograil(x0, y0, x1, y1, z, M, post=2.0):
    """A rustic log railing: log posts, two log rails, snow along the top."""
    L = math.hypot(x1 - x0, y1 - y0); a = math.atan2(y1 - y0, x1 - x0); n = max(1, round(L / post))
    for k in range(n + 1):
        t = k / n; cyl(0.11, 1.15, (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z + 0.57), M["logy"], verts=8)
    for h, r in ((1.05, 0.09), (0.55, 0.07)): cyl(r, L, ((x0 + x1) / 2, (y0 + y1) / 2, z + h), M["log"], rot=(0, PI / 2, a), verts=8)
    box((L, 0.2, 0.12), ((x0 + x1) / 2, (y0 + y1) / 2, z + 1.17), M["sn"], rot=(0, 0, a), bevel=0.05, seg=1, kind="snow")

def sunspot_lodge():
    """The Lodge at Sunspot, at the top of Winter Park's Gondola (10,700 ft): a big log-and-stone lodge.
    A stacked-stone ground storey, honey round-log walls above, three steep heavy-timber gables across the
    front with glass gable ends and log trusses, a stone chimney tower with a little cupola at the east end,
    cedar-shingle roofs under deep snow, and a log-railed terrace facing the Divide. The middle gable is the
    entrance: stacked stone from the snow to the peak, glazed doors in a timber portal, with the stone chimney
    tower rising right behind its peak to a lit cupola, and a second, timber cupola on the main ridge.
    Sources: winterparkresort.com Sunspot hero photo (entrance gable, tower and cupolas), liftblog.com The
    Gondola (Winter Park) photos (2019-01, the lodge beyond the top terminal); OSM gives only a point, so the
    size (about 34 x 18 m plus the gables) is an estimate."""
    new_col("sunspot_lodge"); M = mats(); B.anchor(M)
    ST, TIM, SN, LOGY = M["st"], M["tim"], M["sn"], M["logy"]
    W, D, G, T, R = 34.0, 18.0, 3.6, 7.8, 6.2
    fy = -D / 2
    box((W + 0.5, D + 0.5, G), (0, 0, G / 2), ST, bevel=0.06)
    box((W + 0.7, D + 0.7, 0.2), (0, 0, G - 0.05), TIM, bevel=0.03)
    box((W - 0.4, D - 0.4, T - G), (0, 0, (G + T) / 2), M["inner"])
    logwall(-W / 2, D / 2, W / 2, D / 2, G, T, M); logwall(-W / 2, fy, W / 2, fy, G, T, M)
    for s in (-1, 1): logwall(s * W / 2, -D / 2, s * W / 2, D / 2, G, T, M, phase=0.17)
    # The back and the ends: stone storey windows, log storey windows.
    bk = Frame((0, D / 2 + 0.25, 0), PI)
    for x in (-13, -8, -3, 3, 8, 13):
        win(bk, x, 0.9, 1.6, 1.6, M, cols=2); B.window(Frame((0, D / 2 + 0.17, 0), PI), x, G + 1.0, 1.6, 2.4, M, cols=2)
    for s in (-1, 1):
        e = Frame((s * (W / 2 + 0.25), 0, 0), s * PI / 2)
        for x in (-5, 0, 5): win(e, x, 0.9, 1.5, 1.6, M)
        B.gable_wall(Frame((s * (W / 2 + 0.05), 0, 0), s * PI / 2), D + 0.4, 0, T, R, M["boards"], 0.2)
        B.window(Frame((s * (W / 2 + 0.2), 0, 0), s * PI / 2), 0, T + 0.8, 2.0, 2.2, M, cols=2, transom=0)
    for x in (-6.2, 6.2): B.window(Frame((0, fy - 0.17, 0)), x, G + 1.0, 1.2, 2.4, M, cols=1)
    # The main roof, two dormers on the back slope.
    ma, mtop = B.gable_roof(Frame((0, 0, 0), PI / 2), D, -W / 2 - 1.3, W / 2 + 1.3, T, R, 1.5, M, thick=0.42, st=0.72, ice=44)
    for x in (-8, 8): B.dormer(Frame((0, 0, 0), PI), x, -5.6, mtop(5.6), math.tan(ma), 2.6, M, hw=2.0, drise=1.0)
    # Three heavy-timber gables across the front.
    P = 3.2; yf = fy - P
    for x, w in ((-11.0, 8.0), (0.0, 11.0), (11.0, 8.0)):
        rise = w / 2 * 1.0; g = Frame((x, yf, 0))
        box((w, P + 0.3, G), (x, fy - P / 2 + 0.1, G / 2), ST, bevel=0.05)
        box((w - 0.4, P, T - G), (x, fy - P / 2 + 0.2, (G + T) / 2), M["inner"])
        for s in (-1, 1): logwall(x + s * w / 2, fy, x + s * w / 2, yf, G, T, M, phase=0.17)
        a = math.atan2(rise, w / 2)
        if x == 0:  # the entrance gable: stone from the snow to the peak, a timber portal round the doors
            g.box((w + 0.3, 0.7, T), (0, 0.05, T / 2), ST, bevel=0.05)
            g.prism([(-w / 2 - 0.15, 0.4, T), (w / 2 + 0.15, 0.4, T), (0, 0.4, T + rise + 0.1)], 0.7, ST)
            g.box((5.6, 0.3, 3.3), (0, -0.34, 1.95), M["inner"])
            B.door(g, -1.3, 0.3, 2.2, 2.6, M, double=True, glazed=True, y=-0.45); B.door(g, 1.3, 0.3, 2.2, 2.6, M, double=True, glazed=True, y=-0.45)
            g.box((0.3, 0.4, 0.4), (0, -0.55, 3.15), TIM)
            for xx in (-2.95, 2.95): g.box((0.42, 0.5, 3.4), (xx, -0.5, 1.75), TIM, bevel=0.03)
            g.box((6.6, 0.55, 0.5), (0, -0.55, 3.6), TIM, bevel=0.03)
            for xx in (-2.2, 2.2): g.box((0.3, 0.5, 0.9), (xx, -0.55, 4.3), TIM)
            g.box((6.0, 0.5, 0.4), (0, -0.55, 4.9), TIM, bevel=0.03)
            win(g, 0, T - 1.2, 2.6, 2.4, M, cols=3, y=-0.35)
            for xx in (-4.0, 4.0): g.box((1.1, 0.12, 0.8), (xx, -0.4, 2.2), M["sign"], bevel=0.02)
            g.box((4.4, 0.14, 0.6), (0, -0.84, 5.6), M["sign"], bevel=0.03)
            text("THE LODGE AT SUNSPOT", 0.28, g.p(0, -0.92, 5.6), M["cream"], rot=(PI / 2, 0, 0), extrude=0.01)
            for s in (-1, 1): g.box((math.hypot(w / 2, rise) + 0.9, 0.5, 0.45), (s * w / 4, -0.45, T + rise / 2 + 0.1), TIM, rot=(0, s * a, 0), bevel=0.03)
        else:
            g.box((w - 0.7, 0.08, T - G - 0.25), (0, 0.15, (G + T) / 2), M["win"], kind="lit")
            g.prism([(-w / 2, 0.18, T), (w / 2, 0.18, T), (0, 0.18, T + rise)], 0.05, M["win"], kind="lit")
            nm = round(w / 1.6)
            for k in range(1, nm): g.box((0.16, 0.2, T - G), (-w / 2 + k * w / nm, 0.06, (G + T) / 2), TIM)
            g.box((w, 0.22, 0.16), (0, 0.06, G + 2.7), TIM)
            for k in range(1, 4):
                xx = -w / 2 + k * w / 4; hh = rise * (1 - abs(xx) / (w / 2)) - 0.1; g.box((0.16, 0.22, hh), (xx, 0.06, T + hh / 2), TIM)
            for s in (-1, 1):
                g.cyl(0.3, T - G - 0.9, (s * (w / 2 - 0.1), -0.35, (G + 0.9 + T) / 2), LOGY, verts=12)
                g.box((0.9, 0.9, 0.9), (s * (w / 2 - 0.1), -0.35, G + 0.45), ST, bevel=0.05); g.pad((0.85, 0.85, 0.14), (s * (w / 2 - 0.1), -0.35, G + 0.95), SN)
                g.box((math.hypot(w / 2, rise) + 0.6, 0.34, 0.34), (s * w / 4, -0.2, T + rise / 2), TIM, rot=(0, s * a, 0), bevel=0.03)
                g.box((0.24, 0.24, 1.9), (s * (w / 2 - 0.75), -0.35, T - 0.75), TIM, rot=(0, -s * 0.75, 0))
            B.truss(g, w + 0.3, -0.35, T + 0.05, rise - 0.45, M, r=0.32)
            for xx in (-2.0, 2.0): win(g, xx, 0.9, 2.2, 1.7, M, cols=3, y=-0.2)
        B.gable_roof(Frame((x, 0, 0)), w, yf - 1.4, fy + rise / (R / (D / 2)) + 0.8, T, rise, 0.95, M, thick=0.42, st=0.7, ice=12, ends=(True, False))
    # The chimney tower right behind the entrance gable's peak: stacked stone up through the roofs to a lit
    # cupola of log posts under a pyramid roof.
    cx, cy, cw, ch = 0.0, fy + 1.6, 4.2, 17.4
    box((cw, cw, ch - 6.0), (cx, cy, 6.0 + (ch - 6.0) / 2), ST, bevel=0.06)
    box((cw + 0.5, cw + 0.5, 0.35), (cx, cy, ch), ST, bevel=0.05)
    box((cw + 0.3, cw + 0.3, 0.3), (cx, cy, ch - 2.4), ST, bevel=0.04)
    win(Frame((cx, cy - cw / 2, 0)), 0, ch - 2.0, 1.0, 1.5, M, cols=1, snow=False)
    for s in (-1, 1): win(Frame((cx + s * cw / 2, cy, 0), s * PI / 2), 0, ch - 2.0, 1.0, 1.5, M, cols=1, snow=False)
    cz = ch + 0.18
    for sx in (-1, 1):
        for sy in (-1, 1): cyl(0.16, 2.3, (cx + sx * 1.5, cy + sy * 1.5, cz + 1.15), LOGY, verts=10)
    for s in (-1, 1): box((3.4, 0.24, 0.26), (cx, cy + s * 1.5, cz + 2.35), TIM); box((0.24, 3.4, 0.26), (cx + s * 1.5, cy, cz + 2.35), TIM)
    box((2.6, 2.6, 1.8), (cx, cy, cz + 1.0), M["win"], kind="lit")
    cyl(3.0, 2.2, (cx, cy, cz + 3.55), M["roof"], verts=4, r2=0.05, rot=(0, 0, PI / 4))
    cyl(2.9, 1.9, (cx, cy, cz + 3.65), SN, verts=4, r2=0.2, rot=(0, 0, PI / 4), kind="snow")
    cyl(0.05, 1.0, (cx, cy, cz + 5.0), M["steel"], verts=6)
    B.pad((cw + 0.2, cw + 0.2, 0.3), (cx, cy, ch + 0.2), SN)
    B.chimney(-W / 2 - 0.95, 3.0, T + R + 1.2, M, w=1.8, d=2.2, step=G + 1.8)
    # The second cupola, timber-boarded under a pyramid roof, on the main ridge east of the tower.
    kx, ky = 8.5, 0.0; kz = mtop(0.0) - 0.4
    box((2.2, 2.2, 2.0), (kx, ky, kz + 1.0), M["boards"])
    for sx in (-1, 1):
        for sy in (-1, 1): box((0.18, 0.18, 2.0), (kx + sx * 1.05, ky + sy * 1.05, kz + 1.0), TIM)
    for s in (-1, 1): win(Frame((kx, ky + s * 1.12, 0), 0 if s < 0 else PI), 0, kz + 0.7, 1.0, 0.8, M, cols=2, snow=False)
    cyl(2.0, 1.3, (kx, ky, kz + 2.65), M["roof"], verts=4, r2=0.05, rot=(0, 0, PI / 4))
    cyl(1.9, 1.1, (kx, ky, kz + 2.75), SN, verts=4, r2=0.2, rot=(0, 0, PI / 4), kind="snow")
    # The terrace before the gables, on the snow: flagstones, a split-log fence with a gap at the entrance,
    # tables and parasols, ski racks.
    dy0, dd = yf, 7.0; dx0, dx1 = -W / 2 - 0.5, W / 2 + 0.5
    box((dx1 - dx0, dd, 0.2), ((dx0 + dx1) / 2, dy0 - dd / 2 + 0.3, 0.1), ST, bevel=0.03)
    ry = dy0 - dd + 0.3
    lograil(dx0, ry, -3.0, ry, 0.1, M); lograil(3.0, ry, dx1, ry, 0.1, M)
    for x in (dx0, dx1): lograil(x, ry, x, fy, 0.1, M)
    for i, x in enumerate((-13, -6, 6, 13)): B.picnic((x, dy0 - 3.4, 0.2), M["deck"], SN, rot=0.06 * (i - 1.5))
    for x, col in ((-9.5, "#8e3b32"), (9.5, "#e6dac3")): B.parasol((x, dy0 - 3.4, 0.2), TIM, flat("cloth" + col, col, 0.9), SN)
    for x in (-15, 15): B.rack((x, ry - 2.0, 0), TIM, SN, rot=PI / 2)
    B.drifts([(0, D / 2 + 0.8, W + 3, 1.8), (-W / 2 - 0.8, 0, 1.6, D), (W / 2 + 0.8, 0, 1.6, D)], M, h=0.9)
    finalize("sunspot_lodge", 2048, ao_dist=1.5)

# ---------- Steamboat: Thunderhead Lodge with the gondola terminal built in ----------
def shifted(fn, dx=0.0, dy=0.0, dz=0.0):
    """Run a part-maker that builds about the origin (stations.machinery) and move what it made."""
    before = set(lib.COL.objects); fn()
    for o in lib.COL.objects:
        if o not in before: o.location.x += dx; o.location.y += dy; o.location.z += dz

def steel_rail(p0, p1, z, M, h=1.1, snow=True):
    S.railing(p0, p1, z, dict(galv=M["steel2"], snow=M["sn"]), h=h, snowcap=snow)

def glass_gable(f, w, z0, T, rise, M, cols=8, rows=(2.6, 5.2)):
    """A gable end glazed from z0 to the ridge in a dark steel grid (Thunderhead's view walls)."""
    f.box((w - 0.4, 0.08, T - z0), (0, 0.05, (z0 + T) / 2), M["win"], kind="lit")
    f.prism([(-w / 2 + 0.2, 0.08, T), (w / 2 - 0.2, 0.08, T), (0, 0.08, T + rise - 0.2)], 0.05, M["win"], kind="lit")
    for k in range(cols + 1):
        x = -w / 2 + 0.2 + k * (w - 0.4) / cols; h = T - z0 + rise * (1 - abs(x) / (w / 2)) - 0.2
        f.box((0.14, 0.16, h), (x, -0.02, z0 + h / 2), M["char"])
    for z in [z0 + r for r in rows] + [T]:
        hw = w / 2 - 0.2 if z <= T else (w / 2) * (1 - (z - T) / rise)
        f.box((2 * hw, 0.16, 0.16), (0, -0.02, z), M["char"])
    a = math.atan2(rise, w / 2)
    for s in (-1, 1): f.box((math.hypot(w / 2, rise) + 0.4, 0.3, 0.45), (s * w / 4, -0.12, T + rise / 2), M["tim"], rot=(0, s * a, 0))

def thunderhead_lodge():
    """Thunderhead Lodge, at the top of the Steamboat Gondola: two big halls whose valley-side gable ends are
    glazed from the first floor to the ridge in dark steel grids, taupe render over a red-brown ground storey,
    charcoal metal roofs; the gondola's top terminal built into the east end, its blue standing-seam hood
    reaching out over the slope on two grey columns, with a steel stair tower; timber-gabled entrances on
    the uphill side. Sources: liftblog.com Steamboat Gondola photos (2019). OSM gives only a point: about
    48 x 24 m plus the terminal.
    Rope: the cabins arrive from +Y on x = 22.5 +- 3.0 at z = 9.5 and turn round the bullwheel at y = 0."""
    new_col("thunderhead_lodge"); M = mats(); B.anchor(M)
    M["rubber"], M["dark"] = flat("rubber", "#26282b", 0.85, grain=0.04), flat("dark2", "#2a2d31", 0.5, grain=0.03)
    TIM, SN, TAU, RED = M["tim"], M["sn"], M["taupe"], M["red"]
    D, G, T = 24.0, 4.2, 9.0
    halls = ((-12.0, 22.0, 0.0), (8.0, 16.0, 3.0))  # (centre x, width, how far the hall stands back at the front)
    box((50.0, D + 0.6, 0.35), (-3.0, 0, 0.17), M["conc"], bevel=0.03)
    for xc, w, back in halls:
        y0 = -D / 2 + back; dd = D - back; yc = (y0 + D / 2) / 2; rise = w / 2 * 0.58
        box((w, dd, G - 0.35), (xc, yc, (0.35 + G) / 2), RED)
        box((w + 0.25, dd + 0.25, 0.3), (xc, yc, G), TIM)
        box((w - 0.1, dd - 0.1, T - G), (xc, yc, (G + T) / 2), TAU)
        g = Frame((xc, D / 2 + 0.06, 0), PI)
        glass_gable(g, w, G + 0.4, T, rise, M)
        B.gable_wall(Frame((xc, y0 - 0.02, 0)), w, 0, T, rise, TAU, 0.2)
        for x in (-w / 2 + 2.5, w / 2 - 2.5): win(Frame((xc, y0 - 0.02, 0)), x, G + 1.3, 1.6, 2.2, M, cols=2)
        win(Frame((xc, y0 - 0.02, 0)), 0, T + 1.0, 2.6, 1.6, M, cols=3, snow=False)
        for x in (-w / 2 + 2, -w / 4, w / 4): win(g, x, 1.0, 2.6, 2.2, M, cols=3, fr="char")
        B.gable_roof(Frame((xc, 0, 0)), w, y0 - 1.0, D / 2 + 1.4, T, rise, 1.1, M, thick=0.34, st=0.6, ice=20)
        for s in (-1, 1):
            e = Frame((xc + s * (w / 2 + 0.03), yc, 0), s * PI / 2)
            for k in range(int(dd / 4.2)):
                x = -dd / 2 + 2.1 + k * 4.2
                if s > 0 and xc > 0: continue
                win(e, x, G + 1.3, 1.6, 2.2, M, cols=2); win(e, x, 1.2, 1.6, 1.9, M, cols=2)
        for y in (y0 + 5, D / 2 - 5): ridge_vents([xc], y, T + rise - (0 if True else 0) + 0.1, M)
    # The link between the halls: a flat-roofed lower block.
    box((2.2, D - 4, T - 2.0), (-0.0, 0.5, (T - 2.0) / 2), TAU)
    box((2.6, D - 3.6, 0.4), (0, 0.5, T - 1.9), M["char"]); B.pad((2.4, D - 4, 0.4), (0, 0.5, T - 1.6), SN)
    # Timber-gabled entrances on the uphill side (-Y): the main door and the gondola's exit.
    for xc, yfront in ((-12.0, -D / 2), (22.5, -6.2)):
        ey1 = yfront - 3.6; ew = 6.0
        for x in (-ew / 2, ew / 2):
            box((0.7, 0.7, 0.8), (xc + x, ey1 + 0.3, 0.4), M["st"], bevel=0.04)
            box((0.42, 0.42, 3.6), (xc + x, ey1 + 0.3, 2.6), TIM, bevel=0.03)
            box((0.32, yfront - ey1, 0.4), (xc + x, (yfront + ey1) / 2, 4.5), TIM)
        box((ew + 0.6, 0.4, 0.5), (xc, ey1 + 0.3, 4.5), TIM, bevel=0.03)
        B.truss(Frame((xc, ey1 + 0.3, 0)), ew, -0.02, 4.85, 2.0, M, r=0.26)
        B.gable_roof(Frame((xc, 0, 0)), ew, ey1 - 0.5, yfront + 0.2, 4.75, 2.4, 0.6, M, thick=0.3, st=0.55, ice=6, ends=(True, False))
        f = Frame((xc, yfront - 0.05, 0))
        B.door(f, -1.2, 0.35, 2.0, 2.5, M, double=True, glazed=True); B.door(f, 1.2, 0.35, 2.0, 2.5, M, double=True, glazed=True)
    box((5.0, 0.14, 0.7), (-12.0, -D / 2 - 3.42, 4.05), M["sign"], bevel=0.03)
    text("THUNDERHEAD", 0.4, (-12.0, -D / 2 - 3.5, 4.05), M["cream"], extrude=0.01)
    # The gondola terminal: a block at the east end carrying the station floor at 7.6 m; the blue hood over
    # the bullwheel and the platform, reaching out over the slope on two columns.
    tx, tw, ty0, ty1, zf, z0, zr = 22.5, 11.0, -6.0, 19.5, 7.4, 8.6, 9.5
    box((tw, 12.0 - ty0, zf), (tx, (ty0 + 12.0) / 2, zf / 2), TAU)
    box((tw + 0.2, 12.0 - ty0 + 0.2, G), (tx, (ty0 + 12.0) / 2, G / 2), RED)
    for y in (ty0 + 3, ty0 + 8, ty0 + 13): win(Frame((tx + tw / 2 + 0.03, y, 0), PI / 2), 0, G + 0.8, 1.6, 1.8, M)
    box((tw + 0.4, ty1 - 12.0, 0.6), (tx, (ty1 + 12.0) / 2, zf - 0.3), M["steel2"])  # the platform out over the slope
    for k in range(6): box((0.25, ty1 - 12.0, 0.5), (tx - tw / 2 + 0.6 + k * (tw - 1.2) / 5, (ty1 + 12.0) / 2, zf - 0.85), M["steel2"])
    for x in (tx - 2.6, tx + 2.6):
        cyl(0.75, zf - 0.6, (x, ty1 - 3.0, (zf - 0.6) / 2), M["steel2"], verts=20)
        box((2.2, 2.2, 0.5), (x, ty1 - 3.0, 0.25), M["conc"], bevel=0.04)
    hood = [(-tw / 2, 0.0), (tw / 2, 0.0), (tw / 2, 2.6), (tw / 2 - 1.3, 3.9), (-tw / 2 + 1.3, 3.9), (-tw / 2, 2.6)]
    S.prism([(x, z) for x, z in hood], 0, ty1 - ty0, M["blue"], loc=(tx, ty1, z0), rot=(PI / 2, 0, 0), smooth=None)
    for k in range(int((ty1 - ty0) / 0.6)):  # standing seams over the hood
        y = ty0 + 0.3 + k * 0.6
        for (xa, za), (xb, zb) in zip(hood[1:], hood[2:] + hood[:1]):
            if za == 0 and zb == 0: continue
            c = Vector((tx + (xa + xb) / 2, y, z0 + (za + zb) / 2)); ln = math.hypot(xb - xa, zb - za); a = math.atan2(zb - za, xb - xa)
            box((ln, 0.05, 0.06), c + Vector((-math.sin(a) * 0.03, 0, math.cos(a) * 0.03)), M["seam"], rot=(0, -a, 0))
    for (xa, za), (xb, zb) in zip(hood, hood[1:] + hood[:1]):  # rust trim round the open end
        if za == 0 and zb == 0: continue
        c = Vector((tx + (xa + xb) / 2, ty1 + 0.06, z0 + (za + zb) / 2)); ln = math.hypot(xb - xa, zb - za); a = math.atan2(zb - za, xb - xa)
        box((ln + 0.2, 0.14, 0.3), c, M["rust"], rot=(0, -a, 0))
    box((tw, ty1 - ty0, 0.25), (tx, (ty0 + ty1) / 2, z0 + 0.1), M["steel2"])  # the hood's floor frame
    B.pad((tw - 2.8, ty1 - ty0 - 0.6, 0.5), (tx, (ty0 + ty1) / 2, z0 + 4.1), SN)
    for s in (-1, 1): box((0.4, ty1 - ty0 - 1, 0.28), (tx + s * (tw / 2 - 0.5), (ty0 + ty1) / 2, z0 + 3.4), SN, rot=(0, s * 0.78, 0), bevel=0.1, seg=2, kind="snow")
    shifted(lambda: S.machinery(ty1 - 0.5, 0.0, z0 + 0.3, M, gauge=3.0), dx=tx)
    for x in (tx - 4.6, tx + 4.6): steel_rail((x, 12.0), (x, ty1), zf, M)
    steel_rail((tx - 4.6, ty1), (tx + 4.6, ty1), zf, M)
    # The steel stair tower beside the terminal, down to the snow.
    sx0 = tx + tw / 2 + 1.6
    for x in (sx0 - 1.2, sx0 + 1.2):
        for y in (6.0, 12.0): box((0.25, 0.25, zf + 1.2), (x, y, (zf + 1.2) / 2), M["steel2"])
    for k, z in enumerate((zf * 0.33, zf * 0.66, zf)):
        box((2.6, 6.2, 0.15), (sx0, 9.0, z), M["steel2"])
        y0, y1 = (6.2, 11.8) if k % 2 else (11.8, 6.2); zz = z - zf * 0.33
        rod_ = Vector((sx0, y1, zz)) - Vector((sx0, y0, z))
        box((1.1, rod_.length, 0.12), (sx0 + (0.6 if k % 2 else -0.6), (y0 + y1) / 2, (z + zz) / 2), M["steel2"], rot=(math.atan2(rod_.z, rod_.y), 0, 0))
        steel_rail((sx0 + 1.3, 6.0), (sx0 + 1.3, 12.0), z, M, snow=False)
    # Valley-side terrace with tables, ski racks on the uphill side, snow banked round.
    ty = D / 2 + 0.3
    box((22.0, 7.0, 0.3), (-12.0, ty + 3.5, 0.15), M["deck"], bevel=0.02)
    steel_rail((-23.0, ty + 7.0), (-1.0, ty + 7.0), 0.3, M); steel_rail((-23.0, ty), (-23.0, ty + 7.0), 0.3, M)
    for i, x in enumerate((-19, -14, -9, -4)): B.picnic((x, ty + 3.6, 0.3), M["deck"], SN, rot=PI + 0.05 * i)
    for x in (-16.5, -6.5): B.parasol((x, ty + 3.6, 0.3), TIM, flat("cloth#36506e", "#36506e", 0.9), SN)
    for x in (-20.0, -4.0, 4.0): B.rack((x, -D / 2 - 5.0, 0), TIM, SN, rot=PI / 2)
    B.drifts([(-24.5, 0, 1.6, D), (-3, -D / 2 - 0.8, 10, 1.4), (8, D / 2 + 0.8, 14, 1.4)], M, h=0.8)
    finalize("thunderhead_lodge", 2048, ao_dist=1.5)

# ---------- Aspen Mountain: the Sundeck and the Silver Queen's top terminal ----------
def seamed_roof(x0, x1, y0, y1, z0, z1, M, mat="galv", step=0.6, snow=0.35, axis="x"):
    """A plane of standing-seam metal running x0..x1 along X, from its edge (y0, z0) up to (y1, z1). With
    axis "y" the same turned a quarter: it runs x0..x1 along Y and climbs from x = y0 to x = y1.
    Seams every `step`, a layer of snow on it."""
    L = math.hypot(y1 - y0, z1 - z0); a = math.atan2(z1 - z0, y1 - y0); c, cz, w = (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0
    if axis == "x": rot, n = (a, 0, 0), Vector((0, -math.sin(a), math.cos(a)))
    else: rot, n = (0, -a, 0), Vector((-math.sin(a), 0, math.cos(a)))
    if n.z < 0: n = -n
    def at(u, v, h):  # u along the run, v across it, h off the plane
        p = Vector((u, c, cz)) if axis == "x" else Vector((c, u, cz))
        return p + n * h
    size = lambda run, across, t: (run, across, t) if axis == "x" else (across, run, t)
    box(size(w, L, 0.14), at((x0 + x1) / 2, 0, 0), M[mat], rot=rot)
    for k in range(int(w / step)): box(size(0.05, L, 0.07), at(x0 + step / 2 + k * step, 0, 0.09), M["seam"], rot=rot)
    if snow: slab(size(w - 0.2, L - 0.4, snow), at((x0 + x1) / 2, 0, snow / 2 + 0.05), M["sn"], rot=rot)

def sundeck():
    """The Sundeck (1999) on the summit of Aspen Mountain: a long, low lodge. Stone wainscot, dark board
    walls between timber posts, a skirt of galvanized standing-seam roof all round up to a clerestory, a
    dark green upper roof with shed dormers, little louvred vent gables and stone chimneys, and in the
    middle the tall timber-and-glass entrance gable braced with crossed timbers.
    Sources: aspensnowmass.com Sundeck page (hero photo, 2022); OSM way 339894841 (70.6 x 36 m); built
    here 66 x 30 m."""
    new_col("sundeck"); M = mats(); B.anchor(M)
    ST, TIM, SN, BR = M["st"], M["tim"], M["sn"], M["brown"]
    L, D, Wn, E, U = 66.0, 30.0, 1.3, 4.6, 7.9  # length, depth, stone height, eave, clerestory foot
    core = 8.0; Tc = 9.8; Rc = core * 0.45     # the raised core: half depth, wall top, roof rise
    box((L + 0.3, D + 0.3, Wn), (0, 0, Wn / 2), ST, bevel=0.05)
    box((L, D, E - Wn), (0, 0, (Wn + E) / 2), BR)
    box((L + 0.4, D + 0.4, 0.14), (0, 0, Wn + 0.05), TIM)
    box((L - 6, 2 * core, Tc - E + 0.2), (0, 0, (E + Tc) / 2), BR)
    # Posts and windows along the long walls and the ends.
    for f, half, n in ((Frame((0, -D / 2, 0)), L / 2, 16), (Frame((0, D / 2, 0), PI), L / 2, 16), (Frame((-L / 2, 0, 0), -PI / 2), D / 2, 7), (Frame((L / 2, 0, 0), PI / 2), D / 2, 7)):
        step = 2 * half / n
        for k in range(n + 1): f.box((0.3, 0.3, E - Wn), (-half + k * step, -0.12, (Wn + E) / 2), TIM)
        f.box((2 * half + 0.3, 0.35, 0.35), (0, -0.14, E - 0.15), TIM)
        for k in range(n):
            x = -half + (k + 0.5) * step
            if f is not None and abs(x) < 7 and half == L / 2 and f.a == 0: continue
            win(f, x, Wn + 0.5, step - 1.4, E - Wn - 1.3, M, y=-0.02, cols=2)
    # The galvanized skirt roof all round, the clerestory windows above it, the green core roof.
    over = 1.3
    seamed_roof(-L / 2 - over, L / 2 + over, -D / 2 - over, -core, E - over * (U - E) / (D / 2 - core), U, M)
    seamed_roof(-L / 2 - over, L / 2 + over, D / 2 + over, core, E - over * (U - E) / (D / 2 - core), U, M)
    for s in (-1, 1):
        x0 = s * (L / 2 + over); x1 = s * (L / 2 - 3.0)
        seamed_roof(-D / 2 + 0.2, D / 2 - 0.2, x0, x1, E - over * (U - E) / 3.0, U, M, axis="y")
    for s in (-1, 1):
        f = Frame((0, s * core, 0), 0 if s < 0 else PI)
        for k in range(12): win(f, -L / 2 + 6 + k * (L - 12) / 11, U + 0.35, 2.2, 1.1, M, cols=3, snow=False)
    MG = dict(M); MG["roof"] = M["green"]
    ga, gtop = B.gable_roof(Frame((0, 0, 0), PI / 2), 2 * core, -L / 2 + 2.0, L / 2 - 2.0, Tc, Rc, 1.0, MG, thick=0.34, st=0.55, ice=30)
    for s in (-1, 1): B.gable_wall(Frame((s * (L / 2 - 3.0), 0, 0), s * PI / 2), 2 * core, 0, Tc, Rc, BR, 0.2)
    for x in (-24, -14, 14, 24):  # shed dormers on the core roof, flues beside them
        u = core - 2.6; z = gtop(u)
        box((4.0, 2.6, 1.7), (x, -u + 0.6, z + 0.5), BR); box((4.6, 3.4, 0.2), (x, -u + 0.4, z + 1.45), M["green"], rot=(-0.12, 0, 0))
        B.pad((4.4, 3.2, 0.3), (x, -u + 0.4, z + 1.65), SN)
        win(Frame((x, -u - 0.7, 0)), 0, z + 0.05, 3.0, 1.0, M, cols=3, snow=False)
        for dx in (-2.8, 2.6): cyl(0.15, 2.2, (x + dx, -2.5, gtop(2.5) + 0.9), M["steel"], verts=10); cyl(0.26, 0.2, (x + dx, -2.5, gtop(2.5) + 2.05), M["steel"], verts=10)
    for x in (-30, -20, 20, 30):  # little louvred vent gables on the skirt roof
        y = -D / 2 + 1.8; z = E + 1.1
        Frame((x, y, 0)).prism([(-1.0, 0, z - 0.4), (1.0, 0, z - 0.4), (0, 0, z + 1.0)], 1.2, BR)
        for k in range(3): box((1.1 - k * 0.3, 0.06, 0.08), (x, y - 0.03, z - 0.1 + k * 0.32), TIM)
        for sx in (-1, 1): box((1.35, 1.5, 0.12), (x + sx * 0.5, y + 0.6, z + 0.32), M["galv"], rot=(0, sx * 0.95, 0))
        B.pad((0.5, 1.4, 0.25), (x, y + 0.6, z + 1.05), SN)
    stack(-L / 2 + 9, 3.0, gtop(3.0) - 1.0, 3.6, M, w=1.6, d=2.0); stack(L / 2 - 12, -1.0, gtop(1.0) - 1.0, 3.2, M)
    # The entrance gable: tall, timber-framed, glazed, braced with crossed timbers.
    gw, gp, gT, gr = 13.0, 4.0, 9.0, 6.6; yf = -D / 2 - gp
    box((gw, gp + 1.0, Wn), (0, -D / 2 - gp / 2 + 0.5, Wn / 2), ST, bevel=0.05)
    box((gw - 0.4, gp + 1.0, gT - Wn), (0, -D / 2 - gp / 2 + 0.5, (Wn + gT) / 2), M["inner"])
    g = Frame((0, yf, 0))
    g.box((gw - 0.8, 0.08, gT - Wn - 0.2), (0, 0.1, (Wn + gT) / 2), M["win"], kind="lit")
    g.prism([(-gw / 2 + 0.3, 0.12, gT), (gw / 2 - 0.3, 0.12, gT), (0, 0.12, gT + gr - 0.3)], 0.05, M["win"], kind="lit")
    for x in (-gw / 2, -gw / 6, gw / 6, gw / 2): g.box((0.42, 0.42, gT), (x, -0.1, gT / 2), TIM, bevel=0.03)
    g.box((gw + 0.4, 0.45, 0.5), (0, -0.12, gT), TIM, bevel=0.03); g.box((gw, 0.3, 0.3), (0, -0.05, 4.4), TIM)
    a = math.atan2(gr, gw / 2)
    for s in (-1, 1):
        g.box((math.hypot(gw / 2, gr) + 0.8, 0.45, 0.55), (s * gw / 4, -0.15, gT + gr / 2), TIM, rot=(0, s * a, 0), bevel=0.03)
        b = math.atan2(gr * 0.62, gw / 2 - 0.6); g.box((math.hypot(gw / 2 - 0.6, gr * 0.62), 0.3, 0.32), (s * (gw / 4 - 0.3), -0.05, gT + gr * 0.31), TIM, rot=(0, -s * b, 0))
        g.box((math.hypot(gw / 6, gT - 4.4), 0.26, 0.28), (s * gw / 3, -0.05, (gT + 4.4) / 2), TIM, rot=(0, s * math.atan2(gT - 4.4, gw / 3), 0))
    g.box((0.32, 0.3, gr - 0.4), (0, -0.05, gT + (gr - 0.4) / 2), TIM)
    for k in (-2, -1, 1, 2): g.box((0.12, 0.16, gT - 4.6), (k * gw / 7, 0.0, (gT + 4.6) / 2), TIM)
    B.gable_roof(Frame((0, 0, 0)), gw, yf - 1.2, -core + 1.0, gT, gr, 1.0, MG, thick=0.4, st=0.65, ice=10, ends=(True, False))
    B.door(g, -1.4, Wn - 1.0, 2.2, 2.6, M, double=True, glazed=True, y=-0.15); B.door(g, 1.4, Wn - 1.0, 2.2, 2.6, M, double=True, glazed=True, y=-0.15)
    g.box((4.2, 0.14, 0.6), (0, -0.45, 4.0), M["sign"], bevel=0.03)
    text("SUNDECK", 0.38, g.p(0, -0.53, 4.0), M["cream"], rot=(PI / 2, 0, 0), extrude=0.01)
    for i in range(3): box((7.0, 0.5, 0.2), (0, yf - 0.4 - i * 0.45, 0.25 - i * 0.12 + 0.1), ST, bevel=0.03)
    # The split-rail fence along the front with a gap at the path, benches, ski racks, snow banked round.
    fy = -D / 2 - 9.0
    for x0, x1 in ((-L / 2, -4.5), (4.5, L / 2)):
        n = int((x1 - x0) / 2.6)
        for k in range(n + 1): cyl(0.1, 1.2, (x0 + k * (x1 - x0) / n, fy, 0.6), M["logy"], verts=8)
        for z in (0.55, 1.05): cyl(0.07, x1 - x0, ((x0 + x1) / 2, fy, z), M["log"], rot=(0, PI / 2, 0), verts=8)
        box((x1 - x0, 0.18, 0.1), ((x0 + x1) / 2, fy, 1.15), SN, bevel=0.04, seg=1, kind="snow")
    for x in (-18, 18): B.rack((x, -D / 2 - 4.5, 0), TIM, SN, rot=PI / 2)
    for x in (-10, 10): B.bench((x, -D / 2 - 2.0, 0), M)
    B.drifts([(0, D / 2 + 2.0, L, 1.6), (-L / 2 - 2, 0, 1.6, D), (L / 2 + 2, 0, 1.6, D)], M, h=0.8)
    finalize("sundeck", 2048, ao_dist=1.5)

def silver_queen_top():
    """The Silver Queen Gondola's top terminal on Aspen Mountain: a long gabled hood of grey corrugated metal
    over the platform on grey columns, red beams and trim under its eaves, the bullwheel at the uphill end,
    a grey corrugated station building alongside. Sources: liftblog.com Silver Queen photos (2017).
    Rope: x = +-3.0, z = 4.25, entering the hood at y = +13 from +Y; the bullwheel is at y = -9."""
    new_col("silver_queen_top"); M = mats(); B.anchor(M)
    M["rubber"], M["dark"] = flat("rubber", "#26282b", 0.85, grain=0.04), flat("dark2", "#2a2d31", 0.5, grain=0.03)
    CG, RED, SN = flat("corrugated", "#8f9498", 0.5, grain=0.04), flat("sq_red", "#b3322b", 0.5, grain=0), M["sn"]
    yf, yc, z0, zf = 13.0, -9.0, 4.55, 1.0
    hw, ya, yb, zw, zr = 5.2, yc - 5.0, yf + 1.0, z0 + 2.2, z0 + 4.4
    box((14.0, yb - ya + 2.0, zf), (0, (ya + yb) / 2, zf / 2), M["conc"], bevel=0.03)
    prof = [(-hw, 0.0), (hw, 0.0), (hw, zw - z0), (0, zr - z0), (-hw, zw - z0)]
    S.prism(prof, 0, yb - ya, CG, loc=(0, yb, z0), rot=(PI / 2, 0, 0), smooth=None)
    for s in (-1, 1):
        for k in range(int((yb - ya) / 0.35)): box((0.05, 0.06, zw - z0 - 0.1), (s * (hw + 0.02), ya + 0.2 + k * 0.35, (z0 + zw) / 2), CG)
        box((0.25, yb - ya + 0.3, 0.32), (s * (hw + 0.1), (ya + yb) / 2, z0 + 0.1), RED)
        box((0.2, yb - ya + 0.2, 0.2), (s * (hw + 0.12), (ya + yb) / 2, zw + 0.05), RED)
        a = math.atan2(zr - zw, hw)
        slab((math.hypot(hw, zr - zw) + 0.3, yb - ya - 0.2, 0.45), (s * hw / 2, (ya + yb) / 2, (zw + zr) / 2 + 0.3), SN, rot=(0, s * a, 0))
    for (xa, za), (xb, zb) in zip(prof[2:], prof[3:] + prof[:1]):  # red frame round the open end
        c = Vector(((xa + xb) / 2, yb + 0.1, z0 + (za + zb) / 2)); ln = math.hypot(xb - xa, zb - za); a = math.atan2(zb - za, xb - xa)
        box((ln + 0.25, 0.2, 0.3), c, RED, rot=(0, -a, 0))
    box((2 * hw + 0.2, 0.2, 0.3), (0, yb + 0.1, z0 + 0.15), RED)
    for k in range(6): box((2 * hw, 0.25, 0.35), (0, ya + 1 + k * (yb - ya - 2) / 5, z0 - 0.2), RED)  # red beams under the hood
    for y in (ya + 4.0, yb - 5.0):
        for x in (-hw + 0.6, hw - 0.6):
            cyl(0.32, z0 - zf, (x, y, (z0 + zf) / 2), M["steel2"], verts=14); box((1.0, 1.0, 0.3), (x, y, zf + 0.15), M["conc"], bevel=0.03)
    S.machinery(yf, yc, z0, M)
    for x in (-hw - 0.4, hw + 0.4):
        if x > 0: steel_rail((x, ya), (x, yb), zf, M)
    # The station building alongside: grey corrugated walls, a flat roof under snow, a door and windows.
    bx, bw, bd, bh = -hw - 5.6, 9.0, 16.0, 6.0
    box((bw, bd, bh), (bx, -2.0, bh / 2), CG)
    for k in range(int(bd / 0.35)): box((0.05, 0.06, bh - 0.2), (bx - bw / 2 - 0.02, -2.0 - bd / 2 + 0.2 + k * 0.35, bh / 2), CG)
    box((bw + 0.3, bd + 0.3, 0.3), (bx, -2.0, bh), M["char"]); B.pad((bw, bd, 0.5), (bx, -2.0, bh + 0.35), SN)
    f = Frame((bx, -2.0 + bd / 2 + 0.03, 0), PI)
    B.door(f, 1.5, zf - 0.6, 1.2, 2.3, M, glazed=True)
    for x in (-2.0, -0.2): win(f, x, 1.5, 1.4, 1.2, M, fr="steel2")
    for y in (-8, -3, 2): win(Frame((bx - bw / 2 - 0.05, y, 0), -PI / 2), 0, 3.4, 2.0, 1.2, M, fr="steel2")
    rod_ = lambda a, b: S.rod(a, b, 0.04, M["steel2"])
    rod_((bx + 2, -6, bh), (bx + 2, -6, bh + 3.0)); box((0.6, 0.6, 0.6), (bx + 2, -6, bh + 3.1), M["char"])
    blob((14.5, 1.4, 0.7), (0, ya - 1.2, 0.15), SN, lumps=0.1); blob((1.4, bd, 0.7), (bx - bw / 2 - 0.8, -2.0, 0.1), SN, lumps=0.1)
    finalize("silver_queen_top", 1024, ao_dist=1.2)

# ---------- Copper: The Aerie ----------
def flat_roof(x0, x1, y0, y1, z, M, over=0.0, soffit="honey", fascia="char", t=0.5, snow=0.6, tilt=0.0):
    """A low-slope roof slab with a deep overhang: honey timber soffit under it, a dark fascia, thick snow."""
    cx, cy, w, d = (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0
    box((w, d, t), (cx, cy, z), M[fascia], rot=(tilt, 0, 0), bevel=0.04)
    box((w - 0.3, d - 0.3, 0.06), (cx, cy, z - t / 2 - 0.02), M[soffit], rot=(tilt, 0, 0))
    for k in range(int(w / 1.2)): box((0.16, d - 0.4, 0.22), (x0 + 0.6 + k * 1.2, cy, z - t / 2 - 0.12), M["honey"], rot=(tilt, 0, 0))
    if snow: slab((w - 0.2, d - 0.2, snow), (cx, cy, z + t / 2 + snow / 2 - 0.05), M["sn"], rot=(tilt, 0, 0))

def glazing(f, x0, x1, z0, z1, M, step=1.5, transoms=(), y=0.0, mull="honeyz"):
    """A curtain of floor-to-ceiling glass in timber mullions."""
    w = x1 - x0; f.box((w, 0.06, z1 - z0), ((x0 + x1) / 2, y + 0.02, (z0 + z1) / 2), M["win"], kind="lit")
    n = max(1, round(w / step))
    for k in range(n + 1): f.box((0.14, 0.2, z1 - z0), (x0 + k * w / n, y - 0.06, (z0 + z1) / 2), M[mull])
    for z in (z0,) + tuple(transoms) + (z1,): f.box((w + 0.1, 0.2, 0.14), ((x0 + x1) / 2, y - 0.06, z), M[mull])

def the_aerie():
    """The Aerie (2023) at the top of Copper's American Eagle: a modern two-storey lodge. A board-formed
    concrete and stone base storey, an upper storey in charcoal panels with floor-to-ceiling glass in honey
    timber frames on the view side, low roofs on deep honey glulam soffits, a concrete stair tower, and the
    covered upper deck the chondola unloads onto: black steel columns, a pergola of glulam beams, glass rails.
    Sources: visitcoppermountain.com Aerie photos (2023-11), snowbrains.com; OSM way 1230158292
    (56.3 x 35.3 m); built here 52 x 30 m with the deck."""
    new_col("the_aerie"); M = mats(); B.anchor(M)
    ST, SN, CH, CO, HN = M["st"], M["sn"], M["char"], M["conc"], M["honeyz"]
    L, D, G, T = 50.0, 24.0, 4.6, 9.4
    box((L, D, G), (0, 0, G / 2), CO)
    for k in range(int(G / 0.3)): box((L + 0.02, D + 0.02, 0.02), (0, 0, 0.3 + k * 0.3), flat("formlines", "#95908a", 0.9, grain=0))  # board-form lines
    box((L - 0.2, D - 0.2, T - G), (0, 0, (G + T) / 2), CH)
    for k in range(int(L / 0.9)):  # panel joints on the charcoal
        for y in (-D / 2 - 0.01, D / 2 + 0.01): box((0.03, 0.02, T - G), (-L / 2 + 0.45 + k * 0.9, y, (G + T) / 2), flat("joint", "#24272a", 0.6, grain=0))
    box((L + 0.3, D + 0.3, 0.35), (0, 0, G), M["honey"])
    fr, bk = Frame((0, -D / 2 - 0.05, 0)), Frame((0, D / 2 + 0.05, 0), PI)
    # The view side (front): the upper storey all glass in honey frames, the base storey in stone with windows.
    glazing(fr, -L / 2 + 2, L / 2 - 8, G + 0.2, T - 0.3, M, transoms=(G + 2.8,))
    fr.box((L - 10, 0.25, G - 0.6), (-4, -0.1, (G - 0.6) / 2 + 0.3), ST)
    for x in range(-20, 14, 5): glazing(fr, x - 1.6, x + 1.6, 0.9, 3.4, M, step=1.6, y=-0.24)
    # The back (slope side): the entrance portal in honey timber with red-framed glass doors and the sign.
    glazing(bk, -L / 2 + 4, -4, G + 0.6, T - 1.0, M, step=1.8)
    for x in (6, 14): glazing(bk, x - 2, x + 2, G + 0.6, T - 1.0, M, step=2.0)
    px = 6.0
    bk.box((8.0, 2.4, G), (px, -1.2, G / 2), M["honey"]); bk.box((8.4, 3.2, 0.5), (px, -1.6, G + 0.2), CH)
    RD = flat("door_red", "#9b3a30", 0.5, grain=0)
    for x in (px - 2.2, px - 0.7, px + 0.8, px + 2.3):
        bk.box((1.3, 0.1, 2.6), (x, -2.42, 1.3), RD); bk.box((1.0, 0.06, 2.3), (x, -2.48, 1.35), M["win"], kind="lit")
    bk.box((5.0, 0.1, 0.5), (px, -2.5, G - 0.6), CH)
    text("AERIE", 0.4, bk.p(px, -2.58, G - 0.6), M["cream"], rot=(PI / 2, 0, bk.a), extrude=0.01)
    bk.box((7.0, 0.2, 1.0), (-10, -0.05, 2.0), ST)
    # Ends: concrete stair tower at the east, glass at the west upper corner.
    tx = L / 2 + 2.5
    box((5.0, 9.0, T + 2.5), (tx, 2.0, (T + 2.5) / 2), CO)
    for k in range(int((T + 2.5) / 0.3)): box((5.02, 9.02, 0.02), (tx, 2.0, 0.3 + k * 0.3), flat("formlines", "#95908a", 0.9, grain=0))
    win(Frame((tx, 2.0 - 4.55, 0)), 0, G + 1.0, 0.8, 3.0, M, cols=1, fr="char", snow=False)
    flat_roof(tx - 2.9, tx + 2.9, -3.0, 7.0, T + 2.7, M, t=0.4)
    wf = Frame((-L / 2 - 0.05, 0, 0), -PI / 2)
    glazing(wf, -D / 2 + 1, D / 2 - 1, G + 0.2, T - 0.3, M, transoms=(G + 2.8,))
    for x in (-6, 0, 6): glazing(wf, x - 1.5, x + 1.5, 0.9, 3.4, M, y=-0.02)
    # Roofs: the main roof on deep soffits, tilted up a little to the view; a raised clerestory over the hall.
    flat_roof(-L / 2 - 2.5, L / 2 + 0.5, -D / 2 - 2.5, D / 2 + 1.5, T + 0.25, M, t=0.55, tilt=0.03)
    box((22, 8, 1.6), (-8, -2, T + 1.2), CH); glazing(Frame((-8, -6.05, 0)), -10.5, 10.5, T + 0.6, T + 1.9, M, step=1.5)
    flat_roof(-20.5, 4.5, -7.5, 3.5, T + 2.25, M, t=0.4)
    # The covered upper deck on the -X end where the chondola unloads: steel columns, glulam pergola, glass rails.
    dx0, dx1, dy0, dy1, dz = -L / 2 - 12.0, -L / 2, -D / 2 - 1.0, D / 2 - 3.0, G
    box((dx1 - dx0, dy1 - dy0, 0.4), ((dx0 + dx1) / 2, (dy0 + dy1) / 2, dz - 0.2), CH)
    box((dx1 - dx0 - 0.2, dy1 - dy0 - 0.2, 0.05), ((dx0 + dx1) / 2, (dy0 + dy1) / 2, dz + 0.02), M["deck"])
    for x in (dx0 + 0.4, (dx0 + dx1) / 2):
        for y in (dy0 + 0.4, dy1 - 0.4): box((0.35, 0.35, T + 0.8), (x, y, (T + 0.8) / 2), CH)
    for k in range(9): box((dx1 - dx0 + 1.5, 0.3, 0.5), ((dx0 + dx1) / 2 - 0.5, dy0 + 0.6 + k * (dy1 - dy0 - 1.2) / 8, T + 1.0), HN)
    for x in (dx0 + 0.4, (dx0 + dx1) / 2): box((0.4, dy1 - dy0 + 1.0, 0.6), (x, (dy0 + dy1) / 2, T + 0.6), CH)
    for k in range(9): B.pad((dx1 - dx0 + 1.2, 0.36, 0.14), ((dx0 + dx1) / 2 - 0.5, dy0 + 0.6 + k * (dy1 - dy0 - 1.2) / 8, T + 1.32), SN)
    GR = glass("rail_glass", "#b8c8d4", 0.3)
    for (x0, y0, x1, y1) in ((dx0, dy0, dx1, dy0), (dx0, dy0, dx0, dy1), (dx0, dy1, dx1 - 6, dy1)):
        Lr = math.hypot(x1 - x0, y1 - y0); a = math.atan2(y1 - y0, x1 - x0)
        box((Lr, 0.04, 1.0), ((x0 + x1) / 2, (y0 + y1) / 2, dz + 0.55), GR, rot=(0, 0, a), kind="glass")
        box((Lr, 0.1, 0.08), ((x0 + x1) / 2, (y0 + y1) / 2, dz + 1.08), CH, rot=(0, 0, a))
        box((Lr, 0.2, 0.1), ((x0 + x1) / 2, (y0 + y1) / 2, dz + 1.16), SN, rot=(0, 0, a), bevel=0.04, seg=1, kind="snow")
    for i, (x, y) in enumerate(((dx0 + 3, -8), (dx0 + 3, -2), (dx0 + 8, -8), (dx0 + 8, -2))): B.picnic((x, y, dz + 0.05), M["deck"], SN, rot=PI / 2)
    # The ground terrace and racks on the view side; snow banked round the base.
    for i, x in enumerate((-16, -9, -2, 5)): B.picnic((x, -D / 2 - 5.0, 0.0), M["deck"], SN, rot=0.04 * i)
    for x in (-21, 10, 18): B.rack((x, -D / 2 - 8.0, 0), M["tim"], SN, rot=PI / 2)
    B.drifts([(0, D / 2 + 3.6, L, 1.6), (L / 2 + 5.8, 0, 1.4, D), (-4, -D / 2 - 0.9, L - 10, 1.0)], M, h=0.7)
    finalize("the_aerie", 2048, ao_dist=1.5)

# ---------- Aspen Highlands: Merry-Go-Round ----------
def merry_go_round():
    """Merry-Go-Round, mid-mountain at Aspen Highlands where the main lifts meet (remodelled): a long, low
    single-storey restaurant under one broad, almost flat roof whose ends kick up a little, on a thin charcoal
    fascia with a deep dark soffit; the whole south front floor-to-ceiling glass in dark steel frames between
    charcoal columns; a terrace of red brick pavers at snow level with red tables, and ski racks all along it.
    Sources: aspensnowmass.com Merry-Go-Round hero photo (2025-26); OSM way 151179417 (49 x 34 m, 435 seats).
    Built here 48 x 26 m with a 10 m terrace."""
    new_col("merry_go_round"); M = mats(); B.anchor(M)
    ST, SN, CH, BR = M["st"], M["sn"], M["char"], M["brown"]
    L, D, F, T = 48.0, 26.0, 0.35, 4.8
    box((L + 0.4, D + 0.4, F), (0, 0, F / 2), ST, bevel=0.04)
    box((L, D, T - F), (0, 0, (F + T) / 2), BR)
    fr = Frame((0, -D / 2 - 0.04, 0))
    nb = 12; bw = L / nb
    for k in range(nb):
        x0, x1 = -L / 2 + k * bw + 0.2, -L / 2 + (k + 1) * bw - 0.2
        if k in (5, 6):
            B.door(fr, (x0 + x1) / 2, F, 2.4, 2.6, M, double=True, glazed=True, y=-0.02)
            glazing(fr, x0, x1, F + 2.9, T - 0.2, M, step=bw, mull="char")
        else: glazing(fr, x0, x1, F + 0.1, T - 0.2, M, step=bw / 2, transoms=(T - 1.1,), mull="char")
    for k in range(nb + 1): fr.box((0.4, 0.4, T - F), (-L / 2 + k * bw, -0.2, (F + T) / 2), CH)
    fr.box((L + 0.4, 0.45, 0.45), (0, -0.2, T - 0.1), CH)
    bk = Frame((0, D / 2 + 0.04, 0), PI)
    for x in range(-20, 24, 6): win(bk, x, F + 1.1, 2.4, 1.6, M, cols=2, fr="char")
    B.door(bk, 1.0, F, 1.2, 2.3, M)
    for s in (-1, 1):
        e = Frame((s * (L / 2 + 0.04), 0, 0), s * PI / 2)
        glazing(e, -D / 2 + 1.0, -D / 2 + 9.0, F + 0.1, T - 0.2, M, step=2.0, transoms=(T - 1.1,), mull="char")
        for x in (3, 8): win(e, x, F + 1.1, 2.2, 1.8, M, cols=2, fr="char")
    # The roof: a broad, nearly flat slab, deep over the glass, its two end bays kicked up a few degrees.
    yo0, yo1, t = -D / 2 - 4.0, D / 2 + 1.5, 0.5
    xm = L / 2 - 8.0; kick = math.radians(4.0)
    def slab_part(x0, x1, tilt, zc):
        cx, w, d, cy = (x0 + x1) / 2, x1 - x0, yo1 - yo0, (yo0 + yo1) / 2
        box((w, d, t), (cx, cy, zc), CH, rot=(0, tilt, 0), bevel=0.03)
        box((w - 0.2, d - 0.3, 0.05), (cx, cy, zc - t / 2 - 0.03), flat("soffit_dark", "#3a3c3f", 0.7, grain=0.03), rot=(0, tilt, 0))
        slab((w - 0.1, d - 0.25, 0.7), (cx, cy, zc + t / 2 + 0.3), SN, rot=(0, tilt, 0))
    zr = T + 0.35
    slab_part(-xm, xm, 0.0, zr)
    for s in (-1, 1):
        x0, x1 = s * xm, s * (L / 2 + 2.0); ln = abs(x1 - x0)
        slab_part(min(x0, x1), max(x0, x1), -s * kick, zr + ln / 2 * math.tan(kick))
    for k in range(int((L + 4) / 1.5)):  # battens on the deep soffit over the terrace
        x = -L / 2 - 1.8 + k * 1.5
        box((0.08, 3.8, 0.12), (x, -D / 2 - 2.0, zr - t / 2 - 0.1 + max(0, abs(x) - xm) * math.tan(kick)), M["steel2"])
    for x in (-L / 2 - 1.2, L / 2 + 1.2, -12.0, 12.0): box((0.35, 0.35, zr - F), (x, -D / 2 - 3.4, (F + zr) / 2), CH)
    for x in (-14.0, 10.0): box((2.0, 1.6, 1.2), (x, 4.0, zr + 0.6), M["steel2"]); B.pad((2.0, 1.6, 0.3), (x, 4.0, zr + 1.35), SN)
    # The terrace: red brick pavers at snow level, red tables, ski racks along its edge.
    PV = flat("pavers_red", "#8c4b3e", 0.85, grain=0.12); RT = flat("table_red", "#9b3a30", 0.6, grain=0.04)
    ty0, ty1 = -D / 2 - 10.0, -D / 2
    box((L + 2.0, ty1 - ty0, 0.15), (0, (ty0 + ty1) / 2, 0.07), PV)
    for k in range(int((L + 2) / 0.6)): box((0.02, ty1 - ty0, 0.01), (-L / 2 - 1 + k * 0.6, (ty0 + ty1) / 2, 0.15), flat("joint_pv", "#6e3a30", 0.9, grain=0))
    for r_, y in enumerate((ty1 - 2.6, ty1 - 6.2)):
        for k, x in enumerate(range(-21, 23, 6)):
            B.picnic((x + (1.5 if r_ else 0), y, 0.15), RT, SN, rot=0.05 * ((k + r_) % 3 - 1))
    for x in range(-22, 24, 7): B.rack((x, ty0 - 0.8, 0), M["steel2"], SN, rot=0.0)
    B.drifts([(0, D / 2 + 1.5, L + 4, 1.8), (-L / 2 - 1.2, 2.0, 1.6, D - 6), (L / 2 + 1.2, 2.0, 1.6, D - 6)], M, h=0.8)
    finalize("merry_go_round", 2048, ao_dist=1.5)

# ---------- Aspen Highlands: the Highland Bowl ridge ----------
FLAG_COLS = ("#3b6aa8", "#efefe8", "#b8322c", "#3f7a4a", "#d9b23a")

def flag_string(p0, p1, sag, M, n=None):
    """A line of Tibetan prayer flags from p0 to p1 sagging by `sag`: blue, white, red, green, yellow."""
    p0, p1 = Vector(p0), Vector(p1); L = (p1 - p0).length; n = n or int(L / 0.55)
    pt = lambda t: p0.lerp(p1, t) - Vector((0, 0, sag * 4 * t * (1 - t)))
    pts = [pt(k / 12) for k in range(13)]
    for a, b in zip(pts, pts[1:]): S.rod(a, b, 0.012, M["rope"], verts=4)
    d = (p1 - p0).normalized(); ang = math.atan2(d.y, d.x)
    for k in range(n):
        t = (k + 0.5) / n; c = pt(t) - Vector((0, 0, 0.2)); col = FLAG_COLS[k % 5]
        box((0.32, 0.01, 0.36), c, M["flag" + col], rot=(0.08 * math.sin(k * 1.7), 0, ang + 0.15 * math.sin(k)))

def highland_peak():
    """The top of Highland Bowl (12,392 ft): a stone cairn draped in prayer flags, flag lines strung out to
    poles along the ridge, the summit sign. Origin at the cairn's foot. The ridge position needs DEM and
    track data the bake does not have; the game places this at the summit."""
    new_col("highland_peak"); M = mats(); B.anchor(M)
    M["rope"] = flat("flag_rope", "#5b5248", 0.8, grain=0)
    for c in FLAG_COLS: M["flag" + c] = flat("flag" + c, c, 0.9, grain=0.05)
    ST, SN = M["st"], M["sn"]
    for k, (r, h) in enumerate(((1.6, 0.6), (1.3, 0.55), (1.0, 0.5), (0.7, 0.45), (0.45, 0.35))):  # the cairn
        z = sum(hh for _, hh in ((1.6, 0.6), (1.3, 0.55), (1.0, 0.5), (0.7, 0.45), (0.45, 0.35))[:k])
        cyl(r, h, (0, 0, z + h / 2), ST, verts=9, r2=r * 0.85, rot=(0, 0, k * 0.7))
    top = 2.45
    cyl(0.05, 3.0, (0, 0, top + 1.4), M["tim"], verts=8)
    poles = [(9.0, -2.0, 3.2), (-8.0, 1.5, 3.0), (2.5, 9.0, 2.8), (-1.5, -8.5, 2.6)]
    for x, y, h in poles:
        S.rod((x, y, 0), (x * 1.02, y * 1.02, h), 0.05, M["tim"], verts=8)
        blob((1.0, 1.0, 0.5), (x, y, 0.1), SN, lumps=0.05)
        flag_string((0, 0, top + 2.8), (x, y, h), 0.6, M)
    flag_string(poles[0][:2] + (poles[0][2],), poles[2][:2] + (poles[2][2],), 0.8, M)
    for k in range(10):  # flags wrapped round the cairn
        a = k * 0.63; box((0.3, 0.01, 0.34), (1.05 * math.cos(a), 1.05 * math.sin(a), 0.9 + (k % 3) * 0.4), M["flag" + FLAG_COLS[k % 5]], rot=(0.15, 0, a + PI / 2))
    # The summit sign on two posts.
    f = Frame((2.6, -2.2, 0), 0.4)
    for x in (-0.8, 0.8): f.cyl(0.07, 2.0, (x, 0, 1.0), M["tim"], verts=8)
    f.box((2.2, 0.08, 0.8), (0, -0.06, 1.65), M["sign"], bevel=0.02)
    text("HIGHLAND PEAK", 0.2, f.p(0, -0.11, 1.8), M["cream"], rot=(PI / 2, 0, f.a), extrude=0.01)
    text("12,392 FT", 0.2, f.p(0, -0.11, 1.5), M["cream"], rot=(PI / 2, 0, f.a), extrude=0.01)
    f.pad((2.2, 0.2, 0.1), (0, -0.06, 2.1), SN)
    mound(2.6, 0.5, (0, 0, -0.05), SN)
    finalize("highland_peak", 1024, ao_dist=1.0)

def mound(r, h, at, mat): return B.mound(r, h, at, mat)

def bootpack():
    """A 12 m stretch of the Highland Bowl bootpack: a narrow trench kicked into the ridge snow, steps every
    35 cm climbing 40 degrees, the walls pushed up either side. The way up is -Y; origin at the foot.
    The game strings these along the ridge line."""
    new_col("bootpack"); M = mats(); B.anchor(M); SN = M["sn"]
    L, slope = 12.0, math.radians(38); n = int(L / 0.35)
    for k in range(n):
        y = -k * 0.35; z = -y * math.tan(slope)
        box((0.6, 0.38, 0.16), (0.05 * math.sin(k * 0.9), y - 0.17, z + 0.05), SN, bevel=0.05, seg=1, kind="snow")
    a = slope
    for s in (-1, 1):
        box((0.7, L / math.cos(a) + 0.4, 0.5), (s * 0.62, -L / 2, L / 2 * math.tan(a) + 0.12), SN, rot=(-a, 0, 0), bevel=0.2, seg=2, kind="snow")
    box((2.4, L / math.cos(a) + 0.4, 0.2), (0, -L / 2, L / 2 * math.tan(a) - 0.12), SN, rot=(-a, 0, 0), bevel=0.08, seg=1, kind="snow")
    for k in range(6): cyl(0.03, 0.9, (0.55 * (-1) ** k, -1.0 - k * 2.0, (1.0 + k * 2.0) * math.tan(a) + 0.4), M["tim"], verts=6)  # a few wands
    finalize("bootpack", 512, ao_dist=0.5)

# ---------- Arapahoe Basin / Mary Jane: dark lap-sided lodges ----------
def _lap_lodge(name, tint, door_hex, sign):
    """A high-alpine lodge of dark horizontal lap siding on a stone base under a gabled standing-seam roof,
    a cross gable in the middle of the front carrying the lodge's name over the door, a long deck with timber
    posts and mesh rails (A-Basin's Black Mountain Lodge and il Rifugio, the Steilhang Hut, Winter Park's Lunch
    Rock). Sources: breckweddings.squarespace.com Black Mountain Lodge photos (2011: the long low front with
    its named cross gable, the deck rails); arapahoebasin.com dining pages via the research notes."""
    new_col(name); M = mats(); B.anchor(M)
    LAP = textured("lap_" + name, "old_planks_02", 1.3, tint, 0.85, "X")
    ST, TIM, SN = M["st"], M["tim"], M["sn"]
    W, D, F, T = 20.0, 12.0, 1.4, 5.0; R = D / 2 * 0.62
    box((W + 0.3, D + 0.3, F), (0, 0, F / 2), ST, bevel=0.05)
    box((W, D, T - F), (0, 0, (F + T) / 2), LAP)
    for k in range(int((T - F) / 0.22)):  # the laps' shadow lines
        z = F + 0.2 + k * 0.22
        for y in (-D / 2 - 0.01, D / 2 + 0.01): box((W, 0.02, 0.025), (0, y, z), flat("lapline", "#1d2120", 0.8, grain=0))
    for sx in (-1, 1):
        for sy in (-1, 1): box((0.22, 0.22, T - F), (sx * W / 2, sy * D / 2, (F + T) / 2), TIM)
    fr = Frame((0, -D / 2 - 0.02, 0))
    for x in (-8.2, -5.6, 5.6, 8.2): win(fr, x, F + 0.6, 2.0, 2.2, M, cols=2, fr="tim")
    # The cross gable in the middle of the front: it stands 0.8 m proud, its own roof, the name in its gable.
    cw, cp, crise = 7.0, 0.8, 2.6; cy = -D / 2 - cp
    box((cw, cp + 0.1, T - F), (0, -D / 2 - cp / 2, (F + T) / 2), LAP)
    cf = Frame((0, cy - 0.02, 0))
    B.gable_wall(Frame((0, cy, 0)), cw, 0, T, crise, LAP, cp + 1.5)
    for s_ in (-1, 1): cf.box((0.22, 0.22, T - F), (s_ * cw / 2, 0.08, (F + T) / 2), TIM)
    for x in (-2.4, 2.4): win(cf, x, F + 0.6, 1.4, 2.2, M, cols=1, fr="tim")
    DR = flat("door_" + name, door_hex, 0.5, grain=0)
    cf.box((1.8, 0.1, 2.5), (0, -0.03, F + 1.25), DR); cf.box((0.9, 0.06, 0.7), (0, -0.09, F + 1.8), M["win"], kind="lit")
    for s_ in (-1, 1): cf.box((0.16, 0.18, 2.6), (s_ * 1.0, -0.06, F + 1.3), TIM)
    cf.box((4.2, 0.12, 0.7), (0, -0.06, T + 0.6), M["sign"], bevel=0.03)
    text(sign, 0.25, cf.p(0, -0.14, T + 0.6), M["cream"], rot=(PI / 2, 0, cf.a), extrude=0.01)
    yr = -D / 2 + (R - crise) / (R / (D / 2)) + 0.4
    for sgn in (-1, 1):
        seamed_roof(cy - 0.8, yr, sgn * (cw / 2 + 0.6), 0.0, T - 0.6 * crise / (cw / 2), T + crise, M, mat="char", snow=0.45, axis="y")
    box((0.3, yr - cy + 0.8, 0.16), (0, (cy - 0.8 + yr) / 2, T + crise + 0.1), M["seam"])
    bk = Frame((0, D / 2 + 0.02, 0), PI)
    for x in (-6, -2, 2, 6): win(bk, x, F + 0.8, 1.6, 1.6, M)
    for s_ in (-1, 1):
        e = Frame((s_ * (W / 2 + 0.02), 0, 0), s_ * PI / 2)
        B.gable_wall(Frame((s_ * (W / 2), 0, 0), s_ * PI / 2), D, 0, T, R, LAP, 0.2)
        for x in (-3, 3): win(e, x, F + 0.8, 1.6, 1.8, M)
        win(e, 0, T + 0.6, 1.4, 1.3, M, cols=2, snow=False)
    over = 0.9
    for sgn in (-1, 1):
        seamed_roof(-W / 2 - over, W / 2 + over, sgn * (D / 2 + over), 0.0, T - over * R / (D / 2), T + R, M, mat="char", snow=0.55)
        box((W + 2 * over, 0.18, 0.3), (0, sgn * (D / 2 + over), T - over * R / (D / 2) - 0.1), TIM)
    cyl(0.12, 1.6, (W / 4, 1.5, T + R - 1.5 * R / (D / 2) + 0.7), M["steel"], verts=10)
    # The deck on the front, with a steel railing and tables.
    dd = 5.0
    box((W + 2, dd, 0.3), (0, -D / 2 - dd / 2, F - 0.15), TIM, bevel=0.03)
    for i in range(int(dd / 0.3)): box((W + 1.8, 0.27, 0.05), (0, -D / 2 - 0.15 - i * 0.3, F + 0.02), M["deck"])
    MESH = glass("rail_mesh", "#9aa3a8", 0.35)
    for (xa, ya, xb, yb) in ((-W / 2 - 1, -D / 2 - dd, W / 2 + 1, -D / 2 - dd), (-W / 2 - 1, -D / 2 - dd, -W / 2 - 1, -D / 2), (W / 2 + 1, -D / 2 - dd, W / 2 + 1, -D / 2)):
        Lr = math.hypot(xb - xa, yb - ya); a = math.atan2(yb - ya, xb - xa); n = max(1, round(Lr / 1.8))
        for k in range(n + 1): box((0.16, 0.16, 1.15), (xa + (xb - xa) * k / n, ya + (yb - ya) * k / n, F + 0.57), TIM)
        box((Lr, 0.16, 0.12), ((xa + xb) / 2, (ya + yb) / 2, F + 1.12), TIM, rot=(0, 0, a))
        box((Lr, 0.02, 0.9), ((xa + xb) / 2, (ya + yb) / 2, F + 0.6), MESH, rot=(0, 0, a), kind="glass")
        box((Lr, 0.22, 0.1), ((xa + xb) / 2, (ya + yb) / 2, F + 1.22), SN, rot=(0, 0, a), bevel=0.04, seg=1, kind="snow")
    for i in range(4): box((0.4, 1.6, 0.2), (-W / 2 - 1.3 - i * 0.35, -D / 2 - 2.0, F - 0.2 - i * 0.33), ST, bevel=0.03)
    for x in (-6, 0, 6): B.picnic((x, -D / 2 - 2.8, F + 0.05), M["deck"], SN)
    B.rack((W / 2 + 3.0, -D / 2 - 2.0, 0), TIM, SN, rot=PI / 2)
    B.drifts([(0, D / 2 + 0.8, W + 2, 1.5), (W / 2 + 0.8, 0, 1.4, D)], M, h=0.8)
    finalize(name, 1024, ao_dist=1.2)

def lap_lodge_green(): _lap_lodge("lap_lodge_green", (0.42, 0.55, 0.47), "#3f5a4a", "BLACK MOUNTAIN LODGE")
def lap_lodge_charcoal(): _lap_lodge("lap_lodge_charcoal", (0.4, 0.4, 0.42), "#36506e", "STEILHANG HUT")

MODELS = {"lap_lodge_green": lap_lodge_green, "lap_lodge_charcoal": lap_lodge_charcoal, "highland_peak": highland_peak, "bootpack": bootpack, "the_aerie": the_aerie, "merry_go_round": merry_go_round, "sundeck": sundeck, "silver_queen_top": silver_queen_top, "thunderhead_lodge": thunderhead_lodge, "sunspot_lodge": sunspot_lodge, "village_block_a": village_block_a, "village_block_b": village_block_b, "village_block_c": village_block_c}
