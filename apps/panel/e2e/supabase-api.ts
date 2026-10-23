import { createHash } from 'node:crypto'
import { expect, type Page } from '@playwright/test'

// Customer-side helpers for E2E specs against the local Supabase: the panel is driven through the UI,
// the customer app is replaced by the same REST calls the mobile app makes (anon key + customer JWT).
export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321'
export const ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY ?? ''
export const PASSWORD = 'ekko-local-123'

// WHY cached: GoTrue limits sign-ins to 30 per 5 min per IP (supabase/config.toml) and the whole suite
// shares one IP; a JWT lives 1 h, far longer than a run. Cached per worker process.
const jwtCache = new Map<string, string>()

export async function signInCustomer(email: string): Promise<string> {
  const cached = jwtCache.get(email)
  if (cached) return cached
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  expect(res.ok, `sign in ${email}`).toBe(true)
  const { access_token } = (await res.json()) as { access_token: string }
  jwtCache.set(email, access_token)
  return access_token
}

export function rpc(fn: string, args: object, jwt: string) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
}

export async function rpcJson<T>(fn: string, args: object, jwt: string): Promise<T> {
  const res = await rpc(fn, args, jwt)
  const body = await res.json()
  expect(res.ok, `${fn}: ${JSON.stringify(body)}`).toBe(true)
  return body as T
}

export async function claimVisit(jwt: string, email: string, token: string) {
  const digest = createHash('sha256').update(`e2e-device-${email}`).digest('hex')
  await rpcJson('register_device', { p_device_id_digest: digest, p_platform: 'ios' }, jwt)
  return rpc('claim_visit', { p_token: token, p_device_id_digest: digest }, jwt)
}

export async function signInPanel(page: Page, email: string, heading: string | null = 'Café Ekko Centro') {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  if (heading) await expect(page.getByRole('heading', { name: heading })).toBeVisible()
}

export async function enterPin(page: Page, pin: string) {
  for (const digit of pin) await page.getByRole('dialog').getByRole('button', { name: digit, exact: true }).click()
}

export async function unlockAdmin(page: Page, pin = '1234') {
  await page.getByRole('button', { name: 'Administrar' }).click()
  await enterPin(page, pin)
  await expect(page).toHaveURL(/\/admin\//)
}
