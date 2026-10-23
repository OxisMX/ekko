import { Image } from "expo-image";
import { useState, type ReactNode } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";
import { FavoriteButton } from "../ui/FavoriteButton";
import { PinIcon } from "../catalog/MerchantCard";
import { MerchantAvatar } from "./MerchantAvatar";

// NOTE: fixed heights (cover cropped to ~16:9 at 375 pt) so screens can pad their scroll content
// without measuring. Both exclude the safe-area top inset, which the header adds itself.
const COVER_HEIGHT = 200;
// Fits logo overhang + name + category at 130% font scale (§9).
const INFO_HEIGHT = 124;
export const HEADER_EXPANDED_HEIGHT = COVER_HEIGHT + INFO_HEIGHT;
export const HEADER_COMPACT_HEIGHT = 56;
const COLLAPSE_DISTANCE = HEADER_EXPANDED_HEIGHT - HEADER_COMPACT_HEIGHT;

const LOGO_SIZE = 64;
const COMPACT_LOGO_SIZE = 32;
const MAP_BUTTON_SIZE = 44; // RT-04

export type MerchantHeaderProps = {
  name: string;
  categoryLabel: string;
  coverUri: string | null;
  logoUri: string | null;
  onOpenMap: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  /** Vertical offset of the screen's Animated.ScrollView (Animated.event, useNativeDriver: true). */
  scrollY?: Animated.Value;
  /** Rendered under the header and kept visible when compact (e.g. SegmentedTabs, DA-2). */
  children?: ReactNode;
  testID?: string;
};

/**
 * DA-4 header. Absolutely positioned over the screen: render it after an Animated.ScrollView whose
 * contentContainerStyle.paddingTop is `insets.top + HEADER_EXPANDED_HEIGHT` (+ the children's height).
 * Scrolling translates it up by the collapse distance (transform only, native driver) and cross-fades
 * the cover out and a compact logo + name bar in.
 */
export function MerchantHeader({ name, categoryLabel, coverUri, logoUri, onOpenMap, isFavorite, onToggleFavorite, scrollY, children, testID }: MerchantHeaderProps) {
  const insets = useSafeAreaInsets();
  const [staticScroll] = useState(() => new Animated.Value(0));
  const [failedCoverUri, setFailedCoverUri] = useState<string | null>(null);
  const y = scrollY ?? staticScroll;

  const translateY = y.interpolate({ inputRange: [0, COLLAPSE_DISTANCE], outputRange: [0, -COLLAPSE_DISTANCE], extrapolate: "clamp" });
  const expandedOpacity = y.interpolate({ inputRange: [0, COLLAPSE_DISTANCE * 0.7], outputRange: [1, 0], extrapolate: "clamp" });
  const compactOpacity = y.interpolate({ inputRange: [COLLAPSE_DISTANCE * 0.7, COLLAPSE_DISTANCE], outputRange: [0, 1], extrapolate: "clamp" });

  return (
    <Animated.View testID={testID} style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1, transform: [{ translateY }] }}>
      <View style={{ height: insets.top + HEADER_EXPANDED_HEIGHT, backgroundColor: colors.surface }}>
        <Animated.View style={{ height: insets.top + COVER_HEIGHT, backgroundColor: colors.surfaceMuted, opacity: expandedOpacity }}>
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
        </Animated.View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: -LOGO_SIZE / 2 }}>
          <MerchantAvatar name={name} uri={logoUri} size={LOGO_SIZE} ringWidth={3} />
          <View style={{ flex: 1 }} />
          <FavoriteButton isFavorite={isFavorite} onToggle={onToggleFavorite} backgroundColor={colors.surfaceMuted} testID="merchant-favorite" />
          <Pressable
            onPress={onOpenMap}
            accessibilityRole="button"
            accessibilityLabel="Abrir en Google Maps"
            style={({ pressed }) => ({
              width: MAP_BUTTON_SIZE,
              height: MAP_BUTTON_SIZE,
              borderRadius: MAP_BUTTON_SIZE / 2,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <PinIcon />
          </Pressable>
        </View>
        <View accessible accessibilityRole="header" accessibilityLabel={`${name}, ${categoryLabel}`} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs / 2 }}>
          <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h2, { color: colors.textPrimary }]}>
            {name}
          </Text>
          <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
            {categoryLabel}
          </Text>
        </View>

        {/* Compact bar: visual only (name is already announced above); never intercepts touches. */}
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: insets.top + HEADER_COMPACT_HEIGHT,
            paddingTop: insets.top,
            paddingHorizontal: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            backgroundColor: colors.surface,
            opacity: compactOpacity,
          }}
        >
          <MerchantAvatar name={name} uri={logoUri} size={COMPACT_LOGO_SIZE} />
          <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { flex: 1, color: colors.textPrimary }]}>
            {name}
          </Text>
        </Animated.View>
      </View>
      {children}
    </Animated.View>
  );
}
