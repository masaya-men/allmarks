import { test, expect, type Locator } from '@playwright/test'
import { seedDb, firstRunSuppressors, type SeedRecord } from './helpers/seed-db'

// The app registers a Service Worker (app/layout.tsx) that intercepts image
// fetches itself, bypassing Playwright's page.route() mocking below (the SW's
// own fetch runs outside the page's routed network stack). Block it for this
// file so the via.placeholder.com mock below actually lands. See
// tests/e2e/board-mixed-media.spec.ts for the same fix + full diagnosis.
test.use({ serviceWorkers: 'block' })

type Rect = { x: number; y: number; width: number; height: number }

/** Poll boundingBox() until two consecutive reads agree, instead of trusting
 *  a single early read. seedDb's first page.goto('/board') always hits a
 *  genuinely empty IDB (before our own records land), so BoardRoot's
 *  first-run gate (shouldAutoStartOnboarding, lib/onboarding/onboarding-state.ts)
 *  sees itemCount===0 and auto-seeds ~12 onboardingDemo:true tutorial cards
 *  (lib/onboarding/onboarding-demo.ts) before our seed write even happens.
 *  Once our records land and the page reloads, itemCount>0 so BoardRoot
 *  sweeps those demo cards back out (clearOnboardingDemo) — asynchronously,
 *  after they've already been packed into the layout alongside ours. That
 *  extra pack/unpack cycle silently relocates our card on screen right after
 *  mount, so a boundingBox() read taken too early produces stale coordinates
 *  and every mouse.move() below misses the card. Waiting for the rect to
 *  stop moving sidesteps needing to know exactly when/whether the sweep
 *  finished. Same helper as tests/e2e/board-mixed-media.spec.ts (duplicated
 *  locally rather than shared, per the "do not touch other specs" scope).
 */
async function waitForStableBox(locator: Locator, timeoutMs = 8000): Promise<Rect> {
  const deadline = Date.now() + timeoutMs
  let prev = await locator.boundingBox()
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 200))
    const cur = await locator.boundingBox()
    const stable =
      prev !== null && cur !== null &&
      Math.abs(prev.x - cur.x) < 0.5 && Math.abs(prev.y - cur.y) < 0.5 &&
      Math.abs(prev.width - cur.width) < 0.5 && Math.abs(prev.height - cur.height) < 0.5
    if (stable && cur) return cur
    if (Date.now() > deadline) {
      if (!cur) throw new Error('card never produced a boundingBox')
      return cur
    }
    prev = cur
  }
}

// 1x1 transparent PNG, served for every seeded via.placeholder.com image URL
// below (real network access to that domain 404s/hangs in this sandbox,
// which would flip ImageCard's hasError → PlaceholderCard and wipe the
// data-active layer stack the tests below depend on).
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

test.describe('I-07 multi-image hover & lightbox carousel', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://via.placeholder.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG }),
    )
  })

  test('card hover swaps image; lightbox dots + ArrowUp/Down nav work', async ({ page }) => {
    const bookmarkId = 'multi-image-test-1'
    const cardId = 'card-' + bookmarkId
    const photos = [
      'https://via.placeholder.com/400x300?text=1',
      'https://via.placeholder.com/400x300?text=2',
      'https://via.placeholder.com/400x300?text=3',
      'https://via.placeholder.com/400x300?text=4',
    ]
    const now = new Date().toISOString()
    const nowMs = Date.now()
    const records: SeedRecord[] = [
      ...firstRunSuppressors(),
      // Tier 1 auto-cycle (commit 43dce7e2) wires autoCycle={motionEnabled}
      // into every multi-slot ImageCard — off here so hover is the only
      // driver of imageIdx below. See board-mixed-media.spec.ts for the
      // full diagnosis of this race.
      { store: 'settings', value: { key: 'board-config', config: { motionEnabled: false } } },
      {
        store: 'bookmarks',
        value: {
          id: bookmarkId,
          url: 'https://x.com/test/status/9999',
          title: 'Multi-image test tweet',
          description: '',
          thumbnail: photos[0],
          favicon: '',
          siteName: '',
          type: 'tweet',
          savedAt: now,
          ogpStatus: 'fetched',
          orderIndex: 0,
          cardWidth: 240,
          tags: [],
          displayMode: null,
          // Legacy v12 field (no mediaSlots) — ImageCard.tsx L54-55 widens
          // photos[] into synthetic photo slots. Kept intentionally (rather
          // than switching to mediaSlots) so this spec still covers that
          // backward-compat path; board-mixed-media.spec.ts covers the
          // mediaSlots path instead.
          photos,
          // Dead-link guard (BoardRoot RevalidationQueue / lib/board/revalidate.ts):
          // a missing lastCheckedAt is always-due, so on mount the app would call
          // GET /api/ogp (404 under `next dev`) and flip this to 'gone', silently
          // no-oping the Lightbox-open click below.
          linkStatus: 'alive',
          lastCheckedAt: nowMs,
        },
      },
      {
        store: 'cards',
        value: {
          id: cardId,
          bookmarkId,
          folderId: '',
          x: 0, y: 0,
          rotation: 0, scale: 1, zIndex: 0,
          gridIndex: 0, isManuallyPlaced: false,
          width: 240, height: 180,
          aspectRatio: 4 / 3,
        },
      },
    ]

    await seedDb(page, records)
    await page.waitForSelector(`[data-bookmark-id="${bookmarkId}"]`, { timeout: 10000 })
    await expect(page.getByTestId('motion-toggle')).toHaveAttribute('aria-pressed', 'false')

    const card = page.locator(`[data-bookmark-id="${bookmarkId}"]`)

    // Current architecture (commit 456258fe, "cross-fade hover swap +
    // destefanis brightness lift"): ImageCard stacks ONE <img> per slot and
    // cross-fades between them by toggling data-active — it no longer swaps
    // a single <img>'s src. Mirrors the (already-correct) pattern in
    // tests/e2e/board-mixed-media.spec.ts. 4 layers should be present for
    // the 4 photos.
    const layers = card.locator('img')
    await expect(layers).toHaveCount(4)

    const box = await waitForStableBox(card)

    // Initial: no hover → slot 0 active.
    await expect(layers.nth(0)).toHaveAttribute('data-active', 'true')

    // Hover math: idx = Math.floor(ratio * photos.length), clamped to [0, length-1].
    // For 4 photos: idx=0 at ratio<0.25, idx=1 at [0.25,0.5), idx=2 at [0.5,0.75),
    // idx=3 at [0.75,1.0]. Pick ratios that hit each bucket center.

    // ratio 0.6 → idx=2
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5)
    await expect(layers.nth(2)).toHaveAttribute('data-active', 'true')
    await expect(layers.nth(0)).not.toHaveAttribute('data-active', 'true')

    // ratio 0.9 → idx=3 (last)
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5)
    await expect(layers.nth(3)).toHaveAttribute('data-active', 'true')
    await expect(layers.nth(2)).not.toHaveAttribute('data-active', 'true')

    // Layer srcs are stable across hover (one img per slot).
    await expect(layers.nth(0)).toHaveAttribute('src', /\?text=1$/)
    await expect(layers.nth(3)).toHaveAttribute('src', /\?text=4$/)

    const dots = card.locator('[data-testid="multi-image-dot"]')
    await expect(dots).toHaveCount(4)
    await expect(dots.nth(3)).toHaveAttribute('data-active', 'true')

    // Pointer leaves card → resets to idx=0 (ImageCard.tsx handlePointerLeave).
    await page.mouse.move(box.x + box.width + 100, box.y + box.height * 0.5)
    await expect(layers.nth(0)).toHaveAttribute('data-active', 'true')
    await expect(layers.nth(3)).not.toHaveAttribute('data-active', 'true')

    // Open lightbox. The Lightbox carousel is a SEPARATE component
    // (components/board/Lightbox.tsx) that still renders a single <img> and
    // swaps its src per slot — unlike the board card above, this was never
    // stale (commit 456258fe only touched the board-card thumb), so this
    // half of the test is unchanged from the original.
    await card.click()
    const lightbox = page.getByTestId('lightbox')
    await expect(lightbox).toBeVisible({ timeout: 3000 })

    const lbImg = lightbox.locator('img').first()
    await expect(lbImg).toHaveAttribute('src', /\?text=1$/)

    // ArrowDown advances forward
    await page.keyboard.press('ArrowDown')
    await expect(lbImg).toHaveAttribute('src', /\?text=2$/)

    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(lbImg).toHaveAttribute('src', /\?text=4$/)

    // Clamp at last index — ArrowDown at the end is a no-op
    await page.keyboard.press('ArrowDown')
    await expect(lbImg).toHaveAttribute('src', /\?text=4$/)

    // ArrowUp goes back
    await page.keyboard.press('ArrowUp')
    await expect(lbImg).toHaveAttribute('src', /\?text=3$/)

    // Dot click jumps directly
    const lbDots = lightbox.locator('[role="tab"]')
    await expect(lbDots).toHaveCount(4)
    await lbDots.nth(0).click()
    await expect(lbImg).toHaveAttribute('src', /\?text=1$/)

    await page.keyboard.press('Escape')
    await expect(lightbox).toBeHidden({ timeout: 3000 })
  })

  test('single-photo card has no dots and no hover swap', async ({ page }) => {
    const bookmarkId = 'single-photo-test'
    const now = new Date().toISOString()
    const records: SeedRecord[] = [
      ...firstRunSuppressors(),
      {
        store: 'bookmarks',
        value: {
          id: bookmarkId,
          url: 'https://example.com/single',
          title: 'Single',
          description: '',
          thumbnail: 'https://via.placeholder.com/400x300?text=ONLY',
          favicon: '',
          siteName: '',
          type: 'website',
          savedAt: now,
          ogpStatus: 'fetched',
          orderIndex: 0,
          cardWidth: 240,
          tags: [],
          displayMode: null,
        },
      },
      {
        store: 'cards',
        value: {
          id: 'c-' + bookmarkId,
          bookmarkId,
          folderId: '',
          x: 0, y: 0,
          rotation: 0, scale: 1, zIndex: 0,
          gridIndex: 0, isManuallyPlaced: false,
          width: 240, height: 180,
          aspectRatio: 4 / 3,
        },
      },
    ]

    await seedDb(page, records)
    await page.waitForSelector(`[data-bookmark-id="${bookmarkId}"]`, { timeout: 10000 })
    const card = page.locator(`[data-bookmark-id="${bookmarkId}"]`)
    await card.hover()
    await expect(card.locator('[data-testid="multi-image-dot"]')).toHaveCount(0)
  })
})
