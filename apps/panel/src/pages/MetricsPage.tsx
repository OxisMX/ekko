import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowDownIcon, ArrowUpIcon, BellIcon, MinusIcon } from '../components/Icons'
import { MetricsCharts } from '../components/MetricsCharts'
import { useAdminRpc } from '../lib/adminUnlockContext'
import { useMenuFailure } from '../lib/menu'
import { formatCount, METRICS_KEY, NO_AUTO_REFETCH, redemptionRate, toMetrics, toMetricsSeries, type MetricsRange } from '../lib/metrics'
import { supabase } from '../lib/supabase'
import { btnPrimary } from '../components/ui'

const PUSH_MONTHLY_LIMIT = 5
const RANGES: { value: MetricsRange; label: string }[] = [
  { value: '30d', label: 'Últimos 30 días' },
  { value: 'all', label: 'Histórico' },
]

// P-23: change against the previous period, stated in words and with an arrow (never color alone).
function Delta({ current, previous, periodLabel }: { current: number; previous: number | undefined; periodLabel: string }) {
  if (previous === undefined) return null
  const diff = current - previous
  const Icon = diff > 0 ? ArrowUpIcon : diff < 0 ? ArrowDownIcon : MinusIcon
  const text = diff === 0 ? `Igual que ${periodLabel}` : `${formatCount(Math.abs(diff))} ${diff > 0 ? 'más' : 'menos'} que ${periodLabel}`
  return (
    <p className="flex items-center gap-1 text-sm font-medium text-text-primary">
      <Icon className="size-4 shrink-0" />
      {text}
    </p>
  )
}

function Tile({ label, value, note, children }: { label: string; value: string; note?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-card bg-surface p-6">
      <p className="text-sm font-semibold tracking-wide text-text-secondary uppercase">{label}</p>
      <p className="text-5xl font-bold text-navy tabular-nums">{value}</p>
      {note && <p className="text-sm text-text-secondary">{note}</p>}
      {children}
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

  const series = useQuery({
    queryKey: [...METRICS_KEY, 'series', range],
    queryFn: async () => toMetricsSeries(await adminRpc(() => supabase.rpc('get_metrics_series', { p_range: range }))),
    ...NO_AUTO_REFETCH,
  })

  const rate = series.data ? redemptionRate(series.data.coupons) : null
  const periodLabel = range === '30d' ? 'los 30 días anteriores' : ''

  return (
    <section aria-labelledby="metrics-title" className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <h1 id="metrics-title" className="text-h1 font-bold">Métricas</h1>

      <div role="group" aria-label="Periodo" className="flex w-fit gap-1 rounded-card bg-surface p-1">
        {RANGES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={range === value}
            onClick={() => setRange(value)}
            className={`min-h-12 rounded-button px-5 font-semibold transition-colors ${range === value ? 'bg-navy text-white' : 'hover:bg-surface-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {metrics.isPending && (
        <div role="status" aria-label="Cargando las métricas" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-36 animate-pulse rounded-card bg-surface" />)}
        </div>
      )}
      {metrics.isError && (
        <div role="alert" className="flex max-w-xl flex-col items-start gap-3 rounded-card bg-surface p-6">
          <p className="font-semibold">{failure(metrics.error).message}</p>
          <button type="button" className={btnPrimary} onClick={() => void metrics.refetch()}>Reintentar</button>
        </div>
      )}
      {metrics.data && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Tile label="Visitas" value={formatCount(metrics.data.visits)}>
              <Delta current={metrics.data.visits} previous={metrics.data.previous?.visits} periodLabel={periodLabel} />
            </Tile>
            <Tile label="Cupones canjeados" value={formatCount(metrics.data.redemptions)} note="premios entregados a tus clientes">
              <Delta current={metrics.data.redemptions} previous={metrics.data.previous?.redemptions} periodLabel={periodLabel} />
            </Tile>
            {rate !== null && <Tile label="Tasa de canje" value={`${rate} %`} note="de los cupones emitidos ya se canjearon" />}
            <Tile label="Clientes activos" value={formatCount(metrics.data.active_customers)} note="últimos 30 días" />
          </div>
          {metrics.data.visits === 0 && metrics.data.redemptions === 0 && (
            <div className="flex flex-col items-start gap-3 rounded-card bg-surface p-6">
              <p className="text-text-secondary">Aún no hay actividad. Cuando tus clientes escaneen su primer QR, verás aquí tus números.</p>
              <Link to="/" className={`${btnPrimary} inline-flex items-center`}>
                Ir a Modo Caja
              </Link>
            </div>
          )}
          {series.isPending && <div role="status" aria-label="Cargando las gráficas" className="h-72 animate-pulse rounded-card bg-surface" />}
          {series.isError && (
            <div role="alert" className="flex max-w-xl flex-col items-start gap-3 rounded-card bg-surface p-6">
              <p className="font-semibold">No pudimos cargar las gráficas. {failure(series.error).message}</p>
              <button type="button" className={btnPrimary} onClick={() => void series.refetch()}>Reintentar gráficas</button>
            </div>
          )}
          {series.data && <MetricsCharts series={series.data} range={range} />}
          <Link to="/admin/notificaciones" className="flex w-fit items-center gap-2 rounded-button py-2 font-medium underline">
            <BellIcon className="size-5 shrink-0" />
            Notificaciones restantes este mes: {metrics.data.push_remaining_this_month} de {PUSH_MONTHLY_LIMIT}
          </Link>
        </>
      )}
    </section>
  )
}
