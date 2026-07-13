import { test, expect, type Page } from '@playwright/test'
import { seedDb, firstRunSuppressors, type SeedRecord } from './helpers/seed-db'

type BookmarkSeed = {
  id: string
  url: string
  title: string
  thumbnail: string
}

type CardSeed = {
  id: string
  bookmarkId: string
  width: number
  height: number
}

/** Seed one bookmark+card pair via the shared version-agnostic seedDb
 *  helper (goto → poll for the app's own schema → write → reload). Field
 *  shapes match the file's original hand-written v9 seed 1:1. */
async function seedOne(page: Page, bookmark: BookmarkSeed, card: CardSeed): Promise<void> {
  const now = new Date().toISOString()
  const records: SeedRecord[] = [
    ...firstRunSuppressors(),
    {
      store: 'bookmarks',
      value: {
        id: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
        description: '',
        thumbnail: bookmark.thumbnail,
        favicon: '',
        siteName: '',
        type: 'website',
        savedAt: now,
        tags: [],
        displayMode: null,
        ogpStatus: 'fetched',
        sizePreset: 'M',
        orderIndex: 0,
      },
    },
    {
      store: 'cards',
      value: {
        id: card.id,
        bookmarkId: card.bookmarkId,
        folderId: '',
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        zIndex: 0,
        gridIndex: 0,
        isManuallyPlaced: false,
        width: card.width,
        height: card.height,
      },
    },
  ]
  await seedDb(page, records)
}

test.describe('B-embeds card rendering', () => {
  // Test 4 below mocks the fixture https://example.com/image.jpg (a real
  // 404 in this environment) via page.route(). The app's Service Worker
  // (app/layout.tsx) intercepts image fetches itself and would bypass that
  // mock, so it must be blocked for the mock to actually land — same
  // pattern proven in tests/e2e/board-mixed-media.spec.ts.
  test.use({ serviceWorkers: 'block' })

  test('No-thumbnail source renders as PlaceholderCard (not blank)', async ({ page }) => {
    await seedOne(
      page,
      { id: 'tc-bm-1', url: 'https://r3f.maximeheckel.com/lens2', title: 'Lens 2', thumbnail: '' },
      { id: 'tc-c-1', bookmarkId: 'tc-bm-1', width: 280, height: 360 },
    )
    await page.locator('[data-bookmark-id="tc-bm-1"]').waitFor({ timeout: 10_000 })

    const card = page.locator('[data-bookmark-id="tc-bm-1"]')
    await expect(card).toBeVisible()

    // Title text rendered inside card
    await expect(card.getByText('Lens 2')).toBeVisible()

    // Hostname strip shown at top-left (= PlaceholderCard 仕様、 favicon は廃止)
    await expect(card.getByText('r3f.maximeheckel.com')).toBeVisible()
  })

  // --- RETARGETED (was: "shows play overlay") ---
  // The original assertion looked for a play-triangle SVG path
  // (`path[d^="M8 5"]`) inside the card thumbnail. Grepping the whole
  // components/board/ tree turns up no such path anywhere — the only
  // repo-wide matches are an unrelated marketing-LP component and a
  // historical plan doc. components/board/MediaTypeIndicator.tsx (L102-104)
  // explicitly documents the removal: "Filmstrip icon — reads as 'video'
  // without the play-button shape that we explicitly removed from the card
  // thumbnails." VideoThumbCard.tsx (the component that actually renders
  // the YouTube/TikTok thumbnail, read directly) confirms it: its `thumb`
  // is a bare <img>, no overlay markup at all.
  //
  // The play-triangle was replaced by a DIFFERENT feature: a hover-revealed
  // corner badge, MediaTypeIndicator, mounted by CardsLayer.tsx whenever
  // canPlayInline(item) is true (~L1583-1590) with
  // data-testid="media-indicator" / data-icon="video" for youtube+tiktok
  // (deriveMediaType, CardsLayer.tsx ~L199-212) and a real
  // data-visible toggle driven by hover (MediaTypeIndicator.module.css
  // opacity/pointer-events gate). Retargeted to that: the indicator must
  // mount with the right icon AND actually reveal on hover — a check that
  // is still genuinely falsifiable (fails if canPlayInline/deriveMediaType
  // regress, or if the hover-visibility wiring breaks), unlike a check for
  // a shape that no longer exists.
  test('YouTube card renders thumbnail with a hover-revealed video indicator', async ({ page }) => {
    await seedOne(
      page,
      {
        id: 'yt-bm-1',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Test YT',
        thumbnail: '',
      },
      { id: 'yt-c-1', bookmarkId: 'yt-bm-1', width: 480, height: 270 },
    )
    await page.locator('[data-bookmark-id="yt-bm-1"]').waitFor({ timeout: 10_000 })

    const card = page.locator('[data-bookmark-id="yt-bm-1"]')
    await expect(card).toBeVisible()

    // YouTube thumbnail uses ytimg.com with the video ID in the path
    const thumb = card.locator('img[src*="ytimg.com/vi/dQw4w9WgXcQ"]')
    await expect(thumb).toBeVisible({ timeout: 5_000 })

    // Current media-type indicator (see comment above): mounts unconditionally
    // for playable items, reveals via data-visible on hover.
    const indicator = card.locator('[data-testid="media-indicator"]')
    await expect(indicator).toHaveAttribute('data-icon', 'video')
    await expect(indicator).toHaveAttribute('data-visible', 'false')
    await card.hover()
    await expect(indicator).toHaveAttribute('data-visible', 'true')
  })

  test('TikTok card renders with a hover-revealed video indicator', async ({ page }) => {
    await seedOne(
      page,
      {
        id: 'tt-bm-1',
        url: 'https://www.tiktok.com/@user/video/12345',
        title: 'TikTok test',
        thumbnail: '',
      },
      { id: 'tt-c-1', bookmarkId: 'tt-bm-1', width: 270, height: 480 },
    )
    await page.locator('[data-bookmark-id="tt-bm-1"]').waitFor({ timeout: 10_000 })

    const card = page.locator('[data-bookmark-id="tt-bm-1"]')
    await expect(card).toBeVisible()

    // TikTok oEmbed is slow/blocked in CI — assert the VideoThumbCard shell
    // rendered via the indicator, which mounts regardless of thumbnail fetch
    // status (canPlayInline only needs a resolvable TikTok video ID from the
    // URL itself, see media-players.tsx ENTRIES[tiktok].match).
    const indicator = card.locator('[data-testid="media-indicator"]')
    await expect(indicator).toHaveAttribute('data-icon', 'video')
    await expect(indicator).toHaveAttribute('data-visible', 'false')
    await card.hover()
    await expect(indicator).toHaveAttribute('data-visible', 'true')
  })

  // --- Fixture fix (was: raw <img src="https://example.com/image.jpg">) ---
  // https://example.com/image.jpg is a genuine HTTP 404 (verified via curl —
  // example.com serves no such path). Unmocked, ImageCard's onError sets
  // hasError=true and swaps the thumbnail for a PlaceholderCard, so the
  // original assertion could never pass without either changing the
  // assertion or the fixture. The test's intent (per its name and the
  // surrounding describe block, "B-embeds card rendering") is that a
  // generic site with a resolvable OGP thumbnail renders as ImageCard with
  // that thumbnail — so the fix keeping that intent is to make the fixture
  // URL actually resolve: mock it via page.route() to a real 1x1 PNG
  // (serviceWorkers:'block' above keeps the app's SW from bypassing this
  // mock, same as board-mixed-media.spec.ts's pbs.twimg.com mock).
  const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  )

  test('Generic site with OGP thumbnail renders ImageCard', async ({ page }) => {
    await page.route('https://example.com/image.jpg', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG }),
    )
    await seedOne(
      page,
      {
        id: 'img-bm-1',
        url: 'https://example.com/article',
        title: 'Example',
        thumbnail: 'https://example.com/image.jpg',
      },
      { id: 'img-c-1', bookmarkId: 'img-bm-1', width: 280, height: 210 },
    )
    await page.locator('[data-bookmark-id="img-bm-1"]').waitFor({ timeout: 10_000 })

    const card = page.locator('[data-bookmark-id="img-bm-1"]')
    await expect(card).toBeVisible()

    // ImageCard renders the OGP thumbnail directly
    const thumb = card.locator('img[src="https://example.com/image.jpg"]')
    await expect(thumb).toBeVisible()
  })
})
