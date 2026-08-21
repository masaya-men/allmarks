import { test, expect, type Page } from '@playwright/test'
import { seedDb, firstRunSuppressors, type SeedRecord } from './helpers/seed-db'

// Private vault (Phase 1) end-to-end coverage — task 15 of the private-vault
// plan. Locators below are sourced from the real shipped components (read
// directly, not guessed):
//   - components/board/ExtensionEntry.tsx: private-entry-button (+ data-unlocked)
//   - components/board/PrivateSetupDialog.tsx: private-setup-dialog/cancel/create,
//     inputs at #private-setup-password / #private-setup-confirm / #private-setup-hint
//   - components/board/PrivateUnlockDialog.tsx: private-unlock-dialog/cancel/submit,
//     input at #private-unlock-password
//   - components/board/PrivateShareConfirmDialog.tsx: private-share-confirm-dialog/cancel/share
//   - components/board/CardsLayer.tsx (~1655-1730): the ONLY still-valid way to
//     assign the Private tag to a card is the per-card "+ TAG" popover
//     (data-testid="card-add-tag-button", hover-revealed, pointer-events:none
//     until hovered) -> TagAddPopover chip click (onAddExisting -> handleTagToggle,
//     which branches on tagId === privateTagId to call the real
//     addPrivateTag/removePrivateTag encrypting path). TagDropPanel (drag-drop)
//     and BoardMobileTagBar (bulk) both deliberately exclude the Private tag
//     post security-fix, so they are NOT used here.
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
  // The popover's existing-tag chip renders as plain text `tag.name` (has:false)
  // or `✓ ${tag.name}` (has:true) — TagAddPopover/index.tsx renderExistingChip.
  // A heuristic "+ Private" NEW-tag suggestion could also appear (our title
  // contains the word "Private"), but that renders as "+ Private" (chipNew),
  // which an exact-text match for "Private" does not match — so this is
  // unambiguous even if the suggestion engine fires.
  await card.getByText('Private', { exact: true }).click()
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
  // just visually hidden), and the Private tag must not appear in FilterPill
  // (useTags().tags filters isPrivateVault rows out while privateSession is
  // null). The dropdown doesn't need to be open for a DOM-presence check —
  // FilterPill's menu is always mounted (FilterPill.tsx comment ~109-111).
  await expect(card).toHaveCount(0)
  const privateTagLabel = page.getByTestId('filter-pill-menu').getByText('Private', { exact: true })
  await expect(privateTagLabel).toHaveCount(0)

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

  // 7. Click the Private tag in FilterPill — now visible in the tag list —
  // and assert the bookmark reappears. Clicking the pill toggles it open +
  // sticky (FilterPill.tsx pill onClick), independent of hover timing.
  await page.getByTestId('filter-pill').click()
  await expect(privateTagLabel).toHaveCount(1)
  await privateTagLabel.click()
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
  await expect(privateTagLabel).toHaveCount(1)
  await privateTagLabel.click()
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
