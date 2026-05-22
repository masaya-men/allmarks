# 次セッションのゴール (= セッション 67) — デフォルト音量バグの調査・修正

## 今のゴール (1 行)

**デフォルト音量が MAX(100) に戻ってしまうバグを直す**（コード既定は 50 なのに実機で 100 で鳴る）。その後はタグ付け機能。

## 直前までの状態 (session 66、2026-05-22 本番反映済)

- **回転スポットライト再生**を実装・本番反映。大量同時再生の 4K カクつきは **合成(fill-rate)律速** と判明（デコードでなく、画面の物理ピクセル面積で決まる）。
- 同時再生を **カード面積で予算配分**（DENSE≈3 / DEFAULT≈2 / OPEN・AMBIENT≈1）、1枚~9秒でランダム交代、cap を絶対超えない。
- 解像度下げ撤去（フル解像度）/ 可視率30%未満は対象外 / 短尺ループ / MOTION間隔均等 / **ライトボックス中はボード動画停止**。
- YouTube ⏸ マークは消す手段なし（cross-origin）→ user 合意で諦め、最初から表示。
- **728 PASS** / tsc clean / 実機検証済。詳細 memory `project_4k_composite_bound_playback`。

## session 67 でやること

1. **デフォルト音量 MAX バグ調査・修正**（最優先）:
   - 該当: [lib/embed/default-volume.ts](../lib/embed/default-volume.ts)（既定 `DEFAULT_PLAYER_VOLUME = 50`、localStorage キー `allmarks.player.defaultVolume`）。
   - **まず実機で localStorage の実値を確認**（DevTools → Application → Local Storage）。100 が保存されていれば原因①（書き戻し or 過去値）。
   - **重要**: Chrome の「キャッシュ削除」「SW 削除」では localStorage は消えない。サイトデータ削除が必要 → これが「クリアしても直らない」理由。
   - 原因候補: ②[TweetVideoEmbed](../components/board/embeds/TweetVideoEmbed.tsx) `handleVolumeChange` がプレーヤー初期報告の 1.0 を書き戻して 100 を保存する競合 / ③YouTube/Vimeo の setVolume(50) postMessage がプレーヤー ready 前に消えてプラットフォーム既定 100 で鳴る。
   - 修正方針案: 初期 volumechange の書き戻し抑止 / setVolume を onReady 後に確実適用 / 起動時に保存値が範囲外や未設定なら 50 を明示再書き込み。
2. その後の大物: **タグ付け機能**（memory `project_tagging_top_priority`）。

## 確認事項・運用

- AskUserQuestion 多用しない、1問ずつ普通の chat。応答は日本語、横文字カタカナ控える。
- preview: `npx -y wrangler@latest pages dev out --port 8788 --ip 127.0.0.1`（startup が不安定、起動は1コマンド内でテストまで実行すると安定）。navigation は `domcontentloaded`。
- deploy 前に tsc + vitest。既知 flake: `tests/lib/channel.test.ts` は並列フルランで稀に落ちる（単体 PASS）。
- 月末 (2026-05-31): `allmarks.app` ドメイン取得確認。

## スポットライトの調整ノブ (実機チューニング用)

[CardsLayer.tsx](../components/board/CardsLayer.tsx): `LIVE_AREA_BUDGET`(同時枚数の予算) / `PER_CARD_MS`(=9000、1枚の再生秒数) / `MIN_ROTATE_MS` / `MIN_VISIBLE_RATIO`(=0.3) / `MAX_LIVE`。
