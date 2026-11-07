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
    LF.loft([ring(zg1), ring(top - 0.1), LF.rrect(hx - 0.12, hy - 0.12, 0.45, top, seg=5)], P, "paint")
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
    R, yc, ztop = 34.0, -1.0, 16.4
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
        legs = [((xc - s * 1.0, -5.5), (xc, -4.0)), ((xc + s * 2.6, -5.5), (xc + s * 0.8, -3.0)), ((xc - s * 1.0, 3.5), (xc, 4.5)), ((xc + s * 2.6, 3.0), (xc + s * 0.8, 6.0)), ((xc + s * 2.6, 9.8), (xc + s * 0.8, 9.5))]
        for (fx, fy), (tx, ty) in legs:
            LF.rod((fx, fy, zp), (tx, ty, arc(ty) + 0.1), 0.2, STL, verts=8)
        for ya, yb in ((-4.0, 4.5), (4.5, 9.5)):
            LF.rod((xc + s * 1.6, ya, zp + 2.0), (xc + s * 0.9, yb, arc(yb) - 0.5), 0.1, STL, verts=6)
            LF.rod((xc + s * 1.6, yb, zp + 2.0), (xc + s * 0.9, ya, arc(ya) - 0.5), 0.1, STL, verts=6)
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
    for sx in (-1, 1):
        box((2.0, D, H), (sx * (W / 2 - 1.0), 0, H / 2), CON)
        for k in range(1, int(H / 1.2)): box((2.04, D + 0.04, 0.04), (sx * (W / 2 - 1.0), 0, k * 1.2), FL)  # board-form lines
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
        wx = s * (W / 2 + 7.0)
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
    B.drifts([(-W / 2 - 13.5, 2, 1.4, 18), (W / 2 + 13.5, 2, 1.4, 18)], M, h=0.9)
    text("SNOWBIRD", 1.1, (0, -D / 2 - 0.52, H - 1.8), M["cream"], extrude=0.02)
    finalize("tram_dock_bottom", 2048, ao_dist=1.5)

MODELS = {"tram_dock_bottom": tram_dock_bottom, "tram_dock_top": tram_dock_top, "tram_cabin": tram_cabin, "tower_tram": tower_tram}
