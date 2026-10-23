import { isAppleSignInAvailable, getSocialNameDraft, requestAppleAuthorizationCode, signInWithApple, signInWithGoogle } from "./socialSignIn";

jest.mock("../../lib/supabase", () => ({ supabase: { auth: {} } }));
jest.mock("expo-apple-authentication", () => ({ AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 } }));
jest.mock("expo-crypto", () => ({}));
jest.mock("expo-linking", () => ({}));
jest.mock("expo-web-browser", () => ({}));

const REDIRECT = "ekko://auth/callback";

function googleDeps(browser: unknown) {
  const auth = {
    signInWithOAuth: jest.fn().mockResolvedValue({ data: { url: "https://accounts.google.test/auth" }, error: null }),
    exchangeCodeForSession: jest.fn().mockResolvedValue({ error: null }),
  };
  const openAuthSession = jest.fn().mockResolvedValue(browser);
  return { auth, openAuthSession, redirectTo: () => REDIRECT } as unknown as Parameters<typeof signInWithGoogle>[0] & {
    auth: typeof auth;
    openAuthSession: typeof openAuthSession;
  };
}

describe("signInWithGoogle", () => {
  it("opens the OAuth session and exchanges the returned code", async () => {
    const deps = googleDeps({ type: "success", url: `${REDIRECT}?code=abc123` });
    await expect(signInWithGoogle(deps)).resolves.toBe("signedIn");
    expect(deps.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: REDIRECT, skipBrowserRedirect: true } });
    expect(deps.openAuthSession).toHaveBeenCalledWith("https://accounts.google.test/auth", REDIRECT);
    expect(deps.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc123");
  });

  it.each(["cancel", "dismiss"])("is silent when the browser is %s", async (type) => {
    const deps = googleDeps({ type });
    await expect(signInWithGoogle(deps)).resolves.toBe("cancelled");
    expect(deps.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("fails when the callback has no code", async () => {
    const deps = googleDeps({ type: "success", url: `${REDIRECT}?error=access_denied` });
    await expect(signInWithGoogle(deps)).rejects.toThrow();
    expect(deps.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("fails when Supabase cannot start the OAuth flow or exchange the code", async () => {
    const start = googleDeps({ type: "cancel" });
    start.auth.signInWithOAuth.mockResolvedValue({ data: null, error: new Error("provider off") });
    await expect(signInWithGoogle(start)).rejects.toThrow("provider off");
    const exchange = googleDeps({ type: "success", url: `${REDIRECT}?code=x` });
    exchange.auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });
    await expect(signInWithGoogle(exchange)).rejects.toThrow("bad code");
  });
});

function appleDeps(overrides: { signInAsync?: jest.Mock; platform?: string; available?: boolean } = {}) {
  const apple = {
    isAvailableAsync: jest.fn().mockResolvedValue(overrides.available ?? true),
    signInAsync: overrides.signInAsync ?? jest.fn().mockResolvedValue({ identityToken: "id-token", fullName: { givenName: "Ana", familyName: "Pérez" } }),
  };
  const auth = { signInWithIdToken: jest.fn().mockResolvedValue({ error: null }) };
  return { apple, auth, randomNonce: () => "raw-nonce", sha256: async (v: string) => `hash(${v})`, platform: overrides.platform ?? "ios" } as unknown as Parameters<typeof signInWithApple>[0] & {
    apple: typeof apple;
    auth: typeof auth;
  };
}

describe("Apple", () => {
  it("is available only on iOS and when the device supports it", async () => {
    await expect(isAppleSignInAvailable(appleDeps())).resolves.toBe(true);
    await expect(isAppleSignInAvailable(appleDeps({ platform: "android" }))).resolves.toBe(false);
    await expect(isAppleSignInAvailable(appleDeps({ available: false }))).resolves.toBe(false);
  });

  it("sends the hashed nonce to Apple and the raw nonce to Supabase, and keeps the first-sign-in name", async () => {
    const deps = appleDeps();
    await expect(signInWithApple(deps)).resolves.toBe("signedIn");
    expect(deps.apple.signInAsync).toHaveBeenCalledWith(expect.objectContaining({ nonce: "hash(raw-nonce)" }));
    expect(deps.auth.signInWithIdToken).toHaveBeenCalledWith({ provider: "apple", token: "id-token", nonce: "raw-nonce" });
    expect(getSocialNameDraft()).toEqual({ first_name: "Ana", last_name: "Pérez" });
  });

  it("is silent when the user cancels", async () => {
    const deps = appleDeps({ signInAsync: jest.fn().mockRejectedValue({ code: "ERR_REQUEST_CANCELED" }) });
    await expect(signInWithApple(deps)).resolves.toBe("cancelled");
    expect(deps.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it("propagates other Apple errors and Supabase errors", async () => {
    await expect(signInWithApple(appleDeps({ signInAsync: jest.fn().mockRejectedValue({ code: "ERR_REQUEST_FAILED" }) }))).rejects.toBeDefined();
    const deps = appleDeps();
    deps.auth.signInWithIdToken.mockResolvedValue({ error: new Error("rejected") });
    await expect(signInWithApple(deps)).rejects.toThrow("rejected");
  });

  it("re-authentication returns the authorization code, or null on cancel", async () => {
    await expect(requestAppleAuthorizationCode({ signInAsync: jest.fn().mockResolvedValue({ authorizationCode: "auth-code" }) })).resolves.toBe("auth-code");
    await expect(requestAppleAuthorizationCode({ signInAsync: jest.fn().mockRejectedValue({ code: "ERR_REQUEST_CANCELED" }) })).resolves.toBeNull();
  });
});
