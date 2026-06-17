# 保存直後タグ付け 第3段(ブックマークレット)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 拡張なしのブックマークレット保存(`/save` ポップアップ窓 = `SaveToast`)に、保存直後タグ付けの PiP 風小窓を追加する。

**Architecture:** `/save` 窓は AllMarks origin なので IDB・タグ操作・BroadcastChannel が直接使える。保存成功後に `quickTagEnabled`(本体 IDB)と `queryPipPresence` で分岐し、ON かつ PiP なしなら窓を閉じずタグUI(既存 `TagAddPopover` の `compact`)に変身させる。タグ付与は第2段(PiP)と同一ロジックを共有ヘルパーに抽出して使う。

**Tech Stack:** Next.js(App Router, static export)/ React client component / vitest + @testing-library/react / IndexedDB(idb)/ BroadcastChannel。

## Global Constraints

- TypeScript `strict: true`、`any` 禁止(`unknown`+型ガード)、return type 明示。
- Vanilla CSS Modules のみ(Tailwind 禁止)。z-index は定数管理。
- 新規タグ色は `#28F100`(AllMarks 緑、第2段 PiP と同一)。
- 不可視符号は維持: `booklage-save`(窓名)、`booklage:*` メッセージ型、`DB_NAME='booklage-db'`。
- **カーソルピル(`extension/` 配下)・元ページ Shadow DOM トースト・拡張あり経路は一切いじらない。**
- 設計: `docs/superpowers/specs/2026-06-17-quick-tag-on-save-phase3-bookmarklet-design.md`。
- 拡張 content scripts は対象外だが、もし `lib/utils/bookmarklet.ts` を触ったら `node --check` 不可(TSなので tsc で担保)。
- 検証は本番 allmarks.app + 拡張オフで実機。「動いてる」報告は実測後。

---

### Task 1: 共有タグ付与ヘルパー + 表示判定(pure / 単体テスト)

第2段(PiP `PipCompanion.tsx`)の付与ロジックと同一の振る舞いを共有関数に抽出。`/save` 窓がこれを使う(PiP 側の差し替えは本計画では行わない=既存検証済コードを温存)。

**Files:**
- Create: `lib/tagger/quick-tag-apply.ts`
- Test: `lib/tagger/quick-tag-apply.test.ts`

**Interfaces:**
- Consumes: `addTagToBookmark`, `addTag` from `@/lib/storage/tags`; `postBookmarkUpdated` from `@/lib/board/channel`; `TagRecord` from `@/lib/storage/indexeddb`.
- Produces:
  - `shouldShowQuickTagWindow(quickTagEnabled: boolean, pipActive: boolean): boolean`
  - `applyExistingQuickTag(db: unknown, bookmarkId: string, tagId: string): Promise<void>`
  - `applyNewQuickTag(db: unknown, bookmarkId: string, name: string, allTags: readonly TagRecord[]): Promise<TagRecord>`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/tagger/quick-tag-apply.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shouldShowQuickTagWindow, applyExistingQuickTag, applyNewQuickTag } from './quick-tag-apply'
import { addTagToBookmark, addTag } from '@/lib/storage/tags'
import { postBookmarkUpdated } from '@/lib/board/channel'

vi.mock('@/lib/storage/tags', () => ({
  addTagToBookmark: vi.fn(async () => {}),
  addTag: vi.fn(async (_db: unknown, input: { name: string; color: string; order: number }) => ({
    id: `new-${input.name}`, name: input.name, color: input.color, order: input.order,
  })),
}))
vi.mock('@/lib/board/channel', () => ({ postBookmarkUpdated: vi.fn() }))

describe('shouldShowQuickTagWindow', () => {
  it('shows only when enabled and PiP not active', () => {
    expect(shouldShowQuickTagWindow(true, false)).toBe(true)
    expect(shouldShowQuickTagWindow(true, true)).toBe(false)
    expect(shouldShowQuickTagWindow(false, false)).toBe(false)
    expect(shouldShowQuickTagWindow(false, true)).toBe(false)
  })
})

describe('applyExistingQuickTag', () => {
  beforeEach(() => vi.clearAllMocks())
  it('writes the tag and broadcasts an update', async () => {
    await applyExistingQuickTag({}, 'b1', 't1')
    expect(addTagToBookmark).toHaveBeenCalledWith({}, 'b1', 't1')
    expect(postBookmarkUpdated).toHaveBeenCalledWith({ bookmarkId: 'b1' })
  })
})

describe('applyNewQuickTag', () => {
  beforeEach(() => vi.clearAllMocks())
  it('reuses an existing tag by case-insensitive name', async () => {
    const tag = await applyNewQuickTag({}, 'b1', 'Design', [
      { id: 't1', name: 'design', color: '#fff', order: 0 },
    ])
    expect(tag.id).toBe('t1')
    expect(addTag).not.toHaveBeenCalled()
    expect(addTagToBookmark).toHaveBeenCalledWith({}, 'b1', 't1')
    expect(postBookmarkUpdated).toHaveBeenCalledWith({ bookmarkId: 'b1' })
  })
  it('creates a new green tag when none matches', async () => {
    const tag = await applyNewQuickTag({}, 'b1', 'fresh', [
      { id: 't1', name: 'design', color: '#fff', order: 0 },
    ])
    expect(addTag).toHaveBeenCalledWith({}, { name: 'fresh', color: '#28F100', order: 1 })
    expect(tag.id).toBe('new-fresh')
    expect(addTagToBookmark).toHaveBeenCalledWith({}, 'b1', 'new-fresh')
  })
  it('ignores blank input (no writes)', async () => {
    const tag = await applyNewQuickTag({}, 'b1', '   ', [])
    expect(tag).toBeNull()
    expect(addTag).not.toHaveBeenCalled()
    expect(addTagToBookmark).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npx vitest run lib/tagger/quick-tag-apply.test.ts`
Expected: FAIL ("Cannot find module './quick-tag-apply'").

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/tagger/quick-tag-apply.ts
import { addTag, addTagToBookmark } from '@/lib/storage/tags'
import { postBookmarkUpdated } from '@/lib/board/channel'
import type { TagRecord } from '@/lib/storage/indexeddb'

type DbLike = Parameters<typeof addTagToBookmark>[0]

/** Show the quick-tag window only when the feature is ON and no real PiP is
 *  open (the open PiP already receives the saved card; a second surface would
 *  collide — mirrors the phase-2 pipActive gate). */
export function shouldShowQuickTagWindow(quickTagEnabled: boolean, pipActive: boolean): boolean {
  return quickTagEnabled && !pipActive
}

/** Apply an existing tag to the just-saved bookmark and notify open boards. */
export async function applyExistingQuickTag(db: DbLike, bookmarkId: string, tagId: string): Promise<void> {
  await addTagToBookmark(db, bookmarkId, tagId)
  postBookmarkUpdated({ bookmarkId })
}

/** Find-or-create a tag by case-insensitive name, apply it, notify boards.
 *  Returns the tag used, or null for blank input. Mirrors PipCompanion.handleAddNew. */
export async function applyNewQuickTag(
  db: DbLike,
  bookmarkId: string,
  name: string,
  allTags: readonly TagRecord[],
): Promise<TagRecord | null> {
  const trimmed = name.trim()
  if (!trimmed) return null
  const existing = allTags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
  const target = existing ?? (await addTag(db, { name: trimmed, color: '#28F100', order: allTags.length }))
  await addTagToBookmark(db, bookmarkId, target.id)
  postBookmarkUpdated({ bookmarkId })
  return target
}
```

Note: update the test's `applyNewQuickTag` return type expectation — the blank case returns `null` (already asserted).

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npx vitest run lib/tagger/quick-tag-apply.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/tagger/quick-tag-apply.ts lib/tagger/quick-tag-apply.test.ts
rtk git commit -m "feat(quick-tag): shared apply helpers + window gate for phase 3"
```

---

### Task 2: `/save` 窓の分岐(OFF / PiP / タグ表示)— UI はまだ無し

`SaveToast` の保存後ロジックを「常に fast-close」から「分岐」に変える。タグUIの描画は Task 3。本タスクは **状態遷移と window.close の出し分け**のみ。

**Files:**
- Modify: `components/bookmarklet/SaveToast.tsx`
- Test: `components/bookmarklet/SaveToast.test.tsx` (Create)

**Interfaces:**
- Consumes: `shouldShowQuickTagWindow` (Task 1); `loadQuickTagEnabled` from `@/lib/storage/quick-tag-setting`; `queryPipPresence` from `@/lib/board/pip-presence`; `getAllBookmarks` from `@/lib/storage/indexeddb`; `getAllTags` from `@/lib/storage/tags`; `orderTagsForSave` from `@/lib/tagger/order-tags-for-save`.
- Produces: `SaveToast` now renders `data-state="tags"` with `data-testid="save-tag-window"` when in tag mode; otherwise unchanged fast-close behavior.

- [ ] **Step 1: Write the failing test**

```typescript
// components/bookmarklet/SaveToast.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SaveToast } from './SaveToast'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams({ url: 'https://x.com/a/status/1', title: 'Hello' }),
}))
vi.mock('@/lib/storage/indexeddb', () => ({
  initDB: vi.fn(async () => ({})),
  addBookmark: vi.fn(async () => ({ id: 'b1', tags: [] })),
  getAllBookmarks: vi.fn(async () => []),
}))
vi.mock('@/lib/storage/tags', () => ({
  getAllTags: vi.fn(async () => [{ id: 't1', name: 'design', color: '#fff', order: 0 }]),
  addTagToBookmark: vi.fn(async () => {}),
  addTag: vi.fn(async () => ({ id: 't2', name: 'new', color: '#28F100', order: 1 })),
}))
vi.mock('@/lib/tagger/order-tags-for-save', () => ({
  orderTagsForSave: vi.fn(() => [{ id: 't1', name: 'design', color: '#fff' }]),
}))
vi.mock('@/lib/board/channel', () => ({ postBookmarkSaved: vi.fn(), postBookmarkUpdated: vi.fn() }))
vi.mock('@/lib/storage/quick-tag-setting', () => ({ loadQuickTagEnabled: vi.fn(async () => true) }))
vi.mock('@/lib/board/pip-presence', () => ({ queryPipPresence: vi.fn(async () => false) }))
vi.mock('@/lib/utils/url', () => ({ detectUrlType: () => 'tweet' }))

import { loadQuickTagEnabled } from '@/lib/storage/quick-tag-setting'
import { queryPipPresence } from '@/lib/board/pip-presence'

describe('SaveToast quick-tag branching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.stubGlobal('close', vi.fn())
    vi.stubGlobal('resizeTo', vi.fn())
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false, media: q, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }))
    ;(loadQuickTagEnabled as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(true)
    ;(queryPipPresence as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(false)
  })

  it('shows the tag window when enabled and no PiP', async () => {
    render(<SaveToast />)
    await waitFor(() => expect(screen.getByTestId('save-tag-window')).toBeTruthy())
    expect(window.close).not.toHaveBeenCalled()
  })

  it('fast-closes when feature is OFF', async () => {
    ;(loadQuickTagEnabled as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(false)
    render(<SaveToast />)
    await waitFor(() => expect(loadQuickTagEnabled).toHaveBeenCalled())
    await vi.advanceTimersByTimeAsync(120)
    expect(window.close).toHaveBeenCalled()
    expect(screen.queryByTestId('save-tag-window')).toBeNull()
  })

  it('fast-closes when a PiP is open', async () => {
    ;(queryPipPresence as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(true)
    render(<SaveToast />)
    await waitFor(() => expect(queryPipPresence).toHaveBeenCalled())
    await vi.advanceTimersByTimeAsync(120)
    expect(window.close).toHaveBeenCalled()
    expect(screen.queryByTestId('save-tag-window')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npx vitest run components/bookmarklet/SaveToast.test.tsx`
Expected: FAIL (`save-tag-window` not found; close called in the show case).

- [ ] **Step 3: Write minimal implementation**

Modify the save effect in `SaveToast.tsx`. Add imports, a `'tags'` state, tag-data state, and replace the unconditional fast-close with the branch. Key changes:

```typescript
// add to imports
import { getAllBookmarks } from '@/lib/storage/indexeddb'
import { getAllTags } from '@/lib/storage/tags'
import { orderTagsForSave } from '@/lib/tagger/order-tags-for-save'
import { loadQuickTagEnabled } from '@/lib/storage/quick-tag-setting'
import { queryPipPresence } from '@/lib/board/pip-presence'
import { shouldShowQuickTagWindow } from '@/lib/tagger/quick-tag-apply'
import type { TagRecord } from '@/lib/storage/indexeddb'
import type { SuggestionEntry } from '@/components/board/TagAddPopover'

type State = 'saving' | 'saved' | 'recede' | 'error' | 'tags'

interface TagData {
  bookmarkId: string
  allTags: TagRecord[]
  currentTagIds: string[]
  suggestedEntries: SuggestionEntry[]
}

const UNTOUCHED_CLOSE_MS = 5000
const TAG_WIN_W = 280
const TAG_WIN_H = 360
```

Inside the component add state: `const [tagData, setTagData] = useState<TagData | null>(null)`.

In the save effect, after `postBookmarkSaved({ bookmarkId: bm.id })`, replace the fast-close block with:

```typescript
const enabled = await loadQuickTagEnabled(db)
if (enabled) {
  const pipActive = await queryPipPresence(80)
  if (shouldShowQuickTagWindow(enabled, pipActive)) {
    const [corpus, allTags] = await Promise.all([getAllBookmarks(db), getAllTags(db)])
    const ordered = orderTagsForSave(bm, corpus, allTags)
    setTagData({
      bookmarkId: bm.id,
      allTags,
      currentTagIds: [...bm.tags],
      suggestedEntries: ordered.slice(0, 5).map((t) => ({ kind: 'existing' as const, tagId: t.id })),
    })
    setState('tags')
    try { window.resizeTo(TAG_WIN_W, TAG_WIN_H) } catch { /* popup may refuse */ }
    return
  }
}
// default: fast-close (feature OFF, or PiP open) — unchanged behavior
timers.push(setTimeout(() => {
  try { window.close() } catch { /* browser blocked */ }
}, FAST_CLOSE_MS))
```

Add a minimal tag-mode render branch BEFORE the final `return` of the component (UI fleshed out in Task 3):

```typescript
if (state === 'tags' && tagData) {
  return (
    <div className={styles.stage} data-state="tags" data-testid="save-tag-window">
      {/* TagAddPopover wired in Task 3 */}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npx vitest run components/bookmarklet/SaveToast.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add components/bookmarklet/SaveToast.tsx components/bookmarklet/SaveToast.test.tsx
rtk git commit -m "feat(quick-tag): branch /save window on enabled + pip presence (phase 3)"
```

---

### Task 3: タグUI(TagAddPopover compact)+ 付与 handler + ✕

タグモードに実際のタグメニューと閉じるボタンを描画し、付与を配線する。

**Files:**
- Modify: `components/bookmarklet/SaveToast.tsx`
- Modify: `components/bookmarklet/SaveToast.module.css`
- Test: `components/bookmarklet/SaveToast.test.tsx` (extend)

**Interfaces:**
- Consumes: `TagAddPopover` from `@/components/board/TagAddPopover`; `applyExistingQuickTag`, `applyNewQuickTag` from `@/lib/tagger/quick-tag-apply`; `getAllTags`, `initDB`.
- Produces: tag-mode renders `TagAddPopover compact`; a chip click applies the tag; a `data-testid="save-tag-close"` button closes the window.

- [ ] **Step 1: Write the failing test (extend the suite)**

```typescript
import { fireEvent } from '@testing-library/react'
import { addTagToBookmark } from '@/lib/storage/tags'

it('applies an existing tag chip and broadcasts update', async () => {
  vi.useRealTimers()
  render(<SaveToast />)
  const win = await screen.findByTestId('save-tag-window')
  const chip = await within(win).findByText('design')
  fireEvent.click(chip)
  await waitFor(() => expect(addTagToBookmark).toHaveBeenCalledWith(expect.anything(), 'b1', 't1'))
})

it('closes the window when the close button is pressed', async () => {
  vi.useRealTimers()
  render(<SaveToast />)
  const btn = await screen.findByTestId('save-tag-close')
  fireEvent.click(btn)
  expect(window.close).toHaveBeenCalled()
})
```

Add `within` to the testing-library import and `import { within } from '@testing-library/react'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npx vitest run components/bookmarklet/SaveToast.test.tsx`
Expected: FAIL (chip text / close button not found).

- [ ] **Step 3: Write minimal implementation**

Add tag-apply handlers + a `closeWindow` helper + the real tag-mode render. In the component body:

```typescript
const closeWindow = useRef(() => { try { window.close() } catch { /* blocked */ } }).current

async function handleAddExisting(tagId: string): Promise<void> {
  if (!tagData) return
  await applyExistingQuickTag(await initDB(), tagData.bookmarkId, tagId)
  setTagData((d) => d ? { ...d, currentTagIds: d.currentTagIds.includes(tagId) ? d.currentTagIds : [...d.currentTagIds, tagId] } : d)
}

async function handleAddNew(name: string): Promise<void> {
  if (!tagData) return
  const db = await initDB()
  const tag = await applyNewQuickTag(db, tagData.bookmarkId, name, tagData.allTags)
  if (!tag) return
  const fresh = await getAllTags(db)
  setTagData((d) => d ? {
    ...d, allTags: fresh,
    currentTagIds: d.currentTagIds.includes(tag.id) ? d.currentTagIds : [...d.currentTagIds, tag.id],
  } : d)
}
```

Tag-mode render (replace the Task 2 placeholder):

```tsx
if (state === 'tags' && tagData) {
  return (
    <div className={styles.tagStage} data-state="tags" data-testid="save-tag-window">
      <button
        type="button"
        className={styles.tagClose}
        data-testid="save-tag-close"
        aria-label="close"
        onClick={closeWindow}
      >✕</button>
      <TagAddPopover
        compact
        allTags={tagData.allTags}
        currentTagIds={tagData.currentTagIds}
        suggestedEntries={tagData.suggestedEntries}
        onAddExisting={(tagId) => { void handleAddExisting(tagId) }}
        onAddNew={(name) => { void handleAddNew(name) }}
        onClose={() => { /* lifecycle owns dismissal; popover Esc is a no-op here */ }}
      />
    </div>
  )
}
```

Add CSS to `SaveToast.module.css` (PiP-world look; tune visually later):

```css
.tagStage {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: var(--bg-dark, #0a0a0a);
  color: var(--text-primary, #f2f2f2);
  overflow: hidden;
}
.tagClose {
  align-self: flex-end;
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-card-border, rgba(255,255,255,0.12));
  border-radius: 8px;
  background: rgba(255,255,255,0.04);
  color: inherit;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
}
```

Note: `closeWindow` via `useRef(...).current` keeps a stable reference; alternatively `useCallback`.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npx vitest run components/bookmarklet/SaveToast.test.tsx`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
rtk git add components/bookmarklet/SaveToast.tsx components/bookmarklet/SaveToast.module.css components/bookmarklet/SaveToast.test.tsx
rtk git commit -m "feat(quick-tag): render compact tag menu + apply + close in /save window (phase 3)"
```

---

### Task 4: 窓のライフサイクル(無操作で閉じる / 触ると止まる / 付与後マウス離脱で閉じる)

**Files:**
- Modify: `components/bookmarklet/SaveToast.tsx`
- Test: `components/bookmarklet/SaveToast.test.tsx` (extend)

**Interfaces:**
- Consumes: tag-mode state from Task 3.
- Produces: an untouched auto-close timer (5s) that is cancelled on engage; a pointer-leave-after-engage auto-close (600ms grace) that is suppressed while the new-tag input is focused.

- [ ] **Step 1: Write the failing test (extend)**

```typescript
it('auto-closes after the untouched timeout when never engaged', async () => {
  vi.useFakeTimers()
  render(<SaveToast />)
  // let the async save+branch resolve
  await vi.advanceTimersByTimeAsync(50)
  expect(window.close).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(5000)
  expect(window.close).toHaveBeenCalled()
})

it('cancels the untouched timer once the window is engaged', async () => {
  vi.useFakeTimers()
  render(<SaveToast />)
  await vi.advanceTimersByTimeAsync(50)
  const win = screen.getByTestId('save-tag-window')
  fireEvent.pointerEnter(win)
  await vi.advanceTimersByTimeAsync(6000)
  expect(window.close).not.toHaveBeenCalled()
})

it('closes shortly after the pointer leaves once engaged', async () => {
  vi.useFakeTimers()
  render(<SaveToast />)
  await vi.advanceTimersByTimeAsync(50)
  const win = screen.getByTestId('save-tag-window')
  fireEvent.pointerEnter(win)
  fireEvent.pointerLeave(win)
  await vi.advanceTimersByTimeAsync(700)
  expect(window.close).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npx vitest run components/bookmarklet/SaveToast.test.tsx`
Expected: FAIL (no auto-close / no leave-close wired).

- [ ] **Step 3: Write minimal implementation**

Add refs + an effect that runs when entering tag mode:

```typescript
const untouchedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const engagedRef = useRef(false)

useEffect(() => {
  if (state !== 'tags') return
  untouchedTimerRef.current = setTimeout(() => {
    if (!engagedRef.current) closeWindow()
  }, UNTOUCHED_CLOSE_MS)
  return () => {
    if (untouchedTimerRef.current) clearTimeout(untouchedTimerRef.current)
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
  }
}, [state, closeWindow])

function engage(): void {
  engagedRef.current = true
  if (untouchedTimerRef.current) { clearTimeout(untouchedTimerRef.current); untouchedTimerRef.current = null }
  if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null }
}

function handleLeave(): void {
  if (!engagedRef.current) return
  // Don't close mid-typing a new tag.
  const active = document.activeElement as HTMLElement | null
  if (active && active.tagName === 'INPUT') return
  if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
  leaveTimerRef.current = setTimeout(closeWindow, 600)
}
```

Wire on the tag stage div:

```tsx
<div
  className={styles.tagStage}
  data-state="tags"
  data-testid="save-tag-window"
  onPointerEnter={engage}
  onFocusCapture={engage}
  onPointerLeave={handleLeave}
>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npx vitest run components/bookmarklet/SaveToast.test.tsx`
Expected: PASS (8 tests total).

- [ ] **Step 5: Commit**

```bash
rtk git add components/bookmarklet/SaveToast.tsx components/bookmarklet/SaveToast.test.tsx
rtk git commit -m "feat(quick-tag): /save window lifecycle (untouched/engage/leave close) (phase 3)"
```

---

### Task 5: 全体検証 + 本番デプロイ + 実機確認

**Files:** なし(検証のみ)。必要なら微調整で SaveToast.tsx / .module.css を触る。

- [ ] **Step 1: 型・テスト・ビルド**

Run:
```bash
rtk tsc --noEmit
rtk npx vitest run
rtk pnpm build
```
Expected: tsc 0 errors / 全テスト緑(新規 +14 前後)/ build 成功(`out/` 生成)。

- [ ] **Step 2: デプロイ**

```bash
npx wrangler whoami
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```
Expected: allmarks.app に反映。

- [ ] **Step 3: 本番実機確認(拡張オフ + 自前ブックマークレット)**

確認シート(本番 allmarks.app):
- ブックマークレットを再取得(`/guide` 等の配布元から)。`window.resizeTo` が効かなければ Task 6 へ。
- 設定 OFF → 保存で窓が一瞬で閉じる。
- 設定 ON + ボードで PiP を開いた状態 → 保存で窓は出ず PiP に新カード。そこでタグ付け可。
- 設定 ON + PiP なし → タグ窓が出る。`design` 等の既存タグタップで付与 → 開いてるボードに即反映。新規タグ作成も反映。
- ライフサイクル: 無操作 5s で自動で閉じる / マウスを乗せると閉じない / タグ付け後マウスが窓から離れると閉じる / ✕ で閉じる。
- 拡張あり経路・カーソルピルが不変(回帰なし)。

- [ ] **Step 4: ドキュメント更新 + commit**

`docs/TODO.md`「現在の状態」を session 105 で更新、`docs/CURRENT_GOAL.md` を次セッション用に上書き、`docs/private/dashboard.html` を最新化。

```bash
rtk git add docs/
rtk git commit -m "docs(session-105): phase 3 (bookmarklet quick-tag) shipped"
rtk git push
```

---

### Task 6(条件付き): `window.resizeTo` が効かない場合のみ — ブックマークレットの resizable 許可

Task 5 Step 3 で窓が広がらなかったときだけ実施。

**Files:**
- Modify: `lib/utils/bookmarklet.ts`(`BOOKMARKLET_SOURCE` の window features 文字列内 `resizable=0` → `resizable=1`)
- Test: `tests/.../bookmarklet*`(既存があれば features 文字列の assert を更新)

- [ ] **Step 1:** `BOOKMARKLET_SOURCE` の `...resizable=0,scrollbars=0...` を `resizable=1` に変更。窓名 `booklage-save`・サイズ 200×160・その他 features は不変。
- [ ] **Step 2:** `rtk tsc --noEmit` + 既存ブックマークレットテストがあれば `rtk npx vitest run <それ>`。
- [ ] **Step 3:** ブックマークレットを再取得して resizeTo を再確認。
- [ ] **Step 4: Commit**

```bash
rtk git add lib/utils/bookmarklet.ts
rtk git commit -m "fix(bookmarklet): allow resizable so /save can grow into tag window (phase 3)"
```

---

## Self-Review

**Spec coverage**:
- §3 振る舞い(OFF/PiP/show)→ Task 2 ✓
- §4 タグUI + 付与 + ボード反映 → Task 1(helper)+ Task 3 ✓
- §4 共通化 → Task 1(helper、PiP 側差し替えは温存=リスク回避、spec の「任意/最小」に合致)✓
- §5 ライフサイクル → Task 4 ✓
- §6 resizeTo + resizable フォールバック → Task 2(resizeTo)+ Task 6(条件付き)✓
- §7 テーマ/CSS → Task 3 の .module.css ✓
- §9 検証 → Task 5 ✓
- §10 非対象(カーソルピル等)→ Global Constraints に明記 ✓

**Placeholder scan**: 各 step に実コード/実コマンド記載。`onClose` の no-op はコメントで意図明記(ライフサイクルが dismissal を持つため)。

**Type consistency**: `shouldShowQuickTagWindow` / `applyExistingQuickTag` / `applyNewQuickTag`(返り値 `TagRecord | null`)/ `SuggestionEntry`(`@/components/board/TagAddPopover` から import)/ `TagData` で一貫。`orderTagsForSave` 出力は `{id,name,...}` を `.slice(0,5).map(existing)` で suggestedEntries 化(PiP と同一)。

**注意点(実装者向け)**: `vi.stubGlobal('close', ...)` / `('resizeTo', ...)` は jsdom の `window.close`/`resizeTo` 不在を補う。fake timer と async resolve の順序に注意(`advanceTimersByTimeAsync` で flush)。`initDB` は複数回呼ばれる前提でモックを冪等に。
