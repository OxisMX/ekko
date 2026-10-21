import { parseRpcError, type RpcError } from "@ekko/shared";
import { isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";

import { reportError } from "./sentry";

// WHY: supabase-js reports a dropped connection differently per module (auth: AuthRetryableFetchError,
// PostgREST: an error object whose message is the fetch TypeError, raw fetch: TypeError).
const NETWORK_MESSAGE = /network request failed|failed to fetch|network error|timed? ?out/i;

/** Turns any supabase-js / PostgREST / fetch error into a catalogue code (AppFlow §7). */
export function toAppError(error: unknown): RpcError {
  if (isAuthRetryableFetchError(error)) return { code: "E-01", details: null };
  if (isAuthError(error)) {
    if (error.code === "user_already_exists" || error.code === "email_exists") return { code: "E-20", details: null };
    if (error.status === 429) return { code: "E-13", details: null };
  } else if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    if (NETWORK_MESSAGE.test(error.message)) return { code: "E-01", details: null };
    const details = "details" in error && typeof error.details === "string" ? error.details : null;
    const parsed = parseRpcError({ message: error.message, details });
    if (parsed.code !== "E-99") return parsed;
  }
  // E-99: unexpected, so Sentry gets the original error (AppFlow §7).
  reportError(error);
  return { code: "E-99", details: null };
}
