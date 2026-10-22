// Pure logic of send-push. WHY dependency-free (no npm:/zod imports): the same file runs under the Deno
// edge runtime and under node:test in scripts/, so it must resolve without either toolchain's imports.

export type SendPushBody = {
  idempotency_key: string;
  title: string;
  body: string;
  coupon?: { title: string; description: string; terms: string; validity_hours: number };
};
export type ParseResult = { ok: true; value: SendPushBody } | { ok: false; field: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EXPO_BATCH_SIZE = 100;

function trimmedText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length >= min && text.length <= max ? text : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Field names match the E-23 `details.field` of create_push_campaign.
export function parseSendPushBody(input: unknown): ParseResult {
  if (!isRecord(input)) return { ok: false, field: "body" };
  const key = input.idempotency_key;
  if (typeof key !== "string" || !UUID.test(key)) return { ok: false, field: "idempotency_key" };
  const title = trimmedText(input.title, 1, 50);
  if (title === null) return { ok: false, field: "title" };
  const body = trimmedText(input.body, 1, 150);
  if (body === null) return { ok: false, field: "body" };

  const value: SendPushBody = { idempotency_key: key.toLowerCase(), title, body };
  if (input.coupon === undefined || input.coupon === null) return { ok: true, value };
  if (!isRecord(input.coupon)) return { ok: false, field: "coupon_title" };

  const coupon = input.coupon;
  const couponTitle = trimmedText(coupon.title, 1, 60);
  if (couponTitle === null) return { ok: false, field: "coupon_title" };
  const description = trimmedText(coupon.description, 1, 200);
  if (description === null) return { ok: false, field: "coupon_description" };
  const terms = trimmedText(coupon.terms, 1, 1000);
  if (terms === null) return { ok: false, field: "coupon_terms" };
  const hours = coupon.validity_hours;
  if (typeof hours !== "number" || !Number.isInteger(hours) || hours < 24 || hours > 48) {
    return { ok: false, field: "coupon_validity_hours" };
  }
  value.coupon = { title: couponTitle, description, terms, validity_hours: hours };
  return { ok: true, value };
}

export function chunk<T>(items: readonly T[], size: number = EXPO_BATCH_SIZE): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

export type BatchOutcome = { sent: number; failed: number; invalidTokens: string[] };

// Expo answers `{ data: [ticket, ...] }` in the same order as the messages sent (TRD 7.4).
// A response that does not line up with the batch counts every message as failed: we cannot tell which worked.
export function classifyTickets(tokens: readonly string[], response: unknown): BatchOutcome {
  const tickets = isRecord(response) && Array.isArray(response.data) ? (response.data as unknown[]) : null;
  if (tickets === null || tickets.length !== tokens.length) {
    return { sent: 0, failed: tokens.length, invalidTokens: [] };
  }
  const outcome: BatchOutcome = { sent: 0, failed: 0, invalidTokens: [] };
  tickets.forEach((ticket, index) => {
    if (isRecord(ticket) && ticket.status === "ok") {
      outcome.sent += 1;
      return;
    }
    outcome.failed += 1;
    const details = isRecord(ticket) && isRecord(ticket.details) ? ticket.details : null;
    const token = tokens[index];
    if (details?.error === "DeviceNotRegistered" && token !== undefined) outcome.invalidTokens.push(token);
  });
  return outcome;
}

export function sumOutcomes(outcomes: readonly BatchOutcome[]): BatchOutcome {
  return {
    sent: outcomes.reduce((total, o) => total + o.sent, 0),
    failed: outcomes.reduce((total, o) => total + o.failed, 0),
    invalidTokens: outcomes.flatMap((o) => o.invalidTokens),
  };
}

const HTTP_STATUS: Record<string, number> = { "E-05": 403, "E-16": 403, "E-17": 429, "E-19": 403, "E-23": 400 };

// PostgREST error from app.raise: message = "E-xx", details = JSON string (backend §3.1).
export function mapRpcError(error: { message?: string; details?: string | null }): {
  status: number;
  body: { error: string; details?: unknown };
} {
  const code = error.message ?? "";
  const status = HTTP_STATUS[code];
  if (status === undefined) return { status: 500, body: { error: "E-99" } };
  let details: unknown;
  try {
    details = error.details ? JSON.parse(error.details) : undefined;
  } catch {
    details = undefined; // WHY: details are optional hints; a malformed one must not hide the code.
  }
  return { status, body: details === undefined ? { error: code } : { error: code, details } };
}
