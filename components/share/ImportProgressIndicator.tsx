'use client'
import { type ReactElement, type ReactNode } from 'react'
import styles from './ImportProgressIndicator.module.css'

export type ImportPhase = 'idle' | 'importing' | 'done'

/** Theme-driven "working" visual. Add a theme id → element here to make the
 *  indicator change with future themes. Default = sound-wave motif. */
function resolveWorkingVisual(themeId: string): ReactNode {
  void themeId // only the default exists today; switch on themeId when themes grow
  return (
    <svg data-testid="import-working-visual" className={styles.wave} viewBox="0 0 64 24" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={4 + i * 8} y="2" width="4" height="20" rx="2" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </svg>
  )
}

/** Full-canvas import overlay. Mount = visible (visibility is a pure function
 *  of phase, never derived from animation completion). Appear/idle→importing,
 *  during (looping wave), and done (✓) each animate via CSS. */
export function ImportProgressIndicator({
  phase,
  themeId,
}: {
  readonly phase: ImportPhase
  readonly themeId: string
}): ReactElement | null {
  if (phase === 'idle') return null
  return (
    <div className={styles.backdrop} data-phase={phase} role="status" aria-live="polite">
      <div className={styles.panel}>
        {phase === 'importing' ? (
          <>
            {resolveWorkingVisual(themeId)}
            <span className={styles.label}>IMPORTING</span>
          </>
        ) : (
          <svg data-testid="import-done-check" className={styles.check} viewBox="0 0 48 48" aria-hidden="true">
            <path d="M12 25 L21 34 L36 16" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  )
}
