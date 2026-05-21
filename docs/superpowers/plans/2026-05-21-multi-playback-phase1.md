# Multi-Playback Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the card's bottom-right media indicator a clickable play/audio toggle, and when pressed, mount a real inline player INSIDE the card that plays with audio — while keeping the bottom-right resize handle fully functional. Single active audio card for Phase 1 (the 4-slot pool comes in Phase 2).

**Architecture:** (1) Convert `MediaTypeIndicator` from a non-interactive badge into a clickable button using the proven `CardCornerActions` pattern (z-index above the resize handle, pointer-events only on the button, stopPropagation, hover-enlarge inward so the corner tip stays free for resize). (2) Extract the embed player components (YouTube/Vimeo/SoundCloud/TikTok) from the 2700-line `Lightbox.tsx` into a shared `components/board/embeds/` module so both Lightbox and inline cards reuse one implementation. (3) Board-level state tracks the single "audio-active" bookmark id; `CardNode` mounts the inline player for that card with autoplay+unmuted; pressing the icon toggles it.

**Tech Stack:** React 18 + Next.js + TypeScript strict + CSS Modules + vitest + happy-dom + playwright. No new deps. Reuses existing `lib/embed/default-volume.ts`, `lib/utils/url.ts` detectors.

**Spec:** [docs/superpowers/specs/2026-05-21-multi-playback-design.md](../specs/2026-05-21-multi-playback-design.md) — Phase 1 covers §4 (corner icon operability) + §3 Tier 3 single-card playback. Tiers 1/2 and the 4-slot pool are later phases.

---

## File Structure

**Create:**
- `components/board/embeds/index.ts` — barrel re-export of the extracted player components + a single `<InlineMediaPlayer>` dispatcher that picks the right embed by URL type
- `components/board/embeds/InlineMediaPlayer.tsx` — dispatcher: takes a `BoardItem` + flags, renders the correct extracted embed (or null for non-playable types)
- `tests/components/board/inline-media-player.test.tsx` — dispatcher routing tests

**Modify:**
- `components/board/Lightbox.tsx` — remove the now-extracted embed function bodies, import them from `embeds/` instead (mechanical; the embeds move verbatim)
- `components/board/MediaTypeIndicator.tsx` — add optional `onActivate` + `active` props; render as a `<button>` when interactive
- `components/board/MediaTypeIndicator.module.css` — clickable + hover-enlarge-inward + active-glow styling, z-index above resize handle
- `components/board/CardNode.tsx` — when the card is audio-active, render `<InlineMediaPlayer>` over the thumbnail
- `components/board/CardsLayer.tsx` — thread `audioActiveId` + `onToggleAudio` down to cards; pass `MediaTypeIndicator` the new props
- `components/board/BoardRoot.tsx` — own the `audioActiveId` state + toggle handler, pass to `CardsLayer`
- `components/board/MediaTypeIndicator.test.tsx` (create if absent) — button behavior tests

**Extraction note:** The embed components currently live inside `Lightbox.tsx`:
- `YouTubeEmbed` (Lightbox.tsx ~2328–2414)
- `VimeoEmbed` (~2416–2500)
- `SoundCloudEmbed` (~2692–end of that function)
- `TikTokEmbed`, `InstagramEmbed` (search the file for `function TikTokEmbed` / `function InstagramEmbed`)
Each moves verbatim into its own file under `embeds/`. They depend on `getDefaultVolume` (`lib/embed/default-volume.ts`) and React hooks already imported there.

---

## Task 1: Make MediaTypeIndicator a clickable, hover-enlarging toggle button

**Files:**
- Modify: `components/board/MediaTypeIndicator.tsx`
- Modify: `components/board/MediaTypeIndicator.module.css`
- Create: `components/board/MediaTypeIndicator.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/board/MediaTypeIndicator.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { MediaTypeIndicator } from './MediaTypeIndicator'

describe('MediaTypeIndicator', () => {
  it('renders nothing when type is null', () => {
    const { container } = render(<MediaTypeIndicator type={null} visible={true} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a non-interactive badge (div) when onActivate is absent', () => {
    const { container } = render(<MediaTypeIndicator type="photo" visible={true} />)
    const el = container.querySelector('[data-testid="media-indicator"]')
    expect(el).not.toBeNull()
    expect(el!.tagName).toBe('DIV')
  })

  it('renders a button and fires onActivate on click for a video card', () => {
    const onActivate = vi.fn()
    const { container } = render(
      <MediaTypeIndicator type="video" visible={true} onActivate={onActivate} active={false} />,
    )
    const btn = container.querySelector('[data-testid="media-indicator"]') as HTMLElement
    expect(btn.tagName).toBe('BUTTON')
    fireEvent.click(btn)
    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it('stops pointerdown propagation so card reorder/resize do not engage', () => {
    const onActivate = vi.fn()
    const { container } = render(
      <MediaTypeIndicator type="video" visible={true} onActivate={onActivate} active={false} />,
    )
    const btn = container.querySelector('[data-testid="media-indicator"]') as HTMLElement
    const ev = new MouseEvent('pointerdown', { bubbles: true, cancelable: true })
    const stop = vi.spyOn(ev, 'stopPropagation')
    btn.dispatchEvent(ev)
    expect(stop).toHaveBeenCalled()
  })

  it('reflects active state via data-active', () => {
    const { container } = render(
      <MediaTypeIndicator type="video" visible={true} onActivate={() => {}} active={true} />,
    )
    const btn = container.querySelector('[data-testid="media-indicator"]') as HTMLElement
    expect(btn.getAttribute('data-active')).toBe('true')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run components/board/MediaTypeIndicator`
Expected: FAIL — current component renders a `<div>` with no `data-testid`, no `onActivate`/`active` props.

- [ ] **Step 3: Rewrite the component**

Replace `components/board/MediaTypeIndicator.tsx` in full:

```tsx
'use client'

import { type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import styles from './MediaTypeIndicator.module.css'

export type MediaType = 'video' | 'photo'

type Props = {
  /** null hides the indicator entirely (e.g. text-only cards). */
  readonly type: MediaType | null
  readonly visible: boolean
  /** When provided, the indicator becomes an interactive toggle button.
   *  Pressing it activates inline playback-with-audio for the card.
   *  Absent → the indicator stays a passive badge (photo cards, etc.). */
  readonly onActivate?: () => void
  /** True when this card is currently the audio-active card (Tier 3). */
  readonly active?: boolean
}

/**
 * Bottom-right card indicator. For photo cards it's a passive badge.
 * For video/audio cards with `onActivate`, it's a clickable toggle that
 * starts/stops inline playback-with-audio.
 *
 * Interaction safety (mirrors CardCornerActions): the button sits at
 * z-index 50 (above the resize handle's 30) but only consumes pointer
 * events on its own footprint, and stops pointerdown propagation so the
 * card reorder drag never engages. It is anchored 8px inside the corner
 * and grows INWARD on hover, so the corner tip + outer ring stay free
 * for the bottom-right resize handle.
 */
export function MediaTypeIndicator({
  type,
  visible,
  onActivate,
  active = false,
}: Props): ReactElement | null {
  if (type === null) return null

  const interactive = typeof onActivate === 'function'
  const icon = type === 'video' ? <VideoIcon /> : <PhotoIcon />

  if (!interactive) {
    return (
      <div
        className={styles.indicator}
        data-testid="media-indicator"
        data-visible={visible}
        aria-label={type === 'video' ? 'video' : 'photo'}
      >
        {icon}
      </div>
    )
  }

  const swallow = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    e.stopPropagation()
  }

  return (
    <button
      type="button"
      className={styles.indicator + ' ' + styles.interactive}
      data-testid="media-indicator"
      data-visible={visible}
      data-active={active ? 'true' : 'false'}
      aria-label={type === 'video' ? 'Play with sound' : 'Play audio'}
      aria-pressed={active}
      onPointerDown={swallow}
      onMouseDown={swallow}
      onClick={(e): void => {
        e.stopPropagation()
        onActivate?.()
      }}
    >
      {icon}
    </button>
  )
}

function VideoIcon(): ReactElement {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h2M3 15h2M19 9h2M19 15h2" />
      <path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function PhotoIcon(): ReactElement {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <path d="M21 16l-5-5-7 7" />
    </svg>
  )
}
```

- [ ] **Step 4: Update the CSS module**

Replace `components/board/MediaTypeIndicator.module.css` in full:

```css
/* Hover-revealed indicator anchored at bottom-right of the card. Dark
   glass + 1px white inset. For interactive (video/audio) cards it becomes
   a clickable toggle that grows INWARD on hover so the corner tip stays
   free for the resize handle. */
.indicator {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: rgba(18, 18, 20, 0.75);
  -webkit-backdrop-filter: blur(8px) saturate(1.1);
  backdrop-filter: blur(8px) saturate(1.1);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.92);
  pointer-events: none;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 160ms ease, transform 160ms ease, width 140ms ease, height 140ms ease;
  /* Above the resize handle (z 30) so clicks on the button win, like the
     × / ↺ corner actions (z 50). */
  z-index: 50;
}

.indicator[data-visible='true'] {
  opacity: 1;
  transform: translateY(0);
}

/* Interactive variant — clickable, pointer cursor, grows inward on hover. */
.interactive {
  pointer-events: auto;
  cursor: pointer;
  padding: 0;
  font: inherit;
  /* Anchored bottom-right at 8px inset; increasing width/height grows the
     box up-and-left (inward), never toward the corner tip. */
  transform-origin: bottom right;
}

.interactive[data-visible='true']:hover {
  width: 34px;
  height: 34px;
}

.interactive .icon {
  transition: width 140ms ease, height 140ms ease;
}

.interactive[data-visible='true']:hover .icon {
  width: 18px;
  height: 18px;
}

/* Active (audio-on / pinned) — AllMarks success-green glow language. */
.interactive[data-active='true'] {
  color: rgba(74, 222, 128, 0.98);
  border-color: rgba(74, 222, 128, 0.55);
  box-shadow:
    0 0 3px rgba(74, 222, 128, 0.5),
    0 0 8px rgba(74, 222, 128, 0.35);
}

.icon {
  width: 12px;
  height: 12px;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run components/board/MediaTypeIndicator`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/MediaTypeIndicator.tsx components/board/MediaTypeIndicator.module.css components/board/MediaTypeIndicator.test.tsx
rtk git commit -m "feat(board): make MediaTypeIndicator a clickable play/audio toggle (multi-playback P1)"
```

---

## Task 2: Extract embed players from Lightbox.tsx into a shared module

**Files:**
- Create: `components/board/embeds/YouTubeEmbed.tsx`, `VimeoEmbed.tsx`, `SoundCloudEmbed.tsx`, `TikTokEmbed.tsx`, `InstagramEmbed.tsx`
- Create: `components/board/embeds/index.ts`
- Modify: `components/board/Lightbox.tsx`

- [ ] **Step 1: Locate the exact function bounds**

Run: `pnpm exec grep -n "^function \(YouTubeEmbed\|VimeoEmbed\|SoundCloudEmbed\|TikTokEmbed\|InstagramEmbed\)" components/board/Lightbox.tsx`
Expected: prints the start line of each of the 5 embed functions. Note each function's full body span (from `function X(` to its closing `}` at column 0).

- [ ] **Step 2: Move each embed function verbatim into its own file**

For each of the 5 components, cut the entire function (signature + body) from `Lightbox.tsx` and paste it into the matching new file under `components/board/embeds/`. Add at the top of each new file: `'use client'`, the React imports it uses (`useState`, `useRef`, `useEffect`, `type ReactNode` as needed — copy from Lightbox's import block), and `import { getDefaultVolume } from '@/lib/embed/default-volume'` where used. Change each `function X(` to `export function X(`. Do NOT alter the function bodies.

Example for YouTube (`components/board/embeds/YouTubeEmbed.tsx`):

```tsx
'use client'

import { useState, useRef, type ReactNode } from 'react'
import { getDefaultVolume } from '@/lib/embed/default-volume'

export function YouTubeEmbed({
  videoId,
  title,
  vertical,
  thumbnail,
  aspectRatio,
}: {
  readonly videoId: string
  readonly title: string
  readonly vertical: boolean
  readonly thumbnail: string | undefined
  readonly aspectRatio: number | undefined
}): ReactNode {
  // ...verbatim body moved from Lightbox.tsx...
}
```

(Repeat structurally for Vimeo / SoundCloud / TikTok / Instagram — copy each body verbatim, only adding the imports each one actually references. If a body references a helper defined in Lightbox.tsx, also move/duplicate that helper or import it; verify with tsc in Step 4.)

- [ ] **Step 3: Add the barrel + re-import in Lightbox**

Create `components/board/embeds/index.ts`:

```ts
export { YouTubeEmbed } from './YouTubeEmbed'
export { VimeoEmbed } from './VimeoEmbed'
export { SoundCloudEmbed } from './SoundCloudEmbed'
export { TikTokEmbed } from './TikTokEmbed'
export { InstagramEmbed } from './InstagramEmbed'
```

In `Lightbox.tsx`, add near the other component imports:

```tsx
import {
  YouTubeEmbed,
  VimeoEmbed,
  SoundCloudEmbed,
  TikTokEmbed,
  InstagramEmbed,
} from './embeds'
```

- [ ] **Step 4: Type-check + run the full suite (Lightbox must still work)**

Run: `pnpm tsc --noEmit && rtk pnpm vitest run`
Expected: tsc clean; all existing tests pass (no behavior change — pure relocation). If tsc reports a missing symbol, it's a helper the embed body referenced — move/import it (Step 2 note).

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/embeds components/board/Lightbox.tsx
rtk git commit -m "refactor(board): extract Lightbox embed players into shared embeds/ module (multi-playback P1)"
```

---

## Task 3: InlineMediaPlayer dispatcher

**Files:**
- Create: `components/board/embeds/InlineMediaPlayer.tsx`
- Create: `tests/components/board/inline-media-player.test.tsx`
- Modify: `components/board/embeds/index.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/board/inline-media-player.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { canPlayInline } from '@/components/board/embeds/InlineMediaPlayer'

describe('canPlayInline', () => {
  it('returns true for youtube / vimeo / soundcloud / tiktok urls', () => {
    expect(canPlayInline('https://www.youtube.com/watch?v=abc')).toBe(true)
    expect(canPlayInline('https://vimeo.com/12345')).toBe(true)
    expect(canPlayInline('https://soundcloud.com/artist/track')).toBe(true)
    expect(canPlayInline('https://www.tiktok.com/@u/video/123')).toBe(true)
  })

  it('returns false for a generic webpage or image', () => {
    expect(canPlayInline('https://example.com/article')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/components/board/inline-media-player`
Expected: FAIL — module/`canPlayInline` does not exist yet.

- [ ] **Step 3: Implement the dispatcher**

Create `components/board/embeds/InlineMediaPlayer.tsx`:

```tsx
'use client'

import { type ReactElement } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import {
  detectUrlType,
  extractTweetId,
  extractTikTokVideoId,
  extractVimeoId,
} from '@/lib/utils/url'
import { YouTubeEmbed } from './YouTubeEmbed'
import { VimeoEmbed } from './VimeoEmbed'
import { SoundCloudEmbed } from './SoundCloudEmbed'
import { TikTokEmbed } from './TikTokEmbed'

/** True when the URL is a platform we can mount an inline audio player for. */
export function canPlayInline(url: string): boolean {
  const t = detectUrlType(url)
  return t === 'youtube' || t === 'vimeo' || t === 'soundcloud' || t === 'tiktok'
}

/** Extract the YouTube video id from a watch/short/embed/youtu.be URL. */
function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([\w-]{11})/)
  return m?.[1] ?? null
}

/**
 * Mounts the correct extracted embed player for a card's URL, sized to the
 * card. Phase 1: used for the single audio-active card (Tier 3) — the
 * embeds autoplay on mount because `hasInteracted` is seeded by the icon
 * press being the user gesture. Returns null for non-playable types.
 */
export function InlineMediaPlayer({
  item,
  aspectRatio,
}: {
  readonly item: BoardItem
  readonly aspectRatio: number | undefined
}): ReactElement | null {
  const type = detectUrlType(item.url)
  const thumb = item.thumbnail

  if (type === 'youtube') {
    const id = extractYouTubeId(item.url)
    if (id) return <YouTubeEmbed videoId={id} title={item.title} vertical={false} thumbnail={thumb} aspectRatio={aspectRatio} />
  }
  if (type === 'vimeo') {
    const id = extractVimeoId(item.url)
    if (id) return <VimeoEmbed videoId={id} title={item.title} thumbnail={thumb} aspectRatio={aspectRatio} />
  }
  if (type === 'soundcloud') {
    return <SoundCloudEmbed url={item.url} title={item.title} thumbnail={thumb} aspectRatio={aspectRatio} />
  }
  if (type === 'tiktok') {
    const id = extractTikTokVideoId(item.url)
    if (id) return <TikTokEmbed videoId={id} url={item.url} title={item.title} thumbnail={thumb} aspectRatio={aspectRatio} />
  }
  return null
}
```

Note: confirm the exact names of the URL helpers (`extractTikTokVideoId`, `extractVimeoId`) in `lib/utils/url.ts` during Step 1 of Task 2; if a helper has a different name, use the actual export. If `extractYouTubeId` already exists in `lib/utils/url.ts`, import it instead of redefining.

- [ ] **Step 4: Export from barrel + run tests**

Add to `components/board/embeds/index.ts`:

```ts
export { InlineMediaPlayer, canPlayInline } from './InlineMediaPlayer'
```

Run: `pnpm vitest run tests/components/board/inline-media-player`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/embeds/InlineMediaPlayer.tsx components/board/embeds/index.ts tests/components/board/inline-media-player.test.tsx
rtk git commit -m "feat(board): InlineMediaPlayer dispatcher for inline card playback (multi-playback P1)"
```

---

## Task 4: Wire audio-active state through the board

**Files:**
- Modify: `components/board/BoardRoot.tsx`
- Modify: `components/board/CardsLayer.tsx`
- Modify: `components/board/CardNode.tsx`

- [ ] **Step 1: Add audio-active state in BoardRoot**

In `components/board/BoardRoot.tsx`, near the other board UI state (`useState` calls), add:

```tsx
// Phase 1 multi-playback: the single card currently playing with audio
// (Tier 3). Pressing a card's media indicator toggles this; pressing a
// different card switches it. The 4-slot pool replaces this in Phase 2.
const [audioActiveId, setAudioActiveId] = useState<string | null>(null)
const handleToggleAudio = useCallback((bookmarkId: string): void => {
  setAudioActiveId((cur) => (cur === bookmarkId ? null : bookmarkId))
}, [])
```

Find the `<CardsLayer ... />` usage and add the two props:

```tsx
audioActiveId={audioActiveId}
onToggleAudio={handleToggleAudio}
```

(If `useCallback` isn't already imported in BoardRoot, add it to the React import.)

- [ ] **Step 2: Thread the props through CardsLayer**

In `components/board/CardsLayer.tsx`, add to `CardsLayerProps`:

```tsx
readonly audioActiveId: string | null
readonly onToggleAudio: (bookmarkId: string) => void
```

Destructure them in the component params, and where each card is rendered (the `CardNode` / `pickCard` call site that also renders `MediaTypeIndicator`), pass:

```tsx
audioActive={audioActiveId === item.id}
onToggleAudio={(): void => onToggleAudio(item.id)}
```

- [ ] **Step 3: Render inline player + wire the indicator in CardNode**

In `components/board/CardNode.tsx`, add to its props type:

```tsx
readonly audioActive?: boolean
readonly onToggleAudio?: () => void
```

Where `MediaTypeIndicator` is rendered, change it to (only video/soundcloud cards become interactive):

```tsx
<MediaTypeIndicator
  type={mediaType}
  visible={hovered}
  onActivate={canPlayInline(item.url) ? onToggleAudio : undefined}
  active={audioActive}
/>
```

And where the card thumbnail/body renders, when `audioActive` is true, overlay the inline player:

```tsx
{audioActive && canPlayInline(item.url) && (
  <div className={styles.inlinePlayer}>
    <InlineMediaPlayer item={item} aspectRatio={aspectRatio} />
  </div>
)}
```

Add the imports at the top of `CardNode.tsx`:

```tsx
import { InlineMediaPlayer, canPlayInline } from './embeds'
```

Add to `CardNode.module.css` (create the rule; if CardNode uses a different stylesheet, add it there):

```css
.inlinePlayer {
  position: absolute;
  inset: 0;
  z-index: 10;
  overflow: hidden;
  border-radius: inherit;
}
```

(`mediaType`, `hovered`, `aspectRatio` are existing locals/props in CardNode — confirm their names while editing and use the actual identifiers.)

- [ ] **Step 4: Type-check + full suite**

Run: `pnpm tsc --noEmit && rtk pnpm vitest run`
Expected: tsc clean; all tests pass.

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/BoardRoot.tsx components/board/CardsLayer.tsx components/board/CardNode.tsx components/board/CardNode.module.css
rtk git commit -m "feat(board): wire audio-active card → inline player on indicator press (multi-playback P1)"
```

---

## Task 5: Build + Playwright verification (resize MUST still work)

**Files:** (verification only)

- [ ] **Step 1: Production build**

Run: `pnpm build`
Expected: success, `out/` regenerated.

- [ ] **Step 2: Start dev server for interactive verification**

Run (background): `pnpm dev`
Wait for "Ready". Use `http://localhost:3000/board`. (Seed a few video/SoundCloud bookmarks first via the app if the board is empty — or use `/seed-demos` if available.)

- [ ] **Step 3: Playwright script — icon clickable, inline play, resize intact**

Write `C:/Users/masay/AppData/Local/Temp/verify-multiplayback-p1.mjs`:

```javascript
import { chromium } from 'file:///C:/Users/masay/Desktop/マイコラージュ/node_modules/playwright-core/index.mjs'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1489, height: 679 }, deviceScaleFactor: 2.58 })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:3000/board')
await page.waitForTimeout(1500)

// Find a video/soundcloud card's indicator (hover a card first to reveal it)
const card = page.locator('[data-testid^="card-"]').first()
const cardBox = await card.boundingBox()
console.log('card box:', JSON.stringify(cardBox))
await card.hover()
await page.waitForTimeout(300)

const indicator = page.locator('[data-testid="media-indicator"]').first()
const before = await indicator.getAttribute('data-active')
console.log('indicator data-active before click:', before)

// 1) Press the indicator → audio-active true + inline player mounts
await indicator.click()
await page.waitForTimeout(400)
const after = await indicator.getAttribute('data-active')
console.log('indicator data-active after click (expect true):', after)
const playerCount = await page.locator('iframe, video').count()
console.log('inline players mounted (expect >=1):', playerCount)

// 2) CRITICAL: bottom-right resize handle still works
if (cardBox) {
  const brX = cardBox.x + cardBox.width - 2
  const brY = cardBox.y + cardBox.height - 2
  const widthBefore = cardBox.width
  await page.mouse.move(brX, brY)
  await page.mouse.down()
  await page.mouse.move(brX + 80, brY + 80, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const after2 = await card.boundingBox()
  console.log('card width before/after BR resize:', widthBefore, after2?.width)
  console.log('BR resize worked:', !!after2 && Math.abs(after2.width - widthBefore) > 10)
}

await page.screenshot({ path: 'C:/Users/masay/AppData/Local/Temp/multiplayback-p1.png' })
await browser.close()
```

Run: `node C:/Users/masay/AppData/Local/Temp/verify-multiplayback-p1.mjs`
Expected output:
- `data-active after click` = `true`
- `inline players mounted` ≥ 1
- `BR resize worked: true` ← **this is the must-pass check from spec §4**

If `BR resize worked: false`, the indicator is blocking the corner tip — adjust the indicator's inset/hover-size so the corner tip stays free, and re-test before proceeding.

- [ ] **Step 4: Report to user for manual confirmation**

Message: 「Phase 1 deploy 前の動作確認です。 localhost:3000/board で (1) 動画カードにホバー→右下アイコンが拡大して押せる、 (2) 押すと音つきでカード内再生、 (3) もう一度押すと止まる、 (4) 右下の角をつまんでリサイズが効く、 を確認してください。」

- [ ] **Step 5: Deploy after user confirms**

```bash
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="multi-playback-phase1"
```

Then tell the user to hard-reload `booklage.pages.dev`.

---

## Self-Review notes

- **Spec coverage:** §4 corner operability → Task 1 + Task 5 resize check. §3 Tier 3 single-card playback → Tasks 3+4. Player reuse (§6) → Task 2 extraction. Tiers 1/2 + 4-slot pool + master switch → explicitly out of Phase 1 (later phases).
- **Deferred-to-implementation confirmations:** exact line spans for the embed extraction (Task 2 Step 1), exact URL-helper export names, and CardNode's local identifier names (`mediaType`/`hovered`/`aspectRatio`) — each task step says to confirm the real names while editing. These are lookups, not design gaps.
- **Single-active simplification:** Phase 1 keeps ONE audio-active card (`audioActiveId: string | null`). The 4-slot LRU pool (`usePlaybackPool`) is Phase 2 — do not build it here (YAGNI for P1).
