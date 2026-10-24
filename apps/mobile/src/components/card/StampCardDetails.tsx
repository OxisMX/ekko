import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as haptics from "../../lib/haptics";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { ChevronRight, Gift as GiftIcon, Star } from "../icons";
import { ProgressBar } from "../merchant/ProgressBar";
import { Pop } from "../motion";
import { Button } from "../ui/Button";
import { remainingText, StarIcon } from "./StampCard";

export type StampCardDetailsProps = {
  stampsCount: number;
  stampsRequired: number;
  rewardDescription: string | null;
  pendingExtraStamps: number;
  rewardAvailable: boolean;
  /** Merchant availability (RN-71). */
  available: boolean;
  onViewReward?: () => void;
  /** A-31: the welcome wheel is an invitation under the card. */
  wheelOffered: boolean;
  onSpinWheel: () => void;
  terms: string | null;
  testID?: string;
};

const pill = { alignSelf: "flex-start", paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill } as const;

// Everything that explains the card but does not belong on it: progress, reward notice, wheel and terms.
export function StampCardDetails({
  stampsCount,
  stampsRequired,
  rewardDescription,
  pendingExtraStamps,
  rewardAvailable,
  available,
  onViewReward,
  wheelOffered,
  onSpinWheel,
  terms,
  testID,
}: StampCardDetailsProps) {
  const granted = Math.min(stampsCount, stampsRequired);
  const remaining = stampsRequired - granted;
  const remainingLabel = rewardAvailable ? null : remainingText(remaining);
  const oneLeft = !rewardAvailable && remaining === 1;
  const [rewardPopped, setRewardPopped] = useState(false);
  const buzzed = useRef(false);
  // WHY: the reward moment buzzes and pops once per mount, not on every re-render.
  useEffect(() => {
    if (!rewardAvailable) return;
    // WHY: a frame later, so the Pop sees a false → true change and plays once it is on screen.
    const frame = requestAnimationFrame(() => setRewardPopped(true));
    if (!buzzed.current) {
      buzzed.current = true;
      haptics.success();
    }
    return () => cancelAnimationFrame(frame);
  }, [rewardAvailable]);

  return (
    <View
      testID={testID}
      style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radii.card, borderCurve: "continuous", borderWidth: 1, borderColor: colors.surfaceMuted, backgroundColor: colors.surface }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h2, { color: colors.textPrimary, fontVariant: ["tabular-nums"] }]}>
          {granted} de {stampsRequired} sellos
        </Text>
        {remainingLabel ? (
          <View style={{ gap: spacing.xs }}>
            <Text testID="stamp-remaining" maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textPrimary, fontFamily: fontFamily.semibold }]}>
              {remainingLabel}
            </Text>
            <ProgressBar value={granted} total={stampsRequired} accent={oneLeft} />
          </View>
        ) : null}
        {rewardDescription ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
            {rewardDescription}
          </Text>
        ) : null}
      </View>

      {pendingExtraStamps > 0 ? (
        // Accent as a badge background (non-text); the label itself is dark text (§4.3).
        <View testID="stamp-extra-badge" style={[pill, { backgroundColor: colors.accent, flexDirection: "row", alignItems: "center", gap: spacing.xs }]}>
          <StarIcon size={14} />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { fontFamily: fontFamily.semibold, color: colors.textPrimary }]}>
            +1 sello extra en tu próxima visita
          </Text>
        </View>
      ) : null}
      {!available ? (
        <View testID="stamp-unavailable" style={[pill, { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.textPrimary }]}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { fontFamily: fontFamily.semibold, color: colors.textPrimary }]}>
            No disponible
          </Text>
        </View>
      ) : null}

      {rewardAvailable ? (
        <View testID="stamp-reward-available" style={{ borderRadius: radii.card, borderCurve: "continuous", backgroundColor: colors.surfaceCard, borderLeftWidth: 6, borderLeftColor: colors.accent, padding: spacing.lg, gap: spacing.md }}>
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

      {wheelOffered ? <WheelBanner onPress={onSpinWheel} /> : null}
      {terms ? <TermsAccordion terms={terms} /> : null}
    </View>
  );
}

// A-31: the wheel is an invitation inside the card tab, not one more button in the stack.
function WheelBanner({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Tienes un giro de bienvenida"
      testID="merchant-spin-wheel"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 56,
        paddingHorizontal: spacing.lg,
        borderRadius: radii.card,
        borderCurve: "continuous",
        backgroundColor: colors.accent,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Star color={colors.textPrimary} size={22} />
      {/* WHY: dark text on the accent fill; white on accent would fail AA (§4.3). */}
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { flex: 1, fontFamily: fontFamily.semibold, color: colors.textPrimary }]}>
        Tienes un giro de bienvenida
      </Text>
      <ChevronRight color={colors.textPrimary} size={20} />
    </Pressable>
  );
}

// A-32: terms are long and rarely read, so they collapse.
function TermsAccordion({ terms }: { terms: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        onPress={() => setExpanded((open) => !open)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel="Términos y condiciones"
        testID="merchant-terms-toggle"
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}
      >
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { fontFamily: fontFamily.semibold, color: colors.textPrimary }]}>
          Términos y condiciones
        </Text>
        <View style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}>
          <ChevronRight size={20} />
        </View>
      </Pressable>
      {expanded ? (
        <Text testID="merchant-terms" maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
          {terms}
        </Text>
      ) : null}
    </View>
  );
}
