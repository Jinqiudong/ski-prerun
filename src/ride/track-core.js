// The track a board or skis leave in the snow, as numbers (no three.js; tested: tests/track.test.mjs). board.js
// Tracks draws it.
export const SKI_TRACK = { gap: 0.12, width: 0.04, plough: 0.14, ink: 0.2 }; // each ski's line: half-width, darkness
export const TRACK = {
  carve: 0.05, // m, half-width of a carved line (soft-edged: the dark core is about the edge's few cm)
  board: 0.78, // m, half the board's length: a skid's smear is this × sin(slip) across each side
  ski: 0.5, // m, half a ski's length that scrapes in a skid or a hockey stop
  powder: 0.22, // m, extra half-width in deep powder (a trench)
  ink: 0.16, // how much a carved line darkens the snow at its middle
  smear: 0.22, // ...and a scraped smear (wide and soft-edged, so it needs a little more to show on corduroy)
  trench: 0.22, // ...and a powder trench at full depth
  step: 0.5, // m between points
  lift: 0.05, // m over the snow (with a polygon offset: no z-fighting with the ground)
};
// The half-width and darkness of a line for the rider's state now.
// slip: board or skis turned across the travel (rad); soft 0..1 powder depth; ski: two skis, hockey 0..1 how far
// into a hockey stop (a skier's skidded turns still leave two thin lines: only a stop scrapes them wide).
export function trackShape({ slip = 0, soft = 0, ski = false, hockey = 0 } = {}) {
  const s = Math.abs(Math.sin(slip)) * (ski ? Math.min(1, Math.max(0, hockey)) : 1), base = ski ? SKI_TRACK.width : TRACK.carve;
  const smear = Math.max(base, (ski ? TRACK.ski : TRACK.board) * s);
  const k = Math.min(1, (smear - base) / 0.25); // 0 carved .. 1 skidding
  const p = Math.min(1, Math.max(0, soft));
  return {
    half: smear + TRACK.powder * p * (ski ? 0.5 : 1),
    ink: (ski ? SKI_TRACK.ink : TRACK.ink) * (1 - k) + TRACK.smear * k + (TRACK.trench - TRACK.ink) * p * (1 - 0.5 * k),
  };
}

