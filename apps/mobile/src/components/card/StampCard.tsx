import { stampGridRows } from "@ekko/shared";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as haptics from "../../lib/haptics";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { formatDate } from "../format";
import { MerchantAvatar } from "../merchant/MerchantAvatar";
import { Gift as GiftIcon } from "../icons";
import { Entrance } from "../motion";
import { useReduceMotion } from "../useReduceMotion";

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
  cycleExpiresAt: string;
  pendingExtraStamps: number;
  rewardAvailable: boolean;
  /** Merchant availability (RN-71). */
  available: boolean;
  /** Plays the entrance animation and accent ring on the newest stamp. */
  highlightLast?: boolean;
  /** Wallet-stack strip on top of the card (Mis Tarjetas); the detail screen omits it. */
  header?: StampCardHeader;
  testID?: string;
};

export type StampCardHeader = { logoUri: string | null; name: string; badge?: string };

/** Height of the header strip: the visible part of a card covered by the next one in the stack. */
export const STAMP_CARD_HEADER_HEIGHT = 64;

// Brief §6.2: card backgrounds (1.586:1, cropped with `cover`) always sit under a translucent veil.
const STAMP_MAX = 64;
const NEW_RING = 3;
const SLOT_GAP = spacing.sm;
// Screen margin (list/scroll padding) plus the card's own padding, on both sides; every screen that hosts the card uses spacing.lg.
const HORIZONTAL_INSETS = 4 * spacing.lg;
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
function NewStampRing({ diameter }: { diameter: number }) {
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
      style={[StyleSheet.absoluteFill, { borderRadius: diameter / 2, borderWidth: NEW_RING, borderColor: colors.accent, opacity }]}
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
  /** Width of the slot column (date line); the circle is `diameter` wide. */
  slotWidth: number;
  diameter: number;
};

function StampSlot({ stamp, isLast, isNew, oneLeft, merchantName, imageUri, grayscale, slotWidth, diameter }: SlotProps) {
  // WHY: one numeric diameter for every layer, so no layer can stretch into an oval at any column width.
  const circle = { width: diameter, height: diameter, borderRadius: diameter / 2 } as const;
  let face: React.ReactNode;
  if (!stamp) {
    face = (
      <View testID="stamp-empty" style={[circle, { overflow: "hidden" }, emptySlot(isLast && oneLeft)]}>
        {isLast ? <GiftIcon size={24} testID="stamp-gift" /> : null}
      </View>
    );
  } else {
    face = (
      <View testID={isNew ? "stamp-new" : "stamp-granted"} style={[circle, { alignItems: "center", justifyContent: "center" }]}>
        <MerchantAvatar name={merchantName} uri={imageUri} size={diameter} grayscale={grayscale} />
        {isNew ? <NewStampRing diameter={diameter} /> : null}
        {/* RN-36: a bonus stamp carries a star (not only a colour) so it reads apart from a visit stamp. */}
        {stamp.isBonus ? (
          <View testID="stamp-bonus" style={styles.bonusStar}>
            <StarIcon size={14} />
          </View>
        ) : null}
      </View>
    );
    // A-28: the new stamp lands with a spring from 0.6 (overshoot); static under reduce motion.
    if (isNew) face = <Entrance from={0.6} spring style={{ alignItems: "center" }}>{face}</Entrance>;
  }
  return (
    <View style={{ width: slotWidth, alignItems: "center", gap: spacing.xs }}>
      {face}
      {/* NOTE: empty slots keep the date line so every row has the same height. */}
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={MAX_FONT_SCALE} style={dateText}>
        {stamp ? formatDate(stamp.grantedAt, "2-digit") : " "}
      </Text>
    </View>
  );
}

export function StampCardHeaderStrip({ header, progress, dimmed }: { header: StampCardHeader; progress: string; dimmed: boolean }) {
  return (
    <View style={{ height: STAMP_CARD_HEADER_HEIGHT, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, opacity: dimmed ? 0.5 : 1 }}>
      <MerchantAvatar name={header.name} uri={header.logoUri} size={40} grayscale={dimmed} />
      <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h2, { flex: 1, color: colors.textPrimary }]}>
        {header.name}
      </Text>
      {header.badge ? (
        <View style={[styles.pill, { flexShrink: 1, backgroundColor: colors.accent }]}>
          <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.label, { letterSpacing: 0, textTransform: "none", color: colors.textPrimary }]}>
            {header.badge}
          </Text>
        </View>
      ) : null}
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { fontFamily: fontFamily.semibold, color: colors.textPrimary, fontVariant: ["tabular-nums"] }]}>
        {progress}
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
  cycleExpiresAt,
  pendingExtraStamps,
  rewardAvailable,
  available,
  highlightLast = false,
  header,
  testID,
}: StampCardProps) {
  const [failedBgUri, setFailedBgUri] = useState<string | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const rows = stampGridRows(stampsRequired);
  const perRow = rows[0] ?? stampsRequired;
  const granted = Math.min(stamps.length, stampsRequired);
  const expires = formatDate(cycleExpiresAt);
  const progressText = `${granted} de ${stampsRequired} sellos`;
  const remaining = stampsRequired - granted;
  const remainingLabel = rewardAvailable ? null : remainingText(remaining);
  const oneLeft = !rewardAvailable && remaining === 1;
  const buzzed = useRef(false);
  // WHY: the new-stamp moment buzzes once per mount, not on every re-render.
  useEffect(() => {
    if (buzzed.current || !highlightLast || granted === 0) return;
    buzzed.current = true;
    haptics.success();
  }, [highlightLast, granted]);
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
  // WHY: derived from the window instead of an onLayout measurement, which cost a second render per card.
  const slotWidth = Math.max(0, Math.floor((windowWidth - HORIZONTAL_INSETS - SLOT_GAP * (perRow - 1)) / perRow));
  const diameter = Math.min(STAMP_MAX, slotWidth);

  const grid = rows.map((count, rowIndex) => {
    // Rows are [first, rest]: the second row starts after the first.
    const start = rowIndex === 0 ? 0 : (rows[0] ?? 0);
    return (
      <View key={rowIndex} testID="stamp-row" style={{ flexDirection: "row", justifyContent: "center", gap: SLOT_GAP }}>
        {Array.from({ length: count }, (_, i) => {
          const index = start + i;
          return (
            <StampSlot
              key={index}
              stamp={index < granted ? stamps[index] : undefined}
              isLast={index === stampsRequired - 1}
              isNew={highlightLast && index === granted - 1}
              oneLeft={oneLeft}
              merchantName={merchantName}
              imageUri={stampImageUri ?? logoUri}
              grayscale={!available}
              slotWidth={slotWidth}
              diameter={diameter}
            />
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
        // Stacked cards need an edge to read apart from the one below.
        borderWidth: header ? 1 : 0,
        borderColor: colors.surfaceMuted,
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

      {header ? <StampCardHeaderStrip header={header} progress={`${granted}/${stampsRequired}`} dimmed={!available} /> : null}
      <View style={{ padding: spacing.lg, paddingTop: header ? 0 : spacing.lg, gap: spacing.lg }}>
        {/* PX-1: the grid is the visual center; one summary label keeps the screen-reader order short.
            Inside a stack the surrounding button already carries the label. */}
        <View accessible={!header} accessibilityLabel={header ? undefined : summary} style={{ gap: spacing.lg }}>
          {/* RN-71: only the grid is dimmed; text keeps AA contrast. */}
          <View style={{ gap: spacing.md, opacity: available ? 1 : 0.5 }}>
            {grid}
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textPrimary, fontFamily: fontFamily.semibold }]}>
              Premio: {rewardTitle}
            </Text>
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
