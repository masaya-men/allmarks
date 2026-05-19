# 次セッションのゴール (= セッション 55)

## 状況

session 54 で **拡張機能 + PiP まわり完全 close**:
- B 番重複弾き → 実は session 53 から動いてた (= 真因は視覚差別化不足) → ⚠ アンバー + RGB glitch redesign
- PiP サムネ削除追従 → BroadcastChannel に bookmark-deleted 追加 + PipStack 再センター
- 追加 2 bug fix (= site .js 設定 OFF 時 pill ぐるぐる、 PiP open + auto-save で pill 無限)
- manifest 0.1.6、 7 deploy、 608/608 PASS

## 次の選択肢 (= backlog から user 選択)

| 優先度 | task | 工数 |
|---|---|---|
| 🐛 | **A 番 X 長文 tweet + 画像** で画像のみ表示 bug → split layout (= 画像左 / 文字右) 仕様で fix | 中 |
| 🟡 | **10 番 有名サイト pre-set OFF list** (= YouTube / Notion / Slack 等を「外すだけ」 で OFF できる事前リスト、 拡張 polish) | 小 (~50 行) |
| 🟡 | **音波テーマ世界観確立 sprint** (= H + J + K + I-09 + I-10) ※ session 54 で I-09 一部消化済 (= cursor pill に RGB glitch + ⚠ を入れた) | 大 |
| 🟡 | **multi-playback vision board card autoplay** (= AllMarks core 差別化) | 大 |
| 🐛 | **B-#3 重複 URL でサムネ等が出ない** (= 古めの未解決、 session 54 で重複ピル fix した今が再調査の機会) | 中 |

## session 54 で確定した事 (= 前提として保持)

- **AllMarks pill 3 段意味体系**: ✓ 緑 (= 新規 saved) / ⚠ アンバー (= 重複) / ! 赤 (= error)
- **RGB chromatic aberration glitch** が AllMarks text feedback の共通言語 (= ChromeButton hover / pill state も同じ)
- **5 site .js に設定キャッシュ + storage.onChanged** が拡張サイト追加時の標準パターン
- **BroadcastChannel に bookmark-deleted** が削除同期パイプ (= 将来 tags / title 変更等も同じ pipe で足せる)
- **「片方が知らない context で分岐するな」 教訓**: 同じ feedback channel に 2 つ経路ある時は無条件統一化

## 引き継ぎ resources

- [docs/TODO.md](./TODO.md) — active backlog
- [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) — session 54 narrative
- [docs/private/IDEAS.md](./private/IDEAS.md) — H / J / K / I-08 / I-09 / I-10 セクション
- memory `feedback_verify_before_claiming.md` (= playwright 等で実測してから報告)
- memory `feedback_one_thing_at_a_time.md` (= debug は単一変更 → 検証 cycle)
- memory `reference_extension_main_sync_pattern.md` (= 双方向同期パターン)

## 月末リマインダー (= 2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら 拡張機能の Chrome Web Store submit + 本体 rebrand sprint へ進む。
