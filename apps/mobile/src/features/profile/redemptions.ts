import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { supabase } from "../../lib/supabase";

// Backend §4 list_my_redemptions (newest first).
const redemptionsSchema = z.array(
  z.object({
    coupon_id: z.string(),
    merchant_name: z.string(),
    title: z.string(),
    source: z.enum(["card_reward", "wheel", "push", "birthday"]),
    redeemed_at: z.string(),
  }),
);

export type Redemption = z.infer<typeof redemptionsSchema>[number];

export const PAGE_SIZE = 20;
export const myRedemptionsKey = ["my-redemptions"] as const;

async function fetchPage(offset: number): Promise<Redemption[]> {
  const { data, error } = await supabase.rpc("list_my_redemptions", { p_offset: offset, p_limit: PAGE_SIZE });
  if (error) throw error;
  return redemptionsSchema.parse(data);
}

export function useMyRedemptions() {
  return useInfiniteQuery({
    queryKey: myRedemptionsKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 0,
    // WHY: a short page is the last one; no total count is needed.
    getNextPageParam: (lastPage, pages) => (lastPage.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE),
  });
}
