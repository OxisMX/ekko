import { ERRORS, PUSH_COUPON_VALIDITY_OPTIONS } from '@ekko/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { ModalDialog } from '../components/ModalDialog'
import { AlertIcon, BellIcon, CheckCircleIcon } from '../components/Icons'
import { useAdminRpc } from '../lib/adminUnlockContext'
import { toCardForm, updateCardConfig } from '../lib/cardConfig'
import { describeMenuError, useMenuFailure } from '../lib/menu'
import {
  formatCampaignDate,
  formatResetDate,
  invokeSendPush,
  PUSH_CAMPAIGNS_KEY,
  PUSH_LIMITS,
  PUSH_STATUS_KEY,
  pushStatusSchema,
  SERVER_FIELD,
  toCampaigns,
  validatePush,
  type PushBody,
  type PushCampaign,
  type PushField,
  type PushForm,
  type PushStatus,
  type SendResult,
} from '../lib/push'
import { supabase } from '../lib/supabase'
import { Field } from '../components/FormField'
import { btnPrimary, btnSecondary, input, Switch } from '../components/ui'

const STATUS_LABEL: Record<PushCampaign['status'], string> = { sending: 'Enviando', sent: 'Enviada', failed: 'Fallida' }
const UNKNOWN_STATE = 'No sabemos si se envió. Revisa el historial antes de reintentar.'

type Outcome = { kind: 'success'; result: SendResult } | { kind: 'unknown' } | { kind: 'error'; message: string }

// Same wording as the app's coupon card (relativeExpiry): hours under a day, whole days after.
function expiryText(hours: number, now = new Date()) {
  const days = Math.floor(hours / 24)
  const relative = days < 1 ? `Vence en ${hours} h` : `Vence en ${days} ${days === 1 ? 'día' : 'días'}`
  const date = new Date(now.getTime() + hours * 3_600_000).toLocaleDateString('es-MX', { dateStyle: 'medium' })
  return `${relative} · ${date}`
}

function Preview({ form }: { form: PushForm }) {
  const hours = Number(form.couponHours)
  return (
    <div aria-label="Vista previa" role="group" className="flex flex-col gap-3">
      <p className="font-semibold">Así lo verá tu cliente</p>
      <div className="flex gap-3 rounded-2xl bg-surface-card p-3 shadow-sm">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy font-bold text-white">E</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-text-secondary uppercase">Ekko · ahora</p>
          <p className="truncate font-semibold">{form.title || 'Título de la notificación'}</p>
          <p className="line-clamp-3 text-sm break-words">{form.body || 'Aquí aparecerá tu mensaje.'}</p>
        </div>
      </div>
      {form.withCoupon && (
        // Ticket shape like the app's CouponCard: two side notches on a dashed divider (P-38).
        <div className="rounded-card bg-surface-muted" data-testid="coupon-preview">
          <div className="flex flex-col gap-1 p-4">
            <p className="text-xs font-semibold tracking-wide text-text-secondary uppercase">Promoción</p>
            <p className="text-lg font-bold break-words">{form.couponTitle || 'Beneficio del cupón'}</p>
            {form.couponDescription && <p className="text-sm break-words">{form.couponDescription}</p>}
            <p className="text-sm">{hours > 0 ? expiryText(hours) : 'Vigencia pendiente'}</p>
            {form.couponTerms && <p className="text-xs break-words text-text-secondary">{form.couponTerms}</p>}
          </div>
          <div aria-hidden="true" className="relative border-t-2 border-dashed border-text-secondary/40">
            <span className="absolute top-0 -left-2.5 size-5 -translate-y-1/2 rounded-full bg-surface" />
            <span className="absolute top-0 -right-2.5 size-5 -translate-y-1/2 rounded-full bg-surface" />
          </div>
          <div className="p-4">
            {/* Inert on purpose: only shows how the action looks in the app. */}
            <span aria-hidden="true" className="grid min-h-12 place-items-center rounded-button border border-black/15 font-semibold">Mostrar código</span>
          </div>
        </div>
      )}
    </div>
  )
}

function History({ campaigns }: { campaigns: PushCampaign[] }) {
  if (campaigns.length === 0)
    return <p className="text-text-secondary">Aún no has enviado notificaciones. Tu primer envío aparecerá aquí.</p>
  return (
    <ul className="flex flex-col divide-y divide-black/10">
      {campaigns.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
          <div className="min-w-0">
            <p className="font-semibold break-words">
              {c.title}
              {c.has_coupon && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-text-primary">Con cupón</span>}
            </p>
            <p className="text-sm text-text-secondary">{formatCampaignDate(c.created_at)}</p>
          </div>
          <p className="text-sm">
            <span className="font-semibold">{STATUS_LABEL[c.status]}</span> · {c.sent_count} entregadas, {c.failed_count} fallidas de {c.recipients_count}
          </p>
        </li>
      ))}
    </ul>
  )
}

// P-10 (F-27).
export function PushPage() {
  const queryClient = useQueryClient()
  const adminRpc = useAdminRpc()
  const failure = useMenuFailure()
  const ids = { title: useId(), body: useId(), couponTitle: useId(), couponDescription: useId(), couponTerms: useId(), couponHours: useId(), defaultHours: useId() }
  // WHY: the key survives retries of the SAME content so the server returns the stored result instead of sending twice.
  const attempt = useRef<{ key: string; signature: string } | null>(null)

  const [draft, setDraft] = useState<Partial<PushForm>>({})
  const [serverErrors, setServerErrors] = useState<Partial<Record<PushField, string>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [pendingBody, setPendingBody] = useState<PushBody | null>(null)
  const [sending, setSending] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [defaultHours, setDefaultHours] = useState<string | null>(null)

  const status = useQuery({
    queryKey: PUSH_STATUS_KEY,
    queryFn: async (): Promise<PushStatus> => pushStatusSchema.parse(await adminRpc(() => supabase.rpc('get_push_status'))),
  })
  const campaigns = useQuery({
    queryKey: PUSH_CAMPAIGNS_KEY,
    queryFn: async () => toCampaigns(await adminRpc(() => supabase.rpc('list_push_campaigns'))),
  })
  // P-31: the default validity lives in the card config, so it is saved with the current values of that config.
  const saveDefault = useMutation({
    mutationFn: async (hours: number) => {
      const current = toCardForm(await adminRpc(() => supabase.rpc('get_card_config')))
      return adminRpc(() => updateCardConfig({ ...current, push_coupon_validity_hours: hours }))
    },
    onSuccess: async () => {
      setDefaultHours(null)
      await Promise.all([queryClient.invalidateQueries({ queryKey: PUSH_STATUS_KEY }), queryClient.invalidateQueries({ queryKey: ['card-config'] })])
    },
  })
  const refreshAll = () => Promise.all([queryClient.invalidateQueries({ queryKey: PUSH_STATUS_KEY }), queryClient.invalidateQueries({ queryKey: PUSH_CAMPAIGNS_KEY })])

  if (status.isPending)
    return (
      <section aria-labelledby="push-title" className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 id="push-title" className="text-h1 font-bold">Notificaciones push</h1>
        <div role="status" aria-label="Cargando las notificaciones" className="h-40 animate-pulse rounded-2xl bg-surface" />
      </section>
    )
  if (status.isError)
    return (
      <div role="alert" className="mx-auto flex max-w-xl flex-col items-start gap-3 rounded-2xl bg-surface p-6">
        <p className="font-semibold">{failure(status.error).message}</p>
        <button type="button" className={btnPrimary} onClick={() => void status.refetch()}>Reintentar</button>
      </div>
    )

  const { remaining_this_month: remaining, limit, resets_on, recipients_count, eligible_recipients: eligible } = status.data
  const exhausted = remaining <= 0
  const form: PushForm = {
    title: '',
    body: '',
    withCoupon: false,
    couponTitle: '',
    couponDescription: '',
    couponTerms: '',
    couponHours: String(status.data.push_coupon_validity_hours),
    ...draft,
  }
  const errors = { ...(submitted ? validatePush(form).errors : null), ...serverErrors }

  const edit = <K extends keyof PushForm>(field: K, value: PushForm[K]) => {
    setOutcome(null)
    setServerErrors(({ [field as PushField]: _cleared, ...rest }) => rest)
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  function requestConfirmation() {
    setSubmitted(true)
    const validated = validatePush(form)
    if (validated.body) setPendingBody(validated.body)
  }

  async function send(body: PushBody) {
    const signature = JSON.stringify(body)
    if (attempt.current?.signature !== signature) attempt.current = { key: crypto.randomUUID(), signature }
    const idempotency_key = attempt.current.key
    setSending(true)
    setOutcome(null)
    try {
      const result = await adminRpc(() => invokeSendPush({ ...body, idempotency_key }))
      attempt.current = null
      setOutcome({ kind: 'success', result: result as SendResult })
      setDraft({})
      setSubmitted(false)
    } catch (err) {
      const { code, field } = describeMenuError(err)
      const serverField = field ? SERVER_FIELD[field] : undefined
      if (code === 'E-01') setOutcome({ kind: 'unknown' })
      else if (code === 'E-23' && serverField) setServerErrors((prev) => ({ ...prev, [serverField]: ERRORS['E-23'].message }))
      else setOutcome({ kind: 'error', message: failure(err).message })
    } finally {
      setPendingBody(null)
      setSending(false)
      await refreshAll()
    }
  }

  return (
    <section aria-labelledby="push-title" className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 id="push-title" className="text-h1 font-bold">Notificaciones push</h1>

      <div className="flex items-center gap-4 rounded-2xl bg-surface p-5">
        <BellIcon className="size-8 shrink-0 text-navy" />
        <div>
          <p className="text-lg font-semibold">Te quedan {remaining} de {limit} envíos este mes</p>
          <p className="text-text-secondary">Se reinicia el {formatResetDate(resets_on)}</p>
          <p className="text-text-secondary">Llegará a {eligible} {eligible === 1 ? 'cliente' : 'clientes'}</p>
        </div>
      </div>

      <form
        className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (defaultHours !== null) saveDefault.mutate(Number(defaultHours))
        }}
      >
        <Field id={ids.defaultHours} label="Vigencia predeterminada">
          <select id={ids.defaultHours} className={input} value={defaultHours ?? String(status.data.push_coupon_validity_hours)} onChange={(e) => setDefaultHours(e.target.value === String(status.data.push_coupon_validity_hours) ? null : e.target.value)}>
            {PUSH_COUPON_VALIDITY_OPTIONS.map((h) => <option key={h} value={h}>{h} h</option>)}
          </select>
        </Field>
        <button type="submit" disabled={defaultHours === null || saveDefault.isPending} className={btnSecondary}>
          {saveDefault.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        <p className="basis-full text-sm text-text-secondary">Se propone en cada cupón nuevo; puedes cambiarla al enviar.</p>
        {saveDefault.isError && (
          <p role="alert" className="flex basis-full items-center gap-2 font-medium text-error">
            <AlertIcon className="size-5 shrink-0" />
            {failure(saveDefault.error).message}
          </p>
        )}
      </form>

      <div aria-live="polite" className="empty:hidden">
        {outcome?.kind === 'success' && (
          <p role="status" className="flex items-center gap-2 font-medium text-success">
            <CheckCircleIcon className="size-5 shrink-0" />
            Enviada a {outcome.result.recipients} clientes: {outcome.result.sent} entregadas, {outcome.result.failed} fallidas.
          </p>
        )}
        {outcome?.kind === 'unknown' && (
          <p role="alert" className="flex items-center gap-2 font-medium text-error">
            <AlertIcon className="size-5 shrink-0" />
            {UNKNOWN_STATE}
          </p>
        )}
        {outcome?.kind === 'error' && (
          <p role="alert" className="flex items-center gap-2 font-medium text-error">
            <AlertIcon className="size-5 shrink-0" />
            {outcome.message}
          </p>
        )}
      </div>

      {exhausted && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl bg-surface p-5 font-semibold text-error">
          <AlertIcon className="size-5 shrink-0" />
          {ERRORS['E-17'].message} Podrás enviar de nuevo a partir del {formatResetDate(resets_on)}.
        </p>
      )}

      <form className="grid gap-6 rounded-2xl bg-surface p-6 md:grid-cols-[1fr_18rem]" noValidate onSubmit={(e) => { e.preventDefault(); if (!sending) requestConfirmation() }}>
        <fieldset disabled={exhausted} className="flex flex-col gap-5">
          <legend className="sr-only">Redactar notificación</legend>
          <Field id={ids.title} label="Título" error={errors.title} counter={`${form.title.length}/${PUSH_LIMITS.title}`}>
            <p id={`${ids.title}-hint`} className="text-sm text-text-secondary">Incluye el nombre de tu negocio</p>
            <input id={ids.title} className={input} value={form.title} aria-invalid={!!errors.title} aria-describedby={`${ids.title}-hint ${ids.title}-error`} onChange={(e) => edit('title', e.target.value)} />
          </Field>
          <Field id={ids.body} label="Mensaje" error={errors.body} counter={`${form.body.length}/${PUSH_LIMITS.body}`}>
            <textarea id={ids.body} rows={3} className={input} value={form.body} aria-invalid={!!errors.body} aria-describedby={`${ids.body}-error`} onChange={(e) => edit('body', e.target.value)} />
          </Field>

          <Switch label="Adjuntar cupón" text="Adjuntar cupón" checked={form.withCoupon} onChange={(v) => edit('withCoupon', v)} />
          {form.withCoupon && (
            <>
              <Field id={ids.couponTitle} label="Beneficio" error={errors.couponTitle} counter={`${form.couponTitle.length}/${PUSH_LIMITS.couponTitle}`}>
                <input id={ids.couponTitle} className={input} value={form.couponTitle} placeholder="Ej. 2x1 en cafés" aria-invalid={!!errors.couponTitle} aria-describedby={`${ids.couponTitle}-error`} onChange={(e) => edit('couponTitle', e.target.value)} />
              </Field>
              <Field id={ids.couponDescription} label="Restricciones" error={errors.couponDescription} counter={`${form.couponDescription.length}/${PUSH_LIMITS.couponDescription}`}>
                <textarea id={ids.couponDescription} rows={2} className={input} value={form.couponDescription} aria-invalid={!!errors.couponDescription} aria-describedby={`${ids.couponDescription}-error`} onChange={(e) => edit('couponDescription', e.target.value)} />
              </Field>
              <Field id={ids.couponTerms} label="Términos" error={errors.couponTerms} counter={`${form.couponTerms.length}/${PUSH_LIMITS.couponTerms}`}>
                <textarea id={ids.couponTerms} rows={3} className={input} value={form.couponTerms} aria-invalid={!!errors.couponTerms} aria-describedby={`${ids.couponTerms}-error`} onChange={(e) => edit('couponTerms', e.target.value)} />
              </Field>
              <Field id={ids.couponHours} label="Vigencia del cupón" error={errors.couponHours}>
                <select id={ids.couponHours} className={input} value={form.couponHours} aria-invalid={!!errors.couponHours} aria-describedby={`${ids.couponHours}-error`} onChange={(e) => edit('couponHours', e.target.value)}>
                  {PUSH_COUPON_VALIDITY_OPTIONS.map((h) => <option key={h} value={h}>{h} h</option>)}
                </select>
              </Field>
            </>
          )}
        </fieldset>

        <Preview form={form} />

        <div className="md:col-span-2">
          <button type="submit" disabled={exhausted || sending} className={`${btnPrimary} h-14`}>
            {sending ? 'Enviando…' : 'Enviar notificación'}
          </button>
        </div>
      </form>

      <section aria-labelledby="history-title" className="flex flex-col gap-3 rounded-2xl bg-surface p-5">
        <h2 id="history-title" className="text-lg font-semibold">Historial de envíos</h2>
        {campaigns.isPending && <p role="status" className="text-text-secondary">Cargando el historial…</p>}
        {campaigns.isError && (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="font-medium text-error">{failure(campaigns.error).message}</p>
            <button type="button" className={btnSecondary} onClick={() => void campaigns.refetch()}>Reintentar</button>
          </div>
        )}
        {campaigns.data && <History campaigns={campaigns.data} />}
      </section>

      {pendingBody && (
        <ModalDialog labelledBy="confirm-push-title" onClose={() => !sending && setPendingBody(null)}>
          <h2 id="confirm-push-title" className="text-h2 font-semibold">¿Enviar esta notificación?</h2>
          <p>Se enviará a {recipients_count} clientes. Te quedarán {remaining - 1} de {limit}.</p>
          {pendingBody.coupon && <p>Cada cliente recibirá el cupón aunque tenga las notificaciones desactivadas.</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" disabled={sending} className={btnSecondary} onClick={() => setPendingBody(null)}>Cancelar</button>
            <button type="button" disabled={sending} className={btnPrimary} onClick={() => void send(pendingBody)}>{sending ? 'Enviando…' : 'Enviar ahora'}</button>
          </div>
        </ModalDialog>
      )}
    </section>
  )
}
