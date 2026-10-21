import { expect, test, type Page } from '@playwright/test'

// Runs against the local Supabase with supabase/seed.sql (F-20, F-28, TC-009).
// E2E_SUPABASE_ANON_KEY=$(pnpm -s supabase status -o json | jq -r .ANON_KEY) pnpm --filter @ekko/panel test:e2e
test.skip(!process.env.E2E_SUPABASE_ANON_KEY, 'requires the local Supabase (E2E_SUPABASE_ANON_KEY)')

const PASSWORD = 'ekko-local-123'

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test('comercio activo entra a Modo Caja y puede cerrar sesión', async ({ page }) => {
  await signIn(page, 'c1@ekko.test')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Café Ekko Centro' })).toBeVisible()

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('comercio inactivo ve P-12', async ({ page }) => {
  await signIn(page, 'c3@ekko.test')
  await expect(page).toHaveURL(/\/inactiva$/)
  await expect(page.getByText('Tu suscripción no está activa. Contacta a Oxis para reactivarla.')).toBeVisible()
})

test('cuenta de cliente es rechazada con E-19', async ({ page }) => {
  await signIn(page, 'u1@ekko.test')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Esta cuenta no corresponde a esta aplicación.')).toBeVisible()
})

test('credenciales inválidas muestran un mensaje genérico', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('c1@ekko.test')
  await page.getByLabel('Contraseña').fill('incorrecta')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible()
})
