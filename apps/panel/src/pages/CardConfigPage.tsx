import { ModalDialog } from '../components/ModalDialog'
import { ERRORS, merchantImageUrl, PUSH_COUPON_VALIDITY_OPTIONS } from '@ekko/shared'
import * as Sentry from '@sentry/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { CardPreview } from '../components/CardPreview'
import { AlertIcon, CheckCircleIcon } from '../components/Icons'
import { Field } from '../components/FormField'
import { ImagePicker } from '../components/ImagePicker'
import { useMerchantSession } from '../components/panelOutlet'
import { useAdminRpc } from '../lib/adminUnlockContext'
import {
  CARD_LIMITS,
  type CardField,
  type CardForm,
  cardFormSchema,
  describeError,
  fieldErrors,
  toCardForm,
} from '../lib/cardConfig'
import { supabase } from '../lib/supabase'
import { useMerchantImageUpload } from '../lib/useMerchantImageUpload'

const inputClass = 'w-full rounded-xl border border-black/20 bg-surface px-4 py-3 text-base'
const buttonClass = 'min-h-12 rounded-xl px-5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40'

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
            p_stamp_image_path: parsed.stamp_image_path as string,
          }),
        ),
      )
    },
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
          <Field id={ids.hours} label="Vigencia de cupones push" error={errors.push_coupon_validity_hours}>
            <select id={ids.hours} className={inputClass} value={form.push_coupon_validity_hours} aria-invalid={!!errors.push_coupon_validity_hours} aria-describedby={`${ids.hours}-error`} onChange={(e) => edit('push_coupon_validity_hours', Number(e.target.value))}>
              {PUSH_COUPON_VALIDITY_OPTIONS.map((h) => <option key={h} value={h}>{h} h</option>)}
            </select>
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
          <button type="submit" disabled={!canSave} className={`${buttonClass} h-14 bg-navy text-white hover:bg-brand sm:self-start`}>
            Guardar cambios
          </button>
        </form>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
          <h2 className="font-semibold">Vista previa</h2>
          <CardPreview merchantName={merchant.name} stampsRequired={form.stamps_required} rewardTitle={form.reward_title} backgroundUrl={backgroundUrl} stampImageUrl={stampUrl} />
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
