import { PanelShell } from '../components/PanelShell'
import { RedemptionValidator } from '../components/RedemptionValidator'
import { VisitQrPanel } from '../components/VisitQrPanel'

// P-02 Modo Caja (RT-09: two columns from 1024 px, stacked on vertical tablet).
export function CashierModePage() {
  return (
    <PanelShell showAdmin>
      <div className="grid flex-1 gap-6 lg:grid-cols-2">
        <VisitQrPanel />
        <RedemptionValidator />
      </div>
    </PanelShell>
  )
}
