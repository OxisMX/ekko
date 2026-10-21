import { useState } from 'react'
import { Link, Navigate, NavLink, Outlet } from 'react-router'
import { canAccessAdmin } from '../lib/panelRoute'
import { ADMIN_SECTIONS, type AdminSection } from './adminSections'
import { ArrowLeftIcon, UnlockIcon } from './Icons'
import { useMerchantSession } from './panelOutlet'

// RT-12: admin sections say they are unlocked and how long is left; RT-13: sober, no circle pattern.
// Side rail from 1024 px (RT-09), scrollable top tabs below.
export function AdminLayout() {
  const { merchant, admin_unlocked_until } = useMerchantSession()
  // TODO(S8): replace with the countdown tick so the guard also fires when the window closes.
  const [now] = useState(Date.now)
  if (!canAccessAdmin({ adminUnlockedUntil: admin_unlocked_until, now })) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-black/10 bg-surface px-6 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[1.5px] text-text-secondary uppercase">Administración</p>
          <p className="truncate text-xl font-semibold" title={merchant.name}>
            {merchant.name}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-navy px-4 py-2 text-white">
          <UnlockIcon className="size-5 shrink-0" />
          <p className="leading-tight">
            <span className="block text-sm font-semibold">Sección administrativa desbloqueada</span>
            {/* TODO(S8): live countdown to admin_unlocked_until (F-23, 5 min of inactivity). */}
            <span className="block text-xs">
              Tiempo restante: <span className="font-mono">--:--</span>
            </span>
          </p>
        </div>
        <Link
          to="/"
          className="flex h-12 items-center gap-2 rounded-xl border border-black/15 px-4 font-semibold transition-colors hover:bg-surface-muted"
        >
          <ArrowLeftIcon className="size-5" />
          Volver a Modo Caja
        </Link>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <nav aria-label="Secciones administrativas" className="border-b border-black/10 bg-surface lg:w-72 lg:shrink-0 lg:border-r lg:border-b-0">
          <ul className="flex gap-2 overflow-x-auto px-6 py-3 lg:flex-col lg:overflow-visible lg:p-4">
            {ADMIN_SECTIONS.map(({ path, label, Icon }) => (
              <li key={path} className="shrink-0">
                <NavLink
                  to={`/admin/${path}`}
                  className={({ isActive }) =>
                    `flex min-h-12 items-center gap-3 rounded-xl px-4 font-semibold whitespace-nowrap transition-colors ${
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
        </nav>
        <div className="flex flex-1 flex-col">
          <main className="flex flex-1 flex-col p-6">
            <Outlet />
          </main>
          <footer className="px-6 pb-4 text-xs text-text-secondary">
            Ekko Rewards · Panel del comercio · versión <span className="font-mono">{__COMMIT_HASH__}</span>
          </footer>
        </div>
      </div>
    </div>
  )
}

export function AdminPlaceholderPage({ section }: { section: AdminSection }) {
  const { Icon } = section
  return (
    <section aria-labelledby="admin-title" className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 id="admin-title" className="text-2xl font-bold">
        {section.title}
      </h1>
      <div className="flex flex-col items-center rounded-2xl bg-surface px-6 py-12 text-center">
        <Icon className="size-12 text-navy" />
        <p className="mt-4 text-lg font-semibold">Disponible próximamente</p>
        <p className="mt-1 max-w-md text-text-secondary">{section.purpose}</p>
      </div>
    </section>
  )
}
