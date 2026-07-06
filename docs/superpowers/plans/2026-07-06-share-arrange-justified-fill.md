# SHARE アレンジ justified-rows 充填 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SHARE アレンジの自動配置を「石垣＋一律縮小」から「justified rows（各行を幅いっぱいに揃え、行数で高さも埋める）」へ作り替え、盤面の長方形を端まで充填して右下のL字余白を最小化する。

**Architecture:** 純関数 `fitSelectionToScreen` を全面書き換え。カードは縦横比だけ使う（盤面の絶対サイズは無視）。各行は閉形で行高を求めて rect 幅ちょうどに満たし、目標行高 H を二分探索して総高を rect 高さに合わせる。カード幅は盤面既定（`CARD_WIDTH_DEFAULT_PX`）を上限に頭打ちし、隙間はカード高さに比例（盤面の `CARD_GAP:CARD_WIDTH` 比）。少数カードは上限で止まり中央寄せ。呼び出し元は署名変更に追従し、不要になった `COLLAGE_GAP_PX` を撤去。

**Tech Stack:** TypeScript (strict), Vitest, Next.js static export, Cloudflare Pages。純ロジックのみ（React 変更は呼び出し1行）。

## Global Constraints

- TypeScript `strict: true`。`any` 禁止（`unknown`＋ガード）。戻り値型は明示。（CLAUDE.md）
- テストは `rtk vitest run`、型チェックは `rtk tsc`、ビルドは `rtk pnpm build`（`next build` ではなく `pnpm build`＝static export）。
- `console.log` を本番コードに残さない。
- 縦横比は死守（カードは本物の board カード面を描画）。相対サイズは無視（ユーザー確定）。
- 盤面既定値の正本は `lib/board/constants.ts` の `BOARD_SLIDERS`：`CARD_WIDTH_DEFAULT_PX = 267.84`、`CARD_GAP_DEFAULT_PX = 97.21`。
- 変えない：`ARRANGE_SAFE_INSET`／`.canvas` 基準の rect／座標焼き込み（移動・リサイズ・回転は画面px）／`CollageCanvas` の描画・装飾・回転ノブ／`seedCollagePositions`・`moveElement`・`resizeElement`・`resizeElementFromCorner`・`bringToFront`。
- spec: [2026-07-06-share-arrange-justified-fill-design.md](../specs/2026-07-06-share-arrange-justified-fill-design.md)。

---

## Task 1: `fitSelectionToScreen` を justified rows 充填に全面書き換え（純関数・TDD）

**Files:**
- Modify: `lib/share/collage-layout.ts`（`fitSelectionToScreen` 本体と型 `FitOptions` を差し替え・内部ヘルパ `layoutAtTargetHeight` を追加。他の export 関数は不変）
- Test: `lib/share/collage-layout.test.ts`（`describe('fitSelectionToScreen', …)` ブロックのみ新契約に差し替え。先頭の `describe('collage-layout', …)`＝seed/move/resize/bringToFront は不変）

**Interfaces:**
- Consumes: 既存 `CollageElement = {id, width, height}`、`CollageFitRect = {x,y,width,height}`、`CollagePositions`、`CardPosition = {x,y,w,h}`。`BOARD_SLIDERS`（`@/lib/board/constants`）。
- Produces:
  - `export type FitOptions = { readonly maxCardWidth?: number; readonly gapRatio?: number }`
  - `export function fitSelectionToScreen(cards: readonly CollageElement[], rect: CollageFitRect, opts?: FitOptions): CollagePositions` — **第3引数が旧 `gap: number` から `opts?: FitOptions` に変わる**（Task 2 の呼び出し側が追従）。

- [ ] **Step 1: テストを新契約に差し替え（失敗させる）**

`lib/share/collage-layout.test.ts` の `import` 行はそのまま（`fitSelectionToScreen` を含む）。ファイル末尾の `describe('fitSelectionToScreen', () => { … })` ブロック**全体**を次に置き換える：

```ts
describe('fitSelectionToScreen (justified rows fill)', () => {
  // 幅=aspect*100, 高さ=100 の均一カードを n 枚。
  const uniform = (n: number, aspect = 1): { id: string; width: number; height: number }[] =>
    Array.from({ length: n }, (_, i) => ({ id: `c${i}`, width: 100 * aspect, height: 100 }))

  it('空 / 幅ゼロ / 高さゼロ は {} を返す', () => {
    expect(fitSelectionToScreen([], { x: 0, y: 0, width: 1000, height: 800 })).toEqual({})
    expect(fitSelectionToScreen(uniform(3), { x: 0, y: 0, width: 0, height: 800 })).toEqual({})
    expect(fitSelectionToScreen(uniform(3), { x: 0, y: 0, width: 1000, height: 0 })).toEqual({})
  })

  it('全カードに座標を返す', () => {
    const pos = fitSelectionToScreen(uniform(2), { x: 0, y: 0, width: 1000, height: 800 })
    expect(Object.keys(pos).sort()).toEqual(['c0', 'c1'])
  })

  it('全カードが rect 内（左上・右端・下端がはみ出さない）', () => {
    const rect = { x: 24, y: 80, width: 1440, height: 560 }
    const pos = fitSelectionToScreen(uniform(40, 0.8), rect)
    for (const id in pos) {
      const p = pos[id]
      expect(p.x).toBeGreaterThanOrEqual(rect.x - 0.5)
      expect(p.y).toBeGreaterThanOrEqual(rect.y - 0.5)
      expect(p.x + p.w).toBeLessThanOrEqual(rect.x + rect.width + 0.5)
      expect(p.y + p.h).toBeLessThanOrEqual(rect.y + rect.height + 0.5)
    }
  })

  it('各カードは入力の縦横比を保つ', () => {
    const cards = [
      { id: 'a', width: 200, height: 100 }, // aspect 2
      { id: 'b', width: 150, height: 300 }, // aspect 0.5
      { id: 'c', width: 120, height: 120 }, // aspect 1
    ]
    const pos = fitSelectionToScreen(cards, { x: 0, y: 0, width: 1000, height: 800 })
    expect(pos.a.w / pos.a.h).toBeCloseTo(2, 3)
    expect(pos.b.w / pos.b.h).toBeCloseTo(0.5, 3)
    expect(pos.c.w / pos.c.h).toBeCloseTo(1, 3)
  })

  it('どのカードも maxCardWidth を超えない（少数でも巨大化しない）', () => {
    const rect = { x: 0, y: 0, width: 2400, height: 900 }
    const pos = fitSelectionToScreen(uniform(3), rect, { maxCardWidth: 268, gapRatio: 0.36 })
    for (const id in pos) expect(pos[id].w).toBeLessThanOrEqual(268 + 0.5)
  })

  it('少数カードは中央に寄る（左上に固まらない・上に張り付かない）', () => {
    const rect = { x: 0, y: 0, width: 2400, height: 900 }
    const pos = fitSelectionToScreen(uniform(3), rect, { maxCardWidth: 268, gapRatio: 0.36 })
    const xs = Object.values(pos)
    const minX = Math.min(...xs.map((p) => p.x))
    const maxX = Math.max(...xs.map((p) => p.x + p.w))
    const leftMargin = minX - rect.x
    const rightMargin = rect.x + rect.width - maxX
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThan(2) // 左右余白ほぼ均等＝水平中央
    const minY = Math.min(...xs.map((p) => p.y))
    expect(minY - rect.y).toBeGreaterThan(50) // 上端に張り付いていない＝垂直中央寄せ
  })

  it('多数の均一カードは矩形の右端・下端まで充填する（bounding box が rect をほぼ埋める）', () => {
    const rect = { x: 24, y: 80, width: 1440, height: 560 }
    const pos = fitSelectionToScreen(uniform(60, 0.8), rect, { maxCardWidth: 268, gapRatio: 0.36 })
    const vals = Object.values(pos)
    const usedW = Math.max(...vals.map((p) => p.x + p.w)) - Math.min(...vals.map((p) => p.x))
    const usedH = Math.max(...vals.map((p) => p.y + p.h)) - Math.min(...vals.map((p) => p.y))
    expect(usedW).toBeGreaterThan(rect.width * 0.95) // 幅は端まで（justified の芯）
    expect(usedH).toBeGreaterThan(rect.height * 0.8) // 高さもほぼ端まで（旧 masonry の 0.77 を明確に超える）
  })

  it('隙間はカード高さに比例する（≈ gapRatio）', () => {
    const rect = { x: 0, y: 0, width: 1000, height: 800 }
    const cards = [
      { id: 'a', width: 100, height: 100 },
      { id: 'b', width: 100, height: 100 },
    ]
    // maxCardWidth を大きく取り上限を無効化 → 2枚は1行に並び幅いっぱいに拡大。
    const pos = fitSelectionToScreen(cards, rect, { maxCardWidth: 5000, gapRatio: 0.3 })
    const gap = pos.b.x - (pos.a.x + pos.a.w)
    expect(gap / pos.a.h).toBeCloseTo(0.3, 1)
  })

  it('N-40 回帰：board 実既定比率 × 100枚 × 短く広い rect でも全カード可視サイズ・rect 内（1px 崩壊なし）', () => {
    const CARD_WIDTH_DEFAULT_PX = 267.84
    const GAP_RATIO = 97.21 / 267.84
    const aspects = [0.6, 0.75, 1, 1.33, 1.5, 1.78, 0.5, 2.0]
    const cards = Array.from({ length: 100 }, (_, i) => {
      const ar = aspects[i % aspects.length]
      return { id: `c${i}`, width: CARD_WIDTH_DEFAULT_PX, height: CARD_WIDTH_DEFAULT_PX / ar }
    })
    const rect = { x: 24, y: 80, width: 1489 - 48, height: 679 - 80 - 120 }
    const pos = fitSelectionToScreen(cards, rect, { maxCardWidth: CARD_WIDTH_DEFAULT_PX, gapRatio: GAP_RATIO })
    expect(Object.keys(pos)).toHaveLength(100)
    for (const id in pos) {
      const p = pos[id]
      expect(p.x + p.w).toBeLessThanOrEqual(rect.x + rect.width + 0.5)
      expect(p.y + p.h).toBeLessThanOrEqual(rect.y + rect.height + 0.5)
    }
    const maxW = Math.max(...Object.values(pos).map((p) => p.w))
    expect(maxW).toBeGreaterThan(30)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `rtk vitest run lib/share/collage-layout.test.ts`
Expected: FAIL（型エラー：旧署名 `fitSelectionToScreen(cards, rect, opts)` の `opts` が number でない／`FitOptions` 未定義、または新アサーション不一致）。旧 describe（seed/move 等）は PASS のまま。

- [ ] **Step 3: `fitSelectionToScreen` を justified rows 充填に実装**

`lib/share/collage-layout.ts`：先頭の import に `BOARD_SLIDERS` を追加（`computeSkylineLayout`・`CardPosition` の import はそのまま）：

```ts
import { computeSkylineLayout } from '@/lib/board/skyline-layout'
import { BOARD_SLIDERS } from '@/lib/board/constants'
import type { CardPosition } from '@/lib/board/types'
```

ファイル末尾の現行 `fitSelectionToScreen`（`export function fitSelectionToScreen(...) { ... }` 全体、直上の `/** ... */` doc コメント含む）を次に**丸ごと置き換える**：

```ts
/** justified fill の既定値（spec §3.2）。サイズ上限＝盤面既定カード幅、隙間比＝盤面の
 *  CARD_GAP:CARD_WIDTH 比。呼び出し側は基本 opts を渡さず、これらの既定で動く。 */
const DEFAULT_MAX_CARD_WIDTH = BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX
const DEFAULT_GAP_RATIO = BOARD_SLIDERS.CARD_GAP_DEFAULT_PX / BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX

/** fitSelectionToScreen の任意設定。既定は盤面の値（DEFAULT_*）。 */
export type FitOptions = {
  /** カードのレンダリング幅の上限（px）。既定＝盤面既定カード幅。 */
  readonly maxCardWidth?: number
  /** 隙間 ÷ カード高さ。既定＝盤面の CARD_GAP:CARD_WIDTH 比。 */
  readonly gapRatio?: number
}

/** 1行の確定レイアウト（行高・各カード幅・行内 gap・使用幅）。 */
type RowLayout = {
  readonly ids: readonly string[]
  readonly widths: readonly number[]
  readonly height: number
  readonly gap: number
  readonly rowWidth: number
}

/**
 * 目標行高 targetH でカードを justified rows に割る。document 順に行へ流し込み、
 * 目標高での自然幅が rectWidth に達したら行を閉じ、その行を rectWidth ちょうどに満たす
 * 行高（閉形）で確定する。最後の部分行は引き伸ばさず targetH。各行は「その行の最大幅
 * カードが maxCardWidth を超えない」よう行高を頭打ちする。総高（行高＋行間 gap の和）も返す。
 */
function layoutAtTargetHeight(
  ids: readonly string[],
  aspects: readonly number[],
  targetH: number,
  rectWidth: number,
  gapRatio: number,
  maxCardWidth: number,
): { readonly rows: RowLayout[]; readonly totalHeight: number } {
  const n = ids.length
  const rows: RowLayout[] = []
  let start = 0
  while (start < n) {
    // start から順に足し、目標高 targetH での自然幅が rectWidth に達したら閉じる。
    let end = start
    let aspectSum = 0
    let closed = false
    while (end < n) {
      aspectSum += aspects[end]
      const count = end - start + 1
      const naturalW = aspectSum * targetH + (count - 1) * gapRatio * targetH
      end++
      if (naturalW >= rectWidth) {
        closed = true
        break
      }
    }
    const rowIds = ids.slice(start, end)
    const rowAspects = aspects.slice(start, end)
    const count = rowIds.length
    const sumA = rowAspects.reduce((a, b) => a + b, 0)
    let maxA = 0
    for (const a of rowAspects) if (a > maxA) maxA = a
    // 閉じた（満杯）行は幅ちょうどの行高、最後の部分行は目標 targetH。
    const hFill = closed ? rectWidth / (sumA + (count - 1) * gapRatio) : targetH
    // per-row cap: 最大幅カード（maxA * h）が maxCardWidth を超えない行高に頭打ち。
    const h = Math.min(hFill, maxA > 0 ? maxCardWidth / maxA : maxCardWidth)
    const gap = gapRatio * h
    const widths = rowAspects.map((a) => a * h)
    const rowWidth = widths.reduce((a, b) => a + b, 0) + (count - 1) * gap
    rows.push({ ids: rowIds, widths, height: h, gap, rowWidth })
    start = end
  }
  let totalHeight = 0
  for (let i = 0; i < rows.length; i++) {
    totalHeight += rows[i].height
    if (i < rows.length - 1) totalHeight += rows[i].gap // 行間は上の行の gap
  }
  return { rows, totalHeight }
}

/**
 * 選択カードを justified rows で rect に充填する（spec §3）。
 * - カードは縦横比だけ使う（盤面の絶対サイズ＝customWidth は無視）。
 * - 各行を rect 幅いっぱいに揃え、目標行高 H を二分探索して総高を rect 高さに合わせる
 *   ＝右も下も端まで充填。H の上限は maxCardWidth（それ以上は per-row cap で頭打ち）。
 * - 幅を満たさない行（cap が効いた行・最後の部分行）は水平中央寄せ、総高の残余は垂直中央寄せ
 *   ＝少数カードは巨大化せず中央にまとまる（左上に固まらない）。
 * - 座標は rect.x/rect.y を加えた画面px絶対座標（移動/リサイズ/回転はこの座標系のまま）。
 * - 空 / 幅ゼロ / 高さゼロ は {} を返す。
 */
export function fitSelectionToScreen(
  cards: readonly CollageElement[],
  rect: CollageFitRect,
  opts?: FitOptions,
): CollagePositions {
  if (cards.length === 0 || rect.width <= 0 || rect.height <= 0) return {}
  const maxCardWidth = opts?.maxCardWidth ?? DEFAULT_MAX_CARD_WIDTH
  const gapRatio = opts?.gapRatio ?? DEFAULT_GAP_RATIO

  const ids = cards.map((c) => c.id)
  const aspects = cards.map((c) => (c.height > 0 ? c.width / c.height : 1))

  const build = (H: number): { readonly rows: RowLayout[]; readonly totalHeight: number } =>
    layoutAtTargetHeight(ids, aspects, H, rect.width, gapRatio, maxCardWidth)

  // 目標行高 H を選ぶ。総高は H について概ね単調増加。maxCardWidth を上限に、
  // その上限でも rect.height に収まる（＝少数カード）ならそのまま中央寄せ。
  // 収まらなければ「収まる最大の H」を二分探索（＝最も埋まる）。
  const top = build(maxCardWidth)
  let chosen: { readonly rows: RowLayout[]; readonly totalHeight: number }
  if (top.totalHeight <= rect.height) {
    chosen = top
  } else {
    let lo = 0
    let hi = maxCardWidth
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2
      if (build(mid).totalHeight <= rect.height) lo = mid
      else hi = mid
    }
    chosen = build(lo)
  }

  // 総高の残余を垂直中央寄せ。
  const offsetY = rect.y + Math.max(0, (rect.height - chosen.totalHeight) / 2)
  const out: Record<string, CardPosition> = {}
  let y = offsetY
  for (const row of chosen.rows) {
    // 幅を満たさない行（cap／部分行）は水平中央寄せ。満杯行は rowWidth≈rect.width で offset≈0。
    const offsetX = rect.x + Math.max(0, (rect.width - row.rowWidth) / 2)
    let x = offsetX
    for (let i = 0; i < row.ids.length; i++) {
      const w = row.widths[i]
      out[row.ids[i]] = { x, y, w, h: row.height }
      x += w + row.gap
    }
    y += row.height + row.gap
  }
  return out
}
```

- [ ] **Step 4: テストを実行して緑を確認**

Run: `rtk vitest run lib/share/collage-layout.test.ts`
Expected: PASS（新 describe の全 it＋旧 describe の seed/move/resize/bringToFront）。

- [ ] **Step 5: 呼び出し側を新署名に追従（同一コミットに含める＝tsc を緑に保つ）**

署名変更は純関数と配線が不可分（BoardRoot が旧署名 `fitSelectionToScreen(cards, rect, COLLAGE_GAP_PX)` のままだと `COLLAGE_GAP_PX`(number) が `FitOptions` に不一致で tsc が赤）。よって同じタスク・同じコミットで配線も直す。

(a) `components/board/BoardRoot.tsx` の import 行（15行目）から `COLLAGE_GAP_PX` を除く：

```ts
import { BOARD_INNER, BOARD_SLIDERS, BOARD_TOP_PAD_PX, BOARD_Z_INDEX, ARRANGE_SAFE_INSET, CANVAS_MARGIN_PX } from '@/lib/board/constants'
```

(b) `handleEnterArrange` 内の呼び出し（2030行目付近）を第3引数なしにし、直上の COLLAGE gap 説明コメント2行を justified fill の説明へ更新：

```ts
    // justified rows で盤面パネル rect を端まで充填する（縦横比のみ使用・盤面既定サイズを
    // 上限に頭打ち・隙間はカード高さに比例）。少数カードは中央寄せ、多数は端までびっしり。
    setCollagePositions(fitSelectionToScreen(cards, rect))
```

(c) `lib/board/constants.ts` 末尾付近の `COLLAGE_GAP_PX` の doc コメント（`/** SHARE アレンジのカード間ギャップ … */`）と `export const COLLAGE_GAP_PX = 16` を削除（Grep 済＝参照は BoardRoot のみ）。`BOARD_SLIDERS`・`ARRANGE_SAFE_INSET`・`CANVAS_MARGIN_PX` は不変。

- [ ] **Step 6: 型チェック＋全テスト（全体が緑）**

Run: `rtk tsc`
Expected: エラー0（BoardRoot の署名不一致解消・`COLLAGE_GAP_PX` 未定義参照なし）。

Run: `rtk vitest run`
Expected: PASS（新 collage-layout テスト含む全スイート緑。`CollageCanvas.test.tsx` は不変 `seedCollagePositions` を使うので影響なし）。

- [ ] **Step 7: コミット（純関数＋配線を1コミット＝常に緑）**

```bash
rtk git add lib/share/collage-layout.ts lib/share/collage-layout.test.ts components/board/BoardRoot.tsx lib/board/constants.ts
rtk git commit -m "feat(share): justified-rows fill for arrange (edge-to-edge, aspect-preserving, board-size cap, proportional gap)"
```

---

## Task 2: 実機（Playwright）で充填率を実測 → 本番デプロイ

**Files:**
- Create: `C:/Users/masay/AppData/Local/Temp/claude/.../scratchpad/verify-justified-fill.mjs`（スクラッチ・追跡外）

**Interfaces:**
- Consumes: Task 1 の実装。到達手順は memory `reference_playwright_board_share_verify`（IDB を preseed してオンボ/データ modal を回避 → SHARE → SELECT ALL → ARRANGE）。
- Produces: content/rect 充填率の実測値（幅・高さ%）。

- [ ] **Step 1: 本番ビルド（out/ 生成）→ 検証スクリプトを書く（out/ をローカル配信して計測）**

まず `rtk pnpm build` で `out/` を生成（Task 1 では build を回していないためここで実施）。次に `playwright-skill` を使い、`out/` を静的配信 → `/board` を開く → IDB に 100 件相当を preseed → SHARE → SELECT ALL → ARRANGE → `collage-canvas` 内の全 `[data-testid^="collage-el-"]` の bounding rect を集計し、safe rect（`ARRANGE_SAFE_INSET` 適用後）に対する `usedW/rectW`・`usedH/rectH` を出す。ビューポートは一般多数派 `1920×1080 (dpr2)` と本人 `1489×679 (dpr2.58)`、加えてウルトラワイド `2560×1080` の3種で計測（各30枚/100枚）。

- [ ] **Step 2: 計測して充填率が現行より明確に上がることを確認**

Expected: 100枚で `usedW/rectW ≳ 0.95`、`usedH/rectH ≳ 0.85`（現行の 幅0.89/高さ0.77 から改善）。全カードが safe rect 内（画面外0）。スクショ目視で右・下のL字余白が消えていること。1px 崩壊なし。

- [ ] **Step 3: 本番デプロイ**

Run:
```bash
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```
Expected: `allmarks.app` に反映。ユーザーへ「`allmarks.app` をハードリロード」を案内。

- [ ] **Step 4: ユーザー実機目視の残を明示**

ジェスチャ（`setPointerCapture` で Playwright 不可）＝掴んで移動／隅リサイズ／回転が新配置でも自然か、少数カードの中央寄せの見た目、を引き継ぎメッセージに記す。

---

## Self-Review

- **Spec coverage**：spec §3.1（縦横比のみ）=Task1 aspects／§3.2（上限・隙間比の流用）=DEFAULT_*／§3.3（行高閉形）=layoutAtTargetHeight hFill／§3.4（per-row cap）=`Math.min(hFill, maxCardWidth/maxA)`／§3.5（行数=目標H探索）=二分探索／§3.6（中央寄せ・座標焼き込み）=offsetX/offsetY＋rect.x/y／§5 契約=Task1 テスト各 it／§6 影響範囲=Task1/2／§7 検証=Task3。全網羅。
- **Placeholder scan**：TBD/TODO なし。全ステップに実コード・実コマンド・期待値あり。
- **Type consistency**：`FitOptions`／`fitSelectionToScreen(cards, rect, opts?)`／`layoutAtTargetHeight(...)`／`RowLayout` は Task1 内で定義・使用が一致。Task2 は opts 省略で呼ぶ（型整合）。`BOARD_SLIDERS.CARD_WIDTH_DEFAULT_PX`／`CARD_GAP_DEFAULT_PX` は実在（constants.ts で確認済）。
- **既知の段階的赤**：Task1 Step5 で BoardRoot 呼び出し1行だけ tsc 赤（旧署名）→ Task2 で解消。想定通りで、コミット境界としては Task1（純関数＋テスト緑）／Task2（配線＋全体緑）に分ける。
