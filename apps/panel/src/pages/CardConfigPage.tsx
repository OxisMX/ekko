import { ModalDialog } from '../components/ModalDialog'
import { ERRORS, merchantImageUrl } from '@ekko/shared'
import * as Sentry from '@sentry/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { CardPreview } from '../components/CardPreview'
import { AlertIcon, CheckCircleIcon, MinusIcon, PlusIcon } from '../components/Icons'
import { Field } from '../components/FormField'
import { PageState } from '../components/PageState'
import { UnsavedBar, UnsavedChangesDialog } from '../components/UnsavedChanges'
import { ImagePicker } from '../components/ImagePicker'
import { useMerchantSession } from '../components/panelOutlet'
import { useAdminRpc } from '../lib/adminUnlockContext'
import {
  CARD_LIMITS,
  type CardField,
  type CardForm,
  describeError,
  fieldErrors,
  toCardForm,
  updateCardConfig,
} from '../lib/cardConfig'
import { useUnsavedChanges } from '../lib/useUnsavedChanges'
import { supabase } from '../lib/supabase'
import { useMerchantImageUpload } from '../lib/useMerchantImageUpload'
import { btnPrimary, btnSecondary, input } from '../components/ui'


function Stepper({ label, value, range, unit, error, onChange }: {
  label: string
  value: number
  range: readonly [number, number]
  unit: string
  error?: string
  onChange: (value: number) => void
}) {
  const step = 'grid size-14 place-items-center rounded-button bg-surface-muted font-semibold transition-[background-color,transform] hover:bg-black/10 active:scale-[.98] active:bg-black/15 disabled:opacity-40'
  return (
    // WHY fieldset+legend: there is no single control to point a <label> at, so the group carries the name (P-30).
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 font-semibold">{label}</legend>
      <div className="flex items-center gap-3">
        <button type="button" className={step} aria-label={`Menos ${unit}`} disabled={value <= range[0]} onClick={() => onChange(value - 1)}>
          <MinusIcon className="size-6" />
        </button>
        <output className="min-w-28 text-center text-xl font-bold">
          {value} {unit}
        </output>
        <button type="button" className={step} aria-label={`Más ${unit}`} disabled={value >= range[1]} onClick={() => onChange(value + 1)}>
          <PlusIcon className="size-6" />
        </button>
        <span className="text-sm text-text-secondary">
          ({range[0]}–{range[1]})
        </span>
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-error">
          <AlertIcon className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </fieldset>
  )
}

// P-06 (F-24). RN-29: changes only apply to cards created after saving, hence the confirmation.
export function CardConfigPage() {
  const { merchant } = useMerchantSession()
  const { signOut } = useAuth()
  const queryClient = useQueryClient()
  const adminRpc = useAdminRpc()
  const ids = { title: useId(), description: useId(), terms: useId() }
  const backgroundUpload = useMerchantImageUpload('card', 'card')
  // WHY 'logo' kind: stamps are square, same crop and widths as the logo.
  const stampUpload = useMerchantImageUpload('logo', 'card')
  const queryKey = ['card-config', merchant.id]

  // Edits live apart from the loaded config so a refetch or an E-16 detour never loses them.
  const [draft, setDraft] = useState<Partial<CardForm>>({})
  const [serverErrors, setServerErrors] = useState<Partial<Record<CardField, string>>>({})
  const [confirming, setConfirming] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const config = useQuery({
    queryKey,
    queryFn: async () => toCardForm(await adminRpc(() => supabase.rpc('get_card_config'))),
  })

  const handleSessionError = (code: string) => {
    if (code === 'E-05') void queryClient.invalidateQueries({ queryKey: ['merchant-session'] })
    if (code === 'E-18' || code === 'E-19') void signOut(code)
  }

  const save = useMutation({
    mutationFn: async (form: CardForm) => toCardForm(await adminRpc(() => updateCardConfig(form))),
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next)
      setDraft({})
      backgroundUpload.reset()
      stampUpload.reset()
      setConfirming(false)
      setSaveError(null)
      setSaved(true)
    },
    onError: (err) => {
      const { code, field } = describeError(err)
      if (code === 'E-99') Sentry.captureException(err)
      setConfirming(false)
      handleSessionError(code)
      if (code === 'E-23' && field) setServerErrors((prev) => ({ ...prev, [field]: ERRORS['E-23'].message }))
      else setSaveError(ERRORS[code].message)
    },
  })

  const { blocker: unsaved } = useUnsavedChanges(Object.keys(draft).length > 0)

  if (config.isPending) return <PageState title="Configuración de tarjeta" loadingLabel="Cargando la configuración de tu tarjeta…" className="max-w-6xl" />
  if (config.isError)
    return <PageState title="Configuración de tarjeta" loadingLabel="" error={ERRORS[describeError(config.error).code].message} onRetry={() => void config.refetch()} className="max-w-6xl" />

  const form: CardForm = { ...config.data, ...draft }
  const errors = { ...fieldErrors(form), ...serverErrors }
  const dirty = Object.keys(draft).length > 0
  const uploading = backgroundUpload.uploading || stampUpload.uploading
  const canSave = dirty && Object.keys(errors).length === 0 && !uploading && !save.isPending

  const edit = <K extends CardField>(field: K, value: CardForm[K]) => {
    setSaved(false)
    setSaveError(null)
    setServerErrors(({ [field]: _cleared, ...rest }) => rest)
    setDraft((prev) => (value === config.data[field] ? omit(prev, field) : { ...prev, [field]: value }))
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
  const backgroundUrl =
    backgroundUpload.preview ?? (form.card_background_path ? merchantImageUrl(supabaseUrl, form.card_background_path, 'card', 1) : null)
  // null stamp image = the business logo.
  const stampPath = form.stamp_image_path ?? merchant.logo_path
  const stampUrl = stampUpload.preview ?? (stampPath ? merchantImageUrl(supabaseUrl, stampPath, 'logo', 1) : null)

  async function pickBackground(file: File | undefined) {
    const path = await backgroundUpload.pick(file)
    if (path) edit('card_background_path', path)
  }

  async function pickStamp(file: File | undefined) {
    const path = await stampUpload.pick(file)
    if (path) edit('stamp_image_path', path)
  }

  function removeBackground() {
    backgroundUpload.reset()
    edit('card_background_path', null)
  }

  function clearStampImage() {
    stampUpload.reset()
    edit('stamp_image_path', null)
  }

  return (
    <section aria-labelledby="card-title" className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <h1 id="card-title" className="text-h1 font-bold">
        Configuración de tarjeta
      </h1>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <form
          className="flex flex-col gap-6 rounded-2xl bg-surface p-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSave) setConfirming(true)
          }}
        >
          <Stepper label="Sellos para el premio" unit="sellos" range={CARD_LIMITS.stamps} value={form.stamps_required} error={errors.stamps_required} onChange={(v) => edit('stamps_required', v)} />
          <Stepper label="Vigencia del ciclo" unit="meses" range={CARD_LIMITS.months} value={form.cycle_months} error={errors.cycle_months} onChange={(v) => edit('cycle_months', v)} />
          <Field id={ids.title} label="Título del premio" error={errors.reward_title} counter={`${form.reward_title.length}/${CARD_LIMITS.title}`}>
            <input id={ids.title} className={input} value={form.reward_title} aria-invalid={!!errors.reward_title} aria-describedby={`${ids.title}-error`} onChange={(e) => edit('reward_title', e.target.value)} />
          </Field>
          <Field id={ids.description} label="Descripción del premio" error={errors.reward_description} counter={`${form.reward_description.length}/${CARD_LIMITS.description}`}>
            <textarea id={ids.description} rows={3} className={input} value={form.reward_description} aria-invalid={!!errors.reward_description} aria-describedby={`${ids.description}-error`} onChange={(e) => edit('reward_description', e.target.value)} />
          </Field>
          <Field id={ids.terms} label="Términos y condiciones (opcional)" error={errors.terms} counter={`${form.terms.length}/${CARD_LIMITS.terms}`}>
            <textarea id={ids.terms} rows={4} className={input} value={form.terms} aria-invalid={!!errors.terms} aria-describedby={`${ids.terms}-error`} onChange={(e) => edit('terms', e.target.value)} />
          </Field>

          {saveError && (
            <p role="alert" className="flex items-center gap-2 font-medium text-error">
              <AlertIcon className="size-5 shrink-0" />
              {saveError}
            </p>
          )}
          {saved && (
            <p role="status" className="flex items-center gap-2 font-medium text-success">
              <CheckCircleIcon className="size-5 shrink-0" />
              Cambios guardados. Aplican a las tarjetas nuevas.
            </p>
          )}
          <button type="submit" disabled={!canSave} className={`${btnPrimary} h-14 sm:self-start`}>
            Guardar cambios
          </button>
        </form>

        {/* WHY contents below xl: the preview floats above the form and stays pinned while scrolling (P-29); from xl the whole column is sticky. */}
        <aside className="contents xl:sticky xl:top-6 xl:flex xl:flex-col xl:gap-4 xl:self-start">
          <div className="sticky top-0 z-10 order-first -mx-1 flex flex-col gap-2 bg-surface-muted px-1 py-2 xl:static xl:m-0 xl:gap-4 xl:p-0">
            <h2 className="font-semibold">Vista previa</h2>
            <CardPreview merchantName={merchant.name} stampsRequired={form.stamps_required} rewardTitle={form.reward_title} cycleMonths={form.cycle_months} backgroundUrl={backgroundUrl} stampImageUrl={stampUrl} />
          </div>
          <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
            <p className="font-semibold">Imagen de fondo</p>
            <p className="text-sm text-text-secondary">Se recorta al centro con proporción de tarjeta (1.586:1). Máximo 10 MB.</p>
            <ImagePicker inputLabel="Elegir imagen de fondo" hasImage={!!form.card_background_path} uploading={backgroundUpload.uploading} error={backgroundUpload.error} removeLabel="Quitar imagen" onPick={(f) => void pickBackground(f)} onRemove={removeBackground} />
          </div>
          <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
            <p className="font-semibold">Imagen del sello</p>
            <p className="text-sm text-text-secondary">Aparece en cada sello ganado. Se recorta cuadrada. Por defecto se usa el logo de tu negocio.</p>
            <ImagePicker inputLabel="Elegir imagen del sello" hasImage={!!form.stamp_image_path} uploading={stampUpload.uploading} error={stampUpload.error} removeLabel="Usar logo del negocio" onPick={(f) => void pickStamp(f)} onRemove={clearStampImage} />
          </div>
        </aside>
      </div>

      <UnsavedBar show={dirty} />
      <UnsavedChangesDialog blocker={unsaved} />

      {confirming && (
        <ModalDialog labelledBy="confirm-title" onClose={() => !save.isPending && setConfirming(false)}>
          <h2 id="confirm-title" className="text-h2 font-semibold">
            ¿Guardar los cambios?
          </h2>
          <p>Los cambios aplicarán a las tarjetas nuevas. Las tarjetas que tus clientes ya tienen no se modifican.</p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" disabled={save.isPending} className={btnSecondary} onClick={() => setConfirming(false)}>
              Cancelar
            </button>
            <button type="button" disabled={save.isPending} className={btnPrimary} onClick={() => save.mutate(form)}>
              {save.isPending ? 'Guardando…' : 'Confirmar'}
            </button>
          </div>
        </ModalDialog>
      )}
    </section>
  )
}

const omit = <T extends object>(obj: T, key: keyof T): T => {
  const { [key]: _removed, ...rest } = obj
  return rest as T
}
