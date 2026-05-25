'use client'

import { useMemo, useState, type ReactElement } from 'react'
import styles from './CardSlideshow.module.css'
import { useSlideshowCycle } from '@/lib/board/use-slideshow-cycle'
import type { SlideshowFrame } from '@/lib/board/slideshow-frames'
import { useTweetVideoFrames } from '@/lib/board/use-tweet-video-frames'

/** Optional Phase 2 input: when set, the card is an X (Twitter) video and the
 *  slideshow will swap its poster-only fallback for 3 canvas-extracted frames
 *  (0% / 25% / 50% of duration) once the extractor finishes. While the extractor
 *  runs the card stays on the poster (no flicker). */
export type TweetVideoExtraction = {
  readonly bookmarkId: string
  readonly videoUrl: string
}

/**
 * Ambient still-frame crossfade for an in-view video card that is NOT the
 * single live hero video. Purely decorative + non-interactive (the parent
 * overlay wrapper sets pointer-events:none). Stacks the frames and fades the
 * active one in. With <2 frames it just shows the single still (no animation).
 * On image error it swaps to the frame's fallback url once.
 */
export function CardSlideshow({
  frames,
  tweetVideoExtraction,
  scrollingActive = false,
}: {
  readonly frames: readonly SlideshowFrame[]
  readonly tweetVideoExtraction?: TweetVideoExtraction
  /** When true, suppress new tweet-video frame extractions to keep the scroll
   *  smooth. Existing in-flight extractions and the cached-frame display path
   *  are unaffected — only new decoder spin-ups are deferred until idle. */
  readonly scrollingActive?: boolean
}): ReactElement | null {
  // Drive Phase 2 extraction when this card is an X video. The hook is a no-op
  // (returns []) when tweetVideoExtraction is undefined, so non-X cards pay no
  // cost. Until the extractor returns, `frames` (= poster only) is what shows.
  // Gated by `scrollingActive` so a fast scroll doesn't queue dozens of
  // simultaneous decoder spin-ups (= each = video decode + canvas + JPEG,
  // session 73 user observed jank).
  const extracted = useTweetVideoFrames(
    tweetVideoExtraction?.bookmarkId ?? '',
    tweetVideoExtraction?.videoUrl,
    Boolean(tweetVideoExtraction) && !scrollingActive,
  )
  const effectiveFrames = useMemo<readonly SlideshowFrame[]>(
    () => (extracted.length > 0 ? extracted.map((src): SlideshowFrame => ({ src })) : frames),
    [extracted, frames],
  )
  const active = useSlideshowCycle(effectiveFrames.length)
  // Key failures by src (not index) so the set survives Phase 2's poster→3-frame
  // swap without going stale or losing entries.
  const [failedSrcs, setFailedSrcs] = useState<ReadonlySet<string>>(() => new Set())
  if (effectiveFrames.length === 0) return null
  return (
    <div className={styles.stack} aria-hidden="true">
      {effectiveFrames.map((f, i) => (
        <img
          key={f.src}
          className={styles.frame}
          src={failedSrcs.has(f.src) && f.fallback ? f.fallback : f.src}
          alt=""
          style={{ opacity: i === active ? 1 : 0 }}
          onError={(): void =>
            setFailedSrcs((prev) => (prev.has(f.src) ? prev : new Set(prev).add(f.src)))
          }
        />
      ))}
    </div>
  )
}
