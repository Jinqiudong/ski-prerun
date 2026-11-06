# Art and experience decisions

The owner decides each step; this file records what was decided so later work (human or agent) follows it.
Agenda: 0 MVP scope → 1 art direction → 2 style guide → 3 key frames / storyboard → 4 tech & asset plan →
5 asset list → 6 vertical slice → 7 roll-out → 8 polish and testing.

The game at `/` is a grey-box prototype for gameplay. Style frames live at `/mountain/`.

## Step 1 — The mountain (2026-11-01)

Style frame: `/mountain/` (semi-realistic).

- Semi-realistic, matching the owner's reference sheet ("半写实: 真实比例，色彩更明快，游戏感更强").
- Relief exaggerated 1.3× so ridges read (painted resort-map convention).
- Runs are bold: colored core, white casing, soft glow. US difficulty colors (green, blue, black, double black).
- Light follows the resort's real local time and live weather (clear, cloudy, overcast, snow), with a
  preview to change hour and weather. Accept that north-facing runs sit in shade on winter afternoons.
- Forest from OpenStreetMap woods, drawn larger than life for looks at map scale.
- Island framing: vignette, focus on the mountain.
- Bases are the start points (Center Village, East Village, Union Creek); picking one shows its lifts.

## Day flow (2026-11-01)

- Both modes: free exploration by default, plus quick plans ("今天想怎么滑": warm-up, cruise, challenge,
  lunch at X, back to base).
- Riding is navigation first: trail signs, turn-by-turn at junctions, and how to get from one lift to the
  next (connector runs) must be clear. Game feel is secondary.
- Footprint of the day is in the MVP (path on the map, runs, vertical, lunch stop). No achievements yet.
- Choosing a base opens a miniature (diorama) overview of that area as a short animation, then a
  game-like lift choice.

Next: storyboard of the day flow (step 3 for this flow), then build.

## Base miniature and lift choice (2026-11-01)

- Picking a base opens that area as a miniature world: a thick cut block (snow, earth and rock layers on
  the faces), white rounded plinth with a name plate, relief ×1.8, toy-scale trees, lifts with moving
  chairs and riders, a lodge, little skiers; soft studio light and a tilt-shift blur.
- Intro: one 10-second turn around the block, skippable. Then drag to turn.
- Lift choice as cards: length, ride time, top altitude, runs leaving the top by difficulty. The chosen
  lift lights runs in three tiers: leaving the top, reachable without another lift, the rest faded.
- Quick plans (warm-up green, cruise blue, challenge black) suggest one loop back to the base.
- Lift selection UI (owner chose C+A from the comparison page): the model never shrinks or moves when
  the UI changes. Each lift has a floating tag in the world; a horizontal card carousel sits along the
  bottom; tag, centred card and lit runs stay in sync. Picking a lift turns the model to see it from
  below and lights its runs flowing downhill from the top. Plan chips sit along the top. "详情" grows into
  a sheet; the model dims and rises a little but keeps its size.
- Proposed by Claude, pending the owner's review: nav cues at 200 m and again at 50 m; keep a compact
  slope profile in run previews.

## From the air (2026-11-06)

- The owner rejected the miniature block above (toy cone trees, rainbow riders on box chairs, black-box
  stations, the cake-layer plinth, table and name plaque: a style apart from the rest of the app) and
  approved the "aerial" look of the start page's map for every 3D view of a resort.
- The look: the start map's tile recipe baked larger (`tools/bake_tiles.py --aerial`, 2048 px over the
  resort's baked area): snow lit from the north-west, cool blue-grey in shade; dark woods from the real
  tree mask with the runs cut through them as white ribbons; grey rock on the steeps. It fades into the
  paper at its edges, never a hard block edge.
- Runs are thin ink ribbons (a little over 2 px on screen at any distance, 0.8 opacity) in the painted
  map's ink: easy #2e8b4f, intermediate #2a5db0, advanced and expert #1c1f25. Lifts are thin dark cables
  on small towers with small grey stations; the chosen lift has a thin amber glow. Base lodges are the
  kit's `base_lodge` model. Calm light; no tilt-shift.
- Picking a base: no separate block; the camera flies down from the whole mountain to a steep look
  (about 63°) over that base on the same terrain, and back up on "←". The intro turn, tags, cards and
  plans stay as they were. The top of a lift in the ride uses the same view, with a calmer "you are here".
- Screenshots: `docs/art/aerial/`.

## Art direction for the ride (2026-11-01)

- Owner compared two looks of the American Flyer ride (`/look.html`): A semi-realistic (reference: Grand
  Mountain Adventure 2) and C stylised (reference: Lonely Mountains: Snow Riders). **Chose A.**
- Assets: only sources that need no login and allow commercial use (CC0 first: Poly Haven, ambientCG).
  Sketchfab is out (download needs an account).
- Trees: spruce built from branch cards painted from Poly Haven's fir_tree_01 twig textures
  (`tools/make_branch.py`), snow only on sky-facing faces; fewer tiers far from the lift.
- Next: vertical slice of this stretch in A until the owner is happy, then roll out to the game.

## Lift and riders (2026-11-02)

- American Flyer modelled as the real lift: Leitner-Poma detachable six-pack with Copper's blue bubbles
  (2018; 182 chairs, 5 m/s, ~3 km). The rider can lower or raise their bubble.
- Riders: no real faces. Every rider wears helmet, goggles and a face mask; friends are told apart by
  outfit, gear and board. Friends' photos are not uploaded anywhere or committed.
- The code-grown clothes on the CC0 base body (`avatar.js`, `/riders.html`) were rejected as a look. The
  owner is trying ChatGPT's Blender tools for a proper character; Claude integrates whatever GLB comes back.
