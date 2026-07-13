import { test, expect, type Page } from '@playwright/test'
import { seedDb, firstRunSuppressors, type SeedRecord } from './helpers/seed-db'

// lib/i18n/config.ts detectLocale() reads navigator.languages and falls back
// to 'en' unless it matches a supported locale — real Japanese users' browsers
// report 'ja' and see '閉じる', but Playwright's default Chromium context
// reports 'en-US', so the close button renders as "Close" under plain test
// defaults. Pin the browser context's locale so this test observes the same
// Japanese UI text a real ja-JP user (and the original assertion) expects —
// this is a test-environment setting, not an assertion change.
test.use({ locale: 'ja-JP' })

// Under plain `pnpm dev`, /api/ogp (a Cloudflare Pages Function) 404s. The
// board's viewport RevalidationQueue treats that as "gone" and BoardRoot's
// handleCardClick dead-link guard (`if (clickedItem?.linkStatus === 'gone')
// return`) silently no-ops the card click. Stamp both linkStatus:'alive' and
// a fresh lastCheckedAt (Unix ms — see BookmarkRecord.lastCheckedAt) on the
// seeded row so shouldRevalidate() (lib/board/revalidate.ts) skips
// re-checking it before the test's own click fires.
async function seedBoard(page: Page): Promise<void> {
  const now = new Date().toISOString()
  const rows: SeedRecord[] = [
    {
      store: 'bookmarks',
      value: {
        id: 'seed-b-lightbox',
        url: 'https://example.com/a',
        title: 'Hello',
        description: '',
        thumbnail: 'https://via.placeholder.com/200',
        favicon: '',
        siteName: 'Example',
        type: 'website',
        savedAt: now,
        tags: [],
        displayMode: null,
        ogpStatus: 'fetched',
        orderIndex: 0,
        linkStatus: 'alive',
        lastCheckedAt: Date.now(),
      },
    },
    {
      store: 'cards',
      value: {
        id: 'seed-c-lightbox',
        bookmarkId: 'seed-b-lightbox',
        folderId: '',
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        zIndex: 0,
        gridIndex: 0,
        isManuallyPlaced: false,
        width: 240,
        height: 180,
      },
    },
  ]
  await seedDb(page, [...firstRunSuppressors(), ...rows])
  await page.locator('[data-card-id]').first().waitFor({ timeout: 10_000 })
}

test('click card → lightbox opens → × closes it', async ({ page }) => {
  await seedBoard(page)

  // Click the card
  await page.getByText('Hello').first().click()
  await expect(page.getByTestId('lightbox')).toBeVisible()

  // Close via button
  await page.getByRole('button', { name: '閉じる' }).click()
  await expect(page.getByTestId('lightbox')).toBeHidden()
})
