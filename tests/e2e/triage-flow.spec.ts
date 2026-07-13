import { test, expect, type Page } from '@playwright/test'
import { seedDb, firstRunSuppressors, DB_NAME, type SeedRecord } from './helpers/seed-db'

// Restored from the pre-deletion file (git show 9fe834bb~1:tests/e2e/triage-flow.spec.ts)
// and rewritten against the CURRENT TriagePage (components/triage/TriagePage.tsx)
// and NewTagInput (components/triage/NewTagInput.tsx). The original file was
// deleted in 9fe834bb because the old numbered-chip swipe entry point
// (sidebar "仕分けを始める" button, '1'/'s' keys, 'ボードへ戻る' button) was
// replaced by TAG MODE in s170 — but that deletion was too aggressive:
// /triage itself is still reachable (BoardRoot.tsx:3393 pushes
// '/triage?onboarding=1' for the onboarding replay) and TriagePage still
// renders live, working UI — including NewTagInput's tag-creation flow
// (data-testid="new-tag-trigger" / "new-tag-input") — with zero e2e coverage
// after the deletion.

async function readStore<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    async ({ dbName, store }) =>
      new Promise<T[]>((resolve, reject) => {
        // Unversioned open: by the time this runs the app has already
        // created/opened the DB (same reasoning as seed-db.ts's openCurrent
        // and bookmarklet-save.spec.ts's readAllBookmarks).
        const req = indexedDB.open(dbName)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(store, 'readonly')
          const all = tx.objectStore(store).getAll()
          all.onsuccess = () => { db.close(); resolve(all.result as T[]) }
          all.onerror = () => reject(new Error('getAll error'))
        }
        req.onerror = () => reject(new Error('open error'))
      }),
    { dbName: DB_NAME, store },
  )
}

/** The app seeds ~11 onboardingDemo bookmarks into a genuinely fresh IDB the
 *  very first time BoardRoot mounts, if its own "first-run onboarding gate"
 *  effect (components/board/BoardRoot.tsx ~line 919, `shouldAutoStartOnboarding`
 *  in lib/onboarding/onboarding-state.ts) reads `onboarding-completed` before
 *  seedDb()'s write of it (via firstRunSuppressors) has landed — seedDb()
 *  navigates to /board (mounting the real app) BEFORE it writes any seed
 *  rows, so this is a genuine race between the app's own mount effect and
 *  our settings write, observed directly (a run without this sweep showed
 *  13 items in the triage queue instead of the 2 this test seeded, including
 *  a built-in demo card, "The Millinery Shop — Edgar Degas"). seed-db.ts
 *  itself is only race-fixed for IDB open/creation, not for this app-level
 *  behavior, and it must not be modified — so this sweep runs in the spec
 *  after seedDb() returns (by which point the reload it ends with means any
 *  racy demo-seed has already committed) to guarantee the triage queue only
 *  ever contains the bookmarks this test controls. */
async function clearOnboardingDemoCards(page: Page): Promise<void> {
  await page.evaluate(async (dbName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(new Error('open error'))
    })
    const tx = db.transaction(['bookmarks', 'cards'], 'readwrite')
    const bookmarkStore = tx.objectStore('bookmarks')
    const cardStore = tx.objectStore('cards')
    const allBookmarks = await new Promise<Array<{ id: string; onboardingDemo?: boolean }>>((resolve, reject) => {
      const req = bookmarkStore.getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(new Error('getAll error'))
    })
    const demoIds = new Set(allBookmarks.filter((b) => b.onboardingDemo === true).map((b) => b.id))
    for (const id of demoIds) bookmarkStore.delete(id)
    if (demoIds.size > 0) {
      const allCards = await new Promise<Array<{ id: string; bookmarkId: string }>>((resolve, reject) => {
        const req = cardStore.getAll()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(new Error('getAll error'))
      })
      for (const c of allCards) if (demoIds.has(c.bookmarkId)) cardStore.delete(c.id)
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }, DB_NAME)
}

/** Two untagged, alive bookmarks + their cards. linkStatus:'alive' +
 *  lastCheckedAt keep the board's dead-link revalidation from ever flipping
 *  a seeded row to 'gone' mid-test (lightbox-flow.spec.ts hit this exact
 *  trap against /api/ogp 404s under `pnpm dev` — see task-2b-report.md #2). */
function seedTwoBookmarks(): SeedRecord[] {
  const now = new Date().toISOString()
  const rows: SeedRecord[] = []
  for (let i = 0; i < 2; i++) {
    rows.push({
      store: 'bookmarks',
      value: {
        id: `triage-b-${i}`,
        url: `https://example.com/triage-${i}`,
        title: `Triage card ${i}`,
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
        linkStatus: 'alive',
        lastCheckedAt: Date.now(),
      },
    })
    rows.push({
      store: 'cards',
      value: {
        id: `triage-c-${i}`,
        bookmarkId: `triage-b-${i}`,
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
  return rows
}

test.describe('Triage page (dormant-but-reachable; still has live tag-creation UI)', () => {
  test('creates a tag from the new-tag input and applies it to the current card', async ({ page }) => {
    await seedDb(page, [...firstRunSuppressors(), ...seedTwoBookmarks()])
    await clearOnboardingDemoCards(page)

    // '?onboarding=1' (BoardRoot.tsx:3393, the only in-app entry point left)
    // scopes the queue to items with onboardingDemo===true only (TriagePage.tsx
    // queue useMemo: `if (onboarding) return allItems.filter(it => it.onboardingDemo === true)`)
    // — none of our seeded rows have that flag, so it would render the
    // total===0 empty state, never data-testid="triage-page". A direct
    // ?mode=all navigation is what actually reaches the live page with real
    // bookmarks in its queue (TriagePage.tsx parseMode/queue derivation).
    await page.goto('/triage?mode=all')
    await expect(page.getByTestId('triage-page')).toBeVisible()
    await expect(page.getByText('01 / 02')).toBeVisible()

    await page.getByTestId('new-tag-trigger').click()
    const input = page.getByTestId('new-tag-input')
    await expect(input).toBeVisible()
    await input.fill('e2e-design')
    await input.press('Enter')

    // NewTagInput's onCreate prop is TriagePage's handleCreateTagAddArmed
    // (TriagePage.tsx ~404-415): it creates the tag via useTags().create AND
    // arms it (adds to armedTagIds) in the same call. Assert both halves of
    // that real post-condition — a rendered chip that is also armed —
    // instead of just checking a div exists.
    const chip = page.getByTestId('top-tag-strip').getByRole('button', { name: /e2e-design/ })
    await expect(chip).toBeVisible()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')

    // Apply the armed tag to the current card (YES -> handleYes -> persistTags).
    await page.getByTestId('triage-yes-button').click()
    // Progress only advances after persistTags' promise resolves
    // (TriagePage.tsx handleYes: setTimeout -> persistTags(...).finally(() => setIndex(...))),
    // so waiting for it is a genuine synchronization point, not a fixed sleep.
    await expect(page.getByText('02 / 02')).toBeVisible()

    const [allBookmarks, tags] = await Promise.all([
      readStore<{ id: string; tags: string[] }>(page, 'bookmarks'),
      readStore<{ id: string; name: string }>(page, 'tags'),
    ])
    const created = tags.find((tg) => tg.name === 'e2e-design')
    expect(created).toBeTruthy()
    // Don't assume which seeded row is "current" first (board sort is
    // orderIndex DESC — lib/storage/use-board-data.ts — so seed order != queue
    // order). Assert on the actual observable outcome instead: exactly one
    // bookmark now carries exactly the created tag.
    const taggedBookmarks = allBookmarks.filter((b) => b.tags.length > 0)
    expect(taggedBookmarks).toHaveLength(1)
    expect(taggedBookmarks[0].tags).toEqual([created!.id])
  })

  test('Escape exits triage back to the board', async ({ page }) => {
    await seedDb(page, [...firstRunSuppressors(), ...seedTwoBookmarks()])
    await clearOnboardingDemoCards(page)
    await page.goto('/triage?mode=all')
    await expect(page.getByTestId('triage-page')).toBeVisible()

    // Current exit gesture (TriagePage.tsx window keydown handler:
    // `if (e.key === 'Escape') { ...; exit(); return }`, exit = router.push('/board')).
    // The old test's 'ボードへ戻る' button and '1'/'s' keys are gone — they
    // belonged to the pre-s170 numbered-chip swipe UI (task-2b-report.md #4).
    // Escape is the current equivalent gesture.
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/board/)
  })
})
