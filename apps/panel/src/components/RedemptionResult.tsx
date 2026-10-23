import { couponSourceLabel, ERRORS, type ErrorCode } from '@ekko/shared'
import { useNow } from '../lib/useNow'
import type { RedemptionCoupon } from '../lib/useRedemption'
import { AlertIcon, TicketIcon } from './Icons'
import { btnPrimary, btnSecondary } from './ui'

const DAY_MS = 24 * 60 * 60_000

const formatExpiry = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso))

type Props = {
  coupon: RedemptionCoupon
  confirming: boolean
  error?: ErrorCode
  onConfirm: () => void
  onCancel: () => void
}

// P-03 Resultado de validación (F-22): the cashier checks who and what before confirming.
export function RedemptionResult({ coupon, confirming, error, onConfirm, onCancel }: Props) {
  // P-22: the cashier hands over the benefit, so it leads; the customer name only confirms identity.
  const now = useNow()
  const expiresToday = Date.parse(coupon.expires_at) - now < DAY_MS
  return (
    <div className="mt-4 flex flex-1 flex-col">
      <div className="rounded-card bg-surface-muted p-4">
        <p className="flex items-center gap-2 field-label text-navy">
          <TicketIcon className="size-5" />
          {couponSourceLabel[coupon.source]}
        </p>
        <p className="mt-2 text-display font-bold">{coupon.title}</p>
        <p className="mt-1 text-lg">{coupon.description}</p>
        {coupon.terms && <p className="mt-2 text-sm text-text-secondary">{coupon.terms}</p>}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
        {expiresToday && (
          <span className="flex items-center gap-1 rounded-full bg-warning/25 px-3 py-1 font-semibold text-text-primary">
            <AlertIcon className="size-4 shrink-0" />
            Vence hoy
          </span>
        )}
        Vence el {formatExpiry(coupon.expires_at)}
      </p>
      <p className="mt-4 text-sm text-text-secondary">Cliente</p>
      <p className="text-h2 font-semibold">{coupon.customer_full_name}</p>

      <div className="mt-auto pt-6">
        {error && (
          <p role="alert" className="mb-3 flex items-center gap-2 text-sm font-semibold text-error">
            <AlertIcon className="size-5 shrink-0" />
            {ERRORS[error].message}
          </p>
        )}
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          className={`${btnPrimary} flex h-16 w-full items-center justify-center gap-3 text-lg disabled:cursor-wait disabled:opacity-70`}
        >
          {confirming && <Spinner />}
          {confirming ? 'Confirmando…' : error ? 'Reintentar' : 'Confirmar canje'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={confirming}
          className={`${btnSecondary} mt-3 h-14 w-full text-lg`}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

export function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="block size-5 rounded-full border-4 border-white/30 border-t-white motion-safe:animate-spin"
    />
  )
}
