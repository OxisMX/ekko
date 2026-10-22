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

// TRD §8.1 variants per Storage folder.
const WIDTHS = { logo: [128, 256], cover: [540, 1080], card: [540, 1080], product: [360, 720], offer: [540, 1080] } as const;
export type MerchantImageKind = keyof typeof WIDTHS;

/** Backend §7 / TRD §8.1: public WebP variant, the larger one on density ≥ 2 screens. */
export function merchantImageUrl(supabaseUrl: string, path: string, kind: MerchantImageKind, density: number): string {
  const [small, large] = WIDTHS[kind];
  const base = supabaseUrl.replace(/\/+$/, "");
  // NOTE: a JPEG fallback (browsers without WebP encoding, e.g. Safari) stores "<base>.jpg" (backend §7).
  const ext = path.endsWith(".jpg") ? "jpg" : "webp";
  const stem = ext === "jpg" ? path.slice(0, -4) : path;
  return `${base}/storage/v1/object/public/merchant-media/${stem}_${density >= 2 ? large : small}.${ext}`;
}
