import { stampGridRows } from "@ekko/shared";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as haptics from "../../lib/haptics";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { formatDate } from "../format";
import { MerchantAvatar } from "../merchant/MerchantAvatar";
import { Gift as GiftIcon } from "../icons";
import { Entrance, Pop } from "../motion";
import { ProgressBar } from "../merchant/ProgressBar";
import { useReduceMotion } from "../useReduceMotion";
import { Button } from "../ui/Button";

export type StampCardStamp = { grantedAt: string; isBonus: boolean };

export type StampCardProps = {
  /** 4..10 (RN-23). */
  stampsRequired: number;
  /** Stamps of the current cycle, oldest first. */
  stamps: StampCardStamp[];
  logoUri: string | null;
  /** Custom stamp art; null falls back to the logo. */
  stampImageUri?: string | null;
  merchantName: string;
  backgroundUri: string | null;
  rewardTitle: string;
  /** Shown under "Premio: …" inside the card (A-31). */
  rewardDescription?: string | null;
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
const STAMP_MAX = 64;
const NEW_RING = 3;
const RING_FADE_MS = 1500;

const dateText = [textStyles.label, { letterSpacing: 0, textTransform: "none" as const, color: colors.textPrimary, textAlign: "center" as const }];

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

// A-30: empty slots are dashed outlines that read as "to fill"; A-27: with one left the gift slot turns accent.
const emptySlot = (accent: boolean) =>
  ({
    borderWidth: accent ? 2 : 1,
    borderStyle: "dashed",
    borderColor: accent ? colors.accent : colors.textSecondary,
    alignItems: "center",
    justifyContent: "center",
  }) as const;

// A-28: accent ring around the newest stamp that fades out in 1.5 s; it stays visible under reduce motion.
function NewStampRing() {
  const reduce = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduce !== false) return;
    const anim = Animated.timing(opacity, { toValue: 0, duration: RING_FADE_MS, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [reduce, opacity]);
  return (
    <Animated.View
      pointerEvents="none"
      testID="stamp-new-ring"
      style={[StyleSheet.absoluteFill, { borderRadius: STAMP_MAX / 2, borderWidth: NEW_RING, borderColor: colors.accent, opacity }]}
    />
  );
}

export function remainingText(remaining: number): string | null {
  if (remaining <= 0) return null;
  return remaining === 1 ? "¡Solo te falta 1!" : `Te faltan ${remaining} para tu premio`;
}

type SlotProps = {
  stamp: StampCardStamp | undefined;
  isLast: boolean;
  isNew: boolean;
  /** One stamp left: the gift slot gets a dashed accent ring. */
  oneLeft: boolean;
  merchantName: string;
  imageUri: string | null;
  grayscale: boolean;
};

function StampSlot({ stamp, isLast, isNew, oneLeft, merchantName, imageUri, grayscale }: SlotProps) {
  const circle = { width: "100%" as const, maxWidth: STAMP_MAX, aspectRatio: 1, borderRadius: STAMP_MAX / 2 } as const;
  let face: React.ReactNode;
  if (!stamp) {
    face = (
      <View testID="stamp-empty" style={[circle, emptySlot(isLast && oneLeft)]}>
        {isLast ? <GiftIcon size={24} testID="stamp-gift" /> : null}
      </View>
    );
  } else {
    face = (
      <View testID={isNew ? "stamp-new" : "stamp-granted"} style={[circle, { alignItems: "center", justifyContent: "center" }]}>
        {isNew ? <NewStampRing /> : null}
        <MerchantAvatar name={merchantName} uri={imageUri} size={STAMP_MAX} grayscale={grayscale} style={{ width: "100%", height: "100%" }} />
        {/* RN-36: a bonus stamp carries a star (not only a colour) so it reads apart from a visit stamp. */}
        {stamp.isBonus ? (
          <View testID="stamp-bonus" style={styles.bonusStar}>
            <StarIcon size={14} />
          </View>
        ) : null}
      </View>
    );
    // A-28: the new stamp lands with a spring from 0.6 (overshoot); static under reduce motion.
    if (isNew) face = <Entrance from={0.6} spring style={{ width: "100%", alignItems: "center" }}>{face}</Entrance>;
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
  stampImageUri = null,
  merchantName,
  backgroundUri,
  rewardTitle,
  rewardDescription = null,
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
  const remaining = stampsRequired - granted;
  const remainingLabel = rewardAvailable ? null : remainingText(remaining);
  const oneLeft = !rewardAvailable && remaining === 1;
  const [rewardPopped, setRewardPopped] = useState(false);
  const buzzed = useRef(false);
  // WHY: the reward moment (new stamp or reward notice) buzzes and pops once per mount, not on every re-render.
  useEffect(() => {
    // WHY: a frame later, so the Pop sees a false → true change and plays once the card is on screen.
    const frame = rewardAvailable ? requestAnimationFrame(() => setRewardPopped(true)) : null;
    if (!buzzed.current && (rewardAvailable || (highlightLast && granted > 0))) {
      buzzed.current = true;
      haptics.success();
    }
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [rewardAvailable, highlightLast, granted]);
  const bonusCount = stamps.slice(0, granted).filter((s) => s.isBonus).length;
  const summary = [
    `${merchantName}: ${progressText}, premio ${rewardTitle}, vence el ${expires}`,
    remainingLabel,
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
                oneLeft={oneLeft}
                merchantName={merchantName}
                imageUri={stampImageUri ?? logoUri}
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
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.veil }]} />
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

        {rewardAvailable ? (
          <View testID="stamp-reward-available" style={{ borderRadius: radii.card, borderCurve: "continuous", backgroundColor: colors.surface, borderLeftWidth: 6, borderLeftColor: colors.accent, padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Pop trigger={rewardPopped}>
                <GiftIcon size={22} />
              </Pop>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { fontFamily: fontFamily.semibold, color: colors.textPrimary, flexShrink: 1 }]}>
                Recompensa disponible
              </Text>
            </View>
            {onViewReward ? <Button title="Ver recompensa" onPress={onViewReward} fullWidth testID={testID && `${testID}-view-reward`} /> : null}
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
            {remainingLabel ? (
              <View style={{ gap: spacing.xs }}>
                <Text testID="stamp-remaining" maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textPrimary, fontFamily: fontFamily.semibold }]}>
                  {remainingLabel}
                </Text>
                <ProgressBar value={granted} total={stampsRequired} accent={oneLeft} />
              </View>
            ) : null}
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textPrimary }]}>
              Premio: {rewardTitle}
            </Text>
            {rewardDescription ? (
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: showBg ? colors.textPrimary : colors.textSecondary }]}>
                {rewardDescription}
              </Text>
            ) : null}
            {/* WHY: over a dark merchant image the 78% veil leaves ~3.4:1 for textSecondary; textPrimary stays AA. */}
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: showBg ? colors.textPrimary : colors.textSecondary }]}>
              Vence el {expires}
            </Text>
          </View>
        </View>

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
    borderRadius: radii.pill,
  },
});
