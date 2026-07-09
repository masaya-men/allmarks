# 次セッションのゴール — スマホ専用ライトボックスの残り = ツイート対応（他はユーザーOK済み）

## まず最初に（ユーザーへの確認）
- **s180-181 でスマホ専用ライトボックス（没入型）を完成させ、実機フィードバックで磨き込み済み**。ユーザーは画像/動画/サイト/文字カード/操作系すべてOK確認済み。現状:
  - タップで開く／閉じる = **transform ベースのモーフ**（カード⇄全画面、点滅なし・カクツキなし・Apple風）。
  - 左右スワイプ = 前後送り。**強フリックで複数枚を慣性減速**（最新 onNav 参照で実際に進む）。
  - 上スワイプ = **キャプション画面**（s181で修正: カードは縮小せず上へスクロールアウト、キャプションが**カードと同じ中央スポット**に。gsap を y(px) 統一で「上スワイプで出ない」バグも解消）。背景は PC と同じ「ぼかした暗いボード（backdrop）の上に透明」。下スワイプ = カードへ戻る／カード画面なら閉じる。
  - ✕廃止。縦長画像はシート域を見越したサイズ。

## 次セッションでやること（ユーザー確定）
### (A) ★文字カードの文字サイズをキャプションと同じ 22px に（s181で未完・実機で「変わってない」）
- **原因確定（コード検証済み）**: 文字カードの描画経路が2つあり、s181の修正は片方しか捕まえていない。
  - 経路A（サムネ無し `!view.thumbnail`）: 私が入れた `.mobileTextMain`(22px) が効く。
  - **経路B（サムネ持ちだが小さい/失敗→文字に落ちる）**: `LightboxMedia`→`LightboxImageWithFallback`→実行時フォールバック→**`LargePlaceholderCardScaler`**（[Lightbox.tsx:2302-2318](../components/board/Lightbox.tsx#L2302)）。`zoom = boxWidth/boardW`（モバイルで約3倍）で board カードを拡大＝**巨大文字**。`!view.thumbnail` を通らないので未修正。← ユーザーの文字カードはこれ。
- **直し方（推奨）**: Lightbox.tsx isMobile 分岐の暫定 `.mobileTextMain` 条件は**撤去**し、代わりに **`LargePlaceholderCardScaler` をモバイルで zoom せず 22px 直描画**に（＝両経路を1箇所で捕捉）。`useIsMobile` を渡すか、`@media(max-width:640px)` で `.imageBox` 内の zoom を無効化＋`.mobileTextMain` 相当の 22px テキストに置換。文字色は `var(--text-primary)`（キャプションと同じ・実証済み）。
- 完了判定: 実機でサムネ持ち文字カードを開いて 22px（キャプションと同一）か確認。

### (B) ツイート対応（ユーザー「他はOK、123を次で」）
- ①ツイート動画の再生 ②複数画像ドット ③翻訳トグル。`useTweetTranslation` 共有が絡む（memory `project_mobile_board_direction`）。現状は画像＋タイトル＋出典のみ。

## 次にやること（優先順）
1. **キャプション新モデルの実機微調整**（カード縮小率 0.42・上げ量 0.30vh・キャプション開始位置 top:34vh・トランジション 0.52s power3.inOut は初期値。上スワイプの発見性ヒントが要るかも）。
2. **ツイート対応**（ずっと延期中）: 現状ツイートは画像＋タイトル＋出典のみ。**①ツイート動画の再生 ②複数画像ドット ③翻訳トグル**を種別分岐で作り込む（`useTweetTranslation` 共有が絡む。memory `project_mobile_board_direction` 参照）。
3. その後: スマホのタグ付け（未着手）。

## s180 で信じてよい実装（全て isMobile 分岐＝デスクトップ不変、tsc0/vitest2172/build OK）
- 新規: `MobileLightbox.tsx`（没入ステージ・4方向ジェスチャ・フリック慣性・キャプション2画面）／`use-lightbox-swipe.ts`（瞬間速度）／`lightbox-swipe.ts`（純判定16test）／`lightbox-nav-types.ts`。**`LightboxInfoSheet` は廃止・削除済**。
- `Lightbox.tsx`: `isMobile ? <MobileLightbox/> : <既存2カラム/>` の分岐。開閉モーフは**モバイルだけ transform ベース**（`isMobile` 分岐、`*_MOBILE` 定数）。**開閉モーフ・backdrop フェードは元々 frameRef ゲートでモバイル全 bail していたのを mediaRef 起点に修正**（重要）。
- **教訓**（memory 反映済み）: ①アニメ完了判定は view.url でなく単調カウンタ（重複URLで固まる）＋フェイルセーフ ②フリックは瞬間速度＆最新 onNav 参照 ③モバイルは transform-scale（クローンは点滅・reflowカクツキ）④ジェスチャ・モーフは実機のみ検証可。
- spec `docs/superpowers/specs/2026-07-08-mobile-lightbox-design.md` / plan `docs/superpowers/plans/2026-07-08-mobile-lightbox.md`。
