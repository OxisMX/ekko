import { Pressable, Text, View } from "react-native";

import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { formatShortDate } from "../format";
import { MerchantAvatar } from "../merchant/MerchantAvatar";

const LOGO_SIZE = 52;
const DOT = 10;

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

function Badge({ label, filled, onPress }: { label: string; filled?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      hitSlop={onPress ? 8 : undefined}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radii.field,
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
  const expiry = `Vence el ${formatShortDate(cycleExpiresAt)}`;
  const label = available
    ? [merchantName, progress, expiry, rewardAvailable && "Recompensa disponible", wheelAvailable && "Gira tu ruleta"].filter(Boolean).join(". ")
    : `${merchantName}. No disponible por ahora`;

  return (
    <Pressable
      onPress={onPress}
      disabled={!available}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !available }}
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
              {Array.from({ length: stampsRequired }, (_, i) => (
                <View
                  key={i}
                  style={{ width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 1.5, borderColor: colors.navy, backgroundColor: i < stampsCount ? colors.navy : "transparent" }}
                />
              ))}
            </View>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
              {progress} · {expiry}
            </Text>
            {rewardAvailable || wheelAvailable ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs }}>
                {rewardAvailable ? <Badge label="Recompensa disponible" filled /> : null}
                {wheelAvailable ? <Badge label="Gira tu ruleta" onPress={onWheelPress} /> : null}
              </View>
            ) : null}
          </>
        ) : (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
            No disponible
          </Text>
        )}
      </View>
    </Pressable>
  );
}
