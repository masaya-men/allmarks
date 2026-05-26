'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBoardData } from '@/lib/storage/use-board-data'
import { useTags } from '@/lib/storage/use-tags'
import type { TagRecord } from '@/lib/storage/indexeddb'
import { t } from '@/lib/i18n/t'
import { HeuristicTagger } from '@/lib/tagger/heuristic'
import { TriageCard } from './TriageCard'
import { TagPicker } from './TagPicker'
import { AmbientBackdrop } from './AmbientBackdrop'
import styles from './TriagePage.module.css'

type Direction = 'up' | 'right' | 'down' | 'left'
type TriageMode = 'untagged' | 'all' | { tagId: string }

const SWIPE_ANIM_MS = 220
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
  const [exitDirection, setExitDirection] = useState<Direction | null>(null)
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

  /** In `all` and `tag:<id>` modes, the card may already have tags. We MERGE
   *  (= union, not replace) so the user can keep adding without losing what
   *  was there. In `untagged`, the card has no tags, so this is just the
   *  composed list. */
  const persistMainPlusCo = useCallback(async (mainTagId: string): Promise<void> => {
    if (!current) return
    setLastAction({ bookmarkId: current.bookmarkId, prev: [...current.tags] })
    const composed: string[] = []
    const seen = new Set<string>()
    const push = (id: string): void => { if (!seen.has(id)) { seen.add(id); composed.push(id) } }
    // main first, then co-tags, then existing tags (= preserves user-visible ordering of intent)
    push(mainTagId)
    for (const id of coTagIds) push(id)
    for (const id of current.tags) push(id)
    await persistTags(current.bookmarkId, composed)
  }, [current, coTagIds, persistTags])

  const handleSwipe = useCallback((dir: Direction): void => {
    if (exitDirection) return
    const slot = shiftHeld ? secondaryDirectional : primaryDirectional
    const mainTag = slot[dir]
    if (!mainTag) return
    setExitDirection(dir)
    setTimeout((): void => {
      void persistMainPlusCo(mainTag.id).finally((): void => {
        setExitDirection(null)
        // In untagged/tag modes the persisted card drops out of the queue
        // automatically (= filter recomputes). In `all` mode the card stays
        // in the queue, so we must advance the index manually.
        if (mode === 'all') setIndex((i) => i + 1)
      })
    }, SWIPE_ANIM_MS)
  }, [exitDirection, shiftHeld, primaryDirectional, secondaryDirectional, persistMainPlusCo, mode])

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') { e.preventDefault(); exit(); return }
      if (!mode) return // entry-picker owns its own keys
      const lk = e.key.toLowerCase()
      if (e.key === 'ArrowUp'    || lk === 'w') { e.preventDefault(); handleSwipe('up'); return }
      if (e.key === 'ArrowRight' || lk === 'd') { e.preventDefault(); handleSwipe('right'); return }
      if (e.key === 'ArrowDown'  || lk === 's') { e.preventDefault(); handleSwipe('down'); return }
      if (e.key === 'ArrowLeft'  || lk === 'a') { e.preventDefault(); handleSwipe('left'); return }
    }
    window.addEventListener('keydown', onKey)
    return (): void => window.removeEventListener('keydown', onKey)
  }, [exit, handleSwipe, mode])

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

  // Entry picker: shown when no `mode` query param. Lets the user pick the
  // cohort they want to triage from the "AllMarks" entry point. Other entry
  // points (= tag-filtered, inbox, etc.) hard-code a mode and skip this.
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
      <AmbientBackdrop item={current} exitDirection={exitDirection} />
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
    <div className={styles.root}>
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
