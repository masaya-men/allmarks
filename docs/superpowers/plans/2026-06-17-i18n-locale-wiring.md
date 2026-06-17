# i18n 言語切替 実装計画(層① アプリ本体ランタイム多言語化)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** アプリ本体(board / triage / s)を、URL を変えずにブラウザ内でランタイム言語切替できるようにする(15言語、右下に🌐言語切替UI)。

**Architecture:** React Context(`I18nProvider` + `useI18n()` フック)で「今の言語のメッセージ」を配り、同期 `t(key)` で描画。言語ファイルは既存 `loadMessages()` で必要な1言語ぶんだけ動的 import(コード分割)。言語決定順は「保存値 → ブラウザ言語 → 英語」。SSR/初回描画は英語を同梱して固定し、mount 時に解決言語へ swap(ハイドレーション不一致なし)。プロバイダ外で `useI18n()` を使っても英語フォールバックで動く(throw しない)。

**Tech Stack:** Next.js 14 App Router(`output: 'export'`), React Context, TypeScript strict, vitest + @testing-library/react, Vanilla CSS Modules。

## Global Constraints

- TypeScript `strict: true`、`any` 禁止(`unknown` + 型ガード)、Return type 明示。
- CSS は Vanilla CSS + CSS Modules(Tailwind 禁止)。z-index は定数管理。
- 設計書: `docs/superpowers/specs/2026-06-17-i18n-locale-architecture-design.md` に準拠。
- **本計画のスコープは層①のみ**。層②(LP 言語別 URL・hreflang・sitemap・LP 文章 translate)は実装しない(LP 作り直し時)。
- **触らない**: ボード固定英語語彙(TITLE/TUNE/SETTINGS/MANAGE TAGS/POP OUT/SHARE/MOTION/TAGS/LIBRARY/Inbox/Archive 等)、`DB_NAME='booklage-db'`・`booklage:*`・窓名・CSS クラス名等の不可視符号、ブックマークレット内部ID・保存URLパス(`/save`)、15言語ファイル内の固定英語・placeholder `{current}/{total}`・絵文字・キーコンボ・`#AllMarks`。
- 既定言語(同梱・SSR・プロバイダ外フォールバック)= **英語**(`en`)。
- localStorage 永続化キー = `allmarks-locale`(BoardConfig 等と分離した独立キー)。
- 言語切替UIの厳密な座標・色・開閉アニメ・MOTION OFF 時の挙動は、Task 7 で user と画面確認してから確定(機能完成 → 見た目は承認フロー)。
- 検証コマンドは `pnpm`(`pnpm vitest run` / `pnpm tsc --noEmit` / `pnpm build`)。デプロイは `npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`。

---

## 対象ファイル(全体像)

**新規作成:**
- `lib/i18n/translate.ts` — 純粋関数 `translate(messages, key)`(ネストキー解決)。
- `lib/i18n/locale-store.ts` — localStorage 読み書き + 言語決定 `resolveInitialLocale()`。
- `lib/i18n/I18nProvider.tsx` — `I18nProvider` + `useI18n()` フック。
- `lib/i18n/test-utils.tsx` — テスト用 `renderWithLocale(ui, locale, messages)`。
- `components/board/LanguageSwitcher.tsx` + `.module.css` — 右下の言語切替UI。
- テスト: `lib/i18n/translate.test.ts` / `lib/i18n/locale-store.test.ts` / `lib/i18n/I18nProvider.test.tsx` / `components/board/LanguageSwitcher.test.tsx`。

**変更:**
- `lib/i18n/config.ts` — `Messages` 型を再帰型に、`LANGUAGE_ENDONYMS` 追加。
- `app/(app)/layout.tsx` — `<I18nProvider>` で children を包む。
- `t()` 利用コンポーネント10ファイル — `import { t }` → `const { t } = useI18n()`。
- 既存テスト3ファイル — ja を注入する provider で包む。
- 削除: `lib/i18n/t.ts`(全 importer 移行後)。

---

### Task 1: 純粋関数 `translate(messages, key)` を切り出す

**Files:**
- Modify: `lib/i18n/config.ts`(`Messages` 型を再帰型に変更)
- Create: `lib/i18n/translate.ts`
- Test: `lib/i18n/translate.test.ts`

**Interfaces:**
- Produces: `export type Messages = { [k: string]: string | Messages }`(`config.ts`)、`export function translate(messages: Messages, key: string): string`(`translate.ts`)

- [ ] **Step 1: 失敗するテストを書く**

`lib/i18n/translate.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { translate } from './translate'

const M = {
  board: { chrome: { tune: 'TUNE' }, empty: { title: 'Start bookmarking' } },
  flat: 'hi',
}

describe('translate', () => {
  it('ネストしたキーを解決する', () => {
    expect(translate(M, 'board.chrome.tune')).toBe('TUNE')
    expect(translate(M, 'board.empty.title')).toBe('Start bookmarking')
  })
  it('トップレベルのキーを解決する', () => {
    expect(translate(M, 'flat')).toBe('hi')
  })
  it('欠損キーはキー文字列をそのまま返す', () => {
    expect(translate(M, 'board.chrome.missing')).toBe('board.chrome.missing')
    expect(translate(M, 'nope')).toBe('nope')
  })
  it('途中で string に当たったら以降のキーは未解決', () => {
    expect(translate(M, 'flat.deeper')).toBe('flat.deeper')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm vitest run lib/i18n/translate.test.ts`
Expected: FAIL（`translate` が存在しない / モジュール未解決）

- [ ] **Step 3: 最小実装を書く**

`lib/i18n/config.ts` の型を変更（25行目付近の `type Messages = Record<string, Record<string, string>>` を置換）:
```ts
export type Messages = { [k: string]: string | Messages }
```
（`loadMessages` の `as Messages` キャストはそのままで型が通る。）

`lib/i18n/translate.ts`:
```ts
import type { Messages } from './config'

/** ドット区切りキーでネストした messages から文字列を引く。欠損時はキー文字列を返す。 */
export function translate(messages: Messages, key: string): string {
  const parts = key.split('.')
  let cur: unknown = messages
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null) return key
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : key
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm vitest run lib/i18n/translate.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 5: コミット**

```bash
rtk git add lib/i18n/config.ts lib/i18n/translate.ts lib/i18n/translate.test.ts
rtk git commit -m "feat(i18n): extract pure translate() + recursive Messages type"
```

---

### Task 2: localStorage 永続化 + 言語決定 `locale-store.ts`

**Files:**
- Create: `lib/i18n/locale-store.ts`
- Test: `lib/i18n/locale-store.test.ts`

**Interfaces:**
- Consumes: `SUPPORTED_LOCALES`, `SupportedLocale`, `detectLocale`（`config.ts`、既存）
- Produces: `readStoredLocale(): SupportedLocale | null`、`persistLocale(locale: SupportedLocale): void`、`resolveInitialLocale(): SupportedLocale`

- [ ] **Step 1: 失敗するテストを書く**

`lib/i18n/locale-store.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readStoredLocale, persistLocale, resolveInitialLocale } from './locale-store'

beforeEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('locale-store', () => {
  it('保存された有効な言語を読む', () => {
    window.localStorage.setItem('allmarks-locale', 'fr')
    expect(readStoredLocale()).toBe('fr')
  })
  it('未保存なら null', () => {
    expect(readStoredLocale()).toBeNull()
  })
  it('不正な値は無視して null', () => {
    window.localStorage.setItem('allmarks-locale', 'xx')
    expect(readStoredLocale()).toBeNull()
  })
  it('persistLocale で書き込める', () => {
    persistLocale('ko')
    expect(window.localStorage.getItem('allmarks-locale')).toBe('ko')
  })
  it('resolveInitialLocale は保存値を最優先', () => {
    window.localStorage.setItem('allmarks-locale', 'de')
    expect(resolveInitialLocale()).toBe('de')
  })
  it('保存値なしならブラウザ言語(navigator)で判定', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['es-ES', 'es'])
    expect(resolveInitialLocale()).toBe('es')
  })
  it('対応外ブラウザ言語なら英語フォールバック', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['xx-YY'])
    expect(resolveInitialLocale()).toBe('en')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm vitest run lib/i18n/locale-store.test.ts`
Expected: FAIL（モジュール未解決）

- [ ] **Step 3: 最小実装を書く**

`lib/i18n/locale-store.ts`:
```ts
import { SUPPORTED_LOCALES, type SupportedLocale, detectLocale } from './config'

const STORAGE_KEY = 'allmarks-locale'

/** localStorage に保存された言語を読む（無効値・未保存・localStorage 不可は null）。 */
export function readStoredLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v && (SUPPORTED_LOCALES as readonly string[]).includes(v)) {
      return v as SupportedLocale
    }
  } catch {
    /* localStorage blocked (private mode 等) */
  }
  return null
}

/** 選択言語を localStorage に保存（不可なら黙って無視）。 */
export function persistLocale(locale: SupportedLocale): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
}

/** 初期言語: 保存値 → ブラウザ言語 → 英語。 */
export function resolveInitialLocale(): SupportedLocale {
  return readStoredLocale() ?? detectLocale()
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm vitest run lib/i18n/locale-store.test.ts`
Expected: PASS（7 tests）

- [ ] **Step 5: コミット**

```bash
rtk git add lib/i18n/locale-store.ts lib/i18n/locale-store.test.ts
rtk git commit -m "feat(i18n): localStorage persistence + locale resolution"
```

---

### Task 3: `I18nProvider` + `useI18n()` フック

**Files:**
- Create: `lib/i18n/I18nProvider.tsx`
- Create: `lib/i18n/test-utils.tsx`
- Test: `lib/i18n/I18nProvider.test.tsx`

**Interfaces:**
- Consumes: `translate`（Task 1）、`resolveInitialLocale`/`persistLocale`（Task 2）、`loadMessages`/`SUPPORTED_LOCALES`/`SupportedLocale`/`Messages`（`config.ts`）、`@/messages/en.json`
- Produces:
  - `I18nProvider(props: { children: ReactNode; initialLocale?: SupportedLocale; initialMessages?: Messages }): React.ReactElement`
  - `useI18n(): { locale: SupportedLocale; t: (key: string) => string; setLocale: (next: SupportedLocale) => void }`
  - `renderWithLocale(ui, locale, messages)`（`test-utils.tsx`、`@testing-library/react` の `render` 戻り値を返す）

- [ ] **Step 1: 失敗するテストを書く**

`lib/i18n/I18nProvider.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// loadMessages を決定的にモック（動的 import を避ける）
vi.mock('./config', async (orig) => {
  const actual = await orig<typeof import('./config')>()
  return {
    ...actual,
    loadMessages: vi.fn(async (locale: string) =>
      locale === 'ja' ? { sample: { hi: 'こんにちは' } } : { sample: { hi: 'hello' } },
    ),
  }
})

import { I18nProvider, useI18n } from './I18nProvider'

function Probe(): React.ReactElement {
  const { locale, t, setLocale } = useI18n()
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="text">{t('sample.hi')}</span>
      <button onClick={() => setLocale('ja')}>switch-ja</button>
    </div>
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('I18nProvider / useI18n', () => {
  it('プロバイダ外でも throw せず英語フォールバックで t() が動く', () => {
    render(<Probe />)
    // en.json の実値（固定英語語彙）。'board.chrome.tune' は 'TUNE'。
    function EnProbe(): React.ReactElement {
      const { t } = useI18n()
      return <span data-testid="en">{t('board.chrome.tune')}</span>
    }
    render(<EnProbe />)
    expect(screen.getByTestId('en').textContent).toBe('TUNE')
  })

  it('initialLocale/initialMessages 指定で同期描画(テスト用)', () => {
    render(
      <I18nProvider initialLocale="ja" initialMessages={{ sample: { hi: 'やあ' } }}>
        <Probe />
      </I18nProvider>,
    )
    expect(screen.getByTestId('locale').textContent).toBe('ja')
    expect(screen.getByTestId('text').textContent).toBe('やあ')
  })

  it('setLocale で言語が切り替わり localStorage に保存される', async () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )
    fireEvent.click(screen.getByText('switch-ja'))
    await waitFor(() => expect(screen.getByTestId('text').textContent).toBe('こんにちは'))
    expect(screen.getByTestId('locale').textContent).toBe('ja')
    expect(window.localStorage.getItem('allmarks-locale')).toBe('ja')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm vitest run lib/i18n/I18nProvider.test.tsx`
Expected: FAIL（`I18nProvider` 未解決）

- [ ] **Step 3: 最小実装を書く**

`lib/i18n/I18nProvider.tsx`:
```tsx
'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import en from '@/messages/en.json'
import { SUPPORTED_LOCALES, type SupportedLocale, type Messages, loadMessages } from './config'
import { translate } from './translate'
import { resolveInitialLocale, persistLocale } from './locale-store'

const BAKED_DEFAULT_LOCALE: SupportedLocale = 'en'
const bakedMessages = en as Messages

type I18nValue = {
  locale: SupportedLocale
  t: (key: string) => string
  setLocale: (next: SupportedLocale) => void
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({
  children,
  initialLocale,
  initialMessages,
}: {
  children: ReactNode
  initialLocale?: SupportedLocale
  initialMessages?: Messages
}): React.ReactElement {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale ?? BAKED_DEFAULT_LOCALE)
  const [messages, setMessages] = useState<Messages>(initialMessages ?? bakedMessages)

  // 初回 mount（クライアントのみ）で実際の言語を解決して読み込む。
  // initialLocale 指定時（テスト/明示）は自動解決しない。
  useEffect(() => {
    if (initialLocale) return
    const resolved = resolveInitialLocale()
    if (resolved === BAKED_DEFAULT_LOCALE) return
    let cancelled = false
    loadMessages(resolved).then((m) => {
      if (cancelled) return
      setLocaleState(resolved)
      setMessages(m)
    })
    return () => {
      cancelled = true
    }
  }, [initialLocale])

  const setLocale = useCallback((next: SupportedLocale): void => {
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(next)) return
    persistLocale(next)
    void loadMessages(next).then((m) => {
      setLocaleState(next)
      setMessages(m)
    })
  }, [])

  const value = useMemo<I18nValue>(
    () => ({ locale, t: (key: string) => translate(messages, key), setLocale }),
    [locale, messages, setLocale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// プロバイダ外で使われたとき（独立コンポーネントテスト・save popup 等）の安全な既定値。
// 英語ベイク・no-op setLocale。throw しない。
const FALLBACK: I18nValue = {
  locale: BAKED_DEFAULT_LOCALE,
  t: (key: string) => translate(bakedMessages, key),
  setLocale: () => {},
}

export function useI18n(): I18nValue {
  return useContext(I18nContext) ?? FALLBACK
}
```

`lib/i18n/test-utils.tsx`:
```tsx
import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18nProvider } from './I18nProvider'
import type { SupportedLocale, Messages } from './config'

/** 指定 locale/messages を同期注入して render する（プロバイダ依存コンポーネントのテスト用）。 */
export function renderWithLocale(
  ui: ReactElement,
  locale: SupportedLocale,
  messages: Messages,
): RenderResult {
  return render(
    <I18nProvider initialLocale={locale} initialMessages={messages}>
      {ui}
    </I18nProvider>,
  )
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm vitest run lib/i18n/I18nProvider.test.tsx`
Expected: PASS（3 tests）

- [ ] **Step 5: コミット**

```bash
rtk git add lib/i18n/I18nProvider.tsx lib/i18n/test-utils.tsx lib/i18n/I18nProvider.test.tsx
rtk git commit -m "feat(i18n): I18nProvider + useI18n hook with safe out-of-provider fallback"
```

---

### Task 4: `I18nProvider` を (app) レイアウトに設置

**Files:**
- Modify: `app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `I18nProvider`（Task 3）

- [ ] **Step 1: レイアウトを変更**

`app/(app)/layout.tsx` を全置換:
```tsx
import { I18nProvider } from '@/lib/i18n/I18nProvider'

type AppLayoutProps = {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps): React.ReactElement {
  return (
    <I18nProvider>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </I18nProvider>
  )
}
```

- [ ] **Step 2: 型チェックとテスト**

Run: `pnpm tsc --noEmit && pnpm vitest run lib/i18n`
Expected: tsc 0 errors、i18n テスト全 PASS

- [ ] **Step 3: コミット**

```bash
rtk git add "app/(app)/layout.tsx"
rtk git commit -m "feat(i18n): mount I18nProvider in (app) layout"
```

---

### Task 5a: board コア6ファイルを `useI18n()` に移行

**Files:**
- Modify: `components/board/BoardRoot.tsx`、`components/board/TuneTrigger.tsx`、`components/board/Sidebar.tsx`、`components/board/Lightbox.tsx`、`components/board/DisplayModeSwitch.tsx`、`components/board/PrecisionSlider.tsx`

**Interfaces:**
- Consumes: `useI18n`（Task 3）

各ファイルで同一の機械的変換を行う:
1. `import { t } from '@/lib/i18n/t'` の行を削除。
2. `import { useI18n } from '@/lib/i18n/I18nProvider'` を追加(他の `@/lib/...` import 群の近くに)。
3. コンポーネント関数の本体先頭(他のフック呼び出しと並ぶ位置)に `const { t } = useI18n()` を追加。
4. 既存の `t(...)` 呼び出しはそのまま(同名の関数として動く)。
5. ファイル先頭に `'use client'` があることを確認(6ファイルとも既存。無ければ追加)。

> 注意: 全 `t()` 呼び出しがコンポーネント関数スコープ内にあることは確認済み(module スコープや非フック関数からの呼び出しは無い)。`PrecisionSlider.tsx:266` は JSX ではなくコメントなので対象外。

- [ ] **Step 1: 6ファイルを上記手順で変換**

(各ファイル、import 2行の差し替え + 本体先頭 1行追加。)

- [ ] **Step 2: 型チェック + 関連テスト**

Run: `pnpm tsc --noEmit && pnpm vitest run components/board`
Expected: tsc 0 errors。`components/board` のテスト全 PASS(`TuneTrigger.test` の `'TUNE'` 等は en/ja 同値の固定英語語彙なので、プロバイダ外フォールバック=英語でも変わらず緑)。

- [ ] **Step 3: コミット**

```bash
rtk git add components/board/BoardRoot.tsx components/board/TuneTrigger.tsx components/board/Sidebar.tsx components/board/Lightbox.tsx components/board/DisplayModeSwitch.tsx components/board/PrecisionSlider.tsx
rtk git commit -m "refactor(i18n): board core components use useI18n() hook"
```

---

### Task 5b: triage / bookmarklet 4ファイルを移行 + 旧 `t.ts` 削除 + 全スイート緑化

**Files:**
- Modify: `components/triage/TriagePage.tsx`、`components/bookmarklet/BookmarkletInstall.tsx`、`components/bookmarklet/BookmarkletInstallModal.tsx`、`components/bookmarklet/EmptyStateWelcome.tsx`
- Modify(テスト): `components/bookmarklet/EmptyStateWelcome.test.tsx`、`components/bookmarklet/BookmarkletInstallModal.test.tsx`、`components/bookmarklet/BookmarkletInstall.test.tsx`
- Delete: `lib/i18n/t.ts`

**Interfaces:**
- Consumes: `useI18n`（Task 3）、`renderWithLocale`（Task 3 の `test-utils.tsx`）

- [ ] **Step 1: 4ファイルを Task 5a と同じ手順で `useI18n()` に変換**

(`import { t }` 削除 → `import { useI18n }` 追加 → 本体先頭に `const { t } = useI18n()`。4ファイルとも既存で `'use client'`。)

- [ ] **Step 2: 旧 `t.ts` を削除し、残存 importer が無いことを確認**

```bash
rm lib/i18n/t.ts
rtk grep "lib/i18n/t'" -- "*.tsx" "*.ts"
```
Expected: grep ヒット 0（docs 内の言及は無視してよい。コードは 0 件）

- [ ] **Step 3: 全スイートを走らせ、日本語 assert の3テストが落ちることを確認**

Run: `pnpm vitest run components/bookmarklet`
Expected: FAIL。`EmptyStateWelcome.test`(`'ブックマークをはじめよう'` 他)、`BookmarkletInstallModal.test`(`/閉じる/`)、`BookmarkletInstall.test`(`'ブックマークレット'`)が、英語フォールバックで日本語が出ず失敗。

- [ ] **Step 4: 3テストを ja 注入 provider で包むよう修正**

各テストの `render(...)` を `renderWithLocale(..., 'ja', jaMessages)` に置換する。`jaMessages` は `import ja from '@/messages/ja.json'` で読み、`as Messages` でキャスト。

`components/bookmarklet/EmptyStateWelcome.test.tsx` の冒頭 import に追加:
```ts
import ja from '@/messages/ja.json'
import type { Messages } from '@/lib/i18n/config'
import { renderWithLocale } from '@/lib/i18n/test-utils'
```
そして各 `render(<EmptyStateWelcome ... />)` を次に置換:
```ts
renderWithLocale(<EmptyStateWelcome /* 既存 props */ />, 'ja', ja as Messages)
```
(props は既存のまま。`screen` ベースの assert はそのまま日本語で通る。)

`BookmarkletInstallModal.test.tsx` / `BookmarkletInstall.test.tsx` も同様に import 追加 + `render(...)` → `renderWithLocale(..., 'ja', ja as Messages)` に置換。

> なぜ英語に書き換えず ja で包むか: これらは「日本語UIが正しく出るか」を見るテストなので、意図を保つには ja を注入して同じ日本語を assert するのが faithful。

- [ ] **Step 5: bookmarklet テストが通ることを確認**

Run: `pnpm vitest run components/bookmarklet components/triage`
Expected: PASS

- [ ] **Step 6: 全スイート + 型チェック**

Run: `pnpm tsc --noEmit && pnpm vitest run`
Expected: tsc 0 errors、全テスト PASS(セッション105時点 1019+ 件を下回らない)

- [ ] **Step 7: コミット**

```bash
rtk git add components/triage/TriagePage.tsx components/bookmarklet/ lib/i18n/
rtk git commit -m "refactor(i18n): migrate triage+bookmarklet to useI18n, drop static t.ts, wrap ja tests"
```

---

### Task 6: `LanguageSwitcher` コンポーネント(機能完成)

**Files:**
- Modify: `lib/i18n/config.ts`（`LANGUAGE_ENDONYMS` 追加）
- Create: `components/board/LanguageSwitcher.tsx` + `components/board/LanguageSwitcher.module.css`
- Test: `components/board/LanguageSwitcher.test.tsx`

**Interfaces:**
- Consumes: `useI18n`（Task 3）、`SUPPORTED_LOCALES`/`LANGUAGE_ENDONYMS`（`config.ts`）
- Produces: `LanguageSwitcher(): React.ReactElement`

- [ ] **Step 1: `config.ts` に endonym を追加**

`lib/i18n/config.ts` の末尾に追加:
```ts
/** 各言語を「その言語自身の表記」で出すための辞書(言語切替UI用)。 */
export const LANGUAGE_ENDONYMS: Record<SupportedLocale, string> = {
  ja: '日本語',
  en: 'English',
  zh: '中文',
  ko: '한국어',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  it: 'Italiano',
  nl: 'Nederlands',
  tr: 'Türkçe',
  ru: 'Русский',
  ar: 'العربية',
  th: 'ไทย',
  vi: 'Tiếng Việt',
}
```

- [ ] **Step 2: 失敗するテストを書く**

`components/board/LanguageSwitcher.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { LanguageSwitcher } from './LanguageSwitcher'

function setup(): void {
  render(
    <I18nProvider>
      <LanguageSwitcher />
    </I18nProvider>,
  )
}

describe('LanguageSwitcher', () => {
  it('畳んだ状態で現在の言語コードを大文字で出す(既定 EN)', () => {
    setup()
    const toggle = screen.getByTestId('language-switcher-toggle')
    expect(toggle.textContent).toContain('EN')
  })
  it('開くと各言語が endonym で並ぶ', () => {
    setup()
    fireEvent.click(screen.getByTestId('language-switcher-toggle'))
    expect(screen.getByText('日本語')).not.toBeNull()
    expect(screen.getByText('English')).not.toBeNull()
    expect(screen.getByText('中文')).not.toBeNull()
    expect(screen.getByText('한국어')).not.toBeNull()
  })
  it('外側 pointerdown(capture)で閉じる', () => {
    setup()
    fireEvent.click(screen.getByTestId('language-switcher-toggle'))
    expect(screen.queryByText('日本語')).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByText('日本語')).toBeNull()
  })
})
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `pnpm vitest run components/board/LanguageSwitcher.test.tsx`
Expected: FAIL（`LanguageSwitcher` 未解決）

- [ ] **Step 4: 最小実装を書く**

`components/board/LanguageSwitcher.tsx`:
```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { SUPPORTED_LOCALES, LANGUAGE_ENDONYMS, type SupportedLocale } from '@/lib/i18n/config'
import styles from './LanguageSwitcher.module.css'

/** 右下に置く言語切替。畳=🌐+コード、開=各言語の endonym リスト。 */
export function LanguageSwitcher(): React.ReactElement {
  const { locale, setLocale } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // 外側クリックで閉じる（board の InteractionLayer は bubble の mousedown を握り潰すため
  // capture フェーズ pointerdown で判定する。memory: reference_board_outside_click_capture_pointerdown）
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open])

  const pick = useCallback(
    (next: SupportedLocale): void => {
      setLocale(next)
      setOpen(false)
    },
    [setLocale],
  )

  return (
    <div ref={rootRef} className={styles.root}>
      {open && (
        <ul className={styles.list} role="listbox" aria-label="Language">
          {SUPPORTED_LOCALES.map((loc) => (
            <li key={loc}>
              <button
                type="button"
                className={styles.option}
                aria-selected={loc === locale}
                onClick={() => pick(loc)}
              >
                {LANGUAGE_ENDONYMS[loc]}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        data-testid="language-switcher-toggle"
        className={styles.toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden className={styles.globe}>🌐</span>
        <span className={styles.code}>{locale.toUpperCase()}</span>
      </button>
    </div>
  )
}
```

`components/board/LanguageSwitcher.module.css`（最小・暫定スタイル。見た目は Task 7 で user 確認後に調整）:
```css
.root {
  position: fixed;
  right: 16px;
  bottom: 14px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  font-family: var(--font-geist-mono, monospace);
}
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 6px 10px;
  background: rgba(10, 10, 10, 0.72);
  color: #e8e8e8;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px;
  font-size: 12px;
  letter-spacing: 0.06em;
  cursor: pointer;
  backdrop-filter: blur(8px);
}
.globe { font-size: 14px; line-height: 1; }
.code { font-weight: 600; }
.list {
  list-style: none;
  margin: 0;
  padding: 6px;
  max-height: 320px;
  overflow-y: auto;
  background: rgba(10, 10, 10, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  backdrop-filter: blur(8px);
}
.option {
  display: block;
  width: 100%;
  text-align: right;
  padding: 7px 12px;
  min-height: 32px;
  background: transparent;
  color: #cfcfcf;
  border: 0;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}
.option:hover { background: rgba(255, 255, 255, 0.07); color: #fff; }
.option[aria-selected='true'] { color: #fff; }
```

> z-index: 既存の board chrome レイヤより前面に出す必要があれば、`lib/board/constants.ts`（または該当 z-index 定数ファイル）に `LANGUAGE_SWITCHER` を定義して `.root` に適用する。実装時に既存 z-index 定数を確認して魔法の数値を避ける。

- [ ] **Step 5: テストが通ることを確認**

Run: `pnpm vitest run components/board/LanguageSwitcher.test.tsx`
Expected: PASS（3 tests）

- [ ] **Step 6: コミット**

```bash
rtk git add lib/i18n/config.ts components/board/LanguageSwitcher.tsx components/board/LanguageSwitcher.module.css components/board/LanguageSwitcher.test.tsx
rtk git commit -m "feat(i18n): LanguageSwitcher (globe + endonym list) with safe outside-click close"
```

---

### Task 7: `LanguageSwitcher` を board 右下に表示 + user 視覚確認

**Files:**
- Modify: `components/board/BoardRoot.tsx`（`LanguageSwitcher` を描画）

**Interfaces:**
- Consumes: `LanguageSwitcher`（Task 6）

- [ ] **Step 1: BoardRoot に描画を追加**

`components/board/BoardRoot.tsx` の import に追加:
```tsx
import { LanguageSwitcher } from './LanguageSwitcher'
```
board chrome の最上位 JSX(左下のブックマークレット handle と同階層の固定配置レイヤ)に `<LanguageSwitcher />` を1行追加する。`position: fixed` で自立しているので挿入位置は描画ツリー末尾付近で可。

> 実装者は BoardRoot の return 内で、ブックマークレット系（`BookmarkletInstall` 等）を描画している固定レイヤ付近に置くこと。下部の波形メーター（ScrollMeter）と重ならない right/bottom か実機で確認。

- [ ] **Step 2: 型チェック + ビルド**

Run: `pnpm tsc --noEmit && pnpm build`
Expected: tsc 0 errors、build 成功（`out/` 生成）

- [ ] **Step 3: 本番デプロイ**

```bash
npx wrangler whoami
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="i18n locale switcher"
```

- [ ] **Step 4: user 視覚確認(承認ゲート)**

`allmarks.app` をハードリロードしてもらい、次を確認:
- 右下に `🌐 JA`(日本語ブラウザなら)が出るか
- 押すと各言語の endonym リストが出るか
- 言語を選ぶと画面が即切り替わるか(リロード不要)
- 下部メーター・余白と重なっていないか、見た目(地球儀の形・色・畳み形)の調整希望

> 見た目の微調整(座標・色・開閉アニメ・MOTION OFF 時の挙動)は、user フィードバックを受けてから別 step で対応する。デザイン変更は承認フロー厳守。

---

### Task 8: 最終検証 + ドキュメント更新

**Files:**
- Modify: `docs/TODO.md`、`docs/CURRENT_GOAL.md`、`docs/TODO_COMPLETED.md`

- [ ] **Step 1: 全検証**

Run: `pnpm tsc --noEmit && pnpm vitest run && pnpm build`
Expected: tsc 0 / 全テスト PASS / build 成功

- [ ] **Step 2: 本番実機の言語切替を確認**

`allmarks.app` で、別言語のブラウザ(または開発者ツールで `navigator.languages` 上書き / localStorage `allmarks-locale` 設定)で初回判定が効くか、切替が永続するか(リロードしても保持)を確認。

- [ ] **Step 3: ドキュメント更新 + コミット**

`docs/TODO.md`「現在の状態」をセッション106(層① 完了)に更新、`docs/CURRENT_GOAL.md` を次セッション(LP 作り直し ③ + 層② 配線、または onboarding)に上書き、`docs/TODO_COMPLETED.md` に narrative 追記。

```bash
rtk git add docs/
rtk git commit -m "docs(session-106): i18n layer-1 (app runtime locale switch) shipped"
rtk git push
```

---

## 自己レビュー結果

**1. Spec coverage:** 設計書 §4(層①)を全カバー — 4.1 仕組み=Task 3、4.2 言語決定順=Task 2、4.3 ちらつき対策(英語ベイク+mount swap)=Task 3、4.4 既存移行=Task 5a/5b、4.5 言語切替UI=Task 6/7、4.6 不変=Global Constraints。§5(層②)は明示的にスコープ外(本計画では扱わない=設計書通り)。§7 エッジケース(localStorage 不可・未対応言語・SSR)=Task 2/3 のテストでカバー。§8 テスト=各 Task の TDD + Task 8 全検証。

**2. Placeholder scan:** TBD/TODO/「適切に」等の曖昧表現なし。全コードステップに実コードを記載。

**3. Type consistency:** `Messages`(再帰型, Task 1)→ `translate`/`loadMessages`/Provider で一貫。`SupportedLocale` は config.ts 既存。`useI18n()` 戻り値 `{ locale, t, setLocale }` を Task 3 で定義し Task 5a/5b/6 で同名利用。`renderWithLocale(ui, locale, messages)` を Task 3 で定義し Task 5b で利用。`LANGUAGE_ENDONYMS`(Task 6 config.ts)→ LanguageSwitcher で利用。整合。
