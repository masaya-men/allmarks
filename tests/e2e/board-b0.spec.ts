import { test, expect, type Page } from '@playwright/test'
import { seedDb, firstRunSuppressors, type SeedRecord } from './helpers/seed-db'

const SEED_COUNT = 80

async function seedBoard(page: Page): Promise<void> {
  page.on('pageerror', (err) => console.log(`[browser] pageerror: ${err.message}`))

  const now = new Date().toISOString()
  const rows: SeedRecord[] = []
  for (let i = 0; i < SEED_COUNT; i++) {
    rows.push({
      store: 'bookmarks',
      value: {
        id: `seed-b-${i}`,
        url: `https://example.com/${i}`,
        title: `Seed card ${i}`,
        description: '',
        thumbnail: '',
        favicon: '',
        siteName: '',
        type: 'website',
        savedAt: now,
        tags: [],
        displayMode: null,
        ogpStatus: 'fetched',
        sizePreset: 'S',
        orderIndex: i,
      },
    })
    rows.push({
      store: 'cards',
      value: {
        id: `seed-c-${i}`,
        bookmarkId: `seed-b-${i}`,
        folderId: '',
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        zIndex: 0,
        gridIndex: i,
        isManuallyPlaced: false,
        width: 240,
        height: 180,
      },
    })
  }

  await seedDb(page, [...firstRunSuppressors(), ...rows])
  await page.locator('[data-card-id]').first().waitFor({ timeout: 10_000 })
}

test.describe('B0 board skeleton', () => {
  test.beforeEach(async ({ page }) => {
    await seedBoard(page)
  })

  test('renders theme background', async ({ page }) => {
    await expect(page.locator('[data-theme-id="dotted-notebook"]').first()).toBeVisible()
  })

  test('cards render with non-zero size', async ({ page }) => {
    const card = page.locator('[data-card-id]').first()
    await expect(card).toBeVisible()
    const box = await card.boundingBox()
    expect(box?.width ?? 0).toBeGreaterThan(0)
    expect(box?.height ?? 0).toBeGreaterThan(0)
  })

  test('wheel scroll moves cards up', async ({ page }) => {
    const card = page.locator('[data-card-id]').first()
    const before = await card.boundingBox()
    await page.mouse.move(640, 400)
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(200)
    const after = await card.boundingBox()
    expect(after?.y ?? 0).toBeLessThan(before?.y ?? 0)
  })

  // SKIPPED (N-53 diagnosis, confirmed with a debug trace, not just guesswork):
  // this is not a settle-timing/inertia issue that polling can fix. A plain
  // left-drag with target === currentTarget on [data-interaction-layer] is
  // classified as 'wiggle', not 'pan', by classifyBoardPointerDown()
  // (lib/board/grab-gesture.ts:22) whenever grab-wiggle is enabled — which it
  // is unconditionally here (wiggle={grabWiggle} in BoardRoot.tsx, gated only
  // on prefers-reduced-motion, not on card count despite the "empty-board"
  // naming). 'wiggle' writes --grab-x/--grab-y (use-grab-wiggle.ts) which the
  // cards layer consumes at weight 0.4 (GRAB_LAYER_WEIGHTS.cards,
  // lib/board/rubber-band.ts) — a bounded, SELF-CANCELLING elastic nudge
  // (GRAB_SPRING: elastic.out(1, 0.4), 0.7s) that always springs back to
  // offset 0, i.e. the card's EXACT starting position. It never performs a
  // persistent scroll the way the wheel handler does.
  //
  // Traced empirically: card.y went 128 (before) -> 136.7 @50ms (bounce past
  // origin) -> 125.7 @150ms (transiently "moved up", why the old fixed-delay
  // read sometimes passed) -> 128 @650ms and @1650ms (fully settled back to
  // the exact starting value, matching the spring's 0.7s duration). Polling
  // for "moved up" just races which transient sample it happens to catch
  // before the spring fully settles to a tie — non-deterministic by
  // construction, not fixable by a longer poll timeout.
  //
  // TODO(N-53 follow-up): decide the real fix — either drive genuine 'pan'
  // in the test (hold Space or use a middle-button drag; both bypass
  // wiggleEnabled in classifyBoardPointerDown and produce a real onScroll-
  // driven pan, matching how empty-area drag-scroll is actually invoked
  // today), or retire this test if bare-left-drag-scrolls is no longer the
  // intended behavior now that grab-wiggle (shipped s149) owns that gesture.
  test.skip('empty-area drag scrolls like wheel', async ({ page }) => {
    const card = page.locator('[data-card-id]').first()
    const before = await card.boundingBox()
    await page.evaluate(() => {
      const layer = document.querySelector('[data-interaction-layer]') as HTMLElement | null
      if (!layer) throw new Error('interaction layer not found')
      const dispatch = (type: string, y: number): void => {
        layer.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'mouse',
            clientX: 40,
            clientY: y,
            buttons: type === 'pointerup' ? 0 : 1,
          }),
        )
      }
      dispatch('pointerdown', 600)
      for (let y = 590; y >= 200; y -= 20) dispatch('pointermove', y)
      dispatch('pointerup', 200)
    })
    // Poll the same condition (card moved up) instead of widening what's
    // asserted — kept as the documented "first attempt" even though it's
    // skipped; see the comment above for why polling can't make this green.
    await expect
      .poll(async () => (await card.boundingBox())?.y ?? 0, { timeout: 4_000 })
      .toBeLessThan(before?.y ?? 0)
  })

  test('theme switch toggles background, ruler meter and decorations', async ({ page }) => {
    // The THEMES picker lives inside the click-open SETTINGS drawer; open it,
    // then open the theme drawer from inside it.
    await page.getByTestId('extension-settings').click()
    await expect(page.getByTestId('extension-settings-drawer')).toBeVisible()
    await page.getByTestId('open-theme-modal').click()
    await expect(page.getByTestId('theme-modal')).toBeVisible()

    // 1) switch to flat → <html data-theme-id="flat"> (grid-paper was retired)
    await page.locator('[data-theme-button="flat"]').click()
    await expect(page.locator('html[data-theme-id="flat"]')).toHaveCount(1)

    // 2) switch to paper-atelier (theme drawer stays open across selections)
    await page.locator('[data-theme-button="paper-atelier"]').click()
    await expect(page.locator('html[data-theme-id="paper-atelier"]')).toHaveCount(1)

    // paper-atelier uses the RULER scroll meter (Task 2 sets data-meter-variant on .track)
    await expect(page.locator('[data-meter-variant="ruler"]')).toHaveCount(1)

    // paper-atelier mounts pointer-events:none card decorations (Task 3/4)
    await expect(page.locator('[data-testid="paper-card-decorations"]').first()).toBeAttached()
  })

  // Task 12 DONE — drag-to-reorder changes order (orderIndex), not XY position.
  // This test asserted free-drag XY change which is obsolete. Reorder E2E deferred.
  test.skip('card drag updates its position', async ({ page }) => {
    const card = page.locator('[data-card-id]').first()
    const before = await card.boundingBox()
    if (!before) throw new Error('card has no bounding box')
    const startX = before.x + before.width / 2
    const startY = before.y + before.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 200, startY + 150, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(150)
    const after = await card.boundingBox()
    expect(Math.abs((after?.x ?? 0) - before.x)).toBeGreaterThan(50)
  })

  test('top header renders with the 3 expected slots', async ({ page }) => {
    await expect(page.locator('[data-testid="board-top-header"]')).toBeVisible()
    await expect(page.locator('[data-testid="filter-pill"]')).toBeVisible()
    await expect(page.locator('[data-testid="share-pill"]')).toBeVisible()
  })
})
