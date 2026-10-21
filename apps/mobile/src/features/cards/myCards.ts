import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { supabase } from "../../lib/supabase";

// Backend §4.2 list_my_cards (RN-71: unavailable merchants stay in the list).
const myCardsSchema = z.array(
  z.object({
    merchant_id: z.string(),
    merchant_name: z.string(),
    logo_path: z.string().nullable(),
    merchant_available: z.boolean(),
    stamps_count: z.number(),
    stamps_required: z.number(),
    cycle_expires_at: z.string(),
    reward_available: z.boolean(),
    wheel_status: z.string(),
  })
);

export type MyCard = z.infer<typeof myCardsSchema>[number];

export const myCardsKey = ["my-cards"] as const;

async function fetchMyCards(): Promise<MyCard[]> {
  const { data, error } = await supabase.rpc("list_my_cards");
  if (error) throw error;
  return myCardsSchema.parse(data);
}

export function useMyCards() {
  return useQuery({ queryKey: myCardsKey, queryFn: fetchMyCards });
}
