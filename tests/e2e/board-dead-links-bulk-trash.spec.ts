import { test, expect, type Page } from '@playwright/test'
import { seedDb, firstRunSuppressors, type SeedRecord } from './helpers/seed-db'

// N-73: DEAD LINKS view gets a bulk "TRASH DEAD LINKS" button mirroring
// TRASH's "EMPTY TRASH" (same header-button pattern), but soft-deleting
// (reversible via undo) rather than permanently purging.

type BookmarkSeed = { id: string; url: string; title: string; linkStatus?: 'alive' | 'gone' }

function seedRecords(bookmarks: readonly BookmarkSeed[]): SeedRecord[] {
  const now = new Date().toISOString()
  const records: SeedRecord[] = [...firstRunSuppressors()]
  bookmarks.forEach((b, i) => {
    records.push({
      store: 'bookmarks',
      value: {
        id: b.id,
        url: b.url,
        title: b.title,
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
        orderIndex: i,
        linkStatus: b.linkStatus ?? 'alive',
        lastCheckedAt: Date.now(),
      },
    })
    records.push({
      store: 'cards',
      value: {
        id: `c-${b.id}`,
        bookmarkId: b.id,
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
    })
  })
  return records
}

async function openDeadLinksView(page: Page): Promise<void> {
  await page.locator('[data-testid="filter-pill"]').click()
  await page.locator('[data-testid="filter-pill-menu"]').getByText('DEAD LINKS', { exact: true }).click()
}

test.describe('DEAD LINKS bulk trash button', () => {
  test('trashes every dead-link card in one click, with a single undo restoring them all', async ({ page }) => {
    await seedDb(
      page,
      seedRecords([
        { id: 'bm-alive-1', url: 'https://example.com/alive-1', title: 'Alive 1', linkStatus: 'alive' },
        { id: 'bm-dead-1', url: 'https://example.com/dead-1', title: 'Dead 1', linkStatus: 'gone' },
        { id: 'bm-dead-2', url: 'https://example.com/dead-2', title: 'Dead 2', linkStatus: 'gone' },
        { id: 'bm-dead-3', url: 'https://example.com/dead-3', title: 'Dead 3', linkStatus: 'gone' },
      ]),
    )
    await page.locator('[data-bookmark-id="bm-alive-1"]').waitFor({ timeout: 10_000 })

    await openDeadLinksView(page)

    // 3 dead cards visible, the alive one is not.
    await expect(page.locator('[data-bookmark-id="bm-dead-1"]')).toBeVisible()
    await expect(page.locator('[data-bookmark-id="bm-dead-2"]')).toBeVisible()
    await expect(page.locator('[data-bookmark-id="bm-dead-3"]')).toBeVisible()
    await expect(page.locator('[data-bookmark-id="bm-alive-1"]')).toHaveCount(0)

    const bulkButton = page.locator('[data-testid="trash-dead-links-button"]')
    await expect(bulkButton).toBeVisible()

    await bulkButton.click()

    // All 3 moved to TRASH — DEAD LINKS view is now empty.
    await expect(page.locator('[data-bookmark-id="bm-dead-1"]')).toHaveCount(0)
    await expect(page.locator('[data-bookmark-id="bm-dead-2"]')).toHaveCount(0)
    await expect(page.locator('[data-bookmark-id="bm-dead-3"]')).toHaveCount(0)
    // Button itself hides once the view is empty (mirrors EMPTY TRASH's own gating).
    await expect(bulkButton).toHaveCount(0)

    // TRASH now holds all 3.
    await page.locator('[data-testid="filter-pill"]').click()
    await page.locator('[data-testid="filter-pill-menu"]').getByText('TRASH', { exact: true }).click()
    await expect(page.locator('[data-bookmark-id="bm-dead-1"]')).toBeVisible()
    await expect(page.locator('[data-bookmark-id="bm-dead-2"]')).toBeVisible()
    await expect(page.locator('[data-bookmark-id="bm-dead-3"]')).toBeVisible()

    // One Ctrl+Z restores the whole batch back to DEAD LINKS in a single step.
    await page.keyboard.press('Control+z')
    await openDeadLinksView(page)
    await expect(page.locator('[data-bookmark-id="bm-dead-1"]')).toBeVisible()
    await expect(page.locator('[data-bookmark-id="bm-dead-2"]')).toBeVisible()
    await expect(page.locator('[data-bookmark-id="bm-dead-3"]')).toBeVisible()
  })

  test('button is absent when DEAD LINKS is empty', async ({ page }) => {
    await seedDb(
      page,
      seedRecords([{ id: 'bm-alive-only', url: 'https://example.com/alive-only', title: 'Alive only', linkStatus: 'alive' }]),
    )
    await page.locator('[data-bookmark-id="bm-alive-only"]').waitFor({ timeout: 10_000 })
    await openDeadLinksView(page)
    await expect(page.locator('[data-testid="trash-dead-links-button"]')).toHaveCount(0)
  })
})
