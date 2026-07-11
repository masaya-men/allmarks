# 次セッションのゴール — 実行フェーズ再開: N-56（★★ローンチブロッカー）から

## ★セッションの始め方

1. **s186〜s187 の計画フェーズは完了**（詳細計画書 10 本＋見取り図）。ここからは実行フェーズ。安価モデル（Sonnet 中心・純関数は Haiku）で、計画書どおりに（superpowers:executing-plans または subagent-driven-development）。
2. 先に読む: この文書 → [ロードマップ（正本・s187 で新規5計画を差し込み済み）](superpowers/plans/2026-07-11-s186-remaining-work-roadmap.md) → 当該タスクの計画書。
3. **最優先 = N-56（スマホで共有画像が作られない・iPhone Safari・4枚でも）**: [n56 計画](superpowers/plans/2026-07-11-n56-mobile-share-image-fix.md)（Task 0 の症状回答は記入済み。診断可視化→実機1回→修正）。

## 実行順（ロードマップ §1 の正・s187 更新版）

N-56 → N-58段階1 → N-58段階2 → N-57+59 → N-54 → N-53 → CUTOUT（提案: 束Cと並行）→ **TOWER（ユーザー確定: 公開前）** → 束C → 束D → 束E（公開）→ 公開後: BULK-IMPORT（N-28/N-29 と再審査束）→ 花火: K3 + cyber-space（シェーダーA）＋プレミアム群

## s187 の残り確認事項（実行が近づいたら 1 行ずつ）

- TOWER をローンチ時「無料の看板」にするか（私の推奨=無料。正: `docs/private/2026-07-12-monetization-recheck-s187.md`）
- CUTOUT / BULK-IMPORT の実行時期（上の提案どおりで良いか）

## 絶対に守ること（恒久ルール・継承）

- 撮影は実機でしか検証できない／ボードを変えたら受け取り画面も確認／`fit:'cover'` 固定／`CardsLayer` に `isMobile` 渡さない／デスクトップ 1px 不変（承認済み新機能の意図された変更を除く）／`rtk` 前置・`--no-verify` 禁止／機微は `docs/private/` へ。
- 拡張の一括取り込みは **Task 0（実 DOM 採取）完了まで selector を書かない**（s49 の教訓・計画書に明記済み）。
