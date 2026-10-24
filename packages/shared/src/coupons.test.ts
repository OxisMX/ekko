import { describe, expect, it } from "vitest";
import { couponSourceLabel } from "./coupons";

describe("couponSourceLabel", () => {
  it("labels every coupon source", () => {
    expect(couponSourceLabel.card_reward).toBe("Premio");
    expect(Object.keys(couponSourceLabel)).toHaveLength(4);
  });
});
