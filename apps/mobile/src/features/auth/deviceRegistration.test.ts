import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { registerDevice } from "./deviceRegistration";

const mockRpc = jest.fn();
jest.mock("../../lib/supabase", () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));
const mockReadPush = jest.fn();
jest.mock("../notifications/pushToken", () => ({ readPushRegistration: () => mockReadPush() }));
jest.mock("expo-application", () => ({ getAndroidId: jest.fn(), getIosIdForVendorAsync: jest.fn() }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));
jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: jest.fn(async (algorithm: string, value: string) => `${algorithm}(${value})`),
  randomUUID: () => "generated-uuid",
}));

// expo-crypto's own output is lowercase hex; here the mock just records what was hashed and how.
const sha256 = (value: string) => `SHA-256(${value})`;

function setOS(os: "ios" | "android") {
  Object.defineProperty(Platform, "OS", { get: () => os, configurable: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
  mockReadPush.mockResolvedValue({ enabled: false, token: null });
});

describe("registerDevice (F-01)", () => {
  it("sends the SHA-256 of the Android ID with platform android and push disabled", async () => {
    setOS("android");
    jest.mocked(Application.getAndroidId).mockReturnValue("android-id");
    await registerDevice();
    expect(mockRpc).toHaveBeenCalledWith("register_device", { p_device_id_digest: sha256("android-id"), p_platform: "android", p_push_enabled: false, p_expo_push_token: undefined });
  });

  it("sends the push permission and token when available", async () => {
    setOS("android");
    jest.mocked(Application.getAndroidId).mockReturnValue("android-id");
    mockReadPush.mockResolvedValue({ enabled: true, token: "ExponentPushToken[x]" });
    await registerDevice();
    expect(mockRpc).toHaveBeenCalledWith("register_device", {
      p_device_id_digest: sha256("android-id"),
      p_platform: "android",
      p_push_enabled: true,
      p_expo_push_token: "ExponentPushToken[x]",
    });
  });

  it("uses the iOS vendor ID on iOS", async () => {
    setOS("ios");
    jest.mocked(Application.getIosIdForVendorAsync).mockResolvedValue("vendor-id");
    await registerDevice();
    expect(mockRpc).toHaveBeenCalledWith("register_device", { p_device_id_digest: sha256("vendor-id"), p_platform: "ios", p_push_enabled: false, p_expo_push_token: undefined });
  });

  it("falls back to a persisted random ID when the OS gives none", async () => {
    setOS("ios");
    jest.mocked(Application.getIosIdForVendorAsync).mockResolvedValue(null);
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    await registerDevice();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("ekko.device-id", "generated-uuid");
    expect(mockRpc).toHaveBeenCalledWith("register_device", { p_device_id_digest: sha256("generated-uuid"), p_platform: "ios", p_push_enabled: false, p_expo_push_token: undefined });
  });

  it("throws the RPC error so the caller can report it", async () => {
    setOS("android");
    jest.mocked(Application.getAndroidId).mockReturnValue("android-id");
    mockRpc.mockResolvedValue({ data: null, error: { message: "E-23" } });
    await expect(registerDevice()).rejects.toEqual({ message: "E-23" });
  });
});
