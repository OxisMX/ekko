import { expect, test, type Page } from '@playwright/test'

// F-26 / F-27 against the local Supabase with supabase/seed.sql (c1, PIN 1234).
// The push test CONSUMES 1 of the 5 monthly sends of c1 on every run: run `pnpm db:reset` before this
// suite, and serve the Edge Function (`supabase start` with edge-runtime, or `pnpm supabase functions serve`).
test.skip(!process.env.E2E_SUPABASE_ANON_KEY, 'requires the local Supabase (E2E_SUPABASE_ANON_KEY)')

// 16x16 solid PNG, valid for createImageBitmap and the canvas pipeline.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGNQaEggCTGMahjVMHw1AADZ+QAQYtqLRwAAAABJRU5ErkJggg==', 'base64')

async function openSection(page: Page, name: 'Ofertas' | 'Notificaciones', heading: string) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('c1@ekko.test')
  await page.getByLabel('Contraseña').fill('ekko-local-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.getByRole('button', { name: 'Administrar' }).click()
  for (const digit of '1234') await page.getByRole('dialog').getByRole('button', { name: digit, exact: true }).click()
  await page.getByRole('link', { name, exact: true }).click()
  await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
}

test('c1: crear oferta con imagen, editar y eliminar', async ({ page }) => {
  const id = `${Date.now() % 1000000}${Math.floor(Math.random() * 100)}`
  const title = `Oferta E2E ${id}`
  await openSection(page, 'Ofertas', 'Ofertas semanales')

  await page.getByRole('link', { name: 'Nueva oferta' }).click()
  await expect(page.getByRole('heading', { name: 'Nueva oferta' })).toBeVisible()
  await page.getByLabel('Título').fill(title)
  await page.getByLabel('Descripción').fill('Creada por la prueba E2E')
  await page.getByRole('button', { name: 'Jueves' }).click()
  await page.getByLabel('Elegir imagen de la oferta').setInputFiles({ name: 'o.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByAltText('Vista previa de la oferta')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar oferta' }).click()
  await expect(page.getByText('Oferta creada.')).toBeVisible()
  const day = page.getByRole('region', { name: 'Jueves' })
  await expect(day.getByText(title)).toBeVisible()
  await expect(day.locator('img')).toBeVisible()

  await day.getByRole('link', { name: `Editar ${title}` }).click()
  await page.getByLabel('Descripción').fill('Editada')
  await page.getByRole('button', { name: 'Guardar oferta' }).click()
  await expect(page.getByText('Oferta actualizada.')).toBeVisible()
  await expect(day.getByText('Editada')).toBeVisible()

  await day.getByRole('button', { name: `Eliminar ${title}` }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click()
  await expect(day.getByText(title)).toBeHidden()
})

test('c1: enviar una notificación sin cupón y verla en el historial', async ({ page }) => {
  const title = `Aviso E2E ${Date.now() % 1000000}`
  await openSection(page, 'Notificaciones', 'Notificaciones push')
  await expect(page.getByText(/Te quedan \d de 5 envíos este mes/)).toBeVisible()

  await page.getByLabel('Título').fill(title)
  await page.getByLabel('Mensaje').fill('Mensaje de la prueba E2E')
  await page.getByRole('button', { name: 'Enviar notificación' }).click()
  await expect(page.getByRole('dialog')).toContainText(/Se enviará a \d+ clientes\. Te quedarán \d de 5\./)
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar ahora' }).click()

  // Seed devices have fake or no tokens, so delivered/failed counts vary.
  await expect(page.getByText(/Enviada a \d+ clientes: \d+ entregadas, \d+ fallidas\./)).toBeVisible()
  const row = page.getByRole('listitem').filter({ hasText: title })
  await expect(row).toBeVisible()
  await expect(row).not.toContainText('Con cupón')
})
