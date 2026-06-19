'use client'
import { type ReactElement } from 'react'
import styles from './ImportProgressIndicator.module.css'
import { SoundWaveWorking } from '@/components/board/SoundWaveWorking'

export type ImportPhase = 'idle' | 'importing' | 'done'

/** Report-only duplicate summary shown under the done check. Returns null when
 *  nothing was skipped (snappy ✓ → board, unchanged). Count of which specific
 *  URLs duplicated is intentionally not shown — for a bulk import users only
 *  care about the totals. */
function summaryLabel(counts: { added: number; skipped: number } | null): string | null {
  if (!counts || counts.skipped <= 0) return null
  if (counts.added <= 0) return 'ALL ALREADY SAVED'
  return `${counts.added} SAVED · ${counts.skipped} ALREADY SAVED`
}

/** Full-canvas import overlay. Mount = visible (visibility is a pure function
 *  of phase, never derived from animation completion). Appear/idle→importing,
 *  during (looping wave), and done (✓) each animate via CSS. */
export function ImportProgressIndicator({
  phase,
  themeId,
  counts = null,
}: {
  readonly phase: ImportPhase
  readonly themeId: string
  /** Newly-saved vs already-on-board counts; drives the done-phase summary. */
  readonly counts?: { added: number; skipped: number } | null
}): ReactElement | null {
  if (phase === 'idle') return null
  const summary = summaryLabel(counts)
  return (
    <div className={styles.backdrop} data-phase={phase} role="status" aria-live="polite">
      <div className={styles.panel}>
        {phase === 'importing' ? (
          <>
            <SoundWaveWorking themeId={themeId} />
            <span className={styles.label}>IMPORTING</span>
          </>
        ) : (
          <>
            <svg data-testid="import-done-check" className={styles.check} viewBox="0 0 48 48" aria-hidden="true">
              <path d="M12 25 L21 34 L36 16" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {summary && (
              <span className={styles.summary} data-testid="import-summary">{summary}</span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
