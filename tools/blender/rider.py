"""Build a rider in Blender from the CC0 base body: A-pose, loose jacket and baggy pants draped by cloth
simulation, gear, then export a skinned GLB and QA renders.

  Blender --background --python tools/blender/rider.py -- <rider id> <out dir>
"""
import bpy, bmesh, math, sys, json, os
from mathutils import Vector, Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
args = sys.argv[sys.argv.index("--") + 1:]
RID, OUT = args[0], args[1]
os.makedirs(OUT, exist_ok=True)
P = json.load(open(os.path.join(ROOT, "tools/blender/riders.json")))[RID]
hexc = lambda h: tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)) + (1,)
srgb = lambda c: tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c[:3]) + (1,)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, f"assets/models/ubc/Superhero_{P['sex']}_FullBody.gltf"))
arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
body = max((o for o in bpy.context.scene.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
for o in list(bpy.context.scene.objects):
    if o.type == "MESH" and o is not body and o.name not in ("Eyes",):
        bpy.data.objects.remove(o)

# ---- Real height: scale the whole rig, then apply.
h = max((body.matrix_world @ v.co).z for v in body.data.vertices) - min((body.matrix_world @ v.co).z for v in body.data.vertices)
k = P["height"] / h
arm.scale = [s * k for s in arm.scale]
bpy.context.view_layer.update()

# ---- A-pose: lower the arms ~45 degrees and make it the rest pose.
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
for side, s in (("l", 1), ("r", -1)):
    pb = arm.pose.bones[f"upperarm_{side}"]
    # Rotate in world space about the forward axis so the arm swings down at the shoulder.
    world_axis = Vector((0, 1, 0))
    R = Matrix.Rotation(math.radians(45 * s), 4, world_axis)
    mw = arm.matrix_world @ pb.matrix
    loc = mw.to_translation()
    new = Matrix.Translation(loc) @ R @ Matrix.Translation(-loc) @ mw
    pb.matrix = arm.matrix_world.inverted() @ new
    bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode="OBJECT")
for o in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
    mod = next(m for m in o.modifiers if m.type == "ARMATURE")
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=mod.name)  # bake the pose into the mesh
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode="OBJECT")
for o in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
    m = o.modifiers.new("Armature", "ARMATURE"); m.object = arm
bpy.ops.object.select_all(action="DESELECT")
for o in bpy.context.scene.objects: o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

# ---- Body landmarks (world space, z up).
def bone_head(n): return arm.matrix_world @ arm.data.bones[n].head_local
hip_z = bone_head("pelvis").z
neck_z = bone_head("neck_01").z
head_z = bone_head("Head").z
foot_z = bone_head("foot_l").z
knee_z = bone_head("calf_l").z
print("LANDMARKS", round(hip_z, 3), round(neck_z, 3), round(head_z, 3), round(foot_z, 3), round(knee_z, 3))

def groups_of(o, prefixes):
    return {g.index for g in o.vertex_groups if any(g.name.startswith(p) for p in prefixes)}

def dominant(o):
    dom = {}
    for v in o.data.vertices:
        if v.groups:
            g = max(v.groups, key=lambda g: g.weight)
            dom[v.index] = o.vertex_groups[g.group].name
    return dom

def garment(name, keep, push, extend_down=0.0, flare=0.0):
    """Copy the body, keep vertices where keep(name_of_bone, world_co) is true, push them out along normals."""
    g = body.copy(); g.data = body.data.copy(); g.name = name
    bpy.context.scene.collection.objects.link(g)
    dom = dominant(g)
    bm = bmesh.new(); bm.from_mesh(g.data)
    bm.verts.ensure_lookup_table()
    gone = [v for v in bm.verts if not keep(dom.get(v.index, ""), g.matrix_world @ v.co)]
    bmesh.ops.delete(bm, geom=gone, context="VERTS")
    bm.normal_update()
    for v in bm.verts:
        co = g.matrix_world @ v.co
        v.co += v.normal * push(co)
    # Extend the bottom edge downward: an untucked hem or a cuff over the boot.
    if extend_down:
        edges = [e for e in bm.edges if e.is_boundary and min((g.matrix_world @ e.verts[0].co).z, (g.matrix_world @ e.verts[1].co).z) < (hip_z + 0.05 if name == "jacket" else knee_z)]
        if edges:
            ret = bmesh.ops.extrude_edge_only(bm, edges=edges)
            newv = [e for e in ret["geom"] if isinstance(e, bmesh.types.BMVert)]
            for v in newv:
                c = g.matrix_world @ v.co
                out = Vector((c.x, c.y, 0)).normalized() * flare if name == "jacket" else Vector((0, 0, 0))
                v.co += g.matrix_world.inverted().to_3x3() @ (Vector((0, 0, -extend_down)) + out)
    bm.to_mesh(g.data); bm.free()
    for m in list(g.modifiers):
        if m.type != "ARMATURE": g.modifiers.remove(m)
    g.data.materials.clear()
    return g

# ---- Clothes as loose tubes: measure the body's cross-section every few centimetres along an axis and
# build smooth rings outside it with ease. No muscles show through, unlike pushing the skin out.
dom = dominant(body)
W = [(body.matrix_world @ v.co, dom.get(v.index, "")) for v in body.data.vertices]
def pts(prefixes): return [c for c, b in W if b.startswith(prefixes)]

def tube(name, rings, segs=32, cap=False):
    """rings: list of (centre Vector, axis Vector, rx, ry, xdir Vector). Returns a mesh object."""
    bm = bmesh.new(); prev = None; first = None
    for (c, ax, rx, ry, xd) in rings:
        yd = ax.cross(xd).normalized(); ring = []
        for i in range(segs):
            t = 2 * math.pi * i / segs
            ring.append(bm.verts.new(c + xd * (math.cos(t) * rx) + yd * (math.sin(t) * ry)))
        if prev:
            for i in range(segs):
                bm.faces.new((prev[i], prev[(i + 1) % segs], ring[(i + 1) % segs], ring[i]))
        first = first or ring; prev = ring
    if cap: bm.faces.new(list(reversed(first)))
    me = bpy.data.meshes.new(name); bm.normal_update(); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    for f in o.data.polygons: f.use_smooth = True
    return o

def smooth_list(xs, n=2):
    out = list(xs)
    for _ in range(n):
        out = [out[0]] + [(out[i - 1] + 2 * out[i] + out[i + 1]) / 4 for i in range(1, len(out) - 1)] + [out[-1]]
    return out

def section(points, centre, ax, xd, half=0.012):
    """Extent of the points in a thin slab across the axis: centre offset and radii along xd and yd."""
    yd = ax.cross(xd).normalized()
    sl = [p for p in points if abs((p - centre).dot(ax)) < half]
    if len(sl) < 6: return None
    xs = [(p - centre).dot(xd) for p in sl]; ys = [(p - centre).dot(yd) for p in sl]
    return ((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, (max(xs) - min(xs)) / 2, (max(ys) - min(ys)) / 2)

Z, X = Vector((0, 0, 1)), Vector((1, 0, 0))
# Jacket body: from 10 cm below the waist (untucked hem) up to the neck.
torso_pts = pts(("spine", "pelvis", "clavicle"))
top, hem = neck_z - 0.01, hip_z + 0.04 - 0.12
zs = [hem + (top - hem) * i / 30 for i in range(31)]
secs = []
for z in zs:
    sc = section(torso_pts, Vector((0, 0, max(z, hip_z + 0.04))), Z, X, 0.015)
    secs.append(sc or secs[-1])
ox = smooth_list([s[0] for s in secs], 3); oy = smooth_list([s[1] for s in secs], 3)
rx = smooth_list([s[2] for s in secs], 3); ry = smooth_list([s[3] for s in secs], 3)
rings = []
for i, z in enumerate(zs):
    t = (z - hem) / (top - hem)
    ease = 0.055 if t < 0.85 else 0.055 - (t - 0.85) / 0.15 * 0.03  # loose body, closer at the collar
    flare = 0.02 * max(0, 1 - t / 0.2)  # the hem kicks out a little
    rings.append((Vector((ox[i], oy[i], z)), Z, rx[i] + ease + flare, ry[i] + ease + flare, X))
jacket = tube("jacket", rings, segs=40)
# Sleeves: shoulder to wrist, a little baggy, gathered at the cuff.
sleeves = []
for side in ("l", "r"):
    a0, a1 = bone_head(f"upperarm_{side}"), bone_head(f"hand_{side}")
    ax = (a1 - a0).normalized(); xd = ax.cross(Vector((0, 1, 0))).normalized()
    arm_pts = pts((f"upperarm_{side}", f"lowerarm_{side}", f"clavicle_{side}"))
    L = (a1 - a0).length; n = 20; rr = []
    for i in range(n + 1):
        c = a0 + ax * (L * (i / n) - 0.04)
        sc = section(arm_pts, c, ax, xd, 0.02)
        rr.append(max(sc[2], sc[3]) if sc else (rr[-1] if rr else 0.06))
    rr = smooth_list(rr, 4)
    rings = []
    for i in range(n + 1):
        t = i / n
        r = rr[i] + 0.035 - (0.02 if t > 0.92 else 0)
        rings.append((a0 + ax * (L * t - 0.04), ax, r, r, xd))
    sleeves.append(tube(f"sleeve_{side}", rings, segs=24))
for o in sleeves:
    o.select_set(True)
jacket.select_set(True); bpy.context.view_layer.objects.active = jacket
bpy.ops.object.join()

# Pants: a seat from the waist to the crotch, then two balloon legs gathered at the boot.
pelvis_pts = pts(("pelvis", "thigh"))
crotch = bone_head("thigh_l").z - 0.08
seat = []
for i in range(9):
    z = hip_z + 0.06 - (hip_z + 0.06 - crotch) * i / 8
    sc = section(pelvis_pts, Vector((0, 0, z)), Z, X, 0.015)
    seat.append((Vector((sc[0], sc[1], z)), Z, sc[2] + 0.03 + 0.02 * i / 8, sc[3] + 0.03 + 0.02 * i / 8, X))
pants = tube("pants", seat, segs=40)
legs = []
for side in ("l", "r"):
    a0, a1 = bone_head(f"thigh_{side}"), bone_head(f"foot_{side}") + Vector((0, 0, 0.04))
    ax = (a1 - a0).normalized(); xd = Vector((1, 0, 0))
    leg_pts = pts((f"thigh_{side}", f"calf_{side}"))
    L = (a1 - a0).length; n = 24; rr = []
    for i in range(n + 1):
        sc = section(leg_pts, a0 + ax * (L * i / n), ax, xd, 0.02)
        rr.append(max(sc[2], sc[3]) if sc else rr[-1])
    rr = smooth_list(rr, 4)
    rings = []
    for i in range(n + 1):
        t = i / n
        balloon = 0.05 + 0.06 * math.sin(math.pi * min(1, t / 0.9)) ** 0.7  # roomy through the knee
        cuff = -0.05 * max(0, (t - 0.9) / 0.1)  # gathered over the boot
        r = rr[i] + balloon + cuff
        rings.append((a0 + ax * (L * t - 0.06), ax, r, r * 1.05, xd))
    legs.append(tube(f"leg_{side}", rings, segs=28))
for o in legs: o.select_set(True)
bpy.ops.object.select_all(action="DESELECT")
for o in legs + [pants]: o.select_set(True)
bpy.context.view_layer.objects.active = pants
bpy.ops.object.join()

def mat(name, color, rough=0.85):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = srgb(hexc(color)); bsdf.inputs["Roughness"].default_value = rough
    return m
jacket.data.materials.append(mat("jacket", P["jacket"]))
pants.data.materials.append(mat("pants", P["pants"]))
# Soft fabric: subdivided, a faint crumple, a little thickness.
tex = bpy.data.textures.new("crumple", "CLOUDS"); tex.noise_scale = 0.08
for o in (jacket, pants):
    sd = o.modifiers.new("subd", "SUBSURF"); sd.levels = sd.render_levels = 1
    dp = o.modifiers.new("crumple", "DISPLACE"); dp.texture = tex; dp.strength = 0.012; dp.mid_level = 0.5
    so = o.modifiers.new("thick", "SOLIDIFY"); so.thickness = 0.006

# ---- Renders.
def render(tag, angle):
    cam = bpy.data.objects.get("cam") or bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    if cam.name not in bpy.context.scene.collection.objects: bpy.context.scene.collection.objects.link(cam)
    r = 3.4
    cam.location = (math.sin(angle) * r, -math.cos(angle) * r, P["height"] * 0.55)
    cam.rotation_euler = (math.radians(90), 0, angle)
    cam.data.lens = 50
    bpy.context.scene.camera = cam
    bpy.context.scene.render.filepath = os.path.join(OUT, f"{RID}_{tag}.png")
    bpy.ops.render.render(write_still=True)
if not bpy.data.objects.get("sun"):
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3
    sun.rotation_euler = (math.radians(50), 0, math.radians(30)); bpy.context.scene.collection.objects.link(sun)
w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.8, 0.85, 0.92, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.8
bpy.context.scene.world = w
s = bpy.context.scene; s.render.engine = "BLENDER_EEVEE"; s.render.resolution_x, s.render.resolution_y = 420, 700
for tag, a in (("front", 0), ("side", math.pi / 2), ("back", math.pi)):
    render(tag, a)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f"{RID}.blend"))
print("DONE")
