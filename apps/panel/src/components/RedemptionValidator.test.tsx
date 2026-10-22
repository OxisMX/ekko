import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import type { MerchantSession } from '../lib/panelRoute'
import { RedemptionValidator } from './RedemptionValidator'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }))

const coupon = {
  ok: true,
  coupon_id: 'c0000000-0000-4000-8000-000000000001',
  customer_full_name: 'Ana Pérez',
  title: 'Galleta gratis',
  description: 'Una galleta de la vitrina.',
  terms: 'No acumulable.',
  source: 'wheel',
  expires_at: '2026-10-30T18:00:00Z',
}
const rpcError = (message: string, details: object | null = null) => ({
  data: null,
  error: { message, details: details && JSON.stringify(details), code: 'P0001' },
})

const signOut = vi.fn<AuthState['signOut']>()

function renderValidator(validatorLockedUntil: string | null = null) {
  const merchantSession: MerchantSession = {
    merchant: { id: 'm1', name: 'Café Ekko Centro', logo_path: null },
    is_active: true,
    admin_unlocked_until: null,
    pin_locked_until: null,
    validator_locked_until: validatorLockedUntil,
  }
  const auth: AuthState = { session: undefined, authError: null, clearAuthError: vi.fn(), signOut }
  const router = createMemoryRouter([
    { element: <Outlet context={{ merchantSession }} />, children: [{ path: '/', element: <RedemptionValidator /> }] },
  ])
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <AuthContext value={auth}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  )
}

const flush = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms))
const input = () => screen.getByLabelText('Código')
const typeCode = (value: string) => fireEvent.change(input(), { target: { value } })
async function submit(value = 'k7m4qx') {
  typeCode(value)
  fireEvent.click(screen.getByRole('button', { name: 'Validar código' }))
  await flush()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(new Date('2026-10-21T10:00:00Z'))
  rpc.mockReset()
  signOut.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('RedemptionValidator', () => {
  it('normalizes lowercase input into two groups and enables submit only for valid codes', async () => {
    await flush()
    renderValidator()
    const submitButton = screen.getByRole('button', { name: 'Validar código' })

    typeCode('k7m 4q')
    expect(input()).toHaveValue('K7M 4Q')
    expect(submitButton).toBeDisabled()

    typeCode('k7m 4qx')
    expect(input()).toHaveValue('K7M 4QX')
    expect(submitButton).toBeEnabled()

    // 0 and O are excluded from the alphabet.
    typeCode('k7m4q0')
    expect(input()).toHaveValue('K7M 4Q0')
    expect(submitButton).toBeDisabled()
    expect(input()).toHaveAttribute('aria-invalid', 'true')
  })

  it('found → P-03 with customer, benefit, origin; confirm shows "Canje registrado" for 3 s then an empty focused field', async () => {
    renderValidator()
    rpc.mockResolvedValueOnce({ data: coupon, error: null })
    await submit()
    expect(rpc).toHaveBeenCalledWith('lookup_redemption', { p_code: 'K7M4QX' })

    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('Galleta gratis')).toBeInTheDocument()
    expect(screen.getByText('Una galleta de la vitrina.')).toBeInTheDocument()
    expect(screen.getByText('No acumulable.')).toBeInTheDocument()
    expect(screen.getByText('Ruleta de bienvenida')).toBeInTheDocument()
    expect(screen.getByText(/Vence el/)).toBeInTheDocument()

    let resolve!: (value: unknown) => void
    rpc.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar canje' }))
    await flush()
    expect(screen.getByRole('button', { name: 'Confirmando…' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmando…' })) // no double submit
    resolve({ data: { redeemed_at: '2026-10-21T10:00:01Z' }, error: null })
    await flush()
    expect(rpc).toHaveBeenCalledWith('confirm_redemption', { p_coupon_id: coupon.coupon_id })
    expect(rpc).toHaveBeenCalledTimes(2)

    expect(screen.getByText('Canje registrado')).toBeVisible()
    await flush(2_999)
    expect(screen.getByText('Canje registrado')).toBeVisible()
    await flush(1)
    expect(screen.queryByText('Canje registrado')).not.toBeInTheDocument()
    expect(input()).toHaveValue('')
    expect(input()).toHaveFocus()
  })

  it('"Cancelar" returns to an empty field without confirming', async () => {
    renderValidator()
    rpc.mockResolvedValueOnce({ data: coupon, error: null })
    await submit()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(input()).toHaveValue('')
    expect(input()).toHaveFocus()
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('E-12 (not found) says the code is invalid and how many attempts remain', async () => {
    renderValidator()
    rpc.mockResolvedValueOnce({ data: { ok: false, error: 'E-12', remaining: 3 }, error: null })
    await submit()
    expect(screen.getByRole('alert')).toHaveTextContent('Código no válido. Te quedan 3 intentos.')
    expect(input()).toBeEnabled()
    expect(input()).toHaveFocus()
  })

  it('E-13 locks the field with a countdown and unlocks by itself', async () => {
    renderValidator()
    const until = new Date(Date.now() + 90_000).toISOString()
    rpc.mockResolvedValueOnce({ data: { ok: false, error: 'E-13', locked_until: until }, error: null })
    await submit()

    expect(input()).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Demasiados intentos')
    expect(screen.getByText('1:30')).toBeInTheDocument()
    await flush(30_000)
    expect(screen.getByText('1:00')).toBeInTheDocument()
    await flush(60_000)
    expect(input()).toBeEnabled()
    expect(input()).toHaveFocus()
  })

  it('starts locked when the session already has validator_locked_until', async () => {
    renderValidator(new Date(Date.now() + 5_000).toISOString())
    expect(input()).toBeDisabled()
    expect(screen.getByText('0:05')).toBeInTheDocument()
    await flush(5_000)
    expect(input()).toBeEnabled()
  })

  it('a thrown E-13 (already locked) uses details.locked_until', async () => {
    renderValidator()
    rpc.mockResolvedValueOnce(rpcError('E-13', { locked_until: new Date(Date.now() + 60_000).toISOString() }))
    await submit()
    expect(input()).toBeDisabled()
    expect(screen.getByText('1:00')).toBeInTheDocument()
  })

  it.each([
    ['E-10', 'Este cupón venció.'],
    ['E-11', 'Este cupón ya fue canjeado.'],
  ])('lookup %s shows its message and returns to the field', async (code, message) => {
    renderValidator()
    rpc.mockResolvedValueOnce(rpcError(code))
    await submit()
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(input()).toBeEnabled()
  })

  it('confirm E-11 (redeemed on another device) goes back to the field with the message', async () => {
    renderValidator()
    rpc.mockResolvedValueOnce({ data: coupon, error: null })
    await submit()
    rpc.mockResolvedValueOnce(rpcError('E-11'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar canje' }))
    await flush()
    expect(screen.getByRole('alert')).toHaveTextContent('Este cupón ya fue canjeado.')
    expect(input()).toHaveValue('')
  })

  it('E-01 on lookup is retryable', async () => {
    renderValidator()
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'TypeError: Failed to fetch', details: null, code: '' } })
    await submit()
    expect(screen.getByRole('alert')).toHaveTextContent('No hay conexión')
    rpc.mockResolvedValueOnce({ data: coupon, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await flush()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
  })

  it('E-19 signs out through the existing path', async () => {
    renderValidator()
    rpc.mockResolvedValueOnce(rpcError('E-19'))
    await submit()
    expect(signOut).toHaveBeenCalledWith('E-19')
  })
})
