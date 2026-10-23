import { ERRORS } from "@ekko/shared";
import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { isAppleSignInAvailable, signInWithApple, signInWithGoogle, type SocialResult } from "../../features/auth/socialSignIn";
import { reportError } from "../../lib/sentry";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { FormMessage } from "../ui";

type Provider = "google" | "apple";
const SIGN_IN: Record<Provider, () => Promise<SocialResult>> = { google: signInWithGoogle, apple: signInWithApple };

// Official Google "G" mark colors (branding guidelines).
function GoogleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no">
      <Path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <Path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
      <Path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.9 6.1C6.5 42.6 14.600 48 24 48z" />
    </Svg>
  );
}

/** A-02 / A-03 (brief §4.2): Google and Apple with equal prominence, plus the "o" divider below them. */
export function SocialButtons({ testIDPrefix }: { testIDPrefix: string }) {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [failed, setFailed] = useState<Provider | null>(null);

  useEffect(() => {
    void isAppleSignInAvailable().then(setAppleAvailable, reportError);
  }, []);

  const run = async (provider: Provider) => {
    if (busy) return;
    setBusy(provider);
    setFailed(null);
    try {
      await SIGN_IN[provider]();
    } catch (error) {
      reportError(error);
      setFailed(provider);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      {failed ? (
        <FormMessage variant="error" message={ERRORS["E-21"].message} actionLabel="Reintentar" onAction={() => void run(failed)} testID={`${testIDPrefix}-social-error`} />
      ) : null}
      <Pressable
        onPress={() => void run("google")}
        disabled={busy !== null}
        accessibilityRole="button"
        accessibilityLabel="Continuar con Google"
        accessibilityState={{ disabled: busy !== null, busy: busy === "google" }}
        testID={`${testIDPrefix}-google`}
        style={({ pressed }) => ({
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          borderRadius: radii.button,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: "#747775",
          backgroundColor: "#FFFFFF",
          opacity: busy !== null && busy !== "google" ? 0.4 : pressed ? 0.8 : 1,
        })}
      >
        <GoogleLogo />
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { fontFamily: fontFamily.semibold, color: "#1F1F1F" }]}>
          Continuar con Google
        </Text>
      </Pressable>
      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radii.button}
          onPress={() => void run("apple")}
          accessibilityLabel="Continuar con Apple"
          testID={`${testIDPrefix}-apple`}
          style={{ height: 48, opacity: busy !== null && busy !== "apple" ? 0.4 : 1 }}
        />
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ flex: 1, height: 1, backgroundColor: colors.surfaceCard }} />
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textSecondary }]}>
          o
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.surfaceCard }} />
      </View>
    </View>
  );
}
