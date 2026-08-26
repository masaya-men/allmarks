import { test, expect, type Page } from '@playwright/test'
import { seedDb, firstRunSuppressors, type SeedRecord } from './helpers/seed-db'

// N-71: the hold-to-delete DELETE buttons (TrashConfirmDialog +
// TagDeleteConfirmDialog) only revealed "HOLD TO DELETE" once the user was
// ALREADY pressing the button (CSS toggled the ::before content on
// [data-holding="true"]) — at rest it just said "DELETE", indistinguishable
// from a normal single-click delete. Fixed by making the resting label say
// "HOLD TO DELETE" too, so the gesture is clear before the user touches it.

// The ::before content lives on the inner .deleteBtnLabel span (the CSS
// rule targets that span, not the button itself), which has no dedicated
// testid — it's the button's second/last <span> child.
async function beforeContent(page: Page, buttonTestId: string): Promise<string> {
  return page
    .locator(`[data-testid="${buttonTestId}"] span:last-child`)
    .evaluate((el) => window.getComputedStyle(el, '::before').content)
}

test('TRASH confirm DELETE button reads "HOLD TO DELETE" at rest, not just while held', async ({ page }) => {
  const now = new Date().toISOString()
  const records: SeedRecord[] = [
    ...firstRunSuppressors(),
    {
      store: 'bookmarks',
      value: {
        id: 'bm-in-trash',
        url: 'https://example.com/in-trash',
        title: 'In trash',
        description: '',
        thumbnail: '',
        favicon: '',
        siteName: '',
        type: 'website',
        savedAt: now,
        tags: [],
        displayMode: null,
        ogpStatus: 'fetched',
        sizePreset: 'M',
        orderIndex: 0,
        isDeleted: true,
        deletedAt: now,
      },
    },
    {
      store: 'cards',
      value: {
        id: 'c-in-trash',
        bookmarkId: 'bm-in-trash',
        folderId: '',
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        zIndex: 0,
        gridIndex: 0,
        isManuallyPlaced: false,
        width: 280,
        height: 210,
      },
    },
  ]
  await seedDb(page, records)
  await page.waitForLoadState('networkidle')

  await page.locator('[data-testid="filter-pill"]').click()
  await page.locator('[data-testid="filter-pill-menu"]').getByText('TRASH', { exact: true }).click()
  await page.locator('[data-bookmark-id="bm-in-trash"]').waitFor({ timeout: 10_000 })

  await page.locator('[data-testid="empty-trash-button"]').click()
  const deleteBtn = page.locator('[data-testid="trash-confirm-delete"]')
  await expect(deleteBtn).toBeVisible()

  // Resting state (never touched): must already read "HOLD TO DELETE".
  expect(await beforeContent(page, 'trash-confirm-delete')).toBe('"HOLD TO DELETE"')

  // Mid-hold: still "HOLD TO DELETE" (unchanged — no more toggle).
  const box = await deleteBtn.boundingBox()
  if (!box) throw new Error('button not laid out')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(300)
  expect(await beforeContent(page, 'trash-confirm-delete')).toBe('"HOLD TO DELETE"')
  await page.mouse.up() // release before the 2s hold completes
})
