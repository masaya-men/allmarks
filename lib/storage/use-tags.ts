'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { IDBPDatabase } from 'idb'
import type { TagRecord, TagInput } from './indexeddb'
import { initDB } from './indexeddb'
import { addTag, getAllTags, updateTag as updTag, deleteTagCascade as delTag, reorderTags as reorderTagsDb } from './tags'
import { loadTagOrderMode, saveTagOrderMode } from './tag-order-mode'
import { DEFAULT_TAG_ORDER_MODE, sortTagsByMode, type TagOrderMode } from '@/lib/board/tag-order'

/* eslint-disable @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

export function useTags(): {
  /** Tags in display order (name-sorted in an auto mode, hand order in manual). */
  tags: TagRecord[]
  loading: boolean
  /** Current ordering mode (auto-asc / auto-desc / manual). */
  orderMode: TagOrderMode
  /** Switch ordering mode (e.g. the asc/desc toggle). Persists. */
  setOrderMode: (mode: TagOrderMode) => Promise<void>
  create: (input: TagInput) => Promise<TagRecord>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Persist a hand-dragged order — also flips the mode to `manual`. */
  reorder: (orderedIds: readonly string[]) => Promise<void>
  reload: () => Promise<void>
} {
  // Raw tags (whatever order getAllTags returns); the display order is derived
  // from `orderMode` below so every surface agrees.
  const [rawTags, setRawTags] = useState<TagRecord[]>([])
  const [orderMode, setOrderModeState] = useState<TagOrderMode>(DEFAULT_TAG_ORDER_MODE)
  const [loading, setLoading] = useState(true)
  const dbRef = useRef<DbLike | null>(null)

  const tags = useMemo(() => sortTagsByMode(rawTags, orderMode), [rawTags, orderMode])

  const reload = useCallback(async (): Promise<void> => {
    const db = dbRef.current
    if (!db) return
    const list = await getAllTags(db)
    setRawTags(list)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async (): Promise<void> => {
      const db = (await initDB()) as unknown as DbLike
      if (cancelled) return
      dbRef.current = db
      const [list, mode] = await Promise.all([getAllTags(db), loadTagOrderMode(db)])
      if (cancelled) return
      setRawTags(list)
      setOrderModeState(mode)
      setLoading(false)
    })().catch(() => {
      if (!cancelled) setLoading(false)
    })
    return (): void => { cancelled = true }
  }, [])

  const create = useCallback(async (input: TagInput): Promise<TagRecord> => {
    const db = dbRef.current
    if (!db) throw new Error('tags db not ready')
    const created = await addTag(db, input)
    // Append to the raw set; the derived `tags` re-sorts it into place (name
    // order in an auto mode, end of the list in manual).
    setRawTags((prev) => [...prev, created])
    return created
  }, [])

  const rename = useCallback(async (id: string, name: string): Promise<void> => {
    const db = dbRef.current
    if (!db) return
    await updTag(db, id, { name })
    setRawTags((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)))
  }, [])

  const remove = useCallback(async (id: string): Promise<void> => {
    const db = dbRef.current
    if (!db) return
    await delTag(db, id)
    setRawTags((prev) => prev.filter((m) => m.id !== id))
  }, [])

  /** Persist a new complete tag order (each id gets its array index as
   *  `order`) AND switch to manual mode — a hand drag means "I want this exact
   *  order". `orderedIds` comes from the currently displayed order, so the
   *  manual order starts from whatever the user was looking at. */
  const reorder = useCallback(async (orderedIds: readonly string[]): Promise<void> => {
    const db = dbRef.current
    if (!db) return
    await reorderTagsDb(db, orderedIds)
    await saveTagOrderMode(db, 'manual')
    setOrderModeState('manual')
    setRawTags((prev) => {
      const byId = new Map(prev.map((t) => [t.id, t]))
      const next = orderedIds
        .map((id, i) => {
          const t = byId.get(id)
          return t ? { ...t, order: i } : null
        })
        .filter((t): t is TagRecord => t !== null)
      const seen = new Set(orderedIds)
      for (const t of prev) if (!seen.has(t.id)) next.push({ ...t, order: next.length })
      return next
    })
  }, [])

  const setOrderMode = useCallback(async (mode: TagOrderMode): Promise<void> => {
    const db = dbRef.current
    setOrderModeState(mode)
    if (db) await saveTagOrderMode(db, mode)
  }, [])

  return { tags, loading, orderMode, setOrderMode, create, rename, remove, reorder, reload }
}
