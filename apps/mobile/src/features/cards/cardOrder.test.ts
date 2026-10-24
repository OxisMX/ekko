import { sortCards } from "./cardOrder";
import type { MyCard } from "./myCards";

const card = (id: string, over: Partial<MyCard>): MyCard => ({
  merchant_id: id,
  merchant_name: id,
  logo_path: null,
  stamp_image_path: null,
  merchant_available: true,
  stamps_count: 0,
  stamps_required: 8,
  cycle_expires_at: "2026-12-31T00:00:00Z",
  reward_available: false,
  wheel_status: "none",
  stamps: [],
  reward_title: "Premio",
  background_path: null,
  pending_extra_stamps: 0,
  ...over,
});

describe("sortCards", () => {
  it("orders reward available, then fewest stamps remaining, then unavailable merchants", () => {
    const sorted = sortCards([
      card("far", { stamps_count: 1 }),
      card("off", { merchant_available: false, stamps_count: 7 }),
      card("near", { stamps_count: 7 }),
      card("reward", { reward_available: true, stamps_count: 8 }),
    ]);
    expect(sorted.map((c) => c.merchant_id)).toEqual(["reward", "near", "far", "off"]);
  });

  it("keeps the original order for ties and does not mutate the input", () => {
    const input = [card("a", { stamps_count: 2 }), card("b", { stamps_count: 2 })];
    expect(sortCards(input).map((c) => c.merchant_id)).toEqual(["a", "b"]);
    expect(input.map((c) => c.merchant_id)).toEqual(["a", "b"]);
  });
});
