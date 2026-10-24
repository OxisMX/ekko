import type { MyCard } from "./myCards";

// A-50: reward available first, then closest to the reward, then the rest (unavailable merchants last).
const rank = (card: MyCard) => (card.reward_available ? 0 : card.merchant_available ? 1 : 2);
const remaining = (card: MyCard) => card.stamps_required - card.stamps_count;

export function sortCards(cards: readonly MyCard[]): MyCard[] {
  return [...cards].sort((a, b) => rank(a) - rank(b) || remaining(a) - remaining(b));
}
