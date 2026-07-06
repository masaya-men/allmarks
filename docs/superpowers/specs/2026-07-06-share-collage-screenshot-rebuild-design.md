# SHARE 作り直し — コラージュ・スクショ方式 設計 — 2026-07-06 セッション164

## 背景・目的

s163 でユーザーが本番（サブ①の SHARE 右ドロワー）を見て「まだ全然違う」と再定義した。
既存 backlog **N-34（選択→本物ビューで整える）/ N-36（共有だけ自由配置コラージュ）/ N-37（自由タイトル）/ N-38（レプリカでなくスクショで送る）** を1つに統合する作り直し。

現状の共有は「盤面のレプリカを再構成して見せる／`dom-to-image` で画像化」だが、
- ボードは他サイトのサムネ＝クロスオリジン画像を含み、`dom-to-image` でキャンバスが tainted になり黒窓/失敗する（memory `reference_dom_to_image_bound_subtree`）
- レプリカ再構成は「自分のボードの見た目どおりにならない」不満の元

**ゴール**: SHARE を「窓（パネル/ドロワー）を出さず、盤面が SHARE モードに入る」体験に作り直す。
選んだカードを**自由配置コラージュ**にし、**ユーザー自身が画面をスクショして SNS に添付**する（アプリは画像生成しない＝WYSIWYG・ピクセル一致・クロスオリジン回避）。
「相手が取り込めるリンク（/s）」は捨てず、**併記できる任意アクション**として残す。

このアプリのミッション（コラージュを画像で SNS シェアさせてバイラルを起こす＝「作って見せる」ツール）に、共有体験を正面から合わせる。

## ユーザー確定事項（s163 理解確認 ＋ s164 相談）

- **決定①**: `/s/<id>` 取り込みリンクは **(b) 両立・分離**。新 SHARE＝スクショが主役。取り込みリンクは別の静かな任意アクションとして残す。
  - 「画像そのものをクリックで取り込み」は SNS の仕組み上不可能（画像はただの絵・任意 URL に飛ばせない）。取り込みには必ず URL（リンク）が要る。
  - **併記型**で行く：投稿に「スクショ画像 ＋ 取り込みリンク」を一緒に貼る。QR 埋め込み型は今回やらない（将来案）。
- **決定②**: 自由配置は **(a) 一時状態**。SHARE モード中だけ。抜けると盤面はグリッドに戻る（本物盤面には反映しない）。
  - 理由：盤面グリッド常時＝核の設計法則（memory `feedback_allmarks_grid_no_tilt`）。SHARE は意図的な例外。
- **モード構造**: **A 案・二段（選ぶ → 並べる）**。
- **タイトル**: N-37 の基本（出し入れ＋文言編集＋サイズ＋**ドラッグ移動**）を今回実装。フォント種類の選択（N-35）は次回。
  - 「タイトル」＝ヘッダー **TITLE ボタン**で出し入れする**背景の大きな文字**（[BoardBackgroundTypography.tsx](../../../components/board/BoardBackgroundTypography.tsx) / `bgTypoEnabled`）。現状は中身＝絞り込み中のタグ名（`deriveBoardBgTypoText`）で固定・書体 CSS 固定・編集不可。
- **タイトルの重なり順**: 既定でカードの**後ろ**（背景の見出し感）。前後の切替は将来。

## 1. 全体フロー

1. ヘッダー **SHARE 押下 → SHARE モード突入**（現状の「右ドロワー `activeDrawer='share'` を開く」挙動を置換）。窓は出さない。
2. **第1段「選ぶ」**: 盤面はグリッドのまま、カードをタップして選ぶ（0 枚スタート）。タグ絞り込みも効く。下部バーの **配置へ** で第2段へ。
3. **第2段「並べる」**: 選んだカードだけを空きキャンバスに出す。自由に移動・拡縮・重ね（＝コラージュ）。タイトルを出して編集・移動も可。下部は「シェア中…」トースト。
4. **ユーザーが画面をスクショ**して SNS に添付（アプリは撮らない）。任意で「取り込みリンクをコピー」して併記。
5. **終了** で SHARE モードを抜け、盤面はグリッドに復帰。配置・タイトルの一時状態は破棄（永続化しない）。**選び直す**で第1段へ戻れる（選択は維持）。**CANCEL / Esc** で破棄して離脱。

## 2. 第1段「選ぶ」の挙動（s157 選択モードを流用）

現行の s157 選択モード（[spec 2026-07-03-selective-share](./2026-07-03-selective-share-design.md)）を**ほぼそのまま再利用**する。相違点だけ記す。

- クリック＝選択トグルのみ。Lightbox / 並べ替え / リサイズ / ホバー操作は無効（誤操作防止）＝現行どおり。
- 選択済みの見た目：角に緑チェックバッジ（#28F100）＋細い緑アウトライン＝現行どおり。
- タグ絞り込みは第1段でも使用可（絞り込み切替でも選択集合は維持）＝現行どおり（[FilterPill](../../../components/board/FilterPill.tsx) 流用）。
- **相違**: 下部固定バー（[ShareSelectBar](../../../components/board/ShareSelectBar.tsx)）の primary を **SHARE (n) → 「配置へ (n)」** に変更。押すと**第2段へ遷移**する（＝現状は共有ドロワーを再度開いていた `handleSelectShare` の遷移先を置換）。
- 100 枚上限・SELECT ALL・「100 MAX」琥珀フィードバックは現行どおり（`lib/share/selection.ts`）。

## 3. 第2段「並べる」キャンバス＝要素モデル

配置キャンバスを **"置ける要素（placeable element）" の集合**として設計する。カードもタイトルも同じ「置ける要素」（位置 `x,y` ／サイズ ／重なり順 `z`）として扱い、ドラッグ移動・リサイズ・重なりの土台を共通化する。これが「タイトルの配線を楽にする」中核。

### 3.1 共通の placeable 挙動
- **移動**: 掴んで直接ドラッグ（ハンドル無し・memory `feedback_inline_and_direct_drag`）。
- **リサイズ**: 既存の自由リサイズ資産を流用（memory `feedback_free_size_decided`／`reference_cardwidth_dual_management`）。
- **重なり順**: 要素は `z` を持つ。掴んだ要素を最前面に上げる等の素直なルール。タイトルは既定で最背面。
- **座標系**: React state のみ（IDB 永続なし＝一時状態）。モード離脱で破棄。
- **スクショ面**: 盤面ビューポートがそのままスクショ対象。要素はビューポート内に配置する前提。ビューポートを超える分はユーザーが縮小/移動して収める（アプリ側で自動フィットはしない＝WYSIWYG）。

### 3.2 カード層
- 第2段に入った時点の**初期レイアウト**は、選択カードを **`computeSkylineLayout`（[lib/board/skyline-layout.ts](../../../lib/board/skyline-layout.ts)）で詰め直した配置**を初期値にする（選択的シェアのプレビューと同じ考え方）。そこからユーザーが自由に動かす。
- 各カードは placeable 要素。移動・拡縮・重ね順を自由に。

### 3.3 タイトル層
セクション4 参照。

## 4. タイトル（N-37 基本）

### 4.1 共有タイトル設定オブジェクト（配線の要）
現状、背景ワードマークの表示テキストは `deriveBoardBgTypoText(filter, tags)` ＋ CSS 固定サイズに**ハードコード**されている。
これを **単一の設定オブジェクト**経由に変える：

```
ShareTitleConfig = {
  enabled: boolean          // 出し入れ（既存 bgTypoEnabled 相当）
  text: string | null       // 上書き文言。null/空 = 既定（絞り込み中のタグ名）
  size: number              // フォントサイズ（px 基準・自由に巨大化可）
  x: number                 // 位置（ビューポート基準）
  y: number
  // font（種類）は N-35 で追加する余地。今回は既定フォント固定。
}
```

- [BoardBackgroundTypography.tsx](../../../components/board/BoardBackgroundTypography.tsx) を再利用。SHARE モード時はこの設定オブジェクトが表示（文言/サイズ/位置/出し入れ）を駆動する。
- **配線が楽な理由**: N-35（フォント種類ピッカー）を後で足す＝この設定に `font` を1プロパティ足し、コントロールを1個繋ぐだけ。位置・サイズ・編集の土台は既にある。

### 4.2 挙動
- **出し入れ**: 既存 TITLE トグル（[BoardRoot.tsx:2398](../../../components/board/BoardRoot.tsx#L2398) 付近 `label="TITLE"`）を SHARE モードでも使う。ヘッダーは SHARE モード中も表示のまま（範囲選択スクショで写り込まない＝セクション6）ので、TITLE 導線を新設せず既存ボタンを流用する。
- **その場インライン編集**: ワードマークをクリック → テキスト編集。空 or OFF で消える。既定は絞り込み中のタグ名（`deriveBoardBgTypoText`）、編集すると `text` を上書き。
- **サイズ**: 掴んで拡縮。巨大化・盤面横断 OK（N-37「文字が盤面いっぱいに欠けてもよい」）。
- **移動**: 掴んでドラッグ（placeable 要素として）。
- **重なり順**: 既定でカードの後ろ（背景の見出し）。
- **N-35（フォント種類の選択）は今回やらない**。既定フォント＋サイズ＋出し入れ＋文言＋移動まで。

## 5. 下部「シェア中…」トースト

パネルは出さず、画面下のトースト/バーだけ（画面を綺麗に保つ＝s163 ビジョン）。s157 [ShareSelectBar](../../../components/board/ShareSelectBar.tsx) の見た目資産を流用。

- **左**: `シェア中… N枚`（対象件数）
- **撮り方の一言**（セクション6）
- **取り込みリンクをコピー**（任意・併記用／セクション5）
- **選び直す**: 第1段「選ぶ」へ戻る（選択集合は維持）
- **終了**: モード離脱・盤面グリッド復帰・一時状態破棄

ラベルは既存同様の英語直書き（globally-clear／memory `feedback_globally_clear_english`）方針を踏襲しつつ、トーストの説明文は日本語 UI 文言（i18n 対象）でよいかは実装時に i18n 方針と擦り合わせる。

## 6. スクショ導線

- アプリは撮らない（WYSIWYG・クロスオリジン回避）。トーストに撮り方を一言だけ添える：
  - Windows: `Win + Shift + S`
  - Mac: `⌘ + Shift + 4`
  - モバイル: 端末のスクショ機能
- **重要（WYSIWYG のチラ写り対策）**: 推奨ショートカットは両方とも**範囲選択キャプチャ**。ユーザーは**コラージュ部分だけを囲んで撮る**ので、ヘッダー・「シェア中…」トースト等の画面上のクロムは自然に範囲外になる。よって第2段でヘッダーやトーストを無理に隠す必要はない（＝TITLE トグル等の既存クロムをそのまま使える）。撮り方の一言に「コラージュの範囲を囲んで撮ってください」の趣旨を含める。
- 詳細 UX（OS 判定して1つだけ出す等）は実装時に詰める。

## 7. 取り込みリンク（決定①b・併記・任意）

- **スクショ SHARE 自体はサーバー不使用のまま**（純粋スクショ）。
- トーストの任意ボタン「取り込みリンクをコピー」を押した時**だけ**、選択カードから `/s/<id>` を生成する：
  - 既存の `/s` リンク生成（`buildShareDataFromBoard` [lib/share/board-to-share.ts](../../../lib/share/board-to-share.ts) → KV/R2 アップロード → URL）を流用。
  - **画像プレビュー / ミラー（ShareMirror）は使わない**（リンク URL をクリップボードにコピーするだけ）。
- これで「スクショ画像 ＋ 取り込みリンク」を投稿に**併記**できる。
- ペイロードは選択カードを盤面順（新しい順）で渡す＝現行選択的シェアと同じ。受け取り側（/s = SharedBoard）は**変更なし**。

## 8. 撤去・整理

- 旧 SHARE ドロワーの「盤面まるごと画像プレビュー」（[SenderShareModal](../../../components/share/SenderShareModal.tsx) のミラー表示 / 画像生成 / SAVE IMAGE / POST TO X）は役目終了。**リンク生成部だけ残して縮小/切り出し**する。
- `activeDrawer === 'share'` は廃止。ヘッダー SHARE ボタンは**モード突入**に配線し直す。
  - サブ①（[flat-sub1 spec](./2026-07-05-flat-sub1-menu-neutrality-right-drawer-design.md)）で SHARE/TUNE/SETTINGS/THEMES を右ドロワー `ChromeDrawer` に統一したが、**SHARE だけがドロワーから外れてモードに戻る**。TUNE/SETTINGS/THEMES の統一は維持。新 SHARE は本質的にパネルでなくモードなので妥当な部分巻き戻し。
- 旧「SELECT CARDS」入口（ドロワー内ボタン `onSelectCards` → `handleEnterSelectMode`）は、ヘッダー SHARE がその役目を担うため統合。

## 9. 実装の配線ポイント（現状の実測アンカー）

| 箇所 | 現状 | 変更 |
|------|------|------|
| [BoardRoot.tsx:2461](../../../components/board/BoardRoot.tsx#L2461) 付近 | ヘッダー SHARE = `setActiveDrawer('share')` | SHARE モード突入（第1段「選ぶ」開始）に配線し直す |
| [BoardRoot.tsx:1940](../../../components/board/BoardRoot.tsx#L1940) `handleEnterSelectMode` | 選択モード開始（`selectMode`/`selectedIds`） | SHARE 入口として流用。`selectMode: boolean` を **`sharePhase: 'select' \| 'arrange' \| null` に一般化**（`'select'`＝旧 selectMode 相当、`'arrange'`＝新・並べる段、`null`＝非モード）。`selectedIds` はそのまま |
| [BoardRoot.tsx:1971](../../../components/board/BoardRoot.tsx#L1971) `handleSelectShare` | ドロワー再オープン | **第2段「並べる」へ遷移**に置換（ドロワーを開かない） |
| [ShareSelectBar.tsx](../../../components/board/ShareSelectBar.tsx) | primary = `SHARE (n)` | primary = `配置へ (n)`。それ以外（件数/SELECT ALL/CANCEL/100 MAX）は不変 |
| 配置キャンバス | なし | 新規：placeable 要素（カード＋タイトル）の自由配置レイヤー。初期値は `computeSkylineLayout` の選択部分集合 |
| [BoardBackgroundTypography.tsx](../../../components/board/BoardBackgroundTypography.tsx) | テキスト＝`deriveBoardBgTypoText` 固定・CSS 固定・編集不可 | `ShareTitleConfig`（enabled/text/size/x/y）駆動に。インライン編集＋ドラッグ移動＋リサイズ |
| 「シェア中…」トースト | なし | 新規（第2段中のみ mount）。ShareSelectBar の見た目資産流用。z-index は定数へ |
| [SenderShareModal.tsx](../../../components/share/SenderShareModal.tsx) | 画像プレビュー＋リンク＋画像化 | 画像プレビュー/ミラー/画像化を撤去、リンク生成部だけ残して縮小/切り出し |

- placeable 要素の座標/サイズ/重なり計算、選択→配置初期化などのロジックは**純関数**に切り出して単体テスト（例: `lib/share/collage-layout.ts` 等）。

## 10. データ／エラー／テスト

- **データ**: 配置座標・タイトル設定は React state のみ。IDB 永続なし。モード離脱で破棄（決定②a）。
- **エラー**: 「取り込みリンクをコピー」の生成失敗は既存の失敗 UI（トースト）で通知。スクショはアプリ責務外なので失敗経路なし。
- **テスト**:
  - 選択（第1段）→ 配置（第2段）の遷移、選び直しで選択維持
  - placeable 要素のドラッグ移動 / リサイズ / 重なり順
  - タイトルのインライン編集 / 移動 / サイズ / 出し入れ、既定＝タグ名・上書きで置換
  - 取り込みリンク生成（選択集合が盤面順で載る／受け取り側不変）
  - モード離脱（終了/CANCEL/Esc）で一時状態が破棄される
  - ※ 盤面カードクリックは Playwright 合成ポインタ不可（memory `reference_board_card_click_pointer_capture`）＝配置ドラッグの e2e は制約あり。単体/純関数テスト中心。

## 11. やらないこと（non-goals）

- 自由配置の**本物盤面への永続反映**（決定②a＝一時のみ。将来案へ）
- タイトルの**フォント種類ピッカー**（N-35＝次回。今回は既定フォント）
- タイトルの**前後（z-order）切替 UI**（今回は既定で背面固定）
- **QR 埋め込み型**の併記（今回は「画像＋リンク併記」まで。将来案へ）
- アプリによる**画像生成**（スクショはユーザー責務＝WYSIWYG の肝）
- 受け取り側（/s = SharedBoard）の変更
- スマホ本格対応（盤面自体が未対応プラットフォーム。撮り方の一言だけ添える）
- 100 枚上限の撤廃

## 12. 将来案（IDEAS.md へも記録）

- **本物盤面でも自由配置を解禁**：「デフォルト順に戻す仕組み」（[2026-07-02-board-reset-layout-design](./2026-07-02-board-reset-layout-design.md)）が出来たので、いつでも戻せる前提なら現実的（ユーザー s164 着想）。ただしグリッド常時法則との整合を要設計。
- **タイトルのフォント種類ピッカー（N-35）**：`ShareTitleConfig.font` を足す。
- **タイトルの前後切替**：`z` を前面にも置けるトグル。
- **QR 埋め込み型併記**：コラージュ隅に `/s` リンクの QR を描き、画像1枚で取り込みまで完結（スクショ前に KV へ上げる手間が付く点が判断どころ）。
- **保存レイアウト集**：作ったコラージュ配置を保存して再利用（別機能）。

## 13. 流用資産（まとめ）

- s157 選択モード（[ShareSelectBar](../../../components/board/ShareSelectBar.tsx) / [lib/share/selection.ts](../../../lib/share/selection.ts)）
- `computeSkylineLayout`（[lib/board/skyline-layout.ts](../../../lib/board/skyline-layout.ts)）
- 既存 reorder / free-size ドラッグ資産
- [BoardBackgroundTypography.tsx](../../../components/board/BoardBackgroundTypography.tsx)（タイトル層）
- `/s` リンク生成（`buildShareDataFromBoard` [lib/share/board-to-share.ts](../../../lib/share/board-to-share.ts) → KV/R2）
- memory: `feedback_allmarks_grid_no_tilt` / `feedback_inline_and_direct_drag` / `project_selective_share_shipped` / `reference_dom_to_image_bound_subtree` / `reference_board_card_click_pointer_capture`
