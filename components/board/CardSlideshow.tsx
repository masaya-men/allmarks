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
