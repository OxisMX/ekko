import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { CheckCircleIcon, ClockIcon, QrIcon, RefreshIcon, XCircleIcon } from '../components/Icons'
import { useAdminRpc } from '../lib/adminUnlockContext'
import { useMenuFailure } from '../lib/menu'
import { formatQrDate, type QrEntry, NO_AUTO_REFETCH, QR_LOG_KEY, QR_LOG_PAGE_SIZE, QR_STATUS_LABEL, toQrEntries } from '../lib/metrics'
import { supabase } from '../lib/supabase'
import { btnPrimary, btnSecondary } from '../components/ui'


// WHY icon + text: the status is never carried by colour alone.
const STATUS_ICON: Record<QrEntry['status'], typeof QrIcon> = { used: CheckCircleIcon, pending: ClockIcon, invalidated: RefreshIcon, expired: XCircleIcon }

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
      <h1 id="qr-log-title" className="text-h1 font-bold">Registro de QR</h1>

      {log.isPending && <div role="status" aria-label="Cargando el registro" className="h-40 animate-pulse rounded-2xl bg-surface" />}
      {log.isError && (
        <div role="alert" className="flex max-w-xl flex-col items-start gap-3 rounded-2xl bg-surface p-6">
          <p className="font-semibold">{failure(log.error).message}</p>
          <button type="button" className={btnPrimary} onClick={() => void log.refetch()}>Reintentar</button>
        </div>
      )}
      {log.data && entries.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl bg-surface px-6 py-12 text-center">
          <QrIcon className="size-12 text-navy" />
          <p className="mt-4 text-lg font-semibold">Aún no generas códigos QR</p>
          <p className="mt-1 max-w-md text-text-secondary">Cada código que muestres a tus clientes aparecerá aquí con su estado.</p>
          <Link to="/" className={`${btnPrimary} mt-6 flex items-center`}>Ir a Modo Caja</Link>
        </div>
      )}
      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-surface px-5">
          <table className="w-full text-left">
            <caption className="sr-only">Códigos QR generados</caption>
            <thead>
              <tr className="border-b border-black/10 text-sm text-text-secondary">
                <th scope="col" className="py-3 pr-4 font-medium">Generado</th>
                <th scope="col" className="py-3 pr-4 font-medium">Usado</th>
                <th scope="col" className="py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {entries.map((entry, i) => {
                const Status = STATUS_ICON[entry.status]
                return (
                  <tr key={`${entry.created_at}-${i}`}>
                    <td className="py-3 pr-4 font-semibold">{formatQrDate(entry.created_at)}</td>
                    <td className="py-3 pr-4">{entry.used_at ? formatQrDate(entry.used_at) : '—'}</td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <Status className="size-5 shrink-0" />
                        {QR_STATUS_LABEL[entry.status]}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {log.hasNextPage && (
        <button type="button" disabled={log.isFetchingNextPage} className={`${btnSecondary} w-fit`} onClick={() => void log.fetchNextPage()}>
          {log.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
        </button>
      )}
      {log.isFetchNextPageError && (
        <p role="alert" className="font-medium text-error">{failure(log.error).message}</p>
      )}
    </section>
  )
}
