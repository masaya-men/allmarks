# 次セッションのゴール — スマホ閲覧の締め：実機フィードバック反映 →（残れば）スマホのタグ付け着手

## まず最初に（ユーザーへの確認）
- **s182 でスマホ専用ライトボックスの残り2つ＋実機フィードバック3件を実装・本番反映済み**。実機で再確認をお願いしたい点：
  - **(A) 文字カード 22px**：サムネ持ちで小さい/失敗するカードも 22px（キャプションと同じ）に。Playwright で両経路 font=22px 実測済み。
  - **(B) ツイート対応**：①動画（ディスクをタップ→inline 再生）②複数画像ドット（下部・タップで切替）③翻訳（写真動画=キャプション画面／文字=カード画面）。
  - **(修正1/2) ツイートメディアの大きすぎ・上スワイプで見切れ → 直した**：他のメディアと同じ envelope（`--lightbox-media-max-h`＝ツールバー考慮）に統一。承認済み画像と同サイズに（Playwright で 256×768 一致を実測）。
  - **(修正3) ボードのテキストカード上でスクロール不能 → 直した**：`.titleScroll` の touch-action を none→pan-y（board へフォールスルー）。
  - **(新規) スマホでカード角丸 ON/OFF**：ボトムナビに **CORNERS タブ**追加（MOTION と MORE の間）。タップで角丸⇔角ばり切替＋永続（Playwright 実測）。
  - **(新規) スマホのタグ付け**：TAG →**画面下部に横スクロールのタグ帯**（ナビは隠れる）。カードをタップで選択→**タグをタップで付与**（ドラッグ不要）。「+ NEW TAG」で作成、DONE で終了。Playwright で 帯表示・選択・作成付与・チップ付与・退出を実測。**横スクロールの感触・実機タッチは要実機確認**。
  - → **`allmarks.app` をスマホでハードリロードして、上記が実機で OK か確認**。①動画・③翻訳の実動作は X の syndication/翻訳 API 依存＝実機のみ検証可。

## 次セッションでやること
1. **実機で今回分を再確認**（ツイート＝動画/複数画像ドット/翻訳・文字カード22px・メディア収まり・テキストカードのボードスクロール・CORNERS・**タグ付け帯**）→ 気になる点を反映。
2. その後 **スマホ保存（束B）** or 残りのモバイル磨き（ピンチリサイズ・キャプション微調整）。詳細は [TODO.md](TODO.md) と `docs/private/2026-07-08-release-runway-plan.md`（束B）。

### 実機で見るときの既知の調整候補
- ツイート動画/複数画像ドット/翻訳ボタンの見え方・当たり。文字ツイートの翻訳は `playEntry(el=null)` で**アニメ無しの即差し替え**（物足りなければ swap アニメ配線）。
- 長い文字ツイート/文字カードの本文はカード画面で**スクロール不可**（`.mobileTextMain`）。長文が切れるなら pan-y 化 or キャプション送りを検討。
- タグ帯の横スクロールの感触・チップの当たり・「選択→タップ付与」の分かりやすさ。

## s182 で信じてよい実装（全て isMobile/tweetId 分岐＝デスクトップ不変、tsc0/vitest2172/build OK・本番反映済）
- **(A)**: `LargePlaceholderCardScaler` をモバイルで zoom せず `.mobileTextMain`(22px) を直描画に集約（サムネ無し経路＋サムネ失敗 fallback 経路の**両方を1箇所で捕捉**）。s181 の暫定分岐と dead `shouldRenderLargePlaceholderCard` は撤去。
- **(B)**: 新規 `MobileTweetLightbox`（Lightbox.tsx 内）が `useTweetTranslation` を1回呼んで main/caption に共有し、既存の `TweetMedia`/`LightboxImageDots`/`TweetText` を `MobileLightbox` シェルに載せ替え。`TweetVideoEmbed` に `fullBleed`、`TweetMedia`/`LightboxImageDots` に `mobile`、`TweetText` に `hideToggle`、`TweetTranslateControls` を抽出。mobile 分岐＝`tweetId ? <MobileTweetLightbox/> : <MobileLightbox generic/>`。
- CSS: `.mobileTweetTextMain`／`.mobileTweetMediaMain`／`.mobileTweetDots`（Lightbox.module.css）。
- spec/plan は s180 の `docs/superpowers/specs|plans/2026-07-08-mobile-lightbox*` を継承（本セッションは追補実装）。
