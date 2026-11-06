"""Trees and other things for staging the catalogue."""
import math, random
from mathutils import Vector
from lib import *
import lib

def shag(r, h, z, mat, kind, droop=0.35, seed=0):
    """A tier of branches: a cone whose rim is ragged and droops."""
    rr = random.Random(seed); me = bpy.data.meshes.new("tier"); bm = bmesh.new(); n = 18
    top = bm.verts.new((0, 0, z + h)); rim = []
    for i in range(n):
        a = i / n * math.tau; k = r * (1.0 if i % 2 == 0 else 0.72) * (0.9 + rr.random() * 0.2)
        rim.append(bm.verts.new((math.cos(a) * k, math.sin(a) * k, z - (droop if i % 2 == 0 else 0.05) * (0.8 + rr.random() * 0.4))))
    mid = bm.verts.new((0, 0, z + 0.15))
    for i in range(n): bm.faces.new((top, rim[i], rim[(i + 1) % n])); bm.faces.new((mid, rim[(i + 1) % n], rim[i]))
    bm.to_mesh(me); bm.free(); o = bpy.data.objects.new("tier", me); bpy.context.scene.collection.objects.link(o); return lib._link(o, mat, kind)

def pine():
    """A Colorado spruce with snow lying on its tiers, for staging the catalogue."""
    new_col("pine")
    BARK, NEEDLE, SN = wood("bark", "#3b2a20", "#5a4232", "Z"), flat("needle", "#2a4434", 0.9, grain=0.25), snow()
    cyl(0.2, 2.2, (0, 0, 1.1), BARK, verts=8, r2=0.1)
    tiers = 11
    for i in range(tiers):
        u = i / tiers; r = 2.6 * (1 - u) ** 1.1 + 0.3; z = 1.4 + u * 10.5
        shag(r, 1.5, z, NEEDLE, "bake", droop=0.45 * (1 - u) + 0.1, seed=i)
        shag(r * 0.78, 0.9, z + 0.42, SN, "snow", droop=0.3 * (1 - u) + 0.05, seed=i + 50)
    shag(0.3, 1.2, 12.2, NEEDLE, "bake", droop=0.05, seed=99)
    finalize("pine", 512, ao_dist=1.2)

MODELS = {"pine": pine}
