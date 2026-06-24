import { test, expect, type Page } from '@playwright/test'

const SHOT_DIR = 'C:/Users/masay/AppData/Local/Temp/claude/c--Users-masay-Desktop--------/72921115-d5cc-4020-bf0a-b2e69d458762/scratchpad'

/** Load the board with onboarding marked complete so its first-run overlay
 *  (which auto-starts on an empty board) doesn't block UI interaction or dirty
 *  the calibration screenshots. Mirrors the board-b0 pattern of preparing IDB
 *  then reloading. */
async function prepBoard(page: Page): Promise<void> {
  await page.goto('/board')
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await page.waitForTimeout(500)
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('booklage-db')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('settings', 'readwrite')
        tx.objectStore('settings').put({ key: 'onboarding-completed', completed: true })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  })
  await page.reload()
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await page.waitForTimeout(300)
}

test('paper-atelier tokens apply when data-theme-id is set', async ({ page }) => {
  await prepBoard(page)
  // Force the attribute the way the BoardRoot wiring does, to prove the CSS block:
  await page.evaluate(() => document.documentElement.setAttribute('data-theme-id', 'paper-atelier'))
  const cardBg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--card-dark-alt').trim().toLowerCase(),
  )
  expect(cardBg).toBe('#f7f1e3')
  const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)
  expect(scheme).toContain('light')
})

test('switching to paper-atelier themes the board and persists', async ({ page }) => {
  await prepBoard(page)

  // open the SETTINGS drawer. React derives onMouseEnter from mouseover, so a
  // hover + mouseover dispatch is the reliable trigger in headless.
  const settings = page.getByTestId('extension-settings')
  await settings.scrollIntoViewIfNeeded()
  await settings.hover()
  await settings.dispatchEvent('mouseover')
  await page.getByTestId('theme-picker').waitFor({ state: 'visible', timeout: 10_000 })

  // pick the paper theme
  await page.getByTestId('theme-button-paper-atelier').click({ timeout: 8_000 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme-id')), { timeout: 10_000 })
    .toBe('paper-atelier')

  const cardBg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--card-dark-alt').trim().toLowerCase(),
  )
  expect(cardBg).toBe('#f7f1e3')

  // settings screenshot (drawer open, now in paper theme)
  await page.screenshot({ path: `${SHOT_DIR}/paper-settings.png`, fullPage: false })

  // close the drawer (move away + leave grace) then screenshot the board itself
  await page.mouse.move(640, 720)
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${SHOT_DIR}/paper-board.png`, fullPage: false })

  // persists across reload
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme-id')), { timeout: 10_000 })
    .toBe('paper-atelier')
})

test('default theme is unchanged (regression)', async ({ page }) => {
  await prepBoard(page)
  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bg-dark').trim().toLowerCase(),
  )
  expect(bg).toBe('#0a0a0a') // dotted-notebook canvas unchanged
  await page.screenshot({ path: `${SHOT_DIR}/default-board.png`, fullPage: false })
})
