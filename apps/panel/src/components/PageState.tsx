import { AlertIcon } from './Icons'
import { btnPrimary } from './ui'

type Props = {
  title: string
  // Screen-reader announcement while loading.
  loadingLabel: string
  // When set the page shows this message with a retry action instead of the skeleton.
  error?: string
  onRetry?: () => void
  className?: string
}

// WHY keeps the h1: the page identity must not vanish while data loads or fails.
export function PageState({ title, loadingLabel, error, onRetry, className = 'max-w-4xl' }: Props) {
  const block = 'rounded-card bg-surface motion-safe:animate-pulse'
  return (
    <section aria-label={title} className={`mx-auto flex w-full flex-col gap-6 ${className}`}>
      <h1 className="text-h1 font-bold">{title}</h1>
      {error ? (
        <div role="alert" className="flex max-w-xl flex-col items-start gap-3 rounded-card bg-surface p-6">
          <p className="flex items-center gap-2 font-semibold">
            <AlertIcon className="size-5 shrink-0" />
            {error}
          </p>
          {onRetry && (
            <button type="button" className={btnPrimary} onClick={onRetry}>
              Reintentar
            </button>
          )}
        </div>
      ) : (
        <div aria-busy="true" className="flex flex-col gap-4">
          <span role="status" className="sr-only">
            {loadingLabel}
          </span>
          <div className={`h-40 ${block}`} />
          <div className={`h-64 ${block}`} />
        </div>
      )}
    </section>
  )
}
