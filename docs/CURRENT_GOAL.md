# 次セッションのゴール — ★スマホ専用ライトボックスを作る（束A の続き）

## 正本計画（毎回最初に読む）

**`docs/private/2026-07-08-release-runway-plan.md`**（非公開）＋ このファイル。
s178 でモバイル盤面の土台が本番反映済み（下記「直近の完了」）。次は**スマホ専用ライトボックス**。

## ★次にやること = スマホ専用ライトボックス（ユーザー確定仕様）

- **タップでメディアを中央に大きく表示**（画像・動画・テキストカード）。
- **キャプションは画面下部にチラ見せ（peek）→ タップで下から上にスライドイン**（ボトムシート）。
- **縦スワイプで前後のカードへめくる**（PCの左右送りと同じ意味。現状はホイール/矢印のみ＝タッチ swipe が無い）。
- **閉じる**＝提案: 下スワイプで閉じる＋✕も残す（ユーザーに1行確認してから）。
- 言語ボタンは既にモバイル非表示済み（この中で最終確認）。
- **デスクトップのライトボックスは1pxも変えない**（全部 `isMobile` / `@media(max-width:640px)` ゲート）。

### 実装の勘所（s178 調査済・信じてよい／行番号はズレ得る）

- 本体 [Lightbox.tsx](../components/board/Lightbox.tsx)（**2264行・大型**）。構造: `.backdrop`(dim/クリックで閉じる z100) → `.stage`(z300, 中央寄せ, ナビchevron) → `.frame`(内容, クリックで閉じる, 閉じる✕ + メディア + テキスト)。非tweetは `.media`(LightboxMedia) + `.text`(DefaultText) の2カラム。tweetは `<TweetColumns>`。カード種別ごとに分岐レンダラ多数（image/instagram/video/tweet/text）。
- ナビは**ホイール(deltaX/deltaY)＋矢印キー＋nav prop(chevron/dots)**。`nav.onNav(-1|1)`。**タッチ swipe ハンドラは無い**＝追加が必要（縦スワイプ→ `nav.onNav`、下スワイプ→ close）。既存 wheel の deltaY→nav の向きに合わせる。
- FLIP開閉モーフ（カード矩形から拡大）は既存で優秀＝**モバイルでも流用**。レイアウトだけ `@media` でモバイル化（メディア全幅中央＋テキストをボトムシート化）。
- CSS: [Lightbox.module.css](../components/board/Lightbox.module.css)。`.frame`/`.media`/`.text`/`.backdrop`。ここに `@media(max-width:640px)` を足す。
- キャプション peek→展開は**新規 state（collapsed/expanded）＋タップ＋CSS transition**。`.text` をモバイルでは下部固定シート化。
- 検証: モバイル実測は 390×844/dsf3。**CDP合成タッチは1ドラッグにつき pointermove を1回しか配信しない**＝swipe/滑らかさは実機確認（memory `reference_playwright_board_share_verify`）。カードタップ→ライトボックス移行の合成ポインタも不可＝実機。

## その後（順番確定・ユーザー承認済）

1. スマホ専用ライトボックス（今回） → 2. **スマホ専用タグ付け**（選択→下部の横スクロールタグをタップで付与） → 3. **ピンチでカードリサイズ**（仕上げ）。

## 直近の完了（s178 — モバイル盤面の土台＋操作系、本番反映済）

- 外枠なし全画面・**3列密グリッド**・左上 AllMarks・右上 FILTER・**ボトムナビ**(TAG/THEME/MOTION/MORE⋯)。全部 `MOBILE_BP_PX=640` ゲート、デスクトップは回帰なし（1489確認）。
- **タップ=Lightbox / ドラッグ=盤面スクロール（カード上でも）/ 並べ替え・リサイズハンドル・hover操作系・言語ボタンはモバイル非表示**。絞り込みメニュー開時のタップは閉じるだけ（Lightbox並行を防止）。
- 詳細は memory `project_mobile_board_direction` と TODO_COMPLETED s178。
