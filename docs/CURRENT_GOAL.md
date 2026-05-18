# 次セッションのゴール (= セッション 47)

## ゴール

**拡張機能の対応サイト追加 sprint 2 セッション目: Vimeo + SoundCloud 連動** (= multi-playback vision と相性良い 動画 / 音楽 ペア)。 session 46 で note + Pixiv 追加 + 既存 3 file への Extension context invalidated 防御コードを ship 済、 配信先サイト 7 つに到達。 session 47 で 2 つ追加して 9 サイト。

## 開始時の動き

1. **user に前 session の動作確認は問わない** (= memory `feedback_batch_extension_verification.md`、 全 8 サイト ship 完了時に 1 度だけまとめて検証シート出す方針)
2. Vimeo 着手 → 完成 → 本番反映 → 時間あれば SoundCloud も同セッションで
3. user から自発的に「note の検知うまくいかない」 等の報告が来たら最優先で修正、 こちらから問わない

## このセッションでやること (= 2 サイト追加)

### Vimeo 連動 (= 第 1 目標)

- **URL pattern**: `https://vimeo.com/{videoId}` (= 数字 ID) / `https://vimeo.com/channels/{ch}/{videoId}`
- **検知対象 button**: 「Like」 (= ハート icon) + 「Watch later」 (= 時計 icon)
- **DOM 構造の hint**: Vimeo は React + 比較的 clean な aria-label。 button[aria-label*="Like"] / button[aria-label*="Watch later"] で検知可能と推定
- **OGP**: Vimeo は `og:title` / `og:description` / `og:image` + `og:video` 揃ってる、 meta 直接抽出で OK

### SoundCloud 連動 (= 第 2 目標、 時間あれば)

- **URL pattern**: `https://soundcloud.com/{user}/{track}`
- **検知対象 button**: 「Like」 (= ハート icon)
- **DOM 構造の hint**: SoundCloud は ember.js + 独自 class 命名、 button[aria-label="Like"] or title 属性で検知可能と推定
- **OGP**: SoundCloud は OGP メタ揃ってる、 ただし widget embed されたページもあるので URL 抽出は location.pathname ベース

### 共通の量産レシピ (= 7 step に拡張、 防御コード込み)

1. `extension/{site}.js` 作成 — `isExtensionAlive()` helper 8 行 + click 検知 + URL 抽出 + OGP 抽出 + dedupe + `try/catch` で sendMessage wrap
2. `extension/manifest.json` の content_scripts に matches 追加
3. `extension/lib/auto-save-config.js` の `AUTO_SAVE_DEFAULTS` + `SOURCE_TO_KEY` に 1-2 source 追加 (= デフォルト ON)
4. `extension/options.html` + `extension/options.js` にトグル 1-2 個追加
5. `tests/extension/auto-save-config.test.ts` の source → key mapping テストに行追加
6. tsc + vitest + `pnpm build` + `wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="..."`
7. TODO.md / TODO_COMPLETED.md / CURRENT_GOAL.md 更新 + commit

## backlog (= 残り 6 サイト + 磨き 2 件)

- 🔜 **Bluesky** like / repost 連動
- 🔜 **Threads** いいね連動
- 🔜 **Reddit** upvote / save 連動
- 🔜 **Pinterest** save 連動
- 🔜 **(I-08) 画面右端 floating ボタン** (= 磨きフェーズ、 残り 4 サイト ship 後)
- 🔜 **(I-09) cursor pill 音波化 + テーマ連動設計** (= 同上)

## 全サイト ship 完了時 (= 最後のセッション) の動き

memory `feedback_batch_extension_verification.md` 通り、 全 8 追加サイト (note / Pixiv / Vimeo / SoundCloud / Bluesky / Threads / Reddit / Pinterest) が ship 完了したセッションで、 user に以下を含むチェックリストを 1 度だけ提示:

- 各サイト × 各 button (= 全 13 ボタン目安) の検知可否
- console エラー有無 (= 全 5+ file の防御コード効いてるか)
- TikTok 含む既存 3 サイトの動作も再確認 (= 友達アカウント検証込み)

それまでは session ごとの確認依頼は出さない。

## 月末リマインダー (= 約 2 週間後 2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら 拡張機能の Chrome Web Store submit + 本体 rebrand sprint に進む。 拡張に追加サイト連動全部入った状態で submit すれば「対応サイト 11 + 全 URL 4 経路 + 連動 13 ボタン」 の機能リッチな v1.0 として出せる。

## 引き継ぎ resources

- [docs/TODO.md](docs/TODO.md) — active backlog (= 「現在の状態」 が session 46 narrative)
- [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) — session 46 narrative
- [docs/private/IDEAS.md](docs/private/IDEAS.md) — (I-05) (I-08) (I-09) に拡張機能の追加サイト計画 / 磨き計画 永続化済
- memory `feedback_batch_extension_verification.md` (= sprint 中は user 検証問わない、 最後に 1 度まとめ)
- memory `feedback_read_ideas_first.md` (= 拡張機能関連は IDEAS.md 優先で読む)
- memory `feedback_jargon_in_japanese.md` (= 横文字を日本語応答に混ぜない)
- session 45 narrative: [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) セッション 45 セクション (= TikTok = 量産レシピ確立 1 件目)
- session 46 narrative: [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) セッション 46 セクション (= 防御コードパターン + note / Pixiv 量産 2 件目)

## session 46 で確定したこと (= 永続)

- **Extension context invalidated 防御パターン**: `isExtensionAlive()` helper (= `chrome.runtime.id` の sync check) + click listener の sendMessage 直前 1 行 check + `try/catch` で race 時の sync throw 吸収。 新規 site file には最初から組み込む (= 量産レシピに含めた)
- **共通 helper 外出しは見送り**: 既存 manifest は classic script、 module 化の副作用回避のため inline 重複許容
- **配信先サイト 7**: X / YouTube / TikTok / note / Pixiv (= ship 済) + 残り Vimeo / SoundCloud / Bluesky / Threads / Reddit / Pinterest
- **note の「スキ」 と内部 source 名**: 内部 = 英語統一 (`note-like`)、 UI = user 語彙 (= 「note — スキ button」)。 同じ判断は Reddit / Bluesky 等の locale 専用ワードでも使う
- **sprint 中は user 実機検証を問わない**: 全 8 サイト ship 完了時に 1 度まとめて検証シート出す (= memory `feedback_batch_extension_verification.md`)
