import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

// TC-053 / TC-054 (F-21, RN-21) against the local Supabase with supabase/seed.sql: c1 shows a QR,
// a customer claims it over REST (as the app would), and the panel confirms "Visita registrada".
// RN-17 allows one stamp per customer, merchant and day: each test uses its own customer, so a
// second run on the same day needs `supabase db reset` (the claim then fails with E-04 → skip).
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

function rpc(fn: string, args: object, jwt?: string) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt ?? ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
}

// PostgREST answers PGRST202 for a function that is not in the schema (backend S5 still pending).
async function rpcExists(fn: string, args: object, jwt: string) {
  const res = await rpc(fn, args, jwt)
  return !(res.status === 404 && ((await res.json()) as { code?: string }).code === 'PGRST202')
}

async function generateQr(page: Page): Promise<string> {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('c1@ekko.test')
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Café Ekko Centro' })).toBeVisible()

  const response = page.waitForResponse((r) => r.url().endsWith('/rpc/generate_visit_qr'))
  await page.getByRole('button', { name: 'Generar QR' }).click()
  const { token, qr_id } = (await (await response).json()) as { token: string; qr_id: string }
  await expect(page.getByRole('img', { name: /^Código QR de visita/ })).toHaveAttribute('data-qr-id', qr_id)
  return token
}

async function claimAs(email: string, token: string) {
  const jwt = await signInCustomer(email)
  const digest = createHash('sha256').update(`e2e-device-${email}`).digest('hex')
  const device = await rpc('register_device', { p_device_id_digest: digest, p_platform: 'ios' }, jwt)
  expect(device.ok, 'register_device').toBe(true)
  const res = await rpc('claim_visit', { p_token: token, p_device_id_digest: digest }, jwt)
  const body = (await res.json()) as { message?: string }
  test.skip(body.message === 'E-04', `${email} already has today's C1 stamp; run supabase db reset to rerun`)
  expect(res.ok, `claim_visit: ${JSON.stringify(body)}`).toBe(true)
}

async function expectConfirmedThenReady(page: Page, withinMs: number) {
  const confirmation = page.getByText('Visita registrada', { exact: true }).and(page.locator(':not([aria-live])'))
  await expect(confirmation).toBeVisible({ timeout: withinMs })
  await expect(page.locator('[aria-live="polite"]')).toHaveText(/^Visita registrada/)
  await expect(page.getByRole('img', { name: /^Código QR de visita/ })).toHaveCount(0)
  // P-02: the confirmation lasts 3 s, then the panel is ready for the next customer.
  await expect(page.getByRole('button', { name: 'Generar QR' })).toBeVisible({ timeout: 5_000 })
  await expect(confirmation).toHaveCount(0)
}

test.beforeAll(async () => {
  const jwt = await signInCustomer('u1@ekko.test')
  test.skip(
    !(await rpcExists('claim_visit', { p_token: 'x', p_device_id_digest: 'x' }, jwt)),
    'claim_visit is not in the database yet',
  )
})

test('TC-053: the scan reaches the panel through Realtime in under 2 s', async ({ page }) => {
  const token = await generateQr(page)
  await page.waitForTimeout(1_000) // let the channel reach SUBSCRIBED so Realtime, not polling, confirms
  await claimAs('u1@ekko.test', token)
  await expectConfirmedThenReady(page, 2_000)
})

test('TC-054: with Realtime unreachable the panel confirms through get_qr_status polling', async ({ page }) => {
  const jwt = await signInCustomer('u3@ekko.test')
  test.skip(!(await rpcExists('get_qr_status', { p_qr_id: crypto.randomUUID() }, jwt)), 'get_qr_status is not in the database yet')
  await page.routeWebSocket(/\/realtime\//, (ws) => ws.close())

  const token = await generateQr(page)
  await claimAs('u3@ekko.test', token)
  // 3 s without SUBSCRIBED + at most one 3 s poll interval.
  await expectConfirmedThenReady(page, 7_000)
})
