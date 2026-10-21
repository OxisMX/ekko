import { type MerchantCategory, merchantCategoryLabel, merchantImageUrl } from "@ekko/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { PixelRatio } from "react-native";

import type { MerchantCardData } from "../../components/catalog";
import { supabase, supabaseUrl } from "../../lib/supabase";

// Backend §4.2 list_merchants.
export type MerchantListItem = {
  id: string;
  name: string;
  category: MerchantCategory;
  description: string;
  logo_path: string;
  cover_path: string;
  maps_url: string;
};
export type MerchantsPage = { items: MerchantListItem[]; has_more: boolean };

export const PAGE_SIZE = 10; // RN-52

/**
 * RN-52 / F-06: one seed per app process. Module scope survives tab switches and refetches, and a
 * cold start draws a new order. NOTE: not security-relevant, so Math.random is enough.
 */
export const SESSION_SEED = Math.random().toString(36).slice(2, 14);

/** Offset of the next page: everything loaded so far, or undefined when the server has no more. */
export function nextPageParam(lastPage: MerchantsPage, allPages: MerchantsPage[]): number | undefined {
  if (!lastPage.has_more) return undefined;
  return allPages.reduce((count, page) => count + page.items.length, 0);
}

type Filters = { query: string; category: MerchantCategory | null };

async function fetchMerchantsPage({ query, category }: Filters, offset: number): Promise<MerchantsPage> {
  const { data, error } = await supabase.rpc("list_merchants", {
    p_seed: SESSION_SEED,
    p_query: query || undefined,
    p_category: category ?? undefined,
    p_offset: offset,
    p_limit: PAGE_SIZE,
  });
  if (error) throw error;
  return data as unknown as MerchantsPage;
}

export function useMerchants(filters: Filters) {
  return useInfiniteQuery({
    queryKey: ["merchants", SESSION_SEED, filters.query, filters.category],
    queryFn: ({ pageParam }) => fetchMerchantsPage(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
  });
}

export function toMerchantCard(item: MerchantListItem): MerchantCardData {
  const density = PixelRatio.get();
  return {
    id: item.id,
    name: item.name,
    categoryLabel: merchantCategoryLabel[item.category],
    description: item.description,
    logoUri: item.logo_path ? merchantImageUrl(supabaseUrl, item.logo_path, "logo", density) : null,
    coverUri: item.cover_path ? merchantImageUrl(supabaseUrl, item.cover_path, "cover", density) : null,
  };
}
