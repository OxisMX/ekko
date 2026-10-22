import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { z } from "zod";

import { reportError } from "../../lib/sentry";
import { supabase } from "../../lib/supabase";
import { myCouponsKey } from "../coupons/myCoupons";

const resultSchema = z.object({ created: z.number().int().min(0) });

/** F-12 (RN-43..45): the server decides if today is the birthday window and creates the gifts, idempotently. */
export async function ensureBirthdayCoupons(): Promise<number> {
  const { data, error } = await supabase.rpc("ensure_birthday_coupons");
  if (error) throw error;
  return resultSchema.parse(data).created;
}

// WHY: in-memory on purpose — the greeting shows once per app start; the coupons live in "Mis cupones".
type Greeting = { userId: string; count: number } | null;
let greeting: Greeting = null;
const listeners = new Set<() => void>();
function setGreeting(next: Greeting) {
  greeting = next;
  listeners.forEach((listener) => listener());
}

// WHY: module scope = once per app start and per account, like useRegisterDeviceOnce.
let checkedUserId: string | null = null;

/** Fire-and-forget: failures go to Sentry and never block anything. */
export function useEnsureBirthdayCouponsOnce(userId: string | null): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!userId || checkedUserId === userId) return;
    checkedUserId = userId;
    ensureBirthdayCoupons()
      .then((created) => {
        if (created === 0) return;
        void queryClient.invalidateQueries({ queryKey: myCouponsKey });
        void queryClient.invalidateQueries({ queryKey: ["merchant-detail"] });
        setGreeting({ userId, count: created });
      })
      .catch(reportError);
  }, [userId, queryClient]);
}

/** Gift count to celebrate for this user, or 0 when there is nothing to show (or it was dismissed). */
export function useBirthdayGreeting(userId: string | null): { count: number; dismiss: () => void } {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => greeting
  );
  return { count: current && current.userId === userId ? current.count : 0, dismiss: () => setGreeting(null) };
}

/** Test helper: the module state outlives a render. */
export function resetBirthdayState(): void {
  checkedUserId = null;
  greeting = null;
}
