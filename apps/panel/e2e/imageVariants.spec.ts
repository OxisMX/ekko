import { expect, test } from '@playwright/test'

const cases = [
  { kind: 'card', widths: [540, 1080], ratio: 1.586 },
  { kind: 'product', widths: [360, 720], ratio: 1 },
] as const

for (const { kind, widths, ratio } of cases) {
  test(`createImageVariants ${kind}`, async ({ page, browserName }) => {
    await page.goto('/e2e/index.html')
    const out = await page.evaluate((k) => (window as any).run(k), kind)
    console.log(`[SP-5] ${browserName} ${kind}: ${JSON.stringify(out)}`)

    expect(out).toHaveLength(2)
    out.forEach((v: any, i: number) => {
      expect(v.label).toBe(widths[i])
      expect(v.w).toBe(widths[i])
      expect(Math.abs(v.w / v.h - ratio)).toBeLessThan(0.01)
      expect(v.size).toBeLessThanOrEqual(300 * 1024)
      expect(['webp', 'jpeg']).toContain(v.format)
    })
  })
}

test('sin codificador WebP usa JPEG ≤ 300 KB', async ({ page }) => {
  await page.goto('/e2e/index.html')
  const out = await page.evaluate(() => (window as any).run('card', true))
  console.log(`[SP-5] fallback card: ${JSON.stringify(out)}`)
  out.forEach((v: any) => {
    expect(v.format).toBe('jpeg')
    expect(v.type).toBe('image/jpeg')
    expect(v.size).toBeLessThanOrEqual(300 * 1024)
  })
})

test('errores de origen se tipifican (E-22)', async ({ page }) => {
  await page.goto('/e2e/index.html')
  expect(await page.evaluate(() => (window as any).runErrors())).toEqual({
    notAnImage: 'NOT_AN_IMAGE',
    tooLarge: 'SOURCE_TOO_LARGE',
  })
})
