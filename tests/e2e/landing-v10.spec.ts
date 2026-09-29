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

/** I1/C2: every `.ml > span` headline band (hero H1 + finale H2) must wrap
 *  instead of overflowing its own band's width (R33's `text-wrap: balance` /
 *  `word-break: auto-phrase` fallback replacing `white-space: nowrap`).
 *  Returns a description of each violation; empty when every band fits. */
async function headlineOverflows(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bad: string[] = []
    document.querySelectorAll<HTMLElement>('.ml > span').forEach((span, i) => {
      const parent = span.parentElement
      if (!parent) return
      if (span.scrollWidth > parent.clientWidth + 1) {
        bad.push(`#${i}: scrollWidth=${span.scrollWidth} clientWidth=${parent.clientWidth}`)
      }
    })
    return bad
  })
}

/** I1/C1: once the intro has settled (or been skipped), every hero headline
 *  span must sit flush with its own band — no leftover GSAP-parsed pixel
 *  offset from the CSS pre-state (R31) — and the header must be pinned at
 *  the very top of the viewport. */
async function headlineAligned(page: Page): Promise<{ maxOffset: number; headerTop: number }> {
  return page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll<HTMLElement>('h1 .ml > span'))
    const offsets = spans.map((span) => {
      const parent = span.parentElement as HTMLElement
      return Math.abs(span.getBoundingClientRect().top - parent.getBoundingClientRect().top)
    })
    const header = document.querySelector<HTMLElement>('.lpRoot.lpHome > header')
    return {
      maxOffset: offsets.length > 0 ? Math.max(...offsets) : NaN,
      headerTop: header ? header.getBoundingClientRect().top : NaN,
    }
  })
}

for (const lc of LOCALES) {
  test(`LP ${lc}: no errors and no horizontal scroll at 390px`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const errors = await gotoLp(page, lc)
    expect(errors).toEqual([])
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)

    // I1/C2: headline bands must never clip. Check at this size, then again
    // at desktop breakpoints after a resize + re-layout settle.
    expect(await headlineOverflows(page)).toEqual([])
    for (const [w, h] of [[1489, 679], [1920, 1080]] as const) {
      await page.setViewportSize({ width: w, height: h })
      await page.waitForTimeout(600)
      expect(await headlineOverflows(page)).toEqual([])
    }
  })
}

for (const lc of ['en', 'de'] as const) {
  test(`LP ${lc} at 1489×679: headline visible after the intro (normal motion)`, async ({ page }) => {
    await page.setViewportSize({ width: 1489, height: 679 })
    await gotoLp(page, lc)
    await page.waitForTimeout(2600)
    const { maxOffset, headerTop } = await headlineAligned(page)
    expect(maxOffset).toBeLessThanOrEqual(1)
    expect(Math.abs(headerTop)).toBeLessThanOrEqual(1)
  })
}

test('LP en at 1489×679: headline visible after the intro (skip path)', async ({ page }) => {
  await page.setViewportSize({ width: 1489, height: 679 })
  await gotoLp(page, 'en')
  // Dispatch a wheel event right after load to trigger the intro's skip
  // handler (progress(1)), then scroll back to 0 so the hero is still the
  // section in view for the assertions below.
  await page.mouse.wheel(0, 1)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
  const { maxOffset, headerTop } = await headlineAligned(page)
  expect(maxOffset).toBeLessThanOrEqual(1)
  expect(Math.abs(headerTop)).toBeLessThanOrEqual(1)
})

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

/** s224: the hero must clear the fixed SiteHeader. Measured once the intro has
 *  settled: the top-left crop mark and (desktop) the SCROLL row, in viewport px. */
async function heroClearance(page: Page): Promise<{
  vh: number
  headerBottom: number
  cropTop: number
  labelTop: number
  hruleBottom: number
}> {
  return page.evaluate(() => {
    const top = (sel: string): number => document.querySelector<HTMLElement>(sel)?.getBoundingClientRect().top ?? NaN
    const bottom = (sel: string): number => document.querySelector<HTMLElement>(sel)?.getBoundingClientRect().bottom ?? NaN
    return {
      vh: window.innerHeight,
      headerBottom: bottom('.lpRoot.lpHome > header'),
      cropTop: top('#hero [class*="crop"] > i:first-child'),
      labelTop: top('#hero .label'),
      hruleBottom: bottom('#hero [class*="hrule"]'),
    }
  })
}

for (const [w, h] of [[1489, 679], [1920, 1080]] as const) {
  test(`LP hero at ${w}×${h}: clears the fixed header, and the SCROLL row fits on one screen`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await gotoLp(page, 'en')
    await page.waitForTimeout(2600)
    const m = await heroClearance(page)
    expect(m.cropTop).toBeGreaterThanOrEqual(m.headerBottom + 16)
    expect(m.hruleBottom).toBeLessThanOrEqual(m.vh)
  })
}

test('LP hero at 390×844: the label clears the fixed header', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoLp(page, 'en')
  await page.waitForTimeout(2600)
  const m = await heroClearance(page)
  expect(m.labelTop).toBeGreaterThanOrEqual(m.headerBottom + 16)
})

/** s224: scroll to where the finale stage is pinned, and wait until its scrub-in
 *  has finished (the badge is fully scaled: 168px wide, unrotated). */
async function scrollToFinale(page: Page): Promise<void> {
  await page.evaluate(() => {
    const section = document.querySelector('[data-finale-cta]')?.closest('section')
    if (!section) throw new Error('no finale section')
    window.scrollTo(0, section.getBoundingClientRect().top + window.scrollY + window.innerHeight)
  })
  await expect
    .poll(() => page.evaluate(() => Math.round(document.querySelector('[data-finale-cta] a')?.getBoundingClientRect().width ?? 0)))
    .toBe(168)
}

/** Rects (viewport px) that the finale zone test needs, read after scrollToFinale. */
async function finaleGeometry(page: Page): Promise<{
  h2: { left: number; top: number; bottom: number }
  h2Bottom: number
  link: { cx: number; bottom: number; right: number }
  badge: { cx: number; cy: number; w: number }
  viewportW: number
}> {
  return page.evaluate(() => {
    const cta = document.querySelector('[data-finale-cta]') as HTMLElement
    const section = cta.closest('section') as HTMLElement
    const h2 = section.querySelector('h2') as HTMLElement
    const badge = cta.querySelector('a:first-child') as HTMLElement
    const link = cta.querySelector('a:last-child') as HTMLElement
    const hb = h2.getBoundingClientRect()
    const bb = badge.getBoundingClientRect()
    const lb = link.getBoundingClientRect()
    return {
      h2: { left: hb.left, top: hb.top, bottom: hb.bottom },
      h2Bottom: hb.bottom,
      link: { cx: lb.left + lb.width / 2, bottom: lb.bottom, right: lb.right },
      badge: { cx: bb.left + bb.width / 2, cy: bb.top + bb.height / 2, w: bb.width },
      viewportW: window.innerWidth,
    }
  })
}

test('LP finale at 1489×679: the hot zone opens the white circle, and the whole white circle opens the board', async ({ page }) => {
  test.setTimeout(150_000)
  await page.setViewportSize({ width: 1489, height: 679 })
  await gotoLp(page, 'en')
  const section = page.locator('section', { has: page.locator('[data-finale-cta]') })
  await scrollToFinale(page)
  const g = await finaleGeometry(page)
  // What a click at (x, y) would land on: the enclosing link's href and the cursor.
  const hitAt = (x: number, y: number): Promise<{ href: string | null; cursor: string }> =>
    page.evaluate(({ x: hx, y: hy }) => {
      const el = document.elementFromPoint(hx, hy)
      return { href: el?.closest('a')?.getAttribute('href') ?? null, cursor: el ? getComputedStyle(el).cursor : '' }
    }, { x, y })

  // Even before it turns white, the zone itself is a /board link.
  expect((await hitAt(g.link.cx, g.link.bottom + 80)).href).toBe('/board')

  // Just above the headline's bottom edge, and far past the text link's right
  // edge + 64px: both outside the zone, so still not hot.
  await page.mouse.move(g.link.cx, g.h2Bottom - 12)
  await page.mouse.move(g.link.right + 90, g.link.bottom + 80)
  await page.waitForTimeout(150)
  await expect(section).not.toHaveAttribute('data-hot', '1')

  // (1) The empty area 80px under the text link is inside the zone → hot.
  await page.mouse.move(g.link.cx, g.link.bottom + 80)
  await expect(section).toHaveAttribute('data-hot', '1')

  // (2) A point inside the grown white circle but outside the zone (up and to
  // the right of the badge centre, at 0.4 × the circle's radius) stays hot.
  const big = Number(await section.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--big')))
  expect(big).toBeGreaterThan(5)
  const d = 0.4 * (g.badge.w / 2) * big
  const px = g.badge.cx + d / Math.SQRT2
  const py = g.badge.cy - d / Math.SQRT2
  const inZone = px <= g.link.right + 64 && py >= g.h2Bottom
  expect(inZone).toBe(false)
  await page.mouse.move(px, py)
  await page.waitForTimeout(300)
  await expect(section).toHaveAttribute('data-hot', '1')

  // The white area is a button: once it has grown over that point, the point
  // hits the badge's /board link and shows the pointer cursor. The headline
  // sits over the white circle too, and lets clicks fall through to it.
  await expect.poll(async () => (await hitAt(px, py)).href).toBe('/board')
  expect((await hitAt(px, py)).cursor).toBe('pointer')
  const headlineY = (g.h2.top + g.h2.bottom) / 2
  expect((await hitAt(g.h2.left + 200, headlineY)).href).toBe('/board')

  // (3) Clicking there opens the board.
  await Promise.all([page.waitForURL(/\/board/, { timeout: 90_000 }), page.mouse.click(px, py)])

  // (4) Back on the LP: the zone (which reaches 64px past the text link's right
  // edge) makes it hot again, and leaving both the zone and the white circle
  // (the screen's top-right corner) turns it off.
  await page.goBack()
  await page.waitForURL(url('en'))
  await expect(page.locator('[data-finale-cta]')).toBeAttached()
  await scrollToFinale(page)
  const g2 = await finaleGeometry(page)
  await page.mouse.move(g2.link.right + 40, g2.link.bottom + 80)
  await expect(section).toHaveAttribute('data-hot', '1')
  await page.mouse.move(g2.viewportW - 6, 6)
  await expect(section).not.toHaveAttribute('data-hot', '1')
})
