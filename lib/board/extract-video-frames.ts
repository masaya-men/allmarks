/** Compute the absolute seconds to seek to for a given video duration + an
 *  array of fractional positions (0..1). Clamps to the safe interior (skips
 *  the very last frame, often dark / black end card), dedups identical seconds
 *  (very short clips where 25% and 50% round to the same value), sorts
 *  ascending so the caller seeks forward only. Returns [] for invalid input.
 *  Pure — unit tested. */
export function computeSeekSeconds(
  duration: number,
  fractions: readonly number[],
): readonly number[] {
  if (!Number.isFinite(duration) || duration <= 0) return []
  const seen = new Set<number>()
  const out: number[] = []
  for (const f of fractions) {
    if (!Number.isFinite(f)) continue
    const clamped = Math.max(0, Math.min(f, 0.99))
    const s = Math.round(clamped * duration * 100) / 100 // 0.01s precision
    if (!seen.has(s)) {
      seen.add(s)
      out.push(s)
    }
  }
  return out.sort((a, b) => a - b)
}

/** Extract still frames from a video by seeking to fractions of its duration.
 *  Used by the ambient slideshow to give X (Twitter) video cards 3 real frames
 *  (start / 25% / 50%) without playing the video.
 *
 *  IMPORTANT — same-origin only: `src` MUST be a same-origin URL (route Twitter
 *  CDN clips through `/api/tweet-video`) or `canvas.toDataURL` throws on a
 *  tainted canvas. The cross-origin proxy is the whole reason it works.
 *
 *  Cost: one brief decode per fraction, then the off-screen <video> is unloaded
 *  to free memory. Output: data URLs (JPEG) sized for the board (width capped
 *  so 1080p clips don't yield 3 MB strings).
 *
 *  Throws on: invalid src / unreadable duration / decode error / seek error.
 *  Callers should treat any throw as "poster-only fallback for this card". */
export async function extractVideoFrames(opts: {
  readonly src: string
  readonly fractions: readonly number[]
  readonly maxWidth?: number
  readonly mimeType?: string
  readonly quality?: number
}): Promise<readonly string[]> {
  const {
    src,
    fractions,
    maxWidth = 640,
    mimeType = 'image/jpeg',
    quality = 0.7,
  } = opts

  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  video.src = src

  try {
    await waitForEvent(video, 'loadedmetadata')
    const seconds = computeSeekSeconds(video.duration, fractions)
    if (seconds.length === 0) throw new Error('no extractable frames')

    const vw = video.videoWidth
    const vh = video.videoHeight
    if (vw <= 0 || vh <= 0) throw new Error('no video dimensions')

    const canvas = document.createElement('canvas')
    const scale = vw > maxWidth ? maxWidth / vw : 1
    canvas.width = Math.max(1, Math.round(vw * scale))
    canvas.height = Math.max(1, Math.round(vh * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')

    const frames: string[] = []
    for (const s of seconds) {
      await seekTo(video, s)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      frames.push(canvas.toDataURL(mimeType, quality))
    }
    return frames
  } finally {
    // Release the underlying MediaSource so the GPU/CPU don't keep buffers
    // around after extraction. Without this, several extractions in a row
    // can pile up decode contexts on Chromium.
    video.removeAttribute('src')
    try { video.load() } catch { /* ignore — unmount race */ }
  }
}

function waitForEvent(video: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onOk = (): void => { cleanup(); resolve() }
    const onErr = (): void => { cleanup(); reject(new Error(`video ${event} failed`)) }
    const cleanup = (): void => {
      video.removeEventListener(event, onOk)
      video.removeEventListener('error', onErr)
    }
    video.addEventListener(event, onOk, { once: true })
    video.addEventListener('error', onErr, { once: true })
  })
}

function seekTo(video: HTMLVideoElement, seconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = (): void => { cleanup(); resolve() }
    const onErr = (): void => { cleanup(); reject(new Error('seek failed')) }
    const cleanup = (): void => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onErr)
    }
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onErr, { once: true })
    video.currentTime = seconds
  })
}
