import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { AdminLayout } from '../components/AdminLayout'
import type { MerchantSession } from '../lib/panelRoute'
import { MenuPage } from './MenuPage'
import { ProductFormPage } from './ProductFormPage'

const { rpc, upload, createImageVariants } = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), createImageVariants: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc, storage: { from: () => ({ upload }) } } }))
vi.mock('../lib/imageVariants', async (orig) => ({ ...(await orig<typeof import('../lib/imageVariants')>()), createImageVariants }))

const rpcError = (message: string, details: object | null = null) => ({
  data: null,
  error: { message, details: details && JSON.stringify(details), code: 'P0001' },
})
const ok = (data: unknown = {}) => ({ data, error: null })
const product = { id: 'p1', category_id: 'c1', name: 'Latte', description: 'Con leche de avena', price: 1234.5, image_path: null, is_featured: false, is_sold_out: false, position: 1 }
const menu = { categories: [{ id: 'c1', name: 'Bebidas', position: 1, products: [product] }, { id: 'c2', name: 'Postres', position: 2, products: [] }] }

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
          { path: 'menu', element: <MenuPage /> },
          { path: 'menu/nuevo', element: <ProductFormPage /> },
          { path: 'menu/:productId', element: <ProductFormPage /> },
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

// Routes each RPC by name; `overrides` replaces the default answer for one test.
function mockRpc(overrides: Record<string, unknown> = {}) {
  rpc.mockImplementation(async (name: string) => (name in overrides ? overrides[name] : name === 'list_menu_admin' ? ok(menu) : ok()))
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

describe('P-07 menu list', () => {
  it('shows a skeleton while loading', () => {
    rpc.mockImplementation(() => new Promise(() => undefined))
    renderAt('/admin/menu')
    expect(screen.getByRole('status', { name: 'Cargando el menú' })).toBeInTheDocument()
  })

  it('renders categories with products, MXN price and switches', async () => {
    renderAt('/admin/menu')
    expect(await screen.findByText('Latte')).toBeInTheDocument()
    expect(screen.getByText('$1,234.50')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Agotado por hoy: Latte' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('link', { name: 'Nuevo producto' })).toBeInTheDocument()
  })

  it('empty state guides to the first category and disables Nuevo producto', async () => {
    mockRpc({ list_menu_admin: ok({ categories: null }) })
    renderAt('/admin/menu')
    expect(await screen.findByText('Aún no tienes un menú')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo producto' })).toBeDisabled()
  })

  it('error state offers Reintentar', async () => {
    mockRpc({ list_menu_admin: rpcError('E-01') })
    renderAt('/admin/menu')
    mockRpc()
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Latte')).toBeInTheDocument()
  })

  it('toggle calls set_product_flags with both flags and updates optimistically', async () => {
    renderAt('/admin/menu')
    fireEvent.click(await screen.findByRole('switch', { name: 'Agotado por hoy: Latte' }))
    expect(screen.getByRole('switch', { name: 'Agotado por hoy: Latte' })).toHaveAttribute('aria-checked', 'true')
    await waitFor(() => expect(callsTo('set_product_flags')).toEqual([{ p_id: 'p1', p_sold_out_today: true, p_is_featured: false }]))
  })

  it('rolls the toggle back and shows an error when the RPC fails', async () => {
    renderAt('/admin/menu')
    const toggle = await screen.findByRole('switch', { name: 'Más pedidos: Latte' })
    mockRpc({ set_product_flags: rpcError('E-01') })
    fireEvent.click(toggle)
    await screen.findByRole('alert')
    expect(screen.getByRole('switch', { name: 'Más pedidos: Latte' })).toHaveAttribute('aria-checked', 'false')
  })

  it('adds a category and validates the name', async () => {
    renderAt('/admin/menu')
    await screen.findByText('Latte')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar categoría' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el nombre.')
    fireEvent.change(screen.getByLabelText('Nueva categoría'), { target: { value: ' Panes ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar categoría' }))
    await waitFor(() => expect(callsTo('upsert_menu_category')).toEqual([{ p_id: undefined, p_name: 'Panes', p_position: undefined }]))
  })

  it('moving a category down swaps both positions', async () => {
    renderAt('/admin/menu')
    fireEvent.click(await screen.findByRole('button', { name: 'Bajar categoría Bebidas' }))
    await waitFor(() => expect(callsTo('upsert_menu_category')).toHaveLength(2))
    expect(callsTo('upsert_menu_category')).toEqual([
      { p_id: 'c1', p_name: 'Bebidas', p_position: 2 },
      { p_id: 'c2', p_name: 'Postres', p_position: 1 },
    ])
  })

  it('deleting a non-empty category shows the category_not_empty message', async () => {
    renderAt('/admin/menu')
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar categoría Bebidas' }))
    mockRpc({ delete_menu_category: rpcError('E-23', { field: 'category_not_empty' }) })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }))
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Mueve o elimina sus productos primero.')
  })

  it('deleting a product asks for confirmation then calls delete_product', async () => {
    renderAt('/admin/menu')
    fireEvent.click(await screen.findByRole('button', { name: 'Más acciones de Latte' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Latte' }))
    expect(callsTo('delete_product')).toHaveLength(0)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(callsTo('delete_product')).toEqual([{ p_id: 'p1' }]))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('P-32..P-34 product rows', () => {
  it('shows an "Agotado" text badge only for sold-out products', async () => {
    mockRpc({ list_menu_admin: ok({ categories: [{ ...menu.categories[0], products: [{ ...product, is_sold_out: true }] }] }) })
    renderAt('/admin/menu')
    expect(await screen.findByText('Agotado')).toBeInTheDocument()
  })

  it('"Más" is a disclosure menu: expanded state, Escape closes and returns focus', async () => {
    renderAt('/admin/menu')
    const more = await screen.findByRole('button', { name: 'Más acciones de Latte' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Subir Latte' })).not.toBeInTheDocument()
    fireEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    for (const name of ['Subir Latte', 'Bajar Latte', 'Eliminar Latte']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Bajar Latte' }), { key: 'Escape' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    expect(more).toHaveFocus()
  })

  it('per-category "Agregar producto" preselects that category in the form', async () => {
    renderAt('/admin/menu')
    const link = await screen.findByRole('link', { name: 'Agregar producto en Postres' })
    expect(link).toHaveAttribute('href', '/admin/menu/nuevo?categoria=c2')
    fireEvent.click(link)
    expect(await screen.findByLabelText('Categoría')).toHaveValue('c2')
  })
})

describe('P-08 product form', () => {
  const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
  const variants = [
    { width: 360, blob: new Blob(['a'], { type: 'image/webp' }), format: 'webp' },
    { width: 720, blob: new Blob(['b'], { type: 'image/webp' }), format: 'webp' },
  ]
  const pickImage = () => fireEvent.change(screen.getByLabelText('Elegir imagen del producto'), { target: { files: [new File(['x'], 'f.png', { type: 'image/png' })] } })

  it('validates name and price before calling the backend', async () => {
    renderAt('/admin/menu/nuevo')
    await screen.findByLabelText('Nombre')
    fill('Nombre', 'x'.repeat(61))
    fill('Precio (MXN)', '12.345')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))
    expect(screen.getByText('61/60')).toBeInTheDocument()
    expect(screen.getByText('Máximo 60 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('Escribe un precio válido, con máximo 2 decimales.')).toBeInTheDocument()
    expect(callsTo('upsert_product')).toHaveLength(0)
  })

  it('creates a product and returns to the list with a confirmation', async () => {
    renderAt('/admin/menu/nuevo')
    await screen.findByLabelText('Nombre')
    fill('Nombre', ' Capuchino ')
    fill('Precio (MXN)', '45,5')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))
    expect(await screen.findByText('Producto creado.')).toBeInTheDocument()
    expect(callsTo('upsert_product')).toEqual([
      { p_id: undefined, p_category_id: 'c1', p_name: 'Capuchino', p_description: '', p_price: 45.5, p_image_path: null },
    ])
  })

  it('maps E-23 details.field to that field', async () => {
    renderAt('/admin/menu/nuevo')
    await screen.findByLabelText('Nombre')
    fill('Nombre', 'Capuchino')
    fill('Precio (MXN)', '10')
    mockRpc({ upsert_product: rpcError('E-23', { field: 'name' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))
    await waitFor(() => expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa los datos marcados.')
  })

  it('edit prefills the product', async () => {
    renderAt('/admin/menu/p1')
    expect(await screen.findByLabelText('Nombre')).toHaveValue('Latte')
    expect(screen.getByLabelText('Precio (MXN)')).toHaveValue('1234.5')
  })

  it('uploads variants under merchants/{id}/product/{uuid} and saves the base path', async () => {
    createImageVariants.mockResolvedValue(variants)
    upload.mockResolvedValue({ error: null })
    renderAt('/admin/menu/nuevo')
    await screen.findByLabelText('Nombre')
    fill('Nombre', 'Capuchino')
    fill('Precio (MXN)', '10')
    pickImage()
    await screen.findByAltText('Vista previa del producto')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))
    await screen.findByText('Producto creado.')
    const paths = upload.mock.calls.map(([p]) => p as string)
    expect(paths[0]).toMatch(/^merchants\/m1\/product\/[0-9a-f-]{36}_360\.webp$/)
    expect(paths[1]).toMatch(/_720\.webp$/)
    expect(callsTo('upsert_product')[0]).toMatchObject({ p_image_path: paths[0].replace('_360.webp', '') })
  })

  it('upload failure offers Reintentar and Guardar sin imagen', async () => {
    createImageVariants.mockResolvedValue(variants)
    upload.mockResolvedValue({ error: { message: 'boom', statusCode: '500' } })
    renderAt('/admin/menu/nuevo')
    await screen.findByLabelText('Nombre')
    fill('Nombre', 'Capuchino')
    fill('Precio (MXN)', '10')
    pickImage()
    await screen.findByAltText('Vista previa del producto')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(callsTo('upsert_product')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sin imagen' }))
    await screen.findByText('Producto creado.')
    expect(callsTo('upsert_product')[0]).toMatchObject({ p_image_path: null })
  })

  it('shows the processing error without offering to save', async () => {
    const { ImageProcessingError } = await import('../lib/imageVariants')
    createImageVariants.mockRejectedValue(new ImageProcessingError('SOURCE_TOO_LARGE', 'x'))
    renderAt('/admin/menu/nuevo')
    await screen.findByLabelText('Nombre')
    pickImage()
    expect(await screen.findByText('La imagen supera 10 MB. Elige una más ligera.')).toBeInTheDocument()
    expect(upload).not.toHaveBeenCalled()
  })
})
