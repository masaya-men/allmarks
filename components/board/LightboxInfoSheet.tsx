import type { ReactNode } from 'react'
import styles from './LightboxInfoSheet.module.css'

/** Bottom info sheet for the mobile lightbox (session 180). Peeks a grab handle
 *  at the screen bottom; swiping up (handled by the parent stage) or tapping the
 *  handle slides it open. Holds the secondary info — title / description /
 *  source / meta / (tweet) translate — for the big-center main content. */
export function LightboxInfoSheet({
  open,
  onToggle,
  children,
}: {
  readonly open: boolean
  readonly onToggle: () => void
  readonly children: ReactNode
}): ReactNode {
  return (
    <div
      className={styles.sheet}
      data-testid="lightbox-info-sheet"
      data-open={open ? 'true' : 'false'}
    >
      <button type="button" className={styles.handle} aria-label="Details" onClick={onToggle}>
        <span className={styles.grip} aria-hidden="true" />
      </button>
      <div className={styles.body}>{children}</div>
    </div>
  )
}
