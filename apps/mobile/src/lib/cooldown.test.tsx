import { act, renderHook } from "@testing-library/react-native";

import { createCooldown, useCooldown } from "./cooldown";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("useCooldown", () => {
  it("starts at 0 and counts down once started", async () => {
    const cooldown = createCooldown();
    const { result } = await renderHook(() => useCooldown(cooldown));
    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.started).toBe(false);

    await act(() => result.current.start(60));
    expect(result.current.secondsLeft).toBe(60);
    expect(result.current.started).toBe(true);

    await act(() => jest.advanceTimersByTime(3000));
    expect(result.current.secondsLeft).toBe(57);

    await act(() => jest.advanceTimersByTime(60_000));
    expect(result.current.secondsLeft).toBe(0);
  });

  it("shares one countdown between every screen using the same cooldown", async () => {
    const cooldown = createCooldown();
    const banner = await renderHook(() => useCooldown(cooldown));
    const screen = await renderHook(() => useCooldown(cooldown));

    await act(() => banner.result.current.start(42));
    expect(screen.result.current.secondsLeft).toBe(42);
  });

  it("picks up a countdown started before it mounted", async () => {
    const cooldown = createCooldown();
    cooldown.start(30);
    jest.advanceTimersByTime(10_000);
    const { result } = await renderHook(() => useCooldown(cooldown));
    expect(result.current.secondsLeft).toBe(20);
  });
});
