import { test, expect, type Page } from '@playwright/test'
import { seedDb, firstRunSuppressors, type SeedRecord } from './helpers/seed-db'

// N-31-lite (s219 user request): dragging a rectangle over empty background
// while in TAG MODE should rubber-band select every card it covers, instead
// of nudging/panning the board (the old grab-wiggle behavior for a plain
// left-drag). Verifies both that cards get selected AND that the normal
// grab-wiggle CSS var stays untouched (proving wiggle didn't also engage).

async function seedThreeBookmarks(page: Page): Promise<void> {
  const now = new Date().toISOString()
  const bm = (id: string, orderIndex: number): SeedRecord[] => [
    {
      store: 'bookmarks',
      value: {
        id: `bm-${id}`, url: `https://example.com/${id}`, title: id.toUpperCase(), description: '', thumbnail: '',
        favicon: '', siteName: '', type: 'website', savedAt: now, tags: [], displayMode: null,
        ogpStatus: 'fetched', sizePreset: 'M', orderIndex, linkStatus: 'alive',
      },
    },
    {
      store: 'cards',
      value: { id: `c-${id}`, bookmarkId: `bm-${id}`, folderId: '', x: 0, y: 0, rotation: 0, scale: 1, zIndex: 0, gridIndex: orderIndex, isManuallyPlaced: false, width: 280, height: 210 },
    },
  ]
  const records: SeedRecord[] = [
    ...firstRunSuppressors(),
    ...bm('a', 0),
    ...bm('b', 1),
    ...bm('c', 2),
  ]
  await seedDb(page, records)
}

test('dragging a rectangle over cards in TAG MODE selects them (marquee), not wiggle-pan', async ({ page }) => {
  await seedThreeBookmarks(page)
  await page.locator('[data-bookmark-id="bm-a"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-bookmark-id="bm-b"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-bookmark-id="bm-c"]').waitFor({ timeout: 10_000 })

  await page.getByTestId('tag-button').click()

  const boxA = await page.locator('[data-bookmark-id="bm-a"]').boundingBox()
  const boxB = await page.locator('[data-bookmark-id="bm-b"]').boundingBox()
  const boxC = await page.locator('[data-bookmark-id="bm-c"]').boundingBox()
  const layerBox = await page.locator('[data-interaction-layer]').boundingBox()
  expect(boxA && boxB && boxC && layerBox).toBeTruthy()
  if (!boxA || !boxB || !boxC || !layerBox) throw new Error('unreachable')

  // Clamp to inside the interaction layer (there's a decorative frame margin
  // around it that swallows pointer events aimed outside its bounds).
  const minX = Math.max(layerBox.x + 5, Math.min(boxA.x, boxB.x, boxC.x) - 30)
  const minY = Math.max(layerBox.y + 5, Math.min(boxA.y, boxB.y, boxC.y) - 30)
  const maxX = Math.min(layerBox.x + layerBox.width - 5, Math.max(boxA.x + boxA.width, boxB.x + boxB.width, boxC.x + boxC.width) + 10)
  const maxY = Math.min(layerBox.y + layerBox.height - 5, Math.max(boxA.y + boxA.height, boxB.y + boxB.height, boxC.y + boxC.height) + 10)

  // Drag a rectangle that starts on empty background (above-left of every
  // card) and grows to cover all three.
  await page.mouse.move(minX, minY)
  await page.mouse.down()
  // A visible marquee box should now be rendered.
  await expect(page.locator('[data-marquee-select]')).toBeVisible()
  await page.mouse.move((minX + maxX) / 2, (minY + maxY) / 2, { steps: 5 })
  await page.mouse.move(maxX, maxY, { steps: 5 })
  await page.mouse.up()

  await expect(page.locator('[data-marquee-select]')).toHaveCount(0)
  // data-selected lives on the per-card selection-checkmark overlay (a child
  // of the [data-bookmark-id] wrapper), not on the wrapper itself.
  await expect(page.locator('[data-bookmark-id="bm-a"] [data-selected]')).toHaveAttribute('data-selected', 'true')
  await expect(page.locator('[data-bookmark-id="bm-b"] [data-selected]')).toHaveAttribute('data-selected', 'true')
  await expect(page.locator('[data-bookmark-id="bm-c"] [data-selected]')).toHaveAttribute('data-selected', 'true')

  // The board did not also pan/wiggle from this same drag (grab-wiggle CSS
  // vars stay at their rest value) -- proves 'marquee' intent replaced
  // 'wiggle', it didn't just run alongside it.
  const grabX = await page.locator('[data-onboarding-target="paste-zone"]').evaluate(
    (el) => getComputedStyle(el).getPropertyValue('--grab-x'),
  )
  expect(grabX.trim()).toBe('0px')
})

test('a plain tap (no drag) on empty background in TAG MODE still exits TAG MODE', async ({ page }) => {
  await seedThreeBookmarks(page)
  await page.locator('[data-bookmark-id="bm-a"]').waitFor({ timeout: 10_000 })

  await page.getByTestId('tag-button').click()
  await expect(page.getByTestId('tag-mode-done')).toBeVisible()

  const boxA = await page.locator('[data-bookmark-id="bm-a"]').boundingBox()
  expect(boxA).toBeTruthy()
  if (!boxA) throw new Error('unreachable')
  // Click well above the topmost card -- empty background, no drag.
  await page.mouse.click(boxA.x + boxA.width / 2, Math.max(10, boxA.y - 80))

  await expect(page.getByTestId('tag-mode-done')).toHaveCount(0)
})
