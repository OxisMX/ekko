import { expect, test, type Page } from '@playwright/test'

// F-22 (US-24) and the panel half of E2E-03 (the N-1 → N stamp is covered by DB tests: RN-17 allows one
// stamp per day, so the seed already holds u4's closed cycle) against the local Supabase with supabase/seed.sql: u4 holds an active C1 reward
// coupon; its code (reveal_coupon_code, as the app does) is validated and confirmed by c1 in the panel.
// A coupon is single use: a second run on the same database needs `pnpm db:reset` (the reveal
// then fails with E-11 → skip).
test.skip(!process.env.E2E_SUPABASE_ANON_KEY, 'requires the local Supabase (E2E_SUPABASE_ANON_KEY)')

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY ?? ''
const PASSWORD = 'ekko-local-123'

async function signInCustomer(email: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  expect(res.ok, `sign in ${email}`).toBe(true)
  return ((await res.json()) as { access_token: string }).access_token
}

function rpc(fn: string, args: object, jwt: string) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
}

async function revealU4CardRewardCode(): Promise<{ code: string; title: string; couponId: string }> {
  const jwt = await signInCustomer('u4@ekko.test')
  const list = await rpc('list_my_coupons', {}, jwt)
  test.skip(list.status === 404, 'list_my_coupons is not in the database yet')
  const coupons = (await list.json()) as { id: string; merchant_name: string; source: string; title: string }[]
  const coupon = coupons.find((c) => c.merchant_name === 'Café Ekko Centro' && c.source === 'card_reward')
  test.skip(!coupon, 'u4 has no active C1 reward coupon; run pnpm db:reset to rerun')
  const reveal = await rpc('reveal_coupon_code', { p_coupon_id: coupon!.id }, jwt)
  expect(reveal.ok, 'reveal_coupon_code').toBe(true)
  return { code: ((await reveal.json()) as { code: string }).code, title: coupon!.title, couponId: coupon!.id }
}

async function signInPanel(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('c1@ekko.test')
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Café Ekko Centro' })).toBeVisible()
}

test('validates a real code, shows P-03 and confirms the redemption', async ({ page }) => {
  const { code, title, couponId } = await revealU4CardRewardCode()
  await signInPanel(page)

  await page.getByRole('textbox', { name: 'Código' }).fill(code.toLowerCase())
  await page.getByRole('button', { name: 'Validar código' }).click()
  await expect(page.getByText(title, { exact: true })).toBeVisible()
  await expect(page.getByText('Premio de tarjeta')).toBeVisible()

  await page.getByRole('button', { name: 'Confirmar canje' }).click()
  await expect(page.getByText('Canje registrado')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Código' })).toBeFocused({ timeout: 5_000 })
  await expect(page.getByRole('textbox', { name: 'Código' })).toHaveValue('')

  // E2E-03 (customer side): the redemption shows up in the customer's history.
  const history = await rpc('list_my_redemptions', {}, await signInCustomer('u4@ekko.test'))
  expect(((await history.json()) as { coupon_id: string }[]).map((r) => r.coupon_id)).toContain(couponId)
})

test('an unknown code shows the remaining attempts', async ({ page }) => {
  test.skip(
    (await rpc('lookup_redemption', { p_code: 'AAAAAA' }, ANON_KEY)).status === 404,
    'lookup_redemption is not in the database yet',
  )
  await signInPanel(page)
  await page.getByRole('textbox', { name: 'Código' }).fill('zzzzzz')
  await page.getByRole('button', { name: 'Validar código' }).click()
  await expect(page.getByRole('alert')).toContainText(/Código no válido\. Te (queda 1 intento|quedan \d+ intentos)/)
})
