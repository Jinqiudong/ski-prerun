// The phone's tilt as riding input, relative to a zero (how the phone was held at the start). Shared by the
// ride (ride.js) and the bunny hill practice (practice.js).
// - steer: left/right, a small dead zone, full at 18°.
// - pace: forward/back, needs a clear tip (6°+), full at 24°.
// The forward zero settles slowly (`settle` per second) into however you hold the phone. A big change (35°+,
// e.g. picking the phone up off a table after 开始) is a new grip, not a lean: the zero follows it within a
// second, and until it has caught up the tip reads as nothing, never as braking.
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ramp = (v, dead, full) => Math.sign(v) * clamp((Math.abs(v) - dead * DEG) / ((full - dead) * DEG), 0, 1) || 0;
export const REGRIP = 35 * DEG;

export function tiltRead(zero, side, fwd, dt, settle = 0.1) {
  const d = fwd - zero.fwd;
  if (Math.abs(d) > REGRIP) zero.regrip = true;
  if (zero.regrip) {
    zero.fwd += d * Math.min(1, dt * 4);
    if (Math.abs(fwd - zero.fwd) < 4 * DEG) zero.regrip = false;
    return { steer: ramp(side - zero.side, 2, 18), pace: 0 };
  }
  zero.fwd += d * dt * settle;
  return { steer: ramp(side - zero.side, 2, 18), pace: ramp(zero.fwd - fwd, 6, 24) };
}
