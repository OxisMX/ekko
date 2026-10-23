import { useState, type ComponentRef, type ReactNode, type Ref } from "react";
import { Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { StatusIcon } from "./StatusIcon";
import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";

// Shared box look for every field (TextField, PasswordField, DateField).
// Border priority: error > focus (navy) > none.
export function fieldBoxStyle(hasError: boolean, focused = false): ViewStyle {
  return {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.field,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: hasError ? colors.error : focused ? colors.navy : "transparent",
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
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xs }}>
      <StatusIcon variant="error" color={colors.error} size={18} />
      <Text
        selectable
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[textStyles.secondary, { flex: 1, color: colors.error }]}
      >
        {error}
      </Text>
    </View>
  );
}

export type TextFieldProps = Omit<TextInputProps, "style" | "accessibilityLabel"> & {
  label: string;
  error?: string;
  /** Hint under the field; replaced by `error` when there is one. */
  helper?: string;
  // Trailing control inside the field box (e.g. PasswordField's "Mostrar").
  accessory?: ReactNode;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

export function TextField({ label, error, helper, accessory, ref, accessibilityHint, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: spacing.sm }}>
      <FieldLabel>{label}</FieldLabel>
      <View style={fieldBoxStyle(!!error, focused)}>
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
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        {accessory}
      </View>
      <FieldError error={error} />
      {helper && !error ? (
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
