'use client'

import type { ReactElement } from 'react'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import { formatCaptureBreadcrumb, type CaptureBreadcrumb } from '@/lib/share/capture-breadcrumb'
import styles from './CaptureCrashNotice.module.css'

export type CaptureCrashNoticeProps = {
  /** The breadcrumb left behind by a capture that never cleared it (= the tab
   *  crashed mid-capture before it could). */
  readonly breadcrumb: CaptureBreadcrumb
  /** Dismiss the notice (the caller has already cleared storage). */
  readonly onDismiss: () => void
}

/**
 * Shown once on board load when the previous share-image capture left a
 * breadcrumb behind — i.e. the tab crashed mid-capture (iOS Safari out-of-memory)
 * before it could clear it, taking the on-screen diagnostics (s188) down with it.
 * This is the crash-durable read-back: the numbers that survived the crash.
 */
export function CaptureCrashNotice({ breadcrumb, onDismiss }: CaptureCrashNoticeProps): ReactElement {
  return (
    <div
      className={styles.wrap}
      style={{ zIndex: BOARD_Z_INDEX.MODAL_OVERLAY }}
      role="alert"
      data-testid="capture-crash-notice"
    >
      <div className={styles.card}>
        <span className={styles.title}>LAST SHARE COULDN&apos;T MAKE THE PICTURE</span>
        <span className={styles.body}>
          The phone ran out of memory while building the image and reloaded. The
          line below tells us why — please send it to us. Sharing fewer cards may
          work now.
        </span>
        <code className={styles.diag} data-testid="capture-crash-diag">
          {formatCaptureBreadcrumb(breadcrumb)}
        </code>
        <button
          type="button"
          className={styles.dismiss}
          onClick={onDismiss}
          data-testid="capture-crash-dismiss"
        >
          OK
        </button>
      </div>
    </div>
  )
}
