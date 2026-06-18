# 紹介ページ群 全面作り直し + 15言語化 設計書(層②第2段)

- 日付: 2026-06-18(セッション 110)
- 状態: 設計確定(user 承認済み・実装前)
- 関連:
  - 前提 `docs/superpowers/specs/2026-06-18-lp-i18n-layer2-design.md`(層②第1段。トップLPの言語別URL/SEO/言語ボタンの土台。本書はその §2 で予告した「第2段」)
  - `docs/superpowers/specs/2026-06-17-lp-redesign-design.md`(作り直した LP 本体・編集的トーンの原典)
  - `docs/superpowers/specs/2026-06-18-lp-scroll-choreography-design.md`(スクロール演出ルールの原典)
  - `lib/i18n/`(I18nProvider / config / locale-store / translate / static-messages / locale-urls / lp-metadata)、`messages/*.json`(15言語)
  - 既存実装パターン: `app/[locale]/page.tsx` + `components/marketing/{SiteHeader,LanguageMenu,LocaleSuggestBanner}.tsx`
  - 記憶 [[reference_i18n_structure]] / [[reference_lp_light_color_scheme]] / [[feedback_allmarks_grid_no_tilt]] / [[reference_gsap_pin_fullscreen_overlay]] / [[feedback_visibility_never_from_animation]]

---

## 1. 背景と目的

- 層②第1段(セッション 108〜109)で **トップLP(`/`)** は15言語の言語別URL・hreflang・言語切替・案内バーまで完成し本番稼働中。
- だが **紹介ページ群(features/guide/about/faq/privacy/terms/contact/extension)** は手付かず:
  - **内容が古い**: 「フォルダ」(現=タグ)、「S/M/L サイズ」(現=サイズ1–5)、「リキッドグラス効果」(**現状そんなテーマは無い**。テーマは `dotted-notebook`/`grid-paper` の2種のみ)、「launch後にエクスポート提供予定」(現=実装済)、GitHub `booklage` リンク(現=`allmarks`)、保存経路の旧説明、タグ/拡張機能/複数同時再生/`/s/`共有 への未言及。
  - **デザインが旧式**: 素の `static-page` クラス(`<h1>/<h2>/<p>`)で、作り直した編集的 LP とは別世界。ヘッダーも LP の `SiteHeader` とは別系統の `static-header`(layout.tsx)で**2系統に分裂**。
  - **多言語化ゼロ**: 文章が日本語ベタ書きで `useI18n()` 未使用。
- 目的: 全紹介ページを **①言語別URL化(SEO) ②内容の全面書き直し(現行プロダクト準拠) ③編集的デザインへ統一 ④15言語化** する。海外検索流入と、公開(拡張ストア審査含む)に耐える信頼性を得る。

---

## 2. スコープ

### やること
- 紹介 **9ページ**(既存8 + 新設 `/extension` 紹介ページ)を上記①〜④で作り直す。
- 分裂ヘッダー/フッターを LP の `SiteHeader`/黒フッターに**一本化**(旧 `static-header`/`static-footer` 廃止)。
- 既存 i18n ヘルパー(`localePath`/`hreflangAlternates`/`lpMetadata`/`STATIC_MESSAGES`)を**サブパス対応に一般化**して再利用。

### ページ一覧

| 区分 | ページ | 英語URL(フラット) | 各言語URL | 性質 |
|---|---|---|---|---|
| 集客B | Features | `/features` | `/<locale>/features` | 編集トーン濃いめ |
| 集客B | Guide | `/guide` | `/<locale>/guide` | 編集トーン濃いめ |
| 集客B | About | `/about` | `/<locale>/about` | 編集トーン濃いめ |
| 集客B | FAQ | `/faq` | `/<locale>/faq` | 編集トーン濃いめ |
| 集客B | Extension(新設・紹介) | `/extension` | `/<locale>/extension` | 編集トーン濃いめ |
| 法務C | Privacy | `/privacy` | `/<locale>/privacy` | 落ち着いた文書 |
| 法務C | Terms | `/terms` | `/<locale>/terms` | 落ち着いた文書 |
| 法務C | Contact | `/contact` | `/<locale>/contact` | 落ち着いた文書 |
| 法務C | Extension Privacy | `/extension/privacy` | `/<locale>/extension/privacy` | 落ち着いた文書 |

### 触らないもの(不変・安全のため明記)
- アプリ本体(`/board` `/triage` `/s/*` `/save` `/save-iframe` `/api`)の URL と層①ランタイム切替。**接頭辞を付けない**(共有リンク・ブックマークレット保存先・拡張保存先を壊さない)。
- トップLP 第1段の成果(`/` と `/<locale>` の LP・言語メニュー・案内バー)。本書はそれを**横展開**するだけで作り直さない。
- `DB_NAME='booklage-db'`・`booklage:*` メッセージ型・窓名・CSS 内部クラス名等の不可視符号。
- 15言語ファイル内の固定英語語彙(TUNE/TAGS/LIBRARY 等)・placeholder・絵文字・キーコンボ・`#AllMarks`(全言語 verbatim、セッション101ルール)。

---

## 3. URL/ルーティング設計(LP第1段と同型)

- **英語はフラット**(`/features` 等、接頭辞なし。LP の `/` = 英語と同思想)。実体は既存 `app/(marketing)/<page>/page.tsx` を作り直して使う。
- **英語以外14言語は `app/[locale]/<page>/page.tsx`** を新設。`generateStaticParams()` が `PREFIXED_LOCALES`(14言語)を返し、ビルド時に `/ja/features` … を全部静的 prerender(`output:'export'` と両立)。`dynamicParams = false`、未対応 locale は `notFound()`(LP の `app/[locale]/page.tsx` と同じガード)。
- **2階層 `/extension/privacy`** も `app/[locale]/extension/privacy/page.tsx` で生成。locale セグメントは既存ルート名(board/features/guide/…/extension/api 等)と一字も重ならない(第1段で確認済の不変条件)。`extension` 配下に `page.tsx`(紹介) と `privacy/page.tsx`(プライバシー) を共存させる。
- **共有コンテンツ部品方式**: 各ページの本体は `components/marketing/pages/<Page>Content.tsx`(client、`useI18n().t('pages.<page>.*')` で文章を引く)。英語フラット経路・`[locale]` 経路の双方が薄いサーバーラッパで `<I18nProvider initialLocale={locale} initialMessages={STATIC_MESSAGES[locale]}><PageContent/></I18nProvider>` を描画。LP の `LandingPage` 方式と同一。

### 静的書き出しの注意
- `[locale]` 配下の各ページに `generateStaticParams`(14言語)と `generateMetadata`(§5)を置く。各 `<Page>Content` は **client** なので `'use client'`。サーバーラッパは静的 import の messages を渡すだけ。
- 英語フラット経路は `initialLocale="en"`、`STATIC_MESSAGES.en` を渡す(LP の `app/page.tsx` と同じ)。

---

## 4. 共通土台(A)— ヘッダー/フッター一本化と言語対応

### 4.1 ヘッダー/フッター
- 旧 `app/(marketing)/layout.tsx` の `static-header`/`static-footer` を**廃止**し、LP の `SiteHeader`(透明→スクロールで半透明バー)+ 黒フッターに一本化。
- ただし `(marketing)` ルートグループの layout は `[locale]` 配下には適用されない。よって**ヘッダー/フッターは layout ではなく共有シェル部品**(`components/marketing/MarketingShell.tsx` 等)として各ページ本体の内側で描画する。英語経路・`[locale]` 経路の双方が同じシェルを使う。
- フッターは LP の黒フィナーレの**見た目だけ流用し、スクロール演出は付けない**(紹介ページに pin/scrub は不要。[[reference_gsap_pin_fullscreen_overlay]] に従い静的な `position` ブロック)。

### 4.2 ナビの言語対応
- 現状 `SiteHeader` の `NAV_ITEMS` は `/features` 等**フラット固定**(=/ja を見ていても英語ページへ飛ぶ)。これを `localePath(locale, 'features')` で**現在言語のパス**を生成するよう改修。`/`(en)では `/features`、`/ja` では `/ja/features`。
- `LanguageMenu` は各ページでも**現在ページの別言語版**へ飛ぶ必要がある。第1段の `LanguageMenu` は LP 用(移動先が `localePath(locale)`)なので、**現在のサブパスを受け取って `localePath(locale, subpath)` を作る**よう一般化(LP は subpath 無し=従来通り)。

### 4.3 `<html lang>` と light テーマ
- 各ページ mount 時に `document.documentElement.lang = locale` と `data-theme="light"`(+`color-scheme:light`)を設定し、離脱時に復元。LP で確立した [[reference_lp_light_color_scheme]] のパターンを共有シェルに集約(全紹介ページで同居)。

---

## 5. デザイン言語

### 5.1 全ページ共通
- LP の `landing-tokens.css`(`.lpRoot`)を土台に再利用 — **Fraunces 見出しセリフ・白基調(#faf9f6)・px 基準サイジング・`clamp()` 流体**(グローバル design-philosophy 準拠)。
- ダーク強制対策(§4.3)を全ページ適用。
- ヘッダー=`SiteHeader`、フッター=静的黒ブロック(§4.1)。

### 5.2 集客B(features/guide/about/faq/extension)— 編集トーン濃いめ
- 大きな Fraunces 見出し + **番号付きセクション**(LP Features 01–05 と同じ編集的シーケンス) + たっぷり余白。
- 実例・スクリーンショット・対応サイト表を大胆に。画像ファースト・**傾けない/グリッド整列**([[feedback_allmarks_grid_no_tilt]])・**偽メタデータ禁止**。
- **控えめなスクロール登場演出**: LP の `lib/scroll/use-reveal` を流用(PC幅 ≥1024 + `prefers-reduced-motion: no-preference` のみ)。**可視性をアニメに依存させない**([[feedback_visibility_never_from_animation]]): CSS 既定で必ず可視、非表示初期値は `gsap.matchMedia` 内 `gsap.set` のみ + `clearProps`/revert。reduced-motion/モバイル/SSR は静的フォールバック。**LP signature の横スクロールジャックは入れない**(LP 専用の見せ場)。

### 5.3 法務C(privacy/terms/contact/extension-privacy)— 落ち着いた文書
- 同じヘッダー/フッター/フォント/白で**世界観は統一**するが、本文は**1カラムの読み物レイアウト**(快適な行長 ~70字、明確な見出し階層、最終更新日)。
- privacy/terms には**ページ内目次(アンカー)**。**スクロール演出は一切無し**(可読性最優先)。
- Contact は短いので中央寄せのシンプル編集体裁。

### 5.4 厳守ルール(前回踏襲)
- 可視性をアニメに依存させない / reduced-motion・モバイル・SSR で必ず見える / 傾け・回転禁止 / グリッド整列 / 偽メタデータ禁止 / AI っぽい青紫グラデ禁止(`.claude/rules/ui-design.md`)。
- 視覚の細部は LP 同様、本番(allmarks.app)に小刻みデプロイして実機調整(jsdom 不可)。本書は「型」を確定し、ピクセル調整は実装時に user と詰める。デザイン変更は提案→承認フロー(`.claude/rules/ui-design.md`)。

---

## 6. 内容の書き直し(現行プロダクト準拠)

### 6.1 大原則
全コピーを**現行コードの事実から書き直す**。実装時にサブエージェントが各主張をコードで検証してから書く(記憶や旧文を鵜呑みにしない・推測抑制5原則)。

### 6.2 既知の修正リスト(旧 → 新・コード確認済)
- フォルダ → **タグ**(既定アルファ順 + 並べ替えボタン)。
- S/M/L → **サイズ1–5**・グリッド常時・傾けない・インライン編集・直接ドラッグ。
- 「リキッドグラス効果」 → **削除**(現テーマは `dotted-notebook` 既定 / `grid-paper` の2種。`lib/board/theme-registry.ts` で確認)。
- 「launch後にエクスポート提供予定」 → エクスポート/インポートは**実装済**だが公開前に暫定ボタン整理予定 → 「データはローカル、書き出し可」程度の控えめ表現。
- GitHub `booklage` → **`allmarks`**(全リンク。リポジトリ `masaya-men/allmarks`)。
- 保存経路 → **URL貼り付けが主役** + ブックマークレット + **Chrome拡張**(session109 の方針)。
- 共有 → **URL圧縮共有 `/s/`(OG画像付き)** + PNG書き出し + Xシェア。
- 追加訴求 → **複数同時再生**(画面内自動再生・MOTIONトグル)、**音波モチーフの世界観**。
- 表示モード `visual`/`editorial`/`native` は健在(`lib/storage/indexeddb.ts` で確認) → そのまま訴求。

### 6.3 ページ別アウトライン
- **Features**: 番号付きで「保存(3経路)/ビジュアルボード(サイズ・グリッド・表示3モード・タグ)/複数同時再生/共有(/s/・PNG・X)/プライバシー=ローカル完結」+ 対応サイト表(現行挙動に更新)+「制約の誠実な開示」(Instagram埋め込み不可 等)。
- **Guide**: 「30秒で開始」→ 保存の3経路(①URL貼り付けが主役 ②ブックマークレット ③拡張)→ ボード操作(クリックで Lightbox/タグ付け/サイズ/表示モード/並べ替え)→ メディア再生 → データの注意(ローカルのみ・シークレット不可)→ トラブル対処。旧「2026-05-09 更新告知」削除。
- **About**: 製品の哲学(「整理でなく表現」)+ プライバシーファースト + オープンソース。**個人の身元は出さない**(本名/個人垢を出さない。"小さく作っている"程度に留める)。技術スタックは簡潔に。
- **FAQ**: 現行 Q&A に刷新(無料/データ保存先/保存方法3経路/対応ブラウザ/スマホ=URL貼り付け/共有=/s/とPNG/データ消去の注意/オープンソース)。「フォルダ」「リキッドグラス」除去。
- **Extension(新設)**: 何ができる/導入手順/対応サイト/プライバシーへのリンク/「ストア準備中・今はブックマークレットで使える」誠実バナー(`EXTENSION_STORE_URL` 空の間)。
- **Privacy**: ローカル完結・サーバー保存なし・アカウント不要・解析(Cloudflare Cookie なし)を正確に。最終更新日・目次。
- **Terms**: 無料/無保証/データはユーザー管理/禁止事項/準拠法 等を平易に。最終更新日・目次。
- **Contact**: **GitHub Issues 中心**(allmarks リポ)。**X欄は置かない**(個人 FF14 垢はサイト非掲載・拡散専用)。セキュリティ報告導線。**個人メアド非掲載**。
- **Extension Privacy**: 拡張が何を読む/何を送らない(ローカル保存・サーバー送信なし)を正確に。ストア審査参照ページ。

---

## 7. 多言語の仕組み

- 翻訳に**新名前空間 `pages.*`** を追加(`pages.features.*` `pages.guide.*` `pages.about.*` `pages.faq.*` `pages.extension.*` `pages.privacy.*` `pages.terms.*` `pages.contact.*` `pages.extensionPrivacy.*`)。15言語でキー構造を完全一致。
- 英語・日本語は**人手品質**、残り13言語(ar/de/es/fr/it/ko/nl/pt/ru/th/tr/vi/zh)は**並列サブエージェント翻訳 + 品質レビュー**(第1段と同方式)。固定値 verbatim 保持。
- **ヘルパー一般化**(後方互換):
  - `localePath(locale, subpath?)`: subpath 無し=従来の LP パス、有り=`/<locale>/<subpath>`(en は `/<subpath>`)。
  - `hreflangAlternates(subpath?)`: 各ページ用の15言語+x-default マップ。
  - 汎用 `pageMetadata(locale, pageKey)`(新規 `lib/i18n/page-metadata.ts`): `pages.<page>.meta.title/description` から各ページの title/description + hreflang(自ページ) + 自己 canonical を生成。LP 用 `lpMetadata` はそのまま残す。
- **共有シェル** `MarketingShell`(client)に `<html lang>`/light/ヘッダー/フッターを集約。各 `<Page>Content` をその中に置く。
- `STATIC_MESSAGES[locale]` は全 messages を保持済み → `pages.*` を追記するだけで各言語ページに焼き込まれる。

---

## 8. データフロー

```
[/ja/features を開く(検索 or 直リンク)]
  → ビルド済み静的HTML(日本語で焼き込み済み)が即表示
  → app/[locale]/features/page.tsx が <I18nProvider initialLocale="ja" initialMessages={STATIC_MESSAGES.ja}>
      → <MarketingShell locale="ja" subpath="features"> 内で FeaturesContent が useI18n().t('pages.features.*') を日本語描画
      → mount: document.lang='ja', data-theme='light'; ヘッダー nav は /ja/guide 等(localePath('ja', …))
  → <head> に hreflang(15言語+x-default、subpath='features')・canonical(/ja/features) が焼き込み済み

[/features(英語フラット)を開く]
  → app/(marketing)/features/page.tsx が initialLocale='en'、STATIC_MESSAGES.en で同フローの英語版
  → nav は /guide 等(en は接頭辞なし)、canonical=/features、hreflang に x-default→/features
```

---

## 9. 影響ファイル(見込み・実装計画で確定)

新規:
- `app/[locale]/{features,guide,about,faq,extension,privacy,terms,contact}/page.tsx` と `app/[locale]/extension/privacy/page.tsx`(各サーバーラッパ + generateStaticParams + generateMetadata)。
- `components/marketing/MarketingShell.tsx`(共有シェル: html lang/light/ヘッダー/フッター)。
- `components/marketing/pages/<Page>Content.tsx` ×9(client、本文 + `pages.*` 参照)。
- `lib/i18n/page-metadata.ts`(汎用 `pageMetadata`)。
- 各 `.module.css`(集客B用・法務C用のレイアウト)。

改修:
- `app/(marketing)/<page>/page.tsx` ×8(英語フラット経路を共有部品+provider 方式に作り直し)、新規 `app/(marketing)/extension/page.tsx`(英語 Extension 紹介)。
- `app/(marketing)/layout.tsx`(static-header/footer 廃止 → 子に委譲、または撤去)。
- `components/marketing/SiteHeader.tsx`(nav を `localePath(locale, …)` 化)。
- `components/marketing/LanguageMenu.tsx`(subpath 対応で別言語版へ移動)。
- `lib/i18n/locale-urls.ts`(`localePath`/`hreflangAlternates` に subpath 引数)。
- `app/sitemap.ts`(9ページ×15言語 + alternates)。
- `messages/*.json`(15言語に `pages.*` 追加)。
- 旧 `static-page` 系 CSS(globals.css)を新レイアウトへ置換 or 撤去。

---

## 10. エラー処理・エッジケース
- 未対応 locale URL: `generateStaticParams` 外は生成されない(static export で 404)。`notFound()` 併用。
- `/extension`(紹介) と `/extension/privacy` の共存: Next の入れ子ルートで両立。`[locale]/extension/page.tsx` と `[locale]/extension/privacy/page.tsx` を両方生成。
- `EXTENSION_STORE_URL` 空: Extension ページは「準備中・ブックマークレットで今すぐ」を表示(ストアリンクを出さない)。投入後にリンク有効化。
- localStorage 不可: 言語メニュー/案内バーの記憶ができないだけ。表示・切替は機能。
- reduced-motion/モバイル/SSR: 集客B の登場演出は静的フォールバック、必ず可視。
- hreflang 相互参照: 全ページが同じ15言語マップ(各 subpath)を出して自動成立。

---

## 11. テスト
- 単体(vitest):
  - **`pages.*` の15言語 leaf key 完全一致**(構造パリティ)+ 固定値 verbatim 機械チェック。
  - `localePath(locale, subpath)` の生成(en フラット / `/ja/features` 等)。
  - `pageMetadata` の hreflang マップ(15言語+x-default、全絶対URL、自己 canonical)。
  - sitemap エントリ(9ページ×15言語 + alternates)。
- ビルド: ルート増(現38 → +約126: 9ページ×14言語。英語フラット8は既存)。build 成功。tsc 0 / vitest 全 pass。
- 本番(allmarks.app)実機:
  - 各ページ各言語が正しい言語で開く。`<head>` に hreflang・canonical(curl で確認)。
  - ヘッダー nav が言語接頭辞付き(/ja で Guide → /ja/guide)。言語メニューで同一ページの別言語へ移動。
  - 集客B の登場演出が PC で効き、reduced-motion/モバイルで静的に必ず見える。法務C が可読・目次が効く。
  - 旧 `booklage` リンク・「フォルダ」「リキッドグラス」等の旧語が**残っていない**こと(全言語 grep)。

---

## 12. 実装フェーズ(実装計画 writing-plans で詳細化)
- **フェーズA(土台)**: `localePath`/`hreflangAlternates` 一般化、`pageMetadata`、`MarketingShell`、`SiteHeader`/`LanguageMenu` の言語対応、sitemap 拡張、`pages.*` 雛形。**About(小さい)を15言語で端から端まで通して実証**(本番デプロイ・実機確認)。
- **フェーズB(集客)**: features/guide/faq/extension紹介 — 内容書き直し(コード検証済)+ 編集デザイン + 13言語翻訳。
- **フェーズC(法務)**: privacy/terms/contact/extension-privacy — 文書レイアウト + 正確な文面 + 13言語翻訳。
- 各フェーズ: サブエージェント駆動・タスク毎2段レビュー + 通し最終レビュー(opus)・本番デプロイで実機調整。フェーズ完了ごとに master へマージ可能(独立して価値が出る)。

---

## 13. 実装計画で詰める点(未確定)
- 集客B の登場演出の具体(どのセクションを reveal するか・タイミング)。実機で調整。
- 法務C の目次UI(sticky か上部か)。
- 共有シェルの `data-theme`/`lang` 復元と LP・ボードとの干渉確認(LP 既存パターンに倣う)。
- 英語フラット経路の layout(`(marketing)/layout.tsx`)を撤去するか子委譲にするか(共有シェルとの二重ヘッダー回避)。
- ルート約126増による build 時間・出力サイズの確認(静的なので各HTMLに該当言語のみ焼き込まれる想定)。
- Features/Guide のスクリーンショット素材の用意(本物のボード画像・偽メタデータ無し)。
