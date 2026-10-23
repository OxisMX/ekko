import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { AdminLayout } from '../components/AdminLayout'
import type { MerchantSession } from '../lib/panelRoute'
import { QrLogPage } from './QrLogPage'

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
    [{ element: <Gate />, children: [{ path: '/admin', element: <AdminLayout />, children: [{ path: 'qr', element: <QrLogPage /> }, { path: 'notificaciones', element: <p>Push</p> }] }] }],
    { initialEntries: ['/admin/qr'] },
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

const entry = (i: number, status = 'pending', used_at: string | null = null) => ({
  created_at: new Date(Date.UTC(2026, 9, 20, 12, 0, 0) - i * 60_000).toISOString(),
  expires_at: new Date(Date.UTC(2026, 9, 20, 12, 1, 0) - i * 60_000).toISOString(),
  used_at,
  status,
})

describe('P-11 registro de QR', () => {
  it('lists entries with a text label per status and the used time', async () => {
    rpc.mockResolvedValue(ok([entry(0, 'pending'), entry(1, 'used', '2026-10-20T11:59:30Z'), entry(2, 'invalidated'), entry(3, 'expired')]))
    renderPage()
    expect(await screen.findByText('Vigente')).toBeInTheDocument()
    for (const label of ['Usado', 'Reemplazado', 'Expirado']) expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getAllByText('Usado a las')).toHaveLength(1)
    expect(rpc).toHaveBeenCalledWith('list_qr_log', { p_offset: 0, p_limit: 20 })
  })

  it('shows the empty state', async () => {
    rpc.mockResolvedValue(ok([]))
    renderPage()
    expect(await screen.findByText('Aún no generas códigos QR. Genera uno desde Modo Caja.')).toBeInTheDocument()
  })

  it('loads more while pages are full and stops on a short page', async () => {
    const full = Array.from({ length: 20 }, (_, i) => entry(i))
    rpc.mockResolvedValueOnce(ok(full)).mockResolvedValueOnce(ok([entry(20)]))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }))
    await vi.waitFor(() => expect(screen.getAllByText('Vigente')).toHaveLength(21))
    expect(rpc).toHaveBeenLastCalledWith('list_qr_log', { p_offset: 20, p_limit: 20 })
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument()
  })

  it('shows a skeleton while loading', async () => {
    rpc.mockImplementation((n: string) => (n === 'list_qr_log' ? new Promise(() => undefined) : Promise.resolve(ok({}))))
    renderPage()
    expect(await screen.findByRole('status', { name: 'Cargando el registro' })).toBeInTheDocument()
  })

  it('shows the error and retries', async () => {
    rpc.mockResolvedValueOnce(rpcError('E-99')).mockResolvedValue(ok([entry(0)]))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Vigente')).toBeInTheDocument()
  })

  it('E-16 asks for the PIN and retries', async () => {
    rpc.mockImplementation(async (name: string) => (name === 'unlock_admin' ? unlockOk : rpc.mock.calls.filter(([n]) => n === 'list_qr_log').length === 1 ? rpcError('E-16') : ok([entry(0)])))
    renderPage()
    await enterPin()
    expect(await screen.findByText('Vigente')).toBeInTheDocument()
  })
})
