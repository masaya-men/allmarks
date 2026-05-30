'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { IDBPDatabase } from 'idb'
import type { TagRecord, TagInput } from './indexeddb'
import { initDB } from './indexeddb'
import { addTag, getAllTags, updateTag as updTag, deleteTagCascade as delTag, reorderTags as reorderTagsDb } from './tags'

/* eslint-disable @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

export function useTags(): {
  tags: TagRecord[]
  loading: boolean
  create: (input: TagInput) => Promise<TagRecord>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
  reorder: (orderedIds: readonly string[]) => Promise<void>
  reload: () => Promise<void>
} {
  const [tags, setTags] = useState<TagRecord[]>([])
  const [loading, setLoading] = useState(true)
  const dbRef = useRef<DbLike | null>(null)

  const reload = useCallback(async (): Promise<void> => {
    const db = dbRef.current
    if (!db) return
    const list = await getAllTags(db)
    setTags(list)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async (): Promise<void> => {
      const db = (await initDB()) as unknown as DbLike
      if (cancelled) return
      dbRef.current = db
      const list = await getAllTags(db)
      if (cancelled) return
      setTags(list)
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
    setTags((prev) => [...prev, created].sort((a, b) => a.order - b.order))
    return created
  }, [])

  const rename = useCallback(async (id: string, name: string): Promise<void> => {
    const db = dbRef.current
    if (!db) return
    await updTag(db, id, { name })
    setTags((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)))
  }, [])

  const remove = useCallback(async (id: string): Promise<void> => {
    const db = dbRef.current
    if (!db) return
    await delTag(db, id)
    setTags((prev) => prev.filter((m) => m.id !== id))
  }, [])

  /** Persist a new complete tag order (each id gets its array index as
   *  `order`). Updates local state optimistically so every tag surface
   *  (filter dropdown, triage strip, background typography) reflects the
   *  new order at once — order is a single shared field. */
  const reorder = useCallback(async (orderedIds: readonly string[]): Promise<void> => {
    const db = dbRef.current
    if (!db) return
    await reorderTagsDb(db, orderedIds)
    setTags((prev) => {
      const byId = new Map(prev.map((t) => [t.id, t]))
      const next = orderedIds
        .map((id, i) => {
          const t = byId.get(id)
          return t ? { ...t, order: i } : null
        })
        .filter((t): t is TagRecord => t !== null)
      // Defensive: keep any tag missing from orderedIds (shouldn't happen)
      // appended after, preserving their relative order.
      const seen = new Set(orderedIds)
      for (const t of prev) if (!seen.has(t.id)) next.push({ ...t, order: next.length })
      return next
    })
  }, [])

  return { tags, loading, create, rename, remove, reorder, reload }
}
