import { type CouponSource, couponSourceLabel } from "@ekko/shared";
import type { ComponentType } from "react";
import { Text, View } from "react-native";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { formatDate } from "../format";
import { Cake, Gift, Megaphone, Star, type IconProps } from "../icons";
import { Button } from "../ui/Button";

const SOURCE_ICON: Record<CouponSource, ComponentType<IconProps>> = { card_reward: Gift, wheel: Star, push: Megaphone, birthday: Cake };
const NOTCH = 16;

export type CouponCardProps = {
  title: string;
  merchantName?: string;
  /** RN-71: shown on its own line under the merchant, not glued to the name. */
  merchantUnavailable?: boolean;
  source: CouponSource;
  expiresAt: string;
  terms?: string;
  /** Injected for tests; defaults to the current time. */
  now?: Date;
  actionLabel?: string;
  onAction?: () => void;
  /** Adds the "Mostrar código" action (US-13). */
  onShowCode?: () => void;
  /** Marks the coupon as the one to use now: shows the `badge` pill and a primary "Mostrar código" button. */
  highlighted?: boolean;
  /** Pill text when `highlighted`. */
  badge?: string;
  testID?: string;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const EXPIRING_SOON_DAYS = 7;

export function relativeExpiry(expiresAt: string, now: Date): string {
  const left = new Date(expiresAt).getTime() - now.getTime();
  if (left <= 0) return "Vencido";
  if (left < HOUR) return "Vence en menos de 1 h";
  if (left < DAY) return `Vence en ${Math.floor(left / HOUR)} h`;
  const days = Math.floor(left / DAY);
  return `Vence en ${days} ${days === 1 ? "día" : "días"}`;
}

export function CouponCard({ title, merchantName, merchantUnavailable = false, source, expiresAt, terms, now = new Date(), actionLabel, onAction, onShowCode, highlighted = false, badge = "Nuevo", testID }: CouponCardProps) {
  const left = new Date(expiresAt).getTime() - now.getTime();
  const expiringSoon = left > 0 && left < EXPIRING_SOON_DAYS * DAY;
  const expiringToday = left > 0 && left < DAY;
  const SourceIcon = SOURCE_ICON[source];
  const expiry = `${relativeExpiry(expiresAt, now)} · ${formatDate(expiresAt)}`;
  return (
    <View
      testID={testID}
      style={{
        borderRadius: radii.card,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceMuted,
        borderLeftWidth: expiringToday ? 6 : 0,
        borderLeftColor: colors.warning,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <View accessible style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm }}>
          <SourceIcon size={16} color={colors.textSecondary} />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.label, { color: colors.textSecondary }]}>
            {couponSourceLabel[source]}
          </Text>
          {highlighted ? (
            // WHY: accent as a non-text pill background with dark text, never the only carrier (§4.3, §9).
            <View testID="coupon-badge" style={{ backgroundColor: colors.accent, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2 }}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.label, { color: colors.textPrimary }]}>
                {badge}
              </Text>
            </View>
          ) : null}
          {expiringSoon ? (
            // §9: never color alone — the warning tone always comes with the words "Por vencer".
            <View testID="coupon-expiring" style={{ backgroundColor: colors.warning, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2 }}>
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
        {merchantUnavailable ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
            No disponible por ahora
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
      {onShowCode || (actionLabel && onAction) ? <TicketDivider /> : null}
      {onShowCode ? <Button title="Mostrar código" onPress={onShowCode} variant={highlighted ? "primary" : "secondary"} fullWidth testID={testID ? `${testID}-show-code` : undefined} /> : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} fullWidth testID={testID && `${testID}-action`} /> : null}
    </View>
  );
}

// A-64: perforation between the benefit and the CTA; the notches use the page color so they read as bites out of the ticket.
function TicketDivider() {
  const notch = { position: "absolute", top: 0, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: colors.surface } as const;
  return (
    <View testID="coupon-ticket-divider" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: NOTCH, justifyContent: "center", marginHorizontal: -spacing.lg }}>
      <View style={[notch, { left: -NOTCH / 2 }]} />
      <View style={[notch, { right: -NOTCH / 2 }]} />
      <View style={{ marginHorizontal: NOTCH, borderTopWidth: 1.5, borderStyle: "dashed", borderColor: colors.textSecondary }} />
    </View>
  );
}
