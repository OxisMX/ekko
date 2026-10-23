// Backend §5.1 / TRD §7.4: mass push campaign. The panel calls it with the merchant JWT.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type BatchOutcome,
  chunk,
  classifyTickets,
  mapRpcError,
  parseSendPushBody,
  sumOutcomes,
} from "./logic.mts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN");
const ALLOWED_ORIGINS = (Deno.env.get("PANEL_ORIGINS") ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const noSession = { persistSession: false, autoRefreshToken: false };
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: noSession });
const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: noSession });

function corsHeaders(origin: string | null): Record<string, string> {
  // WHY no "*": the endpoint is authenticated; only the configured panel origins get CORS headers.
  if (origin === null || !ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function sendBatch(messages: { to: string }[]): Promise<BatchOutcome> {
  const tokens = messages.map((m) => m.to);
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(messages),
    });
    if (!response.ok) return { sent: 0, failed: tokens.length, invalidTokens: [] };
    return classifyTickets(tokens, await response.json());
  } catch (error) {
    // Degrade gracefully (system-design): a failed batch is counted, the campaign still closes.
    console.error("send-push: expo batch failed", error instanceof Error ? error.name : "unknown");
    return { sent: 0, failed: tokens.length, invalidTokens: [] };
  }
}

async function handle(req: Request, cors: Record<string, string>): Promise<Response> {
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "E-18" }, cors);
  const { data: auth, error: authError } = await anon.auth.getClaims(jwt);
  const claims = auth?.claims;
  if (authError || !claims?.sub || typeof claims.session_id !== "string") return json(401, { error: "E-18" }, cors);

  const { data: merchant } = await service.from("merchants").select("id").eq("auth_user_id", claims.sub).maybeSingle();
  if (!merchant) return json(403, { error: "E-19" }, cors);

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return json(400, { error: "E-23", details: { field: "body" } }, cors);
  }
  const parsed = parseSendPushBody(rawBody);
  if (!parsed.ok) return json(400, { error: "E-23", details: { field: parsed.field } }, cors);
  const { idempotency_key, title, body, coupon } = parsed.value;

  const created = await service.rpc("create_push_campaign", {
    p_merchant_id: merchant.id,
    p_auth_session_id: claims.session_id,
    p_payload: { idempotency_key, title, body, coupon: coupon ?? null },
  });
  if (created.error) {
    const mapped = mapRpcError(created.error);
    if (mapped.status === 500) console.error("send-push: create_push_campaign failed", created.error.code);
    return json(mapped.status, mapped.body, cors);
  }
  const campaign = created.data as {
    campaign_id: string; recipients: number; duplicate: boolean; sent: number; failed: number;
    push_remaining_this_month: number;
  };
  const summary = (sent: number, failed: number, remaining: number) => ({
    campaign_id: campaign.campaign_id, recipients: campaign.recipients, sent, failed,
    push_remaining_this_month: remaining,
  });
  if (campaign.duplicate) {
    return json(200, summary(campaign.sent, campaign.failed, campaign.push_remaining_this_month), cors);
  }

  const recipients = await service.rpc("get_push_recipients", { p_campaign_id: campaign.campaign_id });
  if (recipients.error) {
    console.error("send-push: get_push_recipients failed", recipients.error.code);
    return json(500, { error: "E-99" }, cors);
  }
  const messages = (recipients.data as { coupon_id: string | null; token: string }[]).map((r) => ({
    to: r.token, title, body, sound: "default", channelId: "default",
    data: { merchant_id: merchant.id, coupon_id: r.coupon_id },
  }));
  const outcome = sumOutcomes(await Promise.all(chunk(messages).map(sendBatch)));

  const recorded = await service.rpc("record_push_result", {
    p_campaign_id: campaign.campaign_id, p_sent: outcome.sent, p_failed: outcome.failed,
    p_invalid_tokens: outcome.invalidTokens,
  });
  if (recorded.error) {
    console.error("send-push: record_push_result failed", recorded.error.code);
    return json(500, { error: "E-99" }, cors);
  }
  const result = recorded.data as { sent: number; failed: number; push_remaining_this_month: number };
  return json(200, summary(result.sent, result.failed, result.push_remaining_this_month), cors);
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "E-99" }, cors);
  try {
    return await handle(req, cors);
  } catch (error) {
    console.error("send-push: unexpected", error instanceof Error ? error.name : "unknown");
    return json(500, { error: "E-99" }, cors);
  }
});
