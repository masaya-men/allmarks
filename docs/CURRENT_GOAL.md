# 次セッションのゴール (= セッション 48)

## ゴール

**拡張機能の対応サイト追加 sprint 3 セッション目: Bluesky + Threads 連動** (= 両方とも X 系 microblogging、 button 構造が X に近いので twitter.js を写経ベースで進めやすい)。 session 47 で Vimeo + SoundCloud を ship 済、 配信先サイトは現時点で 7 サイト。 session 48 で 2 つ追加して 9 サイト。

## 開始時の動き

1. **user に前 session の動作確認は問わない** (= memory `feedback_batch_extension_verification.md`、 全 8 追加サイト ship 完了時に 1 度だけまとめて検証シート出す方針)
2. Bluesky 着手 → 完成 → 本番反映 → 時間あれば Threads も同セッションで
3. user から自発的に「Vimeo / SoundCloud 連動うまくいかない」 等の報告が来たら最優先で修正、 こちらから問わない

## このセッションでやること (= 2 サイト追加)

### Bluesky 連動 (= 第 1 目標)

- **URL pattern**: `https://bsky.app/profile/{handle}/post/{postId}` (= 投稿詳細 URL)、 fallback で `og:url`
- **検知対象 button**: 「Like」 (= ハート icon) + 「Repost」 (= 再投稿 icon)
- **DOM 構造の hint**: Bluesky は React + `aria-label="Like (X)"` / `aria-label="Reposts (X)"` 形式 (= 動的に count 含む)、 substring match で OK。 投稿一覧のフィード上 button も対象だが、 URL は投稿詳細 URL に解決する必要があるので投稿詳細ページのみに絞る (= MVP scope)
- **OGP**: Bluesky は `og:title` / `og:description` / `og:image` 揃ってる、 meta 直接抽出 OK
- **manifest matches**: `https://bsky.app/*` + `https://www.bsky.app/*`

### Threads 連動 (= 第 2 目標、 時間あれば)

- **URL pattern**: `https://www.threads.com/@{user}/post/{postId}` または `https://www.threads.net/@{user}/post/{postId}` (= Meta が `.com` と `.net` 両方運用)、 fallback で `og:url`
- **検知対象 button**: 「Like」 (= ハート icon、 aria-label に "Like" 含む)
- **DOM 構造の hint**: Threads は Instagram 同様の React + 動的 class 命名、 aria-label が一番安定。 Pixiv 同様 locale 切替で aria-label が「いいね」 になる可能性あり、 locale 横断正規表現で対応
- **OGP**: Threads は `og:*` 揃ってる、 meta 直接抽出 OK
- **manifest matches**: `https://www.threads.com/*` + `https://www.threads.net/*` + `https://threads.com/*` + `https://threads.net/*`

### 共通の量産レシピ (= 7 step、 session 46 確立、 session 47 で写経再利用済)

1. `extension/{site}.js` 作成 — `isExtensionAlive()` helper 8 行 + click 検知 + URL 抽出 + OGP 抽出 + dedupe + `try/catch` で sendMessage wrap
2. `extension/manifest.json` の content_scripts に matches 追加
3. `extension/lib/auto-save-config.js` の `AUTO_SAVE_DEFAULTS` + `SOURCE_TO_KEY` に 1-2 source 追加 (= デフォルト ON)
4. `extension/options.html` + `extension/options.js` にトグル 1-2 個追加
5. `tests/extension/auto-save-config.test.ts` の source → key mapping テストに行追加
6. tsc + vitest + `pnpm build` + `wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="..."`
7. TODO.md / TODO_COMPLETED.md / CURRENT_GOAL.md 更新 + commit

## backlog (= 残り 4 サイト + 磨き 2 件)

- 🔜 **Bluesky** like / repost 連動 (= 第 1 目標 ↑)
- 🔜 **Threads** いいね連動 (= 第 2 目標 ↑)
- 🔜 **Reddit** upvote / save 連動 (= 次々セッション)
- 🔜 **Pinterest** save 連動 (= 次々セッション)
- 🔜 **(I-08) 画面右端 floating ボタン** (= 磨きフェーズ、 残り 2 サイト ship 後)
- 🔜 **(I-09) cursor pill 音波化 + テーマ連動設計** (= 同上)

## 全サイト ship 完了時 (= 最後のセッション) の動き

memory `feedback_batch_extension_verification.md` 通り、 全 8 追加サイト (note / Pixiv / Vimeo / SoundCloud / Bluesky / Threads / Reddit / Pinterest) が ship 完了したセッションで、 user に以下を含むチェックリストを 1 度だけ提示:

- 各サイト × 各 button (= 全 13 ボタン目安) の検知可否
- console エラー有無 (= 全 7+ file の防御コード効いてるか)
- TikTok 含む既存 3 サイトの動作も再確認 (= 友達アカウント検証込み)

それまでは session ごとの確認依頼は出さない。

## 月末リマインダー (= 約 2 週間後 2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら 拡張機能の Chrome Web Store submit + 本体 rebrand sprint に進む。 拡張に追加サイト連動全部入った状態で submit すれば「対応サイト 11 + 全 URL 4 経路 + 連動 13 ボタン」 の機能リッチな v1.0 として出せる。

## 引き継ぎ resources

- [docs/TODO.md](docs/TODO.md) — active backlog (= 「現在の状態」 が session 47 narrative)
- [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) — session 47 narrative
- [docs/private/IDEAS.md](docs/private/IDEAS.md) — (I-05) (I-08) (I-09) に拡張機能の追加サイト計画 / 磨き計画 永続化済
- memory `feedback_batch_extension_verification.md` (= sprint 中は user 検証問わない、 最後に 1 度まとめ)
- memory `feedback_read_ideas_first.md` (= 拡張機能関連は IDEAS.md 優先で読む)
- memory `feedback_jargon_in_japanese.md` (= 横文字を日本語応答に混ぜない)
- session 45 narrative: [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) セッション 45 セクション (= TikTok = 量産レシピ確立 1 件目)
- session 46 narrative: [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) セッション 46 セクション (= 防御コードパターン + note / Pixiv 量産 2 件目)
- session 47 narrative: [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) セッション 47 セクション (= Vimeo / SoundCloud 量産 3 件目)

## session 47 で確定したこと (= 永続)

- **canonical URL 戦略 2 通り使い分け**: Vimeo は `og:url` 第一優先 (= 全 watch page で確実)、 SoundCloud は pathname 直接マッチ (= og:url 信用すると mini-player Like を track 詳細でなく現在 URL に紐付けてしまう)。 「og:url か pathname か」 はサイトの URL 設計次第、 1 つずつ判断
- **second segment 予約語除外パターン**: SoundCloud の `RESERVED_SECOND_SEGMENT` set は user / track URL shape が衝突する SNS 全般で再利用可能 (= Bluesky の `/{user}/profile` 等、 Reddit の `/{user}/comments` 等を除外する手法として写経できる)
- **量産レシピが「ほぼ無編集写経」 段階に到達**: vimeo.js / soundcloud.js は note.js / pixiv.js と 95% 同じ構造。 違いは URL pattern と button 検知ロジックの 2 関数だけ。 残り 4 サイトも同ペースで進められる見込み
- **配信先サイト 7**: X / YouTube / TikTok / note / Pixiv / Vimeo / SoundCloud (= ship 済) + 残り Bluesky / Threads / Reddit / Pinterest
- **sprint 中は user 実機検証を問わない**: 全 8 追加サイト ship 完了時に 1 度まとめて検証シート出す (= memory `feedback_batch_extension_verification.md`)
