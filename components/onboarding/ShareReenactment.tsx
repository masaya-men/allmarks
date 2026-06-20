// components/onboarding/ShareReenactment.tsx
'use client'

import { useEffect, useRef, type ReactElement } from 'react'
import { gsap } from 'gsap'
import styles from './ShareReenactment.module.css'

type Props = {
  readonly caption: string
  /** Called automatically once the showcase has played (and by the NEXT escape
   *  button). The share scene is a "watch how sharing works" beat — it never
   *  creates a real server-side share. */
  readonly onAdvance: () => void
}

// How long the showcase plays before it auto-advances to the finale.
const AUTO_ADVANCE_MS = 5200
const AUTO_ADVANCE_REDUCED_MS = 4200

/**
 * A promo-style re-enactment of the SHARE screen: the board is "captured" into a
 * shareable image, a share link types in, and the share actions (Copy link /
 * Post to X / Share now) light up. The board stays fully blocked (it's a cinema
 * overlay) and the scene auto-advances — sharing is shown, never performed, so
 * no server-side share is ever created.
 */
export function ShareReenactment({ caption, onAdvance }: Props): ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const advancedRef = useRef(false)

  useEffect(() => {
    const advanceOnce = (): void => {
      if (advancedRef.current) return
      advancedRef.current = true
      onAdvance()
    }
    const root = ref.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!root || reduce) {
      const t = setTimeout(advanceOnce, AUTO_ADVANCE_REDUCED_MS)
      return () => clearTimeout(t)
    }

    const q = (s: string): Element | null => root.querySelector(s)
    const qa = (s: string): Element[] => Array.from(root.querySelectorAll(s))
    const panel = q('[data-anim="panel"]')
    const scan = q('[data-anim="scan"]')
    const tiles = qa('[data-anim="tile"]')
    const url = q('[data-anim="url"]')
    const actions = qa('[data-anim="act"]')

    gsap.set(panel, { opacity: 0, y: 18 })
    gsap.set(tiles, { opacity: 0, scale: 0.92 })
    gsap.set(scan, { opacity: 0, top: '0%' })
    gsap.set(url, { opacity: 0 })
    gsap.set(actions, { opacity: 0, y: 6 })

    const tl = gsap.timeline()
    tl
      .to(panel, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' })
      // capture scan sweeps down the preview, then the board tiles resolve
      .to(scan, { opacity: 0.8, duration: 0.15 }, '+=0.1')
      .to(scan, { top: '100%', duration: 0.7, ease: 'power1.inOut' })
      .to(scan, { opacity: 0, duration: 0.2 }, '-=0.2')
      .to(tiles, { opacity: 1, scale: 1, duration: 0.4, stagger: 0.06, ease: 'back.out(1.4)' }, '-=0.7')
      // a share link appears
      .to(url, { opacity: 1, duration: 0.3 }, '+=0.1')
      // the share actions light up
      .to(actions, { opacity: 1, y: 0, duration: 0.35, stagger: 0.12, ease: 'power2.out' }, '-=0.1')

    const t = setTimeout(advanceOnce, AUTO_ADVANCE_MS)
    return () => { tl.kill(); clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.stage} data-testid="stage-share">
      <div ref={ref} className={styles.panel} data-anim="panel">
        <div className={styles.header}>SHARE</div>
        <div className={styles.preview}>
          <div data-anim="scan" className={styles.scan} aria-hidden="true" />
          <div className={styles.collage} aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} data-anim="tile" className={styles.tile} style={{ ['--t' as string]: i }} />
            ))}
          </div>
          <span className={styles.wordmark}>AllMarks</span>
        </div>
        <div className={styles.urlRow}>
          <span className={styles.urlLabel}>LINK</span>
          <span data-anim="url" className={styles.url}>allmarks.app/s/…</span>
        </div>
        <div className={styles.actions}>
          <span data-anim="act" className={styles.action}>COPY LINK</span>
          <span data-anim="act" className={styles.action}>POST TO X</span>
          <span data-anim="act" className={`${styles.action} ${styles.primary}`}>SHARE NOW</span>
        </div>
      </div>
      <p className={styles.caption}>{caption}</p>
      <button type="button" className={styles.cta} onClick={onAdvance}>NEXT</button>
    </div>
  )
}
