import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { MerchantSession } from '../lib/panelRoute'
import { AdminLayout, AdminPlaceholderPage } from './AdminLayout'
import { ADMIN_SECTIONS } from './adminSections'

vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }) } }))

function renderAdmin(path: string, adminUnlockedUntil: string | null) {
  const merchantSession: MerchantSession = {
    merchant: { id: 'm1', name: 'Café Ekko Centro', logo_path: null },
    is_active: true,
    admin_unlocked_until: adminUnlockedUntil,
    pin_locked_until: null,
    validator_locked_until: null,
  }
  const router = createMemoryRouter(
    [
      {
        // Stands in for PanelGate, which provides the outlet context.
        element: <Outlet context={{ merchantSession }} />,
        children: [
          { path: '/', element: <p>Modo Caja</p> },
          {
            path: '/admin',
            element: <AdminLayout />,
            children: ADMIN_SECTIONS.map((section) => ({ path: section.path, element: <AdminPlaceholderPage section={section} /> })),
          },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

const inFiveMinutes = () => new Date(Date.now() + 5 * 60_000).toISOString()

describe('AdminLayout', () => {
  it('lists the seven sections and marks the current one with aria-current', () => {
    renderAdmin('/admin/menu', inFiveMinutes())
    const nav = screen.getByRole('navigation', { name: 'Secciones administrativas' })
    const links = Array.from(nav.querySelectorAll('a'))
    expect(links.map((a) => a.textContent)).toEqual([
      'Métricas',
      'Configuración de tarjeta',
      'Menú',
      'Ofertas',
      'Notificaciones',
      'Perfil del negocio',
      'Registro de QR',
    ])
    expect(screen.getByRole('link', { name: 'Menú' })).toHaveAttribute('aria-current', 'page')
    expect(links.filter((a) => a.hasAttribute('aria-current'))).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Menú' })).toBeInTheDocument()
    expect(screen.getByText('Disponible próximamente')).toBeInTheDocument()
  })

  it('shows the unlocked indicator and a way back to Modo Caja (RT-12)', () => {
    renderAdmin('/admin/metricas', inFiveMinutes())
    expect(screen.getByText('Sección administrativa desbloqueada')).toBeInTheDocument()
    expect(screen.getByText(/Tiempo restante/)).toHaveTextContent(/[45]:\d\d/)
    expect(screen.getByRole('link', { name: 'Volver a Modo Caja' })).toHaveAttribute('href', '/')
  })

  it('redirects to Modo Caja while admin is locked', async () => {
    renderAdmin('/admin/menu', null)
    expect(await screen.findByText('Modo Caja')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
