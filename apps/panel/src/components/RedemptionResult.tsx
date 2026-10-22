import { ERRORS, type ErrorCode } from '@ekko/shared'
import type { RedemptionCoupon } from '../lib/useRedemption'
import { AlertIcon, TicketIcon } from './Icons'

const SOURCE_LABEL: Record<RedemptionCoupon['source'], string> = {
  card_reward: 'Premio de tarjeta',
  wheel: 'Ruleta de bienvenida',
  push: 'Promoción',
  birthday: 'Cumpleaños',
}

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
  return (
    <div className="mt-6 flex flex-1 flex-col">
      <p className="text-xs font-semibold tracking-[1.5px] text-text-secondary uppercase">Cliente</p>
      <p className="text-3xl font-semibold">{coupon.customer_full_name}</p>

      <div className="mt-4 rounded-xl bg-surface-muted p-4">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[1.5px] text-navy uppercase">
          <TicketIcon className="size-5" />
          {SOURCE_LABEL[coupon.source]}
        </p>
        <p className="mt-2 text-2xl font-semibold">{coupon.title}</p>
        <p className="mt-1">{coupon.description}</p>
        {coupon.terms && <p className="mt-2 text-sm text-text-secondary">{coupon.terms}</p>}
      </div>
      <p className="mt-3 text-sm text-text-secondary">Vence el {formatExpiry(coupon.expires_at)}</p>

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
          className="flex h-16 w-full items-center justify-center gap-3 rounded-xl bg-navy text-lg font-semibold text-white transition-colors hover:bg-brand disabled:cursor-wait disabled:opacity-70"
        >
          {confirming && <Spinner />}
          {confirming ? 'Confirmando…' : error ? 'Reintentar' : 'Confirmar canje'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={confirming}
          className="mt-3 h-14 w-full rounded-xl border-2 border-navy text-lg font-semibold text-navy transition-colors hover:bg-surface-muted disabled:opacity-50"
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
