import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { BrandPattern } from "./BrandPattern";

export type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  testID?: string;
};

export function AuthLayout({ title, subtitle, children, footer, testID }: AuthLayoutProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      testID={testID}
      // WHY: Android already resizes the window for the keyboard (adjustResize).
      // WHY: Android is edge-to-edge since SDK 53, so the window no longer resizes for the keyboard;
      // without padding on both platforms the keyboard hides the submit button (seen on the emulator).
      behavior="padding"
      style={{ flex: 1, backgroundColor: colors.bgBrand }}
    >
      <StatusBar style="light" />
      {/* WHY: flex 3:7 keeps the brand area at 30% of whatever height is left, so it shrinks
          with the keyboard open on 360×640 instead of pushing the form off screen. */}
      <View
        style={{
          flex: 3,
          paddingTop: insets.top,
          paddingHorizontal: spacing.xl,
          justifyContent: "center",
          alignItems: "center",
          gap: spacing.xs,
          overflow: "hidden",
        }}
      >
        <BrandPattern />
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} adjustsFontSizeToFit style={[textStyles.display, { color: colors.surface }]}>
          Ekko Rewards
        </Text>
        {subtitle ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={2} style={[textStyles.body, { color: colors.surface, textAlign: "center" }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          flex: 7,
          backgroundColor: colors.surface,
          // §4.1: the wide curve on the top corner of the sheet.
          borderTopLeftRadius: radii.sheet,
          borderCurve: "continuous",
          overflow: "hidden",
        }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            gap: spacing.xl,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing["2xl"],
            paddingBottom: spacing.xl + insets.bottom,
          }}
        >
          <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h1, { color: colors.textPrimary }]}>
            {title}
          </Text>
          <View style={{ gap: spacing.lg }}>{children}</View>
          {footer ? <View style={{ marginTop: "auto", alignItems: "center" }}>{footer}</View> : null}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
