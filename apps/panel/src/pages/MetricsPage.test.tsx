import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { AdminLayout } from '../components/AdminLayout'
import type { MerchantSession } from '../lib/panelRoute'
import { MetricsPage } from './MetricsPage'

// WHY: jsdom has no layout, so the real ResponsiveContainer renders 0x0 and recharts draws nothing.
vi.mock('recharts', async (orig) => {
  const actual = await orig<typeof import('recharts')>()
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactElement }) => <div style={{ width: 600, height: 280 }}>{children}</div> }
})

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

const series = (over = {}) => ({
  visits: [{ bucket: '2026-10-20', count: 4 }, { bucket: '2026-10-21', count: 7 }],
  coupons: [{ bucket: '2026-10-20', issued: 3, redeemed: 1 }, { bucket: '2026-10-21', issued: 2, redeemed: 2 }],
  active_customers: [{ bucket: '2026-10-19', count: 5 }],
  ...over,
})
// Answers each RPC by name; `get_metrics` fails if `fail` is set.
const serve = (m: object, s: object = series()) =>
  rpc.mockImplementation(async (name: string) => (name === 'get_metrics_series' ? ok(s) : ok(m)))
const metrics = (over = {}) => ({ visits: 1234, redemptions: 56, active_customers: 78, push_remaining_this_month: 3, ...over })

describe('P-05 métricas', () => {
  it('shows the three tiles with es-MX formatting, the 30-day note and the push quota link', async () => {
    serve(metrics())
    renderPage()
    expect(await screen.findByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('56')).toBeInTheDocument()
    expect(screen.getByText('78')).toBeInTheDocument()
    expect(screen.getByText('últimos 30 días')).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('get_metrics', { p_range: '30d' })
    expect(screen.getByRole('link', { name: 'Notificaciones restantes este mes: 3 de 5' })).toHaveAttribute('href', '/admin/notificaciones')
  })

  it('switching to Histórico asks for p_range all', async () => {
    serve(metrics())
    renderPage()
    await screen.findByText('1,234')
    fireEvent.click(screen.getByRole('button', { name: 'Histórico' }))
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('get_metrics', { p_range: 'all' }))
    expect(screen.getByRole('button', { name: 'Histórico' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Últimos 30 días' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a skeleton while loading', async () => {
    rpc.mockImplementation((n: string) => (n === 'get_metrics' ? new Promise(() => undefined) : Promise.resolve(ok(series()))))
    renderPage()
    expect(await screen.findByRole('status', { name: 'Cargando las métricas' })).toBeInTheDocument()
  })

  it('shows friendly copy and a way to Modo Caja for a merchant without activity (P-26)', async () => {
    serve(metrics({ visits: 0, redemptions: 0, active_customers: 0 }))
    renderPage()
    expect(await screen.findByText(/Aún no hay actividad/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Modo Caja' })).toHaveAttribute('href', '/')
  })

  it('shows the redemption rate from the series and the value copy (P-23)', async () => {
    serve(metrics({ redemptions: 56 }), series({ coupons: [{ bucket: '2026-10-20', issued: 3, redeemed: 1 }, { bucket: '2026-10-21', issued: 5, redeemed: 4 }] }))
    renderPage()
    expect(await screen.findByText('63 %')).toBeInTheDocument() // 5 of 8
    expect(screen.getByText('premios entregados a tus clientes')).toBeInTheDocument()
  })

  it('states the change against the previous period with words and an arrow, and omits it for Histórico (P-23)', async () => {
    serve(metrics({ visits: 1234, redemptions: 56, previous: { visits: 1000, redemptions: 60 } }))
    renderPage()
    expect(await screen.findByText('234 más que los 30 días anteriores')).toBeInTheDocument()
    expect(screen.getByText('4 menos que los 30 días anteriores')).toBeInTheDocument()

    serve(metrics({ previous: null }))
    fireEvent.click(screen.getByRole('button', { name: 'Histórico' }))
    await vi.waitFor(() => expect(screen.queryByText(/anteriores/)).not.toBeInTheDocument())
  })

  it('shows the error and retries', async () => {
    serve(metrics())
    rpc.mockImplementationOnce(async () => rpcError('E-99'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('1,234')).toBeInTheDocument()
  })

  it('renders the three charts with an accessible data table each', async () => {
    serve(metrics())
    renderPage()
    expect(await screen.findByText('Cupones emitidos y canjeados')).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('get_metrics_series', { p_range: '30d' })
    expect(screen.getAllByRole('table')).toHaveLength(3)
    const visits = screen.getByRole('table', { name: 'Visitas' })
    expect(within(visits).getByText('7')).toBeInTheDocument()
    expect(within(visits).getByRole('columnheader', { name: 'Día' })).toBeInTheDocument()
    expect(within(screen.getByRole('table', { name: 'Cupones emitidos y canjeados' })).getByRole('columnheader', { name: 'Canjeados' })).toBeInTheDocument()
  })

  it('asks for the all-time series when switching range', async () => {
    serve(metrics())
    renderPage()
    await screen.findByText('Cupones emitidos y canjeados')
    fireEvent.click(screen.getByRole('button', { name: 'Histórico' }))
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('get_metrics_series', { p_range: 'all' }))
  })

  it('shows "Aún no hay datos" for all-zero series', async () => {
    serve(metrics(), series({ visits: [{ bucket: '2026-10-20', count: 0 }], coupons: [{ bucket: '2026-10-20', issued: 0, redeemed: 0 }], active_customers: [{ bucket: '2026-10-19', count: 0 }] }))
    renderPage()
    expect(await screen.findAllByText('Aún no hay datos')).toHaveLength(3)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('a failing series keeps the KPI tiles and offers a retry', async () => {
    rpc.mockImplementation(async (name: string) => (name === 'get_metrics_series' ? rpcError('E-99') : ok(metrics())))
    renderPage()
    expect(await screen.findByText('1,234')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Reintentar gráficas' })).toBeInTheDocument()
  })

  it('E-16 asks for the PIN and retries', async () => {
    rpc.mockImplementation(async (name: string) => (name === 'unlock_admin' ? unlockOk : name === 'get_metrics_series' ? ok(series()) : rpc.mock.calls.filter(([n]) => n === 'get_metrics').length === 1 ? rpcError('E-16') : ok(metrics())))
    renderPage()
    await enterPin()
    expect(await screen.findByText('1,234')).toBeInTheDocument()
  })

  it('E-16 on both metrics and series shares one PIN dialog and loads both', async () => {
    const lapsed = new Set(['get_metrics', 'get_metrics_series'])
    rpc.mockImplementation(async (name: string) => {
      if (name === 'unlock_admin') return unlockOk
      if (lapsed.delete(name)) return rpcError('E-16')
      return name === 'get_metrics_series' ? ok(series()) : ok(metrics())
    })
    renderPage()
    await enterPin()
    expect(await screen.findByText('1,234')).toBeInTheDocument()
    expect(await screen.findByText('Cupones emitidos y canjeados')).toBeInTheDocument()
  })
})
