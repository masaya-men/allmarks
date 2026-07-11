# 次セッションのゴール — N-56（スマホ共有画像・ローンチブロッカー）を計画書どおりに実行する

## ★セッションの始め方

1. **最初にユーザーへ 3 問**（[N-56 計画](superpowers/plans/2026-07-11-n56-mobile-share-image-fix.md) の Task 0）:
   - 症状はどれ？ (a) プレビューが出ない (b) リンクはできるが OG が既定カード (c) CREATE がエラー
   - 端末（機種 / OS / ブラウザ）
   - 選択枚数（少数でも起きるか）
2. 回答を計画書の Task 0 回答欄に書き、**Task 1 から計画書どおりに実行**（superpowers:subagent-driven-development か executing-plans。Task 1/2/4 は Haiku 可・Task 3/5 は Sonnet）。
3. Task 6 でデプロイ→ユーザー実機→**診断行を読んで対応表から恒久対応を選ぶ**。

## s186 で作ったもの（コード変更なし・計画のみ）

- **正本ロードマップ**: [2026-07-11-s186-remaining-work-roadmap.md](superpowers/plans/2026-07-11-s186-remaining-work-roadmap.md)（全残タスク・セッション割り・モデル割り当て）
- 詳細計画書5本: **N-56**（診断可視化＋倍率フォールバック）／**N-58**（コラージュ編集・段階1＋N-55 吸収）／**N-57+N-59**（背景タイトル＋列数/余白プリセット）／**N-54**（パターン SVG 統一）／**N-53**（e2e 修理・病巣3つ特定済み）
- 発見: **N-45 は完了済みだった**（`ac0b35da`）。N-07 は N-53 に吸収。

## 実行順（ロードマップ確定）

s187 **N-56** → s188 **N-58** → s189 **N-57+N-59** → s190 **N-54** → s191〜 **N-53** → 束C（13言語）→ 束D/E（公開）。
**N-58 の実機最終確認は N-56 修正後**（画像ができないと編集しても写らない）。

## 絶対に守ること（恒久ルール・s186 継承）

- **撮影は実機でしか検証できない**（Playwright 5/5 緑でも実機で壊れた）。実機確認はユーザーに依頼。
- **ボードの見た目を変えたら受け取り画面（`/s/<id>`）も必ず確認。**
- `CardsLayer` に `isMobile` を渡さない（スクロール解放は `lockCardScroll`）。タップ選択は Playwright 駆動不可＝`SELECT ALL` 経由。
- **`fit:'cover'` を `'contain'` に戻さない**（黒帯検出テストが守る）。
- デスクトップ（>640px）は 1px も変えない。`pnpm build`（`rtk next build` 不可）→ `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`。
- `rtk` 前置・`--no-verify` 絶対禁止・目視確認はユーザーに振る。
