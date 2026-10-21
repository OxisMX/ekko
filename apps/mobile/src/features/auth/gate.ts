import type { AuthStatus } from "../../auth/AuthProvider";

export type GateRoute = "loading" | "auth" | "completeProfile" | "tabs";

export type GateInput = {
  status: AuthStatus;
  profile: { profile_complete: boolean } | undefined;
  profileFailed: boolean;
  // Register (A-03) saves the profile right after signUp; deciding before it lands would flash A-04.
  finishingSignUp: boolean;
};

/** F-01: which part of the app the current user may see. "loading" keeps the splash/current screen. */
export function decideGate({ status, profile, profileFailed, finishingSignUp }: GateInput): GateRoute {
  if (status === "loading") return "loading";
  if (status === "signedOut") return "auth";
  if (finishingSignUp) return "loading";
  if (profile) return profile.profile_complete ? "tabs" : "completeProfile";
  // WHY: fail closed. A-04 shows the load error with a retry instead of letting an unknown profile in.
  return profileFailed ? "completeProfile" : "loading";
}
