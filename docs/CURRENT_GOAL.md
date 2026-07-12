# 次セッションのゴール — スマホ縦4:5コラージュ 段階1 を「安価モデルで実装」（Claude が指揮）

## ★方向確定（s191・2026-07-13）: スマホのコラージュ＝縦 4:5 ネイティブ再設計

実機で「機能は動くがスマホに最適化された画面に見えない」＋「縦画面が普通では」とユーザー。**業界水準を調査 → 縦4:5の目標モックを作成しユーザー承認**。方針(A)確定:
- **モバイルのコラージュ＝縦 4:5 が主役**（保存＆縦向き共有）。**リンクカード用 1.91:1 は縦画像を中央レターボックスで自動併産**（サーバー無改変）。
- **段階1＝土台**（縦4:5の形と出力・チロムは現状のまま）／**段階2＝業界水準の編集チロム**（選択時ツールバー・レイヤー操作・スナップ＋触覚・ドラッグ削除・undo/redo・ズームはスライダー廃止→ピンチ+ダブルタップfit）。
- 目標モック: https://claude.ai/code/artifact/c624f258-08b7-4694-8cb0-39c610c9f476
- 設計書: `docs/superpowers/specs/2026-07-13-mobile-portrait-collage-redesign-design.md`

## ★最優先＝縦4:5 段階1 を実装（計画書あり・安価モデルで・Claude が subagent-driven で指揮）

計画書: `docs/superpowers/plans/2026-07-13-mobile-portrait-collage-stage1.md`（完全コード付き・4タスク）。
- **T1** `mobile-band.ts`＝アスペクト一般化＋`SHARE_PORTRAIT_ASPECT(1080×1350)`＋`mobileCollagePortraitBandRect`（帯が縦4:5に）。【haiku】
- **T2** `lib/share/letterbox.ts`＝`containFitRect`（純関数）＋`letterboxImageToAspect`（縦→1.91:1 併産）。【haiku/sonnet】
- **T3** `BoardRoot`＝`handleMobileEnterArrange` を縦帯に／`handleMobileCaptureAndCreate` を縦撮影(1080×1350)＋リンクカード併産（`capturedImageUrl`=縦・ホスト`thumb`=1.91:1レターボックス）／`MobileShareResult.module.css` を 4:5。【sonnet】
- **T4** e2e を縦前提に更新＋全体検証＋デプロイ＋実機確認依頼。【sonnet】
- **不変**: デスクトップ >640px バイト同一／サーバー・OG route・payload 無改変（ホストOGは1.91:1のまま）／`renderCollageCanvasToJpeg` 本体無改変（縦帯4:5→縦出力4:5は無歪み）。
- 実装手順: フィーチャーブランチ→subagent-driven（各タスクレビュー＋opus 全ブランチレビュー）→merge→デプロイ→実機確認。

## 段階1 の実機確認（出荷後）

`allmarks.app` ハードリロード → SHARE → 全選択 → ARRANGE が**縦長(4:5)**か → 並べて CREATE → **縦のプレビュー画像**が出るか → リンクを PC の X 等に貼るとカードは横長(1.91:1)で中央に縦コラージュが載るか → 100枚で破綻しないか。OK なら **段階2（業界水準チロム）** の詳細計画を書いて実装。

## バックログ（後で・ユーザー要望）

- **PC（デスクトップ）のコラージュが業界水準かの調査**（デスクトップ編集：四隅リサイズ・ホバー回転ノブ・レイヤー・整列を業界水準と比較して差分を洗う。競合名は tracked docs に書かない＝`docs/private/` へ）。

## 直前に出荷済（s191・実機確認は縦化で置き換わる）

- N-58 段階2（tap選択・2本指変形・ボードズーム）＋ズームスライダー（100枚の穴埋め）を出荷・デプロイ済（`allmarks.app`）。スライダーは段階2 でピンチ+ダブルタップfitに置き換え予定。

## 絶対に守ること（恒久ルール・継承）

- スマホ SHARE の撮影は canvas 直描画（`renderCollageCanvasToJpeg`）＝dom-to-image に戻さない。デスクトップ SHARE は dom-to-image のままバイト同一。
- 編集した位置/サイズ/回転/重なり順は完成画像に反映（z順=`collageOrder`）。
- デスクトップ >640px は 1px 不変（承認済み新機能の意図された変更を除く）／`rtk` 前置・`--no-verify` 禁止／機微・競合名は `docs/private/`／vitest・playwright は素の `npx`（`rtk npx` は誤解析）。
- 新しい操作系・見た目は着手前に superpowers:brainstorming（勝手に設計しない）。
