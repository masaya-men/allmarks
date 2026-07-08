# 次セッションのゴール — スマホ専用ライトボックスの残り（キャプション実機確認＋ツイート対応）

## まず最初に（ユーザーへの確認）
- **s180 でスマホ専用ライトボックス（没入型）を実装し、実機フィードバックで大幅に磨いた**。現状:
  - タップで開く／閉じる = **transform ベースのモーフ**（カード⇄全画面、点滅なし・カクツキなし・Apple風）。
  - 左右スワイプ = 前後送り。**強フリックで複数枚を慣性減速**（最新 onNav 参照で実際に進む）。
  - 上スワイプ = **キャプション画面**（カードが上に超縮小、キャプションが下から連結してせり上がる。背景は黒シートでなく PC と同じ「ぼかした暗いボード（backdrop）の上に透明で乗る」）。下スワイプ = カードへ戻る／カード画面なら閉じる。
  - ✕ボタンは廃止（画像に被るため。閉じは下スワイプ／余白タップ）。縦長画像はシート域を見越したサイズ（`--lightbox-media-max-h: calc(100dvh - 76px)`）。
- **セッション冒頭で実機のキャプション新モデルの感触を聞く**（`allmarks.app` ハードリロード）: 上スワイプでキャプション、カード縮小＋連結の動き、透明背景（ぼかしボード）の見え方、下スワイプで戻る/閉じる。

## 次にやること（優先順）
1. **キャプション新モデルの実機微調整**（カード縮小率 0.42・上げ量 0.30vh・キャプション開始位置 top:34vh・トランジション 0.52s power3.inOut は初期値。上スワイプの発見性ヒントが要るかも）。
2. **ツイート対応**（ずっと延期中）: 現状ツイートは画像＋タイトル＋出典のみ。**①ツイート動画の再生 ②複数画像ドット ③翻訳トグル**を種別分岐で作り込む（`useTweetTranslation` 共有が絡む。memory `project_mobile_board_direction` 参照）。
3. その後: スマホのタグ付け（未着手）。

## s180 で信じてよい実装（全て isMobile 分岐＝デスクトップ不変、tsc0/vitest2172/build OK）
- 新規: `MobileLightbox.tsx`（没入ステージ・4方向ジェスチャ・フリック慣性・キャプション2画面）／`use-lightbox-swipe.ts`（瞬間速度）／`lightbox-swipe.ts`（純判定16test）／`lightbox-nav-types.ts`。**`LightboxInfoSheet` は廃止・削除済**。
- `Lightbox.tsx`: `isMobile ? <MobileLightbox/> : <既存2カラム/>` の分岐。開閉モーフは**モバイルだけ transform ベース**（`isMobile` 分岐、`*_MOBILE` 定数）。**開閉モーフ・backdrop フェードは元々 frameRef ゲートでモバイル全 bail していたのを mediaRef 起点に修正**（重要）。
- **教訓**（memory 反映済み）: ①アニメ完了判定は view.url でなく単調カウンタ（重複URLで固まる）＋フェイルセーフ ②フリックは瞬間速度＆最新 onNav 参照 ③モバイルは transform-scale（クローンは点滅・reflowカクツキ）④ジェスチャ・モーフは実機のみ検証可。
- spec `docs/superpowers/specs/2026-07-08-mobile-lightbox-design.md` / plan `docs/superpowers/plans/2026-07-08-mobile-lightbox.md`。
