import { test, expect, type Page } from '@playwright/test'
import { seedDb, firstRunSuppressors, type SeedRecord } from './helpers/seed-db'

async function prepFlatBoard(page: Page): Promise<void> {
  await seedDb(page, [...firstRunSuppressors()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await page.evaluate(() => document.documentElement.setAttribute('data-theme-id', 'flat'))
}

// Chrome-only tests above never need a real card, so prepFlatBoard seeds none.
// The shadow/lift test needs one actual .cardNode to measure — same seeded
// bookmark+card shape as lightbox-flow.spec.ts's seedBoard (linkStatus:'alive'
// + fresh lastCheckedAt so the dead-link guard doesn't intervene; not needed
// here since we never click the card, but kept for parity/future reuse).
async function prepFlatBoardWithCard(page: Page): Promise<void> {
  const now = new Date().toISOString()
  const rows: SeedRecord[] = [
    {
      store: 'bookmarks',
      value: {
        id: 'seed-b-flat-shadow',
        url: 'https://example.com/flat-shadow',
        title: 'Flat shadow card',
        description: '',
        thumbnail: 'https://via.placeholder.com/200',
        favicon: '',
        siteName: 'Example',
        type: 'website',
        savedAt: now,
        tags: [],
        displayMode: null,
        ogpStatus: 'fetched',
        orderIndex: 0,
        linkStatus: 'alive',
        lastCheckedAt: Date.now(),
      },
    },
    {
      store: 'cards',
      value: {
        id: 'seed-c-flat-shadow',
        bookmarkId: 'seed-b-flat-shadow',
        folderId: '',
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        zIndex: 0,
        gridIndex: 0,
        isManuallyPlaced: false,
        width: 240,
        height: 180,
      },
    },
  ]
  await seedDb(page, [...firstRunSuppressors(), ...rows])
  await page.locator('[data-card-id]').first().waitFor({ timeout: 10_000 })
  await page.evaluate(() => document.documentElement.setAttribute('data-theme-id', 'flat'))
}

// `rgba(var(--chrome-ink-rgb), A)` は flat で `rgba(20, 19, 15, A)` に解決される。
function isDarkInk(color: string): boolean {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return false
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return r < 90 && g < 90 && b < 90
}

test('flat: SETTINGS drawer panel is light and its content ink is dark (legible)', async ({ page }) => {
  await prepFlatBoard(page)
  const btn = page.getByTestId('extension-settings')
  await btn.scrollIntoViewIfNeeded()
  await btn.click()
  const drawer = page.getByTestId('extension-settings-drawer')
  await drawer.waitFor({ state: 'visible', timeout: 10_000 })

  const panelBg = await drawer.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(panelBg).toBe('rgba(255, 255, 255, 0.97)')

  const resetBtn = page.getByTestId('layout-reset-sizes')
  await resetBtn.waitFor({ state: 'visible', timeout: 10_000 })
  const ctaColor = await resetBtn.evaluate((el) => getComputedStyle(el).color)
  expect(isDarkInk(ctaColor)).toBe(true)
})

test('flat: THEME modal group labels are dark ink on a light panel', async ({ page }) => {
  await prepFlatBoard(page)
  await page.getByTestId('extension-settings').click()
  await page.getByTestId('open-theme-modal').click()
  const modal = page.getByTestId('theme-modal')
  await modal.waitFor({ state: 'visible', timeout: 10_000 })
  const bg = await modal.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bg).toBe('rgba(255, 255, 255, 0.97)')
  const label = modal.locator('[class*="groupLabel"]').first()
  const labelColor = await label.evaluate((el) => getComputedStyle(el).color)
  expect(isDarkInk(labelColor)).toBe(true)
})

test('flat: FilterPill dropdown is a light panel with dark ink rows (fixes dark-on-dark)', async ({ page }) => {
  await prepFlatBoard(page)
  const pill = page.getByTestId('filter-pill')
  await pill.scrollIntoViewIfNeeded()
  await pill.click()
  const menu = page.getByTestId('filter-pill-menu')
  await expect(menu).toHaveAttribute('data-open', 'true')
  const menuBg = await menu.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(menuBg).toBe('rgba(255, 255, 255, 0.97)')
  await menu.getByRole('button', { name: /TRASH/ }).click()
  await pill.click()
  await expect(menu).toHaveAttribute('data-open', 'true')
  const allRow = menu.getByRole('button', { name: /^ALL/ })
  const rowColor = await allRow.evaluate((el) => getComputedStyle(el).color)
  expect(isDarkInk(rowColor)).toBe(true)
})

test('flat: closed TUNE drawer shows no border sliver (fully tucked away)', async ({ page }) => {
  await prepFlatBoard(page)
  // The TUNE drawer is ALWAYS in the DOM (max-height accordion), unlike the
  // conditionally-mounted dropdowns. When closed it must have border-width 0,
  // else a 1px hairline sliver of the panel border shows across the light
  // board (the bug the flat skin introduced by bordering the drawer always).
  const drawer = page.getByTestId('tune-drawer')
  await drawer.waitFor({ state: 'attached', timeout: 10_000 })
  await expect(drawer).not.toHaveAttribute('data-open', 'true')
  const borderWidth = await drawer.evaluate((el) => getComputedStyle(el).borderTopWidth)
  expect(borderWidth).toBe('0px')
})

test('flat: chrome buttons have NO glitch ghost and DO show an underline on hover', async ({ page }) => {
  await prepFlatBoard(page)
  const btn = page.getByTestId('extension-settings')
  await btn.scrollIntoViewIfNeeded()
  await btn.hover()
  const ghostOpacity = await btn.evaluate((el) => getComputedStyle(el, '::before').opacity)
  expect(ghostOpacity).toBe('0')
  const underlineTransform = await btn.evaluate((el) => getComputedStyle(el, '::after').transform)
  // underline drawn in on hover → scaleX(1) → identity-ish matrix, NOT the collapsed scaleX(0)=matrix(0,0,0,1,0,0)
  expect(underlineTransform).not.toBe('matrix(0, 0, 0, 1, 0, 0)')
  expect(underlineTransform).not.toBe('none')
  // MUST be a 1.5px hairline, NOT a ~16px block (regression: base padding 8px
  // + border-box floored height to 16px = dark block over the label).
  const underlineHeight = await btn.evaluate((el) => getComputedStyle(el, '::after').height)
  expect(underlineHeight).toBe('1.5px')
})
test('sound wave: chrome button glitch ghost fires on hover (signature unchanged)', async ({ page }) => {
  await seedDb(page, [...firstRunSuppressors()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  // default theme is dotted-notebook — do NOT switch away
  const btn = page.getByTestId('extension-settings')
  await btn.scrollIntoViewIfNeeded()
  await btn.hover()
  const ghostColor = await btn.evaluate((el) => getComputedStyle(el, '::before').color)
  expect(ghostColor).toBe('rgb(255, 157, 63)')  // #ff9d3f orange ghost
})

test('flat: filter pill label typography matches the header buttons (linked)', async ({ page }) => {
  await prepFlatBoard(page)
  const btn = page.getByTestId('extension-settings')
  const pillLabel = page.getByTestId('filter-pill').locator('[class*="label"]').first()
  const read = (l: ReturnType<Page['locator']>): Promise<{ family: string; weight: string; size: string; tracking: string }> => l.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { family: cs.fontFamily, weight: cs.fontWeight, size: cs.fontSize, tracking: cs.letterSpacing }
  })
  const b = await read(btn)
  const p = await read(pillLabel)
  expect(p.family).toBe(b.family)
  expect(p.weight).toBe(b.weight)
  expect(p.size).toBe(b.size)
  expect(p.tracking).toBe(b.tracking)
})

test('flat: board cards float (soft shadow) and edge fades are light not black', async ({ page }) => {
  await prepFlatBoardWithCard(page)
  const card = page.locator('[class*="cardNode"]').first()
  await card.waitFor({ state: 'visible', timeout: 15_000 })
  const shadow = await card.evaluate((el) => getComputedStyle(el).boxShadow)
  expect(shadow).not.toBe('none')
  const canvasBefore = await page.locator('[class*="canvas"]').first()
    .evaluate((el) => getComputedStyle(el, '::before').backgroundImage)
  // Must start from the board's own light colour, not black. The final
  // gradient stop is the CSS `transparent` keyword, which getComputedStyle
  // legitimately resolves to `rgba(0, 0, 0, 0)` (fully transparent — same
  // pixel either way) — so assert there's no non-zero-alpha black band
  // rather than banning the substring "rgba(0, 0, 0" outright.
  expect(canvasBefore).toContain('rgb(250, 249, 246)')
  expect(canvasBefore).not.toMatch(/rgba\(0, 0, 0, 0\.\d/)
})

// Opening the real lightbox via a synthetic pointer is unreliable (card click
// uses setPointerCapture, which rejects Playwright's synthetic pointers — see
// reference_board_card_click_pointer_capture.md), so this verifies the fix at
// the token level instead: the lightbox backdrop must no longer be the dark
// default (rgba(0,0,0,0.5)), since the info text renders in dark-ink
// --text-* tokens under flat and would be invisible on a dark scrim.
//
// Chromium serializes a computed custom-property color as hex (e.g.
// "#00000080"), NOT as the "rgba(0, 0, 0, 0.5)" source text — a plain
// substring check against "0, 0, 0" would silently pass even against the
// unfixed dark default. Parse both hex and rgb()/rgba() forms and assert the
// resolved channels are actually light.
function parseColorChannels(value: string): { r: number; g: number; b: number } {
  const hex = value.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i)
  if (hex) {
    return { r: parseInt(hex[1], 16), g: parseInt(hex[2], 16), b: parseInt(hex[3], 16) }
  }
  const rgb = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) }
  }
  throw new Error(`flat lightbox backdrop: unparseable computed color "${value}"`)
}

test('flat: lightbox backdrop is light (so dark-ink info text is legible)', async ({ page }) => {
  await prepFlatBoard(page)
  const backdrop = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--lightbox-backdrop').trim())
  expect(backdrop).not.toBe('')
  const { r, g, b } = parseColorChannels(backdrop)
  // The dark default (rgba(0,0,0,0.5) → #00000080) resolves to r=g=b=0.
  // The flat-theme override must be a light parchment tone, all channels bright.
  expect(r).toBeGreaterThan(200)
  expect(g).toBeGreaterThan(200)
  expect(b).toBeGreaterThan(200)
})
