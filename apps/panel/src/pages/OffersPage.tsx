import { merchantImageUrl } from '@ekko/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ModalDialog } from '../components/ModalDialog'
import { AlertIcon, CheckCircleIcon, TagIcon } from '../components/Icons'
import { useAdminRpc } from '../lib/adminUnlockContext'
import { useMenuFailure } from '../lib/menu'
import { OFFERS_QUERY_KEY, type Offer, toOffers, WEEKDAYS } from '../lib/offers'
import { supabase } from '../lib/supabase'

const buttonClass = 'min-h-12 rounded-xl px-5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40'
const outlineButton = `${buttonClass} border border-black/15 hover:bg-surface-muted`
const smallButton = 'min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40'

export function OfferThumbnail({ path }: { path: string | null }) {
  const [failed, setFailed] = useState(false)
  if (!path || failed)
    return <div aria-hidden="true" className="grid aspect-video w-28 shrink-0 place-items-center rounded-xl bg-surface-muted text-text-secondary"><TagIcon className="size-6" /></div>
  return <img src={merchantImageUrl(import.meta.env.VITE_SUPABASE_URL ?? '', path, 'offer', 1)} alt="" onError={() => setFailed(true)} className="aspect-video w-28 shrink-0 rounded-xl bg-surface-muted object-cover" />
}

// P-09 (F-26).
export function OffersPage() {
  const queryClient = useQueryClient()
  const adminRpc = useAdminRpc()
  const failure = useMenuFailure()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [confirm, setConfirm] = useState<{ offer: Offer; error?: string } | null>(null)
  const [busy, setBusy] = useState(false)

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
        <h1 id="offers-title" className="text-2xl font-bold">Ofertas semanales</h1>
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
        <button type="button" className={`${buttonClass} bg-navy text-white`} onClick={() => void offers.refetch()}>Reintentar</button>
      </div>
    )

  return (
    <section aria-labelledby="offers-title" className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="offers-title" className="text-2xl font-bold">Ofertas semanales</h1>
        <Link to="nueva" className={`${buttonClass} flex items-center bg-navy text-white hover:bg-brand`}>Nueva oferta</Link>
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
        WEEKDAYS.map((day, index) => {
          const weekday = index + 1
          const dayOffers = offers.data.filter((o) => o.weekday === weekday).sort((a, b) => a.position - b.position)
          return (
            <section key={day} aria-label={day} className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{day}</h2>
                <Link to={`nueva?dia=${weekday}`} className={`${smallButton} flex items-center`} aria-label={`Agregar oferta del ${day}`}>Agregar</Link>
              </div>
              {dayOffers.length === 0 && <p className="text-sm text-text-secondary">Sin oferta este día.</p>}
              <ul className="flex flex-col divide-y divide-black/10">
                {dayOffers.map((offer) => (
                  <li key={offer.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <OfferThumbnail path={offer.image_path} />
                      <div className="min-w-0">
                        <p className="font-semibold">{offer.title}</p>
                        <p className="line-clamp-2 text-sm text-text-secondary">{offer.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Link to={offer.id} className={`${smallButton} flex items-center`} aria-label={`Editar ${offer.title}`}>Editar</Link>
                      <button type="button" className={`${smallButton} text-error`} aria-label={`Eliminar ${offer.title}`} onClick={() => setConfirm({ offer })}>Eliminar</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}

      {confirm && (
        <ModalDialog labelledBy="delete-offer-title" onClose={() => !busy && setConfirm(null)}>
          <h2 id="delete-offer-title" className="text-xl font-semibold">¿Eliminar esta oferta?</h2>
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
            <button type="button" disabled={busy} className={outlineButton} onClick={() => setConfirm(null)}>Cancelar</button>
            <button type="button" disabled={busy} className={`${buttonClass} bg-navy text-white hover:bg-brand`} onClick={() => void confirmDelete()}>{busy ? 'Eliminando…' : 'Eliminar'}</button>
          </div>
        </ModalDialog>
      )}
    </section>
  )
}
