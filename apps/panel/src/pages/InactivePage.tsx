import { AlertIcon } from '../components/Icons'
import { PanelShell } from '../components/PanelShell'
import { RedemptionValidator } from '../components/RedemptionValidator'

// P-12 (F-28, RN-71): only the validator stays available.
export function InactivePage() {
  return (
    <PanelShell showAdmin={false}>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div className="flex gap-4 rounded-2xl border-l-4 border-warning bg-surface p-6">
          <AlertIcon className="size-7 shrink-0 text-text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Tu suscripción no está activa. Contacta a Oxis para reactivarla.</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Mientras tanto, puedes seguir validando los códigos de canje que tus clientes ya tienen.
            </p>
          </div>
        </div>
        <RedemptionValidator />
      </div>
    </PanelShell>
  )
}
