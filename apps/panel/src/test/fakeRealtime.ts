import { vi } from 'vitest'

// Minimal stand-in for supabase.channel(): tests drive the subscribe status and UPDATE events.
export type FakeChannel = {
  name: string
  filter?: unknown
  removed: boolean
  status: (s: string) => void
  emit: (row: Record<string, unknown>) => void
}

export function createFakeRealtime(onSubscribe?: (ch: FakeChannel) => void) {
  const channels: FakeChannel[] = []
  const channel = vi.fn((name: string) => {
    let statusCb: (s: string) => void = () => {}
    let handler: (p: { new: Record<string, unknown> }) => void = () => {}
    const fake: FakeChannel = {
      name,
      removed: false,
      status: (s) => statusCb(s),
      emit: (row) => handler({ new: row }),
    }
    const api = {
      on: (_type: string, filter: unknown, cb: typeof handler) => {
        fake.filter = filter
        handler = cb
        return api
      },
      subscribe: (cb: typeof statusCb) => {
        statusCb = cb
        onSubscribe?.(fake)
        return api
      },
      fake,
    }
    channels.push(fake)
    return api
  })
  const removeChannel = vi.fn(async (api: { fake: FakeChannel }) => {
    api.fake.removed = true
    api.fake.status('CLOSED') // supabase-js reports CLOSED to the subscribe callback on removal
    return 'ok'
  })
  return { channel, removeChannel, channels }
}
