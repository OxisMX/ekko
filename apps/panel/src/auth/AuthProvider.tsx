import type { ErrorCode } from '@ekko/shared'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isMerchant } from '../lib/panelRoute'
import { supabase } from '../lib/supabase'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [authError, setAuthError] = useState<ErrorCode | null>(null)

  const signOut = useCallback(
    async (reason?: ErrorCode) => {
      setAuthError(reason ?? null)
      queryClient.clear()
      // WHY: 'local' only drops this device's session; a customer who typed their credentials
      // here (E-19) must not be signed out of their phone.
      await supabase.auth.signOut({ scope: 'local' })
    },
    [queryClient],
  )

  useEffect(() => {
    // NOTE: fires INITIAL_SESSION on subscribe, so no separate getSession() call is needed.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (next && !isMerchant(next)) {
        setSession(null)
        // WHY: supabase-js deadlocks if another auth call runs inside this callback; defer it.
        setTimeout(() => void signOut('E-19'), 0)
        return
      }
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [signOut])

  const value = useMemo(
    () => ({ session, authError, clearAuthError: () => setAuthError(null), signOut }),
    [session, authError, signOut],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
