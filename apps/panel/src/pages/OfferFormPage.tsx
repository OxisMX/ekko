import { ERRORS, merchantImageUrl } from '@ekko/shared'
import * as Sentry from '@sentry/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { AlertIcon } from '../components/Icons'
import { useMerchantSession } from '../components/panelOutlet'
import { useAdminRpc } from '../lib/adminUnlockContext'
import { imageErrorText, uploadMerchantImage } from '../lib/cardConfig'
import { createImageVariants, ImageProcessingError, type ImageVariant } from '../lib/imageVariants'
import { describeMenuError, useMenuFailure } from '../lib/menu'
import { OFFER_LIMITS, OFFERS_QUERY_KEY, offerFieldErrors, offerFormSchema, type OfferField, type OfferFormInput, toOffers, WEEKDAYS } from '../lib/offers'
import { supabase } from '../lib/supabase'
import { Field } from './ProductFormPage'

const inputClass = 'w-full rounded-xl border border-black/20 bg-surface px-4 py-3 text-base'
const buttonClass = 'min-h-12 rounded-xl px-5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40'

// P-09 form (F-26). Same image flow as P-08: cropped on pick (preview), uploaded on save.
export function OfferFormPage() {
  const { offerId } = useParams()
  const [searchParams] = useSearchParams()
  const { merchant } = useMerchantSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const adminRpc = useAdminRpc()
  const failure = useMenuFailure()
  const ids = { title: useId(), description: useId(), weekday: useId() }
  const fileInput = useRef<HTMLInputElement>(null)

  const offers = useQuery({
    queryKey: OFFERS_QUERY_KEY,
    queryFn: async () => toOffers(await adminRpc(() => supabase.rpc('list_offers_admin'))),
  })

  const [draft, setDraft] = useState<Partial<OfferFormInput>>({})
  const [serverErrors, setServerErrors] = useState<Partial<Record<OfferField, string>>>({})
  const [imagePath, setImagePath] = useState<string | null | undefined>(undefined) // undefined = untouched
  const [pending, setPending] = useState<{ variants: ImageVariant[]; previewUrl: string } | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [uploadFailed, setUploadFailed] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'saving'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  if (offers.isPending)
    return <p role="status" className="p-6 text-text-secondary">Cargando la oferta…</p>
  if (offers.isError)
    return (
      <div role="alert" className="mx-auto flex max-w-xl flex-col items-start gap-3 rounded-2xl bg-surface p-6">
        <p className="font-semibold">{failure(offers.error).message}</p>
        <button type="button" className={`${buttonClass} bg-navy text-white`} onClick={() => void offers.refetch()}>Reintentar</button>
      </div>
    )

  const existing = offerId ? offers.data.find((o) => o.id === offerId) : undefined
  if (offerId && !existing)
    return (
      <div role="alert" className="mx-auto flex max-w-xl flex-col items-start gap-3 rounded-2xl bg-surface p-6">
        <p className="font-semibold">Esta oferta ya no existe.</p>
        <Link to="/admin/ofertas" className={`${buttonClass} flex items-center bg-navy text-white`}>Volver a las ofertas</Link>
      </div>
    )

  const requestedDay = searchParams.get('dia')
  const base: OfferFormInput = {
    title: existing?.title ?? '',
    description: existing?.description ?? '',
    weekday: existing ? String(existing.weekday) : requestedDay && /^[1-7]$/.test(requestedDay) ? requestedDay : '1',
  }
  const form = { ...base, ...draft }
  const errors = { ...(submitted || draft.title !== undefined || draft.description !== undefined ? offerFieldErrors(form) : {}), ...serverErrors }
  const currentImage = imagePath === undefined ? (existing?.image_path ?? null) : imagePath
  const previewUrl = pending?.previewUrl ?? (currentImage ? merchantImageUrl(import.meta.env.VITE_SUPABASE_URL ?? '', currentImage, 'offer', 2) : null)
  const busy = phase !== 'idle'

  const edit = (field: keyof OfferFormInput, value: string) => {
    setSaveError(null)
    setServerErrors(({ [field]: _cleared, ...rest }) => rest)
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  async function pickImage(file: File | undefined) {
    if (!file) return
    setImageError(null)
    setUploadFailed(false)
    try {
      const variants = await createImageVariants(file, 'offer')
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

  // `withoutNewImage` is the escape hatch when the upload fails: keep whatever image the offer already had.
  async function submit(withoutNewImage = false) {
    setSubmitted(true)
    setSaveError(null)
    const parsed = offerFormSchema.safeParse(form)
    if (!parsed.success) return
    let path = currentImage
    if (pending && !withoutNewImage) {
      setPhase('uploading')
      setUploadFailed(false)
      try {
        path = await adminRpc(() => uploadMerchantImage(merchant.id, 'offer', pending.variants))
        if (!path) throw new ImageProcessingError('ENCODE_FAILED', 'Sin ruta')
        setImagePath(path)
        setPending(null)
      } catch (err) {
        setImageError(failure(err).message)
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
        supabase.rpc('upsert_offer', {
          p_id: offerId,
          p_title: parsed.data.title,
          p_description: parsed.data.description,
          p_weekday: parsed.data.weekday,
          // WHY: generated types omit `null`, but the RPC accepts it for "no image".
          p_image_path: path as string,
        }),
      )
      await queryClient.invalidateQueries({ queryKey: OFFERS_QUERY_KEY })
      navigate('/admin/ofertas', { state: { notice: offerId ? 'Oferta actualizada.' : 'Oferta creada.' } })
    } catch (err) {
      const { message } = failure(err)
      const { code, field } = describeMenuError(err)
      if (code === 'E-23' && field) setServerErrors((prev) => ({ ...prev, [field]: ERRORS['E-23'].message }))
      else setSaveError(message)
      setPhase('idle')
    }
  }

  return (
    <section aria-labelledby="offer-title" className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="offer-title" className="text-2xl font-bold">{existing ? 'Editar oferta' : 'Nueva oferta'}</h1>
        <Link to="/admin/ofertas" className="font-semibold text-text-secondary underline">Volver a las ofertas</Link>
      </div>

      <form className="grid gap-6 rounded-2xl bg-surface p-6 md:grid-cols-[1fr_18rem]" noValidate onSubmit={(e) => { e.preventDefault(); if (!busy) void submit() }}>
        <div className="flex flex-col gap-5">
          <Field id={ids.title} label="Título" error={errors.title} counter={`${form.title.length}/${OFFER_LIMITS.title}`}>
            <input id={ids.title} className={inputClass} value={form.title} aria-invalid={!!errors.title} aria-describedby={`${ids.title}-error`} onChange={(e) => edit('title', e.target.value)} />
          </Field>
          <Field id={ids.description} label="Descripción" error={errors.description} counter={`${form.description.length}/${OFFER_LIMITS.description}`}>
            <textarea id={ids.description} rows={3} className={inputClass} value={form.description} aria-invalid={!!errors.description} aria-describedby={`${ids.description}-error`} onChange={(e) => edit('description', e.target.value)} />
          </Field>
          <Field id={ids.weekday} label="Día de la semana" error={errors.weekday}>
            <select id={ids.weekday} className={inputClass} value={form.weekday} aria-invalid={!!errors.weekday} aria-describedby={`${ids.weekday}-error`} onChange={(e) => edit('weekday', e.target.value)}>
              {WEEKDAYS.map((day, index) => (
                <option key={day} value={index + 1}>{day}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-semibold">Imagen</p>
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-surface-muted">
            {previewUrl ? <img src={previewUrl} alt="Vista previa de la oferta" className="size-full object-cover" /> : <p className="grid size-full place-items-center p-4 text-center text-sm text-text-secondary">Sin imagen. Se recorta al centro en formato 16:9.</p>}
          </div>
          <input ref={fileInput} type="file" accept="image/*" aria-label="Elegir imagen de la oferta" className="sr-only" onChange={(e) => void pickImage(e.target.files?.[0])} />
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
            {phase === 'saving' ? 'Guardando…' : 'Guardar oferta'}
          </button>
        </div>
      </form>
    </section>
  )
}
