import { expect, test } from '@playwright/test'

test('P-01 renders and validates the form client-side', async ({ page }) => {
  let authCalls = 0
  page.on('request', (req) => {
    if (req.url().includes('/auth/v1/')) authCalls++
  })

  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
  await expect(page.getByText('¿Olvidaste tu contraseña? Contacta a Oxis.')).toBeVisible()

  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Ingresa tu correo.')).toBeVisible()
  await expect(page.getByText('Ingresa tu contraseña.')).toBeVisible()

  await page.getByLabel('Correo electrónico').fill('no-es-correo')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Ingresa un correo válido.')).toBeVisible()
  expect(authCalls).toBe(0)
})
