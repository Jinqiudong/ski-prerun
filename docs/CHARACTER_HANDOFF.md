# What the game needs from the character pipeline

The game today loads two templates (`assets/riders/tpl_f.glb`, `tpl_m.glb`) and `data/rider_templates.json` on the rider page (`src/rider/character.js`); the ride still uses the old `rider_a_v2.glb` (`src/rider/rider-a.js`) because the templates have no riding clips. The tuned female and male versions (Rider A, Rider B) should replace both.

## 1. Files
- `tpl_f.glb` and `tpl_m.glb`: glTF binary, Draco-compressed, ≤ 3.5 MB each, textures ≤ 2048 px.
- An updated `data/rider_templates.json`.
- Keep the `.blend` sources on your side; send their path and the commit they came from.
- Put everything in one folder and tell us its path; we copy it in.

## 2. Keep the contract, or send a mapping
The game finds things by name. If any name below changes, send an old → new table.
- **Units and axes:** metres; the root at the board's base; the rider faces the same way as today.
- **Bones** (as today): `Board`, `Hips`, `Spine`, `Chest`, `Neck`, `Head`, and the arm, leg and hand bones. `Board` carries the board.
- **Morph targets** (shape keys), each with `_up` and `_down`:
  - `weight`
  - `muscle`
  - `jacket_ease`
  - `jacket_length`
  - `pants_ease`
  
  Make their range clearly visible; today's are too subtle.
- **Materials:** `MAT_jacket`, `MAT_pants`, `MAT_helmet`, `MAT_lens`, `MAT_mitten`, `MAT_boots`, and the rest of the current `MAT_*`. Each recolourable part must be its own material.
- **Accessories** (meshes the game turns on and off): `ACC_Hair`, `ACC_Hood`, `ACC_Vest`, `ACC_Visor`, `ACC_Stickers`, and the grid pattern.
- **`rider_templates.json`:**
  - `templates` F/M
  - `sliders`
  - `presets` A–D: the four friends' body, fit, colours, parts, board and favourite trick
  - `clips`

## 3. Animations (30 fps, in place with no root motion, loops seamless where they loop)
**Keep what exists:** `Stand_Idle`, `Board_Hold`, `Sit_Snow`, `Anim_Carve_Ref`, `Anim_Carve_S`, `Anim_Carve_Spin_Toe`, `Anim_Chill_Cruise`, `Anim_Indy_Air`, `Anim_Method_Air`, `Anim_Nose_Press`, `Anim_Ollie`, `Anim_Pop_Ref`, `Anim_Skid_S`, `Anim_Tail_Press`, `Anim_Toe_Slide_Ref`.

**New, so the ride can use the templates.** The names match what the ride already plays on Rider A:
- **Stance:** `Neutral_Standing`, `Snowboard_Stance`, `Low_Stance` (tuck), `Knee_Bend`.
- **Turns, as short loops or holds:**
  - `Heelside_Turn`, `Toeside_Turn`
  - `Heelside_Carve`, `Toeside_Carve`
  - `Left_Turn`, `Right_Turn`
  - `HeelToToe_HipPush`, `ToeToHeel_Crouch`
- **Getting about:** `Skate_Push` (one foot out, pushing), `Board_Carry` (walking with the board).
- **Lift:**
  - `Chairlift_Sit` (one seat, board hanging)
  - `Chairlift_LookLeft`, `Chairlift_LookRight`
  - `Lift_Exit` (stand and glide off the ramp)
- **Air:**
  - `Ollie` (pop), `Ollie_Air` (hold)
  - `Indy_Grab`, `Melon_Grab`, `Tail_Grab` (holds in the air)
  - `Nose_Press`, `Tail_Press`
- **Stops and falls:**
  - `Skid_Stop_Heel`, `Skid_Stop_Toe` (sideways slide to a stop)
  - `Fall_Heel` / `Fall_Toe` and `Get_Up`

## 4. New for features being built
- **Riding together on a chair:**
  - sitting side by side with a friend: `Chairlift_Sit_Talk` (lean in, gesture)
  - `Chairlift_Point`
  - `Chairlift_Wave`
- **Walkie-talkie** (talking to far-away friends): `Radio_Talk_Ride`, the radio raised to the mouth while riding, and `Radio_Talk_Stand`.
  - The radio is a small prop the facilities team will model.
  - Put a socket bone in the hand: `Hand_R_Socket`.
- **Photos and the rider page:**
  - `Pose_Wave`
  - `Pose_Peace`
  - `Pose_Hold_Photo` (both hands holding a small card up)
  - `Pose_Cheer`
- **Each friend's entrance,** as one continuous clip, replacing the stitched ones:
  - A: euro carve
  - B: carve spin
  - C: carve S
  - D: Method off a kicker, with the run-in

## 5. Nice to have
- Hair and jacket-hem bones (`Hair_*`, `Hem_*`), so the game can add wind sway.

## 6. A short handoff note
- What changed from the current templates.
- The bone, morph and material lists.
- Triangle counts.
- Known issues.
- A screenshot of the four presets A–D.
