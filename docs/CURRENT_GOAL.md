# 次セッションのゴール (= セッション 65) — Phase 2 本番検証 → Phase 3 か タグ付けを選択

## 今のゴール (1 行)

session 64 で ship した **Tier 2 ホバー再生を user が本番で確認**し、OK なら次の大物 (Phase 3 = Tier 1 常時モーション、 または タグ付け) に進む。

## 直前までの状態 (session 64 終了時点)

- **multi-playback Phase 2 (Tier 2 ホバー再生) = 完遂・本番反映済**。 board のカードに 300ms マウスを留めるとミュートで本物再生に昇格、 外すと約 0.8 秒後に停止。 同時最大 3 枚 (LRU)、 昇格 0.1 秒で緑 glow。 音つき Tier 3 (アイコン押し) と別レイヤーで共存。
- 新規 file: [playback-pool.ts](../lib/board/playback-pool.ts) (純粋ロジック) / [use-playback-pool.ts](../lib/board/use-playback-pool.ts) / [use-hover-intent.ts](../lib/board/use-hover-intent.ts)。 muted を [media-players.tsx](../components/board/embeds/media-players.tsx) registry + 全 embed + [CardsLayer.tsx](../components/board/CardsLayer.tsx) に開通。
- **699 PASS / tsc clean / `booklage.pages.dev` 反映済**。
- spec: [multi-playback-design](./superpowers/specs/2026-05-21-multi-playback-design.md) §3 (Tier 2「Phase 2 実装確定」注記)。 plan: [multi-playback-phase2-hover](./superpowers/plans/2026-05-21-multi-playback-phase2-hover.md)。

## セッション開始時にやること

1. **user に本番検証を依頼**: `booklage.pages.dev` をハードリロード → 動画カード (YouTube / X動画 / Vimeo 等) にマウスを乗せたまま少し待つ → 音なしで再生が始まるか。 外すと止まるか。 右下アイコン押しの音つき再生 (Tier 3) と両立するか。
2. **OK なら次の大物を user と選択**:
   - **Phase 3 = Tier 1 常時 ambient モーション**: 画面内の全カードが軽く動いて見える層 (= ストーリーボード / Ken Burns / クロスフェード、 デコーダ 0 の軽量演出)。 spec §3 Tier 1。 「ボードが常に生きてる」 を完成させる
   - **タグ付け機能**: user 最優先発言 (memory `project_tagging_top_priority`)。 multi-playback がひと段落したので着手の好機
3. NG / 違和感あれば polish (= glow の色味・強さ、 余韻 0.8 秒の長さ、 300ms の感度などは実機で微調整可能)

## Phase 2 で残した小さな点 (任意)

- 緑 glow の色・強さは success-green 仮値 (`rgba(74,222,128,...)`)。 user が実機で見て調整希望あれば CardsLayer の boxShadow を変える
- Tier 2 のミュート再生中、 SoundCloud / TikTok iframe フォールバックは外部制御不可 (= 既知の限界、 Tier 3 と同じ)

## このプロジェクトの user 対応で厳守すること

- AskUserQuestion の質問箱を多用しない。 普通の chat で 1 問ずつ
- 応答は日本語、 横文字カタカナ多用しない
- 既存機能を壊さない: 触る前に依存を洗い、 task ごとに全テスト + preview 実機確認。 commit はこまめに、 deploy 前に tsc + vitest
- ドキュメント更新 (TODO / CURRENT_GOAL / TODO_COMPLETED) を commit と同じ区切りで必ず行う
- **preview の注意**: ローカル wrangler が古く compatibility date でコケるので `npx -y wrangler@latest pages dev out --port 8788 --ip 127.0.0.1` を使う (session 64 の教訓)

## backlog (この後)

- multi-playback Phase 4 = master ON/OFF スイッチ (= 全 Tier 停止の「静かな鑑賞モード」)
- 月末 (2026-05-31): `allmarks.app` ドメイン取得確認
