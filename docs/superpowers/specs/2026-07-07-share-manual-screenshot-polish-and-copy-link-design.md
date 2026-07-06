# SHARE 手動スクショの仕上げ ＋ COPY LINK（再構成なし）設計 — 2026-07-07 セッション169

## 背景・目的

s164〜s168 で SHARE を「窓を出さず盤面が SHARE モードに入る二段（選ぶ→並べる）」に作り直し、
配置（arrange）のコラージュも盤面パネルいっぱいに詰まるようになった。共有の最終手段は
**ユーザー自身が画面をスクショして SNS に添付**（アプリは画像を作らない＝WYSIWYG・クロスオリジン汚染回避）。

s169 でユーザーが本番の配置画面を見て2点を指摘・相談した：

1. **「シェア中…」バーがスクロールメーターの下に潜って読めない**（実バグ）。
2. **スクショを撮ってもらって最小操作で共有させる業界標準はあるか。** → 調査の結論（下記）に基づき方針確定。

### 調査で確定した方針（うろ覚えでなく裏取り済み）

- **モバイルは画面キャプチャ API（`getDisplayMedia`）が全滅**（caniuse: iOS Safari / Chrome Android / Samsung Internet いずれも Not supported）。canvas 系ライブラリ（html2canvas / html-to-image / dom-to-image / SnapDOM）は全て**クロスオリジンで汚染して撮れない**（ブラウザのセキュリティ境界＝ライブラリでは解決不能）。他ドメインの iframe（生ツイート・動画）は原理的に写らない。
- **PC の `getDisplayMedia`（B案）は「毎回必ず許可ポップアップ」が仕様で必須**（Web 標準・`granted` 権限は永続化不可）。一般の非エンジニアには不安・離脱の元。
- → **B（PC 自動キャプチャ）も採用しない。全環境で「ユーザーが自分でスクショ」＋「取り込みリンク（URL）を併記」に一本化**（ユーザー決定）。
- **レプリカ再構成（`captureMirrorToWebP` / `renderShareImage`）はバグの温床なので完全に使わない**（ユーザー決定）。
  - 影響：`/s` リンクの OG プレビュー画像も**再構成しない**。X は画像添付時にリンクカードを抑制するので per-collage プレビューはほぼ無駄でもある（[Social Media Today](https://www.socialmediatoday.com/news/x-changing-how-link-previews-presented-stream-could-impact-posting/691459/) 裏取り）。「画像添付の有無で出し分け」は**技術的に不可能**（貼付はアプリ外の出来事で観測不能）ため、**常に AllMarks 共通の OG カード**（`/og.png`）にする。

## ユーザー確定事項（s169）

- **決定A**: 共有画像は**全環境でユーザーの手動スクショ**。アプリは撮らない。B（getDisplayMedia）不採用。
- **決定B**: レプリカ/再構成は**一切使わない**。`/s` リンクの OG プレビューも**AllMarks 共通カード（`/og.png`）**にする（per-collage サムネ生成をしない）。
- **決定C**: 配置画面のレイアウトは**今までどおり（縁 → ボードパネル → カード）**。s168 が変えたのは盤面パネルの中身の詰め方だけ。**全画面化しない・レイアウトを変えない**。撮影ガイドは既存のパネル縁を軽く示すだけ。

## 全体像（4項目）

| # | 内容 | 種別 | 触る場所 |
|---|------|------|---------|
| ① | 配置中はスクロールメーターを隠す（重なり解消） | web・1条件 | BoardRoot |
| ② | 配置中の撮影域をクリーンに＋既存パネル縁を軽く示す（レイアウト不変） | web・軽演出 | BoardRoot / CollageCanvas 周辺 |
| ③ | 撮り方の一言を OS 判定で1行に | web・純関数＋文言 | ShareToast + 新純関数 |
| ④ | COPY LINK（再構成なしで `/s` リンクをコピー） | web＋サーバー小変更 | ShareToast / BoardRoot / functions |

---

## ① メーター重なり解消

**現状（実測）**: `ScrollMeter` は `.meterWrap { position:absolute; bottom:24px; z-index:400 }`（[ScrollMeter.module.css:24](../../../components/board/ScrollMeter.module.css)）で画面下中央に常駐。`ShareToast` は `bottom:24px; z-index:116`（`BOARD_Z_INDEX.SHARE_TOAST`）。**メーター(400) がトースト(116) の上に描かれ、配置中に重なって潜る**。しかも配置中は盤面がスクロールしないのでメーター自体が無意味。

**変更**: `ScrollMeter` の描画条件（[BoardRoot.tsx:2760](../../../components/board/BoardRoot.tsx#L2760) `{!showOnboarding && (<ScrollMeter .../>)}`）に **`sharePhase !== 'arrange'`** を足す。

- 第1段「選ぶ（select）」では盤面グリッドがスクロール可能なのでメーターは**残す**（意味がある）。
- 第2段「並べる（arrange）」でだけ隠す。

## ② 撮る範囲をクリーンに＋既存の縁を軽く示す（レイアウト不変）

**大前提（決定C）**: レイアウトは一切変えない。`handleEnterArrange` は既に「見える盤面パネル（`.canvas`＝ウィンドウから `CANVAS_MARGIN_PX` 内側）に収める」設計（[BoardRoot.tsx:2005-2020](../../../components/board/BoardRoot.tsx#L2005)）で、**縁・パネル・カードの三層構造は不変**。本項で要素サイズは変えない。

- **クリーン化**: 配置中に画面下に出る非本質 UI を消す（① のメーターがメイン。他に配置中不要な下部トースト類があれば同様に抑制）。ヘッダーは**残す**（範囲選択なら写り込まない＋タイトル出し入れに要る／s164 §6）。
- **撮影ガイド（軽演出・任意度高め）**: 配置に入った瞬間、**既存の盤面パネル縁（`.canvas` のボーダー）を一度だけ淡く光らせて数百 ms でフェード**する（＝「この矩形を撮ってね」の目線誘導）。
  - **制約**: 永続的な枠は足さない（スクショに写るため）。一瞬のハイライトのみで、数秒後にユーザーがスクショする頃には消えている。新規レイヤーの追加はパネル縁の `box-shadow`/`outline` を時間制で焚く程度に留め、要素配置・サイズは不変。
  - 厳密な見た目（色・持続・カーブ）は plan で詰める。**コア要件は「メーター重なり解消＋撮影域が綺麗」で、この演出は付加価値**。過剰にしない。

## ③ 撮り方の一言を OS 判定で1行に

**現状**: `ShareToast` のヒントは英語ハードコードで両 OS 併記＝長い（[ShareToast.tsx:23-25](../../../components/board/ShareToast.tsx#L23) `Screenshot the collage area to share (Win: Win+Shift+S / Mac: ⌘+Shift+4)`）。

**変更**: 閲覧環境を見て**該当1行だけ**出す。

- 純関数 `pickScreenshotHint(platform)` を新設（`lib/share/` 配下・単体テスト）。入力＝正規化した platform（`'windows' | 'mac' | 'mobile' | 'other'`）、出力＝短い globally-clear English 文言：
  - windows: `Press Win+Shift+S, then drag the collage area.`
  - mac: `Press ⌘+Shift+4, then drag the collage area.`
  - mobile: `Take a screenshot, then post it with the link.`
  - other（Linux 等）: `Screenshot the collage area, then post it with the link.`
- platform 判定も純関数 `detectSharePlatform(ua, uaDataPlatform?)`（`navigator.userAgentData?.platform` 優先、無ければ `navigator.userAgent` から判定・単体テスト）。ShareToast は判定結果の文言を受け取るだけ（テスト容易・DOM 非依存）。
- **文言は当面 English 固定**（`DONE` / `RESELECT` / `COPY LINK` 等の既存ラベルと同じ globally-clear 方針・memory `feedback_globally_clear_english`）。i18n（15言語）は s164 §5 の宿題どおり将来判断とし、本セッションは英語1行で確定。

## ④ COPY LINK（再構成なしで `/s` リンクをコピー）

配置の下部バー `ShareToast` に **COPY LINK** ボタンを追加。押すと**選択カードの `/s` 取り込みリンクを生成してクリップボードへコピー**（投稿に「自分のスクショ画像 ＋ リンク」を併記できる）。**画像の再構成は一切しない。**

### 4.1 クライアント（ヘッドレス・再構成ゼロ）

新しいヘッドレスヘルパー（例 `lib/share/copy-share-link.ts` or BoardRoot のハンドラ）で：

1. 現在の選択（`selectedIds`）から共有ペイロード `share: ShareDataV2` を**既存チェーンで**組む＝`buildShareDataFromBoard`（[lib/share/board-to-share.ts](../../../lib/share/board-to-share.ts)）。ペイロードは**選択カードを盤面順（新しい順）**＝s157 選択的シェアと同一。**受け取り側 `/s`（SharedBoard）は無変更**。
2. `createShare({ share })` を **thumb 無しで**呼ぶ（[lib/share/api-client.ts:8](../../../lib/share/api-client.ts#L8)。型 `KVShareEntry.thumb` は既に任意＝[types-v2.ts:93](../../../lib/share/types-v2.ts#L93)）。
3. 成功したら `origin + '/s/' + id` を `navigator.clipboard.writeText` でコピー。
4. **`captureMirrorToWebP` / `renderShareImage` は呼ばない**（＝レプリカ完全排除）。

### 4.2 サーバー小変更（2ファイル）

現状 `/s` 生成は **thumb 必須**なので、それを緩める：

- **[functions/api/share/create.ts](../../../functions/api/share/create.ts)**: `thumb` を**任意**にする。
  - 現状 L111 `typeof bodyObj.thumb !== 'string'` → 400、L114-129 で R2 put 前提。
  - 変更：`thumb` が無い/空なら **R2 put をスキップ**して KV だけ書く（`share` の検証・KV 書き込み・id 返却は不変）。`thumb` があれば従来どおり R2 に put（後方互換・旧経路が使う余地を残す）。
- **[functions/api/share/[id]/og.ts](../../../functions/api/share/[id]/og.ts)**: thumb が無い共有の OG を **404 ではなく既定カードにフォールバック**。
  - 現状 R2 hit → 配信、無ければ KV 後方互換 thumb、どちらも無ければ 404。
  - 変更：R2 も KV thumb も無い場合、**`/og.png`（サイト既定 OG カード）へ 302 リダイレクト**（or 既定バイトを返す。方式は plan で1つに確定）。
- **[functions/s/patch-share-html.ts](../../../functions/s/patch-share-html.ts) は無変更**：`og:image = ${baseUrl}/api/share/${id}/og`（L42/L69）を指し続け、上記 og.ts のフォールバックで透過的に既定カードが出る。

### 4.3 UI とフィードバック

- ボタン順（案）: `SHARING… N` / ヒント / **COPY LINK** / `RESELECT` / `DONE`。COPY LINK は二次アクション見た目（`secondaryBtn` 系）。
- コピー成功：ボタンを一瞬 `LINK COPIED ✓` にラベル差し替え（数百 ms で戻る）等の軽い確認。既存トースト資産（`PasteSaveFeedback` 等）流用可。
- 失敗（ネットワーク/KV 満杯等）：`COULDN'T COPY — TRY AGAIN` の軽い通知。共有本体（スクショ）はアプリ責務外なので、COPY LINK 失敗でも配置画面は壊れない。

## データ／エラー／テスト

- **データ**: 配置座標・タイトルは React state のみ（不変・s164）。COPY LINK は `share` ペイロードのみ生成、画像は作らない。
- **エラー**: COPY LINK の `createShare` 失敗は軽い通知で握る。スクショはアプリ外＝失敗経路なし。
- **テスト**:
  - `pickScreenshotHint` / `detectSharePlatform` の純関数テスト（windows/mac/mobile/other）。
  - `copy-share-link` の純ロジック（選択→ペイロード→URL 組み立て）。`createShare` は mock。
  - サーバー：`create.ts` が thumb 無しで 200＋KV 書き込み（R2 put しない）／`og.ts` が thumb 無し id で既定カードにフォールバック（404 でない）。既存テスト（[create.test.ts](../../../functions/api/share/create.test.ts) / [og.test.ts](../../../functions/api/share/[id]/og.test.ts)）に追加。
  - `ScrollMeter` が `sharePhase==='arrange'` で非描画・`'select'`/`null` で描画（BoardRoot 統合 or Playwright）。
  - ※ 配置のカードクリック/ドラッグは `setPointerCapture` で Playwright 合成ポインタ不可（memory `reference_board_card_click_pointer_capture`）＝純関数＋手動目視中心。COPY LINK のクリップボードは Playwright で検証余地あり。

## やらないこと（non-goals）

- **B（PC 自動キャプチャ / getDisplayMedia）**：不採用（毎回の許可ポップアップ・PC 専用・非エンジニアに不安）。
- **レプリカ/再構成**（`captureMirrorToWebP` / `renderShareImage`）：一切使わない。ファイル自体は当面消さない（後方互換 og.ts の分岐や旧経路が参照）が、**新経路からは呼ばない**。
- **`/s` リンクの per-collage OG サムネ**：作らない（常に `/og.png`）。
- **配置画面のレイアウト変更・全画面化**：しない（決定C）。
- **撮影ガイドの永続枠**：置かない（スクショに写るため）。一瞬のハイライトのみ。
- **撮り方文言の 15 言語化**：本セッションでは英語1行で確定（将来判断）。
- **受け取り側 `/s`（SharedBoard）変更**：なし。
- **スマホ本格対応**：盤面自体が未対応。撮り方の一言だけ添える。

## 実装アンカー（実測）

| 箇所 | 現状 | 変更 |
|------|------|------|
| [BoardRoot.tsx:2760](../../../components/board/BoardRoot.tsx#L2760) | `{!showOnboarding && <ScrollMeter/>}` | `&& sharePhase !== 'arrange'` を追加 |
| [ShareToast.tsx:23-25](../../../components/board/ShareToast.tsx#L23) | ヒント英語ハードコード両OS併記 | OS 判定1行（`pickScreenshotHint`）＋ COPY LINK ボタン追加 |
| 新規 `lib/share/screenshot-hint.ts`（仮） | なし | `detectSharePlatform` / `pickScreenshotHint` 純関数 |
| 新規 `lib/share/copy-share-link.ts`（仮） | なし | 選択→`buildShareDataFromBoard`→`createShare({share})`→URL コピー（再構成なし） |
| [BoardRoot.tsx:2943](../../../components/board/BoardRoot.tsx#L2943) `ShareToast` 呼び出し | count/onReselect/onDone | onCopyLink（or 内部で選択から生成）＋ hint props を追加 |
| [functions/api/share/create.ts:111](../../../functions/api/share/create.ts#L111) | thumb 必須（無いと 400） | thumb 任意（無ければ R2 put スキップ・KV だけ書く） |
| [functions/api/share/[id]/og.ts](../../../functions/api/share/[id]/og.ts) | thumb 無し → 404 | thumb 無し → `/og.png` へフォールバック |
| [functions/s/patch-share-html.ts](../../../functions/s/patch-share-html.ts) | `og:image=/api/share/<id>/og` | 無変更 |

## 流用資産

- s164 SHARE 二段モード（`sharePhase` / `CollageCanvas` / `ShareToast`）
- s157 選択的シェアのペイロード生成（`buildShareDataFromBoard`・盤面順・受け取り側不変）
- `createShare`（[lib/share/api-client.ts](../../../lib/share/api-client.ts)・`KVShareEntry.thumb` 既に任意）
- 既定 OG カード `/og.png`（[functions/s/patch-share-html.ts](../../../functions/s/patch-share-html.ts) L60 コメントで既存確認）
- memory: `feedback_globally_clear_english` / `reference_board_card_click_pointer_capture` / `project_selective_share_shipped` / `reference_share_receiver_shell_generation` / `reference_og_image_route_no_extension`
