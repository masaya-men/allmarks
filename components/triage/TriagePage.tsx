'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBoardData } from '@/lib/storage/use-board-data'
import { useTags } from '@/lib/storage/use-tags'
import { t } from '@/lib/i18n/t'
import { TriageCard } from './TriageCard'
import { TopTagStrip, useTagPickerKeys } from './TagPicker'
import { AmbientBackdrop, type SwipeDecision } from './AmbientBackdrop'
import styles from './TriagePage.module.css'

type TriageMode = 'untagged' | 'all' | { tagId: string }

const SWIPE_ANIM_MS = 360
const DRAG_THRESHOLD_PX = 60

function parseMode(raw: string | null): TriageMode | null {
  if (!raw) return null
  if (raw === 'untagged') return 'untagged'
  if (raw === 'all') return 'all'
  if (raw.startsWith('tag:')) return { tagId: raw.slice(4) }
  return null
}

export function TriagePage(): ReactElement {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = parseMode(searchParams.get('mode'))
  const { items, persistTags, loading } = useBoardData()
  const { tags, create } = useTags()

  const untaggedItems = useMemo(() => items.filter((it) => !it.isDeleted && it.tags.length === 0), [items])
  const allItems = useMemo(() => items.filter((it) => !it.isDeleted), [items])

  // No mode in the URL = come straight from the board. Redirect into the
  // appropriate triage mode: untagged backlog if there is one, otherwise
  // fall through to "all" so the user can revisit existing tags on every
  // card. The replace (not push) keeps the back button sensible.
  useEffect(() => {
    if (mode !== null) return
    if (loading) return
    const target = untaggedItems.length === 0 ? 'all' : 'untagged'
    router.replace(`/triage?mode=${target}`)
  }, [mode, loading, untaggedItems.length, router])

  const queue = useMemo(() => {
    if (mode === 'untagged') return untaggedItems
    if (mode === 'all') return allItems
    if (mode && typeof mode === 'object') {
      return items.filter((it) => !it.isDeleted && it.tags.includes(mode.tagId))
    }
    return []
  }, [mode, untaggedItems, allItems, items])

  // Review mode = the user is editing existing tag assignments (= 'all'
  // or a single 'tag:X' filter), so pre-arm the chips with the current
  // card's existing tags every time the cursor moves. The user can then
  // remove / add chips and a Yes swipe stores the armed set as the new
  // tag list. In 'untagged' mode this would defeat the rapid-fire combo
  // feature (= keep your armed combo across cards while filling an
  // empty backlog), so we skip the sync there.
  const isReviewMode = mode === 'all' || (typeof mode === 'object' && mode !== null)

  const [index, setIndex] = useState(0)
  const [lastAction, setLastAction] = useState<{ bookmarkId: string; prev: readonly string[] } | null>(null)
  const [exitDecision, setExitDecision] = useState<SwipeDecision | null>(null)
  const [armedTagIds, setArmedTagIds] = useState<ReadonlySet<string>>(() => new Set())

  const current = queue[index] ?? null
  const total = queue.length

  /* Session 80 continuous-slide: while a swipe animation is playing
     (exitDecision != null), render the NEXT card alongside the
     current one. The incoming card enters from the side opposite to
     the exit direction so the two appear as one continuous pan.
       - Yes (= card exits right) → incoming enters from LEFT
       - No  (= card exits left)  → incoming enters from RIGHT
     */
  const incoming = (exitDecision && queue[index + 1]) ? queue[index + 1] : null
  const incomingDirection: 'from-right' | 'from-left' = exitDecision === 'yes' ? 'from-left' : 'from-right'

  // Pre-arm the chip strip with the current card's existing tags whenever
  // the cursor moves into review mode (= 'all' or single 'tag:X'). The
  // user can then toggle chips off (= remove a tag) or on (= add a tag),
  // and a Yes swipe stores the armed set verbatim. Skipped in 'untagged'
  // mode so the rapid-fire combo workflow keeps the armed set across
  // cards (= session 79 design).
  const currentBookmarkId = current?.bookmarkId
  const currentTagsKey = current?.tags.join(',') ?? ''
  useEffect(() => {
    if (!isReviewMode) return
    if (!currentBookmarkId) return
    setArmedTagIds(new Set(current?.tags ?? []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBookmarkId, currentTagsKey, isReviewMode])

  const toggleArmed = useCallback((tagId: string): void => {
    setArmedTagIds((prev) => {
      const next = new Set(prev)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
  }, [])

  /** Yes: apply ALL armed tags (union with the card's existing tags so we
   *  never silently strip pre-existing tags in `all` mode) + advance.
   *  Yes always advances; if nothing armed, it's equivalent to No (a skip),
   *  which is clearer than swallowing the key silently.
   *
   *  Only Yes-with-tags sets lastAction (= undo target). No swipes and
   *  no-tag Yes swipes leave lastAction untouched so the user can still
   *  undo their most recent tag application even after a few skips. */
  const handleYes = useCallback((): void => {
    if (!current || exitDecision) return
    // armed is now the SOURCE OF TRUTH for the card's new tag list. In
    // review mode the strip starts pre-armed with current.tags, so this
    // semantic lets the user *remove* a tag by un-arming the chip. In
    // 'untagged' mode current.tags is empty, so armed-only is also union
    // (= no behavior change for the rapid-fire combo workflow).
    const tagsChanged =
      armedTagIds.size !== current.tags.length ||
      current.tags.some(t => !armedTagIds.has(t))
    if (tagsChanged) {
      setLastAction({ bookmarkId: current.bookmarkId, prev: [...current.tags] })
    }
    setExitDecision('yes')
    const composed: string[] = Array.from(armedTagIds)
    const bookmarkId = current.bookmarkId
    setTimeout((): void => {
      void persistTags(bookmarkId, composed).finally((): void => {
        setExitDecision(null)
        // In `untagged` mode, applying any tag auto-removes the card from
        // the queue (= queue shrinks), so we don't advance. In every
        // other case the queue length is stable, so we must advance.
        const queueShrinks = mode === 'untagged' && armedTagIds.size > 0
        if (!queueShrinks) setIndex((i) => i + 1)
      })
    }, SWIPE_ANIM_MS)
  }, [current, exitDecision, armedTagIds, persistTags, mode])

  /** No: don't apply tags, just advance. Animation slides card left.
   *  lastAction is preserved so Z can still undo the last Yes-with-tags
   *  action across several No skips. */
  const handleNo = useCallback((): void => {
    if (!current || exitDecision) return
    setExitDecision('no')
    setTimeout((): void => {
      setExitDecision(null)
      setIndex((i) => i + 1)
    }, SWIPE_ANIM_MS)
  }, [current, exitDecision])

  /** Bookmark we want to jump back to after the queue re-derives from
   *  the updated items list. Consumed in the useEffect below. */
  const undoTargetRef = useRef<string | null>(null)

  /** Undo: revert the most recent Yes-with-tags. Bails during the slide
   *  animation (= exitDecision != null) because the pending setTimeout
   *  in handleYes would race and re-apply the tags right after we revert.
   *  Instead of blindly decrementing the index, we mark the bookmark id
   *  and let the queue-watching effect re-locate it once IDB updates. */
  const handleUndo = useCallback(async (): Promise<void> => {
    if (!lastAction || exitDecision) return
    undoTargetRef.current = lastAction.bookmarkId
    await persistTags(lastAction.bookmarkId, lastAction.prev)
    setLastAction(null)
  }, [lastAction, exitDecision, persistTags])

  /** After persistTags resolves and the items list / queue rebuilds,
   *  locate the undone bookmark in the new queue and jump the cursor
   *  there. Works across `all` / `untagged` / `tag:X` modes since each
   *  computes its own queue. Falls through (= no setIndex) if the
   *  bookmark isn't in the current mode's queue. */
  useEffect(() => {
    const target = undoTargetRef.current
    if (!target) return
    const idx = queue.findIndex((it) => it.bookmarkId === target)
    if (idx >= 0) setIndex(idx)
    undoTargetRef.current = null
  }, [queue])

  const handleCreateTagAddArmed = useCallback(async (name: string): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) return
    const colors = ['#7c5cfc', '#e066d7', '#4ecdc4', '#f5a623', '#ff6b6b']
    const color = colors[tags.length % colors.length]
    const created = await create({ name: trimmed, color, order: tags.length })
    setArmedTagIds((prev) => {
      const next = new Set(prev)
      next.add(created.id)
      return next
    })
  }, [tags.length, create])

  const exit = useCallback((): void => { router.push('/board') }, [router])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') { e.preventDefault(); exit(); return }
      if (!mode) return
      const lk = e.key.toLowerCase()
      if (e.key === 'ArrowRight' || lk === 'd') { e.preventDefault(); handleYes(); return }
      if (e.key === 'ArrowLeft'  || lk === 'a') { e.preventDefault(); handleNo();  return }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [exit, handleYes, handleNo, mode])

  useTagPickerKeys({
    tags,
    onToggleArmed: toggleArmed,
    onNo: handleNo,
    onUndo: lastAction ? handleUndo : null,
  })

  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const start = dragStartRef.current
    dragStartRef.current = null
    if (!start) return
    const dx = e.clientX - start.x
    if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
    if (dx > 0) handleYes()
    else handleNo()
  }
  const onPointerCancel = (): void => { dragStartRef.current = null }

  if (loading) {
    return (
      <div className={styles.simpleRoot}>
        <div className={styles.main}><div>Loading…</div></div>
      </div>
    )
  }

  // mode === null is a transient state — the useEffect above will replace
  // the URL on the next tick. Render a loading placeholder so we don't
  // flash blank canvas during the redirect.
  if (!mode) {
    return (
      <div className={styles.simpleRoot}>
        <div className={styles.main}><div>Loading…</div></div>
      </div>
    )
  }

  if (!current) {
    return (
      <div className={styles.simpleRoot}>
        <div className={styles.main}>
          <div className={styles.empty}>
            <div style={{ fontSize: 20, fontFamily: 'var(--font-sans)' }}>
              {total === 0 ? t('triage.empty') : t('triage.done_title')}
            </div>
            <button type="button" className={styles.backBtn} onClick={exit}>
              {total === 0 ? t('triage.empty_cta') : t('triage.done_back')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Zero-pad to 2 digits so the chrome reads as the same "data plate"
  // language as the FilterPill's 3-digit count (= "AllMarks · 042" etc.).
  // 100+ items naturally overflows the padding, which is fine.
  const pad2 = (n: number): string => String(n).padStart(2, '0')
  const progressText = t('triage.progress')
    .replace('{current}', pad2(index + 1))
    .replace('{total}', pad2(total))

  // Click outside the glass / chrome (= the bare black margin) closes the
  // page, mirroring the ESC button. Buttons + chip strip stop the event
  // at their own elements so e.target !== currentTarget there; the heading
  // + progress are pointer-events:none so clicks fall through to root.
  const handleRootClick = (e: ReactMouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) exit()
  }

  return (
    <div
      className={styles.root}
      data-testid="triage-page"
      onClick={handleRootClick}
    >
      <AmbientBackdrop item={current} exitDecision={exitDecision} />
      {incoming && (
        <AmbientBackdrop
          key={`incoming-bg-${incoming.bookmarkId}`}
          item={incoming}
          role="incoming"
          enterDirection={incomingDirection}
        />
      )}

      {/* Outer chrome — editorial 2-row layout (session 81):
            Row 1: "TAG THIS." headline (left)  +  progress + ESC (right)
            Row 2: chip strip (full width, beneath the headline) */}
      <h1 className={styles.outerHeading} aria-label="Tag this card">
        TAG THIS<span className={styles.headingAccent}>.</span>
      </h1>
      <span className={styles.outerProgress}>{progressText}</span>
      <div className={styles.outerTagStrip}>
        <TopTagStrip
          tags={tags}
          armedTagIds={armedTagIds}
          onToggle={toggleArmed}
          onCreate={handleCreateTagAddArmed}
        />
      </div>
      <button type="button" className={styles.outerBackBtn} onClick={exit}>ESC</button>

      {/* SVG defs for the glass refraction filter (= reused from session 78). */}
      <svg className={styles.glassFilterDefs} aria-hidden="true">
        <defs>
          <filter id="triage-glass-refract" x="0%" y="0%" width="100%" height="100%">
            <feImage
              href="/displacement/lens-edge.png"
              result="dmap"
              preserveAspectRatio="none"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="dmap"
              scale="80"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Central glass canvas — overflow:hidden clips the card as it slides off. */}
      <div
        className={styles.canvas}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div className={styles.canvasCardHost}>
          <TriageCard key={current.bookmarkId} item={current} exitDecision={exitDecision} />
          {incoming && (
            <TriageCard
              key={`incoming-${incoming.bookmarkId}`}
              item={incoming}
              role="incoming"
              enterDirection={incomingDirection}
            />
          )}
        </div>

        {/* Yes / No swipe hints — sit on the glass pane (inside canvas).
            Clickable buttons so mouse users have a direct path (= not
            just swipe / keyboard). */}
        <button
          type="button"
          className={`${styles.swipeHint} ${styles.noHint}`}
          onClick={handleNo}
          aria-label="No, skip this card"
          data-testid="triage-no-button"
        >
          <span className={styles.swipeArrow}>←</span>
          <span className={styles.swipeVerdict}>NO</span>
        </button>
        <button
          type="button"
          className={`${styles.swipeHint} ${styles.yesHint}`}
          onClick={handleYes}
          aria-label="Yes, apply armed tags"
          data-testid="triage-yes-button"
        >
          <span className={styles.swipeVerdict}>YES</span>
          <span className={styles.swipeArrow}>→</span>
        </button>

        <div className={styles.canvasFooter}>{t('triage.hint')}</div>
      </div>
    </div>
  )
}

