import { decelTarget, decelTickOffsets, WHEEL_DECEL_MS, winningRotation } from "./wheelAngle";

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

describe("A-70/A-71 decel", () => {
  it("lasts 2.8 s", () => {
    expect(WHEEL_DECEL_MS).toBe(2800);
  });

  it.each([0, 123, 359.9, 360])("lands the segment under the pointer after at least 2 more turns (from %d)", (current) => {
    const target = decelTarget(current, 2, 6);
    expect(target - current).toBeGreaterThanOrEqual(720);
    expect(target - current).toBeLessThan(1080 + 1e-6);
    expect((2.5 * 60 + target) % 360).toBeCloseTo(0, 6);
  });

  it("spaces at most 6 haptic ticks, further apart as the disc slows", () => {
    const ticks = decelTickOffsets();
    expect(ticks).toHaveLength(6);
    const gaps = ticks.slice(1).map((t, i) => t - ticks[i]!);
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
    expect(ticks.at(-1)!).toBeLessThan(WHEEL_DECEL_MS);
  });
});
