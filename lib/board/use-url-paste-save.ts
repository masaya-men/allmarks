'use client'
import { useEffect, useRef, useState } from 'react'
import { initDB, addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { extractSinglePastedUrl, isEditableTarget } from '@/lib/board/paste-url'
import { ingestPastedUrl, fetchOgpMeta, isEmbeddableType } from '@/lib/board/paste-ingest'
import { detectUrlType } from '@/lib/utils/url'

export type PasteFeedback = { readonly kind: 'loading' | 'duplicate' | null }
const DUPLICATE_MS = 1600

export function useUrlPasteSave(opts: {
  onSaved: (bookmarkId: string) => void | Promise<void>
}): { feedback: PasteFeedback } {
  const [feedback, setFeedback] = useState<PasteFeedback>({ kind: null })
  const onSavedRef = useRef(opts.onSaved)
  onSavedRef.current = opts.onSaved
  const busyRef = useRef(false)
  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = async (e: ClipboardEvent): Promise<void> => {
      if (busyRef.current) return
      if (isEditableTarget(e.target)) return
      const text = e.clipboardData?.getData('text/plain') ?? ''
      const url = extractSinglePastedUrl(text)
      if (!url) return
      e.preventDefault()
      busyRef.current = true
      if (!isEmbeddableType(detectUrlType(url))) setFeedback({ kind: 'loading' })
      try {
        const db = await initDB()
        const result = await ingestPastedUrl(url, { db, getAll: getAllBookmarks, add: addBookmark, fetchOgp: fetchOgpMeta })
        if (result.outcome === 'saved' && result.bookmarkId) {
          setFeedback({ kind: null })
          await onSavedRef.current(result.bookmarkId)
        } else {
          setFeedback({ kind: 'duplicate' })
          if (dupTimerRef.current !== null) clearTimeout(dupTimerRef.current)
          dupTimerRef.current = setTimeout(() => {
            dupTimerRef.current = null
            setFeedback({ kind: null })
          }, DUPLICATE_MS)
        }
      } catch {
        setFeedback({ kind: null })
      } finally {
        busyRef.current = false
      }
    }
    const listener = (e: Event): void => { void handler(e as ClipboardEvent) }
    document.addEventListener('paste', listener)
    return (): void => {
      document.removeEventListener('paste', listener)
      if (dupTimerRef.current !== null) {
        clearTimeout(dupTimerRef.current)
        dupTimerRef.current = null
      }
    }
  }, [])

  return { feedback }
}
