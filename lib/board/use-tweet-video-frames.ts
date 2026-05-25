import { useEffect, useState } from 'react'
import { extractVideoFrames } from './extract-video-frames'

/** 0% (start), 25% (early action), 50% (mid). 75% is deliberately skipped
 *  to avoid landing on a dark / end-card frame. */
const SEEK_FRACTIONS = [0, 0.25, 0.5] as const

/** Process-wide cache: survives card unmount/scroll-cull and component re-mount
 *  so a card scrolling back into view shows its 3 frames instantly without
 *  re-decoding. Cleared on full page reload (in-memory by design — Phase 2).  */
const frameCache = new Map<string, readonly string[]>()
/** In-flight dedup: a single extraction promise per bookmarkId so two visible
 *  copies of the same card (drag-preview, etc.) don't decode twice. */
const inFlight = new Map<string, Promise<readonly string[]>>()

/** Concurrency limit = 1: only ONE extraction at a time. With the hero video
 *  also playing, two simultaneous extractions used to push three decoders
 *  through a single GPU frame and the user saw a brief 4K stutter on first
 *  scroll-in. One-at-a-time keeps total active decoders at hero + 1 = 2,
 *  which is well within fill-rate. Tasks past the limit wait in a FIFO queue
 *  — total wall time roughly doubles, but the user reads it as a slow ripple
 *  rather than a stutter. */
const MAX_CONCURRENT = 1
let activeCount = 0
const waitQueue: Array<() => void> = []

function acquireSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (activeCount < MAX_CONCURRENT) {
      activeCount++
      resolve()
    } else {
      waitQueue.push(() => {
        activeCount++
        resolve()
      })
    }
  })
}

function releaseSlot(): void {
  activeCount = Math.max(0, activeCount - 1)
  const next = waitQueue.shift()
  if (next) next()
}

/** Drive the X-video frame extractor for a single card. Returns the 3 data-URL
 *  frames once they're ready; returns [] while extracting or on failure (the
 *  card falls back to its poster). Cached across mounts within the same tab.
 *
 *  Calls are gated by `enabled` so cards out of view / on Lightbox-open don't
 *  burn the queue on something the user can't see. */
export function useTweetVideoFrames(
  bookmarkId: string,
  videoUrl: string | undefined,
  enabled: boolean,
): readonly string[] {
  const [frames, setFrames] = useState<readonly string[]>(
    () => frameCache.get(bookmarkId) ?? [],
  )

  useEffect(() => {
    if (!enabled || !videoUrl || !bookmarkId) return
    const cached = frameCache.get(bookmarkId)
    if (cached) {
      setFrames(cached)
      return
    }

    let cancelled = false
    const proxied = `/api/tweet-video?url=${encodeURIComponent(videoUrl)}`

    const existing = inFlight.get(bookmarkId)
    const promise = existing ?? (async (): Promise<readonly string[]> => {
      await acquireSlot()
      try {
        const out = await extractVideoFrames({
          src: proxied,
          fractions: SEEK_FRACTIONS,
        })
        frameCache.set(bookmarkId, out)
        return out
      } finally {
        releaseSlot()
        inFlight.delete(bookmarkId)
      }
    })()
    if (!existing) inFlight.set(bookmarkId, promise)

    promise
      .then((out) => { if (!cancelled) setFrames(out) })
      .catch(() => { /* poster-only fallback — leave frames as [] */ })

    return (): void => { cancelled = true }
  }, [bookmarkId, videoUrl, enabled])

  return frames
}

/** Test-only: reset module-level cache + concurrency state between tests. */
export function __resetTweetVideoFramesForTests(): void {
  frameCache.clear()
  inFlight.clear()
  activeCount = 0
  waitQueue.length = 0
}
