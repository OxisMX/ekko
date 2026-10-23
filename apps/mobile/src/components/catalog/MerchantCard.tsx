import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { FavoriteButton } from "../ui/FavoriteButton";
import { MapPin } from "../icons";
import { MerchantAvatar, initialsOf } from "../merchant/MerchantAvatar";
import { ProgressBar } from "../merchant/ProgressBar";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";

const LOGO_SIZE = 56;
const LOGO_RING = 3;
const MAP_BUTTON_SIZE = 44; // RT-04

export type MerchantCardData = {
  id: string;
  name: string;
  categoryLabel: string;
  description: string;
  coverUri: string | null;
  logoUri: string | null;
  isFavorite: boolean;
  /** A-19: null when the user has no card here yet. */
  progress: { stamps: number; required: number; rewardTitle: string } | null;
};

export type MerchantCardProps = {
  merchant: MerchantCardData;
  onPress: () => void;
  onOpenMap: () => void;
  onToggleFavorite: () => void;
  testID?: string;
};

export { initialsOf };

export function PinIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"
        stroke={colors.navy}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={12} cy={10} r={2.5} stroke={colors.navy} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

function MerchantLogo({ name, uri }: { name: string; uri: string | null }) {
  return (
    <MerchantAvatar
      name={name}
      uri={uri}
      size={LOGO_SIZE}
      ringWidth={LOGO_RING}
      style={{ position: "absolute", left: spacing.lg, bottom: -LOGO_SIZE / 2 }}
    />
  );
}

function CardProgress({ progress }: { progress: NonNullable<MerchantCardData["progress"]> }) {
  const { stamps, required, rewardTitle } = progress;
  return (
    <View style={{ gap: spacing.xs, paddingVertical: spacing.xs }} testID="merchant-card-progress">
      <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textPrimary, fontFamily: fontFamily.semibold }]}>
        {stamps}/{required} · {rewardTitle}
      </Text>
      <ProgressBar value={stamps} total={required} accent={required - stamps === 1} />
    </View>
  );
}

// A-20: no cover yet — brand tint with the initials instead of a grey block.
function EmptyCover({ name }: { name: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.navyTint, alignItems: "center", justifyContent: "center" }}>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={[textStyles.display, { color: colors.navy, opacity: 0.35 }]}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

export function MerchantCard({ merchant, onPress, onOpenMap, onToggleFavorite, testID }: MerchantCardProps) {
  const { name, categoryLabel, description, coverUri, logoUri, isFavorite, progress } = merchant;
  const [failedCoverUri, setFailedCoverUri] = useState<string | null>(null);
  const [pressed, setPressed] = useState(false);
  // WHY: the card is split in tappable parts around the "Ver mapa" button, because nested touchables
  // would be merged into one element by screen readers and swallow the map action.
  const open = { onPress, onPressIn: () => setPressed(true), onPressOut: () => setPressed(false) };

  return (
    <View testID={testID}>
      <View
        style={{
          borderRadius: radii.card,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.surfaceMuted,
          backgroundColor: colors.surface,
          overflow: "hidden",
          opacity: pressed ? 0.85 : 1,
        }}
      >
        <Pressable {...open} accessibilityRole="button" accessibilityLabel={`${name}, ${categoryLabel}`}>
          <View style={{ aspectRatio: 16 / 9, backgroundColor: colors.surfaceMuted }}>
            {coverUri && coverUri !== failedCoverUri ? (
              <Image
                source={{ uri: coverUri }}
                recyclingKey={coverUri}
                contentFit="cover"
                transition={150}
                onError={() => setFailedCoverUri(coverUri)}
                style={{ flex: 1 }}
                accessible={false}
              />
            ) : (
              <EmptyCover name={name} />
            )}
          </View>
          <View style={{ position: "relative" }}>
            <MerchantLogo name={name} uri={logoUri} />
          </View>
          <View style={{ paddingTop: LOGO_SIZE / 2 + spacing.sm, paddingHorizontal: spacing.lg }}>
            <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h2, { color: colors.textPrimary }]}>
              {name}
            </Text>
          </View>
        </Pressable>
        {/* A-21: "Ver mapa" lives in the category row, so the cover only carries the heart. */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: spacing.lg, paddingRight: spacing.sm }}>
          <Pressable {...open} accessible={false} style={{ flex: 1 }}>
            <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
              {categoryLabel}
            </Text>
          </Pressable>
          <Pressable
            onPress={onOpenMap}
            accessibilityRole="button"
            accessibilityLabel="Abrir en Google Maps"
            style={({ pressed: mapPressed }) => ({
              minHeight: MAP_BUTTON_SIZE,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              paddingHorizontal: spacing.sm,
              opacity: mapPressed ? 0.7 : 1,
            })}
          >
            <MapPin size={18} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.navy, fontFamily: fontFamily.semibold }]}>
              Ver mapa
            </Text>
          </Pressable>
        </View>
        <Pressable {...open} accessible={false} style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm }}>
          {progress ? <CardProgress progress={progress} /> : null}
          {/* NOTE: left-aligned, never justified (§4.2). */}
          <Text numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textPrimary, textAlign: "left" }]}>
            {description}
          </Text>
        </Pressable>
      </View>
      {/* WHY: sibling of the card, so tapping the heart never opens the merchant. */}
      <FavoriteButton
        isFavorite={isFavorite}
        onToggle={onToggleFavorite}
        testID={testID && `${testID}-favorite`}
        style={{ position: "absolute", top: spacing.sm, right: spacing.sm }}
      />
    </View>
  );
}
