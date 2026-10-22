import type { Database } from "@ekko/shared";
import { Text, View } from "react-native";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { formatDate } from "../format";
import { Button } from "../ui/Button";

export type CouponSource = Database["public"]["Enums"]["coupon_source"];

// Brief §5.2: origin labels.
export const couponSourceLabel: Record<CouponSource, string> = {
  card_reward: "Premio",
  wheel: "Bienvenida",
  push: "Promoción",
  birthday: "Cumpleaños",
};

export type CouponCardProps = {
  title: string;
  merchantName?: string;
  source: CouponSource;
  expiresAt: string;
  terms?: string;
  /** Injected for tests; defaults to the current time. */
  now?: Date;
  actionLabel?: string;
  onAction?: () => void;
  /** Adds the "Mostrar código" action (US-13). */
  onShowCode?: () => void;
  testID?: string;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function relativeExpiry(expiresAt: string, now: Date): string {
  const left = new Date(expiresAt).getTime() - now.getTime();
  if (left <= 0) return "Vencido";
  if (left < HOUR) return "Vence en menos de 1 h";
  if (left < DAY) return `Vence en ${Math.floor(left / HOUR)} h`;
  const days = Math.floor(left / DAY);
  return `Vence en ${days} ${days === 1 ? "día" : "días"}`;
}

export function CouponCard({ title, merchantName, source, expiresAt, terms, now = new Date(), actionLabel, onAction, onShowCode, testID }: CouponCardProps) {
  const left = new Date(expiresAt).getTime() - now.getTime();
  const expiringSoon = left > 0 && left < DAY;
  const expiry = `${relativeExpiry(expiresAt, now)} · ${formatDate(expiresAt)}`;
  return (
    <View
      testID={testID}
      style={{
        borderRadius: radii.card,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceMuted,
        borderLeftWidth: expiringSoon ? 6 : 0,
        borderLeftColor: colors.warning,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <View accessible style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm }}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.label, { color: colors.textSecondary }]}>
            {couponSourceLabel[source]}
          </Text>
          {expiringSoon ? (
            // §9: never color alone — the warning tone always comes with the words "Por vencer".
            <View testID="coupon-expiring" style={{ backgroundColor: colors.warning, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2 }}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.label, { color: colors.textPrimary }]}>
                Por vencer
              </Text>
            </View>
          ) : null}
        </View>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h2, { color: colors.textPrimary }]}>
          {title}
        </Text>
        {merchantName ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textPrimary }]}>
            {merchantName}
          </Text>
        ) : null}
        <Text
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[textStyles.secondary, { color: colors.textPrimary, fontFamily: expiringSoon ? fontFamily.semibold : fontFamily.regular }]}
        >
          {expiry}
        </Text>
        {terms ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
            {terms}
          </Text>
        ) : null}
      </View>
      {onShowCode ? <Button title="Mostrar código" onPress={onShowCode} fullWidth style={{ marginTop: spacing.sm }} testID={testID ? `${testID}-show-code` : undefined} /> : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} fullWidth style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}
