import { parseRpcError, PUSH_COUPON_VALIDITY_OPTIONS, type ErrorCode } from '@ekko/shared'
import { z } from 'zod'
import { ImageProcessingError, type ImageVariant } from './imageVariants'
import { supabase } from './supabase'

// Limits mirror backend §4.5 update_card_config (RN-23, RN-24) so the server is never the first to say no.
export const CARD_LIMITS = { stamps: [4, 10], months: [3, 12], title: 60, description: 200, terms: 1000 } as const

const range = ([min, max]: readonly [number, number], label: string) =>
  z.number().int().min(min, `${label}: entre ${min} y ${max}.`).max(max, `${label}: entre ${min} y ${max}.`)
const text = (label: string, max: number) =>
  z.string().trim().min(1, `Escribe ${label}.`).max(max, `Máximo ${max} caracteres.`)

export const cardFormSchema = z.object({
  stamps_required: range(CARD_LIMITS.stamps, 'Sellos'),
  cycle_months: range(CARD_LIMITS.months, 'Vigencia'),
  reward_title: text('el título del premio', CARD_LIMITS.title),
  reward_description: text('la descripción del premio', CARD_LIMITS.description),
  terms: z.string().trim().max(CARD_LIMITS.terms, `Máximo ${CARD_LIMITS.terms} caracteres.`),
  card_background_path: z.string().nullable(),
  // null = use the business logo (default).
  stamp_image_path: z.string().nullable().default(null),
  push_coupon_validity_hours: z
    .number()
    .refine((h) => (PUSH_COUPON_VALIDITY_OPTIONS as readonly number[]).includes(h), 'Vigencia: elige 6, 12, 24, 36 o 48 horas.'),
})
export type CardForm = z.infer<typeof cardFormSchema>
export type CardField = keyof CardForm

// Contract: backend §4.5 get_card_config (terms may come null).
export const cardConfigSchema = cardFormSchema.extend({ terms: z.string().nullable() })

export const toCardForm = (raw: unknown): CardForm => {
  const config = cardConfigSchema.parse(raw)
  return { ...config, terms: config.terms ?? '' }
}

export function fieldErrors(form: CardForm): Partial<Record<CardField, string>> {
  const result = cardFormSchema.safeParse(form)
  if (result.success) return {}
  const errors: Partial<Record<CardField, string>> = {}
  for (const issue of result.error.issues) errors[issue.path[0] as CardField] ??= issue.message
  return errors
}

export function describeError(err: unknown): { code: ErrorCode; field: CardField | null } {
  if (err instanceof ImageProcessingError) return { code: 'E-22', field: null }
  const raw = err as { message?: string; details?: string | null; code?: string }
  // WHY: fetch failures (offline) carry no `code`; real RPC errors always do.
  if (!raw?.code) return { code: 'E-01', field: null }
  const { code, details } = parseRpcError(raw)
  const field = typeof details?.field === 'string' && details.field in cardFormSchema.shape ? (details.field as CardField) : null
  return { code, field }
}

export const imageErrorText: Record<ImageProcessingError['code'], string> = {
  SOURCE_TOO_LARGE: 'La imagen supera 10 MB. Elige una más ligera.',
  NOT_AN_IMAGE: 'Ese archivo no es una imagen. Elige un JPG, PNG o WebP.',
  VARIANT_TOO_LARGE: 'La imagen es demasiado pesada incluso comprimida. Prueba con otra.',
  ENCODE_FAILED: 'Tu navegador no pudo preparar la imagen. Prueba con otra.',
}

// Storage errors reshaped like RPC errors so useAdminRpc can ask for the PIN (E-16) and retry.
function storageErrorAsRpc(err: { message: string; statusCode?: string }) {
  const lapsed = err.statusCode === '401' || err.statusCode === '403' || /row-level security|jwt/i.test(err.message)
  const message = lapsed ? 'E-16' : err.statusCode ? 'E-22' : 'E-01'
  return { message, code: 'P0001', details: null }
}

// Immutable paths: every change gets a new uuid (backend §7), stored without the `_{width}` suffix.
export async function uploadMerchantImage(merchantId: string, folder: 'card' | 'product' | 'offer' | 'brand', variants: ImageVariant[]) {
  const base = `merchants/${merchantId}/${folder}/${crypto.randomUUID()}`
  for (const { width, blob, format } of variants) {
    const { error } = await supabase.storage
      .from('merchant-media')
      .upload(`${base}_${width}.${format === 'webp' ? 'webp' : 'jpg'}`, blob, { contentType: blob.type, cacheControl: '31536000' })
    if (error) return { data: null, error: storageErrorAsRpc(error) }
  }
  // A JPEG fallback keeps its real extension in the stored path (backend §7).
  return { data: variants.some((v) => v.format === 'jpeg') ? `${base}.jpg` : base, error: null }
}
