import { ERRORS } from '@ekko/shared'
import { useState } from 'react'
import { useAdminUnlock, type UnlockNotice } from '../lib/useAdminUnlock'
import { AlertIcon, LockIcon } from './Icons'
import { ModalDialog } from './ModalDialog'
import { useMerchantSession } from './panelOutlet'

const PIN_LENGTH = 4
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

const formatCountdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

function noticeText({ code, remaining }: UnlockNotice) {
  if (code === 'E-14' && remaining !== undefined)
    return `${ERRORS[code].message} Te ${remaining === 1 ? 'queda 1 intento' : `quedan ${remaining} intentos`}.`
  return ERRORS[code].message
}

const keyClass =
  'h-20 rounded-2xl bg-surface-muted text-3xl font-semibold transition-colors hover:bg-black/10 active:bg-black/15 disabled:cursor-not-allowed disabled:opacity-40'

// P-04: PIN unlock (F-23). Modal so it can open over a section that must keep its state (E-16).
export function PinDialog({ onUnlocked, onCancel, cancelLabel }: { onUnlocked: () => void; onCancel: () => void; cancelLabel: string }) {
  const { pin_locked_until } = useMerchantSession()
  const unlock = useAdminUnlock(pin_locked_until, onUnlocked)
  const [pin, setPin] = useState('')
  const blocked = unlock.locked || unlock.isPending

  function press(digit: string) {
    if (blocked) return
    unlock.clearNotice()
    const next = (pin + digit).slice(0, PIN_LENGTH)
    setPin(next)
    if (next.length === PIN_LENGTH) {
      unlock.submit(next)
      // The server answered (or failed): either way a new attempt starts from empty.
      setPin('')
    }
  }
  const erase = () => !blocked && setPin((p) => p.slice(0, -1))

  function onKeyDown(event: React.KeyboardEvent) {
    if (/^\d$/.test(event.key)) press(event.key)
    else if (event.key === 'Backspace') erase()
  }

  return (
    <ModalDialog labelledBy="pin-title" onClose={onCancel} onKeyDown={onKeyDown} refocusWhen={!blocked} className="max-w-sm p-6">
      <div className="flex items-center gap-3">
        <LockIcon className="size-7 text-navy" />
        <h2 id="pin-title" className="text-xl font-semibold">
          Ingresa tu PIN
        </h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">PIN de 4 dígitos para entrar a Administración.</p>

      <div className="mt-6 flex justify-center gap-4" aria-hidden="true">
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={`size-5 rounded-full border-2 border-navy ${i < pin.length ? 'bg-navy' : ''}`} />
        ))}
      </div>
      <p role="status" className="sr-only">
        {pin.length} de {PIN_LENGTH} dígitos
      </p>

      <div className="mt-4 min-h-14">
        {unlock.isPending && <p className="font-semibold text-text-secondary">Verificando…</p>}
        {unlock.locked && (
          <div role="alert" className="flex items-start gap-3 rounded-xl bg-surface-muted p-4">
            <LockIcon className="size-6 shrink-0 text-error" />
            <div>
              <p className="font-semibold">{ERRORS['E-15'].message}</p>
              <p className="text-sm">
                Podrás intentar de nuevo en <span className="font-bold tabular-nums">{formatCountdown(unlock.secondsLeft)}</span>
              </p>
            </div>
          </div>
        )}
        {!unlock.locked && unlock.notice && (
          <p role="alert" className="flex items-center gap-2 font-semibold text-error">
            <AlertIcon className="size-6 shrink-0" />
            {noticeText(unlock.notice)}
          </p>
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-3">
        {DIGITS.map((d) => (
          <button key={d} type="button" disabled={blocked} onClick={() => press(d)} className={keyClass}>
            {d}
          </button>
        ))}
        <button type="button" disabled={blocked || pin.length === 0} onClick={erase} className={`${keyClass} text-lg`}>
          Borrar
        </button>
        <button type="button" disabled={blocked} onClick={() => press('0')} className={keyClass}>
          0
        </button>
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="mt-4 h-14 rounded-xl font-semibold text-text-primary transition-colors hover:bg-surface-muted"
      >
        {cancelLabel}
      </button>
    </ModalDialog>
  )
}
