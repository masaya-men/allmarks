# 次セッションのゴール (= セッション 46)

## ゴール

**拡張機能の対応サイト追加 sprint 1 サイト目: note 連動 + (時間あれば) Pixiv 連動**。 session 45 で TikTok を 1 サイト目としてリリース済、 量産パターンが確定。 session 46 以降は 1 セッションで 1-2 サイトずつ追加していく。 各サイト ship のたびに本番反映 + user 実機検証。

## 開始時の動き

1. user に「session 45 で ship した **PiP 常に最前面化** と **TikTok ボタン連動** の本番動作、 何か気になることありました?」 と聞く
2. TikTok の実機検証結果次第:
   - **動作 OK** → そのまま note 連動着手
   - **動作 NG** (= いいね / 保存ボタン検知できない、 OGP 取得失敗 等) → 修正を優先、 note は後回し
3. note 着手 → 完成 → 本番反映 → 時間あれば Pixiv も同セッションで

## このセッションでやること (= 1-2 サイト目)

### note 連動 (= 第 1 目標)

- **URL パターン**: `https://note.com/{user}/n/{noteId}`
- **検知対象ボタン**: 「スキ」 (= note のいいね相当)
- **DOM 構造の hint**: note は data-* 属性が比較的整理されてる、 button text `スキ` or aria-label `スキ` で検知可能と推定
- **OGP**: note は `og:title` / `og:description` / `og:image` 揃ってる、 meta 直接抽出で OK

### Pixiv 連動 (= 第 2 目標、 時間あれば)

- **URL パターン**: `https://www.pixiv.net/artworks/{illustId}`
- **検知対象ボタン**: 「ブックマーク」 (= ❤ アイコン) と「いいね」 (= 親指 ↑) の 2 種類
- **DOM 構造の hint**: Pixiv は React SPA、 button の aria-label で検知可能と推定
- **OGP**: Pixiv は OGP メタ揃ってる、 ただし R-18 等で公開設定によって取得 差

### 共通の量産レシピ (= session 45 で確定、 各サイト 6 step)

1. `extension/{site}.js` 作成 (= click 検知 + URL 抽出 + OGP 抽出 + dedupe + sendMessage)
2. `extension/manifest.json` の content_scripts に matches 追加
3. `extension/lib/auto-save-config.js` の `AUTO_SAVE_DEFAULTS` + `SOURCE_TO_KEY` に 2 source 追加 (= デフォルト ON)
4. `extension/options.html` + `extension/options.js` に トグル 2 個追加 (= `AUTO_SAVE_KEYS` 配列 / `DEFAULTS` オブジェクト両方)
5. `tests/extension/auto-save-config.test.ts` の source → key mapping テストに行追加
6. tsc + vitest + `pnpm build` + `wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="..."`

## backlog (= 残り 7 サイト + 磨き 2 件)

- 🔜 **Vimeo** like / watch later 連動
- 🔜 **SoundCloud** like 連動
- 🔜 **Bluesky** like / repost 連動
- 🔜 **Threads** いいね連動
- 🔜 **Reddit** upvote / save 連動
- 🔜 **Pinterest** save 連動
- 🔜 **(I-08) 画面右端 floating ボタン** (= 磨きフェーズ、 9 サイト追加後)
- 🔜 **(I-09) cursor pill 音波化 + テーマ連動設計** (= 同上)

## 月末リマインダー (= 約 2 週間後 2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら 拡張機能の Chrome Web Store submit + 本体 rebrand sprint に進む。 拡張に追加サイト連動全部入った状態で submit すれば「対応サイト 11 + 全 URL 4 経路」 の機能リッチな v1.0 として出せる。

## 引き継ぎ resources

- [docs/TODO.md](docs/TODO.md) — active backlog (= 「現在の状態」 が session 45 narrative)
- [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) — session 45 narrative
- [docs/private/IDEAS.md](docs/private/IDEAS.md) — (I-05) (I-08) (I-09) に拡張機能の追加サイト計画 / 磨き計画 永続化済
- memory `feedback_read_ideas_first.md` (= 拡張機能関連は IDEAS.md 優先で読む)
- memory `feedback_jargon_in_japanese.md` (= 横文字を日本語応答に混ぜない)
- session 44 narrative: [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) セッション 44 セクション (= 既存パターンの参考実装)

## session 45 で確定したこと (= 永続)

- **PiP は常に最前面**: 親 window の `focus` / `blur` / `visibilitychange` で PiP を `focus()` し直す方式 ([lib/board/pip-window.ts](../lib/board/pip-window.ts))。 限界: Chrome 本体が完全に裏のときは OS 制約で救えない
- **TikTok ボタン連動 ship 済**: いいね / 保存 (favorite) ボタン click 検知、 `data-e2e` 属性で安定検知、 feed pages では viewport 中央の動画リンクから URL 抽出
- **拡張機能の対応サイト方針**: 残り 8 サイト追加 (= note / Pixiv / Vimeo / SoundCloud / Bluesky / Threads / Reddit / Pinterest)、 Instagram は諦め
- **量産パターン確定**: 6 step のチェックリストで各サイト ship 可能
- **B-#21 受容**: 縦動画の稀な横カード問題は翌ボードセッションで backfill が直すので積極対応不要
