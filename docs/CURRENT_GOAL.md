# 次セッションのゴール (= セッション 113)

## 今のゴール (1 行)

**✅ セッション 112 で 紹介ページ群フェーズC(法務: privacy / terms / contact / extension-privacy)を内容書き直し+15言語化+nav全言語化まで完走・master マージ・本番反映済。これで紹介9ページ全部が英語+14言語で完成。次は 拡張機能の Chrome ウェブストア審査提出に向けた仕上げ。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 112)」を読む
2. `git branch --show-current` で master 確認(feat/intro-pages-phaseC はマージ済・削除済)
3. ユーザーに方向確認 → 下記から着手

## いまの到達点(紹介ページ群 完成)
- 紹介9ページ(about / features / guide / faq / extension紹介 / privacy / terms / contact / extension-privacy)が **英語フラット + 14言語の専用URL**で本番稼働。hreflang + canonical + sitemap + 言語別 nav 完備。
- 法務の内容を**現行プロダクトの事実に正確化**: 共有=Cloudflare KV/R2 に約30日アップロード(旧「サーバーに送らない」を一掃)、拡張権限=`<all_urls>`+`notifications` 無し(manifest 一致・審査直結)、GitHub=allmarks、Contact=GitHub中心・X欄なし・個人メアド非掲載、準拠法=日本/東京。

## 次にやること(候補・ユーザーと相談して選ぶ)
- **拡張ストア審査の提出準備**: ストア掲載文・スクリーンショット・プロモ画像、`extension/manifest.json`(v0.1.20)の最終確認、プライバシー導線(`/extension/privacy` を審査フォームに記載)。提出後 `EXTENSION_STORE_URL`(`lib/board/constants.ts`、現在空)に URL を入れると board の「GET EXTENSION」と extension紹介ページが自動点灯。
- **オンボーディング**(初回ユーザー向け案内)。
- 紹介ページの実機 polish(余白・タイポ・目次の効き)をユーザーと詰める。

## フェーズC の小残債(余裕があれば回収)
- 法務ページ本文の補助リンク(privacy→お問い合わせ 等)の **href がフラットのまま**。ラベルは言語化済みだが、`/ja/privacy` の「お問い合わせ」リンクが英語 `/contact` に着地する。Privacy/Terms/ExtensionPrivacy の各 Content に `locale` prop を足し `navHref(locale, ...)` 化すれば直る(機能は動く・着地が英語になるだけの軽微)。
- `OG_LOCALE` の `ar: 'ar_AR'` は厳密には地域コード要(将来 SEO polish)。lp-metadata と page-metadata で重複(第3利用者が出れば共有定数化)。
- ar の RTL レイアウト対応(現状は翻訳テキストのみ)。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- アプリ本体(`/board` `/s/*` `/save`)に言語接頭辞を付けない。`DB_NAME` 等の内部符号は不変。
- 翻訳の固定値 verbatim。傾け・回転禁止・偽メタデータ禁止・AI青紫グラデ禁止。デザイン変更は提案→承認。個人情報(本名/個人メアド/個人 X 垢)を tracked ファイルに書かない。
