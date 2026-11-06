"""Gear: small things the riders hold. Hand-scale, so they are built in millimetres of metres and baked
with a short occlusion distance and no ground plane; the origin is where the hand grips, not the foot.

radio: a handheld two-way radio (after the Motorola T-series / Midland outdoor radios): a rubber-armoured
slate body, a stubby rubber antenna and a channel knob on top, a push-to-talk bar on the left side, a
speaker grille over a small LCD and three buttons on the front, a belt clip on the back.
Body 55 × 35 × 130 mm plus a 60 mm antenna. Origin a third of the way up the body (the palm's grip),
antenna up (Blender +Z → game +Y), front with the speaker to Blender −Y (→ game +Z).
Built to assets/props/:  Blender -b -P models/facilities/blender/build.py -- assets/props radio"""
import math
from mathutils import Matrix
from lib import *
import lib

PI = math.pi

def skin(name, hexc, rough=0.7, pattern="noise", scale=900.0, bump=0.3, contrast=0.08, metal=0.0):
    """A hand-scale surface: a colour with a fine pattern in colour and in bump (baked into the normal map).
    pattern: "noise" (rubber / plastic stipple), "ribs" (grip ridges across Z) or "grille" (speaker slots)."""
    m, n, l = lib._mat(name); b = lib._bsdf(n); c = srgb(hexc)
    v = coords(n, l)
    if pattern == "noise":
        t = n.new("ShaderNodeTexNoise"); t.inputs["Scale"].default_value = scale; t.inputs["Detail"].default_value = 3
        out = t.outputs["Fac"]; lo, hi = 0.35, 0.65
    else:  # bands across Z: wave period = 2π / (20 · scale) metres
        t = n.new("ShaderNodeTexWave"); t.wave_type = "BANDS"; t.bands_direction = "Z"
        t.inputs["Scale"].default_value = scale; t.inputs["Distortion"].default_value = 0
        out = t.outputs["Fac"]; lo, hi = (0.35, 0.6) if pattern == "grille" else (0.2, 0.8)
    l.new(v, t.inputs["Vector"])
    dark = tuple(x * (1 - contrast) for x in c); light = tuple(min(1, x * (1 + contrast)) for x in c)
    if pattern == "grille": dark = (0.012, 0.013, 0.014)
    r = ramp(n, l, out, [(lo, dark), (hi, light)]); l.new(r.outputs["Color"], b.inputs["Base Color"])
    bp = n.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump; bp.inputs["Distance"].default_value = 0.0005
    l.new(r.outputs["Color"], bp.inputs["Height"]); l.new(bp.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    return m

def rbox(size, loc, mat, bevel, seg=2, rot=(0, 0, 0)):
    """A rounded box, smooth-shaded with hardened normals so the flats stay flat and the bevels read round.
    The size goes into the mesh first, so the bevel is in metres (box() bevels before its scale)."""
    o = box(size, loc, mat, rot)
    o.data.transform(Matrix.Diagonal((*size, 1))); o.scale = (1, 1, 1)
    md = o.modifiers.new("b", "BEVEL"); md.width = bevel; md.segments = seg; md.use_clamp_overlap = True; md.harden_normals = True
    for p in o.data.polygons: p.use_smooth = True
    return o

def radio():
    new_col("radio")
    SL = skin("radio_slate", "#3d444c", 0.55, "noise", 1400, 0.15, 0.05)
    RB = skin("radio_rubber", "#26282b", 0.9, "noise", 700, 0.45, 0.1)
    RIB = skin("radio_ribs", "#2a2c2f", 0.85, "ribs", 70, 0.6, 0.18)
    AC = skin("radio_accent", "#9e6b4d", 0.7, "noise", 700, 0.3, 0.07)
    GR = skin("radio_grille", "#30353b", 0.6, "grille", 75, 0.9)
    BZ = skin("radio_bezel", "#15181b", 0.4, "noise", 1400, 0.05, 0.03)
    LCD = flat("radio_lcd", "#7d8b7c", 0.25, grain=0)
    SEG = flat("radio_seg", "#232a25", 0.4, grain=0)
    LED = flat("radio_led", "#6e3a2a", 0.3, grain=0)
    cyl(0.001, 0.001, (0, 0, 0), SL, verts=3)  # unscaled anchor inside the body (see buildings.anchor)

    zb, zt = -0.043, 0.087  # bottom and top of the body: the grip (origin) is a third of the way up
    # The housing and its rubber armour: a boot round the bottom, a cap round the top, grip panels on the sides.
    rbox((0.050, 0.031, 0.122), (0, 0.0005, 0.022), SL, 0.006)
    rbox((0.055, 0.035, 0.024), (0, 0, zb + 0.012), RB, 0.007)
    rbox((0.055, 0.035, 0.017), (0, 0, zt - 0.0085), AC, 0.006)
    for s in (-1, 1): rbox((0.004, 0.024, 0.062), (s * 0.0255, 0.003, 0.028 if s > 0 else 0.004), RIB, 0.0015, 1)
    # The front: a raised face, the speaker grille high (by the mouth), the LCD and three keys below it, a mic hole.
    rbox((0.045, 0.003, 0.088), (0, -0.0155, 0.024), SL, 0.0012, 1)
    rbox((0.038, 0.0016, 0.034), (0, -0.0172, 0.048), GR, 0.002, 1)
    rbox((0.033, 0.0012, 0.019), (0, -0.0172, 0.018), BZ, 0.0015, 1)
    box((0.026, 0.0006, 0.0115), (0, -0.0179, 0.0185), LCD)
    for i, x in enumerate((-0.0075, -0.0045, 0.006, 0.0085)):  # "07" and a signal bar on the LCD, in segments
        box((0.0018 if i < 2 else 0.0012, 0.0004, 0.007 if i < 2 else 0.003 + 0.002 * (i - 2)), (x, -0.0183, 0.0185 - (0 if i < 2 else 0.002 - 0.001 * (i - 2))), SEG)
    for x in (-0.012, 0.0, 0.012): rbox((0.009, 0.0022, 0.0045), (x, -0.0172, 0.002), RB, 0.0012, 1)
    cyl(0.0012, 0.0012, (0, -0.0172, -0.009), BZ, rot=(PI / 2, 0, 0), verts=8)
    # The top: antenna in a collar at the back-left, the channel knob at the right, a status LED between.
    ax, ay = -0.0135, 0.004
    cyl(0.0072, 0.006, (ax, ay, zt + 0.003), RB, verts=12)
    cyl(0.0056, 0.050, (ax, ay, zt + 0.031), RB, r2=0.0042, verts=10)
    cyl(0.0042, 0.004, (ax, ay, zt + 0.058), RB, r2=0.0024, verts=10)
    kx = 0.0125
    cyl(0.0068, 0.011, (kx, ay, zt + 0.0055), RIB, verts=16)
    cyl(0.0060, 0.0016, (kx, ay, zt + 0.0118), RB, verts=16)
    box((0.0012, 0.005, 0.0008), (kx, ay - 0.0025, zt + 0.0128), AC)
    cyl(0.0018, 0.0016, (0.0, ay + 0.003, zt + 0.0006), LED, verts=8)
    # The left side (-X, under the thumb): the push-to-talk bar, a call button below it. Right side: the jack cover.
    rbox((0.0045, 0.017, 0.030), (-0.0285, -0.0005, 0.038), RIB, 0.0018, 2)
    cyl(0.0034, 0.003, (-0.0280, -0.0005, 0.0145), RB, rot=(0, PI / 2, 0), verts=10)
    rbox((0.0025, 0.012, 0.016), (0.0282, 0.0, 0.052), RB, 0.001, 1)
    # The back: battery door seam and latch, the belt clip on its mount, flaring out a little at the bottom.
    box((0.040, 0.0008, 0.0008), (0, 0.0162, -0.012), BZ)
    rbox((0.012, 0.002, 0.004), (0, 0.0164, -0.018), RB, 0.0008, 1)
    rbox((0.026, 0.006, 0.012), (0, 0.0175, 0.066), SL, 0.002, 1)
    rbox((0.024, 0.0026, 0.064), (0, 0.0215, 0.036), SL, 0.0012, 1, rot=(0.06, 0, 0))
    finalize("radio", 512, ao_dist=0.012, samples=64, ground=False)

MODELS = {"radio": radio}
