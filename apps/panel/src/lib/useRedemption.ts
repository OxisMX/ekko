import { parseRpcError, type ErrorCode } from '@ekko/shared'
import * as Sentry from '@sentry/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import { supabase } from './supabase'

const couponSchema = z.object({
  coupon_id: z.string(),
  customer_full_name: z.string(),
  title: z.string(),
  description: z.string(),
  terms: z.string().nullable(),
  source: z.enum(['card_reward', 'wheel', 'push', 'birthday']),
  expires_at: z.string(),
})
export type RedemptionCoupon = z.infer<typeof couponSchema>

// Contract: backend §4.4 lookup_redemption. "Not found" returns ok:false (does not throw) so the
// anti-guessing counter persists.
const lookupSchema = z.discriminatedUnion('ok', [
  couponSchema.extend({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    error: z.enum(['E-12', 'E-13']),
    remaining: z.number().optional(),
    locked_until: z.string().optional(),
  }),
])
const confirmSchema = z.object({ redeemed_at: z.string() })

export type LookupOutcome =
  | { kind: 'found'; coupon: RedemptionCoupon }
  | { kind: 'invalid'; remaining: number }
  | { kind: 'locked'; until: number }

// Thrown for RPC failures; `lockedUntil` only comes with E-13.
export class RedemptionError extends Error {
  code: ErrorCode
  lockedUntil: number | null
  constructor(code: ErrorCode, lockedUntil: number | null = null) {
    super(code)
    this.code = code
    this.lockedUntil = lockedUntil
  }
}

export function toRedemptionError(err: { message?: string; details?: string | null; code?: string }) {
  // WHY: fetch failures (offline) carry no `code`; real RPC errors always do.
  if (!err.code) return new RedemptionError('E-01')
  if (err.code === 'PGRST301' || err.code === 'PGRST303') return new RedemptionError('E-18')
  const { code, details } = parseRpcError(err)
  const lockedUntil = typeof details?.locked_until === 'string' ? Date.parse(details.locked_until) : NaN
  return new RedemptionError(code, Number.isNaN(lockedUntil) ? null : lockedUntil)
}

export function parseLookup(data: unknown): LookupOutcome {
  const parsed = lookupSchema.parse(data)
  if (parsed.ok) return { kind: 'found', coupon: parsed }
  if (parsed.error === 'E-12' && parsed.remaining !== undefined) return { kind: 'invalid', remaining: parsed.remaining }
  if (parsed.error === 'E-13' && parsed.locked_until !== undefined) return { kind: 'locked', until: Date.parse(parsed.locked_until) }
  throw new z.ZodError([{ code: 'custom', path: [], message: `${parsed.error} without its detail` }])
}

// What the validator shows. `idle` is the empty code field (with an optional notice under it).
export type RedemptionPhase =
  | { name: 'idle'; notice?: { code: ErrorCode; remaining?: number } }
  | { name: 'found'; coupon: RedemptionCoupon; confirmError?: ErrorCode }
  | { name: 'done' }
  | { name: 'locked'; until: number }

const SUCCESS_MS = 3000

export function useRedemption(initialLockedUntil: string | null) {
  const { signOut } = useAuth()
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<RedemptionPhase>(() => {
    const until = initialLockedUntil ? Date.parse(initialLockedUntil) : NaN
    return until > Date.now() ? { name: 'locked', until } : { name: 'idle' }
  })
  const [now, setNow] = useState(() => Date.now())

  // Session-level failures are handled in one place; returns true when the error was consumed.
  const handleSessionError = useCallback(
    (err: RedemptionError) => {
      if (err.code === 'E-05') void queryClient.invalidateQueries({ queryKey: ['merchant-session'] })
      else if (err.code === 'E-18' || err.code === 'E-19') void signOut(err.code)
      else return false
      return true
    },
    [queryClient, signOut],
  )
  const reportUnexpected = (err: unknown) => {
    if (err instanceof z.ZodError || (err instanceof RedemptionError && err.code === 'E-99')) Sentry.captureException(err)
  }
  const asRedemptionError = (err: unknown) => (err instanceof RedemptionError ? err : new RedemptionError('E-99'))

  const lookup = useMutation({
    mutationFn: async (code: string): Promise<LookupOutcome> => {
      const { data, error } = await supabase.rpc('lookup_redemption', { p_code: code })
      if (error) throw toRedemptionError(error)
      return parseLookup(data)
    },
    onSuccess: (outcome) => {
      if (outcome.kind === 'found') setPhase({ name: 'found', coupon: outcome.coupon })
      else if (outcome.kind === 'invalid') setPhase({ name: 'idle', notice: { code: 'E-12', remaining: outcome.remaining } })
      else setPhase({ name: 'locked', until: outcome.until })
    },
    onError: (err) => {
      reportUnexpected(err)
      const error = asRedemptionError(err)
      if (handleSessionError(error)) return
      if (error.code === 'E-13' && error.lockedUntil) setPhase({ name: 'locked', until: error.lockedUntil })
      else setPhase({ name: 'idle', notice: { code: error.code } })
    },
  })

  const confirm = useMutation({
    mutationFn: async (couponId: string) => {
      const { data, error } = await supabase.rpc('confirm_redemption', { p_coupon_id: couponId })
      if (error) throw toRedemptionError(error)
      return confirmSchema.parse(data)
    },
    onSuccess: () => setPhase({ name: 'done' }),
    onError: (err) => {
      reportUnexpected(err)
      const error = asRedemptionError(err)
      if (handleSessionError(error)) return
      // E-01 keeps the result open so "Confirmar canje" works as the retry; the rest are final.
      setPhase(
        error.code === 'E-01' && phase.name === 'found'
          ? { ...phase, confirmError: 'E-01' }
          : { name: 'idle', notice: { code: error.code } },
      )
    },
  })

  const isDone = phase.name === 'done'
  useEffect(() => {
    if (!isDone) return
    const id = setTimeout(() => setPhase({ name: 'idle' }), SUCCESS_MS)
    return () => clearTimeout(id)
  }, [isDone])

  const lockedUntil = phase.name === 'locked' ? phase.until : null
  useEffect(() => {
    if (lockedUntil === null) return
    const tick = () => {
      setNow(Date.now())
      if (Date.now() >= lockedUntil) setPhase({ name: 'idle' })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [lockedUntil])

  const secondsLeft = lockedUntil === null ? 0 : Math.max(0, Math.ceil((lockedUntil - now) / 1000))

  return {
    phase,
    secondsLeft,
    isLookingUp: lookup.isPending,
    isConfirming: confirm.isPending,
    lookup: (code: string) => {
      if (!lookup.isPending) lookup.mutate(code)
    },
    confirm: (couponId: string) => {
      if (!confirm.isPending) confirm.mutate(couponId)
    },
    cancel: () => setPhase({ name: 'idle' }),
  }
}
