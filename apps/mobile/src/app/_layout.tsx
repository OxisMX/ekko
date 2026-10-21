import { QueryClientProvider, useIsMutating } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { AuthProvider, useAuth } from "../auth/AuthProvider";
import { REGISTER_MUTATION_KEY, useMyProfile } from "../features/auth/account";
import { useRegisterDeviceOnce } from "../features/auth/deviceRegistration";
import { decideGate } from "../features/auth/gate";
import { GatedStack } from "../features/auth/GatedStack";
import { enforceImageCacheLimit } from "../lib/imageCache";
import { queryClient } from "../lib/queryClient";
import { initSentry, wrapRootComponent } from "../lib/sentry";
import { fontAssets } from "../theme";

initSentry();
// WHY: keep the splash until the stored session and the profile are known, so the first screen is never wrong (F-01).
void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status, session } = useAuth();
  const profile = useMyProfile();
  const finishingSignUp = useIsMutating({ mutationKey: REGISTER_MUTATION_KEY }) > 0;
  const route = decideGate({ status, profile: profile.data, profileFailed: profile.isError, finishingSignUp });
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // NOTE: a font error falls back to the system font instead of blocking the app.
  const fontsReady = fontsLoaded || fontError !== null;
  const ready = route !== "loading" && fontsReady;

  useRegisterDeviceOnce(route === "tabs" ? (session?.user.id ?? null) : null);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // WHY: text measured with the system font is not re-measured on Android when DM Sans arrives, so the
  // last glyph gets clipped ("Entrai"). Fonts load from the bundle in milliseconds; the auth/profile
  // wait stays behind the splash with the navigator mounted, so deep links (F-09) still resolve.
  if (!fontsReady) return null;
  return <GatedStack route={route} />;
}

function RootLayout() {
  useEffect(() => {
    // Fire-and-forget: enforceImageCacheLimit never throws and must not block first render.
    void enforceImageCacheLimit();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default wrapRootComponent(RootLayout);
