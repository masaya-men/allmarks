'use client'
import { useEffect, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './ShareCreatingIndicator.module.css'

/** "Creating your link…" progress indicator for the SHARE auto-capture flow.
 *  Rendered via a portal to document.body — OUTSIDE the board's capture subtree
 *  (`boardFrameRef`) — so it (a) is never baked into the dom-to-image screenshot
 *  and (b) is never hidden by the `.outerFrame[data-capturing] [data-no-capture]`
 *  visibility rule, unlike the in-frame ShareToast button. Stays visible across
 *  BOTH the capture and upload phases until the link is ready. */
export function ShareCreatingIndicator({ active }: { readonly active: boolean }): ReactElement | null {
  const [mounted, setMounted] = useState(false)
  useEffect((): void => setMounted(true), [])
  if (!active || !mounted || typeof document === 'undefined') return null
  return createPortal(
    <div
      className={styles.root}
      style={{ zIndex: BOARD_Z_INDEX.SHARE_CREATING }}
      role="status"
      aria-live="polite"
      data-testid="share-creating-indicator"
    >
      <span className={styles.dot} />
      <span className={styles.label}>CREATING YOUR LINK…</span>
    </div>,
    document.body,
  )
}
