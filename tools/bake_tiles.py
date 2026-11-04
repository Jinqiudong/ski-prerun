"""Bake the resort tiles for the start page's map: each resort as a small square of its real terrain, like
a 3D relief model. A heightmap (data/tiles.json) and a semi-realistic texture (assets/tiles/<id>.jpg): snow
shaded by the sun from the north-west, the woods from the resort's tree mask, bare rock on the steeps.

usage: python tools/bake_tiles.py      (needs numpy and pillow)
"""
import base64, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

N, TEX = 128, 512  # heightmap samples and texture pixels across a tile
out = {}
for r in json.load(open("data/resorts.json")):
    if not r.get("ready"): continue
    d = json.load(open(f"data/{r['id']}.json"))
    gw, gh = d["grid"]; x0, z0, x1, z1 = d["bounds"]
    H = np.frombuffer(base64.b64decode(d["heights"]), dtype="<u2").astype(np.float32).reshape(gh, gw) / 10
    mw, mh = d["trees"]["grid"]
    bits = np.unpackbits(np.frombuffer(base64.b64decode(d["trees"]["bits"]), dtype=np.uint8))[: mw * mh].reshape(mh, mw)
    # The square: around the runs and lifts, with a margin, inside the baked bounds.
    pts = np.array([p for run in d["runs"] for p in run["pts"]] + [p for l in d["lifts"] for p in l["pts"]])
    cx, cz = (pts[:, 0].min() + pts[:, 0].max()) / 2, (pts[:, 1].min() + pts[:, 1].max()) / 2
    half = max(np.ptp(pts[:, 0]), np.ptp(pts[:, 1])) * 0.62
    half = min(half, (x1 - x0) / 2, (z1 - z0) / 2)
    cx = min(max(cx, x0 + half), x1 - half); cz = min(max(cz, z0 + half), z1 - half)
    def sample(grid, w, h, n, nearest=False):
        xs = np.linspace(cx - half, cx + half, n); zs = np.linspace(cz - half, cz + half, n)
        fx = (xs - x0) / (x1 - x0) * (w - 1); fz = (zs - z0) / (z1 - z0) * (h - 1)
        if nearest: return grid[np.clip(np.round(fz).astype(int), 0, h - 1)][:, np.clip(np.round(fx).astype(int), 0, w - 1)]
        i0 = np.clip(np.floor(fx).astype(int), 0, w - 2); j0 = np.clip(np.floor(fz).astype(int), 0, h - 2)
        u = (fx - i0)[None, :]; v = (fz - j0)[:, None]
        a = grid[j0][:, i0]; b = grid[j0][:, i0 + 1]; c = grid[j0 + 1][:, i0]; e = grid[j0 + 1][:, i0 + 1]
        return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v
    h = sample(H, gw, gh, N)
    out[r["id"]] = {"size": round(2 * half), "grid": N, "lo": round(float(h.min()), 1),
                    "heights": base64.b64encode(np.round((h - h.min()) * 2).astype("<u2").tobytes()).decode()}
    # The texture: snow lit by the sun, cool in the shade; woods; rock where it's steep.
    ht = sample(H, gw, gh, TEX); cell = 2 * half / (TEX - 1)
    gz, gx = np.gradient(ht, cell)
    n = np.dstack([-gx, np.ones_like(ht), -gz]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    L = np.array([-0.55, 0.62, -0.55]); L /= np.linalg.norm(L)
    sun = np.clip((n * L).sum(2), 0, 1)
    slope = np.degrees(np.arccos(np.clip(n[..., 1], -1, 1)))
    rng = np.random.default_rng(1)
    snow_lit, snow_shade = np.array([0.97, 0.97, 0.96]), np.array([0.66, 0.72, 0.82])
    col = snow_shade + (snow_lit - snow_shade) * (sun[..., None] ** 0.8)
    # Woods grow below the treeline (about 3,500 m here) where it isn't too steep, in clumps; the runs are
    # cut through them as white ribbons, the way a resort looks from the air.
    speck = rng.random((TEX, TEX))
    noise = lambda k: np.asarray(Image.fromarray((rng.random((k, k)) * 255).astype(np.uint8)).resize((TEX, TEX), Image.BICUBIC)).astype(np.float32) / 255
    clump = noise(10) * 0.65 + noise(40) * 0.35
    elev = d["hmin"] + ht
    line = 3480 + (clump - 0.5) * 160
    cut = Image.new("L", (TEX, TEX), 0); g = ImageDraw.Draw(cut)
    px = lambda x, z: ((x - (cx - half)) / (2 * half) * (TEX - 1), (z - (cz - half)) / (2 * half) * (TEX - 1))
    for run in d["runs"]:
        w = max(1, round((40 if run.get("area") else 22) / cell))
        g.line([px(x, z) for x, z in run["pts"]], fill=255, width=w, joint="curve")
    for l in d["lifts"]: g.line([px(x, z) for x, z in l["pts"]], fill=255, width=max(1, round(8 / cell)))
    cut = np.asarray(cut.filter(ImageFilter.GaussianBlur(1))) > 100
    trees = (elev < line) & (slope < 42) & (clump > 0.46) & ~cut
    forest = np.array([0.24, 0.35, 0.28]) * (0.6 + 0.8 * sun[..., None]) * (0.72 + 0.5 * speck[..., None])
    f = (trees & (speck > 0.2 + 0.6 * np.clip(0.52 - clump, 0, 1)))[..., None]  # thinner at the edges of a wood
    col = np.where(f, forest * 0.8 + col * 0.2, col)  # a dusting of snow on the spruce
    rock = np.clip((slope - 36) / 10, 0, 1)[..., None] * (speck[..., None] > 0.35)
    col = col * (1 - rock * 0.7) + np.array([0.46, 0.44, 0.41]) * (0.6 + 0.6 * sun[..., None]) * rock * 0.7
    col *= 0.96 + 0.06 * rng.random((TEX, TEX, 1))
    Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8)).save(f"assets/tiles/{r['id']}.jpg", quality=84)
    print(r["id"], f"{2 * half / 1000:.1f} km", f"{h.max() - h.min():.0f} m relief")
json.dump(out, open("data/tiles.json", "w"), separators=(",", ":"))
