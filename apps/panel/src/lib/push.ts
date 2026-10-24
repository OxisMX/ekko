import { PUSH_COUPON_VALIDITY_OPTIONS } from '@ekko/shared'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabase } from './supabase'

export const PUSH_STATUS_KEY = ['push-status']
export const PUSH_CAMPAIGNS_KEY = ['push-campaigns']
// Limits mirror the send-push body contract (US-25, RN-46..RN-49).
export const PUSH_LIMITS = { title: 50, body: 150, couponTitle: 60, couponDescription: 200, couponTerms: 1000 } as const

export const pushStatusSchema = z.object({
  remaining_this_month: z.number(),
  limit: z.number(),
  resets_on: z.string(),
  recipients_count: z.number(),
  // Customers with push on and a live device (P-40); a coupon still reaches the rest through the app.
  eligible_recipients: z.number(),
  push_coupon_validity_hours: z.number(),
})
export type PushStatus = z.infer<typeof pushStatusSchema>

const campaignSchema = z.object({
  id: z.string(),
  title: z.string(),
  has_coupon: z.boolean(),
  status: z.enum(['sending', 'sent', 'failed']),
  recipients_count: z.number(),
  sent_count: z.number(),
  failed_count: z.number(),
  created_at: z.string(),
})
export type PushCampaign = z.infer<typeof campaignSchema>
export const toCampaigns = (raw: unknown): PushCampaign[] => z.array(campaignSchema).nullable().parse(raw) ?? []

export const sendResultSchema = z.object({ recipients: z.number(), sent: z.number(), failed: z.number(), push_remaining_this_month: z.number() })
export type SendResult = z.infer<typeof sendResultSchema>

export type PushForm = {
  title: string
  body: string
  withCoupon: boolean
  couponTitle: string
  couponDescription: string
  couponTerms: string
  couponHours: string
}
export type PushField = 'title' | 'body' | 'couponTitle' | 'couponDescription' | 'couponTerms' | 'couponHours'

const text = (label: string, max: number) => z.string().trim().min(1, `Escribe ${label}.`).max(max, `Máximo ${max} caracteres.`)
const hoursMessage = 'Vigencia: elige 6, 12, 24, 36 o 48 horas.'
const messageSchema = z.object({ title: text('el título', PUSH_LIMITS.title), body: text('el mensaje', PUSH_LIMITS.body) })
const couponSchema = z.object({
  couponTitle: text('el beneficio', PUSH_LIMITS.couponTitle),
  couponDescription: text('las restricciones', PUSH_LIMITS.couponDescription),
  couponTerms: text('los términos', PUSH_LIMITS.couponTerms),
  couponHours: z
    .string()
    .refine((h) => (PUSH_COUPON_VALIDITY_OPTIONS as readonly number[]).includes(Number(h)), hoursMessage)
    .transform(Number),
})

export type PushBody = { title: string; body: string; coupon?: { title: string; description: string; terms: string; validity_hours: number } }

// Errors per field, or the body to send when everything is valid.
export function validatePush(form: PushForm): { errors: Partial<Record<PushField, string>>; body: null } | { errors: null; body: PushBody } {
  const errors: Partial<Record<PushField, string>> = {}
  const collect = (error: z.ZodError) => {
    for (const issue of error.issues) errors[issue.path[0] as PushField] ??= issue.message
  }
  const message = messageSchema.safeParse(form)
  if (!message.success) collect(message.error)
  const coupon = form.withCoupon ? couponSchema.safeParse(form) : null
  if (coupon && !coupon.success) collect(coupon.error)
  if (!message.success || (coupon && !coupon.success)) return { errors, body: null }
  return {
    errors: null,
    body: {
      ...message.data,
      ...(coupon?.success && { coupon: { title: coupon.data.couponTitle, description: coupon.data.couponDescription, terms: coupon.data.couponTerms, validity_hours: coupon.data.couponHours } }),
    },
  }
}

// send-push error `details.field` -> form field.
export const SERVER_FIELD: Record<string, PushField> = {
  title: 'title',
  body: 'body',
  coupon_title: 'couponTitle',
  coupon_description: 'couponDescription',
  coupon_terms: 'couponTerms',
  coupon_validity_hours: 'couponHours',
}

// Reshapes a send-push response like a PostgREST result so useAdminRpc can handle E-16 -> PIN -> retry.
// WHY: network failures (FunctionsFetchError/RelayError, unreadable bodies) keep no `code`, which the
// callers read as "unknown state" (E-01): the request may or may not have reached the server.
export async function invokeSendPush(body: PushBody & { idempotency_key: string }) {
  const { data, error } = await supabase.functions.invoke('send-push', { body })
  if (!error) return { data: sendResultSchema.parse(data), error: null }
  if (!(error instanceof FunctionsHttpError)) return { data: null, error: { message: 'E-01' } }
  try {
    const payload = (await error.context.json()) as { error?: string; details?: unknown }
    return { data: null, error: { message: payload.error ?? 'E-99', details: payload.details ? JSON.stringify(payload.details) : null, code: 'P0001' } }
  } catch {
    return { data: null, error: { message: 'E-01' } }
  }
}

const dateFormat = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' })
// 'YYYY-MM-DD' is a calendar date, so it is built in local time to avoid a UTC day shift.
export function formatResetDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return dateFormat.format(new Date(year, month - 1, day))
}
export const formatCampaignDate = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
