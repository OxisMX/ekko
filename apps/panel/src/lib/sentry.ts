import * as Sentry from '@sentry/react'

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: __COMMIT_HASH__,
    // WHY: @sentry/react 11 replaced `sendDefaultPii: false` with per-category `dataCollection`;
    // this is its no-PII equivalent (no user, cookies, headers, bodies — login bodies carry passwords).
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  })
}
