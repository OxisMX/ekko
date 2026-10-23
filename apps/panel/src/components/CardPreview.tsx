import { stampGridRows } from '@ekko/shared'
import { CheckCircleIcon } from './Icons'

// Same look as the mobile StampCard (brief §6.2): 1.586:1, `cover` background under a translucent veil.
export function CardPreview({
  merchantName,
  stampsRequired,
  rewardTitle,
  backgroundUrl,
  stampImageUrl = null,
}: {
  merchantName: string
  stampsRequired: number
  rewardTitle: string
  backgroundUrl: string | null
  stampImageUrl?: string | null
}) {
  const rows = stampGridRows(stampsRequired)
  const sampleStamps = Math.ceil(stampsRequired / 2)
  let index = 0
  return (
    <div
      data-testid="card-preview"
      role="img"
      aria-label={`Vista previa: ${merchantName}, ${stampsRequired} sellos, premio ${rewardTitle || 'sin título'}`}
      className="relative aspect-[1.586] w-full overflow-hidden rounded-3xl bg-surface-card bg-cover bg-center shadow-sm"
      style={backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : undefined}
    >
      <div className="absolute inset-0 flex flex-col justify-between bg-white/80 p-5">
        <div>
          <p className="truncate text-lg font-bold">{merchantName}</p>
          <p className="truncate text-sm text-text-secondary">{rewardTitle || 'Título del premio'}</p>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map((count, row) => (
            <div key={row} className="flex justify-center gap-2">
              {Array.from({ length: count }, () => {
                const i = index++
                const last = i === stampsRequired - 1
                return (
                  <span
                    key={i}
                    className={`grid aspect-square w-full max-w-12 place-items-center rounded-full ${
                      i < sampleStamps ? 'bg-navy text-white' : 'bg-surface-muted text-navy'
                    }`}
                  >
                    {i < sampleStamps ? stampImageUrl ? <img src={stampImageUrl} alt="" className="size-full rounded-full object-cover" /> : <CheckCircleIcon className="size-1/2" /> : last ? '★' : null}
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
