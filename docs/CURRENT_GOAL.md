# 次セッションのゴール (= セッション 50)

## ゴール

**user 実機検証チェックシートの結果次第で 2 方向**:

- **(A) 検証で問題発覚** → 該当サイトの button 検知 / OFF 除外 / URL 抽出 を修正、 再 deploy。 通常 1-2 サイトの fix で済む見込み
- **(B) 全 11 サイト × 18 ボタン OK** → 拡張機能の磨きフェーズへ。 **(I-08) 画面右端 floating ボタン** か **(I-09) cursor pill 音波化 + テーマ連動設計** のどちらから着手するか user と相談

session 49 で 8 追加サイト sprint 完走。 配信先 11 サイト / 検知 18 ボタン / 内部 source 18。 検証シートは session 49 close メッセージで提示済 (= 引き継ぎメッセージ参照)。

## 開始時の動き

1. user から「全部 OK」 「X サイトで動かない」 等の検証結果が来るのを待つ (= 自発的に検証は問わない、 user が報告 or 「次へ進めて」 と言ってくる)
2. (A) 問題報告ありなら、 該当 file (= `extension/{site}.js`) を読んで原因究明 + 修正 + 再 deploy
3. (B) 全 OK なら、 (I-08) (I-09) のどちらから着手するか聞く

## (A) パスの判断材料

- aria-label 系のミスマッチ (= 検知が走らない) → DOM 構造を user 環境で確認、 lowercase / locale stem / OFF 除外を patch
- 誤発火 (= 関係ない button でも保存される) → scope 判定を強化 (= 例: Reddit の shreddit-comment 除外パターンを他サイトに横展開)
- URL 抽出が間違う (= 別 URL に紐付く) → og:url shape verify を厳密化、 fallback pathname pattern を強化

## (B) パスの選択肢

### (I-08) 画面右端 floating ボタン
- 実装難度: 低 (= 50 行くらい)
- 影響範囲: `extension/content.js` + `extension/content.css` + options.html / options.js (= ON/OFF + 位置切替)
- メリット: 全 URL 1 click 保存の 4 番目の経路 (= ショートカット / 右クリック / 拡張アイコン に加わる)。 mouse 派ユーザーへ最も近い操作距離
- 懸念: 一部サイトの右端 UI (= Slack / Notion / 動画サイト controls) と干渉、 設定で位置切替可能にすることで mitigate

### (I-09) cursor pill 音波化 + テーマ連動設計
- 実装難度: 中 (= 音波 keyframes 設計 + CSS 変数受け口の抽象化)
- 影響範囲: `extension/content.css` (= keyframes 書き換え) + 将来テーマ system の受け口 (= CSS 変数経由)
- メリット: AllMarks default theme (= 黒+白 minimal + 音波 motif) と extension の見た目統一、 将来テーマ system 拡張時に拡張機能側も連動可能な設計を今のうちに仕込める
- 懸念: 「将来テーマ system」 自体がまだ不在、 receptive 設計だけ仕込む形になる

両方の詳細は `docs/private/IDEAS.md` (I-08) (I-09) セクション参照。

## 月末リマインダー (= 約 2 週間後 2026-05-31)

`allmarks.app` ドメイン取得確認。 取得済なら 拡張機能の Chrome Web Store submit + 本体 rebrand sprint に進む。 拡張に **11 サイト × 18 ボタン連動 + (I-08) (I-09) 磨き** が入った状態で submit すれば、 機能リッチな v1.0 として出せる。

## 引き継ぎ resources

- [docs/TODO.md](docs/TODO.md) — active backlog (= 「現在の状態」 が session 49 narrative)
- [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) — session 49 narrative
- [docs/private/IDEAS.md](docs/private/IDEAS.md) — (I-08) (I-09) の磨きフェーズ詳細
- memory `feedback_batch_extension_verification.md` (= 検証は user から自発報告を待つ、 こちらから問わない)
- memory `feedback_read_ideas_first.md` (= 拡張機能関連は IDEAS.md 優先で読む)
- memory `feedback_jargon_in_japanese.md` (= 横文字を日本語応答に混ぜない)
- session 49 narrative: [docs/TODO_COMPLETED.md](docs/TODO_COMPLETED.md) セッション 49 セクション (= 8 追加サイト sprint 完走 narrative)

## session 49 で確定したこと (= 永続)

- **量産レシピは Reddit / Pinterest で写経完成 — 卒業段階に到達**: bluesky.js / threads.js / vimeo.js / soundcloud.js / note.js / pixiv.js / reddit.js / pinterest.js の構造は完全に固まった。 違いは URL pattern (= 2-3 行) と button 検知ロジック (= 5-10 行) の 2 箇所のみ。 8 追加サイト sprint で 1 セッション 2 サイトのペースを安定維持
- **scope 判定の `.closest()` 二段構え** (= NOT inside X + IS inside Y) は Reddit が初の本格適用、 将来「コメント階層を持つサイト全般」 に応用可能
- **data-test-id 優先 + aria-label fallback の二段戦略** (= Pinterest が初の本格適用) は React 製サイト全般で安定。 TikTok の `data-e2e` と同じ思想で、 今後新規 React サイト追加時は data-test-id を最優先で探す
- **配信先サイト 11**: X / YouTube / TikTok / note / Pixiv / Vimeo / SoundCloud / Bluesky / Threads / Reddit / Pinterest (= ship 済、 sprint 完走)
- **検知ボタン 18 個**: 全 18 source、 デフォルト全 ON、 options で個別 ON/OFF 可能
