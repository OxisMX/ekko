import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { StatusIcon } from "./StatusIcon";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";

// WHY: the icon shape carries the meaning so it never depends on color alone (§9).
// NOTE: rendered on `surface` (white) — colors.error drops below AA on surfaceMuted.
const variants = {
  error: { color: colors.error },
  info: { color: colors.navy },
  success: { color: colors.success },
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
  const { color } = variants[variant];
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
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
        <StatusIcon variant={variant} color={color} />
        <Text
          // On the text, not the container: an accessible container would swallow the action button.
          accessibilityRole={variant === "error" ? "alert" : undefined}
          selectable
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[textStyles.secondary, { flex: 1, color: colors.textPrimary }]}
        >
          {message}
        </Text>
      </View>
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
