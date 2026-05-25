# 次セッションのゴール (= セッション 69) — タグ付け機能の brainstorming → 仕様確定 → (時間あれば) 実装着手

## 今のゴール (1 行)

**user 最優先の「タグ付け機能」を brainstorming skill から落ち着いて始める** (memory `project_tagging_top_priority`)。仕様確定までを 1 セッションの目標、実装は次セッションへ送って OK。

## 直前までの状態 (session 68、2026-05-25 本番反映済・user 実機 全 OK)

- **スライドショー揃いすぎ修正**: 動画カード [use-slideshow-cycle.ts](../lib/board/use-slideshow-cycle.ts) と画像ツイート [ImageCard.tsx](../components/board/cards/ImageCard.tsx) の両経路に desync (開始フレームランダム + 間隔バンド拡大 + 初回 offset 分散) を適用。
- **アンビエント・スライドショー Phase 2 完遂**: X 動画カードが poster 1 枚 → **0/25/50% の 3 枚クロスフェード**にリッチ化。新規 [extract-video-frames.ts](../lib/board/extract-video-frames.ts) + [use-tweet-video-frames.ts](../lib/board/use-tweet-video-frames.ts) + [CardSlideshow.tsx](../components/board/CardSlideshow.tsx) 拡張。in-memory キャッシュのみ (IDB 不採用)、並列 1 本上限でカクつき回避。
- **756 PASS** / tsc clean / 本番反映済。アンビエント・スライドショー 全体仕様 [spec](./superpowers/specs/2026-05-22-ambient-frame-slideshow-design.md) は 2 phase 共に完了。

## session 69 でやること

1. **【最優先】タグ付け機能の brainstorming**:
   - 必ず `superpowers:brainstorming` skill を invoke してから始める (memory ガイドあり)。
   - user の意図ヒアリング: 何のためのタグ? (検索/フォルダ分け/共有/視覚演出?)、 タグ命名は手動/AI 提案/両方?、 タグ複数付け OK?、 board 上のどこに見せる?、 既存ブクマへの一括タグ付けはどう?
   - 関連 memory を全て先読み: `project_tagging_top_priority` / `feedback_collaboration_style` (= 平易日本語、board のコード流用検討)、 IDEAS.md の foundation 柱 2 (= manual tag schema、削除フローと連携) も再読。
   - 仕様確定したら `docs/superpowers/specs/2026-05-XX-tagging-design.md` に spec を書く → plan を書く → 余裕あれば実装着手。
2. **(余裕があれば)**:
   - console ノイズ磨き: `manifest enctype` 警告 / TUNE ドロワー `aria-hidden` フォーカス警告 (`inert` 化)。

## 確認事項・運用

- 確認は常に `booklage.pages.dev` をハードリロード。応答は日本語、横文字カタカナ控える、AskUserQuestion 多用しない (memory `feedback_collaboration_style`)。
- deploy 前に tsc + vitest。既知 flake: `tests/lib/channel.test.ts` は並列フルランで稀に落ちる (単体 PASS)。
- deploy 手順: `pnpm build` → `npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="<ASCII>"` (日本語 commit message は wrangler が reject)。
- **使用量に注意**: session 67 終了時 99%。session 68 は短期 4 deploy で大物 2 件消化したが、69 は brainstorming 中心で消費少なめになる見込み。
- 月末 (**2026-05-31**): `allmarks.app` ドメイン取得確認 (memory `project_allmarks_domain_reminder`)。

## Phase 2 関連の調整ノブ (将来の polish 用)

- [lib/board/use-tweet-video-frames.ts](../lib/board/use-tweet-video-frames.ts): `MAX_CONCURRENT`(=1、初回カクつき回避のため)。 抽出が遅すぎると感じたら 2 に戻す候補。
- [lib/board/extract-video-frames.ts](../lib/board/extract-video-frames.ts): `maxWidth`(=640、JPEG 容量と画質のトレードオフ) / `quality`(=0.7) / `fractions`([0, 0.25, 0.5]、75% は意図的に不採用)。
- 永続化したくなったら IDB schema bump (= 不可逆、memory `project_idb_irreversibility` 参照)。

## ヒーロー/スライドショーの調整ノブ (session 67 から継続)

- [CardsLayer.tsx](../components/board/CardsLayer.tsx): `HERO_CAP`(=1、本物再生の同時数) / `HERO_PER_CARD_MS`(=15000、1 本の再生秒数) / `MIN_ROTATE_MS`。
- [use-slideshow-cycle.ts](../lib/board/use-slideshow-cycle.ts): `MIN_STEP_MS`(=2600) / `MAX_STEP_MS`(=6000)、フェード間隔。
- [CardSlideshow.module.css](../components/board/CardSlideshow.module.css): `transition: opacity 800ms`(フェード速度)。
