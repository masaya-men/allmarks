# 次セッションのゴール (= セッション 130)

## 最優先: ① ツイート翻訳機能の設計を固めて実装に入る
session129 で brainstorming の「対象範囲 = ツイート本文のみ」まで合意済。続きから:
1. **アプローチを2〜3案提示して合意** — 翻訳トリガーUI(ボタンの場所・見た目)/ 原文↔訳の切替方式 / 初回モデルDL中の見せ方 / 非対応ブラウザの扱い。
2. **設計提示→承認→設計書を `docs/superpowers/specs/2026-06-2x-tweet-translate-design.md` に保存+commit→自己レビュー→user レビュー**。
3. **writing-plans で実装計画→実装(TDD)**。

### 確定済みの事実・骨子(再調査不要)
- 取り込みは **原文のみ**。`fetchTweetMeta` → `/api/tweet-meta` プロキシ → `cdn.syndication.twimg.com/tweet-result`、本文 `text = full_text ?? text`([tweet-meta.ts:142](../lib/embed/tweet-meta.ts#L142))。URL の `&lang=en` は表示ヒントで翻訳ではない。**自前翻訳が必須**。
- 端末内 **Chrome Translator API**(安定版 Chrome 144〜・Win/Mac/Linux/ChromeOS・**モバイル/Firefox/Safari 不可**)。サーバー/キー不要・¥0・データ非送信。`Translator.availability()` + LanguageDetector(原文言語判定)。
- 表示は Lightbox の `TweetText`(右カラム、`tweetMeta.text` = 原文を描画)。トグルはこの周辺に置く。
- 骨子: Lightbox トグル / 押した時だけ都度翻訳 / 原文↔訳ワンタップ / 訳文は保存しない / 非対応はボタン非表示 / 翻訳先 = アプリの現在表示言語(15言語設定)。

## 次点・宿題
- **② の目視確認**: 本物のボード共有を1回して、テキストカードのタイトルが共有OG画像で **中央寄せ + Geist** になってるか確認(コードは本番反映済)。ズレてたら capture-mirror の画像なし分岐を微調整。
- ④ 既定OGP画像はミニマル版(波形メーター削除・ロゴ+説明文のみ)で本番反映済(user 承認済)。`allmarks.app` 文字を戻したくなったら `scripts/generate-og-image.mjs` に1行で復活可。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII) 必須。応答は日本語。UI 変更は事前一言。
- **既知フレーキー**: `tests/lib/channel.test.ts` が full run でたまに落ちる→再実行 green(session129 は1652全 pass だった)。
- 翻訳は新機能なので **brainstorming→spec→plan の順を守る**(コードを書く前に user 合意)。
