# 次セッションのゴール — スマホ閲覧の締め：実機フィードバック反映 →（残れば）スマホのタグ付け着手

## まず最初に（ユーザーへの確認）
- **s182 でスマホ専用ライトボックスの残り2つを実装・本番反映済み**。実機確認をお願いする2点：
  - **(A) 文字カード 22px**：サムネ持ちで小さい/失敗するカード（`LargePlaceholderCardScaler` の zoom 経路）も含めて 22px（キャプションと同じ）になった。**サムネ持ち文字カードを開いて確認**。Playwright でも両経路 font=22px 実測済み。
  - **(B) ツイート対応**：モバイルライトボックスで ①動画（再生ディスクをタップ→inline 再生）②複数画像ドット（下部オーバーレイ・タップで画像切替）③翻訳（写真動画ツイート=キャプション画面／文字ツイート=カード画面にボタン）。**実機で開いて動作確認**。※Playwright は②ドット＋文字22px＋クラッシュ無しを実測済み。①動画・③翻訳は X の syndication/翻訳が要る=**実機のみ検証可**。

## 次セッションでやること
### 1. ★実機フィードバックの反映（最優先）
- 上記 (A)(B) を実機で触ってもらい、気になる点を潰す。想定調整ポイント：
  - ツイート動画のサイズ感（`fullBleed`＝アスペクトで viewport 充填）。
  - 複数画像ドットの位置（`.mobileTweetDots` 下部16px オーバーレイ）・タップの当たり。
  - 文字ツイートの本文＋翻訳ボタンの見え方（カード画面に同居・`align-self:center`）。翻訳は `playEntry(el=null)` で**アニメ無しの即差し替え**（実機で物足りなければ swap アニメ配線を検討）。
  - 長い文字ツイート本文はカード画面で**スクロール不可**（`.mobileTextMain` は touch-action:none 配下）。長文が切れるなら pan-y 化 or キャプション送りを検討（Task A の文字カードと同じ既知制約）。

### 2. スマホ専用タグ付け（未着手）
- モバイルでのタグ付けフロー。既存タグ UI（`FilterPill` twin・memory `reference_allmarks_chrome_vocab_filterpill`）とボトムナビ TAG を土台に。

### 3. その後（任意）
- ピンチリサイズ／キャプション新モデルの微調整（カード縮小率・上げ量・timing は初期値のまま）。

## s182 で信じてよい実装（全て isMobile/tweetId 分岐＝デスクトップ不変、tsc0/vitest2172/build OK・本番反映済）
- **(A)**: `LargePlaceholderCardScaler` をモバイルで zoom せず `.mobileTextMain`(22px) を直描画に集約（サムネ無し経路＋サムネ失敗 fallback 経路の**両方を1箇所で捕捉**）。s181 の暫定分岐と dead `shouldRenderLargePlaceholderCard` は撤去。
- **(B)**: 新規 `MobileTweetLightbox`（Lightbox.tsx 内）が `useTweetTranslation` を1回呼んで main/caption に共有し、既存の `TweetMedia`/`LightboxImageDots`/`TweetText` を `MobileLightbox` シェルに載せ替え。`TweetVideoEmbed` に `fullBleed`、`TweetMedia`/`LightboxImageDots` に `mobile`、`TweetText` に `hideToggle`、`TweetTranslateControls` を抽出。mobile 分岐＝`tweetId ? <MobileTweetLightbox/> : <MobileLightbox generic/>`。
- CSS: `.mobileTweetTextMain`／`.mobileTweetMediaMain`／`.mobileTweetDots`（Lightbox.module.css）。
- spec/plan は s180 の `docs/superpowers/specs|plans/2026-07-08-mobile-lightbox*` を継承（本セッションは追補実装）。
