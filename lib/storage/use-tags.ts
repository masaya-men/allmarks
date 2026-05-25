'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { IDBPDatabase } from 'idb'
import type { TagRecord, TagInput } from './indexeddb'
import { initDB } from './indexeddb'
import { addTag, getAllTags, updateTag as updTag, deleteTag as delTag } from './tags'

/* eslint-disable @typescript-eslint/no-explicit-any */
type DbLike = IDBPDatabase<any>

export function useTags(): {
  tags: TagRecord[]
  loading: boolean
  create: (input: TagInput) => Promise<TagRecord>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
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

  return { tags, loading, create, rename, remove, reload }
}
