# Agent guide

Product contract: [venture-lab `product-incubator/products/48/PRODUCT.md`](https://github.com/Jinqiudong/venture-lab/blob/main/product-incubator/products/48/PRODUCT.md). Idea: [venture-lab #48](https://github.com/Jinqiudong/venture-lab/issues/48).

## Product principles (do not break)
- The job is route familiarity for a real ski day. Every feature should help someone know where they are, where a lift or run goes, and how to get from A to B at their level.
- Real data stays real: run names, difficulties, lifts and terrain come from OpenStreetMap and terrain tiles via `tools/bake.py`. Never invent runs, lifts or connections; mark gaps instead.
- Never route a rider over runs harder than their chosen level without saying so.
- Look: stylized realism — real proportions, soft snow, long blue shadows, boxed hand-drawn UI. Not chibi.
- Snowboard only (Rider A, regular or goofy). The old skier, the old game and the dressed base-body riders were removed on 2026-11-04.
- It must run in a phone browser from a static site (GitHub Pages). No accounts, no server, no build step.
- Always show the OpenStreetMap attribution and the "use the official trail map on the mountain" note.

## Code map
- `diorama.js` — the resort tiles as dioramas: layered cut-away sides, pines, an animal walking on each (`ANIMALS`). `?flat` brings back the plain tiles. The map under them: `tools/bake_map_snow.py` → `assets/wc/colorado.jpg`.
- Tabs: a floating frosted pill (`#tabs` in start.html); on the map it folds into one round button when you turn, zoom or pick (`collection.onExplore`), and a tap opens it.
- `intro.js` — the opening, once per visit: a snowy valley with a plane per city of the next trip's riders landing at Denver, on a frosted pane with snowboarders carving behind it (blur by CSS layers: Safari has no canvas `ctx.filter`); sound made with WebAudio on a tap. Skipped under `navigator.webdriver` (tests).
- `start.html` / `start.js` — first screen: the rider (dress, stance), the resorts on a 3D map of Colorado (`collection.js`, from `data/region.*`), trips (`trips.js`), the ski log.
- `mountain/` — a resort as a miniature: pick a base and a lift (`mountain.js`, `diorama.js`).
- `look.html` / `look.js` — the ride: up the lift, then down the run you pick, with the guide, maps and tricks.
- `boarder.js` — Rider A: model, colours, clips and poses. `rider.js` — board physics, tracks, spray.
- `world.js` — terrain, far ranges, woods mask, run ribbons, lifts. `sky.js` — sun and weather palette.
- `route.js` — route graph and planner (no three.js; tested in `tests/route.test.mjs`).
- `mapview.js` (trail map), `skinav.js` (junctions), `snownames.js` (run names on the snow), `skilog.js` (what you've skied).
- `tools/bake.py` builds `data/<resort>.json`; `tools/bake_far.py` the far ranges; `tools/bake_region.py` the Colorado relief; `tools/bake_map.py` the painted map; `tools/bake_tiles.py` the resort tiles; `tools/bake_drives.py` the drives; `tools/bake_flats.py` flats and rises per run; `tools/resort_stats.py` the numbers in the resort guide; `tools/watercolor.py` the ticket paintings.
- `data/hikes.json` — hike-to terrain per resort (researched; times are approximate, check the resort's report). Highland Bowl is walkable in the ride (`look.js`, hike phase).

## Workflow
- Follow venture-lab `WORKFLOW.md`: issue → branch → PR (`Closes #N`) → review/QA → merge. `main` deploys to Pages.
- Before a PR: `node --test tests/route.test.mjs`, and check the page loads in a phone-sized headless browser with no console errors.
- Code, docs, commits and PRs are in English. UI copy is Simplified Chinese.
