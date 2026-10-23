import type { ReactNode } from 'react'

// NOTE: placeholder address; confirm the real Oxis support mailbox before shipping.
export const SUPPORT_EMAIL = 'soporte@oxis.mx'

export function SupportLink({ children }: { children: ReactNode }) {
  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-navy underline underline-offset-2">
      {children}
    </a>
  )
}
