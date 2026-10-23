import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { AdminLayout } from '../components/AdminLayout'
import type { MerchantSession } from '../lib/panelRoute'
import { PushPage } from './PushPage'

const { rpc, invoke } = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc, functions: { invoke } } }))


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
          { path: 'notificaciones', element: <PushPage /> },
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


const rpcError = (message: string, details: object | null = null) => ({
  data: null,
  error: { message, details: details && JSON.stringify(details), code: 'P0001' },
})
const ok = (data: unknown = {}) => ({ data, error: null })
const status = { remaining_this_month: 3, limit: 5, resets_on: '2026-11-01', recipients_count: 42, push_coupon_validity_hours: 36 }
const campaign = { id: 'k1', title: 'Hoy 2x1', has_coupon: true, status: 'sent', recipients_count: 40, sent_count: 38, failed_count: 2, created_at: '2026-10-05T18:30:00Z' }
const success = { campaign_id: 'k1', recipients: 42, sent: 40, failed: 2, push_remaining_this_month: 2 }
const httpError = (error: string, details?: object, status = 400) =>
  ({ data: null, error: new FunctionsHttpError(new Response(JSON.stringify({ error, details }), { status })) })

function mockRpc(overrides: Record<string, unknown> = {}) {
  const answers: Record<string, unknown> = { get_push_status: ok(status), list_push_campaigns: ok([campaign]), ...overrides }
  rpc.mockImplementation(async (name: string) => answers[name] ?? ok())
}

beforeEach(() => {
  rpc.mockReset()
  invoke.mockReset()
  mockRpc()
})

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const fillMessage = () => {
  fill('Título', 'Hoy 2x1')
  fill('Mensaje', 'Ven por tu café')
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Enviar notificación' }))
const confirmSend = () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Enviar ahora' }))

describe('P-10 push', () => {
  it('shows the quota header with the local reset date', async () => {
    renderAt('/admin/notificaciones')
    expect(await screen.findByText('Te quedan 3 de 5 envíos este mes')).toBeInTheDocument()
    expect(screen.getByText('Se reinicia el 1 de noviembre de 2026')).toBeInTheDocument()
  })

  it('disables the form with the reset date when no sends remain (E-17)', async () => {
    mockRpc({ get_push_status: ok({ ...status, remaining_this_month: 0 }) })
    renderAt('/admin/notificaciones')
    expect(await screen.findByText(/Usaste tus 5 envíos de este mes\./)).toHaveTextContent('1 de noviembre de 2026')
    expect(screen.getByLabelText('Título')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Enviar notificación' })).toBeDisabled()
  })

  it('error state offers Reintentar', async () => {
    mockRpc({ get_push_status: rpcError('E-01') })
    renderAt('/admin/notificaciones')
    mockRpc()
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Te quedan 3 de 5 envíos este mes')).toBeInTheDocument()
  })

  it('renders the history and its empty state', async () => {
    renderAt('/admin/notificaciones')
    const row = (await screen.findByText('Hoy 2x1', { selector: 'p' })).closest('li')!
    expect(within(row).getByText('Con cupón')).toBeInTheDocument()
    expect(row).toHaveTextContent('Enviada')
    expect(row).toHaveTextContent('38 entregadas, 2 fallidas de 40')
  })

  it('shows the empty history guidance', async () => {
    mockRpc({ list_push_campaigns: ok([]) })
    renderAt('/admin/notificaciones')
    expect(await screen.findByText(/Aún no has enviado notificaciones/)).toBeInTheDocument()
  })

  it('validates limits and live-previews title and body', async () => {
    renderAt('/admin/notificaciones')
    await screen.findByLabelText('Título')
    fill('Título', 'x'.repeat(51))
    fill('Mensaje', '')
    submit()
    expect(screen.getByText('51/50')).toBeInTheDocument()
    expect(screen.getByText('Máximo 50 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('Escribe el mensaje.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fill('Título', 'Hola')
    expect(within(screen.getByRole('group', { name: 'Vista previa' })).getByText('Hola')).toBeInTheDocument()
  })

  it('coupon toggle reveals its fields with the default validity and previews the coupon', async () => {
    renderAt('/admin/notificaciones')
    await screen.findByLabelText('Título')
    expect(screen.queryByLabelText('Beneficio')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: 'Adjuntar cupón' }))
    expect(screen.getByLabelText('Vigencia (horas)')).toHaveValue(36)
    fill('Beneficio', '2x1 en cafés')
    expect(within(screen.getByTestId('coupon-preview')).getByText('2x1 en cafés')).toBeInTheDocument()
    fillMessage()
    fill('Vigencia (horas)', '72')
    submit()
    expect(screen.getByText('Vigencia: entre 24 y 48 horas.')).toBeInTheDocument()
    expect(screen.getByText('Escribe las restricciones.')).toBeInTheDocument()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('confirms the audience and remaining quota, then reports the result and refreshes', async () => {
    invoke.mockResolvedValue(ok(success))
    renderAt('/admin/notificaciones')
    await screen.findByLabelText('Título')
    fillMessage()
    submit()
    expect(screen.getByRole('dialog')).toHaveTextContent('Se enviará a 42 clientes. Te quedarán 2 de 5.')
    expect(screen.getByRole('dialog')).not.toHaveTextContent('aunque tenga las notificaciones desactivadas')
    mockRpc({ get_push_status: ok({ ...status, remaining_this_month: 2 }) })
    confirmSend()
    expect(await screen.findByText('Enviada a 42 clientes: 40 entregadas, 2 fallidas.')).toBeInTheDocument()
    expect(invoke).toHaveBeenCalledWith('send-push', { body: { idempotency_key: expect.stringMatching(/^[0-9a-f-]{36}$/), title: 'Hoy 2x1', body: 'Ven por tu café' } })
    expect(await screen.findByText('Te quedan 2 de 5 envíos este mes')).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('')
  })

  it('warns about the coupon in the confirmation and sends it', async () => {
    invoke.mockResolvedValue(ok(success))
    renderAt('/admin/notificaciones')
    await screen.findByLabelText('Título')
    fillMessage()
    fireEvent.click(screen.getByRole('switch', { name: 'Adjuntar cupón' }))
    fill('Beneficio', '2x1')
    fill('Restricciones', 'Solo bebidas')
    fill('Términos', 'No acumulable')
    submit()
    expect(screen.getByRole('dialog')).toHaveTextContent('Cada cliente recibirá el cupón aunque tenga las notificaciones desactivadas.')
    confirmSend()
    await screen.findByText(/Enviada a 42 clientes/)
    expect(invoke.mock.calls[0][1].body.coupon).toEqual({ title: '2x1', description: 'Solo bebidas', terms: 'No acumulable', validity_hours: 36 })
  })

  it('network error shows the unknown state, refetches history, and retries with the same idempotency key', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError(new Error('offline')) }).mockResolvedValueOnce(ok(success))
    renderAt('/admin/notificaciones')
    await screen.findByLabelText('Título')
    fillMessage()
    submit()
    const historyCalls = callsTo('list_push_campaigns').length
    confirmSend()
    expect(await screen.findByText('No sabemos si se envió. Revisa el historial antes de reintentar.')).toBeInTheDocument()
    await waitFor(() => expect(callsTo('list_push_campaigns').length).toBeGreaterThan(historyCalls))
    submit()
    confirmSend()
    await screen.findByText(/Enviada a 42 clientes/)
    const [first, second] = invoke.mock.calls.map(([, opts]) => opts.body.idempotency_key)
    expect(second).toBe(first)
  })

  it('uses a new idempotency key when the content changed', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError(new Error('offline')) }).mockResolvedValueOnce(ok(success))
    renderAt('/admin/notificaciones')
    await screen.findByLabelText('Título')
    fillMessage()
    submit()
    confirmSend()
    await screen.findByText(/No sabemos si se envió/)
    fill('Mensaje', 'Otro texto')
    submit()
    confirmSend()
    await screen.findByText(/Enviada a 42 clientes/)
    const [first, second] = invoke.mock.calls.map(([, opts]) => opts.body.idempotency_key)
    expect(second).not.toBe(first)
  })

  it('E-16 asks for the PIN and retries with the same key', async () => {
    invoke.mockResolvedValueOnce(httpError('E-16', undefined, 403)).mockResolvedValueOnce(ok(success))
    renderAt('/admin/notificaciones')
    await screen.findByLabelText('Título')
    fillMessage()
    submit()
    mockRpc({ unlock_admin: ok({ ok: true, admin_unlocked_until: new Date(Date.now() + 300_000).toISOString() }) })
    confirmSend()
    const pin = await screen.findByRole('dialog', { name: /PIN/i })
    for (const digit of '1234') fireEvent.click(within(pin).getByRole('button', { name: digit }))
    await screen.findByText(/Enviada a 42 clientes/)
    expect(invoke).toHaveBeenCalledTimes(2)
    expect(invoke.mock.calls[1][1].body.idempotency_key).toBe(invoke.mock.calls[0][1].body.idempotency_key)
  })

  it('maps E-23 coupon fields from the Edge Function', async () => {
    invoke.mockResolvedValue(httpError('E-23', { field: 'coupon_terms' }))
    renderAt('/admin/notificaciones')
    await screen.findByLabelText('Título')
    fillMessage()
    fireEvent.click(screen.getByRole('switch', { name: 'Adjuntar cupón' }))
    fill('Beneficio', '2x1')
    fill('Restricciones', 'Solo bebidas')
    fill('Términos', 'No acumulable')
    submit()
    confirmSend()
    await waitFor(() => expect(screen.getByLabelText('Términos')).toHaveAttribute('aria-invalid', 'true'))
  })

  it('E-17 from the function refreshes the quota into the exhausted state', async () => {
    invoke.mockResolvedValue(httpError('E-17', { resets_on: '2026-11-01' }, 429))
    renderAt('/admin/notificaciones')
    await screen.findByLabelText('Título')
    fillMessage()
    submit()
    mockRpc({ get_push_status: ok({ ...status, remaining_this_month: 0 }) })
    confirmSend()
    await waitFor(() => expect(screen.getByLabelText('Título')).toBeDisabled())
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Usaste tus 5 envíos de este mes.')
  })
})

const callsTo = (name: string) => rpc.mock.calls.filter(([n]) => n === name)
