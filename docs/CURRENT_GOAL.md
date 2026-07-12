# 次セッションのゴール — N-56 の実機診断行を1回読む → 真因確定 → 恒久対応 or 次のロードマップ項目へ

## ★まずユーザーに実機を1回頼む（コピペで渡す）

s188 で N-56 の「診断可視化＋倍率フォールバック＋真っ白検出」を本番反映済み（`allmarks.app`）。次にやるのは**実機で診断行を1回読むこと**だけ。ユーザーにこの手順を渡す:

```
スマホ（iPhone / Safari）で https://allmarks.app をハードリロード（再読み込み）してから:
1. 下の SHARE → SELECT ALL → CREATE
2. 結果シートを見て、次のどれか教えてください:
   (A) プレビュー画像が出た（黄色い注意枠なし）→ 直っています🎉
   (B) プレビューは出たが、下に小さい灰色の英数字の行がある → その行をコピペかスクショで
   (C) 「NO IMAGE — LINK ONLY」の黄色い枠が出た → 中の小さい英数字の行を
   (D) 「COULDN'T CREATE THE LINK」が出た → 下の英数字の行を
```

## ★診断行 → 真因 → 恒久対応（1つ選んで別セッションで実装）

計画書 [n56](superpowers/plans/2026-07-11-n56-mobile-share-image-fix.md) Task 6 §対応表が正。要点:

- **(A) or (B) `#1 x3.08 … → #2 x1 ok`** ＝ 倍率3.08の canvas が実機で死ぬが**フォールバックで既に救えている**（画像は出る）。恒久 = **F1**: `fallbackScales` を `[2,1]` に（中間画質確保）＋将来「帯だけ撮る」最適化（canvas 面積 1/4）。実は (A) なら N-56 は実質解決 → **N-58 段階1（スマホでコラージュ編集）へ進む**。
- **(C) `blank`** ＝ iOS の foreignObject 空振り（真っ白）。恒久 = **F4**: ユーザーと相談（canvas 直描画のモバイル専用レンダラー＝大工事 か、正直に「この端末は画像なし」のまま か）。
- **両方 `timeout`** ＝ **F2**: `timeoutMs` を 30000 に＋arrange 進入時に proxy URL 先読みで CF edge を温める。
- **`render SecurityError`** ＝ **F3**: proxy 対象漏れ（srcset/CSS 背景）を特定。**ここで診断行の URL 切り詰めも同時に**（opus レビュー Minor #2）。

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

N-56（★s188 診断出荷済・実機読み待ち）→ N-58段階1 → N-58段階2 → N-57+59 → N-54 → N-53 → CUTOUT → **TOWER（公開前）** → 束C → 束D → 束E（公開）→ 公開後: BULK-IMPORT → 花火: K3 + cyber-space（シェーダーA）＋プレミアム群

## 絶対に守ること（恒久ルール・継承）

- 撮影は実機でしか検証できない／ボードを変えたら受け取り画面も確認／`fit:'cover'` 固定／`CardsLayer` に `isMobile` 渡さない／デスクトップ 1px 不変（承認済み新機能の意図された変更を除く）／`rtk` 前置・`--no-verify` 禁止／機微は `docs/private/` へ／**vitest は素の `npx vitest run`**（`rtk npx` は誤解析する）。
- 拡張の一括取り込みは **Task 0（実 DOM 採取）完了まで selector を書かない**（s49 の教訓・計画書に明記済み）。
