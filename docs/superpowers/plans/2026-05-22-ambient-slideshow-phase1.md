# Ambient Frame Slideshow — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the board's muted multi-video Tier 1 autoplay with a cheap still-frame crossfade on in-view video cards plus exactly ONE muted "hero" video playing at a time, to cut the 4K compositing cost.

**Architecture:** Two layers in `CardsLayer`. (A) An ambient slideshow overlay (`CardSlideshow`) on every in-view video card that isn't the hero — it cross-fades through still frames resolved by a pure helper (`resolveSlideshowFrames`): YouTube uses its free storyboard stills (poster + ~25% + ~50%), everything else uses its single poster. (B) The existing rotating spotlight (`useSpotlightRotation`) pinned to cap 1 with a ~15s dwell selects the single hero, which mounts the real muted player. Photo/text cards stay static. `prefers-reduced-motion` and the MOTION switch freeze both layers.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript strict, Vanilla CSS Modules, Vitest + @testing-library/react. Spec: [docs/superpowers/specs/2026-05-22-ambient-frame-slideshow-design.md](../specs/2026-05-22-ambient-frame-slideshow-design.md).

> **Phase 1 scope note:** X-video (tweet mp4) cards show their single poster (static) in Phase 1. Real 0/25/50% frame extraction for X is Phase 2 (separate plan). Vimeo/other are poster-only by design (a hard platform limit).

---

### Task 1: `resolveSlideshowFrames` — pure frame-source resolver

**Files:**
- Create: `lib/board/slideshow-frames.ts`
- Test: `tests/lib/slideshow-frames.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { resolveSlideshowFrames } from '@/lib/board/slideshow-frames'

const yt = (thumbnail?: string) => ({
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  title: 'yt',
  thumbnail,
})

describe('resolveSlideshowFrames', () => {
  it('returns poster + ~25% + ~50% storyboard stills for YouTube (no end frame)', () => {
    const frames = resolveSlideshowFrames(yt('https://saved/thumb.jpg'))
    expect(frames).toEqual([
      { src: 'https://saved/thumb.jpg' },
      { src: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq1.jpg', fallback: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/1.jpg' },
      { src: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq2.jpg', fallback: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/2.jpg' },
    ])
    // Must never include the ~75% (hq3) or end frame.
    expect(JSON.stringify(frames)).not.toContain('hq3')
  })

  it('falls back to YouTube hqdefault as the poster when the item has no thumbnail', () => {
    const frames = resolveSlideshowFrames(yt(undefined))
    expect(frames[0]).toEqual({ src: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' })
  })

  it('returns the single poster for non-YouTube video cards (Vimeo / X / etc.)', () => {
    expect(
      resolveSlideshowFrames({ url: 'https://vimeo.com/12345', title: 'v', thumbnail: 'https://saved/v.jpg' }),
    ).toEqual([{ src: 'https://saved/v.jpg' }])
    expect(
      resolveSlideshowFrames({ url: 'https://x.com/u/status/1', title: 'x', thumbnail: 'https://saved/x.jpg', hasVideo: true }),
    ).toEqual([{ src: 'https://saved/x.jpg' }])
  })

  it('returns [] when there is no usable image', () => {
    expect(resolveSlideshowFrames({ url: 'https://vimeo.com/12345', title: 'v', thumbnail: undefined })).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/slideshow-frames.test.ts`
Expected: FAIL — `resolveSlideshowFrames` is not defined / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import { detectUrlType, extractYoutubeId } from '@/lib/utils/url'
import type { PlayableItem } from '@/components/board/embeds/media-players'

/** One still in a card's ambient slideshow. `fallback` is tried once if `src`
 *  fails to load — YouTube's hi-res storyboard frames (hq1/hq2) 404 on a
 *  minority of videos, but the low-res (1/2) version almost always exists. */
export type SlideshowFrame = { readonly src: string; readonly fallback?: string }

/** Resolve the ordered still frames for a video card's ambient slideshow.
 *  - YouTube: poster + ~25% (hq1) + ~50% (hq2) storyboard stills. Zero decode
 *    (plain images from i.ytimg.com). Deliberately skips the ~75% (hq3) frame
 *    so the cycle never lands on a dark end-of-video frame.
 *  - Everything else (Vimeo, X-video in Phase 1, generic): the single poster.
 *  Returns [] when there's no usable image. Pure — unit tested. */
export function resolveSlideshowFrames(item: PlayableItem): readonly SlideshowFrame[] {
  if (detectUrlType(item.url) === 'youtube') {
    const id = extractYoutubeId(item.url)
    if (id) {
      const base = `https://i.ytimg.com/vi/${id}`
      return [
        { src: item.thumbnail || `${base}/hqdefault.jpg` },
        { src: `${base}/hq1.jpg`, fallback: `${base}/1.jpg` },
        { src: `${base}/hq2.jpg`, fallback: `${base}/2.jpg` },
      ]
    }
  }
  return item.thumbnail ? [{ src: item.thumbnail }] : []
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/slideshow-frames.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/slideshow-frames.ts tests/lib/slideshow-frames.test.ts
rtk git commit -m "feat(board): resolveSlideshowFrames — still-frame source per platform"
```

---

### Task 2: `useReducedMotion` — OS reduced-motion signal

**Files:**
- Create: `lib/board/use-reduced-motion.ts`
- Test: `tests/lib/use-reduced-motion.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { type ReactElement } from 'react'
import { useReducedMotion } from '@/lib/board/use-reduced-motion'

function Probe(): ReactElement {
  return <span data-testid="v">{String(useReducedMotion())}</span>
}

function mockMatchMedia(matches: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }))
}

describe('useReducedMotion', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('reports true when the OS prefers reduced motion', () => {
    mockMatchMedia(true)
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('v').textContent).toBe('true')
  })

  it('reports false when the OS does not prefer reduced motion', () => {
    mockMatchMedia(false)
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('v').textContent).toBe('false')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/use-reduced-motion.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import { useEffect, useState } from 'react'

/** True when the OS "reduce motion" accessibility setting is on. SSR-safe:
 *  starts false, reads the real value in an effect (so server render and the
 *  first client render agree, then it updates). */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduce(mq.matches)
    const onChange = (): void => setReduce(mq.matches)
    mq.addEventListener('change', onChange)
    return (): void => mq.removeEventListener('change', onChange)
  }, [])
  return reduce
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/use-reduced-motion.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/use-reduced-motion.ts tests/lib/use-reduced-motion.test.tsx
rtk git commit -m "feat(board): useReducedMotion hook"
```

---

### Task 3: `useSlideshowCycle` — staggered crossfade index

**Files:**
- Create: `lib/board/use-slideshow-cycle.ts`
- Test: `tests/lib/use-slideshow-cycle.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { type ReactElement } from 'react'
import { useSlideshowCycle } from '@/lib/board/use-slideshow-cycle'

function Probe({ count }: { count: number }): ReactElement {
  return <span data-testid="i">{useSlideshowCycle(count)}</span>
}

describe('useSlideshowCycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Deterministic timing: random()=0 → zero initial offset, minimum step.
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('stays at 0 and never advances when there are fewer than 2 frames', () => {
    const { getByTestId } = render(<Probe count={1} />)
    expect(getByTestId('i').textContent).toBe('0')
    act(() => { vi.advanceTimersByTime(20000) })
    expect(getByTestId('i').textContent).toBe('0')
  })

  it('cycles 0→1→2→0 through the frames on its timer', () => {
    const { getByTestId } = render(<Probe count={3} />)
    expect(getByTestId('i').textContent).toBe('0')
    act(() => { vi.advanceTimersByTime(2600) }) // MIN_STEP_MS with random()=0
    expect(getByTestId('i').textContent).toBe('1')
    act(() => { vi.advanceTimersByTime(2600) })
    expect(getByTestId('i').textContent).toBe('2')
    act(() => { vi.advanceTimersByTime(2600) })
    expect(getByTestId('i').textContent).toBe('0')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/use-slideshow-cycle.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import { useEffect, useRef, useState } from 'react'

const MIN_STEP_MS = 2600
const MAX_STEP_MS = 4200

/** Drives a card's ambient crossfade: returns the index of the frame to show.
 *  Advances on a per-instance, randomly-timed interval so cards never swap in
 *  unison (the board ripples rather than blinking together) and the tiny paint
 *  cost is spread over time. Static (always 0) when there are <2 frames. */
export function useSlideshowCycle(frameCount: number): number {
  const [index, setIndex] = useState(0)
  const countRef = useRef(frameCount)
  countRef.current = frameCount
  useEffect(() => {
    if (frameCount < 2) {
      setIndex(0)
      return
    }
    let timer: number
    const step = (): number => MIN_STEP_MS + Math.random() * (MAX_STEP_MS - MIN_STEP_MS)
    const tick = (): void => {
      setIndex((i) => (i + 1) % countRef.current)
      timer = window.setTimeout(tick, step())
    }
    // Random initial offset so two cards mounted together desync immediately.
    timer = window.setTimeout(tick, Math.random() * MAX_STEP_MS)
    return (): void => window.clearTimeout(timer)
  }, [frameCount])
  return frameCount < 2 ? 0 : index
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/use-slideshow-cycle.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/board/use-slideshow-cycle.ts tests/lib/use-slideshow-cycle.test.tsx
rtk git commit -m "feat(board): useSlideshowCycle — staggered crossfade index"
```

---

### Task 4: `CardSlideshow` — crossfade overlay component

**Files:**
- Create: `components/board/CardSlideshow.tsx`
- Create: `components/board/CardSlideshow.module.css`
- Test: `tests/components/board/card-slideshow.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { CardSlideshow } from '@/components/board/CardSlideshow'

describe('CardSlideshow', () => {
  it('renders nothing when there are no frames', () => {
    const { container } = render(<CardSlideshow frames={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('stacks all frames and shows the first one opaque', () => {
    const { container } = render(
      <CardSlideshow frames={[{ src: 'a.jpg' }, { src: 'b.jpg' }]} />,
    )
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(2)
    expect((imgs[0] as HTMLElement).style.opacity).toBe('1')
    expect((imgs[1] as HTMLElement).style.opacity).toBe('0')
  })

  it('swaps to the fallback url once when a frame fails to load', () => {
    const { container } = render(
      <CardSlideshow frames={[{ src: 'hq1.jpg', fallback: '1.jpg' }]} />,
    )
    const img = container.querySelector('img')!
    expect(img.getAttribute('src')).toBe('hq1.jpg')
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe('1.jpg')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/board/card-slideshow.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3a: Write the component**

```tsx
'use client'

import { useState, type ReactElement } from 'react'
import styles from './CardSlideshow.module.css'
import { useSlideshowCycle } from '@/lib/board/use-slideshow-cycle'
import type { SlideshowFrame } from '@/lib/board/slideshow-frames'

/**
 * Ambient still-frame crossfade for an in-view video card that is NOT the
 * single live hero video. Purely decorative + non-interactive (the parent
 * overlay wrapper sets pointer-events:none). Stacks the frames and fades the
 * active one in. With <2 frames it just shows the single still (no animation).
 * On image error it swaps to the frame's fallback url once.
 */
export function CardSlideshow({ frames }: { readonly frames: readonly SlideshowFrame[] }): ReactElement | null {
  const active = useSlideshowCycle(frames.length)
  const [failed, setFailed] = useState<readonly boolean[]>(() => frames.map(() => false))
  if (frames.length === 0) return null
  return (
    <div className={styles.stack} aria-hidden="true">
      {frames.map((f, i) => (
        <img
          key={f.src}
          className={styles.frame}
          src={failed[i] && f.fallback ? f.fallback : f.src}
          alt=""
          style={{ opacity: i === active ? 1 : 0 }}
          onError={(): void =>
            setFailed((prev) => (prev[i] ? prev : prev.map((v, j) => (j === i ? true : v))))
          }
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 3b: Write the CSS module**

```css
/* components/board/CardSlideshow.module.css */
.stack {
  position: absolute;
  inset: 0;
}

.frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  /* Match the resting card thumbnail (CardNode.module.css uses object-fit:
     cover) so appearing/disappearing causes no visible jump. */
  object-fit: cover;
  transition: opacity 800ms ease-in-out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/board/card-slideshow.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/CardSlideshow.tsx components/board/CardSlideshow.module.css tests/components/board/card-slideshow.test.tsx
rtk git commit -m "feat(board): CardSlideshow crossfade overlay"
```

---

### Task 5: Wire into `CardsLayer` — single hero (cap 1, ~15s) + slideshow overlay

**Files:**
- Modify: `components/board/CardsLayer.tsx` (constants block ~L49-66; spotlight wiring ~L399-408; render overlays ~L705-731; imports ~L25-28)

- [ ] **Step 1: Replace the area-budget constants with a fixed single-hero cap**

Find this block (around L49-66):

```ts
const DENSE_CARD_W = PRESETS.find((p) => p.id === 'dense')?.w ?? 207.8
const LIVE_AREA_BUDGET = 3 * DENSE_CARD_W * DENSE_CARD_W
const MAX_LIVE = 6
/** Target playtime per card. The rotation interval is derived as
 *  PER_CARD_MS / cap so a card plays ~this long regardless of how many share
 *  the spotlight (playtime ≈ cap × interval). Generous because a YouTube iframe
 *  spends ~2-3s starting up (hidden behind the thumbnail until it truly plays),
 *  so the visible window needs to be long enough to be worth it. */
const PER_CARD_MS = 9000
const MIN_ROTATE_MS = 1500
```

Replace it with:

```ts
/** Exactly ONE video plays for real at a time (the "hero"). Everything else
 *  in view runs the cheap still-frame slideshow (CardSlideshow), so the heavy
 *  GPU compositing cost is a single playing region instead of several. */
const HERO_CAP = 1
/** How long the hero dwells on one card before the spotlight hands off to the
 *  next in-view video card. Generous: a YouTube iframe spends ~2-3s starting
 *  up (hidden behind the thumbnail until it truly plays). */
const HERO_PER_CARD_MS = 15000
const MIN_ROTATE_MS = 1500
```

- [ ] **Step 2: Replace the cap/interval derivation with the fixed hero cap + reduced-motion gate**

Find this block (around L399-408):

```ts
  const liveCap = useMemo(() => {
    const fit = Math.round(LIVE_AREA_BUDGET / (defaultCardWidth * defaultCardWidth))
    return Math.max(1, Math.min(MAX_LIVE, fit))
  }, [defaultCardWidth])
  const rotateMs = Math.max(MIN_ROTATE_MS, Math.round(PER_CARD_MS / liveCap))
  // Stop all ambient playback while the Lightbox is open (sourceCardId set): the
  // board freezes to still thumbnails so the focused view isn't competing with
  // motion behind it, and we don't burn GPU on hidden cards.
  const spotlightCap = motionEnabled && !sourceCardId ? liveCap : 0
  const playing = useSpotlightRotation(candidates, spotlightCap, rotateMs)
```

Replace it with:

```ts
  // Stop all ambient motion (hero video AND slideshow) while the Lightbox is
  // open (sourceCardId set) or when the OS prefers reduced motion: the board
  // freezes to still thumbnails so nothing competes with the focused view and
  // we don't burn GPU on hidden cards.
  const ambientOn = motionEnabled && !sourceCardId && !reduceMotion
  const rotateMs = Math.max(MIN_ROTATE_MS, HERO_PER_CARD_MS)
  const spotlightCap = ambientOn ? HERO_CAP : 0
  const playing = useSpotlightRotation(candidates, spotlightCap, rotateMs)
```

- [ ] **Step 3: Add the imports and the reduced-motion hook call**

Add to the existing embed import group (the line that imports from `'./embeds'`, ~L25) — add two new import lines directly after it:

```ts
import { CardSlideshow } from './CardSlideshow'
import { resolveSlideshowFrames } from '@/lib/board/slideshow-frames'
import { useReducedMotion } from '@/lib/board/use-reduced-motion'
```

Then, inside the `CardsLayer` component body, near the other hooks at the top of the function (before the spotlight `useMemo`s, e.g. just after the component's first hooks), add:

```ts
  const reduceMotion = useReducedMotion()
```

(Placement only needs to be above the `ambientOn` line from Step 2 — any spot in the component body before it works, since `useReducedMotion` takes no arguments.)

- [ ] **Step 4: Add the slideshow overlay in the card render, right after the Tier 1 hero block**

Find the Tier 1 block that ends around L730-731:

```tsx
                <InlineMediaPlayer
                  item={it}
                  muted
                  onUnplayable={(): void => markUnplayable(it.bookmarkId)}
                />
              </div>
            )}
```

Immediately AFTER that closing `)}`, insert the slideshow overlay:

```tsx
            {ambientOn && candidates.has(it.bookmarkId) && !playing.has(it.bookmarkId) && audioActiveId !== it.bookmarkId && (
              // Ambient still-frame slideshow on in-view video cards that
              // AREN'T the single hero (playing) and aren't the sound-on Tier 3
              // card. Sits just below the hero/Tier-3 overlay (z 10) and is
              // non-interactive so it never blocks card clicks / resize. When
              // the card scrolls out of `candidates` or becomes the hero, this
              // unmounts and the resting CardNode thumbnail shows through.
              <div
                data-card-slideshow
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 9,
                  overflow: 'hidden',
                  borderRadius: 'var(--card-radius, 20px)',
                  pointerEvents: 'none',
                }}
              >
                <CardSlideshow frames={resolveSlideshowFrames(it)} />
              </div>
            )}
```

- [ ] **Step 5: Type-check, lint, and run the full suite**

Run: `npx tsc --noEmit`
Expected: no errors. (If `useMemo` is now unused in the file, remove it from the React import; if `defaultCardWidth` is now unused, that's a pre-existing prop — leave the prop, just ensure no unused-local error. Resolve any unused-symbol errors that the Step 1-2 deletions surfaced: `LIVE_AREA_BUDGET`, `MAX_LIVE`, `PER_CARD_MS`, `DENSE_CARD_W`, `liveCap` are all gone.)

Run: `npx vitest run`
Expected: all green (existing 730 + new tests from Tasks 1-4).

Run: `npx eslint components/board/CardsLayer.tsx components/board/CardSlideshow.tsx lib/board/slideshow-frames.ts lib/board/use-slideshow-cycle.ts lib/board/use-reduced-motion.ts`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/CardsLayer.tsx
rtk git commit -m "feat(board): single hero video (cap 1, ~15s) + ambient slideshow on other in-view video cards"
```

- [ ] **Step 7: Build, deploy, and verify on real hardware**

Run: `pnpm build`
Expected: static export to `out/` succeeds.

Deploy (per CLAUDE.md):

```bash
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="ambient slideshow phase1"
```

Then verify on `https://booklage.pages.dev` (hard reload), on the user's 4K screen:
- With several YouTube/video cards in view: only ONE plays real video at a time; it hands off to another after ~15s.
- The other in-view video cards gently cross-fade between stills on staggered (non-synchronized) timing.
- Photo / text cards are completely static.
- The slideshow first frame lines up with the resting thumbnail (no visible jump when it mounts/unmounts).
- MOTION switch OFF → board fully static (no hero, no crossfade).
- Opening the Lightbox → board freezes; closing → ambient resumes.
- FPS / stutter on 4K is noticeably better than the old multi-video spotlight.

---

## Self-Review

**Spec coverage:**
- Two-layer model (slideshow + single hero) → Tasks 4 + 5. ✓
- Frame sources: YouTube poster+25%+50%, no end frame → Task 1. X/Vimeo poster-only (Phase 1) → Task 1 + scope note. ✓
- Per-card staggered crossfade → Task 3. ✓
- Animate only video cards; photo/text static → Task 5 render gate (`candidates.has` = canViewportAutoplay items only). ✓
- Hero cap 1, ~15s, muted, reuse `useSpotlightRotation` → Task 5 Steps 1-2 + existing muted overlay. ✓
- MOTION OFF / Lightbox-open freeze both layers → Task 5 `ambientOn`. ✓
- prefers-reduced-motion → Task 2 + Task 5 `ambientOn`. ✓
- Graceful fallback (YouTube hq→small, missing image) → Task 1 `fallback` + Task 4 onError. ✓
- Tier 3 unchanged → Task 5 gate excludes `audioActiveId`; Tier 3 block untouched. ✓
- X real-frame extraction → explicitly Phase 2 (out of scope here). ✓

**Placeholder scan:** No TBD/TODO; every code step has full code. ✓

**Type consistency:** `SlideshowFrame` defined in Task 1, imported in Tasks 3-test/4. `resolveSlideshowFrames(item: PlayableItem)` — `it` (BoardItem) structurally satisfies `PlayableItem` (url/title/thumbnail/aspectRatio/hasVideo?/mediaSlots?), same as the existing `canViewportAutoplay(it)` call. `useSlideshowCycle(frameCount: number)`, `useReducedMotion(): boolean`, `CardSlideshow({ frames })` — names consistent across tasks. `ambientOn` defined in Task 5 Step 2, used in Step 4. Removed constants (`LIVE_AREA_BUDGET`, `MAX_LIVE`, `PER_CARD_MS`, `DENSE_CARD_W`, `liveCap`) are no longer referenced after Steps 1-2. ✓
