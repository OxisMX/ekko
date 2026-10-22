import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { z } from "zod";

import { supabase } from "../../lib/supabase";
import { deviceIdDigest } from "../auth/deviceRegistration";
import { myCardsKey } from "../cards/myCards";
import { myCouponsKey } from "../coupons/myCoupons";
import { merchantDetailKey } from "../merchant/merchantDetail";

// Backend §4.2 get_wheel / spin_wheel (F-07, US-15).
const wheelSchema = z.object({
  segments: z.array(z.object({ index: z.number(), label: z.string() })),
  status: z.string().optional(),
});

const spinSchema = z.object({
  segment_index: z.number(),
  prize_type: z.enum(["coupon", "extra_stamp"]),
  label: z.string(),
  coupon_id: z.string().nullable(),
});

export type WheelData = z.infer<typeof wheelSchema>;
export type SpinResult = z.infer<typeof spinSchema>;

const wheelKey = (merchantId: string) => ["wheel", merchantId] as const;

export function useWheel(merchantId: string) {
  return useQuery({
    queryKey: wheelKey(merchantId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_wheel", { p_merchant_id: merchantId });
      if (error) throw error;
      return wheelSchema.parse(data);
    },
    enabled: merchantId !== "",
  });
}

export function useSpinWheel(merchantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("spin_wheel", { p_merchant_id: merchantId, p_device_id_digest: await deviceIdDigest() });
      if (error) throw error;
      return spinSchema.parse(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myCardsKey });
      void queryClient.invalidateQueries({ queryKey: myCouponsKey });
      void queryClient.invalidateQueries({ queryKey: merchantDetailKey(merchantId) });
    },
  });
}

/** needs_verification also opens A-12: it explains E-06 instead of hiding the wheel. */
export function wheelIsOffered(status: string | null | undefined): boolean {
  return status === "available" || status === "needs_verification";
}

/** `explainer` asks A-12 to open A-16 once it closes (see wheel/[merchantId].tsx). */
export function wheelHref(merchantId: string, explainer = false): Href {
  return { pathname: "/wheel/[merchantId]", params: explainer ? { merchantId, explainer: "1" } : { merchantId } };
}
