import { test, expect, type Page } from '@playwright/test'

const DB_NAME = 'booklage-db'
// mobile-arrange-ux-redesign (Task 4) changed the mobile arrange band's aspect
// from portrait 4:5 to portrait 9:16 (SHARE_PORTRAIT_ASPECT, mobile-band.ts).
// The band's WIDTH is unchanged (still the full frame width, 390 on this
// viewport), but it is TALLER again (height ratio 16:9 ≈1.778 vs the old
// 5:4=1.25) — more vertical room lets fitSelectionToScreen's H-scan
// (collage-layout.ts) choose a layout with MORE rows, so the previous
// SEED_COUNT=16 (4 clean rows of 4 under 4:5) no longer lands on a clean pack
// under 9:16: it comes out as 5 rows of 3 + 1 trailing single card, and that
// trailing row is centred and does NOT reach the edges (fitSelectionToScreen
// centres any row that doesn't reach the band's width — collage-layout.ts
// ~241-242). A naive min/max-over-all-cards check still passes at 16 (rows
// 1-5 reach the edges, masking row 6's centred gap in the aggregate), which
// is exactly the "passes for the wrong reason" trap the per-row assertion
// below exists to catch. The next clean count was found by directly probing
// fitSelectionToScreen's real output (seeding N bookmarks, entering the 9:16
// arrange stage, and grouping the rendered `collage-el-*` rects by row) for a
// range of candidates — 20 is the smallest one at or above 16 that packs into
// full rows with none left over: 5 rows of 4, so every row — not just the
// aggregate extremes — reaches both edges.
const SEED_COUNT = 20

/** Seed cards + the acks that suppress every first-run modal. Mirrors
 *  tests/e2e/mobile-save.spec.ts (memory: reference_playwright_board_share_verify). */
async function seedBoard(page: Page): Promise<void> {
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
          const sStore = tx.objectStore('settings')
          sStore.put({ key: 'onboarding-completed', completed: true })
          const nowIso = new Date().toISOString()
          sStore.put({ key: 'data-home-ack', at: nowIso })
          sStore.put({ key: 'last-backup-at', at: nowIso })
          for (let i = 0; i < seedCount; i++) {
            bStore.put({
              id: `seed-b-${i}`, url: `https://example.com/${i}`, title: `Seed ${i}`,
              description: '', thumbnail: '', favicon: '', siteName: '', type: 'website',
              savedAt: nowIso, tags: [], displayMode: null, ogpStatus: 'fetched',
              sizePreset: 'S', orderIndex: i, linkStatus: 'alive',
            })
            cStore.put({
              id: `seed-c-${i}`, bookmarkId: `seed-b-${i}`, folderId: '',
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
    { dbName: DB_NAME, seedCount: SEED_COUNT },
  )
  await page.reload()
  await page.locator('[data-bookmark-id]').first().waitFor({ timeout: 15_000 })
}

/** functions/api/share/create.ts is a Pages Function; it does not exist under
 *  `next dev`. Fulfil it so the flow reaches LINK READY.
 *
 *  `capturedBody`, when passed, receives the raw POST body (api-client.ts's
 *  createShare does a plain `JSON.stringify(entry)` with no compression —
 *  verified by logging `route.request().postData()` directly — so this is a
 *  real, complete `{ share: ShareDataV2, thumb? }` payload, not an opaque
 *  blob) so a test can assert the link payload's card count/URLs after the
 *  create round-trips. */
async function stubCreate(
  page: Page,
  id = 'e2eshare',
  capturedBody: { value: string | null } | null = null,
): Promise<void> {
  await page.route('**/api/share/create', async (route) => {
    if (capturedBody) capturedBody.value = route.request().postData()
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id }) })
  })
  // The post-create cache warm hits /og/<id>.jpg, which also does not exist.
  await page.route('**/og/*.jpg', (route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: '' }))
}

/** Shape of the POST body posted to /api/share/create — only the fields this
 *  spec needs to inspect (the real ShareDataV2/ShareCardV2 types have more). */
type PostedSharePayload = {
  readonly share: {
    readonly cards: ReadonlyArray<{ readonly u: string }>
  }
}

test.describe('mobile SHARE — phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true })

  test('bottom nav hosts SHARE, and entering select mode clears the chrome', async ({ page }) => {
    await seedBoard(page)

    const nav = page.locator('[data-testid="board-mobile-nav"]')
    await expect(nav).toBeVisible()
    await expect(page.locator('[data-testid="mobile-nav-motion"]')).toHaveCount(0)

    await page.locator('[data-testid="mobile-nav-share"]').click()

    await expect(page.locator('[data-testid="mobile-share-select-bar"]')).toBeVisible()
    await expect(nav).toHaveCount(0)
    await expect(page.locator('[data-testid="mobile-save-button"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="mobile-select-counter"]')).toHaveText('0 / 100 SELECTED')
  })

  test('the arrange stage shows the consolidated dock, not the old top/bottom bars (mobile-arrange-ux-redesign)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()

    // The old top bar (undo/redo/selection tools) and bottom bar (zoom
    // slider/back/create) are gone entirely, replaced by one dock.
    await expect(page.getByTestId('mobile-arrange-topbar')).toHaveCount(0)
    await expect(page.getByTestId('mobile-arrange-bar')).toHaveCount(0)
    await expect(page.getByTestId('mobile-arrange-dock')).toBeVisible()

    // Core controls always present (selection-only controls are covered by
    // the "tapping a card shows the selection tools" test below).
    await expect(page.getByTestId('mobile-arrange-undo')).toBeVisible()
    await expect(page.getByTestId('mobile-arrange-redo')).toBeVisible()
    await expect(page.getByTestId('mobile-arrange-zoom-out')).toBeVisible()
    await expect(page.getByTestId('mobile-arrange-zoom-in')).toBeVisible()
    await expect(page.getByTestId('mobile-arrange-zoom-fit')).toBeVisible()
    await expect(page.getByTestId('mobile-arrange-back')).toBeVisible()
    await expect(page.getByTestId('mobile-arrange-create')).toBeVisible()
  })

  test('SELECT ALL → CREATE arranges into the centred 9:16 band and yields a link', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)

    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await expect(page.locator('[data-testid="mobile-select-counter"]')).toHaveText(`${SEED_COUNT} / 100 SELECTED`)

    await page.locator('[data-testid="mobile-select-create"]').click()

    // ARRANGE (tap 1) → edit stage: the selection is auto-placed into the band
    // and the dock + band guide come up, but nothing has been shot yet.
    await expect(page.locator('[data-testid="mobile-arrange-dock"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-band-overlay"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-share-result"]')).toHaveCount(0)

    // The collage is mounted in the edit stage, so the band can be measured
    // directly here — before the CREATE tap, since the arrangement doesn't
    // change afterwards. Asserting it here also proves the edit stage opens
    // with a correct initial layout. This — not the final image's size — is
    // what proves there are no letterbox bars: contain would leave the sides
    // empty.
    const band = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[data-testid^="collage-el-"]'))
      const rects = els.map((el) => el.getBoundingClientRect())
      return {
        count: rects.length,
        left: Math.min(...rects.map((r) => r.left)),
        right: Math.max(...rects.map((r) => r.right)),
        top: Math.min(...rects.map((r) => r.top)),
        bottom: Math.max(...rects.map((r) => r.bottom)),
        vw: window.innerWidth,
        vh: window.innerHeight,
      }
    })
    expect(band.count).toBe(SEED_COUNT)

    const bandH = band.vw * (1920 / 1080) // portrait 9:16
    const bandTop = (band.vh - bandH) / 2
    // Cards reach both side edges (no left/right letterbox).
    expect(band.left).toBeLessThanOrEqual(1)
    expect(band.right).toBeGreaterThanOrEqual(band.vw - 1)
    // …and stay inside the band that cover-cropping will keep.
    expect(band.top).toBeGreaterThanOrEqual(bandTop - 1)
    expect(band.bottom).toBeLessThanOrEqual(bandTop + bandH + 1)

    // A min/max taken over ALL cards can pass even when one row is a centred
    // partial (a different, full-width row would still supply the extremes
    // and mask it) — SEED_COUNT is chosen so this can't happen (see comment
    // above), but assert it directly too: group by row (rounded top) and
    // require EVERY row, not just the aggregate, to reach both edges.
    const rows = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[data-testid^="collage-el-"]'))
      const byRow = new Map<number, { minX: number; maxX: number; count: number }>()
      for (const el of els) {
        const r = el.getBoundingClientRect()
        const key = Math.round(r.top)
        const row = byRow.get(key) ?? { minX: Infinity, maxX: -Infinity, count: 0 }
        row.minX = Math.min(row.minX, r.left)
        row.maxX = Math.max(row.maxX, r.right)
        row.count += 1
        byRow.set(key, row)
      }
      return Array.from(byRow.values())
    })
    expect(rows.length).toBeGreaterThan(1) // more than one row, or the aggregate check above would be the only proof
    for (const row of rows) {
      expect(row.minX).toBeLessThanOrEqual(1)
      expect(row.maxX).toBeGreaterThanOrEqual(band.vw - 1)
    }

    // CREATE (tap 2) → shoot the arrangement just verified above and produce
    // the link.
    await page.locator('[data-testid="mobile-arrange-create"]').click()
    const sheet = page.locator('[data-testid="mobile-share-result"]')
    await expect(sheet).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[data-testid="mobile-share-ready"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-share-copy"]')).toBeVisible()
  })

  test('the preview is a real 1080x1920 image', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()

    // ARRANGE → edit stage, then CREATE → shoot (N-58 two-tap flow).
    await expect(page.locator('[data-testid="mobile-arrange-dock"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-band-overlay"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-share-result"]')).toHaveCount(0)
    await page.locator('[data-testid="mobile-arrange-create"]').click()

    const preview = page.locator('[data-testid="mobile-share-preview"]')
    await expect(preview).toBeVisible({ timeout: 30_000 })
    const dims = await preview.evaluate((el) => {
      const img = el as HTMLImageElement
      return { w: img.naturalWidth, h: img.naturalHeight, src: img.src.slice(0, 22) }
    })
    expect(dims).toEqual({ w: 1080, h: 1920, src: 'data:image/jpeg;base64' })
  })

  // handleMobileCaptureAndCreate (BoardRoot.tsx) no longer shoots via
  // normalizeShotToJpegDataUrl's `fit: 'cover' | 'contain'` toggle at all — it
  // renders straight from placement data via renderCollageCanvasToJpeg
  // (collage-canvas-render.ts), which maps the whole band (band-space) onto the
  // whole output canvas with a single linear scale (mapBandToOutput: sx =
  // outW/band.width, sy = outH/band.height). Portrait band (9:16, via
  // mobileCollagePortraitBandRect/SHARE_PORTRAIT_ASPECT) and portrait output
  // (1080×1920, also 9:16) share the same aspect ratio, so sx === sy and there
  // is no "fit" mode left that could reintroduce a flat letterbox bar.
  //
  // What a regression WOULD still look like: if the band ever stopped reaching
  // the frame's full width (e.g. someone swaps back in the old landscape
  // mobileCollageBandRect, or band.width/x is computed wrong), mapBandToOutput
  // only paints inside the mapped card rects — any strip of the output canvas
  // the band doesn't cover stays the flat bgColor fill. The DOM assertions in
  // the "SELECT ALL → CREATE" test above only prove the ARRANGE-stage on-screen
  // geometry (fitSelectionToScreen); they say nothing about the actual captured
  // raster (a different code path: renderCollageCanvasToJpeg + mapBandToOutput).
  // So this test decodes the produced JPEG's pixels directly to prove the
  // captured image itself — not just the edit-stage DOM — fills to both side
  // edges.
  test('the preview image fills to both side edges (no flat band edges)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()

    // ARRANGE → edit stage, then CREATE → shoot (N-58 two-tap flow).
    await expect(page.locator('[data-testid="mobile-arrange-dock"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-band-overlay"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-share-result"]')).toHaveCount(0)
    await page.locator('[data-testid="mobile-arrange-create"]').click()

    const preview = page.locator('[data-testid="mobile-share-preview"]')
    await expect(preview).toBeVisible({ timeout: 30_000 })

    // Draw the already-decoded <img> (a same-origin data: URL) into a canvas and
    // count distinct (quantised) colours in a strip along each side edge. Sample a
    // grid, not a single row, so one unlucky gap between cards can't produce a
    // false "many colours" or a lucky single-colour row fool the count either way.
    // Quantise (>> 3 per channel) to absorb JPEG ringing/compression noise around
    // hard edges. A flat letterbox/margin is a single boardColor fill, so a strip
    // that never leaves that margin collapses to exactly 1 distinct colour; a
    // strip that crosses real card pixels and board background is many.
    const edges = await preview.evaluate((el) => {
      const img = el as HTMLImageElement
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.drawImage(img, 0, 0)

      const countDistinct = (x0: number, x1: number): number => {
        const seen = new Set<string>()
        for (let x = x0; x < x1; x += 8) {
          for (let y = 0; y < canvas.height; y += 8) {
            const [r, g, b] = ctx.getImageData(x, y, 1, 1).data
            seen.add(`${r >> 3},${g >> 3},${b >> 3}`)
          }
        }
        return seen.size
      }

      return {
        left: countDistinct(0, 300),
        right: countDistinct(canvas.width - 300, canvas.width),
      }
    })

    expect(edges.left).toBeGreaterThan(1)
    expect(edges.right).toBeGreaterThan(1)
  })

  test('BACK returns to selection without creating anything', async ({ page }) => {
    await seedBoard(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()
    await expect(page.locator('[data-testid="mobile-arrange-dock"]')).toBeVisible()

    await page.locator('[data-testid="mobile-arrange-back"]').click()

    await expect(page.locator('[data-testid="mobile-share-select-bar"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-arrange-dock"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="mobile-share-result"]')).toHaveCount(0)
  })

  test('the result scrim covers the collage frame (N-55)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()
    await page.locator('[data-testid="mobile-arrange-create"]').click()

    await expect(page.locator('[data-testid="mobile-share-result"]')).toBeVisible({ timeout: 30_000 })
    const scrim = page.locator('[data-testid="mobile-share-scrim"]')
    await expect(scrim).toBeVisible()

    // The shield covers the whole collage frame (same extent as collage-canvas —
    // both are position:absolute; inset:0 against the same outerFrame ancestor).
    const frame = await page.locator('[data-testid="collage-canvas"]').boundingBox()
    const box = await scrim.boundingBox()
    expect(frame).not.toBeNull()
    expect(box).not.toBeNull()
    if (frame && box) {
      expect(box.width).toBeGreaterThanOrEqual(frame.width - 1)
      expect(box.height).toBeGreaterThanOrEqual(frame.height - 1)
    }
  })

  test('tapping a card selects it (selection frame appears) (N-58 stage 2)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()
    await expect(page.getByTestId('mobile-arrange-stage')).toBeVisible()
    const first = page.locator('[data-testid^="collage-el-"]').first()
    const id = await first.evaluate((el) => el.getAttribute('data-testid')?.replace('collage-el-', '') ?? '')
    await first.evaluate((el) => {
      const fire = (type: string, x: number, y: number): void => {
        const r = el.getBoundingClientRect()
        el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, clientX: r.left + r.width / 2 + x, clientY: r.top + r.height / 2 + y, pointerType: 'touch', isPrimary: true }))
      }
      fire('pointerdown', 0, 0)
      fire('pointerup', 0, 0) // tap (no move) => select only
    })
    await expect(page.getByTestId(`collage-selection-${id}`)).toBeVisible()
  })

  test('two fingers on a selected card resize it; the image is unaffected by board zoom (N-58 stage 2)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()
    await expect(page.getByTestId('mobile-arrange-stage')).toBeVisible()

    const first = page.locator('[data-testid^="collage-el-"]').first()
    const id = await first.evaluate((el) => el.getAttribute('data-testid')?.replace('collage-el-', '') ?? '')
    const beforeW = await first.evaluate((el) => (el as HTMLElement).style.width)

    // Tap-select first, in its OWN evaluate() — MobileArrangeGestures reads
    // props.selectedId (React state set by the tap's onSelect) to decide
    // pinch mode ('card' vs 'stage'). Firing the tap and the pinch in the
    // SAME synchronous evaluate() outraces React's re-render: the pinch's
    // pointerdown would still see the stale (null) selectedId and fall into
    // board-zoom mode instead of card-resize mode. Waiting on the selection
    // frame below forces a real commit before the pinch starts.
    await first.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const fire = (type: string): void =>
        void el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerType: 'touch', isPrimary: true }))
      fire('pointerdown')
      fire('pointerup')
    })
    await expect(page.getByTestId(`collage-selection-${id}`)).toBeVisible()

    // Now the two-finger spread ON the card (dist 100 -> 200 = 2x) via the viewport.
    await page.evaluate(() => {
      const card = document.querySelector('[data-testid^="collage-el-"]') as HTMLElement | null
      const vp = document.querySelector('[data-testid="mobile-arrange-viewport"]')
      if (!card || !vp) throw new Error('not found')
      const r = card.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const fireVp = (type: string, id: number, x: number, y: number): void =>
        void vp.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, clientX: x, clientY: y, pointerType: 'touch', isPrimary: id === 1 }))
      fireVp('pointerdown', 1, cx - 50, cy)
      fireVp('pointerdown', 2, cx + 50, cy)
      fireVp('pointermove', 2, cx + 150, cy)
      fireVp('pointerup', 1, cx - 50, cy)
      fireVp('pointerup', 2, cx + 150, cy)
    })
    const afterW = await first.evaluate((el) => (el as HTMLElement).style.width)
    expect(parseFloat(afterW)).toBeGreaterThan(parseFloat(beforeW) * 1.5)

    // Capture still succeeds and yields an image (board zoom/card edits are baked from state).
    await page.getByTestId('mobile-arrange-create').tap()
    await expect(page.getByTestId('mobile-share-result')).toBeVisible()
  })

  test('with nothing selected, two fingers zoom the board (N-58 stage 2)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()
    await expect(page.getByTestId('mobile-arrange-stage')).toBeVisible()
    await page.evaluate(() => {
      const vp = document.querySelector('[data-testid="mobile-arrange-viewport"]')
      if (!vp) throw new Error('viewport not found')
      const fire = (type: string, id: number, x: number, y: number): void =>
        void vp.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, clientX: x, clientY: y, pointerType: 'touch', isPrimary: id === 1 }))
      // no card selected (fresh arrange) => two fingers zoom the stage
      fire('pointerdown', 1, 150, 420)
      fire('pointerdown', 2, 250, 420) // dist 100
      fire('pointermove', 2, 350, 420) // dist 200 => 2x
      fire('pointerup', 1, 150, 420)
      fire('pointerup', 2, 350, 420)
    })
    const t = await page.getByTestId('mobile-arrange-stage').evaluate((el) => (el as HTMLElement).style.transform)
    const scale = Number(/scale\(([\d.]+)\)/.exec(t)?.[1])
    expect(scale).toBeGreaterThan(1.5)
  })

  test('the dock zoom buttons zoom the board; ZOOM FIT returns to scale 1 (mobile-arrange-ux-redesign)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()
    await expect(page.getByTestId('mobile-arrange-stage')).toBeVisible()

    const stage = page.getByTestId('mobile-arrange-stage')
    const readScale = async (): Promise<number> => {
      const t = await stage.evaluate((el) => (el as HTMLElement).style.transform)
      return Number(/scale\(([\d.]+)\)/.exec(t)?.[1])
    }

    expect(await readScale()).toBe(1)

    await page.getByTestId('mobile-arrange-zoom-in').click()
    await page.getByTestId('mobile-arrange-zoom-in').click()
    await page.getByTestId('mobile-arrange-zoom-in').click()
    expect(await readScale()).toBeGreaterThan(1)

    await page.getByTestId('mobile-arrange-zoom-fit').click()
    expect(await readScale()).toBe(1)
  })

  test('the dock zoom buttons zoom the board even while a card is selected (N-58 packed-board fix)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()
    await expect(page.getByTestId('mobile-arrange-stage')).toBeVisible()

    // select a card first (plain click, like "tapping a card shows the selection tools" below)
    // so we're in the "card selected" state
    const first = page.locator('[data-testid^="collage-el-"]').first()
    const id = await first.evaluate((el) => el.getAttribute('data-testid')?.replace('collage-el-', '') ?? '')
    await first.click()
    await expect(page.getByTestId(`collage-selection-${id}`)).toBeVisible()

    // click the dock's zoom-in a few times — must zoom the board WITHOUT any
    // deselect (the dock lives outside mobile-arrange-viewport, so it never
    // fires the viewport's blank-tap deselect handler).
    await page.getByTestId('mobile-arrange-zoom-in').click()
    await page.getByTestId('mobile-arrange-zoom-in').click()
    await page.getByTestId('mobile-arrange-zoom-in').click()

    const t = await page.getByTestId('mobile-arrange-stage').evaluate((el) => (el as HTMLElement).style.transform)
    const scale = Number(/scale\(([\d.]+)\)/.exec(t)?.[1])
    expect(scale).toBeGreaterThan(1.5)
    await expect(page.getByTestId(`collage-selection-${id}`)).toBeVisible()
  })

  test('tapping a card shows the selection tools; a blank tap clears them (N-58 stage2 increment1)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()
    await expect(page.getByTestId('mobile-arrange-stage')).toBeVisible()

    // UNDO/REDO are always present; the front/back/remove group only shows up
    // once something is selected (they now live in the same dock, not a
    // separate top bar).
    await expect(page.getByTestId('mobile-arrange-dock')).toBeVisible()
    await expect(page.getByTestId('mobile-arrange-selection-tools')).toHaveCount(0)

    const first = page.locator('[data-testid^="collage-el-"]').first()
    await first.click()
    await expect(page.getByTestId('mobile-arrange-selection-tools')).toBeVisible()
    await expect(page.getByTestId('mobile-arrange-to-front')).toBeVisible()
    await expect(page.getByTestId('mobile-arrange-to-back')).toBeVisible()
    await expect(page.getByTestId('mobile-arrange-remove')).toBeVisible()

    // A blank-area tap (dispatched straight on the viewport, same pattern as
    // the pinch tests above — e.target is then the viewport itself, which
    // MobileArrangeGestures.isOnCard() reads as "not a card") deselects.
    await page.evaluate(() => {
      const vp = document.querySelector('[data-testid="mobile-arrange-viewport"]')
      if (!vp) throw new Error('viewport not found')
      const fire = (type: string): void =>
        void vp.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 42, clientX: 5, clientY: 5, pointerType: 'touch', isPrimary: true }))
      fire('pointerdown')
      fire('pointerup')
    })
    await expect(page.getByTestId('mobile-arrange-selection-tools')).toHaveCount(0)
  })

  test('DELETE removes the selected card; UNDO restores it; REDO removes it again (N-58 stage2 increment1)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()
    await expect(page.getByTestId('mobile-arrange-stage')).toBeVisible()

    const cards = page.locator('[data-testid^="collage-el-"]')
    const before = await cards.count()
    expect(before).toBe(SEED_COUNT)

    // Nothing to undo yet — plain tap-select alone must not push a history
    // entry (the self-review calls this out explicitly: the auto-bring-to-front
    // on select is folded into the "before" snapshot of the NEXT gesture, not
    // recorded as its own step).
    await expect(page.getByTestId('mobile-arrange-undo')).toBeDisabled()

    await cards.first().click()
    await expect(page.getByTestId('mobile-arrange-selection-tools')).toBeVisible()
    await page.getByTestId('mobile-arrange-remove').click()

    await expect(cards).toHaveCount(before - 1)
    await expect(page.getByTestId('mobile-arrange-selection-tools')).toHaveCount(0)

    await expect(page.getByTestId('mobile-arrange-undo')).toBeEnabled()
    await page.getByTestId('mobile-arrange-undo').click()
    await expect(cards).toHaveCount(before)

    await expect(page.getByTestId('mobile-arrange-redo')).toBeEnabled()
    await page.getByTestId('mobile-arrange-redo').click()
    await expect(cards).toHaveCount(before - 1)
  })

  test('REMOVE shows an UNDO toast; the toast UNDO restores the card, and the link payload never shrinks (image != link invariant)', async ({ page }) => {
    await seedBoard(page)
    const capturedBody: { value: string | null } = { value: null }
    await stubCreate(page, 'e2eshare', capturedBody)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()
    await expect(page.getByTestId('mobile-arrange-stage')).toBeVisible()

    const cards = page.locator('[data-testid^="collage-el-"]')
    const before = await cards.count()
    expect(before).toBe(SEED_COUNT)

    // Remove one card from the image.
    await cards.first().click()
    await expect(page.getByTestId('mobile-arrange-selection-tools')).toBeVisible()
    await page.getByTestId('mobile-arrange-remove').click()
    await expect(cards).toHaveCount(before - 1)

    const toast = page.getByTestId('mobile-arrange-remove-toast')
    await expect(toast).toBeVisible()

    // The toast's OWN UNDO (not the dock's general history undo) restores the card.
    await page.getByTestId('mobile-arrange-remove-toast-undo').click()
    await expect(cards).toHaveCount(before)

    // Remove again and leave it removed — this is the state CREATE fires from.
    await cards.first().click()
    await expect(page.getByTestId('mobile-arrange-selection-tools')).toBeVisible()
    await page.getByTestId('mobile-arrange-remove').click()
    await expect(cards).toHaveCount(before - 1)

    // CREATE with a card missing from the image. buildArrangeShare (BoardRoot.tsx)
    // builds the link payload from `selectedIds` (the original selection made
    // BEFORE entering arrange) — removeCollageCardById only mutates the collage's
    // own positions/order/rotations state, never selectedIds — so the posted
    // payload must still carry every originally-selected URL even though the
    // captured IMAGE now has one fewer card.
    await page.getByTestId('mobile-arrange-create').click()
    await expect(page.getByTestId('mobile-share-result')).toBeVisible({ timeout: 30_000 })

    expect(capturedBody.value).not.toBeNull()
    const posted = JSON.parse(capturedBody.value ?? '{}') as PostedSharePayload
    expect(posted.share.cards).toHaveLength(SEED_COUNT)
    const postedUrls = new Set(posted.share.cards.map((c) => c.u))
    for (let i = 0; i < SEED_COUNT; i++) {
      expect(postedUrls.has(`https://example.com/${i}`)).toBe(true)
    }
  })

  test('a two-finger resize commits to history; UNDO reverts the width (N-58 stage2 increment1 — Critical fix regression guard)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()
    await expect(page.getByTestId('mobile-arrange-stage')).toBeVisible()

    const first = page.locator('[data-testid^="collage-el-"]').first()
    const id = await first.evaluate((el) => el.getAttribute('data-testid')?.replace('collage-el-', '') ?? '')
    const beforeW = await first.evaluate((el) => (el as HTMLElement).style.width)

    await expect(page.getByTestId('mobile-arrange-undo')).toBeDisabled()

    // Tap-select first, in its OWN evaluate() — see the note on the sibling
    // "two fingers on a selected card resize it" test above (React state
    // race between the tap's onSelect and the pinch's pointerdown).
    await first.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const fire = (type: string): void =>
        void el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerType: 'touch', isPrimary: true }))
      fire('pointerdown')
      fire('pointerup')
    })
    await expect(page.getByTestId(`collage-selection-${id}`)).toBeVisible()

    // Two-finger spread (dist 100 -> 200 = 2x) on the selected card.
    await page.evaluate(() => {
      const card = document.querySelector('[data-testid^="collage-el-"]') as HTMLElement | null
      const vp = document.querySelector('[data-testid="mobile-arrange-viewport"]')
      if (!card || !vp) throw new Error('not found')
      const r = card.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const fireVp = (type: string, id: number, x: number, y: number): void =>
        void vp.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, clientX: x, clientY: y, pointerType: 'touch', isPrimary: id === 1 }))
      fireVp('pointerdown', 1, cx - 50, cy)
      fireVp('pointerdown', 2, cx + 50, cy)
      fireVp('pointermove', 2, cx + 150, cy)
      fireVp('pointerup', 1, cx - 50, cy)
      fireVp('pointerup', 2, cx + 150, cy)
    })
    const pinchedW = await first.evaluate((el) => (el as HTMLElement).style.width)
    expect(parseFloat(pinchedW)).toBeGreaterThan(parseFloat(beforeW) * 1.5)

    // The pinch gesture is ONE history step (committed on pinch-end, not per
    // frame) — UNDO must revert the width in a single click.
    await expect(page.getByTestId('mobile-arrange-undo')).toBeEnabled()
    await page.getByTestId('mobile-arrange-undo').click()

    const revertedW = await first.evaluate((el) => (el as HTMLElement).style.width)
    expect(parseFloat(revertedW)).toBeCloseTo(parseFloat(beforeW), 0)
  })

  test('double-tapping blank space resets the board zoom to fit (N-58 stage2 increment1)', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()
    await expect(page.getByTestId('mobile-arrange-stage')).toBeVisible()

    // Zoom the board via the dock's zoom-in button (no card selection involved —
    // same pattern as "the dock zoom buttons zoom the board..." above).
    await page.getByTestId('mobile-arrange-zoom-in').click()
    await page.getByTestId('mobile-arrange-zoom-in').click()
    const stage = page.getByTestId('mobile-arrange-stage')
    const scaleBefore = await stage.evaluate((el) => Number(/scale\(([\d.]+)\)/.exec((el as HTMLElement).style.transform)?.[1]))
    expect(scaleBefore).toBeGreaterThan(1.5)

    // Two blank-area taps (pointerdown+up, no move), dispatched directly on
    // the viewport within the double-tap window (DOUBLE_TAP_MS=300,
    // DOUBLE_TAP_SLOP_PX=24 in MobileArrangeGestures.tsx) — dispatchEvent sets
    // e.target to the viewport itself regardless of what visually sits on top
    // of that screen point (chrome/cards), which is exactly what "blank"
    // means to isOnCard(). Real double-tap timing/registration is best
    // verified on a real device; this proves the state transition the gesture
    // drives (onDoubleTapFit -> setStageTransform(IDENTITY)).
    await page.evaluate(() => {
      const vp = document.querySelector('[data-testid="mobile-arrange-viewport"]')
      if (!vp) throw new Error('viewport not found')
      const fire = (type: string, id: number): void =>
        void vp.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, clientX: 20, clientY: 20, pointerType: 'touch', isPrimary: true }))
      fire('pointerdown', 61)
      fire('pointerup', 61)
      fire('pointerdown', 62)
      fire('pointerup', 62)
    })

    const scaleAfter = await stage.evaluate((el) => Number(/scale\(([\d.]+)\)/.exec((el as HTMLElement).style.transform)?.[1]))
    expect(scaleAfter).toBe(1)
  })
})

test.describe('desktop SHARE — unchanged', () => {
  test.use({ viewport: { width: 1489, height: 679 } })

  test('still uses the arrange stage with ShareSelectBar → ShareToast', async ({ page }) => {
    await seedBoard(page)
    await page.locator('[data-testid="share-pill"]').click()
    await expect(page.locator('[data-testid="select-share-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-share-select-bar"]')).toHaveCount(0)
    await page.locator('[data-testid="select-all-button"]').click()
    await page.locator('[data-testid="select-share-button"]').click()
    await expect(page.locator('[data-testid="share-toast-create"]')).toBeVisible()
    // mobile-arrange-ux-redesign: the mobile-only dock (UNDO/REDO/zoom/TO
    // FRONT/TO BACK/REMOVE/BACK/CREATE) must never mount on desktop.
    await expect(page.locator('[data-testid="mobile-arrange-dock"]')).toHaveCount(0)
  })

  test('hovering a collage card reveals a remove ×; removing it drops the card from the image but not from the link (desktop parity)', async ({ page }) => {
    await seedBoard(page)
    const capturedBody: { value: string | null } = { value: null }
    await stubCreate(page, 'e2eshare', capturedBody)

    await page.locator('[data-testid="share-pill"]').click()
    await page.locator('[data-testid="select-all-button"]').click()
    await page.locator('[data-testid="select-share-button"]').click()
    await expect(page.locator('[data-testid="share-toast-create"]')).toBeVisible()

    const cards = page.locator('[data-testid^="collage-el-"]')
    const before = await cards.count()
    expect(before).toBe(SEED_COUNT)

    const first = cards.first()
    const id = await first.evaluate((el) => el.getAttribute('data-testid')?.replace('collage-el-', '') ?? '')
    // The × is pointer-events:none until `.element:hover` — hover for real,
    // then click it (force: true bypasses only the receives-events re-check,
    // not the hover precondition itself, which already applied above).
    await first.hover()
    await page.locator(`[data-testid="collage-remove-${id}"]`).click({ force: true })

    await expect(cards).toHaveCount(before - 1)

    // CREATE with a card missing from the image — same invariant as the mobile
    // REMOVE test: buildArrangeShare reads `selectedIds`, which the desktop
    // hover-× never touches (only collage positions/order/rotations).
    await page.locator('[data-testid="share-toast-create"]').click()
    await expect(page.locator('[data-testid="share-toast-ready"]')).toBeVisible({ timeout: 30_000 })

    expect(capturedBody.value).not.toBeNull()
    const posted = JSON.parse(capturedBody.value ?? '{}') as PostedSharePayload
    expect(posted.share.cards).toHaveLength(SEED_COUNT)
    const postedUrls = new Set(posted.share.cards.map((c) => c.u))
    for (let i = 0; i < SEED_COUNT; i++) {
      expect(postedUrls.has(`https://example.com/${i}`)).toBe(true)
    }
  })
})
