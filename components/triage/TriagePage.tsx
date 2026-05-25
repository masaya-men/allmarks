'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { useBoardData } from '@/lib/storage/use-board-data'
import { useTags } from '@/lib/storage/use-tags'
import type { TagRecord } from '@/lib/storage/indexeddb'
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

  // Phase B1: Shift flips primary <-> secondary; co-tags accumulate until swipe.
  const [shiftHeld, setShiftHeld] = useState(false)
  const [coTagIds, setCoTagIds] = useState<ReadonlySet<string>>(() => new Set())

  const current = queue[index] ?? null
  const total = queue.length

  const primaryDirectional = useMemo<Record<Direction, TagRecord | undefined>>(() => ({
    up: tags[0], right: tags[1], down: tags[2], left: tags[3],
  }), [tags])
  const secondaryDirectional = useMemo<Record<Direction, TagRecord | undefined>>(() => ({
    up: tags[4], right: tags[5], down: tags[6], left: tags[7],
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

  // Reset accumulated co-tags whenever the queue advances to a new card.
  useEffect(() => {
    setCoTagIds(new Set())
  }, [current?.bookmarkId])

  const toggleCoTag = useCallback((tagId: string): void => {
    setCoTagIds((prev) => {
      const next = new Set(prev)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
  }, [])

  /** Compose final tag list (main + co-tags, deduped, main-first) and persist. */
  const persistMainPlusCo = useCallback(async (mainTagId: string): Promise<void> => {
    if (!current) return
    setLastAction({ bookmarkId: current.bookmarkId, prev: [...current.tags] })
    const composed: string[] = [mainTagId]
    for (const id of coTagIds) if (id !== mainTagId) composed.push(id)
    await persistTags(current.bookmarkId, composed)
  }, [current, coTagIds, persistTags])

  /** Directional swipe: arrow key, drag, OR chip click all funnel through here.
   *  Sets the exit direction so the card slides out, then persists main + co-tags
   *  together once the animation has had time to play. */
  const handleSwipe = useCallback((dir: Direction): void => {
    if (exitDirection) return
    const slot = shiftHeld ? secondaryDirectional : primaryDirectional
    const mainTag = slot[dir]
    if (!mainTag) return
    setExitDirection(dir)
    setTimeout((): void => {
      void persistMainPlusCo(mainTag.id).finally((): void => {
        setExitDirection(null)
      })
    }, SWIPE_ANIM_MS)
  }, [exitDirection, shiftHeld, primaryDirectional, secondaryDirectional, persistMainPlusCo])

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

  const handleCreateTagAddToCo = useCallback(async (name: string): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) return
    const colors = ['#7c5cfc', '#e066d7', '#4ecdc4', '#f5a623', '#ff6b6b']
    const color = colors[tags.length % colors.length]
    const created = await create({ name: trimmed, color, order: tags.length })
    setCoTagIds((prev) => {
      const next = new Set(prev)
      next.add(created.id)
      return next
    })
  }, [tags.length, create])

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

  // Shift tracking: keydown/keyup AND window blur (= avoid stuck-held state
  // if the user alt-tabs while Shift is down).
  useEffect(() => {
    const onDown = (e: KeyboardEvent): void => { if (e.key === 'Shift') setShiftHeld(true) }
    const onUp = (e: KeyboardEvent): void => { if (e.key === 'Shift') setShiftHeld(false) }
    const onBlur = (): void => setShiftHeld(false)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return (): void => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

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
          primaryDirectional={primaryDirectional}
          secondaryDirectional={secondaryDirectional}
          shiftHeld={shiftHeld}
          coTagIds={coTagIds}
          onDirectionSwipe={handleSwipe}
          onToggleCoTag={toggleCoTag}
          onSkip={handleSkip}
          onUndo={lastAction ? handleUndo : null}
          onCreateTagAddToCo={handleCreateTagAddToCo}
          suggestedTagIds={suggestedTagIds}
        />
      </div>
      <div className={styles.footer}>{t('triage.hint')}</div>
    </div>
  )
}
