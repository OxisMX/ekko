import type { ErrorCode } from "@ekko/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import type { VisitResultKind } from "../../components/visit";
import { supabase } from "../../lib/supabase";
import { deviceIdDigest } from "../auth/deviceRegistration";
import { myCardsKey } from "../cards/myCards";
import { merchantDetailKey } from "../merchant/merchantDetail";

// Backend claim_visit. NOTE: parsed with zod because the RPC is not in database.types.ts yet.
const claimSchema = z.object({
  merchant_id: z.string(),
  merchant_name: z.string(),
  stamps_added: z.number(),
  stamps_count: z.number(),
  stamps_required: z.number(),
  cycle_completed: z.boolean(),
  reward_coupon_id: z.string().nullable(),
  relation_created: z.boolean(),
  // The wheel (F-07) is Sprint 8; its shape is not consumed yet.
  wheel_status: z.unknown(),
});

export type ClaimVisitResult = z.infer<typeof claimSchema>;

type UntypedRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

async function claimVisit(token: string): Promise<ClaimVisitResult> {
  const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;
  const { data, error } = await rpc("claim_visit", { p_token: token, p_device_id_digest: await deviceIdDigest() });
  if (error) throw error;
  return claimSchema.parse(data);
}

/** F-08 / US-11. RR-2: retrying the same token is safe, the server returns the original result. */
export function useClaimVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: claimVisit,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: merchantDetailKey(result.merchant_id) });
      void queryClient.invalidateQueries({ queryKey: myCardsKey });
      // Explorar may show the card/progress for this merchant.
      void queryClient.invalidateQueries({ queryKey: ["merchants"] });
    },
  });
}

/** AppFlow §7: claim_visit error → A-15 variant. Unknown failures ask for a new code (rescan). */
export function visitErrorKind(code: ErrorCode): VisitResultKind {
  switch (code) {
    case "E-01":
      return "offline";
    case "E-04":
      return "already_today";
    case "E-05":
      return "unavailable";
    case "E-08":
      return "not_ekko";
    default:
      return "expired_or_used";
  }
}
