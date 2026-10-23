import { MERCHANT_CATEGORIES, type MerchantImageKind, merchantImageUrl } from "@ekko/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PixelRatio } from "react-native";
import { z } from "zod";

import { supabase, supabaseUrl } from "../../lib/supabase";
import { myCardsKey } from "../cards/myCards";

// Backend §4.2 get_merchant_detail. NOTE: parsed with zod because the RPC is not in database.types.ts
// yet; once `pnpm db:types` includes it, the cast in `callRpc` can go.
const wheelStatus = z.object({ status: z.string() });

const detailSchema = z.object({
  merchant: z.object({
    id: z.string(),
    name: z.string(),
    category: z.enum(MERCHANT_CATEGORIES),
    description: z.string().nullable(),
    address: z.string().nullable(),
    logo_path: z.string().nullable(),
    cover_path: z.string().nullable(),
    maps_url: z.string().nullable(),
    reviews_url: z.string().nullable(),
    available: z.boolean(),
    is_favorite: z.boolean(),
  }),
  card: z.object({
    has_relation: z.boolean(),
    stamps_required: z.number(),
    stamps: z.array(z.object({ granted_at: z.string(), is_bonus: z.boolean() })),
    cycle_expires_at: z.string().nullable(),
    // Optional: lets the no-relation preview show a real expiry when the backend sends it.
    cycle_months: z.number().optional(),
    reward_title: z.string(),
    reward_description: z.string().nullable(),
    terms: z.string().nullable(),
    background_path: z.string().nullable(),
    // null = the stamps show the merchant logo.
    stamp_image_path: z.string().nullable(),
    pending_extra_stamps: z.number(),
    reward_coupon_id: z.string().nullable(),
    stamped_today: z.boolean(),
  }),
  wheel: wheelStatus,
  menu: z.object({
    categories: z.array(z.object({ id: z.string(), name: z.string(), position: z.number() })),
    products: z.array(
      z.object({
        id: z.string(),
        category_id: z.string().nullable(),
        name: z.string(),
        description: z.string().nullable(),
        price: z.coerce.number(),
        image_path: z.string().nullable(),
        is_featured: z.boolean(),
        is_sold_out: z.boolean(),
      })
    ),
  }),
  offers: z.array(z.object({ id: z.string(), title: z.string(), description: z.string().nullable(), weekday: z.number(), image_path: z.string().nullable() })),
  coupons: z.array(
    z.object({
      id: z.string(),
      source: z.enum(["card_reward", "wheel", "push", "birthday"]),
      title: z.string(),
      description: z.string().nullable(),
      terms: z.string().nullable(),
      expires_at: z.string(),
    })
  ),
});

export type MerchantDetail = z.infer<typeof detailSchema>;
export type MenuProduct = MerchantDetail["menu"]["products"][number];

const addCardSchema = z.object({ created: z.boolean(), wheel: wheelStatus });

type UntypedRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

/** The single untyped call site for RPCs missing from database.types.ts. */
async function callRpc<T>(fn: "get_merchant_detail" | "add_card", merchantId: string, schema: z.ZodType<T>): Promise<T> {
  const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;
  const { data, error } = await rpc(fn, { p_merchant_id: merchantId });
  if (error) throw error;
  return schema.parse(data);
}

export const merchantDetailKey = (merchantId: string) => ["merchant-detail", merchantId] as const;

// RR-4: refetches when the app returns to the foreground through the global focusManager.
export function useMerchantDetail(merchantId: string) {
  return useQuery({
    queryKey: merchantDetailKey(merchantId),
    queryFn: () => callRpc("get_merchant_detail", merchantId, detailSchema),
    enabled: merchantId !== "",
  });
}

// US-08 / F-07: add the card. The wheel offered in the result is Sprint 8.
export function useAddCard(merchantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => callRpc("add_card", merchantId, addCardSchema),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myCardsKey });
      return queryClient.invalidateQueries({ queryKey: merchantDetailKey(merchantId) });
    },
  });
}

export function imageUri(path: string | null, kind: MerchantImageKind): string | null {
  return path ? merchantImageUrl(supabaseUrl, path, kind, PixelRatio.get()) : null;
}

/** Preview expiry when there is no cycle yet: today + the program's months (DB default 6). */
export function previewExpiry(cycleMonths = 6, now = new Date()): string {
  const date = new Date(now);
  date.setMonth(date.getMonth() + cycleMonths);
  return date.toISOString();
}

/** Brief §4.2: "Más pedidos" is a virtual first chip, shown only when a product is featured. */
export const FEATURED_CHIP = "featured";

export function menuChips(menu: MerchantDetail["menu"]): { key: string; label: string }[] {
  const categories = [...menu.categories]
    .sort((a, b) => a.position - b.position)
    .filter((category) => menu.products.some((p) => p.category_id === category.id))
    .map((category) => ({ key: category.id, label: category.name }));
  return menu.products.some((p) => p.is_featured) ? [{ key: FEATURED_CHIP, label: "Más pedidos" }, ...categories] : categories;
}

export function productsFor(menu: MerchantDetail["menu"], chip: string | null): MenuProduct[] {
  if (chip === null) return menu.products;
  if (chip === FEATURED_CHIP) return menu.products.filter((p) => p.is_featured);
  return menu.products.filter((p) => p.category_id === chip);
}
