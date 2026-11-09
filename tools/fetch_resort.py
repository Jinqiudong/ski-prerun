"""Download everything bake.py needs for one resort of tools/resorts.json, then bake it.

usage: python3 tools/fetch_resort.py <id> <work dir>
- `area` is the resort's ski-area outline bounds from OpenStreetMap (landuse=winter_sports); the baked
  box adds ~700 m around it so the runs' surroundings show.
- Pistes, lifts, restaurants and woods come from the Overpass API; terrain from AWS Terrain Tiles (z14).
- `outline` (optional) is the OSM way id of that ski-area outline. Where a neighbour's runs reach into the box
  (Alta and Snowbird, Brighton and Solitude, Deer Valley and Park City), only the runs and lifts that lie
  mostly inside it (grown by 200 m) are kept.
- `treeline` (m) and `grid` (heightmap columns, rows) are passed to bake.py; a big area (Deer Valley) takes a
  coarser grid so its file stays the size of the others.
Writes data/<id>.json and data/<id>-far.json.
"""
import functools, json, math, subprocess, sys, time, urllib.parse, urllib.request
print = functools.partial(print, flush=True)
from pathlib import Path

rid, work = sys.argv[1], Path(sys.argv[2])
here = Path(__file__).resolve().parent
cfg = json.load(open(here / "resorts.json"))[rid]
S, W, N, E = cfg["area"]
pad_lat, pad_lon = 700 / 110574, 700 / (111320 * math.cos(math.radians((S + N) / 2)))
bbox = cfg.get("bbox") or [round(S - pad_lat, 4), round(W - pad_lon, 4), round(N + pad_lat, 4), round(E + pad_lon, 4)]
work.mkdir(parents=True, exist_ok=True)
SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]

def overpass(query, out):
    if out.exists() and out.stat().st_size > 100: return
    b = "(%s,%s,%s,%s)" % tuple(bbox)
    q = "[out:json][timeout:180];" + query.replace("BBOX", b)
    for attempt in range(10):
        url = SERVERS[attempt % len(SERVERS)]
        # curl, not urllib: some Pythons' SSL can't talk to the Overpass servers.
        r = subprocess.run(["curl", "-s", "-m", "200", "-A", "ski-prerun", url, "--data-urlencode", "data=" + q], capture_output=True)
        try:
            json.loads(r.stdout)  # a busy server answers with an HTML page
            out.write_bytes(r.stdout); return
        except Exception:
            print(f"  overpass {url.split('/')[2]} busy ({r.stdout[:40]!r}), retrying")
            time.sleep(10 * (attempt + 1))
    raise SystemExit("Overpass is not answering")

print(f"{rid}: box {bbox}")
overpass('(way["piste:type"="downhill"]BBOX;way["aerialway"]BBOX;);out geom;', work / "osm.json")
overpass('(node["amenity"~"restaurant|cafe|bar|fast_food"]BBOX;way["amenity"~"restaurant|cafe|bar|fast_food"]BBOX;);out center tags;', work / "poi.json")
overpass('(nwr["amenity"="parking"]BBOX;nwr["building"]["name"]BBOX;nwr["tourism"]["name"]BBOX;);out center tags;', work / "base.json")
if cfg.get("outline"):
    overpass(f'way({cfg["outline"]});out geom;', work / "outline.json")
overpass('(way["natural"="wood"]BBOX;way["landuse"="forest"]BBOX;relation["natural"="wood"]BBOX;relation["landuse"="forest"]BBOX;);out geom;', work / "forest.json")

Z = 14
def tile(lat, lon):
    n = 2 ** Z
    return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
(tx0, ty0), (tx1, ty1) = tile(bbox[2], bbox[1]), tile(bbox[0], bbox[3])
tiles = work / "tiles"; tiles.mkdir(exist_ok=True)
for tx in range(tx0, tx1 + 1):
    for ty in range(ty0, ty1 + 1):
        f = tiles / f"{tx}_{ty}.png"
        if not f.exists():
            url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png"
            subprocess.run(["curl", "-s", "-f", "-m", "60", "-A", "ski-prerun", "-o", str(f), url], check=True)
print(f"  {(tx1 - tx0 + 1) * (ty1 - ty0 + 1)} terrain tiles")

conf = work / "resort.json"
outline = [[g["lat"], g["lon"]] for g in json.load(open(work / "outline.json"))["elements"][0]["geometry"]] if cfg.get("outline") else None
conf.write_text(json.dumps({"name": cfg["name"], "bbox": bbox, "villages": cfg.get("villages", []), **{k: cfg[k] for k in ("treeline", "grid") if k in cfg}, **({"outline": outline} if outline else {})}))
data = here.parent / "data"
subprocess.run([sys.executable, str(here / "bake.py"), str(work / "osm.json"), str(tiles), str(data / f"{rid}.json"), str(work / "poi.json"), str(work / "forest.json"), str(conf), str(work / "base.json")], check=True)
subprocess.run([sys.executable, str(here / "bake_far.py"), str(data / f"{rid}.json"), str(data / f"{rid}-far.json")], check=True)
