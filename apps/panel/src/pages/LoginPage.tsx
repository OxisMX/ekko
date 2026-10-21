import { ERRORS } from '@ekko/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import * as Sentry from '@sentry/react'
import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { AlertIcon } from '../components/Icons'
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

const fieldClass =
  'mt-2 h-12 w-full rounded-lg border border-text-secondary bg-surface px-4 text-base aria-invalid:border-2 aria-invalid:border-error'
const labelClass = 'text-xs font-semibold tracking-[1.5px] uppercase'

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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  if (session) return <Navigate to="/" replace />

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    clearAuthError()
    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) setSubmitError(signInErrorMessage(error))
  })

  const formError = submitError ?? (authError ? ERRORS[authError].message : null)

  return (
    <main className="grid min-h-dvh place-items-center bg-brand p-6">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-white">
          <span className="block text-3xl font-bold tracking-tight">Ekko Rewards</span>
          <span className="text-sm text-white/80">Panel del comercio</span>
        </p>
        <div className="rounded-[32px] bg-surface p-8 sm:p-10">
          <h1 className="text-[32px] leading-9 font-bold">Iniciar sesión</h1>
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
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={fieldClass}
                {...register('email')}
              />
              <FieldError id="email-error" message={errors.email?.message} />
            </div>
            <div>
              <label htmlFor="password" className={labelClass}>
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className={fieldClass}
                {...register('password')}
              />
              <FieldError id="password-error" message={errors.password?.message} />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="h-14 w-full rounded-xl bg-brand text-lg font-semibold text-white transition-colors hover:bg-navy disabled:cursor-wait disabled:opacity-70"
            >
              {isSubmitting ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">¿Olvidaste tu contraseña? Contacta a Oxis.</p>
        </div>
      </div>
    </main>
  )
}
