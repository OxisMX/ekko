import { Pressable, Text, View } from "react-native";

import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { formatShortDate } from "../format";
import { Gift } from "../icons";
import { MerchantAvatar } from "../merchant/MerchantAvatar";

const LOGO_SIZE = 52;
const DOT = 10;
const GIFT = 14;

/** A-50: anticipation copy when 1-2 stamps are left; null otherwise. */
export function stampsLeftHint(stampsCount: number, stampsRequired: number): string | null {
  const left = stampsRequired - stampsCount;
  if (left === 1) return "¡Te falta 1 sello!";
  if (left === 2) return "¡Te faltan 2 sellos!";
  return null;
}

export type CardRowProps = {
  merchantName: string;
  logoUri: string | null;
  stampsCount: number;
  stampsRequired: number;
  cycleExpiresAt: string;
  rewardAvailable: boolean;
  wheelAvailable: boolean;
  /** Makes the wheel badge open A-12 directly (F-07). */
  onWheelPress?: () => void;
  /** RN-71: false dims the row and removes the action. */
  available: boolean;
  onPress: () => void;
  testID?: string;
};

function Badge({ label, filled, onPress, testID }: { label: string; filled?: boolean; onPress?: () => void; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      // RT-04: the ~28 pt pill grows to a 44 pt target.
      hitSlop={onPress ? { top: 8, bottom: 8, left: 8, right: 8 } : undefined}
      testID={testID}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radii.pill,
        backgroundColor: filled ? colors.accent : colors.surface,
        borderWidth: filled ? 0 : 1.5,
        borderColor: colors.navy,
      }}
    >
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// A-12 row: compact progress as dots plus the "n de m" text, so it never depends on color alone.
export function CardRow({ merchantName, logoUri, stampsCount, stampsRequired, cycleExpiresAt, rewardAvailable, wheelAvailable, onWheelPress, available, onPress, testID }: CardRowProps) {
  const progress = `${stampsCount} de ${stampsRequired} sellos`;
  const hint = rewardAvailable ? null : stampsLeftHint(stampsCount, stampsRequired);
  const expiry = `Vence el ${formatShortDate(cycleExpiresAt)}`;
  const label = available
    ? [merchantName, hint, progress, expiry, rewardAvailable && "Recompensa disponible", wheelAvailable && "Gira tu ruleta"].filter(Boolean).join(". ")
    : `${merchantName}. No disponible por ahora`;

  return (
    <Pressable
      onPress={onPress}
      disabled={!available}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !available }}
      // WHY: the badge is nested in an accessible row, so VoiceOver/TalkBack can't focus it; expose it as a custom action.
      accessibilityActions={available && wheelAvailable && onWheelPress ? [{ name: "wheel", label: "Girar ruleta" }] : undefined}
      onAccessibilityAction={(event) => event.nativeEvent.actionName === "wheel" && onWheelPress?.()}
      testID={testID}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radii.card,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.surfaceMuted,
        backgroundColor: colors.surface,
        opacity: !available ? 0.55 : pressed ? 0.85 : 1,
      })}
    >
      <MerchantAvatar name={merchantName} uri={logoUri} size={LOGO_SIZE} grayscale={!available} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h2, { color: colors.textPrimary }]}>
          {merchantName}
        </Text>
        {available ? (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              {Array.from({ length: stampsRequired }, (_, i) =>
                // A-51: the last slot is the reward, same language as the card.
                i === stampsRequired - 1 ? (
                  <Gift key={i} size={GIFT} color={i < stampsCount ? colors.navy : colors.textSecondary} />
                ) : (
                  <View
                    key={i}
                    style={{ width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 1.5, borderColor: colors.navy, backgroundColor: i < stampsCount ? colors.navy : "transparent" }}
                  />
                )
              )}
            </View>
            {hint ? (
              <Text testID="card-row-hint" maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { fontFamily: fontFamily.semibold, color: colors.navy }]}>
                {hint}
              </Text>
            ) : null}
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
              {progress} · {expiry}
            </Text>
            {rewardAvailable || wheelAvailable ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs }}>
                {rewardAvailable ? <Badge label="Recompensa disponible" filled /> : null}
                {wheelAvailable ? <Badge label="Gira tu ruleta" onPress={onWheelPress} testID={testID && `${testID}-wheel`} /> : null}
              </View>
            ) : null}
          </>
        ) : (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
            No disponible por ahora
          </Text>
        )}
      </View>
    </Pressable>
  );
}
