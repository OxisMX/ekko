import { expect, test, type Page } from '@playwright/test'

// F-28 / P-05 / P-11 against the local Supabase with supabase/seed.sql (c1, PIN 1234).
test.skip(!process.env.E2E_SUPABASE_ANON_KEY, 'requires the local Supabase (E2E_SUPABASE_ANON_KEY)')

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('c1@ekko.test')
  await page.getByLabel('Contraseña').fill('ekko-local-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Café Ekko Centro' })).toBeVisible()
}

async function openAdmin(page: Page) {
  await page.getByRole('button', { name: 'Administrar' }).click()
  for (const digit of '1234') await page.getByRole('dialog').getByRole('button', { name: digit, exact: true }).click()
}

test('c1: métricas con filtro de periodo', async ({ page }) => {
  await login(page)
  await openAdmin(page)
  await expect(page.getByRole('heading', { name: 'Métricas', level: 1 })).toBeVisible()
  await expect(page.getByText('Cupones canjeados')).toBeVisible()
  await expect(page.getByText('últimos 30 días', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Notificaciones restantes este mes: \d de 5/ })).toBeVisible()

  await page.getByRole('radio', { name: 'Histórico' }).click()
  await expect(page.getByRole('radio', { name: 'Histórico' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('Visitas', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toBeHidden()
})

test('c1: un QR generado aparece como Vigente en el registro', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: 'Generar QR' }).click()
  await expect(page.getByRole('img', { name: /^Código QR de visita/ })).toBeVisible()

  await openAdmin(page)
  await page.getByRole('link', { name: 'Registro de QR', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Registro de QR', level: 1 })).toBeVisible()
  await expect(page.getByText('Vigente').first()).toBeVisible()
})
