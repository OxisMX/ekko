import type { ErrorCode } from '@ekko/shared'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isMerchant } from '../lib/panelRoute'
import { supabase } from '../lib/supabase'
import { AuthContext } from './AuthContext'
import { signOutNotice, USER_SIGN_OUT_KEY } from './sessionExpiry'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [authError, setAuthError] = useState<ErrorCode | null>(null)
  // WHY: the auth callback is registered once, so it reads the latest session from a ref.
  const sessionRef = useRef<Session | null | undefined>(undefined)

  const signOut = useCallback(
    async (reason?: ErrorCode) => {
      setAuthError(reason ?? null)
      localStorage.setItem(USER_SIGN_OUT_KEY, '1')
      queryClient.clear()
      // WHY: 'local' only drops this device's session; a customer who typed their credentials
      // here (E-19) must not be signed out of their phone.
      await supabase.auth.signOut({ scope: 'local' })
    },
    [queryClient],
  )

  useEffect(() => {
    // NOTE: fires INITIAL_SESSION on subscribe, so no separate getSession() call is needed.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_IN') localStorage.removeItem(USER_SIGN_OUT_KEY)
      const notice = signOutNotice({
        event,
        hadSession: !!sessionRef.current,
        userSignedOut: localStorage.getItem(USER_SIGN_OUT_KEY) !== null,
      })
      if (notice) {
        setAuthError(notice)
        queryClient.clear()
      }
      if (next && !isMerchant(next)) {
        sessionRef.current = null
        setSession(null)
        // WHY: supabase-js deadlocks if another auth call runs inside this callback; defer it.
        setTimeout(() => void signOut('E-19'), 0)
        return
      }
      sessionRef.current = next
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [signOut, queryClient])

  const value = useMemo(
    () => ({ session, authError, clearAuthError: () => setAuthError(null), signOut }),
    [session, authError, signOut],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
