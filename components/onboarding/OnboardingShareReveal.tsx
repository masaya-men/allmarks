// components/onboarding/OnboardingShareReveal.tsx
'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { gsap } from 'gsap'
import styles from './OnboardingShareReveal.module.css'

type Props = {
  readonly caption: string
  /** Open the REAL share panel (BoardRoot's SenderShareModal) with the live
   *  board preview. Called once the demo cursor presses the SHARE button. */
  readonly onOpenModal: () => void
  /** Close it again (on advance / skip). */
  readonly onCloseModal: () => void
  readonly onAdvance: () => void
}

const SHARE_SELECTOR = '[data-onboarding-target="share"]'
const PRESS_MS = 1500

/**
 * ⑦ share — instead of a re-enactment, this opens the genuine share panel.
 * A demo cursor presses the real SHARE button in the board header; that opens
 * BoardRoot's real SenderShareModal (the live board mirrored as a preview, a
 * share link, POST TO X). A transparent blocker — portaled above the modal —
 * holds it in a look-don't-touch state (and we never press SHARE NOW, so no
 * server share is ever created). NEXT is always available so the user can move
 * on at any time.
 */
export function OnboardingShareReveal({ caption, onOpenModal, onCloseModal, onAdvance }: Props): ReactElement | null {
  const [phase, setPhase] = useState<'press' | 'shown'>('press')
  const layerRef = useRef<HTMLDivElement>(null)
  const openedRef = useRef(false)
  const onOpenRef = useRef(onOpenModal)
  const onCloseRef = useRef(onCloseModal)
  onOpenRef.current = onOpenModal
  onCloseRef.current = onCloseModal
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const open = (): void => {
      if (openedRef.current) return
      openedRef.current = true
      onOpenRef.current()
      setPhase('shown')
    }
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cursor = layerRef.current?.querySelector<HTMLElement>('[data-anim="cursor"]') ?? null
    const ring = layerRef.current?.querySelector<HTMLElement>('[data-anim="share-ring"]') ?? null
    const btn = typeof document !== 'undefined' ? document.querySelector<HTMLElement>(SHARE_SELECTOR) : null

    let tl: gsap.core.Timeline | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    if (reduce || !cursor || !btn) {
      // No choreography available — just reveal the real panel.
      timer = setTimeout(open, reduce ? 0 : 300)
    } else {
      const r = btn.getBoundingClientRect()
      // Ring the SHARE button so the eye lands there before the cursor presses.
      if (ring) gsap.set(ring, { left: r.left - 7, top: r.top - 7, width: r.width + 14, height: r.height + 14, opacity: 1 })
      gsap.set(cursor, { left: r.left + r.width / 2 - 60, top: r.top + r.height / 2 + 48, opacity: 0, scale: 1 })
      tl = gsap.timeline()
      tl.to(cursor, { opacity: 1, duration: 0.3, ease: 'power2.out' })
        .to(cursor, { left: r.left + r.width / 2, top: r.top + r.height / 2, duration: 0.85, ease: 'power2.inOut' }, '+=0.1')
        .to(cursor, { scale: 0.78, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.inOut' })
        .to(cursor, { opacity: 0, duration: 0.25 })
        .call(open)
      // Safety net in case the timeline is interrupted before the .call fires.
      timer = setTimeout(open, PRESS_MS + 400)
    }

    return () => {
      if (tl) tl.kill()
      if (timer) clearTimeout(timer)
      onCloseRef.current() // leaving the scene (advance / skip) closes the panel
    }
  }, [mounted])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <div ref={layerRef} className={styles.layer} data-testid="onboarding-share-reveal">
      {phase === 'shown' && <div className={styles.blocker} />}
      {phase === 'press' && <span data-anim="share-ring" className={styles.pulseRing} aria-hidden="true" />}
      <span data-anim="cursor" className={styles.cursor} aria-hidden="true" />
      <div className={styles.footer}>
        {phase === 'shown' && <p className={styles.caption}>{caption}</p>}
        <button
          type="button"
          className={styles.next}
          data-cue={phase === 'shown' ? 'true' : undefined}
          onClick={onAdvance}
        >
          NEXT
        </button>
      </div>
    </div>,
    document.body,
  )
}
