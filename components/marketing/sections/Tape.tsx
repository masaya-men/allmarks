'use client'

import { useEffect, useRef } from 'react'
import { createMarquee } from '@/lib/marketing/lp/marquee'
import styles from './Tape.module.css'

/**
 * Tape — the scrolling word band, ported from docs/private/lp-v10-mock.html
 * (markup line 445, CSS 115–120). Always flows right to left and speeds up
 * with scroll speed (see lib/marketing/lp/marquee.ts's createMarquee — this
 * component only wires it to the DOM and to resize/fonts-ready).
 */

/** The tape's words — English design vocabulary, same in every locale, never
 *  translated (mock line 445; "Sync" restored on paid launch, s226). */
const TAPE_WORDS: readonly string[] = ['Save', 'Arrange', 'Play', 'Tag', 'Share', 'Sync']

/** 4 identical cycles so createMarquee's "wrap at half scroll width" trick
 *  (lib/marketing/lp/marquee.ts) sees two identical halves of content. */
const TAPE_CYCLES = 4

export function Tape(): React.ReactElement {
  const rootRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const inner = innerRef.current
    if (!root || !inner) return undefined

    let disposed = false
    const marquee = createMarquee(root, inner, 0.9)

    function relayout(): void {
      if (disposed) return
      marquee.measure()
    }

    let resizeTimer: number | undefined
    const onResize = (): void => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(relayout, 160)
    }
    window.addEventListener('resize', onResize)

    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        relayout()
      })
    }

    return () => {
      disposed = true
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      marquee.destroy()
    }
  }, [])

  return (
    <div ref={rootRef} className={styles.tape} data-lp-tape aria-hidden="true">
      <div ref={innerRef} className={styles.tapeIn}>
        {Array.from({ length: TAPE_CYCLES }, (_, cycle) =>
          TAPE_WORDS.map((word) => (
            <span key={`${cycle}-${word}`} className={styles.word}>
              {word}
              <b className={styles.dot} />
            </span>
          )),
        )}
      </div>
    </div>
  )
}
