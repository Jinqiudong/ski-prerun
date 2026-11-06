"""Bake the resort tiles for the start page's map: each resort as a small square of its real terrain, like
a 3D relief model. A heightmap (data/tiles.json) and a semi-realistic texture (assets/tiles/<id>.jpg): snow
shaded by the sun from the north-west, woods in clumps below the treeline, bare rock on the steeps.

--aerial bakes the same look larger, for the resort page and the top of a lift (src/mountain/aerial.js):
assets/aerial/<id>.jpg over the resort's whole baked area (2048 px on the long side, so a phone keeps it),
and its bounds in data/aerial.json. There the woods come from the resort's real tree mask (OpenStreetMap);
where the mask covers little of the land below the treeline (woods not mapped yet), the clumps are added.

usage: python tools/bake_tiles.py [--aerial]      (needs numpy and pillow)
"""
import base64, json, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

N, TEX = 128, 512  # heightmap samples and texture pixels across a tile
AERIAL = 2048  # aerial texture pixels on the long side


def sample(grid, bounds, xs, zs):
    """Bilinear samples of a grid over bounds at the points xs (columns) by zs (rows)."""
    h, w = grid.shape; x0, z0, x1, z1 = bounds
    fx = (xs - x0) / (x1 - x0) * (w - 1); fz = (zs - z0) / (z1 - z0) * (h - 1)
    i0 = np.clip(np.floor(fx).astype(int), 0, w - 2); j0 = np.clip(np.floor(fz).astype(int), 0, h - 2)
    u = (fx - i0)[None, :]; v = (fz - j0)[:, None]
    a = grid[j0][:, i0]; b = grid[j0][:, i0 + 1]; c = grid[j0 + 1][:, i0]; e = grid[j0 + 1][:, i0 + 1]
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v


def paint(d, ht, xs, zs, rng, mask=None, crowns=0):
    """The texture over xs by zs (heights ht): snow lit by the sun, cool in the shade; woods; rock where it's
    steep. mask: how much of each pixel is mapped woodland (0..1), or None for woods from clumps alone.
    crowns: the grain of the woods in pixels (a spruce's crown), for a picture fine enough to show one."""
    rows, cols = ht.shape; cell = xs[1] - xs[0]
    gz, gx = np.gradient(ht, cell)
    n = np.dstack([-gx, np.ones_like(ht), -gz]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    L = np.array([-0.55, 0.62, -0.55]); L /= np.linalg.norm(L)
    sun = np.clip((n * L).sum(2), 0, 1)
    slope = np.degrees(np.arccos(np.clip(n[..., 1], -1, 1)))
    snow_lit, snow_shade = np.array([0.97, 0.97, 0.96]), np.array([0.66, 0.72, 0.82])
    col = snow_shade + (snow_lit - snow_shade) * (sun[..., None] ** 0.8)
    # Woods grow below the treeline (about 3,500 m here) where it isn't too steep, in clumps; the runs are
    # cut through them as white ribbons, the way a resort looks from the air.
    speck = rng.random((rows, cols))
    if crowns:  # grains a crown wide instead of single pixels, spread back over 0..1
        b = np.asarray(Image.fromarray((speck * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(crowns))).astype(np.float32)
        speck = 0.5 + 0.5 * np.tanh((b - b.mean()) / (b.std() + 1e-6) * 0.9)
    noise = lambda k: np.asarray(Image.fromarray((rng.random((k, k)) * 255).astype(np.uint8)).resize((cols, rows), Image.BICUBIC)).astype(np.float32) / 255
    clump = noise(10) * 0.65 + noise(40) * 0.35
    elev = d["hmin"] + ht
    line = 3480 + (clump - 0.5) * 160
    cut = Image.new("L", (cols, rows), 0); g = ImageDraw.Draw(cut)
    px = lambda x, z: ((x - xs[0]) / (xs[-1] - xs[0]) * (cols - 1), (z - zs[0]) / (zs[-1] - zs[0]) * (rows - 1))
    for run in d["runs"]:
        w = max(1, round((40 if run.get("area") else 22) / cell))
        g.line([px(x, z) for x, z in run["pts"]], fill=255, width=w, joint="curve")
    for l in d["lifts"]: g.line([px(x, z) for x, z in l["pts"]], fill=255, width=max(1, round(8 / cell)))
    cut = np.asarray(cut.filter(ImageFilter.GaussianBlur(1))) > 100
    trees = (elev < line) & (slope < 42) & (clump > 0.46)
    if mask is not None:
        # The mapped woods, with a ragged edge from the clumps; the clumps too where the map has few woods.
        mapped = mask + (clump - 0.5) * 0.5 > 0.5
        below = (elev < line) & (slope < 42)
        trees = (mapped | trees) if mask[below].mean() < 0.5 else mapped
    trees &= ~cut
    # Seen close (crowns), the woods are calmer: less flicker between crowns, fewer gaps of snow inside.
    grain, gaps = (0.3, 0.1) if crowns else (0.5, 0.2)
    forest = np.array([0.24, 0.35, 0.28]) * (0.6 + 0.8 * sun[..., None]) * (0.97 - grain / 2 + grain * speck[..., None])
    f = (trees & (speck > gaps + 0.6 * np.clip(0.52 - clump, 0, 1)))[..., None]  # thinner at the edges of a wood
    col = np.where(f, forest * 0.8 + col * 0.2, col)  # a dusting of snow on the spruce
    rock = np.clip((slope - 36) / 10, 0, 1)[..., None] * (speck[..., None] > 0.35)
    col = col * (1 - rock * 0.7) + np.array([0.46, 0.44, 0.41]) * (0.6 + 0.6 * sun[..., None]) * rock * 0.7
    col *= 0.96 + 0.06 * rng.random((rows, cols, 1))
    return Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8))


def load(rid):
    d = json.load(open(f"data/{rid}.json"))
    gw, gh = d["grid"]
    H = np.frombuffer(base64.b64decode(d["heights"]), dtype="<u2").astype(np.float32).reshape(gh, gw) / 10
    mw, mh = d["trees"]["grid"]
    bits = np.unpackbits(np.frombuffer(base64.b64decode(d["trees"]["bits"]), dtype=np.uint8))[: mw * mh].reshape(mh, mw)
    return d, H, bits


def tiles():
    out = {}
    for r in json.load(open("data/resorts.json")):
        if not r.get("ready"): continue
        d, H, _ = load(r["id"]); x0, z0, x1, z1 = d["bounds"]
        # The square: around the runs and lifts, with a margin, inside the baked bounds.
        pts = np.array([p for run in d["runs"] for p in run["pts"]] + [p for l in d["lifts"] for p in l["pts"]])
        cx, cz = (pts[:, 0].min() + pts[:, 0].max()) / 2, (pts[:, 1].min() + pts[:, 1].max()) / 2
        half = max(np.ptp(pts[:, 0]), np.ptp(pts[:, 1])) * 0.62
        half = min(half, (x1 - x0) / 2, (z1 - z0) / 2)
        cx = min(max(cx, x0 + half), x1 - half); cz = min(max(cz, z0 + half), z1 - half)
        square = lambda n: (np.linspace(cx - half, cx + half, n), np.linspace(cz - half, cz + half, n))
        h = sample(H, d["bounds"], *square(N))
        out[r["id"]] = {"size": round(2 * half), "grid": N, "lo": round(float(h.min()), 1),
                        "heights": base64.b64encode(np.round((h - h.min()) * 2).astype("<u2").tobytes()).decode()}
        xs, zs = square(TEX)
        paint(d, sample(H, d["bounds"], xs, zs), xs, zs, np.random.default_rng(1)).save(f"assets/tiles/{r['id']}.jpg", quality=84)
        print(r["id"], f"{2 * half / 1000:.1f} km", f"{h.max() - h.min():.0f} m relief")
    json.dump(out, open("data/tiles.json", "w"), separators=(",", ":"))


def aerial():
    out = {}
    for r in json.load(open("data/resorts.json")):
        if not r.get("ready"): continue
        d, H, bits = load(r["id"]); x0, z0, x1, z1 = d["bounds"]
        k = AERIAL / max(x1 - x0, z1 - z0)
        cols, rows = round((x1 - x0) * k), round((z1 - z0) * k)
        xs, zs = np.linspace(x0, x1, cols), np.linspace(z0, z1, rows)
        # Heights resampled smoothly (bicubic), so the light shows no facets from the height grid's cells.
        ht = np.asarray(Image.fromarray(H).resize((cols, rows), Image.BICUBIC))
        mask = np.asarray(Image.fromarray(bits * 255).resize((cols, rows), Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
        paint(d, ht, xs, zs, np.random.default_rng(1), mask, crowns=1.5 / (xs[1] - xs[0])).save(f"assets/aerial/{r['id']}.jpg", quality=80, optimize=True)
        out[r["id"]] = {"bounds": d["bounds"], "size": [cols, rows]}
        print(r["id"], f"{cols}x{rows}", f"{(x1 - x0) / (cols - 1):.1f} m/px")
    json.dump(out, open("data/aerial.json", "w"), separators=(",", ":"))


aerial() if "--aerial" in sys.argv else tiles()
