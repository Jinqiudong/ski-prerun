"""The Salt Lake City-area Ikon resorts' own models: Snowbird's Aerial Tram (its cabins, its tower and its
two docks), and the landmark lodges of Alta, Snowbird, Brighton, Solitude, Deer Valley and Snowbasin. The look
follows the photos named in each docstring (copies in the research notes); parts come from lib.py,
lifts.py, buildings.py, stations.py and signature.py.

Carriers and towers follow lifts.py (the rope at z = 0, the way up along -Y); buildings stand on the ground at
the middle of their footprint, fronts facing -Y, metres."""
import math
import bpy, bmesh
from mathutils import Vector
from lib import *
import lib
import buildings as B
import stations as S
import lifts as LF
import signature as SG
from signature import mats, win, glazing, flat_roof, seamed_roof, steel_rail, stack, balcony, shopfront

PI = math.pi
Frame, W0 = B.Frame, B.W0

# ---------- Snowbird: the Aerial Tram ----------
TRAM_HALF = 6.0   # half the distance between the two cabins' track ropes (the tower's saddles)
TRAM_TRACK = 0.55 # half the gap between a cabin's own two track ropes

def tram_cabin():
    """One of Snowbird's two 125-passenger Aerial Tram cabins (Doppelmayr/CWA, 2022): a long cabin of tinted
    glass in a frame of the car's colour (blue or red, `paint`), the colour sweeping round the roof edge and
    down the corners, a deep lower panel with the white snowbird wordmark and a band of white peaks, a
    roof deck with its rail; the tall silver hanger bent forward over the roof up to the carriage, whose
    four bogies run on the two track ropes. Origin at the track ropes; the cabin floor 8.9 m below.
    Photos: liftblog.com Aerial Tram (Snowbird), 2022-07 (img_9863, img_0037, img_9887)."""
    new_col("tram_cabin"); K = LF.kit()
    P = flat("paint_cabin", "#2f6db5", 0.4, 0.25, grain=0)
    GL = glass("tram_glass", "#1c2530", 0.62)
    SIL, DARK, WH = flat("silver", "#c3c8cd", 0.3, 0.6, grain=0), K["DARK"], flat("logo_white", "#f4f4f2", 0.5, grain=0)
    hx, hy, h, top = 1.8, 4.3, 2.7, -6.2
    zb = top - h; zg0, zg1 = zb + 0.95, top - 0.28
    ring = lambda z, d=0.0, r=0.5: LF.rrect(hx + d, hy + d, r, z, seg=5)
    LF.loft([LF.rrect(hx - 0.25, hy - 0.25, 0.35, zb, seg=5), ring(zb + 0.12), ring(zg0)], P, "paint", cap_top=False, cap_bot=True)
    LF.loft([ring(zg0), ring(zg1)], GL, "glass", cap_top=False)
    LF.loft([ring(zg1), ring(top - 0.1)], P, "paint", cap_top=False)  # the coloured roof edge
    LF.loft([ring(top - 0.1), LF.rrect(hx - 0.12, hy - 0.12, 0.45, top, seg=5)], flat("tram_roof", "#1b1e22", 0.5, grain=0.02))
    LF.loft([ring(zg0 - 0.03, 0.012), ring(zg0 + 0.05, 0.012)], DARK, cap_top=False)
    # Mullions down the long sides and the ends; the corner posts in the car's colour.
    for sx in (-1, 1):
        for k in range(1, 6): box((0.05, 0.1, zg1 - zg0), (sx * (hx + 0.005), -hy + 0.5 + k * (2 * hy - 1.0) / 6, (zg0 + zg1) / 2), DARK)
        for sy in (-1, 1):
            box((0.2, 0.2, zg1 - zg0 + 0.1), (sx * (hx - 0.12), sy * (hy - 0.12), (zg0 + zg1) / 2), P, rot=(0, 0, math.atan2(sy, sx)), kind="paint")
        for y in (-1.0, 0.0, 1.0): box((0.03, 0.04, zg0 - zb - 0.2), (sx * (hx + 0.012), y, (zb + 0.1 + zg0) / 2), DARK)  # the sliding doors' seams
    for sy in (-1, 1):
        for x in (-0.6, 0.6): box((0.1, 0.05, zg1 - zg0), (x, sy * (hy + 0.005), (zg0 + zg1) / 2), DARK)
    # The wordmark and the white peaks along the lower panel, both long sides.
    for sx in (-1, 1):
        rot = (PI / 2, 0, sx * PI / 2)
        text("snowbird", 0.42, (sx * (hx + 0.02), 2.4 * sx, zb + 0.52), WH, rot=rot, extrude=0.004)
        pts = [(0, 0)]; x = 0.0
        while x < 2.6: x += 0.22 + 0.18 * ((len(pts) * 7) % 3); pts.append((x, 0.12 + 0.16 * ((len(pts) * 5) % 4) / 3)); x += 0.15; pts.append((x, 0.0))
        bm = bmesh.new(); vs = [bm.verts.new((sx * (hx + 0.015), (-hy + 0.6 + px) * sx, zb + 0.14 + pz)) for px, pz in pts + [(pts[-1][0], -0.02), (0, -0.02)]]
        bm.faces.new(vs); me = bpy.data.meshes.new("peaks"); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new("peaks", me); bpy.context.scene.collection.objects.link(o); lib._link(o, WH, "flat")
    # Inside: the glass floor panels' frames, a few riders' rails.
    box((2 * hx - 0.5, 2 * hy - 0.5, 0.05), (0, 0, zb + 0.14), DARK)
    for y in (-2.5, 0.0, 2.5): box((2 * hx - 0.6, 0.05, 0.05), (0, y, zg0 + 0.3), SIL)
    # The roof: a deck with a rail, the hanger's foot, a light.
    box((2.2, 4.6, 0.12), (0, 0.4, top + 0.06), SIL)
    for sx in (-1, 1): LF.rod((sx * 1.1, -1.9, top + 0.12), (sx * 1.1, 2.7, top + 0.12), 0.03, SIL)
    for y in (-1.9, 0.4, 2.7):
        for sx in (-1, 1): LF.rod((sx * 1.1, y, top + 0.1), (sx * 1.1, y, top + 1.0), 0.03, SIL)
        LF.rod((-1.1, y, top + 1.0), (1.1, y, top + 1.0), 0.03, SIL)
    for sx in (-1, 1): LF.rod((sx * 1.1, -1.9, top + 1.0), (sx * 1.1, 2.7, top + 1.0), 0.03, SIL)
    # The hanger: a tall silver box section, up from the roof's back half, kinked forward under the carriage.
    hpts = [(0, 2.0, top + 0.1), (0, 2.0, top + 2.4), (0, 0.6, -2.4), (0, 0.0, -1.1)]
    for (a, b), w in zip(zip(hpts, hpts[1:]), (0.85, 0.75, 0.65)):
        a, b = Vector(a), Vector(b); d = b - a
        box((0.5, w, d.length + 0.3), (a + b) / 2, SIL, rot=(math.atan2(-d.y, d.z), 0, 0), bevel=0.06)
    box((1.4, 1.6, 0.35), (0, 2.0, top + 0.25), SIL, bevel=0.05)
    # The carriage: a long beam along the ropes, four bogies with wheels on both track ropes, the haul rope clamps.
    box((0.5, 7.2, 0.45), (0, 0, -0.95), SIL, bevel=0.05)
    box((1.4, 1.2, 0.5), (0, 0, -1.2), SIL, bevel=0.05)
    for y in (-2.8, -0.95, 0.95, 2.8):
        box((2 * TRAM_TRACK + 0.5, 1.5, 0.3), (0, y, -0.55), SIL, bevel=0.04)
        for sx in (-1, 1):
            for dy in (-0.45, 0.45): LF.wheel((sx * TRAM_TRACK, y + dy, -0.25), 0.25, 0.12, K)
            box((0.06, 1.5, 0.5), (sx * (TRAM_TRACK + 0.13), y, -0.3), SIL)
    for y in (-3.4, 3.4): box((0.4, 0.4, 0.5), (0, y, -1.45), DARK, bevel=0.03)
    box((1.8, 3.8, 0.12), (0, 0, -0.7), K["SN"], bevel=0.04, seg=1, kind="snow")
    box((1.8, 3.6, 0.1), (0, 0.4, top + 0.17), K["SN"], bevel=0.04, seg=1, kind="snow")
    finalize("tram_cabin", 1024, ao_dist=0.6)

def tower_tram():
    """The Snowbird Aerial Tram's tower: a tall steel lattice of four legs that narrows to a waist and flares
    out to a broad head carrying a long curved saddle for each cabin's two track ropes, catwalks along them.
    45 m from the footing to the ropes; the game may scale it to the tower's height. Origin at the foot;
    the track ropes at x = ±6.0 (±0.55 each), z = 45.
    Photos: liftblog.com Aerial Tram (Snowbird), 2015-09 snowbird-049, 2022-07 img_9871."""
    new_col("tower_tram"); K = LF.kit(); P = flat("paint_lattice", "#9aa0a6", 0.5, 0.2, grain=0); SN = K["SN"]
    H, zw, zh = 45.0, 30.0, 40.0  # ropes, the waist, the head's underside
    hx = lambda z: 4.6 - (4.6 - 1.4) * z / zw if z <= zw else 1.4 + (TRAM_HALF - 0.8 - 1.4) * (z - zw) / (zh - zw)
    hy = lambda z: 3.4 - (3.4 - 1.2) * z / zw if z <= zw else 1.2 + 0.6 * (z - zw) / (zh - zw)
    zs = [0, 4.5, 9, 13, 17, 21, 24.5, 27.5, 30, 33, 36.5, 40]
    pt = lambda sx, sy, z: (sx * hx(z), sy * hy(z), z)
    CON = flat("concrete", "#aca79f", 0.92, grain=0.12)
    for sx in (-1, 1):
        for sy in (-1, 1):
            for za, zb in zip(zs, zs[1:]): LF.rod(pt(sx, sy, za), pt(sx, sy, zb), 0.16, P, verts=6, kind="paint")
            box((1.4, 1.4, 1.0), (sx * hx(0), sy * hy(0), 0.3), CON, bevel=0.05)
    faces = [((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))]
    for za, zb in zip(zs, zs[1:]):
        for (ax, ay), (bx, by) in faces:
            LF.rod(pt(ax, ay, za), pt(bx, by, zb), 0.06, P, verts=4, kind="paint")
            LF.rod(pt(bx, by, za), pt(ax, ay, zb), 0.06, P, verts=4, kind="paint")
            LF.rod(pt(ax, ay, zb), pt(bx, by, zb), 0.07, P, verts=4, kind="paint")
    # The head: a deep box girder across, the saddles along the ropes at its ends, catwalks, a light mast.
    zt = zh + 1.6
    for sy in (-1, 1):
        for z in (zh, zt): LF.rod((-TRAM_HALF - 0.6, sy * 1.8, z), (TRAM_HALF + 0.6, sy * 1.8, z), 0.12, P, verts=6, kind="paint")
        for k in range(9):
            xa = -TRAM_HALF - 0.6 + k * (2 * TRAM_HALF + 1.2) / 8; xb = -TRAM_HALF - 0.6 + (k + 1) * (2 * TRAM_HALF + 1.2) / 8
            LF.rod((xa, sy * 1.8, zh), (xb if k < 8 else xa, sy * 1.8, zt), 0.06, P, verts=4, kind="paint")
    for k in range(7): x = -TRAM_HALF + k * TRAM_HALF / 3; LF.rod((x, -1.8, zt), (x, 1.8, zt), 0.06, P, verts=4, kind="paint")
    for sx in (-1, 1):
        LF.rod(pt(sx, -1, zh), (sx * (TRAM_HALF - 0.4), -1.8, zh), 0.12, P, verts=6, kind="paint")
        LF.rod(pt(sx, 1, zh), (sx * (TRAM_HALF - 0.4), 1.8, zh), 0.12, P, verts=6, kind="paint")
        xc = sx * TRAM_HALF; L, R = 12.0, 40.0  # the saddle: a long shoe curving down at both ends
        segs = 8
        for k in range(segs):
            a0, a1 = -L / 2 / R + k * (L / R) / segs, -L / 2 / R + (k + 1) * (L / R) / segs; am = (a0 + a1) / 2
            y = R * math.sin(am); z = H - 0.35 - R * (1 - math.cos(am)); seg = R * (a1 - a0) + 0.05
            box((2 * TRAM_TRACK + 0.7, seg, 0.7), (xc, y, z - 0.25), P, rot=(-am, 0, 0), kind="paint")
            for s2 in (-1, 1): box((0.18, seg, 0.22), (xc + s2 * TRAM_TRACK, y, z + 0.12), K["DARK"], rot=(-am, 0, 0))
        box((2 * TRAM_TRACK + 0.4, 2.0, H - 0.6 - zt), (xc, 0, (zt + H - 0.6) / 2), P, kind="paint")
        box((1.2, L - 1.0, 0.05), (xc + sx * (TRAM_TRACK + 1.0), 0, H - 1.4), K["TREAD"])
        LF.rod((xc + sx * (TRAM_TRACK + 1.6), -L / 2 + 0.6, H - 0.4), (xc + sx * (TRAM_TRACK + 1.6), L / 2 - 0.6, H - 0.4), 0.03, K["GALV"])
        box((2 * TRAM_TRACK + 0.6, L - 1.5, 0.12), (xc, 0, H - 0.2), SN, bevel=0.05, seg=1, kind="snow")
    LF.rod((0, 0, zt), (0, 0, zt + 4.0), 0.06, K["GALV"]); box((0.5, 0.3, 0.4), (0, 0, zt + 4.1), K["DARK"])
    for k in range(int(zh / 0.9)):  # the ladder up the -Y face
        z = 0.8 + k * 0.9; box((0.5, 0.03, 0.03), (0, -hy(z) - 0.2, z), K["GALV"])
    for x in (-0.25, 0.25):
        for za, zb in zip(zs, zs[1:]): LF.rod((x, -hy(za) - 0.2, za + 0.8 if za == 0 else za), (x, -hy(zb) - 0.2, zb), 0.025, K["GALV"], verts=6)
    finalize("tower_tram", 1024, ao_dist=0.8)

def tram_dock_top():
    """The Aerial Tram's top dock on Hidden Peak (11,000 ft): a tall block clad in grey corrugated metal holding
    the track-rope anchors, and either side of it a steel frame of raking legs under a long curved saddle that
    reaches out over the slope; the cabins dock under the saddles beside a steel-grated platform on a
    concrete base storey, with railings, a timber operator's booth, timber stairs and the antennas on the roof.
    Photos: liftblog.com Aerial Tram (Snowbird) 2015-09 img_5181, img_5183, 2022-07 img_9873, img_9880.
    Ropes: the cabins come in from +Y on x = +-6.0 and stop with their middle at y = 5.5, the track ropes
    there at z = 13.0 (the cabin floor on the platform at 4.1)."""
    new_col("tram_dock_top"); M = mats(); B.anchor(M)
    K = LF.kit(); SN = M["sn"]
    CG, STL, CON = flat("corrugated", "#a3a8ac", 0.5, grain=0.04), flat("dock_steel", "#7b8288", 0.45, grain=0.03), M["conc"]
    zp = 4.0
    box((22.0, 13.0, zp), (0, -0.5, zp / 2), CON, bevel=0.05)
    for x in (-8, 8): B.door(Frame((x, -7.02, 0)), 0, 0.2, 1.2, 2.3, M, kick=True)
    for x in (-4, 4): win(Frame((x, -7.02, 0)), 0, 1.2, 1.6, 1.0, M, fr="steel2", snow=False)
    # The platform: steel grating out over the slope on legs, railings round it.
    box((22.0, 18.0, 0.35), (0, 1.5, zp - 0.17), STL)
    for k in range(int(18.0 / 0.5)): box((22.0, 0.04, 0.02), (0, -7.4 + k * 0.5, zp + 0.02), M["dark"] if "dark" in M else STL)
    for x in (-10.5, -1.5, 1.5, 10.5):
        for y in (6.5, 10.2): box((0.3, 0.3, zp), (x, y, zp / 2), STL)
    for x0, x1 in ((-11, -9.2), (9.2, 11)): steel_rail((x0, 10.5), (x1, 10.5), zp, M)
    for x in (-11, 11): steel_rail((x, -7.5), (x, 10.5), zp, M)
    steel_rail((-2.0, 10.5), (2.0, 10.5), zp, M)
    # The anchor block: grey corrugated, ribs, a door onto the platform, antennas.
    bw, by0, by1, bh = 7.4, -6.5, 3.0, 19.0
    box((bw, by1 - by0, bh - zp), (0, (by0 + by1) / 2, (zp + bh) / 2), CG)
    for k in range(int((by1 - by0) / 0.4)):
        for sx in (-1, 1): box((0.05, 0.08, bh - zp - 0.2), (sx * (bw / 2 + 0.02), by0 + 0.2 + k * 0.4, (zp + bh) / 2), CG)
    for k in range(int(bw / 0.4)):
        for y in (by0 - 0.02, by1 + 0.02): box((0.08, 0.05, bh - zp - 0.2), (-bw / 2 + 0.2 + k * 0.4, y, (zp + bh) / 2), CG)
    box((bw + 0.3, by1 - by0 + 0.3, 0.3), (0, (by0 + by1) / 2, bh), M["char"]); B.pad((bw, by1 - by0, 0.5), (0, (by0 + by1) / 2, bh + 0.35), SN)
    B.door(Frame((0, by1 + 0.05, 0), PI), 0, zp, 1.2, 2.3, M, kick=True)
    for x, h in ((-2.5, 4.0), (1.0, 6.0), (2.8, 3.0)):
        LF.rod((x, -2.0, bh), (x, -2.0, bh + h), 0.05, K["GALV"])
        for z in (bh + h * 0.5, bh + h * 0.85): box((0.8, 0.05, 0.05), (x, -2.0, z), K["GALV"])
    cyl(0.6, 0.15, (2.0, by1 + 0.1, bh - 2.0), M["lightgrey"] if "lightgrey" in M else CG, rot=(PI / 2, 0, 0), verts=20)
    # Each side: the raking frame and the long curved saddle over the cabin's two track ropes.
    # The saddle carries the track ropes at 13.0 where the cabin stops (y = 5.5), so the docked cabin's carriage
    # runs on it; a long gentle curve, dipping under a metre to its outer end.
    R, yc = 120.0, -1.0
    ztop = 13.0 - 0.05 + R - math.sqrt(R * R - (5.5 - yc) ** 2)
    arc = lambda y: ztop - R + math.sqrt(R * R - (y - yc) ** 2)
    for s in (-1, 1):
        xc = s * 6.0; n = 12; y0, y1 = -9.0, 14.0
        for k in range(n):
            ya, yb = y0 + k * (y1 - y0) / n, y0 + (k + 1) * (y1 - y0) / n; za, zb = arc(ya), arc(yb)
            c = Vector((xc, (ya + yb) / 2, (za + zb) / 2 + 0.55)); L = math.hypot(yb - ya, zb - za) + 0.05; a = math.atan2(zb - za, yb - ya)
            box((2.2, L, 0.9), c, STL, rot=(a, 0, 0))
            box((2.5, L, 0.12), c + Vector((0, 0, 0.52)), STL, rot=(a, 0, 0))
            box((2.3, L - 0.1, 0.2), c + Vector((0, 0, 0.7)), SN, rot=(a, 0, 0), bevel=0.06, seg=1, kind="snow")
            for t in (-1, 1): box((0.16, L, 0.18), c + Vector((t * TRAM_TRACK, 0, -0.5)), K["DARK"], rot=(a, 0, 0))
        # The frame stands clear of the docked cabin (x = xc +-1.85, y 1.2 to 9.8, its carriage up to the ropes):
        # the legs beside it lean in to the saddle's edges, the inner one stands by the anchor block and reaches
        # the saddle with an arm over the ropes.
        legs = [((xc - s * 1.0, -5.5), (xc, -4.0)), ((xc + s * 2.6, -5.5), (xc + s * 0.8, -3.0)), ((xc - s * 2.1, 3.5), (xc - s * 2.1, 4.5)), ((xc + s * 2.6, 3.0), (xc + s * 1.2, 6.0)), ((xc + s * 2.6, 9.8), (xc + s * 1.2, 9.5))]
        for (fx, fy), (tx, ty) in legs:
            LF.rod((fx, fy, zp), (tx, ty, arc(ty) + 0.1), 0.2, STL, verts=8)
        LF.rod((xc - s * 2.1, 4.5, arc(4.5) + 0.6), (xc, 4.5, arc(4.5) + 0.6), 0.15, STL, verts=8)
        for ya, yb in ((-4.0, 4.5), (4.5, 9.5)):
            LF.rod((xc + s * 2.4, ya, zp + 2.0), (xc + s * 1.5, yb, arc(yb) - 0.6), 0.1, STL, verts=6)
            LF.rod((xc + s * 2.4, yb, zp + 2.0), (xc + s * 1.5, ya, arc(ya) - 0.6), 0.1, STL, verts=6)

        for z in (zp + 3.0, zp + 7.0): LF.rod((xc + s * 2.0, -5.0, z), (xc + s * 2.0, 9.0, z), 0.09, STL, verts=6)
        for k in range(int((arc(-4.0) - zp) / 0.35)):  # a ladder up the frame
            z = zp + 0.3 + k * 0.35; box((0.5, 0.03, 0.03), (xc + s * 2.2, -5.6, z), K["GALV"])
        LF.wheel((xc - s * 0.4, -8.6, arc(-8.6) + 0.2), 0.7, 0.25, K, axis="X")
    # The operator's booth and the timber stairs down to the snow, signs, snow banked round the base.
    bx = -2.2; box((2.6, 2.2, 2.6), (bx - 6.5, -5.0, zp + 1.3), M["boards"])
    win(Frame((bx - 6.5, -6.12, 0)), 0, zp + 1.0, 1.6, 1.0, M, cols=2, snow=False)
    box((3.0, 2.6, 0.2), (bx - 6.5, -5.0, zp + 2.7), M["roof"]); B.pad((2.9, 2.5, 0.35), (bx - 6.5, -5.0, zp + 2.95), SN)
    for i in range(10): box((2.4, 0.4, 0.12), (12.4, -4.0 + i * 0.4, zp - 0.4 - i * 0.38), M["deck"])
    for sx in (11.2, 13.6): LF.rod((sx, -4.2, zp + 1.0), (sx, 0.0, 1.0), 0.04, M["tim"])
    box((2.4, 0.08, 0.9), (-6.0, -7.6, zp + 1.6), M["sign"]); text("HIDDEN PEAK", 0.3, (-6.0, -7.66, zp + 1.7), M["cream"], extrude=0.01)
    text("11,000 FT", 0.22, (-6.0, -7.66, zp + 1.3), M["cream"], extrude=0.01)
    B.drifts([(0, -8.0, 22, 1.6), (-11.8, -0.5, 1.6, 13), (11.8, -2.0, 1.6, 9)], M, h=1.0)
    B.pad((21.5, 3.0, 0.3), (0, -5.5, zp + 0.15), SN)
    finalize("tram_dock_top", 2048, ao_dist=1.2)

def tram_dock_bottom():
    """The Aerial Tram's bottom dock at the Snowbird Center: a tall portal of board-formed concrete open to the
    mountain, a roof slab on two massive side walls and a central pier with the glazed control room; the two
    cabins dock side by side on the third level under steel gantries with the silver hanger guides; fans of
    curved rope deflectors on the outer edges; concrete floors with steel railings; the lower Snowbird Center
    wings either side and the plaza at its foot with tables and umbrellas.
    Photos: liftblog.com Aerial Tram (Snowbird) 2022-07 img_9217, 2015-09 img_0933.
    Ropes: the cabins leave along -Y on x = +-6.0; docked, a cabin's middle is at y = -2.0 and its track
    ropes at z = 18.4 (the cabin floor on the dock at 9.5)."""
    new_col("tram_dock_bottom"); M = mats(); B.anchor(M)
    K = LF.kit(); SN = M["sn"]
    CON = flat("bf_concrete", "#bab3a7", 0.9, grain=0.12); FL = flat("formlines", "#9a948a", 0.9, grain=0)
    STL = flat("dock_steel", "#8b9298", 0.45, grain=0.03); SIL = flat("silver", "#c3c8cd", 0.3, 0.6, grain=0)
    W, D, H, zd = 28.0, 16.0, 22.0, 9.5
    for sx in (-1, 1):  # the side walls lean in: an A-frame of concrete, 5 m thick at the foot, 2 m at the roof
        xi, xo0, xo1 = sx * (W / 2 - 2.0), sx * (W / 2 + 3.0), sx * W / 2
        S.prism([(xi, 0), (xo0, 0), (xo1, H), (xi, H)] if sx > 0 else [(xo0, 0), (xi, 0), (xi, H), (xo1, H)], 0, D, CON, loc=(0, D / 2, 0), rot=(PI / 2, 0, 0), smooth=None)
        for k in range(1, int(H / 1.2)):
            z = k * 1.2; xo = xo0 + (xo1 - xo0) * z / H
            box((abs(xo - xi) + 0.04, D + 0.04, 0.04), ((xo + xi) / 2, 0, z), FL)  # board-form lines
    box((W, D + 1.0, 1.4), (0, 0.5, H - 0.7), CON)
    box((W, 1.4, 2.6), (0, -D / 2 + 0.2, H - 1.8), CON)
    box((4.4, D - 2.0, zd + 5.5), (0, 1.0, (zd + 5.5) / 2), CON)
    box((4.2, 2.2, 2.6), (0, -D / 2 + 2.0, zd + 1.0), M["win"], kind="lit")  # the control room
    for x in (-2.1, 0, 2.1): box((0.12, 2.3, 2.7), (x, -D / 2 + 2.0, zd + 1.0), STL)
    box((W - 4, 1.0, 14.0), (0, D / 2 - 0.5, 7.0), CON)  # the back wall
    for z, depth in ((4.6, D - 1.0), (zd, D - 4.0), (15.0, 6.0)):  # floors
        box((W - 4.0, depth, 0.45), (0, D / 2 - depth / 2, z), CON)
        steel_rail((-W / 2 + 2.0, D / 2 - depth), (-2.4, D / 2 - depth), z + 0.22, M, snow=z < 12); steel_rail((2.4, D / 2 - depth), (W / 2 - 2.0, D / 2 - depth), z + 0.22, M, snow=z < 12)
    for s in (-1, 1):  # windows into the floors, lit
        for z in (5.3, zd + 0.8):
            box((W / 2 - 5.0, 0.1, 2.4), (s * (W / 4 + 0.5), D / 2 - 1.05, z + 1.2), M["win"], kind="lit")
    # Gantries over each bay, the hanger guides, the deflector fans.
    for s in (-1, 1):
        xc = s * 6.0
        for y in (-D / 2 + 1.0, -1.0, 4.0):
            LF.rod((xc - 3.2, y, H - 1.5), (xc + 3.2, y, H - 1.5), 0.12, STL, verts=6)
            for t in (-1, 1): LF.rod((xc + t * 3.2, y, H - 1.5), (xc, y, H - 4.2), 0.08, STL, verts=6)
        LF.rod((xc, -D / 2 + 1.0, H - 4.2), (xc, 4.0, H - 4.2), 0.12, STL, verts=6)
        g0 = Vector((xc + s * 1.2, -D / 2 + 1.5, zd + 3.6)); g1 = Vector((xc + s * 1.2, 1.5, H - 2.6))
        d = g1 - g0; box((0.6, d.length, 0.12), (g0 + g1) / 2, SIL, rot=(math.atan2(d.z, d.y), 0, 0))
        for k in range(7):  # the fan of curved deflector bars at the outer edge
            a = 0.2 + k * 0.17; x0 = s * (W / 2 + 0.2)
            S.rod((x0, -D / 2 + 0.5, zd - 2.0 + k * 0.6), (x0 + s * 3.0 * math.cos(a), -D / 2 - 1.5 - 2.5 * math.sin(a), zd + 4.0 + k * 1.0), 0.06, STL, verts=6)
        box((2.8, 2.4, 2.2), (s * 9.5, D / 2 - 2.2, zd + 1.3), M["lightgrey"] if "lightgrey" in M else STL)  # machinery
    # The Snowbird Center wings either side: concrete, two storeys of windows, decks with railings.
    for s in (-1, 1):
        wx = s * (W / 2 + 9.0)
        box((12.0, 18.0, 8.6), (wx, 2.0, 4.3), CON)
        box((12.4, 18.4, 0.5), (wx, 2.0, 8.8), M["char"]); B.pad((12.0, 18.0, 0.5), (wx, 2.0, 9.25), SN)
        f = Frame((wx, -7.02, 0))
        glazing(f, -5.5, 5.5, 4.9, 7.9, M, step=1.4, mull="char")
        for x in (-3.5, 0, 3.5): win(f, x, 1.0, 2.6, 2.2, M, cols=3, fr="char")
        f.box((12.0, 2.2, 0.3), (0, -1.1, 4.6), CON); steel_rail((wx - 6, -9.2), (wx + 6, -9.2), 4.75, M)
    # The plaza: paving, tables and umbrellas, a stair up the right, snow banked.
    box((W + 10, 8.0, 0.3), (0, -D / 2 - 4.0, 0.15), M["conc"])
    cols = ("#b8322c", "#e6dac3", "#c9a65a", "#36506e")
    for i, x in enumerate((-8, -3, 2, 7)):
        B.picnic((x, -D / 2 - 3.5, 0.3), M["deck"], SN, rot=0.1 * i)
        B.parasol((x + 1.6, -D / 2 - 4.5, 0.3), M["tim"], flat("cloth" + cols[i], cols[i], 0.9), SN)
    for i in range(12): box((1.4, 0.34, 0.18), (W / 2 - 1.0, -D / 2 + 0.6 + i * 0.36, 0.2 + i * 0.36), CON)
    box((W, D, 0.5), (0, 0.5, H + 0.25), SN, bevel=0.15, seg=2, kind="snow")
    B.drifts([(-W / 2 - 15.5, 2, 1.4, 18), (W / 2 + 15.5, 2, 1.4, 18)], M, h=0.9)
    text("SNOWBIRD", 1.1, (0, -D / 2 - 0.52, H - 1.8), M["cream"], extrude=0.02)
    finalize("tram_dock_bottom", 2048, ao_dist=1.5)

# ---------- A mountain lodge, by its real parts ----------
def lodge_mats():
    M = mats()
    M.update(shake=textured("shake", "grey_roof_01", 1.8, (0.86, 0.78, 0.7), 0.85, "Y"),
             cap=flat("copper_cap", "#5d4e40", 0.5, 0.3, grain=0.04),
             honeyb=textured("boards_honey", "fine_grained_wood", 1.4, (1.55, 1.22, 0.86), 0.85, "Z"),
             bnb=textured("bnb_brown", "old_planks_02", 1.7, (0.86, 0.74, 0.62), 0.85, "Z"),
             stucco=flat("stucco_cream", "#d6c8a8", 0.92, grain=0.07), green2=flat("dv_green", "#2a4a3c", 0.6, grain=0.03))
    return M

def capped_chimney(x, y, z0, h, M, w=1.8, d=2.0):
    """A river-stone chimney with a little copper-capped hood on four posts."""
    box((w, d, h), (x, y, z0 + h / 2), M["st"], bevel=0.05)
    box((w + 0.2, d + 0.2, 0.18), (x, y, z0 + h), M["st"], bevel=0.03)
    for sx in (-1, 1):
        for sy in (-1, 1): box((0.12, 0.12, 0.7), (x + sx * (w / 2 - 0.15), y + sy * (d / 2 - 0.15), z0 + h + 0.43), M["cap"])
    cyl((w + 0.5) * 0.72, 0.6, (x, y, z0 + h + 1.05), M["cap"], verts=4, r2=0.12, rot=(0, 0, PI / 4))
    B.pad((w * 0.8, d * 0.8, 0.25), (x, y, z0 + h + 1.25), M["sn"])

def front_gable(x, yw, w, P, G, T, rise, M, mat_roof, glass=True, door=False, log_cols=True, sign=None, y1=None):
    """A heavy-timber cross gable standing P forward of the wall line yw: glazed from G to the peak in a timber
    grid, a king-post truss, raking beams, columns on stone piers, its own steep roof running back into the main one."""
    TIM, SN = M["tim"], M["sn"]; yf = yw - P; g = Frame((x, yf, 0))
    box((w - 0.4, P + 0.4, T - G), (x, yw - P / 2 + 0.2, (G + T) / 2), M["inner"])
    box((w + 0.2, P + 0.4, G), (x, yw - P / 2 + 0.2, G / 2), M["st"], bevel=0.05)
    if glass:
        g.box((w - 0.7, 0.08, T - G - 0.2), (0, 0.15, (G + T) / 2), M["win"], kind="lit")
        g.prism([(-w / 2 + 0.3, 0.18, T), (w / 2 - 0.3, 0.18, T), (0, 0.18, T + rise - 0.3)], 0.05, M["win"], kind="lit")
        nm = max(3, round(w / 1.5))
        for k in range(1, nm): g.box((0.16, 0.2, T - G), (-w / 2 + k * w / nm, 0.06, (G + T) / 2), TIM)
        g.box((w, 0.22, 0.16), (0, 0.06, G + (T - G) * 0.55), TIM)
        for k in range(1, 4):
            xx = -w / 2 + k * w / 4; hh = rise * (1 - abs(xx) / (w / 2)) - 0.15
            if hh > 0.3: g.box((0.16, 0.22, hh), (xx, 0.06, T + hh / 2), TIM)
    else:
        B.gable_wall(g, w, 0.1, T, rise, M["boards"], 0.2)
    a = math.atan2(rise, w / 2)
    for sd in (-1, 1):
        if log_cols:
            g.cyl(0.3, T - G - 1.0, (sd * (w / 2 - 0.1), -0.35, (G + 1.0 + T) / 2), M["logy"], verts=12)
            g.box((0.95, 0.95, 1.0), (sd * (w / 2 - 0.1), -0.35, G + 0.5), M["st"], bevel=0.05)
            g.pad((0.9, 0.9, 0.14), (sd * (w / 2 - 0.1), -0.35, G + 1.05), SN)
        g.box((math.hypot(w / 2, rise) + 0.6, 0.34, 0.36), (sd * w / 4, -0.2, T + rise / 2), TIM, rot=(0, sd * a, 0), bevel=0.03)
        g.box((0.24, 0.24, 1.9), (sd * (w / 2 - 0.75), -0.35, T - 0.75), TIM, rot=(0, -sd * 0.75, 0))
    B.truss(g, w + 0.3, -0.35, T + 0.05, rise - 0.45, M, r=0.32)
    MR = dict(M); MR["roof"] = M[mat_roof]
    B.gable_roof(Frame((x, 0, 0)), w, yf - 1.3, y1 if y1 is not None else yw + rise * 1.4, T, rise, 0.95, MR, thick=0.4, st=0.65, ice=10, ends=(True, False))
    if door: B.door(g, 0, 0.3, 2.4, 2.6, M, double=True, glazed=True, y=-0.15)
    if sign:
        g.box((min(w - 1.0, 0.4 * len(sign) + 1.0), 0.14, 0.7), (0, -0.62, T - 0.5), M["sign"], bevel=0.03)
        text(sign, 0.34, g.p(0, -0.71, T - 0.5), M["cream"], rot=(PI / 2, 0, 0), extrude=0.01)
    return yf

def lodge_body(L, D, G, T, pitch, M, wall, roof, base=1.2, bays=None, back=True, ends=True, logs=False, ice=30):
    """The main hall: a stone base to `base`, walls of `wall` (or round logs) to the eave T, a timber belt,
    tall windows by bays on the long sides and the ends, the main roof (ridge along X) under deep snow.
    Returns the roof's pitch and top-height function."""
    ST, TIM = M["st"], M["tim"]; R = D / 2 * pitch
    box((L + 0.4, D + 0.4, base), (0, 0, base / 2), ST, bevel=0.05)
    if logs:
        box((L - 0.4, D - 0.4, T - base), (0, 0, (base + T) / 2), M["inner"])
        for i in range(int((T - base) / 0.34)):
            z = base + 0.17 + i * 0.34
            for sy in (-1, 1): cyl(0.17, L + 0.7, (0, sy * D / 2, z), M["log"], rot=(0, PI / 2, 0), verts=10)
            for sx in (-1, 1): cyl(0.17, D + 0.7, (sx * L / 2, 0, z + 0.17), M["logy"], rot=(PI / 2, 0, 0), verts=10)
    else:
        box((L, D, T - base), (0, 0, (base + T) / 2), M[wall])
        for sx in (-1, 1):
            for sy in (-1, 1): box((0.32, 0.32, T - base), (sx * L / 2, sy * D / 2, (base + T) / 2), TIM)
    box((L + 0.4, D + 0.4, 0.16), (0, 0, base + 0.05), TIM)
    nb = bays or max(2, round(L / 4.5)); bw = L / nb
    sides = [Frame((0, -D / 2 - 0.05, 0))] + ([Frame((0, D / 2 + 0.05, 0), PI)] if back else [])
    for f in sides:
        for k in range(nb):
            x = -L / 2 + bw * (k + 0.5)
            win(f, x, base + 0.5, bw - 1.6, T - base - 1.2, M, cols=3, y=-0.02)
    MR = dict(M); MR["roof"] = M[roof]
    a, top = B.gable_roof(Frame((0, 0, 0), PI / 2), D, -L / 2 - 1.2, L / 2 + 1.2, T, R, 1.4, MR, thick=0.42, st=0.7, ice=ice)
    if ends:
        for sx in (-1, 1):
            e = Frame((sx * (L / 2 + 0.05), 0, 0), sx * PI / 2)
            B.gable_wall(e, D + 0.1, 0, T, R, M[wall] if not logs else M["boards"], 0.2)
            for x in (-D / 4, D / 4): win(e, x, base + 0.5, 2.2, T - base - 1.2, M, cols=2)
            win(e, 0, T + R * 0.3, 2.4, min(2.4, R * 0.45), M, cols=3, snow=False)
    return a, top, R

def deck(x0, x1, y0, depth, z, M, rail="timber", tables=4, umbrellas=2, stairs_x=None):
    """A deck in front (-Y) of y0: framing, boards, a railing (timber, log or glass), tables and umbrellas."""
    TIM, SN = M["tim"], M["sn"]; w = x1 - x0; cx = (x0 + x1) / 2; yb = y0 - depth
    box((w, depth, 0.35), (cx, y0 - depth / 2, z - 0.18), TIM, bevel=0.03)
    for i in range(int(depth / 0.3)): box((w - 0.1, 0.27, 0.06), (cx, y0 - 0.15 - i * 0.3, z + 0.02), M["deck"], bevel=0.01)
    if z > 0.8:
        for k in range(int(w / 4) + 1): box((0.3, 0.3, z), (x0 + 0.3 + k * (w - 0.6) / max(1, int(w / 4)), yb + 0.3, z / 2), TIM)
    segs = [((x0, yb), (x1, yb)), ((x0, yb), (x0, y0)), ((x1, yb), (x1, y0))]
    for (ax, ay), (bx, by) in segs:
        if rail == "glass": rail_glass((ax, ay), (bx, by), z, M)
        else:
            L = math.hypot(bx - ax, by - ay); a = math.atan2(by - ay, bx - ax); n = max(1, round(L / 1.8)); f = Frame(((ax + bx) / 2, (ay + by) / 2, z), a)
            for k in range(n + 1): f.box((0.14, 0.14, 1.05), (-L / 2 + k * L / n, 0, 0.52), TIM)
            for hz in (0.5, 1.0): f.box((L, 0.14, 0.14), (0, 0, hz), TIM)
            f.box((L, 0.24, 0.12), (0, 0, 1.11), SN, bevel=0.05, seg=1, kind="snow")
    cols = ("#8e3b32", "#e6dac3", "#36506e", "#c9a65a")
    for k in range(tables):
        tx = x0 + (k + 0.5) * w / tables
        B.picnic((tx, y0 - depth * 0.5, z + 0.04), M["deck"], SN, rot=0.06 * (k % 3 - 1))
        if k < umbrellas * 2 and k % 2 == 0: B.parasol((tx + 1.7, y0 - depth * 0.5, z + 0.04), TIM, flat("cloth" + cols[k % 4], cols[k % 4], 0.9), SN)
    if stairs_x is not None and z > 0.4:
        n = int(z / 0.18)
        for i in range(n): box((2.4, 0.32, 0.18), (stairs_x, yb - 0.2 - i * 0.3, z - 0.09 - i * 0.18), M["st"], bevel=0.02)

def rail_glass(p0, p1, z, M, h=1.05):
    GR = glass("rail_glass", "#b8c8d4", 0.3)
    x0, y0 = p0; x1, y1 = p1; L = math.hypot(x1 - x0, y1 - y0); a = math.atan2(y1 - y0, x1 - x0); c = ((x0 + x1) / 2, (y0 + y1) / 2)
    box((L, 0.03, h - 0.12), (c[0], c[1], z + h / 2), GR, rot=(0, 0, a), kind="glass")
    box((L, 0.1, 0.07), (c[0], c[1], z + h), M["char"], rot=(0, 0, a))
    box((L, 0.18, 0.09), (c[0], c[1], z + h + 0.07), M["sn"], rot=(0, 0, a), bevel=0.035, seg=1, kind="snow")

# ---------- Snowbasin ----------
def earls_lodge():
    """Earl's Lodge, Snowbasin's main base lodge (2002): whole-log frame and big log-truss gables with tall
    timber-mullioned glass, river-stone walls and three tall stone chimneys with copper caps, cedar-shake roofs
    in several gables, a stone-columned entry portico, a slope-side deck. Photos: snowbasin.com and liftblog
    (slcref/snowbasin/photos/earls_lodge_1-4). OSM w136016447 (63 x 70 m incl. wings); built 52 x 22 m plus gables."""
    new_col("earls_lodge"); M = lodge_mats(); B.anchor(M)
    L, D, G, T = 52.0, 22.0, 1.4, 8.6
    a, top, R = lodge_body(L, D, G, T, 0.62, M, "honeyb", "shake", base=2.6, ice=34)
    for x, w, sgn in ((-15.0, 10.0, None), (2.0, 13.0, "EARL'S LODGE"), (17.5, 9.0, None)):
        front_gable(x, -D / 2, w, 3.4, G + 1.2, T, w / 2 * 0.95, M, "shake", sign=sgn)
    for x, y in ((-22.0, 2.0), (-8.5, 5.0), (10.0, 4.0)): capped_chimney(x, y, top(abs(y)) - 1.2, 4.2, M)
    # The entry portico on the east end: stone columns, a log truss, a shake gable.
    ex = L / 2 + 4.0; e = Frame((ex, 0, 0), PI / 2)
    for sy in (-1, 1):
        box((1.1, 1.1, 3.4), (ex + 2.0, sy * 3.2, 1.7), M["st"], bevel=0.05)
        cyl(0.28, 2.6, (ex + 2.0, sy * 3.2, 4.7), M["logy"], verts=12)
    B.truss(Frame((ex + 2.0, 0, 0), PI / 2), 7.2, 0, 6.1, 2.6, M, r=0.3)
    B.gable_roof(Frame((ex, 0, 0), PI / 2), 7.6, -3.0, 4.6, 6.0, 3.0, 0.7, dict(M, roof=M["shake"]), thick=0.36, st=0.6, ice=6, ends=(True, False))
    deck(-L / 2, L / 2, -D / 2 - 3.4, 6.5, 1.2, M, rail="timber", tables=6, umbrellas=2, stairs_x=-L / 2 + 3)
    for x in (-24, 24): B.rack((x, -D / 2 - 12, 0), M["tim"], M["sn"], rot=PI / 2)
    B.drifts([(0, D / 2 + 0.8, L + 2, 1.8), (-L / 2 - 0.8, 0, 1.6, D)], M, h=0.9)
    finalize("earls_lodge", 2048, ao_dist=1.5)

def needles_lodge():
    """Needles Lodge at the top of Snowbasin's Needles Gondola, under the rock spires: a heavy log post-and-beam
    lodge on rubble-stone walls, a log porch on big round columns, tall timber-mullioned glass, a grey shake
    roof of hips and gables, two stone chimneys with copper caps, a big stone-walled terrace with umbrellas.
    Photos: slcref/snowbasin/photos/needles_lodge_1-4. OSM w64126736 (43 x 58 m); built 34 x 20 m plus terrace."""
    new_col("needles_lodge"); M = lodge_mats(); B.anchor(M)
    L, D, G, T = 34.0, 20.0, 1.0, 6.4
    a, top, R = lodge_body(L, D, G, T, 0.55, M, "honeyb", "shake", base=2.2, logs=True, ice=24)
    front_gable(-6.0, -D / 2, 12.0, 3.6, G + 1.0, T, 5.4, M, "shake", sign="NEEDLES LODGE")
    front_gable(10.0, -D / 2, 8.0, 2.2, G + 1.0, T, 3.8, M, "shake")
    for x, y in ((-13.0, 3.0), (8.0, -2.0)): capped_chimney(x, y, top(abs(y)) - 1.0, 3.8, M)
    # The terrace: a stone retaining wall downhill, flagstones, umbrellas.
    ty0, td = -D / 2 - 3.6, 10.0
    box((L + 4, td, 1.6), (0, ty0 - td / 2, 0.8), M["st"], bevel=0.05)
    deck(-L / 2 - 2, L / 2 + 2, ty0, td, 1.65, M, rail="timber", tables=6, umbrellas=3, stairs_x=L / 2 - 2)
    B.drifts([(0, D / 2 + 0.8, L + 2, 1.8), (L / 2 + 0.8, 0, 1.6, D)], M, h=0.9)
    finalize("needles_lodge", 2048, ao_dist=1.5)

def john_paul_lodge():
    """John Paul Lodge (Snowbasin, ~9,000 ft), at the top of John Paul Express and the foot of the Allen Peak
    Tram: a round hall on a stone base with a ring of tall timber-framed windows, a low conical shake roof with
    deep eaves, a stone-and-timber cupola chimney with a copper cap on its crown, and a wraparound deck with a
    glass rail. Photos: slcref/snowbasin/photos/john_paul_lodge_1, _3, allen_peak_tram_3."""
    new_col("john_paul_lodge"); M = lodge_mats(); B.anchor(M)
    n, Rr, G, T = 12, 12.0, 1.0, 5.8
    SN, TIM = M["sn"], M["tim"]
    cyl(Rr + 0.3, G, (0, 0, G / 2), M["st"], verts=n, rot=(0, 0, PI / n))
    cyl(Rr - 0.4, T - G, (0, 0, (G + T) / 2), M["inner"], verts=n, rot=(0, 0, PI / n))
    side = 2 * Rr * math.sin(PI / n)
    for k in range(n):
        a = 2 * PI * (k + 0.5) / n; f = Frame((Rr * math.cos(PI / n) * math.cos(a), Rr * math.cos(PI / n) * math.sin(a), 0), a + PI / 2)
        f.box((side, 0.4, 0.9), (0, 0, G + 0.45), M["st"])
        glazing(f, -side / 2 + 0.2, side / 2 - 0.2, G + 0.9, T - 0.2, M, step=1.4, transoms=(G + 3.2,), mull="honeyz")
        f.box((0.4, 0.4, T - G), (side / 2, 0.05, (G + T) / 2), TIM)
    # The conical roof (twelve facets), a ring of snow on it, the cupola chimney.
    re, rise = Rr + 2.6, 4.2
    cyl(re, 0.4, (0, 0, T + 0.1), M["shake"], verts=n, r2=re - 0.3, rot=(0, 0, PI / n))
    cyl(re - 0.2, rise, (0, 0, T + 0.3 + rise / 2), M["shake"], verts=n, r2=1.8, rot=(0, 0, PI / n))
    cyl(re - 0.15, rise, (0, 0, T + 0.62 + rise / 2), SN, verts=n, r2=1.9, rot=(0, 0, PI / n), kind="snow")
    cyl(re + 0.1, 0.35, (0, 0, T + 0.25), TIM, verts=n, r2=re + 0.1, rot=(0, 0, PI / n))
    box((3.0, 3.0, 3.4), (0, 0, T + rise + 1.4), M["st"], bevel=0.05)
    for sx in (-1, 1):
        for sy in (-1, 1): box((0.25, 0.25, 1.2), (sx * 1.2, sy * 1.2, T + rise + 3.7), TIM)
    box((2.2, 2.2, 1.0), (0, 0, T + rise + 3.6), M["win"], kind="lit")
    cyl(2.6, 1.2, (0, 0, T + rise + 4.8), M["cap"], verts=4, r2=0.15, rot=(0, 0, PI / 4))
    B.pad((2.6, 2.6, 0.3), (0, 0, T + rise + 3.2), SN)
    # The wraparound deck on the downhill half, glass rail; ski racks.
    for k in range(7):
        a0 = PI + k * PI / 7; a1 = PI + (k + 1) * PI / 7; r0, r1 = Rr + 0.2, Rr + 5.5
        pts = [(r0 * math.cos(a0), r0 * math.sin(a0)), (r1 * math.cos(a0), r1 * math.sin(a0)), (r1 * math.cos(a1), r1 * math.sin(a1)), (r0 * math.cos(a1), r0 * math.sin(a1))]
        S.prism(pts, 0.0, G - 0.05, M["deck"])
        rail_glass(pts[1], pts[2], G, M)
    for k in range(5):
        a = PI + (k + 0.5) * PI / 5; B.picnic(((Rr + 2.7) * math.cos(a), (Rr + 2.7) * math.sin(a), G), M["deck"], SN, rot=a + PI / 2)
    B.rack((Rr + 4, 4, 0), TIM, SN, rot=0.3)
    finalize("john_paul_lodge", 2048, ao_dist=1.5)

# ---------- Deer Valley ----------
def snow_park_lodge():
    """Deer Valley's Snow Park Lodge: a big timber chalet in honey-tan vertical boards over a stone base whose
    broad, steep gable end faces the slope with rows of tall lit windows on three floors, a lower wing either
    side with its own gables, two stone chimneys with copper caps, and a long slope-side deck.
    Photos: slcref/deervalley/photos/snow_park_lodge_1-2. OSM w224293845; built 30 x 34 m plus the wings."""
    new_col("snow_park_lodge"); M = lodge_mats(); B.anchor(M)
    SN, TIM = M["sn"], M["tim"]; MR = dict(M); MR["roof"] = M["shake"]
    W, D, base, T, R = 30.0, 34.0, 1.6, 10.6, 11.5
    box((W + 0.4, D + 0.4, base), (0, 0, base / 2), M["st"], bevel=0.05)
    box((W, D, T - base), (0, 0, (base + T) / 2), M["honeyb"])
    for sx in (-1, 1):
        for sy in (-1, 1): box((0.34, 0.34, T - base), (sx * W / 2, sy * D / 2, (base + T) / 2), TIM)
    for z in (base, base + 3.2, base + 6.4): box((W + 0.3, D + 0.3, 0.2), (0, 0, z), TIM)
    a, top = B.gable_roof(Frame((0, 0, 0)), W, -D / 2 - 1.6, D / 2 + 1.4, T, R, 1.4, MR, thick=0.45, st=0.75, ice=30)
    # The gable end facing the slope: three floors of tall windows, a glazed triangle, a heavy timber truss.
    g = Frame((0, -D / 2 - 0.05, 0))
    for z in (base + 0.4, base + 3.6, base + 6.8):
        for k in range(7): win(g, -W / 2 + 2.2 + k * (W - 4.4) / 6, z, 2.2, 2.5, M, cols=2)
    B.gable_wall(g, W, 0, T, R, M["honeyb"], 0.2)
    g.prism([(-W / 4, -0.08, T + 1.0), (W / 4, -0.08, T + 1.0), (0, -0.08, T + R * 0.45)], 0.05, M["win"], kind="lit")
    for k in range(-2, 3): hh = (R * 0.45 - 1.0) * (1 - abs(k) / 2.6); g.box((0.16, 0.2, hh), (k * W / 12, -0.14, T + 1.0 + hh / 2), TIM)
    B.truss(g, W + 0.6, -0.5, T + 0.05, R - 0.6, M, r=0.38)
    # Long sides: windows, and the lower wings with their own gables toward the slope.
    for sx in (-1, 1):
        e = Frame((sx * (W / 2 + 0.05), 0, 0), sx * PI / 2)
        for y in range(-12, 13, 6):
            win(e, y, base + 0.5, 2.2, 2.3, M, cols=2); win(e, y, base + 3.7, 2.2, 2.3, M, cols=2)
        wx = sx * (W / 2 + 9.0)
        box((18.0, 22.0, 5.4 - base), (wx, -4.0, (base + 5.4) / 2), M["honeyb"])
        box((18.4, 22.4, base), (wx, -4.0, base / 2), M["st"], bevel=0.05)
        B.gable_roof(Frame((wx, 0, 0)), 18.0, -15.6, 7.6, 5.4, 5.6, 1.0, MR, thick=0.38, st=0.65, ice=14)
        wg = Frame((wx, -15.05, 0))
        B.gable_wall(wg, 18.0, 0, 5.4, 5.6, M["honeyb"], 0.2)
        for x in (-6, -2, 2, 6): win(wg, x, base + 0.5, 2.6, 2.6, M, cols=2)
        win(wg, 0, 6.2, 3.0, 1.8, M, cols=3, snow=False)
    for x, y in ((-8.0, 6.0), (8.0, 10.0)): capped_chimney(x, y, top(abs(x)) - 1.0, 5.0, M)
    deck(-W / 2 - 18, W / 2 + 18, -D / 2 - 0.2, 8.0, 1.2, M, rail="timber", tables=8, umbrellas=3, stairs_x=0)
    text("SNOW PARK LODGE", 0.7, (0, -D / 2 - 0.3, T - 0.8), M["cream"], extrude=0.02)
    B.drifts([(0, D / 2 + 0.9, W + 2, 1.8)], M, h=1.0)
    finalize("snow_park_lodge", 2048, ao_dist=1.5)

def silver_lake_lodge():
    """Silver Lake Lodge at Deer Valley's Silver Lake Village (8,100 ft): a long low timber hall whose huge
    central gable faces the snow in floor-to-ceiling glass behind log posts and trusses, cedar-shake roofs,
    lower wings either side, timber decks with log railings and a brick-paved plaza.
    Photos: slcref/deervalley/photos/silver_lake_lodge_1-3. OSM w241190808 (126 x 63 m incl. the village);
    built 60 x 20 m."""
    new_col("silver_lake_lodge"); M = lodge_mats(); B.anchor(M)
    L, D, G, T = 60.0, 20.0, 0.8, 5.4
    a, top, R = lodge_body(L, D, G, T, 0.6, M, "bnb", "shake", base=1.2, ice=36)
    front_gable(0.0, -D / 2, 22.0, 3.0, 1.0, T, 9.0, M, "shake", sign="SILVER LAKE LODGE")
    for x in (-22.0, 22.0): front_gable(x, -D / 2, 8.0, 1.2, 1.0, T, 3.4, M, "shake", glass=False)
    for x, y in ((-16.0, 3.0), (16.0, 3.0)): capped_chimney(x, y, top(abs(y)) - 1.0, 3.6, M)
    box((L + 10, 12.0, 0.25), (0, -D / 2 - 9.0, 0.12), flat("brick_paving", "#8a5a46", 0.9, grain=0.12))
    deck(-L / 2, -12.0, -D / 2 - 1.2, 5.0, 0.8, M, rail="timber", tables=4, umbrellas=2)
    deck(12.0, L / 2, -D / 2 - 1.2, 5.0, 0.8, M, rail="timber", tables=4, umbrellas=2)
    B.drifts([(0, D / 2 + 0.8, L + 2, 1.8)], M, h=0.9)
    finalize("silver_lake_lodge", 2048, ao_dist=1.5)

def empire_canyon_lodge():
    """Deer Valley's Empire Canyon Lodge: a big log-and-timber lodge in board-and-batten siding with
    cedar-shake gables, a tall glazed central gable, stone chimneys and stone-faced terrace walls, many-paned
    windows. Photos: slcref/deervalley/photos/empire_canyon_lodge_1-3. OSM w251098893 (54 x 53 m); built 40 x 20 m."""
    new_col("empire_canyon_lodge"); M = lodge_mats(); B.anchor(M)
    L, D, G, T = 40.0, 20.0, 1.0, 7.6
    a, top, R = lodge_body(L, D, G, T, 0.75, M, "bnb", "shake", base=1.6, ice=28)
    for k in range(int(L / 0.5)): box((0.05, 0.05, T - 1.6), (-L / 2 + 0.25 + k * 0.5, -D / 2 - 0.03, (1.6 + T) / 2), M["tim"])  # battens
    front_gable(-4.0, -D / 2, 14.0, 3.0, 1.6, T, 7.4, M, "shake", sign="EMPIRE CANYON LODGE")
    front_gable(13.0, -D / 2, 8.0, 1.6, 1.6, T, 4.4, M, "shake", glass=False)
    for x, y in ((-14.0, 2.0), (6.0, 3.5)): capped_chimney(x, y, top(abs(y)) - 1.0, 4.0, M)
    for x in (-15, 4): B.dormer(W0, x, -5.0, top(5.0), math.tan(a), 2.6, M, hw=2.0, drise=1.0, wall=M["bnb"])
    box((L + 6, 1.0, 1.4), (0, -D / 2 - 9.0, 0.7), M["st"], bevel=0.05)  # the terrace wall
    deck(-L / 2 - 2, L / 2 + 2, -D / 2 - 3.0, 5.6, 1.4, M, rail="timber", tables=5, umbrellas=2, stairs_x=-L / 2)
    B.drifts([(0, D / 2 + 0.8, L + 2, 1.8), (L / 2 + 0.8, 0, 1.6, D)], M, h=0.9)
    finalize("empire_canyon_lodge", 2048, ao_dist=1.5)

# ---------- Snowbird ----------
def concrete_mats(M):
    M.update(bfc=flat("bf_concrete", "#b7b0a4", 0.9, grain=0.12), fl=flat("formlines", "#9a948a", 0.9, grain=0),
             mirror=flat("mirror_glass", "#20262c", 0.12, 0.3, grain=0.02), mull=flat("mullion", "#2a2d31", 0.5, grain=0),
             greymetal=flat("grey_metal", "#8a9096", 0.45, grain=0.03))
    return M

def formed(x, y, z, sx, sy, sz, M, step=1.2):
    """A block of board-formed concrete with its form lines."""
    box((sx, sy, sz), (x, y, z), M["bfc"])
    for k in range(1, int(sz / step)): box((sx + 0.03, sy + 0.03, 0.035), (x, y, z - sz / 2 + k * step), M["fl"])

def curtain(f, x0, x1, z0, z1, M, step=1.5, rows=1, y=0.0, lit=True):
    """A curtain wall: glass from x0 to x1, z0 to z1 in dark mullions."""
    w = x1 - x0; f.box((w, 0.06, z1 - z0), ((x0 + x1) / 2, y + 0.02, (z0 + z1) / 2), M["win"] if lit else M["mirror"], kind="lit" if lit else "bake")
    n = max(1, round(w / step))
    for k in range(n + 1): f.box((0.09, 0.14, z1 - z0), (x0 + k * w / n, y - 0.04, (z0 + z1) / 2), M["mull"])
    for r in range(rows + 1): f.box((w, 0.14, 0.09), ((x0 + x1) / 2, y - 0.04, z0 + r * (z1 - z0) / rows), M["mull"])

def cliff_lodge():
    """Snowbird's Cliff Lodge: a raw board-formed concrete slab of a hotel, ten floors of a deep balcony grid
    between concrete fins over a glazed two-storey podium, and a darker wing of mirror glass; flat roofs under
    snow. Photos: slcref/snowbird/photos/cliff_lodge_1, peruvian_base_cliff_lodge_view. OSM does not map
    it; built 66 x 18 m slab plus a 24 x 20 m glass wing, 36 m tall."""
    new_col("cliff_lodge"); M = concrete_mats(lodge_mats()); B.anchor(M)
    SN = M["sn"]; L, D, P, FH, n = 66.0, 18.0, 7.0, 2.9, 10
    T = P + n * FH
    formed(0, 0, P / 2, L, D, P, M)
    for f in (Frame((0, -D / 2 - 0.05, 0)), Frame((0, D / 2 + 0.05, 0), PI)):
        curtain(f, -L / 2 + 2, L / 2 - 2, 0.6, P - 1.0, M, step=2.4, rows=2)
    box((L - 1.0, D - 1.0, T - P), (0, 0, (P + T) / 2), M["bfc"])
    nb = 18; bw = (L - 2.0) / nb
    for f in (Frame((0, -D / 2 + 0.5, 0)), Frame((0, D / 2 - 0.5, 0), PI)):
        for k in range(nb + 1): f.box((0.35, 1.6, T - P), (-L / 2 + 1.0 + k * bw, -0.8, (P + T) / 2), M["bfc"])  # the fins
        for j in range(n):
            z = P + j * FH
            f.box((L - 2.0, 1.5, 0.22), (0, -0.75, z + 0.11), M["bfc"])
            f.box((L - 2.0, 0.05, FH - 0.5), (0, 0.02, z + 0.25 + (FH - 0.5) / 2), M["win"], kind="lit")
            f.box((L - 2.0, 0.06, 0.9), (0, -1.45, z + 0.7), M["mull"])
            f.box((L - 2.0, 0.2, 0.08), (0, -1.45, z + 1.2), SN, bevel=0.03, seg=1, kind="snow")
    for sx in (-1, 1): formed(sx * (L / 2 - 0.5), 0, (P + T) / 2, 1.2, D, T - P, M, step=FH)
    box((L, D, 0.5), (0, 0, T + 0.25), M["bfc"]); B.pad((L - 0.6, D - 0.6, 0.6), (0, 0, T + 0.7), SN)
    for x in (-18, 10): formed(x, 0, T + 2.0, 8.0, 6.0, 3.5, M); B.pad((7.6, 5.6, 0.5), (x, 0, T + 4.0), SN)
    # The mirror-glass wing at the east end, a touch lower, its mullion grid; the glass podium link.
    wx, ww, wd, wt = L / 2 + 12.0, 24.0, 20.0, T - 3.0
    box((ww, wd, wt), (wx, 1.0, wt / 2), M["mirror"])
    for k in range(int(ww / 1.5) + 1):
        for y in (1.0 - wd / 2 - 0.03, 1.0 + wd / 2 + 0.03): box((0.08, 0.06, wt), (wx - ww / 2 + k * 1.5, y, wt / 2), M["mull"])
    for k in range(int(wt / FH) + 1):
        box((ww + 0.06, wd + 0.06, 0.08), (wx, 1.0, k * FH), M["mull"])
    box((ww + 0.4, wd + 0.4, 0.5), (wx, 1.0, wt + 0.25), M["bfc"]); B.pad((ww - 0.4, wd - 0.4, 0.6), (wx, 1.0, wt + 0.7), SN)
    B.drifts([(0, -D / 2 - 0.8, L, 1.6), (-L / 2 - 0.8, 0, 1.6, D)], M, h=1.0)
    finalize("cliff_lodge", 2048, ao_dist=1.5)

def the_summit():
    """The Summit (2015) on Hidden Peak beside the tram's top dock: two storeys, a lower one of concrete panels
    with windows and an upper one glazed all round in dark mullions under a thin overhanging roof, a rounded
    glass corner, a tall concrete logo pylon and an outside steel stair, a terrace with tables.
    Photos: slcref/snowbird/photos/summit_hidden_peak_1-2. OSM does not map it; built 40 x 18 m."""
    new_col("the_summit"); M = concrete_mats(lodge_mats()); B.anchor(M)
    SN = M["sn"]; L, D, G, T = 40.0, 18.0, 4.2, 8.6
    box((L, D, G), (0, 0, G / 2), M["bfc"])
    for k in range(1, int(L / 3.0)): box((0.04, D + 0.04, G), (-L / 2 + k * 3.0, 0, G / 2), M["fl"])
    f = Frame((0, -D / 2 - 0.03, 0))
    for x in (-14, -8, 8, 14): win(f, x, 1.0, 2.4, 2.0, M, cols=2, fr="mull", snow=False)
    curtain(f, -5.0, 5.0, 0.3, G - 0.4, M, step=1.25)
    box((L - 6.0, D - 0.6, T - G), (-3.0, 0, (G + T) / 2), M["inner"])
    for ff, half in ((Frame((-3.0, -D / 2 + 0.25, 0)), (L - 6) / 2), (Frame((-3.0, D / 2 - 0.25, 0), PI), (L - 6) / 2), (Frame((-L / 2 + 0.25, 0, 0), -PI / 2), D / 2 - 0.3)):
        curtain(ff, -half, half, G + 0.1, T - 0.3, M, step=1.6)
    rc = D / 2 - 0.3; cx = L / 2 - 6.0  # the rounded glass corner at the east end
    for k in range(8):
        a0, a1 = -PI / 2 + k * PI / 8, -PI / 2 + (k + 1) * PI / 8; am = (a0 + a1) / 2; sg = 2 * rc * math.sin(PI / 16)
        box((sg, 0.06, T - G - 0.3), (cx + rc * math.cos(am), rc * math.sin(am), (G + T) / 2), M["win"], rot=(0, 0, am + PI / 2), kind="lit")
        box((0.09, 0.14, T - G - 0.3), (cx + rc * math.cos(a0), rc * math.sin(a0), (G + T) / 2), M["mull"])
    cyl(rc, 0.2, (cx, 0, G + 0.05), M["bfc"], verts=24)
    box((L - 6.0 + 1.6, D + 1.6, 0.4), (-3.0, 0, T + 0.1), M["greymetal"])
    cyl(rc + 0.8, 0.4, (cx, 0, T + 0.1), M["greymetal"], verts=28)
    B.pad((L - 6, D, 0.6), (-3.0, 0, T + 0.55), SN); cyl(rc + 0.5, 0.5, (cx, 0, T + 0.55), SN, verts=28, kind="snow")
    # The logo pylon and the stair.
    formed(-L / 2 + 8.0, -D / 2 - 1.4, 7.0, 2.6, 2.4, 14.0, M)
    box((2.0, 0.1, 2.0), (-L / 2 + 8.0, -D / 2 - 2.65, 11.5), M["sign"]); text("THE SUMMIT", 0.26, (-L / 2 + 8.0, -D / 2 - 2.72, 11.5), M["cream"], extrude=0.01)
    for i in range(14): box((1.4, 0.3, 0.06), (-L / 2 + 11.0 + i * 0.32, -D / 2 - 1.1, 0.3 + i * 0.3), M["mull"])
    rail_glass((-L / 2 - 2, -D / 2 - 9), (L / 2, -D / 2 - 9), 0.0, M)
    box((L + 4, 9.0, 0.2), (0, -D / 2 - 4.5, 0.1), M["conc"])
    for i, x in enumerate((-12, -4, 4, 12)): B.picnic((x, -D / 2 - 5.0, 0.2), M["deck"], SN, rot=0.05 * i)
    finalize("the_summit", 2048, ao_dist=1.3)

def the_nest():
    """The Nest (2025), Snowbird's new mid-mountain lodge where Mid-Gad stood: a glass dining hall with a
    timber diagrid behind the glass, cantilevered out over the slope on steel legs under a thin flat roof,
    beside a darker solid service block. Photos: slcref/snowbird/photos/the_nest_mid_gad_1 (and the
    architect's rendering). Built 34 x 18 m hall plus the block."""
    new_col("the_nest"); M = concrete_mats(lodge_mats()); B.anchor(M)
    SN = M["sn"]; L, D, z0, H = 30.0, 18.0, 2.4, 6.4
    box((L, D, 0.6), (0, 0, z0 - 0.3), M["mull"])
    box((L - 0.6, D - 0.6, H - 0.4), (0, 0, z0 + H / 2 - 0.2), M["inner"])
    for x in (-L / 2 + 1.5, -5, 5, L / 2 - 1.5):
        for y in (-D / 2 + 1.5, D / 2 - 1.5): box((0.45, 0.45, z0), (x, y, z0 / 2 - 0.3), M["mull"])
    sides = [(Frame((0, -D / 2, 0)), L / 2), (Frame((L / 2, 0, 0), PI / 2), D / 2), (Frame((-L / 2, 0, 0), -PI / 2), D / 2)]
    for f, half in sides:
        f.box((2 * half - 0.2, 0.06, H - 0.4), (0, 0.05, z0 + H / 2 - 0.2), M["win"], kind="lit")
        n = round(2 * half / 3.0)
        for k in range(n):  # the diagrid: a big X in each bay
            xa, xb = -half + k * 2 * half / n, -half + (k + 1) * 2 * half / n; dz = H - 0.6; ln = math.hypot(xb - xa, dz)
            a = math.atan2(dz, xb - xa)
            for sg in (1, -1): f.box((ln, 0.22, 0.24), ((xa + xb) / 2, -0.1, z0 + 0.1 + dz / 2), M["honeyz"], rot=(0, -sg * a, 0))
            f.box((0.2, 0.24, H - 0.4), (xa, -0.1, z0 + H / 2 - 0.2), M["mull"])
    box((L + 1.6, D + 1.6, 0.5), (0, 0, z0 + H), M["mull"]); B.pad((L + 1.0, D + 1.0, 0.6), (0, 0, z0 + H + 0.5), SN)
    box((L + 1.4, D + 1.4, 0.08), (0, 0, z0 + H - 0.28), M["honey"])
    bx = -L / 2 - 9.0
    box((18.0, 14.0, z0 + H - 1.0), (bx, 4.0, (z0 + H - 1.0) / 2), M["char"])
    for x in (-5, 0, 5): win(Frame((bx, 4.0 - 7.03, 0)), x, z0 + 1.2, 2.4, 1.6, M, cols=2, fr="mull", snow=False)
    box((18.6, 14.6, 0.4), (bx, 4.0, z0 + H - 0.8), M["mull"]); B.pad((18.0, 14.0, 0.6), (bx, 4.0, z0 + H - 0.4), SN)
    text("THE NEST", 0.9, (bx, 4.0 - 7.06, z0 + H - 2.0), M["cream"], extrude=0.02)
    deck(-L / 2, L / 2, -D / 2, 4.0, z0, M, rail="glass", tables=4, umbrellas=0)
    B.drifts([(bx, 11.8, 18, 1.4)], M, h=0.9)
    finalize("the_nest", 2048, ao_dist=1.3)

# ---------- Alta ----------
def alfs():
    """Alf's, Alta's mid-mountain restaurant above the Albion base: a stone-clad lower storey with service doors,
    an upper storey in grey standing-seam metal with a glazed dining box under a deep timber soffit, a low
    mono-pitch roof. Photo: slcref/alta/photos/alfs_restaurant_1 (alta.com, Nov 2020). OSM w328606382; built 40 x 20 m."""
    new_col("alfs"); M = concrete_mats(lodge_mats()); B.anchor(M)
    SN = M["sn"]; L, D, G, T = 40.0, 20.0, 3.6, 8.0
    box((L, D, G), (0, 0, G / 2), M["st"], bevel=0.05)
    f = Frame((0, -D / 2 - 0.03, 0))
    for x in (-12, -4): f.box((3.2, 0.1, 3.0), (x, 0, 1.5), M["greymetal"])
    box((L - 14, D, T - G), (-7.0, 0, (G + T) / 2), M["greymetal"])
    for k in range(int((L - 14) / 0.5)):
        for y in (-D / 2 - 0.02, D / 2 + 0.02): box((0.05, 0.05, T - G), (-L / 2 + 0.25 + k * 0.5, y, (G + T) / 2), M["seam"])
    for x in (-14, -7, 0): win(f, x, G + 1.0, 3.0, 2.0, M, cols=2, fr="mull", snow=False)
    # The dining box: glass on three sides at the east end, cantilevered a little, a timber soffit.
    gx = L / 2 - 7.0
    box((14.0, D + 2.0, 0.5), (gx, -1.0, G + 0.25), M["mull"])
    for ff, half in ((Frame((gx, -D / 2 - 2.0, 0)), 7.0), (Frame((L / 2, -1.0, 0), PI / 2), D / 2 + 1.0)):
        curtain(ff, -half, half, G + 0.5, T + 1.0, M, step=1.8)
    box((L + 2.0, D + 4.0, 0.45), (0, -1.0, T + 1.3), M["mull"], rot=(0.04, 0, 0))
    box((L + 1.6, D + 3.6, 0.06), (0, -1.0, T + 1.05), M["honey"], rot=(0.04, 0, 0))
    B.pad((L + 1.4, D + 3.4, 0.6), (0, -1.0, T + 1.75), SN)
    deck(gx - 7, L / 2 + 2, -D / 2 - 2.0, 4.0, G, M, rail="glass", tables=3, umbrellas=0)
    B.drifts([(0, D / 2 + 0.8, L, 1.6)], M, h=0.9)
    finalize("alfs", 2048, ao_dist=1.3)

def watson_shelter():
    """Watson Shelter (Collins Grill), Alta mid-mountain beside the Collins angle station: a two-storey flat-roofed
    box in grey horizontal siding, rows of big square windows, a deck on the slope side.
    Photos: slcref/alta/photos/watson_shelter_1-2 (liftblog). OSM w987472524 (26 x 26 m); built 26 x 16 m."""
    new_col("watson_shelter"); M = concrete_mats(lodge_mats()); B.anchor(M)
    SN = M["sn"]; L, D, T = 26.0, 16.0, 7.2
    LAP = flat("lap_grey", "#8e959b", 0.8, grain=0.06)
    box((L, D, T), (0, 0, T / 2), LAP)
    for k in range(1, int(T / 0.3)): box((L + 0.06, D + 0.06, 0.03), (0, 0, k * 0.3), M["mull"])  # the laps' shadow lines
    box((L + 0.2, D + 0.2, 0.8), (0, 0, 0.4), M["st"], bevel=0.04)
    for f, half in ((Frame((0, -D / 2 - 0.03, 0)), L / 2), (Frame((0, D / 2 + 0.03, 0), PI), L / 2), (Frame((L / 2 + 0.03, 0, 0), PI / 2), D / 2), (Frame((-L / 2 - 0.03, 0, 0), -PI / 2), D / 2)):
        n = int(2 * half / 2.6)
        for z in (1.0, 4.4):
            for k in range(n): win(f, -half + (k + 0.5) * 2 * half / n, z, 1.7, 1.7, M, cols=2, fr="mull")
    box((L + 0.8, D + 0.8, 0.4), (0, 0, T + 0.2), M["mull"]); B.pad((L + 0.2, D + 0.2, 0.7), (0, 0, T + 0.7), SN)
    text("COLLINS GRILL", 0.6, (0, -D / 2 - 0.08, 3.9), M["cream"], extrude=0.02)
    deck(-L / 2, L / 2, -D / 2, 5.0, 0.8, M, rail="timber", tables=4, umbrellas=0, stairs_x=-L / 2 + 2)
    for x in (-8, 8): B.rack((x, -D / 2 - 8, 0), M["tim"], SN, rot=PI / 2)
    finalize("watson_shelter", 1024, ao_dist=1.2)

def albion_lodge():
    """Alta's new Albion Day Lodge (2026, Albion Grill and Alta Java): two storeys on a granite base, timber
    vertical cladding with dark panels, big glazed bays, a flat roof with angled overhangs, a glass breezeway.
    Photo: slcref/alta/photos/albion_day_lodge_1 (alta.com, Oct 2026, under construction). OSM has a node
    only; built 48 x 20 m."""
    new_col("albion_lodge"); M = concrete_mats(lodge_mats()); B.anchor(M)
    SN = M["sn"]; L, D, G, T = 48.0, 20.0, 1.2, 8.4
    box((L, D, G), (0, 0, G / 2), M["st"], bevel=0.05)
    box((L, D, T - G), (0, 0, (G + T) / 2), M["honeyb"])
    f = Frame((0, -D / 2 - 0.03, 0))
    for x0, x1 in ((-L / 2 + 1, -10), (-2, 10)): f.box((x1 - x0, 0.08, T - G), ((x0 + x1) / 2, -0.02, (G + T) / 2), M["char"])
    curtain(f, -L / 2 + 2, -11, G + 0.2, 4.4, M, step=2.0); curtain(f, -1, 9, G + 0.2, 4.4, M, step=2.0)
    for x in range(-20, 22, 4): win(f, x, 5.4, 2.2, 1.6, M, cols=2, fr="mull", snow=False)
    curtain(f, 12, L / 2 - 1, G + 0.2, T - 0.4, M, step=1.6, rows=2)
    bk = Frame((0, D / 2 + 0.03, 0), PI)
    for x in range(-20, 22, 5): win(bk, x, 2.0, 2.4, 2.0, M, fr="mull"); win(bk, x, 5.4, 2.4, 1.6, M, fr="mull", snow=False)
    for x0, x1, tilt in ((-L / 2 - 1.5, 4, 0.06), (4, L / 2 + 2.5, -0.1)):
        box((x1 - x0, D + 4.0, 0.45), ((x0 + x1) / 2, -0.5, T + 0.3), M["greymetal"], rot=(tilt, 0, 0))
        B.pad((x1 - x0 - 0.6, D + 3.4, 0.6), ((x0 + x1) / 2, -0.5, T + 0.8), SN)
    box((8.0, 4.0, 4.0), (-L / 2 - 4.0, 2.0, 2.0), M["win"], kind="lit")  # the glass breezeway
    box((8.6, 4.6, 0.3), (-L / 2 - 4.0, 2.0, 4.15), M["mull"]); B.pad((8.4, 4.4, 0.4), (-L / 2 - 4.0, 2.0, 4.45), SN)
    text("ALBION", 0.8, (14.0, -D / 2 - 0.08, T - 1.0), M["cream"], extrude=0.02)
    deck(-L / 2, -12, -D / 2, 5.0, G, M, rail="glass", tables=3, umbrellas=0)
    B.drifts([(0, D / 2 + 0.8, L, 1.6)], M, h=0.9)
    finalize("albion_lodge", 2048, ao_dist=1.3)

def goldminers_daughter():
    """Alta's Goldminer's Daughter at the Wildcat base: a tall gabled glass atrium beside a rough stone wall, a
    tan stucco lodge wing of three storeys with rows of windows, a timber-fronted ski shop at its foot.
    Photo: slcref/alta/photos/goldminers_daughter_1. OSM w232712891; built 44 x 18 m."""
    new_col("goldminers_daughter"); M = concrete_mats(lodge_mats()); B.anchor(M)
    SN = M["sn"]; L, D, T = 34.0, 16.0, 10.0
    box((L, D, T), (6.0, 0, T / 2), M["stucco"])
    for f in (Frame((6.0, -D / 2 - 0.03, 0)), Frame((6.0, D / 2 + 0.03, 0), PI)):
        for z in (1.0, 4.2, 7.2):
            for k in range(8): win(f, -L / 2 + 2.2 + k * (L - 4.4) / 7, z, 1.4, 1.5, M, cols=2)
    box((L + 0.6, D + 0.6, 0.5), (6.0, 0, T + 0.25), M["mull"]); B.pad((L, D, 0.6), (6.0, 0, T + 0.7), SN)
    # The glass atrium: a steep gable of glass in a dark frame, a stone wall behind it.
    ax, aw, ad, aT = -L / 2 + 6.0 - 6.0, 12.0, 14.0, 9.0
    box((1.2, ad, aT + 3.0), (ax - aw / 2 - 0.6, 0, (aT + 3.0) / 2), M["st"], bevel=0.05)
    box((aw, ad, aT), (ax, 0, aT / 2), M["win"], kind="lit")
    g = Frame((ax, -ad / 2 - 0.05, 0))
    g.prism([(-aw / 2, 0, aT), (aw / 2, 0, aT), (0, 0, aT + 4.0)], 0.1, M["win"], kind="lit")
    for k in range(7): x = -aw / 2 + k * aw / 6; hh = aT + 4.0 * (1 - abs(x) / (aw / 2)); g.box((0.12, 0.16, hh), (x, -0.06, hh / 2), M["mull"])
    for z in (3.0, 6.0, aT): g.box((aw, 0.16, 0.12), (0, -0.06, z), M["mull"])
    MR = dict(M); MR["roof"] = M["greymetal"]
    B.gable_roof(Frame((ax, 0, 0)), aw, -ad / 2 - 0.4, ad / 2 + 0.4, aT, 4.0, 0.4, MR, thick=0.2, st=0.35, ice=0)
    shopfront(Frame((10.0, -D / 2 - 0.05, 0)), 0, 8.0, 3.6, M, "SKI SHOP")
    B.drifts([(6, D / 2 + 0.8, L, 1.6)], M, h=0.9)
    finalize("goldminers_daughter", 2048, ao_dist=1.3)

# ---------- Solitude ----------
def _village_with(name, extra, spec):
    """A village block from signature.py's generator, with materials of our own in its palette."""
    SG.VILLAGE[name] = spec; orig = SG.mats
    SG.mats = lambda: dict(orig(), **extra())
    try: SG._village(name)
    finally: SG.mats = orig

def village_block_solitude():
    """Solitude Village's lodges (Powderhorn, Eagle Springs, Moonbeam): four storeys of tan stucco with dark
    half-timbering over a stone base, timber balconies, cross gables and brown roofs.
    Photos: slcref/solitude/photos/village_1-2, powderhorn_lodge_1, eagle_springs_west_1."""
    _village_with("village_block_solitude", lambda: dict(cream_ht=flat("render_solitude", "#cdb894", 0.92, grain=0.07)),
                  dict(L=30.0, D=16.0, up=4, wall="cream_ht", accent="brown", fr="tim", pitch=0.7, bays="wbgwgw",
                       signs=["ST. BERNARD'S", "THIRSTY SQUIRREL", "STONE HAUS", "RENTALS", "HONEYCOMB GRILL"]))

def village_block_inn():
    """The Inn at Solitude: terracotta stucco, five storeys of arched windows and iron balconies, steep brown
    gable roofs, tall chimneys. Photos: slcref/solitude/photos/inn_1-2."""
    _village_with("village_block_inn", lambda: dict(terra=flat("render_terracotta", "#b5543a", 0.9, grain=0.06)),
                  dict(L=30.0, D=16.0, up=4, wall="terra", accent="terra", fr="tim", pitch=0.75, bays="wbwgwbw",
                       signs=["THE INN", "LIBRARY BAR", "SPA"]))

def solitude_clock_tower():
    """Solitude Village's clock tower over the plaza: a stone base, a cream stucco shaft with timber corners,
    four lit clock faces, an open timber belfry and a steep pyramid roof with a finial.
    Photo: slcref/solitude/photos/village_2."""
    new_col("solitude_clock_tower"); M = lodge_mats(); B.anchor(M)
    SN, TIM = M["sn"], M["tim"]; w, h = 4.4, 15.0
    box((w + 0.6, w + 0.6, 3.0), (0, 0, 1.5), M["st"], bevel=0.05)
    box((w, w, h - 3.0), (0, 0, 3.0 + (h - 3.0) / 2), M["stucco"])
    for sx in (-1, 1):
        for sy in (-1, 1): box((0.3, 0.3, h - 3.0), (sx * w / 2, sy * w / 2, 3.0 + (h - 3.0) / 2), TIM)
    for a in range(4):
        f = Frame((0, 0, 0), a * PI / 2)
        f.cyl(1.2, 0.12, (0, -w / 2 - 0.05, h - 2.2), M["cream"], rot=(PI / 2, 0, 0), verts=24)
        f.cyl(1.32, 0.08, (0, -w / 2 - 0.02, h - 2.2), TIM, rot=(PI / 2, 0, 0), verts=24)
        f.box((0.08, 0.04, 0.9), (0, -w / 2 - 0.13, h - 1.85), M["mull"] if "mull" in M else M["steel"])
        f.box((0.7, 0.04, 0.08), (0.3, -w / 2 - 0.13, h - 2.2), M["mull"] if "mull" in M else M["steel"])
        win(f, 0, 4.0, 1.0, 1.8, M, cols=2, y=-w / 2 - 0.02)
    B.door(Frame((0, -w / 2 - 0.32, 0)), 0, 0.2, 1.4, 2.4, M, double=True)
    for sx in (-1, 1):
        for sy in (-1, 1): box((0.3, 0.3, 2.6), (sx * (w / 2 - 0.3), sy * (w / 2 - 0.3), h + 1.3), TIM)
    box((w - 0.8, w - 0.8, 2.0), (0, 0, h + 1.1), M["win"], kind="lit")
    box((w + 0.4, w + 0.4, 0.3), (0, 0, h + 2.7), TIM)
    cyl((w + 1.4) * 0.72, 4.5, (0, 0, h + 5.1), M["shake"], verts=4, r2=0.1, rot=(0, 0, PI / 4))
    cyl((w + 1.2) * 0.72, 4.0, (0, 0, h + 5.0), SN, verts=4, r2=0.3, rot=(0, 0, PI / 4), kind="snow")
    cyl(0.06, 1.6, (0, 0, h + 8.0), M["steel"], verts=6)
    B.drifts([(0, w / 2 + 0.7, w + 1, 1.0)], M, h=0.6)
    finalize("solitude_clock_tower", 1024, ao_dist=1.0)

def _round_lodge(name, n, Rr, G, T, wall, roof, rise, cupola, deck_half=True):
    """A round lodge: a stone base, a ring of tall timber-framed windows (or walls), a low conical roof with deep
    eaves under snow, a cupola chimney on its crown, a deck round the downhill half."""
    new_col(name); M = lodge_mats(); B.anchor(M)
    SN, TIM = M["sn"], M["tim"]
    cyl(Rr + 0.3, G, (0, 0, G / 2), M["st"], verts=n, rot=(0, 0, PI / n))
    cyl(Rr - 0.4, T - G, (0, 0, (G + T) / 2), M[wall] if wall in M else M["inner"], verts=n, rot=(0, 0, PI / n))
    side = 2 * Rr * math.sin(PI / n)
    for k in range(n):
        a = 2 * PI * (k + 0.5) / n; f = Frame((Rr * math.cos(PI / n) * math.cos(a), Rr * math.cos(PI / n) * math.sin(a), 0), a + PI / 2)
        if wall == "glass":
            f.box((side, 0.4, 0.9), (0, 0, G + 0.45), M["st"])
            glazing(f, -side / 2 + 0.2, side / 2 - 0.2, G + 0.9, T - 0.2, M, step=1.4, transoms=(G + 3.2,), mull="honeyz")
        else:
            win(f, 0, G + 0.6, side * 0.55, 1.7, M, cols=2)
            if T - G > 5: win(f, 0, G + 3.6, side * 0.55, 1.5, M, cols=2)
        f.box((0.4, 0.4, T - G), (side / 2, 0.05, (G + T) / 2), TIM)
    re = Rr + 2.6
    cyl(re, 0.4, (0, 0, T + 0.1), M[roof], verts=n, r2=re - 0.3, rot=(0, 0, PI / n))
    cyl(re - 0.2, rise, (0, 0, T + 0.3 + rise / 2), M[roof], verts=n, r2=1.8, rot=(0, 0, PI / n))
    cyl(re - 0.15, rise, (0, 0, T + 0.62 + rise / 2), SN, verts=n, r2=1.9, rot=(0, 0, PI / n), kind="snow")
    cyl(re + 0.1, 0.35, (0, 0, T + 0.25), TIM, verts=n, r2=re + 0.1, rot=(0, 0, PI / n))
    if cupola:
        box((3.0, 3.0, 3.4), (0, 0, T + rise + 1.4), M["st"], bevel=0.05)
        for sx in (-1, 1):
            for sy in (-1, 1): box((0.25, 0.25, 1.2), (sx * 1.2, sy * 1.2, T + rise + 3.7), TIM)
        box((2.2, 2.2, 1.0), (0, 0, T + rise + 3.6), M["win"], kind="lit")
        cyl(2.6, 1.2, (0, 0, T + rise + 4.8), M["cap"], verts=4, r2=0.15, rot=(0, 0, PI / 4))
        B.pad((2.6, 2.6, 0.3), (0, 0, T + rise + 3.2), SN)
    for k in range(7):
        a0 = PI + k * PI / 7; a1 = PI + (k + 1) * PI / 7; r0, r1 = Rr + 0.2, Rr + 5.5
        pts = [(r0 * math.cos(a0), r0 * math.sin(a0)), (r1 * math.cos(a0), r1 * math.sin(a0)), (r1 * math.cos(a1), r1 * math.sin(a1)), (r0 * math.cos(a1), r0 * math.sin(a1))]
        S.prism(pts, 0.0, G - 0.05, M["deck"])
        rail_glass(pts[1], pts[2], G, M)
    for k in range(5):
        a = PI + (k + 0.5) * PI / 5; B.picnic(((Rr + 2.7) * math.cos(a), (Rr + 2.7) * math.sin(a), G), M["deck"], SN, rot=a + PI / 2)
    B.rack((Rr + 4, 4, 0), TIM, SN, rot=0.3)
    finalize(name, 2048, ao_dist=1.5)

def roundhouse():
    """Solitude's Roundhouse at the foot of Powderhorn II: a round two-storey lodge in cream walls round a central
    fireplace, a faceted maroon roof, a stone chimney through its crown, a deck on the downhill side.
    Photos: slcref/solitude/photos/roundhouse_1-2 (distant). OSM w974788887 (32 x 26 m)."""
    orig = lodge_mats
    globals()["lodge_mats"] = lambda: dict(orig(), maroon=textured("roof_maroon", "grey_roof_01", 2.0, (0.95, 0.42, 0.42), 0.8, "Y"), creamwall=flat("wall_cream", "#e1d6bd", 0.9, grain=0.06))
    try: _round_lodge("roundhouse", 10, 12.0, 1.0, 7.0, "creamwall", "maroon", 4.6, True)
    finally: globals()["lodge_mats"] = orig

# ---------- Brighton ----------
def molly_greens():
    """Molly Green's at Brighton's base, beside Crest 6: three steep A-frames joined side by side, dark shingle
    roofs down to the snow, timber gable ends glazed and boarded, three storeys inside, a stair and deck in front.
    Photos: slcref/brighton/photos/molly_greens_1-2. OSM w609870422 (27 x 21 m)."""
    new_col("molly_greens"); M = lodge_mats(); B.anchor(M)
    SN, TIM = M["sn"], M["tim"]; W, D, H = 8.5, 18.0, 13.0
    a = math.atan2(H, W / 2); MR = dict(M); MR["roof"] = M["roof"]
    for i, x in enumerate((-W - 0.2, 0.0, W + 0.2)):
        h = H - (1.5 if i != 1 else 0); f = Frame((x, 0, 0))
        B.gable_roof(f, W, -D / 2 - 0.8, D / 2 + 0.8, 0.6, h - 0.6, 0.5, MR, thick=0.35, st=0.55, ice=8)
        for sy, fr in ((-1, Frame((x, -D / 2, 0))), (1, Frame((x, D / 2, 0), PI))):
            B.gable_wall(fr, W, 0, 0.6, h - 0.6, M["brown"], 0.25)
            fr.prism([(-W / 2 + 1.4, -0.05, 2.0), (W / 2 - 1.4, -0.05, 2.0), (0, -0.05, h - 2.4)], 0.05, M["win"], kind="lit")
            for k in range(-2, 3): hh = (h - 2.4 - 2.0) * (1 - abs(k) / 2.6); fr.box((0.14, 0.16, hh), (k * 0.85, -0.1, 2.0 + hh / 2), TIM)
            for z in (5.2, 8.6): fr.box((W * (1 - (z - 0.6) / (h - 0.6)) - 1.0, 0.18, 0.18), (0, -0.1, z), TIM)
            fr.box((W, 0.25, 0.25), (0, -0.12, 2.0), TIM)
        box((W - 0.6, D - 0.4, 1.8), (x, 0, 0.9), M["st"], bevel=0.04)
    B.door(Frame((0, -D / 2 - 0.05, 0)), 0, 0.2, 2.0, 2.4, M, double=True, glazed=True)
    box((7.0, 0.14, 0.8), (0, -D / 2 - 0.4, 2.9), M["sign"]); text("MOLLY GREEN'S", 0.36, (0, -D / 2 - 0.48, 2.9), M["cream"], extrude=0.01)
    deck(-W * 1.5, W * 1.5, -D / 2 - 0.4, 3.0, 1.0, M, rail="timber", tables=3, umbrellas=0, stairs_x=W * 1.5 - 1.5)
    B.drifts([(0, D / 2 + 0.8, 3 * W, 1.6)], M, h=0.9)
    finalize("molly_greens", 1024, ao_dist=1.2)

def snake_creek_lodge():
    """Brighton's Snake Creek Lodge (the Sidewinder, 2024): a single storey built round shipping containers, black
    metal siding, two tilted shed roofs over cedar soffits, big windows, a rusted-steel fascia with its name,
    a patio with tables. Photos: slcref/brighton/photos/snake_creek_lodge_1-4. OSM w1304564943 (38 x 20 m)."""
    new_col("snake_creek_lodge"); M = concrete_mats(lodge_mats()); B.anchor(M)
    SN = M["sn"]; BLK = flat("black_metal", "#26292c", 0.5, grain=0.03); RUST = flat("rust_steel", "#7a4a2e", 0.7, grain=0.12)
    for x0, x1, h, tilt in ((-17, -2, 4.4, 0.12), (-1, 17, 5.6, -0.1)):
        cx, w = (x0 + x1) / 2, x1 - x0
        box((w, 14.0, h), (cx, 0, h / 2), BLK)
        for k in range(int(w / 0.4)):
            for y in (-7.02, 7.02): box((0.05, 0.04, h), (x0 + 0.2 + k * 0.4, y, h / 2), M["seam"])
        f = Frame((cx, -7.03, 0))
        for k in range(int(w / 4.5)): win(f, -w / 2 + 2.3 + k * 4.5, 0.7, 2.6, h - 1.6, M, cols=2, fr="mull", snow=False)
        box((w + 2.0, 17.0, 0.4), (cx, -0.5, h + 0.6), BLK, rot=(tilt, 0, 0))
        box((w + 1.8, 16.8, 0.06), (cx, -0.5, h + 0.38), M["honey"], rot=(tilt, 0, 0))
        B.pad((w + 1.4, 16.4, 0.6), (cx, -0.5, h + 1.05), SN)
    box((14.0, 0.2, 0.9), (8.0, -8.9, 5.8), RUST); text("SNAKE CREEK LODGE", 0.42, (8.0, -9.02, 5.8), M["cream"], extrude=0.01)
    box((36, 9, 0.2), (0, -12.0, 0.1), M["conc"])
    for i, x in enumerate((-12, -6, 0, 6, 12)): B.picnic((x, -12.0, 0.2), M["deck"], SN, rot=0.05 * i)
    B.drifts([(0, 7.8, 36, 1.6)], M, h=0.9)
    finalize("snake_creek_lodge", 2048, ao_dist=1.3)

MODELS = {"village_block_solitude": village_block_solitude, "village_block_inn": village_block_inn, "solitude_clock_tower": solitude_clock_tower, "roundhouse": roundhouse, "molly_greens": molly_greens, "snake_creek_lodge": snake_creek_lodge, "cliff_lodge": cliff_lodge, "the_summit": the_summit, "the_nest": the_nest, "alfs": alfs, "watson_shelter": watson_shelter, "albion_lodge": albion_lodge, "goldminers_daughter": goldminers_daughter, "earls_lodge": earls_lodge, "needles_lodge": needles_lodge, "john_paul_lodge": john_paul_lodge, "snow_park_lodge": snow_park_lodge, "silver_lake_lodge": silver_lake_lodge, "empire_canyon_lodge": empire_canyon_lodge, "tram_dock_bottom": tram_dock_bottom, "tram_dock_top": tram_dock_top, "tram_cabin": tram_cabin, "tower_tram": tower_tram}
