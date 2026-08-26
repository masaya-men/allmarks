import { test, expect, type Page } from '@playwright/test'
import { seedDb, firstRunSuppressors, type SeedRecord } from './helpers/seed-db'

// N-72: MANAGE TAGS' desktop panel (TagDropPanel) was drag-and-drop only.
// Clicking a tag row while cards are selected now bulk-applies it too —
// reuses the same handleAssignTagToSelection already wired for mobile's tap
// bar, so this mainly proves the new wiring + the roll-up/flash feedback.

async function seedTagAndBookmarks(page: Page): Promise<void> {
  const now = new Date().toISOString()
  const records: SeedRecord[] = [
    ...firstRunSuppressors(),
    { store: 'tags', value: { id: 'tag-project', name: 'project', createdAt: now, orderIndex: 0 } },
    {
      store: 'bookmarks',
      value: {
        id: 'bm-a', url: 'https://example.com/a', title: 'A', description: '', thumbnail: '',
        favicon: '', siteName: '', type: 'website', savedAt: now, tags: [], displayMode: null,
        ogpStatus: 'fetched', sizePreset: 'M', orderIndex: 0,
      },
    },
    {
      store: 'cards',
      value: { id: 'c-a', bookmarkId: 'bm-a', folderId: '', x: 0, y: 0, rotation: 0, scale: 1, zIndex: 0, gridIndex: 0, isManuallyPlaced: false, width: 280, height: 210 },
    },
    {
      store: 'bookmarks',
      value: {
        id: 'bm-b', url: 'https://example.com/b', title: 'B', description: '', thumbnail: '',
        favicon: '', siteName: '', type: 'website', savedAt: now, tags: [], displayMode: null,
        ogpStatus: 'fetched', sizePreset: 'M', orderIndex: 1,
      },
    },
    {
      store: 'cards',
      value: { id: 'c-b', bookmarkId: 'bm-b', folderId: '', x: 0, y: 0, rotation: 0, scale: 1, zIndex: 0, gridIndex: 0, isManuallyPlaced: false, width: 280, height: 210 },
    },
  ]
  await seedDb(page, records)
}

test('clicking a tag row in MANAGE TAGS applies it to the whole selection', async ({ page }) => {
  await seedTagAndBookmarks(page)
  await page.locator('[data-bookmark-id="bm-a"]').waitFor({ timeout: 10_000 })

  await page.getByTestId('tag-button').click()
  await page.locator('[data-bookmark-id="bm-a"]').click()
  await page.locator('[data-bookmark-id="bm-b"]').click()

  const tagRow = page.getByTestId('tag-drop-tag-project')
  await expect(tagRow).toContainText('000')

  await tagRow.click()

  // Confirmation flash fires.
  await expect(tagRow).toHaveAttribute('data-dropped', 'true')
  // Roll-up settles on the new count.
  await expect(tagRow).toContainText('002', { timeout: 2_000 })

  await page.getByTestId('tag-mode-done').click()

  // Persisted: filtering by the tag shows both cards.
  await page.locator('[data-testid="filter-pill"]').click()
  await page.locator('[data-testid="filter-pill-menu"]').getByText('project', { exact: true }).click()
  await expect(page.locator('[data-bookmark-id="bm-a"]')).toBeVisible()
  await expect(page.locator('[data-bookmark-id="bm-b"]')).toBeVisible()
})

test('clicking a tag row with no selection is a no-op', async ({ page }) => {
  await seedTagAndBookmarks(page)
  await page.locator('[data-bookmark-id="bm-a"]').waitFor({ timeout: 10_000 })

  await page.getByTestId('tag-button').click()
  const tagRow = page.getByTestId('tag-drop-tag-project')
  await expect(tagRow).toContainText('000')

  // aria-disabled='true' (no selection) — Playwright's actionability check
  // treats that as non-actionable by default, same as a real assistive-tech
  // user would be told; force the click to prove the app-level no-op guard
  // (handleRowClick's `if (!hasSelection) return`) still holds for a mouse
  // user who clicks it anyway.
  await tagRow.click({ force: true })
  await page.waitForTimeout(500)
  await expect(tagRow).toContainText('000')
  await expect(tagRow).not.toHaveAttribute('data-dropped', 'true')
})
