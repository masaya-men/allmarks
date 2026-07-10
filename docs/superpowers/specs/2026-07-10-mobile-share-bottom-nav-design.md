# スマホから SHARE できるようにする（N-49）— 設計

- 日付: 2026-07-10（セッション 185）
- 状態: ユーザー承認済み（3つの分かれ道すべて決着）
- 関連: `docs/TODO.md` N-49 / N-50、`2026-07-08-share-hosted-image-og-x-reliable-design.md`、`2026-07-10-receiver-touch-import-bar-design.md`

---

## 1. 問題

「コラージュを画像で SNS シェアさせてバイラルを起こす」がこのアプリのミッションだが、**スマホから共有リンクを作れない**。

s184 の調査と s185 の実測で、原因は4つに分解できた。

| # | 事実 | 出典 |
|---|---|---|
| 1 | ボトムナビに SHARE が無い。`TopHeader` は 640px 以下で `display:none`（"desktop-only for v1"） | `BoardMobileNav.tsx:88-141` / `TopHeader.module.css:65` |
| 2 | ボトムナビは共有中も出たまま。隠す条件は lightbox / onboarding / tagMode だけ。その上に `ShareSelectBar`（`bottom:24px` / z=401）が重なる | `BoardRoot.tsx:2908` / `ShareSelectBar.module.css:4-13` |
| 3 | 並べる段が右に約 32px はみ出す。安全領域が `CANVAS_MARGIN_PX`(48) を足すが、スマホは `MOBILE_LAYOUT.CANVAS_MARGIN_PX = 0` | `BoardRoot.tsx:2241-2249` / `lib/board/constants.ts:40,68` |
| 4 | 撮影が縦画面をそのまま `fit:'contain'` で 1200×630 に入れる → 390×844 なら左右に約 450px ずつ黒帯 | `BoardRoot.tsx:2412-2422` |

**すでに動いているもの**（触れば使える）:

- タップでカード選択 — `CardsLayer.tsx:1319` の `selectionMode` 分岐が `if (isMobile) return`（L1322）より **先**に走る
- 指スクロールしても誤選択しない — `CardsLayer.tsx:1205-1210` が `pointerup` 以外（＝`pointercancel`）ではトグルしない
- 撮影・リンク作成・COPY・POST TO X の中身
- `canWebShareFiles` / `dataUrlToFile`（`lib/share/share-actions.ts:15-49`）— s174 で実装・テスト済み、UI 未接続

---

## 2. 決めたこと（ユーザー承認済み）

### 2.1 スマホに「並べる段」は出さない

選ぶ → CREATE の2手。並べ方は既存の自動配置（`fitSelectionToScreen`）のまま。

理由: (a) 390px 幅で 100 枚のカードを指でつまんで動かすのは表現ツールとしても気持ちよくない (b) 自由配置を出すと上表の 3・4 を両方踏むので規模が跳ねる (c) 「何が共有されるか」は撮影後のプレビューで見せれば足りる。

失うもの: スマホでの移動・回転・拡縮・タイトル編集。

### 2.2 ボトムナビは 5 枠のまま。MOTION を降ろして SHARE を中央に

`TAG / THEME / SHARE / CORNERS / MORE`

- 6 枠にすると 360px 端末で 1 枠 約55px。ラベル「CORNERS」自体が約51px でギリギリになる
- MOTION（ふわふわ浮遊の入切）は一度決めたら触らない設定なので MORE パネルへ降ろす
- CORNERS は s182 でユーザーが「スマホにも欲しい」と明示要望して 1 タップにしたものなので動かさない
- SHARE は中央（3番目）。左右どちらの親指からも等距離

**SHARE タブに緑の点灯状態（`data-active`）は付けない。** 共有モード中はナビ自体が引っ込むので、点く瞬間が存在しない。

### 2.3 CREATE 後は「画像プレビュー ＋ SHARE / COPY LINK / DONE」

X 専用ボタンと SAVE IMAGE は落とす。OS の共有シートに X も「画像を保存」も並ぶので二重になる。

---

## 3. 撮影のしくみ（この設計の肝）

### 3.1 なぜレプリカを作らないのか

s169 で「レプリカ再構成は完全排除（バグの温床）」とユーザーが決めている。画面外に 1200×630 の舞台を組むと、背景（`patternLayer` / `ThemeLayer` / `BoardDecorLayer`）を作り直すことになり、**盤面と共有リンクが食い違う**という N-54 型の病気を新たに1つ増やす。

### 3.2 代わりに「画面の中央の帯」を撮る

実測で確定した2つの事実がこれを可能にする。

1. `.outerFrame` は `position: fixed; inset: 0`（`BoardRoot.module.css:4-6`）。**撮影対象は常に画面ちょうど**
2. `dom-to-image-more` は `options.scale` を持つ。`canvas.width = width * scale` / `ctx.scale(scale, scale)`（`node_modules/dom-to-image-more/src/dom-to-image-more.js:316,328-330`）

したがって:

- 選んだカードを **画面の縦中央にある 1.91:1 の帯**に自動配置する（390px 幅なら 390×204.75px）
- 撮影は今までどおり `.outerFrame` をまるごと撮り、`fit:'cover'` で中央を切り出す
- `computeCoverRect`（`lib/share/normalize-shot.ts:27-38`）は**中央を切る**ので、帯が中央にある限り切り出し結果は帯とぴったり一致する

検算（390×844、scale s = 1200/390 = 3.0769）:

```
raster        = 1200 × 2597
srcIsWider    = 1200*630 > 2597*1200  → false
sh            = 1200 * 630 / 1200 = 630        → CSS px に戻すと 630/s = 204.75 = bandH ✓
sy            = (2597 - 630) / 2 = 983.5       → CSS px に戻すと 319.6 = (844 - 204.75)/2 ✓
```

結果:

- 黒帯が消える（問題 4 の解決）
- 背景・パターン・カードは**すべて本物**。新しい描画コードはゼロ
- `ARRANGE_SAFE_INSET` はスマホでは使わない（問題 3 の解決）

### 3.3 新しい純関数

```ts
// lib/share/mobile-band.ts
/** 共有 OG 画像の縦横比（1200×630）。 */
export const SHARE_OG_ASPECT = { WIDTH: 1200, HEIGHT: 630 } as const

/** スマホの自動配置矩形＝ .outerFrame の縦中央にある 1.91:1 の帯。
 *  座標系は .outerFrame（= CollageCanvas の .root が inset:0 で張る空間）。 */
export function mobileCollageBandRect(frameW: number, frameH: number): CollageFitRect

/** 帯の幅がちょうど 1200px の raster になる撮影倍率。1〜4 に丸める。 */
export function mobileCaptureScale(frameW: number): number
```

- `mobileCollageBandRect(390, 844)` → `{ x: 0, y: 319.625, width: 390, height: 204.75 }`
- `frameH < bandH` の退化ケース（極端な横向き）では `y = 0`、`height = min(bandH, frameH)`
- `frameW <= 0` は `{ x:0, y:0, width:0, height:0 }`
- `mobileCaptureScale(390)` → `3.0769…`、`mobileCaptureScale(1489)` → `1`（1 未満に落とさない）、`mobileCaptureScale(300)` → `4`（上限）

### 3.4 撮影の配線

`renderShareImage` に `scale?: number` を足し、`toJpeg` にそのまま渡す。`capture-collage.ts` の `CaptureCollageOpts` にも `scale?: number` を通す。既定は未指定＝1（デスクトップは 1px も変わらない）。

---

## 4. 画面と状態

### 4.1 状態機械（`sharePhase` に新しい値を足さない）

| きっかけ | 状態 | スマホの下部 |
|---|---|---|
| ナビの SHARE をタップ | `sharePhase = 'select'` | `MobileShareSelectBar` |
| CREATE をタップ | `sharePhase = 'arrange'`、`hostedShareUrl = null` | 何も出さない（`ShareCreatingIndicator` が被る） |
| 作成成功 | `sharePhase = 'arrange'`、`hostedShareUrl != null` | `MobileShareResult`（シート） |
| 作成失敗 | `sharePhase = 'arrange'`、`shareCreateState = 'error'` | `MobileShareResult`（RETRY / DONE） |
| DONE / CANCEL / Esc | `sharePhase = null` | ボトムナビが戻る |

`'arrange'` の間、スマホでも `CardsLayer` は消え `CollageCanvas` が帯に描かれる（既存の gate をそのまま使う）。撮影中はその帯が `ShareCreatingIndicator` の下に見えるので、ユーザーは「今これを撮っている」と分かる。

`ShareToast` はデスクトップ専用になる（`!isMobile` で描く）。`ShareSelectBar` も同様。**PC の見た目・挙動は 1px も変えない。**

### 4.2 CREATE のハンドラ

```
handleMobileCreateShare():
  1. frame = boardFrameRef.current.getBoundingClientRect()（取れなければ viewport にフォールバック）
  2. rect = mobileCollageBandRect(frame.width, frame.height)
  3. setCollagePositions(fitSelectionToScreen(cards, rect))
     setCollageOrder(...) / setCollageRotations({}) / setShareTitle(null)
     setSharePhase('arrange')
  4. rAF ×2 待つ（帯の描画が paint されるまで）
  5. setShareCreateState('creating') → setCapturing(true)
  6. captureCollageShareImage(boardFrameRef.current, {
       fit: 'cover',                              // ← デスクトップは 'contain' のまま
       scale: mobileCaptureScale(frame.width),
       origin, boardColor,
     })
  7. createHostedShare({ thumb, ... })（既存）
```

`handleEnterArrange`（デスクトップ）は `arrangeSafeRect` を使い続ける。矩形の選び方だけが分岐点で、`fitSelectionToScreen` の中身は共有する。

**スマホの共有画像にタイトル（ワードマーク）は載せない**（`setShareTitle(null)`）。スマホの盤面はそもそもワードマークを描いていない（`BoardRoot.tsx:3139` の `!isMobile` gate）ので、載せると盤面と食い違う。N-51 の残りでスマホにワードマークを出したら、その時に載せるか決める。

### 4.3 `MobileShareSelectBar`

`ReceiverImportBar` と同じ素材（`rgba(9,9,11,0.9)` / `backdrop-filter: blur(20px) saturate(1.1)` / 上辺ヘアライン / `env(safe-area-inset-bottom)` / monospace 固定）。

390px 幅に 52px のボタンを3つ横並びにすると窮屈なので **2 段**にする。

- 1 段目（細い文字の行）: 左に `n / 100 SELECTED`（`SHARE_LIMITS_V2.MAX_CARDS` ＝ **100**）、右に `SELECT ALL`（文字ボタン）
- 2 段目: `CANCEL`（輪郭・`flex: 1`）と `CREATE (n)`（緑・主・`flex: 2`）。どちらも高さ 52px（Apple の 44pt 超え）
- `n === 0` で `CREATE` は無効

### 4.4 `MobileShareResult`

下から出るシート。上に `capturedImageUrl` を `aspect-ratio: 1200/630`・幅いっぱい・角丸で表示。下に縦積みのボタン。

| 条件 | 出すボタン |
|---|---|
| `navigator.share` があり `canWebShareFiles(navigator, file)` が真 | `SHARE`（画像＋リンク）/ `COPY LINK` / `DONE` |
| `navigator.share` はあるが files 不可 | `SHARE`（リンクのみ）/ `COPY LINK` / `DONE` |
| `navigator.share` が無い | `COPY LINK` / `DONE` |
| 撮影失敗（`capturedImageUrl == null`） | プレビュー無し。上記のボタン構成から `SHARE` の files 経路だけ落ちる |
| 作成失敗（`shareCreateState === 'error'`） | `RETRY` / `DONE` |

- `SHARE` は `dataUrlToFile(capturedImageUrl, 'allmarks-collage.jpg')` → `canWebShareFiles` → `navigator.share({ files:[f], url })`
- `navigator.share` が投げた場合（ユーザーが共有シートを閉じた `AbortError` を含む）は**何も表示しない**。エラー扱いにしない
- `COPY LINK` は既存 `handleShareCopyLink` をそのまま使う。押下後 1.6 秒 `LINK COPIED`

**撮影が失敗しても共有そのものは絶対に壊さない**（既存方針。`thumb` 無しで `/s` は作られ、OG は既定カードに落ちる）。

### 4.5 重なりと寸法

- 共有中（`sharePhase !== null`）は `BoardMobileNav` と `MobileSaveButton` を**両方隠す**。今の「+」は `sharePhase !== 'arrange'` でしか消えない（`BoardRoot.tsx:2928`）ので `sharePhase === null` に締める
- `MobileShareSelectBar` / `MobileShareResult` は `BOARD_Z_INDEX.TOUCH_BOTTOM_BAR`(150) ではなく既存の `SHARE_SELECT_BAR`(401) / `SHARE_TOAST`(402) を使う。スマホでは `ScrollMeter`(400) を描かないので競合しない
- 押せるものは全部 44px 以上

---

## 5. ついでに直すもの（N-49 が挙げたもう1つの真のブロッカー）

**回転ノブが指で触れない。** `CollageCanvas.module.css:64` が `.element:hover .rotateHandle` で `opacity`/`pointer-events` を開けているので、hover を持たない端末では永久に隠れたまま。

```css
@media (hover: none) {
  .rotateHandle { opacity: 1; pointer-events: auto; }
}
```

スマホには並べる段が無いので、これが効くのは**タブレット**（>640px の触り端末＝ `TopHeader` が出るので SHARE 自体は今も押せる）。

**同時に `.rotateHandle` へ `data-no-capture` を必ず足す。** 実測したところ付いていない（`CollageCanvas.tsx:227` は `className` だけ）。今は hover 依存なので撮影の瞬間はポインタが下部バーの CREATE の上にあり、たまたま隠れているだけ。常時表示に変えた途端、**タブレットの共有画像に回転ノブが焼き付く**。

---

## 6. 触らないもの（非目標）

- **タブレットの作法**（主要操作が 27px）＝ N-50。今回は「SHARE が押せるか」だけを見る
- スマホでの自由配置・回転・拡縮・タイトル編集
- スマホの共有画像へのワードマーク掲載
- N-54（グリッドの交点が濃くなる）
- デスクトップの `ShareSelectBar` / `ShareToast` / `ARRANGE_SAFE_INSET` / `fit:'contain'`

---

## 7. 変更するファイル

**新規**

- `lib/share/mobile-band.ts` ＋ `mobile-band.test.ts` — 純関数2つ
- `components/board/MobileShareSelectBar.tsx` ＋ `.module.css` ＋ `.test.tsx`
- `components/board/MobileShareResult.tsx` ＋ `.module.css` ＋ `.test.tsx`
- `tests/e2e/mobile-share.spec.ts`

**変更**

- `components/board/BoardMobileNav.tsx`（＋ `.test.tsx` があれば）— SHARE タブ追加、MOTION 削除、`ShareIcon` 追加
- `components/board/ExtensionEntry.tsx` ＋ `.module.css` — 任意 prop `motion?: { enabled, onToggle }` を受け取り、渡された時だけ MOTION 行を描く（BoardRoot は `isMobile` の時だけ渡す＝デスクトップは 1 行も増えない）
- `components/board/BoardRoot.tsx` — ナビの配線、`handleMobileCreateShare`、下部バーの `isMobile` 分岐、ナビと「+」を `sharePhase === null` で gate
- `lib/share/render-share-image.ts` — `scale?: number`
- `lib/share/capture-collage.ts` — `scale?: number` を素通し
- `components/board/CollageCanvas.module.css` — `@media (hover: none)`

---

## 8. テスト

**vitest（自分でやる）**

- `mobileCollageBandRect` / `mobileCaptureScale` — 390×844・360×640・横向き退化・0 幅・上限4・下限1
- `MobileShareResult` — 上表の 5 分岐すべて。`navigator.share` のスタブで `files` の有無を切替。`AbortError` を無視すること
- `MobileShareSelectBar` — `n === 0` で CREATE 無効、カウンタ表示
- `BoardMobileNav` — SHARE タブがあり MOTION が無いこと

**Playwright 390px（自分でやる）**

- ナビの SHARE → 選択バーが出てナビと「+」が消える
- **`SELECT ALL` → `CREATE` → 結果シート**。カードのタップ選択は `setPointerCapture` を使うので合成ポインタでは駆動できない（memory `reference_board_card_click_pointer_capture`）。`SELECT ALL` 経由で確認する（memory `reference_playwright_board_share_verify`）
- **黒帯が無いことは寸法では証明できない**（`fit` が何であれ最終画像は 1200×630）。撮影**前**の DOM で構造的に示す: `'arrange'` の間、コラージュ要素の `left` の最小値 ≈ 0、`right` の最大値 ≈ 画面幅、全要素の `top`/`bottom` が帯 `[y, y+bandH]` の内側
- プレビュー `<img>` が `naturalWidth === 1200` / `naturalHeight === 630` で読み込めること（＝撮影が成功して R2 に載る形になっている）
- デスクトップ 1489px の回帰: `ShareSelectBar` / `ShareToast` が従来どおり出る

**実機でしか確認できない（ユーザーに振る）**

- 選択モードで指スクロールが生きるか（`setPointerCapture` と `touch-action: pan-y` の同居）
- `navigator.share({ files, url })` を X / Instagram / LINE がどう拾うか
- 低スペック端末で 1200×2597 の canvas を焼けるか

**受け取り画面**

盤面の見た目は変えないので影響は無いはずだが、恒久ルールどおり `/s/<id>` を実機で確認する（memory `feedback_board_change_check_receiver`）。

---

## 9. 未検証の前提（実装時に潰す）

1. **`dom-to-image` の `scale` が foreignObject 内の外部画像も高解像で焼くか。** 理屈上は焼ける（SVG はベクタなので `drawImage` の拡大時に再ラスタライズされ、内部の `<img>` は元バイトの解像度を持つ）。ライブラリの doc comment も "to reduce fuzzy images"（`dom-to-image-more.js:83`）と言っている。**確認方法は寸法ではなく中身**: (a) `vi.mock('dom-to-image-more')` で `toJpeg` が `scale` を受け取ることを単体テストで固定する (b) 390px の Playwright で作った実物の共有画像を保存し、**カードの文字が読めるかをユーザーが目視**する。`scale` を渡さないと 390px 幅の raster を 3.08 倍に引き伸ばすことになり、必ずぼやける
2. **`navigator.share({ files, url })` を受け手アプリがどう拾うか。** 片方しか拾わないアプリがある。`canShare({files})` が偽なら `url` のみに落とし、`navigator.share` 自体が無ければ `COPY LINK` だけを出す
3. **撮影中に `.outerFrame` の高さが変わらないか**（モバイル Chrome の URL バー出没）。矩形計算と撮影を同じハンドラ内・同じ `getBoundingClientRect()` で行うことで窓を最小化する
4. **低スペック端末で 1200×2597 の canvas を焼けるか**（390×844 × scale 3.08）。焼けなければ `captureCollageShareImage` が `null` を返し、プレビュー無しで共有は成立する（既存のフォールバック）
