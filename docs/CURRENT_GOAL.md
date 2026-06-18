# 次セッションのゴール (= セッション 111)

## 今のゴール (1 行)

**✅ セッション 110 で「紹介ページ群 全面作り直し+15言語化」のフェーズA(土台 + About 縦切り)を完走・master マージ・本番反映済。次は フェーズB = 集客ページ(features / guide / faq / extension紹介)の中身書き直し+編集デザイン+15言語化。**

## 開始時の動き
1. このファイル + [docs/TODO.md](./TODO.md)「現在の状態 (セッション 110)」を読む
2. 設計書 `docs/superpowers/specs/2026-06-18-intro-pages-redesign-i18n-design.md`(全体像)を読む
3. `git branch --show-current` で master 確認(feat/intro-pages-phaseA はマージ済・削除済)
4. ユーザーに方向確認 → フェーズB の実装計画(writing-plans)から着手

## 次にやること = フェーズB(集客ページ)
土台はフェーズAで完成済(`localePath(loc,sub)` / `pageMetadata` / `MarketingShell` / `LegacyMarketingChrome` / `navHref`+`LOCALIZED_INTRO_SUBPATHS` / sitemap / `pages.*` 名前空間)。**乗せるだけ**。
- **features / guide / faq / extension(新設紹介)** を: ①内容を現行プロダクトに合わせ全面書き直し(下記「既知修正」) ②編集デザイン(About と同じ MarketingShell + Fraunces) ③`pages.<page>.*` を15言語化(en/ja 人手 + 13言語サブエージェント + キーパリティテスト) ④英語フラット + `app/[locale]/<page>` 生成 ⑤sitemap 追加。
- 各ページを `LOCALIZED_INTRO_SUBPATHS` に追加 → ヘッダー/フッターnavが自動で言語接頭辞付きになる(navHref)。**全ページ揃ったら**残りnav(現在フラット)も自動言語化。
- **既知修正リスト**(全ページ共通): フォルダ→タグ / S/M/L→サイズ1–5・グリッド常時 / 「リキッドグラス」削除(テーマは dotted-notebook/grid-paper の2種) / 「launch後にエクスポート提供予定」→実装済(控えめ表現) / GitHub booklage→allmarks / 保存=URL貼付が主役+ブックマークレット+拡張 / 共有=URL圧縮 /s/ +PNG+X / 複数同時再生 / 音波モチーフ。
- その後 フェーズC = 法務(privacy/terms/contact/extension-privacy)+ 残りnav言語化。

## フェーズA で確立した型(踏襲)
- ルーティング: 英語=`app/(marketing)/<page>/page.tsx`(フラット)、14言語=`app/[locale]/<page>/page.tsx`(`generateStaticParams`=`PREFIXED_LOCALES`、async params+await、`dynamicParams=false`、`notFound()`)。共有コンテンツ部品 `components/marketing/pages/<Page>Content.tsx`(client、`t('pages.<page>.*')`)を両経路が `I18nProvider`+`MarketingShell` で巻く。
- メタ: `pageMetadata(locale, pageKey, subpath)`(hreflang16+自己canonical+title=`AllMarks — <localized>`)。
- nav言語化は `LOCALIZED_INTRO_SUBPATHS`(`lib/i18n/locale-urls.ts`)に subpath を足すだけ。404回避のため未生成ページは入れない。
- 翻訳: `pages.*` は15言語キー構造完全一致、`cta.button`='Open Board' 等は verbatim。キーパリティテスト必須。

## 既知の小残債(フェーズB の集客標準化でまとめて回収)
- `useReveal`(matchMedia=no-preference のみ)と CSS隠し初期値ゲート(no-preference + min-width:1024px)の非対称 → 768–1023px で一瞬チラつき得る(永久消失なし・1489px画面は無関係)。フェーズB の reveal 標準化でゲートを揃える。
- `OG_LOCALE` が `lp-metadata.ts` と `page-metadata.ts` で重複 → 第3利用者が出たら共有定数へ。
- About CSS のモバイル左右余白・CTA hover は polish 余地。
- `pageMetadata` は OG 画像なし(lpMetadata と同様)。将来 SEO polish。

## 守ること
- 本番 = `allmarks.app`。deploy 前 `npx wrangler whoami`、`rtk tsc && rtk vitest run && rtk pnpm build`。`--branch=master --commit-message`(ASCII)必須。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- アプリ本体(`/board` `/s/*` `/save`)に言語接頭辞を付けない。`DB_NAME` 等の内部符号は不変。
- 翻訳の固定値 verbatim(footer英語/AllMarks/X/YouTube/`#AllMarks`/placeholder/`Open Board`)。傾け・回転禁止・グリッド整列・偽メタデータ禁止・AI青紫グラデ禁止。デザイン変更は提案→承認。
- Contact は当面 GitHub中心・X欄なし(個人FF14垢は拡散専用・サイト非掲載)、個人メアド非掲載。About は個人の身元を出さない。
