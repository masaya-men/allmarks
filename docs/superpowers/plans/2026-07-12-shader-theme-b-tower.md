# SHADER-THEME B: TOWER（超高層ビルの全窓＝カード・レイアウト連動テーマ）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **実行時期: 公開（ソフトローンチ・束D/E）より前**（ユーザー決定 s187「できれば公開までに作ってしまいたい」）。目安 1.5〜2 セッション。**Plan A（cyber-space）より先に実行する**＝共通土台（`shader-layer.ts`・`ThemeMeta.webglBackground`）はこの計画が作る。

**Goal:** 新テーマ `tower` を追加する。ボードが「夜の超高層マンションの外壁」になり、**全てのカードが窓に入る**。空いている窓には部屋の中が見え（暖色の灯り・青白い部屋・暗い部屋。インテリアマッピング＝視差で覗く角度が変わる）、スクロールすると上下の階が続く。時々どこかの部屋の灯りが変わる（MOTION OFF で停止）。

**Architecture:** 2 つの部品で成立する。**(1) レイアウト連動**: `MOBILE_LAYOUT` と同じ「表示時 override・保存値不変」パターンで、tower 選択中だけ全カードを同一セル寸（幅・高さとも固定）で `computeSkylineLayout` に流す＝等寸なら skyline は自然に整然とした格子になる（新レイアウトエンジン不要）。**(2) WebGL 外壁**: 新部品 `TowerLayer`（raw WebGL・依存ゼロ・1 パス）が viewport 固定 canvas に外壁＋窓＋部屋を描く。**窓の格子はカードと 1px 単位で一致**させる — カード群の translate ラッパに目印属性を付け、TowerLayer が毎フレーム `getBoundingClientRect()` で「コンテンツ原点の画面座標」を読んで shader の `u_origin` に渡す（スクロール・リサイズ・モバイルの実スクロールに自動追従）。格子はコンテンツ範囲の外にも無限に続く＝カードの無い窓すべてに部屋が見える。撮影は `capturing` 中だけ canvas をスナップショット `<img>` に差し替え（dom-to-image が生 canvas を写す保証が無いため）。s187 モックで GLSL・格子整合・視差は検証済み。

**Tech Stack:** raw WebGL1（新規依存ゼロ）/ TypeScript strict / Vanilla CSS Modules / vitest / Playwright

## 設計判断（s187 ユーザー承認済み＋本計画で確定）

- 見た目 = s187 モックの **B · TOWER**（承認済み）。夜の外壁・窓格子・空き窓の部屋（暖色/青白/暗）・灯りの変化・視差。
- **tier: `'free'` で公開**（ローンチの目玉・拡散兵器。プレミアム化は将来の判断。正: `docs/private/2026-07-12-monetization-recheck-s187.md` §s187追記。ユーザーの 1 行確認が未了なら着手時に確認する）。
- `kind: 'work'`・`colorScheme: 'dark'`・`scrollMeterVariant: 'waveform'`・`direction: 'vertical'`・`webglBackground: true`。
- **tower 中はカード寸が窓に揃う**（ユーザー了解済みの設計帰結）: ヘッダーの Size・TUNE の W/G・カード四隅のリサイズは**表示に効かない**（保存値は不変。テーマを戻せば元通り）。四隅リサイズハンドルは tower 中は出さない（効かない操作を見せない）。
- **セル寸はまず「幅・高さとも固定」**（窓らしさ最優先・`TOWER_UNIFORM_HEIGHT = true`）。文字カード等が固定高で破綻する場合のフォールバックは定数 1 個で「幅固定・高さ自然」（＝窓の高さが階ごとに揃わないビル）に切替できる構造にする。判定は Task 6 の実測で行う。
- 視差の入力: スクロール（両プラットフォーム）＋デスクトップのみマウス。`prefers-reduced-motion` で 0。MOTION OFF は時間（灯りの変化・ドリフト）だけ凍結し、入力視差は生きる（use-paper-parallax の既存ポリシー）。
- 受け取り画面（/s/）は v1 では外壁を描かない（ペイロードのテーマ id で暗色トークンのみ・カード寸は送信値で揃って届く）。共有「画像」にはスナップショット差し替えで外壁ごと写る＝拡散素材は成立。

## Global Constraints

- TypeScript `strict: true`。`any` 禁止。return type 明示。CSS は `.module.css`。Tailwind / Framer Motion / three.js 追加 禁止（raw WebGL・新規依存ゼロ）
- **既定テーマと他テーマの描画・レイアウトはバイト同一**。レイアウト override も新レイヤーも `themeMeta.id === 'tower'` ゲートの内側のみ。**保存値（cardWidthPx / cardGapPx / customWidths / BoardConfig）には一切書かない**
- 4K fill-rate 予算: DPR ≤ 1.5・1 パス・テーマ非選択時 unmount
- z-index は既存 `BOARD_Z_INDEX.THEME_BG`(0)
- セル寸・余白の定数は `lib/board/constants.ts` の `TOWER_LAYOUT` に集約（マジックナンバー禁止・実機で調整するのはここだけ）
- i18n: `board.theme.tower` = "Tower"（全 15 言語同一・訳さない）
- git は `rtk` 前置。`--no-verify` 絶対禁止。vitest は `rtk npx vitest run <file>`、Playwright は素の `npx playwright test`

## 事実の索引（s187 調査済み）

- **表示時 override の先例（このまま写す）**: BoardRoot.tsx L1067-1090。`layoutCardWidthPx / layoutCardGapPx / layoutCustomWidths` を `isMobile` で差し替え、保存値は触らない。この `layout*` が skyline 計算（L1107-1115）と CardsLayer props（L3236-3256）の両方に流れる
- skyline: `computeSkylineLayout({cards:[{id,width,height}], containerWidth, gap})`（`lib/board/skyline-layout.ts:94`）。**等寸カードを流せば左上から行順に詰まる＝格子**（lowest-leftmost）。カード高さの供給元は `skylineCards`（BoardRoot L1095-1105・`itemSkylineHeight(it, w)`）
- 「全カード同寸の厳密格子」は既存に**無い**（s187 断言）。等寸 skyline がその代替
- スクロールの真実 = `viewport {x,y}`（BoardRoot L327）。デスクトップ=transform、モバイル=scrollTop ミラー（L1205-1211）。カード群は translate ラッパ（デスクトップ L3318 / モバイル L3304）の中
- 背景の器（viewport 固定）: patternLayer（L3129-3149）と同型に置く。`InteractionLayer` 直下・translate ラッパ外・`inset:0; zIndex:THEME_BG; pointerEvents:'none'`
- テーマ追加で触るファイル・永続・`[data-theme-id]`・MOTION・撮影まわりの事実は **Plan A（`2026-07-12-shader-theme-a-cyber-space.md`）の「事実の索引」と同一**（同じ調査の成果）。撮影＝`.outerFrame` 丸ごと・canvas 実績なし・`capturing` state（L1620）
- リサイズハンドルのゲート先例: CardsLayer L1587 `!isMobile`（モバイルで非描画）
- s187 モック（GLSL 検証済み）: `docs/private/theme-mockups/2026-07-12-shader-mock-v2.html`（Plan A Task 0 と同じ保全物。**この計画を先に実行する場合はここで保全する**）— `FRAG_TOWER` と `HEAD`（`roomHit`）が正

---

### Task 0: モック GLSL の保全＋共通土台（Plan A Task 0/2 の先取り） 【Sonnet 推奨】

- [ ] **Step 1:** s187 モック HTML を `docs/private/theme-mockups/2026-07-12-shader-mock-v2.html` に保存（未保存の場合）。gitignored 確認。
- [ ] **Step 2:** **Plan A の Task 2 Step 3 の `lib/board/shader-layer.ts` と、その 2 テスト（`shader-layer.test.ts` の該当分）をそのまま実装する**（コードは Plan A に全文あり。写経）。
- [ ] **Step 3:** **Plan A の Task 1 Step 1 の `ThemeMeta.webglBackground?: boolean` 追加**もここで行う（types.ts）。
- [ ] **Step 4:**

```bash
rtk npx vitest run lib/board/shader-layer.test.ts && rtk tsc
rtk git add lib/board/shader-layer.ts lib/board/shader-layer.test.ts lib/board/types.ts
rtk git commit -m "feat(theme): shared raw-WebGL shader-layer runtime + webglBackground meta flag (tower groundwork)"
```

（Plan A を後で実行するときは、この 2 つが既に在るので該当 Step をスキップする。）

---

### Task 1: テーマ登録＋`TOWER_LAYOUT` 定数 【Haiku 可】

**Files:**
- Modify: `lib/board/types.ts`（ThemeId に `| 'tower'`）
- Modify: `lib/board/theme-registry.ts`
- Modify: `lib/board/constants.ts`（`TOWER_LAYOUT`）
- Modify: `components/board/themes.module.css` / `app/globals.css` / `components/board/ThemePicker.module.css` / `messages/*.json` ×15

- [ ] **Step 1: registry**（paper-atelier の直後）:

```ts
  'tower': {
    id: 'tower',
    direction: 'vertical',
    backgroundClassName: 'tower',
    labelKey: 'board.theme.tower',
    colorScheme: 'dark',
    tier: 'free', // ローンチの目玉（無料）。プレミアム化の判断は private メモ s187 が正
    kind: 'work',
    scrollMeterVariant: 'waveform',
    motion: { entry: 'tower-drift', text: 'tower-underline', shutdown: 'tower-fade' },
    webglBackground: true,
  },
```

- [ ] **Step 2: `TOWER_LAYOUT`**（`lib/board/constants.ts`、`MOBILE_LAYOUT` の直後）:

```ts
/** tower テーマの窓格子（DISPLAY-time only — MOBILE_LAYOUT と同じ思想で、
 *  ユーザーの保存値 card-width/gap/customWidths には一切書かない）。
 *  実機の見た目調整はここだけ変える。GAP は縦横共通（skyline の gap が 1 値のため）。 */
export const TOWER_LAYOUT = {
  CELL_W_PX: 190,
  CELL_H_PX: 230,
  GAP_PX: 44,
  SIDE_MARGIN_PX: 64,
  MOBILE: { COLUMNS: 2, GAP_PX: 30, SIDE_MARGIN_PX: 16, CELL_H_PX: 200 },
  /** false にすると「幅固定・高さ自然」（文字カードが固定高で破綻した場合の逃げ道） */
  UNIFORM_HEIGHT: true,
} as const
```

- [ ] **Step 3: CSS / i18n / スウォッチ**

`themes.module.css`:

```css
/* tower: WebGL 外壁が主役。これは WebGL 不可時の静的フォールバック地。canvas/GPU 禁止。 */
.tower {
  background: linear-gradient(180deg, #101014 0%, #0a0a0d 55%, #07070a 100%);
}
```

`app/globals.css`:

```css
/* ============ theme: tower ============ */
html[data-theme-id="tower"] {
  --bg-dark: #0a0a0d;
  --bg-outer: #060608;
  --card-radius: 4px; /* 窓は角ばる（カードの角丸 token を窓らしく） */
}
```

`ThemePicker.module.css`: `.preview[data-theme-id='tower'] { background: #0b0c10; }`
`messages/*.json` ×15: `board.theme.tower` = `"Tower"`。

- [ ] **Step 4: 検証 → Commit**

```bash
rtk tsc && rtk vitest run
rtk git add lib/board/types.ts lib/board/theme-registry.ts lib/board/constants.ts components/board/themes.module.css app/globals.css components/board/ThemePicker.module.css messages
rtk git commit -m "feat(theme): register tower work theme + TOWER_LAYOUT display constants"
```

---

### Task 2: レイアウト連動（表示時 override・格子化） 【Sonnet 推奨（BoardRoot の芯）】

**Files:**
- Modify: `components/board/BoardRoot.tsx`（L1067-1105 の layout 系）
- Modify: `components/board/CardsLayer.tsx`（リサイズハンドルのゲート 1 条件）
- Test: `tests/e2e/theme-tower.spec.ts`（Task 5 でまとめて）

**Interfaces:**
- Produces: `isTowerTheme: boolean`、`towerCols/towerCellW/towerCellH/towerGap/towerSidePad`（BoardRoot 内ローカル）。CardsLayer 新 prop `disableResize?: boolean`

- [ ] **Step 1: BoardRoot の layout override 拡張**

L1067-1090 の override ブロックを次の形に拡張（**isMobile の既存式は 1 文字も変えず**、tower 分岐を重ねる）:

```ts
  const isTowerTheme = themeMeta.id === 'tower'
  // tower: 列数を確定してから左右余白を均等化（窓の格子が画面中央に来る）
  const towerCellW = isMobile
    ? Math.floor((viewport.w - 2 * TOWER_LAYOUT.MOBILE.SIDE_MARGIN_PX - (TOWER_LAYOUT.MOBILE.COLUMNS - 1) * TOWER_LAYOUT.MOBILE.GAP_PX) / TOWER_LAYOUT.MOBILE.COLUMNS)
    : TOWER_LAYOUT.CELL_W_PX
  const towerCellH = isMobile ? TOWER_LAYOUT.MOBILE.CELL_H_PX : TOWER_LAYOUT.CELL_H_PX
  const towerGap = isMobile ? TOWER_LAYOUT.MOBILE.GAP_PX : TOWER_LAYOUT.GAP_PX
  const towerCols = Math.max(1, Math.floor((viewport.w - 2 * (isMobile ? TOWER_LAYOUT.MOBILE.SIDE_MARGIN_PX : TOWER_LAYOUT.SIDE_MARGIN_PX) + towerGap) / (towerCellW + towerGap)))
  const towerSidePad = Math.max(0, Math.round((viewport.w - (towerCols * (towerCellW + towerGap) - towerGap)) / 2))
```

既存の 3 行（L1088-1090）を差し替え:

```ts
  const layoutCardWidthPx = isTowerTheme ? towerCellW : (isMobile ? mobileCardWidth : cardWidthPx)
  const layoutCardGapPx = isTowerTheme ? towerGap : (isMobile ? MOBILE_LAYOUT.GAP_PX : cardGapPx)
  const layoutCustomWidths = isTowerTheme || isMobile ? EMPTY_CUSTOM_WIDTHS : customWidths
```

`layoutSidePaddingPx`（L1079）も tower 分岐を足す:

```ts
  const layoutSidePaddingPx = isTowerTheme ? towerSidePad : (isMobile ? MOBILE_LAYOUT.SIDE_MARGIN_PX : BOARD_INNER.SIDE_PADDING_PX)
```

- [ ] **Step 2: 高さの固定**

`skylineCards`（L1095-1105）の高さ式を差し替え:

```ts
      const h = isTowerTheme && TOWER_LAYOUT.UNIFORM_HEIGHT ? towerCellH : itemSkylineHeight(it, w)
```

（依存配列に `isTowerTheme, towerCellH` を追加。）

- [ ] **Step 3: リサイズハンドルを tower 中は出さない**

CardsLayer に prop 追加:

```ts
  /** true = 四隅リサイズを描画しない（tower テーマ: 表示寸が窓に固定され、
   *  リサイズしても見た目に効かないため。保存値は不変・テーマを戻せば復活）。 */
  readonly disableResize?: boolean
```

L1587 付近の `!isMobile && …`（ResizeHandle/CardCornerActions の描画条件）に `&& !disableResize` を追加。BoardRoot から `disableResize={isTowerTheme}` を渡す（L3236-3256 の props 塊）。

- [ ] **Step 4: 検証 → Commit**

```bash
rtk tsc && rtk vitest run && pnpm build
rtk git add components/board/BoardRoot.tsx components/board/CardsLayer.tsx
rtk git commit -m "feat(board): tower display-time layout override — uniform window grid, resize hidden (values untouched)"
```

---

### Task 3: `TowerLayer`（外壁＋窓＋部屋の WebGL） 【Sonnet 推奨】

**Files:**
- Create: `components/board/TowerLayer.tsx`
- Test: `components/board/TowerLayer.test.tsx`

**Interfaces:**
- Consumes: Task 0 の `createShaderLayer`（`extra` uniform で `u_grid`/`u_origin` を渡す）
- Produces: `TowerLayer({ cellW, cellH, gap, motionEnabled, capturing })` — 格子原点は **`[data-board-content-anchor]` 要素の getBoundingClientRect() から毎フレーム自動取得**（Task 4 で BoardRoot 側に目印を付ける）。testid: `tower-root` / `tower-layer`（canvas）/ `tower-snapshot`（img）。root に `data-origin-x` / `data-origin-y`（現在の格子原点・CSS px）を毎フレーム反映＝e2e の整合検証用

- [ ] **Step 1: Write the failing test**

`components/board/TowerLayer.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TowerLayer } from './TowerLayer'

describe('TowerLayer', () => {
  it('mounts a pointer-transparent viewport layer at THEME_BG and survives without WebGL', () => {
    render(<TowerLayer cellW={190} cellH={230} gap={44} motionEnabled={true} capturing={false} />)
    const root = screen.getByTestId('tower-root')
    expect(root.style.zIndex).toBe('0')
    expect(root.style.pointerEvents).toBe('none')
    expect(screen.getByTestId('tower-layer').tagName).toBe('CANVAS')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
rtk npx vitest run components/board/TowerLayer.test.tsx
```

- [ ] **Step 3: Implement**

構造は Plan A の `CyberSpaceLayer` と同一（rAF ループ・DPR≤1.5・capturing スナップショット・context-lost で静的地へ）。違いは 3 点だけ:

1. **GLSL** = モックの `HEAD` + `FRAG_TOWER` を移植。ただし**格子の範囲制限（`u_count` と `inGrid` 判定）を削除**し、`idx` が負でも大でも常に窓を描く＝ビルが全方向に無限に続く（スクロールで階が続く）。`u_grid = (cellW, cellH, gap, gap)`・`u_origin = 格子原点(device px)`。
2. **格子原点の自動追従**（コンテンツ整合の芯）:

```ts
  // カード群の translate ラッパ（Task 4 で data-board-content-anchor を付与）の画面位置を
  // 毎フレーム読む。transform は layout を汚さないので getBoundingClientRect は安価。
  const anchorRef = useRef<Element | null>(null)
  // rAF ループ内:
  if (anchorRef.current === null) anchorRef.current = document.querySelector('[data-board-content-anchor]')
  const rect = anchorRef.current?.getBoundingClientRect()
  const originX = (rect?.left ?? 0) + sidePadOffsetPx // skyline の x=0 がラッパ内のどこかは Task 4 の実測で確定（既定 0）
  const originY = rect?.top ?? 0
  root.dataset.originX = String(Math.round(originX))
  root.dataset.originY = String(Math.round(originY))
  handle.render({ time, cam, extra: {
    u_grid: [cellW * dpr, cellH * dpr, gap * dpr, gap * dpr],
    u_origin: [originX * dpr, originY * dpr],
  } })
```

3. **視差入力**: `u_cam` = マウス（`matchMedia('(pointer:fine)')` のときだけ mousemove を購読・-1..1）＋スクロールは原点追従が担うので加算不要。`prefers-reduced-motion` で `[0,0]` 固定。MOTION OFF は `time` 凍結のみ（灯りの変化とドリフトが止まる）。

- [ ] **Step 4: Run to verify it passes → Commit**

```bash
rtk npx vitest run components/board/TowerLayer.test.tsx && rtk tsc
rtk git add components/board/TowerLayer.tsx components/board/TowerLayer.test.tsx
rtk git commit -m "feat(theme): TowerLayer — infinite night facade with interior-mapped rooms, grid locked to card anchor"
```

---

### Task 4: BoardRoot 配線（レイヤー・目印・原点整合の実測） 【Sonnet 推奨】

**Files:**
- Modify: `components/board/BoardRoot.tsx`

- [ ] **Step 1:** カード群の translate ラッパ（デスクトップ L3318 / モバイル L3304 の**両方**）に `data-board-content-anchor` 属性を追加（描画には無影響の目印）。
- [ ] **Step 2:** patternLayer ブロック直後（Plan A と同じ位置）に:

```tsx
        {hydrated && themeMeta.id === 'tower' && (
          <TowerLayer
            cellW={towerCellW}
            cellH={towerCellH}
            gap={towerGap}
            motionEnabled={motionEnabled}
            capturing={capturing}
          />
        )}
```

- [ ] **Step 3: 原点整合の実測（この計画で一番大事な確認）** — dev サーバーで tower を選び、DevTools で:

```js
const a = document.querySelector('[data-board-content-anchor]').getBoundingClientRect()
const c = document.querySelector('[data-bookmark-id]').getBoundingClientRect()
console.log('anchor→first card offset:', c.left - a.left, c.top - a.top)
```

オフセットが (0,0) でなければ（＝skyline の x=0/y=0 がラッパ内で side padding や top padding だけずれている）、その実測値を `TowerLayer` の `sidePadOffsetPx` / origin 計算に反映する（BoardRoot から `originOffset={{x: …, y: …}}` prop で渡す形にしてよい。**目で見て窓とカードが 1px 単位で一致するまで**）。

- [ ] **Step 4: 検証 → Commit**

```bash
rtk tsc && rtk vitest run && pnpm build
rtk git add components/board/BoardRoot.tsx components/board/TowerLayer.tsx
rtk git commit -m "feat(board): mount TowerLayer, anchor facade grid to the cards wrapper (1px alignment)"
```

---

### Task 5: e2e（格子・整合・非回帰） 【Sonnet 推奨】

**Files:**
- Create: `tests/e2e/theme-tower.spec.ts`

- [ ] **Step 1: テストを書く**（seed とテーマ選択は Plan A の `selectCyberSpace` パターンの `themeId: 'tower'` 版。カード 12 枚 seed）:

```ts
test('tower turns the board into a uniform window grid (stored sizes untouched)', async ({ page }) => {
  // seed 12 cards → tower 選択 → 全カードの rect が同一寸・列 x が towerCols 本に揃う
  const rects = await page.locator('[data-bookmark-id]').evaluateAll((els) =>
    els.map((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height) } }))
  const w0 = rects[0]?.w; const h0 = rects[0]?.h
  for (const r of rects) { expect(r.w).toBe(w0); expect(r.h).toBe(h0) }
  const xs = new Set(rects.map((r) => r.x))
  expect(xs.size).toBeLessThanOrEqual(8) // 列の x が有限本に量子化されている＝格子
})

test('facade grid origin tracks the first card within 1px', async ({ page }) => {
  const origin = await page.getByTestId('tower-root').evaluate((el) => ({
    x: Number((el as HTMLElement).dataset.originX), y: Number((el as HTMLElement).dataset.originY),
  }))
  const card = await page.locator('[data-bookmark-id]').first().boundingBox()
  expect(Math.abs((card?.x ?? 0) - origin.x)).toBeLessThanOrEqual(1)
  expect(Math.abs((card?.y ?? 0) - origin.y)).toBeLessThanOrEqual(1)
  // スクロール後も追従する
  await page.mouse.wheel(0, 600)
  await page.waitForTimeout(400)
  const origin2 = await page.getByTestId('tower-root').evaluate((el) => ({
    x: Number((el as HTMLElement).dataset.originX), y: Number((el as HTMLElement).dataset.originY),
  }))
  const card2 = await page.locator('[data-bookmark-id]').first().boundingBox()
  expect(Math.abs((card2?.x ?? 0) - origin2.x)).toBeLessThanOrEqual(1)
  expect(Math.abs((card2?.y ?? 0) - origin2.y)).toBeLessThanOrEqual(1)
})

test('switching back to the default theme restores the stored layout (no writes)', async ({ page }) => {
  // tower → dotted-notebook に戻す → カード幅がバラバラ（保存値のまま）に戻る・tower-root は消える
})

test('default theme never mounts tower (byte-identical guard)', async ({ page }) => {
  await expect(page.getByTestId('tower-root')).toHaveCount(0)
})
```

（フル実装は Plan A の spec と同じ道具立て。原点整合テストが**この機能の回帰網の本体**。）

- [ ] **Step 2:**

```bash
npx playwright test tests/e2e/theme-tower.spec.ts tests/e2e/mobile-share.spec.ts
rtk git add tests/e2e/theme-tower.spec.ts
rtk git commit -m "test(e2e): tower grid uniformity + facade-origin 1px tracking + default guards"
```

---

### Task 6: 見た目の仕上げ実測→デプロイ→実機確認依頼 【Sonnet 推奨＋ユーザー実機】

- [ ] **Step 1: 固定高の破綻チェック（UNIFORM_HEIGHT の判定）** — Playwright 1489×679 と 390×844 で、画像カード・文字カード・ツイートカードを seed してスクショ。文字カードが固定高 230px で崩れる（文字の見切れ方が醜い等）なら `TOWER_LAYOUT.UNIFORM_HEIGHT = false` に切替えて再スクショし、良い方を採る（どちらでも窓格子の x 整列は保たれる）。
- [ ] **Step 2: 検証一式→デプロイ**

```bash
rtk tsc && rtk vitest run && pnpm build
npx playwright test tests/e2e/theme-tower.spec.ts tests/e2e/theme-cyber-space.spec.ts tests/e2e/mobile-share.spec.ts
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

（cyber-space 未実装の時点では該当 spec をスキップ。）

- [ ] **Step 3: ユーザー実機確認（コピペ）**

```
PC とスマホで https://allmarks.app → THEMES → WORKS → Tower:
1. ボードが「夜のビルの外壁」になり、全カードが窓に入っていますか（窓とカードのズレは？）
2. カードの無い窓に部屋の中（灯り/暗い部屋）が見えますか。マウス/スクロールで覗く角度が変わりますか
3. スクロールすると上下の階が続きますか（端で外壁が切れないか）
4. 文字だけのカードの見た目は許せますか（ここで窓の寸法・高さ固定/自然を最終決定 → TOWER_LAYOUT 調整）
5. MOTION OFF → 灯りの変化が止まり完全静止しますか
6. SHARE → 共有画像に外壁ごと写っていますか（ここが拡散素材の生命線）
7. テーマを戻すと元のレイアウト（カードの大きさバラバラ）に完全に戻りますか
```

- [ ] **Step 4: 記録** — TODO.md 更新（TOWER 出荷・実機結果）。`docs/private/2026-07-12-monetization-recheck-s187.md` §3 の「プレミアムテーマ現状」を更新（TOWER=無料の看板として出荷済み、シェーダー有料枠は A 以降）。

## Self-Review 済みの注意点（実装者へ）

- **保存値には絶対書かない**。tower の格子は `layout*` の表示時 override だけで作る（MOBILE_LAYOUT L50-57 の掟）。テーマを戻した瞬間に元のボードが完全復元されるのが正しさの定義。
- **整合の芯は「anchor 実測 → u_origin」**。viewport.y を自前で再計算して渡す設計にしない（デスクトップ transform とモバイル scrollTop の二重系を 1 本で吸収できるのが実測方式の利点）。
- モバイルのネイティブスクロール中、rAF と scroll イベントの位相差で外壁が 1 フレーム遅れて見える可能性がある（実測事項）。気になる場合は `position: sticky` 化ではなく「モバイルでは canvas をスクロールコンテナ内に置く」改修を検討（follow-up。まず実機）。
- 等寸 skyline の格子は「最後の行が左詰めで欠ける」= ビルの最上階（DESC 順なので**最新カードが最上段**）が部分的に埋まる。これは意図（ビルはまだ建設中）。
- 灯りの hash は `idx`（格子座標）基準＝スクロールしても同じ窓は同じ部屋（世界が安定して見える）。`u_time` は灯りの変化にだけ使う。
- 撮影は snapshot 差し替え（Plan A と同じ理由・同じ機構）。`fit:'cover'`・帯・レプリカ禁止など SHARE の不変条件はこの計画では触れない（背景が写るだけ）。
- Instagram 的な「窓の中で動画が再生」等は Tier1 再生ポリシー（1 real play + slideshow）のまま＝この計画はレイアウトと背景だけ。
- ThemePicker のスウォッチは単色地（既存仕様）。「実ボードが即プレビュー」という既存思想どおり、選べばボードがビルになるのがプレビュー。
