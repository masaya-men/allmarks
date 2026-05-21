# Board ↔ Lightbox Media-Playback Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every media type that the Lightbox can play also play inline on the board, by routing both surfaces through ONE media-player registry — so tweet video works on the board now, and future platforms (e.g. Bluesky) are covered by adding a single registry entry instead of editing scattered whitelists.

**Architecture:** Extract the last remaining in-Lightbox player (`TweetVideoPlayer`) into the shared `components/board/embeds/` module, generalized with a `variant: 'inline' | 'lightbox'` sizing prop and the existing `autoStart` convention. Introduce a single `media-players` registry (an ordered array of `{ match, playableInline, render }` entries) that is the ONE source of truth for "which player renders this item" — `canPlayInline(item)` and the board's `InlineMediaPlayer` both derive from it, and the Lightbox's non-tweet dispatch (`LightboxMedia`) is rewired to use it too. The mp4-video entry matches on "the item has a video `mediaSlot`" (platform-agnostic) so tweets — and any future platform that populates `mediaSlots` — are covered without bespoke code.

**Tech Stack:** React 18 + Next.js + TypeScript strict + CSS Modules + vitest + happy-dom + playwright. No new deps. Reuses `lib/embed/default-volume.ts`, `lib/embed/tweet-meta.ts` (`fetchTweetMeta`), `lib/utils/url.ts` detectors, the `/api/tweet-video` proxy, and `components/board/Lightbox.module.css` classes.

**Spec / design context:** [multi-playback-design](../specs/2026-05-21-multi-playback-design.md) §3/§6 (player reuse). This plan is the cleanup the user requested after Phase 1: the board must mirror the Lightbox's playable set via a single source of truth, not a hardcoded 4-platform whitelist.

---

## Dependency map (verified — read before touching code)

Existing behaviour that MUST NOT break (each verified by file:line during planning):

1. **Lightbox slot-change pause sweep** — `Lightbox.tsx:494-501`: a `useEffect` keyed on `tweetSlotIdx` does `mediaRef.current.querySelectorAll('video').forEach(v => v.pause())`. This is a generic DOM scan; it keeps working as long as the extracted tweet player still renders a real `<video>` inside the `.media` subtree. **Do not change the rendered element type away from `<video>`.**
2. **Lightbox close-animation pause** — `Lightbox.tsx:1112-1116`: clones `.frame`, then `snapshot.querySelectorAll('iframe'|'video')` and stops them. Generic DOM scan — unaffected by which component produced the `<video>`/`<iframe>`.
3. **Tweet dispatch is separate from `LightboxMedia`** — `Lightbox.tsx:1308-1315`: tweets render via `<TweetMedia>` (slot carousel + dots), NOT `LightboxMedia`. `TweetMedia` (`Lightbox.tsx:1477-1571`) builds a synthetic `TweetMeta` per slot (`:1495-1509`) and renders `<TweetVideoPlayer key={slot-${idx}} item={view} meta={slotMeta} />` for video slots. The `key` forces remount on slot change (intentional).
4. **`LightboxMedia`** — `Lightbox.tsx:1885-1975`: switch on `detectUrlType` → `YouTubeEmbed`/`TikTokEmbed`/`InstagramEmbed`/`VimeoEmbed`/`SoundCloudEmbed`, else image (`LightboxImageWithFallback`) / text (`LargeTextCardScaler`) fallback. Instagram here is a **link-out** affordance, not a player.
5. **Board tweet backfill already populates `mediaSlots[].videoUrl`** — `lib/board/tweet-backfill.ts` (called from `BoardRoot`) writes `persistMediaSlots`, so a video-tweet board card usually already has the mp4 URL without opening the Lightbox. There is a short window before backfill lands; the inline player must self-fetch in that case.
6. **`TweetVideoPlayer` reads** from `item`: `item.url` (Watch-on-X href), `item.thumbnail` (poster fallback), `item.title` (alt); from `meta`: `videoUrl` (→ `/api/tweet-video?url=`), `videoPosterUrl`, `videoAspectRatio`. Uses `useDefaultVolume()` and CSS classes `tweetVideo`, `playOverlay`, `playDisc`, `playOverlayIcon`, `tweetWatchOnX`, `tweetWatchOnXBadge` (all in `Lightbox.module.css`). Wrapper sizing uses Lightbox viewport vars (`--lightbox-media-max-h`, `--lightbox-media-radius`, `50vw`/`60vw`/`920px`) — this is the ONLY Lightbox-coupled part and is what `variant` will parameterize.
7. **`canPlayInline` current call sites** — `CardsLayer.tsx`: `onActivate={canPlayInline(it.url) ? ... : undefined}` and the overlay guard `audioActiveId === it.bookmarkId && canPlayInline(it.url)`. Both move from URL-string to item-based.
8. **URL helpers** (`lib/utils/url.ts`): `detectUrlType`, `extractYoutubeId`, `isYoutubeShorts`, `extractVimeoId`, `extractTikTokVideoId`, `extractTweetId` all exist and are exported. `UrlType = 'tweet'|'youtube'|'tiktok'|'instagram'|'vimeo'|'soundcloud'|'website'`. No Bluesky yet (design-intent only).
9. **`BoardItem`** (`lib/storage/use-board-data.ts:27`): has `url`, `title`, `thumbnail?`, `aspectRatio: number`, `hasVideo?: boolean`, `mediaSlots?: readonly MediaSlot[]`. `MediaSlot` (`lib/embed/types.ts`): `{ type: 'video'|'photo'; url: string; videoUrl?: string; aspect?: number }`.

---

## File Structure

**Create:**
- `components/board/embeds/TweetVideoEmbed.tsx` — the extracted, generalized tweet/mp4 video player (variant + autoStart + optional self-fetch of the mp4 when not yet backfilled).
- `components/board/embeds/media-players.tsx` — the registry: `canPlayInline(item)`, `resolveInlinePlayer(item, opts)`, `resolveLightboxPlayer(item)`, plus the `PlayableItem` structural type.
- `tests/components/board/media-players.test.tsx` — registry unit tests (matching + playability).
- `tests/components/board/tweet-video-embed.test.tsx` — TweetVideoEmbed source-resolution unit tests.

**Modify:**
- `components/board/Lightbox.tsx` — replace the in-file `TweetVideoPlayer` body with a thin call to the shared `TweetVideoEmbed` (lightbox variant); rewire `LightboxMedia` non-tweet path to `resolveLightboxPlayer` with the image/text fallback retained.
- `components/board/embeds/InlineMediaPlayer.tsx` — delegate `InlineMediaPlayer` to `resolveInlinePlayer`; re-export `canPlayInline` from the registry (item-based).
- `components/board/embeds/index.ts` — export the new modules.
- `components/board/CardsLayer.tsx` — `canPlayInline(it)` (item) at both call sites.
- `tests/components/board/inline-media-player.test.tsx` — update for the item-based `canPlayInline`.

---

## Task 1: Extract `TweetVideoPlayer` → shared `TweetVideoEmbed` (variant + autoStart + self-fetch)

**Files:**
- Create: `components/board/embeds/TweetVideoEmbed.tsx`
- Create: `tests/components/board/tweet-video-embed.test.tsx`
- Modify: `components/board/embeds/index.ts`
- Modify: `components/board/Lightbox.tsx` (replace `TweetVideoPlayer` body + its `TweetMedia` call site)

- [ ] **Step 1: Write the failing test for source resolution**

The only pure-logic part is "given a board item, what mp4 source do we use?". Extract that as a helper `resolveTweetVideoSource(item)` exported from the new file and test it.

Create `tests/components/board/tweet-video-embed.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { resolveTweetVideoSource } from '@/components/board/embeds/TweetVideoEmbed'

describe('resolveTweetVideoSource', () => {
  it('uses the video mediaSlot when present (no fetch needed)', () => {
    const src = resolveTweetVideoSource({
      url: 'https://x.com/u/status/1',
      title: 't',
      thumbnail: 'https://img/poster.jpg',
      mediaSlots: [{ type: 'video', url: 'https://img/slotposter.jpg', videoUrl: 'https://v/clip.mp4', aspect: 1.7 }],
    })
    expect(src).toEqual({ videoUrl: 'https://v/clip.mp4', posterUrl: 'https://img/slotposter.jpg', aspect: 1.7 })
  })

  it('falls back to the item thumbnail for the poster when the slot has no poster url', () => {
    const src = resolveTweetVideoSource({
      url: 'https://x.com/u/status/1',
      title: 't',
      thumbnail: 'https://img/poster.jpg',
      mediaSlots: [{ type: 'video', url: '', videoUrl: 'https://v/clip.mp4' }],
    })
    expect(src?.videoUrl).toBe('https://v/clip.mp4')
    expect(src?.posterUrl).toBe('https://img/poster.jpg')
  })

  it('returns null when there is no video slot (needs a meta fetch instead)', () => {
    const src = resolveTweetVideoSource({
      url: 'https://x.com/u/status/1',
      title: 't',
      thumbnail: undefined,
      mediaSlots: [{ type: 'photo', url: 'https://img/a.jpg' }],
    })
    expect(src).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/components/board/tweet-video-embed`
Expected: FAIL — module / `resolveTweetVideoSource` does not exist.

- [ ] **Step 3: Create `TweetVideoEmbed.tsx`**

Move the `TweetVideoPlayer` body verbatim from `Lightbox.tsx:1666-1833`, then generalize: explicit primitive props instead of `LightboxItem`+`TweetMeta`, a `variant` that swaps the wrapper sizing, `autoStart`, and an optional self-fetch when no mp4 is known yet.

Create `components/board/embeds/TweetVideoEmbed.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import styles from '../Lightbox.module.css'
import type { MediaSlot } from '@/lib/embed/types'
import { extractTweetId } from '@/lib/utils/url'
import { fetchTweetMeta } from '@/lib/embed/tweet-meta'
import { useDefaultVolume } from '@/lib/embed/default-volume'

export type MediaVariant = 'inline' | 'lightbox'

/** Minimal structural shape the tweet video player needs from a board/lightbox item. */
export type TweetVideoItem = {
  readonly url: string
  readonly title: string
  readonly thumbnail?: string | undefined
  readonly mediaSlots?: readonly MediaSlot[]
}

export type TweetVideoSource = {
  readonly videoUrl: string
  readonly posterUrl: string | undefined
  readonly aspect: number | undefined
}

/** Pick the playable mp4 + poster from an item's already-persisted mediaSlots.
 *  Returns null when no video slot exists yet (caller must fetch syndication
 *  meta to obtain the mp4). Pure — unit tested. */
export function resolveTweetVideoSource(item: TweetVideoItem): TweetVideoSource | null {
  const slot = item.mediaSlots?.find((s) => s.type === 'video' && s.videoUrl)
  if (!slot?.videoUrl) return null
  return { videoUrl: slot.videoUrl, posterUrl: slot.url || item.thumbnail, aspect: slot.aspect }
}

/**
 * Tweet / X video player, shared by the Lightbox (variant='lightbox') and
 * the board inline card (variant='inline'). Renders a native <video> fed by
 * the `/api/tweet-video` CORS proxy. The element type stays <video> so the
 * Lightbox's generic pause sweeps (slot-change + close-animation) keep working.
 *
 * Source resolution order: an explicitly-passed `source` (Lightbox already
 * knows it from the slot meta) → the item's persisted mediaSlots → a one-shot
 * syndication fetch (board card whose backfill hasn't landed yet).
 */
export function TweetVideoEmbed({
  item,
  source: sourceProp,
  variant,
  autoStart = false,
}: {
  readonly item: TweetVideoItem
  /** When the caller already has the mp4 (Lightbox slot meta), pass it to skip resolution. */
  readonly source?: TweetVideoSource
  readonly variant: MediaVariant
  readonly autoStart?: boolean
}): ReactNode {
  const initial = sourceProp ?? resolveTweetVideoSource(item)
  // undefined = fetch in flight, null = no playable video, value = ready.
  const [source, setSource] = useState<TweetVideoSource | null | undefined>(initial ?? undefined)
  const [videoFailed, setVideoFailed] = useState<boolean>(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [defaultVolume, setDefaultVolume] = useDefaultVolume()

  // Self-fetch the mp4 only when we couldn't resolve it from props/slots.
  useEffect(() => {
    if (initial) return
    let cancelled = false
    const id = extractTweetId(item.url)
    if (!id) { setSource(null); return }
    fetchTweetMeta(id)
      .then((meta) => {
        if (cancelled) return
        if (meta?.videoUrl) {
          setSource({ videoUrl: meta.videoUrl, posterUrl: meta.videoPosterUrl ?? item.thumbnail, aspect: meta.videoAspectRatio })
        } else {
          setSource(null)
        }
      })
      .catch(() => { if (!cancelled) setSource(null) })
    return (): void => { cancelled = true }
    // initial is derived from props that don't change for a mounted card.
  }, [item.url, item.thumbnail, initial])

  // Keep the <video> volume synced to the app-wide default (mount + cross-card).
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = defaultVolume / 100
  }, [defaultVolume, source])

  const handleVolumeChange = (): void => {
    const v = videoRef.current?.volume
    if (typeof v === 'number') setDefaultVolume(Math.round(v * 100))
  }

  // Watch-on-X fallback: no resolvable video or playback error.
  if (source === null || videoFailed) {
    return (
      <a
        className={variant === 'lightbox' ? styles.tweetWatchOnX : styles.inlineWatchOnX}
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {item.thumbnail && <img src={item.thumbnail} alt={item.title} />}
        <span className={styles.tweetWatchOnXBadge}>Watch on X →</span>
      </a>
    )
  }

  // Still resolving — show the poster so the card/lightbox isn't blank.
  if (source === undefined) {
    return item.thumbnail
      ? <img src={item.thumbnail} alt={item.title} style={variant === 'inline' ? FILL : undefined} />
      : null
  }

  const aspect = source.aspect ?? 16 / 9
  const isVertical = aspect < 1
  const lightboxWrapper: CSSProperties = isVertical
    ? { position: 'relative', aspectRatio: aspect, height: `min(var(--lightbox-media-max-h), calc(50vw / ${aspect}))`, maxHeight: 'var(--lightbox-media-max-h)', maxWidth: '50vw', background: 'black', borderRadius: 'var(--lightbox-media-radius)', overflow: 'hidden' }
    : { position: 'relative', aspectRatio: aspect, width: `min(920px, 60vw, calc(var(--lightbox-media-max-h) * ${aspect}))`, maxHeight: 'var(--lightbox-media-max-h)', maxWidth: 'min(920px, 60vw)', background: 'black', borderRadius: 'var(--lightbox-media-radius)', overflow: 'hidden' }
  // Inline (board): fill the card; the CardsLayer overlay already centers + clips.
  const inlineWrapper: CSSProperties = { position: 'absolute', inset: 0, background: 'black', overflow: 'hidden' }
  const wrapperStyle = variant === 'lightbox' ? lightboxWrapper : inlineWrapper

  const proxiedSrc = `/api/tweet-video?url=${encodeURIComponent(source.videoUrl)}`

  return (
    <div style={wrapperStyle}>
      <video
        ref={videoRef}
        className={styles.tweetVideo}
        src={proxiedSrc}
        poster={source.posterUrl}
        // Inline cards autoplay-with-sound because the indicator press is the
        // user gesture (Tier 3). Lightbox keeps click-to-play (autoStart=false)
        // so controls only appear after the first interaction.
        controls
        autoPlay={autoStart}
        playsInline
        preload="metadata"
        onError={(): void => setVideoFailed(true)}
        onVolumeChange={handleVolumeChange}
      />
    </div>
  )
}

const FILL: CSSProperties = { width: '100%', height: '100%', objectFit: 'contain', background: 'black' }
```

Notes:
- **Preserve the Lightbox UX exactly (no-breakage requirement).** The original `TweetVideoPlayer` has a LiquidGlass play-disc overlay + `hasInteracted` controls gating (no native chrome until first click). That MUST be kept for `variant === 'lightbox'`. So the component above is INCOMPLETE — before finalizing, fold the original overlay logic back in, gated on variant: for `variant === 'lightbox'` reproduce the `hasInteracted` state, `controls={hasInteracted}`, and the `<button className={styles.playOverlay}>` disc verbatim from `Lightbox.tsx:1808-1830`; for `variant === 'inline'` use `controls autoPlay={autoStart}` (no disc — the card indicator is the gesture). The `<video>` element + proxy + volume sync are shared. Verify the Lightbox tweet video looks/behaves identical in Task 1 Step 8.
- Add a `.inlineWatchOnX` rule in Task 1 Step 5.

- [ ] **Step 4: Run the source-resolution tests**

Run: `pnpm vitest run tests/components/board/tweet-video-embed`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the `.inlineWatchOnX` CSS + export from barrel**

Append to `components/board/Lightbox.module.css` (sibling of `.tweetWatchOnX`):

```css
/* Inline (board) Watch-on-X fallback — fills the card instead of the
   Lightbox viewport-capped envelope used by .tweetWatchOnX. */
.inlineWatchOnX {
  position: absolute;
  inset: 0;
  display: block;
  overflow: hidden;
  background: black;
}
.inlineWatchOnX img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
```

Add to `components/board/embeds/index.ts`:

```ts
export { TweetVideoEmbed, resolveTweetVideoSource } from './TweetVideoEmbed'
export type { TweetVideoItem, TweetVideoSource, MediaVariant } from './TweetVideoEmbed'
```

- [ ] **Step 6: Rewire the Lightbox to use the shared component**

In `Lightbox.tsx`, DELETE the entire `TweetVideoPlayer` function (`:1666-1833`). In `TweetMedia` (`:1510`), replace the video-slot render:

```tsx
// before:
return <TweetVideoPlayer key={`slot-${slotIdx}`} item={item} meta={slotMeta} />
// after:
return (
  <TweetVideoEmbed
    key={`slot-${slotIdx}`}
    item={{ url: item.url, title: item.title, thumbnail: item.thumbnail ?? undefined, mediaSlots: slots }}
    source={{ videoUrl: slot.videoUrl, posterUrl: slot.url, aspect: slot.aspect }}
    variant="lightbox"
  />
)
```

Also handle the legacy single-video fallback at `:1560-1562`:

```tsx
if (meta?.videoUrl) {
  return (
    <TweetVideoEmbed
      item={{ url: item.url, title: item.title, thumbnail: item.thumbnail ?? undefined }}
      source={{ videoUrl: meta.videoUrl, posterUrl: meta.videoPosterUrl ?? item.thumbnail ?? undefined, aspect: meta.videoAspectRatio }}
      variant="lightbox"
    />
  )
}
```

Add the import near the other embed imports in `Lightbox.tsx`:

```tsx
import { TweetVideoEmbed } from './embeds'
```

Remove any now-unused imports (e.g. if `useDefaultVolume` is no longer referenced elsewhere in Lightbox — verify; it is still used at `:1690` so KEEP it).

- [ ] **Step 7: Type-check + full suite (Lightbox must be behaviour-identical)**

Run: `pnpm tsc --noEmit && rtk pnpm vitest run`
Expected: tsc clean; all tests pass. If a Lightbox test asserted on `TweetVideoPlayer` internals it will need updating — adjust to assert on the rendered `<video>`/`src` instead.

- [ ] **Step 8: Manual Lightbox regression check (dependency #1, #2)**

Run (background) `pnpm dev`, open a known video tweet in the Lightbox, confirm: video plays, slot carousel still pauses video on slot change, close animation doesn't ghost audio. (These exercise the `querySelectorAll('video')` sweeps that must still find the `<video>`.)

- [ ] **Step 9: Commit**

```bash
rtk git add components/board/embeds/TweetVideoEmbed.tsx tests/components/board/tweet-video-embed.test.tsx components/board/embeds/index.ts components/board/Lightbox.tsx components/board/Lightbox.module.css
rtk git commit -m "refactor(board): extract TweetVideoPlayer into shared embeds/TweetVideoEmbed (media unification)"
```

---

## Task 2: The media-players registry (single source of truth)

**Files:**
- Create: `components/board/embeds/media-players.tsx`
- Create: `tests/components/board/media-players.test.tsx`
- Modify: `components/board/embeds/index.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/board/media-players.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { canPlayInline } from '@/components/board/embeds/media-players'
import type { PlayableItem } from '@/components/board/embeds/media-players'

const item = (over: Partial<PlayableItem>): PlayableItem => ({
  url: 'https://example.com', title: 't', thumbnail: undefined, aspectRatio: 1, ...over,
})

describe('canPlayInline (registry-derived)', () => {
  it('is true for the iframe platforms', () => {
    expect(canPlayInline(item({ url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' }))).toBe(true)
    expect(canPlayInline(item({ url: 'https://vimeo.com/12345' }))).toBe(true)
    expect(canPlayInline(item({ url: 'https://soundcloud.com/a/b' }))).toBe(true)
    expect(canPlayInline(item({ url: 'https://www.tiktok.com/@u/video/123' }))).toBe(true)
  })

  it('is true for a tweet that has a video mediaSlot (mp4 entry)', () => {
    expect(canPlayInline(item({
      url: 'https://x.com/u/status/1',
      mediaSlots: [{ type: 'video', url: 'p', videoUrl: 'https://v/clip.mp4' }],
    }))).toBe(true)
  })

  it('is true for a tweet flagged hasVideo even before backfill lands', () => {
    expect(canPlayInline(item({ url: 'https://x.com/u/status/1', hasVideo: true }))).toBe(true)
  })

  it('is false for a photo-only tweet, instagram, and generic webpages', () => {
    expect(canPlayInline(item({ url: 'https://x.com/u/status/1', mediaSlots: [{ type: 'photo', url: 'p' }] }))).toBe(false)
    expect(canPlayInline(item({ url: 'https://www.instagram.com/reel/abc/' }))).toBe(false)
    expect(canPlayInline(item({ url: 'https://example.com/article' }))).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/components/board/media-players`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the registry**

Create `components/board/embeds/media-players.tsx`:

```tsx
'use client'

import { type ReactNode } from 'react'
import type { MediaSlot } from '@/lib/embed/types'
import {
  detectUrlType,
  extractYoutubeId,
  isYoutubeShorts,
  extractVimeoId,
  extractTikTokVideoId,
} from '@/lib/utils/url'
import { YouTubeEmbed } from './YouTubeEmbed'
import { VimeoEmbed } from './VimeoEmbed'
import { SoundCloudEmbed } from './SoundCloudEmbed'
import { TikTokEmbed } from './TikTokEmbed'
import { TweetVideoEmbed, type MediaVariant } from './TweetVideoEmbed'

/** Structural subset of BoardItem / LightboxItem the registry needs. */
export type PlayableItem = {
  readonly url: string
  readonly title: string
  readonly thumbnail?: string | undefined
  readonly aspectRatio?: number | undefined
  readonly hasVideo?: boolean
  readonly mediaSlots?: readonly MediaSlot[]
}

type RenderOpts = { readonly variant: MediaVariant; readonly autoStart?: boolean }

/** True when the item carries a directly-playable mp4 video slot. Platform-
 *  agnostic: tweets today, and any future platform (e.g. Bluesky) that
 *  populates mediaSlots[].videoUrl, are covered by this one predicate. */
function hasVideoSlot(item: PlayableItem): boolean {
  return !!item.mediaSlots?.some((s: MediaSlot) => s.type === 'video' && !!s.videoUrl)
}

type MediaEntry = {
  /** Does this entry handle the item? */
  readonly match: (item: PlayableItem) => boolean
  /** False for link-out media (Instagram) that renders in the Lightbox but
   *  is NOT inline-playable on the board. */
  readonly playableInline: boolean
  readonly render: (item: PlayableItem, opts: RenderOpts) => ReactNode | null
}

/** THE source of truth. Order matters: first match wins. Add a platform here
 *  and both the board (`canPlayInline` / `resolveInlinePlayer`) and the
 *  Lightbox (`resolveLightboxPlayer`) pick it up. */
const ENTRIES: readonly MediaEntry[] = [
  {
    match: (i) => detectUrlType(i.url) === 'youtube' && !!extractYoutubeId(i.url),
    playableInline: true,
    render: (i, o) => {
      const id = extractYoutubeId(i.url)
      return id ? <YouTubeEmbed videoId={id} title={i.title} vertical={isYoutubeShorts(i.url)} thumbnail={i.thumbnail} aspectRatio={i.aspectRatio} autoStart={o.variant === 'inline' && o.autoStart} /> : null
    },
  },
  {
    match: (i) => detectUrlType(i.url) === 'vimeo' && !!extractVimeoId(i.url),
    playableInline: true,
    render: (i, o) => {
      const id = extractVimeoId(i.url)
      return id ? <VimeoEmbed videoId={id} title={i.title} thumbnail={i.thumbnail} aspectRatio={i.aspectRatio} autoStart={o.variant === 'inline' && o.autoStart} /> : null
    },
  },
  {
    match: (i) => detectUrlType(i.url) === 'tiktok' && !!extractTikTokVideoId(i.url),
    playableInline: true,
    render: (i, o) => {
      const id = extractTikTokVideoId(i.url)
      return id ? <TikTokEmbed videoId={id} url={i.url} title={i.title} thumbnail={i.thumbnail} aspectRatio={i.aspectRatio} autoStart={o.variant === 'inline' && o.autoStart} /> : null
    },
  },
  {
    match: (i) => detectUrlType(i.url) === 'soundcloud',
    playableInline: true,
    render: (i, o) => <SoundCloudEmbed url={i.url} title={i.title} thumbnail={i.thumbnail} aspectRatio={i.aspectRatio} autoStart={o.variant === 'inline' && o.autoStart} />,
  },
  {
    // mp4 video slot — tweets now, future mediaSlots platforms automatically.
    match: (i) => hasVideoSlot(i) || (detectUrlType(i.url) === 'tweet' && i.hasVideo === true),
    playableInline: true,
    render: (i, o) => <TweetVideoEmbed item={i} variant={o.variant} autoStart={o.variant === 'inline' && o.autoStart} />,
  },
]

/** True when the board can mount an inline player for this item. */
export function canPlayInline(item: PlayableItem): boolean {
  return ENTRIES.some((e) => e.playableInline && e.match(item))
}

/** Board inline player (autoplay-with-sound). Null when not inline-playable. */
export function resolveInlinePlayer(item: PlayableItem, autoStart: boolean): ReactNode | null {
  const entry = ENTRIES.find((e) => e.playableInline && e.match(item))
  return entry ? entry.render(item, { variant: 'inline', autoStart }) : null
}

/** Lightbox media component (no autostart). Null when no registry entry
 *  matches → caller falls back to image/text. Includes link-out entries. */
export function resolveLightboxPlayer(item: PlayableItem): ReactNode | null {
  const entry = ENTRIES.find((e) => e.match(item))
  return entry ? entry.render(item, { variant: 'lightbox' }) : null
}
```

Note: Instagram is intentionally NOT in `ENTRIES` here because in the Lightbox it is a link-out (`InstagramEmbed`) handled by `LightboxMedia`'s existing branch, and it is not inline-playable. Task 4 keeps Instagram in `LightboxMedia` (it returns null from the registry → existing instagram branch runs). This keeps `canPlayInline` correct (instagram false) without a `playableInline:false` placeholder entry. If a later phase makes Instagram inline-playable, add it here.

- [ ] **Step 4: Export from barrel + run tests**

Add to `components/board/embeds/index.ts`:

```ts
export { canPlayInline, resolveInlinePlayer, resolveLightboxPlayer } from './media-players'
export type { PlayableItem } from './media-players'
```

Run: `pnpm vitest run tests/components/board/media-players`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/embeds/media-players.tsx tests/components/board/media-players.test.tsx components/board/embeds/index.ts
rtk git commit -m "feat(board): media-players registry as single source of truth for inline playability"
```

---

## Task 3: Rewire the board (`InlineMediaPlayer` + `CardsLayer`) onto the registry

**Files:**
- Modify: `components/board/embeds/InlineMediaPlayer.tsx`
- Modify: `components/board/embeds/index.ts`
- Modify: `components/board/CardsLayer.tsx`
- Modify: `tests/components/board/inline-media-player.test.tsx`

- [ ] **Step 1: Update the dispatcher test for the item-based API**

Replace `tests/components/board/inline-media-player.test.tsx` so it imports `canPlayInline` from the dispatcher and exercises the item-based signature (the dispatcher re-exports the registry's `canPlayInline`):

```tsx
import { describe, it, expect } from 'vitest'
import { canPlayInline } from '@/components/board/embeds/InlineMediaPlayer'

const item = (url: string, over: object = {}) => ({ url, title: 't', thumbnail: undefined, aspectRatio: 1, ...over })

describe('canPlayInline (via InlineMediaPlayer re-export)', () => {
  it('returns true for youtube / vimeo / soundcloud / tiktok', () => {
    expect(canPlayInline(item('https://www.youtube.com/watch?v=aaaaaaaaaaa'))).toBe(true)
    expect(canPlayInline(item('https://vimeo.com/12345'))).toBe(true)
    expect(canPlayInline(item('https://soundcloud.com/a/b'))).toBe(true)
    expect(canPlayInline(item('https://www.tiktok.com/@u/video/123'))).toBe(true)
  })
  it('returns true for a video tweet, false for photo tweet / instagram / generic', () => {
    expect(canPlayInline(item('https://x.com/u/status/1', { hasVideo: true }))).toBe(true)
    expect(canPlayInline(item('https://x.com/u/status/1', { mediaSlots: [{ type: 'photo', url: 'p' }] }))).toBe(false)
    expect(canPlayInline(item('https://www.instagram.com/reel/abc/'))).toBe(false)
    expect(canPlayInline(item('https://example.com/article'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/components/board/inline-media-player`
Expected: FAIL — `canPlayInline` still takes a `url: string` and rejects an object / lacks the tweet branch.

- [ ] **Step 3: Rewrite `InlineMediaPlayer.tsx` to delegate to the registry**

Replace `components/board/embeds/InlineMediaPlayer.tsx` in full:

```tsx
'use client'

import { type ReactNode } from 'react'
import type { BoardItem } from '@/lib/storage/use-board-data'
import { resolveInlinePlayer, canPlayInline } from './media-players'

// Re-export so existing call sites (CardsLayer) keep importing from here.
export { canPlayInline }

/**
 * Mounts the correct inline player for a board card via the media-players
 * registry. Phase 1 Tier 3: the indicator press is the user gesture, so
 * autoStart=true makes the player begin with audio. Returns null for
 * non-playable items so callers can `canPlayInline`-guard.
 */
export function InlineMediaPlayer({
  item,
}: {
  readonly item: BoardItem
}): ReactNode {
  return resolveInlinePlayer(item, true)
}
```

Note: `aspectRatio` no longer needs threading — the registry reads `item.aspectRatio` directly. The board overlay (CardsLayer) already sizes/centers the player.

- [ ] **Step 4: Update `CardsLayer.tsx` call sites to item-based**

In `components/board/CardsLayer.tsx`:
- The `InlineMediaPlayer` usage drops the `aspectRatio` prop:

```tsx
<InlineMediaPlayer item={it} />
```

- Both `canPlayInline(it.url)` become `canPlayInline(it)` (the overlay guard and the indicator `onActivate`):

```tsx
{audioActiveId === it.bookmarkId && canPlayInline(it) && (
  ...
)}
...
onActivate={canPlayInline(it) ? (): void => onToggleAudio(it.bookmarkId) : undefined}
```

- [ ] **Step 5: Type-check + run dispatcher + media-players tests**

Run: `pnpm tsc --noEmit && pnpm vitest run tests/components/board/inline-media-player tests/components/board/media-players`
Expected: tsc clean; all pass.

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/embeds/InlineMediaPlayer.tsx components/board/embeds/index.ts components/board/CardsLayer.tsx tests/components/board/inline-media-player.test.tsx
rtk git commit -m "feat(board): route inline card playback through the media-players registry (tweet video now plays inline)"
```

---

## Task 4: Rewire `LightboxMedia` non-tweet path onto the registry (DRY the second dispatch)

**Files:**
- Modify: `components/board/Lightbox.tsx` (`LightboxMedia` only)

- [ ] **Step 1: Replace the platform switch with `resolveLightboxPlayer`**

In `Lightbox.tsx` `LightboxMedia` (`:1885-1975`), replace the five `if (urlType === ...)` embed branches with one registry call, KEEPING the image/text fallback exactly as-is:

```tsx
function LightboxMedia({ item }: { readonly item: LightboxItem }): ReactNode {
  const thumb = item.thumbnail ?? undefined
  const aspectRatio = item.aspectRatio

  // Registry handles youtube / tiktok / vimeo / soundcloud (and, for items
  // that carry a video mediaSlot, the mp4 player). Tweets never reach here —
  // they render via <TweetMedia> upstream. Instagram returns null below and
  // falls through to its link-out branch.
  const player = resolveLightboxPlayer({
    url: item.url,
    title: item.title,
    thumbnail: thumb,
    aspectRatio,
    mediaSlots: undefined,
  })
  if (player) return player

  // Instagram link-out (not a registry entry — see media-players note).
  if (detectUrlType(item.url) === 'instagram') {
    const shortcode = extractInstagramShortcode(item.url)
    if (shortcode) return <InstagramEmbed shortcode={shortcode} thumbnail={thumb} title={item.title} aspectRatio={aspectRatio} />
  }

  // 一般 webpage: thumbnail → image (fallback text), else text. (unchanged)
  const textAspect = aspectRatio ?? TEXT_CARD_ASPECT
  const fakeBoardItem: BoardItem = {
    ...toBoardShapeForFallback(item, textAspect),
    title: cleanTitle(item.title, item.url),
  }
  if (item.thumbnail) {
    return <LightboxImageWithFallback item={item} aspectRatio={aspectRatio} fakeBoardItem={fakeBoardItem} textAspect={textAspect} />
  }
  return <LargeTextCardScaler fakeItem={fakeBoardItem} aspect={textAspect} />
}
```

Add the registry import to `Lightbox.tsx`:

```tsx
import { resolveLightboxPlayer } from './embeds'
```

Verify the YouTube/TikTok/Vimeo/SoundCloud embed imports are still used elsewhere in Lightbox; if `LightboxMedia` was their only caller, remove the now-unused named imports (the registry imports them internally). Keep `InstagramEmbed`, `extractInstagramShortcode` (still used above). Run tsc to surface unused imports.

- [ ] **Step 2: Type-check + full suite**

Run: `pnpm tsc --noEmit && rtk pnpm vitest run`
Expected: tsc clean; all pass. The registry passes `mediaSlots: undefined` for Lightbox non-tweet items so the mp4 entry never matches here (youtube/vimeo/etc have no slots) — output is identical to the old switch.

- [ ] **Step 3: Manual Lightbox regression — every non-tweet type**

With `pnpm dev`, open one card of each type in the Lightbox and confirm identical behaviour: YouTube (poster→play), Vimeo, TikTok, SoundCloud, Instagram (link-out badge), a generic webpage with thumbnail (image), a text-only webpage (text card). Confirm the open/close FLIP animation still looks the same.

- [ ] **Step 4: Commit**

```bash
rtk git add components/board/Lightbox.tsx
rtk git commit -m "refactor(lightbox): drive LightboxMedia non-tweet dispatch from the shared registry (DRY)"
```

---

## Task 5: Build + Playwright verification + deploy

**Files:** (verification only)

- [ ] **Step 1: Production build**

Run: `pnpm build`
Expected: success, `out/` regenerated.

- [ ] **Step 2: Playwright — board tweet video plays + resize intact + indicator icon**

Reuse the Phase 1 harness pattern. Because `/seed-demos` only seeds YouTube/TikTok/Instagram, ALSO seed a video tweet for this run: add one X video URL to the script by inserting it through the app the same way (or extend `components/dev/SeedDemos.tsx` DEMOS with one X video URL for the test, then revert). Simplest: append to the DEMOS array a known public video tweet, run the verify, then `git checkout components/dev/SeedDemos.tsx`.

Write `C:/Users/masay/AppData/Local/Temp/verify-media-unification.mjs` (adapt from `verify-multiplayback-p1.mjs`): seed → board → find the tweet card → hover → assert the indicator is a `<button>` with the video icon → click → assert `data-active=true` AND a `<video>` element mounts (`page.locator('video').count() >= 1`) → click off → assert `data-active=false` → **BR resize drag still changes width** (spec §4 must-pass).

Run: `node C:/Users/masay/AppData/Local/Temp/verify-media-unification.mjs`
Expected: `data-active after click = true`, `video mounted >= 1`, `BR resize worked: true`.

- [ ] **Step 3: Manual confirm — board + Lightbox parity**

Message the user (Japanese): 本番前確認です。booklage 本番反映前に、(1) ボードで X 動画カードの右下アイコンを押すと音つきで再生、(2) もう一度で停止、(3) 右下リサイズが効く、(4) Lightbox で X 動画/YouTube/Vimeo/TikTok/SoundCloud が今まで通り再生できる、を確認してください。

- [ ] **Step 4: Deploy after user confirms**

```bash
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="media-playback-unification"
```

Then tell the user to hard-reload `booklage.pages.dev`.

---

## Self-Review notes

- **User intent coverage:** "board uses the same structure as Lightbox, not bespoke playback" → Tasks 1+4 make both surfaces share `embeds/` players incl. tweet video. "single source of truth / future-proof" → Task 2 registry; adding a platform = one `ENTRIES` row (mp4 platforms like Bluesky need zero new player code once they populate `mediaSlots` + have a CDN proxy). "tweet video plays on board" → Tasks 1+3. "don't break existing features" → dependency map up front; Lightbox `<video>` pause sweeps preserved (element stays `<video>`); full-suite + manual regression after every Lightbox-touching task (1, 4).
- **Honest caveat retained in design:** each new mp4 platform still needs its own CDN proxy (tweet uses `/api/tweet-video`); the registry localizes that to one entry. iframe platforms need a new embed component. Stated to the user; not over-promised.
- **Deferred-to-execution confirmations:** exact line numbers in `Lightbox.tsx` shift as edits land — re-grep `function TweetVideoPlayer`, `function LightboxMedia`, and the `TweetMedia` video-slot return before each edit. Confirm `useDefaultVolume` is still used in Lightbox after removing `TweetVideoPlayer` (it is, at the SoundCloud/other path) before deleting its import.
- **No-breakage (Task 1 Step 3):** the Lightbox tweet video's LiquidGlass play-disc + `hasInteracted` controls gating is PRESERVED by gating it on `variant === 'lightbox'` inside `TweetVideoEmbed` (see the Task 1 Step 3 note). Only the inline (board) variant uses autoplay + immediate controls. Lightbox behaviour is unchanged.
- **YAGNI:** no plugin system, no dynamic registration — just a typed `ENTRIES` array. Instagram stays a Lightbox-only link-out (not added to the registry) until/unless it becomes inline-playable.
```
