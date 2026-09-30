'use client'

// components/marketing/BackgroundGrid.tsx
import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { gsap } from 'gsap'
import { tickStep, tickWrap } from '@/lib/marketing/lp/grid-ticks'
import styles from './BackgroundGrid.module.css'

const GRID_COLUMNS = 12
/** 縦線は 13 本(左端 + 各列の右端)。それぞれに目盛りが付く。 */
const LINE_COUNT = GRID_COLUMNS + 1

/**
 * BackgroundGrid — fixed, full-viewport 12-column grid of faint vertical
 * hairlines rendered behind all landing-page content, with a ruler tick every
 * 96px on each line that slides along the line as the page scrolls (no tilt).
 * Purely decorative: aria-hidden and pointer-events disabled.
 *
 * `data-lp-bggrid` is a stable hook for the hero intro (grows the lines from
 * `scaleY(0)` via `[data-lp-bggrid] i`). The ticks are `span`s, never `i`s, so
 * the intro does not scale them. Reduced motion: ticks stay static.
 */
export function BackgroundGrid(): React.ReactElement {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ticks = Array.from(wrap.querySelectorAll<HTMLElement>('[data-lp-rtk]'))
    if (ticks.length === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let tickPos = 0
    let prevY = window.scrollY
    const frame = (): void => {
      const y = window.scrollY
      if (y === prevY) return
      tickPos += tickStep(y - prevY)
      prevY = y
      const tv = `translateY(${(-tickWrap(tickPos)).toFixed(1)}px)`
      for (const el of ticks) el.style.transform = tv
    }
    gsap.ticker.add(frame)
    const fade = gsap.to(ticks, { autoAlpha: 1, duration: 0.8, ease: 'none', delay: 1.0 })
    return () => {
      gsap.ticker.remove(frame)
      fade.kill()
      gsap.set(ticks, { clearProps: 'opacity,visibility,transform' })
    }
  }, [])

  return (
    <div className={styles.bggrid} data-lp-bggrid aria-hidden="true">
      <div ref={wrapRef} className={styles.wrap}>
        {Array.from({ length: GRID_COLUMNS }, (_, index) => (
          <i key={index} />
        ))}
        {Array.from({ length: LINE_COUNT }, (_, k) => (
          <span key={k} className={styles.rtk} style={{ '--k': k } as CSSProperties} data-lp-rtk />
        ))}
      </div>
    </div>
  )
}
