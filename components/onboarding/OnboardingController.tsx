// components/onboarding/OnboardingController.tsx
'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { IDBPDatabase } from 'idb'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { subscribeBookmarkSaved, subscribeBookmarkUpdated, postBookmarkSaved } from '@/lib/board/channel'
import { markOnboardingComplete } from '@/lib/onboarding/onboarding-state'
import { clearOnboardingDemo } from '@/lib/onboarding/onboarding-demo'
import { MOBILE_SCENE_IDS, nextSceneIdIn, ONBOARDING_SCENES, sceneById, SAMPLE_URL, type SceneId, type OnboardingTarget } from '@/lib/onboarding/steps'
import { addBookmark } from '@/lib/storage/indexeddb'
import { detectUrlType } from '@/lib/utils/url'
import { OnboardingStage } from './OnboardingStage'
import { ExtensionSaveReenactment } from './ExtensionSaveReenactment'
import { ExtensionXSaveReenactment } from './ExtensionXSaveReenactment'
import { OnboardingSpotlight } from './OnboardingSpotlight'
import { OnboardingCursorGuide } from './OnboardingCursorGuide'
import { OnboardingTagDemo } from './OnboardingTagDemo'
import { OnboardingPasteCursor } from './OnboardingPasteCursor'
import { BookmarkletInstallChip } from './BookmarkletInstallChip'
import { BookmarkletSaveReenactment } from './BookmarkletSaveReenactment'
import { PopOutReenactment } from './PopOutReenactment'
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
  /** Start at a specific scene instead of 'enter' (RESUME support). */
  readonly initialScene?: SceneId
}

const TARGET_SELECTOR: Record<OnboardingTarget, string> = {
  'paste-zone': '[data-onboarding-target="paste-zone"]',
  'card-tag': '[data-onboarding-target="card-tag"]',
  card: '[data-onboarding-target="card"]',
  motion: '[data-onboarding-target="motion"]',
  share: '[data-onboarding-target="share"]',
  settings: '[data-onboarding-target="settings"]',
  'quick-tag-toggle': '[data-onboarding-target="quick-tag-toggle"]',
}

// Tag scene beats: the camera pushes in to the just-added card FIRST, then a
// caption rises and holds for reading, then the guided tag-add demo plays.
const TAG_ZOOM_MS = 1300        // camera push-in (BoardRoot's 1.1s + settle buffer)
const TAG_INTRO_READ_MS = 2600  // hold the explanation long enough to read
const TAG_TYPE_CHAR_MS = 140    // ~2.5x the old 55ms — deliberate, readable typing

export function OnboardingController({
  db, motionEnabled, appUrl, onComplete, onRequestMotionOff, onTagSceneActive,
  tagAddedSignal = 0, onApplySampleTag, onZoomToCard, onZoomReset, initialScene,
}: Props): ReactElement {
  const { t } = useI18n()
  const [sceneId, setSceneId] = useState<SceneId>(initialScene ?? 'enter')
  const [copied, setCopied] = useState(false)
  // Confirmations: the tag/motion scenes show the RESULT of the action and a
  // NEXT button, so the user sees what happened and proceeds at their own pace
  // (rather than the scene rushing past the moment they act).
  const [tagApplied, setTagApplied] = useState(false)
  // Tag scene plays as: zoom (camera push-in) -> intro (read the caption) ->
  // demo (guided tag-add) -> done (closing message + NEXT).
  const [tagPhase, setTagPhase] = useState<'zoom' | 'intro' | 'demo' | 'done'>('zoom')
  const tagPhaseRef = useRef(tagPhase)
  tagPhaseRef.current = tagPhase
  const [motionOn, setMotionOn] = useState(false)
  // Install scene plays as two beats. Setup is taught FIRST: 'install' (drag the
  // real bookmarklet chip onto the bookmark bar) → 'demo' (a faithful save
  // re-enactment showing how it's then used). Extension users skip the drag.
  const [installBeat, setInstallBeat] = useState<'demo' | 'install'>('install')
  // Set once the user drags the bookmarklet chip (gesture detected; the actual
  // drop onto the browser's bookmark bar is invisible to the page) → brief
  // "installed!" confirmation, then auto-advance to the save re-enactment.
  const [installDragged, setInstallDragged] = useState(false)
  // Extension demo plays as two beats: 'page' (floating-button save on a normal
  // page) → 'x' (the X bookmark → AllMarks auto-save = famous-site integration).
  const [extBeat, setExtBeat] = useState<'page' | 'x'>('page')
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

  // COPY — copy the sample link to the clipboard so the user can paste it onto
  // the board themselves (Cmd/Ctrl+V), learning the real paste gesture (the
  // point of this scene). Their paste (or their own link) fires bookmark-saved,
  // which advances the scene. If the clipboard API is blocked, fall back to
  // saving the sample directly so the user is never stuck (the visible URL field
  // is also manually selectable as a fallback).
  const copySampleLink = async (): Promise<void> => {
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
    setTagPhase('zoom')
    setMotionOn(false)
    setCopied(false)
    setInstallBeat('install') // setup (drag) is taught first, then the save demo
    setInstallDragged(false)
    setExtBeat('page')
  }, [sceneId])

  // Bookmarklet chip dragged → hold a brief "installed!" beat, then move on to the
  // save re-enactment on its own (no NEXT needed once they've done the gesture).
  useEffect(() => {
    if (!installDragged) return
    const t = setTimeout(() => setInstallBeat('demo'), 1600)
    return () => clearTimeout(t)
  }, [installDragged])

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

  // Tag scene cinematic: push the camera in to the just-added card FIRST, then
  // raise the explanation, then play the guided demo. Guarded setters so an
  // early tag-add (→ 'done') isn't reverted by a late timer.
  useEffect(() => {
    if (sceneId !== 'tag') return
    setTagPhase('zoom')
    onZoomToCard?.()
    const t1 = setTimeout(() => setTagPhase((p) => (p === 'zoom' ? 'intro' : p)), TAG_ZOOM_MS)
    const t2 = setTimeout(() => setTagPhase((p) => (p === 'intro' ? 'demo' : p)), TAG_ZOOM_MS + TAG_INTRO_READ_MS)
    return () => { clearTimeout(t1); clearTimeout(t2) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId])

  // If a tag lands via the cross-context channel (PiP/extension) or a fast unit
  // test before the demo plays, jump straight to the closing 'done' state. Never
  // interrupt the demo itself — it ends by setting 'done' on its own.
  useEffect(() => {
    if (sceneId === 'tag' && tagApplied && tagPhaseRef.current !== 'demo') setTagPhase('done')
  }, [tagApplied, sceneId])

  const body = t(`board.onboarding.${sceneId}.body`)

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
    // ⑤ extension demo — two beats. Beat 'page': the floating save button on a
    // normal page (+ a note that it can be hidden). Beat 'x': the famous-site
    // integration — bookmarking on X auto-saves to AllMarks.
    if (sceneId === 'extDemo') {
      if (extBeat === 'page') {
        return wrap(
          <ExtensionSaveReenactment
            caption={t('board.onboarding.extDemo.body')}
            note={t('board.onboarding.extDemo.hideNote')}
            buttonLabel="NEXT"
            onAdvance={() => setExtBeat('x')}
          />,
        )
      }
      return wrap(
        <ExtensionXSaveReenactment
          caption={t('board.onboarding.extDemo.bodyX')}
          buttonLabel="NEXT"
          onAdvance={advance}
        />,
      )
    }
    if (sceneId === 'share') {
      // Closing beat: just glow the real SHARE button, one caption, NEXT. No
      // real panel, no forced click — the two-stage SHARE flow is self-evident,
      // so the tour only needs to point out where it lives.
      return wrap(
        <>
          <OnboardingSpotlight
            targetSelector={TARGET_SELECTOR.share}
            caption={body}
            captionAtBottom
          >
            <button type="button" className={styles.advanceBtn} onClick={advance}>NEXT</button>
          </OnboardingSpotlight>
          <OnboardingCursorGuide targetSelector={TARGET_SELECTOR.share} />
        </>,
      )
    }
    if (sceneId === 'popout') {
      return wrap(
        <PopOutReenactment
          caption={body}
          buttonLabel="NEXT"
          onAdvance={advance}
        />,
      )
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

    // zoom: the camera pushes in; board stays visible but untouchable.
    if (tagPhase === 'zoom') {
      return wrap(<div className={styles.fullBlocker} />)
    }
    // intro: raise the explanation from the bottom and hold it to be read.
    if (tagPhase === 'intro') {
      return wrap(
        <>
          <div className={styles.fullBlocker} />
          <div className={styles.bottomCaption}>{body}</div>
        </>,
      )
    }
    // demo: only the card is lit (spotlight dims the rest) while the guided
    // tag-add plays on the REAL +TAG button (highlight it → cursor click → menu
    // opens where the real popover would → slow type → chip). OnboardingTagDemo
    // measures the real +TAG itself, so it renders as a sibling overlay.
    if (tagPhase === 'demo') {
      return wrap(
        <>
          <OnboardingSpotlight targetSelector={TARGET_SELECTOR.card} caption="" blockHole />
          <OnboardingTagDemo
            text="sample"
            charMs={TAG_TYPE_CHAR_MS}
            onApply={() => onApplySampleTag?.()}
            onFinished={() => { setTagApplied(true); setTagPhase('done') }}
          />
        </>,
      )
    }
    // done: darken everything, raise the closing "tags organize" message + NEXT.
    return wrap(
      <>
        <div className={styles.fullDim} />
        <div className={styles.bottomCaption}>
          <div>{t('board.onboarding.tag.done')}</div>
          <button type="button" className={styles.advanceBtn} onClick={advanceFromTag}>NEXT</button>
        </div>
      </>,
    )
  }

  // ---- Paste scene — two beats --------------------------------------------
  // No whole-board spotlight (that ringed the entire viewport green and left the
  // board undimmed). Beat A: a dark veil + centered card with a copyable sample
  // URL + COPY button (the URL box is NOT an input on purpose, so the user's
  // Cmd/Ctrl+V still fires the board paste-save). Beat B (after COPY): the veil
  // lifts so the real board brightens, the prompt drops to the bottom, and a
  // demo cursor presses an empty board spot to show where the card will land.
  if (sceneId === 'paste') {
    if (!copied) {
      return wrap(
        <div className={styles.pasteScene}>
          <div className={styles.pasteCard}>
            <p className={styles.pasteCaption}>{body}</p>
            <div className={styles.pasteFieldRow}>
              <span className={styles.pasteUrl} title={SAMPLE_URL}>{SAMPLE_URL}</span>
              <button type="button" className={styles.pasteCopyBtn} onClick={() => void copySampleLink()}>
                COPY
              </button>
            </div>
          </div>
        </div>,
      )
    }
    return wrap(
      <>
        {/* transparent blocker: board is bright + visible but not clickable
            (paste is keyboard, so this never blocks the gesture) */}
        <div className={styles.fullBlocker} />
        <OnboardingPasteCursor />
        <div className={styles.bottomCaption}>{t('board.onboarding.paste.copied')}</div>
      </>,
    )
  }

  // ---- MOTION scene — two beats --------------------------------------------
  // Beat 1: spotlight the MOTION toggle (board dimmed) so the user finds + flips
  // it. Beat 2: once MOTION is on, lift the dim so the now-live board — videos
  // playing, multi-image galleries cycling — is the showcase, then NEXT.
  if (sceneId === 'motion') {
    if (!motionOn) {
      return wrap(
        <>
          <OnboardingSpotlight
            targetSelector={scene.target ? TARGET_SELECTOR[scene.target] : null}
            caption={body}
            captionAtBottom
          />
          {scene.target && <OnboardingCursorGuide targetSelector={TARGET_SELECTOR[scene.target]} />}
        </>,
      )
    }
    return wrap(
      <>
        {/* board fully visible + alive; blocked from interaction (transparent) */}
        <div className={styles.fullBlocker} />
        <div className={styles.bottomCaption}>
          <div>{t('board.onboarding.motion.done')}</div>
          <button type="button" className={styles.advanceBtn} onClick={advance}>NEXT</button>
        </div>
      </>,
    )
  }

  // ---- Install scene — two beats (setup taught FIRST) ----------------------
  // Beat 1 (install): the real draggable chip — the user drops the bookmarklet
  // onto their own (real) bookmark bar. The chip MUST target the user's actual
  // browser chrome, so it can't live in a fake bar; a drop there can't be
  // detected, so NEXT advances. Extension users don't need to install the
  // bookmarklet, so they skip this beat. Beat 2 (demo): a faithful re-enactment
  // of saving WITH it — the cursor clicks the AllMarks bookmarklet in a browser
  // frame's bookmark bar and the REAL save window pops (Saving → Saved →
  // suggested tags). The bookmarklet is a cross-browser save path worth showing
  // EVERYONE (it works where the extension can't — Firefox / Safari / mobile).
  if (installBeat === 'install') {
    // Taught to EVERYONE (no extension branch): the bookmarklet works where the
    // extension can't — Firefox / Safari / mobile. The spotlight hole passes
    // clicks through so the user can drag the real chip onto their bookmark bar.
    // Dragging it (gesture detected via the chip's onDragEnd; the actual drop on
    // the browser chrome is invisible to the page) shows a brief "installed!"
    // and auto-advances to the save re-enactment. NEXT stays as a manual path.
    return wrap(
      <OnboardingSpotlight
        targetSelector={null}
        caption={installDragged ? t('board.onboarding.install.dragged') : body}
      >
        {!installDragged && (
          <BookmarkletInstallChip appUrl={appUrl} onDragComplete={() => setInstallDragged(true)} />
        )}
        <button type="button" className={styles.advanceBtn} onClick={() => setInstallBeat('demo')}>NEXT</button>
      </OnboardingSpotlight>,
    )
  }
  return wrap(
    <BookmarkletSaveReenactment
      caption={t('board.onboarding.install.demoCaption')}
      buttonLabel="NEXT"
      onAdvance={advance}
    />,
  )
}
