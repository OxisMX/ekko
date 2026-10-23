import type { MyCard } from "../cards/myCards";
import type { MyCoupon } from "../coupons/myCoupons";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A-81: "Perderás 3 tarjetas, 14 sellos y 2 cupones." from cached data; null when nothing is cached or nothing to lose. */
export function describeAccountLoss(cards: readonly MyCard[] | undefined, coupons: readonly MyCoupon[] | undefined): string | null {
  if (!cards || !coupons) return null;
  const parts = [
    cards.length > 0 && plural(cards.length, "tarjeta", "tarjetas"),
    (() => {
      const stamps = cards.reduce((sum, card) => sum + card.stamps_count, 0);
      return stamps > 0 && plural(stamps, "sello", "sellos");
    })(),
    coupons.length > 0 && plural(coupons.length, "cupón", "cupones"),
  ].filter((part): part is string => part !== false);
  if (parts.length === 0) return null;
  const last = parts.pop()!;
  return `Perderás ${parts.length > 0 ? `${parts.join(", ")} y ` : ""}${last}.`;
}
