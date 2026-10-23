// Shared class strings and Switch so every page renders the same controls (P-02).
// WHY active:scale: tablets have no hover, so a press needs visible feedback (P-07).
const btnBase =
  'min-h-12 rounded-button px-5 font-semibold transition-[color,background-color,transform] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40'

export const btnPrimary = `${btnBase} bg-navy text-white hover:bg-brand active:bg-brand`
export const btnSecondary = `${btnBase} border border-black/15 hover:bg-surface-muted active:bg-black/10`
export const btnDanger = `${btnBase} bg-danger text-white hover:brightness-90 active:brightness-90`
export const btnSmall =
  'min-h-10 rounded-field px-3 text-sm font-semibold transition-[color,background-color,transform] hover:bg-surface-muted active:scale-[.98] active:bg-black/10 disabled:cursor-not-allowed disabled:opacity-40'

// WHY border-text-secondary: the field edge must reach 3:1 against the surface (WCAG 1.4.11); black/20 was ~1.6:1.
export const input =
  'w-full rounded-button border border-text-secondary bg-surface px-4 py-3 text-base aria-invalid:border-error disabled:opacity-50'

type SwitchProps = {
  // Accessible name; may carry context ("Agotado por hoy: Café") that `text` omits.
  label: string
  // Optional visible caption next to the rail.
  text?: string
  checked: boolean
  onChange: (next: boolean) => void
}

export function Switch({ label, text, checked, onChange }: SwitchProps) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        // WHY text-secondary rail when off: ≥3:1 against the surface; black/30 was ~2.1:1.
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-navy' : 'bg-text-secondary'}`}
      >
        <span className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      {text && <span aria-hidden="true">{text}</span>}
    </label>
  )
}
