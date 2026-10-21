import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthApiError } from '@supabase/supabase-js'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthProvider'
import { INVALID_CREDENTIALS, LoginPage } from './LoginPage'

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({ supabase: { auth } }))

beforeEach(() => {
  vi.resetAllMocks()
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
