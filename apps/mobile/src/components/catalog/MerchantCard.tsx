import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { MerchantAvatar, initialsOf } from "../merchant/MerchantAvatar";
import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";

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
};

export type MerchantCardProps = {
  merchant: MerchantCardData;
  onPress: () => void;
  onOpenMap: () => void;
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

export function MerchantCard({ merchant, onPress, onOpenMap, testID }: MerchantCardProps) {
  const { name, categoryLabel, description, coverUri, logoUri } = merchant;
  const [failedCoverUri, setFailedCoverUri] = useState<string | null>(null);

  return (
    // WHY: the map button is a sibling of the card Pressable, not a child — nested touchables
    // would be merged into one element by screen readers and swallow the map action.
    <View testID={testID}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${categoryLabel}`}
        style={({ pressed }) => ({
          borderRadius: radii.card,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.surfaceMuted,
          backgroundColor: colors.surface,
          overflow: "hidden",
          opacity: pressed ? 0.85 : 1,
        })}
      >
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
          ) : null}
        </View>
        <View style={{ position: "relative" }}>
          <MerchantLogo name={name} uri={logoUri} />
        </View>
        <View style={{ paddingTop: LOGO_SIZE / 2 + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.xs }}>
          <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h2, { color: colors.textPrimary }]}>
            {name}
          </Text>
          <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
            {categoryLabel}
          </Text>
          {/* NOTE: left-aligned, never justified (§4.2). */}
          <Text numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textPrimary, textAlign: "left" }]}>
            {description}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onOpenMap}
        accessibilityRole="button"
        accessibilityLabel="Abrir en Google Maps"
        style={({ pressed }) => ({
          position: "absolute",
          top: spacing.sm,
          right: spacing.sm,
          width: MAP_BUTTON_SIZE,
          height: MAP_BUTTON_SIZE,
          borderRadius: MAP_BUTTON_SIZE / 2,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <PinIcon />
      </Pressable>
    </View>
  );
}
