# 受け取り画面 = ボード完全一致（計画1: コア・パリティ）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共有受け取り画面 `/s/<id>`（`SharedBoard`）を本物のボード chrome そのままに作り直し、IMPORT ボタン・取り消し線ブロック・×削除・タグ非取り込み・並び順修正・取り込み中インジケーターを入れる。

**Architecture:** `SharedBoard` が本物の chrome 部品（`MotionToggle`/`FilterPill`/`TopHeader`+`ChromeLedToggle`/`TuneTrigger`/`ChromeButton`）を直接描画。除外は「画面上の removedUrls セット」一本。取り込みは `addBookmarkBatch` に**逆順**で投入して送り主の並びを保つ。`BoardRoot` 自体は改造しない（低リスク）。

**Tech Stack:** Next.js App Router / TypeScript strict / Vanilla CSS Modules / GSAP / idb / vitest。

**仕様の正本:** `docs/superpowers/specs/2026-06-01-receiver-board-parity-design.md`。タグ調査: `docs/private/2026-06-01-tag-import-research.md`。

---

## File Structure

- `lib/share/types-v2.ts` — `ShareDataV2.w?` 追加（送り主の基準カード幅）。
- `lib/share/validate-v2.ts` — `w` の zod 検証。
- `lib/share/board-to-share.ts` — `w` 書き出し。
- `components/board/BoardRoot.tsx` — 送信時 `w: cardWidthPx` を渡す（既存 `gap` の隣）。
- `lib/share/receiver-import-order.ts`（新） — 取り込み入力を「送り主先頭が最後＝最上段」に並べる純関数。
- `components/share/SharedBoard.tsx` — レイアウト状態(w/gap/customWidths)再構成、removedUrls、chrome 再構築、IMPORT、インジケーター配線、handleSave 差し替え。
- `components/board/BlockedChrome.tsx`（新）＋ `.module.css` — 取り消し線＋無効ラッパ。
- `components/share/ImportProgressIndicator.tsx`（新）＋ `.module.css` — テーマ駆動の取り込み中表示。
- `components/board/CardsLayer.tsx` — 受け取りモードで×を出す／緑SAVE・タグトグル撤去／送り主タグは読み取り表示。
- `components/board/CardsLayer.module.css` — 不要になった saveFade/saveLabel/alreadyLabel 削除、senderTag を読み取り専用に。

---

## Task 1: 共有スキーマに送り主の基準幅 `w` を足す

**Files:**
- Modify: `lib/share/types-v2.ts`
- Modify: `lib/share/validate-v2.ts`
- Modify: `lib/share/board-to-share.ts`
- Modify: `components/board/BoardRoot.tsx`
- Test: `lib/share/board-to-share.test.ts`

- [ ] **Step 1: 失敗するテストを書く** — `lib/share/board-to-share.test.ts` に追記

```typescript
it('carries the sender default card width as w', () => {
  const data = buildShareDataFromBoard({
    items: [{ bookmarkId: 'b1', url: 'https://e.com', title: 't', aspectRatio: 1, tags: [], cardWidth: 300 }],
    tags: [], filter: null, now: 1, gap: 40, defaultWidth: 267.84,
  })
  expect(data.w).toBe(267.84)
})
```

- [ ] **Step 2: 失敗確認** — Run: `rtk vitest run lib/share/board-to-share.test.ts`。Expected: FAIL（`defaultWidth` がプロパティに無い / `data.w` undefined）。

- [ ] **Step 3: 型に追加** — `lib/share/types-v2.ts` の `ShareDataV2` に、既存 `gap?` の直後へ:

```typescript
  /** Sender's default card width in px (= cardWidthPx). Lets the receiver
   *  rebuild board state so TUNE behaves identically. Optional for
   *  back-compat — old shares fall back to BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX. */
  readonly w?: number
```

- [ ] **Step 4: 検証に追加** — `lib/share/validate-v2.ts` の `shareDataSchema` に `gap` 行の隣へ:

```typescript
  w: z.number().positive().max(2000).optional(),
```

- [ ] **Step 5: 書き出しと引数** — `lib/share/board-to-share.ts`:
  - `BuildShareArgs` に `readonly defaultWidth?: number` を追加（`gap?` の隣）。
  - 戻り値オブジェクトに、`gap` のスプレッドの隣へ:

```typescript
    ...(typeof args.defaultWidth === 'number' ? { w: args.defaultWidth } : {}),
```

- [ ] **Step 6: 送信側で渡す** — `components/board/BoardRoot.tsx` の `buildShareData`（`gap: cardGapPx,` の直後）に追加し、deps に `cardWidthPx` が含まれていることを確認（既に含まれている）:

```typescript
      // Sender's default card width so the receiver reconstructs board state.
      defaultWidth: cardWidthPx,
```

- [ ] **Step 7: テスト通過確認** — Run: `rtk vitest run lib/share/board-to-share.test.ts`。Expected: PASS。

- [ ] **Step 8: 型確認** — Run: `rtk tsc`。Expected: `TypeScript compilation completed`。

- [ ] **Step 9: コミット**

```bash
rtk git add lib/share/types-v2.ts lib/share/validate-v2.ts lib/share/board-to-share.ts components/board/BoardRoot.tsx lib/share/board-to-share.test.ts
rtk git commit -m "feat(share): carry sender default card width (w) in share payload"
```

---

## Task 2: 取り込み順序の純関数 + 並び順修正・タグ非取り込み

送り主の `data.cards`（先頭＝最上段）を、ボードの「orderIndex 降順＝新しいものが上」に合わせて取り込むには、**先頭カードを最後に保存**する＝入力配列を逆順にして `addBookmarkBatch` に渡す。タグは付けない（決定A）。

**Files:**
- Create: `lib/share/receiver-import-order.ts`
- Test: `lib/share/receiver-import-order.test.ts`
- Modify: `components/share/SharedBoard.tsx`（handleSave）

- [ ] **Step 1: 失敗するテストを書く** — `lib/share/receiver-import-order.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { orderForImport } from './receiver-import-order'

describe('orderForImport', () => {
  it('reverses so the sender top card is saved last (= highest orderIndex = top)', () => {
    const visible = ['a', 'b', 'c'] // a = sender top
    expect(orderForImport(visible)).toEqual(['c', 'b', 'a'])
  })
  it('keeps a single card unchanged', () => {
    expect(orderForImport(['only'])).toEqual(['only'])
  })
  it('returns empty for empty input', () => {
    expect(orderForImport([])).toEqual([])
  })
})
```

- [ ] **Step 2: 失敗確認** — Run: `rtk vitest run lib/share/receiver-import-order.test.ts`。Expected: FAIL（module not found）。

- [ ] **Step 3: 実装** — `lib/share/receiver-import-order.ts`

```typescript
/** Order a list of import items so that, after sequential save where each new
 *  bookmark takes the highest orderIndex (board spec: newest = highest =
 *  top, DESC sort), the SENDER'S first/top card ends up on top.
 *
 *  The sender array is top-to-bottom (index 0 = top). Saving in array order
 *  would give index 0 the LOWEST orderIndex → bottom (reversed). Reversing
 *  the array makes the sender's top card save LAST → highest orderIndex → top. */
export function orderForImport<T>(senderTopToBottom: readonly T[]): T[] {
  return [...senderTopToBottom].reverse()
}
```

- [ ] **Step 4: 通過確認** — Run: `rtk vitest run lib/share/receiver-import-order.test.ts`。Expected: PASS。

- [ ] **Step 5: handleSave を差し替え** — `components/share/SharedBoard.tsx`。`addBookmark`/`addTag`/`getAllTags`/`convertSenderTagsForReceiver`/`getAllBookmarks` 由来のタグ処理を撤去し、`addBookmarkBatch` ＋ `orderForImport` ＋ `tags: []` に。import 文も整理（`addBookmarkBatch` を `@/lib/storage/indexeddb` から、`orderForImport` を新 module から追加。未使用になった `addTag`/`getAllTags`/`convertSenderTagsForReceiver` を削除）。新 `handleSave`:

```typescript
  // Bulk import: bookmarks only (no tags — see spec decision A). Visible cards
  // = not removed. Reversed so the sender's top card lands on top.
  const handleSave = useCallback(async (): Promise<void> => {
    if (state.kind !== 'ready') return
    const visible = state.data.cards.filter((c) => !removedUrls.has(c.u))
    if (visible.length === 0) return
    setImportPhase('importing')
    try {
      const db = await initDB()
      const inputs = orderForImport(visible).map((c) => ({
        url: c.u,
        title: c.t,
        description: c.d ?? '',
        thumbnail: c.th ?? '',
        favicon: '',
        siteName: '',
        type: detectUrlType(c.u),
        tags: [] as string[],
      }))
      await addBookmarkBatch(db, inputs)
      setImportPhase('done')
    } catch {
      setImportPhase('idle')
    }
  }, [state, removedUrls])
```

  注: `importPhase` / `removedUrls` は Task 5・8 で定義。Task 順に実装する場合、本ステップは Task 5・8 の state 追加後に tsc が通る。サブエージェント実行では Task 2 のうち Step 1〜4（純関数）を先に commit し、Step 5 は Task 8 内で取り込んでよい。

- [ ] **Step 6: コミット（純関数のみ先行）**

```bash
rtk git add lib/share/receiver-import-order.ts lib/share/receiver-import-order.test.ts
rtk git commit -m "feat(share): receiver import order helper (reverse so sender top stays top)"
```

---

## Task 3: 取り消し線ラッパ `BlockedChrome`

**Files:**
- Create: `components/board/BlockedChrome.tsx`
- Create: `components/board/BlockedChrome.module.css`
- Test: `components/board/BlockedChrome.test.tsx`

- [ ] **Step 1: 失敗するテストを書く** — `components/board/BlockedChrome.test.tsx`

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BlockedChrome } from './BlockedChrome'

describe('BlockedChrome', () => {
  it('wraps children and marks them blocked', () => {
    const { getByTestId } = render(
      <BlockedChrome label="FILTER"><button>FILTER</button></BlockedChrome>,
    )
    const wrap = getByTestId('blocked-chrome')
    expect(wrap.getAttribute('aria-disabled')).toBe('true')
  })
})
```

- [ ] **Step 2: 失敗確認** — Run: `rtk vitest run components/board/BlockedChrome.test.tsx`。Expected: FAIL（module not found）。

- [ ] **Step 3: 実装** — `components/board/BlockedChrome.tsx`

```tsx
'use client'
import { type ReactElement, type ReactNode } from 'react'
import styles from './BlockedChrome.module.css'

/** Wraps a board chrome control so it stays VISIBLE (identical look) but is
 *  struck through and inert — signals "same board, but a receiver view".
 *  Blocks pointer + keyboard by covering with an overlay and disabling hit
 *  testing on the children. */
export function BlockedChrome({
  children,
  label,
}: {
  readonly children: ReactNode
  /** For aria + tooltip; the visible label still comes from children. */
  readonly label?: string
}): ReactElement {
  return (
    <span
      className={styles.wrap}
      data-testid="blocked-chrome"
      aria-disabled="true"
      title={label ? `${label} (not available on a shared view)` : undefined}
    >
      {children}
      <span className={styles.strike} aria-hidden="true" />
    </span>
  )
}
```

- [ ] **Step 4: CSS** — `components/board/BlockedChrome.module.css`

```css
/* Struck-through, inert chrome. Children paint normally (identical look) but
   take no input; a centered hairline draws the strike-through. */
.wrap {
  position: relative;
  display: inline-flex;
  opacity: 0.4;
}
.wrap > :not(.strike) {
  pointer-events: none;
}
.strike {
  position: absolute;
  left: -2px;
  right: -2px;
  top: 50%;
  height: 1px;
  background: currentColor;
  transform: translateY(-0.5px);
  pointer-events: none;
}
```

- [ ] **Step 5: 通過確認** — Run: `rtk vitest run components/board/BlockedChrome.test.tsx`。Expected: PASS。

- [ ] **Step 6: コミット**

```bash
rtk git add components/board/BlockedChrome.tsx components/board/BlockedChrome.module.css components/board/BlockedChrome.test.tsx
rtk git commit -m "feat(board): BlockedChrome wrapper (struck-through + inert chrome)"
```

---

## Task 4: 取り込み中インジケーター `ImportProgressIndicator`（テーマ駆動）

**Files:**
- Create: `components/share/ImportProgressIndicator.tsx`
- Create: `components/share/ImportProgressIndicator.module.css`
- Test: `components/share/ImportProgressIndicator.test.tsx`

動作中ビジュアルはテーマ id で解決。今はデフォルト（音波 SVG）のみ実装し、将来テーマは `WORKING_VISUAL` に追加するだけで増やせる構造。可視性は `phase` の純関数（マウント=表示、`fill:forwards`/`onfinish` で可視性を制御しない＝既存方針 [[feedback_visibility_never_from_animation]]）。

- [ ] **Step 1: 失敗するテストを書く** — `components/share/ImportProgressIndicator.test.tsx`

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ImportProgressIndicator } from './ImportProgressIndicator'

describe('ImportProgressIndicator', () => {
  it('renders nothing when idle', () => {
    const { container } = render(<ImportProgressIndicator phase="idle" themeId="default" />)
    expect(container.firstChild).toBeNull()
  })
  it('shows IMPORTING while importing', () => {
    const { getByText, getByTestId } = render(<ImportProgressIndicator phase="importing" themeId="default" />)
    expect(getByText('IMPORTING')).toBeTruthy()
    expect(getByTestId('import-working-visual')).toBeTruthy()
  })
  it('shows the done check on done', () => {
    const { getByTestId } = render(<ImportProgressIndicator phase="done" themeId="default" />)
    expect(getByTestId('import-done-check')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 失敗確認** — Run: `rtk vitest run components/share/ImportProgressIndicator.test.tsx`。Expected: FAIL（module not found）。

- [ ] **Step 3: 実装** — `components/share/ImportProgressIndicator.tsx`

```tsx
'use client'
import { type ReactElement, type ReactNode } from 'react'
import styles from './ImportProgressIndicator.module.css'

export type ImportPhase = 'idle' | 'importing' | 'done'

/** Theme-driven "working" visual. Add a theme id → element here to make the
 *  indicator change with future themes. Default = sound-wave motif. */
function resolveWorkingVisual(themeId: string): ReactNode {
  void themeId // only the default exists today; switch on themeId when themes grow
  return (
    <svg data-testid="import-working-visual" className={styles.wave} viewBox="0 0 64 24" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={4 + i * 8} y="2" width="4" height="20" rx="2" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </svg>
  )
}

/** Full-canvas import overlay. Mount = visible (visibility is a pure function
 *  of phase, never derived from animation completion). Appear/idle→importing,
 *  during (looping wave), and done (✓) each animate via CSS. */
export function ImportProgressIndicator({
  phase,
  themeId,
}: {
  readonly phase: ImportPhase
  readonly themeId: string
}): ReactElement | null {
  if (phase === 'idle') return null
  return (
    <div className={styles.backdrop} data-phase={phase} role="status" aria-live="polite">
      <div className={styles.panel}>
        {phase === 'importing' ? (
          <>
            {resolveWorkingVisual(themeId)}
            <span className={styles.label}>IMPORTING</span>
          </>
        ) : (
          <svg data-testid="import-done-check" className={styles.check} viewBox="0 0 48 48" aria-hidden="true">
            <path d="M12 25 L21 34 L36 16" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: CSS** — `components/share/ImportProgressIndicator.module.css`

```css
/* Appear: backdrop fades in (matches Lightbox dim). Disappear: handled by the
   parent unmounting after navigation; the done state holds ~600ms first. */
.backdrop {
  position: absolute;
  inset: 0;
  z-index: 300; /* above cards + chrome */
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.62);
  animation: import-backdrop-in 200ms ease-out both;
}
@keyframes import-backdrop-in { from { opacity: 0 } to { opacity: 1 } }

.panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  animation: import-panel-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes import-panel-in { from { opacity: 0; transform: translateY(8px) scale(0.96) } to { opacity: 1; transform: none } }

.label {
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 13px;
  letter-spacing: 0.22em;
  color: rgba(255, 255, 255, 0.92);
  text-transform: uppercase;
}

/* Sound-wave working visual: bars pulse height in a staggered loop. */
.wave { width: 96px; height: 36px; }
.wave rect {
  fill: #28F100;
  transform-box: fill-box;
  transform-origin: center;
  animation: import-wave 900ms ease-in-out infinite;
}
@keyframes import-wave {
  0%, 100% { transform: scaleY(0.35) }
  50% { transform: scaleY(1) }
}

/* Done check: green ✓ with a quick draw-in + glow (app's pill ✓ language). */
.check {
  width: 56px; height: 56px;
  color: #28F100;
  filter: drop-shadow(0 0 8px rgba(40, 241, 0, 0.5));
  animation: import-check-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes import-check-in { from { opacity: 0; transform: scale(0.7) } to { opacity: 1; transform: scale(1) } }

@media (prefers-reduced-motion: reduce) {
  .backdrop, .panel, .wave rect, .check { animation: none; }
}
```

- [ ] **Step 5: 通過確認** — Run: `rtk vitest run components/share/ImportProgressIndicator.test.tsx`。Expected: PASS。

- [ ] **Step 6: コミット**

```bash
rtk git add components/share/ImportProgressIndicator.tsx components/share/ImportProgressIndicator.module.css components/share/ImportProgressIndicator.test.tsx
rtk git commit -m "feat(share): theme-driven import progress indicator (wave -> green check)"
```

---

## Task 5: CardsLayer — 受け取りモードで × を出す／緑SAVE撤去／タグは読み取り表示

現状 `receiverMode` ブロック（`components/board/CardsLayer.tsx` 約 1061-1119）は緑 SAVE フェード＋送り主タグの**トグル**を描画している。これを「読み取り専用タグ＋×ボタン」に置き換える。`receiverMode` の型から取り込み選択系（`includedUrls`/`onToggleInclude`/`chosenTagsByCard`/`onToggleSenderTag`/`alreadySavedUrls`）を外し、`onRemove`/`removedUrls` を入れる。

**Files:**
- Modify: `components/board/CardsLayer.tsx`
- Modify: `components/board/CardsLayer.module.css`

- [ ] **Step 1: receiverMode 型を差し替え** — `components/board/CardsLayer.tsx` の `receiverMode?: { ... }` 定義を:

```typescript
  readonly receiverMode?: {
    /** Cards removed from the working set (× pressed). Hidden from layout by
     *  the caller; passed here so the overlay can no-op on them defensively. */
    readonly removedUrls: ReadonlySet<string>
    /** Sender's tag dictionary (id → { n, c? }) for read-only display. */
    readonly senderTags: Readonly<Record<string, { n: string; c?: string }>>
    /** Sender tag ids per card url. */
    readonly senderTagIdsByCard: ReadonlyMap<string, ReadonlyArray<string>>
    /** × handler: remove this card url from the working set. */
    readonly onRemove: (url: string) => void
  }
```

- [ ] **Step 2: receiverMode 描画ブロックを置き換え** — 約 1061-1119 の `{receiverMode && (() => { ... })()}` を:

```tsx
            {receiverMode && (() => {
              const url = it.url
              const tagIds = receiverMode.senderTagIdsByCard.get(url) ?? []
              return (
                <div className={styles.receiverOverlay} data-visible={hoverActive ? 'true' : 'false'}>
                  {/* Sender tags — READ ONLY (no toggle, no import). Shows the
                      sender's curation as context, matching the board's
                      TagIndicatorStrip look. */}
                  {tagIds.length > 0 && (
                    <div className={styles.senderTagRow}>
                      {tagIds.map((tid) => {
                        const tag = receiverMode.senderTags[tid]
                        if (!tag) return null
                        return <span key={tid} className={styles.senderTag}>{tag.n.toLowerCase()}</span>
                      })}
                    </div>
                  )}
                </div>
              )
            })()}
            {/* × delete (receiver): reuse the board's corner ×, no reset (↺),
                no resize handle. Removes the card from the working set. */}
            {receiverMode && (
              <CardCornerActions
                hovered={hoverActive}
                hasCustomWidth={false}
                onDelete={(): void => receiverMode.onRemove(it.url)}
                onResetSize={(): void => {}}
              />
            )}
```

- [ ] **Step 3: senderTag を button から span の読み取り専用スタイルへ** — `components/board/CardsLayer.module.css`。`.senderTag` の `cursor: pointer` を削除し、`pointer-events: none` を追加。`.senderTag[data-on='true']`（緑トグル）と `.saveFade`/`.saveLabel`/`.alreadyLabel`（緑 SAVE フェード一式）の CSS を**削除**（受け取りで未使用になったため）。`.senderTagRow` は Task 維持（中央寄せでなく既存の左上配置）。

- [ ] **Step 4: 型確認** — Run: `rtk tsc`。Expected: `TypeScript compilation completed`（`SharedBoard.tsx` 側は Task 7 で receiverMode props を新形へ更新するため、その前に tsc を通すなら本 Task と Task 7 を連続実装する。サブエージェント実行では Task 5・7 を1ペアで扱う）。

- [ ] **Step 5: コミット**

```bash
rtk git add components/board/CardsLayer.tsx components/board/CardsLayer.module.css
rtk git commit -m "feat(board): receiver cards use read-only sender tags + corner x-delete (drop green SAVE)"
```

---

## Task 6: SharedBoard — ボード状態の再構成 + removedUrls + 可視カード

**Files:**
- Modify: `components/share/SharedBoard.tsx`

- [ ] **Step 1: import 追加** — `import { BOARD_SLIDERS }`（既存）に加え、必要なら無し。state を追加（既存 state 群の隣）:

```typescript
  const [removedUrls, setRemovedUrls] = useState<ReadonlySet<string>>(EMPTY_SET)
  const [cardWidthPx, setCardWidthPx] = useState<number>(BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX)
  const [bgTypoEnabled, setBgTypoEnabled] = useState<boolean>(true)
  const [motionEnabled, setMotionEnabled] = useState<boolean>(true)
  const [importPhase, setImportPhase] = useState<'idle' | 'importing' | 'done'>('idle')
  const onRemoveCard = useCallback((url: string): void => {
    setRemovedUrls((s) => { const n = new Set(s); n.add(url); return n })
  }, [])
```

- [ ] **Step 2: ready で送り主の幅/間隔を取り込む** — fetch 成功後（`setState({ kind: 'ready', data })` の前）に:

```typescript
      setCardWidthPx(data.w ?? BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX)
```

  `gapPx` は既存の `useMemo`（`data.gap ?? RECEIVER_FALLBACK_GAP_PX`）を維持。

- [ ] **Step 3: 可視カードに絞る** — `items`/`customWidths`/`senderTagIdsByCard`/`spacerHeight` の元になる `state.data.cards` を、`removedUrls` を除いた配列に差し替える。新 memo:

```typescript
  const visibleCards = useMemo(
    () => (state.kind === 'ready' ? state.data.cards.filter((c) => !removedUrls.has(c.u)) : []),
    [state, removedUrls],
  )
```

  そして `items` を `visibleCards.map((c, i) => shareCardToBoardItem(c, i))`、`customWidths` を `Object.fromEntries(visibleCards.map((c) => [c.u, c.cw]))`、`senderTagIdsByCard` を `visibleCards` ベースに変更。`defaultCardWidth` は `cardWidthPx` を渡す（固定値 `RECEIVER_DEFAULT_CARD_WIDTH` をやめる）。

- [ ] **Step 4: 型確認** — Run: `rtk tsc`。Expected: PASS（receiverMode props は Task 7 で更新）。

- [ ] **Step 5: コミット**

```bash
rtk git add components/share/SharedBoard.tsx
rtk git commit -m "feat(share): receiver board state (width/gap), removedUrls, visible-card derivation"
```

---

## Task 7: SharedBoard — 本物 chrome の描画 + IMPORT + receiverMode 新props + インジケーター配線

**Files:**
- Modify: `components/share/SharedBoard.tsx`

- [ ] **Step 1: import 追加**

```typescript
import { TopHeader } from '@/components/board/TopHeader'
import { MotionToggle } from '@/components/board/MotionToggle'
import { ChromeLedToggle } from '@/components/board/ChromeLedToggle'
import { TuneTrigger } from '@/components/board/TuneTrigger'
import { ChromeButton } from '@/components/board/ChromeButton'
import { BlockedChrome } from '@/components/board/BlockedChrome'
import { FilterPill } from '@/components/board/FilterPill'
import { ImportProgressIndicator } from './ImportProgressIndicator'
import { addBookmarkBatch } from '@/lib/storage/indexeddb'
import { orderForImport } from '@/lib/share/receiver-import-order'
```

  注: `FilterPill` は props が多い。受け取りでは `BlockedChrome` で包み無効化するので、最小の no-op props（`activeFilter`＝all、`tags=[]`、各ハンドラ no-op）で描画する。`FilterPill` の必須 props は実装時に `components/board/FilterPill.tsx` の型を確認して埋める（全ハンドラは `NOOP`）。読み出しテキストは共有の総数を出す。

- [ ] **Step 2: 旧 SAVE chrome を撤去し、上帯＋TopHeader を組む** — `return (<div className={frame.outerFrame}...>` の中身を再構成。外側帯（`frame.frameTopChrome` を流用、ただし右寄せの本物位置）に `[IMPORT] [MOTION] [Blocked FilterPill]`、その下に `<TopHeader actions={...}>`。`canvas` 内の旧 `styles.saveChrome` ボタンは削除。IMPORT ボタン:

```tsx
        <ChromeButton
          label={`IMPORT ${visibleCards.length} TO YOUR BOARD`}
          onClick={(): void => { void handleSave() }}
          disabled={visibleCards.length === 0 || importPhase !== 'idle'}
          data-testid="import-button"
        />
```

  TopHeader actions:

```tsx
        <TopHeader
          actions={
            <>
              <ChromeLedToggle label="TITLE" on={bgTypoEnabled} onToggle={(): void => setBgTypoEnabled((v) => !v)} />
              <TuneTrigger
                widthPx={cardWidthPx}
                gapPx={gapPx}
                onChangeWidth={setCardWidthPx}
                onChangeGap={setGapPx}
                onReset={(): void => { setCardWidthPx(state.data.w ?? BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX); setGapPx(state.data.gap ?? RECEIVER_FALLBACK_GAP_PX) }}
                onApplyPreset={({ w, g }: { w: number; g: number }): void => { setCardWidthPx(w); setGapPx(g) }}
              />
              <BlockedChrome label="MANAGE TAGS"><ChromeButton label="MANAGE TAGS" onClick={(): void => {}} /></BlockedChrome>
              <BlockedChrome label="POP OUT"><ChromeButton label="POP OUT" onClick={(): void => {}} /></BlockedChrome>
              {/* SHARE は計画2で実装。それまでは BlockedChrome で包む */}
              <BlockedChrome label="SHARE"><ChromeButton label="SHARE" onClick={(): void => {}} /></BlockedChrome>
            </>
          }
        />
```

  注: `gapPx` は現在 `useMemo` で読み取り専用。TUNE で変えるため `useState` に変更する（Task 6 の state 群へ `const [gapPx, setGapPx] = useState(RECEIVER_FALLBACK_GAP_PX)` を追加し、ready 時に `setGapPx(data.gap ?? RECEIVER_FALLBACK_GAP_PX)`）。`onApplyPreset` の引数形は実装時に `TuneTrigger.tsx` の型に合わせる。

- [ ] **Step 3: CardsLayer の receiverMode を新 props へ** — `motionEnabled`、`defaultCardWidth={cardWidthPx}`、`cardGapPx={gapPx}`、`sourceCardId={lightboxSourceId}`（既存）に加え:

```tsx
              receiverMode={{
                removedUrls,
                senderTags: data.tags ?? {},
                senderTagIdsByCard,
                onRemove: onRemoveCard,
              }}
```

  `motionEnabled={true}` を `motionEnabled={motionEnabled}` に変更。背景タイポは `bgTypoEnabled && <div className={styles.bgTypo}>…`。

- [ ] **Step 4: handleSave を Task 2 Step 5 の内容に差し替え**（`addBookmarkBatch` + `orderForImport` + `tags:[]`）。完了アニメ後にボードへ:

```typescript
  // After the done-check holds briefly, navigate to the board.
  useEffect((): (() => void) | undefined => {
    if (importPhase !== 'done') return undefined
    const t = window.setTimeout(() => router.push('/board'), 900)
    return (): void => window.clearTimeout(t)
  }, [importPhase, router])
```

- [ ] **Step 5: インジケーターを描画** — `frame.canvas` の末尾（ScrollMeter の後）に:

```tsx
        <ImportProgressIndicator phase={importPhase} themeId={themeId} />
```

  取り込み中は他操作ロック: `importPhase !== 'idle'` のとき chrome 行に `pointer-events: none` を当てる（外側帯と TopHeader を包む要素へ inline style もしくは data 属性 + CSS）。インジケーターの backdrop（z 300）が canvas 内操作を覆う。

- [ ] **Step 6: 旧 BulkImportToast 経路を撤去** — `importResult`/`BulkImportToast` を使っていた古い完了 UI を削除（インジケーターの done→遷移に統一）。未使用 import（`BulkImportToast` 等）を削除。

- [ ] **Step 7: 型・テスト・ビルド** — Run: `rtk tsc` → PASS。`rtk vitest run components/share lib/share` → PASS。`rtk pnpm build` → 成功。

- [ ] **Step 8: コミット**

```bash
rtk git add components/share/SharedBoard.tsx
rtk git commit -m "feat(share): receiver renders real board chrome + IMPORT button + progress indicator; blocks filter/manage/popout"
```

---

## Task 8: 実機確認（本番デプロイ → playwright データ確認）

**Files:** なし（検証）

- [ ] **Step 1: デプロイ**

```bash
rtk pnpm build
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="session-98 receiver board parity: real chrome, IMPORT, blocked controls, x-delete, order fix, indicator"
```

- [ ] **Step 2: 新規共有を作って確認** — `C:/Users/masay/AppData/Local/Temp/playwright-recv-verify.js` を流用して新 ID を作り、`playwright-probe.js <id>` で「4列・IMPORT ボタン・× で枚数が減る・送り主タグが読み取り表示」をデータで確認。スクショは最小限。

- [ ] **Step 3: ユーザーに本番確認を依頼** — `booklage.pages.dev/s/<id>` をハードリロード。IMPORT 押下→インジケーター→ボード遷移→**送り主の順そのまま・最上段**を確認してもらう。

---

## Self-Review（記録）

- **Spec coverage**: 決定1(chrome流用)=Task7 / 2(IMPORT)=Task7 / 3(取消線)=Task3+7 / 4(TITLE・TUNE・MOTION有効)=Task7、SHARE=計画2 / 5(×一本・タグ非取り込み・タグ読み取り)=Task5+2 / 6(インジケーター)=Task4+7 / 7(並び順)=Task2 / 8(スキーマw)=Task1。SHARE再共有のみ**計画2**へ分離（明示）。
- **Placeholder scan**: 主要コードは実体を記載。`FilterPill`/`TuneTrigger` の props 形は「実装時に当該ファイルの型を確認して埋める」と明示（巨大 props のため全列挙は避けるが、参照先を特定済み）。
- **Type consistency**: `receiverMode` 新型（removedUrls/senderTags/senderTagIdsByCard/onRemove）を Task5(定義)→Task7(供給)で一致。`importPhase` 'idle'|'importing'|'done' を Task6/7 と Task4 の `ImportPhase` で一致。`orderForImport` を Task2 定義→Task2/7 使用で一致。

## 依存・実装順の注意
- Task5 と Task7 は `receiverMode` の型と供給で対になる。サブエージェント実行では **Task5→Task7 を連続**で。
- Task6→Task7 も state を共有。Task1→Task6（`data.w` 読み取り）の順序を守る。

## 非対象（計画2へ）
- SHARE 再共有（`SenderShareModal` 流用＋受け取り可視カードからの共有作成・ミラー描画配線）。
