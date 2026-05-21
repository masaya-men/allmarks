# Inline Playback Controls (per-card volume + play/pause bar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a playing board card an AllMarks-styled control bar attached just below it (volume + play/pause) so small cards are easy to operate, with per-card ephemeral volume (the basis of the multi-card "mix"), and make the bottom-right corner indicator show a clear ■ stop icon while playing.

**Architecture:** Board owns the single active card's ephemeral playback state (`volume` 0–100 seeded from the global default, `paused`), reset whenever the active card changes and never persisted. A new `PlaybackControlBar` renders inside the active card wrapper anchored below it; it drives that state. The state flows down to the inline player as controlled `volume` / `paused` props; each embed applies them in inline mode (native `<video>` directly, YouTube/Vimeo via postMessage, SoundCloud via the Widget API) WITHOUT touching the global default — the Lightbox path is untouched (variant-gated). The corner `MediaTypeIndicator` swaps its glyph to a stop square when `active`.

**Tech Stack:** React 18 + Next.js + TypeScript strict + CSS Modules + vitest + happy-dom + playwright. No new deps. Builds on the `embeds/` registry + `TweetVideoEmbed` from the media-unification work.

**Spec context:** Follow-up to [board-media-playback-unification](./2026-05-21-board-media-playback-unification.md). User decisions (session 62 chat): control bar attached BELOW the card (option a); volume is PER-CARD and EPHEMERAL (in-memory only, resets to global default on reload — not persisted, for data-size + memorability reasons); play/pause = pause-in-place (keeps position); corner icon = full ON/OFF and should read as ■ stop while playing; bar = ⏸ pause/resume; scope is volume + play/pause only (no seek).

---

## Dependency map (verified — read before touching code)

1. **Per-embed control surfaces** (`components/board/embeds/`):
   - `TweetVideoEmbed.tsx:77,105` native `<video>` via `videoRef`: `.volume = v/100`, `.play()`, `.pause()`. Currently syncs to `useDefaultVolume()`.
   - `TikTokEmbed.tsx:63-68` Tier-1 native video via `tier1VideoRef`: `.volume`. Tier-2 iframe = NO external control (accepted limitation).
   - `YouTubeEmbed.tsx:48-53` iframe `iframeRef`, `enablejsapi=1`: postMessage `{event:'command',func:'setVolume',args:[0-100]}` / `func:'playVideo'` / `func:'pauseVideo'` to `https://www.youtube.com`.
   - `VimeoEmbed.tsx:36-42` iframe: postMessage `{method:'setVolume',value:0-1}` / `{method:'play'}` / `{method:'pause'}` to `https://player.vimeo.com`.
   - `SoundCloudEmbed.tsx:35,101-103` Widget API `widgetRef.current`: `.setVolume(0-100)`, `.play()`, `.pause()`. Already has a custom volume slider overlay.
2. **Global default volume** (`lib/embed/default-volume.ts`): `useDefaultVolume()` (localStorage-backed, cross-card synced) + `getDefaultVolume()`. Used by ALL embeds in BOTH Lightbox and inline today. The Lightbox MUST keep using it (do not change Lightbox behaviour). Inline switches to per-card controlled volume seeded from `getDefaultVolume()`.
3. **Board active-card state** (`components/board/BoardRoot.tsx`): `audioActiveId: string|null` + `handleToggleAudio` (added in Phase 1). `CardsLayer` receives `audioActiveId` + `onToggleAudio`.
4. **Card wrapper** (`components/board/CardsLayer.tsx` ~437-526): absolutely-positioned `[data-bookmark-id]` div (width `p.w`, height `p.h`) containing CardNode, the inline player overlay (when `audioActiveId===it.bookmarkId && canPlayInline(it)`), `MediaTypeIndicator`, `CardCornerActions`, `ResizeHandle`. `onPointerDown` on the wrapper starts reorder/lightbox — controls must `stopPropagation`.
5. **Inline player entry** (`components/board/embeds/InlineMediaPlayer.tsx`): `InlineMediaPlayer({item})` → `resolveInlinePlayer(item, true)`. The registry (`media-players.tsx`) renders each embed with `autoStart`. To thread volume/paused, `resolveInlinePlayer` gains an options object and each entry's `render` forwards `volume`/`paused` to the embed.
6. **MediaTypeIndicator** (`components/board/MediaTypeIndicator.tsx`): `type: 'video'|'photo'|'audio'`, `active` (audio-on), interactive when `onActivate` given. Icons: `VideoIcon`, `MusicIcon`, `PhotoIcon`. Need a `StopIcon` shown when `active`.

---

## File Structure

**Create:**
- `components/board/PlaybackControlBar.tsx` — the AllMarks-styled bar (volume slider + play/pause button); fully controlled via props.
- `components/board/PlaybackControlBar.module.css` — mixer-tone styling.
- `tests/components/board/playback-control-bar.test.tsx` — render + callback tests.

**Modify:**
- `components/board/MediaTypeIndicator.tsx` + `.module.css` — `StopIcon` when `active`.
- `components/board/MediaTypeIndicator.test.tsx` — assert stop glyph when active.
- `components/board/embeds/media-players.tsx` — `resolveInlinePlayer(item, opts)` forwards `volume`/`paused`.
- `components/board/embeds/InlineMediaPlayer.tsx` — accept + forward `volume`/`paused`.
- `components/board/embeds/TweetVideoEmbed.tsx`, `TikTokEmbed.tsx`, `YouTubeEmbed.tsx`, `VimeoEmbed.tsx`, `SoundCloudEmbed.tsx` — optional controlled `volume`/`paused` (inline only).
- `components/board/BoardRoot.tsx` — per-active-card `audioVolume`/`audioPaused` state + reset on active change; pass to `CardsLayer`.
- `components/board/CardsLayer.tsx` — thread the state; render `PlaybackControlBar` below the active card; pass `volume`/`paused` into `InlineMediaPlayer`.

---

## Task 1: Corner indicator shows a ■ stop glyph while active

**Files:**
- Modify: `components/board/MediaTypeIndicator.tsx`
- Modify: `components/board/MediaTypeIndicator.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `components/board/MediaTypeIndicator.test.tsx`:

```tsx
  it('renders a stop glyph (not the media-type glyph) when active', () => {
    const { container } = render(
      <MediaTypeIndicator type="video" visible={true} onActivate={() => {}} active={true} />,
    )
    const btn = container.querySelector('[data-testid="media-indicator"]') as HTMLElement
    expect(btn.getAttribute('data-icon')).toBe('stop')
  })

  it('renders the media-type glyph when not active', () => {
    const { container } = render(
      <MediaTypeIndicator type="video" visible={true} onActivate={() => {}} active={false} />,
    )
    const btn = container.querySelector('[data-testid="media-indicator"]') as HTMLElement
    expect(btn.getAttribute('data-icon')).toBe('video')
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run components/board/MediaTypeIndicator`
Expected: FAIL — no `data-icon` attribute exists.

- [ ] **Step 3: Add the StopIcon + data-icon, swap glyph when active**

In `MediaTypeIndicator.tsx`, change the icon selection + add `data-icon` to the button, and add `StopIcon`. Replace the icon computation:

```tsx
  const interactive = typeof onActivate === 'function'
  // While active (playing) the control reads as "press to stop" → ■ glyph.
  // Idle, it keeps the media-type glyph so the card still signals video vs audio.
  const iconKind = active ? 'stop' : type === 'video' ? 'video' : type === 'audio' ? 'audio' : 'photo'
  const icon =
    iconKind === 'stop' ? <StopIcon />
      : iconKind === 'video' ? <VideoIcon />
      : iconKind === 'audio' ? <MusicIcon />
      : <PhotoIcon />
```

Add `data-icon={iconKind}` to BOTH the `<div>` (non-interactive) and `<button>` (interactive) renders, next to `data-testid`. Add the component:

```tsx
/** Stop square — shown while a card is actively playing so the corner control
 *  reads as "press to stop" rather than just glowing. */
function StopIcon(): ReactElement {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run components/board/MediaTypeIndicator`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
rtk git add components/board/MediaTypeIndicator.tsx components/board/MediaTypeIndicator.test.tsx
rtk git commit -m "feat(board): corner indicator shows a stop glyph while a card is playing"
```

---

## Task 2: `PlaybackControlBar` component (volume slider + play/pause)

**Files:**
- Create: `components/board/PlaybackControlBar.tsx`
- Create: `components/board/PlaybackControlBar.module.css`
- Create: `tests/components/board/playback-control-bar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/board/playback-control-bar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { PlaybackControlBar } from '@/components/board/PlaybackControlBar'

describe('PlaybackControlBar', () => {
  it('reflects paused state on the play/pause button', () => {
    const { container, rerender } = render(
      <PlaybackControlBar volume={50} paused={false} onVolumeChange={() => {}} onTogglePause={() => {}} />,
    )
    const btn = container.querySelector('[data-testid="pc-playpause"]') as HTMLElement
    expect(btn.getAttribute('aria-label')).toBe('Pause')
    rerender(<PlaybackControlBar volume={50} paused={true} onVolumeChange={() => {}} onTogglePause={() => {}} />)
    expect(btn.getAttribute('aria-label')).toBe('Play')
  })

  it('fires onTogglePause when the button is clicked', () => {
    const onTogglePause = vi.fn()
    const { container } = render(
      <PlaybackControlBar volume={50} paused={false} onVolumeChange={() => {}} onTogglePause={onTogglePause} />,
    )
    fireEvent.click(container.querySelector('[data-testid="pc-playpause"]') as HTMLElement)
    expect(onTogglePause).toHaveBeenCalledTimes(1)
  })

  it('fires onVolumeChange with the new value when the slider moves', () => {
    const onVolumeChange = vi.fn()
    const { container } = render(
      <PlaybackControlBar volume={50} paused={false} onVolumeChange={onVolumeChange} onTogglePause={() => {}} />,
    )
    const slider = container.querySelector('[data-testid="pc-volume"]') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '20' } })
    expect(onVolumeChange).toHaveBeenCalledWith(20)
  })

  it('stops pointerdown propagation so the card drag never engages', () => {
    const { container } = render(
      <PlaybackControlBar volume={50} paused={false} onVolumeChange={() => {}} onTogglePause={() => {}} />,
    )
    const root = container.querySelector('[data-testid="pc-bar"]') as HTMLElement
    const ev = new MouseEvent('pointerdown', { bubbles: true, cancelable: true })
    const stop = vi.spyOn(ev, 'stopPropagation')
    root.dispatchEvent(ev)
    expect(stop).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/components/board/playback-control-bar`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the component**

Create `components/board/PlaybackControlBar.tsx`:

```tsx
'use client'

import { type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import styles from './PlaybackControlBar.module.css'

type Props = {
  /** 0–100. Per-card ephemeral volume. */
  readonly volume: number
  readonly paused: boolean
  readonly onVolumeChange: (next: number) => void
  readonly onTogglePause: () => void
}

/**
 * AllMarks audio-mixer styled control bar for the single active inline card.
 * Anchored just below the card (see CardsLayer). Fixed comfortable size so it
 * stays operable even when the card itself is small. Volume is per-card and
 * ephemeral (see BoardRoot). stopPropagation on pointer/click keeps the card's
 * reorder-drag / open-lightbox gesture from firing.
 */
export function PlaybackControlBar({ volume, paused, onVolumeChange, onTogglePause }: Props): ReactElement {
  const swallow = (e: ReactPointerEvent<HTMLDivElement>): void => { e.stopPropagation() }
  return (
    <div
      className={styles.bar}
      data-testid="pc-bar"
      onPointerDown={swallow}
      onMouseDown={swallow}
      onClick={(e): void => e.stopPropagation()}
    >
      <button
        type="button"
        className={styles.playPause}
        data-testid="pc-playpause"
        aria-label={paused ? 'Play' : 'Pause'}
        onClick={onTogglePause}
      >
        {paused ? (
          <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true"><path d="M7 5v14l11-7z" fill="currentColor" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>
        )}
      </button>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={volume}
        className={styles.volume}
        data-testid="pc-volume"
        style={{ ['--fill' as string]: `${volume}%` } as React.CSSProperties}
        onChange={(e): void => onVolumeChange(Number.parseInt(e.target.value, 10))}
        aria-label="Volume"
      />
    </div>
  )
}
```

- [ ] **Step 4: Implement the CSS (AllMarks mixer tone)**

Create `components/board/PlaybackControlBar.module.css`:

```css
/* Mixer-tone control strip: dark glass slab + metallic slider, matching the
   TUNE drawer / ScrollMeter audio-equipment aesthetic. Fixed size so a small
   card is still easy to operate. */
.bar {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding: 0 10px;
  border-radius: 9px;
  background: rgba(18, 18, 20, 0.86);
  -webkit-backdrop-filter: blur(10px) saturate(1.1);
  backdrop-filter: blur(10px) saturate(1.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  pointer-events: auto;
}

.playPause {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(74, 222, 128, 0.98);
  cursor: pointer;
}
.playPause:hover { background: rgba(255, 255, 255, 0.08); }
.icon { width: 16px; height: 16px; }

/* Metallic range, mirroring the SoundCloud volume slider treatment. */
.volume {
  -webkit-appearance: none;
  appearance: none;
  width: 92px;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    rgba(74, 222, 128, 0.85) 0%,
    rgba(74, 222, 128, 0.85) var(--fill, 50%),
    rgba(255, 255, 255, 0.18) var(--fill, 50%),
    rgba(255, 255, 255, 0.18) 100%
  );
  cursor: pointer;
}
.volume::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: linear-gradient(180deg, #f4f4f5, #c8c8cc);
  border: 1px solid rgba(0, 0, 0, 0.3);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
.volume::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #e8e8ea;
  border: 1px solid rgba(0, 0, 0, 0.3);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run tests/components/board/playback-control-bar`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/PlaybackControlBar.tsx components/board/PlaybackControlBar.module.css tests/components/board/playback-control-bar.test.tsx
rtk git commit -m "feat(board): PlaybackControlBar (per-card volume + play/pause, mixer tone)"
```

---

## Task 3: Controlled `volume`/`paused` on the inline embeds

**Files:**
- Modify: `components/board/embeds/TweetVideoEmbed.tsx`, `TikTokEmbed.tsx`, `YouTubeEmbed.tsx`, `VimeoEmbed.tsx`, `SoundCloudEmbed.tsx`
- Modify: `components/board/embeds/media-players.tsx`, `InlineMediaPlayer.tsx`

The shared rule for every embed: add optional `volume?: number` (0–100) and `paused?: boolean`. When `volume` is a number, the embed is in CONTROLLED mode — apply it and do NOT write back to the global default. When `paused` is a boolean, apply play/pause. When both are undefined (Lightbox), behaviour is unchanged.

- [ ] **Step 1: Thread the props through the registry + dispatcher**

In `components/board/embeds/media-players.tsx`, change `resolveInlinePlayer`'s signature and forward to each render:

```tsx
type InlineOpts = { readonly autoStart: boolean; readonly volume?: number; readonly paused?: boolean }

export function resolveInlinePlayer(item: PlayableItem, opts: InlineOpts): ReactNode | null {
  const entry = ENTRIES.find((e) => e.playableInline && e.match(item))
  return entry ? entry.render(item, { variant: 'inline', autoStart: opts.autoStart, volume: opts.volume, paused: opts.paused }) : null
}
```

Extend `RenderOpts` and pass `volume`/`paused` into each embed in the four playable entries + the mp4 entry. For example the YouTube entry render becomes:

```tsx
render: (i, o) => {
  const id = extractYoutubeId(i.url)
  return id ? (
    <YouTubeEmbed videoId={id} title={i.title} vertical={isYoutubeShorts(i.url)} thumbnail={i.thumbnail} aspectRatio={i.aspectRatio} autoStart={o.variant === 'inline' && o.autoStart === true} volume={o.volume} paused={o.paused} />
  ) : null
},
```

Add `volume`/`paused` to `RenderOpts`:

```tsx
type RenderOpts = { readonly variant: MediaVariant; readonly autoStart?: boolean; readonly volume?: number; readonly paused?: boolean }
```

Do the same forwarding for vimeo / tiktok / soundcloud / mp4(TweetVideoEmbed) entries. `resolveLightboxPlayer` passes neither (stays `{ variant: 'lightbox' }`).

In `components/board/embeds/InlineMediaPlayer.tsx`:

```tsx
export function InlineMediaPlayer({
  item,
  volume,
  paused,
}: {
  readonly item: BoardItem
  readonly volume?: number
  readonly paused?: boolean
}): ReactNode {
  return resolveInlinePlayer(item, { autoStart: true, volume, paused })
}
```

- [ ] **Step 2: Native video embeds — TweetVideoEmbed + TikTokEmbed**

In `TweetVideoEmbed.tsx`, add `volume?: number` + `paused?: boolean` to props. Replace the `useDefaultVolume` volume-sync effect with controlled-aware logic:

```tsx
// Controlled (inline) volume wins; otherwise fall back to the global default
// (Lightbox). Inline never writes back to the global default — per-card volume
// is ephemeral and isolated.
const controlled = typeof volume === 'number'
useEffect(() => {
  if (videoRef.current && controlled) videoRef.current.volume = (volume as number) / 100
}, [volume, controlled, source])
useEffect(() => {
  if (videoRef.current && !controlled) videoRef.current.volume = defaultVolume / 100
}, [defaultVolume, controlled, source])
// Apply controlled play/pause.
useEffect(() => {
  const el = videoRef.current
  if (!el || typeof paused !== 'boolean') return
  if (paused) el.pause()
  else void el.play().catch(() => { /* autoplay race; ignore */ })
}, [paused, source])
```

Keep `onVolumeChange={handleVolumeChange}` ONLY when not controlled (so Lightbox still updates the global default, inline does not):

```tsx
onVolumeChange={controlled ? undefined : handleVolumeChange}
```

Apply the identical pattern to `TikTokEmbed.tsx` Tier-1 (`tier1VideoRef`). Tier-2 iframe has no control surface — `volume`/`paused` are silently ignored there (documented limitation; the bar still renders but does nothing for the rare TikTok-iframe fallback).

- [ ] **Step 3: iframe embeds — YouTube + Vimeo**

In `YouTubeEmbed.tsx`, add `volume?: number` + `paused?: boolean`. Add a postMessage helper + effects that fire after the iframe has mounted (`hasInteracted`):

```tsx
const post = (msg: object): void => {
  iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), 'https://www.youtube.com')
}
useEffect(() => {
  if (hasInteracted && typeof volume === 'number') post({ event: 'command', func: 'setVolume', args: [volume] })
}, [volume, hasInteracted])
useEffect(() => {
  if (!hasInteracted || typeof paused !== 'boolean') return
  post({ event: 'command', func: paused ? 'pauseVideo' : 'playVideo' })
}, [paused, hasInteracted])
```

In `VimeoEmbed.tsx` (origin `https://player.vimeo.com`):

```tsx
const post = (msg: object): void => {
  iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), 'https://player.vimeo.com')
}
useEffect(() => {
  if (hasInteracted && typeof volume === 'number') post({ method: 'setVolume', value: volume / 100 })
}, [volume, hasInteracted])
useEffect(() => {
  if (!hasInteracted || typeof paused !== 'boolean') return
  post({ method: paused ? 'pause' : 'play' })
}, [paused, hasInteracted])
```

(Leave the existing `getDefaultVolume()` fire-on-load as the seed; the controlled effect overrides it once the bar moves. For inline the seed equals the per-card initial volume because BoardRoot seeds from the same default — Step Task 4.)

- [ ] **Step 4: SoundCloud embed**

In `SoundCloudEmbed.tsx`, add `volume?: number` + `paused?: boolean`. The widget is captured in `widgetRef`. Add effects:

```tsx
const controlled = typeof volume === 'number'
useEffect(() => {
  if (controlled) widgetRef.current?.setVolume(volume as number)
}, [volume, controlled])
useEffect(() => {
  if (typeof paused !== 'boolean') return
  if (paused) widgetRef.current?.pause()
  else widgetRef.current?.play()
}, [paused])
```

When `controlled`, suppress the embed's own overlay slider (the bar replaces it) — render the existing `.volumeControl` block only when `!controlled`. The widget READY handler keeps seeding `getDefaultVolume()`; the controlled effect overrides once the bar moves.

- [ ] **Step 5: Type-check + full suite**

Run: `pnpm tsc --noEmit && rtk pnpm vitest run`
Expected: tsc clean; all tests pass (no behaviour change for Lightbox — it passes neither prop, so `controlled` is false everywhere there).

- [ ] **Step 6: Commit**

```bash
rtk git add components/board/embeds
rtk git commit -m "feat(board): controlled per-card volume + play/pause on inline embeds (Lightbox untouched)"
```

---

## Task 4: Wire per-card state in BoardRoot + render the bar in CardsLayer

**Files:**
- Modify: `components/board/BoardRoot.tsx`
- Modify: `components/board/CardsLayer.tsx`

- [ ] **Step 1: Per-active-card playback state in BoardRoot**

In `BoardRoot.tsx`, near `audioActiveId` (added in Phase 1), add ephemeral volume/paused that reset whenever the active card changes:

```tsx
import { getDefaultVolume } from '@/lib/embed/default-volume'
// ...
// Per-card ephemeral playback controls for the single active card. Volume is
// seeded from the global default and is NOT persisted (resets on reload / when
// another card becomes active) — this is the basis of the future multi-card mix.
const [audioVolume, setAudioVolume] = useState<number>(50)
const [audioPaused, setAudioPaused] = useState<boolean>(false)
useEffect(() => {
  if (audioActiveId) { setAudioVolume(getDefaultVolume()); setAudioPaused(false) }
}, [audioActiveId])
```

Pass to `CardsLayer`:

```tsx
audioVolume={audioVolume}
audioPaused={audioPaused}
onAudioVolumeChange={setAudioVolume}
onAudioTogglePause={(): void => setAudioPaused((p) => !p)}
```

(`getDefaultVolume` import: add it; `useState`/`useEffect` already imported.)

- [ ] **Step 2: Thread props through CardsLayer + render the bar**

In `CardsLayer.tsx`, add to `CardsLayerProps`:

```tsx
readonly audioVolume: number
readonly audioPaused: boolean
readonly onAudioVolumeChange: (next: number) => void
readonly onAudioTogglePause: () => void
```

Destructure them. Import the bar: `import { PlaybackControlBar } from './PlaybackControlBar'`.

Pass volume/paused into the inline player:

```tsx
<InlineMediaPlayer item={it} volume={audioVolume} paused={audioPaused} />
```

Render the bar inside the active card wrapper, anchored just below it. Place it right after the inline-player overlay block:

```tsx
{audioActiveId === it.bookmarkId && canPlayInline(it) && (
  <div
    style={{
      position: 'absolute',
      top: 'calc(100% + 8px)',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 60, // above the card chrome; the bar is the active control surface
    }}
  >
    <PlaybackControlBar
      volume={audioVolume}
      paused={audioPaused}
      onVolumeChange={onAudioVolumeChange}
      onTogglePause={onAudioTogglePause}
    />
  </div>
)}
```

- [ ] **Step 3: Type-check + full suite**

Run: `pnpm tsc --noEmit && rtk pnpm vitest run`
Expected: tsc clean; all pass.

- [ ] **Step 4: Commit**

```bash
rtk git add components/board/BoardRoot.tsx components/board/CardsLayer.tsx
rtk git commit -m "feat(board): render PlaybackControlBar below the active card + wire per-card volume/pause"
```

---

## Task 5: Build + preview verification + deploy

**Files:** (verification only)

- [ ] **Step 1: Production build**

Run: `pnpm build`
Expected: success, `out/` regenerated.

- [ ] **Step 2: Preview server (functions live for tweet video)**

Run (background): `npx wrangler pages dev out --port 8788 --compatibility-date=2024-01-01`
Wait for "Ready on http://127.0.0.1:8788".

- [ ] **Step 3: Playwright — bar present, volume/pause work, stop icon, resize intact**

Seed cards via `/save?url=...` (a YouTube + a SoundCloud + the user-provided video tweets — URLs live ONLY in the temp script, never committed). Write `C:/Users/masay/AppData/Local/Temp/verify-controls.mjs` (adapt from `verify-media-unification.mjs`): activate a playable card → assert (a) corner indicator `data-icon="stop"`, (b) `[data-testid="pc-bar"]` is visible below the card, (c) moving `[data-testid="pc-volume"]` changes the underlying media element volume (for the native-video tweet: read `document.querySelector('video').volume`), (d) clicking `[data-testid="pc-playpause"]` toggles the video's `paused`, (e) the bottom-right resize still changes width.

Run: `node C:/Users/masay/AppData/Local/Temp/verify-controls.mjs`
Expected: stop icon present; bar visible; volume read-back matches the slider; `video.paused` flips on toggle; resize works.

- [ ] **Step 4: Report to user for manual confirmation**

Message (Japanese): 本番前確認です。カード再生中に下のバーで音量・一時停止ができる / 右下が■停止マークになる / 小さいカードでも操作できる / リサイズが効く、を確認してください。複数種類（YouTube・SoundCloud・X動画）で。

- [ ] **Step 5: Deploy after user confirms**

```bash
npx wrangler pages deploy out/ --project-name=booklage --branch=master --commit-dirty=true --commit-message="inline-playback-controls"
```

Then tell the user to hard-reload `booklage.pages.dev`.

---

## Self-Review notes

- **Spec coverage:** bar below card (Task 4 Step 2) / per-card ephemeral volume seeded from default, not persisted (Task 4 Step 1) / volume isolated from global default (Task 3 `controlled` guard, no write-back) / play/pause in place (Task 3 effects, keep mounted) / corner ■ stop while playing (Task 1) / volume+play-pause only, no seek (scope). All covered.
- **No-breakage:** Lightbox passes neither `volume` nor `paused` → `controlled` is false in every embed → existing global-default + native-controls behaviour is byte-identical. Full suite after Tasks 3 and 4. Preview manual check covers all platforms.
- **Per-card now vs map later:** Phase 1 has ONE active card, so a single `audioVolume`/`audioPaused` in BoardRoot is correct and YAGNI; the embed props are already per-instance, so Tier 3 (multi-card mix) only needs BoardRoot to swap the single state for a `Map<bookmarkId,…>` — no embed changes.
- **Platform limits (stated, not hidden):** TikTok Tier-2 iframe and any non-API player can't honor volume/pause; the bar still shows but is a no-op there. Everything else (native video, YouTube, Vimeo, SoundCloud) is fully controllable.
- **Placeholder scan:** none — every code step has concrete code. The temp playwright script is described with exact selectors/assertions.
- **Type consistency:** `volume:number`/`paused:boolean` props and `onVolumeChange`/`onTogglePause`/`onAudioVolumeChange`/`onAudioTogglePause` names are consistent across Tasks 2–4; `resolveInlinePlayer(item, {autoStart, volume, paused})` matches its callers.
```
