import { expect, test, type Page } from '@playwright/test'

// W-01 (TRD §9, F-09): static page for /v/<token>, no backend, no React bundle.

async function expectW01(page: Page) {
  await expect(page.getByRole('banner').getByText('Ekko Rewards')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Descarga la app para sumar tu visita')
  await expect(page.getByText(/este vence en 60 segundos/)).toBeVisible()
  for (const name of ['Muy pronto en App Store', 'Muy pronto en Google Play']) {
    const store = page.getByRole('link', { name })
    await expect(store).toBeVisible()
    await expect(store).toHaveAttribute('aria-disabled', 'true')
    await expect(store).toHaveAttribute('href', '#')
  }
}

test('/v/<token> muestra W-01 estática, no la app de React', async ({ page }) => {
  const scripts: string[] = []
  page.on('request', (req) => {
    if (req.resourceType() === 'script') scripts.push(req.url())
  })
  const response = await page.goto('/v/abc123')
  expect(response?.status()).toBe(200)
  await expectW01(page)
  await expect(page.locator('#root')).toHaveCount(0)
  expect(scripts).toEqual([])
  await expect(page).toHaveURL(/\/v\/abc123$/)
})

test('W-01 funciona con JavaScript desactivado', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/v/abc123')
  await expectW01(page)
  await context.close()
})

// Basic a11y without axe: landmarks, heading order, image alts, names and target size.
test('W-01 pasa una revisión básica de accesibilidad', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/v/abc123')
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  await expect(page.getByRole('main')).toHaveCount(1)
  await expect(page.getByRole('banner')).toHaveCount(1)

  const audit = await page.evaluate(() => {
    const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]))
    const imgsWithoutAlt = [...document.querySelectorAll('img:not([alt])')].length
    const svgsExposed = [...document.querySelectorAll('svg:not([aria-hidden="true"])')].filter((s) => !s.getAttribute('aria-label')).length
    const controls = [...document.querySelectorAll('a,button')] as HTMLElement[]
    return {
      levels,
      imgsWithoutAlt,
      svgsExposed,
      unnamed: controls.filter((c) => !c.textContent?.trim() && !c.getAttribute('aria-label')).length,
      small: controls.map((c) => c.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length,
      hScroll: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
  expect(audit.levels[0]).toBe(1)
  audit.levels.forEach((level, i) => i > 0 && expect(level - audit.levels[i - 1]!).toBeLessThanOrEqual(1))
  expect(audit).toMatchObject({ imgsWithoutAlt: 0, svgsExposed: 0, unnamed: 0, small: 0, hScroll: false })
})
