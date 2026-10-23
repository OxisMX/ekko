import { MERCHANT_CATEGORIES } from '@ekko/shared'
import { z } from 'zod'

// Limits mirror update_merchant_profile so the server is never the first to say no.
export const PROFILE_LIMITS = { name: 40, description: 140, url: 500 } as const
export const PROFILE_KEY = ['merchant-profile']

const text = (label: string, max: number) => z.string().trim().min(1, `Escribe ${label}.`).max(max, `Máximo ${max} caracteres.`)
const httpsUrl = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Pega ${label}.`)
    .max(PROFILE_LIMITS.url, `Máximo ${PROFILE_LIMITS.url} caracteres.`)
    .refine((v) => v.startsWith('https://'), 'El enlace debe empezar con https://')

export const profileFormSchema = z.object({
  name: text('el nombre comercial', PROFILE_LIMITS.name),
  category: z.enum(MERCHANT_CATEGORIES, 'Elige una categoría.'),
  description: text('una descripción breve', PROFILE_LIMITS.description),
  maps_url: httpsUrl('el enlace de Google Maps'),
  reviews_url: httpsUrl('el enlace de Google Reseñas'),
  logo_path: z.string().min(1, 'Elige un logo.'),
  cover_path: z.string().min(1, 'Elige una portada.'),
})
export type ProfileForm = z.infer<typeof profileFormSchema>
export type ProfileField = keyof ProfileForm

// WHY loose: onboarding data set by Oxis may not satisfy the edit limits; show it with field errors instead of failing to load.
const orEmpty = z.string().nullable().transform((v) => v ?? '')
const loadedProfileSchema = z.object({
  name: z.string(),
  category: z.enum(MERCHANT_CATEGORIES),
  description: orEmpty,
  maps_url: orEmpty,
  reviews_url: orEmpty,
  logo_path: orEmpty,
  cover_path: orEmpty,
})
export const toProfileForm = (raw: unknown): ProfileForm => loadedProfileSchema.parse(raw)

export function profileErrors(form: ProfileForm): Partial<Record<ProfileField, string>> {
  const result = profileFormSchema.safeParse(form)
  if (result.success) return {}
  const errors: Partial<Record<ProfileField, string>> = {}
  for (const issue of result.error.issues) errors[issue.path[0] as ProfileField] ??= issue.message
  return errors
}
