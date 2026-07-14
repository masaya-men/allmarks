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

/*
 * Task 3 extends the same net to the remaining chrome panels: ExtensionEntry's
 * .panelCta (LAYOUT buttons, inside the already-open SETTINGS drawer), the
 * THEMES modal (a second ChromeDrawer consumer opened via a different
 * trigger), FilterPill (trigger pill + dropdown menu), and TUNE (trigger +
 * horizontal drawer — NOT tokenized this task, scope was restricted to
 * ChromeDrawer/ChromeButton-style panels; this locks in that TUNE's own
 * literal values are untouched by the refactor).
 */

test('ExtensionEntry .panelCta (LAYOUT reset button) font-family is byte-identical on default theme', async ({ page }) => {
  await prepBoard(page)
  const settingsBtn = page.getByTestId('extension-settings')
  await settingsBtn.scrollIntoViewIfNeeded()
  await settingsBtn.click()
  const resetBtn = page.getByTestId('layout-reset-sizes')
  await resetBtn.waitFor({ state: 'visible', timeout: 10_000 })
  const fontFamily = await resetBtn.evaluate((el) => getComputedStyle(el).fontFamily)
  expect(fontFamily).toBe('ui-monospace, "SF Mono", Consolas, monospace')
})

test('THEMES modal panel (second ChromeDrawer consumer) computed style is byte-identical on default theme', async ({ page }) => {
  await prepBoard(page)
  const settingsBtn = page.getByTestId('extension-settings')
  await settingsBtn.scrollIntoViewIfNeeded()
  await settingsBtn.click()
  const openThemeModalBtn = page.getByTestId('open-theme-modal')
  await openThemeModalBtn.waitFor({ state: 'visible', timeout: 10_000 })
  await openThemeModalBtn.click()
  const modal = page.getByTestId('theme-modal')
  await modal.waitFor({ state: 'visible', timeout: 10_000 })
  const style = await modal.evaluate((el) => {
    const cs = getComputedStyle(el)
    return {
      backgroundColor: cs.backgroundColor,
      borderColor: cs.borderColor,
      borderRadius: cs.borderRadius,
      boxShadow: cs.boxShadow,
      color: cs.color,
      fontFamily: cs.fontFamily,
    }
  })
  expect(style.backgroundColor).toBe('rgba(12, 12, 12, 0.94)')
  expect(style.borderColor).toBe('rgba(255, 255, 255, 0.1)')
  expect(style.borderRadius).toBe('14px')
  expect(style.boxShadow).toBe('rgba(0, 0, 0, 0.55) 0px 18px 50px 0px')
  expect(style.color).toBe('rgba(255, 255, 255, 0.85)')
  expect(style.fontFamily).toBe('ui-monospace, "SF Mono", Consolas, monospace')
})

test('FilterPill trigger computed style is byte-identical on default theme', async ({ page }) => {
  await prepBoard(page)
  const pill = page.getByTestId('filter-pill')
  await pill.scrollIntoViewIfNeeded()
  const style = await pill.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { color: cs.color, fontFamily: cs.fontFamily }
  })
  expect(style.color).toBe('rgba(255, 255, 255, 0.85)')
  expect(style.fontFamily).toBe('ui-monospace, "SF Mono", Consolas, monospace')
})

test('FilterPill menu (dropdown) font-family and item row color are byte-identical on default theme', async ({ page }) => {
  await prepBoard(page)
  const pill = page.getByTestId('filter-pill')
  await pill.scrollIntoViewIfNeeded()
  await pill.click()
  const menu = page.getByTestId('filter-pill-menu')
  await expect(menu).toHaveAttribute('data-open', 'true')
  const menuFontFamily = await menu.evaluate((el) => getComputedStyle(el).fontFamily)
  expect(menuFontFamily).toBe('ui-monospace, "SF Mono", Consolas, monospace')

  // ALL is the default active filter, so it carries the `.active` override
  // (color: #fff) rather than the plain `.item` base color this task
  // tokenized. Switch to TRASH first so re-checking ALL reads the
  // non-active base state.
  const trashRow = menu.getByRole('button', { name: /TRASH/ })
  await trashRow.click()
  await pill.click() // picking a row closes the menu — reopen it
  await expect(menu).toHaveAttribute('data-open', 'true')
  const allRow = menu.getByRole('button', { name: /^ALL/ })
  const allRowColor = await allRow.evaluate((el) => getComputedStyle(el).color)
  expect(allRowColor).toBe('rgba(255, 255, 255, 0.85)')
})

/*
 * Regression lock for the paper-atelier fix: sub1 made --chrome-btn-color
 * live (ChromeButton/ChromeDrawer/FilterPill now read it via var()), but
 * 489caf7e had already neutralized paper-atelier's menu SURFACES to dark
 * glass while leaving a dead --chrome-btn-color: rgba(43, 39, 34, 0.9) (dark
 * ink) override sitting in the paper-atelier CSS block. Once sub1 made the
 * token live, that dead override woke up and painted the FilterPill dropdown
 * rows (and ChromeDrawer panel text) dark-ink-on-dark-glass = invisible.
 * The fix neutralizes the paper-atelier --chrome-btn-color override so it
 * falls back to the :root light value — this pins that fallback down.
 */
test('FilterPill menu item color falls back to the light default on paper-atelier (dark-on-dark regression lock)', async ({ page }) => {
  await prepBoard(page)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme-id', 'paper-atelier'))

  const pill = page.getByTestId('filter-pill')
  await pill.scrollIntoViewIfNeeded()
  await pill.click()
  const menu = page.getByTestId('filter-pill-menu')
  await expect(menu).toHaveAttribute('data-open', 'true')

  // ALL starts active (`.active` override, not the `.item` base color this
  // locks) — switch to TRASH first so re-checking ALL reads the plain base
  // row color, same as the default-theme sibling test above.
  const trashRow = menu.getByRole('button', { name: /TRASH/ })
  await trashRow.click()
  await pill.click() // picking a row closes the menu — reopen it
  await expect(menu).toHaveAttribute('data-open', 'true')
  const allRow = menu.getByRole('button', { name: /^ALL/ })
  const allRowColor = await allRow.evaluate((el) => getComputedStyle(el).color)

  // Neutralized override -> falls back to the :root light value (exact
  // pre-sub1 paper rendering), NOT the dead dark-ink override.
  expect(allRowColor).toBe('rgba(255, 255, 255, 0.85)')
  expect(allRowColor).not.toBe('rgba(43, 39, 34, 0.9)')
})

test('TUNE trigger + drawer computed style is unchanged on default theme (out of scope for sub1 tokenization)', async ({ page }) => {
  await prepBoard(page)
  const trigger = page.getByTestId('tune-trigger')
  await trigger.scrollIntoViewIfNeeded()
  const triggerStyle = await trigger.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { color: cs.color, fontFamily: cs.fontFamily }
  })
  expect(triggerStyle.color).toBe('rgba(255, 255, 255, 0.85)')
  expect(triggerStyle.fontFamily).toBe('ui-monospace, "SF Mono", Consolas, monospace')

  await trigger.click()
  const drawer = page.getByTestId('tune-drawer')
  await expect(drawer).toHaveAttribute('data-open', 'true')
  const drawerStyle = await drawer.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { backgroundColor: cs.backgroundColor, borderRadius: cs.borderRadius, boxShadow: cs.boxShadow }
  })
  expect(drawerStyle.backgroundColor).toBe('rgba(10, 10, 10, 0.92)')
  expect(drawerStyle.borderRadius).toBe('8px')
  expect(drawerStyle.boxShadow).toBe('rgba(0, 0, 0, 0.5) 0px 6px 20px 0px')
})
