"""Lift stations: detachable terminals (bottom drive and top return), a fixed-grip bullwheel terminal and a
gondola station. The rope runs along -Y (the way up); for every terminal the rope's line and height are
given in its docstring and in glb/stations.json ("rope": [half gauge, height]) so the game can join the line.

Kinds the game uses here: the hood (material `paint_hood`) is kind `paint`, recoloured per resort; the lift
name board is kind `flat` (material `name_board`) with its own 0..1 UVs, for the game to paint the name on."""
import math
import bmesh
from mathutils import Vector
from lib import *
import lib

# ---------- shared parts (signs.py imports these too) ----------
def _obj(bm, mat, kind, name="part", smooth=None):
    if smooth is not None:
        sharp = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(smooth)]
        bmesh.ops.split_edges(bm, edges=sharp)
        for f in bm.faces: f.smooth = True
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    return lib._link(o, mat, kind)

def prism(pts, z0, z1, mat, kind="bake", bevel=0.0, seg=3, loc=(0, 0, 0), rot=(0, 0, 0), smooth=35, uv=None):
    """An outline (x, y) extruded from z0 to z1, its top edges rounded by bevel. With rot=(pi/2, 0, a) an
    outline drawn as (x, height) becomes an upright board facing -Y, z0..z1 its thickness towards the back."""
    bm = bmesh.new()
    vb = [bm.verts.new((x, y, z0)) for x, y in pts]; vt = [bm.verts.new((x, y, z1)) for x, y in pts]
    bm.faces.new(vb[::-1]); top = bm.faces.new(vt)
    for i in range(len(pts)):
        j = (i + 1) % len(pts); bm.faces.new((vb[i], vb[j], vt[j], vt[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if bevel: bmesh.ops.bevel(bm, geom=list(top.edges) + list(top.verts), offset=bevel, segments=seg, affect="EDGES", profile=0.5, clamp_overlap=True)
    o = _obj(bm, mat, kind, "prism", smooth)
    o.location = loc; o.rotation_euler = rot; return o

def face(pts, mat, kind="paint", loc=(0, 0, 0), rot=(math.pi / 2, 0, 0), uv=(0, 0, 1, 1)):
    """A flat face with UVs 0..1 across its outline (or the given rect of the atlas): a blank the game paints.
    Drawn as (x, height); with the default rot it faces -Y."""
    bm = bmesh.new(); f = bm.faces.new([bm.verts.new((x, y, 0)) for x, y in pts])
    f.normal_update()
    if f.normal.z < 0: f.normal_flip()
    lay = bm.loops.layers.uv.new("UVMap")
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]; x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    for lp in f.loops:
        p = lp.vert.co; lp[lay].uv = (uv[0] + (p.x - x0) / (x1 - x0) * (uv[2] - uv[0]), uv[1] + (p.y - y0) / (y1 - y0) * (uv[3] - uv[1]))
    o = _obj(bm, mat, kind, "face"); o.location = loc; o.rotation_euler = rot; return o

def rod(p0, p1, r, mat, verts=8, kind="bake", r2=None):
    p0, p1 = Vector(p0), Vector(p1); v = p1 - p0
    return cyl(r, v.length, (p0 + p1) / 2, mat, rot=v.to_track_quat("Z", "Y").to_euler(), verts=verts, kind=kind, r2=r2)

def sag(p0, p1, r, mat, drop, n=5, verts=6, kind="bake"):
    """A rope hanging between two points."""
    p0, p1 = Vector(p0), Vector(p1)
    pts = [p0.lerp(p1, i / n) - Vector((0, 0, drop * 4 * (i / n) * (1 - i / n))) for i in range(n + 1)]
    for a, b in zip(pts, pts[1:]): rod(a, b, r, mat, verts, kind)
    return pts

def torus(R, r, loc, mat, seg=48, rseg=8, zscale=1.0, kind="bake"):
    bm = bmesh.new(); rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg; c, s = math.cos(a), math.sin(a)
        rings.append([bm.verts.new(((R + r * math.cos(b)) * c, (R + r * math.cos(b)) * s, r * math.sin(b) * zscale)) for b in (2 * math.pi * j / rseg for j in range(rseg))])
    for i in range(seg):
        A, B = rings[i], rings[(i + 1) % seg]
        for j in range(rseg): k = (j + 1) % rseg; bm.faces.new((A[j], B[j], B[k], A[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    o = _obj(bm, mat, kind, "torus", smooth=80); o.location = loc; return o

def railing(p0, p1, z, M, posts=None, h=1.05, snowcap=True, mid=True):
    """A galvanised pipe railing from p0 to p1 (x, y) on a floor at z."""
    p0, p1 = Vector((*p0, z)), Vector((*p1, z)); L = (p1 - p0).length
    n = posts or max(2, int(L / 1.4) + 1)
    for i in range(n): p = p0.lerp(p1, i / (n - 1)); rod(p, p + Vector((0, 0, h)), 0.03, M["galv"], 8)
    rod(p0 + Vector((0, 0, h)), p1 + Vector((0, 0, h)), 0.035, M["galv"], 8)
    if mid: rod(p0 + Vector((0, 0, h * 0.5)), p1 + Vector((0, 0, h * 0.5)), 0.022, M["galv"], 6)
    if snowcap:
        d = p1 - p0; a = math.atan2(d.y, d.x)
        cap((L, 0.1, 0.07), (p0 + p1) / 2 + Vector((0, 0, h + 0.05)), M["snow"], rot=(0, 0, a))

def cap(size, loc, mat, rot=(0, 0, 0)):
    """A small cap of snow (rails, posts, sills, sign tops): a rounded box, cheap enough to use by the dozen."""
    return box(size, loc, mat, rot, bevel=min(size) * 0.45, seg=2, kind="snow")

def anchor(mat):
    """lib.join keeps the first baked part's transform for the joined body, and the textures are laid on in
    that object's space: start every model with this unscaled speck so they tile in true metres."""
    cyl(0.01, 0.01, (0, 0, -0.6), mat, verts=3)

def mats():
    return {
        "paint": flat("paint_hood", "#2f3439", 0.4, 0.2, grain=0),
        "steel": flat("steel", "#5d6268", 0.55, 0.15, grain=0.04), "dark": flat("dark", "#2a2d31", 0.5, 0.1, grain=0.03),
        "galv": flat("galv", "#a5aaaf", 0.4, 0.2, grain=0.05), "trim": flat("trim", "#c3c7cb", 0.35, 0.2, grain=0.02),
        "conc": flat("concrete", "#aca79f", 0.92, grain=0.12), "rubber": flat("rubber", "#26282b", 0.85, grain=0.04),
        "navy": flat("navy", "#36506e", 0.7, grain=0.05), "ochre": flat("ochre", "#c9a65a", 0.6, grain=0.04),
        "grate": flat("grate", "#4a4e53", 0.6, 0.1, grain=0.15), "lightgrey": flat("cabinet", "#c9c7c0", 0.5, grain=0.03),
        "snow": snow(), "stone": stone("stone"), "timber": wood("timber", "#4a3020", "#6e4a31", "Z"),
        "boards": wood("boards", "#4d3424", "#6b4a33", "Z"), "roof": wood("roof", "#3b2a22", "#54392b", "Y"),
        "deck": wood("deck", "#7a5638", "#a37a52", "X"),
        "metalroof": flat("metalroof", "#3a3d41", 0.5, 0.15, grain=0.03),
        "window": lit("window"), "lamp": lit("lamp", "#ffd9a0", 6.0, "#ffffff", window=False),
        "glass": glass("glass", "#9fb6c8", 0.25),
        "board": flat("name_board", "#ece2cd", 0.6, grain=0),
    }

def name_board(cx, y, z, w, h, M, face_dir=-1):
    """A cream board for the lift's name in a silver frame, snow on its top edge. face_dir -1 faces -Y."""
    rot = (math.pi / 2, 0, 0 if face_dir < 0 else math.pi)
    box((w + 0.16, 0.1, h + 0.16), (cx, y, z), M["trim"], bevel=0.02)
    face([(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)], M["board"], "flat", loc=(cx, y + face_dir * 0.052, z), rot=rot)
    for sx in (-1, 1):
        for sz in (-1, 1): cyl(0.025, 0.03, (cx + sx * (w / 2 + 0.04), y + face_dir * 0.06, z + sz * (h / 2 + 0.04)), M["galv"], rot=(math.pi / 2, 0, 0), verts=8)
    cap((w + 0.1, 0.16, 0.12), (cx, y, z + h / 2 + 0.12), M["snow"])

def lamp_post(x, y, M, h=5.5, arm=(0, -1)):
    cyl(0.18, 0.5, (x, y, 0.25), M["conc"], verts=12)
    cyl(0.07, h, (x, y, h / 2 + 0.5), M["steel"], verts=10, r2=0.05)
    ax, ay = arm; tip = (x + ax * 0.9, y + ay * 0.9, h + 0.4)
    rod((x, y, h + 0.3), tip, 0.04, M["steel"], 8)
    box((0.5, 0.5, 0.14), (tip[0], tip[1], tip[2] - 0.02), M["dark"], rot=(0, 0, math.atan2(ay, ax)), bevel=0.03)
    box((0.42, 0.42, 0.03), (tip[0], tip[1], tip[2] - 0.1), M["lamp"], rot=(0, 0, math.atan2(ay, ax)), kind="lamp")
    cap((0.55, 0.55, 0.12), (tip[0], tip[1], tip[2] + 0.1), M["snow"], rot=(0, 0, math.atan2(ay, ax)))

def hut(cx, cy, M, face="-x", W=2.6, D=2.3, H=2.6):
    """The operator's hut: a timber-clad booth on a concrete pad, windows on three sides looking at the
    load, a standing-seam roof under heavy snow, a door with steps at the back."""
    ang = {"-x": 0, "-y": math.pi / 2, "+x": math.pi, "+y": -math.pi / 2}[face]
    c, s = math.cos(ang), math.sin(ang)
    P = lambda dx, dy, dz: (cx + dx * c - dy * s, cy + dx * s + dy * c, dz)
    R = (0, 0, ang)
    B = lambda size, at, m, **k: box(size, P(*at), m, rot=(k.pop("rx", 0), k.pop("ry", 0), ang), **k)
    # Local frame: windows face -x, door at +x; width W along y, depth D along x.
    B((D + 0.5, W + 0.5, 0.3), (0, 0, 0.15), M["conc"], bevel=0.03)
    F = 0.3
    B((D, W, H), (0, 0, F + H / 2), M["boards"], bevel=0.02)
    for sx in (-1, 1):
        for sy in (-1, 1): B((0.14, 0.14, H), (sx * D / 2, sy * W / 2, F + H / 2), M["timber"])
    B((D + 0.06, W + 0.06, 0.14), (0, 0, F + 0.07), M["timber"])
    # Windows: front band, the two sides towards the front.
    wz = F + 1.0 + 0.6
    B((0.06, W - 0.4, 1.2), (-D / 2 - 0.02, 0, wz), M["window"], kind="lit")
    B((0.1, 0.08, 1.2), (-D / 2 - 0.05, 0, wz), M["timber"])
    B((0.22, W - 0.3, 0.1), (-D / 2 - 0.08, 0, wz - 0.65), M["timber"])
    cap((0.26, W - 0.3, 0.1), P(-D / 2 - 0.08, 0, wz - 0.55), M["snow"], rot=R)
    B((0.1, W - 0.3, 0.1), (-D / 2 - 0.04, 0, wz + 0.65), M["timber"])
    for sy in (-1, 1):
        B((D * 0.5, 0.06, 1.2), (-D * 0.15, sy * (W / 2 + 0.02), wz), M["window"], kind="lit")
        B((D * 0.55, 0.2, 0.1), (-D * 0.15, sy * (W / 2 + 0.07), wz - 0.65), M["timber"])
        B((D * 0.55, 0.1, 0.1), (-D * 0.15, sy * (W / 2 + 0.03), wz + 0.65), M["timber"])
    # Door at the back with a small window, steps and a handrail.
    B((0.06, 0.9, 2.0), (D / 2 + 0.02, -W * 0.18, F + 1.0), M["metalroof"], bevel=0.01)
    B((0.07, 0.4, 0.5), (D / 2 + 0.03, -W * 0.18, F + 1.45), M["window"], kind="lit")
    cyl(0.025, 0.12, P(D / 2 + 0.08, -W * 0.18 + 0.32, F + 1.0), M["galv"], rot=(0, math.pi / 2, ang), verts=8)
    for i in range(2): B((0.35, 1.1, 0.15), (D / 2 + 0.42 + i * 0.32, -W * 0.18, 0.22 - i * 0.12), M["conc"], bevel=0.02)
    rod(P(D / 2 + 0.95, -W * 0.18 + 0.62, 0), P(D / 2 + 0.95, -W * 0.18 + 0.62, 1.0), 0.025, M["galv"])
    rod(P(D / 2 + 0.95, -W * 0.18 + 0.62, 1.0), P(D / 2 + 0.2, -W * 0.18 + 0.62, 1.3), 0.025, M["galv"])
    rod(P(D / 2 + 0.2, -W * 0.18 + 0.62, 1.3), P(D / 2 + 0.2, -W * 0.18 + 0.62, F + 0.2), 0.025, M["galv"])
    box((0.18, 0.12, 0.12), P(D / 2 + 0.1, -W * 0.18, F + 2.25), M["lamp"], rot=R, kind="lamp")
    # A grey e-stop box and a phone on the side wall.
    B((0.12, 0.35, 0.45), (D * 0.2, W / 2 + 0.07, F + 1.3), M["lightgrey"], bevel=0.01)
    # Mono-pitch roof, falling to the back, seams, fascia, deep snow.
    pitch = 0.12; rz = F + H + 0.2
    B((D + 1.0, W + 0.8, 0.16), (0, 0, rz), M["metalroof"], ry=pitch, bevel=0.02)
    for k in range(7): B((D + 1.0, 0.04, 0.05), (0, -W / 2 - 0.3 + k * (W + 0.6) / 6, rz + 0.1), M["dark"], ry=pitch)
    B((0.08, W + 0.85, 0.3), (-D / 2 - 0.5, 0, rz + 0.06 + (D / 2 + 0.5) * math.sin(pitch)), M["timber"])
    slab((D + 0.95, W + 0.75, 0.5), P(0, 0, rz + 0.3), M["snow"], rot=(0, pitch, ang))
    cyl(0.2, W + 0.75, P(D / 2 + 0.45, 0, rz + 0.12 - (D / 2) * math.sin(pitch)), M["snow"], rot=(math.pi / 2, 0, ang), verts=10)
    # Snow banked at the walls.
    for sy in (-1, 1): blob((D + 0.6, 0.55, 0.45), P(0, sy * (W / 2 + 0.35), 0.18), M["snow"], rot=R, lumps=0.06)
    # A small antenna.
    rod(P(D * 0.3, W * 0.3, rz + 0.1), P(D * 0.3, W * 0.3, rz + 1.2), 0.012, M["galv"], 6)

def hood_outline(yf, yc, R, nose, flip=False, n=16):
    """The housing in plan: a flat nose at y=yf (half width `nose`), chamfered out to the full width,
    straight sides, a half round over the bullwheel centred at y=yc."""
    sgn = 1 if yc > yf else -1
    pts = [(-nose, yf), (nose, yf), (R, yf + sgn * 1.4)]
    for i in range(n + 1):
        a = math.pi * i / n; pts.append((R * math.cos(a), yc + sgn * R * math.sin(a)))
    pts.append((-R, yf + sgn * 1.4))
    return pts

def housing(yf, yc, z0, z1, M, R=4.4, nose=3.0, gauge=3.0):
    """The detachable terminal's hood over the bullwheel, the rails and tire conveyors under it, the bullwheel."""
    sgn = 1 if yc > yf else -1
    prism(hood_outline(yf, yc, R, nose), z0, z1, M["paint"], "paint", bevel=0.7, seg=4)
    prism(hood_outline(yf - sgn * 0.06, yc, R + 0.06, nose + 0.03), z0 - 0.14, z0 + 0.06, M["trim"], bevel=0.02, seg=1)  # base trim
    # Panel seams and louvre vents along the sides.
    ya, yb = yf + sgn * 1.6, yc
    L = abs(yb - ya); n = int(L / 2.2)
    for sx in (-1, 1):
        x = sx * (R + 0.012)
        for i in range(1, n + 1): box((0.03, 0.035, z1 - z0 - 0.85), (x, ya + sgn * i * L / (n + 1), (z0 + z1 - 0.7) / 2 + 0.05), M["dark"])
        box((0.03, L, 0.035), (x, (ya + yb) / 2, z1 - 0.72), M["dark"])
        for vy in (ya + sgn * L * 0.3, ya + sgn * L * 0.72):
            box((0.06, 1.6, 0.85), (x + sx * 0.01, vy, z0 + 0.75), M["dark"], bevel=0.02)
            for k in range(6): box((0.1, 1.5, 0.05), (x + sx * 0.04, vy, z0 + 0.42 + k * 0.13), M["steel"], rot=(0, sx * 0.6, 0))
    # A row of small round inspection windows near the nose, and a hatch on top.
    for sx in (-1, 1): cyl(0.22, 0.04, (sx * (R + 0.02), yf + sgn * 2.6, z0 + 1.0), M["trim"], rot=(0, math.pi / 2, 0), verts=16)
    machinery(yf, yc, z0, M, gauge)

def machinery(yf, yc, z0, M, gauge=3.0):
    """Under any detachable hood: rails, tire conveyors, the bullwheel and its shaft, lights over the load."""
    sgn = 1 if yc > yf else -1
    zr = z0 - 0.3
    for sx in (-1, 1):
        box((0.14, abs(yc - yf) - 0.4, 0.26), (sx * gauge, (yf + yc) / 2 + sgn * 0.2, zr), M["steel"])
        y = yf + sgn * 0.9
        while abs(y - yf) < abs(yc - yf) - 0.5:
            cyl(0.21, 0.11, (sx * (gauge - 0.3), y, zr - 0.08), M["rubber"], rot=(0, math.pi / 2, 0), verts=12)
            y += sgn * 0.85
        box((0.08, abs(yc - yf) - 0.6, 0.1), (sx * (gauge - 0.3), (yf + yc) / 2, zr + 0.12), M["dark"])
    zb = z0 - 0.25
    torus(gauge, 0.14, (0, yc, zb), M["steel"], seg=48, rseg=8, zscale=1.4)
    torus(gauge + 0.1, 0.06, (0, yc, zb), M["rubber"], seg=48, rseg=6)
    for k in range(10):
        a = 2 * math.pi * k / 10; rod((0.5 * math.cos(a), yc + 0.5 * math.sin(a), zb), ((gauge - 0.1) * math.cos(a), yc + (gauge - 0.1) * math.sin(a), zb), 0.07, M["steel"], 8)
    cyl(0.55, 0.45, (0, yc, zb), M["dark"], verts=20)
    cyl(0.25, z0 - zb + 0.1, (0, yc, (z0 + zb) / 2), M["dark"], verts=12)
    # Lights under the nose over the load or unload.
    for sx in (-1, 1): box((0.5, 0.25, 0.04), (sx * 1.6, yf + sgn * 1.2, z0 - 0.02), M["lamp"], kind="lamp")

def columns(ys, z_floor, z0, M, gauge=3.0):
    """The station frame: steel columns down the middle on concrete plinths, cross beams carrying the rails,
    braces, base plates with bolts."""
    for y in ys:
        box((1.7, 1.7, 0.4), (0, y, z_floor + 0.2), M["conc"], bevel=0.04)
        box((1.2, 1.2, 0.05), (0, y, z_floor + 0.425), M["steel"])
        for sx in (-1, 1):
            for sy in (-1, 1): cyl(0.04, 0.12, (sx * 0.48, y + sy * 0.48, z_floor + 0.48), M["galv"], verts=6)
        h = z0 - z_floor - 0.45
        box((0.8, 0.8, h), (0, y, z_floor + 0.45 + h / 2), M["steel"], bevel=0.03)
        box((2 * gauge + 0.6, 0.55, 0.45), (0, y, z0 - 0.55), M["steel"], bevel=0.02)
        for sx in (-1, 1): rod((sx * 0.4, y, z0 - 2.3), (sx * (gauge - 0.4), y, z0 - 0.75), 0.09, M["steel"], 8)
        box((0.84, 0.84, 0.12), (0, y, z0 - 2.0), M["dark"])

def ladder(x, y, z0, z1, M, along="x"):
    for s in (-1, 1):
        dx, dy = (s * 0.22, 0) if along == "x" else (0, s * 0.22)
        rod((x + dx, y + dy, z0), (x + dx, y + dy, z1), 0.025, M["galv"], 6)
    z = z0 + 0.3
    while z < z1:
        rod((x - (0.22 if along == "x" else 0), y - (0.22 if along == "y" else 0), z), (x + (0.22 if along == "x" else 0), y + (0.22 if along == "y" else 0), z), 0.016, M["galv"], 6); z += 0.3

def carpet(cx, y0, y1, M, z, w=3.0):
    """A loading carpet: a ribbed rubber belt in a steel frame, galvanised side covers, rounded ends."""
    L, cy = abs(y1 - y0), (y0 + y1) / 2
    box((w + 0.4, L + 0.3, 0.16), (cx, cy, z + 0.08), M["dark"], bevel=0.03)
    box((w, L, 0.03), (cx, cy, z + 0.17), M["rubber"])
    for k in range(int(w / 0.15)): box((0.025, L, 0.012), (cx - w / 2 + 0.075 + k * 0.15, cy, z + 0.19), M["rubber"])
    for sx in (-1, 1): box((0.18, L + 0.3, 0.07), (cx + sx * (w / 2 + 0.1), cy, z + 0.2), M["galv"], bevel=0.02)
    for y in (y0, y1): cyl(0.09, w, (cx, y, z + 0.1), M["rubber"], rot=(0, math.pi / 2, 0), verts=12)

def gates(x0, x1, y, z, M, n=6):
    """Loading gates: a post per gate with its paddle arm closed across the lane."""
    step = (x1 - x0) / n
    for i in range(n + 1):
        x = x0 + i * step
        box((0.1, 0.1, 0.95), (x, y, z + 0.475), M["galv"], bevel=0.01)
        box((0.16, 0.16, 0.16), (x, y, z + 1.02), M["dark"], bevel=0.02)
        if i < n: box((step - 0.14, 0.04, 0.05), (x + step / 2, y, z + 0.85), M["ochre"])
    box((x1 - x0 + 0.2, 0.2, 0.06), (x0 + (x1 - x0) / 2, y, z + 0.03), M["steel"])

def maze(x0, x1, ys, M, posts=4, banners=True):
    """The lift line maze: lanes of rope between steel posts, navy banners on the outer fences."""
    xs = [x0 + i * (x1 - x0) / (posts - 1) for i in range(posts)]
    for j, y in enumerate(ys):
        for x in xs:
            cyl(0.035, 1.15, (x, y, 0.5), M["galv"], verts=8)
            cyl(0.05, 0.05, (x, y, 1.1), M["dark"], verts=8)
            cap((0.4, 0.4, 0.2), (x, y, 0.0), M["snow"])
            cap((0.1, 0.1, 0.06), (x, y, 1.15), M["snow"])
        for a, b in zip(xs, xs[1:]):
            for z in (0.55, 1.0): sag((a, y, z), (b, y, z), 0.014, M["navy"], 0.06, n=4, verts=6)
            if banners and j in (0, len(ys) - 1): box((b - a - 0.12, 0.012, 0.4), ((a + b) / 2, y, 0.77), M["navy"])

# ---------- the models ----------
def _hood_kit(yf, yc, z0, z1, M):
    """The kit's hood: the rounded housing, heavy snow on it, the name board on the nose."""
    housing(yf, yc, z0, z1, M)
    sl = abs(yc - yf) - 1.0
    slab((7.4, sl, 0.55), (0, (yf + yc) / 2 - 0.3, z1 + 0.12), M["snow"])
    cyl(3.7, 0.5, (0, yc, z1 + 0.12), M["snow"], verts=28, bevel=0.18, kind="snow")
    for sx in (-1, 1): cyl(0.2, abs(yc - yf) - 2.2, (sx * 3.75, (yf + yc) / 2 + 1.1, z1 - 0.02), M["snow"], rot=(math.pi / 2, 0, 0), verts=10, kind="snow")
    name_board(0, yf - 0.02, z0 + 0.85, 4.6, 0.75, M)

def terminal_detach(name="terminal_detach", hood=None):
    """A detachable chair terminal at the bottom (drive): concrete deck, the long hood over the bullwheel on
    its steel frame, loading carpet and gates, a maze, the operator's hut, light posts, the name board.
    Rope: x = +-3.0 (the up line at +3.0 leaves along -Y), z = 4.45, leaving the hood at y = -10.
    `hood` draws a maker's hood instead of the kit's (the variants below); the rope stays the same."""
    new_col(name); M = mats(); anchor(M["dark"])
    yf, yc, z0, z1, zf = -10.0, 10.0, 4.75, 7.15, 0.3
    # Deck: a concrete slab with joints and a kerb.
    box((13.0, 27.0, zf), (0, 1.5, zf / 2), M["conc"], bevel=0.03)
    for k in range(1, 7): box((12.9, 0.03, 0.01), (0, -12 + k * 3.9, zf + 0.002), M["dark"])
    (hood or _hood_kit)(yf, yc, z0, z1, M)
    columns((-4.0, 6.0), zf, z0, M)
    ladder(-0.62, 6.0, zf + 0.45, z0 - 0.05, M, along="y")
    # Loading: carpet, gates, the load line, corral rails each side.
    slab((13.2, 10.6, 0.3), (0, -7.0, zf + 0.06), M["snow"])  # packed snow over the load area
    zs = zf + 0.2
    carpet(3.0, -4.6, -8.8, M, zs - 0.1)
    gates(1.45, 4.55, -4.1, zs, M)
    box((3.2, 0.14, 0.012), (3.0, -9.1, zs + 0.005), M["ochre"])
    railing((4.85, -4.1), (4.85, -10.2), zs, M, posts=5)
    railing((1.15, -4.1), (1.15, -9.6), zs, M, posts=4)
    # The return side: a railing along the deck edge.
    railing((-6.3, -11.5), (-6.3, 14.5), zf, M, posts=12)
    railing((-6.3, 14.5), (5.5, 14.5), zf, M, posts=7)
    # The maze off to the side, feeding the gates.
    maze(5.6, 13.6, [-3.6, -1.8, 0.0, 1.8, 3.6], M)
    # Operator hut at the load, an electrical cabinet at the back, lights.
    hut(7.6, -7.4, M, face="-x")
    box((2.2, 0.7, 1.9), (2.6, 13.4, zf + 0.95), M["lightgrey"], bevel=0.03)
    for k in range(3): box((0.02, 0.72, 1.7), (1.85 + k * 0.72, 13.4, zf + 0.95), M["dark"])
    blob((2.3, 0.8, 0.2), (2.6, 13.4, zf + 1.98), M["snow"], lumps=0.02)
    lamp_post(5.6, -11.2, M, arm=(-0.6, 0.8)); lamp_post(-5.8, -11.2, M, arm=(0.6, 0.8))
    # Snow banked against the deck, drifts.
    blob((1.2, 27.5, 0.7), (-7.0, 1.5, 0.12), M["snow"], lumps=0.12)
    blob((13.5, 1.3, 0.75), (0, 15.6, 0.12), M["snow"], lumps=0.12)
    blob((1.2, 13.0, 0.6), (7.0, 8.2, 0.1), M["snow"], lumps=0.12)
    for p in ((-3.0, 2.0), (-3.5, 11.5), (4.5, 10.5)): blob((1.6, 1.4, 0.35), (p[0], p[1], zf + 0.05), M["snow"], lumps=0.08)
    finalize(name, 1024, ao_dist=1.2)

def terminal_detach_top():
    """The detachable terminal at the top (return): the hood's half round over the bullwheel is uphill, at -Y.
    Chairs arrive along -Y on the x = +3.0 line, riders
    unload onto a raised ramp that slopes away to +X. Rope: x = +-3.0, z = 5.35, entering the hood at y = +10."""
    new_col("terminal_detach_top"); M = mats(); anchor(M["dark"])
    yf, yc, z0, z1, zf = 10.0, -10.0, 5.65, 8.05, 0.3
    box((12.0, 24.0, zf), (0, -1.0, zf / 2), M["conc"], bevel=0.03)
    housing(yf, yc, z0, z1, M)
    columns((4.0, -6.0), zf, z0, M)
    ladder(-0.62, -6.0, zf + 0.45, z0 - 0.05, M, along="y")
    sl = abs(yc - yf) - 1.0
    slab((7.4, sl, 0.55), (0, (yf + yc) / 2 + 0.3, z1 + 0.12), M["snow"])
    cyl(3.7, 0.5, (0, yc, z1 + 0.12), M["snow"], verts=28, bevel=0.18, kind="snow")
    for sx in (-1, 1): cyl(0.2, abs(yc - yf) - 2.2, (sx * 3.75, (yf + yc) / 2 - 1.1, z1 - 0.02), M["snow"], rot=(math.pi / 2, 0, 0), verts=10, kind="snow")
    # The unload ramp: a timber-cribbed platform under the up line, sloping away to +X, snow on top.
    ya, yb, h = 1.5, 9.5, 1.25
    out = [(1.0, 0), (1.0, h), (4.9, h), (13.0, 0)]
    for y, t in ((ya, -0.25), (yb, 0.25)):
        prism(out, 0, 0.25, M["boards"], loc=(0, y if t > 0 else y + 0.25, 0), rot=(math.pi / 2, 0, 0), smooth=None)
    prism(out, 0, yb - ya, M["boards"], loc=(0, yb, 0), rot=(math.pi / 2, 0, 0), smooth=None)
    box((0.25, yb - ya + 0.25, h), (1.0, (ya + yb) / 2, h / 2), M["timber"])
    for y in (ya, (ya + yb) / 2, yb): box((0.2, 0.2, h + 0.1), (4.9, y, (h + 0.1) / 2), M["timber"])
    slab((4.1, yb - ya + 0.3, 0.45), (2.95, (ya + yb) / 2, h + 0.12), M["snow"])
    run = math.hypot(13.0 - 4.9, h); a = math.atan2(h, 13.0 - 4.9)
    slab((run + 0.2, yb - ya + 0.3, 0.45), ((4.9 + 13.0) / 2, (ya + yb) / 2, h / 2 + 0.12), M["snow"], rot=(0, a, 0))
    box((3.5, 0.14, 0.012), (2.95, ya + 0.6, h + 0.36), M["ochre"])  # the unload line
    railing((1.1, ya - 0.1), (1.1, yb + 0.6), h, M, posts=5)
    railing((4.9, yb + 0.3), (11.0, yb + 0.3), 0.0, M, posts=5)
    # Small hut beside the ramp, a light, banked snow.
    hut(8.8, 13.2, M, face="-y", W=2.4, D=2.1)
    lamp_post(5.6, 11.8, M, arm=(-0.8, -0.6)); lamp_post(-5.4, 11.8, M, arm=(0.8, -0.6))
    blob((1.2, 24.5, 0.7), (-6.5, -1.0, 0.12), M["snow"], lumps=0.12)
    blob((12.5, 1.3, 0.75), (0, -13.6, 0.12), M["snow"], lumps=0.12)
    blob((1.2, 11.0, 0.7), (6.5, -7.0, 0.12), M["snow"], lumps=0.12)
    for p in ((-3.0, -2.0), (-3.0, 7.5)): blob((1.6, 1.4, 0.35), (p[0], p[1], zf + 0.05), M["snow"], lumps=0.08)
    finalize("terminal_detach_top", 1024, ao_dist=1.2)

def terminal_fixed():
    """A fixed-grip bottom drive: the bullwheel open under a cantilevered boom on a steel column (both in
    the lift's paint), gearbox and motor on top behind a railed catwalk, a loading ramp, a little hut.
    Rope: x = +-2.3 (the up line at +2.3 leaves along -Y), z = 4.0, bullwheel centred at the origin."""
    new_col("terminal_fixed"); M = mats(); anchor(M["dark"])
    G, zb = 2.3, 4.0
    PT = M["paint"]
    cy = 3.3
    box((2.8, 2.8, 0.7), (0, cy, 0.35), M["conc"], bevel=0.05)
    box((1.3, 1.3, 0.05), (0, cy, 0.725), M["steel"])
    for sx in (-1, 1):
        for sy in (-1, 1): cyl(0.05, 0.14, (sx * 0.52, cy + sy * 0.52, 0.78), M["galv"], verts=6)
    cyl(0.44, 6.0, (0, cy, 0.75 + 3.0), PT, verts=20, r2=0.36, kind="paint")
    cyl(0.5, 0.12, (0, cy, 0.8), PT, verts=20, kind="paint")
    # The boom, the tie up to the column head.
    zt = zb + 1.05
    box((0.7, 4.3, 0.8), (0, cy - 2.0, zt), PT, kind="paint", bevel=0.04)
    box((0.9, 0.9, 0.3), (0, cy, 6.85), PT, kind="paint", bevel=0.03)
    for sx in (-1, 1): rod((sx * 0.2, cy, 6.7), (sx * 0.2, -0.6, zt + 0.4), 0.06, M["steel"], 8)
    # Bullwheel under the boom: rim, liner, spokes, hub, shaft up into the gearbox.
    torus(G, 0.13, (0, 0, zb), M["steel"], seg=48, rseg=8, zscale=1.5)
    torus(G + 0.09, 0.055, (0, 0, zb), M["rubber"], seg=48, rseg=6)
    for k in range(8):
        a = 2 * math.pi * k / 8 + 0.2
        for dz in (-0.08, 0.08): rod((0.4 * math.cos(a), 0.4 * math.sin(a), zb + dz), ((G - 0.08) * math.cos(a), (G - 0.08) * math.sin(a), zb + dz * 0.3), 0.055, M["steel"], 8)
    cyl(0.42, 0.42, (0, 0, zb), M["dark"], verts=20, bevel=0.03)
    cyl(0.2, zt - zb, (0, 0, (zt + zb) / 2), M["dark"], verts=12)
    # Catwalk on the boom: grating, railings, the gearbox and motor, a ladder up the column.
    zc = zt + 0.4
    box((2.6, 4.6, 0.06), (0, cy - 2.0, zc + 0.03), M["grate"])
    for k in range(12): box((2.6, 0.02, 0.02), (0, cy - 4.2 + k * 0.4, zc + 0.07), M["dark"])
    railing((-1.3, cy + 0.3), (-1.3, cy - 4.3), zc + 0.06, M, posts=4)
    railing((1.3, cy + 0.3), (1.3, cy - 4.3), zc + 0.06, M, posts=4)
    railing((-1.3, cy - 4.3), (1.3, cy - 4.3), zc + 0.06, M, posts=3)
    box((1.1, 1.1, 0.75), (0, 0, zc + 0.43), M["dark"], bevel=0.05)
    for k in range(4): box((1.14, 0.04, 0.04), (0, -0.4 + k * 0.27, zc + 0.6), M["steel"])
    cyl(0.34, 1.3, (0.05, 1.45, zc + 0.42), M["steel"], rot=(math.pi / 2, 0, 0), verts=16)
    for k in range(8): box((0.72, 0.02, 0.04), (0.05, 0.85 + k * 0.15, zc + 0.42), M["dark"], rot=(0, 0, 0))
    box((0.6, 0.6, 0.5), (0.05, 2.4, zc + 0.35), M["lightgrey"], bevel=0.03)
    blob((1.2, 1.2, 0.18), (0, 0, zc + 0.85), M["snow"], lumps=0.02)
    blob((0.7, 1.3, 0.15), (0.05, 1.45, zc + 0.78), M["snow"], lumps=0.02)
    blob((2.4, 4.4, 0.12), (0, cy - 2.0, zc + 0.08), M["snow"], lumps=0.03)
    ladder(0, cy + 0.5, 0.75, zc, M, along="x")
    # The loading ramp: a cribbed timber platform under the up line, sloping in from +X, the load line.
    ya, yb, h = -3.6, 0.6, 0.45
    box((3.1, yb - ya, h), (G, (ya + yb) / 2, h / 2), M["boards"])
    for y in (ya, yb):
        box((3.2, 0.12, h + 0.05), (G, y, (h + 0.05) / 2), M["timber"])
    out = [(G + 1.55, 0), (G + 1.55, h), (G + 5.5, 0)]
    for y in (ya - 0.0 + 1.6, yb):
        prism(out, 0, 0.12, M["timber"], loc=(0, y, 0), rot=(math.pi / 2, 0, 0), smooth=None)
    slab((3.2, yb - ya + 0.2, 0.35), (G, (ya + yb) / 2, h + 0.08), M["snow"])
    run = math.hypot(3.95, h); a = math.atan2(h, 3.95)
    slab((run, yb - ya - 1.4, 0.35), (G + 1.55 + 1.97, (ya + 1.6 + yb) / 2 - 0.06, h / 2 + 0.08), M["snow"], rot=(0, a, 0))
    box((2.4, 0.12, 0.012), (G, -0.9, h + 0.26), M["ochre"])
    for x in (G - 1.4, G + 1.4):
        box((0.12, 0.12, 1.2), (x, -0.9, h + 0.6), M["galv"])
    railing((G - 1.6, ya), (G - 1.6, yb + 0.4), h, M, posts=3)
    # A short rope corral at the ramp's foot, the little hut, a lamp.
    maze(G + 5.6, G + 10.0, [-1.6, -0.1, 1.4], M, posts=3)
    hut(G + 3.4, -6.0, M, face="-x", W=2.1, D=1.9, H=2.4)
    lamp_post(-3.6, -2.5, M, arm=(0.8, 0.2))
    blob((3.4, 3.4, 0.5), (0, cy, 0.15), M["snow"], lumps=0.1)
    blob((1.0, 4.6, 0.5), (G - 1.9, (ya + yb) / 2, 0.12), M["snow"], lumps=0.08)
    finalize("terminal_fixed", 1024, ao_dist=1.0)

def gondola_station():
    """A gondola station: the cabins pass through a timber and stone hall with glass sides under a big snowy
    roof, the detach machinery (hood in the lift's paint) inside. Two portals in the front gable.
    Rope: x = +-3.0, z = 4.25, leaving the front portals at y = -13 along -Y."""
    new_col("gondola_station"); M = mats(); anchor(M["dark"])
    W, y0, y1, F, T, rise = 16.0, -13.0, 15.0, 0.6, 7.2, 4.4
    D = y1 - y0; cy = (y0 + y1) / 2; ST, TIM = M["stone"], M["timber"]
    # Plinth and floor.
    box((W + 0.4, D + 0.4, F), (0, cy, F / 2), ST, bevel=0.04)
    box((W - 0.4, D - 0.4, 0.04), (0, cy, F + 0.02), M["conc"])
    # Stone wainscot round the sides and back.
    zw = 1.7
    for sx in (-1, 1): box((0.5, D, zw - F), (sx * (W / 2 - 0.25), cy, (F + zw) / 2), ST, bevel=0.03)
    box((W, 0.5, T - F), (0, y1 - 0.25, (F + T) / 2), M["boards"])
    box((W + 0.1, 0.55, zw - F), (0, y1 - 0.25, (F + zw) / 2), ST, bevel=0.03)
    for sx in (-1, 1): box((W / 2 + 0.1, 0.12, 0.2), (sx * W / 4, y1 - 0.02, zw + 0.05), TIM)
    # Glass sides: posts, a transom, the top plate.
    n = 7; bay = D / n
    for sx in (-1, 1):
        x = sx * (W / 2 - 0.25)
        for k in range(n + 1): box((0.34, 0.34, T - zw), (x, y0 + k * bay, (zw + T) / 2), TIM, bevel=0.03)
        box((0.4, D + 0.3, 0.45), (x, cy, T), TIM, bevel=0.03)
        box((0.3, D, 0.14), (x, cy, zw + 0.07), TIM)
        box((0.22, D, 0.14), (x, cy, 4.6), TIM)
        for k in range(n):
            yy = y0 + (k + 0.5) * bay
            if sx > 0 and k == 2: continue
            box((0.04, bay - 0.34, T - zw - 0.45), (x, yy, (zw + T - 0.45) / 2), M["glass"], kind="glass")
            box((0.1, 0.06, T - zw - 0.45), (x + sx * 0.05, yy, (zw + T - 0.45) / 2), TIM)
        blob((0.4, D, 0.14), (sx * (W / 2 - 0.12), cy, zw + 0.18), M["snow"], lumps=0.02)
    # The passenger door on the +X side: double glass doors, a canopy, steps.
    dy = y0 + 2.5 * bay; x = W / 2 - 0.25
    box((0.06, bay - 0.4, 2.6), (x + 0.02, dy, F + 1.3), M["glass"], kind="glass")
    box((0.12, 0.08, 2.6), (x + 0.06, dy, F + 1.3), M["dark"])
    for s in (-1, 1): box((0.12, 0.1, 2.7), (x + 0.06, dy + s * (bay / 2 - 0.25), F + 1.35), M["dark"])
    box((0.12, bay - 0.4, 0.1), (x + 0.06, dy, F + 2.65), M["dark"])
    box((0.04, bay - 0.4, T - F - 3.2 - 0.45), (x, dy, (F + 2.7 + T - 0.45) / 2), M["glass"], kind="glass")
    box((1.9, bay + 0.4, 0.18), (x + 1.0, dy, F + 3.2), M["metalroof"], rot=(0, -0.1, 0), bevel=0.02)
    slab((1.85, bay + 0.3, 0.35), (x + 1.0, dy, F + 3.42), M["snow"], rot=(0, -0.1, 0))
    for s in (-1, 1): rod((x + 1.85, dy + s * (bay / 2 + 0.1), F + 3.05), (x + 0.2, dy + s * (bay / 2 + 0.1), F + 2.2), 0.04, M["steel"])
    for i in range(3): box((1.3 - i * 0.0, bay - 0.2, 0.2), (x + 0.75 + i * 0.4, dy, F - 0.1 - i * 0.2), ST, bevel=0.02)
    for s in (-1, 1):
        rod((x + 0.3, dy + s * (bay / 2 - 0.1), F + 1.0), (x + 1.7, dy + s * (bay / 2 - 0.1), 0.95), 0.03, M["galv"])
        for t in (0.3, 1.0, 1.7): rod((x + t, dy + s * (bay / 2 - 0.1), F - (t - 0.3) / 1.4 * 0.6), (x + t, dy + s * (bay / 2 - 0.1), F + 1.0 - (t - 0.3) / 1.4 * 0.65), 0.025, M["galv"])
    for s in (-1, 1): box((0.18, 0.12, 0.3), (x + 0.12, dy + s * (bay / 2 + 0.1), F + 2.6), M["lamp"], kind="lamp")
    # The front: stone piers between two cabin portals, a timber lintel, the glass gable with its mullions.
    fy = y0
    ph = 5.3  # portal height above the floor
    for xa, xb in ((-W / 2, -4.75), (-1.25, 1.25), (4.75, W / 2)):
        box((xb - xa, 0.6, ph), ((xa + xb) / 2, fy + 0.3, F + ph / 2), ST, bevel=0.04)
    box((W + 0.4, 0.55, 0.6), (0, fy + 0.27, F + ph + 0.3), TIM, bevel=0.03)
    for sx in (-1, 1):
        box((0.3, 0.2, ph), (sx * 4.75, fy - 0.05, F + ph / 2), TIM)
        box((0.3, 0.2, ph), (sx * 1.25, fy - 0.05, F + ph / 2), TIM)
    zt = F + ph + 0.6
    box((W, 0.4, T - zt + 0.01), (0, fy + 0.25, (zt + T) / 2), M["boards"]) if T > zt else None
    tri([(-W / 2, fy + 0.2, T), (W / 2, fy + 0.2, T), (0, fy + 0.2, T + rise)], M["glass"], kind="glass")
    for xx in (-W / 3, -W / 6, 0, W / 6, W / 3):
        hh = rise * (1 - abs(xx) / (W / 2)); box((0.22, 0.26, hh), (xx, fy + 0.15, T + hh / 2), TIM)
    box((W * 0.62, 0.26, 0.2), (0, fy + 0.15, T + rise * 0.38), TIM)
    box((W + 0.2, 0.45, 0.45), (0, fy + 0.2, T), TIM, bevel=0.03)
    name_board(0, fy - 0.08, F + ph + 0.3, 6.0, 0.48, M)
    # The back gable, boarded, with a louvred vent and a lit window for the machine room.
    tri([(-W / 2, y1, T), (W / 2, y1, T), (0, y1, T + rise)], M["boards"], thick=0.2)
    box((1.6, 0.12, 1.1), (0, y1 + 0.22, T + 1.6), M["timber"], bevel=0.02)
    for k in range(6): box((1.4, 0.06, 0.08), (0, y1 + 0.28, T + 1.15 + k * 0.17), M["dark"], rot=(0.5, 0, 0))
    for sx in (-1, 1):
        box((1.6, 0.1, 1.3), (sx * 4.2, y1 + 0.05, 4.2), M["window"], kind="lit")
        box((1.8, 0.2, 0.14), (sx * 4.2, y1 + 0.1, 3.5), M["timber"]); box((1.8, 0.16, 0.12), (sx * 4.2, y1 + 0.08, 4.9), M["timber"])
        cap((1.8, 0.24, 0.1), (sx * 4.2, y1 + 0.12, 3.62), M["snow"])
    # Trusses inside, seen through the glass: tie beam, rafters, king post, struts.
    for k in range(1, n):
        yy = y0 + k * bay
        box((W - 0.6, 0.26, 0.36), (0, yy, T), TIM)
        box((0.22, 0.24, rise - 0.3), (0, yy, T + (rise - 0.3) / 2), TIM)
        for s in (-1, 1):
            rod((s * (W / 2 - 0.3), yy, T + 0.1), (0, yy, T + rise - 0.25), 0.13, TIM, 4)
            rod((s * 0.15, yy, T + 0.2), (s * W / 4, yy, T + rise / 2 - 0.05), 0.09, TIM, 4)
        box((0.3, 0.3, 0.25), (0, yy, T - 0.35), M["dark"])
        box((0.35, 0.35, 0.05), (0, yy, T - 0.49), M["lamp"], kind="lamp")
    # Inside: the terminal machinery under its hood, rails out through the portals, the platform edge.
    housing(y0 + 1.2, y1 - 5.2, 4.75, 6.6, M, R=4.3, nose=3.0)
    for sx in (-1, 1): box((0.14, 1.6, 0.26), (sx * 3.0, y0 + 0.6, 4.45), M["steel"])
    for sx in (-1, 1): box((0.8, 0.8, 4.75 - F - 0.5), (0, y0 + 3.5 + (sx + 1) * 6.0, F + (4.75 - F) / 2 - 0.2), M["steel"])
    for sx in (-1, 1): box((0.25, D - 4.0, 0.05), (sx * 1.6, cy - 1.0, F + 0.045), M["ochre"])
    # Roof: two big slabs from the ridge out past the walls, fascia, deep snow and a ridge roll, icicles.
    a = math.atan2(rise, W / 2); over = 1.6; L = (W / 2 + over) / math.cos(a); ridge = Vector((0, cy, T + rise + 0.25))
    for s in (-1, 1):
        dv = Vector((s * math.cos(a), 0, -math.sin(a))); nrm = Vector((s * math.sin(a), 0, math.cos(a))); c = ridge + dv * (L / 2)
        rot = (0, s * a, 0)
        box((L, D + 3.2, 0.36), c, M["roof"], rot=rot, bevel=0.04)
        for yy in (y0 - 1.6, y1 + 1.6): box((L, 0.28, 0.55), c + Vector((0, yy - cy, -0.08)), TIM, rot=rot, bevel=0.03)
        slab((L - 0.1, D + 3.1, 0.65), c + nrm * 0.5, M["snow"], rot=rot)
        eave = ridge + dv * L + nrm * 0.45
        cyl(0.3, D + 3.1, eave, M["snow"], rot=(math.pi / 2, 0, 0), verts=12)
        for i in range(30):
            yy = y0 - 1.4 + rnd.random() * (D + 2.8); h = 0.15 + rnd.random() * 0.45
            cyl(0.05, h, eave + Vector((s * 0.05, yy - cy, -0.3 - h / 2)), flat("ice", "#cfe3f2", 0.2, grain=0), verts=6, r2=0.0)
        for k in range(n + 1):  # rafter tails under the eave
            box((1.5, 0.2, 0.26), ridge + dv * (L - 0.75) + Vector((0, y0 + k * bay - cy, -0.45)), TIM, rot=rot)
    cyl(0.42, D + 3.1, ridge + Vector((0, 0, 0.45)), M["snow"], rot=(math.pi / 2, 0, 0), verts=14)
    # Snow banked against the walls, lamps at the portals.
    for s in (-1, 1): blob((1.4, D + 1.6, 1.1), (s * (W / 2 + 0.55), cy + 0.5, 0.25), M["snow"], lumps=0.15)
    blob((W + 2.2, 1.6, 1.1), (0, y1 + 0.7, 0.25), M["snow"], lumps=0.15)
    for xa, xb in ((-W / 2, -4.75), (4.75, W / 2)): blob((xb - xa + 0.4, 1.2, 0.8), ((xa + xb) / 2, fy - 0.5, 0.2), M["snow"], lumps=0.12)
    for xx in (-6.4, -2.9, 2.9, 6.4): box((0.2, 0.2, 0.32), (xx * 1.0 if abs(xx) > 5 else xx * 0 + (1.6 if xx > 0 else -1.6), fy - 0.2, F + 3.6), M["lamp"], kind="lamp")
    finalize("gondola_station", 2048, ao_dist=1.5)

# ---------- makers' hoods for the detachable terminal ----------
# Each is the kit's terminal with another hood; the deck, frame, machinery and rope (x = ±3.0, z = 4.45)
# are the same. Two paint regions: `paint_hood` (the shell) and `paint_band` (band, stripe or top).
def plan(hw, y0, y1, r0, r1, z, seg=7):
    """A hood in plan at height z: half width hw from y0 (the nose) to y1 (over the bullwheel), corners
    rounded by r0 at the nose and r1 at the far end (r1 = hw: a half round)."""
    r0, r1 = max(0.05, min(r0, hw)), max(0.05, min(r1, hw)); pts = []
    for cx, cy, r, a0 in ((hw - r1, y1 - r1, r1, 0), (-hw + r1, y1 - r1, r1, 90), (-hw + r0, y0 + r0, r0, 180), (hw - r0, y0 + r0, r0, 270)):
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg); pts.append((cx + r * math.cos(a), cy + r * math.sin(a), z))
    return pts

def lid(ring, mat, kind="paint"):
    """A flat cap over a closed ring of points."""
    bm = bmesh.new(); bm.faces.new([bm.verts.new(p) for p in ring]); bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces:
        if f.normal.z < 0: f.normal_flip()
    return _obj(bm, mat, kind, "lid")

def shell(rings, mat, kind="bake", cap=False):
    bm = bmesh.new(); V = [[bm.verts.new(p) for p in r] for r in rings]; n = len(rings[0])
    for a, b in zip(V, V[1:]):
        for i in range(n): j = (i + 1) % n; bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap: bm.faces.new(V[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return _obj(bm, mat, kind, "shell", smooth=40)

def hood_profile(prof, hw, y0, y1, r0, r1, z0, M, seg=7):
    """Loft a hood from a profile [(dz, inset, material key, kind)]: each row starts a band that runs to the next."""
    rings = [plan(hw - d, y0 + d, y1 - d, r0 - d, r1 - d, z0 + dz, seg) for dz, d, *_ in prof]
    for k in range(len(prof) - 1):
        m, kind = prof[k][2], prof[k][3]
        if m: shell([rings[k], rings[k + 1]], M[m], kind)
    return rings

def ribs(prof, hw, ys, z0, M, mat="trim", r=0.05):
    """Ribs over a vault at each y: rods along the profile from one side over the top to the other."""
    for y in ys:
        side = [(hw - d, z0 + dz) for dz, d, *_ in prof]
        pts = [(-x, y, z) for x, z in side] + [(x, y, z) for x, z in reversed(side)]
        for a, b in zip(pts, pts[1:]): rod(a, b, r, M[mat], 6)

def side_board(x, y, z, w, h, M, sx):
    """A name board on the hood's side, facing ±X."""
    rot = (math.pi / 2, 0, sx * math.pi / 2)
    box((0.08, w + 0.14, h + 0.14), (x, y, z), M["trim"], bevel=0.02)
    face([(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)], M["board"], "flat", loc=(x + sx * 0.045, y, z), rot=rot)

def hood_mats(M, hood, band, glass_hex="#25303a"):
    M["paint"] = flat("paint_hood", hood, 0.35, 0.3, grain=0); M["band"] = flat("paint_band", band, 0.4, 0.2, grain=0)
    M["vault"] = flat("hood_glass", glass_hex, 0.12, grain=0)

def hood_snow(M, hw, y0, y1, ztop, rf):
    slab((2 * hw, y1 - y0 - rf - 0.5, 0.45), (0, (y0 + y1 - rf) / 2, ztop + 0.12), M["snow"])
    cyl(hw, 0.42, (0, y1 - rf, ztop + 0.12), M["snow"], verts=24, bevel=0.15, kind="snow")

def _hood_lpa(yf, yc, z0, z1, M):
    """Leitner-Poma LPA: long and low, a band for the resort colour, a glazed barrel vault over it in silver
    ribs that wraps the round ends, a silver skirt below."""
    hood_mats(M, "#b9bec4", "#b0683a")
    hw, y0, y1, r0, r1 = 4.1, yf - 0.3, yc + 4.4, 2.6, 4.1
    prof = [(-0.45, 0.5, "paint", "paint"), (0.0, 0.0, "band", "paint"), (1.1, 0.0, "paint", "paint"), (1.24, 0.0, "vault", "bake"),
            (1.7, 0.1, "vault", "bake"), (2.15, 0.38, "vault", "bake"), (2.5, 0.8, "vault", "bake"), (2.75, 1.35, "vault", "bake"),
            (2.88, 1.95, "paint", "paint"), (2.93, 2.2, None, None)]
    rings = hood_profile(prof, hw, y0, y1, r0, r1, z0, M)
    lid(rings[-1], M["paint"])
    ribs(prof[3:], hw, [y0 + r0 + 0.6 + k * 1.35 for k in range(int((y1 - r1 - y0 - r0) / 1.35) + 1)], z0, M, "trim", 0.045)
    for sx in (-1, 1):
        box((0.04, y1 - y0 - r0 - r1, 0.05), (sx * (hw + 0.01), (y0 + r0 + y1 - r1) / 2, z0 + 1.17), M["trim"])
        side_board(sx * (hw + 0.02), (y0 + y1) / 2 - 2.5, z0 + 0.55, 6.0, 0.6, M, sx)
    box((2.6, 0.5, 0.6), (0, y0 + 0.45, z0 + 3.1), M["trim"], bevel=0.05)  # the cab's vent hood over the nose
    hood_snow(M, hw - 2.0, y0 + 1.0, y1, z0 + 2.93, 2.0)
    machinery(yf, yc, z0, M)

def _hood_omega(yf, yc, z0, z1, M):
    """Poma Omega: a barrel vault of dark panels on green ribs, domed at both ends, over a deep band with a
    flared skirt; the lift's name on the band."""
    hood_mats(M, "#3f5a4a", "#3f5a4a", "#232a2e")
    hw, y0, y1, r0, r1 = 4.0, yf - 0.4, yc + 4.4, 4.0, 4.0
    prof = [(-0.4, 0.55, "paint", "paint"), (0.05, 0.0, "paint", "paint"), (1.05, 0.0, "band", "paint"), (1.2, -0.06, "vault", "bake"),
            (1.7, 0.1, "vault", "bake"), (2.2, 0.45, "vault", "bake"), (2.6, 1.0, "vault", "bake"), (2.85, 1.7, "vault", "bake"),
            (2.93, 2.4, "paint", "paint"), (2.95, 2.6, None, None)]
    rings = hood_profile(prof, hw, y0, y1, r0, r1, z0, M, seg=9)
    lid(rings[-1], M["paint"])
    ribs(prof[3:], hw, [y0 + r0 + k * 1.6 for k in range(int((y1 - y0 - r0 - r1) / 1.6) + 1)], z0, M, "dark", 0.05)
    for sx in (-1, 1): side_board(sx * (hw + 0.02), (y0 + y1) / 2 - 1.0, z0 + 0.55, 6.5, 0.65, M, sx)
    hood_snow(M, hw - 2.4, y0 + r0, y1, z0 + 2.95, 1.6)
    machinery(yf, yc, z0, M)

def _hood_unig(yf, yc, z0, z1, M):
    """Doppelmayr Uni-G: a smooth hood whose sides lean in to a rounded top in the band colour, dark window
    strips along the shoulders, and a flat porch roof over the load and the operator's hut."""
    hood_mats(M, "#c2462e", "#1f2226")
    hw, y0, y1, r0, r1 = 4.3, yf - 0.3, yc + 4.4, 1.6, 4.3
    prof = [(-0.3, 0.3, "paint", "paint"), (0.0, 0.0, "paint", "paint"), (0.9, 0.0, "paint", "paint"), (1.75, 0.5, "band", "paint"),
            (2.1, 0.85, "band", "paint"), (2.25, 1.3, "band", "paint"), (2.3, 1.8, None, None)]
    rings = hood_profile(prof, hw, y0, y1, r0, r1, z0, M)
    lid(rings[-1], M["band"])
    a = math.atan2(0.85, 0.5)
    for sx in (-1, 1):
        box((0.06, y1 - y0 - r0 - r1 - 0.6, 0.42), (sx * (hw - 0.26), (y0 + r0 + y1 - r1) / 2, z0 + 1.33), M["vault"], rot=(0, -sx * (math.pi / 2 - a), 0))
        side_board(sx * (hw + 0.02), (y0 + y1) / 2 - 3.0, z0 + 0.5, 5.5, 0.6, M, sx)
    # The porch roof on the +X side, over the maze and the hut, on two posts.
    px0, px1, py0, py1, pz = hw - 0.2, 10.2, yf - 1.5, yf + 9.5, z0 + 0.6
    box((px1 - px0, py1 - py0, 0.32), ((px0 + px1) / 2, (py0 + py1) / 2, pz), M["paint"], bevel=0.06, kind="paint")
    box((px1 - px0 + 0.06, py1 - py0 + 0.06, 0.08), ((px0 + px1) / 2, (py0 + py1) / 2, pz - 0.2), M["dark"])
    for y in (py0 + 0.6, py1 - 0.6): rod((px1 - 0.5, y, 0.3), (px1 - 0.5, y, pz - 0.2), 0.12, M["steel"], 10)
    slab((px1 - px0 - 0.1, py1 - py0 - 0.1, 0.4), ((px0 + px1) / 2, (py0 + py1) / 2, pz + 0.3), M["snow"])
    hood_snow(M, hw - 1.8, y0 + 1.0, y1, z0 + 2.3, 2.5)
    machinery(yf, yc, z0, M)

def _hood_dopp90(yf, yc, z0, z1, M):
    """1990s Doppelmayr (Uni / Spacejet): a flat-topped silver box hood with a chamfered nose and a round
    back, a red band under the roof edge, a flat roof."""
    hood_mats(M, "#b4b9be", "#a5352c")
    R, nose = 4.3, 2.9
    prism(hood_outline(yf, yc, R, nose), z0, z1 - 0.5, M["paint"], "paint", bevel=0.12, seg=2)
    prism(hood_outline(yf - 0.04, yc, R + 0.04, nose + 0.02), z1 - 0.52, z1 - 0.05, M["band"], "paint", bevel=0.05, seg=2)
    prism(hood_outline(yf + 0.2, yc, R - 0.2, nose - 0.1), z1 - 0.05, z1 + 0.05, M["trim"], bevel=0.03, seg=1)
    prism(hood_outline(yf - 0.06, yc, R + 0.06, nose + 0.03), z0 - 0.14, z0 + 0.06, M["dark"], bevel=0.02, seg=1)
    L = abs(yc - yf) - 1.6
    for sx in (-1, 1):
        for i in range(1, 7): box((0.03, 0.04, z1 - z0 - 0.75), (sx * (R + 0.01), yf + 1.6 + i * L / 7, (z0 + z1 - 0.5) / 2), M["dark"])
        box((0.05, 2.0, 0.8), (sx * (R + 0.02), yf + 2.4, z0 + 1.3), M["vault"])  # the window into the station
        side_board(sx * (R + 0.02), yc - 3.4, z0 + 0.9, 5.0, 0.6, M, sx)
    name_board(0, yf - 0.02, z0 + 0.95, 4.2, 0.7, M)
    slab((2 * R - 0.6, abs(yc - yf) - 0.8, 0.5), (0, (yf + yc) / 2 - 0.2, z1 + 0.25), M["snow"])
    cyl(R - 0.3, 0.48, (0, yc, z1 + 0.25), M["snow"], verts=28, bevel=0.16, kind="snow")
    machinery(yf, yc, z0, M)

def terminal_detach_lpa(): terminal_detach("terminal_detach_lpa", _hood_lpa)
def terminal_detach_omega(): terminal_detach("terminal_detach_omega", _hood_omega)
def terminal_detach_unig(): terminal_detach("terminal_detach_unig", _hood_unig)
def terminal_detach_dopp90(): terminal_detach("terminal_detach_dopp90", _hood_dopp90)

MODELS = {"terminal_detach_lpa": terminal_detach_lpa, "terminal_detach_omega": terminal_detach_omega,
          "terminal_detach_unig": terminal_detach_unig, "terminal_detach_dopp90": terminal_detach_dopp90,
          "terminal_detach": terminal_detach, "terminal_detach_top": terminal_detach_top, "terminal_fixed": terminal_fixed, "gondola_station": gondola_station}
