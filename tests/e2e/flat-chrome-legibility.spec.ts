import { test, expect, type Page } from '@playwright/test'
import { seedDb, firstRunSuppressors } from './helpers/seed-db'

async function prepFlatBoard(page: Page): Promise<void> {
  await seedDb(page, [...firstRunSuppressors()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
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
