// components/onboarding/OnboardingController.tsx
'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { IDBPDatabase } from 'idb'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { subscribeBookmarkSaved, subscribeBookmarkUpdated } from '@/lib/board/channel'
import { markOnboardingComplete } from '@/lib/onboarding/onboarding-state'
import { clearOnboardingDemo } from '@/lib/onboarding/onboarding-demo'
import { nextSceneId, sceneById, type SceneId } from '@/lib/onboarding/steps'
import styles from './OnboardingController.module.css'

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

type Props = {
  readonly db: DbLike
  readonly motionEnabled: boolean
  readonly sharePanelOpen: boolean
  readonly onComplete: () => void
}

export function OnboardingController({
  db, motionEnabled, sharePanelOpen, onComplete,
}: Props): ReactElement {
  const { t } = useI18n()
  const [sceneId, setSceneId] = useState<SceneId>('enter')
  const scene = sceneById(sceneId)
  const finishingRef = useRef(false)

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
    if (scene.advance === 'motion' && motionEnabled) advance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionEnabled, sceneId])

  useEffect(() => {
    if (scene.advance === 'sharePanel' && sharePanelOpen) advance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharePanelOpen, sceneId])

  const buttonLabel = sceneId === 'enter' ? 'START' : 'NEXT'

  return (
    <div className={styles.root} data-testid="onboarding-root">
      <button type="button" className={styles.skip} onClick={() => void finish()}>
        SKIP
      </button>

      {/* Placeholder scenes — Phase 2 swaps in OnboardingStage / Spotlight /
          ExtensionSaveReenactment per scene.kind. */}
      <div data-testid={`scene-${sceneId}`}>
        <p className={styles.placeholderCopy}>
          {t(`board.onboarding.${sceneId}.body`)}
        </p>
        {scene.advance === 'button' && (
          <button type="button" className={styles.advanceBtn} onClick={advance}>
            {buttonLabel}
          </button>
        )}
      </div>
    </div>
  )
}
