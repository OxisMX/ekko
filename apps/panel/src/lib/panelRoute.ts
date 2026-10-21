import { parseRpcError, type ErrorCode } from '@ekko/shared'
import type { Session } from '@supabase/supabase-js'

// Contract: docs/ekko_backend.md §4.4 get_merchant_session.
export type MerchantSession = {
  merchant: { id: string; name: string; logo_path: string | null }
  is_active: boolean
  admin_unlocked_until: string | null
  pin_locked_until: string | null
  validator_locked_until: string | null
}

export type PanelRoute = 'login' | 'cashier' | 'inactive'

export function isMerchant(session: Pick<Session, 'user'> | null): boolean {
  return session?.user.app_metadata.role === 'merchant'
}

// F-20: no session or wrong role → login (caller signs out and shows E-19); inactive → P-12; else P-02.
export function resolvePanelRoute({
  session,
  merchantSession,
}: {
  session: Pick<Session, 'user'> | null
  merchantSession: Pick<MerchantSession, 'is_active'>
}): PanelRoute {
  if (!isMerchant(session)) return 'login'
  return merchantSession.is_active ? 'cashier' : 'inactive'
}

// WHY: postgrest-js returns fetch failures (offline, timeout) as an error without `code`;
// real RPC errors always carry one (P0001, PGRST…), so a missing code means E-01.
// PGRST301/PGRST303 are PostgREST's 401s for an invalid or expired JWT (E-18).
export function toPanelErrorCode(err: { message?: string; details?: string | null; code?: string }): ErrorCode {
  if (!err.code) return 'E-01'
  if (err.code === 'PGRST301' || err.code === 'PGRST303') return 'E-18'
  return parseRpcError(err).code
}

type MerchantSessionQuery = { state: { data?: Pick<MerchantSession, 'is_active'> } }
const isInactive = (query: MerchantSessionQuery) => query.state.data?.is_active === false

// F-28: while on P-12, poll and refetch on every focus so a merchant reactivated by Oxis
// returns to P-02 without signing in again.
export const reactivationRefetch = {
  refetchInterval: (query: MerchantSessionQuery) => (isInactive(query) ? 60_000 : false),
  refetchOnWindowFocus: (query: MerchantSessionQuery) => (isInactive(query) ? ('always' as const) : true),
}
