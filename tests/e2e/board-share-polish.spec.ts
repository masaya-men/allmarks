import { test, expect, type Page } from '@playwright/test'

// board/share polish batch (s183) — deterministic Playwright coverage for the
// 3 parts that are meaningfully driveable in this harness:
//   ① text-card edge fade      — computeTagScrollEdge on PlaceholderCard's
//                                 [data-card-scroll] (lib/board/tag-scroll-edge.ts)
//   ② shared receiver layout   — SharedBoard's mobile 3-col override + the
//                                 scroll meter's move into frameBottomChrome
//   ③ SHARE creating indicator — ShareCreatingIndicator body-portal visible
//                                 while shareCreateState === 'creating'
// ④ (TUNE fader snap) is intentionally NOT covered here — setPointerCapture
// rejects Playwright's synthetic pointers (reference_board_card_click_pointer_capture),
// so its math is unit-tested instead (lib/board/fill-snap.test.ts).

const DB_NAME = 'booklage-db'

// ---------------------------------------------------------------------------
// ① text-card edge fade
// ---------------------------------------------------------------------------

// Long enough (~2000 chars) that even at the board's default card width
// (BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX ≈ 268px → PlaceholderCard height
// 268/1.25 ≈ 214px, ~164px of content area) the title overflows by several
// multiples — so a scrollTop set to exactly scrollHeight/2 lands safely in
// the 'middle' band instead of clipping into 'top'/'bottom' by rounding.
const LONG_TITLE = Array(30)
  .fill('Overflow test title text that wraps across many lines to force scrolling. ')
  .join('')

/** Seed a single thumbnail-less bookmark/card whose title overflows
 *  PlaceholderCard's fixed-aspect box, so its [data-card-scroll] element gets
 *  a real (non-'none') data-scroll-edge. Mirrors tune-corners-and-snap's
 *  seedBoard (onboarding-completed + data-home-ack + last-backup-at so no
 *  modal intercepts the board). */
async function seedOverflowingTextCard(page: Page): Promise<void> {
  await page.goto('/board')
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await page.waitForTimeout(400)
  await page.evaluate(
    async ({ dbName, title }) => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(['bookmarks', 'cards', 'settings'], 'readwrite')
          const nowIso = new Date().toISOString()
          tx.objectStore('settings').put({ key: 'onboarding-completed', completed: true })
          tx.objectStore('settings').put({ key: 'data-home-ack', at: nowIso })
          tx.objectStore('settings').put({ key: 'last-backup-at', at: nowIso })
          tx.objectStore('bookmarks').put({
            id: 'seed-overflow-0', url: 'https://example.com/overflow', title,
            description: '', thumbnail: '', favicon: '', siteName: '', type: 'website',
            savedAt: nowIso, tags: [], displayMode: null, ogpStatus: 'fetched',
            sizePreset: 'S', orderIndex: 0,
          })
          tx.objectStore('cards').put({
            id: 'seed-overflow-card-0', bookmarkId: 'seed-overflow-0', folderId: '',
            x: 0, y: 0, rotation: 0, scale: 1, zIndex: 0, gridIndex: 0,
            isManuallyPlaced: false, width: 240, height: 180,
          })
          tx.oncomplete = () => { db.close(); resolve() }
          tx.onerror = () => { db.close(); reject(tx.error) }
        }
        req.onerror = () => reject(req.error)
      })
    },
    { dbName: DB_NAME, title: LONG_TITLE },
  )
  await page.reload()
  await page.locator('[data-bookmark-id]').first().waitFor({ timeout: 15_000 })
}

test.describe('① text-card edge fade (computeTagScrollEdge)', () => {
  test('data-scroll-edge cycles top → middle → bottom → top; scrollbar hidden; no legacy attr', async ({ page }) => {
    await seedOverflowingTextCard(page)

    // Scope to the seeded card specifically — FilterPill's tag dropdown reuses
    // the SAME data-card-scroll="true" attribute name on its own scroller
    // (components/board/FilterPill.tsx:419), so an unscoped selector could
    // match more than one element.
    const scroller = page.locator('[data-bookmark-id="seed-overflow-0"] [data-card-scroll="true"]')
    await expect(scroller).toHaveCount(1)

    // Starts at the top edge.
    await expect(scroller).toHaveAttribute('data-scroll-edge', 'top')

    // No native scrollbar: CSS sets scrollbar-width: none (PlaceholderCard.module.css).
    const scrollbarWidth = await scroller.evaluate((el) => getComputedStyle(el).scrollbarWidth)
    expect(scrollbarWidth).toBe('none')

    // Never carries the old attribute name.
    const legacyAttr = await scroller.evaluate((el) => el.getAttribute('data-overflow'))
    expect(legacyAttr).toBeNull()

    // Scroll to the middle → 'middle'.
    await scroller.evaluate((el) => {
      el.scrollTop = Math.floor(el.scrollHeight / 2)
      el.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await expect(scroller).toHaveAttribute('data-scroll-edge', 'middle')

    // Scroll to the end → 'bottom'.
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight
      el.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await expect(scroller).toHaveAttribute('data-scroll-edge', 'bottom')

    // Back to the top → 'top' again.
    await scroller.evaluate((el) => {
      el.scrollTop = 0
      el.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await expect(scroller).toHaveAttribute('data-scroll-edge', 'top')
  })
})

// ---------------------------------------------------------------------------
// ③ SHARE creating indicator
// ---------------------------------------------------------------------------

/** Seed a handful of plain (thumbnail-less) cards so SELECT ALL → ARRANGE →
 *  CREATE has something to work with. Mirrors tune-corners-and-snap's seedBoard. */
async function seedBoardForShare(page: Page, count: number): Promise<void> {
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
          const nowIso = new Date().toISOString()
          tx.objectStore('settings').put({ key: 'onboarding-completed', completed: true })
          tx.objectStore('settings').put({ key: 'data-home-ack', at: nowIso })
          tx.objectStore('settings').put({ key: 'last-backup-at', at: nowIso })
          for (let i = 0; i < seedCount; i++) {
            bStore.put({
              id: `seed-share-b-${i}`, url: `https://example.com/share-${i}`, title: `Share seed ${i}`,
              description: '', thumbnail: '', favicon: '', siteName: '', type: 'website',
              savedAt: nowIso, tags: [], displayMode: null, ogpStatus: 'fetched',
              sizePreset: 'S', orderIndex: i,
            })
            cStore.put({
              id: `seed-share-c-${i}`, bookmarkId: `seed-share-b-${i}`, folderId: '',
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
    { dbName: DB_NAME, seedCount: count },
  )
  await page.reload()
  await page.locator('[data-bookmark-id]').first().waitFor({ timeout: 15_000 })
}

test.describe('③ SHARE creating indicator (body portal)', () => {
  test('CREATE shows the creating indicator, mounted outside the capture subtree', async ({ page }) => {
    await seedBoardForShare(page, 5)

    // SHARE → SELECT ALL → ARRANGE (select-share-button enters the arrange stage).
    await page.locator('[data-testid="share-pill"]').click()
    await page.locator('[data-testid="select-all-button"]').click()
    await page.locator('[data-testid="select-share-button"]').click()
    await expect(page.locator('[data-testid="share-toast-create"]')).toBeVisible()

    // Substitution note: functions/api/share/create.ts is a Cloudflare Pages
    // Function — it does not exist under this harness's `next dev` webServer,
    // so a real CREATE would 404 quickly and the resulting timing (creating →
    // error) would be a race. Since shareCreateState is set to 'creating'
    // synchronously (before capture/network), the reliable, environment-
    // independent signal is: intercept the create call so it never resolves,
    // and assert the indicator becomes (and stays) visible.
    await page.route('**/api/share/create', async () => {
      await new Promise<never>(() => {}) // never resolves — keeps state at 'creating'
    })

    await page.locator('[data-testid="share-toast-create"]').click()

    const indicator = page.locator('[data-testid="share-creating-indicator"]')
    await expect(indicator).toBeVisible({ timeout: 10_000 })
    await expect(indicator).toContainText('CREATING YOUR LINK')

    // It's a body portal, not a descendant of the capture subtree (.outerFrame).
    const isOutsideOuterFrame = await indicator.evaluate(
      (el) => el.closest('[class*="outerFrame"]') === null,
    )
    expect(isOutsideOuterFrame).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// ② shared receiver (/s/<id>) layout
// ---------------------------------------------------------------------------

type MockShareCard = {
  readonly u: string
  readonly t: string
  readonly ty: 'website'
  readonly cw: number
  readonly a: number
}
type MockShareData = {
  readonly v: 2
  readonly cards: ReadonlyArray<MockShareCard>
  readonly createdAt: number
}

function buildMockShareData(count: number): MockShareData {
  return {
    v: 2,
    cards: Array.from({ length: count }, (_, i) => ({
      u: `https://example.com/receiver-${i}`,
      t: `Receiver card ${i}`,
      ty: 'website',
      cw: 240,
      a: 1.25,
    })),
    createdAt: Date.now(),
  }
}

/**
 * /s/<id> is served ONLY by a Cloudflare Pages Function
 * (functions/s/[id].ts, which patches out/s.html's OG tags) — confirmed by
 * ShareEntry's own comment ("このページは /s/<id> を直接ハンドリングしない
 * (= Pages Function 経由)") and empirically: under this harness's `next dev`
 * webServer, GET /s/abc123 returns Next's default 404 (no app/(app)/s/[id]
 * route exists — verified via curl before writing this test).
 *
 * SharedBoard itself is purely client-side: it re-derives the share id from
 * `window.location.pathname` (lib/share/extract-share-id.ts) and fetches
 * `/api/share/<id>` — the Pages Function only patches OG meta tags into the
 * static shell, it injects no other data. So replaying the exact same shell
 * `next dev` already serves for the real `/s` route, at the `/s/<id>` URL,
 * plus mocking the `/api/share/<id>` JSON response, exercises the REAL
 * SharedBoard component end-to-end (isMobile override, skyline layout,
 * frameBottomChrome) without reimplementing any feature logic.
 */
async function gotoMockedShare(page: Page, id: string, data: MockShareData): Promise<void> {
  const shellHtml = await (await page.request.get('/s')).text()
  await page.route(`**/s/${id}`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: shellHtml })
  })
  await page.route(`**/api/share/${id}`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ share: data }) })
  })
  await page.goto(`/s/${id}`, { waitUntil: 'domcontentloaded' })
  // 'attached', not the default 'visible': .frameTopChrome (which hosts the
  // IMPORT button) is `display: none` under 640px (mobile moves MOTION to a
  // bottom nav and hides the desktop top band) — this just signals the
  // ready-state has rendered, independent of viewport.
  await page.waitForSelector('[data-testid="import-button"]', { state: 'attached', timeout: 10_000 })
}

test.describe('② shared receiver layout (mobile 3-col + desktop meter position)', () => {
  test('mobile (390×844): CardsLayer packs 3 cards per row, not single-column', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoMockedShare(page, 'abc123', buildMockShareData(6))

    const cards = page.locator('[data-bookmark-id]')
    await expect(cards).toHaveCount(6)

    // Wait out the isMobile post-mount flip (useIsMobile starts false — SSR-
    // safe — then updates in an effect) by polling until the first 3 cards'
    // tops converge onto one row.
    await expect.poll(async () => {
      const tops = await cards.evaluateAll((els) =>
        els.slice(0, 3).map((el) => el.getBoundingClientRect().top),
      )
      return Math.max(...tops) - Math.min(...tops)
    }, { timeout: 5_000 }).toBeLessThan(5)

    const lefts = await cards.evaluateAll((els) =>
      els.slice(0, 3).map((el) => el.getBoundingClientRect().left),
    )
    expect(lefts[0]).toBeLessThan(lefts[1])
    expect(lefts[1]).toBeLessThan(lefts[2])
  })

  test('desktop (1489×679): ScrollMeter sits inside frameBottomChrome (frame bottom band)', async ({ page }) => {
    await page.setViewportSize({ width: 1489, height: 679 })
    await gotoMockedShare(page, 'abc124', buildMockShareData(6))

    await expect(page.locator('[data-testid="scroll-meter"]')).toHaveCount(1)
    await expect(
      page.locator('[class*="frameBottomChrome"] [data-testid="scroll-meter"]'),
    ).toHaveCount(1)
  })

  // N-46: the receiver's 3-column grid covers the viewport, so every finger
  // press lands on a card, and a card's base `touch-action: none` then cancels
  // the browser's native scroll — the exact session-180 bug, which the real
  // board fixed and the receiver never got. Playwright cannot drive a native
  // touch scroll (JS scrollTop ignores touch-action), so assert the computed
  // property that governs it.
  test('mobile (390×844): cards release the vertical swipe to the native scroller', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoMockedShare(page, 'abc125', buildMockShareData(6))

    const cards = page.locator('[data-bookmark-id]')
    // useIsMobile starts false (SSR-safe) and flips post-mount.
    await expect
      .poll(async () => cards.first().getAttribute('data-lock-card-scroll'), { timeout: 5_000 })
      .toBe('true')

    const touchActions = await cards.evaluateAll((els) =>
      els.map((el) => {
        const node = el.querySelector('[class*="cardNode"]')
        return node ? getComputedStyle(node).touchAction : 'MISSING'
      }),
    )
    expect(touchActions).toEqual(Array(6).fill('pan-y'))

    const overscroll = await page
      .locator('[class*="scroller"]')
      .first()
      .evaluate((el) => getComputedStyle(el).overscrollBehaviorY)
    expect(overscroll).toBe('contain')
  })

  test('desktop (1489×679): cards keep touch-action none so the reorder drag is not hijacked', async ({ page }) => {
    await page.setViewportSize({ width: 1489, height: 679 })
    await gotoMockedShare(page, 'abc126', buildMockShareData(6))

    const cards = page.locator('[data-bookmark-id]')
    await expect(cards).toHaveCount(6)

    const hasLock = await cards.evaluateAll((els) => els.some((el) => el.hasAttribute('data-lock-card-scroll')))
    expect(hasLock).toBe(false)

    const touchAction = await cards.first().evaluate((el) => {
      const node = el.querySelector('[class*="cardNode"]')
      return node ? getComputedStyle(node).touchAction : 'MISSING'
    })
    expect(touchAction).toBe('none')
  })
})
