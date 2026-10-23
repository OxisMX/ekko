import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { supabase } from "../../lib/supabase";

// ADR-15. "cancelled" is a normal outcome (F-03 C: back to A-02 silently); any failure throws.
export type SocialResult = "signedIn" | "cancelled";

const APPLE_CANCELLED = "ERR_REQUEST_CANCELED";
const isAppleCancel = (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === APPLE_CANCELLED;

type GoogleDeps = {
  auth: Pick<typeof supabase.auth, "signInWithOAuth" | "exchangeCodeForSession">;
  openAuthSession: typeof WebBrowser.openAuthSessionAsync;
  redirectTo: () => string;
};

const googleDeps = (): GoogleDeps => ({
  auth: supabase.auth,
  openAuthSession: WebBrowser.openAuthSessionAsync,
  // NOTE: exp://… in Expo Go, ekko://auth/callback in builds; both are whitelisted in Supabase.
  redirectTo: () => Linking.createURL("auth/callback"),
});

export async function signInWithGoogle(deps: GoogleDeps = googleDeps()): Promise<SocialResult> {
  const redirectTo = deps.redirectTo();
  const { data, error } = await deps.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } });
  if (error) throw error;
  const result = await deps.openAuthSession(data.url, redirectTo);
  if (result.type !== "success") return "cancelled";
  // WHY: PKCE returns ?code=… ; an error redirect (?error=…) carries no code.
  const code = new URL(result.url).searchParams.get("code");
  if (!code) throw new Error("OAuth callback without code");
  const { error: exchangeError } = await deps.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  return "signedIn";
}

type AppleDeps = {
  apple: Pick<typeof AppleAuthentication, "isAvailableAsync" | "signInAsync">;
  auth: Pick<typeof supabase.auth, "signInWithIdToken">;
  randomNonce: () => string;
  sha256: (value: string) => Promise<string>;
  platform: string;
};

const appleDeps = (): AppleDeps => ({
  apple: AppleAuthentication,
  auth: supabase.auth,
  randomNonce: () => Array.from(Crypto.getRandomBytes(32), (byte) => byte.toString(16).padStart(2, "0")).join(""),
  sha256: (value) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
  platform: Platform.OS,
});

export async function isAppleSignInAvailable(deps: Pick<AppleDeps, "apple" | "platform"> = appleDeps()): Promise<boolean> {
  return deps.platform === "ios" && (await deps.apple.isAvailableAsync());
}

// WHY: Apple sends the name only on the first authorization. A-04 reads it to prefill the form
// (the backend profile has no name yet); read (not consumed: StrictMode re-runs initializers), cleared on sign-out so it never reaches the next user.
let pendingName: { first_name: string; last_name: string } | null = null;
export const getSocialNameDraft = () => {
  const draft = pendingName;
  pendingName = null;
  return draft;
};
export const clearSocialNameDraft = () => {
  pendingName = null;
};

export async function signInWithApple(deps: AppleDeps = appleDeps()): Promise<SocialResult> {
  const rawNonce = deps.randomNonce();
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await deps.apple.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: await deps.sha256(rawNonce),
    });
  } catch (error) {
    if (isAppleCancel(error)) return "cancelled";
    throw error;
  }
  if (!credential.identityToken) throw new Error("Apple sign-in without identity token");
  const { error } = await deps.auth.signInWithIdToken({ provider: "apple", token: credential.identityToken, nonce: rawNonce });
  if (error) throw error;
  const { givenName, familyName } = credential.fullName ?? {};
  if (givenName || familyName) pendingName = { first_name: givenName ?? "", last_name: familyName ?? "" };
  return "signedIn";
}

/** F-15: fresh Apple authorization so the backend can revoke the token. null = user cancelled. */
export async function requestAppleAuthorizationCode(apple: Pick<typeof AppleAuthentication, "signInAsync"> = AppleAuthentication): Promise<string | null> {
  try {
    const credential = await apple.signInAsync({ requestedScopes: [] });
    if (!credential.authorizationCode) throw new Error("Apple re-authentication without authorization code");
    return credential.authorizationCode;
  } catch (error) {
    if (isAppleCancel(error)) return null;
    throw error;
  }
}
