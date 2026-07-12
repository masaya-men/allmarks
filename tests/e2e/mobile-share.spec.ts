import { test, expect, type Page } from '@playwright/test'

const DB_NAME = 'booklage-db'
// The brief's default (6) and its suggested fallback (24) both leave the last
// justified row a centred partial (fitSelectionToScreen centres any row that
// doesn't reach the band's width — collage-layout.ts:169-170,222). With this
// card aspect (placeholder cards, PLACEHOLDER_ASPECT=1.25) and the board's
// default card width (BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX=267.84), 24 lays out
// as 7+7+7+3 — the trailing row of 3 is centred and does NOT reach the edges.
// A naive min/max-over-all-cards check still passes at 24 (rows 1-3 reach the
// edges, masking row 4's centred gap in the aggregate), which is exactly the
// "passes for the wrong reason" trap: it would not catch a regression that
// broke only the last row. 28 (verified by directly probing
// fitSelectionToScreen with this env's real constants — see task-9 report) is
// the smallest count above 24 that packs into 4 full rows of 7 with none left
// over, so every row — not just the aggregate extremes — reaches both edges.
const SEED_COUNT = 28

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
 *  `next dev`. Fulfil it so the flow reaches LINK READY. */
async function stubCreate(page: Page, id = 'e2eshare'): Promise<void> {
  await page.route('**/api/share/create', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id }) }),
  )
  // The post-create cache warm hits /og/<id>.jpg, which also does not exist.
  await page.route('**/og/*.jpg', (route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: '' }))
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

  test('SELECT ALL → CREATE arranges into the centred 1.91:1 band and yields a link', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)

    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await expect(page.locator('[data-testid="mobile-select-counter"]')).toHaveText(`${SEED_COUNT} / 100 SELECTED`)

    await page.locator('[data-testid="mobile-select-create"]').click()

    // ARRANGE (tap 1) → edit stage: the selection is auto-placed into the band
    // and the arrange bar + band guide come up, but nothing has been shot yet.
    await expect(page.locator('[data-testid="mobile-arrange-bar"]')).toBeVisible()
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

    const bandH = band.vw * (630 / 1200)
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

  test('the preview is a real 1200x630 image', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()

    // ARRANGE → edit stage, then CREATE → shoot (N-58 two-tap flow).
    await expect(page.locator('[data-testid="mobile-arrange-bar"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-band-overlay"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-share-result"]')).toHaveCount(0)
    await page.locator('[data-testid="mobile-arrange-create"]').click()

    const preview = page.locator('[data-testid="mobile-share-preview"]')
    await expect(preview).toBeVisible({ timeout: 30_000 })
    const dims = await preview.evaluate((el) => {
      const img = el as HTMLImageElement
      return { w: img.naturalWidth, h: img.naturalHeight, src: img.src.slice(0, 22) }
    })
    expect(dims).toEqual({ w: 1200, h: 630, src: 'data:image/jpeg;base64' })
  })

  // handleMobileCaptureAndCreate (BoardRoot.tsx) captures with `fit: 'cover'`. If that
  // ever regresses to `fit: 'contain'`, a 390×844 portrait board gets scaled to fit
  // *inside* 1200×630 (normalize-shot.ts computeContainRect: scale = min(1200/390,
  // 630/844) ≈ 0.746, drawn width ≈ 291px) and the ~450px on each side is a flat
  // fillRect(boardColor) letterbox — reintroducing the exact bug this whole feature
  // exists to kill.
  //
  // No other assertion in this suite (or anywhere in the repo) can catch that
  // regression. `fitSelectionToScreen` lays the collage into the band identically
  // regardless of what `fit` the *capture* later uses, so the band's DOM geometry
  // (tested above) is unchanged either way. And normalizeShotToJpegDataUrl always
  // sets `canvas.width = 1200; canvas.height = 630` for both fits, so the produced
  // image's *dimensions* (tested just above) are identical too. The difference only
  // shows up in the pixel *content* of the produced JPEG — so this test decodes it.
  test('the preview image has no cover→contain letterbox bars', async ({ page }) => {
    await seedBoard(page)
    await stubCreate(page)
    await page.locator('[data-testid="mobile-nav-share"]').click()
    await page.locator('[data-testid="mobile-select-all"]').click()
    await page.locator('[data-testid="mobile-select-create"]').click()

    // ARRANGE → edit stage, then CREATE → shoot (N-58 two-tap flow).
    await expect(page.locator('[data-testid="mobile-arrange-bar"]')).toBeVisible()
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
    // hard edges. `contain`'s letterbox bars are a single flat boardColor fill, so
    // under `contain` each strip collapses to exactly 1 distinct colour; under
    // `cover` the strip crosses real card pixels and board background and is many.
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
    await expect(page.locator('[data-testid="mobile-arrange-bar"]')).toBeVisible()

    await page.locator('[data-testid="mobile-arrange-back"]').click()

    await expect(page.locator('[data-testid="mobile-share-select-bar"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-arrange-bar"]')).toHaveCount(0)
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
  })
})
