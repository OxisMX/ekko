import * as Application from "expo-application";
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { useEffect } from "react";
import { Platform } from "react-native";

import { reportError } from "../../lib/sentry";
import { supabase } from "../../lib/supabase";
import { readPushRegistration } from "../notifications/pushToken";

const FALLBACK_ID_KEY = "ekko.device-id";

async function readDeviceId(): Promise<string> {
  const osId = Platform.OS === "android" ? Application.getAndroidId() : await Application.getIosIdForVendorAsync();
  if (osId) return osId;
  // NOTE: iOS returns no vendor ID right after a device restart until first unlock (and in some
  // simulators). A random ID kept in SecureStore stays stable across launches, so RN-07 still
  // recognises the device; it only changes on reinstall, like the vendor ID itself.
  const stored = await SecureStore.getItemAsync(FALLBACK_ID_KEY);
  if (stored) return stored;
  const generated = randomUUID();
  await SecureStore.setItemAsync(FALLBACK_ID_KEY, generated);
  return generated;
}

/** RN-07: only a SHA-256 of the device ID leaves the phone; the server peppers it again. */
export async function deviceIdDigest(): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, await readDeviceId());
}

/** F-01: registers this device for the signed-in customer. */
export async function registerDevice(): Promise<void> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  const digest = await deviceIdDigest();
  const push = await readPushRegistration();
  const { error } = await supabase.rpc("register_device", {
    p_device_id_digest: digest,
    p_platform: Platform.OS,
    p_push_enabled: push.enabled,
    p_expo_push_token: push.token ?? undefined,
  });
  if (error) throw error;
}

/** F-16: deactivates this device's push token (RN-07). The caller decides what a failure means. */
const SIGN_OUT_DEVICE_TIMEOUT_MS = 3000;

export async function signOutDevice(): Promise<void> {
  // WHY the timeout: sign-out waits for this call; on a dead connection it must not hang the button.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SIGN_OUT_DEVICE_TIMEOUT_MS);
  try {
    const { error } = await supabase
      .rpc("sign_out_device", { p_device_id_digest: await deviceIdDigest() })
      .abortSignal(controller.signal);
    if (error) throw error;
  } finally {
    clearTimeout(timer);
  }
}

// WHY: module scope = once per app start (F-01), per account in case another one signs in later.
let registeredUserId: string | null = null;

/** Fire-and-forget: failures go to Sentry and never block navigation. */
export function useRegisterDeviceOnce(userId: string | null): void {
  useEffect(() => {
    if (!userId || registeredUserId === userId) return;
    registeredUserId = userId;
    registerDevice().catch(reportError);
  }, [userId]);
}
