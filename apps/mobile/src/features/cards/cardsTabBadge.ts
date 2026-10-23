import { useMyCoupons } from "../coupons/myCoupons";
import { useMyCards } from "./myCards";

/** A-53: dot on "Mis Tarjetas" when a reward is ready or an active coupon is waiting. */
export function useCardsTabBadge(): boolean {
  const cards = useMyCards().data;
  const coupons = useMyCoupons().data;
  return Boolean(cards?.some((card) => card.reward_available) || coupons?.length);
}
