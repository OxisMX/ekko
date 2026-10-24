import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { supabase } from "../../lib/supabase";

// Backend get_coupon_status (A-65): cheap, unrate-limited, E-12 if the coupon isn't the caller's.
const couponStatusSchema = z.object({ status: z.string(), redeemed_at: z.string().nullable() });

export const COUPON_STATUS_POLL_MS = 8000;

async function fetchCouponStatus(couponId: string) {
  const { data, error } = await supabase.rpc("get_coupon_status", { p_coupon_id: couponId });
  if (error) throw error;
  return couponStatusSchema.parse(data);
}

/**
 * Polls while the code is on screen so the cashier's validation closes the loop.
 * WHY: a separate cheap RPC; refetching reveal_coupon_code would fail (E-10) once redeemed and rotates nothing useful.
 * Stops by itself at 'redeemed'. Errors are ignored: the code stays usable and the next tick retries.
 */
export function useCouponRedeemed(couponId: string, active: boolean): boolean {
  const query = useQuery({
    queryKey: ["coupon-status", couponId],
    queryFn: () => fetchCouponStatus(couponId),
    enabled: active && couponId !== "",
    refetchInterval: (q) => (q.state.data?.status === "redeemed" ? false : COUPON_STATUS_POLL_MS),
    retry: false,
    gcTime: 0,
  });
  return query.data?.status === "redeemed";
}
