import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { FieldError } from "./TextField";

const CODE_LENGTH = 6;
const BOX_HEIGHT = 56;

export type CodeFieldProps = {
  value: string;
  onChangeText: (code: string) => void;
  // Fired once each time the code goes from incomplete to 6 digits.
  onComplete: (code: string) => void;
  error?: string;
  editable?: boolean;
  autoFocus?: boolean;
  testID?: string;
};

// A-05: one real TextInput (so OS one-time-code autofill and paste work) drawn as 6 boxes.
export function CodeField({ value, onChangeText, onComplete, error, editable = true, autoFocus, testID }: CodeFieldProps) {
  const [focused, setFocused] = useState(false);

  function handleChange(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, CODE_LENGTH);
    onChangeText(digits);
    if (digits.length === CODE_LENGTH && value.length < CODE_LENGTH) onComplete(digits);
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "center" }}
        >
          {Array.from({ length: CODE_LENGTH }, (_, i) => {
            const active = focused && i === Math.min(value.length, CODE_LENGTH - 1);
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  maxWidth: 52,
                  height: BOX_HEIGHT,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radii.field,
                  borderCurve: "continuous",
                  borderWidth: 1.5,
                  borderColor: error ? colors.error : active ? colors.navy : "transparent",
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                <Text
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  // NOTE: textStyles.code is 32 pt; 28 keeps six boxes inside a 360 dp screen at 130% scale.
                  style={[textStyles.code, { fontSize: 28, lineHeight: 34, fontFamily: fontFamily.bold, color: colors.textPrimary }]}
                >
                  {value[i] ?? ""}
                </Text>
              </View>
            );
          })}
        </View>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={editable}
          autoFocus={autoFocus}
          // WHY: no maxLength — the OS would truncate a pasted "123 456" before the digit filter trims it to 6.
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          caretHidden
          accessibilityLabel="Código de verificación de 6 dígitos"
          accessibilityHint={error}
          // WHY: transparent input on top of the boxes receives taps, paste and autofill.
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, color: "transparent", fontSize: 1 }}
        />
      </View>
      <FieldError error={error} />
    </View>
  );
}
