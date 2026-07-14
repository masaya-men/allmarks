import { test, expect, type Page } from '@playwright/test'
import { seedDb, firstRunSuppressors } from './helpers/seed-db'

/**
 * Byte-identical regression net for theme "sub1" (chrome skin tokens).
 *
 * Sub1 replaces ChromeDrawer/ChromeButton's hardcoded values with
 * `var(--chrome-*, <current hardcoded value>)`. The default theme
 * (dotted-notebook) must render pixel-identical before and after — this
 * spec pins the computed styles down so any drift (wrong fallback value,
 * typo'd token name, etc.) fails loudly instead of shipping silently.
 *
 * Baseline was captured against the pre-tokenization CSS (raw hardcoded
 * values in ChromeDrawer.module.css / ChromeButton.module.css) on
 * 2026-07-14, then re-confirmed unchanged after tokenizing.
 *
 * Note: `backdropFilter` below is asserted as `'none'` — this is a
 * pre-existing LightningCSS quirk unrelated to this task: writing both
 * `backdrop-filter` and `-webkit-backdrop-filter` with the same value gets
 * collapsed to webkit-only in this build, which modern Chromium ignores.
 * It predates sub1 and is out of scope here; this assertion locks in the
 * *current* (buggy) computed value so tokenizing doesn't silently change it
 * in either direction.
 */
async function prepBoard(page: Page): Promise<void> {
  await seedDb(page, [...firstRunSuppressors()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
}

test('ChromeButton (SETTINGS trigger) computed style is byte-identical on default theme', async ({ page }) => {
  await prepBoard(page)
  const btn = page.getByTestId('extension-settings')
  await btn.scrollIntoViewIfNeeded()
  const style = await btn.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { color: cs.color, fontFamily: cs.fontFamily }
  })
  expect(style.color).toBe('rgba(255, 255, 255, 0.85)')
  expect(style.fontFamily).toBe('ui-monospace, "SF Mono", Consolas, monospace')
})

test('ChromeDrawer .panel computed style is byte-identical on default theme', async ({ page }) => {
  await prepBoard(page)
  const btn = page.getByTestId('extension-settings')
  await btn.scrollIntoViewIfNeeded()
  await btn.click()
  const drawer = page.getByTestId('extension-settings-drawer')
  await drawer.waitFor({ state: 'visible', timeout: 10_000 })
  const style = await drawer.evaluate((el) => {
    const cs = getComputedStyle(el)
    return {
      backgroundColor: cs.backgroundColor,
      borderColor: cs.borderColor,
      borderWidth: cs.borderWidth,
      borderStyle: cs.borderStyle,
      borderRadius: cs.borderRadius,
      backdropFilter: cs.backdropFilter,
      boxShadow: cs.boxShadow,
      color: cs.color,
      fontFamily: cs.fontFamily,
    }
  })
  expect(style.backgroundColor).toBe('rgba(12, 12, 12, 0.94)')
  expect(style.borderWidth).toBe('1px')
  expect(style.borderStyle).toBe('solid')
  expect(style.borderColor).toBe('rgba(255, 255, 255, 0.1)')
  expect(style.borderRadius).toBe('14px')
  // pre-existing LightningCSS collapse quirk — see file header. Locked, not fixed, here.
  expect(style.backdropFilter).toBe('none')
  expect(style.boxShadow).toBe('rgba(0, 0, 0, 0.55) 0px 18px 50px 0px')
  expect(style.color).toBe('rgba(255, 255, 255, 0.85)')
  expect(style.fontFamily).toBe('ui-monospace, "SF Mono", Consolas, monospace')
})
