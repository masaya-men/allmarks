# 次セッションのゴール (= セッション 112)

## 今のゴール (1 行)

**✅ セッション 111 で 紹介ページ群フェーズB(集客: features / guide / faq / 新設 extension紹介)を内容書き直し+編集デザイン+15言語化+nav言語化まで完走・master マージ・本番反映済。次は フェーズC = 法務ページ(privacy / terms / contact / extension-privacy)の作り直し+15言語化 + 残り nav(contact 等)の言語化。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 111)」を読む
2. 設計書 `docs/superpowers/specs/2026-06-18-intro-pages-redesign-i18n-design.md`(§5.3 法務C デザイン・§6.3 ページ別アウトライン privacy/terms/contact/extension-privacy)を読む
3. `git branch --show-current` で master 確認(feat/intro-pages-phaseB はマージ済)
4. ユーザーに方向確認 → フェーズC の実装計画(writing-plans)から着手

## 次にやること = フェーズC(法務ページ)
土台(`MarketingShell` / `pageMetadata` / `navHref`+`LOCALIZED_INTRO_SUBPATHS` / `pages.*` / `intro-page.module.css`)は完成済。**乗せるだけ**。集客Bと違い「落ち着いた1カラム読み物」レイアウト(§5.3)。
- **privacy / terms / contact / extension-privacy** を: ①内容を現行プロダクトの事実に書き直し(ローカル完結・サーバーDBなし・アカウント不要・Cookieなし・拡張が読む/送らないもの・最終更新日)②法務向け読み物デザイン(目次アンカー privacy/terms、スクロール演出なし、快適な行長)③`pages.<page>.*` を15言語化(en/ja 人手 + 13言語並列 + パリティテスト)④英語フラット + `[locale]` 生成 ⑤sitemap を15言語化(現状フラットの privacy/terms/contact)。
- 各ページを `LOCALIZED_INTRO_SUBPATHS` に追加 → 残り nav(contact 等)が自動言語化(全ページ揃ったので 404 回避完了)。`extension/privacy` も言語化(Extension紹介の英語固定リンク `/extension/privacy` をこの時 navHref/言語化キーに更新)。
- Contact は GitHub Issues 中心・X欄なし・個人メアド非掲載(踏襲)。

## フェーズB で確立/踏襲した型(そのまま使う)
- 各ページ: 共有部品 `components/marketing/pages/<Page>Content.tsx`(client、`t('pages.<page>.*')`、`useReveal(rootRef as React.RefObject<HTMLElement>, ...)` キャスト付き)。共有 CSS は `intro-page.module.css`(法務は読み物用クラスを追加 or 別モジュール)。
- 英語=`app/(marketing)/<page>/page.tsx`(provider+MarketingShell)、14言語=`app/[locale]/<page>/page.tsx`(`generateStaticParams`=`PREFIXED_LOCALES`・async params+await・`dynamicParams=false`・`isPrefixedLocale`+`notFound()`)。
- メタ: `pageMetadata(locale, pageKey, subpath)`。翻訳は `pages.*` 15言語キー完全一致 + `cta.button`='Open Board' verbatim + パリティテスト必須。

## フェーズB の小残債(フェーズC で回収候補)
- Extension紹介の privacy リンクが英語固定ラベル `Extension privacy` + フラット `/extension/privacy`(extension-privacy 言語化時に navHref/キー化)。
- `OG_LOCALE` の `ar: 'ar_AR'` は厳密には地域コード要(将来 SEO polish)。`OG_LOCALE` が lp-metadata と page-metadata で重複(第3利用者が出れば共有定数化)。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- アプリ本体(`/board` `/s/*` `/save`)に言語接頭辞を付けない。`DB_NAME` 等の内部符号は不変。
- 翻訳の固定値 verbatim(footer英語/AllMarks/X/YouTube/`#AllMarks`/placeholder/`Open Board`)。傾け・回転禁止・グリッド整列・偽メタデータ禁止・AI青紫グラデ禁止。可視性アニメ非依存。デザイン変更は提案→承認。
- Contact は GitHub中心・X欄なし・個人メアド非掲載。About/紹介は個人の身元を出さない。
