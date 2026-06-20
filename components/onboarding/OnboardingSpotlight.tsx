// components/onboarding/OnboardingSpotlight.tsx
'use client'

import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import styles from './OnboardingSpotlight.module.css'

type Rect = { top: number; left: number; width: number; height: number }
type Props = {
  readonly targetSelector: string | null
  readonly caption: string
  readonly children?: ReactNode
}

function measure(sel: string | null): Rect | null {
  if (!sel) return null
  const el = document.querySelector(sel)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export function OnboardingSpotlight({ targetSelector, caption, children }: Props): ReactElement {
  const [rect, setRect] = useState<Rect | null>(() => null)

  useEffect(() => {
    let raf = 0
    const tick = (): void => {
      setRect(measure(targetSelector))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [targetSelector])

  const pad = 8
  const hole = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null

  return (
    <div className={styles.layer} data-testid="onboarding-spotlight">
      {hole ? (
        <>
          {/* four dim panels around the hole */}
          <div className={styles.dim} style={{ top: 0, left: 0, right: 0, height: hole.top }} />
          <div className={styles.dim} style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }} />
          <div className={styles.dim} style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height }} />
          <div className={styles.dim} style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }} />
          <div className={styles.ring} style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }} />
          <div
            className={styles.bubble}
            style={{ top: hole.top + hole.height + 14, left: hole.left }}
          >
            {caption}
            {children}
          </div>
        </>
      ) : (
        <div className={styles.dimFull}>
          <div className={styles.bubbleCenter}>{caption}{children}</div>
        </div>
      )}
    </div>
  )
}
