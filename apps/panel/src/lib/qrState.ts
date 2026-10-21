import type { ErrorCode } from '@ekko/shared'
import { z } from 'zod'

// F-21 state machine for the visit QR (US-19). Times are monotonic milliseconds
// (performance.now()), never wall-clock: see `success`.
export type VisitQr = { id: string; token: string; ttlSeconds: number }

export type QrState =
  | { status: 'idle' }
  | { status: 'pending'; requestedAt: number }
  | { status: 'active'; qr: VisitQr; deadline: number; remaining: number }
  | { status: 'expired' }
  | { status: 'invalidated' }
  | { status: 'used' }
  | { status: 'error'; code: ErrorCode }

// Backend §4.4 get_qr_status / §8 Realtime. Terminal = everything but 'pending'.
export type RemoteQrStatus = 'pending' | 'used' | 'expired' | 'invalidated'
export type TerminalQrStatus = Exclude<RemoteQrStatus, 'pending'>

export type QrAction =
  | { type: 'request'; now: number }
  | { type: 'success'; qr: VisitQr }
  | { type: 'tick'; now: number }
  | { type: 'failure'; code: ErrorCode }
  | { type: 'resolved'; qrId: string; status: TerminalQrStatus }
  | { type: 'dismiss' }

const remainingAt = (deadline: number, now: number) => Math.max(0, Math.ceil((deadline - now) / 1000))

export function qrReducer(state: QrState, action: QrAction): QrState {
  switch (action.type) {
    case 'request':
      return { status: 'pending', requestedAt: action.now }
    case 'success': {
      if (state.status !== 'pending') return state
      // WHY: the countdown never compares expires_at with the tablet clock (it may be skewed).
      // It counts ttl_seconds from the moment we *sent* the request: the server set
      // expires_at after receiving it, so our deadline is never later than the server's.
      const deadline = state.requestedAt + action.qr.ttlSeconds * 1000
      return { status: 'active', qr: action.qr, deadline, remaining: action.qr.ttlSeconds }
    }
    case 'tick': {
      if (state.status !== 'active') return state
      const remaining = remainingAt(state.deadline, action.now)
      if (remaining === 0) return { status: 'expired' }
      return remaining === state.remaining ? state : { ...state, remaining }
    }
    case 'failure':
      return state.status === 'pending' ? { status: 'error', code: action.code } : state
    // WHY: Realtime, polling and the local countdown race each other. Only the QR on screen can
    // be resolved, and only once: the first terminal result wins, anything later is a no-op.
    case 'resolved':
      return state.status === 'active' && state.qr.id === action.qrId ? { status: action.status } : state
    case 'dismiss':
      return state.status === 'used' ? { status: 'idle' } : state
  }
}

// F-21 J: Realtime is the source while SUBSCRIBED; any error/close, or no SUBSCRIBED within 3 s
// (TIMEOUT, our own timer), falls back to polling until the channel subscribes again.
export type SyncMode = 'connecting' | 'realtime' | 'polling'
export type SyncEvent = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMEOUT'

export function nextSyncMode(mode: SyncMode, event: SyncEvent): SyncMode {
  if (event === 'SUBSCRIBED') return 'realtime'
  if (event === 'TIMEOUT') return mode === 'connecting' ? 'polling' : mode
  return 'polling'
}

// Realtime UPDATE row (the merchant can only read id, merchant_id, dates). Expiry has no UPDATE.
export function statusFromRow(row: { used_at?: string | null; invalidated_at?: string | null }): TerminalQrStatus | null {
  if (row.used_at) return 'used'
  if (row.invalidated_at) return 'invalidated'
  return null
}

const qrStatusSchema = z.object({ status: z.enum(['pending', 'used', 'expired', 'invalidated']) })
export const parseQrStatus = (data: unknown): RemoteQrStatus => qrStatusSchema.parse(data).status

// Text for the aria-live region. It only changes at 30 s, 10 s and expiry, so screen
// readers announce those three moments instead of every second.
export function qrAnnouncement(state: QrState): string {
  if (state.status === 'expired') return 'El QR venció. Genera otro.'
  if (state.status === 'invalidated') return 'El QR se reemplazó. Genera otro.'
  if (state.status === 'used') return 'Visita registrada'
  if (state.status !== 'active' || state.remaining > 30) return ''
  return state.remaining > 10 ? 'Quedan 30 segundos.' : 'Quedan 10 segundos.'
}

// Backend §4.4 generate_visit_qr. Validated so a malformed payload can never end up in the QR URL.
const visitQrSchema = z.object({
  qr_id: z.uuid(),
  token: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  ttl_seconds: z.number().int().positive(),
})

export function parseVisitQr(data: unknown): VisitQr {
  const { qr_id, token, ttl_seconds } = visitQrSchema.parse(data)
  return { id: qr_id, token, ttlSeconds: ttl_seconds }
}
