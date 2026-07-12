# 次セッションのゴール — N-58 段階1: スマホのコラージュ編集（CREATE を「並べる → 編集 → 作る」に二分割）を計画書どおり実装

## ★N-56 は完了（s189・実機確認済 2026-07-12）

スマホ共有画像の **canvas 直描画**が実機で写真表示を確認（100枚プレビューで写真が出た＝ユーザー確認済）。iOS の dom-to-image foreignObject 制限を回避。本番 `allmarks.app` 反映済。任意の微調整（角丸の per-card 化・パターン背景の再現・ツイート/動画カードの描画・cover-fit のはみ出し方）は**要望が出たら**対応（今は不要）。詳細は [TODO_COMPLETED.md](TODO_COMPLETED.md) s189 と memory `project_mobile_share_canvas_renderer`。

## ★最優先タスク: N-58 段階1 を subagent-driven-development で実装

**計画書 [2026-07-11-n58-mobile-collage-editing.md](superpowers/plans/2026-07-11-n58-mobile-collage-editing.md) を頭から実装する**（各タスク見出しの推奨モデルどおりに割り当て・迷ったら1つ上）。

- **狙い**＝スマホの CREATE を「**ARRANGE で一度止まる → 編集できる → CREATE**」に二分割。今は選ぶ→即撮影で、並びを直せない。
- **調査済みの土台**：`CollageCanvas` は既に編集フル装備＝**新規は「帯ガイド」＋「編集バー」の2部品のみ**。**N-55（スマホで編集ステージが分かりにくい）もスクリムで同時解消**。段階2（ピンチズーム＋パン）は本段階の実機の感触を見てから。
- 検証（rtk tsc / vitest は素の `npx vitest run` / pnpm build / 計画書指定の Playwright）→ デプロイ → TODO/CURRENT_GOAL 更新 → commit/push まで自走。ユーザーに頼るのは「実機確認」「計画書の1行判断」だけ（コピペ形式で）。

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

## 実行順（ロードマップ §1・s189 更新版）

**N-56 ✅完了** → **N-58段階1（次）** → N-58段階2 → N-57+59 → N-54 → N-53 → CUTOUT → **TOWER（公開前）** → 束C → 束D → 束E（公開）→ 公開後: BULK-IMPORT → 花火: K3 + cyber-space（シェーダーA）＋プレミアム群

## 絶対に守ること（恒久ルール・継承）

- 撮影は実機でしか検証できない／ボードを変えたら受け取り画面も確認／`fit:'cover'` 固定／`CardsLayer` に `isMobile` 渡さない／デスクトップ 1px 不変（承認済み新機能の意図された変更を除く）／`rtk` 前置・`--no-verify` 禁止／機微は `docs/private/` へ／**vitest は素の `npx vitest run`**（`rtk npx` は誤解析する）。
- **スマホ SHARE の撮影は canvas 直描画（`renderCollageCanvasToJpeg`）＝dom-to-image に戻さない**。デスクトップ SHARE は dom-to-image のままバイト同一（触らない）。
- 拡張の一括取り込みは **Task 0（実 DOM 採取）完了まで selector を書かない**（s49 の教訓・計画書に明記済み）。
