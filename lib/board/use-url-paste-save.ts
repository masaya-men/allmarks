'use client'
import { useEffect, useRef, useState } from 'react'
import { initDB, addBookmark, getAllBookmarks } from '@/lib/storage/indexeddb'
import { extractSinglePastedUrl, isEditableTarget } from '@/lib/board/paste-url'
import { ingestPastedUrl, fetchOgpMeta } from '@/lib/board/paste-ingest'
import { detectUrlType } from '@/lib/utils/url'

export type PasteFeedback = { readonly kind: 'loading' | 'duplicate' | null }
const EMBEDDABLE = new Set(['tweet', 'youtube', 'tiktok', 'instagram', 'vimeo', 'soundcloud'])
const DUPLICATE_MS = 1600

export function useUrlPasteSave(opts: {
  onSaved: (bookmarkId: string) => void | Promise<void>
}): { feedback: PasteFeedback } {
  const [feedback, setFeedback] = useState<PasteFeedback>({ kind: null })
  const onSavedRef = useRef(opts.onSaved)
  onSavedRef.current = opts.onSaved
  const busyRef = useRef(false)

  useEffect(() => {
    const handler = async (e: ClipboardEvent): Promise<void> => {
      if (busyRef.current) return
      if (isEditableTarget(e.target)) return
      const text = e.clipboardData?.getData('text/plain') ?? ''
      const url = extractSinglePastedUrl(text)
      if (!url) return
      e.preventDefault()
      busyRef.current = true
      if (!EMBEDDABLE.has(detectUrlType(url))) setFeedback({ kind: 'loading' })
      try {
        const db = await initDB()
        const result = await ingestPastedUrl(url, { db, getAll: getAllBookmarks, add: addBookmark, fetchOgp: fetchOgpMeta })
        if (result.outcome === 'saved' && result.bookmarkId) {
          setFeedback({ kind: null })
          await onSavedRef.current(result.bookmarkId)
        } else {
          setFeedback({ kind: 'duplicate' })
          setTimeout(() => setFeedback({ kind: null }), DUPLICATE_MS)
        }
      } catch {
        setFeedback({ kind: null })
      } finally {
        busyRef.current = false
      }
    }
    const listener = (e: Event): void => { void handler(e as ClipboardEvent) }
    document.addEventListener('paste', listener)
    return (): void => document.removeEventListener('paste', listener)
  }, [])

  return { feedback }
}
