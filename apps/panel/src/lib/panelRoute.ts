import { parseRpcError, type ErrorCode } from '@ekko/shared'
import type { Session } from '@supabase/supabase-js'

// Contract: docs/ekko_backend.md §4.4 get_merchant_session.
export type MerchantSession = {
  merchant: { id: string; name: string; logo_path: string | null }
  is_active: boolean
  admin_unlocked_until: string | null
  pin_locked_until: string | null
  validator_locked_until: string | null
  // Client-only: wrong PINs before the last correct unlock, set by useAdminUnlock for the owner notice (P-S1).
  failed_pin_attempts?: number
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

const PATHS: Record<PanelRoute, string> = { login: '/login', cashier: '/', inactive: '/inactiva' }
const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/')

// Where PanelGate must send the user, or null to render the requested path. Admin paths pass
// only for active merchants; AdminLayout then applies canAccessAdmin. Inactive → always P-12.
export function panelRedirect(route: PanelRoute, pathname: string): string | null {
  if (route === 'cashier' && isAdminPath(pathname)) return null
  return PATHS[route] === pathname ? null : PATHS[route]
}

// RT-12/F-23: admin sections only while unlock_admin's window is open. Today the PIN does not
// exist (S8) so admin_unlocked_until is always null. UX guard only: admin RPCs re-check (E-16).
export function canAccessAdmin({ adminUnlockedUntil, now }: { adminUnlockedUntil: string | null; now: number }): boolean {
  if (!adminUnlockedUntil) return false
  return Date.parse(adminUnlockedUntil) > now // NaN (unparseable) → false
}

// WHY: postgrest-js returns fetch failures (offline, timeout) as an error without `code`;
// real RPC errors always carry one (P0001, PGRST…), so a missing code means E-01.
// PGRST301/PGRST303 are PostgREST's 401s for an invalid or expired JWT (E-18).
export function toPanelErrorCode(err: { message?: string; details?: string | null; code?: string }): ErrorCode {
  if (!err.code) return 'E-01'
  if (err.code === 'PGRST301' || err.code === 'PGRST303') return 'E-18'
  return parseRpcError(err).code
}

// F-28/RN-71: the same session query detects both ways: active→inactive (Modo Caja or admin
// goes to P-12) and inactive→active (P-12 returns to P-02) with no manual reload.
// WHY 60 s: one tiny RPC per tablet per minute is negligible cost, and a deactivation reaches
// the screen in about a minute. 'always' refetches on focus/visibility even inside staleTime.
export const SESSION_POLL_MS = 60_000
export const sessionRefetch = { refetchInterval: SESSION_POLL_MS, refetchOnWindowFocus: 'always' as const }
