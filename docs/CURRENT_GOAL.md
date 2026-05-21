# 次セッションのゴール — Tier 1 画面内自動再生 本番確認 → N 調整 → 次はタグ付け

## 今のゴール (1 行)

session 65 で ship した **Tier 1 (画面内動画の音なし自動再生) + MOTION マスタースイッチ**を user が本番で確認し、同時再生数 N を実機で詰める。OK なら次の大物 = **タグ付け**へ。

## 直前までの状態 (session 65、2026-05-21〜22)

- **Tier 1 = 画面内に見えている動画 (YouTube / Vimeo / ツイート動画) を音なしで自動再生**。最も見えている順に**上限 N=4 枚**だけ実再生 (viewport 駆動の debounce プール)、スクロールで追従。**複数画像カードは 2.2 秒ごとに瞬間切替 (hard cut) で巡回**。単一画像・テキストは静止。
- **MOTION マスタースイッチ**を右上 2 段ヘッダーに常設 (上段 `MOTION ● + AllMarks·件数`、下段 `TUNE / POP OUT / SHARE`、左上は空、立体ドーム LED、ChromeButton 流用)。OFF で全停止＝静かな鑑賞モード。状態は IndexedDB に永続化、reduced-motion は既定 OFF。
- **再生できない動画 (埋め込み禁止 YouTube 等) はサムネに静かに戻る** (エラー文・CTA を一切出さない)。TikTok と SoundCloud は自動再生対象外 (TikTok は埋め込み自動再生不安定＋CTA、SoundCloud は音楽でミュートだと無動)。**手で押す Tier 3 (音つき) は全種そのまま**。
- 検証: ローカル preview で「ON で 4 枚オーバーレイ mount / OFF で 0 / 埋め込み禁止 YouTube はサムネに戻り『動画を再生できません』0 件」を実測。**716 テスト / tsc clean / 本番反映済 (`booklage.pages.dev`)**。
- spec: [tier1-viewport-playback-design](./superpowers/specs/2026-05-21-tier1-viewport-playback-design.md)。plan: [tier1-viewport-playback](./superpowers/plans/2026-05-21-tier1-viewport-playback.md)。

## セッション開始時にやること

1. **user に本番確認を依頼**: `booklage.pages.dev` ハードリロード → 実際のボードで動画カードが音なしで動くか / スクロールで再生が追従するか / MOTION OFF で全部止まるか / 再生できない動画がサムネに戻る (エラー文出ない) か。
2. **同時再生数 N (TIER1_CAP) を一緒に調整**: 今 `4` ([CardsLayer.tsx](../components/board/CardsLayer.tsx) の `TIER1_CAP`)。user の実機で 60fps を見ながら、カクついたら 3、余裕＆もっと動かしたいなら 5〜6。動画が多いボードで要計測。
3. 巡回間隔 (複数画像 2.2 秒) / ホバー中の巡回競合など、気になれば微調整 ([ImageCard.tsx](../components/board/cards/ImageCard.tsx) の `cycleMs`)。
4. OK なら次の大物 = **タグ付け機能** (memory `project_tagging_top_priority`)。multi-playback (Tier1+Tier3+MOTION) がひと段落したので着手の好機。

## このプロジェクトの user 対応で厳守すること

- AskUserQuestion の質問箱を多用しない。普通の chat で 1 問ずつ
- 応答は日本語、横文字カタカナ多用しない
- 既存機能を壊さない: 触る前に依存を洗い、task ごとに全テスト + preview 実機確認。commit はこまめに、deploy 前に tsc + vitest
- ドキュメント更新を commit と同じ区切りで必ず行う
- preview: `npx -y wrangler@latest pages dev out --port 8788 --ip 127.0.0.1`、navigation は `waitUntil: 'domcontentloaded'` (自動再生で networkidle が来ない)
- 既知 flake: `tests/lib/channel.test.ts` は並列フルランで稀に落ちる。単体では PASS

## backlog (この後)

- **タグ付け機能** (= 次の大物、user 最優先)
- Tier 1 ホバー中の複数画像巡回の競合 (= ホバー scrub と interval が競合、気になれば hover 中 pause)
- 月末 (2026-05-31): `allmarks.app` ドメイン取得確認
