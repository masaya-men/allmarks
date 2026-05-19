# 次セッションのゴール (= セッション 53)

## ゴール

**user の優先順位次第で 4 候補から選択**:

| 優先度 | task | 工数 |
|---|---|---|
| 🟡 | **音波テーマ世界観確立 sprint** (= H + J + K + I-09 + I-10 を 1 集中 sprint で polish) | 大 |
| 🟡 | **multi-playback vision の board card autoplay 着手** (= AllMarks core 差別化、 着手すれば K も連動して必要に) | 大 |
| 🟡 | **(I-08) 拡張機能 floating ボタン** (= 50 行、 単独完結) | 小 |
| 🐛 | **B-#3 重複 URL でサムネ等が出ない問題** (= 古い未解決、 真因未調査) | 中 |

session 52 で **B-#22 完遂 + TextCard 全面 redesign + scroll-aware 全面化 + title backfill 開通** を 5 deploy で消化。 重い残課題は音波テーマ sprint と multi-playback vision の 2 つ、 軽い完結タスクは I-08 が残ってる。

## 開始時の動き

1. user に「今日は何やる？」 と聞く、 user の優先順位を聞く
2. user が選択 → 該当 task の方針確認 → 実装着手
3. 拡張機能 / 本体まわりで bug 報告が来てたら最優先で対応

## 音波テーマ世界観確立 sprint (= 大規模、 集中 polish 用)

session 50 で IDEAS.md J section、 session 51 で K section に詳細設計あり。 集中 sprint で:
- **H section** = TUNE スライダー本体 redesign (= スライダー / ラジオダイヤル / ミキサーつまみ等 5 案から brainstorm で選定)
- **J section** = TUNE 物理ボタン preset (= Yamaha AG03 mixer 風、 3 ボタン or 5 ボタン preset で W/G snap、 LED dot 付き)
- **K section** (= session 51 新規): ボード全体音量ロータリーノブ — オーディオミキサー POT 風 + 円弧 LED 列で現在値が光る + 既存 `defaultVolume` global state に直結。 multi-playback vision と同時 or 直後着手だが、 既存 foundation だけでも単独実装可能
- **I-09** = cursor pill 音波化 + テーマ連動設計 (= session 50 で確立した 3 段 green glow recipe を流用)
- **I-10** = 拡張機能設定ページ刷新 (= AllMarks design language で再構成、 user 要望「オシャレに設定」)

「触って気持ちいい」 「自分の世界を組める」 「音響機材語彙」 を 1 sprint で polish。

session 52 で **TextCard の theme system hook 受け口** が確立した (= デフォルト = 静かなフェード、 将来テーマで底辺グリッチ等を CSS 変数で差し替え可能、 設計案あり)。 この sprint で TextCard の theme 連動も同時に組める。

## (multi-playback vision) board card autoplay 着手

memory `project_allmarks_vision_multiplayback.md` 参照。 着手すれば K 項 (= ボード全体音量つまみ) が即必要になるので合体着手も可。

## (I-08) 拡張機能 floating ボタン (= 単独完結タスク)

- content.js が全サイトに右端 fixed ボタンを inject、 設定で ON/OFF + 位置 (右上 / 右中 / 右下)
- user 質問「邪魔にならない AllMarks ボタン」 への直接実装
- 50 行程度、 単独で完結する小タスク

## (B-#3) 重複 URL でサムネ等が出ない問題

セッション 20 で発生報告、 真因未調査のまま。 同 URL 重複追加時の表示挙動を確認・修正。 古いバグなので individual session で着手すれば良い。

## 月末リマインダー (= 2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら 拡張機能の Chrome Web Store submit + 本体 rebrand sprint に進む。

## 引き継ぎ resources

- [docs/TODO.md](docs/TODO.md) — active backlog (= 「現在の状態」 が session 52 narrative)
- [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) — session 52 narrative (= 5 deploy + 知見 + 教訓 + 永続化候補)
- [docs/private/IDEAS.md](docs/private/IDEAS.md) — H / J / K セクション + 他 idea
- memory `feedback_one_thing_at_a_time.md` (= debug は単一変更 → 検証 cycle)
- memory `feedback_verify_before_claiming.md` (= playwright 等で実測してから報告)

## session 52 で確定したこと (= 永続化、 次セッション以降の前提)

- **TextCard は theme hook 受け口**: 透明 + B-medium 縁グロー + scroll + 底フェードが「デフォルト = 静か」 の規範。 将来のテーマ追加 (= 音波 / ガンプラ / その他) はこの基盤上に CSS 変数で重ねる
- **cleanTitle の 2 分岐構造**: X URL では (1) `さん:「本文」` 形式の OGP boilerplate strip、 (2) `^[name]:\s+` 形式の extension prefix strip、 の 2 段。 false-positive edge case (= meta.text が偶然「Foo: bar」 で始まる) は稀なので v1 受容
- **wheel scroll-chaining パターン**: scroll container を React tree で抱える時、 親 wheel handler (= InteractionLayer / window listener) との衝突を防ぐには「子 scroller が wheel 方向に scroll 余地あり時のみ stopPropagation」 + 親側で「`[data-card-scroll]` 上で defer」 の二段防御が標準
- **tweet-backfill の persistTitle 経路開通**: syndication API の meta.* を IDB に書き戻すパイプラインに title を追加できた。 今後 translation / transcript / 他 meta フィールドを IDB に書きたい時は同じ optional hook パターンで足せる
- **「板 → Lightbox 拡大」 の content 等価性は不可侵**: Lightbox 側で board と違う content を食わせると FLIP morph 中に font / typography が jump する。 Lightbox は board と同じ item.title を source にするのが唯一の正解 — メモリ化候補
