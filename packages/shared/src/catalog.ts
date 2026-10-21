import type { Database } from "./database.types";

export type MerchantCategory = Database["public"]["Enums"]["merchant_category"];

// RN-51, in PRD order (also the chip order in A-07).
export const MERCHANT_CATEGORIES = [
  "restaurantes",
  "cafeterias_postres",
  "bares_snacks",
  "barberias",
  "belleza",
  "spas",
  "deporte_salud",
  "servicios",
  "otros",
] as const satisfies readonly MerchantCategory[];

export const merchantCategoryLabel: Record<MerchantCategory, string> = {
  restaurantes: "Restaurantes",
  cafeterias_postres: "Cafeterías y Postres",
  bares_snacks: "Bares y Snacks",
  barberias: "Barberías",
  belleza: "Belleza",
  spas: "Spas",
  deporte_salud: "Deporte/Salud",
  servicios: "Servicios",
  otros: "Otros",
};

const WIDTHS = { logo: [128, 256], cover: [540, 1080] } as const;

/** Backend §7 / TRD §8.1: public WebP variant, the larger one on density ≥ 2 screens. */
export function merchantImageUrl(supabaseUrl: string, path: string, kind: "logo" | "cover", density: number): string {
  const [small, large] = WIDTHS[kind];
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/merchant-media/${path}_${density >= 2 ? large : small}.webp`;
}
