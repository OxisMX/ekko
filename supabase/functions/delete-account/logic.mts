// Pure logic of delete-account. WHY dependency-free (no npm:/zod imports): the same file runs under the Deno
// edge runtime and under node:test in scripts/, so it must resolve without either toolchain's imports.

export const CONFIRMATION_WORD = "ELIMINAR";
export type DeleteAccountBody = { apple_authorization_code?: string };
export type ParseResult = { ok: true; value: DeleteAccountBody } | { ok: false; field: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Field names are the E-23 `details.field` of the response. A code is required only for Apple accounts (SP-3).
export function parseDeleteAccountBody(input: unknown, requiresAppleCode: boolean): ParseResult {
  if (!isRecord(input)) return { ok: false, field: "body" };
  if (input.confirmation !== CONFIRMATION_WORD) return { ok: false, field: "confirmation" };
  const code = input.apple_authorization_code;
  const hasCode = typeof code === "string" && code.trim().length > 0;
  if (code !== undefined && code !== null && typeof code !== "string") return { ok: false, field: "apple_authorization_code" };
  if (requiresAppleCode && !hasCode) return { ok: false, field: "apple_authorization_code" };
  return { ok: true, value: hasCode ? { apple_authorization_code: code.trim() } : {} };
}

// The caller is the native app, which sends no Origin header. A browser always sends one, so an Origin
// outside the allowlist means a web page is calling and gets no CORS headers.
export function isOriginAllowed(origin: string | null, allowed: readonly string[]): boolean {
  return origin === null || allowed.includes(origin);
}
