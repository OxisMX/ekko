import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { ANON_KEY, rpc, rpcJson, signInCustomer, signInPanel, unlockAdmin } from './supabase-api'

// WCAG AA audit (QA plan §7.4) of every panel route against the local Supabase + supabase/seed.sql.
// Fails on serious/critical axe violations. Needs `pnpm db:reset` state: the validator-result case uses
// u4's wheel coupon at c1 (looked up, never confirmed, so reruns are safe until it expires 2 h after seeding).
test.skip(!ANON_KEY, 'requires the local Supabase (E2E_SUPABASE_ANON_KEY)')
// Reduced motion also freezes Tailwind transitions, so axe never samples a colour mid-fade.
test.use({ reducedMotion: 'reduce' })

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function expectNoSeriousViolations(page: Page, state: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(
    blocking.map((v) => `${state}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([])
}

async function goAdmin(page: Page, link: string, heading: string) {
  await page.getByRole('link', { name: link, exact: true }).click()
  await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  await expect(page.getByRole('status', { name: /^Cargando/ })).toHaveCount(0)
}

test('login: idle and error states', async ({ page }) => {
  await page.goto('/login')
  await expectNoSeriousViolations(page, 'login')
  await page.getByLabel('Correo electrónico').fill('c1@ekko.test')
  await page.getByLabel('Contraseña').fill('incorrecta')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expectNoSeriousViolations(page, 'login error')
})

test('Modo Caja: QR, validator states and PIN dialog', async ({ page }) => {
  await signInPanel(page, 'c1@ekko.test')
  await expectNoSeriousViolations(page, 'Modo Caja')

  await page.getByRole('button', { name: 'Generar QR' }).click()
  await expect(page.getByRole('img', { name: /^Código QR de visita/ })).toBeVisible()
  await expectNoSeriousViolations(page, 'Modo Caja con QR')

  const code = page.getByRole('textbox', { name: 'Código' })
  await code.fill('zzzzzz')
  await page.getByRole('button', { name: 'Validar código' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expectNoSeriousViolations(page, 'validador: código inválido')

  const jwt = await signInCustomer('u4@ekko.test')
  const wheel = (await rpcJson<{ id: string; source: string }[]>('list_my_coupons', {}, jwt)).find((c) => c.source === 'wheel')
  if (wheel) {
    const reveal = await rpc('reveal_coupon_code', { p_coupon_id: wheel.id }, jwt)
    if (reveal.ok) {
      await code.fill(((await reveal.json()) as { code: string }).code)
      await page.getByRole('button', { name: 'Validar código' }).click()
      await expect(page.getByRole('button', { name: 'Confirmar canje' })).toBeVisible()
      await expectNoSeriousViolations(page, 'validador: resultado P-03')
    }
  }

  await page.getByRole('button', { name: 'Administrar' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expectNoSeriousViolations(page, 'diálogo de PIN')
})

test('admin sections, product and offer forms', async ({ page }) => {
  await signInPanel(page, 'c1@ekko.test')
  await unlockAdmin(page)
  await expect(page.getByRole('heading', { name: 'Métricas', level: 1 })).toBeVisible()
  await expectNoSeriousViolations(page, 'admin/metricas')

  for (const [link, heading] of [
    ['Configuración de tarjeta', 'Configuración de tarjeta'],
    ['Menú', 'Menú'],
    ['Ofertas', 'Ofertas semanales'],
    ['Notificaciones', 'Notificaciones push'],
    ['Registro de QR', 'Registro de QR'],
  ] as const) {
    await goAdmin(page, link, heading)
    await expectNoSeriousViolations(page, `admin/${link}`)
  }

  await goAdmin(page, 'Notificaciones', 'Notificaciones push')
  await page.getByRole('switch', { name: 'Adjuntar cupón' }).click()
  await page.getByRole('button', { name: 'Enviar notificación' }).click()
  await expect(page.getByRole('alert').first()).toBeVisible()
  await expectNoSeriousViolations(page, 'notificaciones: cupón y errores de validación')

  await goAdmin(page, 'Menú', 'Menú')
  await page.getByRole('link', { name: 'Nuevo producto' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo producto' })).toBeVisible()
  await expectNoSeriousViolations(page, 'formulario de producto')
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await expectNoSeriousViolations(page, 'formulario de producto con errores')

  await goAdmin(page, 'Ofertas', 'Ofertas semanales')
  await page.getByRole('link', { name: 'Nueva oferta' }).click()
  await expect(page.getByRole('heading', { name: 'Nueva oferta' })).toBeVisible()
  await expectNoSeriousViolations(page, 'formulario de oferta')
})

test('comercio inactivo (P-12)', async ({ page }) => {
  await signInPanel(page, 'c3@ekko.test', null)
  await expect(page).toHaveURL(/\/inactiva$/)
  await expectNoSeriousViolations(page, 'inactiva')
})

test('teclado: el diálogo de PIN atrapa el foco, Escape lo cierra y el foco vuelve a Administrar', async ({ page }) => {
  await signInPanel(page, 'c1@ekko.test')
  const administrar = page.getByRole('button', { name: 'Administrar' })
  await administrar.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeFocused()

  for (let i = 0; i < 16; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Shift+Tab')
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(administrar).toBeFocused()
})

// Consumes u4's wheel coupon at c1 (2 h validity from the seed): skipped when it is gone.
test('teclado: Modo Caja → validar canje sin mouse', async ({ page }) => {
  const jwt = await signInCustomer('u4@ekko.test')
  const wheel = (await rpcJson<{ id: string; source: string }[]>('list_my_coupons', {}, jwt)).find((c) => c.source === 'wheel')
  test.skip(!wheel, 'u4 wheel coupon expired or used; run pnpm db:reset')
  const { code } = await rpcJson<{ code: string }>('reveal_coupon_code', { p_coupon_id: wheel!.id }, jwt)

  await signInPanel(page, 'c1@ekko.test')
  const field = page.getByRole('textbox', { name: 'Código' })
  for (let i = 0; i < 10 && !(await field.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
  await expect(field).toBeFocused()

  await page.keyboard.type(code)
  await page.keyboard.press('Enter')
  const confirm = page.getByRole('button', { name: 'Confirmar canje' })
  await expect(confirm).toBeVisible()
  for (let i = 0; i < 10 && !(await confirm.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
  await expect(confirm).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Canje registrado')).toBeVisible()
  await expect(field).toBeFocused({ timeout: 5_000 })
})
