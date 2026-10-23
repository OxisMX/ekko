import { z } from 'zod'

export const OFFERS_QUERY_KEY = ['offers-admin']
// Limits mirror backend upsert_offer (US-24) so the server is never the first to say no.
export const OFFER_LIMITS = { title: 60, description: 200 } as const
// ISO weekday: 1 = lunes … 7 = domingo.
export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const

const offerSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  weekday: z.number().int().min(1).max(7),
  image_path: z.string().nullable(),
  position: z.number(),
})
export type Offer = z.infer<typeof offerSchema>

export const toOffers = (raw: unknown): Offer[] => z.array(offerSchema).nullable().parse(raw) ?? []

export const offerFormSchema = z.object({
  title: z.string().trim().min(1, 'Escribe el título de la oferta.').max(OFFER_LIMITS.title, `Máximo ${OFFER_LIMITS.title} caracteres.`),
  description: z.string().trim().min(1, 'Escribe la descripción de la oferta.').max(OFFER_LIMITS.description, `Máximo ${OFFER_LIMITS.description} caracteres.`),
  // Text because it comes from a <select>.
  weekday: z.string().regex(/^[1-7]$/, 'Elige un día.').transform(Number),
})
export type OfferFormInput = z.input<typeof offerFormSchema>
export type OfferField = keyof OfferFormInput | 'image_path'

export function offerFieldErrors(form: OfferFormInput): Partial<Record<keyof OfferFormInput, string>> {
  const result = offerFormSchema.safeParse(form)
  if (result.success) return {}
  const errors: Partial<Record<keyof OfferFormInput, string>> = {}
  for (const issue of result.error.issues) errors[issue.path[0] as keyof OfferFormInput] ??= issue.message
  return errors
}
