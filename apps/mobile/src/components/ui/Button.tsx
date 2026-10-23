import { useState } from "react";
import { ActivityIndicator, Animated, Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import { selection } from "../../lib/haptics";
import { useReduceMotion } from "../useReduceMotion";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";

// NOTE: no accent variant on purpose — accent is reserved for reward moments (OD-3).
const PRESSED_SCALE = 0.97;
// WHY: animating the Pressable itself (no wrapper) keeps caller layout styles (flex, margins) working.
// Style is a plain array (not a pressed-callback), which animated components require; pressed lives in state.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const variants = {
  primary: { container: { backgroundColor: colors.primary }, text: colors.surface },
  secondary: {
    container: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
    text: colors.textPrimary,
  },
  // F-15: irreversible actions only. White on colors.error is 4.55:1 (AA).
  destructive: { container: { backgroundColor: colors.error }, text: colors.surface },
} as const;

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: keyof typeof variants;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  /** Light tick on press, for selection-like actions. */
  haptic?: "selection";
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityHint,
  haptic,
  testID,
  style,
}: ButtonProps) {
  const reduceMotion = useReduceMotion();
  const [pressed, setPressed] = useState(false);
  const [scale] = useState(() => new Animated.Value(1));
  const animateTo = (value: number) => {
    // WHY: §9 — no press scale with reduce motion; opacity feedback remains.
    if (reduceMotion) return;
    Animated.timing(scale, { toValue: value, duration: 90, useNativeDriver: true }).start();
  };
  const { container, text } = variants[variant];
  return (
    <AnimatedPressable
      onPress={() => {
        if (haptic) selection();
        onPress();
      }}
      onPressIn={() => {
        setPressed(true);
        animateTo(PRESSED_SCALE);
      }}
      onPressOut={() => {
        setPressed(false);
        animateTo(1);
      }}
      // WHY: RR-1 — no double submits while a request is in flight.
      disabled={disabled || loading}
      accessibilityRole="button"
      // Keeps the label announced while the spinner replaces the title.
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
      style={[
        {
          minHeight: 48,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderRadius: radii.button,
          borderCurve: "continuous",
          alignSelf: fullWidth ? "stretch" : "center",
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
        container,
        style,
        { transform: [{ scale }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={text} />
      ) : (
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { fontFamily: fontFamily.semibold, color: text, textAlign: "center" }]}>
          {title}
        </Text>
      )}
    </AnimatedPressable>
  );
}
