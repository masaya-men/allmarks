# 拡張なしブックマークレット保存窓 再設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 拡張なしのブックマークレット保存窓(`/save` = SaveToast)を、80ms 即閉じから「最初から最終サイズで開き、Saving→Saved を意図して見せ、ON+PiP無なら任意タグ付けもできる」確認窓に作り直す。

**Architecture:** `/save` 窓は AllMarks origin。保存処理後に成功/重複/失敗を判定し、純粋関数 `planSaveWindow` で「タグを出すか・自動クローズ時間」を決め、窓サイズ固定のまま中身を saving→saved に差し替える。タグ付与は第3段で作り撤去した共有ヘルパー(git 復元)を流用。ブックマークレット IIFE は窓を最終サイズで開き、元ページトーストを廃止。

**Tech Stack:** Next.js(static export)/ React client component / vitest + @testing-library/react / IndexedDB(idb)/ BroadcastChannel。

## Global Constraints

- TypeScript `strict`、`any` 禁止(`unknown`+型ガード)、return type 明示。Vanilla CSS Modules のみ(Tailwind 禁止)。
- 状態ラベルは**本家カーソルピルと同じ英語**(`Saving` / `Saved` / `Already saved` / `Failed`)。`extension/lib/pill-state-machine.js` の `pillStateView` と一致。日本語 i18n の `bookmarklet.toast.*` は使わない(本設計でトースト廃止)。
- 新規タグ色 `#28F100`。重複判定は同 URL かつ `!isDeleted`(削除済みは再保存可)。
- **窓サイズは終始固定**(`window.resizeTo` を呼ばない、最初から最終サイズで開く)。
- 不可視符号維持: `DB_NAME='booklage-db'`、窓名 `booklage-save`、`booklage:*`、ブックマークレット内部 ID。
- **拡張ユーザー無関係**: ブックマークレット IIFE は拡張検知で即 return(`/save` もトーストも開かない)。`extension/` 配下・カーソルピルは触らない。`vitest.setup.ts` をグローバル変更しない(過去に撤去した実績)。
- 設計 `docs/superpowers/specs/2026-06-17-bookmarklet-save-window-redesign-design.md`。
- 拡張 content scripts は対象外だが、`lib/utils/bookmarklet.ts` は TS なので `tsc` で担保。
- 検証は本番 allmarks.app + 拡張オフで実機。「動いてる」報告は実測後。

---

### Task 1: 共有タグ付与ヘルパーを git から復元

第3段で作り撤去した `lib/tagger/quick-tag-apply.ts`(+ test)を復元する。中身は当時と同一。

**Files:**
- Restore: `lib/tagger/quick-tag-apply.ts`
- Restore: `lib/tagger/quick-tag-apply.test.ts`

**Interfaces (Produces):**
- `shouldShowQuickTagWindow(quickTagEnabled: boolean, pipActive: boolean): boolean`
- `applyExistingQuickTag(db, bookmarkId: string, tagId: string): Promise<void>`
- `applyNewQuickTag(db, bookmarkId: string, name: string, allTags: readonly TagRecord[]): Promise<TagRecord | null>`

- [ ] **Step 1: 復元**

```bash
git checkout abd2db3 -- lib/tagger/quick-tag-apply.ts lib/tagger/quick-tag-apply.test.ts
```

- [ ] **Step 2: テスト + 型確認**

Run: `rtk npx vitest run lib/tagger/quick-tag-apply.test.ts` → 6 tests PASS
Run: `rtk tsc --noEmit` → 0 errors

- [ ] **Step 3: Commit**

```bash
rtk git add lib/tagger/quick-tag-apply.ts lib/tagger/quick-tag-apply.test.ts
rtk git commit -m "feat(save-window): restore shared quick-tag apply helpers"
```

---

### Task 2: 純粋関数 `planSaveWindow`(状態 → タグ表示可否 + 自動クローズ)

**Files:**
- Create: `lib/bookmarklet/save-window-plan.ts`
- Test: `lib/bookmarklet/save-window-plan.test.ts`

**Interfaces:**
- Consumes: `shouldShowQuickTagWindow` (Task 1).
- Produces:
  - `type SaveOutcome = 'saved' | 'duplicate' | 'error'`
  - `interface SaveWindowPlan { showTags: boolean; autoCloseMs: number | null }`
  - `planSaveWindow(outcome: SaveOutcome, quickTagEnabled: boolean, pipActive: boolean): SaveWindowPlan`
  - 定数 `SAVED_AUTOCLOSE_MS = 1800`, `ERROR_AUTOCLOSE_MS = 2400`(export）

- [ ] **Step 1: Write the failing test**

```typescript
// lib/bookmarklet/save-window-plan.test.ts
import { describe, it, expect } from 'vitest'
import { planSaveWindow, SAVED_AUTOCLOSE_MS, ERROR_AUTOCLOSE_MS } from './save-window-plan'

describe('planSaveWindow', () => {
  it('error → no tags, auto-close at error timing', () => {
    expect(planSaveWindow('error', true, false)).toEqual({ showTags: false, autoCloseMs: ERROR_AUTOCLOSE_MS })
  })
  it('saved + enabled + no PiP → tags, no auto-close (lifecycle owns close)', () => {
    expect(planSaveWindow('saved', true, false)).toEqual({ showTags: true, autoCloseMs: null })
  })
  it('duplicate + enabled + no PiP → tags, no auto-close', () => {
    expect(planSaveWindow('duplicate', true, false)).toEqual({ showTags: true, autoCloseMs: null })
  })
  it('saved + disabled → no tags, auto-close at saved timing', () => {
    expect(planSaveWindow('saved', false, false)).toEqual({ showTags: false, autoCloseMs: SAVED_AUTOCLOSE_MS })
  })
  it('saved + enabled + PiP open → no tags (PiP is the tag surface), auto-close', () => {
    expect(planSaveWindow('saved', true, true)).toEqual({ showTags: false, autoCloseMs: SAVED_AUTOCLOSE_MS })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npx vitest run lib/bookmarklet/save-window-plan.test.ts`
Expected: FAIL ("Cannot find module './save-window-plan'").

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/bookmarklet/save-window-plan.ts
import { shouldShowQuickTagWindow } from '@/lib/tagger/quick-tag-apply'

export type SaveOutcome = 'saved' | 'duplicate' | 'error'

export interface SaveWindowPlan {
  /** Render the optional tag UI under the Saved confirmation. */
  readonly showTags: boolean
  /** Auto-close delay; null means "lifecycle (engage/leave/✕) owns the close". */
  readonly autoCloseMs: number | null
}

/** Saved / Already saved sit on screen long enough to read when no tags follow. */
export const SAVED_AUTOCLOSE_MS = 1800
/** Failed lingers a touch longer so the user registers it. */
export const ERROR_AUTOCLOSE_MS = 2400

/**
 * Decide what the deliberate /save confirmation window shows after a save.
 * Tags appear only on a successful/duplicate save when the quick-tag feature
 * is ON and no real PiP is open (PiP is the tag surface when present — mirrors
 * the phase-2 collision rule). When tags show, the window stays open under the
 * interaction lifecycle instead of auto-closing.
 */
export function planSaveWindow(
  outcome: SaveOutcome,
  quickTagEnabled: boolean,
  pipActive: boolean,
): SaveWindowPlan {
  if (outcome === 'error') return { showTags: false, autoCloseMs: ERROR_AUTOCLOSE_MS }
  const showTags = shouldShowQuickTagWindow(quickTagEnabled, pipActive)
  return { showTags, autoCloseMs: showTags ? null : SAVED_AUTOCLOSE_MS }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npx vitest run lib/bookmarklet/save-window-plan.test.ts` → 5 PASS
Run: `rtk tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
rtk git add lib/bookmarklet/save-window-plan.ts lib/bookmarklet/save-window-plan.test.ts
rtk git commit -m "feat(save-window): planSaveWindow pure policy (tags gate + auto-close)"
```

---

### Task 3: SaveToast を「意図した Saved 確認窓」に作り直す(タグ無しの全経路)

成功/重複/失敗を判定し、窓を即閉じせず Saving→Saved/Already saved/Failed を見せ、`planSaveWindow` の `autoCloseMs` で自動クローズ。**この Task ではタグは描画しない**(`showTags` の経路は Task 4)。

**Files:**
- Rewrite: `components/bookmarklet/SaveToast.tsx`
- Modify: `components/bookmarklet/SaveToast.module.css`(`.duplicate` アンバー追加)
- Test: `components/bookmarklet/SaveToast.test.tsx`(Create)

**Interfaces:**
- Consumes: `planSaveWindow` / `SaveOutcome` (Task 2); `getAllBookmarks`/`addBookmark`/`initDB` (`@/lib/storage/indexeddb`); `loadQuickTagEnabled` (`@/lib/storage/quick-tag-setting`); `queryPipPresence` (`@/lib/board/pip-presence`); `postBookmarkSaved` (`@/lib/board/channel`); `detectUrlType` (`@/lib/utils/url`).
- Produces: SaveToast renders `data-testid="save-toast"` with `data-state` of `saving|saved|duplicate|error`; shows English labels; auto-closes per plan when no tags. A later task adds the tag path.

- [ ] **Step 1: Write the failing test**

```typescript
// components/bookmarklet/SaveToast.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { SaveToast } from './SaveToast'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams({ url: 'https://x.com/a/status/1', title: 'Hi' }),
}))
const addBookmark = vi.fn(async () => ({ id: 'b1', tags: [] }))
const getAllBookmarks = vi.fn(async () => [] as Array<{ id: string; url: string; isDeleted?: boolean; tags: string[] }>)
vi.mock('@/lib/storage/indexeddb', () => ({
  initDB: vi.fn(async () => ({})),
  addBookmark: (...a: unknown[]) => addBookmark(...a),
  getAllBookmarks: (...a: unknown[]) => getAllBookmarks(...a),
}))
vi.mock('@/lib/storage/quick-tag-setting', () => ({ loadQuickTagEnabled: vi.fn(async () => false) }))
vi.mock('@/lib/board/pip-presence', () => ({ queryPipPresence: vi.fn(async () => false) }))
vi.mock('@/lib/board/channel', () => ({ postBookmarkSaved: vi.fn(), postBookmarkUpdated: vi.fn() }))
vi.mock('@/lib/utils/url', () => ({ detectUrlType: () => 'tweet' }))

async function flush(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

describe('SaveToast deliberate confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    Object.defineProperty(window, 'close', { value: vi.fn(), writable: true, configurable: true })
    getAllBookmarks.mockResolvedValue([])
    addBookmark.mockResolvedValue({ id: 'b1', tags: [] })
  })

  it('new save → shows Saved then auto-closes (no tags when feature off)', async () => {
    render(<SaveToast />)
    await flush(500) // min-saving + async work
    expect(screen.getByTestId('save-toast').getAttribute('data-state')).toBe('saved')
    expect(screen.getByText('Saved')).toBeTruthy()
    expect(window.close).not.toHaveBeenCalled()
    await flush(1900)
    expect(window.close).toHaveBeenCalled()
  })

  it('duplicate (same non-deleted url) → Already saved, no second addBookmark', async () => {
    getAllBookmarks.mockResolvedValue([{ id: 'old', url: 'https://x.com/a/status/1', isDeleted: false, tags: [] }])
    render(<SaveToast />)
    await flush(500)
    expect(screen.getByTestId('save-toast').getAttribute('data-state')).toBe('duplicate')
    expect(screen.getByText('Already saved')).toBeTruthy()
    expect(addBookmark).not.toHaveBeenCalled()
  })

  it('save failure → Failed then auto-closes', async () => {
    addBookmark.mockRejectedValue(new Error('boom'))
    render(<SaveToast />)
    await flush(500)
    expect(screen.getByTestId('save-toast').getAttribute('data-state')).toBe('error')
    expect(screen.getByText('Failed')).toBeTruthy()
    await flush(2500)
    expect(window.close).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npx vitest run components/bookmarklet/SaveToast.test.tsx`
Expected: FAIL (still fast-closes; no 'duplicate' state; labels Japanese).

- [ ] **Step 3: Write minimal implementation**

Rewrite `components/bookmarklet/SaveToast.tsx` to:

```tsx
'use client'

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useSearchParams } from 'next/navigation'
import { initDB, addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { detectUrlType } from '@/lib/utils/url'
import { postBookmarkSaved } from '@/lib/board/channel'
import { loadQuickTagEnabled } from '@/lib/storage/quick-tag-setting'
import { queryPipPresence } from '@/lib/board/pip-presence'
import { planSaveWindow, type SaveOutcome } from '@/lib/bookmarklet/save-window-plan'
import styles from './SaveToast.module.css'

type State = 'saving' | SaveOutcome // 'saving' | 'saved' | 'duplicate' | 'error'

const MIN_SAVING_MS = 400
const LABELS: Record<State, string> = {
  saving: 'Saving', saved: 'Saved', duplicate: 'Already saved', error: 'Failed',
}

function StaggeredLabel({ text }: { text: string }): ReactElement {
  const chars = useMemo(() => Array.from(text), [text])
  return (
    <>
      {chars.map((ch, i) => (
        <span key={`${i}-${ch}`} style={{ animationDelay: `${i * 40}ms` }}>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </>
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function SaveToast(): ReactElement {
  const params = useSearchParams()
  const url = params.get('url') ?? ''
  const title = params.get('title') || url
  const desc = params.get('desc') ?? ''
  const image = params.get('image') ?? ''
  const site = params.get('site') ?? ''
  const favicon = params.get('favicon') ?? ''

  const [state, setState] = useState<State>('saving')
  const startedRef = useRef(false)
  const closeWindow = useRef(() => { try { window.close() } catch { /* blocked */ } }).current

  useEffect(() => {
    if (!url || startedRef.current) return
    startedRef.current = true
    const timers: ReturnType<typeof setTimeout>[] = []

    ;(async (): Promise<void> => {
      try {
        const db = await initDB()
        // Min-saving floor runs concurrently so 'Saving' is always perceived.
        const work = (async (): Promise<{ outcome: SaveOutcome }> => {
          const all = await getAllBookmarks(db)
          const existing = all.find((b) => b.url === url && !b.isDeleted)
          if (existing) return { outcome: 'duplicate' }
          const bm = await addBookmark(db, {
            url, title, description: desc, thumbnail: image, favicon,
            siteName: site, type: detectUrlType(url), tags: [],
          })
          postBookmarkSaved({ bookmarkId: bm.id })
          return { outcome: 'saved' }
        })()
        const [{ outcome }] = await Promise.all([work, delay(MIN_SAVING_MS)])

        const [enabled, pipActive] = await Promise.all([
          loadQuickTagEnabled(db),
          queryPipPresence(80),
        ])
        const plan = planSaveWindow(outcome, enabled, pipActive)
        setState(outcome)
        // Tag rendering + lifecycle land in the next task; for now, when the
        // plan says no tags, auto-close. (plan.showTags is always false until
        // the tag path is wired.)
        if (plan.autoCloseMs !== null) {
          timers.push(setTimeout(closeWindow, plan.autoCloseMs))
        }
      } catch {
        setState('error')
        timers.push(setTimeout(closeWindow, 2400))
      }
    })()

    return () => { for (const tm of timers) clearTimeout(tm) }
  }, [url, title, desc, image, site, favicon, closeWindow])

  if (!url) {
    return (
      <div className={styles.stage} data-state="saving" data-testid="save-toast">
        <div className={styles.glow} />
        <div className={styles.center}>
          <div className={styles.indicator}><div className={styles.ring} data-role="ring" /></div>
          <div className={styles.brand}>AllMarks</div>
          <div className={styles.label} aria-live="polite">
            <StaggeredLabel text="ブックマークレットから開いてください" />
          </div>
        </div>
      </div>
    )
  }

  const labelClass =
    state === 'saved' ? `${styles.label} ${styles.saved}` :
    state === 'duplicate' ? `${styles.label} ${styles.duplicate}` :
    state === 'error' ? `${styles.label} ${styles.error}` :
    styles.label

  return (
    <div className={styles.stage} data-state={state} data-testid="save-toast">
      <div className={styles.glow} />
      <div className={styles.center}>
        <div className={styles.indicator}>
          {state === 'saving' && <div className={styles.ring} data-role="ring" />}
          {state === 'saved' && (
            <svg className={styles.checkmark} viewBox="0 0 24 24" role="img" aria-label="Saved" data-role="checkmark">
              <path d="M5 12 L10 17 L19 7" />
            </svg>
          )}
          {state === 'duplicate' && (
            <svg className={`${styles.checkmark} ${styles.warn}`} viewBox="0 0 24 24" role="img" aria-label="Already saved" data-role="warn">
              <path d="M12 3 L22 20 L2 20 Z" /><path d="M12 9 L12 14" /><circle cx="12" cy="17.2" r="1.3" />
            </svg>
          )}
          {state === 'error' && (
            <div className={styles.errorMark} role="img" aria-label="Failed" data-role="error-mark">!</div>
          )}
        </div>
        <div className={styles.brand}>AllMarks</div>
        <div className={labelClass} aria-live="polite"><StaggeredLabel text={LABELS[state]} /></div>
      </div>
    </div>
  )
}
```

Add to `SaveToast.module.css` an amber duplicate label + warn icon styling (place near `.saved` / `.checkmark`):

```css
.duplicate { color: #ffb020; }
.warn { stroke: #ffb020; fill: none; }
.warn circle { fill: #ffb020; stroke: none; }
```

Note: the warn `<svg>` reuses `.checkmark` geometry; ensure `.checkmark path` has `fill:none;stroke:...` already (it does for the check). If the existing `.checkmark` hardcodes green stroke, the `.warn` override above re-colors it amber.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npx vitest run components/bookmarklet/SaveToast.test.tsx` → 3 PASS, pristine output
Run: `rtk tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
rtk git add components/bookmarklet/SaveToast.tsx components/bookmarklet/SaveToast.module.css components/bookmarklet/SaveToast.test.tsx
rtk git commit -m "feat(save-window): deliberate Saved/Already saved/Failed confirmation (no fast-close)"
```

---

### Task 4: タグ経路(ON + PiP無)— Saved の下にタグUI + 付与 + ✕ + ライフサイクル

**Files:**
- Modify: `components/bookmarklet/SaveToast.tsx`
- Modify: `components/bookmarklet/SaveToast.module.css`(タグ領域 + ✕）
- Test: `components/bookmarklet/SaveToast.test.tsx`(extend)

**Interfaces:**
- Consumes: `TagAddPopover` + `SuggestionEntry` (`@/components/board/TagAddPopover`); `applyExistingQuickTag`/`applyNewQuickTag` (Task 1); `getAllTags` (`@/lib/storage/tags`); `orderTagsForSave` (`@/lib/tagger/order-tags-for-save`); `postBookmarkUpdated` is used inside the helpers.
- Produces: when `plan.showTags`, renders `TagAddPopover compact` below the confirmation + a `data-testid="save-tag-close"` ✕; lifecycle (untouched 5s / engage pointerEnter+keydown / leave 600ms with value-guard / ✕) governs close instead of auto-close.

- [ ] **Step 1: Write the failing test (extend the suite)**

```typescript
import { within, fireEvent } from '@testing-library/react'
import { loadQuickTagEnabled } from '@/lib/storage/quick-tag-setting'
import { addTagToBookmark } from '@/lib/storage/tags'

// add these module mocks at top of file:
vi.mock('@/lib/storage/tags', () => ({
  getAllTags: vi.fn(async () => [{ id: 't1', name: 'design', color: '#fff', order: 0 }]),
  addTagToBookmark: vi.fn(async () => {}),
  addTag: vi.fn(async () => ({ id: 't2', name: 'new', color: '#28F100', order: 1 })),
}))
vi.mock('@/lib/tagger/order-tags-for-save', () => ({
  orderTagsForSave: vi.fn(() => [{ id: 't1', name: 'design', color: '#fff' }]),
}))

describe('SaveToast tag path (enabled + no PiP)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'close', { value: vi.fn(), writable: true, configurable: true })
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false, media: q, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }))
    ;(loadQuickTagEnabled as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(true)
  })

  it('renders the tag menu and does not auto-close', async () => {
    vi.useFakeTimers()
    render(<SaveToast />)
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    const win = screen.getByTestId('save-tag-window')
    expect(within(win).getByText('design')).toBeTruthy()
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(window.close).not.toHaveBeenCalled() // no auto-close while tags shown & untouched-timer not elapsed
  })

  it('applying an existing tag writes through the helper', async () => {
    vi.useRealTimers()
    render(<SaveToast />)
    const win = await screen.findByTestId('save-tag-window')
    fireEvent.click(await within(win).findByText('design'))
    expect(addTagToBookmark).toHaveBeenCalledWith(expect.anything(), 'b1', 't1')
  })

  it('untouched 5s auto-closes; pointerEnter cancels', async () => {
    vi.useFakeTimers()
    render(<SaveToast />)
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    fireEvent.pointerEnter(screen.getByTestId('save-tag-window'))
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(window.close).not.toHaveBeenCalled()
  })

  it('close button closes', async () => {
    vi.useRealTimers()
    render(<SaveToast />)
    const btn = await screen.findByTestId('save-tag-close')
    fireEvent.click(btn)
    expect(window.close).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npx vitest run components/bookmarklet/SaveToast.test.tsx`
Expected: FAIL (`save-tag-window` / tag chips not rendered).

- [ ] **Step 3: Write minimal implementation**

In `SaveToast.tsx`:

1. Add imports:
```tsx
import { getAllTags } from '@/lib/storage/tags'
import { orderTagsForSave } from '@/lib/tagger/order-tags-for-save'
import { applyExistingQuickTag, applyNewQuickTag } from '@/lib/tagger/quick-tag-apply'
import { TagAddPopover, type SuggestionEntry } from '@/components/board/TagAddPopover'
import type { TagRecord } from '@/lib/storage/indexeddb'
```

2. Add tag state + constants:
```tsx
const UNTOUCHED_CLOSE_MS = 5000
const LEAVE_GRACE_MS = 600
interface TagData { bookmarkId: string; allTags: TagRecord[]; currentTagIds: string[]; suggestedEntries: SuggestionEntry[] }
```
```tsx
const [tagData, setTagData] = useState<TagData | null>(null)
const untouchedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const engagedRef = useRef(false)
```

3. In the save effect, when `plan.showTags`, gather tag data for the resolved bookmark id and DON'T auto-close. The work block must return the bookmark (id + tags). Update the work return + after-plan logic:
```tsx
// work now returns { outcome, bm }
const work = (async (): Promise<{ outcome: SaveOutcome; bm: { id: string; tags: string[] } }> => {
  const all = await getAllBookmarks(db)
  const existing = all.find((b) => b.url === url && !b.isDeleted)
  if (existing) return { outcome: 'duplicate', bm: { id: existing.id, tags: existing.tags } }
  const created = await addBookmark(db, {
    url, title, description: desc, thumbnail: image, favicon,
    siteName: site, type: detectUrlType(url), tags: [],
  })
  postBookmarkSaved({ bookmarkId: created.id })
  return { outcome: 'saved', bm: { id: created.id, tags: created.tags } }
})()
const [{ outcome, bm }] = await Promise.all([work, delay(MIN_SAVING_MS)])
const [enabled, pipActive] = await Promise.all([loadQuickTagEnabled(db), queryPipPresence(80)])
const plan = planSaveWindow(outcome, enabled, pipActive)
if (plan.showTags) {
  const [corpus, allTags] = await Promise.all([getAllBookmarks(db), getAllTags(db)])
  const ordered = orderTagsForSave({ ...bm, url } as never, corpus, allTags)
  setTagData({
    bookmarkId: bm.id,
    allTags,
    currentTagIds: [...bm.tags],
    suggestedEntries: ordered.slice(0, 5).map((tg) => ({ kind: 'existing' as const, tagId: tg.id })),
  })
}
setState(outcome)
if (plan.autoCloseMs !== null) timers.push(setTimeout(closeWindow, plan.autoCloseMs))
```
(Note: `orderTagsForSave`'s first arg is a bookmark record; pass the minimal shape it needs. If TS complains, build the arg from the existing/created record fields rather than casting — restore the full record by reading it. Prefer no `as never`: pass the real `created`/`existing` object. Adjust the work block to carry the full record if `orderTagsForSave` needs more fields.)

4. Lifecycle effect + handlers (only active when tagData present):
```tsx
useEffect(() => {
  if (!tagData) return
  untouchedTimerRef.current = setTimeout(() => { if (!engagedRef.current) closeWindow() }, UNTOUCHED_CLOSE_MS)
  function onKeyDown(): void { engage() }
  window.addEventListener('keydown', onKeyDown)
  return () => {
    window.removeEventListener('keydown', onKeyDown)
    if (untouchedTimerRef.current) clearTimeout(untouchedTimerRef.current)
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
  }
}, [tagData, closeWindow])

function engage(): void {
  engagedRef.current = true
  if (untouchedTimerRef.current) { clearTimeout(untouchedTimerRef.current); untouchedTimerRef.current = null }
  if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null }
}
function handleLeave(e: React.PointerEvent<HTMLDivElement>): void {
  if (!engagedRef.current) return
  const input = e.currentTarget.querySelector('input')
  if (input && input.value.trim() !== '') return // mid-compose: keep open
  if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
  leaveTimerRef.current = setTimeout(closeWindow, LEAVE_GRACE_MS)
}
async function handleAddExisting(tagId: string): Promise<void> {
  if (!tagData) return
  if (tagData.currentTagIds.includes(tagId)) return
  await applyExistingQuickTag(await initDB(), tagData.bookmarkId, tagId)
  setTagData((d) => d ? { ...d, currentTagIds: [...d.currentTagIds, tagId] } : d)
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

5. Render the tag window when `tagData` is set (wrap the confirmation + tag menu in one fixed-size stage with `data-testid="save-tag-window"`):
```tsx
if (tagData) {
  return (
    <div
      className={`${styles.stage} ${styles.tagStage}`}
      data-state={state}
      data-testid="save-tag-window"
      onPointerEnter={engage}
      onFocusCapture={undefined}
      onPointerLeave={handleLeave}
    >
      <button type="button" className={styles.tagClose} data-testid="save-tag-close" aria-label="close" onClick={closeWindow}>✕</button>
      <div className={styles.center}>
        {/* same icon + brand + label block as the no-tag render (saved/duplicate) */}
        <div className={styles.indicator}>{/* check or warn per state */}</div>
        <div className={styles.brand}>AllMarks</div>
        <div className={labelClass} aria-live="polite"><StaggeredLabel text={LABELS[state]} /></div>
      </div>
      <TagAddPopover
        compact
        allTags={tagData.allTags}
        currentTagIds={tagData.currentTagIds}
        suggestedEntries={tagData.suggestedEntries}
        onAddExisting={(id) => { void handleAddExisting(id) }}
        onAddNew={(name) => { void handleAddNew(name) }}
        onClose={() => { /* lifecycle owns dismissal */ }}
      />
    </div>
  )
}
```
(Reuse the exact icon block from Task 3's render for `saved`/`duplicate`. Do NOT add `onFocusCapture` — programmatic input mount-focus must not engage; keydown is the typing-engage signal.)

CSS additions to `SaveToast.module.css`:
```css
.tagStage { display: flex; flex-direction: column; padding: 12px; overflow: hidden; }
.tagClose {
  position: absolute; top: 8px; right: 8px; width: 28px; height: 28px;
  border: 1px solid var(--color-card-border, rgba(255,255,255,0.12)); border-radius: 8px;
  background: rgba(255,255,255,0.04); color: inherit; cursor: pointer; font-size: 13px; line-height: 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npx vitest run components/bookmarklet/SaveToast.test.tsx` → all PASS
Run: `rtk npx vitest run` → full suite green
Run: `rtk tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
rtk git add components/bookmarklet/SaveToast.tsx components/bookmarklet/SaveToast.module.css components/bookmarklet/SaveToast.test.tsx
rtk git commit -m "feat(save-window): optional in-window tagging (ON + no PiP) with lifecycle"
```

---

### Task 5: ブックマークレット IIFE — 窓を最終サイズで開く + 元ページトースト廃止

**Files:**
- Modify: `lib/utils/bookmarklet.ts`(`BOOKMARKLET_SOURCE`)
- Test: `lib/utils/bookmarklet.test.ts`(あれば extend、無ければ Create)

**Interfaces:**
- Produces: `generateBookmarkletUri(appUrl)` の出力が `width=300,height=380` を含み、Shadow DOM トースト文字列(`に保存中` / `attachShadow`)を**含まない**。

- [ ] **Step 1: Write the failing test**

```typescript
// lib/utils/bookmarklet.test.ts  (add if a file exists; else create)
import { describe, it, expect } from 'vitest'
import { generateBookmarkletUri } from './bookmarklet'

describe('bookmarklet source (save-window redesign)', () => {
  const uri = generateBookmarkletUri('https://allmarks.app')
  it('opens the /save popup at the final window size', () => {
    expect(uri).toContain('width=300,height=380')
  })
  it('no longer injects a host-page shadow-DOM toast', () => {
    expect(uri).not.toContain('attachShadow')
    expect(uri).not.toContain('\\u306b\\u4fdd\\u5b58\\u4e2d') // legacy 'に保存中'
    expect(uri).not.toContain('に保存中')
  })
  it('still hands off to the extension when present', () => {
    expect(uri).toContain('booklage:save-via-extension')
  })
  it('still opens the booklage-save window', () => {
    expect(uri).toContain("'booklage-save'")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npx vitest run lib/utils/bookmarklet.test.ts`
Expected: FAIL (size is 200/160; `attachShadow` present).

- [ ] **Step 3: Write minimal implementation**

In `lib/utils/bookmarklet.ts` `BOOKMARKLET_SOURCE`:
1. Change `W=200,H=160` → `W=300,H=380`.
2. Delete the host-page toast block: everything from `var h=d.createElement('div');h.style.cssText='all:initial;...` through the trailing `setTimeout(function(){try{d.body.removeChild(h)}catch(e){}},2500)` — i.e. remove the entire Shadow-DOM toast creation + its 4 setTimeouts, leaving the IIFE to end right after the `window.open(...)` call.
3. Update the JSDoc comment above `BOOKMARKLET_SOURCE` (path B) to reflect: popup opens at final size and shows the Saved confirmation itself; no host-page toast.

Keep: the extension hand-off branch (`data.booklageExtension==='1'` → postMessage → return), the `window.open('__APP_URL__/save?'+...,'booklage-save',...)` call, window name, and `resizable=0`/other features unchanged except width/height.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npx vitest run lib/utils/bookmarklet.test.ts` → PASS
Run: `rtk tsc --noEmit` → 0 errors

- [ ] **Step 5: Commit**

```bash
rtk git add lib/utils/bookmarklet.ts lib/utils/bookmarklet.test.ts
rtk git commit -m "feat(save-window): bookmarklet opens /save at final size, drops host-page toast"
```

---

### Task 6: 通し検証 + 本番デプロイ + 実機確認

**Files:** なし(検証のみ)。微調整で SaveToast / bookmarklet / CSS を触る可能性あり。

- [ ] **Step 1: 型・テスト・ビルド**

Run:
```bash
rtk tsc --noEmit
rtk npx vitest run
rtk pnpm build
```
Expected: tsc 0 / 全テスト緑 / build 成功(`out/` 生成)。

- [ ] **Step 2: デプロイ**

```bash
npx wrangler whoami
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="save-window redesign"
```

- [ ] **Step 3: 本番実機確認(拡張オフ + 自前ブックマークレット再取得)**

- ブックマークレットを再取得(配布元)。窓が**最初から最終サイズ**で一発で出る(小→大の変身なし)。
- 新規保存 → Saving → **Saved ✓**(英語ラベル)。既存 URL → **Already saved**(アンバー)。
- quick-tag ON + PiP なし → Saved の下にタグ(既存 + 新規)。タップでボード即反映。
- quick-tag OFF / PiP 開 → Saved/Already saved だけで自動クローズ(~1.8s)。
- ライフサイクル: 無操作 5s で閉じる / 触る・入力で止まる / 離れたら閉じる / ✕。
- 元ページ右上トーストが**出ない**こと。
- **拡張あり経路・カーソルピルが不変**(回帰なし)。

- [ ] **Step 4: ドキュメント更新 + commit + push**

`docs/TODO.md`「現在の状態」更新、`docs/CURRENT_GOAL.md` 次セッション用に上書き、`docs/private/dashboard.html` があれば最新化。

```bash
rtk git add docs/
rtk git commit -m "docs(session-105): bookmarklet save-window redesign shipped"
rtk git push origin master
```

---

## Self-Review

**Spec coverage**:
- §4.1 窓を最終サイズで開く + トースト廃止 → Task 5 ✓
- §4.2 4 状態 + 重複判定 + 最低 saving 表示 + サイズ固定 → Task 3 ✓
- §4.3 タグ表示ゲート(ON+PiP無)+ 流用 helper + 付与 → Task 2(plan)+ Task 1(helper)+ Task 4 ✓
- §4.4 ライフサイクル(タグ無=自動 / タグ有=engage/leave/✕/入力ガード)→ Task 2(autoClose)+ Task 4 ✓
- §5 git 復元 + 改造点 → Task 1(復元)+ Task 3/4/5(改造)✓
- §3 拡張無関係 → Global Constraints + Task 5(IIFE は拡張検知 return を保持)✓
- §6 テスト → 各 Task + Task 6 ✓

**Placeholder scan**: 各 step に実コード/コマンド。数値(300×380 / 1800 / 2400 / 5000 / 600 / 400)は spec の「暫定・実機微調整」を継承、Task 6 で確認。

**Type consistency**: `SaveOutcome`('saved'|'duplicate'|'error')/ `SaveWindowPlan`{showTags,autoCloseMs}/ `planSaveWindow` / `State`('saving'|SaveOutcome)/ `TagData`{bookmarkId,allTags,currentTagIds,suggestedEntries}/ `applyExistingQuickTag`・`applyNewQuickTag`(返り `TagRecord|null`)で一貫。`orderTagsForSave` の第1引数は bookmark record — Task 4 のメモどおり `as never` を避け実レコードを渡す(実装時に work ブロックが必要フィールドを保持)。

**実装者注意**: `MIN_SAVING_MS` は `delay()` を `Promise.all` で並走(fake timer は `advanceTimersByTimeAsync` で flush)。`window.close`/`open`/`matchMedia` は test で stub。`vitest.setup.ts` をグローバル変更しない。`orderTagsForSave` が要求するフィールドが多い場合は work ブロックで existing/created の全レコードを保持して渡す。
