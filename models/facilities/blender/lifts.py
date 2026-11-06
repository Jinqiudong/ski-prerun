"""Lift carriers, towers and the rope.

Carriers hang from the rope at z = 0 (the rope runs along Blender Y); their front faces −Y, the way
up. Towers come in parts the game stacks: `tower_base` (footing; the shaft stands at z = 0.65),
`tower_shaft` (1 m, origin at its foot, stretched to the tower's height) and `tower_head` /
`tower_head_surface` (origin at the top of the shaft). The part the resort paints is kind `paint`."""
import math, random
import bmesh
from mathutils import Vector
from lib import *
import lib

# ---------- materials and parts shared by the family ----------
def flat_nor(name, hexc, key, size=0.6, rough=0.5, metal=0.6, bump=0.6):
    """A calm flat colour with a texture's relief only (tread plate)."""
    m, n, l = lib._mat(name); b = lib._bsdf(n); b.inputs["Base Color"].default_value = (*srgb(hexc), 1)
    tc = n.new("ShaderNodeTexCoord"); mp = n.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1 / size,) * 3
    l.new(tc.outputs["Object"], mp.inputs["Vector"])
    t = n.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(os.path.join(lib.TEX, f"{key}_nor_gl.jpg"), check_existing=True)
    t.image.colorspace_settings.name = "Non-Color"; t.projection = "BOX"; t.projection_blend = 0.25; l.new(mp.outputs[0], t.inputs["Vector"])
    nm = n.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = bump; l.new(t.outputs["Color"], nm.inputs["Color"]); l.new(nm.outputs[0], b.inputs["Normal"])
    b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    return m

def kit():
    """The lift palette: the resort paint (charcoal until the game recolours it), silver and galvanised
    steel, dark grips and rubber, muted blue padding. Baked parts are not metallic: the colour bake
    takes the diffuse colour, which a metal has none of."""
    return dict(
        P=flat("paint", "#3b4048", 0.45, 0.35, grain=0),
        STEEL=flat("steel", "#8d949b", 0.4, grain=0.02),
        GALV=flat("galv", "#8a9095", 0.55, grain=0.08),
        TREAD=flat_nor("tread", "#8f959a", "metal_plate", 0.5, 0.5, 0.0, 0.7),
        DARK=flat("dark", "#2a2d31", 0.5, grain=0),
        RUB=flat("rubber", "#232529", 0.85, grain=0.05),
        PAD=flat("pad", "#34445a", 0.75, grain=0.06),
        RIM=flat("rim", "#6c737a", 0.45, grain=0.02),
        SEAM=flat("seam", "#15181c", 0.85, grain=0),
        SHELL=flat("shell", "#272b31", 0.5, grain=0.03),
        SN=snow())

def crust(size, loc, mat, rot=(0, 0, 0)):
    """A light rim of snow on a rail, beam or seat back: a rounded bar, cheap in faces."""
    return box(size, loc, mat, rot, bevel=min(size) * 0.45, seg=2, kind="snow")

def rod(a, b, r, mat, verts=10, kind="bake"):
    """A straight round bar from a to b."""
    a, b = Vector(a), Vector(b); d = b - a
    o = cyl(r, d.length, (a + b) / 2, mat, verts=verts, kind=kind)
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler(); return o

def pipe(pts, r, mat, kind="bake", res=4, bres=2):
    """A bent tube through the points (smooth bends)."""
    o = curve_pipe(pts, r, mat, kind); o.data.resolution_u = res; o.data.bevel_resolution = bres; return o

def poly(pts, r, mat, kind="bake", cyclic=False, bres=1):
    """A tube along straight segments (mitred corners), open or closed."""
    cu = bpy.data.curves.new("poly", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = r; cu.bevel_resolution = bres; cu.use_fill_caps = True
    sp = cu.splines.new("POLY"); sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts): p.co = (*c, 1)
    sp.use_cyclic_u = cyclic
    o = bpy.data.objects.new("poly", cu); bpy.context.scene.collection.objects.link(o); return lib._link(o, mat, kind)

def ring(c, r, rr, mat, n=24, kind="bake"):
    """A horizontal hoop of tube around centre c."""
    return poly([(c[0] + r * math.cos(2 * math.pi * i / n), c[1] + r * math.sin(2 * math.pi * i / n), c[2]) for i in range(n)], rr, mat, kind, cyclic=True)

def sheet(rows, mat, kind="bake", smooth=True):
    """A surface through rows of points (quads between neighbouring rows)."""
    me = bpy.data.meshes.new("sheet"); bm = bmesh.new()
    V = [[bm.verts.new(p) for p in r] for r in rows]
    for i in range(len(V) - 1):
        for j in range(len(V[i]) - 1): bm.faces.new((V[i][j], V[i + 1][j], V[i + 1][j + 1], V[i][j + 1]))
    bm.to_mesh(me); bm.free(); o = bpy.data.objects.new("sheet", me); bpy.context.scene.collection.objects.link(o)
    for p in o.data.polygons: p.use_smooth = smooth
    return lib._link(o, mat, kind)

def wheel(c, r, w, K, axis="X"):
    """A sheave or running wheel: rubber liner, silver rim, hub."""
    rot = (0, math.pi / 2, 0) if axis == "X" else (math.pi / 2, 0, 0)
    cyl(r, w, c, K["RUB"], rot=rot, verts=18)
    cyl(r * 0.86, w * 1.15, c, K["RIM"], rot=rot, verts=18)
    cyl(r * 0.3, w * 1.4, c, K["STEEL"], rot=rot, verts=10)
    cyl(r * 0.12, w * 1.6, c, K["DARK"], rot=rot, verts=6)

# ---------- grips ----------
def grip_detach(K, snowcap=True):
    """A detachable grip: jaws on the rope, the body with its spring stack, the carriage with running
    wheels and the long friction plate the station tyres drive."""
    box((0.12, 0.34, 0.1), (0, 0, -0.02), K["DARK"], bevel=0.02)
    box((0.2, 0.56, 0.18), (0.07, 0, -0.16), K["STEEL"], bevel=0.035, seg=2)
    cyl(0.06, 0.5, (0.07, 0, -0.27), K["DARK"], rot=(math.pi / 2, 0, 0), verts=12)
    box((0.04, 0.82, 0.17), (0.24, 0, -0.12), K["STEEL"], bevel=0.015)  # friction plate
    for y in (-0.26, 0.26): wheel((0.15, y, 0.0), 0.075, 0.045, K)
    box((0.08, 0.7, 0.05), (0.17, 0, -0.03), K["DARK"])  # carriage beam
    for y in (-0.2, 0.0, 0.2): cyl(0.022, 0.06, (0.07, y, -0.06), K["STEEL"], verts=6)  # bolts
    cyl(0.055, 0.28, (0, 0, -0.3), K["DARK"], rot=(0, math.pi / 2, 0), verts=12)  # hanger pivot
    if snowcap: crust((0.16, 0.44, 0.05), (0.1, 0, -0.05), K["SN"])

def grip_fixed(K):
    """A fixed grip: a compact clamp with its bolts and the hanger pivot."""
    box((0.11, 0.3, 0.1), (0, 0, -0.02), K["DARK"], bevel=0.02)
    box((0.15, 0.24, 0.14), (0.04, 0, -0.13), K["STEEL"], bevel=0.025)
    for y in (-0.08, 0.08): cyl(0.025, 0.24, (0.04, y, -0.1), K["DARK"], rot=(0, math.pi / 2, 0), verts=6)
    cyl(0.04, 0.2, (0, 0, -0.22), K["DARK"], rot=(0, math.pi / 2, 0), verts=10)

# ---------- chairs ----------
def _groups(n): return [3] if n == 3 else [2] * (n // 2)

def _bar_and_footrests(K, W, zs, groups, r=0.028):
    """The restraint bar, lowered: arms from pivots above the backrest, the lap bar, and a footrest
    hung from it for each pair of riders."""
    P = K["P"]; xa = W / 2 + 0.09
    for s in (-1, 1):
        pipe([(s * xa, 0.36, zs + 0.74), (s * xa, -0.2, zs + 0.7), (s * xa, -0.46, zs + 0.5), (s * xa, -0.52, zs + 0.3)], r, P, "paint")
        cyl(0.05, 0.08, (s * (xa - 0.03), 0.36, zs + 0.74), K["DARK"], rot=(0, math.pi / 2, 0), verts=12)  # pivot hub
    rod((-xa, -0.52, zs + 0.3), (xa, -0.52, zs + 0.3), r, P, kind="paint")
    x = -W / 2
    for g in groups:
        gw = g * (W / sum(groups)); xc = x + gw / 2; x += gw
        pipe([(xc, -0.52, zs + 0.3), (xc, -0.57, zs - 0.05), (xc, -0.6, zs - 0.38)], r * 0.9, P, "paint")
        box((gw - 0.12, 0.11, 0.045), (xc, -0.62, zs - 0.4), K["RUB"], bevel=0.015)
        rod((xc - gw / 2 + 0.06, -0.6, zs - 0.43), (xc + gw / 2 - 0.06, -0.6, zs - 0.43), 0.018, P, kind="paint")
        for e in (-1, 1): rod((xc + e * (gw / 2 - 0.06), -0.6, zs - 0.43), (xc + e * (gw / 2 - 0.04), -0.63, zs - 0.3), 0.016, P, kind="paint")

def _padded_seats(K, n, sw, zs, back=0.56, thick=0.1):
    """One cushion per rider on a moulded shell, seat and back, a stitched seam on each."""
    W = n * sw
    box((W + 0.02, 0.56, 0.05), (0, -0.06, zs - 0.04), K["SHELL"], bevel=0.02)
    box((W + 0.02, 0.05, back + 0.08), (0, 0.33, zs + 0.38), K["SHELL"], rot=(-0.2, 0, 0), bevel=0.02)
    for i in range(n):
        x = -W / 2 + sw * (i + 0.5)
        box((sw - 0.035, 0.5, thick), (x, -0.08, zs + 0.04), K["PAD"], rot=(-0.07, 0, 0), bevel=thick * 0.4, seg=3)
        box((sw - 0.035, 0.09, back), (x, 0.27, zs + 0.38), K["PAD"], rot=(-0.2, 0, 0), bevel=0.035, seg=3)
        box((sw - 0.09, 0.096, 0.012), (x, 0.268, zs + 0.42), K["SEAM"], rot=(-0.2, 0, 0))
        box((sw - 0.09, 0.012, thick + 0.006), (x, -0.32, zs + 0.025), K["SEAM"], rot=(-0.07, 0, 0))

def _chair_frame(K, W, zs, inner):
    """The seat carrier in resort paint: the back tube, the side frames that make the armrests, the
    rails under the seat."""
    P = K["P"]; xs = W / 2 + 0.04
    rod((-xs, 0.42, zs + 0.32), (xs, 0.42, zs + 0.32), 0.04, P, kind="paint")
    for s in (-1, 1):
        pipe([(s * xs, 0.42, zs + 0.32), (s * xs, 0.3, zs + 0.26), (s * xs, -0.28, zs + 0.26), (s * xs, -0.34, zs - 0.02), (s * xs, -0.2, zs - 0.08)], 0.03, P, "paint")
        rod((s * xs, 0.42, zs + 0.32), (s * (xs + 0.05), 0.36, zs + 0.74), 0.03, P, kind="paint")  # bar pivot post
        box((0.085, 0.46, 0.06), (s * xs, -0.03, zs + 0.3), K["PAD"], bevel=0.02)
    for x in inner: pipe([(x, 0.42, zs + 0.32), (x, 0.3, zs - 0.08), (x, -0.32, zs - 0.09)], 0.026, P, "paint")

def _bubble(K, W, zs):
    """The weather bubble, closed: a tinted blue-grey shell from above the heads down to the footrests,
    rounded at the ends, in a dark rubber rim, held by two arms from the bar pivots."""
    GL = glass("bubble", "#566b80", 0.42)
    y0, z0, R = -0.02, zs + 0.12, 0.98
    prof = [(-0.3 + 2.45 * j / 16) for j in range(17)]
    P = lambda a, s: (y0 - R * s * math.sin(a), z0 + R * s * math.cos(a))
    Wb, re, nend, pmax = W + 0.2, 0.2, 4, 0.95
    xs = []  # (x, scale) across the bubble
    for k in range(nend + 1): ph = pmax * (1 - k / nend); xs.append((-(Wb / 2 - re + re * math.sin(ph)), math.cos(ph)))
    xs += [(-x, s) for x, s in reversed(xs)]
    rows = [[(x, *P(a, s)) for a in prof] for x, s in xs]
    sheet(rows, GL, "glass")
    loop = [r[-1] for r in rows] + list(reversed(rows[-1][:-1])) + [r[0] for r in reversed(rows[:-1])] + rows[0][1:-1]
    poly(loop, 0.022, K["DARK"], cyclic=True)
    for s in (-1, 1):
        mid = rows[0 if s < 0 else -1][8]
        pipe([(s * (W / 2 + 0.11), 0.36, zs + 0.74), (s * (W / 2 + 0.14), 0.1, zs + 0.72), mid], 0.026, K["P"], "paint")

def _chair_detach(name, n, bubble=False, L=None):
    """A detachable chair: grip and carriage, a C hanger (a Y for six and eight), padded seats, the
    restraint bar with footrests, and the bubble if it has one."""
    new_col(name); K = kit()
    sw = 0.62; W = n * sw; L = L or {4: 2.5, 6: 2.7, 8: 2.85}[n]; zs = -L
    grip_detach(K)
    top = [(0, 0, -0.3), (0, 0.02, -0.8), (0, 0.38, zs + 1.3), (0, 0.5, zs + 0.95)]
    if n <= 4: pipe(top + [(0, 0.46, zs + 0.6), (0, 0.42, zs + 0.32)], 0.05, K["P"], "paint")
    else:
        pipe(top + [(0, 0.5, zs + 0.88)], 0.055, K["P"], "paint")
        for s in (-1, 1): pipe([(0, 0.5, zs + 0.88), (s * W * 0.14, 0.47, zs + 0.62), (s * W / 4, 0.42, zs + 0.32)], 0.045, K["P"], "paint")
        box((0.16, 0.12, 0.14), (0, 0.5, zs + 0.88), K["P"], bevel=0.03, kind="paint")
    groups = _groups(n)
    inner = []; x = -W / 2
    for g in groups[:-1]: x += g * sw; inner.append(x)
    _chair_frame(K, W, zs, inner)
    _padded_seats(K, n, sw, zs)
    _bar_and_footrests(K, W, zs, groups)
    if bubble: _bubble(K, W, zs)
    crust((W, 0.08, 0.04), (0, 0.4, zs + 0.7), K["SN"])
    finalize(name, 512, ao_dist=0.4)

def chair4(): _chair_detach("chair4", 4)
def chair6(): _chair_detach("chair6", 6)
def chair6_bubble(): _chair_detach("chair6_bubble", 6, bubble=True, L=2.95)
def chair8_bubble(): _chair_detach("chair8_bubble", 8, bubble=True, L=3.1)

def _chair_fixed(name, n, padded=False):
    """A fixed-grip chair: a light tube hanger arching behind the heads, a slim side frame, wooden slats
    (or thin pads), a light bar and footrests."""
    new_col(name); K = kit(); P = K["P"]
    sw = 0.56; W = n * sw; zs = -2.2; xs = W / 2 + 0.03
    grip_fixed(K)
    pipe([(0, 0, -0.22), (0, 0, -0.7), (0, 0.3, -1.05), (0, 0.44, zs + 1.0), (0, 0.44, zs + 0.92)], 0.042, P, "paint")
    rod((-xs, 0.44, zs + 0.92), (xs, 0.44, zs + 0.92), 0.034, P, kind="paint")  # the top yoke
    for s in (-1, 1):
        poly([(s * xs, 0.44, zs + 0.92), (s * xs, 0.36, zs + 0.3), (s * xs, 0.22, zs - 0.04), (s * xs, -0.36, zs - 0.04)], 0.026, P, "paint")
        pipe([(s * xs, 0.38, zs + 0.38), (s * xs, 0.3, zs + 0.27), (s * xs, -0.3, zs + 0.27), (s * xs, -0.36, zs + 0.0)], 0.022, P, "paint")
        rod((s * xs, 0.4, zs + 0.6), (s * (xs + 0.06), 0.36, zs + 0.74), 0.022, P, kind="paint")
    for z, y in ((zs + 0.3, 0.36), (zs - 0.04, 0.22), (zs - 0.04, -0.3)): rod((-xs, y, z), (xs, y, z), 0.022, P, kind="paint")
    if padded: _padded_seats(K, n, sw, zs, back=0.5, thick=0.07)
    else:
        SL = textured("slat", "fine_grained_wood", 0.9, (1.45, 1.18, 0.92), 0.75, "X", bump=0.5)
        for i in range(4): box((W - 0.02, 0.1, 0.035), (0, 0.13 - i * 0.135, zs + i * 0.008), SL, bevel=0.012)
        for i in range(3): box((W - 0.02, 0.035, 0.11), (0, 0.33 - i * 0.025, zs + 0.2 + i * 0.16), SL, rot=(-0.15, 0, 0), bevel=0.012)
        for x in [-W / 2 + sw * (i + 0.5) for i in range(n)]:
            for y in (0.13, -0.275): cyl(0.012, 0.01, (x, y, zs + 0.02 + (0.024 if y < 0 else 0)), K["DARK"], verts=6)  # bolt heads
    _bar_and_footrests(K, W, zs, _groups(n), r=0.022)
    crust((W, 0.07, 0.035), (0, 0.44, zs + 0.95), K["SN"])
    finalize(name, 512, ao_dist=0.4)

def chair2(): _chair_fixed("chair2", 2)
def chair3(): _chair_fixed("chair3", 3)
def chair4_fixed(): _chair_fixed("chair4_fixed", 4, padded=True)

# ---------- cabins ----------
def _cabin(name, w, d, h, num="12"):
    """A gondola cabin: a rounded graphite pod with a band of smoked glass, silver trim, benches inside,
    the hanger arm and grip above."""
    new_col(name); sy = d / 1.7
    PAINT, TRIM, DARK, SEAT = flat("graphite", "#2c3138", 0.35, 0.3, grain=0.02), flat("silver", "#b8bec6", 0.3, 0.8, grain=0), flat("dark", "#1c1f23", 0.5, 0.4, grain=0), flat("seat", "#3d4652", 0.6, grain=0.04)
    GL = glass("cabin_glass", "#2a3542", 0.45)
    top = -1.15
    # The pod: a box rounded hard and smoothed, then painted in bands by height.
    me = bpy.data.meshes.new("pod"); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts); bmesh.ops.translate(bm, vec=(0, 0, top - h / 2), verts=bm.verts)
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.42 * min(w, d) / 1.7, segments=6, affect="EDGES", profile=0.55)
    bm.to_mesh(me); bm.free(); pod = bpy.data.objects.new("pod", me); bpy.context.scene.collection.objects.link(pod)
    sub = pod.modifiers.new("s", "SUBSURF"); sub.levels = 2
    select_only([pod]); bpy.ops.object.convert(target="MESH")
    for m in (PAINT, TRIM, GL): pod.data.materials.append(m)
    g0, g1 = top - h + 0.95, top - 0.32
    for p in pod.data.polygons:
        z = p.center.z; p.use_smooth = True
        p.material_index = 2 if g0 < z < g1 else 1 if (g0 - 0.07 < z <= g0 or g1 <= z < g1 + 0.06) else 0
    for c in pod.users_collection: c.objects.unlink(pod)
    lib.COL.objects.link(pod); pod["kind"] = "bake"
    # Split the glass off into its own mesh.
    select_only([pod]); bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="DESELECT")
    pod.active_material_index = 2; bpy.ops.object.material_slot_select(); bpy.ops.mesh.separate(type="SELECTED"); bpy.ops.object.mode_set(mode="OBJECT")
    gl = [o for o in lib.COL.objects if o is not pod and o.name.startswith("pod")][0]; gl["kind"] = "glass"
    gl.data.materials.clear(); gl.data.materials.append(GL)
    pod.data.materials.pop(index=2)
    # Pillars between the panes, a door seam, a skid under the floor.
    for sx in (-1, 1):
        for y in (-0.3 * sy, 0.3 * sy): box((0.05, 0.07, g1 - g0), (sx * (w / 2 - 0.005), y, (g0 + g1) / 2), PAINT)
    for s in (-1, 1): box((0.06, 0.05, g1 - g0), (0, s * (d / 2 - 0.005), (g0 + g1) / 2), PAINT)
    if w > 2.1:
        for s in (-1, 1):
            for x in (-w / 4, w / 4): box((0.05, 0.05, g1 - g0), (x, s * (d / 2 - 0.01), (g0 + g1) / 2), PAINT)
    box((0.03, 0.04, h - 0.5), (0.0, -d / 2 - 0.0, top - h / 2), DARK)
    box((w * 0.7, d * 0.55, 0.1), (0, 0, top - h - 0.03), DARK, bevel=0.03)
    # Inside: a bench each side and the floor.
    for s in (-1, 1):
        box((w - 0.5, 0.42, 0.1), (0, s * (d / 2 - 0.35), top - h + 0.55), SEAT, bevel=0.03)
        box((w - 0.5, 0.1, 0.45), (0, s * (d / 2 - 0.16), top - h + 0.85), SEAT, bevel=0.03)
    box((w - 0.4, d - 0.4, 0.04), (0, 0, top - h + 0.12), DARK)
    # Roof fairing, hanger, grip with its wheels.
    box((w * 0.55, d * 0.5, 0.18), (0, 0, top + 0.02), TRIM, bevel=0.07)
    curve_pipe([(0, 0, -0.1), (0, 0, -0.45), (0, 0.2, -0.85), (0, 0.15, top + 0.08)], 0.065, TRIM)
    box((0.34, 0.5, 0.3), (0, 0, -0.02), DARK, bevel=0.05)
    for y in (-0.16, 0.16): cyl(0.1, 0.06, (0.2, y, 0.05), DARK, rot=(0, math.pi / 2, 0), verts=14)
    # Ski and board holders on the outside of the doors.
    for sx in (-1, 1):
        for y in (-0.35 * sy, 0.35 * sy): box((0.06, 0.07, 0.75), (sx * (w / 2 + 0.06), y, top - h * 0.55), TRIM)
    text(num, 0.2, (w / 2 + 0.03, 0.62 * sy, top - h + 0.6), flat("paint_white", "#f2f2f2", 0.5, grain=0), rot=(math.pi / 2, 0, math.pi / 2), extrude=0.005)
    finalize(name, 1024, ao_dist=0.5)

def gondola(): _cabin("gondola", 1.95, 1.7, 2.1)           # eight seats
def gondola6(): _cabin("gondola6", 1.7, 1.5, 2.0, "6")      # six seats, a compact cabin
def gondola10(): _cabin("gondola10", 2.3, 1.95, 2.2, "21")  # ten seats

def cabriolet():
    """Winter Park's Village Cabriolet: a round open cabin for standing riders. A graphite tub, waist
    wall with a rail on top, open above between slim posts, a centre pole, a blue roof, the hanger and grip."""
    new_col("cabriolet"); K = kit()
    TUB, TRIM, ROOF = flat("graphite", "#2c3138", 0.35, 0.3, grain=0.02), flat("silver", "#b8bec6", 0.3, 0.8, grain=0), flat("roof_blue", "#36506e", 0.45, 0.2, grain=0.03)
    r, zf, H = 1.0, -3.55, 2.15
    cyl(r, 0.34, (0, 0, zf - 0.17), TUB, verts=32, bevel=0.03)
    cyl(r * 0.98, 0.16, (0, 0, zf - 0.42), TUB, verts=32, r2=r * 0.7)
    ring((0, 0, zf), r + 0.01, 0.025, TRIM, n=32)
    ring((0, 0, zf - 0.34), r + 0.005, 0.02, TRIM, n=32)
    cyl(r - 0.05, 0.02, (0, 0, zf + 0.005), flat_nor("floor", "#4a4f55", "metal_plate", 0.4, 0.6, 0.5, 0.6), verts=32)
    # A waist-high wall all round but the door bay, a padded rail on top, six slim posts up to the roof.
    ang = lambda k: 2 * math.pi * k / 12; a0, a1 = ang(10.5), ang(10.5) + ang(10.2)
    arcpts = lambda rr, z: [(rr * math.cos(a0 + (a1 - a0) * t / 30), rr * math.sin(a0 + (a1 - a0) * t / 30), z) for t in range(31)]
    for rr in (r, r - 0.04): sheet([arcpts(rr, zf), arcpts(rr, zf + 1.0)], TUB)
    for rr, z in ((r - 0.02, zf + 1.02), (r + 0.005, zf + 0.5)): poly(arcpts(rr, z), 0.03 if z > zf + 0.9 else 0.012, TRIM)
    for a in (a0, a1): x, y = (r - 0.02) * math.cos(a), (r - 0.02) * math.sin(a); rod((x, y, zf), (x, y, zf + H), 0.035, TRIM, verts=10)
    for k in range(6):
        a = a0 + (a1 - a0) * (k + 0.5) / 6; x, y = (r - 0.02) * math.cos(a), (r - 0.02) * math.sin(a)
        rod((x, y, zf + 1.0), (x, y, zf + H), 0.026, TRIM, verts=8)
    poly(arcpts(r - 0.02, zf + 1.55), 0.018, TRIM)
    rod((0, 0, zf), (0, 0, zf + H), 0.045, TRIM, verts=12)  # the centre pole
    ring((0, 0, zf + 1.1), 0.05, 0.02, K["RUB"], n=10)
    # Roof: a shallow cone with a rolled rim, a cap, a little snow.
    cyl(r + 0.12, 0.3, (0, 0, zf + H + 0.15), ROOF, verts=32, r2=0.45)
    ring((0, 0, zf + H), r + 0.12, 0.04, TRIM, n=32)
    cyl(0.45, 0.12, (0, 0, zf + H + 0.36), TRIM, verts=20, bevel=0.03)
    cyl(0.75, 0.06, (0, 0, zf + H + 0.31), K["SN"], verts=24, r2=0.4, kind="snow")
    # The hanger and grip.
    curve_pipe([(0, 0, -0.1), (0, 0, -0.45), (0, 0.2, -0.85), (0, 0.12, zf + H + 0.4)], 0.065, TRIM)
    box((0.34, 0.5, 0.3), (0, 0, -0.02), K["DARK"], bevel=0.05)
    for y in (-0.16, 0.16): cyl(0.1, 0.06, (0.2, y, 0.05), K["DARK"], rot=(0, math.pi / 2, 0), verts=14)
    finalize("cabriolet", 512, ao_dist=0.5)

# ---------- towers ----------
SHAFT_R = (0.42, 0.36)  # tube radius at the foot and at the top of the 1 m shaft piece
LADDER_Y = -0.64

def tower_shaft():
    """A tapered tube tower, 1 m tall from its foot: the game stretches it to the tower's height. The
    ladder rails and the fall-arrest rail run up the downhill side."""
    new_col("tower_shaft"); K = kit()
    cyl(SHAFT_R[0], 1.0, (0, 0, 0.5), K["P"], verts=24, r2=SHAFT_R[1], kind="paint")
    for x in (-0.22, 0.22): box((0.06, 0.02, 1.0), (x, LADDER_Y, 0.5), K["GALV"])
    box((0.012, 0.012, 1.0), (0, LADDER_Y + 0.02, 0.5), K["STEEL"])
    finalize("tower_shaft", 256, ao_dist=0.3, samples=16)

def _ladder(K, z0, z1, top=None):
    for x in (-0.22, 0.22):
        box((0.066, 0.026, z1 - z0), (x, LADDER_Y, (z0 + z1) / 2), K["GALV"])
        if top: pipe([(x, LADDER_Y, z1), (x, LADDER_Y, top - 0.15), (x, LADDER_Y + 0.12, top), (x, LADDER_Y + 0.3, top - 0.2)], 0.018, K["GALV"])
    z = z0 + 0.15
    while z < z1: rod((-0.22, LADDER_Y, z), (0.22, LADDER_Y, z), 0.014, K["GALV"], verts=6); z += 0.3
    box((0.016, 0.016, z1 - z0), (0, LADDER_Y + 0.02, (z0 + z1) / 2), K["STEEL"])

def _train(K, x, z, n=6, r=0.21, sp=0.5):
    """A sheave train: wheels in pairs on rockers, the rockers on a main beam on a yoke, catcher plates.
    Returns the height of the rope's centre."""
    pitch = [((i // 2) - (n // 2 - 1) / 2) * (2 * sp + 0.2) + ((i % 2) - 0.5) * sp for i in range(n)]
    L = max(pitch) - min(pitch) + 2 * r
    box((0.3, 0.32, 0.32), (x, 0, z - 0.28), K["GALV"], bevel=0.03)  # yoke
    cyl(0.07, 0.42, (x, 0, z - 0.2), K["DARK"], rot=(0, math.pi / 2, 0), verts=12)
    for s in (-1, 1): box((0.03, L * 0.86, 0.15), (x + s * 0.1, 0, z - 0.06), K["GALV"], bevel=0.01)
    for i in range(n // 2):
        yc = (pitch[2 * i] + pitch[2 * i + 1]) / 2
        for s in (-1, 1): box((0.03, sp + 0.24, 0.12), (x + s * 0.075, yc, z + 0.08), K["GALV"], bevel=0.01)
        cyl(0.035, 0.24, (x, yc, z + 0.03), K["DARK"], rot=(0, math.pi / 2, 0), verts=8)
    for y in pitch: wheel((x, y, z + 0.14), r, 0.08, K)
    rz = z + 0.14 + r + 0.025
    out = 1 if x >= 0 else -1  # rope catchers: a hooked plate outside the wheels, a low guide inside
    for y in (-L / 2 + 0.12, L / 2 - 0.12):
        box((0.025, 0.2, 0.26), (x + out * 0.19, y, rz - 0.06), K["GALV"], bevel=0.008)
        box((0.09, 0.2, 0.025), (x + out * 0.155, y, rz + 0.07), K["GALV"])
    for y in (-L * 0.22, L * 0.22): box((0.42, 0.04, 0.05), (x, y, rz - 0.24), K["GALV"])
    return rz

def tower_head():
    """The top of a support tower for a 5.6 m gauge: the mast top on a bolted flange, the crossarm with
    braces and gussets, a six-wheel sheave train at each end, a railed catwalk on the downhill side, the ladder
    coming up through a hatch, a number plate, a lightning rod. Origin at the top of the shaft; the
    ropes sit at x = ±2.8, z = 1.845."""
    new_col("tower_head"); K = kit(); P, SN = K["P"], K["SN"]
    xr = 2.8; za = 0.85  # rope x, crossarm centre height
    cyl(SHAFT_R[1] + 0.01, 1.0, (0, 0, 0.3), P, verts=24, kind="paint")
    cyl(SHAFT_R[1] + 0.08, 0.05, (0, 0, -0.02), K["GALV"], verts=24)
    for k in range(12): a = 2 * math.pi * k / 12; cyl(0.022, 0.09, ((SHAFT_R[1] + 0.05) * math.cos(a), (SHAFT_R[1] + 0.05) * math.sin(a), -0.02), K["DARK"], verts=6)
    box((2 * xr + 0.5, 0.42, 0.42), (0, 0, za), P, bevel=0.03, kind="paint")
    for s in (-1, 1):
        rod((s * 0.3, 0, -0.55), (s * 1.9, 0, za - 0.2), 0.065, P, kind="paint")
        tri([(s * 0.36, -0.01, za - 0.21), (s * 1.3, -0.01, za - 0.21), (s * 0.36, -0.01, -0.3)], P, kind="paint", thick=0.02)
        box((0.36, 0.45, 0.06), (s * xr, 0, za + 0.24), K["GALV"])
    cyl(0.4, 0.06, (0, 0, za + 0.24), K["GALV"], verts=16)
    rz = 0
    for s in (-1, 1): rz = _train(K, s * xr, za + 0.62)
    # The catwalk on the downhill side: tread plate on brackets, a toe board, posts with top and mid
    # rails, a hatch where the ladder comes through.
    sy, wd, zc = -1, 0.7, za - 0.22; yc, ye = sy * (0.21 + wd / 2), sy * (0.21 + wd)
    for x0, x1 in ((-xr - 0.45, -0.32), (0.32, xr + 0.45)):
        box((x1 - x0, wd, 0.04), ((x0 + x1) / 2, yc, zc), K["TREAD"])
        crust((x1 - x0 - 0.1, wd - 0.14, 0.06), ((x0 + x1) / 2, yc, zc + 0.04), SN)
    box((0.64, 0.18, 0.04), (0, sy * 0.3, zc), K["TREAD"])
    box((2 * xr + 0.9, 0.02, 0.1), (0, ye, zc + 0.07), K["GALV"])
    for i in range(7):
        x = -xr - 0.42 + i * (2 * xr + 0.84) / 6
        rod((x, ye, zc), (x, ye, zc + 1.05), 0.024, K["GALV"], verts=8)
        box((0.05, wd, 0.06), (x, yc, zc - 0.05), K["GALV"])  # brackets
    for z in (zc + 0.55, zc + 1.05): rod((-xr - 0.42, ye, z), (xr + 0.42, ye, z), 0.024, K["GALV"], verts=8)
    crust((2 * xr + 0.8, 0.07, 0.05), (0, ye, zc + 1.09), SN)
    for s in (-1, 1):
        for z in (zc + 0.55, zc + 1.05): rod((s * (xr + 0.42), ye, z), (s * (xr + 0.42), sy * 0.21, z), 0.022, K["GALV"], verts=8)
        rod((s * (xr + 0.42), sy * 0.21, zc), (s * (xr + 0.42), sy * 0.21, zc + 1.05), 0.024, K["GALV"], verts=8)
    _ladder(K, -1.6, za - 0.2, top=za + 0.75)
    for z in (-1.2, -0.3): box((0.5, 0.26, 0.04), (0, LADDER_Y + 0.15, z), K["GALV"])
    # Lightning rod, number plate, snow on the arm.
    rod((0, 0, za + 0.27), (0, 0, rz + 1.6), 0.016, K["STEEL"], verts=6)
    cyl(0.05, 0.12, (0, 0, za + 0.33), K["DARK"], verts=8)
    box((0.42, 0.02, 0.32), (0.9, -0.22, za), flat("plate_cream", "#ece2cd", 0.6, grain=0))
    text("12", 0.2, (0.9, -0.235, za - 0.01), flat("plate_ink", "#1f2a36", 0.6, grain=0), extrude=0.004)
    for s in (-1, 1): crust((xr - 0.55, 0.42, 0.1), (s * (xr / 2 + 0.05), 0, za + 0.24), SN)
    print("tower_head rope z", rz)
    finalize("tower_head", 1024, ao_dist=0.6)

def tower_head_surface():
    """The top of a surface-lift tower (T-bar, platter): a slim mast, one arm out to the uphill track
    with a four-wheel sheave train, a brace, step pegs, a lightning rod. Origin at the top of the shaft
    (scale the shaft to r ≈ 0.2); the rope sits at x = 1.4, z = 1.195."""
    new_col("tower_head_surface"); K = kit(); P, SN = K["P"], K["SN"]
    xr, za = 1.4, 0.45
    cyl(0.2, 0.9, (0, 0, 0.2), P, verts=18, kind="paint")
    cyl(0.25, 0.04, (0, 0, -0.02), K["GALV"], verts=18)
    box((xr + 0.45, 0.22, 0.24), ((xr + 0.45) / 2 - 0.05, 0, za), P, bevel=0.02, kind="paint")
    rod((0.15, 0, -0.7), (1.0, 0, za - 0.1), 0.045, P, kind="paint")
    rz = _train(K, xr, za + 0.42, n=4, r=0.16, sp=0.38)
    for k in range(4): z = -1.4 + k * 0.35; rod((0, 0, z), ((-0.32 if k % 2 else 0.32), -0.08, z), 0.016, K["GALV"], verts=6)
    rod((0, 0, 0.65), (0, 0, rz + 1.0), 0.014, K["STEEL"], verts=6)
    cyl(0.21, 0.04, (0, 0, 0.66), K["GALV"], verts=18)
    crust((xr + 0.2, 0.22, 0.07), ((xr + 0.2) / 2 - 0.05, 0, za + 0.14), SN)
    crust((0.38, 0.38, 0.08), (0, 0, 0.7), SN)
    print("tower_head_surface rope z", rz)
    finalize("tower_head_surface", 512, ao_dist=0.5)

def tower_base():
    """A tower's concrete footing: chamfered pier, the base plate with sixteen anchor bolts, gussets
    round the foot of the tube, snow on the ledge and drifted against it. The shaft stands at z = 0.65."""
    new_col("tower_base"); K = kit(); SN = K["SN"]
    CON = flat("concrete", "#a39f98", 0.92, grain=0.12)
    box((1.9, 1.9, 1.0), (0, 0, 0.1), CON, bevel=0.08, seg=1)
    box((1.6, 1.6, 0.1), (0, 0, 0.6), CON, bevel=0.04, seg=1)
    cyl(0.64, 0.05, (0, 0, 0.675), K["GALV"], verts=32)
    for k in range(16):
        a = 2 * math.pi * (k + 0.5) / 16; x, y = 0.55 * math.cos(a), 0.55 * math.sin(a)
        cyl(0.022, 0.16, (x, y, 0.74), K["STEEL"], verts=6)
        cyl(0.042, 0.04, (x, y, 0.72), K["DARK"], verts=6)
    for k in range(8):
        o = tri([(SHAFT_R[0], -0.012, 0.7), (0.6, -0.012, 0.7), (SHAFT_R[0], -0.012, 0.98)], K["GALV"], thick=0.024)
        o.rotation_euler = (0, 0, 2 * math.pi * k / 8)
    cyl(SHAFT_R[0] + 0.005, 0.35, (0, 0, 0.85), K["P"], verts=24, kind="paint")
    for s in (-1, 1):
        crust((1.45, 0.24, 0.08), (0, s * 0.68, 0.69), SN)
        crust((0.24, 0.95, 0.08), (s * 0.68, 0, 0.69), SN)
    blob((2.6, 0.9, 0.7), (0.1, 1.15, -0.05), SN, lumps=0.08)
    blob((0.9, 2.2, 0.55), (-1.15, 0.2, -0.05), SN, lumps=0.08)
    finalize("tower_base", 512, ao_dist=0.6)

# ---------- surface lifts ----------
def _small_grip(K):
    box((0.1, 0.28, 0.09), (0, 0, -0.02), K["DARK"], bevel=0.02)
    box((0.13, 0.2, 0.12), (0.03, 0, -0.12), K["STEEL"], bevel=0.02)
    cyl(0.03, 0.16, (0.03, 0, -0.18), K["DARK"], rot=(0, math.pi / 2, 0), verts=8)

def tbar():
    """A T-bar carrier: the grip, the spring box that reels the cord in, the cord, the T with its
    rubber-sleeved crossbar for two riders."""
    new_col("tbar"); K = kit()
    _small_grip(K)
    rod((0.03, 0, -0.18), (0.03, 0, -0.38), 0.025, K["STEEL"])
    cyl(0.2, 0.15, (0.03, 0, -0.6), K["P"], rot=(0, math.pi / 2, 0), verts=24, kind="paint", bevel=0.02)
    for s in (-1, 1): cyl(0.12, 0.012, (0.03 + s * 0.08, 0, -0.6), K["STEEL"], rot=(0, math.pi / 2, 0), verts=16)
    cyl(0.03, 0.2, (0.13, 0, -0.6), K["DARK"], rot=(0, math.pi / 2, 0), verts=8)
    cyl(0.035, 0.1, (0.03, 0, -0.84), K["RUB"], verts=10, r2=0.02)
    rod((0.03, 0, -0.88), (0.03, 0, -3.25), 0.008, flat("cord", "#2a2c2f", 0.8, grain=0), verts=6)
    box((0.06, 0.05, 0.12), (0.03, 0, -3.3), K["STEEL"], bevel=0.01)
    rod((0.03, 0, -3.35), (0.03, 0, -4.32), 0.019, K["STEEL"])
    pipe([(-0.53, 0.0, -4.18), (-0.45, 0, -4.33), (0.51, 0, -4.33), (0.59, 0.0, -4.18)], 0.022, K["STEEL"])
    for s in (-1, 1): rod((0.03 + s * 0.08, 0, -4.33), (0.03 + s * 0.43, 0, -4.33), 0.034, K["RUB"], verts=12)
    box((0.08, 0.06, 0.06), (0.03, 0, -4.32), K["STEEL"], bevel=0.015)
    finalize("tbar", 512, ao_dist=0.3)

def platter():
    """A platter (Poma) carrier: the grip, the recoil box, the telescoping pole and the disc."""
    new_col("platter"); K = kit()
    _small_grip(K)
    rod((0.03, 0, -0.18), (0.03, 0, -0.3), 0.022, K["STEEL"])
    cyl(0.075, 0.55, (0.03, 0, -0.58), K["P"], verts=18, kind="paint", bevel=0.015)
    for z in (-0.33, -0.83): cyl(0.085, 0.03, (0.03, 0, z), K["STEEL"], verts=18)
    rod((0.03, 0, -0.85), (0.03, 0, -2.4), 0.012, K["STEEL"], verts=8)
    cyl(0.03, 0.08, (0.03, 0, -2.36), K["DARK"], verts=10)
    rod((0.03, 0, -2.36), (0.03, 0, -3.72), 0.021, K["P"], verts=10, kind="paint")
    cyl(0.03, 0.06, (0.03, 0, -3.7), K["DARK"], verts=10)
    cyl(0.115, 0.05, (0.03, 0, -3.76), K["RUB"], verts=20, bevel=0.015)
    cyl(0.07, 0.012, (0.03, 0, -3.73), K["STEEL"], verts=16)
    finalize("platter", 512, ao_dist=0.3)

def magic_carpet():
    """A 20 m section of magic carpet with its tunnel: the ribbed belt in a silver frame with ochre edge
    lines, tread-plate landings, aluminium arches with low side walls and arched clear panels, a ridge
    cap, snow on the crown and banked along the walls. Origin at the foot; the way up is −Y."""
    new_col("magic_carpet"); K = kit(); SN = K["SN"]
    L, Wt, Hw, rise = 20.0, 2.5, 1.2, 1.06  # length, tunnel width, side wall height, arch rise
    AL, BELT = flat("alu", "#b3b8bd", 0.4, 0.6, grain=0.03), flat("belt", "#26282b", 0.9, grain=0.06)
    OCH, WALL = flat("ochre", "#c9a65a", 0.6, grain=0), flat("wall", "#6c747c", 0.55, 0.3, grain=0.04)
    box((1.4, L, 0.24), (0, -L / 2, 0.02), AL, bevel=0.02)
    box((0.92, L - 0.2, 0.04), (0, -L / 2, 0.15), BELT)
    for i in range(int((L - 0.4) / 0.25)): box((0.9, 0.035, 0.012), (0, -0.3 - i * 0.25, 0.175), BELT)
    for s in (-1, 1):
        box((0.22, L, 0.07), (s * 0.58, -L / 2, 0.17), AL, bevel=0.015)
        box((0.035, L, 0.072), (s * 0.48, -L / 2, 0.17), OCH)
    for y, sgn in ((0.45, 1), (-L - 0.45, -1)):
        box((1.4, 0.9, 0.1), (0, y, 0.08), K["TREAD"], bevel=0.02)
        box((1.0, 0.06, 0.105), (0, y - sgn * 0.42, 0.08), OCH)
    # The tunnel: arches every 1.25 m, the clear arched panels between, low side walls.
    arc = [(-(Wt / 2) * math.cos(math.pi * j / 12), Hw + rise * math.sin(math.pi * j / 12)) for j in range(13)]
    sheet([[(x, y, z) for x, z in arc] for y in (-0.05, -L + 0.05)], glass("panel", "#b9cad6", 0.22), "glass")
    for s in (-1, 1):
        box((0.04, L, Hw - 0.2), (s * Wt / 2, -L / 2, 0.2 + (Hw - 0.2) / 2), WALL)
        box((0.1, L, 0.06), (s * Wt / 2, -L / 2, Hw), AL)
        box((0.12, L, 0.12), (s * Wt / 2, -L / 2, 0.16), AL)
    nb = int(L / 1.25)
    for i in range(nb + 1):
        y = -0.05 - i * (L - 0.1) / nb
        for (x0, z0), (x1, z1) in zip(arc, arc[1:]):
            c = ((x0 + x1) / 2, y, (z0 + z1) / 2); ln = math.hypot(x1 - x0, z1 - z0) + 0.012; a = math.atan2(z1 - z0, x1 - x0)
            box((ln, 0.05, 0.05), c, AL, rot=(0, -a, 0))
        for s in (-1, 1):
            box((0.06, 0.05, Hw - 0.1), (s * Wt / 2, y, 0.1 + (Hw - 0.1) / 2), AL)
            box((0.2, 0.16, 0.06), (s * Wt / 2, y, 0.13), AL)
    box((0.1, L, 0.04), (0, -L / 2, Hw + rise + 0.02), AL)
    blob((0.95, L - 0.6, 0.14), (0, -L / 2, Hw + rise + 0.02), SN, lumps=0.03)
    for s in (-1, 1): blob((0.8, L + 0.6, 0.75), (s * (Wt / 2 + 0.3), -L / 2, 0.1), SN, lumps=0.1)
    finalize("magic_carpet", 1024, ao_dist=0.8)

# ---------- the chondola (Copper's American Eagle) ----------
def loft(rings, mat, kind="bake", cap_top=True, cap_bot=False, smooth=True):
    """A surface through closed rings of points (each ring the same count), capped at the ends."""
    me = bpy.data.meshes.new("loft"); bm = bmesh.new()
    V = [[bm.verts.new(p) for p in r] for r in rings]; n = len(rings[0])
    for a, b in zip(V, V[1:]):
        for i in range(n): j = (i + 1) % n; bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap_top: bm.faces.new(V[-1])
    if cap_bot: bm.faces.new(V[0][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me); bm.free(); o = bpy.data.objects.new("loft", me); bpy.context.scene.collection.objects.link(o)
    for p in o.data.polygons: p.use_smooth = smooth
    return lib._link(o, mat, kind)

def rrect(hx, hy, r, z, seg=4):
    """A rounded rectangle at height z: half sizes hx, hy, corner radius r, seg points per corner."""
    pts = []
    for cx, cy, a0 in ((hx - r, hy - r, 0), (-hx + r, hy - r, 90), (-hx + r, -hy + r, 180), (hx - r, -hy + r, 270)):
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg); pts.append((cx + r * math.cos(a), cy + r * math.sin(a), z))
    return pts

def copper_logo(c, s, face, M_W, M_D):
    """Copper Mountain's logo: a fat white C whose two ends curl in towards the mouth, a snowflake in its
    bowl. Centred at c, s metres tall, on the face whose outward normal is face (-1: -Y, +1: +Y)."""
    R, r0, ox = 0.5 * s, 0.19 * s, 0.07 * s
    out = [(R * math.cos(math.radians(a)), R * math.sin(math.radians(a))) for a in range(42, 319, 12)]
    inn = [(ox + r0 * math.cos(math.radians(a)), r0 * math.sin(math.radians(a))) for a in range(300, 59, -15)]
    rot = (math.pi / 2, 0, 0 if face < 0 else math.pi); sx = 1 if face < 0 else -1
    def place(x, z, dy=0.0): return (c[0] + sx * x, c[1] + face * dy, c[2] + z)
    me = bpy.data.meshes.new("logo"); bm = bmesh.new()
    bm.faces.new([bm.verts.new((sx * x, 0, z)) for x, z in out + inn]); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("logo", me); bpy.context.scene.collection.objects.link(o); o.location = c; lib._link(o, M_W, "flat")
    for e in (-1, 1):  # the curled ends: round lobes reaching in over the mouth
        a = math.radians(e * 40); x, z = 0.33 * s * math.cos(a) + 0.04 * s, 0.33 * s * math.sin(a)
        cyl(0.165 * s, 0.004, place(x, z, 0.001), M_W, rot=(math.pi / 2, 0, 0), verts=16, kind="flat")
    for k in range(3):  # the snowflake
        box((0.17 * s, 0.006, 0.026 * s), place(-0.31 * s, 0, 0.004), M_D, rot=(0, math.pi / 3 * k, 0), kind="flat")
    return o

def chondola_cabin():
    """Copper's American Eagle cabin: a Leitner-Poma Sigma Diamond 8-seater in charcoal slate (`paint`),
    tall smoked windows on every side, ribbed panels below, sliding doors with a ski rack outside, the
    white Copper "C" front and back. It rides the same LPA grip and hangs at the chairs' height
    (floor 3.35 m under the rope)."""
    new_col("chondola_cabin"); K = kit()
    P = flat("paint_cabin", "#3a454c", 0.4, 0.25, grain=0)
    GL = glass("cabin_glass", "#1d252d", 0.68)
    TRIM, DARK = flat("silver", "#b8bec6", 0.3, 0.6, grain=0), K["DARK"]
    hx, hy, top, h = 0.98, 0.86, -1.2, 2.15
    zb, zg0, zg1 = top - h, top - h + 0.86, top - 0.16
    taper = lambda z: 1.0 - 0.06 * (zg0 - z) / (zg0 - zb) if z < zg0 else 1.0  # the lower body narrows a little
    ring = lambda z, r=0.22, d=0.0: rrect(hx * taper(z) + d, hy * taper(z) + d, r, z)
    loft([rrect(hx * 0.86, hy * 0.86, 0.16, zb), ring(zb + 0.08), ring(zg0)], P, "paint", cap_top=False, cap_bot=True)
    loft([ring(zg0), ring(zg1)], GL, "glass", cap_top=False)
    loft([ring(zg1), ring(top - 0.05), rrect(hx - 0.06, hy - 0.06, 0.18, top)], P, "paint")
    for z in (zb + 0.3, zb + 0.52, zg0 - 0.09):  # ribs on the lower panels
        loft([ring(z - 0.012, d=0.008), ring(z + 0.012, d=0.008)], DARK, cap_top=False)
    loft([ring(zg0 - 0.02, d=0.01), ring(zg0 + 0.03, d=0.01)], P, "paint", cap_top=False)
    loft([ring(zg1 - 0.03, d=0.01), ring(zg1 + 0.02, d=0.01)], P, "paint", cap_top=False)
    # Corner posts and the door seams (doors on the ±X sides, which face the platform).
    for sx in (-1, 1):
        for sy in (-1, 1):
            a = math.atan2(sy, sx); cx, cy = sx * (hx - 0.22 + 0.22 * 0.72), sy * (hy - 0.22 + 0.22 * 0.72)
            box((0.09, 0.05, zg1 - zg0), (cx, cy, (zg0 + zg1) / 2), P, rot=(0, 0, a + math.pi / 2), kind="paint")
        box((0.04, 0.06, zg1 - zb - 0.1), (sx * (hx + 0.005), 0, (zb + 0.1 + zg1) / 2), P, kind="paint")
        for y in (-0.03, 0.03): box((0.012, 0.012, zg1 - zg0 - 0.1), (sx * (hx + 0.03), y, (zg0 + zg1) / 2), DARK)
        # The ski and board rack outside the door: a silver frame of slots.
        box((0.12, 0.62, 0.34), (sx * (hx + 0.09), 0.0, zg0 - 0.15), TRIM, bevel=0.02)
        for k in range(6): box((0.13, 0.02, 0.3), (sx * (hx + 0.1), -0.25 + k * 0.1, zg0 - 0.15), DARK)
        for y in (-0.55, 0.55): cyl(0.07, 0.03, (sx * (hx + 0.02), y, zg0 + 0.38), DARK, rot=(0, math.pi / 2, 0), verts=12)  # bumpers
    # The white C front and back, the cabin number.
    W, D = flat("logo_white", "#f4f4f2", 0.5, grain=0), flat("logo_dark", "#2b3238", 0.5, grain=0)
    for f in (-1, 1): copper_logo((-0.12 * f, f * (hy + 0.012), (zg0 + zg1) / 2 - 0.12), 0.58, f, W, D)
    text("4", 0.09, (hx - 0.25, -(hy * taper(zb + 0.1) + 0.01), zb + 0.14), W, extrude=0.003)
    # Inside: a bench at each end, the floor.
    SEAT = flat("seat", "#2a2f35", 0.6, grain=0.04)
    for s in (-1, 1):
        box((2 * hx - 0.45, 0.4, 0.09), (0, s * (hy - 0.3), zb + 0.5), SEAT, bevel=0.03)
        box((2 * hx - 0.45, 0.09, 0.42), (0, s * (hy - 0.12), zb + 0.8), SEAT, bevel=0.03)
    box((2 * hx - 0.3, 2 * hy - 0.3, 0.04), (0, 0, zb + 0.1), DARK)
    # Roof: the suspension frame, the hanger, the LPA grip shared with the chairs; a little snow on the roof.
    box((0.9, 0.7, 0.12), (0, 0, top + 0.06), TRIM, bevel=0.04)
    box((0.3, 1.3, 0.08), (0, 0, top + 0.14), TRIM, bevel=0.02)
    grip_detach(K)
    pipe([(0, 0, -0.3), (0, 0.02, -0.62), (0, 0.32, -0.85), (0, 0.3, top + 0.35), (0, 0.06, top + 0.18)], 0.06, TRIM)
    for s in (-1, 1): box((0.42, 0.3, 0.05), (s * 0.45, 0, top + 0.05), K["SN"], bevel=0.02, kind="snow")
    finalize("chondola_cabin", 512, ao_dist=0.5)

def chondola_chair():
    """The American Eagle six-seat chair: the kit's open detachable six (no bubble) with Copper's black
    seats, on the same LPA grip and hanger height as the chondola cabin."""
    k0 = globals()["kit"]
    def k():
        K = k0(); K["P"] = flat("paint", "#9aa2a9", 0.4, 0.3, grain=0); K["PAD"] = flat("pad_black", "#24272b", 0.75, grain=0.05); K["SHELL"] = flat("shell", "#1d2024", 0.5, grain=0.03); return K
    globals()["kit"] = k
    try: _chair_detach("chondola_chair", 6)
    finally: globals()["kit"] = k0

def tower_lattice():
    """A tall steel lattice gondola tower like the Silver Queen's: four angle legs tapering from 6 m square at
    the foot to 1.6 m under the head, X-braced panels, rest platforms, a caged ladder; the head is a lattice
    crossarm with a twin sheave train at each end. 40 m tall: the game scales it to the tower's height
    (0.75 to 1.5 keeps the bracing looking right). Origin at the foot; ropes at x = ±3.0, z = 41.5."""
    new_col("tower_lattice"); K = kit(); P, SN = flat("paint_lattice", "#7f868c", 0.5, 0.2, grain=0), K["SN"]
    H, b0, b1, n = 40.0, 3.0, 0.8, 12
    half = lambda z: b0 + (b1 - b0) * z / H
    zs = [H * (k / n) ** 0.9 for k in range(n + 1)]  # panels a little shorter low down
    def leg_pt(sx, sy, z): h = half(z); return (sx * h, sy * h, z)
    for sx in (-1, 1):
        for sy in (-1, 1):
            rod(leg_pt(sx, sy, 0), leg_pt(sx, sy, H), 0.11, P, verts=6, kind="paint")
            box((0.9, 0.9, 0.6), (sx * b0, sy * b0, 0.3), flat("concrete", "#aca79f", 0.92, grain=0.12), bevel=0.04)
    faces = [((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))]
    for za, zb in zip(zs, zs[1:]):
        for (ax, ay), (bx, by) in faces:
            rod(leg_pt(ax, ay, za), leg_pt(bx, by, zb), 0.05, P, verts=4, kind="paint")
            rod(leg_pt(bx, by, za), leg_pt(ax, ay, zb), 0.05, P, verts=4, kind="paint")
            rod(leg_pt(ax, ay, zb), leg_pt(bx, by, zb), 0.055, P, verts=4, kind="paint")
    for z in (H * 0.35, H * 0.7):  # rest platforms on the ladder side
        box((2 * half(z) + 0.4, 1.0, 0.05), (0, -half(z) - 0.4, z), K["TREAD"])
        for x in (-half(z) - 0.2, half(z) + 0.2): rod((x, -half(z) - 0.9, z), (x, -half(z) - 0.9, z + 1.05), 0.025, K["GALV"])
        rod((-half(z) - 0.2, -half(z) - 0.9, z + 1.05), (half(z) + 0.2, -half(z) - 0.9, z + 1.05), 0.025, K["GALV"])
    for k in range(int(H / 0.9)):  # the ladder up the -Y face, hoops of its cage
        z = 1.0 + k * 0.9; y = -half(z) - 0.25
        if z > H: break
        box((0.5, 0.03, 0.03), (0, y, z), K["GALV"])
        if k % 2: ring((0, y - 0.3, z), 0.38, 0.015, K["GALV"], n=10)
    for x in (-0.25, 0.25): rod((x, -half(0) - 0.25, 1.0), (x, -half(H) - 0.25, H), 0.025, K["GALV"], verts=6)
    # The head: a lattice crossarm across the line, sheave trains at its ends.
    xr, za = 3.0, H + 0.5
    for y in (-0.45, 0.45):
        for z in (za - 0.45, za + 0.25): rod((-xr - 0.5, y, z), (xr + 0.5, y, z), 0.07, P, verts=6, kind="paint")
        for k in range(9):
            x0 = -xr - 0.5 + k * (2 * xr + 1.0) / 8; x1 = -xr - 0.5 + (k + 1) * (2 * xr + 1.0) / 8
            rod((x0, y, za - 0.45), (x1, y, za + 0.25), 0.04, P, verts=4, kind="paint")
    for k in range(5): x = -xr - 0.5 + k * (2 * xr + 1.0) / 4; rod((x, -0.45, za + 0.25), (x, 0.45, za + 0.25), 0.04, P, verts=4, kind="paint")
    for s in (-1, 1): rod((s * b1, 0, H), (s * (xr - 0.6), 0, za - 0.45), 0.07, P, verts=6, kind="paint")
    rz = 0
    for s in (-1, 1): rz = _train(K, s * xr, za + 0.62, n=8)
    box((2 * xr + 1.2, 1.0, 0.04), (0, -0.95, za - 0.5), K["TREAD"])
    rod((-xr - 0.6, -1.4, za + 0.5), (xr + 0.6, -1.4, za + 0.5), 0.025, K["GALV"])
    for x in (-xr - 0.6, 0, xr + 0.6): rod((x, -1.4, za - 0.5), (x, -1.4, za + 0.5), 0.025, K["GALV"])
    crust((2 * xr + 1.0, 0.16, 0.08), (0, -0.45, za + 0.33), SN); crust((2 * xr + 1.0, 0.16, 0.08), (0, 0.45, za + 0.33), SN)
    finalize("tower_lattice", 1024, ao_dist=0.8)

MODELS = {"tower_lattice": tower_lattice, "chondola_cabin": chondola_cabin, "chondola_chair": chondola_chair, "gondola": gondola, "gondola6": gondola6, "gondola10": gondola10, "cabriolet": cabriolet,
          "chair2": chair2, "chair3": chair3, "chair4_fixed": chair4_fixed,
          "chair4": chair4, "chair6": chair6, "chair6_bubble": chair6_bubble, "chair8_bubble": chair8_bubble,
          "tower_head": tower_head, "tower_shaft": tower_shaft, "tower_base": tower_base, "tower_head_surface": tower_head_surface,
          "tbar": tbar, "platter": platter, "magic_carpet": magic_carpet}
