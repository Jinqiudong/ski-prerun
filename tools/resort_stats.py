"""Add each resort's numbers to data/resorts.json for the resort guide: the lift-served base and top
(metres, from the lift ends on the terrain), named runs by level, and lifts.

usage: python tools/resort_stats.py
"""
import base64, json
from array import array

path = "data/resorts.json"
resorts = json.load(open(path))
for r in resorts:
    if not r.get("ready"): continue
    d = json.load(open(f"data/{r['id']}.json"))
    gw, gh = d["grid"]; x0, z0, x1, z1 = d["bounds"]
    h = array("H"); h.frombytes(base64.b64decode(d["heights"]))
    def height(x, z):
        c = round((x - x0) / (x1 - x0) * (gw - 1)); rr = round((z - z0) / (z1 - z0) * (gh - 1))
        return d["hmin"] + h[min(gh - 1, max(0, rr)) * gw + min(gw - 1, max(0, c))] / 10
    lifts = [l for l in d["lifts"] if l["kind"] != "magic_carpet" and len(l["pts"]) > 1]
    ends = [height(*l["pts"][0]) for l in lifts] + [height(*l["pts"][-1]) for l in lifts]
    levels = {}
    for run in d["runs"]:
        if run["name"] and not run["area"]: levels.setdefault(run["name"], run["level"])
    count = {lv: sum(1 for v in levels.values() if v == lv) for lv in ("easy", "intermediate", "advanced", "expert")}
    r["stats"] = {"base": round(min(ends)), "top": round(max(ends)), "runs": count, "lifts": len(lifts)}
    print(r["id"], r["stats"])
json.dump(resorts, open(path, "w"), ensure_ascii=False, indent=2)
