"""Props: furniture, snowmaking, lights, padding, fences and the vehicles on the hill.
Uses the building parts in buildings.py (Frame, pad, ring, mats, picnic, rack, bench, logbench)."""
import math
from mathutils import Vector
from lib import *
import lib
from buildings import Frame, PI, pad, ring, prism, lathe, mound, drift, mats, anchor, picnic, rack, bench, logbench

def pmats():
    M = mats()
    M.update(red=flat("cabred", "#9b3a30", 0.45, 0.1, grain=0.03), galv=flat("galv", "#9aa0a6", 0.4, 0.7, grain=0.04),
             white=flat("housing", "#dcdad4", 0.4, 0.2, grain=0.02), orange=flat("safety", "#c8622e", 0.75, grain=0.05),
             rubber=flat("rubber", "#26282b", 0.85, grain=0.03), silver=flat("silver", "#b8bec6", 0.3, 0.8, grain=0),
             tint=glass("tint", "#2a3542", 0.5), plate=textured("steelplate", "metal_plate", 1.0, (0.8, 0.8, 0.84), 0.5, "X"),
             concrete=flat("concrete", "#9c9a96", 0.9, grain=0.1), blue=flat("sledblue", "#36506e", 0.35, 0.15, grain=0.02))
    return M

def wheel(f, at, r, w, M, hub=0.5):
    """A tyre along local X with a silver hub on its outer face."""
    x, y, z = at; s = 1 if x >= 0 else -1
    f.cyl(r, w, at, M["rubber"], rot=(0, PI / 2, 0), verts=18, bevel=0.03)
    f.cyl(r * hub, 0.04, (x + s * w / 2, y, z), M["silver"], rot=(0, PI / 2, 0), verts=12)
    f.cyl(r * 0.18, 0.08, (x + s * w / 2, y, z), M["steel"], rot=(0, PI / 2, 0), verts=8)

# ---------- furniture ----------
def picnic_table():
    new_col("picnic_table"); M = pmats(); anchor(M)
    picnic((0, 0, 0), M["deck"], M["sn"])
    finalize("picnic_table", 512, ao_dist=0.5)

def bench_():
    new_col("bench"); M = pmats(); anchor(M)
    bench((0, 0, 0), M)
    drift((2.4, 1.1, 0.16), (0.1, 0.15, -0.02), M["sn"], lumps=0.04)
    finalize("bench", 512, ao_dist=0.4)

def board_rack():
    new_col("board_rack"); M = pmats(); anchor(M)
    rack((0, 0, 0), M["tim"], M["sn"], rot=PI / 2)
    for s in (-1, 1): drift((0.9, 1.0, 0.3), (s * 1.3, 0.1, 0.0), M["sn"])
    finalize("board_rack", 512, ao_dist=0.5)

def fire_pit():
    """A ring of stones round a teepee of logs, embers glowing; log benches round it, snow beyond."""
    new_col("fire_pit"); M = pmats(); anchor(M)
    ST, SN = M["st"], M["sn"]
    for course, (n, r, h, z) in enumerate(((12, 0.78, 0.26, 0.13), (11, 0.74, 0.2, 0.36))):
        for i in range(n):
            a = (i + 0.5 * course) / n * 2 * PI
            box((0.36, 0.26, h), (r * math.cos(a), r * math.sin(a), z), ST, rot=(0, 0.06 * (i % 3 - 1), a), bevel=0.06, seg=1)
    cyl(0.62, 0.1, (0, 0, 0.05), flat("ash", "#2a2624", 0.95, grain=0.15), verts=16)
    cyl(0.42, 0.06, (0, 0, 0.12), M["lamp"], verts=12, kind="lamp")
    for i in range(5):
        a = i / 5 * 2 * PI
        cyl(0.07, 0.95, (0.17 * math.cos(a), 0.17 * math.sin(a), 0.42), M["log"], rot=(0.42 * math.sin(a), -0.42 * math.cos(a), 0), verts=7)
    for i in range(4):
        a = i / 4 * 2 * PI + 0.4
        box((0.12, 0.12, 0.08), (0.3 * math.cos(a), 0.3 * math.sin(a), 0.17), M["lamp"], rot=(0, 0, a), kind="lamp")
    ring(1.15, 0.22, (0, 0, 0.05), SN, seg=24, mseg=6)
    for i in range(3):
        a = i / 3 * 2 * PI + PI / 2
        logbench((2.1 * math.cos(a), 2.1 * math.sin(a), 0), M, rot=a + PI / 2, L=1.8)
    finalize("fire_pit", 512, ao_dist=0.6)

# ---------- snowmaking ----------
def snow_gun():
    """A fan snow gun (after the TechnoAlpin TF10 and Demaclenko Titan): a light grey fan housing with a
    nozzle ring at the mouth and a guard grille at the back, tilted up on a yoke and slewing ring, on a short
    tower on a two-wheeled carriage with a drawbar; hose and cable to a hydrant."""
    new_col("snow_gun"); M = pmats(); anchor(M)
    STL, WH, RED, GAL = M["steel"], M["white"], M["red"], M["galv"]
    f = Frame()
    # The carriage: two beams, an axle, two wheels, a drawbar to the front with a foot, a cabinet.
    for s in (-1, 1): box((0.12, 2.2, 0.16), (s * 0.45, 0.2, 0.62), GAL)
    box((1.3, 0.14, 0.14), (0, 0.6, 0.45), GAL)
    for s in (-1, 1): wheel(f, (s * 0.85, 0.6, 0.45), 0.45, 0.24, M)
    for s in (-1, 1): box((0.08, 1.12, 0.08), (s * 0.225, -1.4, 0.6), GAL, rot=(0, 0, -s * 0.42))
    cyl(0.07, 0.2, (0, -1.95, 0.6), GAL, rot=(PI / 2, 0, 0), verts=10)
    cyl(0.035, 0.56, (0.12, -1.55, 0.33), GAL, verts=8); cyl(0.1, 0.05, (0.12, -1.55, 0.04), GAL, verts=10)
    box((0.95, 0.6, 0.12), (0, 0.2, 0.75), GAL)
    box((0.5, 0.36, 0.6), (0, 1.05, 1.0), WH, bevel=0.03)
    box((0.3, 0.02, 0.18), (0, 1.24, 1.1), M["win"], kind="lit")
    pad((0.48, 0.34, 0.08), (0, 1.05, 1.34), M["sn"])
    # The tower, the slewing ring and the yoke.
    cyl(0.16, 0.9, (0, 0.2, 1.25), GAL, verts=14)
    cyl(0.3, 0.14, (0, 0.2, 1.75), STL, verts=18)
    box((1.6, 0.35, 0.14), (0, 0.2, 1.88), GAL)
    for s in (-1, 1): box((0.1, 0.32, 0.75), (s * 0.75, 0.2, 2.22), GAL)
    # The fan housing, tilted up 22°, its mouth to the front.
    t = math.radians(22); ax = Vector((0, -math.cos(t), math.sin(t))); c = Vector((0, 0.2, 2.45)); rot = (PI / 2 - t, 0, 0)
    cyl(0.66, 1.5, c, WH, rot=rot, verts=28)
    for u, w in ((-0.05, 0.12), (0.45, 0.06)): cyl(0.675, w, c + ax * u, RED, rot=rot, verts=28)
    ring(0.66, 0.06, tuple(c + ax * 0.75), WH, kind="bake", seg=28, mseg=6, rot=rot)
    ring(0.6, 0.05, tuple(c + ax * 0.82), STL, kind="bake", seg=28, mseg=6, rot=rot)
    for i in range(12):
        a = i / 12 * 2 * PI; p = c + ax * 0.84 + Vector((math.cos(a) * 0.6, math.sin(a) * 0.6 * math.sin(t), math.sin(a) * 0.6 * math.cos(t)))
        cyl(0.03, 0.08, p, M["silver"], rot=rot, verts=6)
    cyl(0.62, 0.03, c + ax * 0.765, flat("fanhole", "#121416", 0.9, grain=0), rot=rot, verts=24)
    cyl(0.14, 0.2, c + ax * 0.8, STL, rot=rot, verts=12)
    for i in range(3):
        a = i / 3 * 2 * PI; box((0.5, 0.03, 0.1), c + ax * 0.79 + Vector((math.cos(a) * 0.3, math.sin(a) * 0.3 * math.sin(t), math.sin(a) * 0.3 * math.cos(t))), M["galv"], rot=(PI / 2 - t, a, 0))
    gb = c - ax * 0.76
    cyl(0.6, 0.03, gb, flat("fanhole", "#121416", 0.9, grain=0), rot=rot, verts=24)
    for rr in (0.25, 0.45, 0.62): ring(rr, 0.018, tuple(gb - ax * 0.03), STL, kind="bake", seg=24, mseg=4, rot=rot)
    for i in range(4):
        a = i / 4 * 2 * PI + PI / 4; box((1.25, 0.03, 0.03), gb - ax * 0.03, STL, rot=(PI / 2 - t, a, 0))
    for s in (-1, 1): cyl(0.1, 0.12, c + Vector((s * 0.7, 0, 0)), STL, rot=(0, PI / 2, 0), verts=12)
    # Snow on the top of the housing, the hose and cable to a hydrant pedestal behind.
    pad((0.6, 1.1, 0.12), c + Vector((0, 0, 0.66)), M["sn"], rot=(-t, 0, 0))
    curve_pipe([(0.15, 0.4, 1.2), (0.3, 1.3, 0.5), (0.4, 2.2, 0.06), (0.5, 3.0, 0.06)], 0.045, flat("hose", "#2b2f36", 0.7, grain=0))
    curve_pipe([(-0.15, 1.2, 0.8), (-0.3, 1.8, 0.1), (-0.4, 3.0, 0.05)], 0.025, flat("cable", "#3a3d42", 0.6, grain=0))
    box((0.4, 0.4, 0.9), (0.2, 3.2, 0.45), GAL, bevel=0.03); box((0.46, 0.46, 0.06), (0.2, 3.2, 0.92), GAL)
    cyl(0.1, 0.3, (0.2, 3.2, 1.05), RED, verts=10); pad((0.42, 0.42, 0.1), (0.2, 3.2, 0.98), M["sn"])
    for s in (-1, 1): drift((0.6, 1.0, 0.3), (s * 0.85, 0.6, 0.05), M["sn"])
    finalize("snow_gun", 512, ao_dist=0.6)

def snow_gun_pole():
    """A snow lance: a 9 m aluminium tube leaning down the slope from a hinged mount, its nozzle head at the
    top, a strut, the hose and cable to a hydrant at its foot."""
    new_col("snow_gun_pole"); M = pmats(); anchor(M)
    GAL, STL, SIL = M["galv"], M["steel"], M["silver"]
    cyl(0.4, 0.3, (0, 0, 0.1), M["concrete"], verts=12)
    box((0.3, 0.3, 0.35), (0, 0, 0.42), GAL)
    for s in (-1, 1): box((0.04, 0.3, 0.35), (s * 0.12, 0, 0.75), GAL)
    t = math.radians(24); ax = Vector((0, -math.sin(t), math.cos(t))); base = Vector((0, 0, 0.75)); L = 9.0
    rot = (t, 0, 0)
    cyl(0.07, L, base + ax * (L / 2), SIL, rot=rot, verts=12)
    cyl(0.1, 0.5, base + ax * 0.3, GAL, rot=rot, verts=12)
    cyl(0.12, 0.6, base + ax * (L - 0.1), M["red"], rot=rot, verts=12)
    for i in range(6):
        a = i / 6 * 2 * PI; p = base + ax * (L - 0.25) + Vector((math.cos(a) * 0.12, math.sin(a) * 0.12 * math.cos(t), -math.sin(a) * 0.12 * math.sin(t)))
        cyl(0.025, 0.12, p, STL, rot=(t + PI / 2 * 0.6, 0, a), verts=6)
    cyl(0.09, 0.15, base + ax * (L + 0.27), STL, rot=rot, verts=12, r2=0.03)
    # A strut from the ground to the tube, a hose and cable down to the hydrant.
    p0, p1 = Vector((0, 1.4, 0.05)), base + ax * 2.6; d = p1 - p0
    box((0.06, 0.06, d.length), (p0 + p1) / 2, GAL, rot=(-math.atan2(d.y, d.z), 0, 0))
    cyl(0.25, 0.1, (0, 1.4, 0.05), M["concrete"], verts=10)
    box((0.4, 0.4, 0.9), (0.7, 0.3, 0.45), GAL, bevel=0.03); cyl(0.1, 0.3, (0.7, 0.3, 1.05), M["red"], verts=10)
    curve_pipe([(0.55, 0.3, 0.3), (0.3, 0.3, 0.12), (0.05, 0.05, 0.5)], 0.04, flat("hose", "#2b2f36", 0.7, grain=0))
    curve_pipe([tuple(base + ax * 0.5 + Vector((0.08, 0, 0))), tuple(base + ax * 4 + Vector((0.08, 0, 0))), tuple(base + ax * 8.6 + Vector((0.08, 0, 0)))], 0.018, flat("cable", "#3a3d42", 0.6, grain=0))
    pad((0.42, 0.42, 0.1), (0.7, 0.3, 0.95), M["sn"])
    mound(0.8, 0.3, (0, 0.1, 0), M["sn"])
    finalize("snow_gun_pole", 512, ao_dist=0.6)

# ---------- lights, padding, fences ----------
def slope_light():
    """A night-skiing mast: a 12 m galvanised pole on a concrete footing, a cross-arm with three floodlights
    aimed down the slope (local −Y), a cabinet at the foot."""
    new_col("slope_light"); M = pmats(); anchor(M)
    GAL, STL = M["galv"], M["steel"]; H = 12.0
    cyl(0.45, 0.4, (0, 0, 0.15), M["concrete"], verts=14)
    cyl(0.3, 0.06, (0, 0, 0.37), GAL, verts=12)
    cyl(0.16, H, (0, 0, H / 2 + 0.35), GAL, verts=12, r2=0.09)
    for i in range(int((H - 3) / 0.5)): box((0.3, 0.04, 0.03), (0, 0.13 - 0.0, 3.0 + i * 0.5), GAL)  # climbing rungs on the back
    box((0.5, 0.3, 0.7), (0, 0.38, 1.2), GAL, bevel=0.02); pad((0.48, 0.3, 0.08), (0, 0.38, 1.6), M["sn"])
    box((2.6, 0.12, 0.12), (0, 0, H + 0.2), GAL); cyl(0.11, 0.25, (0, 0, H + 0.45), GAL, verts=10)
    for x in (-1.1, 0, 1.1):
        f = Frame((x, -0.15, H + 0.2))
        f.box((0.06, 0.25, 0.3), (0, 0, -0.1), GAL)
        tilt = (0.65, 0, 0)
        f.box((0.62, 0.22, 0.5), (0, -0.25, -0.3), STL, rot=tilt, bevel=0.03)
        f.box((0.52, 0.03, 0.4), (0, -0.37, -0.36), M["lamp"], rot=tilt, kind="lamp")
        f.box((0.64, 0.2, 0.06), (0, -0.4, -0.02), STL, rot=tilt)
        f.pad((0.56, 0.24, 0.07), (0, -0.21, 0.0), M["sn"], rot=tilt)
    pad((2.5, 0.12, 0.06), (0, 0, H + 0.29), M["sn"])
    mound(0.85, 0.32, (0, 0, 0), M["sn"])
    finalize("slope_light", 512, ao_dist=0.6)

def pole_pad():
    """The orange padding wrapped round a lift tower's foot: two plump cushions held by black straps, a
    velcro flap, a black top collar; origin at the ground."""
    new_col("pole_pad"); M = pmats(); anchor(M)
    OR, BL = M["orange"], flat("strapblack", "#1f2124", 0.7, grain=0)
    r, H = 0.62, 2.2
    for k in range(2): cyl(r, H / 2 - 0.02, (0, 0, H / 4 + k * H / 2), OR, verts=28, bevel=0.1)
    for z in (0.3, 0.9, 1.4, 2.0): cyl(r + 0.02, 0.06, (0, 0, z), BL, verts=28)
    box((0.14, 0.05, H - 0.1), (0, -r - 0.01, H / 2), flat("flap", "#b8582a", 0.7, grain=0.05))
    cyl(r - 0.06, 0.04, (0, 0, H + 0.0), BL, verts=28)
    ring(r - 0.12, 0.08, (0, 0, H + 0.03), M["sn"], seg=24, mseg=6)
    box((0.5, 0.03, 0.22), (0, -r - 0.015, 1.15), M["cream"])
    text("CAUTION", 0.09, (0, -r - 0.04, 1.15), flat("paint_dark", "#2b2f36", 0.6, grain=0), extrude=0.005)
    mound(1.0, 0.3, (0, 0, 0), M["sn"])
    finalize("pole_pad", 512, ao_dist=0.5)

def safety_fence():
    """A 10 m run of orange plastic net on fibreglass poles, sagging a little between them, snow at its foot."""
    new_col("safety_fence"); M = pmats(); anchor(M)
    OR, POLE = M["orange"], flat("pole", "#2b2f36", 0.5, 0.2, grain=0)
    L, H, z0 = 10.0, 1.25, 0.12
    posts = [-L / 2 + i * L / 4 for i in range(5)]
    for x in posts:
        cyl(0.025, 1.7, (x, 0.02, 0.75), POLE, verts=8); cyl(0.03, 0.1, (x, 0.02, 1.62), OR, verts=8)
    top = lambda x: z0 + H - 0.12 * math.sin(((x + L / 2) % (L / 4)) / (L / 4) * PI)
    n = 10
    for k in range(n + 1):  # the horizontal strands, each sagging a little less towards the bottom
        z = z0 + k * H / n
        for i in range(4):
            xa, xb = posts[i], posts[i + 1]; sag = 0.12 * k / n
            for j in range(4):  # the strand in four straight runs following the sag
                u0, u1 = j / 4, (j + 1) / 4; zz = lambda u: z - sag * math.sin(u * PI)
                p0, p1 = Vector((xa + (xb - xa) * u0, 0, zz(u0))), Vector((xa + (xb - xa) * u1, 0, zz(u1))); d = p1 - p0
                box((d.length + 0.01, 0.008, 0.03 if k == n else 0.02), (p0 + p1) / 2, OR, rot=(0, -math.atan2(d.z, d.x), 0))
    for i in range(int(L / 0.11) + 1):
        x = -L / 2 + i * 0.11; h = top(x) - z0
        box((0.02, 0.008, h), (x, 0, z0 + h / 2), OR)
    for x in posts: pad((0.08, 0.08, 0.05), (x, 0.02, 1.7), M["sn"])
    for i in range(4): drift((L / 4 + 0.4, 0.9 + 0.2 * (i % 2), 0.32), (-L / 2 + (i + 0.5) * L / 4, 0.08 - 0.06 * (i % 2), 0.02), M["sn"], rot=(0, 0, 0.03 * (i - 1.5)))
    finalize("safety_fence", 512, ao_dist=0.4)

# ---------- vehicles ----------
def snowcat():
    """A grooming snowcat after the PistenBully 600: a red cab and engine body on two wide rubber tracks
    with aluminium cleats, a twelve-way blade at the front, a tiller and its finisher comb at the back,
    work lights on the cab roof."""
    new_col("snowcat"); M = pmats(); anchor(M)
    RED, RUB, STL, SIL, GAL = M["red"], M["rubber"], M["steel"], M["silver"], M["galv"]
    f = Frame()
    # Tracks: road wheels, a raised drive sprocket at the back, belts with cleats over and under.
    TW, TL, tx = 1.25, 4.6, 1.55
    for s in (-1, 1):
        x = s * tx
        for y in (-1.6, -0.55, 0.5, 1.55): f.cyl(0.42, TW - 0.2, (x, y, 0.47), RUB, rot=(0, PI / 2, 0), verts=16); f.cyl(0.24, 0.04, (x + s * (TW / 2 - 0.08), y, 0.47), SIL, rot=(0, PI / 2, 0), verts=12)
        f.cyl(0.5, TW - 0.1, (x, 2.35, 0.75), STL, rot=(0, PI / 2, 0), verts=16); f.cyl(0.52, TW - 0.1, (x, -2.35, 0.6), RUB, rot=(0, PI / 2, 0), verts=16)
        f.box((TW, TL, 0.05), (x, 0, 0.025), RUB); f.box((TW, TL + 0.1, 0.05), (x, 0.0, 1.13), RUB, rot=(0.035, 0, 0))
        for i in range(19):
            y = -TL / 2 + 0.1 + i * (TL - 0.2) / 18
            f.box((TW + 0.02, 0.06, 0.05), (x, y, 1.16 + 0.035 * y), GAL)
        for i in range(17): f.box((TW + 0.02, 0.06, 0.05), (x, -TL / 2 + 0.2 + i * (TL - 0.4) / 16, 0.02), GAL)
        f.box((0.12, TL - 0.4, 0.5), (s * (tx - TW / 2 - 0.02), 0, 0.8), STL)
    # The body: chassis, engine body behind the cab, the cab with big glass, roof, lights, mirrors.
    f.box((2.0, 5.0, 0.4), (0, 0, 1.2), STL)
    f.box((2.5, 2.4, 1.05), (0, 1.35, 1.9), RED, bevel=0.08)
    for i in range(6): f.box((0.04, 1.2, 0.5), (1.26, 0.9 + i * 0.002, 1.9), STL) if i == 0 else None
    for i in range(7): f.box((2.3, 0.05, 0.03), (0, 0.5 + i * 0.12, 2.43), STL)
    f.box((2.5, 1.5, 0.75), (0, -1.15, 1.75), RED, bevel=0.08)
    cab = (2.3, 1.9, 1.25); cz = 2.12 + cab[2] / 2; cy = -0.65
    f.box((cab[0], cab[1], cab[2]), (0, cy, cz), M["tint"], kind="glass")
    for sx in (-1, 1):
        for sy in (-1, 1): f.box((0.1, 0.1, cab[2]), (sx * (cab[0] / 2 - 0.02), cy + sy * (cab[1] / 2 - 0.02), cz), RED)
    f.box((0.08, 0.1, cab[2]), (0, cy - cab[1] / 2 + 0.01, cz), RED)
    f.box((cab[0] + 0.04, cab[1] + 0.04, 0.12), (0, cy, 2.12 + 0.06), RED)
    f.box((cab[0] + 0.25, cab[1] + 0.3, 0.16), (0, cy, cz + cab[2] / 2 + 0.06), RED, bevel=0.06)
    f.box((cab[0] - 0.3, cab[1] - 0.4, 0.5), (0, cy + 0.05, 2.0 + 0.6), M["rubber"])
    f.box((1.9, 0.18, 0.12), (0, cy - cab[1] / 2 - 0.05, cz + cab[2] / 2 + 0.18), STL)
    for x in (-0.75, -0.3, 0.3, 0.75):
        f.box((0.24, 0.14, 0.16), (x, cy - cab[1] / 2 - 0.1, cz + cab[2] / 2 + 0.27), STL, bevel=0.02)
        f.box((0.18, 0.02, 0.1), (x, cy - cab[1] / 2 - 0.18, cz + cab[2] / 2 + 0.27), M["lamp"], kind="lamp")
    f.cyl(0.1, 0.16, (0.8, cy + 0.6, cz + cab[2] / 2 + 0.22), flat("beacon", "#c9a65a", 0.3, grain=0), verts=10)
    for s in (-1, 1):
        f.box((0.05, 0.4, 0.05), (s * (cab[0] / 2 + 0.2), cy - 0.8, cz + 0.4), STL)
        f.box((0.05, 0.18, 0.28), (s * (cab[0] / 2 + 0.42), cy - 0.95, cz + 0.3), STL, bevel=0.02)
        f.box((0.24, 0.05, 0.12), (s * 0.85, -1.92, 1.95), M["lamp"], kind="lamp")
        f.box((0.06, 0.9, 0.06), (s * 1.0, cy - 0.2, 2.15), STL)
    f.box((0.7, 0.04, 0.9), (1.17, cy + 0.15, cz - 0.05), RED)
    f.cyl(0.07, 0.7, (-0.9, 2.2, 2.75), STL, verts=8); f.cyl(0.09, 0.12, (-0.9, 2.2, 3.1), STL, verts=8)
    for s in (-1, 1):  # steps up to the cab doors, grab handles, louvres on the engine body, a roof rail
        for k in range(2): f.box((0.3, 0.45, 0.04), (s * 1.42, cy + 0.1, 1.45 + k * 0.32), GAL)
        f.box((0.04, 0.04, 0.8), (s * 1.2, cy + 0.75, 2.6), GAL)
        for k in range(5): f.box((0.03, 1.4, 0.06), (s * 1.26, 1.4, 1.7 + k * 0.1), STL)
        f.box((0.05, 1.5, 0.05), (s * 1.05, cy, cz + cab[2] / 2 + 0.3), GAL)
    f.box((0.5, 0.3, 0.25), (0, 2.65, 1.25), STL)
    # The blade on its push frame and rams.
    by, BLD = -3.2, flat("bladesteel", "#3a3f45", 0.45, 0.5, grain=0.04)
    for s in (-1, 1):
        f.box((0.14, 1.3, 0.16), (s * 0.85, -2.55, 0.62), STL, rot=(-0.12, 0, 0))
        f.cyl(0.07, 1.0, (s * 0.45, -2.5, 1.12), SIL, rot=(PI / 2 - 0.45, 0, 0), verts=8)
        f.cyl(0.1, 0.5, (s * 0.45, -2.2, 1.32), STL, rot=(PI / 2 - 0.45, 0, 0), verts=8)
    f.box((1.9, 0.3, 0.5), (0, by + 0.3, 0.75), STL)
    for z, tl, d in ((0.3, -0.45, -0.1), (0.7, 0.0, 0.06), (1.08, 0.5, -0.06)):
        f.box((4.4, 0.08, 0.42), (0, by + d, z), BLD, rot=(tl, 0, 0))
    for k in range(5): f.box((0.06, 0.12, 1.05), (-2.0 + k, by + 0.1, 0.68), STL)
    for s in (-1, 1):
        a = 0.55; L = 0.95
        f.box((L, 0.08, 1.15), (s * (2.2 + L / 2 * math.cos(a)), by - 0.04 - L / 2 * math.sin(a), 0.68), BLD, rot=(0, 0, -s * a))
    f.box((4.4, 0.12, 0.06), (0, by - 0.16, 0.06), SIL)
    f.box((4.5, 0.14, 0.1), (0, by + 0.02, 1.3), STL)
    f.pad((4.3, 0.25, 0.1), (0, by + 0.05, 1.38), M["sn"])
    # The tiller: arms, a housing, the flexible finisher behind with its comb.
    ty = 3.6
    for s in (-1, 1): f.box((0.14, 1.4, 0.16), (s * 0.7, 2.9, 0.75), STL, rot=(0.25, 0, 0))
    f.cyl(0.38, 5.2, (0, ty, 0.5), RED, rot=(0, PI / 2, 0), verts=14)
    f.box((5.2, 0.5, 0.25), (0, ty - 0.2, 0.85), RED, bevel=0.04)
    for s in (-1, 1): f.box((0.1, 0.9, 0.9), (s * 2.65, ty, 0.5), STL)
    f.box((5.1, 1.2, 0.03), (0, ty + 0.85, 0.22), RUB, rot=(-0.3, 0, 0))
    for i in range(26): f.box((0.03, 0.12, 0.05), (-2.5 + i * 0.2, ty + 1.45, 0.04), RUB)
    f.pad((5.0, 0.4, 0.1), (0, ty - 0.2, 1.0), M["sn"])
    f.pad((2.2, 1.6, 0.12), (0, cy, cz + cab[2] / 2 + 0.16), M["sn"])
    f.pad((2.2, 1.9, 0.12), (0, 1.35, 2.45), M["sn"])
    finalize("snowcat", 1024, ao_dist=0.8)

def snowmobile():
    """A snowmobile: two skis on spindles, a blue hood and side panels, a tinted windscreen, handlebars,
    a long black seat, the tunnel and running boards over the track, a grab handle and tail light."""
    new_col("snowmobile"); M = pmats(); anchor(M)
    BL, RUB, STL, SIL = M["blue"], M["rubber"], M["steel"], M["silver"]
    f = Frame()
    for s in (-1, 1):  # skis with upturned tips, spindles and shocks
        x = s * 0.5
        f.box((0.14, 1.05, 0.04), (x, -1.35, 0.06), RUB, bevel=0.015)
        f.box((0.14, 0.32, 0.04), (x, -1.98, 0.15), RUB, rot=(-0.6, 0, 0), bevel=0.015)
        f.box((0.04, 0.5, 0.1), (x, -1.35, 0.12), SIL)
        f.box((0.06, 0.06, 0.45), (x, -1.3, 0.35), STL, rot=(0.25, 0, 0))
        f.cyl(0.035, 0.42, (x * 0.8, -1.2, 0.42), M["red"], verts=8, rot=(0.25, s * 0.4, 0))
        f.box((0.4, 0.04, 0.04), (x * 0.6, -1.25, 0.3), STL, rot=(0, 0, 0))
    # The hood, nose and belly pan, the windscreen, the headlight.
    f.box((1.0, 1.2, 0.4), (0, -0.9, 0.55), BL, bevel=0.15, subsurf=1)
    f.box((0.9, 0.6, 0.35), (0, -1.45, 0.42), BL, rot=(0.35, 0, 0), bevel=0.13, subsurf=1)
    f.box((1.05, 1.5, 0.12), (0, -0.7, 0.25), RUB, bevel=0.04)
    f.box((0.38, 0.04, 0.12), (0, -1.66, 0.55), M["lamp"], rot=(0.35, 0, 0), kind="lamp")
    f.box((0.82, 0.03, 0.55), (0, -0.52, 1.04), M["tint"], rot=(-0.5, 0, 0), kind="glass")
    f.box((0.8, 0.45, 0.2), (0, -0.4, 0.78), BL, bevel=0.06)
    f.pipe([(-0.42, -0.3, 0.98), (-0.3, -0.25, 0.92), (0, -0.25, 0.9), (0.3, -0.25, 0.92), (0.42, -0.3, 0.98)], 0.018, STL)
    for s in (-1, 1): f.cyl(0.028, 0.14, (s * 0.46, -0.3, 0.99), RUB, rot=(0, PI / 2, 0), verts=8)
    # The seat, the tunnel and running boards, the track beneath, the grab handle and tail light.
    f.box((0.46, 1.2, 0.18), (0, 0.45, 0.82), flat("seat", "#1f2124", 0.6, grain=0.04), bevel=0.07, subsurf=1)
    f.box((0.6, 1.6, 0.12), (0, 0.6, 0.66), BL, bevel=0.03)
    for s in (-1, 1):
        f.box((0.04, 1.8, 0.3), (s * 0.3, 0.6, 0.5), STL)
        f.box((0.18, 1.4, 0.03), (s * 0.4, 0.55, 0.36), SIL)
    f.box((0.5, 2.0, 0.28), (0, 0.65, 0.2), RUB, bevel=0.1)
    for i in range(14): f.box((0.52, 0.04, 0.03), (0, -0.25 + i * 0.13, 0.05), STL)
    f.pipe([(-0.25, 1.5, 0.7), (-0.25, 1.62, 0.75), (0.25, 1.62, 0.75), (0.25, 1.5, 0.7)], 0.02, STL)
    f.box((0.3, 0.03, 0.06), (0, 1.62, 0.62), M["lamp"], kind="lamp")
    f.box((0.62, 0.3, 0.04), (0, 1.62, 0.55), RUB, rot=(0.6, 0, 0))
    f.pad((0.4, 0.9, 0.06), (0, 0.5, 0.92), M["sn"])
    f.pad((0.8, 0.8, 0.06), (0, -0.9, 0.76), M["sn"])
    finalize("snowmobile", 512, ao_dist=0.4)

MODELS = {"picnic_table": picnic_table, "bench": bench_, "board_rack": board_rack, "fire_pit": fire_pit,
          "snow_gun": snow_gun, "snow_gun_pole": snow_gun_pole, "slope_light": slope_light, "pole_pad": pole_pad,
          "safety_fence": safety_fence, "snowcat": snowcat, "snowmobile": snowmobile}
