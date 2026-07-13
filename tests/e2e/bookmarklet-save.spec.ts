import { test, expect, type Page } from '@playwright/test'
import { seedDb, firstRunSuppressors, DB_NAME } from './helpers/seed-db'

// Post-save read-back (not a seed write). Unversioned open is safe here — by
// the time this runs, saveBookmarkDeduped() has already created/opened the
// app's DB, so there's no upgrade/creation race to lose (same reasoning as
// seed-db.ts's own openCurrent()). This used to be a version-pinned
// indexedDB.open(dbName, 9), which would VersionError now that the app is on
// DB_VERSION = 16 (lib/constants.ts).
async function readAllBookmarks(page: Page): Promise<Array<{ id: string; tags: string[] }>> {
  return page.evaluate(
    async (dbName) =>
      new Promise<Array<{ id: string; tags: string[] }>>((resolve, reject) => {
        const req = indexedDB.open(dbName)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('bookmarks', 'readonly')
          const all = tx.objectStore('bookmarks').getAll()
          all.onsuccess = () => {
            db.close()
            resolve(
              (all.result as Array<{ id: string; tags?: string[] }>).map((b) => ({
                id: b.id, tags: b.tags ?? [],
              })),
            )
          }
          all.onerror = () => reject(new Error('getAll error'))
        }
        req.onerror = () => reject(new Error('open error'))
      }),
    DB_NAME,
  )
}

test.describe('Bookmarklet save toast flow', () => {
  // The real bookmarklet always opens a FIXED-SIZE popup —
  // window.open(..., 'width=256,height=256,...') — see BOOKMARKLET_SOURCE in
  // lib/utils/bookmarklet.ts. lib/bookmarklet/save-window-plan.ts's
  // isOpenedAsTab() treats any window wider than 460 or taller than 620 as
  // "the browser forced this into a full tab" (a macOS-fullscreen-Chrome
  // heuristic, feature commit a3d53ed5) and SaveToast then renders a
  // completely different confirmation subtree, data-testid="save-tab-fullscreen",
  // instead of data-testid="save-toast". Playwright's default 1280x800
  // viewport reads as "forced tab" every time, which is why this test used to
  // fail looking for "save-toast". Match the test's real popup context
  // (256x256, same size the bookmarklet itself requests) so the test
  // exercises the confirmation path it's actually meant to verify.
  test.describe('opened as the bookmarklet popup (256x256)', () => {
    test.use({ viewport: { width: 256, height: 256 } })

    test('auto-saves and shows checkmark', async ({ page }) => {
      // quick-tag-on-save defaults to ON (lib/storage/quick-tag-setting.ts:
      // "Default ON"). When it's on and no PiP is active, SaveToast's
      // shouldShowQuickTagWindow() makes plan.showTags true, which sets
      // tagData and switches the render to the separate
      // data-testid="save-tag-window" tag-editing subtree instead of the
      // plain checkmark confirmation this test targets. Seed quick-tag OFF so
      // the popup path renders the bare data-testid="save-toast" checkmark
      // this test is actually about — a real, orthogonal feature, not a
      // workaround for the viewport fix above.
      await seedDb(page, [
        ...firstRunSuppressors(),
        { store: 'settings', value: { key: 'quick-tag-on-save', enabled: false } },
      ])

      const params = new URLSearchParams({
        url: 'https://example.com/article',
        title: 'Example Article',
        image: 'https://example.com/og.png',
        desc: 'Sample description',
        site: 'Example',
        favicon: 'https://example.com/favicon.ico',
      })
      await page.goto(`/save?${params.toString()}`)

      await expect(page.getByTestId('save-toast')).toBeVisible()
      await expect(page.getByTestId('save-toast')).toHaveAttribute('data-state', 'saved', { timeout: 3000 })
      // "Inbox に保存しました" (messages/ja.json bookmarklet.toast.saved) is dead
      // copy from a pre-a3d53ed5 i18n'd SaveToast. The current component
      // (read in full) hardcodes English LABELS = { saved: 'Saved', ... } with
      // no useTranslations/i18n import at all — confirmed by grep, not from
      // the key name. Assert the label that's actually rendered now, the same
      // way the component's own unit test does (SaveToast.test.tsx:64).
      await expect(page.getByTestId('status-label')).toHaveAttribute('aria-label', 'Saved')

      // The confirmation UI is necessary but not sufficient — also verify the
      // bookmark was actually persisted, not just that a div rendered.
      const bookmarks = await readAllBookmarks(page)
      expect(bookmarks).toHaveLength(1)
      expect(bookmarks[0].tags).toEqual([])
    })
  })

  test('shows instructions when opened without url param', async ({ page }) => {
    await page.goto('/save')
    await expect(page.getByText('ブックマークレットから開いてください')).toBeVisible()
  })
})
