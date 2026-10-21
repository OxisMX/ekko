// Pure validation and row mapping for onboard-merchant.ts (US-27). No I/O here so it is testable.
import { z } from 'zod';

const httpsUrl = z.url({ protocol: /^https$/ });
const text = (max: number) => z.string().trim().min(1).max(max);
// Storage path (Backend §7); `{merchant_id}` is replaced with the generated id.
const storagePath = z.string().regex(/^merchants\/[\w{}./-]+$/).refine((p) => !p.includes('..'));

export const merchantInputSchema = z.strictObject({
  name: text(40),
  category: z.enum([
    'restaurantes', 'cafeterias_postres', 'bares_snacks', 'barberias', 'belleza',
    'spas', 'deporte_salud', 'servicios', 'otros',
  ]),
  description: text(140),
  address: text(200),
  maps_url: httpsUrl,
  reviews_url: httpsUrl,
  logo_path: storagePath,
  cover_path: storagePath,
  birthday_benefit: text(140).optional(),
  billing_period: z.enum(['quarterly', 'annual']),
  paid_until: z.iso.date(),
  email: z.email(),
  password: z.string().min(12),
  pin: z.string().regex(/^\d{4}$/),
  loyalty_program: z.strictObject({
    stamps_required: z.int().min(4).max(10),
    cycle_months: z.int().min(3).max(12),
    reward_title: text(60),
    reward_description: text(200),
    terms: text(1000),
  }),
  push_coupon_validity_hours: z.int().min(24).max(48).default(48),
  wheel_prizes: z.array(z.strictObject({
    label: text(30),
    prize_type: z.enum(['coupon', 'extra_stamp']),
    benefit_title: text(60),
    benefit_description: text(200),
    weight: z.int().positive(),
  })).min(1),
});

export type MerchantInput = z.infer<typeof merchantInputSchema>;

export type ParseResult = { ok: true; data: MerchantInput } | { ok: false; errors: string[] };

// Errors are "field.path: message". Zod messages describe the rule, never the value, so the PIN
// and password cannot leak through them.
export function parseMerchantInput(raw: unknown): ParseResult {
  const result = merchantInputSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    errors: result.error.issues.flatMap((issue) => {
      const base = issue.path.map(String);
      const paths = issue.code === 'unrecognized_keys' ? issue.keys.map((k) => [...base, k]) : [base];
      return paths.map((p) => `${p.join('.') || '(root)'}: ${issue.message}`);
    }),
  };
}

// Rows to insert. Deliberately excludes pin and password: they go straight to their sinks
// (crypt() in SQL, the Auth admin API) and must never end up in something that gets printed.
export function buildOnboardingPlan(input: MerchantInput, merchantId: string) {
  const path = (p: string) => p.replaceAll('{merchant_id}', merchantId);
  return {
    authUser: {
      email: input.email,
      app_metadata: { role: 'merchant', merchant_id: merchantId },
    },
    merchant: {
      id: merchantId,
      name: input.name,
      category: input.category,
      description: input.description,
      address: input.address,
      logo_path: path(input.logo_path),
      cover_path: path(input.cover_path),
      maps_url: input.maps_url,
      reviews_url: input.reviews_url,
      birthday_benefit: input.birthday_benefit ?? null,
      push_coupon_validity_hours: input.push_coupon_validity_hours,
      // F-30 step 6: visible only after training.
      is_visible: false,
      is_active: true,
      subscription_status: 'active',
      billing_period: input.billing_period,
      paid_until: input.paid_until,
    },
    loyaltyProgram: { merchant_id: merchantId, ...input.loyalty_program },
    wheelPrizes: input.wheel_prizes.map((prize, i) => ({ merchant_id: merchantId, ...prize, position: i + 1 })),
  };
}

export type OnboardingPlan = ReturnType<typeof buildOnboardingPlan>;
