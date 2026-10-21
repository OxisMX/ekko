import { ActivityIndicator, Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";

// NOTE: no accent variant on purpose — accent is reserved for reward moments (OD-3).
const variants = {
  primary: { container: { backgroundColor: colors.primary }, text: colors.surface },
  secondary: {
    container: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
    text: colors.textPrimary,
  },
} as const;

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: keyof typeof variants;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
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
  testID,
  style,
}: ButtonProps) {
  const { container, text } = variants[variant];
  return (
    <Pressable
      onPress={onPress}
      // WHY: RR-1 — no double submits while a request is in flight.
      disabled={disabled || loading}
      accessibilityRole="button"
      // Keeps the label announced while the spinner replaces the title.
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
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
      ]}
    >
      {loading ? (
        <ActivityIndicator color={text} />
      ) : (
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { fontFamily: fontFamily.semibold, color: text, textAlign: "center" }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
