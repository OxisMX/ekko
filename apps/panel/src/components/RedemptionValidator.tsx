import { ERRORS, isValidRedemptionCode, normalizeRedemptionCode, REDEMPTION_CODE_LENGTH } from '@ekko/shared'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRedemption, type RedemptionPhase } from '../lib/useRedemption'
import { AlertIcon, CheckCircleIcon, LockIcon, TicketIcon } from './Icons'
import { useMerchantSession } from './panelOutlet'
import { RedemptionResult, Spinner } from './RedemptionResult'
import { btnPrimary } from './ui'

const GROUP = REDEMPTION_CODE_LENGTH / 2

function helpText(code: string, valid: boolean) {
  if (valid) return 'Código completo. Ya puedes validarlo.'
  if (code.length < REDEMPTION_CODE_LENGTH) return `Faltan ${REDEMPTION_CODE_LENGTH - code.length} caracteres.`
  return 'Revisa el código: no usa 0, O, 1, I ni L.'
}

const formatCountdown = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

function noticeText({ code, remaining }: NonNullable<Extract<RedemptionPhase, { name: 'idle' }>['notice']>) {
  if (code === 'E-12' && remaining !== undefined)
    return `${ERRORS[code].message} Te ${remaining === 1 ? 'queda 1 intento' : `quedan ${remaining} intentos`}.`
  return ERRORS[code].message
}

type Redemption = ReturnType<typeof useRedemption>

// RT-11: accepts lowercase, shows two groups of 3 large characters.
export function RedemptionValidator({ className = '' }: { className?: string }) {
  const { validator_locked_until } = useMerchantSession()
  const redemption = useRedemption(validator_locked_until)
  const { phase } = redemption

  return (
    <section aria-labelledby="validator-title" className={`flex flex-col rounded-card bg-surface p-5 ${className}`}>
      <div className="flex items-center gap-3">
        <TicketIcon className="size-7 text-navy" />
        <h2 id="validator-title" className="text-h2 font-semibold">
          Validar código de canje
        </h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">Pide al cliente el código de 6 caracteres que aparece en su app.</p>
      {phase.name === 'done' && (
        <div role="status" className="mt-4 grid flex-1 place-items-center rounded-card bg-success p-8 text-center text-white">
          <div>
            <CheckCircleIcon className="mx-auto size-20" />
            <p className="mt-4 text-3xl font-semibold">Canje registrado</p>
            <p className="mt-1">El cupón ya no se puede volver a usar.</p>
          </div>
        </div>
      )}

      {phase.name === 'found' && (
        <RedemptionResult
          coupon={phase.coupon}
          confirming={redemption.isConfirming}
          error={phase.confirmError}
          onConfirm={() => redemption.confirm(phase.coupon.coupon_id)}
          onCancel={redemption.cancel}
        />
      )}


      {(phase.name === 'idle' || phase.name === 'locked') && <CodeForm redemption={redemption} />}
    </section>
  )
}

// Unmounted while P-03 or the success state shows, so the code resets by itself when it comes back.
function CodeForm({ redemption }: { redemption: Redemption }) {
  const { phase, isLookingUp } = redemption
  const [code, setCode] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const valid = isValidRedemptionCode(code)
  const display = code.length > GROUP ? `${code.slice(0, GROUP)} ${code.slice(GROUP)}` : code
  const locked = phase.name === 'locked'
  const notice = phase.name === 'idle' ? phase.notice : undefined

  // Focus on arrival, after a failed lookup and when the lock ends (the input is disabled meanwhile).
  useEffect(() => {
    if (!locked && !isLookingUp) inputRef.current?.focus()
  }, [locked, isLookingUp])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!valid || locked || isLookingUp) return
    redemption.lookup(code)
  }

  return (
        <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-1 flex-col">
          <label htmlFor="redemption-code" className="field-label">
            Código
          </label>
          <input
            ref={inputRef}
            id="redemption-code"
            value={display}
            disabled={locked || isLookingUp}
            onChange={(event) => {
              if (notice) redemption.cancel()
              setCode(normalizeRedemptionCode(event.target.value).slice(0, REDEMPTION_CODE_LENGTH))
            }}
            maxLength={REDEMPTION_CODE_LENGTH + 1}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="••• •••"
            aria-describedby="redemption-code-help"
            aria-invalid={(code.length === REDEMPTION_CODE_LENGTH && !valid) || notice?.code === 'E-12'}
            className="mt-2 h-24 w-full rounded-card border-2 border-text-secondary bg-surface text-center text-5xl font-bold tracking-[0.2em] tabular-nums placeholder:text-black/20 disabled:bg-surface-muted aria-invalid:border-error"
          />
          <p id="redemption-code-help" className="mt-2 text-sm text-text-secondary">
            {helpText(code, valid)}
          </p>

          {locked && (
            <div role="alert" className="mt-4 flex items-start gap-3 rounded-card bg-surface-muted p-4">
              <LockIcon className="size-6 shrink-0 text-error" />
              <div>
                <p className="font-semibold">{ERRORS['E-13'].message}</p>
                <p className="text-sm">
                  Podrás intentar de nuevo en{' '}
                  <span className="font-bold tabular-nums">{formatCountdown(redemption.secondsLeft)}</span>
                </p>
              </div>
            </div>
          )}
          {notice && (
            <p role="alert" className="mt-4 flex items-center gap-2 font-semibold text-error">
              <AlertIcon className="size-6 shrink-0" />
              {noticeText(notice)}
            </p>
          )}

          <div className="mt-auto pt-6">
            <button
              type="submit"
              disabled={!valid || locked || isLookingUp}
              className={`${btnPrimary} flex h-14 w-full items-center justify-center gap-3 text-lg disabled:bg-black/10 disabled:text-text-secondary disabled:opacity-100`}
            >
              {isLookingUp && <Spinner />}
              {isLookingUp ? 'Validando…' : notice?.code === 'E-01' ? 'Reintentar' : 'Validar código'}
            </button>
          </div>
        </form>
  )
}
