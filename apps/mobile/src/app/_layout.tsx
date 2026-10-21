import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { AuthProvider, useAuth } from "../auth/AuthProvider";
import { enforceImageCacheLimit } from "../lib/imageCache";
import { queryClient } from "../lib/queryClient";
import { initSentry, wrapRootComponent } from "../lib/sentry";
import { fontAssets } from "../theme";

initSentry();
// WHY: keep the splash until the stored session is known, so the first screen is never wrong (F-01).
void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status } = useAuth();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // NOTE: a font error falls back to the system font instead of blocking the app.
  const ready = status !== "loading" && (fontsLoaded || fontError !== null);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // WHY: Expo Router needs the navigator mounted on the first render (deep links like /v/:token, F-09);
  // the splash screen covers it until `ready`.
  return <Stack screenOptions={{ headerShown: false }} />;
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
