import type { Database } from "./database.types";

export type CouponSource = Database["public"]["Enums"]["coupon_source"];

// Brief §5.2: origin labels, shared so app and panel never drift apart.
export const couponSourceLabel: Record<CouponSource, string> = {
  card_reward: "Premio",
  wheel: "Bienvenida",
  push: "Promoción",
  birthday: "Cumpleaños",
};
