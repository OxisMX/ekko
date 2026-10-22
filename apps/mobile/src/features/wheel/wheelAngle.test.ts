import { winningRotation } from "./wheelAngle";

// The segment center ends at the pointer when (index + 0.5) * slice + rotation is a multiple of 360.
const centerAfter = (index: number, count: number, turns: number) => ((((index + 0.5) * 360) / count + winningRotation(index, count, turns)) % 360);

describe("winningRotation", () => {
  it.each([
    [0, 6],
    [2, 6],
    [5, 6],
    [3, 5],
    [0, 1],
  ])("puts segment %i of %i under the pointer", (index, count) => {
    expect(centerAfter(index, count, 5)).toBeCloseTo(0, 6);
  });

  it("adds the extra full turns", () => {
    expect(winningRotation(0, 4, 5) - winningRotation(0, 4, 0)).toBe(1800);
  });
});
