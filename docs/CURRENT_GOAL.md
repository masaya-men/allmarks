# 次セッションのゴール — N-58 段階2（スマホの新しい編集操作）を「実機確認」→ OK なら N-57+59 へ

## ★N-58 段階2 は実装・出荷済（s191・2026-07-12）

スマホのコラージュ編集を「標準マルチタッチ」に作り直し、本番反映済。**再ブレスト（superpowers:brainstorming）→ writing-plans → subagent-driven-development（Task 1〜6＋各レビュー＋opus 全ブランチレビュー MERGE READINESS=YES）**で自走完遂。tsc0 / vitest 2326 / build OK / playwright mobile-share 10/10 / `merge --no-ff` f6497904 / `allmarks.app` デプロイ済。詳細 [TODO.md](TODO.md) s191・memory `project_n58_stage2_gesture_model`。

## ★最優先＝実機確認（実タッチのピンチ/回転は実機でしか検証できない）

スマホで **`https://allmarks.app` をハードリロード**して:

1. SHARE → 全選択 → ARRANGE（枚数が多いほど良い）
2. カードを**1回タップ** → **白い枠**が出て「選択中」になるか
3. 選択したまま**2本指ピンチ** → そのカードが**拡大/縮小**するか。**二本指をひねると回る**か
4. カードを**1本指でドラッグ** → 動くか（指とズレないか）
5. **余白を1回タップ** → 枠が消えて選択解除されるか
6. **何も選択していない状態で2本指ピンチ** → **ボード全体が拡大**するか。拡大したまま**1本指で余白をなぞると見える場所が動く**か
7. **CREATE** → できた画像が「並べたとおり」か（**ボードのズームは画像に影響しないはず**）
8. 100枚でも 2〜7 が破綻しないか（重い/カクつく等あれば教えて）

## 結果の分岐

- **OK** → **N-57+59（スマホ盤面の小物2点）** へ（ロードマップ次点）。計画は `docs/superpowers/plans/2026-07-11-n57-n59-mobile-board-polish.md`。
- **感触の調整だけ要る**（ズーム上限が足りない/効きすぎ、パンの遊び）→ `STAGE_ZOOM_MAX`（`lib/share/stage-zoom.ts`）/ `PAN_SLOP_PX`（`components/board/MobileArrangeGestures.tsx`）を1箇所だけ変えて再デプロイ。
- **不具合**（枠が出ない/指とズレる/画像が編集どおりでない）→ スクショで症状採取 → systematic-debugging（実タッチは実機のみ再現）。

## ユーザー判断の宿題（別タスク・急がない）

`/s` **ページ**の再構成は今も盤面順（`buildArrangeShare`＝`selectedInBoardOrder`）。**共有「画像」は編集どおり**（N-58 の回帰ではない・不変条件は画像に scoped）。/s ページにも編集した配置を載せたいかは要望次第＝載せるなら payload に配置データを足す別タスク。

## 実行順（ロードマップ・s191 更新版）

**N-56 ✅ → N-58段階1 ✅（実機確認済）→ N-58段階2 ✅（実機確認待ち）** → N-57+59 → N-54 → N-53 → CUTOUT → **TOWER（公開前）** → 束C → 束D → 束E（公開）→ 公開後: BULK-IMPORT → 花火: K3 + cyber-space＋プレミアム群

## 絶対に守ること（恒久ルール・継承）

- **スマホ SHARE の撮影は canvas 直描画（`renderCollageCanvasToJpeg`）＝dom-to-image に戻さない**。デスクトップ SHARE は dom-to-image のままバイト同一。
- **ボードのズーム/パンは編集専用で共有画像に影響しない**（撮影は state 由来）。この不変条件を壊さない。
- **編集した位置/サイズ/回転/重なり順はすべて共有画像に反映**（z順=`collageOrder`・回転=レンダラー）。
- デスクトップ >640px は 1px 不変（承認済み新機能の意図された変更を除く）／`rtk` 前置・`--no-verify` 禁止／機微は `docs/private/` へ／**vitest は素の `npx vitest run`**・**playwright も素の `npx playwright test`**（`rtk npx` は誤解析）。
- 新しい操作系は着手前に **superpowers:brainstorming**（勝手に設計しない）。
