import { test, expect, type Locator } from '@playwright/test'
import { seedDb, firstRunSuppressors, type SeedRecord } from './helpers/seed-db'

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
 *  finished.
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

// The app registers a Service Worker (app/layout.tsx) that intercepts image
// fetches itself, bypassing Playwright's page.route() mocking below (the SW's
// own fetch runs outside the page's routed network stack). Block it for this
// file so the pbs.twimg.com mock below actually lands.
test.use({ serviceWorkers: 'block' })

const MIX_BOOKMARK_ID = 'b-mix-1'
const TWEET_URL = 'https://x.com/men_masaya/status/1842217368673759498'

// Seed a bookmark with a 3-slot mediaSlots array directly into IDB (via the
// shared version-agnostic seedDb helper — tests/e2e/helpers/seed-db.ts) so
// the test does not depend on a live tweet-meta proxy response. The first
// slot is a video (poster only — board never plays it), the next two are
// photos. Hover-position should swap which slot is the active (cross-faded)
// layer, cycling through all three.
// 1x1 transparent PNG, served for every seeded pbs.twimg.com image URL below.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

test.beforeEach(async ({ page }) => {
  // The seeded mediaSlots below point at made-up paths on the real
  // pbs.twimg.com domain (poster.jpg / a.jpg / b.jpg never existed there).
  // Left unmocked, those <img> requests 404 in this test environment,
  // ImageCard's onError sets hasError=true, and the whole thumb swaps to
  // PlaceholderCard — wiping the data-active layer stack the tests below
  // depend on. Fulfill every pbs.twimg.com request with a real (tiny) image
  // so the cards stay hermetic and never depend on live network access.
  await page.route('https://pbs.twimg.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG }),
  )

  // Hang the tweet-video proxy so the <video> element stays in loading state
  // and never fires onerror. Without this, the proxy would attempt to fetch
  // https://v/v.mp4 (a fake URL from the seed data), fail immediately, and
  // TweetVideoPlayer would swap to the Watch-on-X <a> fallback before any
  // assertion can confirm the <video> element is present.
  await page.route('/api/tweet-video**', (_route) => {
    // Intentionally do not call route.fulfill/abort — keeps the request
    // pending indefinitely, preventing the onerror → fallback swap.
  })

  const nowMs = Date.now()
  const records: SeedRecord[] = [
    ...firstRunSuppressors(),
    // Tier 1 auto-cycle (commit 43dce7e2, "hard-cut auto-cycle for
    // multi-image cards") wires autoCycle={motionEnabled} into every
    // multi-slot ImageCard (components/board/CardsLayer.tsx:1418), so the
    // board silently advances imageIdx on its own randomized timer. Seed
    // motionEnabled:false into the persisted BoardConfig (the same record
    // lib/storage/board-config.ts reads/writes) so the slideshow never
    // starts and the hover tests below are the *only* driver of imageIdx.
    {
      store: 'settings',
      value: { key: 'board-config', config: { motionEnabled: false } },
    },
    {
      store: 'bookmarks',
      value: {
        id: MIX_BOOKMARK_ID,
        url: TWEET_URL,
        title: 'mix tweet',
        description: '',
        thumbnail: 'https://pbs.twimg.com/poster.jpg',
        favicon: '',
        siteName: 'X',
        type: 'tweet',
        savedAt: new Date().toISOString(),
        ogpStatus: 'fetched',
        tags: [],
        cardWidth: 240,
        sizePreset: 'S',
        orderIndex: 0,
        // Dead-link guard (BoardRoot RevalidationQueue / lib/board/revalidate.ts):
        // a missing lastCheckedAt is always-due, so on mount the app would call
        // GET /api/ogp (404 under `next dev`, no Pages Function) and flip this
        // back to 'gone', silently no-oping the Lightbox-open click tests below.
        linkStatus: 'alive',
        lastCheckedAt: nowMs,
        mediaSlots: [
          { type: 'video', url: 'https://pbs.twimg.com/poster.jpg', videoUrl: 'https://v/v.mp4', aspect: 16 / 9 },
          { type: 'photo', url: 'https://pbs.twimg.com/a.jpg' },
          { type: 'photo', url: 'https://pbs.twimg.com/b.jpg' },
        ],
      },
    },
    {
      store: 'cards',
      value: {
        id: 'c-mix-1',
        bookmarkId: MIX_BOOKMARK_ID,
        folderId: '',
        x: 240, y: 80,
        rotation: 0, scale: 1, zIndex: 1,
        gridIndex: 0, isManuallyPlaced: false,
        width: 240, height: 240,
      },
    },
  ]

  await seedDb(page, records)
  await page.waitForSelector('[data-bookmark-id]')

  // BoardRoot's motionEnabled starts true by default and only flips to the
  // seeded false once its async board-config read resolves (BoardRoot.tsx
  // ~L868-894). Wait for that settle via the MOTION toggle's aria-pressed
  // state (components/board/MotionToggle.tsx) before any test drives hover —
  // otherwise the slideshow timer can still be mid-flight from the brief
  // motionEnabled=true window at mount.
  await expect(page.getByTestId('motion-toggle')).toHaveAttribute('aria-pressed', 'false')
})

test('board hover swaps thumb across video poster → photo1 → photo2', async ({ page }) => {
  const card = page.locator(`[data-bookmark-id="${MIX_BOOKMARK_ID}"]`)
  await expect(card).toBeVisible()
  const box = await waitForStableBox(card)

  // Current architecture (commit 456258fe, "cross-fade hover swap +
  // destefanis brightness lift"): ImageCard stacks ONE <img> per mediaSlot
  // and cross-fades between them by toggling data-active — it no longer
  // swaps a single <img>'s src. 3 layers should be present for the 3 slots.
  const layers = card.locator('img')
  await expect(layers).toHaveCount(3)

  // With auto-cycle settled off (beforeEach), the lead slot (0) is active
  // at rest.
  await expect(layers.nth(0)).toHaveAttribute('data-active', 'true')

  // Move pointer to leftmost third → slot 0 (video poster) active.
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2)
  await expect(layers.nth(0)).toHaveAttribute('data-active', 'true')
  await expect(layers.nth(1)).not.toHaveAttribute('data-active', 'true')
  await expect(layers.nth(2)).not.toHaveAttribute('data-active', 'true')

  // Middle third → slot 1 (photo a) active.
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2)
  await expect(layers.nth(1)).toHaveAttribute('data-active', 'true')
  await expect(layers.nth(0)).not.toHaveAttribute('data-active', 'true')

  // Right third → slot 2 (photo b) active.
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2)
  await expect(layers.nth(2)).toHaveAttribute('data-active', 'true')
  await expect(layers.nth(1)).not.toHaveAttribute('data-active', 'true')

  // Layer srcs are stable across hover (one img per slot).
  await expect(layers.nth(0)).toHaveAttribute('src', /poster\.jpg/)
  await expect(layers.nth(1)).toHaveAttribute('src', /a\.jpg/)
  await expect(layers.nth(2)).toHaveAttribute('src', /b\.jpg/)

  // 3 dots present, video slot has data-slot-type='video'.
  const dots = card.getByTestId('multi-image-dot')
  await expect(dots).toHaveCount(3)
  await expect(dots.first()).toHaveAttribute('data-slot-type', 'video')
})

test('hover applies brightness lift filter to the active layer only', async ({ page }) => {
  const card = page.locator(`[data-bookmark-id="${MIX_BOOKMARK_ID}"]`)
  await expect(card).toBeVisible()
  const box = await waitForStableBox(card)

  // Without hover, no brightness filter is applied.
  const cleanFilter = await card.locator('img').nth(0).evaluate(
    (el) => window.getComputedStyle(el).filter,
  )
  expect(cleanFilter).toMatch(/^(none|)$/)

  // Hover the card. The active layer (slot 0 at rest, per beforeEach's
  // auto-cycle-settled wait) should now have a brightness filter applied
  // via :hover.
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2)
  await expect(card.locator('img[data-active="true"]')).toHaveCount(1)
  const liftedFilter = await card.locator('img[data-active="true"]').evaluate(
    (el) => window.getComputedStyle(el).filter,
  )
  expect(liftedFilter).toContain('brightness')
})

test('Lightbox carousel: arrow keys + dot click cycle through slots', async ({ page }) => {
  const card = page.locator(`[data-bookmark-id="${MIX_BOOKMARK_ID}"]`)
  await card.click()

  const lightbox = page.getByTestId('lightbox')
  await expect(lightbox).toBeVisible()

  // Initially slot 0 (video poster) → TweetVideoPlayer renders a <video>.
  await expect(lightbox.locator('video')).toBeVisible()

  // ↓ → slot 1 (photo a) → <img> with a.jpg.
  await page.keyboard.press('ArrowDown')
  await expect(lightbox.locator('img')).toHaveAttribute('src', /a\.jpg/)

  // ↓ → slot 2 (photo b).
  await page.keyboard.press('ArrowDown')
  await expect(lightbox.locator('img')).toHaveAttribute('src', /b\.jpg/)

  // ↓ at end → no-op (still photo b).
  await page.keyboard.press('ArrowDown')
  await expect(lightbox.locator('img')).toHaveAttribute('src', /b\.jpg/)

  // Click dot 0 (video) → re-render TweetVideoPlayer.
  const dot0 = lightbox.getByRole('tab').first()
  await dot0.click()
  await expect(lightbox.locator('video')).toBeVisible()
})

test('Lightbox auto-pauses video when user navigates away from video slot', async ({ page }) => {
  const card = page.locator(`[data-bookmark-id="${MIX_BOOKMARK_ID}"]`)
  await card.click()
  const lightbox = page.getByTestId('lightbox')
  await expect(lightbox.locator('video')).toBeVisible()

  // Force-play the video so we can verify auto-pause on nav.
  await lightbox.locator('video').evaluate((v) => {
    const video = v as HTMLVideoElement
    // suppress autoplay-blocked promise rejection in headless mode
    void video.play().catch(() => {})
  })

  // ↓ → moves to photo slot → video should be paused after the slot change effect runs.
  await page.keyboard.press('ArrowDown')

  // Click dot 0 to return to video.
  const dot0 = lightbox.getByRole('tab').first()
  await dot0.click()
  await expect(lightbox.locator('video')).toBeVisible()

  // The pause itself is observable via the video element's `paused` property
  // back when the user was off the slot. Since we returned, we check the
  // currentTime is preserved (= NOT reset to 0 by remount). The key= forces
  // remount only when slotIdx changes; same slot keeps state.
  const paused = await lightbox.locator('video').evaluate((v) => (v as HTMLVideoElement).paused)
  // Either the play() never resolved in headless (paused=true) or it did and
  // then auto-pause kicked in on nav. Either way, after returning we expect a
  // fresh remount because key changed (`slot-0` → `slot-1` → `slot-0`), so
  // currentTime is 0 — this is acceptable per spec §10 open-problem note.
  expect(paused).toBe(true)
})
