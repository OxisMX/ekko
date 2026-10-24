import { stampGridRows } from '@ekko/shared'
import { GiftIcon } from './Icons'
import { cycleExpiryLabel } from '../lib/cardConfig'

const SLOT_MAX = 'max-w-16'

// Mirrors the mobile StampCard (brief §6.2): background `cover` under a 78% white veil, circular slots,
// progress copy and expiry. The container has no fixed ratio so 10 stamps never get clipped (P-28).
export function CardPreview({
  merchantName,
  stampsRequired,
  rewardTitle,
  cycleMonths,
  backgroundUrl,
  stampImageUrl = null,
}: {
  merchantName: string
  stampsRequired: number
  rewardTitle: string
  cycleMonths: number
  backgroundUrl: string | null
  stampImageUrl?: string | null
}) {
  const rows = stampGridRows(stampsRequired)
  const perRow = rows[0]
  // Half the card as a sample so both filled and empty slots are visible.
  const granted = Math.ceil(stampsRequired / 2)
  const missing = stampsRequired - granted
  const reward = rewardTitle || 'Título del premio'
  const expires = cycleExpiryLabel(cycleMonths)
  let index = 0
  return (
    <div
      data-testid="card-preview"
      role="img"
      aria-label={`Vista previa: ${merchantName}, ${granted} de ${stampsRequired} sellos, premio ${reward}, vence el ${expires}`}
      className="relative w-full overflow-hidden rounded-3xl bg-surface-card shadow-sm"
    >
      {backgroundUrl && (
        <>
          <div data-testid="card-preview-bg" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${backgroundUrl}")` }} />
          <div className="absolute inset-0 bg-white/[.78]" />
        </>
      )}
      <div className="relative flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-3">
          {rows.map((count, row) => (
            <div key={row} className="flex justify-center gap-2">
              {Array.from({ length: count }, () => {
                const i = index++
                const slot = `grid aspect-square place-items-center rounded-full ${SLOT_MAX}`
                const width = { width: `${100 / perRow - 3}%` }
                if (i >= granted)
                  return (
                    <span key={i} style={width} className={`${slot} border border-dashed border-text-secondary bg-surface-muted text-navy`}>
                      {i === stampsRequired - 1 && <GiftIcon className="size-1/2" />}
                    </span>
                  )
                return (
                  <span key={i} style={width} className={`${slot} overflow-hidden bg-navy text-white`}>
                    {stampImageUrl ? <img src={stampImageUrl} alt="" className="size-full object-cover" /> : <b className="text-lg">{merchantName.charAt(0).toUpperCase()}</b>}
                  </span>
                )
              })}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-h2 font-bold tabular-nums">{granted} de {stampsRequired} sellos</p>
          <div className="h-1 overflow-hidden rounded-sm bg-black/15">
            <div className="h-full bg-navy" style={{ width: `${(granted / stampsRequired) * 100}%` }} />
          </div>
          <p className="text-sm">{missing === 1 ? '¡Solo te falta 1!' : `Te faltan ${missing} para tu premio`}</p>
          <p className="break-words">Premio: {reward}</p>
          <p className="text-sm">Vence el {expires}</p>
        </div>
      </div>
    </div>
  )
}
