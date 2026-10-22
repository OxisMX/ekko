import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { supabase } from "../../lib/supabase";

// Backend §4.3 list_my_coupons (active and unexpired, by expiry; RN-71: unavailable merchants stay).
const myCouponsSchema = z.array(
  z.object({
    id: z.string(),
    merchant_id: z.string(),
    merchant_name: z.string(),
    source: z.enum(["card_reward", "wheel", "push", "birthday"]),
    title: z.string(),
    description: z.string().nullable(),
    terms: z.string().nullable(),
    expires_at: z.string(),
    merchant_available: z.boolean(),
  }),
);

export type MyCoupon = z.infer<typeof myCouponsSchema>[number];

export const myCouponsKey = ["my-coupons"] as const;

async function fetchMyCoupons(): Promise<MyCoupon[]> {
  const { data, error } = await supabase.rpc("list_my_coupons", {});
  if (error) throw error;
  return myCouponsSchema.parse(data);
}

export function useMyCoupons() {
  return useQuery({ queryKey: myCouponsKey, queryFn: fetchMyCoupons });
}
