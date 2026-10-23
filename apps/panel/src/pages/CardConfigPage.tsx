import { ModalDialog } from '../components/ModalDialog'
import { ERRORS, merchantImageUrl } from '@ekko/shared'
import * as Sentry from '@sentry/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { CardPreview } from '../components/CardPreview'
import { AlertIcon, CheckCircleIcon } from '../components/Icons'
import { useMerchantSession } from '../components/panelOutlet'
import { useAdminRpc } from '../lib/adminUnlockContext'
import {
  CARD_LIMITS,
  type CardField,
  type CardForm,
  cardFormSchema,
  describeError,
  fieldErrors,
  imageErrorText,
  toCardForm,
  uploadCardBackground,
} from '../lib/cardConfig'
import { createImageVariants, ImageProcessingError } from '../lib/imageVariants'
import { supabase } from '../lib/supabase'

const inputClass = 'w-full rounded-xl border border-black/20 bg-surface px-4 py-3 text-base'
const buttonClass = 'min-h-12 rounded-xl px-5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40'

function Field({ label, error, counter, children, id }: { label: string; error?: string; counter?: string; children: React.ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
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

function Stepper({ id, label, value, range, unit, error, onChange }: {
  id: string
  label: string
  value: number
  range: readonly [number, number]
  unit: string
  error?: string
  onChange: (value: number) => void
}) {
  const step = 'grid size-14 place-items-center rounded-xl bg-surface-muted text-2xl font-semibold hover:bg-black/10 disabled:opacity-40'
  return (
    <Field id={id} label={label} error={error}>
      <div className="flex items-center gap-3" role="group" aria-labelledby={id}>
        <button type="button" className={step} aria-label={`Menos ${unit}`} disabled={value <= range[0]} onClick={() => onChange(value - 1)}>
          −
        </button>
        <output id={`${id}-value`} className="min-w-28 text-center text-xl font-bold">
          {value} {unit}
        </output>
        <button type="button" className={step} aria-label={`Más ${unit}`} disabled={value >= range[1]} onClick={() => onChange(value + 1)}>
          +
        </button>
        <span className="text-sm text-text-secondary">
          ({range[0]}–{range[1]})
        </span>
      </div>
    </Field>
  )
}

// P-06 (F-24). RN-29: changes only apply to cards created after saving, hence the confirmation.
export function CardConfigPage() {
  const { merchant } = useMerchantSession()
  const { signOut } = useAuth()
  const queryClient = useQueryClient()
  const adminRpc = useAdminRpc()
  const ids = { stamps: useId(), months: useId(), title: useId(), description: useId(), terms: useId(), hours: useId() }
  const fileInput = useRef<HTMLInputElement>(null)
  const queryKey = ['card-config', merchant.id]

  // Edits live apart from the loaded config so a refetch or an E-16 detour never loses them.
  const [draft, setDraft] = useState<Partial<CardForm>>({})
  const [serverErrors, setServerErrors] = useState<Partial<Record<CardField, string>>>({})
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
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
    mutationFn: async (form: CardForm) => {
      const parsed = cardFormSchema.parse(form)
      return toCardForm(
        await adminRpc(() =>
          supabase.rpc('update_card_config', {
            p_stamps_required: parsed.stamps_required,
            p_cycle_months: parsed.cycle_months,
            p_reward_title: parsed.reward_title,
            p_reward_description: parsed.reward_description,
            p_terms: parsed.terms,
            // WHY: generated types omit `null` for this arg (no DEFAULT), but the RPC accepts it to clear the image.
            p_card_background_path: parsed.card_background_path as string,
            p_push_coupon_validity_hours: parsed.push_coupon_validity_hours,
          }),
        ),
      )
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next)
      setDraft({})
      setLocalPreview(null)
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

  if (config.isPending)
    return (
      <p role="status" className="p-6 text-text-secondary">
        Cargando la configuración de tu tarjeta…
      </p>
    )
  if (config.isError)
    return (
      <div role="alert" className="mx-auto flex max-w-xl flex-col items-start gap-3 rounded-2xl bg-surface p-6">
        <p className="font-semibold">{ERRORS[describeError(config.error).code].message}</p>
        <button type="button" className={`${buttonClass} bg-navy text-white`} onClick={() => void config.refetch()}>
          Reintentar
        </button>
      </div>
    )

  const form: CardForm = { ...config.data, ...draft }
  const errors = { ...fieldErrors(form), ...serverErrors }
  const dirty = Object.keys(draft).length > 0
  const canSave = dirty && Object.keys(errors).length === 0 && !uploading && !save.isPending

  const edit = <K extends CardField>(field: K, value: CardForm[K]) => {
    setSaved(false)
    setSaveError(null)
    setServerErrors(({ [field]: _cleared, ...rest }) => rest)
    setDraft((prev) => (value === config.data[field] ? omit(prev, field) : { ...prev, [field]: value }))
  }

  const backgroundUrl =
    localPreview ??
    (form.card_background_path ? merchantImageUrl(import.meta.env.VITE_SUPABASE_URL ?? '', form.card_background_path, 'card', 1) : null)

  async function pickImage(file: File | undefined) {
    if (!file) return
    setImageError(null)
    setUploading(true)
    try {
      const variants = await createImageVariants(file, 'card')
      const path = await adminRpc(() => uploadCardBackground(merchant.id, variants))
      if (!path) throw new ImageProcessingError('ENCODE_FAILED', 'Sin ruta')
      // Preview the cropped result, not the raw file, so the merchant sees what customers will.
      const largest = variants[variants.length - 1]
      setLocalPreview((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(largest.blob)
      })
      edit('card_background_path', path)
    } catch (err) {
      const { code } = describeError(err)
      handleSessionError(code)
      setImageError(err instanceof ImageProcessingError ? imageErrorText[err.code] : ERRORS[code].message)
      if (!(err instanceof ImageProcessingError)) Sentry.captureException(err)
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function removeImage() {
    setLocalPreview(null)
    setImageError(null)
    edit('card_background_path', null)
  }

  return (
    <section aria-labelledby="card-title" className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <h1 id="card-title" className="text-2xl font-bold">
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
          <Stepper id={ids.stamps} label="Sellos para el premio" unit="sellos" range={CARD_LIMITS.stamps} value={form.stamps_required} error={errors.stamps_required} onChange={(v) => edit('stamps_required', v)} />
          <Stepper id={ids.months} label="Vigencia del ciclo" unit="meses" range={CARD_LIMITS.months} value={form.cycle_months} error={errors.cycle_months} onChange={(v) => edit('cycle_months', v)} />
          <Field id={ids.title} label="Título del premio" error={errors.reward_title} counter={`${form.reward_title.length}/${CARD_LIMITS.title}`}>
            <input id={ids.title} className={inputClass} value={form.reward_title} aria-invalid={!!errors.reward_title} aria-describedby={`${ids.title}-error`} onChange={(e) => edit('reward_title', e.target.value)} />
          </Field>
          <Field id={ids.description} label="Descripción del premio" error={errors.reward_description} counter={`${form.reward_description.length}/${CARD_LIMITS.description}`}>
            <textarea id={ids.description} rows={3} className={inputClass} value={form.reward_description} aria-invalid={!!errors.reward_description} aria-describedby={`${ids.description}-error`} onChange={(e) => edit('reward_description', e.target.value)} />
          </Field>
          <Field id={ids.terms} label="Términos y condiciones (opcional)" error={errors.terms} counter={`${form.terms.length}/${CARD_LIMITS.terms}`}>
            <textarea id={ids.terms} rows={4} className={inputClass} value={form.terms} aria-invalid={!!errors.terms} aria-describedby={`${ids.terms}-error`} onChange={(e) => edit('terms', e.target.value)} />
          </Field>
          <Stepper id={ids.hours} label="Vigencia de cupones push" unit="horas" range={CARD_LIMITS.hours} value={form.push_coupon_validity_hours} error={errors.push_coupon_validity_hours} onChange={(v) => edit('push_coupon_validity_hours', v)} />

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
          <button type="submit" disabled={!canSave} className={`${buttonClass} h-14 bg-navy text-white hover:bg-brand sm:self-start`}>
            Guardar cambios
          </button>
        </form>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
          <h2 className="font-semibold">Vista previa</h2>
          <CardPreview merchantName={merchant.name} stampsRequired={form.stamps_required} rewardTitle={form.reward_title} backgroundUrl={backgroundUrl} />
          <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
            <p className="font-semibold">Imagen de fondo</p>
            <p className="text-sm text-text-secondary">Se recorta al centro con proporción de tarjeta (1.586:1). Máximo 10 MB.</p>
            <input ref={fileInput} type="file" accept="image/*" aria-label="Elegir imagen de fondo" className="sr-only" onChange={(e) => void pickImage(e.target.files?.[0])} />
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={uploading} className={`${buttonClass} border border-black/15 hover:bg-surface-muted`} onClick={() => fileInput.current?.click()}>
                {uploading ? 'Subiendo…' : form.card_background_path ? 'Cambiar imagen' : 'Elegir imagen'}
              </button>
              {form.card_background_path && (
                <button type="button" disabled={uploading} className={`${buttonClass} text-error hover:bg-surface-muted`} onClick={removeImage}>
                  Quitar imagen
                </button>
              )}
            </div>
            {imageError && (
              <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-error">
                <AlertIcon className="size-4 shrink-0" />
                {imageError}
              </p>
            )}
          </div>
        </aside>
      </div>

      {confirming && (
        <ModalDialog labelledBy="confirm-title" onClose={() => !save.isPending && setConfirming(false)}>
          <h2 id="confirm-title" className="text-xl font-semibold">
            ¿Guardar los cambios?
          </h2>
          <p>Los cambios aplicarán a las tarjetas nuevas. Las tarjetas que tus clientes ya tienen no se modifican.</p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" disabled={save.isPending} className={`${buttonClass} border border-black/15 hover:bg-surface-muted`} onClick={() => setConfirming(false)}>
              Cancelar
            </button>
            <button type="button" disabled={save.isPending} className={`${buttonClass} bg-navy text-white hover:bg-brand`} onClick={() => save.mutate(form)}>
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
