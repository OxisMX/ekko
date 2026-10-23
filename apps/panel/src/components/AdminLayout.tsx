import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router'
import { InsideAdminFrame } from '../lib/insideAdminFrame'
import { AdminUnlockContext } from '../lib/adminUnlockContext'
import { canAccessAdmin } from '../lib/panelRoute'
import { supabase } from '../lib/supabase'
import { useMerchantSessionPatch } from '../lib/useAdminUnlock'
import { useNow } from '../lib/useNow'
import { ADMIN_GROUPS, ADMIN_SECTIONS, type AdminSection } from './adminSections'
import { AlertIcon, LockIcon, UnlockIcon } from './Icons'
import { LogoutButton } from './LogoutButton'
import { MerchantAvatar } from './MerchantAvatar'
import { useMerchantSession } from './panelOutlet'
import { PinDialog } from './PinDialog'
import { btnPrimary } from './ui'

export const ADMIN_IDLE_MS = 5 * 60_000
const LOCK_WARNING_MS = 60_000 // P-16

const formatCountdown = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// RT-12: admin sections say how long is left before they lock; RT-13: sober, no circle pattern.
// Side rail from 1024 px (RT-09), scrollable top tabs below.
export function AdminLayout() {
  const merchantSession = useMerchantSession()
  const { merchant, admin_unlocked_until } = merchantSession
  const navigate = useNavigate()
  const patchSession = useMerchantSessionPatch()
  const now = useNow()
  const lastActivity = useRef(now)
  const [unlockWaiter, setUnlockWaiter] = useState<{
    resolve: () => void
    reject: (e: Error) => void
  } | null>(null)

  const leave = useCallback(() => {
    // Best effort: if it fails the window closes by itself at admin_unlocked_until.
    void Promise.resolve(supabase.rpc('lock_admin')).catch(() => undefined)
    patchSession({ admin_unlocked_until: null })
    navigate('/', { replace: true })
  }, [navigate, patchSession])

  // WHY two clocks: the server owns the real window (admin_unlocked_until, extended only by admin
  // RPCs; an expired one answers E-16 → P-04 in place). Locally, 5 min without pointer/keyboard
  // activity also leaves, so a tablet left open on an admin screen locks even if no RPC ran.
  useEffect(() => {
    const touch = () => (lastActivity.current = Date.now())
    window.addEventListener('pointerdown', touch)
    window.addEventListener('keydown', touch)
    return () => {
      window.removeEventListener('pointerdown', touch)
      window.removeEventListener('keydown', touch)
    }
  }, [])
  useEffect(() => {
    if (!unlockWaiter && now - lastActivity.current >= ADMIN_IDLE_MS) leave()
  }, [now, unlockWaiter, leave])

  // WHY shared: sections fire several admin RPCs at once (e.g. metrics + series); all of them must
  // wait on the same PIN dialog instead of the last one overwriting the others' waiter.
  const pendingUnlock = useRef<Promise<void> | null>(null)
  const requestUnlock = useCallback(() => {
    pendingUnlock.current ??= new Promise<void>((resolve, reject) => setUnlockWaiter({ resolve, reject })).finally(() => {
      pendingUnlock.current = null
    })
    return pendingUnlock.current
  }, [])

  // A lapsed window with the PIN dialog open is the E-16 flow: keep the section mounted.
  const windowOpen = canAccessAdmin({
    adminUnlockedUntil: admin_unlocked_until,
    now,
  })
  if (!windowOpen && !unlockWaiter) return <Navigate to="/" replace />
  const remainingMs = admin_unlocked_until ? Date.parse(admin_unlocked_until) - now : 0

  return (
    <AdminUnlockContext value={requestUnlock}>
      <div className="flex min-h-dvh flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-black/10 bg-surface px-6 py-3">
          <MerchantAvatar name={merchant.name} logoPath={merchant.logo_path} />
          <div className="min-w-0 flex-1">
            <p className="field-label text-text-secondary">Administración</p>
            <p className="truncate text-h2 font-semibold" title={merchant.name}>
              {merchant.name}
            </p>
          </div>
          {/* P-15/P-16: neutral pill while time is plentiful; text + icon + warning fill (not color alone) in the last minute. */}
          <p
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${
              remainingMs < LOCK_WARNING_MS ? 'bg-warning/25 font-semibold' : 'bg-surface-muted'
            }`}
          >
            {remainingMs < LOCK_WARNING_MS ? <AlertIcon className="size-4 shrink-0" /> : <UnlockIcon className="size-4 shrink-0" />}
            {remainingMs < LOCK_WARNING_MS ? 'Se bloqueará pronto' : 'Se bloquea en'} <span className="font-mono tabular-nums">{formatCountdown(remainingMs)}</span>
          </p>
          <button type="button" onClick={leave} className={`${btnPrimary} flex items-center gap-2`}>
            <LockIcon className="size-5" />
            Bloquear y volver a Caja
          </button>
        </header>

        <div className="flex flex-1 flex-col lg:flex-row">
          <nav aria-label="Secciones administrativas" className="border-b border-black/10 bg-surface lg:w-56 lg:shrink-0 lg:border-r lg:border-b-0">
            <div className="flex gap-4 overflow-x-auto px-6 py-3 lg:flex-col lg:gap-5 lg:overflow-visible lg:p-4">
              {ADMIN_GROUPS.map((group) => (
                <div key={group} className="flex shrink-0 gap-2 lg:flex-col lg:gap-1">
                  <p className="field-label hidden px-3 pb-1 text-text-secondary lg:block">{group}</p>
                  <ul aria-label={group} className="flex gap-2 lg:flex-col lg:gap-1">
                    {ADMIN_SECTIONS.filter((section) => section.group === group).map(({ path, label, Icon }) => (
                      <li key={path} className="shrink-0">
                        <NavLink
                          to={`/admin/${path}`}
                          className={({ isActive }) =>
                            `flex min-h-12 items-center gap-3 rounded-button px-3 font-semibold whitespace-nowrap transition-colors ${
                              isActive ? 'bg-navy text-white' : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                            }`
                          }
                        >
                          <Icon className="size-5 shrink-0" />
                          {label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
          <div className="flex flex-1 flex-col">
            <main className="flex flex-1 flex-col p-6">
              <InsideAdminFrame value>
                <Outlet context={{ merchantSession }} />
              </InsideAdminFrame>
            </main>
            <footer className="flex flex-wrap items-center justify-between gap-3 px-6 pb-4 text-xs text-text-secondary">
              <span>
                Ekko Rewards · Panel del comercio · versión <span className="font-mono">{__COMMIT_HASH__}</span>
              </span>
              <LogoutButton />
            </footer>
          </div>
        </div>
        {unlockWaiter && (
          <PinDialog
            cancelLabel="Volver a Modo Caja"
            onUnlocked={() => {
              lastActivity.current = Date.now()
              unlockWaiter.resolve()
              setUnlockWaiter(null)
            }}
            onCancel={() => {
              unlockWaiter.reject(new Error('unlock cancelled'))
              setUnlockWaiter(null)
              leave()
            }}
          />
        )}
      </div>
    </AdminUnlockContext>
  )
}

export function AdminPlaceholderPage({ section }: { section: AdminSection }) {
  const { Icon } = section
  return (
    <section aria-labelledby="admin-title" className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 id="admin-title" className="text-h1 font-bold">
        {section.title}
      </h1>
      <div className="flex flex-col items-center rounded-card bg-surface px-6 py-12 text-center">
        <Icon className="size-12 text-navy" />
        <p className="mt-4 text-lg font-semibold">Disponible próximamente</p>
        <p className="mt-1 max-w-md text-text-secondary">{section.purpose}</p>
      </div>
    </section>
  )
}
