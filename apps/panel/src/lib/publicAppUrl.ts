// TRD §6.4: the visit QR encodes <public app origin>/v/<token>. The origin differs per
// environment (local, staging, production), so it comes from VITE_PUBLIC_APP_URL.
export function parsePublicAppUrl(value: string | undefined): string {
  let url: URL | null = null
  try {
    url = value ? new URL(value) : null
  } catch {
    // Unparseable → reported below with the same message as a missing value.
  }
  // WHY: comparing with url.origin rejects paths, query strings and a trailing "/".
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.origin !== value) {
    throw new Error(
      'VITE_PUBLIC_APP_URL debe ser un origen http(s) sin "/" final (p. ej. https://ekko.oxis.mx) en el entorno del panel.',
    )
  }
  return value
}

export const visitQrUrl = (token: string, origin: string) => `${origin}/v/${token}`

// Validated at startup, like the Supabase variables: a bad value must fail loudly, not print broken QRs.
export const PUBLIC_APP_URL = parsePublicAppUrl(import.meta.env.VITE_PUBLIC_APP_URL)
