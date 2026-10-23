// Backend §5.2 / SP-3: account deletion. Called by the native customer app with the customer JWT.
// Order: validate -> Apple revocation (Apple accounts) -> anonymize_customer -> delete the Auth user.
// If the Auth deletion fails after anonymizing, the answer is 500 and the app retries: every step is idempotent.
import { createClient } from "npm:@supabase/supabase-js@2";
import { readAppleConfig, revokeAppleAccess } from "./apple.mts";
import { isOriginAllowed, parseDeleteAccountBody } from "./logic.mts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Same env var pattern as send-push; browsers only. The native app sends no Origin and needs no CORS.
const ALLOWED_ORIGINS = (Deno.env.get("APP_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const noSession = { persistSession: false, autoRefreshToken: false };
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: noSession });
const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: noSession });

function json(status: number, body: unknown, origin: string | null): Response {
  // WHY no "*": only an allowlisted browser origin gets CORS headers.
  const cors: Record<string, string> = origin !== null && ALLOWED_ORIGINS.includes(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" }
    : {};
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function handle(req: Request, origin: string | null): Promise<Response> {
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "E-18" }, origin);
  const { data: auth, error: authError } = await anon.auth.getClaims(jwt);
  const userId = auth?.claims?.sub;
  if (authError || !userId) return json(401, { error: "E-18" }, origin);

  const { data: customer } = await service.from("customers").select("id").eq("auth_user_id", userId).maybeSingle();
  if (!customer) return json(403, { error: "E-19" }, origin);

  const { data: userData, error: userError } = await service.auth.admin.getUserById(userId);
  if (userError || !userData.user) {
    console.error("delete-account: getUserById failed");
    return json(500, { error: "E-99" }, origin);
  }
  const appleIdentity = userData.user.identities?.find((identity) => identity.provider === "apple");

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return json(400, { error: "E-23", details: { field: "body" } }, origin);
  }
  const parsed = parseDeleteAccountBody(rawBody, appleIdentity !== undefined);
  if (!parsed.ok) return json(400, { error: "E-23", details: { field: parsed.field } }, origin);

  let appleRevoked: boolean | undefined;
  if (appleIdentity && parsed.value.apple_authorization_code) {
    const appleConfig = readAppleConfig(Deno.env);
    // WHY fail closed: without the key the grant would stay alive at Apple after we delete the account.
    if (!appleConfig) {
      console.error("delete-account: Apple secrets are not configured");
      return json(500, { error: "E-99" }, origin);
    }
    const subject = String(appleIdentity.identity_data?.sub ?? appleIdentity.id);
    const outcome = await revokeAppleAccess(
      parsed.value.apple_authorization_code, subject, appleConfig, Math.floor(Date.now() / 1000));
    if (outcome === "sub_mismatch") return json(403, { error: "E-19" }, origin);
    // SP-3 step 4: the code is single-use, so an Apple failure is reported and the deletion goes on.
    appleRevoked = outcome === "revoked";
    if (!appleRevoked) console.error("delete-account: apple revocation failed");
  }

  const anonymized = await service.rpc("anonymize_customer", { p_customer_id: customer.id });
  if (anonymized.error) {
    console.error("delete-account: anonymize_customer failed", anonymized.error.code);
    return json(500, { error: "E-99" }, origin);
  }
  const deleted = await service.auth.admin.deleteUser(userId);
  if (deleted.error) {
    console.error("delete-account: deleteUser failed", deleted.error.status);
    return json(500, { error: "E-99" }, origin);
  }
  return json(200, appleRevoked === undefined ? { deleted: true } : { deleted: true, apple_revoked: appleRevoked }, origin);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (!isOriginAllowed(origin, ALLOWED_ORIGINS)) return json(403, { error: "E-19" }, origin);
  if (req.method === "OPTIONS") return json(204, null, origin);
  if (req.method !== "POST") return json(405, { error: "E-99" }, origin);
  try {
    return await handle(req, origin);
  } catch (error) {
    console.error("delete-account: unexpected", error instanceof Error ? error.name : "unknown");
    return json(500, { error: "E-99" }, origin);
  }
});
