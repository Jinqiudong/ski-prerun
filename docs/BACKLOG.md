# Backlog

Work that waits on something else. Newest first.

## Painted mini map (approved 2026-11-05) — built in `src/ride/paintedmap.js`; friends' live positions wait for "Riding together" (`setPeople`, and the 去找他 / 跟随 handlers)
- Small: a round corner map over the resort's watercolour (`assets/wc/<id>.jpg`), around where you are, "已滑 N%" under it. Smaller than today's square map.
- Open: the whole watercolour as a sheet that pinches and pans; difficulty progress (green/blue/black/double); friends; everything the big map does now (tap anywhere to start there, tap a run for its name and level).
- Runs from `data/vista/<id>.json` (`tools/bake_vista_lines.mjs`, bake all nine resorts). Skied runs: clean, smooth coloured ink lines with a thin paper casing — not wobbly. Not skied: a faint pencil dash.
- People: each shows the avatar they chose (`myAvatar()` / trip member look), not a generic icon. When avatars overlap they gather into one stacked bubble (faces fanned, "+2"); tap it to fan them out or list them; zooming in separates them. Me always on top, ringed in red.
- Friends: "去找他" flies over the mountain to land beside them; "跟随" follows.

## Waiting on the character models (owner + character AI)
- Done in batch 4: the ride draws the templates (`src/rider/boarder.js`: `tpl_*_lod.glb` with the `tpl_*_ride.glb` clips) for me and for friends riding together; the chair clips (sit, look, talk, point, wave), the radio pose, falls and getting up are in.
- **Walkie-talkie:** the radio is ready in the ride (`talkBoarder`: `Radio_Talk_Ride` over the riding pose, the radio in the hand) but nothing calls it until push-to-talk exists (voice, below). Still wanted: the radio on the jacket chest strap otherwise.
- **Riding together on a chair:** more than two friends in a chair all talk toward me; the bar coming down; `Chairlift_Point` plays only on a friend's "这条好滑" / "缆车站见".
- More edge angle in `Heelside_Carve` / `Toeside_Carve` (the ride adds its own lean today; see the batch-4 note).
- Hair and jacket-hem bones for wind; bigger body and fit morphs.

## Riding together (after shared trips) — part 1 built in `src/ride/together.js`; voice is part 2
- Done: friends live on the mountain and the maps (Supabase Realtime broadcast per trip and resort); follow; "去找他" (fly over, land beside them); same chair within 6 s; quick messages ("等我", "缆车站见", "这条好滑", "我先下去了", "去找你").
- Icons wanted for it (stand-ins now): `msg_chat` (the quick-message button; `rider` stands in), `msg_wait` (`rest`), `msg_meet` (`lift`), `msg_good` (`star`), `msg_down` (`snowboard`), `msg_coming` (`compass_rose`).
- Voice: near friends open automatically (proximity, louder when closer); far friends by walkie-talkie push-to-talk with a radio squelch. WebRTC mesh, Supabase for signalling, a TURN relay for some networks. Safari only (in-app browsers often block the mic).
- Listen together: one friend picks a track from the game's own licensed library and everyone hears it in sync (`src/audio` `play(trackId, atSeconds)`). Streaming services can't be rebroadcast inside the game.

## Radio prop (assets/props/radio.glb)
Parent it to `Hand_R_Socket`. Offsets per clip and template from the character AI (batch 4b, measured in three.js at the held frame, 1 s; they replace batch 3's and batch 4's), in `character.js` `PROPS`: `rotation.set(x, y, z)` (XYZ, radians), `position.set(x, y, z)` (metres), in the socket's frame. The antenna points straight up and the speaker toward the mouth; the bottom 5–6 cm sits inside the fist.

| clip | template | rotation | position |
|---|---|---|---|
| `Radio_Talk_Stand` | F | (−0.7685, 1.9000, −0.0231) | (0.0603, 0.0340, −0.0469) |
| `Radio_Talk_Stand` | M | (−1.2481, 1.8100, 0.4752) | (0.0693, 0.0482, −0.0505) |
| `Radio_Talk_Ride` | F | (0.0278, 1.8117, −0.8175) | (0.0528, 0.0340, −0.0459) |
| `Radio_Talk_Ride` | M | (0.0859, 1.6483, −0.8761) | (0.0584, 0.0482, −0.0508) |

The photo card (`Pose_Hold_Photo`, 10.5 × 7.5 cm, between the palms) is on the same socket (batch 4): F rotation (0.3367, −0.2409, 3.1416), position (0.0971, 0, −0.0239); M rotation (0.3367, −0.0772, 3.1416), position (0.0997, 0, −0.0077).
