# Agent guide

Product contract: [venture-lab `product-incubator/products/48/PRODUCT.md`](https://github.com/Jinqiudong/venture-lab/blob/main/product-incubator/products/48/PRODUCT.md). Idea: [venture-lab #48](https://github.com/Jinqiudong/venture-lab/issues/48).

## Product principles (do not break)
- The job is route familiarity for a real ski day. Every feature should help someone know where they are, where a lift or run goes, and how to get from A to B at their level.
- Real data stays real: run names, difficulties, lifts and terrain come from OpenStreetMap and terrain tiles via `tools/bake.py`. Never invent runs, lifts or connections; mark gaps instead.
- Never route a rider over runs harder than their chosen level without saying so.
- Look: stylized realism — real proportions, soft snow, long blue shadows, boxed hand-drawn UI. Not chibi.
- Ski and snowboard are both first-class: model, stance and physics differ.
- It must run in a phone browser from a static site (GitHub Pages). No accounts, no server, no build step.
- Always show the OpenStreetMap attribution and the "use the official trail map on the mountain" note.

## Code map
- `main.js` — app: map, planner UI, journeys (lift rides and runs), HUD, minimap.
- `world.js` — terrain, sun shadows, sky, forest, run layers, trail signs, lifts.
- `rider.js` — rider models, slope physics, tracks, spray.
- `route.js` — route graph and planner (no three.js; tested in `tests/route.test.mjs`).
- `tools/bake.py` — builds `data/<resort>.json`.

## Workflow
- Follow venture-lab `WORKFLOW.md`: issue → branch → PR (`Closes #N`) → review/QA → merge. `main` deploys to Pages.
- Before a PR: `node --test tests/route.test.mjs`, and check the page loads in a phone-sized headless browser with no console errors.
- Code, docs, commits and PRs are in English. UI copy is Simplified Chinese.
