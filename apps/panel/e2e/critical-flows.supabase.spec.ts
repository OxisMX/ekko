import { expect, test } from '@playwright/test'
import { ANON_KEY, claimVisit, enterPin, rpc, rpcJson, signInCustomer, signInPanel, unlockAdmin } from './supabase-api'

// Critical flows of docs/ekko_plan_qa.md §5 (panel side) against the local Supabase + supabase/seed.sql.
// State assumptions: run `pnpm db:reset` first. Each flow consumes seed state that cannot be undone
// (u2's first stamp, c2's PIN lockout, 1 of c1's 5 monthly pushes, u4's C3 coupon) and skips with a
// reason when a rerun finds it already consumed. Serial: the flows share c1/c2 quotas.
test.skip(!ANON_KEY, 'requires the local Supabase (E2E_SUPABASE_ANON_KEY)')
test.describe.configure({ mode: 'serial' })

type Card = { merchant_id: string; merchant_name: string; stamps_count: number; merchant_available: boolean }
type Coupon = { id: string; merchant_name: string; source: string; title: string }

test('E2E-01: u2 (no relations) is stamped at c1 and the card shows up in list_my_cards', async ({ page }) => {
  const jwt = await signInCustomer('u2@ekko.test')
  const before = await rpcJson<Card[] | null>('list_my_cards', {}, jwt)
  test.skip(!!before?.some((c) => c.merchant_name === 'Café Ekko Centro'), 'u2 already stamped; run pnpm db:reset')

  await signInPanel(page, 'c1@ekko.test')
  const generated = page.waitForResponse((r) => r.url().endsWith('/rpc/generate_visit_qr'))
  await page.getByRole('button', { name: 'Generar QR' }).click()
  const { token } = (await (await generated).json()) as { token: string }
  await expect(page.getByRole('img', { name: /^Código QR de visita/ })).toBeVisible()
  await page.waitForTimeout(1_000) // let Realtime reach SUBSCRIBED

  const claim = await claimVisit(jwt, 'u2@ekko.test', token)
  expect(claim.ok, JSON.stringify(await claim.clone().json())).toBe(true)
  await expect(page.getByText('Visita registrada', { exact: true }).and(page.locator(':not([aria-live])'))).toBeVisible({ timeout: 5_000 })

  const cards = await rpcJson<Card[]>('list_my_cards', {}, jwt)
  expect(cards.find((c) => c.merchant_name === 'Café Ekko Centro')?.stamps_count).toBe(1)
})

test('E2E-05: c1 sends a push with coupon and u1 sees the coupon in list_my_coupons', async ({ page }) => {
  const title = `Cupón E2E ${Date.now() % 1000000}`
  await signInPanel(page, 'c1@ekko.test')
  await unlockAdmin(page)
  await page.getByRole('link', { name: 'Notificaciones', exact: true }).click()
  const quota = page.getByText(/Te quedan \d de 5 envíos este mes/)
  await expect(quota).toBeVisible()
  test.skip(/Te quedan 0 /.test((await quota.textContent()) ?? ''), 'c1 monthly push quota used; run pnpm db:reset')

  await page.getByLabel('Título').fill('Aviso con cupón')
  await page.getByLabel('Mensaje').fill('Pasa por tu beneficio')
  await page.getByRole('switch', { name: 'Adjuntar cupón' }).click()
  await page.getByLabel('Beneficio').fill(title)
  await page.getByLabel('Restricciones').fill('Una por cliente')
  await page.getByLabel('Términos').fill('Válido en sucursal')
  await page.getByLabel('Vigencia del cupón').selectOption('24')
  await page.getByRole('button', { name: 'Enviar notificación' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar ahora' }).click()
  await expect(page.getByText(/Enviada a \d+ clientes/)).toBeVisible()

  const coupons = await rpcJson<Coupon[]>('list_my_coupons', {}, await signInCustomer('u1@ekko.test'))
  expect(coupons.some((c) => c.source === 'push' && c.title === title && c.merchant_name === 'Café Ekko Centro')).toBe(true)
})

test('E2E-06 / TC-142: 5 wrong PINs lock c2 for 15 minutes and the dialog returns to Modo Caja', async ({ page }) => {
  // c2 is used only here: the lockout (15 min, persisted server side) would break the other specs on c1.
  await signInPanel(page, 'c2@ekko.test', 'Barbería Ekko')
  await page.getByRole('button', { name: 'Administrar' }).click()
  const dialog = page.getByRole('dialog')
  for (let attempt = 0; attempt < 5 && !(await dialog.getByText(/Podrás intentar de nuevo en/).isVisible()); attempt++) {
    await enterPin(page, '0000')
    await expect(dialog.getByRole('alert')).toBeVisible()
  }
  await expect(dialog.getByRole('alert')).toContainText('Podrás intentar de nuevo en 1')
  await expect(dialog.getByRole('button', { name: '1', exact: true })).toBeDisabled()

  await dialog.getByRole('button', { name: 'Volver a Modo Caja' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Barbería Ekko' })).toBeVisible()
})

test('E2E-07: a product marked sold out in the panel is sold out in get_merchant_detail', async ({ page }) => {
  const name = `Prod Agotado ${Date.now() % 1000000}`
  await signInPanel(page, 'c1@ekko.test')
  await unlockAdmin(page)
  await page.getByRole('link', { name: 'Menú' }).click()
  await page.getByRole('link', { name: 'Nuevo producto' }).click()
  await page.getByRole('combobox', { name: 'Categoría' }).selectOption({ index: 1 })
  await page.getByLabel('Nombre').fill(name)
  await page.getByLabel('Precio (MXN)').fill('50')
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await expect(page.getByText('Producto creado.')).toBeVisible()
  const soldOut = page.getByRole('switch', { name: `Agotado por hoy: ${name}` })
  // WHY wait for the RPC: the switch flips optimistically before the server has saved the flag.
  const saved = page.waitForResponse((r) => r.url().includes('/rpc/set_product_flags') && r.ok())
  await soldOut.click()
  await saved
  await expect(soldOut).toHaveAttribute('aria-checked', 'true')

  const jwt = await signInCustomer('u1@ekko.test')
  const detail = await rpcJson<{ menu: { products: { name: string; is_sold_out: boolean }[] } }>(
    'get_merchant_detail',
    { p_merchant_id: '20000000-0000-0000-0000-0000000000c1' },
    jwt,
  )
  expect(detail.menu.products.find((p) => p.name === name)?.is_sold_out).toBe(true)

  await page.getByRole('button', { name: `Eliminar ${name}` }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click()
  await expect(soldOut).toHaveCount(0)
})

test.describe('E2E-08 / TC-180..182: inactive merchant c3', () => {
  test('the customer card is "No disponible" and QR and menu writes are rejected with E-05', async () => {
    const cards = await rpcJson<Card[]>('list_my_cards', {}, await signInCustomer('u4@ekko.test'))
    expect(cards.find((c) => c.merchant_name === 'Tacos Ekko (inactivo)')?.merchant_available).toBe(false)

    // unlock_admin is allowed while inactive by design (supabase/tests/24_qa_gaps.test.sql); writes are not.
    const c3 = await signInCustomer('c3@ekko.test')
    expect((await rpc('unlock_admin', { p_pin: '1234' }, c3)).ok).toBe(true)
    for (const [fn, args] of [['generate_visit_qr', {}], ['upsert_menu_category', { p_name: 'Nueva' }]] as const) {
      const res = await rpc(fn, args, c3)
      expect(res.ok, fn).toBe(false)
      expect(((await res.json()) as { message?: string }).message, fn).toBe('E-05')
    }
  })

  test('the panel still validates a coupon the customer already holds', async ({ page }) => {
    const jwt = await signInCustomer('u4@ekko.test')
    const coupon = (await rpcJson<Coupon[]>('list_my_coupons', {}, jwt)).find((c) => c.merchant_name === 'Tacos Ekko (inactivo)')
    test.skip(!coupon, 'u4 C3 coupon already redeemed; run pnpm db:reset')
    const { code } = await rpcJson<{ code: string }>('reveal_coupon_code', { p_coupon_id: coupon!.id }, jwt)

    await signInPanel(page, 'c3@ekko.test', null)
    await expect(page).toHaveURL(/\/inactiva$/)
    await page.getByRole('textbox', { name: 'Código' }).fill(code)
    await page.getByRole('button', { name: 'Validar código' }).click()
    await page.getByRole('button', { name: 'Confirmar canje' }).click()
    await expect(page.getByText('Canje registrado')).toBeVisible()
  })
})
