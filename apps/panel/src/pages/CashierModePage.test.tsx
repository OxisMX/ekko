import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { QrSvg } from '../components/VisitQrPanel'
import type { MerchantSession } from '../lib/panelRoute'
import { createFakeRealtime } from '../test/fakeRealtime'
import { CashierModePage } from './CashierModePage'

const { rpc, realtime } = vi.hoisted(() => ({
  rpc: vi.fn(),
  realtime: { current: null as unknown as ReturnType<typeof createFakeRealtime> },
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc,
    channel: (n: string) => realtime.current.channel(n),
    removeChannel: (c: never) => realtime.current.removeChannel(c),
  },
}))

const TOKEN_1 = 'AbCdEfGhIjKlMnOpQrStU_'
const TOKEN_2 = 'zzzzzzzzzzzzzzzzzzzzz-'
const qrResponse = (n: 1 | 2) => ({
  data: {
    qr_id: n === 1 ? '6f1c1d1e-7b5a-4c1e-9a7b-1d2e3f4a5b6c' : '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
    token: n === 1 ? TOKEN_1 : TOKEN_2,
    expires_at: '2026-10-20T17:30:45Z',
    ttl_seconds: 60,
  },
  error: null,
})

const signOut = vi.fn<AuthState['signOut']>()
let queryClient: QueryClient

function renderPage() {
  const merchantSession: MerchantSession = {
    merchant: { id: 'm1', name: 'Café Ekko Centro', logo_path: null },
    is_active: true,
    admin_unlocked_until: null,
    pin_locked_until: null,
    validator_locked_until: null,
  }
  const auth: AuthState = { session: undefined, authError: null, clearAuthError: vi.fn(), signOut }
  const router = createMemoryRouter([
    { element: <Outlet context={{ merchantSession }} />, children: [{ path: '/', element: <CashierModePage /> }] },
  ])
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={auth}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  )
}

// Fake clock: performance.now() too, the countdown's only time source.
const flush = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms))
const qrImage = () => screen.getByRole('img', { name: /Código QR de visita/ })
const liveRegion = () => document.querySelector('[aria-live="polite"]')!

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] })
  rpc.mockReset()
  realtime.current = createFakeRealtime((ch) => ch.status('SUBSCRIBED'))
  signOut.mockReset()
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
})
afterEach(() => vi.useRealTimers())

describe('CashierModePage — visit QR (US-19, F-21)', () => {
  it('generates the QR: disabled while pending, then the SVG encoding <origin>/v/<token> with a 60 s countdown', async () => {
    let resolve!: (value: unknown) => void
    rpc.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Generar QR' }))
    expect(screen.getByRole('button', { name: 'Generando…' })).toBeDisabled()
    await flush()
    expect(rpc).toHaveBeenCalledWith('generate_visit_qr')

    resolve(qrResponse(1))
    await flush()

    const svg = qrImage()
    expect(svg).toHaveAccessibleName('Código QR de visita, vence en 60 segundos')
    expect(svg.tagName).toBe('svg')
    // Same modules as a QR of the expected URL (VITE_PUBLIC_APP_URL = http://localhost:5173 in tests).
    const expected = renderToStaticMarkup(<QrSvg value={`http://localhost:5173/v/${TOKEN_1}`} label="x" />)
    expect(expected).toContain(svg.querySelector('path')!.getAttribute('d')!)
    expect(screen.getByText('60 s')).toBeInTheDocument()
    expect(liveRegion()).toHaveTextContent('')
  })

  it('counts down with the monotonic clock, announces 30 s / 10 s, and expires at 0 s', async () => {
    rpc.mockResolvedValueOnce(qrResponse(1))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Generar QR' }))
    await flush()

    await flush(1000)
    expect(screen.getByText('59 s')).toBeInTheDocument()
    expect(liveRegion()).toHaveTextContent('')

    await flush(29_000)
    expect(qrImage()).toHaveAccessibleName('Código QR de visita, vence en 30 segundos')
    expect(liveRegion()).toHaveTextContent('Quedan 30 segundos.')

    await flush(20_000)
    expect(liveRegion()).toHaveTextContent('Quedan 10 segundos.')

    await flush(10_000)
    expect(screen.queryByRole('img', { name: /Código QR de visita/ })).not.toBeInTheDocument()
    expect(screen.getByText('QR vencido')).toBeInTheDocument()
    expect(liveRegion()).toHaveTextContent('El QR venció. Genera otro.')

    rpc.mockResolvedValueOnce(qrResponse(2))
    fireEvent.click(screen.getByRole('button', { name: 'Generar otro' }))
    await flush()
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(qrImage()).toHaveAccessibleName('Código QR de visita, vence en 60 segundos')
  })

  it('"Generar otro" while active calls the RPC again and replaces the QR with a fresh countdown', async () => {
    rpc.mockResolvedValueOnce(qrResponse(1))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Generar QR' }))
    await flush()
    await flush(25_000)
    const firstId = qrImage().getAttribute('data-qr-id')

    rpc.mockResolvedValueOnce(qrResponse(2))
    fireEvent.click(screen.getByRole('button', { name: 'Generar otro' }))
    await flush()

    expect(rpc).toHaveBeenCalledTimes(2)
    expect(qrImage().getAttribute('data-qr-id')).not.toBe(firstId)
    const [first, second] = realtime.current.channels
    expect(first.removed).toBe(true)
    expect(second.removed).toBe(false)
    expect(screen.getByText('60 s')).toBeInTheDocument()
  })

  it('Realtime "used" → green "Visita registrada" with icon + announcement for 3 s, then ready again (TC-053)', async () => {
    rpc.mockResolvedValueOnce(qrResponse(1))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Generar QR' }))
    await flush()
    const [ch] = realtime.current.channels
    expect(ch.name).toBe('qr-6f1c1d1e-7b5a-4c1e-9a7b-1d2e3f4a5b6c')

    await act(async () => ch.emit({ used_at: '2026-10-21T10:00:00Z', invalidated_at: null }))
    expect(screen.getByText('Visita registrada', { selector: 'p:not([aria-live])' })).toBeVisible()
    expect(liveRegion()).toHaveTextContent('Visita registrada')
    expect(screen.queryByRole('img', { name: /Código QR de visita/ })).not.toBeInTheDocument()
    expect(ch.removed).toBe(true)

    await flush(2_999)
    expect(liveRegion()).toHaveTextContent('Visita registrada')
    await flush(1)
    expect(screen.queryByText('Visita registrada')).not.toBeInTheDocument()
    expect(screen.getByText('El QR aparecerá aquí')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generar QR' })).toBeEnabled()
    expect(rpc).toHaveBeenCalledTimes(1) // no polling while Realtime is subscribed
  })

  it('Realtime "invalidated" (another device generated a QR) → "QR reemplazado"', async () => {
    rpc.mockResolvedValueOnce(qrResponse(1))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Generar QR' }))
    await flush()
    await act(async () => realtime.current.channels[0].emit({ used_at: null, invalidated_at: '2026-10-21T10:00:00Z' }))
    expect(screen.getByText('QR reemplazado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generar otro' })).toBeEnabled()
  })

  it('E-01: shows the connection error with a retry that calls the RPC again', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'TypeError: Failed to fetch', details: null, code: '' } })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Generar QR' }))
    await flush()

    const alert = screen.getByRole('alert')
    expect(within(alert).getByText(/No hay conexión/)).toBeInTheDocument()
    rpc.mockResolvedValueOnce(qrResponse(1))
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await flush()
    expect(qrImage()).toBeInTheDocument()
  })

  it('E-05: refetches the merchant session so the gate sends the inactive merchant to P-12', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'E-05', details: null, code: 'P0001' } })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Generar QR' }))
    await flush()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['merchant-session'] })
    expect(signOut).not.toHaveBeenCalled()
  })

  it('E-19: signs out through the existing path', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'E-19', details: null, code: 'P0001' } })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Generar QR' }))
    await flush()
    expect(signOut).toHaveBeenCalledWith('E-19')
  })
})
