# CUTOUT MVP: なげなわ切り抜きコラージュ（clipart.studio 型・手動）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** コラージュを並べる画面（SHARE の ARRANGE、PC・スマホ・タブレット共通）で、カードの画像の欲しい部分だけを指/マウスで縁をなぞって切り抜けるようにする。切り抜き済みカードはそのままコラージュ要素として動かす・回す・重ねる・撮影できる。

**Architecture:** 切り抜きは「画像の複製」ではなく**「形」だけ**を持つ。なげなわの線を 0..1 正規化多角形 `CutoutShape` として**ブックマーク本体（IDB `BookmarkRecord.cutout`）に保存**し、適用は純関数 `cutoutClipPath(shape)`（CSS `clip-path: polygon(…%)` を返す）**一本**に集約する。コラージュ（CollageCanvas）はカード面ラッパーにこの 1 style を足すだけ。切り抜き操作は専用の全画面オーバーレイ `CutoutOverlay`（画像を大きく表示 → なぞる → CUT）で行い、小さいカードの上で直接描く無理をしない。**撮影系・共有データ形式 v2・受け取り画面は一切変更しない**（切り抜きは撮影画像に写る。それが作品）。

**将来のボード拡張（ユーザー要望 s187: 「あとから追加が容易に」）:** データはブックマーク本体にあり `BoardItem.cutout` として**ボードにも既に流れる**設計にする。将来「ボードでも切り抜き表示」をやる場合は、ボード側のカード描画に `cutoutClipPath` を 1 行足して設定でゲートするだけ（このMVPでは適用しない。ボードは整理棚＝グリッドの気持ちよさを守る、がユーザー確定方針）。`CutoutOverlay` も自立部品なのでボードから開ける。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / vitest（fake-indexeddb あり）/ Playwright

**前提（依存）:** N-58 段階1（`2026-07-11-n58-mobile-collage-editing.md`）実装後を推奨（スマホの編集段が開いていること）。デスクトップの arrange だけなら段階1なしでも動くが、検証はデスクトップ経路（SELECT ALL → ARRANGE）で行う。段階2（ピンチズーム）とは独立（ズームは wrapper の transform なので clip-path と干渉しない）。

## 設計判断（ユーザー合意済み s187）

- **案A採用**: 切り抜きはコラージュ側だけの道具。ふだんのボードには適用しない。作品として残るのは共有リンクと画像。
- **形はカードごとに記憶**（IDB 永続）。次のコラージュでも同じカードは切り抜き済みで出る。形を捨てれば元の四角に戻る。
- **1 カード = 1 切り抜き**（やり直し自由）。1 枚から複数部品は「素材箱」構想（後段・AI 背景除去と同時に検討）。
- **AI 自動切り抜きはスコープ外**（IDEAS.md s186 (b)。この計画は (a) 手動のみ）。
- **画像のないカード（文字カード等）には切り抜きボタンを出さない**。
- この機能は PC の arrange 画面にも UI（✂ボタン）を足す＝**意図されたデスクトップ変更**（「デスクトップ1px不変」はモバイル対応作業の恒久ルールであり、承認済み新機能には適用しない。ただし**ボードのグリッド描画は不変**）。
- DB は**版数を上げない**: `cutout` は optional field の追加のみ（migration 不要。v16 のまま）。

## Global Constraints

- TypeScript `strict: true`。`any` 禁止。return type 明示。CSS は `.module.css`。Tailwind / Framer Motion 禁止
- z-index は `BOARD_Z_INDEX` に定数追加（`CUTOUT_OVERLAY: 407` — CHROME_DRAWER(405) の上・ONBOARDING_SPOTLIGHT_RING(410) 未満）
- UI 文言は英語・乾いた事実調（`CUT` / `RESET` / `REMOVE CUTOUT` / `CANCEL` / `TRACE AROUND THE PART YOU WANT`）。i18n キーは足さない
- 押せるものは 36px 以上（オーバーレイのボタンは 44px）
- **撮影系ファイル（capture-collage / mobile-band / render-share-image 系）と共有データ形式 v2 は一切変更しない**
- `setPointerCapture` は try/catch（既存慣行）
- git は `rtk` 前置。`--no-verify` 絶対禁止。vitest は `rtk npx vitest run <file>`、Playwright は素の `npx playwright test`

## 事実の索引（s187 調査済み）

- `BookmarkRecord`: `lib/storage/indexeddb.ts:17-97`。最後の field は `onboardingDemo?: boolean`（L94-96）。**optional field 追加に DB_VERSION bump は不要**（v13 mediaSlots 等の bump は backfill/migration のため）
- persist の型: `persistMediaSlots`（indexeddb.ts:1249-1279）＝ `db.get('bookmarks', id)` → 変更なしなら return → `{ ...existing, 新field }` を `db.put`。**これを写す**
- `BoardItem`: `lib/storage/use-board-data.ts:30-74`（最後は `onboardingDemo?: boolean` L71-73）。record→item の写像は同ファイル L145-153（`onboardingDemo: b.onboardingDemo,` が L152）
- useBoardData の persist コールバックの型: `persistMediaSlots`（use-board-data.ts:588-604）＝ IDB 書き込み → `setItems` で該当 item を即時更新。戻り値オブジェクトと型宣言（L197-204 付近）にも足す。**これを写す**
- BoardRoot の useBoardData 分割代入: BoardRoot.tsx L213-228（`persistMediaSlots,` が L216、`} = useBoardData()` が L228）
- `CollageCanvas.tsx`: 各要素は L166-279 の map。要素 div の inline style L181-201（`['--card-radius']` あり）。中身は `<CardNode>`（L207-217）→ paper 装飾（L221-223）→ 回転ハンドル `styles.rotateHandle`（L228-257、`top:-48px`・`data-no-capture`・hover/touch 表示切替は module.css L44-76）→ `<ResizeHandle>`（L263-276）。**clip は CardNode だけを包む内側ラッパーに掛ける**（要素 div に掛けると外に飛び出た回転ノブ・✂ボタンごと切れて消える）
- 画像の優先順位（撮影・実測 s175 の系譜）: `mediaSlots[0].url` → `photos[0]` → `thumbnail`。BoardItem は 3 つとも持っている（L35, L62, L66）
- Esc の罠: sharePhase 非 null の間、window keydown Esc → `handleExitShareMode`（BoardRoot.tsx:2279-2286）。**オーバーレイの Esc は capture 相で先取りして stopPropagation** しないと SHARE ごと閉じる
- e2e の作法: デスクトップは `SELECT ALL` → `ARRANGE`（memory `reference_playwright_board_share_verify`）。カードタップは `setPointerCapture` で Playwright 駆動不可
- vitest: `tests/lib/indexeddb.test.ts` が `fake-indexeddb/auto` + `initDB()` の確立済みパターン（L1-40）
- BOARD_Z_INDEX 全定数: `lib/board/constants.ts:82-119`。407 は空き

---

### Task 1: 純関数 `lib/board/cutout.ts`（形の正規化・clip-path 生成・画像源） 【Haiku 可】

**Files:**
- Create: `lib/board/cutout.ts`
- Test: `lib/board/cutout.test.ts`

**Interfaces:**
- Produces:
  - `type CutoutPoint = { readonly x: number; readonly y: number }`（0..1 正規化）
  - `type CutoutShape = { readonly points: readonly CutoutPoint[] }`（3 点以上・暗黙に閉じる）
  - `normalizeLassoPoints(raw, box): CutoutShape | null`（画面 px のなぞり跡 → 正規化。間引き・クランプ・点数上限）
  - `cutoutClipPath(shape): string`（`polygon(x% y%, …)`）
  - `cutoutSourceImage(item): string | null`（mediaSlots[0].url → photos[0] → thumbnail。空文字は null）

- [ ] **Step 1: Write the failing test**

`lib/board/cutout.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  CUTOUT_MAX_POINTS,
  cutoutClipPath,
  cutoutSourceImage,
  normalizeLassoPoints,
} from './cutout'

const BOX = { left: 100, top: 50, width: 400, height: 200 }

describe('normalizeLassoPoints', () => {
  it('normalizes screen points into the 0..1 image box', () => {
    const shape = normalizeLassoPoints(
      [
        { x: 100, y: 50 },   // 左上角 → (0,0)
        { x: 500, y: 50 },   // 右上角 → (1,0)
        { x: 300, y: 250 },  // 下辺中央 → (0.5,1)
      ],
      BOX,
    )
    expect(shape).not.toBeNull()
    expect(shape?.points[0]).toEqual({ x: 0, y: 0 })
    expect(shape?.points[1]).toEqual({ x: 1, y: 0 })
    expect(shape?.points[2]).toEqual({ x: 0.5, y: 1 })
  })

  it('clamps points outside the box onto its edge', () => {
    const shape = normalizeLassoPoints(
      [
        { x: 0, y: 0 },      // 箱の外（左上） → (0,0)
        { x: 900, y: 300 },  // 箱の外（右下） → (1,1)
        { x: 300, y: 50 },
      ],
      BOX,
    )
    expect(shape?.points[0]).toEqual({ x: 0, y: 0 })
    expect(shape?.points[1]).toEqual({ x: 1, y: 1 })
  })

  it('drops near-duplicate consecutive points and returns null when fewer than 3 remain', () => {
    expect(
      normalizeLassoPoints(
        [
          { x: 100, y: 50 },
          { x: 100.5, y: 50.2 }, // ほぼ同一点 → 間引き
          { x: 101, y: 50.1 },   // 同上
        ],
        BOX,
      ),
    ).toBeNull()
  })

  it('caps the polygon at CUTOUT_MAX_POINTS by uniform sampling', () => {
    const raw = Array.from({ length: 2000 }, (_, i) => ({
      x: 100 + 400 * Math.abs(Math.sin(i / 3)),
      y: 50 + 200 * Math.abs(Math.cos(i / 7)),
    }))
    const shape = normalizeLassoPoints(raw, BOX)
    expect(shape).not.toBeNull()
    expect(shape!.points.length).toBeLessThanOrEqual(CUTOUT_MAX_POINTS)
    expect(shape!.points.length).toBeGreaterThanOrEqual(3)
  })

  it('returns null for a degenerate box', () => {
    expect(normalizeLassoPoints([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }], { left: 0, top: 0, width: 0, height: 100 })).toBeNull()
  })
})

describe('cutoutClipPath', () => {
  it('renders a percentage polygon (scales with any card size)', () => {
    expect(cutoutClipPath({ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }] })).toBe(
      'polygon(0% 0%, 100% 0%, 50% 100%)',
    )
  })
  it('rounds to 4 decimals', () => {
    expect(cutoutClipPath({ points: [{ x: 0.123456, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] })).toBe(
      'polygon(12.3456% 0%, 100% 0%, 0% 100%)',
    )
  })
})

describe('cutoutSourceImage', () => {
  it('prefers mediaSlots[0].url, then photos[0], then thumbnail', () => {
    expect(
      cutoutSourceImage({ mediaSlots: [{ type: 'photo', url: 'https://m/1.jpg' }], photos: ['https://p/1.jpg'], thumbnail: 'https://t/1.jpg' }),
    ).toBe('https://m/1.jpg')
    expect(cutoutSourceImage({ photos: ['https://p/1.jpg'], thumbnail: 'https://t/1.jpg' })).toBe('https://p/1.jpg')
    expect(cutoutSourceImage({ thumbnail: 'https://t/1.jpg' })).toBe('https://t/1.jpg')
  })
  it('returns null for imageless cards (no scissors button)', () => {
    expect(cutoutSourceImage({})).toBeNull()
    expect(cutoutSourceImage({ thumbnail: '' })).toBeNull()
    expect(cutoutSourceImage({ mediaSlots: [], photos: [], thumbnail: '' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
rtk npx vitest run lib/board/cutout.test.ts
```

- [ ] **Step 3: Implement**

`lib/board/cutout.ts`:

```ts
/** CUTOUT MVP: なげなわ切り抜きの「形」。画像は複製せず、画像ボックス基準の
 *  0..1 正規化多角形だけを持つ（BookmarkRecord.cutout に永続）。
 *  適用はこのファイルの cutoutClipPath 一本に集約する — コラージュが使い、
 *  将来ボード表示に広げるときもボード側がこれを 1 行呼ぶだけ（s187 ユーザー要望）。 */

import type { MediaSlot } from '@/lib/embed/types'

export type CutoutPoint = {
  readonly x: number
  readonly y: number
}

export type CutoutShape = {
  /** 3 点以上。多角形は暗黙に閉じる（最後の点と最初の点が結ばれる）。 */
  readonly points: readonly CutoutPoint[]
}

export const CUTOUT_MIN_POINTS = 3
/** clip-path 文字列の肥大と IDB レコードサイズを抑える点数上限。 */
export const CUTOUT_MAX_POINTS = 300
/** これ未満の間隔（箱対角比）の連続点は間引く — 手ぶれノイズ対策。 */
const MIN_STEP_RATIO = 0.005

export type CutoutBox = {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
const round4 = (v: number): number => Math.round(v * 10000) / 10000

/** 画面 px のなぞり跡を、画像ボックス基準の 0..1 多角形へ。
 *  箱が潰れている・有効点が 3 点未満なら null（＝切り抜き不成立）。 */
export function normalizeLassoPoints(
  raw: readonly { readonly x: number; readonly y: number }[],
  box: CutoutBox,
): CutoutShape | null {
  if (box.width <= 0 || box.height <= 0) return null
  const minStep = MIN_STEP_RATIO * Math.hypot(box.width, box.height)
  const kept: CutoutPoint[] = []
  let last: { x: number; y: number } | null = null
  for (const p of raw) {
    if (last !== null && Math.hypot(p.x - last.x, p.y - last.y) < minStep) continue
    last = { x: p.x, y: p.y }
    kept.push({
      x: round4(clamp01((p.x - box.left) / box.width)),
      y: round4(clamp01((p.y - box.top) / box.height)),
    })
  }
  if (kept.length < CUTOUT_MIN_POINTS) return null
  if (kept.length <= CUTOUT_MAX_POINTS) return { points: kept }
  // 上限超えは等間隔サンプリングで間引く（形の大勢は保たれる）
  const step = kept.length / CUTOUT_MAX_POINTS
  const sampled: CutoutPoint[] = []
  for (let i = 0; i < CUTOUT_MAX_POINTS; i++) sampled.push(kept[Math.floor(i * step)])
  return { points: sampled }
}

/** CSS clip-path 値。% 基準なのでカードがどんな大きさに変わっても追従する。 */
export function cutoutClipPath(shape: CutoutShape): string {
  const pts = shape.points.map((p) => `${round4(p.x * 100)}% ${round4(p.y * 100)}%`)
  return `polygon(${pts.join(', ')})`
}

/** 切り抜き対象として見せる画像（カードが表示している画像と同じ優先順位:
 *  mediaSlots[0].url → photos[0] → thumbnail — s175 撮影実測の系譜）。
 *  null = 画像なし（✂ボタンを出さない）。 */
export function cutoutSourceImage(item: {
  readonly mediaSlots?: readonly MediaSlot[]
  readonly photos?: readonly string[]
  readonly thumbnail?: string
}): string | null {
  const fromSlots = item.mediaSlots && item.mediaSlots.length > 0 ? item.mediaSlots[0].url : ''
  const src = fromSlots || (item.photos && item.photos.length > 0 ? item.photos[0] : '') || item.thumbnail || ''
  return src === '' ? null : src
}
```

- [ ] **Step 4: Run to verify it passes → Commit**

```bash
rtk npx vitest run lib/board/cutout.test.ts
rtk git add lib/board/cutout.ts lib/board/cutout.test.ts
rtk git commit -m "feat(board): cutout shape math — normalized lasso polygon + clip-path (CUTOUT MVP)"
```

---

### Task 2: 保存の器 — BookmarkRecord.cutout / persistCutout / BoardItem 流し込み 【Sonnet 推奨（3ファイルの型繋ぎ）】

**Files:**
- Modify: `lib/storage/indexeddb.ts`
- Modify: `lib/storage/use-board-data.ts`
- Test: `tests/lib/indexeddb.test.ts`（既存に追記）

**Interfaces:**
- Consumes: Task 1 の `CutoutShape`
- Produces:
  - `BookmarkRecord.cutout?: CutoutShape` / `BoardItem.cutout?: CutoutShape`
  - indexeddb: `persistCutout(db, bookmarkId, cutout: CutoutShape | null): Promise<void>`（null = 解除）
  - useBoardData 戻り値: `persistCutout: (bookmarkId: string, cutout: CutoutShape | null) => Promise<void>`（IDB 書き込み＋items 即時反映）

- [ ] **Step 1: Write the failing test**

`tests/lib/indexeddb.test.ts` に describe を追記（同ファイルの既存 import に `persistCutout` を足す）:

```ts
describe('cutout persistence (CUTOUT MVP)', () => {
  it('persists, replaces, and clears the cutout shape without a DB version bump', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    const saved = await addBookmark(database, {
      url: 'https://example.com/cut', title: 'Cut', description: '',
      thumbnail: 'https://example.com/t.jpg', favicon: '', siteName: 'Example', type: 'website', tags: [],
    })
    const shape = { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }] }
    await persistCutout(database, saved.id, shape)
    let all = await getAllBookmarks(database)
    expect(all.find((b) => b.id === saved.id)?.cutout).toEqual(shape)

    const shape2 = { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] }
    await persistCutout(database, saved.id, shape2)
    all = await getAllBookmarks(database)
    expect(all.find((b) => b.id === saved.id)?.cutout).toEqual(shape2)

    await persistCutout(database, saved.id, null)
    all = await getAllBookmarks(database)
    expect(all.find((b) => b.id === saved.id)?.cutout).toBeUndefined()
  })

  it('ignores unknown bookmark ids', async () => {
    const database = await initDB()
    db = database as unknown as IDBPDatabase<unknown>
    await expect(persistCutout(database, 'no-such-id', { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] })).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
rtk npx vitest run tests/lib/indexeddb.test.ts
```

- [ ] **Step 3: Implement — indexeddb.ts**

1. import に追加: `import type { CutoutShape } from '@/lib/board/cutout'`
2. `BookmarkRecord` の `onboardingDemo?: boolean`（L94-96）の直後・閉じ `}` の前に追加:

```ts
  /** CUTOUT MVP: なげなわ切り抜きの形（画像ボックス基準 0..1 の正規化多角形）。
   *  undefined = 切り抜きなし。画像は複製しない（形だけ）。適用はコラージュ
   *  （SHARE arrange）のみ。将来ボード表示にも広げられるよう record 本体に持つ
   *  （適用関数は lib/board/cutout.ts の cutoutClipPath 一本）。optional 追加
   *  なので DB_VERSION bump 不要。 */
  cutout?: CutoutShape
```

3. `persistMediaSlots`（L1249-1279）の直後に追加:

```ts
/**
 * なげなわ切り抜きの形を保存する（CUTOUT MVP）。null で解除（undefined に戻す）。
 * persistMediaSlots と同じ型: get → 変化なしなら no-op → put。
 */
export async function persistCutout(
  db: IDBPDatabase<AllMarksDB>,
  bookmarkId: string,
  cutout: CutoutShape | null,
): Promise<void> {
  const existing = await db.get('bookmarks', bookmarkId)
  if (!existing) return
  const next = cutout === null || cutout.points.length < 3 ? undefined : cutout
  if (JSON.stringify(existing.cutout) === JSON.stringify(next)) return
  const updated: BookmarkRecord = { ...existing, cutout: next }
  await db.put('bookmarks', updated)
}
```

- [ ] **Step 4: Implement — use-board-data.ts**

1. import に追加: `import type { CutoutShape } from '@/lib/board/cutout'` と、indexeddb import 行に `persistCutout as persistCutoutDb`
2. `BoardItem` の `onboardingDemo?: boolean`（L71-73）の直後に追加:

```ts
  /** CUTOUT MVP: 切り抜きの形。コラージュ（SHARE arrange）が clip-path として
   *  適用する。ボードのグリッド描画では未使用（将来の拡張余地として流している）。 */
  readonly cutout?: CutoutShape
```

3. record→item 写像（L145-153）の `onboardingDemo: b.onboardingDemo,` の次の行に `cutout: b.cutout,` を追加
4. 戻り値の型宣言（L197-204 付近、`persistMediaSlots:` の宣言の近く）に追加:

```ts
  /** なげなわ切り抜きの形を保存（null=解除）。IDB 書き込み＋items 即時反映。 */
  persistCutout: (bookmarkId: string, cutout: CutoutShape | null) => Promise<void>
```

5. `persistMediaSlots` コールバック（L588-604）の直後に追加（同じ型を写す）:

```ts
  const persistCutout = useCallback(
    async (bookmarkId: string, cutout: CutoutShape | null): Promise<void> => {
      const db = dbRef.current
      if (!db || !bookmarkId) return
      await persistCutoutDb(db as Parameters<typeof persistCutoutDb>[0], bookmarkId, cutout)
      const next = cutout === null || cutout.points.length < 3 ? undefined : cutout
      setItems((prev) =>
        prev.map((it) => (it.bookmarkId === bookmarkId ? { ...it, cutout: next } : it)),
      )
    },
    [],
  )
```

6. hook の return オブジェクトに `persistCutout,` を追加（`persistMediaSlots,` の隣）。

- [ ] **Step 5: Run to verify it passes → Commit**

```bash
rtk npx vitest run tests/lib/indexeddb.test.ts
rtk tsc
rtk git add lib/storage/indexeddb.ts lib/storage/use-board-data.ts tests/lib/indexeddb.test.ts
rtk git commit -m "feat(storage): persist per-bookmark cutout shape, flow it into BoardItem (CUTOUT MVP)"
```

---

### Task 3: `CutoutOverlay`（画像を大きく出してなぞる全画面 UI） 【Sonnet 推奨】

**Files:**
- Modify: `lib/board/constants.ts`（`BOARD_Z_INDEX` に `CUTOUT_OVERLAY: 407,` を追加 — `CHROME_DRAWER: 405,` の直後）
- Create: `components/board/CutoutOverlay.tsx`
- Create: `components/board/CutoutOverlay.module.css`
- Test: `components/board/CutoutOverlay.test.tsx`

**Interfaces:**
- Consumes: Task 1 の `normalizeLassoPoints` / `CutoutShape`
- Produces: `CutoutOverlay({ imageUrl, hasExisting, onApply, onClear, onClose })`
  - なぞり終える（pointerup）と多角形が閉じ、CUT で `onApply(shape)`。RESET で描き直し。`hasExisting` のときだけ REMOVE CUTOUT（`onClear`）。CANCEL / Esc / 背景タップで `onClose`
  - testid: `cutout-overlay` / `cutout-image` / `cutout-svg` / `cutout-apply` / `cutout-reset` / `cutout-remove` / `cutout-cancel`

- [ ] **Step 1: Write the failing test**

`components/board/CutoutOverlay.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CutoutOverlay } from './CutoutOverlay'

/** jsdom の getBoundingClientRect は 0 なので、画像に 400×200 の矩形を仕込む。 */
function mockImgRect(): void {
  const img = screen.getByTestId('cutout-image')
  Object.defineProperty(img, 'getBoundingClientRect', {
    value: () => ({ left: 100, top: 50, width: 400, height: 200, right: 500, bottom: 250, x: 100, y: 50, toJSON: (): object => ({}) }),
  })
  fireEvent.load(img)
}

function drawTriangle(): void {
  const svg = screen.getByTestId('cutout-svg')
  Object.defineProperty(svg, 'getBoundingClientRect', {
    value: () => ({ left: 100, top: 50, width: 400, height: 200, right: 500, bottom: 250, x: 100, y: 50, toJSON: (): object => ({}) }),
  })
  fireEvent.pointerDown(svg, { pointerId: 1, clientX: 100, clientY: 50 })
  fireEvent.pointerMove(svg, { pointerId: 1, clientX: 500, clientY: 50 })
  fireEvent.pointerMove(svg, { pointerId: 1, clientX: 300, clientY: 250 })
  fireEvent.pointerUp(svg, { pointerId: 1 })
}

describe('CutoutOverlay', () => {
  it('CUT is disabled until a lasso is traced, then applies the normalized shape', () => {
    const onApply = vi.fn()
    render(<CutoutOverlay imageUrl="https://example.com/t.jpg" hasExisting={false} onApply={onApply} onClear={() => {}} onClose={() => {}} />)
    mockImgRect()
    expect(screen.getByTestId('cutout-apply')).toBeDisabled()
    drawTriangle()
    expect(screen.getByTestId('cutout-apply')).not.toBeDisabled()
    fireEvent.click(screen.getByTestId('cutout-apply'))
    expect(onApply).toHaveBeenCalledTimes(1)
    const shape = onApply.mock.calls[0]?.[0] as { points: readonly { x: number; y: number }[] }
    expect(shape.points.length).toBeGreaterThanOrEqual(3)
    expect(shape.points[0]).toEqual({ x: 0, y: 0 })
  })

  it('RESET clears the trace so a new lasso can start', () => {
    render(<CutoutOverlay imageUrl="https://example.com/t.jpg" hasExisting={false} onApply={() => {}} onClear={() => {}} onClose={() => {}} />)
    mockImgRect()
    drawTriangle()
    fireEvent.click(screen.getByTestId('cutout-reset'))
    expect(screen.getByTestId('cutout-apply')).toBeDisabled()
  })

  it('shows REMOVE CUTOUT only when a cutout already exists, and fires onClear', () => {
    const onClear = vi.fn()
    const a = render(<CutoutOverlay imageUrl="https://e.com/t.jpg" hasExisting={false} onApply={() => {}} onClear={onClear} onClose={() => {}} />)
    expect(a.queryByTestId('cutout-remove')).toBeNull()
    a.unmount()
    render(<CutoutOverlay imageUrl="https://e.com/t.jpg" hasExisting={true} onApply={() => {}} onClear={onClear} onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('cutout-remove'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('Escape closes the overlay and does NOT leak to the window (SHARE stays open)', () => {
    const onClose = vi.fn()
    const outerEsc = vi.fn()
    window.addEventListener('keydown', outerEsc)
    render(<CutoutOverlay imageUrl="https://e.com/t.jpg" hasExisting={false} onApply={() => {}} onClear={() => {}} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(outerEsc).not.toHaveBeenCalled() // capture+stopImmediatePropagation で先取り
    window.removeEventListener('keydown', outerEsc)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
rtk npx vitest run components/board/CutoutOverlay.test.tsx
```

- [ ] **Step 3: Implement**

`components/board/CutoutOverlay.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState, type PointerEvent, type ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { cutoutClipPath, normalizeLassoPoints, type CutoutShape } from '@/lib/board/cutout'
import styles from './CutoutOverlay.module.css'

export type CutoutOverlayProps = {
  /** 切り抜き対象の画像（カードが表示しているのと同じもの）。 */
  readonly imageUrl: string
  /** 既に切り抜き済みのカードなら true（REMOVE CUTOUT を出す）。 */
  readonly hasExisting: boolean
  readonly onApply: (shape: CutoutShape) => void
  readonly onClear: () => void
  readonly onClose: () => void
}

/** なげなわ切り抜きの全画面オーバーレイ（CUTOUT MVP）。画像を大きく表示し、
 *  指/マウスで縁をなぞる → pointerup で多角形が閉じる → CUT で確定。
 *  小さいカードの上で直接描かせない（100 枚時は 30px 角になる）ための専用ステージ。
 *  ボードから開いても成立する自立部品（将来のボード拡張の受け皿・s187）。 */
export function CutoutOverlay(props: CutoutOverlayProps): ReactElement {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const drawing = useRef<boolean>(false)
  const [trace, setTrace] = useState<readonly { x: number; y: number }[]>([])
  const [closed, setClosed] = useState<boolean>(false)

  // Esc は capture 相で先取りする — sharePhase 非 null の間 window に生えている
  // 「Esc = SHARE 全体を閉じる」ハンドラ（BoardRoot）に届かせない。
  const onCloseRef = useRef(props.onClose)
  onCloseRef.current = props.onClose
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      e.preventDefault()
      onCloseRef.current()
    }
    window.addEventListener('keydown', handler, true)
    return (): void => window.removeEventListener('keydown', handler, true)
  }, [])

  const localPoint = (e: PointerEvent<SVGSVGElement>): { x: number; y: number } => ({ x: e.clientX, y: e.clientY })

  const handlePointerDown = (e: PointerEvent<SVGSVGElement>): void => {
    if (e.button > 0) return
    e.stopPropagation()
    try {
      svgRef.current?.setPointerCapture(e.pointerId)
    } catch {
      /* jsdom / synthetic pointers */
    }
    drawing.current = true
    setClosed(false)
    setTrace([localPoint(e)])
  }

  const handlePointerMove = (e: PointerEvent<SVGSVGElement>): void => {
    if (!drawing.current) return
    setTrace((prev) => {
      const last = prev[prev.length - 1]
      // 4px 未満の移動は捨てる（手ぶれ・過剰点）
      if (last && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 4) return prev
      return [...prev, localPoint(e)]
    })
  }

  const handlePointerEnd = (): void => {
    if (!drawing.current) return
    drawing.current = false
    setClosed(true)
  }

  const shape = ((): CutoutShape | null => {
    if (!closed) return null
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return null
    return normalizeLassoPoints(trace, { left: rect.left, top: rect.top, width: rect.width, height: rect.height })
  })()

  const svgRect = svgRef.current?.getBoundingClientRect()
  const toLocal = (p: { x: number; y: number }): string =>
    `${p.x - (svgRect?.left ?? 0)},${p.y - (svgRect?.top ?? 0)}`

  return (
    <div className={styles.backdrop} style={{ zIndex: BOARD_Z_INDEX.CUTOUT_OVERLAY }} data-testid="cutout-overlay" onClick={props.onClose}>
      {/* stage 内クリックは backdrop の onClose に食われないよう止める */}
      <div className={styles.stage} onClick={(e): void => e.stopPropagation()}>
        <span className={styles.hint}>TRACE AROUND THE PART YOU WANT</span>
        <div className={styles.imageBox}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={props.imageUrl}
            alt=""
            className={styles.image}
            style={shape ? { clipPath: cutoutClipPath(shape) } : undefined}
            data-testid="cutout-image"
            draggable={false}
          />
          <svg
            ref={svgRef}
            className={styles.lasso}
            data-testid="cutout-svg"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            {trace.length > 1 && !shape && (
              <polyline className={styles.traceLine} points={trace.map(toLocal).join(' ')} />
            )}
          </svg>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} onClick={props.onClose} data-testid="cutout-cancel">
            CANCEL
          </button>
          {props.hasExisting && (
            <button type="button" className={styles.ghost} onClick={props.onClear} data-testid="cutout-remove">
              REMOVE CUTOUT
            </button>
          )}
          <button
            type="button"
            className={styles.ghost}
            onClick={(): void => {
              setTrace([])
              setClosed(false)
            }}
            data-testid="cutout-reset"
          >
            RESET
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={shape === null}
            onClick={(): void => {
              if (shape !== null) props.onApply(shape)
            }}
            data-testid="cutout-apply"
          >
            CUT
          </button>
        </div>
      </div>
    </div>
  )
}
```

`components/board/CutoutOverlay.module.css`:

```css
/* CUTOUT MVP: なげなわ切り抜きの全画面ステージ。 */
.backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  max-width: min(92vw, 960px);
}

.hint {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.6);
}

.imageBox {
  position: relative;
  display: inline-block;
}

.image {
  display: block;
  max-width: 88vw;
  max-height: 64vh;
  user-select: none;
  -webkit-user-drag: none;
}

.lasso {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  /* なぞりの指をスクロール/ズームに取られない */
  touch-action: none;
}

.traceLine {
  fill: rgba(40, 241, 0, 0.12);
  stroke: #28f100; /* ロゴの緑（brand check green） */
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.primary,
.ghost {
  min-height: 44px;
  padding: 0 22px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.primary {
  border: 1px solid rgba(255, 255, 255, 0.9);
  background: #fff;
  color: #0a0a0b;
}
.primary:disabled {
  opacity: 0.35;
  cursor: default;
}

.ghost {
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
}
```

- [ ] **Step 4: Run to verify it passes → Commit**

```bash
rtk npx vitest run components/board/CutoutOverlay.test.tsx
rtk tsc
rtk git add lib/board/constants.ts components/board/CutoutOverlay.tsx components/board/CutoutOverlay.module.css components/board/CutoutOverlay.test.tsx
rtk git commit -m "feat(board): CutoutOverlay — full-screen lasso tracing stage (CUTOUT MVP)"
```

---

### Task 4: CollageCanvas — clip 適用＋✂ボタン 【Sonnet 推奨】

**Files:**
- Modify: `components/board/CollageCanvas.tsx`
- Modify: `components/board/CollageCanvas.module.css`
- Test: `components/board/CollageCanvas.test.tsx`（既存に追記）

**Interfaces:**
- Consumes: Task 1 の `cutoutClipPath` / `cutoutSourceImage`、Task 2 の `BoardItem.cutout`
- Produces: `CollageCanvasProps` に追加 `readonly onCutRequest?: (id: string) => void`（渡されたときだけ ✂ボタンを描画）。testid `collage-cutout-${id}` / clip は `collage-clip-${id}`

- [ ] **Step 1: Write the failing tests**（既存 describe に追記。`makeItem` を使う）

```tsx
  it('clips the card face with the stored cutout shape (chrome handles stay outside the clip)', () => {
    const item = makeItem({ bookmarkId: 'a', cutout: { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }] } })
    const positions = { a: { x: 0, y: 0, w: 200, h: 100 } }
    const { getByTestId } = render(
      <CollageCanvas
        items={[item]} positions={positions} order={['a']}
        onMove={() => {}} onResize={() => {}} onGrab={() => {}}
        rotations={{}} onRotate={() => {}} maxCardWidth={1000}
        displayMode="visual" paper={false}
      />,
    )
    expect(getByTestId('collage-clip-a').style.clipPath).toBe('polygon(0% 0%, 100% 0%, 50% 100%)')
    // 要素 div 自体には clip を掛けない（回転ノブ・✂が切れて消えるため）
    expect(getByTestId('collage-el-a').style.clipPath).toBe('')
  })

  it('shows the scissors button only for image cards and only when onCutRequest is wired', () => {
    const withImage = makeItem({ bookmarkId: 'a' })
    const noImage = makeItem({ bookmarkId: 'b', thumbnail: undefined })
    const positions = { a: { x: 0, y: 0, w: 200, h: 100 }, b: { x: 0, y: 120, w: 200, h: 100 } }
    const onCutRequest = vi.fn()
    const { getByTestId, queryByTestId, unmount } = render(
      <CollageCanvas
        items={[withImage, noImage]} positions={positions} order={['a', 'b']}
        onMove={() => {}} onResize={() => {}} onGrab={() => {}}
        rotations={{}} onRotate={() => {}} maxCardWidth={1000}
        displayMode="visual" paper={false}
        onCutRequest={onCutRequest}
      />,
    )
    expect(getByTestId('collage-cutout-a').hasAttribute('data-no-capture')).toBe(true)
    expect(queryByTestId('collage-cutout-b')).toBeNull()
    fireEvent.click(getByTestId('collage-cutout-a'))
    expect(onCutRequest).toHaveBeenCalledWith('a')
    unmount()
    const bare = render(
      <CollageCanvas
        items={[withImage]} positions={{ a: { x: 0, y: 0, w: 200, h: 100 } }} order={['a']}
        onMove={() => {}} onResize={() => {}} onGrab={() => {}}
        rotations={{}} onRotate={() => {}} maxCardWidth={1000}
        displayMode="visual" paper={false}
      />,
    )
    expect(bare.queryByTestId('collage-cutout-a')).toBeNull()
  })
```

※ `makeItem` に `cutout` を渡すため、テストファイル冒頭の `makeItem` は `Partial<BoardItem>` spread なのでそのまま通る（Task 2 で BoardItem に field 追加済み）。

- [ ] **Step 2: Run to verify it fails**

```bash
rtk npx vitest run components/board/CollageCanvas.test.tsx
```

- [ ] **Step 3: Implement**

1. import に追加: `import { cutoutClipPath, cutoutSourceImage } from '@/lib/board/cutout'`
2. `CollageCanvasProps` に追加（`title` の後）:

```ts
  /** ✂（切り抜き）ボタンの配線。渡されたときだけ、画像を持つカードにボタンを出す。
   *  切り抜きの形そのものは items[].cutout から読む（CUTOUT MVP）。 */
  readonly onCutRequest?: (id: string) => void
```

3. map 内、`<CardNode …>…</CardNode>` ブロック（L207-217）を**そのまま**次のラッパーで包む（クリップはカード面だけに掛け、外に飛び出るハンドル類には掛けない）:

```tsx
              <div
                className={styles.clipBox}
                style={item.cutout ? { clipPath: cutoutClipPath(item.cutout) } : undefined}
                data-testid={`collage-clip-${item.bookmarkId}`}
              >
                （既存の CardNode ブロックをそのまま中へ）
              </div>
```

※ map のループ変数名は実ファイルに合わせる（`item` でなければ読み替え）。

4. 回転ハンドル（L228-257）の**直後**に ✂ボタンを追加:

```tsx
              {props.onCutRequest && cutoutSourceImage(item) !== null && (
                <button
                  type="button"
                  className={styles.cutoutHandle}
                  data-no-capture
                  data-testid={`collage-cutout-${item.bookmarkId}`}
                  onPointerDown={(e): void => e.stopPropagation()}
                  onClick={(): void => props.onCutRequest?.(item.bookmarkId)}
                  title="Cut out"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path
                      d="M9.6 7.8 19 17.2 M9.6 16.2 19 6.8 M7.5 5.5a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0 Z M7.5 18.5a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0 Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
```

5. `CollageCanvas.module.css` に追加（`.rotateKnob` ブロックの後。表示規則は回転ノブと同一＝desktop は hover 時のみ・タッチは常時）:

```css
/* CUTOUT MVP: ✂ボタン。回転ノブと同じ視覚言語でカード下中央に出す。 */
.cutoutHandle {
  position: absolute;
  left: 50%;
  bottom: -40px;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: #fff;
  background: rgba(18, 18, 22, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.24);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  cursor: pointer;
  touch-action: none;
  z-index: 40;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.element:hover .cutoutHandle {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: none) {
  .cutoutHandle {
    opacity: 1;
    pointer-events: auto;
  }
}

.clipBox {
  position: absolute;
  inset: 0;
}
```

- [ ] **Step 4: Run to verify it passes → Commit**

```bash
rtk npx vitest run components/board/CollageCanvas.test.tsx
rtk tsc
rtk git add components/board/CollageCanvas.tsx components/board/CollageCanvas.module.css components/board/CollageCanvas.test.tsx
rtk git commit -m "feat(board): apply cutout clip + scissors button on collage cards (CUTOUT MVP)"
```

---

### Task 5: BoardRoot 配線（overlay の開閉と保存） 【Sonnet 推奨（大ファイルの配線）】

**Files:**
- Modify: `components/board/BoardRoot.tsx`

- [ ] **Step 1: import と state**

```ts
import { CutoutOverlay } from './CutoutOverlay'
import { cutoutSourceImage } from '@/lib/board/cutout'
```

useBoardData の分割代入（L213-228、`persistMediaSlots,` の隣）に `persistCutout,` を追加。

`sharePhase` の useState 群の近くに:

```ts
  // CUTOUT MVP: ✂で開く切り抜きオーバーレイの対象カード。null = 閉。
  const [cutoutTargetId, setCutoutTargetId] = useState<string | null>(null)
```

- [ ] **Step 2: 出口で閉じる**

`handleExitShareMode` と `handleShareReselect` に `setCutoutTargetId(null)` を追加（編集段を出たらオーバーレイも閉じる）。

- [ ] **Step 3: JSX 配線**

1. `sharePhase === 'arrange'` ブロック内の `<CollageCanvas …/>` に prop を追加: `onCutRequest={setCutoutTargetId}`
2. 同ブロック内（`MobileShareResult`/`ShareToast` を包む `<div data-no-capture>` の直後・fragment 閉じの前）に追加:

```tsx
        {cutoutTargetId !== null && (() => {
          const target = lightboxNavItems.find((it) => it.bookmarkId === cutoutTargetId) ?? null
          const src = target ? cutoutSourceImage(target) : null
          if (!target || src === null) return null
          return (
            <CutoutOverlay
              imageUrl={src}
              hasExisting={target.cutout !== undefined}
              onApply={(shape): void => {
                void persistCutout(target.bookmarkId, shape)
                setCutoutTargetId(null)
              }}
              onClear={(): void => {
                void persistCutout(target.bookmarkId, null)
                setCutoutTargetId(null)
              }}
              onClose={(): void => setCutoutTargetId(null)}
            />
          )
        })()}
```

※ `lightboxNavItems` は arrange の items と同じ出所（BoardRoot L3563 が同じ配列を filter して渡している）。`persistCutout` は useBoardData 経由なので items が即時更新され、CollageCanvas の clip が保存と同時に反映される。

- [ ] **Step 4: 検証 → Commit**

```bash
rtk tsc
rtk vitest run
pnpm build
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(board): wire CutoutOverlay into the arrange stage (CUTOUT MVP)"
```

---

### Task 6: e2e（デスクトップの一連＋永続＋撮影通過） 【Sonnet 推奨】

**Files:**
- Create: `tests/e2e/collage-cutout.spec.ts`

**seed の注意:** 既存 `mobile-share.spec.ts` の seed は `thumbnail: ''`（画像なし）＝✂が出ない。このテストでは **thumbnail に 1px PNG の data URI** を入れて seed する（画像カード扱いになり、CutoutOverlay の `<img>` も即 load する）。

- [ ] **Step 1: テストを書く**

```ts
import { expect, test, type Page } from '@playwright/test'

const DB_NAME = 'booklage-db'
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

async function seedBoardWithImages(page: Page, count: number): Promise<void> {
  await page.goto('/board')
  await page.waitForSelector('[data-theme-id]')
  await page.waitForTimeout(400)
  await page.evaluate(
    async ({ dbName, n, png }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName)
        req.onsuccess = (): void => resolve(req.result)
        req.onerror = (): void => reject(req.error)
      })
      const tx = db.transaction(['bookmarks', 'cards', 'settings'], 'readwrite')
      tx.objectStore('settings').put({ key: 'onboarding-completed', value: true })
      tx.objectStore('settings').put({ key: 'data-home-ack', value: true })
      tx.objectStore('settings').put({ key: 'last-backup-at', value: new Date().toISOString() })
      for (let i = 0; i < n; i++) {
        tx.objectStore('bookmarks').put({
          id: `cut-b-${i}`, url: `https://example.com/${i}`, title: `Card ${i}`,
          description: '', thumbnail: png, favicon: '', siteName: 'Example',
          type: 'website', savedAt: new Date(Date.now() - i * 1000).toISOString(),
          ogpStatus: 'ok', tags: [], orderIndex: i, sizePreset: 'S', linkStatus: 'alive',
        })
        tx.objectStore('cards').put({
          id: `cut-c-${i}`, bookmarkId: `cut-b-${i}`, width: 240, height: 180,
          isManuallyPlaced: false, gridIndex: i,
        })
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = (): void => resolve()
        tx.onerror = (): void => reject(tx.error)
      })
      db.close()
    },
    { dbName: DB_NAME, n: count, png: PNG_1PX },
  )
  await page.reload()
  await page.waitForSelector('[data-bookmark-id]')
}

async function enterArrangeDesktop(page: Page): Promise<void> {
  // デスクトップの確立済み経路: SHARE → SELECT ALL → ARRANGE（カード個別タップは
  // setPointerCapture のため Playwright 駆動不可 — memory 参照）
  await page.getByText('SHARE', { exact: true }).first().click()
  await page.getByText('SELECT ALL', { exact: true }).click()
  await page.getByText('ARRANGE', { exact: true }).click()
  await expect(page.getByTestId('collage-canvas')).toBeVisible()
}

test.use({ viewport: { width: 1489, height: 679 } })

test('lasso cutout: trace → CUT → clip applied → survives reload (CUTOUT MVP)', async ({ page }) => {
  await seedBoardWithImages(page, 6)
  await enterArrangeDesktop(page)

  const first = page.locator('[data-testid^="collage-el-"]').first()
  const id = (await first.getAttribute('data-testid'))!.replace('collage-el-', '')
  await first.hover() // ✂は hover 表示
  await page.getByTestId(`collage-cutout-${id}`).click()
  await expect(page.getByTestId('cutout-overlay')).toBeVisible()

  // なぞる（svg 上で三角形）。CUT が有効になる
  const svg = page.getByTestId('cutout-svg')
  const box = (await svg.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.15, { steps: 8 })
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.9, { steps: 8 })
  await page.mouse.up()
  await expect(page.getByTestId('cutout-apply')).toBeEnabled()
  await page.getByTestId('cutout-apply').click()

  // clip がカード面に付く（要素 div ではなく clipBox）
  const clip = page.getByTestId(`collage-clip-${id}`)
  await expect(clip).toHaveCount(1)
  const clipPath = await clip.evaluate((el) => (el as HTMLElement).style.clipPath)
  expect(clipPath).toContain('polygon(')

  // リロード後も残る（IDB 永続）
  await page.reload()
  await page.waitForSelector('[data-bookmark-id]')
  await enterArrangeDesktop(page)
  const clipAfter = await page.getByTestId(`collage-clip-${id}`).evaluate((el) => (el as HTMLElement).style.clipPath)
  expect(clipAfter).toContain('polygon(')
})

test('REMOVE CUTOUT restores the rectangular card', async ({ page }) => {
  await seedBoardWithImages(page, 4)
  await enterArrangeDesktop(page)
  const first = page.locator('[data-testid^="collage-el-"]').first()
  const id = (await first.getAttribute('data-testid'))!.replace('collage-el-', '')
  await first.hover()
  await page.getByTestId(`collage-cutout-${id}`).click()
  const svg = page.getByTestId('cutout-svg')
  const box = (await svg.boundingBox())!
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 20, box.y + 30, { steps: 6 })
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 20, { steps: 6 })
  await page.mouse.up()
  await page.getByTestId('cutout-apply').click()
  await first.hover()
  await page.getByTestId(`collage-cutout-${id}`).click()
  await page.getByTestId('cutout-remove').click()
  const clipPath = await page.getByTestId(`collage-clip-${id}`).evaluate((el) => (el as HTMLElement).style.clipPath)
  expect(clipPath).toBe('')
})
```

※ `SHARE` / `SELECT ALL` / `ARRANGE` のロケータは既存デスクトップ e2e（`mobile-share.spec.ts` の desktop describe、`tune-corners-and-snap.spec.ts` 等）の書き方を確認し、既存の安定した取り方（testid があれば testid）に合わせて調整してよい。**検証内容は変えない**。

- [ ] **Step 2: 実行**

```bash
npx playwright test tests/e2e/collage-cutout.spec.ts
```

Expected: 2 本全緑。

- [ ] **Step 3: Commit**

```bash
rtk git add tests/e2e/collage-cutout.spec.ts
rtk git commit -m "test(e2e): lasso cutout trace/apply/persist/remove (CUTOUT MVP)"
```

---

### Task 7: 検証一式→デプロイ→実機確認依頼 【どのモデルでも可】

- [ ] **Step 1: 検証→デプロイ**

```bash
rtk tsc && rtk vitest run && pnpm build
npx playwright test tests/e2e/collage-cutout.spec.ts tests/e2e/mobile-share.spec.ts
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

- [ ] **Step 2: ユーザーへの実機確認依頼（コピペで渡す）**

```
PC とスマホの両方で https://allmarks.app をハードリロードして:
【PC】
1. SHARE → 何枚か選ぶ → ARRANGE → カードにマウスを乗せると下に ✂ が出ますか
2. ✂ → 画像が大きく出る → マウスで縁をなぞる → CUT。カードが切り抜き形になりましたか
3. そのまま CREATE → できた共有画像に切り抜きが写っていますか（ここが一番大事。
   万一 四角のまま写る場合は「撮影が clip-path を落とす」既知リスクなので教えてください）
【スマホ】
4. SHARE → 選ぶ → ARRANGE → カード下の ✂ をタップ → 指で縁をなぞる → CUT
5. なぞりの感触（線が指に追従するか・誤って画面がスクロールしないか）
6. 切り抜いたカードを動かす/回す/大きさ変更 → CREATE → 画像に写るか
【共通】
7. もう一度 ✂ → REMOVE CUTOUT で四角に戻ること。ボード（ふだんの一覧）は
   切り抜かれず四角のままであること
```

- [ ] **Step 3: 記録** — TODO.md に CUTOUT MVP を追記し、実機結果を記録。**万一 dom-to-image が clip-path を焼けない場合の対処（調査済みの逃げ道）**: 撮影時だけ切り抜きをラスタ化する（`rewriteImageSrc` と同じ「clone だけ差し替え」方式で、canvas に `clip()` して描いた dataURL に差し替える）。これは追加タスクとして別途計画する（今回は入れない）。

---

## Self-Review 済みの注意点（実装者へ）

- **クリップは `clipBox`（CardNode を包む内側ラッパー）にだけ掛ける**。要素 div に掛けると、外に飛び出している回転ノブ（top:-48px）・✂（bottom:-40px）・リサイズ角が全部切れて消える。
- **リサイズの四隅・回転ノブは四角い元の枠のまま**残る（切り抜き後も操作性を保つための意図的仕様。見た目の違和感が実機で気になったら後で調整）。
- **Esc の先取り**（capture + `stopImmediatePropagation`）が無いと、オーバーレイで Esc → SHARE ごと閉じる事故になる（BoardRoot の window keydown が sharePhase 非 null の間ずっと生きている）。
- `cutout` は optional field 追加のみ＝**DB_VERSION は上げない**（migration も EXPORT/IMPORT 変更も不要。バックアップ JSON には自動で載る）。
- **将来のボード拡張の受け皿**（ユーザー要望）: ①形は BookmarkRecord/BoardItem に既に流れている ②適用は `cutoutClipPath` 1 行 ③操作 UI（CutoutOverlay）は自立部品。ボード側でやることは「CardsLayer のカード面ラッパーに style 1 行＋設定ゲート」だけ。**MVP ではボードに適用しない**（グリッドの気持ちよさを守る・ユーザー確定）。
- ✂ボタンはタッチ端末で常時表示（回転ノブと同じ規則）。100 枚時はカードが小さく重なるが、段階2のピンチズームで拡大してから触る前提（ズームでノブ類も拡大される）。
- 段階2（ピンチズーム）と同時に入る場合: ✂の `onClick` はズームの `MobileZoomStage` と干渉しない（pointerdown は stopPropagation 済み・click はピンチ対象外）。
- 撮影（dom-to-image）が CSS `clip-path: polygon(%)` を焼けるかは**実機確認が最終関門**（Task 7 Step 2 の 3）。落ちた場合の逃げ道は Task 7 Step 3 に記載（クローン差し替えのラスタ化）。
- ツイート等の複数画像カード: 切り抜き対象は表示中の 1 枚目（`cutoutSourceImage` の優先順位）。カード面全体に clip が掛かるため、カードの見た目＝1枚目表示のときに WYSIWYG になる（コラージュのカードは静止・autoCycle=false なので常に 1 枚目＝一致する）。
