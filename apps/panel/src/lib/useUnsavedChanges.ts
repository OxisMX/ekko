import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router'

// Blocks in-app navigation (render the returned blocker with <UnsavedChangesDialog>) and tab close/reload while `dirty`.
export function useUnsavedChanges(dirty: boolean) {
  // WHY a ref: a successful save navigates away in the same tick, before React re-renders with dirty=false.
  const leaving = useRef(false)
  const blocker = useBlocker(() => dirty && !leaving.current)

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Call right before a navigation that follows a successful save.
  const allowLeave = () => {
    leaving.current = true
  }
  return { blocker, allowLeave }
}
