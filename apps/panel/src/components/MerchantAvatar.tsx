import { merchantImageUrl } from '@ekko/shared'
import { useState } from 'react'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('')
}

// P-13: the merchant logo (public bucket) with an initials tile when there is none or it fails to load.
export function MerchantAvatar({ name, logoPath, className = 'size-10' }: { name: string; logoPath: string | null; className?: string }) {
  const [failed, setFailed] = useState(false)
  const base = `${className} shrink-0 rounded-button`
  if (logoPath && !failed) {
    return (
      <img
        src={merchantImageUrl(import.meta.env.VITE_SUPABASE_URL ?? '', logoPath, 'logo', 1)}
        alt=""
        onError={() => setFailed(true)}
        className={`${base} bg-surface-muted object-cover`}
      />
    )
  }
  return (
    <div aria-hidden="true" className={`${base} grid place-items-center bg-navy font-bold text-white`}>
      {initials(name)}
    </div>
  )
}
