# 雪场预滑 · Ski Pre-Run

A chibi, playable version of a real ski resort: explore the 3D map, ride a lift, ski a run, and learn the routes the night before you go. Prototype for Venture Lab idea [#48](https://github.com/Jinqiudong/venture-lab/issues/48). First resort: Copper Mountain, Colorado (155 runs, 23 lifts).

- Map mode: drag to orbit, pinch to zoom, tap a run or lift. The list (☰) searches every run and lift.
- Ski mode: drag left/right to steer, 刹车 to brake, 蹬 to skate across flats, 自动滑 follows the run on its own.
- After a run or a lift ride it suggests the lifts and runs that start nearby, so you can chain a route.

Run locally: `python3 -m http.server 8765`, then open http://localhost:8765/.

## Data

`tools/bake.py` turns an Overpass export (downhill pistes and aerialways) and AWS Terrain Tiles (terrarium, z13) into `data/<resort>.json`: a heightmap, runs, lifts and a tree mask. Runs outside the bounding box are dropped (Copper's Overpass box also catches Breckenridge). Glades and bowls mapped as outlines are skied from their highest to their lowest point.

```sh
# pistes and lifts for the resort's bounding box (S,W,N,E)
curl -A "ski-prerun" https://overpass-api.de/api/interpreter \
  --data-urlencode 'data=[out:json];(way["piste:type"="downhill"](S,W,N,E);way["aerialway"](S,W,N,E););out geom;' -o osm.json
# terrain tiles: https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/{x}/{y}.png saved as tiles/{x}_{y}.png
python tools/bake.py osm.json tiles data/copper.json   # needs numpy and pillow; set the bbox at the top of bake.py
```

Runs and lifts © OpenStreetMap contributors (ODbL). Terrain: AWS Terrain Tiles (Mapzen, USGS).

A prototype for getting familiar with a resort. Always use the resort's official trail map on the mountain.
