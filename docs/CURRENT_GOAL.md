# 次セッションのゴール — N-56 スマホ共有画像を「canvas 直描画」で作る（iOS foreignObject 回避）。計画書あり

## ★最優先タスク: [2026-07-12-n56-mobile-canvas-renderer.md](superpowers/plans/2026-07-12-n56-mobile-canvas-renderer.md) を subagent-driven-development で実装

**この計画書を頭から実装する**（Task 1〜5・モデル指定あり）。土台 `lib/share/capture-mirror.ts`（canvas 直描画・primitives 完成）を流用し、`chosen`＋`collagePositions`＋`band` から直接 canvas に drawImage。**デスクトップは dom-to-image のまま一切触らない**。最後は実機で「写真入り画像が出るか」を確認。

## ★ここまでの道のり（全て本番反映済・s188）

1. **s188 診断可視化＋倍率フォールバック＋真っ白検出**（出荷）。
2. **実機 = iOS OOM タブクラッシュ**（100枚 CREATE でタブごと落ちる）。s188.1 **クラッシュ耐性パンくず**（`capture-breadcrumb.ts`＋`CaptureCrashNotice.tsx`）を出荷 → 実機で `100 cards · canvas 1200×1744 · images 78MP` を取得。
3. **s188.2 画像適応縮小**（`capture-thumbnails.ts`）を出荷 → **クラッシュ解消**（メモリ主犯＝画像埋め込みで正しかった・canvas 経路移行後は撤去予定）。
4. **だが 6枚でも画像が出ない（暗い）**＝**iOS Safari の dom-to-image が foreignObject 内の画像を描けない**制限が確定（枚数非依存・PC Chrome では出る）。→ **canvas 直描画へ移行** = 上の計画書。

## ★実機確認の依頼（計画 Task 5・コピペ）

```
スマホ Safari を閉じて開き直し → allmarks.app → SHARE → SELECT ALL → CREATE
→ プレビューに「写真入りの画像」が出れば成功🎉。見た目（写真/角丸/文字/余白）も教えてください。
```

- **写真が出た** → N-56 完了 → **N-58 段階1** へ。見た目の微調整（パターン背景等）は必要なら次で。
- **出ない** → スクショで症状採取 → systematic-debugging（proxy 取得失敗 / canvas taint / 配置ズレ）。

## ★不変条件（死守）

- **デスクトップ SHARE はバイト同一**（dom-to-image・`handleCreateHostedShare`・`capture-collage.ts` を触らない）。
- 撮影失敗でもリンクは必ず作る／出力 1200×630 cover／画像は同一オリジン proxy 経由（canvas taint 回避）。
- 撮影は実機でしか検証できない（Playwright は canvas を再現しない）＝効果確認は**必ず実機**。

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
