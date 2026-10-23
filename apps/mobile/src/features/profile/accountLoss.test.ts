import type { MyCard } from "../cards/myCards";
import type { MyCoupon } from "../coupons/myCoupons";
import { describeAccountLoss } from "./accountLoss";

const card = (stamps: number) => ({ stamps_count: stamps }) as MyCard;
const coupon = {} as MyCoupon;

describe("describeAccountLoss", () => {
  it("lists cards, stamps and coupons", () => {
    expect(describeAccountLoss([card(10), card(4), card(0)], [coupon, coupon])).toBe("Perderás 3 tarjetas, 14 sellos y 2 cupones.");
  });
  it("singularizes and skips zeros", () => {
    expect(describeAccountLoss([card(1)], [])).toBe("Perderás 1 tarjeta y 1 sello.");
    expect(describeAccountLoss([], [coupon])).toBe("Perderás 1 cupón.");
  });
  it("returns null when not cached or nothing to lose", () => {
    expect(describeAccountLoss(undefined, [coupon])).toBeNull();
    expect(describeAccountLoss([], [])).toBeNull();
  });
});
