import { test, expect, type Page } from '@playwright/test'

const DB_NAME = 'booklage-db'
const SEED_COUNT = 40

/** Seed the board with plain website cards (width 240 → rounded radius caps at
 *  the 20px max) and mark onboarding complete, so the board renders a live grid
 *  and the TUNE chrome is interactable. */
async function seedBoard(page: Page): Promise<void> {
  await page.goto('/board')
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await page.waitForTimeout(400)
  await page.evaluate(
    async ({ dbName, seedCount }) => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(['bookmarks', 'cards', 'settings'], 'readwrite')
          const bStore = tx.objectStore('bookmarks')
          const cStore = tx.objectStore('cards')
          const sStore = tx.objectStore('settings')
          sStore.put({ key: 'onboarding-completed', completed: true })
          // Suppress the first-run "data notice" card + backup nudge so their
          // modal backdrops don't intercept the TUNE hover/click.
          const nowIso = new Date().toISOString()
          sStore.put({ key: 'data-home-ack', at: nowIso })
          sStore.put({ key: 'last-backup-at', at: nowIso })
          const now = nowIso
          for (let i = 0; i < seedCount; i++) {
            bStore.put({
              id: `seed-b-${i}`, url: `https://example.com/${i}`, title: `Seed ${i}`,
              description: '', thumbnail: '', favicon: '', siteName: '', type: 'website',
              savedAt: now, tags: [], displayMode: null, ogpStatus: 'fetched',
              sizePreset: 'S', orderIndex: i,
            })
            cStore.put({
              id: `seed-c-${i}`, bookmarkId: `seed-b-${i}`, folderId: '',
              x: 0, y: 0, rotation: 0, scale: 1, zIndex: 0, gridIndex: i,
              isManuallyPlaced: false, width: 240, height: 180,
            })
          }
          tx.oncomplete = () => { db.close(); resolve() }
          tx.onerror = () => { db.close(); reject(tx.error) }
        }
        req.onerror = () => reject(req.error)
      })
    },
    { dbName: DB_NAME, seedCount: SEED_COUNT },
  )
  await page.reload()
  await page.locator('[data-bookmark-id]').first().waitFor({ timeout: 15_000 })
}

async function openTune(page: Page): Promise<void> {
  await page.getByTestId('tune-wrap').hover()
  await page.locator('[data-testid="tune-drawer"][data-open="true"]').waitFor({ timeout: 8_000 })
}

function cardRadius(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-bookmark-id]') as HTMLElement | null
    return el ? getComputedStyle(el).getPropertyValue('--card-radius').trim() : ''
  })
}

test('CORNERS toggle flips card --card-radius between rounded and square', async ({ page }) => {
  await seedBoard(page)

  // Default: rounded — width 240 → min(20, 240*0.12=28.8) = 20px.
  const rounded = await cardRadius(page)
  expect(parseFloat(rounded)).toBeGreaterThan(10)

  await openTune(page)
  const toggle = page.getByTestId('tune-corners-toggle')
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(toggle).toContainText('ROUND')

  // Toggle OFF → square (0px) on every card.
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await expect(toggle).toContainText('SQUARE')
  await expect.poll(() => cardRadius(page)).toBe('0px')

  // Toggle back ON → radius returns.
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect.poll(async () => parseFloat(await cardRadius(page))).toBeGreaterThan(10)
})

test('CORNERS choice persists across reload (BoardConfig)', async ({ page }) => {
  await seedBoard(page)
  await openTune(page)
  await page.getByTestId('tune-corners-toggle').click() // → SQUARE
  await expect.poll(() => cardRadius(page)).toBe('0px')

  await page.reload()
  await page.locator('[data-bookmark-id]').first().waitFor({ timeout: 15_000 })
  // Square survived the reload via persisted BoardConfig.roundedCorners=false.
  await expect.poll(() => cardRadius(page)).toBe('0px')
})

test('faders show green fill marks (even-margin alignment points)', async ({ page }) => {
  await seedBoard(page)
  await openTune(page)
  const marks = page.locator('[data-testid="fader-fill-mark"]')
  // At least one fill mark per fader (W and G both have candidates at 1471-ish).
  expect(await marks.count()).toBeGreaterThan(1)
  // Each mark sits between 0% and 100% down its track.
  const tops = await marks.evaluateAll((els) =>
    els.map((e) => parseFloat((e as HTMLElement).style.top)),
  )
  for (const t of tops) {
    expect(t).toBeGreaterThanOrEqual(0)
    expect(t).toBeLessThanOrEqual(100)
  }
})
