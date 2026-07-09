# 次セッションのゴール — スマホ保存（束B）に着手 or 残りのモバイル磨き

## まず最初に（ユーザーへの確認）
- **s182 は全て実機OK・本番反映済み**（スマホ閲覧まわりが一通り完成）:
  - スマホ専用ライトボックス（没入型・4方向ジェスチャ・キャプション2画面）
  - 文字カード22px（サムネ失敗経路も根治）／ツイート対応（動画・複数画像ドット・翻訳）
  - リグレッション3件根治（ツイートメディアの大きすぎ→envelope統一／ボードのテキストカードスクロール→pan-y）
  - スマホで角丸ON/OFF（CORNERS タブ）／**スマホのタグ付け（下部の横スクロールタグ帯・タップ付与）**
- ここで**スマホ閲覧（束A相当）は一区切り**。次は下記のどちらかをユーザーと決めて進める。

## 次セッションでやること（開始時にユーザーへ確認）
1. **本命＝スマホ保存（束B）**: 現状スマホの保存導線は実質ゼロ（ブックマークレットはドラッグ前提、share_target は manifest 宣言のみで受け側なし）。**URL 入力欄 or Share Sheet 受信**を作る。再利用入口: `ingestPastedUrl`（[lib/board/paste-ingest.ts](../lib/board/paste-ingest.ts)）＋既存 OGP プロキシ（[functions/api/ogp.ts](../functions/api/ogp.ts)）。詳細計画 `docs/private/2026-07-08-release-runway-plan.md` 束B。
2. **or 残りのモバイル磨き**: ピンチリサイズ／キャプション新モデルの微調整／長文テキストカードのスクロール（カード画面で touch-action:none のため不可＝pan-y化 or キャプション送りを検討）。

## 直近のリリース段取り（参考・`docs/private/2026-07-08-release-runway-plan.md`）
束A スマホ閲覧（ほぼ完了）→ **束B スマホ保存** → ここで公開日宣言可 → 束C 13言語仕上げ＋規約 → 束D 公開素材 → 束E 総仕上げ・公開。課金の線引き（無料=手動EXPORT/IMPORT・有料=端末間同期の案B）は `docs/private/IDEAS.md` #5 と一体。

## s182 の実装の在り処（次セッションが触るとき用）
- モバイル系は全て `isMobile`/`tweetId` 分岐＝**デスクトップ不変**。ライトボックス=`MobileLightbox.tsx`/`Lightbox.tsx`（`MobileTweetLightbox`）、ナビ=`BoardMobileNav.tsx`（CORNERS）、タグ帯=`BoardMobileTagBar.tsx`＋`CardsLayer.tsx`（モバイルタグモードは capture せず native click 選択）。メディアの高さは `--lightbox-media-max-h`（=100dvh-76px, memory `reference_mobile_lightbox_media_envelope`）。
