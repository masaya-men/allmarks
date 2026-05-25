'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { useBoardData } from '@/lib/storage/use-board-data'
import { useTags } from '@/lib/storage/use-tags'
import { t } from '@/lib/i18n/t'
import { HeuristicTagger } from '@/lib/tagger/heuristic'
import { TriageCard } from './TriageCard'
import { TagPicker } from './TagPicker'
import styles from './TriagePage.module.css'

type Direction = 'up' | 'right' | 'down' | 'left'

const SWIPE_ANIM_MS = 180
const DRAG_THRESHOLD_PX = 60

export function TriagePage(): ReactElement {
  const router = useRouter()
  const { items, persistTags, loading } = useBoardData()
  const { tags, create } = useTags()
  const queue = useMemo(() => items.filter((it) => !it.isDeleted && it.tags.length === 0), [items])
  const [index, setIndex] = useState(0)
  const [lastAction, setLastAction] = useState<{ bookmarkId: string; prev: readonly string[] } | null>(null)
  const [exitDirection, setExitDirection] = useState<Direction | null>(null)

  const current = queue[index] ?? null
  const total = queue.length

  // Phase A: first 4 tags map to up/right/down/left. Phase B will gate this
  // behind a user pick step when tags.length > 8 and add Shift to flip to 5-8.
  const directional = useMemo<Record<Direction, typeof tags[number] | undefined>>(() => ({
    up: tags[0],
    right: tags[1],
    down: tags[2],
    left: tags[3],
  }), [tags])

  const [suggestedTagIds, setSuggestedTagIds] = useState<ReadonlyArray<string>>([])
  useEffect(() => {
    if (!current) { setSuggestedTagIds([]); return }
    let cancelled = false
    const tagger = new HeuristicTagger({ tags })
    void (async (): Promise<void> => {
      const suggestions = await tagger.suggest({
        url: current.url,
        title: current.title,
        description: '',
        siteName: '',
      })
      if (!cancelled) setSuggestedTagIds(suggestions.map((s) => s.tagId))
    })()
    return (): void => { cancelled = true }
  }, [current, tags])

  const handleTag = useCallback(async (tagId: string): Promise<void> => {
    if (!current) return
    setLastAction({ bookmarkId: current.bookmarkId, prev: [...current.tags] })
    await persistTags(current.bookmarkId, [tagId])
    // Do NOT advance index: tagging removes the current item from the queue
    // (its tags.length becomes > 0), so queue[index] naturally becomes the
    // next unprocessed card after the useMemo recomputes.
  }, [current, persistTags])

  // Animated swipe: arrow keys + pointer-drag funnel through here. Sets the
  // exit direction so the card slides out, then persists the tag once the
  // animation has had time to play (= ~SWIPE_ANIM_MS).
  const handleSwipe = useCallback((dir: Direction): void => {
    if (exitDirection) return // ignore re-entry mid-anim
    const tag = directional[dir]
    if (!tag) return // empty direction → no-op (Phase A: tags < 4 leaves slots empty)
    setExitDirection(dir)
    setTimeout((): void => {
      void handleTag(tag.id)
      setExitDirection(null)
    }, SWIPE_ANIM_MS)
  }, [exitDirection, directional, handleTag])

  const handleSkip = useCallback((): void => {
    if (!current) return
    setLastAction(null)
    setIndex((i) => i + 1)
  }, [current])

  const handleUndo = useCallback(async (): Promise<void> => {
    if (!lastAction) return
    await persistTags(lastAction.bookmarkId, lastAction.prev)
    setLastAction(null)
    setIndex((i) => Math.max(0, i - 1))
  }, [lastAction, persistTags])

  const handleNewTag = useCallback(async (name: string): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) return
    const colors = ['#7c5cfc', '#e066d7', '#4ecdc4', '#f5a623', '#ff6b6b']
    const color = colors[tags.length % colors.length]
    const created = await create({ name: trimmed, color, order: tags.length })
    await handleTag(created.id)
  }, [tags.length, create, handleTag])

  const exit = useCallback((): void => { router.push('/board') }, [router])

  // Arrow keys + Esc owned here. TagPicker handles digits / S / Z.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') { e.preventDefault(); exit(); return }
      if (e.key === 'ArrowUp')    { e.preventDefault(); handleSwipe('up'); return }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleSwipe('right'); return }
      if (e.key === 'ArrowDown')  { e.preventDefault(); handleSwipe('down'); return }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); handleSwipe('left'); return }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [exit, handleSwipe])

  // Pointer-drag swipe. Only the central card zone receives drag events;
  // TagPicker chips have pointer-events:auto on their own slots and stop
  // propagation via click, so chip taps remain instant (no swipe anim).
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const start = dragStartRef.current
    dragStartRef.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return
    const dir: Direction = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up')
    handleSwipe(dir)
  }
  const onPointerCancel = (): void => { dragStartRef.current = null }

  if (loading) return <div className={styles.root}><div>Loading…</div></div>

  if (!current) {
    return (
      <div className={styles.root}>
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

  return (
    <div className={styles.root} data-testid="triage-page">
      <div className={styles.header}>
        <span>{t('triage.progress').replace('{current}', String(index + 1)).replace('{total}', String(total))}</span>
        <button type="button" className={styles.backBtn} onClick={exit}>Esc</button>
      </div>
      <div
        className={styles.main}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <TriageCard key={current.bookmarkId} item={current} exitDirection={exitDirection} />
        <TagPicker
          tags={tags}
          onTag={handleTag}
          onSkip={handleSkip}
          onUndo={lastAction ? handleUndo : null}
          onCreateTag={handleNewTag}
          suggestedTagIds={suggestedTagIds}
        />
      </div>
      <div className={styles.footer}>{t('triage.hint')}</div>
    </div>
  )
}
