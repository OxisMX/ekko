// Sign in with Apple token revocation (SP-3, Apple Guideline 5.1.1(v)). Dependency-free: Web Crypto + fetch only.

export type AppleConfig = { teamId: string; keyId: string; privateKey: string; clientId: string };
export type RevokeOutcome = "revoked" | "sub_mismatch" | "failed";

const APPLE_AUDIENCE = "https://appleid.apple.com";
const CLIENT_SECRET_TTL_SECONDS = 300;

export function readAppleConfig(env: { get(name: string): string | undefined }): AppleConfig | null {
  const teamId = env.get("APPLE_TEAM_ID");
  const keyId = env.get("APPLE_KEY_ID");
  const privateKey = env.get("APPLE_PRIVATE_KEY");
  const clientId = env.get("APPLE_CLIENT_ID");
  if (!teamId || !keyId || !privateKey || !clientId) return null;
  // WHY: secrets set from a shell often carry escaped newlines instead of real ones.
  return { teamId, keyId, privateKey: privateKey.replace(/\\n/g, "\n"), clientId };
}

export function buildClientSecretClaims(config: AppleConfig, nowSeconds: number) {
  return {
    iss: config.teamId,
    iat: nowSeconds,
    exp: nowSeconds + CLIENT_SECRET_TTL_SECONDS,
    aud: APPLE_AUDIENCE,
    sub: config.clientId,
  };
}

export function buildTokenRequestBody(config: AppleConfig, clientSecret: string, code: string): URLSearchParams {
  return new URLSearchParams({
    client_id: config.clientId, client_secret: clientSecret, code, grant_type: "authorization_code",
  });
}

export function buildRevokeRequestBody(config: AppleConfig, clientSecret: string, refreshToken: string): URLSearchParams {
  return new URLSearchParams({
    client_id: config.clientId, client_secret: clientSecret, token: refreshToken, token_type_hint: "refresh_token",
  });
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

const encodeJson = (value: unknown) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));

// ES256 JWT. WHY no library: subtle.sign for ECDSA already returns the raw r||s form JWS expects.
export async function signClientSecret(config: AppleConfig, nowSeconds: number): Promise<string> {
  const der = base64UrlDecode(
    config.privateKey.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "").replace(/\+/g, "-").replace(/\//g, "_"),
  );
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signingInput = `${encodeJson({ alg: "ES256", kid: config.keyId, typ: "JWT" })}.${encodeJson(buildClientSecretClaims(config, nowSeconds))}`;
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

// No signature check: the id_token comes straight from Apple over TLS as the answer to our own exchange (SP-3).
export function readIdTokenSubject(idToken: unknown): string | null {
  if (typeof idToken !== "string") return null;
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as { sub?: unknown };
    return typeof claims.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
}

async function postForm(path: string, body: URLSearchParams, fetchFn: typeof fetch): Promise<Response> {
  return await fetchFn(`${APPLE_AUDIENCE}/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

// Exchanges the one-use code, checks the Apple account is the caller's (prevents revoking someone else's grant),
// then revokes the refresh token. A failure never throws: SP-3 says the account is deleted anyway.
export async function revokeAppleAccess(
  code: string, expectedSubject: string, config: AppleConfig, nowSeconds: number, fetchFn: typeof fetch = fetch,
): Promise<RevokeOutcome> {
  try {
    const clientSecret = await signClientSecret(config, nowSeconds);
    const exchange = await postForm("token", buildTokenRequestBody(config, clientSecret, code), fetchFn);
    if (!exchange.ok) return "failed";
    const tokens = (await exchange.json()) as { id_token?: unknown; refresh_token?: unknown };
    if (readIdTokenSubject(tokens.id_token) !== expectedSubject) return "sub_mismatch";
    if (typeof tokens.refresh_token !== "string") return "failed";
    const revoke = await postForm("revoke", buildRevokeRequestBody(config, clientSecret, tokens.refresh_token), fetchFn);
    return revoke.ok ? "revoked" : "failed";
  } catch {
    return "failed";
  }
}
