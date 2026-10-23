import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { BellIcon } from '../components/Icons'
import { useAdminRpc } from '../lib/adminUnlockContext'
import { useMenuFailure } from '../lib/menu'
import { formatCount, METRICS_KEY, NO_AUTO_REFETCH, toMetrics, type MetricsRange } from '../lib/metrics'
import { supabase } from '../lib/supabase'

const PUSH_MONTHLY_LIMIT = 5
const RANGES: { value: MetricsRange; label: string }[] = [
  { value: '30d', label: 'Últimos 30 días' },
  { value: 'all', label: 'Histórico' },
]

function Tile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface p-6">
      <p className="text-sm font-semibold tracking-wide text-text-secondary uppercase">{label}</p>
      <p className="text-5xl font-bold text-navy tabular-nums">{formatCount(value)}</p>
      {note && <p className="text-sm text-text-secondary">{note}</p>}
    </div>
  )
}

// P-05 (US-26).
export function MetricsPage() {
  const adminRpc = useAdminRpc()
  const failure = useMenuFailure()
  const [range, setRange] = useState<MetricsRange>('30d')

  const metrics = useQuery({
    queryKey: [...METRICS_KEY, range],
    queryFn: async () => toMetrics(await adminRpc(() => supabase.rpc('get_metrics', { p_range: range }))),
    ...NO_AUTO_REFETCH,
  })

  return (
    <section aria-labelledby="metrics-title" className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 id="metrics-title" className="text-2xl font-bold">Métricas</h1>

      <div role="radiogroup" aria-label="Periodo" className="flex w-fit gap-1 rounded-xl bg-surface p-1">
        {RANGES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={range === value}
            onClick={() => setRange(value)}
            className={`min-h-12 rounded-lg px-5 font-semibold transition-colors ${range === value ? 'bg-navy text-white' : 'hover:bg-surface-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {metrics.isPending && (
        <div role="status" aria-label="Cargando las métricas" className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-surface" />)}
        </div>
      )}
      {metrics.isError && (
        <div role="alert" className="flex max-w-xl flex-col items-start gap-3 rounded-2xl bg-surface p-6">
          <p className="font-semibold">{failure(metrics.error).message}</p>
          <button type="button" className="min-h-12 rounded-xl bg-navy px-5 font-semibold text-white" onClick={() => void metrics.refetch()}>Reintentar</button>
        </div>
      )}
      {metrics.data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Tile label="Visitas" value={metrics.data.visits} />
            <Tile label="Cupones canjeados" value={metrics.data.redemptions} />
            <Tile label="Clientes activos" value={metrics.data.active_customers} note="últimos 30 días" />
          </div>
          {metrics.data.visits === 0 && metrics.data.redemptions === 0 && (
            <p className="text-text-secondary">Aún no hay actividad. Cuando tus clientes escaneen su primer QR, verás aquí tus números.</p>
          )}
          <Link to="/admin/notificaciones" className="flex w-fit items-center gap-2 rounded-xl py-2 font-medium underline">
            <BellIcon className="size-5 shrink-0" />
            Notificaciones restantes este mes: {metrics.data.push_remaining_this_month} de {PUSH_MONTHLY_LIMIT}
          </Link>
        </>
      )}
    </section>
  )
}
