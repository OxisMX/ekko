import { describe, expect, it } from 'vitest'
import { parseVisitQr, qrAnnouncement, qrReducer, type QrState, type VisitQr } from './qrState'

const QR: VisitQr = { id: 'q1', token: 'AbCdEfGhIjKlMnOpQrStU_', ttlSeconds: 60 }
const QR2: VisitQr = { ...QR, id: 'q2', token: 'zzzzzzzzzzzzzzzzzzzzz-' }

const idle: QrState = { status: 'idle' }
const activeAt = (requestedAt: number, qr = QR) =>
  qrReducer(qrReducer(idle, { type: 'request', now: requestedAt }), { type: 'success', qr })

describe('qrReducer', () => {
  it('idle → pending on request', () => {
    expect(qrReducer(idle, { type: 'request', now: 1000 })).toEqual({ status: 'pending', requestedAt: 1000 })
  })

  it('pending → active with the full TTL, deadline counted from the request (never generous)', () => {
    expect(activeAt(1000)).toEqual({ status: 'active', qr: QR, deadline: 61_000, remaining: 60 })
  })

  it('tick updates remaining seconds, rounding up', () => {
    const state = qrReducer(activeAt(0), { type: 'tick', now: 30_500 })
    expect(state).toMatchObject({ status: 'active', remaining: 30 })
    expect(qrReducer(activeAt(0), { type: 'tick', now: 50_001 })).toMatchObject({ remaining: 10 })
  })

  it('tick within the same second returns the same object (no re-render)', () => {
    const state = activeAt(0)
    expect(qrReducer(state, { type: 'tick', now: 200 })).toBe(state)
  })

  it('active → expired when the deadline is reached', () => {
    expect(qrReducer(activeAt(0), { type: 'tick', now: 60_000 })).toEqual({ status: 'expired' })
    expect(qrReducer(activeAt(0), { type: 'tick', now: 999_999 })).toEqual({ status: 'expired' })
  })

  it('regenerate while active: pending, then the new QR with a fresh TTL', () => {
    const pending = qrReducer(qrReducer(activeAt(0), { type: 'tick', now: 40_000 }), { type: 'request', now: 40_000 })
    expect(pending).toEqual({ status: 'pending', requestedAt: 40_000 })
    expect(qrReducer(pending, { type: 'success', qr: QR2 })).toEqual({
      status: 'active',
      qr: QR2,
      deadline: 100_000,
      remaining: 60,
    })
  })

  it('expired → pending on "Generar otro"', () => {
    expect(qrReducer({ status: 'expired' }, { type: 'request', now: 5 })).toEqual({ status: 'pending', requestedAt: 5 })
  })

  it('pending → error on failure, and error → pending on retry', () => {
    const error = qrReducer({ status: 'pending', requestedAt: 0 }, { type: 'failure', code: 'E-01' })
    expect(error).toEqual({ status: 'error', code: 'E-01' })
    expect(qrReducer(error, { type: 'request', now: 9 })).toEqual({ status: 'pending', requestedAt: 9 })
  })

  it('ignores a success or failure that arrives when no request is pending', () => {
    expect(qrReducer(idle, { type: 'success', qr: QR })).toBe(idle)
    const active = activeAt(0)
    expect(qrReducer(active, { type: 'failure', code: 'E-99' })).toBe(active)
  })

  it('ignores ticks outside the active state', () => {
    expect(qrReducer(idle, { type: 'tick', now: 1 })).toBe(idle)
  })
})

describe('qrAnnouncement (aria-live, only at 30 s, 10 s and expiry)', () => {
  const at = (remaining: number): QrState => ({ status: 'active', qr: QR, deadline: 0, remaining })
  it.each([
    [60, ''],
    [31, ''],
    [30, 'Quedan 30 segundos.'],
    [11, 'Quedan 30 segundos.'],
    [10, 'Quedan 10 segundos.'],
    [1, 'Quedan 10 segundos.'],
  ])('%i s → %j', (remaining, text) => {
    expect(qrAnnouncement(at(remaining))).toBe(text)
  })

  it('announces expiry', () => {
    expect(qrAnnouncement({ status: 'expired' })).toBe('El QR venció. Genera otro.')
    expect(qrAnnouncement(idle)).toBe('')
  })
})

describe('parseVisitQr (backend §4.4 generate_visit_qr)', () => {
  const raw = { qr_id: '6f1c1d1e-7b5a-4c1e-9a7b-1d2e3f4a5b6c', token: QR.token, expires_at: '2026-10-20T17:30:45Z', ttl_seconds: 60 }

  it('maps the RPC payload', () => {
    expect(parseVisitQr(raw)).toEqual({ id: raw.qr_id, token: QR.token, ttlSeconds: 60 })
  })

  it.each([
    ['short token', { ...raw, token: 'abc' }],
    ['token with URL-unsafe chars', { ...raw, token: 'AbCdEfGhIjKlMnOpQrSt/=' }],
    ['non-uuid id', { ...raw, qr_id: '1' }],
    ['non-positive ttl', { ...raw, ttl_seconds: 0 }],
    ['null', null],
  ])('rejects %s', (_name, value) => {
    expect(() => parseVisitQr(value)).toThrow()
  })
})
