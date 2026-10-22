import type { Href } from "expo-router";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { addBreadcrumb } from "../../lib/sentry";

// F-13: data sent by the send-push Edge Function.
const payloadSchema = z.object({
  merchant_id: z.string().min(1),
  coupon_id: z.string().min(1).nullish(),
});

export type PushTarget = { merchantId: string; couponId: string | null };

/** External input: anything malformed is dropped, leaving only a PII-free breadcrumb. */
export function parsePushData(data: unknown): PushTarget | null {
  const parsed = payloadSchema.safeParse(data);
  if (!parsed.success) {
    addBreadcrumb("push", "ignored push with malformed payload");
    return null;
  }
  return { merchantId: parsed.data.merchant_id, couponId: parsed.data.coupon_id ?? null };
}

/** A-10/A-11: the merchant's Promociones tab. `from: "push"` lets the screen fall back to A-18 on E-05. */
export function pushHref({ merchantId, couponId }: PushTarget): Href {
  return {
    pathname: "/merchant/[id]",
    params: { id: merchantId, tab: "promos", from: "push", ...(couponId && { coupon: couponId }) },
  };
}

/** A-18: Mis cupones. */
export const couponsHref: Href = { pathname: "/cards", params: { tab: "coupons" } };

// Same pattern as pendingVisit.ts: memory only, waits until the F-01 gate lets the user in.
let pendingPush: PushTarget | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function setPendingPush(target: PushTarget): void {
  pendingPush = target;
  notify();
}

export function takePendingPush(): PushTarget | null {
  const target = pendingPush;
  pendingPush = null;
  if (target) notify();
  return target;
}

export const usePendingPush = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => pendingPush
  );

// WHY: the tap reaches us twice on cold start (listener and getLastNotificationResponseAsync).
let lastHandledId: string | null = null;

/** True the first time a notification request id is seen. */
export function markHandled(requestId: string): boolean {
  if (lastHandledId === requestId) return false;
  lastHandledId = requestId;
  return true;
}

export function resetPushNavigation(): void {
  pendingPush = null;
  lastHandledId = null;
  notify();
}
