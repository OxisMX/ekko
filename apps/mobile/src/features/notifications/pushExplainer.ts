import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import type { Href } from "expo-router";

import { reportError } from "../../lib/sentry";

const SEEN_KEY = "ekko.push-explainer-seen";

/**
 * A-16 only precedes the OS prompt: the OS must still be able to ask, and we must not have nagged before.
 * WHY canAskAgain: Android reports a never-asked permission as "denied", not "undetermined".
 */
export function shouldShowPushExplainer({ permission, canAskAgain, seen }: { permission: string; canAskAgain: boolean; seen: boolean }): boolean {
  return permission !== "granted" && canAskAgain && !seen;
}

/** Opens A-16 after the first card or stamp when `shouldShowPushExplainer` allows it. Never throws. */
export async function maybeShowPushExplainer(router: { push: (href: Href) => void }): Promise<void> {
  try {
    const [{ status, canAskAgain }, seen] = await Promise.all([Notifications.getPermissionsAsync(), AsyncStorage.getItem(SEEN_KEY)]);
    if (!shouldShowPushExplainer({ permission: status, canAskAgain, seen: seen !== null })) return;
    await AsyncStorage.setItem(SEEN_KEY, "1");
    router.push("/notifications-permission");
  } catch (error) {
    reportError(error);
  }
}
