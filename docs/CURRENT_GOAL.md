# 次セッションのゴール (= セッション 56)

## 状況

session 55 で **2 件 ship 完了**:
- **A 番 fix** (= 画像 + 本文ツイートで Lightbox 右本文復活、 1 関数書き換え)
- **TextCard 統一化** (= 全 TextCard で 16px + 5:4 横長 + scroll に揃える、 2 関数 + テスト書き換え、 -123 行)
- 3 deploy、 604/604 PASS、 user 実機 OK

## 次の選択肢 (= backlog から user 選択)

| 優先度 | task | 工数 |
|---|---|---|
| 🟡 | **10 番 有名サイト pre-set OFF list** (= 拡張 polish、 YouTube / Notion / Slack 等を「外すだけ」 で OFF できる事前リスト) | 小 (~50 行) |
| 🧹 | **TextCard 統一化の dead code 清掃** (= .headline / .index CSS、 pretext import、 `_input` ignored arg、 `TEXT_CARD_MIN_ASPECT` 改名) | 小 (~30 行) |
| 🟡 | **音波テーマ世界観確立 sprint** (= H + J + K + I-09 + I-10) ※ session 54 で I-09 一部消化済 | 大 |
| 🟡 | **multi-playback vision board card autoplay** (= AllMarks core 差別化) | 大 |
| 🐛 | **B-#3 重複 URL でサムネ等が出ない** (= 古めの未解決、 session 54 で重複ピル fix した今が再調査の機会) | 中 |

## session 55 で確定した事 (= 前提として保持)

- **「最小修正」 の探求順序**: 新規 component 提案 → user 仕様確認 → 既存実装 read → 1-2 関数で済むことが多い
- **A 番 fix**: `shouldHideTweetBody` を「全 tweet 非表示」 から「種別判定」 に戻した (= text-only のみ非表示、 media + 本文ありは表示)
- **TextCard 統一化**: pickTitleTypography + measureTextCardLayout が constant 返却、 全カード **16px / lineHeight 24 / aspect 1.25 (5:4 横長) / maxLines 999** に固定。 オーバーフローは TextCard 側 scroll + 底フェードで処理
- **ジャーゴン禁止再徹底**: 「メタ」 「favicon」 等を avoid、 「上のラベル」 「サイトアイコン」 等に置換 (= memory `feedback_jargon_in_japanese.md`)

## 引き継ぎ resources

- [docs/TODO.md](./TODO.md) — active backlog
- [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) — session 55 narrative (= A 番 + 統一化 + 学び)
- [docs/private/IDEAS.md](./private/IDEAS.md) — H / J / K / I-08 / I-09 / I-10 セクション
- [docs/superpowers/specs/2026-05-20-tweet-image-body-split-design.md](./superpowers/specs/2026-05-20-tweet-image-body-split-design.md) — A 番 spec
- [docs/superpowers/specs/2026-05-20-textcard-uniform-design.md](./superpowers/specs/2026-05-20-textcard-uniform-design.md) — TextCard 統一化 spec
- memory `feedback_user_observation_reveals_intent.md` (= user 観察で軌道修正)
- memory `feedback_jargon_in_japanese.md` (= ジャーゴン禁止、 平易な日本語)

## 月末リマインダー (= 2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら 拡張機能の Chrome Web Store submit + 本体 rebrand sprint へ進む。
