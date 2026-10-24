import type { ErrorCode } from '@ekko/shared'
import * as Sentry from '@sentry/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import type { MerchantSession } from './panelRoute'
import { supabase } from './supabase'
import { RedemptionError, toRedemptionError } from './useRedemption'
import { useNow } from './useNow'

// Contract: backend §4.5 unlock_admin. A wrong PIN returns ok:false (does not throw) so the
// attempt counter persists; E-15 comes back the same way on the attempt that locks.
const unlockSchema = z.discriminatedUnion('ok', [
  // failed_attempts: wrong PINs since the last correct one (P-S1); default 0 tolerates an older backend.
  z.object({ ok: z.literal(true), admin_unlocked_until: z.string(), failed_attempts: z.number().default(0) }),
  z.object({
    ok: z.literal(false),
    error: z.enum(['E-14', 'E-15']),
    remaining: z.number().optional(),
    locked_until: z.string().optional(),
  }),
])

export type UnlockOutcome = { kind: 'unlocked'; until: string; failedAttempts: number } | { kind: 'wrong'; remaining: number } | { kind: 'locked'; until: number }

export function parseUnlock(data: unknown): UnlockOutcome {
  const parsed = unlockSchema.parse(data)
  if (parsed.ok) return { kind: 'unlocked', until: parsed.admin_unlocked_until, failedAttempts: parsed.failed_attempts }
  if (parsed.error === 'E-14' && parsed.remaining !== undefined) return { kind: 'wrong', remaining: parsed.remaining }
  if (parsed.error === 'E-15' && parsed.locked_until !== undefined) return { kind: 'locked', until: Date.parse(parsed.locked_until) }
  throw new z.ZodError([{ code: 'custom', path: [], message: `${parsed.error} without its detail` }])
}

// Keeps every cached merchant-session (PanelGate's query) in step with what the RPCs just told us.
export function useMerchantSessionPatch() {
  const queryClient = useQueryClient()
  return (patch: Partial<MerchantSession>) =>
    queryClient.setQueriesData<MerchantSession>({ queryKey: ['merchant-session'] }, (old) => old && { ...old, ...patch })
}

export type UnlockNotice = { code: ErrorCode; remaining?: number }

export function useAdminUnlock(initialLockedUntil: string | null, onUnlocked: () => void) {
  const { signOut } = useAuth()
  const patchSession = useMerchantSessionPatch()
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => {
    const until = initialLockedUntil ? Date.parse(initialLockedUntil) : NaN
    return until > Date.now() ? until : null
  })
  const [notice, setNotice] = useState<UnlockNotice | null>(null)
  const now = useNow()
  const locked = lockedUntil !== null && lockedUntil > now

  const lock = (until: number) => {
    setLockedUntil(until)
    setNotice(null)
    patchSession({ pin_locked_until: new Date(until).toISOString() })
  }

  const unlock = useMutation({
    mutationFn: async (pin: string): Promise<UnlockOutcome> => {
      const { data, error } = await supabase.rpc('unlock_admin', {
        p_pin: pin,
      })
      if (error) throw toRedemptionError(error)
      return parseUnlock(data)
    },
    onSuccess: (outcome) => {
      if (outcome.kind === 'unlocked') {
        patchSession({
          admin_unlocked_until: outcome.until,
          pin_locked_until: null,
          failed_pin_attempts: outcome.failedAttempts,
        })
        onUnlocked()
      } else if (outcome.kind === 'wrong') setNotice({ code: 'E-14', remaining: outcome.remaining })
      else lock(outcome.until)
    },
    onError: (err) => {
      if (err instanceof z.ZodError) Sentry.captureException(err)
      const error = err instanceof RedemptionError ? err : new RedemptionError('E-99')
      if (error.code === 'E-99') Sentry.captureException(err)
      if (error.code === 'E-18' || error.code === 'E-19') void signOut(error.code)
      else if (error.code === 'E-15' && error.lockedUntil) lock(error.lockedUntil)
      else setNotice({ code: error.code })
    },
  })

  return {
    locked,
    lockedUntil,
    secondsLeft: lockedUntil === null ? 0 : Math.max(0, Math.ceil((lockedUntil - now) / 1000)),
    notice,
    isPending: unlock.isPending,
    clearNotice: () => setNotice(null),
    submit: (pin: string) => {
      if (!unlock.isPending && !locked) unlock.mutate(pin)
    },
  }
}
