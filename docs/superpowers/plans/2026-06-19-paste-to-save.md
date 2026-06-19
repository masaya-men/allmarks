# Paste-to-Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user paste a URL onto the board (Ctrl/Cmd+V or right-click paste) and have it ingested as a bookmark card, the third install-free save path.

**Architecture:** A `paste` listener on the board guards against editable targets and non-URL clipboards, then runs a pure ingest orchestrator that detects the URL type, fetches OGP server-side for plain websites (`/api/ogp`), dedups, and writes via the existing `addBookmark`. New cards appear through the existing reload + entrance-highlight path; a theme-driven loading placeholder covers the website fetch wait.

**Tech Stack:** Next.js (static export), TypeScript strict, IndexedDB via `idb`, Vanilla CSS Modules, Vitest + fake-indexeddb, Cloudflare Pages Functions (existing `/api/ogp`).

## Global Constraints

- TypeScript `strict: true`; no `any` (use `unknown` + guards); explicit return types.
- Vanilla CSS Modules only — no Tailwind. z-index from constants, no magic numbers.
- No `console.log` in production code.
- IndexedDB only on client (`'use client'`, guard `typeof window !== 'undefined'`).
- UI label vocabulary = globally-clear English, verbatim reuse of existing pill words (`Already saved`). No new raw scrollbars, no AI gradient.
- Visual feedback (loading placeholder / pill / highlight) must be theme-driven, not hardcoded — follow `ImportProgressIndicator`'s `resolveWorkingVisual(themeId)` precedent.
- Dedup rule (verbatim from existing save path): `all.find((b) => b.url === url && !b.isDeleted)`.
- `addBookmark` payload shape (verbatim): `{ url, title, description, thumbnail, favicon, siteName, type, tags }`.
- Deploy verification: `rtk tsc && rtk vitest run && rtk pnpm build`. Never `tsc <file>` directly.

---

### Task 1: Pure paste guards (`paste-url.ts`)

**Files:**
- Create: `lib/board/paste-url.ts`
- Test: `tests/lib/board/paste-url.test.ts`

**Interfaces:**
- Consumes: `isValidUrl` from `lib/utils/url.ts`.
- Produces:
  - `extractSinglePastedUrl(text: string): string | null` — trimmed text that is exactly one http(s) URL → that URL; else null.
  - `isEditableTarget(el: EventTarget | null): boolean` — true if el or an ancestor is input/textarea/contenteditable.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/board/paste-url.test.ts
import { describe, it, expect } from 'vitest'
import { extractSinglePastedUrl, isEditableTarget } from '@/lib/board/paste-url'

describe('extractSinglePastedUrl', () => {
  it('returns the URL for a single clean http(s) URL', () => {
    expect(extractSinglePastedUrl('https://example.com/a')).toBe('https://example.com/a')
    expect(extractSinglePastedUrl('  http://x.io  ')).toBe('http://x.io')
  })
  it('returns null for non-URL text', () => {
    expect(extractSinglePastedUrl('just some words')).toBeNull()
    expect(extractSinglePastedUrl('')).toBeNull()
  })
  it('returns null when text has a URL plus other tokens (MVP = single only)', () => {
    expect(extractSinglePastedUrl('look https://x.io here')).toBeNull()
    expect(extractSinglePastedUrl('https://a.com https://b.com')).toBeNull()
  })
  it('returns null for non-http protocols', () => {
    expect(extractSinglePastedUrl('javascript:alert(1)')).toBeNull()
    expect(extractSinglePastedUrl('ftp://a.com')).toBeNull()
  })
})

describe('isEditableTarget', () => {
  it('true for input/textarea', () => {
    const input = document.createElement('input')
    const ta = document.createElement('textarea')
    expect(isEditableTarget(input)).toBe(true)
    expect(isEditableTarget(ta)).toBe(true)
  })
  it('true for contenteditable ancestor', () => {
    const outer = document.createElement('div')
    outer.setAttribute('contenteditable', 'true')
    const inner = document.createElement('span')
    outer.appendChild(inner)
    expect(isEditableTarget(inner)).toBe(true)
  })
  it('false for a plain div and for null', () => {
    expect(isEditableTarget(document.createElement('div'))).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run tests/lib/board/paste-url.test.ts`
Expected: FAIL ("does not provide an export named 'extractSinglePastedUrl'").

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/board/paste-url.ts
import { isValidUrl } from '@/lib/utils/url'

/** Trimmed clipboard text that is EXACTLY one http(s) URL → that URL; else null.
 *  MVP scope: a single URL token only (no extraction from surrounding prose). */
export function extractSinglePastedUrl(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed === '' || /\s/.test(trimmed)) return null
  return isValidUrl(trimmed) ? trimmed : null
}

/** True when el (or an ancestor) is a text-editable element, so we must NOT
 *  hijack the paste. */
export function isEditableTarget(el: EventTarget | null): boolean {
  let node = el instanceof Node ? el : null
  while (node) {
    if (node instanceof HTMLElement) {
      const tag = node.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return true
      if (node.isContentEditable) return true
    }
    node = node.parentNode
  }
  return false
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run tests/lib/board/paste-url.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/paste-url.ts tests/lib/board/paste-url.test.ts
rtk git commit -m "feat(board): pure paste guards (single-URL extract, editable-target check)"
```

---

### Task 2: Ingest orchestrator (`paste-ingest.ts`)

**Files:**
- Create: `lib/board/paste-ingest.ts`
- Test: `tests/lib/board/paste-ingest.test.ts`

**Interfaces:**
- Consumes: `detectUrlType` from `lib/utils/url.ts`; `addBookmark`, `getAllBookmarks` from `lib/storage/indexeddb` (injected via `deps`, not imported in tests).
- Produces:
  - `type OgpMeta = { title: string; description: string; image: string; siteName: string; favicon: string }`
  - `type IngestDeps = { db: IDBPDatabase; getAll: typeof getAllBookmarks; add: typeof addBookmark; fetchOgp: (url: string) => Promise<OgpMeta | null> }`
  - `type IngestResult = { outcome: 'saved' | 'duplicate'; bookmarkId: string | null }`
  - `ingestPastedUrl(url: string, deps: IngestDeps): Promise<IngestResult>`
  - `fetchOgpMeta(url: string): Promise<OgpMeta | null>` — calls `GET /api/ogp?url=`, returns parsed meta or null on any failure.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/board/paste-ingest.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ingestPastedUrl } from '@/lib/board/paste-ingest'

function deps(over = {}) {
  return {
    db: {} as never,
    getAll: vi.fn(async () => [] as never[]),
    add: vi.fn(async () => ({ id: 'b1', tags: [] }) as never),
    fetchOgp: vi.fn(async () => ({ title: 'T', description: 'D', image: 'I', siteName: 'S', favicon: 'F' })),
    ...over,
  }
}

describe('ingestPastedUrl', () => {
  it('website: fetches OGP and saves with the metadata', async () => {
    const d = deps()
    const r = await ingestPastedUrl('https://example.com', d)
    expect(d.fetchOgp).toHaveBeenCalledWith('https://example.com')
    expect(d.add).toHaveBeenCalledWith(d.db, expect.objectContaining({
      url: 'https://example.com', title: 'T', thumbnail: 'I', favicon: 'F', siteName: 'S', type: 'website', tags: [],
    }))
    expect(r).toEqual({ outcome: 'saved', bookmarkId: 'b1' })
  })

  it('embeddable (youtube): skips OGP fetch, saves with empty meta', async () => {
    const d = deps()
    await ingestPastedUrl('https://youtu.be/abc12345678', d)
    expect(d.fetchOgp).not.toHaveBeenCalled()
    expect(d.add).toHaveBeenCalledWith(d.db, expect.objectContaining({ type: 'youtube', title: '', thumbnail: '' }))
  })

  it('website OGP failure: still saves with fallback (domain title, empty image)', async () => {
    const d = deps({ fetchOgp: vi.fn(async () => null) })
    await ingestPastedUrl('https://blog.example.com/post', d)
    expect(d.add).toHaveBeenCalledWith(d.db, expect.objectContaining({
      type: 'website', title: 'blog.example.com', thumbnail: '', favicon: '',
    }))
  })

  it('duplicate (same non-deleted url): does not add', async () => {
    const d = deps({ getAll: vi.fn(async () => [{ url: 'https://example.com', isDeleted: false }] as never[]) })
    const r = await ingestPastedUrl('https://example.com', d)
    expect(d.add).not.toHaveBeenCalled()
    expect(r).toEqual({ outcome: 'duplicate', bookmarkId: null })
  })

  it('soft-deleted same url is NOT a duplicate (re-save allowed)', async () => {
    const d = deps({ getAll: vi.fn(async () => [{ url: 'https://example.com', isDeleted: true }] as never[]) })
    await ingestPastedUrl('https://example.com', d)
    expect(d.add).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run tests/lib/board/paste-ingest.test.ts`
Expected: FAIL ("does not provide an export named 'ingestPastedUrl'").

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/board/paste-ingest.ts
import type { IDBPDatabase } from 'idb'
import { detectUrlType } from '@/lib/utils/url'
import type { addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'

export type OgpMeta = {
  readonly title: string
  readonly description: string
  readonly image: string
  readonly siteName: string
  readonly favicon: string
}

export type IngestDeps = {
  readonly db: IDBPDatabase
  readonly getAll: typeof getAllBookmarks
  readonly add: typeof addBookmark
  readonly fetchOgp: (url: string) => Promise<OgpMeta | null>
}

export type IngestResult = {
  readonly outcome: 'saved' | 'duplicate'
  readonly bookmarkId: string | null
}

const EMBEDDABLE = new Set(['tweet', 'youtube', 'tiktok', 'instagram', 'vimeo', 'soundcloud'])

/** Server-side OGP fetch for a plain URL. Returns null on any failure so the
 *  caller falls back gracefully. */
export async function fetchOgpMeta(url: string): Promise<OgpMeta | null> {
  try {
    const res = await fetch(`/api/ogp?url=${encodeURIComponent(url)}`)
    if (!res.ok) return null
    const data = (await res.json()) as Partial<OgpMeta> & { error?: string }
    if (data.error) return null
    return {
      title: data.title ?? '',
      description: data.description ?? '',
      image: data.image ?? '',
      siteName: data.siteName ?? '',
      favicon: data.favicon ?? '',
    }
  } catch {
    return null
  }
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export async function ingestPastedUrl(url: string, deps: IngestDeps): Promise<IngestResult> {
  const all = await deps.getAll(deps.db)
  const existing = all.find((b) => b.url === url && !b.isDeleted)
  if (existing) return { outcome: 'duplicate', bookmarkId: null }

  const type = detectUrlType(url)
  let meta: OgpMeta | null = null
  if (!EMBEDDABLE.has(type)) {
    meta = await deps.fetchOgp(url)
  }

  const created = await deps.add(deps.db, {
    url,
    title: meta?.title || (EMBEDDABLE.has(type) ? '' : domainOf(url)),
    description: meta?.description ?? '',
    thumbnail: meta?.image ?? '',
    favicon: meta?.favicon ?? '',
    siteName: meta?.siteName ?? '',
    type,
    tags: [],
  })
  return { outcome: 'saved', bookmarkId: created.id }
}
```

> Note: confirm the exact `addBookmark` parameter object keys against `lib/storage/indexeddb.ts` before finalizing; mirror `components/bookmarklet/SaveToast.tsx:86-89`.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run tests/lib/board/paste-ingest.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/paste-ingest.ts tests/lib/board/paste-ingest.test.ts
rtk git commit -m "feat(board): paste ingest orchestrator (type detect, OGP fetch, dedup, fallback)"
```

---

### Task 3: Shared theme-driven sound-wave working visual

**Files:**
- Create: `components/board/SoundWaveWorking.tsx`
- Modify: `components/share/ImportProgressIndicator.tsx` (use the shared component for DRY)
- Test: `tests/components/board/sound-wave-working.test.tsx`

**Interfaces:**
- Produces: `SoundWaveWorking({ themeId }: { themeId: string }): ReactElement` — the theme-driven working motif (default = sound wave bars). `data-testid="sound-wave-working"`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/board/sound-wave-working.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SoundWaveWorking } from '@/components/board/SoundWaveWorking'

describe('SoundWaveWorking', () => {
  it('renders the sound-wave bars for the default theme', () => {
    const { getByTestId } = render(<SoundWaveWorking themeId="dotted-notebook" />)
    const svg = getByTestId('sound-wave-working')
    expect(svg.querySelectorAll('rect').length).toBe(7)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run tests/components/board/sound-wave-working.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation + refactor ImportProgressIndicator**

```tsx
// components/board/SoundWaveWorking.tsx
import { type ReactElement } from 'react'
import styles from './SoundWaveWorking.module.css'

/** Theme-driven "working" motif. Default = sound-wave bars. Add a theme id →
 *  element branch here to restyle for future themes. */
export function SoundWaveWorking({ themeId }: { readonly themeId: string }): ReactElement {
  void themeId // only the default exists today; switch on themeId when themes grow
  return (
    <svg data-testid="sound-wave-working" className={styles.wave} viewBox="0 0 64 24" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={4 + i * 8} y="2" width="4" height="20" rx="2" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </svg>
  )
}
```

Create `components/board/SoundWaveWorking.module.css` by moving the `.wave` rule (and its `@keyframes`) out of `ImportProgressIndicator.module.css`. Then in `ImportProgressIndicator.tsx` replace the local `resolveWorkingVisual` body with `<SoundWaveWorking themeId={themeId} />` (keep the `data-testid="import-working-visual"` test passing by either updating that test to `sound-wave-working` or keeping a wrapper — verify `tests` for `import-working-visual` and update the assertion to `sound-wave-working`).

- [ ] **Step 4: Run tests**

Run: `rtk vitest run tests/components/board/sound-wave-working.test.tsx && rtk vitest run -t "Import"`
Expected: PASS (new test + existing import indicator tests, with the working-visual assertion updated).

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/SoundWaveWorking.tsx components/board/SoundWaveWorking.module.css components/share/ImportProgressIndicator.tsx components/share/ImportProgressIndicator.module.css tests/components/board/sound-wave-working.test.tsx
rtk git commit -m "refactor(board): extract theme-driven SoundWaveWorking (shared by import indicator)"
```

---

### Task 4: Paste-save hook (`use-url-paste-save.ts`)

**Files:**
- Create: `lib/board/use-url-paste-save.ts`
- Test: `tests/lib/board/use-url-paste-save.test.tsx`

**Interfaces:**
- Consumes: `extractSinglePastedUrl`, `isEditableTarget` (Task 1); `ingestPastedUrl`, `fetchOgpMeta` (Task 2); `initDB`, `addBookmark`, `getAllBookmarks` (`lib/storage/indexeddb`).
- Produces:
  - `type PasteFeedback = { kind: 'loading' | 'duplicate' | null }`
  - `useUrlPasteSave(opts: { onSaved: (bookmarkId: string) => void | Promise<void> }): { feedback: PasteFeedback }`
  - Behavior: registers a `document` `paste` listener; ignores when `isEditableTarget(e.target)` or clipboard isn't a single URL; otherwise sets `feedback={kind:'loading'}` for website URLs while ingesting, calls `onSaved(bookmarkId)` on save, sets `{kind:'duplicate'}` briefly (1.6s) on duplicate, clears to `null` when done.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/lib/board/use-url-paste-save.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('@/lib/storage/indexeddb', () => ({
  initDB: vi.fn(async () => ({})),
  addBookmark: vi.fn(async () => ({ id: 'b1', tags: [] })),
  getAllBookmarks: vi.fn(async () => []),
}))
vi.mock('@/lib/board/paste-ingest', async (orig) => {
  const real = await orig<typeof import('@/lib/board/paste-ingest')>()
  return { ...real, fetchOgpMeta: vi.fn(async () => ({ title: 'T', description: '', image: 'I', siteName: '', favicon: '' })) }
})

import { useUrlPasteSave } from '@/lib/board/use-url-paste-save'

function paste(text: string, target: EventTarget = document.body): void {
  const e = new Event('paste', { bubbles: true }) as Event & { clipboardData: unknown }
  ;(e as { clipboardData: unknown }).clipboardData = { getData: () => text }
  Object.defineProperty(e, 'target', { value: target })
  document.dispatchEvent(e)
}

describe('useUrlPasteSave', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ingests a pasted website URL and calls onSaved', async () => {
    const onSaved = vi.fn()
    renderHook(() => useUrlPasteSave({ onSaved }))
    act(() => paste('https://example.com'))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('b1'))
  })

  it('ignores paste when target is an input', async () => {
    const onSaved = vi.fn()
    renderHook(() => useUrlPasteSave({ onSaved }))
    const input = document.createElement('input')
    document.body.appendChild(input)
    act(() => paste('https://example.com', input))
    await new Promise((r) => setTimeout(r, 30))
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('ignores non-URL clipboard text', async () => {
    const onSaved = vi.fn()
    renderHook(() => useUrlPasteSave({ onSaved }))
    act(() => paste('hello world'))
    await new Promise((r) => setTimeout(r, 30))
    expect(onSaved).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run tests/lib/board/use-url-paste-save.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```tsx
// lib/board/use-url-paste-save.ts
'use client'
import { useEffect, useRef, useState } from 'react'
import { initDB, addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { extractSinglePastedUrl, isEditableTarget } from '@/lib/board/paste-url'
import { ingestPastedUrl, fetchOgpMeta } from '@/lib/board/paste-ingest'
import { detectUrlType } from '@/lib/utils/url'

export type PasteFeedback = { readonly kind: 'loading' | 'duplicate' | null }
const EMBEDDABLE = new Set(['tweet', 'youtube', 'tiktok', 'instagram', 'vimeo', 'soundcloud'])
const DUPLICATE_MS = 1600

export function useUrlPasteSave(opts: {
  onSaved: (bookmarkId: string) => void | Promise<void>
}): { feedback: PasteFeedback } {
  const [feedback, setFeedback] = useState<PasteFeedback>({ kind: null })
  const onSavedRef = useRef(opts.onSaved)
  onSavedRef.current = opts.onSaved
  const busyRef = useRef(false)

  useEffect(() => {
    const handler = async (e: ClipboardEvent): Promise<void> => {
      if (busyRef.current) return
      if (isEditableTarget(e.target)) return
      const text = e.clipboardData?.getData('text/plain') ?? ''
      const url = extractSinglePastedUrl(text)
      if (!url) return
      e.preventDefault()
      busyRef.current = true
      if (!EMBEDDABLE.has(detectUrlType(url))) setFeedback({ kind: 'loading' })
      try {
        const db = await initDB()
        const result = await ingestPastedUrl(url, { db, getAll: getAllBookmarks, add: addBookmark, fetchOgp: fetchOgpMeta })
        if (result.outcome === 'saved' && result.bookmarkId) {
          setFeedback({ kind: null })
          await onSavedRef.current(result.bookmarkId)
        } else {
          setFeedback({ kind: 'duplicate' })
          setTimeout(() => setFeedback({ kind: null }), DUPLICATE_MS)
        }
      } catch {
        setFeedback({ kind: null })
      } finally {
        busyRef.current = false
      }
    }
    const listener = (e: Event): void => { void handler(e as ClipboardEvent) }
    document.addEventListener('paste', listener)
    return (): void => document.removeEventListener('paste', listener)
  }, [])

  return { feedback }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run tests/lib/board/use-url-paste-save.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/use-url-paste-save.ts tests/lib/board/use-url-paste-save.test.tsx
rtk git commit -m "feat(board): useUrlPasteSave hook (paste listener, guards, loading/duplicate feedback)"
```

---

### Task 5: Wire into BoardRoot + theme-driven feedback UI

**Files:**
- Modify: `components/board/BoardRoot.tsx` (call the hook near the existing `subscribeBookmarkSaved` effect ~line 1531; render feedback)
- Create: `components/board/PasteSaveFeedback.tsx` + `.module.css`
- Modify: `lib/board/constants.ts` (add `BOARD_Z_INDEX.PASTE_FEEDBACK` above cards, below modals)
- Test: `tests/components/board/paste-save-feedback.test.tsx`

**Interfaces:**
- Consumes: `useUrlPasteSave` (Task 4), `SoundWaveWorking` (Task 3), `setNewlyAddedIds` + `reload` (already in BoardRoot), `currentThemeId` (already in BoardRoot — confirm the exact variable name when wiring).
- Produces: `PasteSaveFeedback({ feedback, themeId }): ReactElement | null` — loading = centered theme-driven `SoundWaveWorking` + `SAVING`; duplicate = amber `Already saved` pill; null = render nothing.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/board/paste-save-feedback.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PasteSaveFeedback } from '@/components/board/PasteSaveFeedback'

describe('PasteSaveFeedback', () => {
  it('renders nothing when idle', () => {
    const { container } = render(<PasteSaveFeedback feedback={{ kind: null }} themeId="dotted-notebook" />)
    expect(container.firstChild).toBeNull()
  })
  it('shows the theme-driven working visual while loading', () => {
    const { getByTestId } = render(<PasteSaveFeedback feedback={{ kind: 'loading' }} themeId="dotted-notebook" />)
    expect(getByTestId('sound-wave-working')).toBeTruthy()
  })
  it('shows Already saved when duplicate', () => {
    const { getByText } = render(<PasteSaveFeedback feedback={{ kind: 'duplicate' }} themeId="dotted-notebook" />)
    expect(getByText('Already saved')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run tests/components/board/paste-save-feedback.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the component + wire BoardRoot**

```tsx
// components/board/PasteSaveFeedback.tsx
import { type ReactElement } from 'react'
import { SoundWaveWorking } from './SoundWaveWorking'
import type { PasteFeedback } from '@/lib/board/use-url-paste-save'
import styles from './PasteSaveFeedback.module.css'

export function PasteSaveFeedback({
  feedback,
  themeId,
}: {
  readonly feedback: PasteFeedback
  readonly themeId: string
}): ReactElement | null {
  if (feedback.kind === null) return null
  return (
    <div className={styles.root} data-kind={feedback.kind} role="status" aria-live="polite">
      {feedback.kind === 'loading' ? (
        <div className={styles.panel}>
          <SoundWaveWorking themeId={themeId} />
          <span className={styles.label}>SAVING</span>
        </div>
      ) : (
        <div className={styles.pill}>Already saved</div>
      )}
    </div>
  )
}
```

Create `PasteSaveFeedback.module.css` (centered fixed overlay, amber `#FFB020` pill for duplicate matching existing pill language, z-index `var(--z-paste-feedback)` from constants; no raw scrollbars). In `BoardRoot.tsx`, near the existing save-channel effect:

```tsx
// inside BoardRoot, with reload + setNewlyAddedIds already in scope
const { feedback: pasteFeedback } = useUrlPasteSave({
  onSaved: async (bookmarkId) => {
    await reload()
    setNewlyAddedIds((prev) => new Set(prev).add(bookmarkId))
    setTimeout(() => {
      setNewlyAddedIds((prev) => { const n = new Set(prev); n.delete(bookmarkId); return n })
    }, 800)
  },
})
```

And render `<PasteSaveFeedback feedback={pasteFeedback} themeId={currentThemeId} />` near the board overlays (alongside where `ImportProgressIndicator` or similar overlays render). Confirm the actual theme variable name in BoardRoot (search `themeId`/`theme`) and the `BOARD_Z_INDEX` constant location before editing.

- [ ] **Step 4: Run tests + typecheck**

Run: `rtk vitest run tests/components/board/paste-save-feedback.test.tsx && rtk tsc`
Expected: PASS (3 tests) and tsc 0 errors.

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/PasteSaveFeedback.tsx components/board/PasteSaveFeedback.module.css components/board/BoardRoot.tsx lib/board/constants.ts tests/components/board/paste-save-feedback.test.tsx
rtk git commit -m "feat(board): wire paste-to-save into BoardRoot with theme-driven feedback"
```

---

### Task 6: Full verification + production check

**Files:** none (verification only)

- [ ] **Step 1: Full local gate**

Run: `rtk tsc && rtk vitest run && rtk pnpm build`
Expected: tsc 0; all tests pass; build emits `out/` with the board route.

- [ ] **Step 2: Manual production check (after deploy)**

Deploy per CLAUDE.md (`npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true`), hard-reload `allmarks.app/board`, then verify:
- Paste a plain website URL → loading visual → card lands with new-card highlight, thumbnail present.
- Paste a YouTube and a tweet URL → live card, no fetch wait.
- Paste the same URL again → `Already saved` (no second card).
- Paste while focused in a tag input → normal text paste, no ingest.
- Paste a URL of a site that blocks bots → still saves as a fallback card (domain title).

- [ ] **Step 3: No commit** (verification only). If issues found, fix in the relevant task's files and re-run Step 1.

---

## Self-Review

**Spec coverage:**
- §3 trigger/guard → Task 1 (`isEditableTarget`, single-URL) + Task 4 (listener, preventDefault).
- §4 ingestion (type detect, embeddable vs website, /api/ogp, dedup, payload) → Task 2.
- §4.3 fetch-then-single-add, fallback → Task 2 (`ingestPastedUrl` fallback) + Task 4 (loading only for website).
- §5 theme-driven loading/duplicate/highlight → Task 3 (shared visual) + Task 5 (feedback UI + entrance highlight reuse).
- §6 units → Tasks 1/2/4/5 map 1:1.
- §7 reuse map → Tasks consume `addBookmark`/`getAllBookmarks`/`detectUrlType`/`/api/ogp`/entrance-highlight.
- §8 error/edge → Task 2 (failure null→fallback), Task 4 (busy guard, non-URL ignore), Task 6 manual.
- §9 testing → each task has unit tests; Task 6 manual.

**Placeholder scan:** Two explicit "confirm against source" notes (Task 2 addBookmark keys; Task 5 theme var name / z-index const) — these are verification steps the implementer must do before finalizing each edit, not vague requirements. All code blocks are concrete.

**Type consistency:** `OgpMeta`, `IngestDeps`, `IngestResult`, `PasteFeedback` used consistently across Tasks 2/4/5. `SoundWaveWorking({themeId})` and `data-testid="sound-wave-working"` consistent in Tasks 3/5. Entrance-highlight uses the real `setNewlyAddedIds`/800ms pattern from BoardRoot:1537-1549.

**Open implementer confirmations (low risk):** exact `addBookmark` key names; BoardRoot's current theme variable name; `BOARD_Z_INDEX` constant file. All are local lookups, noted inline.
