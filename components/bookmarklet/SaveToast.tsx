'use client'

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useSearchParams } from 'next/navigation'
import { initDB, addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { getAllTags } from '@/lib/storage/tags'
import { detectUrlType } from '@/lib/utils/url'
import { postBookmarkSaved } from '@/lib/board/channel'
import { loadQuickTagEnabled } from '@/lib/storage/quick-tag-setting'
import { queryPipPresence } from '@/lib/board/pip-presence'
import { shouldShowQuickTagWindow, applyExistingQuickTag, applyNewQuickTag } from '@/lib/tagger/quick-tag-apply'
import { orderTagsForSave } from '@/lib/tagger/order-tags-for-save'
import { t } from '@/lib/i18n/t'
import type { TagRecord } from '@/lib/storage/indexeddb'
import type { SuggestionEntry } from '@/components/board/TagAddPopover'
import { TagAddPopover } from '@/components/board/TagAddPopover'
import styles from './SaveToast.module.css'

type State = 'saving' | 'saved' | 'recede' | 'error' | 'tags'

interface TagData {
  bookmarkId: string
  allTags: TagRecord[]
  currentTagIds: string[]
  suggestedEntries: SuggestionEntry[]
}

const ERROR_CLOSE_MS = 2600
// Bookmarklet popup is purely a bridge to write IDB in the {booklage,
// booklage} partition; visible feedback lives in the host-page toast that
// the bookmarklet IIFE injects. So we close the popup as fast as Chrome
// will allow after the IDB write completes.
const FAST_CLOSE_MS = 80
const TAG_WIN_W = 280
const TAG_WIN_H = 360
const UNTOUCHED_CLOSE_MS = 5000
const LEAVE_GRACE_MS = 600

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
  const savedRef = useRef(false)

  const closeWindow = useRef(() => { try { window.close() } catch { /* blocked */ } }).current

  const untouchedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const engagedRef = useRef(false)

  useEffect(() => {
    if (state !== 'tags') return
    untouchedTimerRef.current = setTimeout(() => {
      if (!engagedRef.current) closeWindow()
    }, UNTOUCHED_CLOSE_MS)
    return () => {
      if (untouchedTimerRef.current) clearTimeout(untouchedTimerRef.current)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    }
  }, [state, closeWindow])

  function engage(): void {
    engagedRef.current = true
    if (untouchedTimerRef.current) { clearTimeout(untouchedTimerRef.current); untouchedTimerRef.current = null }
    if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null }
  }

  function handleLeave(e: React.PointerEvent<HTMLDivElement>): void {
    if (!engagedRef.current) return
    const input = e.currentTarget.querySelector('input')
    if (input && input.value.trim() !== '') return
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    leaveTimerRef.current = setTimeout(closeWindow, LEAVE_GRACE_MS)
  }

  async function handleAddExisting(tagId: string): Promise<void> {
    if (!tagData) return
    if (tagData.currentTagIds.includes(tagId)) return  // already applied — no redundant write/broadcast (matches PipCompanion)
    await applyExistingQuickTag(await initDB(), tagData.bookmarkId, tagId)
    setTagData((d) => d ? { ...d, currentTagIds: [...d.currentTagIds, tagId] } : d)
  }

  async function handleAddNew(name: string): Promise<void> {
    if (!tagData) return
    const db = await initDB()
    const tag = await applyNewQuickTag(db, tagData.bookmarkId, name, tagData.allTags)
    if (!tag) return
    const fresh = await getAllTags(db)
    setTagData((d) => d ? {
      ...d, allTags: fresh,
      currentTagIds: d.currentTagIds.includes(tag.id) ? d.currentTagIds : [...d.currentTagIds, tag.id],
    } : d)
  }

  useEffect(() => {
    if (!url || savedRef.current) return
    savedRef.current = true
    const timers: ReturnType<typeof setTimeout>[] = []

    ;(async (): Promise<void> => {
      try {
        const db = await initDB()
        const bm = await addBookmark(db, {
          url,
          title,
          description: desc,
          thumbnail: image,
          favicon,
          siteName: site,
          type: detectUrlType(url),
          tags: [],
        })
        postBookmarkSaved({ bookmarkId: bm.id })

        // Branch: show quick-tag window when feature is ON and no PiP is open.
        // Otherwise fast-close as before (PiP already provides the tag surface,
        // or the feature is disabled).
        const enabled = await loadQuickTagEnabled(db)
        if (enabled) {
          const pipActive = await queryPipPresence(80)
          if (shouldShowQuickTagWindow(enabled, pipActive)) {
            const [corpus, allTags] = await Promise.all([getAllBookmarks(db), getAllTags(db)])
            const ordered = orderTagsForSave(bm, corpus, allTags)
            setTagData({
              bookmarkId: bm.id,
              allTags,
              currentTagIds: [...bm.tags],
              suggestedEntries: ordered.slice(0, 5).map((t) => ({ kind: 'existing' as const, tagId: t.id })),
            })
            try { window.resizeTo(TAG_WIN_W, TAG_WIN_H) } catch { /* popup may refuse */ }
            setState('tags')
            return
          }
        }

        // Default: fast-close (feature OFF, or PiP open) — unchanged behavior.
        // The bookmarklet IIFE injects a Shadow-DOM toast into the user's host
        // page (saving → saved → fade out) that owns the visible feedback now.
        // The popup is just a bridge to write IDB in the partition, so it has
        // no UI responsibility — keep it on screen as briefly as Chrome will
        // allow. Same closing path whether PiP is open or not; PiP slide-in
        // animation provides additional feedback when present, parent toast
        // covers the no-PiP case.
        timers.push(setTimeout(() => {
          try { window.close() } catch { /* browser blocked */ }
        }, FAST_CLOSE_MS))
      } catch {
        // Hard error path — keep the original error toast so the user
        // sees the failure even if their host page's toast was ephemeral.
        setState('error')
        timers.push(setTimeout(() => {
          try { window.close() } catch { /* ignore */ }
        }, ERROR_CLOSE_MS))
      }
    })()

    return () => { for (const tm of timers) clearTimeout(tm) }
  }, [url, title, desc, image, site, favicon])

  if (!url) {
    return (
      <div className={styles.stage} data-state="saving" data-testid="save-toast">
        <div className={styles.glow} />
        <div className={styles.center}>
          <div className={styles.indicator}>
            <div className={styles.ring} data-role="ring" />
          </div>
          <div className={styles.brand}>AllMarks</div>
          <div className={styles.label} aria-live="polite">
            <StaggeredLabel text="ブックマークレットから開いてください" />
          </div>
        </div>
      </div>
    )
  }

  // Tag mode — render the compact tag menu in the /save popup window.
  if (state === 'tags' && tagData) {
    return (
      <div
        className={styles.tagStage}
        data-state="tags"
        data-testid="save-tag-window"
        onPointerEnter={engage}
        onKeyDownCapture={engage}
        onPointerLeave={handleLeave}
      >
        <button
          type="button"
          className={styles.tagClose}
          data-testid="save-tag-close"
          aria-label="close"
          onClick={closeWindow}
        >✕</button>
        <TagAddPopover
          compact
          allTags={tagData.allTags}
          currentTagIds={tagData.currentTagIds}
          suggestedEntries={tagData.suggestedEntries}
          onAddExisting={(tagId) => { void handleAddExisting(tagId) }}
          onAddNew={(name) => { void handleAddNew(name) }}
          onClose={() => { /* lifecycle owns dismissal; popover Esc is a no-op here */ }}
        />
      </div>
    )
  }

  // During the decision phase (saving/saved/recede), show a blank placeholder.
  // Visible save feedback is already provided by the Shadow-DOM toast that the
  // bookmarklet IIFE injects into the host page — the popup window is just an
  // IDB-write bridge and must not flash distracting content before closing or
  // transforming into the tag window.
  if (state === 'saving' || state === 'saved' || state === 'recede') {
    return (
      <div
        className={styles.blank}
        data-state={state}
        data-testid="save-toast"
        aria-hidden="true"
      />
    )
  }

  return (
    <div className={styles.stage} data-state={state} data-testid="save-toast">
      <div className={styles.glow} />
      <div className={styles.center}>
        <div className={styles.indicator}>
          {state === 'error' && (
            <div
              className={styles.errorMark}
              role="img"
              aria-label={t('bookmarklet.toast.error')}
              data-role="error-mark"
            >!</div>
          )}
        </div>
        <div className={styles.brand}>AllMarks</div>
        <div className={`${styles.label} ${styles.error}`} aria-live="polite">
          <StaggeredLabel text={t('bookmarklet.toast.error')} />
        </div>
      </div>
    </div>
  )
}
