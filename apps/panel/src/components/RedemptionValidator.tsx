import { isValidRedemptionCode, normalizeRedemptionCode, REDEMPTION_CODE_LENGTH } from '@ekko/shared'
import { useState, type FormEvent } from 'react'
import { TicketIcon } from './Icons'

const GROUP = REDEMPTION_CODE_LENGTH / 2

function helpText(code: string, valid: boolean) {
  if (valid) return 'Código completo. Ya puedes validarlo.'
  if (code.length < REDEMPTION_CODE_LENGTH) return `Faltan ${REDEMPTION_CODE_LENGTH - code.length} caracteres.`
  return 'Revisa el código: no usa 0, O, 1, I ni L.'
}

// RT-11: accepts lowercase, shows two groups of 3 large characters.
export function RedemptionValidator({ className = '' }: { className?: string }) {
  const [code, setCode] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const valid = isValidRedemptionCode(code)
  const display = code.length > GROUP ? `${code.slice(0, GROUP)} ${code.slice(GROUP)}` : code

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    // TODO(S7): lookup_redemption({ p_code: code }) and open P-03.
    setSubmitted(true)
  }

  return (
    <section aria-labelledby="validator-title" className={`flex flex-col rounded-2xl bg-surface p-6 ${className}`}>
      <div className="flex items-center gap-3">
        <TicketIcon className="size-7 text-navy" />
        <h2 id="validator-title" className="text-xl font-semibold">
          Validar código de canje
        </h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">Pide al cliente el código de 6 caracteres que aparece en su app.</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-1 flex-col">
        <label htmlFor="redemption-code" className="text-xs font-semibold tracking-[1.5px] uppercase">
          Código
        </label>
        <input
          id="redemption-code"
          value={display}
          onChange={(event) => {
            setSubmitted(false)
            setCode(normalizeRedemptionCode(event.target.value).slice(0, REDEMPTION_CODE_LENGTH))
          }}
          maxLength={REDEMPTION_CODE_LENGTH + 1}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="••• •••"
          aria-describedby="redemption-code-help"
          aria-invalid={code.length === REDEMPTION_CODE_LENGTH && !valid}
          className="mt-2 h-24 w-full rounded-xl border-2 border-text-secondary bg-surface text-center text-5xl font-bold tracking-[0.2em] tabular-nums placeholder:text-black/20 aria-invalid:border-error"
        />
        <p id="redemption-code-help" className="mt-2 text-sm text-text-secondary">
          {helpText(code, valid)}
        </p>

        <div className="mt-auto pt-6">
          <button
            type="submit"
            disabled={!valid}
            className="h-14 w-full rounded-xl bg-navy text-lg font-semibold text-white transition-colors hover:bg-brand disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-text-secondary"
          >
            Validar código
          </button>
          <p role="status" className="mt-2 min-h-5 text-center text-sm text-text-secondary">
            {submitted && 'La validación de códigos estará disponible próximamente.'}
          </p>
        </div>
      </form>
    </section>
  )
}
