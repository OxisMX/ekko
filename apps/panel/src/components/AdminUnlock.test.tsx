import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { useAdminRpc } from '../lib/adminUnlockContext'
import type { MerchantSession } from '../lib/panelRoute'
import { AdminLayout } from './AdminLayout'
import { PanelShell } from './PanelShell'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }))

const rpcError = (message: string, details: object | null = null) => ({
  data: null,
  error: { message, details: details && JSON.stringify(details), code: 'P0001' },
})
const NOW = new Date('2026-10-21T10:00:00Z')
const inMs = (ms: number) => new Date(NOW.getTime() + ms).toISOString()

const baseSession: MerchantSession = {
  merchant: { id: 'm1', name: 'Café Ekko Centro', logo_path: null },
  is_active: true,
  admin_unlocked_until: null,
  pin_locked_until: null,
  validator_locked_until: null,
}

// Stands in for PanelGate: the outlet context follows the query cache, like the real thing.
function Gate() {
  const { data } = useQuery({ queryKey: ['merchant-session', 'u1'], queryFn: () => baseSession, staleTime: Infinity })
  return data ? <Outlet context={{ merchantSession: data }} /> : null
}

function FormSection() {
  const adminRpc = useAdminRpc()
  return (
    <div>
      <input aria-label="Nombre" />
      <button onClick={() => void adminRpc(() => rpc('some_admin_rpc'))}>Guardar</button>
    </div>
  )
}

const signOut = vi.fn<AuthState['signOut']>()

function renderApp(session: Partial<MerchantSession> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  queryClient.setQueryData(['merchant-session', 'u1'], { ...baseSession, ...session })
  const auth: AuthState = { session: undefined, authError: null, clearAuthError: vi.fn(), signOut }
  const router = createMemoryRouter(
    [
      {
        element: <Gate />,
        children: [
          { path: '/', element: <PanelShell showAdmin>Caja</PanelShell> },
          { path: '/admin', element: <AdminLayout />, children: [{ path: 'menu', element: <FormSection /> }] },
        ],
      },
    ],
    { initialEntries: ['/'] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={auth}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  )
  return router
}

const flush = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms))
const typePin = async (pin: string) => {
  for (const d of pin) fireEvent.click(screen.getByRole('button', { name: d }))
  await flush()
}
const openPin = () => fireEvent.click(screen.getByRole('button', { name: 'Administrar' }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(NOW)
  rpc.mockReset()
  signOut.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('P-04 PIN unlock', () => {
  it('correct PIN sends automatically at 4 digits and enters the admin sections', async () => {
    const router = renderApp()
    rpc.mockResolvedValueOnce({ data: { ok: true, admin_unlocked_until: inMs(5 * 60_000) }, error: null })
    openPin()
    await typePin('123')
    expect(rpc).not.toHaveBeenCalled()
    await typePin('4')
    expect(rpc).toHaveBeenCalledWith('unlock_admin', { p_pin: '1234' })
    expect(router.state.location.pathname).toBe('/admin')
    expect(screen.getByText(/Se bloquea en/)).toBeInTheDocument()
  })

  it('the physical keyboard and "Borrar" work too', async () => {
    renderApp()
    rpc.mockResolvedValueOnce({ data: { ok: true, admin_unlocked_until: inMs(5 * 60_000) }, error: null })
    openPin()
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: '9' })
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    for (const key of '1234') fireEvent.keyDown(dialog, { key })
    await flush()
    expect(rpc).toHaveBeenCalledWith('unlock_admin', { p_pin: '1234' })
  })

  it('E-14 shows the remaining attempts and clears the PIN', async () => {
    renderApp()
    rpc.mockResolvedValueOnce({ data: { ok: false, error: 'E-14', remaining: 2 }, error: null })
    openPin()
    await typePin('0000')
    expect(screen.getByRole('alert')).toHaveTextContent('PIN incorrecto. Te quedan 2 intentos.')
    expect(screen.getByRole('status')).toHaveTextContent('0 de 4')
  })

  it('E-15 blocks the keypad with a countdown and unblocks by itself', async () => {
    renderApp()
    rpc.mockResolvedValueOnce({ data: { ok: false, error: 'E-15', locked_until: inMs(90_000) }, error: null })
    openPin()
    await typePin('0000')
    expect(screen.getByRole('alert')).toHaveTextContent('Acceso bloqueado por demasiados intentos fallidos')
    expect(screen.getByText('1:30')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled()
    await flush(90_000)
    expect(screen.getByRole('button', { name: '1' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('opens already blocked when the session has pin_locked_until, and can go back to Modo Caja', async () => {
    renderApp({ pin_locked_until: inMs(60_000) })
    openPin()
    expect(screen.getByText('1:00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Volver a Modo Caja' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('a thrown E-15 uses details.locked_until', async () => {
    renderApp()
    rpc.mockResolvedValueOnce(rpcError('E-15', { locked_until: inMs(45_000) }))
    openPin()
    await typePin('1111')
    expect(screen.getByText('0:45')).toBeInTheDocument()
  })

  it('Administrar skips the PIN while the window is still open', () => {
    const router = renderApp({ admin_unlocked_until: inMs(60_000) })
    openPin()
    expect(router.state.location.pathname).toBe('/admin')
  })
})

describe('admin session lifecycle', () => {
  const adminOpen = () => renderApp({ admin_unlocked_until: inMs(10 * 60_000) })

  it('5 min without interaction locks and returns to Modo Caja; interaction resets the clock', async () => {
    const router = adminOpen()
    router.navigate('/admin/menu')
    await flush()
    await flush(4 * 60_000)
    fireEvent.pointerDown(document.body)
    await flush(4 * 60_000)
    expect(router.state.location.pathname).toBe('/admin/menu')
    await flush(60_000)
    expect(rpc).toHaveBeenCalledWith('lock_admin')
    expect(router.state.location.pathname).toBe('/')
  })

  it('leaves when admin_unlocked_until passes', async () => {
    const router = renderApp({ admin_unlocked_until: inMs(3_000) })
    router.navigate('/admin/menu')
    await flush()
    expect(screen.getByText('0:03')).toBeInTheDocument()
    await flush(3_000)
    expect(router.state.location.pathname).toBe('/')
  })

  it('"Bloquear y volver a Caja" calls lock_admin and goes back to Modo Caja', async () => {
    const router = adminOpen()
    router.navigate('/admin/menu')
    await flush()
    rpc.mockResolvedValue({ data: { ok: true }, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear y volver a Caja' }))
    expect(rpc).toHaveBeenCalledWith('lock_admin')
    expect(router.state.location.pathname).toBe('/')
  })

  it('E-16 opens the PIN over the section, keeps the form, and retries after unlocking', async () => {
    const router = adminOpen()
    router.navigate('/admin/menu')
    await flush()
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Latte' } })
    rpc.mockResolvedValueOnce(rpcError('E-16'))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await flush()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('Latte')

    rpc.mockResolvedValueOnce({ data: { ok: true, admin_unlocked_until: inMs(15 * 60_000) }, error: null })
    rpc.mockResolvedValueOnce({ data: {}, error: null })
    await typePin('1234')
    await flush()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('Latte')
    expect(rpc).toHaveBeenCalledTimes(3)
    expect(rpc).toHaveBeenLastCalledWith('some_admin_rpc')
  })
})
