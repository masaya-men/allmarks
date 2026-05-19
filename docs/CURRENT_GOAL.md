# 次セッションのゴール (= セッション 52)

## ゴール

**user の優先順位次第で 4 候補から選択**:

| 優先度 | task | 工数 |
|---|---|---|
| 🔴 | **B-#22 長文 tweet Lightbox 末尾だけ表示 bug fix + 全文表示 enhancement** (= session 49 user 報告、 session 50 / 51 持ち越し、 私の推奨) | 中〜大 |
| 🟡 | **音波テーマ世界観確立 sprint** (= H + J + K + I-09 + I-10 を 1 集中 sprint で polish) | 大 |
| 🟡 | **multi-playback vision の board card autoplay 着手** (= AllMarks core 差別化、 着手すれば K も連動して必要に) | 大 |
| 🟡 | **I-08 拡張機能 floating ボタン** (= 50 行、 単独完結) | 小 |

session 51 で **B-#23 完遂 + 全 embed 共通 50% 音量デフォルト + ScrollMeter 波形 glitch 拡張 + IDEAS.md K 項永続化** を 1 session 7 deploy で消化。 重い残課題は B-#22 (= 長文 tweet bug) と音波テーマ sprint の 2 つ、 軽い完結タスクは I-08 が残ってる。

## 開始時の動き

1. user に「今日は何やる？」 と聞く、 user の優先順位を聞く
2. user が選択 → 該当 task の方針確認 → 実装着手
3. 拡張機能 / 本体まわりで bug 報告が来てたら最優先で対応

## (B-#22) 長文 tweet Lightbox bug + 全文表示 = 推奨第一候補

user 報告: 「Lightbox を開くと **ツイート末尾部分だけ** が表示される」 (= [https://x.com/yurinel0602/status/2056212099488235790](https://x.com/yurinel0602/status/2056212099488235790) で再現)

切り分け方法案:
- (a) ブックマーレット経由で同じ tweet を保存して比較 (= 同じ bug なら Lightbox 側、 出なければ拡張機能側)
- (b) 拡張機能経由保存の IDB データを直接 dump して description フィールドの実値を見る (= Chrome DevTools → Application → IndexedDB → booklage-db で確認)
- (c) Lightbox で React DevTools の component tree を見て、 react-tweet が何を渡されてるか確認

加えて user 要望: **長文 tweet は Lightbox で全文表示できるべき** (= bug fix と一緒に enhancement 対応)

## 音波テーマ世界観確立 sprint (= 大規模、 集中 polish 用)

session 50 で IDEAS.md J section、 session 51 で K section に詳細設計あり。 集中 sprint で:
- **H section** = TUNE スライダー本体 redesign (= スライダー / ラジオダイヤル / ミキサーつまみ等 5 案から brainstorm で選定)
- **J section** = TUNE 物理ボタン preset (= Yamaha AG03 mixer 風、 3 ボタン or 5 ボタン preset で W/G snap、 LED dot 付き)
- **K section** (= session 51 新規): ボード全体音量ロータリーノブ — オーディオミキサー POT 風 + 円弧 LED 列で現在値が光る + 既存 `defaultVolume` global state に直結。 multi-playback vision と同時 or 直後着手だが、 既存 foundation だけでも単独実装可能
- **I-09** = cursor pill 音波化 + テーマ連動設計 (= session 50 で確立した 3 段 green glow recipe を流用)
- **I-10** = 拡張機能設定ページ刷新 (= AllMarks design language で再構成、 user 要望「オシャレに設定」)

「触って気持ちいい」 「自分の世界を組める」 「音響機材語彙」 を 1 sprint で polish。

## (multi-playback vision) board card autoplay 着手

memory `project_allmarks_vision_multiplayback.md` 参照。 着手すれば K 項 (= ボード全体音量つまみ) が即必要になるので合体着手も可。

## (I-08) 拡張機能 floating ボタン (= 単独完結タスク)

- content.js が全サイトに右端 fixed ボタンを inject、 設定で ON/OFF + 位置 (右上 / 右中 / 右下)
- user 質問「邪魔にならない AllMarks ボタン」 への直接実装
- 50 行程度、 単独で完結する小タスク

## 月末リマインダー (= 2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら 拡張機能の Chrome Web Store submit + 本体 rebrand sprint に進む。

## 引き継ぎ resources

- [docs/TODO.md](docs/TODO.md) — active backlog (= 「現在の状態」 が session 51 narrative)
- [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) — session 51 narrative (= 4 段階 narrative + 教訓)
- [docs/private/IDEAS.md](docs/private/IDEAS.md) — K section (= ボード全体音量つまみ) の永続化、 H / J 既存
- memory `feedback_one_thing_at_a_time.md` (= debug は単一変更 → 検証 cycle)
- memory `feedback_fact_based.md` (= 推測なし、 verify before claim)

## session 51 で確定したこと (= 永続)

- **`defaultVolume` global state foundation 確立**: `lib/embed/default-volume.ts` (= localStorage + React hook + カスタムイベント同期) を真実源として、 SoundCloud / YouTube / Vimeo / Twitter / TikTok Tier 1 すべてに 50% デフォルト + cross-card 同期。 「ボード全体音量つまみ (= K)」 の実装でこの foundation を流用、 multi-playback vision の board card autoplay でも音量制御の真実源として再利用可能
- **iframe `allow` 属性は YouTube 集合をデフォルトに**: cross-origin player API 連携時は `accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share` の 7 属性集合をデフォルトとして使う、 SoundCloud 公式 snippet の `autoplay` 1 つでは encrypted-media が要る場合に「再生押せるけど音出ない」 になる
- **常時動く要素 vs インタラクション瞬間パルス は別物として設計**: ScrollMeter のような常時表示 chrome に sustained noise は視覚疲労源。 同じ noise pattern でも「インタラクション inflection point だけ短時間」 だと演出スパイスになる、 session 51 の 4 段階 tuning でこの区別が明確に
- **glitch / noise 系 effect は iterative tuning が必須**: user の体感言葉 (= うるさい / 落ち着いた / もう少し) を 1 段階の数値変更に翻訳、 一発で当てるのは難しい
