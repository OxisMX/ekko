import { ERRORS, type ErrorCode } from '@ekko/shared'
import * as Sentry from '@sentry/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { encode } from 'uqr'
import { ZodError } from 'zod'
import { useAuth } from '../auth/AuthContext'
import { toPanelErrorCode } from '../lib/panelRoute'
import { PUBLIC_APP_URL, visitQrUrl } from '../lib/publicAppUrl'
import { parseVisitQr, qrAnnouncement, qrReducer, type QrState, type TerminalQrStatus } from '../lib/qrState'
import { useQrStatusSync } from '../lib/useQrStatusSync'
import { supabase } from '../lib/supabase'
import { AlertIcon, CheckCircleIcon, QrIcon } from './Icons'

// QR modules drawn as JSX (no innerHTML). The white quiet zone is the stage padding around it.
export function QrSvg({ value, label, qrId }: { value: string; label: string; qrId?: string }) {
  const { size, d } = useMemo(() => {
    const { size, data } = encode(value, { ecc: 'M', border: 0 })
    let d = ''
    data.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x},${y}h1v1h-1z`)))
    return { size, d }
  }, [value])
  return (
    <svg
      role="img"
      aria-label={label}
      data-qr-id={qrId}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="size-[280px]"
    >
      <path d={d} fill="#000" />
    </svg>
  )
}

const ACCESS_ERRORS: ErrorCode[] = ['E-18', 'E-19']

function useVisitQr() {
  const [state, dispatch] = useReducer(qrReducer, { status: 'idle' })
  const { signOut } = useAuth()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('generate_visit_qr')
      if (error) throw error
      return parseVisitQr(data)
    },
    onSuccess: (qr) => dispatch({ type: 'success', qr }),
    onError: (error) => {
      const code = error instanceof ZodError ? 'E-99' : toPanelErrorCode(error)
      dispatch({ type: 'failure', code })
      // E-05: the merchant was deactivated; PanelGate sees is_active=false and sends to P-12.
      if (code === 'E-05') void queryClient.invalidateQueries({ queryKey: ['merchant-session'] })
      else if (ACCESS_ERRORS.includes(code)) void signOut(code)
      else if (code === 'E-99') Sentry.captureException(error)
    },
  })

  // WHY: performance.now() is monotonic; Date.now() jumps if the tablet clock is adjusted.
  const isActive = state.status === 'active'
  useEffect(() => {
    if (!isActive) return
    const id = setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 250)
    return () => clearInterval(id)
  }, [isActive])

  // F-21 G: Realtime (or the polling fallback) reports the scan; the reducer keeps the first result.
  const onResolved = useCallback(
    (qrId: string, status: TerminalQrStatus) => dispatch({ type: 'resolved', qrId, status }),
    [],
  )
  useQrStatusSync(state.status === 'active' ? state.qr.id : null, onResolved)

  // P-02: "Visita registrada" stays 3 s, then the panel is ready for the next customer.
  const isUsed = state.status === 'used'
  useEffect(() => {
    if (!isUsed) return
    const id = setTimeout(() => dispatch({ type: 'dismiss' }), 3000)
    return () => clearTimeout(id)
  }, [isUsed])

  const generate = () => {
    dispatch({ type: 'request', now: performance.now() })
    mutation.mutate()
  }
  return { state, generate }
}

const BUTTON_LABEL: Record<QrState['status'], string> = {
  idle: 'Generar QR',
  pending: 'Generando…',
  active: 'Generar otro',
  expired: 'Generar otro',
  invalidated: 'Generar otro',
  used: 'Generar QR',
  error: 'Reintentar',
}

const errorMessage = (code: ErrorCode) => (code === 'E-05' ? 'Tu negocio no está activo por ahora.' : ERRORS[code].message)

// P-02 left column (US-19, F-21). RT-10: ≥ 280 px QR, white margin, countdown.
export function VisitQrPanel() {
  const { state, generate } = useVisitQr()
  const secondary = state.status === 'active'

  return (
    <section aria-labelledby="qr-title" className="flex flex-col rounded-2xl bg-surface p-6">
      <div className="flex items-center gap-3">
        <QrIcon className="size-7 text-navy" />
        <h2 id="qr-title" className="text-xl font-semibold">
          Registrar visita
        </h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Después de cobrar, genera un QR para que tu cliente lo escanee con la app Ekko.
      </p>

      <div className="my-6 flex flex-1 flex-col items-center justify-center gap-4">
        {/* Fixed-size stage: 280 px code + 36 px white quiet zone, identical in every state (no layout jump). */}
        <div className="grid size-[352px] max-w-full shrink-0 place-items-center rounded-2xl bg-white">
          <QrStage state={state} />
        </div>
        <Countdown state={state} />
      </div>

      <p className="sr-only" aria-live="polite">
        {qrAnnouncement(state)}
      </p>

      <button
        type="button"
        onClick={generate}
        disabled={state.status === 'pending'}
        className={`h-14 w-full rounded-xl text-lg font-semibold transition-colors disabled:cursor-wait disabled:opacity-70 ${
          secondary ? 'border-2 border-navy text-navy hover:bg-surface-muted' : 'bg-navy text-white hover:bg-brand'
        }`}
      >
        {BUTTON_LABEL[state.status]}
      </button>
      <p className="mt-2 min-h-5 text-center text-sm text-text-secondary">
        {secondary ? 'Generar otro invalida el QR actual.' : 'Cada QR vale por una visita.'}
      </p>
    </section>
  )
}

function QrStage({ state }: { state: QrState }) {
  switch (state.status) {
    case 'active':
      return (
        <QrSvg
          value={visitQrUrl(state.qr.token, PUBLIC_APP_URL)}
          label={`Código QR de visita, vence en ${state.remaining} segundos`}
          qrId={state.qr.id}
        />
      )
    case 'pending':
      return (
        <Placeholder>
          <span
            aria-hidden="true"
            className="mx-auto block size-12 rounded-full border-4 border-black/10 border-t-navy motion-safe:animate-spin"
          />
          <p className="mt-4 font-semibold text-text-primary">Generando QR…</p>
        </Placeholder>
      )
    case 'expired':
      return (
        <Placeholder>
          <QrIcon className="mx-auto size-16 opacity-40" />
          <p className="mt-4 text-2xl font-semibold text-text-primary">QR vencido</p>
          <p className="mt-1 text-sm">Pasaron 60 segundos sin escanearse. Genera otro si el cliente aún lo necesita.</p>
        </Placeholder>
      )
    case 'used':
      return (
        <div className="grid size-full place-items-center rounded-2xl bg-success p-8 text-center text-white">
          <div>
            <CheckCircleIcon className="mx-auto size-20" />
            <p className="mt-4 text-3xl font-semibold">Visita registrada</p>
            <p className="mt-1">El cliente ya tiene su sello.</p>
          </div>
        </div>
      )
    case 'invalidated':
      return (
        <Placeholder>
          <QrIcon className="mx-auto size-16 opacity-40" />
          <p className="mt-4 text-2xl font-semibold text-text-primary">QR reemplazado</p>
          <p className="mt-1 text-sm">Se generó otro QR para este negocio. Genera uno nuevo si el cliente aún lo necesita.</p>
        </Placeholder>
      )
    case 'error':
      return (
        <Placeholder>
          <div role="alert">
            <AlertIcon className="mx-auto size-12 text-error" />
            <p className="mt-4 font-semibold text-text-primary">{errorMessage(state.code)}</p>
            <p className="mt-1 text-sm">No se generó el QR.</p>
          </div>
        </Placeholder>
      )
    case 'idle':
      return (
        <Placeholder dashed>
          <QrIcon className="mx-auto size-16" />
          <p className="mt-3 text-sm">El QR aparecerá aquí</p>
        </Placeholder>
      )
  }
}

function Placeholder({ dashed = false, children }: { dashed?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`grid size-full place-items-center rounded-2xl p-8 text-center text-text-secondary ${
        dashed ? 'border-2 border-dashed border-black/20' : 'bg-surface-muted'
      }`}
    >
      <div>{children}</div>
    </div>
  )
}

// Visible countdown. Not aria-live: the sr-only region announces 30 s, 10 s and expiry only.
function Countdown({ state }: { state: QrState }) {
  const active = state.status === 'active'
  const remaining = active ? state.remaining : 0
  const urgent = active && remaining <= 10
  const fraction = active ? remaining / state.qr.ttlSeconds : 0

  return (
    <div className={`w-[352px] max-w-full ${active ? '' : 'invisible'}`} aria-hidden={!active}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold tracking-[1.5px] text-text-secondary uppercase">
          {urgent ? 'Vence pronto' : 'Vence en'}
        </span>
        <span className={`text-5xl font-bold tabular-nums ${urgent ? 'text-error' : 'text-navy'}`}>{remaining} s</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
        <div
          className={`h-full origin-left rounded-full transition-transform duration-1000 ease-linear motion-reduce:transition-none ${
            urgent ? 'bg-error' : 'bg-navy'
          }`}
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>
    </div>
  )
}
