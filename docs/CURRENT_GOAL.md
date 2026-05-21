# 次セッションのゴール (= セッション 63)

## 状況

session 62 で **multi-playback Phase 1 を実装 + 本番 deploy**、 その後 user 指摘を受けて **メディア再生を Lightbox↔ボードで統一**するリファクタまで完遂 (本番反映済)。 board のカード右下アイコンが「押せる再生トグル」 = 押すと音つきでカード内インライン再生、 もう一度で停止。 **対応: YouTube / Vimeo / TikTok / SoundCloud / X(ツイート)動画**。

統一の核 = [embeds/media-players.tsx](../components/board/embeds/media-players.tsx) の `ENTRIES` 台帳が「item → どのプレイヤー」の唯一の真実。 ボードと Lightbox の両方がここから導出。 mp4 動画は mediaSlot 有無で platform 非依存 match なので、 将来 Bluesky 等も新規コードほぼ 0 で網羅できる。

## 最優先タスク: user 本番検証 → OK なら Phase 2

**まず user に本番確認を促す**: `booklage.pages.dev` をハードリロードして —
1. 動画カード (YouTube/Vimeo/TikTok/SoundCloud/**X動画**) にホバー → 右下アイコンが拡大して押せる
2. 押すと音つきでカード内再生 (緑に光る)
3. もう一度押すと止まる
4. 右下の角をつまんでリサイズが効く
5. (確認) Lightbox で各種が今まで通り再生できる

### 本番 OK なら → Phase 2 = Tier 2 ホバープール

設計: [multi-playback-design](./superpowers/specs/2026-05-21-multi-playback-design.md) §3 Tier 2 + §6
- `lib/board/use-playback-pool.ts` (= `usePlaybackPool`、 最大 4 枚 LRU、 pin 退避対象外)
- `lib/board/use-hover-intent.ts` (= `useHoverIntent(300)`、 300ms 留めでミュート再生昇格)
- ホバー 300ms で本物ミュート再生、 離脱 2-3s キープ後 LRU 退避、 5 枚目で最古非ピンが落ちる
- Phase 1 の単体 `audioActiveId` を pool ベースに発展。 Tier 3 (音 ON) = pin

### 本番 NG なら → polish

候補: SoundCloud ♪ アイコンの見え方、 インライン動画の letterbox 余白、 active glow 調整、 など user feedback ベース。

## メディア再生まわりの実装メモ (= 次セッションが触るとき必読)

- **追加・変更は必ず台帳 ([media-players.tsx](../components/board/embeds/media-players.tsx)) 経由**。 個別 component に再生判定を散らさない (= 今回それを潰した)
- ローカル実機検証は **`pnpm preview`** (= `next build && wrangler pages dev out`)。 これで `/api/tweet-video` 等の関数が動く。 `pnpm dev` (next dev) では関数 404 で動画再生不可
- カード投入は `/save?url=<enc>` 経由が schema 正 (bookmark+card 両方作る)
- user 個人ツイート URL は tracked ファイルに書かない (検証スクリプトは Temp のみ)

## このプロジェクトの user 対応で厳守すること

- **AskUserQuestion の質問箱を多用しない**。 探索的な詰めは普通の chat で 1 問ずつ
- **「徹底調査して」 = 推測で答えず実際に web 調査 or 依存調査を回す**
- **勝手に memory を増やさない** (= design 一般論の memory 化は特に避ける)
- 応答は日本語、 横文字カタカナ多用しない
- **既存機能を壊さない**: Lightbox 等の deployed 経路を触る時は依存を先に洗い、 task ごとに全テスト + 実機確認

## Phase 3 以降 (= 参考)

- Phase 3 = Tier 1 ambient モーション (storyboard sprite / Ken Burns / クロスフェード、 デコーダ0)
- Phase 4 = 全体 ON/OFF master スイッチ (音波テーマ、 配置は要相談)

## 月末リマインダー (2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら拡張機能の Chrome Web Store submit + 本体 rebrand sprint。

## 引き継ぎ resources

- [docs/TODO.md](./TODO.md) — active backlog (= session 62 反映済)
- [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) — 「セッション 62 続き」 narrative 集約済
- [docs/superpowers/plans/2026-05-21-board-media-playback-unification.md](./superpowers/plans/2026-05-21-board-media-playback-unification.md) — メディア統一 plan
- [docs/superpowers/specs/2026-05-21-multi-playback-design.md](./superpowers/specs/2026-05-21-multi-playback-design.md) — multi-playback 全体設計 (Phase 2/3/4)
- memory `project_allmarks_vision_multiplayback.md` — multi-playback vision
