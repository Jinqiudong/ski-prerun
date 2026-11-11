"""More signature buildings of the real Colorado resorts, continuing signature.py: Snowmass's Elk Camp and
Sam's, Winter Park's Snoasis, the small coloured huts (Cloud Nine at Highlands, Cliffhouse at Buttermilk), and
Steamboat's Wild Blue angle station with the Greenhorn Ranch learning centre beside it. The look follows the
photos named in each docstring; the parts come from signature.py, buildings.py and stations.py.

Origins on the ground at the middle of the footprint, fronts facing -Y, metres."""
import math
import bpy
from mathutils import Vector
from lib import *
import lib
import buildings as B
import stations as S
from signature import mats, win, glazing, flat_roof, seamed_roof, steel_rail, stack

PI = math.pi
Frame, W0 = B.Frame, B.W0

def gold_boards(): return textured("boards_gold", "fine_grained_wood", 1.4, (2.3, 1.85, 0.95), 0.8, "Z")

def rail_glass(p0, p1, z, M, h=1.05):
    """A glass balustrade in a dark steel frame with a crust of snow on the cap."""
    GR = glass("rail_glass", "#b8c8d4", 0.3)
    x0, y0 = p0; x1, y1 = p1; L = math.hypot(x1 - x0, y1 - y0); a = math.atan2(y1 - y0, x1 - x0); c = ((x0 + x1) / 2, (y0 + y1) / 2)
    box((L, 0.03, h - 0.12), (c[0], c[1], z + h / 2), GR, rot=(0, 0, a), kind="glass")
    box((L, 0.1, 0.07), (c[0], c[1], z + h), M["char"], rot=(0, 0, a))
    n = max(1, round(L / 1.6))
    for k in range(n + 1):
        t = k / n; box((0.07, 0.07, h), (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z + h / 2), M["char"])
    box((L, 0.18, 0.09), (c[0], c[1], z + h + 0.07), M["sn"], rot=(0, 0, a), bevel=0.035, seg=1, kind="snow")

def vault(x, y0, y1, w, z0, rise, M, mat="char", n=12, snow=0.4):
    """A shallow barrel vault running along Y from y0 to y1 over walls w apart whose tops are at z0: seamed
    metal, a dark fascia at both ends, a layer of snow on its crown."""
    R = (w * w / 4 + rise * rise) / (2 * rise); zc = z0 + rise - R; half = math.asin((w / 2) / R); L = y1 - y0
    for k in range(n):
        a0 = -half + 2 * half * k / n; a1 = -half + 2 * half * (k + 1) / n; am = (a0 + a1) / 2
        seg = 2 * R * math.sin((a1 - a0) / 2) + 0.03
        c = (x + R * math.sin(am), (y0 + y1) / 2, zc + R * math.cos(am))
        box((seg, L, 0.18), c, M[mat], rot=(0, am, 0))
        for e in (y0, y1): box((seg, 0.2, 0.4), (c[0], e, c[2] - 0.08), M["char"], rot=(0, am, 0))
        if abs(am) < half * 0.75 and snow:
            sc = (x + (R + 0.09 + snow / 2) * math.sin(am), (y0 + y1) / 2, zc + (R + 0.09 + snow / 2) * math.cos(am))
            slab((seg + 0.5, L - 0.3, snow), sc, M["sn"], rot=(0, am, 0))
    return lambda u: zc + math.sqrt(max(0.0, R * R - u * u))

# ---------- Snowmass: Elk Camp restaurant ----------
def elk_camp():
    """Elk Camp restaurant at the top of Snowmass's Elk Camp Gondola: boxy modern volumes clad in golden
    vertical boards over board-formed concrete, flat roofs on dark fascias with deep timber soffits. On the
    view side a two-storey dining block, its upper storey glazed in dark frames over a deck on a concrete
    plinth with glass rails; in the middle a hall under a shallow charcoal barrel vault with a glazed end; a
    lower one-storey wing to the west; at the back the golden box with the green Elk Camp panel and a concrete
    flue stack. Sources: liftblog.com Elk Camp Gondola photos (2017-02, from the line and beside the top
    station); gosnowmass.com Elk Camp page. OSM gives only a point: about 50 x 22 m is an estimate."""
    new_col("elk_camp"); M = mats(); B.anchor(M)
    GB, CO, CH, SN, ST = gold_boards(), M["conc"], M["char"], M["sn"], M["st"]
    FL = flat("formlines", "#95908a", 0.9, grain=0)
    # The dining block (east): concrete base storey, a glazed upper storey framed in golden boards.
    ex0, ex1, ey0, ey1, G, T = 6.0, 22.0, -8.0, 6.0, 3.8, 8.2
    exc, eyc = (ex0 + ex1) / 2, (ey0 + ey1) / 2
    box((ex1 - ex0, ey1 - ey0, G), (exc, eyc, G / 2), CO)
    for k in range(int(G / 0.3)): box((ex1 - ex0 + 0.02, ey1 - ey0 + 0.02, 0.02), (exc, eyc, 0.3 + k * 0.3), FL)
    box((ex1 - ex0 - 0.3, ey1 - ey0 - 0.3, T - G), (exc, eyc, (G + T) / 2), M["inner"])
    fr = Frame((exc, ey0, 0))
    for x0, x1 in ((-8.0, -6.6), (6.6, 8.0)): fr.box((x1 - x0, 0.3, T - G), ((x0 + x1) / 2, 0.0, (G + T) / 2), GB)
    glazing(fr, -6.6, 6.6, G + 0.15, T - 0.15, M, step=2.2, transoms=(G + 2.6,), y=-0.05, mull="char")
    for x in (-4.4, 0.0, 4.4): win(fr, x, 1.0, 2.6, 1.8, M, y=-0.05, fr="char", cols=2)
    sd = Frame((ex1, eyc, 0), PI / 2)  # the east side: glass to the front, golden boards to the back
    glazing(sd, -7.0, 1.0, G + 0.15, T - 0.15, M, step=2.0, transoms=(G + 2.6,), y=-0.05, mull="char")
    sd.box((6.0, 0.3, T - G), (4.0, 0.0, (G + T) / 2), GB)
    win(sd, 4.0, G + 1.0, 1.4, 2.2, M, y=-0.17, fr="char", snow=False)
    bk = Frame((exc, ey1, 0), PI)
    bk.box((ex1 - ex0, 0.3, T - G), (0, 0.0, (G + T) / 2), GB)
    for x in (-5.0, 0.0, 5.0): win(bk, x, G + 1.2, 1.4, 1.8, M, y=-0.17, fr="char", snow=False)
    flat_roof(ex0 - 0.6, ex1 + 1.6, ey0 - 2.2, ey1 + 0.6, T + 0.3, M, t=0.6, snow=0.6)
    # The deck along the view side at the upper floor: a concrete plinth, boards, glass rails, tables.
    dy = ey0 - 4.5
    box((ex1 - ex0 + 2.0, ey0 - dy, G - 0.2), (exc + 1.0, (ey0 + dy) / 2, (G - 0.2) / 2), CO)
    for k in range(int(G / 0.3)): box((ex1 - ex0 + 2.02, ey0 - dy + 0.02, 0.02), (exc + 1.0, (ey0 + dy) / 2, 0.3 + k * 0.3), FL)
    box((ex1 - ex0 + 1.9, ey0 - dy - 0.1, 0.06), (exc + 1.0, (ey0 + dy) / 2, G - 0.17), M["deck"])
    rail_glass((ex0 - 1.0 + 1.0, dy), (ex1 + 2.0, dy), G - 0.14, M)
    rail_glass((ex1 + 2.0, dy), (ex1 + 2.0, ey0), G - 0.14, M)
    for i, x in enumerate((9.0, 14.0, 19.0)): B.picnic((x, dy + 2.0, G - 0.14), M["deck"], SN, rot=0.04 * (i - 1))
    for x in (11.5, 16.5): B.parasol((x, dy + 2.1, G - 0.14), M["tim"], flat("cloth#36506e", "#36506e", 0.9), SN)
    B.pad((ex1 - ex0, 1.4, 0.18), (exc + 1.0, dy + 0.8, G - 0.05), SN)
    # The hall (middle): golden walls, a glazed front under a shallow charcoal vault.
    hx0, hx1, hy0, hy1, HT, HR = -10.0, 6.0, -6.0, 8.0, 5.0, 2.4
    hxc, hyc, hw = (hx0 + hx1) / 2, (hy0 + hy1) / 2, hx1 - hx0
    box((hw, hy1 - hy0, 0.9), (hxc, hyc, 0.45), CO)
    box((hw - 0.2, hy1 - hy0, HT - 0.9), (hxc, hyc, (0.9 + HT) / 2), GB)
    top = vault(hxc, hy0 - 1.2, hy1 + 0.4, hw + 1.0, HT, HR, M)
    hf = Frame((hxc, hy0 - 0.02, 0))
    glazing(hf, -hw / 2 + 1.0, hw / 2 - 1.0, 0.9, HT - 0.1, M, step=1.8, transoms=(3.1,), mull="char")
    B.door(hf, -2.0, 0.9, 2.2, 2.4, M, double=True, glazed=True, y=-0.15)
    nseg = 8  # the lunette under the vault: glass in a fan of dark mullions
    for k in range(nseg):
        u0 = -hw / 2 + 0.3 + k * (hw - 0.6) / nseg; u1 = u0 + (hw - 0.6) / nseg
        hh = min(top(u0), top(u1)) - HT - 0.45
        if hh > 0.15: hf.box((u1 - u0 - 0.1, 0.06, hh), ((u0 + u1) / 2, 0.04, HT + hh / 2), M["win"], kind="lit")
        hf.box((0.12, 0.16, max(0.2, max(top(u0), top(u1)) - HT - 0.3)), (u0, -0.04, HT + max(0.2, max(top(u0), top(u1)) - HT - 0.3) / 2), CH)
    hf.box((hw + 0.2, 0.3, 0.3), (0, -0.05, HT), CH)
    for s in (-1, 1): box((0.3, hy1 - hy0, HT - 0.9), (hxc + s * (hw / 2 - 0.05), hyc, (0.9 + HT) / 2), GB)
    stx, sty = hxc + 4.0, hy1 - 3.0
    box((1.4, 1.4, 4.4), (stx, sty, top(4.0) + 1.0), CO); box((1.6, 1.6, 0.2), (stx, sty, top(4.0) + 3.25), CH)
    B.pad((1.4, 1.4, 0.22), (stx, sty, top(4.0) + 3.45), SN)
    # The west wing: one storey of golden boards on a concrete plinth, windows, a flat roof.
    wx0, wx1, wy0, wy1, WT = -27.0, -10.0, -4.0, 8.0, 4.4
    wxc, wyc = (wx0 + wx1) / 2, (wy0 + wy1) / 2
    box((wx1 - wx0, wy1 - wy0, 0.9), (wxc, wyc, 0.45), CO)
    box((wx1 - wx0 - 0.1, wy1 - wy0 - 0.1, WT - 0.9), (wxc, wyc, (0.9 + WT) / 2), GB)
    wf = Frame((wxc, wy0 - 0.02, 0))
    for x in (-6.0, -2.0, 2.0): win(wf, x, 1.4, 2.6, 2.0, M, fr="char", cols=2)
    B.door(wf, 6.0, 0.9, 1.6, 2.3, M, glazed=True)
    win(Frame((wx0 - 0.02, wyc, 0), -PI / 2), 0, 1.4, 3.0, 2.0, M, fr="char", cols=3)
    flat_roof(wx0 - 0.8, wx1, wy0 - 1.0, wy1 + 0.6, WT + 0.25, M, t=0.45, snow=0.65)
    for x in (wx0 + 4.0, wx0 + 9.0): box((1.8, 1.4, 0.9), (x, wy1 - 2.5, WT + 0.9), M["steel2"]); B.pad((1.8, 1.4, 0.2), (x, wy1 - 2.5, WT + 1.45), SN)
    # The back (uphill) box with the Elk Camp panel.
    bf = Frame((hxc + 1.0, hy1 + 0.02, 0), PI)
    bf.box((4.0, 0.12, 4.0), (0, -0.04, 2.6), M["pine"], bevel=0.03)
    bf.box((4.3, 0.1, 4.3), (0, 0.0, 2.6), M["char"])
    text("ELK", 0.9, bf.p(0, -0.14, 2.4), M["cream"], rot=(PI / 2, 0, bf.a), extrude=0.02)
    text("CAMP", 0.62, bf.p(0, -0.14, 1.4), M["cream"], rot=(PI / 2, 0, bf.a), extrude=0.02)
    # Antlers over the letters: two tines each side.
    for s in (-1, 1):
        S.rod(bf.p(s * 0.3, -0.14, 3.2), bf.p(s * 1.0, -0.14, 4.2), 0.06, M["cream"])
        S.rod(bf.p(s * 0.65, -0.14, 3.7), bf.p(s * 0.45, -0.14, 4.3), 0.05, M["cream"])
    # Out front: the ski racks and tables on the snow before the hall.
    for x in (-8.0, 2.0): B.rack((x, hy0 - 7.0, 0), M["tim"], SN, rot=PI / 2)
    for i, x in enumerate((-20.0, -15.0)): B.picnic((x, wy0 - 4.0, 0), M["deck"], SN, rot=0.05 * i)
    B.drifts([(wxc, wy1 + 0.8, wx1 - wx0, 1.4), (wx0 - 0.8, wyc, 1.4, wy1 - wy0), (exc, ey1 + 0.8, ex1 - ex0, 1.5)], M, h=0.8)
    finalize("elk_camp", 2048, ao_dist=1.5)


def metal_gable(c, span, a0, a1, z0, rise, over, M, mat, axis="y", snow=0.45, fascia="tim"):
    """A standing-seam gable roof: ridge along `axis` through c (the x for a Y ridge, the y for an X ridge),
    from a0 to a1, over walls span apart with tops at z0; eaves `over` out, fascia boards, snow, a ridge cap."""
    ze = z0 - over * rise / (span / 2); zr = z0 + rise
    for s in (-1, 1):
        seamed_roof(a0, a1, c + s * (span / 2 + over), c, ze, zr, M, mat=mat, snow=snow, axis=axis)
        if axis == "y": box((0.12, a1 - a0, 0.3), (c + s * (span / 2 + over), (a0 + a1) / 2, ze - 0.08), M[fascia])
        else: box((a1 - a0, 0.12, 0.3), ((a0 + a1) / 2, c + s * (span / 2 + over), ze - 0.08), M[fascia])
    L = math.hypot(span / 2 + over, zr - ze); ang = math.atan2(zr - ze, span / 2 + over)
    for e in (a0, a1):  # barge boards along the rakes
        for s in (-1, 1):
            if axis == "y": box((L, 0.1, 0.3), (c + s * (span / 2 + over) / 2, e, (ze + zr) / 2 - 0.05), M[fascia], rot=(0, s * ang, 0))
            else: box((0.1, L, 0.3), ((e), c + s * (span / 2 + over) / 2, (ze + zr) / 2 - 0.05), M[fascia], rot=(-s * ang, 0, 0))
    if axis == "y": box((0.3, a1 - a0, 0.16), (c, (a0 + a1) / 2, zr + 0.1), M["seam"])
    else: box((a1 - a0, 0.3, 0.16), ((a0 + a1) / 2, c, zr + 0.1), M["seam"])
    return lambda u: zr - abs(u) * rise / (span / 2) + 0.1

# ---------- Snowmass: Sam's ----------
def sams():
    """Sam's, on top of Sam's Knob at Snowmass (rebuilt 2009, an Italian rifugio since 2019): one steep hall
    under a charcoal standing-seam gable, its valley-side gable end glazed to the ridge behind exposed dark
    timber trusses that carry the roof out over the deck on timber posts; dark stained board walls on a stone
    base, a lower kitchen wing in grey metal panels, a deck with glass rails and tables.
    Sources: research notes (aspensnowmass.com Sam's page, postindependent.com rebuild article). No exterior
    photo was found; liftblog's 2017 Sam's Knob photos show only a red-brown roof edge beyond the lift.
    OSM gives only a point: 16 x 26 m plus the wing is an estimate."""
    new_col("sams"); M = mats(); B.anchor(M)
    DB = textured("boards_stained", "old_planks_02", 1.6, (0.46, 0.4, 0.36), 0.85, "Z")
    ST, TIM, SN, CH = M["st"], M["tim"], M["sn"], M["char"]
    MC = dict(M); MC["roof"] = CH
    W, D, F, T = 16.0, 26.0, 1.3, 5.0; R = W / 2 * 1.05; fy = -D / 2
    box((W + 0.4, D + 0.4, F), (0, 0, F / 2), ST, bevel=0.05)
    box((W, D, T - F), (0, 0, (F + T) / 2), DB)
    box((W + 0.3, D + 0.3, 0.14), (0, 0, F + 0.07), TIM)
    for sx in (-1, 1):
        for sy in (-1, 1): box((0.3, 0.3, T - F), (sx * W / 2, sy * D / 2, (F + T) / 2), TIM)
    B.gable_wall(Frame((0, D / 2, 0), PI), W, 0, T, R, DB, 0.2)
    # The glazed gable end, its dark timber grid.
    g = Frame((0, fy - 0.03, 0))
    g.box((W - 0.6, 0.06, T - F - 0.1), (0, 0.02, (F + T) / 2), M["win"], kind="lit")
    g.prism([(-W / 2 + 0.3, 0.02, T), (W / 2 - 0.3, 0.02, T), (0, 0.02, T + R - 0.4)], 0.05, M["win"], kind="lit")
    for k in range(9):
        x = -W / 2 + 0.3 + k * (W - 0.6) / 8; h = T - F + R * (1 - abs(x) / (W / 2)) - 0.3
        g.box((0.14, 0.18, h), (x, -0.04, F + h / 2), TIM)
    for z in (F + 2.7, T, T + 2.4, T + 4.8):
        hw = W / 2 - 0.3 if z <= T else (W / 2) * (1 - (z - T) / R) - 0.1
        if hw > 0.3: g.box((2 * hw, 0.18, 0.14), (0, -0.04, z), TIM)
    B.door(g, 0, F, 2.4, 2.5, M, double=True, glazed=True, y=-0.1)
    # The roof runs 3.4 m past the glass on two exposed king-post trusses and posts.
    yo = fy - 3.4
    ga, top = B.gable_roof(Frame((0, 0, 0)), W, yo - 0.4, D / 2 + 0.9, T, R, 1.1, MC, thick=0.34, st=0.55, ice=16)
    for k, y in enumerate((yo + 0.2, fy - 1.5)):
        B.truss(Frame((0, y, 0)), W + 0.4, 0, T - 0.1, R - 0.55, M, r=0.36)
        if k == 0:
            for s in (-1, 1):
                x = s * (W / 2 - 0.1)
                box((0.9, 0.9, 0.7), (x, y, F + 0.35), ST, bevel=0.04)
                box((0.4, 0.4, T - F - 0.8), (x, y, (F + 0.7 + T - 0.1) / 2), TIM, bevel=0.03)
                box((0.24, 0.24, 1.8), (x - s * 0.6, y, T - 0.8), TIM, rot=(0, s * 0.75, 0))
                B.pad((0.9, 0.9, 0.14), (x, y, F + 0.78), SN)
    for x in (-W / 4, 0, W / 4): box((0.26, 3.4, 0.3), (x, (fy + yo) / 2, top(x) - 0.75), TIM)
    # Side windows, tall, between posts; the back with a door and a small window high in the gable.
    for s in (-1, 1):
        e = Frame((s * (W / 2 + 0.02), 0, 0), s * PI / 2)
        for k in range(5):
            y = -D / 2 + 3.0 + k * 4.6
            if s > 0 and y > 0: continue
            win(e, y, F + 0.7, 1.6, 2.6, M, cols=2)
    bk = Frame((0, D / 2 + 0.03, 0), PI)
    B.door(bk, 3.0, F - 1.0, 1.2, 2.3, M); win(bk, -3.0, F + 0.8, 1.6, 1.6, M); win(bk, 0, T + 1.6, 1.8, 1.6, M, snow=False)
    for k in range(2): box((1.4, 0.4, 0.2), (3.0, D / 2 + 0.5 + k * 0.38, F - 1.1 - k * 0.3), ST, bevel=0.03)
    # The kitchen wing on the east: grey metal panels, a flat roof under snow, flues.
    kx0, kx1, ky0, ky1, KT = W / 2, W / 2 + 9.0, -1.0, D / 2 - 1.0, 4.4
    kxc, kyc = (kx0 + kx1) / 2, (ky0 + ky1) / 2
    box((kx1 - kx0, ky1 - ky0, F), (kxc, kyc, F / 2), ST)
    box((kx1 - kx0, ky1 - ky0, KT - F), (kxc, kyc, (F + KT) / 2), M["steel2"])
    for k in range(int((ky1 - ky0) / 0.5)): box((0.04, 0.03, KT - F), (kx1 + 0.01, ky0 + 0.25 + k * 0.5, (F + KT) / 2), CH)
    for k in range(int((kx1 - kx0) / 0.5)): box((0.03, 0.04, KT - F), (kx0 + 0.25 + k * 0.5, ky0 - 0.01, (F + KT) / 2), CH)
    win(Frame((kxc, ky0 - 0.03, 0)), 0, F + 0.9, 3.0, 1.4, M, fr="char", cols=3)
    flat_roof(kx0, kx1 + 0.6, ky0 - 0.6, ky1 + 0.6, KT + 0.2, M, t=0.4, snow=0.6, soffit="char")
    for y in (2.0, 6.0): cyl(0.22, 2.4, (kxc + 2, y, KT + 1.2), M["steel"], verts=12); cyl(0.36, 0.2, (kxc + 2, y, KT + 2.45), M["steel"], verts=12)
    # The deck before the glass: on the stone plinth's level, glass rails, tables, steps down to the snow.
    dd = 9.0; dy = fy - dd
    box((W + 8.0, dd, F), (1.0, (fy + dy) / 2, F / 2), ST, bevel=0.04)
    box((W + 7.9, dd - 0.1, 0.06), (1.0, (fy + dy) / 2, F + 0.02), M["deck"])
    rail_glass((-W / 2 - 3.0, dy), (-2.0, dy), F, M); rail_glass((2.0, dy), (W / 2 + 5.0, dy), F, M)
    for x in (-W / 2 - 3.0, W / 2 + 5.0): rail_glass((x, dy), (x, fy), F, M)
    for i in range(4): box((4.0, 0.42, 0.2), (0, dy - 0.25 - i * 0.4, F - 0.25 - i * 0.3), ST, bevel=0.03)
    for i, (x, y) in enumerate(((-7.0, dy + 2.5), (-1.5, dy + 6.0), (5.0, dy + 2.5), (9.5, dy + 6.0), (-7.0, dy + 6.5), (5.0, dy + 6.3))):
        B.picnic((x, y, F + 0.05), M["deck"], SN, rot=0.05 * (i % 3 - 1))
    for x, col in ((-4.2, "#8e3b32"), (8.0, "#e6dac3")): B.parasol((x, dy + 4.2, F + 0.05), TIM, flat("cloth" + col, col, 0.9), SN)
    for x in (-12.0, 14.0): B.rack((x, dy - 3.0, 0), TIM, SN, rot=PI / 2)
    B.drifts([(0, D / 2 + 1.0, W + 2, 1.6), (-W / 2 - 1.0, 4.0, 1.4, D - 8), (kx1 + 0.9, kyc, 1.4, ky1 - ky0)], M, h=0.8)
    finalize("sams", 2048, ao_dist=1.5)

# ---------- Winter Park: Snoasis ----------
def snoasis():
    """Snoasis, Winter Park's mid-mountain lodge: white rendered walls under one big asymmetric gable of
    slate-grey metal, its front gable end a tall wall of glass in gold-bronze mullions rising to the peak, the
    roof running out over it on honey glulam rakes; the name in dark letters on the white wall beside the glass;
    a flat-roofed white wing to the west; a concrete patio with picnic tables and steel ski racks.
    Sources: winterparkresort.com Snoasis page photos (front and dining room); OSM way 85932018 (44 x 38 m,
    the wing included). Built here 26 x 24 m for the hall, 12 x 16 m for the wing."""
    new_col("snoasis"); M = mats(); B.anchor(M)
    WH = flat("render_white", "#e9e6df", 0.9, grain=0.04); BZ = flat("bronze", "#8c6c3c", 0.45, grain=0)
    SL = flat("roof_slate", "#5b636c", 0.5, grain=0.03); M["slate"] = SL; M["bronze"] = BZ
    SN, CO = M["sn"], M["conc"]
    x0, x1, y0, y1 = -13.0, 13.0, -12.0, 12.0; xr, zr, zl, zrt = 2.5, 12.5, 3.6, 6.6
    roofz = lambda x: zl + (zr - zl) * (x - x0) / (xr - x0) if x <= xr else zrt + (zr - zrt) * (x1 - x) / (x1 - xr)
    box((x1 - x0 + 0.3, y1 - y0 + 0.3, 0.45), (0, 0, 0.22), CO)
    box((x1 - x0, y1 - y0, zl), (0, 0, zl / 2), WH)
    box((x1 - xr, y1 - y0, zrt - zl), ((x1 + xr) / 2, 0, (zl + zrt) / 2), WH)
    Frame((0, 0, 0)).prism([(x0, y0, zl), (xr, y0, zl), (xr, y0, zr)], y1 - y0, WH)
    Frame((0, 0, 0)).prism([(xr, y0, zl), (x1, y0, zl), (x1, y0, zrt), (xr, y0, zr)], y1 - y0, WH)
    # The glass wall: from the patio to just under the roof between gx0 and gx1, bronze grid.
    gx0, gx1, gy = -8.5, 8.0, y0 - 0.06
    pts = [(gx0, gy, 0.45), (gx1, gy, 0.45), (gx1, gy, roofz(gx1) - 0.7), (xr, gy, zr - 0.7), (gx0, gy, roofz(gx0) - 0.7)]
    Frame((0, 0, 0)).prism(pts, 0.05, M["win"], kind="lit")
    n = 12
    for k in range(n + 1):
        x = gx0 + k * (gx1 - gx0) / n; h = roofz(x) - 0.7 - 0.45
        box((0.16, 0.2, h), (x, gy - 0.06, 0.45 + h / 2), BZ)
    for z in (0.45, 2.9, 5.3, 7.7, 10.1):
        xa = gx0 if z <= roofz(gx0) - 0.7 else x0 + (z + 0.7 - zl) / (zr - zl) * (xr - x0)
        xb = gx1 if z <= roofz(gx1) - 0.7 else x1 - (z + 0.7 - zrt) / (zr - zrt) * (x1 - xr)
        if xb - xa > 0.5: box((xb - xa, 0.2, 0.16), ((xa + xb) / 2, gy - 0.06, z), BZ)
    for s in (-1, 1):  # raking bronze frame along the glass's top
        xa, xb = (gx0, xr) if s < 0 else (xr, gx1); za, zb = roofz(xa) - 0.7, roofz(xb) - 0.7
        L = math.hypot(xb - xa, zb - za); a = math.atan2(zb - za, xb - xa)
        box((L, 0.22, 0.2), ((xa + xb) / 2, gy - 0.06, (za + zb) / 2), BZ, rot=(0, -a, 0))
    B.door(Frame((0, 0, 0)), -1.6, 0.45, 2.2, 2.5, M, double=True, glazed=True, y=gy - 0.1)
    B.door(Frame((0, 0, 0)), 1.6, 0.45, 2.2, 2.5, M, double=True, glazed=True, y=gy - 0.1)
    text("Snoasis", 1.1, (10.6, y0 - 0.12, 5.2), M["steel"], extrude=0.04)
    for x in (10.0, 11.6): box((0.18, 0.2, 0.5), (x, y0 - 0.12, 3.6), M["steel"])
    win(Frame((11.0, y0 - 0.02, 0)), 0, 1.0, 2.4, 1.6, M, fr="steel2", cols=2)
    # The roof: slate metal on both slopes, running 2.6 m out over the glass on honey glulam rakes.
    ov, yf = 1.4, y0 - 2.6
    sl = (zr - zl) / (xr - x0); sr = (zr - zrt) / (x1 - xr)
    seamed_roof(yf, y1 + 0.8, x0 - ov, xr, zl - ov * sl, zr, M, mat="slate", snow=0.55, axis="y")
    seamed_roof(yf, y1 + 0.8, x1 + ov, xr, zrt - ov * sr, zr, M, mat="slate", snow=0.55, axis="y")
    for xa, za, xb, zb in ((x0 - ov, zl - ov * sl, xr, zr), (xr, zr, x1 + ov, zrt - ov * sr)):
        L = math.hypot(xb - xa, zb - za); a = math.atan2(zb - za, xb - xa)
        for y in (yf + 0.1, y0 - 0.3):
            box((L, 0.32, 0.5), ((xa + xb) / 2, y, (za + zb) / 2 - 0.4), M["honey"], rot=(0, -a, 0))
        for k in range(4):
            t = (k + 0.5) / 4; box((0.24, y0 - yf, 0.3), (xa + (xb - xa) * t, (yf + y0) / 2, za + (zb - za) * t - 0.45), M["honey"])
    box((0.4, y1 - yf + 0.8, 0.3), (xr, (yf + y1 + 0.8) / 2, zr + 0.12), M["seam"])
    # The sides: windows in the white walls; the back with a service door.
    for y in (-7.0, -1.0, 5.0): win(Frame((x1 + 0.02, y, 0), PI / 2), 0, 1.2, 2.4, 2.0, M, fr="steel2")
    B.door(Frame((4.0, y1 + 0.02, 0), PI), 0, 0.45, 1.4, 2.3, M)
    for x in (-6.0, 0.0): win(Frame((x, y1 + 0.02, 0), PI), 0, 1.2, 2.0, 1.6, M, fr="steel2")
    # The west wing: one storey of white render, a flat roof, a row of windows to the patio.
    wx0, wx1, wy0, wy1, WT = x0 - 12.0, x0, -4.0, 12.0, 4.4
    box((wx1 - wx0, wy1 - wy0, WT), ((wx0 + wx1) / 2, (wy0 + wy1) / 2, WT / 2), WH)
    for x in (-3.5, 0.0, 3.5): win(Frame(((wx0 + wx1) / 2, wy0 - 0.02, 0)), x, 1.2, 2.4, 2.0, M, fr="steel2")
    flat_roof(wx0 - 0.5, wx1 + 0.1, wy0 - 1.0, wy1 + 0.5, WT + 0.2, M, t=0.4, snow=0.6, soffit="char")
    # The patio: concrete, picnic tables, steel ski racks, snow banked round.
    py0, py1 = y0 - 11.0, y0
    box((x1 - x0 + 14.0, py1 - py0, 0.25), (-5.0, (py0 + py1) / 2, 0.12), CO)
    for i, (x, y) in enumerate(((-6.0, -15.0), (-1.0, -16.0), (4.0, -15.0), (8.5, -16.5), (-11.0, -17.0), (2.0, -20.0))):
        B.picnic((x, y, 0.25), M["deck"], SN, rot=0.06 * (i % 3 - 1), STL=M["steel"])
    for x in (-16.0, -10.5, 12.5): B.rack((x, py0 + 1.5, 0.25), M["steel2"], SN, rot=0.0)
    B.drifts([(0, y1 + 1.0, x1 - x0, 1.6), (x1 + 1.0, 0, 1.4, y1 - y0), ((wx0 + wx1) / 2, wy1 + 0.9, wx1 - wx0, 1.4)], M, h=0.9)
    finalize("snoasis", 2048, ao_dist=1.5)

# ---------- the small coloured huts ----------
def cloud_nine():
    """Cloud Nine Alpine Bistro, Aspen Highlands (10,900 ft), a former patrol hut: two small wings of dark
    green-stained horizontal boards under crossing maroon-red standing-seam gables, maroon window frames, a
    long low red-roofed back wing, a red-roofed shed by the deck, and the packed deck on the downhill side with
    green rails and glass panes. Sources: Wikimedia Commons "Aspen Highlands cloud 9" (Wolfgang Moroder,
    looking down on the hut); aspensnowmass.com Cloud Nine hero (wall and window close up); OSM way 151179407
    (20.5 x 16.5 m)."""
    new_col("cloud_nine"); M = mats(); B.anchor(M)
    WG = textured("boards_dkgreen", "old_planks_02", 1.2, (0.4, 0.5, 0.45), 0.85, "X")
    M["maroon"] = flat("trim_maroon", "#6e2a2a", 0.6, grain=0); M["rd"] = flat("roof_red", "#8a2f2a", 0.5, grain=0.03)
    MR = dict(M); MR["seam"] = flat("seam_red", "#6f2520", 0.5, grain=0)
    GR, ST, SN, TIM = flat("rail_green", "#3a5444", 0.6, grain=0.03), M["st"], M["sn"], M["tim"]
    LN = flat("lapline", "#1d2120", 0.8, grain=0)
    def wing(x0, x1, y0, y1, F, T):
        box((x1 - x0 + 0.2, y1 - y0 + 0.2, F), ((x0 + x1) / 2, (y0 + y1) / 2, F / 2), ST, bevel=0.04)
        box((x1 - x0, y1 - y0, T - F), ((x0 + x1) / 2, (y0 + y1) / 2, (F + T) / 2), WG)
        for k in range(int((T - F) / 0.2)):
            z = F + 0.15 + k * 0.2
            for y in (y0 - 0.01, y1 + 0.01): box((x1 - x0, 0.02, 0.02), ((x0 + x1) / 2, y, z), LN)
            for x in (x0 - 0.01, x1 + 0.01): box((0.02, y1 - y0, 0.02), (x, (y0 + y1) / 2, z), LN)
        for x in (x0, x1):
            for y in (y0, y1): box((0.16, 0.16, T - F), (x, y, (F + T) / 2), TIM)
    # Wing A (west): ridge along Y, its gable end to the deck. Wing B (east): ridge along X.
    F, T = 0.6, 3.3
    wing(-10.0, -2.0, -5.0, 6.0, F, T)
    B.gable_wall(Frame((-6.0, -5.0, 0)), 8.0, 0, T, 1.9, WG, 0.2); B.gable_wall(Frame((-6.0, 6.0, 0), PI), 8.0, 0, T, 1.9, WG, 0.2)
    metal_gable(-6.0, 8.0, -6.0, 6.8, T, 1.9, 0.8, MR, "rd", axis="y", snow=0.35)
    wing(-2.0, 8.0, -3.0, 5.0, F, T)
    for s in (-1, 1): B.gable_wall(Frame((-2.0 if s < 0 else 8.0, 1.0, 0), s * PI / 2), 8.0, 0, T, 1.9, WG, 0.2)
    metal_gable(1.0, 8.0, -2.0, 8.8, T, 1.9, 0.8, MR, "rd", axis="x", snow=0.35)
    # The back wing: low, a shed roof sloping away.
    box((14.0, 6.0, 2.8), (3.0, 8.0, 1.4), WG)
    seamed_roof(-4.5, 10.5, 11.6, 5.0, 2.5, 3.3, MR, mat="rd", snow=0.3)
    # Windows in maroon frames, the door, the elevation sign, the name in pale blue.
    fa = Frame((-6.0, -5.02, 0))
    win(fa, -2.0, F + 0.6, 2.6, 1.6, M, fr="maroon", cols=2); win(fa, 2.0, F + 0.6, 2.2, 1.6, M, fr="maroon", cols=2)
    win(fa, 0, T + 0.4, 1.2, 0.9, M, fr="maroon", cols=1, snow=False)
    fb = Frame((3.0, -3.02, 0))
    B.door(fb, -2.6, F, 1.1, 2.1, M); win(fb, 0.5, F + 0.7, 2.0, 1.4, M, fr="maroon", cols=2); win(fb, 3.5, F + 0.7, 1.4, 1.4, M, fr="maroon", cols=1)
    fw = Frame((-10.02, 0.5, 0), -PI / 2)
    win(fw, 2.5, F + 0.7, 2.4, 1.5, M, fr="maroon", cols=2)
    text("CLOUD NINE", 0.42, fw.p(-1.8, -0.05, 2.4), flat("pale_blue", "#9cc3e6", 0.6, grain=0), rot=(PI / 2, 0, fw.a), extrude=0.01)
    box((1.0, 0.04, 0.24), fb.p(-0.5, -0.04, 2.95), M["cream"])
    cyl(0.12, 1.5, (-7.0, 2.0, 5.6), M["steel"], verts=10); cyl(0.2, 0.15, (-7.0, 2.0, 6.4), M["steel"], verts=10)
    box((1.0, 0.8, 0.7), (4.0, 3.0, 5.1), M["steel2"])
    # The deck below wing A: boards on posts, green rails with glass panes, tables.
    dx0, dx1, dy0, dy1 = -13.0, 0.0, -12.5, -5.0
    box((dx1 - dx0, dy1 - dy0, 0.3), ((dx0 + dx1) / 2, (dy0 + dy1) / 2, F - 0.15), TIM, bevel=0.02)
    for i in range(int((dy1 - dy0) / 0.3)): box((dx1 - dx0 - 0.1, 0.27, 0.05), ((dx0 + dx1) / 2, dy0 + 0.15 + i * 0.3, F + 0.02), M["deck"])
    GL = glass("rail_glass", "#b8c8d4", 0.3)
    for (xa, ya, xb, yb) in ((dx0, dy0, dx1, dy0), (dx0, dy0, dx0, dy1), (dx1, dy0, dx1, dy0 + 3.0)):
        L = math.hypot(xb - xa, yb - ya); a = math.atan2(yb - ya, xb - xa); c = ((xa + xb) / 2, (ya + yb) / 2)
        n = max(1, round(L / 1.5))
        for k in range(n + 1): box((0.12, 0.12, 1.1), (xa + (xb - xa) * k / n, ya + (yb - ya) * k / n, F + 0.55), GR)
        box((L, 0.14, 0.1), (c[0], c[1], F + 1.1), GR, rot=(0, 0, a)); box((L, 0.03, 0.8), (c[0], c[1], F + 0.55), GL, rot=(0, 0, a), kind="glass")
        box((L, 0.2, 0.09), (c[0], c[1], F + 1.2), SN, rot=(0, 0, a), bevel=0.035, seg=1, kind="snow")
    for i, (x, y) in enumerate(((-10.5, -10.0), (-6.5, -10.0), (-2.5, -10.0), (-10.5, -7.2), (-6.5, -7.2), (-2.5, -7.4))):
        B.picnic((x, y, F + 0.05), M["deck"], SN, rot=PI / 2 + 0.05 * (i % 3 - 1))
    # The shed by the deck.
    box((3.0, 2.6, 2.4), (2.0, -9.0, 1.2), WG)
    metal_gable(-9.0, 2.6, 0.2, 3.8, 2.4, 0.9, 0.35, MR, "rd", axis="x", snow=0.25)
    B.door(Frame((2.0, -10.32, 0)), 0, 0.1, 0.9, 1.9, M, lite=False)
    for x in (4.5, 11.0): B.rack((x, -7.5, 0), TIM, SN, rot=PI / 2)
    B.drifts([(-6.0, 12.0, 14.0, 1.4), (10.0, 4.0, 1.4, 8.0)], M, h=0.8)
    finalize("cloud_nine", 1024, ao_dist=1.2)

def cliffhouse():
    """Cliffhouse at the top of Buttermilk's Summit Express: a cabin of green horizontal lap siding under a
    low gable of snow-covered metal, brown fascia and barge boards on rafter brackets, cream window trim, a
    red door under the oval red-and-gold Cliffhouse sign, a roof fan, a lower board-and-batten wing to the
    east with icicles, the red gong frame beside it, Pyramid Peak behind. Sources: aspensnowmass.com
    Cliffhouse hero photo (2021). Not in OSM: about 9 x 14 m plus the wing."""
    new_col("cliffhouse"); M = mats(); B.anchor(M)
    GL = textured("lap_green", "old_planks_02", 1.2, (0.62, 0.9, 0.78), 0.85, "X")
    GB = textured("batten_green", "old_planks_02", 1.4, (0.6, 0.86, 0.74), 0.85, "Z")
    BR = flat("trim_brown", "#5a3a26", 0.7, grain=0.05); M["brown"] = BR; M["cream_fr"] = M["cream"]
    MB = dict(M); MB["tim"] = BR
    LN = flat("lapline", "#26302c", 0.8, grain=0)
    ST, SN = M["st"], M["sn"]
    W, D, F, T, R = 9.0, 14.0, 0.3, 3.4, 1.6
    box((W + 0.2, D + 0.2, F), (0, 0, F / 2), ST, bevel=0.03)
    box((W, D, T - F), (0, 0, (F + T) / 2), GL)
    for k in range(int((T - F) / 0.18)):
        z = F + 0.12 + k * 0.18
        for y in (-D / 2 - 0.01, D / 2 + 0.01): box((W, 0.02, 0.02), (0, y, z), LN)
        box((0.02, D, 0.02), (-W / 2 - 0.01, 0, z), LN)
    for sy in (-1, 1):
        Frame((0, sy * D / 2, 0), 0 if sy < 0 else PI).prism([(-W / 2, 0, T), (W / 2, 0, T), (0, 0, T + R)], 0.15, GL)
        for sx in (-1, 1): box((0.16, 0.16, T - F), (sx * W / 2, sy * D / 2, (F + T) / 2), M["cream"])
    for k in range(int(R / 0.18)):
        z = T + 0.1 + k * 0.18; hw = W / 2 * (1 - (z - T) / R)
        box((2 * hw, 0.02, 0.02), (0, -D / 2 - 0.01, z), LN)
    over = 0.7
    top = metal_gable(0.0, W, -D / 2 - over, D / 2 + over, T, R, over, MB, "galv", axis="y", snow=0.55, fascia="brown")
    for e in (-D / 2 - over, D / 2 + over):  # rafter brackets under the barge boards
        for s in (-1, 1):
            for k in range(4):
                x = s * (0.6 + k * 1.3); z = T + R * (1 - abs(x) / (W / 2)) - 0.25
                box((0.12, 0.7, 0.14), (x, e + (0.35 if e < 0 else -0.35), z), BR)
    fr = Frame((0, -D / 2 - 0.02, 0))
    DR = flat("door_red", "#a8322b", 0.5, grain=0)
    fr.box((1.0, 0.08, 2.1), (0, -0.02, F + 1.05), DR); fr.box((0.06, 0.05, 0.2), (0.35, -0.08, F + 1.0), M["steel"])
    for s in (-1, 1): fr.box((0.12, 0.12, 2.2), (s * 0.58, -0.04, F + 1.1), M["cream"])
    fr.box((1.4, 0.14, 0.14), (0, -0.04, F + 2.25), M["cream"])
    for x in (-2.6, 2.6): win(fr, x, F + 0.9, 1.4, 1.3, M, fr="cream_fr", cols=2)
    sg = fr.cyl(0.95, 0.1, (0, -0.08, T + 0.25), flat("sign_red", "#b3282a", 0.5, grain=0), rot=(PI / 2, 0, 0), verts=32)
    sg.scale = (1.0, 0.62, 1.0)
    rim = fr.cyl(1.0, 0.08, (0, -0.04, T + 0.25), flat("sign_gold", "#d9a52a", 0.5, grain=0), rot=(PI / 2, 0, 0), verts=32); rim.scale = (1.0, 0.62, 1.0)
    text("CLIFFHOUSE", 0.26, fr.p(0, -0.16, T + 0.22), flat("sign_yellow", "#f2c94c", 0.5, grain=0), rot=(PI / 2, 0, 0), extrude=0.01)
    B.lantern(fr, -1.0, F + 2.0, M)
    for y in (-3.0, 2.5): win(Frame((-W / 2 - 0.02, y, 0), -PI / 2), 0, F + 0.9, 1.6, 1.3, M, fr="cream_fr", cols=2)
    # The east wing: lower board-and-batten, a shed roof with icicles, a window to the deck.
    ex0, ex1, ey0, ey1, ET = W / 2, W / 2 + 7.0, -5.5, 6.0, 2.45
    box((ex1 - ex0, ey1 - ey0, ET), ((ex0 + ex1) / 2, (ey0 + ey1) / 2, ET / 2), GB)
    for k in range(int((ex1 - ex0) / 0.45)): box((0.06, 0.04, ET - 0.2), (ex0 + 0.2 + k * 0.45, ey0 - 0.02, ET / 2), BR)
    win(Frame(((ex0 + ex1) / 2, ey0 - 0.02, 0)), 0, 0.8, 2.2, 1.2, M, fr="cream_fr", cols=2)
    seamed_roof(ey0 - 0.6, ey1 + 0.4, ex1 + 0.6, ex0 - 0.2, ET - 0.05, ET + 0.6, M, mat="galv", snow=0.4, axis="y")
    for i in range(18):
        y = ey0 + 0.2 + rnd.random() * (ey1 - ey0 - 0.4); h = 0.2 + rnd.random() * 0.7
        cyl(0.0, h, (ex1 + 0.62, y, ET - 0.2 - h / 2), M["ice"], verts=5, r2=0.05, kind="ice")
    # On the roof: the kitchen fan and a condenser box; the stove flue.
    zf = top(1.4)
    cyl(0.45, 0.5, (1.4, 2.0, zf + 0.2), M["galv"], verts=16); cyl(0.55, 0.12, (1.4, 2.0, zf + 0.5), M["galv"], verts=16)
    box((1.0, 0.8, 0.7), (-1.6, -3.5, top(1.6) + 0.3), M["galv"])
    # The red gong frame, a ski rack, tables in the snow.
    gx, gy = -W / 2 - 4.0, -D / 2 - 2.5
    RG = flat("gong_red", "#b3282a", 0.5, grain=0)
    for s in (-1, 1): box((0.14, 0.14, 2.3), (gx + s * 0.8, gy, 1.15), RG)
    box((2.0, 0.18, 0.16), (gx, gy, 2.3), RG); box((2.3, 0.3, 0.1), (gx, gy, 2.45), RG)
    cyl(0.42, 0.06, (gx, gy, 1.5), flat("bronze_gong", "#8c6c3c", 0.4, grain=0), rot=(PI / 2, 0, 0), verts=24)
    B.pad((2.2, 0.3, 0.1), (gx, gy, 2.55), SN)
    B.rack((-W / 2 - 1.8, -D / 2 - 5.5, 0), M["steel2"], SN, rot=0.0)
    for i, x in enumerate((3.0, 8.0)): B.picnic((x, -D / 2 - 4.0, 0), M["deck"], SN, rot=0.06 * i)
    B.drifts([(0, D / 2 + 0.8, W + 1, 1.4), (-W / 2 - 0.8, 0, 1.4, D)], M, h=0.7)
    finalize("cliffhouse", 1024, ao_dist=1.2)


# ---------- Steamboat: the Wild Blue Gondola's angle station and Greenhorn Ranch ----------
WB_TURN = math.radians(30)  # the line turns this far towards +X at the angle station

def _wb_arm(f, y0, y1, M, z0=4.6, h=3.5, w=9.0, cols=(), end=None):
    """One straight arm of the D-Line rail housing in frame f, from local y0 to y1: a long box of smoked glass
    in dark frames on a royal-blue band, snow on its roof, the rails and tyre conveyors under it, centre
    columns down to the platform. end: the local y of an open end framed in blue."""
    BL, GL, CH, SN = M["wblue"], M["smoke"], M["char"], M["sn"]
    L, yc = abs(y1 - y0), (y0 + y1) / 2
    f.box((w + 0.3, L, 0.9), (0, yc, z0 + 0.45), BL)
    f.box((w, L, h - 0.9), (0, yc, z0 + 0.9 + (h - 0.9) / 2), GL)
    f.box((w + 0.3, L, 0.25), (0, yc, z0 + h + 0.05), BL)
    for k in range(int(L / 1.25) + 1):  # mullions on both sides and ribs across the roof
        y = min(y0, y1) + k * 1.25
        for s in (-1, 1): f.box((0.1, 0.12, h - 0.9), (s * (w / 2 + 0.03), y, z0 + 0.9 + (h - 0.9) / 2), CH)
        f.box((w, 0.12, 0.1), (0, y, z0 + h - 0.05), CH)
    for s in (-1, 1): f.box((0.12, L, 0.12), (s * (w / 2 + 0.03), yc, z0 + 0.9 + (h - 0.9) * 0.55), CH)
    f.slab((w - 0.6, L - 0.4, 0.35), (0, yc, z0 + h + 0.32), SN)
    f.box((w - 0.4, L, 0.3), (0, yc, z0 - 0.1), M["steel2"])  # the housing's floor frame
    for s in (-1, 1):  # the rails and tyre conveyors
        f.box((0.16, L, 0.28), (s * 3.0, yc, z0 - 0.4), M["steel2"])
        for k in range(int(L / 0.9)): f.cyl(0.21, 0.11, (s * 2.7, min(y0, y1) + 0.45 + k * 0.9, z0 - 0.5), M["rubber"], rot=(0, PI / 2, 0), verts=12)
    for y in cols:
        f.box((1.6, 1.6, 0.4), (0, y, 0.6 + 0.2), M["conc"], bevel=0.04)
        f.box((0.7, 0.7, z0 - 1.2), (0, y, 1.0 + (z0 - 1.2) / 2), M["steel2"], bevel=0.03)
        f.box((2 * 3.0 + 1.0, 0.6, 0.5), (0, y, z0 - 0.45), M["steel2"])
    if end is not None:
        f.box((w + 0.5, 0.4, h + 0.4), (0, end, z0 + h / 2), BL)
        f.box((w - 0.6, 0.45, h - 1.4), (0, end, z0 + 0.9 + (h - 1.4) / 2), M["smoke"])

def wild_blue_angle():
    """The Wild Blue Gondola's angle station at Greenhorn Ranch, Steamboat (Doppelmayr D-Line, 2022/23):
    the cabins come up from the base, leave the rope, run round the bend on rails and set off again on the
    second section 30 degrees to the right. A long rail housing of smoked glass in dark frames on a royal-blue
    band, raised on centre columns over a concrete loading platform with steel rails, two glazed operator
    houses, stairs, and beside it the dark flat-roofed station building (drives, cabin storage) with a blue
    stair volume and a grey pipe frame along its wall.
    Sources: liftblog.com Wild Blue Gondola I (2022-12) and II (2024-03) photos of the angle station.
    Rope: arrives from +Y on x = +-3.0 at z = 4.25 and runs to the turn at the origin; the second section
    leaves the origin heading (sin 30, -cos 30), i.e. turned 30 degrees towards +X."""
    new_col("wild_blue_angle"); M = mats(); B.anchor(M)
    M["wblue"] = flat("wb_blue", "#2c48a6", 0.45, grain=0.02); M["smoke"] = flat("smoke_glass", "#2b343d", 0.15, grain=0)
    M["rubber"] = flat("rubber", "#26282b", 0.85, grain=0.04)
    CO, SN, CH = M["conc"], M["sn"], M["char"]
    L1, L2 = 26.0, 22.0
    f1, f2 = Frame((0, 0, 0)), Frame((0, 0, 0), WB_TURN)
    over = 4.5 * math.tan(WB_TURN / 2) + 0.4
    _wb_arm(f1, L1, -over, M, cols=(L1 - 4.0, 12.0, 3.0), end=L1)
    _wb_arm(f2, over, -L2, M, cols=(-6.0, -L2 + 4.0), end=-L2)
    # The turn: a big deflection wheel inside the bend, under the housing.
    S.torus(3.4, 0.16, (0.9, 0.0, 4.2), M["steel2"], seg=40, rseg=8, zscale=1.3)
    S.torus(3.5, 0.06, (0.9, 0.0, 4.2), M["rubber"], seg=40, rseg=6)
    cyl(0.5, 0.5, (0.9, 0.0, 4.2), M["steel"], verts=16)
    # The loading platform: a concrete deck following both arms, steel railings round its outer edges.
    for f, ya, yb in ((f1, L1 + 1.0, -1.0), (f2, 1.0, -L2 - 1.0)):
        f.box((13.0, abs(ya - yb), 0.6), (0, (ya + yb) / 2, 0.3), CO)
        for s in (-1, 1): steel_rail(tuple(f.p(s * 6.5, ya))[:2], tuple(f.p(s * 6.5, yb))[:2], 0.6, M)
    box((10.0, 10.0, 0.6), (0, 0, 0.3), CO)
    for f, y in ((f1, L1 - 5.0), (f2, -L2 + 6.0)):  # glazed operator houses on the outer side
        f.box((2.6, 3.2, 2.7), (5.2, y, 0.6 + 1.35), M["steel2"])
        f.box((2.62, 2.6, 1.3), (5.2, y, 0.6 + 1.9), M["win"], kind="lit")
        f.box((3.0, 3.6, 0.25), (5.2, y, 0.6 + 2.8), CH); f.pad((2.8, 3.4, 0.25), (5.2, y, 0.6 + 3.05), SN)
    for i in range(5): box((2.4, 0.42, 0.2), (7.5, L1 - 9.0 + i * 0.38, 0.5 - i * 0.12), CO, bevel=0.02)
    # The station building beside the first arm: charcoal panels, flat roof, a blue stair volume, pipe frame.
    bx0, bx1, by0, by1, BH = -21.0, -7.0, -2.0, 24.0, 7.2
    bxc, byc = (bx0 + bx1) / 2, (by0 + by1) / 2
    box((bx1 - bx0, by1 - by0, BH), (bxc, byc, BH / 2), CH)
    for k in range(int((by1 - by0) / 1.2)):
        y = by0 + 0.6 + k * 1.2
        box((0.04, 0.03, BH - 0.3), (bx0 - 0.01, y, BH / 2), flat("joint", "#24272a", 0.6, grain=0))
    box((bx1 - bx0 + 0.3, by1 - by0 + 0.3, 0.35), (bxc, byc, BH + 0.1), M["steel2"]); B.pad((bx1 - bx0 - 0.4, by1 - by0 - 0.4, 0.5), (bxc, byc, BH + 0.5), SN)
    box((5.0, 6.0, BH + 2.2), (bx1 - 2.5, by1 - 3.0, (BH + 2.2) / 2), flat("clad_blue", "#5d86ad", 0.5, grain=0.04))
    box((5.3, 6.3, 0.3), (bx1 - 2.5, by1 - 3.0, BH + 2.3), CH); B.pad((5.0, 6.0, 0.4), (bx1 - 2.5, by1 - 3.0, BH + 2.55), SN)
    for k in range(8):  # the grey pipe frame standing off the long wall
        y = by0 + 2.0 + k * 3.0
        box((0.3, 0.3, 4.6), (bx0 - 1.0, y, 2.3), M["galv"]); box((1.0, 0.25, 0.25), (bx0 - 0.5, y, 4.4), M["galv"])
    box((0.35, by1 - by0 - 3.0, 0.35), (bx0 - 1.0, byc, 4.5), M["galv"])
    for y in (4.0, 11.0, 18.0):  # roller doors to the cabin storage and windows
        box((0.1, 4.2, 4.0), (bx0 - 0.04, y, 2.0), M["steel2"])
        for k in range(10): box((0.12, 4.2, 0.03), (bx0 - 0.08, y, 0.2 + k * 0.4), M["steel"])
    for y in (7.5, 14.5, 21.5): win(Frame((bx0 - 0.02, y, 0), -PI / 2), 0, 5.0, 1.6, 1.2, M, fr="char", snow=False)
    for x in (bx0 - 3.0, bx0 - 6.0):  # generator and condenser boxes on the snow
        box((2.2, 4.2, 2.2), (x, -4.0, 1.1), M["lightgrey"] if "lightgrey" in M else flat("cabinet", "#c9c7c0", 0.5, grain=0.03))
        B.pad((2.2, 4.2, 0.3), (x, -4.0, 2.3), SN)
    B.drifts([(bxc, by1 + 1.0, bx1 - bx0, 1.6), (bx0 - 2.2, byc, 1.2, by1 - by0)], M, h=0.8)
    finalize("wild_blue_angle", 2048, ao_dist=1.5)

def greenhorn_ranch():
    """Greenhorn Ranch, the learning centre beside the Wild Blue angle station at Steamboat: a Sprung
    structure (60 x 110 ft, moved here from the Rendezvous lift) with tan membrane walls on silver aluminium
    arch ribs and a white arched roof, a glazed entrance vestibule on the long side, picnic tables and ski
    racks out front. Sources: sprung.com project note; liftblog.com Wild Blue Gondola II photos (2024-03,
    looking down on the station). Origin at the middle; long axis along X."""
    new_col("greenhorn_ranch"); M = mats(); B.anchor(M)
    TAN, WHT, AL = flat("membrane_tan", "#c9b48f", 0.8, grain=0.05), flat("membrane_white", "#e7e5df", 0.7, grain=0.03), flat("alu", "#b9bec3", 0.35, grain=0.02)
    SN = M["sn"]
    L, Wd, H, rise = 33.5, 18.3, 4.2, 3.6
    box((L + 0.4, Wd + 0.4, 0.3), (0, 0, 0.15), M["conc"])
    box((L, Wd, H - 0.3), (0, 0, 0.3 + (H - 0.3) / 2), TAN)
    R = (Wd * Wd / 4 + rise * rise) / (2 * rise); zc = H + rise - R; half = math.asin((Wd / 2) / R); n = 14
    prof = []
    for k in range(n):
        a0 = -half + 2 * half * k / n; a1 = -half + 2 * half * (k + 1) / n; am = (a0 + a1) / 2
        seg = 2 * R * math.sin((a1 - a0) / 2) + 0.04
        c = (0, R * math.sin(am), zc + R * math.cos(am))
        box((L + 0.3, seg, 0.14), c, WHT, rot=(-am, 0, 0))
        if abs(am) < half * 0.55: slab((L - 0.6, seg + 0.4, 0.22), (0, (R + 0.18) * math.sin(am), zc + (R + 0.18) * math.cos(am)), SN, rot=(-am, 0, 0))
    for k in range(n + 1):
        a = -half + 2 * half * k / n; prof.append((R * math.sin(a), zc + R * math.cos(a)))
    for x, sg in ((-L / 2, -1), (L / 2, 1)):  # the end walls: tan membrane filling the arch
        Frame((x, 0, 0), sg * PI / 2).prism([(-u, 0, z) for u, z in prof], -0.15, TAN)
    for k in range(8):  # silver arch ribs over the roof and down the walls
        x = -L / 2 + k * L / 7
        for (ua, za), (ub, zb) in zip(prof, prof[1:]):
            ln = math.hypot(ub - ua, zb - za); a = math.atan2(zb - za, ub - ua)
            box((0.18, ln + 0.02, 0.12), (x, (ua + ub) / 2, (za + zb) / 2 + 0.08), AL, rot=(a, 0, 0))
        for s in (-1, 1): box((0.18, 0.16, H - 0.3), (x, s * (Wd / 2 + 0.06), 0.3 + (H - 0.3) / 2), AL)
    for s in (-1, 1): box((L + 0.2, 0.16, 0.18), (0, s * (Wd / 2 + 0.06), H), AL)
    # The vestibule on the -Y side: a glazed box with a flat roof and the name board.
    vf = Frame((0, -Wd / 2, 0))
    vf.box((6.0, 3.0, 3.2), (0, -1.5, 1.9), M["steel2"])
    B.door(vf, -1.2, 0.3, 1.9, 2.4, M, double=True, glazed=True, y=-3.02); B.door(vf, 1.2, 0.3, 1.9, 2.4, M, double=True, glazed=True, y=-3.02)
    vf.box((6.6, 3.6, 0.3), (0, -1.6, 3.6), M["char"]); vf.pad((6.2, 3.2, 0.35), (0, -1.6, 3.9), SN)
    vf.box((5.0, 0.12, 0.6), (0, -3.42, 3.1), M["sign"], bevel=0.02)
    text("GREENHORN RANCH", 0.3, vf.p(0, -3.5, 3.1), M["cream"], extrude=0.01)
    for x in (-11.0, -6.0, 6.0, 11.0): vf.box((2.4, 0.05, 1.3), (x, -0.03, 1.8), M["win"], kind="lit"); vf.box((2.6, 0.08, 0.1), (x, -0.06, 2.48), AL); vf.box((2.6, 0.08, 0.1), (x, -0.06, 1.12), AL)
    B.door(Frame((L / 2 + 0.16, 0, 0), PI / 2), 0, 0.3, 1.2, 2.3, M)
    # Out front: tables, racks, condenser units at the back.
    for i, x in enumerate((-12.0, -7.0, 7.0, 12.0)): B.picnic((x, -Wd / 2 - 5.0, 0), M["deck"], SN, rot=0.05 * (i % 2))
    for x in (-3.5, 3.5): B.rack((x, -Wd / 2 - 8.0, 0), M["steel2"], SN, rot=0.0)
    for x in (-8.0, -4.0): box((2.0, 1.4, 1.6), (x, Wd / 2 + 1.6, 0.8), flat("cabinet", "#c9c7c0", 0.5, grain=0.03)); B.pad((2.0, 1.4, 0.25), (x, Wd / 2 + 1.6, 1.7), SN)
    B.drifts([(0, Wd / 2 + 0.8, L, 1.4), (-L / 2 - 0.8, 0, 1.4, Wd), (L / 2 + 0.8, 0, 1.4, Wd)], M, h=1.0)
    finalize("greenhorn_ranch", 1024, ao_dist=1.2)

MODELS = {"elk_camp": elk_camp, "sams": sams, "snoasis": snoasis, "cloud_nine": cloud_nine, "cliffhouse": cliffhouse,
          "wild_blue_angle": wild_blue_angle, "greenhorn_ranch": greenhorn_ranch}
