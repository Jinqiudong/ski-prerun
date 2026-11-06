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
  - ~~`Pose_Peace`~~ (dropped by the owner in batch 4)
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

---

## Batch 4: fixes from the owner's review of batch 3 (2026-11-06)

Every clip was rendered in the game's own `character.js` with real colours, at 25 %, 50 % and 85 % of its length, from the front and three-quarters, plus side views of the chairlift, fall and board clips. The sheets and the owner's phone screenshots are in `~/Desktop/SnowboardGame/handoff/batch4_review/` (`A-0.jpg` … `A-9.jpg`, `A-side-0.jpg`, `phone_*.png`). Look at them before you start.

### A rule for every clip with a hand on something
The hands are placed as if the wrist were the hand. The mittens are big and reach well past the wrist, so the whole hand overshoots: the forearm ends up across the face, and the mitten floats beside what it should hold.
- Aim the **mitten's palm** (`Hand_R_Socket`, and the same point on the left), not the `Hand` bone.
- A hand or forearm never covers the goggles or the face mask from the front.
- A hand that holds something (the board, the photo card, the radio) touches it, and the thing moves only with the hand.

### 1. Fix
| clip | what's wrong (see the sheet) | what it should be |
|---|---|---|
| `Radio_Talk_Stand`, `Radio_Talk_Ride` | the forearm is across the goggles; the mitten sticks out past the face | the right mitten at the mouth, elbow down and in front of the chest, the face visible; the radio (on `Hand_R_Socket`) upright, antenna up |
| `Pose_Hold_Photo` | both arms nearly straight at face height; the sleeves cover the face | elbows bent, both mittens at the chest holding a small card between them, the face visible |
| `Board_Hold` | the held frame (1 s): neither mitten is on the board; it stands beside her on its own. The clip also goes strapped-in → held → strapped-in, with the board moving by itself | a still pose (a slow breath at most): the board upright on its tail beside her, one mitten over its top, the other on its edge. No strapped-in frames |
| `Sit_Snow` | at the held frame the board floats upright above her head; the clip starts and ends strapped in | sitting on the snow, knees up, the board strapped on and flat in front of her (or unstrapped and lying beside her), the whole clip |
| `Board_Carry` | the board swings between the ground and her side without being held; the hands don't grip it | walking with the board under one arm or held by its edge, the hand on it all the way |
| `Chairlift_Sit`, `Chairlift_LookLeft`, `Chairlift_LookRight` | each goes standing → seated → standing (side sheet): on a looping chair the rider would stand up mid-ride | seated the whole clip, seamless loops (the Look clips: seated base → look → seated base). `Chairlift_Sit_Talk`, `_Point` and `_Wave` are already seated throughout; match their seat |
| `Fall_Toe` | she falls back onto her bottom with the board in front: that is a heel-side fall | a toe-side fall: forward onto the knees and forearms, facing down the hill, the board behind on its toe edge |
| `Melon_Grab` | the front mitten stops at the knee and never reaches the board | the front mitten on the heel edge between the bindings |
| `Skid_Stop_Heel` | the back mitten is tucked at the chest | both arms out for balance, as in `Skid_Stop_Toe` |
| `Entrance_C` | the pop at the end is too small to read | a clearly bigger pop |
| `Entrance_D` | the run-in leaves the snow before the lip | the run-in stays on the snow up to the lip (frame ~207) |

Lower priority: `Heelside_Carve` and `Toeside_Carve` are nearly upright and look like standing. If you can, more edge angle, with the knees and hips driving toward the edge.

### 2. Remove
- `Pose_Peace`: the owner dropped it.
- The old duplicates, which have newer clips: `Anim_Idle`, `Anim_Lift_Exit`, `Anim_Skate_Push`, `Anim_Chairlift_Look`.

### 3. A light version for the ride (most important for the game)
In the ride the player and several friends are on screen at once on an iPhone. F is 134k triangles (111k drawn) and M is 96k, which is too heavy.
- Send `tpl_f_lod.glb` and `tpl_m_lod.glb`, about **30–40k triangles drawn** each.
- Cut mostly the hair (`ACC_Hair` is 28k) and the mittens (12k), then the helmet, boots, bindings and `Details`.
- Keep the same skeleton (with `Hand_R_Socket`), the same `MAT_*` and `ACC_*` names, and the same morphs, so one character set-up drives both.
- The animations stay in `tpl_*_ride.glb`.
- At game distance, a 512 px texture is enough.

### 4. Not in this batch
- Hair and hem bones: waiting on the owner.
- Male hair: waiting on the owner.
- The friend on the right in `Chairlift_Sit_Talk`: the game mirrors it, so no `_R` clip.
- The radio model: the facilities team is modelling it. The game parents it to `Hand_R_Socket`.

### Deliver
- A `batch4/` folder next to `batch3/`, with the four GLBs plus the two `_lod` GLBs and a `HANDOFF_batch4.md`.
- In the note, list what changed per clip.
- Include a contact sheet of every changed clip, rendered with the game's `character.js` in **real colours, not silhouettes**. Show the front and the side at the held frame (poses) or at the key frames (the rest).
