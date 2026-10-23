import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";
import { BrandPattern } from "../auth/BrandPattern";

// Same brand look as the login header: dark background with the navy circles behind the title.
export function AppHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="app-header"
      style={{ backgroundColor: colors.bgBrand, overflow: "hidden", paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl, paddingHorizontal: spacing.xl }}
    >
      <BrandPattern />
      <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={[textStyles.h1, { color: colors.surface }]}>
        {title}
      </Text>
    </View>
  );
}
