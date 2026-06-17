# LP 多言語化(層②)第1段 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** トップLP(`/`)を15言語の言語別URL(`/`=英語 + `/ja` `/zh`…)で静的に作り置きし、検索対策(hreflang/canonical/言語別sitemap)・ヘッダー言語切替・母国語案内バーを実装する。

**Architecture:** 既存 `I18nProvider` の「URL固定モード」(`initialLocale`+`initialMessages`)を再利用。`/` は `app/page.tsx`(英語)、残り14言語は `app/[locale]/page.tsx` を `generateStaticParams` で全prerender。SEO メタは Next Metadata API で静的HTMLの `<head>` に焼き込む。言語切替=URL移動、案内バーはクライアント判定。

**Tech Stack:** Next.js 14 App Router(`output: 'export'`)、TypeScript strict、vitest + @testing-library/react、Vanilla CSS Modules。翻訳は `messages/*.json`(15言語)。

## Global Constraints

- TypeScript `strict: true`、`any` 禁止(`unknown`+型ガード)、return type 明示。
- アニメは GSAP + CSS keyframes のみ(Framer Motion 禁止)。スタイルは Vanilla CSS Modules(Tailwind 禁止)。
- 触らない不変符号: `DB_NAME='booklage-db'`・`booklage:*` メッセージ型・CSS クラス名等の内部符号・ブックマークレット保存先URL。
- アプリ本体(`/board` `/triage` `/s/*` `/save` `/save-iframe`)の URL に**言語接頭辞を付けない**。
- 翻訳の全言語 verbatim 保持: 固定英語語彙・placeholder `{current}/{total}`・絵文字・キーコンボ・`#AllMarks`・ブランド名 `AllMarks`。
- 対応15言語(`lib/i18n/config.ts` の `SUPPORTED_LOCALES`): `ja en zh ko es fr de pt it nl tr ru ar th vi`。英語=`/`、残り14が接頭辞付き。
- git/test/build は `rtk` 前置(例 `rtk vitest run ...`、`rtk tsc`、`rtk pnpm build`)。本番URL=`allmarks.app`、deploy は `--project-name=allmarks --branch=master`、commit message は ASCII。
- 既存 vitest(現1043 pass)を壊さない・`rtk tsc` 0。

---

## ファイル構成(新規・改修)

**新規:**
- `lib/i18n/locale-urls.ts` — locale→LP path / 接頭辞locale一覧 / hreflang alternates(純粋関数)
- `lib/i18n/static-messages.ts` — 15言語 JSON を静的 import した `STATIC_MESSAGES` マップ(server component 専用)
- `app/[locale]/page.tsx` — 14言語の LP を prerender(server)
- `components/marketing/LanguageMenu.tsx` + `.module.css` — LPヘッダー言語切替(endonym・URL移動)
- `components/marketing/LocaleSuggestBanner.tsx` + `.module.css` — 母国語案内バー

**改修:**
- `messages/{ar,de,es,fr,it,ko,nl,pt,ru,th,tr,vi,zh}.json` — `landing.*` ブロック追加(13言語)
- `app/page.tsx` — 英語 provider 巻き + `generateMetadata`(hreflang/canonical)
- `app/layout.tsx` — `<html lang="ja">` → `lang="en"`
- `components/marketing/LandingPage.tsx` — `locale` prop 受け取り + `document.documentElement.lang` 設定
- `components/marketing/SiteHeader.tsx` — `LanguageMenu` 設置(`locale` prop 経由)
- `app/sitemap.ts` — トップLPの15言語URL + alternates

---

## Task 1: 13言語へ `landing.*` を翻訳 + 構造パリティテスト

英語(`en.json`)を基準に、`landing.*` ブロックを13言語へ翻訳して追加する。日本語(`ja.json`)は既存(人手品質)・英語は基準なので対象外。看板の文章=ブランドの顔のため、品質チェック工程を含める。

**Files:**
- Modify: `messages/ar.json` `messages/de.json` `messages/es.json` `messages/fr.json` `messages/it.json` `messages/ko.json` `messages/nl.json` `messages/pt.json` `messages/ru.json` `messages/th.json` `messages/tr.json` `messages/vi.json` `messages/zh.json`(各ファイルのトップレベルに `landing` キーを追加)
- Test: `messages/landing-parity.test.ts`(新規)

**Interfaces:**
- Produces: 15言語すべてが同一の `landing.*` leaf キー構造を持つ。後続タスク(static-messages / 各ページ)が全言語で文章を引けることを保証。

**翻訳元(en.json の `landing` ブロック leaf キー全28個):**

```
landing.hero.label            = "Visual Bookmark Manager"
landing.hero.headline         = "Turn links into a visual board."
landing.hero.description      = "Save videos, social posts, articles, and images in one click, then arrange them freely. Turn a plain list of text into an inspiration board you grasp at a glance. No sign-up, completely free."
landing.hero.ctaPrimary       = "Open the board"
landing.hero.ctaGhost         = "See how it works"
landing.hero.scrollHint       = "scroll"
landing.problem.headline      = "You pile them up and never look again."
landing.problem.body          = "A bland column of blue links. Timelines you only scroll past. Don't let what you save get buried in a wall of text."
landing.features.capture.title  = "One click, from anywhere."
landing.features.capture.body   = "Posts on X, YouTube videos, articles, shops, images — send them straight to your board via the extension, the bookmarklet, or a pasted URL."
landing.features.layout.title   = "Arrange it freely."
landing.features.layout.body    = "Drag and drop to set size and position exactly how you like."
landing.features.live.title     = "Play several videos at once."
landing.features.live.body      = "Videos across your board move together — not a list of stills, but a board that's actually alive."
landing.features.organize.title = "Tag to sort. Theme to restyle."
landing.features.organize.body  = "Filter by tag, and switch the whole look with themes. More themes are on the way."
landing.features.privacy.title  = "No account. Fully local."
landing.features.privacy.body   = "Everything is saved only inside your browser. Nothing is sent to a server. Your privacy stays yours."
landing.share.headline        = "Share it as one board."
landing.share.body            = "Export your finished board as an image, or share a link — your exact layout arrives just as you made it."
landing.cta.headline          = "Start building your board."
landing.cta.button            = "Start now — no sign-up"
landing.footer.features       = "Features"
landing.footer.guide          = "Guide"
landing.footer.faq            = "FAQ"
landing.footer.about          = "About"
landing.footer.privacy        = "Privacy"
landing.footer.terms          = "Terms"
landing.footer.contact        = "Contact"
```

**翻訳ルール(全言語厳守):**
- `landing.footer.*` の7項目(Features/Guide/FAQ/About/Privacy/Terms/Contact)は**英語のまま verbatim**(サイト共通の固定英語語彙=ヘッダー/フッターのナビ語彙に合わせる。`ja.json` の footer も英語固定を確認して合わせる)。
- ブランド名 `AllMarks`・サービス名・`X`(旧Twitter)・`YouTube` は verbatim。
- 自然で各言語ネイティブが読んで違和感のないマーケティングトーン(直訳調を避ける)。ja の既存訳のトーン(簡潔・編集的)に合わせる。
- JSON 構造は en と完全一致(キーの増減禁止)。既存の他キー(board/triage 等)は触らない。

- [ ] **Step 1: パリティテストを書く(失敗する状態)**

`messages/landing-parity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'

// 各 locale の JSON を読み込む(vite は JSON import 可)
import ar from './ar.json'
import de from './de.json'
import en from './en.json'
import es from './es.json'
import fr from './fr.json'
import it from './it.json'
import ja from './ja.json'
import ko from './ko.json'
import nl from './nl.json'
import pt from './pt.json'
import ru from './ru.json'
import th from './th.json'
import tr from './tr.json'
import vi from './vi.json'
import zh from './zh.json'

const FILES: Record<string, unknown> = { ar, de, en, es, fr, it, ja, ko, nl, pt, ru, th, tr, vi, zh }

/** landing ブロックの leaf キーパスを集める(値の型は string 前提)。 */
function leafKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return []
  const out: string[] = []
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null) out.push(...leafKeys(v, path))
    else out.push(path)
  }
  return out.sort()
}

function landingOf(file: unknown): Record<string, unknown> {
  const landing = (file as Record<string, unknown>).landing
  return (landing as Record<string, unknown>) ?? {}
}

describe('landing translation parity', () => {
  const enKeys = leafKeys(landingOf(en))

  it('15言語すべてが揃っている', () => {
    expect(Object.keys(FILES).sort()).toEqual([...SUPPORTED_LOCALES].sort())
  })

  it('en は28個の landing leaf キーを持つ', () => {
    expect(enKeys.length).toBe(28)
  })

  for (const locale of SUPPORTED_LOCALES) {
    it(`${locale}: landing leaf キーが en と完全一致`, () => {
      expect(leafKeys(landingOf(FILES[locale]))).toEqual(enKeys)
    })
    it(`${locale}: 全 landing 値が非空文字列`, () => {
      const landing = landingOf(FILES[locale])
      for (const path of enKeys) {
        const v = path.split('.').reduce<unknown>((acc, p) => (acc as Record<string, unknown>)?.[p], landing)
        expect(typeof v).toBe('string')
        expect((v as string).length).toBeGreaterThan(0)
      }
    })
    it(`${locale}: footer ナビは英語固定`, () => {
      const landing = landingOf(FILES[locale]) as { footer?: Record<string, string> }
      expect(landing.footer?.features).toBe('Features')
      expect(landing.footer?.faq).toBe('FAQ')
      expect(landing.footer?.privacy).toBe('Privacy')
    })
  }
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `rtk vitest run messages/landing-parity.test.ts`
Expected: FAIL — 13言語が `landing` を持たず leaf キー不一致(`[]` ≠ enKeys)。

- [ ] **Step 3: 13言語に `landing` ブロックを追加(翻訳)**

各言語ファイルのトップレベルに `landing` キーを追加。**並列サブエージェント推奨**(1言語=1エージェント、上記「翻訳元」と「翻訳ルール」を渡す)。例(`zh.json` の形):

```jsonc
{
  // ...既存キー（board/triage 等。一切変更しない）...
  "landing": {
    "hero": {
      "label": "可视化书签管理",
      "headline": "把链接变成可视化画板。",
      "description": "一键保存视频、社交帖子、文章和图片，再自由排列。把单调的文字列表变成一眼就能领会的灵感画板。无需注册，完全免费。",
      "ctaPrimary": "打开画板",
      "ctaGhost": "了解工作方式",
      "scrollHint": "向下滚动"
    },
    "problem": {
      "headline": "你不断堆积，却再也不看。",
      "body": "一列单调的蓝色链接。只是划过的时间线。别让你保存的东西淹没在文字之中。"
    },
    "features": {
      "capture": { "title": "随时随地，一键保存。", "body": "X 上的帖子、YouTube 视频、文章、店铺、图片——通过扩展、书签小工具或粘贴网址，直接发送到你的画板。" },
      "layout":  { "title": "自由排列。", "body": "拖放即可随心设定大小和位置。" },
      "live":    { "title": "同时播放多个视频。", "body": "画板上的视频一起动起来——不是一堆静止图，而是真正活起来的画板。" },
      "organize":{ "title": "用标签整理，用主题换装。", "body": "按标签筛选，用主题切换整体外观。更多主题即将推出。" },
      "privacy": { "title": "无需账户，完全本地。", "body": "一切只保存在你的浏览器中，绝不发送到服务器。你的隐私始终属于你。" }
    },
    "share": {
      "headline": "作为一整块画板分享。",
      "body": "把完成的画板导出为图片，或分享链接——你的排版会原样呈现。"
    },
    "cta": {
      "headline": "开始打造你的画板。",
      "button": "立即开始——无需注册"
    },
    "footer": {
      "features": "Features", "guide": "Guide", "faq": "FAQ", "about": "About",
      "privacy": "Privacy", "terms": "Terms", "contact": "Contact"
    }
  }
}
```

残り12言語(ar/de/es/fr/it/ko/nl/pt/ru/th/tr/vi)も同構造で翻訳。**RTL言語(ar)も文字列のみ**(レイアウト方向は本タスク対象外、CSS は既存のまま)。

- [ ] **Step 4: パリティテストが通ることを確認**

Run: `rtk vitest run messages/landing-parity.test.ts`
Expected: PASS(15言語 × 各assertion 緑)。

- [ ] **Step 5: 品質チェック(別担当のレビュー)**

各言語につき、翻訳をレビューする別サブエージェントを立て、次を確認: (a) 未翻訳の英語残り(footer 以外)が無いか、(b) トーンが直訳調すぎないか、(c) 固定語(AllMarks/X/YouTube/footer 英語)が verbatim か、(d) 明らかな誤訳・文字化け無し。指摘があれば該当 `landing` を修正し Step 4 を再実行。

- [ ] **Step 6: JSON 妥当性 + 全体テスト**

Run: `rtk vitest run messages/landing-parity.test.ts && rtk tsc`
Expected: PASS / tsc 0(JSON 構文崩れが無いこと)。

- [ ] **Step 7: コミット**

```bash
rtk git add messages/ar.json messages/de.json messages/es.json messages/fr.json messages/it.json messages/ko.json messages/nl.json messages/pt.json messages/ru.json messages/th.json messages/tr.json messages/vi.json messages/zh.json messages/landing-parity.test.ts
rtk git commit -m "i18n(lp): translate landing copy into 13 languages + parity test"
```

---

## Task 2: locale-urls 純粋関数

locale から LP の URL を作る純粋関数群。ページ・sitemap・言語メニュー・案内バーが共用する。

**Files:**
- Create: `lib/i18n/locale-urls.ts`
- Test: `lib/i18n/locale-urls.test.ts`

**Interfaces:**
- Produces:
  - `localePath(locale: SupportedLocale): string` — `en`→`'/'`、他→`'/<locale>'`
  - `PREFIXED_LOCALES: readonly SupportedLocale[]` — 英語を除く14言語(`generateStaticParams` 用)
  - `hreflangAlternates(): Record<string, string>` — 15言語 + `'x-default'`→`'/'` の相対パスマップ(Next `Metadata.alternates.languages` 用)

- [ ] **Step 1: 失敗するテストを書く**

`lib/i18n/locale-urls.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { localePath, PREFIXED_LOCALES, hreflangAlternates } from './locale-urls'
import { SUPPORTED_LOCALES } from './config'

describe('locale-urls', () => {
  it('英語は / になる', () => {
    expect(localePath('en')).toBe('/')
  })
  it('日本語/中国語は接頭辞付き', () => {
    expect(localePath('ja')).toBe('/ja')
    expect(localePath('zh')).toBe('/zh')
  })
  it('PREFIXED_LOCALES は英語を含まず14言語', () => {
    expect(PREFIXED_LOCALES).not.toContain('en')
    expect(PREFIXED_LOCALES.length).toBe(SUPPORTED_LOCALES.length - 1)
  })
  it('hreflangAlternates は15言語 + x-default', () => {
    const map = hreflangAlternates()
    expect(map['x-default']).toBe('/')
    expect(map.en).toBe('/')
    expect(map.ja).toBe('/ja')
    expect(Object.keys(map).length).toBe(SUPPORTED_LOCALES.length + 1)
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `rtk vitest run lib/i18n/locale-urls.test.ts`
Expected: FAIL — `localePath is not a function`(モジュール未作成)。

- [ ] **Step 3: 実装**

`lib/i18n/locale-urls.ts`:

```ts
import { SUPPORTED_LOCALES, type SupportedLocale } from './config'

/** LP path for a locale. English is the bare root '/', others get a '/<locale>' prefix. */
export function localePath(locale: SupportedLocale): string {
  return locale === 'en' ? '/' : `/${locale}`
}

/** Locales that get a URL prefix — everything except English. Used by generateStaticParams. */
export const PREFIXED_LOCALES: readonly SupportedLocale[] = SUPPORTED_LOCALES.filter(
  (l) => l !== 'en',
)

/**
 * hreflang alternates map for Next Metadata `alternates.languages`.
 * All 15 languages keyed by hreflang code, plus 'x-default' → '/' (English).
 * Relative paths; Next resolves them against metadataBase (lib/constants SITE_URL).
 */
export function hreflangAlternates(): Record<string, string> {
  const map: Record<string, string> = { 'x-default': '/' }
  for (const l of SUPPORTED_LOCALES) map[l] = localePath(l)
  return map
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run lib/i18n/locale-urls.test.ts`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
rtk git add lib/i18n/locale-urls.ts lib/i18n/locale-urls.test.ts
rtk git commit -m "feat(i18n): locale-urls helper (LP path + hreflang alternates)"
```

---

## Task 3: static-messages 静的マップ

15言語の JSON を静的 import し、locale→messages のマップを公開。`app/[locale]/page.tsx`(server)がビルド時に該当言語を引いて provider に渡す。

**Files:**
- Create: `lib/i18n/static-messages.ts`
- Test: `lib/i18n/static-messages.test.ts`

**Interfaces:**
- Produces: `STATIC_MESSAGES: Record<SupportedLocale, Messages>` — 全15言語の messages を同期参照できる。**server component 専用**(client から import すると全15言語が同梱されるため使わない)。

- [ ] **Step 1: 失敗するテストを書く**

`lib/i18n/static-messages.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { STATIC_MESSAGES } from './static-messages'
import { SUPPORTED_LOCALES } from './config'
import { translate } from './translate'

describe('static-messages', () => {
  it('15言語すべて存在する', () => {
    expect(Object.keys(STATIC_MESSAGES).sort()).toEqual([...SUPPORTED_LOCALES].sort())
  })
  it('各言語で landing.hero.headline が引ける(キー文字列が返らない)', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const headline = translate(STATIC_MESSAGES[locale], 'landing.hero.headline')
      expect(headline).not.toBe('landing.hero.headline')
      expect(headline.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `rtk vitest run lib/i18n/static-messages.test.ts`
Expected: FAIL — モジュール未作成。

- [ ] **Step 3: 実装**

`lib/i18n/static-messages.ts`:

```ts
import { type SupportedLocale, type Messages } from './config'
import ar from '@/messages/ar.json'
import de from '@/messages/de.json'
import en from '@/messages/en.json'
import es from '@/messages/es.json'
import fr from '@/messages/fr.json'
import it from '@/messages/it.json'
import ja from '@/messages/ja.json'
import ko from '@/messages/ko.json'
import nl from '@/messages/nl.json'
import pt from '@/messages/pt.json'
import ru from '@/messages/ru.json'
import th from '@/messages/th.json'
import tr from '@/messages/tr.json'
import vi from '@/messages/vi.json'
import zh from '@/messages/zh.json'

/**
 * All 15 locales' messages, statically imported. SERVER-ONLY — import this
 * from server components (app/[locale]/page.tsx) so only the selected locale's
 * object is passed as a prop into the client provider. Never import from a
 * client component (it would bundle all 15 languages into that chunk).
 */
export const STATIC_MESSAGES: Record<SupportedLocale, Messages> = {
  ja: ja as Messages,
  en: en as Messages,
  zh: zh as Messages,
  ko: ko as Messages,
  es: es as Messages,
  fr: fr as Messages,
  de: de as Messages,
  pt: pt as Messages,
  it: it as Messages,
  nl: nl as Messages,
  tr: tr as Messages,
  ru: ru as Messages,
  ar: ar as Messages,
  th: th as Messages,
  vi: vi as Messages,
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run lib/i18n/static-messages.test.ts`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
rtk git add lib/i18n/static-messages.ts lib/i18n/static-messages.test.ts
rtk git commit -m "feat(i18n): STATIC_MESSAGES server-side locale map"
```

---

## Task 4: LandingPage に locale prop + html lang 設定

LandingPage が locale を受け取り、mount 時に `<html lang>` を設定(離脱で復元)。既存の data-theme=light 設定と同居。

**Files:**
- Modify: `components/marketing/LandingPage.tsx`
- Modify: `components/marketing/SiteHeader.tsx`(props 受け渡しの中継。言語メニュー本体は Task 7)
- Test: `components/marketing/LandingPage.test.tsx`(新規)

**Interfaces:**
- Consumes: なし(prop は呼び出し側ページが渡す)
- Produces: `LandingPage` が `{ locale?: SupportedLocale }` prop を受ける(既定 `'en'`)。`SiteHeader` も `{ locale: SupportedLocale }` を受ける(Task 7 で使用)。

- [ ] **Step 1: 失敗するテストを書く**

`components/marketing/LandingPage.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { LandingPage } from './LandingPage'

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('lang')
  document.documentElement.removeAttribute('data-theme')
})

describe('LandingPage locale', () => {
  it('locale=ja で <html lang> が ja になる', () => {
    render(<LandingPage locale="ja" />)
    expect(document.documentElement.getAttribute('lang')).toBe('ja')
  })
  it('locale 未指定なら en', () => {
    render(<LandingPage />)
    expect(document.documentElement.getAttribute('lang')).toBe('en')
  })
})
```

> 注: `useSmoothScroll`/`useScrollTrigger`(Lenis/GSAP)は jsdom で no-op になる前提。落ちる場合は既存 LP テストの mock パターンに合わせて `vi.mock('@/lib/scroll/use-smooth-scroll')` 等を追加(Step 3 で対応)。

- [ ] **Step 2: 失敗を確認**

Run: `rtk vitest run components/marketing/LandingPage.test.tsx`
Expected: FAIL — `LandingPage` が `locale` prop 未対応で lang が設定されない。

- [ ] **Step 3: 実装**

`components/marketing/LandingPage.tsx` を改修(差分):

```tsx
import { useEffect } from 'react'
import type { SupportedLocale } from '@/lib/i18n/config'
// ...既存 import...

export function LandingPage({ locale = 'en' }: { locale?: SupportedLocale }): React.ReactElement {
  useSmoothScroll()
  useScrollTrigger()

  // LP は意図的に LIGHT。app 既定 <html data-theme="dark"> + ブラウザ自動ダーク対策。
  // 併せて各言語ページの <html lang> を locale に合わせる(root layout は en 固定のため)。
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
      <SiteHeader locale={locale} />
      <div className={styles.content}>
        <Hero />
        <Problem />
        <Features />
        <ShareIt />
        <FinalCta />
        <SiteFooter />
      </div>
    </div>
  )
}
```

`components/marketing/SiteHeader.tsx` を改修: `locale` prop を受ける(本タスクでは受けるだけ、Task 7 で `LanguageMenu` に渡す):

```tsx
import type { SupportedLocale } from '@/lib/i18n/config'

export function SiteHeader({ locale }: { locale: SupportedLocale }): React.ReactElement {
  // ...既存のまま...(locale は Task 7 で LanguageMenu に渡す)
```

> `SiteHeader` を呼ぶのは `LandingPage` のみ。他に呼び出し箇所がないことを `rtk grep "SiteHeader"` で確認してから変更する。

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run components/marketing/LandingPage.test.tsx`
Expected: PASS。落ちる場合は scroll hooks を mock。

- [ ] **Step 5: 型チェック**

Run: `rtk tsc`
Expected: 0 エラー(`SiteHeader` の必須 locale prop が `LandingPage` から渡っている)。

- [ ] **Step 6: コミット**

```bash
rtk git add components/marketing/LandingPage.tsx components/marketing/SiteHeader.tsx components/marketing/LandingPage.test.tsx
rtk git commit -m "feat(lp): LandingPage locale prop sets <html lang>"
```

---

## Task 5: 英語トップ `/` に provider + SEO メタ + root layout lang 修正

`app/page.tsx` を英語 provider で巻き、hreflang/canonical を出力。root layout の `<html lang>` を en に。

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`(`lang="ja"` → `lang="en"`)
- Create: `lib/i18n/lp-metadata.ts`(generateMetadata 共用ヘルパー)
- Test: `lib/i18n/lp-metadata.test.ts`

**Interfaces:**
- Consumes: `localePath` / `hreflangAlternates`(Task 2)、`STATIC_MESSAGES`(Task 3)、`translate`(既存)
- Produces: `lpMetadata(locale: SupportedLocale): Metadata` — `alternates`(canonical=自URL + languages=hreflang)+ ローカライズ済み `description` + `openGraph.locale` を持つ `Metadata`

- [ ] **Step 1: 失敗するテストを書く**

`lib/i18n/lp-metadata.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { lpMetadata } from './lp-metadata'

describe('lpMetadata', () => {
  it('英語: canonical=/ , x-default=/ , ja alternate=/ja', () => {
    const m = lpMetadata('en')
    expect(m.alternates?.canonical).toBe('/')
    const langs = m.alternates?.languages as Record<string, string>
    expect(langs['x-default']).toBe('/')
    expect(langs.ja).toBe('/ja')
  })
  it('日本語: canonical=/ja , description が日本語(英語と異なる)', () => {
    const m = lpMetadata('ja')
    expect(m.alternates?.canonical).toBe('/ja')
    expect(m.description).not.toBe(lpMetadata('en').description)
    expect(typeof m.description).toBe('string')
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `rtk vitest run lib/i18n/lp-metadata.test.ts`
Expected: FAIL — `lpMetadata` 未定義。

- [ ] **Step 3: 実装**

`lib/i18n/lp-metadata.ts`:

```ts
import type { Metadata } from 'next'
import { type SupportedLocale } from './config'
import { STATIC_MESSAGES } from './static-messages'
import { translate } from './translate'
import { localePath, hreflangAlternates } from './locale-urls'

/** hreflang code → OpenGraph locale (og は xx_XX 形式を好む。最低限の対応)。 */
const OG_LOCALE: Partial<Record<SupportedLocale, string>> = {
  ja: 'ja_JP', en: 'en_US', zh: 'zh_CN', ko: 'ko_KR', es: 'es_ES',
  fr: 'fr_FR', de: 'de_DE', pt: 'pt_BR', it: 'it_IT', nl: 'nl_NL',
  tr: 'tr_TR', ru: 'ru_RU', ar: 'ar_AR', th: 'th_TH', vi: 'vi_VN',
}

/** Per-locale LP metadata: hreflang alternates, self canonical, localized description. */
export function lpMetadata(locale: SupportedLocale): Metadata {
  const description = translate(STATIC_MESSAGES[locale], 'landing.hero.description')
  return {
    description,
    alternates: {
      canonical: localePath(locale),
      languages: hreflangAlternates(),
    },
    openGraph: {
      description,
      locale: OG_LOCALE[locale] ?? 'en_US',
    },
  }
}
```

`app/page.tsx` 改修:

```tsx
// app/page.tsx
import type { Metadata } from 'next'
import en from '@/messages/en.json'
import type { Messages } from '@/lib/i18n/config'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { LandingPage } from '@/components/marketing/LandingPage'
import { lpMetadata } from '@/lib/i18n/lp-metadata'

export function generateMetadata(): Metadata {
  return lpMetadata('en')
}

export default function Home(): React.ReactElement {
  return (
    <I18nProvider initialLocale="en" initialMessages={en as Messages}>
      <LandingPage locale="en" />
    </I18nProvider>
  )
}
```

`app/layout.tsx` 改修(1行):

```tsx
// 変更前: <html lang="ja" data-theme="dark" ...>
<html lang="en" data-theme="dark" data-card-style="glass" data-ui-theme="auto">
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run lib/i18n/lp-metadata.test.ts`
Expected: PASS。

- [ ] **Step 5: 型チェック + ビルド(英語トップが壊れていない)**

Run: `rtk tsc && rtk pnpm build`
Expected: tsc 0 / build 成功。`out/index.html` が生成され、`<head>` に `<link rel="alternate" hreflang="ja" href=".../ja">` と `hreflang="x-default"` が含まれる(確認: `rtk grep "hreflang" out/index.html`)。

- [ ] **Step 6: コミット**

```bash
rtk git add app/page.tsx app/layout.tsx lib/i18n/lp-metadata.ts lib/i18n/lp-metadata.test.ts
rtk git commit -m "feat(lp): English home wrapped in i18n provider + hreflang metadata"
```

---

## Task 6: `app/[locale]/page.tsx` で14言語を prerender

英語以外の14言語の LP を静的生成。各言語の messages を provider に渡す。

**Files:**
- Create: `app/[locale]/page.tsx`
- (テストはビルド検証で代替。動的セグメント + generateStaticParams は単体テストより build/本番で検証する)

**Interfaces:**
- Consumes: `PREFIXED_LOCALES`(Task 2)、`STATIC_MESSAGES`(Task 3)、`lpMetadata`(Task 5)、`LandingPage`(Task 4)、`I18nProvider`(既存)

- [ ] **Step 1: 実装**

`app/[locale]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { LandingPage } from '@/components/marketing/LandingPage'
import { STATIC_MESSAGES } from '@/lib/i18n/static-messages'
import { PREFIXED_LOCALES } from '@/lib/i18n/locale-urls'
import { lpMetadata } from '@/lib/i18n/lp-metadata'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n/config'

// output:'export' — 列挙した locale 以外は生成しない(オンデマンド生成なし)。
export const dynamicParams = false

export function generateStaticParams(): Array<{ locale: string }> {
  return PREFIXED_LOCALES.map((locale) => ({ locale }))
}

function isPrefixedLocale(value: string): value is SupportedLocale {
  return value !== 'en' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  if (!isPrefixedLocale(params.locale)) return {}
  return lpMetadata(params.locale)
}

export default function LocaleHome({ params }: { params: { locale: string } }): React.ReactElement {
  const { locale } = params
  if (!isPrefixedLocale(locale)) notFound()
  return (
    <I18nProvider initialLocale={locale} initialMessages={STATIC_MESSAGES[locale]}>
      <LandingPage locale={locale} />
    </I18nProvider>
  )
}
```

- [ ] **Step 2: ビルドで14言語が生成されることを確認**

Run: `rtk pnpm build`
Expected: build 成功。`out/ja/index.html` `out/zh/index.html` 等14個が生成され、既存 `out/board/index.html` `out/faq/index.html` 等が**壊れていない**(ルート衝突なし)。

確認:
```bash
ls out/ja/index.html out/zh/index.html out/ko/index.html out/ar/index.html
rtk grep "向下滚动\|scroll" out/zh/index.html   # 中国語ページに中国語が焼き込まれている
rtk grep "hreflang" out/ja/index.html            # 日本語ページに hreflang
ls out/board/index.html out/faq/index.html        # 既存ルート健在
```

- [ ] **Step 3: 全テスト + 型チェック**

Run: `rtk tsc && rtk vitest run`
Expected: tsc 0 / 既存テスト全 pass(回帰なし)。

- [ ] **Step 4: コミット**

```bash
rtk git add app/[locale]/page.tsx
rtk git commit -m "feat(lp): prerender 14 locale LP pages via [locale] segment"
```

---

## Task 7: LP ヘッダー言語切替メニュー

ヘッダー右側に言語切替を追加。endonym で並べ、選ぶとその言語URLへ移動。見た目の最終調整は実機で user と詰める(本タスクは機能 + 最小スタイル)。

**Files:**
- Create: `components/marketing/LanguageMenu.tsx` + `components/marketing/LanguageMenu.module.css`
- Modify: `components/marketing/SiteHeader.tsx`(`LanguageMenu` 設置)
- Test: `components/marketing/LanguageMenu.test.tsx`

**Interfaces:**
- Consumes: `LANGUAGE_ENDONYMS` / `SUPPORTED_LOCALES`(config)、`localePath`(Task 2)、`persistLocale`(locale-store)、`useRouter`(next/navigation)
- Produces: `LanguageMenu({ current }: { current: SupportedLocale })`

- [ ] **Step 1: 失敗するテストを書く**

`components/marketing/LanguageMenu.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LanguageMenu } from './LanguageMenu'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

beforeEach(() => {
  push.mockClear()
  window.localStorage.clear()
})

describe('LanguageMenu', () => {
  it('畳んだ状態で現在言語コードを大文字で出す', () => {
    render(<LanguageMenu current="en" />)
    expect(screen.getByTestId('lang-menu-toggle').textContent).toContain('EN')
  })
  it('開くと endonym で並ぶ', () => {
    render(<LanguageMenu current="en" />)
    fireEvent.click(screen.getByTestId('lang-menu-toggle'))
    expect(screen.getByText('日本語')).not.toBeNull()
    expect(screen.getByText('中文')).not.toBeNull()
  })
  it('言語を選ぶとその URL へ push + localStorage 保存', () => {
    render(<LanguageMenu current="en" />)
    fireEvent.click(screen.getByTestId('lang-menu-toggle'))
    fireEvent.click(screen.getByText('日本語'))
    expect(push).toHaveBeenCalledWith('/ja')
    expect(window.localStorage.getItem('allmarks-locale')).toBe('ja')
  })
  it('外側 pointerdown(capture)で閉じる', () => {
    render(<LanguageMenu current="en" />)
    fireEvent.click(screen.getByTestId('lang-menu-toggle'))
    expect(screen.queryByText('日本語')).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByText('日本語')).toBeNull()
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `rtk vitest run components/marketing/LanguageMenu.test.tsx`
Expected: FAIL — `LanguageMenu` 未作成。

- [ ] **Step 3: 実装**

`components/marketing/LanguageMenu.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SUPPORTED_LOCALES, LANGUAGE_ENDONYMS, type SupportedLocale } from '@/lib/i18n/config'
import { localePath } from '@/lib/i18n/locale-urls'
import { persistLocale } from '@/lib/i18n/locale-store'
import styles from './LanguageMenu.module.css'

/**
 * LP header language switcher. Each language is shown by its own endonym so a
 * speaker can find it (中文 / 한국어 …). Selecting navigates to that language's
 * LP URL (en → '/', others → '/<locale>') — each locale is a separate static
 * page, so we navigate rather than runtime-swap. The choice is persisted so the
 * locale-suggest banner won't nag afterward.
 */
export function LanguageMenu({ current }: { current: SupportedLocale }): React.ReactElement {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Outside dismiss — capture-phase pointerdown (matches board chrome pattern).
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open])

  const choose = (locale: SupportedLocale): void => {
    setOpen(false)
    if (locale !== current) {
      persistLocale(locale)
      router.push(localePath(locale))
    }
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        data-testid="lang-menu-toggle"
        className={styles.toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">🌐</span> {current.toUpperCase()}
      </button>
      {open && (
        <ul className={styles.list} role="listbox" aria-label="Language">
          {SUPPORTED_LOCALES.map((locale) => (
            <li key={locale} role="option" aria-selected={locale === current}>
              <button
                type="button"
                className={styles.item}
                data-current={locale === current}
                onClick={() => choose(locale)}
              >
                {LANGUAGE_ENDONYMS[locale]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

`components/marketing/LanguageMenu.module.css`(最小・編集的トーン。白LPに合わせる。本格調整は Step 6 で実機):

```css
.root { position: relative; display: inline-flex; }

.toggle {
  font-family: var(--font-geist-mono), monospace;
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--lp-ink, #14130f);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 6px 8px;
  min-height: 32px;            /* 大きいポインタ前提のクリック余白 */
}

.list {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  margin: 0;
  padding: 6px;
  list-style: none;
  background: rgba(250, 249, 246, 0.96);
  border: 1px solid rgba(20, 19, 15, 0.12);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(20, 19, 15, 0.12);
  backdrop-filter: blur(8px);
  max-height: 60vh;
  overflow: auto;
  z-index: 50;
}

.item {
  display: block;
  width: 100%;
  text-align: left;
  font-size: 14px;
  color: var(--lp-ink, #14130f);
  background: transparent;
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  min-height: 32px;
  cursor: pointer;
  white-space: nowrap;
}
.item:hover { background: rgba(20, 19, 15, 0.06); }
.item[data-current='true'] { font-weight: 600; }
```

`components/marketing/SiteHeader.tsx` 改修: nav 末尾(Open Board の隣)に設置:

```tsx
import { LanguageMenu } from './LanguageMenu'
// ...
      <nav className={styles.nav} aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => ( /* ...既存... */ ))}
        <Link href="/board" className={styles.openApp}>
          Open Board
          <span className={styles.openArrow} aria-hidden="true">↗</span>
        </Link>
        <LanguageMenu current={locale} />
      </nav>
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run components/marketing/LanguageMenu.test.tsx`
Expected: PASS(4件)。

- [ ] **Step 5: 型 + 既存テスト回帰なし**

Run: `rtk tsc && rtk vitest run`
Expected: tsc 0 / 全 pass。

- [ ] **Step 6: コミット**

```bash
rtk git add components/marketing/LanguageMenu.tsx components/marketing/LanguageMenu.module.css components/marketing/SiteHeader.tsx components/marketing/LanguageMenu.test.tsx
rtk git commit -m "feat(lp): header language menu (endonyms, navigates locale URLs)"
```

> 見た目(地球儀の形・畳み時の表示・開閉アニメ・配置)は本番デプロイ後に実機で user と詰める([[feedback_no_question_box_for_design]] = 平文で対話)。本タスクは機能 + 最小スタイルまで。

---

## Task 8: 母国語案内バー

英語トップに来た非英語ブラウザの人へ、強制せず母国語版を案内する帯。

**Files:**
- Create: `components/marketing/LocaleSuggestBanner.tsx` + `components/marketing/LocaleSuggestBanner.module.css`
- Modify: `components/marketing/LandingPage.tsx`(バー設置)
- Test: `components/marketing/LocaleSuggestBanner.test.tsx`

**Interfaces:**
- Consumes: `detectLocale`(config)、`LANGUAGE_ENDONYMS`、`localePath`(Task 2)、`persistLocale`/`readStoredLocale`(locale-store)
- Produces: `LocaleSuggestBanner({ current }: { current: SupportedLocale })`

**ロジック:** mount 後にブラウザ言語を `detectLocale()` で判定。`suggested !== current` かつ「localStorage に言語選択が無い(=未 dismiss・未選択)」なら表示。`×` or 移動で `persistLocale(suggested)` して消す。

- [ ] **Step 1: 失敗するテストを書く**

`components/marketing/LocaleSuggestBanner.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LocaleSuggestBanner } from './LocaleSuggestBanner'

beforeEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('LocaleSuggestBanner', () => {
  it('日本語ブラウザ × 英語ページ × 未選択 → バー表示(日本語で見る)', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ja-JP', 'ja'])
    render(<LocaleSuggestBanner current="en" />)
    expect(screen.getByTestId('locale-suggest').textContent).toContain('日本語')
    expect(screen.getByRole('link')).toHaveProperty('href', expect.stringContaining('/ja'))
  })
  it('既に言語選択済み(localStorage)なら出さない', () => {
    window.localStorage.setItem('allmarks-locale', 'ja')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ja-JP'])
    render(<LocaleSuggestBanner current="en" />)
    expect(screen.queryByTestId('locale-suggest')).toBeNull()
  })
  it('ブラウザ言語=ページ言語なら出さない', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US'])
    render(<LocaleSuggestBanner current="en" />)
    expect(screen.queryByTestId('locale-suggest')).toBeNull()
  })
  it('× で消えて localStorage に記録', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ja-JP'])
    render(<LocaleSuggestBanner current="en" />)
    fireEvent.click(screen.getByTestId('locale-suggest-dismiss'))
    expect(screen.queryByTestId('locale-suggest')).toBeNull()
    expect(window.localStorage.getItem('allmarks-locale')).toBe('ja')
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `rtk vitest run components/marketing/LocaleSuggestBanner.test.tsx`
Expected: FAIL — 未作成。

- [ ] **Step 3: 実装**

`components/marketing/LocaleSuggestBanner.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { detectLocale, LANGUAGE_ENDONYMS, type SupportedLocale } from '@/lib/i18n/config'
import { localePath } from '@/lib/i18n/locale-urls'
import { readStoredLocale, persistLocale } from '@/lib/i18n/locale-store'
import styles from './LocaleSuggestBanner.module.css'

/**
 * Friendly, non-forcing locale suggestion. When a visitor's browser language
 * differs from the page's language AND they have not yet chosen a language,
 * a slim bar offers their language ("🌐 日本語で見る →"). No content reflow,
 * no redirect — the page stays as-is. Dismiss or choosing records the choice
 * so it never nags again. LP only.
 */
export function LocaleSuggestBanner({ current }: { current: SupportedLocale }): React.ReactElement | null {
  // Server/first paint renders nothing; decide on client mount (no flicker of content).
  const [suggested, setSuggested] = useState<SupportedLocale | null>(null)

  useEffect(() => {
    if (readStoredLocale()) return // already chose a language before
    const browser = detectLocale()
    if (browser !== current) setSuggested(browser)
  }, [current])

  if (!suggested) return null

  const dismiss = (): void => {
    persistLocale(suggested) // recording a value suppresses future nags
    setSuggested(null)
  }

  return (
    <div className={styles.bar} data-testid="locale-suggest" role="region" aria-label="Language suggestion">
      <Link href={localePath(suggested)} className={styles.link} onClick={() => persistLocale(suggested)}>
        <span aria-hidden="true">🌐</span> {LANGUAGE_ENDONYMS[suggested]}
        <span aria-hidden="true"> →</span>
      </Link>
      <button
        type="button"
        data-testid="locale-suggest-dismiss"
        className={styles.close}
        aria-label="Dismiss"
        onClick={dismiss}
      >
        ×
      </button>
    </div>
  )
}
```

`components/marketing/LocaleSuggestBanner.module.css`:

```css
.bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 60;                 /* ヘッダーより上 */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(20, 19, 15, 0.92);
  color: #faf9f6;
  font-family: var(--font-geist-mono), monospace;
  font-size: 13px;
  letter-spacing: 0.03em;
  animation: slideDown 360ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes slideDown {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
.link { color: #faf9f6; text-decoration: none; display: inline-flex; gap: 6px; align-items: center; }
.link:hover { text-decoration: underline; }
.close {
  background: transparent; border: none; color: #faf9f6;
  font-size: 18px; line-height: 1; cursor: pointer;
  min-width: 32px; min-height: 32px;
}
@media (prefers-reduced-motion: reduce) {
  .bar { animation: none; }
}
```

`components/marketing/LandingPage.tsx` にバー設置(wrapper 直下、SiteHeader の前):

```tsx
import { LocaleSuggestBanner } from './LocaleSuggestBanner'
// ...
  return (
    <div className={`${styles.wrapper} lpRoot`}>
      <LocaleSuggestBanner current={locale} />
      <SiteHeader locale={locale} />
      {/* ...既存... */}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run components/marketing/LocaleSuggestBanner.test.tsx`
Expected: PASS(4件)。

- [ ] **Step 5: 型 + 全テスト**

Run: `rtk tsc && rtk vitest run`
Expected: tsc 0 / 全 pass。

- [ ] **Step 6: コミット**

```bash
rtk git add components/marketing/LocaleSuggestBanner.tsx components/marketing/LocaleSuggestBanner.module.css components/marketing/LandingPage.tsx components/marketing/LocaleSuggestBanner.test.tsx
rtk git commit -m "feat(lp): non-forcing locale suggestion banner"
```

---

## Task 9: 言語別 sitemap

`app/sitemap.ts` にトップLPの15言語URLを追加。検索エンジンに各言語版を知らせる。

**Files:**
- Modify: `app/sitemap.ts`
- Test: `app/sitemap.test.ts`(新規)

**Interfaces:**
- Consumes: `SUPPORTED_LOCALES`(config)、`localePath`(Task 2)、`SITE_URL`(constants)

- [ ] **Step 1: 失敗するテストを書く**

`app/sitemap.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import sitemap from './sitemap'
import { SITE_URL } from '@/lib/constants'

describe('sitemap', () => {
  it('15言語ぶんのトップLP URL を含む', () => {
    const urls = sitemap().map((e) => e.url)
    expect(urls).toContain(`${SITE_URL}/`)
    expect(urls).toContain(`${SITE_URL}/ja`)
    expect(urls).toContain(`${SITE_URL}/zh`)
    expect(urls).toContain(`${SITE_URL}/ar`)
  })
  it('既存の /board /faq も残っている', () => {
    const urls = sitemap().map((e) => e.url)
    expect(urls).toContain(`${SITE_URL}/board`)
    expect(urls).toContain(`${SITE_URL}/faq`)
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `rtk vitest run app/sitemap.test.ts`
Expected: FAIL — `/ja` 等が未登録。

- [ ] **Step 3: 実装**

`app/sitemap.ts` 改修(LP の言語別エントリを追加。英語 `/` は既存の最初の行が担うので、接頭辞14言語を足す):

```ts
import type { MetadataRoute } from 'next'
import { SITE_URL as PRODUCTION_URL } from '@/lib/constants'
import { PREFIXED_LOCALES, localePath } from '@/lib/i18n/locale-urls'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  const routes: Array<{ path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }> = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    // トップLPの言語別URL(検索集客の本丸)
    ...PREFIXED_LOCALES.map((locale) => ({
      path: localePath(locale),
      priority: 0.9,
      changeFrequency: 'weekly' as const,
    })),
    { path: '/board', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/features', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/guide', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/faq', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/terms', priority: 0.5, changeFrequency: 'monthly' },
  ]

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${PRODUCTION_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run app/sitemap.test.ts`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
rtk git add app/sitemap.ts app/sitemap.test.ts
rtk git commit -m "feat(seo): per-locale LP entries in sitemap"
```

---

## Task 10: 通し検証 + 本番デプロイ + 実機確認

全タスク統合後の最終検証と本番反映。

**Files:** なし(検証・デプロイのみ)

- [ ] **Step 1: 通しで型 + 全テスト + ビルド**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0 / 全テスト pass(1043+ + 新規)/ build 成功。ルート数が約24→約38に増加。

- [ ] **Step 2: ビルド成果物の SEO 焼き込み確認**

```bash
ls out/index.html out/ja/index.html out/zh/index.html out/ko/index.html
rtk grep "hreflang=\"x-default\"" out/index.html out/ja/index.html
rtk grep "canonical" out/ja/index.html      # /ja の canonical が /ja を指す
rtk grep "lang=" out/ja/index.html           # root は en だが JS で ja 補正される旨は許容(§4.2)
```
Expected: `/` と `/ja` 双方に hreflang(15言語 + x-default)、各自 canonical。

- [ ] **Step 3: 本番デプロイ**

```bash
npx wrangler whoami
rtk pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="LP i18n layer-2 phase-1"
```

- [ ] **Step 4: 本番(allmarks.app)実機確認**

- `allmarks.app/` = 英語、`allmarks.app/ja` = 日本語、`allmarks.app/zh` = 中国語が**正しい言語で**開く。
- ヘッダー言語メニューで言語選択 → URL が変わりその言語で表示。
- 日本語ブラウザで `allmarks.app/`(localStorage クリア状態)→「🌐 日本語で見る →」バーが出て `/ja` へ飛べる。× で消えて再訪で出ない。
- `curl -s https://allmarks.app/ja/ | grep -i hreflang` で hreflang が返る。
- 既存 `allmarks.app/board` `allmarks.app/s/<既存共有>` が壊れていない。

- [ ] **Step 5: ドキュメント更新 + コミット**

`docs/TODO.md`「現在の状態」更新、`docs/TODO_COMPLETED.md` に narrative 追記、`docs/CURRENT_GOAL.md` を次回(第2段=紹介ページ群)用に上書き、`docs/private/dashboard.html` 反映。

```bash
rtk git add docs/
rtk git commit -m "docs(session-108): LP i18n layer-2 phase-1 shipped"
```

---

## Self-Review(計画 vs 設計書)

**Spec coverage:**
- §3 URL構成(/ + /[locale]) → Task 5(/)・Task 6([locale]) ✓
- §4.1 provider URL固定モード → Task 5・6(initialLocale+initialMessages) ✓
- §4.2 html lang → Task 4(LandingPage)・Task 5(root layout en) ✓
- §4.3 LP本体改修最小 → Task 4 ✓
- §5 SEO hreflang/canonical → Task 5(lpMetadata)・Task 6 ✓ / sitemap → Task 9 ✓ / lang属性 → Task 4 ✓
- §6 言語切替メニュー → Task 7 ✓
- §7 案内バー → Task 8 ✓
- §8 13言語翻訳 + 品質チェック → Task 1 ✓
- §12 テスト(単体/ビルド/本番) → 各タスク + Task 10 ✓
- LP残債(#save-demo / RefObject)→ §13 で非ブロッキング扱い。**本計画では別途**(Task に含めず、余力時に回収=スコープ膨張回避)。

**Placeholder scan:** プレースホルダなし。翻訳(Task 1 Step 3)は生成的作業のため zh の完全例 + 翻訳元/ルールを提示し、残り12言語は同構造で生成。

**Type consistency:** `SupportedLocale` 一貫。`localePath`/`PREFIXED_LOCALES`/`hreflangAlternates`(Task 2)→ Task 5/6/7/8/9 で同名参照。`lpMetadata`(Task 5)→ Task 6 で参照。`STATIC_MESSAGES`(Task 3)→ Task 5/6。`LandingPage` の `locale` prop(Task 4)→ Task 5/6 で付与。`SiteHeader` の `locale` prop(Task 4)→ Task 7 で `LanguageMenu` に伝播。整合。
