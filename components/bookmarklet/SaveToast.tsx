'use client'

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useSearchParams } from 'next/navigation'
import { initDB, getAllBookmarks, saveBookmarkDeduped } from '@/lib/storage/indexeddb'
import type { BookmarkRecord, TagRecord } from '@/lib/storage/indexeddb'
import { detectUrlType } from '@/lib/utils/url'
import { postBookmarkSaved } from '@/lib/board/channel'
import { loadQuickTagEnabled } from '@/lib/storage/quick-tag-setting'
import { loadFullscreenNoticeSeen, markFullscreenNoticeSeen } from '@/lib/storage/fullscreen-save-notice'
import { resolveInitialLocale } from '@/lib/i18n/locale-store'
import { getFullscreenSaveCopy } from '@/lib/bookmarklet/save-fullscreen-copy'
import { queryPipPresence } from '@/lib/board/pip-presence'
import {
  planSaveWindow,
  isOpenedAsTab,
  type SaveOutcome,
  type SaveWindowMode,
  ERROR_AUTOCLOSE_MS,
} from '@/lib/bookmarklet/save-window-plan'
import { getAllTags } from '@/lib/storage/tags'
import { orderTagsForSave } from '@/lib/tagger/order-tags-for-save'
import { applyExistingQuickTag, applyNewQuickTag } from '@/lib/tagger/quick-tag-apply'
import { TagAddPopover, type SuggestionEntry } from '@/components/board/TagAddPopover'
import styles from './SaveToast.module.css'

type State = 'saving' | SaveOutcome // 'saving' | 'saved' | 'duplicate' | 'error'

const MIN_SAVING_MS = 400
const UNTOUCHED_CLOSE_MS = 5000
const LEAVE_GRACE_MS = 600
const LABELS: Record<State, string> = {
  saving: 'Saving', saved: 'Saved', duplicate: 'Already saved', error: 'Failed',
}

interface TagData {
  bookmarkId: string
  allTags: TagRecord[]
  currentTagIds: string[]
  suggestedEntries: SuggestionEntry[]
}

function StaggeredLabel({ text }: { text: string }): ReactElement {
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
  const [tagData, setTagData] = useState<TagData | null>(null)
  const [mode, setMode] = useState<SaveWindowMode>('normal')
  const startedRef = useRef(false)
  // Cache the db instance so tag handlers can use it without re-awaiting initDB each time.
  const dbRef = useRef<Awaited<ReturnType<typeof initDB>> | null>(null)
  const closeWindow = useRef(() => { try { window.close() } catch { /* blocked */ } }).current

  const untouchedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const engagedRef = useRef(false)

  useEffect(() => {
    if (!url || startedRef.current) return
    startedRef.current = true
    const timers: ReturnType<typeof setTimeout>[] = []

    ;(async (): Promise<void> => {
      try {
        const db = await initDB()
        dbRef.current = db
        // work now returns { outcome, bm } — the full BookmarkRecord so
        // orderTagsForSave gets the real object without casting.
        const work = (async (): Promise<{ outcome: SaveOutcome; bm: BookmarkRecord }> => {
          const result = await saveBookmarkDeduped(db, {
            url, title, description: desc, thumbnail: image, favicon,
            siteName: site, type: detectUrlType(url), tags: [],
          }, { dedupe: true })
          // The bookmarklet only ever saves the page the user is actually on
          // (always http/https), so invalid-url is a guard, not a real path —
          // surface it as the error state rather than a fake success.
          if (result.outcome === 'invalid-url') throw new Error('Unsupported URL scheme')
          if (result.outcome === 'saved') postBookmarkSaved({ bookmarkId: result.bookmark.id })
          return { outcome: result.outcome, bm: result.bookmark }
        })()
        const [{ outcome, bm }] = await Promise.all([work, delay(MIN_SAVING_MS)])

        // macOS Chrome opens window.open popups as full tabs when in fullscreen;
        // the /save page detects that by its own (large) viewport and adapts.
        const openedAsTab = isOpenedAsTab({ innerWidth: window.innerWidth, innerHeight: window.innerHeight })
        const [enabled, pipActive, noticeSeen] = await Promise.all([
          loadQuickTagEnabled(db),
          queryPipPresence(80),
          loadFullscreenNoticeSeen(db),
        ])
        const plan = planSaveWindow(outcome, enabled, pipActive, openedAsTab, noticeSeen)
        setMode(plan.mode)

        if (plan.showTags) {
          const [corpus, allTags] = await Promise.all([getAllBookmarks(db), getAllTags(db)])
          const ordered = orderTagsForSave(bm, corpus, allTags)
          setTagData({
            bookmarkId: bm.id,
            allTags,
            currentTagIds: [...bm.tags],
            suggestedEntries: ordered.slice(0, 5).map((tg) => ({ kind: 'existing' as const, tagId: tg.id })),
          })
        }
        // Show the fullscreen explanation only once — record it now so the next
        // forced-tab save stays quiet (mode becomes 'tab-confirm').
        if (plan.mode === 'tab-explain') {
          void markFullscreenNoticeSeen(db)
        }

        setState(outcome)
        if (plan.autoCloseMs !== null) {
          timers.push(setTimeout(closeWindow, plan.autoCloseMs))
        }
      } catch {
        setState('error')
        timers.push(setTimeout(closeWindow, ERROR_AUTOCLOSE_MS))
      }
    })()

    return () => { for (const tm of timers) clearTimeout(tm) }
  }, [url, title, desc, image, site, favicon, closeWindow])

  // Lifecycle effect: when tag UI is shown, start the untouched auto-close
  // timer and listen for keydown to engage. Only active while tagData is set.
  useEffect(() => {
    if (!tagData) return
    untouchedTimerRef.current = setTimeout(() => {
      if (!engagedRef.current) closeWindow()
    }, UNTOUCHED_CLOSE_MS)
    function onKeyDown(): void { engage() }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (untouchedTimerRef.current) clearTimeout(untouchedTimerRef.current)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagData, closeWindow])

  function engage(): void {
    engagedRef.current = true
    if (untouchedTimerRef.current) { clearTimeout(untouchedTimerRef.current); untouchedTimerRef.current = null }
    if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null }
  }

  function handleLeave(e: React.PointerEvent<HTMLDivElement>): void {
    if (!engagedRef.current) return
    const input = e.currentTarget.querySelector('input')
    if (input && input.value.trim() !== '') return // mid-compose: keep open
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    leaveTimerRef.current = setTimeout(closeWindow, LEAVE_GRACE_MS)
  }

  async function handleAddExisting(tagId: string): Promise<void> {
    if (!tagData) return
    if (tagData.currentTagIds.includes(tagId)) return
    const db = dbRef.current ?? (await initDB())
    await applyExistingQuickTag(db, tagData.bookmarkId, tagId)
    setTagData((d) => d ? { ...d, currentTagIds: [...d.currentTagIds, tagId] } : d)
  }

  async function handleAddNew(name: string): Promise<void> {
    if (!tagData) return
    const db = dbRef.current ?? (await initDB())
    const tag = await applyNewQuickTag(db, tagData.bookmarkId, name, tagData.allTags)
    if (!tag) return
    const fresh = await getAllTags(db)
    setTagData((d) => d ? {
      ...d, allTags: fresh,
      currentTagIds: d.currentTagIds.includes(tag.id) ? d.currentTagIds : [...d.currentTagIds, tag.id],
    } : d)
  }

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

  // Fullscreen forced-tab render: macOS Chrome opened us as a full tab. Show a
  // calm centered card (never a stretched stage) — tag UI is intentionally
  // absent here (tag later on the board).
  if (mode === 'tab-explain' || mode === 'tab-confirm' || mode === 'tab-minimal') {
    const compact = mode === 'tab-minimal'
    // Localize the explanation to the board's chosen locale (/save isn't inside
    // I18nProvider — read the same localStorage the board persists).
    const fsCopy = mode === 'tab-explain' ? getFullscreenSaveCopy(resolveInitialLocale()) : null
    return (
      <div
        className={`${styles.stage} ${styles.tabStage}`}
        data-state={state}
        data-mode={mode}
        data-testid="save-tab-fullscreen"
      >
        <div className={`${styles.tabCard} ${compact ? styles.tabCardCompact : ''}`}>
          <div className={styles.indicator}>
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
          </div>
          <div className={styles.brand}>AllMarks</div>
          <div className={labelClass} aria-label={LABELS[state]} aria-live="polite" data-testid="status-label">
            <StaggeredLabel text={LABELS[state]} />
          </div>
          {fsCopy && (
            <div className={styles.fsNotice} data-testid="fs-notice">
              <div className={styles.fsHeading}>{fsCopy.heading}</div>
              <p className={styles.fsBody}>{fsCopy.intro}</p>
              <ul className={styles.fsList}>
                {fsCopy.bullets.map((b, i) => (
                  <li key={i}><b>{b.lead}</b> — {b.rest}</li>
                ))}
              </ul>
              <p className={styles.fsBody}>{fsCopy.tagNote}</p>
              <button type="button" className={styles.fsGotIt} data-testid="fs-got-it" onClick={closeWindow}>
                GOT IT
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Tag-window render: confirmation block + tag UI + ✕ close
  if (tagData) {
    return (
      <div
        className={`${styles.stage} ${styles.tagStage}`}
        data-state={state}
        data-testid="save-tag-window"
        onPointerEnter={engage}
        onPointerLeave={handleLeave}
      >
        <button
          type="button"
          className={styles.tagClose}
          data-testid="save-tag-close"
          aria-label="close"
          onClick={closeWindow}
        >
          ✕
        </button>
        <div className={styles.tagHeader}>
          <div className={`${styles.indicator} ${styles.indicatorSmall}`}>
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
          <div className={styles.tagHeaderText}>
            <span className={styles.brandInline}>AllMarks</span>
            <span className={`${labelClass} ${styles.labelInline}`} aria-label={LABELS[state]} aria-live="polite" data-testid="status-label">
              <StaggeredLabel text={LABELS[state]} />
            </span>
          </div>
        </div>
        <div className={styles.tagScroll}>
          <TagAddPopover
            compact
            allTags={tagData.allTags}
            currentTagIds={tagData.currentTagIds}
            suggestedEntries={tagData.suggestedEntries}
            onAddExisting={(id) => { void handleAddExisting(id) }}
            onAddNew={(name) => { void handleAddNew(name) }}
            onClose={() => { /* lifecycle owns dismissal */ }}
          />
        </div>
      </div>
    )
  }

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
        <div className={labelClass} aria-label={LABELS[state]} aria-live="polite" data-testid="status-label">
          <StaggeredLabel text={LABELS[state]} />
        </div>
      </div>
    </div>
  )
}
