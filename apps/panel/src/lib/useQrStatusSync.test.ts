import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createFakeRealtime } from '../test/fakeRealtime'
import { useQrStatusSync } from './useQrStatusSync'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), realtime: null as unknown as ReturnType<typeof createFakeRealtime> }))
vi.mock('./supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    channel: (n: string) => mocks.realtime.channel(n),
    removeChannel: (c: never) => mocks.realtime.removeChannel(c),
  },
}))

const flush = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms))
const status = (s: string) => ({ data: { status: s }, error: null })
const onResolved = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  mocks.rpc.mockReset()
  onResolved.mockReset()
  mocks.realtime = createFakeRealtime()
})
afterEach(() => vi.useRealTimers())

it('subscribes to UPDATEs of this QR and resolves "used" from the Realtime event, without polling', async () => {
  renderHook(() => useQrStatusSync('q1', onResolved))
  const [ch] = mocks.realtime.channels
  expect(ch.name).toBe('qr-q1')
  expect(ch.filter).toEqual({ event: 'UPDATE', schema: 'public', table: 'visit_qr_tokens', filter: 'id=eq.q1' })

  ch.status('SUBSCRIBED')
  await flush(10_000)
  expect(mocks.rpc).not.toHaveBeenCalled()

  ch.emit({ id: 'q1', used_at: '2026-10-21T10:00:00Z', invalidated_at: null })
  expect(onResolved).toHaveBeenCalledWith('q1', 'used')
})

it('never subscribes within 3 s → polls get_qr_status every 3 s until terminal', async () => {
  mocks.rpc.mockResolvedValueOnce(status('pending')).mockResolvedValueOnce(status('used'))
  renderHook(() => useQrStatusSync('q1', onResolved))

  await flush(2_999)
  expect(mocks.rpc).not.toHaveBeenCalled()
  await flush(1)
  expect(mocks.rpc).toHaveBeenCalledWith('get_qr_status', { p_qr_id: 'q1' })
  expect(onResolved).not.toHaveBeenCalled()

  await flush(3_000)
  expect(mocks.rpc).toHaveBeenCalledTimes(2)
  expect(onResolved).toHaveBeenCalledWith('q1', 'used')
  await flush(9_000)
  expect(mocks.rpc).toHaveBeenCalledTimes(2) // stopped
})

it('channel error → polling; reconnect → one catch-up poll, then Realtime only', async () => {
  mocks.rpc.mockResolvedValue(status('pending'))
  renderHook(() => useQrStatusSync('q1', onResolved))
  const [ch] = mocks.realtime.channels
  ch.status('SUBSCRIBED')
  ch.status('CHANNEL_ERROR')
  await flush()
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  await flush(3_000)
  expect(mocks.rpc).toHaveBeenCalledTimes(2)

  ch.status('SUBSCRIBED')
  await flush()
  expect(mocks.rpc).toHaveBeenCalledTimes(3) // catch-up for the gap since the last poll
  await flush(9_000)
  expect(mocks.rpc).toHaveBeenCalledTimes(3)
})

it('a failed poll keeps polling', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } }).mockResolvedValueOnce(status('expired'))
  renderHook(() => useQrStatusSync('q1', onResolved))
  await flush(6_000)
  expect(onResolved).toHaveBeenCalledWith('q1', 'expired')
})

it('cleans up the channel and timers on regenerate (new id) and on unmount', async () => {
  mocks.rpc.mockResolvedValue(status('pending'))
  const { rerender, unmount } = renderHook(({ id }) => useQrStatusSync(id, onResolved), {
    initialProps: { id: 'q1' as string | null },
  })
  rerender({ id: 'q2' })
  const [first, second] = mocks.realtime.channels
  expect(first.removed).toBe(true)
  expect(second.name).toBe('qr-q2')
  first.emit({ used_at: '2026-10-21T10:00:00Z' })
  expect(onResolved).not.toHaveBeenCalled()

  rerender({ id: null }) // expired / used / idle
  expect(second.removed).toBe(true)
  await flush(10_000)
  expect(mocks.rpc).not.toHaveBeenCalled() // the CLOSED from removal must not start polling

  unmount()
  expect(mocks.realtime.channels).toHaveLength(2)
})
