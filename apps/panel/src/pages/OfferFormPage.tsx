import { ERRORS, merchantImageUrl } from '@ekko/shared'
import * as Sentry from '@sentry/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Field } from '../components/FormField'
import { AlertIcon } from '../components/Icons'
import { ImagePicker } from '../components/ImagePicker'
import { PageState } from '../components/PageState'
import { UnsavedBar, UnsavedChangesDialog } from '../components/UnsavedChanges'
import { useMerchantSession } from '../components/panelOutlet'
import { useAdminRpc } from '../lib/adminUnlockContext'
import { imageErrorText, uploadMerchantImage } from '../lib/cardConfig'
import { createImageVariants, ImageProcessingError, type ImageVariant } from '../lib/imageVariants'
import { describeMenuError, useMenuFailure } from '../lib/menu'
import { OFFER_LIMITS, OFFERS_QUERY_KEY, offerFieldErrors, offerFormSchema, type OfferField, type OfferFormInput, toOffers, WEEKDAYS } from '../lib/offers'
import { useUnsavedChanges } from '../lib/useUnsavedChanges'
import { supabase } from '../lib/supabase'
import { btnPrimary, btnSecondary, input } from '../components/ui'


// P-09 form (F-26). Same image flow as P-08: cropped on pick (preview), uploaded on save.
export function OfferFormPage() {
  const { offerId } = useParams()
  const [searchParams] = useSearchParams()
  const { merchant } = useMerchantSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const adminRpc = useAdminRpc()
  const failure = useMenuFailure()
  const ids = { title: useId(), description: useId() }

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

  const hasChanges = Object.keys(draft).length > 0 || pending !== null || imagePath !== undefined
  const { blocker: unsaved, allowLeave } = useUnsavedChanges(hasChanges)
  const title = offerId ? 'Editar oferta' : 'Nueva oferta'
  if (offers.isPending) return <PageState title={title} loadingLabel="Cargando la oferta…" className="max-w-3xl" />
  if (offers.isError) return <PageState title={title} loadingLabel="" error={failure(offers.error).message} onRetry={() => void offers.refetch()} className="max-w-3xl" />

  const existing = offerId ? offers.data.find((o) => o.id === offerId) : undefined
  if (offerId && !existing)
    return (
      <div role="alert" className="mx-auto flex max-w-xl flex-col items-start gap-3 rounded-2xl bg-surface p-6">
        <p className="font-semibold">Esta oferta ya no existe.</p>
        <Link to="/admin/ofertas" className={`${btnPrimary} flex items-center`}>Volver a las ofertas</Link>
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
      allowLeave()
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
        <h1 id="offer-title" className="text-h1 font-bold">{existing ? 'Editar oferta' : 'Nueva oferta'}</h1>
        <Link to="/admin/ofertas" className="font-semibold text-text-secondary underline">Volver a las ofertas</Link>
      </div>

      <form className="grid gap-6 rounded-2xl bg-surface p-6 md:grid-cols-[1fr_18rem]" noValidate onSubmit={(e) => { e.preventDefault(); if (!busy) void submit() }}>
        <div className="flex flex-col gap-5">
          <Field id={ids.title} label="Título" error={errors.title} counter={`${form.title.length}/${OFFER_LIMITS.title}`}>
            <input id={ids.title} className={input} value={form.title} aria-invalid={!!errors.title} aria-describedby={`${ids.title}-error`} onChange={(e) => edit('title', e.target.value)} />
          </Field>
          <Field id={ids.description} label="Descripción" error={errors.description} counter={`${form.description.length}/${OFFER_LIMITS.description}`}>
            <textarea id={ids.description} rows={3} className={input} value={form.description} aria-invalid={!!errors.description} aria-describedby={`${ids.description}-error`} onChange={(e) => edit('description', e.target.value)} />
          </Field>
          {/* WHY toggle buttons: all 7 days stay visible and one tap picks one, unlike a select (P-37). */}
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 font-semibold">Día de la semana</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day, index) => {
                const selected = form.weekday === String(index + 1)
                return (
                  <button
                    key={day}
                    type="button"
                    aria-label={day}
                    aria-pressed={selected}
                    onClick={() => edit('weekday', String(index + 1))}
                    className={`min-h-12 min-w-14 rounded-button border px-3 font-semibold transition-[color,background-color,transform] active:scale-[.98] ${selected ? 'border-navy bg-navy text-white' : 'border-text-secondary hover:bg-surface-muted'}`}
                  >
                    {day.slice(0, 3)}
                  </button>
                )
              })}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-semibold">Imagen</p>
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-surface-muted">
            {previewUrl ? <img src={previewUrl} alt="Vista previa de la oferta" className="size-full object-cover" /> : <p className="grid size-full place-items-center p-4 text-center text-sm text-text-secondary">Sin imagen. Se recorta al centro en formato 16:9.</p>}
          </div>
          <ImagePicker
            inputLabel="Elegir imagen de la oferta"
            hasImage={!!previewUrl}
            uploading={phase === 'uploading'}
            disabled={busy}
            error={imageError}
            errorActions={
              uploadFailed && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} className={btnPrimary} onClick={() => void submit()}>Reintentar</button>
                  <button type="button" disabled={busy} className={btnSecondary} onClick={() => void submit(true)}>Guardar sin imagen</button>
                </div>
              )
            }
            onPick={(f) => void pickImage(f)}
            onRemove={removeImage}
          />
        </div>

        <div className="flex flex-col gap-3 md:col-span-2">
          {saveError && (
            <p role="alert" className="flex items-center gap-2 font-medium text-error">
              <AlertIcon className="size-5 shrink-0" />
              {saveError}
            </p>
          )}
          {phase === 'uploading' && <p role="status" className="text-text-secondary">Subiendo imagen…</p>}
          <button type="submit" disabled={busy} className={`${btnPrimary} h-14 sm:self-start`}>
            {phase === 'saving' ? 'Guardando…' : 'Guardar oferta'}
          </button>
        </div>
      </form>
      <UnsavedBar show={hasChanges} />
      <UnsavedChangesDialog blocker={unsaved} />
    </section>
  )
}
