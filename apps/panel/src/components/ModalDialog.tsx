import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type Props = {
  labelledBy: string
  onClose: () => void
  children: ReactNode
  className?: string
  onKeyDown?: (event: KeyboardEvent) => void
  // Re-takes focus when it turns true (a disabled control drops focus while a request runs).
  refocusWhen?: boolean
}

// WCAG 2.1.2 / 2.4.3: focus starts inside, Tab cycles inside, Escape closes and focus returns to the opener.
export function ModalDialog({ labelledBy, onClose, children, className = 'max-w-md gap-4 p-6', onKeyDown, refocusWhen = true }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  useEffect(() => {
    if (refocusWhen) dialogRef.current?.focus()
  }, [refocusWhen])

  function handleKeyDown(event: KeyboardEvent) {
    onKeyDown?.(event)
    if (event.key === 'Escape') return onClose()
    if (event.key !== 'Tab') return
    const items = [...dialogRef.current!.querySelectorAll<HTMLElement>(FOCUSABLE)]
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    const leaving = event.shiftKey ? active === first || active === dialogRef.current : active === last
    if (!first || leaving) {
      event.preventDefault()
      ;(event.shiftKey ? last : first)?.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`flex w-full flex-col rounded-3xl bg-surface outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
