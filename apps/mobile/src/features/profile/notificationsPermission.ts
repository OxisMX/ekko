import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking } from "react-native";

import { reportError } from "../../lib/sentry";
import { registerDevice } from "../auth/deviceRegistration";
import { requestPushPermission } from "../notifications/pushToken";

export type PushPermissionState = "loading" | "granted" | "askable" | "blocked";

async function readState(): Promise<PushPermissionState> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "granted";
  return canAskAgain ? "askable" : "blocked";
}

/** A-20: current OS permission; re-read when the app returns from the system settings. */
export function usePushPermission() {
  const [state, setState] = useState<PushPermissionState>("loading");

  const refresh = useCallback(() => {
    readState().then(setState, (error: unknown) => {
      reportError(error);
      setState("askable");
    });
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener("change", (next) => next === "active" && refresh());
    return () => subscription.remove();
  }, [refresh]);

  const act = useCallback(async () => {
    if (state === "blocked") return Linking.openSettings();
    if (await requestPushPermission()) registerDevice().catch(reportError);
    refresh();
  }, [state, refresh]);

  return { state, act };
}
