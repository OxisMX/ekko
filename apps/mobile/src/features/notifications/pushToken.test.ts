import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { readPushRegistration } from "./pushToken";

jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock("expo-notifications", () => ({
  AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

const setProject = (projectId?: string) => {
  (Constants as unknown as { expoConfig: unknown }).expoConfig = { extra: { eas: projectId ? { projectId } : undefined } };
};
const permission = (status: string) => jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status } as never);

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, "OS", { get: () => "android", configurable: true });
  setProject("proj-1");
});

describe("readPushRegistration", () => {
  it("is disabled without a token when the permission is not granted", async () => {
    permission("undetermined");
    expect(await readPushRegistration()).toEqual({ enabled: false, token: null });
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it("creates the Android channel and returns the Expo token when granted", async () => {
    permission("granted");
    jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ data: "ExponentPushToken[x]", type: "expo" });
    expect(await readPushRegistration()).toEqual({ enabled: true, token: "ExponentPushToken[x]" });
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith("default", expect.objectContaining({ name: "Ekko" }));
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "proj-1" });
  });

  it("is enabled with a null token when there is no EAS project", async () => {
    permission("granted");
    setProject(undefined);
    expect(await readPushRegistration()).toEqual({ enabled: true, token: null });
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it("does not break when the token request fails", async () => {
    permission("granted");
    jest.mocked(Notifications.getExpoPushTokenAsync).mockRejectedValue(new Error("Expo Go"));
    expect(await readPushRegistration()).toEqual({ enabled: true, token: null });
  });
});
