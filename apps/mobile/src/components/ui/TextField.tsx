import type { ComponentRef, ReactNode, Ref } from "react";
import { Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";

// Shared box look for every field (TextField, PasswordField, DateField).
export function fieldBoxStyle(hasError: boolean): ViewStyle {
  return {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.field,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: hasError ? colors.error : "transparent",
    backgroundColor: colors.surfaceMuted,
  };
}

export function FieldLabel({ children }: { children: string }) {
  return (
    // Hidden from screen readers: the control already carries the label.
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={[textStyles.label, { color: colors.textPrimary }]}
    >
      {children}
    </Text>
  );
}

export function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    // NOTE: must sit on `surface` (white): colors.error is 4.55:1 there but 4.03:1 on surfaceMuted.
    <Text
      selectable
      accessibilityLiveRegion="polite"
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={[textStyles.secondary, { color: colors.error }]}
    >
      {`Error: ${error}`}
    </Text>
  );
}

export type TextFieldProps = Omit<TextInputProps, "style" | "accessibilityLabel"> & {
  label: string;
  error?: string;
  // Trailing control inside the field box (e.g. PasswordField's "Mostrar").
  accessory?: ReactNode;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

export function TextField({ label, error, accessory, ref, accessibilityHint, ...inputProps }: TextFieldProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      <FieldLabel>{label}</FieldLabel>
      <View style={fieldBoxStyle(!!error)}>
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
              flex: 1,
              minHeight: 45,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              color: colors.textPrimary,
            },
          ]}
          {...inputProps}
        />
        {accessory}
      </View>
      <FieldError error={error} />
    </View>
  );
}
