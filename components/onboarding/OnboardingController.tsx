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
import { ShareReenactment } from './ShareReenactment'
import { OnboardingSpotlight } from './OnboardingSpotlight'
import { OnboardingTagTyper } from './OnboardingTagTyper'
import { BookmarkletInstallChip } from './BookmarkletInstallChip'
import styles from './OnboardingController.module.css'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

type Props = {
  readonly db: DbLike
  readonly motionEnabled: boolean
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
  /** Tag scene camera: push the board view in toward the just-added card (so it
   *  lands centered + enlarged) and reset it afterward. */
  readonly onZoomToCard?: () => void
  readonly onZoomReset?: () => void
}

const SAMPLE_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' // public, long-lived

const TARGET_SELECTOR: Record<OnboardingTarget, string> = {
  'paste-zone': '[data-onboarding-target="paste-zone"]',
  'card-tag': '[data-onboarding-target="card-tag"]',
  card: '[data-onboarding-target="card"]',
  motion: '[data-onboarding-target="motion"]',
  share: '[data-onboarding-target="share"]',
}

// Tag scene cinematic timing: read the caption, then push the camera in toward
// the just-added card, then type the tag on the now-centered card.
const TAG_READ_BEAT_MS = 1500 // read the caption before the camera moves
const TAG_ZOOM_MS = 1200       // camera push-in (matches BoardRoot's 1.1s + buffer)

function extensionDetected(): boolean {
  if (typeof document === 'undefined') return false
  return Boolean(document.documentElement.getAttribute('data-booklage-extension'))
}

export function OnboardingController({
  db, motionEnabled, appUrl, onComplete, onRequestMotionOff, onTagSceneActive,
  tagAddedSignal = 0, onApplySampleTag, onZoomToCard, onZoomReset,
}: Props): ReactElement {
  const { t } = useI18n()
  const [sceneId, setSceneId] = useState<SceneId>('enter')
  const [copied, setCopied] = useState(false)
  // Confirmations: the tag/motion scenes show the RESULT of the action and a
  // NEXT button, so the user sees what happened and proceeds at their own pace
  // (rather than the scene rushing past the moment they act).
  const [tagApplied, setTagApplied] = useState(false)
  // Tag scene plays as: read (caption) -> zoom (camera push-in) -> type (demo).
  const [tagPhase, setTagPhase] = useState<'read' | 'zoom' | 'type'>('read')
  const [motionOn, setMotionOn] = useState(false)
  const scene = sceneById(sceneId)
  const finishingRef = useRef(false)
  const prevMotionRef = useRef(motionEnabled)
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
    onZoomReset?.() // undo any tag-scene camera zoom before tearing down
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
          // Tutorial content — swept when onboarding ends, never left on the board.
          onboardingDemo: true,
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
    setTagPhase('read')
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

  // Tag scene cinematic: read the caption -> push the camera in toward the
  // just-added card -> mount the typed-tag demo on the now-centered card.
  useEffect(() => {
    if (sceneId !== 'tag') return
    const t1 = setTimeout(() => { setTagPhase('zoom'); onZoomToCard?.() }, TAG_READ_BEAT_MS)
    const t2 = setTimeout(() => setTagPhase('type'), TAG_READ_BEAT_MS + TAG_ZOOM_MS)
    return () => { clearTimeout(t1); clearTimeout(t2) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId])

  // If a tag lands before the cinematic reaches the type phase (a real tag-add
  // via the channel, or a fast unit test), jump straight to the result so the
  // confirmation + NEXT are shown rather than swallowed by the read/zoom phase.
  useEffect(() => {
    if (sceneId === 'tag' && tagApplied) setTagPhase('type')
  }, [tagApplied, sceneId])

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
    if (sceneId === 'share') {
      return wrap(<ShareReenactment caption={body} onAdvance={advance} />)
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

  // ---- Tag scene (its own cinematic) ---------------------------------------
  // read/zoom: caption only, the board stays visible while the camera pushes in
  // toward the just-added card. type: the card is centered + enlarged, the
  // spotlight rings it and the typed-tag demo plays on it.
  if (sceneId === 'tag') {
    const advanceFromTag = (): void => { onZoomReset?.(); advance() }
    if (tagPhase !== 'type') {
      return wrap(
        <>
          {/* transparent blocker so the board can't be touched while it zooms */}
          <div className={styles.fullBlocker} />
          <div className={styles.bottomCaption}>{body}</div>
        </>,
      )
    }
    return wrap(
      <OnboardingSpotlight
        targetSelector={TARGET_SELECTOR.card}
        caption={body}
        captionAtBottom
        blockHole
        cardAnchoredSlot={
          <OnboardingTagTyper
            text="sample"
            onApply={() => onApplySampleTag?.()}
            onFinished={() => setTagApplied(true)}
          />
        }
      >
        {tagApplied && (
          <>
            <p className={styles.copiedHint}>{t('board.onboarding.tag.done')}</p>
            <button type="button" className={styles.advanceBtn} onClick={advanceFromTag}>NEXT</button>
          </>
        )}
      </OnboardingSpotlight>,
    )
  }

  // ---- Other hands-on scenes (paste / motion / install) --------------------
  // The motion scene shows the RESULT of the action and only then reveals NEXT.
  // The spotlight hole passes clicks through so the user can operate the real
  // control (paste zone, MOTION toggle).
  const isMotion = sceneId === 'motion'
  return wrap(
    <OnboardingSpotlight
      targetSelector={scene.target ? TARGET_SELECTOR[scene.target] : null}
      caption={body}
      captionAtBottom={isMotion}
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
    </OnboardingSpotlight>,
  )
}
