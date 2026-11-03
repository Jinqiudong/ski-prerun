"""Add each lift's seats and bubble (aerialway:occupancy, aerialway:bubble) to baked resort files.

usage: python3 tools/lift_tags.py data/copper.json [data/other.json ...]
Matches lifts by their OpenStreetMap way id; fetches the tags for each file's box from Overpass.
"""
import json, math, subprocess, sys, time

SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
for path in sys.argv[1:]:
    d = json.load(open(path))
    lat0, lon0 = d["origin"]["lat"], d["origin"]["lon"]
    mx, mz = 111320 * math.cos(math.radians(lat0)), 110574
    x0, z0, x1, z1 = d["bounds"]
    bbox = (lat0 - z1 / mz, lon0 + x0 / mx, lat0 - z0 / mz, lon0 + x1 / mx)
    q = '[out:json][timeout:90];way["aerialway"](%s,%s,%s,%s);out tags;' % bbox
    tags = None
    for attempt in range(10):
        r = subprocess.run(["curl", "-s", "-m", "120", "-A", "ski-prerun", SERVERS[attempt % 2], "--data-urlencode", "data=" + q], capture_output=True)
        try: tags = {e["id"]: e.get("tags", {}) for e in json.loads(r.stdout)["elements"]}; break
        except Exception: time.sleep(8 * (attempt + 1))
    if tags is None: sys.exit(f"{path}: Overpass is not answering")
    for l in d["lifts"]:
        t = tags.get(l["id"], {})
        try: l["seats"] = int(t.get("aerialway:occupancy", "").split(";")[0])
        except ValueError: l.pop("seats", None)
        if t.get("aerialway:bubble") == "yes": l["bubble"] = True
        if t.get("aerialway:detachable") == "yes": l["detachable"] = True
    open(path, "w").write(json.dumps(d, separators=(",", ":")))
    print(path, "; ".join(f"{l['name']} {l['kind']} {l.get('seats', '?')}{' bubble' if l.get('bubble') else ''}" for l in d["lifts"] if l["kind"] in ("chair_lift", "gondola", "mixed_lift", "cable_car")))
