import { test, expect, type Page } from '@playwright/test'

const DB_NAME = 'booklage-db'
const SEED_COUNT = 5

/** Seed a few cards + settings that mark onboarding/data-notice/backup-nudge
 *  as already acknowledged, so the board renders a live grid without any
 *  first-run modal intercepting the mobile save button/sheet. Mirrors the
 *  preseed pattern in tests/e2e/tune-corners-and-snap.spec.ts /
 *  tests/e2e/board-b0.spec.ts (memory: reference_playwright_board_share_verify). */
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
          const nowIso = new Date().toISOString()
          sStore.put({ key: 'data-home-ack', at: nowIso })
          sStore.put({ key: 'last-backup-at', at: nowIso })
          for (let i = 0; i < seedCount; i++) {
            bStore.put({
              id: `seed-b-${i}`, url: `https://example.com/${i}`, title: `Seed ${i}`,
              description: '', thumbnail: '', favicon: '', siteName: '', type: 'website',
              savedAt: nowIso, tags: [], displayMode: null, ogpStatus: 'fetched',
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

test.describe('mobile save — phone (touch)', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true })

  test('tapping + opens the input sheet (empty clipboard); a valid URL saves and closes it', async ({ page }) => {
    await seedBoard(page)
    const before = await page.locator('[data-bookmark-id]').count()

    await expect(page.getByTestId('mobile-save-button')).toBeVisible()
    await page.getByTestId('mobile-save-button').click()
    // headless Chromium denies/empties the clipboard read → the button falls
    // back to onNeedInput and the sheet opens (per plan Task 8 note).
    await expect(page.getByTestId('mobile-save-sheet')).toBeVisible()

    await page.getByTestId('mobile-save-input').fill('example.org')
    await page.getByTestId('mobile-save-add').click()

    await expect(page.getByTestId('mobile-save-sheet')).toBeHidden()
    // ingestPastedUrl saves with a domain-name fallback title even when
    // /api/ogp isn't served (Next dev has no such route) — the card lands.
    await expect(page.locator('[data-bookmark-id]')).toHaveCount(before + 1)
  })

  test('invalid input keeps the sheet open and shows the hint', async ({ page }) => {
    await seedBoard(page)
    await page.getByTestId('mobile-save-button').click()
    await expect(page.getByTestId('mobile-save-sheet')).toBeVisible()

    await page.getByTestId('mobile-save-input').fill('hello world')
    await page.getByTestId('mobile-save-add').click()

    await expect(page.getByTestId('mobile-save-hint')).toBeVisible()
    await expect(page.getByTestId('mobile-save-sheet')).toBeVisible()
  })

  test('Android share query (?shared=true&text=) saves the URL and strips the query', async ({ page }) => {
    await seedBoard(page)
    const before = await page.locator('[data-bookmark-id]').count()

    await page.goto('/board?shared=true&text=https%3A%2F%2Fexample.net%2Fshared-x')
    await page.locator('[data-bookmark-id]').first().waitFor({ timeout: 15_000 })

    // The receiver strips the query via history.replaceState on mount.
    await expect(page).toHaveURL(/\/board$/)
    await expect(page.locator('[data-bookmark-id]')).toHaveCount(before + 1)
  })
})

test.describe('mobile save — tablet (touch)', () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true })

  test('the + button also renders on a touch tablet', async ({ page }) => {
    await seedBoard(page)
    await expect(page.getByTestId('mobile-save-button')).toBeVisible()
  })
})

test.describe('mobile save — desktop (mouse)', () => {
  // No test.use() override: inherits the project default (pointer: fine,
  // hasTouch: false, isMobile: false, 1280×800) — a mouse desktop.

  test('the + button never renders for a mouse pointer', async ({ page }) => {
    await seedBoard(page)
    await expect(page.getByTestId('mobile-save-button')).toHaveCount(0)
  })
})
