import { ERRORS } from "@ekko/shared";
import { type InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

import { toAppError } from "../../lib/appError";
import { supabase } from "../../lib/supabase";
import type { MerchantsPage } from "../catalog/catalog";
import { type MerchantDetail, merchantDetailKey } from "../merchant/merchantDetail";

const MERCHANTS_KEY = ["merchants"] as const;

type ListData = InfiniteData<MerchantsPage>;

const withFavorite = (data: ListData | undefined, merchantId: string, isFavorite: boolean): ListData | undefined =>
  data && {
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: page.items.map((i) => (i.id === merchantId ? { ...i, is_favorite: isFavorite } : i)) })),
  };

/**
 * Flips the heart at once (detail + list caches), reverts on error and refetches the list on settle,
 * because the server orders favorites first. NOTE: the list is not re-sorted locally on purpose.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ merchantId }: { merchantId: string; isFavorite: boolean }) => {
      const { error } = await supabase.rpc("toggle_favorite", { p_merchant_id: merchantId });
      if (error) throw error;
    },
    onMutate: async ({ merchantId, isFavorite }) => {
      const next = !isFavorite;
      const detailKey = merchantDetailKey(merchantId);
      await queryClient.cancelQueries({ queryKey: detailKey });
      const detail = queryClient.getQueryData<MerchantDetail>(detailKey);
      const lists = queryClient.getQueriesData<ListData>({ queryKey: MERCHANTS_KEY });
      if (detail) queryClient.setQueryData<MerchantDetail>(detailKey, { ...detail, merchant: { ...detail.merchant, is_favorite: next } });
      for (const [key, data] of lists) queryClient.setQueryData(key, withFavorite(data, merchantId, next));
      return { detail, lists, detailKey };
    },
    onError: (error, _vars, context) => {
      if (context?.detail) queryClient.setQueryData(context.detailKey, context.detail);
      for (const [key, data] of context?.lists ?? []) queryClient.setQueryData(key, data);
      Alert.alert("No pudimos actualizar tus favoritos", ERRORS[toAppError(error).code].message);
    },
    // WHY detail too: the RPC toggles server state, so a double tap or stale cache must resync both views.
    onSettled: (_data, _error, { merchantId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: MERCHANTS_KEY }),
        queryClient.invalidateQueries({ queryKey: merchantDetailKey(merchantId) }),
      ]),
  });
}
