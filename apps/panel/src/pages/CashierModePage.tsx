import { QR_TTL_SECONDS } from '@ekko/shared'
import { QrIcon } from '../components/Icons'
import { PanelShell } from '../components/PanelShell'
import { RedemptionValidator } from '../components/RedemptionValidator'

// P-02 Modo Caja (RT-09: two columns from 1024 px, stacked on vertical tablet).
export function CashierModePage() {
  return (
    <PanelShell showAdmin>
      <div className="grid flex-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="qr-title" className="flex flex-col rounded-2xl bg-surface p-6">
          <div className="flex items-center gap-3">
            <QrIcon className="size-7 text-navy" />
            <h2 id="qr-title" className="text-xl font-semibold">
              Registrar visita
            </h2>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Genera un QR para que tu cliente lo escanee con la app. Es válido por {QR_TTL_SECONDS} segundos.
          </p>

          {/* RT-10: 280 × 280 minimum with white margin; real QR arrives in S4. */}
          <div className="my-6 grid flex-1 place-items-center">
            <div className="grid size-[280px] place-items-center rounded-2xl border-2 border-dashed border-black/20 bg-surface p-4 text-center text-text-secondary">
              <div>
                <QrIcon className="mx-auto size-16" />
                <p className="mt-3 text-sm">El QR aparecerá aquí</p>
              </div>
            </div>
          </div>

          {/* TODO(S4): generate_visit_qr. */}
          <button
            type="button"
            aria-disabled="true"
            aria-describedby="qr-hint"
            className="h-14 w-full cursor-not-allowed rounded-xl bg-black/10 text-lg font-semibold text-text-secondary"
          >
            Generar QR
          </button>
          <p id="qr-hint" className="mt-2 min-h-5 text-center text-sm text-text-secondary">
            Disponible próximamente
          </p>
        </section>

        <RedemptionValidator />
      </div>
    </PanelShell>
  )
}
