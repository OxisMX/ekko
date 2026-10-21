import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { LockIcon, LogoutIcon } from './Icons'
import { useMerchantSession } from './panelOutlet'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('')
}

// Header + footer shared by P-02 and P-12 (RT-13: sober, no circle pattern in work areas).
export function PanelShell({ showAdmin, children }: { showAdmin: boolean; children: ReactNode }) {
  const { merchant } = useMerchantSession()
  const { signOut } = useAuth()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-4 border-b border-black/10 bg-surface px-6 py-3">
        {/* TODO(S3): render logo_path from Storage; initials until image URLs exist. */}
        <div
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-xl bg-navy text-lg font-bold text-white"
        >
          {initials(merchant.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[1.5px] text-text-secondary uppercase">Modo Caja</p>
          <h1 className="truncate text-xl font-semibold" title={merchant.name}>
            {merchant.name}
          </h1>
        </div>
        {showAdmin && (
          // TODO(S8): open P-04 PIN unlock.
          <button
            type="button"
            aria-disabled="true"
            aria-describedby="admin-hint"
            title="Disponible próximamente"
            className="flex h-12 cursor-not-allowed items-center gap-2 rounded-xl border border-black/15 px-4 text-left text-text-secondary"
          >
            <LockIcon className="size-5" />
            <span className="leading-tight">
              <span className="block font-semibold">Administrar</span>
              <span id="admin-hint" className="block text-xs">
                Disponible próximamente
              </span>
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex h-12 items-center gap-2 rounded-xl px-4 font-semibold transition-colors hover:bg-surface-muted"
        >
          <LogoutIcon className="size-5" />
          Cerrar sesión
        </button>
      </header>
      <main className="flex flex-1 flex-col p-6">{children}</main>
      <footer className="px-6 pb-4 text-xs text-text-secondary">
        Ekko Rewards · Panel del comercio · versión <span className="font-mono">{__COMMIT_HASH__}</span>
      </footer>
    </div>
  )
}
