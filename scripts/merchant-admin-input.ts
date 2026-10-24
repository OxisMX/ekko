// Pure argument validation and plans for set-merchant-status.ts and reset-pin.ts (F-31..F-33). No I/O.
import { randomInt } from 'node:crypto';
import { parseArgs } from 'node:util';
import { z } from 'zod';

// A merchant is addressed by its panel login email or by its id.
const merchantRef = z.union([z.uuid(), z.email()]);
const flag = z.enum(['true', 'false']).transform((v) => v === 'true');

const statusArgs = z.strictObject({
  merchant: merchantRef,
  status: z.enum(['active', 'inactive']),
  'paid-until': z.iso.date().optional(),
  visible: flag.optional(),
});
const resetPinArgs = z.strictObject({
  merchant: merchantRef,
  pin: z.string().regex(/^\d{4}$/).optional(),
});

const revokeSessionsArgs = z.strictObject({ merchant: merchantRef });

export type Parsed<T> = { ok: true; data: T } | { ok: false; errors: string[] };

// Messages describe the rule, never the value, so a --pin typo cannot leak into the output.
function parse<T>(schema: z.ZodType<T>, argv: string[], options: Record<string, { type: 'string' }>): Parsed<T> {
  let values: Record<string, unknown>;
  try {
    values = parseArgs({ args: argv, options, strict: true, allowPositionals: false }).values;
  } catch (e) {
    return { ok: false, errors: [(e as Error).message.split(/[.:]/)[0]!] };
  }
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => `--${i.path.join('.') || 'args'}: ${i.message}`),
  };
}

export type StatusPlan = {
  merchantRef: string;
  changes: { is_active: boolean; subscription_status: 'active' | 'inactive'; is_visible?: boolean; paid_until?: string };
  closeAdminSessions: boolean;
};

// today = YYYY-MM-DD (UTC). F-32: reactivation needs a future paid_until.
export function parseStatusArgs(argv: string[], today: string): Parsed<StatusPlan> {
  const parsed = parse(statusArgs, argv, {
    merchant: { type: 'string' }, status: { type: 'string' }, 'paid-until': { type: 'string' }, visible: { type: 'string' },
  });
  if (!parsed.ok) return parsed;
  const { merchant, status, 'paid-until': paidUntil, visible } = parsed.data;

  if (status === 'active') {
    if (!paidUntil) return { ok: false, errors: ['--paid-until: required with --status active (F-32)'] };
    if (paidUntil <= today) return { ok: false, errors: ['--paid-until: must be a future date'] };
    return {
      ok: true,
      data: {
        merchantRef: merchant,
        // WHY default visible: inactivation hid it (RN-71); reactivation restores operation (F-32).
        changes: { is_active: true, subscription_status: 'active', paid_until: paidUntil, is_visible: visible ?? true },
        closeAdminSessions: false,
      },
    };
  }
  if (paidUntil) return { ok: false, errors: ['--paid-until: only valid with --status active'] };
  if (visible) return { ok: false, errors: ['--visible: an inactive merchant cannot be visible (RN-71)'] };
  // WHY is_visible=false: list_merchants filters by is_visible only, so this is what makes it vanish from the catalog (RN-71).
  return {
    ok: true,
    data: { merchantRef: merchant, changes: { is_active: false, subscription_status: 'inactive', is_visible: false }, closeAdminSessions: true },
  };
}

export type ResetPinPlan = { merchantRef: string; pin: string; generated: boolean };

// WHY randomInt: CSPRNG, uniform (no modulo bias). Injectable so tests are deterministic.
export function generatePin(rand: (max: number) => number = randomInt): string {
  return String(rand(10000)).padStart(4, '0');
}

export function parseResetPinArgs(argv: string[], rand?: (max: number) => number): Parsed<ResetPinPlan> {
  const parsed = parse(resetPinArgs, argv, { merchant: { type: 'string' }, pin: { type: 'string' } });
  if (!parsed.ok) return parsed;
  const { merchant, pin } = parsed.data;
  return { ok: true, data: { merchantRef: merchant, pin: pin ?? generatePin(rand), generated: pin === undefined } };
}

export function parseRevokeSessionsArgs(argv: string[]): Parsed<{ merchantRef: string }> {
  const parsed = parse(revokeSessionsArgs, argv, { merchant: { type: 'string' } });
  return parsed.ok ? { ok: true, data: { merchantRef: parsed.data.merchant } } : parsed;
}

const reviewDemoArgs = z.strictObject({ merchant: merchantRef, customer: z.email() });

// prepare-review-demo.ts (App Review account): the customer is always addressed by its auth email.
export function parseReviewDemoArgs(argv: string[]): Parsed<{ merchantRef: string; customerEmail: string }> {
  const parsed = parse(reviewDemoArgs, argv, { merchant: { type: 'string' }, customer: { type: 'string' } });
  return parsed.ok ? { ok: true, data: { merchantRef: parsed.data.merchant, customerEmail: parsed.data.customer } } : parsed;
}
