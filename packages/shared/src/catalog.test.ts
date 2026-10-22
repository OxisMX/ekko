import { describe, expect, it } from "vitest";
import { MERCHANT_CATEGORIES, merchantCategoryLabel, merchantImageUrl } from "./catalog";

describe("merchant categories", () => {
  it("lists the 9 RN-51 categories in PRD order with their Spanish labels", () => {
    expect(MERCHANT_CATEGORIES.map((c) => merchantCategoryLabel[c])).toEqual([
      "Restaurantes",
      "Cafeterías y Postres",
      "Bares y Snacks",
      "Barberías",
      "Belleza",
      "Spas",
      "Deporte/Salud",
      "Servicios",
      "Otros",
    ]);
  });
});

describe("merchantImageUrl", () => {
  const url = "https://x.supabase.co";
  const path = "merchants/m1/logo/abc";

  it.each([
    ["logo", 1, 128],
    ["logo", 1.5, 128],
    ["logo", 2, 256],
    ["logo", 3, 256],
    ["cover", 1, 540],
    ["cover", 2.75, 1080],
    ["card", 1, 540],
    ["card", 2, 1080],
    ["product", 1, 360],
    ["product", 2, 720],
    ["offer", 1, 540],
    ["offer", 3, 1080],
  ] as const)("%s at density %s -> %i px", (kind, density, width) => {
    expect(merchantImageUrl(url, path, kind, density)).toBe(
      `${url}/storage/v1/object/public/merchant-media/${path}_${width}.webp`,
    );
  });

  it("keeps the .jpg extension of a JPEG fallback path", () => {
    expect(merchantImageUrl(url, "merchants/m1/card/abc.jpg", "card", 2)).toBe(
      `${url}/storage/v1/object/public/merchant-media/merchants/m1/card/abc_1080.jpg`,
    );
  });

  it("tolerates a trailing slash on the base URL", () => {
    expect(merchantImageUrl(`${url}/`, path, "logo", 1)).toBe(
      `${url}/storage/v1/object/public/merchant-media/${path}_128.webp`,
    );
  });
});
