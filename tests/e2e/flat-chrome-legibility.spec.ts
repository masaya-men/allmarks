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
