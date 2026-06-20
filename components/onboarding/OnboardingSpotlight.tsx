// components/onboarding/OnboardingSpotlight.tsx
'use client'

import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import styles from './OnboardingSpotlight.module.css'

type Rect = { top: number; left: number; width: number; height: number }
type Placement = 'center' | { top: number; left: number }
type Props = {
  readonly targetSelector: string | null
  readonly caption: string
  readonly children?: ReactNode
}

const BUBBLE_W = 320
const ESTIMATED_BUBBLE_H = 160
const MARGIN = 16

function measure(sel: string | null): Rect | null {
  if (!sel) return null
  const el = document.querySelector(sel)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function computePlacement(hole: Rect, viewportW: number, viewportH: number): Placement {
  // Large-target case: hole covers most of the viewport → center bubble
  if (hole.width >= viewportW * 0.6 && hole.height >= viewportH * 0.6) {
    return 'center'
  }
  // Normal case: anchor below the hole, clamp to stay on screen
  const clampedLeft = Math.max(MARGIN, Math.min(hole.left, viewportW - BUBBLE_W - MARGIN))
  const preferredTop = hole.top + hole.height + 14
  const top =
    preferredTop + ESTIMATED_BUBBLE_H > viewportH - MARGIN
      ? Math.max(MARGIN, hole.top - ESTIMATED_BUBBLE_H - 14) // above the hole
      : preferredTop
  return { top, left: clampedLeft }
}

export function OnboardingSpotlight({ targetSelector, caption, children }: Props): ReactElement {
  const [rect, setRect] = useState<Rect | null>(() => null)

  useEffect(() => {
    let raf = 0
    const tick = (): void => {
      // Minor 1 fix: shallow-equality short-circuit to avoid ~60 re-renders/sec
      setRect(prev => {
        const next = measure(targetSelector)
        if (!next || !prev) return next
        if (
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width &&
          prev.height === next.height
        ) return prev
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [targetSelector])

  const pad = 8
  const hole = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null

  const placement: Placement | null = hole
    ? computePlacement(hole, window.innerWidth, window.innerHeight)
    : null

  return (
    <div className={styles.layer} data-testid="onboarding-spotlight">
      {hole && placement ? (
        <>
          {/* four dim panels around the hole */}
          <div className={styles.dim} style={{ top: 0, left: 0, right: 0, height: hole.top }} />
          <div className={styles.dim} style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }} />
          <div className={styles.dim} style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height }} />
          <div className={styles.dim} style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }} />
          <div className={styles.ring} style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }} />
          {placement === 'center' ? (
            <div className={styles.bubbleCenterFixed}>
              {caption}
              {children}
            </div>
          ) : (
            <div
              className={styles.bubble}
              style={{ top: placement.top, left: placement.left }}
            >
              {caption}
              {children}
            </div>
          )}
        </>
      ) : (
        <div className={styles.dimFull}>
          <div className={styles.bubbleCenter}>{caption}{children}</div>
        </div>
      )}
    </div>
  )
}
