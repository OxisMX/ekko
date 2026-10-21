import { type Href, usePathname, useRouter, useSegments } from "expo-router";
import { useEffect, useSyncExternalStore } from "react";

import type { GateRoute } from "../auth/gate";

// F-09 / RR-3: a /v/:token received while signed out waits here (memory only) until login finishes.
export const PENDING_VISIT_TTL_MS = 60_000;

type PendingVisit = { token: string; receivedAt: number };
let pendingVisit: PendingVisit | null = null;
const listeners = new Set<() => void>();

export function setPendingVisit(token: string, receivedAt = Date.now()): void {
  pendingVisit = { token, receivedAt };
  listeners.forEach((listener) => listener());
}

/** Returns and clears the pending visit; `fresh` is false once the 60 s window (F-09 L) has passed. */
export function takePendingVisit(now = Date.now()): { token: string; fresh: boolean } | null {
  const visit = pendingVisit;
  pendingVisit = null;
  if (visit) listeners.forEach((listener) => listener());
  return visit && { token: visit.token, fresh: now - visit.receivedAt < PENDING_VISIT_TTL_MS };
}

export const getPendingVisit = () => pendingVisit;

export function subscribePendingVisit(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * F-09: once the gate is decided, a pending visit either waits behind login/profile (the link screen
 * hands over to the gate) or, in tabs, is claimed — or shown as expired after 60 s (F-09 M).
 */
export function usePendingVisitRedirect(route: GateRoute): void {
  const router = useRouter();
  const pathname = usePathname();
  const pending = useSyncExternalStore(subscribePendingVisit, getPendingVisit);
  // WHY: right after login the gate still has to redirect away from these screens; navigating now would be undone.
  const [group] = useSegments();
  const awaitingGateRedirect = group === "(auth)" || group === "complete-profile";
  useEffect(() => {
    if (!pending || route === "loading") return;
    const onLink = pathname.startsWith("/v/");
    if (route !== "tabs") {
      if (onLink) router.replace("/");
      return;
    }
    if (awaitingGateRedirect) return;
    const visit = takePendingVisit();
    if (!visit) return;
    const href: Href = { pathname: "/visit-result", params: visit.fresh ? { token: visit.token } : { expired: "1" } };
    if (onLink) router.replace(href);
    else router.push(href);
  }, [pending, route, pathname, router, awaitingGateRedirect]);
}
