# 次セッションのゴール (= セッション 54)

## ゴール

**user による (I-08) round 2 再検証 → 残課題 selection → 次 sprint 着手**

### 開始時の動き

1. user に「(I-08) フローティングボタン round 2 (= 重複 gentle / AllMarks 削除追従) は実機 OK だった？」 確認
2. PiP 内 card 削除追従も確認 (= 既存 `setItems` 経路で動く前提、 NG なら fix)
3. 問題なければ次 task を user と合意

### 残候補 (= 優先順位は user 判断)

| 優先度 | task | 工数 | 注 |
|---|---|---|---|
| 🐛 | **A 番 X 長文 tweet + 画像 で画像のみ表示 bug**: split layout 仕様 (= 画像左 / 文字右) で fix | 中 | session 52 系本体 board task、 user 仕様希望 |
| 🟡 | **10 番 有名サイト pre-set OFF list**: YouTube / Notion / Slack 等を「外すだけ」 で OFF できる事前リスト | 小 (~50 行) | 拡張機能 polish、 単独 sprint |
| 🟡 | **音波テーマ世界観確立 sprint** (= H + J + K + I-09 + I-10) | 大 | session 50 以降の積み残し、 「触って気持ちいい」 polish 集中投下 |
| 🟡 | **multi-playback vision board card autoplay** | 大 | AllMarks 差別化 core、 K (= ボード全体音量つまみ) と連動 |
| 🐛 | **B-#3 重複 URL でサムネ等が出ない問題** | 中 | 古い未解決、 ただし session 53 で重複は弾く方針確定 → 「サムネ出ない」 のは別 bug、 個別調査 |

session 53 で **重複弾く + 「Already saved」 優しい feedback** が確定したので B-#3 は性質が変わった (= 重複自体は今や起きないが、 もし発生時の visual)。

## session 53 で確定したこと (= 永続化、 次セッション以降の前提)

- **AllMarks visual identity = 黒 A モチーフ + 緑チェック (`#28F100`) + 3 段 green glow halo**。 既存 cursor pill と完全同一の visual language、 「成功緑 / spinner 白 / エラー赤」 の trio 完成
- **重複保存は全経路で弾く + 「Already saved」 で優しく feedback**。 user 原則「エラーみたいに絶対しない」
- **本体 ↔ 拡張 双方向同期パターン確立**: 保存 = chrome.storage.local mirror + storage.onChanged、 削除 = postMessage 発火 + content.js receive。 今後の同期需要 (= tag schema 変更、 共有 URL 同期等) も同じ pattern
- **業界 Web Clipper の苦情 3 パターン全部回避済**: (a) 動画上で消えない = fullscreenchange listener、 (b) 死ぬ = isExtensionAlive 防御、 (c) 邪魔位置で固まる = snap-to-edge 方式

## 引き継ぎ resources

- [docs/TODO.md](./TODO.md) — active backlog (= 「現在の状態」 は session 53 narrative)
- [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) — session 53 narrative (= ship 内容 + 残課題 + 教訓)
- [docs/specs/2026-05-19-floating-button-design.md](./specs/2026-05-19-floating-button-design.md) — フローティングボタン仕様書
- [docs/private/IDEAS.md](./private/IDEAS.md) — H / J / K / I-08 / I-09 / I-10 セクション
- memory `feedback_verify_before_claiming.md` (= playwright 等で実測してから報告)
- memory `feedback_one_thing_at_a_time.md` (= debug は単一変更 → 検証 cycle)

## 月末リマインダー (= 2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら 拡張機能の Chrome Web Store submit + 本体 rebrand sprint に進む。
