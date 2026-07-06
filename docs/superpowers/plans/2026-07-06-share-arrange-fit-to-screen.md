# SHARE アレンジ「1画面に最大サイズで自動配置」実装計画（N-40 ＋ N-41）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SHARE の「並べる（アレンジ）」で、選んだカードを何枚でも・大きさがバラバラでも必ず1画面に「収まる中で最大サイズ」に自動配置して全部見せ（N-40 解消）、同じ画面の回転ノブを業界水準の見た目に刷新する（N-41）。

**Architecture:** 純関数 `fitSelectionToScreen` を新設し、選択カードを既存の skyline パッキングで詰めたうえ「安全領域の高さに収まる最大倍率」を二分探索して全体を縮小、安全領域内に中央寄せで配置する。倍率を座標に焼き込むので既存の移動/リサイズ/回転（全て画面px基準）は無変更で動く。`BoardRoot.handleEnterArrange` の WYSIWYG 実座標シードを、この関数のフィットシードに差し替える。回転ノブは DOM/CSS のみ差し替え、角度ロジック・配線は不変。

**Tech Stack:** TypeScript strict / React / Next.js（static export）/ vitest / Playwright / Vanilla CSS Modules。既存 `computeSkylineLayout`（lib/board/skyline-layout.ts）を流用。

## Global Constraints

- TypeScript strict、`any` 禁止（`unknown`＋型ガード）、return type 明示。
- 出荷前ゲート: `rtk tsc && rtk vitest run && rtk pnpm build` が全緑。
- アレンジの配置/回転/タイトルは**一時 React state のみ・IDB 非永続**。**盤面本体（グリッド・並び順・サイズ）は一切変更しない**。
- コミットは `rtk git`。`--no-verify` 禁止。コミット本文は ASCII（wrangler 制約とは別だが踏襲）。
- 応答・ドキュメントは日本語・平易。機微情報は書かない。
- z-index は `BOARD_Z_INDEX` 定数のみ（魔法の数値禁止）。
- 見た目変更（N-41）は実機目視まで完了扱いにしない（`setPointerCapture` ジェスチャは Playwright 不可＝純関数 TDD＋手動目視）。
- 参照 spec: [2026-07-06-share-arrange-fit-to-screen-design.md](../specs/2026-07-06-share-arrange-fit-to-screen-design.md)。

---

## ファイル構成（このプランで触るもの）

| ファイル | 責務 | 変更 |
|---|---|---|
| `lib/board/constants.ts` | アレンジ安全領域インセット定数 | 追記（`ARRANGE_SAFE_INSET`） |
| `lib/share/collage-layout.ts` | 自由配置レイアウトの純ロジック。新関数 `fitSelectionToScreen` と型 `CollageFitRect` を追加（既存 `seedCollagePositions` 等は不変で温存） | 追記 |
| `lib/share/collage-layout.test.ts` | 上記のユニットテスト | 追記 |
| `components/board/BoardRoot.tsx` | `handleEnterArrange` のシードを WYSIWYG 実座標 → フィットシードに差し替え | 修正（[BoardRoot.tsx:2016-2043](../../../components/board/BoardRoot.tsx#L2016-L2043)） |
| `components/board/CollageCanvas.tsx` | 回転ハンドルの中身（stem+knob）を回転アイコン SVG に差し替え（N-41） | 修正 |
| `components/board/CollageCanvas.module.css` | 回転ノブの CSS を業界水準の円形ボタンに（N-41） | 修正 |

---

## Task 1: 純関数 `fitSelectionToScreen` ＋ 安全領域定数（TDD）

**Files:**
- Modify: `lib/board/constants.ts`（末尾に定数追記）
- Modify: `lib/share/collage-layout.ts`（型＋関数追記。既存 export は不変）
- Test: `lib/share/collage-layout.test.ts`（describe 追記）

**Interfaces:**
- Consumes: `computeSkylineLayout(input: { cards: ReadonlyArray<{id,width,height}>, containerWidth: number, gap: number }): { positions: Readonly<Record<string, CardPosition>>, totalWidth: number, totalHeight: number }`（既存 `@/lib/board/skyline-layout`）。`CollageElement = { id: string; width: number; height: number }`・`CollagePositions = Readonly<Record<string, CardPosition>>`（既存 collage-layout.ts）。`CardPosition = { readonly x,y,w,h: number }`（`@/lib/board/types`）。
- Produces:
  - `export const ARRANGE_SAFE_INSET = { TOP_PX: 80, BOTTOM_PX: 120, SIDE_PX: 24 } as const`
  - `export type CollageFitRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }`
  - `export function fitSelectionToScreen(cards: readonly CollageElement[], rect: CollageFitRect, gap: number): CollagePositions`

- [ ] **Step 1: 定数を追記**

`lib/board/constants.ts` の末尾（`SIZE_PRESET_SPAN` の後）に追記:

```ts
/** SHARE アレンジ（自由配置キャンバス）で使える安全領域のインセット（画面px）。
 *  上＝上部クロム、下＝ShareToast（bottom:24 + バー高さ）、左右＝端に貼り付かない余白。
 *  fitSelectionToScreen はこの内側に全カードを収める（画面外・スクロールを起こさない）。 */
export const ARRANGE_SAFE_INSET = {
  TOP_PX: 80,
  BOTTOM_PX: 120,
  SIDE_PX: 24,
} as const
```

- [ ] **Step 2: 失敗するテストを書く**

`lib/share/collage-layout.test.ts` の import 行に `fitSelectionToScreen`（と型は不要）を追加し、末尾に describe を追記:

```ts
// import 行を差し替え:
// import { seedCollagePositions, moveElement, resizeElement, resizeElementFromCorner, bringToFront, fitSelectionToScreen } from './collage-layout'

describe('fitSelectionToScreen', () => {
  const rectBig = { x: 0, y: 0, width: 1000, height: 800 }

  it('空 / 幅ゼロ / 高さゼロ は {} を返す', () => {
    expect(fitSelectionToScreen([], rectBig, 10)).toEqual({})
    expect(fitSelectionToScreen([{ id: 'a', width: 100, height: 100 }], { x: 0, y: 0, width: 0, height: 800 }, 10)).toEqual({})
    expect(fitSelectionToScreen([{ id: 'a', width: 100, height: 100 }], { x: 0, y: 0, width: 1000, height: 0 }, 10)).toEqual({})
  })

  it('全カードに座標を返す', () => {
    const pos = fitSelectionToScreen(
      [{ id: 'a', width: 200, height: 100 }, { id: 'b', width: 200, height: 100 }],
      rectBig,
      10,
    )
    expect(Object.keys(pos).sort()).toEqual(['a', 'b'])
  })

  it('自然サイズで収まるなら縮小しない（w が自然値のまま = 倍率上限1）', () => {
    // 2枚 200x100 は 1000x800 に余裕で収まる → scale 1
    const pos = fitSelectionToScreen(
      [{ id: 'a', width: 200, height: 100 }, { id: 'b', width: 200, height: 100 }],
      rectBig,
      10,
    )
    expect(pos.a.w).toBe(200)
    expect(pos.b.w).toBe(200)
  })

  it('全カードが rect 内に収まる（右端・下端がはみ出さない）', () => {
    const cards = Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, width: 200, height: 260 }))
    const rect = { x: 24, y: 80, width: 1440, height: 560 }
    const pos = fitSelectionToScreen(cards, rect, 8)
    for (const id in pos) {
      const p = pos[id]
      expect(p.x).toBeGreaterThanOrEqual(rect.x - 0.001)
      expect(p.y).toBeGreaterThanOrEqual(rect.y - 0.001)
      expect(p.x + p.w).toBeLessThanOrEqual(rect.x + rect.width + 0.5)
      expect(p.y + p.h).toBeLessThanOrEqual(rect.y + rect.height + 0.5)
    }
  })

  it('収まらないときは縮小する（少なくとも1枚は自然幅より小さい）', () => {
    const cards = Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, width: 200, height: 260 }))
    const rect = { x: 0, y: 0, width: 600, height: 400 }
    const pos = fitSelectionToScreen(cards, rect, 8)
    const shrunk = Object.values(pos).some((p) => p.w < 200 - 0.001)
    expect(shrunk).toBe(true)
  })

  it('「収まる中で最大」= 1列に強制した縦積みで倍率が境界に一致する', () => {
    // rect 幅 100・カード幅 100（横に2枚は並ばない）・高さ 100 × 2枚・gap 0。
    // 縮小後も幅 > 50 を保つので 1 列のまま: 自然 totalHeight=200 を rect.height=120 に
    // 収める最大倍率は 0.6 → 各 w≈60・contentH≈120（ぴったり埋める＝最大）。
    const pos = fitSelectionToScreen(
      [{ id: 'a', width: 100, height: 100 }, { id: 'b', width: 100, height: 100 }],
      { x: 0, y: 0, width: 100, height: 120 },
      0,
    )
    expect(Math.abs(pos.a.w - 60)).toBeLessThan(0.5)
    const contentBottom = Math.max(...Object.values(pos).map((p) => p.y + p.h))
    const contentTop = Math.min(...Object.values(pos).map((p) => p.y))
    expect(contentBottom - contentTop).toBeLessThanOrEqual(120.001)
    expect(contentBottom - contentTop).toBeGreaterThan(118) // ほぼ埋めている = 最大
  })

  it('100枚でも全部 rect 内に収まる（80px 下限は無視される）', () => {
    const cards = Array.from({ length: 100 }, (_, i) => ({ id: `c${i}`, width: 267, height: 350 }))
    const rect = { x: 24, y: 80, width: 1440, height: 560 }
    const pos = fitSelectionToScreen(cards, rect, 6)
    expect(Object.keys(pos)).toHaveLength(100)
    for (const id in pos) {
      const p = pos[id]
      expect(p.x + p.w).toBeLessThanOrEqual(rect.x + rect.width + 0.5)
      expect(p.y + p.h).toBeLessThanOrEqual(rect.y + rect.height + 0.5)
    }
  })
})
```

- [ ] **Step 3: 実行して失敗を確認**

Run: `rtk vitest run lib/share/collage-layout.test.ts`
Expected: FAIL（`fitSelectionToScreen is not a function` / import エラー）。

- [ ] **Step 4: 最小実装を書く**

`lib/share/collage-layout.ts` の末尾に追記（既存 export は変更しない）:

```ts
/** アレンジで使える安全領域（画面px矩形）。上部クロム／下部 ShareToast に潜らせない。 */
export type CollageFitRect = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * 選択カード（自然サイズ）を skyline で詰め、rect の高さに収まる「最大倍率」を
 * 二分探索して全体を一律縮小し、rect 内に中央寄せで配置した座標を返す。
 * - 倍率の上限は 1（数枚なら盤面と同じ大きさ・膨らませない）。
 * - 収まる中で最大の倍率を採用（横幅いっぱいを使い、縦が rect.height に収まる最大）。
 * - 80px 下限は適用しない（自動配置は「全部1画面に収める」を優先）。
 * - 空 / 幅ゼロ / 高さゼロ は {} を返す。
 */
export function fitSelectionToScreen(
  cards: readonly CollageElement[],
  rect: CollageFitRect,
  gap: number,
): CollagePositions {
  if (cards.length === 0 || rect.width <= 0 || rect.height <= 0) return {}

  const packAt = (scale: number): ReturnType<typeof computeSkylineLayout> =>
    computeSkylineLayout({
      cards: cards.map((c) => ({ id: c.id, width: c.width * scale, height: c.height * scale })),
      containerWidth: rect.width,
      gap,
    })

  // 上限は 1（膨らませない）。自然サイズで収まればそのまま使う。
  let scale = 1
  if (packAt(1).totalHeight > rect.height) {
    // scale が大きいほど totalHeight は増える（単調）＝収まる最大倍率を二分探索。
    let lo = 0
    let hi = 1
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (packAt(mid).totalHeight <= rect.height) lo = mid
      else hi = mid
    }
    scale = lo
  }

  const packed = packAt(scale)
  // 実際に使った幅・高さを測り rect 内に中央寄せ。
  let contentW = 0
  let contentH = 0
  for (const id in packed.positions) {
    const p = packed.positions[id]
    if (p.x + p.w > contentW) contentW = p.x + p.w
    if (p.y + p.h > contentH) contentH = p.y + p.h
  }
  const offsetX = rect.x + Math.max(0, (rect.width - contentW) / 2)
  const offsetY = rect.y + Math.max(0, (rect.height - contentH) / 2)

  const out: Record<string, CardPosition> = {}
  for (const id in packed.positions) {
    const p = packed.positions[id]
    out[id] = { x: p.x + offsetX, y: p.y + offsetY, w: p.w, h: p.h }
  }
  return out
}
```

（注: 既存 import 行に `CardPosition` は既にある。`computeSkylineLayout` も既存 import。追加 import は不要。）

- [ ] **Step 5: 実行して合格を確認**

Run: `rtk vitest run lib/share/collage-layout.test.ts`
Expected: PASS（全 it 緑）。

- [ ] **Step 6: 型チェック**

Run: `rtk tsc`
Expected: エラー 0。

- [ ] **Step 7: コミット**

```bash
rtk git add lib/board/constants.ts lib/share/collage-layout.ts lib/share/collage-layout.test.ts
rtk git commit -m "feat(share): fitSelectionToScreen packs selection to fit one screen at max size (N-40)"
```

---

## Task 2: `handleEnterArrange` をフィットシードに差し替え（配線）

**Files:**
- Modify: `components/board/BoardRoot.tsx`（import 追加＋`handleEnterArrange` 本体 [2016-2043](../../../components/board/BoardRoot.tsx#L2016-L2043)）

**Interfaces:**
- Consumes: Task 1 の `fitSelectionToScreen`・`CollageFitRect`（`@/lib/share/collage-layout`）、`ARRANGE_SAFE_INSET`（`@/lib/board/constants`）。既存の `viewport`（`{x,y,w,h}`）・`customWidths`・`cardWidthPx`・`cardGapPx`・`itemSkylineHeight`・`lightboxNavItems`・`selectedIds`・`bgTypoEnabled`・`defaultShareTitleConfig`・setter 群。
- Produces: なし（内部配線）。

- [ ] **Step 1: import を追加**

`components/board/BoardRoot.tsx` の該当 import を更新:
- collage-layout からの import に `fitSelectionToScreen` と型 `CollageFitRect` を追加（既存の `moveElement, resizeElementFromCorner, bringToFront` 等の行に足す）。
- `@/lib/board/constants` の import に `ARRANGE_SAFE_INSET` を追加（既存 `BOARD_INNER, BOARD_SLIDERS, BOARD_TOP_PAD_PX, BOARD_Z_INDEX` の行）。

- [ ] **Step 2: `handleEnterArrange` を差し替え**

[BoardRoot.tsx:2004-2043](../../../components/board/BoardRoot.tsx#L2004-L2043) の（コメント含む）現行 `handleEnterArrange` 全体を、以下に置換:

```ts
  // Stage 1 → 2: 選んだカードを「1画面に収まる中で最大サイズ」に自動配置してアレンジ開始。
  // fitSelectionToScreen が skyline パック＋収まる最大倍率の二分探索＋安全領域内への
  // 中央寄せを行うので、何枚選んでも画面外に置かれない（N-40）。倍率は座標に焼き込まれ、
  // 以降の移動/リサイズ/回転（すべて画面px基準）はそのまま動く。盤面座標(WYSIWYG)は使わない。
  const handleEnterArrange = useCallback((): void => {
    if (selectedIds.size === 0) return
    const chosen = lightboxNavItems.filter((it) => selectedIds.has(it.bookmarkId))
    const rect: CollageFitRect = {
      x: ARRANGE_SAFE_INSET.SIDE_PX,
      y: ARRANGE_SAFE_INSET.TOP_PX,
      width: Math.max(0, viewport.w - 2 * ARRANGE_SAFE_INSET.SIDE_PX),
      height: Math.max(0, viewport.h - ARRANGE_SAFE_INSET.TOP_PX - ARRANGE_SAFE_INSET.BOTTOM_PX),
    }
    const cards = chosen.map((it) => {
      const w = customWidths[it.bookmarkId] ?? cardWidthPx
      return { id: it.bookmarkId, width: w, height: itemSkylineHeight(it, w) }
    })
    setCollagePositions(fitSelectionToScreen(cards, rect, cardGapPx))
    setCollageOrder(chosen.map((it) => it.bookmarkId))
    setCollageRotations({}) // re-entry (RESELECT→ARRANGE) reseeds a clean flat layout, no tilt
    setShareTitle(defaultShareTitleConfig(bgTypoEnabled, viewport.w, viewport.h))
    setSharePhase('arrange')
  }, [selectedIds, lightboxNavItems, customWidths, cardWidthPx, cardGapPx, viewport.w, viewport.h, bgTypoEnabled])
```

（旧実装で使っていた `document.querySelector('[data-bookmark-id]')` によるスクリーン原点実測と `layout.positions` 参照は削除。`layout` は他所で使うので import/定義は残す。）

- [ ] **Step 3: 型チェック**

Run: `rtk tsc`
Expected: エラー 0（未使用変数・deps 不足の警告も無し）。

- [ ] **Step 4: 全テスト実行（リグレッション無し）**

Run: `rtk vitest run`
Expected: PASS（既存の全テスト緑。BoardRoot 経路のテストがあれば維持）。

- [ ] **Step 5: コミット**

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(share): arrange seeds via fit-to-screen so no selected card lands off-screen (N-40)"
```

---

## Task 3: 回転ノブを業界水準の見た目に刷新（N-41・見た目のみ）

**Files:**
- Modify: `components/board/CollageCanvas.tsx`（回転ハンドルの中身 [214-221](../../../components/board/CollageCanvas.tsx#L214-L221)）
- Modify: `components/board/CollageCanvas.module.css`（`.rotateHandle` / `.rotateStem` / `.rotateKnob` [35-71](../../../components/board/CollageCanvas.module.css#L35-L71)）

**Interfaces:**
- Consumes: なし（既存の `handleRotatePointerDown`・`collage-rotate.ts` の角度ロジックは不変）。
- Produces: なし（見た目のみ）。testid `collage-rotate-${id}` と hover 出現挙動、上中央の当たり位置は維持。

- [ ] **Step 1: 既存テストが緑であることを先に確認（ベースライン）**

Run: `rtk vitest run components/board/CollageCanvas.test.tsx`
Expected: PASS（特に「exposes a rotate handle」= `collage-rotate-a` truthy）。この testid を壊さないことが本タスクの不変条件。

- [ ] **Step 2: 回転アイコンの DOM に差し替え**

`components/board/CollageCanvas.tsx` の回転ハンドル部（`<span className={styles.rotateStem} .../>` と `<span className={styles.rotateKnob} .../>` の2行）を、以下に置換（外側 `<div className={styles.rotateHandle} data-testid=...>` と `onPointerDown` は変更しない）:

```tsx
              <span className={styles.rotateStem} aria-hidden="true" />
              <span className={styles.rotateKnob} aria-hidden="true">
                {/* Canva/Figma 風の回転アイコン（ほぼ全周の弧＋矢頭）。currentColor で白。 */}
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                  <path
                    d="M19.5 12a7.5 7.5 0 1 1-2.6-5.7"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points="17.2 3.8 17.2 6.9 14.1 6.9"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
```

- [ ] **Step 3: CSS を円形ボタンに更新**

`components/board/CollageCanvas.module.css` の `.rotateHandle` / `.rotateStem` / `.rotateKnob` を以下に置換:

```css
.rotateHandle {
  position: absolute;
  left: 50%;
  top: -48px;
  width: 34px;
  height: 48px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  cursor: grab;
  touch-action: none;
  z-index: 40;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}
.element:hover .rotateHandle {
  opacity: 1;
  pointer-events: auto;
}
.rotateHandle:active {
  cursor: grabbing;
}
.rotateStem {
  width: 1.5px;
  height: 12px;
  background: rgba(255, 255, 255, 0.55);
}
.rotateKnob {
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
}
```

- [ ] **Step 4: 型チェック＋テスト**

Run: `rtk tsc && rtk vitest run components/board/CollageCanvas.test.tsx`
Expected: tsc エラー 0／テスト PASS（`collage-rotate-a` は生存・rotation transform も維持）。

- [ ] **Step 5: コミット**

```bash
rtk git add components/board/CollageCanvas.tsx components/board/CollageCanvas.module.css
rtk git commit -m "feat(share): industry-standard circular rotate knob in collage arrange (N-41)"
```

---

## Task 4: Playwright で N-40 解消を実測（取りこぼしゼロ・全カード画面内）

**Files:**
- Create: スクショ/スクリプトはスクラッチパッド配下（`.../scratchpad/` 一時ファイル、リポジトリにコミットしない）。

**Interfaces:**
- Consumes: `rtk pnpm build` の成果物 `out/`（= デプロイと同じ静的ビルド）をローカル配信して検証。
- Produces: なし（検証ログ＋スクショ）。

- [ ] **Step 1: 本番相当ビルド**

Run: `rtk pnpm build`
Expected: 成功（`out/` 生成）。※ `rtk next build` ではなく `pnpm build`（static export・memory `reference_pnpm_build_required`）。

- [ ] **Step 2: 検証スクリプトを書く（多数選択→アレンジ→全カード画面内）**

`out/` を静的サーバで配信し `/board` を開く。**オンボーディング/データ説明モーダルを飛ばすため IDB に多数ブクマを事前投入＋既読フラグを立てる**（手順は memory `reference_playwright_board_share_verify` と既存の share 検証スクリプトの preseed パターンを再利用。DB は `DB_NAME='booklage-db'`、store `bookmarks`）。到達導線＝ヘッダー SHARE →「選ぶ」→ **SELECT ALL** → **ARRANGE**。ビューポートは一般多数派 `1920×1080`（deviceScaleFactor 2）で1回、開発者実機 `1489×679`（deviceScaleFactor 2.58）で1回（CLAUDE.md 計測方針）。

投入枚数は **40枚** と **100枚** の2ケース。アレンジ到達後に以下を評価:

```js
// arrange に入った後、ページ内で評価する検証ロジック
const result = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('[data-testid^="collage-el-"]'))
  const vw = window.innerWidth
  const vh = window.innerHeight
  const offscreen = els.filter((el) => {
    const r = el.getBoundingClientRect()
    // 少しの端はみ出し許容せず「画面内」を厳格判定（安全領域に収める設計）
    return r.right <= 0 || r.left >= vw || r.bottom <= 0 || r.top >= vh
  })
  return { count: els.length, offscreenCount: offscreen.length, vw, vh }
})
```

- [ ] **Step 3: 検証を実行し合格条件を確認**

合格条件（両ビューポート × 両枚数）:
- `result.count === 選択枚数`（40 または 100）＝ **取りこぼしゼロ**。
- `result.offscreenCount === 0` ＝ **画面外カードなし**（N-40 解消の実証）。
- スクショ目視: カードが1画面に収まり重なり過ぎず自動配置されている。上部クロム／下部 ShareToast の裏に潜っていない。

Expected: 4通り（1920/1489 × 40/100）すべて `offscreenCount === 0` かつ `count` 一致。

- [ ] **Step 4: 結果を記録**

スクショを保存し、結果（count / offscreenCount / viewport）を検証ログに残す。**不合格なら Task 1〜2 に戻って安全領域インセットやパッキングを調整**（例: `ARRANGE_SAFE_INSET` の値、gap）。合格したら次へ。

（Task 4 はコード変更なしの検証タスク。コミット不要。）

---

## 実装後（このプランの外・執行スキル側の手順）

1. `superpowers:subagent-driven-development` で Task 1→4 を各タスク実装→2段レビュー→修正。
2. 全タスク後、**opus 全ブランチレビュー**（跨ぎ seam の摘出）。
3. `rtk tsc && rtk vitest run && rtk pnpm build` 緑を最終確認。
4. **本番デプロイ**: `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true` →「`allmarks.app` をハードリロード」案内。
5. **ユーザー実機目視**（Playwright 不可のジェスチャ）: 自動配置後の移動/リサイズ/回転/タイトル、回転ノブ新デザインの見た目・視認性。
6. docs 更新（TODO_COMPLETED に narrative、TODO の現在状態、CURRENT_GOAL を次セッション用に）＋コミット。

---

## Self-Review（spec 照合）

- **spec §3.3 アルゴリズム**（skyline＋二分探索＋焼き込み＋中央寄せ＋80px 下限無視）→ Task 1 で実装・テスト。✅
- **spec §3.2 安全領域**（上/下/左右インセット）→ Task 1 `ARRANGE_SAFE_INSET` ＋ Task 2 rect 計算。✅
- **spec §3.4 枚数による見え方**（数枚=scale1・100枚=縮小）→ Task 1 テスト「自然サイズで収まるなら縮小しない」「100枚でも rect 内」。✅
- **spec §3.6 キャップ1**（膨らませない）→ Task 1 の `packAt(1)` を上限にする実装。✅
- **spec §3.5 操作不変**（移動/リサイズ/回転/タイトル）→ Task 2 は座標焼き込みで既存挙動を温存。✅
- **spec §4 N-41 回転ノブ**（見た目のみ・角度ロジック不変・testid/hover 維持）→ Task 3。✅
- **spec §7 テスト観点**（純関数 unit＋Playwright 全カード画面内）→ Task 1・Task 4。✅
- **spec §5 非永続・盤面不変** → Global Constraints ＋ Task 2 は state のみ。✅
- Placeholder scan: TBD/TODO なし。全ステップに実コード・実コマンド・期待値あり。✅
- 型整合: `fitSelectionToScreen(cards, rect, gap)` / `CollageFitRect` / `ARRANGE_SAFE_INSET` の名称・引数が Task 1 定義と Task 2 消費で一致。✅
