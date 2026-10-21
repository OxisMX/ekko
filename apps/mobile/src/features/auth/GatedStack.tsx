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
export function GatedStack({ route }: { route: GateRoute }) {
  const decided = route !== "loading";
  const redirectTo = decided ? HOME[route] : undefined;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!decided || route === "tabs"} redirectTo={redirectTo}>
        <Stack.Screen name="(tabs)" />
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
