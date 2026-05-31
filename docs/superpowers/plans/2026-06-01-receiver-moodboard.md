# 受け取りムードボード「SHARED WITH YOU」実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共有リンクを開いた人に、本物のムードボードとしてコレクションを見せ、要るカードだけ選んで取り込めるようにする。

**Architecture:** 取り込まずに表示し、SAVE 時のみ取り込む。描画は既存の prop 駆動 [CardsLayer](../../../components/board/CardsLayer.tsx) を「受け取りモード」で再利用 (生きた挙動が CardsLayer 側にあるため)。選択状態は受け取り画面のローカル state。送り主タグは選択候補としてカード上のオーバーレイで ON/OFF (既定 OFF)。

**Tech Stack:** Next.js (static export) / React / TypeScript strict / Vanilla CSS Modules / IndexedDB (idb) / Cloudflare Pages。テスト: vitest (純関数) + Playwright (実機)。

**設計書:** [docs/superpowers/specs/2026-06-01-receiver-moodboard-design.md](../specs/2026-06-01-receiver-moodboard-design.md)

---

## ファイル構成 (作成/変更/削除)

**変更:**
- `lib/share/types-v2.ts` — `theme?: 'wave'` → `theme?: ThemeId`
- `lib/share/validate-v2.ts` — theme を ThemeId 集合で sanitize
- `lib/share/board-to-share.ts` — 送り主 themeId を載せる (引数追加)
- `components/share/SenderShareModal.tsx` — build 呼び出しに themeId を渡す
- `components/board/CardsLayer.tsx` — 受け取りモード optional props + per-card オーバーレイ + 編集 affordance 抑制
- `app/(app)/s/ShareEntry.tsx` — 常に新 SharedBoard を出す (triage 分岐削除)

**作成:**
- `lib/share/share-card-to-board-item.ts` — ShareCardV2 → BoardItem 純関数 + test
- `lib/share/receiver-selection.ts` — 取り込み選択 + 送り主タグ選択の純ロジック + test
- `components/share/SharedBoard.tsx` (+ `.module.css`) — 受け取り画面本体 (CardsLayer host + SAVE ボタン + 取り込み実行)

**削除:**
- `components/share/ReceiverTriage.tsx` / `ReceiverTriage.module.css` / `ReceiverTriage.test.tsx`
- `components/share/ReceiverLanding.tsx` / `ReceiverLanding.module.css` / `ReceiverLanding.test.tsx` (新 SharedBoard が置き換え)

---

## Task 1: 共有スキーマの theme を ThemeId に変更

**Files:**
- Modify: `lib/share/types-v2.ts:54`
- Modify: `lib/share/validate-v2.ts`
- Test: `lib/share/validate-v2.test.ts` (既存に追記。無ければ作成)

- [ ] **Step 1: types-v2 の theme 型を変更**

`lib/share/types-v2.ts` 冒頭の import に追加:
```typescript
import type { ThemeId } from '@/lib/board/types'
```
`ShareDataV2` の該当行を変更:
```typescript
  readonly theme?: ThemeId
```

- [ ] **Step 2: 失敗するテストを書く**

`lib/share/validate-v2.test.ts` に追記:
```typescript
import { describe, it, expect } from 'vitest'
import { sanitizeShareDataV2 } from './validate-v2'

describe('sanitizeShareDataV2 theme', () => {
  const base = { v: 2, cards: [], createdAt: 1 }
  it('keeps a valid ThemeId', () => {
    const r = sanitizeShareDataV2({ ...base, theme: 'grid-paper' })
    expect(r.ok && r.data.theme).toBe('grid-paper')
  })
  it('drops an unknown theme value (e.g. legacy "wave") to undefined', () => {
    const r = sanitizeShareDataV2({ ...base, theme: 'wave' })
    expect(r.ok && r.data.theme).toBeUndefined()
  })
})
```

- [ ] **Step 3: テストが落ちることを確認**

Run: `rtk vitest run lib/share/validate-v2`
Expected: FAIL (theme='wave' が通ってしまう / または theme が読まれない)

- [ ] **Step 4: validate-v2 に theme sanitize を実装**

`lib/share/validate-v2.ts` で、ThemeId 集合を import して許可値のみ通す。`listThemeIds()` ([lib/board/theme-registry.ts](../../../lib/board/theme-registry.ts)) を使う:
```typescript
import { listThemeIds } from '@/lib/board/theme-registry'
// ... sanitize 内で:
const validThemes = new Set<string>(listThemeIds())
const theme = typeof raw.theme === 'string' && validThemes.has(raw.theme)
  ? (raw.theme as ThemeId)
  : undefined
// 出力 data に theme を含める
```
(実際の sanitize 構造に合わせて、theme フィールドを出力オブジェクトに足す。`ThemeId` を `@/lib/board/types` から import。)

- [ ] **Step 5: テストが通ることを確認**

Run: `rtk vitest run lib/share/validate-v2`
Expected: PASS

- [ ] **Step 6: commit**

```bash
rtk git add lib/share/types-v2.ts lib/share/validate-v2.ts lib/share/validate-v2.test.ts
rtk git commit -m "feat(share): carry real ThemeId in share schema, sanitize unknown theme to undefined"
```

---

## Task 2: 送信側で送り主の themeId を載せる

**Files:**
- Modify: `lib/share/board-to-share.ts:33-39,84-92`
- Modify: `components/share/SenderShareModal.tsx`
- Test: `lib/share/board-to-share.test.ts` (既存に追記)

- [ ] **Step 1: 失敗するテストを書く**

`lib/share/board-to-share.test.ts` に追記:
```typescript
it('carries the provided themeId', () => {
  const data = buildShareDataFromBoard({
    items: [], tags: [], filter: null, now: 1, themeId: 'grid-paper',
  })
  expect(data.theme).toBe('grid-paper')
})
it('omits theme when no themeId provided', () => {
  const data = buildShareDataFromBoard({ items: [], tags: [], filter: null, now: 1 })
  expect(data.theme).toBeUndefined()
})
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `rtk vitest run lib/share/board-to-share`
Expected: FAIL (theme は 'wave' 固定)

- [ ] **Step 3: board-to-share に themeId を実装**

`BuildShareArgs` に追加:
```typescript
  readonly themeId?: import('@/lib/board/types').ThemeId
```
返り値の `theme: 'wave'` を削除し、条件付きで:
```typescript
  return {
    v: SHARE_SCHEMA_VERSION_V2,
    cards,
    tags: tagDict,
    filter: args.filter ?? undefined,
    ...(args.themeId ? { theme: args.themeId } : {}),
    createdAt: args.now,
  }
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run lib/share/board-to-share`
Expected: PASS

- [ ] **Step 5: SenderShareModal で themeId を渡す**

`components/share/SenderShareModal.tsx` の `buildShareDataFromBoard(...)` 呼び出しに、現在の board config の themeId を渡す。board config は親 (BoardRoot) から prop で来ているか、`getBoardConfig()` で読む。**実装時に SenderShareModal が config をどう得ているか確認し**、`themeId: config.themeId` を build 引数に追加する。得られない場合は `DEFAULT_THEME_ID` を渡す (= 現状ボードは default 固定なので等価)。

- [ ] **Step 6: tsc + テスト**

Run: `rtk tsc && rtk vitest run lib/share`
Expected: PASS

- [ ] **Step 7: commit**

```bash
rtk git add lib/share/board-to-share.ts lib/share/board-to-share.test.ts components/share/SenderShareModal.tsx
rtk git commit -m "feat(share): include sender themeId when building a share"
```

---

## Task 3: ShareCardV2 → BoardItem 純関数 mapper

**Files:**
- Create: `lib/share/share-card-to-board-item.ts`
- Test: `lib/share/share-card-to-board-item.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
import { describe, it, expect } from 'vitest'
import { shareCardToBoardItem } from './share-card-to-board-item'
import type { ShareCardV2 } from './types-v2'

const card: ShareCardV2 = { u: 'https://x.com/a/status/1', t: 'Title', d: 'Desc', th: 'thumb.jpg', ty: 'tweet', cw: 320, a: 1.5, tg: ['t1'] }

describe('shareCardToBoardItem', () => {
  it('maps fields onto a valid BoardItem', () => {
    const it0 = shareCardToBoardItem(card, 3)
    expect(it0.bookmarkId).toBe('https://x.com/a/status/1')
    expect(it0.cardId).toBe('https://x.com/a/status/1')
    expect(it0.url).toBe('https://x.com/a/status/1')
    expect(it0.title).toBe('Title')
    expect(it0.description).toBe('Desc')
    expect(it0.thumbnail).toBe('thumb.jpg')
    expect(it0.aspectRatio).toBe(1.5)
    expect(it0.cardWidth).toBe(320)
    expect(it0.customCardWidth).toBe(true)
    expect(it0.gridIndex).toBe(3)
    expect(it0.orderIndex).toBe(3)
    expect(it0.isRead).toBe(false)
    expect(it0.isDeleted).toBe(false)
    expect(it0.tags).toEqual([]) // sender tags are selection-state, NOT assigned
    expect(it0.displayMode).toBeNull()
  })
})
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `rtk vitest run lib/share/share-card-to-board-item`
Expected: FAIL ("shareCardToBoardItem is not a function")

- [ ] **Step 3: 実装**

```typescript
import type { ShareCardV2 } from './types-v2'
import type { BoardItem } from '@/lib/storage/use-board-data'

/** Map a shared card to a board item for read-only moodboard rendering.
 *  Sender tags are NOT assigned here (tags: []) — they are selection
 *  candidates handled by the receiver UI, applied only on import. */
export function shareCardToBoardItem(card: ShareCardV2, index: number): BoardItem {
  return {
    bookmarkId: card.u,
    cardId: card.u,
    title: card.t,
    description: card.d,
    thumbnail: card.th,
    url: card.u,
    aspectRatio: card.a,
    gridIndex: index,
    orderIndex: index,
    cardWidth: card.cw,
    customCardWidth: true,
    isRead: false,
    isDeleted: false,
    tags: [],
    displayMode: null,
  }
}
```
**実装時注意:** `BoardItem` の必須フィールドが上記で全て埋まっているか tsc で確認 ([lib/storage/use-board-data.ts:28](../../../lib/storage/use-board-data.ts#L28))。optional (`freePos` / `photos` / `hasVideo` 等) は省略。必須が増えていたら埋める。

- [ ] **Step 4: テスト + tsc**

Run: `rtk vitest run lib/share/share-card-to-board-item && rtk tsc`
Expected: PASS / tsc 0

- [ ] **Step 5: commit**

```bash
rtk git add lib/share/share-card-to-board-item.ts lib/share/share-card-to-board-item.test.ts
rtk git commit -m "feat(share): pure ShareCardV2 to BoardItem mapper for receiver moodboard"
```

---

## Task 4: 取り込み選択の純ロジック

**Files:**
- Create: `lib/share/receiver-selection.ts`
- Test: `lib/share/receiver-selection.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
import { describe, it, expect } from 'vitest'
import { initialIncludeSet, toggleInclude, toggleSenderTag } from './receiver-selection'

describe('receiver-selection', () => {
  it('initialIncludeSet includes all non-duplicate card urls', () => {
    const urls = ['a', 'b', 'c']
    const dups = new Set(['b'])
    expect([...initialIncludeSet(urls, dups)].sort()).toEqual(['a', 'c'])
  })
  it('toggleInclude flips membership', () => {
    const s = new Set(['a'])
    expect(toggleInclude(s, 'a').has('a')).toBe(false)
    expect(toggleInclude(s, 'b').has('b')).toBe(true)
  })
  it('toggleSenderTag adds/removes a tag id for one card', () => {
    const m = new Map<string, Set<string>>()
    const m1 = toggleSenderTag(m, 'cardA', 't1')
    expect([...(m1.get('cardA') ?? [])]).toEqual(['t1'])
    const m2 = toggleSenderTag(m1, 'cardA', 't1')
    expect(m2.get('cardA')?.has('t1')).toBe(false)
  })
})
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `rtk vitest run lib/share/receiver-selection`
Expected: FAIL (関数なし)

- [ ] **Step 3: 実装**

```typescript
/** All non-duplicate card urls start "included" (default = save). */
export function initialIncludeSet(
  cardUrls: ReadonlyArray<string>,
  duplicateUrls: ReadonlySet<string>,
): Set<string> {
  return new Set(cardUrls.filter((u) => !duplicateUrls.has(u)))
}

/** Toggle whether a card is included in the import. Returns a new Set. */
export function toggleInclude(current: ReadonlySet<string>, cardUrl: string): Set<string> {
  const next = new Set(current)
  if (next.has(cardUrl)) next.delete(cardUrl)
  else next.add(cardUrl)
  return next
}

/** Toggle one sender tag id for one card. Returns a new Map (immutable). */
export function toggleSenderTag(
  current: ReadonlyMap<string, Set<string>>,
  cardUrl: string,
  senderTagId: string,
): Map<string, Set<string>> {
  const next = new Map<string, Set<string>>()
  for (const [k, v] of current) next.set(k, new Set(v))
  const set = next.get(cardUrl) ?? new Set<string>()
  if (set.has(senderTagId)) set.delete(senderTagId)
  else set.add(senderTagId)
  next.set(cardUrl, set)
  return next
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run lib/share/receiver-selection`
Expected: PASS

- [ ] **Step 5: commit**

```bash
rtk git add lib/share/receiver-selection.ts lib/share/receiver-selection.test.ts
rtk git commit -m "feat(share): pure receiver import-selection logic (include set + per-card sender tags)"
```

---

## Task 5: CardsLayer に「受け取りモード」を足す

CardsLayer は per-card ラッパー内 ([CardsLayer.tsx:970-989](../../../components/board/CardsLayer.tsx#L970-L989) の CardNode) の周りに再生オーバーレイを重ねている ([1014-1065](../../../components/board/CardsLayer.tsx#L1014-L1065))。同じ場所に受け取りオーバーレイを足し、編集 affordance を抑制する。

**Files:**
- Modify: `components/board/CardsLayer.tsx` (CardsLayerProps に optional props 追加 + per-card 描画にオーバーレイ + 編集抑制)
- Modify: `components/board/CardsLayer.module.css` (or 新規 overlay 用クラス)

- [ ] **Step 1: optional props を CardsLayerProps に追加**

`CardsLayerProps` ([CardsLayer.tsx:199](../../../components/board/CardsLayer.tsx#L199)) の末尾に追加:
```typescript
  /** Receiver moodboard mode (shared-link recipient view). When set, the
   *  board's edit affordances (resize handle, ×/restore corner, drag-reorder,
   *  board tag pills) are suppressed and a per-card receiver overlay is shown
   *  (save toggle + sender-tag chips + grey-out + already-saved ribbon). */
  readonly receiverMode?: {
    /** card urls currently chosen for import (default = all non-duplicates). */
    readonly includedUrls: ReadonlySet<string>
    /** card urls already in the receiver's board → grey + ALREADY SAVED ribbon, not selectable. */
    readonly alreadySavedUrls: ReadonlySet<string>
    /** sender tag dict (id → {n,c}) for rendering suggestion chips. */
    readonly senderTags: import('@/lib/share/types-v2').TagDict
    /** sender tag ids per card (which chips to render for each card). */
    readonly senderTagIdsByCard: ReadonlyMap<string, ReadonlyArray<string>>
    /** chosen sender tag ids per card (which chips are ON; default none). */
    readonly chosenTagsByCard: ReadonlyMap<string, Set<string>>
    readonly onToggleInclude: (cardUrl: string) => void
    readonly onToggleSenderTag: (cardUrl: string, senderTagId: string) => void
  }
```
分割代入 ([301](../../../components/board/CardsLayer.tsx#L301)) に `receiverMode,` を追加。

- [ ] **Step 2: 編集 affordance を receiverMode で抑制**

per-card 描画内で、リサイズハンドル / CardCornerActions (×) / メディアインジケータ等の編集系 JSX を `!receiverMode && (...)` でガード。並び替えドラッグの pointerdown バインドも `receiverMode` 時はスキップ。**実装時、該当 JSX を grep (`CardCornerActions` / `ResizeHandle` / reorder pointer bind) して全て囲う。**

- [ ] **Step 3: 受け取りオーバーレイを per-card に追加**

CardNode の直後 ([989](../../../components/board/CardsLayer.tsx#L989) の後) に、受け取りモード時のオーバーレイを追加:
```tsx
{receiverMode && (() => {
  const url = it.url
  const already = receiverMode.alreadySavedUrls.has(url)
  const included = !already && receiverMode.includedUrls.has(url)
  const chosen = receiverMode.chosenTagsByCard.get(url) ?? new Set<string>()
  const tagIds = receiverMode.senderTagIdsByCard.get(url) ?? []
  return (
    <div
      className={styles.receiverOverlay}
      data-greyed={already || !included ? 'true' : 'false'}
      onPointerDown={(e): void => e.stopPropagation()}
    >
      {already && <span className={styles.alreadyRibbon}>ALREADY SAVED</span>}
      {!already && (
        <button
          type="button"
          className={styles.includeToggle}
          data-on={included ? 'true' : 'false'}
          onClick={(): void => receiverMode.onToggleInclude(url)}
        >{included ? 'SAVE' : 'SKIP'}</button>
      )}
      {!already && tagIds.length > 0 && (
        <div className={styles.senderTagRow}>
          {tagIds.map((tid) => {
            const tag = receiverMode.senderTags[tid]
            if (!tag) return null
            const on = chosen.has(tid)
            return (
              <button key={tid} type="button" className={styles.senderTagChip}
                data-on={on ? 'true' : 'false'}
                onClick={(): void => receiverMode.onToggleSenderTag(url, tid)}
              >{tag.n.toLowerCase()}</button>
            )
          })}
        </div>
      )}
    </div>
  )
})()}
```

- [ ] **Step 4: CSS (CardsLayer.module.css)**

```css
.receiverOverlay { position: absolute; inset: 0; z-index: 40; border-radius: var(--card-radius, 20px); opacity: 0; transition: opacity 140ms; pointer-events: none; }
/* hover で出す: ラッパー hover 時に表示。既存の hover 機構に合わせる (data-hovered or :hover)。 */
.receiverOverlay:hover, [data-hovered='true'] > * > .receiverOverlay { opacity: 1; pointer-events: auto; }
.receiverOverlay[data-greyed='true'] { opacity: 1; pointer-events: auto; background: rgba(0,0,0,0.55); }
.includeToggle { position: absolute; top: 8px; left: 8px; font: 11px ui-monospace, monospace; letter-spacing: .1em; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25); background: rgba(0,0,0,0.5); color: #fff; cursor: pointer; }
.includeToggle[data-on='true'] { background: rgba(40,241,0,0.18); border-color: #28F100; color: #d8ffcf; }
.alreadyRibbon { position: absolute; top: 8px; left: 8px; font: 10px ui-monospace, monospace; letter-spacing: .12em; padding: 4px 8px; border-radius: 6px; background: rgba(255,255,255,0.14); color: rgba(255,255,255,0.85); }
.senderTagRow { position: absolute; left: 8px; right: 8px; bottom: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
.senderTagChip { font: 10px ui-monospace, monospace; letter-spacing: .08em; padding: 3px 8px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.25); background: rgba(0,0,0,0.5); color: rgba(255,255,255,0.85); cursor: pointer; }
.senderTagChip[data-on='true'] { background: rgba(40,241,0,0.18); border-color: #28F100; color: #d8ffcf; }
```
**実装時注意:** hover 表示の正確なセレクタは、CardsLayer の既存 hover 機構 (`hoveredBookmarkId` / `data-hovered`) に合わせる。`mask-image` を click 要素本体に当てない (memory: hit area が縮む)。

- [ ] **Step 5: tsc + 既存テスト regression**

Run: `rtk tsc && rtk vitest run`
Expected: tsc 0 / 既存テスト全 PASS (CardsLayer は optional 追加なので既存呼び出しは無影響)

- [ ] **Step 6: commit**

```bash
rtk git add components/board/CardsLayer.tsx components/board/CardsLayer.module.css
rtk git commit -m "feat(board): add receiver-mode overlay (save toggle, sender tag chips, already-saved ribbon) to CardsLayer"
```

---

## Task 6: SharedBoard 本体 (CardsLayer host + SAVE + 取り込み)

**Files:**
- Create: `components/share/SharedBoard.tsx` + `components/share/SharedBoard.module.css`

ReceiverLanding の boot (fetchShare → sanitize → 自分の既存 url 取得 → 重複判定) を踏襲しつつ、描画を CardsLayer + 受け取りオーバーレイに、footer を左上 SAVE ボタンに置き換える。

- [ ] **Step 1: コンポーネント骨格 (state + boot)**

ReceiverLanding ([components/share/ReceiverLanding.tsx](../../../components/share/ReceiverLanding.tsx)) の以下を流用してコピー:
- `extractShareIdFromPathname` → shareId
- `fetchShare` → `sanitizeShareDataV2`
- `initDB` / `getAllBookmarks` → 既存 url Set → `findDuplicates`
- `containerRef` + ResizeObserver で `containerWidth`

追加 state:
```typescript
const [included, setIncluded] = useState<ReadonlySet<string>>(() => new Set())
const [chosenTags, setChosenTags] = useState<ReadonlyMap<string, Set<string>>>(() => new Map())
const [importing, setImporting] = useState(false)
const [importResult, setImportResult] = useState<{ saved: number; skipped: number } | null>(null)
const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
```
share 取得後に `setIncluded(initialIncludeSet(cards.map(c=>c.u), dups))`。

- [ ] **Step 2: items を mapper で作り CardsLayer に流す**

```tsx
const items = useMemo(
  () => data.cards.map((c, i) => shareCardToBoardItem(c, i)),
  [data.cards],
)
```
CardsLayer を render。**必須 props は read-only 用にスタブ** (no-op handler + 固定値):
- `viewport={{ x:0, y:0, w: containerWidth, h: 0 }}` `viewportWidth={containerWidth}` `cardGapPx={16}`
- `hoveredBookmarkId={hovered}` `onHoverChange={setHovered}`
- `audioActiveId={null}` `onToggleAudio={()=>{}}` `audioVolume={1}` `audioPaused={false}` `onAudioVolumeChange={()=>{}}` `onAudioTogglePause={()=>{}}`
- `spaceHeld={false}`
- `onClick={(url)=>setLightboxUrl(url)}` (= bookmarkId は url)
- `onDrop={()=>{}}` `onDelete={()=>{}}` `onCardResize={()=>{}}` `onCardResizeEnd={()=>{}}` `onCardResetSize={()=>{}}`
- `displayMode={'visual'}` `newlyAddedIds={EMPTY_SET}` `defaultCardWidth={320}` `customWidths={EMPTY_OBJ}`
- `motionEnabled={true}` `matchedBookmarkIds={null}`
- `receiverMode={{ includedUrls: included, alreadySavedUrls: dups, senderTags: data.tags ?? {}, senderTagIdsByCard, chosenTagsByCard: chosenTags, onToggleInclude, onToggleSenderTag }}`

`onToggleInclude`/`onToggleSenderTag` は Task 4 の純関数を呼ぶ:
```typescript
const onToggleInclude = useCallback((url: string) => setIncluded((s) => toggleInclude(s, url)), [])
const onToggleSenderTag = useCallback((url: string, tid: string) => setChosenTags((m) => toggleSenderTag(m, url, tid)), [])
```
`senderTagIdsByCard` は `data.cards` から `Map(c.u → c.tg ?? [])` を useMemo で構築。
**実装時注意:** CardsLayer の必須 props が増減していたら BoardRoot の呼び出し ([BoardRoot.tsx:1805](../../../components/board/BoardRoot.tsx#L1805)) を参照して全部埋める。`EMPTY_SET`/`EMPTY_OBJ` はモジュール定数で安定参照に。

- [ ] **Step 3: 背景タイポ + テーマ**

`SHARED WITH YOU` を背景見出しに。[BoardBackgroundTypography](../../../components/board/BoardBackgroundTypography.tsx) を `variant='static'` + 見出し文字 `SHARED WITH YOU` で render (props は実装時に確認)。テーマは `data.theme ?? DEFAULT_THEME_ID` を保持しつつ、表示はボードと同じ範囲 (現状 default 固定なので追加適用なし)。

- [ ] **Step 4: 左上 SAVE N / M ボタン + 取り込み実行**

```tsx
const includeCount = useMemo(() => [...included].length, [included])
const total = data.cards.length
// button label: `SAVE ${includeCount} / ${total}`
```
取り込みハンドラ (ReceiverTriage の handleYes ロジックを bulk 化):
```typescript
const handleSave = useCallback(async () => {
  setImporting(true)
  try {
    const db = await initDB()
    const receiverTags = await getAllTags(db)
    let saved = 0
    for (const c of data.cards) {
      if (!included.has(c.u)) continue
      const armed = [...(chosenTags.get(c.u) ?? [])]
      const conv = convertSenderTagsForReceiver(armed, data.tags ?? {}, receiverTags)
      const created = new Map<string, string>()
      for (const t of conv.toCreate) {
        const nt = await addTag(db, { name: t.name, color: t.color ?? '#28F100', order: receiverTags.length + created.size })
        created.set(t.senderId, nt.id)
      }
      const finalTagIds = armed
        .map((sid) => conv.existing.get(sid) ?? created.get(sid))
        .filter((x): x is string => Boolean(x))
      await addBookmark(db, {
        url: c.u, title: c.t, description: c.d ?? '', thumbnail: c.th ?? '',
        favicon: '', siteName: '', type: detectUrlType(c.u), tags: finalTagIds,
      })
      saved++
    }
    setImportResult({ saved, skipped: dups.size })
  } finally { setImporting(false) }
}, [data, included, chosenTags, dups])
```
完了後 [BulkImportToast](../../../components/share/BulkImportToast.tsx) を出し、onDismiss で `router.push('/board')`。

- [ ] **Step 5: Lightbox**

クリックで `lightboxUrl` を立て、[Lightbox](../../../components/board/Lightbox.tsx) を render (item は対応する BoardItem、nav は省略可)。**実装時、Lightbox の必須 props を確認** ([Lightbox.tsx:403](../../../components/board/Lightbox.tsx#L403))。最小構成 (item, originRect, onClose) で開く。複雑なら ReceiverLanding の簡易 lightbox を当面流用しても良い (要 user 確認)。

- [ ] **Step 6: tsc + ビルド**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0 / build 成功

- [ ] **Step 7: commit**

```bash
rtk git add components/share/SharedBoard.tsx components/share/SharedBoard.module.css
rtk git commit -m "feat(share): SharedBoard receiver moodboard (real cards, select-to-import, SAVE N/M)"
```

---

## Task 7: ShareEntry 配線 + 旧画面削除

**Files:**
- Modify: `app/(app)/s/ShareEntry.tsx`
- Delete: `components/share/ReceiverTriage.tsx` `.module.css` `.test.tsx`, `components/share/ReceiverLanding.tsx` `.module.css` `.test.tsx`

- [ ] **Step 1: ShareEntry を SharedBoard 固定に**

```tsx
'use client'
import { type ReactElement } from 'react'
import { SharedBoard } from '@/components/share/SharedBoard'

export function ShareEntry(): ReactElement {
  return <SharedBoard />
}
```

- [ ] **Step 2: 旧ファイル削除**

```bash
rtk git rm components/share/ReceiverTriage.tsx components/share/ReceiverTriage.module.css components/share/ReceiverTriage.test.tsx components/share/ReceiverLanding.tsx components/share/ReceiverLanding.module.css components/share/ReceiverLanding.test.tsx
```

- [ ] **Step 3: 参照切れ確認 (tsc) + 残テスト**

Run: `rtk tsc && rtk vitest run`
Expected: tsc 0 / PASS (削除した test 以外)。`/s/<id>/triage` を参照する箇所が残っていないか grep で確認し、あれば除去。

- [ ] **Step 4: commit**

```bash
rtk git add -A
rtk git commit -m "refactor(share): replace receiver landing+triage with single SharedBoard moodboard"
```

---

## Task 8: 実機検証 (Playwright) + デプロイ

- [ ] **Step 1: ローカル/プレビューで共有を1本作る**

送信側で数枚 (動画含む) を共有 → `/s/<id>` を開く。

- [ ] **Step 2: Playwright で確認**

`/tmp/playwright-test-shared-board.js` を書き、`npx -y wrangler@latest pages dev out/` のプレビュー (memory: ローカル wrangler は古い) か本番プレビューに対して:
- 本物カードで masonry が描かれる
- カード hover で SAVE トグル + 送り主タグ chip が出る (既定: SAVE on / タグ off)
- SKIP にするとグレーアウト、`SAVE N/M` の N が減る
- 既存ブクマと重複する url のカードは最初からグレー + `ALREADY SAVED` + 選択不可
- カードクリックで Lightbox が開く
- `SAVE` 押下 → board へ遷移 + toast

Run: `cd <playwright-skill> && node run.js /tmp/playwright-test-shared-board.js`
Expected: 上記すべて観測

- [ ] **Step 3: デプロイ**

```bash
rtk pnpm build
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="receiver moodboard"
```
user に `booklage.pages.dev` の `/s/<新規共有id>` をハードリロードで確認依頼。

---

## Self-Review メモ (この計画の検証)

- spec §2 の判断 D1-D8 を全てタスクで被覆: D1/D2 = Task 6,7 / D3(テーマ) = Task 1,2 / D4(生きた挙動) = Task 5,6 (CardsLayer 再利用) / D5(送り主タグ) = Task 4,5,6 / D6(取り込みトグル+グレー) = Task 4,5 / D7(既保存リボン+除外) = Task 5,6 / D8(SAVE N/M) = Task 6。
- 型整合: `BoardItem` (Task 3) / `receiverMode` props (Task 5) / `initialIncludeSet`・`toggleInclude`・`toggleSenderTag` (Task 4) を Task 6 が一致して使用。
- 既知リスク: Task 5 (CardsLayer 改修) と Task 6 (必須 props スタブ) は実コードの最新形に依存 → 実装時に BoardRoot の呼び出しと CardsLayer の編集 affordance JSX を必ず参照。Lightbox の最小 props は実装時確認 (Task 6 Step 5)。
