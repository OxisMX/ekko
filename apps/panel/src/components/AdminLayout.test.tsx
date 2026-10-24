import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import type { MerchantSession } from '../lib/panelRoute'
import { supabase } from '../lib/supabase'
import { AdminLayout } from './AdminLayout'
import { ADMIN_SECTIONS } from './adminSections'
import { PanelShell } from './PanelShell'

vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }) } }))

const signOut = vi.fn<AuthState['signOut']>()

function renderAdmin(path: string, adminUnlockedUntil: string | null, failedPinAttempts?: number) {
  const initialSession: MerchantSession = {
    merchant: { id: 'm1', name: 'Café Ekko Centro', logo_path: null },
    is_active: true,
    admin_unlocked_until: adminUnlockedUntil,
    pin_locked_until: null,
    validator_locked_until: null,
    failed_pin_attempts: failedPinAttempts,
  }
  const queryClient = new QueryClient()
  queryClient.setQueryData(['merchant-session', 'u1'], initialSession)
  // Stands in for PanelGate: the outlet context follows the query cache, so patches show up.
  function Gate() {
    const { data } = useQuery({ queryKey: ['merchant-session', 'u1'], queryFn: () => initialSession, staleTime: Infinity })
    return data ? <Outlet context={{ merchantSession: data }} /> : null
  }
  const router = createMemoryRouter(
    [
      {
        element: <Gate />,
        children: [
          { path: '/', element: <PanelShell showAdmin>Caja</PanelShell> },
          {
            path: '/admin',
            element: <AdminLayout />,
            children: ADMIN_SECTIONS.map((section) => ({ path: section.path, element: <h1>{section.label}</h1> })),
          },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  const auth: AuthState = { session: undefined, authError: null, clearAuthError: vi.fn(), signOut }
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={auth}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  )
}

const inFiveMinutes = () => new Date(Date.now() + 5 * 60_000).toISOString()

describe('AdminLayout', () => {
  beforeEach(() => signOut.mockReset())

  it('groups the seven sections under Mi programa / Mi negocio / Reportes and marks the current one with aria-current (P-17)', () => {
    renderAdmin('/admin/menu', inFiveMinutes())
    const nav = screen.getByRole('navigation', { name: 'Secciones administrativas' })
    const links = Array.from(nav.querySelectorAll('a'))
    expect(links.map((a) => a.textContent)).toEqual(['Tarjeta', 'Menú', 'Ofertas', 'Notificaciones', 'Perfil del negocio', 'Métricas', 'Registro de QR'])
    const names = (group: string) => within(screen.getByRole('list', { name: group })).getAllByRole('link').map((a) => a.textContent)
    expect(names('Mi programa')).toEqual(['Tarjeta', 'Menú', 'Ofertas', 'Notificaciones'])
    expect(names('Mi negocio')).toEqual(['Perfil del negocio'])
    expect(names('Reportes')).toEqual(['Métricas', 'Registro de QR'])
    expect(screen.getByRole('link', { name: 'Menú' })).toHaveAttribute('aria-current', 'page')
    expect(links.filter((a) => a.hasAttribute('aria-current'))).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Menú' })).toBeInTheDocument()
  })

  it('shows a neutral countdown pill and one exit, "Bloquear y volver a Caja" (RT-12, P-15)', () => {
    renderAdmin('/admin/metricas', inFiveMinutes())
    expect(screen.getByText(/Se bloquea en/)).toHaveTextContent(/[45]:\d\d/)
    expect(screen.getByRole('button', { name: 'Bloquear y volver a Caja' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Volver a Modo Caja' })).not.toBeInTheDocument()
  })

  it('warns "Se bloqueará pronto" in the last minute (P-16)', () => {
    renderAdmin('/admin/metricas', new Date(Date.now() + 30_000).toISOString())
    expect(screen.getByText(/Se bloqueará pronto/)).toHaveTextContent(/0:[23]\d/)
  })

  it('logout moved here and asks first: Cancelar keeps the session, the dialog button signs out (P-14)', () => {
    renderAdmin('/admin/metricas', inFiveMinutes())
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    const dialog = screen.getByRole('dialog', { name: '¿Cerrar sesión?' })
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar sesión' }))
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('logout is also visible in Modo Caja, next to Administrar', async () => {
    renderAdmin('/', null)
    expect(await screen.findByRole('button', { name: 'Administrar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('"+5 min" calls extend_admin_session and moves the countdown to the new expiry', async () => {
    const rpc = vi.mocked(supabase.rpc)
    rpc.mockClear()
    rpc.mockResolvedValueOnce({ data: { expires_at: new Date(Date.now() + 9 * 60_000).toISOString() }, error: null } as never)
    renderAdmin('/admin/metricas', inFiveMinutes())
    fireEvent.click(screen.getByRole('button', { name: 'Extender sesión de administración 5 minutos' }))
    await waitFor(() => expect(screen.getByText(/Se bloquea en/)).toHaveTextContent(/[89]:\d\d/))
    expect(rpc).toHaveBeenCalledWith('extend_admin_session')
  })

  it('P-S1: warns about failed PIN attempts once, with a dismiss button', async () => {
    renderAdmin('/admin/metricas', inFiveMinutes(), 2)
    expect(screen.getByRole('status')).toHaveTextContent('Hubo 2 intentos fallidos de PIN desde la última vez que entraste')
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
    await waitFor(() => expect(screen.queryByText(/intentos fallidos de PIN/)).not.toBeInTheDocument())
  })

  it('shows no notice when there were no failed attempts', () => {
    renderAdmin('/admin/metricas', inFiveMinutes(), 0)
    expect(screen.queryByText(/intentos? fallidos? de PIN/)).not.toBeInTheDocument()
  })

  it('disables the extension once 10 minutes or more remain (server caps at 15)', () => {
    renderAdmin('/admin/metricas', new Date(Date.now() + 11 * 60_000).toISOString())
    expect(screen.getByRole('button', { name: 'Extender sesión de administración 5 minutos' })).toBeDisabled()
  })
})

describe('AdminLayout idle lock', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] }))
  afterEach(() => vi.useRealTimers())

  const idleFor = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

  it('locks after 5 idle minutes', () => {
    renderAdmin('/admin/metricas', new Date(Date.now() + 20 * 60_000).toISOString())
    idleFor(5 * 60_000 + 2000)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('does not lock before an extended server window ends', async () => {
    const rpc = vi.mocked(supabase.rpc)
    const until = new Date(Date.now() + 8 * 60_000).toISOString()
    rpc.mockResolvedValueOnce({ data: { expires_at: until }, error: null } as never)
    renderAdmin('/admin/metricas', inFiveMinutes())
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Extender sesión de administración 5 minutos' }))
    })
    await act(async () => void (await vi.advanceTimersByTimeAsync(1000))) // flush the rpc promise
    idleFor(6 * 60_000)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    idleFor(2 * 60_000 + 2000)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})

describe('AdminLayout lock', () => {
  it('redirects to Modo Caja while admin is locked', async () => {
    renderAdmin('/admin/menu', null)
    expect(await screen.findByText('Modo Caja')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
