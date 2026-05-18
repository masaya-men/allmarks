# 次セッションのゴール (= セッション 49)

## ゴール

**拡張機能の対応サイト追加 sprint 4 セッション目 (= 最終): Reddit + Pinterest 連動**。 session 48 で Bluesky + Threads を ship 済、 配信先サイトは現時点で 9 サイト。 session 49 で 2 つ追加して **11 サイト = 8 追加サイト sprint 完了**。 完了直後、 全 11 サイトの user 実機検証チェックシートを 1 度出す。

## 開始時の動き

1. **user に前 session の動作確認は問わない** (= memory `feedback_batch_extension_verification.md`、 sprint 完了時に 1 度まとめて検証シート出す方針)
2. Reddit 着手 → 完成 → 本番反映 → Pinterest も同セッションで完成 → 全 ship 完了の引き継ぎ前に **検証シート提示**
3. user から自発的に「これまでに ship した 9 サイトの連動うまくいかない」 等の報告が来たら最優先で修正、 こちらから問わない

## このセッションでやること (= 2 サイト追加 + sprint 完了)

### Reddit 連動 (= 第 1 目標)

- **URL pattern**: `https://www.reddit.com/r/{subreddit}/comments/{postId}/{slug}/` (= 投稿詳細 URL)、 fallback で `og:url` (Reddit は canonical 設定済)
- **検知対象 button**: 「Upvote」 (= 上矢印) + 「Save」 (= 「Save」 menu item)
- **DOM 構造の hint**: Reddit は新 UI (shreddit-post web component) と旧 UI (.thing) が混在。 新 UI は `shreddit-post` element に attribute あり、 button は `aria-label="upvote"` (lowercase) / `aria-label="Save"`。 mid-toggle で「Upvoted」 / 「Saved」 に変化するので OFF action は最初に除外
- **scope**: post 詳細ページのみ (= /r/{sub}/comments/{id}/...)。 feed (/r/{sub}/) 上の同 button は extractPostUrl null return で実質除外。 comment 上の Upvote は post の Upvote とぶつかるので button が post root に紐づくかチェック (= `closest('shreddit-post')` の有無)
- **OGP**: Reddit は `og:title` / `og:description` / `og:image` 揃ってる、 meta 直接抽出 OK
- **manifest matches**: `https://www.reddit.com/*` + `https://reddit.com/*` + `https://new.reddit.com/*` (= old.reddit.com は別 UI なので scope 外)

### Pinterest 連動 (= 第 2 目標)

- **URL pattern**: `https://www.pinterest.com/pin/{pinId}/` (= 投稿詳細 URL)、 fallback で `og:url`
- **検知対象 button**: 「Save」 (= board に保存)
- **DOM 構造の hint**: Pinterest は React、 Save ボタンは `data-test-id="pin-action-save"` or 類似 attribute あり (要確認)。 fallback で aria-label に "Save" / 「保存」 含む button を loose match。 Pinterest は Save 直後に board 選択 popover を出すので、 「Save」 ボタン押下時点で URL 抽出 → ON 判定する設計で OK
- **OGP**: Pinterest は `og:*` 揃ってる、 meta 直接抽出 OK
- **manifest matches**: `https://www.pinterest.com/*` + `https://pinterest.com/*` + `https://jp.pinterest.com/*` (= 各国 subdomain あり、 今回は jp + 無印で MVP scope、 他国は要望が来たら追加)

### 共通の量産レシピ (= 7 step、 session 46 確立、 session 47-48 で写経再利用済)

1. `extension/{site}.js` 作成 — `isExtensionAlive()` helper 8 行 + click 検知 + URL 抽出 + OGP 抽出 + dedupe + `try/catch` で sendMessage wrap
2. `extension/manifest.json` の content_scripts に matches 追加
3. `extension/lib/auto-save-config.js` の `AUTO_SAVE_DEFAULTS` + `SOURCE_TO_KEY` に 1-2 source 追加 (= デフォルト ON)
4. `extension/options.html` + `extension/options.js` にトグル 1-2 個追加
5. `tests/extension/auto-save-config.test.ts` の source → key mapping テストに行追加
6. tsc + vitest + `pnpm build` + `wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="..."`
7. TODO.md / TODO_COMPLETED.md / CURRENT_GOAL.md 更新 + commit

## 全サイト ship 完了時 (= session 49 後半) の動き

memory `feedback_batch_extension_verification.md` 通り、 全 8 追加サイト (= note / Pixiv / Vimeo / SoundCloud / Bluesky / Threads / Reddit / Pinterest) + 既存 3 サイト (= X / YouTube / TikTok) ship 完了時に、 user に以下を含むチェックリストを 1 度だけ提示:

- 各サイト × 各 button (= 全 17 ボタン目安、 site 11 + button 8 追加 + 既存 6) の検知可否
- console エラー有無 (= 全 11 file の防御コード効いてるか)
- TikTok 含む既存 3 サイトの動作も再確認 (= 友達アカウント検証込み)

検証シート提示後 user が「OK」 と確認したら、 次は **(I-08) 画面右端 floating ボタン** か **(I-09) cursor pill 音波化** の磨きフェーズに進む。 user 判断待ち。

## 残り backlog (= sprint 完了後の磨き)

- 🔜 **(I-08) 画面右端 floating ボタン** (= 磨きフェーズ、 sprint 完了後の最有力候補)
- 🔜 **(I-09) cursor pill 音波化 + テーマ連動設計** (= 同上)

## 月末リマインダー (= 約 2 週間後 2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら 拡張機能の Chrome Web Store submit + 本体 rebrand sprint に進む。 拡張に追加サイト連動全部入った状態で submit すれば「対応サイト 11 + 全 URL 4 経路 + 連動 17 ボタン」 の機能リッチな v1.0 として出せる。

## 引き継ぎ resources

- [docs/TODO.md](docs/TODO.md) — active backlog (= 「現在の状態」 が session 48 narrative)
- [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) — session 48 narrative
- [docs/private/IDEAS.md](docs/private/IDEAS.md) — (I-05) (I-08) (I-09) に拡張機能の追加サイト計画 / 磨き計画 永続化済
- memory `feedback_batch_extension_verification.md` (= sprint 中は user 検証問わない、 最後に 1 度まとめ)
- memory `feedback_read_ideas_first.md` (= 拡張機能関連は IDEAS.md 優先で読む)
- memory `feedback_jargon_in_japanese.md` (= 横文字を日本語応答に混ぜない)
- session 45 narrative: [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) セッション 45 セクション (= TikTok = 量産レシピ確立 1 件目)
- session 46 narrative: [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) セッション 46 セクション (= 防御コードパターン + note / Pixiv 量産 2 件目)
- session 47 narrative: [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) セッション 47 セクション (= Vimeo / SoundCloud 量産 3 件目)
- session 48 narrative: [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) セッション 48 セクション (= Bluesky / Threads 量産 4 件目)

## session 48 で確定したこと (= 永続)

- **OFF action 除外を最初に走らせる pattern が安定**: aria-label が ON / OFF で文字列分岐するサイト (= Bluesky / Threads / Reddit 全部) は、 ON pattern を緩く match させると OFF も拾うので、 「最初に OFF を弾く → 次に ON を判定」 の二段構えが標準。 `\b` word boundary も併用 (= "Unlike" に "like" がマッチしない単語境界の性質を活用)
- **複数 locale の aria-label は OR 正規表現で十分**: Pixiv / Threads は同じ手法でカバー (= ja / en / zh / ko の stem を `|` で繋ぐ)。 Reddit は en のみ、 Pinterest は jp + en のみで OK
- **写経速度の上限が見えてきた**: bluesky.js / threads.js は 95% 写経。 残り 2 サイト (= Reddit / Pinterest) も同ペースで session 49 内に収まる見込み
- **配信先サイト 9**: X / YouTube / TikTok / note / Pixiv / Vimeo / SoundCloud / Bluesky / Threads (= ship 済) + 残り Reddit / Pinterest = **session 49 で sprint 完了**
- **sprint 完了時に検証シート提示**: 全 11 サイト × 全 17 ボタン目安 + console エラー有無のチェックリストを 1 度だけ出す
