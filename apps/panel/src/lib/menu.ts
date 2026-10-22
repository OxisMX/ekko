import { ERRORS, parseRpcError, type ErrorCode } from '@ekko/shared'
import * as Sentry from '@sentry/react'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import { ImageProcessingError } from './imageVariants'

export const MENU_QUERY_KEY = ['menu-admin']
// Limits mirror backend menu_rpc (US-23) so the server is never the first to say no.
export const MENU_LIMITS = { categoryName: 30, productName: 60, description: 200, maxPrice: 99_999_999.99 } as const

const productSchema = z.object({
  id: z.string(),
  category_id: z.string(),
  name: z.string(),
  description: z.string().nullable().transform((v) => v ?? ''),
  price: z.number(),
  image_path: z.string().nullable(),
  is_featured: z.boolean(),
  is_sold_out: z.boolean(),
  position: z.number(),
})
const menuSchema = z.object({
  categories: z
    .array(z.object({ id: z.string(), name: z.string(), position: z.number(), products: z.array(productSchema).nullable().transform((v) => v ?? []) }))
    .nullable()
    .transform((v) => v ?? []),
})
export type MenuProduct = z.infer<typeof productSchema>
export type MenuCategory = z.infer<typeof menuSchema>['categories'][number]

export const toMenu = (raw: unknown): MenuCategory[] => menuSchema.parse(raw).categories

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
export const formatPrice = (price: number) => mxn.format(price)

export const productFormSchema = z.object({
  category_id: z.string().min(1, 'Elige una categoría.'),
  name: z.string().trim().min(1, 'Escribe el nombre del producto.').max(MENU_LIMITS.productName, `Máximo ${MENU_LIMITS.productName} caracteres.`),
  description: z.string().trim().max(MENU_LIMITS.description, `Máximo ${MENU_LIMITS.description} caracteres.`),
  // Text, not number: "12,5" and "12.50" are both typed by merchants; parsed in parsePrice.
  price: z
    .string()
    .trim()
    .transform((v) => v.replace(',', '.'))
    .pipe(
      z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, 'Escribe un precio válido, con máximo 2 decimales.')
        .transform(Number)
        .refine((n) => n <= MENU_LIMITS.maxPrice, 'El precio es demasiado alto.'),
    ),
})
export type ProductFormInput = z.input<typeof productFormSchema>
export type ProductField = keyof ProductFormInput | 'image_path'

export const categoryNameSchema = z.string().trim().min(1, 'Escribe el nombre.').max(MENU_LIMITS.categoryName, `Máximo ${MENU_LIMITS.categoryName} caracteres.`)

export function productFieldErrors(form: ProductFormInput): Partial<Record<keyof ProductFormInput, string>> {
  const result = productFormSchema.safeParse(form)
  if (result.success) return {}
  const errors: Partial<Record<keyof ProductFormInput, string>> = {}
  for (const issue of result.error.issues) errors[issue.path[0] as keyof ProductFormInput] ??= issue.message
  return errors
}

export function describeMenuError(err: unknown): { code: ErrorCode; field: string | null } {
  if (err instanceof ImageProcessingError) return { code: 'E-22', field: null }
  const raw = err as { message?: string; details?: string | null; code?: string }
  // WHY: fetch failures (offline) carry no `code`; real RPC errors always do.
  if (!raw?.code) return { code: 'E-01', field: null }
  const { code, details } = parseRpcError(raw)
  return { code, field: typeof details?.field === 'string' ? details.field : null }
}

// Shared failure handling for menu RPCs: session-level codes side effects + the user-facing message.
export function useMenuFailure() {
  const queryClient = useQueryClient()
  const { signOut } = useAuth()
  return (err: unknown) => {
    const described = describeMenuError(err)
    if (described.code === 'E-99') Sentry.captureException(err)
    if (described.code === 'E-05') void queryClient.invalidateQueries({ queryKey: ['merchant-session'] })
    if (described.code === 'E-18' || described.code === 'E-19') void signOut(described.code)
    const message = described.field === 'category_not_empty' ? 'Mueve o elimina sus productos primero.' : ERRORS[described.code].message
    return { ...described, message }
  }
}
