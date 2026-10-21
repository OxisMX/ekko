import { shouldShowPushExplainer } from "./pushExplainer";

jest.mock("expo-notifications", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () => ({}));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));

describe("shouldShowPushExplainer (A-16)", () => {
  it.each([
    ["undetermined", false, true],
    ["undetermined", true, false],
    ["granted", false, false],
    ["denied", false, false],
  ])("permission %s, seen %s -> %s", (permission, seen, expected) => {
    expect(shouldShowPushExplainer({ permission, seen })).toBe(expected);
  });
});
