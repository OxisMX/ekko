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
  | { status: 'error'; code: ErrorCode }

export type QrAction =
  | { type: 'request'; now: number }
  | { type: 'success'; qr: VisitQr }
  | { type: 'tick'; now: number }
  | { type: 'failure'; code: ErrorCode }

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
  }
}

// Text for the aria-live region. It only changes at 30 s, 10 s and expiry, so screen
// readers announce those three moments instead of every second.
export function qrAnnouncement(state: QrState): string {
  if (state.status === 'expired') return 'El QR venció. Genera otro.'
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
