import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReduceMotion } from "../useReduceMotion";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";

export const TOAST_DURATION_MS = 5000;

export type ToastProps = {
  title: string;
  message: string;
  /** Optional: without it the toast is informational and tapping only dismisses it. */
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  durationMs?: number;
  testID?: string;
};

// F-13: top toast for an in-app notification. Polite live region so screen readers read it without
// stealing focus; the whole card and the explicit action both open the destination.
export function Toast({ title, message, actionLabel, onAction, onDismiss, durationMs = TOAST_DURATION_MS, testID }: ToastProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // WHY: §9 — with reduce motion the toast appears without the fade; null = setting not known yet.
    if (reduceMotion === null) return;
    if (reduceMotion) opacity.setValue(1);
    else Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [opacity, onDismiss, durationMs, reduceMotion]);

  const open = () => {
    onAction?.();
    onDismiss();
  };

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      testID={testID}
      style={{ position: "absolute", top: insets.top + spacing.sm, left: spacing.lg, right: spacing.lg, zIndex: 10, opacity }}
    >
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${message}`}
        accessibilityHint={actionLabel}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          minHeight: 56,
          borderRadius: radii.card,
          backgroundColor: colors.navy,
          // WHY: a hairline replaces the heavy drop shadow; the navy fill already separates it from the page.
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.pattern,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={[textStyles.body, { fontFamily: fontFamily.semibold, color: colors.surface }]}>
            {title}
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={2} style={[textStyles.secondary, { color: colors.surface }]}>
            {message}
          </Text>
        </View>
        {actionLabel ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { fontFamily: fontFamily.bold, color: colors.surface, textDecorationLine: "underline" }]}>
            {actionLabel}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}
