import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { supabase } from "../../lib/supabase";

// Backend §4.3 reveal_coupon_code: the 6-char code is only ever fetched on demand (F-11).
const revealedCouponSchema = z.object({
  code: z.string().length(6),
  expires_at: z.string(),
  title: z.string(),
  merchant_name: z.string(),
});

export type RevealedCoupon = z.infer<typeof revealedCouponSchema>;

async function revealCouponCode(couponId: string): Promise<RevealedCoupon> {
  const { data, error } = await supabase.rpc("reveal_coupon_code", {
    p_coupon_id: couponId,
  });
  if (error) throw error;
  return revealedCouponSchema.parse(data);
}

// WHY: no cache (gcTime 0) and no retry — a stale code must never be shown, and E-10/E-11/E-12 are final.
export function useRevealedCoupon(couponId: string) {
  return useQuery({
    queryKey: ["coupon-code", couponId],
    queryFn: () => revealCouponCode(couponId),
    enabled: couponId !== "",
    retry: false,
    gcTime: 0,
  });
}
