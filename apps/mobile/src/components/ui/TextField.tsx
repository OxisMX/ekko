import type { ComponentRef, Ref } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";

export type TextFieldProps = Omit<TextInputProps, "style" | "accessibilityLabel"> & {
  label: string;
  error?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

export function TextField({ label, error, ref, accessibilityHint, ...inputProps }: TextFieldProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      {/* Hidden from screen readers: the input already carries the label. */}
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        importantForAccessibility="no"
        accessibilityElementsHidden
        style={[textStyles.label, { color: colors.textPrimary }]}
      >
        {label}
      </Text>
      <TextInput
        ref={ref}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={label}
        // WHY: the error is read together with the field on focus (§9), not only shown in red.
        accessibilityHint={error ?? accessibilityHint}
        style={[
          textStyles.body,
          {
            minHeight: 48,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderRadius: radii.field,
            borderCurve: "continuous",
            borderWidth: 1.5,
            borderColor: error ? colors.error : "transparent",
            backgroundColor: colors.surfaceMuted,
            color: colors.textPrimary,
          },
        ]}
        {...inputProps}
      />
      {error ? (
        // NOTE: must sit on `surface` (white): colors.error is 4.55:1 there but 4.03:1 on surfaceMuted.
        <Text
          selectable
          accessibilityLiveRegion="polite"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[textStyles.secondary, { color: colors.error }]}
        >
          {`Error: ${error}`}
        </Text>
      ) : null}
    </View>
  );
}
