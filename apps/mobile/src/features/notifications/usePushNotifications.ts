import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { queryClient } from "../../lib/queryClient";
import type { GateRoute } from "../auth/gate";
import { merchantDetailKey } from "../merchant/merchantDetail";
import { myCouponsKey } from "../coupons/myCoupons";
import { markHandled, parsePushData, pushHref, type PushTarget, setPendingPush, takePendingPush, usePendingPush } from "./pushNavigation";

// WHY: in foreground the in-app toast replaces the OS banner (F-13 C).
export const foregroundHandler: Notifications.NotificationHandler = {
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
};

export type PushToastData = { title: string; body: string; target: PushTarget };

// A coupon may have just been created for this merchant.
function refreshCoupons({ merchantId }: PushTarget): void {
  void queryClient.invalidateQueries({ queryKey: myCouponsKey });
  void queryClient.invalidateQueries({ queryKey: merchantDetailKey(merchantId) });
}

/** Runs a notifications call that Expo Go (Android) may reject; a failure must never crash the app. */
function safely(action: () => void): void {
  try {
    action();
  } catch (error) {
    if (__DEV__) console.warn(error);
  }
}

/**
 * F-13: foreground toast, tap handling (background and cold start) and navigation once the gate
 * lets the user in. Without a session the target waits like a pending visit (F-09).
 */
export function usePushNotifications(route: GateRoute): { toast: PushToastData | null; dismissToast: () => void } {
  const router = useRouter();
  const pending = usePendingPush();
  const [toast, setToast] = useState<PushToastData | null>(null);

  useEffect(() => {
    safely(() => Notifications.setNotificationHandler(foregroundHandler));
    const handleTap = (response: Notifications.NotificationResponse | null) => {
      if (!response || !markHandled(response.notification.request.identifier)) return;
      const target = parsePushData(response.notification.request.content.data);
      if (!target) return;
      refreshCoupons(target);
      setPendingPush(target);
    };
    const subscriptions: { remove: () => void }[] = [];
    safely(() => {
      subscriptions.push(
        Notifications.addNotificationReceivedListener(({ request }) => {
          const target = parsePushData(request.content.data);
          if (!target) return;
          refreshCoupons(target);
          setToast({ title: request.content.title ?? "", body: request.content.body ?? "", target });
        }),
        Notifications.addNotificationResponseReceivedListener(handleTap)
      );
      Notifications.getLastNotificationResponseAsync().then(handleTap, (error: unknown) => __DEV__ && console.warn(error));
    });
    return () => subscriptions.forEach((subscription) => safely(() => subscription.remove()));
  }, []);

  useEffect(() => {
    if (!pending || route !== "tabs") return;
    const target = takePendingPush();
    if (target) router.push(pushHref(target));
  }, [pending, route, router]);

  // The toast only exists for a signed-in user; its action reuses the same pending-target path.
  const dismissToast = useCallback(() => setToast(null), []);
  return { toast: route === "tabs" ? toast : null, dismissToast };
}
