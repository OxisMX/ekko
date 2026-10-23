import * as Sentry from '@sentry/react'
import { useEffect, useRef } from 'react'
import { nextSyncMode, parseQrStatus, statusFromRow, type SyncEvent, type SyncMode, type TerminalQrStatus } from './qrState'
import { supabase } from './supabase'

const SYNC_MS = 3000 // F-21: Realtime must subscribe within 3 s; fallback polls every 3 s.

// Watches the QR on screen (F-21, backend §8): Realtime UPDATE on its row, get_qr_status polling
// while the channel is down. Calls onResolved once per terminal status; pass null to stop.
export function useQrStatusSync(qrId: string | null, onResolved: (qrId: string, status: TerminalQrStatus) => void) {
  const callback = useRef(onResolved)
  useEffect(() => {
    callback.current = onResolved
  })

  useEffect(() => {
    if (!qrId) return
    let stopped = false
    let mode: SyncMode = 'connecting'
    let pollTimer: ReturnType<typeof setInterval> | undefined

    const resolve = (status: TerminalQrStatus | null) => {
      if (stopped || !status) return
      stopped = true
      clearInterval(pollTimer)
      callback.current(qrId, status)
    }
    const poll = async () => {
      if (stopped) return
      const { data, error } = await supabase.rpc('get_qr_status', { p_qr_id: qrId })
      // WHY: a failed poll (offline tablet) is retried by the next tick; the countdown still runs.
      if (error) return
      const status = parseQrStatus(data)
      resolve(status === 'pending' ? null : status)
    }
    // A malformed get_qr_status payload is a backend bug: report it, keep the countdown running.
    const pollSafely = () => void poll().catch((e: unknown) => Sentry.captureException(e))
    const apply = (event: SyncEvent) => {
      if (stopped) return // removeChannel reports CLOSED during cleanup
      const next = nextSyncMode(mode, event)
      if (next === 'polling' && mode !== 'polling') {
        pollSafely()
        pollTimer = setInterval(pollSafely, SYNC_MS)
      } else if (next === 'realtime' && mode !== 'realtime') {
        clearInterval(pollTimer)
        // WHY: an UPDATE before SUBSCRIBED (or between the last poll and it) would otherwise be missed.
        pollSafely()
      }
      mode = next
    }

    const channel = supabase
      .channel(`qr-${qrId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'visit_qr_tokens', filter: `id=eq.${qrId}` },
        (payload) => resolve(statusFromRow(payload.new)),
      )
      .subscribe((status) => apply(status))
    const connectTimer = setTimeout(() => apply('TIMEOUT'), SYNC_MS)

    return () => {
      stopped = true
      clearTimeout(connectTimer)
      clearInterval(pollTimer)
      void supabase.removeChannel(channel)
    }
  }, [qrId])
}
