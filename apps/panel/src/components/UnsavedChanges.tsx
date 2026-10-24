import { useRef, type ReactNode } from 'react'
import type { Blocker } from 'react-router'
import { AlertIcon } from './Icons'
import { ModalDialog } from './ModalDialog'
import { btnDanger, btnSecondary } from './ui'

export function UnsavedChangesDialog({ blocker }: { blocker: Blocker }) {
  const stayRef = useRef<HTMLButtonElement>(null)
  if (blocker.state !== 'blocked') return null
  return (
    <ModalDialog labelledBy="unsaved-title" onClose={() => blocker.reset()} initialFocusRef={stayRef}>
      <h2 id="unsaved-title" className="text-h2 font-semibold">
        Tienes cambios sin guardar
      </h2>
      <p>Si sales ahora, perderás los cambios que hiciste en esta pantalla.</p>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className={btnDanger} onClick={() => blocker.proceed()}>
          Salir sin guardar
        </button>
        {/* WHY ref on the safe option: Enter on open must never discard work. */}
        <button ref={stayRef} type="button" className={btnSecondary} onClick={() => blocker.reset()}>
          Seguir editando
        </button>
      </div>
    </ModalDialog>
  )
}

// Sticky so the reminder (and the save action passed as children) stays in reach on long forms.
export function UnsavedBar({ show, children }: { show: boolean; children?: ReactNode }) {
  if (!show) return null
  return (
    <div role="status" className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-card border border-black/10 bg-surface px-5 py-3 shadow-lg">
      <p className="flex items-center gap-2 font-semibold">
        <AlertIcon className="size-5 shrink-0 text-warning" />
        Cambios sin guardar
      </p>
      {children}
    </div>
  )
}
