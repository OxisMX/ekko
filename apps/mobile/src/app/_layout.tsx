import { QueryClientProvider, useIsMutating } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { AuthProvider, useAuth } from "../auth/AuthProvider";
import { REGISTER_MUTATION_KEY, useJustSignedUp, useMyProfile } from "../features/auth/account";
import { useRegisterDeviceOnce } from "../features/auth/deviceRegistration";
import { useEnsureBirthdayCouponsOnce } from "../features/birthday/birthdayCoupons";
import { decideGate } from "../features/auth/gate";
import { GatedStack } from "../features/auth/GatedStack";
import { usePendingVisitRedirect } from "../features/visit/pendingVisit";
import { enforceImageCacheLimit } from "../lib/imageCache";
import { queryClient } from "../lib/queryClient";
import { toAppError } from "../lib/appError";
import { initSentry, wrapRootComponent } from "../lib/sentry";
import { fontAssets } from "../theme";

initSentry();
// WHY: keep the splash until the stored session and the profile are known, so the first screen is never wrong (F-01).
void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status, session, endSession } = useAuth();
  const profile = useMyProfile();
  const finishingSignUp = useIsMutating({ mutationKey: REGISTER_MUTATION_KEY }) > 0;
  const justSignedUp = useJustSignedUp();
  const route = decideGate({ status, profile: profile.data, profileFailed: profile.isError, finishingSignUp });
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // NOTE: a font error falls back to the system font instead of blocking the app.
  const fontsReady = fontsLoaded || fontError !== null;
  const ready = route !== "loading" && fontsReady;

  useRegisterDeviceOnce(route === "tabs" ? (session?.user.id ?? null) : null);
  useEnsureBirthdayCouponsOnce(route === "tabs" ? (session?.user.id ?? null) : null);
  usePendingVisitRedirect(route);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // WHY: a still-valid JWT can outlive its account (deleted on another device, US-05) or role; the
  // server answers E-18/E-19 and the user must land on A-02 with the reason, not on a stuck A-04.
  const profileErrorCode = profile.error ? toAppError(profile.error).code : null;
  useEffect(() => {
    if (profileErrorCode === "E-18" || profileErrorCode === "E-19") endSession(profileErrorCode);
  }, [profileErrorCode, endSession]);

  // WHY: text measured with the system font is not re-measured on Android when DM Sans arrives, so the
  // last glyph gets clipped ("Entrai"). Fonts load from the bundle in milliseconds; the auth/profile
  // wait stays behind the splash with the navigator mounted, so deep links (F-09) still resolve.
  if (!fontsReady) return null;
  return <GatedStack route={route} afterSignUp={justSignedUp} />;
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
