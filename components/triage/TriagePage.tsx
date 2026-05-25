'use client'

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { useBoardData } from '@/lib/storage/use-board-data'
import { useTags } from '@/lib/storage/use-tags'
import { t } from '@/lib/i18n/t'
import { HeuristicTagger } from '@/lib/tagger/heuristic'
import { TriageCard } from './TriageCard'
import { TagPicker } from './TagPicker'
import styles from './TriagePage.module.css'

export function TriagePage(): ReactElement {
  const router = useRouter()
  const { items, persistTags, loading } = useBoardData()
  const { tags, create } = useTags()
  const queue = useMemo(() => items.filter((it) => !it.isDeleted && it.tags.length === 0), [items])
  const [index, setIndex] = useState(0)
  const [lastAction, setLastAction] = useState<{ bookmarkId: string; prev: readonly string[] } | null>(null)

  const current = queue[index] ?? null
  const total = queue.length

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

  const handleSkip = useCallback((): void => {
    if (!current) return
    setLastAction(null) // clear undo target so Undo can't restore a prior tag
    setIndex((i) => i + 1)
  }, [current])

  const handleUndo = async (): Promise<void> => {
    if (!lastAction) return
    await persistTags(lastAction.bookmarkId, lastAction.prev)
    setLastAction(null)
    setIndex((i) => Math.max(0, i - 1))
  }

  const handleNewTag = async (name: string): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) return
    const colors = ['#7c5cfc', '#e066d7', '#4ecdc4', '#f5a623', '#ff6b6b']
    const color = colors[tags.length % colors.length]
    const created = await create({ name: trimmed, color, order: tags.length })
    await handleTag(created.id)
  }

  const exit = (): void => router.push('/board')

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
      <div className={styles.main}>
        <TriageCard key={current.bookmarkId} item={current} />
      </div>
      <TagPicker
        tags={tags}
        onTag={handleTag}
        onSkip={handleSkip}
        onUndo={lastAction ? handleUndo : null}
        onCreateTag={handleNewTag}
        suggestedTagIds={suggestedTagIds}
      />
      <div className={styles.footer}>{t('triage.hint')}</div>
    </div>
  )
}
