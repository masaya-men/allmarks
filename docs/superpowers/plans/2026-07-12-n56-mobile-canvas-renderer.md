# N-56 続き: スマホ共有画像を「canvas 直描画」で作る実装計画（iOS foreignObject 回避）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development（推奨）で task ごとに実装。steps は checkbox (`- [ ]`)。

**Goal:** スマホ（iOS Safari）の共有画像が **dom-to-image（SVG foreignObject）ではカード画像を描けない**ことが実機で確定した。foreignObject を一切使わず **canvas 2D に `drawImage` で直接描く** スマホ専用レンダラーを作り、iPhone でも写真入りの 1200×630 JPEG を確実に生成する。**デスクトップは現状の dom-to-image のまま（バイト同一・一切触らない）。**

## 確定済みの事実（s188 実機診断で判明）

- 実機パンくず: `100 cards · canvas 1200×1744 · images 78MP`。**メモリ枯渇（OOM）タブクラッシュ**は s188.2 の画像縮小で解消済み。
- だが **6枚でも 100枚でもプレビューが暗い＝画像が写らない**（枚数非依存）。＝**iOS Safari の dom-to-image が foreignObject 内の `<img>` を描画できない**（候補①・F4 が現実化）。PC の Chrome では同方式で写真が出る＝iOS 固有。
- 小技（2回撮る等）では直らないことが多い＝**canvas 直描画（foreignObject 不使用）が確実な根治**。

## 既存の土台（そのまま流用できる）

- **[lib/share/capture-mirror.ts](../../../lib/share/capture-mirror.ts)** = s176 前に使っていた **canvas 直描画レンダラー**（`captureMirrorToWebP`）。foreignObject 不使用。以下の primitives が完成している:
  - `loadCrossOriginImage(url)`（`crossOrigin='anonymous'` で読み込み → 同一オリジン proxy なら taint しない）
  - `roundRectPath(ctx,x,y,w,h,r)`（角丸クリップ）
  - `wrapTextToLines` / `drawWrappedText` / `drawClippedText`（日本語 CJK 折返し対応・**`wrapTextToLines` は export 済・テスト済**）
  - `canvasToJpegUnderTarget(canvas,targetBytes,startQ,minQ)`（JPEG サイズ予算調整）
  - 各カード: 角丸クリップ→背景塗り→`drawImage`→（画像なしは生成アート＋scrim）→タイトル文字。ブランド帯（`allmarks.app` 焼き込み）。
  - ⚠ `captureMirrorToWebP` は **ShareMirror DOM（`data-mirror-card-id` 等）を読む** 設計。今回は DOM を読まず **配置データから描く**（下記）ので、drawCards のロジックは踏襲しつつ入力を差し替える。
  - ⚠ 現状 `drawImage(img, cx,cy,cw,ch)` は **引き伸ばし**。今回は **cover-fit**（アスペクト維持で中央クロップ）にする（下記 helper）。
- **実機の flow が持つデータ**（`handleMobileCreateShare` 内・[BoardRoot.tsx](../../../components/board/BoardRoot.tsx) `handleMobileCreateShare`）:
  - `chosen: LightboxItem[]`（`filter` 済）— 各 `item.thumbnail`（=表示画像 URL・CollageCanvas は `<CardNode thumbnailUrl={item.thumbnail}>` で描画）/ `item.title` / `item.bookmarkId`。
  - `collagePositions: Record<id,{x,y,w,h}>`（`fitSelectionToScreen(cards, band)` の結果・[collage-layout.ts](../../../lib/share/collage-layout.ts)）— **各カードの band 内座標**。回転は無し（`setCollageRotations({})`）。
  - `band = mobileCollageBandRect(frameW,frameH)`（[mobile-band.ts](../../../lib/share/mobile-band.ts)）= 出力 1200×630 に一致する 1.91:1 矩形。
  - `deriveCaptureBoardColor()` = 地色 / `roundedCorners`（`BoardConfig`）= 角丸 ON/OFF。
  - `rewriteToProxy(src, shareOrigin())` = 同一オリジン proxy URL（[proxy-image.ts](../../../lib/share/proxy-image.ts)・既存）。

## Architecture

**DOM を読まず、配置データ + 画像 URL から直接 canvas に描く。**

出力座標 = band 空間 → 1200×630 への線形写像:
```
sx = 1200 / band.width, sy = 630 / band.height   // band は 1.91:1 なので sx≈sy
outX = (pos.x - band.x) * sx,  outY = (pos.y - band.y) * sy
outW = pos.w * sx,            outH = pos.h * sy
```
各カード: 角丸クリップ → 地色塗り → `item.thumbnail`（proxy 経由・cover-fit）を drawImage → 画像無し/失敗は生成アート（`pickPlaceholderImage`）+ scrim + タイトル → 画像ありは下端に小タイトル。最後に `allmarks.app` 焼き込み。

**メモリ**: 画像を 1 枚ずつ読み→描画→解放するので、100 枚でも巨大 SVG を作らず OOM しない（canvas 直描画の副次利点）。s188.2 の縮小/パンくずは belt-and-suspenders として残す（撮影経路を差し替えるだけ）。

## Global Constraints

- TypeScript strict / `any` 禁止（`unknown`+ガード）/ return type 明示。
- `console.log` を本番に残さない（capture-mirror の `console.warn` は踏襲可だが新規は避ける）。
- **デスクトップ SHARE はバイト同一**（`handleCreateHostedShare` と dom-to-image 経路は一切変えない）。
- **撮影失敗でもリンクは必ず作る**（レンダラーは失敗時 null を返し、`thumb ?? undefined` で継続）。
- 出力は 1200×630・`fit` 相当は cover（黒帯を出さない）。JPEG（全 SNS 互換）。
- 画像は必ず **同一オリジン proxy 経由**で読む（canvas taint 回避＝`toDataURL` が SecurityError にならない）。
- git は `rtk` 前置・`--no-verify` 禁止。vitest は素の `npx vitest run`。

---

## Task 1: 再利用する canvas primitives を capture-mirror から export 【Haiku 可】

**Files:** Modify `lib/share/capture-mirror.ts`（export 追加のみ・ロジック不変）

- [ ] `roundRectPath` / `drawWrappedText` / `drawClippedText` / `loadCrossOriginImage` / `canvasToJpegUnderTarget` / `dataUrlByteLength` に `export` を付ける（`wrapTextToLines` は既に export 済）。**既存の呼び出し・挙動は不変**（追加 export のみ）。
- [ ] 既存テスト（`capture-mirror.test.ts`）が緑のまま（`npx vitest run lib/share/capture-mirror.test.ts`）。
- [ ] commit: `refactor(share): export capture-mirror canvas primitives for reuse (N-56)`

## Task 2: cover-fit の純関数 + 座標写像の純関数 【Haiku 可・TDD】

**Files:** Create `lib/share/collage-canvas-render.ts`（純関数部）/ `lib/share/collage-canvas-render.test.ts`

- [ ] **RED**: テストを書く。
  - `coverRect(imgW,imgH,dstW,dstH): {sx,sy,sw,sh}` — アスペクト維持で dst を埋める source crop（中央）。例: 正方画像を横長 dst → 上下でなく左右基準で中央クロップ。数値で検証。
  - `mapBandToOutput(pos, band, outW, outH): {x,y,w,h}` — 上記写像。band=画面座標、pos=band 内、out=1200×630 を数値検証（band.x/y のオフセット、1.91:1 スケール）。
- [ ] **GREEN**: 実装。`coverRect` は `scale=max(dstW/imgW,dstH/imgH)`、crop を中央。`mapBandToOutput` は上記式。
- [ ] `npx vitest run lib/share/collage-canvas-render.test.ts` 緑。
- [ ] commit: `feat(share): pure cover-fit + band->output mapping for canvas renderer (N-56)`

## Task 3: スマホ用 canvas レンダラー本体 【Sonnet 推奨】

**Files:** Modify `lib/share/collage-canvas-render.ts`（描画本体を追加）/ test 追記

**Interface:**
```ts
export type CollageCanvasCard = {
  readonly id: string
  readonly title: string
  readonly thumbnailUrl: string | null   // = item.thumbnail
  readonly url: string                    // = item.url（生成アートの seed）
  readonly rect: { x: number; y: number; w: number; h: number }  // band 空間
}
export type RenderCollageCanvasInput = {
  readonly cards: readonly CollageCanvasCard[]
  readonly band: { x: number; y: number; width: number; height: number }
  readonly width: number    // 1200
  readonly height: number   // 630
  readonly bgColor: string
  readonly roundedCornersPx: number  // 0 なら角丸なし
  readonly toProxyUrl: (src: string) => string  // rewriteToProxy(src, origin)
  readonly targetBytes: number
  readonly startQuality: number
  readonly minQuality: number
}
export async function renderCollageCanvasToJpeg(input: RenderCollageCanvasInput): Promise<string | null>
```

- [ ] 実装（capture-mirror の drawCards を踏襲・入力は配置データ）:
  - canvas 1200×630、`ctx.fillStyle=bgColor; fillRect`。
  - 各 card: `mapBandToOutput(rect, band, W, H)` で出力矩形。画面外はスキップ。
  - `loadCrossOriginImage(toProxyUrl(thumbnailUrl))` を **1 枚ずつ await**（メモリ安全）。成功: 角丸クリップ→`coverRect` で cover-fit `drawImage(img, sx,sy,sw,sh, dx,dy,dw,dh)`。失敗/画像なし: `pickPlaceholderImage(url)` の生成アート + scrim + 中央タイトル（capture-mirror と同じ）。画像あり: 下端に小タイトル。
  - `allmarks.app` 焼き込み（brand strip 相当・タグ帯は任意）。
  - `canvasToJpegUnderTarget` で出力。canvas 不可（jsdom）は null。
- [ ] test: jsdom は canvas 実描画不可 → **少なくとも「canvas 不可時 null」「cards 空で bg のみ→非 null は不可なので null 許容」**を検証。実描画は Task 5 実機。純関数（Task 2）でロジックは担保済み。
- [ ] commit: `feat(share): iOS-safe canvas collage renderer (drawImage, no foreignObject) (N-56)`

## Task 4: BoardRoot のモバイル撮影経路を canvas レンダラーに差し替え 【Sonnet 推奨】

**Files:** Modify `components/board/BoardRoot.tsx`（`handleMobileCreateShare` のみ）

- [ ] 撮影ブロックで `captureCollageShareImageDetailed(...)` の代わりに `renderCollageCanvasToJpeg({...})` を呼ぶ:
  - `cards` = `chosen.map(it => ({ id: it.bookmarkId, title: it.title, thumbnailUrl: it.thumbnail, url: it.url, rect: collagePositions[it.bookmarkId] }))`（rect 欠落はスキップ）。
  - `band` / `width:1200` / `height:630` / `bgColor: deriveCaptureBoardColor()` / `roundedCornersPx`（既存の per-card `--card-radius` 由来・`roundedCorners` OFF なら 0）/ `toProxyUrl: s => rewriteToProxy(s, shareOrigin())` / `targetBytes: 180*1024` / `startQuality:0.82` / `minQuality:0.5`。
  - `thumb = await renderCollageCanvasToJpeg(...)`。**パンくず write/clear は残す**（安全網）。s188.2 の縮小 Map（`captureThumbnails`）は canvas 経路では不要になるので、この経路では作らない（`buildCaptureThumbnailMap` 呼び出しを撤去）。
  - **デスクトップ `handleCreateHostedShare` は一切触らない**（dom-to-image のまま）。
- [ ] `setCaptureAttempts` は canvas 経路用に簡素化（`no-frame` / 成功 / 失敗の最小記録）か、撮影診断が不要なら空配列。MobileShareResult の NO IMAGE 表示は温存（失敗時リンクのみ）。
- [ ] 検証: `rtk tsc` / `npx vitest run` 全緑 / `pnpm build`。
- [ ] commit: `feat(board): render mobile share image via iOS-safe canvas renderer (N-56)`

## Task 5: デプロイ → 実機確認（必須）【Sonnet／読み解き Opus】

- [ ] `pnpm build && npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`
- [ ] ユーザーに実機手順（コピペ）:
  ```
  スマホ Safari を閉じて開き直し → allmarks.app → SHARE → SELECT ALL → CREATE
  → プレビューに「写真入りの画像」が出れば成功🎉。出た画像の見た目（写真/角丸/文字/余白）も教えてください。
  ```
- [ ] 写真が出たら **N-56 完了**。見た目の微調整（パターン背景の再現・余白・文字サイズ）が要れば次で。→ その後 **N-58 段階1**。
- [ ] 出ない場合はスクショで症状を採り、systematic-debugging で切り分け（proxy 取得失敗？ canvas taint？ 配置ズレ？）。

## Self-Review 済みの注意点（実装者へ）

- **capture-mirror は現在メイン flow から未使用の可能性**（s176 で dom-to-image に置換）。export 追加は既存呼び出しに無害。もし他所で使われていれば挙動不変を確認。
- **taint 厳守**: 画像は必ず `toProxyUrl`（同一オリジン `/api/img`）経由で `loadCrossOriginImage`。直の外部 URL を drawImage すると toDataURL が SecurityError。
- **cover-fit** にすること（capture-mirror の stretch のままだと非正方カードで歪む）。`fitSelectionToScreen` の rect がアスペクト維持なら実害は小だが、cover-fit にしておけば安全。
- **v1 はパターン背景（grid/dots）を省略可**（地色＋写真＋文字＋ブランド帯で「写真が出る」を最優先）。パターン再現は `patternSvgDataUri` を drawImage する形で後続。
- メモリは 1 枚ずつ読み描くので 100 枚でも安全。s188.2 の縮小は canvas 経路では外す（dom-to-image 特有の一括埋め込みが無いため）。
- デスクトップ dom-to-image 経路・`captureCollageShareImageDetailed`・`capture-collage.ts` は **触らない**（将来デスクトップも canvas 化するなら別計画）。
