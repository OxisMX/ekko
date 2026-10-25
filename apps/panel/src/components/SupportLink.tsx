import { SUPPORT_EMAIL } from '@ekko/shared'
import type { ReactNode } from 'react'

export function SupportLink({ children }: { children: ReactNode }) {
  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-navy underline underline-offset-2">
      {children}
    </a>
  )
}
