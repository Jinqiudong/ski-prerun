"""The shared kit for the facility models: materials, parts, and the bake-and-export step.
Family modules (lifts.py, buildings.py, …) build models with these; build.py runs them.
See README.md for the conventions (axes, units, kinds, palette, budgets)."""
import bpy, bmesh, math, os, random
import numpy as np
from mathutils import Vector

OUT = "."  # set by build.py
rnd = random.Random(7)

# ---------- materials ----------
def _mat(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    return m, m.node_tree.nodes, m.node_tree.links

def _bsdf(nodes): return next(n for n in nodes if n.type == "BSDF_PRINCIPLED")

def ramp(nodes, links, src, stops):
    r = nodes.new("ShaderNodeValToRGB"); el = r.color_ramp.elements
    el[0].position, el[0].color = stops[0][0], (*stops[0][1], 1)
    el[1].position, el[1].color = stops[-1][0], (*stops[-1][1], 1)
    for p, c in stops[1:-1]: e = el.new(p); e.color = (*c, 1)
    links.new(src, r.inputs[0]); return r

def coords(nodes, links, scale=(1, 1, 1)):
    tc = nodes.new("ShaderNodeTexCoord"); mp = nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = scale
    links.new(tc.outputs["Object"], mp.inputs["Vector"]); return mp.outputs["Vector"]

def srgb(h): h = h.lstrip("#"); return tuple(((int(h[i:i + 2], 16) / 255) ** 2.2) for i in (0, 2, 4))

def flat(name, hexc, rough=0.7, metal=0.0, grain=0.06):
    m, n, l = _mat(name); b = _bsdf(n); c = srgb(hexc)
    if grain:
        nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 6; nz.inputs["Detail"].default_value = 4
        links_in = coords(n, l); l.new(links_in, nz.inputs["Vector"])
        r = ramp(n, l, nz.outputs["Fac"], [(0.3, tuple(x * (1 - grain) for x in c)), (0.7, tuple(min(1, x * (1 + grain)) for x in c))])
        l.new(r.outputs["Color"], b.inputs["Base Color"])
    else: b.inputs["Base Color"].default_value = (*c, 1)
    b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    return m

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex")

def textured(name, key, size=1.5, tint=(1, 1, 1), rough=0.8, grain="X", bump=0.8):
    """A Poly Haven texture laid on by box projection in object space, size metres a tile, tinted.
    grain: the axis the texture's horizontal runs along on the sides."""
    m, n, l = _mat(name); b = _bsdf(n)
    tc = n.new("ShaderNodeTexCoord"); mp = n.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1 / size,) * 3
    if grain == "Z": mp.inputs["Rotation"].default_value = (0, math.pi / 2, 0)
    elif grain == "Y": mp.inputs["Rotation"].default_value = (0, 0, math.pi / 2)
    l.new(tc.outputs["Object"], mp.inputs["Vector"])
    def img(kind, color):
        t = n.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(os.path.join(TEX, f"{key}_{kind}.jpg"), check_existing=True)
        if not color: t.image.colorspace_settings.name = "Non-Color"
        t.projection = "BOX"; t.projection_blend = 0.25; l.new(mp.outputs[0], t.inputs["Vector"]); return t
    d = img("diff", True); mx = n.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"; mx.inputs[0].default_value = 1
    l.new(d.outputs["Color"], mx.inputs[6]); mx.inputs[7].default_value = (*tint, 1); l.new(mx.outputs[2], b.inputs["Base Color"])
    nm = n.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = bump; l.new(img("nor_gl", False).outputs["Color"], nm.inputs["Color"]); l.new(nm.outputs[0], b.inputs["Normal"])
    b.inputs["Roughness"].default_value = rough
    return m

# The palette: honey logs, weathered grey-brown timber, warm grey stone, charcoal shingles.
SPEC = {  # name: texture, tile size m, tint, the axis its grain runs along
    "log": ("fine_grained_wood", 1.2, (1.45, 1.18, 0.92), "X"), "logy": ("fine_grained_wood", 1.2, (1.45, 1.18, 0.92), "Y"),
    "logend": ("fine_grained_wood", 0.6, (1.6, 1.3, 1.0), "X"), "timber": ("old_planks_02", 1.6, (0.78, 0.68, 0.6), "Z"),
    "deck": ("brown_planks_05", 2.2, (0.82, 0.74, 0.64), "X"), "roof": ("grey_roof_01", 2.2, (0.62, 0.62, 0.64), "X"),
    "inner": ("old_planks_02", 1.6, (0.45, 0.4, 0.36), "Z"), "boards": ("old_planks_02", 1.8, (0.85, 0.74, 0.64), "Z"),
    "bark": ("fine_grained_wood", 0.8, (0.8, 0.7, 0.6), "Z"),
}

def wood(name, dark, light, axis="X", scale=1.0):
    if name in SPEC: k, sz, tint, g = SPEC[name]; return textured(name, k, sz, tint, 0.85, g)
    return _wood(name, dark, light, axis, scale)

def stone(name): return textured(name, "old_stone_wall", 2.0, (0.92, 0.9, 0.9), 0.9, "X", bump=1.0)

def _wood(name, dark, light, axis="X", scale=1.0):
    m, n, l = _mat(name); b = _bsdf(n)
    sc = {"X": (0.15, 3, 3), "Y": (3, 0.15, 3), "Z": (3, 3, 0.15)}[axis]
    v = coords(n, l, tuple(s * scale for s in sc))
    nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 4; nz.inputs["Detail"].default_value = 8; nz.inputs["Distortion"].default_value = 2.5
    l.new(v, nz.inputs["Vector"])
    r = ramp(n, l, nz.outputs["Fac"], [(0.3, srgb(dark)), (0.5, tuple((a + c) / 2 for a, c in zip(srgb(dark), srgb(light)))), (0.72, srgb(light))])
    l.new(r.outputs["Color"], b.inputs["Base Color"]); b.inputs["Roughness"].default_value = 0.85
    return m

def _stone(name):
    m, n, l = _mat(name); b = _bsdf(n); v = coords(n, l, (1.4, 1.4, 2.4))
    vc = n.new("ShaderNodeTexVoronoi"); vc.inputs["Scale"].default_value = 1.6; l.new(v, vc.inputs["Vector"])
    ve = n.new("ShaderNodeTexVoronoi"); ve.feature = "DISTANCE_TO_EDGE"; ve.inputs["Scale"].default_value = 1.6; l.new(v, ve.inputs["Vector"])
    hue = ramp(n, l, vc.outputs["Color"], [(0.0, srgb("#7d756b")), (0.35, srgb("#a59a8a")), (0.7, srgb("#8f8a82")), (1.0, srgb("#b8ab96"))])
    edge = ramp(n, l, ve.outputs["Distance"], [(0.0, (0.12, 0.11, 0.1)), (0.06, (1, 1, 1))])
    mx = n.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"; mx.inputs[0].default_value = 1
    l.new(hue.outputs["Color"], mx.inputs[6]); l.new(edge.outputs["Color"], mx.inputs[7]); l.new(mx.outputs[2], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.9; return m

def snow(name="snow"):
    m, n, l = _mat(name); b = _bsdf(n); v = coords(n, l, (2, 2, 2))
    nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 3; l.new(v, nz.inputs["Vector"])
    r = ramp(n, l, nz.outputs["Fac"], [(0.35, srgb("#e9eef6")), (0.65, srgb("#fbfcfe"))])
    l.new(r.outputs["Color"], b.inputs["Base Color"]); b.inputs["Roughness"].default_value = 0.6; return m

def glass(name, hexc, alpha=0.35):
    m, n, l = _mat(name); b = _bsdf(n); b.inputs["Base Color"].default_value = (*srgb(hexc), 1)
    b.inputs["Roughness"].default_value = 0.05; b.inputs["Alpha"].default_value = alpha
    try: m.surface_render_method = "BLENDED"
    except Exception: m.blend_method = "BLEND"
    return m

def lit(name, hexc="#ffb15e", strength=1.2, base="#1f2830", window=True):
    m, n, l = _mat(name); b = _bsdf(n); b.inputs["Base Color"].default_value = (*srgb(base), 1)
    b.inputs["Emission Strength"].default_value = strength; b.inputs["Roughness"].default_value = 0.3
    if not window: b.inputs["Emission Color"].default_value = (*srgb(hexc), 1); return m
    # A painted window: warm room light low, paler higher, a cool streak of sky reflection across it.
    tc = n.new("ShaderNodeTexCoord"); sep = n.new("ShaderNodeSeparateXYZ"); l.new(tc.outputs["Object"], sep.inputs[0])
    glow = ramp(n, l, sep.outputs["Z"], [(0.0, srgb("#9a4612")), (0.12, srgb("#e8862e")), (0.45, srgb("#ffa94d")), (1.0, srgb("#ffc77e"))])
    mp = n.new("ShaderNodeMapping"); mp.inputs["Rotation"].default_value = (0, 0.7, 0); mp.inputs["Scale"].default_value = (0.35, 0.35, 0.35); l.new(tc.outputs["Object"], mp.inputs[0])
    wv = n.new("ShaderNodeTexWave"); wv.inputs["Scale"].default_value = 1.0; wv.inputs["Distortion"].default_value = 1.5; l.new(mp.outputs[0], wv.inputs["Vector"])
    streak = ramp(n, l, wv.outputs["Fac"], [(0.0, (1, 1, 1)), (0.8, (1, 1, 1)), (0.9, (0.55, 0.62, 0.75)), (1.0, (1, 1, 1))])
    mx = n.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"; mx.inputs[0].default_value = 1
    l.new(glow.outputs["Color"], mx.inputs[6]); l.new(streak.outputs["Color"], mx.inputs[7]); l.new(mx.outputs[2], b.inputs["Emission Color"])
    return m

# ---------- parts ----------
COL = None
def new_col(name):
    global COL
    COL = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(COL)

def _link(o, mat, kind):
    for c in o.users_collection: c.objects.unlink(o)
    COL.objects.link(o); o.data.materials.append(mat); o["kind"] = kind; return o

def box(size, loc, mat, rot=(0, 0, 0), bevel=0.0, seg=2, kind="bake", subsurf=0):
    me = bpy.data.meshes.new("box"); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("box", me); bpy.context.scene.collection.objects.link(o)
    o.scale = size; o.location = loc; o.rotation_euler = rot
    _link(o, mat, kind)
    if bevel: md = o.modifiers.new("b", "BEVEL"); md.width = bevel; md.segments = seg; md.use_clamp_overlap = True; md.affect = "EDGES"
    if subsurf: o.modifiers.new("s", "SUBSURF").levels = subsurf
    return o

def cyl(r, depth, loc, mat, rot=(0, 0, 0), verts=14, r2=None, kind="bake", bevel=0.0):
    me = bpy.data.meshes.new("cyl"); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r if r2 is None else r2, depth=depth); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("cyl", me); bpy.context.scene.collection.objects.link(o)
    o.location = loc; o.rotation_euler = rot; _link(o, mat, kind)
    for p in o.data.polygons: p.use_smooth = True
    if bevel: md = o.modifiers.new("b", "BEVEL"); md.width = bevel; md.segments = 2
    return o

def blob(size, loc, mat, rot=(0, 0, 0), lumps=0.06, kind="snow"):
    """A soft pillow of snow: a box rounded off, a little lumpy."""
    o = box(size, loc, mat, rot, bevel=min(size) * 0.45, seg=3, kind=kind, subsurf=2)
    if lumps:
        t = bpy.data.textures.get("lumps") or bpy.data.textures.new("lumps", "CLOUDS"); t.noise_scale = 0.6
        d = o.modifiers.new("d", "DISPLACE"); d.texture = t; d.strength = lumps; d.mid_level = 0.5; d.texture_coords = "GLOBAL"
    return o

def slab(size, loc, mat, rot=(0, 0, 0), kind="snow"):
    """Snow lying on a roof: a layer with a flat top, soft edges and a little unevenness, thick at the eave."""
    o = box(size, loc, mat, rot, bevel=min(size[2] * 0.45, 0.18), seg=4, kind=kind)
    t = bpy.data.textures.get("drift") or bpy.data.textures.new("drift", "CLOUDS"); t.noise_scale = 1.2
    sub = o.modifiers.new("s", "SUBSURF"); sub.levels = 1; sub.subdivision_type = "SIMPLE"
    d = o.modifiers.new("d", "DISPLACE"); d.texture = t; d.strength = 0.05; d.mid_level = 0.5; d.texture_coords = "GLOBAL"
    return o

def tri(pts, mat, kind="bake", thick=0.0):
    me = bpy.data.meshes.new("tri"); bm = bmesh.new(); vs = [bm.verts.new(p) for p in pts]; bm.faces.new(vs)
    if thick: r = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:]); bmesh.ops.translate(bm, vec=Vector((0, thick, 0)), verts=[e for e in r["geom"] if isinstance(e, bmesh.types.BMVert)])
    bm.to_mesh(me); bm.free(); o = bpy.data.objects.new("tri", me); bpy.context.scene.collection.objects.link(o); return _link(o, mat, kind)

def curve_pipe(pts, r, mat, kind="bake"):
    cu = bpy.data.curves.new("pipe", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = r; cu.bevel_resolution = 3; cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts): bp.co = p; bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new("pipe", cu); bpy.context.scene.collection.objects.link(o); return _link(o, mat, kind)

def text(s, size, loc, mat, rot=(math.pi / 2, 0, 0), extrude=0.02, kind="flat"):
    cu = bpy.data.curves.new("t", "FONT"); cu.body = s; cu.size = size; cu.extrude = extrude; cu.align_x = "CENTER"; cu.align_y = "CENTER"
    o = bpy.data.objects.new("t", cu); bpy.context.scene.collection.objects.link(o); o.location = loc; o.rotation_euler = rot
    return _link(o, mat, kind)

# ---------- bake and export ----------
def select_only(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

def join(objs, name):
    # Bake every part's transform into its mesh first: textures are projected in the joined object's
    # space, which would otherwise be the first part's (a scaled box stretches every texture).
    select_only(objs); bpy.ops.object.convert(target="MESH")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = name; return o

SUN_DIR = Vector((-0.55, -0.55, 0.62)).normalized()  # towards the sun: the game's sun, in Blender axes

def finalize(name, size=2048, ao_dist=1.5, samples=48):
    """Join the bakeable parts, unwrap, bake their colour, occlusion and surface normals into one atlas,
    and export. Light comes from the game; the atlas carries the materials and the soft contact shade."""
    sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = samples
    sc.world = sc.world or bpy.data.worlds.new("w")
    groups = {}
    for o in list(COL.objects):
        k = o["kind"]
        if k == "bake" and o.data.materials[0].name.startswith("snow"): k = "snow"
        groups.setdefault(k, []).append(o)
    body = join(groups["bake"], name)
    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0)); ground = bpy.context.active_object
    for k, objs in groups.items():
        if k not in ("bake", "snow"):
            for o in objs: o.hide_render = True
    select_only([body]); bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004)
    bpy.ops.object.mode_set(mode="OBJECT")
    def bake(kind, **kw):
        img = bpy.data.images.new(f"{name}_{kind}", size, size, alpha=False)
        if kind != "color": img.colorspace_settings.name = "Non-Color"
        for m in body.data.materials:
            nd = m.node_tree.nodes.new("ShaderNodeTexImage"); nd.image = img
            for x in m.node_tree.nodes: x.select = False
            nd.select = True; m.node_tree.nodes.active = nd
        select_only([body]); bpy.ops.object.bake(margin=8, **kw); return img
    sc.world.light_settings.distance = ao_dist
    # A diffuse-colour bake reads black for metal: bake the paint colour with metal off; the baked
    # material stays non-metallic, and shine comes from the game's environment.
    for m in body.data.materials:
        bs = next((x for x in m.node_tree.nodes if x.type == "BSDF_PRINCIPLED"), None)
        if bs: bs.inputs["Metallic"].default_value = 0
    col = bake("color", type="DIFFUSE", pass_filter={"COLOR"}); ao = bake("ao", type="AO"); nor = bake("normal", type="NORMAL", normal_space="TANGENT")
    c = np.array(col.pixels[:], np.float32).reshape(-1, 4); a = np.array(ao.pixels[:], np.float32).reshape(-1, 4)[:, :1]
    c[:, :3] *= 0.38 + 0.62 * a
    def save(img_px, tag, colorspace):
        out = bpy.data.images.new(f"{name}_{tag}", size, size, alpha=False); out.colorspace_settings.name = colorspace
        out.pixels = img_px.ravel(); out.filepath_raw = os.path.join(OUT, f"{name}_{tag}.png"); out.file_format = "PNG"; out.save(); return out
    tcol = save(c, "tex", "sRGB"); tnor = save(np.array(nor.pixels[:], np.float32), "nor", "Non-Color")
    m, n, l = _mat(f"{name}_baked"); b = _bsdf(n); t = n.new("ShaderNodeTexImage"); t.image = tcol
    l.new(t.outputs["Color"], b.inputs["Base Color"]); b.inputs["Roughness"].default_value = 0.85
    tn = n.new("ShaderNodeTexImage"); tn.image = tnor; nm = n.new("ShaderNodeNormalMap"); l.new(tn.outputs["Color"], nm.inputs["Color"]); l.new(nm.outputs[0], b.inputs["Normal"])
    body.data.materials.clear(); body.data.materials.append(m)
    keep = [body]
    if "snow" in groups: keep.append(snow_ao(join(groups["snow"], f"{name}_snow"), ao_dist))
    bpy.data.objects.remove(ground)
    for k, objs in groups.items():
        if k in ("bake", "snow"): continue
        o = join(objs, f"{name}_{k}"); o.hide_render = False; keep.append(o)
    select_only(keep)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{name}.glb"), export_format="GLB", use_selection=True, export_apply=True,
                              export_draco_mesh_compression_enable=True, export_image_format="JPEG", export_vertex_color="ACTIVE")
    for t in (tcol, tnor): os.remove(t.filepath_raw)
    print(f"built {name}: {sum(len(o.data.polygons) for o in keep)} faces")

def snow_ao(o, dist):
    """Bake occlusion into the snow's vertex colours: cool blue-grey in the hollows, white in the open."""
    me = o.data; attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT"); me.color_attributes.active_color = attr
    for p in me.polygons: p.use_smooth = True
    bpy.context.scene.world.light_settings.distance = dist
    select_only([o]); bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    lo, hi = np.array(srgb("#8d9db5")), np.array(srgb("#f4f6fa"))
    for d in attr.data:
        a = min(1.0, d.color[0] * 1.1); c = lo + (hi - lo) * a; d.color = (*c, 1.0)
    m, n, l = _mat(f"{o.name}_mat"); b = _bsdf(n); ca = n.new("ShaderNodeVertexColor"); ca.layer_name = "Col"
    l.new(ca.outputs["Color"], b.inputs["Base Color"]); b.inputs["Roughness"].default_value = 0.75
    me.materials.clear(); me.materials.append(m)
    return o

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
