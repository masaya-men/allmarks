# 端末間同期 束6③(vault食い違い・タグ漏洩安全網・EMPTY TRASH文言) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close a real privacy leak where a second `isPrivateVault:true` tag (created when two devices independently set up Private before ever syncing) shows Private items unhidden in the main board; add a sync-safety note to EMPTY TRASH; and build the vault-conflict resolution flow that lets two independently-created Private vaults converge into one, with zero data loss and zero cross-device password retyping.

**Architecture:** Part 1 broadens two existing "hide Private" checks from "matches the one resolved `privateTagId`" to "matches any `isPrivateVault:true` tag" — a pure, additive safety net independent of whether any conflict is ever resolved. Part 3 adds a small new module (`lib/private/vault-conflict.ts`) that determines a *deterministic* winner between two differing vaults (reusing `merge.ts`'s existing tie-break), lets the losing device's user re-encrypt its own already-decryptable Private bookmarks under the winning vault's public key (needs only its own password — this reuses the exact `decryptWithPrivateKey`/`encryptWithPublicKey` primitives `apply-tag-change.ts` already uses), and lets the winning device auto-publish its vault record to Drive with zero password needed (publishing only ever needs the public half). The result: nobody ever types a password meant for a different device; the two devices converge to one vault entirely through their own separate, ordinary "unlock Private" actions, whenever each happens to occur.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Vanilla CSS Modules, `idb` (IndexedDB), Web Crypto API (existing primitives only, no new crypto), Vitest + Testing Library, `fake-indexeddb`.

**Spec:** `docs/private/2026-09-02-device-sync-design.md` §9 (Private vault sync — this plan extends it: §9 assumed a single vault created once; this plan is what happens when that assumption is violated) and §6.6 (EMPTY TRASH sync caveat, copy already user-approved there). The vault-conflict resolution flow itself has no prior spec section — it was designed collaboratively with the user in-session on 2026-09-16 (see the approved copy table below, which is the authoritative record of that approval).

## Global Constraints

- `strict: true` TypeScript; no `any`.
- **No new cryptographic primitives.** Every crypto operation in Part 3 is a call to an existing, already-shipped function in `lib/private/crypto.ts` (`decryptWithPrivateKey`, `encryptWithPublicKey`, `importPublicKey`) or `lib/private/vault-store.ts`/`lib/storage/tags.ts` (`deleteTagCascade`). Do not add new `crypto.subtle` calls anywhere in this plan.
- **Nobody ever types a password meant for a different device.** Every password field in every new dialog in this plan is the *local* device's own existing Private password (the same one the user already types to unlock Private today), or a *brand-new* password the user is choosing fresh right now. No dialog in this plan ever asks for "the other device's password."
- **No destructive action without a full reversible trail.** The losing side's vault record is deleted only *after* its bookmarks have been successfully re-encrypted and retagged in the same local transaction sequence — never before. The winning side's vault record is never modified, only ever read.
- **UI copy is final and approved — use it verbatim.** The approved copy table below is the source of truth for every JA/EN string in this plan; do not paraphrase it while implementing.
- Every new i18n key must be added to all 15 `messages/*.json` files (en + ja get real copy; the other 13 get the English copy verbatim — this repo's established pattern).
- `rtk` prefix on every shell command per the user's global CLAUDE.md, except `npx vitest`/`npx tsc` (that wrapper is known-broken for vitest in this repo, confirmed in the prior bundle). `--no-verify` is forbidden.
- Do not touch `lib/sync/drive-adapter.ts`'s existing exports' signatures, `lib/sync/merge.ts`'s existing merge behavior for bookmarks/tags/cards/boardConfig, or anything in bundle 6②'s `SyncPanel.tsx`/`SyncEngineRunner.tsx` — this bundle only adds new files plus small, additive extensions to `lib/sync/engine.ts`, `lib/board/filter.ts`, `components/board/BoardRoot.tsx`, `components/board/TrashConfirmDialog.tsx`, and `components/board/PrivateChangePasswordDialog.tsx`.

## Approved copy (JA primary / EN — reference for every task below)

| key | JA | EN |
|---|---|---|
| `trash.syncNote` | 同期中の端末がある場合、ゴミ箱に戻ってくることがあります(データを守る仕組みで、故障ではありません)。消すには両方の端末で空にしてください。 | If you sync with another device, items may come back to the trash — that's a safety feature, not a bug. Empty the trash on both devices to remove them for good. |
| `private.vaultConflictNoticeHeading` | Privateが2つ見つかりました | Two Private setups found |
| `private.vaultConflictNoticeBody` | もう一方でも開くと、1つにまとまります。 | Opening Private on the other one will combine them into one. |
| `private.vaultConflictNoticeButton` | わかった | Got it |
| `private.vaultConflictMergeHeading` | Privateをまとめます | Combine Private |
| `private.vaultConflictMergeBody` | 続けると、Privateが1つにまとまります。今のパスワードは使われなくなります。 | Continuing will combine Private into one. This password will no longer be used. |
| `private.vaultConflictMergeNotNow` | 今はしない | Not now |
| `private.vaultConflictMergeConfirm` | まとめる | Combine |
| `private.vaultConflictMergeFailed` | まとめられませんでした。もう一度お試しください。 | Couldn't combine. Try again. |
| `private.vaultConflictResolvedHeading` | Privateがまとまりました | Private is combined |
| `private.vaultConflictResolvedBody` | これから使う、新しいパスワードを1つ決めてください。 | Set a new password to use from now on. |

Screen ③'s dialog reuses the existing `private.newPasswordLabel`/`private.confirmNewPasswordLabel`/`private.hintLabel`/`private.showPassword`/`private.hidePassword`/`private.errorTooShort`/`private.errorMismatch` keys verbatim (already shipped, unchanged) — only the heading and explanation are new/different from the existing password-change dialog's `private.changePasswordHeading`/`private.changePasswordExplanation`.

---

### Task 1: Close the Private-tag leak in `lib/board/filter.ts`

**Files:**
- Modify: `lib/board/filter.ts` (full file, 36 lines — shown below)
- Create: `lib/board/filter.test.ts` (no test file exists for this module today)

**Interfaces:**
- Produces: `applyFilter`'s third parameter changes from `privateTagId: string | null` to `privateTagIds: ReadonlySet<string>`. Consumed by Task 2 (`BoardRoot.tsx`'s two call sites).

This is a real, currently-shippable privacy bug (not yet reachable in production only because nobody has a sync-unlock key yet — see prior session's investigation). `privateGatePasses` today takes a single `privateTagId` and returns `true` (visible) for any item whose Private tag id isn't an exact match — so a *second* `isPrivateVault:true` tag (which arises when two devices each independently create Private before ever syncing, per Task 3) is invisible to this function entirely: its items pass the gate and show up, unhidden, blank-content, in the main board.

- [ ] **Step 1: Write the failing tests**

`lib/board/filter.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { applyFilter } from './filter'
import type { BoardItem } from '@/lib/storage/use-board-data'

function item(id: string, overrides: Partial<BoardItem> = {}): BoardItem {
  return {
    bookmarkId: id, url: `https://x.com/${id}`, title: id, description: '', thumbnail: '',
    favicon: '', siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z',
    ogpStatus: 'fetched', tags: [], isDeleted: false, linkStatus: 'alive',
    displayMode: null, ...overrides,
  } as BoardItem
}

describe('applyFilter — Private tag hiding', () => {
  it('hides an item tagged with any id in privateTagIds from the all filter', () => {
    const items = [item('a', { tags: ['private-1'] }), item('b', { tags: ['private-2'] }), item('c')]
    const result = applyFilter(items, { kind: 'all' }, new Set(['private-1', 'private-2']))
    expect(result.map((i) => i.bookmarkId)).toEqual(['c'])
  })

  it('shows an item tagged with a private id when that exact tag is the active filter', () => {
    const items = [item('a', { tags: ['private-2'] }), item('b')]
    const result = applyFilter(items, { kind: 'tags', tagIds: ['private-2'], mode: 'or' }, new Set(['private-1', 'private-2']))
    expect(result.map((i) => i.bookmarkId)).toEqual(['a'])
  })

  it('does not leak an item tagged with a DIFFERENT private id into a filter for one specific private tag', () => {
    const items = [item('a', { tags: ['private-1'] }), item('b', { tags: ['private-2'] })]
    const result = applyFilter(items, { kind: 'tags', tagIds: ['private-1'], mode: 'or' }, new Set(['private-1', 'private-2']))
    expect(result.map((i) => i.bookmarkId)).toEqual(['a'])
  })

  it('passes every item through when privateTagIds is empty (no vault set up)', () => {
    const items = [item('a'), item('b', { tags: ['x'] })]
    const result = applyFilter(items, { kind: 'all' }, new Set())
    expect(result).toHaveLength(2)
  })

  it('defaults privateTagIds to an empty set when the third argument is omitted', () => {
    const items = [item('a')]
    expect(applyFilter(items, { kind: 'all' })).toHaveLength(1)
  })

  it('hides a second private tag from an inbox/dead/archive filter the same as the first', () => {
    const items = [
      item('a', { tags: ['private-2'] }),
      item('b', { isDeleted: true, tags: ['private-2'] }),
      item('c', { linkStatus: 'gone', tags: ['private-2'] }),
    ]
    expect(applyFilter(items, { kind: 'inbox' }, new Set(['private-1', 'private-2']))).toHaveLength(0)
    expect(applyFilter(items, { kind: 'archive' }, new Set(['private-1', 'private-2']))).toHaveLength(0)
    expect(applyFilter(items, { kind: 'dead' }, new Set(['private-1', 'private-2']))).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/board/filter.test.ts`
Expected: FAIL — `applyFilter`'s current signature takes `privateTagId: string | null`, not a `Set`, so passing a `Set` either type-errors or (since `privateGatePasses` does `it.tags.includes(privateTagId)` on a `Set` object) never matches, making every "hides" assertion fail.

- [ ] **Step 3: Implement**

Replace `lib/board/filter.ts` in full:
```ts
import type { BoardItem } from '@/lib/storage/use-board-data'
import type { BoardFilter } from './types'

function privateGatePasses(it: BoardItem, privateTagIds: ReadonlySet<string>, filter: BoardFilter): boolean {
  if (privateTagIds.size === 0) return true
  const itemPrivateTagIds = it.tags.filter((t) => privateTagIds.has(t))
  if (itemPrivateTagIds.length === 0) return true
  return filter.kind === 'tags' && itemPrivateTagIds.some((t) => filter.tagIds.includes(t))
}

export function applyFilter(
  items: ReadonlyArray<BoardItem>,
  filter: BoardFilter,
  privateTagIds: ReadonlySet<string> = new Set(),
): BoardItem[] {
  const gate = (it: BoardItem): boolean => privateGatePasses(it, privateTagIds, filter)
  switch (filter.kind) {
    case 'all':
      return items.filter((it) => !it.isDeleted && gate(it))
    case 'inbox':
      return items.filter((it) => !it.isDeleted && it.tags.length === 0 && gate(it))
    case 'archive':
      return items.filter((it) => it.isDeleted && gate(it))
    case 'dead':
      return items.filter((it) => !it.isDeleted && it.linkStatus === 'gone' && gate(it))
    case 'tags': {
      if (filter.tagIds.length === 0) return items.filter((it) => !it.isDeleted && gate(it))
      if (filter.mode === 'and') {
        return items.filter((it) =>
          !it.isDeleted && filter.tagIds.every((tid) => it.tags.includes(tid)) && gate(it),
        )
      }
      return items.filter((it) =>
        !it.isDeleted && filter.tagIds.some((tid) => it.tags.includes(tid)) && gate(it),
      )
    }
  }
}
```
(Only the `privateTagId: string | null` parameter and `privateGatePasses`'s body changed — every `switch` branch is untouched.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/board/filter.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/filter.ts lib/board/filter.test.ts
rtk git commit -m "fix(private): hide items tagged with ANY isPrivateVault tag, not just the resolved one"
```

---

### Task 2: Broaden `BoardRoot.tsx`'s Private-hiding call sites

**Files:**
- Modify: `components/board/BoardRoot.tsx:1136-1140` (the two `applyFilter` call sites) and `:3310-3357` (`tagsExcludingPrivate`, `sidebarCounts`, `tagCounts`)

**Interfaces:**
- Consumes: `applyFilter`'s new `ReadonlySet<string>` third parameter (Task 1).
- Produces: no new exports; this task only changes call sites inside `BoardRoot.tsx` to compute and pass a `privateTagIds` set instead of the single `privateTagId`.

- [ ] **Step 1: Locate the exact current code**

Find this block (search for `tagsExcludingPrivate`):
```tsx
  const tagsExcludingPrivate = useMemo(
    () => (privateTagId === null ? tags : tags.filter((t) => t.id !== privateTagId)),
    [tags, privateTagId],
  )

  const sidebarCounts = useMemo(() => {
    // items is already the active (= non-deleted) set; deletedItems
    // is the parallel TRASH-only state. Counting items.isDeleted would
    // always yield 0 since useBoardData filters them out before render.
    // Private items are excluded from every count: while unlocked they're in
    // `items`, but the board hides them outside the Private filter, so
    // counting them would leak their existence via an inflated ALL total.
    const isPrivate = (i: BoardItem): boolean => privateTagId !== null && i.tags.includes(privateTagId)
    const visibleItems = items.filter((i) => !isPrivate(i))
    const visibleDeleted = deletedItems.filter((i) => !isPrivate(i))
    return {
      all: visibleItems.length,
      inbox: visibleItems.filter((i) => i.tags.length === 0).length,
      archive: visibleDeleted.length,
      dead: visibleItems.filter((i) => i.linkStatus === 'gone').length,
    }
  }, [items, deletedItems, privateTagId])

  // Per-tag bookmark count for the FilterPill dropdown rows. Counts the
  // active (= non-deleted) set only, so the number matches what the user
  // sees on the board when they pick that tag filter. Tags with 0 are kept
  // (shown muted) so empty tags are visible for cleanup.
  const tagCounts = useMemo<Readonly<Record<string, number>>>(() => {
    const m: Record<string, number> = {}
    for (const tag of tags) m[tag.id] = 0
    for (const it of items) {
      const isPrivate = privateTagId !== null && it.tags.includes(privateTagId)
      for (const tagId of it.tags) {
        if (isPrivate && tagId !== privateTagId) continue // don't inflate OTHER tags' counts
        if (tagId in m) m[tagId] += 1
      }
    }
    return m
  }, [items, tags, privateTagId])
```

And, separately (search for `privateFilterActive`), this block:
```tsx
      const privateFilterActive = privateTagId !== null && activeFilter.tagIds.includes(privateTagId)
      return applyFilter(items, BOARD_FILTER_ALL, privateFilterActive ? null : privateTagId)
    }
    return applyFilter(items, activeFilter, privateTagId)
  }, [items, deletedItems, activeFilter, privateTagId])
```

- [ ] **Step 2: Add a `privateTagIds` set, computed once, near the existing `privateTagId`**

Add this `useMemo` immediately before `tagsExcludingPrivate` (it must be defined before every block that now consumes it):
```tsx
  // Every tag flagged isPrivateVault, not just the single one useTags()
  // resolves as "the" active Private tag (see lib/private/vault-conflict.ts —
  // two such tags can coexist locally after two devices each independently
  // create Private before ever syncing, until the conflict is resolved).
  // Every "hide Private from the ordinary UI" check below must key off this
  // set, not the single resolved id, or the second tag's items leak.
  const privateTagIds = useMemo(
    () => new Set(tags.filter((t) => t.isPrivateVault === true).map((t) => t.id)),
    [tags],
  )
```

- [ ] **Step 3: Update `tagsExcludingPrivate`, `sidebarCounts`, `tagCounts`**

```tsx
  const tagsExcludingPrivate = useMemo(
    () => tags.filter((t) => !privateTagIds.has(t.id)),
    [tags, privateTagIds],
  )

  const sidebarCounts = useMemo(() => {
    const isPrivate = (i: BoardItem): boolean => i.tags.some((id) => privateTagIds.has(id))
    const visibleItems = items.filter((i) => !isPrivate(i))
    const visibleDeleted = deletedItems.filter((i) => !isPrivate(i))
    return {
      all: visibleItems.length,
      inbox: visibleItems.filter((i) => i.tags.length === 0).length,
      archive: visibleDeleted.length,
      dead: visibleItems.filter((i) => i.linkStatus === 'gone').length,
    }
  }, [items, deletedItems, privateTagIds])

  const tagCounts = useMemo<Readonly<Record<string, number>>>(() => {
    const m: Record<string, number> = {}
    for (const tag of tags) m[tag.id] = 0
    for (const it of items) {
      const isPrivate = it.tags.some((id) => privateTagIds.has(id))
      for (const tagId of it.tags) {
        if (isPrivate && !privateTagIds.has(tagId)) continue // don't inflate OTHER tags' counts
        if (tagId in m) m[tagId] += 1
      }
    }
    return m
  }, [items, tags, privateTagIds])
```

- [ ] **Step 4: Update the two `applyFilter` call sites**

```tsx
      const privateFilterActive = privateTagId !== null && activeFilter.tagIds.includes(privateTagId)
      return applyFilter(items, BOARD_FILTER_ALL, privateFilterActive ? new Set() : privateTagIds)
    }
    return applyFilter(items, activeFilter, privateTagIds)
  }, [items, deletedItems, activeFilter, privateTagId, privateTagIds])
```
(`privateTagId` stays in the dependency array and in the `privateFilterActive` line — that specific check is about "is the *currently resolved* Private tag the active filter," which is correctly still single-id; only the value *passed into* `applyFilter` changes to the broader set.)

- [ ] **Step 5: Run the existing BoardRoot + Private test suites to confirm no regression**

Run: `npx vitest run components/board/BoardRoot.test.tsx tests/e2e/private-vault.spec.ts`
Expected: PASS (this is a behavior-preserving generalization for the single-vault case that is 100% of today's traffic — `privateTagIds` has exactly 0 or 1 members whenever only one vault exists, which is byte-equivalent to the old single-id checks).

Also run the full suite once, since this touches shared board-rendering logic used everywhere:
Run: `npx vitest run`
Expected: PASS, same count as the branch's starting baseline (no regressions).

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "fix(private): compute privateTagIds as a set so a second isPrivateVault tag can't leak"
```

---

### Task 3: EMPTY TRASH sync caveat

**Files:**
- Modify: `components/board/TrashConfirmDialog.tsx` (add one line — this is the dialog's *first* i18n string; everything else in the file is pre-existing hardcoded English, left untouched per Global Constraints' "don't restructure beyond your task")
- Modify: `messages/en.json`, `messages/ja.json`, and the other 13 locale files (add `trash.syncNote`)
- Modify: `components/board/TrashConfirmDialog.test.tsx`

**Interfaces:**
- Consumes: `trash.syncNote` i18n key (added in this same task).
- No new exports.

- [ ] **Step 1: Write the failing test**

Add to `components/board/TrashConfirmDialog.test.tsx` (a new `it` alongside the existing ones — read the file first to match its existing render/props pattern for `count`/`onConfirm`/`onCancel`):
```tsx
  it('shows the sync caveat note', () => {
    render(<TrashConfirmDialog count={1} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByTestId('trash-confirm-sync-note')).toHaveTextContent(/sync|safety/i)
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/board/TrashConfirmDialog.test.tsx`
Expected: FAIL — no element with `data-testid="trash-confirm-sync-note"` exists yet.

- [ ] **Step 3: Implement**

In `components/board/TrashConfirmDialog.tsx`, add the import:
```tsx
import { useI18n } from '@/lib/i18n/I18nProvider'
```
Inside the component function, add: `const { t } = useI18n()`.

In the JSX, add the note right after the existing warning line (`<div className={styles.warn}>This cannot be undone.</div>`):
```tsx
        <div className={styles.warn}>This cannot be undone.</div>
        <div className={styles.syncNote} data-testid="trash-confirm-sync-note">{t('trash.syncNote')}</div>
```

In `components/board/TrashConfirmDialog.module.css`, add:
```css
.syncNote {
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.5);
}
```
(Matches the module's existing `.warn`/`.body` sizing scale — read the file's existing rules for `.warn`/`.body` first and keep this consistent with their font-family/color-alpha conventions if they differ from this default.)

Add to `messages/en.json` and `messages/ja.json`'s top level (a new `trash` section — none exists yet, since this dialog had zero i18n before this task):
```json
  "trash": {
    "syncNote": "If you sync with another device, items may come back to the trash — that's a safety feature, not a bug. Empty the trash on both devices to remove them for good."
  },
```
JA version for `messages/ja.json`:
```json
  "trash": {
    "syncNote": "同期中の端末がある場合、ゴミ箱に戻ってくることがあります(データを守る仕組みで、故障ではありません)。消すには両方の端末で空にしてください。"
  },
```
Add the same `trash.syncNote` key with the English copy to the other 13 locale files (`ar.json`, `de.json`, `es.json`, `fr.json`, `it.json`, `ko.json`, `nl.json`, `pt.json`, `ru.json`, `th.json`, `tr.json`, `vi.json`, `zh.json`) — same mechanical script approach as bundle 6②'s Task 4 (write a small Node script under a scratch path, run it, verify with `git diff --stat -- messages/`, delete the script, commit only the JSON files).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/board/TrashConfirmDialog.test.tsx lib/i18n/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/TrashConfirmDialog.tsx components/board/TrashConfirmDialog.module.css components/board/TrashConfirmDialog.test.tsx messages/
rtk git commit -m "feat(trash): add sync safety note to the EMPTY TRASH confirm dialog"
```

---

### Task 4: `lib/sync/merge.ts` — export the deterministic tie-break

**Files:**
- Modify: `lib/sync/merge.ts:60-62` (the private `pickDeterministic` helper)
- Modify: `lib/sync/merge.test.ts`

**Interfaces:**
- Produces: `export function pickDeterministic<T>(a: T, b: T): T` (was private; now exported, behavior byte-identical). Consumed by Task 5 (`lib/private/vault-conflict.ts`'s `isLocalVaultTarget`).

This is a one-word change (`function` → `export function`) — no behavior changes anywhere, since `mergeVault`'s existing call site and behavior are untouched. Exporting it lets the vault-conflict resolution flow (Task 5) use the *exact same* "which of two records wins" rule the sync engine already uses internally for this exact scenario (`mergeVault`'s own doc comment already names this as its fallback for "本当に別々の金庫"), rather than inventing a second, potentially-inconsistent rule.

- [ ] **Step 1: Write the failing test**

Add to `lib/sync/merge.test.ts` (find the existing `describe` blocks and add a new one, or add to an existing one that already imports from `./merge`):
```ts
import { pickDeterministic } from './merge'

describe('pickDeterministic', () => {
  it('is exported and picks the same value regardless of argument order', () => {
    const a = { x: 1 }
    const b = { x: 2 }
    const pickAB = pickDeterministic(a, b)
    const pickBA = pickDeterministic(b, a)
    expect(pickAB).toBe(pickBA)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/sync/merge.test.ts`
Expected: FAIL — `pickDeterministic` is not exported from `./merge` (import error / undefined).

- [ ] **Step 3: Implement**

In `lib/sync/merge.ts`, change:
```ts
function pickDeterministic<T>(a: T, b: T): T {
```
to:
```ts
export function pickDeterministic<T>(a: T, b: T): T {
```
No other change — every internal call site (`mergeBookmarks`, `mergeVault`, etc.) still calls the same function, now merely also exported.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/sync/merge.test.ts`
Expected: PASS (all existing tests + 1 new).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/sync/merge.ts lib/sync/merge.test.ts
rtk git commit -m "refactor(sync): export pickDeterministic for reuse by the vault-conflict resolution flow"
```

---

### Task 5: `lib/private/vault-conflict.ts` — conflict persistence, target/source determination, and the merge orchestration

**Files:**
- Create: `lib/private/vault-conflict.ts`
- Create: `lib/private/vault-conflict.test.ts`
- Modify: `lib/private/vault-store.ts` (add one small function, `retireVault`)

**Interfaces:**
- Consumes: `pickDeterministic` from `lib/sync/merge.ts` (Task 4); `PrivateVaultRecord`, `loadVaultRecord` from `lib/private/vault-store.ts`; `decryptWithPrivateKey`, `encryptWithPublicKey`, `importPublicKey` from `lib/private/crypto.ts`; `deleteTagCascade` from `lib/storage/tags.ts`; `getBookmark`, `touchBookmark` from `lib/storage/indexeddb.ts`; `PrivateVaultSession` from `lib/private/vault-session.ts`.
- Produces:
  - `export type PrivateVaultConflictRecord = { readonly key: 'private-vault-conflict'; readonly otherRecord: PrivateVaultRecord }`
  - `export async function saveVaultConflict(db: DbLike, otherRecord: PrivateVaultRecord): Promise<void>`
  - `export async function loadVaultConflict(db: DbLike): Promise<PrivateVaultConflictRecord | null>`
  - `export async function clearVaultConflict(db: DbLike): Promise<void>`
  - `export function isLocalVaultTarget(local: PrivateVaultRecord, other: PrivateVaultRecord): boolean`
  - `export async function isVaultConflictResolved(db: DbLike, otherTagId: string): Promise<boolean>`
  - `export async function mergeIntoOtherVault(db: DbLike, session: NonNullable<PrivateVaultSession>, otherRecord: PrivateVaultRecord): Promise<void>`
  - `retireVault(db: DbLike): Promise<void>` added to `vault-store.ts`.
- Consumed by Task 6 (`engine.ts`'s auto-publish-if-target logic) and Task 8 (`BoardRoot.tsx` wiring).

- [ ] **Step 1: Write the failing tests**

`lib/private/vault-conflict.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { IDBPDatabase } from 'idb'
import { initDB } from '@/lib/storage/indexeddb'
import { createVault, loadVaultRecord, retireVault, type PrivateVaultRecord } from '@/lib/private/vault-store'
import { addPrivateTag } from '@/lib/private/apply-tag-change'
import {
  saveVaultConflict, loadVaultConflict, clearVaultConflict,
  isLocalVaultTarget, isVaultConflictResolved, mergeIntoOtherVault,
} from './vault-conflict'

let db: IDBPDatabase<unknown> | null = null

beforeEach(async () => {
  const databases = await indexedDB.databases()
  for (const info of databases) { if (info.name) indexedDB.deleteDatabase(info.name) }
})
afterEach(() => { if (db) { db.close(); db = null } })

describe('vault-conflict persistence', () => {
  it('returns null when nothing saved', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await loadVaultConflict(d)).toBeNull()
  })

  it('round-trips a saved conflict, and clearVaultConflict removes it', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const other: PrivateVaultRecord = {
      key: 'private-vault', tagId: 'other-tag', salt: 's', iterations: 600000,
      publicKey: 'other-pk', wrappedPrivateKey: { iv: 'iv', ciphertext: 'ct' },
    }
    await saveVaultConflict(d, other)
    const loaded = await loadVaultConflict(d)
    expect(loaded?.otherRecord).toEqual(other)
    await clearVaultConflict(d)
    expect(await loadVaultConflict(d)).toBeNull()
  })
})

describe('isLocalVaultTarget', () => {
  it('is deterministic regardless of which side calls it', () => {
    const a: PrivateVaultRecord = {
      key: 'private-vault', tagId: 'tag-a', salt: 'salt-a', iterations: 600000,
      publicKey: 'pk-a', wrappedPrivateKey: { iv: 'iv-a', ciphertext: 'ct-a' },
    }
    const b: PrivateVaultRecord = {
      key: 'private-vault', tagId: 'tag-b', salt: 'salt-b', iterations: 600000,
      publicKey: 'pk-b', wrappedPrivateKey: { iv: 'iv-b', ciphertext: 'ct-b' },
    }
    // Exactly one of the two is the target from either side's point of view.
    expect(isLocalVaultTarget(a, b)).toBe(!isLocalVaultTarget(b, a))
  })
})

describe('isVaultConflictResolved', () => {
  it('is false when the other tag still exists (not tombstoned)', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await d.put('tags', { id: 'other-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 1, theme: null, isPrivateVault: true } as never)
    expect(await isVaultConflictResolved(d, 'other-tag')).toBe(false)
  })

  it('is true once the other tag is tombstoned', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await d.put('tags', {
      id: 'other-tag', name: 'Private', color: '#000', order: 0, createdAt: 1, updatedAt: 2, theme: null,
      isPrivateVault: true, isDeleted: true, deletedAt: '2026-01-01T00:00:00.000Z',
    } as never)
    expect(await isVaultConflictResolved(d, 'other-tag')).toBe(true)
  })

  it('is false when the other tag has never existed locally yet', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    expect(await isVaultConflictResolved(d, 'never-seen-tag')).toBe(false)
  })
})

describe('mergeIntoOtherVault', () => {
  it('re-encrypts every bookmark tagged with the local Private tag under the other vault\'s public key, retags it, and retires the local vault + tag', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    const otherVault = await (async () => {
      // Build a second, independent vault purely to get a real key pair/record
      // shape to merge into — done via a throwaway DB so its tagId/publicKey
      // are realistic, without needing a second real device in this test.
      const scratch = await initDB()
      const session = await createVault(scratch, 'other-tag', 'other-password', undefined)
      const record = await loadVaultRecord(scratch)
      scratch.close()
      return { record: record!, session }
    })()

    const localSession = await createVault(d, 'local-tag', 'local-password', undefined)
    await d.put('bookmarks', {
      id: 'bm-1', url: 'https://x.com', title: 'X', description: '', thumbnail: '', favicon: '',
      siteName: '', type: 'website', savedAt: '2026-01-01T00:00:00.000Z', ogpStatus: 'fetched', tags: [],
    } as never)
    await addPrivateTag(d, 'bm-1', 'local-tag')

    await mergeIntoOtherVault(d, localSession, otherVault.record)

    const bookmark = (await d.get('bookmarks', 'bm-1')) as { tags: string[]; encryptedPayload?: unknown } | undefined
    expect(bookmark?.tags).toEqual(['other-tag'])
    expect(bookmark?.tags).not.toContain('local-tag')
    expect(bookmark?.encryptedPayload).toBeDefined()

    // The re-encrypted payload must actually be readable with the OTHER
    // vault's key — not just present. This is the test that would fail if
    // the wrong public key were used to re-encrypt.
    const { decryptWithPrivateKey } = await import('@/lib/private/crypto')
    const decrypted = await decryptWithPrivateKey<{ title: string }>(
      otherVault.session.privateKey, bookmark!.encryptedPayload as never,
    )
    expect(decrypted.title).toBe('X')

    expect(await loadVaultRecord(d)).toBeNull()
    const localTag = await d.get('tags', 'local-tag')
    expect((localTag as { isDeleted?: boolean } | undefined)?.isDeleted).toBe(true)
  })
})

describe('retireVault', () => {
  it('deletes the local vault record', async () => {
    const d = await initDB(); db = d as unknown as IDBPDatabase<unknown>
    await createVault(d, 'tag-1', 'password', undefined)
    expect(await loadVaultRecord(d)).not.toBeNull()
    await retireVault(d)
    expect(await loadVaultRecord(d)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/private/vault-conflict.test.ts`
Expected: FAIL — the module `./vault-conflict` does not exist, and `retireVault` is not exported from `vault-store.ts`.

- [ ] **Step 3: Implement**

Add to `lib/private/vault-store.ts` (near `createVault`/`unlockVault`, same file):
```ts
/** Deletes the local vault record entirely. Called only after every one of
 *  its bookmarks has already been re-encrypted under a different vault's
 *  public key and retagged away from this vault's tag (see
 *  lib/private/vault-conflict.ts's mergeIntoOtherVault) — by the time this
 *  runs, nothing local still depends on this record. */
export async function retireVault(db: DbLike): Promise<void> {
  await db.delete('settings', VAULT_KEY)
}
```

Create `lib/private/vault-conflict.ts`:
```ts
// lib/private/vault-conflict.ts
// Resolves the rare case where two devices each independently created their
// own Private vault before ever connecting device sync — two genuinely
// different ECDH key pairs, which cannot be merged by the normal sync merge
// (lib/sync/merge.ts's mergeVault already documents this: it treats
// differing-publicKey vaults as a real conflict, and lib/sync/engine.ts's
// runSyncCycle skips syncing vault.json entirely while that conflict stands).
//
// Design (agreed with the user 2026-09-16): a *deterministic* tie-break
// (reusing lib/sync/merge.ts's own pickDeterministic — the exact rule
// mergeVault already falls back to for this scenario) decides which of the
// two vaults is "the target" WITHOUT asking the user to choose. The losing
// device ("the source") re-encrypts its own already-decryptable Private
// bookmarks under the target's PUBLIC key (needs only its own existing
// password — see mergeIntoOtherVault) and retires its own vault + tag. The
// target device never needs to do anything password-gated at all: engine.ts
// (Task 6) auto-publishes its vault record to Drive using only public data.
// Nobody ever types a password meant for a different device.
import type { IDBPDatabase } from 'idb'
import { pickDeterministic } from '@/lib/sync/merge'
import { decryptWithPrivateKey, encryptWithPublicKey, importPublicKey } from './crypto'
import { retireVault, type PrivateVaultRecord } from './vault-store'
import { deleteTagCascade } from '@/lib/storage/tags'
import { getBookmark, touchBookmark } from '@/lib/storage/indexeddb'
import type { PrivateVaultSession } from './vault-session'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

const CONFLICT_KEY = 'private-vault-conflict'

export type PrivateVaultConflictRecord = {
  readonly key: typeof CONFLICT_KEY
  readonly otherRecord: PrivateVaultRecord
}

export async function saveVaultConflict(db: DbLike, otherRecord: PrivateVaultRecord): Promise<void> {
  const record: PrivateVaultConflictRecord = { key: CONFLICT_KEY, otherRecord }
  await db.put('settings', record)
}

export async function loadVaultConflict(db: DbLike): Promise<PrivateVaultConflictRecord | null> {
  const record = (await db.get('settings', CONFLICT_KEY)) as PrivateVaultConflictRecord | undefined
  return record ?? null
}

export async function clearVaultConflict(db: DbLike): Promise<void> {
  await db.delete('settings', CONFLICT_KEY)
}

/** True when `local` is the deterministic winner between the two differing
 *  vaults — reuses lib/sync/merge.ts's own tie-break (mergeVault's existing
 *  fallback for this exact "genuinely different vaults" case), so this
 *  module's notion of "target" is always consistent with what the sync
 *  engine itself would pick if it ever did merge them. Both sides calling
 *  this with their own "local" and the other's record arrive at consistent,
 *  opposite answers — no coordination between devices is needed. */
export function isLocalVaultTarget(local: PrivateVaultRecord, other: PrivateVaultRecord): boolean {
  return pickDeterministic(local, other) === local
}

/** True once the LOSING side's tag (identified by its id, from the
 *  conflict record's otherRecord.tagId as seen by the winning side, or
 *  vice versa) has synced in as a tombstone — the signal that
 *  mergeIntoOtherVault has already run successfully on the other device and
 *  its results have been pulled in here. Uses a raw store read (not
 *  getAllTags, which filters tombstones out) since the tombstoned state
 *  itself IS the answer. */
export async function isVaultConflictResolved(db: DbLike, otherTagId: string): Promise<boolean> {
  const tag = (await db.get('tags', otherTagId)) as { isDeleted?: boolean } | undefined
  return tag?.isDeleted === true
}

/** Runs on the LOSING ("source") side only, once its user has explicitly
 *  chosen to combine (screen: private.vaultConflictMergeConfirm). `session`
 *  is this device's OWN just-unlocked session (never the other vault's —
 *  that vault's password is never needed here, only its already-known
 *  PUBLIC key, via `otherRecord.publicKey`). For every bookmark currently
 *  tagged with this vault's tag: decrypt with this vault's own private key
 *  (already unlocked), re-encrypt under the other vault's public key, swap
 *  the tag reference. Then tombstone this vault's own tag (deleteTagCascade
 *  — safe now, since no bookmark still references it) and delete this
 *  vault's own record (retireVault). Order matters: every bookmark is
 *  re-encrypted and retagged BEFORE the tag/vault are retired, so a failure
 *  partway through never leaves data unreadable — it just leaves some
 *  bookmarks still on the old tag/vault, safely retryable. */
export async function mergeIntoOtherVault(
  db: DbLike,
  session: NonNullable<PrivateVaultSession>,
  otherRecord: PrivateVaultRecord,
): Promise<void> {
  const otherPublicKey = await importPublicKey(otherRecord.publicKey)
  const all = (await db.getAll('bookmarks')) as { id: string; tags: string[] }[]
  const ownIds = all.filter((b) => b.tags.includes(session.tagId)).map((b) => b.id)

  for (const id of ownIds) {
    const bookmark = await getBookmark(db, id)
    if (!bookmark || !bookmark.encryptedPayload) continue
    const decrypted = await decryptWithPrivateKey<Record<string, unknown>>(session.privateKey, bookmark.encryptedPayload)
    const encryptedPayload = await encryptWithPublicKey(otherPublicKey, decrypted)
    const tags = bookmark.tags.map((t) => (t === session.tagId ? otherRecord.tagId : t))
    await db.put('bookmarks', touchBookmark({ ...bookmark, encryptedPayload, tags }))
  }

  await deleteTagCascade(db, session.tagId)
  await retireVault(db)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/private/vault-conflict.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/private/vault-conflict.ts lib/private/vault-conflict.test.ts lib/private/vault-store.ts
rtk git commit -m "feat(private): add vault-conflict persistence, deterministic target/source, and merge orchestration"
```

---

### Task 6: `lib/sync/engine.ts` — persist the conflict record and auto-publish the target's vault

**Files:**
- Modify: `lib/sync/engine.ts:279-296` (the `vaultConflict` computation inside `runSyncCycle`)
- Modify: `lib/sync/engine.test.ts`

**Interfaces:**
- Consumes: `saveVaultConflict`, `isLocalVaultTarget` from `lib/private/vault-conflict.ts` (Task 5); `createTextFile`, `updateTextFile`, `listFolderFiles` from `lib/sync/drive-adapter.ts` (existing, unchanged).
- Produces: no new exported functions — `runSyncCycle`'s existing behavior is extended (not changed in shape) so that, on detecting a vault conflict, it (a) persists the other side's full vault record via `saveVaultConflict`, and (b) if the LOCAL vault is the deterministic target, force-publishes it to Drive's `vault.json` — bypassing the normal push skip, since publishing never needs a password (only the vault's public data) and must not wait for the user to do anything.

- [ ] **Step 1: Write the failing tests**

Add to `lib/sync/engine.test.ts`, inside `describe('runSyncCycle', ...)`:
```ts
  it('persists the conflicting vault record for later use by the merge-resolution UI', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    await createVault(d, 'local-tag', 'local-password', undefined)

    const remoteVault = {
      key: 'private-vault', tagId: 'remote-tag', salt: 'remote-salt', iterations: 600000,
      publicKey: 'remote-pk', wrappedPrivateKey: { iv: 'iv', ciphertext: 'ct' },
    }
    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f-vault', name: 'vault.json' }])
    vi.mocked(downloadFileText).mockImplementation(async (_t, id) =>
      id === 'f-vault' ? JSON.stringify(remoteVault) : '[]')
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))
    vi.mocked(updateTextFile).mockImplementation(async (_t, id) => ({ id, name: 'vault.json', headRevisionId: 'rev-2' }))

    const result = await runSyncCycle(d)
    expect(result.vaultConflict).toBe(true)
    const conflict = await loadVaultConflict(d)
    expect(conflict?.otherRecord).toEqual(remoteVault)
  })

  it('force-publishes the local vault to Drive when the local vault is the deterministic target, even though a conflict is active', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    await createVault(d, 'local-tag', 'local-password', undefined)
    const localVault = await loadVaultRecord(d)

    // A remote record that loses the deterministic tie-break against localVault
    // (stableStringify comparison — pick whichever fixed values make this true;
    // the assertion below only depends on winning, not on the specific bytes).
    const remoteVault = {
      key: 'private-vault', tagId: '000-remote', salt: 'aaa', iterations: 600000,
      publicKey: 'aaa-pk', wrappedPrivateKey: { iv: 'aaa', ciphertext: 'aaa' },
    }
    expect(pickDeterministic(localVault, remoteVault)).toEqual(localVault) // sanity: local really does win here

    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f-vault', name: 'vault.json' }])
    vi.mocked(downloadFileText).mockImplementation(async (_t, id) =>
      id === 'f-vault' ? JSON.stringify(remoteVault) : '[]')
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))
    vi.mocked(updateTextFile).mockImplementation(async (_t, id) => ({ id, name: 'vault.json', headRevisionId: 'rev-2' }))

    await runSyncCycle(d)
    expect(updateTextFile).toHaveBeenCalledWith('at', 'f-vault', JSON.stringify(localVault))
  })

  it('does NOT force-publish when the local vault loses the deterministic tie-break', async () => {
    const d = await initDB(); db = d
    await saveSyncTokens(d, { accessToken: 'at', expiresAt: Date.now() + 100000, scope: 's', refreshToken: 'rt' })
    await updateSyncStatus(d, { connected: true, folderId: 'folder1' })
    await createVault(d, 'local-tag', 'local-password', undefined)
    const localVault = await loadVaultRecord(d)

    const remoteVault = {
      key: 'private-vault', tagId: 'zzz-remote', salt: 'zzz', iterations: 600000,
      publicKey: 'zzz-pk', wrappedPrivateKey: { iv: 'zzz', ciphertext: 'zzz' },
    }
    expect(pickDeterministic(localVault, remoteVault)).toEqual(remoteVault) // sanity: remote wins here

    vi.mocked(listFolderFiles).mockResolvedValue([{ id: 'f-vault', name: 'vault.json' }])
    vi.mocked(downloadFileText).mockImplementation(async (_t, id) =>
      id === 'f-vault' ? JSON.stringify(remoteVault) : '[]')
    vi.mocked(getHeadRevisionId).mockResolvedValue('rev-1')
    vi.mocked(createTextFile).mockImplementation(async (_t, _f, name) => ({ id: `id-${name}`, name, headRevisionId: `rev-${name}` }))

    await runSyncCycle(d)
    expect(updateTextFile).not.toHaveBeenCalled()
  })
```
Add the necessary imports at the top of `engine.test.ts` (alongside the existing ones): `createVault, loadVaultRecord` from `@/lib/private/vault-store`, `loadVaultConflict` from `@/lib/private/vault-conflict`, and `pickDeterministic` from `./merge`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/sync/engine.test.ts`
Expected: FAIL — `runSyncCycle` doesn't yet call `saveVaultConflict` or force-publish anything.

- [ ] **Step 3: Implement**

In `lib/sync/engine.ts`, add the import:
```ts
import { saveVaultConflict, isLocalVaultTarget } from '@/lib/private/vault-conflict'
```

Find the existing block inside `runSyncCycle`:
```ts
  const local = await buildLocalSnapshot(db)
  let vaultConflict = !!(local.vault && pulled.snapshot.vault && vaultRecordsDiffer(local.vault, pulled.snapshot.vault))
  const merged = mergeAll(local, pulled.snapshot)
  // On conflict, push neither side's vault (null): applySnapshotToLocal/pushSnapshot both skip a
  // null vault entirely, so the local vault stays untouched AND the other device's vault.json on
  // Drive is never overwritten. Whoever's vault "wins" arbitrarily (pickDeterministic) is deferred
  // to a future UI that lets the user choose — not built in this bundle.
  const finalSnapshot: SyncSnapshot = vaultConflict ? { ...merged, vault: null } : merged
```
Replace it with:
```ts
  const local = await buildLocalSnapshot(db)
  let vaultConflict = !!(local.vault && pulled.snapshot.vault && vaultRecordsDiffer(local.vault, pulled.snapshot.vault))
  if (vaultConflict && local.vault && pulled.snapshot.vault) {
    // Persist the other side's full record (not just its public data) so the
    // resolution UI (SETTINGS -> PRIVATE) can act on it later, and so the
    // deterministic tie-break below and mergeIntoOtherVault (lib/private/
    // vault-conflict.ts, called from the UI layer, not here) have what they need.
    await saveVaultConflict(db, pulled.snapshot.vault)
    // If the LOCAL vault is the deterministic winner, publish it to Drive right
    // now, unconditionally — bypassing the "skip vault.json during a conflict"
    // rule below. This never needs a password (publishing only ever needs the
    // vault's public data, which is always available unlocked-or-not), and it
    // must not wait for the user to do anything: the losing device's merge
    // action (Task 5's mergeIntoOtherVault, wired in Task 8) needs vault.json
    // to already reflect the winner BEFORE it retires its own vault, or a
    // later sync could resurrect stale content. Uses the same
    // create-or-update pattern as writeManifest below, not the normal
    // pushSnapshot/optimistic-lock path (deliberately: this write must happen
    // even though vaultConflict is about to force finalSnapshot.vault to null).
    if (isLocalVaultTarget(local.vault, pulled.snapshot.vault)) {
      const files = await listFolderFiles(accessToken, folderId)
      const existing = files.find((f) => f.name === 'vault.json')
      if (existing) {
        await updateTextFile(accessToken, existing.id, JSON.stringify(local.vault))
      } else {
        await createTextFile(accessToken, folderId, 'vault.json', JSON.stringify(local.vault))
      }
    }
  }
  const merged = mergeAll(local, pulled.snapshot)
  // On conflict, push neither side's vault via the NORMAL path (null): applySnapshotToLocal/
  // pushSnapshot both skip a null vault entirely, so the local vault stays untouched here. The
  // winning side's vault.json is instead published directly above, unconditionally, the moment
  // the conflict is first detected — see the block above for why.
  const finalSnapshot: SyncSnapshot = vaultConflict ? { ...merged, vault: null } : merged
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/sync/engine.test.ts`
Expected: PASS (all existing + 3 new).

- [ ] **Step 5: Run the full sync test directory to check for regressions**

Run: `npx vitest run lib/sync/`
Expected: PASS, all files.

- [ ] **Step 6: Commit**

```bash
rtk git add lib/sync/engine.ts lib/sync/engine.test.ts
rtk git commit -m "feat(sync): persist vault conflicts and auto-publish the deterministic winner's vault"
```

---

### Task 7: `VaultConflictNoticeDialog` and `VaultConflictMergeDialog`

**Files:**
- Create: `components/board/VaultConflictNoticeDialog.tsx`
- Create: `components/board/VaultConflictNoticeDialog.module.css`
- Create: `components/board/VaultConflictNoticeDialog.test.tsx`
- Create: `components/board/VaultConflictMergeDialog.tsx`
- Create: `components/board/VaultConflictMergeDialog.module.css`
- Create: `components/board/VaultConflictMergeDialog.test.tsx`
- Modify: `messages/en.json`, `messages/ja.json`, and the other 13 locale files (add the 8 `private.vaultConflict*` keys from the approved copy table, excluding `private.vaultConflictResolvedHeading`/`Body`, which Task 9 adds)

**Interfaces:**
- Consumes: `private.vaultConflictNoticeHeading/Body/Button`, `private.vaultConflictMergeHeading/Body/NotNow/Confirm/Failed` i18n keys (added in this task).
- Produces: `export function VaultConflictNoticeDialog({ onDismiss }: { readonly onDismiss: () => void }): ReactElement` and `export function VaultConflictMergeDialog({ onNotNow, onConfirm }: { readonly onNotNow: () => void; readonly onConfirm: () => Promise<boolean> }): ReactElement`. Both consumed by Task 8 (`BoardRoot.tsx` wiring).

Both mirror `PrivateManageDialog.tsx`'s backdrop/panel/Escape structure — the established convention for every dialog in this Private family.

- [ ] **Step 1: Write the failing tests**

`components/board/VaultConflictNoticeDialog.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VaultConflictNoticeDialog } from './VaultConflictNoticeDialog'

describe('VaultConflictNoticeDialog', () => {
  it('renders the heading and body', () => {
    render(<VaultConflictNoticeDialog onDismiss={vi.fn()} />)
    expect(screen.getByRole('dialog').textContent).toMatch(/private/i)
  })

  it('GOT IT fires onDismiss', () => {
    const onDismiss = vi.fn()
    render(<VaultConflictNoticeDialog onDismiss={onDismiss} />)
    fireEvent.click(screen.getByTestId('vault-conflict-notice-dismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('backdrop click fires onDismiss', () => {
    const onDismiss = vi.fn()
    render(<VaultConflictNoticeDialog onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('Escape key fires onDismiss', () => {
    const onDismiss = vi.fn()
    render(<VaultConflictNoticeDialog onDismiss={onDismiss} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
```

`components/board/VaultConflictMergeDialog.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VaultConflictMergeDialog } from './VaultConflictMergeDialog'

describe('VaultConflictMergeDialog', () => {
  it('NOT NOW fires onNotNow', () => {
    const onNotNow = vi.fn()
    render(<VaultConflictMergeDialog onNotNow={onNotNow} onConfirm={vi.fn().mockResolvedValue(true)} />)
    fireEvent.click(screen.getByTestId('vault-conflict-merge-not-now'))
    expect(onNotNow).toHaveBeenCalledTimes(1)
  })

  it('COMBINE calls onConfirm and disables the button while pending', async () => {
    let resolveConfirm: (v: boolean) => void = () => {}
    const onConfirm = vi.fn(() => new Promise<boolean>((r) => { resolveConfirm = r }))
    render(<VaultConflictMergeDialog onNotNow={vi.fn()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByTestId('vault-conflict-merge-confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('vault-conflict-merge-confirm')).toBeDisabled()
    resolveConfirm(true)
    await waitFor(() => expect(screen.getByTestId('vault-conflict-merge-confirm')).not.toBeDisabled())
  })

  it('shows an error message when onConfirm resolves false', async () => {
    const onConfirm = vi.fn().mockResolvedValue(false)
    render(<VaultConflictMergeDialog onNotNow={vi.fn()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByTestId('vault-conflict-merge-confirm'))
    await waitFor(() => expect(screen.getByTestId('vault-conflict-merge-error')).toBeInTheDocument())
  })

  it('Escape key fires onNotNow', () => {
    const onNotNow = vi.fn()
    render(<VaultConflictMergeDialog onNotNow={onNotNow} onConfirm={vi.fn().mockResolvedValue(true)} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onNotNow).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/board/VaultConflictNoticeDialog.test.tsx components/board/VaultConflictMergeDialog.test.tsx`
Expected: FAIL — neither module exists yet.

- [ ] **Step 3: Implement**

`components/board/VaultConflictNoticeDialog.tsx`:
```tsx
'use client'

import { useEffect, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './VaultConflictNoticeDialog.module.css'

type Props = {
  readonly onDismiss: () => void
}

/** Purely informational — the local vault has already been determined (by
 *  lib/private/vault-conflict.ts's isLocalVaultTarget, called from
 *  BoardRoot) to be the deterministic winner of a vault conflict. No action
 *  is needed here; publishing already happened automatically in
 *  lib/sync/engine.ts. This dialog only tells the user what's next. */
export function VaultConflictNoticeDialog({ onDismiss }: Props): ReactElement {
  const { t } = useI18n()
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onDismiss() }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div
      className={styles.backdrop}
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-conflict-notice-heading"
      data-testid="vault-conflict-notice-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="vault-conflict-notice-heading" className={styles.heading}>{t('private.vaultConflictNoticeHeading')}</div>
        <div className={styles.body}>{t('private.vaultConflictNoticeBody')}</div>
        <div className={styles.actions}>
          <button type="button" className={styles.dismissBtn} onClick={onDismiss} data-testid="vault-conflict-notice-dismiss">
            {t('private.vaultConflictNoticeButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

`components/board/VaultConflictNoticeDialog.module.css` (mirrors `PrivateManageDialog.module.css` — read that file and copy its `.backdrop`/`.panel`/`.heading`/`.body`/`.actions` rules verbatim, renaming the single button class to `.dismissBtn` matching `.doneBtn`'s existing style).

`components/board/VaultConflictMergeDialog.tsx`:
```tsx
'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './VaultConflictMergeDialog.module.css'

type Props = {
  readonly onNotNow: () => void
  readonly onConfirm: () => Promise<boolean>
}

/** Shown to the LOSING side of a vault conflict (the one that is NOT the
 *  deterministic target) once it has already unlocked its own Private
 *  normally. onConfirm performs the actual merge (lib/private/
 *  vault-conflict.ts's mergeIntoOtherVault, wired by the caller) using the
 *  session that unlock already produced — no password field here at all,
 *  by design (see this plan's Global Constraints). */
export function VaultConflictMergeDialog({ onNotNow, onConfirm }: Props): ReactElement {
  const { t } = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async (): Promise<void> => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const ok = await onConfirm()
    if (!ok) {
      setSubmitting(false)
      setError(t('private.vaultConflictMergeFailed'))
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onNotNow() }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onNotNow])

  return (
    <div
      className={styles.backdrop}
      onClick={onNotNow}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-conflict-merge-heading"
      data-testid="vault-conflict-merge-dialog"
      data-no-capture
    >
      <div className={styles.panel} onClick={(e): void => e.stopPropagation()}>
        <div id="vault-conflict-merge-heading" className={styles.heading}>{t('private.vaultConflictMergeHeading')}</div>
        <div className={styles.body}>{t('private.vaultConflictMergeBody')}</div>
        {error && <div className={styles.error} data-testid="vault-conflict-merge-error">{error}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onNotNow} data-testid="vault-conflict-merge-not-now">
            {t('private.vaultConflictMergeNotNow')}
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={(): void => { void confirm() }}
            disabled={submitting}
            data-testid="vault-conflict-merge-confirm"
          >
            {t('private.vaultConflictMergeConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

`components/board/VaultConflictMergeDialog.module.css` (mirrors `PrivateChangePasswordDialog.module.css`'s `.backdrop`/`.panel`/`.heading`/`.error`/`.actions`/`.cancelBtn`/button pair — rename the save-style button class to `.confirmBtn`).

Add the 8 keys to `messages/en.json`/`messages/ja.json` (real copy from the approved table above) and the other 13 locale files (English placeholder) — same script-based mechanical approach as before.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/board/VaultConflictNoticeDialog.test.tsx components/board/VaultConflictMergeDialog.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/VaultConflictNoticeDialog.tsx components/board/VaultConflictNoticeDialog.module.css components/board/VaultConflictNoticeDialog.test.tsx components/board/VaultConflictMergeDialog.tsx components/board/VaultConflictMergeDialog.module.css components/board/VaultConflictMergeDialog.test.tsx messages/
rtk git commit -m "feat(private): add the vault-conflict notice and merge-confirm dialogs"
```

---

### Task 8: `PrivateChangePasswordDialog` — add the "resolved, set one new password" variant

**Files:**
- Modify: `components/board/PrivateChangePasswordDialog.tsx`
- Modify: `components/board/PrivateChangePasswordDialog.test.tsx`
- Modify: `messages/en.json`, `messages/ja.json`, and the other 13 locale files (add `private.vaultConflictResolvedHeading`/`private.vaultConflictResolvedBody`)

**Interfaces:**
- Consumes: `private.vaultConflictResolvedHeading`/`Body` (added in this task); existing `private.changePasswordHeading`/`Explanation` (unchanged).
- Produces: `PrivateChangePasswordDialog`'s props gain one new optional field: `readonly variant?: 'change' | 'vault-conflict-resolved'` (default `'change'`, so the existing call site's behavior is byte-identical without changes there). Consumed by Task 9 (`BoardRoot.tsx` wiring).

- [ ] **Step 1: Write the failing test**

Add to `components/board/PrivateChangePasswordDialog.test.tsx` (alongside its existing tests):
```tsx
  it('shows the vault-conflict-resolved heading/explanation when variant is set, and the ordinary ones by default', () => {
    const { rerender } = render(<PrivateChangePasswordDialog onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByTestId('private-change-password-dialog').textContent).not.toMatch(/combined/i)

    rerender(<PrivateChangePasswordDialog onSubmit={vi.fn()} onCancel={vi.fn()} variant="vault-conflict-resolved" />)
    expect(screen.getByTestId('private-change-password-dialog').textContent).toMatch(/combined|new password/i)
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/board/PrivateChangePasswordDialog.test.tsx`
Expected: FAIL — `variant` prop doesn't exist yet, and the heading text never changes.

- [ ] **Step 3: Implement**

In `components/board/PrivateChangePasswordDialog.tsx`, change the `Props` type and the two heading/explanation lines:
```tsx
type Props = {
  readonly hint?: string
  readonly onSubmit: (newPassword: string, newHint: string | undefined) => Promise<boolean>
  readonly onCancel: () => void
  /** 'vault-conflict-resolved': shown once, on the winning device, right
   *  after lib/private/vault-conflict.ts's isVaultConflictResolved first
   *  returns true — the two independently-created vaults have now
   *  converged on this one, and the user picks a single fresh password to
   *  use everywhere from now on (see this plan's copy table). Default
   *  'change' is the pre-existing, unchanged password-change flow. */
  readonly variant?: 'change' | 'vault-conflict-resolved'
}

export function PrivateChangePasswordDialog({ hint, onSubmit, onCancel, variant = 'change' }: Props): ReactElement {
```
Change the heading/explanation JSX:
```tsx
        <div id="private-change-password-heading" className={styles.heading}>
          {t(variant === 'vault-conflict-resolved' ? 'private.vaultConflictResolvedHeading' : 'private.changePasswordHeading')}
        </div>
        <div className={styles.explanation}>
          {t(variant === 'vault-conflict-resolved' ? 'private.vaultConflictResolvedBody' : 'private.changePasswordExplanation')}
        </div>
```
Every other line in the file (both `PasswordField`s, the hint input, the error handling, the CANCEL/SAVE buttons) is unchanged.

Add `private.vaultConflictResolvedHeading`/`private.vaultConflictResolvedBody` (copy from the approved table above) to `messages/en.json`/`messages/ja.json` and the other 13 locale files.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/board/PrivateChangePasswordDialog.test.tsx`
Expected: PASS (all existing + 1 new).

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/PrivateChangePasswordDialog.tsx components/board/PrivateChangePasswordDialog.test.tsx messages/
rtk git commit -m "feat(private): add the vault-conflict-resolved variant to the change-password dialog"
```

---

### Task 9: Wire it all into `BoardRoot.tsx`

**Files:**
- Modify: `components/board/BoardRoot.tsx` (the `privateDialog` state machine and the `PrivateUnlockDialog`'s `onSubmit` handler)

**Interfaces:**
- Consumes: everything from Tasks 5, 7, 8: `loadVaultConflict`, `isLocalVaultTarget`, `isVaultConflictResolved`, `mergeIntoOtherVault`, `clearVaultConflict` (Task 5); `VaultConflictNoticeDialog`, `VaultConflictMergeDialog` (Task 7); `PrivateChangePasswordDialog`'s `variant` prop (Task 8).
- No new exports — this task only extends `BoardRoot.tsx`'s existing local `privateDialog` state union and its unlock handler.

- [ ] **Step 1: Extend the `privateDialog` state type**

Find the state declaration (search for `useState<... 'setup' | 'unlock' | 'manage' | 'change-password'`, likely typed inline or via a local union near the top of the component) and add three new values: `'vault-conflict-notice' | 'vault-conflict-merge' | 'vault-conflict-resolved'`.

- [ ] **Step 2: Add the imports**

Near the existing `import { createVault, unlockVault, loadVaultRecord, changeVaultPassword } from '@/lib/private/vault-store'` line, add:
```tsx
import {
  loadVaultConflict, isLocalVaultTarget, isVaultConflictResolved, mergeIntoOtherVault, clearVaultConflict,
} from '@/lib/private/vault-conflict'
import { VaultConflictNoticeDialog } from './VaultConflictNoticeDialog'
import { VaultConflictMergeDialog } from './VaultConflictMergeDialog'
```

- [ ] **Step 3: Extend the unlock handler**

Find the existing `PrivateUnlockDialog`'s `onSubmit`:
```tsx
          onSubmit={async (password): Promise<boolean> => {
            try {
              const db = await initDB()
              const session = await unlockVault(db, password)
              if (!session) return false
              setPrivateVaultSession(session)
              if (pendingPrivateAction && privateTagId) {
                setPrivateDialog(null)
                void runPrivateAction(pendingPrivateAction, privateTagId, session)
              } else {
                setPrivateDialog('manage')
              }
              return true
            } catch (e) {
              console.error('[AllMarks] failed to unlock Private vault', e)
              return false
            }
          }}
```
Replace the body between `setPrivateVaultSession(session)` and the final `return true` with a conflict check that runs BEFORE the existing `pendingPrivateAction`/`manage` routing (a pending tag-toggle action still takes priority once a conflict is fully resolved, matching today's behavior; an UNRESOLVED conflict takes priority over both, since acting on Private content before the vault situation is settled would encrypt/decrypt under the wrong assumptions):
```tsx
              setPrivateVaultSession(session)
              const db2 = db // same db instance, alias for clarity below
              const conflict = await loadVaultConflict(db2)
              if (conflict) {
                const localRecord = await loadVaultRecord(db2)
                if (localRecord && isLocalVaultTarget(localRecord, conflict.otherRecord)) {
                  const resolved = await isVaultConflictResolved(db2, conflict.otherRecord.tagId)
                  setPrivateDialog(resolved ? 'vault-conflict-resolved' : 'vault-conflict-notice')
                } else {
                  setPrivateDialog('vault-conflict-merge')
                }
                return true
              }
              if (pendingPrivateAction && privateTagId) {
                setPrivateDialog(null)
                void runPrivateAction(pendingPrivateAction, privateTagId, session)
              } else {
                setPrivateDialog('manage')
              }
              return true
```

- [ ] **Step 4: Render the three new dialog states**

Find the existing `{privateDialog === 'manage' && (...)}` block and add these three siblings immediately after it:
```tsx
      {privateDialog === 'vault-conflict-notice' && (
        <VaultConflictNoticeDialog onDismiss={(): void => setPrivateDialog(null)} />
      )}
      {privateDialog === 'vault-conflict-merge' && (
        <VaultConflictMergeDialog
          onNotNow={(): void => setPrivateDialog(null)}
          onConfirm={async (): Promise<boolean> => {
            const conflict = await loadVaultConflict(await initDB())
            if (!conflict || !privateSession) return false
            try {
              const db = await initDB()
              await mergeIntoOtherVault(db, privateSession, conflict.otherRecord)
              await clearVaultConflict(db)
              setPrivateVaultSession(null)
              setPrivateDialog(null)
              setToast({ message: t('private.vaultConflictMergeConfirm'), nonce: Date.now() })
              return true
            } catch (e) {
              console.error('[AllMarks] failed to merge into the other Private vault', e)
              return false
            }
          }}
        />
      )}
      {privateDialog === 'vault-conflict-resolved' && (
        <PrivateChangePasswordDialog
          variant="vault-conflict-resolved"
          onSubmit={async (newPassword, newHint): Promise<boolean> => {
            if (!privateSession) return false
            try {
              const db = await initDB()
              const result = await changeVaultPassword(db, privateSession, newPassword, newHint)
              if (!result.ok) return false
              setPrivateVaultSession(result.session)
              setPrivateHint(newHint)
              const conflict = await loadVaultConflict(db)
              if (conflict) await clearVaultConflict(db)
              setPrivateDialog(null)
              setToast({ message: t('private.vaultConflictResolvedHeading'), nonce: Date.now() })
              return true
            } catch (e) {
              console.error('[AllMarks] failed to set the combined Private password', e)
              return false
            }
          }}
          onCancel={(): void => setPrivateDialog(null)}
        />
      )}
```
(`setPrivateVaultSession(null)` after a successful merge on the source side is deliberate: this device's vault no longer exists locally — `retireVault` already ran inside `mergeIntoOtherVault` — so holding onto a session for a vault record that's gone would be stale. The next time this device unlocks Private, it will be adopting the target's vault via the ordinary sync-pull path, same as any fresh "device B adopts device A's vault" flow.)

- [ ] **Step 5: Run the Private + BoardRoot test suites**

Run: `npx vitest run tests/e2e/private-vault.spec.ts components/board/BoardRoot.test.tsx`
Expected: PASS — this task only adds new branches gated on `privateDialog` values that no existing test ever sets, and a conflict check gated on `loadVaultConflict` returning non-null, which is `null` in every existing test's IndexedDB (no test ever calls `saveVaultConflict`) — so every existing test's control flow is unchanged.

- [ ] **Step 6: Write a new integration test covering the full wiring**

Add to `components/board/BoardRoot.test.tsx` (find its existing Private-related test setup for reference on how it mocks `initDB`/renders `BoardRoot`, and mirror that pattern):
```tsx
  it('routes an unlock to the merge dialog when this device is the losing side of a vault conflict', async () => {
    const db = await initDB()
    await createVault(db, 'local-tag', 'local-password', undefined)
    const remoteVault = {
      key: 'private-vault', tagId: 'remote-tag', salt: 'zzz-salt', iterations: 600000,
      publicKey: 'zzz-pk', wrappedPrivateKey: { iv: 'zzz', ciphertext: 'zzz' },
    }
    await saveVaultConflict(db, remoteVault)
    // (rendering BoardRoot, opening SETTINGS -> PRIVATE, submitting 'local-password'
    // via PrivateUnlockDialog, then asserting screen.getByTestId('vault-conflict-merge-dialog')
    // appears — follow this file's existing pattern for driving the SETTINGS/PRIVATE
    // entry points and the unlock dialog's submit, which already exists for the
    // pre-conflict unlock tests above this one in the same file.)
  })
```
This step's exact test body depends on this file's existing helper patterns for opening SETTINGS and driving `PrivateUnlockDialog` — read the file's existing Private-unlock test(s) immediately before writing this one, and mirror their setup precisely (same render call, same way of reaching the unlock dialog, same way of submitting a password) rather than inventing a new rendering path.

Run: `npx vitest run components/board/BoardRoot.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run the full suite, typecheck, and build**

Run: `npx vitest run`
Expected: PASS, all files, no regressions vs. the pre-task baseline.

Run: `npx tsc --noEmit`
Expected: 0 errors.

Run: `rtk pnpm build`
Expected: exit code 0.

- [ ] **Step 8: Commit**

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(private): wire the vault-conflict notice/merge/resolved dialogs into the unlock flow"
```

---

### Task 10: Update session docs

**Files:**
- Modify: `docs/CURRENT_GOAL.md`
- Modify: `docs/TODO.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Read the current `docs/CURRENT_GOAL.md` and the latest `docs/TODO.md` "現在の状態" entry (s214) to match narrative style/density**

- [ ] **Step 2: Update `docs/CURRENT_GOAL.md`**

Mark 束6③ complete (the leak fix, EMPTY TRASH note, and vault-conflict resolution flow — all three pieces this plan covers). Remove the now-resolved "★未着手のまま残っているUI設計マター(isPrivateVaultタグ重複問題)" section entirely (it's resolved by this bundle). Keep the "★検討事項(リアルタイム同期)" section exactly as-is (still open, unrelated to this bundle). Note that the whole device-sync feature area (束1-6③) is now functionally complete pending: (a) the still-open real-time-sync decision, (b) claim-record seeding and issuing the user's own personal key (both purely operational, no code), (c) PL-1/PL-2 pre-launch tasks. Set the "次にやること" to whichever of those the user wants to pick up next session (do not guess which — leave it as an open choice, listing all three).

- [ ] **Step 3: Update `docs/TODO.md`**

Append a new `s215` entry (or the next session number) to "現在の状態", in the same narrative style as the existing `s213`/`s214` entries: what was built (leak fix + why it mattered, EMPTY TRASH note, vault-conflict resolution's deterministic target/source design and the merge mechanics), test/tsc/build results, and that 束6③ is now fully complete.

- [ ] **Step 4: Commit**

```bash
rtk git add docs/CURRENT_GOAL.md docs/TODO.md
rtk git commit -m "docs: record bundle 6③(vault-conflict resolution) completion"
```

---

## Self-Review Notes (completed while writing this plan)

- **Spec coverage**: the privacy leak (found during this session's own investigation, not a pre-existing spec item) → Tasks 1-2. §6.6's EMPTY TRASH caveat (spec-mandated, copy pre-approved there) → Task 3. The vault-conflict resolution flow (no prior spec section — designed in this session, approved copy table is its authority) → Tasks 4-9. Doc handoff → Task 10.
- **Placeholder scan**: no TBD/"add error handling" phrases. Task 9's Step 6 test body is deliberately left to mirror an existing pattern in the target file rather than inventing one blind — this is a "follow the file's own established pattern" instruction, not a placeholder, since the exact rendering/driving mechanics for `PrivateUnlockDialog` already exist elsewhere in that same test file and copying them precisely is more reliable than a fresh guess at React Testing Library selectors for a component this plan's author hasn't read the full test file for.
- **Type consistency**: `PrivateVaultConflictRecord`/`saveVaultConflict`/`loadVaultConflict`/`clearVaultConflict`/`isLocalVaultTarget`/`isVaultConflictResolved`/`mergeIntoOtherVault` are all defined once in Task 5 and consumed with identical names/signatures in Tasks 6 and 9. `retireVault` defined once in Task 5 (inside `vault-store.ts`), used inside `mergeIntoOtherVault` in the same task. `pickDeterministic` exported once in Task 4, consumed in Task 5 and Task 6. `VaultConflictNoticeDialog`/`VaultConflictMergeDialog`'s prop names (`onDismiss`, `onNotNow`/`onConfirm`) defined in Task 7 match exactly how Task 9 renders them. `PrivateChangePasswordDialog`'s new `variant` prop defined in Task 8 matches exactly how Task 9 passes it.
