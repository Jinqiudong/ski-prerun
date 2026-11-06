"""Signs on the hill: run signs, a junction post, lift signs, the slow banner, the trail map board, a closed
rope line, boundary and hazard markers. The front faces -Y.

Blank faces the game paints are kind `paint`, material `sign_face`, with their own UVs 0..1 over each face;
where a model has several boards their faces share the mesh and split the atlas across U (left to right:
board 0, 1, 2), and two-sided boards carry the same UVs on the back, mirrored so both sides read."""
import math
import bmesh
from mathutils import Vector
from lib import *
import lib
from stations import prism, face, rod, sag, cap, torus, anchor

def lettering(s, size, loc, mat, rot):
    o = text(s, size, loc, mat, rot=rot, extrude=0.003); o.data.resolution_u = 3; return o

def mats():
    return {
        "timber": wood("timber", "#4a3020", "#6e4a31", "Z"), "boards": wood("boards", "#4d3424", "#6b4a33", "Z"),
        "roof": wood("roof", "#3b2a22", "#54392b", "Y"), "logy": wood("logy", "#5a3b26", "#8c6240", "Y"),
        "galv": flat("galv", "#a5aaaf", 0.4, 0.2, grain=0.05), "trim": flat("trim", "#c3c7cb", 0.35, 0.2, grain=0.02),
        "dark": flat("dark", "#2a2d31", 0.5, 0.1, grain=0.03), "alu": flat("alu", "#dcdcd8", 0.45, 0.1, grain=0.02),
        "bamboo": flat("bamboo", "#c4a96c", 0.55, grain=0.14), "node": flat("bamboo_node", "#8f7646", 0.6, grain=0.05),
        "orange": flat("orange", "#d0662e", 0.55, grain=0.04), "yellow": flat("banner", "#d9b23c", 0.75, grain=0.06),
        "black": flat("black", "#202225", 0.6, grain=0), "brick": flat("brick", "#9b3a30", 0.6, grain=0.03),
        "cream": flat("cream", "#ece2cd", 0.6, grain=0.02),
        "face": flat("sign_face", "#ece2cd", 0.6, grain=0),
        "letters": flat("letters", "#202225", 0.6, grain=0), "red_letters": flat("red_letters", "#9b3a30", 0.6, grain=0),
        "lamp": lit("lamp", "#ffd9a0", 6.0, "#ffffff", window=False), "glass": glass("glass", "#c9d6e0", 0.18),
        "snow": snow(),
    }

def mound(x, y, M, r=0.35):
    """Snow heaped round a post's foot."""
    cyl(r, r * 0.55, (x, y, r * 0.12), M["snow"], verts=14, r2=r * 0.25, kind="snow", bevel=r * 0.12)

def bamboo(x, y, h, M, r=0.026, z0=-0.2, tilt=(0, 0, 0)):
    """A bamboo pole with its nodes; tilt rotates it about its foot."""
    from mathutils import Euler
    e = Euler(tilt); up = Vector((0, 0, 1)); up.rotate(e)
    foot = Vector((x, y, z0)); top = foot + up * (h - z0)
    rod(foot, top, r, M["bamboo"], 8, r2=r * 0.8)
    n = int((h - z0) / 0.38)
    for k in range(1, n + 1):
        c = foot + up * (k * 0.38); cyl(r * 1.12, 0.022, c, M["node"], rot=e, verts=8)
    cap((r * 2.6, r * 2.6, 0.05), top + Vector((0, 0, 0.02)), M["snow"])
    return top

def board_faces(pts, t, M, loc, ang, uv=(0, 0, 1, 1), back=True, inset=None):
    """The painted face on the front of a board (outline pts, (x, height) about loc), and mirrored on the back."""
    c, s = math.cos(ang), math.sin(ang)
    fp = inset or pts
    ny = Vector((-s, c, 0))  # the board's back normal (front faces -ny)
    face(fp, M["face"], "paint", loc=Vector(loc) - ny * (t / 2 + 0.003), rot=(math.pi / 2, 0, ang), uv=uv)
    if back: face([(-x, z) for x, z in fp], M["face"], "paint", loc=Vector(loc) + ny * (t / 2 + 0.003), rot=(math.pi / 2, 0, ang + math.pi), uv=uv)

def sign_run():
    """A run sign: a framed board on a square timber post, bolted on with galvanised straps. The face is a
    blank (kind paint, material sign_face) for the run's name and its difficulty mark."""
    new_col("sign_run"); M = mats(); anchor(M["dark"])
    w, h, t, zc = 1.2, 0.62, 0.05, 2.25
    box((0.14, 0.14, 3.05), (0, 0, 3.05 / 2 - 0.25), M["timber"], bevel=0.01)
    cyl(0.12, 0.1, (0, 0, 2.85), M["timber"], rot=(0, 0, math.pi / 4), verts=4, r2=0.02)
    by = -0.07 - t / 2
    box((w, t, h), (0, by, zc), M["cream"], bevel=0.008)
    for z in (zc - h / 2 + 0.03, zc + h / 2 - 0.03): box((w + 0.04, t + 0.03, 0.06), (0, by - 0.01, z), M["timber"], bevel=0.008)
    for x in (-w / 2 + 0.01, w / 2 - 0.01): box((0.06, t + 0.03, h + 0.02), (x, by - 0.01, zc), M["timber"], bevel=0.008)
    fw, fh = w - 0.1, h - 0.12
    face([(-fw / 2, -fh / 2), (fw / 2, -fh / 2), (fw / 2, fh / 2), (-fw / 2, fh / 2)], M["face"], "paint", loc=(0, by - t / 2 - 0.004, zc))
    for z in (zc - 0.17, zc + 0.17):
        box((0.2, 0.17, 0.05), (0, 0.0, z), M["galv"])
        for x in (-w / 2 + 0.03, w / 2 - 0.03): cyl(0.016, 0.02, (x, by - t / 2 - 0.025, z), M["galv"], rot=(math.pi / 2, 0, 0), verts=8)
    cap((w + 0.08, 0.13, 0.1), (0, by - 0.01, zc + h / 2 + 0.07), M["snow"])
    cap((0.18, 0.18, 0.08), (0, 0, 2.92), M["snow"])
    mound(0, 0, M, 0.4)
    finalize("sign_run", 512, ao_dist=0.4, samples=32)

def arrow(L, H, p):
    return [(0, -H / 2), (L - p, -H / 2), (L, 0), (L - p, H / 2), (0, H / 2)]

def sign_junction():
    """A junction post: a round timber post with three arrow boards at different heights and angles,
    each face a blank on both sides (U thirds: top board 0, middle 1, bottom 2)."""
    new_col("sign_junction"); M = mats(); anchor(M["dark"])
    cyl(0.09, 3.6, (0, 0, 1.55), M["logy"], verts=12, r2=0.08)
    cyl(0.1, 0.06, (0, 0, 3.36), M["timber"], verts=12)
    L, H, p, t = 1.15, 0.3, 0.2, 0.045
    for i, (z, a) in enumerate(((3.0, -0.35), (2.6, 0.5 + math.pi), (2.2, 0.25))):
        c, s = math.cos(a), math.sin(a)
        prism(arrow(L, H, p), -t / 2, t / 2, M["cream"], loc=(0.08 * c, 0.08 * s, z), rot=(math.pi / 2, 0, a), bevel=0.006, seg=1, smooth=None)
        # A timber edge round the board.
        prism([(x * 1.0, y * 1.12) for x, y in arrow(L + 0.04, H, p)], -t / 2 - 0.004, t / 2 + 0.004, M["timber"],
              loc=(0.06 * c, 0.06 * s, z), rot=(math.pi / 2, 0, a), smooth=None)
        ins = [(0.06, -H / 2 + 0.04), (L - p - 0.02, -H / 2 + 0.04), (L - 0.06, 0), (L - p - 0.02, H / 2 - 0.04), (0.06, H / 2 - 0.04)]
        board_faces(arrow(L, H, p), t + 0.01, M, (0.08 * c, 0.08 * s, z), a, uv=(i / 3, 0, (i + 1) / 3, 1), inset=ins)
        box((0.22, 0.2, 0.06), (0.03 * c, 0.03 * s, z), M["galv"], rot=(0, 0, a))
        cap((L - p, 0.08, 0.07), (0.08 * c + (L - p) / 2 * c, 0.08 * s + (L - p) / 2 * s, z + H / 2 + 0.04), M["snow"], rot=(0, 0, a))
    cap((0.22, 0.22, 0.08), (0, 0, 3.42), M["snow"])
    mound(0, 0, M, 0.42)
    finalize("sign_junction", 512, ao_dist=0.4, samples=32)

def sign_lift():
    """A lift sign ("prepare to unload", "keep tips up") on two galvanised posts: an aluminium board with a
    rolled silver edge, U-bolt clamps, a blank face (kind paint)."""
    new_col("sign_lift"); M = mats(); anchor(M["dark"])
    w, h, zc = 1.8, 1.0, 2.15
    for x in (-0.7, 0.7):
        cyl(0.045, 3.0, (x, 0.0, 1.25), M["galv"], verts=12)
        cyl(0.05, 0.04, (x, 0.0, 2.76), M["dark"], verts=12)
        cap((0.12, 0.12, 0.06), (x, 0.0, 2.8), M["snow"])
        mound(x, 0, M, 0.32)
        for z in (zc - 0.3, zc + 0.3):
            box((0.16, 0.06, 0.06), (x, -0.06, z), M["galv"])
            for dx in (-0.06, 0.06): cyl(0.014, 0.03, (x + dx, -0.085, z), M["galv"], rot=(math.pi / 2, 0, 0), verts=6)
    by = -0.09
    box((w, 0.03, h), (0, by, zc), M["alu"], bevel=0.006)
    for z in (zc - h / 2, zc + h / 2): cyl(0.018, w, (0, by, z), M["trim"], rot=(0, math.pi / 2, 0), verts=8)
    for x in (-w / 2, w / 2): cyl(0.018, h, (x, by, zc), M["trim"], verts=8)
    fw, fh = w - 0.08, h - 0.08
    face([(-fw / 2, -fh / 2), (fw / 2, -fh / 2), (fw / 2, fh / 2), (-fw / 2, fh / 2)], M["face"], "paint", loc=(0, by - 0.018, zc))
    cap((w + 0.06, 0.1, 0.1), (0, by, zc + h / 2 + 0.06), M["snow"])
    finalize("sign_lift", 512, ao_dist=0.4, samples=32)

def banner_mesh(w, h, mat, loc, droop=0.05, wave=0.025, thick=0.008):
    bm = bmesh.new(); nx, nz = 16, 4
    vs = [[bm.verts.new(((i / nx - 0.5) * w, math.sin(i / nx * math.pi * 3) * wave, (j / nz - 0.5) * h - droop * math.sin(i / nx * math.pi) * (1 - j / nz * 0.4))) for i in range(nx + 1)] for j in range(nz + 1)]
    for j in range(nz):
        for i in range(nx): bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
    me = bpy.data.meshes.new("banner"); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("banner", me); bpy.context.scene.collection.objects.link(o); o.location = loc
    md = o.modifiers.new("t", "SOLIDIFY"); md.thickness = thick; md.offset = 0
    return lib._link(o, mat, "bake")

def sign_slow():
    """The SLOW banner: yellow mesh with black hems and letters, tied between two bamboo poles."""
    new_col("sign_slow"); M = mats(); anchor(M["dark"])
    w, h, zc, px = 3.0, 0.8, 1.15, 1.7
    for x in (-px, px): bamboo(x, 0, 2.0, M, r=0.03); mound(x, 0, M, 0.3)
    banner_mesh(w, h, M["yellow"], (0, 0, zc))
    for z in (zc - h / 2 + 0.03, zc + h / 2 - 0.03): banner_mesh(w + 0.01, 0.07, M["black"], (0, 0, z), droop=0.05 * (0.6 if z > zc else 1.0), thick=0.02)
    for side, ang in ((-1, 0), (1, math.pi)):
        lettering("SLOW", 0.5, (0, side * 0.03, zc - 0.07), M["letters"], (math.pi / 2, 0, ang))
    for sz in (-1, 1):
        for sx in (-1, 1):
            a = (sx * w / 2, 0, zc + sz * (h / 2 - 0.05)); b = (sx * (px - 0.03), 0, zc + sz * (h / 2 - 0.05) + 0.03)
            rod(a, b, 0.008, M["dark"], 6)
            torus(0.025, 0.007, a, M["galv"], seg=10, rseg=4)
    cap((w * 0.95, 0.06, 0.05), (0, 0, zc + h / 2 + 0.01), M["snow"])
    finalize("sign_slow", 512, ao_dist=0.4, samples=32)

def trail_map_board():
    """The trail map board at a base or lift top: two heavy timber posts, a boarded backing, a framed face
    for the map (kind paint) behind a clear cover, a little shingled roof under deep snow, a downlight."""
    new_col("trail_map_board"); M = mats(); anchor(M["dark"])
    W, H, zc, px = 3.3, 2.2, 2.05, 1.9
    for x in (-px, px):
        box((0.24, 0.24, 4.3), (x, 0, 4.3 / 2 - 0.3), M["timber"], bevel=0.015)
        mound(x, 0, M, 0.45)
        rod((x, 0, 3.35), (x * 0.6, 0, 3.85), 0.06, M["timber"], 4)
    box((2 * px + 0.3, 0.2, 0.22), (0, 0, 3.9), M["timber"], bevel=0.015)
    box((W + 0.3, 0.1, H + 0.3), (0, -0.16, zc), M["boards"], bevel=0.01)
    for z in (zc - H / 2 - 0.1, zc + H / 2 + 0.1): box((W + 0.42, 0.16, 0.14), (0, -0.2, z), M["timber"], bevel=0.012)
    for x in (-W / 2 - 0.14, W / 2 + 0.14): box((0.14, 0.16, H + 0.34), (x, -0.2, zc), M["timber"], bevel=0.012)
    face([(-W / 2, -H / 2), (W / 2, -H / 2), (W / 2, H / 2), (-W / 2, H / 2)], M["face"], "paint", loc=(0, -0.215, zc))
    box((W + 0.02, 0.012, H + 0.02), (0, -0.25, zc), M["glass"], kind="glass")
    box((W + 0.4, 0.3, 0.06), (0, -0.33, zc - H / 2 - 0.2), M["timber"])  # a ledge
    cap((W + 0.4, 0.28, 0.08), (0, -0.33, zc - H / 2 - 0.14), M["snow"])
    # The roof: two shingled planes over the ridge along X, barge boards, deep snow, a ridge roll.
    ridge, a, run = 4.45, math.radians(32), 0.95
    for s in (-1, 1):
        c = Vector((0, s * math.cos(a) * run / 2, ridge - math.sin(a) * run / 2))
        box((2 * px + 1.0, run, 0.08), c, M["roof"], rot=(-s * a, 0, 0), bevel=0.01)
        for x in (-px - 0.5, px + 0.5): box((0.06, run + 0.04, 0.18), c + Vector((x, 0, -0.03)), M["timber"], rot=(-s * a, 0, 0))
        nrm = Vector((0, s * math.sin(a), math.cos(a)))
        slab((2 * px + 0.95, run - 0.05, 0.26), c + nrm * 0.15, M["snow"], rot=(-s * a, 0, 0))
        cyl(0.11, 2 * px + 0.95, Vector((0, s * math.cos(a) * run, ridge - math.sin(a) * run)) + nrm * 0.12, M["snow"], rot=(0, math.pi / 2, 0), verts=10)
    for x in (-px, px):
        for s in (-1, 1): rod((x, 0, 3.98), (x, s * math.cos(a) * run * 0.95, ridge - math.sin(a) * run * 0.95), 0.05, M["timber"], 4)
        rod((x, 0, 3.98), (x, 0, ridge - 0.05), 0.05, M["timber"], 4)
    cyl(0.16, 2 * px + 0.95, (0, 0, ridge + 0.2), M["snow"], rot=(0, math.pi / 2, 0), verts=12)
    box((1.6, 0.12, 0.08), (0, -0.62, 3.62), M["dark"], bevel=0.01)
    box((1.5, 0.08, 0.02), (0, -0.62, 3.575), M["lamp"], kind="lamp")
    rod((0, -0.25, 3.8), (0, -0.62, 3.65), 0.02, M["dark"], 6)
    finalize("trail_map_board", 512, ao_dist=0.6, samples=32)

def rope_line():
    """A closed rope line, 10 m along X: bamboo poles, orange rope sagging between them with pennants,
    and a CLOSED disc on the middle pole."""
    new_col("rope_line"); M = mats(); anchor(M["dark"])
    xs = [-5.0, -2.5, 0.0, 2.5, 5.0]; zr = 1.1
    for x in xs: bamboo(x, 0, 1.85 if x == 0 else 1.4, M); mound(x, 0, M, 0.22)
    for a, b in zip(xs, xs[1:]):
        pts = sag((a, 0, zr), (b, 0, zr), 0.01, M["orange"], 0.14, n=6, verts=5)
        for k, (u, col) in enumerate(((0.33, "orange"), (0.67, "yellow"))):
            p = Vector((a + (b - a) * u, 0, zr - 0.14 * 4 * u * (1 - u)))
            tri([(p.x - 0.1, 0, p.z), (p.x + 0.1, 0, p.z), (p.x + 0.01, 0.0, p.z - 0.26)], M[col])
    for x in xs: torus(0.034, 0.008, (x, 0, zr), M["orange"], seg=8, rseg=4)
    # The CLOSED disc.
    zd = 1.5
    cyl(0.32, 0.02, (0, -0.04, zd), M["brick"], rot=(math.pi / 2, 0, 0), verts=24)
    cyl(0.27, 0.024, (0, -0.04, zd), M["cream"], rot=(math.pi / 2, 0, 0), verts=24)
    for side, ang in ((-1, 0), (1, math.pi)):
        lettering("CLOSED", 0.12, (0, -0.04 + side * 0.014, zd), M["red_letters"], (math.pi / 2, 0, ang))
    for dz in (-0.2, 0.2): box((0.08, 0.05, 0.03), (0, -0.01, zd + dz), M["galv"])
    cap((0.35, 0.05, 0.04), (0, -0.04, zd + 0.33), M["snow"])
    finalize("rope_line", 512, ao_dist=0.4, samples=32)

def boundary_marker():
    """A boundary marker: an orange disc bolted near the top of a bamboo pole."""
    new_col("boundary_marker"); M = mats(); anchor(M["dark"])
    bamboo(0, 0, 2.5, M, r=0.03); mound(0, 0, M, 0.3)
    cyl(0.25, 0.014, (0, -0.04, 2.2), M["orange"], rot=(math.pi / 2, 0, 0), verts=32, bevel=0.003)
    torus(0.25, 0.01, (0, -0.04, 2.2), M["orange"], seg=32, rseg=4).rotation_euler = (math.pi / 2, 0, 0)
    for dz in (-0.12, 0.12):
        box((0.07, 0.05, 0.025), (0, -0.015, 2.2 + dz), M["galv"])
        cyl(0.012, 0.02, (0, -0.05, 2.2 + dz), M["galv"], rot=(math.pi / 2, 0, 0), verts=6)
    cap((0.3, 0.04, 0.035), (0, -0.04, 2.45), M["snow"])
    finalize("boundary_marker", 512, ao_dist=0.3, samples=32)

def hazard_cross():
    """A hazard cross: two bamboo poles crossed and lashed with orange tape, ribbons at their tops."""
    new_col("hazard_cross"); M = mats(); anchor(M["dark"])
    for s in (-1, 1):
        top = bamboo(s * -0.55, s * 0.025, 2.35, M, r=0.028, z0=-0.2, tilt=(0, s * 0.42, 0))
        tri([(top.x, top.y - 0.012, top.z - 0.12), (top.x, top.y - 0.012, top.z - 0.3), (top.x + s * 0.35, top.y - 0.012, top.z - 0.32)], M["orange"])
        mound(s * -0.55, 0, M, 0.25)
    zc = 1.03
    for k in range(4): cyl(0.045, 0.035, (0, 0, zc - 0.05 + k * 0.035), M["orange"], rot=(0, (k % 2 * 2 - 1) * 0.42, 0), verts=10)
    cap((0.12, 0.08, 0.05), (0, 0, zc + 0.12), M["snow"])
    finalize("hazard_cross", 512, ao_dist=0.3, samples=32)

MODELS = {"sign_run": sign_run, "sign_junction": sign_junction, "sign_lift": sign_lift, "sign_slow": sign_slow,
          "trail_map_board": trail_map_board, "rope_line": rope_line, "boundary_marker": boundary_marker, "hazard_cross": hazard_cross}
