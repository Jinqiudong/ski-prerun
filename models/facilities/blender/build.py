"""Build the detailed facility models in Blender and export them as GLB for the game.

usage: Blender -b -P models/facilities/blender/build.py -- <out dir> [restaurant gondola firstaid pine ...]

Each model is made of simple parts with procedural materials (wood, stone, snow, paint). The parts that
can be baked are joined into one mesh, unwrapped, and their colour and ambient occlusion are baked into
one texture, so the game draws a whole building with one material and gets soft shading for free.
Glass and lit windows stay as their own small meshes.
"""
import bpy, bmesh, math, os, sys, random
import numpy as np
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGS[0] if ARGS else "."
WANT = ARGS[1:] or ["restaurant", "gondola", "firstaid", "pine"]
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
    select_only(objs); bpy.ops.object.convert(target="MESH"); bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = name; return o

SUN_DIR = Vector((-0.55, -0.55, 0.62)).normalized()  # towards the sun: the game's sun, in Blender axes

def light_rig():
    sc = bpy.context.scene; w = sc.world or bpy.data.worlds.new("w"); sc.world = w
    try: w.use_nodes = True
    except Exception: pass
    bg = w.node_tree.nodes.get("Background") or w.node_tree.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (*srgb("#9db8dc"), 1); bg.inputs["Strength"].default_value = 1.1
    out = next((x for x in w.node_tree.nodes if x.type == "OUTPUT_WORLD"), None) or w.node_tree.nodes.new("ShaderNodeOutputWorld")
    w.node_tree.links.new(bg.outputs[0], out.inputs[0])
    ld = bpy.data.lights.new("sun", "SUN"); ld.energy = 3.6; ld.color = srgb("#fff0d8"); ld.angle = math.radians(4)
    o = bpy.data.objects.new("sun", ld); sc.collection.objects.link(o); o.rotation_euler = SUN_DIR.to_track_quat("Z", "Y").to_euler()

def tone(c, k=0.95):
    """Linear light to a painted value: a soft shoulder, then sRGB."""
    c = 1.0 - np.exp(-c * k)
    return np.clip(c, 0, 1) ** (1 / 2.2)

def kuwahara(img, r):
    """Brush the texture: each pixel takes the mean of whichever of its four corner windows is calmest."""
    H, W, _ = img.shape; img = img.astype(np.float32); lum = img @ np.array([0.3, 0.59, 0.11], np.float32)
    def integ(a):
        p = np.pad(a, ((r, r), (r, r)) + ((0, 0),) * (a.ndim - 2), mode="edge")
        S = np.zeros((p.shape[0] + 1, p.shape[1] + 1) + p.shape[2:], np.float32); S[1:, 1:] = p.cumsum(0).cumsum(1); return S
    Si, Sl, Sl2 = integ(img), integ(lum), integ(lum * lum); n = (r + 1) ** 2
    best = np.full((H, W), np.inf, np.float32); out = np.zeros_like(img)
    ys, xs = np.arange(H), np.arange(W)
    for dy in (-r, 0):
        for dx in (-r, 0):
            a, b = ys + dy + r, xs + dx + r
            def win(S): return S[a + r + 1][:, b + r + 1] - S[a][:, b + r + 1] - S[a + r + 1][:, b] + S[a][:, b]
            m = win(Sl) / n; v = win(Sl2) / n - m * m; mc = win(Si) / n
            k = v < best; best[k] = v[k]; out[k] = mc[k]
    return out

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

# ---------- models ----------
def restaurant():
    """A mountain restaurant: stone footing, log walls, a glass gable front lit warm from inside,
    a deep snowy roof, a deck with tables and parasols, a board rack."""
    new_col("restaurant")
    W, D, F, T, R = 16.0, 11.0, 1.2, 5.0, 4.4
    ST, LOG, TIM, DECK, ROOF, SN = stone("stone"), wood("log", "#5a3b26", "#8c6240", "X"), wood("timber", "#4a3020", "#6e4a31", "Z"), wood("deck", "#7a5638", "#a37a52", "X"), wood("roof", "#3b2a22", "#54392b", "Y"), snow()
    LOGY = wood("logy", "#5a3b26", "#8c6240", "Y")
    WIN, LAMP, GL = lit("window"), lit("lamp", "#ffd9a0", 6.0, "#ffffff", window=False), glass("glass", "#9fb6c8", 0.25)
    box((W + 0.4, D + 0.4, F + 0.3), (0, 0, (F - 0.3) / 2), ST, bevel=0.06)
    box((W - 0.4, D - 0.4, T - F), (0, 0, (F + T) / 2), wood("inner", "#3e2a1e", "#553a29"))
    n = int((T - F) / 0.32)
    for i in range(n):  # log walls: sides along Y, back along X, crossing at the corners
        z = F + 0.17 + i * 0.32
        for s in (-1, 1): cyl(0.17, D + 0.7, (s * W / 2, 0.08, z + (0.16 if s > 0 else 0)), LOGY, rot=(math.pi / 2, 0, 0), verts=12)
        cyl(0.17, W + 0.7, (0, D / 2, z + 0.08), LOG, rot=(0, math.pi / 2, 0), verts=12)
    # The front: posts, beams, lit windows, a double door in the middle bay.
    fy = -D / 2
    bays = 6
    for k in range(bays + 1): box((0.34, 0.34, T - F), (-W / 2 + k * W / bays, fy, (F + T) / 2), TIM, bevel=0.03)
    box((W + 0.5, 0.42, 0.42), (0, fy, T), TIM, bevel=0.04)
    box((W, 0.3, 0.22), (0, fy, F + 0.11), TIM, bevel=0.02)
    for k in range(bays):
        x0, x1 = -W / 2 + k * W / bays + 0.17, -W / 2 + (k + 1) * W / bays - 0.17; cx, w = (x0 + x1) / 2, x1 - x0
        if k == 3:
            for s in (-1, 1): box((w / 2 - 0.05, 0.12, 2.4), (cx + s * w / 4, fy - 0.02, F + 1.25), TIM, bevel=0.02)
            box((w / 2 - 0.35, 0.05, 1.0), (cx - w / 4, fy - 0.09, F + 1.7), WIN, kind="lit"); box((w / 2 - 0.35, 0.05, 1.0), (cx + w / 4, fy - 0.09, F + 1.7), WIN, kind="lit")
            box((w, 0.12, T - F - 2.6), (cx, fy - 0.02, (F + 2.5 + T) / 2), WIN, kind="lit")
            for s in (-1, 1): box((0.14, 0.14, 0.28), (cx + s * (w / 2 + 0.1), fy - 0.28, F + 2.3), LAMP, kind="lamp")
            continue
        box((w, 0.1, T - F - 0.4), (cx, fy, (F + T) / 2), WIN, kind="lit")
        box((w, 0.16, 0.12), (cx, fy - 0.05, F + 2.4), TIM)  # transom
        box((0.08, 0.16, T - F - 0.4), (cx, fy - 0.05, (F + T) / 2), TIM)  # mullion
    # Gables: the front one glass in a timber frame, the back one boarded.
    rise = R
    tri([(-W / 2, fy + 0.05, T), (W / 2, fy + 0.05, T), (0, fy + 0.05, T + rise)], WIN, kind="lit")
    for x in (-W / 4, 0, W / 4):
        h = rise * (1 - abs(x) / (W / 2)); box((0.22, 0.24, h), (x, fy - 0.03, T + h / 2), TIM)
    box((W * 0.75, 0.24, 0.2), (0, fy - 0.03, T + rise * 0.4), TIM)
    tri([(-W / 2, D / 2, T), (W / 2, D / 2, T), (0, D / 2, T + rise)], wood("boards", "#4d3424", "#6b4a33", "Z"), thick=0.2)
    # Roof: two slabs from the ridge out past the walls, timber fascia, deep snow with a rounded lip.
    a = math.atan2(rise, W / 2); over = 1.5; L = (W / 2 + over) / math.cos(a); ridge = Vector((0, 0, T + rise + 0.25))
    for s in (-1, 1):
        d = Vector((s * math.cos(a), 0, -math.sin(a))); nrm = Vector((s * math.sin(a), 0, math.cos(a)))
        c = ridge + d * (L / 2); rot = (0, s * a, 0)
        box((L, D + 2.8, 0.36), c, ROOF, rot=rot, bevel=0.04)
        for y in (-(D / 2 + 1.4), D / 2 + 1.4): box((L, 0.26, 0.5), c + Vector((0, y, -0.08)), TIM, rot=rot, bevel=0.03)
        blob((L - 0.2, D + 2.6, 0.7), c + nrm * 0.5, SN, rot=rot, lumps=0.1)
        eave = ridge + d * L + nrm * 0.45
        cyl(0.3, D + 2.7, eave, SN, rot=(math.pi / 2, 0, 0), verts=12)
        for i in range(26):  # icicles
            y = -D / 2 - 1.2 + rnd.random() * (D + 2.4); h = 0.15 + rnd.random() * 0.45
            cyl(0.05, h, eave + Vector((0, 0, 0)) + Vector((s * 0.05, y, -0.3 - h / 2)), flat("ice", "#cfe3f2", 0.2, grain=0), verts=6, r2=0.0)
    cyl(0.4, D + 2.7, ridge + Vector((0, 0, 0.45)), SN, rot=(math.pi / 2, 0, 0), verts=14)
    # Chimney.
    cx, cy = W * 0.22, D * 0.2; ztop = T + rise * (1 - cx / (W / 2)) + 2.2
    box((1.1, 1.1, 3.2), (cx, cy, ztop - 1.6), ST, bevel=0.04); box((1.4, 1.4, 0.18), (cx, cy, ztop + 0.05), ST, bevel=0.03)
    blob((1.4, 1.4, 0.4), (cx, cy, ztop + 0.3), SN)
    # The deck.
    dy0, dd = fy - 0.2, 4.8
    box((W + 0.6, dd, 0.3), (0, dy0 - dd / 2, F - 0.2), TIM, bevel=0.03)
    for i in range(int(dd / 0.2)): box((W + 0.5, 0.17, 0.07), (0, dy0 - 0.1 - i * 0.2, F - 0.02), DECK, bevel=0.01)
    for x in (-W / 2, -W / 6, W / 6, W / 2): box((0.3, 0.3, F), (x, dy0 - dd + 0.15, (F - 0.3) / 2), TIM)
    ry = dy0 - dd + 0.08
    for i in range(17): x = -W / 2 - 0.2 + i * (W + 0.4) / 16; box((0.12, 0.12, 1.0), (x, ry, F + 0.5), TIM)
    for z in (F + 0.5, F + 1.0): box((W + 0.5, 0.14, 0.14), (0, ry, z), TIM)
    for s in (-1, 1):
        for i in range(4): box((0.12, 0.12, 1.0), (s * (W / 2 + 0.2), dy0 - i * dd / 3.5, F + 0.5), TIM)
        box((0.14, dd, 0.14), (s * (W / 2 + 0.2), dy0 - dd / 2, F + 1.0), TIM)
    blob((W + 0.4, 0.26, 0.16), (0, ry, F + 1.12), SN, lumps=0.03)
    for i, x in enumerate((-W * 0.3, 0, W * 0.3)): picnic((x, dy0 - 2.3, F + 0.05), DECK, SN, rot=0.1 * (i - 1))
    for x, col in ((-W * 0.15, "#8e3b32"), (W * 0.15, "#e6dac3")): parasol((x, dy0 - 2.3, F + 0.05), TIM, flat("cloth" + col, col, 0.9))
    rack((W / 2 + 1.6, dy0 - 1.0, 0), TIM, SN)
    # Snow banked against the walls and drifts on the ground.
    for s in (-1, 1): blob((1.4, D + 1.5, 1.0), (s * (W / 2 + 0.5), 0.5, 0.25), SN, lumps=0.15)
    blob((W + 2, 1.6, 1.0), (0, D / 2 + 0.6, 0.25), SN, lumps=0.15)
    # String lights under the front eaves, side windows with shutters, firewood, steps, lanterns.
    for s in (-1, 1):
        for i in range(15):
            u = (i + 0.5) / 15; x = s * u * (W / 2 + 0.8); z = T + rise * (1 - u * (W / 2 + 0.8) / (W / 2)) - 0.35 - math.sin(u * math.pi * 3) ** 2 * 0.25
            cyl(0.07, 0.14, (x, fy - 0.45, z), LAMP, verts=8, kind="lamp")
    SHUT = flat("shutter", "#3f5a4a", 0.6, grain=0.06)
    for s in (-1, 1):
        for y in (-D / 4, D / 4):
            x = s * (W / 2 + 0.18)
            box((0.1, 1.3, 1.5), (x, y, F + 2.0), WIN, kind="lit")
            box((0.2, 1.55, 0.14), (x + s * 0.05, y, F + 2.8), TIM); box((0.24, 1.6, 0.14), (x + s * 0.06, y, F + 1.2), TIM)
            for t in (-1, 1): box((0.08, 0.68, 1.55), (x + s * 0.12, y + t * 1.05, F + 2.0), SHUT, rot=(0, 0, t * s * 0.15), bevel=0.02)
            blob((0.4, 1.6, 0.16), (x + s * 0.1, y, F + 1.33), SN, lumps=0.02)
    END = wood("logend", "#6b4a2e", "#a07a52", "X")
    for i in range(5):
        for j in range(9): cyl(0.11, 1.0, (W / 2 + 0.75, D / 2 - 1.0 - j * 0.23 - (i % 2) * 0.11, 0.12 + i * 0.2), END, rot=(0, math.pi / 2, 0), verts=8)
    box((1.1, 2.6, 0.08), (W / 2 + 0.75, D / 2 - 2.0, 1.2), ROOF); blob((1.2, 2.7, 0.2), (W / 2 + 0.75, D / 2 - 2.0, 1.33), SN, lumps=0.03)
    for i in range(4): box((2.4, 0.4, 0.22), (-W / 2 + 2.0, dy0 - dd - 0.25 - i * 0.4, F - 0.25 - i * 0.25), ST, bevel=0.03)
    for x in (-W / 2 - 0.2, W / 2 + 0.2):
        box((0.16, 0.16, 1.6), (x, ry, F + 1.4), TIM); box((0.3, 0.3, 0.4), (x, ry, F + 2.35), LAMP, kind="lamp", bevel=0.04)
        box((0.4, 0.4, 0.06), (x, ry, F + 2.58), TIM)
    # The name board over the door.
    box((4.2, 0.14, 0.8), (W / 12 * 1.0 + 0.0, fy - 0.3, T + 0.75), TIM, bevel=0.04)
    text("SUMMIT HOUSE", 0.42, (W / 12, fy - 0.4, T + 0.73), flat("paint_cream", "#ece2cd", 0.6, grain=0))
    finalize("restaurant", 2048)

def picnic(at, DECK, SN, rot=0.0):
    x, y, z = at; c, s = math.cos(rot), math.sin(rot)
    P = lambda dx, dy, dz: (x + dx * c - dy * s, y + dx * s + dy * c, z + dz)
    for k in (-0.3, 0, 0.3): box((1.9, 0.27, 0.06), P(0, k, 0.76), DECK, rot=(0, 0, rot), bevel=0.01)
    for k in (-0.72, 0.72): box((1.9, 0.27, 0.06), P(0, k, 0.45), DECK, rot=(0, 0, rot), bevel=0.01)
    for e in (-0.7, 0.7):
        for t in (-1, 1): box((0.09, 0.09, 1.0), P(e, t * 0.38, 0.4), DECK, rot=(t * 0.55, 0, rot))
        box((0.09, 1.6, 0.09), P(e, 0, 0.4), DECK, rot=(0, 0, rot))
    blob((1.7, 0.75, 0.12), P(0, 0, 0.84), SN, rot=(0, 0, rot), lumps=0.02)

def parasol(at, TIM, CL):
    x, y, z = at; cyl(0.045, 2.7, (x, y, z + 1.35), TIM, verts=8)
    cyl(1.6, 0.6, (x, y, z + 2.55), CL, verts=10, r2=0.05); cyl(1.0, 0.32, (x, y, z + 2.76), snow(), verts=10, r2=0.05, kind="snow")

def rack(at, TIM, SN):
    x, y, z = at
    for s in (-1, 1): box((0.12, 0.6, 1.2), (x, y + s * 1.3, z + 0.6), TIM)
    for zz in (0.25, 1.05): box((0.14, 2.7, 0.12), (x, y, z + zz), TIM)
    cols = ["#3f5a4a", "#8e3b32", "#36506e", "#c9a65a", "#e6dac3", "#2b2f36"]
    for i, c in enumerate(cols): box((0.03, 0.28, 1.55), (x + 0.12, y - 1.05 + i * 0.42, z + 0.85), flat("board" + c, c, 0.4, grain=0), rot=(0, -0.16, 0), bevel=0.012)
    blob((0.3, 2.7, 0.12), (x, y, z + 1.17), SN, lumps=0.02)

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
    COL.objects.link(pod); pod["kind"] = "bake"
    # Split the glass off into its own mesh.
    select_only([pod]); bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="DESELECT")
    pod.active_material_index = 2; bpy.ops.object.material_slot_select(); bpy.ops.mesh.separate(type="SELECTED"); bpy.ops.object.mode_set(mode="OBJECT")
    gl = [o for o in COL.objects if o is not pod and o.name.startswith("pod")][0]; gl["kind"] = "glass"
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
        blob((L - 0.1, D + 1.1, 0.5), c + nrm * 0.33, SN, rot=(0, s * a, 0), lumps=0.06)
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

def shag(r, h, z, mat, kind, droop=0.35, seed=0):
    """A tier of branches: a cone whose rim is ragged and droops."""
    rr = random.Random(seed); me = bpy.data.meshes.new("tier"); bm = bmesh.new(); n = 18
    top = bm.verts.new((0, 0, z + h)); rim = []
    for i in range(n):
        a = i / n * math.tau; k = r * (1.0 if i % 2 == 0 else 0.72) * (0.9 + rr.random() * 0.2)
        rim.append(bm.verts.new((math.cos(a) * k, math.sin(a) * k, z - (droop if i % 2 == 0 else 0.05) * (0.8 + rr.random() * 0.4))))
    mid = bm.verts.new((0, 0, z + 0.15))
    for i in range(n): bm.faces.new((top, rim[i], rim[(i + 1) % n])); bm.faces.new((mid, rim[(i + 1) % n], rim[i]))
    bm.to_mesh(me); bm.free(); o = bpy.data.objects.new("tier", me); bpy.context.scene.collection.objects.link(o); return _link(o, mat, kind)

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

for name in WANT:
    reset(); globals()[name]()
