# 次セッションのゴール (= セッション 109)

## 今のゴール (1 行)

**🚧 LP 多言語化(層②)第1段を実装中・あと3タスクで完成。ブランチ `feat/lp-i18n-layer2-phase1` で Task 1〜7 完了済(全レビュー緑・本番未反映)。残り = Task 8 母国語案内バー → Task 9 言語別sitemap → Task 10 通し検証+本番デプロイ+実機確認。計画 `docs/superpowers/plans/2026-06-18-lp-i18n-layer2-phase1.md`。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 108)」を読む
2. **作業ブランチ `feat/lp-i18n-layer2-phase1` に居ることを確認**(`git branch --show-current`)。master ではない
3. 進捗台帳 `cat "$(git rev-parse --git-path sdd)/progress.md"` の `lp-i18n-layer2-phase1` セクションで Task 1〜7 完了を確認(= 再実装しない)
4. **サブエージェント駆動の続き**から再開(superpowers:subagent-driven-development)。Task 8 の brief 生成 → 実装 → レビューの流れ
5. base 記録: Task 8 開始時の HEAD を控える(レビューパッケージ用、`HEAD~1` 禁止)

## ここまで完了 (Task 1〜7・全レビュー緑・本番未反映)
- **Task 1**: `landing.*` を13言語へ翻訳 + パリティテスト(15言語キー一致・footer は全言語英語固定)。`messages/*.json`
- **Task 2**: `lib/i18n/locale-urls.ts`(`localePath`/`PREFIXED_LOCALES`(英語除く14)/`hreflangAlternates`(15言語+x-default))
- **Task 3**: `lib/i18n/static-messages.ts`(`STATIC_MESSAGES` 15言語、**server 専用**)
- **Task 4**: `LandingPage` に `locale` prop + mount で `<html lang>` 設定(data-theme=light と同居・両方復元)。`SiteHeader` に `locale` prop
- **Task 5**: `app/page.tsx` を英語 provider で巻く + `lib/i18n/lp-metadata.ts`(canonical/hreflang/ローカライズ description/og locale)。`app/layout.tsx` の `<html lang>` ja→en
- **Task 6**: `app/[locale]/page.tsx` で14言語を prerender(`generateStaticParams`=PREFIXED_LOCALES、`dynamicParams=false`、en/不正は `notFound()`)。**⚠️Next.js 16.2.3 は `params` が Promise** → async+await 必須(同期だと全 locale 404)。build で `out/ja.html` 等14個生成・`out/board.html`/`out/faq.html` 健在(衝突なし)・中国語焼き込み確認済
- **Task 7**: `components/marketing/LanguageMenu.tsx`(+.module.css)= ヘッダー言語切替(endonym 表示・選ぶと `router.push(localePath)`+`persistLocale`・capture pointerdown で外側閉じ)。`SiteHeader` に設置。ARIA/z-index トークン修正済

## 残り (次セッションでやる)
- **Task 8 母国語案内バー** `components/marketing/LocaleSuggestBanner.tsx`: ブラウザ言語≠ページ言語かつ未選択なら上部に「🌐 {endonym}で見る →」(×で消えて記録)。`LandingPage` に設置。強制リダイレクトなし
- **Task 9 言語別 sitemap** `app/sitemap.ts` にトップLPの15言語URLを追加
- **Task 10 通し検証 + 本番デプロイ + 実機確認**: `rtk tsc && rtk vitest run && rtk pnpm build` → `npx wrangler pages deploy out/ --project-name=allmarks --branch=master` → allmarks.app/`/ja`/`/zh` が各言語で開くか・hreflang・言語ボタン・案内バーを実機確認
- **最後に**: 全ブランチの最終コードレビュー(superpowers:requesting-code-review)→ master マージ(superpowers:finishing-a-development-branch)
- **その後の見た目調整**: 言語メニュー・案内バーの見た目(白LP馴染ませ)を本番で user と詰める。`SiteHeader.module.css` の literal `z-index:100` をトークン化(最終レビュー指摘候補)

## 守ること
- **本番は allmarks.app**。第1段が全部終わるまではデプロイしない(Task 10 で実施)。deploy 前 `npx wrangler whoami`、tsc+vitest+build 通してから
- **`tsc <file>` 直叩き禁止**(stray `.js` を吐く)。型確認は `rtk tsc`(noEmit)。stray が出たら commit 前に削除
- アプリ本体(`/board` `/s/*` `/save`)に言語接頭辞を付けない。`DB_NAME` 等の内部符号は不変
- 翻訳の固定値 verbatim(footer 英語/`#AllMarks`/placeholder/AllMarks)
- 発明しない・横文字を日本語応答に混ぜない・AskUserQuestion ボックス禁止・デザイン変更は提案→承認

## 第2段(将来・別 spec)
- 紹介ページ群(faq/about/features/guide/privacy/terms/contact/extension)の**中身書き直し＋新デザイン＋15言語化**。土台(層②の URL/SEO/言語ボタン)は第1段で完成済なので乗せるだけ。設計書 §2 の線引き参照
- LP残債(非ブロッキング): Hero の死んだ `#save-demo` fallback 除去 / `useReveal` の `RefObject` キャスト整理 / NASA aurora 動画の焼き込みクレジット差し替え(user「気にしない」)
