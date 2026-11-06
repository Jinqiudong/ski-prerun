"""Build the resort animals as small rigged 3D models with a walk cycle, in the owner's wildlife sheet's
style (soft rounded fur, two-tone coats, snow on the back): each grown from a skeleton with Blender's Skin
modifier, smoothed, lightly lumped like fur, painted in vertex colours by body part, rigged with a bone per
limb (weights by nearest bone), walked in a 1 s loop, and saved as glTF.

usage: /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/build_animals.py -- [names…]
       → assets/animals/3d/<name>.glb   (Blender faces -Y: glTF +Z, the way src/start/resort-tiles.js walks them)
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "animals", "3d")
def hexc(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
def lin(c): return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

# A quadruped from a few numbers: body length/height, leg length, neck, head; colours by part. Nodes are
# (x, y, z, radius); y runs tail (+) to nose (-).
def quad(p):
    L, H, LEG, R = p["len"], p["leg"] + p["body"], p["leg"], p["body"]
    hip, chest = (0, L / 2, H), (0, -L / 2, H + p.get("withers", 0))
    nk = p.get("neck", 0.5)
    head = (0, chest[1] - p["head"] * 1.2 - nk * 0.55, chest[2] + nk * 0.85)
    snout = (0, head[1] - p["head"] * p.get("muzzle", 1.1), head[2] - p["head"] * p.get("drop", 0.35))
    N = {"hip": hip + (R * p.get("rump", 0.95),), "mid": (0, 0, H + p.get("withers", 0) * 0.5, R * p.get("belly", 1.05)), "chest": chest + (R,),
         "neck": (0, (chest[1] + head[1]) / 2, (chest[2] + head[2]) / 2, p["head"] * p.get("neckw", 0.75)),
         "head": head + (p["head"],), "snout": snout + (p["head"] * p.get("snoutw", 0.6),),
         "tail": (0, hip[1] + p.get("tail", 0.2), hip[2] + p.get("tailup", 0.05), p.get("tailw", R * 0.35))}
    if p.get("tail2"): N["tail2"] = (0, hip[1] + p["tail2"], hip[2] - p.get("taildrop", 0.1), p.get("tailw2", R * 0.5))
    if p.get("tail3"): N["tail3"] = (0, hip[1] + p["tail3"], hip[2] - p.get("taildrop", 0.1) * 1.6, p.get("tailw3", R * 0.4))
    E = [("tail", "hip"), ("hip", "mid"), ("mid", "chest"), ("chest", "neck"), ("neck", "head"), ("head", "snout")]
    if "tail2" in N: E.append(("tail", "tail2"))
    if "tail3" in N: E.append(("tail2", "tail3"))
    for k, (x, y, z, r) in p.get("extra", {}).items(): N[k] = (x, chest[1] + y, chest[2] + z, r)  # humps, dewlaps: placed from the chest
    lw = p.get("legw", 0.12)
    for side, sx in (("L", 1), ("R", -1)):
        for end, base in ((("H", (0, 0, hip[2])),) if p.get("biped") else (("F", chest), ("H", hip))):
            x = sx * R * 0.55; y = base[1] + (0.05 if end == "F" else -0.05) * L
            N[f"top{end}{side}"] = (x, y, base[2] - R * 0.35, lw * 1.6)
            N[f"knee{end}{side}"] = (x, y + (0.02 if end == "F" else 0.06), LEG * 0.5, lw)
            N[f"foot{end}{side}"] = (x, y, 0.04, lw * 0.9)
            E += [(f"top{end}{side}", f"knee{end}{side}"), (f"knee{end}{side}", f"foot{end}{side}"), ("chest" if end == "F" else "hip", f"top{end}{side}")]
        if p.get("ears"):
            ex, ey, ez, er = p["ears"]
            N[f"ear{side}"] = (sx * ex, head[1] + ey, head[2] + ez, er)
            E.append(("head", f"ear{side}"))
    return N, E

# Per animal: shape, coat (by part), extras.
A = {
  "moose": dict(len=0.95, body=0.46, leg=0.92, head=0.25, neck=0.36, withers=0.16, muzzle=1.55, drop=0.7, snoutw=0.72, rump=0.85, tail=0.1, tailw=0.08,
                ears=(0.21, 0.1, 0.2, 0.065), legw=0.095, extra={"hump": (0, 0.12, 0.3, 0.36), "dewlap": (0, -0.55, -0.05, 0.1)},
                coat={"body": "#6e4b33", "thigh": "#5e3f2b", "neck": "#5a3d2a", "head": "#6e4b33", "snout": "#4a3324", "legs": "#cfae86", "feet": "#3a2c22", "ear": "#5a3d2a", "tail": "#5a3d2a", "hump": "#5e3f2b", "dewlap": "#4a3324"},
                antlers="moose", snow=0.5),
  "fox": dict(len=0.5, body=0.17, leg=0.27, head=0.13, neck=0.16, withers=0.02, muzzle=1.45, drop=0.25, snoutw=0.45, rump=0.95, tail=0.18, tailup=0.0, tailw=0.08,
              tail2=0.45, taildrop=0.1, tailw2=0.15, tail3=0.68, tailw3=0.1, ears=(0.075, 0.03, 0.15, 0.05), legw=0.04,
              coat={"body": "#d0702f", "thigh": "#c96a2c", "neck": "#efe8dc", "head": "#d0702f", "snout": "#efe8dc", "legs": "#3a2c25", "feet": "#2a211c", "ear": "#3a2c25", "tail": "#d0702f", "tail2": "#d0702f", "tail3": "#f4efe6"},
              snow=0.0),
  "elk": dict(len=0.9, body=0.36, leg=0.85, head=0.2, neck=0.42, withers=0.08, muzzle=1.5, drop=0.35, snoutw=0.6, rump=0.95, tail=0.08, tailw=0.06,
              ears=(0.15, 0.12, 0.14, 0.06), legw=0.07, neckw=1.1,
              coat={"body": "#c8a37a", "thigh": "#b48d66", "neck": "#5e4130", "head": "#7a5a42", "snout": "#4e3a2c", "legs": "#5e4130", "feet": "#2e241e", "ear": "#7a5a42", "tail": "#efe2c8"},
              antlers="elk", snow=0.55),
  "sheep": dict(len=0.7, body=0.3, leg=0.55, head=0.17, neck=0.25, withers=0.04, muzzle=1.2, drop=0.25, snoutw=0.6, rump=1.0, tail=0.05, tailw=0.06,
                ears=(0.15, 0.04, 0.05, 0.045), legw=0.06,
                coat={"body": "#b9976e", "thigh": "#a8875f", "neck": "#b9976e", "head": "#b9976e", "snout": "#f0e8da", "legs": "#a8875f", "feet": "#3a2e26", "ear": "#b9976e", "tail": "#f0e8da"},
                horns="curl", snow=0.55),
  "bear": dict(len=0.85, body=0.42, leg=0.4, head=0.24, neck=0.15, withers=0.12, muzzle=0.9, drop=0.15, snoutw=0.6, rump=1.0, belly=1.1, tail=0.05, tailw=0.06,
               ears=(0.17, 0.05, 0.2, 0.07), legw=0.13, swing=0.35, bob=0.04,
               coat={"body": "#3d302a", "thigh": "#35291f", "neck": "#3d302a", "head": "#3d302a", "snout": "#b48f69", "legs": "#35291f", "feet": "#251c17", "ear": "#3d302a", "tail": "#3d302a"},
               snow=0.6),
  "hare": dict(len=0.32, body=0.16, leg=0.12, head=0.12, neck=0.06, withers=0.03, muzzle=0.7, drop=0.05, snoutw=0.6, rump=1.25, tail=0.07, tailw=0.06,
               ears=(0.05, 0.05, 0.22, 0.05), earlen=3.2, legw=0.035, swing=0.6, bob=0.45,
               coat={"body": "#f3f2ee", "thigh": "#ecebe6", "neck": "#f3f2ee", "head": "#f3f2ee", "snout": "#f6f3ee", "legs": "#ecebe6", "feet": "#e3e1dc", "ear": "#5b5550", "tail": "#ffffff"}),
  "pika": dict(len=0.16, body=0.13, leg=0.05, head=0.11, neck=0.02, withers=0.0, muzzle=0.5, drop=0.05, snoutw=0.55, rump=1.1, tail=0.01, tailw=0.02,
               ears=(0.08, 0.03, 0.09, 0.05), legw=0.03, swing=0.5, bob=0.35,
               coat={"body": "#b5a48c", "thigh": "#a8977f", "neck": "#b5a48c", "head": "#b5a48c", "snout": "#cbbca6", "legs": "#9a8a74", "feet": "#6d6052", "ear": "#a8977f", "tail": "#b5a48c"}),
  "marmot": dict(len=0.3, body=0.18, leg=0.07, head=0.12, neck=0.05, withers=0.02, muzzle=0.75, drop=0.1, snoutw=0.6, rump=1.15, belly=1.15, tail=0.16, tailw=0.06, tailup=-0.05,
                 ears=(0.08, 0.04, 0.09, 0.035), legw=0.045, swing=0.5, bob=0.15,
                 coat={"body": "#8a6748", "thigh": "#7a5a3e", "neck": "#e0a94a", "head": "#8a6748", "snout": "#c9b49a", "legs": "#5e4532", "feet": "#3a2c22", "ear": "#7a5a3e", "tail": "#6e523a"}),
  "ptarmigan": dict(len=0.14, body=0.15, leg=0.08, head=0.09, neck=0.06, withers=0.06, muzzle=0.5, drop=0.0, snoutw=0.35, rump=0.9, tail=0.14, tailw=0.06, tailup=0.06,
                    legw=0.02, biped=True, swing=0.5, bob=0.1,
                    coat={"body": "#f4f3ef", "thigh": "#efeee9", "neck": "#f4f3ef", "head": "#f4f3ef", "snout": "#2a2522", "legs": "#f0eee8", "feet": "#efe9dc", "tail": "#f4f3ef"}),
}

def part_of(name):
    if name.startswith("top"): return "thigh"
    if name.startswith("knee"): return "legs"
    if name.startswith("foot"): return "feet"
    if name.startswith("ear"): return "ear"
    if name in ("hip", "mid", "chest"): return "body"
    return name

def build(name, p):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
    for a in list(bpy.data.armatures): bpy.data.armatures.remove(a)
    for ac in list(bpy.data.actions): bpy.data.actions.remove(ac)
    N, E = quad(p)
    # the body: metaballs along the skeleton — a ball at each joint, a capsule along each bone — melted
    # together into one soft, rounded shape (like the sheet's clay-soft animals), then made a mesh
    mb = bpy.data.metaballs.new(name); mb.resolution = p["body"] * 0.09; mb.render_resolution = mb.resolution; mb.threshold = 0.6
    K = 1.55  # element radius → its visible size at this threshold
    for n, (x, y, z, r) in N.items():
        el = mb.elements.new(); el.co = (x, y, z); el.radius = r * K
        if n in ("hip", "mid", "chest"): el.type = "ELLIPSOID"; el.size_x, el.size_y, el.size_z = 0.95, 1.25, 1.0
        if n == "snout": el.type = "ELLIPSOID"; el.size_x, el.size_y, el.size_z = 0.85, 1.25, 0.85
        if n.startswith("ear"): el.type = "ELLIPSOID"; el.size_x, el.size_y, el.size_z = 0.55, 0.35, p.get("earlen", 1.25); el.stiffness = 3
    for a, b in E:
        A_, B_ = Vector(N[a][:3]), Vector(N[b][:3]); d = B_ - A_
        if d.length < 1e-4 or a.startswith("ear") or b.startswith("ear"): continue
        el = mb.elements.new(); el.type = "CAPSULE"; el.co = (A_ + B_) / 2; el.size_x = d.length / 2
        el.radius = min(N[a][3], N[b][3]) * K * 0.95
        el.rotation = Vector((1, 0, 0)).rotation_difference(d.normalized())
    mo = bpy.data.objects.new(name + "_mb", mb); bpy.context.collection.objects.link(mo)
    bpy.context.view_layer.objects.active = mo; mo.select_set(True)
    bpy.ops.object.convert(target="MESH"); ob = bpy.context.object; ob.name = name; me = ob.data
    dec = ob.modifiers.new("dec", "DECIMATE"); dec.ratio = min(1, p.get("faces", 5000) / max(1, len(me.polygons)))
    tex = bpy.data.textures.new("fur", "CLOUDS"); tex.noise_scale = p["body"] * 0.25
    d = ob.modifiers.new("fur", "DISPLACE"); d.texture = tex; d.strength = p["body"] * 0.06; d.mid_level = 0.5
    for m in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.shade_smooth()
    # extras: eyes, nose, antlers — joined in, carried by the head
    extras = []
    def ball(loc, r, col, scale=(1, 1, 1)):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=16, ring_count=10); o = bpy.context.object; o.scale = scale; o["col"] = col; extras.append(o); return o
    hx, hy, hz = N["head"][:3]; hr = N["head"][3]; sx, sy, sz = N["snout"][:3]; sr = N["snout"][3]
    for s in (1, -1): ball((s * hr * 0.66, hy - hr * 0.62, hz + hr * 0.28), hr * 0.12, "#151210")
    ball((0, sy - sr * 1.12, sz + sr * 0.2), sr * 0.3, "#1a1512", (1.25, 0.8, 0.8))
    def rod(a, b, r, col):  # a tapered stick from a to b
        a, b = Vector(a), Vector(b); d = b - a
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r * 0.6, depth=d.length, location=(a + b) / 2, vertices=8)
        o = bpy.context.object; o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized()); o["col"] = col; extras.append(o); return o
    crown = Vector((hx, hy + hr * 0.15, hz + hr * 0.8))
    if p.get("antlers") == "moose":
        for s in (1, -1):
            root = crown + Vector((s * hr * 0.55, 0, 0)); out = root + Vector((s * 0.14, 0.02, 0.05))
            rod(root, out, 0.04, "#e6d2a8")
            palm = ball(out + Vector((s * 0.2, 0.03, 0.1)), 0.24, "#ead8b0", (1.25, 0.75, 0.28)); palm.rotation_euler = (0.25, -s * 0.5, 0)
            for k in range(6):
                u = k / 5; tip = out + Vector((s * (0.06 + u * 0.36), 0.12 - u * 0.12, 0.2 + math.sin(u * math.pi) * 0.12))
                ball(tip, 0.05, "#ead8b0", (0.8, 0.8, 1.7))
    if p.get("antlers") == "elk":
        for s in (1, -1):
            root = crown + Vector((s * hr * 0.45, 0, 0)); pts = [root]
            for k in range(1, 5): pts.append(root + Vector((s * (0.08 + k * 0.05), 0.1 * k, 0.16 * k - 0.012 * k * k)))
            for a_, b_ in zip(pts, pts[1:]): rod(a_, b_, 0.032 - 0.004 * pts.index(a_), "#7a5a3e")
            for k in (1, 2, 3, 4): rod(pts[k], pts[k] + Vector((s * 0.03, -0.14, 0.1 + 0.02 * k)), 0.02, "#7a5a3e")  # tines forward
    if p.get("horns") == "curl":
        for s in (1, -1):
            for k in range(14):  # a spiral of beads, thick to thin, round the ear
                u = k / 13 * 1.6 * math.pi; rr = hr * (0.55 - k * 0.018)
                ball(crown + Vector((s * (hr * 0.45 + 0.05 * k / 13), hr * 0.3 + math.cos(u) * rr * 0.9, -hr * 0.2 + math.sin(u) * rr)), hr * (0.26 - k * 0.012), "#d9c49c")
    if p.get("bell"):
        ball((0, sy + sr * 0.3, sz - sr * 0.9), sr * 0.35, "#4a3324", (0.6, 0.8, 1.6))
    # vertex colours: each vertex takes the colour of the nearest bone segment's part
    segs = [(Vector(N[a][:3]), Vector(N[b][:3]), "body" if part_of(a) == "body" and b.startswith("top") else part_of(b)) for a, b in E]
    segs += [(Vector(N[n][:3]), Vector(N[n][:3]), part_of(n)) for n in N]
    coat = p["coat"]; C = lambda part: Vector(hexc(coat.get(part, coat["thigh"] if part == "thigh" and "thigh" in coat else coat["body"])))
    def shade(v):  # the parts' colours blended by nearness, so coats meet softly
        ws, acc = 0, Vector((0, 0, 0))
        for a, b, part in segs:
            ab = b - a; t = max(0, min(1, (v - a).dot(ab) / max(1e-9, ab.dot(ab)))); dd = (a + ab * t - v).length
            w = 1 / (dd + p["body"] * 0.04) ** 8; ws += w; acc += C(part) * w
        return acc / ws
    def nearest(v):
        best = (1e9, None)
        for a, b, part in segs:
            ab = b - a; t = max(0, min(1, (v - a).dot(ab) / max(1e-9, ab.dot(ab)))); dd = (a + ab * t - v).length
            if dd < best[0]: best = (dd, part)
        return best[1]
    col = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    for v in me.vertices:
        part = nearest(v.co); c = tuple(shade(v.co))
        if part == "body" and v.co.z < N["mid"][2] - N["mid"][3] * 0.45: c = tuple(x * 0.82 for x in c)  # a darker belly
        if p.get("snow") and part in ("body", "neck", "hump") and v.co.z > N["mid"][2]:
            k = max(0, min(1, (v.normal.z - p["snow"]) / 0.12)); c = tuple(x * (1 - k) + w * k for x, w in zip(c, (0.96, 0.97, 0.99)))  # snow on the back
        col.data[v.index].color = lin(c) + (1,)
    for o in extras:
        c = hexc(o["col"]); m2 = o.data; ca = m2.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
        for v in m2.vertices: ca.data[v.index].color = lin(c) + (1,)
    # rig: a bone per limb segment, the spine, neck, head, tail
    bpy.ops.object.armature_add(location=(0, 0, 0)); arm = bpy.context.object; arm.name = name + "_rig"
    bpy.ops.object.mode_set(mode="EDIT"); eb = arm.data.edit_bones; eb.remove(eb[0])
    def bone(n, a, b, parent=None):
        x = eb.new(n); x.head = Vector(N[a][:3]); x.tail = Vector(N[b][:3]); x.roll = 0
        if parent: x.parent = eb[parent]
        return x
    bone("spine", "hip", "chest")
    bone("neck", "chest", "head", "spine"); bone("head", "head", "snout", "neck")
    bone("tail", "hip", "tail", "spine")
    if "tail2" in N: bone("tail2", "tail", "tail2", "tail")
    for side in "LR":
        for end in ("H" if p.get("biped") else "FH"):
            bone(f"thigh{end}{side}", f"top{end}{side}", f"knee{end}{side}", "spine")
            bone(f"shin{end}{side}", f"knee{end}{side}", f"foot{end}{side}", f"thigh{end}{side}")
    bpy.ops.object.mode_set(mode="OBJECT")
    # join the extras into the body; weights: rigid to the nearest bone (extras to the head)
    for o in extras: o.select_set(True)
    ob.select_set(True); bpy.context.view_layer.objects.active = ob; bpy.ops.object.join()
    bones = [(b.name, b.head_local.copy(), b.tail_local.copy()) for b in arm.data.bones]
    groups = {n: ob.vertex_groups.new(name=n) for n, _, _ in bones}
    hzmin = N["head"][2] - N["head"][3] * 0.2
    for v in ob.data.vertices:
        ds = []
        for n, a, b in bones:
            ab = b - a; t = max(0, min(1, (v.co - a).dot(ab) / max(1e-9, ab.dot(ab)))); ds.append(((a + ab * t - v.co).length, n))
        ds.sort()
        if ds[0][1] in ("head", "neck") or (v.co.z > hzmin and v.co.y < N["head"][1] + N["head"][3] * 1.5): pass
        w0, w1 = 1 / (ds[0][0] + 1e-3) ** 4, 1 / (ds[1][0] + 1e-3) ** 4
        groups[ds[0][1]].add([v.index], w0 / (w0 + w1), "REPLACE"); groups[ds[1][1]].add([v.index], w1 / (w0 + w1), "REPLACE")
    mod = ob.modifiers.new("rig", "ARMATURE"); mod.object = arm; ob.parent = arm
    # material: soft fur, painted by the vertex colours
    mat = bpy.data.materials.new(name + "_fur"); mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]; vc = mat.node_tree.nodes.new("ShaderNodeVertexColor"); vc.layer_name = "Col"
    mat.node_tree.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"]); bsdf.inputs["Roughness"].default_value = 0.9
    ob.data.materials.clear(); ob.data.materials.append(mat)
    # the walk: 24 frames, diagonal pairs together, the body bobbing, head nodding, tail swinging
    arm.animation_data_create(); act = bpy.data.actions.new(name + "_walk"); arm.animation_data.action = act
    bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode="POSE")
    pb = arm.pose.bones
    for b in pb: b.rotation_mode = "XYZ"
    sw = p.get("swing", 0.42)
    for f in range(0, 25, 2):
        ph = f / 24 * 2 * math.pi
        for side, s in (("L", 1), ("R", -1)):
            for end, off in ((("H", 0),) if p.get("biped") else (("F", 0), ("H", math.pi))):
                a = math.sin(ph + off + (0 if side == "L" else math.pi)) * sw
                pb[f"thigh{end}{side}"].rotation_euler = (a, 0, 0); pb[f"thigh{end}{side}"].keyframe_insert("rotation_euler", frame=f + 1)
                k = max(0, -math.cos(ph + off + (0 if side == "L" else math.pi))) * sw * (-0.9 if end == "F" else 0.9)  # the knee folds on the forward swing
                pb[f"shin{end}{side}"].rotation_euler = (k, 0, 0); pb[f"shin{end}{side}"].keyframe_insert("rotation_euler", frame=f + 1)
        pb["spine"].location = (0, 0, abs(math.sin(ph)) * p["body"] * p.get("bob", 0.06)); pb["spine"].keyframe_insert("location", frame=f + 1)
        pb["neck"].rotation_euler = (math.sin(ph * 2) * 0.06, 0, 0); pb["neck"].keyframe_insert("rotation_euler", frame=f + 1)
        pb["tail"].rotation_euler = (0, 0, math.sin(ph) * 0.25); pb["tail"].keyframe_insert("rotation_euler", frame=f + 1)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, 24
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + ".glb"), export_format="GLB", use_selection=True, export_animations=True,
                              export_apply=False, export_skins=True, export_attributes=True)
    print("built", name, len(ob.data.vertices))

names = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(A)
for n in names or list(A): build(n, A[n])
