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
- Proposed by Claude, pending the owner's review: nav cues at 200 m and again at 50 m; keep a compact
  slope profile in run previews.
