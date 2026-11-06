"""Lift carriers, towers and the rope."""
import math, random
from mathutils import Vector
from lib import *
import lib

def gondola():
    """An eight-seat cabin: a rounded graphite pod with a band of smoked glass, silver trim, benches inside,
    the hanger arm and grip above."""
    new_col("gondola")
    PAINT, TRIM, DARK, SEAT = flat("graphite", "#2c3138", 0.35, 0.3, grain=0.02), flat("silver", "#b8bec6", 0.3, 0.8, grain=0), flat("dark", "#1c1f23", 0.5, 0.4, grain=0), flat("seat", "#3d4652", 0.6, grain=0.04)
    GL = glass("cabin_glass", "#2a3542", 0.45)
    w, d, h, top = 1.95, 1.7, 2.1, -1.15
    # The pod: a box rounded hard and smoothed, then painted in bands by height.
    me = bpy.data.meshes.new("pod"); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts); bmesh.ops.translate(bm, vec=(0, 0, top - h / 2), verts=bm.verts)
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.42, segments=6, affect="EDGES", profile=0.55)
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
        for y in (-0.3, 0.3): box((0.05, 0.07, g1 - g0), (sx * (w / 2 - 0.005), y, (g0 + g1) / 2), PAINT)
    for sy in (-1, 1): box((0.06, 0.05, g1 - g0), (0, sy * (d / 2 - 0.005), (g0 + g1) / 2), PAINT)
    box((0.03, 0.04, h - 0.5), (0.0, -d / 2 - 0.0, top - h / 2), DARK)
    box((w * 0.7, d * 0.55, 0.1), (0, 0, top - h - 0.03), DARK, bevel=0.03)
    # Inside: a bench each side and the floor.
    for sy in (-1, 1):
        box((w - 0.5, 0.42, 0.1), (0, sy * (d / 2 - 0.35), top - h + 0.55), SEAT, bevel=0.03)
        box((w - 0.5, 0.1, 0.45), (0, sy * (d / 2 - 0.16), top - h + 0.85), SEAT, bevel=0.03)
    box((w - 0.4, d - 0.4, 0.04), (0, 0, top - h + 0.12), DARK)
    # Roof fairing, hanger, grip with its wheels.
    box((w * 0.55, d * 0.5, 0.18), (0, 0, top + 0.02), TRIM, bevel=0.07)
    curve_pipe([(0, 0, -0.1), (0, 0, -0.45), (0, 0.2, -0.85), (0, 0.15, top + 0.08)], 0.065, TRIM)
    box((0.34, 0.5, 0.3), (0, 0, -0.02), DARK, bevel=0.05)
    for y in (-0.16, 0.16): cyl(0.1, 0.06, (0.2, y, 0.05), DARK, rot=(0, math.pi / 2, 0), verts=14)
    # Ski and board holders on the outside of the doors.
    for sx in (-1, 1):
        for y in (-0.35, 0.35): box((0.06, 0.07, 0.75), (sx * (w / 2 + 0.06), y, top - h * 0.55), TRIM)
    text("12", 0.2, (w / 2 + 0.03, 0.62, top - h + 0.6), flat("paint_white", "#f2f2f2", 0.5, grain=0), rot=(math.pi / 2, 0, math.pi / 2), extrude=0.005)
    finalize("gondola", 1024, ao_dist=0.5)

MODELS = {"gondola": gondola}
