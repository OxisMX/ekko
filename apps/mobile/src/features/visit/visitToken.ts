// TRD §9 / backend: visit tokens are 22 base64url chars (128 bits).
const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

// WHY: dev builds point at the local panel (`pnpm dev`), staging/prod at the real domains.
export const APP_URL = (process.env.EXPO_PUBLIC_APP_URL || "http://localhost:5173").replace(/\/+$/, "");

export function isVisitToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}

/**
 * TC-051: only Ekko visit URLs yield a token; anything else is "not Ekko" and never reaches the
 * server. NOTE: plain string checks instead of `URL`, whose React Native polyfill lacks most getters.
 */
export function parseVisitToken(raw: string, appUrl = APP_URL): string | null {
  const value = raw.trim();
  const prefixes = ["https://ekko.oxis.mx/v/", "https://staging.ekko.oxis.mx/v/", `${appUrl}/v/`, "ekko://v/"];
  const prefix = prefixes.find((p) => value.startsWith(p)) ?? value.match(/^exp:\/\/[^/?#]+\/--\/v\//)?.[0];
  if (!prefix) return null;
  const token = value.slice(prefix.length);
  return isVisitToken(token) ? token : null;
}
