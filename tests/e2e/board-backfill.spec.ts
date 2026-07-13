import { test, expect } from '@playwright/test'
import { seedDb, firstRunSuppressors, DB_NAME } from './helpers/seed-db'

/* The /api/tweet-meta proxy is mocked at the route level so the test does
 * not depend on Twitter syndication availability or rate limits. The mock
 * returns a 2-photo mediaSlots payload that backfillTweetMeta will then
 * write through to IDB. */
test('Phase B: v12 photos-only bookmark gets mediaSlots backfilled within 5s of mount', async ({ page, context }) => {
  // Mock the proxy.
  await context.route('**/api/tweet-meta?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id_str: '12345',
        text: 'two photos',
        photos: [
          { url: 'https://pbs.twimg.com/a.jpg', width: 800, height: 600 },
          { url: 'https://pbs.twimg.com/b.jpg', width: 800, height: 600 },
        ],
        user: { name: 'A', screen_name: 'a' },
      }),
    })
  })

  // Seed a v12 photos-only bookmark (intentionally old shape — no mediaSlots
  // field — since backfillTweetMeta runs at RUNTIME regardless of the DB
  // schema version, so this is exactly what the test is verifying).
  await seedDb(page, [
    ...firstRunSuppressors(),
    {
      store: 'bookmarks',
      value: {
        id: 'b1',
        url: 'https://x.com/u/status/12345',
        title: 'old', description: '', thumbnail: '', favicon: '',
        siteName: 'X', type: 'tweet',
        savedAt: new Date().toISOString(),
        ogpStatus: 'fetched', tags: [],
        cardWidth: 240, sizePreset: 'S', orderIndex: 0,
        photos: ['https://pbs.twimg.com/a.jpg', 'https://pbs.twimg.com/b.jpg'],
        // intentionally no mediaSlots field
      },
    },
    {
      store: 'cards',
      value: {
        id: 'c1', bookmarkId: 'b1', folderId: '',
        x: 240, y: 80, rotation: 0, scale: 1, zIndex: 1,
        gridIndex: 0, isManuallyPlaced: false,
        width: 240, height: 240,
      },
    },
  ])
  await page.waitForSelector('[data-bookmark-id="b1"]')

  // Wait up to 5s for the queue to drain (200ms interval × 1 task ≈ 200ms
  // dispatch + ~upstream fetch). 5s is generous to absorb CI variance.
  await expect.poll(async () => {
    return await page.evaluate(async (dbName) => {
      // Version-less open: reads the app's current schema whatever version
      // it is at. A hardcoded version here would throw VersionError once
      // DB_VERSION advances past it (opening with a version LOWER than the
      // DB's current version is a spec-level error, not just stale data).
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      const tx = db.transaction('bookmarks', 'readonly')
      const get = tx.objectStore('bookmarks').get('b1')
      const bm = await new Promise<{ mediaSlots?: unknown[] } | undefined>((resolve, reject) => {
        get.onsuccess = () => resolve(get.result as never)
        get.onerror = () => reject(get.error)
      })
      db.close()
      return bm?.mediaSlots?.length ?? 0
    }, DB_NAME)
  }, { timeout: 5000, intervals: [200, 200, 400, 800] }).toBeGreaterThanOrEqual(2)
})
