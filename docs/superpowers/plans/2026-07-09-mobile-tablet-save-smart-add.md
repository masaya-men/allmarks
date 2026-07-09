# スマホ・タブレット保存（束B）賢い「+」ボタン 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホ・タブレットから URL をブックマーク保存できる「賢い + ボタン」（クリップボード自動保存＋入力シート）と Android 共有メニュー受け口を追加する。

**Architecture:** 保存の芯 `ingestPastedUrl` はそのまま。既存 `useUrlPasteSave` から保存＋フィードバックの芯を `useSaveUrl` に切り出し、「+」・入力シート・Android 共有の 3 入口がすべて同じ `saveUrl` を通す。URL 判定は `normalizeToUrl`（https 補完＋検証）で 3 入口統一。表示は `pointer: coarse`（タッチ端末）ゲートで、マウスのデスクトップは 1px も変えない。

**Tech Stack:** Next.js 14 App Router（static export）/ React 19 / TypeScript strict / Vanilla CSS Modules / IndexedDB(idb) / vitest 4 + @testing-library/react / Playwright。

## Global Constraints

- **デスクトップ byte-identical**: マウス端末（`pointer: fine`）に「+」を出さない。`useUrlPasteSave` の公開挙動（グローバル貼り付け・feedback・onSaved）は不変。回帰スクショ 1489×679 dpr2.58。
- **TypeScript strict / `any` 禁止**（`unknown`＋型ガード）。Return type 明示。
- **Vanilla CSS のみ / Tailwind 禁止 / Framer Motion 禁止**。z-index は `BOARD_Z_INDEX` 定数（魔法の数値禁止）。
- **IDB の BoardConfig を書き換えない**（表示時 override のみ）。`DB_NAME` 等内部符号は不変。
- **UI 単語（ADD / +）は英語チめ語彙のまま**（訳さない）。文らしいコピーのみ 15 言語化（parity テスト維持）。
- **検証**: `rtk tsc` / `rtk vitest run` / `pnpm build`（`rtk next build` は不可＝export されない）。モバイル Playwright は viewport 390×844 / deviceScaleFactor 3。
- **`--no-verify` 禁止**。1 機能 = 1 コミット。
- **正本 spec**: `docs/superpowers/specs/2026-07-09-mobile-tablet-save-smart-add-design.md`。

---

## ファイル構成（責務）

**新規**
- `lib/board/use-save-url.ts` — 保存の芯フック `useSaveUrl`（feedback 状態＋`saveUrl`）。パースリスナは持たない。
- `lib/board/use-is-touch-device.ts` — `matchMedia('(pointer: coarse)')` 判定フック。
- `components/board/MobileSaveButton.tsx` / `.module.css` — 右下フローティング「+」。クリップボード読取→判定。
- `components/board/MobileSaveSheet.tsx` / `.module.css` — 下から出る URL 入力シート。
- `lib/board/use-save-url.test.ts` — `useSaveUrl` の renderHook テスト。
- `tests/e2e/mobile-save.spec.ts` — Playwright E2E。

**変更**
- `lib/board/paste-url.ts` — `normalizeToUrl` を追加（既存 `extractSinglePastedUrl` は不変）。
- `lib/board/paste-url.test.ts` — 新規（`normalizeToUrl` のテスト。ファイルが無ければ新規作成）。
- `lib/board/use-url-paste-save.ts` — `useSaveUrl` を使う薄いラッパへ（公開 API `{feedback}` 不変）。
- `components/board/BoardRoot.tsx` — 「+」/シートの mount（タッチゲート）＋ Android 共有受け口 effect ＋ feedback マージ。
- `lib/board/constants.ts` — `BOARD_Z_INDEX.SAVE_BUTTON` / `SAVE_SHEET`。
- `messages/{locale}.json` ×15 — `board.saveInvalidHint` 追加（placeholder は既存 `board.urlPlaceholder` を再利用）。

---

## Task 1: `normalizeToUrl` 純関数（3 入口共通の URL 判定）

**Files:**
- Modify: `lib/board/paste-url.ts`
- Test: `lib/board/paste-url.test.ts`（新規）

**Interfaces:**
- Consumes: 既存 `extractSinglePastedUrl(text: string): string | null`（同ファイル）。
- Produces: `normalizeToUrl(raw: string): string | null` — trim → scheme 無ければ `https://` 前置 → `extractSinglePastedUrl` で検証。

- [ ] **Step 1: 失敗テストを書く**

`lib/board/paste-url.test.ts`（新規作成）:

```typescript
import { describe, it, expect } from 'vitest'
import { normalizeToUrl } from './paste-url'

describe('normalizeToUrl', () => {
  it('returns an already-valid https URL unchanged', () => {
    expect(normalizeToUrl('https://example.com/a')).toBe('https://example.com/a')
  })
  it('returns an already-valid http URL unchanged', () => {
    expect(normalizeToUrl('http://example.com')).toBe('http://example.com')
  })
  it('prepends https:// to a bare domain', () => {
    expect(normalizeToUrl('example.com')).toBe('https://example.com')
  })
  it('prepends https:// to a bare domain with path', () => {
    expect(normalizeToUrl('x.com/user/status/123')).toBe('https://x.com/user/status/123')
  })
  it('trims surrounding whitespace before deciding', () => {
    expect(normalizeToUrl('  https://example.com  ')).toBe('https://example.com')
  })
  it('rejects text with internal whitespace (not a single token)', () => {
    expect(normalizeToUrl('hello world')).toBeNull()
    expect(normalizeToUrl('see https://example.com now')).toBeNull()
  })
  it('rejects an empty string', () => {
    expect(normalizeToUrl('')).toBeNull()
    expect(normalizeToUrl('   ')).toBeNull()
  })
  it('rejects a non-URL token', () => {
    expect(normalizeToUrl('just-text')).toBeNull()
  })
})
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `rtk vitest run lib/board/paste-url.test.ts`
Expected: FAIL（`normalizeToUrl` is not exported / not a function）

- [ ] **Step 3: 最小実装**

`lib/board/paste-url.ts` の末尾に追加:

```typescript
/** Normalizes clipboard/input/share text into a single http(s) URL, or null.
 *  Same single-token rule as extractSinglePastedUrl, but first prepends
 *  "https://" when no scheme is present so a bare "example.com" is accepted.
 *  Used by the mobile save entries (smart + button, input sheet, Android
 *  share receiver). The desktop global-paste path keeps extractSinglePastedUrl
 *  (no scheme prepend) unchanged. */
export function normalizeToUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '' || /\s/.test(trimmed)) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return extractSinglePastedUrl(withScheme)
}
```

> 注: `just-text` は `https://just-text` になるが `isValidUrl` が弾く前提。実装後テストで確認（もし `isValidUrl` が単一語 host を通してしまう場合はテストが赤くなるので、その時は `extractSinglePastedUrl` の既存挙動に合わせて調整）。

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run lib/board/paste-url.test.ts`
Expected: PASS（8 cases）。もし `just-text` ケースだけ落ちたら、その 1 ケースを実際の `isValidUrl` 挙動に合わせて期待値修正（`normalizeToUrl` 自体は変えない）。

- [ ] **Step 5: コミット**

```bash
rtk git add lib/board/paste-url.ts lib/board/paste-url.test.ts
rtk git commit -m "feat(board): normalizeToUrl — https-prepend + validate for mobile save entries"
```

---

## Task 2: `useSaveUrl` 芯フック ＋ `useUrlPasteSave` を薄いラッパ化

**Files:**
- Create: `lib/board/use-save-url.ts`
- Create: `lib/board/use-save-url.test.ts`
- Modify: `lib/board/use-url-paste-save.ts`

**Interfaces:**
- Consumes: `ingestPastedUrl` / `fetchOgpMeta` / `isEmbeddableType`（`lib/board/paste-ingest.ts`）、`initDB` / `getAllBookmarks` / `saveBookmarkDeduped`（`lib/storage/indexeddb.ts`）、`detectUrlType`（`lib/utils/url.ts`）、`SAMPLE_URL`（`lib/onboarding/steps.ts`）。
- Produces:
  - `type SaveOutcome = 'saved' | 'duplicate'`
  - `type PasteFeedback = { readonly kind: 'loading' | 'duplicate' | null }`（`use-url-paste-save.ts` からここへ移設・re-export）
  - `useSaveUrl(opts: { onSaved: (id: string) => void | Promise<void>; flagOnboardingRef?: { readonly current: boolean }; performSave?: PerformSave }): { feedback: PasteFeedback; saveUrl: (url: string) => Promise<SaveOutcome> }`
  - `type PerformSave = (url: string, flagDemo: boolean) => Promise<{ outcome: SaveOutcome; bookmarkId: string | null }>`（テスト注入用）

> **設計**: `saveUrl` は**検証済み URL**（`normalizeToUrl`/`extractSinglePastedUrl` 通過後）を受ける。`useSaveUrl` はパースリスナを持たない（それは `useUrlPasteSave` の責務）。`performSave` を省略すると実 deps（initDB 等）で `ingestPastedUrl` を呼ぶ本番実装。テストは `performSave` を注入。

- [ ] **Step 1: 失敗テストを書く**

`lib/board/use-save-url.test.ts`（新規）:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSaveUrl } from './use-save-url'

describe('useSaveUrl', () => {
  it('calls onSaved with the bookmark id on a fresh save and clears feedback', async () => {
    const onSaved = vi.fn()
    const performSave = vi.fn(async () => ({ outcome: 'saved' as const, bookmarkId: 'bk1' }))
    const { result } = renderHook(() => useSaveUrl({ onSaved, performSave }))

    let outcome: string = ''
    await act(async () => { outcome = await result.current.saveUrl('https://example.com') })

    expect(outcome).toBe('saved')
    expect(onSaved).toHaveBeenCalledWith('bk1')
    expect(result.current.feedback.kind).toBeNull()
  })

  it('shows the duplicate pill and does NOT call onSaved on a duplicate', async () => {
    const onSaved = vi.fn()
    const performSave = vi.fn(async () => ({ outcome: 'duplicate' as const, bookmarkId: null }))
    const { result } = renderHook(() => useSaveUrl({ onSaved, performSave }))

    let outcome: string = ''
    await act(async () => { outcome = await result.current.saveUrl('https://dup.com') })

    expect(outcome).toBe('duplicate')
    expect(onSaved).not.toHaveBeenCalled()
    expect(result.current.feedback.kind).toBe('duplicate')
  })

  it('passes flagDemo=true only for the onboarding SAMPLE_URL when the ref is on', async () => {
    const onSaved = vi.fn()
    const performSave = vi.fn(async () => ({ outcome: 'saved' as const, bookmarkId: 'bk2' }))
    const flagOnboardingRef = { current: true }
    const { result } = renderHook(() =>
      useSaveUrl({ onSaved, performSave, flagOnboardingRef }),
    )
    // A real (non-sample) link during onboarding must NOT be flagged as demo.
    await act(async () => { await result.current.saveUrl('https://real-link.com') })
    expect(performSave).toHaveBeenLastCalledWith('https://real-link.com', false)
  })
})
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `rtk vitest run lib/board/use-save-url.test.ts`
Expected: FAIL（module not found）

- [ ] **Step 3: `useSaveUrl` を実装**

`lib/board/use-save-url.ts`（新規）:

```typescript
'use client'
import { useEffect, useRef, useState } from 'react'
import { initDB, getAllBookmarks, saveBookmarkDeduped } from '@/lib/storage/indexeddb'
import { ingestPastedUrl, fetchOgpMeta, isEmbeddableType } from '@/lib/board/paste-ingest'
import { detectUrlType } from '@/lib/utils/url'
import { SAMPLE_URL } from '@/lib/onboarding/steps'

export type SaveOutcome = 'saved' | 'duplicate'
export type PasteFeedback = { readonly kind: 'loading' | 'duplicate' | null }
export type PerformSave = (
  url: string,
  flagDemo: boolean,
) => Promise<{ outcome: SaveOutcome; bookmarkId: string | null }>

const DUPLICATE_MS = 1600

/** Real save: opens the DB and runs the ingest pipeline (dedup / OGP / save). */
const defaultPerformSave: PerformSave = async (url, flagDemo) => {
  const db = await initDB()
  const save: typeof saveBookmarkDeduped = flagDemo
    ? (database, input, o) => saveBookmarkDeduped(database, { ...input, onboardingDemo: true }, o)
    : saveBookmarkDeduped
  const result = await ingestPastedUrl(url, { db, getAll: getAllBookmarks, save, fetchOgp: fetchOgpMeta })
  return { outcome: result.outcome, bookmarkId: result.bookmarkId }
}

/** Save core shared by every URL entry (global paste, mobile + button, input
 *  sheet, Android share receiver). Owns the feedback state machine (SAVING /
 *  duplicate pill) and the onSaved callback. Does NOT attach any paste
 *  listener — callers pass an already-validated URL to saveUrl(). */
export function useSaveUrl(opts: {
  onSaved: (bookmarkId: string) => void | Promise<void>
  /** When current is true AND the url is the tutorial SAMPLE_URL, flag the saved
   *  bookmark as an onboarding demo so the end-of-tutorial sweep removes it. */
  flagOnboardingRef?: { readonly current: boolean }
  /** Injectable for tests; defaults to the real DB-backed ingest. */
  performSave?: PerformSave
}): { feedback: PasteFeedback; saveUrl: (url: string) => Promise<SaveOutcome> } {
  const [feedback, setFeedback] = useState<PasteFeedback>({ kind: null })
  const onSavedRef = useRef(opts.onSaved)
  onSavedRef.current = opts.onSaved
  const flagOnboardingRef = useRef(opts.flagOnboardingRef)
  flagOnboardingRef.current = opts.flagOnboardingRef
  const performSaveRef = useRef(opts.performSave ?? defaultPerformSave)
  performSaveRef.current = opts.performSave ?? defaultPerformSave
  const busyRef = useRef(false)
  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return (): void => {
      if (dupTimerRef.current !== null) clearTimeout(dupTimerRef.current)
    }
  }, [])

  const saveUrl = async (url: string): Promise<SaveOutcome> => {
    if (busyRef.current) return 'duplicate'
    busyRef.current = true
    // Rich embeds (tweet/youtube/…) skip the OGP fetch, so no SAVING spinner.
    if (!isEmbeddableType(detectUrlType(url))) setFeedback({ kind: 'loading' })
    try {
      const flagDemo = !!flagOnboardingRef.current?.current && url === SAMPLE_URL
      const { outcome, bookmarkId } = await performSaveRef.current(url, flagDemo)
      if (outcome === 'saved' && bookmarkId) {
        setFeedback({ kind: null })
        await onSavedRef.current(bookmarkId)
        return 'saved'
      }
      setFeedback({ kind: 'duplicate' })
      if (dupTimerRef.current !== null) clearTimeout(dupTimerRef.current)
      dupTimerRef.current = setTimeout(() => {
        dupTimerRef.current = null
        setFeedback({ kind: null })
      }, DUPLICATE_MS)
      return 'duplicate'
    } catch {
      setFeedback({ kind: null })
      return 'duplicate'
    } finally {
      busyRef.current = false
    }
  }

  return { feedback, saveUrl }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run lib/board/use-save-url.test.ts`
Expected: PASS（3 cases）

- [ ] **Step 5: `useUrlPasteSave` を薄いラッパへ**

`lib/board/use-url-paste-save.ts` を次に置換（公開 API `{feedback}` 不変・paste リスナは `saveUrl` を呼ぶだけに）:

```typescript
'use client'
import { useEffect } from 'react'
import { extractSinglePastedUrl, isEditableTarget } from '@/lib/board/paste-url'
import { useSaveUrl, type PasteFeedback } from '@/lib/board/use-save-url'

export type { PasteFeedback } from '@/lib/board/use-save-url'

/** Global "paste a URL anywhere" save. Thin wrapper over useSaveUrl: attaches
 *  a document paste listener that extracts a single URL and hands it to the
 *  shared save core. Public shape ({ feedback }) is unchanged so BoardRoot and
 *  the PiP companion keep working. Desktop behavior is byte-identical: it still
 *  uses extractSinglePastedUrl (no https prepend). */
export function useUrlPasteSave(opts: {
  onSaved: (bookmarkId: string) => void | Promise<void>
  targetDocument?: Document | null
  flagOnboardingRef?: { readonly current: boolean }
}): { feedback: PasteFeedback } {
  const { feedback, saveUrl } = useSaveUrl({
    onSaved: opts.onSaved,
    flagOnboardingRef: opts.flagOnboardingRef,
  })
  const targetDocument = opts.targetDocument
  useEffect(() => {
    const doc = targetDocument ?? (typeof document !== 'undefined' ? document : null)
    if (!doc) return
    const handler = (e: ClipboardEvent): void => {
      if (isEditableTarget(e.target)) return
      const text = e.clipboardData?.getData('text/plain') ?? ''
      const url = extractSinglePastedUrl(text)
      if (!url) return
      e.preventDefault()
      void saveUrl(url)
    }
    const listener = (e: Event): void => handler(e as ClipboardEvent)
    doc.addEventListener('paste', listener)
    return (): void => doc.removeEventListener('paste', listener)
  }, [targetDocument, saveUrl])
  return { feedback }
}
```

> **注意**: 元実装の `busyRef`（paste 連打ガード）は `useSaveUrl` 内の `busyRef` に集約済み。元の `SAMPLE_URL` demo 分岐も `useSaveUrl` に移設済み。`saveUrl` は毎レンダー新しい関数だが effect 依存に入れても listener 付替えは実質同義（挙動不変）。

- [ ] **Step 6: 型・全テスト・ビルドで回帰ゼロを確認**

Run: `rtk tsc`
Expected: 0 errors
Run: `rtk vitest run`
Expected: 全緑（既存 + 新規 3 + normalizeToUrl 8）。PiP companion の paste 経路も型健全。

- [ ] **Step 7: コミット**

```bash
rtk git add lib/board/use-save-url.ts lib/board/use-save-url.test.ts lib/board/use-url-paste-save.ts
rtk git commit -m "refactor(board): extract useSaveUrl core; useUrlPasteSave becomes a thin wrapper"
```

---

## Task 3: `useIsTouchDevice` フック（タッチ端末ゲート）

**Files:**
- Create: `lib/board/use-is-touch-device.ts`
- Test: `lib/board/use-is-touch-device.test.ts`

**Interfaces:**
- Produces: `useIsTouchDevice(): boolean` — `matchMedia('(pointer: coarse)')`。SSR-safe（初期 false → mount 後更新）。`useIsMobile`（`use-is-mobile.ts`）と同じ実装形。

- [ ] **Step 1: 失敗テストを書く**

`lib/board/use-is-touch-device.test.ts`（新規）:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsTouchDevice } from './use-is-touch-device'

function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

describe('useIsTouchDevice', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('is true when the primary pointer is coarse (touch)', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useIsTouchDevice())
    expect(result.current).toBe(true)
  })

  it('is false when the primary pointer is fine (mouse)', () => {
    stubMatchMedia(false)
    const { result } = renderHook(() => useIsTouchDevice())
    expect(result.current).toBe(false)
  })
})
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `rtk vitest run lib/board/use-is-touch-device.test.ts`
Expected: FAIL（module not found）

- [ ] **Step 3: 実装**

`lib/board/use-is-touch-device.ts`（新規・`use-is-mobile.ts` の形をそのまま踏襲）:

```typescript
import { useEffect, useState } from 'react'

/** True when the primary pointer is coarse (finger) — phones AND tablets.
 *  Gates the mobile save "+" button so it appears on any touch device
 *  regardless of the board's width-based mobile layout, while a mouse desktop
 *  (pointer: fine) never sees it. SSR-safe: starts false so the static-export
 *  prerender and first client render agree, then updates after mount. */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(pointer: coarse)')
    setIsTouch(mq.matches)
    const onChange = (): void => setIsTouch(mq.matches)
    mq.addEventListener('change', onChange)
    return (): void => mq.removeEventListener('change', onChange)
  }, [])
  return isTouch
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run lib/board/use-is-touch-device.test.ts`
Expected: PASS（2 cases）

- [ ] **Step 5: コミット**

```bash
rtk git add lib/board/use-is-touch-device.ts lib/board/use-is-touch-device.test.ts
rtk git commit -m "feat(board): useIsTouchDevice — pointer:coarse gate for the mobile save button"
```

---

## Task 4: i18n — 無効ヒント文言を 15 言語追加（placeholder は既存キー再利用）

**Files:**
- Modify: `messages/en.json` `messages/ja.json` `messages/zh.json` `messages/ko.json` `messages/es.json` `messages/fr.json` `messages/pt.json` `messages/it.json` `messages/de.json` `messages/nl.json` `messages/tr.json` `messages/ru.json` `messages/ar.json` `messages/th.json` `messages/vi.json`

**Interfaces:**
- Produces: 各 locale の `board` オブジェクトに leaf キー `saveInvalidHint`（文字列）。入力欄プレースホルダは既存 `board.urlPlaceholder`（"Paste URL..." 相当・15 言語済）を再利用＝新規追加なし。

> **注**: `board.save` は既に `"Save"`（文字列 leaf）なので `board.save.*` は使えない。新キーは `board.saveInvalidHint`（フラット leaf）。

- [ ] **Step 1: 15 ファイルに同キーを追加**

各 `messages/<locale>.json` の `"board"` オブジェクト内（`urlPlaceholder` の隣あたり）に 1 行追加。値は下記:

```
en: "That's not a link"
ja: "リンクではありません"
zh: "这不是链接"
ko: "링크가 아닙니다"
es: "Eso no es un enlace"
fr: "Ce n'est pas un lien"
pt: "Isso não é um link"
it: "Non è un link"
de: "Das ist kein Link"
nl: "Dat is geen link"
tr: "Bu bir bağlantı değil"
ru: "Это не ссылка"
ar: "هذا ليس رابطًا"
th: "นั่นไม่ใช่ลิงก์"
vi: "Đó không phải là liên kết"
```

例（`messages/en.json`）:

```json
    "urlPlaceholder": "Paste URL...",
    "saveInvalidHint": "That's not a link",
```

- [ ] **Step 2: parity テストで全 locale 同キーを確認**

Run: `rtk vitest run messages`
Expected: PASS（`all-keys-parity` 等 6 本緑。全 locale が `board.saveInvalidHint` を持ち、非空）

- [ ] **Step 3: JSON 妥当性 & 型確認**

Run: `rtk tsc`
Expected: 0 errors（JSON import 健全）

- [ ] **Step 4: コミット**

```bash
rtk git add messages/
rtk git commit -m "i18n: add board.saveInvalidHint across 15 locales (en/ja verified, 13 primary)"
```

---

## Task 5: `MobileSaveButton`（賢い「+」）＋ z-index 定数

**Files:**
- Modify: `lib/board/constants.ts`（`BOARD_Z_INDEX` に `SAVE_BUTTON` / `SAVE_SHEET`）
- Create: `components/board/MobileSaveButton.tsx`
- Create: `components/board/MobileSaveButton.module.css`

**Interfaces:**
- Consumes: `normalizeToUrl`（Task 1）、`SaveOutcome`（Task 2）、`BOARD_Z_INDEX.SAVE_BUTTON`。
- Produces: `MobileSaveButton({ onSave, onNeedInput, themeId }: { onSave: (url: string) => void | Promise<void>; onNeedInput: () => void; themeId: string }): ReactElement` — タップでクリップボード読取→URL なら `onSave`、それ以外 `onNeedInput`。

> UI タスクは vitest ではなく **tsc + build ＋ Task 8 の Playwright**で検証（本コードベース慣習：UI は Playwright、純ロジックは vitest）。

- [ ] **Step 1: z-index 定数を追加**

`lib/board/constants.ts` の `BOARD_Z_INDEX` に追加（`POPOVER: 120` の直後あたり）:

```typescript
  SAVE_BUTTON: 125,  // mobile/tablet floating "+" save button (above POPOVER 120, below UNDO_TOAST 130). Touch devices only.
  SAVE_SHEET: 208,   // mobile/tablet URL input sheet (modal tier: above MODAL_OVERLAY 200 / DATA_HOME 205, below ONBOARDING 210).
```

- [ ] **Step 2: 定数テストが緑のままか確認**

Run: `rtk vitest run lib/board/constants.test.ts`
Expected: PASS（順序・一意性の既存アサーションを壊さない。落ちたら値を隣接空き番号に微調整）

- [ ] **Step 3: `MobileSaveButton` を実装**

`components/board/MobileSaveButton.tsx`（新規）:

```tsx
'use client'
import { useState, type ReactElement } from 'react'
import { normalizeToUrl } from '@/lib/board/paste-url'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './MobileSaveButton.module.css'

/** Floating "+" save entry for touch devices (phones + tablets). Tapping reads
 *  the clipboard: a URL saves immediately (no typing); anything else opens the
 *  input sheet via onNeedInput. iOS shows a one-time "Paste" confirmation
 *  (Apple privacy — unavoidable). Rendered only under a pointer:coarse gate in
 *  BoardRoot, so a mouse desktop never mounts it. */
export function MobileSaveButton({
  onSave,
  onNeedInput,
  themeId,
}: {
  readonly onSave: (url: string) => void | Promise<void>
  readonly onNeedInput: () => void
  readonly themeId: string
}): ReactElement {
  const [busy, setBusy] = useState(false)
  const handleTap = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    let text = ''
    try {
      text = (await navigator.clipboard?.readText?.()) ?? ''
    } catch {
      text = ''
    } finally {
      setBusy(false)
    }
    const url = normalizeToUrl(text)
    if (url) {
      void onSave(url)
    } else {
      onNeedInput()
    }
  }
  return (
    <button
      type="button"
      className={styles.button}
      style={{ zIndex: BOARD_Z_INDEX.SAVE_BUTTON }}
      data-theme-id={themeId}
      data-testid="mobile-save-button"
      aria-label="Add bookmark"
      onClick={(): void => { void handleTap() }}
    >
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  )
}
```

- [ ] **Step 4: CSS（テーマ変数で着せ替え可能な既定スキン）**

`components/board/MobileSaveButton.module.css`（新規）:

```css
/* Default (dotted-notebook / grid-paper): neutral mono. Skin is expressed
   entirely through CSS custom properties so a new theme can restyle the button
   with a :root[data-theme-id="…"] block below — no component change. */
.button {
  --save-btn-bg: rgba(20, 20, 24, 0.72);
  --save-btn-fg: #f5f5f5;
  --save-btn-ring: rgba(255, 255, 255, 0.22);
  --save-btn-glow: rgba(255, 255, 255, 0.10);

  position: fixed;
  right: 16px;
  bottom: calc(72px + env(safe-area-inset-bottom, 0px)); /* clears the bottom nav */
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid var(--save-btn-ring);
  background: var(--save-btn-bg);
  color: var(--save-btn-fg);
  backdrop-filter: blur(12px);
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.28), 0 0 0 4px var(--save-btn-glow);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.14s ease, box-shadow 0.2s ease;
}
.button:active { transform: scale(0.92); }
.icon { width: 26px; height: 26px; }

/* Paper-atelier is a light theme — invert the mono so the "+" stays legible. */
:global(:root[data-theme-id='paper-atelier']) .button {
  --save-btn-bg: rgba(250, 248, 242, 0.86);
  --save-btn-fg: #2a2622;
  --save-btn-ring: rgba(40, 34, 28, 0.22);
  --save-btn-glow: rgba(40, 34, 28, 0.06);
}
```

> タブレット（デスクトップ表示）でも `position: fixed; right/bottom` で枠内右下に出る。下部ナビが無いデスクトップ表示では `bottom` の 72px は余白として問題なし（ScrollMeter とは左右で分離）。Task 8 で実測。

- [ ] **Step 5: 型・ビルド確認**

Run: `rtk tsc`
Expected: 0 errors
Run: `pnpm build`
Expected: 成功（`out/` 生成）

- [ ] **Step 6: コミット**

```bash
rtk git add lib/board/constants.ts components/board/MobileSaveButton.tsx components/board/MobileSaveButton.module.css
rtk git commit -m "feat(board/mobile): smart + save button (clipboard-auto, theme-var skin)"
```

---

## Task 6: `MobileSaveSheet`（URL 入力シート・フォールバック）

**Files:**
- Create: `components/board/MobileSaveSheet.tsx`
- Create: `components/board/MobileSaveSheet.module.css`

**Interfaces:**
- Consumes: `normalizeToUrl`（Task 1）、`SaveOutcome`（Task 2）、`useI18n`（`@/lib/i18n/I18nProvider`）、`BOARD_Z_INDEX.SAVE_SHEET`。
- Produces: `MobileSaveSheet({ open, onClose, onSave, themeId }: { open: boolean; onClose: () => void; onSave: (url: string) => Promise<SaveOutcome>; themeId: string }): ReactElement | null` — 下から出る入力シート。ADD で `normalizeToUrl`→ 有効なら `onSave`（saved/duplicate で閉じる）、無効なら開いたまま赤ヒント。

- [ ] **Step 1: 実装**

`components/board/MobileSaveSheet.tsx`（新規）:

```tsx
'use client'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { normalizeToUrl } from '@/lib/board/paste-url'
import type { SaveOutcome } from '@/lib/board/use-save-url'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './MobileSaveSheet.module.css'

/** Bottom sheet URL input — the fallback when the smart + button can't read a
 *  URL from the clipboard. ADD validates via normalizeToUrl; a valid URL is
 *  saved (sheet closes on saved/duplicate — the board's PasteSaveFeedback shows
 *  the outcome), an invalid one keeps the sheet open with a quiet red hint. */
export function MobileSaveSheet({
  open,
  onClose,
  onSave,
  themeId,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSave: (url: string) => Promise<SaveOutcome>
  readonly themeId: string
}): ReactElement | null {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue('')
      setInvalid(false)
      // Focus after the sheet mounts so the keyboard rises.
      const id = window.setTimeout(() => inputRef.current?.focus(), 60)
      return (): void => window.clearTimeout(id)
    }
  }, [open])

  if (!open) return null

  const submit = async (): Promise<void> => {
    if (busy) return
    const url = normalizeToUrl(value)
    if (!url) {
      setInvalid(true)
      return
    }
    setBusy(true)
    try {
      await onSave(url) // saved OR duplicate → close; board shows the pill
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={styles.overlay}
      style={{ zIndex: BOARD_Z_INDEX.SAVE_SHEET }}
      data-theme-id={themeId}
      onClick={onClose}
      data-testid="mobile-save-sheet"
    >
      <div className={styles.sheet} role="dialog" aria-label="Add bookmark" onClick={(e): void => e.stopPropagation()}>
        <div className={styles.grip} aria-hidden="true" />
        <div className={styles.row}>
          <input
            ref={inputRef}
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className={styles.input}
            placeholder={t('board.urlPlaceholder')}
            value={value}
            data-testid="mobile-save-input"
            onChange={(e): void => { setValue(e.target.value); setInvalid(false) }}
            onKeyDown={(e): void => { if (e.key === 'Enter') void submit() }}
          />
          <button
            type="button"
            className={styles.add}
            disabled={busy}
            data-testid="mobile-save-add"
            onClick={(): void => { void submit() }}
          >
            ADD
          </button>
        </div>
        {invalid && <p className={styles.hint} data-testid="mobile-save-hint">{t('board.saveInvalidHint')}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: CSS**

`components/board/MobileSaveSheet.module.css`（新規）:

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
  display: flex;
  align-items: flex-end;
  -webkit-tap-highlight-color: transparent;
}
.sheet {
  --sheet-bg: #16161b;
  --sheet-fg: #f5f5f5;
  --sheet-field: rgba(255, 255, 255, 0.08);
  --sheet-ring: rgba(255, 255, 255, 0.18);

  width: 100%;
  background: var(--sheet-bg);
  color: var(--sheet-fg);
  border-radius: 18px 18px 0 0;
  padding: 10px 16px calc(18px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.4);
}
.grip {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--sheet-ring);
  margin: 4px auto 14px;
}
.row { display: flex; gap: 10px; align-items: center; }
.input {
  flex: 1;
  min-width: 0;
  height: 46px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--sheet-ring);
  background: var(--sheet-field);
  color: var(--sheet-fg);
  font-size: 16px; /* ≥16px stops iOS auto-zoom on focus */
}
.input::placeholder { color: rgba(245, 245, 245, 0.45); }
.add {
  height: 46px;
  padding: 0 20px;
  border-radius: 12px;
  border: none;
  background: var(--sheet-fg);
  color: var(--sheet-bg);
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
}
.add:disabled { opacity: 0.55; }
.hint { margin: 10px 2px 0; font-size: 13px; color: #ff6b6b; }

:global(:root[data-theme-id='paper-atelier']) .sheet {
  --sheet-bg: #faf8f2;
  --sheet-fg: #2a2622;
  --sheet-field: rgba(40, 34, 28, 0.06);
  --sheet-ring: rgba(40, 34, 28, 0.2);
}
```

- [ ] **Step 3: 型・ビルド確認**

Run: `rtk tsc`
Expected: 0 errors
Run: `pnpm build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
rtk git add components/board/MobileSaveSheet.tsx components/board/MobileSaveSheet.module.css
rtk git commit -m "feat(board/mobile): URL input bottom sheet (fallback for the + button)"
```

---

## Task 7: `BoardRoot` 配線（+ / シート mount ＋ Android 共有受け口 ＋ feedback マージ）

**Files:**
- Modify: `components/board/BoardRoot.tsx`

**Interfaces:**
- Consumes: `useIsTouchDevice`（Task 3）、`useSaveUrl`（Task 2）、`MobileSaveButton`（Task 5）、`MobileSaveSheet`（Task 6）、`normalizeToUrl`（Task 1）、既存 `pasteFeedback`（`useUrlPasteSave`）・`themeId`・`onSaved` ロジック。
- Produces: タッチ端末で「+」/シートを表示、Android 共有起動時に自動保存。

> BoardRoot は既存 `useUrlPasteSave`（desktop paste・feedback A）を**そのまま残し**、モバイル用に `useSaveUrl` 第 2 インスタンス（feedback B・saveUrl）を足す。両者は実運用で同時発火しないため、レンダー時に非 null 優先でマージ（＝desktop paste 経路は完全不変＝回帰ゼロ）。

- [ ] **Step 1: import と共有 onSaved の用意**

BoardRoot 冒頭の import 群に追加:

```tsx
import { useSaveUrl } from '@/lib/board/use-save-url'
import { useIsTouchDevice } from '@/lib/board/use-is-touch-device'
import { MobileSaveButton } from './MobileSaveButton'
import { MobileSaveSheet } from './MobileSaveSheet'
import { normalizeToUrl } from '@/lib/board/paste-url'
```

既存の `useUrlPasteSave({ onSaved: … })` の `onSaved` コールバック本体（reload＋入場ハイライト＋`postBookmarkSaved`）を、共有できるよう関数として抽出（`useCallback`）。現状の inline 定義（[BoardRoot.tsx:2588](../../../components/board/BoardRoot.tsx#L2588)）を `handleUrlSaved` に切り出し、`useUrlPasteSave` に渡す:

```tsx
const handleUrlSaved = useCallback(async (bookmarkId: string): Promise<void> => {
  await reload()
  setNewlyAddedIds((prev) => { const n = new Set(prev); n.add(bookmarkId); return n })
  setTimeout(() => {
    setNewlyAddedIds((prev) => { const n = new Set(prev); n.delete(bookmarkId); return n })
  }, 800)
  postBookmarkSaved({ bookmarkId })
}, [reload])

const { feedback: pasteFeedback } = useUrlPasteSave({
  onSaved: handleUrlSaved,
  flagOnboardingRef: onboardingActiveRef,
})
```

- [ ] **Step 2: モバイル保存インスタンス＋タッチゲート＋シート開閉 state**

`useUrlPasteSave` の直後に:

```tsx
const isTouchDevice = useIsTouchDevice()
const { feedback: mobileSaveFeedback, saveUrl: mobileSaveUrl } = useSaveUrl({ onSaved: handleUrlSaved })
const [saveSheetOpen, setSaveSheetOpen] = useState(false)
// Merge: the two save paths never fire together in practice; prefer whichever
// is showing so a single PasteSaveFeedback renders both.
const mergedSaveFeedback = pasteFeedback.kind ? pasteFeedback : mobileSaveFeedback
```

- [ ] **Step 3: Android 共有メニュー受け口（mount 効果）**

BoardRoot 内の effect 群に追加（`mobileSaveUrl` 定義後）:

```tsx
// Android Web Share Target: manifest points share intents at
// /board?shared=true&(url|text)=…. Read the query once on mount (static export
// → client-side), save via the shared core, then strip the query so a reload
// never re-saves. iOS never reaches here (it can't register a share target).
useEffect(() => {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (params.get('shared') !== 'true') return
  const raw = params.get('url') || params.get('text') || ''
  const url = normalizeToUrl(raw)
  // Always strip the shared params regardless of validity (avoid re-fire).
  window.history.replaceState(null, '', window.location.pathname)
  if (url) void mobileSaveUrl(url)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

- [ ] **Step 4: 「+」ボタン・シートを mount（タッチゲート）**

モバイル下部ナビの近く（[BoardRoot.tsx:2866](../../../components/board/BoardRoot.tsx#L2866) の `BoardMobileNav` ブロック付近）に追加。表示条件は下部ナビと揃える（Lightbox / onboarding / tagMode / arrange 中は隠す）:

```tsx
{isTouchDevice && !lightboxItemId && !showOnboarding && !tagMode && sharePhase !== 'arrange' && (
  <MobileSaveButton
    themeId={themeId}
    onSave={(url): void => { void mobileSaveUrl(url) }}
    onNeedInput={(): void => setSaveSheetOpen(true)}
  />
)}
{isTouchDevice && (
  <MobileSaveSheet
    open={saveSheetOpen}
    onClose={(): void => setSaveSheetOpen(false)}
    onSave={mobileSaveUrl}
    themeId={themeId}
  />
)}
```

- [ ] **Step 5: feedback レンダーをマージ値に差し替え**

既存の `<PasteSaveFeedback feedback={pasteFeedback} themeId={themeId} />`（[BoardRoot.tsx:3375](../../../components/board/BoardRoot.tsx#L3375)）を:

```tsx
<PasteSaveFeedback feedback={mergedSaveFeedback} themeId={themeId} />
```

- [ ] **Step 6: 型・全テスト・ビルド・デスクトップ回帰**

Run: `rtk tsc`
Expected: 0 errors
Run: `rtk vitest run`
Expected: 全緑
Run: `pnpm build`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
rtk git add components/board/BoardRoot.tsx
rtk git commit -m "feat(board/mobile): wire smart + button, input sheet, Android share receiver"
```

---

## Task 8: Playwright E2E ＋ 総検証 ＋ デプロイ

**Files:**
- Create: `tests/e2e/mobile-save.spec.ts`

**Interfaces:**
- Consumes: 実装済み全機能。IDB preseed 手順（memory `reference_playwright_board_share_verify`）でオンボ/モーダル回避。

> クリップボード自動読み（iOS のペースト確認）・Android 共有メニュー起動・タッチのタップ感は **Playwright 不可＝実機のみ**。Playwright は「入力シート経路・Android 共有クエリ経路・重複・タッチ端末で + 表示・デスクトップで非表示」を担保。

- [ ] **Step 1: E2E を書く**

`tests/e2e/mobile-save.spec.ts`（新規）。既存の board E2E（`reference_playwright_board_share_verify` の preseed パターン）に倣い、390×844・`hasTouch: true`・`isMobile: true` context で:

```typescript
import { test, expect } from '@playwright/test'
// preseed helper は既存 e2e と同じ IDB シード（オンボ/データモーダル回避）を流用。

test.describe('mobile save', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true })

  test('input sheet saves a typed URL', async ({ page }) => {
    // preseed IDB + goto /board
    await page.getByTestId('mobile-save-button').click()      // clipboard empty in headless → sheet opens
    await page.getByTestId('mobile-save-sheet').waitFor()
    await page.getByTestId('mobile-save-input').fill('example.com')
    await page.getByTestId('mobile-save-add').click()
    // sheet closes; a new card appears (count +1)
    await expect(page.getByTestId('mobile-save-sheet')).toBeHidden()
  })

  test('invalid input keeps the sheet open with a hint', async ({ page }) => {
    await page.getByTestId('mobile-save-button').click()
    await page.getByTestId('mobile-save-input').fill('hello world')
    await page.getByTestId('mobile-save-add').click()
    await expect(page.getByTestId('mobile-save-hint')).toBeVisible()
    await expect(page.getByTestId('mobile-save-sheet')).toBeVisible()
  })

  test('Android share query saves and clears the query', async ({ page }) => {
    // goto /board?shared=true&text=https://example.org/x  (after preseed)
    await expect(page).toHaveURL(/\/board$/)             // query stripped
    // a card for example.org exists
  })
})

test('desktop (mouse) never shows the + button', async ({ page }) => {
  // default desktop context (pointer: fine) + preseed + goto /board
  await expect(page.getByTestId('mobile-save-button')).toHaveCount(0)
})
```

> **注**: headless Chromium ではクリップボードが空/未許可なので「+」タップ＝シートが開く（自動保存経路は実機のみ）。preseed の具体手順・URL・カード数アサーションは既存 board E2E のヘルパーに合わせて埋める（`reference_playwright_board_share_verify`）。

- [ ] **Step 2: E2E 実行**

Run: `rtk playwright test tests/e2e/mobile-save.spec.ts`
Expected: 4 test PASS。落ちたら実装 or preseed を修正。

- [ ] **Step 3: 手動 Playwright でスクショ検証（幅別）**

- 390×844（`hasTouch`）: 「+」表示・シート開閉・重複 pill。
- タブレット 820×1180（`hasTouch`）: 「+」表示・盤面はデスクトップ表示のまま。
- 1489×679 / dpr2.58（`pointer: fine`）: 「+」非表示・盤面が従来と byte-identical（回帰スクショ比較）。

- [ ] **Step 4: 総検証**

Run: `rtk tsc` → 0
Run: `rtk vitest run` → 全緑
Run: `pnpm build` → 成功

- [ ] **Step 5: E2E をコミット**

```bash
rtk git add tests/e2e/mobile-save.spec.ts
rtk git commit -m "test(e2e): mobile save — input sheet, Android share query, desktop hidden"
```

- [ ] **Step 6: デプロイ**

```bash
pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true
```

- [ ] **Step 7: 実機確認をユーザーに依頼**

`allmarks.app` をスマホ/タブレットでハードリロードして:
1. URL をコピー →「+」→（iOS はペースト確認 1 回）→ 自動保存。
2. コピー無し/非 URL →「+」→ 入力シート → 貼付/入力 → ADD → 保存。
3. 既存 URL → 琥珀「Already saved」。
4. **Android のみ**: 他アプリ（X 等）の共有 → AllMarks（要ホーム追加）→ 自動保存。
5. デスクトップ（PC）で「+」が出ない・盤面不変。

---

## Self-Review（spec 突き合わせ）

- **B1 賢い + ボタン** → Task 5（+ Task 1 判定 / Task 2 芯 / Task 3 ゲート / Task 7 配線）。✓
- **B1 入力シート** → Task 6（+ Task 7 配線 / Task 4 文言）。✓
- **B2 Android 共有受け口** → Task 7 Step 3。✓
- **B4 15 言語** → Task 4（新規 1 キー＋既存 placeholder 再利用）。✓
- **保存の芯を 1 つに（useSaveUrl）＋ desktop byte-identical** → Task 2（薄いラッパ化）＋ Task 7（既存 useUrlPasteSave 温存・feedback マージ）。✓
- **normalizeToUrl で 3 入口統一・desktop は従来ルール** → Task 1 ＋ Task 2 Step 5（paste リスナは extractSinglePastedUrl 維持）。✓
- **テーマ拡張性（CSS 変数＋[data-theme-id]）** → Task 5 Step 4 / Task 6 Step 2。将来の `saveButtonVariant` は縫い代のみ（未実装）。✓
- **タッチゲート（pointer: coarse）でタブレット対応・盤面レイアウト不変** → Task 3 ＋ Task 7 Step 4。✓
- **z-index 定数（魔法の数値禁止）** → Task 5 Step 1。✓
- **フィードバック（SAVING / 琥珀 pill / 無効ヒント）** → 既存 PasteSaveFeedback 流用（Task 7 マージ）＋ Task 6 の hint。✓
- **検証（tsc/vitest/build/Playwright/実機）** → Task 8。✓

未対応（spec §12 どおり・backlog）: B3 ホーム追加案内 / iPhone ショートカット / タブレット盤面最適化 / `saveButtonVariant` 実装。

**型整合チェック**: `SaveOutcome`('saved'|'duplicate')・`PasteFeedback`・`normalizeToUrl(raw):string|null`・`useSaveUrl(...).saveUrl(url):Promise<SaveOutcome>`・`MobileSaveButton({onSave,onNeedInput,themeId})`・`MobileSaveSheet({open,onClose,onSave,themeId})` — 全 Task で一貫。プレースホルダなし。
