# Agent guide

Product contract: [venture-lab `product-incubator/products/48/PRODUCT.md`](https://github.com/Jinqiudong/venture-lab/blob/main/product-incubator/products/48/PRODUCT.md). Idea: [venture-lab #48](https://github.com/Jinqiudong/venture-lab/issues/48).

## Product principles (do not break)
- The job is route familiarity for a real ski day. Every feature should help someone know where they are, where a lift or run goes, and how to get from A to B at their level.
- Real data stays real: run names, difficulties, lifts and terrain come from OpenStreetMap and terrain tiles via `tools/bake.py`. Never invent runs, lifts or connections; mark gaps instead.
- Never route a rider over runs harder than their chosen level without saying so.
- Look: stylized realism — real proportions, soft snow, long blue shadows, boxed hand-drawn paper UI. Not chibi. 3D facilities are semi-realistic (see `models/facilities/blender/README.md`).
- Icons come from the owner's painted library (`assets/icons/README.md`); ask the owner for missing ones.
- Snowboard only. The rider page has four friends built from the character templates (`src/rider/character.js`); the ride still uses Rider A (`src/rider/rider-a.js`) until the templates have riding clips.
- It must run in a phone browser from a static site (GitHub Pages), no build step. Shared trips use Supabase (`tools/supabase.sql`) by the owner's choice; friends never need an account.
- Always show the OpenStreetMap attribution and the "use the official trail map on the mountain" note.

## Layout
- Pages (their URLs are shared, keep them): `index.html` → `start.html` (rider, map, trips, log), `mountain/` (a resort as a miniature: pick a base and a lift), `look.html` (the ride), `sound.html` (the sound lab: every sound and music track, synth next to real recordings, with picks to send us).
- `src/core/` — shared: `i18n.js` (copy, English, avatars), `nav.js`, `route.js` (route graph and planner, no three.js; tested), `skilog.js` (what you've skied), `look.js` (my avatar and rider, as friends on a shared trip see them), `transition.js` (the short scenes between pages: the flight to a resort, the lift ticket, the drop-in card; its `COPY` pool is where the owner adds lines).
- `src/start/` — the first screen: `start.js`, `collection.js` (the Colorado map), `resort-tiles.js` (resort tiles as dioramas, animals), `pets.js` (the tile animals as desk pets: lift, drop, tap, emotes), `intro.js` (the opening), `trips.js` (trips and sharing), `memory.js` (the log: a deck of group photos, one per ski day, filtered by season), `season.js` (ski days by season; tested), `photo.js` (draws a day's group photo in 2D from the owner's crayon pose sheets; new poses are a file and one line in `POSES`), `entrance.js` (each friend's entrance on the rider page).
- `src/rider/` — `character.js` (templates: body, fit, parts, colours, moves, presets), `rider-a.js` (the ride's rider: model, clips, poses).
- `src/mountain/` — `mountain.js` (the resort page), `diorama.js` (the miniature, also used by the ride's maps).
- `src/ride/` — `ride.js` (the ride: up the lift, the top, the run down, guide, maps, tricks), `board.js` (board physics, tracks, spray), `world.js` (terrain, far ranges, woods, run ribbons, lifts), `sky.js`, `skinav.js` (junctions), `facilities.js` (which kit model each real lift gets, from `data/facilities/<id>.json` or the OSM tags; GLB loading, instanced pools with near/far detail, painted signs) and `kitworld.js` (the kit placed in the ride: the lift you ride, the lifts around, buildings, run and junction signs, props), `snownames.js` (run names on the snow), `roadbook.js`, `mapview.js` (the roadbook's trail map), `paintedmap.js` (the ride's map: the resort's watercolour with the runs you've skied inked on it; the round corner map and the sheet; people as their avatars, `setPeople`).
- `src/audio/` — the sound (WebAudio, see `src/audio/README.md`): `engine.js` (one context, buses sfx / ambience / music / voice, `duck`, settings), `buffers.js` (sound material from seeds), `snow.js` (the board on snow, driven by the physics), `ambience.js` (wind, mountain, lift), `music.js` (manifest player, generated tracks, `play` / `current`), `index.js` (what the ride calls), `panel.js` (the sound drawer), `lab.js` (the sound lab page), `real.js` (the real recordings in the ride: board layer, riders passing, stations, the slope). Music tracks and their licences: `assets/audio/music/manifest.json`.
- `src/styles/` — `paper.css` (the shared paper theme, loaded after each page's own sheet) and one sheet per page (`<page>.css`, plus `<page>-paper.css` for overrides that load after the theme).
- `assets/` — icons, animals, riders, textures, paintings, tiles, audio (`audio/music/`: the manifest; `audio/lab/`: the lab's CC0 recordings and their manifest, made by `tools/lab_audio.mjs`; `audio/game/`: the recordings the ride plays, made by `tools/game_audio.mjs`; CC0 or CC-BY only). `data/` — baked resorts (`<id>.json`, `<id>-far.json`), where runs and lifts fall on each watercolour (`vista/<id>.json`, `tools/bake_vista_lines.mjs`), `resorts.json`, region, drives, hikes, flats, rider templates.
- `models/` — modelled things: `models/facilities/` (Blender build, GLBs, catalogue). See `models/README.md`.
- `tools/` — the data and art pipeline (`bake*.py`, `fetch_resort.py`, `lift_tags.py`, `build_animals.py`, `watercolor.py`, `supabase.sql`) and `check.mjs`.
- `tests/` — `node --test` unit tests. `docs/art/DECISIONS.md` — art decisions the owner made.

## Conventions
- ES modules loaded straight from the pages with an import map for three.js 0.170 (CDN). Cache-bust with `?v=N` on the import or link and bump it when a file changes.
- Paths to `assets/` and `data/` inside modules are relative to the page that loads them, not the module.
- Code, docs, commits and PRs are in English. UI copy is Simplified Chinese (English through `src/core/i18n.js`).

## Workflow
- Branch → PR → review → merge; `main` deploys to Pages. CI runs `npm run check` (every literal path resolves) and `npm test`.
- Before merging: `npm run check`, `npm test`, and play the flow in a phone-sized headless browser (start → resort → base → lift → top → run) with no console errors.
