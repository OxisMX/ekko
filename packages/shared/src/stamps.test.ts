import { describe, expect, it } from "vitest";
import { stampGridRows } from "./stamps";

describe("stampGridRows", () => {
  it.each([
    [4, [4]],
    [5, [5]],
    [6, [3, 3]],
    [7, [4, 3]],
    [8, [4, 4]],
    [9, [5, 4]],
    [10, [5, 5]],
  ])("%i stamps -> %j", (n, rows) => {
    expect(stampGridRows(n)).toEqual(rows);
  });

  it.each([3, 11, 0, -1, 5.5])("throws RangeError for %d", (n) => {
    expect(() => stampGridRows(n)).toThrow(RangeError);
  });
});
