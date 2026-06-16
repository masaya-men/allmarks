# Quick-Tag on Save — Phase 1 (Extension Host Page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After an extension save, show a small tag-chip strip on whichever confirmation surface is visible (floating button or cursor pill); tapping a chip tags the just-saved bookmark, with an `ALL` expansion to the full tag list. No on-the-spot new-tag creation.

**Architecture:** "Save-first" — the save runs unchanged (Inbox, `tags:[]`). The save response, computed in the `/save-iframe` page (allmarks.app origin), now also carries: the user's existing tags ordered most-relevant-first, the bookmark's current tag ids, and **the active theme's resolved color tokens** (read live via `getComputedStyle` so the strip's tone follows whatever theme is active — no theme-id branching). That payload rides back through the existing offscreen router → `dispatch.js` → the tab message that drives the confirmation surface. The strip is rendered (inlined) in `content.js` (cursor pill) and `floating-button.js` (button), styled entirely from `--am-strip-*` CSS variables (defaults baked in CSS, overridden per-save from the theme tokens). A chip tap sends an `add-tag-request` to the background, which round-trips through the same offscreen `/save-iframe` bridge to call `addTagToBookmark`. The UI shows ✓ optimistically.

**Theme requirement (user):** the strip must match AllMarks' current tone and be theme-switch-ready. Color theme switching is not yet wired in the app (`data-theme="dark"` is hardcoded), so today the tokens resolve to the dark default — but because we read resolved CSS values in `/save-iframe` and the strip is driven by CSS variables, the strip will auto-follow when theme switching lands (a future one-liner makes `/save-iframe` apply the active `BoardConfig` theme before reading). The applied-✓ color stays AllMarks green `#28f100` (semantic constant in the pill language), exposed as a variable so a future theme could override it.

**Tech Stack:** Vanilla JS MV3 extension (no ES imports in content scripts — inline + a source-of-truth lib module kept in sync, mirroring `pill-state-machine.js`), Next.js `/save-iframe` React client, IndexedDB via `idb`, Zod for message schemas, Vitest + jsdom for unit tests.

**Spec:** [docs/superpowers/specs/2026-06-16-quick-tag-on-save-design.md](../specs/2026-06-16-quick-tag-on-save-design.md)

---

## File Structure

**App side (allmarks.app origin):**
- Create `lib/tagger/order-tags-for-save.ts` — pure: order existing tags "relevant-first" for one bookmark (reuses `scoreSimilarBookmarks`).
- Create `tests/lib/order-tags-for-save.test.ts` — unit tests.
- Modify `lib/utils/save-message.ts` — extend `SaveMessageResult` with `tags`/`currentTagIds`; add `parseAddTagMessage` + `AddTagResult`.
- Modify `tests/lib/save-message.test.ts` (or create if absent) — schema tests for add-tag parsing.
- Modify `app/save-iframe/SaveIframeClient.tsx` — include tag payload in both save replies; handle `booklage:add-tag`.

**Extension side (chrome-extension origin):**
- Modify `extension/offscreen.js` — resolve on `booklage:add-tag:result`.
- Modify `extension/lib/dispatch.js` — add `dispatchAddTag`; forward tag payload in tab messages.
- Modify `extension/background.js` — listen for `booklage:add-tag-request`.
- Create `extension/lib/tag-strip-model.js` — pure strip helpers (source of truth).
- Create `tests/extension/tag-strip-model.test.ts` — unit tests.
- Modify `extension/content.js` — inline strip on the cursor pill.
- Modify `extension/content.css` — strip styles.
- Modify `extension/floating-button.js` — inline strip on the button.
- Modify `extension/floating-button.css` — strip styles.
- Modify `extension/manifest.json` — version bump.

**Note on UI tuning:** the strip's exact pixel sizing, colors, easing, and placement offsets are intentionally first-cut here and tuned live on production with the user (per spec). Lock the plumbing precisely; treat the DOM/CSS steps as a working starting point.

---

## Group A — Tag ordering (app, pure, TDD)

### Task A1: `orderTagsForSave`

**Files:**
- Create: `lib/tagger/order-tags-for-save.ts`
- Test: `tests/lib/order-tags-for-save.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/order-tags-for-save.test.ts
import { describe, it, expect } from 'vitest'
import { orderTagsForSave } from '@/lib/tagger/order-tags-for-save'
import type { BookmarkRecord, TagRecord } from '@/lib/storage/indexeddb'

function bm(partial: Partial<BookmarkRecord>): BookmarkRecord {
  return { id: 'x', url: 'https://example.com/a', title: '', tags: [], ...partial } as BookmarkRecord
}
function tag(id: string, name: string): TagRecord {
  return { id, name, color: '#28F100', order: 0, createdAt: 0 } as TagRecord
}

describe('orderTagsForSave', () => {
  it('ranks tags used by same-domain bookmarks first, keeps the rest after', () => {
    const target = bm({ id: 't', url: 'https://example.com/new', tags: [] })
    const corpus: BookmarkRecord[] = [
      bm({ id: 'a', url: 'https://example.com/1', tags: ['cook'] }),
      bm({ id: 'b', url: 'https://example.com/2', tags: ['cook'] }),
      bm({ id: 'c', url: 'https://other.com/9', tags: ['music'] }),
    ]
    const allTags = [tag('cook', 'cooking'), tag('music', 'music'), tag('zzz', 'misc')]
    const out = orderTagsForSave(target, corpus, allTags)
    expect(out.map((t) => t.id)).toEqual(['cook', 'music', 'zzz'])
    expect(out[0]).toEqual({ id: 'cook', name: 'cooking', color: '#28F100' })
  })

  it('still includes the bookmark’s current tags (so the strip can mark them ✓)', () => {
    const target = bm({ id: 't', url: 'https://example.com/new', tags: ['cook'] })
    const corpus: BookmarkRecord[] = [bm({ id: 'a', url: 'https://example.com/1', tags: ['music'] })]
    const allTags = [tag('cook', 'cooking'), tag('music', 'music')]
    const ids = orderTagsForSave(target, corpus, allTags).map((t) => t.id)
    expect(ids).toContain('cook')
    expect(ids).toContain('music')
  })

  it('returns [] when there are no tags', () => {
    expect(orderTagsForSave(bm({ id: 't' }), [], [])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/order-tags-for-save.test.ts`
Expected: FAIL — cannot find module `@/lib/tagger/order-tags-for-save`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/tagger/order-tags-for-save.ts
import type { BookmarkRecord, TagRecord } from '@/lib/storage/indexeddb'
import { scoreSimilarBookmarks } from '@/lib/board/tag-candidates'

/** Lightweight tag shape carried in the save response + rendered as a chip. */
export interface QuickTag {
  readonly id: string
  readonly name: string
  readonly color: string
}

/**
 * Order the user's existing tags "most relevant first" for the quick-tag strip
 * shown right after a save. Relevance reuses {@link scoreSimilarBookmarks}
 * (tags frequent on same-domain bookmarks rank higher). Tags it does not rank
 * keep their stored order after the ranked ones. The bookmark's own current
 * tags are intentionally NOT removed — the strip marks them as ✓.
 */
export function orderTagsForSave(
  target: BookmarkRecord,
  corpus: readonly BookmarkRecord[],
  allTags: readonly TagRecord[],
): QuickTag[] {
  const ranked = scoreSimilarBookmarks(target, corpus) // tag ids, relevance desc
  const rankedSet = new Set(ranked)
  const byId = new Map(allTags.map((t) => [t.id, t]))
  const orderedIds: string[] = []
  for (const id of ranked) if (byId.has(id)) orderedIds.push(id)
  for (const t of allTags) if (!rankedSet.has(t.id)) orderedIds.push(t.id)
  const seen = new Set<string>()
  const out: QuickTag[] = []
  for (const id of orderedIds) {
    if (seen.has(id)) continue
    seen.add(id)
    const t = byId.get(id)
    if (t) out.push({ id: t.id, name: t.name, color: t.color })
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/order-tags-for-save.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tagger/order-tags-for-save.ts tests/lib/order-tags-for-save.test.ts
git commit -m "feat(tagger): order existing tags relevant-first for quick-tag on save"
```

---

## Group B — Save response carries tags (app)

### Task B1: Extend message schema

**Files:**
- Modify: `lib/utils/save-message.ts`
- Test: `tests/lib/save-message.test.ts` (create if missing)

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/save-message.test.ts  (append; create file with imports if absent)
import { describe, it, expect } from 'vitest'
import { parseAddTagMessage } from '@/lib/utils/save-message'

describe('parseAddTagMessage', () => {
  it('accepts a well-formed add-tag message', () => {
    const r = parseAddTagMessage({
      type: 'booklage:add-tag',
      payload: { bookmarkId: 'b1', tagId: 't1', nonce: 'n1' },
    })
    expect(r.ok).toBe(true)
  })
  it('rejects a missing tagId', () => {
    const r = parseAddTagMessage({
      type: 'booklage:add-tag',
      payload: { bookmarkId: 'b1', nonce: 'n1' },
    })
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/save-message.test.ts`
Expected: FAIL — `parseAddTagMessage` is not exported.

- [ ] **Step 3: Implement**

In `lib/utils/save-message.ts`, add the import at top:

```ts
import type { QuickTag } from '@/lib/tagger/order-tags-for-save'
```

Replace the `SaveMessageResult` type (currently lines ~36-38) with:

```ts
/** Resolved theme tokens for the host-page strip (ready-to-use CSS values). */
export interface StripThemeTokens {
  bg: string
  fg: string
  border: string
  accent: string
  blur: string
}

export type SaveMessageResult =
  | {
      type: 'booklage:save:result'
      nonce: string
      ok: true
      bookmarkId: string
      skipped?: true
      /** Existing tags, relevant-first, for the quick-tag strip. */
      tags?: QuickTag[]
      /** Tag ids already on this bookmark (marked ✓ in the strip). */
      currentTagIds?: string[]
      /** Active theme's resolved tokens; strip auto-follows theme changes. */
      themeTokens?: StripThemeTokens
    }
  | { type: 'booklage:save:result'; nonce: string; ok: false; error: string }
```

Append at the end of the file:

```ts
const AddTagMessage = z.object({
  type: z.literal('booklage:add-tag'),
  payload: z.object({
    bookmarkId: z.string().min(1),
    tagId: z.string().min(1),
    nonce: z.string().min(1),
  }),
})
export type AddTagMessageInput = z.infer<typeof AddTagMessage>
export function parseAddTagMessage(input: unknown): ParseResult<AddTagMessageInput> {
  const r = AddTagMessage.safeParse(input)
  if (r.success) return { ok: true, value: r.data }
  return {
    ok: false,
    error: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  }
}

export type AddTagResult =
  | { type: 'booklage:add-tag:result'; nonce: string; ok: true }
  | { type: 'booklage:add-tag:result'; nonce: string; ok: false; error: string }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/save-message.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/utils/save-message.ts tests/lib/save-message.test.ts
git commit -m "feat(save-message): carry tags in save result + add-tag message schema"
```

### Task B2: SaveIframeClient returns the tag payload

**Files:**
- Modify: `app/save-iframe/SaveIframeClient.tsx`

- [ ] **Step 1: Add imports**

Add to the existing storage import on line 5 (`getAllTags`) and a new line for the tagger:

```ts
import { initDB, addBookmark, persistMediaSlots, getAllBookmarks } from '@/lib/storage/indexeddb'
import { getAllTags, addTagToBookmark } from '@/lib/storage/tags'
import { orderTagsForSave } from '@/lib/tagger/order-tags-for-save'
```

(`addTagToBookmark` is for Task B3 — add it now.)

- [ ] **Step 2: Add a helper inside the component (above the `handler` definition, inside the effect or as a module function)**

Add this module-level code near the top of the file (after imports, before the component). It builds the tags **and** reads the active theme's resolved CSS tokens so the host-page strip matches the current theme and follows future theme switches:

```ts
import type { BookmarkRecord } from '@/lib/storage/indexeddb'
import type { StripThemeTokens } from '@/lib/utils/save-message'

type SaveDb = Awaited<ReturnType<typeof initDB>>

/**
 * Read the active theme's resolved tokens straight off the document. Because we
 * read *computed* values (not a hardcoded palette), the strip auto-follows
 * whatever theme is active — today the dark default, later any switched theme.
 * The applied-✓ accent stays AllMarks green (semantic pill-language constant).
 */
function readThemeTokens(): StripThemeTokens {
  const cs = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string): string => {
    const got = cs.getPropertyValue(name).trim()
    return got || fallback
  }
  return {
    bg: v('--bg-dark', '#0a0a0a'),
    fg: v('--text-primary', '#f2f2f2'),
    border: v('--color-card-border', 'rgba(255,255,255,0.12)'),
    accent: '#28f100',
    blur: v('--glass-blur', '8px'),
  }
}

async function buildSavePayload(
  db: SaveDb,
  bookmark: BookmarkRecord,
): Promise<{ tags: ReturnType<typeof orderTagsForSave>; currentTagIds: string[]; themeTokens: StripThemeTokens }> {
  const [corpus, allTags] = await Promise.all([getAllBookmarks(db), getAllTags(db)])
  return {
    tags: orderTagsForSave(bookmark, corpus, allTags),
    currentTagIds: bookmark.tags,
    themeTokens: readThemeTokens(),
  }
}
```

- [ ] **Step 3: Include the payload in the duplicate reply**

Replace the duplicate-branch reply (currently lines ~106-113):

```ts
          if (existing) {
            const savePayload = await buildSavePayload(db, existing)
            reply({
              type: 'booklage:save:result',
              nonce: payload.nonce,
              ok: true,
              bookmarkId: existing.id,
              skipped: true,
              ...savePayload,
            })
            return
          }
```

- [ ] **Step 4: Include the payload in the fresh-save reply**

Replace the fresh reply (currently line ~127):

```ts
        postBookmarkSaved({ bookmarkId: bm.id })
        const savePayload = await buildSavePayload(db, bm)
        reply({ type: 'booklage:save:result', nonce: payload.nonce, ok: true, bookmarkId: bm.id, ...savePayload })
```

- [ ] **Step 5: Verify types + build**

Run: `rtk tsc`
Expected: `TypeScript compilation completed` (0 errors). Fix the `db` param type per the note if needed.

- [ ] **Step 6: Commit**

```bash
git add app/save-iframe/SaveIframeClient.tsx
git commit -m "feat(save-iframe): return relevant-first tags + current tag ids with save result"
```

### Task B3: SaveIframeClient handles `booklage:add-tag`

**Files:**
- Modify: `app/save-iframe/SaveIframeClient.tsx`

- [ ] **Step 1: Add the parser import**

Update the save-message import:

```ts
import {
  parseSaveMessage,
  parseProbeMessage,
  parseAddTagMessage,
  type SaveMessageResult,
} from '@/lib/utils/save-message'
```

- [ ] **Step 2: Handle add-tag inside `handler`, before `parseSaveMessage`**

Insert this block right after the probe-handling block (after its `return`, before `const parsed = parseSaveMessage(ev.data)`):

```ts
      const addTagParsed = parseAddTagMessage(ev.data)
      if (addTagParsed.ok) {
        const { bookmarkId, tagId, nonce } = addTagParsed.value.payload
        try {
          const db = await initDB()
          await addTagToBookmark(db, bookmarkId, tagId)
          ev.source?.postMessage(
            { type: 'booklage:add-tag:result', nonce, ok: true },
            { targetOrigin: ev.origin },
          )
        } catch (err) {
          ev.source?.postMessage(
            { type: 'booklage:add-tag:result', nonce, ok: false, error: err instanceof Error ? err.message : String(err) },
            { targetOrigin: ev.origin },
          )
        }
        return
      }
```

- [ ] **Step 3: Verify types + build**

Run: `rtk tsc && pnpm build`
Expected: tsc 0 errors; build completes (static export). `/save-iframe` route still builds.

- [ ] **Step 4: Commit**

```bash
git add app/save-iframe/SaveIframeClient.tsx
git commit -m "feat(save-iframe): handle add-tag round-trip (addTagToBookmark)"
```

---

## Group C — Extension plumbing

### Task C1: offscreen resolves add-tag result

**Files:**
- Modify: `extension/offscreen.js:15`

- [ ] **Step 1: Edit**

Change line 15 to also resolve add-tag results:

```js
  if (
    data.type === 'booklage:save:result' ||
    data.type === 'booklage:probe:result' ||
    data.type === 'booklage:add-tag:result'
  ) {
    router.resolve(data.nonce, data)
  }
```

- [ ] **Step 2: Commit**

```bash
git add extension/offscreen.js
git commit -m "feat(extension): offscreen resolves add-tag result nonce"
```

### Task C2: `dispatchAddTag`

**Files:**
- Modify: `extension/lib/dispatch.js`

- [ ] **Step 1: Add the function (append before the file's end, after `dispatchSave`)**

```js
// Add-tag round-trip for the quick-tag strip. Same offscreen bridge as save:
// post a booklage:add-tag envelope, let the /save-iframe page call
// addTagToBookmark, resolve on booklage:add-tag:result. Fire-and-forget from
// the UI's perspective (the strip shows ✓ optimistically); we still await the
// result here to drive the one-shot offscreen self-heal on timeout.
export async function dispatchAddTag({ bookmarkId, tagId }) {
  await ensureOffscreen()
  const nonce = makeNonce('t')
  const envelope = { type: 'booklage:add-tag', payload: { bookmarkId, tagId, nonce } }
  let result = await postToOffscreen(envelope, nonce)
  if (!result?.ok && result?.error === 'timeout') {
    try { await chrome.offscreen.closeDocument() } catch (_) { /* no doc */ }
    await ensureOffscreen()
    const retryNonce = makeNonce('t-retry')
    result = await postToOffscreen({ ...envelope, payload: { ...envelope.payload, nonce: retryNonce } }, retryNonce)
  }
  return result
}
```

- [ ] **Step 2: Commit**

```bash
git add extension/lib/dispatch.js
git commit -m "feat(extension): dispatchAddTag via offscreen bridge"
```

### Task C3: dispatch forwards the tag payload to the tab

**Files:**
- Modify: `extension/lib/dispatch.js:131-136`

- [ ] **Step 1: Edit the final tab messages**

Replace the final state messages (lines ~131-136) with:

```js
  const tagExtras =
    finalState === 'saved' || finalState === 'duplicate'
      ? {
          bookmarkId: result.bookmarkId,
          tags: Array.isArray(result.tags) ? result.tags : [],
          currentTagIds: Array.isArray(result.currentTagIds) ? result.currentTagIds : [],
          themeTokens: result.themeTokens || null,
        }
      : {}
  if (!isFloatingButton) {
    chrome.tabs.sendMessage(tabId, { type: 'booklage:cursor-pill', state: finalState, ...tagExtras }).catch(() => {})
  }
  if (isFloatingButton) {
    chrome.tabs.sendMessage(tabId, { type: 'booklage:floating-button-state', state: finalState, ...tagExtras }).catch(() => {})
  }
```

- [ ] **Step 2: Commit**

```bash
git add extension/lib/dispatch.js
git commit -m "feat(extension): forward quick-tag payload in cursor-pill + floating-button messages"
```

### Task C4: background routes add-tag-request

**Files:**
- Modify: `extension/background.js`

- [ ] **Step 1: Import `dispatchAddTag`**

Change line 1:

```js
import { dispatchSave, dispatchAddTag } from './lib/dispatch.js'
```

- [ ] **Step 2: Add a listener branch**

Inside the `chrome.runtime.onMessage.addListener((msg, sender) => { ... })` block (after the `booklage:floating-button-save` branch), add:

```js
  if (msg.type === 'booklage:add-tag-request') {
    if (typeof msg.bookmarkId !== 'string' || typeof msg.tagId !== 'string') return
    void dispatchAddTag({ bookmarkId: msg.bookmarkId, tagId: msg.tagId }).catch((e) => {
      console.warn('[booklage] add-tag failed:', e)
    })
    return
  }
```

- [ ] **Step 3: Commit**

```bash
git add extension/background.js
git commit -m "feat(extension): route add-tag-request to dispatchAddTag"
```

---

## Group D — Strip model + inline UI

### Task D1: pure strip model (TDD)

**Files:**
- Create: `extension/lib/tag-strip-model.js`
- Test: `tests/extension/tag-strip-model.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/extension/tag-strip-model.test.ts
import { describe, it, expect } from 'vitest'
import { splitChips, shouldShowStrip, STRIP_MAX_CHIPS } from '@/extension/lib/tag-strip-model.js'

const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 't' + i, name: 'tag' + i, color: '#28F100' }))

describe('splitChips', () => {
  it('keeps the first STRIP_MAX_CHIPS visible and overflows the rest', () => {
    const r = splitChips(mk(STRIP_MAX_CHIPS + 2))
    expect(r.visible).toHaveLength(STRIP_MAX_CHIPS)
    expect(r.overflow).toHaveLength(2)
    expect(r.hasOverflow).toBe(true)
  })
  it('no overflow when tags fit', () => {
    const r = splitChips(mk(3))
    expect(r.overflow).toHaveLength(0)
    expect(r.hasOverflow).toBe(false)
  })
})

describe('shouldShowStrip', () => {
  it('shows on saved/duplicate with tags', () => {
    expect(shouldShowStrip('saved', mk(1))).toBe(true)
    expect(shouldShowStrip('duplicate', mk(1))).toBe(true)
  })
  it('hidden on error, on saving, or with no tags', () => {
    expect(shouldShowStrip('error', mk(1))).toBe(false)
    expect(shouldShowStrip('saving', mk(1))).toBe(false)
    expect(shouldShowStrip('saved', [])).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/extension/tag-strip-model.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// extension/lib/tag-strip-model.js
// Pure helpers for the quick-tag strip. Source of truth for tests; the DOM
// render code is inlined into content.js + floating-button.js (MV3 content
// scripts can't `import`). ⚠ Keep the inline copies in sync with this file.

export const STRIP_MAX_CHIPS = 5

/** First N tags become visible chips; the rest go behind the ALL expander. */
export function splitChips(tags, max = STRIP_MAX_CHIPS) {
  const list = Array.isArray(tags) ? tags : []
  const visible = list.slice(0, max)
  const overflow = list.slice(max)
  return { visible, overflow, hasOverflow: overflow.length > 0 }
}

/** The strip only appears once a save succeeded and the user has tags. */
export function shouldShowStrip(state, tags) {
  if (state !== 'saved' && state !== 'duplicate') return false
  return Array.isArray(tags) && tags.length > 0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/extension/tag-strip-model.test.ts`
Expected: PASS (4 tests). If `@/extension/...` path alias fails, use a relative import in the test (`../../extension/lib/tag-strip-model.js`).

- [ ] **Step 5: Commit**

```bash
git add extension/lib/tag-strip-model.js tests/extension/tag-strip-model.test.ts
git commit -m "feat(extension): pure tag-strip model (splitChips, shouldShowStrip)"
```

### Task D2: strip styles (first-cut, tuned live)

**Files:**
- Modify: `extension/content.css`
- Modify: `extension/floating-button.css`

- [ ] **Step 1: Append a shared-look strip style to BOTH css files**

Add this block to each file (identical; both inject into the page). The look is driven entirely by `--am-strip-*` CSS variables with the AllMarks dark-theme defaults baked in; the content script overrides them per-save from the theme tokens, so the strip matches the active theme and follows future switches. `color-mix` is used for translucency (Chrome ≥124 per manifest `minimum_chrome_version`). Geometry/sizing values are first-cut for live tuning; the colors come from the theme.

```css
/* === Quick-tag strip (Phase 1) — theme-driven via --am-strip-* vars === */
.allmarks-tagstrip {
  /* Defaults = AllMarks dark theme; overridden per-save from theme tokens. */
  --am-strip-bg: #0a0a0a;
  --am-strip-fg: #f2f2f2;
  --am-strip-border: rgba(255, 255, 255, 0.12);
  --am-strip-accent: #28f100;
  --am-strip-blur: 8px;

  position: fixed;
  z-index: 2147483646; /* just under the pill/button */
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: min(72vw, 520px);
  padding: 6px 8px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--am-strip-border) 100%, transparent);
  background: color-mix(in srgb, var(--am-strip-bg) 92%, transparent);
  backdrop-filter: blur(var(--am-strip-blur));
  -webkit-backdrop-filter: blur(var(--am-strip-blur));
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
  color: var(--am-strip-fg);
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 0.18s ease, transform 0.18s ease;
  pointer-events: auto;
  overflow-x: auto;
  scrollbar-width: none;
}
.allmarks-tagstrip::-webkit-scrollbar { display: none; }
.allmarks-tagstrip.is-visible { opacity: 1; transform: translateY(0); }
.allmarks-tagstrip__chip {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  min-height: 28px;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--am-strip-border) 130%, transparent);
  background: color-mix(in srgb, var(--am-strip-fg) 6%, transparent);
  color: color-mix(in srgb, var(--am-strip-fg) 82%, transparent);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: lowercase;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}
.allmarks-tagstrip__chip[data-on="true"] {
  border-color: var(--am-strip-accent);
  color: var(--am-strip-accent);
  background: color-mix(in srgb, var(--am-strip-accent) 12%, transparent);
}
.allmarks-tagstrip__chip[data-role="all"] {
  text-transform: uppercase;
  color: color-mix(in srgb, var(--am-strip-fg) 60%, transparent);
}
```

- [ ] **Step 2: Commit**

```bash
git add extension/content.css extension/floating-button.css
git commit -m "style(extension): quick-tag strip first-cut styles"
```

### Task D3: inline strip on the cursor pill (`content.js`)

**Files:**
- Modify: `extension/content.js`

- [ ] **Step 1: Inline the strip helpers + renderer**

Near the top of `content.js` (after the `pillStateView` block), add an inlined copy of the model + a renderer. ⚠ Keep `STRIP_MAX_CHIPS` / `splitChips` / `shouldShowStrip` in sync with `extension/lib/tag-strip-model.js`.

```js
// === Quick-tag strip (inlined; source of truth: extension/lib/tag-strip-model.js) ===
const STRIP_MAX_CHIPS = 5
function tagstripSplit(tags, max) {
  const list = Array.isArray(tags) ? tags : []
  return { visible: list.slice(0, max || STRIP_MAX_CHIPS), overflow: list.slice(max || STRIP_MAX_CHIPS) }
}
function tagstripShouldShow(state, tags) {
  if (state !== 'saved' && state !== 'duplicate') return false
  return Array.isArray(tags) && tags.length > 0
}

let tagStripEl = null
let tagStripHideTimer = null
const TAGSTRIP_HIDE_MS = 4200

function removeTagStrip() {
  if (tagStripHideTimer) { clearTimeout(tagStripHideTimer); tagStripHideTimer = null }
  if (tagStripEl) { tagStripEl.remove(); tagStripEl = null }
}

function sendAddTag(bookmarkId, tagId) {
  if (!isExtensionAlive()) return
  try {
    chrome.runtime.sendMessage({ type: 'booklage:add-tag-request', bookmarkId, tagId }).catch(() => {})
  } catch (_) { /* context invalidated */ }
}

// Push the active theme's tokens onto the strip's CSS vars so its tone matches
// the app's current theme (and follows future theme switches).
function applyStripTheme(el, t) {
  if (!t) return
  const set = (k, v) => { if (v) el.style.setProperty(k, v) }
  set('--am-strip-bg', t.bg)
  set('--am-strip-fg', t.fg)
  set('--am-strip-border', t.border)
  set('--am-strip-accent', t.accent)
  set('--am-strip-blur', t.blur)
}

function makeChip(bookmarkId, tag, alreadyOn) {
  const chip = document.createElement('button')
  chip.type = 'button'
  chip.className = 'allmarks-tagstrip__chip'
  chip.textContent = tag.name
  if (alreadyOn) chip.dataset.on = 'true'
  chip.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation()
    if (chip.dataset.on === 'true') return // already applied — no-op (no un-tag in phase 1)
    chip.dataset.on = 'true' // optimistic ✓
    sendAddTag(bookmarkId, tag.id)
    // keep the strip open a little longer after an interaction
    if (tagStripHideTimer) clearTimeout(tagStripHideTimer)
    tagStripHideTimer = setTimeout(removeTagStrip, TAGSTRIP_HIDE_MS)
  })
  return chip
}

// Render the strip next to the cursor pill. The pill sits near the cursor
// (top-left of pointer); place the strip just below it.
function showTagStrip(bookmarkId, tags, currentTagIds, themeTokens) {
  removeTagStrip()
  const current = new Set(Array.isArray(currentTagIds) ? currentTagIds : [])
  const { visible, overflow } = tagstripSplit(tags, STRIP_MAX_CHIPS)
  const el = document.createElement('div')
  el.className = 'allmarks-tagstrip'
  applyStripTheme(el, themeTokens)
  for (const t of visible) el.appendChild(makeChip(bookmarkId, t, current.has(t.id)))
  if (overflow.length > 0) {
    const all = document.createElement('button')
    all.type = 'button'
    all.className = 'allmarks-tagstrip__chip'
    all.dataset.role = 'all'
    all.textContent = 'ALL'
    all.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation()
      all.remove()
      for (const t of overflow) el.appendChild(makeChip(bookmarkId, t, current.has(t.id)))
    })
    el.appendChild(all)
  }
  document.documentElement.appendChild(el)
  tagStripEl = el
  // Position: under the pill (pill positions itself via positionPill()).
  const p = ensurePill()
  const r = p.getBoundingClientRect()
  el.style.left = Math.max(8, Math.min(window.innerWidth - el.offsetWidth - 8, r.left)) + 'px'
  el.style.top = Math.min(window.innerHeight - el.offsetHeight - 8, r.bottom + 6) + 'px'
  requestAnimationFrame(() => el.classList.add('is-visible'))
  tagStripHideTimer = setTimeout(removeTagStrip, TAGSTRIP_HIDE_MS)
}
```

- [ ] **Step 2: Trigger the strip from the cursor-pill message**

Replace the message listener (currently lines ~171-174):

```js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== 'booklage:cursor-pill') return
  setState(msg.state)
  if (tagstripShouldShow(msg.state, msg.tags)) {
    // Defer so the pill has positioned itself first.
    setTimeout(() => showTagStrip(msg.bookmarkId, msg.tags, msg.currentTagIds, msg.themeTokens), 80)
  } else if (msg.state === 'error') {
    removeTagStrip()
  }
})
```

- [ ] **Step 3: Manual verify (no unit test — DOM content script)**

Build is unaffected (extension isn't part of `pnpm build`). Reload the unpacked extension in `chrome://extensions`, save a page via keyboard shortcut (`Ctrl+Shift+B`) on a site with the floating button OFF, and confirm the strip appears below the cursor pill with your tags. Tapping a chip turns it green; reload the board to confirm the tag stuck. Defer pixel tuning to the live session.

- [ ] **Step 4: Commit**

```bash
git add extension/content.js
git commit -m "feat(extension): quick-tag strip on the cursor pill"
```

### Task D4: inline strip on the floating button (`floating-button.js`)

**Files:**
- Modify: `extension/floating-button.js`

- [ ] **Step 1: Inline the same strip helpers inside the IIFE**

Inside the floating-button IIFE (e.g., just before `// === Background messages ===`), add the same inlined helpers as D3 Step 1 — `STRIP_MAX_CHIPS`, `tagstripSplit`, `tagstripShouldShow`, `removeTagStrip`, `sendAddTag`, `makeChip`, and a button-anchored `showTagStripForButton`. The chip/model code is identical; only the positioning differs (anchor to the button, expand inward from the snapped edge):

```js
  // === Quick-tag strip (inlined; source of truth: extension/lib/tag-strip-model.js) ===
  const STRIP_MAX_CHIPS = 5
  function tagstripSplit(tags, max) {
    const list = Array.isArray(tags) ? tags : []
    return { visible: list.slice(0, max || STRIP_MAX_CHIPS), overflow: list.slice(max || STRIP_MAX_CHIPS) }
  }
  function tagstripShouldShow(state, tags) {
    if (state !== 'saved' && state !== 'duplicate') return false
    return Array.isArray(tags) && tags.length > 0
  }
  let tagStripEl = null
  let tagStripHideTimer = null
  const TAGSTRIP_HIDE_MS = 4200
  function removeTagStrip() {
    if (tagStripHideTimer) { clearTimeout(tagStripHideTimer); tagStripHideTimer = null }
    if (tagStripEl) { tagStripEl.remove(); tagStripEl = null }
  }
  function sendAddTag(bookmarkId, tagId) {
    if (!isExtensionAlive()) return
    try { chrome.runtime.sendMessage({ type: 'booklage:add-tag-request', bookmarkId, tagId }).catch(() => {}) } catch (_) {}
  }
  function applyStripTheme(el, t) {
    if (!t) return
    const set = (k, v) => { if (v) el.style.setProperty(k, v) }
    set('--am-strip-bg', t.bg); set('--am-strip-fg', t.fg); set('--am-strip-border', t.border)
    set('--am-strip-accent', t.accent); set('--am-strip-blur', t.blur)
  }
  function makeChip(bookmarkId, tag, alreadyOn) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'allmarks-tagstrip__chip'
    chip.textContent = tag.name
    if (alreadyOn) chip.dataset.on = 'true'
    chip.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation()
      if (chip.dataset.on === 'true') return
      chip.dataset.on = 'true'
      sendAddTag(bookmarkId, tag.id)
      if (tagStripHideTimer) clearTimeout(tagStripHideTimer)
      tagStripHideTimer = setTimeout(removeTagStrip, TAGSTRIP_HIDE_MS)
    })
    return chip
  }
  function showTagStripForButton(bookmarkId, tags, currentTagIds, themeTokens) {
    removeTagStrip()
    if (!container) return
    const current = new Set(Array.isArray(currentTagIds) ? currentTagIds : [])
    const { visible, overflow } = tagstripSplit(tags, STRIP_MAX_CHIPS)
    const el = document.createElement('div')
    el.className = 'allmarks-tagstrip'
    applyStripTheme(el, themeTokens)
    for (const t of visible) el.appendChild(makeChip(bookmarkId, t, current.has(t.id)))
    if (overflow.length > 0) {
      const all = document.createElement('button')
      all.type = 'button'; all.className = 'allmarks-tagstrip__chip'; all.dataset.role = 'all'; all.textContent = 'ALL'
      all.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); all.remove()
        for (const t of overflow) el.appendChild(makeChip(bookmarkId, t, current.has(t.id)))
      })
      el.appendChild(all)
    }
    document.documentElement.appendChild(el)
    tagStripEl = el
    // Anchor to the button, expand inward from its snapped edge.
    const r = container.getBoundingClientRect()
    const side = settings.floatingButtonSnapSide === 'left' ? 'left' : 'right'
    const top = Math.max(8, Math.min(window.innerHeight - el.offsetHeight - 8, r.top + r.height / 2 - el.offsetHeight / 2))
    el.style.top = top + 'px'
    if (side === 'right') el.style.right = (window.innerWidth - r.left + 6) + 'px'
    else el.style.left = (r.right + 6) + 'px'
    requestAnimationFrame(() => el.classList.add('is-visible'))
    tagStripHideTimer = setTimeout(removeTagStrip, TAGSTRIP_HIDE_MS)
  }
```

- [ ] **Step 2: Trigger from the floating-button-state message**

Replace the background-message listener (currently lines ~342-351):

```js
  if (isExtensionAlive()) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.type !== 'booklage:floating-button-state') return
      if (msg.state === 'saved' || msg.state === 'duplicate') {
        dispatch({ type: 'save-success' })
        if (tagstripShouldShow(msg.state, msg.tags)) {
          setTimeout(() => showTagStripForButton(msg.bookmarkId, msg.tags, msg.currentTagIds, msg.themeTokens), 80)
        }
      } else if (msg.state === 'error') {
        dispatch({ type: 'save-error' })
        removeTagStrip()
      }
    })
  }
```

- [ ] **Step 3: Manual verify**

Reload the extension. With the floating button ON, click it to save on a normal page; confirm the strip slides out inward from the button edge with your tags, chip taps turn green, and the tag persists after a board reload. Tune visuals live.

- [ ] **Step 4: Commit**

```bash
git add extension/floating-button.js
git commit -m "feat(extension): quick-tag strip on the floating button"
```

---

## Group E — Manifest + verification

### Task E1: bump extension version

**Files:**
- Modify: `extension/manifest.json:4`

- [ ] **Step 1: Edit**

Change `"version": "0.1.18"` → `"version": "0.1.19"`.

- [ ] **Step 2: Commit**

```bash
git add extension/manifest.json
git commit -m "chore(extension): bump version to 0.1.19 (quick-tag on save)"
```

### Task E2: full verification

- [ ] **Step 1: Types + unit tests + build**

Run: `rtk tsc`
Expected: `TypeScript compilation completed`.

Run: `npx vitest run tests/lib/order-tags-for-save.test.ts tests/lib/save-message.test.ts tests/extension/tag-strip-model.test.ts`
Expected: all PASS.

Run: `rtk vitest run`
Expected: full suite green except the known flaky `tests/lib/channel.test.ts` BroadcastChannel timing case (re-run it in isolation to confirm: `npx vitest run tests/lib/channel.test.ts` → PASS).

Run: `pnpm build`
Expected: static export completes, `/save-iframe` route present.

- [ ] **Step 2: Manual end-to-end (extension)**

Reload unpacked extension in `chrome://extensions`. Verify all three save surfaces show the strip and tagging persists:
1. Floating button ON → click → strip from button edge.
2. Floating button OFF (options) → keyboard shortcut → strip under cursor pill.
3. Re-save an already-saved URL → strip shows with current tags pre-marked ✓.

- [ ] **Step 3: Deploy app side to production**

The app-side changes (`/save-iframe`) must be live for the extension to receive tag payloads.

```bash
pnpm build
npx wrangler pages deploy out/ --project-name=allmarks --branch=master --commit-dirty=true --commit-message="quick-tag on save phase 1"
```

Then verify on production with the reloaded extension (the offscreen iframe loads `https://allmarks.app/save-iframe`).

---

## Self-Review Notes

- **Spec coverage:** save-first model (B2/D3/D4), confirmation-surface attachment for button + cursor pill (D3/D4 — covers floating-button-OFF users via the cursor pill), curated chips + ALL expansion (D1/D3/D4), ride-along tag data approach A (B1/B2/C3), no new-tag creation (chips only add existing; no input field), duplicate shows ✓ (B2 `currentTagIds` + D3/D4 `data-on`), **theme-matched + theme-switch-ready strip** (B1 `StripThemeTokens` → B2 `readThemeTokens` via `getComputedStyle` → C3 forward → D2 `--am-strip-*` vars → D3/D4 `applyStripTheme`). PiP (#3) and bookmarklet/paste (#4/#5) are explicitly out (phases 2-3).
- **Type consistency:** `QuickTag {id,name,color}` defined in A1, imported by B1, produced in B2, consumed inline in D3/D4 via `tag.id`/`tag.name`. Message types: `booklage:add-tag` (B1 schema) ↔ envelope in C2 ↔ handler in B3 ↔ result resolved in C1. `booklage:add-tag-request` (content → background) in D3/D4 ↔ C4.
- **Known non-TDD:** D3/D4 are DOM content-script code (no jsdom unit test); covered by manual verify. The pure decision logic they depend on is unit-tested in D1.
- **Out of scope (note for follow-up):** richer relevance via the full `HeuristicTagger` (A1 uses `scoreSimilarBookmarks`, which is sufficient and already tested); un-tagging from the strip; new-tag creation on the spot.
