# i18n 言語切替アーキテクチャ 設計書

- 日付: 2026-06-17(セッション 106)
- 状態: 設計確定(user 承認済み・実装前)
- 関連: `docs/CURRENT_GOAL.md` の公開準備①、`lib/i18n/config.ts` / `lib/i18n/t.ts`、`messages/*.json`(15言語)、`project_lp_redesign_vision`(LP 作り直し)

---

## 1. 背景と目的

- 翻訳ファイルは 15 言語ぶん揃っている(`messages/ja.json` ほか、ja と同構造 96 leaf key、セッション 101 で整備済み)。
- だが `lib/i18n/t.ts` が `import messages from '@/messages/ja.json'` 固定のため、**画面には日本語しか出ない**。
- 構成は `output: 'export'`(完全な静的書き出し=サーバーなし)。**Next.js 標準の i18n ルーティングは output:'export' では使えない**ため、自前で設計する必要がある。
- 目的: サーバーレス(静的書き出し)のまま、業界水準かつ高速な多言語化を実現する。ターゲットは世界中の全ユーザー。海外検索流入が事業上の生命線。

---

## 2. 全体アーキテクチャ(2層構成)

多言語化を、性質の異なる 2 層に分ける。

### 層① アプリ本体 = ランタイム言語切替(URL を変えない)

- board / triage / s / save / save-iframe など。これらは各ユーザーの非公開ローカルデータ(IndexedDB)を扱う道具であり、**検索に乗せる意味がない**。
- 開いた瞬間に言語を決定し、その言語の翻訳ファイルだけを読み込み、画面に配る。言語切替は**リロードなしで即反映**。
- **URL は不変**(`/board` のまま)。既存の共有リンク・ブックマークレットの保存先・拡張の保存先を一切壊さない。

### 層② 紹介ページ(LP) = 言語別 URL の静的ページ(検索集客用)

- home(`app/page.tsx`)+ `app/(marketing)/*`(about/faq/features/guide/privacy/terms/contact/extension/privacy)。
- 言語ごとに別 URL を用意し、ビルド時に全言語ぶんの静的 HTML を作り置きして、検索エンジンに各言語版を別々に拾わせる(hreflang・言語別 sitemap)。
- **本セッションでは実装しない。設計図として確定するのみ**(理由は §5)。

---

## 3. 本セッションのスコープ(捨て仕事ゼロの線引き)

| 今回やる(durable=作り直さない) | LP 作り直し(③)と一緒にやる |
|---|---|
| ✅ アプリ本体のランタイム多言語化(層①) | ⏳ 層②の言語別 URL 実ページ生成 |
| ✅ app・LP 共用の「言語の核」(言語決定・読み込み・言語切替部品) | ⏳ LP 文章の 15 言語 translate |
| ✅ 言語切替 UI(右下・地球儀) | ⏳ hreflang / 言語別 sitemap の実配線 |
| ✅ 層②の URL+SEO 構成を本設計書で確定 | |

**今回の成果**: 「アプリが世界中の言語で使える(目に見える)」+「LP がどう多言語 SEO するかの設計図が確定(次の LP 作業がそこに乗るだけ)」。

---

## 4. 層① アプリ本体ランタイム多言語化(本セッションで実装)

### 4.1 仕組み(Context + hook)

- 新規 `LocaleProvider`(`'use client'`)を `app/(app)/layout.tsx`(およびブックマークレット系 `app/save`・`app/save-iframe` の layout)に設置。
- Provider が「今の言語」と「読み込んだ翻訳メッセージ」を state で保持し、`useI18n()` フックで `t(key)` と `setLocale(locale)` を配る。
- `t(key)` は **同期関数**(現在の呼び出しパターンを維持)。Context のメッセージから読む。
- 既存 `lib/i18n/config.ts` の `loadMessages(locale)`(動的 import + cache、コード分割済み)をそのまま使う → **選ばれた 1 言語ぶんだけダウンロード**(全 15 言語を同梱しない=軽い・速い。First Load JS 予算に優しい)。

### 4.2 言語の決定順序

開いたとき、次の順で resolve:

1. ユーザーが以前選んだ言語(localStorage に永続化)
2. なければブラウザ言語(`detectLocale()` = `navigator.languages` から最も近い対応言語)
3. それでも不明なら **英語**(`config.ts` の `detectLocale` は既に非日本語に対し `'en'` を返す)

- 永続化キー: 新規(例 `allmarks-locale`)。BoardConfig 等とは分離した独立キー。
- `setLocale()` 実行時: localStorage 更新 → `loadMessages()` → Context state 更新 → 全体再 render(リロード不要)。

### 4.3 初回描画のちらつき対策

- 静的 HTML は **英語**(=世界向け既定)を同期同梱して prerender し、「翻訳 key がそのまま見える」事故を防ぐ。
- 解決された言語のメッセージは mount 時に非同期読み込みし、届いたら swap。日本語ユーザーは初回に一瞬 英語→日本語 の入れ替わりが起こり得るが、board は GSAP/IndexedDB の重い初期化の裏に隠れるため実害なし(許容)。
- 返り値最適化: localStorage の選択言語が同梱既定(英語)と一致する場合は swap なし。

### 4.4 既存呼び出しの移行

- `t()` を使う実コンポーネント約 13 ファイル(`BoardRoot` / `TuneTrigger` / `Sidebar` / `TriagePage` / `Lightbox` / `PrecisionSlider` / `EmptyStateWelcome` / `BookmarkletInstallModal` / `BookmarkletInstall` / `DisplayModeSwitch` ほか)を、`import { t } from '@/lib/i18n/t'` → `const { t } = useI18n()` に機械的に付け替える。
- 旧 `lib/i18n/t.ts`(モジュール直 import)は撤去 or 互換 shim(英語フォールバック用)に縮小。実装計画で決める。

### 4.5 言語切替 UI(右下・地球儀)

- 配置: **ボード右下に単独**(左下のブックマークレット「📌 AllMarks ↔ Drag me」と左右で釣り合う)。下部の波形メーター・余白・スクリムと衝突しないよう実装時に微調整。
- 畳んだ状態: `🌐 + 言語コード`(例 `🌐 JA` / `🌐 EN`)。ボードの英語大文字 Geist Mono デザインと馴染む省スペース表示。コードは**言語コード**(`JA`/`EN`/`ZH`…、`ja.json` 等と一致。国コード `JP` ではない)。
- 開いた状態: 15 言語が**それぞれの言語自身の名前(endonym)**で並ぶ — `日本語 / English / 中文 / 한국어 / Español / Français / Deutsch / Português / Italiano / Nederlands / Türkçe / Русский / العربية / ไทย / Tiếng Việt`。選ぶと即切替。
  - 理由: 中国語しか読めない人は英単語「CHINESE」を探せない。自分の言語は「中文」という見慣れた文字で探す。**言語切替だけはボードの英語大文字デザインの例外**として endonym を採用する(世界中の初見ユーザーへの findability 優先)。
- 部品は **層②(LP)でも再利用**できる前提で、見た目を外から差し替え可能に作る(board chrome 版 / LP header 版)。
- 見た目(地球儀の形・色・畳み時の形・開閉アニメ)は実装前に user と画面を見ながら確定する。

### 4.6 触らないもの(不変)

- ボード chrome の意図的固定英語語彙(TITLE / TUNE / SETTINGS / MANAGE TAGS / POP OUT / SHARE / MOTION / TAGS / LIBRARY / Inbox / Archive 等)。これらは多言語化対象外(`project_theme_sound_wave` / `feedback_ui_vocabulary`)。
- `DB_NAME='booklage-db'`・`booklage:*` メッセージ型・窓名・CSS クラス名等の不可視な内部符号。
- ブックマークレットの内部 ID・保存 URL パス(`/save` 等。変えると installed 分が壊れる)。
- 15 言語ファイル内の固定英語語彙・placeholder `{current}/{total}`・絵文字・キーコンボ・`#AllMarks`(全言語 verbatim、セッション 101 ルール)。

---

## 5. 層② 紹介ページ言語別 URL + SEO(本設計書で確定・実装は LP 作り直しと一緒)

### 5.1 なぜ今は実装しないか

- 現在の紹介ページは**日本語ベタ書き**(例 `app/(marketing)/faq/page.tsx`)で、内容も古い(旧ブックマークレット手順・旧 GitHub リンク `booklage`)。
- LP は丸ごと洗練されたデザインに作り直す予定(`project_lp_redesign_vision`)。
- いま言語別 URL の器だけ作ると「中身が日本語のままの `/en/faq`」という壊れたページが 15 言語ぶんでき、redesign で作り直すため二重の無駄。
- よって**設計図として確定し、LP 作り直し(③)時にこの方針で実装する**。

### 5.2 URL 構成(確定)

- **素の URL `allmarks.app/` = 英語**(世界向け既定・x-default)。
- 各言語は接頭辞: `/ja`(日本語)・`/zh`(中国語)・`/ko` … 15 言語。日本語版も `/ja` できちんと検索に出る(不利にならない)。
- 実装手段: app router の `app/[locale]/` 動的セグメント + `generateStaticParams()` が 15 locale を返す → ビルド時に `/`(英語)・`/ja`・`/en/about` … を全部静的 prerender(output:'export' と両立)。
- アプリ本体(`/board` 等)は**接頭辞を付けない**(層①のランタイム切替。installed ブックマークレット・共有リンク保護のため)。

### 5.3 SEO 対策(確定)

- 各言語ページに `hreflang` の alternate link(「この内容の◯◯語版はこの URL」)+ `x-default`(→ 素の `/` = 英語)。
- 言語別 sitemap エントリ。`lib/constants.ts` の `SITE_URL` 由来で生成。
- canonical を各言語ページ自身に設定。

### 5.4 注意(LP 実装時に効く)

- IndexedDB は **origin 単位**(scheme+host+port)であり path 単位ではない。`/ja/...` のような path 接頭辞を付けてもユーザーデータは分割されない(層②は LP のみで、ユーザーデータを持つ層①は接頭辞なしなので、そもそも無関係だが念のため明記)。

---

## 6. データフロー(層①)

```
[ページ表示]
  → LocaleProvider mount
    → resolve locale: localStorage('allmarks-locale') → detectLocale() → 'en'
    → loadMessages(locale)  // 動的 import、cache 済み
    → Context に { locale, messages, t, setLocale } を供給
  → 各コンポーネントが useI18n().t(key) で同期描画

[言語切替ボタンで選択]
  → setLocale(next)
    → localStorage 更新
    → loadMessages(next)
    → Context state 更新 → 全体再 render（リロードなし）
```

---

## 7. エラー処理・エッジケース

- メッセージ読み込み失敗(動的 import 失敗): 同梱英語にフォールバック。`t()` は key が無ければ key 文字列を返す(現挙動維持)。
- 未対応言語のブラウザ: `detectLocale()` が英語にフォールバック(既存挙動)。
- localStorage 不可(プライベートモード等): メモリ上の state だけで動作。永続化されないだけで切替は機能。
- SSR/ビルド時(navigator なし): `detectLocale()` が `DEFAULT_LOCALE` を返す実装だが、prerender は英語同梱で固定(§4.3)。

---

## 8. テスト

- 単体: locale 解決順序(saved → browser → en)、`detectLocale` の各分岐、`t()` のネスト key / 欠損 key、`setLocale` で localStorage 更新 + メッセージ差し替え。
- Provider: 初期 locale / 切替後の `t()` 出力。
- 既存 vitest を壊さない(現状 1019+ pass)。tsc 0。
- 本番(allmarks.app)で実機確認: 言語切替ボタンの動作、各言語が出るか、リロードなし切替、ブラウザ言語による自動判定。

---

## 9. 本セッションのスコープ外(明示)

- 層②(LP 言語別 URL)の実ページ生成・LP 文章 translate・hreflang/sitemap 実配線 → LP 作り直し(③)時。
- 拡張機能(options 等)の多言語化 → 別途(本体とは別の翻訳経路)。
- onboarding(初回案内)→ 公開準備②。

---

## 10. 未確定・実装計画で詰める点

- 旧 `t.ts` を撤去するか互換 shim を残すか。
- ビルド時 prerender の既定言語を英語に切り替える具体手順(現状 ja 同梱)。
- 言語切替ボタンの厳密な座標・開閉アニメ・MOTION OFF 時の挙動(実装前に user と画面確認)。
