import { Pressable, Text } from "react-native";

import { colors, fontFamily, MAX_FONT_SCALE, textStyles } from "../../theme";

type TextLinkProps = { label: string; onPress: () => void; testID?: string; accessibilityRole?: "link" | "button" };

// NOTE: the UI kit has no text link yet; this mirrors FormMessage's action styling (44 pt target).
export function TextLink({ label, onPress, testID, accessibilityRole = "button" }: TextLinkProps) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole={accessibilityRole}
      style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", alignSelf: "center", opacity: pressed ? 0.6 : 1 })}
    >
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[textStyles.secondary, { fontFamily: fontFamily.semibold, color: colors.textPrimary, textDecorationLine: "underline" }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
