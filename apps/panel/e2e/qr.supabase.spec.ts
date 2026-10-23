import { expect, test } from '@playwright/test'

// US-19 / F-21 against the local Supabase with supabase/seed.sql (c1 = active merchant).
test.skip(!process.env.E2E_SUPABASE_ANON_KEY, 'requires the local Supabase (E2E_SUPABASE_ANON_KEY)')

// P-19: Modo Caja fits a 1024×768 tablet without page scroll, so the primary button is never below the fold.
test('c1 en 1024×768 ve el botón principal sin hacer scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('c1@ekko.test')
  await page.getByLabel('Contraseña').fill('ekko-local-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Café Ekko Centro' })).toBeVisible()

  const generate = page.getByRole('button', { name: 'Generar QR' })
  const box = (await generate.boundingBox())!
  expect(box.y + box.height).toBeLessThanOrEqual(768)
  await generate.click()
  const qr = page.getByRole('img', { name: /^Código QR de visita/ })
  await expect(qr).toBeVisible()
  expect((await qr.boundingBox())!.width).toBeGreaterThanOrEqual(280)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true)
})

test('c1 genera un QR con cuenta regresiva y "Generar otro" lo reemplaza', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('c1@ekko.test')
  await page.getByLabel('Contraseña').fill('ekko-local-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Café Ekko Centro' })).toBeVisible()

  await page.getByRole('button', { name: 'Generar QR' }).click()
  const qr = page.getByRole('img', { name: /^Código QR de visita, vence en \d+ segundos$/ })
  await expect(qr).toBeVisible()
  await expect(qr).toHaveAccessibleName(/vence en (60|59) segundos/)
  expect(await qr.evaluate((el) => el.tagName)).toBe('svg')
  const box = (await qr.boundingBox())!
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(280) // RT-10
  await expect(page.getByText(/^(60|59) s$/)).toBeVisible()
  const firstId = await qr.getAttribute('data-qr-id')
  expect(firstId).toMatch(/^[0-9a-f-]{36}$/)

  await page.getByRole('button', { name: 'Generar otro' }).click()
  await expect(qr).not.toHaveAttribute('data-qr-id', firstId!)
  await expect(qr).toHaveAttribute('data-qr-id', /^[0-9a-f-]{36}$/)
})
