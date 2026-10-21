import type { AuthChangeEvent } from '@supabase/supabase-js'

// WHY: supabase-js emits the same SIGNED_OUT for "Cerrar sesión" (in any tab, via BroadcastChannel)
// and for a refresh token that failed or was revoked. We mark user-initiated sign-outs in
// localStorage (shared by every tab) so only the unsolicited ones show E-18.
export const USER_SIGN_OUT_KEY = 'ekko.panel.user-signed-out'

export function signOutNotice({
  event,
  hadSession,
  userSignedOut,
}: {
  event: AuthChangeEvent
  hadSession: boolean
  userSignedOut: boolean
}): 'E-18' | null {
  return event === 'SIGNED_OUT' && hadSession && !userSignedOut ? 'E-18' : null
}
