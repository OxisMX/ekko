import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { canAccessAdmin } from '../lib/panelRoute'
import { LockIcon } from './Icons'
import { LogoutButton } from './LogoutButton'
import { MerchantAvatar } from './MerchantAvatar'
import { useMerchantSession } from './panelOutlet'
import { PinDialog } from './PinDialog'
import { btnSecondary } from './ui'

// Header shared by P-02 and P-12 (RT-13: sober, no circle pattern in work areas).
// WHY compact: Modo Caja must fit 1024×768 without scrolling (P-19). Sign-out is always in the header;
// only the inactive page (no admin) also shows the version footer for support.
export function PanelShell({ showAdmin, children }: { showAdmin: boolean; children: ReactNode }) {
  const { merchant, admin_unlocked_until } = useMerchantSession()
  const navigate = useNavigate()
  const [pinOpen, setPinOpen] = useState(false)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-black/10 bg-surface px-6 py-2">
        <MerchantAvatar name={merchant.name} logoPath={merchant.logo_path} />
        <div className="min-w-0 flex-1">
          <p className="field-label text-text-secondary">Modo Caja</p>
          <h1 className="truncate text-h2 font-semibold" title={merchant.name}>
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
            className={`${btnSecondary} flex items-center gap-2`}
          >
            <LockIcon className="size-5" />
            Administrar
          </button>
        )}
        <LogoutButton />
      </header>
      <main className="flex flex-1 flex-col p-4 sm:p-6">{children}</main>
      {!showAdmin && (
        <footer className="px-6 pb-4 text-xs text-text-secondary">
          Ekko Rewards · Panel del comercio · versión <span className="font-mono">{__COMMIT_HASH__}</span>
        </footer>
      )}
      {pinOpen && <PinDialog cancelLabel="Volver a Modo Caja" onCancel={() => setPinOpen(false)} onUnlocked={() => navigate('/admin')} />}
    </div>
  )
}
