export type RecoveryLink =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "code"; code: string }
  | { kind: "tokens"; accessToken: string; refreshToken: string };

type RouteParams = Record<string, string | string[] | undefined>;

/**
 * F-05 deep link, from Expo Router's params (the URL fragment arrives under "#"). PKCE puts
 * `code` in the query; the implicit flow puts the tokens in the fragment; Supabase reports
 * expired/invalid links as `error`/`error_code` in either place.
 */
export function parseRecoveryParams(routeParams: RouteParams): RecoveryLink {
  const { "#": fragment, ...query } = routeParams;
  const params = new Map<string, string | string[] | undefined>(Object.entries(query));
  if (typeof fragment === "string") new URLSearchParams(fragment).forEach((value, key) => params.set(key, value));

  if (params.has("error") || params.has("error_code")) return { kind: "invalid" };
  const code = params.get("code");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (code === undefined && accessToken === undefined && refreshToken === undefined) return { kind: "none" };
  if (typeof code === "string" && code) return { kind: "code", code };
  if (typeof accessToken === "string" && accessToken && typeof refreshToken === "string" && refreshToken) {
    return { kind: "tokens", accessToken, refreshToken };
  }
  return { kind: "invalid" };
}
