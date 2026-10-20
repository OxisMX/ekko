import { QR_TTL_SECONDS } from '@ekko/shared'

export function CashierModePage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Modo Caja</h1>
      {/* Proves @ekko/shared resolves in dev and build; remove with the real QR screen. */}
      <p className="text-text-secondary">{QR_TTL_SECONDS}</p>
    </main>
  )
}
