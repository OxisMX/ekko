import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { SESSION_POLL_MS } from '../lib/panelRoute'
import { PanelGate } from './PanelGate'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }))

const sessionData = (is_active: boolean) => ({
  data: {
    merchant: { id: 'm1', name: 'Café Ekko', logo_path: null },
    is_active,
    admin_unlocked_until: new Date(Date.now() + 5 * 60_000).toISOString(),
    pin_locked_until: null,
    validator_locked_until: null,
  },
  error: null,
})

let queryClient: QueryClient
function renderAt(path: string) {
  const auth = { session: { user: { id: 'u1', app_metadata: { role: 'merchant' } } }, signOut: vi.fn() } as unknown as AuthState
  const router = createMemoryRouter(
    [
      {
        element: <PanelGate />,
        children: [
          { path: '/', element: <p>P-02 caja</p> },
          { path: '/inactiva', element: <p>P-12 inactivo</p> },
          { path: '/admin/*', element: <p>admin</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={auth}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  )
}
const flush = () => act(() => vi.advanceTimersByTimeAsync(10))

beforeEach(() => {
  vi.useFakeTimers()
  rpc.mockReset()
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
  focusManager.setFocused(undefined)
  vi.useRealTimers()
})

describe('PanelGate con comercio inactivo (F-28, RN-71)', () => {
  it.each(['/', '/admin/tarjeta', '/admin'])('%s redirige a P-12', async (path) => {
    rpc.mockResolvedValue(sessionData(false))
    renderAt(path)
    await flush()
    expect(screen.getByText('P-12 inactivo')).toBeInTheDocument()
  })

  it('activo → inactivo por intervalo: Modo Caja pasa a P-12', async () => {
    rpc.mockResolvedValue(sessionData(true))
    renderAt('/')
    await flush()
    expect(screen.getByText('P-02 caja')).toBeInTheDocument()
    rpc.mockResolvedValue(sessionData(false))
    await act(() => vi.advanceTimersByTimeAsync(SESSION_POLL_MS))
    expect(screen.getByText('P-12 inactivo')).toBeInTheDocument()
  })

  it('activo → inactivo estando en admin: sale a P-12', async () => {
    rpc.mockResolvedValue(sessionData(true))
    renderAt('/admin/tarjeta')
    await flush()
    expect(screen.getByText('admin')).toBeInTheDocument()
    rpc.mockResolvedValue(sessionData(false))
    await act(() => vi.advanceTimersByTimeAsync(SESSION_POLL_MS))
    expect(screen.getByText('P-12 inactivo')).toBeInTheDocument()
  })

  it('inactivo → activo al volver la visibilidad de la pestaña: vuelve a P-02', async () => {
    rpc.mockResolvedValue(sessionData(false))
    renderAt('/inactiva')
    await flush()
    expect(screen.getByText('P-12 inactivo')).toBeInTheDocument()
    rpc.mockResolvedValue(sessionData(true))
    // TanStack's focusManager is what reacts to visibilitychange/focus; it only fires on a hidden→visible change.
    focusManager.setFocused(false)
    focusManager.setFocused(true)
    await flush()
    expect(screen.getByText('P-02 caja')).toBeInTheDocument()
  })

  it('E-05 en una RPC: invalidar la sesión redirige a P-12', async () => {
    rpc.mockResolvedValue(sessionData(true))
    renderAt('/')
    await flush()
    rpc.mockResolvedValue(sessionData(false))
    void queryClient.invalidateQueries({ queryKey: ['merchant-session'] })
    await flush()
    expect(screen.getByText('P-12 inactivo')).toBeInTheDocument()
  })
})
