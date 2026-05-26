'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBoardData } from '@/lib/storage/use-board-data'
import { useTags } from '@/lib/storage/use-tags'
import type { TagRecord } from '@/lib/storage/indexeddb'
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
  const { items, persistTags, loading, reload: reloadBookmarks } = useBoardData()
  const { tags, create, remove: removeTag } = useTags()

  const untaggedItems = useMemo(() => items.filter((it) => !it.isDeleted && it.tags.length === 0), [items])
  const allItems = useMemo(() => items.filter((it) => !it.isDeleted), [items])

  const queue = useMemo(() => {
    if (mode === 'untagged') return untaggedItems
    if (mode === 'all') return allItems
    if (mode && typeof mode === 'object') {
      return items.filter((it) => !it.isDeleted && it.tags.includes(mode.tagId))
    }
    return [] // no mode = entry picker
  }, [mode, untaggedItems, allItems, items])

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
    const willApplyTags = armedTagIds.size > 0
    if (willApplyTags) {
      setLastAction({ bookmarkId: current.bookmarkId, prev: [...current.tags] })
    }
    setExitDecision('yes')
    const composed: string[] = []
    const seen = new Set<string>()
    const push = (id: string): void => { if (!seen.has(id)) { seen.add(id); composed.push(id) } }
    for (const id of armedTagIds) push(id)
    for (const id of current.tags) push(id)
    const bookmarkId = current.bookmarkId
    setTimeout((): void => {
      void persistTags(bookmarkId, composed).finally((): void => {
        setExitDecision(null)
        // In `untagged` mode, applied tags auto-remove the card from the
        // queue (= queue shrinks), so we don't advance. In every other
        // case the queue length is stable, so we must advance the index.
        const queueShrinks = mode === 'untagged' && willApplyTags
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

  // Entry picker
  if (!mode) {
    return (
      <EntryPicker
        onPickUntagged={(): void => router.replace('/triage?mode=untagged')}
        onPickAll={(): void => router.replace('/triage?mode=all')}
        untaggedCount={untaggedItems.length}
        allCount={allItems.length}
        onCancel={exit}
        tagsForManagement={tags}
        onRemoveTag={async (id: string): Promise<void> => {
          await removeTag(id)
          await reloadBookmarks()
        }}
      />
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

  const progressText = t('triage.progress')
    .replace('{current}', String(index + 1))
    .replace('{total}', String(total))

  return (
    <div className={styles.root} data-testid="triage-page">
      <AmbientBackdrop item={current} exitDecision={exitDecision} />
      {incoming && (
        <AmbientBackdrop
          key={`incoming-bg-${incoming.bookmarkId}`}
          item={incoming}
          role="incoming"
          enterDirection={incomingDirection}
        />
      )}

      {/* Outer chrome: progress (top-left) + tag strip (top-center) + ESC (top-right). */}
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

function EntryPicker({
  onPickUntagged, onPickAll, untaggedCount, allCount, onCancel,
  tagsForManagement, onRemoveTag,
}: {
  onPickUntagged: () => void
  onPickAll: () => void
  untaggedCount: number
  allCount: number
  onCancel: () => void
  tagsForManagement: ReadonlyArray<TagRecord>
  onRemoveTag: (id: string) => Promise<void>
}): ReactElement {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 'Enter' || e.key === '1') { e.preventDefault(); onPickUntagged() }
      if (e.key === '2')                      { e.preventDefault(); onPickAll() }
      if (e.key === 'Escape')                 { e.preventDefault(); onCancel() }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [onPickUntagged, onPickAll, onCancel])

  const handleRemove = (tag: TagRecord): void => {
    const ok = window.confirm(`タグ "${tag.name}" を削除しますか?\nこのタグが付いているカードからもタグが外れます (= カード自体は残ります)。`)
    if (!ok) return
    void onRemoveTag(tag.id)
  }

  return (
    <div className={styles.simpleRoot}>
      <div className={styles.header}>
        <span>Choose what to triage</span>
        <button type="button" className={styles.backBtn} onClick={onCancel}>Esc</button>
      </div>
      <div className={styles.main}>
        <div className={styles.entryOptions}>
          <button type="button" className={styles.entryOption} onClick={onPickUntagged} data-default="true">
            <span className={styles.entryDigit}>1</span>
            <span className={styles.entryBody}>
              <span className={styles.entryLabel}>未分類のみ</span>
              <span className={styles.entryCount}>{untaggedCount}</span>
            </span>
            <span className={styles.entryHint}>ENTER</span>
          </button>
          <button type="button" className={styles.entryOption} onClick={onPickAll}>
            <span className={styles.entryDigit}>2</span>
            <span className={styles.entryBody}>
              <span className={styles.entryLabel}>全部</span>
              <span className={styles.entryCount}>{allCount}</span>
            </span>
            <span className={styles.entryHint}> </span>
          </button>
        </div>
        {tagsForManagement.length > 0 && (
          <div className={styles.tagManagement}>
            <div className={styles.tagManagementHeader}>Manage tags</div>
            <div className={styles.tagManagementList}>
              {tagsForManagement.map((tag) => (
                <div key={tag.id} className={styles.tagManagementRow}>
                  <span className={styles.tagManagementDot} style={{ background: tag.color }} />
                  <span className={styles.tagManagementName}>{tag.name}</span>
                  <button
                    type="button"
                    className={styles.tagManagementRemove}
                    onClick={(): void => handleRemove(tag)}
                    aria-label={`Delete tag ${tag.name}`}
                    data-testid={`remove-tag-${tag.id}`}
                  >
                    × Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className={styles.footer}>1 / 2 で選択 · ENTER = 未分類 · ESC = 戻る</div>
    </div>
  )
}
