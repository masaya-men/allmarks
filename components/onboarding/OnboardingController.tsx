// components/onboarding/OnboardingController.tsx
'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { IDBPDatabase } from 'idb'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { subscribeBookmarkSaved, subscribeBookmarkUpdated, postBookmarkSaved } from '@/lib/board/channel'
import { markOnboardingComplete } from '@/lib/onboarding/onboarding-state'
import { clearOnboardingDemo } from '@/lib/onboarding/onboarding-demo'
import { MOBILE_SCENE_IDS, nextSceneIdIn, ONBOARDING_SCENES, sceneById, type SceneId, type OnboardingTarget } from '@/lib/onboarding/steps'
import { addBookmark } from '@/lib/storage/indexeddb'
import { detectUrlType } from '@/lib/utils/url'
import { OnboardingStage } from './OnboardingStage'
import { ExtensionSaveReenactment } from './ExtensionSaveReenactment'
import { OnboardingSpotlight } from './OnboardingSpotlight'
import { OnboardingTagTyper } from './OnboardingTagTyper'
import { BookmarkletInstallChip } from './BookmarkletInstallChip'
import styles from './OnboardingController.module.css'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

type Props = {
  readonly db: DbLike
  readonly motionEnabled: boolean
  readonly sharePanelOpen: boolean
  readonly appUrl: string
  readonly onComplete: () => void
  /** Force MOTION off when entering the motion scene so the user has a real
   *  toggle to flip (defaults to ON for first-run). In-memory only — the
   *  user's persisted toggle wins once they turn it on. */
  readonly onRequestMotionOff?: () => void
  /** True while the tag scene is active so the board can force the hover-gated
   *  +TAG button visible (the user can't hover through the spotlight). */
  readonly onTagSceneActive?: (active: boolean) => void
  /** Bumped by the board each time a tag is added to a card. The tag scene
   *  advances on a change here — the board's own tag-add reloads locally and
   *  does NOT post to the bookmark-updated channel, so this in-process signal
   *  is how the controller learns a tag was applied. */
  readonly tagAddedSignal?: number
  /** Apply a sample tag to the newest card on the user's behalf. The tag scene
   *  calls this automatically (tagging by hand through the popover is fiddly),
   *  then advances when tagAddedSignal bumps. */
  readonly onApplySampleTag?: () => void
}

const SAMPLE_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' // public, long-lived

const TARGET_SELECTOR: Record<OnboardingTarget, string> = {
  'paste-zone': '[data-onboarding-target="paste-zone"]',
  'card-tag': '[data-onboarding-target="card-tag"]',
  card: '[data-onboarding-target="card"]',
  motion: '[data-onboarding-target="motion"]',
  share: '[data-onboarding-target="share"]',
}

// How long the tag scene shows the card + caption before the typed-tag demo
// starts, so the user reads "tags keep your board organized" first, then watches
// the tag get typed in (rather than a tag appearing out of nowhere).
const TAG_READ_BEAT_MS = 1500

function extensionDetected(): boolean {
  if (typeof document === 'undefined') return false
  return Boolean(document.documentElement.getAttribute('data-booklage-extension'))
}

export function OnboardingController({
  db, motionEnabled, sharePanelOpen, appUrl, onComplete, onRequestMotionOff, onTagSceneActive,
  tagAddedSignal = 0, onApplySampleTag,
}: Props): ReactElement {
  const { t } = useI18n()
  const [sceneId, setSceneId] = useState<SceneId>('enter')
  const [copied, setCopied] = useState(false)
  // Confirmations: the tag/motion scenes show the RESULT of the action and a
  // NEXT button, so the user sees what happened and proceeds at their own pace
  // (rather than the scene rushing past the moment they act).
  const [tagApplied, setTagApplied] = useState(false)
  const [tagTyperMounted, setTagTyperMounted] = useState(false)
  const [motionOn, setMotionOn] = useState(false)
  const scene = sceneById(sceneId)
  const finishingRef = useRef(false)
  const prevMotionRef = useRef(motionEnabled)
  const shareOpenedRef = useRef(false)
  const prevTagSignalRef = useRef(tagAddedSignal)
  const isMobileRef = useRef(typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches)

  const advance = (): void => {
    const seq = isMobileRef.current ? MOBILE_SCENE_IDS : ONBOARDING_SCENES.map((s) => s.id)
    const next = nextSceneIdIn(seq, sceneId)
    if (next === null) { void finish(); return }
    setSceneId(next)
  }

  const finish = async (): Promise<void> => {
    if (finishingRef.current) return
    finishingRef.current = true
    await clearOnboardingDemo(db)
    await markOnboardingComplete(db)
    onComplete()
  }

  // TRY THIS — copy a sample link to the clipboard and prompt the user to
  // paste it onto the board themselves, so they learn the real paste gesture
  // (the point of this scene). Their paste (or their own link) fires
  // bookmark-saved, which advances the scene. If the clipboard API is blocked,
  // fall back to saving the sample directly so the user is never stuck.
  const tryThis = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(SAMPLE_URL)
      setCopied(true)
    } catch {
      try {
        const created = await addBookmark(db, {
          url: SAMPLE_URL, title: '', description: '', thumbnail: '', favicon: '',
          siteName: '', type: detectUrlType(SAMPLE_URL),
        })
        postBookmarkSaved({ bookmarkId: created.id })
      } catch { /* user can still paste their own link to advance */ }
    }
  }

  // Event-driven advances. Each effect is scoped to the scene that needs it.
  useEffect(() => {
    if (scene.advance !== 'saved') return
    return subscribeBookmarkSaved(() => advance())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId])

  // Reset the per-scene confirmation flags whenever the scene changes.
  useEffect(() => {
    setTagApplied(false)
    setTagTyperMounted(false)
    setMotionOn(false)
    setCopied(false)
  }, [sceneId])

  // Tag scene: mark "applied" (→ show the result + NEXT) when a tag lands on the
  // card, via the cross-context channel (PiP/extension) or the in-process
  // tagAddedSignal (the board's own tag-add). Does NOT advance — the user does.
  useEffect(() => {
    if (sceneId !== 'tag') return
    return subscribeBookmarkUpdated(() => setTagApplied(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId])

  useEffect(() => {
    const was = prevTagSignalRef.current
    prevTagSignalRef.current = tagAddedSignal
    if (sceneId === 'tag' && tagAddedSignal !== was) setTagApplied(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagAddedSignal, sceneId])

  // Motion scene: mark "on" (→ show confirmation + NEXT) when the user turns
  // MOTION on (false→true). Does NOT advance — the user watches the cards move,
  // then presses NEXT.
  useEffect(() => {
    const was = prevMotionRef.current
    prevMotionRef.current = motionEnabled
    if (sceneId === 'motion' && !was && motionEnabled) setMotionOn(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionEnabled, sceneId])

  // Share scene advances when the panel is CLOSED AFTER having been OPENED
  // (matches the spec: "open SHARE to see how publishing works, then close").
  // Advancing on close guarantees the panel is gone before the finale renders
  // (no lingering modal intercepting the finale's NEXT).
  useEffect(() => {
    if (scene.advance !== 'sharePanel') { shareOpenedRef.current = false; return }
    if (sharePanelOpen) {
      shareOpenedRef.current = true
    } else if (shareOpenedRef.current) {
      shareOpenedRef.current = false
      advance()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharePanelOpen, sceneId])

  // Force MOTION off exactly once when transitioning into the motion scene,
  // otherwise the false->true edge advance has nothing to fire on (MOTION
  // defaults to ON for first-run) and the scene stalls.
  useEffect(() => {
    if (sceneId === 'motion') onRequestMotionOff?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId])

  // Tell the board to force the hover-gated +TAG button visible during the
  // tag scene (so it's visible inside the cut-out).
  useEffect(() => {
    onTagSceneActive?.(sceneId === 'tag')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId])

  // Tag scene: after a read beat, mount the typed-tag demo. The demo types
  // "sample" into a faithful copy of the real tag menu, then pops the chip —
  // at which point it applies the REAL tag (onApplySampleTag) so the genuine
  // green pill lands on the genuine card — and finally reveals the confirmation.
  useEffect(() => {
    if (sceneId !== 'tag') return
    const id = setTimeout(() => setTagTyperMounted(true), TAG_READ_BEAT_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId])

  const installDetected = sceneId === 'install' && extensionDetected()
  const body = installDetected
    ? t('board.onboarding.installDetected.body')
    : t(`board.onboarding.${sceneId}.body`)

  const wrap = (inner: ReactElement): ReactElement => (
    <div className={styles.root} data-testid="onboarding-root">
      <button type="button" className={styles.skip} onClick={() => void finish()}>
        SKIP
      </button>
      <div data-testid={`scene-${sceneId}`} className={styles.sceneWrap}>
        {inner}
      </div>
    </div>
  )

  // ---- Cinema scenes -------------------------------------------------------
  if (scene.kind === 'cinema') {
    if (sceneId === 'extDemo') {
      return wrap(<ExtensionSaveReenactment caption={body} buttonLabel="NEXT" onAdvance={advance} />)
    }
    return wrap(
      <OnboardingStage
        variant={sceneId === 'finale' ? 'finale' : 'enter'}
        caption={body}
        buttonLabel={sceneId === 'enter' ? 'START' : 'NEXT'}
        onAdvance={advance}
      />,
    )
  }

  // Share scene with the panel open: step aside (skip-only, no dim/spotlight)
  // so the z-200 share modal is fully visible above the (z-210, but now
  // pointer-transparent) onboarding root. Advance happens when it closes.
  if (sceneId === 'share' && sharePanelOpen) {
    return (
      <div className={styles.root} data-testid="onboarding-root">
        <button type="button" className={styles.skip} onClick={() => void finish()}>
          SKIP
        </button>
        <div data-testid="scene-share" className={styles.sceneWrap} />
      </div>
    )
  }

  // ---- Hands-on scenes -----------------------------------------------------
  // The tag and motion scenes show the RESULT of the action (a tag landing /
  // the cards moving) and only then reveal NEXT, so the user sees what happened
  // and proceeds at their own pace. Their captions sit at the bottom (off the
  // cut-out / off the moving cards). The spotlight hole passes clicks through,
  // so the user can still operate the real control (MOTION toggle, SHARE).
  const isTag = sceneId === 'tag'
  const isMotion = sceneId === 'motion'
  return wrap(
    <OnboardingSpotlight
      targetSelector={scene.target ? TARGET_SELECTOR[scene.target] : null}
      caption={body}
      captionAtBottom={isTag || isMotion}
      blockHole={isTag}
      cardAnchoredSlot={
        isTag && tagTyperMounted ? (
          <OnboardingTagTyper
            text="sample"
            onApply={() => onApplySampleTag?.()}
            onFinished={() => setTagApplied(true)}
          />
        ) : null
      }
    >
      {sceneId === 'paste' && (
        <>
          <button type="button" className={styles.tryThis} onClick={() => void tryThis()}>
            TRY THIS
          </button>
          {copied && (
            <p className={styles.copiedHint}>{t('board.onboarding.paste.copied')}</p>
          )}
        </>
      )}
      {/* Tag: auto-applies a sample tag after a beat; once it lands, confirm it
          and reveal NEXT (user-paced, not a flash). */}
      {isTag && tagApplied && (
        <>
          <p className={styles.copiedHint}>{t('board.onboarding.tag.done')}</p>
          <button type="button" className={styles.advanceBtn} onClick={advance}>NEXT</button>
        </>
      )}
      {/* Motion: NEXT appears only after the user turns MOTION on, so they
          actually see the cards come alive first. */}
      {isMotion && motionOn && (
        <>
          <p className={styles.copiedHint}>{t('board.onboarding.motion.done')}</p>
          <button type="button" className={styles.advanceBtn} onClick={advance}>NEXT</button>
        </>
      )}
      {sceneId === 'install' && !installDetected && (
        <BookmarkletInstallChip appUrl={appUrl} />
      )}
      {sceneId === 'install' && (
        <button type="button" className={styles.advanceBtn} onClick={advance}>
          NEXT
        </button>
      )}
      {/* SHARE advances when the panel is opened then closed, but give a plain
          NEXT too so the user is never unsure how to proceed. */}
      {sceneId === 'share' && (
        <button type="button" className={styles.advanceBtn} onClick={advance}>
          NEXT
        </button>
      )}
    </OnboardingSpotlight>,
  )
}
