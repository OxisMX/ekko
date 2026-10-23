// WHY: haptics and Sentry are native/ESM modules that jest cannot load; every Button pulls them in, so mock once for all suites.
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light" },
}));
jest.mock("./src/lib/sentry", () => ({ reportError: jest.fn() }));
