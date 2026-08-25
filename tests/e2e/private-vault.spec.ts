import { test, expect, type Page } from '@playwright/test'
import { seedDb, firstRunSuppressors, DB_NAME, type SeedRecord } from './helpers/seed-db'

// Private vault (Phase 1) end-to-end coverage — task 15 of the private-vault
// plan. Locators below are sourced from the real shipped components (read
// directly, not guessed):
//   - components/board/ExtensionEntry.tsx: private-entry-button (+ data-unlocked)
//   - components/board/PrivateSetupDialog.tsx: private-setup-dialog/cancel/create,
//     inputs at #private-setup-password / #private-setup-confirm / #private-setup-hint
//   - components/board/PrivateUnlockDialog.tsx: private-unlock-dialog/cancel/submit,
//     input at #private-unlock-password
//   - components/board/PrivateShareConfirmDialog.tsx: private-share-confirm-dialog/cancel/share
//   - components/board/CardsLayer.tsx (~1655-1740): a card's "+ TAG" popover
//     (data-testid="card-add-tag-button", hover-revealed, pointer-events:none
//     until hovered) -> TagAddPopover now renders a dedicated pinned
//     data-testid="tag-add-popover-private" chip (privateEntry prop), routed
//     through BoardRoot's handlePrivateEntry — NOT the generic
//     onAddExisting/handleTagToggle path used by ordinary tags.
//   - components/board/TagDropPanel.tsx: MANAGE TAGS' right-edge panel now
//     also renders a pinned data-testid="tag-drop-private" row
//     (data-tag-id="__private__", CardsLayer's generic drag hit-test treats
//     it like any other [data-tag-id] drop target) for batch-encrypting the
//     current card selection.
//   - components/board/BoardMobileTagBar.tsx: same batch-encrypt path on
//     mobile via a tap on data-testid="mobile-tag-private".
//   - components/board/FilterPill.tsx: a pinned data-testid="filter-pill-private"
//     row (below TRASH/DEAD LINKS) in every state — not-set-up/locked open the
//     setup/unlock dialog with auto-resume, unlocked toggles the filter.
//   - components/board/FilterPill.tsx: filter-pill (trigger) / filter-pill-menu
//     (always-mounted dropdown), tag rows render the tag's own name as their
//     label text (see labelFor/itemLabel) — verified against
//     tests/e2e/triage-flow.spec.ts's pattern of clicking a tag by name.
//   - components/board/ShareSelectBar.tsx + ShareToast.tsx: select-all-button /
//     select-share-button / share-toast-create / share-toast-count / share-toast-ready
//     — verified against tests/e2e/board-share-polish.spec.ts's desktop SHARE flow
//     (share-pill -> select-all-button -> select-share-button -> share-toast-create).

const PASSWORD = 'testpass123'
const BOOKMARK_ID = 'priv-b-0'

/** One alive, untagged bookmark + its card. linkStatus:'alive' matches this
 *  repo's established e2e convention (reference_e2e_seed_helper /
 *  triage-flow.spec.ts's seedTwoBookmarks) for a card that's genuinely
 *  clickable/selectable, not just visually present. */
function seedOneBookmark(): SeedRecord[] {
  const now = new Date().toISOString()
  return [
    {
      store: 'bookmarks',
      value: {
        id: BOOKMARK_ID,
        url: 'https://example.com/private-vault-e2e',
        title: 'Private vault e2e card',
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
        orderIndex: 0,
        linkStatus: 'alive',
        lastCheckedAt: Date.now(),
      },
    },
    {
      store: 'cards',
      value: {
        id: 'priv-c-0',
        bookmarkId: BOOKMARK_ID,
        folderId: '',
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        zIndex: 0,
        gridIndex: 0,
        isManuallyPlaced: false,
        width: 240,
        height: 180,
      },
    },
  ]
}

/** Two alive, untagged bookmarks + their cards — same shape as
 *  seedOneBookmark, distinct ids/urls, for the batch-encrypt (multi-select)
 *  test below. */
function seedTwoBookmarks(): SeedRecord[] {
  const now = new Date().toISOString()
  const ids = [BOOKMARK_ID, 'priv-b-1']
  return ids.flatMap((id, i) => [
    {
      store: 'bookmarks',
      value: {
        id,
        url: `https://example.com/private-vault-e2e-${i}`,
        title: `Private vault e2e card ${i}`,
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
    },
    {
      store: 'cards',
      value: {
        id: `priv-c-${i}`,
        bookmarkId: id,
        folderId: '',
        x: i * 260,
        y: 0,
        rotation: 0,
        scale: 1,
        zIndex: i,
        gridIndex: i,
        isManuallyPlaced: false,
        width: 240,
        height: 180,
      },
    },
  ] as SeedRecord[])
}

/** Open the unified right-docked SETTINGS drawer (ExtensionEntry's
 *  ChromeDrawer). Mirrors tests/e2e/board-theme.spec.ts's
 *  "switching to paper-atelier..." test (extension-settings ->
 *  extension-settings-drawer visible). */
async function openSettings(page: Page): Promise<void> {
  const settings = page.getByTestId('extension-settings')
  await settings.scrollIntoViewIfNeeded()
  await settings.click()
  await page.getByTestId('extension-settings-drawer').waitFor({ state: 'visible', timeout: 10_000 })
}

test('Private: create, disappears on reload while locked, reappears when unlocked, gated from SHARE', async ({ page }) => {
  // 1. Seed one bookmark, load /board.
  await seedDb(page, [...firstRunSuppressors(), ...seedOneBookmark()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  const card = page.locator(`[data-bookmark-id="${BOOKMARK_ID}"]`)
  await expect(card).toBeVisible({ timeout: 15_000 })

  // 2. SETTINGS -> PRIVATE -> fill setup dialog -> CREATE.
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  const setupDialog = page.getByTestId('private-setup-dialog')
  await expect(setupDialog).toBeVisible()
  await page.locator('#private-setup-password').fill(PASSWORD)
  await page.locator('#private-setup-confirm').fill(PASSWORD)
  await page.getByTestId('private-setup-create').click()
  await expect(setupDialog).toHaveCount(0)
  // The SETTINGS drawer auto-closes the moment we interact with the setup
  // dialog: ChromeDrawer's own outside-pointerdown-close listener (capture
  // phase, ChromeDrawer.tsx ~55-63) treats any pointerdown outside its own
  // panel as a close request, and PrivateSetupDialog is a separate top-level
  // portal/overlay, not a descendant of the drawer panel — so the very first
  // `.fill()` (which clicks to focus) already closed it. Reopen it to observe
  // the unlocked state. BoardRoot's privateStatus flips to 'unlocked' the
  // moment createVault's session is set (ExtensionEntry.tsx data-unlocked /
  // disabled) — also the window in which the Private tag is genuinely
  // addable via the popover below (useTags().tags hides isPrivateVault rows
  // while locked).
  await openSettings(page)
  await expect(page.getByTestId('private-entry-button')).toHaveAttribute('data-unlocked', 'true')

  // 3. Tag the seeded bookmark with the new Private tag via the per-card
  // "+ TAG" popover (CardsLayer.tsx card-add-tag-button -> TagAddPopover).
  // The button is pointer-events:none until the card is genuinely hovered
  // (CardsLayer.tsx ~1693-1696), so a real hover is required before the
  // click can hit-test it at all; `force: true` on the click itself only
  // bypasses Playwright's own redundant receives-events re-check (same
  // pattern as tests/e2e/mobile-share.spec.ts's hover-then-force-click on
  // the collage remove ×), not the pointer-events gate.
  await card.hover()
  await card.getByTestId('card-add-tag-button').click({ force: true })
  // Private Phase 2 (s203): the popover no longer offers Private as a generic
  // chip (TagAddPopover/index.tsx renderExistingChip) — it's a dedicated,
  // always-rendered privateEntry slot instead, routed through BoardRoot's
  // handlePrivateEntry (not onAddExisting/handleTagToggle).
  await card.getByTestId('tag-add-popover-private').click()
  // Containment is immediate, not merely a post-reload effect: the moment
  // the write lands, BoardRoot's `items` state updates and filteredItems
  // (lib/board/filter.ts's privateGatePasses) drops any item carrying the
  // Private tag from every filter except an explicit Private-tag one — so
  // the card (and the popover that was just open on it) disappears from
  // this default ALL view right away, confirmed against the FilterPill's
  // own tag-count readout (Private's row count goes 0 -> 1, ALL's goes
  // 1 -> 0) while iterating on this test. That rules out asserting a
  // "checked" chip state on the card afterward — there's no card left to
  // hold one — so the vanish itself is the correct, stronger assertion here.
  await expect(card).toHaveCount(0)

  // 4. Reload the page — this is also the vault's entire re-lock mechanism
  // (lib/private/vault-session.ts: a plain module singleton, reset by any
  // reload/tab-close; no separate "lock now" path in Phase 1).
  await page.reload()
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })

  // 5. Locked: the bookmark must not render at all (lib/board/filter.ts's
  // privateGatePasses excludes it from the default ALL view outright — not
  // just visually hidden). The Private ROW ITSELF is Phase 2 (s203)
  // always-visible chrome, though — it stays in FilterPill's DOM in every
  // state, rendered with a 'locked' tone instead of being removed.
  await expect(card).toHaveCount(0)
  const privateRow = page.getByTestId('filter-pill-private')
  await expect(privateRow).toBeVisible()
  await expect(privateRow).toHaveAttribute('data-private-status', 'locked')

  // 6. SETTINGS -> PRIVATE -> enter the password -> UNLOCK.
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  const unlockDialog = page.getByTestId('private-unlock-dialog')
  await expect(unlockDialog).toBeVisible()
  await page.locator('#private-unlock-password').fill(PASSWORD)
  await page.getByTestId('private-unlock-submit').click()
  await expect(unlockDialog).toHaveCount(0)
  // Same outside-pointerdown auto-close as step 2 — reopen to observe state.
  await openSettings(page)
  await expect(page.getByTestId('private-entry-button')).toHaveAttribute('data-unlocked', 'true')
  // The drawer docks on the RIGHT (ChromeDrawer.module.css .panel, 400px),
  // which overlaps FilterPill's own position in the top chrome — close it
  // (Escape, same contract as PrivateSetupDialog/PrivateUnlockDialog above)
  // before interacting with FilterPill below.
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('extension-settings-drawer')).toHaveCount(0)

  // 7. Click the Private row in FilterPill — now unlocked-toned — and assert
  // the bookmark reappears. Clicking the pill toggles it open + sticky
  // (FilterPill.tsx pill onClick), independent of hover timing.
  await page.getByTestId('filter-pill').click()
  await expect(privateRow).toHaveAttribute('data-private-status', 'unlocked')
  await privateRow.click()
  await expect(card).toBeVisible()

  // 8. Containment: switch to the ALL view (tags filter has only this one
  // tag, so ALL is the brief's documented alternative to "a different tag").
  // BoardRoot.tsx's filteredItems passes the real privateTagId (not null)
  // to applyFilter whenever the active filter ISN'T the Private tag itself,
  // so the item drops out of the DOM again, not just off-screen.
  // pickExclusive (FilterPill.tsx) closes the dropdown on this click.
  await page.getByTestId('filter-pill-menu').getByText('ALL', { exact: true }).click()
  await expect(card).toHaveCount(0)

  // 9. Re-select the Private filter, select the (only) card, and trigger
  // SHARE. Desktop flow verified against tests/e2e/board-share-polish.spec.ts's
  // "still uses the arrange stage with ShareSelectBar -> ShareToast" test.
  await page.getByTestId('filter-pill').click()
  await privateRow.click()
  await expect(card).toBeVisible()
  // Toggling a tag row (unlike ALL/TRASH/DEAD) leaves the dropdown open
  // (FilterPill.tsx toggleTag never touches `open`) — it now overlaps
  // frameTopChrome's share-pill. Escape closes it (FilterPill.tsx ~244-259).
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('filter-pill-menu')).toHaveAttribute('data-open', 'false')

  await page.getByTestId('share-pill').click()
  await page.getByTestId('select-all-button').click()
  // SELECT ALL adds every currently-VISIBLE (tag-filtered) card
  // (BoardRoot.tsx handleSelectAll -> lightboxNavItems) — asserting the
  // counter reads exactly 1 proves only the Private card was picked up, not
  // some other board item.
  await expect(page.getByTestId('select-counter')).toHaveText(/^1 \/ \d+ SELECTED$/)
  await page.getByTestId('select-share-button').click()
  await expect(page.getByTestId('share-toast-count')).toHaveText('SHARING · 1')

  await page.getByTestId('share-toast-create').click()
  const confirmDialog = page.getByTestId('private-share-confirm-dialog')
  await expect(confirmDialog).toBeVisible()
  await expect(confirmDialog).toContainText('1 item from Private')

  // 10. CANCEL -> the gate gets in the way BEFORE proceedCreateHostedShare
  // ever runs (BoardRoot.tsx handleCreateHostedShare), so no network call
  // was made and no link was created — the toast never reaches its "ready"
  // state and CREATE is still the plain, unclicked label.
  await page.getByTestId('private-share-confirm-cancel').click()
  await expect(confirmDialog).toHaveCount(0)
  await expect(page.getByTestId('share-toast-ready')).toHaveCount(0)
  await expect(page.getByTestId('share-toast-create')).toHaveText('CREATE')
})

test('FilterPill Private row opens setup when not set up, and resumes as a filter toggle', async ({ page }) => {
  await seedDb(page, [...firstRunSuppressors(), ...seedOneBookmark()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  const card = page.locator(`[data-bookmark-id="${BOOKMARK_ID}"]`)
  await expect(card).toBeVisible({ timeout: 15_000 })

  await page.getByTestId('filter-pill').click()
  const privateRow = page.getByTestId('filter-pill-private')
  await expect(privateRow).toHaveAttribute('data-private-status', 'none')
  await privateRow.click()
  const setupDialog = page.getByTestId('private-setup-dialog')
  await expect(setupDialog).toBeVisible()
  await page.locator('#private-setup-password').fill(PASSWORD)
  await page.locator('#private-setup-confirm').fill(PASSWORD)
  await page.getByTestId('private-setup-create').click()
  await expect(setupDialog).toHaveCount(0)
  await expect(privateRow).toHaveAttribute('data-private-status', 'unlocked')
  // Resumed automatically as a `filter` action, straight into the active tag
  // filter — no second click needed. A `tags`-kind filter keeps every card
  // MOUNTED though (BoardRoot.tsx filteredItems comment: the CRT shutdown
  // animation needs non-matching cards to stay in the DOM), so the seeded
  // card — carrying no tags yet — is marked tagged-out rather than removed.
  await expect(card.locator('[data-tagged-out]')).toHaveAttribute('data-tagged-out', 'true')
  // FilterPill's trigger label special-cases the Private tag id (labelFor,
  // FilterPill.tsx) so it reads "private" here instead of falling through to
  // the stale/deleted-tag "—" fallback — tagsExcludingPrivate never contains
  // the Private tag itself, so a plain tags.find lookup for its id would
  // always miss otherwise.
  await expect(page.getByTestId('filter-pill')).toContainText('private')
})

test('card + button Private chip opens setup when not set up, and resumes as an encrypt', async ({ page }) => {
  await seedDb(page, [...firstRunSuppressors(), ...seedOneBookmark()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  const card = page.locator(`[data-bookmark-id="${BOOKMARK_ID}"]`)
  await expect(card).toBeVisible({ timeout: 15_000 })

  await card.hover()
  // Wait for the button's hover-reveal opacity transition to actually settle
  // before force-clicking it — CardsLayer.tsx fades it in over 120ms, and a
  // click mid-transition can land before the popover's own open-state update
  // has taken effect (observed while iterating on this test: the popover
  // simply never opened when this wasn't awaited first).
  await expect(card.getByTestId('card-add-tag-button')).toHaveCSS('opacity', '1')
  // Plain/force click both real-hit-test the browser at the button's screen
  // coordinates, and ResizeHandle's 56x56 corner .hint square (z-index 25,
  // pointer-events: auto, ResizeHandle.module.css) geometrically fully
  // contains the +TAG button's own box at this card size — so either kind of
  // click can land on the resize hint instead, silently never opening the
  // popover (observed while iterating on this test). dispatchEvent bypasses
  // hit-testing and fires 'click' straight on the button node, which is all
  // its onClick handler needs (it doesn't depend on a preceding real
  // pointerdown/mousedown).
  await card.getByTestId('card-add-tag-button').dispatchEvent('click')
  const privateChip = page.getByTestId('tag-add-popover-private')
  await expect(privateChip).toHaveAttribute('data-private-status', 'none')
  await privateChip.click()
  const setupDialog = page.getByTestId('private-setup-dialog')
  await expect(setupDialog).toBeVisible()
  await page.locator('#private-setup-password').fill(PASSWORD)
  await page.locator('#private-setup-confirm').fill(PASSWORD)
  await page.getByTestId('private-setup-create').click()
  await expect(setupDialog).toHaveCount(0)
  // Resumed automatically as a `toggle-tag` action — the card is now
  // Private and vanishes from the default (non-Private) board view.
  await expect(card).toHaveCount(0)
})

test('mobile TAG MODE: tapping Private after selecting two cards encrypts them both', async ({ page }) => {
  await seedDb(page, [...firstRunSuppressors(), ...seedTwoBookmarks()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  // Create the vault at the default (desktop) viewport — openSettings' trigger
  // (extension-settings) is desktop chrome; BoardMobileNav has its own
  // mobile-nav-settings entry, but reusing the already-established helper here
  // is simpler and the vault-creation UI itself isn't what this test targets.
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  await page.locator('#private-setup-password').fill(PASSWORD)
  await page.locator('#private-setup-confirm').fill(PASSWORD)
  await page.getByTestId('private-setup-create').click()

  // Now switch to mobile for the TAG MODE tap-to-assign path (< 640px
  // breakpoint, lib/board/use-is-mobile.ts).
  await page.setViewportSize({ width: 390, height: 844 })
  // Next.js's own dev-mode indicator (<nextjs-portal>, a shadow-DOM custom
  // element with a real fixed-position badge inside its shadow root that its
  // OWN host element's bounding rect doesn't reflect) sits bottom-left of the
  // viewport at this mobile size — the same corner as the leftmost
  // BoardMobileNav icon. dispatchEvent bypasses hit-testing (fires 'click'
  // straight on the node instead of a real OS-level click at its screen
  // coordinates), which a plain/force .click() can't: both still real-hit-
  // test the browser and can land on the dev-only overlay instead (observed
  // while iterating on this test — a force click "succeeded" but tagMode
  // never actually engaged, so the very next card tap opened the Lightbox
  // instead of registering a TAG MODE selection).
  await page.getByTestId('mobile-nav-tag').dispatchEvent('click')
  const cardA = page.locator(`[data-bookmark-id="${BOOKMARK_ID}"]`)
  const cardB = page.locator('[data-bookmark-id="priv-b-1"]')
  await cardA.click()
  await cardB.click()
  const privateChip = page.getByTestId('mobile-tag-private')
  await expect(privateChip).toHaveAttribute('data-private-status', 'unlocked')
  await privateChip.click()
  await page.getByTestId('mobile-tag-done').click()
  await page.reload()
  await expect(cardA).toHaveCount(0)
  await expect(cardB).toHaveCount(0)
})

test('Private-tagged card shows its own hover pill, same as any other tag', async ({ page }) => {
  // Regression coverage for the bug fixed alongside this test: CardsLayer.tsx's
  // tagsById map was built ONLY from `allTags` (= BoardRoot's tagsExcludingPrivate,
  // deliberately Private-free so the "+TAG" popover's generic chip list and
  // tag-filter dropdowns don't double-offer Private). CardsLayer separately
  // reused that SAME map to resolve a card's tags[] ids into TagRecords for the
  // per-card hover pill strip (TagIndicatorStrip) — so tagsById.get(privateTagId)
  // was always undefined and the Private pill silently never rendered, unlike
  // every other tag. Fix: CardsLayer now takes a dedicated `privateTag` prop
  // (BoardRoot resolves it from useTags()'s own unfiltered `tags`) merged into
  // tagsById ALONGSIDE allTags, never into allTags itself.
  await seedDb(page, [...firstRunSuppressors(), ...seedOneBookmark()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  const card = page.locator(`[data-bookmark-id="${BOOKMARK_ID}"]`)
  await expect(card).toBeVisible({ timeout: 15_000 })

  // 1. SETTINGS -> PRIVATE -> setup dialog -> CREATE (same flow as the first
  // test in this file).
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  const setupDialog = page.getByTestId('private-setup-dialog')
  await expect(setupDialog).toBeVisible()
  await page.locator('#private-setup-password').fill(PASSWORD)
  await page.locator('#private-setup-confirm').fill(PASSWORD)
  await page.getByTestId('private-setup-create').click()
  await expect(setupDialog).toHaveCount(0)

  // 2. Tag the seeded card Private via the per-card "+ TAG" popover.
  await card.hover()
  await card.getByTestId('card-add-tag-button').click({ force: true })
  await card.getByTestId('tag-add-popover-private').click()
  // Vanishes from the default ALL view immediately (privateGatePasses) — same
  // assertion as the first test in this file.
  await expect(card).toHaveCount(0)

  // 3. Switch the board's filter to the Private tag itself so the card (now
  // genuinely Private-tagged, vault unlocked) is back on screen to hover.
  await page.getByTestId('filter-pill').click()
  const privateRow = page.getByTestId('filter-pill-private')
  await expect(privateRow).toHaveAttribute('data-private-status', 'unlocked')
  await privateRow.click()
  await expect(card).toBeVisible()
  // Toggling a tag row leaves the dropdown open (FilterPill.tsx toggleTag
  // never touches `open`) — close it before hovering the card underneath.
  await page.keyboard.press('Escape')

  // 4. No UI element exposes the Private tag's real id directly (FilterPill's
  // own row only special-cases the id internally for its label — see
  // labelFor/privateTagId in FilterPill.tsx), so read it straight from
  // IndexedDB's 'tags' store, the same direct-IDB pattern this suite's sibling
  // specs (e.g. board-b-11-source-hide.spec.ts) use for verification reads.
  const privateTagId = await page.evaluate(async (dbName) => {
    return new Promise<string | null>((resolve, reject) => {
      const req = indexedDB.open(dbName)
      req.onsuccess = (): void => {
        const db = req.result
        const getAll = db.transaction(['tags'], 'readonly').objectStore('tags').getAll()
        getAll.onsuccess = (): void => {
          const found = (getAll.result as Array<{ id: string; isPrivateVault?: boolean }>)
            .find((t) => t.isPrivateVault === true)
          db.close()
          resolve(found?.id ?? null)
        }
        getAll.onerror = (): void => reject(getAll.error)
      }
      req.onerror = (): void => reject(req.error)
    })
  }, DB_NAME)
  expect(privateTagId).not.toBeNull()

  // 5. Hover the card and assert its own Private pill renders — the actual
  // regression check. TagIndicatorStrip's pill testid pattern is
  // `tag-pill-${tag.id}` (components/board/TagIndicatorStrip.tsx ~189), text
  // content is the tag's own name (~209: `{tag.name}`), and the Private tag
  // is always created with name 'Private' (BoardRoot.tsx's createTag call).
  await card.hover()
  const pill = card.getByTestId(`tag-pill-${privateTagId}`)
  await expect(pill).toBeVisible()
  await expect(pill).toHaveText('Private')

  // 6. Regression check for the follow-up fix: right-clicking this pill must
  // NOT open the generic TagContextMenu (RENAME/DELETE). Before this pill
  // existed at all, right-clicking a Private tag anywhere in the app was
  // structurally impossible (FilterPill's generic rows exclude Private, and
  // its own pinned Private row never wires onTagContextMenu) — restoring the
  // pill's resolvability in tagsById must not accidentally restore this menu
  // too. CardsLayer.tsx's TagIndicatorStrip call site now skips invoking the
  // parent's onTagContextMenu specifically when the pill's tagId is the
  // Private tag's id.
  await pill.click({ button: 'right' })
  await expect(page.getByTestId('tag-context-menu')).toHaveCount(0)
})

test('card + button Private chip encrypts immediately while locked, no unlock dialog', async ({ page }) => {
  // Task 5/7: adding the Private tag (encrypting) no longer requires the
  // vault to be unlocked — only removing/viewing does. Reproduces this
  // file's first test's lock round-trip (create vault, reload to drop the
  // session) but then adds the tag from the LOCKED state, asserting no
  // unlock dialog ever appears.
  await seedDb(page, [...firstRunSuppressors(), ...seedOneBookmark()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  const card = page.locator(`[data-bookmark-id="${BOOKMARK_ID}"]`)
  await expect(card).toBeVisible({ timeout: 15_000 })

  // 1. Create the vault (leaves the session unlocked in this tab).
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  const setupDialog = page.getByTestId('private-setup-dialog')
  await expect(setupDialog).toBeVisible()
  await page.locator('#private-setup-password').fill(PASSWORD)
  await page.locator('#private-setup-confirm').fill(PASSWORD)
  await page.getByTestId('private-setup-create').click()
  await expect(setupDialog).toHaveCount(0)

  // 2. Reload — the vault's entire re-lock mechanism (vault-session.ts is a
  // plain module singleton, reset by any reload). privateTagId (from
  // useTags()) survives the reload; privateSession does not.
  await page.reload()
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await expect(card).toBeVisible({ timeout: 15_000 })

  // 3. From this locked state, tag the card Private via the card's own
  // +TAG popover.
  await card.hover()
  await card.getByTestId('card-add-tag-button').click({ force: true })
  const privateChip = card.getByTestId('tag-add-popover-private')
  await expect(privateChip).toHaveAttribute('data-private-status', 'locked')
  await privateChip.click()

  // 4. No unlock dialog should ever appear — adding Private doesn't need
  // the password.
  await expect(page.getByTestId('private-unlock-dialog')).toHaveCount(0)

  // 5. The tag landed for real: the card is now Private-tagged and drops
  // out of the default ALL view (resolvePrivateVisibility, same signal
  // this file's other tests already use).
  await expect(card).toHaveCount(0)
})

test('mobile TAG MODE: tapping Private after selecting two cards encrypts them both, even while locked', async ({ page }) => {
  await seedDb(page, [...firstRunSuppressors(), ...seedTwoBookmarks()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  await page.locator('#private-setup-password').fill(PASSWORD)
  await page.locator('#private-setup-confirm').fill(PASSWORD)
  await page.getByTestId('private-setup-create').click()

  // Reload to lock the vault (same re-lock mechanism as the previous test)
  // before switching to the mobile viewport.
  await page.reload()
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('mobile-nav-tag').dispatchEvent('click')
  const cardA = page.locator(`[data-bookmark-id="${BOOKMARK_ID}"]`)
  const cardB = page.locator('[data-bookmark-id="priv-b-1"]')
  await cardA.click()
  await cardB.click()
  const privateChip = page.getByTestId('mobile-tag-private')
  await expect(privateChip).toHaveAttribute('data-private-status', 'locked')
  await privateChip.click()

  // No unlock dialog — batch-encrypting doesn't need the password either.
  await expect(page.getByTestId('private-unlock-dialog')).toHaveCount(0)

  await page.getByTestId('mobile-tag-done').click()
  await page.reload()
  await expect(cardA).toHaveCount(0)
  await expect(cardB).toHaveCount(0)
})

test('removing the Private tag while unlocked still decrypts and restores the card (fail-closed retained)', async ({ page }) => {
  // Task 5/7 made ADDING Private lock-independent, but REMOVING it (which
  // must decrypt the stored payload back to plaintext) is untouched — still
  // gated on an unlocked session (removePrivateTag throws otherwise).
  // Locked-state removal can't be driven through the UI at all: a
  // Private-tagged card is never rendered while locked
  // (resolvePrivateVisibility drops it outright), so there's no chip to
  // click in that state. This test instead confirms the still-gated remove
  // path itself keeps working correctly end-to-end while unlocked, guarding
  // against Task 5's rewrite of removePrivateTag/executePrivateAction
  // accidentally breaking (not just accidentally un-gating) removal.
  await seedDb(page, [...firstRunSuppressors(), ...seedOneBookmark()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  const card = page.locator(`[data-bookmark-id="${BOOKMARK_ID}"]`)
  await expect(card).toBeVisible({ timeout: 15_000 })

  // 1. Create the vault and tag the card Private (mirrors this file's first
  // test, steps 2-3).
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  const setupDialog = page.getByTestId('private-setup-dialog')
  await expect(setupDialog).toBeVisible()
  await page.locator('#private-setup-password').fill(PASSWORD)
  await page.locator('#private-setup-confirm').fill(PASSWORD)
  await page.getByTestId('private-setup-create').click()
  await expect(setupDialog).toHaveCount(0)
  await card.hover()
  await card.getByTestId('card-add-tag-button').click({ force: true })
  await card.getByTestId('tag-add-popover-private').click()
  await expect(card).toHaveCount(0)

  // 2. Reload then unlock again via SETTINGS, rather than re-filtering to
  // Private in the same never-reloaded session. This is a deliberate
  // workaround for a PRE-EXISTING, unrelated bug in CardsLayer.tsx (not
  // touched by this branch — confirmed via `git diff master...HEAD --
  // components/board/CardsLayer.tsx` being empty): `popoverOpenFor` is
  // never reset when a card's own popover is still conceptually "open" at
  // the moment the card disappears from `items` (here, because tagging it
  // Private hides it from the default ALL view). The stale value survives
  // in CardsLayer's component state, so when the SAME card later
  // reappears (e.g. via the Private-tag filter) its popover auto-remounts
  // from that stale flag, and a subsequent `card-add-tag-button` click
  // meant to OPEN it instead reads "already open" and calls the CLOSE
  // branch — while that popover is still mid-close-animation from a
  // preceding Escape/outside-click, so it never successfully reopens
  // (reproduced directly: `card-add-tag-button` click never mounts
  // `tag-add-popover-private` at all afterward). A reload gives CardsLayer
  // a fresh `popoverOpenFor=null` with no such carry-over, so the popover
  // opens normally on first use post-reload — this test's actual target
  // (removePrivateTag/executePrivateAction) is exercised identically
  // either way. Logged as a new backlog item in docs/TODO.md; out of scope
  // to fix here.
  await page.reload()
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  const unlockDialog = page.getByTestId('private-unlock-dialog')
  await expect(unlockDialog).toBeVisible()
  await page.locator('#private-unlock-password').fill(PASSWORD)
  await page.getByTestId('private-unlock-submit').click()
  await expect(unlockDialog).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('extension-settings-drawer')).toHaveCount(0)

  // 3. Filter to the Private tag to bring the card back on screen.
  await page.getByTestId('filter-pill').click()
  const privateRow = page.getByTestId('filter-pill-private')
  await expect(privateRow).toHaveAttribute('data-private-status', 'unlocked')
  await privateRow.click()
  await expect(card).toBeVisible()
  await page.keyboard.press('Escape')

  // 4. Open the card's own +TAG popover for the first time in this
  // (post-reload) session and click its Private chip — now isTagged: true,
  // so this routes through the currentlyTagged:true (remove) branch.
  await card.hover()
  await card.getByTestId('card-add-tag-button').click({ force: true })
  const privateChip = card.getByTestId('tag-add-popover-private')
  await expect(privateChip).toHaveAttribute('data-has', 'true')
  await privateChip.click()

  // 5. The card is no longer Private-tagged, so it no longer matches the
  // active Private-tag filter — but a tags-kind filter keeps every card
  // MOUNTED (BoardRoot.tsx filteredItems: the CRT shutdown animation needs
  // non-matching cards to stay in the DOM), so it's marked tagged-out
  // rather than removed (same signal as the 'FilterPill Private row opens
  // setup...' test above, line ~315).
  await expect(card.locator('[data-tagged-out]')).toHaveAttribute('data-tagged-out', 'true')

  // 6. ...and reappears, decrypted, in the default ALL view with its real
  // title restored — proving removePrivateTag's decrypt-and-restore path
  // still works after Task 5's rewrite.
  await page.getByTestId('filter-pill').click()
  await page.getByTestId('filter-pill-menu').getByText('ALL', { exact: true }).click()
  await expect(card).toBeVisible()
  await expect(card).toContainText('Private vault e2e card')
})

// Regression coverage for the stale-reload-closure race (private-vault-phase2
// discovery batch): PrivateSetupDialog.onCreate / PrivateUnlockDialog.onSubmit
// call `void runPrivateAction(...)` fire-and-forget. `runPrivateAction` is a
// useCallback captured at whatever render produced THAT dialog's JSX — i.e.
// BEFORE the vault existed, before privateTagId/privateSession updated in
// React state. Its internal `await reload()` used to call reload() with ZERO
// args, so it fell back to reload's OWN closed-over privateTagId/privateSession
// (still null/null from that stale render), even though executePrivateAction
// itself got the FRESH tagId/session as real parameters and encrypted
// correctly. resolvePrivateVisibility(bookmarks, null, null) short-circuits
// on its first line and returns bookmarks completely unchanged — so the
// just-encrypted bookmark (title/url/thumbnail blanked, real content only in
// encryptedPayload) landed in `items` as-is, rendering as an unopenable
// PlaceholderCard. Fix: runPrivateAction now calls `reload(resolvedPrivateTagId,
// session)`, passing the SAME fresh values it already received, so it can no
// longer matter whether its own reload closure is stale.
//
// A real, non-empty thumbnail is required to reproduce this (unlike
// seedOneBookmark's thumbnail: '', which would render as PlaceholderCard
// regardless of the bug) — via.placeholder.com is mocked to a 1x1 PNG so the
// test doesn't depend on real network access (same fix as
// tests/e2e/board-i-07-multi-image.spec.ts: the app's Service Worker
// intercepts image fetches itself, bypassing page.route() unless blocked).
test.describe('stale-reload-closure race (real thumbnail, immediate filter click)', () => {
  test.use({ serviceWorkers: 'block' })

  const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  )
  const RACE_BOOKMARK_ID = 'priv-race-b-0'
  const THUMB_URL = 'https://via.placeholder.com/400x300?text=private-race'

  function seedOneBookmarkWithThumbnail(): SeedRecord[] {
    const now = new Date().toISOString()
    return [
      {
        store: 'bookmarks',
        value: {
          id: RACE_BOOKMARK_ID,
          url: 'https://example.com/private-vault-race-e2e',
          title: 'Private vault race e2e card',
          description: '',
          thumbnail: THUMB_URL,
          favicon: '',
          siteName: '',
          type: 'website',
          savedAt: now,
          tags: [],
          displayMode: null,
          ogpStatus: 'fetched',
          sizePreset: 'S',
          orderIndex: 0,
          linkStatus: 'alive',
          lastCheckedAt: Date.now(),
        },
      },
      {
        store: 'cards',
        value: {
          id: 'priv-race-c-0',
          bookmarkId: RACE_BOOKMARK_ID,
          folderId: '',
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          zIndex: 0,
          gridIndex: 0,
          isManuallyPlaced: false,
          width: 240,
          height: 180,
        },
      },
    ]
  }

  test.beforeEach(async ({ page }) => {
    await page.route('https://via.placeholder.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG }),
    )
  })

  test('card keeps its real thumbnail after setup-then-immediate-filter-click, not a blank PlaceholderCard', async ({ page }) => {
    // 1. Seed a bookmark with a REAL thumbnail, load /board, confirm the
    // baseline: a real ImageCard with a non-empty <img src>, not a placeholder.
    await seedDb(page, [...firstRunSuppressors(), ...seedOneBookmarkWithThumbnail()])
    await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
    const card = page.locator(`[data-bookmark-id="${RACE_BOOKMARK_ID}"]`)
    await expect(card).toBeVisible({ timeout: 15_000 })
    const thumb = card.locator('img[data-active="true"]')
    await expect(thumb).toHaveAttribute('src', THUMB_URL)
    await expect(card.locator('[class*="placeholderCard"]')).toHaveCount(0)

    // 2. Trigger the not-set-up Private toggle from the card's own popover
    // (hover-revealed +TAG button -> dedicated Private chip) -> opens
    // PrivateSetupDialog with a `toggle-tag` pendingPrivateAction (NOT
    // `filter` — that's the kind that actually calls reload() on completion).
    await card.hover()
    await card.getByTestId('card-add-tag-button').click({ force: true })
    await card.getByTestId('tag-add-popover-private').click()
    const setupDialog = page.getByTestId('private-setup-dialog')
    await expect(setupDialog).toBeVisible()
    await page.locator('#private-setup-password').fill(PASSWORD)
    await page.locator('#private-setup-confirm').fill(PASSWORD)

    // 3. Submit, then IMMEDIATELY (no extra wait inserted) click the
    // FilterPill's Private row to filter down to just the Private tag — the
    // exact race trigger. Playwright's own .click() actionability waits are
    // the only "wait" here, matching the live-reproduced sequence.
    await page.getByTestId('private-setup-create').click()
    await page.getByTestId('filter-pill').click()
    await page.getByTestId('filter-pill-private').click()

    // 4. Give the async writes/reloads a short, realistic window to settle —
    // long enough for everything to finish, short enough to still land inside
    // the race window that used to fail (a full extra reload only happens on
    // page.reload(), never automatically).
    await page.waitForTimeout(500)

    // 5. The card must show its real thumbnail again — NOT a blank
    // PlaceholderCard rendered from the stale reload's null/null-gated,
    // still-blanked-at-rest bookmark record.
    await expect(card).toBeVisible({ timeout: 5_000 })
    await expect(thumb).toHaveAttribute('src', THUMB_URL)
    await expect(card.locator('[class*="placeholderCard"]')).toHaveCount(0)
  })
})

// Locks the postMessage contract the extension's new dispatchAddPrivateTag
// (and the bookmarklet toast's handlePrivateChip) depend on. Task 11 shipped
// app/save-iframe/SaveIframeClient.tsx's booklage:add-private-tag handler
// with only a throwaway, never-committed Playwright spec as evidence -- this
// is that coverage made permanent, ahead of wiring a real sender to it.
test('extension/bookmarklet quick-save can tag Private via postMessage, matching the board flow', async ({ page }) => {
  // 1. Seed one bookmark, load /board, create the vault via the real UI --
  // real Web Crypto is the only reliable way to get a genuine, working ECDH
  // key pair + vault record (see file header for why every other test here
  // does the same instead of seeding a fake vault record).
  await seedDb(page, [...firstRunSuppressors(), ...seedOneBookmark()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  await openSettings(page)
  await page.getByTestId('private-entry-button').click()
  const setupDialog = page.getByTestId('private-setup-dialog')
  await expect(setupDialog).toBeVisible()
  await page.locator('#private-setup-password').fill(PASSWORD)
  await page.locator('#private-setup-confirm').fill(PASSWORD)
  await page.getByTestId('private-setup-create').click()
  await expect(setupDialog).toHaveCount(0)

  // 2. Read the vault's tagId straight from IDB (same origin, same DB) --
  // this is exactly what the save-iframe reply's privateTagId field carries
  // to a real extension/bookmarklet caller.
  const privateTagId = await page.evaluate(async (dbName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const tx = db.transaction('settings', 'readonly')
    const record = await new Promise<{ tagId: string } | undefined>((resolve, reject) => {
      const r = tx.objectStore('settings').get('private-vault')
      r.onsuccess = () => resolve(r.result as never)
      r.onerror = () => reject(r.error)
    })
    db.close()
    return record?.tagId
  }, DB_NAME)
  expect(privateTagId).toBeTruthy()

  // 3. Navigate to /save-iframe -- the same postMessage backend the
  // extension and the bookmarklet both talk to -- and post
  // booklage:add-private-tag for the already-seeded bookmark, exactly like
  // the extension's dispatchAddPrivateTag or the bookmarklet toast's
  // handlePrivateChip would.
  await page.goto('/save-iframe')
  await page.waitForSelector('[data-testid="save-iframe-mounted"]', { state: 'attached' })
  await page.evaluate(() => {
    const w = globalThis as { __BOOKLAGE_ALLOWED_ORIGINS__?: string[] }
    w.__BOOKLAGE_ALLOWED_ORIGINS__ = [window.location.origin]
  })
  const resultPromise = page.evaluate(() => {
    return new Promise<unknown>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('result timeout')), 5000)
      const listener = (ev: MessageEvent): void => {
        if ((ev.data as { type?: string } | null)?.type === 'booklage:add-private-tag:result') {
          window.clearTimeout(timer)
          window.removeEventListener('message', listener)
          resolve(ev.data)
        }
      }
      window.addEventListener('message', listener)
    })
  })
  await page.evaluate((bookmarkId) => {
    window.postMessage({
      type: 'booklage:add-private-tag',
      payload: { bookmarkId, nonce: 'add-private-e2e-1' },
    }, window.location.origin)
  }, BOOKMARK_ID)
  const result = (await resultPromise) as { ok: boolean; nonce: string }
  expect(result.ok).toBe(true)
  expect(result.nonce).toBe('add-private-e2e-1')

  // 4. Verify the bookmark was actually encrypted at rest, not just replied
  // to with ok:true.
  const updated = await page.evaluate(async ({ dbName, id }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const tx = db.transaction('bookmarks', 'readonly')
    const bm = await new Promise<{ tags: string[]; encryptedPayload?: unknown; title: string } | undefined>((resolve, reject) => {
      const r = tx.objectStore('bookmarks').get(id)
      r.onsuccess = () => resolve(r.result as never)
      r.onerror = () => reject(r.error)
    })
    db.close()
    return bm
  }, { dbName: DB_NAME, id: BOOKMARK_ID })
  expect(updated?.tags).toContain(privateTagId)
  expect(updated?.encryptedPayload).toBeDefined()
  expect(updated?.title).toBe('')
})
