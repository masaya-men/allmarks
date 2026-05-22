# 次セッションのゴール (= セッション 68) — スライドショーの「揃いすぎ」修正 → その後 Phase 2 か タグ付け

## 今のゴール (1 行)

**アンビエント・スライドショーが「たまに揃いすぎる」のを直す**(カードごとにもっとちゃんとずらす)。その後、user 選択で スライドショー Phase 2(X 動画コマ抽出)か タグ付け機能。

## 直前までの状態 (session 67、2026-05-22 本番反映済・user 4K 検証 7 項目全 OK)

- **音量 MAX バグ修正済**: Tier1 ミュート自動再生が X 動画で localStorage 音量を 100 に汚染していた → `TweetVideoEmbed` の `onVolumeChange` に `muted` 除外を追加。user は実値 100 を確認・削除済。
- **アンビエント・スライドショー Phase 1 本番反映済**: 本物再生は常に1本だけ(ミュート・15秒)、他の画面内動画カードは静止画スライドショー、画像/テキストは静止。新規 5 file + `CardsLayer.tsx` 改修。**741 PASS** / tsc clean。
- 設計: [spec](./superpowers/specs/2026-05-22-ambient-frame-slideshow-design.md) / [plan](./superpowers/plans/2026-05-22-ambient-slideshow-phase1.md)。

## session 68 でやること

1. **【最優先・小修正】スライドショーの揃いすぎを直す**:
   - 症状: 複数の動画カードが同じ瞬間にフェードして見える時がある(完全一致もありうる)。user 報告 (session 67)。複数枚画像ツイートの既存 autoCycle も同様の傾向。
   - 対象: [lib/board/use-slideshow-cycle.ts](../lib/board/use-slideshow-cycle.ts)。現状は全カードが index 0 から開始 + 間隔 [2600, 4200) と幅が狭い。
   - 方針案: ①**開始フレーム index をカードごとにランダム化**(全カードが 1 枚目同時表示になるのを防ぐ) ②間隔の幅を広げる(例 2600→6000 等)③必要なら開始オフセットも更に分散。実機で「不揃いの揺らぎ」になるまで調整。
   - 余裕があれば複数枚画像ツイートの autoCycle(別実装、card 側)にも同じ desync を適用するか検討。
2. **その後の大物 (user 選択)**:
   - **スライドショー Phase 2**: X 動画の本物コマ抽出(0/25/50% を canvas + 同一オリジンプロキシで切り出し、in-memory キャッシュ、X カードを 1→3 枚に)。spec の Phase 2 セクション参照。
   - **タグ付け機能**(= user 最優先、memory `project_tagging_top_priority`)。

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード。応答は日本語、横文字カタカナ控える、AskUserQuestion 多用しない。
- deploy 前に tsc + vitest。既知 flake: `tests/lib/channel.test.ts` は並列フルランで稀に落ちる(単体 PASS)。
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"`(日本語 commit message は wrangler が reject)。
- **週使用量が 99% 到達 (session 67 終了時)**。session 68 開始時、使用量に余裕があるか確認してから着手。
- 月末 (2026-05-31): `allmarks.app` ドメイン取得確認(memory `project_allmarks_domain_reminder`)。
- console ノイズの磨き候補(任意): `manifest enctype` 警告 / TUNE ドロワー `aria-hidden` フォーカス警告(`inert` 化)。

## ヒーロー/スライドショーの調整ノブ (実機チューニング用)

- [CardsLayer.tsx](../components/board/CardsLayer.tsx): `HERO_CAP`(=1、本物再生の同時数) / `HERO_PER_CARD_MS`(=15000、1本の再生秒数) / `MIN_ROTATE_MS`。
- [use-slideshow-cycle.ts](../lib/board/use-slideshow-cycle.ts): `MIN_STEP_MS`(=2600) / `MAX_STEP_MS`(=4200)、フェード間隔。
- [CardSlideshow.module.css](../components/board/CardSlideshow.module.css): `transition: opacity 800ms`(フェード速度)。
- [slideshow-frames.ts](../lib/board/slideshow-frames.ts): YouTube のコマ選択(poster/hq1/hq2、hq3 は意図的に不採用)。
