import { expect, test, type Page } from '@playwright/test'

// Session lifecycle against the local Supabase with supabase/seed.sql (E-18, RR-3, F-20).
test.skip(!process.env.E2E_SUPABASE_ANON_KEY, 'requires the local Supabase (E2E_SUPABASE_ANON_KEY)')

const PASSWORD = 'ekko-local-123'
const EXPIRED = 'Tu sesión expiró. Inicia sesión de nuevo.'

async function signIn(page: Page, email = 'c1@ekko.test') {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Café Ekko Centro' })).toBeVisible()
}

// Rewrites the session supabase-js persisted in localStorage (key `sb-<host>-auth-token`).
async function tamperStoredSession(page: Page, patch: Record<string, unknown>) {
  await page.evaluate((patch) => {
    const key = Object.keys(localStorage).find((k) => /^sb-.+-auth-token$/.test(k))!
    localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)!), ...patch }))
  }, patch)
}

test('cerrar sesión en una pestaña manda a /login a las demás, sin aviso; volver a entrar las sincroniza', async ({
  context,
}) => {
  const tabA = await context.newPage()
  await signIn(tabA)
  const tabB = await context.newPage()
  await tabB.goto('/')
  await expect(tabB.getByRole('heading', { name: 'Café Ekko Centro' })).toBeVisible()

  await tabA.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(tabA).toHaveURL(/\/login$/)
  await expect(tabB).toHaveURL(/\/login$/)
  await expect(tabB.getByRole('alert')).toHaveCount(0)

  await signIn(tabA)
  await expect(tabB).toHaveURL(/\/$/)
  await expect(tabB.getByRole('heading', { name: 'Café Ekko Centro' })).toBeVisible()
})

// WHY: revoking via supabase.auth.admin is off-limits, so we make the stored refresh token
// unusable client-side: an expired access token forces supabase-js to refresh, the bogus
// refresh token gets a 400 from GoTrue and supabase-js emits an unsolicited SIGNED_OUT —
// exactly what a revoked/expired refresh token produces in production.
test('un refresh token rechazado lleva a /login con E-18', async ({ page }) => {
  await signIn(page)
  await tamperStoredSession(page, { refresh_token: 'revocado', expires_at: Math.floor(Date.now() / 1000) - 60 })
  // supabase-js re-reads storage and refreshes when the tab becomes visible again.
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('alert')).toHaveText(EXPIRED)
  await page.getByLabel('Correo electrónico').fill('c')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

// A forged access token with a future expiry reaches PostgREST, which answers 401 PGRST301.
test('un JWT rechazado por PostgREST lleva a /login con E-18', async ({ page }) => {
  await signIn(page)
  await tamperStoredSession(page, { access_token: 'no.es.un-jwt' })
  await page.reload()

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('alert')).toHaveText(EXPIRED)
})
