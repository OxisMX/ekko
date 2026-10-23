import { ERRORS, type ErrorCode } from '@ekko/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import * as Sentry from '@sentry/react'
import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { AlertIcon, EyeIcon, EyeOffIcon } from '../components/Icons'
import { SupportLink } from '../components/SupportLink'
import { btnPrimary, input } from '../components/ui'
import { supabase } from '../lib/supabase'
import { loginSchema, type LoginValues } from './loginSchema'

// WHY: one message for every credential failure so the form never reveals which emails exist.
export const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos.'

function signInErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) return ERRORS['E-01'].message
  if (isAuthApiError(error) && error.status === 429) return ERRORS['E-13'].message
  if (isAuthApiError(error)) return INVALID_CREDENTIALS
  Sentry.captureException(error)
  return ERRORS['E-99'].message
}

// E-18 adds the recovery action so the notice never leaves the user guessing (RR-5).
function authNotice(code: ErrorCode): string {
  return code === 'E-18' ? `${ERRORS[code].message} Inicia sesión de nuevo.` : ERRORS[code].message
}

const fieldClass = `${input} mt-2 h-12 aria-invalid:border-2`
const labelClass = 'field-label'

// P-11: same overlapping navy circles as the app's BrandPattern (apps/mobile), decorative only.
const CIRCLES = [
  { cx: 40, cy: 30, r: 90, opacity: 0.9 },
  { cx: 150, cy: -20, r: 70, opacity: 0.55 },
  { cx: 330, cy: 60, r: 110, opacity: 0.8 },
  { cx: 250, cy: 190, r: 80, opacity: 0.5 },
  { cx: 90, cy: 210, r: 60, opacity: 0.65 },
]

function BrandPattern() {
  return (
    <svg aria-hidden="true" viewBox="0 0 375 240" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-x-0 top-0 h-72 w-full">
      {CIRCLES.map((c) => (
        <circle key={`${c.cx}-${c.cy}`} cx={c.cx} cy={c.cy} r={c.r} fill="var(--color-pattern)" fillOpacity={c.opacity} />
      ))}
    </svg>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1 flex items-center gap-1 text-sm text-error">
      <AlertIcon className="size-4 shrink-0" />
      {message}
    </p>
  )
}

// P-01 (F-20).
export function LoginPage() {
  const { session, authError, clearAuthError } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    resetField,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  if (session) return <Navigate to="/" replace />

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    clearAuthError()
    const { error } = await supabase.auth.signInWithPassword(values)
    if (!error) return
    setSubmitError(signInErrorMessage(error))
    resetField('password')
    setFocus('password')
  })

  const formError = submitError ?? (authError ? authNotice(authError) : null)

  return (
    <main className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-brand">
      <BrandPattern />
      <p className="relative px-6 pt-14 pb-10 text-center text-white">
        <span className="block text-3xl font-bold tracking-tight">Ekko Rewards</span>
        <span className="text-sm text-white/80">Panel del comercio</span>
      </p>
      <div className="relative w-full max-w-md flex-1 rounded-t-sheet bg-surface p-8 sm:mb-12 sm:flex-none sm:rounded-sheet sm:p-10">
        <div>
          <h1 className="text-display font-bold">Iniciar sesión</h1>
          <p className="mt-2 text-text-secondary">Entra con la cuenta de tu negocio.</p>

          {formError && (
            <div
              role="alert"
              className="mt-6 flex gap-2 rounded-lg border border-error bg-error/5 p-3 text-sm text-text-primary"
            >
              <AlertIcon className="size-5 shrink-0 text-error" />
              {formError}
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
            <div>
              <label htmlFor="email" className={labelClass}>
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={fieldClass}
                {...register('email', { onChange: clearAuthError })}
              />
              <FieldError id="email-error" message={errors.email?.message} />
            </div>
            <div>
              <label htmlFor="password" className={labelClass}>
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className={`${fieldClass} pr-14`}
                  {...register('password', { onChange: clearAuthError })}
                />
                {/* WHY "clave": Playwright's getByLabel('Contraseña') is a substring match and must stay unique. */}
                <button
                  type="button"
                  aria-label="Mostrar clave"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((shown) => !shown)}
                  className="absolute top-2 right-0 grid size-12 place-items-center rounded-button text-text-secondary hover:text-text-primary"
                >
                  {showPassword ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
                </button>
              </div>
              <FieldError id="password-error" message={errors.password?.message} />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className={`${btnPrimary} h-14 w-full text-lg disabled:cursor-wait`}
            >
              {isSubmitting ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            ¿Olvidaste tu contraseña? <SupportLink>Contacta a Oxis</SupportLink>.
          </p>
        </div>
      </div>
    </main>
  )
}
