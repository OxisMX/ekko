const FULL_TURN = 360;

/**
 * Total clockwise rotation (degrees) that leaves the center of `segmentIndex` under the pointer.
 * Segment 0 starts at the pointer (top) and segments run clockwise, so after rotating by R its
 * center sits at (index + 0.5) * slice + R; the pointer needs that to be a multiple of 360.
 */
export function winningRotation(segmentIndex: number, segmentCount: number, extraTurns: number): number {
  const slice = FULL_TURN / segmentCount;
  const toPointer = (FULL_TURN - ((segmentIndex + 0.5) * slice) % FULL_TURN) % FULL_TURN;
  return extraTurns * FULL_TURN + toPointer;
}

/** A-71: the brief asks 2-3 s for the whole deceleration. */
export const WHEEL_DECEL_MS = 2800;
/** A-70: one turn of the linear "priming" spin shown while the server answers. */
export const WHEEL_PRIME_TURN_MS = 500;
const MIN_DECEL_TURNS = 2;
const MAX_TICKS = 6;

/**
 * A-70: final rotation for a decel that starts from `current` (a priming angle), landing on the winning
 * segment after at least MIN_DECEL_TURNS more turns, so it never reverses or snaps back.
 */
export function decelTarget(current: number, segmentIndex: number, segmentCount: number): number {
  const base = winningRotation(segmentIndex, segmentCount, 0);
  const turns = Math.ceil((current + MIN_DECEL_TURNS * FULL_TURN - base) / FULL_TURN);
  return base + turns * FULL_TURN;
}

/**
 * A-73: ms offsets of the haptic ticks during an ease-out cubic decel. A tick fires each time the disc
 * crosses an equal share of its travel, so they space out as it slows. Max ~6.
 */
export function decelTickOffsets(durationMs: number = WHEEL_DECEL_MS, ticks: number = MAX_TICKS): number[] {
  return Array.from({ length: ticks }, (_, i) => Math.round(durationMs * (1 - Math.cbrt(1 - (i + 1) / (ticks + 1)))));
}
