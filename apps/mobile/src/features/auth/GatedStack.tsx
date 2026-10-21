import { type Href, Stack } from "expo-router";

import type { GateRoute } from "./gate";

const HOME: Record<Exclude<GateRoute, "loading">, Href> = {
  auth: "/login",
  completeProfile: "/complete-profile",
  tabs: "/",
};

/**
 * F-01 navigation gate. Stack.Protected removes the screens the user may not see, so deep links
 * cannot bypass it. While "loading" every group stays mounted so a cold-start deep link keeps
 * its target behind the splash; once decided, the others drop out and redirect to HOME.
 */
type GatedStackProps = {
  route: GateRoute;
  // F-02 K: a fresh email sign-up enters through A-05 instead of Explorar.
  afterSignUp?: boolean;
};

export function GatedStack({ route, afterSignUp = false }: GatedStackProps) {
  const decided = route !== "loading";
  const redirectTo = !decided ? undefined : route === "tabs" && afterSignUp ? "/verify-email" : HOME[route];
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!decided || route === "tabs"} redirectTo={redirectTo}>
        <Stack.Screen name="(tabs)" />
        {/* WHY: pushed over the tab bar (own header, back to the tab) yet behind the same guard. */}
        <Stack.Screen name="merchant/[id]" />
        <Stack.Screen name="verify-email" />
      </Stack.Protected>
      <Stack.Protected guard={!decided || route === "completeProfile"} redirectTo={redirectTo}>
        <Stack.Screen name="complete-profile" />
      </Stack.Protected>
      <Stack.Protected guard={!decided || route === "auth"} redirectTo={redirectTo}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      {/* WHY: unguarded — the recovery link signs the user in, and they must stay here to set the password (F-05). */}
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
