// Injected by vite.config.ts `define` (plan de implementación §6.1).
declare const __COMMIT_HASH__: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_PUBLIC_APP_URL?: string
}
