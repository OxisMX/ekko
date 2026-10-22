import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { canAccessAdmin } from '../lib/panelRoute'
import { LockIcon, LogoutIcon } from './Icons'
import { useMerchantSession } from './panelOutlet'
import { PinDialog } from './PinDialog'

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
  const { merchant, admin_unlocked_until } = useMerchantSession()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [pinOpen, setPinOpen] = useState(false)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-4 border-b border-black/10 bg-surface px-6 py-3">
        {/* TODO(S3): render logo_path from Storage; initials until image URLs exist. */}
        <div aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-navy text-lg font-bold text-white">
          {initials(merchant.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[1.5px] text-text-secondary uppercase">Modo Caja</p>
          <h1 className="truncate text-xl font-semibold" title={merchant.name}>
            {merchant.name}
          </h1>
        </div>
        {showAdmin && (
          <button
            type="button"
            onClick={() =>
              canAccessAdmin({
                adminUnlockedUntil: admin_unlocked_until,
                now: Date.now(),
              })
                ? navigate('/admin')
                : setPinOpen(true)
            }
            className="flex h-12 items-center gap-2 rounded-xl border border-black/15 px-4 font-semibold transition-colors hover:bg-surface-muted"
          >
            <LockIcon className="size-5" />
            Administrar
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
      {pinOpen && <PinDialog cancelLabel="Volver a Modo Caja" onCancel={() => setPinOpen(false)} onUnlocked={() => navigate('/admin')} />}
    </div>
  )
}
