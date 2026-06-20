'use client'

import { useMemo, type CSSProperties, type ReactElement } from 'react'
import type { SaveOutcome } from '@/lib/bookmarklet/save-window-plan'
import styles from './SaveToast.module.css'

/** saving + the four save outcomes the real /save window can land on. The full
 *  set is mirrored from the real window so the face can't structurally drift,
 *  even though the onboarding demo only ever drives saving/saved. */
export type FaceState = 'saving' | SaveOutcome // 'saving' | 'saved' | 'duplicate' | 'error'

const FACE_LABELS: Record<FaceState, string> = {
  saving: 'Saving', saved: 'Saved', duplicate: 'Already saved', error: 'Failed',
}

/** Per-letter rise — identical to the real SaveToast's StaggeredLabel so the
 *  onboarding re-enactment reads exactly like the live save window. */
function StaggeredLabel({ text }: { readonly text: string }): ReactElement {
  const chars = useMemo(() => Array.from(text), [text])
  return (
    <>
      {chars.map((ch, i) => (
        <span key={`${i}-${ch}`} style={{ animationDelay: `${i * 40}ms` }}>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </>
  )
}

type Props = {
  readonly state: FaceState
  /** Passthrough for the stage element — the onboarding demo flips position:fixed
   *  → absolute so the face sits inside the fake browser frame instead of the
   *  viewport. */
  readonly style?: CSSProperties
}

/**
 * The presentational "face" of the bookmarklet save window — ring spinner →
 * checkmark draw, the AllMarks wordmark, and the staggered status label, all
 * driven by [data-state]. Shares SaveToast.module.css with the real window so
 * the look can never drift. Pure render: no IndexedDB, no timers, no router.
 * Used only by the onboarding ⑥ re-enactment (the real /save window keeps its
 * own inline markup; this is a faithful copy locked to the same stylesheet).
 */
export function SaveToastFace({ state, style }: Props): ReactElement {
  const text = FACE_LABELS[state]
  const labelClass =
    state === 'saved' ? `${styles.label} ${styles.saved}` :
    state === 'duplicate' ? `${styles.label} ${styles.duplicate}` :
    state === 'error' ? `${styles.label} ${styles.error}` :
    styles.label

  return (
    <div className={styles.stage} data-state={state} style={style}>
      <div className={styles.glow} />
      <div className={styles.center}>
        <div className={styles.indicator}>
          {state === 'saving' && <div className={styles.ring} data-role="ring" />}
          {state === 'saved' && (
            <svg className={styles.checkmark} viewBox="0 0 24 24" role="img" aria-label="Saved" data-role="checkmark">
              <path d="M5 12 L10 17 L19 7" />
            </svg>
          )}
          {state === 'duplicate' && (
            <svg className={`${styles.checkmark} ${styles.warn}`} viewBox="0 0 24 24" role="img" aria-label="Already saved" data-role="warn">
              <path d="M12 3 L22 20 L2 20 Z" /><path d="M12 9 L12 14" /><circle cx="12" cy="17.2" r="1.3" />
            </svg>
          )}
          {state === 'error' && (
            <div className={styles.errorMark} role="img" aria-label="Failed" data-role="error-mark">!</div>
          )}
        </div>
        <div className={styles.brand}>AllMarks</div>
        <div className={labelClass} aria-label={text} aria-live="polite">
          <StaggeredLabel text={text} />
        </div>
      </div>
    </div>
  )
}
