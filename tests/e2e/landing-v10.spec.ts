import { test, expect, type Page } from '@playwright/test'

const LOCALES = ['en', 'ja', 'zh', 'ko', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'tr', 'ru', 'ar', 'th', 'vi'] as const
const url = (lc: string): string => (lc === 'en' ? '/' : `/${lc}`)

async function gotoLp(page: Page, lc: string): Promise<string[]> {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(url(lc), { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  return errors
}

for (const lc of LOCALES) {
  test(`LP ${lc}: no errors and no horizontal scroll at 390px`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const errors = await gotoLp(page, lc)
    expect(errors).toEqual([])
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test('LP en at 1489×679: the film plays in step 03 and stops after MOTION', async ({ page }) => {
  await page.setViewportSize({ width: 1489, height: 679 })
  await gotoLp(page, 'en')
  const scrollToStep = async (seg: number, f: number): Promise<void> => {
    await page.evaluate(([s, ff]) => {
      const el = document.getElementById('features')?.querySelector<HTMLElement>('[data-fpin]')
      if (!el) throw new Error('no [data-fpin]')
      const top = el.getBoundingClientRect().top + window.scrollY
      const P = s + 0.08 + 0.72 * ff
      window.scrollTo(0, top + ((P + 0.2) / 6.6) * (el.offsetHeight - window.innerHeight))
    }, [seg, f])
    await page.waitForTimeout(1400)
  }
  const film = page.locator('[data-film-card]')
  await scrollToStep(2, 0.3)
  const a = await film.screenshot()
  await page.waitForTimeout(700)
  const b = await film.screenshot()
  expect(Buffer.compare(a, b)).not.toBe(0)
  await scrollToStep(2, 0.9)
  const c = await film.screenshot()
  await page.waitForTimeout(700)
  const d = await film.screenshot()
  expect(Buffer.compare(c, d)).toBe(0)
})

test('LP reduced motion: no errors and the headline is visible immediately', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1489, height: 679 } })
  const page = await ctx.newPage()
  const errors = await gotoLp(page, 'ja')
  expect(errors).toEqual([])
  await expect(page.locator('h1')).toBeVisible()
  await ctx.close()
})

test('LP: leaving and coming back does not duplicate cards', async ({ page }) => {
  await page.setViewportSize({ width: 1489, height: 679 })
  const errors = await gotoLp(page, 'en')
  const count = (): Promise<number[]> => page.evaluate(() =>
    ['[data-hero-board]', '[data-problem-board]', '[data-features-board]'].map((sel) => document.querySelectorAll(`${sel} .card`).length))
  const first = await count()
  expect(first).toEqual([14, 8, 10])
  await page.locator('header a[href*="features"]').first().click()
  await page.waitForLoadState('networkidle')
  await page.goBack()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)
  expect(await count()).toEqual(first)
  expect(errors).toEqual([])
})

test('LP: resizing keeps the features demo valid', async ({ page }) => {
  await page.setViewportSize({ width: 1489, height: 679 })
  const errors = await gotoLp(page, 'en')
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-fpin]')
    if (!el) throw new Error('no [data-fpin]')
    const top = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo(0, top + ((3 + 0.08 + 0.72 * 0.45 + 0.2) / 6.6) * (el.offsetHeight - window.innerHeight))
  })
  await page.waitForTimeout(1200)
  for (const w of [390, 1489]) {
    await page.setViewportSize({ width: w, height: w === 390 ? 844 : 679 })
    await page.waitForTimeout(900)
    const tf = await page.locator('[data-fcur]').evaluate((el) => (el as HTMLElement).style.transform)
    expect(tf).not.toContain('NaN')
  }
  expect(errors).toEqual([])
})

test('LP links: the finale badge and button open the board', async ({ page }) => {
  await gotoLp(page, 'en')
  const hrefs = await page.locator('[data-finale-cta] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
  expect(hrefs.length).toBeGreaterThan(0)
  for (const h of hrefs) expect(h).toBe('/board')
})
