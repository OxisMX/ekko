import { STAMPS } from "./rules";

// Layout per brief UX/UI §5.1: rows of at most 5, larger row first.
export function stampGridRows(n: number): number[] {
  if (!Number.isInteger(n) || n < STAMPS.min || n > STAMPS.max) {
    throw new RangeError(`stamps must be an integer between ${STAMPS.min} and ${STAMPS.max}, got ${n}`);
  }
  if (n <= 5) return [n];
  const first = Math.ceil(n / 2);
  return [first, n - first];
}
