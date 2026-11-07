// The phone's tilt as riding input, shared by the ride (ride.js) and the bunny hill practice (practice.js).
// It reads "up" in the phone's own frame (gravity), never the compass, and measures each tilt from a reference
// pose, so it works the same standing, sitting, or lying down with the phone overhead:
// - steer: the phone's left/right edge tipped down from the reference; a small dead zone, full at 18°;
// - pace: the top tipped away (speed up) or back (brake) from the reference, measured as a turn about the
//   phone's own side axis, so it never wraps; needs a clear tip (6°+), full at 24°.
// The reference follows the way you hold the phone, with no buttons:
// - slowly (~10 s) toward where the phone sits on average (a ~4 s mean): linked turns tip both ways, so they
//   pull it back to your true level, while one turn or a brake held for a few seconds barely moves it;
// - fast for a new posture (the top tipped 35°+ or the side 45°+ off, e.g. picking the phone up off a table, or
//   lying back on the sofa): caught up within about a second, and meanwhile nothing reads as braking.
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ramp = (v, dead, full) => Math.sign(v) * clamp((Math.abs(v) - dead * DEG) / ((full - dead) * DEG), 0, 1) || 0;
const unit = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
// (nearly upside down from it, there's no sensible way between: jump)
const toward = (a, b, k) => a.x * b.x + a.y * b.y + a.z * b.z < -0.9 ? b : unit({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
export const REGRIP = 35 * DEG, REGRIP_SIDE = 45 * DEG;

// The tip of `up` from the reference `ref`: side (right edge down: positive) and fwd (top away: positive).
export function tipOf(ref, up) {
  const side = Math.asin(clamp(-up.x, -1, 1)) - Math.asin(clamp(-ref.x, -1, 1));
  const fwd = Math.atan2(ref.y * up.z - ref.z * up.y, ref.y * up.y + ref.z * up.z);
  return { side, fwd };
}

// A reference set to the pose `up` now (开始 in the practice). An empty {} instead takes the next reading.
export const tiltZero = (up) => { const u = unit(up); return { ref: u, mean: u, regrip: false }; };

// zero: the reference pose, kept and moved here. up: "up" in the phone's frame.
export function tiltRead(zero, up, dt, settle = 0.1) {
  up = unit(up);
  if (!zero.ref) { zero.ref = up; zero.mean = up; zero.regrip = false; }
  zero.mean = toward(zero.mean, up, Math.min(1, dt / 4));
  let tip = tipOf(zero.ref, up);
  if (Math.abs(tip.fwd) > REGRIP || Math.abs(tip.side) > REGRIP_SIDE) zero.regrip = true;
  if (zero.regrip) {
    zero.ref = toward(zero.ref, up, Math.min(1, dt * 4));
    tip = tipOf(zero.ref, up);
    if (Math.hypot(tip.fwd, tip.side) < 4 * DEG) { zero.regrip = false; zero.mean = up; }
    return { steer: ramp(tip.side, 2, 18), pace: 0 };
  }
  zero.ref = toward(zero.ref, zero.mean, dt * settle);
  return { steer: ramp(tip.side, 2, 18), pace: ramp(tip.fwd, 6, 24) };
}

// "Up" in the phone's frame from a deviceorientation event's beta/gamma (degrees).
export const upInPhone = (b, g) => ({ x: -Math.cos(b * DEG) * Math.sin(g * DEG), y: Math.sin(b * DEG), z: Math.cos(b * DEG) * Math.cos(g * DEG) });
