'use client'

import type { ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './ReceiverImportBar.module.css'

export type ReceiverImportBarProps = {
  /** Cards still visible after the receiver's × removals — the ones IMPORT saves. */
  readonly count: number
  /** True while nothing is left to import, or an import is already running. */
  readonly disabled: boolean
  /** Runs the receiver's existing bulk import. */
  readonly onImport: () => void
}

/**
 * The receiver's primary action on a touch device (N-48). The desktop IMPORT
 * lives in the frame's top band, which is `display:none` under 640px and only
 * 27px tall above it — invisible on a phone and below the finger minimum on a
 * tablet. This puts one full-width, thumb-reachable button at the foot of the
 * canvas instead.
 *
 * Mounted inside `.canvas` (position:relative, overflow:hidden), so it pins to
 * the dark board's floor rather than the viewport: on a phone the canvas IS the
 * viewport (--canvas-margin: 0), and on a tablet it stays inside the frame. The
 * import overlay (inset:0, z 300) therefore covers it while a save runs.
 *
 * Chrome is deliberately theme-neutral, matching BoardMobileNav.
 */
export function ReceiverImportBar({ count, disabled, onImport }: ReceiverImportBarProps): ReactElement {
  return (
    <div
      className={styles.bar}
      style={{ zIndex: BOARD_Z_INDEX.TOUCH_BOTTOM_BAR }}
      data-testid="receiver-import-bar"
      data-no-capture
    >
      <button
        type="button"
        className={styles.button}
        onClick={onImport}
        disabled={disabled}
        data-testid="import-button"
      >
        {`IMPORT ${count} TO YOUR BOARD`}
      </button>
    </div>
  )
}
