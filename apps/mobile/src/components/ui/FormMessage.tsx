import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";

// WHY: the prefix word carries the meaning so it never depends on color alone (§9).
// NOTE: rendered on `surface` (white) — colors.error drops below AA on surfaceMuted.
const variants = {
  error: { prefix: "Error:", color: colors.error },
  info: { prefix: "Aviso:", color: colors.navy },
  success: { prefix: "Listo:", color: colors.success },
} as const;

export type FormMessageProps = {
  variant: keyof typeof variants;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function FormMessage({ variant, message, actionLabel, onAction, testID, style }: FormMessageProps) {
  const { prefix, color } = variants[variant];
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={[
        {
          gap: spacing.xs,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: radii.field,
          borderCurve: "continuous",
          borderWidth: 1.5,
          borderColor: color,
          backgroundColor: colors.surface,
        },
        style,
      ]}
    >
      <Text
        // On the text, not the container: an accessible container would swallow the action button.
        accessibilityRole={variant === "error" ? "alert" : undefined}
        selectable
        maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textPrimary }]}>
        <Text style={{ fontFamily: fontFamily.semibold, color }}>{prefix}</Text> {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", opacity: pressed ? 0.6 : 1 })}
        >
          <Text
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={[textStyles.secondary, { fontFamily: fontFamily.semibold, color: colors.textPrimary, textDecorationLine: "underline" }]}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
