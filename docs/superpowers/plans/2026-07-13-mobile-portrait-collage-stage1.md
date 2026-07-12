# スマホ縦4:5コラージュ 段階1（土台）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホの SHARE コラージュ編集を縦 4:5 キャンバスにし、撮影・保存を縦画像に、リンクカード用の 1.91:1 は縦画像を中央レターボックスで自動併産する。見た目のチロムは現状のまま（プレミアム化は段階2）。

**Architecture:** 帯計算をアスペクト引数で一般化し、モバイル ARRANGE は縦4:5帯を使う（fit も overlay も縦になる）。撮影レンダラー（`renderCollageCanvasToJpeg`）はアスペクト非依存なので、縦の w/h を渡すだけで縦画像を撮る。リンクカードは撮った縦画像を `letterboxImageToAspect` で 1.91:1 ボード色キャンバスの中央に描いて併産し、それをホストする（サーバー・OG route・payload は無改変＝ホストする OG は 1.91:1 のまま）。全てモバイル経路のみ、デスクトップはバイト同一。

**Tech Stack:** Next.js 14 App Router / TypeScript strict / Vanilla CSS Modules / vitest + @testing-library/react / Playwright

**設計書（正本）:** `docs/superpowers/specs/2026-07-13-mobile-portrait-collage-redesign-design.md`

## Global Constraints

- TS `strict`。`any` 禁止。return type 明示。CSS は `.module.css`。z-index は `BOARD_Z_INDEX`。
- **デスクトップ（>640px）はバイト同一**: 変更は全て `isMobile` のモバイル経路。desktop の `handleCreateHostedShare` / `captureCollageShareImage`(dom-to-image) / `ShareToast` は無改変。
- **共有サーバーは無改変**: `/api/share/create`・`SHARE_KV`・`SHARE_OG`(R2)・`functions/og/[id].ts`・`functions/s/patch-share-html.ts`（`og:image:width/height=1200/630`）・`ShareDataV2` payload は触らない。**ホストする OG 画像は 1.91:1 のまま**（縦画像をレターボックス済み）＝メタは正しい。
- **撮影レンダラー `renderCollageCanvasToJpeg` は無改変**（出力 w/h を引数で受けるアスペクト非依存・中に 1.91:1 リテラルは無い）。
- 編集した位置/サイズ/回転/重なり順は完成画像に反映（z順=`collageOrder`）を維持。
- git `rtk` 前置。`--no-verify` 禁止。ASCII commit body。**vitest は素の `npx vitest run <file>`**、**Playwright も素の `npx playwright test`**（`rtk npx` は壊れる）。競合名を tracked ファイルに書かない。

## File Structure

- Modify `lib/share/mobile-band.ts`（＋ `mobile-band.test.ts`）— アスペクト一般化＋縦定数＋縦帯関数。
- Create `lib/share/letterbox.ts`（＋ `letterbox.test.ts`）— contain-fit 純関数＋縦→1.91:1 併産。
- Modify `components/board/BoardRoot.tsx` — モバイル ARRANGE を縦帯に／撮影を縦に／リンクカード併産。
- Modify `components/board/MobileShareResult.module.css` — プレビューを 4:5 に。
- Modify `tests/e2e/mobile-share.spec.ts` — 縦4:5 前提に更新。

---

### Task 1: `mobile-band.ts` — アスペクト一般化＋縦4:5帯 【cheap 可】

**Files:**
- Modify: `lib/share/mobile-band.ts`
- Test: `lib/share/mobile-band.test.ts`（既存に追記）

**Interfaces:**
- Produces:
  - `export const SHARE_PORTRAIT_ASPECT = { WIDTH: 1080, HEIGHT: 1350 } as const`（4:5）
  - `export function collageBandRect(frameW, frameH, aspectW, aspectH): CollageFitRect`
  - `export function mobileCollagePortraitBandRect(frameW, frameH): CollageFitRect`
  - 既存 `mobileCollageBandRect` / `mobileCaptureScale` / `SHARE_OG_ASPECT` は挙動不変（後方互換）。

- [ ] **Step 1: Write the failing test**

`lib/share/mobile-band.test.ts` に追記（先頭 import に `SHARE_PORTRAIT_ASPECT, mobileCollagePortraitBandRect, collageBandRect` を足す。既存 import シンボルは残す）:

```ts
describe('mobileCollagePortraitBandRect (4:5 portrait)', () => {
  it('inscribes a centred 4:5 band in a tall phone frame', () => {
    // 390x844: portrait band keeps full width, height = 390 * 1350/1080 = 487.5, y-centred
    expect(mobileCollagePortraitBandRect(390, 844)).toEqual({ x: 0, y: 178.25, width: 390, height: 487.5 })
  })

  it('keeps the 4:5 ratio and caps sides on a wide frame', () => {
    // 844x390 wide: keeps full height, width = 390 * 1080/1350 = 312, x-centred
    const b = mobileCollagePortraitBandRect(844, 390)
    expect(b).toEqual({ x: 266, y: 0, width: 312, height: 390 })
    expect(b.width / b.height).toBeCloseTo(1080 / 1350) // 0.8 = 4:5
  })

  it('returns empty on a degenerate frame', () => {
    expect(mobileCollagePortraitBandRect(0, 844)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})

describe('collageBandRect (generalised)', () => {
  it('matches mobileCollageBandRect for the 1.91:1 aspect', () => {
    expect(collageBandRect(390, 844, 1200, 630)).toEqual(mobileCollageBandRect(390, 844))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run lib/share/mobile-band.test.ts
```

Expected: FAIL — `collageBandRect` / `mobileCollagePortraitBandRect` / `SHARE_PORTRAIT_ASPECT` が存在しない。

- [ ] **Step 3: Implement**

`lib/share/mobile-band.ts` を編集:

1. `SHARE_OG_ASPECT` の宣言（L15）の直後に追加:

```ts
/** モバイルのコラージュ主役＝縦 4:5（保存＆縦向き共有）。段階1 は 4:5 固定。 */
export const SHARE_PORTRAIT_ASPECT = { WIDTH: 1080, HEIGHT: 1350 } as const
```

2. `mobileCollageBandRect`（L29-41）を、一般化した `collageBandRect` ＋ 薄いラッパに置き換える:

```ts
/**
 * フレーム内に中央に収まる `aspectW:aspectH` の帯（`.outerFrame` 座標）。
 * フレームが指定比より横長 → 全高を使い左右を削る。縦長 → 全幅を使い上下を削る。
 * クロス乗算で誤差を避ける。
 */
export function collageBandRect(
  frameW: number,
  frameH: number,
  aspectW: number,
  aspectH: number,
): CollageFitRect {
  if (frameW <= 0 || frameH <= 0) return EMPTY_RECT
  const frameIsWider = frameW * aspectH > frameH * aspectW
  if (frameIsWider) {
    const width = (frameH * aspectW) / aspectH
    return { x: (frameW - width) / 2, y: 0, width, height: frameH }
  }
  const height = (frameW * aspectH) / aspectW
  return { x: 0, y: (frameH - height) / 2, width: frameW, height }
}

/** スマホの自動配置矩形（横 1.91:1・リンクカード相当）。後方互換で温存。 */
export function mobileCollageBandRect(frameW: number, frameH: number): CollageFitRect {
  return collageBandRect(frameW, frameH, SHARE_OG_ASPECT.WIDTH, SHARE_OG_ASPECT.HEIGHT)
}

/** スマホの自動配置矩形（縦 4:5・モバイル主役）。 */
export function mobileCollagePortraitBandRect(frameW: number, frameH: number): CollageFitRect {
  return collageBandRect(frameW, frameH, SHARE_PORTRAIT_ASPECT.WIDTH, SHARE_PORTRAIT_ASPECT.HEIGHT)
}
```

（`mobileCaptureScale` と `EMPTY_RECT` はそのまま。冒頭コメントの「1.91:1 の帯へ自動配置」は「縦4:5の帯へ」に直してよいが必須ではない。）

- [ ] **Step 4: Run to verify it passes → Commit**

```bash
npx vitest run lib/share/mobile-band.test.ts
rtk git add lib/share/mobile-band.ts lib/share/mobile-band.test.ts
rtk git commit -m "feat(share): generalise band math + portrait 4:5 band (mobile portrait collage stage 1)"
```

---

### Task 2: `letterbox.ts` — 縦→1.91:1 併産 【cheap 可（純関数）＋薄い canvas ラッパ】

**Files:**
- Create: `lib/share/letterbox.ts`
- Test: `lib/share/letterbox.test.ts`

**Interfaces:**
- Produces:
  - `export function containFitRect(srcW, srcH, dstW, dstH): { readonly x: number; readonly y: number; readonly w: number; readonly h: number }`
  - `export function letterboxImageToAspect(srcDataUrl: string, outW: number, outH: number, bgColor: string, quality?: number): Promise<string | null>`

- [ ] **Step 1: Write the failing test**

`lib/share/letterbox.test.ts`（`containFitRect` のみ単体検証。`letterboxImageToAspect` は canvas/Image 依存で jsdom 不可＝e2e/実機で確認）:

```ts
import { describe, expect, it } from 'vitest'
import { containFitRect } from './letterbox'

describe('containFitRect', () => {
  it('fits a portrait 4:5 image into a 1.91:1 card, centred with side bars', () => {
    // 1080x1350 into 1200x630 -> scale = min(1200/1080, 630/1350) = 0.4667; w=504, h=630, x=348, y=0
    const r = containFitRect(1080, 1350, 1200, 630)
    expect(r.w).toBeCloseTo(504)
    expect(r.h).toBeCloseTo(630)
    expect(r.x).toBeCloseTo(348)
    expect(r.y).toBeCloseTo(0)
  })

  it('fits a wide image into a square, centred with top/bottom bars', () => {
    // 1000x500 into 600x600 -> scale = min(0.6, 1.2) = 0.6; w=600, h=300, x=0, y=150
    const r = containFitRect(1000, 500, 600, 600)
    expect(r).toEqual({ x: 0, y: 150, w: 600, h: 300 })
  })

  it('returns a zero rect on degenerate input', () => {
    expect(containFitRect(0, 100, 100, 100)).toEqual({ x: 0, y: 0, w: 0, h: 0 })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run lib/share/letterbox.test.ts
```

Expected: FAIL — `./letterbox` が存在しない。

- [ ] **Step 3: Implement**

`lib/share/letterbox.ts`:

```ts
/** N-58 モバイル縦コラージュ: 縦4:5の完成画像を、リンクカード用 1.91:1 の中央へ
 *  レターボックス（ボード色の余白付き）で併産するための幾何と canvas 合成。 */

/** 縦横比を維持して dst 矩形の中に収める中央配置矩形（contain-fit）。 */
export function containFitRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) return { x: 0, y: 0, w: 0, h: 0 }
  const scale = Math.min(dstW / srcW, dstH / srcH)
  const w = srcW * scale
  const h = srcH * scale
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image()
      img.onload = (): void => resolve(img)
      img.onerror = (): void => resolve(null)
      img.src = src
    } catch {
      resolve(null)
    }
  })
}

/** `srcDataUrl` の画像を `bgColor` で塗った `outW×outH` の canvas の中央に contain-fit で
 *  描き、JPEG data URL を返す（縦画像を 1.91:1 リンクカードに併産）。失敗・SSR は null。 */
export async function letterboxImageToAspect(
  srcDataUrl: string,
  outW: number,
  outH: number,
  bgColor: string,
  quality = 0.82,
): Promise<string | null> {
  if (typeof document === 'undefined' || outW <= 0 || outH <= 0) return null
  try {
    const img = await loadImage(srcDataUrl)
    if (!img) return null
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, outW, outH)
    const r = containFitRect(img.naturalWidth || img.width, img.naturalHeight || img.height, outW, outH)
    ctx.drawImage(img, r.x, r.y, r.w, r.h)
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run to verify it passes → Commit**

```bash
npx vitest run lib/share/letterbox.test.ts
rtk git add lib/share/letterbox.ts lib/share/letterbox.test.ts
rtk git commit -m "feat(share): letterbox helper to co-generate the 1.91:1 link card from the portrait image (N-58)"
```

---

### Task 3: `BoardRoot` — モバイル ARRANGE を縦4:5に／撮影を縦に／リンクカード併産 【Sonnet 推奨】

**Files:**
- Modify: `components/board/BoardRoot.tsx`
- Modify: `components/board/MobileShareResult.module.css`

**Interfaces:**
- Consumes: Task 1 の `SHARE_PORTRAIT_ASPECT` / `mobileCollagePortraitBandRect` / 既存 `SHARE_OG_ASPECT`、Task 2 の `letterboxImageToAspect`

- [ ] **Step 1: import**

`mobile-band` からの既存 import 行に `SHARE_OG_ASPECT, SHARE_PORTRAIT_ASPECT, mobileCollagePortraitBandRect` を足す（既存の `mobileCollageBandRect, mobileCaptureScale` は残す）。加えて:

```ts
import { letterboxImageToAspect } from '@/lib/share/letterbox'
```

- [ ] **Step 2: `handleMobileEnterArrange` を縦帯に**

`handleMobileEnterArrange` 内（現行 L2550 付近）の帯計算を置換:

```ts
    // 帯 = 画面に内接する中央の 縦4:5 矩形（モバイル主役）。fit も overlay もこれで縦になる。
    const band = mobileCollagePortraitBandRect(frameW, frameH)
```

（同関数の他の行・`fitSelectionToScreen(cards, band)`・`setMobileBandRect(band)` は不変。）

- [ ] **Step 3: `handleMobileCaptureAndCreate` を縦撮影＋リンクカード併産に**

3-1. `bandToOutScale`（現行 L2609）を縦出力幅に:

```ts
    const bandToOutScale = band.width > 0 ? SHARE_PORTRAIT_ASPECT.WIDTH / band.width : 1
```

3-2. `renderCollageCanvasToJpeg({...})` の `width: 1200, height: 630`（現行 L2646-2647）を縦に:

```ts
          width: SHARE_PORTRAIT_ASPECT.WIDTH,
          height: SHARE_PORTRAIT_ASPECT.HEIGHT,
```

3-3. `setCapturedImageUrl(thumb)`（現行 L2665）の**直後**に、リンクカード併産を追加（`capturedImageUrl` は縦のまま＝プレビュー＆ネイティブ共有は縦）:

```ts
    // リンクカード用: 縦画像を 1.91:1 のボード色キャンバス中央にレターボックス併産。
    // ホストする OG は 1.91:1 のまま（og:image:width/height=1200/630 と一致）。失敗時は
    // 画像なしでもリンクは作る（メタが嘘にならない・ネイティブ共有は縦画像で成立）。
    const linkCardThumb = thumb
      ? await letterboxImageToAspect(thumb, SHARE_OG_ASPECT.WIDTH, SHARE_OG_ASPECT.HEIGHT, deriveCaptureBoardColor())
      : null
```

3-4. `createHostedShare({...})` の `thumb: thumb ?? undefined`（現行 L2669）を:

```ts
      thumb: linkCardThumb ?? undefined,
```

（`useCallback` の依存配列は変更不要＝`deriveCaptureBoardColor` は既に含まれ、`letterboxImageToAspect` はモジュール import。撮影パンくずの `|| 630` 等の診断デフォルトは触らない。）

- [ ] **Step 4: プレビューを縦に**

`components/board/MobileShareResult.module.css` の `.preview` の `aspect-ratio: 1200 / 630`（現行 L29）を:

```css
  aspect-ratio: 1080 / 1350;
```

- [ ] **Step 5: 検証（型＋単体＋ビルド）→ Commit**

```bash
rtk tsc
npx vitest run
pnpm build
```

Expected: tsc 0 / vitest 緑 / build OK（assert-share-template OK＝OG メタは 1200/630 のまま無改変）。

```bash
rtk git add components/board/BoardRoot.tsx components/board/MobileShareResult.module.css
rtk git commit -m "feat(board): mobile arrange goes portrait 4:5; capture portrait + co-generate 1.91:1 link card (N-58)"
```

---

### Task 4: e2e を縦4:5前提に更新＋全体検証 【Sonnet 推奨】

**Files:**
- Modify: `tests/e2e/mobile-share.spec.ts`

**変更方針:** 既存テストの「landscape 1.91:1」前提を「縦4:5」に更新する。**検証意図は保つ**（帯にカードが収まる／プレビューは撮影サイズ／CREATE でリンクが作れる）。既存テストを弱めない。

- [ ] **Step 1: 既存 assert を縦に更新**

既存 `tests/e2e/mobile-share.spec.ts` を読み、次を更新（行番号は現物で確認）:
- 帯ジオメトリ: `bandH = bandVw * (630/1200)` → **`bandH = bandVw * (1350/1080)`**（縦4:5＝幅×1.25）。カードが「全幅を使い帯内に収まる」assert はそのまま（縦帯も `x:0, width:frameW`）。
- プレビュー寸法: `naturalWidth === 1200 && naturalHeight === 630` → **`1080` / `1350`**。
- 「cover の黒帯が出ない」を JPEG 端の画素で見るテスト（landscape 1200×630 前提）: **縦プレビュー（1080×1350）は帯そのもの＝レターボックス無し**なので、寸法を 1080×1350 に更新して「端に想定外の帯が無い」意図を保つ。もし画素デコードが landscape 依存で綺麗に移せない場合は、**縦プレビューの寸法＋帯内充填の assert に置き換える**（意図＝「縦出力が枠を満たす」を維持・カバレッジを落とさない）。リンクカードの 1.91:1 レターボックス（併産）は e2e 対象外（実機/単体で足りる）。
- 段階2 スライダー等の既存テストは不変（縦でも `stageTransform` はアスペクト非依存）。

- [ ] **Step 2: 実行**

```bash
npx playwright test tests/e2e/mobile-share.spec.ts
```

Expected: 縦前提に更新した本数が全緑。`rtk npx` は使わない。tail は失敗リスト。

- [ ] **Step 3: Commit**

```bash
rtk git add tests/e2e/mobile-share.spec.ts
rtk git commit -m "test(e2e): mobile share goes portrait 4:5 (band geometry + preview dims) (N-58)"
```

- [ ] **Step 4: 全体ゲート（コントローラが実施）→ デプロイ→実機確認依頼**

```bash
rtk tsc && npx vitest run && pnpm build
npx playwright test tests/e2e/mobile-share.spec.ts
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

実機確認（コピペ用）:
```
スマホで https://allmarks.app をハードリロードして:
1. SHARE → 全選択 → ARRANGE。編集エリアが「縦長（4:5）」になっていますか（横長の帯ではなく）。
2. 縦のまま並べる・大きさ・回す。CREATE。
3. 出てくるプレビュー画像が「縦」ですか。保存/共有すると縦画像ですか。
4. できたリンクを（PCのXやチャット等に）貼ると、カードは横長(1.91:1)で、その中央に縦コラージュが載っていますか。
5. 100枚でも破綻しないか。
```

---

## Self-Review（実装者への注意）

- **サーバー・OG は無改変**。ホストする `/og/<id>.jpg` は 1.91:1（縦画像をレターボックス済み）なので `og:image:width/height=1200/630` は正しいまま。`assert-share-template` は通る。
- **`renderCollageCanvasToJpeg` 本体は無改変**。縦は「縦帯＋縦の w/h」を渡すだけ。縦帯(4:5)→縦出力(4:5)は `mapBandToOutput` の x/y スケールが等しくなり歪まない。
- **`capturedImageUrl` は縦**（プレビュー＋ネイティブ共有の主役）。**ホスト用 `thumb` は 1.91:1 レターボックス**（リンクカード）。この2本立てを崩さない。
- レターボックス失敗時は `thumb: undefined`＝リンクは作るが OG 画像なし（メタが嘘にならない）。ネイティブ共有は縦画像なので体験は保たれる。
- **デスクトップ経路は無改変**（`handleCreateHostedShare`/dom-to-image/`ShareToast`）。今回の変更は全て `isMobile` 側。
- 実タッチ・実際の共有カードの見えは**実機のみ**確認可。
