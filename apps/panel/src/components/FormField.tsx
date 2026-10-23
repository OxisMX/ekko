import { AlertIcon } from './Icons'

// WHY sentence-case label: long admin forms are read, not scanned; the uppercase `field-label` style is reserved for Login and the redemption validator.
export function Field({ label, error, counter, children, id }: { label: string; error?: string; counter?: string; children: React.ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        {counter && <span className="text-sm text-text-secondary">{counter}</span>}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-sm font-medium text-error">
          <AlertIcon className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
