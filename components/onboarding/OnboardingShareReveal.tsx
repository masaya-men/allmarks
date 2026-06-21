// components/onboarding/OnboardingShareReveal.tsx
'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import styles from './OnboardingShareReveal.module.css'

type Props = {
  readonly caption: string
  /** Close the REAL share panel again (on advance / skip — i.e. unmount). */
  readonly onCloseModal: () => void
  readonly onAdvance: () => void
}

/**
 * ⑦ share — the "shown" beat. By the time this mounts the user has already
 * pressed the REAL SHARE button (guided by the spotlight + cursor in the press
 * beat), so BoardRoot's genuine SenderShareModal is open. This overlay — portaled
 * above the modal — holds it in a look-don't-touch state (a transparent blocker)
 * and shows the caption + NEXT. We never press SHARE NOW, so no server share is
 * ever created. Leaving the scene (advance / skip → unmount) closes the panel.
 */
export function OnboardingShareReveal({ caption, onCloseModal, onAdvance }: Props): ReactElement | null {
  const onCloseRef = useRef(onCloseModal)
  onCloseRef.current = onCloseModal
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => { onCloseRef.current() } // leaving the scene closes the panel
  }, [])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <div className={styles.layer} data-testid="onboarding-share-reveal">
      <div className={styles.blocker} />
      <div className={styles.footer}>
        <p className={styles.caption}>{caption}</p>
        <button type="button" className={styles.next} data-cue="true" onClick={onAdvance}>
          NEXT
        </button>
      </div>
    </div>,
    document.body,
  )
}
