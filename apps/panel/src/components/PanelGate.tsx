import { ERRORS, type ErrorCode } from '@ekko/shared'
import * as Sentry from '@sentry/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { panelRedirect, sessionRefetch, resolvePanelRoute, toPanelErrorCode, type MerchantSession } from '../lib/panelRoute'
import { supabase } from '../lib/supabase'
import { AlertIcon } from './Icons'
import { PanelSkeleton } from './PanelSkeleton'
import type { PanelOutletContext } from './panelOutlet'

// Route guard for every signed-in screen (F-20, F-28).
export function PanelGate() {
  const { session, signOut } = useAuth()
  const { pathname } = useLocation()
  const query = useQuery({
    queryKey: ['merchant-session', session?.user.id],
    enabled: !!session,
    ...sessionRefetch,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_merchant_session')
      if (error) throw error
      return data as MerchantSession
    },
  })
  const errorCode = query.error ? toPanelErrorCode(query.error) : null

  useEffect(() => {
    // E-18: PostgREST rejected the JWT (expired/revoked) even after supabase-js refreshed it.
    if (errorCode === 'E-19' || errorCode === 'E-18') void signOut(errorCode)
    if (errorCode === 'E-99') Sentry.captureException(query.error)
  }, [errorCode, query.error, signOut])

  if (session === null) return <Navigate to="/login" replace />
  // WHY: keep showing data during a failed background refetch; only a first load can error out.
  if (session && query.data) {
    const target = panelRedirect(resolvePanelRoute({ session, merchantSession: query.data }), pathname)
    if (target) return <Navigate to={target} replace />
    return <Outlet context={{ merchantSession: query.data } satisfies PanelOutletContext} />
  }
  if (errorCode && errorCode !== 'E-19' && errorCode !== 'E-18') {
    return <SessionError code={errorCode} retrying={query.isFetching} onRetry={() => void query.refetch()} />
  }
  return <PanelSkeleton />
}

function SessionError({ code, retrying, onRetry }: { code: ErrorCode; retrying: boolean; onRetry: () => void }) {
  const { signOut } = useAuth()
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div role="alert" className="flex w-full max-w-md flex-col items-center rounded-2xl bg-surface p-8 text-center">
        <AlertIcon className="size-10 text-error" />
        <h1 className="mt-4 text-xl font-semibold">{ERRORS[code].message}</h1>
        <p className="mt-2 text-sm text-text-secondary">No pudimos cargar los datos de tu negocio.</p>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-6 h-14 w-full rounded-xl bg-brand text-lg font-semibold text-white transition-colors hover:bg-navy disabled:cursor-wait disabled:opacity-70"
        >
          {retrying ? 'Reintentando…' : 'Reintentar'}
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 h-12 w-full rounded-xl font-semibold text-text-primary hover:bg-surface-muted"
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  )
}
