import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthApiError } from '@supabase/supabase-js'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthProvider'
import { USER_SIGN_OUT_KEY } from '../auth/sessionExpiry'
import { INVALID_CREDENTIALS, LoginPage } from './LoginPage'

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({ supabase: { auth } }))

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  auth.onAuthStateChange.mockImplementation((cb: (event: string, session: null) => void) => {
    cb('INITIAL_SESSION', null)
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
})

function renderLogin() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

it('shows validation messages and does not call Supabase with an invalid form', async () => {
  const user = renderLogin()
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  expect(await screen.findByText('Ingresa tu correo.')).toBeInTheDocument()
  expect(screen.getByText('Ingresa tu contraseña.')).toBeInTheDocument()

  await user.type(screen.getByLabelText('Correo electrónico'), 'no-es-correo')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  expect(await screen.findByText('Ingresa un correo válido.')).toBeInTheDocument()
  expect(auth.signInWithPassword).not.toHaveBeenCalled()
})

it('disables the button while signing in and shows one generic error on failure', async () => {
  let finish!: (value: unknown) => void
  auth.signInWithPassword.mockReturnValue(new Promise((resolve) => (finish = resolve)))
  const user = renderLogin()

  await user.type(screen.getByLabelText('Correo electrónico'), ' caja@cafe.mx ')
  await user.type(screen.getByLabelText('Contraseña'), 'secreta')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))

  const pending = await screen.findByRole('button', { name: 'Entrando…' })
  expect(pending).toBeDisabled()
  expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'caja@cafe.mx', password: 'secreta' })

  finish({ data: {}, error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials') })
  expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_CREDENTIALS)
  expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
})

it('signs out a non-merchant session and shows E-19', async () => {
  auth.onAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
    cb('SIGNED_IN', { user: { id: 'u1', app_metadata: { role: 'customer' } } })
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  renderLogin()
  expect(await screen.findByRole('alert')).toHaveTextContent('Esta cuenta no corresponde a esta aplicación.')
  expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
})

it('focuses the email field and exposes password-manager hints', () => {
  renderLogin()
  expect(screen.getByLabelText('Correo electrónico')).toHaveFocus()
  expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('autocomplete', 'username')
  expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password')
})

it('submits with Enter and, after a failure, clears and focuses the password', async () => {
  auth.signInWithPassword.mockResolvedValue({
    data: {},
    error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
  })
  const user = renderLogin()
  await user.type(screen.getByLabelText('Correo electrónico'), 'caja@cafe.mx')
  await user.type(screen.getByLabelText('Contraseña'), 'secreta{Enter}')

  expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_CREDENTIALS)
  expect(auth.signInWithPassword).toHaveBeenCalledOnce()
  expect(screen.getByLabelText('Contraseña')).toHaveValue('')
  expect(screen.getByLabelText('Contraseña')).toHaveFocus()
})

type AuthCallback = (event: string, session: unknown) => void
const merchant = { user: { id: 'm1', app_metadata: { role: 'merchant' } } }

function captureAuthCallback() {
  let emit!: AuthCallback
  auth.onAuthStateChange.mockImplementation((cb: AuthCallback) => {
    emit = cb
    cb('INITIAL_SESSION', merchant)
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  return (event: string, session: unknown) => act(() => emit(event, session))
}

it('shows E-18 when the session ends without the user signing out, and hides it on typing', async () => {
  const emit = captureAuthCallback()
  const user = renderLogin()
  emit('SIGNED_OUT', null)

  expect(await screen.findByRole('alert')).toHaveTextContent('Tu sesión expiró. Inicia sesión de nuevo.')
  await user.type(screen.getByLabelText('Correo electrónico'), 'c')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('shows nothing when the user signed out (in this or another tab)', async () => {
  const emit = captureAuthCallback()
  renderLogin()
  localStorage.setItem(USER_SIGN_OUT_KEY, '1')
  emit('SIGNED_OUT', null)

  expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()

  emit('SIGNED_IN', merchant)
  expect(localStorage.getItem(USER_SIGN_OUT_KEY)).toBeNull()
})
