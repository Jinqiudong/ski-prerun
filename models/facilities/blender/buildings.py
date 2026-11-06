"""Buildings and the furniture around them.

Besides the kit in lib.py this module has a few building parts used here and in props.py: a local frame
`F` (an origin and a turn about Z, so a wall or a dormer can be built facing any way), `pad` (cheap snow),
`prism`, `ring`, and the parts: `gable_roof`, `gable_wall`, `window`, `door`, `lantern`, `dormer`, `truss`."""
import math, random
import bpy, bmesh
from mathutils import Vector
from lib import *
import lib

PI = math.pi

# ---------- parts ----------
def pad(size, loc, mat, rot=(0, 0, 0)):
    """A cheap pillow of snow (a fifth of a blob's faces), for sills, rails, benches, lamps and props."""
    return box(size, loc, mat, rot, bevel=min(size) * 0.45, seg=2, kind="snow", subsurf=1)

def prism(pts, vec, mat, kind="bake"):
    """A flat polygon pushed out along vec: gable ends, glass gables, wedges."""
    me = bpy.data.meshes.new("prism"); bm = bmesh.new(); f = bm.faces.new([bm.verts.new(p) for p in pts])
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, vec=Vector(vec), verts=[e for e in r["geom"] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("prism", me); bpy.context.scene.collection.objects.link(o); return lib._link(o, mat, kind)

def ring(R, r, loc, mat, kind="snow", seg=32, mseg=8, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg, minor_segments=mseg, location=loc, rotation=rot)
    o = bpy.context.active_object
    for p in o.data.polygons: p.use_smooth = True
    return lib._link(o, mat, kind)

def lathe(prof, mat, at=(0, 0, 0), seg=40, kind="snow"):
    """A surface of revolution about Z through `at`, from a profile of (r, z) points, open at both ends:
    snow on a cone roof with its lip, cushions, collars."""
    me = bpy.data.meshes.new("lathe"); bm = bmesh.new(); x0, y0, z0 = at
    rings = [[bm.verts.new((x0 + r * math.cos(2 * PI * i / seg), y0 + r * math.sin(2 * PI * i / seg), z0 + z)) for i in range(seg)] for r, z in prof]
    for a, b in zip(rings, rings[1:]):
        for i in range(seg): j = (i + 1) % seg; bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.to_mesh(me); bm.free(); o = bpy.data.objects.new("lathe", me); bpy.context.scene.collection.objects.link(o)
    for p in o.data.polygons: p.use_smooth = True
    return lib._link(o, mat, kind)

def mound(r, h, at, mat, seg=28):
    """A round, low heap of snow (round a pole's foot, a fire pit)."""
    return lathe([(r, -0.05), (r * 0.82, h * 0.4), (r * 0.55, h * 0.82), (r * 0.25, h), (0.001, h * 1.02)], mat, at, seg)

def drift(size, loc, mat, rot=(0, 0, 0), lumps=0.05):
    """A cheap low drift: a pad with a little unevenness."""
    o = pad(size, loc, mat, rot)
    t = bpy.data.textures.get("lumps") or bpy.data.textures.new("lumps", "CLOUDS"); t.noise_scale = 0.6
    d = o.modifiers.new("d", "DISPLACE"); d.texture = t; d.strength = lumps; d.mid_level = 0.5; d.texture_coords = "GLOBAL"
    return o

class Frame:
    """A local frame: an origin and a turn about Z. Parts placed in it turn with it; its front is local −Y,
    so Frame(o, PI / 2) faces +X, Frame(o, PI) faces +Y and Frame(o, -PI / 2) faces −X."""
    def __init__(s, o=(0, 0, 0), a=0.0): s.o, s.a, s.c, s.s = Vector(o), a, math.cos(a), math.sin(a)
    def p(s, x, y, z=0.0): return Vector((s.o.x + x * s.c - y * s.s, s.o.y + x * s.s + y * s.c, s.o.z + z))
    def r(s, rot): return (rot[0], rot[1], rot[2] + s.a)
    def at(s, x, y, z=0.0, a=0.0): return Frame(s.p(x, y, z), s.a + a)
    def box(s, size, at, mat, rot=(0, 0, 0), **kw): return box(size, s.p(*at), mat, s.r(rot), **kw)
    def cyl(s, r, d, at, mat, rot=(0, 0, 0), **kw): return cyl(r, d, s.p(*at), mat, s.r(rot), **kw)
    def blob(s, size, at, mat, rot=(0, 0, 0), **kw): return blob(size, s.p(*at), mat, s.r(rot), **kw)
    def slab(s, size, at, mat, rot=(0, 0, 0), **kw): return slab(size, s.p(*at), mat, s.r(rot), **kw)
    def pad(s, size, at, mat, rot=(0, 0, 0)): return pad(size, s.p(*at), mat, s.r(rot))
    def prism(s, pts, d, mat, kind="bake"): return prism([s.p(*q) for q in pts], s.p(0, d, 0) - s.p(0, 0, 0), mat, kind)
    def pipe(s, pts, r, mat, kind="bake"): return curve_pipe([tuple(s.p(*q)) for q in pts], r, mat, kind)

W0 = Frame()

def anchor(M):
    """finalize() joins the baked parts into the first part made, and the textures are laid on in that part's
    object space; a box's scale would stretch them (stone into streaks). So each model starts with this:
    a tiny unscaled cylinder buried under its origin."""
    cyl(0.01, 0.01, (0, 0, -0.3), M["st"], verts=3)

def mats():
    """The building palette: warm grey stone, honey logs, grey-brown timber, charcoal shingles, snow."""
    return dict(
        st=stone("stone"), log=wood("log", "#5a3b26", "#8c6240", "X"), logy=wood("logy", "#5a3b26", "#8c6240", "Y"),
        tim=wood("timber", "#4a3020", "#6e4a31", "Z"), deck=wood("deck", "#7a5638", "#a37a52", "X"), roof=wood("roof", "#3b2a22", "#54392b", "Y"),
        boards=wood("boards", "#4d3424", "#6b4a33", "Z"), inner=wood("inner", "#3e2a1e", "#553a29"), end=wood("logend", "#6b4a2e", "#a07a52", "X"),
        door=textured("doorwood", "old_planks_02", 1.2, (0.62, 0.52, 0.45), 0.7, "Z"), sn=snow(), win=lit("window"),
        lamp=lit("lamp", "#ffd9a0", 6.0, "#ffffff", window=False), ice=flat("ice", "#cfe3f2", 0.2, grain=0),
        steel=flat("dark", "#1c1f23", 0.5, 0.4, grain=0), cream=flat("paint_cream", "#ece2cd", 0.6, grain=0),
        pine=flat("pine", "#3f5a4a", 0.6, grain=0.06))

def gable_roof(f, span, y0, y1, z0, rise, over, M, thick=0.32, st=0.6, ice=0, ends=(True, True), ridge=True):
    """A pitched roof in frame f: the ridge along local Y from y0 to y1 over walls at x = ±span/2 whose tops are
    at z0, eaves `over` beyond the walls. Shingles, timber fascia at the open gable ends, a thick flat-topped
    layer of snow with a rounded lip at each eave, icicles. Returns the pitch and a function giving the
    height of the roof's top surface at a distance u from the ridge line."""
    ROOF, TIM, SN, ICE = M["roof"], M["tim"], M["sn"], M["ice"]
    a = math.atan2(rise, span / 2); L = (span / 2 + over) / math.cos(a); zr = z0 + rise + thick * 0.7; yc, ln = (y0 + y1) / 2, y1 - y0
    for s in (-1, 1):
        d = Vector((s * math.cos(a), 0, -math.sin(a))); n = Vector((s * math.sin(a), 0, math.cos(a)))
        c = Vector((0, yc, zr)) + d * (L / 2); rot = (0, s * a, 0)
        f.box((L, ln, thick), c, ROOF, rot, bevel=0.03)
        for y, on in zip((y0, y1), ends):
            if on: f.box((L + 0.05, 0.2, thick + 0.18), c + Vector((0, y - yc, -0.06)), TIM, rot, bevel=0.02)
        f.slab((L - 0.05, ln - 0.08, st), c + n * (thick / 2 + st / 2 - 0.03), SN, rot)
        e = Vector((0, yc, zr)) + d * L + n * (thick / 2 + st * 0.42)
        f.cyl(st * 0.47, ln - 0.08, e, SN, rot=(PI / 2, 0, 0), verts=10)
        for i in range(ice):
            y = y0 + 0.2 + rnd.random() * (ln - 0.4); h = 0.12 + rnd.random() * 0.42
            f.cyl(0.045, h, e + Vector((s * 0.03, y - yc, -st * 0.45 - h / 2)), ICE, verts=5, r2=0.0)
    if ridge: f.cyl(st * 0.6, ln - 0.08, Vector((0, yc, zr + st * 0.72)), SN, rot=(PI / 2, 0, 0), verts=12)
    top = lambda u: zr + thick / (2 * math.cos(a)) - abs(u) * math.tan(a)
    return a, top

def gable_wall(f, span, y, z0, rise, mat, t=0.15):
    """The triangle of wall under a gable, in the plane y of frame f, t thick into the building (+Y)."""
    return f.prism([(-span / 2, y, z0), (span / 2, y, z0), (0, y, z0 + rise)], t, mat)

def window(f, x, z, w, h, M, cols=2, transom=0.7, sill=True, head=False, y=0.0):
    """A framed window on the wall plane y of frame f, facing local −Y: dark lit glass, a timber frame and
    mullions, a sill holding a little snow."""
    WIN, TIM, SN = M["win"], M["tim"], M["sn"]
    f.box((w, 0.06, h), (x, y - 0.02, z + h / 2), WIN, kind="lit")
    for s in (-1, 1): f.box((0.12, 0.16, h + 0.1), (x + s * (w / 2 + 0.03), y - 0.07, z + h / 2), TIM)
    f.box((w + 0.36, 0.2, 0.14), (x, y - 0.09, z + h + 0.06), TIM)
    for k in range(1, cols): f.box((0.06, 0.1, h), (x - w / 2 + k * w / cols, y - 0.06, z + h / 2), TIM)
    if transom and h > 1.3: f.box((w, 0.1, 0.06), (x, y - 0.06, z + h * transom), TIM)
    if sill: f.box((w + 0.34, 0.26, 0.07), (x, y - 0.12, z - 0.03), TIM); f.pad((w + 0.22, 0.24, 0.11), (x, y - 0.14, z + 0.05), SN)
    if head: f.pad((w + 0.3, 0.2, 0.09), (x, y - 0.1, z + h + 0.16), SN)

def door(f, x, z, w, h, M, double=False, glazed=False, lite=True, kick=False, y=0.0):
    """A door in the wall plane y of frame f: a timber frame and head, one or two leaves (planked, or glass
    in a dark steel frame), handles, a little lit window."""
    TIM, WIN, STL, LEAF = M["tim"], M["win"], M["steel"], M["door"]
    for s in (-1, 1): f.box((0.14, 0.18, h + 0.1), (x + s * (w / 2 + 0.05), y - 0.08, z + h / 2), TIM)
    f.box((w + 0.4, 0.22, 0.16), (x, y - 0.09, z + h + 0.08), TIM)
    n = 2 if double else 1; lw = w / n
    for i in range(n):
        cx = x - w / 2 + lw * (i + 0.5); hs = 1 if (n == 1 or i == 0) else -1
        if glazed:
            f.box((lw - 0.02, 0.06, h), (cx, y - 0.03, z + h / 2), STL)
            f.box((lw - 0.2, 0.04, h - 0.32), (cx, y - 0.07, z + h / 2 + 0.06), WIN, kind="lit")
            f.box((0.04, 0.06, 0.9), (cx + hs * (lw / 2 - 0.16), y - 0.14, z + 1.05), flat("silver", "#b8bec6", 0.3, 0.8, grain=0))
            continue
        f.box((lw - 0.03, 0.08, h), (cx, y - 0.04, z + h / 2), LEAF, bevel=0.01)
        f.box((lw - 0.22, 0.03, h * 0.32), (cx, y - 0.095, z + h * 0.24), LEAF, bevel=0.01)
        if lite: f.box((lw - 0.3, 0.03, h * 0.3), (cx, y - 0.09, z + h * 0.68), WIN, kind="lit")
        else: f.box((lw - 0.22, 0.03, h * 0.3), (cx, y - 0.095, z + h * 0.68), LEAF, bevel=0.01)
        f.box((0.05, 0.03, 0.2), (cx + hs * (lw / 2 - 0.12), y - 0.1, z + 1.0), STL)
        f.box((0.15, 0.05, 0.035), (cx + hs * (lw / 2 - 0.17), y - 0.13, z + 1.03), STL)
        if kick: f.box((lw - 0.1, 0.02, 0.24), (cx, y - 0.09, z + 0.14), flat("silver", "#b8bec6", 0.3, 0.8, grain=0))

def lantern(f, x, z, M, y=0.0):
    """A wall lantern: a bracket, a glowing box, a pyramid cap with a little snow."""
    f.box((0.05, 0.3, 0.05), (x, y - 0.15, z + 0.25), M["steel"])
    f.box((0.2, 0.2, 0.28), (x, y - 0.32, z), M["lamp"], kind="lamp")
    for sx in (-1, 1):
        for sy in (-1, 1): f.box((0.025, 0.025, 0.3), (x + sx * 0.1, y - 0.32 + sy * 0.1, z), M["steel"])
    f.cyl(0.19, 0.12, (x, y - 0.32, z + 0.2), M["steel"], verts=4, r2=0.03, rot=(0, 0, PI / 4))
    f.pad((0.2, 0.2, 0.07), (x, y - 0.32, z + 0.27), M["sn"])

def dormer(f, x, yf, zf, tana, w, M, hw=2.1, drise=0.9, wall=None):
    """A gable dormer on a roof rising towards local +Y; its face on the line yf, where the roof's top is at zf."""
    wall = wall or M["boards"]; zt = zf + hw; yb = yf + (hw + drise + 0.35) / tana
    f.box((w, yb - yf, hw + 0.6), (x, (yf + yb) / 2, zf - 0.3 + (hw + 0.6) / 2), wall)
    g = f.at(x, 0)
    gable_wall(g, w, yf, zt, drise, wall, 0.15)
    for s in (-1, 1): g.box((0.16, 0.2, hw + 0.4), (s * (w / 2 - 0.02), yf - 0.04, zf - 0.1 + (hw + 0.4) / 2), M["tim"])
    window(g, 0, zf + 0.72, w - 0.8, hw - 0.95, M, cols=2, transom=0, y=yf)
    gable_roof(g, w, yf - 0.45, yb, zt, drise, 0.3, M, thick=0.22, st=0.42, ice=3, ends=(True, False))

def truss(f, span, y, z0, rise, M, r=0.3):
    """A heavy timber king-post truss in the plane y of frame f, its tie beam at z0 under a roof of that span and rise."""
    TIM = M["tim"]; a = math.atan2(rise, span / 2); Lr = (span / 2) / math.cos(a)
    f.box((span + 0.3, r + 0.04, r * 1.4), (0, y, z0), TIM, bevel=0.03)
    f.box((r, r, rise - r), (0, y, z0 + (rise - r) / 2), TIM, bevel=0.03)
    for s in (-1, 1):
        f.box((Lr, r, r * 1.2), (s * span / 4, y, z0 + rise / 2 - r * 0.2), TIM, rot=(0, s * a, 0), bevel=0.03)
        b = math.atan2(rise * 0.5 - r, span / 4); ls = math.hypot(span / 4, rise * 0.5 - r)
        f.box((ls, r * 0.8, r * 0.8), (s * span / 8, y, z0 + r * 0.5 + (rise * 0.5 - r) / 2), TIM, rot=(0, -s * b, 0), bevel=0.02)
        f.box((0.5, r + 0.08, 0.45), (s * (span / 2 - 0.35), y, z0 + 0.05), M["steel"])  # steel shoe at the heel
    f.box((0.55, r + 0.08, 0.5), (0, y, z0 + 0.1), M["steel"])

def drifts(pts, M, h=0.9, lumps=0.14):
    """Snow banked against walls: (x, y, length along x, depth along y)."""
    for x, y, lx, ly in pts: blob((lx, ly, h), (x, y, h * 0.22), M["sn"], lumps=lumps)

def chimney(x, y, z1, M, w=1.5, d=1.8, step=3.6, flues=2):
    """An outside stone chimney: a broad base to `step`, a narrower stack to z1, a cap with clay flues and snow."""
    ST = M["st"]; box((w, d, step), (x, y, step / 2), ST, bevel=0.04)
    box((w + 0.12, d + 0.12, 0.14), (x, y, step), ST, bevel=0.03)
    sx = x - math.copysign(0.18, x); box((w - 0.4, d - 0.5, z1 - step), (sx, y, (z1 + step) / 2), ST, bevel=0.04)
    box((w - 0.1, d - 0.2, 0.16), (sx, y, z1 + 0.08), ST, bevel=0.03)
    for k in range(flues): cyl(0.13, 0.5, (sx, y + (k - (flues - 1) / 2) * 0.45, z1 + 0.4), flat("clay", "#7d4a3a", 0.8, grain=0.08), verts=10)
    pad((w - 0.15, d - 0.25, 0.22), (sx, y, z1 + 0.25), M["sn"])

# ---------- buildings ----------
def restaurant():
    """A Colorado mid-mountain lodge: a tall log dining hall with a glass gable under a heavy timber truss on
    log columns, gable dormers, an outside stone chimney, a lower stone-and-board side wing, a deck with tables."""
    new_col("restaurant"); M = mats()
    ST, LOG, LOGY, TIM, DECK, SN, WIN, LAMP = (M[k] for k in ("st", "log", "logy", "tim", "deck", "sn", "win", "lamp"))
    W, D, F, T, R = 16.0, 12.0, 1.2, 5.6, 5.0
    anchor(M)
    box((W + 0.4, D + 0.4, F + 0.3), (0, 0, (F - 0.3) / 2), ST, bevel=0.06)
    box((W - 0.4, D - 0.4, T - F), (0, 0, (F + T) / 2), M["inner"])
    for i in range(int((T - F) / 0.32)):  # log walls: sides along Y, back along X, crossing at the corners
        z = F + 0.17 + i * 0.32
        for s in (-1, 1): cyl(0.17, D + 0.7, (s * W / 2, 0.08, z + (0.16 if s > 0 else 0)), LOGY, rot=(PI / 2, 0, 0), verts=10)
        cyl(0.17, W + 0.7, (0, D / 2, z + 0.08), LOG, rot=(0, PI / 2, 0), verts=10)
    # The front: posts, beams, tall lit windows, a double door in the middle bay.
    fy = -D / 2; bays = 6
    for k in range(bays + 1): box((0.34, 0.34, T - F), (-W / 2 + k * W / bays, fy, (F + T) / 2), TIM, bevel=0.03)
    box((W + 0.5, 0.42, 0.42), (0, fy, T), TIM, bevel=0.04)
    box((W, 0.3, 0.22), (0, fy, F + 0.11), TIM, bevel=0.02)
    for k in range(bays):
        x0, x1 = -W / 2 + k * W / bays + 0.17, -W / 2 + (k + 1) * W / bays - 0.17; cx, w = (x0 + x1) / 2, x1 - x0
        if k == 3:
            door(W0, cx, F, w - 0.3, 2.5, M, double=True, glazed=True, y=fy)
            box((w, 0.1, T - F - 2.75), (cx, fy - 0.02, (F + 2.75 + T) / 2), WIN, kind="lit")
            box((w, 0.16, 0.14), (cx, fy - 0.06, F + 2.75), TIM)
            continue
        box((w, 0.1, T - F - 0.4), (cx, fy, (F + T) / 2), WIN, kind="lit")
        for z in (F + 2.5, F + 3.6): box((w, 0.16, 0.12), (cx, fy - 0.05, z), TIM)
        box((0.08, 0.16, T - F - 0.4), (cx, fy - 0.05, (F + T) / 2), TIM)
    # The glass gable in a timber grid, framed by raking beams.
    a = math.atan2(R, W / 2)
    tri([(-W / 2, fy + 0.05, T), (W / 2, fy + 0.05, T), (0, fy + 0.05, T + R)], WIN, kind="lit")
    for x in (-6, -4, -2, 0, 2, 4, 6):
        h = R * (1 - abs(x) / (W / 2)) - 0.1; box((0.16, 0.22, h), (x, fy - 0.04, T + h / 2), TIM)
    for z in (T + 1.6, T + 3.2):
        hw = W / 2 * (1 - (z - T) / R); box((2 * hw, 0.22, 0.14), (0, fy - 0.04, z), TIM)
    for s in (-1, 1): box((math.hypot(W / 2, R), 0.26, 0.24), (s * W / 4, fy - 0.05, T + R / 2), TIM, rot=(0, s * a, 0))
    # Roof: deep over the deck at the front, gable dormers on the sunny side.
    yt = fy - 2.2
    a, top = gable_roof(W0, W, fy - 2.5, D / 2 + 0.9, T, R, 1.5, M, thick=0.36, st=0.62, ice=24)
    for yd in (-3.0, 3.2):
        xd = 5.6; dormer(Frame((0, 0, 0), PI / 2), yd, -xd, top(xd), math.tan(a), 2.4, M, hw=2.1, drise=0.85)
    # The front truss on two log columns, purlins running back to the wall, string lights.
    under = lambda x: top(x) - 0.36 / math.cos(a) - 0.05
    truss(W0, W + 0.6, yt, T - 0.4, under(0) - 0.15 - (T - 0.4), M, r=0.34)
    for x in (-W / 4, 0, W / 4): box((0.26, 2.5, 0.3), (x, fy - 1.25, under(x) - 0.18), TIM)
    for s in (-1, 1):
        cx = s * (W / 2 - 0.1)
        box((0.8, 0.8, 0.9), (cx, yt, F + 0.45), ST, bevel=0.04); box((0.9, 0.9, 0.1), (cx, yt, F + 0.92), ST, bevel=0.02)
        cyl(0.24, T - 0.6 - F - 0.95, (cx, yt, (F + 0.95 + T - 0.6) / 2), M["logy"], verts=12)
        box((0.2, 0.2, 1.6), (cx - s * 0.55, yt, T - 1.1), TIM, rot=(0, -s * 0.75, 0))
        pad((0.8, 0.8, 0.14), (cx, yt, F + 1.02), SN)
        for i in range(14):
            u = (i + 0.5) / 14; x = s * u * (W / 2 + 0.4); z = under(x) - 0.55 - math.sin(u * PI * 3) ** 2 * 0.28
            cyl(0.065, 0.13, (x, yt + 0.25, z), LAMP, verts=8, kind="lamp")
    # The outside stone chimney on the sunny wall, and its windows.
    chimney(W / 2 + 0.95, 0.2, T + R + 1.2, M, w=1.5, d=1.9, step=F + 3.2)
    for y in (-3.4, 3.7): window(Frame((W / 2 + 0.17, y, 0), PI / 2), 0, F + 0.9, 1.5, 2.7, M, cols=2, transom=0.72)
    # The side wing: stone to the sills, boards above, its own roof and a lit gable end.
    x0, x1, y0, y1, TW, RW = -15.3, -8.0, -4.6, 3.9, 4.3, 2.5
    xc, yc, WX, WD = (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0
    box((WX, WD, TW - F), (xc, yc, (F + TW) / 2), M["boards"])
    box((WX + 0.24, WD + 0.24, F + 0.9), (xc, yc, (F + 0.9) / 2), ST, bevel=0.05)
    box((WX + 0.34, WD + 0.34, 0.12), (xc, yc, F + 0.92), TIM, bevel=0.02)
    for x, y in ((x0, y0), (x0, y1)): box((0.26, 0.26, TW - F - 0.9), (x, y, (F + 0.9 + TW) / 2), TIM)
    fw = Frame((xc, yc, 0), PI / 2)
    gable_roof(fw, WD, xc - x1, xc - x0 + 0.8, TW, RW, 0.9, M, thick=0.3, st=0.55, ice=10, ends=(False, True))
    for x in (-13.6, -11.4, -9.3): window(Frame((0, y0 - 0.12, 0)), x, F + 1.0, 1.5, 2.0, M, cols=2, transom=0)
    ge = Frame((x0 - 0.12, yc, 0), -PI / 2)
    gable_wall(ge, WD + 0.2, 0, TW, RW, M["boards"], 0.2)
    window(ge, 0, F + 1.0, 2.4, 2.0, M, cols=3, transom=0); window(ge, 0, TW + 0.35, 1.0, 1.0, M, cols=1, sill=False)
    lantern(ge, 1.8, F + 2.4, M)
    # The deck: framing, boards, railings with snow, steps, tables and parasols, lamps on the corner posts.
    dy0, dd = fy - 0.2, 4.8
    box((W + 0.6, dd, 0.3), (0, dy0 - dd / 2, F - 0.2), TIM, bevel=0.03)
    for i in range(int(dd / 0.2)): box((W + 0.5, 0.17, 0.07), (0, dy0 - 0.1 - i * 0.2, F - 0.02), DECK, bevel=0.01)
    for x in (-W / 2, -W / 6, W / 6, W / 2): box((0.3, 0.3, F), (x, dy0 - dd + 0.15, (F - 0.3) / 2), TIM)
    ry = dy0 - dd + 0.08
    for i in range(17):
        x = -W / 2 - 0.2 + i * (W + 0.4) / 16
        if abs(x + W / 2 - 2.0) > 1.2: box((0.12, 0.12, 1.0), (x, ry, F + 0.5), TIM)
    for z in (F + 0.5, F + 1.0):
        for xa, xb in ((-W / 2 - 0.2, -W / 2 + 0.8), (-W / 2 + 3.2, W / 2 + 0.2)): box((xb - xa, 0.14, 0.14), ((xa + xb) / 2, ry, z), TIM)
    for s in (-1, 1):
        for i in range(4): box((0.12, 0.12, 1.0), (s * (W / 2 + 0.2), dy0 - i * dd / 3.5, F + 0.5), TIM)
        box((0.14, dd, 0.14), (s * (W / 2 + 0.2), dy0 - dd / 2, F + 1.0), TIM)
        pad((0.24, dd, 0.14), (s * (W / 2 + 0.2), dy0 - dd / 2, F + 1.11), SN)
    for xa, xb in ((-W / 2 - 0.2, -W / 2 + 0.8), (-W / 2 + 3.2, W / 2 + 0.2)): pad((xb - xa, 0.24, 0.14), ((xa + xb) / 2, ry, F + 1.11), SN)
    for i in range(5): box((2.4, 0.4, 0.22), (-W / 2 + 2.0, ry - 0.25 - i * 0.36, F - 0.25 - i * 0.22), ST, bevel=0.03)
    for i, x in enumerate((-W * 0.3, 0, W * 0.3)): picnic((x, dy0 - 3.2, F + 0.05), DECK, SN, rot=0.08 * (i - 1))
    for x, col in ((-W * 0.15, "#8e3b32"), (W * 0.15, "#e6dac3")): parasol((x, dy0 - 3.2, F + 0.05), TIM, flat("cloth" + col, col, 0.9), SN)
    rack((W / 2 + 1.7, dy0 - 1.6, 0), TIM, SN)
    for x in (-W / 2 - 0.2, W / 2 + 0.2):
        box((0.16, 0.16, 1.6), (x, ry, F + 1.4), TIM); box((0.3, 0.3, 0.4), (x, ry, F + 2.35), LAMP, kind="lamp", bevel=0.04)
        box((0.42, 0.42, 0.06), (x, ry, F + 2.58), TIM); pad((0.4, 0.4, 0.1), (x, ry, F + 2.66), SN)
    # Firewood under a little roof, snow banked against the walls.
    END = M["end"]
    for i in range(5):
        for j in range(9): cyl(0.11, 1.0, (W / 2 + 0.75, D / 2 - 0.6 - j * 0.23 - (i % 2) * 0.11, 0.12 + i * 0.2), END, rot=(0, PI / 2, 0), verts=8)
    box((1.1, 2.6, 0.08), (W / 2 + 0.75, D / 2 - 1.6, 1.2), M["roof"]); pad((1.2, 2.7, 0.2), (W / 2 + 0.75, D / 2 - 1.6, 1.33), SN)
    drifts([(W / 2 + 0.5, 0.5, 1.4, D + 1.5), (-4, D / 2 + 0.6, W + 10, 1.6), (xc - 0.5, y0 - 0.5, WX + 1, 1.2), (x0 - 0.5, yc, 1.2, WD + 1)], M)
    # The name board over the door.
    box((4.4, 0.14, 0.8), (0, yt - 0.3, T - 0.4), TIM, bevel=0.04)
    text("SUMMIT HOUSE", 0.42, (0, yt - 0.4, T - 0.42), M["cream"])
    finalize("restaurant", 2048)

def base_lodge():
    """The base-area lodge: two storeys, stone below and boards above, a two-storey glass cross gable with a
    timber truss, an entry canopy on log columns with a blank board for the name, dormers, a stone chimney."""
    new_col("base_lodge"); M = mats(); anchor(M)
    ST, TIM, SN, WIN = M["st"], M["tim"], M["sn"], M["win"]
    W, D, B, T1, T, R = 26.0, 14.0, 0.5, 4.4, 8.2, 5.0
    fy = -D / 2
    box((W + 0.4, D + 0.4, B + 0.3), (0, 0, (B - 0.3) / 2), ST, bevel=0.05)
    box((W, D, T1 - B), (0, 0, (B + T1) / 2), ST)
    box((W - 0.1, D - 0.1, T - T1), (0, 0, (T1 + T) / 2), M["boards"])
    box((W + 0.3, D + 0.3, 0.32), (0, 0, T1), TIM, bevel=0.03)
    for x in (-W / 2, W / 2):
        for y in (-D / 2, D / 2): box((0.3, 0.3, T - T1), (x, y, (T1 + T) / 2), TIM)
    # Front flanks: storefront glass between stone piers below, pairs of windows above.
    fr = Frame((0, fy, 0))
    for s in (-1, 1):
        for x in (7.45, 10.95): window(fr, s * x, B + 0.5, 2.7, 3.0, M, cols=3, transom=0.74)
        for x in (5.75, 9.2, 12.65): fr.box((0.7, 0.3, T1 - B - 0.1), (s * x, -0.12, (B + T1) / 2), ST, bevel=0.03)
        for x in (7.2, 9.4, 11.6): window(fr, s * x, T1 + 0.9, 1.3, 1.9, M, cols=2, transom=0.7)
    # The cross gable: a glass front two storeys high in a timber grid, a truss in the gable, log columns.
    CW, CD = 11.0, 2.6; cy = fy - CD
    for s in (-1, 1):
        box((0.5, CD, T1 - B), (s * (CW / 2 - 0.25), fy - CD / 2, (B + T1) / 2), ST)
        box((0.4, CD, T - T1), (s * (CW / 2 - 0.2), fy - CD / 2, (T1 + T) / 2), M["boards"])
    box((CW, CD, 0.25), (0, fy - CD / 2, B + 0.12), ST)
    cr = CW / 2 * R / (D / 2)
    cf = Frame((0, cy, 0))
    cf.box((CW - 1.0, 0.08, T - B - 0.3), (0, 0.1, (B + 0.3 + T) / 2), WIN, kind="lit")
    cf.prism([(-CW / 2, 0.12, T), (CW / 2, 0.12, T), (0, 0.12, T + cr)], 0.05, WIN, kind="lit")
    for k in range(9):
        x = -CW / 2 + 0.5 + k * (CW - 1.0) / 8; cf.box((0.12, 0.18, T - B - 0.3), (x, 0.02, (B + 0.3 + T) / 2), TIM)
    for z in (B + 2.9, T1, T1 + 2.0): cf.box((CW - 1.0, 0.2, 0.14 if z != T1 else 0.4), (0, 0.0, z), TIM)
    truss(cf, CW, -0.15, T + 0.05, cr - 0.25, M, r=0.32)
    for x in (-CW / 2 + 0.3, CW / 2 - 0.3):
        cf.cyl(0.26, T - B - 0.2, (x, -0.2, (B + T) / 2), M["logy"], verts=12)
    ga, gtop = gable_roof(Frame((0, 0, 0)), CW, cy - 1.2, -1.0, T, cr, 0.6, M, thick=0.34, st=0.6, ice=10, ends=(True, False))
    # The main roof, ridge along X, with gable dormers on the front slope.
    ma, mtop = gable_roof(Frame((0, 0, 0), PI / 2), D, -W / 2 - 1.0, W / 2 + 1.0, T, R, 1.2, M, thick=0.36, st=0.65, ice=34)
    for x in (-9.0, 9.0): dormer(W0, x, -5.0, mtop(5.0), math.tan(ma), 2.8, M, hw=2.1, drise=0.95)
    # Gable ends with windows; a stone chimney on the east end.
    for s in (-1, 1):
        g = Frame((s * (W / 2 + 0.05), 0, 0), s * PI / 2)
        gable_wall(g, D + 0.1, 0, T, R, M["boards"], 0.2)
        for x in (-3.5, 3.5):
            if s > 0 and x < 0: continue
            window(g, x, B + 0.8, 2.2, 2.6, M, cols=2); window(g, x, T1 + 0.9, 1.4, 1.9, M)
        window(g, 0, T + 1.0, 1.6, 1.6, M, cols=2, transom=0, sill=False)
    chimney(W / 2 + 0.95, -3.4, T + R + 1.3, M, w=1.6, d=2.0, step=T1 + 0.4)
    # The entry canopy: log columns on stone piers, a beam with the name board, a small snowy gable roof.
    ey0, ey1, ew = cy, cy - 3.8, 6.4
    box((ew + 1.2, ey0 - ey1 + 0.4, B + 0.3), (0, (ey0 + ey1) / 2, (B + 0.3) / 2 - 0.0), ST, bevel=0.04)
    for i in range(3): box((ew + 1.2, 0.45, 0.2), (0, ey1 - 0.4 - i * 0.42, B + 0.1 - (i + 1) * 0.22 + 0.11), ST, bevel=0.03)
    for x in (-ew / 2, ew / 2):
        for y in (ey1 + 0.3, ey0 - 0.4):
            box((0.7, 0.7, 0.8), (x, y, B + 0.3 + 0.4), ST, bevel=0.04)
            cyl(0.2, 4.4 - B - 1.1, (x, y, (B + 1.1 + 4.4) / 2), M["logy"], verts=12)
            pad((0.66, 0.66, 0.12), (x, y, B + 1.17), SN)
    for x in (-ew / 2, ew / 2): box((0.3, ey0 - ey1, 0.4), (x, (ey0 + ey1) / 2, 4.45), TIM)
    box((ew + 0.6, 0.34, 0.5), (0, ey1 + 0.3, 4.45), TIM, bevel=0.03)
    cf2 = Frame((0, ey1 + 0.3, 0))
    truss(cf2, ew, -0.02, 4.85, 1.75, M, r=0.24)
    gable_roof(W0, ew, ey1 - 0.5, ey0, 4.7, 2.2, 0.55, M, thick=0.28, st=0.55, ice=6, ends=(True, False))
    box((4.6, 0.12, 0.75), (0, ey1 - 0.0, 4.15), M["cream"], bevel=0.03)
    for dz in (-0.42, 0.42): box((4.8, 0.16, 0.08), (0, ey1 - 0.03, 4.15 + dz), TIM)
    for dx in (-2.36, 2.36): box((0.08, 0.16, 0.92), (dx, ey1 - 0.03, 4.15), TIM)
    door(cf, -1.4, B + 0.3, 2.2, 2.5, M, double=True, glazed=True, y=-0.05)
    door(cf, 1.4, B + 0.3, 2.2, 2.5, M, double=True, glazed=True, y=-0.05)
    for x in (-ew / 2 + 0.6, ew / 2 - 0.6): box((0.3, 0.3, 0.4), (x, ey0 - 0.3, 3.9), M["lamp"], kind="lamp", bevel=0.03)
    # Racks, benches, snow banked along the walls.
    for s in (-1, 1):
        rack((s * 10.0, fy - 2.6, 0), TIM, SN, rot=PI / 2)
        bench((s * 5.6, fy - 4.3, 0), M, rot=0.0)
    drifts([(-9.5, fy - 0.6, 7, 1.1), (9.5, fy - 0.6, 7, 1.1), (0, D / 2 + 0.6, W + 2, 1.5), (-W / 2 - 0.6, 0, 1.4, D + 1), (W / 2 + 0.6, 2.4, 1.4, D * 0.6)], M)
    finalize("base_lodge", 2048)

def warming_hut():
    """A small board-and-batten warming hut: a steep snowy roof over a little porch, a stovepipe, benches."""
    new_col("warming_hut"); M = mats(); anchor(M)
    ST, TIM, SN = M["st"], M["tim"], M["sn"]
    W, D, F, T, R = 4.2, 5.0, 0.4, 2.8, 2.5
    fy = -D / 2
    box((W + 0.3, D + 0.3, F + 0.3), (0, 0, (F - 0.3) / 2), ST, bevel=0.05)
    box((W, D, T - F), (0, 0, (F + T) / 2), M["boards"])
    for s in (-1, 1):  # battens on the sides, corner boards
        for k in range(12): box((0.06, 0.05, T - F), (s * (W / 2 + 0.02), -D / 2 + 0.2 + k * (D - 0.4) / 11, (F + T) / 2), TIM)
        for y in (-D / 2, D / 2): box((0.16, 0.16, T - F + 0.05), (s * W / 2, y, (F + T) / 2), TIM)
    for y in (fy, D / 2):
        for k in range(10): box((0.05, 0.06, T - F), (-W / 2 + 0.2 + k * (W - 0.4) / 9, y + (0.02 if y > 0 else -0.02), (F + T) / 2), TIM)
        gable_wall(Frame((0, y, 0)) if y < 0 else Frame((0, y, 0), PI), W, 0, T, R, M["boards"], 0.12)
    fr = Frame((0, fy - 0.05, 0))
    door(fr, -0.9, F, 0.95, 2.05, M, lite=False)
    window(fr, 0.95, F + 1.0, 1.0, 0.9, M, cols=2, transom=0)
    lantern(fr, -0.2, F + 1.9, M)
    box((1.5, 0.08, 0.3), (0, fy - 1.5, T - 0.3), TIM, bevel=0.02)
    text("WARMING HUT", 0.15, (0, fy - 1.55, T - 0.3), M["cream"], extrude=0.01)
    window(Frame((W / 2 + 0.04, 0.6, 0), PI / 2), 0, F + 1.0, 1.1, 0.9, M, cols=2, transom=0)
    window(Frame((-W / 2 - 0.04, -0.4, 0), -PI / 2), 0, F + 1.0, 1.1, 0.9, M, cols=2, transom=0)
    # The porch: the roof runs out over it on two posts with knee braces; a deck of boards.
    py = fy - 1.5
    a, top = gable_roof(W0, W, py - 0.25, D / 2 + 0.4, T, R, 0.55, M, thick=0.24, st=0.5, ice=10)
    box((W + 0.4, 1.6, 0.14), (0, fy - 0.8, F - 0.07), M["deck"], bevel=0.02)
    for s in (-1, 1):
        x = s * (W / 2 - 0.05)
        box((0.18, 0.18, T - F), (x, py + 0.1, (F + T) / 2), TIM)
        box((0.16, 1.45, 0.2), (x, fy - 0.72, T - 0.06), TIM)
        box((0.13, 0.13, 0.8), (x, py + 0.38, T - 0.42), TIM, rot=(-0.78, 0, 0))
    box((W + 0.3, 0.2, 0.26), (0, py + 0.1, T - 0.06), TIM)
    # The stovepipe through the roof, a spark cap.
    px, pyy = 1.0, 0.8; zr = top(px)
    cyl(0.1, 2.0, (px, pyy, zr + 0.55), M["steel"], verts=12)
    cyl(0.3, 0.12, (px, pyy, zr + 0.25), M["steel"], verts=12, r2=0.13)
    cyl(0.22, 0.14, (px, pyy, zr + 1.65), M["steel"], verts=12, r2=0.05)
    cyl(0.12, 0.2, (px, pyy, zr + 1.5), M["steel"], verts=8)
    pad((0.36, 0.36, 0.1), (px, pyy, zr + 1.75), SN)
    # Benches on the porch and in the snow, firewood along the west wall.
    bench((0.95, fy - 0.45, F), M, rot=0.0, L=1.5)
    logbench((-1.0, fy - 3.4, 0), M, rot=0.15); logbench((1.6, fy - 3.0, 0), M, rot=-0.5, L=1.6)
    for i in range(5):
        for j in range(12): cyl(0.1, 0.8, (-W / 2 - 0.45, -D / 2 + 0.6 + j * 0.3 + (i % 2) * 0.1, 0.1 + i * 0.18), M["end"], rot=(0, PI / 2, 0), verts=8)
    pad((0.8, 3.6, 0.16), (-W / 2 - 0.45, -D / 2 + 2.25, 1.0), SN)
    drifts([(W / 2 + 0.6, 0.3, 1.5, D + 0.6), (0, D / 2 + 0.6, W + 1.6, 1.5)], M, h=0.55)
    finalize("warming_hut", 1024, ao_dist=1.0)

def yurt():
    """A canvas yurt on a raised timber deck: cream walls, a green roof with a clear dome at the crown,
    a timber door frame, vinyl windows, a stovepipe, railings and steps."""
    new_col("yurt"); M = mats(); anchor(M)
    TIM, SN = M["tim"], M["sn"]
    CAN, RF, TRIM = flat("canvas", "#ddd2bb", 0.9, grain=0.08), flat("roofcanvas", "#3f5a4a", 0.85, grain=0.08), flat("yurtband", "#5b4a3a", 0.8, grain=0.04)
    r, hw, H, S = 3.5, 2.2, 0.75, 9.0
    # The deck: posts, rim joists, boards, a railing round three sides and the front either side of the steps.
    for x in (-S / 2 + 0.2, 0, S / 2 - 0.2):
        for y in (-S / 2 + 0.2, 0, S / 2 - 0.2): box((0.22, 0.22, H), (x, y, H / 2 - 0.1), TIM)
    box((S, S, 0.12), (0, 0, H - 0.06), M["deck"], bevel=0.02)
    for s in (-1, 1):
        box((S + 0.1, 0.1, 0.3), (0, s * S / 2, H - 0.2), TIM); box((0.1, S + 0.1, 0.3), (s * S / 2, 0, H - 0.2), TIM)
    def rail(x0, y0, x1, y1):
        L = math.hypot(x1 - x0, y1 - y0); a = math.atan2(y1 - y0, x1 - x0); f = Frame(((x0 + x1) / 2, (y0 + y1) / 2, H), a)
        n = max(1, round(L / 1.5))
        for k in range(n + 1): f.box((0.12, 0.12, 1.0), (-L / 2 + k * L / n, 0, 0.5), TIM)
        for z in (0.5, 0.98): f.box((L, 0.1, 0.1), (0, 0, z), TIM)
        for k in range(int(L / 0.15)): f.box((0.035, 0.035, 0.46), (-L / 2 + 0.07 + k * 0.15, 0, 0.73), TIM)
        f.pad((L, 0.2, 0.12), (0, 0, 1.08), SN)
    e = S / 2 - 0.06
    rail(-e, e, e, e); rail(-e, -e, -e, e); rail(e, -e, e, e); rail(-e, -e, -0.9, -e); rail(0.9, -e, e, -e)
    for i in range(4): box((1.7, 0.36, 0.08), (0, -S / 2 - 0.2 - i * 0.32, H - 0.2 - i * 0.18), M["deck"], bevel=0.01)
    for s in (-1, 1): box((0.08, 1.45, 0.25), (s * 0.88, -S / 2 - 0.68, H / 2 - 0.12), TIM, rot=(0.5, 0, 0))
    # The yurt: canvas wall, bands, the roof cone with a valance, the crown ring and a clear dome.
    z0 = H
    cyl(r, hw, (0, 0, z0 + hw / 2), CAN, verts=40)
    for z, hh in ((z0 + 0.08, 0.16), (z0 + hw - 0.05, 0.1)): cyl(r + 0.02, hh, (0, 0, z), TRIM, verts=40)
    re, rc = r + 0.45, 0.75; rise = (re - rc) * math.tan(math.radians(29))
    cyl(re, rise, (0, 0, z0 + hw + rise / 2), RF, verts=40, r2=rc)
    cyl(re, 0.28, (0, 0, z0 + hw - 0.1), RF, verts=40, r2=re - 0.02)
    cyl(rc + 0.08, 0.18, (0, 0, z0 + hw + rise + 0.05), TRIM, verts=24)
    cyl(rc, 0.35, (0, 0, z0 + hw + rise + 0.3), glass("dome", "#cfdbe3", 0.4), verts=24, r2=0.25, kind="glass")
    # Snow on the cone, a lip at the eave, a thin crust round the crown.
    st, zb = 0.3, z0 + hw; zc = lambda q: zb + (re - q) * math.tan(math.radians(29))
    prof = [(re - 0.1, zb - 0.14), (re + 0.1, zb - 0.06), (re + 0.17, zb + 0.1), (re + 0.1, zb + st + 0.02)]
    prof += [(q, zc(q) + st) for q in (re - 0.3, re - 0.9, re - 1.6, re - 2.3, rc + 0.3)]
    prof += [(rc + 0.1, zc(rc) + st * 0.6), (rc - 0.02, zc(rc) + 0.1)]
    lathe(prof, SN, seg=48)
    # The door: a timber frame standing out of the wall with a little roof, a planked door, a lantern.
    fr = Frame((0, -r - 0.05, z0))
    fr.box((1.5, 0.5, 2.25), (0, 0.15, 1.12), TIM)
    door(fr, 0, 0, 0.95, 1.95, M, y=-0.1)
    fr.box((1.8, 0.9, 0.12), (0, -0.25, 2.35), M["roof"], rot=(0.25, 0, 0))
    fr.pad((1.7, 0.85, 0.16), (0, -0.25, 2.47), SN, rot=(0.25, 0, 0))
    lantern(fr, 0.95, 1.65, M, y=-0.1)
    # Vinyl windows round the wall, each with a rolled flap above.
    for ang in (-1.1, 1.1, 2.3, -2.3, PI):
        g = Frame((r * math.sin(ang) * 1.0, -r * math.cos(ang), z0), ang)
        window(g, 0, 0.9, 1.0, 0.9, M, cols=1, transom=0, y=-0.03)
        g.cyl(0.07, 1.2, (0, -0.1, 1.95), CAN, rot=(0, PI / 2, 0), verts=8)
    # Stovepipe, benches on the deck, snow drifted in the corners and round the base.
    cyl(0.09, 2.2, (1.6, 1.3, z0 + hw + 0.8), M["steel"], verts=10)
    cyl(0.2, 0.12, (1.6, 1.3, z0 + hw + 1.95), M["steel"], verts=10, r2=0.05)
    bench((-2.6, -S / 2 + 0.7, H), M, rot=0.0, L=1.5)
    for x, y in ((S / 2 - 0.6, S / 2 - 0.6), (-S / 2 + 0.6, S / 2 - 0.6), (S / 2 - 0.6, -S / 2 + 0.6)):
        blob((1.2, 1.2, 0.4), (x, y, H + 0.05), SN, lumps=0.06)
    drifts([(0, S / 2 + 0.4, S + 1, 1.8), (S / 2 + 0.4, 0, 1.8, S), (-S / 2 - 0.4, 0, 1.8, S)], M, h=0.55)
    finalize("yurt", 1024, ao_dist=1.0)

PICTO_BLUE = "#36506e"

def pictogram(f, x, z, kind, M, y=0.0):
    """The standard restroom plate: a blue square, a white figure (man, woman) on it."""
    WH = flat("paint_white", "#f2f2f2", 0.5, grain=0)
    f.box((0.46, 0.04, 0.46), (x, y - 0.02, z), flat("plate", PICTO_BLUE, 0.4, grain=0), bevel=0.02)
    yy = y - 0.05
    f.cyl(0.042, 0.02, (x, yy, z + 0.14), WH, rot=(PI / 2, 0, 0), verts=12, kind="flat")
    if kind == "man":
        f.box((0.13, 0.02, 0.15), (x, yy, z + 0.02), WH, kind="flat")
        for s in (-1, 1): f.box((0.045, 0.02, 0.13), (x + s * 0.035, yy, z - 0.12), WH, kind="flat"); f.box((0.03, 0.02, 0.13), (x + s * 0.085, yy, z + 0.02), WH, kind="flat", rot=(0, s * 0.12, 0))
    else:
        f.prism([(x - 0.085, yy, z - 0.07), (x + 0.085, yy, z - 0.07), (x + 0.04, yy, z + 0.09), (x - 0.04, yy, z + 0.09)], 0.02, WH, kind="flat")
        for s in (-1, 1): f.box((0.035, 0.02, 0.08), (x + s * 0.03, yy, z - 0.11), WH, kind="flat"); f.box((0.03, 0.02, 0.12), (x + s * 0.075, yy, z + 0.03), WH, kind="flat", rot=(0, s * 0.25, 0))

def restroom():
    """A restroom block: stone walls to shoulder height, boards above, a snowy gable roof, two doors with
    the standard pictogram plates, frosted high windows, lamps, a vent pipe."""
    new_col("restroom"); M = mats(); anchor(M)
    ST, TIM, SN = M["st"], M["tim"], M["sn"]
    W, D, F, T, R = 6.4, 4.4, 0.2, 3.3, 1.9
    fy = -D / 2
    box((W + 0.2, D + 0.2, 1.6), (0, 0, 0.8), ST, bevel=0.05)
    box((W, D, T - 1.6), (0, 0, (1.6 + T) / 2), M["boards"])
    box((W + 0.32, D + 0.32, 0.12), (0, 0, 1.62), TIM, bevel=0.02)
    for x in (-W / 2, W / 2):
        for y in (-D / 2, D / 2): box((0.22, 0.22, T - 1.6), (x, y, (1.6 + T) / 2), TIM)
    a, top = gable_roof(Frame((0, 0, 0), PI / 2), D, -W / 2 - 0.7, W / 2 + 0.7, T, R, 0.7, M, thick=0.26, st=0.5, ice=12)
    for s in (-1, 1):
        g = Frame((s * (W / 2 + 0.02), 0, 0), s * PI / 2)
        gable_wall(g, D, 0, T, R, M["boards"], 0.12)
        for k in range(5): g.box((0.6, 0.05, 0.06), (0, -0.05, T + 0.45 + k * 0.12), TIM, rot=(0.5, 0, 0))
        g.box((0.75, 0.06, 0.75), (0, -0.02, T + 0.7), M["steel"])
    fr = Frame((0, fy - 0.1, 0))
    fr.box((W + 1.2, 1.6, 0.2), (0, -0.7, 0.1), flat("concrete", "#9c9a96", 0.9, grain=0.1))
    for x, kind in ((-1.55, "man"), (1.55, "woman")):
        door(fr, x, F, 0.95, 2.1, M, lite=False, kick=True)
        pictogram(fr, x + (0.9 if x < 0 else -0.9), 1.28, kind, M, y=-0.02)
        lantern(fr, x + (-0.85 if x < 0 else 0.85), F + 1.95, M)
    fr.box((1.3, 0.1, 0.3), (0, -0.05, 2.05), TIM, bevel=0.02)
    text("RESTROOMS", 0.15, fr.p(0, -0.11, 2.05), M["cream"], extrude=0.01)
    FROST = glass("frost", "#dfe6ea", 0.75)
    for g, xs in ((Frame((0, D / 2 + 0.02, 0), PI), (-1.6, 1.6)), (Frame((W / 2 + 0.12, 0, 0), PI / 2), (0,)), (Frame((-W / 2 - 0.12, 0, 0), -PI / 2), (0,))):
        for x in xs:
            g.box((1.1, 0.05, 0.45), (x, -0.02, 2.3), FROST, kind="glass")
            for s in (-1, 1): g.box((0.1, 0.14, 0.55), (x + s * 0.6, -0.06, 2.3), TIM)
            for z in (2.05, 2.55): g.box((1.3, 0.14, 0.1), (x, -0.06, z), TIM)
            g.pad((1.2, 0.2, 0.08), (x, -0.1, 2.62), SN)
    cyl(0.07, 1.0, (1.2, 0.7, top(0.7) + 0.35), M["steel"], verts=10); cyl(0.12, 0.08, (1.2, 0.7, top(0.7) + 0.88), M["steel"], verts=10)
    bin_ = flat("bin", "#3f5a4a", 0.6, grain=0.04)
    cyl(0.32, 0.95, (3.9, fy - 0.6, 0.475), bin_, verts=16); cyl(0.36, 0.1, (3.9, fy - 0.6, 1.0), M["steel"], verts=16)
    pad((0.6, 0.6, 0.12), (3.9, fy - 0.6, 1.08), SN)
    drifts([(W / 2 + 0.6, 0, 1.5, D + 0.8), (-W / 2 - 0.6, 0, 1.5, D + 0.8), (0, D / 2 + 0.6, W + 1.6, 1.5)], M, h=0.55)
    finalize("restroom", 1024, ao_dist=1.0)

def ticket_office():
    """A ticket office: a little log building with three lit ticket windows and their counters under a
    timber awning, the TICKETS board on its fascia, queue ropes in front."""
    new_col("ticket_office"); M = mats(); anchor(M)
    ST, LOG, LOGY, TIM, SN = M["st"], M["log"], M["logy"], M["tim"], M["sn"]
    W, D, F, T, R = 7.6, 4.0, 0.7, 3.2, 1.7
    fy = -D / 2
    box((W + 0.3, D + 0.3, F + 0.2), (0, 0, (F - 0.2) / 2), ST, bevel=0.05)
    box((W - 0.3, D - 0.3, T - F), (0, 0, (F + T) / 2), M["inner"])
    for i in range(int((T - F) / 0.3)):
        z = F + 0.15 + i * 0.3
        for s in (-1, 1): cyl(0.15, D + 0.5, (s * W / 2, 0, z + 0.15 * (s > 0)), LOGY, rot=(PI / 2, 0, 0), verts=10)
        for s in (-1, 1): cyl(0.15, W + 0.5, (0, s * D / 2, z + 0.075), LOG, rot=(0, PI / 2, 0), verts=10)
    a, top = gable_roof(Frame((0, 0, 0), PI / 2), D, -W / 2 - 0.6, W / 2 + 0.6, T, R, 0.35, M, thick=0.26, st=0.5, ice=10)
    for s in (-1, 1): gable_wall(Frame((s * (W / 2 + 0.05), 0, 0), s * PI / 2), D, 0, T, R, M["boards"], 0.15)
    # The ticket windows: lit glass, a deep frame, a counter on brackets, a speak-through grille, a number.
    fr = Frame((0, fy - 0.15, 0))
    for k, x in enumerate((-2.4, 0, 2.4)):
        window(fr, x, 1.05, 1.4, 1.1, M, cols=1, transom=0, sill=False)
        fr.box((1.7, 0.5, 0.08), (x, -0.22, 1.06), M["deck"], bevel=0.01)
        for s in (-1, 1): fr.box((0.05, 0.35, 0.3), (x + s * 0.6, -0.17, 0.88), M["steel"], rot=(0.6, 0, 0))
        fr.cyl(0.07, 0.02, (x, -0.06, 1.55), M["steel"], rot=(PI / 2, 0, 0), verts=10)
        fr.box((0.4, 0.04, 0.12), (x, -0.07, 1.14), M["steel"])
        fr.box((0.3, 0.04, 0.3), (x - 1.0, -0.09, 1.75), M["cream"], bevel=0.015)
        text(str(k + 1), 0.22, fr.p(x - 1.0, -0.12, 1.75), flat("paint_dark", "#2b2f36", 0.6, grain=0), extrude=0.01)
        fr.pad((1.6, 0.4, 0.06), (x, -0.25, 1.12), SN)
    door(Frame((W / 2 + 0.15, 0.6, 0), PI / 2), 0, F, 0.9, 2.05, M, lite=True)
    window(Frame((-W / 2 - 0.15, 0.2, 0), -PI / 2), 0, 1.3, 1.1, 1.0, M, cols=2, transom=0)
    # The awning: a shed roof on posts with knee braces, snow on it, the board on its fascia.
    ad, az0, az1, aw = 1.7, 2.85, 2.5, W + 0.4; ay = fy - 0.15 - ad
    b = math.atan2(az0 - az1, ad); La = math.hypot(ad, az0 - az1)
    dv, nrm = Vector((0, -math.cos(b), -math.sin(b))), Vector((0, -math.sin(b), math.cos(b)))
    e0 = Vector((0, fy - 0.15, az0)); c = e0 + dv * (La / 2)
    box((aw, La, 0.14), c, M["roof"], rot=(b, 0, 0), bevel=0.02)
    sl = La - 0.5; slab((aw - 0.05, sl, 0.3), e0 + dv * (0.5 + sl / 2) + nrm * 0.2, SN, rot=(b, 0, 0))
    cyl(0.16, aw - 0.05, e0 + dv * La + nrm * 0.18, SN, rot=(0, PI / 2, 0), verts=10, kind="snow")
    for i in range(14):
        x = -aw / 2 + 0.2 + rnd.random() * (aw - 0.4); h = 0.1 + rnd.random() * 0.3
        cyl(0.035, h, e0 + dv * La + Vector((x, 0, -0.05 - h / 2)), M["ice"], verts=5, r2=0.0)
    box((aw + 0.05, 0.08, 0.26), e0 + dv * La + Vector((0, -0.02, -0.12)), TIM)
    for x in (-W / 2 + 0.25, -1.2, 1.2, W / 2 - 0.25):
        box((0.14, ad, 0.2), Vector((x, 0, 0)) + c + nrm * -0.17, TIM, rot=(b, 0, 0))
        p0, p1 = Vector((x, fy - 0.2, 1.75)), Vector((x, fy - 0.15 - ad * 0.65, az0 - ad * 0.65 * math.tan(b) - 0.2)); d = p1 - p0
        box((0.12, 0.12, d.length), (p0 + p1) / 2, TIM, rot=(math.atan2(-d.y, d.z), 0, 0))
    box((2.4, 0.08, 0.34), e0 + dv * La + Vector((0, -0.08, -0.04)), TIM, bevel=0.02)
    text("TICKETS", 0.22, e0 + dv * La + Vector((0, -0.13, -0.05)), M["cream"], extrude=0.01)
    for x in (-2.4, 0, 2.4): box((0.3, 0.2, 0.1), (x, fy - 0.9, az0 - 0.35), M["lamp"], kind="lamp")
    # Queue lanes: steel stanchions with sagging blue ropes, one lane to each window.
    ROPE = flat("rope", PICTO_BLUE, 0.6, grain=0)
    for x in (-3.6, -1.2, 1.2, 3.6):
        ys = (fy - 1.2, fy - 2.6, fy - 4.0)
        for y in ys:
            cyl(0.03, 0.95, (x, y, 0.475), M["steel"], verts=8); cyl(0.16, 0.04, (x, y, 0.02), M["steel"], verts=12)
            cyl(0.05, 0.06, (x, y, 0.97), M["steel"], verts=8)
        for y0, y1 in zip(ys, ys[1:]): curve_pipe([(x, y0, 0.9), (x, (y0 + y1) / 2, 0.68), (x, y1, 0.9)], 0.018, ROPE)
    drifts([(W / 2 + 0.6, 0.4, 1.5, D + 0.6), (-W / 2 - 0.6, 0.4, 1.5, D + 0.6), (0, D / 2 + 0.6, W + 1.6, 1.5)], M, h=0.55)
    finalize("ticket_office", 1024, ao_dist=1.0)

# ---------- furniture (also used by props.py) ----------
def picnic(at, DECK, SN, rot=0.0, STL=None):
    """A picnic table with its two benches, snow on the top and the seats."""
    f = Frame(at, rot)
    for k in (-0.3, 0, 0.3): f.box((1.9, 0.27, 0.06), (0, k, 0.76), DECK, bevel=0.01)
    for k in (-0.72, 0.72): f.box((1.9, 0.27, 0.06), (0, k, 0.45), DECK, bevel=0.01)
    for e in (-0.7, 0.7):
        for t in (-1, 1): f.box((0.09, 0.09, 1.0), (e, t * 0.38, 0.4), DECK, rot=(t * 0.55, 0, 0))
        f.box((0.09, 1.6, 0.09), (e, 0, 0.4), DECK)
    f.box((1.4, 0.09, 0.09), (0, 0, 0.2), DECK)
    f.pad((1.75, 0.78, 0.13), (0, 0, 0.84), SN)
    for k in (-0.72, 0.72): f.pad((1.7, 0.24, 0.08), (0, k, 0.51), SN)

def parasol(at, TIM, CL, SN):
    x, y, z = at; cyl(0.045, 2.7, (x, y, z + 1.35), TIM, verts=8)
    cyl(1.6, 0.6, (x, y, z + 2.55), CL, verts=10, r2=0.05); cyl(1.0, 0.32, (x, y, z + 2.76), SN, verts=10, r2=0.05, kind="snow")

BOARD_COLS = ["#3f5a4a", "#8e3b32", "#36506e", "#c9a65a", "#e6dac3", "#2b2f36"]
M_BIND = None

def rack(at, TIM, SN, rot=0.0, n=6):
    """A timber board rack with a few boards and skis leaning in it."""
    global M_BIND
    f = Frame(at, rot); M_BIND = flat("binding", "#1f2124", 0.6, grain=0)
    for s in (-1, 1): f.box((0.14, 0.14, 1.2), (0, s * 1.3, 0.6), TIM); f.box((0.8, 0.14, 0.1), (0.05, s * 1.3, 0.05), TIM)
    for zz in (0.25, 1.05): f.box((0.14, 2.7, 0.12), (0, 0, zz), TIM)
    for i, c in enumerate(BOARD_COLS[:n]):
        y = -1.05 + i * 0.42
        if i % 3 == 2:  # a pair of skis
            for d in (-0.05, 0.05): f.box((0.025, 0.08, 1.7), (0.12, y + d, 0.9), flat("board" + c, c, 0.4, grain=0), rot=(0, -0.14, 0), bevel=0.01)
        else:  # a snowboard: a waisted body with round nose and tail, black bindings
            th = -0.16; ax = Vector((math.sin(th), 0, math.cos(th))); c0 = Vector((0.12, y, 0.85)); BM = flat("board" + c, c, 0.4, grain=0)
            f.box((0.025, 0.25, 1.24), c0, BM, rot=(0, th, 0))
            for u in (-0.62, 0.62):
                o = f.cyl(0.125, 0.025, c0 + ax * u, BM, rot=(0, PI / 2 + th, 0), verts=14)
                for p in o.data.polygons: p.use_smooth = False
            for u in (-0.25, 0.25): f.box((0.08, 0.2, 0.12), c0 + ax * u + Vector((0.05, 0, 0)), M_BIND, rot=(0, th, 0))
    f.pad((0.3, 2.7, 0.12), (0, 0, 1.17), SN)

def bench(at, M, rot=0.0, L=1.8, back=True):
    """A park bench: timber slats on dark cast legs, a backrest, snow on the seat and the top rail."""
    f = Frame(at, rot); TIM, STL = M["deck"], M["steel"]
    for k in range(3): f.box((L, 0.12, 0.045), (0, -0.2 + k * 0.14, 0.45), TIM, bevel=0.008)
    for e in (-L / 2 + 0.15, L / 2 - 0.15):
        f.box((0.06, 0.5, 0.06), (e, -0.04, 0.4), STL)
        for t in (-1, 1): f.box((0.06, 0.06, 0.42), (e, -0.04 + t * 0.2, 0.2), STL, rot=(t * 0.12, 0, 0))
        if back: f.box((0.06, 0.06, 0.55), (e, 0.2, 0.7), STL, rot=(-0.2, 0, 0)); f.box((0.06, 0.4, 0.05), (e, -0.02, 0.62), STL)
    if back:
        for z in (0.68, 0.84): f.box((L, 0.035, 0.11), (0, 0.24 + (z - 0.6) * 0.2, z), TIM, rot=(-0.2, 0, 0), bevel=0.008)
        f.pad((L - 0.05, 0.1, 0.06), (0, 0.27, 0.92), M["sn"])
    f.pad((L - 0.1, 0.38, 0.1), (0, -0.06, 0.5), M["sn"])

def logbench(at, M, rot=0.0, L=2.0):
    """Half a log on two stumps."""
    f = Frame(at, rot)
    for e in (-L / 2 + 0.3, L / 2 - 0.3): f.cyl(0.2, 0.4, (e, 0, 0.2), M["end"], verts=10)
    f.cyl(0.22, L, (0, 0, 0.42), M["log"], rot=(0, PI / 2, 0), verts=10)
    f.pad((L - 0.1, 0.36, 0.12), (0, 0, 0.62), M["sn"])

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

MODELS = {"restaurant": restaurant, "firstaid": firstaid, "base_lodge": base_lodge, "warming_hut": warming_hut, "yurt": yurt,
          "restroom": restroom, "ticket_office": ticket_office}
