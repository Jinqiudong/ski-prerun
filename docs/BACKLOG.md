# Backlog

Work that waits on something else. Newest first.

## Painted mini map (approved 2026-11-05) — built in `src/ride/paintedmap.js`; friends' live positions wait for "Riding together" (`setPeople`, and the 去找他 / 跟随 handlers)
- Small: a round corner map over the resort's watercolour (`assets/wc/<id>.jpg`), around where you are, "已滑 N%" under it. Smaller than today's square map.
- Open: the whole watercolour as a sheet that pinches and pans; difficulty progress (green/blue/black/double); friends; everything the big map does now (tap anywhere to start there, tap a run for its name and level).
- Runs from `data/vista/<id>.json` (`tools/bake_vista_lines.mjs`, bake all nine resorts). Skied runs: clean, smooth coloured ink lines with a thin paper casing — not wobbly. Not skied: a faint pencil dash.
- People: each shows the avatar they chose (`myAvatar()` / trip member look), not a generic icon. When avatars overlap they gather into one stacked bubble (faces fanned, "+2"); tap it to fan them out or list them; zooming in separates them. Me always on top, ringed in red.
- Friends: "去找他" flies over the mountain to land beside them; "跟随" follows.

## Waiting on the character models (owner + character AI)
- **Riding clips for the templates** so the ride can use the four friends instead of Rider A: chairlift sit (alone and side by side), look left/right on the chair, unload, skate, carve left/right, skid stop heel/toe, tuck, fall and get up, small air, the signature tricks.
- **Walkie-talkie:** a pose with the radio raised to the mouth while riding (push-to-talk when friends are far apart), and the radio in the hand or on the jacket chest strap otherwise. The radio prop itself is a facilities/props model (Blender family `props`): a small handheld with antenna, PTT button, belt clip.
- **Riding together on a chair:** two to six friends sitting down together, bar coming down, little gestures (point, wave, lean in to talk).
- Hair and jacket-hem bones for wind; bigger body and fit morphs.

## Riding together (after shared trips) — part 1 built in `src/ride/together.js`; voice is part 2
- Done: friends live on the mountain and the maps (Supabase Realtime broadcast per trip and resort); follow; "去找他" (fly over, land beside them); same chair within 6 s; quick messages ("等我", "缆车站见", "这条好滑", "我先下去了", "去找你").
- Icons wanted for it (stand-ins now): `msg_chat` (the quick-message button; `rider` stands in), `msg_wait` (`rest`), `msg_meet` (`lift`), `msg_good` (`star`), `msg_down` (`snowboard`), `msg_coming` (`compass_rose`).
- Voice: near friends open automatically (proximity, louder when closer); far friends by walkie-talkie push-to-talk with a radio squelch. WebRTC mesh, Supabase for signalling, a TURN relay for some networks. Safari only (in-app browsers often block the mic).
- Listen together: one friend picks a track from the game's own licensed library and everyone hears it in sync (`src/audio` `play(trackId, atSeconds)`). Streaming services can't be rebroadcast inside the game.
