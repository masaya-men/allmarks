'use client'

import Link from 'next/link'
import styles from './BoardChrome.module.css'

/**
 * Outer-frame chrome for /board: the AllMarks wordmark in the top-left margin,
 * linking back to the marketing home (= a way out of the board to the LP).
 * Plain text-only — no glass, no shadow — lets the canvas remain the focal point.
 * Fades out with the rest of the chrome while the Lightbox is open.
 *
 * The bottom marketing link strip (Guide/About/Privacy/Terms) was dropped when
 * the board went edge-to-edge (no bottom margin to host it); it returns in a
 * future footer redesign. The top-left wordmark needs no bottom margin.
 */
export function BoardChrome({ hidden = false }: { readonly hidden?: boolean }): React.ReactElement {
  return (
    <Link
      href="/"
      className={hidden ? `${styles.brand} ${styles.brandHidden}` : styles.brand}
      aria-label="AllMarks home"
    >
      AllMarks
    </Link>
  )
}
