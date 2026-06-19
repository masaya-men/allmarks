'use client'

import { type ReactElement } from 'react'
import { SoundWaveWorking } from './SoundWaveWorking'
import type { PasteFeedback } from '@/lib/board/use-url-paste-save'
import { BOARD_Z_INDEX } from '@/lib/board/constants'
import styles from './PasteSaveFeedback.module.css'

export function PasteSaveFeedback({
  feedback,
  themeId,
}: {
  readonly feedback: PasteFeedback
  readonly themeId: string
}): ReactElement | null {
  if (feedback.kind === null) return null
  return (
    <div
      className={styles.root}
      data-kind={feedback.kind}
      role="status"
      aria-live="polite"
      style={{ zIndex: BOARD_Z_INDEX.PASTE_FEEDBACK }}
    >
      {feedback.kind === 'loading' ? (
        <div className={styles.panel}>
          <SoundWaveWorking themeId={themeId} />
          <span className={styles.label}>SAVING</span>
        </div>
      ) : (
        <div className={styles.pill}>Already saved</div>
      )}
    </div>
  )
}
