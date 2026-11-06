# Backlog

Work that waits on something else. Newest first.

## Waiting on the character models (owner + character AI)
- **Riding clips for the templates** so the ride can use the four friends instead of Rider A: chairlift sit (alone and side by side), look left/right on the chair, unload, skate, carve left/right, skid stop heel/toe, tuck, fall and get up, small air, the signature tricks.
- **Walkie-talkie:** a pose with the radio raised to the mouth while riding (push-to-talk when friends are far apart), and the radio in the hand or on the jacket chest strap otherwise. The radio prop itself is a facilities/props model (Blender family `props`): a small handheld with antenna, PTT button, belt clip.
- **Riding together on a chair:** two to six friends sitting down together, bar coming down, little gestures (point, wave, lean in to talk).
- Hair and jacket-hem bones for wind; bigger body and fit morphs.

## Riding together (after shared trips)
- See friends live on the mountain and the maps (Supabase Realtime broadcast per trip and resort).
- Follow a friend; "go to them" — fly over the mountain and land beside them.
- Same chair when boarding within a few seconds of each other.
- Voice: near friends open automatically (proximity, louder when closer); far friends by walkie-talkie push-to-talk with a radio squelch. WebRTC mesh, Supabase for signalling, a TURN relay for some networks. Safari only (in-app browsers often block the mic).
- Listen together: one friend picks a track from the game's own licensed library and everyone hears it in sync (`src/audio` `play(trackId, atSeconds)`). Streaming services can't be rebroadcast inside the game.
