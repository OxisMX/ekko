import { ERRORS, merchantImageUrl } from '@ekko/shared'
import * as Sentry from '@sentry/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AlertIcon } from '../components/Icons'
import { useMerchantSession } from '../components/panelOutlet'
import { useAdminRpc } from '../lib/adminUnlockContext'
import { imageErrorText, uploadMerchantImage } from '../lib/cardConfig'
import { createImageVariants, ImageProcessingError, type ImageVariant } from '../lib/imageVariants'
import { describeMenuError, MENU_LIMITS, MENU_QUERY_KEY, productFieldErrors, productFormSchema, type ProductField, type ProductFormInput, toMenu, useMenuFailure } from '../lib/menu'
import { supabase } from '../lib/supabase'

const inputClass = 'w-full rounded-xl border border-black/20 bg-surface px-4 py-3 text-base'
const buttonClass = 'min-h-12 rounded-xl px-5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40'

export function Field({ label, error, counter, children, id }: { label: string; error?: string; counter?: string; children: React.ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-semibold">{label}</label>
        {counter && <span className="text-sm text-text-secondary">{counter}</span>}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-sm font-medium text-error">
          <AlertIcon className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

// P-08 (F-25). Image is cropped/encoded on pick (preview) but uploaded on save, so a cancelled form leaves no orphan files.
export function ProductFormPage() {
  const { productId } = useParams()
  const { merchant } = useMerchantSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const adminRpc = useAdminRpc()
  const failure = useMenuFailure()
  const ids = { category: useId(), name: useId(), description: useId(), price: useId() }
  const fileInput = useRef<HTMLInputElement>(null)

  const menu = useQuery({
    queryKey: MENU_QUERY_KEY,
    queryFn: async () => toMenu(await adminRpc(() => supabase.rpc('list_menu_admin'))),
  })

  const [draft, setDraft] = useState<Partial<ProductFormInput>>({})
  const [serverErrors, setServerErrors] = useState<Partial<Record<ProductField, string>>>({})
  const [imagePath, setImagePath] = useState<string | null | undefined>(undefined) // undefined = untouched
  const [pending, setPending] = useState<{ variants: ImageVariant[]; previewUrl: string } | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [uploadFailed, setUploadFailed] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'saving'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  if (menu.isPending)
    return <p role="status" className="p-6 text-text-secondary">Cargando el producto…</p>
  if (menu.isError)
    return (
      <div role="alert" className="mx-auto flex max-w-xl flex-col items-start gap-3 rounded-2xl bg-surface p-6">
        <p className="font-semibold">{failure(menu.error).message}</p>
        <button type="button" className={`${buttonClass} bg-navy text-white`} onClick={() => void menu.refetch()}>Reintentar</button>
      </div>
    )

  const categories = [...menu.data].sort((a, b) => a.position - b.position)
  const existing = productId ? categories.flatMap((c) => c.products).find((p) => p.id === productId) : undefined
  if (productId && !existing)
    return (
      <div role="alert" className="mx-auto flex max-w-xl flex-col items-start gap-3 rounded-2xl bg-surface p-6">
        <p className="font-semibold">Este producto ya no existe.</p>
        <Link to="/admin/menu" className={`${buttonClass} flex items-center bg-navy text-white`}>Volver al menú</Link>
      </div>
    )

  const base: ProductFormInput = {
    category_id: existing?.category_id ?? categories[0]?.id ?? '',
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    price: existing ? String(existing.price) : '',
  }
  const form = { ...base, ...draft }
  const errors = { ...(submitted || draft.price !== undefined || draft.name !== undefined || draft.description !== undefined ? productFieldErrors(form) : {}), ...serverErrors }
  const currentImage = imagePath === undefined ? (existing?.image_path ?? null) : imagePath
  const previewUrl = pending?.previewUrl ?? (currentImage ? merchantImageUrl(import.meta.env.VITE_SUPABASE_URL ?? '', currentImage, 'product', 2) : null)
  const busy = phase !== 'idle'

  const edit = (field: keyof ProductFormInput, value: string) => {
    setSaveError(null)
    setServerErrors(({ [field]: _cleared, ...rest }) => rest)
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  async function pickImage(file: File | undefined) {
    if (!file) return
    setImageError(null)
    setUploadFailed(false)
    try {
      const variants = await createImageVariants(file, 'product')
      const largest = variants[variants.length - 1]
      setPending((old) => {
        if (old) URL.revokeObjectURL(old.previewUrl)
        return { variants, previewUrl: URL.createObjectURL(largest.blob) }
      })
    } catch (err) {
      if (!(err instanceof ImageProcessingError)) Sentry.captureException(err)
      setImageError(err instanceof ImageProcessingError ? imageErrorText[err.code] : ERRORS['E-22'].message)
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function removeImage() {
    setPending(null)
    setImageError(null)
    setUploadFailed(false)
    setImagePath(null)
  }

  // `withoutNewImage` is the F-25 escape hatch: keep whatever image the product already had.
  async function submit(withoutNewImage = false) {
    setSubmitted(true)
    setSaveError(null)
    const parsed = productFormSchema.safeParse(form)
    if (!parsed.success) return
    let path = currentImage
    if (pending && !withoutNewImage) {
      setPhase('uploading')
      setUploadFailed(false)
      try {
        path = await adminRpc(() => uploadMerchantImage(merchant.id, 'product', pending.variants))
        if (!path) throw new ImageProcessingError('ENCODE_FAILED', 'Sin ruta')
        setImagePath(path)
        setPending(null)
      } catch (err) {
        const { message } = failure(err)
        setImageError(message)
        setUploadFailed(true)
        setPhase('idle')
        return
      }
    } else if (withoutNewImage) {
      setPending(null)
      setImageError(null)
      setUploadFailed(false)
    }
    setPhase('saving')
    try {
      await adminRpc(() =>
        supabase.rpc('upsert_product', {
          p_id: productId,
          p_category_id: parsed.data.category_id,
          p_name: parsed.data.name,
          p_description: parsed.data.description,
          p_price: parsed.data.price,
          // WHY: generated types omit `null`, but the RPC accepts it for "no image".
          p_image_path: path as string,
        }),
      )
      await queryClient.invalidateQueries({ queryKey: MENU_QUERY_KEY })
      navigate('/admin/menu', { state: { notice: productId ? 'Producto actualizado.' : 'Producto creado.' } })
    } catch (err) {
      const { message } = failure(err)
      const { code, field } = describeMenuError(err)
      if (code === 'E-23' && field) setServerErrors((prev) => ({ ...prev, [field]: ERRORS['E-23'].message }))
      else setSaveError(message)
      setPhase('idle')
    }
  }

  return (
    <section aria-labelledby="product-title" className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="product-title" className="text-2xl font-bold">{existing ? 'Editar producto' : 'Nuevo producto'}</h1>
        <Link to="/admin/menu" className="font-semibold text-text-secondary underline">Volver al menú</Link>
      </div>

      <form className="grid gap-6 rounded-2xl bg-surface p-6 md:grid-cols-[1fr_16rem]" noValidate onSubmit={(e) => { e.preventDefault(); if (!busy) void submit() }}>
        <div className="flex flex-col gap-5">
          <Field id={ids.category} label="Categoría" error={errors.category_id}>
            <select id={ids.category} className={inputClass} value={form.category_id} aria-invalid={!!errors.category_id} aria-describedby={`${ids.category}-error`} onChange={(e) => edit('category_id', e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field id={ids.name} label="Nombre" error={errors.name} counter={`${form.name.length}/${MENU_LIMITS.productName}`}>
            <input id={ids.name} className={inputClass} value={form.name} aria-invalid={!!errors.name} aria-describedby={`${ids.name}-error`} onChange={(e) => edit('name', e.target.value)} />
          </Field>
          <Field id={ids.description} label="Descripción (opcional)" error={errors.description} counter={`${form.description.length}/${MENU_LIMITS.description}`}>
            <textarea id={ids.description} rows={3} className={inputClass} value={form.description} aria-invalid={!!errors.description} aria-describedby={`${ids.description}-error`} onChange={(e) => edit('description', e.target.value)} />
          </Field>
          <Field id={ids.price} label="Precio (MXN)" error={errors.price}>
            <input id={ids.price} inputMode="decimal" placeholder="0.00" className={inputClass} value={form.price} aria-invalid={!!errors.price} aria-describedby={`${ids.price}-error`} onChange={(e) => edit('price', e.target.value)} />
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-semibold">Imagen</p>
          <div className="aspect-square w-full overflow-hidden rounded-2xl bg-surface-muted">
            {previewUrl ? <img src={previewUrl} alt="Vista previa del producto" className="size-full object-cover" /> : <p className="grid size-full place-items-center p-4 text-center text-sm text-text-secondary">Sin imagen. Se recorta al centro en cuadrado.</p>}
          </div>
          <input ref={fileInput} type="file" accept="image/*" aria-label="Elegir imagen del producto" className="sr-only" onChange={(e) => void pickImage(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy} className={`${buttonClass} border border-black/15 hover:bg-surface-muted`} onClick={() => fileInput.current?.click()}>
              {previewUrl ? 'Cambiar imagen' : 'Elegir imagen'}
            </button>
            {previewUrl && (
              <button type="button" disabled={busy} className={`${buttonClass} text-error hover:bg-surface-muted`} onClick={removeImage}>Quitar imagen</button>
            )}
          </div>
          {imageError && (
            <div role="alert" className="flex flex-col gap-2 text-sm font-medium text-error">
              <p className="flex items-center gap-1.5">
                <AlertIcon className="size-4 shrink-0" />
                {imageError}
              </p>
              {uploadFailed && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} className={`${buttonClass} bg-navy text-white`} onClick={() => void submit()}>Reintentar</button>
                  <button type="button" disabled={busy} className={`${buttonClass} border border-black/15 text-text-primary`} onClick={() => void submit(true)}>Guardar sin imagen</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 md:col-span-2">
          {saveError && (
            <p role="alert" className="flex items-center gap-2 font-medium text-error">
              <AlertIcon className="size-5 shrink-0" />
              {saveError}
            </p>
          )}
          {phase === 'uploading' && <p role="status" className="text-text-secondary">Subiendo imagen…</p>}
          <button type="submit" disabled={busy} className={`${buttonClass} h-14 bg-navy text-white hover:bg-brand sm:self-start`}>
            {phase === 'saving' ? 'Guardando…' : 'Guardar producto'}
          </button>
        </div>
      </form>
    </section>
  )
}
