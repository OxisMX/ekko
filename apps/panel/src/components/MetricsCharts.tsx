import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBucket, formatCount, type MetricsRange, type MetricsSeries } from '../lib/metrics'

// Series colors from the panel tokens (index.css); all keep >= 3:1 against the white card.
const NAVY = 'var(--color-navy)'
const SUCCESS = 'var(--color-success)'
const AXIS = 'var(--color-text-secondary)'

type Row = Record<string, string | number>

// WHY aria-hidden + sr-only table: SVG charts are opaque to screen readers, the table carries the same numbers.
function ChartCard({ title, rows, columns, children }: { title: string; rows: Row[]; columns: { key: string; label: string }[]; children: ReactNode }) {
  const empty = rows.every((row) => columns.slice(1).every(({ key }) => row[key] === 0))
  return (
    <figure className="flex flex-col gap-3 rounded-2xl bg-surface p-6">
      <figcaption className="font-semibold">{title}</figcaption>
      {empty ? (
        <p className="py-10 text-center text-text-secondary">Aún no hay datos</p>
      ) : (
        <>
          <div aria-hidden="true">{children}</div>
          <table className="sr-only" aria-label={title}>
            <thead>
              <tr>
                {columns.map(({ key, label }) => <th key={key} scope="col">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.bucket}>
                  {columns.map(({ key }) => <td key={key}>{row[key]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  )
}

const axes = (xLabel: string, yLabel: string) => (
  <>
    <CartesianGrid strokeDasharray="3 3" vertical={false} />
    <XAxis dataKey="label" stroke={AXIS} tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={24} label={{ value: xLabel, position: 'insideBottom', offset: -4, fill: AXIS, fontSize: 12 }} height={44} />
    <YAxis stroke={AXIS} tick={{ fontSize: 12 }} allowDecimals={false} tickFormatter={formatCount} width={56} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 12 }} />
    <Tooltip />
    <Legend verticalAlign="top" height={32} />
  </>
)

const HEIGHT = 280

export function MetricsCharts({ series, range }: { series: MetricsSeries; range: MetricsRange }) {
  const xLabel = range === '30d' ? 'Día' : 'Semana'
  const withLabel = <T extends { bucket: string }>(items: T[]) => items.map((item) => ({ ...item, label: formatBucket(item.bucket) }))
  const visits = withLabel(series.visits.map(({ bucket, count }) => ({ bucket, visits: count })))
  const coupons = withLabel(series.coupons.map(({ bucket, issued, redeemed }) => ({ bucket, issued, redeemed })))
  const customers = withLabel(series.active_customers.map(({ bucket, count }) => ({ bucket, customers: count })))
  const bucketColumn = { key: 'label', label: xLabel }

  return (
    <div className="grid gap-4">
      <ChartCard title="Visitas" rows={visits} columns={[bucketColumn, { key: 'visits', label: 'Visitas' }]}>
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <LineChart data={visits}>
            {axes(xLabel, 'Visitas')}
            <Line type="monotone" dataKey="visits" name="Visitas" stroke={NAVY} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Cupones emitidos y canjeados" rows={coupons} columns={[bucketColumn, { key: 'issued', label: 'Emitidos' }, { key: 'redeemed', label: 'Canjeados' }]}>
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <BarChart data={coupons}>
            {axes(xLabel, 'Cupones')}
            <Bar dataKey="issued" name="Emitidos" fill={NAVY} />
            <Bar dataKey="redeemed" name="Canjeados" fill={SUCCESS} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Clientes activos por semana (últimas 12 semanas)" rows={customers} columns={[{ key: 'label', label: 'Semana' }, { key: 'customers', label: 'Clientes activos' }]}>
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <BarChart data={customers}>
            {axes('Semana', 'Clientes')}
            <Bar dataKey="customers" name="Clientes activos" fill={NAVY} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
