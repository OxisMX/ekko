import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { AdminLayout } from '../components/AdminLayout'
import type { MerchantSession } from '../lib/panelRoute'
import { MetricsPage } from './MetricsPage'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc, functions: { invoke: vi.fn() } } }))

const session: MerchantSession = {
  merchant: { id: 'm1', name: 'Café Ekko Centro', logo_path: null },
  is_active: true,
  admin_unlocked_until: new Date(Date.now() + 10 * 60_000).toISOString(),
  pin_locked_until: null,
  validator_locked_until: null,
}

function Gate() {
  const { data } = useQuery({ queryKey: ['merchant-session', 'u1'], queryFn: () => session, staleTime: Infinity })
  return data ? <Outlet context={{ merchantSession: data }} /> : null
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  queryClient.setQueryData(['merchant-session', 'u1'], session)
  const auth: AuthState = { session: undefined, authError: null, clearAuthError: vi.fn(), signOut: vi.fn() }
  const router = createMemoryRouter(
    [{ element: <Gate />, children: [{ path: '/admin', element: <AdminLayout />, children: [{ path: 'metricas', element: <MetricsPage /> }, { path: 'notificaciones', element: <p>Push</p> }] }] }],
    { initialEntries: ['/admin/metricas'] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={auth}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  )
}

const ok = (data: unknown) => ({ data, error: null })
const rpcError = (message: string) => ({ data: null, error: { message, details: null, code: 'P0001' } })
const unlockOk = ok({ ok: true, admin_unlocked_until: new Date(Date.now() + 300_000).toISOString() })
const enterPin = async () => {
  const pin = await screen.findByRole('dialog', { name: /PIN/i })
  for (const digit of '1234') fireEvent.click(within(pin).getByRole('button', { name: digit }))
}

beforeEach(() => rpc.mockReset())

const metrics = (over = {}) => ({ visits: 1234, redemptions: 56, active_customers: 78, push_remaining_this_month: 3, ...over })

describe('P-05 métricas', () => {
  it('shows the three tiles with es-MX formatting, the 30-day note and the push quota link', async () => {
    rpc.mockResolvedValue(ok(metrics()))
    renderPage()
    expect(await screen.findByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('56')).toBeInTheDocument()
    expect(screen.getByText('78')).toBeInTheDocument()
    expect(screen.getByText('últimos 30 días')).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('get_metrics', { p_range: '30d' })
    expect(screen.getByRole('link', { name: 'Notificaciones restantes este mes: 3 de 5' })).toHaveAttribute('href', '/admin/notificaciones')
  })

  it('switching to Histórico asks for p_range all', async () => {
    rpc.mockResolvedValue(ok(metrics()))
    renderPage()
    await screen.findByText('1,234')
    fireEvent.click(screen.getByRole('radio', { name: 'Histórico' }))
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('get_metrics', { p_range: 'all' }))
    expect(screen.getByRole('radio', { name: 'Histórico' })).toHaveAttribute('aria-checked', 'true')
  })

  it('shows a skeleton while loading', async () => {
    rpc.mockImplementation((n: string) => (n === 'get_metrics' ? new Promise(() => undefined) : Promise.resolve(ok({}))))
    renderPage()
    expect(await screen.findByRole('status', { name: 'Cargando las métricas' })).toBeInTheDocument()
  })

  it('shows friendly copy for a merchant without activity', async () => {
    rpc.mockResolvedValue(ok(metrics({ visits: 0, redemptions: 0, active_customers: 0 })))
    renderPage()
    expect(await screen.findByText(/Aún no hay actividad/)).toBeInTheDocument()
  })

  it('shows the error and retries', async () => {
    rpc.mockResolvedValueOnce(rpcError('E-99')).mockResolvedValue(ok(metrics()))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('1,234')).toBeInTheDocument()
  })

  it('E-16 asks for the PIN and retries', async () => {
    rpc.mockImplementation(async (name: string) => (name === 'unlock_admin' ? unlockOk : rpc.mock.calls.filter(([n]) => n === 'get_metrics').length === 1 ? rpcError('E-16') : ok(metrics())))
    renderPage()
    await enterPin()
    expect(await screen.findByText('1,234')).toBeInTheDocument()
  })
})
