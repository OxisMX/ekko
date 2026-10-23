import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { AdminLayout } from '../components/AdminLayout'
import type { MerchantSession } from '../lib/panelRoute'
import { CardConfigPage } from './CardConfigPage'

const { rpc, upload, createImageVariants } = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), createImageVariants: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc, storage: { from: () => ({ upload }) } } }))
vi.mock('../lib/imageVariants', async (orig) => ({ ...(await orig<typeof import('../lib/imageVariants')>()), createImageVariants }))

const rpcError = (message: string, details: object | null = null) => ({
  data: null,
  error: { message, details: details && JSON.stringify(details), code: 'P0001' },
})
const config = {
  stamps_required: 6,
  cycle_months: 6,
  reward_title: 'Café gratis',
  reward_description: 'Un café americano',
  terms: null,
  card_background_path: null,
  stamp_image_path: null,
  push_coupon_validity_hours: 24,
}
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
    [{ element: <Gate />, children: [{ path: '/admin', element: <AdminLayout />, children: [{ path: 'tarjeta', element: <CardConfigPage /> }] }] }],
    { initialEntries: ['/admin/tarjeta'] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={auth}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  )
}

const loaded = () => screen.findByLabelText('Título del premio')
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

beforeEach(() => {
  rpc.mockReset()
  upload.mockReset()
  createImageVariants.mockReset()
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  rpc.mockResolvedValueOnce({ data: config, error: null })
})

describe('P-06 card config', () => {
  it('loads the config, previews the stamps and keeps Guardar disabled until something changes', async () => {
    renderPage()
    expect(await loaded()).toHaveValue('Café gratis')
    expect(screen.getByLabelText('Descripción del premio')).toHaveValue('Un café americano')
    expect(screen.getByText('6 sellos')).toBeInTheDocument()
    expect(screen.getByTestId('card-preview').querySelectorAll('span.rounded-full')).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  it('stepper changes the preview and respects the 4–10 bounds', async () => {
    renderPage()
    await loaded()
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('button', { name: 'Más sellos' }))
    expect(screen.getByText('10 sellos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Más sellos' })).toBeDisabled()
    expect(screen.getByTestId('card-preview').querySelectorAll('span.rounded-full')).toHaveLength(10)
  })

  it('validates limits with counters and blocks saving', async () => {
    renderPage()
    fireEvent.change(await loaded(), { target: { value: 'x'.repeat(61) } })
    expect(screen.getByText('61/60')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Máximo 60 caracteres.')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Título del premio'), { target: { value: '  ' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el título del premio.')
  })

  it('asks for confirmation (RN-29), then saves via update_card_config and shows success', async () => {
    renderPage()
    fireEvent.change(await loaded(), { target: { value: 'Postre gratis' } })
    save()
    expect(screen.getByRole('dialog')).toHaveTextContent('Los cambios aplicarán a las tarjetas nuevas')
    expect(rpc).toHaveBeenCalledTimes(1)
    rpc.mockResolvedValueOnce({ data: { ...config, reward_title: 'Postre gratis' }, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText(/Cambios guardados/)).toBeInTheDocument()
    expect(rpc).toHaveBeenLastCalledWith('update_card_config', {
      p_stamps_required: 6,
      p_cycle_months: 6,
      p_reward_title: 'Postre gratis',
      p_reward_description: 'Un café americano',
      p_terms: '',
      p_card_background_path: null,
      p_push_coupon_validity_hours: 24,
      p_stamp_image_path: null,
    })
    expect(screen.queryByRole('dialog', { name: '¿Guardar los cambios?' })).not.toBeInTheDocument()
  })

  it('cancel in the confirmation does not call the backend', async () => {
    renderPage()
    fireEvent.change(await loaded(), { target: { value: 'Otro' } })
    save()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Título del premio')).toHaveValue('Otro')
  })

  it('maps E-23 details.field to that field', async () => {
    renderPage()
    fireEvent.change(await loaded(), { target: { value: 'Nuevo' } })
    save()
    rpc.mockResolvedValueOnce(rpcError('E-23', { field: 'reward_title' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Revisa los datos marcados.'))
    expect(screen.getByLabelText('Título del premio')).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(screen.getByLabelText('Título del premio'), { target: { value: 'Otro' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('E-16 opens the PIN keeping the form and retries the save once unlocked', async () => {
    renderPage()
    fireEvent.change(await loaded(), { target: { value: 'Nuevo' } })
    save()
    rpc.mockResolvedValueOnce(rpcError('E-16'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await screen.findByText('Ingresa tu PIN')
    expect(screen.getByLabelText('Título del premio')).toHaveValue('Nuevo')
    rpc.mockResolvedValueOnce({ data: { ok: true, admin_unlocked_until: new Date(Date.now() + 600_000).toISOString() }, error: null })
    rpc.mockResolvedValueOnce({ data: { ...config, reward_title: 'Nuevo' }, error: null })
    for (const d of '1234') fireEvent.click(screen.getByRole('button', { name: d }))
    expect(await screen.findByText(/Cambios guardados/)).toBeInTheDocument()
    expect(rpc).toHaveBeenLastCalledWith('update_card_config', expect.objectContaining({ p_reward_title: 'Nuevo' }))
  })

  it('uploads the variants under merchants/{id}/card/{uuid}_{width}, previews, and saves the base path', async () => {
    createImageVariants.mockResolvedValue([
      { width: 540, blob: new Blob(['a'], { type: 'image/webp' }), format: 'webp' },
      { width: 1080, blob: new Blob(['b'], { type: 'image/webp' }), format: 'webp' },
    ])
    upload.mockResolvedValue({ error: null })
    renderPage()
    await loaded()
    fireEvent.change(screen.getByLabelText('Elegir imagen de fondo'), { target: { files: [new File(['x'], 'f.png', { type: 'image/png' })] } })
    await screen.findByRole('button', { name: 'Quitar imagen' })
    const paths = upload.mock.calls.map(([p]) => p as string)
    expect(paths[0]).toMatch(/^merchants\/m1\/card\/[0-9a-f-]{36}_540\.webp$/)
    expect(paths[1]).toMatch(/_1080\.webp$/)
    expect(screen.getByTestId('card-preview')).toHaveStyle({ backgroundImage: 'url("blob:preview")' })

    save()
    rpc.mockResolvedValueOnce({ data: config, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(rpc).toHaveBeenLastCalledWith(
        'update_card_config',
        expect.objectContaining({ p_card_background_path: paths[0].replace('_540.webp', '') }),
      ),
    )
  })

  it('shows the E-22 message when the image cannot be processed', async () => {
    const { ImageProcessingError } = await import('../lib/imageVariants')
    createImageVariants.mockRejectedValue(new ImageProcessingError('SOURCE_TOO_LARGE', 'x'))
    renderPage()
    await loaded()
    fireEvent.change(screen.getByLabelText('Elegir imagen de fondo'), { target: { files: [new File(['x'], 'f.png')] } })
    expect(await screen.findByText('La imagen supera 10 MB. Elige una más ligera.')).toBeInTheDocument()
    expect(upload).not.toHaveBeenCalled()
  })

  it('"Quitar imagen" saves null', async () => {
    rpc.mockReset()
    rpc.mockResolvedValueOnce({ data: { ...config, card_background_path: 'merchants/m1/card/abc' }, error: null })
    renderPage()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar imagen' }))
    expect(screen.queryByRole('button', { name: 'Quitar imagen' })).not.toBeInTheDocument()
    save()
    rpc.mockResolvedValueOnce({ data: config, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(rpc).toHaveBeenLastCalledWith('update_card_config', expect.objectContaining({ p_card_background_path: null })))
  })

  it('offers the push coupon validity as a select 48/36/24/12/6 h and saves the choice', async () => {
    renderPage()
    await loaded()
    const select = screen.getByLabelText('Vigencia de cupones push')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['48 h', '36 h', '24 h', '12 h', '6 h'])
    expect(select).toHaveValue('24')
    fireEvent.change(select, { target: { value: '12' } })
    save()
    rpc.mockResolvedValueOnce({ data: { ...config, push_coupon_validity_hours: 12 }, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(rpc).toHaveBeenLastCalledWith('update_card_config', expect.objectContaining({ p_push_coupon_validity_hours: 12 })))
  })

  it('uploads a custom stamp image under merchants/{id}/card/, previews it and saves its path', async () => {
    createImageVariants.mockResolvedValue([
      { width: 128, blob: new Blob(['a'], { type: 'image/webp' }), format: 'webp' },
      { width: 256, blob: new Blob(['b'], { type: 'image/webp' }), format: 'webp' },
    ])
    upload.mockResolvedValue({ error: null })
    renderPage()
    await loaded()
    expect(screen.queryByRole('button', { name: 'Usar logo del negocio' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Elegir imagen del sello'), { target: { files: [new File(['x'], 's.png', { type: 'image/png' })] } })
    await screen.findByRole('button', { name: 'Usar logo del negocio' })
    const paths = upload.mock.calls.map(([p]) => p as string)
    expect(paths[0]).toMatch(/^merchants\/m1\/card\/[0-9a-f-]{36}_128\.webp$/)
    expect(screen.getByTestId('card-preview').querySelector('img')).toHaveAttribute('src', 'blob:preview')
    save()
    rpc.mockResolvedValueOnce({ data: config, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(rpc).toHaveBeenLastCalledWith('update_card_config', expect.objectContaining({ p_stamp_image_path: paths[0].replace('_128.webp', '') })),
    )
  })

  it('"Usar logo del negocio" saves a null stamp image', async () => {
    rpc.mockReset()
    rpc.mockResolvedValueOnce({ data: { ...config, stamp_image_path: 'merchants/m1/card/stamp' }, error: null })
    renderPage()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Usar logo del negocio' }))
    save()
    rpc.mockResolvedValueOnce({ data: config, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(rpc).toHaveBeenLastCalledWith('update_card_config', expect.objectContaining({ p_stamp_image_path: null })))
  })
})
