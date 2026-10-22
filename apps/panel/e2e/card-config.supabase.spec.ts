import { expect, test, type Page } from '@playwright/test'

// F-24 against the local Supabase with supabase/seed.sql (c1, PIN 1234): change the reward,
// confirm (RN-29), reload and see it persisted. Restores the original title at the end.
test.skip(!process.env.E2E_SUPABASE_ANON_KEY, 'requires the local Supabase (E2E_SUPABASE_ANON_KEY)')

async function openCardConfig(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('c1@ekko.test')
  await page.getByLabel('Contraseña').fill('ekko-local-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.getByRole('button', { name: 'Administrar' }).click()
  for (const digit of '1234') await page.getByRole('dialog').getByRole('button', { name: digit, exact: true }).click()
  await page.getByRole('link', { name: 'Configuración de tarjeta' }).click()
  await expect(page.getByLabel('Título del premio')).toBeVisible()
}

async function changeTitle(page: Page, title: string) {
  await page.getByLabel('Título del premio').fill(title)
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('dialog')).toContainText('Los cambios aplicarán a las tarjetas nuevas')
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText(/Cambios guardados/)).toBeVisible()
}

test('c1: cambiar el premio, confirmar, recargar y persiste', async ({ page }) => {
  await openCardConfig(page)
  const original = await page.getByLabel('Título del premio').inputValue()
  const title = `Premio E2E ${Date.now() % 100000}`
  await changeTitle(page, title)

  await page.reload()
  // A reload keeps the session but locks the admin window only if it lapsed; unlock again if asked.
  if (await page.getByRole('dialog').isVisible().catch(() => false)) await openCardConfig(page)
  await expect(page.getByLabel('Título del premio')).toHaveValue(title)

  await changeTitle(page, original)
})
