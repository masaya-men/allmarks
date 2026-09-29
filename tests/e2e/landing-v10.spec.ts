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
  // R28: film.screenshot() scrolls the element into view first, which moves
  // this pinned/scroll-jacked section off the position scrollToStep just
  // set. Measure the card's box once per pair (no scrolling) and clip a
  // plain page screenshot to it instead, so both shots of a pair are read
  // from the exact same screen region at the scroll position we intended.
  const shotPair = async (): Promise<[Buffer, Buffer]> => {
    const box = await film.boundingBox()
    if (!box) throw new Error('[data-film-card] has no bounding box (not visible?)')
    const first = await page.screenshot({ clip: box })
    await page.waitForTimeout(700)
    const second = await page.screenshot({ clip: box })
    return [first, second]
  }
  await scrollToStep(2, 0.3)
  const [a, b] = await shotPair()
  expect(Buffer.compare(a, b)).not.toBe(0)
  await scrollToStep(2, 0.9)
  const [c, d] = await shotPair()
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
  // R28: waitForLoadState('networkidle') right after click() can resolve on
  // the *old* document before the async client-side route transition to
  // /features even starts, so goBack() could fire while still on '/' and
  // land on about:blank instead. Wait for the URL itself to change instead,
  // both ways, then poll the counts until the remounted LP has repopulated
  // its boards rather than trusting one read after a fixed delay.
  await Promise.all([
    page.waitForURL(/\/features/),
    page.locator('header a[href*="features"]').first().click(),
  ])
  await page.goBack()
  await page.waitForURL(url('en'))
  await expect.poll(count, { timeout: 10_000 }).toEqual(first)
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
