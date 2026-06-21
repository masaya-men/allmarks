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
import { ExtensionXSaveReenactment } from './ExtensionXSaveReenactment'
import { OnboardingShareReveal } from './OnboardingShareReveal'
import { OnboardingSpotlight } from './OnboardingSpotlight'
import { OnboardingCursorGuide } from './OnboardingCursorGuide'
import { OnboardingTagDemo } from './OnboardingTagDemo'
import { OnboardingPasteCursor } from './OnboardingPasteCursor'
import { BookmarkletInstallChip } from './BookmarkletInstallChip'
import { BookmarkletSaveReenactment } from './BookmarkletSaveReenactment'
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
  /** Share scene: open/close the REAL share panel (BoardRoot's SenderShareModal)
   *  so the tutorial shows the genuine share screen (non-interactive) rather
   *  than a re-enactment. Never confirms the share, so no server share is made. */
  readonly onShareSceneActive?: (active: boolean) => void
  /** Start at a specific scene instead of 'enter'. Used to RESUME the tutorial
   *  after the manage scene navigates out to the real /triage screen and back. */
  readonly initialScene?: SceneId
}

const SAMPLE_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' // public, long-lived

const TARGET_SELECTOR: Record<OnboardingTarget, string> = {
  'paste-zone': '[data-onboarding-target="paste-zone"]',
  'card-tag': '[data-onboarding-target="card-tag"]',
  card: '[data-onboarding-target="card"]',
  motion: '[data-onboarding-target="motion"]',
  share: '[data-onboarding-target="share"]',
  manage: '[data-onboarding-target="manage"]',
  settings: '[data-onboarding-target="settings"]',
}

// Tag scene beats: the camera pushes in to the just-added card FIRST, then a
// caption rises and holds for reading, then the guided tag-add demo plays.
const TAG_ZOOM_MS = 1300        // camera push-in (BoardRoot's 1.1s + settle buffer)
const TAG_INTRO_READ_MS = 2600  // hold the explanation long enough to read
const TAG_TYPE_CHAR_MS = 140    // ~2.5x the old 55ms — deliberate, readable typing

function extensionDetected(): boolean {
  if (typeof document === 'undefined') return false
  return Boolean(document.documentElement.getAttribute('data-booklage-extension'))
}

export function OnboardingController({
  db, motionEnabled, appUrl, onComplete, onRequestMotionOff, onTagSceneActive,
  tagAddedSignal = 0, onApplySampleTag, onZoomToCard, onZoomReset, onShareSceneActive,
  initialScene,
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
  // Install scene plays as two beats: 'demo' (a faithful save re-enactment) →
  // 'install' (the real draggable bookmarklet chip).
  const [installBeat, setInstallBeat] = useState<'demo' | 'install'>('demo')
  // Extension demo plays as two beats: 'page' (floating-button save on a normal
  // page) → 'x' (the X bookmark → AllMarks auto-save = famous-site integration).
  const [extBeat, setExtBeat] = useState<'page' | 'x'>('page')
  // Manage scene plays as two beats: 'settings' (point at SETTINGS — the save
  // window can be turned off there) → 'manage' (point at MANAGE TAGS → triage).
  const [manageBeat, setManageBeat] = useState<'settings' | 'manage'>('settings')
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
    setInstallBeat('demo')
    setExtBeat('page')
    setManageBeat('settings')
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
      return wrap(
        <OnboardingShareReveal
          caption={body}
          onOpenModal={() => onShareSceneActive?.(true)}
          onCloseModal={() => onShareSceneActive?.(false)}
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

  // ---- Manage scene -------------------------------------------------------
  // Spotlight the real MANAGE TAGS button. The caption notes the save window
  // can be turned off in SETTINGS and that bulk tagging lives behind MANAGE
  // TAGS. Clicking the real button (through the spotlight hole) navigates to the
  // genuine /triage screen in onboarding mode (BoardRoot routes it there + sets
  // the resume flag); the tutorial resumes at the share scene on return. NEXT
  // skips straight ahead for anyone who doesn't want the detour.
  if (sceneId === 'manage') {
    // Beat 'settings': point at SETTINGS — the save window can be turned off
    // there (explanation only; advance with NEXT). Beat 'manage': point at
    // MANAGE TAGS — clicking the real button (through the spotlight hole) opens
    // the genuine /triage; NEXT skips the detour.
    if (manageBeat === 'settings') {
      return wrap(
        <>
          <OnboardingSpotlight
            targetSelector={TARGET_SELECTOR.settings}
            caption={t('board.onboarding.manage.settingsBody')}
          >
            <button type="button" className={styles.advanceBtn} onClick={() => setManageBeat('manage')}>NEXT</button>
          </OnboardingSpotlight>
          <OnboardingCursorGuide targetSelector={TARGET_SELECTOR.settings} />
        </>,
      )
    }
    return wrap(
      <>
        <OnboardingSpotlight targetSelector={TARGET_SELECTOR.manage} caption={t('board.onboarding.manage.body')}>
          <button type="button" className={styles.advanceBtn} onClick={advance}>NEXT</button>
        </OnboardingSpotlight>
        <OnboardingCursorGuide targetSelector={TARGET_SELECTOR.manage} />
      </>,
    )
  }

  // ---- Install scene — two beats ------------------------------------------
  // Beat 1 (demo): a faithful re-enactment of saving with the bookmarklet — the
  // cursor clicks the AllMarks bookmarklet in a browser frame's bookmark bar and
  // the REAL save window pops (Saving → Saved → suggested tags). It shows the
  // VALUE before asking for the action. This beat plays for EVERYONE, including
  // people who already have the extension: the bookmarklet is a cross-browser
  // save path worth teaching (it works where the extension can't — Firefox /
  // Safari / mobile). Beat 2 (install): the real draggable chip so the user
  // drops the bookmarklet onto their own (real) bookmark bar — the chip MUST
  // target the user's actual browser chrome, so it can't live in the demo's fake
  // bar. Extension users don't need the drag, so they advance straight from the
  // demo; everyone else gets the drag beat.
  if (installBeat === 'demo') {
    return wrap(
      <BookmarkletSaveReenactment
        caption={t('board.onboarding.install.demoCaption')}
        buttonLabel="NEXT"
        onAdvance={() => { if (installDetected) { advance() } else { setInstallBeat('install') } }}
      />,
    )
  }
  // The spotlight hole passes clicks through so the user can drag the real chip.
  return wrap(
    <OnboardingSpotlight targetSelector={null} caption={body}>
      <BookmarkletInstallChip appUrl={appUrl} />
      <button type="button" className={styles.advanceBtn} onClick={advance}>NEXT</button>
    </OnboardingSpotlight>,
  )
}
