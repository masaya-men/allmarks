'use client'

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useSearchParams } from 'next/navigation'
import { initDB, addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { detectUrlType } from '@/lib/utils/url'
import { postBookmarkSaved } from '@/lib/board/channel'
import { loadQuickTagEnabled } from '@/lib/storage/quick-tag-setting'
import { queryPipPresence } from '@/lib/board/pip-presence'
import { planSaveWindow, type SaveOutcome } from '@/lib/bookmarklet/save-window-plan'
import styles from './SaveToast.module.css'

type State = 'saving' | SaveOutcome // 'saving' | 'saved' | 'duplicate' | 'error'

const MIN_SAVING_MS = 400
const LABELS: Record<State, string> = {
  saving: 'Saving', saved: 'Saved', duplicate: 'Already saved', error: 'Failed',
}

function StaggeredLabel({ text }: { text: string }): ReactElement {
  const chars = useMemo(() => Array.from(text), [text])
  return (
    <>
      {chars.map((ch, i) => (
        <span key={`${i}-${ch}`} style={{ animationDelay: `${i * 40}ms` }}>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </>
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function SaveToast(): ReactElement {
  const params = useSearchParams()
  const url = params.get('url') ?? ''
  const title = params.get('title') || url
  const desc = params.get('desc') ?? ''
  const image = params.get('image') ?? ''
  const site = params.get('site') ?? ''
  const favicon = params.get('favicon') ?? ''

  const [state, setState] = useState<State>('saving')
  const startedRef = useRef(false)
  const closeWindow = useRef(() => { try { window.close() } catch { /* blocked */ } }).current

  useEffect(() => {
    if (!url || startedRef.current) return
    startedRef.current = true
    const timers: ReturnType<typeof setTimeout>[] = []

    ;(async (): Promise<void> => {
      try {
        const db = await initDB()
        // Min-saving floor runs concurrently so 'Saving' is always perceived.
        const work = (async (): Promise<{ outcome: SaveOutcome }> => {
          const all = await getAllBookmarks(db)
          const existing = all.find((b) => b.url === url && !b.isDeleted)
          if (existing) return { outcome: 'duplicate' }
          const bm = await addBookmark(db, {
            url, title, description: desc, thumbnail: image, favicon,
            siteName: site, type: detectUrlType(url), tags: [],
          })
          postBookmarkSaved({ bookmarkId: bm.id })
          return { outcome: 'saved' }
        })()
        const [{ outcome }] = await Promise.all([work, delay(MIN_SAVING_MS)])

        const [enabled, pipActive] = await Promise.all([
          loadQuickTagEnabled(db),
          queryPipPresence(80),
        ])
        const plan = planSaveWindow(outcome, enabled, pipActive)
        setState(outcome)
        // Tag rendering + lifecycle land in the next task; for now, when the
        // plan says no tags, auto-close. (plan.showTags is always false until
        // the tag path is wired.)
        if (plan.autoCloseMs !== null) {
          timers.push(setTimeout(closeWindow, plan.autoCloseMs))
        }
      } catch {
        setState('error')
        timers.push(setTimeout(closeWindow, 2400))
      }
    })()

    return () => { for (const tm of timers) clearTimeout(tm) }
  }, [url, title, desc, image, site, favicon, closeWindow])

  if (!url) {
    return (
      <div className={styles.stage} data-state="saving" data-testid="save-toast">
        <div className={styles.glow} />
        <div className={styles.center}>
          <div className={styles.indicator}><div className={styles.ring} data-role="ring" /></div>
          <div className={styles.brand}>AllMarks</div>
          <div className={styles.label} aria-live="polite">
            <StaggeredLabel text="ブックマークレットから開いてください" />
          </div>
        </div>
      </div>
    )
  }

  const labelClass =
    state === 'saved' ? `${styles.label} ${styles.saved}` :
    state === 'duplicate' ? `${styles.label} ${styles.duplicate}` :
    state === 'error' ? `${styles.label} ${styles.error}` :
    styles.label

  return (
    <div className={styles.stage} data-state={state} data-testid="save-toast">
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
        <div className={labelClass} aria-live="polite">{LABELS[state]}</div>
      </div>
    </div>
  )
}
