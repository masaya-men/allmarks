# スマホのコラージュ＝縦4:5 ネイティブ再設計 設計書

> 対象: スマホ（`isMobile` / `<=640px`）の SHARE コラージュ編集（`sharePhase === 'arrange'`）。
> デスクトップ（>640px）は不変。目標像モック（実装前）でユーザー承認済み。
> 前提の到達点: N-58 段階1（ARRANGE→CREATE）＋段階2（tap-select・2本指変形・2本指/スライダーのボードズーム）は出荷済み。本書はその上に載る**モバイル体験の作り直し**。

## 背景（なぜ作り直すか）

実機確認で「機能は動くが、スマホに最適化された画面に見えない」とユーザー報告。核心は **共有リンクカード用の 1.91:1（横長・帯）を縦長スマホに載せている**こと＝背の高い画面に横長のレターボックスを詰め込む形。一方、スマホでバイラルが起きる形は**縦**（縦向きのストーリー/ピン）。ミッション「画像でSNSシェアしてバイラル」に照らし、**モバイルのコラージュは縦キャンバスにするのが自然**。あわせて編集チロムを業界水準（選択時だけ道具が出る／レイヤー操作／スナップ／ドラッグ削除／取り消し）に引き上げる。

## 確定した設計判断（ユーザー承認済み）

- **D1 モバイルのコラージュ＝縦 4:5 が主役**（保存＆縦向き共有）。将来 9:16 も選べる余地は残すが、段階1 は 4:5 固定。
- **D2 リンクカード用の 1.91:1 は裏で自動併産**。方式＝**縦4:5の完成画像を 1.91:1 キャンバスの中央にレターボックス配置**（ボード色の余白）。＝ X 等にリンクを貼った時のカードは従来どおり 1.91:1 で成立し、縦画像が中央に綺麗に載る。**サーバー（KV/R2・OG route・payload）は無改変**（ホストする OG は 1.91:1 のまま）。
- **D3 編集チロムを業界水準に**（段階2）: 選択時のコンテキストツールバー（前面/背面・削除ほか）／重なり順操作／スナップ＋触覚／ドラッグ削除／上部の取り消し・やり直し／演出。ズームは常時スライダーを廃し**ピンチ＋ダブルタップでフィット**に寄せる（ただし100枚時の到達性は担保）。

## 段階分け（各段が単体で出荷可能）

- **段階1＝土台（縦4:5の形と出力）**: 帯・自動配置・撮影・保存を縦4:5に。リンクカードは 1.91:1 レターボックス併産。**見た目のチロムは現状のまま**（＝まだモック通りではない）が、「スマホらしい縦の形」になり、縦画像で保存/共有できる。
- **段階2＝業界水準の編集チロム**: モックの体験。段階1 の確定コードの上に載る（詳細計画は段階1 着地後に書く）。

---

## 段階1 詳細設計（本書の主対象・別紙に実装計画）

### 不変条件
- **デスクトップ（>640px）はバイト同一**: 変更は全て `isMobile` のモバイル経路。desktop の `handleCreateHostedShare`/`captureCollageShareImage`(dom-to-image)/`ShareToast` は無改変。
- **共有サーバーは無改変**: `/api/share/create`・`SHARE_KV`・`SHARE_OG`(R2)・`/og/[id].ts`・`patch-share-html.ts`（`og:image:width/height=1200/630`）・`ShareDataV2` payload は触らない。**ホストする OG 画像は 1.91:1 のまま**（レターボックス済み）＝メタは正しいまま。
- **撮影レンダラーはアスペクト非依存**（`renderCollageCanvasToJpeg` は出力 w/h を引数で受ける・中に 1.91:1 リテラルは無い）＝レンダラー本体は無改変で縦にも landscape 併産にも使える。
- 編集した位置/サイズ/回転/重なり順は完成画像に反映（z順=`collageOrder`・回転=レンダラー）を維持。
- TS strict / `any` 禁止 / return type 明示 / CSS は `.module.css` / z-index は `BOARD_Z_INDEX`。

### 変更点（モバイル経路のみ）

1. **`lib/share/mobile-band.ts`（アスペクト一般化＋縦定数）**
   - 追加 `export const SHARE_PORTRAIT_ASPECT = { WIDTH: 1080, HEIGHT: 1350 } as const`（4:5・モバイル主役）。
   - 帯計算を一般化 `export function collageBandRect(frameW, frameH, aspectW, aspectH): CollageFitRect`（既存のクロス乗算をアスペクト引数化）。既存 `mobileCollageBandRect` は `collageBandRect(fw,fh,1200,630)` に置換（後方互換・テスト温存）。
   - 追加 `export function mobileCollagePortraitBandRect(frameW, frameH): CollageFitRect = collageBandRect(fw,fh, 1080, 1350)`。
   - 帯は縦4:5になる（例 390×844 → `{x:0,y:178.25,width:390,height:487.5}`＝画面の縦を活かす）。

2. **`lib/share/letterbox.ts`（新規・縦→1.91:1 併産）**
   - 純関数 `containFitRect(srcW, srcH, dstW, dstH): {x,y,w,h}`（縦横比維持で dst 内に収める中央配置矩形＝単体テスト可）。
   - `letterboxImageToAspect(srcDataUrl, outW, outH, bgColor): Promise<string|null>`（`srcDataUrl` を読み込み、`bgColor` で塗った `outW×outH` canvas の中央に `containFitRect` で描いて JPEG data URL を返す・失敗は null・SSR/canvas 無しも null）。

3. **`components/board/BoardRoot.tsx`（モバイル撮影経路の配線）**
   - `handleMobileEnterArrange`: `mobileCollageBandRect` → `mobileCollagePortraitBandRect` に置換（fit も overlay も縦4:5になる。他は不変）。
   - `handleMobileCaptureAndCreate`:
     - 縦を撮る＝`renderCollageCanvasToJpeg({ ..., band, width: SHARE_PORTRAIT_ASPECT.WIDTH, height: SHARE_PORTRAIT_ASPECT.HEIGHT })`（`band` は縦帯）。`bandToOutScale = SHARE_PORTRAIT_ASPECT.WIDTH / band.width`（`roundedCornersPx` 用の 1200 リテラルを縦幅に）。
     - `capturedImageUrl = portraitThumb`（プレビュー＋ネイティブ共有はこの縦画像）。
     - リンクカード併産＝`linkCardThumb = await letterboxImageToAspect(portraitThumb, 1200, 630, deriveCaptureBoardColor())`。
     - `createHostedShare({ ..., thumb: linkCardThumb ?? undefined })`（ホストする OG は 1.91:1。レターボックス失敗時は画像なしでもリンクは作る＝メタが嘘にならない。ネイティブ共有は縦を送るので体験は保たれる）。
   - 撮影機構（2フレーム待ち・パンくず・`createHostedShare`）は他は不変。

4. **`components/board/MobileShareResult.module.css`**: プレビューの `aspect-ratio: 1200/630` → `1080/1350`（縦プレビュー）。

### アスペクトのリテラル散在（併せて整理・任意）
`1200`/`630` が7箇所に直書き（fact-map）。段階1 では**モバイル経路で触る箇所だけ**名前付き定数化（`SHARE_PORTRAIT_ASPECT` / `SHARE_OG_ASPECT`）。メタ/CSS/デフォルトの landscape リテラルは 1.91:1 のままで正しいので触らない。

### テスト
- 単体: `mobile-band.test.ts`（縦帯の数値・`collageBandRect` の一般化）／`letterbox.test.ts`（`containFitRect` の中央配置・縦横）。
- e2e `tests/e2e/mobile-share.spec.ts`: ARRANGE の帯が 4:5・カードが縦帯に収まる／プレビューの `naturalWidth/Height === 1080×1350`／CREATE が成立しリンクができる。従来の「1200×630 プレビュー」「cover の黒帯検出」assert は縦前提に更新（縦画像は帯そのもの＝レターボックス無し。リンクカードのレターボックスは別途 or e2e 対象外）。

---

## 段階2 設計（概要＋タスク列・詳細計画は段階1着地後）

モックの体験。段階1 の縦4:5 の上に載せる。**選んだ時だけ道具が出る**を核に、以下を段階的に：

1. **選択時コンテキストツールバー**（グラス・選択カード近傍 or 下部固定）: 前面へ/背面へ／削除。撮影に写さない（`data-no-capture`）。
2. **重なり順（レイヤー）操作**: 「前面へ/背面へ」を `collageOrder` に対して（`bringToFront` の兄弟＝`bringForward`/`sendBackward`/`sendToBack` 純関数を追加）。将来レイヤー一覧ドラッグは別途。
3. **スナップ＋触覚**: ドラッグ中に中心/端/隣カードへ吸着＋緑ガイド線＋`navigator.vibrate`（対応端末のみ・純関数でスナップ計算）。
4. **ドラッグ削除**: ドラッグ中だけ出るゴミ箱ゾーンへ落として削除（＝選択解除＋`collageOrder`/`positions`/`rotations` から除去。撮影対象からも外す）。
5. **取り消し・やり直し**: `collagePositions`/`collageRotations`/`collageOrder` のスナップショット履歴（上部バーに常設アイコン）。**注意**: 履歴モデルは段階2の要設計。
6. **上部バー再設計**（閉じる・取消/やり直し・SHARE）＋ **ズームはスライダー廃止→ピンチ＋ダブルタップでフィット**（100枚到達性を要確認・段階2で穴を残さない）。
7. **演出/触覚/モーション**の磨き。

**段階2 の要設計論点（詳細計画時に詰める）**:
- **複製（duplicate）の扱い**: コラージュは `bookmarkId` キーで `positions/order/rotations` を持つ。複製すると同一 `bookmarkId` が2つ＝キー衝突。**インスタンスID 導入が必要**な設計変更なので、段階2 初回では複製を外す or 別途設計する（モックの COPY は将来枠）。
- undo/redo の履歴粒度（ドラッグ確定単位か操作単位か）。
- ズームのスライダー廃止と 100枚到達性の両立（例: ダブルタップで領域ズーム／小カードは選択で寄る）。

---

## スコープ外 / 後で

- **PC（デスクトップ）のコラージュが業界水準かの調査**（ユーザー要望・後日）。デスクトップの編集体験（四隅リサイズ・ホバー回転ノブ・レイヤー・整列）を業界水準と比較して差分を洗う調査タスク。バックログへ。
- 9:16 ストーリー等、アスペクト選択 UI（段階1 は 4:5 固定）。
- 複製（instance-id 設計が要る・段階2で判断）。
- サーバー側で縦画像を別キーでホストする案（今回は不要＝リンクカードは 1.91:1 レターボックスで足りる）。

## 出荷ルール（継承）
デプロイ前に tsc + vitest + build 緑／実タッチは実機のみ検証可／`rtk` 前置・`--no-verify` 禁止／vitest・playwright は素の `npx`／機微は `docs/private/`（競合名は tracked docs に書かない）。
