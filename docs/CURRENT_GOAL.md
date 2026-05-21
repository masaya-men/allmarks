# 次セッションのゴール (= セッション 63)

## 状況

session 62 で **multi-playback Phase 1 を実装完遂 + 本番 deploy**。 board のカード右下アイコンが「押せる再生トグル」 になり、 押すと音つきでカード内インライン再生 (= Tier 3 単体 1 枚)、 もう一度で停止。 リサイズ干渉も解決 (= 右下角つまみは引き続き効く)。 playwright で全動作 + リサイズ死守を実機確認済。

## 最優先タスク: user 本番検証 → OK なら Phase 2

**まず user に本番確認を促す**: `booklage.pages.dev` をハードリロードして —
1. 動画カードにホバー → 右下アイコンが拡大して押せる
2. 押すと音つきでカード内再生 (= 緑に光る)
3. もう一度押すと止まる
4. 右下の角をつまんでリサイズが効く

(注: 検証で使った YouTube デモ動画は埋め込み再生禁止で「再生できません」 になる個体だったが、 仕組みは正常。 user の実ブクマで確認してもらう)

### 本番 OK なら → Phase 2 = Tier 2 ホバープール

設計: [multi-playback-design](./superpowers/specs/2026-05-21-multi-playback-design.md) §3 Tier 2 + §6
- `lib/board/use-playback-pool.ts` (= `usePlaybackPool`、 最大 4 枚 LRU、 pin 退避対象外、 promote/demote/pin/unpin/isActive)
- `lib/board/use-hover-intent.ts` (= `useHoverIntent(300)`、 onPointerEnter で 300ms タイマー → onIntent でミュート再生昇格)
- ホバー 300ms で本物ミュート再生、 離脱 2-3s キープ後 LRU 退避、 5 枚目で最古非ピンが落ちる
- Phase 1 の単体 `audioActiveId` を pool ベースに発展させる (= pin = Tier 3 音 ON)

### 本番 NG (= 直したい点あり) なら → Phase 1 polish

候補: SoundCloud カードに ♪ 音楽アイコン (= 今は photo アイコン)、 インラインプレイヤーの letterbox 余白調整、 active glow の見え方調整 など user feedback ベースで。

## このプロジェクトの user 対応で厳守すること

- **AskUserQuestion の質問箱を多用しない**。 探索的な詰めは普通の chat で 1 問ずつ
- **「徹底調査して」 = 推測で答えず実際に web 調査エージェントを回す**
- **勝手に memory を増やさない** (= design 一般論の memory 化は特に避ける)
- 応答は日本語、 横文字カタカナ多用しない

## Phase 3 以降 (= 参考)

- Phase 3 = Tier 1 ambient モーション (= storyboard sprite / Ken Burns / クロスフェード、 デコーダ0)
- Phase 4 = 全体 ON/OFF master スイッチ (音波テーマ、 配置は要相談)

## 月末リマインダー (2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら拡張機能の Chrome Web Store submit + 本体 rebrand sprint。 Developer Account は既存。

## 引き継ぎ resources

- [docs/TODO.md](./TODO.md) — active backlog (= session 62 反映済)
- [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) — session 62 narrative 集約済
- [docs/superpowers/specs/2026-05-21-multi-playback-design.md](./superpowers/specs/2026-05-21-multi-playback-design.md) — multi-playback 全体設計 (Phase 2/3/4)
- memory `project_allmarks_vision_multiplayback.md` — multi-playback vision
