import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBucket, formatCount, type MetricsRange, type MetricsSeries } from '../lib/metrics'

// Series colors from the panel tokens (index.css); all keep >= 3:1 against the white card.
const NAVY = 'var(--color-navy)'
const SUCCESS = 'var(--color-success)'
const AXIS = 'var(--color-text-secondary)'

type Row = Record<string, string | number>

// WHY aria-hidden + sr-only table: SVG charts are opaque to screen readers, the table carries the same numbers.
// NOTE: accessibilityLayer off — recharts would make the hidden SVG focusable (axe aria-hidden-focus).
function ChartCard({ title, rows, columns, wide = false, children }: { title: string; rows: Row[]; columns: { key: string; label: string }[]; wide?: boolean; children: ReactNode }) {
  const empty = rows.every((row) => columns.slice(1).every(({ key }) => row[key] === 0))
  return (
    <figure className={`flex flex-col gap-3 rounded-card bg-surface p-6 ${wide ? 'xl:col-span-2' : ''}`}>
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

// WHY style props: recharts draws the tooltip with inline styles, so tokens go through CSS variables.
const tooltipStyle = {
  borderRadius: 'var(--radius-field)',
  border: '1px solid rgb(0 0 0 / 0.15)',
  color: 'var(--color-text-primary)',
  boxShadow: 'none',
}

// P-24: the legend only earns its space where two series share a chart.
const axes = (xLabel: string, yLabel: string, legend = false) => (
  <>
    <CartesianGrid strokeDasharray="3 3" vertical={false} />
    <XAxis dataKey="label" stroke={AXIS} tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={24} label={{ value: xLabel, position: 'insideBottom', offset: -4, fill: AXIS, fontSize: 12 }} height={44} />
    <YAxis stroke={AXIS} tick={{ fontSize: 12 }} allowDecimals={false} tickFormatter={formatCount} width={56} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 12 }} />
    <Tooltip formatter={(value) => formatCount(Number(value))} contentStyle={tooltipStyle} cursor={{ fill: 'rgb(0 0 0 / 0.05)' }} />
    {legend && <Legend verticalAlign="top" height={32} />}
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
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Visitas" rows={visits} columns={[bucketColumn, { key: 'visits', label: 'Visitas' }]}>
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <LineChart data={visits} accessibilityLayer={false}>
            {axes(xLabel, 'Visitas')}
            <Line type="monotone" dataKey="visits" name="Visitas" stroke={NAVY} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Cupones emitidos y canjeados" rows={coupons} columns={[bucketColumn, { key: 'issued', label: 'Emitidos' }, { key: 'redeemed', label: 'Canjeados' }]}>
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <BarChart data={coupons} accessibilityLayer={false}>
            {/* P-24: redeemed is striped as well as green, so the two series differ without relying on color. */}
            <defs>
              <pattern id="redeemed-stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="white" />
                <rect width="3" height="6" fill={SUCCESS} />
              </pattern>
            </defs>
            {axes(xLabel, 'Cupones', true)}
            <Bar dataKey="issued" name="Emitidos" fill={NAVY} />
            <Bar dataKey="redeemed" name="Canjeados" fill="url(#redeemed-stripes)" stroke={SUCCESS} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard wide title="Clientes activos por semana (últimas 12 semanas)" rows={customers} columns={[{ key: 'label', label: 'Semana' }, { key: 'customers', label: 'Clientes activos' }]}>
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <BarChart data={customers} accessibilityLayer={false}>
            {axes('Semana', 'Clientes')}
            <Bar dataKey="customers" name="Clientes activos" fill={NAVY} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
