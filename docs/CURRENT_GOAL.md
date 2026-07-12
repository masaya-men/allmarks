# 次セッションのゴール — N-56 実機確認: canvas 直描画のスマホ共有画像で「写真が出るか」を1回読む（出れば N-56 完了 → N-58 段階1）

## ★このセッションでやったこと（s189・全て本番反映済 `allmarks.app` deploy `9c40a6a2`）

計画書 [2026-07-12-n56-mobile-canvas-renderer.md](superpowers/plans/2026-07-12-n56-mobile-canvas-renderer.md) を subagent-driven-development で完遂。**スマホの共有画像を dom-to-image（iOS が foreignObject 内の画像を描けない）から canvas 直描画へ全面移行**。

- Task1 `capture-mirror.ts` primitives を export／Task2 `coverRect`+`mapBandToOutput` 純関数（TDD）／Task3 `renderCollageCanvasToJpeg`（配置データから直接 canvas 描画・never-throw・1枚ずつロード・cover-fit・proxy 経由・placeholder）／Task4 `BoardRoot handleMobileCreateShare` を配線。
- 検証: tsc0 / **vitest 2291/2291** / build OK / **opus 全ブランチレビュー Ready to merge・Critical/Important ゼロ**。**デスクトップ SHARE はバイト同一**（無改変）。

## ★実機確認の依頼（ユーザーへ・コピペ）

```
スマホ Safari を完全に閉じて開き直し → allmarks.app → SHARE → SELECT ALL → CREATE
→ プレビューに「写真入りの画像」が出れば成功🎉。
出た画像の見た目（写真/角丸/文字/余白）も教えてください。
少数（6枚）と多数（100枚 SELECT ALL）の両方だと理想です。
```

- **写真が出た** → **N-56 完了** → **N-58 段階1**（CREATE を「ARRANGE で止まる→編集→CREATE」に二分割）へ。見た目の微調整（パターン背景の再現・余白・文字サイズ）は必要なら次で。
- **出ない** → スクショで症状採取 → systematic-debugging で切り分け（proxy 取得失敗 / canvas taint / 配置ズレ / **SVG placeholder が iOS Safari で空描画**＝ただし写真カードは raster proxy なので無関係のはず）。

## ★不変条件（死守・継承）

- **デスクトップ SHARE はバイト同一**（`handleCreateHostedShare`・`capture-collage.ts`・dom-to-image 経路を触らない）。
- 撮影失敗でもリンクは必ず作る／出力 1200×630 cover／画像は同一オリジン proxy 経由（canvas taint 回避）。
- 撮影は**実機でしか検証できない**（Playwright は canvas を再現しない）＝効果確認は必ず実機。

## ★毎セッション共通のキックオフ（ユーザーはこれを貼るだけ・実行フェーズは Sonnet 中心で開始）

```
セッション開始。docs/CURRENT_GOAL.md → docs/superpowers/plans/2026-07-11-s186-remaining-work-roadmap.md
の順に読み、実行順の先頭にある未完了タスクを、その詳細計画書どおりに実行して。
- superpowers:subagent-driven-development で、計画書の各タスク見出しの推奨モデル
  （【Haiku 可】【Sonnet 推奨】）どおりにサブエージェントへ割り当てること。迷ったら1つ上。
- 検証（rtk tsc / vitest は素の npx vitest run / pnpm build / 計画書指定の Playwright）→ デプロイ →
  TODO.md・CURRENT_GOAL.md の更新 → commit/push まで自走する。
- 私（ユーザー）に頼るのは「実機確認」「計画書に書かれた1行判断」だけ。依頼はコピペ形式で。
```

## 実行順（ロードマップ §1・s187 更新版）

N-56（★s189 canvas 直描画・**実機で写真確認待ち**）→ N-58段階1 → N-58段階2 → N-57+59 → N-54 → N-53 → CUTOUT → **TOWER（公開前）** → 束C → 束D → 束E（公開）→ 公開後: BULK-IMPORT → 花火: K3 + cyber-space（シェーダーA）＋プレミアム群

## 絶対に守ること（恒久ルール・継承）

- 撮影は実機でしか検証できない／ボードを変えたら受け取り画面も確認／`fit:'cover'` 固定／`CardsLayer` に `isMobile` 渡さない／デスクトップ 1px 不変（承認済み新機能の意図された変更を除く）／`rtk` 前置・`--no-verify` 禁止／機微は `docs/private/` へ／**vitest は素の `npx vitest run`**（`rtk npx` は誤解析する）。
- 拡張の一括取り込みは **Task 0（実 DOM 採取）完了まで selector を書かない**（s49 の教訓・計画書に明記済み）。
