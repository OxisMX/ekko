import { shouldShowPushExplainer } from "./pushExplainer";

jest.mock("expo-notifications", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () => ({}));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));

describe("shouldShowPushExplainer (A-16)", () => {
  it.each([
    ["undetermined", true, false, true],
    ["denied", true, false, true], // Android: never asked yet
    ["undetermined", true, true, false],
    ["granted", true, false, false],
    ["denied", false, false, false],
  ])("permission %s, canAskAgain %s, seen %s -> %s", (permission, canAskAgain, seen, expected) => {
    expect(shouldShowPushExplainer({ permission, canAskAgain, seen })).toBe(expected);
  });
});
