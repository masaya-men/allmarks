# LP 多言語化(層②)第1段 設計書 — 言語別URL + 検索対策 + トップLP翻訳

- 日付: 2026-06-18(セッション 108)
- 状態: 設計確定(user 承認済み・実装前)
- 関連:
  - 前提設計図 `docs/superpowers/specs/2026-06-17-i18n-locale-architecture-design.md`(層②の URL/SEO 方針を §5 で確定済み。本書はその実装設計)
  - `docs/superpowers/specs/2026-06-17-lp-redesign-design.md`(作り直した LP 本体)
  - `lib/i18n/`(I18nProvider / config / locale-store / translate)、`messages/*.json`(15言語)
  - 記憶 [[reference_i18n_structure]] / [[reference_lp_light_color_scheme]] / [[feedback_allmarks_grid_no_tilt]]

---

## 1. 背景と目的

- LP は前回(セッション107)白基調・編集的に全面作り直して本番 `allmarks.app` に公開済み。だが **当面英語固定**(`app/page.tsx` は `I18nProvider` 外 → `useI18n()` が英語ベイクにフォールバック)。
- 翻訳ファイルは UI 部分は15言語そろっているが、**LP 用の `landing.*` ブロックは `en.json` / `ja.json` の2言語にしかない**(セッション107で新規追加。残り13言語は未翻訳)。
- 事業上、海外検索流入が生命線。看板(トップLP)を15言語の**言語別 URL** で検索エンジンに拾わせるのが本丸。
- 構成は `output: 'export'`(完全な静的書き出し=サーバーなし)。Next 標準 i18n ルーティングは使えないため、`generateStaticParams` で全言語を作り置きする自前方式を採る(前提設計図 §5.2 で確定済み)。

---

## 2. スコープ(第1段 / 第2段の線引き)

user 合意:ゴールは「全紹介ページの多言語化」だが、紹介ページ群(faq/about/features/guide/privacy/terms/contact/extension)は**中身が古く(旧「フォルダ」語・旧保存手順)、新デザイン未適用**のため、今翻訳すると古い情報が15言語に拡散する。よって **2段に分割**する。

| 第1段(本書 = 今回) | 第2段(次回以降・別 spec) |
|---|---|
| ✅ 言語別 URL の**土台**(`/` 英語 + `/ja` `/zh`… を作り置き) | ⏳ 紹介ページ群の**中身書き直し** |
| ✅ トップLP(`/`)の多言語化(13言語翻訳 + 品質チェック) | ⏳ 紹介ページの新デザイン化(LP と統一) |
| ✅ 検索対策(hreflang / x-default / canonical / 言語別 sitemap / lang 属性) | ⏳ 紹介ページの15言語化(同じ土台に乗せる) |
| ✅ LP ヘッダーの言語切替ボタン | ⏳ ヘッダーメニュー(Features/Guide…)の言語別URL化 |
| ✅ 「母国語で見る →」案内バー | |

**第1段の成果**:トップLPが15言語の専用URLで検索に乗り、言語ボタン・案内バーで誰でも自分の言語で見られる。土台は第2段がそのまま乗るだけ。

### 触らないもの(不変・安全のため明記)

- アプリ本体(`/board` `/triage` `/s/*` `/save` `/save-iframe`)の URL と層①ランタイム切替(セッション106完成)。**接頭辞を付けない**(共有リンク・ブックマークレット保存先・拡張保存先を壊さないため)。
- `DB_NAME='booklage-db'`・`booklage:*` メッセージ型・窓名・CSS クラス名等の不可視な内部符号。
- 15言語ファイル内の固定英語語彙(TUNE/TAGS/LIBRARY 等)・placeholder `{current}/{total}`・絵文字・キーコンボ・`#AllMarks`(全言語 verbatim、セッション101ルール)。
- ボードの言語切替UI(右下地球儀)・拡張機能・onboarding(別タスク)。

---

## 3. URL 構成(確定)

- **素の URL `allmarks.app/` = 英語**(世界向け既定・x-default)。`/en` は作らない(英語の正式URLは `/`)。
- 各言語は1セグメント接頭辞:`/ja` `/zh` `/ko` `/es` `/fr` `/de` `/pt` `/it` `/nl` `/tr` `/ru` `/ar` `/th` `/vi`(14言語)。日本語も `/ja` できちんと検索に出る(英語に対して不利にならない)。
- 対象は **`SUPPORTED_LOCALES`(`lib/i18n/config.ts`)の15言語**。英語は `/`、残り14が接頭辞付き。

### 静的書き出しでの実現手段

- `app/page.tsx`(既存):`/` を英語で描画(据え置き、§4.1 で provider を巻く)。
- 新規 `app/[locale]/page.tsx`(server component)+ `generateStaticParams()` が**英語を除く14 locale**を返す → ビルド時に `/ja` `/zh` … を全部静的 prerender(`output:'export'` と両立)。
- 衝突しないことの確認:locale コード(ja/zh/ko/es/fr/de/pt/it/nl/tr/ru/ar/th/vi)は既存ルート名(board/faq/about/features/guide/privacy/terms/contact/s/save/save-iframe/api)と**一字も重ならない**。静的書き出しは generateStaticParams が返した分しかファイル生成しないため、`/board` 等は各自のルートが生成し `[locale]` は侵さない。
- 不正 locale の防御:`generateStaticParams` の14語以外は生成されない。`app/[locale]/page.tsx` は念のため未対応 locale を受けたら `notFound()`(static export では未生成 = 404 ファイル)。

---

## 4. 各ページが「正しい言語で作り置きされる」仕組み

### 4.1 既存 I18nProvider の「URL固定モード」を再利用(新規 provider 不要)

`lib/i18n/I18nProvider.tsx` は既に最適:
- `initialLocale` を渡すと **mount 時の自動言語解決(localStorage/ブラウザ判定)をスキップ**する(`useEffect` 冒頭 `if (initialLocale) return`)。
- `initialMessages` を渡すと**その言語のメッセージで同期描画**する(初期 state に入る)。

→ 各言語ページは `<I18nProvider initialLocale={locale} initialMessages={messages}>` で LandingPage を巻くだけ。prerender 時点でその言語の HTML が焼き込まれる(英語→swap が起きない=検索エンジンに正しい言語で渡る)。

実装:
- `app/page.tsx`(英語):`<I18nProvider initialLocale="en" initialMessages={en}><LandingPage/></I18nProvider>`。`en.json` は同期 import。
- `app/[locale]/page.tsx`(各言語):server component が `params.locale` を読み、その locale の messages を**ビルド時に静的 import**して `initialLocale` + `initialMessages` で provider に渡す。
  - 静的 import 手段:`output:'export'` のため動的 `import()` ではなく、locale→messages の明示マップ(15言語を import 済みオブジェクトで持つ薄いモジュール、例 `lib/i18n/static-messages.ts`)を用意し、`STATIC_MESSAGES[locale]` を渡す。これでビルド時に全言語が確定し、各 HTML に焼き込まれる。
- LP では **`setLocale` を呼ばない**(言語変更は URL 移動=§6 の切替ボタン)。固定モードなので localStorage 解決とも無縁。

### 4.2 `<html lang>` を各言語に合わせる

- 現状 `app/layout.tsx` は `<html lang="ja">` 固定(英語LPでも ja のまま=不正確)。root layout は全ルート共有で static export ではルート毎に変えられない。
- 対処:LandingPage(または locale ラッパ)が mount 時に `document.documentElement.lang = locale` を設定(離脱時に復元)。既存の `data-theme="light"` 設定([[reference_lp_light_color_scheme]])と同じパターンで同居。
- 検索エンジン向けに最重要な hreflang/canonical は §5 で静的 HTML の `<head>` に焼き込む(JS 非依存)ので、lang 属性の JS 補正は補助的役割。root の既定は実害の小さい `lang="en"` に変更(世界既定)。

### 4.3 LP 本体(LandingPage)の改修は最小

- LandingPage / 各 section は既に `useI18n().t('landing.*')` で文章を引いている(Hero 等で確認済み)。**provider を正しく巻けば翻訳が出る**。コンポーネント本体の文章ロジック変更は不要。
- 死んだ fallback の整理(`#save-demo`)等の LP 残債は本タスクのついでで回収可(非ブロッキング、実装計画で扱う)。

---

## 5. 検索対策(SEO・確定)

すべて Next Metadata API で**静的 HTML の `<head>` に焼き込む**(JS 非依存、クローラーが確実に読む)。

- **hreflang alternates**:各ページに「この内容の各言語版URL」を全15言語ぶん + `x-default` → `/`(英語)。
  - `app/page.tsx`(英語)と `app/[locale]/page.tsx` の両方で `generateMetadata` が `alternates.languages` マップ(`{ ja: '/ja', zh: '/zh', …, 'x-default': '/' }`)を返す。
  - URL は `lib/constants.ts` の `SITE_URL` 由来の絶対URL。
- **canonical**:各言語ページの canonical = 自分自身(`/ja` の canonical は `/ja`、`/` の canonical は `/`)。
- **言語別 sitemap**:既存 `app/sitemap.ts` を拡張し、トップLPの15言語URL + 各エントリの言語 alternates を出力。`app/robots.ts` は既存のまま(sitemap 参照を確認)。
- **lang 属性**:§4.2。

> hreflang は「相互参照」が要件(A が B を指すなら B も A を指す)。全ページが同じ15言語マップ + x-default を出すことで自動的に相互参照が成立する。

---

## 6. 言語切替ボタン(LPヘッダー)

- 配置:`components/marketing/SiteHeader.tsx` の右側(Open Board の近く)に言語コントロールを追加。
- 表示:`LANGUAGE_ENDONYMS`(`config.ts` に既存)で各言語を**自分の言語名**で列挙(日本語 / English / 中文 / 한국어 / Español …)。中国語話者は「中文」で見つけられる(findability 優先=ボード切替UIと同方針)。
- 動作:選択でその言語の URL へ**移動**(`next/link`、`/` or `/ja` 等)。現在の言語に印。`setLocale` は使わない(各言語は別の静的HTMLなので URL 移動が正)。
- 選んだ言語を localStorage(層①と同じ `allmarks-locale`、`locale-store.ts`)に保存 → 案内バー(§7)の抑制 + ボード側の既定とも整合。
- **見た目(畳み時の形・地球儀アイコン・色・開閉アニメ)は実装段階で実機を見ながら user と確定**(白い編集的LPに馴染ませる。[[feedback_no_question_box_for_design]] に従い平文で対話)。
- 部品は第2段で紹介ページにも使えるよう、現在 locale と「移動先URLの作り方」を外から渡せる形にする。

---

## 7. 「母国語で見る →」案内バー

- 目的:英語トップ(`/`)に来た非英語ブラウザの人に、強制せず母国語版を案内する(user の「日本人として英語だとうーんとなる」懸念への対処)。
- 仕組み:LP上の client 部品。mount 時に `detectLocale()`(`config.ts` 既存)でブラウザ言語を判定。
  - 判定言語が**現在のページ言語と異なり**、かつ user が未 dismiss・未選択なら、ページ上部にスリムな帯を出す:`🌐 {endonym}で見る →`(その言語URLへのリンク)+ `×`。
  - ページ本体は描画し直さない(英語のまま)=ちらつき・SEO事故なし。帯は load 後に静かにスライドイン。
  - `×` 押下 or 言語選択(§6)で localStorage に記録 → 次回以降出さない。
- 範囲:**LPのみ**(ボードには出さない)。
- 文言・登場アニメの細部は実装計画/実機で詰める。

---

## 8. 翻訳(13言語ぶん + 品質チェック)

- 対象:`landing.*` ブロックを `en.json`(基準)から13言語へ:ar/de/es/fr/it/ko/nl/pt/ru/th/tr/vi/zh。en/ja は既存(人手品質)。
- 方式:並列サブエージェントで en を基準に翻訳。**固定すべきもの verbatim 保持**(英語固定語彙・`{current}/{total}` 等の placeholder・絵文字・`#AllMarks`・ブランド名 AllMarks)。
- **品質チェック工程**(看板の文章=ブランドの顔):翻訳後に別担当が各言語を検査 —(a) 構造パリティ(15言語で `landing.*` の leaf key が完全一致)、(b) 固定値 verbatim、(c) 明らかな破綻・未翻訳残り・トーン崩れの spot check。機械チェック(キー一致)+ レビューエージェントの二段。
- キー構造は en/ja と完全一致を保つ。

---

## 9. データフロー

```
[/ja を開く(検索 or 直リンク)]
  → ビルド済み静的HTML(日本語で焼き込み済み)が即表示
  → app/[locale]/page.tsx が <I18nProvider initialLocale="ja" initialMessages={ja}>
      → LandingPage が useI18n().t('landing.*') で日本語描画(swap なし)
      → mount effect: document.lang='ja', data-theme='light'
  → <head> に hreflang(15言語+x-default)・canonical(/ja)が焼き込み済み

[英語トップ / に日本語ブラウザの人が来る]
  → 英語HTML表示(動かない)
  → 案内バー: detectLocale()='ja' ≠ 'en' かつ未dismiss → 「🌐 日本語で見る →」
  → 押す → /ja へ移動(= 上のフロー)/ × → localStorage に記録

[ヘッダー言語ボタンで「中文」を選ぶ]
  → /zh へ URL 移動(中国語の静的HTML)+ localStorage 記録
```

---

## 10. 影響ファイル(見込み・実装計画で確定)

新規:
- `app/[locale]/page.tsx`(server, generateStaticParams + generateMetadata)
- `lib/i18n/static-messages.ts`(locale→messages の静的マップ、ビルド時焼き込み用)
- `components/marketing/LanguageMenu.tsx`(LPヘッダー言語切替、endonym)
- `components/marketing/LocaleSuggestBanner.tsx`(母国語案内バー)
- `lib/i18n/locale-urls.ts`(locale→LP URL、hreflang マップ生成の共通関数)

改修:
- `app/page.tsx`(英語 provider 巻き + generateMetadata で hreflang)
- `app/layout.tsx`(`<html lang>` 既定を en に)
- `components/marketing/LandingPage.tsx`(`document.lang` 設定、locale を受け取る)
- `components/marketing/SiteHeader.tsx`(LanguageMenu 設置)
- `app/sitemap.ts`(言語別エントリ + alternates)
- `messages/{ar,de,es,fr,it,ko,nl,pt,ru,th,tr,vi,zh}.json`(`landing.*` 追加)

---

## 11. エラー処理・エッジケース

- 未対応 locale URL:`generateStaticParams` 外は生成されない(static export で 404 ファイル)。`notFound()` も併用。
- localStorage 不可(プライベートモード):案内バーは出る/出ないの記憶ができないだけ。切替・表示は機能。
- ブラウザ言語が15言語外:`detectLocale()` が英語へフォールバック → 英語トップで案内バー非表示(現在=英語と一致)。
- prerender(navigator なし):各ページは `initialLocale` 固定なので navigator に依存しない。案内バーは client mount 後のみ判定。
- hreflang 相互参照:全ページ同一マップ出力で自動成立。

---

## 12. テスト

- 単体:
  - `static-messages` の locale→messages マップが15言語そろう。
  - `locale-urls` の URL 生成(`/` 英語・`/ja` 等)と hreflang マップ(15言語+x-default、全絶対URL)。
  - 案内バーの判定(`detectLocale` と現在 locale の比較、dismiss 記憶)。
  - 言語メニューの移動先 URL。
  - **15言語 `landing.*` の leaf key 完全一致**(構造パリティ)+ 固定値 verbatim の機械チェック。
- ビルド:`/ja` `/zh` … 14ルート増(現24 → 約38)、build 成功。
- 本番(allmarks.app)実機:
  - 各言語URLが正しい言語で開く。
  - `<head>` に hreflang・canonical が入っている(curl で確認)。
  - 言語ボタンで移動。日本語ブラウザで `/` に案内バーが出て `/ja` へ飛べる。× で消えて再訪で出ない。
  - 既存 vitest(現1043 pass)を壊さない・tsc 0。

---

## 13. 実装計画で詰める点(未確定)

- 言語切替ボタン・案内バーの**見た目/アニメ/正確な文言**(実機を見ながら user と確定)。
- `static-messages.ts` の持ち方(15言語 import が First Load JS / ビルド出力に与える影響。LP は静的なので各HTMLに該当言語のみ焼き込まれる想定だが、import の tree-shaking を実装時に確認)。
- root `<html lang>` 既定変更が他ルート(board 等)に与える影響の確認(board は英語UIが主なので en で実害なし想定)。
- LP 残債(死んだ `#save-demo` fallback 除去・`RefObject` キャスト整理)を本タスクに同梱するか分離するか。
