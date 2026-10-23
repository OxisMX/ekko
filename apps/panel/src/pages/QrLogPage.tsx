import { useInfiniteQuery } from '@tanstack/react-query'
import { useAdminRpc } from '../lib/adminUnlockContext'
import { useMenuFailure } from '../lib/menu'
import { formatQrDate, NO_AUTO_REFETCH, QR_LOG_KEY, QR_LOG_PAGE_SIZE, QR_STATUS_LABEL, toQrEntries } from '../lib/metrics'
import { supabase } from '../lib/supabase'

const buttonClass = 'min-h-12 rounded-xl px-5 font-semibold disabled:opacity-40'

// P-11 (US-26, RN-66).
export function QrLogPage() {
  const adminRpc = useAdminRpc()
  const failure = useMenuFailure()

  const log = useInfiniteQuery({
    queryKey: QR_LOG_KEY,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      toQrEntries(await adminRpc(() => supabase.rpc('list_qr_log', { p_offset: pageParam, p_limit: QR_LOG_PAGE_SIZE }))),
    getNextPageParam: (last, all) => (last.length < QR_LOG_PAGE_SIZE ? undefined : all.length * QR_LOG_PAGE_SIZE),
    ...NO_AUTO_REFETCH,
  })
  const entries = log.data?.pages.flat() ?? []

  return (
    <section aria-labelledby="qr-log-title" className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 id="qr-log-title" className="text-2xl font-bold">Registro de QR</h1>

      {log.isPending && <div role="status" aria-label="Cargando el registro" className="h-40 animate-pulse rounded-2xl bg-surface" />}
      {log.isError && (
        <div role="alert" className="flex max-w-xl flex-col items-start gap-3 rounded-2xl bg-surface p-6">
          <p className="font-semibold">{failure(log.error).message}</p>
          <button type="button" className={`${buttonClass} bg-navy text-white`} onClick={() => void log.refetch()}>Reintentar</button>
        </div>
      )}
      {log.data && entries.length === 0 && (
        <p className="rounded-2xl bg-surface p-6 text-text-secondary">Aún no generas códigos QR. Genera uno desde Modo Caja.</p>
      )}
      {entries.length > 0 && (
        <ul className="flex flex-col divide-y divide-black/10 rounded-2xl bg-surface px-5">
          {entries.map((entry, i) => (
            <li key={`${entry.created_at}-${i}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
              <div>
                <p className="text-sm text-text-secondary">Generado</p>
                <p className="font-semibold">{formatQrDate(entry.created_at)}</p>
              </div>
              {entry.used_at && (
                <div>
                  <p className="text-sm text-text-secondary">Usado a las</p>
                  <p className="font-semibold">{formatQrDate(entry.used_at)}</p>
                </div>
              )}
              <span className="rounded-full border border-black/20 px-3 py-1 text-sm font-semibold">{QR_STATUS_LABEL[entry.status]}</span>
            </li>
          ))}
        </ul>
      )}
      {log.hasNextPage && (
        <button type="button" disabled={log.isFetchingNextPage} className={`${buttonClass} w-fit border border-black/15`} onClick={() => void log.fetchNextPage()}>
          {log.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
        </button>
      )}
      {log.isFetchNextPageError && (
        <p role="alert" className="font-medium text-error">{failure(log.error).message}</p>
      )}
    </section>
  )
}
