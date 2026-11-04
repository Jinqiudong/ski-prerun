"""Find the flats and uphills on every run, for snowboarders: where the slope eases under about 4 degrees for
120 m or more (you'll lose speed and may have to skate), and where it climbs (you'll walk). From the run lines
and the terrain in data/<id>.json. Writes data/flats.json ({ resort: { runId: [[i0, i1, metres, kind]] } }
with point indices along the run) and a summary into data/resorts.json (stats.flats: the longest ones).

usage: python tools/bake_flats.py      (needs numpy)
"""
import base64, json
import numpy as np

FLAT, UP, MIN_FLAT, MIN_UP, WIN = 0.07, -0.01, 120, 25, 3  # grade thresholds, shortest stretch (m), window (points each side)
resorts = json.load(open("data/resorts.json"))
out = {}
for r in resorts:
    if not r.get("ready"): continue
    d = json.load(open(f"data/{r['id']}.json"))
    gw, gh = d["grid"]; x0, z0, x1, z1 = d["bounds"]
    H = np.frombuffer(base64.b64decode(d["heights"]), dtype="<u2").astype(np.float32).reshape(gh, gw) / 10
    def h(x, z):
        fx = np.clip((x - x0) / (x1 - x0) * (gw - 1), 0, gw - 1.001); fz = np.clip((z - z0) / (z1 - z0) * (gh - 1), 0, gh - 1.001)
        i, j = np.floor(fx).astype(int), np.floor(fz).astype(int); u, v = fx - i, fz - j
        return (H[j, i] * (1 - u) + H[j, i + 1] * u) * (1 - v) + (H[j + 1, i] * (1 - u) + H[j + 1, i + 1] * u) * v
    found, named = {}, []
    for run in d["runs"]:
        if run.get("area") or len(run["pts"]) < 2 * WIN + 2: continue
        p = np.array(run["pts"]); hs = h(p[:, 0], p[:, 1])
        seg = np.hypot(*np.diff(p, axis=0).T); dist = np.concatenate([[0], np.cumsum(seg)])
        n = len(p); grade = np.zeros(n)
        for k in range(n):
            a, b = max(0, k - WIN), min(n - 1, k + WIN)
            grade[k] = (hs[a] - hs[b]) / max(1, dist[b] - dist[a])  # drop per metre, downhill positive
        spans = []
        for kind, test, least in (("up", grade < UP, MIN_UP), ("flat", (grade < FLAT) & (grade >= UP), MIN_FLAT)):
            k = 0
            while k < n:
                if not test[k]: k += 1; continue
                e = k
                while e + 1 < n and test[e + 1]: e += 1
                m = dist[e] - dist[k]
                if m >= least: spans.append([int(k), int(e), int(round(m)), kind])
                k = e + 1
        if spans:
            found[str(run["id"])] = spans
            if run["name"]: named.append((sum(s[2] for s in spans if s[3] == "flat"), run["name"], run["level"]))
    out[r["id"]] = found
    best = {}
    for m, name, lv in sorted(named, reverse=True):
        if name not in best and m >= MIN_FLAT: best[name] = [name, lv, int(m)]
    r.setdefault("stats", {})["flats"] = list(best.values())[:6]
    print(r["id"], len(found), "runs with flats/uphills; longest:", list(best.values())[:3])
json.dump(out, open("data/flats.json", "w"), separators=(",", ":"))
json.dump(resorts, open("data/resorts.json", "w"), ensure_ascii=False, indent=2)
