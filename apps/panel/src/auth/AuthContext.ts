import type { ErrorCode } from '@ekko/shared'
import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthState = {
  /** undefined while the stored session is being restored; null when signed out or not a merchant. */
  session: Session | null | undefined
  /** Error to show on P-01 after a forced sign-out (E-19). */
  authError: ErrorCode | null
  clearAuthError: () => void
  signOut: (reason?: ErrorCode) => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
