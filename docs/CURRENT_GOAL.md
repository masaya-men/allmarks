# 次セッションのゴール (= セッション 132)

## このセッション(131)で完了したこと — テーマシステム Plan 1 本番反映
- **テーマシステムの土台 ＋ paper-atelier の「核の見た目」を実装し `allmarks.app` にデプロイ済み**。
- ブレスト→spec→plan→サブエージェント駆動実装（ワークフロー＋敵対的検証）→全ブランチ opus レビュー→修正→マージ→デプロイ→本番確認、まで完走。
- **見え方**: SETTINGS ドロワーの「THEMES」欄で **Paper Atelier** を選ぶと、盤面が生成り紙＋墨の Fraunces セリフ「AllMarks」＋読みやすい濃色ヘッダーに一斉切替。選択は保存され reload 後も維持（ロード時フラッシュなし）。**default(黒+音波)は完全に無傷**。
- 検証: tsc0 / vitest1704 / e2e3/3 / build OK / 本番スモーク（board に前置スクリプト有・LP汚染なし）。
- spec: [docs/superpowers/specs/2026-06-24-theme-system-paper-atelier-design.md](specs/.. ) ／ plan1: [docs/superpowers/plans/2026-06-24-theme-system-foundation-paper-atelier.md](plans/..)。
- ⏳ **user 宿題**: `allmarks.app` をハードリロード → SETTINGS → THEMES → Paper Atelier に切替えて**実機で見た目を確認＋校正フィードバック**（色味/セリフの重さ等は校正で寄せられる）。

## user 判断（2026-06-24 セッション131末）
- **paper は公開のまま隠さない**（宣伝前・流入少なので、公開しつつ Plan 2 で仕上げる方針）。
- **Plan 2 の到達目標 = 「本当に完璧に忠実に再現」**（user 強調）。モックを実測し、校正グリッドで徹底的に寄せ、各段でスクショを出して承認をもらいながら進める。妥協で核止まりにしない。

## 次にやる（優先順）
1. **Plan 2 = paper-atelier の作り込み（完璧なフル再現）** — まだ核の見た目だけ。残り: カード装飾（マステ/画びょう/クリップ/スタンプ）・**定規/巻尺スクロールメーター**・署名アニメ4種（pinned-card drift / paper parallax / ink underline / soft photo shuffle）・紙テクスチャ素材・MK-1プレート/蝋封シール。**spec §4.4-4.7 が設計の正本＋モック画像 `docs/private/theme-mockups/03-paper-atelier__{board,settings,scrollmeter}.png` を実装前に必ず見る**。`writing-plans` で Plan 2 を起こしてから実装。
   - Plan 2 で拾う細かな指摘（最終レビュー Minor）: Lightbox の暗スクリムを paper 用に淡色化 / picker の a11y(role=group) / §3.4 ロック pill の優しい文言（有料テーマ実装時）。
2. **Plan 3 = 共有のテーマ化** — (A) 共有盤面に実 themeId を載せる（送信は今 DEFAULT 固定＝[BoardRoot.tsx](../components/board/BoardRoot.tsx) 共有ペイロード）＋ SharedBoard を `data-theme-id` に統一。(B) OG サムネ canvas（[capture-mirror.ts](../lib/share/capture-mirror.ts)）をテーマ対応（初版=署名再現→実共有で再判断）。**spec §6 が正本**。`writing-plans` で Plan 3。
3. **テーマ #1 white-sector → #5 celestial-atlas** を同じ器で量産（spec の「7部品契約」を埋めるだけ）。
4. 軽い既存バグ: **(N-04) 一部ツイート本文取れない**（repro `https://x.com/fta7/status/2059754329058488795`、[tweet-meta.ts:137](../lib/embed/tweet-meta.ts#L137)）。

## 土台の要点（次回の実装者＝私へのメモ）
- 各テーマ = `html[data-theme-id="<id>"]` の CSS ブロックで自己完結（配色/`color-scheme`/書体トークン上書き）。**default 不変は `var(--token, 現状値)` フォールバックで担保**。
- **next/font 変数は `<html>` にも乗せてある**（[app/layout.tsx](../app/layout.tsx)）。html-level の paper ブロックが `var(--font-serif-display)` を解決するため必須。
- ロード時フラッシュ対策: themeId を localStorage(`allmarks-theme-id`) にミラー＋ `(app)/layout` のペイント前インラインスクリプトで先付け（**LP には付けない**＝(app) 限定）。真実の場所は IDB(BoardConfig)。
- 解錠は受け口だけ（`isThemeUnlocked`/`EMPTY_LICENSES`）。paper=無料。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII) 必須。応答は日本語。UI変更は事前一言。
- **既知フレーキー**: `tests/lib/channel.test.ts`（full run でたまに落ちる→再実行 green）。
