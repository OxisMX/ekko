import { expect, test } from '@playwright/test'

// Admin sections stay out of reach until the PIN exists (S8): admin_unlocked_until is null.
test.skip(!process.env.E2E_SUPABASE_ANON_KEY, 'requires the local Supabase (E2E_SUPABASE_ANON_KEY)')

test('c1 no puede abrir /admin/menu sin desbloqueo: vuelve a Modo Caja', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('c1@ekko.test')
  await page.getByLabel('Contraseña').fill('ekko-local-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Café Ekko Centro' })).toBeVisible()

  await page.goto('/admin/menu')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Café Ekko Centro' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Secciones administrativas' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Administrar/ })).toHaveAttribute('aria-disabled', 'true')
})
