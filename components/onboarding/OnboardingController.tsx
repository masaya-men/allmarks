// components/onboarding/OnboardingController.tsx
'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { IDBPDatabase } from 'idb'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { subscribeBookmarkSaved, subscribeBookmarkUpdated, postBookmarkSaved } from '@/lib/board/channel'
import { markOnboardingComplete } from '@/lib/onboarding/onboarding-state'
import { clearOnboardingDemo } from '@/lib/onboarding/onboarding-demo'
import { nextSceneId, sceneById, type SceneId, type OnboardingTarget } from '@/lib/onboarding/steps'
import { addBookmark } from '@/lib/storage/indexeddb'
import { detectUrlType } from '@/lib/utils/url'
import { OnboardingStage } from './OnboardingStage'
import { ExtensionSaveReenactment } from './ExtensionSaveReenactment'
import { OnboardingSpotlight } from './OnboardingSpotlight'
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
}

const SAMPLE_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' // public, long-lived

const TARGET_SELECTOR: Record<OnboardingTarget, string> = {
  'paste-zone': '[data-onboarding-target="paste-zone"]',
  'card-tag': '[data-onboarding-target="card-tag"]',
  motion: '[data-onboarding-target="motion"]',
  share: '[data-onboarding-target="share"]',
}

function extensionDetected(): boolean {
  if (typeof document === 'undefined') return false
  return Boolean(document.documentElement.getAttribute('data-booklage-extension'))
}

export function OnboardingController({
  db, motionEnabled, sharePanelOpen, appUrl, onComplete, onRequestMotionOff, onTagSceneActive,
}: Props): ReactElement {
  const { t } = useI18n()
  const [sceneId, setSceneId] = useState<SceneId>('enter')
  const scene = sceneById(sceneId)
  const finishingRef = useRef(false)
  const prevMotionRef = useRef(motionEnabled)
  const prevShareRef = useRef(sharePanelOpen)

  const advance = (): void => {
    const next = nextSceneId(sceneId)
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

  // TRY THIS — create a REAL (non-demo) bookmark that persists as the user's
  // first card. The bookmark-saved event advances the paste scene; the user
  // pasting their own URL also fires it, so both paths work.
  const saveSample = async (): Promise<void> => {
    const created = await addBookmark(db, {
      url: SAMPLE_URL, title: '', description: '', thumbnail: '', favicon: '',
      siteName: '', type: detectUrlType(SAMPLE_URL),
    })
    postBookmarkSaved({ bookmarkId: created.id })
  }

  // Event-driven advances. Each effect is scoped to the scene that needs it.
  useEffect(() => {
    if (scene.advance !== 'saved') return
    return subscribeBookmarkSaved(() => advance())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId])

  useEffect(() => {
    if (scene.advance !== 'tagged') return
    return subscribeBookmarkUpdated(() => advance())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId])

  useEffect(() => {
    const was = prevMotionRef.current
    prevMotionRef.current = motionEnabled
    if (scene.advance === 'motion' && !was && motionEnabled) advance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionEnabled, sceneId])

  useEffect(() => {
    const was = prevShareRef.current
    prevShareRef.current = sharePanelOpen
    if (scene.advance === 'sharePanel' && !was && sharePanelOpen) advance()
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
  // tag scene (the user can't hover precisely through the spotlight hole).
  useEffect(() => {
    onTagSceneActive?.(sceneId === 'tag')
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

  // ---- Hands-on scenes -----------------------------------------------------
  return wrap(
    <OnboardingSpotlight
      targetSelector={scene.target ? TARGET_SELECTOR[scene.target] : null}
      caption={body}
    >
      {sceneId === 'paste' && (
        <button type="button" className={styles.tryThis} onClick={() => void saveSample()}>
          TRY THIS
        </button>
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
