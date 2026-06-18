# 紹介ページ群 フェーズA(土台 + About 縦切り) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 紹介ページ群を言語別URL・編集デザイン・15言語化する土台を作り、About ページを15言語で端から端まで通して実証する(既存ライブページは見た目ゼロ変化で温存)。

**Architecture:** LP第1段の型(`app/page.tsx` + `app/[locale]/page.tsx` + `I18nProvider` + `STATIC_MESSAGES`)をサブページへ横展開する。i18n ヘルパー(`localePath`/`hreflangAlternates`)を subpath 対応に後方互換で一般化し、汎用 `pageMetadata` を新設。共有シェル `MarketingShell`(LP の `SiteHeader`/`SiteFooter` + `<html lang>`/light テーマ + `lpRoot`)を作り、英語フラット経路と `[locale]` 経路の双方が薄いサーバーラッパで provider を巻いて描画する。旧 static ヘッダーは `LegacyMarketingChrome` に抽出して未移行ページを温存する。

**Tech Stack:** Next.js 14 App Router(`output: 'export'`)、TypeScript strict、Vanilla CSS Modules、Vitest、react/next。GSAP/Lenis は LP 既存の `lib/scroll/use-reveal` のみ流用(任意)。

## Global Constraints

- **応答・コメントは日本語**。UI 表示テキストは世界共通英語語彙 + 翻訳ファイル。金額は¥(本タスクでは金額表記なし)。
- `output: 'export'`(完全静的)。`generateStaticParams` で全 locale を作り置き。`dynamicParams = false`。未対応 locale は `notFound()`。
- **英語はフラット URL**(`/about`)、**他14言語は `/<locale>/about`**。`SUPPORTED_LOCALES` = `ja,en,zh,ko,es,fr,de,pt,it,nl,tr,ru,ar,th,vi`(15)。`PREFIXED_LOCALES` = en を除く14。
- **アプリ本体(`/board` `/triage` `/s/*` `/save` `/save-iframe` `/api`)に接頭辞を付けない**。`DB_NAME='booklage-db'` 等の不可視符号は不変。
- 15言語ファイルの固定英語語彙・placeholder・絵文字・キーコンボ・`#AllMarks` は全言語 verbatim。新規キーは15言語でキー構造完全一致。
- **可視性をアニメに依存させない**(CSS 既定=可視、非表示初期値は `gsap.matchMedia('(min-width:1024px) and (prefers-reduced-motion: no-preference)')` 内の `gsap.set` のみ + `clearProps`/revert)。**傾け・回転禁止**・グリッド整列・偽メタデータ禁止・AI っぽい青紫グラデ禁止。
- ダーク強制対策: 各ページ mount 中 `<html data-theme="light">` + `color-scheme:light`、離脱で復元(LP 既存パターン)。
- **本番デプロイ**(セッション末): `rtk pnpm build` → `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-message "<ASCII>"`。`tsc <file>` 直叩き禁止 → `rtk tsc`。
- **404 回避の順序制約**: `SiteHeader` の nav アイテムリンク(Features/Guide/FAQ/Contact)の言語接頭辞化は **全ローカライズ済みページが揃う最終フェーズ(C)** で行う。Phase A では nav アイテムリンクはフラット(英語)のまま。`LanguageMenu`(現在ページの別言語版へ移動)のみ subpath 対応にする(移動先 `/<locale>/about` は Phase A で全15言語生成されるので安全)。

---

## File Structure

新規:
- `lib/i18n/page-metadata.ts` — 汎用 `pageMetadata(locale, pageKey, subpath)`。
- `lib/i18n/page-metadata.test.ts` — テスト。
- `components/marketing/MarketingShell.tsx` — 編集的共有シェル(ヘッダー/フッター/lang・theme/lpRoot)。
- `components/marketing/LegacyMarketingChrome.tsx` — 旧 static チャ―ム(未移行ページ温存用、現 layout から抽出)。
- `components/marketing/pages/AboutContent.tsx` — About 本文(client、`pages.about.*` 参照)。
- `components/marketing/pages/AboutContent.module.css` — About レイアウト。
- `app/[locale]/about/page.tsx` — 14言語の About サーバーラッパ。

改修:
- `lib/i18n/locale-urls.ts` — `localePath`/`hreflangAlternates` に subpath 引数(後方互換)。
- `lib/i18n/locale-urls.test.ts`(無ければ新規) — subpath テスト。
- `components/marketing/LanguageMenu.tsx` — `subpath` prop 追加。
- `components/marketing/SiteHeader.tsx` — `subpath` prop を受けて `LanguageMenu` へ渡す(nav アイテムリンクはフラットのまま)。
- `app/(marketing)/layout.tsx` — static チャ―ム撤去 → pass-through。
- `app/(marketing)/{features,guide,faq,privacy,terms,contact}/page.tsx` と `app/(marketing)/extension/privacy/page.tsx` — `LegacyMarketingChrome` で包み見た目温存。
- `app/(marketing)/about/page.tsx` — provider + `MarketingShell` + `AboutContent` に作り直し。
- `app/sitemap.ts` — About の15言語エントリ追加。
- `app/sitemap.test.ts`(無ければ新規) — エントリ検証。
- `messages/*.json`(15) — `pages.about.*` 追加。
- `messages/pages-about-parity.test.ts`(新規) — 15言語キーパリティ。

---

## Task 1: `localePath`/`hreflangAlternates` を subpath 対応に一般化

**Files:**
- Modify: `lib/i18n/locale-urls.ts`
- Test: `lib/i18n/locale-urls.test.ts`(新規)

**Interfaces:**
- Produces:
  - `localePath(locale: SupportedLocale, subpath?: string): string` — subpath 無し=従来(`/` or `/ja`)、有り=`/features` or `/ja/features`。先頭スラッシュ無しの subpath を受ける。
  - `hreflangAlternates(subpath?: string): Record<string, string>` — `{ 'x-default': localePath('en', subpath), ja: localePath('ja', subpath), … }`。
  - `PREFIXED_LOCALES`(既存・不変)。

- [ ] **Step 1: 失敗するテストを書く**

`lib/i18n/locale-urls.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { localePath, hreflangAlternates, PREFIXED_LOCALES } from './locale-urls'

describe('localePath', () => {
  it('英語は subpath 無しで /', () => {
    expect(localePath('en')).toBe('/')
  })
  it('日本語は subpath 無しで /ja', () => {
    expect(localePath('ja')).toBe('/ja')
  })
  it('英語 + subpath はフラット /features', () => {
    expect(localePath('en', 'features')).toBe('/features')
  })
  it('日本語 + subpath は /ja/features', () => {
    expect(localePath('ja', 'features')).toBe('/ja/features')
  })
  it('2階層 subpath を保つ(en)', () => {
    expect(localePath('en', 'extension/privacy')).toBe('/extension/privacy')
  })
  it('2階層 subpath を保つ(zh)', () => {
    expect(localePath('zh', 'extension/privacy')).toBe('/zh/extension/privacy')
  })
})

describe('hreflangAlternates', () => {
  it('subpath 無しは LP マップ(x-default=/)', () => {
    const m = hreflangAlternates()
    expect(m['x-default']).toBe('/')
    expect(m.ja).toBe('/ja')
    expect(m.en).toBe('/')
  })
  it('subpath 有りは各ページのマップ(x-default=/about)', () => {
    const m = hreflangAlternates('about')
    expect(m['x-default']).toBe('/about')
    expect(m.en).toBe('/about')
    expect(m.ja).toBe('/ja/about')
  })
  it('15言語 + x-default の16エントリ', () => {
    expect(Object.keys(hreflangAlternates('about'))).toHaveLength(16)
  })
})

describe('PREFIXED_LOCALES', () => {
  it('en を含まない14言語', () => {
    expect(PREFIXED_LOCALES).toHaveLength(14)
    expect(PREFIXED_LOCALES).not.toContain('en')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `rtk vitest run lib/i18n/locale-urls.test.ts`
Expected: FAIL(`localePath('en','features')` が `/` を返す等、現行は subpath 未対応)

- [ ] **Step 3: 実装**

`lib/i18n/locale-urls.ts` を以下に置換:
```ts
import { SUPPORTED_LOCALES, type SupportedLocale } from './config'

/**
 * locale + 任意 subpath のパス。
 * 英語は素のルート(subpath 無し='/'、有り='/<subpath>')。
 * 他言語は '/<locale>' 接頭辞付き。subpath は先頭スラッシュ無しで渡す。
 */
export function localePath(locale: SupportedLocale, subpath?: string): string {
  const base = locale === 'en' ? '' : `/${locale}`
  if (!subpath) return base === '' ? '/' : base
  return `${base}/${subpath}`
}

/** URL 接頭辞が付く locale(英語以外)。generateStaticParams 用。 */
export const PREFIXED_LOCALES: readonly SupportedLocale[] = SUPPORTED_LOCALES.filter(
  (l) => l !== 'en',
)

/**
 * Next Metadata `alternates.languages` 用 hreflang マップ。
 * 15言語(hreflang コード)+ 'x-default' → 英語版。相対パス(metadataBase で解決)。
 * subpath を渡すと各ページ版(例 'about')のマップを返す。
 */
export function hreflangAlternates(subpath?: string): Record<string, string> {
  const map: Record<string, string> = { 'x-default': localePath('en', subpath) }
  for (const l of SUPPORTED_LOCALES) map[l] = localePath(l, subpath)
  return map
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run lib/i18n/locale-urls.test.ts`
Expected: PASS(全 12+ ケース)

- [ ] **Step 5: 既存 LP が壊れていないことを確認**

Run: `rtk vitest run lib/i18n` && `rtk tsc`
Expected: 既存テスト全 PASS、tsc 0(LP は subpath 無しで従来通り)

- [ ] **Step 6: Commit**

```bash
rtk git add lib/i18n/locale-urls.ts lib/i18n/locale-urls.test.ts
rtk git commit -m "feat(i18n): localePath/hreflangAlternates accept subpath (backward compatible)"
```

---

## Task 2: 汎用 `pageMetadata` ヘルパー

**Files:**
- Create: `lib/i18n/page-metadata.ts`
- Test: `lib/i18n/page-metadata.test.ts`

**Interfaces:**
- Consumes: `localePath`/`hreflangAlternates`(Task 1)、`STATIC_MESSAGES`(既存)、`translate`(既存)、`APP_NAME`(既存)。
- Produces: `pageMetadata(locale: SupportedLocale, pageKey: string, subpath: string): Metadata` — `pages.<pageKey>.meta.title`/`.description` を引き、`title.absolute`(`AllMarks — <title>`)、`description`、`alternates.canonical = localePath(locale, subpath)`、`alternates.languages = hreflangAlternates(subpath)`、`openGraph` を返す。`meta` 欠損時は `translate` がキー文字列を返すので、最低限 title に `APP_NAME` を確保する。

- [ ] **Step 1: 失敗するテストを書く**

`lib/i18n/page-metadata.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { pageMetadata } from './page-metadata'

describe('pageMetadata', () => {
  it('canonical は自分自身(ja/about → /ja/about)', () => {
    const m = pageMetadata('ja', 'about', 'about')
    expect(m.alternates?.canonical).toBe('/ja/about')
  })
  it('canonical は英語フラット(en/about → /about)', () => {
    const m = pageMetadata('en', 'about', 'about')
    expect(m.alternates?.canonical).toBe('/about')
  })
  it('hreflang は16エントリ', () => {
    const m = pageMetadata('en', 'about', 'about')
    expect(Object.keys(m.alternates?.languages ?? {})).toHaveLength(16)
  })
  it('title は AllMarks を含む', () => {
    const m = pageMetadata('en', 'about', 'about')
    const title = (m.title as { absolute: string }).absolute
    expect(title).toContain('AllMarks')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `rtk vitest run lib/i18n/page-metadata.test.ts`
Expected: FAIL(`pageMetadata` 未定義)

- [ ] **Step 3: 実装**

`lib/i18n/page-metadata.ts`:
```ts
import type { Metadata } from 'next'
import { APP_NAME } from '@/lib/constants'
import { type SupportedLocale } from './config'
import { STATIC_MESSAGES } from './static-messages'
import { translate } from './translate'
import { localePath, hreflangAlternates } from './locale-urls'

/** hreflang コード → OpenGraph locale(xx_XX)。 */
const OG_LOCALE: Partial<Record<SupportedLocale, string>> = {
  ja: 'ja_JP', en: 'en_US', zh: 'zh_CN', ko: 'ko_KR', es: 'es_ES',
  fr: 'fr_FR', de: 'de_DE', pt: 'pt_BR', it: 'it_IT', nl: 'nl_NL',
  tr: 'tr_TR', ru: 'ru_RU', ar: 'ar_AR', th: 'th_TH', vi: 'vi_VN',
}

/**
 * 紹介ページ汎用メタデータ。pages.<pageKey>.meta.title/description を各言語で引き、
 * title=`AllMarks — <title>`、自己 canonical、hreflang(15言語+x-default)、OG を返す。
 */
export function pageMetadata(
  locale: SupportedLocale,
  pageKey: string,
  subpath: string,
): Metadata {
  const msgs = STATIC_MESSAGES[locale]
  const rawTitle = translate(msgs, `pages.${pageKey}.meta.title`)
  const rawDesc = translate(msgs, `pages.${pageKey}.meta.description`)
  // translate は欠損時にキー文字列を返す。その場合はブランド名のみ。
  const titleText = rawTitle.startsWith('pages.') ? APP_NAME : `${APP_NAME} — ${rawTitle}`
  const description = rawDesc.startsWith('pages.') ? '' : rawDesc
  return {
    title: { absolute: titleText },
    description,
    alternates: {
      canonical: localePath(locale, subpath),
      languages: hreflangAlternates(subpath),
    },
    openGraph: {
      title: titleText,
      description,
      locale: OG_LOCALE[locale] ?? 'en_US',
    },
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run lib/i18n/page-metadata.test.ts`
Expected: PASS(4ケース。`pages.about.meta` はまだ無いので title はブランドのみ = `AllMarks` を含む → PASS)

- [ ] **Step 5: Commit**

```bash
rtk git add lib/i18n/page-metadata.ts lib/i18n/page-metadata.test.ts
rtk git commit -m "feat(i18n): generic pageMetadata helper for intro pages"
```

---

## Task 3: 旧 static チャ―ムを `LegacyMarketingChrome` に抽出し未移行ページを温存

**Files:**
- Create: `components/marketing/LegacyMarketingChrome.tsx`
- Modify: `app/(marketing)/layout.tsx`
- Modify: `app/(marketing)/{features,guide,faq,privacy,terms,contact}/page.tsx`、`app/(marketing)/extension/privacy/page.tsx`

**Interfaces:**
- Produces: `LegacyMarketingChrome({ children }): React.ReactElement` — 現 `app/(marketing)/layout.tsx` と**同一の** static-header/static-main/static-footer を描画(見た目ゼロ変化)。

**狙い**: layout から chrome を外すと About を `MarketingShell` で作り直しても二重ヘッダーにならない。未移行7ページは `LegacyMarketingChrome` で包んで現状維持。

- [ ] **Step 1: `LegacyMarketingChrome` を作る(現 layout の中身をそのまま移植)**

`components/marketing/LegacyMarketingChrome.tsx`:
```tsx
import Link from 'next/link'
import { ThemeToggle } from '@/components/marketing/ThemeToggle'

/**
 * 旧 static 紹介ページ用チャ―ム(features/guide/faq/privacy/terms/contact/extension-privacy)。
 * フェーズ B/C で各ページを MarketingShell に置換するまでの過渡的な見た目温存ラッパ。
 * 旧 app/(marketing)/layout.tsx と同一の DOM/クラスで、視覚変化ゼロ。
 */
export function LegacyMarketingChrome({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="static-page">
      <header className="static-header">
        <Link href="/" className="static-logo">AllMarks</Link>
        <nav className="static-nav">
          <Link href="/features">Features</Link>
          <Link href="/guide">Guide</Link>
          <Link href="/about">About</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
          <ThemeToggle />
        </nav>
      </header>
      <main className="static-main">
        {children}
      </main>
      <footer className="static-footer">
        <p>&copy; 2026 AllMarks. All rights reserved.</p>
        <nav>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: `app/(marketing)/layout.tsx` を pass-through に**

```tsx
/**
 * (marketing) ルートグループ layout。
 * チャ―ムは各ページが LegacyMarketingChrome(旧) or MarketingShell(新)で自前描画する。
 * よって layout は子をそのまま通すだけ(二重ヘッダー回避)。
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return <>{children}</>
}
```

- [ ] **Step 3: 未移行7ページを `LegacyMarketingChrome` で包む**

各ファイル(`features/guide/faq/privacy/terms/contact/page.tsx` と `extension/privacy/page.tsx`)で、`export default function XxxPage()` の `return (<> … </>)` を `LegacyMarketingChrome` で包む。例(`features/page.tsx`):
```tsx
import { LegacyMarketingChrome } from '@/components/marketing/LegacyMarketingChrome'
// metadata は据え置き
export default function FeaturesPage(): React.ReactElement {
  return (
    <LegacyMarketingChrome>
      {/* 既存の <h1>…</h1> 以下の中身をそのまま */}
    </LegacyMarketingChrome>
  )
}
```
※ `about/page.tsx` は Task 7 で別途作り直すので**ここでは触らない**(現状の static のまま一時残置)。

- [ ] **Step 4: ビルドで視覚温存と健全性を確認**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0、build 成功。`out/features.html` 等が生成される。

- [ ] **Step 5: ローカルで旧ページの見た目が変わっていないことを目視(任意・playwright)**

Run: `npx -y wrangler@latest pages dev out` で `/features` を開き、ヘッダー/フッターが従来通りか確認。
Expected: 旧 static チャ―ムが従来と同一表示。

- [ ] **Step 6: Commit**

```bash
rtk git add components/marketing/LegacyMarketingChrome.tsx "app/(marketing)"
rtk git commit -m "refactor(marketing): extract legacy chrome, gut layout to pass-through (no visual change)"
```

---

## Task 4: `LanguageMenu` を subpath 対応に

**Files:**
- Modify: `components/marketing/LanguageMenu.tsx`

**Interfaces:**
- Consumes: `localePath(locale, subpath)`(Task 1)。
- Produces: `LanguageMenu({ current, subpath }: { current: SupportedLocale; subpath?: string })` — 言語選択時 `router.push(localePath(locale, subpath))`。`subpath` 省略時は従来(LP)動作。

- [ ] **Step 1: `choose` を subpath 対応に**

`components/marketing/LanguageMenu.tsx` の関数シグネチャと `choose` を変更:
```tsx
export function LanguageMenu({
  current,
  subpath,
}: {
  current: SupportedLocale
  subpath?: string
}): React.ReactElement {
  // …(useRouter/useState/useRef/useEffect は不変)…
  const choose = (locale: SupportedLocale): void => {
    setOpen(false)
    if (locale !== current) {
      persistLocale(locale)
      router.push(localePath(locale, subpath))
    }
  }
  // …(JSX は不変)…
}
```

- [ ] **Step 2: tsc と既存テストを確認**

Run: `rtk tsc && rtk vitest run`
Expected: tsc 0(`subpath` は任意なので LP の `<LanguageMenu current={locale} />` 呼び出しはそのまま有効)、既存テスト全 PASS。

- [ ] **Step 3: Commit**

```bash
rtk git add components/marketing/LanguageMenu.tsx
rtk git commit -m "feat(marketing): LanguageMenu navigates to same page in another language (subpath)"
```

---

## Task 5: `SiteHeader` に `subpath` を通す + `MarketingShell` を作る

**Files:**
- Modify: `components/marketing/SiteHeader.tsx`
- Create: `components/marketing/MarketingShell.tsx`

**Interfaces:**
- Consumes: `SiteHeader`(改修)、`SiteFooter`(既存・不変)、`localePath`、LP の `landing-tokens.css`。
- Produces:
  - `SiteHeader({ locale, subpath }: { locale: SupportedLocale; subpath?: string })` — `subpath` を `LanguageMenu` に渡す。**nav アイテムリンク(Features/Guide/FAQ/Contact)はフラットのまま**(404 回避・Global Constraints)。
  - `MarketingShell({ locale, subpath, children }: { locale: SupportedLocale; subpath?: string; children: React.ReactNode })` — `lpRoot` + `SiteHeader` + children + `SiteFooter`、mount 中 `<html lang>`/`data-theme=light` を設定し離脱で復元。

- [ ] **Step 1: `SiteHeader` に `subpath` を追加**

`components/marketing/SiteHeader.tsx`:
```tsx
export function SiteHeader({
  locale,
  subpath,
}: {
  locale: SupportedLocale
  subpath?: string
}): React.ReactElement {
  // …(useRef/useEffect スクロール処理は不変)…
  // nav の <LanguageMenu current={locale} /> を:
  //   <LanguageMenu current={locale} subpath={subpath} />
  // に変更。NAV_ITEMS のフラットリンクは不変(Phase C で言語化)。
}
```
※ LP は `<SiteHeader locale={locale} />`(subpath 無し=従来動作)で不変。

- [ ] **Step 2: `MarketingShell` を作る**

`components/marketing/MarketingShell.tsx`:
```tsx
'use client'

import { useEffect } from 'react'
import type { SupportedLocale } from '@/lib/i18n/config'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import './landing-tokens.css'
import styles from './MarketingShell.module.css'

/**
 * 紹介ページ共有シェル(LP と同じ編集的トーン)。
 * - lpRoot + SiteHeader(上部透明→スクロールで半透明) + 本文 + SiteFooter(黒)。
 * - mount 中 <html lang>=locale, data-theme=light(ダーク強制対策、LP と同パターン)。
 * - スクロール演出(pin/scrub)は持たない。本文側で use-reveal を任意使用。
 */
export function MarketingShell({
  locale,
  subpath,
  children,
}: {
  locale: SupportedLocale
  subpath?: string
  children: React.ReactNode
}): React.ReactElement {
  useEffect(() => {
    const html = document.documentElement
    const prevTheme = html.getAttribute('data-theme')
    const prevLang = html.getAttribute('lang')
    html.setAttribute('data-theme', 'light')
    html.setAttribute('lang', locale)
    return () => {
      html.setAttribute('data-theme', prevTheme ?? 'dark')
      html.setAttribute('lang', prevLang ?? 'en')
    }
  }, [locale])

  return (
    <div className={`${styles.wrapper} lpRoot`}>
      <SiteHeader locale={locale} subpath={subpath} />
      <main className={styles.main}>{children}</main>
      <SiteFooter />
    </div>
  )
}
```

- [ ] **Step 3: `MarketingShell.module.css` を作る(最小)**

`components/marketing/MarketingShell.module.css`:
```css
.wrapper {
  min-height: 100vh;
  background: var(--lp-paper, #faf9f6);
  color: var(--lp-ink, #1a1a1a);
}
/* SiteHeader は fixed。本文がヘッダー下に潜らないよう余白。実値は実機調整。 */
.main {
  padding-top: clamp(72px, 8vw, 96px);
}
```

- [ ] **Step 4: tsc と既存テスト**

Run: `rtk tsc && rtk vitest run`
Expected: tsc 0、既存全 PASS。

- [ ] **Step 5: Commit**

```bash
rtk git add components/marketing/SiteHeader.tsx components/marketing/MarketingShell.tsx components/marketing/MarketingShell.module.css
rtk git commit -m "feat(marketing): MarketingShell editorial chrome + SiteHeader subpath passthrough"
```

---

## Task 6: About の英語/日本語コピー(`pages.about.*`)を作成

**Files:**
- Modify: `messages/en.json`、`messages/ja.json`

**Interfaces:**
- Produces: `pages.about.*` キー構造(以後13言語がこれに一致)。leaf key:
  - `pages.about.meta.title`、`pages.about.meta.description`
  - `pages.about.hero.kicker`、`pages.about.hero.title`、`pages.about.hero.lead`
  - `pages.about.philosophy.heading`、`pages.about.philosophy.body`
  - `pages.about.privacy.heading`、`pages.about.privacy.body`
  - `pages.about.openSource.heading`、`pages.about.openSource.body`
  - `pages.about.cta.heading`、`pages.about.cta.button`(= `Open Board` verbatim、全言語固定)

**内容方針(spec §6.3)**: 「整理でなく表現」哲学、プライバシーファースト、オープンソース。**個人の身元は出さない**。GitHub リンクは本文に出さず `openSource.body` 内テキストのみ(URL はコンポーネント側で `allmarks` リポを指す)。

- [ ] **Step 1: `en.json` に `pages` ブロックを追加**

`messages/en.json` のトップレベルに `"pages": { "about": { … } }` を追加(既存 `landing` の隣)。値(英語・確定コピー):
```json
"pages": {
  "about": {
    "meta": {
      "title": "About",
      "description": "AllMarks turns your bookmarks into a visual collage. Private by design — your data stays in your browser. Free, no account."
    },
    "hero": {
      "kicker": "About",
      "title": "Bookmarks, made to be seen.",
      "lead": "AllMarks is a place to keep the things you love from across the web — and actually enjoy looking at them."
    },
    "philosophy": {
      "heading": "Express, don't file",
      "body": "Most bookmarks vanish into a list you never open again. AllMarks treats them as something to arrange, revisit, and share — a visual board, not a folder."
    },
    "privacy": {
      "heading": "Private by design",
      "body": "Your bookmarks live in your browser, not on our servers. No account, no tracking, no sign-up. It's free, and it stays yours."
    },
    "openSource": {
      "heading": "Open source",
      "body": "AllMarks is open source. Anyone can read the code and confirm that nothing is sent anywhere it shouldn't be."
    },
    "cta": {
      "heading": "Start your board.",
      "button": "Open Board"
    }
  }
}
```

- [ ] **Step 2: `ja.json` に同じキー構造で日本語コピーを追加**

```json
"pages": {
  "about": {
    "meta": {
      "title": "About",
      "description": "AllMarks はブックマークをビジュアルなコラージュにします。データはあなたのブラウザの中だけ。アカウント不要・無料。"
    },
    "hero": {
      "kicker": "About",
      "title": "ブックマークを、眺めて楽しいものに。",
      "lead": "Web で見つけたお気に入りを集めて、ただのリストではなく「見て楽しい場所」にする — それが AllMarks です。"
    },
    "philosophy": {
      "heading": "整理ではなく、表現",
      "body": "ブックマークは二度と開かないリストに埋もれがち。AllMarks はそれを並べて・見返して・共有するもの = フォルダではなくビジュアルボードとして扱います。"
    },
    "privacy": {
      "heading": "最初からプライベート",
      "body": "ブックマークはサーバーではなくあなたのブラウザの中に保存されます。アカウントも追跡も登録も不要。無料で、ずっとあなたのものです。"
    },
    "openSource": {
      "heading": "オープンソース",
      "body": "AllMarks はオープンソースです。誰でもコードを読んで、データが余計な場所に送られていないことを確認できます。"
    },
    "cta": {
      "heading": "あなたのボードを始めよう。",
      "button": "Open Board"
    }
  }
}
```

- [ ] **Step 3: JSON が壊れていないか確認**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/ja.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
rtk git add messages/en.json messages/ja.json
rtk git commit -m "i18n(pages): about copy in en + ja (express-not-file, privacy-first)"
```

---

## Task 7: `AboutContent` 部品 + 英語 `/about` を作り直し

**Files:**
- Create: `components/marketing/pages/AboutContent.tsx`
- Create: `components/marketing/pages/AboutContent.module.css`
- Modify: `app/(marketing)/about/page.tsx`

**Interfaces:**
- Consumes: `useI18n()`(`t('pages.about.*')`)、`MarketingShell`(Task 5)、`I18nProvider`、`STATIC_MESSAGES`、`pageMetadata`(Task 2)。
- Produces: `AboutContent(): React.ReactElement`(client、本文のみ。シェルはラッパ側で巻く)。

- [ ] **Step 1: `AboutContent` を作る**

`components/marketing/pages/AboutContent.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nProvider'
import styles from './AboutContent.module.css'

const GITHUB_URL = 'https://github.com/masaya-men/allmarks'

/**
 * About 本文(編集的トーン)。番号なしの落ち着いたセクション群。
 * 文章は pages.about.* から。GitHub URL は allmarks リポ(偽メタデータ無し)。
 * 可視性はアニメ非依存(CSS 既定で全要素可視)。
 */
export function AboutContent(): React.ReactElement {
  const { t } = useI18n()
  return (
    <article className={styles.root}>
      <header className={styles.hero}>
        <p className={styles.kicker}>{t('pages.about.hero.kicker')}</p>
        <h1 className={styles.title}>{t('pages.about.hero.title')}</h1>
        <p className={styles.lead}>{t('pages.about.hero.lead')}</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.about.philosophy.heading')}</h2>
        <p className={styles.body}>{t('pages.about.philosophy.body')}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.about.privacy.heading')}</h2>
        <p className={styles.body}>{t('pages.about.privacy.body')}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('pages.about.openSource.heading')}</h2>
        <p className={styles.body}>
          {t('pages.about.openSource.body')}{' '}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>
            GitHub
          </a>
        </p>
      </section>

      <section className={styles.cta}>
        <h2 className={styles.ctaHeading}>{t('pages.about.cta.heading')}</h2>
        <Link href="/board" className={styles.ctaButton}>
          {t('pages.about.cta.button')}
          <span aria-hidden="true"> ↗</span>
        </Link>
      </section>
    </article>
  )
}
```

- [ ] **Step 2: `AboutContent.module.css`(最小・編集的。実値は本番で調整)**

```css
.root { max-width: 720px; margin: 0 auto; padding: clamp(24px, 6vw, 80px) 24px clamp(64px, 10vw, 140px); }
.hero { margin-bottom: clamp(40px, 8vw, 96px); }
.kicker { font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.55; margin: 0 0 16px; }
.title { font-family: var(--lp-font-serif, 'Fraunces', serif); font-size: clamp(34px, 6vw, 64px); line-height: 1.05; margin: 0 0 24px; }
.lead { font-size: clamp(18px, 2.4vw, 24px); line-height: 1.5; opacity: 0.8; margin: 0; }
.section { margin-bottom: clamp(36px, 6vw, 72px); }
.heading { font-family: var(--lp-font-serif, 'Fraunces', serif); font-size: clamp(22px, 3vw, 32px); margin: 0 0 16px; }
.body { font-size: clamp(16px, 1.8vw, 19px); line-height: 1.7; opacity: 0.82; margin: 0; }
.link { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
.cta { margin-top: clamp(56px, 9vw, 120px); text-align: center; }
.ctaHeading { font-family: var(--lp-font-serif, 'Fraunces', serif); font-size: clamp(26px, 4vw, 44px); margin: 0 0 28px; }
.ctaButton { display: inline-block; padding: 16px 32px; background: #111; color: #fff; border-radius: 999px; font-size: 17px; text-decoration: none; }
```

- [ ] **Step 3: 英語 `/about` を作り直し**

`app/(marketing)/about/page.tsx`:
```tsx
import type { Metadata } from 'next'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { AboutContent } from '@/components/marketing/pages/AboutContent'
import { pageMetadata } from '@/lib/i18n/page-metadata'

export function generateMetadata(): Metadata {
  return pageMetadata('en', 'about', 'about')
}

export default function AboutPage(): React.ReactElement {
  return (
    <I18nProvider initialLocale="en" initialMessages={en as Messages}>
      <MarketingShell locale="en" subpath="about">
        <AboutContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 4: tsc + build で英語 About を確認**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0、build 成功、`out/about.html` 生成。`<title>` に `AllMarks — About`、`<link rel="canonical" href=".../about">`、hreflang 16本が焼き込まれている(grep で確認可)。

- [ ] **Step 5: Commit**

```bash
rtk git add components/marketing/pages/AboutContent.tsx components/marketing/pages/AboutContent.module.css "app/(marketing)/about/page.tsx"
rtk git commit -m "feat(about): rebuild English /about with editorial MarketingShell"
```

---

## Task 8: `app/[locale]/about/page.tsx`(14言語)

**Files:**
- Create: `app/[locale]/about/page.tsx`

**Interfaces:**
- Consumes: `STATIC_MESSAGES`、`PREFIXED_LOCALES`、`pageMetadata`、`MarketingShell`、`AboutContent`、`I18nProvider`、`SUPPORTED_LOCALES`。
- Produces: 14言語の静的 About ページ(`/ja/about` 等)。`app/[locale]/page.tsx`(LP)と同じガード。

- [ ] **Step 1: 作成**

`app/[locale]/about/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { AboutContent } from '@/components/marketing/pages/AboutContent'
import { STATIC_MESSAGES } from '@/lib/i18n/static-messages'
import { PREFIXED_LOCALES } from '@/lib/i18n/locale-urls'
import { pageMetadata } from '@/lib/i18n/page-metadata'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n/config'

export const dynamicParams = false

export function generateStaticParams(): Array<{ locale: string }> {
  return PREFIXED_LOCALES.map((locale) => ({ locale }))
}

function isPrefixedLocale(value: string): value is SupportedLocale {
  return value !== 'en' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) return {}
  return pageMetadata(locale, 'about', 'about')
}

export default async function LocaleAbout({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  if (!isPrefixedLocale(locale)) notFound()
  return (
    <I18nProvider initialLocale={locale} initialMessages={STATIC_MESSAGES[locale]}>
      <MarketingShell locale={locale} subpath="about">
        <AboutContent />
      </MarketingShell>
    </I18nProvider>
  )
}
```

- [ ] **Step 2: build で14ルート生成を確認**

Run: `rtk pnpm build`
Expected: build 成功、`out/ja/about.html` … `out/vi/about.html`(14本)生成。`/ja/about.html` の `<title>` が日本語(`AllMarks — <ja meta.title>`)、canonical=`/ja/about`。

- [ ] **Step 3: Commit**

```bash
rtk git add "app/[locale]/about/page.tsx"
rtk git commit -m "feat(about): localized /<locale>/about for 14 languages (static)"
```

---

## Task 9: About を13言語へ翻訳 + キーパリティテスト

**Files:**
- Modify: `messages/{ar,de,es,fr,it,ko,nl,pt,ru,th,tr,vi,zh}.json`
- Create: `messages/pages-about-parity.test.ts`

**Interfaces:**
- Consumes: en.json の `pages.about.*`(Task 6 = 基準構造)。
- Produces: 15言語すべてに同一キー構造の `pages.about.*`。

- [ ] **Step 1: キーパリティテストを先に書く(失敗する)**

`messages/pages-about-parity.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'

function leafKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  )
}

describe('pages.about 15言語キーパリティ', () => {
  const base = require('./en.json').pages.about
  const baseKeys = leafKeys(base).sort()

  for (const locale of SUPPORTED_LOCALES) {
    it(`${locale} は en と同一 leaf key を持つ`, () => {
      const msgs = require(`./${locale}.json`)
      expect(msgs.pages?.about, `${locale} に pages.about が無い`).toBeDefined()
      expect(leafKeys(msgs.pages.about).sort()).toEqual(baseKeys)
    })
    it(`${locale} の cta.button は "Open Board" verbatim`, () => {
      const msgs = require(`./${locale}.json`)
      expect(msgs.pages.about.cta.button).toBe('Open Board')
    })
  }
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `rtk vitest run messages/pages-about-parity.test.ts`
Expected: FAIL(13言語に `pages.about` が無い)

- [ ] **Step 3: 13言語へ翻訳(並列サブエージェント)**

各言語ファイル(ar/de/es/fr/it/ko/nl/pt/ru/th/tr/vi/zh)に `pages.about.*` を en.json 基準で追加。**サブエージェント駆動**で並列実行(executing 側が dispatch)。各サブエージェントへの指示:
- en.json の `pages.about` を該当言語へ自然に翻訳。キー構造は完全一致。
- **verbatim 固定**: `cta.button` = `Open Board`(翻訳しない)。`meta.title` は "About" 相当の自然な語(言語により訳す)。
- ブランド名 `AllMarks` は不変。トーンは LP の `landing.*` 訳に合わせる。
- JSON 妥当性を保つ(末尾カンマ等に注意)。

- [ ] **Step 4: キーパリティ + JSON 妥当性を確認**

Run: `rtk vitest run messages/pages-about-parity.test.ts`
Expected: PASS(15言語 × 2 アサーション)

- [ ] **Step 5: 全テスト + tsc + build**

Run: `rtk vitest run && rtk tsc && rtk pnpm build`
Expected: 全 PASS、tsc 0、build 成功。`out/zh/about.html` 等が中国語等で焼き込み。

- [ ] **Step 6: Commit**

```bash
rtk git add messages/ messages/pages-about-parity.test.ts
rtk git commit -m "i18n(pages): translate about to 13 languages + key-parity test"
```

---

## Task 10: sitemap に About の15言語エントリを追加

**Files:**
- Modify: `app/sitemap.ts`
- Test: `app/sitemap.test.ts`(新規)

**Interfaces:**
- Consumes: `localePath(locale, subpath)`、`PREFIXED_LOCALES`、`SUPPORTED_LOCALES`。
- Produces: sitemap に `/about` + `/ja/about` … `/vi/about`(15本)を追加。

- [ ] **Step 1: 失敗するテストを書く**

`app/sitemap.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import sitemap from './sitemap'
import { SITE_URL } from '@/lib/constants'

describe('sitemap', () => {
  const entries = sitemap()
  const urls = entries.map((e) => e.url)

  it('英語 About を含む', () => {
    expect(urls).toContain(`${SITE_URL}/about`)
  })
  it('日本語 About を含む', () => {
    expect(urls).toContain(`${SITE_URL}/ja/about`)
  })
  it('About は15言語ぶん存在する', () => {
    const aboutUrls = urls.filter((u) => u.endsWith('/about'))
    expect(aboutUrls).toHaveLength(15)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `rtk vitest run app/sitemap.test.ts`
Expected: FAIL(`/ja/about` 未登録、About は1本のみ)

- [ ] **Step 3: 実装**

`app/sitemap.ts` の routes 配列に About の言語別エントリを追加(既存の単独 `/about` 行は削除し、下記に置換):
```ts
import { PREFIXED_LOCALES, localePath } from '@/lib/i18n/locale-urls'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'
// …routes 配列内、既存 { path: '/about', … } を削除して以下を追加:
    // About(15言語)
    ...SUPPORTED_LOCALES.map((locale) => ({
      path: localePath(locale, 'about'),
      priority: 0.7,
      changeFrequency: 'monthly' as const,
    })),
```
※ `localePath('en','about')` = `/about` なので英語フラットも含まれる。`PREFIXED_LOCALES` import は既存。`SUPPORTED_LOCALES` import を追加。

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run app/sitemap.test.ts`
Expected: PASS(3ケース)

- [ ] **Step 5: Commit**

```bash
rtk git add app/sitemap.ts app/sitemap.test.ts
rtk git commit -m "feat(seo): sitemap entries for about in 15 languages"
```

---

## Task 11: 通し検証 + 本番デプロイ + 実機 calibration

**Files:** なし(検証 + デプロイ)

- [ ] **Step 1: 全テスト + tsc + build**

Run: `rtk vitest run && rtk tsc && rtk pnpm build`
Expected: vitest 全 PASS(新規含む)、tsc 0、build 成功。ルート数が About 分 +14(英語 /about は既存改修)増。

- [ ] **Step 2: 旧語が About に残っていないか grep**

Run: `rtk grep "booklage" components/marketing/pages app/\[locale\]/about` と `rtk grep "フォルダ" messages/ja.json`(about ブロック周辺)
Expected: About 関連に旧リポ名 `booklage` 無し(GITHUB_URL は `allmarks`)。※ ja の philosophy は「フォルダではなく」と意図的に対比で使用 = 許容。

- [ ] **Step 3: 本番デプロイ**

Run:
```bash
npx wrangler whoami
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message "deploy: intro pages phase A (about i18n foundation)"
```
Expected: deploy 成功、`allmarks.app` 反映。

- [ ] **Step 4: 本番実機 calibration(ユーザーと)**

確認項目:
- `allmarks.app/about`(英語・新編集デザイン)/ `allmarks.app/ja/about`(日本語)/ 数言語が正しい言語で開く。
- ヘッダーの言語メニューで `/about` ↔ `/ja/about` ↔ `/zh/about` と**同一ページの別言語**へ移動できる。
- `curl -s https://allmarks.app/ja/about | grep -E 'hreflang|canonical'` で hreflang 16本・canonical=`/ja/about` を確認。
- 旧ページ(`/features` 等)が従来の見た目のまま壊れていない(LegacyMarketingChrome 温存)。
- reduced-motion/モバイル幅で About が必ず可視。
- **見た目の細部(余白・タイポ・CTA)をユーザーと調整**(`.claude/rules/ui-design.md` 承認フロー。値は実機で詰める)。

- [ ] **Step 5: ドキュメント更新 + Commit(セッション末)**

`docs/TODO.md`「現在の状態」更新、`docs/CURRENT_GOAL.md` を次(フェーズB)用に上書き、`docs/TODO_COMPLETED.md` に narrative 追記。
```bash
rtk git add docs/
rtk git commit -m "docs: intro pages phase A (about i18n foundation) shipped"
```

---

## Self-Review

**1. Spec coverage(spec §ごと):**
- §3 URL/ルーティング → Task 1(localePath)、Task 8([locale]/about)、Task 7(英語フラット)。✓
- §4.1 ヘッダー/フッター一本化 → Task 3(layout 撤去)、Task 5(MarketingShell)。✓(未移行ページは LegacyMarketingChrome で温存、B/C で置換)
- §4.2 ナビ言語対応 → LanguageMenu は Task 4 ✓。**nav アイテムリンクの接頭辞化は Phase C に意図的に繰延**(404 回避、Global Constraints 明記)。
- §4.3 lang/light → Task 5(MarketingShell の effect)。✓
- §5 デザイン言語 → Task 7(AboutContent 編集トーン、CSS 最小・実機調整)。✓(B/C で各ページ展開)
- §6 内容書き直し → Task 6(About コピー、整理でなく表現/プライバシー/OSS、身元出さない)。✓(他ページは B/C)
- §7 多言語の仕組み → Task 1/2(ヘルパー)、Task 6/9(pages.* 翻訳)、Task 5(シェル)。✓
- §11 テスト → Task 1/2/9/10 に単体、Task 11 にビルド/本番。✓
- §12 フェーズ → 本プラン = フェーズA(About 縦切り実証)。B/C は後続プラン。✓

**2. Placeholder scan:** 各 Step に実コード/実コマンド/期待値あり。翻訳13言語(Task 9 Step 3)はサブエージェント指示を明記(プラン上は en 基準 + verbatim ルールで一意)。プレースホルダ無し。✓

**3. Type consistency:** `localePath(locale, subpath?)`・`hreflangAlternates(subpath?)`・`pageMetadata(locale, pageKey, subpath)`・`MarketingShell({locale, subpath, children})`・`SiteHeader({locale, subpath?})`・`LanguageMenu({current, subpath?})`・`AboutContent()` — 全 Task で呼び出しシグネチャ一致。✓

**未カバーで意図的に後続(B/C)送り**: features/guide/faq/extension紹介/privacy/terms/contact/extension-privacy の内容書き直し・デザイン・翻訳、SiteHeader nav リンクの言語接頭辞化、案内バー(LP のみ既存・紹介ページ非対象)。

---

## Execution Handoff

フェーズA(土台 + About 縦切り)の実装計画です。完了すると: 紹介ページ群の言語別URL/SEO/共有シェルの土台が完成し、About が15言語の専用URLで稼働、既存ページは見た目ゼロ変化で温存されます。フェーズB(集客4ページ)・C(法務4ページ + nav 言語化)は本土台に乗せる後続プラン。
