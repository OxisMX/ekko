import { merchantImageUrl } from '@ekko/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ModalDialog } from '../components/ModalDialog'
import { AlertIcon, CheckCircleIcon, TagIcon } from '../components/Icons'
import { useAdminRpc } from '../lib/adminUnlockContext'
import { useMenuFailure } from '../lib/menu'
import { OFFERS_QUERY_KEY, type Offer, toOffers, WEEKDAYS } from '../lib/offers'
import { supabase } from '../lib/supabase'
import { btnDanger, btnPrimary, btnSecondary, btnSmall } from '../components/ui'


export function OfferThumbnail({ path }: { path: string | null }) {
  const [failed, setFailed] = useState(false)
  if (!path || failed)
    return <div aria-hidden="true" className="grid aspect-video w-20 shrink-0 place-items-center rounded-xl bg-surface-muted text-text-secondary"><TagIcon className="size-6" /></div>
  return <img src={merchantImageUrl(import.meta.env.VITE_SUPABASE_URL ?? '', path, 'offer', 1)} alt="" onError={() => setFailed(true)} className="aspect-video w-20 shrink-0 rounded-xl bg-surface-muted object-cover" />
}

// WHY min-h-12: touch targets of 48 px (P-33).
const rowAction = btnSmall.replace('min-h-10', 'min-h-12')

// ISO weekday of today (1 = lunes … 7 = domingo), the same numbering as the offers.
const isoWeekday = (date: Date) => ((date.getDay() + 6) % 7) + 1

// P-09 (F-26).
export function OffersPage() {
  const queryClient = useQueryClient()
  const adminRpc = useAdminRpc()
  const failure = useMenuFailure()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [confirm, setConfirm] = useState<{ offer: Offer; error?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [todayWeekday] = useState(() => isoWeekday(new Date()))

  const offers = useQuery({
    queryKey: OFFERS_QUERY_KEY,
    queryFn: async () => toOffers(await adminRpc(() => supabase.rpc('list_offers_admin'))),
  })

  async function confirmDelete() {
    if (!confirm) return
    setBusy(true)
    try {
      await adminRpc(() => supabase.rpc('delete_offer', { p_id: confirm.offer.id }))
      await queryClient.invalidateQueries({ queryKey: OFFERS_QUERY_KEY })
      setConfirm(null)
    } catch (err) {
      setConfirm({ ...confirm, error: failure(err).message })
    } finally {
      setBusy(false)
    }
  }

  if (offers.isPending)
    return (
      <section aria-labelledby="offers-title" className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 id="offers-title" className="text-h1 font-bold">Ofertas semanales</h1>
        <div role="status" aria-label="Cargando las ofertas" className="flex animate-pulse flex-col gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-surface" />
          ))}
        </div>
      </section>
    )
  if (offers.isError)
    return (
      <div role="alert" className="mx-auto flex max-w-xl flex-col items-start gap-3 rounded-2xl bg-surface p-6">
        <p className="font-semibold">{failure(offers.error).message}</p>
        <button type="button" className={btnPrimary} onClick={() => void offers.refetch()}>Reintentar</button>
      </div>
    )

  return (
    <section aria-labelledby="offers-title" className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="offers-title" className="text-h1 font-bold">Ofertas semanales</h1>
        <Link to="nueva" className={`${btnPrimary} flex items-center`}>Nueva oferta</Link>
      </div>

      {notice && (
        <p role="status" className="flex items-center gap-2 font-medium text-success">
          <CheckCircleIcon className="size-5 shrink-0" />
          {notice}
        </p>
      )}

      {offers.data.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-surface px-6 py-12 text-center">
          <TagIcon className="size-12 text-navy" />
          <p className="mt-4 text-lg font-semibold">Aún no tienes ofertas</p>
          <p className="mt-1 max-w-md text-text-secondary">Agrega una oferta para un día de la semana y tus clientes la verán en la app ese día.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-black/10 overflow-hidden rounded-2xl bg-surface">
          {WEEKDAYS.map((day, index) => {
            const weekday = index + 1
            const isToday = weekday === todayWeekday
            const dayOffers = offers.data.filter((o) => o.weekday === weekday).sort((a, b) => a.position - b.position)
            return (
              <section key={day} aria-label={day} className={`flex flex-col gap-1 px-4 py-2 ${isToday ? 'border-l-4 border-accent bg-accent/10' : 'border-l-4 border-transparent'}`}>
                <div className="flex min-h-12 items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-semibold">
                    {day}
                    {isToday && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-text-primary">Hoy</span>}
                  </h2>
                  {dayOffers.length === 0 && <p className="ml-auto text-sm text-text-secondary">Sin oferta este día.</p>}
                  <Link to={`nueva?dia=${weekday}`} className={`${rowAction} flex items-center`} aria-label={`Agregar oferta del ${day}`}>Agregar</Link>
                </div>
                {dayOffers.length > 0 && (
                  <ul className="flex flex-col divide-y divide-black/10 pb-1">
                    {dayOffers.map((offer) => (
                      <li key={offer.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <OfferThumbnail path={offer.image_path} />
                          <div className="min-w-0">
                            <p className="font-semibold">{offer.title}</p>
                            <p className="line-clamp-1 text-sm text-text-secondary">{offer.description}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Link to={offer.id} className={`${rowAction} flex items-center`} aria-label={`Editar ${offer.title}`}>Editar</Link>
                          <button type="button" className={`${rowAction} text-danger`} aria-label={`Eliminar ${offer.title}`} onClick={() => setConfirm({ offer })}>Eliminar</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}

      {confirm && (
        <ModalDialog labelledBy="delete-offer-title" onClose={() => !busy && setConfirm(null)} initialFocusRef={cancelRef}>
          <h2 id="delete-offer-title" className="text-h2 font-semibold">¿Eliminar esta oferta?</h2>
          <p>
            <strong>{confirm.offer.title}</strong> dejará de verse en la app. Esta acción no se puede deshacer.
          </p>
          {confirm.error && (
            <p role="alert" className="flex items-center gap-2 font-medium text-error">
              <AlertIcon className="size-5 shrink-0" />
              {confirm.error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <button ref={cancelRef} type="button" disabled={busy} className={btnSecondary} onClick={() => setConfirm(null)}>Cancelar</button>
            <button type="button" disabled={busy} className={btnDanger} onClick={() => void confirmDelete()}>{busy ? 'Eliminando…' : 'Eliminar'}</button>
          </div>
        </ModalDialog>
      )}
    </section>
  )
}
