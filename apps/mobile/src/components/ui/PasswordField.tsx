import { useState } from "react";
import { Pressable, Text } from "react-native";
import { colors, fontFamily, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";
import { TextField, type TextFieldProps } from "./TextField";

export type PasswordFieldProps = Omit<TextFieldProps, "secureTextEntry" | "accessory" | "textContentType" | "autoComplete"> & {
  // "password" for login, "newPassword"/"new-password" for sign-up so the OS offers a strong password.
  textContentType?: "password" | "newPassword";
  autoComplete?: "password" | "new-password" | "current-password";
};

export function PasswordField({ textContentType = "password", autoComplete = "password", ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      secureTextEntry={!visible}
      textContentType={textContentType}
      autoComplete={autoComplete}
      autoCapitalize="none"
      autoCorrect={false}
      accessory={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          // RT-04: 44 pt target.
          style={({ pressed }) => ({
            minHeight: 44,
            minWidth: 44,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: spacing.md,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={[textStyles.secondary, { fontFamily: fontFamily.semibold, color: colors.textPrimary }]}
          >
            {visible ? "Ocultar" : "Mostrar"}
          </Text>
        </Pressable>
      }
    />
  );
}
