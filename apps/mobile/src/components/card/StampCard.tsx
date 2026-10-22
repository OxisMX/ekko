import { stampGridRows } from "@ekko/shared";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { formatDate } from "../format";
import { MerchantAvatar } from "../merchant/MerchantAvatar";
import { useReduceMotion } from "../useReduceMotion";
import { Button } from "../ui/Button";

export type StampCardStamp = { grantedAt: string; isBonus: boolean };

export type StampCardProps = {
  /** 4..10 (RN-23). */
  stampsRequired: number;
  /** Stamps of the current cycle, oldest first. */
  stamps: StampCardStamp[];
  logoUri: string | null;
  merchantName: string;
  backgroundUri: string | null;
  rewardTitle: string;
  cycleExpiresAt: string;
  pendingExtraStamps: number;
  rewardAvailable: boolean;
  /** Merchant availability (RN-71). */
  available: boolean;
  /** Plays the entrance animation and accent ring on the newest stamp. */
  highlightLast?: boolean;
  onViewReward?: () => void;
  testID?: string;
};

// Brief §6.2: card backgrounds (1.586:1, cropped with `cover`) always sit under a translucent veil.
const VEIL = "rgba(255, 255, 255, 0.78)";
const STAMP_MAX = 64;
const NEW_RING = 3;
// expo-animation: strong ease-out for entrances.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

const dateText = [textStyles.label, { letterSpacing: 0, textTransform: "none" as const, color: colors.textPrimary, textAlign: "center" as const }];

export function GiftIcon({ size, testID }: { size: number; testID?: string }) {
  const stroke = { stroke: colors.navy, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg testID={testID} width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Rect x={4} y={10} width={16} height={10} rx={1.5} {...stroke} />
      <Rect x={3} y={7} width={18} height={3} rx={1} {...stroke} />
      <Path d="M12 7v13M12 7c-1.5-3-5-3.5-5-1.2C7 7 9.5 7 12 7zM12 7c1.5-3 5-3.5 5-1.2C17 7 14.5 7 12 7z" {...stroke} />
    </Svg>
  );
}

export function StarIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z"
        fill={colors.navy}
        stroke={colors.navy}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// PX-6: short entrance (scale 0.9 → 1 + fade, 250 ms); §9: skipped entirely with reduce motion.
function NewStampEntrance({ children }: { children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce === null) return;
    if (reduce) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, { toValue: 1, duration: 250, easing: EASE_OUT, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [reduce, progress]);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  return <Animated.View style={{ width: "100%", alignItems: "center", opacity: progress, transform: [{ scale }] }}>{children}</Animated.View>;
}

type SlotProps = {
  stamp: StampCardStamp | undefined;
  isLast: boolean;
  isNew: boolean;
  merchantName: string;
  logoUri: string | null;
  grayscale: boolean;
};

function StampSlot({ stamp, isLast, isNew, merchantName, logoUri, grayscale }: SlotProps) {
  const circle = { width: "100%" as const, maxWidth: STAMP_MAX, aspectRatio: 1, borderRadius: STAMP_MAX } as const;
  let face: React.ReactNode;
  if (!stamp) {
    face = (
      <View testID="stamp-empty" style={[circle, { backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" }]}>
        {isLast ? <GiftIcon size={24} testID="stamp-gift" /> : null}
      </View>
    );
  } else {
    const ring = isNew ? NEW_RING : 0;
    face = (
      <View testID={isNew ? "stamp-new" : "stamp-granted"} style={[circle, { borderWidth: ring, borderColor: colors.accent, alignItems: "center", justifyContent: "center" }]}>
        <MerchantAvatar name={merchantName} uri={logoUri} size={STAMP_MAX} grayscale={grayscale} style={{ width: "100%", height: "100%" }} />
        {/* RN-36: a bonus stamp carries a star (not only a colour) so it reads apart from a visit stamp. */}
        {stamp.isBonus ? (
          <View testID="stamp-bonus" style={styles.bonusStar}>
            <StarIcon size={14} />
          </View>
        ) : null}
      </View>
    );
    if (isNew) face = <NewStampEntrance>{face}</NewStampEntrance>;
  }
  return (
    <View style={{ flex: 1, alignItems: "center", gap: spacing.xs }}>
      {face}
      {/* NOTE: empty slots keep the date line so every row has the same height. */}
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={MAX_FONT_SCALE} style={dateText}>
        {stamp ? formatDate(stamp.grantedAt, "2-digit") : " "}
      </Text>
    </View>
  );
}

export function StampCard({
  stampsRequired,
  stamps,
  logoUri,
  merchantName,
  backgroundUri,
  rewardTitle,
  cycleExpiresAt,
  pendingExtraStamps,
  rewardAvailable,
  available,
  highlightLast = false,
  onViewReward,
  testID,
}: StampCardProps) {
  const [failedBgUri, setFailedBgUri] = useState<string | null>(null);
  const rows = stampGridRows(stampsRequired);
  const perRow = rows[0] ?? stampsRequired;
  const granted = Math.min(stamps.length, stampsRequired);
  const expires = formatDate(cycleExpiresAt);
  const progressText = `${granted} de ${stampsRequired} sellos`;
  const bonusCount = stamps.slice(0, granted).filter((s) => s.isBonus).length;
  const summary = [
    `${merchantName}: ${progressText}, premio ${rewardTitle}, vence el ${expires}`,
    bonusCount > 0 ? `${bonusCount} ${bonusCount === 1 ? "sello extra" : "sellos extra"}` : null,
    pendingExtraStamps > 0 ? "+1 sello extra en tu próxima visita" : null,
    available ? null : "No disponible",
  ]
    .filter(Boolean)
    .join(". ");
  const showBg = backgroundUri && backgroundUri !== failedBgUri;

  const grid = rows.map((count, rowIndex) => {
    // Rows are [first, rest]: the second row starts after the first.
    const start = rowIndex === 0 ? 0 : (rows[0] ?? 0);
    return (
      <View key={rowIndex} testID="stamp-row" style={{ flexDirection: "row", justifyContent: "center", gap: spacing.sm }}>
        {Array.from({ length: count }, (_, i) => {
          const index = start + i;
          return (
            // WHY: fixed slot width (1 / widest row) so a 4 + 3 grid keeps equal circles.
            <View key={index} style={{ width: `${100 / perRow - 3}%` }}>
              <StampSlot
                stamp={index < granted ? stamps[index] : undefined}
                isLast={index === stampsRequired - 1}
                isNew={highlightLast && index === granted - 1}
                merchantName={merchantName}
                logoUri={logoUri}
                grayscale={!available}
              />
            </View>
          );
        })}
      </View>
    );
  });

  return (
    <View
      testID={testID}
      style={{
        borderRadius: radii.stampContainer,
        borderCurve: "continuous",
        overflow: "hidden",
        backgroundColor: colors.surfaceCard,
      }}
    >
      {showBg ? (
        <>
          <Image
            source={{ uri: backgroundUri }}
            recyclingKey={backgroundUri}
            contentFit="cover"
            transition={150}
            onError={() => setFailedBgUri(backgroundUri)}
            // NOTE: CSS filter grayscale only renders on Android; on iOS the dimmed content + label carry RN-71.
            style={[StyleSheet.absoluteFill, { filter: available ? undefined : [{ grayscale: 1 }] }]}
            accessible={false}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: VEIL }]} />
        </>
      ) : null}

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        {pendingExtraStamps > 0 || !available ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {pendingExtraStamps > 0 ? (
              // Accent as a badge background (non-text); the label itself is dark text (§4.3).
              <View testID="stamp-extra-badge" style={[styles.pill, { backgroundColor: colors.accent, flexDirection: "row", alignItems: "center", gap: spacing.xs }]}>
                <StarIcon size={14} />
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { fontFamily: fontFamily.semibold, color: colors.textPrimary }]}>
                  +1 sello extra en tu próxima visita
                </Text>
              </View>
            ) : null}
            {!available ? (
              <View testID="stamp-unavailable" style={[styles.pill, { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.textPrimary }]}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { fontFamily: fontFamily.semibold, color: colors.textPrimary }]}>
                  No disponible
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* PX-1: the grid is the visual center; one summary label keeps the screen-reader order short. */}
        <View
          accessible
          accessibilityLabel={summary}
          style={{ gap: spacing.lg }}
        >
          {/* RN-71: only the grid is dimmed; text keeps AA contrast and the "No disponible" label carries the state. */}
          <View style={{ gap: spacing.md, opacity: available ? 1 : 0.5 }}>{grid}</View>
          <View style={{ gap: spacing.xs }}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h2, { color: colors.textPrimary, fontVariant: ["tabular-nums"] }]}>
              {progressText}
            </Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textPrimary }]}>
              Premio: {rewardTitle}
            </Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
              Vence el {expires}
            </Text>
          </View>
        </View>

        {rewardAvailable ? (
          <View testID="stamp-reward-available" style={{ borderRadius: radii.card, borderCurve: "continuous", backgroundColor: colors.surface, borderLeftWidth: 6, borderLeftColor: colors.accent, padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <GiftIcon size={22} />
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { fontFamily: fontFamily.semibold, color: colors.textPrimary, flexShrink: 1 }]}>
                Recompensa disponible
              </Text>
            </View>
            {onViewReward ? <Button title="Ver recompensa" onPress={onViewReward} fullWidth /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bonusStar: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999, // capsule
  },
});
