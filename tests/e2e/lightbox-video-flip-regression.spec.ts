import { test, expect } from '@playwright/test'
import { seedDb, firstRunSuppressors, type SeedRecord } from './helpers/seed-db'

// Regression for session-17 bug: opening a video tweet from the board
// did not run the FLIP open animation because TweetVideoPlayer's wrapper
// had no explicit width — only aspectRatio + max constraints — so it
// collapsed to 0×0 in the flex parent (.media), making startScale =
// originRect.width / 0 = Infinity and breaking the GSAP morph.
//
// The fix sets explicit width on the wrapper; this test guards against
// future regressions where the wrapper collapses again.

const VIDEO_ID = 'b-video-regression'
const PHOTO_ID = 'b-photo-regression'
const VERTICAL_ID = 'b-video-vertical'

// The app registers a Service Worker (app/layout.tsx) that intercepts image
// fetches itself, bypassing Playwright's page.route() mocking below (the SW's
// own fetch runs outside the page's routed network stack) — same pattern as
// tests/e2e/board-mixed-media.spec.ts, which hit this exact issue with the
// twimg mock below.
test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ page }) => {
  await page.route('/api/tweet-meta**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ photoUrl: '', videoUrl: '', hasVideo: false, hasPhoto: false }),
    })
  })
  await page.route('/api/tweet-video**', () => { /* hang */ })
  // 400×300 SVG so img elements have a non-zero intrinsic size
  await page.route(/twimg/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="#f80" width="100%" height="100%"/></svg>',
    })
  })

  const nowMs = Date.now()
  const records: SeedRecord[] = [
    ...firstRunSuppressors(),
    {
      store: 'bookmarks',
      value: {
        id: VIDEO_ID,
        url: 'https://x.com/u/status/1001',
        title: 'video tweet (horizontal 16:9)',
        description: 'horizontal video tweet for FLIP regression',
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
        // back to 'gone', silently no-oping the Lightbox-open click below.
        linkStatus: 'alive',
        lastCheckedAt: nowMs,
        mediaSlots: [
          { type: 'video', url: 'https://pbs.twimg.com/poster.jpg', videoUrl: 'https://v/v.mp4', aspect: 16 / 9 },
        ],
      },
    },
    {
      store: 'cards',
      value: {
        id: 'c-video-regression',
        bookmarkId: VIDEO_ID,
        folderId: '',
        x: 240, y: 80,
        rotation: 0, scale: 1, zIndex: 1,
        gridIndex: 0, isManuallyPlaced: false,
        width: 240, height: 180,
      },
    },
    {
      store: 'bookmarks',
      value: {
        id: PHOTO_ID,
        url: 'https://x.com/u/status/1002',
        title: 'photo tweet',
        description: 'photo tweet for FLIP regression',
        thumbnail: 'https://pbs.twimg.com/p.jpg',
        favicon: '',
        siteName: 'X',
        type: 'tweet',
        savedAt: new Date().toISOString(),
        ogpStatus: 'fetched',
        tags: [],
        cardWidth: 240,
        sizePreset: 'S',
        orderIndex: 1,
        linkStatus: 'alive',
        lastCheckedAt: nowMs,
        mediaSlots: [
          { type: 'photo', url: 'https://pbs.twimg.com/p.jpg' },
        ],
      },
    },
    {
      store: 'cards',
      value: {
        id: 'c-photo-regression',
        bookmarkId: PHOTO_ID,
        folderId: '',
        x: 500, y: 80,
        rotation: 0, scale: 1, zIndex: 1,
        gridIndex: 1, isManuallyPlaced: false,
        width: 240, height: 180,
      },
    },
    // Vertical video tweet (9:16 — YouTube Shorts / X vertical clip).
    // Regression for the "side black bars" issue: width must follow the
    // video's natural aspect, not 50vw.
    {
      store: 'bookmarks',
      value: {
        id: VERTICAL_ID,
        url: 'https://x.com/u/status/1003',
        title: 'vertical video tweet (9:16)',
        description: 'vertical video tweet — must not letterbox sideways',
        thumbnail: 'https://pbs.twimg.com/poster-vert.jpg',
        favicon: '',
        siteName: 'X',
        type: 'tweet',
        savedAt: new Date().toISOString(),
        ogpStatus: 'fetched',
        tags: [],
        cardWidth: 240,
        sizePreset: 'S',
        orderIndex: 2,
        linkStatus: 'alive',
        lastCheckedAt: nowMs,
        mediaSlots: [
          { type: 'video', url: 'https://pbs.twimg.com/poster-vert.jpg', videoUrl: 'https://v/vert.mp4', aspect: 9 / 16 },
        ],
      },
    },
    {
      store: 'cards',
      value: {
        id: 'c-video-vertical',
        bookmarkId: VERTICAL_ID,
        folderId: '',
        x: 760, y: 80,
        rotation: 0, scale: 1, zIndex: 1,
        gridIndex: 2, isManuallyPlaced: false,
        width: 240, height: 180,
      },
    },
  ]

  await seedDb(page, records)
  await page.waitForSelector('[data-bookmark-id]')
})

test('video-tweet Lightbox: .media has non-zero rect at open (no FLIP collapse)', async ({ page }) => {
  await page.locator(`[data-bookmark-id="${VIDEO_ID}"]`).click()
  await page.waitForSelector('[data-testid="lightbox"]')

  // Read .media's rect inside the lightbox right after mount. If the FLIP
  // collapse bug returns, this is 0×0 (TweetVideoPlayer wrapper has no
  // explicit width and falls back to <video>'s collapsed intrinsic).
  const rect = await page.evaluate(() => {
    const lb = document.querySelector('[data-testid="lightbox"]')
    const media = lb?.querySelector('[class*="media"]')
    if (!media) return null
    const r = media.getBoundingClientRect()
    return { w: r.width, h: r.height }
  })

  expect(rect).not.toBeNull()
  expect(rect!.w).toBeGreaterThan(50)
  expect(rect!.h).toBeGreaterThan(50)
  // Sanity: aspect ratio should reflect the slot's 16/9 (within ±5%).
  // For the wrapper width-led path, we expect h ≈ w / 1.78.
  const ratio = rect!.w / rect!.h
  expect(ratio).toBeGreaterThan(1.6)
  expect(ratio).toBeLessThan(2.0)
})

// --- RETARGETED (was: "FLIP transform is applied (scale != 1) right after
// open") ---
// The original assertion read `.media`'s own CSS `transform` one
// requestAnimationFrame after mount and expected a sub-1 `scale` (mid-FLIP).
// That was accurate for the *transform-scale* open animation this test was
// written against (commits 73c4943c / 1e2a41ec, 2026-05-12).
//
// Commit 77db3a9f (2026-05-13, "feat(lightbox): destefanis-style clone
// refactor for open/close (B-#17)") — one day later — replaced that
// mechanism entirely (components/board/Lightbox.tsx, the
// `originRect && mediaEl` branch, ~L1060-1241): the open animation now
// clones the source card (`createLightboxClone`) into a persistent
// `#lightbox-clone-host` node and tweens the CLONE's width/height/top/left
// from the on-board card rect to `.media`'s final rect (explicitly NOT
// transform:scale, to avoid GPU-resampled/blurry border-radius — see the
// "session 32: 角丸グニャグニャ" comment at L1166-1167). `.media` itself is
// held at `gsap.set(mediaEl, { opacity: 0, clearProps: 'transform' })` for
// the ENTIRE animation (L1141) and only flips to `opacity:1` in one frame at
// `onComplete` (L1189-1202), once the clone is removed. So
// `media.style.transform` reading `'none'` is now permanent BY DESIGN —
// asserting it can never catch a regression (it is a tautology).
//
// Retargeted to the CURRENT mechanism: assert the clone genuinely tweens
// (width grows over multiple animation frames, not an instant jump) and
// that the handoff completes (clone removed, `.media` reaches opacity 1).
// This is falsifiable against real regressions: if the clone never mounts
// (mechanism reverted to a bare fade), the null-checks fail; if the clone
// jumps straight to its final size (no real tween), the strictly-increasing
// checks fail; if the handoff never fires (.media stays hidden forever, or
// the clone never gets removed), the final-state checks fail.
test('video-tweet Lightbox: clone element genuinely morphs from the card rect to the final media rect (open animation runs)', async ({ page }) => {
  await page.locator(`[data-bookmark-id="${VIDEO_ID}"]`).click()
  await page.waitForSelector('[data-testid="lightbox"]')

  // Poll entirely inside the page (avoids CDP round-trip jitter) for ~900ms —
  // comfortably past the tween's max duration (OPEN_BASE_DUR 0.34s +
  // OPEN_DIST_BONUS_MAX 0.2s = 0.54s, see Lightbox.tsx L61-63).
  const result = await page.evaluate(async () => {
    const widths: number[] = []
    const start = performance.now()
    return await new Promise<{
      widths: number[]
      cloneRemainedAtEnd: boolean
      finalMediaOpacity: string | null
    }>((resolve) => {
      const tick = (): void => {
        const host = document.getElementById('lightbox-clone-host')
        const clone = host?.firstElementChild as HTMLElement | null
        if (clone) widths.push(clone.getBoundingClientRect().width)
        if (performance.now() - start < 900) {
          requestAnimationFrame(tick)
          return
        }
        const hostNow = document.getElementById('lightbox-clone-host')
        const lb = document.querySelector('[data-testid="lightbox"]')
        const media = lb?.querySelector<HTMLElement>('[class*="media"]')
        resolve({
          widths,
          cloneRemainedAtEnd: !!hostNow?.firstElementChild,
          finalMediaOpacity: media ? getComputedStyle(media).opacity : null,
        })
      }
      requestAnimationFrame(tick)
    })
  })

  // The clone mounted at all (proves the clone-based morph engaged — a
  // regression back to a bare opacity fade, or a broken clone host, would
  // leave this array empty).
  expect(result.widths.length).toBeGreaterThan(2)

  // Genuine tween: width must be non-decreasing frame-to-frame (small
  // float tolerance) and show real overall growth from first to last
  // captured sample — a regression that snaps the clone straight to its
  // final size (no animation) would make every sample equal.
  for (let i = 1; i < result.widths.length; i++) {
    expect(result.widths[i]).toBeGreaterThanOrEqual(result.widths[i - 1] - 0.5)
  }
  const first = result.widths[0]!
  const last = result.widths[result.widths.length - 1]!
  expect(last - first).toBeGreaterThan(50)

  // Handoff completed: clone removed, .media painted at full opacity.
  expect(result.cloneRemainedAtEnd).toBe(false)
  expect(result.finalMediaOpacity).toBe('1')
})

test('vertical-video Lightbox: preserves 9:16 aspect (no side black bars)', async ({ page }) => {
  await page.locator(`[data-bookmark-id="${VERTICAL_ID}"]`).click()
  await page.waitForSelector('[data-testid="lightbox"]')
  // Let the open tween settle so .media reflects its final layout rect,
  // not the FLIP start scale.
  await page.waitForTimeout(800)

  const rect = await page.evaluate(() => {
    const lb = document.querySelector('[data-testid="lightbox"]')
    const media = lb?.querySelector('[class*="media"]')
    if (!media) return null
    const r = media.getBoundingClientRect()
    return { w: r.width, h: r.height }
  })

  expect(rect).not.toBeNull()
  // Vertical 9:16 → height MUST be the longer dimension. If the wrapper
  // were stuck at 50vw width, ratio would be ~1.0 or wider (black bars).
  expect(rect!.h).toBeGreaterThan(rect!.w)
  // Within ±5% of 9/16 = 0.5625
  const ratio = rect!.w / rect!.h
  expect(ratio).toBeGreaterThan(0.50)
  expect(ratio).toBeLessThan(0.62)
})
