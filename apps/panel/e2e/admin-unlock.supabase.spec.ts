import { expect, test, type Page } from '@playwright/test'

// F-23 against the local Supabase with supabase/seed.sql: c1's PIN is 1234. One wrong attempt
// (well under the lockout) then the right one, which resets the counter.
test.skip(!process.env.E2E_SUPABASE_ANON_KEY, 'requires the local Supabase (E2E_SUPABASE_ANON_KEY)')

async function enterPin(page: Page, pin: string) {
  for (const digit of pin) await page.getByRole('dialog').getByRole('button', { name: digit, exact: true }).click()
}

test('c1: PIN incorrecto muestra intentos, el correcto entra a Administración y Bloquear y volver a Caja regresa a Modo Caja', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('c1@ekko.test')
  await page.getByLabel('Contraseña').fill('ekko-local-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Café Ekko Centro' })).toBeVisible()

  await page.getByRole('button', { name: 'Administrar' }).click()
  await enterPin(page, '0000')
  await expect(page.getByRole('alert')).toContainText(/PIN incorrecto\. Te quedan \d+ intentos?\./)

  await enterPin(page, '1234')
  await expect(page).toHaveURL(/\/admin\/metricas$/)
  await expect(page.getByText(/Se bloquea en/)).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: /intentos? fallidos? de PIN/ })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Secciones administrativas' })).toBeVisible()

  await page.getByRole('button', { name: 'Bloquear y volver a Caja' }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/admin/menu')
  await expect(page).toHaveURL(/\/$/)
})
