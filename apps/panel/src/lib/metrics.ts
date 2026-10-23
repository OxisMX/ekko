import { z } from 'zod'

export type MetricsRange = '30d' | 'all'
export const METRICS_KEY = ['metrics']
export const QR_LOG_KEY = ['qr-log']
export const QR_LOG_PAGE_SIZE = 20

// WHY: get_metrics / list_qr_log extend the admin PIN session on every call, so these queries must
// never refetch by themselves (polling, focus, reconnect) or the window would never expire.
export const NO_AUTO_REFETCH = { refetchOnWindowFocus: false, refetchOnReconnect: false, refetchInterval: false } as const

const metricsSchema = z.object({
  visits: z.number(),
  redemptions: z.number(),
  active_customers: z.number(),
  push_remaining_this_month: z.number(),
})
export type Metrics = z.infer<typeof metricsSchema>
export const toMetrics = (raw: unknown): Metrics => metricsSchema.parse(raw)

const qrEntrySchema = z.object({
  created_at: z.string(),
  expires_at: z.string(),
  used_at: z.string().nullable(),
  status: z.enum(['used', 'invalidated', 'expired', 'pending']),
})
export type QrEntry = z.infer<typeof qrEntrySchema>
export const toQrEntries = (raw: unknown): QrEntry[] => z.array(qrEntrySchema).nullable().parse(raw) ?? []

export const QR_STATUS_LABEL: Record<QrEntry['status'], string> = { used: 'Usado', invalidated: 'Reemplazado', expired: 'Expirado', pending: 'Vigente' }

const numberFormat = new Intl.NumberFormat('es-MX')
export const formatCount = (n: number) => numberFormat.format(n)
export const formatQrDate = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

// Contract: get_metrics_series. Buckets are 'YYYY-MM-DD' (day for 30d, week start for all; customers always weekly).
const bucket = z.string()
const seriesSchema = z.object({
  visits: z.array(z.object({ bucket, count: z.number() })),
  coupons: z.array(z.object({ bucket, issued: z.number(), redeemed: z.number() })),
  active_customers: z.array(z.object({ bucket, count: z.number() })),
})
export type MetricsSeries = z.infer<typeof seriesSchema>
export const toMetricsSeries = (raw: unknown): MetricsSeries => seriesSchema.parse(raw)

const bucketFormat = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })
// Built in local time so a calendar date never shifts a day through UTC.
export const formatBucket = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  return bucketFormat.format(new Date(year, month - 1, day))
}
