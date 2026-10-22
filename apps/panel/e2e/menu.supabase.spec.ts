import { expect, test, type Page } from '@playwright/test'

// F-25 against the local Supabase with supabase/seed.sql (c1, PIN 1234). Creates its own uniquely
// named category/product and deletes them at the end, so seed data is untouched and reruns are safe.
test.skip(!process.env.E2E_SUPABASE_ANON_KEY, 'requires the local Supabase (E2E_SUPABASE_ANON_KEY)')

// 16x16 solid PNG, valid for createImageBitmap and the canvas pipeline.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGNQaEggCTGMahjVMHw1AADZ+QAQYtqLRwAAAABJRU5ErkJggg==', 'base64')

async function openMenu(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('c1@ekko.test')
  await page.getByLabel('Contraseña').fill('ekko-local-123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.getByRole('button', { name: 'Administrar' }).click()
  for (const digit of '1234') await page.getByRole('dialog').getByRole('button', { name: digit, exact: true }).click()
  await page.getByRole('link', { name: 'Menú' }).click()
  await expect(page.getByRole('heading', { name: 'Menú', level: 1 })).toBeVisible()
}

test('c1: crear categoría y producto con imagen, agotar, editar y eliminar', async ({ page }) => {
  const id = `${Date.now() % 1000000}${Math.floor(Math.random() * 100)}`
  const category = `Cat E2E ${id}`
  const name = `Prod E2E ${id}`
  await openMenu(page)

  await page.getByLabel('Nueva categoría').fill(category)
  await page.getByRole('button', { name: 'Agregar categoría' }).click()
  const section = page.getByRole('region', { name: `Categoría ${category}` })
  await expect(section).toBeVisible()

  await page.getByRole('link', { name: 'Nuevo producto' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo producto' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Categoría' }).selectOption({ label: category })
  await page.getByLabel('Nombre').fill(name)
  await page.getByLabel('Descripción (opcional)').fill('Creado por la prueba E2E')
  await page.getByLabel('Precio (MXN)').fill('1234.5')
  await page.getByLabel('Elegir imagen del producto').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByAltText('Vista previa del producto')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await expect(page.getByText('Producto creado.')).toBeVisible()
  await expect(section.getByText(name)).toBeVisible()
  await expect(section.getByText('$1,234.50')).toBeVisible()
  await expect(section.locator('img')).toBeVisible()

  const soldOut = section.getByRole('switch', { name: `Agotado por hoy: ${name}` })
  await soldOut.click()
  await expect(soldOut).toHaveAttribute('aria-checked', 'true')
  await page.reload()
  if (await page.getByRole('dialog').isVisible().catch(() => false)) await openMenu(page)
  await expect(section.getByRole('switch', { name: `Agotado por hoy: ${name}` })).toHaveAttribute('aria-checked', 'true')

  await section.getByRole('link', { name: `Editar ${name}` }).click()
  await page.getByLabel('Precio (MXN)').fill('99')
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await expect(page.getByText('Producto actualizado.')).toBeVisible()
  await expect(section.getByText('$99.00')).toBeVisible()

  // A category with products cannot be deleted; then clean up in order.
  await section.getByRole('button', { name: `Eliminar categoría ${category}` }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByRole('dialog')).toContainText('Mueve o elimina sus productos primero.')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()

  await section.getByRole('button', { name: `Eliminar ${name}` }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click()
  await expect(section.getByText(name)).toBeHidden()
  await section.getByRole('button', { name: `Eliminar categoría ${category}` }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click()
  await expect(section).toBeHidden()
})
