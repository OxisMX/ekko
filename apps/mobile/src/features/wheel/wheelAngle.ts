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
