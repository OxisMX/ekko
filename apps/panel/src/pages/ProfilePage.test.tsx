import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { AdminLayout } from '../components/AdminLayout'
import type { MerchantSession } from '../lib/panelRoute'
import { ProfilePage } from './ProfilePage'

const { rpc, upload, createImageVariants } = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), createImageVariants: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc, storage: { from: () => ({ upload }) } } }))
vi.mock('../lib/imageVariants', async (orig) => ({ ...(await orig<typeof import('../lib/imageVariants')>()), createImageVariants }))

const profile = {
  name: 'Café Ekko Centro',
  category: 'cafeterias_postres',
  description: 'El mejor café del centro',
  maps_url: 'https://maps.example/ekko',
  reviews_url: 'https://g.page/ekko/review',
  logo_path: 'merchants/m1/brand/logo',
  cover_path: 'merchants/m1/brand/cover',
}
const rpcError = (message: string) => ({ data: null, error: { message, details: null, code: 'P0001' } })
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
    [{ element: <Gate />, children: [{ path: '/admin', element: <AdminLayout />, children: [{ path: 'perfil', element: <ProfilePage /> }] }] }],
    { initialEntries: ['/admin/perfil'] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={auth}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  )
}

const loaded = () => screen.findByLabelText('Nombre comercial')
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

beforeEach(() => {
  rpc.mockReset()
  upload.mockReset()
  createImageVariants.mockReset()
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  rpc.mockResolvedValueOnce({ data: profile, error: null })
})

describe('Perfil del negocio', () => {
  it('shows a loading state, then the loaded profile with Guardar disabled', async () => {
    renderPage()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando el perfil')
    expect(await loaded()).toHaveValue('Café Ekko Centro')
    expect(screen.getByLabelText('Categoría')).toHaveValue('cafeterias_postres')
    expect(screen.getByLabelText('Descripción breve')).toHaveValue('El mejor café del centro')
    expect(screen.getByLabelText('Enlace a Google Maps')).toHaveValue('https://maps.example/ekko')
    expect(screen.getByRole('img', { name: 'Logo del negocio' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  it('previews how customers see the business and live-updates the name (P-42)', async () => {
    renderPage()
    fireEvent.change(await loaded(), { target: { value: 'Nuevo nombre' } })
    const preview = within(screen.getByRole('region', { name: 'Así te ven tus clientes' }))
    expect(preview.getByText('Nuevo nombre')).toBeInTheDocument()
    expect(preview.getByText('Cafeterías y Postres')).toBeInTheDocument()
  })

  it('shows the error and retries', async () => {
    rpc.mockReset()
    rpc.mockResolvedValueOnce(rpcError('E-99')).mockResolvedValueOnce({ data: profile, error: null })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await loaded()).toBeInTheDocument()
  })

  it('validates limits, the counter and https links, blocking save', async () => {
    renderPage()
    fireEvent.change(await loaded(), { target: { value: 'x'.repeat(41) } })
    expect(screen.getByText('41/40')).toBeInTheDocument()
    expect(screen.getByText('Máximo 40 caracteres.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Nombre comercial'), { target: { value: 'Ekko' } })
    fireEvent.change(screen.getByLabelText('Enlace a Google Maps'), { target: { value: 'http://maps.example' } })
    expect(screen.getByText('El enlace debe empezar con https://')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  it('saves via update_merchant_profile and shows success', async () => {
    renderPage()
    fireEvent.change(await loaded(), { target: { value: 'Ekko Café' } })
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'restaurantes' } })
    save()
    rpc.mockResolvedValueOnce({ data: { ...profile, name: 'Ekko Café', category: 'restaurantes' }, error: null })
    await screen.findByText(/Perfil guardado/)
    expect(rpc).toHaveBeenLastCalledWith('update_merchant_profile', {
      p_name: 'Ekko Café',
      p_category: 'restaurantes',
      p_description: 'El mejor café del centro',
      p_maps_url: 'https://maps.example/ekko',
      p_reviews_url: 'https://g.page/ekko/review',
      p_logo_path: 'merchants/m1/brand/logo',
      p_cover_path: 'merchants/m1/brand/cover',
    })
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  it('uploads a new logo under merchants/{id}/brand/ and saves its base path', async () => {
    createImageVariants.mockResolvedValue([
      { width: 128, blob: new Blob(['a'], { type: 'image/webp' }), format: 'webp' },
      { width: 256, blob: new Blob(['b'], { type: 'image/webp' }), format: 'webp' },
    ])
    upload.mockResolvedValue({ error: null })
    renderPage()
    await loaded()
    fireEvent.change(screen.getByLabelText('Elegir logo'), { target: { files: [new File(['x'], 'l.png', { type: 'image/png' })] } })
    await waitFor(() => expect(screen.getByRole('img', { name: 'Logo del negocio' })).toHaveAttribute('src', 'blob:preview'))
    const paths = upload.mock.calls.map(([p]) => p as string)
    expect(paths[0]).toMatch(/^merchants\/m1\/brand\/[0-9a-f-]{36}_128\.webp$/)
    expect(createImageVariants).toHaveBeenCalledWith(expect.any(File), 'logo')
    save()
    rpc.mockResolvedValueOnce({ data: profile, error: null })
    await waitFor(() =>
      expect(rpc).toHaveBeenLastCalledWith('update_merchant_profile', expect.objectContaining({ p_logo_path: paths[0].replace('_128.webp', '') })),
    )
  })

  it('shows the E-22 message when the cover cannot be processed', async () => {
    const { ImageProcessingError } = await import('../lib/imageVariants')
    createImageVariants.mockRejectedValue(new ImageProcessingError('NOT_AN_IMAGE', 'x'))
    renderPage()
    await loaded()
    fireEvent.change(screen.getByLabelText('Elegir portada'), { target: { files: [new File(['x'], 'c.txt')] } })
    expect(await screen.findByText('Ese archivo no es una imagen. Elige un JPG, PNG o WebP.')).toBeInTheDocument()
    expect(upload).not.toHaveBeenCalled()
  })

  it('lists every category as an option', async () => {
    renderPage()
    await loaded()
    expect(within(screen.getByLabelText('Categoría')).getAllByRole('option')).toHaveLength(9)
  })

  it('maps a server failure to its message', async () => {
    renderPage()
    fireEvent.change(await loaded(), { target: { value: 'Otro' } })
    rpc.mockResolvedValueOnce(rpcError('E-99'))
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent(/.+/)
  })
})
