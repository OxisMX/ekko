import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import type { Href } from "expo-router";

import { reportError } from "../../lib/sentry";

const SEEN_KEY = "ekko.push-explainer-seen";

/** A-16 only precedes the OS prompt: the OS must not have been asked yet, and we must not have nagged before. */
export function shouldShowPushExplainer({ permission, seen }: { permission: string; seen: boolean }): boolean {
  return permission === "undetermined" && !seen;
}

/** Opens A-16 after the first card or stamp when `shouldShowPushExplainer` allows it. Never throws. */
export async function maybeShowPushExplainer(router: { push: (href: Href) => void }): Promise<void> {
  try {
    const [{ status }, seen] = await Promise.all([Notifications.getPermissionsAsync(), AsyncStorage.getItem(SEEN_KEY)]);
    if (!shouldShowPushExplainer({ permission: status, seen: seen !== null })) return;
    await AsyncStorage.setItem(SEEN_KEY, "1");
    router.push("/notifications-permission");
  } catch (error) {
    reportError(error);
  }
}
