import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

import { reportError } from "../../lib/sentry";

export type PushRegistration = { enabled: boolean; token: string | null };

// WHY: Android 8+ needs the channel to exist before a token is issued or a permission asked (13+).
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", { name: "Ekko", importance: AndroidImportance.DEFAULT });
}

/** A-16: asks the OS for the permission. Never throws; a failure counts as "not granted". */
export async function requestPushPermission(): Promise<boolean> {
  try {
    await ensureAndroidChannel();
    return (await Notifications.requestPermissionsAsync()).status === "granted";
  } catch (error) {
    reportError(error);
    return false;
  }
}

/** F-01 / F-07: current permission plus the Expo push token when one can be obtained. Never throws. */
export async function readPushRegistration(): Promise<PushRegistration> {
  try {
    await ensureAndroidChannel();
    if ((await Notifications.getPermissionsAsync()).status !== "granted") return { enabled: false, token: null };
    // NOTE: no EAS project yet (DEP-05) means no remote token; that is expected, not an error.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return { enabled: true, token: null };
    try {
      return { enabled: true, token: (await Notifications.getExpoPushTokenAsync({ projectId })).data };
    } catch (error) {
      // WHY: the permission is still granted; Expo Go on Android cannot issue remote tokens.
      reportError(error);
      return { enabled: true, token: null };
    }
  } catch (error) {
    reportError(error);
    return { enabled: false, token: null };
  }
}
