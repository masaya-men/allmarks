# 次セッションのゴール (= セッション 60)

## 状況

session 59 で **拡張機能を 0.1.7 → 0.1.14 と 7 回 ship**、 全 user 検証 OK で締め:

- **v0.1.8**: 構造的修正 3 件 + 全サイト防御層 = floating-button inline↔source 再同期 + ミラー防御層 5 サイト + YouTube 一覧 ︙ メニュー対応
- **v0.1.9**: 黄ピル復活 (全サイト) + SPA navigation で mirror 再チェック (= 動画/tweet 直開きで即緑表示)
- **v0.1.10**: X SPA 検知の保険として 500ms 定期チェック追加 (= 競合 Toby と同方式)
- **v0.1.11**: YouTube セレクタに `ytd-menu-service-item-renderer` + `[role="menuitem"]` 追加 + 検出失敗時 DOM 診断ログ
- **v0.1.12**: 診断ログ表示レベルを `console.debug` → `console.log` (= user の console で見える化) + 「auto-save fired」 ログ追加
- **v0.1.13**: Like 検出にテキストガード追加 (= `<like-button-view-model>` が Watch later option ラップするケース対応)
- **v0.1.14**: セレクタから `[class*="ytListItemViewModel"]` 削除 (= 内側 span にマッチしないように、 真因 outerHTML から特定)

user 最終確認: Twitter ブクマ + YouTube 高評価 + 後で見る (C4wfr7XxYBk) で全て動作 ✓

## ⚠️ 次セッション開始時にすぐ取り掛かるべきタスク

### 最優先: オンボーディング案内画面の draft

user 提案: 「YouTube 高評価は精度高い、 後で見るは仕様限界、 フローティング/右クリック/ショートカット使ってください」 と最初から user に正直に案内したい。

memory `project_onboarding_stance.md` に方針確定済 (= 高精度 / ベストエフォート / 100% の 3 段階ラベル)。

next session でやる作業:
1. **どこに案内を出すか決定**: 拡張機能 popup の最初の画面? 本体 LP の「拡張機能の使い方」 セクション? それともインストール直後の welcome page を新設?
2. **draft 文章作成**: 上の 3 段階ラベル + 4 つの 100% 経路の解説 (日英 2 言語)
3. **実装**: HTML / Markdown / 拡張機能の welcome page (= manifest の chrome_url_overrides or 別途 newtab 画面)

### その他の元 backlog (= ドメイン待ちタスクと並列で選択可)

| 優先度 | task | 工数 |
|---|---|---|
| 🔧 | **deploy 数取得 script setup** (= CF API token 発行 ~3 分 + .env.local 追記) | 小 |
| 🟢 | **dead UI cursorPillFallbackPosition の削除 or 実装** | 小 |
| 🟡 | **10 番 有名サイト pre-set OFF list** (= 拡張 polish、 ~50 行) | 小 |
| 🟡 | **音波テーマ世界観確立 sprint** (H + J + K + I-09 + I-10) | 大 |
| 🟡 | **multi-playback vision board card autoplay** (AllMarks core 差別化) | 大 |
| 🐛 | **B-#3 重複 URL でサムネ等が出ない** (古めの未解決) | 中 |

## 月末リマインダー (2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら拡張機能の Chrome Web Store submit + 本体 rebrand sprint へ進む。

**Developer Account**: user が前作った既存 account あり (= $5 払い済、 ログインだけで OK)。

## session 59 で確定した重要な事 (= 前提として保持)

- **YouTube DOM は予測不能に変わる**: 1 session で 7 回 ship 追跡したが、 100% は構造的不可能。 競合 (Pocket / Raindrop / mymind / Toby / Notion Web Clipper) も誰も YouTube Watch Later 自動検知してない。 自動保存は**ベストエフォート機能**として位置付ける
- **確実な経路は 4 つの manual 経路**: Ctrl+Shift+B / フローティングボタン / 右クリック / 拡張アイコン
- **「save dispatch スキップ ≠ pill スキップ」 原則**: ミラー防御で save 抑止する時、 pill だけは別経路 (postMessage) で出して user フィードバック残す
- **SPA navigation 検知は 3 段 + polling の 4 段構え**: pushState フック / popstate / サイト独自イベント (= `yt-navigate-finish`) / 500ms 定期チェック。 X だけは polling 不可欠
- **inline ↔ source の drift 警告**: floating-button.js の inline state machine は test がカバーしない、 source と必ず同期

## 引き継ぎ resources

- [docs/TODO.md](./TODO.md) — active backlog (= 現在の状態が session 59 全 7 ship 用に更新済)
- [docs/TODO_COMPLETED.md](./TODO_COMPLETED.md) — session 59 narrative
- [docs/private/IDEAS.md](./private/IDEAS.md) — H / J / K / I-08 / I-09 / I-10 セクション
- memory `project_onboarding_stance.md` (session 59 確定、 案内方針)
- memory `reference_spa_navigation_detection.md` (session 59 確定、 4 段構え)
- memory `feedback_layman_simple_path.md` (= session 56/57/58/59 で 7 回再確認)
