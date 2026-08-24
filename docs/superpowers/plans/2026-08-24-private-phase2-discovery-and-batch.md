# Private Phase 2 ①発見導線 + ③まとめてPrivate化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Private tag always visible (in 3 states: not set up / locked / unlocked) everywhere tags currently appear or can be applied, and add a batch-encrypt path for MANAGE TAGS drag-and-drop — without teaching the user any new gesture.

**Architecture:** One pure-logic module (`lib/private/apply-tag-change.ts`) resolves the 3-state status and executes the deferred "toggle one bookmark" / "toggle the active filter" / "batch-encrypt many bookmarks" actions. `BoardRoot.tsx` owns a single `pendingPrivateAction` + the existing `privateDialog` state (extends the Phase-1 setup/unlock dialogs so a dialog completion auto-resumes the action that triggered it). Three presentational components (`FilterPill`, `TagAddPopover`, `TagDropPanel`/`BoardMobileTagBar`) each grow one small always-visible "🔒 Private" row/chip that calls into this same routing.

**Tech Stack:** TypeScript strict, React (Next.js App Router), Vitest + `@testing-library/react` for unit tests, Playwright for e2e. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-08-24-private-phase2-discovery-and-batch-design.md](../specs/2026-08-24-private-phase2-discovery-and-batch-design.md)

## Global Constraints

- No new npm dependencies. No IndexedDB schema/version change (`DB_VERSION` untouched).
- Never bypass git hooks (`--no-verify` forbidden). Commands prefixed with `rtk` per this repo's convention (harmless if the hook isn't installed).
- `/triage` (dormant screen) is out of scope — do not touch `components/triage/*`.
- ②(PopOut/extension/bookmarklet quick-save) and ④(hide-the-entry-point option) are out of scope. Do not touch `components/pip/PipCompanion.tsx`, `components/bookmarklet/SaveToast.tsx`, or `lib/tagger/quick-tag-apply.ts`.
- Batch encryption is **additive only** — no bulk "remove Private" path in this plan (matches the existing plain-tag drag-and-drop semantics).
- No extra confirmation dialog before batch execution — dropping/clicking is already the deliberate action (spec §1 decision 4).
- Every new/changed unit must have TypeScript strict types (no `any`), matching the existing style in the touched files.
- `lib/private/crypto.ts`, `addPrivateTag`, `removePrivateTag`, `resolvePrivateVisibility`, `applyFilter`'s Private gating — all Phase 1 code — are NOT modified by this plan.

---

## Task 1: Pure Private-action logic (`lib/private/apply-tag-change.ts`)

**Files:**
- Modify: `lib/private/apply-tag-change.ts`
- Test: `lib/private/apply-tag-change.test.ts`

**Interfaces:**
- Produces: `PrivateStatus` (`'none' | 'locked' | 'unlocked'`), `resolvePrivateStatus(privateTagId: string | null, session: PrivateVaultSession): PrivateStatus`, `PendingPrivateAction` (union type), `PRIVATE_DROP_KEY` (string constant `'__private__'`), `addPrivateTagBatch(db, bookmarkIds, privateTagId, session): Promise<{succeeded: readonly string[]; failed: readonly string[]}>`, `executePrivateAction(db, action, privateTagId, session): Promise<{failed: readonly string[]}>` — all consumed by Task 3-5.

- [ ] **Step 1: Write the failing tests**

Append to `lib/private/apply-tag-change.test.ts` (the file already has `makeDb`/`makeBookmark`/`makeSession` helpers and a `beforeEach`/`afterEach` — reuse them, do not duplicate):

```ts
import {
  addPrivateTag, removePrivateTag, addPrivateTagBatch, executePrivateAction,
  resolvePrivateStatus, PRIVATE_DROP_KEY,
} from './apply-tag-change'
```

(add the new names to the existing `import { addPrivateTag, removePrivateTag } from './apply-tag-change'` line at the top of the test file instead of a second import statement)

```ts
describe('resolvePrivateStatus', () => {
  it('returns none when no Private tag exists yet', () => {
    expect(resolvePrivateStatus(null, null)).toBe('none')
  })
  it('returns locked when the tag exists but there is no session', () => {
    expect(resolvePrivateStatus('private-tag-id', null)).toBe('locked')
  })
  it('returns unlocked when the tag exists and a session is present', async () => {
    const session = await makeSession()
    expect(resolvePrivateStatus('private-tag-id', session)).toBe('unlocked')
  })
})

describe('PRIVATE_DROP_KEY', () => {
  it('is a sentinel string, never a valid tag id shape', () => {
    expect(PRIVATE_DROP_KEY).toBe('__private__')
  })
})

describe('addPrivateTagBatch', () => {
  it('encrypts every listed bookmark not already Private', async () => {
    await db.put('bookmarks', makeBookmark('b1'))
    await db.put('bookmarks', makeBookmark('b2'))
    const session = await makeSession()
    const result = await addPrivateTagBatch(db, ['b1', 'b2'], 'private-tag-id', session)
    expect(result.succeeded).toEqual(['b1', 'b2'])
    expect(result.failed).toEqual([])
    const b1 = await db.get('bookmarks', 'b1')
    const b2 = await db.get('bookmarks', 'b2')
    expect(b1.encryptedPayload).toBeDefined()
    expect(b2.encryptedPayload).toBeDefined()
  })

  it('skips (as succeeded, unchanged) a bookmark already carrying the Private tag', async () => {
    const already = makeBookmark('b3', { tags: ['private-tag-id'], title: '', encryptedPayload: { iv: 'x', ciphertext: 'y' } })
    await db.put('bookmarks', already)
    const session = await makeSession()
    const result = await addPrivateTagBatch(db, ['b3'], 'private-tag-id', session)
    expect(result.succeeded).toEqual(['b3'])
    expect(result.failed).toEqual([])
    const stored = await db.get('bookmarks', 'b3')
    // Untouched — still the original encryptedPayload, not re-encrypted.
    expect(stored.encryptedPayload).toEqual({ iv: 'x', ciphertext: 'y' })
  })

  it('silently skips (neither list) a bookmark id that does not exist', async () => {
    const session = await makeSession()
    const result = await addPrivateTagBatch(db, ['does-not-exist'], 'private-tag-id', session)
    expect(result.succeeded).toEqual([])
    expect(result.failed).toEqual([])
  })

  it('reports a failing card without stopping the rest of the batch', async () => {
    await db.put('bookmarks', makeBookmark('b4'))
    await db.put('bookmarks', makeBookmark('b5'))
    // session === null makes every addPrivateTag call throw ("vault is locked"),
    // exercising the per-card try/catch without needing to fake IDB failures.
    const result = await addPrivateTagBatch(db, ['b4', 'b5'], 'private-tag-id', null)
    expect(result.succeeded).toEqual([])
    expect(result.failed).toEqual(['b4', 'b5'])
  })
})

describe('executePrivateAction', () => {
  it('toggle-tag with currentlyTagged: false encrypts the bookmark', async () => {
    await db.put('bookmarks', makeBookmark('b6'))
    const session = await makeSession()
    const result = await executePrivateAction(
      db, { kind: 'toggle-tag', bookmarkId: 'b6', currentlyTagged: false }, 'private-tag-id', session,
    )
    expect(result.failed).toEqual([])
    const stored = await db.get('bookmarks', 'b6')
    expect(stored.encryptedPayload).toBeDefined()
  })

  it('toggle-tag with currentlyTagged: true decrypts the bookmark back', async () => {
    const bookmark = makeBookmark('b7')
    await db.put('bookmarks', bookmark)
    const session = await makeSession()
    await addPrivateTag(db, 'b7', 'private-tag-id', session)
    const result = await executePrivateAction(
      db, { kind: 'toggle-tag', bookmarkId: 'b7', currentlyTagged: true }, 'private-tag-id', session,
    )
    expect(result.failed).toEqual([])
    const stored = await db.get('bookmarks', 'b7')
    expect(stored.encryptedPayload).toBeUndefined()
    expect(stored.title).toBe('My Title')
  })

  it('batch-encrypt delegates to addPrivateTagBatch and surfaces failed ids', async () => {
    await db.put('bookmarks', makeBookmark('b8'))
    const session = await makeSession()
    const result = await executePrivateAction(
      db, { kind: 'batch-encrypt', bookmarkIds: ['b8', 'missing-id'] }, 'private-tag-id', session,
    )
    expect(result.failed).toEqual([])
    const stored = await db.get('bookmarks', 'b8')
    expect(stored.encryptedPayload).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk npx vitest run lib/private/apply-tag-change.test.ts`
Expected: FAIL — `resolvePrivateStatus`, `addPrivateTagBatch`, `executePrivateAction`, `PRIVATE_DROP_KEY` are not exported yet.

- [ ] **Step 3: Implement**

Append to `lib/private/apply-tag-change.ts` (after the existing `removePrivateTag`, keep all existing code untouched):

```ts
export type PrivateStatus = 'none' | 'locked' | 'unlocked'

/** Derives the 3-state Private status. Pure — no IDB access. `privateTagId`
 *  null means the vault has never been set up; a non-null id with a null
 *  session means it exists but is locked. */
export function resolvePrivateStatus(
  privateTagId: string | null,
  session: PrivateVaultSession,
): PrivateStatus {
  if (privateTagId === null) return 'none'
  if (session === null) return 'locked'
  return 'unlocked'
}

/** Sentinel drop-target key for the MANAGE TAGS panel's pinned Private row —
 *  parallel to CardsLayer's own `'__new__'` sentinel for the "+ NEW TAG" row
 *  (components/board/CardsLayer.tsx handleTagDrop routing). Not a real
 *  TagRecord id, so the row can render even before the vault is set up
 *  (when there is no real Private tag id yet). */
export const PRIVATE_DROP_KEY = '__private__'

/** A Private action deferred behind a setup/unlock dialog, resumed once the
 *  vault becomes unlocked. `toggle-tag` carries `currentlyTagged` computed by
 *  the caller at click time — a bookmark visible while the vault is
 *  locked/unset can never already carry the Private tag (resolvePrivateVisibility
 *  drops such rows before they reach the board), so callers building this
 *  action from a locked/none state always pass `currentlyTagged: false`.
 *  `filter` has no IDB side effect — it toggles the board's active tag
 *  filter, which the caller applies itself (see executePrivateAction's doc). */
export type PendingPrivateAction =
  | { readonly kind: 'toggle-tag'; readonly bookmarkId: string; readonly currentlyTagged: boolean }
  | { readonly kind: 'filter' }
  | { readonly kind: 'batch-encrypt'; readonly bookmarkIds: readonly string[] }

/** Encrypts each bookmark not already Private, one at a time (each call is
 *  its own atomic transaction via addPrivateTag — see that function's doc).
 *  Additive only, mirroring the plain-tag drag-and-drop's "union, skip
 *  already-tagged" semantics (BoardRoot's assignTagToCards). A bookmark id
 *  that doesn't exist is silently skipped (neither list) — same no-op
 *  contract as addPrivateTag itself. A failure on one card (e.g. a null
 *  session) doesn't stop the rest; failed ids come back so the caller can
 *  report them. */
export async function addPrivateTagBatch(
  db: DbLike,
  bookmarkIds: readonly string[],
  privateTagId: string,
  session: PrivateVaultSession,
): Promise<{ readonly succeeded: readonly string[]; readonly failed: readonly string[] }> {
  const succeeded: string[] = []
  const failed: string[] = []
  for (const id of bookmarkIds) {
    try {
      const bookmark = await getBookmark(db, id)
      if (!bookmark) continue
      if (bookmark.tags.includes(privateTagId)) { succeeded.push(id); continue }
      await addPrivateTag(db, id, privateTagId, session)
      succeeded.push(id)
    } catch {
      failed.push(id)
    }
  }
  return { succeeded, failed }
}

/** Executes an already-unlocked `toggle-tag` or `batch-encrypt` pending
 *  action. The `filter` kind is intentionally NOT accepted here — it has no
 *  IDB side effect; callers apply it directly via their own filter-change
 *  handler before ever constructing a call to this function. */
export async function executePrivateAction(
  db: DbLike,
  action: Extract<PendingPrivateAction, { kind: 'toggle-tag' | 'batch-encrypt' }>,
  privateTagId: string,
  session: PrivateVaultSession,
): Promise<{ readonly failed: readonly string[] }> {
  if (action.kind === 'toggle-tag') {
    if (action.currentlyTagged) {
      await removePrivateTag(db, action.bookmarkId, privateTagId, session)
    } else {
      await addPrivateTag(db, action.bookmarkId, privateTagId, session)
    }
    return { failed: [] }
  }
  const { failed } = await addPrivateTagBatch(db, action.bookmarkIds, privateTagId, session)
  return { failed }
}
```

No new imports needed — `getBookmark`, `DbLike`, `PrivateVaultSession` are already imported at the top of this file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk npx vitest run lib/private/apply-tag-change.test.ts`
Expected: PASS, all tests (old + new) green.

- [ ] **Step 5: Typecheck**

Run: `rtk npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/private/apply-tag-change.ts lib/private/apply-tag-change.test.ts
git commit -m "$(cat <<'EOF'
feat(private): add batch-encrypt + 3-state routing logic

Pure functions only — resolvePrivateStatus, addPrivateTagBatch,
executePrivateAction, PRIVATE_DROP_KEY. Not wired into any UI yet.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: PrivateSetupDialog explanation copy

**Files:**
- Modify: `components/board/PrivateSetupDialog.tsx`
- Modify: `components/board/PrivateSetupDialog.module.css`
- Test: `components/board/PrivateSetupDialog.test.tsx`

**Interfaces:** None — self-contained visual change, no new props.

- [ ] **Step 1: Write the failing test**

Add to `components/board/PrivateSetupDialog.test.tsx` (inside the existing `describe('PrivateSetupDialog', ...)` block, alongside the existing `it(...)` cases):

```ts
  it('explains what setting up Private does, before any input', () => {
    render(<PrivateSetupDialog onCreate={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByTestId('private-setup-explanation')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npx vitest run components/board/PrivateSetupDialog.test.tsx`
Expected: FAIL — no element with `data-testid="private-setup-explanation"`.

- [ ] **Step 3: Implement**

In `components/board/PrivateSetupDialog.tsx`, insert right after the `<div id="private-setup-heading" ...>SET UP PRIVATE</div>` line and before the password `<label>`:

```tsx
        <div className={styles.explanation} data-testid="private-setup-explanation">
          Encrypts the title, URL, thumbnail and photos of anything tagged Private
          with this password — the real content is never stored in plain text.
          There is no recovery besides the hint below: if you forget the password,
          the content stays encrypted forever.
        </div>
```

In `components/board/PrivateSetupDialog.module.css`, add:

```css
.explanation {
  font-size: 12px;
  line-height: 1.5;
  color: rgba(242, 242, 242, 0.6);
  margin-bottom: 4px;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk npx vitest run components/board/PrivateSetupDialog.test.tsx`
Expected: PASS, all tests (old + new) green.

- [ ] **Step 5: Commit**

```bash
git add components/board/PrivateSetupDialog.tsx components/board/PrivateSetupDialog.module.css components/board/PrivateSetupDialog.test.tsx
git commit -m "$(cat <<'EOF'
feat(private): explain what SET UP PRIVATE does before the password fields

Discovery-entry work (Phase 2) surfaces this dialog to people who never
saw the SETTINGS-only entry point before — they need the "what happens"
context the SETTINGS button previously implied by its own label.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: BoardRoot core routing + FilterPill (covers the `filter` action kind end-to-end)

**Files:**
- Modify: `components/board/BoardRoot.tsx`
- Modify: `components/board/FilterPill.tsx`
- Modify: `components/board/FilterPill.module.css`

**Interfaces:**
- Consumes: `resolvePrivateStatus`, `PendingPrivateAction`, `executePrivateAction` from `@/lib/private/apply-tag-change` (Task 1).
- Produces: `handlePrivateEntry(action: PendingPrivateAction): void`, `privateStatus: PrivateStatus`, `tagsExcludingPrivate: TagRecord[]` — all consumed by Task 4 and Task 5.

### Part A — BoardRoot plumbing

- [ ] **Step 1: Add the new imports**

In `components/board/BoardRoot.tsx`, change the existing line 68 import:

```ts
import { addPrivateTag, removePrivateTag } from '@/lib/private/apply-tag-change'
```

to:

```ts
import {
  addPrivateTag, removePrivateTag, resolvePrivateStatus, executePrivateAction,
  type PendingPrivateAction, type PrivateStatus,
} from '@/lib/private/apply-tag-change'
```

`runPrivateAction` (Step 6 below) also needs the `PrivateVaultSession` type for its `session` parameter. Change the existing line 66 import:

```ts
import { usePrivateVaultSession, setPrivateVaultSession } from '@/lib/private/vault-session'
```

to:

```ts
import { usePrivateVaultSession, setPrivateVaultSession, type PrivateVaultSession } from '@/lib/private/vault-session'
```

- [ ] **Step 2: Add `pendingPrivateAction` state**

Right after the existing `pendingPrivateShare` declaration (`components/board/BoardRoot.tsx:253-254`):

```ts
  const [pendingPrivateShare, setPendingPrivateShare] =
    useState<{ count: number; resume: 'desktop' | 'mobile' } | null>(null)
  // Deferred Private action (toggle one bookmark / apply the filter / batch-
  // encrypt many bookmarks) — set when the user interacted with a "🔒
  // Private" row while the vault is not-set-up or locked, and resumed
  // automatically once PrivateSetupDialog/PrivateUnlockDialog succeeds
  // (see handlePrivateEntry below).
  const [pendingPrivateAction, setPendingPrivateAction] = useState<PendingPrivateAction | null>(null)
```

- [ ] **Step 3: Add `privateStatus` derived value**

Right after the `useTags()` destructure closes (`components/board/BoardRoot.tsx:257-260`, the block ending `} = useTags()`), insert:

```ts
  // Always-current 3-state Private status — drives every "🔒 Private" row's
  // click/drop routing (handlePrivateEntry) and its rendered tone.
  const privateStatus: PrivateStatus = resolvePrivateStatus(privateTagId, privateSession)
```

- [ ] **Step 4: Rename `bulkAssignableTags` to `tagsExcludingPrivate` and broaden its doc comment**

Find the existing declaration (`components/board/BoardRoot.tsx:3196-3207`):

```ts
  // Private must never be a drag/bulk-assign target — assigning it triggers
  // real per-card encryption and should only happen via the individual card's
  // own tag toggle (handleTagToggle -> addPrivateTag), never a casual
  // multi-card drop or tap. Both bulk-tagging UIs route through
  // assignTagToCards -> persistTags, a plain tag-array write that does NOT
  // encrypt, so offering Private there would look protected while leaving
  // title/url/thumbnail in plaintext.
  const bulkAssignableTags = useMemo(
    () => (privateTagId === null ? tags : tags.filter((t) => t.id !== privateTagId)),
    [tags, privateTagId],
  )
```

Replace with:

```ts
  // Private is never mixed into the generic tag list any UI enumerates —
  // every surface that shows/assigns "ordinary" tags (FilterPill, the card
  // + button popover, MANAGE TAGS drag-and-drop, mobile tag bar) gets this
  // Private-free list, and renders its own dedicated "🔒 Private" row/chip
  // separately (routed through handlePrivateEntry, not this array). Assigning
  // Private through the *generic* tag machinery would use assignTagToCards ->
  // persistTags, a plain tag-array write that does NOT encrypt — offering it
  // there would look protected while leaving title/url/thumbnail in
  // plaintext.
  const tagsExcludingPrivate = useMemo(
    () => (privateTagId === null ? tags : tags.filter((t) => t.id !== privateTagId)),
    [tags, privateTagId],
  )
```

Then update its two existing call sites (still in this task, since renaming and not updating callers would break the build):

`components/board/BoardRoot.tsx:4036` (`TagDropPanel`) and `:4048` (`BoardMobileTagBar`) — change `tags={bulkAssignableTags}` to `tags={tagsExcludingPrivate}` in both.

- [ ] **Step 5: Replace the inline privateStatus ternary at the SETTINGS entry**

Find (`components/board/BoardRoot.tsx:3523`):

```tsx
                privateStatus={privateTagId === null ? 'none' : privateSession === null ? 'locked' : 'unlocked'}
```

Replace with:

```tsx
                privateStatus={privateStatus}
```

- [ ] **Step 6: Add `runPrivateAction` and `handlePrivateEntry`**

Place these right after `handleFilterChange` (`components/board/BoardRoot.tsx:2078-2085`, ending `}, [])`) — NOT earlier in the file (e.g. not right after `handleTagCreate`): `runPrivateAction`'s dependency array reads `handleFilterChange` itself, and a `useCallback` dependency array is evaluated immediately at render time (unlike the callback body, which only runs later) — declaring it before `handleFilterChange` exists would throw a temporal-dead-zone `ReferenceError` on every render:

```ts
  /** Executes an already-unlocked Private action and reports/reloads. `filter`
   *  has no IDB write — it just flips the board's active tag filter. Callers
   *  that resume from a just-completed setup/unlock dialog pass the freshly
   *  returned tagId/session directly (React state hasn't re-rendered with
   *  them yet at that point); the direct/unlocked call site below passes the
   *  current `privateTagId`/`privateSession`. */
  const runPrivateAction = useCallback(
    async (action: PendingPrivateAction, resolvedPrivateTagId: string, session: PrivateVaultSession): Promise<void> => {
      if (action.kind === 'filter') {
        handleFilterChange(toggleTagInFilter(activeFilter, resolvedPrivateTagId))
        setPendingPrivateAction(null)
        return
      }
      const db = await initDB()
      const { failed } = await executePrivateAction(db, action, resolvedPrivateTagId, session)
      if (failed.length > 0) {
        setToast({
          message: `Could not encrypt ${failed.length} card${failed.length === 1 ? '' : 's'}`,
          nonce: Date.now(),
        })
      }
      setPendingPrivateAction(null)
      await reload()
    },
    [activeFilter, handleFilterChange, reload],
  )

  /** Single entry point for every "🔒 Private" row/chip's click or drop.
   *  Not-set-up -> opens PrivateSetupDialog; locked -> opens
   *  PrivateUnlockDialog (both remember `action` as pendingPrivateAction, to
   *  auto-resume on success); unlocked -> executes immediately, no dialog. */
  const handlePrivateEntry = useCallback(
    (action: PendingPrivateAction): void => {
      if (privateTagId === null) {
        setPendingPrivateAction(action)
        setPrivateDialog('setup')
        return
      }
      if (privateSession === null) {
        setPendingPrivateAction(action)
        setPrivateDialog('unlock')
        return
      }
      void runPrivateAction(action, privateTagId, privateSession)
    },
    [privateTagId, privateSession, runPrivateAction],
  )
```

- [ ] **Step 7: Wire the dialog-resume**

In the `PrivateSetupDialog`'s `onCreate` (`components/board/BoardRoot.tsx:3929-3952`), the success path currently ends:

```ts
              const session = await createVault(db, tag.id, password, hint)
              setPrivateVaultSession(session)
              void reloadTags()
              setPrivateDialog(null)
              return true
```

Change to:

```ts
              const session = await createVault(db, tag.id, password, hint)
              setPrivateVaultSession(session)
              void reloadTags()
              setPrivateDialog(null)
              if (pendingPrivateAction) void runPrivateAction(pendingPrivateAction, tag.id, session)
              return true
```

In the `PrivateUnlockDialog`'s `onSubmit` (`components/board/BoardRoot.tsx:3956-3976`), the success path currently ends:

```ts
              const session = await unlockVault(db, password)
              if (!session) return false
              setPrivateVaultSession(session)
              setPrivateDialog(null)
              return true
```

Change to:

```ts
              const session = await unlockVault(db, password)
              if (!session) return false
              setPrivateVaultSession(session)
              setPrivateDialog(null)
              if (pendingPrivateAction && privateTagId) void runPrivateAction(pendingPrivateAction, privateTagId, session)
              return true
```

(`privateTagId` is safe to read here — the unlock dialog only ever opens for an *existing* vault, so the tag already exists regardless of lock state; see the `useTags()` doc comment at `components/board/BoardRoot.tsx:241-246`.)

### Part B — FilterPill

- [ ] **Step 8: Add the new props + pinned row to FilterPill**

In `components/board/FilterPill.tsx`, add to the `Props` type (after `onCycleTagOrder`):

```ts
  /** 3-state Private status — drives the pinned "🔒 Private" row's tone.
   *  Always rendered (never mixed into the sortable `tags` list above). */
  readonly privateStatus: 'none' | 'locked' | 'unlocked'
  /** True when the active filter already includes the Private tag. */
  readonly privateActive: boolean
  /** Click the Private row. The parent decides what happens (open a dialog,
   *  or toggle the filter) based on privateStatus — this component only
   *  renders and forwards the click. */
  readonly onPrivateClick: () => void
```

Add to the destructured function params:

```ts
export function FilterPill({
  value, onChange, tags, counts, tagCounts, tagsMatchCount, onTagContextMenu, activeContextTagId, onReorder,
  editingTagId, onRenameSubmit, onRenameCancel, tagOrderMode, onCycleTagOrder,
  privateStatus, privateActive, onPrivateClick,
}: Props): ReactElement {
```

Add the pinned row right after the closing `</div>` of `bottomGroup` (`components/board/FilterPill.tsx:493-511`, i.e. right before the two closing `</div>` tags that end `menuInner`/`menu`):

```tsx
          <button
            type="button"
            className={`${styles.item} ${styles.privateItem} ${privateActive ? styles.active : ''}`.trim()}
            data-private-status={privateStatus}
            data-testid="filter-pill-private"
            onClick={onPrivateClick}
          >
            <span className={styles.privateIcon} aria-hidden="true">🔒</span>
            <span className={styles.itemLabel}>Private</span>
          </button>
```

In `components/board/FilterPill.module.css`, add (near the `.deadItem`/`.deadDot` block):

```css
/* Private — always rendered, pinned last (below TRASH/DEAD LINKS). Muted at
   rest; the icon alone signals lock state, no separate glyph swap needed. */
.item.privateItem {
  color: rgba(var(--chrome-ink-rgb), 0.5);
}
.item.privateItem:hover {
  background: rgba(var(--chrome-ink-rgb), 0.06);
  color: rgba(var(--chrome-ink-rgb), 0.8);
}
.item.privateItem[data-private-status='unlocked'] {
  color: rgba(var(--chrome-ink-rgb), 0.85);
}
.item.privateItem.active .itemLabel {
  box-shadow: inset 0 -1px 0 #28F100;
}
.privateIcon {
  font-size: 10px;
  flex-shrink: 0;
  opacity: 0.85;
}
```

- [ ] **Step 9: Wire the new props at FilterPill's call site**

In `components/board/BoardRoot.tsx`, the `filterPillEl` definition (`:3308-3327`): change `tags={tags}` to `tags={tagsExcludingPrivate}`, and add after `onCycleTagOrder={...}`:

```tsx
      privateStatus={privateStatus}
      privateActive={privateTagId !== null && isTagsFilter(activeFilter) && activeFilter.tagIds.includes(privateTagId)}
      onPrivateClick={(): void => handlePrivateEntry({ kind: 'filter' })}
```

- [ ] **Step 10: Typecheck and run the full existing suite**

Run: `rtk npx tsc --noEmit`
Expected: no errors.

Run: `rtk npx vitest run`
Expected: all existing tests still PASS (no new test file in this task — FilterPill has no prior unit-test coverage in this codebase; its new behavior is verified by Task 6's e2e).

- [ ] **Step 11: Commit**

```bash
git add components/board/BoardRoot.tsx components/board/FilterPill.tsx components/board/FilterPill.module.css
git commit -m "$(cat <<'EOF'
feat(private): always show a pinned Private row in FilterPill

Routes through the new handlePrivateEntry (not-set-up -> setup dialog,
locked -> unlock dialog with auto-resume, unlocked -> toggle the filter
directly) instead of mixing Private into the sortable tag list.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: TagAddPopover + CardsLayer (covers the `toggle-tag` action kind end-to-end)

**Files:**
- Modify: `components/board/TagAddPopover/index.tsx`
- Modify: `components/board/TagAddPopover/TagAddPopover.module.css`
- Modify: `components/board/CardsLayer.tsx`
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: `tagsExcludingPrivate`, `privateStatus`, `handlePrivateEntry` from Task 3.

- [ ] **Step 1: Add the `privateEntry` prop to TagAddPopover**

In `components/board/TagAddPopover/index.tsx`, add to `TagAddPopoverProps` (after `compact`):

```ts
  /** Always-rendered "🔒 Private" chip, pinned at the very bottom (below the
   *  new-tag input). Separate from allTags/suggestedEntries — Private is
   *  never mixed into the generic chip list (see BoardRoot's
   *  tagsExcludingPrivate doc comment). Omitted entirely by callers that
   *  should not offer Private at all (e.g. the PopOut/extension quick-tag
   *  popovers — Phase 2 scope ②, not built yet). */
  privateEntry?: {
    readonly status: 'none' | 'locked' | 'unlocked'
    readonly isTagged: boolean
    readonly onClick: () => void
  }
```

Add to the destructured params:

```ts
export function TagAddPopover({
  allTags, currentTagIds, suggestedEntries, onAddExisting, onAddNew, onClose,
  closing = false, onExited, compact = false, privateEntry,
}: TagAddPopoverProps): JSX.Element {
```

Add the chip right after the `<input ... />` (the last element inside the returned `<div>`, before its closing tag):

```tsx
      {privateEntry && (
        <button
          type="button"
          className={styles.chipPrivate}
          data-private-status={privateEntry.status}
          data-has={privateEntry.isTagged ? 'true' : 'false'}
          data-testid="tag-add-popover-private"
          onMouseDown={(e): void => e.preventDefault()}
          onClick={privateEntry.onClick}
        >
          🔒 {privateEntry.isTagged ? '✓ ' : ''}Private
        </button>
      )}
```

In `components/board/TagAddPopover/TagAddPopover.module.css`, add:

```css
.chipPrivate {
  appearance: none;
  border: none;
  background: transparent;
  align-self: flex-start;
  color: rgba(255, 255, 255, 0.55);
  padding: 4px 8px;
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: color 120ms;
}
.chipPrivate:hover {
  color: rgba(255, 255, 255, 0.85);
}
.chipPrivate[data-private-status='unlocked'] {
  color: rgba(255, 255, 255, 0.85);
}
.chipPrivate[data-has='true'] {
  color: #28F100;
}
```

- [ ] **Step 2: Thread `privateStatus`/`privateTagId`/`onPrivateToggle` through CardsLayer**

In `components/board/CardsLayer.tsx`, add to the `Props` type (near the existing `allTags: readonly TagRecord[],` at `:170`):

```ts
  allTags: readonly TagRecord[],
  /** 3-state Private status, forwarded into each card's TagAddPopover as
   *  `privateEntry.status`. */
  privateStatus: 'none' | 'locked' | 'unlocked',
  /** The Private tag's id, or null if the vault has never been set up.
   *  Used only to compute `privateEntry.isTagged` per card — never mixed
   *  into `allTags`. */
  privateTagId: string | null,
  /** Fired when a card's TagAddPopover Private chip is clicked. The parent
   *  (BoardRoot) routes this through handlePrivateEntry. */
  onPrivateToggle: (bookmarkId: string, currentlyTagged: boolean) => void,
```

Add to the destructured function params (near the existing `allTags,` around `:404`):

```ts
  allTags,
  privateStatus,
  privateTagId,
  onPrivateToggle,
```

At the `TagAddPopover` instantiation (`components/board/CardsLayer.tsx:1715-1727`), add the `privateEntry` prop:

```tsx
                    <TagAddPopover
                      allTags={allTags}
                      currentTagIds={it.tags}
                      suggestedEntries={openPopoverSuggestions}
                      closing={popoverClosing}
                      onExited={finishPopoverClose}
                      onAddExisting={(tagId): void => { void onTagToggle(it.bookmarkId, tagId) }}
                      onAddNew={(name): void => {
                        void onTagCreate(it.bookmarkId, name)
                        beginPopoverClose()
                      }}
                      onClose={beginPopoverClose}
                      privateEntry={{
                        status: privateStatus,
                        isTagged: privateTagId !== null && it.tags.includes(privateTagId),
                        onClick: (): void => onPrivateToggle(
                          it.bookmarkId,
                          privateTagId !== null && it.tags.includes(privateTagId),
                        ),
                      }}
                    />
```

- [ ] **Step 3: Wire CardsLayer's new props from BoardRoot + exclude Private from `allTags`**

In `components/board/BoardRoot.tsx`, at the `CardsLayer` instantiation (`:3730-3750`), change `allTags={tags}` to `allTags={tagsExcludingPrivate}`, and add after `activeContextTagId={...}`:

```tsx
                  privateStatus={privateStatus}
                  privateTagId={privateTagId}
                  onPrivateToggle={(bookmarkId, currentlyTagged): void =>
                    handlePrivateEntry({ kind: 'toggle-tag', bookmarkId, currentlyTagged })
                  }
```

- [ ] **Step 4: Remove the now-dead Private branch from `handleTagToggle`**

`handleTagToggle` (`components/board/BoardRoot.tsx:1670-1699`) is only ever called via `onAddExisting` from `TagAddPopover`'s generic chip list (Step 2 above), which — after Step 3's `allTags={tagsExcludingPrivate}` — can never contain the Private tag anymore. Its `tagId === privateTagId` branch is therefore unreachable. Simplify:

```ts
  const handleTagToggle = useCallback(
    async (bookmarkId: string, tagId: string): Promise<void> => {
      const item = items.find((it) => it.bookmarkId === bookmarkId)
      if (!item) return
      const db = await initDB()
      if (item.tags.includes(tagId)) {
        await removeTagFromBookmark(db, bookmarkId, tagId)
      } else {
        await addTagToBookmark(db, bookmarkId, tagId)
        setTagAddedTick((t) => t + 1)
      }
      await reload()
    },
    [items, reload],
  )
```

(This drops the `privateTagId`/`privateSession` entries from the dependency array along with the removed branch — `addPrivateTag`/`removePrivateTag` are still imported and used elsewhere via `executePrivateAction`, do not remove those imports.)

- [ ] **Step 5: Typecheck and run the full existing suite**

Run: `rtk npx tsc --noEmit`
Expected: no errors.

Run: `rtk npx vitest run`
Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add components/board/TagAddPopover/index.tsx components/board/TagAddPopover/TagAddPopover.module.css components/board/CardsLayer.tsx components/board/BoardRoot.tsx
git commit -m "$(cat <<'EOF'
feat(private): always show a Private chip in the card + button popover

TagAddPopover gets a dedicated privateEntry slot (not mixed into the
generic tag chip list), wired only at the board's own call site — the
PopOut/extension quick-tag popovers stay untouched (Phase 2 scope ②).
Removes handleTagToggle's now-unreachable Private branch now that
Private can never appear in the popover's generic allTags list.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: TagDropPanel + BoardMobileTagBar (covers the `batch-encrypt` action kind end-to-end)

**Files:**
- Modify: `components/board/TagDropPanel.tsx`
- Modify: `components/board/TagDropPanel.module.css`
- Modify: `components/board/BoardMobileTagBar.tsx`
- Modify: `components/board/BoardMobileTagBar.module.css`
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: `PRIVATE_DROP_KEY` from `@/lib/private/apply-tag-change` (Task 1); `privateStatus`, `handlePrivateEntry`, `tagsExcludingPrivate` from Task 3.

- [ ] **Step 1: Add the pinned Private row to TagDropPanel**

In `components/board/TagDropPanel.tsx`, add to `Props` (after `onCancelNewTag`):

```ts
  /** 3-state Private status — drives the pinned Private row's tone. */
  readonly privateStatus: 'none' | 'locked' | 'unlocked'
```

Add to the destructured params, and render the row right after the closing `</div>` of `.list` (i.e. after the scrollable tag list, still inside `.menu`, before its own closing `</div>`):

```tsx
export function TagDropPanel({
  tags,
  tagCounts,
  selectedCount,
  onDone,
  creating,
  onStartNewTag,
  onCommitNewTag,
  onCancelNewTag,
  privateStatus,
}: Props): ReactElement {
```

```tsx
        <div
          className={styles.tagItem}
          data-tag-id={PRIVATE_DROP_KEY}
          data-private-status={privateStatus}
          data-testid="tag-drop-private"
          title="Private"
        >
          <span className={styles.privateIcon} aria-hidden="true">🔒</span>
          <span className={styles.tagLabel}>Private</span>
        </div>
```

Add the import at the top of the file:

```ts
import { PRIVATE_DROP_KEY } from '@/lib/private/apply-tag-change'
```

In `components/board/TagDropPanel.module.css`, add (near `.tagDot`/`.tagLabel`):

```css
.privateIcon {
  width: 8px;
  text-align: center;
  font-size: 10px;
  flex-shrink: 0;
}
.tagItem[data-private-status='unlocked'] { color: rgba(var(--chrome-ink-rgb), 0.92); }
```

(The row inherits `.tagItem`'s existing `[data-drop-hover]`/`[data-dropped]` styling for free — CardsLayer's generic `[data-tag-id]` hit-test doesn't distinguish this row from a real tag row.)

- [ ] **Step 2: Add the tap-to-batch-encrypt chip to BoardMobileTagBar**

In `components/board/BoardMobileTagBar.tsx`, add to `Props` (after `onCancelNewTag`):

```ts
  /** 3-state Private status — drives the pinned chip's tone. */
  readonly privateStatus: 'none' | 'locked' | 'unlocked'
  /** Tap the Private chip. No-op when nothing is selected (mirrors onAssignTag). */
  readonly onPrivateTap: () => void
```

Add to the destructured params, and render the chip as the LAST element inside `.strip` (after the `tags.map(...)` block, still inside the `.strip` div):

```tsx
export function BoardMobileTagBar({
  tags,
  tagCounts,
  selectedCount,
  onAssignTag,
  onDone,
  creating,
  onStartNewTag,
  onCommitNewTag,
  onCancelNewTag,
  privateStatus,
  onPrivateTap,
}: Props): ReactElement {
```

```tsx
        <button
          type="button"
          className={styles.chip}
          data-private-status={privateStatus}
          aria-disabled={!hasSelection}
          onClick={onPrivateTap}
          data-testid="mobile-tag-private"
          title="Private"
        >
          <span className={styles.tagLabel}>🔒 Private</span>
        </button>
```

In `components/board/BoardMobileTagBar.module.css`, add:

```css
.chip[data-private-status='unlocked'] { color: rgba(255, 255, 255, 0.92); }
```

- [ ] **Step 3: Route the `PRIVATE_DROP_KEY` drop and the mobile tap in BoardRoot**

In `components/board/BoardRoot.tsx`, add the import (extend the existing `@/lib/private/apply-tag-change` import from Task 3 Step 1):

```ts
import {
  addPrivateTag, removePrivateTag, resolvePrivateStatus, executePrivateAction, PRIVATE_DROP_KEY,
  type PendingPrivateAction, type PrivateStatus,
} from '@/lib/private/apply-tag-change'
```

In `handleTagDrop` (`:2322-2332`), add the sentinel check before the `assignTagToCards` fallthrough:

```ts
  const handleTagDrop = useCallback(
    (targetKey: string, cardIds: readonly string[]): void => {
      if (cardIds.length === 0) return
      if (targetKey === '__new__') {
        setTagDraft({ cardIds: [...cardIds] })
        return
      }
      if (targetKey === PRIVATE_DROP_KEY) {
        handlePrivateEntry({ kind: 'batch-encrypt', bookmarkIds: [...cardIds] })
        return
      }
      assignTagToCards(targetKey, cardIds)
    },
    [assignTagToCards, handlePrivateEntry],
  )
```

(`assignTagToCards`'s own internal `if (tagId === privateTagId) return` guard at `:2312` stays exactly as-is — it's a defense-in-depth backstop from the Phase 1 security review, not something this task removes.)

Add a mobile handler right after `handleAssignTagToSelection` (`:2337-2340`):

```ts
  const handleAssignPrivateToSelection = useCallback((): void => {
    if (selectedIds.size === 0) return
    handlePrivateEntry({ kind: 'batch-encrypt', bookmarkIds: [...selectedIds] })
  }, [selectedIds, handlePrivateEntry])
```

- [ ] **Step 4: Wire the new props at both call sites**

In `components/board/BoardRoot.tsx`, `TagDropPanel` (`:4034-4045`): add `privateStatus={privateStatus}` after `tags={tagsExcludingPrivate}`.

`BoardMobileTagBar` (`:4046-4058`): add `privateStatus={privateStatus}` and `onPrivateTap={handleAssignPrivateToSelection}` after `onAssignTag={handleAssignTagToSelection}`.

- [ ] **Step 5: Update the stale comment in the e2e helper file**

In `tests/e2e/private-vault.spec.ts`, the header comment (`:13-20`) currently says TagDropPanel/BoardMobileTagBar "deliberately exclude the Private tag post security-fix, so they are NOT used here." This is no longer true after this task — update it in Task 6 (which also adds the e2e coverage that makes the corrected comment accurate); no code change needed in this task beyond noting it here so Task 6 doesn't skip it.

- [ ] **Step 6: Typecheck and run the full existing suite**

Run: `rtk npx tsc --noEmit`
Expected: no errors.

Run: `rtk npx vitest run`
Expected: all existing tests still PASS.

- [ ] **Step 7: Commit**

```bash
git add components/board/TagDropPanel.tsx components/board/TagDropPanel.module.css components/board/BoardMobileTagBar.tsx components/board/BoardMobileTagBar.module.css components/board/BoardRoot.tsx
git commit -m "$(cat <<'EOF'
feat(private): batch-encrypt via MANAGE TAGS drag-and-drop / mobile tap

Adds a pinned "🔒 Private" row (desktop drop target, mobile tap chip)
using the PRIVATE_DROP_KEY sentinel — same '__new__'-style routing
CardsLayer's generic [data-tag-id] hit-test already supports. Routes
through handlePrivateEntry, so a lock/setup mid-drop auto-resumes the
batch once the dialog succeeds.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: e2e coverage + full gate

**Files:**
- Modify: `tests/e2e/private-vault.spec.ts`

**Interfaces:** None — end-to-end verification only, using the real shipped components' testids introduced in Tasks 3-5 (`filter-pill-private`, `tag-add-popover-private`, `tag-drop-private`, `mobile-tag-private`).

- [ ] **Step 1: Correct the stale header comment**

Replace the paragraph at `tests/e2e/private-vault.spec.ts:13-20`:

```ts
//   - components/board/CardsLayer.tsx (~1655-1730): the ONLY still-valid way to
//     assign the Private tag to a card is the per-card "+ TAG" popover
//     (data-testid="card-add-tag-button", hover-revealed, pointer-events:none
//     until hovered) -> TagAddPopover chip click (onAddExisting -> handleTagToggle,
//     which branches on tagId === privateTagId to call the real
//     addPrivateTag/removePrivateTag encrypting path). TagDropPanel (drag-drop)
//     and BoardMobileTagBar (bulk) both deliberately exclude the Private tag
//     post security-fix, so they are NOT used here.
```

with:

```ts
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
```

- [ ] **Step 2: Patch the existing comprehensive test — it asserted the OLD "Private hidden while locked / generic chip" behavior, which this plan intentionally inverts**

The existing `test('Private: create, disappears on reload while locked, reappears when unlocked, gated from SHARE', ...)` (added by the Phase 1 plan) makes assertions that Tasks 3-4 make false: it asserts the Private tag is a plain-text `"Private"` chip inside the popover's generic list, and that it's completely ABSENT from FilterPill's DOM while locked. Both are now wrong on purpose — Private is always visible, in a dedicated slot. Four targeted replacements, using the exact original text (re-read the file first; line numbers may have drifted from Tasks 1-5's other edits to this repo, match by content):

**Replacement 1** (card + button popover click — the old exact-text chip is gone):

Find:
```ts
  await card.hover()
  await card.getByTestId('card-add-tag-button').click({ force: true })
  // The popover's existing-tag chip renders as plain text `tag.name` (has:false)
  // or `✓ ${tag.name}` (has:true) — TagAddPopover/index.tsx renderExistingChip.
  // A heuristic "+ Private" NEW-tag suggestion could also appear (our title
  // contains the word "Private"), but that renders as "+ Private" (chipNew),
  // which an exact-text match for "Private" does not match — so this is
  // unambiguous even if the suggestion engine fires.
  await card.getByText('Private', { exact: true }).click()
```

Replace with:
```ts
  await card.hover()
  await card.getByTestId('card-add-tag-button').click({ force: true })
  // Private Phase 2 (s203): the popover no longer offers Private as a generic
  // chip (TagAddPopover/index.tsx renderExistingChip) — it's a dedicated,
  // always-rendered privateEntry slot instead, routed through BoardRoot's
  // handlePrivateEntry (not onAddExisting/handleTagToggle).
  await card.getByTestId('tag-add-popover-private').click()
```

**Replacement 2** (locked-state FilterPill check — Private is no longer removed from the DOM while locked):

Find:
```ts
  // 5. Locked: the bookmark must not render at all (lib/board/filter.ts's
  // privateGatePasses excludes it from the default ALL view outright — not
  // just visually hidden), and the Private tag must not appear in FilterPill
  // (useTags().tags filters isPrivateVault rows out while privateSession is
  // null). The dropdown doesn't need to be open for a DOM-presence check —
  // FilterPill's menu is always mounted (FilterPill.tsx comment ~109-111).
  await expect(card).toHaveCount(0)
  const privateTagLabel = page.getByTestId('filter-pill-menu').getByText('Private', { exact: true })
  await expect(privateTagLabel).toHaveCount(0)
```

Replace with:
```ts
  // 5. Locked: the bookmark must not render at all (lib/board/filter.ts's
  // privateGatePasses excludes it from the default ALL view outright — not
  // just visually hidden). The Private ROW ITSELF is Phase 2 (s203)
  // always-visible chrome, though — it stays in FilterPill's DOM in every
  // state, rendered with a 'locked' tone instead of being removed.
  await expect(card).toHaveCount(0)
  const privateRow = page.getByTestId('filter-pill-private')
  await expect(privateRow).toBeVisible()
  await expect(privateRow).toHaveAttribute('data-private-status', 'locked')
```

**Replacement 3** (step 7, unlock then click to reveal — `privateTagLabel` no longer exists, and its "now visible" premise is gone):

Find:
```ts
  // 7. Click the Private tag in FilterPill — now visible in the tag list —
  // and assert the bookmark reappears. Clicking the pill toggles it open +
  // sticky (FilterPill.tsx pill onClick), independent of hover timing.
  await page.getByTestId('filter-pill').click()
  await expect(privateTagLabel).toHaveCount(1)
  await privateTagLabel.click()
  await expect(card).toBeVisible()
```

Replace with:
```ts
  // 7. Click the Private row in FilterPill — now unlocked-toned — and assert
  // the bookmark reappears. Clicking the pill toggles it open + sticky
  // (FilterPill.tsx pill onClick), independent of hover timing.
  await page.getByTestId('filter-pill').click()
  await expect(privateRow).toHaveAttribute('data-private-status', 'unlocked')
  await privateRow.click()
  await expect(card).toBeVisible()
```

**Replacement 4** (step 9, re-select for SHARE — same `privateTagLabel` rename):

Find:
```ts
  // 9. Re-select the Private filter, select the (only) card, and trigger
  // SHARE. Desktop flow verified against tests/e2e/board-share-polish.spec.ts's
  // "still uses the arrange stage with ShareSelectBar -> ShareToast" test.
  await page.getByTestId('filter-pill').click()
  await expect(privateTagLabel).toHaveCount(1)
  await privateTagLabel.click()
  await expect(card).toBeVisible()
```

Replace with:
```ts
  // 9. Re-select the Private filter, select the (only) card, and trigger
  // SHARE. Desktop flow verified against tests/e2e/board-share-polish.spec.ts's
  // "still uses the arrange stage with ShareSelectBar -> ShareToast" test.
  await page.getByTestId('filter-pill').click()
  await privateRow.click()
  await expect(card).toBeVisible()
```

- [ ] **Step 3: Add e2e test — FilterPill Private row from the not-set-up state**

Add to `tests/e2e/private-vault.spec.ts`, as a new `test(...)` alongside the existing one. Note the correct `seedDb` call shape — it takes ONE merged array, matching the existing test's own `seedDb(page, [...firstRunSuppressors(), ...seedOneBookmark()])` call (not two separate arguments):

```ts
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
  // Resumed automatically as a `filter` action — no card carries the
  // brand new Private tag yet, so the board goes to zero results; the row's
  // own click drove straight into the active tag filter, no second click.
  await expect(card).toHaveCount(0)
  await expect(page.getByTestId('filter-pill')).toContainText('private')
})
```

- [ ] **Step 4: Add e2e test — card + button Private chip from the not-set-up state**

```ts
test('card + button Private chip opens setup when not set up, and resumes as an encrypt', async ({ page }) => {
  await seedDb(page, [...firstRunSuppressors(), ...seedOneBookmark()])
  await page.locator('[data-theme-id]').first().waitFor({ timeout: 30_000 })
  const card = page.locator(`[data-bookmark-id="${BOOKMARK_ID}"]`)
  await expect(card).toBeVisible({ timeout: 15_000 })

  await card.hover()
  await card.getByTestId('card-add-tag-button').click({ force: true })
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
```

- [ ] **Step 5: Add e2e test — MANAGE TAGS batch-encrypt, via the mobile tap path**

Add a second seed helper near `seedOneBookmark` (top of the file), for a 2-card selection:

```ts
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
```

This test deliberately uses the **mobile tap-to-assign** path (`BoardMobileTagBar`), not desktop drag-and-drop: `CardsLayer`'s drag-to-tag is a custom pointer-move hit-test (`components/board/CardsLayer.tsx:1062-1066`, `document.elementFromPoint` + manual pointermove/pointerup tracking), not the native HTML5 Drag and Drop API that Playwright's `dragTo()` drives — simulating it reliably would need a hand-rolled `page.mouse.move/down/up` sequence with no verified precedent in this file to build on. Both UI paths call the exact same `handlePrivateEntry({ kind: 'batch-encrypt', ... })` (Task 5's `handleTagDrop`'s `PRIVATE_DROP_KEY` branch vs. its `handleAssignPrivateToSelection`), so the mobile tap path exercises identical batch logic through a reliably-automatable UI:

```ts
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
  await page.getByTestId('mobile-nav-tag').click()
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
```

*(Implementer note: if `cardA.click()`/`cardB.click()` don't register as a TAG MODE selection on a real mobile-emulated viewport, check `CardsLayer.tsx`'s `handleSelectPointerDown` — Playwright's `.click()` synthesizes a full pointer sequence, which should reach it, but this exact flow has no prior test in this file to confirm against; adjust to `page.mouse.click()` at the card's bounding box center if a plain `.click()` doesn't register.)*

- [ ] **Step 6: Run the e2e suite**

Run: `rtk npx playwright test tests/e2e/private-vault.spec.ts`
Expected: all tests (existing, patched + new) PASS.

- [ ] **Step 7: Full gate**

Run, in order:
- `rtk npx tsc --noEmit` — expect 0 errors
- `rtk npx vitest run` — expect all green
- `rtk pnpm build` — expect success

- [ ] **Step 8: Commit**

```bash
git add tests/e2e/private-vault.spec.ts
git commit -m "$(cat <<'EOF'
test(private): e2e coverage for the always-visible Private entry points

Patches the existing Phase-1 test's now-inverted assumptions (Private
used to vanish from FilterPill while locked and read as a plain "Private"
chip in the popover — both are now intentionally different), and adds
not-set-up-state + dialog-resume coverage for all three surfaces
(FilterPill, card + button, MANAGE TAGS via the mobile tap path).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Not in this plan (explicitly out of scope, per the spec)

- ②(PopOut/extension/bookmarklet quick-save Private support, "case B" key transfer) — separate brainstorming session.
- ④(hide-the-Private-entry-point option in SETTINGS) — separate brainstorming session, builds on Task 3's `privateStatus`/`handlePrivateEntry` foundation.
- Bulk "remove Private" (batch decrypt) — not built; only additive batch-encrypt.
- `/triage` — dormant, untouched.
