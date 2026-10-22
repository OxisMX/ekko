import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { AdminLayout } from '../components/AdminLayout'
import type { MerchantSession } from '../lib/panelRoute'
import { OfferFormPage } from './OfferFormPage'
import { OffersPage } from './OffersPage'

const { rpc, upload, createImageVariants } = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), createImageVariants: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc, storage: { from: () => ({ upload }) } } }))
vi.mock('../lib/imageVariants', async (orig) => ({ ...(await orig<typeof import('../lib/imageVariants')>()), createImageVariants }))


const rpcError = (message: string, details: object | null = null) => ({
  data: null,
  error: { message, details: details && JSON.stringify(details), code: 'P0001' },
})
const ok = (data: unknown = {}) => ({ data, error: null })
const offer = { id: 'o1', title: '2x1 en lattes', description: 'Solo por la mañana', weekday: 3, image_path: 'merchants/m1/offer/abc', position: 1 }

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

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  queryClient.setQueryData(['merchant-session', 'u1'], session)
  const auth: AuthState = { session: undefined, authError: null, clearAuthError: vi.fn(), signOut: vi.fn() }
  const router = createMemoryRouter(
    [{
      element: <Gate />,
      children: [{
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { path: 'ofertas', element: <OffersPage /> },
          { path: 'ofertas/nueva', element: <OfferFormPage /> },
          { path: 'ofertas/:offerId', element: <OfferFormPage /> },
        ],
      }],
    }],
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


function mockRpc(overrides: Record<string, unknown> = {}) {
  rpc.mockImplementation(async (name: string) => (name in overrides ? overrides[name] : name === 'list_offers_admin' ? ok([offer]) : ok()))
}
const callsTo = (name: string) => rpc.mock.calls.filter(([n]) => n === name).map(([, args]) => args)

beforeEach(() => {
  rpc.mockReset()
  upload.mockReset()
  createImageVariants.mockReset()
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  mockRpc()
})

describe('P-09 offers list', () => {
  it('shows a skeleton while loading', () => {
    rpc.mockImplementation(() => new Promise(() => undefined))
    renderAt('/admin/ofertas')
    expect(screen.getByRole('status', { name: 'Cargando las ofertas' })).toBeInTheDocument()
  })

  it('groups offers by weekday and marks empty days', async () => {
    renderAt('/admin/ofertas')
    const wednesday = await screen.findByRole('region', { name: 'Miércoles' })
    expect(within(wednesday).getByText('2x1 en lattes')).toBeInTheDocument()
    expect(within(wednesday).getByRole('link', { name: 'Editar 2x1 en lattes' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Lunes' })).getByText('Sin oferta este día.')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Lunes' })).getByRole('link', { name: 'Agregar oferta del Lunes' })).toBeInTheDocument()
  })

  it('empty state guides to the first offer', async () => {
    mockRpc({ list_offers_admin: ok(null) })
    renderAt('/admin/ofertas')
    expect(await screen.findByText('Aún no tienes ofertas')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nueva oferta' })).toBeInTheDocument()
  })

  it('error state offers Reintentar', async () => {
    mockRpc({ list_offers_admin: rpcError('E-01') })
    renderAt('/admin/ofertas')
    mockRpc()
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('2x1 en lattes')).toBeInTheDocument()
  })

  it('falls back to a placeholder when the image fails to load', async () => {
    renderAt('/admin/ofertas')
    const img = (await screen.findByRole('region', { name: 'Miércoles' })).querySelector('img')!
    fireEvent.error(img)
    expect(screen.getByRole('region', { name: 'Miércoles' }).querySelector('img')).toBeNull()
  })

  it('deleting asks for confirmation then calls delete_offer', async () => {
    renderAt('/admin/ofertas')
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar 2x1 en lattes' }))
    expect(callsTo('delete_offer')).toHaveLength(0)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(callsTo('delete_offer')).toEqual([{ p_id: 'o1' }]))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows a delete failure inside the dialog', async () => {
    renderAt('/admin/ofertas')
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar 2x1 en lattes' }))
    mockRpc({ delete_offer: rpcError('E-01') })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }))
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toBeInTheDocument()
  })
})

describe('P-09 offer form', () => {
  const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
  const variants = [
    { width: 540, blob: new Blob(['a'], { type: 'image/webp' }), format: 'webp' },
    { width: 1080, blob: new Blob(['b'], { type: 'image/webp' }), format: 'webp' },
  ]
  const pickImage = () => fireEvent.change(screen.getByLabelText('Elegir imagen de la oferta'), { target: { files: [new File(['x'], 'f.png', { type: 'image/png' })] } })

  it('validates title and description before calling the backend', async () => {
    renderAt('/admin/ofertas/nueva')
    await screen.findByLabelText('Título')
    fill('Título', 'x'.repeat(61))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar oferta' }))
    expect(screen.getByText('61/60')).toBeInTheDocument()
    expect(screen.getByText('Máximo 60 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('Escribe la descripción de la oferta.')).toBeInTheDocument()
    expect(callsTo('upsert_offer')).toHaveLength(0)
  })

  it('creates an offer for the day from the query string and returns to the list', async () => {
    renderAt('/admin/ofertas/nueva?dia=5')
    await screen.findByLabelText('Título')
    fill('Título', ' Viernes de postre ')
    fill('Descripción', 'Pastel gratis')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar oferta' }))
    expect(await screen.findByText('Oferta creada.')).toBeInTheDocument()
    expect(callsTo('upsert_offer')).toEqual([{ p_id: undefined, p_title: 'Viernes de postre', p_description: 'Pastel gratis', p_weekday: 5, p_image_path: null }])
  })

  it('maps E-23 details.field to that field', async () => {
    renderAt('/admin/ofertas/nueva')
    await screen.findByLabelText('Título')
    fill('Título', 'Oferta')
    fill('Descripción', 'Detalle')
    mockRpc({ upsert_offer: rpcError('E-23', { field: 'title' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar oferta' }))
    await waitFor(() => expect(screen.getByLabelText('Título')).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa los datos marcados.')
  })

  it('edit prefills the offer', async () => {
    renderAt('/admin/ofertas/o1')
    expect(await screen.findByLabelText('Título')).toHaveValue('2x1 en lattes')
    expect(screen.getByLabelText('Día de la semana')).toHaveValue('3')
  })

  it('uploads variants under merchants/{id}/offer/{uuid} and saves the base path', async () => {
    createImageVariants.mockResolvedValue(variants)
    upload.mockResolvedValue({ error: null })
    renderAt('/admin/ofertas/nueva')
    await screen.findByLabelText('Título')
    fill('Título', 'Oferta')
    fill('Descripción', 'Detalle')
    pickImage()
    await screen.findByAltText('Vista previa de la oferta')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar oferta' }))
    await screen.findByText('Oferta creada.')
    const paths = upload.mock.calls.map(([p]) => p as string)
    expect(paths[0]).toMatch(/^merchants\/m1\/offer\/[0-9a-f-]{36}_540\.webp$/)
    expect(paths[1]).toMatch(/_1080\.webp$/)
    expect(callsTo('upsert_offer')[0]).toMatchObject({ p_image_path: paths[0].replace('_540.webp', '') })
  })

  it('upload failure offers Reintentar and Guardar sin imagen', async () => {
    createImageVariants.mockResolvedValue(variants)
    upload.mockResolvedValue({ error: { message: 'boom', statusCode: '500' } })
    renderAt('/admin/ofertas/nueva')
    await screen.findByLabelText('Título')
    fill('Título', 'Oferta')
    fill('Descripción', 'Detalle')
    pickImage()
    await screen.findByAltText('Vista previa de la oferta')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar oferta' }))
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(callsTo('upsert_offer')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sin imagen' }))
    await screen.findByText('Oferta creada.')
    expect(callsTo('upsert_offer')[0]).toMatchObject({ p_image_path: null })
  })

  it('shows the processing error without offering to save', async () => {
    const { ImageProcessingError } = await import('../lib/imageVariants')
    createImageVariants.mockRejectedValue(new ImageProcessingError('SOURCE_TOO_LARGE', 'x'))
    renderAt('/admin/ofertas/nueva')
    await screen.findByLabelText('Título')
    pickImage()
    expect(await screen.findByText('La imagen supera 10 MB. Elige una más ligera.')).toBeInTheDocument()
    expect(upload).not.toHaveBeenCalled()
  })
})
